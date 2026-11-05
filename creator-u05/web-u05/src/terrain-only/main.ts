/**
 * TERRAIN-ONLY GAME — Creator request: "bỏ toàn bộ công trình và các lớp nổi,
 * chỉ giữ phần nền của đường, sông, biome,... và di chuyển với tốc độ tùy chỉnh
 * lên x10" + "thêm chức năng zoom map nhỏ nhất có thể để nhìn toàn cảnh map".
 *
 * Canvas contains exactly two things in NATIVE mode: the verbatim live-Gameplay
 * terrain chunk painter (biome / roads / rivers / lakes / sea / shoreline /
 * bridges) and the native 16x24 SOH hero. NO PhysicalLayer, NO scene data,
 * NO roof/wall/door/prop/marker/label/HUD-on-canvas.
 *
 * WHOLE-MAP OVERVIEW is a SEPARATE viewer mode (Z / slider / wheel). It draws a
 * 500x350 SAMPLED preview of exact GOLD tile centres, scaled so the entire
 * 4000x2800-tile frame fits the 640x360 view. It is NOT a camera law change:
 * native play stays at 640x360 @1x, hero 16x24, U=0.5, SPEED=72 px/s base.
 * The 11.2M-cell frame is NEVER materialised; overview uses 175,000 pixels.
 *
 * The x1..x10 multiplier is a VIEWER control, not a Gameplay law.
 */
import { getArt } from '../game/art';
import {
  TILE, VIEW_W, VIEW_H, HERO_W, HERO_H, SPEED, RENDER_CHUNK,
  FRAME_W, FRAME_H, U, auToTile, tileToAuCentre
} from '../u05/contract';
import {
  sampleTile, u05Tile, terrainBlocked, touchGeometryChunk,
  stats as worldStats, resetCaches, despeckleStats
} from '../u05/world';
import { getDisplayChunk, displayStats, resetDisplay } from '../u05/display';
import { buildOverviewRows, getOverview, progress as overviewProgress, overviewSize } from './overview';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const g = canvas.getContext('2d', { alpha: false })!;
g.imageSmoothingEnabled = false;
const lensCanvas = document.getElementById('lens') as HTMLCanvasElement;
const lg = lensCanvas.getContext('2d', { alpha: false })!;
lg.imageSmoothingEnabled = false;
const art: any = getArt();

const ANCHOR_TILE: [number, number] = [544, 1304]; // Creator-liked Beacon road at U=0.5
/** Smallest possible zoom: the WHOLE 4000x2800-tile frame fits 640x360. */
const FIT_PX_PER_TILE = Math.min(VIEW_W / FRAME_W, VIEW_H / FRAME_H); // 0.128571... px/tile
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const CONTROL_KEYS = ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'BracketLeft', 'BracketRight', 'KeyC', 'KeyH', 'KeyR', 'KeyZ', 'KeyV', 'KeyB', 'KeyF', 'KeyL', 'Comma', 'Period'];

const S = {
  x: ANCHOR_TILE[0] * TILE + TILE / 2,
  y: ANCHOR_TILE[1] * TILE + TILE / 2,
  camX: 0, camY: 0,
  dir: 0,
  mult: 1,                  // 1..10 speed, VIEWER multiplier only
  zoomLevel: 1,             // 1 = native 1x, 0 = whole-map FIT
  followMode: 'FIT_FOLLOW' as 'FIT_FOLLOW' | 'CENTER_FOLLOW' | 'LOCK',
  lens: true,               // native 1x follow camera in the HTML panel
  guides: true,             // viewport rectangle (the player dot is ALWAYS drawn)
  ovOffX: 0, ovOffY: 0, ovMapW: 0, ovMapH: 0, ovGainX: 0, ovGainY: 0, markerX: 0, markerY: 0,
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

/** Draw-stat proof: NO overlay layer is ever drawn on the canvas in native mode. */
const drawStats = {
  terrainOnly: true,
  drawn: { terrainChunks: 0, hero: 1, overviewBitmap: 0 },
  overlays: { buildings: 0, walls: 0, roofs: 0, doors: 0, props: 0, markers: 0, labels: 0, helipad: 0, hudOnCanvas: 0, particles: 0 },
  viewerGuides: { viewportRect: 0 },
  viewerCursor: { playerMarker: 0 },
  lens: { hero: 0, terrainChunks: 0, followCamera: true },
  physicalLayerLoaded: false,
  sceneDataLoaded: false,
  zoomMode: 'NATIVE_1X' as string
};

/** Smooth perceptual zoom: level 0 -> FIT, level 1 -> native TILE px/tile. */
function pxPerTile() { return FIT_PX_PER_TILE * Math.pow(TILE / FIT_PX_PER_TILE, S.zoomLevel); }
function zoomScale() { return pxPerTile() / TILE; }
function zoomMode() { return S.zoomLevel >= 0.999 ? 'NATIVE_1X' : 'WHOLE_MAP_OVERVIEW'; }
function mapFitsViewport() { return FRAME_W * pxPerTile() <= VIEW_W + 0.5 && FRAME_H * pxPerTile() <= VIEW_H + 0.5; }

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
function setZoom(level: number) {
  S.zoomLevel = clamp(Number(level) || 0, 0, 1);
  if (S.zoomLevel > 0.995) S.zoomLevel = 1;
  if (S.zoomLevel < 0.005) S.zoomLevel = 0;
  syncUI();
  return S.zoomLevel;
}
function zoomFit() { return setZoom(0); }
function zoomNative() { return setZoom(1); }
function toggleZoom() { return S.zoomLevel > 0.001 ? zoomFit() : zoomNative(); }
function setGuides(on: boolean) { S.guides = !!on; syncUI(); return S.guides; }
const FOLLOW_MODES = ['FIT_FOLLOW', 'CENTER_FOLLOW', 'LOCK'] as const;
const FOLLOW_LABEL: Record<string, string> = { FIT_FOLLOW: 'Fit', CENTER_FOLLOW: 'Center', LOCK: 'Khoá' };
function setFollowMode(m: string) { if ((FOLLOW_MODES as readonly string[]).includes(m)) S.followMode = m as any; syncUI(); return S.followMode; }
function cycleFollow() { return setFollowMode(FOLLOW_MODES[(FOLLOW_MODES.indexOf(S.followMode as any) + 1) % FOLLOW_MODES.length]); }
function setLens(on: boolean) { S.lens = !!on; syncUI(); return S.lens; }

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
    else if (code === 'KeyZ') toggleZoom();
    else if (code === 'KeyV') zoomNative();
    else if (code === 'KeyB') setGuides(!S.guides);
    else if (code === 'KeyF') cycleFollow();
    else if (code === 'KeyL') setLens(!S.lens);
    else if (code === 'Comma') setZoom(S.zoomLevel - 0.08);
    else if (code === 'Period') setZoom(S.zoomLevel + 0.08);
  }
  if (S.inputLog.length < 4000) S.inputLog.push({ code, type, t: Math.round(S.simMs) });
}
window.addEventListener('keydown', (e) => {
  if (MOVE_KEYS.includes(e.code) || CONTROL_KEYS.includes(e.code)) e.preventDefault();
  key(e.code, 'down');
});
window.addEventListener('keyup', (e) => key(e.code, 'up'));
window.addEventListener('blur', () => S.pressed.clear());
// Mouse wheel = zoom out / in (viewer only).
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(S.zoomLevel - Math.sign(e.deltaY) * 0.06);
}, { passive: false });

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
  if (zoomMode() === 'WHOLE_MAP_OVERVIEW' && !overviewProgress().ready) buildOverviewRows(6);
  draw(now);
  S.frameMs.push(dt); if (S.frameMs.length > 600) S.frameMs.shift();
  requestAnimationFrame(loop);
};

function draw(now: number) {
  drawStats.drawn.terrainChunks = 0; drawStats.drawn.overviewBitmap = 0;
  drawStats.drawn.hero = 0;
  drawStats.viewerGuides.viewportRect = 0;
  drawStats.viewerCursor.playerMarker = 0;
  drawStats.lens.hero = 0; drawStats.lens.terrainChunks = 0;
  drawStats.zoomMode = zoomMode();
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (zoomMode() === 'WHOLE_MAP_OVERVIEW') drawOverview();
  else drawNative(now);
  drawLens(now);
}

function drawNative(now: number) {
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
  drawStats.drawn.hero = 1;
}

/**
 * Overview camera axis. `S.x/S.y` are WORLD PIXELS, `ppt` is px per TILE, so
 * the player must be converted with `/ TILE` before projecting. When the map
 * is smaller than the viewport (exact FIT) the whole frame must stay visible,
 * so follow is a PROPORTIONAL slide within the letterbox margin; when it is
 * larger, follow is a normal clamped camera centred on the player.
 */
function overviewAxis(playerPx: number, viewLen: number, ppt: number, frameLen: number) {
  const mapLen = frameLen * ppt;
  const tx = playerPx / TILE;
  const want = viewLen / 2 - tx * ppt;              // player exactly centred
  const center = (viewLen - mapLen) / 2;           // whole map exactly centred
  if (mapLen > viewLen + 0.01) return { off: clamp(want, viewLen - mapLen, 0), gain: 1, whole: false };
  const half = (viewLen - mapLen) / 2;
  let gain = 0;
  if (S.followMode === 'CENTER_FOLLOW') gain = 1;               // player exactly centred, map may clip
  else if (S.followMode === 'FIT_FOLLOW') gain = Math.min(1, half > 0 ? half / (mapLen / 2) : 0); // whole map stays visible
  const off = center + gain * (want - center);
  const whole = off >= -0.01 && off + mapLen <= viewLen + 0.01;
  return { off, gain, whole };
}
/** Whole-map FIT view with a REAL player-following camera. */
function drawOverview() {
  const ppt = pxPerTile();
  const ax = overviewAxis(S.x, VIEW_W, ppt, FRAME_W);
  const ay = overviewAxis(S.y, VIEW_H, ppt, FRAME_H);
  const offX = ax.off, offY = ay.off;
  const mapW = FRAME_W * ppt, mapH = FRAME_H * ppt;
  S.ovOffX = offX; S.ovOffY = offY; S.ovMapW = mapW; S.ovMapH = mapH;
  S.ovGainX = ax.gain; S.ovGainY = ay.gain;
  const ov = getOverview();
  if (ov) {
    g.imageSmoothingEnabled = false;
    g.drawImage(ov, Math.round(offX), Math.round(offY), Math.ceil(mapW), Math.ceil(mapH));
    drawStats.drawn.overviewBitmap = 1;
  }
  const px = Math.round(offX + (S.x / TILE) * ppt), py = Math.round(offY + (S.y / TILE) * ppt);
  S.markerX = px; S.markerY = py;
  if (S.guides) {
    const vw = (VIEW_W / TILE) * ppt, vh = (VIEW_H / TILE) * ppt;
    const vx = Math.round(offX + (S.x / TILE - VIEW_W / (2 * TILE)) * ppt);
    const vy = Math.round(offY + (S.y / TILE - VIEW_H / (2 * TILE)) * ppt);
    g.save();
    g.strokeStyle = 'rgba(20,16,24,0.9)'; g.lineWidth = 3;
    g.strokeRect(vx, vy, Math.max(2, Math.round(vw)), Math.max(2, Math.round(vh)));
    g.strokeStyle = 'rgba(255,240,180,0.95)'; g.lineWidth = 1;
    g.strokeRect(vx, vy, Math.max(2, Math.round(vw)), Math.max(2, Math.round(vh)));
    g.restore();
    drawStats.viewerGuides.viewportRect = 1;
  }
  // HERO MARKER — ALWAYS drawn (missing in the first zoom attempt, which made
  // it look like the camera stopped following the character).
  g.save();
  g.strokeStyle = 'rgba(12,16,28,0.95)'; g.lineWidth = 3;
  g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#ffe27a'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff6c8'; g.fillRect(px - 1, py - 1, 3, 3);
  g.restore();
  drawStats.viewerCursor.playerMarker = 1;
}

/**
 * Native 1x FOLLOW CAMERA, drawn in its own HTML canvas (NOT an overlay layer
 * on the game canvas). The hero is ALWAYS centred here at every zoom level,
 * including the smallest whole-map zoom.
 */
function drawLens(now: number) {
  if (!S.lens || !S.hudVisible) return;
  const LW = lensCanvas.width, LH = lensCanvas.height;
  const cx = Math.round(S.x - LW / 2), cy = Math.round(S.y - LH / 2);
  lg.fillStyle = '#0b1020'; lg.fillRect(0, 0, LW, LH);
  const c0 = Math.floor(cx / (RENDER_CHUNK * TILE)), c1 = Math.floor((cx + LW) / (RENDER_CHUNK * TILE));
  const r0 = Math.floor(cy / (RENDER_CHUNK * TILE)), r1 = Math.floor((cy + LH) / (RENDER_CHUNK * TILE));
  let chunks = 0;
  for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++)
    if (i >= 0 && j >= 0 && i < Math.ceil(FRAME_W / RENDER_CHUNK) && j < Math.ceil(FRAME_H / RENDER_CHUNK)) {
      lg.drawImage(getDisplayChunk(i, j), Math.round(i * RENDER_CHUNK * TILE - cx), Math.round(j * RENDER_CHUNK * TILE - cy));
      chunks++;
    }
  const moving = MOVE_KEYS.some(k => S.pressed.has(k));
  const hero: any = art.hero.male;
  const frames = hero[(moving ? 'walk' : 'idle') + S.dir] as HTMLCanvasElement[];
  const spr = frames[Math.floor(now / (moving ? 120 : 600)) % frames.length];
  lg.drawImage(spr, Math.round(LW / 2 - HERO_W / 2), Math.round(LH / 2 - 19));
  drawStats.lens.terrainChunks = chunks; drawStats.lens.hero = 1;
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
    viewport: [VIEW_W, VIEW_H], dpr: window.devicePixelRatio || 1,
    zoom: Number(zoomScale().toFixed(6)), zoomLevel: S.zoomLevel,
    zoomMode: zoomMode(), pxPerTile: Number(pxPerTile().toFixed(6)),
    followCamera: S.followMode !== 'LOCK', followMode: S.followMode,
    cameraFollowsPlayer: S.followMode !== 'LOCK', lensEnabled: S.lens,
    overviewCamera: {
      offset: [Number(S.ovOffX.toFixed(2)), Number(S.ovOffY.toFixed(2))],
      mapPx: [Number(S.ovMapW.toFixed(2)), Number(S.ovMapH.toFixed(2))],
      wholeMapVisible: S.ovOffX >= -0.01 && S.ovOffY >= -0.01 && S.ovOffX + S.ovMapW <= VIEW_W + 0.01 && S.ovOffY + S.ovMapH <= VIEW_H + 0.01,
      cameraCenteredOnPlayer: Math.abs(S.markerX - VIEW_W / 2) <= 1 && Math.abs(S.markerY - VIEW_H / 2) <= 1,
      anchorsOnPlayer: S.followMode !== 'LOCK',
      followGain: [Number(S.ovGainX.toFixed(4)), Number(S.ovGainY.toFixed(4))],
      followsPlayer: S.followMode !== 'LOCK',
      mode: S.followMode,
      nativeCameraStillFollows: true
    },
    playerMarkerScreen: [S.markerX, S.markerY],
    fitPxPerTile: Number(FIT_PX_PER_TILE.toFixed(6)), mapFitsViewport: mapFitsViewport(),
    cameraTrick: false,
    U, TILE, frameTiles: [FRAME_W, FRAME_H], addressableCells: FRAME_W * FRAME_H,
    heroSpritePx: [HERO_W, HERO_H], speedBasePxPerSec: SPEED, speedMultiplier: S.mult,
    speedMultiplierRange: [1, 10], speedPxPerSec: SPEED * S.mult,
    collision: S.collision ? 'NATURAL_TERRAIN_ONLY' : 'FREE_ROAM__NO_COLLISION',
    player: { px: S.x, py: S.y, tile: [tx, ty], au: tileToAuCentre(tx, ty), dir: S.dir },
    camera: { x: S.camX, y: S.camY, anchorTile: ANCHOR_TILE },
    terrain: s ? { tile: s.tile, tileRendered: u05Tile(tx, ty), biome: s.biome, authoredLand: s.authoredLand, water: s.water, road: s.road, poiId: s.poiId } : null,
    despeckle: despeckleStats(),
    draw: { ...JSON.parse(JSON.stringify(drawStats)), zoomMode: zoomMode() },
    overview: { ...overviewProgress(), bitmapSize: overviewSize(), guides: S.guides, followMode: S.followMode },
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
const zoomRange = document.getElementById('zoomRange') as HTMLInputElement;
const zoomLabel = document.getElementById('zoomLabel')!;
const collisionBtn = document.getElementById('collision') as HTMLButtonElement;
const hideBtn = document.getElementById('hide') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const fitBtn = document.getElementById('fit') as HTMLButtonElement;
const nativeBtn = document.getElementById('native') as HTMLButtonElement;
const guidesBtn = document.getElementById('guides') as HTMLButtonElement;
const followBtn = document.getElementById('follow') as HTMLButtonElement;
const lensBtn = document.getElementById('lensBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;
range.oninput = () => setSpeed(Number(range.value));
zoomRange.oninput = () => setZoom(Number(zoomRange.value));
for (const b of Array.from(document.querySelectorAll('#presets button[data-speed]'))) (b as HTMLButtonElement).onclick = () => setSpeed(Number((b as HTMLButtonElement).dataset.speed));
collisionBtn.onclick = () => setCollision(!S.collision);
hideBtn.onclick = () => toggleHud();
resetBtn.onclick = () => reset();
fitBtn.onclick = () => zoomFit();
nativeBtn.onclick = () => zoomNative();
guidesBtn.onclick = () => setGuides(!S.guides);
followBtn.onclick = () => cycleFollow();
lensBtn.onclick = () => setLens(!S.lens);
function toggleHud() {
  S.hudVisible = !S.hudVisible;
  ui.classList.toggle('hidden', !S.hudVisible);
  syncUI();
}
function syncUI() {
  range.value = String(S.mult);
  speedLabel.textContent = `x${S.mult} · ${SPEED * S.mult} px/s`;
  zoomRange.value = String(S.zoomLevel);
  const z = zoomScale();
  zoomLabel.textContent = S.zoomLevel === 0 ? 'TOÀN CẢNH · 0.8%' : S.zoomLevel === 1 ? '1× (native)' : `${(z * 100).toFixed(1)}% · 1:${Math.round(1 / z)}`;
  collisionBtn.textContent = `Chặn địa hình: ${S.collision ? 'BẬT' : 'TẮT'}`;
  collisionBtn.classList.toggle('on', S.collision);
  fitBtn.classList.toggle('on', S.zoomLevel === 0);
  nativeBtn.classList.toggle('on', S.zoomLevel === 1);
  guidesBtn.classList.toggle('on', S.guides);
  guidesBtn.textContent = `Khung nhìn (B): ${S.guides ? 'BẬT' : 'TẮT'}`;
  followBtn.classList.toggle('on', S.followMode !== 'LOCK');
  followBtn.textContent = `Follow (F): ${FOLLOW_LABEL[S.followMode]}`;
  lensBtn.classList.toggle('on', S.lens);
  lensBtn.textContent = `Camera 1× (L): ${S.lens ? 'BẬT' : 'TẮT'}`;
  for (const b of Array.from(document.querySelectorAll('#presets button[data-speed]'))) (b as HTMLButtonElement).classList.toggle('on', Number((b as HTMLButtonElement).dataset.speed) === S.mult);
  hideBtn.textContent = S.hudVisible ? 'Ẩn bảng (H)' : 'Hiện bảng (H)';
}
setInterval(() => {
  if (!S.hudVisible) return;
  const s = state();
  statusEl.textContent =
    `x${s.speedMultiplier} · ${s.speedPxPerSec} px/s  |  ${s.collision}  |  zoom=${s.zoomMode} ${s.zoomLevel === 0 ? 'FIT' : (s.zoom * 100).toFixed(1) + '%'}  |  U=${s.U} TILE=${s.TILE} hero=${s.heroSpritePx.join('x')} dpr=${s.dpr}\n` +
    `tile=${s.player.tile.join(',')}  AU=${s.player.au.map((v: number) => v.toFixed(2)).join(',')}  px=${s.player.px.toFixed(0)},${s.player.py.toFixed(0)}  cam=${s.camera.x},${s.camera.y}\n` +
    `biome=${s.terrain?.biome}  tileCode=${s.terrain?.tile}  road=${s.terrain?.road}  water=${s.terrain?.water}  land=${s.terrain?.authoredLand}\n` +
    `overviewCam offset=${s.overviewCamera.offset.join(',')} mapPx=${s.overviewCamera.mapPx.join(',')} wholeMapVisible=${s.overviewCamera.wholeMapVisible} anchorsOnPlayer=${s.overviewCamera.anchorsOnPlayer}
` +
    `frame=${s.frameTiles.join('x')} cells=${s.addressableCells} materializedAllCells=${s.stats.materializedAllCells}  chunks=${s.stats.residentChunks}/${s.stats.maxResidentChunks}  canvases=${s.stats.displayCanvases}/${s.stats.maxDisplayCanvases}\n` +
    `overview=${s.overview.rowsDone}/${s.overview.rowsTotal} rows, ${s.overview.pixels} px, stride=${s.overview.strideTiles} tiles, samples=${s.overview.tileSamples}, fullFrameAllocated=${s.overview.fullFrameAllocated}\n` +
    `overlays=${JSON.stringify(s.draw.overlays)}  guides=${JSON.stringify(s.draw.viewerGuides)}  heroMarker=${s.draw.viewerCursor.playerMarker}  lens1x=${JSON.stringify(s.draw.lens)}  movedPx=${s.stats.movedPx}  frameMs p50/p95=${s.frameMs.p50.toFixed(1)}/${s.frameMs.p95.toFixed(1)}`;
}, 250);

(window as any).__terrain = {
  ready: true, state,
  setSpeed, setCollision, toggleHud,
  setZoom, zoomFit, zoomNative, toggleZoom, setGuides, setFollow: setFollowMode, cycleFollow, setLens,
  pxPerTile: () => pxPerTile(), zoomScale, mapFitsViewport,
  overviewCamera: () => ({ offset: [S.ovOffX, S.ovOffY], mapPx: [S.ovMapW, S.ovMapH], mode: S.followMode, gain: [S.ovGainX, S.ovGainY] }),
  overviewStats: () => ({ ...overviewProgress(), bitmapSize: overviewSize() }),
  reset: (tx?: number, ty?: number) => { reset(tx ?? ANCHOR_TILE[0], ty ?? ANCHOR_TILE[1]); return state(); },
  clearInputLog: () => { S.inputLog = []; },
  inputLog: () => S.inputLog.slice(),
  sampleTile, u05Tile, terrainBlocked, auToTile, tileToAuCentre,
  despeckleStats,
  /** Count isolated A-surrounded-by-4-B cells; raw = GOLD sampler, painted = despeckled. */
  isolatedCells: (cx: number, cy: number, w = 60, h = 40) => {
    let raw = 0, painted = 0;
    for (let y = cy - (h >> 1); y < cy + (h >> 1); y++) for (let x = cx - (w >> 1); x < cx + (w >> 1); x++) {
      const rc = sampleTile(x, y), rn = sampleTile(x, y - 1), rs = sampleTile(x, y + 1), re = sampleTile(x + 1, y), rw = sampleTile(x - 1, y);
      if (rc && rn && rs && re && rw && rn.tile === rs.tile && rs.tile === re.tile && re.tile === rw.tile && rw.tile !== rc.tile) raw++;
      const pc = u05Tile(x, y), pn = u05Tile(x, y - 1), ps = u05Tile(x, y + 1), pe = u05Tile(x + 1, y), pw = u05Tile(x - 1, y);
      if (pn === ps && ps === pe && pe === pw && pw !== pc) painted++;
    }
    return { centre: [cx, cy], window: [w, h], rawIsolated: raw, paintedIsolated: painted };
  },
  clearCaches: () => { resetCaches(); resetDisplay(); },
  stats: () => ({ ...worldStats(), ...displayStats() })
};
reset();
// Deep link: ?zoom=fit opens directly at the smallest whole-map zoom.
if (new URLSearchParams(location.search).get('zoom') === 'fit') zoomFit();
syncUI();
S.lastFrame = performance.now();
requestAnimationFrame(loop);
