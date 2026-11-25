/**
 * The drifting dots of fog weather. Each frame used to evaluate 28,800 noise samples to decide where the dots go.
 * The dots are unchanged (the same ones, in the same order); the deciding is done once:
 *  - the noise decision of a field cell never changes, so it is remembered while the cell stays near the view (the
 *    field drifts one pixel every 70 ms and follows the camera at half speed);
 *  - while neither the drift nor the camera moved since the previous frame, the previous list of dots is reused.
 */
import { viewW, viewH, MAX_VIEW_W, MAX_VIEW_H } from './viewport';
import { fbm } from './world';

// Remembered decisions for field cells (X, Y) in the window [winX, winX + RING_W) x [winY, winY + RING_H).
// 0 = not computed, 1 = clear, 2 = dot. A cell lives at (X mod RING_W, Y mod RING_H).
const RING_W = 1024, RING_H = 512;
const ring = new Uint8Array(RING_W * RING_H);
let winX = NaN, winY = NaN;
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Keep the view [ox, ox + viewW) x [oy, oy + viewH) (never larger than the ring) inside the remembered window, forgetting cells that leave it. */
function slide(ox: number, oy: number) {
  if (!(Math.abs(ox - winX) < RING_W && Math.abs(oy - winY) < RING_H)) { ring.fill(0); winX = ox; winY = oy; return; }
  if (ox < winX || ox + viewW > winX + RING_W) {
    // Leave the spare room on the side the view is moving towards.
    const next = ox < winX ? ox + viewW - RING_W : ox;
    const from = next > winX ? winX + RING_W : next, to = next > winX ? next + RING_W : winX;
    for (let X = from; X < to; X++) { const col = mod(X, RING_W); for (let i = col; i < ring.length; i += RING_W) ring[i] = 0; }
    winX = next;
  }
  if (oy < winY || oy + viewH > winY + RING_H) {
    const next = oy < winY ? oy + viewH - RING_H : oy;
    const from = next > winY ? winY + RING_H : next, to = next > winY ? next + RING_H : winY;
    for (let Y = from; Y < to; Y++) { const row = mod(Y, RING_H) * RING_W; ring.fill(0, row, row + RING_W); }
    winY = next;
  }
}

const MAX_DOTS = (MAX_VIEW_H / 2) * (MAX_VIEW_W / 4);   // room for the largest view
const dotXY = new Int16Array(MAX_DOTS * 2);
let dotCount = 0, listOx = NaN, listOy = NaN, listW = 0, listH = 0;
/**
 * The fog dots for field offset (ox, oy), in drawing order: `count` pairs (x, y) in `xy`. A dot is the 2 x 2 block at
 * screen (x, y) for even y and x = 2 * ((y / 2) % 2) + 4k, wherever fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55.
 * The returned array is reused by the next call.
 */
export function fogDots(ox: number, oy: number): { xy: Int16Array; count: number } {
  if (ox === listOx && oy === listOy && viewW === listW && viewH === listH) return { xy: dotXY, count: dotCount };
  slide(ox, oy);
  const oxm = mod(ox, RING_W); let n = 0;
  for (let y = 0; y < viewH; y += 2) {
    const row = mod(y + oy, RING_H) * RING_W;
    for (let x = (y >> 1) % 2 * 2; x < viewW; x += 4) {
      const cell = row + ((x + oxm) & (RING_W - 1));
      let c = ring[cell];
      if (!c) { c = fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55 ? 2 : 1; ring[cell] = c; }
      if (c === 2) { dotXY[n++] = x; dotXY[n++] = y; }
    }
  }
  dotCount = n >> 1; listOx = ox; listOy = oy; listW = viewW; listH = viewH;
  return { xy: dotXY, count: dotCount };
}

/** Fill the fog dots for field offset (ox, oy) onto `g`, one rectangle per dot (the original way). */
export function drawFogDotsAsRects(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const { xy, count } = fogDots(ox, oy);
  g.fillStyle = 'rgba(225,230,238,0.22)';
  for (let i = 0; i < count * 2; i += 2) g.fillRect(xy[i], xy[i + 1], 2, 2);
}

// The same dots as one picture: painted opaque into a view-sized layer whenever the field offset changes, then laid
// over the frame at the dots' opacity in a single draw. Several thousand small fills per frame become one. The dots
// never overlap, so every pixel gets the same colour at the same opacity as before; the browser rounds the blend
// slightly differently for a picture than for a fill, by at most 2 of 255 per colour channel (Creator ruling
// 2026-11-23: accepted).
const DOT_RGBA = (255 << 24 | 238 << 16 | 230 << 8 | 225) >>> 0;   // rgb(225,230,238), opaque, as little-endian RGBA
const DOT_ALPHA = 0.22;
let layer: HTMLCanvasElement | undefined, layerG: CanvasRenderingContext2D | null = null;
let layerImage: ImageData | undefined, layerPx: Uint32Array | undefined, layerOx = NaN, layerOy = NaN;

/** Draw the fog dots for field offset (ox, oy) onto `g`. */
export function drawFogDots(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  if (!layer || layer.width !== viewW || layer.height !== viewH) {
    if (typeof document === 'undefined') { drawFogDotsAsRects(g, ox, oy); return; }
    layer = layer ?? document.createElement('canvas'); layer.width = viewW; layer.height = viewH;   // the view changed size with the window
    layerG = layer.getContext('2d'); layerImage = undefined; layerPx = undefined; layerOx = NaN; layerOy = NaN;
    if (layerG) { layerImage = layerG.createImageData(viewW, viewH); layerPx = new Uint32Array(layerImage.data.buffer); }
  }
  if (!layerG || !layerImage || !layerPx) { drawFogDotsAsRects(g, ox, oy); return; }
  if (ox !== layerOx || oy !== layerOy) {
    const { xy, count } = fogDots(ox, oy), px = layerPx;
    px.fill(0);
    for (let i = 0; i < count * 2; i += 2) {
      const at = xy[i + 1] * viewW + xy[i];                        // a dot is 2 x 2 and always inside the view
      px[at] = DOT_RGBA; px[at + 1] = DOT_RGBA; px[at + viewW] = DOT_RGBA; px[at + viewW + 1] = DOT_RGBA;
    }
    layerG.putImageData(layerImage, 0, 0); layerOx = ox; layerOy = oy;
  }
  const alpha = g.globalAlpha; g.globalAlpha = alpha * DOT_ALPHA; g.drawImage(layer, 0, 0); g.globalAlpha = alpha;
}
