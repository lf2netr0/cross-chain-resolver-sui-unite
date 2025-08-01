"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Settings, ArrowDownUp, Info, RefreshCw, Clock, ChevronDown, LineChart } from "lucide-react"
import { SettingsDialog } from "./settings-dialog"
import { toast } from "./ui/use-toast"
import { RecentTransactions } from "./recent-transactions"
import Link from "next/link"
import { CrossChainTokenSelector } from "./cross-chain-token-selector"
import { useCrossChainTokens, type CrossChainToken } from "./cross-chain-token-provider"
import { useAccount } from "wagmi"
import { useSuiWallet } from "./sui-wallet-provider"

interface SwapInterfaceProps {
  initialFromToken?: CrossChainToken
  initialToToken?: CrossChainToken
}

export default function SwapInterface({ initialFromToken, initialToToken }: SwapInterfaceProps) {
  const { tokens } = useCrossChainTokens()
  const { isConnected: isEvmConnected } = useAccount()
  const { isSuiConnected } = useSuiWallet()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [fromToken, setFromToken] = useState<CrossChainToken>(
    initialFromToken || tokens.find((t) => t.chain === "BSC") || tokens[0],
  )
  const [toToken, setToToken] = useState<CrossChainToken>(
    initialToToken || tokens.find((t) => t.chain === "SUI") || tokens[1],
  )
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [exchangeRate, setExchangeRate] = useState(0)
  const [isRecentTransactionsOpen, setIsRecentTransactionsOpen] = useState(false)

  // Update tokens if initialTokens change
  useEffect(() => {
    if (initialFromToken) setFromToken(initialFromToken)
    if (initialToToken) setToToken(initialToToken)
  }, [initialFromToken, initialToToken])

  // Simulate exchange rate calculation
  useEffect(() => {
    if (fromToken && toToken) {
      // This would be replaced with actual price fetching in a real app
      const rate = (fromToken.price / toToken.price) * (0.9 + Math.random() * 0.2)
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

  const handleToAmountChange = (value: string) => {
    setToAmount(value)
    if (value && !isNaN(Number.parseFloat(value))) {
      setFromAmount((Number.parseFloat(value) / exchangeRate).toFixed(6))
    } else {
      setFromAmount("")
    }
  }

  const switchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const handleSwap = () => {
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

    // This would be replaced with actual swap logic in a real app
    toast({
      title: "Swap initiated",
      description: `Swapping ${fromAmount} ${fromToken.symbol} for approximately ${toAmount} ${toToken.symbol}`,
    })
  }

  const isWalletConnectedForToken = (token: CrossChainToken) => {
    if (token.chain === "BSC") return isEvmConnected
    if (token.chain === "SUI") return isSuiConnected
    return false
  }

  const canSwap = isWalletConnectedForToken(fromToken) && isWalletConnectedForToken(toToken)

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-slate-800 border-slate-700 shadow-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Tabs defaultValue="swap" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-700">
                <TabsTrigger value="swap" className="data-[state=active]:bg-slate-600">
                  Swap
                </TabsTrigger>
                <TabsTrigger value="limit" className="data-[state=active]:bg-slate-600">
                  Limit
                </TabsTrigger>
              </TabsList>
              <TabsContent value="swap" className="mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white">Swap</h2>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/pair/${fromToken.id}/${toToken.id}`}
                        className="text-slate-400 hover:text-white"
                        title="View price chart"
                      >
                        <LineChart className="h-5 w-5" />
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="h-5 w-5 text-slate-400" />
                      </Button>
                    </div>
                  </div>

                  {/* From Token */}
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">From</span>
                      <span className="text-sm text-slate-400">Balance: {fromToken?.balance.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => handleFromAmountChange(e.target.value)}
                        className="bg-transparent border-none text-xl font-medium text-white focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                      />
                      <CrossChainTokenSelector
                        selectedToken={fromToken}
                        onSelectToken={setFromToken}
                        otherToken={toToken}
                        label="From"
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                          onClick={() => handleFromAmountChange((fromToken.balance * 0.25).toFixed(6))}
                        >
                          25%
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                          onClick={() => handleFromAmountChange((fromToken.balance * 0.5).toFixed(6))}
                        >
                          50%
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                          onClick={() => handleFromAmountChange((fromToken.balance * 0.75).toFixed(6))}
                        >
                          75%
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                          onClick={() => handleFromAmountChange(fromToken.balance.toFixed(6))}
                        >
                          Max
                        </Button>
                      </div>
                      <span className="text-xs text-slate-400">
                        ~${fromAmount ? (Number.parseFloat(fromAmount) * fromToken?.price).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Switch Button */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-10 w-10 bg-slate-800 border-slate-600 hover:bg-slate-700 hover:border-slate-500"
                      onClick={switchTokens}
                    >
                      <ArrowDownUp className="h-4 w-4 text-slate-400" />
                    </Button>
                  </div>

                  {/* To Token */}
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-slate-400">To</span>
                      <span className="text-sm text-slate-400">Balance: {toToken?.balance.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={toAmount}
                        onChange={(e) => handleToAmountChange(e.target.value)}
                        className="bg-transparent border-none text-xl font-medium text-white focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                      />
                      <CrossChainTokenSelector
                        selectedToken={toToken}
                        onSelectToken={setToToken}
                        otherToken={fromToken}
                        label="To"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <span className="text-xs text-slate-400">
                        ~${toAmount ? (Number.parseFloat(toAmount) * toToken?.price).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Exchange Rate */}
                  {fromAmount && toAmount && (
                    <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg text-sm">
                      <span className="text-slate-400">Rate</span>
                      <div className="flex items-center gap-1">
                        <span className="text-white">
                          1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                          <RefreshCw className="h-3 w-3 text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Swap Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
                    disabled={!fromAmount || Number.parseFloat(fromAmount) <= 0 || !canSwap}
                    onClick={handleSwap}
                  >
                    {!canSwap
                      ? `Connect ${!isWalletConnectedForToken(fromToken) ? fromToken.chain : toToken.chain} Wallet`
                      : !fromAmount || Number.parseFloat(fromAmount) <= 0
                        ? "Enter an amount"
                        : Number.parseFloat(fromAmount) > fromToken?.balance
                          ? "Insufficient balance"
                          : `Bridge ${fromToken.symbol} to ${toToken.symbol}`}
                  </Button>

                  {/* Recent Transactions */}
                  <Button
                    variant="ghost"
                    className="w-full flex justify-between items-center text-slate-400 hover:text-white"
                    onClick={() => setIsRecentTransactionsOpen(!isRecentTransactionsOpen)}
                  >
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Recent Transactions</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isRecentTransactionsOpen ? "rotate-180" : ""}`}
                    />
                  </Button>

                  {isRecentTransactionsOpen && <RecentTransactions />}
                </div>
              </TabsContent>
              <TabsContent value="limit" className="mt-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <Info className="h-12 w-12 text-slate-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Limit Orders Coming Soon</h3>
                  <p className="text-sm text-slate-400 text-center">
                    Set the price at which you want to buy or sell tokens automatically.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  )
}
