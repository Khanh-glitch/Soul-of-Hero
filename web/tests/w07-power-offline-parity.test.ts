// W07 Network A proof: the same powered state must give the same chronological result online and offline.
// Fixtures: a placed base generator, cable, armed arrow turret, powered door (same build helpers as s06-circuits).
import { describe, it, expect } from 'vitest';
import { TILE, WW, T } from '../src/game/core';
import { STRUCTS } from '../src/game/catalog';
import { newGame, dispatch, addItem, countItem, markDirty, powerAllocation, electricDoorPowered } from '../src/game/engine';
import { settle, syncWorld } from '../src/game/sim';
import { getWorld } from '../src/game/world';
import { selectSnapshots, serializeSnapshot } from '../src/game/persist';

const T0 = Date.UTC(2026, 0, 1);
let n = 0;
function setup() {
  const g = newGame(); expect(dispatch(g, { id: 'w07-start' + ++n, type: 'startRun', character: 'female', seed: 97 }, T0).ok).toBe(true);
  const r = g.run!, x = 80, y = 80; r.creatures = [];
  for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 8; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (getWorld().sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
  markDirty();
  const pos = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; };
  const act = (type: string, args: object = {}, now = T0) => dispatch(g, { id: 'w07-' + ++n, type, ...args }, now);
  const build = (type: string, tx: number, ty: number, px = tx, py = ty + 1) => { pos(px, py); for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q); const res = act('build', { struct: type, tx, ty }); expect(res.ok, `${type}: ${(res as any).reason}`).toBe(true); return Object.values(r.entities).find(e => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!; };
  return { g, r, x, y, pos, act, build };
}
/** gen(x) — cable(x+1) — turret(x+2, armed, 2 arrows) ; door(x+1..x+1,y+1..y+2) is a second consumer only when wired. */
function scenario() {
  const o = setup(), { x, y, r } = o;
  const gen = o.build('base_generator', x, y), cable = o.build('power_cable', x + 1, y), turret = o.build('arrow_turret', x + 2, y);
  const turret2 = o.build('arrow_turret', x + 1, y - 1);
  addItem(r, gen.c!, 'wood', 2); addItem(r, turret.c!, 'arrow', 2); addItem(r, turret2.c!, 'arrow', 2);
  // Disclosed fixture: capacity 2 is the state produced by the existing generator reinforcement upgrade.
  gen.basePower!.capacity = 2;
  for (const t of [turret, turret2]) {
    o.pos(t.tx!, t.ty! + 1); expect(o.act('turretConfigure', { eid: t.id, field: 'generatorId', value: gen.id }).ok).toBe(true);
    expect(o.act('turretConfigure', { eid: t.id, field: 'enabled', value: true }).ok).toBe(true);
  }
  o.pos(x, y + 1); expect(o.act('basePower', { eid: gen.id, enabled: true }).ok).toBe(true);
  return { ...o, gen, turret, turret2, cable };
}
const project = (g: any, gen: any, turrets: any[]) => { const r = g.run!; return { energy: Math.round(r.entities[gen.id].basePower!.energy), wood: countItem(r, r.entities[gen.id].c!, 'wood'), arrows: turrets.map(t => countItem(r, r.entities[t.id].c!, 'arrow')), allocated: powerAllocation(r, r.entities[gen.id]).map(e => e.id).sort() }; };

describe('W07 Network A: offline power allocation = online allocation', () => {
  it('same armed-turret state: fuel and allocation after 25 s match between 1 s online steps and one offline settlement', () => {
    const o = scenario(); const snapshot = serializeSnapshot(o.g);
    const online = selectSnapshots([snapshot, null]).gs!, offline = selectSnapshots([snapshot, null]).gs!;
    for (let t = 1000; t <= 25000; t += 1000) syncWorld(online, T0 + t);
    settle(offline, T0 + 25000, true);
    const a = project(online, o.gen, [o.turret, o.turret2]);
    const b = project(offline, o.gen, [o.turret, o.turret2]);
    expect(b).toEqual(a);
  });
});

import { mkContainer, addItem as addItemR } from '../src/game/engine';
import type { Entity } from '../src/game/core';
describe('W07 station fuel boundary: Fuel Canisters are never station fuel (offline and online)', () => {
  it('a furnace holding only canisters pauses with its job intact and burns nothing across an offline settlement', () => {
    const o = setup(); const r = o.r, p = r.player;
    const fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 4);
    const e: Entity = { id: 'w07furn', kind: 'struct', type: 'furnace', x: p.x + 16, y: p.y, tx: Math.floor((p.x + 16) / TILE), ty: Math.floor(p.y / TILE), hp: 100, maxHp: 100, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [{ id: 'w07job', recipe: 'iron_ingot', left: 10000, total: 10000, reserved: [] }] } };
    r.entities[e.id] = e; addItemR(r, fuel.id, 'fuel_can', 2); markDirty();
    settle(o.g, T0 + 30000, true);
    expect(countItem(r, fuel.id, 'fuel_can')).toBe(2);
    expect(e.station!.burn).toBe(0);
    expect(e.station!.queue[0].left).toBe(10000);
    expect(countItem(r, out.id, 'iron_ingot')).toBe(0);
  });
});

describe('W07-R truthful return report for standby turret draw', () => {
  it('an armed wired turret with arrows is reported as reserving power while away and not firing', () => {
    const o = scenario();
    const report = settle(o.g, T0 + 25000, false);
    expect(report.some(l => l.includes('was armed on a generator with fuel when you left') && l.includes('engages lawful targets'))).toBe(true);
    expect(o.g.run!.receipts.some(q => q.kind === 'turret.fire')).toBe(false);
  });
  it('a disarmed turret produces no standby line and no draw', () => {
    const o = scenario();
    o.pos(o.x + 2, o.y + 1);
    expect(o.act('turretConfigure', { eid: o.turret.id, field: 'enabled', value: false }).ok).toBe(true);
    o.pos(o.x + 1, o.y); expect(o.act('turretConfigure', { eid: o.turret2.id, field: 'enabled', value: false }).ok).toBe(true);
    const report = settle(o.g, T0 + 25000, false);
    expect(report.some(l => l.includes('was armed on a generator'))).toBe(false);
    expect(o.g.run!.entities[o.gen.id].basePower!.energy).toBe(Math.max(0, 40000 - 25000));
  });
});
