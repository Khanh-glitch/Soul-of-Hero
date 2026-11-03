import { describe, expect, it } from 'vitest';
import { TILE, WW, T, uid, type GameState, type Trace } from '../src/game/core';
import { blockedAt, dispatch, markDirty, mkCreature, newGame } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { decayTraces, HAZ, nextContiguousTrace, PROJ, tick, type Input } from '../src/game/sim';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import legacy from './fixtures/3b37ae9-legacy-pair.json';

const T0 = Date.UTC(2026, 10, 1, 12);
let n = 0;
const idle = (): Input => ({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });
function fresh() {
  const gs = newGame(); markDirty(); expect(dispatch(gs, { id: `start-b2-${++n}`, type: 'startRun', character: 'female', region: 0, seed: 456 + n }, T0).ok).toBe(true);
  gs.run!.creatures = []; PROJ.length = 0; HAZ.length = 0; return gs;
}
function clearing(gs: GameState) {
  const r = gs.run!, w = getWorld();
  for (let y = 20; y < 180; y++) for (let x = 20; x < 180; x++) {
    let good = true;
    for (let dy = -3; dy <= 3 && good; dy++) for (let dx = -3; dx <= 8; dx++) if (blockedAt(r, x + dx, y + dy) || ![T.GRASS, T.MEADOW].includes(w.tiles[(y + dy) * WW + x + dx])) { good = false; break; }
    if (good) return { x, y };
  }
  throw new Error('no test clearing');
}
function wall(gs: GameState, tx: number, ty: number) {
  const r = gs.run!, id = uid(r, 'e'); r.entities[id] = { id, kind: 'struct', type: 'wall_wood', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, hp: 160, maxHp: 160 }; markDirty();
}
function creature(gs: GameState, type: string, x: number, y: number) { const m = mkCreature(gs.run!, type, x, y, 50); m.t = 480; m.cd = 0; gs.run!.creatures.push(m); return m; }
function step(gs: GameState, input: Input, i: number) { tick(gs, input, 50, T0 + i * 50); }
function mark(id: string, chainId: string, prevId: string | undefined, x: number, y: number, t: number): Trace { return { id, chainId, prevId, x, y, t, life: 100000, a: 0, s: T.GRASS }; }

describe('B2-A existing movement and causal trace authority', () => {
  it('emits only after collision-resolved movement, including rolls, not repeated wall-running', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs); wall(gs, spot.x + 1, spot.y);
    r.player.x = (spot.x + 1) * TILE - 4; r.player.y = spot.y * TILE + 8;
    const original = { x: r.player.x, y: r.player.y }; const run = { ...idle(), right: true };
    for (let i = 1; i <= 50; i++) step(gs, run, i);
    expect(r.player.x).toBe(original.x); expect(r.player.y).toBe(original.y); expect(r.traces).toHaveLength(0);
    for (let i = 51; i <= 70; i++) step(gs, { ...idle(), left: true }, i);
    expect(r.player.x).toBeLessThan(original.x); expect(r.traces.length).toBeGreaterThan(1);
    expect(r.traces[1].prevId).toBe(r.traces[0].id); expect(r.traces[1].chainId).toBe(r.traces[0].chainId);
    const count = r.traces.length, rollStart = r.player.x;
    for (let i = 71; i <= 85; i++) step(gs, { ...idle(), left: true, mx: r.player.x - 100, my: r.player.y, roll: i === 71 }, i);
    expect(r.traces.length).toBeGreaterThan(count);
    expect(r.traces.length - count).toBeLessThanOrEqual(Math.floor((rollStart - r.player.x) / 10) + 1);
  });
  it('breaks links on an unmarkable water crossing, external teleport, and expired predecessor', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs); r.player.x = spot.x * TILE + 8; r.player.y = spot.y * TILE + 8;
    r.terrain[spot.y * WW + spot.x + 2] = { t: T.SHALLOW }; markDirty();
    for (let i = 1; i <= 32; i++) step(gs, { ...idle(), right: true }, i);
    const first = r.traces[0]; expect(first?.id).toBeTruthy();
    const later = r.traces.find(tr => tr.x >= (spot.x + 3) * TILE)!; expect(later).toBeTruthy(); expect(later.chainId).not.toBe(first.chainId);
    const beforeTeleport = r.traces.at(-1)!; r.player.x += 20;
    for (let i = 33; i <= 39; i++) step(gs, { ...idle(), right: true }, i);
    expect(r.traces.at(-1)!.chainId).not.toBe(beforeTeleport.chainId);
    const prior = r.traces.at(-1)!; prior.life = 0;
    for (let i = 40; i <= 46; i++) step(gs, { ...idle(), right: true }, i);
    expect(r.traces.at(-1)!.chainId).not.toBe(prior.chainId);
  });
  it('breaks after a tick gap and a cart rope snap rather than joining displaced points', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x; r.player.y = y;
    for (let i = 1; i <= 12; i++) step(gs, { ...idle(), right: true }, i);
    const old = r.traces[r.traces.length - 1];
    for (let i = 100; i <= 108; i++) step(gs, { ...idle(), right: true }, i);
    expect(r.traces[r.traces.length - 1].chainId).not.toBe(old.chainId);
    wall(gs, spot.x + 2, spot.y);
    const cartId = uid(r, 'cart'); r.custody.cartTest = { id: 'cartTest', kind: 'cart', slots: Array(8).fill(null) };
    r.entities[cartId] = { id: cartId, kind: 'cart', x, y, c: 'cartTest' }; r.player.pulling = cartId;
    r.player.x = x + 48; r.player.y = y;
    const previous = r.traces[r.traces.length - 1]; r.traceWalk = { x: r.player.x, y, at: T0 + 108 * 50, distance: 9, lastId: previous.id, chainId: previous.chainId };
    const count = r.traces.length; step(gs, idle(), 109);
    expect(r.player.x).toBeCloseTo(x + 26); expect(r.traces).toHaveLength(count); expect(r.traceWalk?.lastId).toBeUndefined();
  });
  it('follows only a live sensed predecessor and connected successor, even at crossings', () => {
    const a = mark('a', 'A', undefined, 100, 100, T0), next = mark('b', 'A', 'a', 110, 100, T0 + 20), crossing = mark('c', 'B', undefined, 101, 100, T0 + 10);
    expect(nextContiguousTrace([a, crossing, next], { traceId: 'a', chainId: 'A' })).toBe(next);
    expect(nextContiguousTrace([crossing, next], { traceId: 'a', chainId: 'A' })).toBeUndefined();
    a.life = 0; expect(nextContiguousTrace([a, next], { traceId: 'a', chainId: 'A' })).toBeUndefined();
    expect(nextContiguousTrace([crossing, next], { traceId: 'c', chainId: 'B' })).toBeUndefined();
  });
  it('a creature senses a real nearby mark and continues its own chain, not a newer crossing', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 140; r.player.y = y; const m = creature(gs, 'wolf', x, y);
    const a = mark('a', 'A', undefined, x + 3, y, T0), b = mark('b', 'A', 'a', x + 30, y, T0 + 10);
    r.traces = [a, b]; step(gs, idle(), 1); expect(m.knows?.traceId).toBe('b');
    r.traces.push(mark('cross', 'B', undefined, m.x + 2, m.y, T0 + 30));
    step(gs, idle(), 2); expect(m.knows?.traceId).toBe('b');
    r.traces = r.traces.filter(t => t.id !== 'b'); step(gs, idle(), 3); expect(m.knows?.traceId).not.toBe('b');
  });
  it('replaces a stale cached path when tracking a different evidence target', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 140; r.player.y = y;
    const m = creature(gs, 'wolf', x, y), tr = mark('track', 'A', undefined, x + 40, y, T0);
    r.traces = [tr]; m.knows = { kind: 'trace', traceId: tr.id, chainId: tr.chainId, x: tr.x, y: tr.y, at: tr.t }; m.state = 'track';
    m.path = [spot.y * WW + spot.x, (spot.y - 1) * WW + spot.x]; m.pathT = 900;
    step(gs, idle(), 1); expect(m.path?.[m.path.length - 1]).toBe(spot.y * WW + spot.x + 3);
  });
  it('does not sense a footprint through a wall or a legacy mark without identity', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 140; r.player.y = y;
    const m = creature(gs, 'wolf', x + 1, y); r.traces = [mark('hidden', 'hidden', undefined, x + 19, y, T0)];
    step(gs, idle(), 1); expect(m.knows).toBeNull();
    r.traces = [{ x: m.x, y: m.y, t: T0, life: 100000, a: 0, s: T.GRASS }]; m.t = 480;
    step(gs, idle(), 2); expect(m.knows).toBeNull();
    decayTraces(r, 200000, 'clear'); expect(r.traces).toHaveLength(0);
  });
  it('survives serialization with ids and resumes without fabricating links for old saves', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs); r.player.x = spot.x * TILE + 8; r.player.y = spot.y * TILE + 8;
    for (let i = 1; i <= 20; i++) step(gs, { ...idle(), right: true }, i);
    const [a, b] = r.traces; expect(b.prevId).toBe(a.id); expect(validate(gs)).toBeTruthy();
    const loaded = selectSnapshots([serializeSnapshot(gs), null]).gs!;
    expect(nextContiguousTrace(loaded.run!.traces, { traceId: a.id, chainId: a.chainId })?.id).toBe(b.id);
    const last = loaded.run!.traces[loaded.run!.traces.length - 1]; for (let i = 21; i <= 30; i++) step(loaded, { ...idle(), right: true }, i);
    expect(nextContiguousTrace(loaded.run!.traces, { traceId: last.id, chainId: last.chainId })?.prevId).toBe(last.id);
    expect(validate(legacy.earlier)).toBeTruthy();
    const old = structuredClone(legacy.earlier) as unknown as GameState; old.run!.traces.push({ x: 1, y: 1, t: T0, life: 10000, a: 0, s: T.GRASS });
    expect(selectSnapshots([JSON.stringify(old), null]).gs!.run!.traces[0].id).toBeUndefined();
  });
});

describe('B2-A last-known sight and committed attacks', () => {
  it('pursues the recorded location rather than the player behind cover and cannot start a new tell', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 40; r.player.y = y;
    const m = creature(gs, 'toad', x, y); m.state = 'chase'; m.knows = { kind: 'sight', x: x - 40, y, at: T0 }; m.cd = 0;
    step(gs, idle(), 1); expect(m.x).toBeLessThan(x); expect(m.state).not.toBe('tell'); expect(m.knows).toMatchObject({ kind: 'sight', x: x - 40, y });
  });
  it('a skittish creature does not flee an unseen player through a wall', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 25; r.player.y = y;
    const m = creature(gs, 'boar', x, y); m.t = 0; m.tx = x + 40; m.ty = y;
    step(gs, idle(), 1); expect(m.knows).toBeNull(); expect(m.x).toBeGreaterThanOrEqual(x);
  });
  it('still begins ordinary attacks after a genuine unobstructed sighting', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 40; r.player.y = y; const m = creature(gs, 'wolf', x, y); m.cd = 0;
    step(gs, idle(), 1); expect(m.knows).toMatchObject({ kind: 'sight', x: r.player.x, y: r.player.y }); expect(m.state).toBe('tell');
  });
  it('environmental spike damage does not grant unseen player coordinates', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 40; r.player.y = y;
    const id = uid(r, 'e'); r.entities[id] = { id, kind: 'struct', type: 'spikes', x, y, tx: spot.x, ty: spot.y, hp: 90, maxHp: 90 }; markDirty();
    const m = creature(gs, 'wolf', x, y); step(gs, idle(), 1); expect(m.hp).toBeLessThan(50); expect(m.knows).toBeNull();
  });
  it('keeps a beetle attack committed to the observed target after sight is lost', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 40; r.player.y = y;
    const m = creature(gs, 'beetle', x, y); m.state = 'tell'; m.t = 900; m.knows = { kind: 'sight', x: x - 20, y, at: T0 }; m.atk = { target: { x: x - 20, y } };
    step(gs, idle(), 1); expect(m.state).toBe('attack'); expect(HAZ.some(h => h.style === 'erupt' && h.x === x - 20 && h.y === y)).toBe(true);
  });
  it('does not wake an elder or issue a new elder telegraph through cover', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 40; r.player.y = y;
    const m = mkCreature(r, 'elder_frost', x, y, 320, { key: 'frost', awake: false, phase: 0, pattern: 0, special: 0 }); r.creatures.push(m);
    step(gs, idle(), 1); expect(m.state).toBe('sleep'); expect(m.knows).toBeNull();
    m.state = 'chase'; m.knows = { kind: 'sight', x: x - 30, y, at: T0 }; step(gs, idle(), 2);
    expect(m.state).not.toBe('tell'); expect(HAZ).toHaveLength(0); expect(PROJ).toHaveLength(0);
  });
});
