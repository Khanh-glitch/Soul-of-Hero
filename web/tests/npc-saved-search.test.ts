import { it, expect } from 'vitest';
import { newGame, startRun } from '../src/game/engine';
import { humanNavigation } from '../src/game/human-navigation';
import { searches, failedSearches } from '../src/game/navigation-save';
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
// not fit the browser's local storage. The planner now bounds what it keeps, and so what it saves.
it('keeps the saved search continuation bounded: no orphans, no dead planners, one shared cell budget', () => {
  setActiveLayout('veyra05-world');
  const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606).ok).toBe(true);
  const r = gs.run!;
  const people = Object.values(r.humanWorld!.people).filter((h) => h.floor === 0);
  const nav = humanNavigation(r);
  const pendingOf = (id: string) => [...(searches.get(r) ?? new Map<string, unknown>()).keys()].filter((k) => k.split(':')[3] === id);

  // 1. An actor that keeps moving leaves no trail of abandoned searches behind it.
  const walker = people[0], home = [walker.gx, walker.gy];
  for (let step = 0; step < 12; step++) {
    walker.gx = home[0] + (step % 4); walker.gy = home[1] + Math.floor(step / 4);
    nav.route(walker, { tx: home[0] + 900, ty: home[1] + 700, floor: 0 }, 8);
  }
  expect(pendingOf(walker.actorId).length).toBeLessThanOrEqual(2);
  [walker.gx, walker.gy] = home;

  // 2. Someone who died stops occupying the planner as soon as anyone else plans.
  const lost = people[1];
  nav.route(lost, { tx: lost.gx + 900, ty: lost.gy + 700, floor: 0 }, 8);
  expect(pendingOf(lost.actorId).length).toBe(1);
  lost.state = 'DEAD';
  nav.route(people[2], { tx: people[2].gx + 900, ty: people[2].gy + 700, floor: 0 }, 8);
  expect(pendingOf(lost.actorId).length).toBe(0);

  // 3. Forty residents all searching for a pier on the far side of the island share one budget.
  //    The largest search is closed as SEARCH_LIMIT (never as a false NO_PATH) when it is spent.
  const crowd = people.slice(3, 43);
  for (let slice = 0; slice < 60; slice++) {
    for (const h of crowd) nav.route(h, { tx: h.gx > 2000 ? h.gx - 1500 : h.gx + 1500, ty: h.gy > 1400 ? h.gy - 900 : h.gy + 900, floor: 0 }, 256);
  }
  let cells = 0;
  for (const s of (searches.get(r) ?? new Map()).values()) cells += s.points.size;
  expect(cells).toBeLessThanOrEqual(120_000 + 1_100);            // one slice of headroom for the search in hand
  for (const f of (failedSearches.get(r) ?? new Map()).values()) if (f.status === 'SEARCH_LIMIT') expect(f.blocked.length).toBeLessThanOrEqual(256);
  expect(crowd.some((h) => h.routeSearch?.status === 'SEARCH_LIMIT')).toBe(true);

  // 4. The whole continuation stays a small part of the save and still restores.
  const text = serializeSnapshot(gs);
  const navigation = JSON.parse(JSON.parse(text).payload).navigation as string;
  expect(navigation.length).toBeLessThan(2_000_000);
  expect(selectSnapshots([text]).bad).toEqual([]);
}, 120_000);
