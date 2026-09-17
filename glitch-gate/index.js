import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { ethers } from 'ethers'
import { Server } from 'stellar-sdk'

dotenv.config()

const {
  PORT = '8787',
  STELLAR_HORIZON_URL,
  STELLAR_ASSET_CODE,
  STELLAR_ASSET_ISSUER,
  STELLAR_MIN_BALANCE = '1',
  MONAD_RPC_URL,
  MONAD_PRIVATE_KEY,
  GLITCH_MANAGER_ADDRESS,
} = process.env

const missing = [
  'STELLAR_HORIZON_URL',
  'STELLAR_ASSET_CODE',
  'STELLAR_ASSET_ISSUER',
  'MONAD_RPC_URL',
  'MONAD_PRIVATE_KEY',
  'GLITCH_MANAGER_ADDRESS',
].filter((key) => !process.env[key])

if (missing.length) {
  console.warn(`Missing env vars: ${missing.join(', ')}`)
}

const app = express()
app.use(cors())
app.use(express.json())

const horizon = STELLAR_HORIZON_URL ? new Server(STELLAR_HORIZON_URL) : null
const provider = MONAD_RPC_URL ? new ethers.JsonRpcProvider(MONAD_RPC_URL) : null
const signer = MONAD_PRIVATE_KEY && provider ? new ethers.Wallet(MONAD_PRIVATE_KEY, provider) : null
const contract = signer && GLITCH_MANAGER_ADDRESS
  ? new ethers.Contract(
      GLITCH_MANAGER_ADDRESS,
      ['function authorizeDev(address dev, bool allowed)'],
      signer,
    )
  : null

const minBalance = Number.parseFloat(STELLAR_MIN_BALANCE)

async function hasZolvencyDevToken(stellarPublicKey) {
  if (!horizon) {
    throw new Error('Stellar server not configured')
  }
  const account = await horizon.loadAccount(stellarPublicKey)
  return account.balances.some((balance) => {
    if (balance.asset_code !== STELLAR_ASSET_CODE) return false
    if (balance.asset_issuer !== STELLAR_ASSET_ISSUER) return false
    return Number.parseFloat(balance.balance) >= minBalance
  })
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/authorize', async (req, res) => {
  try {
    const { stellarPublicKey, evmAddress } = req.body || {}
    if (!stellarPublicKey || !evmAddress) {
      return res.status(400).json({ error: 'stellarPublicKey and evmAddress are required' })
    }
    if (!contract) {
      return res.status(500).json({ error: 'Gate server not configured' })
    }
    if (!ethers.isAddress(evmAddress)) {
      return res.status(400).json({ error: 'Invalid EVM address' })
    }

    const valid = await hasZolvencyDevToken(stellarPublicKey)
    if (!valid) {
      return res.status(403).json({ error: 'Zolvency dev token not found' })
    }

    const tx = await contract.authorizeDev(evmAddress, true)
    const receipt = await tx.wait()

    return res.json({ ok: true, txHash: receipt?.hash || tx.hash })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authorization failed'
    return res.status(500).json({ error: msg })
  }
})

app.listen(Number(PORT), () => {
  console.log(`Glitch gate running on :${PORT}`)
})
