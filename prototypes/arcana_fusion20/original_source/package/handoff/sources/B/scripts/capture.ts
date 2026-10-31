// Node capture tool: renders frames straight from the real effect code
// (same software rasteriser the browser uses) and writes PNGs.
// Usage: node scripts/run-capture.mjs [climax|strip] [ids...]
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { EFFECTS } from '../src/effects/index';
import { makeRenderer, renderFrame } from '../src/engine/scene';
import { W, H } from '../src/engine/renderer';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function png(w: number, h: number, rgba: Uint8Array) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** CPU approximation of the WebGL pixel-bloom pass, so captures match the browser */
function bloom(src: Uint8ClampedArray) {
  const bright = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      const v = src[i * 4 + c] / 255;
      bright[i * 3 + c] = Math.max(0, v - 0.55) * 1.6;
    }
  }
  const blur = (a: Float32Array, dx: number, dy: number, R: number) => {
    const o = new Float32Array(a.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s0 = 0, s1 = 0, s2 = 0, n = 0;
        for (let k = -R; k <= R; k++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx * k)), yy = Math.min(H - 1, Math.max(0, y + dy * k));
          const w = 1 - Math.abs(k) / (R + 1);
          const j = (yy * W + xx) * 3;
          s0 += a[j] * w; s1 += a[j + 1] * w; s2 += a[j + 2] * w; n += w;
        }
        const i = (y * W + x) * 3;
        o[i] = s0 / n; o[i + 1] = s1 / n; o[i + 2] = s2 / n;
      }
    return o;
  };
  const b = blur(blur(bright, 1, 0, 6), 0, 1, 6);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = src[i * 4 + c] + b[i * 3 + c] * 255 * 0.9;
    out[i * 4 + 3] = 255;
  }
  return out;
}
function upscale(src: Uint8ClampedArray, w: number, h: number, s: number) {
  const out = new Uint8Array(w * s * h * s * 4);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) {
      const i = ((y / s | 0) * w + (x / s | 0)) * 4, o = (y * w * s + x) * 4;
      out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = 255;
    }
  return out;
}

const mode = process.argv[2] || 'climax';
const ids = process.argv.slice(3).map(Number);
const list = EFFECTS.filter((e) => !ids.length || ids.includes(e.id));
mkdirSync('shots', { recursive: true });
if (mode === 'sheet') {
  const cols = 2, rows = Math.ceil(list.length / cols);
  const sheet = new Uint8Array(W * cols * H * rows * 4);
  list.forEach((fx, k) => {
    const r = makeRenderer();
    const st = fx.setup(r);
    const buf = new Uint8ClampedArray(W * H * 4);
    const tt = process.env.T ? fx.climax + Number(process.env.T) : fx.climax;
    renderFrame(r, fx, st, tt, tt, buf);
    const img = bloom(buf);
    const ox = (k % cols) * W, oy = Math.floor(k / cols) * H;
    for (let y = 0; y < H; y++) sheet.set(img.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * W * cols + ox) * 4);
  });
  writeFileSync(`shots/sheet${process.env.V || ''}.png`, png(W * cols, H * rows, sheet));
  console.log('sheet ok');
  process.exit(0);
}
for (const fx of list) {
  const r = makeRenderer();
  const st = fx.setup(r);
  const buf = new Uint8ClampedArray(W * H * 4);
  const name = `${String(fx.id).padStart(2, '0')}-${fx.name.toLowerCase().replace(/\s+/g, '-')}`;
  const t0 = Date.now();
  if (mode === 'climax') {
    renderFrame(r, fx, st, fx.climax, fx.climax, buf);
    writeFileSync(`shots/${name}${process.env.V || ""}.png`, png(W * 2, H * 2, upscale(bloom(buf), W, H, 2)));
  } else {
    // filmstrip: 8 frames across the full duration (3 columns x 3 rows incl. climax)
    const times = mode === 'strip' ? [0.12, 0.25, 0.4, 0.52, 0.62, 0.75, 0.88, 0.97].map((f) => f * fx.duration) : process.argv.slice(4).map(Number);
    if (mode === 'strip') times.push(fx.climax);
    times.sort((a, b) => a - b);
    const cols = 3, rows = Math.ceil(times.length / cols);
    const sheet = new Uint8Array(W * cols * H * rows * 4);
    times.forEach((tt, k) => {
      renderFrame(r, fx, st, tt, tt, buf);
      const img = bloom(buf);
      const ox = (k % cols) * W, oy = Math.floor(k / cols) * H;
      for (let y = 0; y < H; y++) sheet.set(img.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * W * cols + ox) * 4);
    });
    writeFileSync(`shots/strip-${name}${process.env.V || ""}.png`, png(W * cols, H * rows, sheet));
  }
  console.log(name, 'ok', Date.now() - t0, 'ms');
}
