// MEC-01 R3 P2 (adversarial causal-integrity probes): distinct failure modes at the competitive-custody
// boundaries. Each probe races ONE physical resource across two consumers through the PUBLIC intent API.
// FIXTURE (labelled): the player actor is placed beside stations/vehicles (position only); materials are
// granted directly (no loot walk claimed). Engine code is exercised unmodified.
// Provenance note: white-box variants of the UID-reservation race exist in b01-industrial-loot.test.ts
// (a pushed reservation blocks a recycle); these probes drive the real dispatch path instead.
import { describe, it, expect, afterEach } from 'vitest';
import { TILE, WW, BAL, type GameState, type RunState } from '../src/game/core';
import { T } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, newGame, stepStations, effTile, sourceAt } from '../src/game/engine';
import { setActiveLayout, getWorld } from '../src/game/world';
import { vehicleClear } from '../src/game/motorbike';

const T0 = Date.UTC(2026, 10, 8);
let n = 0;
const act = (g: GameState, type: string, p: object = {}, now: number = T0) => dispatch(g, { id: `r3p2-${++n}`, type, ...p }, now);
function fresh(): GameState {
  setActiveLayout('shipping_fresh');
  const g = newGame();
  expect(act(g, 'startRun', { character: 'female', seed: 777 }, T0).ok).toBe(true);
  g.run!.creatures = [];
  markDirty();
  return g;
}
function place(r: RunState, tx: number, ty: number) { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); }
// World-wide scan for 5x5 grass/meadow patches free of live sources, far from POIs (mirrors soh.test.ts buildSpot
// and the engine's own stock>0 build blocker). No engine build calls in the scan — build() is the final arbiter.
function openSpots(g: GameState, count: number, spread = true): [number, number][] {
  const w = getWorld('shipping_fresh'); const r = g.run!; const spots: [number, number][] = [];
  for (let ty = 20; ty < 180 && spots.length < count; ty++) for (let tx = 20; tx < 180 && spots.length < count; tx++) {
    if (w.places.some(p => Math.hypot(p.tx - tx, p.ty - ty) < 14)) continue;
    if (spread && spots.some(([sx, sy]) => Math.abs(sx - tx) < 6 && Math.abs(sy - ty) < 6)) continue;
    let ok = true;
    for (let y = ty - 2; y <= ty + 2 && ok; y++) for (let x = tx - 2; x <= tx + 2 && ok; x++) {
      const t = effTile(r, x, y); if (![T.GRASS, T.MEADOW].includes(t)) ok = false;
      else { const src = sourceAt(r, x, y); if (src && src.stock > 0) ok = false; }
    }
    if (ok) spots.push([tx, ty]);
  }
  if (spots.length < count) throw new Error('not enough open ground');
  return spots;
}
function buildL2Bench(g: GameState, spot: [number, number], at = T0 + 20) {
  const r = g.run!;
  place(r, spot[0] - 1, spot[1]);
  const built = act(g, 'build', { struct: 'workbench', tx: spot[0], ty: spot[1] }, at);
  if (!built.ok) console.log('BUILD-REASON@' + spot[0] + ',' + spot[1] + ': ' + (built as any).reason);
  expect(built.ok).toBe(true);
  const bench = Object.values(r.entities).find(e => e.kind === 'struct' && e.type === 'workbench' && e.tx === spot[0] && e.ty === spot[1])!;
  expect(act(g, 'upgradeStation', { eid: bench.id }, at + 1).ok).toBe(true);
  expect(bench.station!.level).toBe(2);
  return bench;
}
function line(g: GameState) { const r = g.run!, w = getWorld(r.layoutId); for (let y = 2; y < 198; y++) for (let x = 3; x < 194; x++) { let yes = true; for (let d = -1; d <= 4; d++) { const px = (x + d) * TILE + 8, py = y * TILE + 8; if (!w.economyMap.road[y * WW + x + d] || !vehicleClear(r, px, py)) { yes = false; break; } } if (yes) return { x: x * TILE + 8, y: y * TILE + 8 }; } throw new Error('no road line'); }
/** Every UID that exists anywhere: custody containers (incl. vehicle/bag custody) + station job reservations. */
function allUidsEverywhere(g: GameState): string[] {
  const r = g.run!; const uids: string[] = [];
  for (const c of Object.values(r.custody)) for (const s of c.slots) if (s) uids.push(s.uid);
  for (const e of Object.values(r.entities)) for (const j of e.station?.queue ?? []) for (const s of j.reserved ?? []) uids.push(s.uid);
  return uids;
}
/** Count stack instances of a key in player custody (inv+eq) + station reservations — NOT world/loot stashes. */
function stacksOf(g: GameState, key: string): string[] {
  const r = g.run!; const out: string[] = [];
  for (const cid of ['inv', 'eq']) for (const s of C(r, cid).slots) if (s?.key === key) out.push(s.uid);
  for (const e of Object.values(r.entities)) for (const j of e.station?.queue ?? []) for (const s of j.reserved ?? []) if (s.key === key) out.push(s.uid);
  return out;
}
afterEach(() => setActiveLayout('shipping'));

describe('R3 P2: one physical item cannot serve two consumers', () => {
  it('two L2 workbenches race a single found Mechanical Gear; the loser is refused before any reservation, and the gear exists exactly once afterwards', () => {
    const g = fresh(); const r = g.run!;
    addItem(r, 'inv', 'mechanical_gear', 1); addItem(r, 'inv', 'iron_pick', 1); addItem(r, 'inv', 'iron_ingot', 1);
    addItem(r, 'inv', 'fasteners', 2); addItem(r, 'inv', 'spares', 4); addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20); addItem(r, 'inv', 'mechanical_parts', 4); addItem(r, 'inv', 'iron_ingot', 3);   // FIXTURE grants (no loot walk claimed)
    const [spotA, spotB] = openSpots(g, 2); const benchA = buildL2Bench(g, spotA); const benchB = buildL2Bench(g, spotB, T0 + 22);
    place(r, benchA.tx! - 1, benchA.ty!);
    expect(act(g, 'craft', { eid: benchA.id, recipe: 'vehicle_drive_geared' }, T0 + 30).ok).toBe(true);   // winner keeps the gear
    place(r, benchB.tx! - 1, benchB.ty!);
    const loser = act(g, 'craft', { eid: benchB.id, recipe: 'industrial_pick_geared' }, T0 + 31);
    expect(loser.ok).toBe(false);                                     // insufficient mechanical_gear — refused before queueing
    expect((loser as any).reason).toMatch(/Missing/);
    expect(stacksOf(g, 'mechanical_gear')).toHaveLength(1);            // exactly one instance, held as the winner's reservation
    expect(benchB.station!.queue).toHaveLength(0);
    stepStations(g, 22_500, T0 + 60_000);
    expect(countItem(r, benchA.station!.outC!, 'vehicle_drive')).toBe(1);
    expect(countItem(r, 'inv', 'vehicle_drive')).toBe(0);          // the drive sits in the station output, not the pack
    const uids = allUidsEverywhere(g); expect(new Set(uids).size).toBe(uids.length);          // no UID minted twice
  });

  it('recycler holds the gear: the workbench is refused; and the winner held through a full craft→settle leaves the gear exactly once', () => {
    const g = fresh(); const r = g.run!;
    addItem(r, 'inv', 'mechanical_gear', 1); addItem(r, 'inv', 'iron_ingot', 3); addItem(r, 'inv', 'fasteners', 2); addItem(r, 'inv', 'spares', 2); addItem(r, 'inv', 'wood', 40); addItem(r, 'inv', 'stone', 20); addItem(r, 'inv', 'mechanical_parts', 2);   // FIXTURE grants
    const [spot] = openSpots(g, 1); const bench = buildL2Bench(g, spot);
    const rc = Object.values(r.entities).find(e => e.kind === 'recycler')!;
    place(r, rc.tx! - 1, rc.ty!);
    const slot = r.custody.inv.slots.findIndex(s => s?.key === 'mechanical_gear'); expect(slot).toBeGreaterThanOrEqual(0);
    const uid = r.custody.inv.slots[slot]!.uid;
    expect(act(g, 'recycleItem', { eid: rc.id, slot, uid }, T0 + 10).ok).toBe(true);           // recycler wins the gear
    place(r, bench.tx! - 1, bench.ty!);
    const craft = act(g, 'craft', { eid: bench.id, recipe: 'vehicle_drive_geared' }, T0 + 11);
    expect(craft.ok).toBe(false);                                     // the reserved gear is not available to the bench
    expect((craft as any).reason).toMatch(/Missing/);
    expect(stacksOf(g, 'mechanical_gear')).toHaveLength(1);            // one instance, inside the recycler job
    expect(rc.station!.queue[0].reserved![0].uid).toBe(uid);
    stepStations(g, 15_500, T0 + 25_000);                              // recycler v4 gear cycle = 15 s
    const uids = allUidsEverywhere(g); expect(new Set(uids).size).toBe(uids.length);          // conservation held through completion
    expect(countItem(r, bench.station!.outC!, 'vehicle_drive')).toBe(0);                       // nothing was crafted from thin air
  });

  it('one Fuel Canister can serve one motorbike refuel only: a second dispatch is refused, the tank holds exactly one can and the pack is never negative', () => {
    const g = fresh(); const r = g.run!;
    const q = line(g); r.player.x = q.x - TILE; r.player.y = q.y; markDirty();
    addItem(r, 'inv', 'motorbike_kit', 1);
    expect(act(g, 'placeMotorbike', q, T0 + 5).ok).toBe(true);
    const bike = Object.values(r.entities).find(e => e.kind === 'vehicle')!;
    addItem(r, 'inv', 'fuel_can', 1);                                                            // one canister, FIXTURE grant
    r.player.x = bike.x; r.player.y = bike.y; markDirty();
    const fuelBefore = bike.vehicle!.fuel;
    expect(act(g, 'vehicleRefuel', { eid: bike.id }, T0 + 10).ok).toBe(true);
    expect(bike.vehicle!.fuel).toBeCloseTo(fuelBefore + BAL.motorbike.canFuel, 6);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(0);
    const again = act(g, 'vehicleRefuel', { eid: bike.id }, T0 + 11);
    expect(again.ok).toBe(false);                                                                // no canister left — refused, not minted
    expect(bike.vehicle!.fuel).toBeCloseTo(fuelBefore + BAL.motorbike.canFuel, 6);
    expect(countItem(r, 'inv', 'fuel_can')).toBe(0);
    const uids = allUidsEverywhere(g); expect(new Set(uids).size).toBe(uids.length);
  });
});
