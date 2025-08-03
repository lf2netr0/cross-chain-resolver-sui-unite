#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
BSC_PORT=8545
SUI_PORT=9000

echo -e "${BLUE}🚀 Starting Cross-Chain Demo with Contract Deployment...${NC}"
echo -e "${BLUE}📋 This script will:${NC}"
echo -e "${BLUE}  1. Start BSC fork node${NC}"
echo -e "${BLUE}  2. Start Sui localnet${NC}"
echo -e "${BLUE}  3. Deploy all contracts (BSC + Sui)${NC}"
echo ""

# 檢查必要工具
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v anvil &> /dev/null; then
    echo -e "${RED}❌ anvil not found. Please install Foundry: https://getfoundry.sh/${NC}"
    exit 1
fi

if ! command -v sui &> /dev/null; then
    echo -e "${RED}❌ sui CLI not found. Please install Sui CLI${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# 創建日志目錄
mkdir -p demo/logs

# 清理函數
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    if [ ! -z "$BSC_PID" ]; then
        echo "Stopping BSC fork node (PID: $BSC_PID)..."
        kill $BSC_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Cleanup completed${NC}"
    exit 0
}

# 註冊清理函數
trap cleanup EXIT INT TERM

# Step 1: 啟動 BSC fork node
echo -e "\n${BLUE}Step 1: Starting BSC fork node...${NC}"
anvil \
    --fork-url https://bsc-dataseed1.binance.org \
    --chain-id 56 \
    --port $BSC_PORT \
    --host 0.0.0.0 \
    --accounts 10 \
    --balance 10000 \
    > demo/logs/bsc-fork.log 2>&1 &
BSC_PID=$!

echo "BSC fork node started with PID: $BSC_PID"

# Step 2: Sui uses testnet (no local node needed)
echo -e "\n${BLUE}Step 2: Sui testnet configuration...${NC}"
echo -e "${GREEN}✅ Using Sui testnet (no local node required)${NC}"

# 等待服務啟動
echo -e "\n${BLUE}Waiting for services to initialize...${NC}"
sleep 10

# 檢查 BSC fork
echo "Testing BSC fork connection..."
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
   http://localhost:$BSC_PORT > /dev/null; then
    echo -e "${GREEN}✅ BSC fork node is ready at http://localhost:$BSC_PORT${NC}"
else
    echo -e "${RED}❌ BSC fork node is not responding${NC}"
    exit 1
fi

# 檢查 Sui testnet 連接
echo "Testing Sui testnet connection..."
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"sui_getLatestSuiSystemState","params":[],"id":1}' \
   https://fullnode.testnet.sui.io > /dev/null; then
    echo -e "${GREEN}✅ Sui testnet is accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Sui testnet connection failed (but continuing)${NC}"
fi

echo -e "\n${GREEN}🎉 Both services are running!${NC}"

# Step 3: 部署合約
echo -e "\n${BLUE}Step 3: Deploying all contracts...${NC}"
echo -e "${BLUE}📋 Using exact same logic as cross-chain-sui.spec.ts beforeAll${NC}"

if node demo/deploy-all-contracts.js; then
    echo -e "\n${GREEN}✅ All contracts deployed successfully!${NC}"
    
    echo -e "\n${BLUE}📋 Deployment Summary:${NC}"
    if [ -f demo/deployment-config.json ]; then
        echo "Configuration saved to: demo/deployment-config.json"
        
        # 顯示關鍵信息
        echo -e "\n${BLUE}🔑 Key Information:${NC}"
        echo "📍 BSC Fork: http://localhost:$BSC_PORT (Chain ID: 56)"
        echo "📍 Sui Testnet: https://fullnode.testnet.sui.io"
        
        # 提取合約地址
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
    echo "3. Press Ctrl+C to stop all services"
    
    echo -e "\n${GREEN}🎯 Demo environment is ready! Services will keep running...${NC}"
    
    # 保持腳本運行
    while true; do
        sleep 30
        # 檢查服務是否還在運行
        if ! kill -0 $BSC_PID 2>/dev/null; then
            echo -e "${RED}❌ BSC fork node stopped unexpectedly${NC}"
            break
        fi
    done
    
else
    echo -e "\n${RED}❌ Contract deployment failed!${NC}"
    echo -e "${YELLOW}Check the logs above for error details${NC}"
    exit 1
fi