"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import { Badge } from "./ui/badge"
import { Alert, AlertDescription } from "./ui/alert"
import { useSuiWallet, useSuiAccount, useSuiNetwork } from "./sui-wallet-provider"
import { Transaction } from "@mysten/sui/transactions"
import { toast } from "./ui/use-toast"
import { Loader2, ArrowRight, Clock, DollarSign } from "lucide-react"

interface OrderPoolConfig {
  packageId: string
  poolId: string
}

interface CreateOrderParams {
  tokenAmount: string
  safetyDeposit: string
  targetChain: string
  targetToken: string
  targetAmount: string
}

interface PendingOrder {
  id: string
  maker: string
  tokenAmount: string
  safetyDeposit: string
  targetChain: string
  status: "active" | "taken" | "cancelled"
  createdAt: Date
}

export function SuiOrderPool() {
  const { signAndExecuteTransaction } = useSuiWallet()
  const { isConnected, address } = useSuiAccount()
  const { network, client } = useSuiNetwork()
  
  // State
  const [config, setConfig] = useState<OrderPoolConfig>({
    packageId: "", // Will be loaded from config
    poolId: "", // Will be loaded from config
  })
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [isTakingOrder, setIsTakingOrder] = useState(false)
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>("")
  
  // Form state
  const [formData, setFormData] = useState<CreateOrderParams>({
    tokenAmount: "1.0",
    safetyDeposit: "0.01",
    targetChain: "BSC",
    targetToken: "USDC",
    targetAmount: "100",
  })

  // Load config based on network
  useEffect(() => {
    const networkConfig = {
      devnet: {
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID_DEVNET || "",
        poolId: process.env.NEXT_PUBLIC_SUI_POOL_ID_DEVNET || "",
      },
      testnet: {
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID_TESTNET || "",
        poolId: process.env.NEXT_PUBLIC_SUI_POOL_ID_TESTNET || "",
      },
      mainnet: {
        packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID_MAINNET || "",
        poolId: process.env.NEXT_PUBLIC_SUI_POOL_ID_MAINNET || "",
      },
    }
    
    const selectedConfig = networkConfig[network] || networkConfig.devnet
    setConfig(selectedConfig)
    
    // Log configuration status for debugging
    if (!selectedConfig.packageId || !selectedConfig.poolId) {
      console.warn(`OrderPool configuration missing for network: ${network}`)
      console.warn("Please set environment variables:")
      console.warn(`NEXT_PUBLIC_SUI_PACKAGE_ID_${network.toUpperCase()}`)
      console.warn(`NEXT_PUBLIC_SUI_POOL_ID_${network.toUpperCase()}`)
    }
  }, [network])

  // Create order in pool
  const createOrder = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Not Connected",
        description: "Please connect your Sui wallet first",
        variant: "destructive",
      })
      return
    }

    if (!config.packageId || !config.poolId) {
      toast({
        title: "Configuration Missing",
        description: "OrderPool configuration not loaded",
        variant: "destructive",
      })
      return
    }

    setIsCreatingOrder(true)
    
    try {
      const tx = new Transaction()
      
      // Convert amounts to proper units (SUI uses 9 decimals)
      const tokenAmountMist = Math.floor(parseFloat(formData.tokenAmount) * 1_000_000_000)
      const safetyDepositMist = Math.floor(parseFloat(formData.safetyDeposit) * 1_000_000_000)
      
      // Split coins for the order
      const [tokenCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(tokenAmountMist)])
      const [safetyDepositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(safetyDepositMist)])
      
      // Generate order hash (simplified for demo)
      const orderHash = new Uint8Array(32).fill(1) // In real app, compute proper hash
      const hashlock = new Uint8Array(32).fill(2) // In real app, use proper hashlock
      const timelocks = 0n // In real app, compute proper timelocks
      
      // Call create_order function
      tx.moveCall({
        target: `${config.packageId}::order_pool::create_order`,
        arguments: [
          tx.object(config.poolId),
          tokenCoin,
          safetyDepositCoin,
          tx.pure.vector("u8", Array.from(orderHash)),
          tx.pure.vector("u8", Array.from(hashlock)),
          tx.pure.u256(timelocks),
        ],
        typeArguments: ["0x2::sui::SUI"], // Using SUI as token type
      })
      
      const result = await signAndExecuteTransaction(tx)
      
      toast({
        title: "Order Created",
        description: `Order created successfully: ${result?.digest}`,
      })
      
      // Add to local orders list (in real app, query from chain)
      const newOrder: PendingOrder = {
        id: result?.digest || `order_${Date.now()}`,
        maker: address,
        tokenAmount: formData.tokenAmount,
        safetyDeposit: formData.safetyDeposit,
        targetChain: formData.targetChain,
        status: "active",
        createdAt: new Date(),
      }
      setOrders(prev => [newOrder, ...prev])
      
    } catch (error) {
      console.error("Failed to create order:", error)
      toast({
        title: "Order Creation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  // Take order (for resolvers)
  const takeOrder = async (orderId: string) => {
    if (!isConnected || !address) {
      toast({
        title: "Not Connected",
        description: "Please connect your Sui wallet first",
        variant: "destructive",
      })
      return
    }

    setIsTakingOrder(true)
    
    try {
      const tx = new Transaction()
      
      // Resolver safety deposit (0.01 SUI for demo)
      const resolverSafetyDeposit = Math.floor(0.01 * 1_000_000_000)
      const [safetyDepositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(resolverSafetyDeposit)])
      
      // Call take_order_and_create_escrow
      tx.moveCall({
        target: `${config.packageId}::order_pool::take_order_and_create_escrow`,
        arguments: [
          tx.object(config.poolId),
          tx.pure.id(orderId),
          safetyDepositCoin,
          tx.object("0x6"), // Clock object
        ],
        typeArguments: ["0x2::sui::SUI"],
      })
      
      const result = await signAndExecuteTransaction(tx)
      
      toast({
        title: "Order Taken",
        description: `Order taken and escrow created: ${result?.digest}`,
      })
      
      // Update order status
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: "taken" as const }
          : order
      ))
      
    } catch (error) {
      console.error("Failed to take order:", error)
      toast({
        title: "Order Taking Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsTakingOrder(false)
    }
  }

  const handleInputChange = (field: keyof CreateOrderParams, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Alert>
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>OrderPool: {config.poolId ? "✅ Configured" : "❌ Not configured"}</span>
            <Badge variant={config.poolId ? "default" : "destructive"}>
              {network.toUpperCase()}
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create Order */}
        <Card>
          <CardHeader>
            <CardTitle>Create Cross-Chain Order</CardTitle>
            <CardDescription>
              Create a new order for cross-chain swapping through the OrderPool
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tokenAmount">SUI Amount</Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.tokenAmount}
                  onChange={(e) => handleInputChange("tokenAmount", e.target.value)}
                  placeholder="1.0"
                />
              </div>
              <div>
                <Label htmlFor="safetyDeposit">Safety Deposit</Label>
                <Input
                  id="safetyDeposit"
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.safetyDeposit}
                  onChange={(e) => handleInputChange("safetyDeposit", e.target.value)}
                  placeholder="0.01"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="targetChain">Target Chain</Label>
                <Input
                  id="targetChain"
                  value={formData.targetChain}
                  onChange={(e) => handleInputChange("targetChain", e.target.value)}
                  placeholder="BSC"
                />
              </div>
              <div>
                <Label htmlFor="targetToken">Target Token</Label>
                <Input
                  id="targetToken"
                  value={formData.targetToken}
                  onChange={(e) => handleInputChange("targetToken", e.target.value)}
                  placeholder="USDC"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="targetAmount">Target Amount</Label>
              <Input
                id="targetAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.targetAmount}
                onChange={(e) => handleInputChange("targetAmount", e.target.value)}
                placeholder="100"
              />
            </div>

            <Button 
              onClick={createOrder}
              disabled={!isConnected || isCreatingOrder || !config.poolId}
              className="w-full"
            >
              {isCreatingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingOrder ? "Creating Order..." : "Create Order"}
            </Button>
            
            {!isConnected && (
              <p className="text-sm text-muted-foreground text-center">
                Connect your Sui wallet to create orders
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Active Orders</CardTitle>
            <CardDescription>
              Orders waiting for resolvers in the OrderPool
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No active orders</p>
                <p className="text-sm">Create an order to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">
                          {order.tokenAmount} SUI
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {formData.targetAmount} {order.targetChain}
                        </span>
                      </div>
                      <Badge 
                        variant={
                          order.status === "active" ? "default" :
                          order.status === "taken" ? "secondary" : "destructive"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Maker: {order.maker.slice(0, 8)}...{order.maker.slice(-6)}</span>
                      <span>{order.createdAt.toLocaleTimeString()}</span>
                    </div>
                    
                    {order.status === "active" && order.maker !== address && (
                      <Button
                        size="sm"
                        onClick={() => takeOrder(order.id)}
                        disabled={isTakingOrder}
                        className="w-full"
                      >
                        {isTakingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Take Order (Resolver)
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>OrderPool Statistics</CardTitle>
          <CardDescription>Real-time statistics from the Sui OrderPool</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-sm text-muted-foreground">Total Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === "active").length}
              </div>
              <div className="text-sm text-muted-foreground">Active Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === "taken").length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {orders.reduce((sum, o) => sum + parseFloat(o.tokenAmount), 0).toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Total Volume (SUI)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}