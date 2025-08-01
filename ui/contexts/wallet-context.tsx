"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { toast } from "@/components/ui/use-toast"
import { useAccount, useChainId, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains"

// Define network types
export const networks = [
  {
    id: "ethereum",
    name: "Ethereum",
    icon: "/ethereum-crystal.png",
    iconBackground: "#627EEA",
    chainId: mainnet.id,
  },
  {
    id: "polygon",
    name: "Polygon",
    icon: "/polygon-abstract-network.png",
    iconBackground: "#8247E5",
    chainId: polygon.id,
  },
  {
    id: "optimism",
    name: "Optimism",
    icon: "/optimistic-circuit.png",
    iconBackground: "#FF0420",
    chainId: optimism.id,
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    icon: "/arbitrum-network-abstract.png",
    iconBackground: "#28A0F0",
    chainId: arbitrum.id,
  },
]

interface WalletContextType {
  address: string | null
  isConnected: boolean
  network: (typeof networks)[0]
  balance: string
  connect: (connectorId: string) => void
  disconnect: () => void
  switchNetwork: (networkId: string) => void
  openConnectModal: () => void
  openAccountModal: () => void
  openChainModal: () => void
  isModalOpen: boolean
  setIsModalOpen: (isOpen: boolean) => void
  modalView: "connect" | "account" | "chain"
  setModalView: (view: "connect" | "account" | "chain") => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balanceData } = useBalance({ address })
  const { connect: wagmiConnect, connectors } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<"connect" | "account" | "chain">("connect")

  // Find current network
  const currentNetwork = networks.find((n) => n.chainId === chainId) || networks[0]

  const connect = (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId || c.name.toLowerCase().includes(connectorId))

    if (connector) {
      wagmiConnect({ connector })
      toast({
        title: "Wallet Connected",
        description: `Connected to ${connector.name} wallet`,
      })
    } else {
      toast({
        title: "Connection Error",
        description: "Connector not found",
        variant: "destructive",
      })
    }
  }

  const disconnect = () => {
    wagmiDisconnect()
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    })
  }

  const switchNetwork = (networkId: string) => {
    const network = networks.find((n) => n.id === networkId)

    if (network) {
      switchChain({ chainId: network.chainId })
      toast({
        title: "Network Changed",
        description: `Switched to ${network.name}`,
      })
    }
  }

  const openConnectModal = () => {
    setModalView("connect")
    setIsModalOpen(true)
  }

  const openAccountModal = () => {
    setModalView("account")
    setIsModalOpen(true)
  }

  const openChainModal = () => {
    setModalView("chain")
    setIsModalOpen(true)
  }

  return (
    <WalletContext.Provider
      value={{
        address: address || null,
        isConnected,
        network: currentNetwork,
        balance: balanceData?.formatted || "0",
        connect,
        disconnect,
        switchNetwork,
        openConnectModal,
        openAccountModal,
        openChainModal,
        isModalOpen,
        setIsModalOpen,
        modalView,
        setModalView,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
