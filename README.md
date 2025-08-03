# 🌉 Cross-Chain Fusion+ Implementation

A decentralized cross-chain atomic swap protocol implementation using **Fusion+ mechanics** with support for **BSC** ↔ **Sui** token exchanges. This project demonstrates Hash Time-Locked Contracts (HTLC), competitive resolver networks, and advanced OrderPool mechanisms.

![Cross-Chain Demo](https://img.shields.io/badge/Demo-Live-brightgreen) ![BSC](https://img.shields.io/badge/BSC-Supported-yellow) ![Sui](https://img.shields.io/badge/Sui-Supported-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)

## 🚀 Features

### 🔄 **Cross-Chain Atomic Swaps**
- **BSC ↔ Sui** bidirectional token swaps
- **Hash Time-Locked Contracts (HTLC)** for security
- **Atomic execution** with automatic rollback on failure
- **Multi-timelock system** for progressive unlocking

### 🏊 **Advanced OrderPool System**
- **Competitive bidding** mechanism for resolvers
- **On-chain order matching** with automatic execution
- **Fusion+ compatible** order hash calculation
- **Real-time order tracking** and management

### 🛡️ **Security & Trust**
- **Cryptographic proofs** with secret revelation
- **Maker signature verification** for order authenticity
- **Immutable order parameters** with ObjectID binding
- **Timelock protection** against malicious activities

### 🎯 **Developer Experience**
- **Full TypeScript SDK** for both BSC and Sui
- **React components** for easy UI integration
- **Comprehensive testing suite** with mock environments
- **Real-time progress tracking** and error handling

## 🏗️ Architecture

### **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BSC Network   │    │  User Interface │    │   Sui Network   │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │  Factory  │  │◄───┤  │  Next.js  │  ├───►│  │OrderPool  │  │
│  │  Escrow   │  │    │  │   dApp    │  │    │  │  Escrow   │  │
│  │ Resolver  │  │    │  │ Wallets   │  │    │  │ Factory   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Demo Resolver   │
                    │ (Mock/Live)     │
                    └─────────────────┘
```

### **Core Components**

| Component | Network | Description |
|-----------|---------|-------------|
| **EscrowFactory** | BSC | Creates and manages escrow contracts |
| **Resolver** | BSC | Handles secret revelation and withdrawals |
| **OrderPool** | Sui | Manages competitive order bidding |
| **EscrowFactory** | Sui | Creates time-locked escrow objects |
| **CrossChainClient** | Both | Unified API for blockchain interactions |
| **DemoResolver** | Frontend | Simulated resolver for testing |

## 🛠️ Tech Stack

### **Blockchain**
- 🔗 **BSC**: Solidity smart contracts with Hardhat
- 🔗 **Sui**: Move smart contracts with Sui CLI
- 🔐 **HTLC**: Hash Time-Locked Contract implementation
- 🎯 **EIP-712**: Typed data signing (BSC) / BCS serialization (Sui)

### **Frontend**
- ⚛️ **Next.js 14**: React framework with App Router
- 🎨 **Tailwind CSS**: Utility-first styling
- 🧩 **shadcn/ui**: Modern component library
- 🔌 **Wagmi**: Ethereum React hooks
- 🌊 **Sui dApp Kit**: Sui React components

### **Development**
- 📘 **TypeScript**: Full type safety
- 🧪 **Vitest**: Fast unit testing
- 🔍 **ESLint + Prettier**: Code quality
- 📦 **pnpm**: Fast package management

## ⚡ Quick Start

### **1. Prerequisites**

```bash
# Install Node.js 22+ and pnpm
node --version  # Should be 22+
pnpm --version  # Should be 8+

# Install Sui CLI
curl -fsSL https://sui.io/install.sh | sh
sui --version

# Install Foundry (for BSC contracts)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### **2. Clone & Install**

```bash
git clone https://github.com/your-org/cross-chain-fusion.git
cd cross-chain-fusion

# Install dependencies
pnpm install

# Build contracts
pnpm build
```

### **3. Start Demo**

```bash
# Setup demo environment
cd ui
cp env.demo.template .env.local

# Start development server
pnpm dev

# Open http://localhost:3000/demo
```

> 🎉 **Demo Mode**: The app will run in mock mode with simulated transactions for immediate testing!

## 🔧 Configuration

### **Environment Variables**

Create `ui/.env.local` from the template:

```bash
# Demo Configuration
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ENABLE_RESOLVER_SIMULATION=true

# BSC Configuration
NEXT_PUBLIC_BSC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_BSC_CHAIN_ID=31337
NEXT_PUBLIC_BSC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_BSC_RESOLVER_ADDRESS=0x...

# Sui Configuration  
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io
NEXT_PUBLIC_SUI_PACKAGE_ID=0x...
NEXT_PUBLIC_SUI_POOL_ID=0x...

# Demo Resolver Keys (DO NOT USE IN PRODUCTION)
NEXT_PUBLIC_BSC_RESOLVER_PRIVATE_KEY=0x...
NEXT_PUBLIC_SUI_RESOLVER_PRIVATE_KEY=...

# WalletConnect (Optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## 🚀 Usage

### **Demo Mode (Recommended for First Time)**

```bash
cd ui
pnpm dev

# Open http://localhost:3000/demo
# Connect MetaMask and Sui Wallet
# Try a cross-chain swap!
```

### **SDK Usage**

```typescript
import { CrossChainClient } from './lib/cross-chain-client'
import { getDemoResolver } from './lib/demo-resolver'

// Initialize client
const client = new CrossChainClient(
  null, // Use browser wallet
  null, // Use browser wallet
  walletClient, // from wagmi
  suiWallet // from @mysten/dapp-kit
)

// Get demo resolver
const resolver = getDemoResolver()

// Create a Sui → BSC swap
const orderHash = await client.createSuiFusionOrderInPool({
  maker: '0x...',
  token: '0x2::sui::SUI',
  amount: '1000000000', // 1 SUI
  price: '2000000', // 2 USDC
  timelock: Math.floor(Date.now() / 1000) + 3600
})

// Resolver will automatically process the order
console.log('Order created:', orderHash)
```

## 🧪 Testing

### **Run All Tests**

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Sui Move tests
cd sui
sui move test

# BSC contract tests
cd bsc
npx hardhat test
```

## 🔄 Swap Flow

### **Sui → BSC Swap Process**

1. **User creates order** in Sui OrderPool with SUI tokens
2. **Resolver takes order** and creates source escrow on Sui
3. **Resolver creates destination escrow** on BSC with USDC
4. **Resolver reveals secret** and withdraws SUI from source escrow
5. **User uses secret** to withdraw USDC from destination escrow
6. **✅ Swap completed** successfully

### **Security Mechanisms**

- **Hashlock Protection**: Secret required for withdrawals
- **Timelock Safety**: Automatic refund after expiration
- **Atomic Execution**: All-or-nothing transaction completion
- **Signature Verification**: Maker authentication for order creation
- **Immutable Parameters**: Prevent order modification after creation

## 🏗️ Development

### **Project Structure**

```
cross-chain-fusion/
├── sui/                    # Sui Move contracts
│   ├── sources/
│   │   ├── order_pool.move      # OrderPool implementation
│   │   ├── escrow_factory.move  # Escrow creation
│   │   └── timelock.move        # Time management
│   └── tests/              # Move unit tests
├── bsc/                    # BSC Solidity contracts
│   ├── contracts/
│   │   ├── EscrowFactory.sol    # Escrow creation
│   │   └── Resolver.sol         # Secret revelation
│   └── test/               # Solidity tests
├── ui/                     # Next.js frontend
│   ├── app/                # App router pages
│   ├── components/         # React components
│   ├── lib/                # Utility libraries
│   └── tests/              # Frontend tests
├── tests/                  # Integration tests
└── demo/                   # Demo scripts
```

## 🚢 Deployment

### **Testnet Deployment**

```bash
# Deploy to testnets
cd demo
./deploy-all-contracts.sh

# Update environment variables
cp ui/.env.local.example ui/.env.local
# Fill in deployed contract addresses

# Start UI
cd ui && pnpm dev
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Setup**

```bash
# Fork the repository
git clone https://github.com/your-username/cross-chain-fusion.git

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
pnpm test

# Submit pull request
git push origin feature/your-feature-name
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **1inch Team**: For the Fusion+ protocol design and inspiration
- **Sui Foundation**: For the innovative Move language and blockchain
- **BSC Community**: For the robust EVM-compatible infrastructure
- **Open Source Contributors**: For the amazing tools and libraries used

---

**Built with ❤️ for the decentralized future**

*Cross-chain interoperability made simple, secure, and accessible to everyone.*