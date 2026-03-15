# 🧠 Brainfuck VM & BF Console — Monad On-Chain

> **A high-performance on-chain Brainfuck interpreter in Solidity + a game registry and console platform.**
> Built with [Foundry](https://book.getfoundry.sh/) • Targeting [Monad Testnet](https://monad.xyz/)

## Architecture

The project features a modular architecture where the VM serves as the execution engine for a "Cartridge Registry" system, enabling complex logic to be executed on-chain via Brainfuck instructions.

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
| `BrainfuckVM.sol` | Optimized assembly on-chain interpreter (all 8 commands, 30,000 cell tape). |
| `CartridgeRegistry.sol` | Game management system. Handles game registration, persistent player saves, and game logic execution. |

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- MON tokens from [Monad Testnet Faucet](https://faucet.monad.xyz/)

### Build & Test

```bash
# Build contracts
forge build

# Run all tests
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

## Features

### 🏗️ Brainfuck Playground (Universal Console)
The ultimate environment for Monad developers. Write, debug, and execute any Brainfuck code directly on the blockchain. No limits, just pure code execution with real-time feedback.

## Available Games

### 🐾 Tamagochi
Stateful pet simulation where actions (feed, play, sleep) update a persistent on-chain state. Every interaction is a transaction on the Monad network.

### 🎲 Dice Roller
Stateless RNG math simulation executed purely via Brainfuck commands. It uses a seed from the frontend to calculate a random dice face on-chain.

### ✂️ Rock Scissors Paper
Classic Jokenpo against the machine. Each move is a real on-chain transaction validated by the Brainfuck VM.

## Monad Integration

- **Optimized for Monad**: Leverages the high throughput and low latency of the Monad blockchain for a smooth gaming experience.
- **On-chain Persistence**: Game states (like Tamagochi's hunger and happiness) are stored directly in the Monad EVM.
- **Explorer Feedback**: Integrated transaction logging with direct links to the [Monad Testnet Explorer](https://testnet.monadexplorer.com/) for transparency.

## Brainfuck Commands

| Command | Description |
|----------|-------------|
| `>` | Increment the data pointer |
| `<` | Decrement the data pointer |
| `+` | Increment the byte at the data pointer |
| `-` | Decrement the byte at the data pointer |
| `.` | Output the byte at the data pointer |
| `,` | Input a byte and store it at the data pointer |
| `[` | Jump to matching `]` if byte is zero |
| `]` | Jump back to matching `[` if byte is non-zero |

## License

MIT
