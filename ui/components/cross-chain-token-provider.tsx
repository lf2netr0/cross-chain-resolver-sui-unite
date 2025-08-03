"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export interface CrossChainToken {
  id: string
  name: string
  symbol: string
  logo: string
  balance: number
  price: number
  chain: "BSC" | "SUI"
  chainLogo: string
  contractAddress?: string
  decimals?: number
}

interface CrossChainTokenContextType {
  tokens: CrossChainToken[]
  addToken: (token: CrossChainToken) => void
  removeToken: (id: string) => void
  getTokensByChain: (chain: "BSC" | "SUI") => CrossChainToken[]
}

const CrossChainTokenContext = createContext<CrossChainTokenContextType | undefined>(undefined)

export function CrossChainTokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<CrossChainToken[]>([
    // BSC Tokens
    {
      id: "bsc-usdc",
      name: "USD Coin",
      symbol: "USDC",
      logo: "/usdc-digital-currency.png",
      balance: 1000,
      price: 1,
      chain: "BSC",
      chainLogo: "/placeholder.svg?height=20&width=20",
      contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
    {
      id: "bsc-bnb",
      name: "BNB",
      symbol: "BNB",
      logo: "/placeholder.svg?height=32&width=32",
      balance: 2.5,
      price: 320,
      chain: "BSC",
      chainLogo: "/placeholder.svg?height=20&width=20",
      decimals: 18,
    },
    {
      id: "bsc-busd",
      name: "Binance USD",
      symbol: "BUSD",
      logo: "/placeholder.svg?height=32&width=32",
      balance: 500,
      price: 1,
      chain: "BSC",
      chainLogo: "/placeholder.svg?height=20&width=20",
      contractAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      decimals: 18,
    },

    // Sui Tokens
    {
      id: "sui-sui",
      name: "Sui",
      symbol: "SUI",
      logo: "/placeholder.svg?height=32&width=32",
      balance: 100,
      price: 2.1,
      chain: "SUI",
      chainLogo: "/placeholder.svg?height=20&width=20",
      decimals: 9,
    },
    {
      id: "sui-usdc",
      name: "USD Coin",
      symbol: "USDC",
      logo: "/usdc-digital-currency.png",
      balance: 750,
      price: 1,
      chain: "SUI",
      chainLogo: "/placeholder.svg?height=20&width=20",
      decimals: 6,
    },
    {
      id: "sui-usdt",
      name: "Tether USD",
      symbol: "USDT",
      logo: "/placeholder.svg?height=32&width=32",
      balance: 300,
      price: 1,
      chain: "SUI",
      chainLogo: "/placeholder.svg?height=20&width=20",
      decimals: 6,
    },
  ])

  const addToken = (token: CrossChainToken) => {
    setTokens((prev) => [...prev, token])
  }

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((token) => token.id !== id))
  }

  const getTokensByChain = (chain: "BSC" | "SUI") => {
    return tokens.filter((token) => token.chain === chain)
  }

  return (
    <CrossChainTokenContext.Provider value={{ tokens, addToken, removeToken, getTokensByChain }}>
      {children}
    </CrossChainTokenContext.Provider>
  )
}

export function useCrossChainTokens() {
  const context = useContext(CrossChainTokenContext)
  if (context === undefined) {
    throw new Error("useCrossChainTokens must be used within a CrossChainTokenProvider")
  }
  return context
}
