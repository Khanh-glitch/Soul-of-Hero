/**
 * G1B batch 3 — save-integrity triage for the "Save refused: integrity check" seen in a capture run.
 *
 * Root cause: the icons capture wrote stacks straight into the pack with `mkStack(r, key, 1)`, bypassing `addItem`.
 * For the `blueprint` item that mints a stack with NO recipe meta, which violates the save invariant
 * `stack(): a blueprint must name a real recipe`. The save is refused from that point on — a later "Take all" at the
 * Academy toolbox only *observed* the already-invalid state. A clean Take All at the Academy toolbox saves fine.
 *
 * `diagnoseInvalidState` now names the exact rule (via `stackInvariant`) instead of returning a generic 'other'.
 */
import { describe, expect, it } from 'vitest';
import { WW, WH, TILE } from '../src/game/core';
import { C, newGame, startRun, mkStack, dispatch } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { diagnoseInvalidState, validate, stackInvariant } from '../src/game/persist';
import { T0 } from './helpers/g1b-kit';

function startAt(ax: number, ay: number, seed = 7606) {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx)), ly = Math.max(8, Math.min(WH - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

describe('G1B save-integrity triage', () => {
  it('a blueprint minted without a recipe meta is the exact invariant that refuses the save', () => {
    const gs = startAt(921, 259);
    const r: any = gs.run!;
    const sl = r.custody.inv.slots;
    for (let i = 0; i < sl.length; i++) sl[i] = i === 20 ? mkStack(r, 'blueprint', 1) : null;   // the icons capture's page-3 slot
    expect(stackInvariant(sl[20], new Set(), (id, re) => { const m = re.exec(id); return !m || parseInt(m[1], 36) < r.nextId; })).toBe('blueprint-without-recipe:none');
    expect(validate(JSON.parse(JSON.stringify(gs)))).toBeNull();
    expect(diagnoseInvalidState(gs)).toBe('blueprint-without-recipe:none');
  }, 120000);

  it('a clean Take All at the Academy toolbox saves (the refusal was the earlier icons corruption, not the take)', () => {
    const gs = startAt(921, 259);
    const r: any = gs.run!;
    const e: any = Object.values(r.entities).find((q: any) => q.kind === 'loot' && q.id === 'ea')!;
    r.player.x = (e.tx + 1) * TILE + 8; r.player.y = (e.ty + 1) * TILE + 8;
    const c = C(r, e.c);
    for (let i = 0; i < c.slots.length; i++) if (c.slots[i]) expect(dispatch(gs, { id: `t${i}`, type: 'move', from: e.c, fs: i, to: 'inv' } as any, T0 + 10).ok).toBe(true);
    expect(c.slots.every((s: any) => !s)).toBe(true);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
  }, 120000);
});
