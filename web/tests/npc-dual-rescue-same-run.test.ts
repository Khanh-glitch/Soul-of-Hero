/**
 * DUAL RESCUE IN ONE RUN — control-tower 05 §E acceptance matrix.
 *
 * STATUS: **NOT RUN** in this implementation pass (Creator standing order: finish the production
 * plan first, qualify afterwards). Authored expectations only; this is not evidence of play.
 *
 * Law under test: in ONE run, a community can physically board and sail (arrival-certified
 * EVACUATED) while another community stays and survives a real h312–h336 Elder contact
 * (SURVIVED_ON_ISLAND), and both outcomes appear in the same finalization without a fabricated
 * "everyone safe" default. Nothing here injects items, deletes people or grants an ending.
 */
import { describe, expect, it } from 'vitest';
import { HOUR, WW, type GameState } from '../src/game/core';
import { newGame, startRun } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import {
  advanceElderPressure, advanceEvacuation, boardEvac, departEvac, elderCoverage,
  evacSchedule, finalizeHumanOutcomes, type EvacTrip,
} from '../src/game/humanworld';

function runAt(ax = 921, ay = 259, seed = 7606): GameState {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx));
  const ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

describe('dual rescue in one run (NOT RUN — authored for the post-implementation qualification gate)', () => {
  it('evacuates one community by sea while another survives the final assault in the same run', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const trip: EvacTrip = Object.values(hw.evacuation)[0];
    const S = evacSchedule();

    // ---- Route A: a real boarding and a real crossing ----
    r.qaOffset = S.openHour * HOUR;
    const boardAt = T0 + 1000;
    advanceEvacuation(r, hw, boardAt);
    expect(trip.phase).toBe('BOARDING');
    const sailing = Object.values(hw.people)
      .filter(h => h.state !== 'DEAD' && h.floor === 0 && h.state !== 'ON_VESSEL')
      .slice(0, 3);
    for (const h of sailing) {
      h.state = 'IDLE'; h.gx = trip.siteGx; h.gy = trip.siteGy;
      expect(boardEvac(r, hw, h, trip.tripId, boardAt).ok).toBe(true);
    }
    expect(departEvac(r, hw, trip.tripId, boardAt + 1000).ok).toBe(true);
    advanceEvacuation(r, hw, trip.arriveAt!);
    for (const h of sailing) { expect(h.state).toBe('EVACUATED'); expect(h.outcome).toBe('EVACUATED'); }

    // ---- Route B: another community is physically struck and must live through it ----
    const survivors = Object.values(hw.people)
      .filter(h => h.state !== 'DEAD' && h.state !== 'EVACUATED' && h.floor === 0)
      .slice(0, 4);
    // walk the assault forward from the canonical hour to the final hour through the real authority
    for (let hour = 312; hour <= 336; hour++) {
      const at = T0 + 1000 + hour * HOUR;
      r.qaOffset = hour * HOUR;
      advanceElderPressure(r, hw, at);
    }
    // Every wave must be resolved (contact or a recorded unreachable/final-hour refusal).
    expect(elderCoverage(hw).complete).toBe(true);
    const struck = Object.values(hw.people).filter(h => (h.threat?.waves ?? 0) > 0);
    // At least one body of route B was genuinely threatened by a reached wave.
    expect(struck.length).toBeGreaterThan(0);

    // ---- Same-run ending: both outcomes coexist, and nobody is auto-certified ----
    r.qaOffset = 336 * HOUR;
    const summary = finalizeHumanOutcomes(r, hw, T0 + 1000 + 336 * HOUR);
    expect(summary.evacuated).toBe(sailing.length);
    expect(summary.survived).toBeGreaterThan(0);
    const aliveButUnproven = survivors.filter(h => h.outcome === undefined);
    expect(aliveButUnproven).toHaveLength(0);              // every person has exactly one outcome
    const ids = new Set(Object.keys(hw.people));
    expect(summary.total).toBe(ids.size);                  // run total reconciles with identities
    expect(summary.evacuated + summary.survived + summary.dead + summary.unresolved).toBe(summary.total);
  });
});
