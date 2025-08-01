import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains"
import { http } from "viem"

// Make sure we have a valid project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""

if (!projectId) {
  console.warn("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable")
}

export const config = getDefaultConfig({
  appName: "MoveB",
  projectId: projectId,
  chains: [mainnet, polygon, optimism, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
  },
  // Add these options to prevent heartbeat issues
  ssr: true,
})
