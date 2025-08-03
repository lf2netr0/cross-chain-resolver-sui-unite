// Demo environment configuration
// Safe environment variable access for SSR

const getEnvVar = (key: string, defaultValue: string = '') => {
  if (typeof window === 'undefined' && typeof process === 'undefined') {
    return defaultValue
  }
  return process.env[key] || defaultValue
}

export const DEMO_CONFIG = {
  networks: {
    bsc: {
      chainId: parseInt(getEnvVar('NEXT_PUBLIC_BSC_CHAIN_ID', '31337')), // Use local dev chain ID
      name: 'BSC Local',
      rpcUrl: getEnvVar('NEXT_PUBLIC_BSC_RPC_URL', 'http://localhost:8545'),
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB', 
        decimals: 18
      },
      blockExplorer: 'https://bscscan.com'
    },
    sui: {
      name: getEnvVar('NEXT_PUBLIC_SUI_NETWORK', 'testnet') === 'testnet' ? 'Sui Testnet' : 'Sui Local',
      network: getEnvVar('NEXT_PUBLIC_SUI_NETWORK', 'testnet'),
      rpcUrl: getEnvVar('NEXT_PUBLIC_SUI_RPC_URL', 'https://fullnode.testnet.sui.io'),
      nativeCurrency: {
        name: 'SUI',
        symbol: 'SUI',
        decimals: 9
      },
      blockExplorer: getEnvVar('NEXT_PUBLIC_SUI_NETWORK', 'testnet') === 'testnet' 
        ? 'https://testnet.suivision.xyz' 
        : 'http://localhost:9000'
    }
  },
  
  contracts: {
    bsc: {
      factory: getEnvVar('NEXT_PUBLIC_BSC_FACTORY_ADDRESS'),
      resolver: getEnvVar('NEXT_PUBLIC_BSC_RESOLVER_ADDRESS'),
      usdc: getEnvVar('NEXT_PUBLIC_BSC_USDC_ADDRESS', '0x8965349fb649a33a30cbfda057d8ec2c48abe2a2')
    },
    sui: {
      packageId: getEnvVar('NEXT_PUBLIC_SUI_PACKAGE_ID'),
      poolId: getEnvVar('NEXT_PUBLIC_SUI_POOL_ID'),
      factoryId: getEnvVar('NEXT_PUBLIC_SUI_FACTORY_ID'),
      capId: getEnvVar('NEXT_PUBLIC_SUI_CAP_ID')
    }
  },
  
  // Demo accounts (DO NOT USE IN PRODUCTION)
  accounts: {
    bsc: {
      user: getEnvVar('NEXT_PUBLIC_BSC_USER_PRIVATE_KEY'),
      resolver: getEnvVar('NEXT_PUBLIC_BSC_RESOLVER_PRIVATE_KEY')
    },
    sui: {
      user: getEnvVar('NEXT_PUBLIC_SUI_USER_PRIVATE_KEY'),
      resolver: getEnvVar('NEXT_PUBLIC_SUI_RESOLVER_PRIVATE_KEY')
    }
  },
  
  features: {
    orderPool: getEnvVar('NEXT_PUBLIC_ENABLE_ORDER_POOL') === 'true',
    crossChain: getEnvVar('NEXT_PUBLIC_ENABLE_CROSS_CHAIN') === 'true',
    resolverSimulation: getEnvVar('NEXT_PUBLIC_ENABLE_RESOLVER_SIMULATION') === 'true',
    analytics: true,
    notifications: true,
    testMode: getEnvVar('NODE_ENV') === 'development'
  },
  
  api: {
    resolver: getEnvVar('NEXT_PUBLIC_RESOLVER_API_URL', 'http://localhost:3001'),
    analytics: getEnvVar('NEXT_PUBLIC_ANALYTICS_API_URL', 'http://localhost:3002')
  }
}

export const isDemoMode = getEnvVar('NEXT_PUBLIC_DEMO_MODE') === 'true'

export default DEMO_CONFIG
