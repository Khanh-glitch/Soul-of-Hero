// The planner memory law of human-navigation.ts, on the real island (seed 7606): many residents ask for a long route
// at once. These are STAGED scenes — copies of one resident, all standing on his tile and all wanting the west
// evacuation berth — so that every search is the same known search (about 30,000 cells) and the queue is the only
// thing under test. The situation itself is real: at h288 of the 336 h campaign 23 residents asked for a berth route.
import { describe, expect, it } from 'vitest';
import { newGame, startRun } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { humanNavigation, type HumanWaypoint } from '../src/game/human-navigation';
import { loadNavigation, saveNavigation, searches } from '../src/game/navigation-save';
import { measureWorldWork } from '../src/game/world-work';
import type { HumanRecord } from '../src/game/humanworld';
import type { RunState } from '../src/game/core';
import { T0 } from './helpers/g1b-kit';

const SMALL = 4096, CAP = 160_000, CALL = 256, LIVE_SECONDS = 120;

function scene(copies: number) {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!, hw = r.humanWorld!;
  const berth = hw.evacuation['evac:po_evac_west'];
  const target: HumanWaypoint = { tx: berth.siteGx, ty: berth.siteGy, floor: 0 };
  // The cook of Greywater who boarded at this berth in the campaign (951 steps from his door).
  const base = hw.people.h7;
  expect([base.community, base.floor]).toEqual(['com:po_greywater', 0]);
  const crowd: HumanRecord[] = [];
  for (let i = 0; i < copies; i++) { const h = { ...base, actorId: `q${i}`, routeSearch: undefined } as HumanRecord; hw.people[h.actorId] = h; crowd.push(h); }
  return { r, hw, target, base, crowd };
}
const pendingOf = (r: RunState) => searches.get(r) ?? new Map();
const cells = (r: RunState) => [...pendingOf(r).values()].reduce((n, s) => n + s.points.size, 0);
const owner = (id: string) => id.split(':')[3];
const tick = (r: RunState) => { r.clock.lastSimAt += 1000; };

/** One resident alone, asked once a second until he has an answer. */
function solo() {
  const { r, target, crowd: [h] } = scene(1), nav = humanNavigation(r);
  let calls = 0, path: HumanWaypoint[] | null = null;
  const work = measureWorldWork(() => { while (!path && calls < 400) { calls++; tick(r); path = nav.route(h, target); if (!path) expect(h.routeSearch?.status).toBe('PENDING_SEARCH'); } });
  return { path: path!, calls, examined: h.routeSearch!.expanded, expansions: work.counts.routeExpansions };
}

describe('planner memory law: long searches queue, queued turns help, nothing near its end is thrown away', () => {
  const alone = solo();

  it('the staged search is a long one that a lone resident finishes', () => {
    expect(alone.path.length).toBeGreaterThan(900);
    expect(alone.examined).toBeGreaterThan(6 * SMALL);
    expect(alone.examined).toBeLessThan(48000);
    expect(alone.calls).toBe(Math.ceil(alone.examined / CALL));
    console.log('SOLO', alone.path.length, alone.examined, alone.calls);
  });

  it('40 residents at once: all get the lone resident\'s route, no turn is wasted, and the cap holds', () => {
    const N = 40, { r, target, crowd } = scene(N), nav = humanNavigation(r);
    const got = new Map<string, HumanWaypoint[]>();
    let rounds = 0, tickets = 0, maxCells = 0, maxLong = 0;
    const work = measureWorldWork(() => {
      while (got.size < N && rounds < 2000) {
        rounds++; tick(r);
        for (const h of crowd) {
          if (got.has(h.actorId)) continue;
          const before = [...pendingOf(r).entries()].sort((a, b) => b[1].points.size - a[1].points.size).slice(0, 2).filter(([, s]) => s.points.size >= SMALL).map(([id]) => id);
          const path = nav.route(h, target);
          if (path) got.set(h.actorId, path);
          else expect(h.routeSearch?.status).toBe('PENDING_SEARCH');          // never NO_PATH, never SEARCH_LIMIT
          const pending = pendingOf(r);
          // 1. the two most advanced searches are never dropped or emptied: one leaves only when its owner takes the route
          for (const id of before) if (!pending.has(id) || pending.get(id)!.points.size < SMALL) expect([id, owner(id) === h.actorId && !!path]).toEqual([id, true]);
          // 2. the cap holds after every call
          const total = cells(r); maxCells = Math.max(maxCells, total); expect(total).toBeLessThanOrEqual(CAP);
          // 3. at most two searches are past the queueing size by more than one call's growth
          const long = [...pending.values()].filter(s => s.points.size >= SMALL + 3 * CALL).length; maxLong = Math.max(maxLong, long); expect(long).toBeLessThanOrEqual(2);
          tickets = Math.max(tickets, [...pending.values()].filter(s => s.points.size === 1 && !s.heap.length && s.expanded >= SMALL).length);
        }
        if (rounds === 20 || rounds === 60 || rounds === 100) {                 // 4. the queue survives a save: tickets, lanes and all
          const saved = saveNavigation(r)!; loadNavigation(r, saved); expect(saveNavigation(r)).toBe(saved);
        }
      }
    });
    expect(got.size).toBe(N);
    for (const path of got.values()) expect(path).toEqual(alone.path);          // helped or not, the same route
    console.log('CROWD', { rounds, tickets, maxCells, maxLong, expansions: work.counts.routeExpansions, soloTotal: N * alone.expansions });
    expect(tickets).toBeGreaterThan(0);                                         // the cap was really reached
    // 5. no turn is wasted. Two searches run at a time and everybody still waiting spends his one call a round on
    //    them, so a pair takes 2 x (calls of a lone search) / (residents still waiting) rounds, plus the round in
    //    which each owner collects his route.
    let fair = 0; for (let waiting = N; waiting > 0; waiting -= 2) fair += Math.ceil(2 * alone.calls / waiting) + 2;
    expect(rounds).toBeLessThanOrEqual(fair);
    // 6. and no work is thrown away, except the first 4,096 cells of a search that was emptied to a ticket.
    expect(work.counts.routeExpansions).toBeGreaterThanOrEqual(N * alone.expansions);
    expect(work.counts.routeExpansions).toBeLessThanOrEqual(N * alone.expansions + N * (SMALL + 2 * CALL));
    console.log('FAIR', fair);
  }, 600000);

  it('a search nobody asks about any more gives up its lane', () => {
    const { r, target, crowd: [a, b, c] } = scene(3), nav = humanNavigation(r);
    for (let i = 0; i < 30; i++) { tick(r); expect(nav.route(a, target)).toBeNull(); expect(nav.route(b, target)).toBeNull(); }   // a and b hold the two lanes
    const sizes = () => [...pendingOf(r).entries()].map(([id, s]) => [owner(id), s.points.size] as const);
    expect(sizes().filter(([, n]) => n >= SMALL).map(([who]) => who).sort()).toEqual(['q0', 'q1']);
    // c queues behind them and spends his turns on their searches; they stop asking.
    let path: HumanWaypoint[] | null = null, waited = 0;
    for (; waited < LIVE_SECONDS; waited++) { tick(r); path = nav.route(c, target); expect(path).toBeNull(); }
    const cSearch = () => [...pendingOf(r).entries()].find(([id]) => owner(id) === 'q2')![1];
    expect(cSearch().points.size).toBeLessThan(SMALL + 3 * CALL);                 // still queued after two silent minutes
    for (let i = 0; i < 400 && !path; i++) { tick(r); path = nav.route(c, target); }
    expect(path).toEqual(alone.path);                                           // then the lane was his
  }, 600000);
});
