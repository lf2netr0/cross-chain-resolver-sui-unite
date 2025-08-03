#!/bin/bash

# Cross-Chain Demo Setup Script
# This script helps set up the demo environment quickly

set -e

echo "🚀 Setting up Cross-Chain Demo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the ui directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the ui/ directory${NC}"
    exit 1
fi

# Step 1: Copy environment template
echo -e "\n${BLUE}Step 1: Setting up environment variables...${NC}"
if [ ! -f ".env.local" ]; then
    if [ -f "env.demo.template" ]; then
        cp env.demo.template .env.local
        echo -e "${GREEN}✅ Created .env.local from template${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env.local with your contract addresses after deployment${NC}"
    else
        echo -e "${RED}❌ env.demo.template not found${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  .env.local already exists, skipping...${NC}"
fi

# Step 2: Install dependencies
echo -e "\n${BLUE}Step 2: Installing dependencies...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm install
    echo -e "${GREEN}✅ Dependencies installed with pnpm${NC}"
elif command -v npm &> /dev/null; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed with npm${NC}"
else
    echo -e "${RED}❌ Neither pnpm nor npm found. Please install Node.js first.${NC}"
    exit 1
fi

# Step 3: Check for required tools
echo -e "\n${BLUE}Step 3: Checking required tools...${NC}"

# Check for sui CLI
if command -v sui &> /dev/null; then
    echo -e "${GREEN}✅ Sui CLI found: $(sui --version)${NC}"
else
    echo -e "${YELLOW}⚠️  Sui CLI not found. Please install from: https://docs.sui.io/build/install${NC}"
fi

# Check for anvil/foundry
if command -v anvil &> /dev/null; then
    echo -e "${GREEN}✅ Anvil found: $(anvil --version | head -1)${NC}"
else
    echo -e "${YELLOW}⚠️  Anvil not found. Please install Foundry from: https://getfoundry.sh${NC}"
fi

# Step 4: Deploy contracts (optional)
echo -e "\n${BLUE}Step 4: Contract deployment...${NC}"
echo -e "${YELLOW}To deploy contracts, run from the project root:${NC}"
echo -e "${YELLOW}  ./demo/start-and-deploy.sh${NC}"
echo -e "${YELLOW}Then update .env.local with the deployed contract addresses.${NC}"

# Step 5: Final instructions
echo -e "\n${GREEN}🎉 Demo setup complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Deploy contracts: cd .. && ./demo/start-and-deploy.sh"
echo "2. Update .env.local with contract addresses from deployment"
echo "3. Start the UI: pnpm dev"
echo "4. Visit: http://localhost:3000/demo"

echo -e "\n${BLUE}📚 For detailed instructions, see: ../CROSS_CHAIN_DEMO_GUIDE.md${NC}"

echo -e "\n${GREEN}Happy swapping! 🔄${NC}"