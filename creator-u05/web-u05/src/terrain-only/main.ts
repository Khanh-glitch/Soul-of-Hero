/**
 * TERRAIN-ONLY GAME — Creator request: "bỏ toàn bộ công trình và các lớp nổi,
 * chỉ giữ phần nền của đường, sông, biome,... và di chuyển với tốc độ tùy chỉnh
 * lên x10".
 *
 * This module deliberately imports NO PhysicalLayer, NO scene data, NO roof /
 * wall / door / prop / marker / label draw calls. The canvas contains exactly
 * two things: the verbatim live-Gameplay terrain chunk painter (biome / roads /
 * rivers / lakes / sea / shoreline / bridges) and the native 16x24 SOH hero.
 *
 * Native camera 640x360 @1x, U=0.5, TILE=16. Base speed SPEED=72 px/s is NOT
 * changed; the 1..10 multiplier is a VIEWER control, not a Gameplay law.
 * Bounded LRU chunks (<=36) and display canvases (<=36) are reused unchanged;
 * the 11.2M-cell frame is never materialised.
 */
import { getArt } from '../game/art';
import {
  TILE, VIEW_W, VIEW_H, HERO_W, HERO_H, SPEED, RENDER_CHUNK,
  FRAME_W, FRAME_H, U, auToTile, tileToAuCentre
} from '../u05/contract';
import {
  sampleTile, u05Tile, terrainBlocked, touchGeometryChunk,
  stats as worldStats, resetCaches
} from '../u05/world';
import { getDisplayChunk, displayStats, resetDisplay } from '../u05/display';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const g = canvas.getContext('2d', { alpha: false })!;
g.imageSmoothingEnabled = false;
const art: any = getArt();

const ANCHOR_TILE: [number, number] = [544, 1304]; // Creator-liked Beacon road at U=0.5
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const S = {
  x: ANCHOR_TILE[0] * TILE + TILE / 2,
  y: ANCHOR_TILE[1] * TILE + TILE / 2,
  camX: 0, camY: 0,
  dir: 0,
  mult: 1,                  // 1..10, VIEWER multiplier only
  collision: false,         // false = free roam over the whole map (default)
  hudVisible: true,
  pressed: new Set<string>(),
  inputLog: [] as { code: string; type: string; t: number }[],
  simMs: 0,
  movedPx: 0,
  blockedSubsteps: 0,
  lastFrame: 0,
  frameMs: [] as number[],
  spawnFixture: false
};

/** Draw-stat proof: NO overlay layer is ever drawn on the canvas. */
const drawStats = {
  terrainOnly: true,
  drawn: { terrainChunks: 0, hero: 1 },
  overlays: { buildings: 0, walls: 0, roofs: 0, doors: 0, props: 0, markers: 0, labels: 0, helipad: 0, hudOnCanvas: 0, particles: 0 },
  physicalLayerLoaded: false,
  sceneDataLoaded: false
};

function reset(tileX = ANCHOR_TILE[0], tileY = ANCHOR_TILE[1]) {
  S.x = tileX * TILE + TILE / 2;
  S.y = tileY * TILE + TILE / 2;
  S.camX = clamp(S.x - VIEW_W / 2, 0, FRAME_W * TILE - VIEW_W);
  S.camY = clamp(S.y - VIEW_H / 2 - 6, 0, FRAME_H * TILE - VIEW_H);
  S.movedPx = 0; S.blockedSubsteps = 0;
  S.spawnFixture = true; // viewer spawn control, NOT a route / teleport claim
  touchGeometryChunk(tileX, tileY);
  syncCamera();
}
function syncCamera() {
  S.camX = Math.round(clamp(S.x - VIEW_W / 2, 0, FRAME_W * TILE - VIEW_W));
  S.camY = Math.round(clamp(S.y - VIEW_H / 2 - 6, 0, FRAME_H * TILE - VIEW_H));
}
function setSpeed(m: number) {
  S.mult = clamp(Math.round(m * 2) / 2, 1, 10);
  syncUI();
  return S.mult;
}
function setCollision(on: boolean) { S.collision = !!on; syncUI(); return S.collision; }

// ---- input -----------------------------------------------------------------
function key(code: string, type: 'down' | 'up') {
  if (MOVE_KEYS.includes(code)) {
    if (type === 'down') S.pressed.add(code); else S.pressed.delete(code);
  } else if (type === 'down') {
    if (code === 'Equal' || code === 'NumpadAdd' || code === 'BracketRight') setSpeed(S.mult + 0.5);
    else if (code === 'Minus' || code === 'NumpadSubtract' || code === 'BracketLeft') setSpeed(S.mult - 0.5);
    else if (code === 'KeyC') setCollision(!S.collision);
    else if (code === 'KeyH') toggleHud();
    else if (code === 'KeyR') reset();
  }
  if (S.inputLog.length < 4000) S.inputLog.push({ code, type, t: Math.round(S.simMs) });
}
window.addEventListener('keydown', (e) => {
  if (MOVE_KEYS.includes(e.code) || ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'BracketLeft', 'BracketRight', 'KeyC', 'KeyH', 'KeyR'].includes(e.code)) e.preventDefault();
  key(e.code, 'down');
});
window.addEventListener('keyup', (e) => key(e.code, 'up'));
window.addEventListener('blur', () => S.pressed.clear());

function axis() {
  let dx = 0, dy = 0;
  if (S.pressed.has('KeyA') || S.pressed.has('ArrowLeft')) dx -= 1;
  if (S.pressed.has('KeyD') || S.pressed.has('ArrowRight')) dx += 1;
  if (S.pressed.has('KeyW') || S.pressed.has('ArrowUp')) dy -= 1;
  if (S.pressed.has('KeyS') || S.pressed.has('ArrowDown')) dy += 1;
  if (dx && dy) { const k = Math.SQRT1_2; dx *= k; dy *= k; }
  if (dy > 0) S.dir = 0; else if (dx < 0) S.dir = 1; else if (dx > 0) S.dir = 2; else if (dy < 0) S.dir = 3;
  return { dx, dy };
}
/** Natural terrain only. No walls, no POI collision, no Gameplay permission. */
function canStand(px: number, py: number) {
  if (!S.collision) return true;
  return !terrainBlocked(Math.floor(px / TILE), Math.floor(py / TILE));
}

// ---- loop ------------------------------------------------------------------
const loop = (now: number) => {
  const dt = Math.min(50, Math.max(0, now - S.lastFrame));
  S.lastFrame = now; S.simMs += dt;
  const { dx, dy } = axis();
  if (dx || dy) {
    const dist = SPEED * S.mult * dt / 1000;
    // Sub-step so x10 (up to 36 px/frame) never tunnels through a 16px tile
    // when natural terrain collision is enabled.
    const n = Math.max(1, Math.ceil(dist / 6));
    const sx = dx * dist / n, sy = dy * dist / n;
    for (let i = 0; i < n; i++) {
      const nx = clamp(S.x + sx, 8, FRAME_W * TILE - 8);
      if (canStand(nx, S.y)) { S.movedPx += Math.abs(nx - S.x); S.x = nx; } else S.blockedSubsteps++;
      const ny = clamp(S.y + sy, 8, FRAME_H * TILE - 8);
      if (canStand(S.x, ny)) { S.movedPx += Math.abs(ny - S.y); S.y = ny; } else S.blockedSubsteps++;
    }
  }
  syncCamera();
  touchGeometryChunk(Math.floor(S.x / TILE), Math.floor(S.y / TILE));
  draw(now);
  S.frameMs.push(dt); if (S.frameMs.length > 600) S.frameMs.shift();
  requestAnimationFrame(loop);
};

function draw(now: number) {
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, VIEW_W, VIEW_H);
  const c0 = Math.floor(S.camX / (RENDER_CHUNK * TILE)), c1 = Math.floor((S.camX + VIEW_W) / (RENDER_CHUNK * TILE));
  const r0 = Math.floor(S.camY / (RENDER_CHUNK * TILE)), r1 = Math.floor((S.camY + VIEW_H) / (RENDER_CHUNK * TILE));
  let chunks = 0;
  for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++)
    if (i >= 0 && j >= 0 && i < Math.ceil(FRAME_W / RENDER_CHUNK) && j < Math.ceil(FRAME_H / RENDER_CHUNK)) {
      g.drawImage(getDisplayChunk(i, j), Math.round(i * RENDER_CHUNK * TILE - S.camX), Math.round(j * RENDER_CHUNK * TILE - S.camY));
      chunks++;
    }
  drawStats.drawn.terrainChunks = chunks;
  const moving = MOVE_KEYS.some(k => S.pressed.has(k));
  const hero: any = art.hero.male;
  const frames = hero[(moving ? 'walk' : 'idle') + S.dir] as HTMLCanvasElement[];
  const spr = frames[Math.floor(now / (moving ? 120 : 600)) % frames.length];
  g.drawImage(spr, Math.round(S.x - S.camX - HERO_W / 2), Math.round(S.y - S.camY - 19));
}

// ---- state / API -----------------------------------------------------------
function state() {
  const tx = Math.floor(S.x / TILE), ty = Math.floor(S.y / TILE);
  const s = sampleTile(tx, ty);
  return {
    ready: true,
    mode: 'TERRAIN_ONLY__NO_BUILDINGS__NO_OVERLAY_LAYERS',
    contract: 'CREATOR_CHOSEN_U05.v1',
    status: 'STANDALONE_VIEWER__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED__VISUAL_ACCEPTANCE_NOT_GRANTED',
    viewport: [VIEW_W, VIEW_H], dpr: window.devicePixelRatio || 1, zoom: 1, cameraTrick: false,
    U, TILE, frameTiles: [FRAME_W, FRAME_H], addressableCells: FRAME_W * FRAME_H,
    heroSpritePx: [HERO_W, HERO_H], speedBasePxPerSec: SPEED, speedMultiplier: S.mult,
    speedMultiplierRange: [1, 10], speedPxPerSec: SPEED * S.mult,
    collision: S.collision ? 'NATURAL_TERRAIN_ONLY' : 'FREE_ROAM__NO_COLLISION',
    player: { px: S.x, py: S.y, tile: [tx, ty], au: tileToAuCentre(tx, ty), dir: S.dir },
    camera: { x: S.camX, y: S.camY, anchorTile: ANCHOR_TILE },
    terrain: s ? { tile: s.tile, biome: s.biome, authoredLand: s.authoredLand, water: s.water, road: s.road, poiId: s.poiId } : null,
    draw: JSON.parse(JSON.stringify(drawStats)),
    stats: { ...worldStats(), ...displayStats(), simMs: Math.round(S.simMs), movedPx: Math.round(S.movedPx), blockedSubsteps: S.blockedSubsteps, spawnFixture: S.spawnFixture },
    input: { logLength: S.inputLog.length, last: S.inputLog.slice(-8) },
    frameMs: { p50: percentile(S.frameMs, .5), p95: percentile(S.frameMs, .95), max: Math.max(0, ...S.frameMs) }
  };
}
function percentile(a: number[], p: number) {
  if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor((b.length - 1) * p)];
}

// ---- HTML controls (out-of-canvas UI, hideable with H) ---------------------
const ui = document.getElementById('ui')!;
const range = document.getElementById('speedRange') as HTMLInputElement;
const speedLabel = document.getElementById('speed')!;
const collisionBtn = document.getElementById('collision') as HTMLButtonElement;
const hideBtn = document.getElementById('hide') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;
range.oninput = () => setSpeed(Number(range.value));
for (const b of Array.from(document.querySelectorAll('#presets button[data-speed]'))) (b as HTMLButtonElement).onclick = () => setSpeed(Number((b as HTMLButtonElement).dataset.speed));
collisionBtn.onclick = () => setCollision(!S.collision);
hideBtn.onclick = () => toggleHud();
resetBtn.onclick = () => reset();
function toggleHud() {
  S.hudVisible = !S.hudVisible;
  ui.classList.toggle('hidden', !S.hudVisible);
  syncUI();
}
function syncUI() {
  range.value = String(S.mult);
  speedLabel.textContent = `x${S.mult} · ${SPEED * S.mult} px/s`;
  collisionBtn.textContent = `Chặn địa hình: ${S.collision ? 'BẬT' : 'TẮT'}`;
  collisionBtn.classList.toggle('on', S.collision);
  for (const b of Array.from(document.querySelectorAll('#presets button[data-speed]'))) (b as HTMLButtonElement).classList.toggle('on', Number((b as HTMLButtonElement).dataset.speed) === S.mult);
  hideBtn.textContent = S.hudVisible ? 'Ẩn bảng (H)' : 'Hiện bảng (H)';
}
setInterval(() => {
  if (!S.hudVisible) return;
  const s = state();
  statusEl.textContent =
    `x${s.speedMultiplier} · ${s.speedPxPerSec} px/s  |  ${s.collision}  |  U=${s.U} TILE=${s.TILE} hero=${s.heroSpritePx.join('x')} zoom=${s.zoom} dpr=${s.dpr}\n` +
    `tile=${s.player.tile.join(',')}  AU=${s.player.au.map((v: number) => v.toFixed(2)).join(',')}  px=${s.player.px.toFixed(0)},${s.player.py.toFixed(0)}  cam=${s.camera.x},${s.camera.y}\n` +
    `biome=${s.terrain?.biome}  tileCode=${s.terrain?.tile}  road=${s.terrain?.road}  water=${s.terrain?.water}  land=${s.terrain?.authoredLand}\n` +
    `frame=${s.frameTiles.join('x')} cells=${s.addressableCells} materializedAllCells=${s.stats.materializedAllCells}  chunks=${s.stats.residentChunks}/${s.stats.maxResidentChunks}  canvases=${s.stats.displayCanvases}/${s.stats.maxDisplayCanvases}\n` +
    `overlays=${JSON.stringify(s.draw.overlays)}  movedPx=${s.stats.movedPx}  frameMs p50/p95=${s.frameMs.p50.toFixed(1)}/${s.frameMs.p95.toFixed(1)}`;
}, 250);

(window as any).__terrain = {
  ready: true, state,
  setSpeed, setCollision, toggleHud,
  reset: (tx?: number, ty?: number) => { reset(tx ?? ANCHOR_TILE[0], ty ?? ANCHOR_TILE[1]); return state(); },
  clearInputLog: () => { S.inputLog = []; },
  inputLog: () => S.inputLog.slice(),
  sampleTile, u05Tile, terrainBlocked, auToTile, tileToAuCentre,
  clearCaches: () => { resetCaches(); resetDisplay(); },
  stats: () => ({ ...worldStats(), ...displayStats() })
};
reset();
syncUI();
S.lastFrame = performance.now();
requestAnimationFrame(loop);
