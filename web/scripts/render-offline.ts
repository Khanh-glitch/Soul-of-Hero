// Offline renderer: renders ARCANA20 lead-mode frames via the CPU source
// runners and writes PNGs for visual inspection (no GPU needed).
// Usage: npx esbuild scripts/render-offline.ts --bundle --format=esm --platform=node --outfile=/tmp/render-offline.mjs && node /tmp/render-offline.mjs
import { CRunner, CATALOG } from '../src/game/arcana_d20/source/cRunner';
import { BRunner } from '../src/game/arcana_d20/source/bRunner';
import { ARunner } from '../src/game/arcana_d20/source/aRunner';
import { RedesignRunner, REDESIGNS } from '../src/game/arcana_d20/source/redesign';
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/arcana20-offline';
mkdirSync(OUT, { recursive: true });

function crc32(buf: Buffer) { let c: number; const t = crc32.t ?? (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let crc = 0xffffffff; for (const b of buf) crc = t[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function png(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => { raw[y * (w * 4 + 1) + 1 + i] = v; }); }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// a readable fake "SOH world": gradient sky + ground + a house block, so
// environment blending is visible offline
function world(w: number, h: number): Uint8ClampedArray {
  const b = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const g = y / h;
    let r = 90 + 80 * (1 - g), gg = 130 + 60 * (1 - g), bl = 90 + 40 * g;
    if (y > h * 0.72) { r = 70 + 30 * Math.sin(x * 0.05); gg = 95 + 25 * Math.sin(x * 0.03 + 2); bl = 55; } // ground
    if (x > w * 0.62 && x < w * 0.78 && y > h * 0.42 && y < h * 0.72) { r = 120; gg = 90; bl = 70; } // house
    b[i] = r; b[i + 1] = gg; b[i + 2] = bl; b[i + 3] = 255;
  }
  return b;
}

const B_IDS = new Set([2, 3, 8]);
const C_IDS = new Set([7, 10, 15, 17]);
const FUSION_A = new Set([1, 5, 9, 11, 16]);
const REDESIGN_IDS = new Set(Object.keys(REDESIGNS).map(Number));

for (const c of CATALOG) {
  const phases = [0.18, 0.5, 0.78];
  for (const ph of phases) {
    const t = Math.min(c.climax * 1.05, c.dur * ph) + 0.001;
    let out: Uint8ClampedArray, w: number, h: number;
    if (B_IDS.has(c.id)) { const r = new BRunner(); r.setWorld(world(384, 216)); r.cast(c.index); r.seek(Math.min(t, r.duration)); out = r.out; w = 384; h = 216; }
    else if (C_IDS.has(c.id)) { const r = new CRunner(); r.setWorld(world(384, 216)); r.cast(c.index); r.seek(t); out = r.out; w = 384; h = 216; }
    else if (REDESIGN_IDS.has(c.id)) { const r = new RedesignRunner(); r.setWorld(world(384, 216)); r.cast(c.id); r.seek(Math.min(t, r.duration)); out = r.out; w = 384; h = 216; }
    else if (FUSION_A.has(c.id)) { const r = new ARunner(); r.setWorld(world(416, 234)); r.cast(c.index); r.seek(Math.min(t, r.duration)); out = r.out; w = 416; h = 234; }
    else { const r = new CRunner(); r.setWorld(world(384, 216)); r.cast(c.index); r.seek(t); out = r.out; w = 384; h = 216; }
    writeFileSync(`${OUT}/lead-${String(c.id).padStart(2, '0')}-p${Math.round(ph * 100)}.png`, png(w, h, out));
  }
  console.log('rendered #' + c.id, c.name);
}
console.log('done ->', OUT);
