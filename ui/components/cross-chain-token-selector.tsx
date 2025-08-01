"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, Search } from "lucide-react"
import { useCrossChainTokens, type CrossChainToken } from "./cross-chain-token-provider"

interface CrossChainTokenSelectorProps {
  selectedToken: CrossChainToken
  onSelectToken: (token: CrossChainToken) => void
  otherToken?: CrossChainToken
  label: string
}

export function CrossChainTokenSelector({
  selectedToken,
  onSelectToken,
  otherToken,
  label,
}: CrossChainTokenSelectorProps) {
  const { tokens, getTokensByChain } = useCrossChainTokens()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedChain, setSelectedChain] = useState<"BSC" | "SUI">(selectedToken.chain)

  const filteredTokens = getTokensByChain(selectedChain).filter(
    (token) =>
      token.id !== otherToken?.id &&
      (token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleTokenSelect = (token: CrossChainToken) => {
    onSelectToken(token)
    setIsOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-slate-600 border-slate-500 hover:bg-slate-500 hover:border-slate-400 text-white min-w-[140px]"
      >
        <div className="flex items-center gap-1">
          <img
            src={selectedToken.logo || "/placeholder.svg"}
            alt={selectedToken.name}
            className="h-5 w-5 rounded-full"
          />
          <img
            src={selectedToken.chainLogo || "/placeholder.svg"}
            alt={selectedToken.chain}
            className="h-3 w-3 rounded-full"
          />
        </div>
        <span>{selectedToken.symbol}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-slate-800 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle>Select {label} Token</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search name or paste address"
              className="pl-9 bg-slate-700 border-slate-600 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Tabs value={selectedChain} onValueChange={(value) => setSelectedChain(value as "BSC" | "SUI")}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-700">
              <TabsTrigger value="BSC" className="data-[state=active]:bg-slate-600">
                <div className="flex items-center gap-2">
                  <img src="/placeholder.svg?height=16&width=16" alt="BSC" className="h-4 w-4" />
                  BSC
                </div>
              </TabsTrigger>
              <TabsTrigger value="SUI" className="data-[state=active]:bg-slate-600">
                <div className="flex items-center gap-2">
                  <img src="/placeholder.svg?height=16&width=16" alt="Sui" className="h-4 w-4" />
                  Sui
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="BSC" className="mt-4">
              <ScrollArea className="h-60">
                <div className="space-y-1 p-1">
                  {filteredTokens.map((token) => (
                    <Button
                      key={token.id}
                      variant="ghost"
                      className="w-full justify-start text-white hover:bg-slate-700"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center w-full">
                        <div className="flex items-center gap-1 mr-3">
                          <img
                            src={token.logo || "/placeholder.svg"}
                            alt={token.name}
                            className="h-8 w-8 rounded-full"
                          />
                          <img
                            src={token.chainLogo || "/placeholder.svg"}
                            alt={token.chain}
                            className="h-4 w-4 rounded-full"
                          />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-slate-400">{token.name}</span>
                        </div>
                        <div className="ml-auto">
                          <span className="font-medium">{token.balance.toFixed(4)}</span>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="SUI" className="mt-4">
              <ScrollArea className="h-60">
                <div className="space-y-1 p-1">
                  {filteredTokens.map((token) => (
                    <Button
                      key={token.id}
                      variant="ghost"
                      className="w-full justify-start text-white hover:bg-slate-700"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center w-full">
                        <div className="flex items-center gap-1 mr-3">
                          <img
                            src={token.logo || "/placeholder.svg"}
                            alt={token.name}
                            className="h-8 w-8 rounded-full"
                          />
                          <img
                            src={token.chainLogo || "/placeholder.svg"}
                            alt={token.chain}
                            className="h-4 w-4 rounded-full"
                          />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-slate-400">{token.name}</span>
                        </div>
                        <div className="ml-auto">
                          <span className="font-medium">{token.balance.toFixed(4)}</span>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
