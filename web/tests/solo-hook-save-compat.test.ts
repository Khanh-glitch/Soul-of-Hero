import { afterEach, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { T, TILE, WW, type GameState } from '../src/game/core';
import { setActiveLayout } from '../src/game/world';
import { getWindowWorld } from '../src/veyra05/window';
import { mapDigest } from '../src/game/map-package';
import { sourceDigest } from '../src/game/world-economy';
import { validate, selectSnapshots, serializeSnapshot } from '../src/game/persist';
import { preHookPartitionDigest, recoverHookPartitionActors } from '../src/veyra05/hook-compat';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/pre-hook/3682329.json.gz', import.meta.url))).toString()) as {
  commit: string; snapshots: string[]; fingerprints: { layout: string; rules: 3 | 4; mapDigest: string; sourceDigest: string }[];
};
const original = (index = 0): GameState => JSON.parse(JSON.parse(fixture.snapshots[index]).payload);
afterEach(() => setActiveLayout('shipping'));

it('reconstructs exact independently exported pre-7d00481 fingerprints for both source rules and clipped windows', () => {
  expect(fixture.commit).toBe('3682329719b9cdd1eadaeed791f0ea8c29733714');
  for (const old of fixture.fingerprints) {
    const ww = getWindowWorld(old.layout, old.rules);
    expect(preHookPartitionDigest(ww), `${old.layout}/r${old.rules}`).toBe(old.mapDigest);
    expect(sourceDigest(ww.floors.ground.sources)).toBe(old.sourceDigest);
    expect(preHookPartitionDigest(ww)).not.toBe(mapDigest(ww.world));
  }
}, 20000);

for (let index = 0; index < fixture.snapshots.length; index++) it(`loads genuine old snapshot ${index}, keeps custody/clock/738 sources, and resaves idempotently`, () => {
  const before = original(index), picked = selectSnapshots([fixture.snapshots[index], null]);
  expect(picked.bad).toEqual([]); expect(picked.conflict).toBe(false); expect(picked.gs).not.toBeNull();
  const gs = picked.gs!, r = gs.run!, ww = getWindowWorld(r.layoutId!, r.sourceMap!.rules);
  expect(r.sourceMap!.mapDigest).toBe(mapDigest(ww.world));
  expect(r.sourceMap!.mapDigest).not.toBe(before.run!.sourceMap!.mapDigest);
  const normalized = structuredClone(gs);
  normalized.run!.sourceMap!.mapDigest = before.run!.sourceMap!.mapDigest;
  // Fixture 1 stood on an old legal floor cell which the new partition closes.
  if (index === 1) {
    const x = Math.floor(r.player.x / TILE), y = Math.floor(r.player.y / TILE), i = y * WW + x;
    expect(ww.floors.ground.tiles[i]).not.toBe(T.PWALL);
    expect(ww.floors.ground.solidProps[i]).toBe(0);
    expect(Math.hypot(r.player.x - before.run!.player.x, r.player.y - before.run!.player.y)).toBe(TILE);
    normalized.run!.player.x = before.run!.player.x; normalized.run!.player.y = before.run!.player.y;
  }
  expect(normalized).toEqual(before); // everything else, including every UID and source timer, is exact
  const once = JSON.stringify(gs); expect(validate(gs)).not.toBeNull(); expect(JSON.stringify(gs)).toBe(once);
  const reloaded = selectSnapshots([serializeSnapshot(gs)]);
  expect(reloaded.bad).toEqual([]); expect(reloaded.gs).toEqual(gs);
}, 20000);

it('does not whitelist corrupt fingerprints, source identities, provenance, source IDs or UIDs', () => {
  const mutations: ((g: GameState) => void)[] = [
    g => { g.run!.sourceMap!.mapDigest = '00000000'; },
    g => { g.run!.sourceMap!.digest = '00000000'; },
    g => { g.run!.sourceMap!.veyra!.sourceCommit = 'wrong'; },
    g => { g.run!.layoutId = 'veyra05-at-2496-608'; },
    g => { const e = Object.values(g.run!.entities).find(e => e.g1b)!; e.g1b!.sid = 'foreign'; },
    g => { const stacks = g.run!.custody.inv.slots.filter(s => s !== null); expect(stacks.length).toBeGreaterThan(1); stacks[1].uid = stacks[0].uid; },
  ];
  for (const mutate of mutations) { const raw = original(); mutate(raw); expect(validate(raw)).toBeNull(); }
});

it('fails actor recovery atomically if no adjacent cell is legal; does not move unrelated actors', () => {
  const gs = original(1), r = gs.run!, ww = getWindowWorld(r.layoutId!, 4), g = ww.floors.ground;
  const stub = { ...ww, floors: { ...ww.floors, ground: { ...g, walkable: new Uint8Array(g.walkable.length) } } };
  const before = structuredClone(r);
  expect(recoverHookPartitionActors(r, stub)).toBe(false); expect(r).toEqual(before);
  const outside = original().run!; const unchanged = structuredClone(outside);
  expect(recoverHookPartitionActors(outside, ww)).toBe(true); expect(outside).toEqual(unchanged);
});

it('uses ground fingerprint even when a different layer is installed, and refuses unrelated/live-changed maps', () => {
  const old = fixture.fingerprints[1], ww = getWindowWorld(old.layout, old.rules);
  const upper = ww.floors.layers.get(1)!; expect(upper).toBeTruthy();
  const view = { ...ww, world: { ...ww.world, tiles: upper.tiles, buildings: upper.buildings, statics: upper.statics } };
  expect(preHookPartitionDigest(view)).toBe(old.mapDigest);
  const unrelated = { ...ww, world: { ...ww.world }, win: { ...ww.win, originTx: 0, originTy: 0 } };
  expect(preHookPartitionDigest(unrelated)).toBeNull();
  const tiles = ww.floors.ground.tiles.slice(); tiles[(691-ww.win.originTy)*WW+2598-ww.win.originTx] = T.ROAD;
  const changed = { ...ww, world: { ...ww.world }, floors: { ...ww.floors, ground: { ...ww.floors.ground, tiles } } };
  expect(preHookPartitionDigest(changed)).toBeNull();
});
