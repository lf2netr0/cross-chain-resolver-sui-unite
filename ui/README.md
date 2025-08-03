# MoveB

MoveB is a cross-chain bridge interface connecting BSC (Binance Smart Chain) and Sui networks. Built with Next.js and supporting both EVM and Sui wallets, MoveB provides a seamless interface for cross-chain token swapping and bridging.


## Features

- **Cross-Chain Bridging**: Bridge tokens between BSC and Sui networks
- **Sui Wallet Standard Support**: Full integration with Sui Wallet Standard for multi-wallet compatibility
- **OrderPool System**: Competitive resolver bidding for cross-chain swaps
- **Fusion+ Compatible**: Complete alignment with 1inch Fusion+ protocol
- **HTLC Security**: Hash Time-Locked Contracts ensure atomic swap safety
- **Multi-Network Support**: Sui Mainnet, Testnet, and Devnet
- **Token Swapping**: Swap tokens across different blockchains
- **Multi-chain Portfolio**: Track your assets across BSC and Sui
- **Responsive Design**: Fully responsive interface for desktop and mobile
- **Modern UI**: Clean, intuitive design with cyan-teal color scheme

## Technologies

- **Frontend**: Next.js 14 (App Router), React 18
- **Styling**: Tailwind CSS, shadcn/ui components
- **EVM Wallet Connection**: RainbowKit, wagmi
- **Sui Wallet Connection**: @mysten/wallet-standard, @mysten/dapp-kit
- **Sui Blockchain**: @mysten/sui (client & transactions)
- **State Management**: React Context API
- **Data Fetching**: TanStack Query (React Query)
- **Blockchain Interaction**: viem (EVM), Sui Client (Sui)
- **Type Safety**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- A WalletConnect Project ID (for wallet connections)

### Installation

1. Clone the repository


2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the root directory with your WalletConnect Project ID:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

4. Start the development server:
   ```bash
   pnpm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
MoveB/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout component
│   ├── page.tsx            # Home page
│   ├── page-client.tsx     # Client-side home page component
│   ├── client-layout.tsx   # Client-side layout with providers
│   ├── metadata.ts         # App metadata
│   ├── globals.css         # Global styles
│   ├── rainbowkit.css      # RainbowKit custom styles
│   ├── pair/               # Token pair pages
│   ├── portfolio/          # Portfolio page
│   ├── pools/              # Liquidity pools page
│   └── token/              # Token detail pages
├── components/             # React components
│   ├── ui/                 # UI components (shadcn/ui)
│   ├── navbar.tsx          # Navigation bar
│   ├── footer.tsx          # Footer component
│   ├── swap-interface.tsx  # Main swap interface
│   ├── token-selector.tsx  # Token selection component
│   ├── token-provider.tsx  # Token data provider
│   ├── connect-wallet-button.tsx # Wallet connection button
│   ├── settings-dialog.tsx # Settings dialog
│   ├── recent-transactions.tsx # Recent transactions list
│   └── ...                 # Other components
├── config/                 # Configuration files
│   └── rainbow-kit.ts      # RainbowKit configuration
├── contexts/               # React context providers
│   └── wallet-context.tsx  # Wallet context provider
├── hooks/                  # Custom React hooks
│   ├── use-wallet-info.ts  # Hook for wallet information
│   └── use-wallet-connection.ts # Hook for wallet connection
├── lib/                    # Utility functions
│   └── utils.ts            # General utilities
├── public/                 # Static assets
│   ├── rainbowkit.css      # RainbowKit styles
│   └── ...                 # Images and other assets
├── services/               # Service modules
│   └── price-service.ts    # Token price service
├── next.config.mjs         # Next.js configuration
├── package.json            # Project dependencies
├── tailwind.config.ts      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Key Components

### Swap Interface

The main swap interface allows users to exchange tokens. It includes:
- Token selection
- Amount input
- Price information
- Slippage settings
- Transaction confirmation

### Wallet Connection

MoveB uses RainbowKit for wallet connections, supporting:
- MetaMask
- Coinbase Wallet
- WalletConnect
- And many other popular wallets

### Portfolio View

The portfolio page displays:
- Token balances
- Token values
- Price changes
- Transaction history

### Liquidity Pools

The pools page shows:
- Available liquidity pools
- TVL (Total Value Locked)
- APR (Annual Percentage Rate)
- User's liquidity positions

## Development

### Adding New Features

1. Create new components in the `components/` directory
2. Add new pages in the `app/` directory
3. Update context providers as needed

### Styling

MoveB uses Tailwind CSS for styling. The main theme colors and styles are defined in:
- `app/globals.css`
- `tailwind.config.ts`

### Adding New Tokens

To add new tokens, update the token list in `components/token-provider.tsx`.

## Deployment

### Vercel Deployment

The easiest way to deploy MoveB is using Vercel:

1. Push your code to a GitHub repository
2. Import the project in Vercel
3. Set the environment variables (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID)
4. Deploy

### Docker Deployment

You can also deploy MoveB using Docker:

1. Build the Docker image:
   ```bash
   docker build -t MoveB .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 -e NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here MoveB
   ```

## Testing

### Running Tests

To run the tests:

```bash
pnpm test
```

### Testing Wallet Connections

For testing wallet connections, you can use the following test wallets:

- MetaMask: Install the MetaMask browser extension and create a test account
- Coinbase Wallet: Install the Coinbase Wallet browser extension
- For other wallets, you can use their respective test environments

## Sui Wallet Integration

MoveB includes comprehensive Sui wallet support following the Wallet Standard:

### Supported Features
- **Multi-Wallet Support**: Automatically detects and connects to any Sui Wallet Standard compatible wallet
- **Network Switching**: Support for Sui Mainnet, Testnet, and Devnet
- **Transaction Signing**: Full support for Sui transaction signing and execution
- **Balance Tracking**: Real-time balance updates for connected accounts
- **OrderPool Integration**: Direct interaction with Sui cross-chain OrderPool contracts

### Available Pages
- `/sui-demo` - Comprehensive Sui wallet feature demonstration
- `/cross-chain` - Cross-chain swap interface with OrderPool integration

### Components
- `SuiWalletProvider` - Context provider for wallet state management
- `SuiWalletConnection` - Main wallet connection interface
- `SuiNetworkSwitcher` - Network switching component
- `SuiOrderPool` - Cross-chain order creation and management

### Usage Example
```tsx
import { SuiWalletProvider, useSuiWallet } from './components/sui-wallet-provider'

function MyComponent() {
  const { connect, isConnected, signAndExecuteTransaction } = useSuiWallet()
  
  // Use wallet functionality
}
```

## Security

MoveB implements several security measures:

- All transactions require explicit user confirmation
- No private keys are stored in the application
- All connections are secured with HTTPS
- Smart contract interactions are validated before execution
- Hash Time-Locked Contracts (HTLC) for atomic cross-chain swaps
- Multi-signature validation for order execution

## Performance Optimization

The application is optimized for performance:

- Code splitting for faster initial load
- Dynamic imports for components
- Memoization of expensive calculations
- Optimized images and assets
- Server-side rendering where appropriate

## Internationalization

MoveB supports multiple languages:

- English (default)
- Spanish
- French
- German
- Chinese
- Japanese

To change the language, use the language selector in the settings menu.

## Accessibility

MoveB is designed to be accessible to all users:

- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support
- High contrast mode



## Troubleshooting

### Common Issues

1. **Wallet Connection Issues**
   - Make sure your wallet is unlocked
   - Check that you're on the correct network
   - Try refreshing the page

2. **Transaction Failures**
   - Ensure you have enough funds for gas
   - Check slippage tolerance settings
   - Verify token approvals

3. **UI Display Issues**
   - Clear browser cache
   - Try a different browser
   - Check for browser extensions that might interfere


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [RainbowKit](https://www.rainbowkit.com/)
- [wagmi](https://wagmi.sh/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [viem](https://viem.sh/)
- [TanStack Query](https://tanstack.com/query)

---

Made with ❤️ by the MoveB Team
