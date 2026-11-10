// Active-frame source-window closure — offline before/after evidence.
// Uses the REAL captured SOH world region (evidence/avfx20-rect/fixtures/world-*.rgba,
// sampled from the live game's worldCanvas at 640x360, region 384x216 at 128,78) and
// the real RedesignRunner. Emulates the presenter frame graph on CPU:
//   BEFORE (frozen 354054e): FRAME_FS replaces the region with the composited runner
//     output verbatim, plus the lab's 14px edge feather toward the raw world sample.
//   AFTER (this fix): FRAME_FS renders scene + signedDelta * influence/255.
// Usage: npx esbuild scripts/render-rect-evidence.ts --bundle --format=esm --platform=node --outfile=/tmp/rect-evidence.mjs && node /tmp/rect-evidence.mjs
import { RedesignRunner, REDESIGNS } from '../src/game/arcana_d20/source/redesign';
import { deflateSync } from 'node:zlib';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

import { join } from "node:path";

// run from web/:  node /tmp/rect-evidence.mjs  (default OUT = <cwd>/evidence/avfx20-rect)
const OUT = process.argv[2] || join(process.cwd(), 'evidence/avfx20-rect');
mkdirSync(OUT, { recursive: true });
const W = 384, H = 216;

function crc32(buf: Buffer) { let c: number; const t = crc32.t ?? (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let crc = 0xffffffff; for (const b of buf) crc = t[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function png(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => { raw[y * (w * 4 + 1) + 1 + i] = v; }); }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** BEFORE: opaque region replace (old FRAME_FS) + 14px feather (old lab) */
function presentBefore(scene: Uint8ClampedArray, out: Uint8ClampedArray, region: Uint8ClampedArray, F = 14) {
  const p = new Uint8ClampedArray(scene);
  const o = new Uint8ClampedArray(out);
  for (let y = 0; y < H; y++) {
    const dy = Math.min(y, H - 1 - y);
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, W - 1 - x, dy);
      if (d >= F) continue;
      const k = (d / F) ** 2 * (3 - 2 * (d / F));
      const di = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) o[di + c] = Math.round(region[di + c] * (1 - k) + o[di + c] * k);
    }
  }
  p.set(o);
  return p;
}
/** AFTER: signed delta gated by influence (new FRAME_FS branch) */
function presentAfter(scene: Uint8ClampedArray, delta: Float32Array, infl: Uint8Array) {
  const p = new Uint8ClampedArray(scene);
  for (let i = 0; i < W * H; i++) {
    const k = infl[i] / 255;
    for (let c = 0; c < 3; c++) p[i * 4 + c] = Math.max(0, Math.min(255, Math.round(scene[i * 4 + c] + delta[i * 4 + c] * k)));
  }
  return p;
}
function edgeStats(diff: (i: number, c: number) => number) {
  let eN = 0, eSum = 0, eMax = 0, iSum = 0, iN = 0, act = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = Math.min(x, W - 1 - x, y, H - 1 - y);
    const m = Math.max(Math.abs(diff(i, 0)), Math.abs(diff(i, 1)), Math.abs(diff(i, 2)));
    if (m > 6) act++;
    if (d < 14) { eN++; eSum += m; eMax = Math.max(eMax, m); } else { iN++; iSum += m; }
  }
  return { edgeMean: +(eSum / eN).toFixed(2), edgeMax: eMax, interiorMean: +(iSum / iN).toFixed(2), fracChanged: +(act / (W * H)).toFixed(4) };
}

async function run() {
  const day = new Uint8ClampedArray(readFileSync(join(OUT, 'fixtures/world-day.rgba')).buffer as ArrayBuffer);
  const night = new Uint8ClampedArray(readFileSync(join(OUT, 'fixtures/world-night.rgba')).buffer as ArrayBuffer);
  const report: any = { note: 'CPU emulation of the presenter frame graph over the REAL captured SOH world region (640x360 canvas, region 384x216 at 128,78). BEFORE=frozen 354054e opaque replace+14px feather; AFTER=signed delta * influence.', spells: {} };
  for (const [tag, world] of [['day', day], ['night', night]] as [string, Uint8ClampedArray][]) {
    for (const id of [4, 6, 12, 13, 14, 18]) {
      const dur = REDESIGNS[id].dur, cl = REDESIGNS[id].climax;
      const phases: [string, number][] = [['open', Math.min(1.0, dur * 0.2)], ['peak', cl], ['impact', Math.min(cl + 0.15, dur)], ['out', dur + 0.79]];
      report.spells[`#${id}-${tag}`] = {};
      for (const [ph, t] of phases) {
        const r = new RedesignRunner();
        r.setWorld(world); r.cast(id);
        await r.seekAsync(t);
        const out = new Uint8ClampedArray(r.out);
        const infl = r.influenceMask(3);
        const delta = new Float32Array(W * H * 4);
        for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) delta[i * 4 + c] = out[i * 4 + c] - world[i * 4 + c];
        const before = presentBefore(world, out, world);
        const after = presentAfter(world, delta, infl);
        writeFileSync(join(OUT, `before-#${id}-${tag}-${ph}.png`), png(W, H, before));
        writeFileSync(join(OUT, `after-#${id}-${tag}-${ph}.png`), png(W, H, after));
        writeFileSync(join(OUT, `raw-#${id}-${tag}-${ph}.png`), png(W, H, out));
        const dB = (i: number, c: number) => before[i * 4 + c] - world[i * 4 + c];
        const dA = (i: number, c: number) => after[i * 4 + c] - world[i * 4 + c];
        report.spells[`#${id}-${tag}`][ph] = { t: +t.toFixed(2), beforeVsScene: edgeStats(dB), afterVsScene: edgeStats(dA), inflEdgeFrac: +(() => { let n = 0, N = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.min(x, W - 1 - x, y, H - 1 - y); if (d < 14) { N++; if (infl[y * W + x]) n++; } } return (n / N).toFixed(4); })() };
      }
    }
  }
  writeFileSync(join(OUT, 'rect-evidence.json'), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries<any>(report.spells)) {
    for (const [ph, m] of Object.entries<any>(v)) console.log(k, ph, 'BEFORE', JSON.stringify(m.beforeVsScene), 'AFTER', JSON.stringify(m.afterVsScene), 'inflEdge', m.inflEdgeFrac);
  }
}
run();
