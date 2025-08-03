#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying contracts only (assumes services are running)...${NC}"
echo -e "${BLUE}📋 Using exact same logic as cross-chain-sui.spec.ts beforeAll${NC}"
echo ""

# 檢查服務是否運行
echo -e "${BLUE}Checking if services are running...${NC}"

# 檢查 BSC fork
if ! curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
   http://localhost:8545 > /dev/null; then
    echo -e "${RED}❌ BSC fork node is not running at http://localhost:8545${NC}"
    echo -e "${YELLOW}Please start it first: anvil --fork-url https://bsc-dataseed1.binance.org --port 8545${NC}"
    exit 1
fi

# 檢查 Sui testnet
echo "Testing Sui testnet connection..."
if ! curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"sui_getLatestSuiSystemState","params":[],"id":1}' \
   https://fullnode.testnet.sui.io > /dev/null; then
    echo -e "${YELLOW}⚠️ Sui testnet connection failed (check internet)${NC}"
    echo -e "${YELLOW}Continuing with BSC-only deployment...${NC}"
else
    echo -e "${GREEN}✅ Sui testnet is accessible${NC}"
fi

echo -e "${GREEN}✅ Services are ready${NC}"

# 部署合約
echo -e "\n${BLUE}📦 Deploying all contracts...${NC}"

if node demo/deploy-all-contracts.js; then
    echo -e "\n${GREEN}✅ All contracts deployed successfully!${NC}"
    
    if [ -f demo/deployment-config.json ]; then
        echo -e "\n${BLUE}📋 Configuration saved to: demo/deployment-config.json${NC}"
        
        # 顯示關鍵信息
        if command -v jq &> /dev/null; then
            echo -e "\n${BLUE}📄 Contract Addresses:${NC}"
            echo "BSC EscrowFactory: $(jq -r '.bsc.escrowFactory' demo/deployment-config.json)"
            echo "BSC Resolver: $(jq -r '.bsc.resolver' demo/deployment-config.json)"
            echo "Sui Package: $(jq -r '.sui.packageId' demo/deployment-config.json)"
            echo "Sui Factory: $(jq -r '.sui.factoryId' demo/deployment-config.json)"
            echo "Sui OrderPool: $(jq -r '.sui.poolId' demo/deployment-config.json)"
        fi
    fi
    
    echo -e "\n${BLUE}🚀 Next Steps:${NC}"
    echo "1. Run tests: pnpm test --testNamePattern='should demonstrate complete Fusion'"
    echo "2. Or start UI demo and connect to these contracts"
    
else
    echo -e "\n${RED}❌ Contract deployment failed!${NC}"
    echo -e "${YELLOW}Check the logs above for error details${NC}"
    exit 1
fi