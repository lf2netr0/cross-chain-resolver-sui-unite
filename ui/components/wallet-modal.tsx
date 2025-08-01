"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink, LogOut } from "lucide-react"
import { useWallet } from "@/contexts/wallet-context"
import { toast } from "@/components/ui/use-toast"

// Define the networks array
const networks = [
  {
    id: "ethereum",
    name: "Ethereum",
    icon: "/ethereum-logo.png",
    iconBackground: "#627EEA",
  },
  {
    id: "polygon",
    name: "Polygon",
    icon: "/polygon-matic-logo.png",
    iconBackground: "#8247E5",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    icon: "/arbitrum-logo.png",
    iconBackground: "#28A0F0",
  },
]

export function WalletModal() {
  const { isModalOpen, setIsModalOpen, modalView, connect, disconnect, address, network, balance, switchNetwork } =
    useWallet()

  // Format address for display
  const formatAddress = (address?: string | null) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Copy address to clipboard
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  // View on Etherscan
  const viewOnEtherscan = () => {
    if (address) {
      window.open(`https://etherscan.io/address/${address}`, "_blank")
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-md bg-slate-800 text-white border-slate-700">
        {modalView === "connect" && (
          <>
            <div className="text-xl font-bold mb-4">Connect a Wallet</div>
            <div className="grid gap-4 py-4">
              <Button
                onClick={() => {
                  connect("injected")
                  setIsModalOpen(false)
                }}
                className="flex justify-between items-center w-full bg-slate-700 hover:bg-slate-600"
              >
                <span>MetaMask</span>
                <img src="/metamask-fox-logo.png" alt="MetaMask" className="h-6 w-6" />
              </Button>
              <Button
                onClick={() => {
                  connect("walletConnect")
                  setIsModalOpen(false)
                }}
                className="flex justify-between items-center w-full bg-slate-700 hover:bg-slate-600"
              >
                <span>WalletConnect</span>
                <img src="/walletconnect-icon.png" alt="WalletConnect" className="h-6 w-6" />
              </Button>
              <Button
                onClick={() => {
                  connect("coinbase")
                  setIsModalOpen(false)
                }}
                className="flex justify-between items-center w-full bg-slate-700 hover:bg-slate-600"
              >
                <span>Coinbase Wallet</span>
                <img src="/abstract-crypto-wallet.png" alt="Coinbase Wallet" className="h-6 w-6" />
              </Button>
            </div>
          </>
        )}

        {modalView === "account" && (
          <>
            <div className="text-xl font-bold mb-4">Account</div>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <img src="/classic-leather-wallet.png" alt="Wallet" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">{formatAddress(address)}</p>
                    <p className="text-sm font-medium">
                      {balance} {network.id.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={copyAddress}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600 text-white"
                  onClick={viewOnEtherscan}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Etherscan
                </Button>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  disconnect()
                  setIsModalOpen(false)
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </>
        )}

        {modalView === "chain" && (
          <>
            <div className="text-xl font-bold mb-4">Switch Network</div>
            <div className="grid gap-4 py-4">
              {networks.map((net) => (
                <Button
                  key={net.id}
                  onClick={() => {
                    switchNetwork(net.id)
                    setIsModalOpen(false)
                  }}
                  className={`flex justify-between items-center w-full ${
                    net.id === network.id ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      style={{
                        background: net.iconBackground,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        overflow: "hidden",
                        marginRight: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img alt={net.name} src={net.icon || "/placeholder.svg"} style={{ width: 16, height: 16 }} />
                    </div>
                    {net.name}
                  </div>
                  {net.id === network.id && <div className="h-2 w-2 rounded-full bg-green-400"></div>}
                </Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
