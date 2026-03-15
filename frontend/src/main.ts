import { getProvider, connectWallet, getRegistryContract, getVMContract, setNetworkType, getNetworkType, getWalletState } from './wallet';
import type { NetworkType } from './wallet';
import { initGoL3D, updateGoL3D, destroyGoL3D } from './GoL3D';
import { initSnakeCanvas, updateSnakeState, destroySnakeCanvas } from './SnakeRenderer';
import { ethers } from 'ethers';
import './style.css';

// ─── Constants ────────────────────

const GAMES = {
  tamagotchi: { id: 0, title: "Tamagotchi", type: "stateful" },
  dice:       { id: 1, title: "Dice Roller", type: "stateless" },
  snake:      { id: 2, title: "Snake", type: "onchain" },
  jokenpo:    { id: 3, title: "Rock Paper Scissors", type: "stateless" }, // Rock Paper Scissors
  contador:   { id: 4, title: "Inverted Counter", type: "stateful" },
  playground: { id: 99, title: "Playground", type: "playground" },
  gameoflife: { id: 6, title: "Game of Life", type: "stresstest" }, // If we ever re-add it
};

// ─── State ────────────────────────

let activeGame: string | null = null;
let txLogs: {msg: string, type: 'info'|'success'|'error', time: string, txHash?: string}[] = [];

// Tamagotchi
let petState = { hunger: 50, happiness: 50, energy: 50, age: 0, dead: false };

// Game of Life
const NUM_CELLS = 1000;
let golCells: number[] = new Array(NUM_CELLS).fill(0);
let golGeneration = 0;
let golRunning = false;
let golTxCount = 0;
let golStartTime = 0;
let golPendingTx = false;

// Snake
let snakeHead = { x: 2, y: 2 };
let snakeFood = { x: 0, y: 0 };
let snakeTrail: { x: number; y: number }[] = [{ x: 2, y: 2 }];
let snakeScore = 0;
let snakeGameOver = false;
let snakeMoveHistory: {dir: string, seed: number}[] = [];
let snakePendingTx = false;

// ─── Render ───────────────────────

function render() {
  const app = document.getElementById('app')!;
  
  if (!activeGame) {
    app.innerHTML = `
      <div class="header">
        <h1 style="display: flex; align-items: center; justify-content: center; gap: 12px;"><img src="/favicon.png" alt="Logo" style="height: 1.2em; width: 1.2em;" /> Brainfuck Console — ${getNetworkType() === 'monad' ? 'Monad Testnet' : 'Localhost'}</h1>
        <p class="subtitle">100% On-Chain Brainfuck Gaming Platform</p>
        <div class="network-badge">
          <select id="network-select" class="network-select" ${getProvider() ? 'disabled title="Disconnect to switch network"' : ''}>
            <option value="monad" ${getNetworkType() === 'monad' ? 'selected' : ''}>🟢 Monad Testnet</option>
            <option value="localhost" ${getNetworkType() === 'localhost' ? 'selected' : ''}>🟠 Localhost</option>
          </select>
        </div>
      </div>
      
      <div class="wallet-bar">
        <div class="wallet-status">
          <div class="wallet-dot ${getProvider() ? 'connected' : ''}"></div>
          <span>${getProvider() ? 'Wallet Connected via Ethers' : 'No Provider Active'}</span>
        </div>
        <button id="connect-btn" class="btn primary">${getProvider() ? 'Connected' : 'Connect Wallet'}</button>
      </div>

      <div class="playground-section">
        <div class="section-label-featured">CONSOLE UNIVERSAL</div>
        <div class="game-card playground-card-featured" data-game="playground">
          <div class="playground-featured-content">
            <div class="game-icon">🏗️</div>
            <div class="featured-text">
              <h3>Playground</h3>
              <p>The ultimate environment for Monad developers. Write, debug, and execute any Brainfuck code directly on the blockchain. No limits, just pure code.</p>
              <div class="game-meta"><span>STATE: UNIVERSAL</span><span>FEE: ON-DEMAND</span><span>EXPERIMENTAL</span></div>
            </div>
          </div>
          <!-- <div class="featured-badge">NEW</div> -->
        </div>
      </div>

      <div class="section-divider">
        <span>AVAILABLE CARTRIDGES</span>
      </div>

      <div class="game-selector">
        <div class="game-card" data-game="tamagotchi">
          <div class="game-icon">🐾</div>
          <h3>Tamagotchi</h3>
          <p>Create and care for your virtual pet! All state is saved directly on the blockchain.</p>
          <div class="game-meta"><span>Cost: ~16.6M Gas</span></div>
        </div>
        
        <div class="game-card" data-game="dice">
          <div class="game-icon">🎲</div>
          <h3>Dice Roller</h3>
          <p>Stateless RNG math simulation executed purely via Brainfuck commands.</p>
          <div class="game-meta"><span>Cost: ~8M Gas</span></div>
        </div>
        
        <div class="game-card" data-game="snake">
          <div class="game-icon">🐍</div>
          <h3>Snake</h3>
          <p>Classic snake on a 5×5 grid. Each move validated on-chain via BrainfuckVM.</p>
          <div class="game-meta"><span>Cost: ~5M Gas</span></div>
        </div>

        <div class="game-card" data-game="jokenpo">
          <div class="game-icon">✂️</div>
          <h3>Rock Paper Scissors</h3>
          <p>Rock Paper Scissors against the machine. Each move is a real on-chain transaction.</p>
          <div class="game-meta"><span>Cost: ~2M Gas</span></div>
        </div>

        <div class="game-card" data-game="contador">
          <div class="game-icon">⏲️</div>
          <h3>Inverted Counter</h3>
          <p>A weird counter that goes up/down. Uses persistent state.</p>
          <div class="game-meta"><span>Cost: ~3M Gas</span></div>
        </div>
        
        <div class="game-card" data-game="gameoflife">
          <div class="game-icon">🦠</div>
          <h3>Game of Life (3D)</h3>
          <p>Rule 102 Cellular Automaton. TPS stress test via staticCalls.</p>
          <div class="game-meta"><span>Legacy/Stress</span></div>
        </div>
      </div>
    `;
    
    document.getElementById('connect-btn')?.addEventListener('click', async () => {
      await connectWallet();
      render();
    });

    document.getElementById('network-select')?.addEventListener('change', (e) => {
      setNetworkType((e.target as HTMLSelectElement).value as NetworkType);
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
        if (activeGame === 'snake') setupSnake();
        if (activeGame === 'jokenpo') setupJokenpo();
        if (activeGame === 'contador') setupContador();
        if (activeGame === 'playground') setupPlayground();
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
          ${txLogs.map(l => {
            const explorerLink = (l.txHash && getNetworkType() === 'monad') 
              ? ` <a href="https://testnet.monadexplorer.com/tx/${l.txHash}" target="_blank" class="tx-link">🔗 View</a>` 
              : '';
            return `<div class="log-entry ${l.type}"><span class="timestamp">[${l.time}]</span>${l.msg}${explorerLink}</div>`;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('back-btn')?.addEventListener('click', () => {
      if (activeGame === 'gameoflife') {
        golRunning = false;
        destroyGoL3D();
      }
      if (activeGame === 'snake') {
        destroySnakeCanvas();
        removeSnakeKeyboard();
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
              <div class="stat-bar"><div class="stat-fill hunger" style="width: ${Math.min(100, petState.hunger)}%"></div></div>
              <div class="stat-value">${petState.hunger}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">HAPPY:</div>
              <div class="stat-bar"><div class="stat-fill happiness" style="width: ${Math.min(100, petState.happiness)}%"></div></div>
              <div class="stat-value">${petState.happiness}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">ENERGY:</div>
              <div class="stat-bar"><div class="stat-fill energy" style="width: ${Math.min(100, petState.energy)}%"></div></div>
              <div class="stat-value">${petState.energy}</div>
            </div>
            <div class="stat-row">
              <div class="stat-label">AGE:</div>
              <div class="stat-bar"><div class="stat-fill age" style="width: ${Math.min(100, petState.age)}%"></div></div>
              <div class="stat-value">${petState.age}</div>
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
    
    if (activeGame === 'snake') {
      gc.innerHTML = `
        <div class="snake-display">
          <div class="snake-grid-wrap">
            <div id="snake-canvas-container"></div>
          </div>
          
          <div class="snake-info-panel">
            <div class="snake-stats">
              <div>SCORE: <span class="value">${snakeScore}</span></div>
              <div>MOVES: <span class="value">${snakeMoveHistory.length}</span></div>
              <div>STATUS: <span class="value ${snakeGameOver ? 'gameover' : snakePendingTx ? 'pending' : 'alive'}">${snakeGameOver ? '☠ DEAD' : snakePendingTx ? '⏳ TX...' : '✓ ALIVE'}</span></div>
            </div>
            
            <div class="snake-controls">
              <div class="dpad">
                <button class="dpad-btn up" data-dir="w" ${snakeGameOver || snakePendingTx ? 'disabled' : ''}>W<span>▲</span></button>
                <div class="dpad-mid">
                  <button class="dpad-btn left" data-dir="a" ${snakeGameOver || snakePendingTx ? 'disabled' : ''}>A<span>◄</span></button>
                  <div class="dpad-center">🐍</div>
                  <button class="dpad-btn right" data-dir="d" ${snakeGameOver || snakePendingTx ? 'disabled' : ''}>D<span>►</span></button>
                </div>
                <button class="dpad-btn down" data-dir="s" ${snakeGameOver || snakePendingTx ? 'disabled' : ''}>S<span>▼</span></button>
              </div>
              
              <button id="snake-reset" class="btn danger" style="margin-top: 16px; width: 100%;">RESET GAME</button>
            </div>
          </div>
        </div>
      `;
      
      const canvasContainer = document.getElementById('snake-canvas-container');
      if (canvasContainer) {
        initSnakeCanvas(canvasContainer);
        updateSnakeState(snakeHead, snakeFood, snakeTrail, snakeGameOver);
      }
      
      document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = (btn as HTMLElement).dataset.dir;
          if (dir) snakeMove(dir);
        });
      });
      
      document.getElementById('snake-reset')?.addEventListener('click', snakeReset);
      setupSnakeKeyboard();
    }

    if (activeGame === 'jokenpo') {
      gc.innerHTML = `
        <div class="jokenpo-display">
          <div class="jokenpo-result" id="jokenpo-res">CHOOSE YOUR MOVE</div>
          <div class="jokenpo-reason" id="jokenpo-reason"></div>
          
          <div class="jokenpo-arena">
            <div class="jokenpo-side">
              <div class="jokenpo-label">YOU</div>
              <div class="jokenpo-move-icon" id="my-move">?</div>
            </div>
            
            <div class="jokenpo-vs">VS</div>
            
            <div class="jokenpo-side">
              <div class="jokenpo-label">OPPONENT</div>
              <div class="jokenpo-move-icon" id="opponent-move">?</div>
            </div>
          </div>

          <div class="jokenpo-choices">
            <button class="choice-btn" data-move="0"><span class="icon">✊</span>Rock</button>
            <button class="choice-btn" data-move="1"><span class="icon">📄</span>Paper</button>
            <button class="choice-btn" data-move="2"><span class="icon">✂️</span>Scissors</button>
          </div>
        </div>
      `;
      document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const move = (btn as HTMLElement).dataset.move;
          if (move) playJokenpo(parseInt(move));
        });
      });
    }

    if (activeGame === 'contador') {
      gc.innerHTML = `
        <div class="contador-display">
          <div class="contador-title">MONAD ON-CHAIN VIRTUAL CONSOLE</div>
          <div class="contador-value" id="contador-val">?</div>
          <div class="contador-status" id="contador-status">READY FOR OPS</div>
          
          <div class="action-buttons">
            <button id="cont-init" class="action-btn">RESTART (N=15)</button>
            <div class="btn-group">
              <button id="cont-sub" class="action-btn primary" data-action="1">SUBTRACT (-1)</button>
              <button id="cont-div" class="action-btn primary" data-action="2">DIVIDE (/2)</button>
            </div>
          </div>

          <div class="contador-history">
            <div class="history-title">TRANSACTION HISTORY</div>
            <div id="contador-tx-list" class="history-list">
              <div class="history-empty">No transactions in this session.</div>
            </div>
          </div>
        </div>
      `;
      setupContadorEvents();
    }

    if (activeGame === 'playground') {
      gc.innerHTML = `
        <div class="playground-display">
          <div class="playground-editor-section">
            <div class="section-label">BRAINFUCK CODE (.bf)</div>
            <textarea id="bf-code" class="bf-editor" placeholder="Enter your Brainfuck code here... Ex: ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++.+++++++++++++++++++++++++++++.+++++++..+++.-------------------------------------------------------------------------------.+++++++++++++++++++++++++++++++++++++++++++++.++++++++++++++++++++++++++++++++++.-.-------------.+++.--------------------------------------------------------------------.++++++++++++++++++++++++++++++++++.++++++++++++++++++++++++++++++++++++++++++.---.+++++++++++.++++++.-----------------------------------------------------------------------------------------.">++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++.+++++++++++++++++++++++++++++.+++++++..+++.-------------------------------------------------------------------------------.+++++++++++++++++++++++++++++++++++++++++++++.++++++++++++++++++++++++++++++++++.-.-------------.+++.--------------------------------------------------------------------.++++++++++++++++++++++++++++++++++.++++++++++++++++++++++++++++++++++++++++++.---.+++++++++++.++++++.-----------------------------------------------------------------------------------------.</textarea>
          </div>

          <div class="playground-editor-section">
            <div class="section-label">PROGRAM INPUT (Optional)</div>
            <input type="text" id="bf-input" class="bf-input-area" placeholder="Ex: ABC">
          </div>

          <div class="playground-controls">
            <button id="bf-run" class="btn primary">EXECUTE ON BLOCKCHAIN</button>
          </div>

          <div class="playground-result-section">
            <div class="section-label">EXECUTION RESULT</div>
            <div id="bf-result" class="bf-result-display empty">The result will appear here after the transaction confirmation...</div>
          </div>
        </div>
      `;
      setupPlaygroundEvents();
    }
    
    // Auto-scroll logs
    const logDiv = document.querySelector('.console-log');
    if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
  }
}

function addLog(msg: string, type: 'info'|'success'|'error' = 'info', txHash?: string) {
  const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  txLogs.push({ msg, type, time, txHash });
  if (txLogs.length > 20) txLogs.shift();
  
  const logDiv = document.querySelector('.console-log');
  if (logDiv) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const explorerLink = (txHash && getNetworkType() === 'monad') 
      ? ` <a href="https://testnet.monadexplorer.com/tx/${txHash}" target="_blank" class="tx-link">🔗 View</a>` 
      : '';
    entry.innerHTML = `<span class="timestamp">[${time}]</span>${msg}${explorerLink}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

// ─── Tamagotchi On-Chain ──────────

async function setupTamagotchi() {
  const reg = getRegistryContract();
  if (!reg) return addLog('Please connect MetaMask first.', 'error');
  
  try {
    const { address } = getWalletState();
    if (!address) return;

    addLog('Fetching on-chain state...', 'info');
    const stateHex = await reg.getPlayerState(GAMES.tamagotchi.id, address);
    const bytes = ethers.getBytes(stateHex);
    
    if (bytes.length === 0) {
      addLog('No state found on-chain. Click INIT STATE first.', 'info');
    } else if (bytes.length >= 5) {
      // Format: [hunger, happiness, energy, age, alive]
      petState.hunger = bytes[0];
      petState.happiness = bytes[1];
      petState.energy = bytes[2];
      petState.age = bytes[3];
      petState.dead = (bytes[4] === 0);
      addLog('State loaded successfully.', 'success');
      render();
    } else if (bytes.length === 4) {
      // Fallback for initial state that doesn't have 'alive' byte yet
      petState.hunger = bytes[0];
      petState.happiness = bytes[1];
      petState.energy = bytes[2];
      petState.age = bytes[3];
      petState.dead = (petState.happiness === 0 || petState.energy === 0);
      addLog('Initial state loaded.', 'success');
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
      addLog('Tx: Initializing cartridge state (ID 0)...', 'info');
      const tx = await reg["initState(uint256)"](GAMES.tamagotchi.id);
      addLog(`Mined! Hash: ${tx.hash.substring(0, 10)}...`, 'success', tx.hash);
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
      const tx = await reg.playWithState(GAMES.tamagotchi.id, input, 100_000);
      addLog(`Tx Mined! Hash: ${tx.hash.substring(0, 10)}...`, 'success', tx.hash);
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
        
        // Send actual transaction
        const tx = await reg.play(GAMES.dice.id, inputHex, 50_000);
        addLog(`Waiting for confirmation... Hash: ${tx.hash.substring(0, 10)}`, 'info', tx.hash);
        const receipt = await tx.wait();
        
        // Extract output from GamePlayed event
        const iface = new ethers.Interface([
            'event GamePlayed(uint256 indexed cartridgeId, address indexed player, bytes output)'
        ]);
        
        let resultHex = '0x';
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed && parsed.name === 'GamePlayed') {
                    resultHex = parsed.args.output;
                    break;
                }
            } catch (e) {}
        }
        
        const bytes = ethers.getBytes(resultHex);
        
        if (bytes.length === 1) {
            const diceFaces = ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const face = bytes[0] <= 6 ? diceFaces[bytes[0]] : '?';
            
            if (display) display.innerHTML = face;
            addLog(`Result calculated perfectly on-chain: ${bytes[0]}`, 'success');
        } else {
            addLog('Invalid output length from VM or Event not found', 'error');
            if (display) display.innerHTML = '🎲❌';
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
    
    const outputHex = await reg.play.staticCall(GAMES.gameoflife.id, inputHex, 10_000_000);
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

// ─── Snake On-Chain ──────────────────

function setupSnake() {
  snakeReset();
  addLog('🐍 Snake ready! Use W/A/S/D to move. Each move is validated on-chain.', 'info');
  addLog('Grid: 5×5 | Start: (2,2) | Food: (0,0) | Don\'t hit the walls!', 'info');
}

function snakeReset() {
  snakeHead = { x: 2, y: 2 };
  snakeFood = { x: 0, y: 0 };
  snakeTrail = [{ x: 2, y: 2 }];
  snakeScore = 0;
  snakeGameOver = false;
  snakeMoveHistory = [];
  snakePendingTx = false;
  updateSnakeState(snakeHead, snakeFood, snakeTrail, snakeGameOver);
  render();
}

async function snakeMove(dir: string) {
  if (snakeGameOver || snakePendingTx) return;
  if (!['w', 'a', 's', 'd'].includes(dir)) return;

  const reg = getRegistryContract();
  if (!reg) return addLog('Please connect wallet first.', 'error');

  // Optimistic local update for responsiveness
  const oldHead = { ...snakeHead };
  if (dir === 'w') snakeHead.y -= 1;
  if (dir === 's') snakeHead.y += 1;
  if (dir === 'a') snakeHead.x -= 1;
  if (dir === 'd') snakeHead.x += 1;

  const moveSeed = Math.floor(Math.random() * 25);
  snakeMoveHistory.push({dir, seed: moveSeed});
  snakeTrail.push({ ...snakeHead });
  if (snakeTrail.length > snakeScore + 2) snakeTrail.shift();

  // Check local collision prediction
  const localGameOver = snakeHead.x < 0 || snakeHead.x > 4 || snakeHead.y < 0 || snakeHead.y > 4;

  // Check local food collision
  let localAteFood = false;
  if (snakeHead.x === snakeFood.x && snakeHead.y === snakeFood.y) {
    localAteFood = true;
  }

  snakePendingTx = true;
  updateSnakeState(snakeHead, snakeFood, snakeTrail, localGameOver);
  render();

  try {
    // Build input: all accumulated moves interleaved with seeds
    const moves = snakeMoveHistory.map(m => {
      if (m.dir === 'w') return 119;
      if (m.dir === 'a') return 97;
      if (m.dir === 's') return 115;
      return 100; // d
    });
    const inputBytes = new Uint8Array(moves.length * 2);
    for (let i = 0; i < moves.length; i++) {
      inputBytes[i * 2] = moves[i];
      inputBytes[i * 2 + 1] = snakeMoveHistory[i].seed;
    }
    const inputHex = ethers.hexlify(inputBytes);

    addLog(`Tx: Validating move #${snakeMoveHistory.length} (${dir.toUpperCase()}) on-chain...`, 'info');

    const resultHex = await reg.play.staticCall(GAMES.snake.id, inputHex, 10_000_000);
    const output = ethers.getBytes(resultHex);

    if (output.length >= 2) {
      const onchainGameOver = output[0] === 1;
      const onchainScore = output[1];

      snakeGameOver = onchainGameOver;
      snakeScore = onchainScore;

      if (onchainGameOver) {
        addLog(`☠ GAME OVER! Final score: ${onchainScore}. Hit a wall after ${snakeMoveHistory.length} moves.`, 'error');
      } else {
        const msg = localAteFood
          ? `🍎 Food collected! Score: ${onchainScore}. On-chain confirmed.`
          : `✓ Move ${dir.toUpperCase()} validated. Score: ${onchainScore}.`;
        addLog(msg, 'success');

        // If food was eaten, reposition locally (food pos is determined by seed in BF program)
        if (localAteFood) {
          // Generate a new food position avoiding the head
          let newFx: number, newFy: number;
          do {
            newFx = Math.floor(Math.random() * 5);
            newFy = Math.floor(Math.random() * 5);
          } while (newFx === snakeHead.x && newFy === snakeHead.y);
          snakeFood = { x: newFx, y: newFy };
        }
      }

      updateSnakeState(snakeHead, snakeFood, snakeTrail, snakeGameOver);
    } else {
      addLog('Invalid output from BF VM', 'error');
      // Revert optimistic update
      snakeHead = oldHead;
      snakeMoveHistory.pop();
      snakeTrail.pop();
      updateSnakeState(snakeHead, snakeFood, snakeTrail, false);
    }
  } catch (e: any) {
    addLog('On-chain validation failed: ' + e.message, 'error');
    // Revert optimistic update
    snakeHead = oldHead;
    snakeMoveHistory.pop();
    snakeTrail.pop();
    snakeGameOver = false;
    updateSnakeState(snakeHead, snakeFood, snakeTrail, false);
  } finally {
    snakePendingTx = false;
    render();
  }
}

// ─── Jokenpo On-Chain ────────────────

function setupJokenpo() {
  addLog('✂️ Rock Paper Scissors ready!', 'info');
}

async function playJokenpo(playerMove: number) {
  const reg = getRegistryContract();
  if (!reg) return addLog('Please connect your wallet.', 'error');

  const btnNodes = document.querySelectorAll('.choice-btn');
  btnNodes.forEach(b => (b as HTMLButtonElement).disabled = true);

  const myMoveEl = document.getElementById('my-move');
  const opponentMoveEl = document.getElementById('opponent-move');
  const resultEl = document.getElementById('jokenpo-res');
  const reasonEl = document.getElementById('jokenpo-reason');

  const moves = [
    { name: "Rock", icon: "✊" },
    { name: "Paper", icon: "📄" },
    { name: "Scissors", icon: "✂️" }
  ];

  if (myMoveEl) {
    myMoveEl.innerHTML = moves[playerMove].icon;
    myMoveEl.classList.remove('winner');
  }
  if (opponentMoveEl) {
    opponentMoveEl.innerHTML = "❓";
    opponentMoveEl.classList.remove('winner');
  }
  if (resultEl) resultEl.innerHTML = "ROCK-PAPER-SCISSORS...";
  if (reasonEl) reasonEl.innerHTML = "Waiting for confirmation in MetaMask...";

  try {
    const seed = Math.floor(Math.random() * 255);
    const input = ethers.hexlify(new Uint8Array([playerMove, seed]));
    
    addLog(`[Rock Paper Scissors] Initiating transaction: ${moves[playerMove].name} vs ?`, 'info');
    
    // Send real transaction
    const tx = await reg.play(GAMES.jokenpo.id, input, 200_000);
    addLog(`Transaction sent! Hash: ${tx.hash.substring(0, 18)}...`, 'success', tx.hash);
    addLog(`Mining on Monad Testnet...`, 'info');
    
    const receipt = await tx.wait();
    if (receipt) {
      addLog(`Confirmed! Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()}`, 'success', tx.hash);
    }

    // To show result, we can either parse logs or do a staticCall (since the state changed, or just to get the value)
    // Here we parse the GamePlayed event
    let result = 0;
    const opponentMove = seed % 3;

    for (const log of receipt.logs) {
      try {
        const parsed = reg.interface.parseLog(log);
        if (parsed?.name === 'GamePlayed') {
          result = ethers.getBytes(parsed.args.output)[0];
          break;
        }
      } catch (e) {}
    }

    if (opponentMoveEl) opponentMoveEl.innerHTML = moves[opponentMove].icon;

    if (resultEl) {
      if (result === 0) {
        resultEl.innerHTML = "🤝 DRAW";
        if (reasonEl) reasonEl.innerHTML = `${moves[playerMove].name} draws with ${moves[opponentMove].name}`;
        addLog(`Result: DRAW! Both played ${moves[playerMove].name}.`, 'info');
      } else if (result === 1) {
        resultEl.innerHTML = "🎉 YOU WON!";
        if (myMoveEl) myMoveEl.classList.add('winner');
        if (reasonEl) reasonEl.innerHTML = `${moves[playerMove].name} beats ${moves[opponentMove].name}`;
        addLog(`Result: VICTORY! ${moves[playerMove].name} beats ${moves[opponentMove].name}.`, 'success');
      } else {
        resultEl.innerHTML = "💀 YOU LOST";
        if (opponentMoveEl) opponentMoveEl.classList.add('winner');
        if (reasonEl) reasonEl.innerHTML = `${moves[opponentMove].name} beats ${moves[playerMove].name}`;
        addLog(`Result: DEFEAT! ${moves[opponentMove].name} beats ${moves[playerMove].name}.`, 'error');
      }
    }
  } catch (e: any) { 
    addLog('Transaction failed: ' + (e.reason || e.message), 'error'); 
    if (resultEl) resultEl.innerHTML = "CANCELLED";
    if (reasonEl) reasonEl.innerHTML = "Transaction rejected or failed.";
  } finally {
    btnNodes.forEach(b => (b as HTMLButtonElement).disabled = false);
  }
}

// ─── Contador On-Chain ───────────────

async function setupContador() {
  const reg = getRegistryContract();
  if (!reg) return;
  try {
    const { address } = getWalletState();
    if (!address) return;
    
    // addLog('Fetching counter state from Monad...', 'info');
    const state = await reg.getPlayerState(GAMES.contador.id, address);
    const bytes = ethers.getBytes(state);
    
    const val = bytes.length > 0 ? bytes[0] : 0;
    const display = document.getElementById('contador-val');
    if (display) display.innerHTML = val.toString();
  } catch (e) { 
    console.error(e);
    addLog('Failed to fetch state: ' + (e as Error).message, 'error');
  }
}

function setupContadorEvents() {
  const statusEl = document.getElementById('contador-status');
  const display = document.getElementById('contador-val');

  const setPending = (pending: boolean) => {
    const buttons = document.querySelectorAll('.contador-display .action-btn');
    buttons.forEach(b => (b as HTMLButtonElement).disabled = pending);
    if (statusEl) {
      statusEl.innerHTML = pending ? "TRANSACTION PENDING..." : "READY FOR OPS";
      statusEl.className = `contador-status ${pending ? 'pending' : ''}`;
    }
    if (pending && display) {
      display.classList.add('loading');
    } else if (display) {
      display.classList.remove('loading');
    }
  };

  const addTxToHistory = (hash: string, action: string, status: 'pending'|'success'|'error') => {
    const list = document.getElementById('contador-tx-list');
    if (!list) return;
    
    if (list.querySelector('.history-empty')) list.innerHTML = '';
    
    const entry = document.createElement('div');
    entry.className = `history-entry ${status}`;
    const hashDisplay = (getNetworkType() === 'monad') 
      ? `<a href="https://testnet.monadexplorer.com/tx/${hash}" target="_blank" class="hash-link">${hash.substring(0, 10)}...</a>`
      : `<span class="hash-only">${hash.substring(0, 10)}...</span>`;

    entry.innerHTML = `
      <span class="action">${action}</span>
      <span class="hash">${hashDisplay}</span>
      <span class="status-icon">${status === 'pending' ? '⏳' : status === 'success' ? '✅' : '❌'}</span>
    `;
    list.prepend(entry);
    if (list.childNodes.length > 5) list.lastChild?.remove();
  };

  const doAction = async (action: number) => {
    const reg = getRegistryContract();
    if (!reg) return addLog('Please connect wallet.', 'error');
    
    const actionName = action === 1 ? "SUBTRACT (-1)" : "DIVIDE (/2)";
    setPending(true);
    
    try {
      addLog(`[Contador] Initiating transaction: ${actionName}`, 'info');
      const input = ethers.hexlify(new Uint8Array([action]));
      
      const tx = await reg.playWithState(GAMES.contador.id, input, 150_000);
      addLog(`Transaction sent! Hash: ${tx.hash.substring(0, 18)}...`, 'success', tx.hash);
      addTxToHistory(tx.hash, actionName, 'pending');
      
      const receipt = await tx.wait();
      if (receipt) {
        addLog(`Confirmed! Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()}`, 'success', tx.hash);
        addTxToHistory(tx.hash, actionName, 'success');
      }
      
      await setupContador();
    } catch (e: any) { 
      const msg = e.reason || e.message;
      addLog('Transaction failed: ' + msg, 'error'); 
      addTxToHistory('0x...', actionName, 'error');
    } finally {
      setPending(false);
    }
  };

  document.getElementById('cont-init')?.addEventListener('click', async () => {
    const reg = getRegistryContract();
    if (!reg) return addLog('Please connect wallet.', 'error');
    
    setPending(true);
    try {
      addLog('[Contador] Resetting state to N=15...', 'info');
      const tx = await reg["initState(uint256,bytes)"](GAMES.contador.id, "0x0f"); // 15
      addLog(`Reset transaction sent!`, 'success', tx.hash);
      addTxToHistory(tx.hash, "RESET (15)", 'pending');
      
      await tx.wait();
      addLog(`State successfully reset.`, 'success', tx.hash);
      addTxToHistory(tx.hash, "RESET (15)", 'success');
      
      await setupContador();
    } catch (e: any) { 
      addLog('Reset error: ' + (e.reason || e.message), 'error'); 
    } finally {
      setPending(false);
    }
  });

  document.getElementById('cont-sub')?.addEventListener('click', () => doAction(1));
  document.getElementById('cont-div')?.addEventListener('click', () => doAction(2));
}

// ─── Snake Keyboard ──────────────────

function snakeKeyHandler(e: KeyboardEvent) {
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(key)) {
    e.preventDefault();
    snakeMove(key);
  }
}

function setupSnakeKeyboard() {
  window.addEventListener('keydown', snakeKeyHandler);
}

function removeSnakeKeyboard() {
  window.removeEventListener('keydown', snakeKeyHandler);
}

// ─── Brainfuck Playground ──────────

async function setupPlayground() {
  addLog('Ready to compile and execute Brainfuck code on the Blockchain!', 'info');
}

function setupPlaygroundEvents() {
  const runBtn = document.getElementById('bf-run');
  const codeArea = document.getElementById('bf-code') as HTMLTextAreaElement;
  const inputArea = document.getElementById('bf-input') as HTMLInputElement;
  const resultDisplay = document.getElementById('bf-result');

  runBtn?.addEventListener('click', async () => {
    const code = codeArea.value.trim();
    if (!code) return addLog('Please enter Brainfuck code.', 'error');

    const vm = getVMContract();
    if (!vm) return addLog('Please connect your wallet.', 'error');

    const inputStr = inputArea.value;
    const inputBytes = new TextEncoder().encode(inputStr);
    const codeBytes = new TextEncoder().encode(code);

    try {
      addLog('[Playground] Executing on Monad...', 'info');
      if (runBtn) (runBtn as HTMLButtonElement).disabled = true;
      if (resultDisplay) {
        resultDisplay.innerHTML = '⏳ Executing transaction...';
        resultDisplay.classList.remove('empty');
      }

      // We use run() which is state-changing (emits events)
      // BrainfuckVM.run(bytes program, bytes input, uint256 maxSteps)
      const tx = await vm.run(ethers.hexlify(codeBytes), ethers.hexlify(inputBytes), 1_000_000);
      addLog(`Transaction sent! Hash: ${tx.hash.substring(0, 18)}...`, 'success', tx.hash);
      
      const receipt = await tx.wait();
      addLog(`Execution completed! Gas: ${receipt.gasUsed.toString()}`, 'success', tx.hash);

      // Parse output from ProgramExecuted event
      let outputHex = '0x';
      for (const log of receipt.logs) {
        try {
          const parsed = vm.interface.parseLog(log);
          if (parsed?.name === 'ProgramExecuted') {
            outputHex = parsed.args.output;
            break;
          }
        } catch (e) {}
      }

      const outputBytes = ethers.getBytes(outputHex);
      const outputText = new TextDecoder().decode(outputBytes);
      
      if (resultDisplay) {
        resultDisplay.innerHTML = outputText || '(No output generated)';
      }
      addLog(`Result: ${outputText || 'empty'}`, 'success');

    } catch (e: any) {
      const msg = e.reason || e.message;
      addLog('Execution failed: ' + msg, 'error');
      if (resultDisplay) resultDisplay.innerHTML = 'Error: ' + msg;
    } finally {
      if (runBtn) (runBtn as HTMLButtonElement).disabled = false;
    }
  });
}

// ─── Initialization ────────────────

render();
