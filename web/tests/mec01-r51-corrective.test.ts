// MEC-01 R5.1 — CONTROL TOWER corrective order, executable.
// Each test pins one correction from the R5 review comment:
//   P0-A projectile binding   P0-B cooldown slices   P0-C knockback/marker authority
//   P1-D projectile/hazard leak P1-E partition cap & hostile-category scope
// Labbelling: NATURAL = real movement only, knowledge comes from shipped laws;
//             FIXTURE = placement-only fixtures (injected impulses/projectiles are marked);
//             CONTROL = one lawful prerequisite removed or one hostile category substituted;
//             PROCESS = an independent JS module registry plays the part of a fresh browser process.
// shipping_fresh is used unmodified (placing structures in tests is a fixture, not a Map edit).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TILE, T, uid, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, mkCreature, mkContainer, C, countItem } from '../src/game/engine';
import { settle, tick, PROJ, HAZ, bindCombat, type Input } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 8, 12);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) =>
  dispatch(g, { id: `offdef51-${++serial}`, type, ...p } as any, now);
const idle = (): Input => ({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });
const fireCount = (r: any) => r.receipts.filter((q: any) => q.kind === 'turret.fire').length;
const countArrows = (r: any) => countItem(r, C(r, 'inv').id, 'arrow');
const custodyTotal = (gs: GameState, key: string) => {
  let n = 0; for (const c of Object.values(gs.run!.custody)) for (const s of c.slots) if (s && s.key === key) n += s.qty; return n;
};

beforeAll(() => setActiveLayout('shipping_fresh'));

function wintryPatch(gs: GameState, rad = 8) {
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
    r.terrain[i] = { t: T.SNOW } as any;
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
  gs.run!.qaOffset = 12 * 60000;
  const patch = wintryPatch(gs, 8);
  return { gs, ...patch };
}

const mkStruct = (r: any, type: string, tx: number, ty: number, hp: number, extra: object = {}) =>
  ({ id: uid(r, 'e'), kind: 'struct', type, tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp, maxHp: hp, owner: 'player', ...extra } as any);

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

function poweredTurret(gs: GameState, tx: number, ty: number, opts: { arrows?: number; fuel?: number; energy?: number; cooldown?: number } = {}) {
  const r = gs.run!;
  const arrowBox = mkContainer(r, 'chest', 3).id;
  const turret = mkStruct(r, 'arrow_turret', tx, ty, 120, {
    c: arrowBox,
    turret: { enabled: true, cooldown: opts.cooldown ?? 0, angle: Math.PI / 2 },
  });
  r.entities[turret.id] = turret;
  const [gx, gy] = [tx, ty - 1];
  const fuelBox = mkContainer(r, 'chest', 3).id;
  const gen = mkStruct(r, 'base_generator', gx, gy, 150, {
    c: fuelBox,
    basePower: { enabled: true, energy: opts.energy ?? 0, capacity: 2, priority: 'defense' },
  });
  r.entities[gen.id] = gen;
  turret.turret!.generatorId = gen.id;
  if ((opts.fuel ?? 40) > 0) addItem(r, fuelBox, 'wood', opts.fuel ?? 40);
  if ((opts.arrows ?? 8) > 0) {
    // multiple slots when stack is capped at 60 for the arrow cap test fixture
    let left = opts.arrows ?? 8;
    while (left > 0) { const room = Math.min(60, left); addItem(r, arrowBox, 'arrow', room); left -= room; }
  }
  markDirty();
  return { turret, gen, arrowBox, fuelBox };
}

function walkHome(gs: GameState, steps = 170) {
  const r = gs.run!;
  let t = T0;
  for (let i = 1; i <= steps; i++) { t = T0 + i * 50; tick(gs, { ...idle(), right: true }, 50, t); }
  return t;
}

const doorHits = (r: any, doorId: string) =>
  r.receipts.filter((q: any) => q.kind === 'struct.hit' && String(q.detail).startsWith(doorId));

/** Independent module registry — the closest thing vitest has to a fresh browser process. */
async function freshProcess() {
  vi.resetModules();
  const sim = await import('../src/game/sim');
  const engine = await import('../src/game/engine');
  const persist = await import('../src/game/persist');
  const world = await import('../src/game/world');
  const returnReport = await import('../src/game/return-report');
  world.setActiveLayout('shipping_fresh');
  return { sim, engine, persist, returnReport };
}
const roundTrip = (snap: string) => {
  const reloaded = selectSnapshots([snap, null]).gs!;
  expect(validate(reloaded)).toBeTruthy();
  return reloaded;
};

describe('R5.1 P0-A — Continue binds combat at the offline boundary (fresh process)', () => {
  it('[PROCESS] an in-flight bow arrow persisted at logout steps during settlement — exactly one impact', async () => {
    const { gs, px, py } = freshRun(8817); const r = gs.run!;
    // Open-field fixture: a sleeping wolf 9 tiles ahead — nothing walls the lane.
    const dummy = mkCreature(r, 'wolf', r.player.x + 9 * TILE, r.player.y, 25); dummy.state = 'sleep'; // static target: arrows pass resolution, no AI
    r.creatures.push(dummy);
    addItem(r, 'inv', 'bow', 1); addItem(r, 'inv', 'arrow', 3);
    const inv = C(r, 'inv');
    r.player.active = inv.slots.findIndex(s => s?.key === 'bow');
    // Fire the REAL bow: the swing resolves after its contact frame and releases through resolveSwing.
    let releaseAt = -1;
    for (let i = 1; i <= 20 && releaseAt < 0; i++) {
      tick(gs, { ...idle(), attack: true, attackPressed: i === 1, mx: dummy.x, my: dummy.y }, 50, T0 + i * 50);
      if (PROJ.length > 0) releaseAt = T0 + i * 50;
    }
    expect(releaseAt).toBeGreaterThan(0);
    expect(r.clock.lastSimAt).toBeGreaterThanOrEqual(releaseAt - 50);
    expect(countItem(r, 'inv', 'arrow')).toBe(2);   // the release debited the physical arrow
    const snap = serializeSnapshot(gs);

    const proc = await freshProcess();
    const restored = proc.persist.selectSnapshots([snap, null]).gs!;
    expect(proc.persist.validate(restored)).toBeTruthy();
    expect(restored.run!.combat!.projectiles).toHaveLength(1);   // the arrow crossed the save
    expect(proc.sim.PROJ).toHaveLength(0);                       // …but a fresh process binds nothing yet

    proc.sim.settle(restored, T0 + 6 * 60000, true);
    const dummy2 = restored.run!.creatures.find(c => c.id === dummy.id)!;
    expect(dummy2.hp).toBe(9);                                   // 25 − 16 exactly once
    expect(proc.sim.PROJ).toHaveLength(0);                       // no duplicate survived
    proc.sim.tick(restored, idle(), 50, T0 + 6 * 60000 + 50);    // online law resumes; nothing re-fires
    expect(dummy2.hp).toBe(9);
    expect(countItem(restored.run!, 'inv', 'arrow')).toBe(2);
  });

  it('[PROCESS] an arrow mid-flight at the settle endpoint survives Continue and lands exactly once later', async () => {
    const { gs, px, py } = freshRun(8818); const r = gs.run!;
    const dummy = mkCreature(r, 'wolf', r.player.x + 9 * TILE, r.player.y, 25); dummy.state = 'sleep';
    r.creatures.push(dummy);
    addItem(r, 'inv', 'bow', 1); addItem(r, 'inv', 'arrow', 2);
    const inv = C(r, 'inv');
    r.player.active = inv.slots.findIndex(s => s?.key === 'bow');
    let releaseAt = -1;
    for (let i = 1; i <= 20 && releaseAt < 0; i++) {
      tick(gs, { ...idle(), attack: true, attackPressed: i === 1, mx: dummy.x, my: dummy.y }, 50, T0 + i * 50);
      if (PROJ.length > 0) releaseAt = T0 + i * 50;
    }
    expect(releaseAt).toBeGreaterThan(0);
    const snap = serializeSnapshot(gs);

    const proc = await freshProcess();
    const restored = proc.persist.selectSnapshots([snap, null]).gs!;
    // A short absence: the arrow cannot reach the target yet — it must survive, not teleport, not vanish.
    proc.sim.settle(restored, releaseAt + 400, true);
    expect(proc.sim.PROJ).toHaveLength(1);                       // stepped, still in flight
    const midFlight = { ...proc.sim.PROJ[0] };
    expect(restored.run!.combat!.projectiles).toBe(proc.sim.PROJ);  // the bound array IS the saved one
    proc.sim.tick(restored, idle(), 50, releaseAt + 800);        // Continue: online law resumes
    proc.sim.tick(restored, idle(), 50, releaseAt + 1200);
    proc.sim.tick(restored, idle(), 50, releaseAt + 1600);
    // The arrow kept flying forward from where it was — it did not restart from the logout position.
    expect(proc.sim.PROJ.length === 0 || proc.sim.PROJ[0].x !== midFlight.x).toBe(true);
    for (let i = 0; i < 30; i++) proc.sim.tick(restored, idle(), 50, releaseAt + 2000 + i * 50);
    expect(restored.run!.creatures.find(c => c.id === dummy.id)!.hp).toBe(9);   // exactly one impact eventually
    expect(countItem(restored.run!, 'inv', 'arrow')).toBe(1);
  });
});

describe('R5.1 P0-B — turret cooldown is advanced exactly once per chronological slice', () => {
  it('[NATURAL] cooldown drains during no-contact 50 ms slices of a trace pursuit (no frozen logout value)', () => {
    const { gs, px, py } = freshRun(8821); const r = gs.run!;
    homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    const door = Object.values(r.entities).find(e => e.type === 'door_wood')!;
    act(gs, 'door', { eid: door.id }, walkEnd).ok;
    const { turret } = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0, cooldown: 1000 });  // FIXTURE: cooldown injection
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 400); boar.state = 'wander';   // tougher boar: still walking at +2 s
    r.creatures.push(boar);
    settle(gs, walkEnd + 2000, true);   // 2 s of pursuit; bash has not landed yet — prov does not exist
    expect(turret.turret!.cooldown).toBe(0);   // decayed by the pursuit slices, not frozen at logout
    expect(fireCount(r)).toBe(0);             // no lawful shot before prov — unchanged law
  });

  it('[NATURAL] after the bash commits, the first shot fires with drained cooldown (online-timeline law)', () => {
    const { gs, px, py } = freshRun(8822); const r = gs.run!;
    homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    const door = Object.values(r.entities).find(e => e.type === 'door_wood')!;
    act(gs, 'door', { eid: door.id }, walkEnd).ok;
    const wall = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0, cooldown: 1000 });  // FIXTURE: cooldown injection
    const invArrowsAtLogout = countItem(r, C(r, 'inv').id, 'arrow');
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    const hitAt = r.receipts.find((q: any) => q.kind === 'struct.hit')?.at ?? -1;
    const fireAt = r.receipts.find((q: any) => q.kind === 'turret.fire')?.at ?? -1;
    expect(hitAt).toBeGreaterThan(0);
    expect(fireAt).toBeGreaterThan(0);
    expect(fireAt - hitAt).toBeLessThanOrEqual(100);  // the pursuit drained the cooldown; the shot is immediate
    expect(countItem(r, C(r, 'inv').id, 'arrow')).toBe(invArrowsAtLogout);          // the turret never reaches into the player's arrows
    expect(countItem(r, wall.arrowBox, 'arrow')).toBe(8 - fireCount(r));            // the chest pays 1 per fire, nothing else does
  });
});

describe('R5.1 P0-C — knockback recovery and the unresolved marker have one authority', () => {
  it('[FIXTURE] an impulse present at logout is recovered inside the eligible playback, never marker-frozen', () => {
    const { gs, px, py } = freshRun(8825); const r = gs.run!;
    homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    const door = Object.values(r.entities).find(e => e.type === 'door_wood')!;
    act(gs, 'door', { eid: door.id }, walkEnd).ok;
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 400); boar.state = 'wander';
    r.creatures.push(boar);
    boar.kbx = 80; boar.kby = 0;   // FIXTURE: the impulse an arrow would leave at logout — decayed by playback
    const before = boar.x;
    settle(gs, walkEnd + 2000, true);
    expect(Math.abs(boar.kbx) + Math.abs(boar.kby)).toBeLessThanOrEqual(1);   // impulse integrated & decayed like live play
    expect(boar.x).toBeGreaterThan(before);                                   // …and it moved while recovering
    expect(boar.offlineUnresolvedAt).toBeUndefined();                         // …and recovery happens INSIDE playback — never marker-frozen mid-impulse
    settle(gs, walkEnd + 6 * 60000, true);
    expect(doorHits(r, door.id).length).toBeGreaterThanOrEqual(1);            // pursuit resumed after recovery
    // A creature that reaches line of sight of the absent player is frozen with the marker by law
    // (player combat cannot be reconstructed offline) — that boundary is the lawful marker case.
  });

  it('[NATURAL] a turret-killed boar is removed from playback without a freeze marker or corpse advance', () => {
    const { gs, px, py } = freshRun(8826); const r = gs.run!;
    homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    const door = Object.values(r.entities).find(e => e.type === 'door_wood')!;
    act(gs, 'door', { eid: door.id }, walkEnd).ok;
    poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 40, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    settle(gs, walkEnd + 6 * 60000, true);
    expect(boar.state).toBe('dead');
    expect(boar.offlineUnresolvedAt).toBeUndefined();   // death is terminal for playback — no marker, no advance
    const deadPos = { x: boar.x, y: boar.y };
    const posBefore = { x: boar.x, y: boar.y };
    settle(gs, walkEnd + 6 * 60000 + 60_000, true);          // one more minute — the corpse must not move
    expect(boar.x).toBe(posBefore.x); expect(boar.y).toBe(posBefore.y);
    expect(deadPos).toEqual(posBefore);
  });
});

describe('R5.1 P1-D — hostile projectiles and hazards never fire on the absent player', () => {
  it('[FIXTURE] an enemy arrow parked on the player is inert: purged at the boundary, hp untouched', () => {
    // The wintry patch and 6 minutes of absence cost the player exposure hp by their own law —
    // so hp is proven inert here by CONTROL: the same absence replayed without the parked instruments
    // must land on the identical hp. Any incremental damage would show up as a difference.
    const run = (withProj: boolean) => {
      const { gs, px, py } = freshRun(8831); const r = gs.run!;
      homestead(gs, px, py);
      walkHome(gs);
      bindCombat(r);   // the game always binds the run's combat before any projectile exists there
      if (withProj) {
        PROJ.push({ x: r.player.x, y: r.player.y, vx: 0, vy: 0, life: 0.5, dmg: 999, from: 'enemy', kind: 'arrow', r: 3 } as any);
        PROJ.push({ x: r.player.x, y: r.player.y, vx: 0, vy: 0, life: 2, dmg: 50, from: 'enemy', kind: 'fireball', r: 4, delay: 2500 } as any);
      }
      settle(gs, T0 + 6 * 60000, true);
      return r;
    };
    const control = run(false), parked = run(true);
    expect(parked.player.hp).toBe(control.player.hp);   // hurtPlayer is unreachable from the offline settlement path
    expect(PROJ.filter(p => p.from === 'enemy')).toHaveLength(0);  // discarded at the boundary — cannot ambush after return
    expect(parked.receipts.some((q: any) => q.kind === 'offline.projectiles_cleared' && q.detail === '2')).toBe(true);
  });

  it('[FIXTURE] a hostile hazard in flight at logout dissipates; the player’s own hazard persists untouched', async () => {
    const { gs, px, py } = freshRun(8832); const r = gs.run!;
    homestead(gs, px, py);
    walkHome(gs);
    bindCombat(r);   // the game always binds the run's combat before any hazard exists there
    HAZ.push({ kind: 'circle', x: r.player.x, y: r.player.y, r: 18, t: 0, tell: 800, dur: 99999, dmg: 32, style: 'erupt', owner: 'm_attacker' } as any);
    HAZ.push({ kind: 'ring', x: r.player.x, y: r.player.y, r: 60, t: 0, tell: 0, dur: 380, dmg: 20, style: 'frostnova', effect: 'slowm', owner: 'player' } as any);
    PROJ.push({ x: r.player.x, y: r.player.y, vx: 0, vy: 0, life: 0.5, dmg: 999, from: 'enemy', kind: 'arrow', r: 3 } as any);
    const rep = settle(gs, T0 + 6 * 60000, false);
    expect(HAZ).toHaveLength(1);
    expect(HAZ[0].owner).toBe('player');     // the player’s committed hazard persists, not advanced
    expect(PROJ).toHaveLength(0);            // the hostile projectile was discarded at the boundary
    expect(r.receipts.some((q: any) => q.kind === 'offline.hazards_cleared' && q.detail === '1')).toBe(true);
    expect(r.receipts.some((q: any) => q.kind === 'offline.projectiles_cleared' && q.detail === '1')).toBe(true);
    expect(rep.some(l => l.includes('hostile hazard'))).toBe(true);
    expect(rep.some(l => l.includes('hostile projectile'))).toBe(true);
    // Save → validate → independent process → the hostile instruments are gone for good, the player’s hazard is still pending online law.
    const snap = serializeSnapshot(gs);
    const proc = await freshProcess();
    const restored = proc.persist.selectSnapshots([snap, null]).gs!;
    expect(restored.run!.combat!.hazards).toHaveLength(1);
    expect(restored.run!.combat!.hazards[0].owner).toBe('player');
    expect(restored.run!.combat!.projectiles).toHaveLength(0);
  });

  it('[FIXTURE] a delayed player-origin projectile resolves fully offline — explosion, creature hit, no harm to the player', () => {
    const { gs, px, py } = freshRun(8833); const r = gs.run!;
    const boar = mkCreature(r, 'boar', (px + 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'sleep'; r.creatures.push(boar);
    homestead(gs, px, py);
    walkHome(gs);
    bindCombat(r);   // the game always binds the run's combat before any projectile exists there
    // FIXTURE-INJECTION: a committed spell projectile, 400 ms fuse, aimed at the sleeping boar.
    PROJ.push({ x: boar.x - 60, y: boar.y, vx: 120, vy: 0, life: 5, dmg: 30, from: 'player', kind: 'fireball', r: 3, delay: 400 } as any);
    settle(gs, T0 + 6 * 60000, true);
    expect(boar.hp).toBe(10);                 // 40 − 30: the explosion landed exactly once
    expect(PROJ.filter(p => p.kind === 'fireball')).toHaveLength(0);
    // hp: proven against a control absence (exposure is charged by its own law) — explode() never charges the absent player
    const ctl = freshRun(8833); const cr = ctl.gs.run!;
    homestead(ctl.gs, ctl.px, ctl.py);
    walkHome(ctl.gs);
    settle(ctl.gs, T0 + 6 * 60000, true);
    expect(r.player.hp).toBe(cr.player.hp);
  });
});

describe('R5.1 P1-E — the fine-defense budget persists across partitions and reloads', () => {
  /** Open-field siege: an unkillable aggro wolf two tiles from a powered turret is a guaranteed
   *  lawful target every second (16 dmg/shot, 1000 ms cooldown), and a committed probe projectile keeps the
   *  defense window open regardless of combat. The budget — not the outcome of any fight — is under test. */
  const PARTITION_GAP = 20 * 60000;
  function siege(seed: number) {
    const { gs, px, py } = freshRun(seed); const r = gs.run!;
    poweredTurret(gs, px + 2, py, { arrows: 180, fuel: 4000, energy: 0 });
    const wolf = mkCreature(r, 'wolf', (px + 4) * TILE + 8, py * TILE + 8, 10_000_000); wolf.state = 'wander';
    r.creatures.push(wolf);
    bindCombat(r);   // the game always binds the run's combat before any projectile exists there
    PROJ.push({ x: r.player.x, y: r.player.y - 4, vx: 0, vy: 0, life: 10_000, dmg: 1, from: 'player', kind: 'test_probe', r: 3 } as any);
    return { gs, r };
  }
  const funnelOut = (r: any, probeArray: any[]) => {
    const turret = Object.values(r.entities as Record<string, any>).find(e => e.turret) as any;
    const wolf = (r.creatures as any[]).find(c => c.type === 'wolf')!;
    const probe = probeArray.find(p => (p as any).kind === 'test_probe');
    return { fires: fireCount(r), arrows: countItem(r, turret.c!, 'arrow'), probeLife: probe?.life ?? null, budget: r.clock.defenseFrames ?? 0, targetHp: wolf!.hp };
  };

  it('continuous 20 minutes vs split vs separately reloaded — identical budget, shots, and fallout at the cap', { timeout: 120_000 }, async () => {
    const t1 = T0 + 6 * 60000, t2 = T0 + 15 * 60000;   // weather-slot aligned slice boundaries
    // Leg A — continuous.
    const a = siege(8834);
    settle(a.gs, T0 + PARTITION_GAP, true);
    const aOut = funnelOut(a.r, PROJ);
    // Leg B — three settles at aligned boundaries.
    const b = siege(8834);
    settle(b.gs, t1, true); settle(b.gs, t2, true); settle(b.gs, T0 + PARTITION_GAP, true);
    const bOut = funnelOut(b.r, PROJ);
    // Leg C — a separately reloaded process between the second and third legs.
    const c = siege(8834);
    settle(c.gs, t1, true); settle(c.gs, t2, true);
    const snap = serializeSnapshot(c.gs);
    const proc = await freshProcess();
    const restored = proc.persist.selectSnapshots([snap, null]).gs!;
    proc.sim.settle(restored, T0 + PARTITION_GAP, true);
    const cRun = restored.run!;
    const cTurret = Object.values(cRun.entities).find((e: any) => e.turret) as any;
    const cWolf = (cRun.creatures as any[]).find(m => m.type === 'wolf')!;
    const cProbe = proc.sim.PROJ.find(p => (p as any).kind === 'test_probe');
    const cOut = { fires: fireCount(cRun), arrows: proc.engine.countItem(cRun, cTurret.c!, 'arrow'), probeLife: cProbe?.life ?? null, budget: cRun.clock.defenseFrames ?? 0, targetHp: cWolf.hp };

    expect(bOut).toEqual(aOut);
    expect(cOut).toEqual(aOut);
    expect(aOut.budget).toBe(14400);           // the cap is spent, persisted and shared across partitions
    expect(aOut.fires).toBeGreaterThanOrEqual(170);
    expect(aOut.fires).toBeLessThanOrEqual(180);
    expect(aOut.arrows).toBe(180 - aOut.fires);
    expect(aOut.probeLife).toBeLessThan(10_000);
    expect(aOut.probeLife).toBeGreaterThanOrEqual(0);
  });

  it('the budget is written through saves (validator accepts the boundary, rejects corrupt values)', () => {
    const { gs } = siege(8835);
    settle(gs, T0 + 60000, true);
    const mkInner = (mut: (inner: any) => void) => {
      const wrapped = JSON.parse(serializeSnapshot(gs));
      const inner = JSON.parse(wrapped.payload);
      mut(inner);
      return inner;
    };
    expect(validate(mkInner(i => { i.run.clock.defenseFrames = 14400; }))).toBeTruthy();
    expect(validate(mkInner(i => { i.run.clock.defenseFrames = -1; }))).toBeNull();
    expect(validate(mkInner(i => { i.run.clock.defenseFrames = 10_000_000; }))).toBeNull();
    expect(validate(mkInner(i => { i.run.clock.defenseFrames = 3.5; }))).toBeNull();
  });
});

describe('R5.1 P1-E — traceBarrier at the 64 px ray and lawful site access', () => {
  it('[NATURAL] an out-of-bounds scan ray exits the grid cleanly — no phantom barrier, no bash from off-map', () => {
    PROJ.length = 0; HAZ.length = 0;
    const gs = newGame();
    expect(act(gs, 'startRun', { character: 'female', seed: 8841 }, T0).ok).toBe(true);
    const r = gs.run!;
    r.qaOffset = 12 * 60000;
    r.creatures = [];
    // Hand-rolled micro-arena at the absolute map edge: snow strip along the northern border.
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 14; tx++) r.terrain[ty * 200 + tx] = { t: T.SNOW } as any;
    r.natureTrees = (r.natureTrees || []).filter(t => t.tx >= 14 || t.ty >= 12);
    r.player.x = 7 * TILE + 8; r.player.y = 9 * TILE + 8;
    markDirty();
    // Real movement: walk straight to the northern border; traces point north — the ray exits the grid.
    let t = T0;
    for (let i = 1; i <= 140; i++) { t = T0 + i * 50; tick(gs, { ...idle(), up: true }, 50, t); }
    expect(r.player.y).toBeLessThan(6 * TILE);
    expect(r.traces.length).toBeGreaterThan(0);
    const boar = mkCreature(r, 'boar', 7 * TILE + 8, 1 * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    expect(() => settle(gs, t + 6 * 60000, true)).not.toThrow();
    expect(r.receipts.filter((q: any) => q.kind === 'struct.hit')).toHaveLength(0);  // nothing lawful to batter
    expect(r.clock.lastSimAt).toBeGreaterThan(t);
  });

  it('[NATURAL] an open door is not a barrier; a closed door is — the site access point under law', () => {
    const build = (seed: number, close: boolean) => {
      const { gs, px, py } = freshRun(seed); const r = gs.run!;
      const door = homestead(gs, px, py);   // spawns OPEN (the player walked through it)
      const walkEnd = walkHome(gs);
      if (close) expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);   // the toggle CLOSES it — the bash becomes lawful
      const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
      r.creatures.push(boar);
      settle(gs, walkEnd + 6 * 60000, true);
      return { r, door };
    };
    const openLeg = build(8842, false);
    const closedLeg = build(8843, true);
    expect(doorHits(openLeg.r, openLeg.door.id)).toHaveLength(0);   // an open site access is never battered
    expect(doorHits(closedLeg.r, closedLeg.door.id).length).toBeGreaterThanOrEqual(1);
  });

  it('[CONTROL] an aggro hostile with no trail is a lawful turret target — the boar negative is not universal', () => {
    const { gs, px, py } = freshRun(8844); const r = gs.run!;
    homestead(gs, px, py);                                   // no walk: r.traces stays empty
    poweredTurret(gs, px + 6, py + 2, { arrows: 8, fuel: 40, energy: 0 });
    const wolf = mkCreature(r, 'wolf', (px + 7) * TILE + 8, (py + 2) * TILE + 8, 30); wolf.state = 'wander';
    r.creatures.push(wolf);
    expect(r.traces).toHaveLength(0);
    settle(gs, T0 + 10 * 60000, true);                        // aggro species: presence is the lawful trigger
    expect(fireCount(r)).toBeGreaterThanOrEqual(1);
    expect((wolf.state as string) === 'dead' || wolf.hp! < 30).toBe(true);
    expect(r.receipts.some((q: any) => q.kind === 'struct.hit')).toBe(false);  // no trail — nothing is battered
  });
});
