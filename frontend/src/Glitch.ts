import { getWalletState } from './wallet';
import { getGlitchContract } from './wallet';
import { ethers } from 'ethers';
import { generateGlitchCard } from './openai';

// Fita Base do frontend para mock (fallback)
const INITIAL_TAPE = [50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

interface AppState {
  tape: number[];
  isLocked: boolean;
  activeTokenId: number | null;
  currentCardData: any;
}

const state: AppState = {
  tape: [...INITIAL_TAPE],
  isLocked: false,
  activeTokenId: null,
  currentCardData: null
};

export async function setupGlitch() {
  state.tape = [...INITIAL_TAPE];
  state.isLocked = false;
  state.activeTokenId = null;
  state.currentCardData = null;
  checkWalletAndTokens();
}

async function checkWalletAndTokens() {
   const wallet = getWalletState();
   if (!wallet.connected) return;

   const contract = getGlitchContract();
   if (!contract) {
      console.warn("Glitch Contract not configured or missing");
      return;
   }

   try {
       const code = await getWalletState().provider?.getCode(await contract.getAddress());
       if (!code || code === '0x') {
           console.error("No contract code at address. Wrong network?");
           document.getElementById("glitch-status")!.innerText = "ERR: WRONG NETWORK";
           const card = document.getElementById("glitch-card");
           if (card) {
               card.innerHTML = `
                  <div class="card-title" style="color:red">CONEXÃO RECUSADA</div>
                  <div class="card-desc">O nó GlitchManager não foi localizado.<br><br><b>Mude a rede do Console no topo da página para: LOCALHOST</b> (Ou certifique-se de usar a rede onde o contrato subiu).</div>
               `;
           }
           return;
       }

       const tokens = await contract.getPlayerTokens(wallet.address);
       if (tokens && tokens.length > 0) {
           const id = Number(tokens[0]);
           state.activeTokenId = id;
           await loadTapeFromChain();
       } else {
           renderMintScreen();
       }
   } catch(e) {
       console.error("Error reading tokens", e);
       document.getElementById("glitch-status")!.innerText = "ERROR READING CONTRACT. WRONG NETWORK?";
   }
}

async function loadTapeFromChain() {
   if (!state.activeTokenId) return;
   const contract = getGlitchContract();
   if (!contract) return;
   
   const isDead = await contract.isDead(state.activeTokenId);
   if (isDead) {
      state.tape[0] = 0; 
      updateTapeUI();
      renderDeathScreen();
      return;
   }

   const hexTape = await contract.tokenTape(state.activeTokenId);
   // hexTape is something like 0x64640A00...
   const cleanHex = hexTape.replace('0x', '');
   
   for(let i=0; i<16; i++) {
       const byteStr = cleanHex.substring(i*2, i*2 + 2);
       if (byteStr.length === 2) {
           state.tape[i] = parseInt(byteStr, 16);
       }
   }
   
   updateTapeUI();
   await loadNextCard();
}

export async function mintNewToken() {
    const contract = getGlitchContract();
    if (!contract) return;
    
    try {
        state.isLocked = true;
        document.getElementById("glitch-status")!.innerText = "MINTANDO...";
        const tx = await contract.breachNode({ value: ethers.parseEther("0.01") });
        await tx.wait();
        await checkWalletAndTokens();
    } catch(e) {
        console.error(e);
        alert("Erro no mint!");
    } finally {
        state.isLocked = false;
    }
}

function renderMintScreen() {
    const card = document.getElementById("glitch-card");
    if (!card) return;
    card.innerHTML = `
      <div class="card-title">SEM ACESSO</div>
      <div class="card-desc">Você não possui um Cartucho. Você deve reconectar sua entidade biológica na rede injetando fundos (0.01 MON).</div>
      <button class="btn primary" id="btn-mint" style="margin-top: 10px;">[ MINT CARTRIDGE ]</button>
    `;
    
    document.getElementById("btn-left-swipe")!.style.display = 'none';
    document.getElementById("btn-right-swipe")!.style.display = 'none';

    setTimeout(() => {
        document.getElementById("btn-mint")?.addEventListener("click", mintNewToken);
    }, 100);
}

function renderDeathScreen() {
   const gc = document.getElementById("glitch-card");
   if (gc) {
       gc.innerHTML = `
         <div class="card-title" style="color: #ff3333; border-bottom-color: #ff3333;">=== KERNEL PANIC ===</div>
         <div class="card-desc" style="color: #ff6666;">Os níveis de estado crítico da sua fita estouraram ou chegaram a zero. Seu sistema vital foi interrompido e você sofreu PERMADEATH.</div>
         <button class="btn primary" id="btn-restart" style="margin-top: 15px; border-color: #ff3333; color: #ff3333;">[ INICIAR NOVA SESSÃO (0.01 MON) ]</button>
       `;
       
       setTimeout(() => {
           document.getElementById("btn-restart")?.addEventListener("click", mintNewToken);
       }, 100);
   }
   
   document.getElementById("btn-left-swipe")!.setAttribute("disabled", "true");
   document.getElementById("btn-right-swipe")!.setAttribute("disabled", "true");
}

function updateTapeUI() {
  const tapeDiv = document.getElementById("glitch-tape-cells");
  if (!tapeDiv) return;
  
  tapeDiv.innerHTML = "";
  const labels = ["HP", "ENERGIA", "OPINIÃO PUB.", "SEGURANÇA"];
  
  for (let i = 0; i < 4; i++) { 
    const val = state.tape[i] || 0;
    tapeDiv.innerHTML += `
      <div class="tape-col">
        <div class="tape-cell">${val}</div>
        <div class="cell-label">${labels[i]}</div>
      </div>
    `;
  }
}



async function loadNextCard() {
  state.isLocked = true;
  document.getElementById("glitch-status")!.innerText = "GERANDO NARRATIVA (IA)...";
  
  const c = await generateGlitchCard(state.tape);
  state.currentCardData = c;
  
  document.getElementById("glitch-status")!.innerText = "ONLINE";

  const card = document.getElementById("glitch-card");
  if (!card) return;
  
  card.innerHTML = `
      <div class="card-title">${c.title}</div>
      <div class="card-desc">${c.text}</div>
      <div class="card-swipe-info">
         ◀ ${c.leftChoice}<br><br>
         ▶ ${c.rightChoice}
      </div>
  `;

  document.getElementById("btn-left-swipe")!.style.display = 'block';
  document.getElementById("btn-right-swipe")!.style.display = 'block';
  document.getElementById("btn-left-swipe")!.removeAttribute("disabled");
  document.getElementById("btn-right-swipe")!.removeAttribute("disabled");

  state.isLocked = false;
}

function buildBrainfuck(effects: any) {
   let code = "";
   
   for(let i = 0; i < 16; i++) code += ",>";
   
   code += "<".repeat(16);
   
   const { hp=0, eng=0, pub=0, sec=0 } = effects;
   
   if (hp > 0) code += "+".repeat(Math.abs(hp));
   if (hp < 0) code += "-".repeat(Math.abs(hp));
   code += ">";
   
   if (eng > 0) code += "+".repeat(Math.abs(eng));
   if (eng < 0) code += "-".repeat(Math.abs(eng));
   code += ">";
   
   if (pub > 0) code += "+".repeat(Math.abs(pub));
   if (pub < 0) code += "-".repeat(Math.abs(pub));
   code += ">";
   
   if (sec > 0) code += "+".repeat(Math.abs(sec));
   if (sec < 0) code += "-".repeat(Math.abs(sec));
   
   code += "<<<";
   for(let i = 0; i < 16; i++) code += ".>";
   
   return code;
}

async function applyDecision(isRight: boolean) {
    if (state.isLocked) return;
    
    const wallet = getWalletState();
    if (!wallet.connected) {
        alert("Precisa conectar a carteira para interagir.");
        return;
    }

    if (!state.activeTokenId || !state.currentCardData) return;

    state.isLocked = true;
    document.getElementById("glitch-status")!.innerText = "ENVIANDO TAPE OVERRIDE (TX)...";

    const effects = isRight ? state.currentCardData.rightEffects : state.currentCardData.leftEffects;
    const bfCode = buildBrainfuck(effects);
    
    // Converte BF string para bytes em javascript
    // Better to use TextEncoder:
    const encoder = new TextEncoder();
    const bfUint8Array = encoder.encode(bfCode);
    const hexBf = ethers.hexlify(bfUint8Array);

    try {
        const contract = getGlitchContract();
        if (contract) {
            const tx = await contract.swipe(state.activeTokenId, hexBf);
            await tx.wait();
            
            // Reload tape directly from chain to sync reality
            await loadTapeFromChain();
        }
    } catch(e) {
        console.error("TX Swipe falhou:", e);
        document.getElementById("glitch-status")!.innerText = "FALHA NA TRANSACAO";
        setTimeout(() => { document.getElementById("glitch-status")!.innerText = "ONLINE"; }, 3000);
        state.isLocked = false;
    }
}

export function setupGlitchEvents() {
  updateTapeUI();

  const status = document.getElementById("glitch-status");
  const wallet = getWalletState();
  if (status) {
      if (wallet.connected) {
          status.innerText = "VERIFICANDO CARTUCHO...";
          status.classList.remove("blink");
          status.style.color = "var(--primary-color)";
          checkWalletAndTokens();
      } else {
          status.innerText = "AWAITING_CONNECTION";
      }
  }

  const leftBtn = document.getElementById("btn-left-swipe");
  // remover event listeners duplicados hack
  const newLeft = leftBtn?.cloneNode(true);
  leftBtn?.parentNode?.replaceChild(newLeft!, leftBtn);

  const rightBtn = document.getElementById("btn-right-swipe");
  const newRight = rightBtn?.cloneNode(true);
  rightBtn?.parentNode?.replaceChild(newRight!, rightBtn);

  const doSwipe = async (isRight: boolean) => {
     if(state.isLocked) return;
     const card = document.getElementById("glitch-card");
     if (!card) return;
     
     // 1. Anima o card saindo da tela
     card.style.transform = isRight ? "translateX(200px) rotate(15deg)" : "translateX(-200px) rotate(-15deg)";
     card.style.opacity = "0";
     
     // Remove os botões temporariamente
     document.getElementById("btn-left-swipe")!.style.display = 'none';
     document.getElementById("btn-right-swipe")!.style.display = 'none';
     
     // Espera meio segundo para o fim da animação visual
     await new Promise(r => setTimeout(r, 400));
     
     // 2. Coloca o card no meio novamente, mas com texto de "Processando a Fita..."
     card.style.transition = "none";
     card.style.transform = "translateX(0) rotate(0)";
     card.innerHTML = `
         <div class="card-title blink" style="color: var(--primary-color)">EXECUTION_IN_PROGRESS</div>
         <div class="card-desc">Injetando instrução no Kernel Blockchain...<br/><br/><small>Aguardando mineradores da Monad Testnet processarem a transação... (pode levar alguns segundos)</small></div>
     `;
     card.style.opacity = "1";
     setTimeout(() => card.style.transition = "all 0.3s ease", 50);
     
     // 3. Aguarda a transaçao
     await applyDecision(isRight);
     
     // O loadNextCard chamado pelo applyDecision vai sobreescrever o innerHTML para próxima carta!
  };

  document.getElementById("btn-left-swipe")?.addEventListener("click", () => doSwipe(false));
  document.getElementById("btn-right-swipe")?.addEventListener("click", () => doSwipe(true));
}
