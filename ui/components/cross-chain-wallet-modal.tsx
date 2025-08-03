"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useConnect, useDisconnect, useAccount, useBalance } from "wagmi"
import { useSuiAccount, useSuiNetwork, useSuiWallet } from "./sui-wallet-provider"
import { toast } from "./ui/use-toast"
import { Copy, ExternalLink, LogOut, Download, Wallet } from "lucide-react"
import { useState } from "react"

interface CrossChainWalletModalProps {
  isOpen: boolean
  onClose: () => void
  view: "connect" | "evm-account" | "sui-account"
}

export function CrossChainWalletModal({ isOpen, onClose, view }: CrossChainWalletModalProps) {
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { data: evmBalance } = useBalance({ address: evmAddress })

  // Sui Wallet Standard hooks
  const { address: suiAddress, isConnected: isSuiConnected, wallet: suiWallet } = useSuiAccount()
  const { network: suiNetwork, networkInfo } = useSuiNetwork()
  const { wallets, connect: connectSuiWallet, disconnect: disconnectSuiWallet, isConnecting } = useSuiWallet()

  const [suiConnecting, setSuiConnecting] = useState(false)

  // Format address for display
  const formatAddress = (address?: string | null) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Handle Sui wallet connection
  const handleSuiConnect = async (wallet: any) => {
    setSuiConnecting(true)
    try {
      await connectSuiWallet(wallet)
      toast({
        title: "Wallet Connected",
        description: `${wallet.name} connected successfully`,
      })
    } catch (error) {
      console.error('Failed to connect Sui wallet:', error)
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Sui wallet",
        variant: "destructive",
      })
    } finally {
      setSuiConnecting(false)
    }
  }

  // Handle Sui wallet disconnection
  const handleSuiDisconnect = async () => {
    try {
      await disconnectSuiWallet()
      toast({
        title: "Wallet Disconnected",
        description: "Sui wallet disconnected successfully",
      })
    } catch (error) {
      console.error('Failed to disconnect Sui wallet:', error)
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect Sui wallet",
        variant: "destructive",
      })
    }
  }

  // Copy address to clipboard
  const copyAddress = (address: string | null | undefined, type: string) => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({
        title: "Address copied",
        description: `${type} address copied to clipboard`,
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-800 text-white border-slate-700">
        {view === "connect" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect Cross-Chain Wallets</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* EVM Wallets Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-cyan-400">EVM Wallets (BSC)</h3>
                {isEvmConnected ? (
                  <div className="p-3 bg-slate-700 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <span className="text-sm">Connected: {formatAddress(evmAddress)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect()}
                      className="bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {connectors.map((connector) => (
                      <Button
                        key={connector.uid}
                        onClick={() => connect({ connector })}
                        disabled={isPending}
                        className="flex justify-between items-center w-full bg-slate-700 hover:bg-slate-600"
                      >
                        <span>{connector.name}</span>
                        <img
                          src={
                            connector.name.toLowerCase().includes("metamask")
                              ? "/metamask-fox-logo.png"
                              : connector.name.toLowerCase().includes("coinbase")
                                ? "/abstract-crypto-wallet.png"
                                : "/colorful-wallet-icon.png"
                          }
                          alt={connector.name}
                          className="h-6 w-6"
                        />
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sui Wallets Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-blue-400">Sui Wallets</h3>
                {isSuiConnected ? (
                  <div className="p-3 bg-slate-700 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      {suiWallet?.icon && (
                        <img src={suiWallet.icon} alt={suiWallet.name} className="h-4 w-4" />
                      )}
                      <span className="text-sm">Connected: {formatAddress(suiAddress)} ({suiWallet?.name})</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuiDisconnect}
                      className="bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {wallets.length > 0 ? (
                      wallets.map((wallet) => (
                        <Button
                          key={wallet.name}
                          onClick={() => handleSuiConnect(wallet)}
                          disabled={suiConnecting || isConnecting}
                          className="flex justify-between items-center w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                        >
                          <span>{wallet.name}</span>
                          <div className="flex items-center gap-2">
                            {wallet.icon ? (
                              <img src={wallet.icon} alt={wallet.name} className="h-6 w-6" />
                            ) : (
                              <Wallet className="h-6 w-6" />
                            )}
                          </div>
                        </Button>
                      ))
                    ) : (
                      <div className="p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300">No Sui Wallets</span>
                          <span className="text-xs text-red-400">Not Available</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                          Install a Sui wallet to connect to the Sui network
                        </p>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"
                            onClick={() => window.open("https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil", "_blank")}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Install Sui Wallet
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"
                            onClick={() => window.open("https://suiet.app/", "_blank")}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Install Suiet Wallet
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Installation Help */}
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Need help?</h4>
                <div className="space-y-1 text-xs text-slate-400">
                  <div>
                    • For BSC: Install{" "}
                    <a
                      href="https://metamask.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      MetaMask
                    </a>{" "}
                    or other EVM wallet
                  </div>
                  <div>
                    • For Sui: Install{" "}
                    <a
                      href="https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Sui Wallet
                    </a>
                    {" or "}
                    <a
                      href="https://suiet.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Suiet
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {view === "evm-account" && isEvmConnected && (
          <>
            <DialogHeader>
              <DialogTitle>EVM Account (BSC)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <img src="/classic-leather-wallet.png" alt="Wallet" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">{formatAddress(evmAddress)}</p>
                    <p className="text-sm font-medium">
                      {evmBalance?.formatted.slice(0, 6)} {evmBalance?.symbol}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={() => copyAddress(evmAddress, "EVM")}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={() => window.open(`https://bscscan.com/address/${evmAddress}`, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on BSCScan
                </Button>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  disconnect()
                  onClose()
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect EVM Wallet
              </Button>
            </div>
          </>
        )}

        {view === "sui-account" && isSuiConnected && (
          <>
            <DialogHeader>
              <DialogTitle>{suiWallet?.name || "Sui Wallet"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    {suiWallet?.icon ? (
                      <img src={suiWallet.icon} alt={suiWallet.name} className="h-6 w-6" />
                    ) : (
                      <Wallet className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">{formatAddress(suiAddress)}</p>
                    <p className="text-sm font-medium">{networkInfo.name}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={() => copyAddress(suiAddress, "Sui")}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={() => window.open(`https://suiexplorer.com/address/${suiAddress}?network=${suiNetwork}`, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Explorer
                </Button>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  handleSuiDisconnect()
                  onClose()
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect {suiWallet?.name || "Sui Wallet"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
