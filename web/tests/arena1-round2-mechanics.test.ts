// ARENA 1 round 2 — the mechanics that turned BLOCKED items into things the engine can do.
//
// Engine scenarios through the real intents (`dispatch`), the real movement/damage step and the real save
// loader. NOT a browser play-through. Fixtures are labelled where they are used: a station placed beside
// the player (position and ownership only), `give()` of packed inputs, and one cliff tile written into the
// run terrain. Nothing here is evidence for PLAYABLE; the New-Game route proofs are a separate file.
import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, STRUCTS, EQ_SLOTS, ARMOR_CAP, wornProtection, LADDER_SPAN, LARGE_FURNACE, MODULE_PENDING_STRUCTURES, BUILD_ORDER, validateGameplayCatalog } from '../src/game/catalog';
import { BAL, T, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, dispatch, markDirty, mkContainer, newGame, startRun, stepStations, blockGrid, buildReason, ensureOilSeeps, authorizedOilSource, oilAvailability, anyAuthorizedOilSource, ladderTiles, effTile } from '../src/game/engine';
import { hurtPlayer, tick } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
import { getWorld, setActiveLayout } from '../src/game/world';
import { U05_WORLD_LAYOUT_ID } from '../src/veyra05/scenes';
import { OIL_SEEP_AUTHORITY, SEEP_CELL, seepCandidate } from '../src/game/oil-seeps';
import { windowOrigin } from '../src/veyra05/continuity';

const T0 = Date.UTC(2026, 10, 14, 12); let seq = 0;
/** One monotonic clock for every intent, tick and station step in this file. */
let clk = T0 + 10; const at = (ms = 1000) => (clk += ms);
const act = (gs: GameState, type: string, p: object = {}, now?: number) => dispatch(gs, { id: 'r2-' + (++seq), type, ...p } as any, now ?? at());
function veyraRun(seed = 7) {
  expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
  const gs = newGame(); const rc = startRun(gs, 'male', T0, null, seed); expect(rc.ok, JSON.stringify(rc)).toBe(true);
  gs.run!.creatures = []; return gs;
}
const give = (gs: GameState, key: string, qty = 1, extra?: object) => { expect(addItem(gs.run!, 'inv', key, qty, extra as any), key).toBe(0); };
const inv = (gs: GameState, key: string) => countItem(gs.run!, 'inv', key);
const slotOf = (gs: GameState, key: string) => C(gs.run!, 'inv').slots.findIndex(s => s?.key === key);
const ptile = (gs: GameState): [number, number] => [Math.floor(gs.run!.player.x / TILE), Math.floor(gs.run!.player.y / TILE)];
/** FIXTURE: a station beside the player. Position/ownership only. */
function station(gs: GameState, type: string, dx: number, dy: number, level?: number): Entity {
  const r = gs.run!, [px, py] = ptile(gs), fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
  const e: Entity = { id: 'r2-st-' + (++seq), kind: 'struct', type, x: (px + dx) * TILE + 8, y: (py + dy) * TILE + 8, tx: px + dx, ty: py + dy, hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [], ...(level ? { level } : {}) } } as any;
  r.entities[e.id] = e; markDirty(); return e;
}
/** Find open ground: `n` free tiles in a row going +x from the returned tile, away from sources and entities. */
function openRow(gs: GameState, n: number): [number, number] {
  const r = gs.run!, g = blockGrid(r), [px, py] = ptile(gs), w = getWorld();
  for (let rad = 0; rad < 40; rad++) for (let ty = py - rad; ty <= py + rad; ty++) for (let tx = px - rad; tx <= px + rad; tx++) {
    if (tx < 4 || ty < 4 || tx + n >= WW - 4 || ty >= WW - 4) continue; let ok = true;
    for (let k = -1; k <= n && ok; k++) for (let j = -1; j <= 1 && ok; j++) { const i = (ty + j) * WW + tx + k; if (g[i] !== 0 || [T.SHALLOW, T.RIVER, T.DEEP, T.ROAD, T.BRIDGE, T.FLOOR, T.ICE, T.CLIFF, T.PWALL, T.LAVA].includes(effTile(r, tx + k, ty + j)) || !w.economyMap.buildable[i] || w.economyMap.protected[i]) ok = false; }
    if (ok) return [tx, ty];
  }
  throw new Error('no open row');
}
const put = (gs: GameState, tx: number, ty: number) => { gs.run!.player.x = tx * TILE + 8; gs.run!.player.y = ty * TILE + 8; };
const snapshot = (gs: GameState) => JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as GameState;
const NOINPUT: any = { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false };

describe('catalog stays valid with the round-2 rows', () => {
  it('validateGameplayCatalog passes and no structure is left module-pending', () => {
    expect(validateGameplayCatalog()).toBe(true);
    expect(MODULE_PENDING_STRUCTURES).toEqual([]);
    for (const k of ['large_furnace', 'ladder_wood', 'ladder_steel', 'door_powered']) expect(BUILD_ORDER, k).toContain(k);
    for (const id of ['wooden_ladder', 'steel_folding_ladder', 'large_furnace', 'iron_plate_pants', 'iron_plate_boots', 'refined_iron_legs', 'refined_iron_boots']) {
      expect(RECIPES[id], id).toBeTruthy(); expect(RECIPES[id].rev, id).toBe(5);
      for (const [k] of RECIPES[id].ins) expect(ITEMS[k], id + ' <- ' + k).toBeTruthy();
    }
  });
});

describe('legs and feet: two new worn slots that change what a hit does', () => {
  it('equips into slots 3 and 4 through the real use intent and never into another slot', () => {
    const gs = veyraRun(); const r = gs.run!;
    expect(EQ_SLOTS).toEqual(['head', 'body', 'back', 'legs', 'feet']);
    expect(C(r, 'eq').slots).toHaveLength(5);
    give(gs, 'iron_plate_pants'); give(gs, 'refined_iron_boots');
    expect(act(gs, 'useItem', { c: 'inv', slot: slotOf(gs, 'iron_plate_pants') }).ok).toBe(true);
    expect(act(gs, 'useItem', { c: 'inv', slot: slotOf(gs, 'refined_iron_boots') }).ok).toBe(true);
    expect(C(r, 'eq').slots.map(s => s?.key ?? null)).toEqual([null, null, null, 'iron_plate_pants', 'refined_iron_boots']);
    // a drag of boots onto the head slot is refused
    give(gs, 'iron_plate_boots');
    const rc = act(gs, 'move', { from: 'inv', fs: slotOf(gs, 'iron_plate_boots'), to: 'eq', ts: 0 });
    expect(rc.ok).toBe(false); expect(C(r, 'eq').slots[0]).toBeNull();
    expect(validate(snapshot(gs))).toBeTruthy();
  });
  it('armour adds up under one cap; leg plates cut knock-back; boots cut ground damage only', () => {
    const p = wornProtection([{ key: 'refined_iron_helmet' }, { key: 'refined_iron_chest' }, null, { key: 'refined_iron_legs' }, { key: 'refined_iron_boots' }] as any);
    expect(p.armor).toBe(ARMOR_CAP); expect(p.steady).toBe(ITEMS.refined_iron_legs.steady); expect(p.ground).toBe(ITEMS.refined_iron_boots.ground);
    const hit = (wear: string[], ground: boolean) => {
      const gs = veyraRun(); const r = gs.run!; const [tx, ty] = openRow(gs, 6); put(gs, tx + 3, ty); markDirty();
      for (const k of wear) { give(gs, k); expect(act(gs, 'useItem', { c: 'inv', slot: slotOf(gs, k) }).ok, k).toBe(true); }
      const hp0 = r.player.hp, x0 = r.player.x;
      expect(hurtPlayer(gs, 20, r.player.x - 40, r.player.y, 'test', at(), 140, ground)).toBeTruthy();
      return { lost: hp0 - r.player.hp, pushed: r.player.x - x0 };
    };
    const bare = hit([], false), legs = hit(['refined_iron_legs'], false), boots = hit(['refined_iron_boots'], false);
    const bareG = hit([], true), bootsG = hit(['refined_iron_boots'], true);
    expect(bare.lost).toBeCloseTo(20, 5);
    expect(Math.abs(legs.lost - 20 * (1 - ITEMS.refined_iron_legs.armor!))).toBeLessThanOrEqual(0.5);
    expect(legs.pushed).toBeGreaterThan(0); expect(legs.pushed).toBeLessThan(bare.pushed);
    expect(legs.pushed / bare.pushed).toBeCloseTo(1 - ITEMS.refined_iron_legs.steady!, 2);
    expect(boots.pushed).toBeCloseTo(bare.pushed, 5);            // boots do nothing for knock-back
    expect(Math.abs(boots.lost - 20 * (1 - ITEMS.refined_iron_boots.armor!))).toBeLessThanOrEqual(0.5);   // damage is whole points
    expect(bareG.lost).toBeCloseTo(20, 5);
    expect(Math.abs(bootsG.lost - 20 * (1 - ITEMS.refined_iron_boots.armor!) * (1 - ITEMS.refined_iron_boots.ground!))).toBeLessThanOrEqual(0.5);
    expect(bootsG.lost).toBeLessThan(boots.lost);
  });
  it('a save written with three worn slots loads with five and loses nothing', () => {
    const gs = veyraRun(); give(gs, 'leather_armor');
    expect(act(gs, 'useItem', { c: 'inv', slot: slotOf(gs, 'leather_armor') }).ok).toBe(true);
    const old = snapshot(gs) as any; const eq = old.run.custody.eq; const worn = eq.slots[1];
    eq.slots = eq.slots.slice(0, 3);
    const loaded = validate(old) as any; expect(loaded).toBeTruthy();
    const after = (loaded.run ?? old.run).custody.eq.slots;
    expect(after).toHaveLength(5); expect(after[1]).toEqual(worn); expect(after[3]).toBeNull(); expect(after[4]).toBeNull();
  });
});

describe('ladders: a foot-only crossing over a cliff', () => {
  /** FIXTURE: `n` cliff tiles written into run terrain east of the player; open ground on both sides. */
  function cliffEast(gs: GameState, n: number) {
    const r = gs.run!; const [tx, ty] = openRow(gs, n + 4); put(gs, tx, ty);
    for (let k = 0; k < n; k++) for (let j = -1; j <= 1; j++) r.terrain[(ty + j) * WW + tx + 2 + k] = { t: T.CLIFF } as any;
    markDirty(); return { tx: tx + 2, ty };
  }
  const walkEast = (gs: GameState, ms: number) => { for (let t = 0; t < ms; t += 50) tick(gs, { ...NOINPUT, right: true }, 50, at(50)); };
  it('a wooden ladder crosses one cliff tile, slowly, and comes back as the same item', () => {
    const gs = veyraRun(); const r = gs.run!; const { tx, ty } = cliffEast(gs, 1);
    expect(blockGrid(r)[ty * WW + tx]).toBe(1);
    walkEast(gs, 1500); expect(Math.floor(r.player.x / TILE)).toBe(tx - 1);            // the cliff stops you
    expect(buildReason(gs, 'ladder_wood', tx, ty)).toMatch(/Missing materials/);
    give(gs, 'wooden_ladder', 1, { dur: ITEMS.wooden_ladder.dur });
    const uid = C(r, 'inv').slots[slotOf(gs, 'wooden_ladder')]!.uid;
    put(gs, tx - 1, ty);
    const rc = act(gs, 'build', { struct: 'ladder_wood', tx, ty }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    expect(inv(gs, 'wooden_ladder')).toBe(0);
    const e = Object.values(r.entities).find(x => x.type === 'ladder_wood')!;
    expect(e.ladder).toEqual({ dir: [1, 0], len: 1 }); expect(ladderTiles(e)).toEqual([ty * WW + tx]);
    expect(blockGrid(r)[ty * WW + tx]).toBe(6);
    expect(validate(snapshot(gs))).toBeTruthy();
    walkEast(gs, 4000); expect(Math.floor(r.player.x / TILE)).toBeGreaterThan(tx);     // across
    // reclaim from the far side: the same stack uid returns
    put(gs, tx + 1, ty);
    const back = act(gs, 'reclaim', { eid: e.id }); expect(back.ok, JSON.stringify(back)).toBe(true);
    expect(C(r, 'inv').slots[slotOf(gs, 'wooden_ladder')]!.uid).toBe(uid);
    expect(blockGrid(r)[ty * WW + tx]).toBe(1);
  });
  it('a wooden ladder refuses a thick cliff; the steel folding ladder spans three tiles', () => {
    const gs = veyraRun(); const r = gs.run!; const { tx, ty } = cliffEast(gs, 3); put(gs, tx - 1, ty);
    give(gs, 'wooden_ladder', 1, { dur: ITEMS.wooden_ladder.dur }); give(gs, 'steel_folding_ladder', 1, { dur: ITEMS.steel_folding_ladder.dur });
    expect(buildReason(gs, 'ladder_wood', tx, ty)).toMatch(/more than one tile thick/);
    expect(buildReason(gs, 'ladder_steel', tx + 1, ty)).toMatch(/right next to the cliff/);
    expect(buildReason(gs, 'ladder_steel', tx - 3, ty)).toMatch(/right next to|cliff face/);
    expect(act(gs, 'build', { struct: 'ladder_steel', tx, ty }).ok).toBe(true);
    const e = Object.values(r.entities).find(x => x.type === 'ladder_steel')!;
    expect(e.ladder!.len).toBe(3); expect(LADDER_SPAN.ladder_steel).toBe(3);
    for (let k = 0; k < 3; k++) expect(blockGrid(r)[ty * WW + tx + k]).toBe(6);
    expect(blockGrid(r)[(ty + 1) * WW + tx]).toBe(1);                                   // only the ladder line opens
    walkEast(gs, 9000); expect(Math.floor(r.player.x / TILE)).toBeGreaterThan(tx + 2);
    // standing on it, you cannot fold it under yourself
    put(gs, tx + 1, ty); expect(act(gs, 'reclaim', { eid: e.id }).ok).toBe(false);
  });
});

describe('Large Furnace: same formulas, twice the pace, half the fuel per load', () => {
  it('finishes a smelt in half the time and burns half the fuel a Furnace does', () => {
    const run = (type: 'furnace' | 'large_furnace') => {
      const gs = veyraRun(); const r = gs.run!; const [tx, ty] = openRow(gs, 5); put(gs, tx + 1, ty);
      let e: Entity;
      if (type === 'furnace') e = station(gs, 'furnace', 1, 0);
      else { give(gs, 'large_furnace', 1, { dur: ITEMS.large_furnace.dur }); const rc = act(gs, 'build', { struct: 'large_furnace', tx: tx + 3, ty }); expect(rc.ok, JSON.stringify(rc)).toBe(true); e = Object.values(r.entities).find(x => x.type === 'large_furnace')!; }
      const rid = 'iron_ingot'; const rc0 = RECIPES[rid]; expect(rc0.station).toBe('furnace');
      for (const [k, q] of rc0.ins) give(gs, k, q * 2);
      addItem(r, e.station!.fuelC, 'wood', 10);
      const fuelBefore = countItem(r, e.station!.fuelC, 'wood');
      expect(act(gs, 'craft', { eid: e.id, recipe: rid }).ok).toBe(true);
      const half = rc0.secs * 1000 / 2 + 200;
      stepStations(gs, half, at(half));
      const doneAtHalf = countItem(r, e.station!.outC, rc0.out) >= rc0.qty;
      stepStations(gs, half, at(half));
      expect(countItem(r, e.station!.outC, rc0.out)).toBeGreaterThanOrEqual(rc0.qty);
      const burnt = (fuelBefore - countItem(r, e.station!.fuelC, 'wood')) * ITEMS.wood.fuel! * 1000 - e.station!.burn;
      return { doneAtHalf, burnt, out: C(r, e.station!.outC).slots.length, gs };
    };
    const small = run('furnace'), big = run('large_furnace');
    expect(small.doneAtHalf).toBe(false); expect(big.doneAtHalf).toBe(true);
    expect(big.burnt).toBeCloseTo(small.burnt / LARGE_FURNACE.speed, -1);
    expect(big.out).toBe(LARGE_FURNACE.outSlots); expect(small.out).toBe(6);
    expect(validate(snapshot(big.gs))).toBeTruthy();
  });
});

describe('Powered Door: a lock module fitted into a door you own', () => {
  it('is refused on bare ground, converts an owned door in place, consumes Resistor Wire, and comes out again', () => {
    const gs = veyraRun(); const r = gs.run!; const [tx, ty] = openRow(gs, 5); put(gs, tx + 1, ty);
    for (const [k, q] of STRUCTS.door_powered.cost) give(gs, k, q);
    expect(STRUCTS.door_powered.cost.some(([k]) => k === 'electric_resistor')).toBe(true);
    expect(buildReason(gs, 'door_powered', tx + 3, ty)).toMatch(/Wooden or Iron Door/);
    for (const [k, q] of STRUCTS.door_wood.cost) give(gs, k, q);
    for (const [k, q] of STRUCTS.wall_doorframe_wood.cost) give(gs, k, q);
    const dw = act(gs, 'build', { struct: 'door_wood', tx: tx + 3, ty }); expect(dw.ok, JSON.stringify(dw)).toBe(true);
    const door = Object.values(r.entities).find(x => x.type === 'door_wood')!; door.hp = Math.floor(door.maxHp! / 2);
    const n0 = Object.keys(r.entities).length;
    const rc = act(gs, 'build', { struct: 'door_powered', tx: tx + 3, ty }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    expect(Object.keys(r.entities).length).toBe(n0);                                  // same entity, no second wall
    expect(door.type).toBe('door_powered'); expect(door.poweredHost).toBe('door_wood');
    expect(door.electricDoor!.interior).toEqual([1, 0]);                              // fitted from the west: the east side is inside
    expect(door.hp! / door.maxHp!).toBeCloseTo(0.5, 1);
    expect(inv(gs, 'electric_resistor')).toBe(0);
    expect(validate(snapshot(gs))).toBeTruthy();
    // outside, with no generator: refused. This is the mechanic the item exists for.
    const open = act(gs, 'door', { eid: door.id }); expect(open.ok).toBe(false); expect(open.reason ?? open.message ?? JSON.stringify(open)).toMatch(/power/i);
    const out = act(gs, 'reclaim', { eid: door.id }); expect(out.ok, JSON.stringify(out)).toBe(true);
    expect(door.type).toBe('door_wood'); expect(door.electricDoor).toBeUndefined(); expect(r.entities[door.id]).toBe(door);
    expect(inv(gs, 'electric_resistor')).toBe(Math.floor(2 * BAL.economy.reclaimRefund));
  });
});

describe('crude seep -> Oil Pump -> Oil Refinery -> Fuel Canister, on the Veyra map with no test fixture', () => {
  it('the seep rule is a pure function of global cells and about half the cells aim at a seep', () => {
    let n = 0; for (let cy = 0; cy < 40; cy++) for (let cx = 0; cx < 60; cx++) { const c = seepCandidate(cx, cy); if (!c) continue; n++; expect(Math.floor(c[0] / SEEP_CELL)).toBe(cx); expect(Math.floor(c[1] / SEEP_CELL)).toBe(cy); expect(seepCandidate(cx, cy)).toEqual(c); }
    expect(n / 2400).toBeGreaterThan(1 / BAL.oilPumpV1.seepOneInCells - 0.1); expect(n / 2400).toBeLessThan(1 / BAL.oilPumpV1.seepOneInCells + 0.1);
  });
  it('a new run has seeps in its window; a pump on one draws it down; the refinery turns crude into fuel', () => {
    const gs = veyraRun(11); const r = gs.run!;
    expect(r.oilTestFixture).toBeUndefined();
    ensureOilSeeps(r);
    const seeps = Object.values(r.oilSources ?? {}); expect(seeps.length).toBeGreaterThan(0);
    for (const s of seeps) { expect(s.authority).toBe(OIL_SEEP_AUTHORITY); expect(s.stock).toBe(BAL.oilPumpV1.seepStock); expect(blockGrid(r)[s.ty * WW + s.tx]).toBe(0); }
    expect(anyAuthorizedOilSource(r)).toBe(true); expect(oilAvailability(r)).toBe('SITE_ELSEWHERE');
    const [ox, oy] = windowOrigin(r);
    const s = seeps.slice().sort((a, b) => Math.hypot(a.tx * TILE - r.player.x, a.ty * TILE - r.player.y) - Math.hypot(b.tx * TILE - r.player.x, b.ty * TILE - r.player.y))[0];
    // FIXTURE: the player is put beside the seep (the walk is not simulated) with a level-2 workbench next to them.
    put(gs, s.tx - 1, s.ty); markDirty();
    station(gs, 'workbench', 0, -1, 2);
    give(gs, 'deploy_oil_pump', 1, { dur: STRUCTS.oil_pump.hp });
    expect(buildReason(gs, 'oil_pump', s.tx, s.ty - 1)).toMatch(/not an oil site/);
    const rc = act(gs, 'build', { struct: 'oil_pump', tx: s.tx, ty: s.ty }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    const pump = Object.values(r.entities).find(x => x.type === 'oil_pump')!;
    expect(authorizedOilSource(r, s.tx, s.ty)).toBeTruthy(); expect(oilAvailability(r, s.tx, s.ty)).toBe('SITE_HERE');
    addItem(r, pump.station!.fuelC, 'wood', 20);
    for (let k = 0; k < 6; k++) expect(act(gs, 'craft', { eid: pump.id, recipe: 'pump_crude' }).ok, 'cycle ' + k).toBe(true);
    stepStations(gs, 6 * BAL.oilPumpV1.secs * 1000 + 500, at(6 * BAL.oilPumpV1.secs * 1000 + 500));
    expect(countItem(r, pump.station!.outC, 'crude_petroleum')).toBe(6);
    expect(r.oilSources!['oil:' + s.tx + ':' + s.ty].stock).toBe(BAL.oilPumpV1.seepStock - 6);
    const saved = snapshot(gs) as any; expect(validate(saved)).toBeTruthy();
    expect(saved.run.oilSeeps[Math.floor((ox + s.tx) / SEEP_CELL) + ':' + Math.floor((oy + s.ty) / SEEP_CELL)]).toMatchObject({ gx: ox + s.tx, gy: oy + s.ty });
    // a forged seep row (no ledger entry) is refused by the loader
    const forged = JSON.parse(JSON.stringify(saved)); forged.run.oilSources['oil:5:5'] = { tx: 5, ty: 5, stock: 60, authority: OIL_SEEP_AUTHORITY };
    expect(validate(forged)).toBeFalsy();
    // crude -> fuel at a real Oil Refinery placed through the build intent
    const slot = C(r, pump.station!.outC).slots.findIndex(x => x?.key === 'crude_petroleum');
    expect(act(gs, 'move', { from: pump.station!.outC, fs: slot, to: 'inv' }).ok).toBe(true);
    give(gs, 'deploy_refinery', 1, { dur: STRUCTS.refinery.hp });
    const g = blockGrid(r); let spot: [number, number] | null = null;
    for (const [dx, dy] of [[-2, 0], [-1, 1], [-2, 1], [-1, -2], [-2, -1], [0, 1]]) { const x = s.tx - 1 + dx, y = s.ty + dy; if (g[y * WW + x] === 0 && buildReason(gs, 'refinery', x, y) === null) { spot = [x, y]; break; } }
    expect(spot, 'a free tile for the refinery').toBeTruthy();
    expect(act(gs, 'build', { struct: 'refinery', tx: spot![0], ty: spot![1] }).ok).toBe(true);
    const ref = Object.values(r.entities).find(x => x.type === 'refinery')!;
    give(gs, 'glass', 2); addItem(r, ref.station!.fuelC, 'wood', 20);
    const need = RECIPES.refinery_fuel.ins.find(([k]) => k === 'crude_petroleum')![1];
    expect(inv(gs, 'crude_petroleum')).toBeGreaterThanOrEqual(need);
    const cr = act(gs, 'craft', { eid: ref.id, recipe: 'refinery_fuel' }); expect(cr.ok, JSON.stringify(cr)).toBe(true);
    stepStations(gs, RECIPES.refinery_fuel.secs * 1000 + 500, at(RECIPES.refinery_fuel.secs * 1000 + 500));
    expect(countItem(r, ref.station!.outC, 'fuel_can')).toBe(RECIPES.refinery_fuel.qty);
    expect(inv(gs, 'crude_petroleum')).toBe(6 - need);
    expect(validate(snapshot(gs))).toBeTruthy();
  });
  it('a seep runs dry and stays dry: the pump stops, the tile reports SITE_DRY', () => {
    const gs = veyraRun(11); const r = gs.run!; ensureOilSeeps(r);
    const s = Object.values(r.oilSources!)[0]; put(gs, s.tx - 1, s.ty); markDirty(); station(gs, 'workbench', 0, -1, 2);
    give(gs, 'deploy_oil_pump', 1, { dur: STRUCTS.oil_pump.hp });
    expect(act(gs, 'build', { struct: 'oil_pump', tx: s.tx, ty: s.ty }).ok).toBe(true);
    r.oilSources!['oil:' + s.tx + ':' + s.ty].stock = 1;   // FIXTURE: nearly dry
    const pump = Object.values(r.entities).find(x => x.type === 'oil_pump')!; addItem(r, pump.station!.fuelC, 'wood', 20);
    expect(act(gs, 'craft', { eid: pump.id, recipe: 'pump_crude' }).ok).toBe(true);
    stepStations(gs, BAL.oilPumpV1.secs * 1000 + 500, at(BAL.oilPumpV1.secs * 1000 + 500));
    expect(countItem(r, pump.station!.outC, 'crude_petroleum')).toBe(1);
    expect(oilAvailability(r, s.tx, s.ty)).toBe('SITE_DRY');
    expect(act(gs, 'craft', { eid: pump.id, recipe: 'pump_crude' }).ok).toBe(false);
  });
});
