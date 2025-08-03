#!/bin/bash

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing deployment script...${NC}"

# 檢查必要的編譯文件
if [ ! -d "dist/contracts" ]; then
    echo -e "${YELLOW}📦 Building contracts first...${NC}"
    forge build
fi

if [ ! -f "dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json" ]; then
    echo -e "${RED}❌ TestEscrowFactory contract not found. Run 'forge build' first.${NC}"
    exit 1
fi

if [ ! -f "dist/contracts/Resolver.sol/Resolver.json" ]; then
    echo -e "${RED}❌ Resolver contract not found. Run 'forge build' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract artifacts found${NC}"

# 啟動 demo 環境
echo -e "\n${BLUE}🚀 Starting demo environment...${NC}"
./demo/start-services.sh > demo/test-env.log 2>&1 &
ENV_PID=$!

echo "Environment started with PID: $ENV_PID"

# 等待服務啟動
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 15

# 檢查服務
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
   http://localhost:8545 > /dev/null; then
    echo -e "${GREEN}✅ BSC fork is ready${NC}"
else
    echo -e "${RED}❌ BSC fork is not responding${NC}"
    kill $ENV_PID 2>/dev/null
    exit 1
fi

# 測試部署腳本
echo -e "\n${BLUE}📦 Testing deployment script...${NC}"
if node demo/deploy-all-contracts.js; then
    echo -e "\n${GREEN}✅ Deployment script works!${NC}"
    
    # 檢查配置文件
    if [ -f "demo/deployment-config.json" ]; then
        echo -e "${GREEN}✅ Configuration file created${NC}"
        echo -e "\n${BLUE}📋 Deployment info:${NC}"
        
        if command -v jq &> /dev/null; then
            echo "BSC Factory: $(jq -r '.bsc.escrowFactory' demo/deployment-config.json)"
            echo "BSC Resolver: $(jq -r '.bsc.resolver' demo/deployment-config.json)"
            echo "Deployment Type: $(jq -r '.deploymentType' demo/deployment-config.json)"
        else
            echo "Configuration saved (install jq to see details)"
        fi
    fi
    
    DEPLOY_SUCCESS=true
else
    echo -e "\n${RED}❌ Deployment script failed${NC}"
    DEPLOY_SUCCESS=false
fi

# 清理
echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
kill $ENV_PID 2>/dev/null
sleep 3

if [ "$DEPLOY_SUCCESS" = true ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    echo -e "${GREEN}The deployment script is ready to use.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Tests failed${NC}"
    exit 1
fi