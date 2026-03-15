# 🧠 Brainfuck VM — On-Chain Interpreter & L2 Rollup

> **An on-chain Brainfuck interpreter in Solidity + a conceptual L2 rollup using the BF VM as its execution engine.**
> Built with [Foundry](https://book.getfoundry.sh/) • Targeting [Monad Testnet](https://monad.xyz/)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   BrainfuckL2.sol                    │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Sequencer │  │ Fraud Proofs │  │ Finalization │  │
│  │  Batches  │  │  (Challenge) │  │  (State Root)│  │
│  └─────┬─────┘  └──────┬───────┘  └──────────────┘  │
│        │               │                             │
│        └───────┬───────┘                             │
│                ▼                                     │
│        ┌──────────────┐                              │
│        │ BrainfuckVM  │  ← On-chain execution        │
│        │  .execute()  │                              │
│        └──────────────┘                              │
└─────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `BrainfuckVM.sol` | Full on-chain Brainfuck interpreter (all 8 commands, configurable tape, step limit) |
| `BrainfuckL2.sol` | Conceptual L2 rollup — batch submission, fraud proofs, state finalization |

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- For deployment: MON tokens from [Monad Testnet Faucet](https://faucet.monad.xyz/)

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test -vvv

# Run VM tests only
forge test --match-contract BrainfuckVMTest -vvv

# Run L2 tests only
forge test --match-contract BrainfuckL2Test -vvv
```

### Deploy to Monad Testnet

```bash
# 1. Copy env template
cp .env.example .env

# 2. Edit .env with your private key
#    PRIVATE_KEY=your_private_key_here

# 3. Load env vars
source .env

# 4. Deploy
forge script script/Deploy.s.sol \
  --rpc-url $MONAD_TESTNET_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

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

## Example Programs

### Hello World
```
++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.
```

### Add Two Numbers
```
,>,[<+>-]<.
```

### Echo Input
```
,[.,]
```

## L2 Flow

1. **Sequencer** submits a batch of BF programs with inputs, expected outputs, and a new state root
2. During the **challenge period** (100 blocks), anyone can challenge a transaction by re-executing the BF program on-chain
3. If the on-chain output differs from the committed output → **fraud detected** → batch invalidated
4. After the challenge period, the batch is **finalized** and the state root is updated

## Monad Testnet

| Property | Value |
|----------|-------|
| Chain ID | `10143` |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadexplorer.com` |

## License

MIT
# brainfuckVM
