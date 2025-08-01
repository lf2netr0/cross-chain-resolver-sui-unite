"use client"
import { useTokenContext } from "@/components/token-provider"

export default function HomePageChart() {
  const { tokens } = useTokenContext()

  // Default to ETH/USDC pair
  const baseToken = tokens.find((t) => t.id === "ethereum") || tokens[0]
  const quoteToken = tokens.find((t) => t.id === "usd-coin") || tokens[1]

  return null
}
