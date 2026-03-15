import { getProvider, connectWallet, getRegistryContract, setNetworkType, getNetworkType } from './wallet';
import type { NetworkType } from './wallet';
import { initGoL3D, updateGoL3D, destroyGoL3D } from './GoL3D';
import { initSnakeCanvas, updateSnakeState, destroySnakeCanvas } from './SnakeRenderer';
import { ethers } from 'ethers';
import './style.css';

// ─── Constants ────────────────────

const GAMES = {
  tamagotchi: { id: 0, title: "Tamagotchi", type: "stateful" },
  dice:       { id: 3, title: "Dice Roller", type: "stateless" },
  gameoflife: { id: 4, title: "Game of Life", type: "stresstest" },
  snake:      { id: 5, title: "Snake", type: "onchain" }
};

// ─── State ────────────────────────

let activeGame: string | null = null;
let txLogs: {msg: string, type: 'info'|'success'|'error', time: string}[] = [];

// Tamagotchi
let petState = { hunger: 50, happiness: 50, energy: 50, dead: false };

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
let snakeMoveHistory: string[] = [];
let snakePendingTx = false;

// ─── Render ───────────────────────

function render() {
  const app = document.getElementById('app')!;
  
  if (!activeGame) {
    app.innerHTML = `
      <div class="header">
        <h1>🧠 BF Console — ${getNetworkType() === 'monad' ? 'Monad Testnet' : 'Localhost'}</h1>
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

      <div class="game-selector">
        <div class="game-card" data-game="tamagotchi">
          <div class="game-icon">🐾</div>
          <h3>Tamagotchi</h3>
          <p>Pet uses CartridgeRegistry.playWithState() to save state to the Monad EVM.</p>
          <div class="game-meta"><span>ID: 0</span><span>Cost: ~16.6M Gas</span></div>
        </div>
        
        <div class="game-card" data-game="dice">
          <div class="game-icon">🎲</div>
          <h3>Dice Roller</h3>
          <p>Stateless RNG math simulation executed purely via Brainfuck commands.</p>
          <div class="game-meta"><span>ID: 3</span><span>Cost: ~8M Gas</span></div>
        </div>
        
        <div class="game-card" data-game="gameoflife">
          <div class="game-icon">🦠</div>
          <h3>Game of Life (3D)</h3>
          <p>Rule 102 Cellular Automaton. Simulates 1000 cells via rapid staticCalls (TPS stress test).</p>
          <div class="game-meta"><span>ID: 4</span><span>Cost: ~2.1M Gas (Pure Exec)</span></div>
        </div>
        
        <div class="game-card" data-game="snake">
          <div class="game-icon">🐍</div>
          <h3>Snake</h3>
          <p>Classic snake on a 5×5 grid. Each move validated on-chain via BrainfuckVM. Don't hit the walls!</p>
          <div class="game-meta"><span>ID: 5</span><span>Cost: ~5M Gas</span></div>
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
            
            <div class="snake-move-log">
              <div class="move-log-title">MOVE LOG</div>
              <div class="move-log-entries">${snakeMoveHistory.length === 0 ? '<span class="empty">Press W/A/S/D to move</span>' : snakeMoveHistory.map((m, i) => `<span class="move-entry">${i + 1}.${m.toUpperCase()}</span>`).join('')}</div>
            </div>
          </div>
        </div>
      `;
      
      const canvasContainer = document.getElementById('snake-canvas-container');
      if (canvasContainer) {
        initSnakeCanvas(canvasContainer);
        updateSnakeState(snakeHead, snakeFood, snakeTrail, snakeGameOver);
      }
      
      // D-pad button events
      document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = (btn as HTMLElement).dataset.dir;
          if (dir) snakeMove(dir);
        });
      });
      
      document.getElementById('snake-reset')?.addEventListener('click', snakeReset);
      setupSnakeKeyboard();
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
    const stateHex = await reg.getPlayerState(GAMES.tamagotchi.id);
    const bytes = ethers.getBytes(stateHex);
    
    if (bytes.length === 0) {
      addLog('No state found on-chain. Click INIT STATE first.', 'info');
    } else if (bytes.length === 3) {
      petState.hunger = bytes[0];
      petState.happiness = bytes[1];
      petState.energy = bytes[2];
      petState.dead = (petState.hunger === 0 || petState.happiness === 0 || petState.energy === 0);
      addLog('State loaded successfully.', 'success');
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
      const tx = await reg.playWithState(GAMES.tamagotchi.id, input, 100_000);
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
        const resultHex = await reg.play.staticCall(GAMES.dice.id, inputHex, 50_000);
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
    
    const outputHex = await reg.play.staticCall(GAMES.gameoflife.id, inputHex, 1_500_000);
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

  snakeMoveHistory.push(dir);
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
      if (m === 'w') return 119;
      if (m === 'a') return 97;
      if (m === 's') return 115;
      return 100; // d
    });
    const inputBytes = new Uint8Array(moves.length * 2);
    for (let i = 0; i < moves.length; i++) {
      inputBytes[i * 2] = moves[i];
      inputBytes[i * 2 + 1] = Math.floor(Math.random() * 25); // seed for food placement
    }
    const inputHex = ethers.hexlify(inputBytes);

    addLog(`Tx: Validating move #${snakeMoveHistory.length} (${dir.toUpperCase()}) on-chain...`, 'info');

    const resultHex = await reg.play.staticCall(GAMES.snake.id, inputHex, 5_000_000);
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

// ─── Initialization ────────────────

render();
