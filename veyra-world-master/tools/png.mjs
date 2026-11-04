// Deterministic pure-Node PNG writer + tiny raster drawing primitives.
// No browser, no network, no third-party packages, no ImageMagick/PIL.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
export function writePng(file, w, h, rgb) {
  if (rgb.length !== w * h * 3) throw new Error(`PNG_RGB_LENGTH ${file} ${rgb.length} != ${w * h * 3}`);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 3)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, png);
  return { file, bytes: png.length, width: w, height: h };
}
export function Canvas(w, h, bg = [16, 20, 28]) {
  const px = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[i * 3] = bg[0]; px[i * 3 + 1] = bg[1]; px[i * 3 + 2] = bg[2]; }
  const set = (x, y, c, a = 1) => {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 3;
    if (a >= 1) { px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; }
    else { px[k] = Math.round(px[k] * (1 - a) + c[0] * a); px[k + 1] = Math.round(px[k + 1] * (1 - a) + c[1] * a); px[k + 2] = Math.round(px[k + 2] * (1 - a) + c[2] * a); }
  };
  const rect = (x0, y0, x1, y1, c, a = 1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, c, a); };
  const line = (x0, y0, x1, y1, c, t = 1, a = 1) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    for (;;) {
      for (let oy = -Math.floor((t - 1) / 2); oy <= Math.floor(t / 2); oy++) for (let ox = -Math.floor((t - 1) / 2); ox <= Math.floor(t / 2); ox++) set(x0 + ox, y0 + oy, c, a);
      if ((x0 === x1 && y0 === y1) || ++guard > 4 * (dx - dy + 4)) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const poly = (pts, c, t = 1, a = 1, close = true) => { for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t, a); if (close && pts.length > 2) line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], c, t, a); };
  const fillPoly = (pts, c, a = 1) => {
    if (pts.length < 3) return;
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a0 = pts[j], b0 = pts[i];
        if ((a0[1] > y) !== (b0[1] > y)) xs.push(a0[0] + (y - a0[1]) * (b0[0] - a0[0]) / (b0[1] - a0[1]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(w - 1, Math.floor(xs[k + 1])); x++) set(x, y, c, a);
    }
  };
  const circle = (cx, cy, r, c, t = 1, a = 1) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && x * x + y * y >= (r - t) * (r - t)) set(cx + x, cy + y, c, a); };
  // 3x5 uppercase font subset.
  const F = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'], 'C': ['011', '100', '100', '100', '011'],
    'D': ['110', '101', '101', '101', '110'], 'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'], 'I': ['111', '010', '010', '010', '111'],
    'J': ['001', '001', '001', '101', '010'], 'K': ['101', '101', '110', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'], 'N': ['101', '111', '111', '111', '101'], 'O': ['010', '101', '101', '101', '010'],
    'P': ['110', '101', '110', '100', '100'], 'Q': ['010', '101', '101', '011', '001'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'], 'U': ['101', '101', '101', '101', '011'],
    'V': ['101', '101', '101', '101', '010'], 'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'], 'Z': ['111', '001', '010', '100', '111'],
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['110', '001', '010', '100', '111'],
    '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '110', '001', '110'],
    '6': ['011', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '110'], ' ': ['000', '000', '000', '000', '000'], '-': ['000', '000', '111', '000', '000'],
    '.': ['000', '000', '000', '000', '010'], ':': ['000', '010', '000', '010', '000'], '/': ['001', '001', '010', '100', '100'],
    '_': ['000', '000', '000', '000', '111'], '=': ['000', '111', '000', '111', '000'], '+': ['000', '010', '111', '010', '000'],
  };
  const text = (s, x, y, c, scale = 2, a = 1) => {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      const g = F[ch] ?? F[' '];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === '1') rect(cx + q * scale, y + r * scale, cx + q * scale + scale - 1, y + r * scale + scale - 1, c, a);
      cx += 4 * scale;
    }
  };
  return { w, h, px, set, rect, line, poly, fillPoly, circle, text, png: f => writePng(f, w, h, px) };
}
