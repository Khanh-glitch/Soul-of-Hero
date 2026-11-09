// R6 — THE PLAYER CONSEQUENCE CLOSURE (Control Tower order 6721750194, step 2)
// R6.1 — closure repairs (order 6722812147): K1 UID custody on whole-stack pickup, accounted fixture fuel
//        (real 3-slot capacity, zero leftover), post-pickup save → independent module registry → Continue.
//
//   offline turret kill → creature drops as physical ground entities
//   → save → an ISOLATED MODULE REGISTRY Continues (vi.resetModules + fresh imports — not an OS/browser restart)
//   → real player movement + pickup → correct inventory and loot custody, exactly once
//   → the return report states only what the record can prove
//
// NATURAL = real tick() movement only (shipping_fresh geometry) — REAL_MOVEMENT_ON_FIXTURE_GEOMETRY, never natural map play.
// FIXTURE = placement-only injection, always declared. PROCESS = an isolated JS module
// registry (vi.resetModules + fresh imports) — NOT a separate OS/browser process.
// Shipping_fresh is used unmodified (placing structures in tests is a fixture, not a Map edit).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { TILE, T, uid, type GameState } from '../src/game/core';
import { newGame, dispatch, addItem, markDirty, mkCreature, mkContainer, C, countItem } from '../src/game/engine';
import { settle, tick, PROJ, HAZ, bindCombat, type Input } from '../src/game/sim';
import { getWorld, setActiveLayout } from '../src/game/world';
import { serializeSnapshot, selectSnapshots, validate } from '../src/game/persist';
import { ITEMS } from '../src/game/catalog';

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
  // Fixture grants are PAID stock at real container capacity — never more than the chest holds.
  const fixtureGrant = (cid: string, key: string, qty: number) => {
    const leftover = addItem(r, cid, key, qty);
    expect(leftover, `${key} fixture grant exceeded the chest's real capacity`).toBe(0);   // every input accounted for
    expect(countItem(r, cid, key)).toBe(qty);                                              // the chest really holds it
  };
  const woodCapacity = 3 * ITEMS.wood.max;     // 3-slot fuel chest · 60 wood per slot = 180
  const arrowCapacity = 3 * ITEMS.arrow.max;   // 3-slot arrow chest · 60 arrows per slot = 180
  const fuel = opts.fuel ?? 40;
  if (fuel > 0) { expect(fuel).toBeLessThanOrEqual(woodCapacity); fixtureGrant(fuelBox, 'wood', fuel); }
  const arrows = opts.arrows ?? 8;
  if (arrows > 0) { expect(arrows).toBeLessThanOrEqual(arrowCapacity); fixtureGrant(arrowBox, 'arrow', arrows); }
  markDirty();
  return { turret, gen, arrowBox, fuelBox };
}

function walkHome(gs: GameState, steps = 170) {
  const r = gs.run!;
  let t = T0;
  for (let i = 1; i <= steps; i++) { t = T0 + i * 50; tick(gs, { ...idle(), right: true }, 50, t); }
  return t;
}

/** ISOLATED MODULE REGISTRY — vi.resetModules() + fresh imports; NOT a separate OS/browser process. */
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
const dropContents = (r: any) => dropEntities(r).map(e => ({ id: e.id, cid: e.c, uid: C(r, e.c!).slots[0]?.uid, key: C(r, e.c!).slots[0]?.key, qty: C(r, e.c!).slots[0]?.qty ?? 0, x: e.x, y: e.y }));

describe('R6/R6.1 — the offline kill’s consequence reaches the player’s hands, exactly once', () => {
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
    const homeFix = poweredTurret(gs, px + 5, py - 1, { arrows: 8, fuel: 180, energy: 0 });   // full 3-slot paid fuel stock, accounted
    const boar = mkCreature(r, 'boar', (px - 1) * TILE + 8, py * TILE + 8, 40); boar.state = 'wander';
    r.creatures.push(boar);
    // The logout save — the state the player carries into the absence.
    const logout = serializeSnapshot(gs);
    // ---------- ACT 2 — ISOLATED MODULE REGISTRY Continue: load → Continue (not an OS/browser restart) ----------
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
    const woodBurned = 180 - countItem(rr, homeFix.fuelBox, 'wood');        // genuine fuel expenditure, not the 4,000-unit fiction
    const woodBurnReceipts = rr.receipts.filter((q: any) => q.kind === 'power.fuel' && /:wood$/.test(String(q.detail))).length;
    expect(woodBurned).toBeGreaterThan(0);                                  // the absence drew real paid fuel
    expect(woodBurned).toBe(woodBurnReceipts);                              // every unit debited from the chest has its power.fuel receipt
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
    const meatDropKeep = dropsAtReturn.find(d => d.key === 'meat')!;
    const hideDropKeep = dropsAtReturn.find(d => d.key === 'hide')!;
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
    // K1 custody — whole stacks moved with their identity, never re-minted into new lineage.
    const meatDrop = dropsAtReturn.find(d => d.key === 'meat')!;
    const hideDrop = dropsAtReturn.find(d => d.key === 'hide')!;
    const invMeatStack = C(rr, 'inv').slots.find((st: any) => st && st.key === 'meat')!;
    const invHideStack = C(rr, 'inv').slots.find((st: any) => st && st.key === 'hide')!;
    expect(invMeatStack.uid).toBe(meatDrop.uid);                              // the source stack UID survived the ground→inventory custody transfer
    expect(invHideStack.uid).toBe(hideDrop.uid);
    const liveUids = (Object.values(rr.custody as Record<string, any>) as any[]).flatMap((c: any) => c.slots.filter(Boolean).map((st: any) => st.uid));
    expect(new Set(liveUids).size).toBe(liveUids.length);                     // no duplicate live UID anywhere in custody
    expect(liveUids.filter(u => u === meatDrop.uid)).toHaveLength(1);         // exactly one live occurrence — no replay, no mint
    expect(liveUids.filter(u => u === hideDrop.uid)).toHaveLength(1);
    // ---------- ACT 5 — a second Continue mints and replays nothing ----------
    const again = proc.returnReport.settleWithReturn(restored, t + 5000);
    expect(dropEntities(rr).length).toBe(0);
    expect(invQty('meat') - invMeatBefore).toBe(2);
    expect(invQty('hide') - invHideBefore).toBe(1);
    const replays = rr.receipts.filter((q: any) => q.kind === 'pickup').length;
    expect(replays).toBe(dropsAtReturn.length);                             // no pickup receipt appears twice
    expect(again.report?.sections.world.some((q: any) => /creature.*died while you were away/.test(q.text)) ?? false).toBe(false);   // the death is not re-reported for a window without deaths
    // ---------- ACT 6 — save AFTER the pickups → a SECOND isolated registry → Continue ----------
    // The post-pickup state crosses the boundary too: no mint, no replay, no re-materialized drop,
    // and the inventory the player earned is exactly what the save carries.
    const postPickup = serializeSnapshot(restored);
    const proc2 = await freshProcess();
    const restored2 = proc2.persist.selectSnapshots([postPickup, null]).gs!;
    expect(proc2.persist.validate(restored2)).toBeTruthy();
    const rr2 = restored2.run!;
    const continue2At = t + 60000;
    const again2 = proc2.returnReport.settleWithReturn(restored2, continue2At);
    expect(dropEntities(rr2)).toHaveLength(0);                              // no drop re-minted by the independent reload
    expect(countItem(rr2, C(rr2, 'inv').id, 'meat')).toBe(invMeatBefore + 2);
    expect(countItem(rr2, C(rr2, 'inv').id, 'hide')).toBe(invHideBefore + 1);
    expect(rr2.receipts.filter((q: any) => q.kind === 'pickup')).toHaveLength(dropsAtReturnCount);   // zero pickup replay across the boundary
    const live2 = (Object.values(rr2.custody as Record<string, any>) as any[]).flatMap((c: any) => c.slots.filter(Boolean).map((st: any) => st.uid));
    expect(new Set(live2).size).toBe(live2.length);                         // unique live UIDs after an independent reload
    expect(live2.filter(u => u === meatDropKeep.uid).concat(live2.filter(u => u === hideDropKeep.uid))).toHaveLength(2);
    // one more real walk on the reloaded run — nothing is re-granted
    let t2 = continue2At;
    const step2 = (inp: Partial<Input>, ms = 50) => { t2 += ms; proc2.sim.tick(restored2, { ...idle(), ...inp }, ms, t2); };
    for (let i = 0; i < 60; i++) step2({ left: true });
    for (let i = 0; i < 60; i++) step2({ right: true });
    expect(countItem(rr2, C(rr2, 'inv').id, 'meat')).toBe(invMeatBefore + 2);
    expect(countItem(rr2, C(rr2, 'inv').id, 'hide')).toBe(invHideBefore + 1);
    expect(rr2.receipts.filter((q: any) => q.kind === 'pickup')).toHaveLength(dropsAtReturnCount);
    expect(again2.report?.sections.world.some((q: any) => /creature.*died while you were away/.test(q.text)) ?? false).toBe(false);   // death still not re-reported
  });
});
