// Cross-Chain Client for Demo - Handles user wallet interactions

import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useSuiAccount, useSuiWallet } from '../components/sui-wallet-provider'
import { Transaction } from '@mysten/sui/transactions'
import { DEMO_CONFIG } from '../config/demo'
import { Contract } from 'ethers'
import { toast } from '../components/ui/use-toast'

// Contract ABIs
const ESCROW_FACTORY_ABI = [
  "function createSrcEscrow(bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, bytes32 timelocksData) external payable returns (address)",
  "function createDstEscrow(bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, bytes32 timelocksData) external payable returns (address)"
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
]

export interface SwapParams {
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  fromChain: 'BSC' | 'SUI'
  toChain: 'BSC' | 'SUI'
}

export interface SwapResult {
  success: boolean
  orderId?: string
  escrowId?: string
  orderHash?: string
  txHash?: string
  error?: string
}

export interface SwapProgress {
  stage: 'preparing' | 'creating_order' | 'waiting_resolver' | 'completing' | 'completed' | 'failed'
  message: string
  txHash?: string
  orderId?: string
}

export class CrossChainClient {
  private bscAccount?: any
  private suiAccount?: any
  private bscWalletClient?: any
  private suiSignTransaction?: any

  constructor(
    bscAccount?: any,
    suiAccount?: any,
    bscWalletClient?: any,
    suiSignTransaction?: any
  ) {
    this.bscAccount = bscAccount
    this.suiAccount = suiAccount
    this.bscWalletClient = bscWalletClient
    this.suiSignTransaction = suiSignTransaction
  }

  /**
   * Execute Sui → BSC swap (Create order in OrderPool)
   */
  async executeSuiToBscSwap(params: SwapParams): Promise<SwapResult> {
    try {
      if (!this.suiAccount || !this.suiSignTransaction) {
        throw new Error('Sui wallet not connected')
      }

      if (!DEMO_CONFIG.contracts.sui.poolId) {
        throw new Error('Sui OrderPool not configured')
      }

      console.log('[CLIENT] Creating Sui → BSC swap order')
      
      // Generate order parameters
      const orderHash = this.generateOrderHash()
      const hashlock = this.generateHashlock()
      const timelocks = this.generateTimelocks()

      const tx = new Transaction()

      // Split coins for order creation
      const [tokenCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(params.fromAmount),
        tx.pure.u64('1000000000') // 0.1 SUI safety deposit
      ])

      tx.moveCall({
        target: `${DEMO_CONFIG.contracts.sui.packageId}::order_pool::create_order`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
          tx.object(DEMO_CONFIG.contracts.sui.poolId),
          tokenCoin,
          safetyDepositCoin,
          tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
          tx.pure.vector('u8', this.hexToNumberArray(hashlock)),
          tx.pure.address('0x2::sui::SUI'),
          tx.pure.u64(params.fromAmount),
          tx.pure.u64('1000000000'), // safety deposit
          tx.pure.u256(timelocks),
          tx.pure.u64(Math.floor(Date.now() / 1000) + 3600), // 1 hour expiry
          tx.sharedObjectRef({
            objectId: '0x6',
            initialSharedVersion: 1,
            mutable: false,
          }),
        ],
      })

      tx.setGasBudget(100000000) // 0.1 SUI

      const result = await this.suiSignTransaction({
        transaction: tx,
        chain: 'sui:testnet',
      })

      console.log('[CLIENT] Sui order created:', result.digest)

      return {
        success: true,
        orderId: `sui-${Date.now()}`,
        orderHash,
        txHash: result.digest
      }

    } catch (error) {
      console.error('[CLIENT] Sui → BSC swap failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute BSC → Sui swap (Create escrow on BSC)
   */
  async executeBscToSuiSwap(params: SwapParams): Promise<SwapResult> {
    try {
      if (!this.bscAccount || !this.bscWalletClient) {
        throw new Error('BSC wallet not connected')
      }

      if (!DEMO_CONFIG.contracts.bsc.factory) {
        throw new Error('BSC factory not configured')
      }

      console.log('[CLIENT] Creating BSC → Sui swap escrow')

      // Generate order parameters
      const orderHash = this.generateOrderHash()
      const hashlock = this.generateHashlock()
      const timelocks = this.generateTimelocks()

      // Create contract instance
      const factory = new Contract(
        DEMO_CONFIG.contracts.bsc.factory,
        ESCROW_FACTORY_ABI,
        this.bscWalletClient
      )

      // For native BNB swaps
      const tx = await factory.createSrcEscrow(
        hashlock,
        this.bscAccount.address,
        '0x0000000000000000000000000000000000000000', // Resolver will be set
        '0x0000000000000000000000000000000000000000', // Native token
        params.fromAmount,
        '100000000000000000', // 0.1 BNB safety deposit
        timelocks,
        {
          value: BigInt(params.fromAmount) + BigInt('100000000000000000'),
          gasLimit: 500000
        }
      )

      const receipt = await tx.wait()
      console.log('[CLIENT] BSC escrow created:', receipt.transactionHash)

      return {
        success: true,
        orderId: `bsc-${Date.now()}`,
        escrowId: receipt.contractAddress,
        orderHash,
        txHash: receipt.transactionHash
      }

    } catch (error) {
      console.error('[CLIENT] BSC → Sui swap failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get user's token balance
   */
  async getTokenBalance(token: string, chain: 'BSC' | 'SUI'): Promise<string> {
    try {
      if (chain === 'BSC' && this.bscAccount) {
        // For native BNB, get ETH balance
        if (token === '0x0000000000000000000000000000000000000000') {
          // Use public client to get balance
          // This would need to be implemented with proper wagmi hooks
          return '1000000000000000000' // 1 BNB for demo
        }
        
        // For ERC20 tokens
        const contract = new Contract(token, ERC20_ABI, this.bscWalletClient)
        const balance = await contract.balanceOf(this.bscAccount.address)
        return balance.toString()
      }

      if (chain === 'SUI' && this.suiAccount) {
        // Get SUI balance
        // This would need to be implemented with proper Sui client
        return '1000000000' // 1 SUI for demo
      }

      return '0'
    } catch (error) {
      console.error('[CLIENT] Balance query failed:', error)
      return '0'
    }
  }

  /**
   * Approve token spending (for ERC20 tokens)
   */
  async approveToken(token: string, spender: string, amount: string): Promise<boolean> {
    try {
      if (!this.bscAccount || !this.bscWalletClient) {
        throw new Error('BSC wallet not connected')
      }

      const contract = new Contract(token, ERC20_ABI, this.bscWalletClient)
      const tx = await contract.approve(spender, amount)
      await tx.wait()

      console.log('[CLIENT] Token approved:', tx.hash)
      return true
    } catch (error) {
      console.error('[CLIENT] Token approval failed:', error)
      return false
    }
  }

  // Utility functions
  private generateOrderHash(): string {
    return '0x' + Buffer.from(`order-${Date.now()}-${Math.random()}`).toString('hex').padEnd(64, '0')
  }

  private generateHashlock(): string {
    return '0x' + Buffer.from(`hashlock-${Date.now()}-${Math.random()}`).toString('hex').padEnd(64, '0')
  }

  private generateTimelocks(): bigint {
    const currentTime = Math.floor(Date.now() / 1000)
    
    // Pack timelock data (simplified for demo)
    const timelocksData = (BigInt(currentTime) << BigInt(224)) |
                          BigInt(10) |                            // srcWithdrawal: 10s
                          (BigInt(120) << BigInt(32)) |           // srcPublicWithdrawal: 120s
                          (BigInt(300) << BigInt(64)) |           // srcCancellation: 300s
                          (BigInt(400) << BigInt(96)) |           // srcPublicCancellation: 400s
                          (BigInt(10) << BigInt(128)) |           // dstWithdrawal: 10s
                          (BigInt(100) << BigInt(160)) |          // dstPublicWithdrawal: 100s
                          (BigInt(300) << BigInt(192))            // dstCancellation: 300s
    
    return timelocksData
  }

  private hexToNumberArray(hex: string): number[] {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes: number[] = []
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16))
    }
    return bytes
  }
}

// Hook to create CrossChainClient with current wallet state
export function useCrossChainClient(): CrossChainClient {
  const { address: bscAccount } = useAccount()
  const { account: suiAccount } = useSuiAccount()
  const { data: bscWalletClient } = useWalletClient()
  const { signTransaction: suiSignTransaction } = useSuiWallet()

  // Only create client on client side to avoid SSR issues
  if (typeof window === 'undefined') {
    return new CrossChainClient(undefined, undefined, undefined, undefined)
  }

  return new CrossChainClient(
    bscAccount ? { address: bscAccount } : undefined,
    suiAccount,
    bscWalletClient,
    suiSignTransaction
  )
}