// MEC-01 R5 — offline defense consequence: the full causal network, executable.
// (see docs/survival/MEC01_R5_OFFLINE_DEFENSE.md for the bound contract, law notes and the unresolved-policy registry)
//
// NATURAL vs FIXTURE labelling (map-authoritative contract):
//   NATURAL  — no creature knowledge is injected anywhere. The trail is emitted by REAL
//              collision-resolved player movement (tick + right:true), the door is opened/closed
//              by real interact intents, and discovery/tracking/bashing/prov/turret fire are all
//              the shipped online laws executed offline by settle().
//   FIXTURE  — placement-only fixtures (the boar is spawned standing on the trail; structures are
//              placed directly). NO trace, sight or stimulus knowledge is pre-seeded in any NATURAL case.
//   CONTROL  — negative controls: one lawful prerequisite removed at a time, everything else identical.
//
// Claims here are limited to simulation semantics on shipping_fresh world data (the shipping layout
// is used unmodified — agents do not edit Map/economy assets). This file proves the causal laws,
// not experience, balance, or Map readiness.
import { describe, it, expect, beforeAll } from 'vitest';
import { TILE, T, uid, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, mkCreature, mkContainer, C, countItem, structureRepairCost } from '../src/game/engine';
import { settle, decayTraces, tick, PROJ, HAZ, type Input } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 8, 12);
const HOUR = 3600000;
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) =>
  dispatch(g, { id: `offdef5-${++serial}`, type, ...p } as any, now);
const idle = (): Input => ({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });

beforeAll(() => setActiveLayout('shipping_fresh'));

/** Clear patch override — GRASS by default; SNOW when `snow` is set (Snow = 900 s footprint life, the only long-window surface lawfully available). */
function wintryPatch(gs: GameState, rad = 8, snow = true) {
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
    if (ok) for (let dy = -rad; dy <= rad && ok; dy++) for (let dx = -rad; dx <= rad && ok; dx++) {
      const i = (yy + dy) * 200 + (xx + dx);
      if ((w.packageContract || w.enforceMasks) && !w.economyMap.walkable[i]) ok = false;
    }
    if (ok) { px = xx; py = yy; break; }
  }
  if (!px) throw new Error('no uncontrolled patch found');
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const i = (py + dy) * 200 + (px + dx);
    r.terrain[i] = { t: snow ? T.SNOW : T.GRASS } as any;
    if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 };
  }
  r.natureTrees = (r.natureTrees || []).filter(t => t.tx < px - rad || t.tx > px + rad || t.ty < py - rad || t.ty > py + rad);
  r.player.x = (px - 1) * TILE + 8; r.player.y = py * TILE + 8;
  markDirty();
  return { px, py };
}

function freshRun(seed = 5511) {
  PROJ.length = 0; HAZ.length = 0;
  const gs = newGame();
  expect(act(gs, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  gs.run!.qaOffset = 12 * 60000;               // in-run clock t=0.8 (a day is 24 in-run minutes here) → darkness ≈ 0.76 — the shipped night-aggro law for boars. Calm phase, no Ragnarok side effects.
  const patch = wintryPatch(gs, 8, true);
  return { gs, ...patch };
}

const mkStruct = (r: any, type: string, tx: number, ty: number, hp: number, extra: object = {}) =>
  ({ id: uid(r, 'e'), kind: 'struct', type, tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp, maxHp: hp, owner: 'player', ...extra } as any);

/** 3×3 homestead: west wall column with an open door at (px+6, py), interior floor at (px+7, py), east wall at (px+8, py). */
function homestead(gs: GameState, px: number, py: number) {
  const r = gs.run!;
  const wall = (tx: number, ty: number) => { const e = mkStruct(r, 'wall_wood', tx, ty, 140); r.entities[e.id] = e; return e; };
  wall(px + 6, py - 1); wall(px + 6, py + 1);
  wall(px + 7, py - 1); wall(px + 8, py - 1);
  wall(px + 7, py + 1); wall(px + 8, py + 1);
  wall(px + 8, py);
  const door = mkStruct(r, 'door_wood', px + 6, py, 140);
  door.open = true; r.entities[door.id] = door;
  markDirty();
  return door;
}

/** An armed, supplied, wired turret at (tx,ty) backed by a powered generator one tile away. Returns the fixture ids. */
function poweredTurret(gs: GameState, tx: number, ty: number, opts: { arrows?: number; fuel?: number; energy?: number; blocked?: boolean; generatorAt?: [number, number] } = {}) {
  const r = gs.run!;
  const arrowBox = mkContainer(r, 'chest', 3).id;   // shipped: an arrow_turret is built with a 3-slot chest
  const turret = mkStruct(r, 'arrow_turret', tx, ty, 120, {
    c: arrowBox,
    turret: { enabled: true, cooldown: 0, angle: Math.PI / 2 },
  });
  r.entities[turret.id] = turret;
  const [gx, gy] = opts.generatorAt ?? [tx, ty - 1];
  const fuelBox = mkContainer(r, 'chest', 3).id;    // shipped: a base_generator is built with a 3-slot chest for fuel
  const gen = mkStruct(r, 'base_generator', gx, gy, 150, {
    c: fuelBox,
    basePower: { enabled: true, energy: opts.energy ?? 0, capacity: 2, priority: 'defense' },
  });
  r.entities[gen.id] = gen;
  turret.turret!.generatorId = gen.id;
  if ((opts.fuel ?? 40) > 0) addItem(r, fuelBox, 'wood', opts.fuel ?? 40);
  if ((opts.arrows ?? 8) > 0) addItem(r, arrowBox, 'arrow', opts.arrows ?? 8);
  if (opts.blocked) { const w = mkStruct(r, 'wall_wood', tx + 1, ty, 140); r.entities[w.id] = w; }
  markDirty();
  return { turret, gen, arrowBox, fuelBox };
}

/** Walk the player east into the homestead with real movement input; returns the tick-index end timestamp. */
function walkHome(gs: GameState, steps = 170) {
  const r = gs.run!;
  let t = T0;
  for (let i = 1; i <= steps; i++) { t = T0 + i * 50; tick(gs, { ...idle(), right: true }, 50, t); }
  return t;
}

const fireCount = (r: any) => r.receipts.filter((q: any) => q.kind === 'turret.fire').length;
const structHits = (r: any) => r.receipts.filter((q: any) => q.kind === 'struct.hit');
const doorHits = (r: any, doorId: string) => structHits(r).filter((q: any) => String(q.detail).startsWith(doorId));
const destroyedOnce = (r: any, detail: string) => r.receipts.filter((q: any) => q.kind === 'struct.destroyed' && String(q.detail).startsWith(detail)).length;

describe('MEC-01 R5 — offline consequence of a real player action (NATURAL world, shipping_fresh)', () => {
  it('[NATURAL] real footsteps emit a connected trail into the homestead — before any settlement', () => {
    const { gs, px, py } = freshRun(7071); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    // The player actually made it into the house and stopped at the east wall — collision-resolved.
    expect(r.player.x).toBeGreaterThan((px + 6) * TILE);
    expect(r.player.y).toBeCloseTo(py * TILE + 8, 5);
    // Traces were emitted by the movement system itself, forming one connected chain with SNOW life.
    expect(r.traces.length).toBeGreaterThanOrEqual(5);
    const chained = r.traces.filter(t => t.prevId);
    expect(chained.length).toBeGreaterThan(0);
    expect(r.traces.every(t => t.s === T.SNOW)).toBe(true);
    expect(r.traces.every(t => t.life > 100000)).toBe(true);
    // The door the player walked through is still open; only routine upkeep decay is present.
    expect(door.hp!).toBeGreaterThan(138);
    expect(walkEnd).toBeGreaterThan(T0);
  });

  it('[NATURAL] a trail discovered after logout leads the boar back home: it tracks the path and batters the door', () => {
    const { gs, px, py } = freshRun(7072); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    expect(r.entities[door.id]!.open).toBe(false);
    const spawnX = (px - 1) * TILE + 8;
    const boar = mkCreature(r, 'boar', spawnX, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    expect(boar.knows ?? null).toBeNull();          // zero knowledge injected — discovery must happen in settlement
    settle(gs, walkEnd + 6 * 60000, true);
    const d = r.entities[door.id];
    const doorDamaged = d === undefined || d.hp! < 140;   // the door was either destroyed or battered
    expect(doorDamaged).toBe(true);
    expect(destroyedOnce(r, 'door_wood by boar')).toBe(1);          // destroyed exactly once, never twice
    expect(r.entities[door.id]).toBeUndefined();                     // the entity is gone (destroyed by the bash, not despawned)
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(3);   // physical bashes, each debited once
    for (const q of doorHits(r, door.id)) expect(q.detail).toContain(':boar:');
    const m = r.creatures.find(c => c.id === boar.id)!;
    expect(m.x).toBeGreaterThan((px + 3) * TILE);                    // it advanced deep along the trail on its own
    expect(r.player.hp).toBeGreaterThan(0);                          // offline time never fabricates live melee
  });

  it('[NATURAL] powered, supplied, wired turret fires during settlement — real arrows, real order: bash (prov) precedes fire', () => {
    const { gs, px, py } = freshRun(7073); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    // The boar finds the trail and will batter the door; the turret north of the doorway covers the approach.
    const { turret, arrowBox, fuelBox } = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    const fires = fireCount(r);
    expect(fires).toBeGreaterThanOrEqual(3);        // 16 dmg × 3 ≥ 40 hp — the lawful lethal sequence
    expect(countItem(r, arrowBox, 'arrow')).toBe(8 - fires);          // EXACT arrow accounting: 1 per fire, nothing else moves arrows
    const m = r.creatures.find(c => c.id === boar.id)!;
    expect(m.state).toBe('dead');                                      // the turret killed it, offline
    expect(countItem(r, fuelBox, 'wood')).toBeLessThan(40); // the generator was fed physical fuel that the offline clock burned
    expect(destroyedOnce(r, 'door_wood by boar')).toBe(0);             // the home was defended: the door survives
    expect(r.entities[door.id]).toBeTruthy();
    expect(door.hp!).toBeLessThan(140);                                // but the bash before the kill left its mark
    // Causal ORDER: a bash embodies prov; the first lawful turret shot cannot precede prov.
    const firstHit = r.receipts.findIndex((q: any) => q.kind === 'struct.hit' && String(q.detail).startsWith(door.id));
    const firstFire = r.receipts.findIndex((q: any) => q.kind === 'turret.fire');
    expect(firstHit).toBeGreaterThanOrEqual(0);
    expect(firstFire).toBeGreaterThan(firstHit);
    expect(turret.id).toBeTruthy();
  });

  it('[CONTROL] armed and supplied but UNPOWERED — the turret never fires; the bash is left to the door', () => {
    const { gs, px, py } = freshRun(7074); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    const { arrowBox } = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 0, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(fireCount(r)).toBe(0);
    expect(countItem(r, arrowBox, 'arrow')).toBe(8);                    // no arrows were ever spent
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(3);      // the approach and bash still happened
    expect(destroyedOnce(r, 'door_wood by boar')).toBe(1);              // and the door fell — lawfully, once
    expect(r.player.hp).toBeGreaterThan(0);
  });

  it('[CONTROL] armed and powered but ARROWLESS — the turret never fires; arrows that do not exist cannot be spent', () => {
    const { gs, px, py } = freshRun(7075); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    const { arrowBox } = poweredTurret(gs, px + 5, py - 1, { arrows: 0, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(fireCount(r)).toBe(0);
    expect(countItem(r, arrowBox, 'arrow')).toBe(0);
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(1);
    expect(destroyedOnce(r, 'door_wood by boar')).toBe(1);
  });

  it('[CONTROL] armed, powered, supplied but SIGHT-BLOCKED — no shot through a wall (lawful LOS required)', () => {
    const { gs, px, py } = freshRun(7076); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    // Turret at (px+3, py-1): the ray to the doorway crosses the blocking wall placed at (px+4, py-1).
    const { arrowBox } = poweredTurret(gs, px + 3, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const blocker = mkStruct(r, 'wall_wood', px + 4, py - 1, 140); r.entities[blocker.id] = blocker; markDirty();
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(fireCount(r)).toBe(0);
    expect(countItem(r, arrowBox, 'arrow')).toBe(8);
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(1);      // pursuit and bash unaffected — only the shot is denied
  });

  it('[CONTROL] armed, powered, supplied but OUT OF RANGE — no shot beyond 96 px (the lawful engagement circle)', () => {
    const { gs, px, py } = freshRun(7077); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    // Turret far north-west; the door attack happens at ~120 px — outside the engagement circle.
    const { arrowBox } = poweredTurret(gs, px, py - 6, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(fireCount(r)).toBe(0);
    expect(countItem(r, arrowBox, 'arrow')).toBe(8);
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(1);
  });

  it('[CONTROL] no trail anywhere — nothing discovers, nothing bashed, nothing fired (true negative)', () => {
    const { gs, px, py } = freshRun(7078); const r = gs.run!;
    const door = homestead(gs, px, py);
    const before = door.hp!;
    poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    expect(r.traces).toHaveLength(0);
    settle(gs, T0 + 6 * 60000, true);
    expect(door.hp!).toBeGreaterThan(before - 10);   // upkeep decay only — never bash damage
    expect(structHits(r)).toHaveLength(0);
    expect(fireCount(r)).toBe(0);
    const m = r.creatures.find(c => c.id === boar.id)!;
    expect(m.x).toBe(boar.x); expect(m.y).toBe(boar.y);
  });

  it('[CONTROL] the trail is rained away before logout — a lost scent dead-ends (no pursuit, no bash)', () => {
    const { gs, px, py } = freshRun(7079); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(r.traces.length).toBeGreaterThan(0);
    decayTraces(r, 250000, 'rain');          // the same rain model the settle loop applies; 4 min of rain drains 1000 s of footprint life
    expect(r.traces.every(t => t.life <= 0)).toBe(true);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(structHits(r)).toHaveLength(0);
    expect(door.hp!).toBeGreaterThan(130);           // upkeep decay only — never bash damage
    expect(fireCount(r)).toBe(0);
    expect(r.entities[door.id]).toBeTruthy();
  });
});

describe('MEC-01 R5 — settlement integrity across time partitioning, reload and replay (NATURAL scenario)', () => {
  const build = (seed: number) => {
    const { gs, px, py } = freshRun(seed); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    const { arrowBox } = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    return { gs, r, door, walkEnd, arrowBox, boarId: boar.id };
  };
  const outcome = (fx: { gs: GameState; door: any; arrowBox: string; boarId: string }) => {
    const r = fx.gs.run!;
    const boar = r.creatures.find(c => c.id === fx.boarId)!;
    // Settle slices are split at weather/fire/depletion boundaries; hp accumulates by different
    // float orders in splits. Compare at 1e-6 — beyond any lawful relevance, before float noise.
    const q = (v: number | undefined) => (v === undefined ? -1 : Math.round(v * 1e6) / 1e6);
    return { doorHp: q(fx.door.hp), doorExists: !!r.entities[fx.door.id], fires: fireCount(r), arrows: countItem(r, fx.arrowBox, 'arrow'), boarState: boar.state, boarHp: q(boar.hp), destroyed: destroyedOnce(r, 'door_wood by boar') };
  };

  it('a single 6-minute settlement equals two 3-minute settlements (time-partition determinism)', () => {
    const a = build(7080); settle(a.gs, a.walkEnd + 6 * 60000, true);
    const b = build(7080); settle(b.gs, b.walkEnd + 3 * 60000, true); settle(b.gs, b.walkEnd + 6 * 60000, true);
    expect(outcome(b)).toEqual(outcome(a));
  });

  it('save → reload mid-absence → resume settles to the identical outcome (no double damage, no double ammo)', () => {
    const a = build(7081); settle(a.gs, a.walkEnd + 6 * 60000, true);
    const b = build(7081);
    settle(b.gs, b.walkEnd + 3 * 60000, true);
    const snap = serializeSnapshot(b.gs);
    const reloaded = selectSnapshots([snap, null]).gs!;
    expect(validate(reloaded)).toBeTruthy();
    reloaded.run!.clock.lastSimAt = b.walkEnd + 3 * 60000;      // the honest resume point, as the shipped loader restores it
    settle(reloaded, b.walkEnd + 6 * 60000, true);
    const outB = outcome({ gs: reloaded, door: reloaded.run!.entities[b.door.id] ?? b.door, arrowBox: b.arrowBox, boarId: b.boarId });
    expect(outB).toEqual(outcome(a));
    // And the reload happened with projectile paths either intact or honestly discarded — never duplicated:
    expect(fireCount(reloaded.run!)).toBe(outcome(a).fires);
  });

  it('settle() replayed with the same endpoint is a no-op — no duplicate damage, arrows or deaths', () => {
    const a = build(7082); settle(a.gs, a.walkEnd + 6 * 60000, true);
    const once = { fires: fireCount(a.r), hits: structHits(a.r).length, arrows: countItem(a.r, a.arrowBox, 'arrow'), destroyed: destroyedOnce(a.r, 'door_wood by boar') };
    settle(a.gs, a.walkEnd + 6 * 60000, true);                    // replay with the same end timestamp
    expect(fireCount(a.r)).toBe(once.fires);
    expect(structHits(a.r).length).toBe(once.hits);
    expect(countItem(a.r, a.arrowBox, 'arrow')).toBe(once.arrows);
    expect(destroyedOnce(a.r, 'door_wood by boar')).toBe(once.destroyed);
  });

  it('[NATURAL] the same lawful outcome offline and live-online: bashes happen, prov precedes fire, arrows are spent in both', () => {
    const off = build(7083); settle(off.gs, off.walkEnd + 30000, true);
    const on = build(7083);
    for (let i = 1; i <= 600; i++) tick(on.gs, idle(), 50, on.walkEnd + i * 50);   // live play, standing still, 30 in-game seconds
    // The online-only random-wander law steers the approach differently before discovery, so exact
    // hit counts diverge — both worlds must reach the same lawful outcome: a battered door, a spent
    // turret, arrows debited 1:1 with turret.fire receipts, and prov strictly before the first shot.
    expect(off.r.entities[off.door.id]?.hp!).toBeLessThan(140);
    expect(on.r.entities[on.door.id]?.hp!).toBeLessThan(140);
    expect(structHits(off.r).filter((q: any) => String(q.detail).startsWith(off.door.id)).length).toBeGreaterThanOrEqual(1);
    expect(structHits(on.r).filter((q: any) => String(q.detail).startsWith(on.door.id)).length).toBeGreaterThanOrEqual(1);
    expect(fireCount(off.r)).toBeGreaterThanOrEqual(1);
    expect(fireCount(on.r)).toBeGreaterThanOrEqual(1);
    expect(countItem(off.r, off.arrowBox, 'arrow')).toBe(8 - fireCount(off.r));
    expect(countItem(on.r, on.arrowBox, 'arrow')).toBe(8 - fireCount(on.r));
    const order = (r: any) => [
      r.receipts.findIndex((q: any) => q.kind === 'struct.hit' && String(q.detail).startsWith(off.door.id)),
      r.receipts.findIndex((q: any) => q.kind === 'turret.fire'),
    ];
    for (const r of [off.r, on.r]) { const [hit, fire] = order(r); expect(hit).toBeGreaterThanOrEqual(0); expect(fire).toBeGreaterThan(hit); }
  });
});

describe('MEC-01 R5 — aftermath: the consequence survives and must be answered to (NATURAL scenario)', () => {
  it('the battered door can be repaired with real materials (online law via repairStructure), debited once', () => {
    const { gs, px, py } = freshRun(7084); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    const after = r.entities[door.id];
    expect(after).toBeTruthy();
    expect(after!.hp!).toBeLessThan(140);
    const before = after!.hp!;
    addItem(r, 'inv', 'wood', 8); addItem(r, 'inv', 'rope', 2);
    const cost = structureRepairCost(after!);
    const invWood = countItem(r, 'inv', 'wood'), invRope = countItem(r, 'inv', 'rope');
    expect(act(gs, 'repairStructure', { eid: door.id, material: 'wood' }, walkEnd + 6 * 60000 + 1000).ok).toBe(true);
    expect(r.entities[door.id]!.hp!).toBe(Math.min(140, before + Math.ceil(140 / 4)));
    expect(countItem(r, 'inv', 'wood')).toBe(invWood - cost.find(([k]) => k === 'wood')![1]);
    expect(countItem(r, 'inv', 'rope')).toBe(invRope - (cost.find(([k]) => k === 'rope')?.[1] ?? 0));
    expect(r.receipts.some((q: any) => q.kind === 'structure.repair' && String(q.detail).startsWith(door.id))).toBe(true);
  });

  it('destroyed wreckage is accounted exactly once — repair refuses a structure that is already gone', () => {
    const { gs, px, py } = freshRun(7085); const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(destroyedOnce(r, 'door_wood by boar')).toBe(1);
    expect(r.entities[door.id]).toBeUndefined();
    // The structure is gone: a repair intent cannot bring it back or mint a phantom.
    expect(act(gs, 'repairStructure', { eid: door.id, material: 'wood' }, walkEnd + 6 * 60000 + 2000).ok).toBe(false);
    // A second settlement must not re-credit the destruction.
    const before = r.receipts.filter((q: any) => q.kind === 'struct.destroyed').length;
    settle(gs, walkEnd + 9 * 60000, true);
    expect(r.receipts.filter((q: any) => q.kind === 'struct.destroyed').length).toBe(before);
  });
});
