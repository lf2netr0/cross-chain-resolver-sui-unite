"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export interface Token {
  id: string
  name: string
  symbol: string
  logo: string
  balance: number
  price: number
}

interface TokenContextType {
  tokens: Token[]
  addToken: (token: Token) => void
  removeToken: (id: string) => void
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Token[]>([
    {
      id: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      logo: "/ethereum-crystal.png",
      balance: 1.234,
      price: 3500,
    },
    {
      id: "usd-coin",
      name: "USD Coin",
      symbol: "USDC",
      logo: "/usdc-digital-currency.png",
      balance: 2500,
      price: 1,
    },
    {
      id: "MoveB",
      name: "MoveB",
      symbol: "UIS",
      logo: "/placeholder.svg?height=32&width=32&query=purple token logo",
      balance: 1000,
      price: 2.5,
    },
    {
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      logo: "/placeholder.svg?height=32&width=32&query=bitcoin logo",
      balance: 0.05,
      price: 65000,
    },
    {
      id: "cardano",
      name: "Cardano",
      symbol: "ADA",
      logo: "/placeholder.svg?height=32&width=32&query=cardano logo",
      balance: 1500,
      price: 0.45,
    },
    {
      id: "solana",
      name: "Solana",
      symbol: "SOL",
      logo: "/placeholder.svg?height=32&width=32&query=solana logo",
      balance: 25,
      price: 150,
    },
    {
      id: "polkadot",
      name: "Polkadot",
      symbol: "DOT",
      logo: "/placeholder.svg?height=32&width=32&query=polkadot logo",
      balance: 100,
      price: 6.8,
    },
    {
      id: "chainlink",
      name: "Chainlink",
      symbol: "LINK",
      logo: "/placeholder.svg?height=32&width=32&query=chainlink logo",
      balance: 75,
      price: 15.2,
    },
  ])

  const addToken = (token: Token) => {
    setTokens((prev) => [...prev, token])
  }

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((token) => token.id !== id))
  }

  return <TokenContext.Provider value={{ tokens, addToken, removeToken }}>{children}</TokenContext.Provider>
}

export function useTokenContext() {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error("useTokenContext must be used within a TokenProvider")
  }
  return context
}
