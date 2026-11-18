/** Collision-grid rebuild invariants — mechanical only, no experience or route claims.
 * Hoisting the per-cell lookups out of the collision rebuild may change HOW FAST the grid is
 * produced, never WHAT it says. These checks pin that: the grid equals a literal, call-by-call
 * replica of the pre-optimisation algorithm for every one of the 40,000 cells; the door index
 * equals the literal `statics` scan; world content rewritten in place is honoured by `markDirty()`
 * alone; run terrain/source edits are still reclassified; and one run's edits never leak into
 * another run. Exhaustive equality across layouts and window transitions in a real browser is
 * recorded separately in evidence/solo-final-fallback/20261117/frame-work/block-grid-equivalence-wide.json. */
import { afterEach, expect, it } from 'vitest';
import { T, WW, WH, TILE, type RunState } from '../src/game/core';
import { blockGrid, blockedAt, doorTiles, effTile, ladderTiles, markDirty, newGame, sourceAt, startRun } from '../src/game/engine';
import { getWorld, setActiveLayout, SRC_KEYS, type StaticEnt } from '../src/game/world';
import { SOURCES, STRUCTS } from '../src/game/catalog';
import { getWindowWorld } from '../src/veyra05/window';
import { activeFloor, onActiveFloor } from '../src/veyra05/floors';
import { isVeyra05Layout } from '../src/veyra05/scenes';

const NOW = Date.UTC(2026, 10, 17);
afterEach(() => { setActiveLayout('shipping'); markDirty(); });

function run(layout: string, seed = 901) {
  setActiveLayout(layout);
  const gs = newGame();
  expect(startRun(gs, 'female', NOW, null, seed).ok).toBe(true);
  const r = gs.run!;
  expect(r.layoutId).toBe(layout);
  return { gs, r };
}

/** Verbatim replica of the pre-optimisation `cellClass(r, tx, ty)`: one `getWorld()` per cell, the
 * literal door scan, `sourceAt()` per cell and a fresh window/floor resolution per cell. This is the
 * oracle; the shipped code must agree with it everywhere the run has not been edited. */
function referenceCellClass(r: RunState | null, tx: number, ty: number): number {
  const w = getWorld(); const i = ty * WW + tx; const t = r ? effTile(r, tx, ty) : w.tiles[i];
  let c = (t === T.DEEP || t === T.CLIFF || t === T.PWALL) ? 1 : t === T.LAVA ? 5 : (t === T.SHALLOW || t === T.RIVER) ? 4 : 0;
  if (c === 0 && !(t === T.ICE && [T.DEEP, T.SHALLOW, T.RIVER].includes(w.tiles[i])) && (w.packageContract || w.enforceMasks) && !w.economyMap.walkable[i] && !w.statics.some(s => s.kind === 'door' && s.tx === tx && s.ty === ty)) c = 1;
  if (c === 0) {
    if (r) { const s = sourceAt(r, tx, ty); if (s && s.def.block && (s.stock > 0 || s.key === 'wreck')) c = 2; }
    else if (w.src[i] >= 0 && SOURCES[SRC_KEYS[w.src[i]]].block) c = 2;
  }
  if ((c === 0 || c === 4) && r?.layoutId && isVeyra05Layout(r.layoutId)) {
    const ww = getWindowWorld(r.layoutId);
    const layer = ww.floors.layers.get(activeFloor(r)) ?? ww.floors.ground;
    if (layer.solidProps[i]) c = 2;
  }
  return c;
}

/** Verbatim replica of the pre-optimisation `blockGrid(r)` rebuild body. */
function referenceBlockGrid(r: RunState): Uint8Array {
  const w = getWorld();
  const arr = new Uint8Array(WW * WH);
  if (r.sourceLayoutVersion === 3) { for (let i = 0; i < arr.length; i++) arr[i] = referenceCellClass(r, i % WW, (i / WW) | 0); }
  else { for (let i = 0; i < arr.length; i++) arr[i] = referenceCellClass(null, i % WW, (i / WW) | 0); }
  if (r.sourceLayoutVersion === 2) { const overlay = w.sourceOverlayV2; for (let i = 0; i < overlay.length; i++) if (overlay[i] >= 0) arr[i] = referenceCellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.terrain) { const i = +k; arr[i] = referenceCellClass(r, i % WW, (i / WW) | 0); }
  for (const k in r.sources) { const i = +k; arr[i] = referenceCellClass(r, i % WW, (i / WW) | 0); }
  for (const tree of r.natureTrees || []) arr[tree.ty * WW + tree.tx] = 2;
  for (const e of Object.values(r.entities)) {
    if (!onActiveFloor(r, e) || e.tx === undefined) continue; const i = e.ty! * WW + e.tx;
    if (e.kind === 'struct') { const d = STRUCTS[e.type!]; if (d.block && !(e.type!.startsWith('door') && e.open)) arr[i] = 3;
      if (e.ladder && (e.hp ?? 0) > 0) for (const j of ladderTiles(e)) if (arr[j] === 1) arr[j] = 6; }
    else if (e.kind === 'door') { if (!e.open) arr[i] = 3; else if (!r.terrain[i] && w.tiles[i] === T.PWALL && w.statics.some(s => s.kind === 'door' && s.tx === e.tx && s.ty === e.ty)) arr[i] = 0; }
    else if (e.kind === 'airdrop' && (e.airdrop?.phase === 'locked' || e.airdrop?.phase === 'open' || e.airdrop?.phase === 'partial')) arr[i] = 3;
    else if (e.kind === 'loot' || e.kind === 'cash' || e.kind === 'vendor' || e.kind === 'gen' || e.kind === 'evac' || e.kind === 'recycler') arr[i] = 3;
  }
  return arr;
}
function expectSameGrid(r: RunState, label: string) {
  markDirty();
  const actual = blockGrid(r).slice();
  const expected = referenceBlockGrid(r);
  let mismatches = 0, first = -1;
  for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) { mismatches++; if (first < 0) first = i; }
  expect(mismatches, `${label}: ${mismatches} cell(s) differ, first at ${first} actual=${first < 0 ? '-' : actual[first]} expected=${first < 0 ? '-' : expected[first]}`).toBe(0);
}

it('the rebuilt grid equals the literal pre-optimisation algorithm on every cell of a real run', () => {
  for (const layout of ['veyra05-at-1920-512', 'veyra05-greywater', 'veyra05-elderwood']) {
    const { gs, r } = run(layout);
    expect(r.sourceLayoutVersion, `${layout} must exercise the v3 path`).toBe(3);
    expectSameGrid(r, `${layout} fresh`);
    // After real play state: a storey the window owns, edited terrain and an exhausted source.
    const ww = getWindowWorld(r.layoutId!);
    const storey = [...ww.floors.layers.keys()].find(l => l !== activeFloor(r));
    if (storey !== undefined) {
      r.veyraFloor = storey as never;
      expectSameGrid(r, `${layout} storey ${storey}`);
      r.veyraFloor = 0 as never;
    }
    const grid = blockGrid(r);
    let free = -1, blocking = -1;
    for (let i = 0; i < grid.length && (free < 0 || blocking < 0); i++) {
      if (free < 0 && grid[i] === 0) free = i;
      if (blocking < 0) { const s = sourceAt(r, i % WW, (i / WW) | 0); if (s && s.def.block && s.stock > 0 && s.key !== 'wreck') blocking = i; }
    }
    expect(free).toBeGreaterThanOrEqual(0);
    r.terrain[free] = { t: T.PWALL, until: r.clock.simMs + 600_000 } as never;
    if (blocking >= 0) r.sources[blocking] = { stock: 0, hp: 0, uid: 'grid-test-exhausted' } as never;
    expectSameGrid(r, `${layout} edited`);
    expect(gs.run).toBe(r);
    delete r.terrain[free];
    if (blocking >= 0) delete r.sources[blocking];
    expectSameGrid(r, `${layout} restored`);
  }
});

it('the door index equals the literal statics scan, is reused while nothing is invalidated, and is rebuilt on invalidation', () => {
  for (const layout of ['shipping_fresh', 'dev_delta_fresh', 'veyra05-greywater']) {
    setActiveLayout(layout);
    const w = getWorld();
    const scan = () => { const out = new Set<number>(); for (const s of w.statics) if (s.kind === 'door') out.add(s.ty * WW + s.tx); return [...out].sort((a, b) => a - b); };
    const indexed = doorTiles(w);
    expect([...indexed].sort((a, b) => a - b)).toEqual(scan());
    expect(doorTiles(w)).toBe(indexed);
    // A replaced statics array is new content: the index must be rebuilt, not reused.
    const previous = w.statics;
    w.statics = previous.slice();
    expect(doorTiles(w)).not.toBe(indexed);
    expect([...doorTiles(w)].sort((a, b) => a - b)).toEqual(scan());
    // An appended static is new content too, even on the same array identity.
    if (!Object.isFrozen(w.statics)) {
      const appended = w.statics as StaticEnt[];
      appended.push({ kind: 'door', tx: 3, ty: 4, poi: 'grid-test' } as StaticEnt);
      expect(doorTiles(w).has(4 * WW + 3)).toBe(true);
      appended.pop();
      expect(doorTiles(w).has(4 * WW + 3)).toBe(false);
    }
    w.statics = previous;
    // Any spatial invalidation drops the derived index, so in-place content edits cannot be served stale.
    markDirty();
    expect(doorTiles(w)).not.toBe(indexed);
    expect([...doorTiles(w)].sort((a, b) => a - b)).toEqual(scan());
  }
});

it('world content rewritten in place is honoured by markDirty() alone', () => {
  const { r } = run('veyra05-greywater');
  const w = getWorld();
  const grid = blockGrid(r);
  let i = -1;
  for (let k = 0; k < grid.length; k++) if (grid[k] === 0 && w.tiles[k] === T.FLOOR) { i = k; break; }
  expect(i).toBeGreaterThanOrEqual(0);
  // Single-cell in-place tile write, then a bulk typed-array restore: the exact pattern the
  // sanctuary wall checks use. No helper may be required to make the grid notice.
  const tilesCopy = w.tiles.slice();
  w.tiles[i] = T.PWALL; markDirty();
  expect(blockGrid(r)[i]).toBe(1);
  expect(blockedAt(r, i % WW, (i / WW) | 0)).toBe(true);
  w.tiles.set(tilesCopy); markDirty();
  expect(blockGrid(r)[i]).toBe(0);
  expect(blockedAt(r, i % WW, (i / WW) | 0)).toBe(false);
  // In-place solid-prop write on the active storey.
  const ww = getWindowWorld(r.layoutId!);
  const layer = ww.floors.layers.get(activeFloor(r)) ?? ww.floors.ground;
  expect(blockGrid(r)[i]).toBe(0);
  layer.solidProps[i] = 1; markDirty();
  expect(blockGrid(r)[i]).toBe(2);
  layer.solidProps[i] = 0; markDirty();
  expect(blockGrid(r)[i]).toBe(0);
  expectSameGrid(r, 'greywater after in-place rewrites');
});

it('run terrain and source edits are still reclassified on top of the static classes', () => {
  const { r } = run('shipping_fresh');
  markDirty();
  const grid = blockGrid(r);
  // A blocking source at full stock walls the cell off; exhausted it does not (wrecks stay).
  let blocking = -1, wreck = -1;
  for (let i = 0; i < grid.length; i++) {
    const s = sourceAt(r, i % WW, (i / WW) | 0);
    if (!s || !s.def.block) continue;
    if (s.key === 'wreck') { if (wreck < 0) wreck = i; continue; }
    if (s.stock > 0 && blocking < 0) blocking = i;
    if (blocking >= 0 && wreck >= 0) break;
  }
  expect(blocking).toBeGreaterThanOrEqual(0);
  expect(grid[blocking]).toBe(2);
  r.sources[blocking] = { stock: 0, hp: 0, uid: 'grid-test-exhausted' } as never;
  markDirty();
  expect(blockGrid(r)[blocking]).not.toBe(2);
  delete r.sources[blocking];
  markDirty();
  expect(blockGrid(r)[blocking]).toBe(2);
  if (wreck >= 0) {
    expect(blockGrid(r)[wreck]).toBe(2);
    r.sources[wreck] = { stock: 0, hp: 0, uid: 'grid-test-wreck' } as never;
    markDirty();
    expect(blockGrid(r)[wreck]).toBe(2);
    delete r.sources[wreck];
  }
  // Terrain overrides: a live wall blocks, an expired one does not. effTile honours the legacy
  // `until` timer against the run's own sim clock (`untilAt` is terrainAtAbs's authority).
  let free = -1;
  for (let i = 0; i < grid.length; i++) if (grid[i] === 0) { free = i; break; }
  expect(free).toBeGreaterThanOrEqual(0);
  const liveUntil = r.clock.simMs + 60_000;
  r.terrain[free] = { t: T.PWALL, until: liveUntil } as never;
  markDirty();
  expect(blockGrid(r)[free]).toBe(1);
  // A fresh run's sim clock is still at 0, so the timer has to be out-run by the clock itself.
  r.clock.simMs = liveUntil + 1;
  markDirty();
  expect(blockGrid(r)[free]).not.toBe(1);
  r.clock.simMs = 0;
  delete r.terrain[free];
  markDirty();
  expect(blockGrid(r)[free]).toBe(0);
});

it("one run's edits never leak into another run through the cached grid", () => {
  const first = run('shipping_fresh');
  markDirty();
  const grid = blockGrid(first.r);
  let i = -1;
  for (let k = 0; k < grid.length; k++) if (grid[k] === 0) { i = k; break; }
  expect(i).toBeGreaterThanOrEqual(0);
  first.r.terrain[i] = { t: T.PWALL } as never;
  first.r.player.x = (i % WW) * TILE + 8; first.r.player.y = ((i / WW) | 0) * TILE + 8;
  markDirty();
  expect(blockGrid(first.r)[i]).toBe(1);
  const second = run('shipping_fresh');
  markDirty();
  expect(blockGrid(second.r)[i]).toBe(0);
  expect(second.r.terrain[i]).toBeUndefined();
  // And the first run still sees its own edit after the second run rebuilt the grid.
  markDirty();
  expect(blockGrid(first.r)[i]).toBe(1);
  delete first.r.terrain[i];
});
