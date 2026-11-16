// G1A — three industrial salvage sources on Veyra.
//
// What this file proves, and how:
//   * ENGINE-LEVEL, not a browser play-through. Movement and swings are real `tick()` input through the same
//     ACT_ON_TARGET flow the client uses; saves go through the real serializer + `validate()`.
//   * Tools for the tool-comparison matrix are handed to the player with `addItem` (test tooling), and for that
//     matrix the player is stood next to the source by the test. The "walked" case uses real pathing only.
//   * The legacy save fixture was written by the code at baseline 3f80bf4f (before G1A), not by this branch.
// It proves nothing about how the art looks on screen.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SOURCES, ITEMS, G1A_HARVEST, INDUSTRIAL_SALVAGE, isIndustrialSalvage } from '../src/game/catalog';
import { T, TILE, WW, WH, type GameState } from '../src/game/core';
import { C, addItem, blockGrid, harvestHit, sourceAt, newGame, startRun } from '../src/game/engine';
import { tick } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
import { SRC_KEYS, getWorld, setActiveLayout } from '../src/game/world';
import { sourceDigest, G1A_ROADSIDE_WEIGHTS } from '../src/game/world-economy';
import { getWindowWorld, getWindowWorldForGlobalTile, getVeyraPlacementRules, setVeyraPlacementRules, G1A_POI_WEIGHTS, type WindowWorld } from '../src/veyra05/window';
import { layoutIdAt } from '../src/veyra05/scenes';
import { shiftVeyraWindowBy, windowOrigin } from '../src/veyra05/continuity';
import { applyFloor } from '../src/veyra05/floors';
import { POIS } from '../src/veyra05/reader';
import { getPoiLayout } from '../src/veyra05/poi-kit';
import { Bot } from './helpers/newgame-bot';

const TRIO = INDUSTRIAL_SALVAGE as readonly string[];
const [BALE, RELAY, RACK] = TRIO;
const FIX = JSON.parse(readFileSync(new URL('./fixtures/g1a-legacy-veyra-save-3f80bf4f.info.json', import.meta.url), 'utf8'));
const legacySave = () => JSON.parse(JSON.parse(readFileSync(new URL('./fixtures/g1a-legacy-veyra-save-3f80bf4f.json', import.meta.url), 'utf8')).payload);
const snap = (gs: GameState) => JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
const MASTER = JSON.parse(readFileSync(new URL('../ref/last-island-copy-first/ITEM_CRAFTING_MASTER.json', import.meta.url), 'utf8'));

const drops = (b: Bot) => Object.values(b.r.entities).filter(e => e.kind === 'drop');
const dropKeys = (b: Bot) => drops(b).map(e => C(b.r, e.c!).slots[0]?.key).filter(Boolean) as string[];
const count = (ww: WindowWorld) => { const c: Record<string, number> = {}; for (const s of ww.floors.ground.sources) if (s) c[s] = (c[s] ?? 0) + 1; return c; };

/** Stand the player on a free tile beside a source (test positioning; the swing itself is real input). */
function standBeside(b: Bot, tx: number, ty: number, from = 0): boolean {
  const g = blockGrid(b.r);
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]].slice(from)) { const nx = tx + dx, ny = ty + dy; if (g[ny * WW + nx] === 0) { b.p.x = nx * TILE + 8; b.p.y = ny * TILE + 8; b.p.vx = 0; b.p.vy = 0; return true; } }
  return false;
}
interface HitLog { hit: number; hpBefore: number; hpAfter: number; units: number; drops: string[]; durSpent: number; ms: number }
/** Swing the held tool at one source until it is empty (or `maxHits`). Every row is one landed hit. */
function strike(b: Bot, tool: string, gx: number, gy: number, maxHits = 99, reposition = false): HitLog[] {
  if (!b.hold(tool)) throw new Error('cannot hold ' + tool);
  const log: HitLog[] = []; let t0 = -1, stale = 0, side = 0;
  for (let k = 0; k < 3000 && log.length < maxHits; k++) {
    const [tx, ty] = b.toLocal(gx, gy); const s0 = sourceAt(b.r, tx, ty, b.now)!; if (s0.stock <= 0) break;
    const slot = C(b.r, 'inv').slots[b.p.active]!; const dur0 = slot.dur ?? 0; const d0 = drops(b).map(e => e.id);
    b.step({ mx: tx * TILE + 8, my: ty * TILE + 8, attack: true, attackPressed: !b.p.action }, false);
    const [ux, uy] = b.toLocal(gx, gy); const s1 = sourceAt(b.r, ux, uy, b.now)!;
    if (s1.hp >= s0.hp && reposition && !log.length && ++stale > 40 && side < 3) { stale = 0; standBeside(b, ux, uy, ++side); }   // this side cannot be struck (line of sight): try the next
    if (s1.hp < s0.hp) {
      if (t0 < 0) t0 = b.now;
      const fresh = drops(b).filter(e => !d0.includes(e.id)).map(e => C(b.r, e.c!).slots[0]!.key);
      log.push({ hit: log.length + 1, hpBefore: s0.hp, hpAfter: s1.hp, units: s0.stock - s1.stock, drops: fresh, durSpent: dur0 - (C(b.r, 'inv').slots[b.p.active]?.dur ?? 0), ms: b.now - t0 });
    }
  }
  return log;
}
function nearest(b: Bot, key: string, skip = new Set<string>()): [number, number] {
  for (const s of b.sources([key], 40)) { const g = b.toGlobal(s.tx, s.ty); if (!skip.has(g.join())) return g; }
  throw new Error('no ' + key + ' in this window');
}
/** A run whose window holds all three archetypes (searches real New Game seeds; no hand-picked coordinate). */
function runWithTrio(min = 6, from = 1): Bot {
  for (let seed = from; seed < from + 60; seed++) { const b = new Bot(seed); const c = count(getWindowWorld(b.r.layoutId!)); if (TRIO.every(k => (c[k] ?? 0) >= min)) return b; }
  throw new Error('no seed with all three archetypes');
}

describe('G1A catalog contract', () => {
  it('registers exactly the three archetypes with the work-order HP / stock and the G1A-R1 pools (SOH_PROVISIONAL)', () => {
    expect(TRIO).toEqual(['road_salvage_bale', 'road_relay_wreck', 'road_fuel_rack']);
    // G1A-R1 (Control Tower corrective): Parts 2 per unit on Bale / Relay Wreck (was 1); Fuel Rack 1 Part per unit for certain (was 40%) and Fuel Canister 20% (was 6%); Relay Wreck components 25 / 20 / 14% (were 15 / 12 / 6).
    expect(SOURCES[BALE]).toMatchObject({ hp: 9, stock: 3, yields: [['spares', 2]], block: true, art: 'salvage_bale' });
    expect(SOURCES[RELAY]).toMatchObject({ hp: 12, stock: 3, yields: [['spares', 2]], bonus: [['electronic_parts', 0.25], ['electric_resistor', 0.2], ['mechanical_gear', 0.14]], block: true, art: 'relay_wreck' });
    expect(SOURCES[RACK]).toMatchObject({ hp: 12, stock: 2, yields: [['tin_can', 1], ['spares', 1]], bonus: [['fuel_can', 0.2]], block: true, art: 'fuel_rack' });
    // work-order pool for the bale, plus Metal Pipe / Iron Plate, kept by Control Tower decision (G1A-R1)
    expect(SOURCES[BALE].bonus).toEqual([['tin_can', 0.25], ['needle_tube', 0.07], ['metal_pipe', 0.05], ['iron_plate', 0.04]]);
    expect(new Set(TRIO.map(k => SOURCES[k].art)).size).toBe(3);
  });
  it('mints only master items that a world source may issue; nothing forbidden', () => {
    const items = new Map<string, any>(MASTER.items.map((r: any) => [r.id, r]));
    const forbidden = /crude_petroleum|creator|core_|field_core|rcash|card|blueprint/;
    for (const k of TRIO) for (const [id] of [...SOURCES[k].yields, ...(SOURCES[k].bonus ?? [])]) {
      expect(ITEMS[id], id).toBeTruthy(); expect(items.has(id), `${id} in 157 master`).toBe(true);
      expect(['WORLD_ONLY', 'BOTH']).toContain(items.get(id).acquire_policy); expect(forbidden.test(id), id).toBe(false);
    }
  });
  it('leaves the frozen legacy tables alone', () => {
    expect(SRC_KEYS).toEqual(['oak', 'pine', 'snowpine', 'palm', 'willow', 'deadtree', 'rock', 'iron', 'coalv', 'crystal', 'salt_shale', 'sulfur', 'bush', 'grass', 'reed', 'herb', 'mushroom', 'scrap', 'wreck']);
    expect(SOURCES.scrap).toMatchObject({ hp: 8, stock: 4, block: false, art: 'scrap', bonus: [['tin_can', 0.35], ['needle_tube', 0.1]] });
    expect(SOURCES.wreck).toMatchObject({ hp: 30, stock: 8, block: true, art: 'wreck' });
    expect(SOURCES.scrap.harvestBy).toBeUndefined(); expect(SOURCES.wreck.harvestBy).toBeUndefined();
    // global tool power / combat numbers are untouched by G1A
    expect(ITEMS.knife.power).toMatchObject({ scrap: 1 }); expect(ITEMS.stone_pick.power).toMatchObject({ scrap: 2 }); expect(ITEMS.iron_pick.power).toMatchObject({ scrap: 4 }); expect(ITEMS.industrial_pick.power).toMatchObject({ scrap: 7 });
    expect(ITEMS.cleaver.power).toEqual({ plant: 3 }); expect(ITEMS.machete.power).toEqual({ plant: 3 });
    expect([ITEMS.knife.dmg, ITEMS.cleaver.dmg, ITEMS.machete.dmg]).toEqual([9, 17, 24]);
    expect(G1A_HARVEST).toEqual({ stone_axe: 1, stone_pick: 1, knife: 2, cleaver: 3, machete: 4, iron_pick: 1, industrial_pick: 1 });
  });
});

describe('G1A placement (rules 4) vs frozen legacy placement (rules 3)', () => {
  it('rules 3 is byte-identical to the baseline commit: digests pinned from code at 3f80bf4f', () => {
    for (const [k, dig] of Object.entries(FIX.legacyDigests as Record<string, string>)) {
      const [ox, oy] = k.split(',').map(Number);
      expect(sourceDigest(getWindowWorld(layoutIdAt(ox, oy), 3).floors.ground.sources), k).toBe(dig);
    }
  });
  it('new placement holds the three archetypes only; legacy placement holds none of them', () => {
    let v3Salvage = 0, v4Road = 0, v4Poi = 0; const mix: Record<string, number> = {};
    const sample = ['po_siloc', 'po_kestrel', 'po_ridgestop', 'po_ember', 'po_falls', 'po_greywater', 'po_ironvein', 'po_slag'];
    for (const id of sample) {
      const [tx, ty] = getPoiLayout(id).atTile;
      setVeyraPlacementRules(3); const a = getWindowWorldForGlobalTile(tx, ty); setVeyraPlacementRules(4); const b = getWindowWorldForGlobalTile(tx, ty);
      const ca = count(a), cb = count(b);
      expect(TRIO.some(k => ca[k]), id + ' legacy has no new id').toBe(false);
      expect((cb.scrap ?? 0) + (cb.wreck ?? 0), id + ' new placement has no scrap/wreck').toBe(0);
      v3Salvage += (ca.scrap ?? 0) + (ca.wreck ?? 0);
      const g = b.floors.ground, m = b.world.economyMap;
      for (let i = 0; i < WW * WH; i++) {
        const k = g.sources[i]; if (!isIndustrialSalvage(k)) continue;
        const x = i % WW, y = (i / WW) | 0; const poi = !!g.protectedCells[i];
        if (poi) v4Poi++; else { v4Road++; mix[k!] = (mix[k!] ?? 0) + 1; }
        // never on a road, floor, wall or water tile; never on authored collision or an authored object
        expect([T.ROAD, T.FLOOR, T.PWALL, T.CLIFF, T.DEEP, T.SHALLOW, T.RIVER]).not.toContain(g.tiles[i]);
        expect(m.road[i], `${id} ${x},${y} road`).toBe(0); expect(g.walkable[i], `${id} ${x},${y} walk`).toBe(1); expect(g.solidProps[i], `${id} ${x},${y} ${k} solidProp poi=${poi}`).toBe(0);
        expect([...g.statics, ...g.lootStatics].some(s => Math.abs(s.tx - x) <= (poi ? 2 : 0) && Math.abs(s.ty - y) <= (poi ? 2 : 0))).toBe(false);
        // all eight neighbours are open ground: it can always be walked round, so it cannot plug a one-tile gap
        if (x < 1 || y < 1 || x >= WW - 1 || y >= WH - 1) continue;   // window rim: neighbours belong to the next window
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * WW + x + dx; expect(g.walkable[j], `${id} ${x},${y}`).toBe(1); }
        // no two solid sources touch edge-to-edge
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = g.sources[(y + dy) * WW + x + dx]; expect(!!(n && SOURCES[n].block), `${id} ${x},${y} touches ${n}`).toBe(false); }
      }
      // upper / lower storeys never carry a source of the trio
      for (const [lv, layer] of b.floors.layers) if (lv !== 0) expect(layer.sources.some(isIndustrialSalvage)).toBe(false);
    }
    const road = v4Road, share = (k: string) => (mix[k] ?? 0) / road;
    // roadside REPLACES the legacy salvage share: not denser than before, and not thinned to nothing
    expect(road).toBeLessThanOrEqual(v3Salvage); expect(road).toBeGreaterThan(v3Salvage * 0.75);
    expect(share(BALE)).toBeGreaterThan(0.54); expect(share(BALE)).toBeLessThan(0.66);
    expect(share(RELAY)).toBeGreaterThan(0.20); expect(share(RELAY)).toBeLessThan(0.30);
    expect(share(RACK)).toBeGreaterThan(0.11); expect(share(RACK)).toBeLessThan(0.19);
    expect(v4Poi).toBeGreaterThan(0);
    expect(G1A_ROADSIDE_WEIGHTS).toEqual([[BALE, 60], [RELAY, 25], [RACK, 15]]);
  }, 300000);
  it('POI slots follow the archetype table and are not forced into every site', () => {
    setVeyraPlacementRules(4);
    const per = (id: string) => { const l = getPoiLayout(id), ww = getWindowWorldForGlobalTile(l.atTile[0], l.atTile[1]), g = ww.floors.ground, c: Record<string, number> = {}; const [x0, y0, x1, y1] = l.bbox;
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const x = gx - ww.win.originTx, y = gy - ww.win.originTy; if (x < 0 || y < 0 || x >= WW || y >= WH) continue; const i = y * WW + x; if (g.protectedCells[i] && isIndustrialSalvage(g.sources[i])) c[g.sources[i]!] = (c[g.sources[i]!] ?? 0) + 1; } return c; };
    const wh = per('po_siloc'), fac = per('po_kestrel'), stop = per('po_ridgestop'), village = per('po_greywater'), grove = per('po_glade');
    expect((wh[BALE] ?? 0)).toBeGreaterThan(0); expect(wh[RACK]).toBeUndefined();          // warehouse: bales (+ the odd relay), never a fuel rack
    expect((fac[RELAY] ?? 0)).toBeGreaterThan(0); expect(fac[RACK]).toBeUndefined();        // facility: relay wrecks
    expect((stop[RACK] ?? 0) + (stop[BALE] ?? 0)).toBeGreaterThan(0); expect(stop[RELAY]).toBeUndefined(); // road stop: fuel racks / bales
    expect(village).toEqual({}); expect(grove).toEqual({});                                 // homes and groves get none
    expect(Object.keys(G1A_POI_WEIGHTS)).not.toContain('village');
  }, 300000);
  it('placement is a function of global coordinates: overlapping windows agree, so a window change never duplicates or moves a source', () => {
    setVeyraPlacementRules(4);
    const a = getWindowWorld(layoutIdAt(1408, 1280)), b = getWindowWorld(layoutIdAt(1472, 1280)); let same = 0, diff = 0;
    for (let y = 24; y < WH - 24; y++) for (let x = 64 + 24; x < WW - 24; x++) {
      const ka = a.floors.ground.sources[y * WW + x], kb = b.floors.ground.sources[y * WW + (x - 64)];
      if (isIndustrialSalvage(ka) || isIndustrialSalvage(kb)) { if (ka === kb) same++; else diff++; }
    }
    expect(same).toBeGreaterThan(20); expect(diff).toBe(0);
  }, 120000);
});

describe('G1A interaction — real swings', () => {
  it('walked case: a New Game player reaches each archetype on foot and breaks it with a Stone Axe; items fall as world drops over several hits', () => {
    const b = runWithTrio(); addItem(b.r, 'inv', 'stone_axe', 1);
    const out: Record<string, HitLog[]> = {};
    for (const key of TRIO) {
      let g: [number, number] | null = null; const skip = new Set<string>();
      for (let n = 0; n < 12 && !g; n++) { const c = nearest(b, key, skip); if (b.goNearGlobal(c[0], c[1])) g = c; else skip.add(c.join()); }
      expect(g, 'walkable route to a ' + key).toBeTruthy();
      const log = strike(b, 'stone_axe', g![0], g![1]); out[key] = log; const def = SOURCES[key];
      expect(log.length).toBe(def.hp);                                   // 1 damage per hit
      expect(log[0].units).toBe(0);                                      // the first hit never pays out
      expect(log.reduce((s, h) => s + h.units, 0)).toBe(def.stock);
      expect(Math.max(...log.map(h => h.units))).toBe(1);                // stock leaves one unit at a time, at HP thresholds
      expect(log.every(h => h.durSpent === 1)).toBe(true);               // every landed hit wears the tool
      for (const h of log) expect(h.drops.filter(k => k === def.yields[0][0]).length).toBeGreaterThanOrEqual(h.units);
      const [tx, ty] = b.toLocal(g![0], g![1]);
      // depleted: no stock, no collision, and further swings pay nothing
      expect(sourceAt(b.r, tx, ty, b.now)!.stock).toBe(0); expect(blockGrid(b.r)[ty * WW + tx]).toBe(0);
      const before = 0; for (let k = 0; k < 60; k++) b.step({ mx: tx * TILE + 8, my: ty * TILE + 8, attack: true, attackPressed: !b.p.action }, false);
      void before; expect(b.r.receipts.filter((x: any) => JSON.stringify(x).includes(`${key}@${tx},${ty} -`)).length).toBe(def.stock);   // exactly `stock` unit releases, ever
      expect(harvestHit(b.gs, tx, ty, {}, b.now, b.p.x, b.p.y, { tool: 'machete' }).result).toBe('empty');
    }
  }, 300000);

  it('tool matrix: measured hits and time per archetype (Stone Axe 1 / Knife 2 / Cleaver 3 / Machete 4 / picks 1)', () => {
    const b = runWithTrio(12); const tools = ['stone_axe', 'knife', 'cleaver', 'machete', 'iron_pick', 'stone_pick', 'industrial_pick', 'iron_axe'];
    const used = new Set<string>(); const table: Record<string, Record<string, { hits: number; ms: number; units: number[] }>> = {};
    for (const key of TRIO) { table[key] = {}; for (const tool of tools) {
      let g: [number, number] | null = null;
      for (let n = 0; n < 40 && !g; n++) { const c = nearest(b, key, used); used.add(c.join()); const [tx, ty] = b.toLocal(c[0], c[1]); if (standBeside(b, tx, ty)) g = c; }
      { const inv = C(b.r, 'inv'); for (let i = 0; i < inv.slots.length; i++) if (inv.slots[i] && tools.includes(inv.slots[i]!.key)) inv.slots[i] = null; addItem(b.r, 'inv', tool, 1); }   // one test tool carried at a time
      const log = strike(b, tool, g![0], g![1], 99, true); const dmg = G1A_HARVEST[tool] ?? 1;
      expect(log.length, `${tool} on ${key}`).toBe(Math.ceil(SOURCES[key].hp / dmg));
      expect(log.reduce((s, h) => s + h.units, 0)).toBe(SOURCES[key].stock);
      expect(log[0].units, `${tool} on ${key}: never the whole stock on hit 1`).toBeLessThan(SOURCES[key].stock);
      expect(log.every(h => h.durSpent === 1)).toBe(true);
      table[key][tool] = { hits: log.length, ms: log[log.length - 1].ms, units: log.map(h => h.units) };
    } }
    for (const key of TRIO) {
      const r = table[key];
      expect(r.knife.hits).toBeLessThan(r.stone_axe.hits); expect(r.cleaver.hits).toBeLessThan(r.knife.hits); expect(r.machete.hits).toBeLessThanOrEqual(r.cleaver.hits);
      expect(r.machete.ms).toBeLessThan(r.knife.ms); expect(r.knife.ms).toBeLessThan(r.stone_axe.ms);
      // no pick or axe out-harvests the Machete through its inherited `power.scrap`
      for (const t of ['iron_pick', 'stone_pick', 'industrial_pick', 'iron_axe']) expect(r[t].hits).toBe(SOURCES[key].hp);
    }
    mkdirSync(new URL('../evidence/g1a/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../evidence/g1a/tool-matrix.json', import.meta.url), JSON.stringify({ note: 'ENGINE-LEVEL measurement via tick(); ms = sim time from first to last landed hit; units = stock released per hit. SOH_PROVISIONAL tuning.', swingMs: Object.fromEntries(tools.map(t => [t, ITEMS[t].swing])), table }, null, 1) + '\n');
  }, 300000);

  it('bare hands and non-player power do nothing; a full inventory loses nothing; swing spam cannot duplicate', () => {
    const b = runWithTrio(); const g = nearest(b, BALE); let [tx, ty] = b.toLocal(g[0], g[1]);
    // an "area" hit that carries huge scrap power but no tool id is refused: power.scrap is not consulted
    expect(harvestHit(b.gs, tx, ty, { scrap: 99, stone: 99, ore: 99, wood: 99 }, b.now, b.p.x, b.p.y).result).toBe('nopower');
    expect(harvestHit(b.gs, tx, ty, { scrap: 99 }, b.now, b.p.x, b.p.y, { tool: 'fists' }).result).toBe('yield');   // unlisted id with scrap power: capped at 1
    expect(sourceAt(b.r, tx, ty, b.now)!.hp).toBe(SOURCES[BALE].hp - 1);
    expect(harvestHit(b.gs, tx, ty, {}, b.now, b.p.x, b.p.y, { tool: 'torch' }).result).toBe('nopower');
    // full inventory: every unit still lands on the ground as a drop entity and stays there
    const inv = C(b.r, 'inv'); for (let i = 0; i < inv.slots.length; i++) if (!inv.slots[i]) addItem(b.r, 'inv', 'stone_axe', 1);
    expect(inv.slots.every(Boolean)).toBe(true);
    const g2 = nearest(b, RELAY); [tx, ty] = b.toLocal(g2[0], g2[1]); expect(standBeside(b, tx, ty)).toBe(true);
    const d0 = drops(b).length; const log = strike(b, 'knife', g2[0], g2[1]);
    expect(log.reduce((s, h) => s + h.units, 0)).toBe(3);
    b.pickupNearby(); const onGround = dropKeys(b).filter(k => k === 'spares').length;
    expect(onGround + b.inv('spares')).toBeGreaterThanOrEqual(3); expect(drops(b).length).toBeGreaterThan(d0);
    // spam: 400 ticks of held attack on a fresh bale releases exactly its stock, once
    const g3 = nearest(b, BALE, new Set([g.join()])); [tx, ty] = b.toLocal(g3[0], g3[1]); expect(standBeside(b, tx, ty)).toBe(true); b.hold('knife');
    const receipts0 = b.r.receipts.length; for (let k = 0; k < 400; k++) b.step({ mx: tx * TILE + 8, my: ty * TILE + 8, attack: true, attackPressed: true }, false);
    const rel = b.r.receipts.slice(receipts0).filter((x: any) => JSON.stringify(x).includes(`harvest`) && JSON.stringify(x).includes(`${BALE}@${tx},${ty}`));
    expect(rel.length).toBe(3); expect(sourceAt(b.r, tx, ty, b.now)!.stock).toBe(0);
  }, 300000);
});

describe('G1A save compatibility', () => {
  const reload = (gs: GameState) => validate(snap(gs));
  it('a new Veyra run is pinned to rules 4, survives save/load with partial damage, and never refills', () => {
    const b = runWithTrio(); expect(b.r.sourceMap!.rules).toBe(4); expect(b.r.sourceLayoutVersion).toBe(3);
    const g = nearest(b, RELAY); let [tx, ty] = b.toLocal(g[0], g[1]); expect(standBeside(b, tx, ty)).toBe(true);
    strike(b, 'knife', g[0], g[1], 3);                                    // 12 -> 6 HP, one unit out
    [tx, ty] = b.toLocal(g[0], g[1]); const mid = sourceAt(b.r, tx, ty, b.now)!; expect([mid.hp, mid.stock]).toEqual([6, 2]);
    const gs2 = reload(b.gs); expect(gs2, 'rules-4 save validates').toBeTruthy();
    expect(gs2!.run!.sourceMap!.rules).toBe(4); expect(gs2!.run!.sources[ty * WW + tx]).toMatchObject({ hp: 6, stock: 2 });
    strike(b, 'knife', g[0], g[1]); [tx, ty] = b.toLocal(g[0], g[1]); expect(sourceAt(b.r, tx, ty, b.now)!.stock).toBe(0);
    const gs3 = reload(b.gs)!; expect(gs3.run!.sources[ty * WW + tx].stock).toBe(0);
    // tampering fails closed: wrong rules for this digest, wrong digest, unknown rules
    const raw = () => snap(b.gs);
    const t1 = raw(); t1.run.sourceMap.rules = 3; expect(validate(t1)).toBeNull();
    const t2 = raw(); t2.run.sourceMap.digest = '00000000'; expect(validate(t2)).toBeNull();
    const t3 = raw(); t3.run.sourceMap.rules = 5; expect(validate(t3)).toBeNull();
    const empty = getWorld().sourceV3.findIndex(k => !k); const t4 = raw(); t4.run.sources[String(empty)] = { hp: 1, stock: 1 }; expect(validate(t4)).toBeNull();   // state on a tile with no source
    setVeyraPlacementRules(4);
  }, 300000);

  it('window crossing and floor changes keep rules, damage and identity; nothing new appears', () => {
    const b = runWithTrio(); const g = nearest(b, BALE); let [tx, ty] = b.toLocal(g[0], g[1]); expect(standBeside(b, tx, ty)).toBe(true);
    strike(b, 'knife', g[0], g[1], 2);                                    // 9 -> 5 HP
    [tx, ty] = b.toLocal(g[0], g[1]); const [ox] = windowOrigin(b.r); const dir = tx > WW / 2 ? 64 : -64;   // slide so the damaged source stays inside the new window
    const ww0 = getWindowWorld(b.r.layoutId!); const total0 = Object.values(count(ww0)).reduce((s, n) => s + n, 0);
    expect(shiftVeyraWindowBy(b.gs, dir, 0, () => {})).toBe(true); expect(windowOrigin(b.r)[0]).toBe(ox + dir);
    expect(b.r.sourceMap!.rules).toBe(4);
    [tx, ty] = b.toLocal(g[0], g[1]); const s = sourceAt(b.r, tx, ty, b.now)!; expect([s.key, s.hp, s.stock]).toEqual([BALE, 5, 2]);
    expect(reload(b.gs), 'save after a window shift validates').toBeTruthy();
    expect(shiftVeyraWindowBy(b.gs, -dir, 0, () => {})).toBe(true);
    [tx, ty] = b.toLocal(g[0], g[1]); const back = sourceAt(b.r, tx, ty, b.now)!; expect([back.key, back.hp, back.stock]).toEqual([BALE, 5, 2]);
    expect(Object.values(count(getWindowWorld(b.r.layoutId!))).reduce((s2, n) => s2 + n, 0)).toBe(total0);
    // storey round trip in a multi-storey window
    setVeyraPlacementRules(4); const l = getPoiLayout('po_kestrel'); const ww = getWindowWorldForGlobalTile(l.atTile[0], l.atTile[1]);
    const before = ww.floors.ground.sources.slice(), dig = sourceDigest(before); const up = [...ww.floors.layers.keys()].find(k => k !== 0)!;
    const gs = newGame(); setActiveLayout(layoutIdAt(ww.win.originTx, ww.win.originTy)); const rc = startRun(gs, 'male', Date.UTC(2026, 10, 14, 12), null, 7, { inspectAt: undefined } as any);
    if (rc.ok && gs.run && gs.run.layoutId === layoutIdAt(ww.win.originTx, ww.win.originTy)) { applyFloor(gs, ww, ww.floors, up as any); expect(getWorld().sourceV3.some(isIndustrialSalvage)).toBe(false); applyFloor(gs, ww, ww.floors, 0 as any); }
    expect(sourceDigest(ww.floors.ground.sources)).toBe(dig); expect(ww.floors.ground.sources).toEqual(before);
    setActiveLayout('veyra05-world');
  }, 300000);

  it('a real pre-G1A Veyra save (written by baseline 3f80bf4f) loads with its scrap/wreck and its lost HP/stock', () => {
    const gs = validate(legacySave()); expect(gs, 'legacy save validates').toBeTruthy(); const r = gs!.run!;
    expect(r.sourceMap!.rules).toBe(3); expect(r.sourceMap!.digest).toBe(FIX.sourceMap.digest); expect(getVeyraPlacementRules()).toBe(3);
    setActiveLayout(r.layoutId!); const w = getWorld();
    expect(w.sourceV3.some(isIndustrialSalvage), 'old run sees no new archetype').toBe(false);
    expect(w.sourceV3.filter(k => k === 'scrap' || k === 'wreck').length).toBeGreaterThan(10);
    const [ox, oy] = windowOrigin(r); const wk = FIX.hits.find((h: any) => h.kind === 'wreck'), sc = FIX.hits.find((h: any) => h.kind === 'scrap');
    const wi = (wk.gy - oy) * WW + (wk.gx - ox); expect(w.sourceV3[wi]).toBe('wreck'); expect(r.sources[wi]).toMatchObject({ hp: wk.hp, stock: wk.stock });
    const now = r.clock.lastSimAt + 50; tick(gs!, { up: false, down: false, left: false, right: false, mx: 0, my: 0, attack: false, attackPressed: false, roll: false, cancel: false } as any, 50, now);
    // legacy mechanics unchanged: knife (power.scrap 1) takes 1 HP; a machete (no scrap power) is refused
    expect(harvestHit(gs!, wk.gx - ox, wk.gy - oy, ITEMS.machete.power!, now, r.player.x, r.player.y, { tool: 'machete' }).result).toBe('nopower');
    expect(harvestHit(gs!, wk.gx - ox, wk.gy - oy, ITEMS.knife.power!, now, r.player.x, r.player.y, { tool: 'knife' }).result).toBe('yield');
    expect(r.sources[wi].hp).toBe(wk.hp - 1);
    expect(shiftVeyraWindowBy(gs!, -64, 0, () => {})).toBe(true); expect(r.sourceMap!.rules).toBe(3);
    const [ox2, oy2] = windowOrigin(r); const si = (sc.gy - oy2) * WW + (sc.gx - ox2);
    expect(getWorld().sourceV3[si]).toBe('scrap'); expect(r.sources[si]).toMatchObject({ hp: sc.hp, stock: sc.stock });
    expect(getWorld().sourceV3.some(isIndustrialSalvage)).toBe(false);
    const again = validate(snap(gs!)); expect(again, 'legacy run still validates after play + window shift').toBeTruthy(); expect(again!.run!.sourceMap!.rules).toBe(3);
    // a legacy digest presented as rules 4 is rejected, not migrated
    const forged = legacySave(); forged.run.sourceMap.rules = 4; expect(validate(forged)).toBeNull();
    setVeyraPlacementRules(4); setActiveLayout('veyra05-world');
  }, 300000);

  it('non-Veyra layouts keep the legacy placement and refuse rules 4', () => {
    setActiveLayout('shipping_fresh'); const gs = newGame(); const rc = startRun(gs, 'male', Date.UTC(2026, 10, 14, 12), null, 11); expect(rc.ok).toBe(true);
    expect(gs.run!.sourceMap!.rules).toBe(3); const w = getWorld(); expect(w.sourceV3.some(isIndustrialSalvage)).toBe(false); expect(w.sourceV3.some(k => k === 'scrap')).toBe(true);
    const raw = snap(gs); expect(validate(raw)).toBeTruthy(); raw.run.sourceMap.rules = 4; expect(validate(raw)).toBeNull();
    setActiveLayout('veyra05-world');
  }, 120000);
});

describe('G1A regression: basic Parts stay reachable from many New Game spawns', () => {
  it('every sampled spawn has salvage of the trio within walking reach, and none of the legacy kind', () => {
    const rows: any[] = [];
    for (let seed = 101; seed <= 112; seed++) {
      const b = new Bot(seed); const c = count(getWindowWorld(b.r.layoutId!)); const near = b.sources([...TRIO], 40);
      const within = (d: number) => near.filter(s => s.d <= d).length; const bale = b.sources([BALE], 1)[0];
      rows.push({ seed, layout: b.r.layoutId, bale: c[BALE] ?? 0, relay: c[RELAY] ?? 0, rack: c[RACK] ?? 0, within40: within(40), within80: within(80), nearestBale: bale?.d ?? null });
      { const w3 = getWindowWorld(b.r.layoutId!, 3).floors.ground.sources, [px, py] = b.tile; let best = 1e9; for (let i = 0; i < w3.length; i++) if (w3[i] === 'scrap' || w3[i] === 'wreck') best = Math.min(best, Math.abs((i % WW) - px) + Math.abs(((i / WW) | 0) - py)); rows[rows.length - 1].legacyNearest = best === 1e9 ? null : best; rows[rows.length - 1].newNearest = near[0]?.d ?? null; }
      const c3 = count(getWindowWorld(b.r.layoutId!, 3)); const legacy = (c3.scrap ?? 0) + (c3.wreck ?? 0); rows[rows.length - 1].legacySalvage = legacy;
      expect((c.scrap ?? 0) + (c.wreck ?? 0)).toBe(0);
      // a start window that had roadside salvage before still has it now (a roadless window had none before either)
      if (legacy >= 5) expect((c[BALE] ?? 0) + (c[RELAY] ?? 0) + (c[RACK] ?? 0)).toBeGreaterThan(0);
    }
    for (const r of rows) { if (r.legacyNearest === null) expect(r.legacySalvage).toBe(0); else expect(r.newNearest, `seed ${r.seed}: nearest salvage is no farther than under the legacy placement`).toBeLessThanOrEqual(r.legacyNearest); }
    mkdirSync(new URL('../evidence/g1a/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../evidence/g1a/spawn-reach.json', import.meta.url), JSON.stringify({ note: 'ENGINE-LEVEL. Manhattan tile distance from the New Game spawn; counts are per 200x200 start window.', rows }, null, 1) + '\n');
  }, 600000);
});

// Full-world distribution report. Slow (every POI window, both rule sets): run with WRITE_G1A=1.
describe.runIf(process.env.WRITE_G1A === '1')('G1A distribution report', () => {
  it('writes evidence/g1a/distribution.json', () => {
    const seenCell = new Set<number>(), seenLegacy = new Set<number>(), seenWin = new Set<string>();
    const road: Record<string, number> = {}, roadBiome: Record<string, Record<string, number>> = {}, site: Record<string, Record<string, number>> = {}; let legacyScrap = 0, legacyWreck = 0; const wins: any[] = [];
    for (const p of POIS) {
      const l = getPoiLayout(p.id); let ww4: WindowWorld, ww3: WindowWorld;
      try { setVeyraPlacementRules(3); ww3 = getWindowWorldForGlobalTile(l.atTile[0], l.atTile[1]); setVeyraPlacementRules(4); ww4 = getWindowWorldForGlobalTile(l.atTile[0], l.atTile[1]); } catch { continue; }
      const ox = ww4.win.originTx, oy = ww4.win.originTy, wk = `${ox},${oy}`; if (seenWin.has(wk)) continue; seenWin.add(wk);
      const g = ww4.floors.ground, g3 = ww3.floors.ground, wr: Record<string, number> = { legacyScrap: 0, legacyWreck: 0 };
      for (let i = 0; i < WW * WH; i++) {
        const gid = (oy + ((i / WW) | 0)) * 4000 + ox + (i % WW);
        const k3 = g3.sources[i]; if (k3 === 'scrap' || k3 === 'wreck') { wr[k3 === 'scrap' ? 'legacyScrap' : 'legacyWreck']++; if (!seenLegacy.has(gid)) { seenLegacy.add(gid); if (k3 === 'scrap') legacyScrap++; else legacyWreck++; } }
        const k = g.sources[i]; if (!isIndustrialSalvage(k)) continue; wr[k!] = (wr[k!] ?? 0) + 1;
        if (seenCell.has(gid)) continue; seenCell.add(gid);
        const pi = ww4.poiAt![i];
        if (pi >= 0 && g.protectedCells[i]) { const s = (site[POIS[pi].id] ??= {}); s[k!] = (s[k!] ?? 0) + 1; }
        else { road[k!] = (road[k!] ?? 0) + 1; const bm = ww4.world.economyMap.biome[i]; const rb = (roadBiome[bm] ??= {}); rb[k!] = (rb[k!] ?? 0) + 1; }
      }
      wins.push({ window: wk, ...wr });
    }
    const roadTotal = Object.values(road).reduce((s, n) => s + n, 0), legacy = legacyScrap + legacyWreck;
    const bySite = POIS.map(p => ({ poi: p.id, arche: p.arche, ...(site[p.id] ?? {}), total: Object.values(site[p.id] ?? {}).reduce((s, n) => s + n, 0) }));
    const byArche: Record<string, Record<string, number>> = {};
    for (const r of bySite) { const a = (byArche[r.arche] ??= { sites: 0, sitesWithAny: 0 }); a.sites++; if (r.total) a.sitesWithAny++; for (const k of TRIO) if ((r as any)[k]) a[k] = (a[k] ?? 0) + (r as any)[k]; }
    const out = { note: 'ENGINE-LEVEL placement census over every distinct 200x200 window that holds a POI anchor; cells are de-duplicated by global coordinate, so overlapping windows are counted once. A POI slot is attributed to the site that owns its cell. SOH_PROVISIONAL.',
      windows: wins.length, roadside: { legacySalvage: legacy, legacyScrap, legacyWreck, newTotal: roadTotal, ratioNewToLegacy: +(roadTotal / legacy).toFixed(3), byArchetype: road, share: Object.fromEntries(Object.entries(road).map(([k, n]) => [k, +(n / roadTotal).toFixed(3)])), byBiome: roadBiome, windowsWithNoSalvage: wins.filter(w => !TRIO.some(k => w[k])).length, windowsWithNoLegacySalvage: wins.filter(w => !w.legacyScrap && !w.legacyWreck).length },
      poi: { sites: bySite.length, sitesWithAny: bySite.filter(r => r.total).length, total: bySite.reduce((s, r) => s + r.total, 0), byArche, bySite }, byWindow: wins };
    mkdirSync(new URL('../evidence/g1a/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../evidence/g1a/distribution.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    expect(roadTotal).toBeGreaterThan(0);
    for (const r of bySite) for (const k of TRIO) if ((r as any)[k]) expect((G1A_POI_WEIGHTS[r.arche] ?? []).some(([id]) => id === k), `${r.poi} (${r.arche}) holds ${k}`).toBe(true);
  }, 1800000);
});
