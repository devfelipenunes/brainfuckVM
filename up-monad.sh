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

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: No credentials found.${NC}"
    echo -e "Please export the ${CYAN}PRIVATE_KEY${NC} environment variable."
    exit 1
fi


echo -e "${YELLOW}Deploying smart contracts to Monad Testnet...${NC}"
TEMP_DEPLOY_LOG=$(mktemp)

# Run forge script and capture output
PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --legacy -vv | tee "$TEMP_DEPLOY_LOG"

# 3. Extract VM + Registry, then deploy GlitchManager using the same VM
VM_ADDRESS=$(grep "BrainfuckVM:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')
REGISTRY_ADDRESS=$(grep "CartridgeRegistry:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')

PRIVATE_KEY=$PRIVATE_KEY VM_ADDRESS=$VM_ADDRESS forge script script/DeployGlitchManager.s.sol --rpc-url $RPC_URL --broadcast --legacy -vv | tee -a "$TEMP_DEPLOY_LOG"

GLITCH_ADDRESS=$(grep "GlitchManager:" "$TEMP_DEPLOY_LOG" | tail -n 1 | awk '{print $NF}')

rm "$TEMP_DEPLOY_LOG"

echo -e "${CYAN}----------------------------------------${NC}"
echo -e "${GREEN}✔ BrainfuckVM:      ${VM_ADDRESS:-Missing}${NC}"
echo -e "${GREEN}✔ CartridgeRegistry: ${REGISTRY_ADDRESS:-Missing}${NC}"
echo -e "${GREEN}✔ GlitchManager:    ${GLITCH_ADDRESS:-Missing}${NC}"
echo -e "${CYAN}----------------------------------------${NC}"

# 4. Inject addresses into legacy frontend
echo -e "${YELLOW}Injecting addresses into frontend/src/contracts.ts...${NC}"
sed -i "s/VM: '.*'/VM: '$VM_ADDRESS'/g" frontend/src/contracts.ts
sed -i "s/REGISTRY: '.*'/REGISTRY: '$REGISTRY_ADDRESS'/g" frontend/src/contracts.ts

if [ -n "$GLITCH_ADDRESS" ]; then
    # Appends or replaces VITE_GLITCH_ADDRESS
    if grep -q "VITE_GLITCH_ADDRESS=" frontend/.env; then
        sed -i "s/^VITE_GLITCH_ADDRESS=.*/VITE_GLITCH_ADDRESS=$GLITCH_ADDRESS/" frontend/.env
    else
        echo "VITE_GLITCH_ADDRESS=$GLITCH_ADDRESS" >> frontend/.env
    fi
    echo -e "${GREEN}✔ Injected VITE_GLITCH_ADDRESS into .env${NC}"

    # Dedicated glitch-app env
    if [ -f "frontend/glitch-app/.env" ]; then
        if grep -q "VITE_GLITCH_MANAGER_ADDRESS=" frontend/glitch-app/.env; then
            sed -i "s/^VITE_GLITCH_MANAGER_ADDRESS=.*/VITE_GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS/" frontend/glitch-app/.env
        else
            echo "VITE_GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS" >> frontend/glitch-app/.env
        fi
    else
        cat << EOF > frontend/glitch-app/.env
VITE_GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS
VITE_GATE_URL=http://localhost:8787
EOF
    fi
    echo -e "${GREEN}✔ Injected VITE_GLITCH_MANAGER_ADDRESS into glitch-app/.env${NC}"

    # Gate env
    if [ -f "glitch-gate/.env" ]; then
        if grep -q "GLITCH_MANAGER_ADDRESS=" glitch-gate/.env; then
            sed -i "s|^GLITCH_MANAGER_ADDRESS=.*|GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS|" glitch-gate/.env
        else
            echo "GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS" >> glitch-gate/.env
        fi
        if grep -q "MONAD_RPC_URL=" glitch-gate/.env; then
            sed -i "s|^MONAD_RPC_URL=.*|MONAD_RPC_URL=$RPC_URL|" glitch-gate/.env
        else
            echo "MONAD_RPC_URL=$RPC_URL" >> glitch-gate/.env
        fi
    else
        cat << EOF > glitch-gate/.env
MONAD_RPC_URL=$RPC_URL
GLITCH_MANAGER_ADDRESS=$GLITCH_ADDRESS
EOF
    fi
    echo -e "${GREEN}✔ Injected GLITCH_MANAGER_ADDRESS into glitch-gate/.env${NC}"
fi

# 5. Start Dedicated Glitch Frontend
echo -e "${YELLOW}Setting up glitch-app...${NC}"
if [ ! -d "frontend/glitch-app/node_modules" ]; then
    echo "Installing glitch-app dependencies..."
    (cd frontend/glitch-app && npm install)
fi

echo -e "${GREEN}🚀 Glitch app is ready! Starting development server...${NC}"
echo -e "${BLUE}Open http://localhost:5173 to use the app.${NC}"
cd frontend/glitch-app && npm run dev
