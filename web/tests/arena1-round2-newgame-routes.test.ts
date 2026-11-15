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
// Every stage is recorded as a checkpoint. A stage that cannot be completed is recorded as NOT_PROVEN with the
// engine's own refusal text; the assertions below pin exactly which stages are proven on this build.
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ITEMS, RECIPES, STRUCTS, WORKBENCH_UPGRADE } from '../src/game/catalog';
import { BAL, T, TILE, WW, WH } from '../src/game/core';
import { C, buildReason, effTile, ensureOilSeeps } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
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
      const PARTS = 33; if (!b.gather('spares', PARTS, ['scrap', 'wreck'], 40)) throw new BotStop(`only ${b.inv('spares')}/${PARTS} Parts within reach`);
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
      b.gather('wood', 20, TREES); b.at(bench.id, seep.g);   // the Refinery must stand near the level-2 bench
      const refinery = b.place('refinery'); b.fuel(refinery, 'wood');
      b.craft('refinery_fuel', refinery.id); b.craft('refinery_fuel', refinery.id); if (!b.runStation(refinery)) throw new BotStop('refinery stalled');
      expect(b.inv('fuel_can') - windfallFuel).toBe(2); expect(b.inv('crude_petroleum')).toBe(0);
      done(stageName, { fuelCans: 2, bill: RECIPES.refinery_fuel.ins });
    } catch (e) { if (e instanceof BotStop) { stop = e.message; stages.push({ stage: stageName, status: 'NOT_PROVEN', atMinute: +b.minutes().toFixed(1), detail: stop }); } else throw e; }

    evidence.route_oil = { seed: 7, startingPack: startInv, startingRecipes: startRecipes, stages, end: b.summary(), swingsThatNeverConnected: b.failures, notes: b.log };
    expect(stop, JSON.stringify(stages, null, 1)).toBe('');
    expect(stages.map(s => s.stage)).toEqual(['reach a crude seep', 'camp (campfire, stone tools, furnace)', 'iron ore -> 22 ingots', 'Parts from roadside scrap and wrecks', 'research Glass', 'Glass, Charcoal, Refined Iron', 'Workbench level 2 beside the seep', 'craft Gear and Pipe', 'Oil Pump placed on the seep', 'pump Crude Petroleum', 'Refinery -> Fuel Canister']);
    expect(b.p.dead).toBe(false);
  }, 900000);
});
