"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, ChevronDown, Globe, Settings } from "lucide-react"
import { useAccount } from "wagmi"
import { useSuiAccount, useSuiNetwork } from "./sui-wallet-provider"
import { CrossChainWalletModal } from "./cross-chain-wallet-modal"
import { SuiNetworkSwitcher } from "./sui-network-switcher"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface CrossChainWalletButtonProps {
  showNetworkSwitcher?: boolean
}

export function CrossChainWalletButton({ showNetworkSwitcher = true }: CrossChainWalletButtonProps = {}) {
  const [mounted, setMounted] = useState(false)
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { address: suiAddress, isConnected: isSuiConnected, wallet: suiWallet } = useSuiAccount()
  const { network, networkInfo } = useSuiNetwork()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<"connect" | "evm-account" | "sui-account">("connect")

  useEffect(() => {
    setMounted(true)
  }, [])

  const openConnectModal = () => {
    setModalView("connect")
    setIsModalOpen(true)
  }

  const openEvmAccountModal = () => {
    setModalView("evm-account")
    setIsModalOpen(true)
  }

  const openSuiAccountModal = () => {
    setModalView("sui-account")
    setIsModalOpen(true)
  }

  // Helper function to format addresses
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!mounted) {
    return (
      <button className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
        <Wallet className="h-5 w-5" />
        <span className="font-medium">Connect Wallets</span>
      </button>
    )
  }

  // If no wallets connected
  if (!isEvmConnected && !isSuiConnected) {
    return (
      <>
        <button
          onClick={openConnectModal}
          className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
        >
          <Wallet className="h-5 w-5" />
          <span className="font-medium">Connect Wallets</span>
        </button>

        <CrossChainWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} view={modalView} />
      </>
    )
  }

  // If both wallets connected
  if (isEvmConnected && isSuiConnected) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              </div>
              <span className="text-sm">Both Connected</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
            <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer" onClick={openEvmAccountModal}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span>
                  BSC: {formatAddress(evmAddress!)}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer" onClick={openSuiAccountModal}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span>
                  Sui: {formatAddress(suiAddress!)} ({networkInfo.name.replace("Sui ", "")})
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Network Switcher for Sui */}
        {showNetworkSwitcher && <SuiNetworkSwitcher />}

        <CrossChainWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} view={modalView} />
      </div>
    )
  }

  // If only one wallet connected
  return (
    <div className="flex items-center gap-2">
      {isEvmConnected && (
        <button
          onClick={openEvmAccountModal}
          className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200"
        >
          <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-sm">
            BSC: {formatAddress(evmAddress!)}
          </span>
        </button>
      )}

      {isSuiConnected && (
        <div className="flex items-center gap-2">
          <button
            onClick={openSuiAccountModal}
            className="bg-slate-700 border border-slate-600 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200"
          >
            <div className="w-4 h-4 rounded-full bg-blue-400 animate-pulse"></div>
            {suiWallet?.icon && (
              <img src={suiWallet.icon} alt={suiWallet.name} className="w-4 h-4" />
            )}
            <span className="text-sm">
              Sui: {formatAddress(suiAddress!)}
            </span>
          </button>
          
          {/* Sui Network Switcher */}
          {showNetworkSwitcher && <SuiNetworkSwitcher />}
        </div>
      )}

      <button
        onClick={openConnectModal}
        className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-cyan-500/20 text-sm"
      >
        <Wallet className="h-4 w-4" />
        + {isEvmConnected ? "Sui" : "BSC"}
      </button>

      <CrossChainWalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} view={modalView} />
    </div>
  )
}
