#!/usr/bin/env node
/**
 * Reproducible re-architecture patches applied to the VERBATIM Gameplay copy in
 * web-large/. The legacy copy in web-legacy/ is NEVER patched.
 * Run once after tools/vendor.mjs. Idempotent.
 *
 *  - render.ts: no WW/WH=200, no `cy*100+cx` cache key; uses LW.w/LW.h and the
 *    collision-free profile-scoped chunkKey(); all state lookups go through the
 *    chunk-backed compat layer; bounded minimap (never a 2.8M-pixel canvas).
 *  - world-economy.ts: cell cap is profile-driven, default unchanged 1,000,000.
 *  - large/validate.ts (written separately): exact profile-aware package validator.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const PILOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LW_SRC || path.join(PILOT, 'web-large', 'src', 'game');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(SRC, f), s);

let note = [];
// ---------------- render.ts ----------------
let r = read('render.ts');
if (r.includes('from \'./large/compat\'')) {
  note.push('render.ts already patched');
} else {
  const expect = [
    "import { TILE, WW, WH, VIEW_W, VIEW_H, T, hash2, clamp, type GameState, type RunState, type Creature, type Entity } from './core';",
    "import { getWorld, SRC_KEYS, fbm } from './world';",
    "import { effTile, sourceAt, darkness, weatherAt, isRagnarok, entsAt, buildReason, C, roofRoom } from './engine';",
    "import { FX, PROJ, HAZ, activeStack } from './sim';",
  ];
  const repl = [
    "import { TILE, VIEW_W, VIEW_H, T, hash2, clamp, type GameState, type RunState, type Creature, type Entity } from './core';",
    "import { getWorld, SRC_KEYS, fbm, ZONES } from './large/compat';",
    "import { effTile, sourceAt, darkness, weatherAt, isRagnarok, entsAt, buildReason, C, roofRoom } from './large/compat';",
    "import { FX, PROJ, HAZ, activeStack } from './large/compat';",
  ];
  for (let i = 0; i < expect.length; i++) { if (!r.includes(expect[i])) throw Error('LW01_RENDER_IMPORT_MISSING ' + i); r = r.replace(expect[i], repl[i]); }
  r = r.replace("import { getArt, pixelText, mk, type Sprite } from './art';",
    "import { getArt, pixelText, mk, type Sprite } from './art';\n" +
    "// LW-01: dimension-agnostic world profile + collision-free chunk identity.\n" +
    "import { LW } from './large/compat';\nimport { chunkKey } from './large/coords';");
  r = r.replace('const CH = 16; const chunkCache = new Map<number, HTMLCanvasElement>();',
    'const CH = 16; const chunkCache = new Map<string, HTMLCanvasElement>();');
  r = r.replace(/\bWW\b/g, 'LW.w').replace(/\bWH\b/g, 'LW.h');
  r = r.replace("export function resetRenderCaches() { chunkCache.clear(); lastRunId = ''; mapCanvas = null; }",
    "export function resetRenderCaches() { chunkCache.clear(); lastRunId = ''; mapCanvas = null; }\n" +
    "export function renderCacheStats() { return { chunks: chunkCache.size, bytes: chunkCache.size * CH * TILE * CH * TILE * 4 }; }");
  r = r.replace('function getChunk(r: RunState, cx: number, cy: number) { const k = cy * 100 + cx;',
    'function getChunk(r: RunState, cx: number, cy: number) { const k = chunkKey(LW.p ? LW.p.id : \'legacy200\', cx, cy);');
  r = r.replace('chunkCache.delete((((ty + dy) / CH) | 0) * 100 + (((tx + dx) / CH) | 0));',
    'chunkCache.delete(chunkKey(LW.p ? LW.p.id : \'legacy200\', (((tx + dx) / CH) | 0), (((ty + dy) / CH) | 0)));');
  const oldMap = `export function getMapCanvas(run?: RunState) {
  const version = run?.sourceLayoutVersion ?? 1;
  if (mapCanvas && mapSourceVersion === version) return mapCanvas; mapSourceVersion = version; const w = getWorld(); mapCanvas = document.createElement('canvas'); mapCanvas.width = LW.w; mapCanvas.height = LW.h; const g = mapCanvas.getContext('2d')!; const img = g.createImageData(LW.w, LW.h);
  for (let i = 0; i < LW.w * LW.h; i++) { const t = w.tiles[i]; let c = (PAL[t] || PAL[T.GRASS])[0]; const source = version === 3 ? w.sourceV3[i] : w.src[i] >= 0 ? SRC_KEYS[w.src[i]] : version === 2 && w.sourceOverlayV2[i] >= 0 ? SRC_KEYS[w.sourceOverlayV2[i]] : null; if (source && ['oak', 'pine', 'snowpine', 'palm', 'willow'].includes(source)) c = [c[0] * 0.75, c[1] * 0.8, c[2] * 0.75]; img.data.set([c[0], c[1], c[2], 255], i * 4); }
  g.putImageData(img, 0, 0); return mapCanvas;
}`;
  const newMap = `export function getMapCanvas(run?: RunState) {
  const version = run?.sourceLayoutVersion ?? 1;
  // LW-01: the original minimap allocated one canvas pixel per world tile.
  // For a 2,000x1,400 world that would be 2.8 million pixels per build.
  // Keep it BOUNDED and chunk-backed: a 200x140 overview from resident chunks.
  const MW = Math.min(LW.w, 200), MH = Math.min(LW.h, 140);
  if (mapCanvas && mapSourceVersion === version && mapCanvas.width === MW && mapCanvas.height === MH) return mapCanvas;
  mapSourceVersion = version; mapCanvas = document.createElement('canvas'); mapCanvas.width = MW; mapCanvas.height = MH;
  const g = mapCanvas.getContext('2d')!; const img = g.createImageData(MW, MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const tx = Math.floor(i / MW * LW.w), ty = Math.floor(j / MH * LW.h);
    const t = effTile(run as any, tx, ty); const c = (PAL[t] || PAL[T.GRASS])[0];
    img.data.set([c[0], c[1], c[2], 255], (j * MW + i) * 4);
  }
  g.putImageData(img, 0, 0); return mapCanvas;
}`;
  if (!r.includes(oldMap)) throw Error('LW01_MINIMAP_PATTERN_MISSING');
  r = r.replace(oldMap, newMap);
  const leftovers = [...r.matchAll(/\bWW\b|\bWH\b|cy \* 100 \+ cx|\* 100 \+ \(\(\(tx/g)];
  if (leftovers.length) { console.error(leftovers.map(x => r.slice(Math.max(0, x.index - 60), x.index + 60))); throw Error('LW01_RENDER_STILL_HAS_LEGACY_CONSTANT'); }
  write('render.ts', r); note.push('render.ts patched');
}

// ---------------- world-economy.ts ----------------
let e = read('world-economy.ts');
if (e.includes('setCellCap')) { note.push('world-economy.ts already patched'); }
else {
  const old = `  const n=m.width*m.height; if (!Number.isSafeInteger(n) || n>1_000_000) return [...e,'map exceeds supported cell count'];`;
  if (!e.includes(old)) throw Error('LW01_WORLDECON_PATTERN_MISSING');
  e = e.replace(old,
    `  // LW-01: capacity is an explicit PROFILE decision, not a hard-coded limit.\n  // Legacy 200x200 behaviour is unchanged; a large profile raises its own cap.\n  const n=m.width*m.height; const cap=getCellCap(m.width,m.height);\n  if (!Number.isSafeInteger(n) || n>cap) return [...e,\`map exceeds supported cell count (\${n} > \${cap})\`];`);
  e = `// LW-01: profile-driven cell cap. Default preserves the legacy 1,000,000 limit.\nlet ACTIVE_CELL_CAP = 1_000_000;\nexport function setCellCap(w: number, h: number) { ACTIVE_CELL_CAP = Math.max(1_000_000, w * h); return ACTIVE_CELL_CAP; }\nexport function getCellCap(_w: number, _h: number) { return ACTIVE_CELL_CAP; }\n` + e;
  write('world-economy.ts', e); note.push('world-economy.ts patched');
}
console.log('LW01_PATCH_ENGINE_OK ' + note.join('; ') + '; legacy web-legacy/ untouched');
