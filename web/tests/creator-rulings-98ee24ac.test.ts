/**
 * Creator rulings on build 98ee24ac (round after the starter Stone Axe).
 *
 *  1. A stuck player can give up from the menu and wake somewhere safe, at the price of a death.
 *  2. Follow Last Island: there is no pickaxe. The axe line does the pick's work; picks in old saves become axes.
 *  3. Delegated to the agent: a Plank is 40 s of station fuel; a passenger waiting at the quay eats from their own
 *     pack; anyone brought round with water stands with at least WATER_REVIVE_HP.
 *
 * Controlled engineering checks: positions, needs and old-save payloads are staged; every transaction is the real one.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { HOUR, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { ITEMS, RECIPES, SOURCES, qualityTierFor, stationBurnable } from '../src/game/catalog';
import { C, addItem, countItem, dispatch, harvestHit, killPlayer, markDirty, mkContainer, mkStack, newGame, sourceAt, startRun, stepStations } from '../src/game/engine';
import { G1B_CHESTS, G1B_SITES, g1bBonusRowIsVoid, g1bRoll } from '../src/game/g1b';
import { serializeSnapshot, validate } from '../src/game/persist';
import { getWorld, setActiveLayout } from '../src/game/world';
import { ITEM_RETIREMENT, ITEM_SET_VERSION, isRetiredLive, liveItemId, liveRecipeId } from '../src/game/final-item-set';
import { RECIPE_REVISION, RETIRED_RECIPES } from '../src/game/recipe-migration';
import { WATER_REVIVE_HP, needsFollowup } from '../src/game/human-jobs';
import { advanceEvacuation, boardEvac, departEvac, downHuman, downedByThirst, evacSchedule, humanPack, startHumanAid, stepHumans, stepPlayerHumanAid, type EvacTrip } from '../src/game/humanworld';
import { U05_WORLD_LAYOUT_ID, layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { T0 } from './helpers/g1b-kit';

afterEach(() => setActiveLayout('shipping'));
let seq = 0;
const act = (gs: GameState, type: string, p: object = {}, now = T0 + 1000) => dispatch(gs, { id: 'cr98-' + (++seq), type, ...p } as any, now);
const snapshot = (gs: GameState) => JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as any;
const PICKS = ['stone_pick', 'iron_pick', 'industrial_pick'] as const;
const AXE_OF: Record<string, string> = { stone_pick: 'stone_axe', iron_pick: 'iron_axe', industrial_pick: 'industrial_axe' };

function veyra(seed = 4021): GameState {
  expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
  const gs = newGame(); expect(startRun(gs, 'male', T0, null, seed).ok).toBe(true); gs.run!.creatures = []; return gs;
}
function greywater(): GameState {
  setActiveLayout('veyra05-greywater'); const gs = newGame();
  expect(startRun(gs, 'female', T0, null, 7606, { tx: 100, ty: 100 }).ok).toBe(true); return gs;
}

describe('ruling 1 — give up and wake somewhere safe', () => {
  it('costs exactly a death: the pack stays in a bag where the player stood, and the player wakes alive with one Stone Axe', () => {
    const gs = veyra(), r = gs.run!, p = r.player; expect(addItem(r, 'inv', 'iron_ingot', 7)).toBe(0);
    const carried = C(r, 'inv').slots.filter(Boolean).map(s => `${s!.uid}:${s!.key}x${s!.qty}`).sort(), at = { x: p.x, y: p.y };
    const bagsBefore = Object.values(r.entities).filter(e => e.kind === 'bag').length;
    const rc = act(gs, 'giveUp'); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    expect(p.dead).toBe(false); expect(p.hp).toBeGreaterThan(0);
    const bags = Object.values(r.entities).filter(e => e.kind === 'bag'); expect(bags).toHaveLength(bagsBefore + 1);
    const bag = bags.find(e => Math.hypot(e.x - at.x, e.y - at.y) < TILE * 2)!; expect(bag, 'the bag lies where the player gave up').toBeTruthy();
    expect(C(r, bag.c!).slots.filter(Boolean).map(s => `${s!.uid}:${s!.key}x${s!.qty}`).sort(), 'nothing deleted, nothing copied').toEqual(carried);
    expect(C(r, 'inv').slots.filter(Boolean).map(s => s!.key)).toEqual(['stone_axe']);
    expect(r.receipts.filter(q => q.kind === 'giveup').map(q => q.detail)).toEqual(['woke']);
    expect(r.receipts.filter(q => q.kind === 'respawn.kit')).toHaveLength(1);
    expect(validate(snapshot(gs)), 'the state after giving up saves and loads').toBeTruthy();
  });
  it('is refused for a player who has already fallen, and changes nothing', () => {
    const gs = veyra(), r = gs.run!; killPlayer(gs, T0 + 500, 'test');
    const receipts = r.receipts.length, rc = act(gs, 'giveUp');
    expect(rc.ok).toBe(false); expect((rc as any).reason).toMatch(/dead|fallen/); expect(r.player.dead).toBe(true);
    expect(r.receipts.filter(q => q.kind === 'giveup')).toHaveLength(0); expect(r.receipts.length).toBe(receipts);
  });
  it('can be used again and again; each use leaves its own bag and issues one axe', () => {
    const gs = veyra(), r = gs.run!;
    for (let n = 1; n <= 3; n++) {
      expect(act(gs, 'giveUp', {}, T0 + n * 60_000).ok).toBe(true);
      expect(C(r, 'inv').slots.filter(Boolean).map(s => s!.key)).toEqual(['stone_axe']);
      expect(r.receipts.filter(q => q.kind === 'respawn.kit')).toHaveLength(n);
    }
    expect(validate(snapshot(gs))).toBeTruthy();
  });
});

describe('ruling 2 — no pickaxe: the axe line does the work', () => {
  it('each axe carries the stone, ore and scrap power its pickaxe had; the picks are retired into the same tier', () => {
    expect(ITEMS.stone_axe.power).toEqual({ wood: 3, stone: 3, ore: 2, plant: 1, scrap: 2 });
    expect(ITEMS.iron_axe.power).toEqual({ wood: 6, stone: 6, ore: 5, plant: 2, scrap: 4 });
    expect(ITEMS.industrial_axe.power).toEqual({ wood: 9, stone: 9, ore: 8, plant: 3, scrap: 7 });
    for (const pick of PICKS) {
      expect(isRetiredLive(pick), pick).toBe(true); expect(liveItemId(pick)).toBe(AXE_OF[pick]);
      expect(ITEM_RETIREMENT[pick], pick).toBeTruthy(); expect(ITEMS[pick], 'the row stays so an old save can be read').toBeTruthy();
      expect(RECIPES[pick], pick + ' has no live formula').toBeUndefined(); expect(RETIRED_RECIPES, pick).toContain(pick);
      const a = ITEMS[AXE_OF[pick]].power!, b = ITEMS[pick].power!;
      for (const k of ['stone', 'ore', 'scrap'] as const) expect(a[k], `${AXE_OF[pick]} ${k}`).toBeGreaterThanOrEqual(b[k] ?? 0);
    }
    expect(RECIPES.industrial_pick_geared).toBeUndefined(); expect(liveRecipeId('industrial_pick_geared')).toBe('industrial_axe_geared');
    expect(RECIPES.industrial_axe_geared.out).toBe('industrial_axe');
    expect(Object.values(RECIPES).some(rc => isRetiredLive(rc.out) || rc.ins.some(([k]) => isRetiredLive(k))), 'no live recipe makes or eats a pick').toBe(false);
  });
  it('the rich-ore tier follows the axe: Iron Axe 8%, Salvager Axe 12%, Stone Axe none', () => {
    expect(qualityTierFor(SOURCES.iron, ITEMS.iron_axe.power!, 'playerTool')).toEqual({ item: 'rich_iron_ore', chance: 0.08 });
    expect(qualityTierFor(SOURCES.iron, ITEMS.industrial_axe.power!, 'playerTool')).toEqual({ item: 'rich_iron_ore', chance: 0.12 });
    expect(qualityTierFor(SOURCES.iron, ITEMS.stone_axe.power!, 'playerTool')).toBeNull();
  });
  it.each([['rock', 'stone_axe'], ['iron', 'stone_axe'], ['rock', 'iron_axe'], ['iron', 'iron_axe'], ['iron', 'industrial_axe']] as const)('%s is worked out by the %s in the swings its power predicts', (source, axe) => {
    setActiveLayout('shipping_fresh'); const gs = newGame(); expect(act(gs, 'startRun', { character: 'female', seed: 811 }, T0).ok).toBe(true);
    const r = gs.run!; r.creatures = []; markDirty(); const i = getWorld().sourceV3.findIndex(k => k === source); expect(i).toBeGreaterThanOrEqual(0);
    const tx = i % WW, ty = Math.floor(i / WW), def = SOURCES[source], stock = sourceAt(r, tx, ty, T0)!.stock; expect(stock).toBe(def.stock);
    const power = (ITEMS[axe].power as Record<string, number>)[def.mat]; expect(power, `${axe} has ${def.mat} power`).toBeGreaterThan(0);
    const ground = () => Object.values(r.custody).filter(c => c.kind === 'drop').flatMap(c => c.slots).reduce((n, st) => n + (st?.key === def.yields[0][0] ? st.qty : 0), 0);
    const before = ground(); let swings = 0;
    while (sourceAt(r, tx, ty, T0)!.stock > 0 && swings < 200) { expect(harvestHit(gs, tx, ty, ITEMS[axe].power!, T0 + swings * 500, tx * TILE, ty * TILE, { extraction: 'playerTool', tool: axe }).result).toBe('yield'); swings++; }
    expect(swings).toBe(Math.ceil(def.hp / power));
    expect(ground() - before, 'every unit of the source lands on the ground, no more').toBe(def.stock * def.yields[0][1]);
  });
  it('a loot chest whose frozen table still names the Iron Pickaxe pays nothing for that roll; the Iron Axe keeps its approved odds', () => {
    // The approved chest contract (v1) names `iron_pick` in eight bonus pools and cannot be edited without a new contract.
    // Creator ruling 2026-11-24 (option 2): paying that row with an Iron Axe would double the Iron Axe's approved odds,
    // so the roll pays nothing and every other row keeps exactly the odds the Creator approved.
    const eight = Object.values(G1B_CHESTS).filter(c => c.bonus.some(row => row.item === 'iron_pick'));
    expect(eight.map(c => c.id).sort()).toEqual(['military_low', 'supply_damaged', 'supply_high', 'supply_low', 'supply_mid', 'toolbox_damaged', 'toolbox_high', 'toolbox_low']);
    // the void rule names exactly those eight rows and nothing else in any of the 16 chests
    const voided: string[] = [];
    for (const c of Object.values(G1B_CHESTS)) { for (const row of c.bonus) if (g1bBonusRowIsVoid(c.bonus, row)) voided.push(`${c.id}|${row.item}`); for (const row of [...c.anchor, ...c.regular]) expect(liveItemId(row.item), `${c.id} ${row.item}`).toBe(row.item); }
    expect(voided.sort()).toEqual(eight.map(c => `${c.id}|iron_pick`).sort());
    const max = (k: string) => ITEMS[liveItemId(k)]?.max ?? 1, N = 30000, tol = (p: number) => 4 * Math.sqrt(p * (1 - p) / N);
    for (const def of eight) {
      const sid = Object.keys(G1B_SITES).find(id => G1B_SITES[id].variant === def.id)!; expect(sid, def.id).toBeTruthy();
      for (const pool of [def.anchor, def.regular]) expect(pool.some(row => row.item === 'iron_axe'), `${def.id}: the Iron Axe comes only from the bonus pool`).toBe(false);
      const W = def.bonus.reduce((n, row) => n + row.weight, 0), w = (item: string) => def.bonus.find(row => row.item === item)!.weight;
      const approvedAxe = def.bonus_probability_pct / 100 * w('iron_axe') / W, doubled = def.bonus_probability_pct / 100 * (w('iron_axe') + w('iron_pick')) / W;
      let axe = 0, pick = 0, bonus = 0;
      for (let i = 0; i < N; i++) { const { stacks } = g1bRoll('cr98-mc-' + i, sid, 0, max); for (const st of stacks) { if (st.key === 'iron_pick') pick++; if (st.key === 'iron_axe') axe += st.qty; } if (stacks.some(st => st.from === 'bonus')) bonus++; }
      expect(pick, `${def.id}: no roll names the pick any more`).toBe(0);
      expect(Math.abs(axe / N - approvedAxe), `${def.id}: Iron Axe ${(axe / N * 100).toFixed(2)} % vs approved ${(approvedAxe * 100).toFixed(2)} %`).toBeLessThan(tol(approvedAxe));
      expect(Math.abs(axe / N - doubled), `${def.id}: positive control, the doubled rate is outside the tolerance`).toBeGreaterThan(tol(doubled));
      // the chest shows a bonus less often by exactly the pick's share (a bonus that merged into another stack is not visible, hence the bound)
      const live = def.bonus_probability_pct / 100 * (W - w('iron_pick')) / W;
      expect(bonus / N, `${def.id}: bonus shown ${(bonus / N * 100).toFixed(2)} % vs ${(live * 100).toFixed(2)} %`).toBeLessThanOrEqual(live + tol(live));
    }
    // a pick already lying in an old save's chest is still the player's: it becomes an Iron Axe (next test)
    expect(mkStack(veyra().run!, 'iron_pick', 1)).toMatchObject({ key: 'iron_axe', qty: 1, dur: ITEMS.iron_axe.dur });
  });
  it('an old save: picks in the pack, in a chest and in a resident\'s hand all become the same-tier axe, same stack, same wear', () => {
    const gs = greywater(), r = gs.run!, chest = mkContainer(r, 'chest', 6);
    const e: Entity = { id: 'cr98-chest', kind: 'struct', type: 'chest_small', x: r.player.x + 16, y: r.player.y, tx: Math.floor(r.player.x / TILE) + 1, ty: Math.floor(r.player.y / TILE), hp: 100, maxHp: 100, c: chest.id } as Entity;
    if ((r as any).veyraFloor) (e as any).floor = (r as any).veyraFloor; r.entities[e.id] = e; markDirty();
    const raw = snapshot(gs), rr = raw.run; delete rr.itemSetVersion;
    const put = (cid: string, i: number, key: string, dur: number) => { const uid = 's' + (rr.nextId++).toString(36); rr.custody[cid].slots[i] = { uid, key, qty: 1, dur }; return uid; };
    const free = rr.custody.inv.slots.map((s: any, i: number) => s ? -1 : i).filter((i: number) => i >= 0);
    const half = (k: string) => Math.round(ITEMS[k].dur! / 2);
    const u1 = put('inv', free[0], 'stone_pick', half('stone_pick')), u2 = put('inv', free[1], 'iron_pick', half('iron_pick'));
    const u3 = put(chest.id, 0, 'industrial_pick', half('industrial_pick')), u4 = put(chest.id, 1, 'iron_pick', ITEMS.iron_pick.dur!);
    const people = Object.values(rr.humanWorld.people) as any[];
    const smith = people.find(h => h.equip?.weapon?.key === 'stone_axe'); expect(smith, 'a resident who starts with a tool').toBeTruthy();
    const broke = people.find(h => h !== smith && h.equip?.weapon?.key === 'stone_axe'); expect(broke, 'a second resident with a tool').toBeTruthy();
    const uidSmith = smith.equip.weapon.uid, uidBroke = broke.equip.weapon.uid;
    smith.equip.weapon.key = 'stone_pick'; smith.equip.weapon.dur = half('stone_pick'); broke.equip.weapon.key = 'iron_pick'; broke.equip.weapon.dur = 0;
    rr.knowledge.recipes.push('stone_pick', 'iron_pick', 'industrial_pick_geared');

    const back = validate(raw)!; expect(back, 'an old save holding pickaxes must load').toBeTruthy(); const b = back.run!;
    const find = (cid: string, uid: string) => C(b, cid).slots.find(s => s?.uid === uid)!;
    expect(find('inv', u1)).toMatchObject({ key: 'stone_axe', qty: 1, dur: Math.round(ITEMS.stone_axe.dur! / 2) });
    expect(find('inv', u2)).toMatchObject({ key: 'iron_axe', qty: 1, dur: Math.round(ITEMS.iron_axe.dur! / 2) });
    expect(find(chest.id, u3)).toMatchObject({ key: 'industrial_axe', qty: 1, dur: Math.round(ITEMS.industrial_axe.dur! / 2) });
    expect(find(chest.id, u4)).toMatchObject({ key: 'iron_axe', qty: 1, dur: ITEMS.iron_axe.dur });
    const hb = b.humanWorld!.people;
    expect(hb[smith.actorId].equip.weapon).toMatchObject({ uid: uidSmith, key: 'stone_axe', dur: Math.round(ITEMS.stone_axe.dur! / 2) });
    expect(hb[broke.actorId].equip.weapon, 'a broken tool stays broken; the save does not mend it').toMatchObject({ uid: uidBroke, key: 'iron_axe', dur: 0 });
    expect(b.itemSetVersion).toBe(ITEM_SET_VERSION); expect(b.migrated!.retiredItems).toBe(4);
    for (const dead of ['stone_pick', 'iron_pick', 'industrial_pick_geared']) expect(b.knowledge.recipes, dead).not.toContain(dead);
    expect(b.knowledge.recipes).toContain('industrial_axe_geared');
    for (const c of Object.values(b.custody)) for (const s of c.slots) if (s) expect(isRetiredLive(s.key), s.key).toBe(false);
    for (const h of Object.values(hb)) for (const s of Object.values(h.equip)) if (s) expect(isRetiredLive(s.key), `${h.actorId} ${s.key}`).toBe(false);
    const again = validate(snapshot(back))!; expect(again, 'the converted save loads again').toBeTruthy(); expect(again.run!.migrated!.retiredItems, 'converted once').toBe(4);
  });
  it('a pickaxe job queued before the change still finishes, pays once, and pays the axe', () => {
    const gs = veyra(), r = gs.run!, p = r.player, fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
    const bench: Entity = { id: 'cr98-bench', kind: 'struct', type: 'workbench', x: p.x + 16, y: p.y, tx: Math.floor(p.x / TILE) + 1, ty: Math.floor(p.y / TILE), hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [] } } as Entity;
    if ((r as any).veyraFloor) (bench as any).floor = (r as any).veyraFloor; r.entities[bench.id] = bench; markDirty();
    bench.station!.queue.push({ id: 'cr98-oldjob', recipe: 'iron_pick', left: 10_000, total: 15_000, rv: RECIPE_REVISION - 1 } as any);
    const raw = snapshot(gs); delete raw.run.itemSetVersion;
    const back = validate(raw)!; expect(back, 'a save holding a pickaxe job must load').toBeTruthy();
    const st = back.run!.entities[bench.id].station!; expect(st.queue).toHaveLength(1);
    stepStations(back, 11_000, T0 + 2_000_000);
    expect(st.queue).toHaveLength(0); expect(countItem(back.run!, st.outC, 'iron_axe'), 'the owed pick is paid as an Iron Axe').toBe(1); expect(countItem(back.run!, st.outC, 'iron_pick')).toBe(0);
    stepStations(back, 60_000, T0 + 2_100_000); expect(countItem(back.run!, st.outC, 'iron_axe'), 'paid exactly once').toBe(1);
    const again = dispatch(back, { id: 'cr98-retired', type: 'craft', eid: bench.id, recipe: 'iron_pick' } as any, T0 + 2_200_000);
    expect(again.ok, 'the retired formula cannot be queued again').toBe(false); expect((again as any).reason).toMatch(/Retired/);
  });
});

describe('delegated rulings', () => {
  it('a Plank is station fuel worth two Wood: one Plank keeps a campfire burning 40 s', () => {
    expect(ITEMS.plank.fuel).toBe(40); expect(ITEMS.wood.fuel).toBe(20); expect(stationBurnable('plank')).toBe(true);
    expect(RECIPES.plank.ins).toEqual([['wood', 2]]); expect(ITEMS.plank.fuel).toBe(RECIPES.plank.ins[0][1] * ITEMS.wood.fuel!);
    const gs = veyra(), r = gs.run!, p = r.player, fuel = mkContainer(r, 'fuel', 3), out = mkContainer(r, 'out', 6);
    const fire: Entity = { id: 'cr98-fire', kind: 'struct', type: 'campfire', x: p.x + 16, y: p.y, tx: Math.floor(p.x / TILE) + 1, ty: Math.floor(p.y / TILE), hp: 200, maxHp: 200, station: { fuelC: fuel.id, outC: out.id, burn: 0, queue: [] } } as Entity;
    if ((r as any).veyraFloor) (fire as any).floor = (r as any).veyraFloor; r.entities[fire.id] = fire; markDirty();
    expect(addItem(r, fuel.id, 'plank', 1)).toBe(0); expect(addItem(r, 'inv', 'meat', 1)).toBe(0);
    const rc = act(gs, 'craft', { eid: fire.id, recipe: 'cooked_meat' }); expect(rc.ok, JSON.stringify(rc)).toBe(true);
    stepStations(gs, 1000, T0 + 10_000);
    expect(countItem(r, fuel.id, 'plank'), 'the Plank is burned, not kept').toBe(0);
    expect(fire.station!.burn, 'one Plank lights 40 s; one second has been used').toBe(39_000);
  });

  describe('a passenger waiting at the quay', () => {
    function quay() {
      const [gtx, gty] = auToTile(921, 259), win = windowAround(gtx, gty); setActiveLayout(layoutIdAt(win.originTx, win.originTy));
      const gs = newGame(), lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx)), ly = Math.max(8, Math.min(WW - 9, gty - win.originTy));
      expect(startRun(gs, 'female', T0, null, 7606, { tx: lx, ty: ly }).ok).toBe(true);
      const r = gs.run!, hw = r.humanWorld!, trip: EvacTrip = Object.values(hw.evacuation)[0];
      r.qaOffset = evacSchedule().openHour * HOUR; const at = T0 + 1000; advanceEvacuation(r, hw, at); expect(trip.phase).toBe('BOARDING');
      const [h, mate] = Object.values(hw.people).filter(q => q.state !== 'DEAD' && q.floor === 0);
      for (const q of [h, mate]) { q.state = 'IDLE'; q.gx = trip.siteGx; q.gy = trip.siteGy; q.hunger = 90; q.thirst = 90; expect(boardEvac(r, hw, q, trip.tripId, at).ok).toBe(true); expect(q.state).toBe('ON_VESSEL'); }
      const pack = humanPack(r, h); for (let i = 0; i < pack.slots.length; i++) pack.slots[i] = null; markDirty();
      return { gs, r, hw, trip, h, mate, pack, at };
    }
    it('eats and drinks from their own pack while the vessel is still boarding', () => {
      const o = quay(); expect(addItem(o.r, o.pack.id, 'cooked_meat', 2)).toBe(0); expect(addItem(o.r, o.pack.id, 'water_flask', 1)).toBe(0);
      const charge = o.pack.slots.find(s => s?.key === 'water_flask')!.charge!;
      o.h.hunger = 20; o.h.thirst = 20; stepHumans(o.r, o.hw, o.at + 1000);
      expect(o.h.state).toBe('ON_VESSEL'); expect(o.h.hunger).toBeGreaterThan(20); expect(o.h.thirst).toBeGreaterThan(20);
      expect(countItem(o.r, o.pack.id, 'cooked_meat'), 'one meal eaten, not conjured').toBe(1);
      expect(o.pack.slots.find(s => s?.key === 'water_flask')!.charge).toBeLessThanOrEqual(charge);
    });
    it('with an empty pack goes hungry: the village larder is not reached from the deck', () => {
      const o = quay(), mine = () => o.r.receipts.filter(q => ['human.eat', 'human.drink'].includes(q.kind) && q.detail.startsWith(o.h.actorId + ':'));
      // Positive control: the shipmate beside them, with food in the pack, does eat in the same step.
      const matePack = humanPack(o.r, o.mate); for (let i = 0; i < matePack.slots.length; i++) matePack.slots[i] = null; expect(addItem(o.r, matePack.id, 'cooked_meat', 1)).toBe(0);
      o.h.hunger = 20; o.h.thirst = 20; o.mate.hunger = 20; stepHumans(o.r, o.hw, o.at + 1000);
      expect(o.h.state).toBe('ON_VESSEL'); expect(o.h.hunger).toBeLessThanOrEqual(20); expect(o.h.thirst).toBeLessThanOrEqual(20);
      expect(mine(), 'nothing was eaten or drunk in this passenger\'s name').toHaveLength(0);
      expect(o.mate.hunger).toBeGreaterThan(20); expect(countItem(o.r, matePack.id, 'cooked_meat')).toBe(0);
    });
    it('eats nothing once the vessel has cast off', () => {
      const o = quay(); expect(addItem(o.r, o.pack.id, 'cooked_meat', 2)).toBe(0);
      expect(departEvac(o.r, o.hw, o.trip.tripId, o.at + 500).ok).toBe(true); expect(o.trip.phase).toBe('IN_TRANSIT');
      o.h.hunger = 20; stepHumans(o.r, o.hw, o.at + 1500);
      expect(o.h.state).toBe('ON_VESSEL'); expect(countItem(o.r, o.pack.id, 'cooked_meat')).toBe(2); expect(o.h.hunger).toBeLessThanOrEqual(20);
    });
  });

  it('water from the player brings a thirst-collapsed resident round with WATER_REVIVE_HP, still owed a real dose', () => {
    const gs = greywater(), r = gs.run!, hw = r.humanWorld!, h = Object.values(hw.people)[0];
    const o = r.sourceMap!.veyra!.originAu, ox = Math.round(o[0] / .5), oy = Math.round(o[1] / .5);
    const tx = Math.floor(r.player.x / TILE), ty = Math.floor(r.player.y / TILE);
    h.gx = ox + tx; h.gy = oy + ty; h.floor = 0; h.state = 'IDLE'; h.hunger = 60; h.thirst = 0; h.wounds = []; h.hp = 1;
    downHuman(r, hw, h, T0, 'starvation'); expect(h.state).toBe('DOWNED'); expect(downedByThirst(h)).toBe(true); expect(h.hp).toBeLessThan(WATER_REVIVE_HP);
    const water = C(r, 'inv').slots.find(s => s?.key === 'water_flask')!;
    expect(startHumanAid(r, hw, h, 'cr98-water', water.uid, T0).ok).toBe(true); stepPlayerHumanAid(r, hw, T0 + 6000);
    expect(h.state).toBe('IDLE'); expect(h.hp).toBe(WATER_REVIVE_HP); expect(WATER_REVIVE_HP).toBe(10);
    expect(needsFollowup(h), 'ten health is not a cure: the medic is still owed').toBe(true);
    // A resident who was healthier than the floor keeps what they had: water never lowers health.
    h.thirst = 0; h.hp = 25; h.wounds = []; downHuman(r, hw, h, T0 + 10_000, 'starvation'); const hp = h.hp; expect(h.state).toBe('DOWNED');
    expect(startHumanAid(r, hw, h, 'cr98-water-2', water.uid, T0 + 10_000).ok).toBe(true); stepPlayerHumanAid(r, hw, T0 + 16_000);
    expect(h.state).toBe('IDLE'); expect(h.hp).toBe(Math.max(hp, WATER_REVIVE_HP));
  });
});
