// Live play: the residents' step may wait a few frames when none of them has anything due (sim.ts advanceWorld,
// humansMayWait). These tests pin what that must not change: nothing due is ever passed over, a walker keeps its
// pace and is always drawn within the lead the renderer allows, and the cases stepped on every frame stay so.
import { describe, expect, it } from 'vitest';
import { TILE } from '../src/game/core';
import { newGame, startRun } from '../src/game/engine';
import { tick } from '../src/game/sim';
import { setActiveLayout } from '../src/game/world';
import { HUMAN_DRAW_LEAD_MS, PROFILES, humansMayWait, humanWorldPosition, newHumanWorld } from '../src/game/humanworld';
import { profileWorldWork } from '../src/game/world-work';

const T0 = Date.UTC(2026, 10, 15, 8);
const input = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false } as never;

describe('residents wait for their next event in live play', () => {
  it('waits only while nothing is due, never past the draw lead, never during a fight, an escort, first aid or a risen Elder', () => {
    const hw = newHumanWorld('run_test', T0);
    const person = (over: object) => ({ state: 'IDLE', ...over }) as never;
    hw.people = { a: person({}), b: person({ state: 'WORKING' }) };
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(true);
    expect(humansMayWait(hw, T0 + 16, T0 + 16)).toBe(false);                       // something is due now
    expect(humansMayWait(hw, T0 + 16, T0 + 10)).toBe(false);                       // something is overdue
    expect(humansMayWait(hw, T0 + HUMAN_DRAW_LEAD_MS, T0 + 400)).toBe(false);      // a walker would be drawn standing still
    hw.lastNeedsAt = T0 - 40;
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(false);                      // needs clock too far behind
    hw.lastNeedsAt = T0;
    const stride = { state: 'MOVING', intent: { kind: 'work', route: [{ tx: 1, ty: 1, floor: 0 }] } };   // route, no stride under way
    for (const lively of [{ state: 'FIGHTING' }, { following: true }, { intent: { kind: 'fight' } }, { spiritStep: { arriveAt: T0 + 900 } }, stride]) {
      hw.people = { a: person({}), b: person(lively) };
      expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(false);
    }
    hw.people = { a: person({ ...stride, motion: { elapsedMs: 10 } }) };
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(true);                        // a stride under way has its own instant
    hw.people = { a: person({}) };
    hw.playerAid = { id: 'aid' } as never;
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(false);
    delete hw.playerAid;
    hw.elderPressure = { e: { alive: true, awakenedAt: T0 } as never };
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(false);
    hw.elderPressure = { e: { alive: true } as never };
    expect(humansMayWait(hw, T0 + 16, T0 + 400)).toBe(true);
  });

  it('steps the real population less than once a frame without passing over a due moment or slowing a walker', () => {
    setActiveLayout('veyra05-world');
    const gs = newGame(); expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
    const r = gs.run!, hw = r.humanWorld!; let now = r.clock.lastSimAt;
    const frames = 900, frameMs = 1000 / 60;
    const strideMs = (profile: keyof typeof PROFILES) => TILE / PROFILES[profile].speed * 1000;
    // Per walker: when it was first seen on its current stride, and the tiles it has finished since it was first seen.
    const walked = new Map<string, { since: number; tiles: number; at: string; unbroken: boolean }>();
    let worstLag = 0, worstOverdue = 0, walkerFrames = 0, standing = 0;
    const work = profileWorldWork(() => {
      for (let f = 0; f < frames; f++) {
        now += frameMs; tick(gs, input, frameMs, now);
        worstLag = Math.max(worstLag, now - hw.lastStepAt!, now - hw.lastNeedsAt!);
        for (const h of Object.values(hw.people)) {
          // Timed work that came due inside this frame was closed at its own instant.
          if (h.state === 'WORKING' && h.intent) worstOverdue = Math.max(worstOverdue, now - h.intent.dueAt);
          const m = h.motion, seen = walked.get(h.actorId);
          if (h.state === 'MOVING' && h.intent?.route?.length && !m) standing++;
          if (h.state !== 'MOVING' || !m) { if (seen) seen.unbroken = false; continue; }
          walkerFrames++;
          // A stride never runs past its own length unanswered, and the drawn body never leaves the stride.
          worstOverdue = Math.max(worstOverdue, m.elapsedMs + (now - m.updatedAt!) - strideMs(h.profile));
          const drawn = humanWorldPosition(h, now), along = Math.abs(drawn.gx - 0.5 - m.fromGx) + Math.abs(drawn.gy - 0.5 - m.fromGy);
          expect(along).toBeCloseTo((m.elapsedMs + (now - m.updatedAt!)) / strideMs(h.profile), 6);   // drawn exactly where the clock says
          const tile = `${h.floor}:${h.gx}:${h.gy}`;
          if (!seen || !seen.unbroken) walked.set(h.actorId, { since: now - m.elapsedMs - (now - m.updatedAt!), tiles: 0, at: tile, unbroken: true });
          else if (seen.at !== tile) { seen.tiles++; seen.at = tile; }
        }
      }
    });
    const steps = work.timings.stepHumans.calls;
    expect(steps).toBeGreaterThanOrEqual(Math.floor(frames * frameMs / HUMAN_DRAW_LEAD_MS));   // never rarer than the draw lead allows
    expect(steps).toBeLessThan(frames);                                                         // before: at least one per frame
    expect(work.timings.tickNeeds.calls).toBe(steps);
    expect(worstLag).toBeLessThan(HUMAN_DRAW_LEAD_MS);
    expect(worstOverdue).toBeLessThanOrEqual(1e-6);
    expect(walkerFrames).toBeGreaterThan(frames);        // the scene really has people walking
    // Pace: a walker seen for whole strides finished them in stride time (the instant of arrival is exact, so the
    // count can only be short by the stride still under way).
    let checked = 0;
    for (const [id, w] of walked) {
      if (!w.unbroken || w.tiles < 3) continue;
      const h = hw.people[id]; checked++;
      expect(w.tiles).toBe(Math.floor((now - w.since + 1e-6) / strideMs(h.profile)));
    }
    expect(checked).toBeGreaterThan(0);
  }, 300000);
});
