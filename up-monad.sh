#!/bin/bash

# Configuration
RPC_URL="https://testnet-rpc.monad.xyz"

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Monad Brainfuck VM - Testnet Setup   ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check for dependencies
if ! command -v forge &> /dev/null; then
    echo -e "${YELLOW}Error: forge is not installed. Please install Foundry.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}Error: npm is not installed. Please install Node.js.${NC}"
    exit 1
fi

# Check for Credentials (Private Key or Mnemonic)
if [ -f "seed.txt" ]; then
    echo -e "${GREEN}✔ Found seed.txt, deriving private key...${NC}"
    # Read the mnemonic from seed.txt and get the private key
    # Using 'head -n 1' to avoid any trailing newlines or extra text
    PRIVATE_KEY=$(cast wallet private-key --mnemonic seed.txt | tail -n 1)
elif [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: No credentials found.${NC}"
    echo -e "Please create a ${CYAN}seed.txt${NC} file with your mnemonic or set the ${CYAN}PRIVATE_KEY${NC} environment variable."
    exit 1
fi

# 1. Check if contracts exist
echo -e "${YELLOW}Checking if contracts are already deployed...${NC}"
CURRENT_VM=$(grep -oP "VM:\s*'\K[^']+" frontend/src/contracts.ts | head -n 1)
CURRENT_REGISTRY=$(grep -oP "REGISTRY:\s*'\K[^']+" frontend/src/contracts.ts | head -n 1)
SKIP_DEPLOY=""

if [ -n "$CURRENT_VM" ] && [ -n "$CURRENT_REGISTRY" ] && [ "$CURRENT_VM" != "0x" ] && [ "$CURRENT_REGISTRY" != "0x" ]; then
    VM_CODE=$(cast code $CURRENT_VM --rpc-url $RPC_URL 2>/dev/null || echo "0x")
    REGISTRY_CODE=$(cast code $CURRENT_REGISTRY --rpc-url $RPC_URL 2>/dev/null || echo "0x")
    
    if [ "$VM_CODE" != "0x" ] && [ "$REGISTRY_CODE" != "0x" ]; then
        echo -e "${GREEN}✔ Contracts already deployed!${NC}"
        SKIP_DEPLOY=1
        VM_ADDRESS=$CURRENT_VM
        REGISTRY_ADDRESS=$CURRENT_REGISTRY
        
        echo -e "${CYAN}----------------------------------------${NC}"
        echo -e "${GREEN}✔ BrainfuckVM:      $VM_ADDRESS${NC}"
        echo -e "${GREEN}✔ CartridgeRegistry: $REGISTRY_ADDRESS${NC}"
        echo -e "${CYAN}----------------------------------------${NC}"
    fi
fi

if [ -z "$SKIP_DEPLOY" ]; then
    # 2. Deploy Contracts
    echo -e "${YELLOW}Deploying smart contracts to Monad Testnet...${NC}"
    TEMP_DEPLOY_LOG=$(mktemp)
    # Run forge script and capture output
    # We export PRIVATE_KEY here so the Solidity script vm.envUint("PRIVATE_KEY") works
    PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast -vv | tee "$TEMP_DEPLOY_LOG"

    # 3. Extract addresses
    VM_ADDRESS=$(grep "BrainfuckVM:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')
    REGISTRY_ADDRESS=$(grep "CartridgeRegistry:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')

    rm "$TEMP_DEPLOY_LOG"

    if [ -z "$VM_ADDRESS" ] || [ -z "$REGISTRY_ADDRESS" ]; then
        echo -e "${RED}Error: Could not extract contract addresses from deployment output.${NC}"
        exit 1
    fi

    echo -e "${CYAN}----------------------------------------${NC}"
    echo -e "${GREEN}✔ BrainfuckVM:      $VM_ADDRESS${NC}"
    echo -e "${GREEN}✔ CartridgeRegistry: $REGISTRY_ADDRESS${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"

    # 4. Inject addresses into frontend
    echo -e "${YELLOW}Injecting addresses into frontend/src/contracts.ts...${NC}"
    # Update VM and REGISTRY (not the _LOCAL ones)
    sed -i "s/VM: '.*'/VM: '$VM_ADDRESS'/g" frontend/src/contracts.ts
    sed -i "s/REGISTRY: '.*'/REGISTRY: '$REGISTRY_ADDRESS'/g" frontend/src/contracts.ts
fi

# 4. Start Frontend
echo -e "${YELLOW}Setting up frontend...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo -e "${GREEN}🚀 Application is ready! Starting frontend development server...${NC}"
echo -e "${BLUE}Open http://localhost:5173 to use the app.${NC}"
cd frontend && npm run dev
