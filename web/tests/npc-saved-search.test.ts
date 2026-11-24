import { it, expect } from 'vitest';
import { newGame, startRun } from '../src/game/engine';
import { humanNavigation } from '../src/game/human-navigation';
import { searches, failedSearches, SEARCH_LIMIT_CELLS } from '../src/game/navigation-save';
import { serializeSnapshot, selectSnapshots } from '../src/game/persist';
import { setActiveLayout } from '../src/game/world';
import { T0 } from './helpers/g1b-kit';

// Release gate: on a build which drops the search frontier, the next actor
// decision is delayed even on a straight unobstructed lane. No 24h replay or
// injected routing/checkpoint state required. Always runs in regression.
it('a validated Continue finishes a pending physical search on the same work slice', () => {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!,
    nav = humanNavigation(r);
  const h = Object.values(r.humanWorld!.people).find(
    (h) => h.floor === 0 && [1, 2, 3].every((dx) => nav.free({ tx: h.gx + dx, ty: h.gy, floor: 0 }, h)),
  )!;
  expect(h).toBeDefined();
  const target = { tx: h.gx + 3, ty: h.gy, floor: 0 };
  expect(nav.route(h, target, 2)).toBeNull();
  expect(h.routeSearch).toMatchObject({ status: 'PENDING_SEARCH', expanded: 2 });
  const loaded = selectSnapshots([serializeSnapshot(gs)]);
  expect(loaded.bad).toEqual([]);
  const copy = loaded.gs!.run!,
    peer = copy.humanWorld!.people[h.actorId];
  expect(setActiveLayout(copy.layoutId!)).toBe(true);
  expect(peer.routeSearch).toEqual(h.routeSearch);
  const warm = nav.route(h, target, 1),
    cold = humanNavigation(copy).route(peer, target, 1);
  expect(warm).toEqual([1, 2].map((dx) => ({ tx: h.gx + dx, ty: h.gy, floor: 0 })));
  expect(cold).toEqual(warm);
  expect(peer.routeSearch).toEqual(h.routeSearch);
});

it('restores an enclosed-component proof across actors but never opens an unauthorized edge', () => {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!,
    h = r.humanWorld!.people.h2;
  // Unsupported floor as in npc-global-navigation; the proof works for a peer
  // with matching access, NOT for an actor of a different community.
  const origin = { ...h, floor: 3 };
  const goal = { tx: h.gx + 8, ty: h.gy, floor: 3 };
  expect(humanNavigation(r).route(origin, goal)).toBeNull();
  expect(origin.routeSearch?.status).toBe('NO_PATH');
  const text = serializeSnapshot(gs),
    copy = selectSnapshots([text, text]).gs!.run!;
  const peer = { ...origin, actorId: 'peer', routeSearch: undefined as typeof origin.routeSearch };
  expect(humanNavigation(copy).route(peer, goal, 0)).toBeNull();
  expect(peer.routeSearch?.status).toBe('NO_PATH');
  peer.community = 'elsewhere';
  expect(humanNavigation(copy).route(peer, goal, 0)).toBeNull();
  expect(peer.routeSearch?.status).toBe('PENDING_SEARCH');
  // A truncated wire record cannot silently continue as a cold search. A
  // separate intact copy is still usable; no repair edits to the original.
  const raw = JSON.parse(JSON.parse(text).payload);
  raw.navigation = raw.navigation.slice(0, -8);
  const recovered = selectSnapshots([JSON.stringify(raw), text]);
  expect(recovered.bad).toEqual([0]);
  expect(recovered.gs).toBeTruthy();
});

// Planner memory law (2026-11-21). The seed-7606 campaign grew the saved continuation from 1.6 MB
// to 16 MB after h288: every tile an actor stepped off left an orphaned search behind, the dead
// kept theirs, and island-long evacuation searches each held ~50,000 cells. A save that size does
// not fit the browser's local storage. The planner now bounds what it keeps, and so what it saves —
// by making long searches wait their turn, never by calling a route impossible early.
it('keeps the saved search continuation bounded: abandoned and dead searches go, long ones queue', () => {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!;
  const people = Object.values(r.humanWorld!.people).filter((h) => h.floor === 0);
  const nav = humanNavigation(r);
  const far = (h: { gx: number; gy: number }) => ({ tx: h.gx > 2000 ? h.gx - 1500 : h.gx + 1500, ty: h.gy > 1400 ? h.gy - 900 : h.gy + 900, floor: 0 });
  const pendingOf = (id: string) => [...(searches.get(r) ?? new Map<string, unknown>()).keys()].filter((k) => k.split(':')[3] === id);

  // 1. A search nobody asks about any more is abandoned work: it is dropped once it is 30 min old.
  const walker = people[0], home = [walker.gx, walker.gy];
  for (let step = 0; step < 6; step++) {
    walker.gx = home[0] + step;
    nav.route(walker, far({ gx: home[0], gy: home[1] }), 8);
  }
  [walker.gx, walker.gy] = home;
  expect(pendingOf(walker.actorId).length).toBeGreaterThan(1);
  r.clock.lastSimAt += 31 * 60_000;
  nav.route(people[2], far(people[2]), 8);                      // anyone starting a search sweeps the planner
  expect(pendingOf(walker.actorId).length).toBe(0);

  // 2. Someone who died stops occupying the planner as soon as anyone else plans.
  const lost = people[1];
  nav.route(lost, far(lost), 8);
  expect(pendingOf(lost.actorId).length).toBe(1);
  lost.state = 'DEAD';
  nav.route(people[3], far(people[3]), 8);
  expect(pendingOf(lost.actorId).length).toBe(0);

  // 3. Forty residents all searching for a pier on the far side of the island. The most advanced
  //    searches run; the others wait their turn. Nobody is told SEARCH_LIMIT before the real limit.
  const crowd = people.slice(4, 44);
  for (let slice = 0; slice < 70; slice++) for (const h of crowd) nav.route(h, far(h), 256);
  let cells = 0;
  for (const s of (searches.get(r) ?? new Map()).values()) cells += s.points.size;
  expect(cells).toBeLessThanOrEqual(160_000 + 1_100);            // one slice of headroom for the search in hand
  for (const f of (failedSearches.get(r) ?? new Map()).values()) {
    if (f.status !== 'SEARCH_LIMIT') continue;
    expect(f.expanded).toBeGreaterThanOrEqual(SEARCH_LIMIT_CELLS);
    expect(f.blocked.length).toBeLessThanOrEqual(256);
  }
  expect(crowd.some((h) => h.lastWorkBlock?.includes('waiting for longer searches ahead'))).toBe(true);
  expect(crowd.every((h) => h.routeSearch?.status !== 'SEARCH_LIMIT' || h.routeSearch.expanded >= SEARCH_LIMIT_CELLS)).toBe(true);

  // 4. The whole continuation stays a small part of the save and still restores.
  const text = serializeSnapshot(gs);
  const navigation = JSON.parse(JSON.parse(text).payload).navigation as string;
  expect(navigation.length).toBeLessThan(2_500_000);
  expect(selectSnapshots([text]).bad).toEqual([]);
}, 120_000);
