# Glitch Gate

Backend service to validate Stellar Zolvency dev tokens and authorize EVM wallets on Monad.

## Setup

1. Copy the env file and fill values:

```
cp .env.example .env
```

2. Install dependencies:

```
npm install
```

3. Start server:

```
npm run dev
```

## Endpoint

- POST /authorize
  - body: { "stellarPublicKey": "G...", "evmAddress": "0x..." }
  - response: { ok: true, txHash }

## Notes

- The server uses the MONAD_PRIVATE_KEY to call authorizeDev on GlitchManager.
- Update STELLAR_ASSET_CODE and STELLAR_ASSET_ISSUER for the Zolvency token.
- Add auth and signature checks for production use.
