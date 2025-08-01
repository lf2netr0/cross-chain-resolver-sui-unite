import { createConfig, http } from "wagmi"
import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains"
import { injected, walletConnect } from "wagmi/connectors"

// Make sure we have a valid project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""

if (!projectId) {
  console.warn("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable")
}

export const config = createConfig({
  chains: [mainnet, polygon, optimism, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
  },
  connectors: [
    injected(),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: "MoveB",
        description: "A decentralized exchange for swapping tokens",
        url: "https://MoveB.com",
        icons: ["https://MoveB.com/logo.png"],
      },
    }),
  ],
})
