import { createConfig, http } from "wagmi"
import { mainnet, polygon, optimism, arbitrum, bsc } from "wagmi/chains"
import { injected } from "wagmi/connectors"

// Only import walletConnect on client side to avoid SSR issues
let walletConnect: any = null
if (typeof window !== 'undefined') {
  import("wagmi/connectors").then(({ walletConnect: wc }) => {
    walletConnect = wc
  }).catch(console.warn)
}

// Make sure we have a valid project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo_project_id"

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && typeof window !== 'undefined') {
  console.warn("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable")
}

// Create connectors array - only client-side safe connectors
const getConnectors = () => {
  const connectors = [injected()]
  
  // Only add WalletConnect on client side and with valid project ID
  if (typeof window !== 'undefined' && walletConnect && projectId && projectId !== "demo_project_id") {
    try {
      connectors.push(
        walletConnect({
          projectId,
          showQrModal: true,
          metadata: {
            name: "Cross-Chain Demo",
            description: "BSC ↔ Sui Cross-Chain Swap Demo",
            url: typeof window !== 'undefined' ? window.location.origin : "https://localhost:3000",
            icons: [],
          },
        })
      )
    } catch (error) {
      console.warn("Failed to initialize WalletConnect:", error)
    }
  }
  
  return connectors
}

// Define BSC Local for demo (use different ID to avoid conflicts)
const bscLocal = {
  id: 31337, // Use local development chain ID
  name: 'BSC Local',
  nativeCurrency: {
    decimals: 18,
    name: 'BNB',
    symbol: 'BNB',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_BSC_RPC_URL || 'http://localhost:8545'],
    },
  },
  blockExplorers: {
    default: { name: 'Local Explorer', url: 'http://localhost:8545' },
  },
} as const

export const config = createConfig({
  chains: [bscLocal, bsc, mainnet],
  transports: {
    [bscLocal.id]: http(),
    [bsc.id]: http(),
    [mainnet.id]: http(),
  },
  connectors: getConnectors(),
  ssr: true, // Enable SSR support
})
