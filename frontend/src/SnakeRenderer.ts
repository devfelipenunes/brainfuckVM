// ─── SnakeRenderer.ts ─────────────────────────────────────────────────
// Canvas 2D renderer for the 5×5 Snake grid.
// Follows the same module pattern as GoL3D.ts.

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animationId = 0;
let isInitialized = false;

// Render state (set externally, drawn each frame)
let headPos = { x: 2, y: 2 };
let foodPos = { x: 0, y: 0 };
let trail: { x: number; y: number }[] = [];
let gameOver = false;
let frameTime = 0;

const GRID = 5;
const CELL_PAD = 4;

// ─── Public API ──────────────────────────────────────────────────────

export function initSnakeCanvas(container: HTMLElement) {
  if (isInitialized) return;

  canvas = document.createElement('canvas');
  canvas.id = 'snake-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  ctx = canvas.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
  isInitialized = true;
  animate();
}

export function updateSnakeState(
  head: { x: number; y: number },
  food: { x: number; y: number },
  moveTrail: { x: number; y: number }[],
  isGameOver: boolean
) {
  headPos = head;
  foodPos = food;
  trail = moveTrail;
  gameOver = isGameOver;
}

export function destroySnakeCanvas() {
  if (!isInitialized) return;
  window.removeEventListener('resize', resize);
  cancelAnimationFrame(animationId);
  if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
  canvas = null;
  ctx = null;
  isInitialized = false;
}

// ─── Internals ───────────────────────────────────────────────────────

function resize() {
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const size = Math.min(parent.clientWidth, parent.clientHeight, 500);
  canvas.width = size * window.devicePixelRatio;
  canvas.height = size * window.devicePixelRatio;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

function animate() {
  frameTime = performance.now() * 0.001;
  draw();
  animationId = requestAnimationFrame(animate);
}

function draw() {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const cellW = (w - CELL_PAD * (GRID + 1)) / GRID;
  const cellH = (h - CELL_PAD * (GRID + 1)) / GRID;

  // ── Background ──
  ctx.fillStyle = '#0a0a14';
  roundRect(ctx, 0, 0, w, h, 16 * window.devicePixelRatio);

  // ── Draw grid cells ──
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cx = CELL_PAD + x * (cellW + CELL_PAD);
      const cy = CELL_PAD + y * (cellH + CELL_PAD);
      const r = 6 * window.devicePixelRatio;

      // Base cell
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      roundRect(ctx, cx, cy, cellW, cellH, r);

      // Trail (body segments)
      const isTrail = trail.some(t => t.x === x && t.y === y);
      if (isTrail && !(x === headPos.x && y === headPos.y)) {
        ctx.fillStyle = 'rgba(0,255,170,0.25)';
        roundRect(ctx, cx + 2, cy + 2, cellW - 4, cellH - 4, r);
      }

      // Food
      if (x === foodPos.x && y === foodPos.y) {
        const pulse = 0.7 + Math.sin(frameTime * 4) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ff4466';
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur = 18 * window.devicePixelRatio;
        roundRect(ctx, cx + 4, cy + 4, cellW - 8, cellH - 8, r);

        // Food icon "+"
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${cellW * 0.45}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', cx + cellW / 2, cy + cellH / 2 + 1);
        ctx.shadowColor = 'transparent';
      }

      // Head
      if (x === headPos.x && y === headPos.y) {
        const glow = gameOver ? '#ff4466' : '#00ffaa';
        ctx.fillStyle = gameOver ? 'rgba(255,68,102,0.9)' : 'rgba(0,255,170,0.95)';
        ctx.shadowColor = glow;
        ctx.shadowBlur = 20 * window.devicePixelRatio;
        roundRect(ctx, cx + 2, cy + 2, cellW - 4, cellH - 4, r);

        // Head icon
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = `bold ${cellW * 0.5}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameOver ? '☠' : '●', cx + cellW / 2, cy + cellH / 2 + 1);
        ctx.shadowColor = 'transparent';
      }
    }
  }

  // ── Game Over overlay ──
  if (gameOver) {
    const flash = 0.15 + Math.abs(Math.sin(frameTime * 3)) * 0.15;
    ctx.fillStyle = `rgba(255,68,102,${flash})`;
    roundRect(ctx, 0, 0, w, h, 16 * window.devicePixelRatio);

    ctx.fillStyle = '#ff4466';
    ctx.font = `bold ${w * 0.08}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 30;
    ctx.fillText('GAME OVER', w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
}

// ── Helper ──

function roundRect(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
  c.fill();
}
