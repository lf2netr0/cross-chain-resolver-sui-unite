"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "./ui/use-toast"
import { SuiClient } from "@mysten/sui/client"
import { 
  StandardConnectFeature, 
  Wallet, 
  WalletAccount,
  WalletWithFeatures,
  getWallets,
  WalletWithStandardFeatures 
} from "@mysten/wallet-standard"
import { Transaction } from "@mysten/sui/transactions"

// Define supported Sui networks
export const SUI_NETWORKS = {
  mainnet: {
    id: "sui:mainnet",
    name: "Sui Mainnet",
    rpcUrl: "https://fullnode.mainnet.sui.io:443"
  },
  testnet: {
    id: "sui:testnet", 
    name: "Sui Testnet",
    rpcUrl: "https://fullnode.testnet.sui.io:443"
  },
  devnet: {
    id: "sui:devnet",
    name: "Sui Devnet", 
    rpcUrl: "https://fullnode.devnet.sui.io:443"
  }
} as const

export type SuiNetwork = keyof typeof SUI_NETWORKS

interface WalletInfo {
  name: string
  icon: string
  version: string
  accounts: readonly WalletAccount[]
}

interface SuiWalletContextType {
  // Wallet state
  currentWallet: WalletWithStandardFeatures | null
  wallets: readonly Wallet[]
  accounts: readonly WalletAccount[]
  currentAccount: WalletAccount | null
  
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  
  // Network state
  currentNetwork: SuiNetwork
  suiClient: SuiClient
  
  // Actions
  connect: (wallet: Wallet) => Promise<void>
  disconnect: () => Promise<void>
  switchNetwork: (network: SuiNetwork) => void
  signAndExecuteTransaction: (transaction: Transaction) => Promise<any>
  
  // Getters
  getBalance: (coinType?: string) => Promise<string>
  walletInfo: WalletInfo | null
}

const SuiWalletContext = createContext<SuiWalletContextType | undefined>(undefined)

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  // Wallet state
  const [currentWallet, setCurrentWallet] = useState<WalletWithStandardFeatures | null>(null)
  const [wallets, setWallets] = useState<readonly Wallet[]>([])
  const [accounts, setAccounts] = useState<readonly WalletAccount[]>([])
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(null)
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  // Network state
  const [currentNetwork, setCurrentNetwork] = useState<SuiNetwork>("devnet")
  const [suiClient, setSuiClient] = useState(() => new SuiClient({ url: SUI_NETWORKS.devnet.rpcUrl }))

  // Initialize wallets on mount
  useEffect(() => {
    const initializeWallets = () => {
      try {
        const availableWallets = getWallets()
        setWallets(availableWallets.get())
        
        console.log(`Found ${availableWallets.get().length} Sui wallets:`, 
          availableWallets.get().map(w => w.name)
        )
        
        // Listen for new wallets
        const unsubscribe = availableWallets.on("register", () => {
          setWallets(availableWallets.get())
        })
        
        return unsubscribe
      } catch (error) {
        console.error("Failed to initialize wallets:", error)
        return () => {}
      }
    }

    if (typeof window !== "undefined") {
      const unsubscribe = initializeWallets()
      return unsubscribe
    }
  }, [])

  // Connect to wallet
  const connect = async (wallet: Wallet) => {
    if (!wallet.features['standard:connect']) {
      toast({
        title: "Wallet not supported",
        description: "This wallet doesn't support the connect feature",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)
    
    try {
      const connectFeature = wallet.features['standard:connect'] as any
      const result = await connectFeature.connect()
      
      if (result.accounts.length > 0) {
        const walletWithFeatures = wallet as WalletWithStandardFeatures
        setCurrentWallet(walletWithFeatures)
        setAccounts(result.accounts)
        setCurrentAccount(result.accounts[0])
        setIsConnected(true)
        
        toast({
          title: "Wallet Connected",
          description: `Successfully connected to ${wallet.name}`,
        })
        
        console.log("Connected to wallet:", wallet.name)
        console.log("Accounts:", result.accounts)
      } else {
        throw new Error("No accounts found")
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      toast({
        title: "Connection Failed", 
        description: `Failed to connect to ${wallet.name}. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect wallet
  const disconnect = async () => {
    try {
      // For now, just clear local state
      // Some wallets may not have explicit disconnect
      
      setCurrentWallet(null)
      setAccounts([])
      setCurrentAccount(null)
      setIsConnected(false)
      
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
      })
    } catch (error) {
      console.error("Failed to disconnect wallet:", error)
      // Still update the state even if disconnect fails
      setCurrentWallet(null) 
      setAccounts([])
      setCurrentAccount(null)
      setIsConnected(false)
    }
  }

  // Switch network
  const switchNetwork = (network: SuiNetwork) => {
    setCurrentNetwork(network)
    setSuiClient(new SuiClient({ url: SUI_NETWORKS[network].rpcUrl }))
    
    toast({
      title: "Network Changed",
      description: `Switched to ${SUI_NETWORKS[network].name}`,
    })
  }

  // Sign and execute transaction
  const signAndExecuteTransaction = async (transaction: Transaction) => {
    if (!currentWallet || !currentAccount) {
      throw new Error("No wallet connected")
    }
    
    try {
      // For now, we'll use a generic approach
      // Each wallet implementation may have different feature names
      const walletFeatures = currentWallet.features as any
      
      if (walletFeatures['sui:signAndExecuteTransactionBlock']) {
        const signFeature = walletFeatures['sui:signAndExecuteTransactionBlock']
        const result = await signFeature.signAndExecuteTransactionBlock({
          transactionBlock: transaction,
          account: currentAccount,
          chain: SUI_NETWORKS[currentNetwork].id,
        })
        return result
      } else {
        throw new Error("Wallet doesn't support transaction signing")
      }
    } catch (error) {
      console.error("Failed to sign and execute transaction:", error)
      throw error
    }
  }

  // Get balance
  const getBalance = async (coinType: string = "0x2::sui::SUI"): Promise<string> => {
    if (!currentAccount) {
      return "0"
    }
    
    try {
      const balance = await suiClient.getBalance({
        owner: currentAccount.address,
        coinType,
      })
      
      return balance.totalBalance
    } catch (error) {
      console.error("Failed to get balance:", error)
      return "0"
    }
  }

  // Wallet info
  const walletInfo: WalletInfo | null = currentWallet ? {
    name: currentWallet.name,
    icon: currentWallet.icon,
    version: currentWallet.version,
    accounts,
  } : null

  return (
    <SuiWalletContext.Provider
      value={{
        // Wallet state
        currentWallet,
        wallets,
        accounts,
        currentAccount,
        
        // Connection state
        isConnected,
        isConnecting,
        
        // Network state
        currentNetwork,
        suiClient,
        
        // Actions
        connect,
        disconnect,
        switchNetwork,
        signAndExecuteTransaction,
        
        // Getters
        getBalance,
        walletInfo,
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

// Helper hook for current account info
export function useSuiAccount() {
  const { currentAccount, currentWallet, isConnected } = useSuiWallet()
  
  return {
    account: currentAccount,
    address: currentAccount?.address || null,
    wallet: currentWallet,
    isConnected,
  }
}

// Helper hook for network info
export function useSuiNetwork() {
  const { currentNetwork, suiClient, switchNetwork } = useSuiWallet()
  
  return {
    network: currentNetwork,
    networkInfo: SUI_NETWORKS[currentNetwork],
    client: suiClient,
    switchNetwork,
  }
}
