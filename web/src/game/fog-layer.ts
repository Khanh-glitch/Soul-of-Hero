/**
 * The drifting dots of fog weather. Each frame used to evaluate 28,800 noise samples to decide where the dots go.
 * The picture is unchanged (the same fills, in the same order); only the deciding is done once:
 *  - the noise decision of a field cell never changes, so it is remembered while the cell stays near the view (the
 *    field drifts one pixel every 70 ms and follows the camera at half speed);
 *  - while neither the drift nor the camera moved since the previous frame, the previous list of dots is reused.
 */
import { VIEW_W, VIEW_H } from './core';
import { fbm } from './world';

// Remembered decisions for field cells (X, Y) in the window [winX, winX + RING_W) x [winY, winY + RING_H).
// 0 = not computed, 1 = clear, 2 = dot. A cell lives at (X mod RING_W, Y mod RING_H).
const RING_W = 1024, RING_H = 512;
const ring = new Uint8Array(RING_W * RING_H);
let winX = NaN, winY = NaN;
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Keep the view [ox, ox + VIEW_W) x [oy, oy + VIEW_H) inside the remembered window, forgetting cells that leave it. */
function slide(ox: number, oy: number) {
  if (!(Math.abs(ox - winX) < RING_W && Math.abs(oy - winY) < RING_H)) { ring.fill(0); winX = ox; winY = oy; return; }
  if (ox < winX || ox + VIEW_W > winX + RING_W) {
    // Leave the spare room on the side the view is moving towards.
    const next = ox < winX ? ox + VIEW_W - RING_W : ox;
    const from = next > winX ? winX + RING_W : next, to = next > winX ? next + RING_W : winX;
    for (let X = from; X < to; X++) { const col = mod(X, RING_W); for (let i = col; i < ring.length; i += RING_W) ring[i] = 0; }
    winX = next;
  }
  if (oy < winY || oy + VIEW_H > winY + RING_H) {
    const next = oy < winY ? oy + VIEW_H - RING_H : oy;
    const from = next > winY ? winY + RING_H : next, to = next > winY ? next + RING_H : winY;
    for (let Y = from; Y < to; Y++) { const row = mod(Y, RING_H) * RING_W; ring.fill(0, row, row + RING_W); }
    winY = next;
  }
}

const MAX_DOTS = (VIEW_H / 2) * (VIEW_W / 4);
const dotXY = new Int16Array(MAX_DOTS * 2);
let dotCount = 0, listOx = NaN, listOy = NaN;
/**
 * The fog dots for field offset (ox, oy), in drawing order: `count` pairs (x, y) in `xy`. A dot is the 2 x 2 block at
 * screen (x, y) for even y and x = 2 * ((y / 2) % 2) + 4k, wherever fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55.
 * The returned array is reused by the next call.
 */
export function fogDots(ox: number, oy: number): { xy: Int16Array; count: number } {
  if (ox === listOx && oy === listOy) return { xy: dotXY, count: dotCount };
  slide(ox, oy);
  const oxm = mod(ox, RING_W); let n = 0;
  for (let y = 0; y < VIEW_H; y += 2) {
    const row = mod(y + oy, RING_H) * RING_W;
    for (let x = (y >> 1) % 2 * 2; x < VIEW_W; x += 4) {
      const cell = row + ((x + oxm) & (RING_W - 1));
      let c = ring[cell];
      if (!c) { c = fbm((x + ox) / 90, (y + oy) / 60, 41, 2) > 0.55 ? 2 : 1; ring[cell] = c; }
      if (c === 2) { dotXY[n++] = x; dotXY[n++] = y; }
    }
  }
  dotCount = n >> 1; listOx = ox; listOy = oy;
  return { xy: dotXY, count: dotCount };
}

/** Fill the fog dots for field offset (ox, oy) onto `g`. */
export function drawFogDots(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const { xy, count } = fogDots(ox, oy);
  g.fillStyle = 'rgba(225,230,238,0.22)';
  for (let i = 0; i < count * 2; i += 2) g.fillRect(xy[i], xy[i + 1], 2, 2);
}
