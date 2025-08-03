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

echo -e "${BLUE}🚀 Starting demo services...${NC}"

# 檢查必要工具
if ! command -v anvil &> /dev/null; then
    echo -e "${RED}❌ anvil not found. Please install Foundry: https://getfoundry.sh/${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# 創建日志目錄
mkdir -p demo/logs

# 清理函數
cleanup() {
    echo -e "\n${YELLOW}Cleaning up services...${NC}"
    
    if [ ! -z "$BSC_PID" ]; then
        echo "Stopping BSC fork node (PID: $BSC_PID)..."
        kill $BSC_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Services stopped${NC}"
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
echo -e "${BLUE}📍 Sui Testnet: https://fullnode.testnet.sui.io${NC}"

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
    echo -e "${YELLOW}⚠️ Sui testnet connection failed (check internet)${NC}"
fi

echo -e "\n${GREEN}🎉 Services are ready!${NC}"
echo -e "${BLUE}📍 BSC Fork: http://localhost:$BSC_PORT (Chain ID: 56)${NC}"
echo -e "${BLUE}📍 Sui Testnet: https://fullnode.testnet.sui.io${NC}"

echo -e "\n${BLUE}Demo accounts (BSC):${NC}"
echo "Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo -e "\n${GREEN}Services ready! Press Ctrl+C to stop all services${NC}"

# 保持腳本運行
while true; do
    sleep 30
    # 檢查服務是否還在運行
    if ! kill -0 $BSC_PID 2>/dev/null; then
        echo -e "${RED}❌ BSC fork node stopped unexpectedly${NC}"
        break
    fi
done