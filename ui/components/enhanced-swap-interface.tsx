"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowDownUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  AlertTriangle 
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useAccount } from "wagmi"
import { useSuiAccount } from "./sui-wallet-provider"
import { useCrossChainClient, SwapParams, SwapProgress } from "../lib/cross-chain-client"
import { getDemoResolver, SwapOrder } from "../lib/demo-resolver"
import { DEMO_CONFIG } from "../config/demo"
import { CrossChainTokenSelector } from "./cross-chain-token-selector"
import { useCrossChainTokens, type CrossChainToken } from "./cross-chain-token-provider"

interface EnhancedSwapInterfaceProps {
  onSwapComplete?: (order: SwapOrder) => void
}

export function EnhancedSwapInterface({ onSwapComplete }: EnhancedSwapInterfaceProps) {
  const { tokens } = useCrossChainTokens()
  const { isConnected: isEvmConnected } = useAccount()
  const { isConnected: isSuiConnected } = useSuiAccount()
  const crossChainClient = useCrossChainClient()

  // Token state - safe initialization with fallback
  const [fromToken, setFromToken] = useState<CrossChainToken | null>(() => {
    const suiToken = tokens.find((t) => t.chain === "SUI")
    if (suiToken) return suiToken
    return tokens[0] || null
  })
  const [toToken, setToToken] = useState<CrossChainToken | null>(() => {
    const bscToken = tokens.find((t) => t.chain === "BSC")
    if (bscToken) return bscToken
    return tokens[1] || null
  })
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")

  // Swap state
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapProgress, setSwapProgress] = useState<SwapProgress | null>(null)
  const [currentOrder, setCurrentOrder] = useState<SwapOrder | null>(null)
  const [exchangeRate, setExchangeRate] = useState(1)

  // Demo resolver - only initialize on client side
  const [resolver, setResolver] = useState<ReturnType<typeof getDemoResolver>>(null)
  
  useEffect(() => {
    // Initialize resolver on client side only
    if (typeof window !== 'undefined') {
      const resolverInstance = getDemoResolver()
      setResolver(resolverInstance)
    }
  }, [])

  // Simulate exchange rate
  useEffect(() => {
    if (fromToken?.price && toToken?.price) {
      const rate = (fromToken.price / toToken.price) * (0.95 + Math.random() * 0.1)
      setExchangeRate(rate)
      
      if (fromAmount && !isNaN(Number.parseFloat(fromAmount))) {
        setToAmount((Number.parseFloat(fromAmount) * rate).toFixed(6))
      }
    }
  }, [fromToken, toToken, fromAmount])

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value)
    if (value && !isNaN(Number.parseFloat(value))) {
      setToAmount((Number.parseFloat(value) * exchangeRate).toFixed(6))
    } else {
      setToAmount("")
    }
  }

  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const handleSwap = async () => {
    if (!resolver) {
      toast({
        title: "Resolver Not Available",
        description: "Demo resolver is not configured properly",
        variant: "destructive",
      })
      return
    }

    const resolverStatus = resolver.getStatus()
    if (!resolverStatus.available) {
      toast({
        title: "Resolver Not Available",
        description: "Demo resolver failed to initialize",
        variant: "destructive",
      })
      return
    }

    const isWalletConnectedForToken = (token: CrossChainToken) => {
      if (token.chain === "BSC") return isEvmConnected
      if (token.chain === "SUI") return isSuiConnected
      return false
    }

    if (!isWalletConnectedForToken(fromToken) || !isWalletConnectedForToken(toToken)) {
      toast({
        title: "Wallet Connection Required",
        description: "Please connect both wallets to perform cross-chain swap",
        variant: "destructive",
      })
      return
    }

    if (!fromToken || !toToken) {
      toast({
        title: "Token Selection Required",
        description: "Please select both tokens to perform swap",
        variant: "destructive",
      })
      return
    }

    const isSuiToBsc = fromToken.chain === "SUI" && toToken.chain === "BSC"
    const isBscToSui = fromToken.chain === "BSC" && toToken.chain === "SUI"

    if (!isSuiToBsc && !isBscToSui) {
      toast({
        title: "Invalid Swap Pair",
        description: "Only BSC ↔ Sui swaps are currently supported",
        variant: "destructive",
      })
      return
    }

    setIsSwapping(true)

    const swapParams: SwapParams = {
      fromToken: fromToken.contractAddress || fromToken.id,
      toToken: toToken.contractAddress || toToken.id,
      fromAmount: (Number.parseFloat(fromAmount) * 10**(fromToken.decimals || 18)).toString(),
      toAmount: (Number.parseFloat(toAmount) * 10**(toToken.decimals || 18)).toString(),
      fromChain: fromToken.chain as 'BSC' | 'SUI',
      toChain: toToken.chain as 'BSC' | 'SUI'
    }

    try {
      if (isSuiToBsc) {
        await executeSuiToBscSwap(swapParams)
      } else {
        await executeBscToSuiSwap(swapParams)
      }
    } catch (error) {
      console.error("Swap failed:", error)
      setSwapProgress({
        stage: 'failed',
        message: `Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSwapping(false)
    }
  }

  const executeSuiToBscSwap = async (params: SwapParams) => {
    setSwapProgress({ stage: 'preparing', message: 'Preparing Sui → BSC swap...' })

    // Step 1: Create order on Sui
    setSwapProgress({ stage: 'creating_order', message: 'Creating order in Sui OrderPool...' })
    
    const result = await crossChainClient.executeSuiToBscSwap(params)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create Sui order')
    }

    toast({
      title: "Order Created",
      description: `Order created on Sui: ${result.orderHash?.slice(0, 10)}...`,
    })

    // Step 2: Simulate resolver taking the order
    setSwapProgress({ stage: 'waiting_resolver', message: 'Waiting for resolver to process order...' })
    
    setTimeout(async () => {
      try {
        if (result.orderHash && resolver) {
          const order = await resolver.processOrderFromSui(result.orderHash)
          setCurrentOrder(order)
          
          setSwapProgress({ 
            stage: 'completing', 
            message: 'Resolver processing cross-chain transfer...',
            orderId: order.id
          })

          // Monitor order completion
          monitorOrderCompletion(order.id)
        }
      } catch (error) {
        console.error('Resolver processing failed:', error)
        setSwapProgress({
          stage: 'failed',
          message: 'Resolver failed to process order'
        })
      }
    }, 2000) // 2 second delay to simulate network
  }

  const executeBscToSuiSwap = async (params: SwapParams) => {
    setSwapProgress({ stage: 'preparing', message: 'Preparing BSC → Sui swap...' })

    // Step 1: Create escrow on BSC
    setSwapProgress({ stage: 'creating_order', message: 'Creating escrow on BSC...' })
    
    const result = await crossChainClient.executeBscToSuiSwap(params)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create BSC escrow')
    }

    toast({
      title: "Escrow Created",
      description: `Escrow created on BSC: ${result.escrowId?.slice(0, 10)}...`,
    })

    // Step 2: Simulate resolver processing
    setSwapProgress({ stage: 'waiting_resolver', message: 'Waiting for resolver to create destination escrow...' })
    
    setTimeout(async () => {
      try {
        if (result.escrowId && result.orderHash && resolver) {
          const order = await resolver.processEscrowFromBsc(result.escrowId, {
            orderHash: result.orderHash,
            hashlock: '0x' + '0'.repeat(64), // Mock hashlock
            maker: params.fromToken,
            token: params.fromToken,
            amount: params.fromAmount,
            safetyDeposit: '100000000000000000', // 0.1 ETH
            timelocks: BigInt(Math.floor(Date.now() / 1000))
          })
          setCurrentOrder(order)
          
          setSwapProgress({ 
            stage: 'completing', 
            message: 'Resolver creating destination escrow on Sui...',
            orderId: order.id
          })

          // Monitor order completion
          monitorOrderCompletion(order.id)
        }
      } catch (error) {
        console.error('Resolver processing failed:', error)
        setSwapProgress({
          stage: 'failed',
          message: 'Resolver failed to process escrow'
        })
      }
    }, 2000)
  }

  const monitorOrderCompletion = (orderId: string) => {
    const checkInterval = setInterval(() => {
      if (!resolver) return

      const order = resolver.getOrder(orderId)
      if (order) {
        setCurrentOrder(order)
        
        if (order.status === 'completed') {
          setSwapProgress({
            stage: 'completed',
            message: 'Cross-chain swap completed successfully!',
            orderId: order.id
          })
          
          toast({
            title: "Swap Completed",
            description: `Cross-chain swap from ${fromToken?.symbol} to ${toToken?.symbol} completed!`,
          })

          if (onSwapComplete) {
            onSwapComplete(order)
          }

          clearInterval(checkInterval)
        } else if (order.status === 'failed') {
          setSwapProgress({
            stage: 'failed',
            message: 'Cross-chain swap failed',
            orderId: order.id
          })
          clearInterval(checkInterval)
        }
      }
    }, 1000)

    // Cleanup after 5 minutes
    setTimeout(() => clearInterval(checkInterval), 300000)
  }

  const getProgressValue = () => {
    switch (swapProgress?.stage) {
      case 'preparing': return 10
      case 'creating_order': return 25
      case 'waiting_resolver': return 50
      case 'completing': return 75
      case 'completed': return 100
      case 'failed': return 0
      default: return 0
    }
  }

  const getProgressColor = () => {
    if (swapProgress?.stage === 'failed') return 'bg-red-500'
    if (swapProgress?.stage === 'completed') return 'bg-green-500'
    return 'bg-blue-500'
  }

  const isWalletConnectedForToken = (token: CrossChainToken | null) => {
    if (!token) return false
    if (token.chain === "BSC") return isEvmConnected
    if (token.chain === "SUI") return isSuiConnected
    return false
  }

  // Get resolver status for UI
  const resolverStatus = resolver?.getStatus() || { available: false, mode: 'unavailable' }
  
  const canSwap = fromToken && toToken &&
                  isWalletConnectedForToken(fromToken) && 
                  isWalletConnectedForToken(toToken) && 
                  !isSwapping &&
                  resolverStatus.available

  return (
    <Card className="w-full max-w-md mx-auto bg-slate-900 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Cross-Chain Swap</span>
          <Badge variant={
            resolverStatus.mode === 'live' ? "default" : 
            resolverStatus.mode === 'mock' ? "secondary" : 
            "destructive"
          }>
            {resolverStatus.mode === 'live' ? "Live" :
             resolverStatus.mode === 'mock' ? "Mock Mode" :
             "Offline"}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">From</span>
            <Badge variant="outline" className="text-xs">
              {fromToken?.chain || ""}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white text-right text-lg"
                disabled={isSwapping}
              />
            </div>
            <CrossChainTokenSelector
              value={fromToken}
              onChange={setFromToken}
              disabled={isSwapping}
            />
          </div>
          
          <div className="text-xs text-slate-400">
            Balance: {fromToken?.balance || 0} {fromToken?.symbol || ""}
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={switchTokens}
            disabled={isSwapping}
            className="rounded-full bg-slate-800 hover:bg-slate-700"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">To</span>
            <Badge variant="outline" className="text-xs">
              {toToken?.chain || ""}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="bg-slate-800 border-slate-600 text-white text-right text-lg"
              />
            </div>
            <CrossChainTokenSelector
              value={toToken}
              onChange={setToToken}
              disabled={isSwapping}
            />
          </div>
        </div>

        {/* Exchange Rate */}
        {fromAmount && toAmount && (
          <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg text-sm">
            <span className="text-slate-400">Rate</span>
            <span className="text-white">
              1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}
            </span>
          </div>
        )}

        {/* Swap Progress */}
        {swapProgress && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {swapProgress.stage === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
              {swapProgress.stage === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {!['failed', 'completed'].includes(swapProgress.stage) && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-sm">{swapProgress.message}</span>
            </div>
            
            <Progress 
              value={getProgressValue()} 
              className="w-full"
              color={getProgressColor()}
            />

            {swapProgress.orderId && (
              <div className="text-xs text-slate-400">
                Order ID: {swapProgress.orderId}
              </div>
            )}
          </div>
        )}

        {/* Current Order Info */}
        {currentOrder && (
          <Alert className="bg-slate-800 border-slate-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant={currentOrder.status === 'completed' ? 'default' : 'secondary'}>
                    {currentOrder.status}
                  </Badge>
                </div>
                {currentOrder.srcEscrowId && (
                  <div className="text-xs">
                    Src Escrow: {currentOrder.srcEscrowId.slice(0, 10)}...
                  </div>
                )}
                {currentOrder.dstEscrowId && (
                  <div className="text-xs">
                    Dst Escrow: {currentOrder.dstEscrowId.slice(0, 10)}...
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}


        {/* Swap Button */}
        <Button
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
          disabled={!fromAmount || Number.parseFloat(fromAmount) <= 0 || !canSwap}
          onClick={handleSwap}
        >
          {isSwapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!resolverStatus.available
            ? `Resolver ${resolverStatus.mode === 'unavailable' ? 'Not Available' : 'Offline'}`
            : !fromToken || !toToken
              ? "Select tokens"
              : !isWalletConnectedForToken(fromToken) || !isWalletConnectedForToken(toToken)
                ? `Connect ${!isWalletConnectedForToken(fromToken!) ? fromToken?.chain : toToken?.chain} Wallet`
                : !fromAmount || Number.parseFloat(fromAmount) <= 0
                  ? "Enter an amount"
                  : Number.parseFloat(fromAmount) > (fromToken?.balance || 0)
                    ? "Insufficient balance"
                    : isSwapping
                      ? "Processing..."
                      : `Swap ${fromToken?.symbol || ""} → ${toToken?.symbol || ""}`}
        </Button>

        {/* Demo Notice */}
        {resolverStatus.mode !== 'unavailable' && (
          <div className="text-xs text-center text-slate-400 mt-4">
            {resolverStatus.mode === 'mock' ? (
              <>🧪 Mock mode: Using simulated transactions for testing</>
            ) : resolverStatus.mode === 'live' ? (
              <>⚡ Live mode: Real blockchain transactions enabled</>
            ) : (
              <>❌ Resolver offline: Please check configuration</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}