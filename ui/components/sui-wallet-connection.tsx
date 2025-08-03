"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Badge } from "./ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Separator } from "./ui/separator"
import { Copy, ExternalLink, Wallet, LogOut } from "lucide-react"
import { useSuiWallet, useSuiAccount, useSuiNetwork } from "./sui-wallet-provider"
import { toast } from "./ui/use-toast"

interface SuiWalletConnectionProps {
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg"
}

export function SuiWalletConnection({ 
  variant = "default", 
  size = "default" 
}: SuiWalletConnectionProps) {
  const { wallets, connect, disconnect, isConnecting, getBalance } = useSuiWallet()
  const { isConnected, address, wallet } = useSuiAccount()
  const { network, networkInfo } = useSuiNetwork()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)

  // Load balance when connected
  const loadBalance = async () => {
    if (isConnected) {
      try {
        const bal = await getBalance()
        setBalance((parseFloat(bal) / 1_000_000_000).toFixed(4)) // Convert MIST to SUI
      } catch (error) {
        console.error("Failed to load balance:", error)
      }
    }
  }

  // Load balance when modal opens
  const handleModalOpen = (open: boolean) => {
    setIsModalOpen(open)
    if (open && isConnected) {
      loadBalance()
    }
  }

  // Copy address to clipboard
  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Connect to a specific wallet
  const handleConnect = async (walletToConnect: any) => {
    try {
      await connect(walletToConnect)
      setIsModalOpen(false)
      toast({
        title: "Wallet Connected",
        description: `Successfully connected to ${walletToConnect.name}`,
      })
    } catch (error) {
      console.error("Failed to connect:", error)
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Disconnect wallet
  const handleDisconnect = async () => {
    try {
      await disconnect()
      setIsModalOpen(false)
      setBalance(null)
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
      })
    } catch (error) {
      console.error("Failed to disconnect:", error)
    }
  }

  if (!isConnected) {
    return (
      <Dialog open={isModalOpen} onOpenChange={handleModalOpen}>
        <DialogTrigger asChild>
          <button 
            disabled={isConnecting}
            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
          >
            <Wallet className="h-5 w-5" />
            <span className="font-medium">
              {isConnecting ? "Connecting..." : "Connect Sui Wallet"}
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Sui Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Sui Wallets Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please install a Sui wallet extension to continue
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.open("https://sui.io/wallet", "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Get Sui Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a wallet to connect to Sui network
                </p>
                {wallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => handleConnect(wallet)}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    {wallet.icon && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={wallet.icon} alt={wallet.name} />
                        <AvatarFallback>{wallet.name[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{wallet.name}</div>
                      {wallet.version && (
                        <div className="text-xs text-muted-foreground">v{wallet.version}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleModalOpen}>
      <DialogTrigger asChild>
        <button className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200">
          <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse"></div>
          {wallet?.icon && (
            <Avatar className="h-4 w-4">
              <AvatarImage src={wallet.icon} alt={wallet.name} />
              <AvatarFallback className="text-xs">{wallet.name[0]}</AvatarFallback>
            </Avatar>
          )}
          <span className="text-sm">Sui: {formatAddress(address!)}</span>
          <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
            {networkInfo.name.replace("Sui ", "")}
          </Badge>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sui Wallet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Wallet Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            {wallet?.icon && (
              <Avatar className="h-10 w-10">
                <AvatarImage src={wallet.icon} alt={wallet.name} />
                <AvatarFallback>{wallet.name[0]}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <div className="font-medium">{wallet?.name}</div>
              <div className="text-sm text-muted-foreground">
                {networkInfo.name}
              </div>
            </div>
            <Badge variant="outline">Connected</Badge>
          </div>

          <Separator />

          {/* Account Info */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono">
                  {address}
                </code>
                <Button size="sm" variant="ghost" onClick={copyAddress}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {balance !== null && (
              <div>
                <label className="text-sm font-medium mb-2 block">Balance</label>
                <div className="px-3 py-2 bg-muted rounded text-sm">
                  {balance} SUI
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadBalance}
              className="flex-1"
            >
              Refresh Balance
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}