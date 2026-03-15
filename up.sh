#!/bin/bash

# Configuration
RPC_URL="http://localhost:8545"
# Default Anvil Private Key #0
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Monad Brainfuck VM - Local Setup     ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check for dependencies
if ! command -v anvil &> /dev/null; then
    echo -e "${YELLOW}Error: anvil is not installed. Please install Foundry.${NC}"
    exit 1
fi

if ! command -v forge &> /dev/null; then
    echo -e "${YELLOW}Error: forge is not installed. Please install Foundry.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}Error: npm is not installed. Please install Node.js.${NC}"
    exit 1
fi

# 1. Start Anvil in the background
echo -e "${YELLOW}Starting Anvil with --monad...${NC}"
anvil --monad --host 0.0.0.0 > anvil.log 2>&1 &
ANVIL_PID=$!

# Ensure Anvil is killed when the script exits
cleanup() {
    echo -e "\n${YELLOW}Shutting down processes...${NC}"
    kill $ANVIL_PID 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

# 2. Wait for RPC to be ready
echo -n "Waiting for Anvil to start..."
while ! curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' $RPC_URL &> /dev/null; do
    echo -n "."
    sleep 1
done
echo -e "\n${GREEN}✔ Anvil is up and running!${NC}"

# 3. Deploy Contracts
echo -e "${YELLOW}Deploying smart contracts to local network...${NC}"
TEMP_DEPLOY_LOG=$(mktemp)
# Run forge script and capture output
PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast -vv | tee "$TEMP_DEPLOY_LOG"

# 4. Extract addresses from the summary section
# The summary looks like: "BrainfuckVM:       0x..."
VM_ADDRESS=$(grep "BrainfuckVM:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')
REGISTRY_ADDRESS=$(grep "CartridgeRegistry:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')

rm "$TEMP_DEPLOY_LOG"

if [ -z "$VM_ADDRESS" ] || [ -z "$REGISTRY_ADDRESS" ]; then
    echo -e "${YELLOW}Error: Could not extract contract addresses from deployment output.${NC}"
    kill $ANVIL_PID
    exit 1
fi

echo -e "${CYAN}----------------------------------------${NC}"
echo -e "${GREEN}✔ BrainfuckVM:      $VM_ADDRESS${NC}"
echo -e "${GREEN}✔ CartridgeRegistry: $REGISTRY_ADDRESS${NC}"
echo -e "${CYAN}----------------------------------------${NC}"

# 5. Fund specific address for testing
echo -e "${YELLOW}Sending 100 tokens to test address...${NC}"
TEST_ADDRESS="0xE8b51d27389d581b99D70656dE3c69d521485B5F"
cast send $TEST_ADDRESS --value 100ether --private-key $PRIVATE_KEY --rpc-url $RPC_URL > /dev/null
echo -e "${GREEN}✔ Funded $TEST_ADDRESS with 100 tokens${NC}"

# 6. Inject addresses into frontend
echo -e "${YELLOW}Injecting addresses into frontend/src/contracts.ts...${NC}"
# Use sed to update VM_LOCAL and REGISTRY_LOCAL
# We use a pattern that matches the variable name and updates the value
sed -i "s/VM_LOCAL: '.*'/VM_LOCAL: '$VM_ADDRESS'/g" frontend/src/contracts.ts
sed -i "s/REGISTRY_LOCAL: '.*'/REGISTRY_LOCAL: '$REGISTRY_ADDRESS'/g" frontend/src/contracts.ts

# 7. Start Frontend
echo -e "${YELLOW}Setting up frontend...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo -e "${GREEN}🚀 Application is ready! Starting frontend development server...${NC}"
echo -e "${BLUE}Open http://localhost:5173 to use the app.${NC}"
cd frontend && npm run dev
