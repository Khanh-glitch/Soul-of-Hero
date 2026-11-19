/**
 * ONE INCIDENT PER ASSAULT — control-tower 04 §D negative cases.
 *
 * STATUS: **NOT RUN** (Creator standing order: finish the production plan, qualify afterwards).
 * Authored expectations only; not evidence of play.
 *
 * Law under test: a fight is one committed event. Repeated strikes by the same aggressor a moment
 * later in the same place reuse the original incident id (and its injury flag), so witnesses,
 * grievances and retaliation cannot be multiplied by hit count. A later time, a detached place or a
 * different aggressor is a genuinely new event. Nothing is deleted and no outcome flag is written.
 */
import { describe, expect, it } from 'vitest';
import { HOUR, WW, type GameState } from '../src/game/core';
import { newGame, startRun } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import { applyDamage, makeHuman, type HumanRecord } from '../src/game/humanworld';

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

function spawn(r: NonNullable<GameState['run']>, gx: number, gy: number): HumanRecord {
  const hw = r.humanWorld!;
  return makeHuman(r, hw, {
    sourceId: `fixture:incident:${hw.nextActorSeq}`, gx, gy, floor: r.veyraFloor ?? 0,
    profile: 'civilian', occupation: 'salvager', disposition: 'neutral', proficiency: 0,
  });
}

describe('one incident per committed assault (NOT RUN)', () => {
  it('reuses the incident id for repeated strikes in one fight and opens a new one otherwise', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const victim = spawn(r, 20, 20);
    const attacker = spawn(r, 21, 20);
    const bystander = spawn(r, 22, 20);
    const base = T0 + HOUR;
    const incidents = () => Object.values(hw.incidents).filter(i => i.kind === 'assault' && i.victim === victim.actorId);

    // Two strikes inside the same encounter: one committed event.
    expect(applyDamage(r, hw, victim, 4, 0, base, 'human', attacker.actorId)).toBe(true);
    expect(applyDamage(r, hw, victim, 4, 0, base + 3_000, 'human', attacker.actorId)).toBe(true);
    const first = incidents();
    expect(first).toHaveLength(1);
    expect(first[0].injury).toBe(true);
    expect(hw.people[victim.actorId].disposition_known.incidents.filter(id => id === first[0].id)).toHaveLength(1);
    expect((r as any).receipts ?? []).toBeDefined();

    // A different aggressor on the same body is its own event.
    expect(applyDamage(r, hw, victim, 2, 0, base + 5_000, 'human', bystander.actorId)).toBe(true);
    expect(incidents()).toHaveLength(2);

    // The same aggressor much later (beyond the encounter window) is a new event too.
    expect(applyDamage(r, hw, victim, 4, 0, base + 90_000, 'human', attacker.actorId)).toBe(true);
    expect(incidents()).toHaveLength(3);

    // The victim's book records every distinct incident exactly as many times as it happened.
    const known = hw.people[victim.actorId].disposition_known.incidents;
    expect(new Set(known).size).toBe(known.length);
    expect(victim.state).not.toBe('DEAD');
  });
});
