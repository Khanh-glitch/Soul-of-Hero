// G1B chest presentation. Uses the 15 real studio sprites (5 families × CLOSED/OPENED/EMPTY, 48×48, anchor 24,42) and
// the per-pixel surface mask. Grade is shown only by pixel-snapped scale and the surface sheen period (approved §H):
// the sheen is a light band that crosses the chest's own surface pixels — no glow, no bloom, nothing outside the sprite.
// Scale is presentation only; collision stays the chest's single anchor tile.
import { G1B_CHESTS, G1B_FAMILY_COLUMN, G1B_GRADE_VISUAL, G1B_SITES, g1bHash } from './g1b';

const CELL = 48, AX = 24, AY = 42;
const ROW = { closed: 0, opened: 1, empty: 2 } as const;
/** How long one sweep takes to cross the chest. */
export const G1B_SHEEN_SWEEP_MS = 900;
let atlas: HTMLImageElement | null = null, mask: HTMLImageElement | null = null, scratch: HTMLCanvasElement | null = null;
function load() {
  if (atlas || typeof Image === 'undefined') return;
  const base = `${(import.meta as any).env?.BASE_URL || '/'}assets/g1b/chests/`;
  atlas = new Image(); atlas.src = base + 'soh_crates_atlas_5x3.png';
  mask = new Image(); mask.src = base + 'soh_crates_surface_mask_5x3.png';
}
/** Deterministic per-chest sheen period inside the approved range for its grade, in ms; 0 = this grade never shines. */
export function g1bSheenPeriodMs(sid: string): number {
  const c = G1B_CHESTS[G1B_SITES[sid]?.variant]; const range = c && G1B_GRADE_VISUAL[c.grade].sheen; if (!range) return 0;
  return Math.round((range[0] + (g1bHash('sheen|' + sid) % 1000) / 1000 * (range[1] - range[0])) * 1000);
}
/** Sweep progress 0..1 at `time`, or -1 between sweeps. Closed chests only: an opened or empty chest has nothing to advertise. */
export function g1bSheenPhase(sid: string, time: number): number {
  const period = g1bSheenPeriodMs(sid); if (!period) return -1;
  const t = (time + g1bHash('phase|' + sid) % period) % period; return t < G1B_SHEEN_SWEEP_MS ? t / G1B_SHEEN_SWEEP_MS : -1;
}
/** Draws one chest with its anchor at (x, y). Returns false until the atlas has loaded (caller draws the fallback). */
export function drawG1bChest(g: CanvasRenderingContext2D, sid: string, state: 'closed' | 'opened' | 'empty', x: number, y: number, time: number): boolean {
  load(); const c = G1B_CHESTS[G1B_SITES[sid]?.variant];
  if (!c || !atlas || !atlas.complete || !atlas.naturalWidth) return false;
  const sx = G1B_FAMILY_COLUMN[c.family] * CELL, sy = ROW[state] * CELL, k = G1B_GRADE_VISUAL[c.grade].scale;
  const w = Math.round(CELL * k), h = Math.round(CELL * k), dx = Math.round(x - AX * k), dy = Math.round(y - AY * k);
  const smooth = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(atlas, sx, sy, CELL, CELL, dx, dy, w, h);
  const ph = state === 'closed' ? g1bSheenPhase(sid, time) : -1;
  if (ph >= 0 && mask && mask.complete && mask.naturalWidth && typeof document !== 'undefined') {
    const s = scratch ??= Object.assign(document.createElement('canvas'), { width: CELL, height: CELL }); const q = s.getContext('2d')!;
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, CELL, CELL);
    // a 7px diagonal band travelling left → right, kept only where the mask says "chest surface"
    const bx = Math.round(-12 + ph * (CELL + 24)); q.fillStyle = '#fff6d8';
    for (let yy = 0; yy < CELL; yy++) q.fillRect(bx - Math.floor(yy / 3), yy, 7, 1);
    q.globalCompositeOperation = 'destination-in'; q.drawImage(mask, sx, sy, CELL, CELL, 0, 0, CELL, CELL);
    const a = g.globalAlpha; g.globalAlpha = a * 0.42; g.drawImage(s, 0, 0, CELL, CELL, dx, dy, w, h); g.globalAlpha = a;
  }
  g.imageSmoothingEnabled = smooth; return true;
}
