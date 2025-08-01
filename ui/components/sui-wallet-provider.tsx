"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "./ui/use-toast"

// Import Slush wallet
let SlushWallet: any = null
if (typeof window !== "undefined") {
  import("@mysten/slush-wallet").then((module) => {
    SlushWallet = module.SlushWallet
  })
}

interface SuiWalletContextType {
  slushWallet: any
  suiAddress: string | null
  isSuiConnected: boolean
  connectSlushWallet: () => Promise<void>
  disconnectSlushWallet: () => void
  isSlushWalletAvailable: boolean
}

const SuiWalletContext = createContext<SuiWalletContextType | undefined>(undefined)

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const [slushWallet, setSlushWallet] = useState<any>(null)
  const [suiAddress, setSuiAddress] = useState<string | null>(null)
  const [isSuiConnected, setIsSuiConnected] = useState(false)
  const [isSlushWalletAvailable, setIsSlushWalletAvailable] = useState(false)

  // Initialize Slush wallet on mount
  useEffect(() => {
    const initializeSlushWallet = async () => {
      if (typeof window !== "undefined") {
        try {
          const { SlushWallet } = await import("@mysten/slush-wallet")
          const wallet = new SlushWallet()
          setSlushWallet(wallet)
          setIsSlushWalletAvailable(true)
          console.log("Slush Wallet initialized")
        } catch (error) {
          console.error("Failed to initialize Slush Wallet:", error)
          setIsSlushWalletAvailable(false)
        }
      }
    }

    initializeSlushWallet()
  }, [])

  const connectSlushWallet = async () => {
    try {
      if (!slushWallet) {
        toast({
          title: "Wallet not available",
          description: "Slush Wallet is not available. Please install it first.",
          variant: "destructive",
        })
        return
      }

      // Connect to Slush wallet
      const response = await slushWallet.connect()

      if (response && response.accounts && response.accounts.length > 0) {
        setSuiAddress(response.accounts[0].address)
        setIsSuiConnected(true)

        toast({
          title: "Slush Wallet Connected",
          description: "Successfully connected to Slush Wallet",
        })
      } else {
        throw new Error("No accounts found")
      }
    } catch (error) {
      console.error("Failed to connect Slush wallet:", error)
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Slush Wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const disconnectSlushWallet = () => {
    try {
      if (slushWallet && slushWallet.disconnect) {
        slushWallet.disconnect()
      }

      setSuiAddress(null)
      setIsSuiConnected(false)

      toast({
        title: "Slush Wallet Disconnected",
        description: "Your Slush wallet has been disconnected",
      })
    } catch (error) {
      console.error("Failed to disconnect Slush wallet:", error)
      // Still update the state even if disconnect fails
      setSuiAddress(null)
      setIsSuiConnected(false)
    }
  }

  return (
    <SuiWalletContext.Provider
      value={{
        slushWallet,
        suiAddress,
        isSuiConnected,
        connectSlushWallet,
        disconnectSlushWallet,
        isSlushWalletAvailable,
      }}
    >
      {children}
    </SuiWalletContext.Provider>
  )
}

export function useSuiWallet() {
  const context = useContext(SuiWalletContext)
  if (context === undefined) {
    throw new Error("useSuiWallet must be used within a SuiWalletProvider")
  }
  return context
}
