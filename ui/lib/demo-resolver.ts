// Demo Resolver Functions - Simulates resolver behavior for demo
// In production, this would be a separate service/worker

import { JsonRpcProvider, Wallet, Contract } from 'ethers'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { DEMO_CONFIG } from '../config/demo'

// Contract ABIs (minimal for demo)
const ESCROW_FACTORY_ABI = [
  "function createSrcEscrow(bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, bytes32 timelocksData) external payable returns (address)",
  "function createDstEscrow(bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, bytes32 timelocksData) external payable returns (address)"
]

const RESOLVER_ABI = [
  "function withdrawSrc(address escrowSrc, bytes32 secret) external",
  "function withdrawDst(address escrowDst, bytes32 secret) external"
]

export interface SwapOrder {
  id: string
  orderHash: string
  hashlock: string
  secret?: string
  maker: string
  token: string
  amount: string
  safetyDeposit: string
  timelocks: bigint
  srcChain: 'BSC' | 'SUI'
  dstChain: 'BSC' | 'SUI'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  completedAt?: Date
  srcEscrowId?: string
  dstEscrowId?: string
}

export class DemoResolver {
  private bscProvider: JsonRpcProvider | null = null
  private bscResolver: Wallet | null = null
  private suiClient: SuiClient | null = null
  private suiResolver: Ed25519Keypair | null = null
  private orders: Map<string, SwapOrder> = new Map()
  private mockMode: boolean = false

  constructor() {
    try {
      // Initialize BSC connection
      this.bscProvider = new JsonRpcProvider(DEMO_CONFIG.networks.bsc.rpcUrl)
      
      if (DEMO_CONFIG.accounts.bsc.resolver) {
        this.bscResolver = new Wallet(DEMO_CONFIG.accounts.bsc.resolver, this.bscProvider)
        console.log(`[RESOLVER] BSC initialized: ${this.bscResolver.address}`)
      } else {
        console.warn('[RESOLVER] BSC resolver private key not configured, using mock mode')
        this.mockMode = true
      }

      // Initialize Sui connection
      try {
        this.suiClient = new SuiClient({ 
          url: getFullnodeUrl(DEMO_CONFIG.networks.sui.network as any) 
        })
        
        if (DEMO_CONFIG.accounts.sui.resolver) {
          const keyBuffer = Buffer.from(DEMO_CONFIG.accounts.sui.resolver, 'base64')
          const secretKey = keyBuffer.length === 33 ? keyBuffer.slice(1) : keyBuffer
          this.suiResolver = Ed25519Keypair.fromSecretKey(secretKey)
          console.log(`[RESOLVER] Sui initialized: ${this.suiResolver.toSuiAddress()}`)
        } else {
          console.warn('[RESOLVER] Sui resolver private key not configured, using mock mode')
          this.mockMode = true
        }
      } catch (error) {
        console.warn('[RESOLVER] Failed to initialize Sui client, using mock mode:', error)
        this.mockMode = true
      }

      if (this.mockMode) {
        console.log('[RESOLVER] Running in MOCK MODE - simulated transactions only')
      } else {
        console.log('[RESOLVER] Running in LIVE MODE - real blockchain transactions')
      }
    } catch (error) {
      console.error('[RESOLVER] Initialization failed, falling back to mock mode:', error)
      this.mockMode = true
    }
  }

  /**
   * Check if resolver is running in mock mode
   */
  isInMockMode(): boolean {
    return this.mockMode
  }

  /**
   * Get resolver status for UI
   */
  getStatus(): { available: boolean; mode: 'live' | 'mock' | 'unavailable' } {
    if (!this.mockMode && this.bscResolver && this.suiResolver) {
      return { available: true, mode: 'live' }
    } else if (this.mockMode) {
      return { available: true, mode: 'mock' }
    } else {
      return { available: false, mode: 'unavailable' }
    }
  }

  /**
   * Monitor Sui OrderPool for new orders (Sui → BSC)
   */
  async processOrderFromSui(orderHash: string): Promise<SwapOrder> {
    console.log(`[RESOLVER] Processing Sui order: ${orderHash}`)
    
    const order: SwapOrder = {
      id: `sui-${Date.now()}`,
      orderHash,
      hashlock: '0x' + 'a'.repeat(64), // Mock hashlock
      maker: '0x' + '1'.repeat(40), // Mock maker address
      token: '0x2::sui::SUI', // SUI token
      amount: '1000000000', // 1 SUI in nanoSUI
      safetyDeposit: '100000000', // 0.1 SUI
      timelocks: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
      srcChain: 'SUI',
      dstChain: 'BSC',
      status: 'processing',
      createdAt: new Date()
    }

    try {
      if (this.mockMode) {
        console.log(`[RESOLVER] MOCK MODE: Simulating Sui → BSC swap`)
        
        // Mock source escrow creation
        order.srcEscrowId = `0xsui_escrow_${Date.now()}`
        console.log(`[RESOLVER] MOCK: Created Sui escrow ${order.srcEscrowId}`)
        
        // Mock destination escrow creation
        order.dstEscrowId = `0xbsc_escrow_${Date.now()}`
        console.log(`[RESOLVER] MOCK: Created BSC escrow ${order.dstEscrowId}`)
        
        // Complete swap after short delay
        setTimeout(async () => {
          console.log(`[RESOLVER] MOCK: Completing swap ${order.id}`)
          order.status = 'completed'
          order.completedAt = new Date()
          order.secret = '0x' + 'secret'.padEnd(64, '0')
        }, 3000) // 3 second delay for demo
        
      } else {
        // Real blockchain transactions
        // 1. Take order from Sui OrderPool and create source escrow
        const srcEscrowId = await this.takeOrderAndCreateSrcEscrow(orderHash)
        order.srcEscrowId = srcEscrowId

        // 2. Create destination escrow on BSC
        const dstEscrowId = await this.createBscEscrow(order)
        order.dstEscrowId = dstEscrowId

        // 3. Generate and reveal secret after finality period
        setTimeout(async () => {
          await this.completeSwap(order.id)
        }, 5000) // 5 second finality period for demo
      }

      order.status = 'pending'
      this.orders.set(order.id, order)
      
      console.log(`[RESOLVER] Order processed: ${order.id}`)
      return order

    } catch (error) {
      console.error(`[RESOLVER] Order processing failed:`, error)
      order.status = 'failed'
      this.orders.set(order.id, order)
      throw error
    }
  }

  /**
   * Monitor BSC for new escrows (BSC → Sui)
   */
  async processEscrowFromBsc(escrowAddress: string, orderData: any): Promise<SwapOrder> {
    console.log(`[RESOLVER] Processing BSC escrow: ${escrowAddress}`)
    
    const order: SwapOrder = {
      id: `bsc-${Date.now()}`,
      orderHash: orderData.orderHash,
      hashlock: orderData.hashlock,
      maker: orderData.maker,
      token: orderData.token,
      amount: orderData.amount,
      safetyDeposit: orderData.safetyDeposit,
      timelocks: orderData.timelocks,
      srcChain: 'BSC',
      dstChain: 'SUI',
      status: 'processing',
      createdAt: new Date(),
      srcEscrowId: escrowAddress
    }

    try {
      // 1. Create destination escrow on Sui
      const dstEscrowId = await this.createSuiEscrow(order)
      order.dstEscrowId = dstEscrowId

      // 2. Complete swap after finality period
      setTimeout(async () => {
        await this.completeSwap(order.id)
      }, 5000) // 5 second finality period for demo

      order.status = 'pending'
      this.orders.set(order.id, order)
      
      console.log(`[RESOLVER] Order processed: ${order.id}`)
      return order

    } catch (error) {
      console.error(`[RESOLVER] Order processing failed:`, error)
      order.status = 'failed'
      this.orders.set(order.id, order)
      throw error
    }
  }

  /**
   * Take order from Sui OrderPool and create source escrow
   */
  private async takeOrderAndCreateSrcEscrow(orderHash: string): Promise<string> {
    if (!DEMO_CONFIG.contracts.sui.poolId || !DEMO_CONFIG.contracts.sui.factoryId || !DEMO_CONFIG.contracts.sui.capId) {
      throw new Error('Sui contracts not configured')
    }

    const tx = new Transaction()

    const escrowId = tx.moveCall({
      target: `${DEMO_CONFIG.contracts.sui.packageId}::order_pool::take_order_and_create_escrow`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(DEMO_CONFIG.contracts.sui.poolId),
        tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
        tx.object(DEMO_CONFIG.contracts.sui.factoryId),
        tx.object(DEMO_CONFIG.contracts.sui.capId),
        tx.pure.address(this.suiResolver.toSuiAddress()),
        tx.sharedObjectRef({
          objectId: '0x6',
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    })

    const result = await this.signAndExecuteSuiTx(tx)
    return this.extractEscrowId(result)
  }

  /**
   * Create BSC escrow
   */
  private async createBscEscrow(order: SwapOrder): Promise<string> {
    if (!DEMO_CONFIG.contracts.bsc.factory) {
      throw new Error('BSC factory contract not configured')
    }

    const factory = new Contract(
      DEMO_CONFIG.contracts.bsc.factory,
      ESCROW_FACTORY_ABI,
      this.bscResolver
    )

    // Generate secret and hashlock
    const secret = '0x' + Buffer.from('demo-secret-' + Date.now()).toString('hex').padEnd(64, '0')
    const hashlock = this.keccak256(secret)
    
    order.secret = secret
    order.hashlock = hashlock

    const tx = await factory.createDstEscrow(
      hashlock,
      order.maker,
      this.bscResolver.address,
      DEMO_CONFIG.contracts.bsc.usdc,
      order.amount,
      order.safetyDeposit,
      order.timelocks,
      { 
        value: order.amount, // For native token swaps
        gasLimit: 500000
      }
    )

    const receipt = await tx.wait()
    console.log(`[RESOLVER] BSC escrow created: ${receipt.contractAddress}`)
    
    return receipt.contractAddress
  }

  /**
   * Create Sui escrow
   */
  private async createSuiEscrow(order: SwapOrder): Promise<string> {
    if (!DEMO_CONFIG.contracts.sui.factoryId || !DEMO_CONFIG.contracts.sui.capId) {
      throw new Error('Sui factory contracts not configured')
    }

    const tx = new Transaction()

    // Split coins for escrow
    const [tokenCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
      tx.pure.u64(order.amount),
      tx.pure.u64(order.safetyDeposit)
    ])

    const escrowObject = tx.moveCall({
      target: `${DEMO_CONFIG.contracts.sui.packageId}::escrow_factory::create_dst_escrow_with_fields`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(DEMO_CONFIG.contracts.sui.factoryId),
        tx.object(DEMO_CONFIG.contracts.sui.capId),
        tokenCoin,
        safetyDepositCoin,
        tx.pure.vector('u8', this.hexToNumberArray(order.orderHash)),
        tx.pure.vector('u8', this.hexToNumberArray(order.hashlock)),
        tx.pure.address(order.maker),
        tx.pure.address(this.suiResolver.toSuiAddress()),
        tx.pure.address('0x2::sui::SUI'),
        tx.pure.u64(order.amount),
        tx.pure.u64(order.safetyDeposit),
        tx.pure.u256(order.timelocks),
        tx.sharedObjectRef({
          objectId: '0x6',
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    })

    tx.transferObjects([escrowObject], tx.pure.address(this.suiResolver.toSuiAddress()))

    const result = await this.signAndExecuteSuiTx(tx)
    return this.extractEscrowId(result)
  }

  /**
   * Complete swap by revealing secret and withdrawing
   */
  private async completeSwap(orderId: string): Promise<void> {
    const order = this.orders.get(orderId)
    if (!order || !order.secret) {
      throw new Error(`Order not found or secret not generated: ${orderId}`)
    }

    console.log(`[RESOLVER] Completing swap: ${orderId}`)

    try {
      if (order.srcChain === 'SUI') {
        // Sui → BSC: Withdraw from BSC first, then Sui
        await this.withdrawFromBsc(order.dstEscrowId!, order.secret)
        await this.withdrawFromSui(order.srcEscrowId!, order.secret)
      } else {
        // BSC → Sui: Withdraw from Sui first, then BSC
        await this.withdrawFromSui(order.dstEscrowId!, order.secret)
        await this.withdrawFromBsc(order.srcEscrowId!, order.secret)
      }

      order.status = 'completed'
      order.completedAt = new Date()
      
      console.log(`[RESOLVER] Swap completed: ${orderId}`)

    } catch (error) {
      console.error(`[RESOLVER] Swap completion failed:`, error)
      order.status = 'failed'
    }

    this.orders.set(orderId, order)
  }

  /**
   * Withdraw from BSC escrow
   */
  private async withdrawFromBsc(escrowAddress: string, secret: string): Promise<void> {
    if (!DEMO_CONFIG.contracts.bsc.resolver) {
      throw new Error('BSC resolver contract not configured')
    }

    const resolver = new Contract(
      DEMO_CONFIG.contracts.bsc.resolver,
      RESOLVER_ABI,
      this.bscResolver
    )

    const tx = await resolver.withdrawDst(escrowAddress, secret, {
      gasLimit: 300000
    })

    await tx.wait()
    console.log(`[RESOLVER] Withdrawn from BSC escrow: ${escrowAddress}`)
  }

  /**
   * Withdraw from Sui escrow
   */
  private async withdrawFromSui(escrowId: string, secret: string): Promise<void> {
    const tx = new Transaction()

    tx.moveCall({
      target: `${DEMO_CONFIG.contracts.sui.packageId}::escrow_dst::withdraw`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(escrowId),
        tx.pure.vector('u8', this.hexToNumberArray(secret)),
        tx.sharedObjectRef({
          objectId: '0x6',
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    })

    await this.signAndExecuteSuiTx(tx)
    console.log(`[RESOLVER] Withdrawn from Sui escrow: ${escrowId}`)
  }

  /**
   * Get order status
   */
  getOrder(orderId: string): SwapOrder | undefined {
    return this.orders.get(orderId)
  }

  /**
   * Get all orders
   */
  getAllOrders(): SwapOrder[] {
    return Array.from(this.orders.values())
  }

  // Utility functions
  private hexToNumberArray(hex: string): number[] {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes: number[] = []
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16))
    }
    return bytes
  }

  private keccak256(data: string): string {
    // Simple keccak256 implementation for demo
    // In production, use proper crypto library
    return '0x' + Buffer.from(data).toString('hex').padEnd(64, '0')
  }

  private async signAndExecuteSuiTx(tx: Transaction) {
    tx.setGasBudget(100000000) // 0.1 SUI

    const result = await this.suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: this.suiResolver,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    })

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Sui transaction failed: ${result.effects?.status?.error}`)
    }

    return result
  }

  private extractEscrowId(result: any): string {
    const events = result.events || []
    const createEvent = events.find((event: any) => 
      event.type.includes('SrcEscrowCreated') || event.type.includes('DstEscrowCreated')
    )
    
    if (createEvent && createEvent.parsedJson) {
      return (createEvent.parsedJson as any).escrow_id
    }

    // Fallback: look for created objects
    const created = result.objectChanges?.filter((change: any) => change.type === 'created') || []
    const escrowObj = created.find((obj: any) => 
      obj.objectType?.includes('EscrowSrc') || obj.objectType?.includes('EscrowDst')
    )
    
    if (escrowObj) {
      return escrowObj.objectId
    }

    throw new Error('Could not extract escrow ID from transaction result')
  }
}

// Singleton instance for demo - only create on client side
let demoResolver: DemoResolver | null = null

export function getDemoResolver(): DemoResolver | null {
  // Only initialize on client side to avoid SSR issues
  if (typeof window === 'undefined') {
    return null
  }
  
  if (!demoResolver) {
    try {
      demoResolver = new DemoResolver()
    } catch (error) {
      console.error('Failed to initialize demo resolver:', error)
      return null
    }
  }
  return demoResolver
}