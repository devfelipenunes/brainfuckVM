import { getProvider, connectWallet, getRegistryContract, getWalletState } from './wallet';
import { initGoL3D, updateGoL3D, destroyGoL3D } from './GoL3D';
import { ethers } from 'ethers';
import './style.css';

// ─── Constants ────────────────────

const GAMES = {
  tamagotchi: { id: 0, title: "Tamagotchi", type: "stateful" },
  dice:       { id: 1, title: "Dice Roller", type: "stateless" },
  gameoflife: { id: 2, title: "Game of Life", type: "stresstest" }
};

// ─── State ────────────────────────

let activeGame: string | null = null;
let txLogs: {msg: string, type: 'info'|'success'|'error', time: string}[] = [];

// Tamagotchi
let petState = { hunger: 50, happiness: 50, energy: 50, dead: false };

// Game of Life
const NUM_CELLS = 64;
let golCells: number[] = new Array(NUM_CELLS).fill(0);
let golGeneration = 0;
let golRunning = false;
let golTxCount = 0;
let golStartTime = 0;
let golPendingTx = false;

// ─── Render ───────────────────────

function render() {
  const app = document.getElementById('app')!;
  
  if (!activeGame) {
    app.innerHTML = `
      <div class="header">
        <h1>🧠 BF Console — Monad Testnet</h1>
        <p class="subtitle">100% On-Chain Brainfuck Gaming Platform</p>
        <div class="network-badge">🟢 Connected to Monad</div>
      </div>
      
      <div class="wallet-bar">
        <div class="wallet-status">
          <div class="wallet-dot ${getProvider() ? 'connected' : ''}"></div>
          <span>${getProvider() ? 'Wallet Connected via Ethers' : 'No Provider Active'}</span>
        </div>
        <button id="connect-btn" class="btn primary">${getProvider() ? 'Connected' : 'Connect Wallet'}</button>
      </div>

      <div class="game-selector">
        <div class="game-card" data-game="tamagotchi">
          <div class="game-icon">🐾</div>
          <h3>Tamagotchi</h3>
          <p>Pet uses CartridgeRegistry.playWithState() to save state to the Monad EVM.</p>
          <div class="game-meta"><span>ID: 0</span><span>Cost: ~400k Gas (RLE)</span></div>
        </div>
        
        <div class="game-card" data-game="dice">
          <div class="game-icon">🎲</div>
          <h3>Dice Roller</h3>
          <p>Stateless RNG math simulation executed purely via Brainfuck commands.</p>
          <div class="game-meta"><span>ID: 1</span><span>Cost: ~80k Gas (RLE)</span></div>
        </div>
        
        <div class="game-card" data-game="gameoflife">
          <div class="game-icon">🦠</div>
          <h3>Game of Life (3D)</h3>
          <p>Rule 102 Cellular Automaton. Simulates 64 cells via rapid staticCalls (TPS stress test).</p>
          <div class="game-meta"><span>ID: 2</span><span>Cost: ~120k Gas (RLE)</span></div>
        </div>
      </div>
    `;
    
    document.getElementById('connect-btn')?.addEventListener('click', async () => {
      await connectWallet();
      render();
    });

    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        activeGame = (card as HTMLElement).dataset.game!;
        
        // Reset console logs when switching games
        txLogs = [];
        
        render();
        
        if (activeGame === 'tamagotchi') setupTamagotchi();
        if (activeGame === 'dice') setupDice();
        if (activeGame === 'gameoflife') setupGameOfLife();
      });
    });
  } else {
    // Render Active Game
    app.innerHTML = `
      <div class="game-screen">
        <div class="screen-header">
          <button id="back-btn" class="back-btn">← MENU</button>
          <div class="screen-title">${activeGame.toUpperCase()}</div>
        </div>
        
        <div id="game-container"></div>
        
        <div class="console-log">
          ${txLogs.map(l => `<div class="log-entry ${l.type}"><span class="timestamp">[${l.time}]</span>${l.msg}</div>`).join('')}
        </div>
      </div>
    `;

    document.getElementById('back-btn')?.addEventListener('click', () => {
      if (activeGame === 'gameoflife') {
        golRunning = false;
        destroyGoL3D();
      }
      activeGame = null;
      render();
    });

    const gc = document.getElementById('game-container')!;
    
    if (activeGame === 'tamagotchi') {
      gc.innerHTML = `
        <div class="tamagotchi-display">
          <div class="pet-sprite ${petState.dead ? 'dead' : ''}">${petState.dead ? '🪦' : '👾'}</div>
          
          <div class="stat-bars">
            <div class="stat-row">
              <div class="stat-label">HUNGER:</div>
              <div class="stat-bar"><div class="stat-fill hunger" style="width: ${petState.hunger}%"></div></div>
              <div class="stat-value">${petState.hunger}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">HAPPY:</div>
              <div class="stat-bar"><div class="stat-fill happiness" style="width: ${petState.happiness}%"></div></div>
              <div class="stat-value">${petState.happiness}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">ENERGY:</div>
              <div class="stat-bar"><div class="stat-fill energy" style="width: ${petState.energy}%"></div></div>
              <div class="stat-value">${petState.energy}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">STATUS:</div>
              <div class="stat-value" style="color: ${petState.dead ? 'var(--danger)' : 'var(--accent)'}">${petState.dead ? 'DEAD' : 'ALIVE'}</div>
            </div>
          </div>
          
          <div class="action-buttons">
            <button id="tama-init" class="action-btn">INIT STATE</button>
            <button id="tama-feed" class="action-btn" ${petState.dead ? 'disabled' : ''}>FEED</button>
            <button id="tama-play" class="action-btn" ${petState.dead ? 'disabled' : ''}>PLAY</button>
            <button id="tama-sleep" class="action-btn" ${petState.dead ? 'disabled' : ''}>SLEEP</button>
          </div>
        </div>
      `;
      setupTamagotchiEvents();
    }
    
    if (activeGame === 'dice') {
      gc.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div id="dice-display" style="font-size: 80px; margin-bottom: 20px; text-shadow: var(--glow);">🎲</div>
          <button id="dice-roll" class="btn primary" style="font-size: 16px; padding: 12px 24px;">ROLL ON-CHAIN</button>
        </div>
      `;
      document.getElementById('dice-roll')?.addEventListener('click', diceRoll);
    }
    
    if (activeGame === 'gameoflife') {
      const tps = golTxCount > 0 ? (golTxCount / ((Date.now() - golStartTime) / 1000)).toFixed(1) : '0.0';
      gc.innerHTML = `
        <div class="gol-display">
          <div id="gol-canvas" style="width: 100%; height: 500px; border-radius: 12px; overflow: hidden; position: relative;"></div>
          
          <div class="gol-controls">
            <button id="gol-random" class="btn">RANDOM</button>
            <button id="gol-clear" class="btn danger">CLEAR</button>
            <button id="gol-step" class="btn">STEP (TX)</button>
            <button id="gol-auto" class="btn primary" ${golRunning ? 'style="background: var(--danger)"' : ''}>
              ${golRunning ? 'STOP' : 'AUTO STRESS'}
            </button>
          </div>
          
          <div class="gol-stats">
            <div>GEN: <span class="value">${golGeneration}</span></div>
            <div>RPC TPS: <span class="value">${tps}</span></div>
            <div>STATUS: <span class="value">${golPendingTx ? 'COMPUTING...' : 'IDLE'}</span></div>
          </div>
        </div>
      `;
      
      const canvasContainer = document.getElementById('gol-canvas');
      if (canvasContainer) {
          initGoL3D(canvasContainer);
          // Pass the initialized state
          updateGoL3D(golCells);
      }
      
      document.getElementById('gol-step')?.addEventListener('click', () => golStep(false));
      document.getElementById('gol-auto')?.addEventListener('click', golToggleAuto);
      document.getElementById('gol-random')?.addEventListener('click', golRandomize);
      document.getElementById('gol-clear')?.addEventListener('click', () => { 
          if(!golRunning && !golPendingTx){ 
              golCells.fill(0); golGeneration = 0; updateGoL3D(golCells); render(); 
          }
      });
    }
    
    // Auto-scroll logs
    const logDiv = document.querySelector('.console-log');
    if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
  }
}

function addLog(msg: string, type: 'info'|'success'|'error' = 'info') {
  const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  txLogs.push({ msg, type, time });
  if (txLogs.length > 20) txLogs.shift();
}

// ─── Tamagotchi On-Chain ──────────

async function setupTamagotchi() {
  const reg = getRegistryContract();
  if (!reg) return addLog('Please connect MetaMask first.', 'error');
  
  try {
    addLog('Fetching on-chain state...', 'info');
    const stateHex = await reg.getPlayerState(GAMES.tamagotchi.id, getWalletState().address);
    const bytes = ethers.getBytes(stateHex);
    
    if (bytes.length === 0) {
      addLog('No state found on-chain. Click INIT STATE first.', 'info');
    } else if (bytes.length === 5) {
      petState.hunger = bytes[0];
      petState.happiness = bytes[1];
      petState.energy = bytes[2];
      // bytes[3] is age, bytes[4] is alive (1 or 0)
      petState.dead = (bytes[4] === 0);
      addLog(`State loaded: Hunger ${petState.hunger}, Happy ${petState.happiness}, Energy ${petState.energy}, Age ${bytes[3]}.`, 'success');
      render();
    }
  } catch(e: any) {
    addLog('Fetch failed: ' + e.message, 'error');
  }
}

function setupTamagotchiEvents() {
  document.getElementById('tama-init')?.addEventListener('click', async () => {
    const reg = getRegistryContract();
    if (!reg) return;
    try {
      addLog('Tx: Initializing cartidge state (ID 0)...', 'info');
      const tx = await reg.initState(GAMES.tamagotchi.id);
      addLog(`Mined! Hash: ${tx.hash.substring(0, 10)}...`, 'success');
      await tx.wait();
      addLog('State initialized on-chain!', 'success');
      await setupTamagotchi();
    } catch(e: any) { addLog(e.message, 'error'); }
  });

  const doAction = async (actionId: number) => {
    const reg = getRegistryContract();
    if (!reg) return;
    try {
      addLog(`Tx: Sending Action ${actionId} via playWithState()...`, 'info');
      const input = ethers.hexlify(new Uint8Array([actionId]));
      const tx = await reg.playWithState(GAMES.tamagotchi.id, input, 30_000);
      addLog(`Tx Mined! Hash: ${tx.hash.substring(0, 10)}...`, 'success');
      await tx.wait();
      addLog(`Action applied to Monad state!`, 'success');
      await setupTamagotchi();
    } catch(e: any) { addLog(e.message, 'error'); }
  };

  document.getElementById('tama-feed')?.addEventListener('click', () => doAction(1));
  document.getElementById('tama-play')?.addEventListener('click', () => doAction(2));
  document.getElementById('tama-sleep')?.addEventListener('click', () => doAction(3));
}

// ─── Dice Roller On-Chain ─────────

async function setupDice() {
    addLog('Ready! Click Roll to execute Brainfuck program on-chain.', 'info');
}

async function diceRoll() {
    const reg = getRegistryContract();
    if (!reg) return addLog('Please connect wallet.', 'error');
    
    const seed = Math.floor(Math.random() * 255);
    const inputHex = ethers.hexlify(new Uint8Array([seed]));
    
    try {
        addLog(`Executing Dice Roller cart (ID ${GAMES.dice.id}) with seed ${seed}...`, 'info');
        const display = document.getElementById('dice-display');
        if (display) display.innerHTML = '🎲🔃'; // spin
        
        // This is a static call (eth_call), no state change, fast and free execution!
        const resultHex = await reg.play.staticCall(GAMES.dice.id, inputHex, 10_000);
        const bytes = ethers.getBytes(resultHex);
        
        if (bytes.length === 1) {
            const diceFaces = ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const face = bytes[0] <= 6 ? diceFaces[bytes[0]] : '?';
            
            if (display) display.innerHTML = face;
            addLog(`Result calculated perfectly on-chain: ${bytes[0]}`, 'success');
        } else {
            addLog('Invalid output length from VM', 'error');
        }
    } catch(e: any) {
        addLog('Roll failed: ' + e.message, 'error');
    }
}

// ─── Game of Life On-Chain ────────

function setupGameOfLife() {
  if (golCells.length !== NUM_CELLS) golCells = new Array(NUM_CELLS).fill(0);
  addLog(`Brainfuck Generator produced ${NUM_CELLS} cells in a 3D Sphere.`, 'info');
}

function golRandomize() {
  if (golRunning || golPendingTx) return;
  for (let i = 0; i < NUM_CELLS; i++) {
    golCells[i] = Math.random() > 0.8 ? 1 : 0;
  }
  golGeneration = 0;
  updateGoL3D(golCells);
  render();
}

async function golStep(isAuto = false) {
  const reg = getRegistryContract();
  if (!reg) return;

  if (!isAuto) golPendingTx = true;
  if (!isAuto) render();

  try {
    if (!golRunning && !isAuto) addLog(`Tx: Computing generation ${golGeneration+1} on-chain...`, 'info');
    
    const inputHex = ethers.hexlify(new Uint8Array(golCells));
    
    const outputHex = await reg.play.staticCall(GAMES.gameoflife.id, inputHex, 500_000);
    const outputBytes = ethers.getBytes(outputHex);
    
    // If we stopped the auto mode while this was inflight, ignore the result
    if (isAuto && !golRunning) return;

    if (outputBytes.length === NUM_CELLS) {
      golCells = Array.from(outputBytes);
      golGeneration++;
      golTxCount++;
      if (golTxCount === 1) golStartTime = Date.now();
      updateGoL3D(golCells);
      if (!golRunning && !isAuto) addLog(`Generation ${golGeneration} computed!`, 'success');
    } else {
        addLog(`Invalid Output: Length was ${outputBytes.length}, expected ${NUM_CELLS}`, 'error');
        if (golRunning) golToggleAuto();
    }
  } catch (e: any) {
    addLog('GoL step failed: ' + e.message, 'error');
    if (golRunning) golToggleAuto(); // stop if error
  } finally {
    if (!isAuto) golPendingTx = false;
    // If it's auto mode, only render occasionally to reduce UI lag, or render every frame
    if (golRunning || !isAuto) render();
  }
}

async function runAutoStressLoop() {
  while (golRunning) {
    // Fire a batch of parallel promises to really stress the RPC, instead of strict sequential
    const BATCH_SIZE = 5;
    const promises = [];
    for(let i = 0; i < BATCH_SIZE; i++) {
        if (!golRunning) break;
        promises.push(golStep(true));
    }
    await Promise.allSettled(promises);
    // Add a tiny delay so the browser UI doesn't completely freeze
    await new Promise(r => setTimeout(r, 50));
  }
}

function golToggleAuto() {
  if (golRunning) {
    golRunning = false;
    addLog(`⏹ Draining queue and stopping...`, 'info');
    setTimeout(() => {
        addLog(`⏹ Stress test stopped. ${golTxCount} queries made.`, 'info');
        render();
    }, 500); // give it a moment to let pending promises die
  } else {
    golRunning = true;
    golTxCount = 0;
    golStartTime = Date.now();
    addLog('▶ Stress test started! Firing rapid eth_calls to Monad Nodes!', 'success');
    
    // Start recursive loop
    runAutoStressLoop();
  }
  render();
}

// ─── Initialization ────────────────

render();
