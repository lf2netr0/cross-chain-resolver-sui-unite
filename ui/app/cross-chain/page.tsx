"use client"

import { SuiWalletProvider } from "../../components/sui-wallet-provider"
import { SuiOrderPool } from "../../components/sui-order-pool"
import SwapInterface from "../../components/swap-interface"
import { CrossChainWalletButton } from "../../components/cross-chain-wallet-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Alert, AlertDescription } from "../../components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { useSuiAccount, useSuiNetwork } from "../../components/sui-wallet-provider"
import { useAccount } from "wagmi"
import { ArrowRightLeft, Shield, Clock, Zap, Wallet, Link } from "lucide-react"

function CrossChainSwapInterface() {
  const { isConnected: isSuiConnected } = useSuiAccount()
  const { network, networkInfo } = useSuiNetwork()
  const { isConnected: isEvmConnected } = useAccount()

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          BSC ↔ Sui Cross-Chain Swap
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Decentralized cross-chain atomic swaps with Fusion+ compatible OrderPool system
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
          
          <Link className="h-6 w-6 text-muted-foreground" />
          
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
              Swap between Sui and EVM chains seamlessly
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

      {/* Main Interface */}
      <Tabs defaultValue="swap" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="swap">Cross-Chain Swap</TabsTrigger>
          <TabsTrigger value="orderbook">OrderPool (Advanced)</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="swap" className="mt-6">
          <div className="flex justify-center">
            <SwapInterface />
          </div>
        </TabsContent>
        
        <TabsContent value="orderbook" className="mt-6">
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced OrderPool Interface</CardTitle>
                <CardDescription>
                  Direct interaction with Sui OrderPool contracts for competitive resolver bidding
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          <SuiOrderPool />
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Chain Swap History</CardTitle>
              <CardDescription>
                Track your BSC ↔ Sui swap transactions and OrderPool activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Transaction History</h3>
                <p>Your cross-chain swap history will appear here once you complete transactions</p>
                <div className="mt-4 text-sm">
                  <p>• BSC → Sui swaps</p>
                  <p>• Sui → BSC orders</p>
                  <p>• OrderPool activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>
            Understanding the Sui cross-chain swap mechanism
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-3">1. Order Creation</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• User creates order with source tokens</li>
                <li>• Funds locked in OrderPool contract</li>
                <li>• Order broadcast for resolver competition</li>
                <li>• Safety deposit ensures commitment</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">2. Resolver Competition</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Resolvers monitor OrderPool for profitable orders</li>
                <li>• Winner takes order and creates source escrow</li>
                <li>• Funds transfer from pool to escrow</li>
                <li>• Resolver commits to cross-chain execution</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">3. Cross-Chain Execution</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Resolver creates destination escrow on target chain</li>
                <li>• User withdraws with secret reveal</li>
                <li>• Secret propagates across chains</li>
                <li>• Resolver withdraws using revealed secret</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3">4. Safety & Fallbacks</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Multi-stage timelock protection</li>
                <li>• Automatic cancellation if conditions not met</li>
                <li>• User can recover funds if swap fails</li>
                <li>• Resolver protected after user withdrawal</li>
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
                <div className="font-medium">Sui Wallet Standard</div>
                <div className="text-sm text-muted-foreground">Multi-wallet support ready</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">OrderPool Contract</div>
                <div className="text-sm text-muted-foreground">Order creation & management</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <div className="font-medium">HTLC Escrows</div>
                <div className="text-sm text-muted-foreground">Atomic swap contracts</div>
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
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div>
                <div className="font-medium">Cross-Chain Bridge</div>
                <div className="text-sm text-muted-foreground">Event monitoring in progress</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div>
                <div className="font-medium">Resolver Network</div>
                <div className="text-sm text-muted-foreground">Integration with existing resolvers</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CrossChainPage() {
  return (
    <SuiWalletProvider>
      <CrossChainSwapInterface />
    </SuiWalletProvider>
  )
}