// R6 — THE PLAYER CONSEQUENCE CLOSURE (Control Tower order 6721750194, step 2)
//
//   offline turret kill → creature drops as physical ground entities
//   → save → a SEPARATE browser process Continues
//   → real player movement + pickup → correct inventory and loot custody, exactly once
//   → the return report states only what the record can prove
//
// NATURAL = real tick() movement only (shipping_fresh geometry) — never natural map play.
// FIXTURE = placement-only injection, always declared. PROCESS = an independent JS module
// registry plays the part of a fresh browser process (Continue).
// Shipping_fresh is used unmodified (placing structures in tests is a fixture, not a Map edit).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TILE, T, uid, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, mkCreature, mkContainer, C, countItem } from '../src/game/engine';
import { settle, tick, PROJ, HAZ, bindCombat, type Input } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 8, 12);
let serial = 0;
const act = (g: GameState, type: string, p: object = {}, now = T0) =>
  dispatch(g, { id: `r6-${++serial}`, type, ...p } as any, now);
const idle = (): Input => ({ up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false });
const fireCount = (r: any) => r.receipts.filter((q: any) => q.kind === 'turret.fire').length;
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

function poweredTurret(gs: GameState, tx: number, ty: number, opts: { arrows?: number; fuel?: number; energy?: number } = {}) {
  const r = gs.run!;
  const arrowBox = mkContainer(r, 'chest', 3).id;
  const turret = mkStruct(r, 'arrow_turret', tx, ty, 120, {
    c: arrowBox,
    turret: { enabled: true, cooldown: 0, angle: Math.PI / 2 },
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
  const fuel = opts.fuel ?? 40;
  if (fuel > 0) { let left = fuel; while (left > 0) { const room = Math.min(60, left); addItem(r, fuelBox, 'wood', room); left -= room; } }
  const arrows = opts.arrows ?? 8;
  if (arrows > 0) { let left = arrows; while (left > 0) { const room = Math.min(60, left); addItem(r, arrowBox, 'arrow', room); left -= room; } }
  markDirty();
  return { turret, gen, arrowBox, fuelBox };
}

function walkHome(gs: GameState, steps = 170) {
  const r = gs.run!;
  let t = T0;
  for (let i = 1; i <= steps; i++) { t = T0 + i * 50; tick(gs, { ...idle(), right: true }, 50, t); }
  return t;
}

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

const dropEntities = (r: any) => (Object.values(r.entities) as any[]).filter(e => e.kind === 'drop');
const dropContents = (r: any) => dropEntities(r).map(e => ({ id: e.id, key: C(r, e.c!).slots[0]?.key, qty: C(r, e.c!).slots[0]?.qty ?? 0, x: e.x, y: e.y }));

describe('R6 — the offline kill’s consequence reaches the player’s hands, exactly once', () => {
  it('offline turret kill → physical drops → new process Continue → real movement + pickup → exactly-once custody', { timeout: 120_000 }, async () => {
    // ---------- ACT 1 — the absence (fixture geometry, real movement to the homestead) ----------
    PROJ.length = 0; HAZ.length = 0;
    const gs = newGame();
    expect(act(gs, 'startRun', { character: 'female', seed: 8861 }, T0).ok).toBe(true);
    gs.run!.qaOffset = 12 * 60000;
    const { px, py } = wintryPatch(gs, 8);
    const r = gs.run!;
    const door = homestead(gs, px, py);
    const walkEnd = walkHome(gs);
    expect(act(gs, 'door', { eid: door.id }, walkEnd).ok).toBe(true);       // closed — the bash must commit
    poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 4000, energy: 0 });
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    // The logout save — the state the player carries into the absence.
    const logout = serializeSnapshot(gs);
    // ---------- ACT 2 — a separate browser process: load → Continue ----------
    const proc = await freshProcess();
    const restored = proc.persist.selectSnapshots([logout, null]).gs!;
    expect(proc.persist.validate(restored)).toBeTruthy();
    const rr = restored.run!;
    const continueAt = walkEnd + 6 * 60000;
    const { lines, report } = proc.returnReport.settleWithReturn(restored, continueAt);
    // The absence is reported honestly: a death committed by the record (instrument NOT attributed),
    // no fabricated reward, no strike against the player.
    const deathRow = report?.sections.world.find((q: any) => String(q.id).startsWith('r') && /creature.*died while you were away/.test(q.text));
    expect(deathRow, 'the absence report must carry the creature-death row').toBeTruthy();
    expect(deathRow!.tone).toBe('warn');
    expect((deathRow as any).receipts.length).toBeGreaterThan(0);           // event-sourced, not invented
    expect(JSON.stringify(report)).not.toMatch(/meat|hide|boar_tusk/);      // no reward is claimed — pickup has not happened
    expect(report?.summary).not.toContain('owes');                          // no invented obligation
    const fireCountAfterContinue = fireCount(rr);
    expect(fireCountAfterContinue).toBeGreaterThanOrEqual(3);               // 16 dmg × 3 ≥ 40 hp — the lawful lethal sequence
    // The dead boar is gone to its drops; the drops are physical ground entities with UIDs.
    const deadBoar = rr.creatures.find((m: any) => m.type === 'boar');
    expect(deadBoar?.state).toBe('dead');
    const dropsAtReturn = dropContents(rr);
    expect(dropsAtReturn.length).toBeGreaterThanOrEqual(2);                 // guaranteed meat ×2 (1 entity, qty 2) + hide ×1
    const meatAtReturn = dropsAtReturn.filter(d => d.key === 'meat').reduce((n, d) => n + d.qty, 0);
    const hideAtReturn = dropsAtReturn.filter(d => d.key === 'hide').reduce((n, d) => n + d.qty, 0);
    expect(meatAtReturn).toBe(2);
    expect(hideAtReturn).toBe(1);
    const dropIdsAtReturn = new Set(dropsAtReturn.map(d => d.id));
    const custodyAtReturn = { meat: custodyTotal(restored, 'meat'), hide: custodyTotal(restored, 'hide') };
    // ---------- ACT 3 — real movement: open the door, walk out, collect ----------
    let t = continueAt;
    const step = (inp: Partial<Input>, ms = 50) => { t += ms; proc.sim.tick(restored, { ...idle(), ...inp }, ms, t); };
    const dropCount = () => dropEntities(rr).length;
    const invQty = (key: string) => countItem(rr, C(rr, 'inv').id, key);
    const invMeatBefore = invQty('meat'), invHideBefore = invQty('hide');
    expect(proc.engine.dispatch(restored, { id: 'r6-open-door', type: 'door', eid: rr.entities[door.id] ? door.id : (Object.values(rr.entities).find((e: any) => e.type === 'door_wood') as any).id } as any, t).ok).toBe(true);   // the door stands at the exit; the player opens it from inside
    // Walk west through the doorway; sweep the row if anything lingers.
    for (let i = 0; i < 200 && dropCount() > 0; i++) step({ left: true });
    // Greedy walk-to for any drop outside the magnet radius: choose the axis toward the nearest drop each step.
    for (let i = 0; i < 400 && dropCount() > 0; i++) {
      const nearest = dropEntities(rr).sort((a, b) => Math.hypot(a.x - rr.player.x, a.y - rr.player.y) - Math.hypot(b.x - rr.player.x, b.y - rr.player.y))[0];
      const dx = nearest.x - rr.player.x, dy = nearest.y - rr.player.y;
      step({ left: dx < -1, right: dx > 1, up: dy < -1, down: dy > 1 });
    }
    expect(dropCount()).toBe(0);                                            // every drop physically reached and collected
    // ---------- ACT 4 — exactly-once custody ----------
    expect(invQty('meat') - invMeatBefore).toBe(2);                         // the kill's meat reached the inventory, whole
    expect(invQty('hide') - invHideBefore).toBe(1);
    const destroyed = dropsAtReturn.every(d => !rr.entities[d.id]);
    expect(destroyed).toBe(true);                                           // the drop entities were consumed, not duplicated
    const dropsAtReturnCount = dropsAtReturn.length;
    const pickupReceipts = rr.receipts.filter((q: any) => q.kind === 'pickup');
    // The dispatcher's receipt ids are the monotonic run sequence (r<seq>); each 'pickup' receipt
    // attests exactly one physical drop being collected — the detail carries key×qty.
    expect(pickupReceipts.length).toBe(dropsAtReturnCount);                // one receipt per drop, never replayed
    const pickupDetails = pickupReceipts.map((q: any) => String(q.detail));
    expect(pickupDetails.filter(d => d === 'meatx2').length).toBe(1);      // the boar's meat, exactly once
    expect(pickupDetails.filter(d => d === 'hidex1').length).toBe(1);      // the boar's hide, exactly once
    expect(pickupDetails.length - pickupDetails.filter(d => ['meatx2', 'hidex1'].includes(d)).length)
      .toBeLessThanOrEqual(1);                                             // at most the 30% tusk drop, never more
    // Custody conservation: the persisted loot ledger is conserved one-for-one across the
    // ground → inventory transition (drops are custody while they lie on the ground).
    expect(custodyAtReturn.meat).toBe(meatAtReturn);                      // the drops were the only meat in the world
    expect(custodyAtReturn.hide).toBe(hideAtReturn);
    expect(custodyTotal(restored, 'meat')).toBe(custodyAtReturn.meat);      // 2 in → 2 out, nothing minted
    expect(custodyTotal(restored, 'hide')).toBe(custodyAtReturn.hide);
    expect(Object.values(rr.custody as Record<string, any>).every((c: any) => c.kind !== 'drop')).toBe(true);   // consumed drops are struck from the ledger
    // ---------- ACT 5 — a second Continue mints and replays nothing ----------
    const again = proc.returnReport.settleWithReturn(restored, t + 5000);
    expect(dropEntities(rr).length).toBe(0);
    expect(invQty('meat') - invMeatBefore).toBe(2);
    expect(invQty('hide') - invHideBefore).toBe(1);
    const replays = rr.receipts.filter((q: any) => q.kind === 'pickup').length;
    expect(replays).toBe(dropsAtReturn.length);                             // no pickup receipt appears twice
    expect(again.report?.sections.world.some((q: any) => /creature.*died while you were away/.test(q.text)) ?? false).toBe(false);   // the death is not re-reported for a window without deaths
  });
});
