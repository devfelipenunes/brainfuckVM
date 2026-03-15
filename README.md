# 🧠 Brainfuck VM & BF Console — Monad On-Chain

> **A high-performance on-chain Brainfuck interpreter in Solidity + a game registry and console platform.**
> Built with [Foundry](https://book.getfoundry.sh/) • Targeting [Monad Testnet](https://monad.xyz/)

## Architecture

The project features a modular architecture where the VM serves as the execution engine for a "Cartridge Registry" system, and conceptually can be used for L2 rollups.

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
| `BrainfuckL2.sol` | Conceptual L2 rollup — batch submission, fraud proofs, state finalization. |

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
