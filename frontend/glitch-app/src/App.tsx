import { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { generateGlitchCard } from './openai'
import { connectFreighter } from './stellar'
import { getGlitchContract } from './contracts'

type Effects = {
  hp?: number
  eng?: number
  pub?: number
  sec?: number
  cred?: number
}

type CardData = {
  title: string
  text: string
  rightChoice: string
  leftChoice: string
  rightEffects: Effects
  leftEffects: Effects
}

const DEFAULT_TAPE = [50, 50, 50, 50]

const resolveError = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const candidate = (err as { shortMessage?: string; message?: string }).shortMessage
      || (err as { message?: string }).message
      || ''
    if (candidate.includes('DailyLimitReached')) return 'Daily limit reached. Wait for tomorrow.'
    if (candidate.includes('NotAuthorized')) return 'Not authorized to mint.'
    if (candidate) return candidate
  }
  return fallback
}

function App() {
  const [evmAddress, setEvmAddress] = useState('')
  const [evmSigner, setEvmSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [stellarAddress, setStellarAddress] = useState('')
  const [devAuthorized, setDevAuthorized] = useState(false)
  const [devGateEnabled, setDevGateEnabled] = useState(true)
  const [tokenId, setTokenId] = useState<number | null>(null)
  const [tape, setTape] = useState<number[]>([...DEFAULT_TAPE])
  const [card, setCard] = useState<CardData | null>(null)
  const [dailyUsed, setDailyUsed] = useState(0)
  const [dailyRemaining, setDailyRemaining] = useState(0)
  const [dailyMax, setDailyMax] = useState(0)
  const [status, setStatus] = useState('OFFLINE')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const gateUrl = import.meta.env.VITE_GATE_URL || ''

  const isReady = useMemo(() => evmSigner && evmAddress, [evmSigner, evmAddress])
  const dailyText = dailyMax ? `${dailyRemaining}/${dailyMax}` : '--'
  const canMint = !devGateEnabled || devAuthorized

  const connectEvm = async () => {
    setMessage('')
    try {
      const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum as
        | ethers.Eip1193Provider
        | undefined
      if (!ethereum) {
        setMessage('EVM wallet not found. Install MetaMask or OKX Wallet.')
        return
      }
      const provider = new ethers.BrowserProvider(ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setEvmSigner(signer)
      setEvmAddress(address)
      setStatus('EVM CONNECTED')
    } catch (err) {
      setMessage(resolveError(err, 'Failed to connect EVM wallet'))
    }
  }

  const connectStellar = async () => {
    setMessage('')
    try {
      const pk = await connectFreighter()
      setStellarAddress(pk)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Freighter'
      setMessage(msg)
    }
  }

  const checkAuthorization = async () => {
    if (!evmSigner) return
    try {
      const contract = getGlitchContract(evmSigner)
      const [allowed, gateEnabled] = await Promise.all([
        contract.authorizedDevs(evmAddress),
        contract.devGateEnabled(),
      ])
      setDevGateEnabled(Boolean(gateEnabled))
      setDevAuthorized(Boolean(allowed))
    } catch (err) {
      setMessage('Failed to read authorization status.')
    }
  }

  const requestAuthorization = async () => {
    if (!gateUrl) {
      setMessage('Missing VITE_GATE_URL')
      return
    }
    if (!stellarAddress || !evmAddress) {
      setMessage('Connect Stellar and EVM wallets first.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`${gateUrl}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarPublicKey: stellarAddress, evmAddress }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Authorization failed')
      }
      setMessage(`Dev pass approved. TX: ${data.txHash || 'pending'}`)
      await checkAuthorization()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authorization failed'
      setMessage(msg)
    } finally {
      setBusy(false)
    }
  }

  const refreshDailyStatus = async (activeToken: number) => {
    if (!evmSigner) return
    const contract = getGlitchContract(evmSigner)
    const [used, remaining, max] = await contract.getDailyStatus(activeToken)
    setDailyUsed(Number(used))
    setDailyRemaining(Number(remaining))
    setDailyMax(Number(max))
  }

  const loadTapeFromChain = async (activeToken: number) => {
    if (!evmSigner) return
    const contract = getGlitchContract(evmSigner)
    const isDead = await contract.isDead(activeToken)
    if (isDead) {
      setTape([0, 0, 0, 0])
      setStatus('PERMADEATH')
      return null
    }
    const hexTape: string = await contract.tokenTape(activeToken)
    const cleanHex = hexTape.replace('0x', '')
    const nextTape: number[] = [...DEFAULT_TAPE]
    for (let i = 0; i < 4; i += 1) {
      const byteStr = cleanHex.substring(i * 2, i * 2 + 2)
      if (byteStr.length === 2) {
        nextTape[i] = parseInt(byteStr, 16)
      }
    }
    setTape(nextTape)
    await refreshDailyStatus(activeToken)
    return nextTape
  }

  const loadNextCard = async (currentTape: number[]) => {
    setStatus('GENERATING')
    const nextCard = await generateGlitchCard(currentTape)
    setCard(nextCard)
    setStatus('ONLINE')
  }

  const refreshSession = async () => {
    if (!evmSigner) return
    try {
      const contract = getGlitchContract(evmSigner)
      const tokens = await contract.getPlayerTokens(evmAddress)
      if (tokens.length === 0) {
        setTokenId(null)
        setCard(null)
        setTape([...DEFAULT_TAPE])
        setDailyUsed(0)
        setDailyRemaining(0)
        setDailyMax(0)
        return
      }
      const activeToken = Number(tokens[0])
      setTokenId(activeToken)
      const nextTape = await loadTapeFromChain(activeToken)
      if (nextTape) {
        await loadNextCard(nextTape)
      }
    } catch (err) {
      setMessage(resolveError(err, 'Failed to sync session'))
    }
  }

  const mintToken = async () => {
    if (!evmSigner) return
    setBusy(true)
    setMessage('')
    try {
      const contract = getGlitchContract(evmSigner)
      const tx = await contract.breachNode({ value: ethers.parseEther('0.01') })
      await tx.wait()
      await refreshSession()
    } catch (err) {
      setMessage(resolveError(err, 'Mint failed'))
    } finally {
      setBusy(false)
    }
  }

  const buildBrainfuck = (effects: Effects) => {
    let code = ''
    for (let i = 0; i < 16; i += 1) code += ',>'
    code += '<'.repeat(16)

    const hp = effects.hp || 0
    const eng = effects.eng || 0
    const pub = effects.pub ?? effects.cred ?? 0
    const sec = effects.sec || 0

    if (hp > 0) code += '+'.repeat(Math.abs(hp))
    if (hp < 0) code += '-'.repeat(Math.abs(hp))
    code += '>'

    if (eng > 0) code += '+'.repeat(Math.abs(eng))
    if (eng < 0) code += '-'.repeat(Math.abs(eng))
    code += '>'

    if (pub > 0) code += '+'.repeat(Math.abs(pub))
    if (pub < 0) code += '-'.repeat(Math.abs(pub))
    code += '>'

    if (sec > 0) code += '+'.repeat(Math.abs(sec))
    if (sec < 0) code += '-'.repeat(Math.abs(sec))

    code += '<<<'
    for (let i = 0; i < 16; i += 1) code += '.>'
    return code
  }

  const formatHints = (effects: Effects) => {
    const hints: string[] = []
    const hp = effects.hp || 0
    const eng = effects.eng || 0
    const pub = effects.pub ?? effects.cred ?? 0
    const sec = effects.sec || 0
    if (hp > 0) hints.push('HP+')
    if (hp < 0) hints.push('HP-')
    if (eng > 0) hints.push('ENG+')
    if (eng < 0) hints.push('ENG-')
    if (pub > 0) hints.push('PUB+')
    if (pub < 0) hints.push('PUB-')
    if (sec > 0) hints.push('SEC+')
    if (sec < 0) hints.push('SEC-')
    return hints.join(' ')
  }

  const applyDecision = async (isRight: boolean) => {
    if (!evmSigner || !card || tokenId === null) return
    setBusy(true)
    setMessage('')
    setStatus('EXECUTING')
    try {
      const effects = isRight ? card.rightEffects : card.leftEffects
      const bfCode = buildBrainfuck(effects)
      const encoder = new TextEncoder()
      const hexBf = ethers.hexlify(encoder.encode(bfCode))
      const contract = getGlitchContract(evmSigner)
      const tx = await contract.swipe(tokenId, hexBf)
      await tx.wait()
      const nextTape = await loadTapeFromChain(tokenId)
      if (nextTape) {
        await loadNextCard(nextTape)
      }
    } catch (err) {
      setMessage(resolveError(err, 'Swipe failed'))
    } finally {
      setBusy(false)
      setStatus('ONLINE')
    }
  }

  useEffect(() => {
    if (isReady) {
      checkAuthorization()
      refreshSession()
    }
  }, [isReady])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-label">ZOLVENCY / GLITCH PROTOCOL</span>
          <span className="brand-title">DEV GATE</span>
        </div>
        <div className="status">
          <span className={`status-pill ${status === 'ONLINE' ? 'live' : ''}`}>
            {status}
          </span>
          <span className="status-pill">DAILY {dailyText}</span>
        </div>
      </header>

      <main className="grid">
        <section className="panel gate">
          <h2>Dev Validation</h2>
          <p className="muted">
            Only Zolvency devs can mint. Connect Stellar + EVM, request the dev pass,
            then mint your cartridge.
          </p>

          <div className="stack">
            <button className="btn" onClick={connectStellar} disabled={busy}>
              {stellarAddress ? 'Stellar Connected' : 'Connect Stellar (Freighter)'}
            </button>
            <div className="pill">{stellarAddress || 'Stellar wallet not connected'}</div>

            <button className="btn" onClick={connectEvm} disabled={busy}>
              {evmAddress ? 'EVM Connected' : 'Connect EVM Wallet'}
            </button>
            <div className="pill">{evmAddress || 'EVM wallet not connected'}</div>
          </div>

          <div className="divider" />

          <button className="btn primary" onClick={requestAuthorization} disabled={busy || devAuthorized || !devGateEnabled}>
            Request Dev Pass
          </button>
          <div className={`pill ${devAuthorized || !devGateEnabled ? 'ok' : ''}`}>
            {devGateEnabled ? (devAuthorized ? 'Authorized Dev' : 'Not authorized yet') : 'Gate disabled (testing)'}
          </div>

          {message && <div className="message">{message}</div>}
        </section>

        <section className="panel game">
          <div className="panel-head">
            <div>
              <h2>Glitch Session</h2>
              <p className="muted">Decision limit: {dailyMax || '--'} per day.</p>
            </div>
            <div className="panel-actions">
              <button className="btn ghost" onClick={refreshSession} disabled={!isReady || busy}>
                Sync
              </button>
              <button className="btn" onClick={mintToken} disabled={!canMint || busy}>
                Mint Cartridge
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">{card?.title || 'Awaiting signal...'}</div>
            <div className="card-desc">{card?.text || 'Connect and mint to start.'}</div>
          </div>

          <div className="actions">
            <button
              className="action"
              onClick={() => applyDecision(false)}
              disabled={!card || busy || dailyRemaining === 0}
            >
              <span>Reject</span>
              <span className="action-label">{card?.leftChoice || '--'}</span>
              <span className="action-hint">{card ? formatHints(card.leftEffects) : ''}</span>
            </button>
            <button
              className="action"
              onClick={() => applyDecision(true)}
              disabled={!card || busy || dailyRemaining === 0}
            >
              <span>Accept</span>
              <span className="action-label">{card?.rightChoice || '--'}</span>
              <span className="action-hint">{card ? formatHints(card.rightEffects) : ''}</span>
            </button>
          </div>

          <div className="tape">
            {['HP', 'ENG', 'PUB', 'SEC'].map((label, idx) => (
              <div key={label} className="tape-cell">
                <span className="tape-value">{tape[idx] ?? 0}</span>
                <span className="tape-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="daily">
            <div className="daily-track">
              <div
                className="daily-fill"
                style={{ width: dailyMax ? `${(dailyRemaining / dailyMax) * 100}%` : '0%' }}
              />
            </div>
            <div className="daily-meta">Swipes used: {dailyUsed}</div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
