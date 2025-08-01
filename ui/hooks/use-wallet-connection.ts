"use client"

import { useState } from "react"
import { useConnect, useDisconnect } from "wagmi"

export function useWalletConnection() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<"connect" | "account" | "network">("connect")
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const openConnectModal = () => {
    setModalView("connect")
    setIsModalOpen(true)
  }

  const openAccountModal = () => {
    setModalView("account")
    setIsModalOpen(true)
  }

  const openChainModal = () => {
    setModalView("network")
    setIsModalOpen(true)
  }

  return {
    openConnectModal,
    openAccountModal,
    openChainModal,
    isModalOpen,
    setIsModalOpen,
    modalView,
    setModalView,
    connect,
    connectors,
    disconnect,
  }
}

// Export the openConnectModal function for use in other components
export const globalOpenConnectModal = () => {
  // This is a placeholder - in a real app you'd use a global state manager
  console.log("Open connect modal")
}
