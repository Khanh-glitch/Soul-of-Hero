import { it, expect } from 'vitest';
import { newGame, startRun } from '../src/game/engine';
import { humanNavigation } from '../src/game/human-navigation';
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
