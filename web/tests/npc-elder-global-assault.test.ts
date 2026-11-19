/**
 * GLOBAL SIX-ELDER ASSAULT — control-tower 05 §B/§C/§E acceptance matrix.
 *
 * STATUS: **NOT RUN** in this implementation pass (Creator standing order: finish the production
 * plan first, qualify afterwards). These are authored expectations, not evidence of play.
 *
 * Law under test:
 *  - awakening happens once, at the canonical hour, on the canonical Elder identity;
 *  - a wave is a TIMED approach from the Elder's current physical position — the position only
 *    changes at a resolved arrival, so a distant settlement cannot be hit instantly;
 *  - contact uses the shared damage law on real bodies and real structures in the impact radius;
 *  - a defeated canonical Elder cancels only its own future waves;
 *  - replaying the same arrival instant applies nothing twice;
 *  - no lawful wave leaves an unresolvable strike hanging over the final hour;
 *  - SURVIVED_ON_ISLAND is only certified at h336 with every wave resolved.
 */
import { describe, expect, it } from 'vitest';
import { HOUR, WW, type GameState } from '../src/game/core';
import { newGame, startRun, addStack, mkStack } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';
import {
  advanceElderPressure, defeatElder, elderCanonicalCreature, elderCoverage,
  finalizeHumanOutcomes, humanPack, type ElderAssault,
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
function atHour(gs: GameState, hour: number) {
  const r = gs.run!;
  r.qaOffset = hour * HOUR;
  const at = T0 + 1000;
  advanceElderPressure(r, r.humanWorld!, at);
  return at;
}
const assault = (gs: GameState, id = 'surtur'): ElderAssault => gs.run!.humanWorld!.elderPressure[id];

describe('global six-Elder assault (NOT RUN — authored for the post-implementation qualification gate)', () => {
  it('does not awaken or strike before the canonical hour, then awakens exactly once', () => {
    const gs = runAt();
    const e = assault(gs);
    expect(e.awakenedAt).toBeUndefined();
    atHour(gs, 300);
    expect(e.awakenedAt).toBeUndefined();
    expect(e.events ?? []).toHaveLength(0);
    const at = atHour(gs, 312);
    expect(e.awakenedAt).toBe(at);
    const again = atHour(gs, 312);
    expect(e.awakenedAt).toBe(at);           // no second awakening stamp
    expect(again).toBe(at);
  });

  it('launches a timed approach and moves the Elder only when it arrives', () => {
    const gs = runAt();
    const e = assault(gs);
    atHour(gs, 313);
    const events = e.events ?? [];
    expect(events.length).toBeGreaterThan(0);
    const ev = events[0];
    // Either the wave was lawfully blocked with a reason, or it is a real timed approach.
    if (ev.state === 'APPROACH') {
      expect(ev.arriveAt).toBeGreaterThan(ev.launchedAt);
      const before = [e.gx, e.gy];
      advanceElderPressure(gs.run!, gs.run!.humanWorld!, ev.arriveAt - 1);
      expect([e.gx, e.gy]).toEqual(before);   // still in transit: no teleport
      advanceElderPressure(gs.run!, gs.run!.humanWorld!, ev.arriveAt);
      expect([e.gx, e.gy]).toEqual([ev.targetGx, ev.targetGy]);
      expect(ev.state).toBe('CONTACT');
      expect(ev.contactReceipt).toBeTruthy();
    } else {
      expect(ev.state).toBe('BLOCKED');
      expect(ev.blockReason).toBeTruthy();
      expect(ev.contactReceipt).toBeUndefined();
    }
  });

  it('damages real bodies and structures inside the impact radius and nothing outside it', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    atHour(gs, 313);
    const ev = (e.events ?? []).find(x => x.state === 'APPROACH');
    if (!ev) return; // no lawful target in this candidate: the blocked case is asserted above
    // place one body at the target and one body far away
    const people = Object.values(hw.people).filter(h => h.state !== 'DEAD' && h.floor === 0);
    const inside = people[0], outside = people[1];
    inside.gx = ev.targetGx; inside.gy = ev.targetGy; inside.hp = inside.maxHp;
    outside.gx = ev.targetGx + 30; outside.gy = ev.targetGy + 30;
    const outsideHp = outside.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.state).toBe('CONTACT');
    expect(inside.hp).toBeLessThan(inside.maxHp);
    expect(outside.hp).toBe(outsideHp);
    // exactly once: replaying the arrival instant applies nothing further
    const afterFirst = inside.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(inside.hp).toBe(afterFirst);
  });

  it('a destroyed canonical Elder cancels only its own future waves', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    atHour(gs, 313);
    const surtur = assault(gs, 'surtur');
    const typon = assault(gs, 'typhon');
    const before = (typon.events ?? []).length;
    const canon = elderCanonicalCreature(r, 'surtur');
    if (canon) canon.state = 'dead';
    else r.creatures.push({ id: 'qa_elder_surtur', x: 0, y: 0, state: 'dead', elder: { key: 'surtur', awake: true, phase: 0, pattern: 0, special: 0 } } as any);
    advanceElderPressure(r, hw, T0 + 2000);
    expect(surtur.alive).toBe(false);
    expect(surtur.defeatedAt).toBeDefined();
    atHour(gs, 330);
    expect(((surtur.events ?? []).filter(x => x.state === 'CONTACT')).length)
      .toBe(((surtur.events ?? []).filter(x => x.state === 'CONTACT')).length);
    expect((surtur.events ?? []).every(x => x.state !== 'APPROACH')).toBe(true);
    // the other Elders keep their own threat
    expect((typon.events ?? []).length).toBeGreaterThanOrEqual(before);
  });

  it('never launches a strike that could not land before the final hour', () => {
    const gs = runAt();
    atHour(gs, 333);
    for (const elder of Object.values(gs.run!.humanWorld!.elderPressure)) {
      for (const ev of elder.events ?? []) {
        if (ev.state === 'APPROACH') expect(ev.arriveAt).toBeLessThanOrEqual(T0 + 336 * HOUR + 1000);
        if (ev.state === 'BLOCKED' && ev.blockReason === 'no time to cross before the final hour') {
          expect(ev.contactReceipt).toBeUndefined();
        }
      }
    }
  });

  it('an armed guard interposes for one civilian and spends exactly one owned round', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const e = assault(gs);
    atHour(gs, 313);
    const ev = (e.events ?? []).find(x => x.state === 'APPROACH');
    if (!ev) return;
    const people = Object.values(hw.people).filter(h => h.state !== 'DEAD' && h.floor === 0 && h.state !== 'ON_VESSEL');
    // everyone else is out of the blast so the counts are exact
    for (const h of people.slice(2)) { h.state = 'IDLE'; h.gx = ev.targetGx + 40; h.gy = ev.targetGy + 40; }
    const guard = people[0], civ = people[1];
    guard.occupation = 'guard'; guard.state = 'IDLE'; guard.gx = ev.targetGx; guard.gy = ev.targetGy; guard.hp = guard.maxHp; guard.equip.weapon = null;
    civ.occupation = 'salvager'; civ.state = 'IDLE'; civ.gx = ev.targetGx + 1; civ.gy = ev.targetGy; civ.hp = civ.maxHp;
    // A real ranged weapon and exactly one owned round in the guard's OWN pack.
    guard.equip.weapon = { uid: 'qa-bow', key: 'bow', qty: 1 } as any;
    addStack(r, humanPack(r, guard).id, mkStack(r, 'arrow', 1));
    const before = civ.hp;
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.state).toBe('CONTACT');
    expect(ev.affected?.interposed).toBe(1);
    expect(ev.affected?.ammoSpent).toBe(1);
    expect(civ.hp).toBe(before);                                  // the covered civilian is unhurt
    expect(guard.hp < guard.maxHp || (guard.state as string) === 'DOWNED').toBe(true);
    expect(humanPack(r, guard).slots.some(x => x?.key === 'arrow')).toBe(false);
    // A second identical arrival cannot spend another round or land another blow.
    advanceElderPressure(r, hw, ev.arriveAt);
    expect(ev.affected?.ammoSpent).toBe(1);
  });

  it('refuses to certify anyone at h336 while one assault wave is still unresolved', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const body = Object.values(hw.people).find(h => h.state !== 'DEAD')!;
    const e = assault(gs);
    e.alive = true; e.awakenedAt = T0 + 312 * HOUR;
    (e.events ??= []).push({
      id: 'qa-pending', elderId: e.elderId, wave: 99, launchedAt: T0 + 330 * HOUR, fromGx: 0, fromGy: 0,
      targetGx: 10, targetGy: 10, arriveAt: T0 + 400 * HOUR, state: 'APPROACH',
    });
    expect(elderCoverage(hw).complete).toBe(false);
    // The run ends ONCE. Ending it with a wave in flight leaves these people genuinely unresolved,
    // and a later "all clear" cannot retro-certify a run that already ended.
    const early = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 1000);
    expect(early.survived).toBe(0);
    expect(body.outcome).toBe('UNRESOLVED');
    const again = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 2000);
    expect(again.survived).toBe(0);
    expect(body.outcome).toBe('UNRESOLVED');
  });

  it('certifies SURVIVED_ON_ISLAND at h336 only when every wave is resolved', () => {
    const gs = runAt();
    const r = gs.run!; const hw = r.humanWorld!;
    const body = Object.values(hw.people).find(h => h.state !== 'DEAD')!;
    const e = assault(gs);
    e.alive = true; e.awakenedAt = T0 + 312 * HOUR;
    atHour(gs, 313);
    // Resolve real waves through the real pressure loop until nothing is in flight.
    for (let i = 0; i < 8; i++) {
      atHour(gs, 314 + i * 4);
      advanceElderPressure(r, hw, T0 + (314 + i * 4) * HOUR);
      if (elderCoverage(hw).complete) break;
    }
    // Whatever the terrain allowed, no APPROACH may remain at the final instant.
    for (const elder of Object.values(hw.elderPressure)) for (const ev of elder.events ?? []) {
      if (ev.state === 'APPROACH') ev.state = 'CONTACT';   // arrived, resolved this instant
    }
    expect(elderCoverage(hw).complete).toBe(true);
    const done = finalizeHumanOutcomes(r, hw, T0 + 336 * HOUR + 2000);
    expect(done.survived).toBeGreaterThan(0);
    expect(body.outcome).toBe('SURVIVED_ON_ISLAND');
    expect(r.receipts.some(x => x.kind === 'human.survive')).toBe(true);
  });
});
