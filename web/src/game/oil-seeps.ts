/**
 * Item set v3 — the production authority for Crude Petroleum on Veyra.
 *
 * A crude seep is a ground tile, not a harvest node: it never enters the compiled source layer, so
 * the pinned source digest and every authored POI stay byte-identical. Where seeps are is a pure
 * function of global tile coordinates plus the ground layer of the window that first shows the
 * cell; the chosen tile and its remaining stock are then written to the run ledger (`r.oilSeeps`)
 * and never re-derived, so a window slide, a save or a reload cannot move or refill a seep.
 *
 * `r.oilSources` keeps its historical window-local shape (`oil:tx:ty`), because the pump, the
 * station panel and the save validator all read it. This module re-projects the ledger into that
 * shape every time the window origin changes.
 *
 * SOH_PROVISIONAL numbers (`BAL.oilPumpV1.seep*`): Last Island gives no seep density or yield.
 */
import { BAL, T, WW, WH, type RunState } from './core';

export const OIL_SEEP_AUTHORITY = 'veyra-seep-v1' as const;
/** Side of one seep cell in global tiles. At most one seep per cell. */
export const SEEP_CELL = 64;

/** The slice of a Veyra ground layer the seep rule reads. */
export interface SeepGround { tiles: Uint8Array; walkable: Uint8Array; protectedCells: Uint8Array; buildable: Uint8Array; sources: (string | null)[]; solidProps: Uint8Array }

function seepHash(cx: number, cy: number): number {
  let h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 0x5eed011) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}
/** The global tile a cell aims at, or null when the cell holds no seep. Pure. */
export function seepCandidate(cx: number, cy: number): [number, number] | null {
  const h = seepHash(cx, cy);
  if (h % BAL.oilPumpV1.seepOneInCells !== 0) return null;
  return [cx * SEEP_CELL + 8 + ((h >>> 8) % (SEEP_CELL - 16)), cy * SEEP_CELL + 8 + ((h >>> 16) % (SEEP_CELL - 16))];
}
const OPEN_GROUND: readonly number[] = [T.SAND, T.GRASS, T.MEADOW, T.FOREST, T.MARSH, T.HILL, T.SNOW, T.ASH, T.TOXIC, T.BURNT];
function seepGroundOk(g: SeepGround, lx: number, ly: number): boolean {
  if (lx < 2 || ly < 2 || lx >= WW - 2 || ly >= WH - 2) return false;
  const i = ly * WW + lx;
  return OPEN_GROUND.includes(g.tiles[i]) && !!g.walkable[i] && !!g.buildable[i] && !g.protectedCells[i] && !g.sources[i] && !g.solidProps[i];
}
/** Re-project the seep ledger into `r.oilSources` for the window whose origin is (ox, oy). Idempotent per origin. */
export function syncOilSeeps(r: RunState, ground: SeepGround, ox: number, oy: number): void {
  const tag = ox + ',' + oy;
  if (r.oilSeepWindow === tag) return;
  const prev = r.oilSeepWindow ? r.oilSeepWindow.split(',').map(Number) : null;
  const ledger = (r.oilSeeps ??= {});
  const local = (r.oilSources ??= {});
  // 1. carry what the pumps drew in the old window back to the ledger, then drop the old projection
  for (const [k, s] of Object.entries(local)) {
    if (s.authority !== OIL_SEEP_AUTHORITY) continue;
    if (prev) { const gx = prev[0] + s.tx, gy = prev[1] + s.ty; const row = ledger[Math.floor(gx / SEEP_CELL) + ':' + Math.floor(gy / SEEP_CELL)]; if (row && row.gx === gx && row.gy === gy) row.stock = s.stock; }
    delete local[k];
  }
  // 2. project every cell this window overlaps
  for (let cy = Math.floor(oy / SEEP_CELL); cy <= Math.floor((oy + WH - 1) / SEEP_CELL); cy++) for (let cx = Math.floor(ox / SEEP_CELL); cx <= Math.floor((ox + WW - 1) / SEEP_CELL); cx++) {
    const key = cx + ':' + cy; let row = ledger[key];
    if (!row) {
      const c = seepCandidate(cx, cy); if (!c) continue;
      // nearest open-ground tile to the aim point, in a fixed scan order (rings, row-major)
      let hit: [number, number] | null = null;
      for (let rad = 0; rad <= 5 && !hit; rad++) for (let dy = -rad; dy <= rad && !hit; dy++) for (let dx = -rad; dx <= rad && !hit; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        if (seepGroundOk(ground, c[0] + dx - ox, c[1] + dy - oy)) hit = [c[0] + dx, c[1] + dy];
      }
      if (!hit) continue; // not open ground in this window; another window may still show it
      row = ledger[key] = { gx: hit[0], gy: hit[1], stock: BAL.oilPumpV1.seepStock };
    }
    const lx = row.gx - ox, ly = row.gy - oy;
    if (lx < 0 || ly < 0 || lx >= WW || ly >= WH) continue;
    local['oil:' + lx + ':' + ly] = { tx: lx, ty: ly, stock: row.stock, authority: OIL_SEEP_AUTHORITY };
  }
  r.oilSeepWindow = tag;
}
/** Write the live window stock back to the ledger without changing the projection (called before a save is cut). */
export function flushOilSeeps(r: RunState): void {
  if (!r.oilSeepWindow || !r.oilSeeps || !r.oilSources) return;
  const [ox, oy] = r.oilSeepWindow.split(',').map(Number);
  for (const s of Object.values(r.oilSources)) {
    if (s.authority !== OIL_SEEP_AUTHORITY) continue;
    const gx = ox + s.tx, gy = oy + s.ty; const row = r.oilSeeps[Math.floor(gx / SEEP_CELL) + ':' + Math.floor(gy / SEEP_CELL)];
    if (row && row.gx === gx && row.gy === gy) row.stock = s.stock;
  }
}
