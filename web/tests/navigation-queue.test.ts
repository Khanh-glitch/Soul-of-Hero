// The planner memory law of human-navigation.ts, on the real island (seed 7606): many residents ask for a long route
// at once. These are STAGED scenes — copies of one resident, all standing on his tile and all wanting the west
// evacuation berth — so that every search is the same known search (about 30,000 cells) and the queue is the only
// thing under test. The situation itself is real: at h288 of the 336 h campaign 23 residents asked for a berth route.
import { describe, expect, it } from 'vitest';
import { newGame, startRun } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { humanNavigation, type HumanWaypoint } from '../src/game/human-navigation';
import { loadNavigation, saveNavigation, searches, SEARCH_LIMIT_CELLS } from '../src/game/navigation-save';
import { measureWorldWork } from '../src/game/world-work';
import type { HumanRecord } from '../src/game/humanworld';
import type { RunState } from '../src/game/core';
import { T0 } from './helpers/g1b-kit';

const SMALL = 4096, CAP = 160_000, CALL = 256, LIVE_SECONDS = 120;

function scene(copies: number, of = 'h7') {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!, hw = r.humanWorld!;
  const berth = hw.evacuation['evac:po_evac_west'];
  const target: HumanWaypoint = { tx: berth.siteGx, ty: berth.siteGy, floor: 0 };
  // h7: the cook of Greywater who boarded at this berth in the campaign (951 steps from his door).
  const base = hw.people[of];
  expect(base.floor).toBe(0);
  if (of === 'h7') expect(base.community).toBe('com:po_greywater');
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
    expect(alone.examined).toBeLessThan(48000);                                   // short enough for two to run side by side to the end
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

// The berths are far: at h288 of the campaign most residents who wanted to leave needed 49,000-85,000 cells of search
// to find the west berth. STAGED scenes again — copies of real residents at their own doors on the day-one island.
describe('planner memory law: a search may run to 96,000 cells, and the second lane holds still instead of being lost', () => {
  const OLD_LIMIT = 48_000;

  it('a resident whose route needs more than the old 48,000-cell limit gets it, and the search survives a save on the way', () => {
    // The builder of Sapgrove: 1,380 steps from the west berth.
    const { r, target, crowd: [h] } = scene(1, 'h4w'), nav = humanNavigation(r);
    let path: HumanWaypoint[] | null = null, calls = 0, savedPast = 0;
    while (!path && calls < 1000) {
      calls++; tick(r); path = nav.route(h, target);
      if (path) break;
      expect(h.routeSearch?.status).toBe('PENDING_SEARCH');
      if (!savedPast && h.routeSearch!.expanded > OLD_LIMIT + CALL) {              // past what the old loader accepted
        const saved = saveNavigation(r)!; loadNavigation(r, saved); expect(saveNavigation(r)).toBe(saved); savedPast = h.routeSearch!.expanded;
      }
    }
    console.log('FAR', path?.length, h.routeSearch?.expanded, calls, savedPast);
    expect(h.routeSearch?.status).toBe('FOUND');
    expect(path!.length).toBeGreaterThan(1300);
    expect(savedPast).toBeGreaterThan(OLD_LIMIT + CALL);
    expect(h.routeSearch!.expanded).toBeGreaterThan(OLD_LIMIT + CALL);
    expect(h.routeSearch!.expanded).toBeLessThan(SEARCH_LIMIT_CELLS);
    expect(calls).toBe(Math.ceil(h.routeSearch!.expanded / CALL));                // the save in the middle cost no work
  }, 600000);

  it('two searches that both run to the limit, with a queue behind: the cap holds and neither loses a cell', () => {
    // Two cooks of the Glade (their door is beyond even the new limit). They search alone for a while, side by side,
    // so that the second is itself a long search when it has to hold still; then ten of the Greywater cook arrive
    // behind them and spend their turns on the first.
    const far = scene(2, 'h4u'), { r, hw, target } = far, nav = humanNavigation(r);
    const behind: HumanRecord[] = [];
    for (let i = 0; i < 10; i++) { const h = { ...hw.people.h7, actorId: `b${i}`, routeSearch: undefined } as HumanRecord; hw.people[h.actorId] = h; behind.push(h); }
    const everyone = [...far.crowd, ...behind], done = new Map<string, string>(), held = new Map<string, number>();
    const ALONE = 220;
    let rounds = 0, maxCells = 0, maxPair = 0, maxSecond = 0, tickets = 0;
    while (done.size < everyone.length && rounds < 3000) {
      rounds++; tick(r);
      for (const h of rounds <= ALONE ? far.crowd : everyone) {
        if (done.has(h.actorId)) continue;
        const path = nav.route(h, target), status = h.routeSearch!.status;
        if (status !== 'PENDING_SEARCH') done.set(h.actorId, status);
        expect(!!path).toBe(status === 'FOUND');
        const pending = pendingOf(r), total = cells(r); maxCells = Math.max(maxCells, total);
        expect(total).toBeLessThanOrEqual(CAP);                                     // 1. the cap, after every call
        // 2. the two far searches never shrink: nothing they hold is dropped or emptied before their owner gets the answer
        for (const [id, s] of pending) {
          const who = owner(id); if (who !== 'q0' && who !== 'q1') continue;
          expect([who, s.points.size >= (held.get(who) ?? 0)]).toEqual([who, true]); held.set(who, s.points.size);
        }
        for (const who of ['q0', 'q1']) if (!done.has(who) && held.has(who)) expect([who, [...pending.keys()].some(id => owner(id) === who)]).toEqual([who, true]);
        const sizes = [...pending.values()].map(s => s.points.size).sort((a, b) => b - a);
        if (sizes.length > 1 && !done.has('q0') && !done.has('q1')) { maxPair = Math.max(maxPair, sizes[0] + sizes[1]); maxSecond = Math.max(maxSecond, sizes[1]); }
        tickets = Math.max(tickets, [...pending.values()].filter(s => s.points.size === 1 && !s.heap.length && s.expanded >= SMALL).length);
      }
    }
    console.log('PAIR', { rounds, maxCells, maxPair, maxSecond, tickets, done: [...done] });
    expect(done.get('q0')).toBe('SEARCH_LIMIT'); expect(done.get('q1')).toBe('SEARCH_LIMIT');
    for (const who of ['q0', 'q1']) { expect(hw.people[who].routeSearch!.expanded).toBeGreaterThanOrEqual(SEARCH_LIMIT_CELLS); expect(held.get(who)).toBeGreaterThan(SEARCH_LIMIT_CELLS); }
    expect(maxSecond).toBeGreaterThan(40_000);                                    // the second really was a long search held still
    expect(maxPair).toBeGreaterThan(140_000);                                     // and the first really ran on beside it
    for (const h of behind) expect([h.actorId, done.get(h.actorId)]).toEqual([h.actorId, 'FOUND']);   // the queue was served afterwards
  }, 600000);
});
