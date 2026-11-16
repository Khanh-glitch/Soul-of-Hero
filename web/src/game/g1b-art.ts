// G1B chest presentation. Uses the 15 real studio sprites (5 families × CLOSED/OPENED/EMPTY, 48×48, anchor 24,42) and
// the per-pixel surface mask. Grade is shown only by pixel-snapped scale and the surface sheen (approved §H).
//
// Surface Sheen Sweep (batch 2): the highlight is computed PER SPRITE PIXEL from the mask's own channels —
//   R material (0 outline · 1 timber / painted body · 6 metal fittings), G plane (1 lid · 4 front · 5 raised edge),
//   B bevel curvature, A strict object mask —
// so metal flashes hard and white, timber only warms, raised edges catch the light first, the lid and the front are
// crossed at different angles (the band breaks at the lid edge like light on a real box), and the dark outline never
// lights. It is quantised to three flat steps and drawn nearest-neighbour: no gradient, no glow, nothing outside the
// object mask. Scale is presentation only; collision stays the chest's single anchor tile.
import { G1B_CHESTS, G1B_FAMILY_COLUMN, G1B_GRADE_VISUAL, G1B_SITES, g1bHash } from './g1b';

const CELL = 48, AX = 24, AY = 42;
const ROW = { closed: 0, opened: 1, empty: 2 } as const;
/** How long one sweep takes to cross the chest. */
export const G1B_SHEEN_SWEEP_MS = 900;
let atlas: HTMLImageElement | null = null, mask: HTMLImageElement | null = null;
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
/** Light response of a material id (mask R / 28). The outline (0) never lights. */
const MATERIAL_GAIN: Record<number, number> = { 0: 0, 1: 0.5, 6: 1.25 };
/** Light response of a plane id (mask G / 28): the lid faces the light, the front is in half shade, raised edges catch it. */
const PLANE_GAIN: Record<number, number> = { 0: 0, 1: 1, 4: 0.7, 5: 1.2 };
/** Sheen strength per grade (studio manifest gradeVisuals.intensity). */
const GRADE_INTENSITY: Record<string, number> = { damaged: 0.48, low: 0.72, mid: 0.92, high: 1.12 };
/**
 * Sheen step (0 none · 1 faint · 2 lit · 3 specular) for one sprite pixel. `r,g,b,a` are the mask texel; `x,y` the
 * pixel inside its 48×48 cell; `phase` the sweep progress 0..1. Pure, so the look is testable without a canvas.
 */
export function g1bSheenStep(r: number, g: number, b: number, a: number, x: number, y: number, phase: number, intensity: number): 0 | 1 | 2 | 3 {
  if (a < 128) return 0;
  const material = Math.round(r / 28), plane = Math.round(g / 28);
  const mg = MATERIAL_GAIN[material] ?? 0.5, pg = PLANE_GAIN[plane] ?? 0.7; if (!mg || !pg) return 0;
  // the band travels left → right; on the lid it leans the other way, so it visibly bends where the lid meets the front
  const u = plane === 1 ? x - (y - 14) * 0.9 : x + (y - 14) * 0.45;
  const centre = -10 + phase * (CELL + 20), d = Math.abs(u - centre);
  const core = material === 6 ? 2.2 : 3.2, skirt = material === 6 ? 4.5 : 6.5;      // metal: a tight, hard glint; timber: a broad soft one
  const profile = d <= core ? 1 : d <= skirt ? 0.5 : 0; if (!profile) return 0;
  const v = profile * mg * pg * (0.45 + 0.55 * b / 255) * intensity;
  return v >= 0.62 ? 3 : v >= 0.34 ? 2 : v >= 0.16 ? 1 : 0;
}
const STEP_ALPHA = [0, 56, 104, 168];
/** per-material sheen colour: metal reflects the sky, timber and paint only warm */
const stepColour = (material: number): [number, number, number] => material === 6 ? [255, 255, 255] : [255, 236, 184];
const PHASES = 30;                                           // the sweep is drawn in 30 discrete positions (pixel-art timing, cacheable)
let maskPx: Uint8ClampedArray | null = null, maskW = 0;
const overlay = new Map<string, HTMLCanvasElement>();
function sheenOverlay(col: number, grade: string, step: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || !mask || !mask.complete || !mask.naturalWidth) return null;
  if (!maskPx) { const c = document.createElement('canvas'); c.width = mask.naturalWidth; c.height = mask.naturalHeight; const q = c.getContext('2d', { willReadFrequently: true })!; q.drawImage(mask, 0, 0); maskPx = q.getImageData(0, 0, c.width, c.height).data; maskW = c.width; }
  const key = `${col}|${grade}|${step}`; let cv = overlay.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = CELL; cv.height = CELL; const q = cv.getContext('2d')!; const img = q.createImageData(CELL, CELL); const phase = step / (PHASES - 1), k = GRADE_INTENSITY[grade] ?? 0.72;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const m = (y * maskW + col * CELL + x) * 4;               // CLOSED row of the mask: only a closed chest shines
    const st = g1bSheenStep(maskPx[m], maskPx[m + 1], maskPx[m + 2], maskPx[m + 3], x, y, phase, k); if (!st) continue;
    const [cr, cg, cb] = stepColour(Math.round(maskPx[m] / 28)); const o = (y * CELL + x) * 4; img.data[o] = cr; img.data[o + 1] = cg; img.data[o + 2] = cb; img.data[o + 3] = STEP_ALPHA[st];
  }
  q.putImageData(img, 0, 0); overlay.set(key, cv); return cv;
}
/** Draws one chest with its anchor at (x, y). Returns false until the atlas has loaded (caller draws the fallback). */
export function drawG1bChest(g: CanvasRenderingContext2D, sid: string, state: 'closed' | 'opened' | 'empty', x: number, y: number, time: number): boolean {
  load(); const c = G1B_CHESTS[G1B_SITES[sid]?.variant];
  if (!c || !atlas || !atlas.complete || !atlas.naturalWidth) return false;
  const col = G1B_FAMILY_COLUMN[c.family], sx = col * CELL, sy = ROW[state] * CELL, k = G1B_GRADE_VISUAL[c.grade].scale;
  const w = Math.round(CELL * k), h = Math.round(CELL * k), dx = Math.round(x - AX * k), dy = Math.round(y - AY * k);
  const smooth = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(atlas, sx, sy, CELL, CELL, dx, dy, w, h);
  const ph = state === 'closed' ? g1bSheenPhase(sid, time) : -1;
  if (ph >= 0) { const ov = sheenOverlay(col, c.grade, Math.min(PHASES - 1, Math.floor(ph * PHASES))); if (ov) g.drawImage(ov, 0, 0, CELL, CELL, dx, dy, w, h); }
  g.imageSmoothingEnabled = smooth; return true;
}
