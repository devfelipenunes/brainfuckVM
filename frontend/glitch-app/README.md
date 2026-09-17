# Zolvency Glitch App

Dedicated frontend for the Zolvency dev-gated Glitch Protocol.

## Setup

1. Copy the env file and fill values:

```
cp .env.example .env
```

2. Install dependencies:

```
npm install
```

3. Run dev server:

```
npm run dev
```

## Env vars

- VITE_GLITCH_MANAGER_ADDRESS: Deployed GlitchManager address on Monad
- VITE_GATE_URL: Zolvency gate API URL (see /glitch-gate)
- VITE_OPENAI_API_KEY: OpenAI API key for dynamic cards

## Notes

- The UI expects the GlitchManager contract to expose getDailyStatus and dev authorization.
- Dev access is granted by the gate API after Stellar validation.
