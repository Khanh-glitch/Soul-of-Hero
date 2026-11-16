// G1A-R1 — is scavenging still worth it? Before / after comparison in real play, plus the expected-value tables.
//
// What this is:
//   * ENGINE BOT, not a human and not a browser. Movement and swings are real `tick()` input, crafting and pick-up are real
//     `dispatch()` intents. Nothing is granted: every run is a real New Game with the starting pack only.
//   * The SAME bot script plays every variant. The only thing that changes between columns is the salvage layer:
//       legacy     = placement rules 3 (Roadside Scrap / Car Wreck), as a save started before G1A plays;
//       committed  = G1A as committed at 3b0926de (Parts x1 per unit, Fuel Canister 6%);
//       r1         = the catalog as it is now.
//     `legacy` is produced by re-pointing a fresh run at placement rules 3 before its first tick (the run then validates as a
//     rules-3 save). `committed` overrides the three catalog rows for the duration of the run (test-only what-if).
//   * The bot does not know the map. It looks only at salvage within SIGHT tiles of where it stands; when it sees none it
//     walks on in a fixed search pattern and looks again. `walkedBlind` counts those legs.
// Slow: runs only with WRITE_G1A=1; writes evidence/g1a/play-compare.json and evidence/g1a/economy.json.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SOURCES, ITEMS, RECIPES, INDUSTRIAL_SALVAGE, G1A_HARVEST, STRUCTS, WORKBENCH_UPGRADE } from '../src/game/catalog';
import { TILE } from '../src/game/core';
import { C, sourceAt, invWeight, carryLimit } from '../src/game/engine';
import { serializeSnapshot, validate } from '../src/game/persist';
import { getWorld } from '../src/game/world';
import { mapDigest } from '../src/game/map-package';
import { sourceDigest } from '../src/game/world-economy';
import { getWindowWorld, resetWindowToGround, setVeyraPlacementRules } from '../src/veyra05/window';
import { windowOrigin } from '../src/veyra05/continuity';
import { WRECK_PARTS_BONUS } from '../src/game/wreck-economy';
import { Bot } from './helpers/newgame-bot';

const [BALE, RELAY, RACK] = INDUSTRIAL_SALVAGE as readonly string[];
const SALV = ['scrap', 'wreck', BALE, RELAY, RACK];
const TREES = ['oak', 'pine', 'snowpine', 'willow', 'palm'];
type Row = { yields: [string, number][]; bonus: [string, number][] };
type Table = Record<string, Row>;
const COMMITTED: Table = {
  [BALE]: { yields: [['spares', 1]], bonus: [['tin_can', 0.25], ['needle_tube', 0.07], ['metal_pipe', 0.05], ['iron_plate', 0.04]] },
  [RELAY]: { yields: [['spares', 1]], bonus: [['electronic_parts', 0.15], ['electric_resistor', 0.12], ['mechanical_gear', 0.06]] },
  [RACK]: { yields: [['tin_can', 1]], bonus: [['spares', 0.4], ['fuel_can', 0.06]] },
};
const current = (): Table => Object.fromEntries([BALE, RELAY, RACK].map(k => [k, { yields: SOURCES[k].yields.map(y => [...y] as [string, number]), bonus: (SOURCES[k].bonus ?? []).map(y => [...y] as [string, number]) }]));
const withTable = <T,>(t: Table | null, fn: () => T): T => {
  if (!t) return fn(); const keep = current();
  for (const k of Object.keys(t)) { SOURCES[k].yields = t[k].yields; SOURCES[k].bonus = t[k].bonus; }
  try { return fn(); } finally { for (const k of Object.keys(keep)) { SOURCES[k].yields = keep[k].yields; SOURCES[k].bonus = keep[k].bonus; } }
};
const rackWith = (fuel: number, spares = 0.4, extra: [string, number][] = []): Row => ({ yields: [['tin_can', 1]], bonus: [['spares', spares], ['fuel_can', fuel], ...extra] });
const x2 = (r: Row): Row => ({ yields: [['spares', 2]], bonus: r.bonus });

/** A fresh New Game re-pointed at the legacy placement before its first tick. It validates as a rules-3 save. */
function legacyBot(seed: number): Bot {
  const b = new Bot(seed); setVeyraPlacementRules(3); resetWindowToGround(getWindowWorld(b.r.layoutId!, 3));
  const md = mapDigest(getWorld(b.r.layoutId!)); b.r.sourceMap!.rules = 3; b.r.sourceMap!.digest = sourceDigest(getWorld(b.r.layoutId!).sourceV3); b.r.sourceMap!.mapDigest = md; if (b.r.airdrops) b.r.airdrops.mapDigest = md;
  expect(validate(JSON.parse(JSON.parse(serializeSnapshot(b.gs)).payload)), 'legacy run validates').toBeTruthy();
  return b;
}

const SIGHT = 28;            // tiles: roughly what a player has seen on screen and just around it at 640x360
const LIMIT_MIN = 30, GOALS = [10, 33, 60, 120];
const ITEMS_OF_INTEREST = ['spares', 'tin_can', 'needle_tube', 'metal_pipe', 'iron_plate', 'electronic_parts', 'electric_resistor', 'mechanical_gear', 'fuel_can'];

function scavenge(b: Bot) {
  let dist = 0; const gp = () => { const [ox, oy] = windowOrigin(b.r); return [ox * TILE + b.p.x, oy * TILE + b.p.y]; }; let last = gp();
  const step0 = b.step.bind(b); b.step = ((inp: any, d: any) => { step0(inp, d); const g = gp(); const dd = Math.hypot(g[0] - last[0], g[1] - last[1]); if (dd < 4 * TILE) dist += dd / TILE; last = g; }) as any;
  const spawn = b.toGlobal(...b.tile) as [number, number];
  const seen = (rad: number) => b.sources(SALV, 400).filter(s => s.d <= rad).length;
  const startNear = { within28: seen(28), within60: seen(60), inWindow: seen(999) };
  const dur = (k: string) => C(b.r, 'inv').slots.find(s => s?.key === k)?.dur ?? null;
  const knife0 = dur('knife');
  // ---- harvesting tool: the knife is in the starting pack; the Stone Axe is made by hand
  const makeAxe = () => { b.gather('wood', 3, TREES, 6); b.gather('stone', 3, ['rock'], 6); if (b.inv('rope') < 1) { b.gather('fiber', 3, ['grass', 'reed'], 8); if (b.inv('fiber') >= 3) b.craft('rope'); } if (b.inv('wood') >= 3 && b.inv('stone') >= 3 && b.inv('rope') >= 1) { b.craft('stone_axe'); return true; } return false; };
  const gotAxe = makeAxe(); const axeAtMin = gotAxe ? +b.minutes().toFixed(1) : null; const axeDist = Math.round(dist);
  const reached: Record<number, { minute: number; walkedTiles: number; nodes: number } | null> = Object.fromEntries(GOALS.map(g => [g, null]));
  let nodes = 0, blind = 0, packFull = 0, axesMade = gotAxe ? 1 : 0, wornOut = 0, stop = '', maxSlots = 0, maxKg = 0, farthest = 0, leg = 0; const left: Record<string, number> = {}, byKind: Record<string, number> = {};
  const LEGS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  let bandaged = 0;
  try { while (b.minutes() < LIMIT_MIN && b.inv('spares') < GOALS[GOALS.length - 1]) {
    if (b.p.dead) { stop = 'died'; break; }
    for (let k = 0; k < 4 && b.p.hp < 70 && b.inv('bandage') > 0; k++) { b.act('useItem', { slot: b.slotOf('bandage') }); bandaged++; }
    if (b.p.thirst < 45) b.drink();
    if (b.p.hunger < 45) { if (b.inv('berries') < 1) b.gather('berries', 4, ['bush'], 4); for (let k = 0; k < 6 && b.p.hunger < 80 && b.eat('berries'); k++); }
    const cands = b.sources(SALV, 8).filter(s => s.d <= SIGHT);
    if (!cands.length) {
      // nothing in sight: walk on one leg of a fixed outward search pattern (no map knowledge), then look again
      if (leg >= LEGS.length * 3) { stop = 'searched 24 legs without seeing salvage'; break; }
      const ring = 1 + Math.floor(leg / LEGS.length), [dx, dy] = LEGS[leg % LEGS.length]; leg++; blind++;
      b.travel(spawn[0] + dx * 45 * ring, spawn[1] + dy * 45 * ring); continue;
    }
    const first = sourceAt(b.r, cands[0].tx, cands[0].ty, b.now)!;
    if (!b.toolFor(first.def)) { wornOut++; if (!makeAxe()) { stop = 'no working tool and could not make a Stone Axe'; break; } axesMade++; continue; }
    let done = false;
    for (const s of cands) {
      const before = b.inv('spares'); const g = b.toGlobal(s.tx, s.ty);
      if (!b.harvestOne(s)) continue;
      done = true; nodes++; byKind[s.key] = (byKind[s.key] ?? 0) + 1; farthest = Math.max(farthest, Math.abs(g[0] - spawn[0]) + Math.abs(g[1] - spawn[1]));
      // what stayed on the ground because the pack would not take it
      const lying = Object.values(b.r.entities).filter(e => e.kind === 'drop' && Math.hypot(e.x - b.p.x, e.y - b.p.y) < 3 * TILE);
      if (lying.length && !C(b.r, 'inv').slots.includes(null)) { packFull++; for (const e of lying) { const st = C(b.r, e.c!).slots[0]; if (st) left[st.key] = (left[st.key] ?? 0) + st.qty; } }
      maxSlots = Math.max(maxSlots, C(b.r, 'inv').slots.filter(Boolean).length); maxKg = Math.max(maxKg, invWeight(b.r));
      for (const goal of GOALS) if (!reached[goal] && b.inv('spares') >= goal) reached[goal] = { minute: +b.minutes().toFixed(1), walkedTiles: Math.round(dist), nodes };
      void before; break;
    }
    if (!done) { if (leg >= LEGS.length * 3) { stop = 'salvage in sight could not be reached'; break; } const ring = 1 + Math.floor(leg / LEGS.length), [dx, dy] = LEGS[leg % LEGS.length]; leg++; blind++; b.travel(spawn[0] + dx * 45 * ring, spawn[1] + dy * 45 * ring); }
  } } catch (e) { stop = 'stopped: ' + String((e as Error).message).slice(0, 120); }
  if (!stop) stop = b.inv('spares') >= GOALS[GOALS.length - 1] ? 'reached 120 Parts' : 'time limit (30 game-minutes)';
  const parts = b.inv('spares');
  return {
    layout: b.r.layoutId, salvageAtStart: startNear, stoneAxe: { made: gotAxe, atMinute: axeAtMin, walkedTiles: axeDist }, harvestToolAtMinute0: 'knife (starting pack)',
    stop, minutes: +b.minutes().toFixed(1), walkedTiles: Math.round(dist), nodesHarvested: nodes, nodesByKind: byKind, parts,
    partsPerNode: nodes ? +(parts / nodes).toFixed(2) : 0, partsPer100Tiles: dist ? +(parts / dist * 100).toFixed(1) : 0, partsPerMinuteAfterAxe: +(parts / Math.max(0.1, b.minutes() - (axeAtMin ?? 0))).toFixed(2),
    reached, carried: Object.fromEntries(ITEMS_OF_INTEREST.map(k => [k, b.inv(k)]).filter(([, n]) => (n as number) > 0)),
    tools: { knife: { start: knife0, end: dur('knife'), of: ITEMS.knife.dur }, stoneAxe: { end: dur('stone_axe'), of: ITEMS.stone_axe.dur }, stoneAxesMade: axesMade, timesNoWorkingTool: wornOut },
    pack: { timesFull: packFull, leftOnGround: left, maxSlotsUsed: maxSlots, of: C(b.r, 'inv').slots.length, maxKg: +maxKg.toFixed(1), limitKg: carryLimit(b.r) },
    search: { walkedBlindLegs: blind, farthestNodeFromSpawn: farthest, salvageStillStandingInCurrentWindow: b.sources(SALV, 400).length, salvageLeftWithin28OfSpawn: (() => { const [lx, ly] = b.toLocal(spawn[0], spawn[1]); return b.sources(SALV, 400).filter(s => Math.abs(s.tx - lx) + Math.abs(s.ty - ly) <= 28).length; })() },
    swingsThatNeverConnected: b.failures, survival: { bandagesUsed: bandaged, hp: Math.round(b.p.hp), hunger: Math.round(b.p.hunger), thirst: Math.round(b.p.thirst), dead: !!b.p.dead },
  };
}

// ---------- expected value (pure arithmetic on the committed census + the source tables) ----------
const LEGACY_ROWS: Table = {
  scrap: { yields: SOURCES.scrap.yields as [string, number][], bonus: (SOURCES.scrap.bonus ?? []) as [string, number][] },
  wreck: { yields: SOURCES.wreck.yields as [string, number][], bonus: (SOURCES.wreck.bonus ?? []).filter(([k]) => k !== 'damaged_drive').map(([k, p]) => [k, k === 'spares' ? WRECK_PARTS_BONUS : p] as [string, number]) },
};
const stockOf = (k: string) => SOURCES[k].stock;
function expected(counts: Record<string, number>, t: Table) {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) { if (!t[k]) continue; for (const [it, q] of [...t[k].yields, ...t[k].bonus]) out[it] = (out[it] ?? 0) + n * stockOf(k) * q; }
  return Object.fromEntries(ITEMS_OF_INTEREST.map(k => [k, +(out[k] ?? 0).toFixed(1)]));
}
const HITS: Record<string, Record<string, number>> = { stone_axe: {}, knife: {}, cleaver: {}, machete: {} };
for (const tool of Object.keys(HITS)) for (const k of [BALE, RELAY, RACK]) HITS[tool][k] = Math.ceil(SOURCES[k].hp / G1A_HARVEST[tool]);

describe.runIf(process.env.WRITE_G1A === '1')('G1A-R1 before / after', () => {
  it('expected value per candidate table -> evidence/g1a/economy.json', () => {
    const census = JSON.parse(readFileSync(new URL('../evidence/g1a/world-census.json', import.meta.url), 'utf8'));
    const roadLegacy = { scrap: census.legacy.scrap, wreck: census.legacy.wreck };
    const road = { [BALE]: census.g1a.roadside[BALE] ?? 0, [RELAY]: census.g1a.roadside[RELAY] ?? 0, [RACK]: census.g1a.roadside[RACK] ?? 0 };
    const poi = { [BALE]: census.g1a.poi[BALE] ?? 0, [RELAY]: census.g1a.poi[RELAY] ?? 0, [RACK]: census.g1a.poi[RACK] ?? 0 };
    const all = Object.fromEntries(Object.keys(road).map(k => [k, road[k] + poi[k]]));
    const cur = current();
    const cands: Record<string, Table> = {
      'committed 3b0926de (Parts x1, fuel 6%)': COMMITTED,
      'A: Bale+Relay Parts x2, rack unchanged': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: COMMITTED[RACK] },
      'A + fuel 10%': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: rackWith(0.10) },
      'A + fuel 15%': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: rackWith(0.15) },
      'A + fuel 20%': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: rackWith(0.20) },
      'A + fuel 25%': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: rackWith(0.25) },
      'A + fuel 20% + rack Parts certain (= R1)': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: { yields: [['tin_can', 1], ['spares', 1]], bonus: [['fuel_can', 0.2]] } },
      'A + rack B (fuel 6%, Parts 100%, pipe 15%)': { [BALE]: x2(COMMITTED[BALE]), [RELAY]: x2(COMMITTED[RELAY]), [RACK]: rackWith(0.06, 1, [['metal_pipe', 0.15]]) },
      'R1 as coded now': cur,
    };
    const base = expected(roadLegacy, LEGACY_ROWS);
    const pct = (e: Record<string, number>) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, base[k] ? +((v / base[k] - 1) * 100).toFixed(1) : null]));
    const rows = Object.fromEntries(Object.entries(cands).map(([name, t]) => {
      const r = expected(road, t), a = expected(all, t), rk = t[RACK]; const pFuel = rk.bonus.find(([k]) => k === 'fuel_can')?.[1] ?? 0;
      return [name, { roadside: r, roadsideVsLegacyPct: pct(r), roadsidePlusPoi: a, roadsidePlusPoiVsLegacyPct: pct(a),
        fuelRack: { fuelCansPer100Racks: +(100 * stockOf(RACK) * pFuel).toFixed(1), chanceOfAtLeastOnePerRack: +(1 - (1 - pFuel) ** stockOf(RACK)).toFixed(4), chanceOfNone: +((1 - pFuel) ** stockOf(RACK)).toFixed(4), partsPer100Racks: +(100 * stockOf(RACK) * [...rk.yields, ...rk.bonus].filter(([k]) => k === 'spares').reduce((n, [, q]) => n + q, 0)).toFixed(1) } }];
    }));
    const per100 = (t: Table, keys: string[], counts: Record<string, number>) => { const n = keys.reduce((s, k) => s + (counts[k] ?? 0), 0); const e = expected(Object.fromEntries(keys.map(k => [k, counts[k] ?? 0])), t); return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, +(v / n * 100).toFixed(1)])); };
    const perSourceParts = (t: Table, k: string) => stockOf(k) * [...t[k].yields, ...t[k].bonus].filter(([i]) => i === 'spares').reduce((s, [, q]) => s + q, 0);
    const hitsTable = (t: Table) => Object.fromEntries(Object.keys(HITS).map(tool => [tool, Object.fromEntries([BALE, RELAY, RACK].map(k => [k, { hitsPerSource: HITS[tool][k], partsPer100Hits: +(perSourceParts(t, k) / HITS[tool][k] * 100).toFixed(1) }]))]));
    const legacyHits = { note: 'legacy nodes use the material power table (Knife 1, Stone Axe 1): one hit = one HP', scrap: { hitsPerSource: SOURCES.scrap.hp, partsPer100Hits: +(4 / 8 * 100).toFixed(1) }, wreck: { hitsPerSource: SOURCES.wreck.hp, partsPer100Hits: +(8 * (1 + WRECK_PARTS_BONUS) / 30 * 100).toFixed(1) } };
    const fuelUse = { refinery: Object.values(RECIPES).filter(r => r.out === 'fuel_can').map(r => ({ recipe: (r as any).alias ?? r.out, station: r.station, ins: r.ins, qty: r.qty, secs: r.secs })) };
    const out = {
      note: 'Stock-weighted expectation if every unit of every counted node is harvested (arithmetic on world-census.json and the source tables; not measured play). Legacy = Roadside Scrap + Car Wreck (wreck Parts bonus 0.7 as the engine applies it). SOH_PROVISIONAL.',
      counts: { legacyRoadside: roadLegacy, g1aRoadside: road, g1aPoi: poi },
      legacyRoadsideExpected: base, candidates: rows,
      per100Sources: { legacy: per100(LEGACY_ROWS, ['scrap', 'wreck'], roadLegacy), committed: per100(COMMITTED, [BALE, RELAY, RACK], road), r1: per100(cur, [BALE, RELAY, RACK], road) },
      per100Hits: { legacy: legacyHits, committed: hitsTable(COMMITTED), r1: hitsTable(cur) },
      partsDemand: { researchTable: STRUCTS.research.cost, workbenchL2: WORKBENCH_UPGRADE.cost, gear: RECIPES.mechanical_gear.ins, pipeX2: RECIPES.metal_pipe.ins, plateX2: RECIPES.iron_plate.ins, note: 'first industrial step used by the oil route: 33 Parts (table 6, Glass study 9, bench L2 4, Gear 3, two Pipe jobs 4, pump 2, refinery 5)' },
      fuelCanisterOtherRoutes: fuelUse,
      weights: Object.fromEntries(ITEMS_OF_INTEREST.map(k => [k, { kg: ITEMS[k].w, stack: ITEMS[k].max }])),
    };
    writeFileSync(new URL('../evidence/g1a/economy.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    expect(base.spares).toBeGreaterThan(0);
  });

  it('three representative starts, same bot, three salvage layers -> evidence/g1a/play-compare.json', () => {
    const STARTS = [{ seed: 103, kind: 'favourable (salvage a few steps from spawn)' }, { seed: 102, kind: 'average (first salvage about 14 tiles away)' }, { seed: 112, kind: 'unfavourable (first salvage about 56 tiles away)' }];
    const runs: any[] = [];
    for (const st of STARTS) {
      const row: any = { ...st };
      row.legacy = scavenge(legacyBot(st.seed));
      row.committed = withTable(COMMITTED, () => scavenge(new Bot(st.seed)));
      row.r1 = scavenge(new Bot(st.seed));
      runs.push(row);
      if (existsSync(new URL('../evidence/g1a/', import.meta.url))) writeFileSync(new URL('../evidence/g1a/play-compare.json', import.meta.url), JSON.stringify({ partial: true, runs }, null, 1) + '\n');
    }
    const out = {
      note: 'ENGINE BOT (not a human, not a browser). Real New Game per run, starting pack only, no grants. Same script for every column; the bot sees salvage only within ' + SIGHT + ' tiles and searches blind otherwise. Goals: 10 Parts (Research Table 6 + Workbench L2 4), 33 Parts (first industrial step of the oil route), 60 and 120 Parts (bench L3, generator, gears and pipes beyond it). Limit ' + LIMIT_MIN + ' game-minutes. SOH_PROVISIONAL.',
      runs,
    };
    writeFileSync(new URL('../evidence/g1a/play-compare.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    expect(runs.length).toBe(STARTS.length);
  }, 3600000);
});
