#!/bin/bash

echo "🚀 Setting up Sui Localnet for Cross-Chain Testing"
echo "=================================================="

# Check if sui is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Please install Sui first:"
    echo "   https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi

echo "✅ Sui CLI found"

# Stop any existing localnet
echo "🛑 Stopping any existing localnet..."
sui stop > /dev/null 2>&1 || true

# Start fresh localnet
echo "🚀 Starting fresh Sui localnet..."
sui start &
LOCALNET_PID=$!

# Wait for localnet to start
echo "⏳ Waiting for localnet to initialize..."
sleep 10

# Check if localnet is running
if ! curl -s http://127.0.0.1:9000 > /dev/null; then
    echo "❌ Failed to start localnet. Please check your Sui installation."
    exit 1
fi

echo "✅ Localnet started successfully"

# Get account addresses for funding
echo "💰 Getting account addresses for funding..."

# These are the test addresses from the test file
RESOLVER_ADDRESS="0x12647ac3d891392c70d44413cd64416b12706f36c7a1c451bede148d6113f842"
USER_ADDRESS="0x2e34514ae6a2d43305e91d5253138e8312429fc88a30f0f56a5932ca1ddfcd5b"

echo "🔑 Resolver address: $RESOLVER_ADDRESS"
echo "🔑 User address: $USER_ADDRESS"

# Fund accounts
echo "💸 Funding resolver account..."
sui client faucet --address $RESOLVER_ADDRESS

echo "💸 Funding user account..."
sui client faucet --address $USER_ADDRESS

# Additional funding for gas-intensive operations
echo "💸 Adding extra funding for package publishing..."
sui client faucet --address $RESOLVER_ADDRESS
sui client faucet --address $USER_ADDRESS

echo ""
echo "✅ Sui Localnet Setup Complete!"
echo "================================"
echo "🌐 RPC URL: http://127.0.0.1:9000"
echo "📝 Explorer: http://127.0.0.1:9001"
echo "💰 Resolver: $RESOLVER_ADDRESS"
echo "💰 User: $USER_ADDRESS"
echo ""
echo "🧪 Now you can run the tests:"
echo "   pnpm test tests/cross-chain-sui.spec.ts"
echo ""
echo "⚠️  Keep this terminal open to maintain the localnet"
echo "    Press Ctrl+C to stop the localnet when done"

# Keep the script running to maintain localnet
wait $LOCALNET_PID 