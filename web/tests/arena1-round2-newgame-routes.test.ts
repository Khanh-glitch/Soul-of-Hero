// ARENA 1 round 2 — New-Game route proofs.
//
// WHAT THIS IS: an engine-level bot (tests/helpers/newgame-bot.ts) plays a real New Game on Veyra. It walks with
// movement input, swings tools with attack input, and does everything else through the same intents the UI sends.
// It is never handed an item, a station, a recipe or a position, and the world's creatures are left alone.
//
// WHAT THIS IS NOT: a browser play-through. Nothing is rendered, no HUD is read, and the bot knows where every node is
// (it reads the world's source map), so its times are LOWER BOUNDS for a person, not a pacing measurement. A route
// proven here is "the chain closes from a New Game in the engine"; it is not PLAYABLE evidence by itself.
//
// DISCLOSED SHORTCUT: the hotbar selection is set directly (`player.active = slot`), as the number keys do in the
// client; it is the only state the bot writes outside `tick()` input and `dispatch()` intents.
//
// Every stage is recorded as a checkpoint. A stage that cannot be completed is recorded as NOT_PROVEN with the
// engine's own refusal text; the assertions below pin exactly which stages are proven on this build.
// G1A: new Veyra runs place the three industrial salvage sources; the legacy keys stay listed so the same bot also drives an old layout.
const SALVAGE = ['scrap', 'wreck', 'road_salvage_bale', 'road_relay_wreck', 'road_fuel_rack'];
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ITEMS, RECIPES, STRUCTS, WORKBENCH_UPGRADE } from '../src/game/catalog';
import { BAL, T, TILE, WW, WH } from '../src/game/core';
import { C, blockGrid, buildReason, carryLimit, invWeight, sourceAt, effTile, ensureOilSeeps } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { Bot, BotStop } from './helpers/newgame-bot';

const WRITE = process.env.SOH_WRITE_ARENA1 === '1';
const OUT = 'evidence/arena1/round2-newgame-routes.json';
const TREES = ['oak', 'pine', 'snowpine', 'willow'];
const FOOD_VALUE = (k: string) => ITEMS[k]?.food?.hunger ?? 0;
type Stage = { stage: string; status: 'PROVEN' | 'NOT_PROVEN'; atMinute: number; detail?: unknown };
const evidence: Record<string, unknown> = {};
afterAll(() => {
  setActiveLayout('shipping');
  if (WRITE) { mkdirSync('evidence/arena1', { recursive: true }); writeFileSync(OUT, JSON.stringify({ schema: 'soh-arena1-round2-newgame-routes-v1', generated_by: 'web/tests/arena1-round2-newgame-routes.test.ts (SOH_WRITE_ARENA1=1)', method: 'ENGINE_BOT: real New Game on Veyra; movement and swings are tick() input, everything else is a dispatch() intent; no granted items, stations, recipes or positions; creatures untouched. NOT a browser play-through. Times are lower bounds (the bot knows the source map).', ...evidence }, null, 1) + '\n'); }
});

/** Make sure a station has something burning or waiting to burn; fetch wood if not. Leaves the bot beside it. */
function stoke(b: Bot, id: string, home: [number, number]) {
  const lit = () => { const e = b.r.entities[id]; return !!e && ((e.station!.burn ?? 0) > 0 || C(b.r, e.station!.fuelC).slots.some(Boolean)); };
  b.at(id, home); if (lit() && C(b.r, b.r.entities[id].station!.fuelC).slots.some(Boolean)) return;
  if (b.inv('wood') < 6) b.gather('wood', 10, TREES); b.fuel(b.at(id, home), 'wood');
}
/** Keep the bot alive the way a player would: drink at fresh water, eat what is carried, forage when the pack is empty. */
function care(b: Bot, camp?: { fire: string; g: [number, number] }) {
  // Stone tools wear out (a pick lasts roughly half an hour of this route). Replace them by hand, as at the start.
  for (const tool of ['stone_axe', 'stone_pick']) if (b.started.has(tool) && !b.working(tool) && !b.working(tool.replace('stone', 'iron')) && b.working('knife')) {
    const bill = RECIPES[tool].ins; for (const [k, q] of bill) if (k !== 'rope' && b.inv(k) < q) b.gather(k, q, k === 'wood' ? ['tree', 'pine', 'jungle', 'deadtree'] : ['rock'], 6);
    if (b.inv('rope') < 1) { if (b.inv('fiber') < 3) b.gather('fiber', 3, ['reed', 'grass'], 6); if (b.inv('fiber') >= 3) b.craft('rope'); }
    if (bill.every(([k, q]) => b.inv(k) >= q)) { b.craft(tool); b.toolsRemade++; b.note(`remade ${tool} (the old one wore out)`); }
  }
  for (const tool of ['stone_axe', 'stone_pick']) if (b.working(tool)) b.started.add(tool);
  // wounds: keep three bandages (4 fiber each, by hand) and bind up to 80 hp; a spear out-reaches the knife
  if (b.inv('bandage') < 4 || b.p.hp < 80) { const want = 5 + Math.ceil(Math.max(0, 80 - b.p.hp) / 18); if (b.inv('fiber') < (want - b.inv('bandage')) * 4) b.gather('fiber', (want - b.inv('bandage')) * 4, ['reed', 'grass'], 12); while (b.inv('bandage') < want && b.inv('fiber') >= 4) b.craft('bandage'); for (let k = 0; k < 6 && b.p.hp < 80 && b.inv('bandage') > 0; k++) { b.must('useItem', { slot: b.slotOf('bandage') }); b.wait(400); } }
  if (b.inv('wood_spear') < 1 && b.inv('stone_axe') > 0) { if (b.inv('fiber') < 3) b.gather('fiber', 3, ['reed', 'grass'], 6); if (b.inv('wood') < 4) b.gather('wood', 4, ['tree', 'pine', 'jungle', 'deadtree'], 4); if (b.inv('fiber') >= 3 && b.inv('wood') >= 4) { b.craft('rope'); b.craft('wood_spear'); } }
  if (b.p.thirst < 55) b.drink();
  if (b.p.hunger < 60) {
    const carried = () => ['cooked_meat', 'grilled_mushroom', 'berries'].find(k => b.inv(k) > 0);
    if (!carried()) {
      if (!b.gather('berries', 8, ['bush'], 6)) {
        b.gather('mushroom', 8, ['mushroom'], 8);
        if (b.inv('mushroom') > 0 && camp) { stoke(b, camp.fire, camp.g); const fire = b.at(camp.fire, camp.g); const n = Math.min(6, b.inv('mushroom')); for (let k = 0; k < n; k++) b.craft('grilled_mushroom', fire.id); b.runStation(fire); }
      }
    }
    for (let k = 0; k < 12 && b.p.hunger < 88; k++) { const f = carried(); if (!f || !b.eat(f)) break; }
  }
}

describe('ARENA 1 round 2 — New-Game routes on Veyra (engine bot, no grants)', () => {
  it('ROUTE OIL: spawn -> camp at a crude seep -> iron -> Parts -> research Glass -> L2 bench -> Gear + Pipe -> Oil Pump on the seep -> Crude -> Refinery -> Fuel Canister', () => {
    const b = new Bot(7); const stages: Stage[] = []; let stop = '';
    const done = (stage: string, detail?: unknown) => { stages.push({ stage, status: 'PROVEN', atMinute: +b.minutes().toFixed(1), detail }); };
    const spawnG = b.toGlobal(...b.tile) as [number, number];
    const startInv = (C(b.r, 'inv').slots.filter(Boolean) as { key: string; qty: number }[]).map(s => `${s.key} x${s.qty}`);
    const startRecipes = b.r.knowledge.recipes.length;
    let stageName = 'start';
    try {
      // ---- 1. find a seep. A player finds it by walking; the bot reads the run's own seep ledger (that is the only shortcut).
      stageName = 'reach a crude seep'; b.wait(200); ensureOilSeeps(b.r);
      const seeps = Object.values(b.r.oilSources ?? {}).filter(s => s.authority === BAL.oilPumpV1.seepAuthority).map(s => ({ g: b.toGlobal(s.tx, s.ty) as [number, number], stock: s.stock, d: Math.abs(s.tx - b.tile[0]) + Math.abs(s.ty - b.tile[1]) })).sort((x, y) => x.d - y.d);
      expect(seeps.length, 'the starting window must hold at least one seep').toBeGreaterThan(0);
      const seep = seeps.find(s => b.travel(s.g[0], s.g[1])); if (!seep) throw new BotStop('no seep is reachable on foot');
      done('reach a crude seep', { seepsInStartWindow: seeps.length, walkedTiles: seep.d, seepStock: seep.stock });
      b.keepClear.push(seep.g);   // nothing else may be built on the seep tile
      const home = b.toGlobal(...b.tile) as [number, number]; const back = () => { if (!b.travel(seep.g[0], seep.g[1])) throw new BotStop('cannot walk back to the seep camp'); };

      // ---- 2. camp: campfire, stone tools, furnace — all from what grows around the seep
      stageName = 'camp (campfire, stone tools, furnace)';
      b.gather('wood', 12, TREES); b.gather('stone', 3, ['rock']); back();
      const fire = b.place('campfire'); b.fuel(fire, 'wood'); const camp = { fire: fire.id, g: home };
      b.gather('fiber', 6, ['reed', 'grass']); b.craft('rope'); b.craft('rope');
      b.gather('wood', 6, TREES); b.gather('stone', 7, ['rock']); b.craft('stone_pick'); b.craft('stone_axe');
      b.gather('stone', 18, ['rock']); b.gather('wood', 14, TREES); back();
      const furnace = b.place('furnace'); b.fuel(furnace, 'wood');
      done(stageName, { tools: ['stone_pick', 'stone_axe'] }); care(b, camp);

      // ---- 3. iron: 22 ingots are needed by everything below
      stageName = 'iron ore -> 22 ingots';
      const ORE = 22; if (!b.gather('iron_ore', ORE, ['iron', 'coalv'], 40)) throw new BotStop(`only ${b.inv('iron_ore')}/${ORE} iron ore within reach`);
      care(b, camp);
      for (let left = ORE; left > 0;) { stoke(b, furnace.id, home); const f = b.at(furnace.id, home); const n = Math.min(6, left); for (let k = 0; k < n; k++) b.craft('iron_ingot', f.id); if (!b.runStation(f)) throw new BotStop('furnace stalled (fuel?)'); left -= n; }
      expect(b.inv('iron_ingot')).toBe(ORE); done(stageName, { ingots: b.inv('iron_ingot') }); care(b, camp);

      // ---- 4. Parts: 33 are spent below (research table 6, Glass study 9, bench upgrade 4, Gear 3, two Pipe jobs 4, pump 2, refinery 5)
      stageName = 'Parts from roadside scrap and wrecks';
      const PARTS = 33; if (!b.gather('spares', PARTS, SALVAGE, 40)) throw new BotStop(`only ${b.inv('spares')}/${PARTS} Parts within reach`);
      done(stageName, { parts: b.inv('spares'), alsoDropped: Object.fromEntries(['tin_can', 'electronic_parts', 'electric_resistor', 'mechanical_gear', 'metal_pipe', 'iron_plate', 'fuel_can', 'needle_tube'].map(k => [k, b.inv(k)]).filter(([, n]) => (n as number) > 0)) });
      const windfallFuel = b.inv('fuel_can'), windfallPipe = b.inv('metal_pipe'), windfallGear = b.inv('mechanical_gear');
      care(b, camp);

      // ---- 5. Glass is not starter knowledge: build a Research Table, pay for the study, read the blueprint
      stageName = 'research Glass';
      expect(b.r.knowledge.recipes).not.toContain('glass');
      b.gather('wood', 22, TREES); back();
      const table = b.place('research');   // a Research Table burns nothing
      b.must('research', { eid: table.id, mode: 'directed', recipe: 'glass' });
      if (!b.runStation(table)) throw new BotStop('research table stalled');
      const bp = C(b.r, 'inv').slots.findIndex(s => s?.key === 'blueprint' && s.meta === 'glass'); expect(bp, 'the Glass blueprint must be carried: ' + JSON.stringify({ out: C(b.r, table.station!.outC).slots.filter(Boolean), q: table.station!.queue, inv: C(b.r, 'inv').slots.map(s => s ? s.key + ':' + (s.meta ?? '') + 'x' + s.qty : '-') })).toBeGreaterThanOrEqual(0);
      b.must('useItem', { slot: bp }); expect(b.r.knowledge.recipes).toContain('glass');
      done(stageName, { cost: `${BAL.research.directedSparesCost} Parts, ${BAL.research.directedSeconds} s` });

      // ---- 6. Glass (crystal + stone), charcoal, refined iron
      stageName = 'Glass, Charcoal, Refined Iron';
      if (!b.gather('crystal', 4, ['crystal'], 12)) throw new BotStop(`only ${b.inv('crystal')}/4 crystal within reach`);
      b.gather('stone', 8, ['rock']); b.gather('wood', 14, TREES);
      { stoke(b, fire.id, home); if (b.inv('wood') < 8) { b.gather('wood', 10, TREES); } const cf = b.at(fire.id, home); for (let k = 0; k < 4; k++) b.craft('charcoal', cf.id); if (!b.runStation(cf)) throw new BotStop('campfire stalled'); }
      expect(b.inv('charcoal')).toBe(4);
      { stoke(b, furnace.id, home); const f = b.at(furnace.id, home); for (let k = 0; k < 4; k++) b.craft('glass', f.id); b.craft('refined_iron_ingot', f.id); b.craft('refined_iron_ingot', f.id); if (!b.runStation(f)) throw new BotStop('furnace stalled'); }
      expect(b.inv('glass')).toBe(4); expect(b.inv('refined_iron_ingot')).toBe(4);
      done(stageName, { glass: 4, refined: 4 }); care(b, camp);

      // ---- 7. Workbench beside the seep, upgraded to level 2 with iron + Parts
      stageName = 'Workbench level 2 beside the seep';
      b.gather('wood', 14, TREES); b.gather('stone', 4, ['rock']); back();
      const bench = b.place('workbench');
      expect(b.act('craft', { recipe: 'mechanical_gear', eid: bench.id }).ok, 'a level-1 bench must refuse the Gear').toBe(false);
      b.must('upgradeStation', { eid: bench.id }); expect(bench.station!.level).toBe(2);
      done(stageName, { upgradeBill: WORKBENCH_UPGRADE.cost });

      // ---- 8. Gear and Pipe, made (not found)
      stageName = 'craft Gear and Pipe';
      b.craft('mechanical_gear', bench.id); b.craft('metal_pipe', bench.id); b.craft('metal_pipe', bench.id); if (!b.runStation(bench)) throw new BotStop('bench stalled');
      expect(b.inv('mechanical_gear') - windfallGear).toBe(1); expect(b.inv('metal_pipe') - windfallPipe).toBe(4);
      done(stageName, { gear: 1, pipe: 4 });

      // ---- 9. Oil Pump on the seep tile
      stageName = 'Oil Pump placed on the seep';
      b.craft('deploy_oil_pump'); back();
      const [sx, sy] = b.toLocal(seep.g[0], seep.g[1]);
      const off = buildReason(b.gs, 'oil_pump', sx + 4, sy + 4); expect(off, 'a pump off the seep must be refused').not.toBeNull();
      const rc = b.act('build', { struct: 'oil_pump', tx: sx, ty: sy }); if (!rc.ok) throw new BotStop('oil pump refused: ' + rc.reason);
      const pump = Object.values(b.r.entities).find(e => e.type === 'oil_pump')!; expect(pump).toBeTruthy();
      done(stageName, { refusedOffSeep: off });

      // ---- 10. pump Crude
      stageName = 'pump Crude Petroleum';
      stoke(b, pump.id, seep.g);
      { const pm = b.at(pump.id, seep.g); for (let k = 0; k < 6; k++) b.craft('pump_crude', pm.id); if (!b.runStation(pm)) throw new BotStop('pump stalled'); }
      expect(b.inv('crude_petroleum')).toBe(6);
      const left = Object.values(b.r.oilSources ?? {}).find(s => b.toGlobal(s.tx, s.ty).join() === seep.g.join())!.stock; expect(left).toBe(seep.stock - 6);
      done(stageName, { crude: 6, seepStockLeft: left, secondsEach: BAL.oilPumpV1.secs });

      // ---- 11. Refinery, then fuel
      stageName = 'Refinery -> Fuel Canister';
      // G1A: the three salvage sources shed more kinds of by-product than scrap did, and a 24-slot pack that is full cannot pick wood up.
      b.dropJunk(['tin_can', 'needle_tube', 'sulfur', 'herb']);
      b.gather('wood', 20, TREES); b.at(bench.id, seep.g);   // the Refinery must stand near the level-2 bench
      const refinery = b.place('refinery'); b.fuel(refinery, 'wood');
      b.craft('refinery_fuel', refinery.id); b.craft('refinery_fuel', refinery.id); if (!b.runStation(refinery)) throw new BotStop('refinery stalled');
      expect(b.inv('fuel_can') - windfallFuel).toBe(2); expect(b.inv('crude_petroleum')).toBe(0);
      done(stageName, { fuelCans: 2, bill: RECIPES.refinery_fuel.ins });
      (b as any)._ids = { fire: fire.id, furnace: furnace.id, table: table.id, bench: bench.id, home, seep: seep.g };
    } catch (e) { if (e instanceof BotStop) { stop = e.message; stages.push({ stage: stageName, status: 'NOT_PROVEN', atMinute: +b.minutes().toFixed(1), detail: stop }); } else throw e; }


    // ================= EXTENSIONS: the other round-2 unblocked items, continued from the same run =================
    // Each is attempted on its own and recorded PROVEN / NOT_PROVEN with the engine's refusal. They never mask the
    // base route above.
    const ext: Stage[] = []; const ids = (b as any)._ids as { fire: string; furnace: string; table: string; bench: string; home: [number, number]; seep: [number, number] } | undefined;
    const attempt = (stage: string, fn: () => unknown) => { try { const detail = fn(); ext.push({ stage, status: 'PROVEN', atMinute: +b.minutes().toFixed(1), detail }); } catch (e) { if (e instanceof BotStop) ext.push({ stage, status: 'NOT_PROVEN', atMinute: +b.minutes().toFixed(1), detail: e.message }); else throw e; } };
    if (!stop && ids) {
      const camp = { fire: ids.fire, g: ids.home };
      const smelt = (recipe: string, n: number) => { for (let left = n; left > 0;) { stoke(b, ids.furnace, ids.home); const f = b.at(ids.furnace, ids.home); const k = Math.min(6, left); for (let q = 0; q < k; q++) b.craft(recipe, f.id); if (!b.runStation(f)) throw new BotStop('furnace stalled'); left -= k; } };
      const charcoal = (n: number) => { if (b.inv('wood') < n * 2 + 6) b.gather('wood', n * 2 + 12, TREES); stoke(b, ids.fire, ids.home); if (b.inv('wood') < n * 2) b.gather('wood', n * 2 + 4, TREES); for (let left = n; left > 0;) { const k = Math.min(6, left); if (b.inv('wood') < k * 2) b.gather('wood', k * 2, TREES); const cf = b.at(ids.fire, ids.home); for (let q = 0; q < k; q++) b.craft('charcoal', cf.id); if (!b.runStation(cf)) throw new BotStop('campfire stalled'); left -= k; if (left) stoke(b, ids.fire, ids.home); } };
      const bench = (recipes: string[]) => { const w = b.at(ids.bench, ids.seep); for (const r of recipes) b.craft(r, w.id); if (!b.runStation(w)) throw new BotStop('bench stalled'); };
      // A player who runs out near camp walks back to ground already seen: the spawn area and the ore field.
      const grounds: [number, number][] = [ids.home, spawnG, [Math.round((ids.home[0] + spawnG[0]) / 2), Math.round((ids.home[1] + spawnG[1]) / 2)], [spawnG[0] + Math.round((spawnG[0] - ids.home[0]) / 2), spawnG[1] + Math.round((spawnG[1] - ids.home[1]) / 2)]];
      // G1A: a salvage node now holds 2-3 units where scrap held 4 and a wreck 8, so the ground near camp runs dry sooner.
      // For Parts the bot walks on, as a player would, to four further grounds a window-slide away from the spawn.
      const farGrounds: [number, number][] = [[90, 0], [-90, 0], [0, 90], [0, -90]].map(([dx, dy]) => [spawnG[0] + dx, spawnG[1] + dy] as [number, number]);
      const need = (item: string, n: number, kinds: string[]) => { for (const g of (kinds === SALVAGE ? [...grounds, ...farGrounds] : grounds)) { if (b.inv(item) >= n) break; b.travel(g[0], g[1]); b.gather(item, n, kinds, 60); care(b, camp); } if (b.inv(item) < n) {
          // census of the window the bot stands in: how many such nodes exist, still hold stock, and can be walked to
          const w = getWorld(); let all = 0, stocked = 0, walkable = 0;
          for (let i = 0; i < w.sourceV3.length; i++) if (kinds.includes(w.sourceV3[i] as string)) { all++; const s = sourceAt(b.r, i % WW, Math.floor(i / WW), b.now); if (s && s.stock > 0) { stocked++; if (b.path(i % WW, Math.floor(i / WW), true)) walkable++; } }
          throw new BotStop(`only ${b.inv(item)}/${n} ${ITEMS[item].name} after searching ${grounds.length} areas; last window census of ${kinds.join('/')}: ${all} nodes, ${stocked} with stock, ${walkable} walkable; carried ${invWeight(b.r).toFixed(1)}/${carryLimit(b.r)} kg`);
        } care(b, camp); };

      // The pack is 24 slots / 60 kg. A second hour of play needs storage: two Wood Chests (8 wood each) at camp.
      const chests: string[] = [];
      const unload = (keep: string[], toolsToo = false) => {
        const KEEP = ['water_flask', 'bandage', 'berries', 'cooked_meat', 'grilled_mushroom', 'wood', 'fiber', ...keep];
        if (chests.length < 2) { b.gather('wood', b.inv('wood') + 16, TREES); b.at(ids.table, ids.home); while (chests.length < 2) chests.push(b.place('chest_small').id); }
        let n = 0; for (const id of chests) n += b.stash(b.at(id, ids.home), KEEP, toolsToo); return n;
      };
      // Tools wear (knife 300, stone tools 180). The bench's Repair action restores them for stone/wood/fiber.
      const service = () => { const worn = (C(b.r, 'inv').slots.filter(Boolean) as { key: string; dur?: number }[]).some(s => ITEMS[s.key].repair && ITEMS[s.key].dur && (s.dur ?? 0) <= ITEMS[s.key].dur! * 0.35); if (!worn) return 0;
        if (b.inv('stone') < 3) b.gather('stone', 3, ['rock'], 4); if (b.inv('wood') < 3) b.gather('wood', 3, TREES, 4); if (b.inv('fiber') < 1) b.gather('fiber', 1, ['reed', 'grass'], 4);
        return b.repairTools(b.at(ids.bench, ids.seep)); };
      attempt('Electric Resistor from a wreck', () => {
        // The only source is the wreck bonus roll. Whatever the Parts run above already dropped counts.
        for (let k = 0; k < 12 && b.inv('electric_resistor') < 1; k++) { const w = b.sources(['wreck', 'road_relay_wreck'], 4)[0]; if (!w) break; b.harvestOne(w); }
        if (b.inv('electric_resistor') < 1) throw new BotStop('no wreck within reach dropped a resistor'); return { carried: b.inv('electric_resistor') };
      });
      care(b, camp);

      attempt('Wooden Ladder: study, craft, lean on a cliff, cross on foot', () => {
        service(); need('spares', BAL.research.directedSparesCost, SALVAGE);
        b.study(b.at(ids.table, ids.home), 'wooden_ladder');
        need('fiber', 3, ['reed', 'grass']); b.craft('rope'); need('wood', 12, TREES); bench(['wooden_ladder']); expect(b.inv('wooden_ladder')).toBe(1);
        // every (stand tile, cliff tile, far tile) triple in the window where the cliff is exactly one tile thick
        let g0 = blockGrid(b.r); const open = (x: number, y: number) => x > 1 && y > 1 && x < WW - 2 && y < WH - 2 && (g0[y * WW + x] === 0 || g0[y * WW + x] === 4);
        let px = 0, py = 0; const faces: { s: [number, number]; c: [number, number]; f: [number, number]; d: number }[] = []; let cliffTiles = 0; const looked: unknown[] = [];
        for (const ground of grounds) { if (faces.length) break; b.travel(ground[0], ground[1]); g0 = blockGrid(b.r); [px, py] = b.tile; cliffTiles = 0;
        for (let y = 2; y < WH - 2; y++) for (let x = 2; x < WW - 2; x++) if (effTile(b.r, x, y) === T.CLIFF) { cliffTiles++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(x - dx, y - dy) && open(x + dx, y + dy)) faces.push({ s: [x - dx, y - dy], c: [x, y], f: [x + dx, y + dy], d: Math.abs(x - px) + Math.abs(y - py) }); }
        looked.push({ around: ground, cliffTiles, oneTileFaces: faces.length }); }
        faces.sort((a, c) => a.d - c.d);
        if (!faces.length) { b.travel(ids.home[0], ids.home[1]); throw new BotStop(`no one-tile cliff face with open ground on both sides in any window visited: ${JSON.stringify(looked)}`); }
        const refusals: Record<string, number> = {}; let tried = 0;
        for (const face of faces.slice(0, 40)) {
          const gs_ = b.toGlobal(...face.s), gc = b.toGlobal(...face.c), gf = b.toGlobal(...face.f); tried++;
          b.travel(gs_[0], gs_[1]); const s = b.toLocal(gs_[0], gs_[1]); const p0 = b.path(s[0], s[1], false); if (!p0 || !b.walk(p0)) { refusals['stand tile not reachable'] = (refusals['stand tile not reachable'] || 0) + 1; continue; }
          const c = b.toLocal(gc[0], gc[1]); const why = buildReason(b.gs, 'ladder_wood', c[0], c[1]); if (why) { refusals[why] = (refusals[why] || 0) + 1; continue; }
          const blockedBefore = !b.path(...b.toLocal(gf[0], gf[1]), false) || b.path(...b.toLocal(gf[0], gf[1]), false)!.length > 2;
          b.must('build', { struct: 'ladder_wood', tx: c[0], ty: c[1] });
          const f = b.toLocal(gf[0], gf[1]); const p = b.path(f[0], f[1], false);
          if (!p || p.length > 3 || !b.walk(p)) throw new BotStop('ladder placed but the far side could not be walked to across it');
          expect(b.toGlobal(...b.tile)).toEqual(gf);
          const detail = { windowsSearched: looked, cliffTilesInWindow: cliffTiles, oneTileFaces: faces.length, facesTried: tried, refusals, tilesFromCamp: face.d, crossedFrom: gs_, over: gc, crossedTo: gf, farSideNeededADetourBefore: blockedBefore };
          const back = b.path(...b.toLocal(gs_[0], gs_[1]), false); if (back) b.walk(back); b.travel(ids.home[0], ids.home[1]); return detail;
        }
        b.travel(ids.home[0], ids.home[1]);
        throw new BotStop(`${faces.length} one-tile faces, ${tried} tried, all refused: ${JSON.stringify(refusals)}`);
      });
      care(b, camp);

      attempt('Large Furnace: study, plates, craft, place, smelt', () => {
        service(); unload(['spares', 'iron_ore', 'iron_ingot', 'refined_iron_ingot', 'iron_plate', 'charcoal', 'stone']);
        need('spares', BAL.research.directedSparesCost + 4, SALVAGE);
        // 8 ingots for the pack + 6 for 4 Refined Iron (two plate crafts); ingots already carried count
        const oreShort = Math.max(0, 14 - b.inv('iron_ingot')); if (oreShort) { need('iron_ore', oreShort, ['iron', 'coalv']); care(b, camp); smelt('iron_ingot', b.inv('iron_ore')); }
        b.study(b.at(ids.table, ids.home), 'large_furnace');
        charcoal(8); smelt('refined_iron_ingot', 2); bench(['iron_plate', 'iron_plate']);
        // The pack bill weighs 59.2 kg against a 60 kg carry limit: 36 stone alone is 43.2 kg. The bot does what a
        // player must: leaves everything but the pick in the chests, hauls the stone, then swaps the pick for the metal.
        const billKg = RECIPES.large_furnace.ins.reduce((n, [k, q]) => n + ITEMS[k].w * q, 0);
        service(); unload(['stone_pick', 'stone', 'knife'], true); care(b, camp);
        need('stone', 36, ['rock']);
        unload(['stone', 'knife'], true); for (const id of chests) b.withdraw(b.at(id, ids.home), ['iron_ingot', 'iron_plate', 'charcoal']);
        bench(['large_furnace']); expect(b.inv('large_furnace')).toBe(1);
        for (const id of chests) b.withdraw(b.at(id, ids.home), ['stone_pick', 'stone_axe', 'knife', 'wood_spear', 'iron_ore']);
        b.at(ids.bench, ids.seep); const big = b.place('large_furnace'); need('iron_ore', 2, ['iron', 'coalv']); stoke(b, big.id, ids.seep);
        const lf = b.at(big.id, ids.seep); const t0 = b.now; b.craft('iron_ingot', lf.id); if (!b.runStation(lf)) throw new BotStop('large furnace stalled');
        return { smeltSeconds: +((b.now - t0) / 1000).toFixed(1), ordinaryFurnaceSeconds: RECIPES.iron_ingot.secs, packBillKg: +billKg.toFixed(1), carryLimitKg: carryLimit(b.r), packKg: ITEMS.large_furnace.w };
      });
      care(b, camp);

      attempt('Iron Plate Pants: study, hunt hide, sew, wear', () => {
        for (const id of chests) b.withdraw(b.at(id, ids.home), ['stone_pick', 'stone_axe', 'knife', 'wood_spear']);
        service(); unload(['spares', 'iron_ore', 'iron_ingot', 'refined_iron_ingot', 'iron_plate', 'charcoal', 'hide', 'cloth', 'needle_thread']); care(b, camp);
        need('spares', BAL.research.directedSparesCost * 2 + 2, SALVAGE);
        const table = () => b.at(ids.table, ids.home); b.study(table(), 'needle_thread'); b.study(table(), 'iron_plate_pants');
        for (let k = 0; k < 30 && b.inv('hide') < 3; k++) { if (!b.hunt(['deer', 'boar'], 30, 60)) { const g = grounds[k % grounds.length]; b.travel(g[0], g[1]); } b.pickupNearby(); care(b, camp); }
        if (b.inv('hide') < 3) throw new BotStop(`only ${b.inv('hide')}/3 hide after ${b.hunts} hunts (kills ${JSON.stringify(b.kills)}); carried ${invWeight(b.r).toFixed(1)}/${carryLimit(b.r)} kg: ${C(b.r, 'inv').slots.map(s => s ? s.key + 'x' + s.qty : '-').join(' ')}; hide on the ground: ${Object.values(b.r.entities).filter(e => (e as any).stack?.key === 'hide' || (e as any).item?.key === 'hide').length}`);
        const short = Math.max(0, 5 - b.inv('iron_ingot')); if (short) { need('iron_ore', short, ['iron', 'coalv']); smelt('iron_ingot', b.inv('iron_ore')); } charcoal(2); smelt('refined_iron_ingot', 1);
        need('fiber', 24, ['reed', 'grass']); bench(['cloth', 'cloth', 'cloth', 'cloth']); bench(['needle_thread', 'needle_thread', 'iron_plate']); bench(['iron_plate_pants']);
        const slot = b.slotOf('iron_plate_pants'); if (slot < 0) throw new BotStop('pants were not produced'); b.must('useItem', { slot });
        const worn = C(b.r, 'eq').slots.map(s => s?.key ?? null); expect(worn).toContain('iron_plate_pants'); return { worn };
      });
    }
    // Pinned: on this build every extension closes too. A regression shows up here with the engine's refusal text.
    expect(ext.filter(s => s.status !== 'PROVEN'), JSON.stringify(ext, null, 1)).toEqual([]);
    evidence.route_oil = { seed: 7, startingPack: startInv, startingRecipes: startRecipes, stages, extensions: ext, end: b.summary(), swingsThatNeverConnected: b.failures, notes: b.log };
    expect(stop, JSON.stringify(stages, null, 1)).toBe('');
    expect(stages.map(s => s.stage)).toEqual(['reach a crude seep', 'camp (campfire, stone tools, furnace)', 'iron ore -> 22 ingots', 'Parts from roadside scrap and wrecks', 'research Glass', 'Glass, Charcoal, Refined Iron', 'Workbench level 2 beside the seep', 'craft Gear and Pipe', 'Oil Pump placed on the seep', 'pump Crude Petroleum', 'Refinery -> Fuel Canister']);
    expect(b.p.dead).toBe(false);
  }, 900000);

  // FOOD. Root Broth, Herb Roast and Salted Roast are retired; what is left to eat early is berries, grilled marsh caps
  // and roast meat. This measures whether a New Game can stay fed and watered on that alone.
  it.each([7, 11, 23])('ROUTE FOOD (seed %i): one game-hour from spawn on berries, marsh caps and hunted meat — no retired food', (seed) => {
    const b = new Bot(seed); const MIN = 60; let stop = '', foodMs = 0, waterMs = 0, hpMin = 100, hungerMin = 100, thirstMin = 100; const used: Record<string, number> = {};
    const track = () => { hpMin = Math.min(hpMin, b.p.hp); hungerMin = Math.min(hungerMin, b.p.hunger); thirstMin = Math.min(thirstMin, b.p.thirst); };
    const edible = () => ['cooked_meat', 'grilled_mushroom', 'grouse_egg', 'berries'].find(k => b.inv(k) > 0);
    let camp: { fire: string; g: [number, number] } | null = null;
    const cook = (raw: string, recipe: string) => {
      if (!camp) { b.gather('wood', 12, TREES); b.gather('stone', 3, ['rock']); const f = b.place('campfire'); camp = { fire: f.id, g: b.toGlobal(...b.tile) as [number, number] }; }
      stoke(b, camp.fire, camp.g); const fire = b.at(camp.fire, camp.g); const n = Math.min(6, b.inv(raw)); for (let k = 0; k < n; k++) b.craft(recipe, fire.id); b.runStation(fire);
    };
    try {
      while (b.minutes() < MIN) {
        track();
        if (b.p.thirst < 55) { const t0 = b.now; if (!b.drink()) throw new BotStop('no fresh water could be reached'); waterMs += b.now - t0; }
        if (b.p.hunger < 60) {
          const t0 = b.now;
          if (!edible()) {
            if (b.gather('berries', 9, ['bush'], 5) || b.inv('berries') > 0) used.berry_bush = (used.berry_bush || 0) + 1;
            else if (b.gather('mushroom', 6, ['mushroom'], 8) || b.inv('mushroom') > 0) { used.marsh_caps = (used.marsh_caps || 0) + 1; cook('mushroom', 'grilled_mushroom'); }
            else { for (let k = 0; k < 6 && b.inv('meat') < 2; k++) b.hunt(['hare', 'grouse', 'deer', 'boar', 'fox', 'crab'], 25, 40); if (b.inv('meat') > 0) { used.hunting = (used.hunting || 0) + 1; cook('meat', 'cooked_meat'); } }
          }
          for (let k = 0; k < 14 && b.p.hunger < 88; k++) { const f = edible(); if (!f || !b.eat(f)) break; }
          foodMs += b.now - t0;
          if (b.p.hunger < 60 && !edible()) { b.note('nothing edible could be obtained this cycle'); b.wait(20000); }
        }
        b.wait(5000);
      }
    } catch (e) { if (e instanceof BotStop) stop = e.message; else throw e; }
    track();
    const eaten = Object.entries(b.ate).reduce((n, [k, q]) => n + FOOD_VALUE(k) * q, 0), drain = BAL.player.hungerDrainPerMin * b.minutes();
    const row = { seed, survivedMinutes: +b.minutes().toFixed(1), died: stop || null, hungerDrainPoints: Math.round(drain), hungerEatenPoints: eaten, ate: b.ate, sourcesUsed: used, minutesSpentOnFood: +(foodMs / 60000).toFixed(1), minutesSpentOnWater: +(waterMs / 60000).toFixed(1), shareOfTimeOnFoodAndWater: +((foodMs + waterMs) / (b.now - (b as any).constructor.T0 || 1)).toFixed(3), hpMin: Math.round(hpMin), hungerMin: Math.round(hungerMin), thirstMin: Math.round(thirstMin), end: b.summary(), notes: b.log };
    row.shareOfTimeOnFoodAndWater = +((foodMs + waterMs) / (b.minutes() * 60000)).toFixed(3);
    ((evidence.route_food as unknown[]) ??= []).push(row);
    expect(stop, JSON.stringify(row)).toBe('');
    expect(b.p.dead).toBe(false);
    expect(hungerMin, 'never starving').toBeGreaterThan(0);
    expect(thirstMin, 'never parched').toBeGreaterThan(0);
    for (const k of Object.keys(b.ate)) expect(['root_broth', 'herb_roast', 'salted_meat']).not.toContain(k);
  }, 900000);
});
