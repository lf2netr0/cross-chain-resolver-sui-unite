"use client"

import { useState } from "react"
import { SuiWalletProvider } from "../../components/sui-wallet-provider"
import { EnhancedSwapInterface } from "../../components/enhanced-swap-interface"
import { CrossChainWalletButton } from "../../components/cross-chain-wallet-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Alert, AlertDescription } from "../../components/ui/alert"
import { useSuiAccount, useSuiNetwork } from "../../components/sui-wallet-provider"
import { useAccount } from "wagmi"
import { 
  ArrowRightLeft, 
  Shield, 
  Clock, 
  Zap, 
  Wallet, 
  ExternalLink, 
  CheckCircle,
  Activity,
  TrendingUp
} from "lucide-react"
import { Button } from "../../components/ui/button"
import { SwapOrder } from "../../lib/demo-resolver"
import { DEMO_CONFIG } from "../../config/demo"

function CrossChainDemo() {
  const { isConnected: isSuiConnected } = useSuiAccount()
  const { network, networkInfo } = useSuiNetwork()
  const { isConnected: isEvmConnected } = useAccount()
  
  // Demo state
  const [completedSwaps, setCompletedSwaps] = useState<SwapOrder[]>([])
  const [totalSwapVolume, setTotalSwapVolume] = useState(0)

  const handleSwapComplete = (order: SwapOrder) => {
    setCompletedSwaps(prev => [order, ...prev])
    setTotalSwapVolume(prev => prev + parseFloat(order.amount))
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          BSC ↔ Sui Cross-Chain Demo
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Experience seamless cross-chain swapping between BSC and Sui networks
        </p>
        
        {/* Dual Wallet Connection Status */}
        <div className="flex justify-center gap-4 items-center mb-6">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <div className={`w-3 h-3 rounded-full ${isEvmConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">BSC Wallet</span>
            <Badge variant={isEvmConnected ? "default" : "secondary"}>
              {isEvmConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <div className={`w-3 h-3 rounded-full ${isSuiConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">Sui Wallet</span>
            <Badge variant={isSuiConnected ? "default" : "secondary"}>
              {isSuiConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
        
        {/* Unified Wallet Connection */}
        <div className="flex justify-center items-center">
          <CrossChainWalletButton showNetworkSwitcher={true} />
        </div>
      </div>

      {/* Features Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Cross-Chain</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Swap between BSC and Sui seamlessly
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Secure HTLC</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Hash Time-Locked Contracts ensure atomic swaps
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <h3 className="font-semibold">Competitive</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Resolvers compete for best execution
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold">Fast Settlement</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Quick finality with timelock protection
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Alert */}
      {(!isEvmConnected || !isSuiConnected) && (
        <Alert>
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                {!isEvmConnected && !isSuiConnected 
                  ? "Connect both BSC and Sui wallets to start cross-chain swapping"
                  : !isEvmConnected 
                    ? "Connect your BSC wallet to complete the setup"
                    : "Connect your Sui wallet to complete the setup"
                }
              </span>
              <div className="flex gap-2">
                <CrossChainWalletButton showNetworkSwitcher={false} />
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Swap Interface */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Cross-Chain Swap Interface
              </CardTitle>
              <CardDescription>
                Swap tokens between BSC and Sui networks using our advanced OrderPool system
              </CardDescription>
            </CardHeader>
          </Card>
          
          <EnhancedSwapInterface onSwapComplete={handleSwapComplete} />
          
          {(isEvmConnected && isSuiConnected) && (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="font-semibold mb-2">🎉 Ready for Cross-Chain Swapping!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Both wallets are connected. You can now perform cross-chain swaps between BSC and Sui.
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" asChild>
                      <a href="/cross-chain" className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Advanced Interface
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Demo Statistics */}
      {completedSwaps.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Completed Swaps</h3>
              </div>
              <p className="text-2xl font-bold">{completedSwaps.length}</p>
              <p className="text-sm text-muted-foreground">
                Successful cross-chain transactions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Total Volume</h3>
              </div>
              <p className="text-2xl font-bold">{totalSwapVolume.toFixed(4)}</p>
              <p className="text-sm text-muted-foreground">
                Tokens swapped in demo
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold">Success Rate</h3>
              </div>
              <p className="text-2xl font-bold">
                {completedSwaps.length > 0 ? '100%' : '0%'}
              </p>
              <p className="text-sm text-muted-foreground">
                Demo resolver reliability
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Swaps */}
      {completedSwaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Cross-Chain Swaps</CardTitle>
            <CardDescription>
              Your completed transactions in this demo session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedSwaps.slice(0, 5).map((swap) => (
                <div key={swap.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div>
                      <div className="font-medium">
                        {swap.srcChain} → {swap.dstChain}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {swap.amount} tokens • {swap.completedAt?.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Completed</Badge>
                    {swap.srcEscrowId && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={`${DEMO_CONFIG.networks.sui.blockExplorer}/txblock/${swap.srcEscrowId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Cross-Chain Swapping Works</CardTitle>
          <CardDescription>
            Understanding the BSC ↔ Sui swap mechanism
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                Sui → BSC Swap
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• User creates order in Sui OrderPool</li>
                <li>• Funds locked with safety deposit</li>
                <li>• Resolvers compete for order</li>
                <li>• Winner creates BSC escrow</li>
                <li>• Atomic swap completes</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                BSC → Sui Swap
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• User creates escrow on BSC</li>
                <li>• Resolver monitors and responds</li>
                <li>• Destination escrow created on Sui</li>
                <li>• Secret reveal enables withdrawal</li>
                <li>• Cross-chain transfer completes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>
            Current implementation status of cross-chain features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Dual Wallet Support</div>
                <div className="text-sm text-muted-foreground">BSC + Sui wallets ready</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Swap Interface</div>
                <div className="text-sm text-muted-foreground">User-friendly swap UI</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">OrderPool System</div>
                <div className="text-sm text-muted-foreground">Competitive resolver bidding</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">HTLC Security</div>
                <div className="text-sm text-muted-foreground">Atomic swap guarantees</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Fusion+ Compatible</div>
                <div className="text-sm text-muted-foreground">1inch protocol alignment</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className={`w-3 h-3 rounded-full ${
                DEMO_CONFIG.features.resolverSimulation ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <div>
                <div className="font-medium">
                  {DEMO_CONFIG.features.resolverSimulation ? 'Demo Trading' : 'Live Trading'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {DEMO_CONFIG.features.resolverSimulation 
                    ? 'Simulated resolver active' 
                    : 'Contract deployment needed'
                  }
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Real Wallets</div>
                <div className="text-sm text-muted-foreground">Browser wallet integration</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Progress Tracking</div>
                <div className="text-sm text-muted-foreground">Real-time swap status</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">Demo Resolver</div>
                <div className="text-sm text-muted-foreground">Automated swap processing</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DemoPage() {
  return (
    <SuiWalletProvider>
      <CrossChainDemo />
    </SuiWalletProvider>
  )
}