"use client"

import { useSuiAccount } from "./sui-wallet-provider"
import { SuiWalletConnection } from "./sui-wallet-connection"
import { SuiNetworkSwitcher } from "./sui-network-switcher"

interface SuiWalletButtonProps {
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "lg"
  showNetworkSwitcher?: boolean
}

export function SuiWalletButton({ 
  variant = "default",
  size = "default",
  showNetworkSwitcher = true
}: SuiWalletButtonProps) {
  const { isConnected } = useSuiAccount()

  if (!isConnected) {
    return <SuiWalletConnection />
  }

  return (
    <div className="flex items-center gap-2">
      <SuiWalletConnection />
      {showNetworkSwitcher && (
        <SuiNetworkSwitcher />
      )}
    </div>
  )
}