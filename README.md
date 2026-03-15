# 🧠 Brainfuck VM & BF Console — Monad On-Chain

> **A high-performance on-chain Brainfuck interpreter in Solidity + a game registry and console platform.**
> Built with [Foundry](https://book.getfoundry.sh/) • Targeting [Monad Testnet](https://monad.xyz/)

## BF Console Architecture

The project features a modular architecture where the VM serves as the execution engine for a "Cartridge Registry" system.

```
┌─────────────────────────────────────────────────────┐
│                 CartridgeRegistry.sol               │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Games (Cart)│  │ Player State │  │ Persistence  │ │
│  │ Registration│  │    (Saves)   │  │ (On-chain)   │ │
│  └─────┬──────┘  └──────┬───────┘  └──────────────┘ │
│        │                │                           │
│        └────────┬───────┘                           │
│                 ▼                                   │
│        ┌────────────────┐                           │
│        │  BrainfuckVM   │  ← On-chain execution     │
│        │   .execute()   │                           │
│        └────────────────┘                           │
└─────────────────────────────────────────────────────┘
```

## Core Contracts

| Contract | Description |
|----------|-------------|
| `BrainfuckVM.sol` | Optimized on-chain interpreter (all 8 commands, 30,000 cell tape). |
| `CartridgeRegistry.sol` | Game management system. Handles game registration, persistent player saves, and game logic execution. |

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- MON tokens from [Monad Testnet Faucet](https://faucet.monad.xyz/)

### Build & Test

```bash
# Build contracts
forge build

# Run all tests (including Snake game tests)
forge test -vvv

# Run VM tests only
forge test --match-contract BrainfuckVMTest -vvv
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Features & Games

### 🐍 Snake Minimalista
100% On-chain Snake game logic on a 5x5 grid.
- **On-chain Validation:** Every move is verified by the VM.
- **Persistence:** Save your high score directly on Monad.
- **Interactive UI:** Smooth Canvas 2D rendering with retro d-pad controls.

### 🦠 Game of Life (3D Sphere)
High-performance cellular automaton stress test.
- Simulated on-chain via rapid `eth_call` static calls.
- Visualized in a 3D orbital sphere using Three.js.

### 🐾 Tamagotchi
Stateful pet simulation where actions (feed, play, sleep) update a persistent on-chain state.

### 🎲 Dice Roller
Stateless RNG math simulation executed purely via Brainfuck commands.

## Brainfuck Commands

| Command | Description |
|---------|-------------|
| `>` | Move data pointer right |
| `<` | Move data pointer left |
| `+` | Increment byte at data pointer |
| `-` | Decrement byte at data pointer |
| `.` | Output byte at data pointer |
| `,` | Read input byte to data pointer |
| `[` | Jump to matching `]` if byte is zero |
| `]` | Jump back to matching `[` if byte is non-zero |

## Monad Testnet Deployment

| Property | Value |
|----------|-------|
| Chain ID | `10143` |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadexplorer.com` |

## License

MIT
