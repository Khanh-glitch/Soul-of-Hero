// B04-P4: adversarial cache identity, IR downstream network scoping, live bear-trap contact through tick().
import { describe, it, expect } from 'vitest';
import { TILE, WW, T, type GameState } from '../src/game/core';
import { STRUCTS } from '../src/game/catalog';
import { newGame, dispatch, addItem, countItem, blockGrid, markDirty, electricDoorPowered, irSensorDownstream, irSensorVisual, mkCreature, mkContainer, stepStations } from '../src/game/engine';
import { tick } from '../src/game/sim';
import { getWorld } from '../src/game/world';
import { serializeSnapshot, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 0, 1);
let n = 0;
const act = (g: GameState, type: string, data: object = {}, now = T0) => dispatch(g, { id: `p4-${type}-${++n}`, type, ...data }, now);
const raw = (g: GameState) => JSON.parse(JSON.parse(serializeSnapshot(g)).payload);

function setup(seed = 97) {
  const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed }, T0).ok).toBe(true);
  const r = g.run!, x = 80, y = 80; r.creatures = [];
  for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 6; xx <= x + 8; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (getWorld().sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
  markDirty();
  const pos = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
  const build = (type: string, tx: number, ty: number, px = tx, py = ty + 1) => {
    pos(px, py); for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q);
    expect(act(g, 'build', { struct: type, tx, ty }).ok, type).toBe(true);
    return Object.values(r.entities).find(e => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!;
  };
  return { g, r, x, y, pos, build };
}

describe('B04-P4 P1 collision cache identity (A->B->A, same run id)', () => {
  it('a copied run with the same id never reuses the other copy collision grid; restoring A restores A', () => {
    const o = setup(), { g, r, x, y } = o;
    const wallTile = { tx: x + 3, ty: y };
    o.build('wall_wood', wallTile.tx, wallTile.ty);
    const i = wallTile.ty * WW + wallTile.tx;
    const A = r;
    expect(blockGrid(A)[i]).toBe(3);                 // A: wall occupies the tile
    const B = validate(raw(g))!.run!;                // same id, built from a snapshot copy...
    expect(B.id).toBe(A.id); expect(B).not.toBe(A);
    for (const e of Object.values(B.entities)) if (e.tx === wallTile.tx && e.ty === wallTile.ty) delete B.entities[e.id]; // ...with the wall removed
    markDirty();
    expect(blockGrid(B)[i]).not.toBe(3);             // B: the tile is free
    expect(blockGrid(A)[i]).toBe(3);                 // A again: must NOT inherit B's free tile
    expect(blockGrid(B)[i]).not.toBe(3);
    void x;
  });
});

describe('B04-P4 F1 IR downstream is scoped to the sensor own generator network', () => {
  it('a powered door on a different generator is not reported as powered by this sensor', () => {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
    const r = g.run!, x = 80, y = 80; r.creatures = [];
    for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 6; xx <= x + 8; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (getWorld().sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
    markDirty();
    const pos = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
    const build = (type: string, tx: number, ty: number, px = tx, py = ty + 1) => { pos(px, py); for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q); const res = act(g, 'build', { struct: type, tx, ty }); expect(res.ok, `${type}: ${(res as any).reason}`).toBe(true); return Object.values(r.entities).find(e => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!; };
    // network A: generator -> cable -> sensor -> door
    const genA = build('base_generator', x, y), cableA = build('power_cable', x + 1, y), sensor = build('ir_sensor', x + 2, y), doorA = build('door_powered', x + 3, y, x + 4, y);
    genA.basePower!.capacity = 2; addItem(r, genA.c!, 'wood', 2); pos(x, y + 1); expect(act(g, 'basePower', { eid: genA.id, enabled: true }).ok).toBe(true);
    pos(x + 2, y + 1); expect(act(g, 'irSensorToggle', { eid: sensor.id }).ok).toBe(true);
    pos(x + 2, y + 2);                                   // IR needs a visible target in range (B02 law)
    expect(electricDoorPowered(r, doorA)).toBe(true);
    expect(irSensorDownstream(r, sensor)).toBe(', powers 1 door');
    // network B: an unrelated generator + door elsewhere in the same run, also powered
    const genB = build('base_generator', x - 5, y - 3), cableB = build('power_cable', x - 4, y - 3), doorB = build('door_powered', x - 3, y - 3, x - 2, y - 3);
    genB.basePower!.capacity = 2; addItem(r, genB.c!, 'wood', 2); pos(x - 5, y - 2); expect(act(g, 'basePower', { eid: genB.id, enabled: true }).ok).toBe(true);
    expect(electricDoorPowered(r, doorB)).toBe(true);
    pos(x + 2, y + 2);
    // Before F1 this read ', powers 2 doors': the sensor on A must still report exactly its own network.
    expect(irSensorDownstream(r, sensor)).toBe(', powers 1 door');
    void cableA; void cableB;
  });
});

describe('B04-P4 live bear trap contact through the real tick() loop', () => {
  it('an eligible creature physically on an armed trap is hit once in tick(); spent traps do not re-fire', () => {
    const o = setup(), { g, r, x, y, pos, build } = o;
    const trap = build('bear_trap', x + 2, y);
    pos(x + 2, y + 1); addItem(r, 'inv', 'iron_plate', 1);
    expect(act(g, 'bearTrapSet', { eid: trap.id }).ok).toBe(true);
    expect(trap.bearTrap).toMatchObject({ version: 'trap-v1', state: 'armed', uses: 3 });
    const plates = () => (r.custody.inv.slots.filter(s => s?.key === 'iron_plate').reduce((a, s) => a + s!.qty, 0));
    const plateBefore = plates();
    pos(x + 2, y + 1);                                   // player stays in the active area, beside the trap
    const m = mkCreature(r, 'wolf', (x + 2) * TILE + 8, y * TILE + 8, 40); m.state = 'idle'; m.cd = 0; r.creatures.push(m);
    const inp: any = { up: false, down: false, left: false, right: false, attackPressed: false, roll: false, cancel: false, mx: 0, my: 0, interact: false, sprint: false };
    const hp0 = m.hp;
    tick(g, inp, 50, T0 + 1000);
    expect(m.hp).toBeLessThan(hp0);                      // live contact: real damage in the live loop
    expect(trap.bearTrap).toMatchObject({ version: 'trap-v1', state: 'spent', uses: 2 });
    expect(trap.bearTrap!.snapAt).toBe(T0 + 1000);       // the spring-snap cue timestamp comes from the live hit
    expect(plates()).toBe(plateBefore);                  // contact costs no plates; the trap spends a use
    const hpAfterHit = m.hp;
    for (let k = 0; k < 40; k++) tick(g, inp, 50, T0 + 1050 + k * 50);
    expect(trap.bearTrap!.uses).toBe(2);                 // spent: no second hit from the same trap
    expect(m.hp).toBe(hpAfterHit);                       // no further trap damage while spent
  });
});

describe('B04-P4 IR sensor visual state mirrors the prompt rule (sprite key source)', () => {
  it('off -> unpowered (no fuel) -> ready -> detecting; wall in line -> blocked', () => {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
    const r = g.run!, x = 80, y = 80; r.creatures = [];
    for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 6; xx <= x + 8; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (getWorld().sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
    markDirty();
    const pos = (tx: number, ty: number) => { r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty(); };
    const build = (type: string, tx: number, ty: number, px = tx, py = ty + 1) => { pos(px, py); for (const [k, q] of STRUCTS[type].cost) addItem(r, 'inv', k, q); expect(act(g, 'build', { struct: type, tx, ty }).ok, type).toBe(true); return Object.values(r.entities).find(e => e.kind === 'struct' && e.tx === tx && e.ty === ty && e.type === type)!; };
    const gen = build('base_generator', x, y), cable = build('power_cable', x + 1, y), sensor = build('ir_sensor', x + 2, y), door = build('door_powered', x + 3, y, x + 4, y);
    void door; void cable;
    expect(irSensorVisual(r, sensor)).toBe('off');
    gen.basePower!.capacity = 2; pos(x, y + 1);
    expect(act(g, 'basePower', { eid: gen.id, enabled: true }).ok).toBe(true);
    pos(x + 2, y + 1); expect(act(g, 'irSensorToggle', { eid: sensor.id }).ok).toBe(true);
    expect(irSensorVisual(r, sensor)).toBe('unpowered');          // generator on but no fuel: the sprite must not claim detection
    addItem(r, gen.c!, 'wood', 2);
    pos(x + 2, y + 2);
    expect(irSensorVisual(r, sensor)).toBe('detect');             // fuelled, target in clear line
    // a wall in the line of sight to a player beyond it
    build('wall_wood', x + 3, y + 2, x + 3, y + 4);
    pos(x + 5, y + 2);
    expect(irSensorVisual(r, sensor)).toBe('blocked');
    pos(x + 2, y + 2);
    expect(irSensorVisual(r, sensor)).toBe('detect');
  });
});

import { RECIPES, ITEMS } from '../src/game/catalog';
describe('B04-P4 Metal Pipe at the physical Foundry Recycler (X:pipe-v3 for new jobs)', () => {
  function recyclerRun() {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
    const r = g.run!, tx = 80, ty = 80;
    const fuel = mkContainer(r, 'fuel', 0), out = mkContainer(r, 'out', 4);
    const id = 'p4-recycler';
    r.entities[id] = { id, kind: 'recycler', x: tx * TILE + 8, y: ty * TILE + 8, tx, ty, station: { queue: [], burn: 0, fuelC: fuel.id, outC: out.id } } as any;
    r.player.x = tx * TILE + 8; r.player.y = ty * TILE + 8; markDirty();
    return { g, r, id, out };
  }
  it('one carried pipe is consumed at the Recycler, returns one ingot after real time, and a split stack is refused', () => {
    const { g, r, id, out } = recyclerRun();
    expect(RECIPES.pipe_recycle).toBeUndefined();                  // the workbench duplicate route is removed
    addItem(r, 'inv', 'metal_pipe', 2);
    const slot = r.custody.inv.slots.findIndex(s => s?.key === 'metal_pipe'); const uid = r.custody.inv.slots[slot]!.uid;
    const stacked = dispatch(g, { id: 'p4-rc-stack-' + ++n, type: 'recycleItem', eid: id, slot, uid }, T0);
    expect(stacked.ok).toBe(false); expect((stacked as any).reason).toContain('Split one Metal Pipe');
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(2);             // refusal consumes nothing
    expect(dispatch(g, { id: 'p4-split-' + ++n, type: 'split', c: 'inv', slot }, T0).ok).toBe(true);   // the real Split: 2 -> 1 + 1
    const one = r.custody.inv.slots.findIndex(s => s?.key === 'metal_pipe' && s.qty === 1);
    const ok = dispatch(g, { id: 'p4-rc-' + ++n, type: 'recycleItem', eid: id, slot: one, uid: r.custody.inv.slots[one]!.uid }, T0);
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    expect(countItem(r, 'inv', 'metal_pipe')).toBe(1);             // exactly one pipe left the carried inventory (2 -> 1)
    const job = r.entities[id].station!.queue[0];
    // PA1 R1: new pipe jobs use X:pipe-v3 (the recovered paper return: 1 ingot in 10 s). v1/v2 stay
    // frozen for jobs a save already holds — v2's extra Mechanical Part became an over-return the
    // moment a craft began yielding two sections, so it can no longer be selected for a new job.
    expect(job.recipe).toBe('X:pipe-v3'); expect(job.reserved?.length).toBe(1);
    stepStations(g, 9000, T0 + 9000);
    expect(countItem(r, out.id, 'refined_iron_ingot')).toBe(0);    // not finished before the real 10 s
    stepStations(g, 1500, T0 + 10500);
    expect(countItem(r, out.id, 'refined_iron_ingot')).toBe(1);    // one ingot back: a net loss against the 2 ingots + 1 part that made the pair
    expect(countItem(r, out.id, 'mechanical_parts')).toBe(0);
    expect(r.entities[id].station!.queue.length).toBe(0);
  });
  it('a full output blocks the job without losing the reserved pipe; cancel returns that same UID', () => {
    const { g, r, id, out } = recyclerRun();
    addItem(r, 'inv', 'metal_pipe', 1);
    const slot = r.custody.inv.slots.findIndex(s => s?.key === 'metal_pipe'); const uid = r.custody.inv.slots[slot]!.uid;
    expect(dispatch(g, { id: 'p4-rc2-' + ++n, type: 'recycleItem', eid: id, slot, uid }, T0).ok).toBe(true);
    const job = r.entities[id].station!.queue[0];
    const jobId = job.id;
    const c = dispatch(g, { id: 'p4-rc2c-' + ++n, type: 'cancelJob', eid: id, jobId }, T0 + 1000);
    expect(c.ok, JSON.stringify(c)).toBe(true);
    expect(r.entities[id].station!.queue.length).toBe(0);
    const back = r.custody.inv.slots.filter(s => s?.key === 'metal_pipe');
    expect(back.length).toBe(1); expect(back[0]!.uid).toBe(uid);  // the same physical pipe, not a second copy
    expect(countItem(r, out.id, 'refined_iron_ingot')).toBe(0);
  });
});

import { validate as validateSave } from '../src/game/persist';
describe('B04-P4 snapAt persistence: optional and bounded (older saves stay valid)', () => {
  it('a trap without snapAt validates; a malformed snapAt is rejected at save-validation time', () => {
    const g = newGame(); expect(act(g, 'startRun', { character: 'female', seed: 97 }, T0).ok).toBe(true);
    const r = g.run!, x = 80, y = 80, w = getWorld();
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 12; xx++) { const i = yy * WW + xx; r.terrain[i] = { t: T.GRASS }; if (w.sourceV3[i]) r.sources[i] = { stock: 0, hp: 0 }; }
    markDirty();
    r.player.x = (x + 1) * TILE + 8; r.player.y = (y + 1) * TILE + 8; markDirty();
    for (const [k, q] of STRUCTS.bear_trap.cost) addItem(r, 'inv', k, q);
    expect(act(g, 'build', { struct: 'bear_trap', tx: x + 2, ty: y }).ok).toBe(true);
    const t = Object.values(r.entities).find(e => e.type === 'bear_trap')!;
    t.bearTrap = { version: 'trap-v1', state: 'unarmed', uses: 3 } as any;
    expect(validateSave(JSON.parse(JSON.stringify(g)))).not.toBeNull();                       // older shape, no snapAt
    (t.bearTrap as any).snapAt = 1.5;
    expect(validateSave(JSON.parse(JSON.stringify(g)))).toBeNull();                           // non-integer timestamp refused
    (t.bearTrap as any).snapAt = -4;
    expect(validateSave(JSON.parse(JSON.stringify(g)))).toBeNull();                           // negative refused
    (t.bearTrap as any).snapAt = T0;
    expect(validateSave(JSON.parse(JSON.stringify(g)))).not.toBeNull();                       // a whole, non-negative stamp is kept
  });
});
