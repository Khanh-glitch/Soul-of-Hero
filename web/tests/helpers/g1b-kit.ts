/** Shared G1B test kit: a real Veyra run, window travel to a global tile, and intent dispatch. No engine internals are stubbed. */
import { expect } from 'vitest';
import { TILE, WW, WH, type GameState, type RunState, type Entity } from '../../src/game/core';
import { C, dispatch, newGame, startRun, markDirty, blockGrid, g1bEntities } from '../../src/game/engine';
import { tick, type Input } from '../../src/game/sim';
import { setActiveLayout } from '../../src/game/world';
import { U05_WORLD_LAYOUT_ID } from '../../src/veyra05/scenes';
import { shiftVeyraWindowBy } from '../../src/veyra05/continuity';
import { validate } from '../../src/game/persist';

export const T0 = Date.UTC(2026, 10, 15, 8);
export const HOUR = 3600_000;
export class G1bRun {
  gs: GameState; now = T0; seq = 0;
  constructor(public seed = 101) {
    if (!setActiveLayout(U05_WORLD_LAYOUT_ID)) throw new Error('layout');
    this.gs = newGame(); const rc = startRun(this.gs, 'male', T0, null, seed); if (!rc.ok) throw new Error(JSON.stringify(rc));
  }
  get r(): RunState { return this.gs.run!; }
  origin(): [number, number] { const o = this.r.sourceMap!.veyra!.originAu; return [Math.round(o[0] / 0.5), Math.round(o[1] / 0.5)]; }
  act(type: string, p: object = {}) { this.now += 10; return dispatch(this.gs, { id: `g1b-${++this.seq}`, type, ...p } as any, this.now) as any; }
  ent(sid: string): Entity { const e = g1bEntities(this.r).find(v => v.g1b!.sid === sid); if (!e) throw new Error('no G1B entity ' + sid); return e; }
  live(sid: string): Entity { const e = Object.values(this.r.entities).find(v => v.g1b?.sid === sid); if (!e) throw new Error(sid + ' is not in the window'); return e; }
  /** Slide the streamed window (the game's own continuity path) until a global tile is well inside it. */
  bring(gx: number, gy: number) {
    for (let i = 0; i < 80; i++) {
      const [ox, oy] = this.origin(); const dx = gx - (ox + WW / 2), dy = gy - (oy + WH / 2);
      if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40) return;
      const sx = Math.max(-64, Math.min(64, Math.round(dx))), sy = Math.max(-64, Math.min(64, Math.round(dy)));
      const p = this.r.player; p.x = (WW / 2) * TILE + 8 + sx * TILE; p.y = (WH / 2) * TILE + 8 + sy * TILE; // carried with the window, as when walking
      if (!shiftVeyraWindowBy(this.gs, sx, sy, markDirty)) return;
    }
    throw new Error(`could not bring ${gx},${gy} into the window`);
  }
  /** Stand on a free tile next to a global tile (the chest itself is solid). */
  standBy(gx: number, gy: number, prefer?: [number, number]) {
    this.bring(gx, gy); const [ox, oy] = this.origin(); const grid = blockGrid(this.r);
    const order: [number, number][] = [...(prefer ? [prefer] : []), [0, 1], [1, 0], [-1, 0], [0, -1]];
    for (const [dx, dy] of order) { const lx = gx - ox + dx, ly = gy - oy + dy; if (grid[ly * WW + lx] === 0) { const p = this.r.player; p.x = lx * TILE + 8; p.y = ly * TILE + 8; return [lx, ly] as [number, number]; } }
    throw new Error(`no free tile beside ${gx},${gy}`);
  }
  step(ms = 50, inp: Partial<Input> = {}) { this.now += ms; const p = this.r.player; tick(this.gs, { up: false, down: false, left: false, right: false, mx: p.x + 20, my: p.y, attack: false, attackPressed: false, roll: false, cancel: false, ...inp } as Input, ms, this.now); }
  give(key: string, qty: number) { const rc = this.actRaw(key, qty); expect(rc).toBe(true); }
  private actRaw(key: string, qty: number) { return giveItem(this.r, key, qty); }
  valid() { return validate(JSON.parse(JSON.stringify(this.gs))) !== null; }
}
import { addItem } from '../../src/game/engine';
export function giveItem(r: RunState, key: string, qty: number): boolean { const before = count(r, key); addItem(r, 'inv', key, qty); return count(r, key) === before + qty; }
export function count(r: RunState, key: string): number { return C(r, 'inv').slots.reduce((n, s) => n + (s && s.key === key ? s.qty : 0), 0); }
