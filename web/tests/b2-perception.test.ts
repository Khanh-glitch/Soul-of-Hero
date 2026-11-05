import { describe, expect, it } from 'vitest';
import { TILE, WW, T, uid, type GameState, type Trace } from '../src/game/core';
import { blockedAt, dispatch, markDirty, mkCreature, newGame, addItem, mkContainer, countItem, C, sourceAt, weatherAt, isWet, clearPhysicalLine, wetOutlook } from '../src/game/engine';
import { getWorld } from '../src/game/world';
import { decayTraces, HAZ, nextContiguousTrace, PROJ, tick, settle, bindCombat, type Input } from '../src/game/sim';
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
    for (let i = 40; i <= 46; i++) step(gs, { ...idle(), left: true }, i);
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
    const a = mark('a', 'A', undefined, x + 3, y, T0), b = mark('b', 'A', 'a', x + 15, y, T0 + 10);
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

describe('trace-grounded home safety', () => {
  it('never follows a forged long jump or a successor through a closed barrier', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    const a = mark('a', 'A', undefined, x + 6, y, T0), distant = mark('d', 'A', 'a', x + 70, y, T0 + 1);
    expect(nextContiguousTrace([a, distant], { traceId: 'a', chainId: 'A' })).toBeUndefined();
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 150; r.player.y = y;
    const m = creature(gs, 'wolf', x + 6, y), b = mark('b', 'A', 'a', x + 22, y, T0 + 1);
    r.traces = [a, b]; step(gs, idle(), 1);
    expect(m.knows?.traceId).not.toBe('b'); expect(m.traceIgnore).toBe('A');
  });
  it('physically walks a sensed connected trail and loses it when the next evidence expires', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 150; r.player.y = y; const m = creature(gs, 'wolf', x, y);
    r.traces = [mark('a', 'A', undefined, x + 3, y, T0), mark('b', 'A', 'a', x + 15, y, T0 + 1), mark('c', 'A', 'b', x + 30, y, T0 + 2)];
    step(gs, idle(), 1); expect(m.knows?.traceId).toBe('b');
    for (let i = 2; i <= 5; i++) step(gs, idle(), i);
    expect(m.x).toBeGreaterThan(x); expect(m.x).toBeLessThan(x + 30); expect(m.knows?.traceId).toBe('c');
    r.traces = r.traces.filter(tr => tr.id !== 'c'); step(gs, idle(), 6);
    expect(m.knows).toBeNull(); expect(m.traceIgnore).toBe('A');
  });
  it('blocks even a corner-grazing physical interaction', () => {
    const gs = fresh(), spot = clearing(gs), r = gs.run!, x = spot.x * TILE, y = spot.y * TILE;
    wall(gs, spot.x + 1, spot.y);
    expect(clearPhysicalLine(r, { x: x + 8, y: y + 8 }, { x: x + 24, y: y + 24 }, true, true)).toBe(false);
    expect(clearPhysicalLine(r, { x: x + 8, y: y + 8 }, { x: x + 8, y: y + 24 }, true, true)).toBe(true);
  });
  it('does not damage an undiscovered house when a wolf or boar wanders into it', () => {
    for (const type of ['wolf', 'boar']) {
      const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
      wall(gs, spot.x + 1, spot.y); const house = Object.values(r.entities).find(e => e.type === 'wall_wood')!;
      r.player.x = x + 160; r.player.y = y; const m = creature(gs, type, x + 3, y);
      m.state = 'wander'; m.tx = x + 16; m.ty = y; m.t = 0;
      for (let i = 1; i <= 30; i++) step(gs, idle(), i);
      expect(house.hp).toBeCloseTo(160,0); expect(r.receipts.some(q=>q.kind==='struct.hit')).toBe(false); expect(m.knows).toBeNull();
    }
  });
  it('lets a committed boar charge physically impact a closed door, without reaching through it', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    const id = uid(r, 'door'); r.entities[id] = { id, kind: 'struct', type: 'door_wood', x: x + 16, y, tx: spot.x + 1, ty: spot.y, hp: 140, maxHp: 140, open: false }; markDirty();
    r.player.x = x + 24; r.player.y = y; const m = creature(gs, 'boar', x + 3, y);
    m.state = 'attack'; m.angle = 0; m.t = 0; m.atk = { hit: false }; const hp = r.player.hp;
    step(gs, idle(), 1); expect(r.entities[id].hp).toBeLessThan(140); expect(r.player.hp).toBe(hp); expect(m.x).toBeLessThan(x + 8);
  });
  it('lets a charge-capable tracker hit a door that closed after it sensed a mark', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    const id = uid(r, 'door'); r.entities[id] = { id, kind: 'struct', type: 'door_wood', x: x + 16, y, tx: spot.x + 1, ty: spot.y, hp: 140, maxHp: 140, open: true }; markDirty();
    r.player.x = x + 150; r.player.y = y;
    const m = creature(gs, 'boar', x + 2, y); (m as any).prov = true; m.tx = x + 40; m.ty = y;
    const tr = mark('visible', 'A', undefined, x + 19, y, T0); r.traces = [tr];
    step(gs, idle(), 1); expect(m.knows?.traceId).toBe('visible'); expect(r.entities[id].hp).toBeCloseTo(140,0);
    r.entities[id].open = false; markDirty();
    for (let i = 2; i <= 6; i++) step(gs, idle(), i);
    expect(r.entities[id].hp).toBeLessThan(140); expect(m.x).toBeLessThan(x + 8); expect(m.knows?.traceId).toBe('visible');
  });
  it('committed tongue and pinch cannot hit through a wall', () => {
    for (const type of ['toad', 'crab']) {
      const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
      wall(gs, spot.x + 1, spot.y); r.player.x = x + 25; r.player.y = y;
      const m = creature(gs, type, x + 4, y); m.state = 'attack'; m.angle = 0; m.t = 80; m.atk = { hit: false };
      const hp = r.player.hp; step(gs, idle(), 1); expect(r.player.hp).toBe(hp);
    }
  });
  it('sweeps fast projectiles against the intervening wall', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    wall(gs, spot.x + 1, spot.y); r.player.x = x + 45; r.player.y = y;
    bindCombat(r); PROJ.push({ x: x + 3, y, vx: 900, vy: 0, life: 1, dmg: 20, from: 'enemy', kind: 'bolt', r: 3 });
    const hp = r.player.hp; step(gs, idle(), 1); expect(PROJ).toHaveLength(0); expect(r.player.hp).toBe(hp);
  });
  it('offline expires evidence and sight but does not move actors or resolve committed attacks', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 80; r.player.y = y; const m = creature(gs, 'wolf', x, y), tr = mark('a', 'A', undefined, x + 3, y, T0);
    tr.life = 1000; r.traces = [tr]; m.knows = { kind: 'trace', x: tr.x, y: tr.y, at: tr.t, traceId: tr.id, chainId: tr.chainId }; m.state = 'attack'; m.atk = { hit: false }; m.t = 40;
    const sight = creature(gs, 'toad', x - 30, y); sight.state = 'chase'; sight.knows = { kind: 'sight', x: r.player.x, y, at: T0 };
    const hp = r.player.hp, pos = { x: m.x, y: m.y }, lines = settle(gs, T0 + 10000);
    expect(r.traces).toHaveLength(0); expect(m.knows).toBeNull(); expect(m.state).toBe('attack'); expect(m.t).toBe(40); expect({ x: m.x, y: m.y }).toEqual(pos); expect(r.player.hp).toBe(hp);
    expect(sight.knows).toBeNull(); expect(sight.state).toBe('wander'); expect(lines.join(' ')).toContain('other encounters remain unresolved');
    expect(validate(selectSnapshots([serializeSnapshot(gs), null]).gs)).toBeTruthy();
  });
  it('bounds the weather outlook to the remaining run and its existing global schedule', () => {
    const gs = fresh(), r = gs.run!, full = wetOutlook(r, T0);
    expect(full.hours).toBe(24); expect(full.wetHours).toBeGreaterThanOrEqual(0); expect(full.wetHours).toBeLessThanOrEqual(24);
    const nearEnd = T0 + (336 - 2) * 3600000, last = wetOutlook(r, nearEnd);
    expect(last.hours).toBe(2); expect(last.wetHours).toBeLessThanOrEqual(2);
    expect(wetOutlook(r, T0 + 336 * 3600000)).toEqual({ hours: 0, wetHours: 0 });
  });
  it('persists committed projectiles and hazards without advancing or leaking them between runs', () => {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 100; r.player.y = y; bindCombat(r);
    PROJ.push({ x, y, vx: 30, vy: 0, life: 1, dmg: 10, from: 'enemy', kind: 'bolt', r: 3 });
    HAZ.push({ kind: 'circle', x, y, r: 10, t: 40, tell: 800, dur: 120, dmg: 8, style: 'erupt', owner: 'enemy' });
    const loaded = selectSnapshots([serializeSnapshot(gs), null]).gs!;
    const hp = loaded.run!.player.hp; settle(loaded, T0 + 10000, true);
    expect(loaded.run!.combat!.projectiles[0].x).toBe(x); expect(loaded.run!.combat!.hazards[0].t).toBe(40); expect(loaded.run!.player.hp).toBe(hp);
    const other = fresh(); bindCombat(other.run!); expect(PROJ).toHaveLength(0); expect(HAZ).toHaveLength(0);
    bindCombat(loaded.run!); expect(PROJ).toHaveLength(1); expect(HAZ).toHaveLength(1);
    tick(loaded, idle(), 50, T0 + 10050); expect(PROJ[0].x).toBeGreaterThan(x); expect(HAZ[0].t).toBe(90);
    const bad = structuredClone(loaded); bad.run!.combat!.projectiles[0].vx = NaN; expect(validate(bad)).toBeNull();
  });
  it('prevents torch and axe source hits through a wall but permits them when unobstructed', () => {
    for (const tool of ['torch', 'stone_axe']) {
      const gs = fresh(), r = gs.run!; let pos: { x: number; y: number } | undefined;
      outer: for (let y = 20; y < 180; y++) for (let x = 20; x < 180; x++) {
        const src = sourceAt(r, x, y); if (!src || src.def.mat !== 'wood' || !src.def.tall || blockedAt(r, x - 1, y) || blockedAt(r, x - 2, y)) continue;
        pos = { x, y }; break outer;
      }
      expect(pos).toBeDefined(); const { x, y } = pos!, initial = sourceAt(r, x, y, T0)!;
      for (let seed = 1; seed < 10000; seed++) { r.seed = seed; if (!isWet(weatherAt(r, T0))) break; }
      r.player.x = x * TILE - 20; r.player.y = y * TILE + 8; wall(gs, x - 1, y);
      addItem(r, 'inv', tool, 1); const slot = C(r, 'inv').slots.findIndex(s => s?.key === tool), dur = C(r, 'inv').slots[slot]!.dur;
      r.player.action = { kind: 'swing', t: 0, dur: 300, contact: 1, angle: 0, slot }; step(gs, idle(), 1);
      expect(r.sources[y * WW + x]?.fire || 0).toBe(0); expect(sourceAt(r, x, y, T0 + 50)!.hp).toBe(initial.hp); expect(C(r, 'inv').slots[slot]!.dur).toBe(dur);
      const wallId = Object.values(r.entities).find(e => e.type === 'wall_wood')!.id; delete r.entities[wallId]; markDirty();
      r.player.action = { kind: 'swing', t: 0, dur: 300, contact: 1, angle: 0, slot }; step(gs, idle(), 2);
      if (tool === 'torch') expect(r.sources[y * WW + x]?.fire).toBeGreaterThan(r.clock.simMs);
      else expect(sourceAt(r, x, y, T0 + 100)!.hp).toBeLessThan(initial.hp);
    }
  });
});

describe('bounded offline trace consequences', () => {
  function setupTrail() {
    const gs = fresh(), r = gs.run!, spot = clearing(gs), x = spot.x * TILE + 8, y = spot.y * TILE + 8;
    r.player.x = x + 600; r.player.y = y;
    const doorId = uid(r, 'e'); r.entities[doorId] = { id: doorId, kind: 'struct', type: 'door_wood', x: x + 64, y, tx: spot.x + 4, ty: spot.y, hp: 140, maxHp: 140, open: false, owner: 'player' }; markDirty();
    const m = creature(gs, 'boar', x - 8, y); (m as any).prov = true; m.t = 0;
    r.traces = [3, 15, 27, 39, 51].map((dx, i) => mark('a' + i, 'A', i ? 'a' + (i - 1) : undefined, x + dx, y, T0));
    return { gs, r, m, doorId, x, y, spot };
  }
  it('walks from an actual encountered chain to physical door impact only after enough time, even off-camera', () => {
    const { gs, r, m, doorId, x } = setupTrail();
    settle(gs, T0 + 1000, true); expect(m.x).toBeGreaterThan(x - 8); expect(r.entities[doorId].hp).toBeCloseTo(140,0);
    const report = settle(gs, T0 + 4000); expect(m.x).toBeGreaterThan(x + 40); expect(m.x).toBeLessThan(x + 56);
    expect(r.entities[doorId].hp).toBeLessThan(140); expect(report.join(' ')).toMatch(/Wood Door: 140 → \d+ HP/);
    expect(r.receipts.some(q => q.kind === 'struct.hit' && q.detail.startsWith(doorId))).toBe(true);
  });
  it('produces the same physical impact timeline across settlement partitions', () => {
    const a = setupTrail(), b = structuredClone(a.gs), bid = a.doorId, mid = a.m.id;
    settle(a.gs, T0 + 4000, true); for (let t = 500; t <= 4000; t += 500) settle(b, T0 + t, true);
    expect(b.run!.entities[bid].hp).toBe(a.r.entities[bid].hp);
    expect(b.run!.creatures.find(m => m.id === mid)!.x).toBeCloseTo(a.m.x, 6);
    expect(b.run!.receipts.filter(q => q.kind === 'struct.hit').map(q => q.at)).toEqual(a.r.receipts.filter(q => q.kind === 'struct.hit').map(q => q.at));
  });
  it('continues an evidenced remote tracker online without a player-proximity raid', () => {
    const { gs, r, m, doorId, x } = setupTrail();
    for (let i = 1; i <= 80; i++) step(gs, idle(), i);
    expect(m.x).toBeGreaterThan(x + 40); expect(r.entities[doorId].hp).toBeLessThan(140);
  });
  it('a broken chain and an unrelated house do not create an impact', () => {
    for (const variant of ['broken', 'unrelated']) {
      const { gs, r, m, doorId } = setupTrail(); if (variant === 'broken') r.traces = r.traces.filter(t => t.id !== 'a1'); else r.traces = [];
      settle(gs, T0 + 4000); expect(r.entities[doorId].hp).toBeCloseTo(140,0); expect(m.knows).toBeNull(); expect(r.receipts.some(q => q.kind === 'struct.hit')).toBe(false);
    }
  });
  it('does not automatically spend an old linked chest after an evidenced hit', () => {
    const { gs, r, doorId, spot, x, y } = setupTrail();
    const ci=uid(r,'e'), hi=uid(r,'e'), chest=mkContainer(r,'chest',12);
    r.entities[ci]={id:ci,kind:'struct',type:'claim',tx:spot.x+4,ty:spot.y+2,x:x+64,y:y+32,hp:200,maxHp:200,maintenance:{enabled:true,chestId:hi}};
    r.entities[hi]={id:hi,kind:'struct',type:'chest_small',tx:spot.x+5,ty:spot.y+2,x:x+80,y:y+32,hp:100,maxHp:100,c:chest.id,claim:ci};
    r.entities[doorId].claim=ci; addItem(r,chest.id,'wood',10); addItem(r,chest.id,'rope',3); markDirty();
    const report=settle(gs,T0+4000); expect(r.receipts.some(q=>q.kind==='struct.hit')).toBe(true); expect(r.receipts.some(q=>q.kind==='struct.maintenance')).toBe(false);
    expect(countItem(r,chest.id,'wood')).toBe(10); expect(report.join(' ')).not.toContain('Claim reserve spent:');
  });
  it('a real impact can destroy a door and is reported as such', () => {
    const { gs, r, doorId } = setupTrail(); r.entities[doorId].hp = 26;
    const lines = settle(gs, T0 + 4000); expect(r.entities[doorId]).toBeUndefined();
    expect(lines.join(' ')).toContain('Wood Door was destroyed while away');
    expect(r.receipts.some(q => q.kind === 'struct.destroyed')).toBe(true);
  });
  it('retains physical impact in the report even when the run expires', () => {
    const { gs, r } = setupTrail(); r.startedAt = T0 + 4000 - 336 * 3600000;
    const report = settle(gs, T0 + 4000); expect(report.join(' ')).toMatch(/Wood Door: 140 → \d+ HP while away/);
    expect(report.join(' ')).toContain('336-hour end'); expect(gs.run).toBeNull();
  });
  it('wet weather at its boundary can erase the route before a creature arrives', () => {
    const wet = setupTrail(), dry = structuredClone(wet.gs), boundary = 500, slot = 9 * 60000;
    wet.r.startedAt = T0 - slot + boundary; dry.run!.startedAt = wet.r.startedAt;
    let wetSeed = 0, drySeed = 0;
    for (let seed = 1; seed < 10000; seed++) {
      wet.r.seed = seed; if (!isWet(weatherAt(wet.r, T0)) && weatherAt(wet.r, T0 + boundary) === 'storm') { wetSeed = seed; break; }
    }
    for (let seed = 1; seed < 10000; seed++) {
      dry.run!.seed = seed; if (!isWet(weatherAt(dry.run!, T0)) && !isWet(weatherAt(dry.run!, T0 + boundary))) { drySeed = seed; break; }
    }
    expect(wetSeed && drySeed).toBeTruthy(); wet.r.seed = wetSeed; dry.run!.seed = drySeed;
    for (const tr of wet.r.traces) tr.life = 2500; for (const tr of dry.run!.traces) tr.life = 2500;
    // Same footprint lifetimes; only the weather schedule differs.
    settle(wet.gs, T0 + 4000); settle(dry, T0 + 4000);
    expect(wet.r.entities[wet.doorId].hp).toBeCloseTo(140,0); expect(wet.r.receipts.some(q=>q.kind==='struct.hit')).toBe(false); expect(dry.run!.entities[wet.doorId].hp).toBeLessThan(140);
  });
  it('actual spikes can stop the tracker before it reaches the door', () => {
    const { gs, r, m, doorId, x, y, spot } = setupTrail(); m.hp = 10;
    const id = uid(r, 'trap'); r.entities[id] = { id, kind: 'struct', type: 'spikes', x: x + 32, y, tx: spot.x + 2, ty: spot.y, hp: 90, maxHp: 90, owner: 'player' }; markDirty();
    settle(gs, T0 + 4000); expect(m.state).toBe('dead'); expect(r.entities[doorId].hp).toBeCloseTo(140,0); expect(r.entities[id].hp).toBeCloseTo(86,0);
  });
  it('persists over-cap and previously sighted actors at their unresolved checkpoints', () => {
    const { gs, r, m, x, y } = setupTrail();
    for (let i = 1; i < 25; i++) { const q = creature(gs, 'boar', x - 8, y); (q as any).prov = true; }
    const sighted = creature(gs, 'wolf', x - 10, y); sighted.knows = { kind: 'sight', x, y, at: T0 }; sighted.state = 'chase';
    settle(gs, T0 + 50, true);
    expect(m.x).toBeGreaterThan(x - 8); expect(r.creatures[24].x).toBe(x - 8);
    expect(r.creatures[24].offlineUnresolvedAt).toBe(T0); expect(sighted.offlineUnresolvedAt).toBe(T0);
    const loaded = selectSnapshots([serializeSnapshot(gs), null]).gs!; expect(loaded).toBeTruthy();
    expect(loaded.run!.creatures[24].offlineUnresolvedAt).toBe(T0); expect(loaded.run!.creatures[25].offlineUnresolvedAt).toBe(T0);
    settle(loaded, T0 + 4000, true); expect(loaded.run!.creatures[24].x).toBe(x - 8); expect(loaded.run!.creatures[25].x).toBe(x - 10);
    const invalid = structuredClone(loaded); invalid.run!.creatures[24].offlineUnresolvedAt = NaN; expect(validate(invalid)).toBeNull();
  });
  it('expired evidence cannot produce a later impact and a pending combat encounter stays unresolved', () => {
    const a = setupTrail(); for (const tr of a.r.traces) tr.life = 250; settle(a.gs, T0 + 4000); expect(a.r.entities[a.doorId].hp).toBeCloseTo(140,0);
    const b = setupTrail(); b.r.combat = { projectiles: [{ x: b.x, y: b.y, vx: 0, vy: 0, life: 1, dmg: 5, from: 'enemy', kind: 'bolt', r: 3 }], hazards: [] };
    const startX = b.m.x; settle(b.gs, T0 + 4000); expect(b.m.x).toBe(startX); expect(b.r.entities[b.doorId].hp).toBeCloseTo(140,0); expect(b.r.combat.projectiles[0].life).toBe(1); expect(b.m.offlineUnresolvedAt).toBeDefined();
    b.r.combat = { projectiles: [], hazards: [] }; settle(b.gs, T0 + 8000); expect(b.m.x).toBe(startX); expect(b.r.entities[b.doorId].hp).toBeCloseTo(140,0);
  });
});
