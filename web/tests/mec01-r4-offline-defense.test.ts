// MEC-01 R4 P3 — offline causal defense: executable NEGATIVE contract for the lawful offline layer
// (see docs/survival/MEC01_R4_OFFLINE_DEFENSE.md for the bound state machine and the unresolved-policy registry).
// Every case carries a FIXTURE label: nothing here edits shipping_fresh world data or map assets.
// Claims remain limited to simulation semantics; this file does NOT prove parity, experience, or Map readiness.
// FIXTURE: traces, creatures, traps-armor and structures are injected fixtures; claim/escrow building is not exercised here.
import { describe, it, expect } from 'vitest';
import { TILE, T, uid, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, mkCreature, mkContainer, C } from '../src/game/engine';
import { settle, decayTraces } from '../src/game/sim';
import { getWorld } from '../src/game/world';

const T0 = Date.UTC(2026, 10, 8, 12);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) => dispatch(g, { id: `offdef-${++serial}`, type, ...p }, now);

function placeAtBuildablePatch(gs: GameState, rad = 4) {
  const r = gs.run!;
  r.creatures = [];
  const w = getWorld();
  let px = 0, py = 0;
  for (let yy = 5; yy < 190 && !px; yy++) for (let xx = 5; xx < 190; xx++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) {
      const i = (yy + dy) * 200 + xx + dx;
      if (w.economyMap.protected[i] || w.accessCorridors?.mask[i] || ((w.packageContract || w.enforceMasks) && !w.economyMap.buildable[i])) ok = false;
    }
    // Movement is blocked by unwalkable economy tiles even on overridden grass — the fixture corridor must be walkable.
    if (ok) for (let dy = -rad; dy <= rad && ok; dy++) for (let dx = -rad; dx <= rad && ok; dx++) {
      const i = (yy + dy) * 200 + (xx + dx);
      if ((w.packageContract || w.enforceMasks) && !w.economyMap.walkable[i]) ok = false;
    }
    if (ok) { px = xx; py = yy; break; }
  }
  if (!px) throw new Error('no uncontrolled patch found');
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const i = (py + dy) * 200 + (px + dx);
    r.terrain[i] = { t: T.GRASS } as any;
    if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
  }
  r.natureTrees = (r.natureTrees || []).filter(t => t.tx < px - rad || t.tx > px + rad || t.ty < py - rad || t.ty > py + rad);
  r.player.x = (px - 1) * TILE + 8; r.player.y = (py + 1) * TILE + 8;
  markDirty();
  return { px, py };
}
function freshRun(seed = 5511) {
  const gs = newGame();
  expect(act(gs, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  placeAtBuildablePatch(gs);
  return gs;
}
const mkTrace = (id: string, x: number, y: number, t: number, life = 100000, chainId = id, a = 0) => ({ id, chainId, x, y, t, life, a, s: T.GRASS });
const wallAt = (gs: GameState, tx: number, ty: number, hp = 100) => {
  const r = gs.run!;
  const e = { id: uid(r, 'e'), kind: 'struct', type: 'wall_wood', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp, maxHp: hp, owner: 'player' } as any;
  r.entities[e.id] = e; markDirty(); return e;
};
const settleFar = (gs: GameState, ms = 3 * 3600000) => settle(gs, T0 + ms, true);
const hits = (r: any) => r.receipts.filter((q: any) => q.kind === 'struct.hit');
const structDestroyed = (r: any) => r.receipts.filter((q: any) => q.kind === 'struct.destroyed');
const NONE = () => expect(true).toBe(true);

describe('MEC-01 R4 P3 — offline causal defense: no fabricated outcomes', () => {
  it('an idle boar and wolf with zero traces anywhere in the world do nothing to anything', () => {
    const gs = freshRun(501); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    const boar = mkCreature(r, 'boar', (px + 2) * TILE + 8, (py + 1) * TILE + 8, 40); boar.state = 'idle';
    const wolf = mkCreature(r, 'wolf', (px + 3) * TILE + 8, (py + 2) * TILE + 8, 30); wolf.state = 'wander';
    r.creatures.push(boar, wolf);
    const ids = [boar.id, wolf.id];
    for (const id of ids) expect(r.creatures.find(m => m.id === id)).toBeTruthy();
    settleFar(gs);
    expect(hits(r)).toHaveLength(0); expect(structDestroyed(r)).toHaveLength(0);
    for (const id of ids) { const m = r.creatures.find(c => c.id === id)!; expect(m.offlineUnresolvedAt).toBeUndefined(); }
    expect(r.creatures[0].x).toBe(boar.x); expect(r.creatures[0].y).toBe(boar.y);
    expect(r.creatures[1].x).toBe(wolf.x); expect(r.creatures[1].y).toBe(wolf.y);
  });

  it('pre-decayed and future-stamped traces never re-arm a search', () => {
    const gs = freshRun(502); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    const boar = mkCreature(r, 'boar', (px + 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'idle'; (boar as any).prov = true;
    r.creatures.push(boar);
    r.traces.push(mkTrace("dead-1", boar.x + 18, boar.y, T0 - 1000, 0));           // life = 0 — expired
    r.traces.push(mkTrace("future-1", boar.x + 18, boar.y, T0 + 60000, 100000));  // not yet stamped — cannot be known yet
    settleFar(gs, 1800000);
    expect(hits(r)).toHaveLength(0); expect(structDestroyed(r)).toHaveLength(0);
    const m = r.creatures.find(c => c.id === boar.id)!; expect(m.knows ?? null).toBeNull(); expect(m.x).toBe(boar.x);
  });

  it('rain sweeping the trail before logout never leaves a re-usable target behind', () => {
    const gs = freshRun(503); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    const boar = mkCreature(r, 'boar', (px + 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'idle'; (boar as any).prov = true;
    r.creatures.push(boar);
    for (let k = 0; k <= 20; k++) r.traces.push({ ...mkTrace(`trail${k}`, boar.x + k * 9, boar.y, T0 + 500, 100000), chainId: 'trail0', prevId: k ? `trail${k - 1}` : undefined });
    decayTraces(r, 10 * 60000, 'clear');                                            // a hard dry-out window
    expect(r.traces.every(t => t.life <= 0)).toBe(true);
    settleFar(gs, 1800000);
    expect(hits(r)).toHaveLength(0); expect(structDestroyed(r)).toHaveLength(0);
    const m = r.creatures.find(c => c.id === boar.id)!; expect(m.x).toBe(boar.x); expect(m.y).toBe(boar.y);
  });

  it('a wolf committed to a sight-range attack at the instant of exit becomes unresolved — no combat is reconstructed offline', () => {
    const gs = freshRun(504); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    const wolf = mkCreature(r, 'wolf', (px + 1) * TILE + 2, py * TILE + 8, 30);
    wolf.state = 'chase'; wolf.knows = { kind: 'sight', x: r.player.x, y: r.player.y, at: T0 } as any;
    r.creatures.push(wolf);
    const px0 = wolf.x;
    settleFar(gs, 3600000);
    expect(r.creatures.find(m => m.id === wolf.id)!.offlineUnresolvedAt).toBeTypeOf('number');
    expect(r.receipts.filter((q: any) => q.kind === 'struct.hit' || q.kind === 'core.spirit.arrive')).toHaveLength(0);
    expect(hits(r)).toHaveLength(0);
    expect(wolf.x).toBe(px0); expect(r.player.hp).toBeGreaterThan(0);
  });

  it('a stimulus-anchored investigator at the instant of exit becomes unresolved — the investigation never completes mid-absence', () => {
    const gs = freshRun(505); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    const wolf = mkCreature(r, 'wolf', (px + 1) * TILE + 2, py * TILE + 8, 30);
    wolf.state = 'track';
    r.creatures.push(wolf);
    wolf.knows = { kind: 'stimulus', x: px * TILE + 8, y: py * TILE + 8, at: T0, sourceId: 'airdrop:0:test', eventIndex: 0, expiresAt: T0 + 300000, goalX: px * TILE + 8, goalY: py * TILE + 8 } as any;
    settleFar(gs, 3600000);
    const m = r.creatures.find(c => c.id === wolf.id)!;
    expect(m.offlineUnresolvedAt).toBeTypeOf('number');
    // CURRENT LAW (labelled floor, Bible-neutral): a stimulus that expires during
    // chronological advancement is folded away by stepAirdrops even for an
    // offline-unresolved investigator — the expiry boundary is the shared
    // online/offline stepper's authority, and stimulus.lost is emitted with ':expired'.
    const lost = r.receipts.filter((q: any) => q.kind === 'stimulus.lost');
    expect(lost.length).toBeGreaterThanOrEqual(1);
    expect(lost.some((q: any) => String(q.detail).endsWith(':expired'))).toBe(true);
    expect(m.x).toBe(wolf.x);                                                     // unresolved: never reconstructed in motion
    expect(hits(r)).toHaveLength(0);
  });

  it('CONTROL: a provoked charge-style boar with a live chain ending at the blocking wall batters exactly that wall', () => {
    const gs = freshRun(506); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    placeAtBuildablePatch(gs, 11);                                             // fixture demands a long unbroken sight corridor west of the wall
    const wall = wallAt(gs, px + 7, py, 100);
    const ay = py * TILE + 8;
    const trace = { ...mkTrace('charge-tail', wall.x + 10, ay, T0 + 500, 10 ** 12, 'charge-tail', Math.PI) };   // terminal footprint pinned at the wall's east face — the creature ends its d<2 approach there and its westward pushes are blocked by the wall, triggering bashAhead
    r.traces.push(trace);
    const boar = mkCreature(r, 'boar', (px + 9) * TILE + 8, ay, 40); boar.state = 'track'; (boar as any).prov = true;
    boar.knows = { kind: 'trace', x: trace.x, y: trace.y, at: trace.t, traceId: trace.id, chainId: trace.chainId } as any;   // FIXTURE: pre-anchored (fixture registers the knowledge, so discovery rolls are not involved)
    r.creatures.push(boar);
    settleFar(gs, 3600000);
    const wallHits = hits(r).filter((q: any) => q.detail.startsWith(wall.id));
    expect(wallHits.length).toBeGreaterThanOrEqual(1);
    expect(wall.hp).toBeLessThan(100);
    for (const q of wallHits) expect(q.detail).toContain(':boar:');
  });

  it('the same geometry with a lunge-style predator never reaches a swing — the bash gate is style-denied', () => {
    const gs = freshRun(507); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    placeAtBuildablePatch(gs, 11);                                             // same fixture geometry as the charge CONTROL
    const wall = wallAt(gs, px + 7, py, 100);
    const ay = py * TILE + 8;
    const wallHPBefore = wall.hp!;
    const trace = { ...mkTrace('charge-tail', wall.x + 10, ay, T0 + 500, 10 ** 12, 'charge-tail', Math.PI) };
    r.traces.push(trace);
    const wolf = mkCreature(r, 'wolf', (px + 9) * TILE + 8, ay, 30); wolf.state = 'track';
    wolf.knows = { kind: 'trace', x: trace.x, y: trace.y, at: trace.t, traceId: trace.id, chainId: trace.chainId } as any;   // FIXTURE anchor
    r.creatures.push(wolf);
    settleFar(gs, 3600000);
    expect(hits(r)).toHaveLength(0);
    expect(wall.hp!).toBeGreaterThanOrEqual(wallHPBefore - 10);                    // only unpaid-upkeep decay is tolerated, never a bash
    expect(wall.hp!).toBeLessThanOrEqual(wallHPBefore);
  });

  it('three turret variants never fire offline — even a fully armed, powered, supplied standby turret', () => {
    for (const [mode, arrowsInBox, generatorFueled] of [['disarmed', 4, true], ['empty', 0, true], ['standby', 4, true]] as const) {
      const gs = freshRun(601 + mode.length); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
      const arrowBox = mkContainer(r, 'box', 4).id;
      const turret = { id: `turret-${mode}`, kind: 'struct', type: 'arrow_turret', tx: px, ty: py, x: px * TILE + 8, y: py * TILE + 8, hp: 120, maxHp: 120, c: arrowBox, turret: { enabled: mode !== 'disarmed', cooldown: 0, angle: 0, generatorId: `gen-${mode}` } } as any;
      r.entities[turret.id] = turret;
      const fuelBox = mkContainer(r, 'fuel', 4).id;
      const gen = { id: `gen-${mode}`, kind: 'struct', type: 'base_generator', tx: px + 1, ty: py, x: (px + 1) * TILE + 8, y: py * TILE + 8, hp: 150, maxHp: 150, c: fuelBox, basePower: { enabled: true, energy: generatorFueled ? 500 : 0 } } as any;
      r.entities[gen.id] = gen;
      if (generatorFueled) addItem(r, fuelBox, 'wood', 4);
      if (arrowsInBox > 0) addItem(r, arrowBox, 'arrow', arrowsInBox);
      markDirty();
      const arrowsBefore = C(r, arrowBox).slots.reduce((n: number, s: any) => n + (s?.key === 'arrow' ? s.qty : 0), 0);
      settleFar(gs, 3 * 3600000);
      expect(r.receipts.filter((q: any) => q.kind === 'turret.fire')).toHaveLength(0);
      expect(C(r, arrowBox).slots.reduce((n: number, s: any) => n + (s?.key === 'arrow' ? s.qty : 0), 0)).toBe(arrowsBefore);
    }
  });

  it('beyond 24 trace-anchored eligible creatures are deferred at settle start, not simulated', () => {
    const gs = freshRun(508); const r = gs.run!; const { px, py } = placeAtBuildablePatch(gs);
    placeAtBuildablePatch(gs, 11);                                             // keep the crowd beyond the 99px day sight of the old player position
    const home = { x: (px + 8) * TILE + 8, y: py * TILE + 8 };
    for (let i = 0; i < 30; i++) {
      const m = mkCreature(r, 'boar', home.x + (i % 6) * 5, home.y + Math.floor(i / 6) * 5, 40);
      m.state = 'wander';
      m.knows = { kind: 'trace', x: home.x + 40, y: home.y + 20, at: T0, traceId: 'focus', chainId: 'focus' } as any;   // FIXTURE: every boar carries an identical trace anchor
      r.creatures.push(m);
    }
    r.traces.push({ ...mkTrace('focus', home.x + 40, home.y + 20, T0 + 500, 10 ** 12, 'focus', 0.5) });
    settle(gs, T0 + 20000, true);
    const marked = r.creatures.filter(m => m.offlineUnresolvedAt !== undefined).length;
    expect(marked).toBe(6);                                                        // exactly the 30 − 24 deferred at E0c
    expect(hits(r)).toHaveLength(0);
  });
});
