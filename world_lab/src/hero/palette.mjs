// One authored 36-colour value ladder for the single Argus hero scene.
// No runtime gradients, no anti-aliasing, no per-donor palettes. Dark values hue-shift
// toward blue/violet; highlights toward brass and warm ivory. Ordered dither perturbs
// the *choice* of a palette entry, never the emitted RGB, so every opaque pixel is exact.
export const PALETTE = [
  '#05060b', '#090d16', '#11172a', '#1b2540', '#2b3757',
  '#26293d', '#3b3a4e', '#565268', '#797184', '#a59695',
  '#3a271c', '#644529', '#98703a', '#c69a52', '#eed08a',
  '#0c3440', '#146170', '#2b9b9c', '#65d0bd', '#b8f4dd',
  '#3a1720', '#6e2a2d', '#a64b3b', '#dc8150', '#ffcf85',
  '#0a1e33', '#123b53', '#1e6574', '#3a9b9c', '#7dd0c3',
  '#142219', '#263f2b', '#416442', '#6f8d55', '#a9bb75',
  '#f7e8c8',
].map(h => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
});
export const PALETTE_HEX = PALETTE.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
export const PALETTE_SIZE = PALETTE.length;
const ALL = PALETTE.map((_, i) => i);
const GROUPS = {
  all: ALL,
  void: [0, 1, 2, 3, 4, 5, 6, 7],
  stone: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 14, 35],
  brass: [0, 5, 10, 11, 12, 13, 14, 24, 35],
  cyan: [1, 2, 15, 16, 17, 18, 19, 25, 26, 27, 28, 29, 35],
  ember: [0, 1, 10, 20, 21, 22, 23, 24, 35],
  water: [1, 2, 25, 26, 27, 28, 29, 15, 16, 17, 19],
  green: [0, 1, 30, 31, 32, 33, 34, 9],
  warmLight: [0, 1, 10, 11, 12, 13, 14, 23, 24, 35],
  coolLight: [0, 1, 2, 15, 16, 17, 18, 19, 35],
  shadow: [0, 1, 2, 3, 5, 6, 25],
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dist2(a, b) {
  // Perceptually weighted RGB distance, preserving the authoring value ladder.
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11;
}
export function nearestIndex(rgb, group = 'stone') {
  const ids = GROUPS[group] || GROUPS.all;
  let best = ids[0], bd = Infinity;
  for (const i of ids) { const d = dist2(rgb, PALETTE[i]); if (d < bd) { bd = d; best = i; } }
  return best;
}
export function paletteLock(pix, group = 'stone', opts = {}) {
  const dither = opts.dither !== false, tint = opts.tint || null;
  const out = pix.data.slice();
  for (let y = 0; y < pix.height; y++) for (let x = 0; x < pix.width; x++) {
    const i = (y * pix.width + x) * 4, a = pix.data[i + 3];
    if (!a) continue;
    let rgb = [pix.data[i], pix.data[i + 1], pix.data[i + 2]];
    if (tint) {
      const t = tint.strength ?? .55;
      rgb = rgb.map((v, k) => Math.round(v * (1 - t) + tint.rgb[k] * t));
    }
    if (opts.hueShift) {
      // Cool the darkest ramps and warm the brightest ramps by a small channel bias.
      const l = (rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11) / 255;
      rgb = [
        Math.round(rgb[0] * (1 + (l - .5) * .22)),
        Math.round(rgb[1] * (1 + (l - .5) * .04)),
        Math.round(rgb[2] * (1 + (.5 - l) * .20)),
      ].map(v => Math.max(0, Math.min(255, v)));
    }
    const jitter = dither ? (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * (opts.ditherAmount ?? 8) : 0;
    const idx = nearestIndex(opts.forceLight ? rgb.map(v => Math.min(255, v + jitter + 14)) : rgb.map(v => v + jitter), group);
    const c = PALETTE[idx];
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = a;
  }
  return { width: pix.width, height: pix.height, data: out };
}
export function strictPaletteColor(hex) {
  const n = parseInt(hex.slice(1), 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
  return PALETTE[nearestIndex(rgb, 'all')];
}
export function selectiveOutline(pix, color = '#05060b') {
  // Lower/right silhouette only; never a full black halo around every tile.
  const w = pix.width, h = pix.height, src = new Uint8Array(w * h), n = parseInt(color.slice(1), 16);
  const c = [n >> 16 & 255, n >> 8 & 255, n & 255];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) src[y * w + x] = pix.data[(y * w + x) * 4 + 3] > 40 ? 1 : 0;
  const out = pix.data.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (src[k]) continue;
    const below = y + 1 < h && src[(y + 1) * w + x];
    const right = x + 1 < w && src[y * w + x + 1];
    if (!below && !right) continue;
    const i = k * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
  }
  return { width: w, height: h, data: out };
}
export function chromaKey(pix, rgb = [255, 0, 255], tolerance = 42) {
  const out = pix.data.slice();
  for (let i = 0; i < out.length; i += 4) {
    const d = Math.abs(out[i] - rgb[0]) + Math.abs(out[i + 1] - rgb[1]) + Math.abs(out[i + 2] - rgb[2]);
    if (d <= tolerance) out[i + 3] = 0;
  }
  return { width: pix.width, height: pix.height, data: out };
}
export function nearestDownsample(pix, factor, width, height) {
  // Integer nearest-neighbour reduction; every output pixel maps to exactly one source pixel.
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(pix.width - 1, Math.floor((x + .5) * factor)), sy = Math.min(pix.height - 1, Math.floor((y + .5) * factor));
    const s = (sy * pix.width + sx) * 4, d = (y * width + x) * 4;
    out[d] = pix.data[s]; out[d + 1] = pix.data[s + 1]; out[d + 2] = pix.data[s + 2]; out[d + 3] = pix.data[s + 3];
  }
  return { width, height, data: out };
}
// A conservative contact shadow: at most one 16px tile of offset, fading to a hard 1px edge.
export function contactShadow(pix, opts = {}) {
  const maxDrop = Math.max(0, Math.min(16, opts.drop ?? 3));
  const out = { width: pix.width + maxDrop, height: pix.height + maxDrop, data: new Uint8Array((pix.width + maxDrop) * (pix.height + maxDrop) * 4) };
  const dark = PALETTE[0];
  for (let y = 0; y < pix.height; y++) for (let x = 0; x < pix.width; x++) {
    const a = pix.data[(y * pix.width + x) * 4 + 3]; if (a < 40) continue;
    const dx = x + maxDrop, dy = y + maxDrop, i = (dy * out.width + dx) * 4;
    if (dx < out.width && dy < out.height) { out.data[i] = dark[0]; out.data[i + 1] = dark[1]; out.data[i + 2] = dark[2]; out.data[i + 3] = Math.min(110, Math.round(a * .42)); }
  }
  return out;
}
