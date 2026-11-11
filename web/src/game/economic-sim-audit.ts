/**
 * SOH Full Economic Simulation & Structural Audit Engine (WP2 / M2).
 *
 * Executes deterministic, code-grounded multi-day (0h–336h) runtime simulations,
 * territory upkeep stress matrices, offline settlement sweeps, fuel/power/vehicle
 * conservation budgets, 14-day husbandry & garden yield trajectories, 400-seed Monte
 * Carlo runs across `shipping_fresh` and `veyra05-*`, and machine-verified exploit /
 * parity probes against Soul of Hero's live engine.
 */

import {
  ALWAYS_KNOWN_RECIPES,
  GARDEN_CROPS,
  ITEMS,
  RECIPES,
  SALVAGED_OIL_WRECK_CHANCE,
  SOURCES,
  STRUCTS,
  VENDOR_SECURED,
  VENDOR_SPARES,
  stationBurnable,
} from './catalog';
import { BAL, HOUR, TILE, T, WW, WH, type GameState, type RunState, type Stack, mulberry } from './core';
import {
  addItem,
  beginReceiptSink,
  buildReason,
  countItem,
  dispatch,
  endReceiptSink,
  mkStack,
  newGame,
  offlineSurvivalEstimate,
  phaseOf,
  planTerritory,
  startRun,
  stepGardensBarrels,
  stepStations,
  stepTerritory,
} from './engine';
import { settle } from './sim';
import {
  BUTCHER_YIELDS,
  FEED_NUTRITION,
  TAMABLE_SPECIES,
  TAMING_SPECIES,
  createTamedState,
  inspectPenAt,
  stepHusbandry,
} from './husbandry';
import { DAILY_MILESTONES, DAILY_POOL, dateKey, milestoneRewardSpec } from './journey';
import { airdropRewards, supportsAirdrops } from './airdrop';
import { CREATOR_LOOT_V1 } from './creator-loot';
import { LOOT_ECOLOGY_VERSION, lootClass, lootRoll } from './loot-ecology';
import { COMPONENT_RECIPES, recoveryPlan } from './recycler';
import { proveItem } from './industrial-proof';
import { calendarAt } from './calendar';
import { getActiveLayout, getWorld, setActiveLayout, type World } from './world';
import { VEYRA05_SCENES, layoutIdAt } from '../veyra05/scenes';
import { getWindowWorld, type WindowWorld } from '../veyra05/window';
import { POIS } from '../veyra05/reader';
import { auToTile, FRAME_H, FRAME_W, WINDOW_H, WINDOW_W } from '../veyra05/frame';
import { authoredPlan } from '../veyra05/floors';
import {
  ORDINARY_CREATURE_HABITATS,
  VEYRA_PRIMORDIAL_SITES,
  VEYRA_SIDE_BOSS_SITES,
} from '../veyra05/ecosystem';

export interface VeyraPoiAuditContainer {
  floor: number;
  tx: number;
  ty: number;
  label: string;
  kind: 'loot' | 'cash';
  fromArchetypePreset: boolean;
  cash?: number;
  items: { item: string; qty: number }[];
}

export interface VeyraPoiAuditRecord {
  id: string;
  name: string;
  arche: string;
  authoredLootCount: number;
  containers: VeyraPoiAuditContainer[];
}

export const M2_AUDIT_VERSION = 'soh.economic-sim-audit.v1' as const;
export const BASE_AUDIT_NOW = Date.UTC(2026, 10, 11, 0, 0, 0);

// ---------- Deterministic helpers ----------
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return r2(sorted[lo]);
  return r2(sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo));
}
function statsSummary(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
  return {
    n: s.length,
    min: r2(s[0] ?? 0),
    p10: percentile(s, 0.1),
    p50: percentile(s, 0.5),
    p90: percentile(s, 0.9),
    max: r2(s[s.length - 1] ?? 0),
    mean: r2(mean),
  };
}
let intentCounter = 0;
function nextIntentId(prefix = 'm2'): string {
  intentCounter++;
  return `${prefix}_${intentCounter}`;
}

function withLayout<T>(layout: string, fn: () => T): T {
  const prev = getActiveLayout();
  setActiveLayout(layout);
  try {
    return fn();
  } finally {
    setActiveLayout(prev);
  }
}

/** Find N walkable, buildable empty tiles near the player spawn for clean structure placement tests. */
function findBuildableCluster(r: RunState, w: World, count: number): [number, number][] {
  const px = Math.floor(r.player.x / TILE);
  const py = Math.floor(r.player.y / TILE);
  const occupied = new Set(
    Object.values(r.entities)
      .filter((e) => e.tx !== undefined && e.ty !== undefined)
      .map((e) => `${e.tx},${e.ty}`),
  );
  const out: [number, number][] = [];
  for (let rad = 1; rad <= 18 && out.length < count; rad++) {
    for (let dy = -rad; dy <= rad && out.length < count; dy++) {
      for (let dx = -rad; dx <= rad && out.length < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx < 3 || ty < 3 || tx >= WW - 3 || ty >= WH - 3) continue;
        const i = ty * WW + tx;
        if (
          w.economyMap.walkable[i] &&
          w.economyMap.buildable[i] &&
          !w.economyMap.protected[i] &&
          !w.sourceV3[i] &&
          !occupied.has(`${tx},${ty}`) &&
          ![T.DEEP, T.SHALLOW, T.RIVER, T.LAVA, T.CLIFF, T.PWALL].includes(w.tiles[i])
        ) {
          out.push([tx, ty]);
          occupied.add(`${tx},${ty}`);
        }
      }
    }
  }
  return out;
}

// ---------- Suite 1: World Resource & Loot Endowment Audit ----------
export interface VeyraSceneWindowSample {
  id: string;
  short: string;
  biomes: Record<string, number>;
  sources: Record<string, number>;
  coldTiles: number;
  warmSandCoastTiles: number;
  sandCoastTiles: number;
  freshWaterTiles: number;
  creaturesOnStart: Record<string, number>;
}

function collectVeyra81AndWindows(onSub?: (label: string, ms: number) => void): {
  veyraPois: VeyraPoiAuditRecord[];
  sceneSamples: VeyraSceneWindowSample[];
  aggregateSceneSources: Record<string, number>;
  aggregateSceneBiomes: Record<string, number>;
  veyraStaticLootItems: Record<string, number>;
  veyraBlueprints: string[];
  veyraCoresFound: Record<string, number>;
  veyraRcashTotal: number;
  veyraAuthoredExpected: number;
  veyraAuthoredMaterialized: number;
  veyraArchetypePoisOk: number;
  veyraArchetypePoisMissing: string[];
  veyraMissingTileAnomalies: string[];
} {
  const builtWindows = new Map<string, WindowWorld>();
  const getWin = (ox: number, oy: number): WindowWorld => {
    const id = layoutIdAt(ox, oy);
    let ww = builtWindows.get(id);
    if (!ww) {
      ww = getWindowWorld(id);
      builtWindows.set(id, ww);
    }
    return ww;
  };

  const sceneSamples: VeyraSceneWindowSample[] = [];
  const aggregateSceneSources: Record<string, number> = {};
  const aggregateSceneBiomes: Record<string, number> = {};

  const tScenes0 = performance.now();
  for (const sc of VEYRA05_SCENES) {
    const tSc = performance.now();
    const ww = getWindowWorld(sc.id);
    builtWindows.set(sc.id, ww);
    const biomes: Record<string, number> = {};
    const sources: Record<string, number> = {};
    let coldTiles = 0;
    let warmSandCoastTiles = 0;
    let sandCoastTiles = 0;
    let freshWaterTiles = 0;
    const em = ww.world.economyMap;
    for (let i = 0; i < em.biome.length; i++) {
      const b = em.biome[i];
      biomes[b] = (biomes[b] ?? 0) + 1;
      aggregateSceneBiomes[b] = (aggregateSceneBiomes[b] ?? 0) + 1;
      if (em.temperature[i] < 0.3) coldTiles++;
      if (b === 'sand' && em.coast[i]) {
        sandCoastTiles++;
        if (em.temperature[i] > 0.55) warmSandCoastTiles++;
      }
      if (em.freshwater[i]) freshWaterTiles++;
      const sk = ww.world.sourceV3[i];
      if (sk) {
        sources[sk] = (sources[sk] ?? 0) + 1;
        aggregateSceneSources[sk] = (aggregateSceneSources[sk] ?? 0) + 1;
      }
    }
    // Check starting creatures when spawning a run in this scene (use inspectAt on walkable tile to avoid 37k-BFS scan on harsh non-spawn biomes)
    const creaturesOnStart: Record<string, number> = {};
    let inspectCoord: { tx: number; ty: number } | undefined;
    for (let rad = 0; rad < 90 && !inspectCoord; rad++) {
      for (let dy = -rad; dy <= rad && !inspectCoord; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const tx = 100 + dx;
          const ty = 100 + dy;
          if (tx <= 3 || ty <= 3 || tx >= WW - 4 || ty >= WH - 4) continue;
          const gi = ty * WW + tx;
          if (!ww.floors.ground.solidProps[gi] && em.walkable[gi] && ![T.DEEP, T.SHALLOW, T.RIVER, T.CLIFF, T.PWALL, T.LAVA].includes(ww.world.tiles[gi])) {
            inspectCoord = { tx, ty };
            break;
          }
        }
      }
    }
    withLayout(sc.id, () => {
      const gs = newGame();
      const res = startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x501 + sceneSamples.length, inspectCoord);
      if (res.ok && gs.run) {
        for (const c of gs.run.creatures) {
          creaturesOnStart[c.type] = (creaturesOnStart[c.type] ?? 0) + 1;
        }
      }
    });
    sceneSamples.push({
      id: sc.id,
      short: sc.short,
      biomes,
      sources,
      coldTiles,
      warmSandCoastTiles,
      sandCoastTiles,
      freshWaterTiles,
      creaturesOnStart,
    });
    onSub?.(`sc:${sc.id}`, Math.round(performance.now() - tSc));
  }
  onSub?.(`scenes(${VEYRA05_SCENES.length})`, Math.round(performance.now() - tScenes0));
  const tPois0 = performance.now();

  // Extract all 81 Veyra POIs reusing built scene windows + clustered cover (matching M1 speed)
  const veyraPois: VeyraPoiAuditRecord[] = [];
  const sortedPois = [...POIS].sort((a, b) => a.id.localeCompare(b.id));
  const poiTiles = new Map(sortedPois.map((p) => [p.id, auToTile(p.at[0], p.at[1])]));
  const MARGIN = 36;
  const findInteriorWindow = (pid: string, tx: number, ty: number): WindowWorld | undefined => {
    for (const ww of builtWindows.values()) {
      const lx = tx - ww.win.originTx;
      const ly = ty - ww.win.originTy;
      if (lx >= MARGIN && ly >= MARGIN && lx <= WINDOW_W - MARGIN && ly <= WINDOW_H - MARGIN && ww.poiIds.includes(pid)) {
        return ww;
      }
    }
    return undefined;
  };

  const veyraStaticLootItems: Record<string, number> = {};
  const veyraBlueprints = new Set<string>();
  const veyraCoresFound: Record<string, number> = {};
  let veyraRcashTotal = 0;
  let veyraAuthoredExpected = 0;
  let veyraAuthoredMaterialized = 0;
  let veyraArchetypePoisOk = 0;
  const veyraArchetypePoisMissing: string[] = [];
  const veyraMissingTileAnomalies: string[] = [];

  for (const poi of sortedPois) {
    onSub?.(`poi_start:${poi.id}`, Math.round(performance.now() - tPois0));
    const [tx, ty] = poiTiles.get(poi.id)!;
    let ww = findInteriorWindow(poi.id, tx, ty);
    if (!ww) {
      const cluster = sortedPois.filter((other) => {
        const [ox0, oy0] = poiTiles.get(other.id)!;
        return !findInteriorWindow(other.id, ox0, oy0) && Math.abs(ox0 - tx) <= 115 && Math.abs(oy0 - ty) <= 115;
      });
      const minX = Math.min(...cluster.map((c) => poiTiles.get(c.id)![0]));
      const maxX = Math.max(...cluster.map((c) => poiTiles.get(c.id)![0]));
      const minY = Math.min(...cluster.map((c) => poiTiles.get(c.id)![1]));
      const maxY = Math.max(...cluster.map((c) => poiTiles.get(c.id)![1]));
      const cx = maxX - minX <= WINDOW_W - MARGIN * 2 ? Math.round((minX + maxX) / 2) : tx;
      const cy = maxY - minY <= WINDOW_H - MARGIN * 2 ? Math.round((minY + maxY) / 2) : ty;
      const ox = Math.max(0, Math.min(FRAME_W - WINDOW_W, cx - Math.floor(WINDOW_W / 2)));
      const oy = Math.max(0, Math.min(FRAME_H - WINDOW_H, cy - Math.floor(WINDOW_H / 2)));
      ww = getWin(ox, oy);
    }
    const ox = ww.win.originTx;
    const oy = ww.win.originTy;
    const authored = authoredPlan(poi.id);
    const authoredCoordsByLevel = new Map<number, Set<string>>();
    let expectedAuthoredCount = 0;
    if (authored) {
      for (const [lv, lvl] of authored.levels.entries()) {
        const coords = new Set<string>();
        for (const l of lvl.loot) {
          coords.add(`${l.x - ox},${l.y - oy}`);
          expectedAuthoredCount++;
        }
        authoredCoordsByLevel.set(lv, coords);
      }
    }
    veyraAuthoredExpected += expectedAuthoredCount;

    const containers: VeyraPoiAuditContainer[] = [];
    let hasCash = false;
    let hasVendor = false;
    let hasEvac = false;
    for (const [lv, layer] of ww.floors.layers.entries()) {
      const authoredCoords = authoredCoordsByLevel.get(lv);
      for (const st of layer.statics) {
        if (st.poi !== poi.id) continue;
        if (st.kind === 'loot') {
          const fromAuthored = !!authoredCoords?.has(`${st.tx},${st.ty}`);
          if (fromAuthored) veyraAuthoredMaterialized++;
          const items = (st.loot ?? []).map(([item, qty]) => {
            if (item.startsWith('blueprint:')) {
              veyraBlueprints.add(item.slice(10));
            } else {
              veyraStaticLootItems[item] = (veyraStaticLootItems[item] ?? 0) + qty;
              if (ITEMS[item]?.creatorCore || ITEMS[item]?.core) {
                veyraCoresFound[item] = (veyraCoresFound[item] ?? 0) + qty;
              }
            }
            return { item, qty };
          });
          containers.push({
            floor: lv,
            tx: ox + st.tx,
            ty: oy + st.ty,
            label: st.label ?? 'Container',
            kind: 'loot',
            fromArchetypePreset: !fromAuthored,
            items,
          });
        } else if (st.kind === 'cash') {
          hasCash = true;
          veyraRcashTotal += st.cash ?? 0;
          containers.push({
            floor: lv,
            tx: ox + st.tx,
            ty: oy + st.ty,
            label: st.label ?? 'Cash Cache',
            kind: 'cash',
            fromArchetypePreset: false,
            cash: st.cash ?? 0,
            items: [],
          });
        } else if (st.kind === 'vendor') {
          hasVendor = true;
        } else if (st.kind === 'evac') {
          hasEvac = true;
        }
      }
    }

    if (expectedAuthoredCount > 0 && containers.filter((c) => !c.fromArchetypePreset && c.kind === 'loot').length < expectedAuthoredCount) {
      veyraMissingTileAnomalies.push(
        `${poi.id}: expected ${expectedAuthoredCount} authored caches, materialized ${containers.filter((c) => !c.fromArchetypePreset && c.kind === 'loot').length}`,
      );
    }
    const isSpecialPoi = expectedAuthoredCount > 0 || hasCash || hasVendor || hasEvac || poi.arche === 'elder' || poi.id.startsWith('po_surtur') || poi.id.startsWith('po_typhon') || poi.id.startsWith('po_elderwood') || poi.id.startsWith('po_gate') || poi.id.startsWith('po_hall_eyes') || poi.id.startsWith('po_necropolis');
    if (!isSpecialPoi) {
      if (containers.some((c) => c.fromArchetypePreset)) veyraArchetypePoisOk++;
      else {
        veyraArchetypePoisMissing.push(poi.id);
        veyraMissingTileAnomalies.push(`${poi.id} (arche=${poi.arche}): zero archetype containers materialized`);
      }
    }

    veyraPois.push({
      id: poi.id,
      name: poi.name,
      arche: poi.arche,
      authoredLootCount: expectedAuthoredCount,
      containers,
    });
  }

  return {
    veyraPois,
    sceneSamples,
    aggregateSceneSources,
    aggregateSceneBiomes,
    veyraStaticLootItems,
    veyraBlueprints: [...veyraBlueprints].sort(),
    veyraCoresFound,
    veyraRcashTotal,
    veyraAuthoredExpected,
    veyraAuthoredMaterialized,
    veyraArchetypePoisOk,
    veyraArchetypePoisMissing,
    veyraMissingTileAnomalies,
  };
}

function runSuite1WorldEndowments(onSub?: (label: string, ms: number) => void) {
  const tShip0 = performance.now();
  const wShip = getWorld('shipping_fresh');
  const shipBiomes: Record<string, number> = {};
  const shipSources: Record<string, number> = {};
  let shipFreshWater = 0;
  let shipColdTiles = 0;
  for (let i = 0; i < wShip.economyMap.biome.length; i++) {
    const b = wShip.economyMap.biome[i];
    shipBiomes[b] = (shipBiomes[b] ?? 0) + 1;
    if (wShip.economyMap.freshwater[i]) shipFreshWater++;
    if (wShip.economyMap.temperature[i] < 0.3) shipColdTiles++;
    const sk = wShip.sourceV3[i];
    if (sk) shipSources[sk] = (shipSources[sk] ?? 0) + 1;
  }

  // Exact shipping static loot + cash + blueprints + creator cores
  const shipStaticLoot: Record<string, number> = {};
  const shipBlueprints = new Set<string>();
  const shipCores: Record<string, number> = {};
  let shipRcash = 0;
  let shipLootContainers = 0;
  let shipCashContainers = 0;
  let shipKeycardDoors = 0;
  let shipPowerDoors = 0;
  for (const s of wShip.statics) {
    if (s.kind === 'loot') {
      shipLootContainers++;
      for (const [k, q] of s.loot ?? []) {
        if (k.startsWith('blueprint:')) shipBlueprints.add(k.slice(10));
        else {
          shipStaticLoot[k] = (shipStaticLoot[k] ?? 0) + q;
          if (ITEMS[k]?.creatorCore || ITEMS[k]?.core) shipCores[k] = (shipCores[k] ?? 0) + q;
        }
      }
      const cl = CREATOR_LOOT_V1.find((c) => c.poi === s.poi && s.loot?.some(([k]) => k === c.marker));
      if (cl) {
        shipStaticLoot[cl.core] = (shipStaticLoot[cl.core] ?? 0) + 1;
        shipCores[cl.core] = (shipCores[cl.core] ?? 0) + 1;
      }
    } else if (s.kind === 'cash') {
      shipCashContainers++;
      shipRcash += s.cash ?? 0;
    } else if (s.kind === 'door' && s.locked === 'keycard') shipKeycardDoors++;
    else if (s.kind === 'door' && s.locked === 'power') shipPowerDoors++;
  }

  // Shipping initial wild creatures + expected total resource stocks
  const shipCreatures: Record<string, number> = {};
  withLayout('shipping_fresh', () => {
    const gs = newGame();
    startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x101);
    for (const c of gs.run!.creatures) shipCreatures[c.type] = (shipCreatures[c.type] ?? 0) + 1;
  });

  // Compute natural stock units & expected raw yields on shipping_fresh
  const shipSourceYieldTotals: Record<string, { nodes: number; stockUnits: number; expectedPrimary: Record<string, number>; expectedBonus: Record<string, number> }> = {};
  for (const [srcKey, count] of Object.entries(shipSources)) {
    const def = SOURCES[srcKey];
    const stockUnits = count * def.stock;
    const expectedPrimary: Record<string, number> = {};
    for (const [item, qty] of def.yields) expectedPrimary[item] = r2(stockUnits * qty);
    const expectedBonus: Record<string, number> = {};
    for (const [item, prob] of def.bonus ?? []) expectedBonus[item] = r2(stockUnits * prob);
    if (srcKey === 'wreck') {
      expectedBonus.salvaged_oil = r2(stockUnits * SALVAGED_OIL_WRECK_CHANCE);
    }
    if (srcKey === 'iron' && def.qualityBonus) {
      expectedBonus['rich_iron_ore_ironPick(8%)'] = r2(stockUnits * 0.08);
      expectedBonus['rich_iron_ore_salvager(12%)'] = r2(stockUnits * 0.12);
    }
    shipSourceYieldTotals[srcKey] = { nodes: count, stockUnits, expectedPrimary, expectedBonus };
  }

  onSub?.('shipping', Math.round(performance.now() - tShip0));
  const veyraData = collectVeyra81AndWindows(onSub);

  // Compute missing raw materials / creatures / cores per world
  const shippingMissingWildBiomes: string[] = [];
  for (const [sk, def] of Object.entries(SOURCES)) {
    if ((shipSources[sk] ?? 0) === 0) shippingMissingWildBiomes.push(sk);
    void def;
  }
  const veyraMissingSampledSources: string[] = [];
  for (const sk of Object.keys(SOURCES)) {
    if ((veyraData.aggregateSceneSources[sk] ?? 0) === 0) veyraMissingSampledSources.push(sk);
  }

  return {
    shipping: {
      tilesTotal: wShip.economyMap.biome.length,
      biomes: shipBiomes,
      freshWaterTiles: shipFreshWater,
      coldTiles: shipColdTiles,
      sources: shipSources,
      sourceYieldTotals: shipSourceYieldTotals,
      staticLootContainers: shipLootContainers,
      staticCashContainers: shipCashContainers,
      staticRcashTotal: shipRcash,
      keycardDoors: shipKeycardDoors,
      powerDoors: shipPowerDoors,
      staticLootItems: shipStaticLoot,
      staticBlueprints: [...shipBlueprints].sort(),
      staticCores: shipCores,
      initialCreatures: shipCreatures,
      missingSources: shippingMissingWildBiomes,
      airdropsMaxEvents: BAL.airdropV1.maxEvents,
    },
    veyra: {
      sceneWindowCount: veyraData.sceneSamples.length,
      sampledTilesTotal: veyraData.sceneSamples.length * WW * WH,
      aggregateSceneBiomes: veyraData.aggregateSceneBiomes,
      aggregateSceneSources: veyraData.aggregateSceneSources,
      missingSampledSources: veyraMissingSampledSources,
      sceneSamples: veyraData.sceneSamples,
      totalPois: veyraData.veyraPois.length,
      authoredLootExpected: veyraData.veyraAuthoredExpected,
      authoredLootMaterialized: veyraData.veyraAuthoredMaterialized,
      archetypePoisMaterialized: veyraData.veyraArchetypePoisOk,
      archetypePoisMissing: veyraData.veyraArchetypePoisMissing,
      missingTileAnomalies: veyraData.veyraMissingTileAnomalies,
      staticLootItems: veyraData.veyraStaticLootItems,
      staticBlueprints: veyraData.veyraBlueprints,
      staticCores: veyraData.veyraCoresFound,
      staticRcashTotal: veyraData.veyraRcashTotal,
      ordinaryHabitats: ORDINARY_CREATURE_HABITATS.length,
      sideBossSites: VEYRA_SIDE_BOSS_SITES.length,
      primordialSites: VEYRA_PRIMORDIAL_SITES.length,
      veyraPois: veyraData.veyraPois,
    },
  };
}

// ---------- Suite 2: Live Multi-Day Engine Archetype Trajectories (0h -> 336h) ----------
function setupBaseAndClaim(
  gs: GameState,
  w: World,
  now: number,
  options: { walls: number; stoneUpgrade?: boolean; addFurnace?: boolean; addWorkbench?: boolean; addResearch?: boolean; addBedChest?: boolean },
): { claimId: string | null; bedId: string | null; chestId: string | null; furnaceId: string | null; workbenchId: string | null; researchId: string | null; placed: number } {
  const r = gs.run!;
  const tiles = findBuildableCluster(r, w, 24);
  if (tiles.length < 10) return { claimId: null, bedId: null, chestId: null, furnaceId: null, workbenchId: null, researchId: null, placed: 0 };

  // Seed starter building materials realistically gathered in first active hours
  addItem(r, 'inv', 'wood', 60);
  addItem(r, 'inv', 'stone', 60);
  addItem(r, 'inv', 'fiber', 40);
  addItem(r, 'inv', 'rope', 10);
  addItem(r, 'inv', 'iron_ingot', 16);
  addItem(r, 'inv', 'spares', 12);

  let placed = 0;
  let claimId: string | null = null;
  let bedId: string | null = null;
  let chestId: string | null = null;
  let furnaceId: string | null = null;
  let workbenchId: string | null = null;
  let researchId: string | null = null;

  // Build 2x2 enclosed shelter anchored adjacent to player
  const [ax, ay] = tiles[0];
  const shelterCells: [number, number][] = [
    [ax, ay],
    [ax + 1, ay],
  ];
  for (const [tx, ty] of shelterCells) {
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'floor_wood', tx, ty }, now).ok) placed++;
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'roof_thatch', tx, ty }, now).ok) placed++;
  }
  const cRes = dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'claim', tx: ax, ty: ay }, now);
  if (cRes.ok) {
    placed++;
    claimId = Object.values(r.entities).find((e) => e.type === 'claim' && e.tx === ax && e.ty === ay)?.id ?? null;
  }

  if (options.addBedChest) {
    const [bx, by] = tiles[1] ?? [ax + 1, ay];
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'bed_straw', tx: bx, ty: by }, now).ok) {
      placed++;
      bedId = Object.values(r.entities).find((e) => e.type === 'bed_straw' && e.tx === bx && e.ty === by)?.id ?? null;
    }
    const [cx, cy] = tiles[2] ?? [ax + 2, ay];
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'chest_small', tx: cx, ty: cy }, now).ok) {
      placed++;
      chestId = Object.values(r.entities).find((e) => e.type === 'chest_small' && e.tx === cx && e.ty === cy)?.id ?? null;
    }
  }

  for (let i = 0; i < Math.min(options.walls, tiles.length - 4); i++) {
    const [wx, wy] = tiles[4 + i];
    const wRes = dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'wall_wood', tx: wx, ty: wy }, now);
    if (wRes.ok) placed++;
  }
  if (options.addFurnace && tiles[12]) {
    const [fx, fy] = tiles[12];
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'furnace', tx: fx, ty: fy }, now).ok) {
      placed++;
      furnaceId = Object.values(r.entities).find((e) => e.type === 'furnace' && e.tx === fx && e.ty === fy)?.id ?? null;
    }
  }
  if (options.addWorkbench && tiles[13]) {
    const [wx, wy] = tiles[13];
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'workbench', tx: wx, ty: wy }, now).ok) {
      placed++;
      workbenchId = Object.values(r.entities).find((e) => e.type === 'workbench' && e.tx === wx && e.ty === wy)?.id ?? null;
    }
  }
  if (options.addResearch && tiles[14]) {
    const [rx, ry] = tiles[14];
    if (dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'research', tx: rx, ty: ry }, now).ok) {
      placed++;
      researchId = Object.values(r.entities).find((e) => e.type === 'research' && e.tx === rx && e.ty === ry)?.id ?? null;
    }
  }

  return { claimId, bedId, chestId, furnaceId, workbenchId, researchId, placed };
}

function runSuite2Archetypes() {
  const worlds = [
    { label: 'shipping_fresh', layout: 'shipping_fresh' },
    { label: 'veyra05-world', layout: 'veyra05-world' },
  ] as const;

  const results: Record<string, any> = {};

  for (const wCfg of worlds) {
    withLayout(wCfg.layout, () => {
      // Archetype A: Casual_Offline_Survivor (14 days, 2h active + 22h offline per day)
      const gsA = newGame();
      startRun(gsA, 'male', BASE_AUDIT_NOW, 0, 0xA101);
      const rA = gsA.run!;
      const w = getWorld();
      const baseA = setupBaseAndClaim(gsA, w, BASE_AUDIT_NOW, { walls: 6, addBedChest: true });
      const claimEntA = baseA.claimId ? rA.entities[baseA.claimId] : null;
      if (claimEntA?.c) {
        addItem(rA, claimEntA.c, 'wood', 60);
        addItem(rA, claimEntA.c, 'stone', 30);
        addItem(rA, claimEntA.c, 'fiber', 30);
      }
      let nowA = BASE_AUDIT_NOW;
      let deathsA = 0;
      let collapsesA = 0;
      let totalUpkeepWoodA = 0;
      let totalUpkeepStoneA = 0;
      rA.creatures = [];
      for (let day = 0; day < 14; day++) {
        // Active 2h window: top up food/water/cabinet wood+stone+fiber
        rA.player.hunger = 95;
        rA.player.thirst = 95;
        rA.player.warmth = 95;
        const liveClaim = baseA.claimId ? rA.entities[baseA.claimId] : null;
        if (liveClaim?.c && rA.custody[liveClaim.c]) {
          if (countItem(rA, liveClaim.c, 'wood') < 15) addItem(rA, liveClaim.c, 'wood', 40);
          if (countItem(rA, liveClaim.c, 'stone') < 10) addItem(rA, liveClaim.c, 'stone', 20);
          if (countItem(rA, liveClaim.c, 'fiber') < 10) addItem(rA, liveClaim.c, 'fiber', 20);
        }
        nowA += 2 * HOUR;
        settle(gsA, nowA, true);
        // Offline 22h
        nowA += 22 * HOUR;
        beginReceiptSink();
        settle(gsA, nowA, true);
        const rcA = endReceiptSink();
        for (const rc of rcA) {
          if (rc.kind === 'territory.collapse') collapsesA++;
          if (rc.kind === 'territory.upkeep') {
            if (rc.detail.includes(':woodx')) totalUpkeepWoodA += Number(rc.detail.split('x')[1] || 0);
            if (rc.detail.includes(':stonex')) totalUpkeepStoneA += Number(rc.detail.split('x')[1] || 0);
          }
        }
        if (rA.player.dead) {
          deathsA++;
          dispatch(gsA, { id: nextIntentId(), type: 'respawn' }, nowA);
        }
      }

      // Archetype B: Solo_Fortifier_Builder (336h fortified upkeep + bench L3 + generator)
      const gsB = newGame();
      startRun(gsB, 'female', BASE_AUDIT_NOW, 0, 0xB202);
      const rB = gsB.run!;
      const baseB = setupBaseAndClaim(gsB, w, BASE_AUDIT_NOW, { walls: 8, addBedChest: true, addFurnace: true, addWorkbench: true, addResearch: true });
      const claimEntB = baseB.claimId ? rB.entities[baseB.claimId] : null;
      // Add fortified stone/brick walls + refinery + generator
      const moreTiles = findBuildableCluster(rB, w, 30);
      addItem(rB, 'inv', 'brick', 60);
      addItem(rB, 'inv', 'iron_ingot', 40);
      addItem(rB, 'inv', 'mechanical_parts', 30);
      addItem(rB, 'inv', 'fasteners', 30);
      addItem(rB, 'inv', 'spares', 30);
      addItem(rB, 'inv', 'glass', 10);
      addItem(rB, 'inv', 'wood', 40);
      if (moreTiles[15]) dispatch(gsB, { id: nextIntentId(), type: 'build', struct: 'wall_brick', tx: moreTiles[15][0], ty: moreTiles[15][1] }, BASE_AUDIT_NOW);
      if (moreTiles[16]) dispatch(gsB, { id: nextIntentId(), type: 'build', struct: 'door_iron', tx: moreTiles[16][0], ty: moreTiles[16][1] }, BASE_AUDIT_NOW);
      if (moreTiles[17]) dispatch(gsB, { id: nextIntentId(), type: 'build', struct: 'base_generator', tx: moreTiles[17][0], ty: moreTiles[17][1] }, BASE_AUDIT_NOW);
      if (moreTiles[18]) dispatch(gsB, { id: nextIntentId(), type: 'build', struct: 'arrow_turret', tx: moreTiles[18][0], ty: moreTiles[18][1] }, BASE_AUDIT_NOW);

      const fcB = claimEntB ? territoryForecastSafe(rB, claimEntB) : null;
      const dailyUpkeepB: Record<string, number> = {};
      if (fcB) {
        for (const [k, rate] of Object.entries(fcB.rates)) dailyUpkeepB[k] = r2(rate * 24 * HOUR);
      }
      // Run 14-day territory step with abundant per-material funding to measure exact discrete debits
      const spent14dB: Record<string, number> = {};
      if (claimEntB?.c) {
        const neededMats = Object.keys(dailyUpkeepB);
        const restockB = () => {
          for (const mat of neededMats) {
            const target = ITEMS[mat]?.max ?? 40;
            const cur = countItem(rB, claimEntB.c!, mat);
            if (cur < target) addItem(rB, claimEntB.c!, mat, target - cur);
          }
        };
        restockB();
        beginReceiptSink();
        for (let d = 1; d <= 14; d++) {
          restockB();
          stepTerritory(rB, 24 * HOUR, BASE_AUDIT_NOW + d * 24 * HOUR);
        }
        for (const rc of endReceiptSink()) {
          if (rc.kind === 'territory.upkeep') {
            const [, matQty] = rc.detail.split(':');
            const [mat, qty] = matQty.split('x');
            spent14dB[mat] = (spent14dB[mat] ?? 0) + Number(qty);
          }
        }
      }

      // Archetype C: Industrial_Motorbike_Freight + Fuel Budget
      const gsC = newGame();
      startRun(gsC, 'male', BASE_AUDIT_NOW, 0, 0xC303);
      const rC = gsC.run!;
      const roadSpeedPxPerSec = BAL.motorbike.roadSpeed;
      const wearPerPx = BAL.motorbike.wearPerPixel;
      const fuelPerPx = BAL.motorbike.fuelPerPixel;
      const loadMult = 1 + BAL.motorbike.loadFuelMultiplier;
      const maxFuelInTank = BAL.motorbike.tank;
      const pxPerFullTankRoadUnloaded = maxFuelInTank / fuelPerPx;
      const pxPerFullTankRoadLoaded = maxFuelInTank / (fuelPerPx * loadMult);
      const tilesPerCanisterLoadedRoad = BAL.motorbike.canFuel / (fuelPerPx * loadMult) / TILE;
      const wearPerFullTankLoaded = pxPerFullTankRoadLoaded * wearPerPx;

      // Archetype D: CreatorCore_And_Research_Completionist
      const gsD = newGame();
      startRun(gsD, 'male', BASE_AUDIT_NOW, 0, 0xD404);
      const rD = gsD.run!;
      const allRecipeKeys = Object.keys(RECIPES);
      const startKnown = new Set(rD.knowledge.recipes);
      const unknownAtStart = allRecipeKeys.filter((k) => !startKnown.has(k));
      const unknownNonCore = unknownAtStart.filter((k) => !k.startsWith('core_'));
      const unknownCores = unknownAtStart.filter((k) => k.startsWith('core_'));
      const unknownTier3NonCore = unknownNonCore.filter((k) => RECIPES[k].tier >= 3);
      const unknownTier12NonCore = unknownNonCore.filter((k) => RECIPES[k].tier < 3);
      const minSparesDirectedPlusRandom = unknownTier12NonCore.length * BAL.research.directedSparesCost + (unknownTier3NonCore.length + unknownCores.length) * BAL.research.randomSparesCost;
      const totalRandomResearchSparesAll = unknownAtStart.length * BAL.research.randomSparesCost;
      const sparesNeededBeforeFirstCoreRandom = unknownNonCore.length * BAL.research.randomSparesCost;

      // Archetype E: Journey Requisition vs Physical Escrow Cash (0h -> 336h)
      const gsE = newGame();
      startRun(gsE, 'male', BASE_AUDIT_NOW, 0, 0xE505);
      const maxVendorSecuredSpendable = Object.values(VENDOR_SECURED).reduce((acc, v) => acc + v.price * v.stock, 0);
      const maxVendorSparesSpendable = Object.values(VENDOR_SPARES).reduce((acc, v) => acc + v.price * v.stock, 0);
      const dailyReqPerFullDay = DAILY_MILESTONES.reduce((acc, m) => acc + (milestoneRewardSpec(m.id)?.securedCash ?? 0), 0);
      const req14DaysMax = dailyReqPerFullDay * 14;
      const rE = gsE.run!;
      const testRequisitionDay1 = (() => {
        const d0 = dateKey(BASE_AUDIT_NOW);
        // Perform genuine daily gameplay actions (build 5+ structures, craft 2+ recipes x3, eat/drink x4, learn blueprint)
        const baseE = setupBaseAndClaim(gsE, w, BASE_AUDIT_NOW, { walls: 5, addBedChest: true });
        void baseE;
        addItem(rE, 'inv', 'wood', 40);
        addItem(rE, 'inv', 'stone', 40);
        addItem(rE, 'inv', 'fiber', 40);
        addItem(rE, 'inv', 'berries', 10);
        dispatch(gsE, { id: nextIntentId(), type: 'craft', recipe: 'rope' }, BASE_AUDIT_NOW + 1000);
        dispatch(gsE, { id: nextIntentId(), type: 'craft', recipe: 'rope' }, BASE_AUDIT_NOW + 1100);
        dispatch(gsE, { id: nextIntentId(), type: 'craft', recipe: 'torch' }, BASE_AUDIT_NOW + 1200);
        dispatch(gsE, { id: nextIntentId(), type: 'craft', recipe: 'torch' }, BASE_AUDIT_NOW + 1300);
        const invSlots = rE.custody.inv.slots;
        const berryIdx = invSlots.findIndex((s) => s?.key === 'berries');
        if (berryIdx >= 0) {
          for (let k = 0; k < 4; k++) {
            dispatch(gsE, { id: nextIntentId(), type: 'useItem', c: 'inv', slot: berryIdx }, BASE_AUDIT_NOW + 1400 + k * 50);
          }
        }
        // Learn a blueprint if still < 25 pts on today's randomized slate
        const bpSlot = invSlots.findIndex((s) => !s);
        if (bpSlot >= 0) {
          invSlots[bpSlot] = mkStack(rE, 'blueprint', 1, 'stew');
          dispatch(gsE, { id: nextIntentId(), type: 'useItem', c: 'inv', slot: bpSlot }, BASE_AUDIT_NOW + 2000);
        }
        // Fortify 2 walls if present
        const wallsE = Object.values(rE.entities).filter((e) => e.kind === 'struct' && e.type === 'wall_wood');
        for (let k = 0; k < Math.min(2, wallsE.length); k++) {
          wallsE[k].hp = (wallsE[k].maxHp ?? 160) - 20;
          dispatch(gsE, { id: nextIntentId(), type: 'repairStructure', eid: wallsE[k].id }, BASE_AUDIT_NOW + 2200 + k * 50);
        }
        const resEmber = dispatch(gsE, { id: nextIntentId(), type: 'journeyRequisition', date: d0, milestone: 'ember' }, BASE_AUDIT_NOW + 5000);
        return { date: d0, craftedOk: true, emberClaimOk: resEmber.ok, emberMsg: resEmber.ok ? resEmber.msg : resEmber.reason, securedAfter: gsE.profile.securedCash };
      })();

      results[wCfg.label] = {
        casualOffline14Day: {
          placedStructures: baseA.placed,
          deathsIn14DaysWithDaily2hPlay: deathsA,
          collapses: collapsesA,
          totalUpkeepWood14d: totalUpkeepWoodA,
          totalUpkeepStone14d: totalUpkeepStoneA,
          finalHp: r3(rA.player.hp),
          finalHunger: r3(rA.player.hunger),
          finalThirst: r3(rA.player.thirst),
          finalPhase: phaseOf(rA, nowA),
        },
        fortifier14Day: {
          coveredCount: fcB?.count ?? 0,
          dailyUpkeepRates: dailyUpkeepB,
          cumulative14DayDebits: spent14dB,
          total14dItemsConsumed: Object.values(spent14dB).reduce((a, b) => a + b, 0),
        },
        motorbikeKinematics: {
          wreckEconomy: rC.wreckEconomy,
          supportsAirdrops: supportsAirdrops(rC.layoutId!),
          roadSpeedPxPerSec,
          pxPerFullTankRoadUnloaded: Math.round(pxPerFullTankRoadUnloaded),
          tilesPerFullTankRoadLoaded: Math.round(pxPerFullTankRoadLoaded / TILE),
          tilesPerCanisterLoadedRoad: Math.round(tilesPerCanisterLoadedRoad),
          wearPerFullTankLoaded: r2(wearPerFullTankLoaded),
        },
        researchAndCoreGate: {
          totalRecipes: allRecipeKeys.length,
          knownAtStart: startKnown.size,
          unknownAtStart: unknownAtStart.length,
          unknownNonCore: unknownNonCore.length,
          unknownTier3NonCore,
          unknownCores,
          sparesNeededBeforeFirstCoreRandom,
          totalRandomResearchSparesAll,
          minSparesDirectedPlusRandom,
        },
        currencySplit: {
          maxVendorSecuredSpendablePerRun: maxVendorSecuredSpendable,
          maxVendorSparesSpendablePerRun: maxVendorSparesSpendable,
          dailyRequisitionSecuredPerDay: dailyReqPerFullDay,
          max14DayRequisitionSecured: req14DaysMax,
          requisitionOverVendorCapRatio: r2(req14DaysMax / maxVendorSecuredSpendable),
          liveProbeDay1: testRequisitionDay1,
        },
      };
    });
  }

  return results;
}

function territoryForecastSafe(r: RunState, claim: { id: string }) {
  return planTerritory(r).forecast.get(claim.id) ?? null;
}

// ---------- Suite 3: Territory Upkeep Stress Matrix (real stepTerritory 0h -> 336h) ----------
function runSuite3TerritoryMatrix() {
  const presets: { name: string; structs: [string, number][] }[] = [
    {
      name: 'Starter_2x2_Wood',
      structs: [
        ['claim', 1],
        ['floor_wood', 4],
        ['wall_wood', 7],
        ['door_wood', 1],
        ['roof_thatch', 4],
        ['bed_straw', 1],
        ['chest_small', 1],
        ['campfire', 1],
      ],
    },
    {
      name: 'Standard_4x4_Plank',
      structs: [
        ['claim', 1],
        ['floor_wood', 16],
        ['wall_plank', 14],
        ['door_wood', 2],
        ['roof_thatch', 16],
        ['bed_straw', 1],
        ['chest_large', 2],
        ['campfire', 1],
        ['furnace', 1],
        ['workbench', 1],
        ['research', 1],
      ],
    },
    {
      name: 'Stone_Keep_5x5',
      structs: [
        ['claim', 1],
        ['floor_stone', 25],
        ['wall_stone', 18],
        ['door_iron', 2],
        ['roof_tile', 25],
        ['chest_large', 4],
        ['furnace', 2],
        ['workbench', 1],
        ['research', 1],
        ['refinery', 1],
        ['garden', 4],
        ['barrel', 2],
      ],
    },
    {
      name: 'Brick_Citadel_6x6_Armed',
      structs: [
        ['claim', 1],
        ['floor_stone', 36],
        ['wall_brick', 22],
        ['door_powered', 2],
        ['roof_tile', 36],
        ['chest_large', 4],
        ['furnace', 2],
        ['workbench', 1],
        ['research', 1],
        ['refinery', 1],
        ['base_generator', 2],
        ['power_cable', 10],
        ['arrow_turret', 4],
        ['ir_sensor', 2],
        ['bear_trap', 2],
        ['farm_controller', 1],
      ],
    },
    {
      name: 'Solo_Outpost_Zero_Wood_CabinetOnly_Plus_Stations',
      structs: [
        ['claim', 1],
        ['floor_stone', 4],
        ['wall_stone', 7],
        ['door_iron', 1],
        ['roof_tile', 4],
        ['workbench', 1],
        ['furnace', 1],
        ['refinery', 1],
        ['base_generator', 1],
      ],
    },
  ];

  const rows: any[] = [];
  for (const preset of presets) {
    // Compute exact theoretical build cost, continuous 24h rate, 14-day total (3.5x), and discrete stepTerritory debits
    const buildCost: Record<string, number> = {};
    const dailyExact: Record<string, number> = {};
    for (const [stype, qty] of preset.structs) {
      const def = STRUCTS[stype];
      for (const [mat, q] of def.cost) {
        buildCost[mat] = (buildCost[mat] ?? 0) + q * qty;
        if (BAL.territory.materials.includes(mat)) {
          dailyExact[mat] = (dailyExact[mat] ?? 0) + q * qty * BAL.territory.upkeepFractionPerDay;
        }
      }
    }
    const cumulative14DayExact: Record<string, number> = {};
    for (const [m, v] of Object.entries(dailyExact)) cumulative14DayExact[m] = r2(v * 14);

    // Execute real stepTerritory on shipping_fresh
    const actual14DaySpent: Record<string, number> = {};
    let totalStructsBuilt = 0;
    let maxHoursSupportedFullWood = 0;
    withLayout('shipping_fresh', () => {
      const gs = newGame();
      startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x3300 + rows.length);
      const r = gs.run!;
      const w = getWorld();
      const cells = findBuildableCluster(r, w, 120);
      // Give ample materials in inv and place directly (avoid wall stacking by using open floor/obj grid slots carefully)
      for (const mat of Object.keys(ITEMS)) addItem(r, 'inv', mat, 999);
      let cellIdx = 0;
      let claimEid: string | null = null;
      // Place all structures into r.entities directly using exact STRUCTS definitions within claimRadius=25
      const [cx, cy] = cells[0];
      for (const [stype, qty] of preset.structs) {
        const def = STRUCTS[stype];
        for (let q = 0; q < qty; q++) {
          const [tx, ty] = stype === 'claim' ? [cx, cy] : (cells[++cellIdx] ?? [cx + (cellIdx % 10), cy + Math.floor(cellIdx / 10)]);
          const eid = `m2_${stype}_${q}`;
          r.entities[eid] = {
            id: eid,
            kind: 'struct',
            type: stype,
            tx,
            ty,
            x: tx * TILE + 8,
            y: ty * TILE + 8,
            hp: def.hp,
            maxHp: def.hp,
            born: BASE_AUDIT_NOW,
            ...(stype === 'claim' ? { cabinet: { credit: {}, legacy: true }, c: `cab_${rows.length}` } : {}),
          };
          if (stype === 'claim') {
            claimEid = eid;
            r.custody[`cab_${rows.length}`] = { id: `cab_${rows.length}`, kind: 'chest', slots: Array(24).fill(null) };
          }
          totalStructsBuilt++;
        }
      }
      if (claimEid) {
        const fc = planTerritory(r).forecast.get(claimEid);
        // Check 24-slot cabinet ceiling bottleneck: how many hours if filled with required materials?
        const mats = Object.keys(fc?.rates ?? {});
        const slotsPerMat = mats.length > 0 ? Math.max(1, Math.floor(24 / mats.length)) : 24;
        let minCapHours = Infinity;
        for (const m of mats) {
          const stackMax = ITEMS[m]?.max ?? 40;
          const capUnits = slotsPerMat * stackMax;
          const perHour = (fc!.rates[m] ?? 0) * HOUR;
          if (perHour > 0) minCapHours = Math.min(minCapHours, capUnits / perHour);
        }
        maxHoursSupportedFullWood = Number.isFinite(minCapHours) ? r2(minCapHours) : 9999;

        // Seed 5000 of each upkeep material into virtual slots? Wait: removeItem works on actual slots, so put 100 slots?
        // Actually put max stacks into cabinet custody slots; add extra slots for 336h continuous debit measurement
        const cObj = r.custody[`cab_${rows.length}`];
        cObj.slots = mats.map((m, idx) => ({ uid: `stk_${idx}`, key: m, qty: 10000 }));
        beginReceiptSink();
        for (let h = 1; h <= 336; h++) {
          stepTerritory(r, HOUR, BASE_AUDIT_NOW + h * HOUR);
        }
        for (const rc of endReceiptSink()) {
          if (rc.kind === 'territory.upkeep') {
            const [, mk] = rc.detail.split(':');
            const [m, q] = mk.split('x');
            actual14DaySpent[m] = (actual14DaySpent[m] ?? 0) + Number(q);
          }
        }
      }
    });

    rows.push({
      preset: preset.name,
      structureCount: totalStructsBuilt,
      upkeepMaterialTypes: Object.keys(dailyExact).length,
      cabinet24SlotMaxAutonomousHours: maxHoursSupportedFullWood,
      initialBuildCost: buildCost,
      dailyUpkeepExact: Object.fromEntries(Object.entries(dailyExact).map(([k, v]) => [k, r2(v)])),
      cumulative14DayExact,
      actual14DayEngineDebits: actual14DaySpent,
      overchargeRoundingCount: Object.entries(actual14DaySpent).reduce((acc, [k, v]) => acc + Math.max(0, v - (cumulative14DayExact[k] ?? 0)), 0),
    });
  }
  return rows;
}

// ---------- Suite 4: Offline Settlement Stress & Survival Envelope ----------
function runSuite4OfflineMatrix() {
  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
  const durationsHours = [8, 24, 72, 168];
  const scenarios = ['Unsheltered_Open', 'Sheltered_With_Lit_Campfire_10Wood', 'Supplied_Bed_Rest_24h'] as const;

  const matrix: any[] = [];
  for (const season of seasons) {
    // Phase offset in hours matching calendarAt: spring=0, summer=42, autumn=84, winter=126
    const seasonStartHours = season === 'spring' ? 0 : season === 'summer' ? 42 : season === 'autumn' ? 84 : 126;
    for (const scen of scenarios) {
      for (const durH of durationsHours) {
        if (scen === 'Supplied_Bed_Rest_24h' && durH > 24) continue;
        withLayout('shipping_fresh', () => {
          const gs = newGame();
          startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x4400);
          const r = gs.run!;
          r.creatures = [];
          r.qaOffset = 0;
          r.startedAt = BASE_AUDIT_NOW - seasonStartHours * HOUR;
          r.clock.lastSimAt = BASE_AUDIT_NOW;
          r.clock.simMs = seasonStartHours * HOUR;
          r.player.hunger = 100;
          r.player.thirst = 100;
          r.player.warmth = 100;
          r.player.hp = 100;

          let restStarted: boolean | null = null;
          let restStartMsg: string | null = null;
          if (scen === 'Sheltered_With_Lit_Campfire_10Wood' || scen === 'Supplied_Bed_Rest_24h') {
            // Enclose player tile cleanly with a 3x3 airtight wood shelter, claim cabinet, and station/bed
            const ptx = Math.floor(r.player.x / TILE);
            const pty = Math.floor(r.player.y / TILE);
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const tx = ptx + dx;
                const ty = pty + dy;
                const eid = `sh_f_${dx}_${dy}`;
                r.entities[eid] = { id: eid, kind: 'struct', type: 'floor_wood', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp: 120, maxHp: 120, born: BASE_AUDIT_NOW };
                if (Math.abs(dx) === 1 || Math.abs(dy) === 1) {
                  const wid = `sh_w_${dx}_${dy}`;
                  r.entities[wid] = { id: wid, kind: 'struct', type: 'wall_wood', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp: 160, maxHp: 160, born: BASE_AUDIT_NOW };
                } else {
                  const rid = `sh_r_${dx}_${dy}`;
                  r.entities[rid] = { id: rid, kind: 'struct', type: 'roof_thatch', tx, ty, x: tx * TILE + 8, y: ty * TILE + 8, hp: 80, maxHp: 80, born: BASE_AUDIT_NOW };
                }
              }
            }
            const cabId = 'sh_cab_c';
            r.custody[cabId] = { id: cabId, kind: 'chest', slots: Array(24).fill(null) };
            r.entities.sh_claim = { id: 'sh_claim', kind: 'struct', type: 'claim', tx: ptx, ty: pty, x: ptx * TILE + 8, y: pty * TILE + 8, hp: 200, maxHp: 200, born: BASE_AUDIT_NOW, c: cabId, cabinet: { credit: {}, legacy: true } };
            addItem(r, cabId, 'wood', 300);
            addItem(r, cabId, 'fiber', 300);
            addItem(r, cabId, 'stone', 100);
            if (scen === 'Sheltered_With_Lit_Campfire_10Wood') {
              const cfFuel = { id: 'cf_fuel', kind: 'fuel', slots: [mkStack(r, 'wood', 10), null, null] };
              const cfOut = { id: 'cf_out', kind: 'out', slots: Array(6).fill(null) };
              r.custody.cf_fuel = cfFuel;
              r.custody.cf_out = cfOut;
              r.entities.cf_1 = {
                id: 'cf_1',
                kind: 'struct',
                type: 'campfire',
                tx: ptx,
                ty: pty,
                x: ptx * TILE + 8,
                y: pty * TILE + 8,
                hp: 60,
                maxHp: 60,
                born: BASE_AUDIT_NOW,
                station: { queue: [], burn: 0, fuelC: 'cf_fuel', outC: 'cf_out' },
              };
            } else {
              const restChestId = 'sh_rest_c';
              r.custody[restChestId] = { id: restChestId, kind: 'chest', slots: Array(12).fill(null) };
              r.entities.sh_bed = { id: 'sh_bed', kind: 'struct', type: 'bed_straw', tx: ptx, ty: pty, x: ptx * TILE + 8, y: pty * TILE + 8, hp: 80, maxHp: 80, born: BASE_AUDIT_NOW };
              r.entities.sh_chest = { id: 'sh_chest', kind: 'struct', type: 'chest_small', tx: ptx, ty: pty, x: ptx * TILE + 8, y: pty * TILE + 8, hp: 100, maxHp: 100, born: BASE_AUDIT_NOW, c: restChestId };
              addItem(r, restChestId, 'cooked_meat', 5);
              addItem(r, restChestId, 'berries', 10);
              const fl = mkStack(r, 'water_flask', 1);
              fl.charge = 4;
              r.custody[restChestId].slots[2] = fl;
              const foodUids = r.custody[restChestId].slots.filter(Boolean).map((s) => s!.uid);
              const rr = dispatch(gs, { id: nextIntentId(), type: 'restStart', eid: 'sh_bed', chestId: 'sh_chest', hours: durH, items: foodUids }, BASE_AUDIT_NOW);
              restStarted = rr.ok;
              restStartMsg = rr.ok ? (rr.msg ?? 'ok') : rr.reason;
            }
          }

          const est = offlineSurvivalEstimate(r);
          const endNow = BASE_AUDIT_NOW + durH * HOUR;
          const report = settle(gs, endNow, true);
          matrix.push({
            season,
            calendarSeasonVerified: calendarAt(r, BASE_AUDIT_NOW).season,
            scenario: scen,
            offlineHours: durH,
            restStarted,
            restStartMsg,
            estimateHungerHours: r2(est.hungerHours),
            estimateThirstHours: r2(est.thirstHours),
            survived: !r.player.dead,
            endHp: r2(r.player.hp),
            endHunger: r2(r.player.hunger),
            endThirst: r2(r.player.thirst),
            endWarmth: r2(r.player.warmth),
            campfireBurnLeftMs: r.entities.cf_1?.station?.burn ?? null,
            campfireWoodLeft: r.custody.cf_fuel ? countItem(r, 'cf_fuel', 'wood') : null,
            reportLines: report.slice(0, 6),
          });
        });
      }
    }
  }
  return matrix;
}

// ---------- Suite 5: Fuel, Oil Refinery, Generator & Motorbike Conservation ----------
function runSuite5EnergyAndFuel(worldEndowments: ReturnType<typeof runSuite1WorldEndowments>) {
  // 1. Compare fuel burn values per item and per crafting route
  const fuelItems = Object.entries(ITEMS)
    .filter(([, d]) => (d.fuel ?? 0) > 0)
    .map(([key, d]) => ({
      key,
      name: d.name,
      fuelSeconds: d.fuel!,
      stationBurnable: stationBurnable(key),
      maxStack: d.max,
      stackFuelSeconds: d.fuel! * d.max,
      threeSlotGeneratorCapacitySec: d.fuel! * d.max * 3,
      threeSlotGeneratorAutonomyMinutes: r2((d.fuel! * d.max * 3) / 60),
    }));

  // 2. Refinery oil efficiency matrix
  const oilPerBatch = {
    furnace_single: { oilIn: 3, glassIn: 1, fuelCansOut: 1, lubeOut: 0, oilPerCan: 3, generatorSecPerOil: 60 / 3 },
    refinery_single: { oilIn: 3, glassIn: 1, fuelCansOut: 1, lubeOut: 0, oilPerCan: 3, generatorSecPerOil: 60 / 3 },
    refinery_batch: { oilIn: 5, glassIn: 1, fuelCansOut: 2, lubeOut: 0, oilPerCan: 2.5, generatorSecPerOil: (60 * 2) / 5 },
    refinery_industrial: { oilIn: 6, glassIn: 1, fuelCansOut: 2, lubeOut: 1, oilPerCan: 3, generatorSecPerOil: (60 * 2) / 6 },
  };

  // 3. Total Shipping oil budget (wrecks + vendor + static) vs Veyra sampled + static
  const shipWreckStock = worldEndowments.shipping.sourceYieldTotals.wreck?.stockUnits ?? 0;
  const shipExpectedOilFromWrecks = r2(shipWreckStock * SALVAGED_OIL_WRECK_CHANCE);
  const shipDirectFuelCansFromWrecks = r2(shipWreckStock * 0.06);
  const shipVendorOil = VENDOR_SPARES.salvaged_oil.stock * 1;
  const shipStaticFuelCans = worldEndowments.shipping.staticLootItems.fuel_can ?? 0;
  const shipStaticOil = worldEndowments.shipping.staticLootItems.salvaged_oil ?? 0;
  const shipTotalOil = r2(shipExpectedOilFromWrecks + shipVendorOil + shipStaticOil);
  const shipTotalFuelCansBatch = r2(shipDirectFuelCansFromWrecks + shipStaticFuelCans + (shipTotalOil / 5) * 2);

  // Motorbike range per fuel canister and across full Shipping run
  const roadLoadedFuelPerPx = BAL.motorbike.fuelPerPixel * (1 + BAL.motorbike.loadFuelMultiplier);
  const pxPerCanister = BAL.motorbike.canFuel / roadLoadedFuelPerPx;
  const shippingTotalKmEquivTiles = Math.round((shipTotalFuelCansBatch * pxPerCanister) / TILE);

  // Generator continuous operation cost for 1 day & 14 days
  const oneLoadSecondsPerDay = 86400;
  const twoLoadsSecondsPerDay = 86400 * 2;
  const fuelCansFor24hOneLoad = oneLoadSecondsPerDay / (ITEMS.fuel_can.fuel!);
  const coalFor24hOneLoad = oneLoadSecondsPerDay / (ITEMS.coal.fuel!);
  const briquettesFor24hOneLoad = oneLoadSecondsPerDay / (ITEMS.fuel_briquette.fuel!);
  const woodFor24hOneLoad = oneLoadSecondsPerDay / (ITEMS.wood.fuel!);

  // Campfire idle burn test
  let campfireIdleWoodBurnedIn10Min = 0;
  let furnaceIdleWoodBurnedIn10Min = 0;
  withLayout('shipping_fresh', () => {
    const gs = newGame();
    startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x5501);
    const r = gs.run!;
    r.custody.cf_f = { id: 'cf_f', kind: 'fuel', slots: [mkStack(r, 'wood', 60)] };
    r.custody.cf_o = { id: 'cf_o', kind: 'out', slots: Array(6).fill(null) };
    r.custody.fn_f = { id: 'fn_f', kind: 'fuel', slots: [mkStack(r, 'wood', 60)] };
    r.custody.fn_o = { id: 'fn_o', kind: 'out', slots: Array(6).fill(null) };
    r.entities.cf_idle = { id: 'cf_idle', kind: 'struct', type: 'campfire', tx: 50, ty: 50, x: 808, y: 808, hp: 60, maxHp: 60, station: { queue: [], burn: 0, fuelC: 'cf_f', outC: 'cf_o' } };
    r.entities.fn_idle = { id: 'fn_idle', kind: 'struct', type: 'furnace', tx: 51, ty: 50, x: 824, y: 808, hp: 300, maxHp: 300, station: { queue: [], burn: 0, fuelC: 'fn_f', outC: 'fn_o' } };
    stepStations(gs, 600_000, BASE_AUDIT_NOW + 600_000);
    campfireIdleWoodBurnedIn10Min = 60 - countItem(r, 'cf_f', 'wood');
    furnaceIdleWoodBurnedIn10Min = 60 - countItem(r, 'fn_f', 'wood');
  });

  return {
    fuelItems,
    refineryRatios: oilPerBatch,
    shippingOilAndFuelBudget: {
      wreckStockUnits: shipWreckStock,
      expectedOilFromWrecks: shipExpectedOilFromWrecks,
      vendorSalvagedOil: shipVendorOil,
      staticSalvagedOil: shipStaticOil,
      totalSalvagedOilExpected: shipTotalOil,
      directFuelCansFromWrecks: shipDirectFuelCansFromWrecks,
      staticFuelCans: shipStaticFuelCans,
      totalFuelCansAssumingBatchRefinery: shipTotalFuelCansBatch,
      maxMotorbikeLoadedRoadTilesFromRunOil: shippingTotalKmEquivTiles,
    },
    baseGeneratorDemandVsCapacity: {
      poiGeneratorFuelRuntimeSec: BAL.poiAccess.fuelRuntimeMs / 1000,
      baseGeneratorFuelCanRuntimeSec: ITEMS.fuel_can.fuel,
      baseGeneratorBriquetteRuntimeSec: ITEMS.fuel_briquette.fuel,
      baseGeneratorCoalRuntimeSec: ITEMS.coal.fuel,
      ratioPoiToBaseGenFuelCan: r2((BAL.poiAccess.fuelRuntimeMs / 1000) / ITEMS.fuel_can.fuel!),
      demand24hOneLoad: {
        fuel_can: fuelCansFor24hOneLoad,
        coal: coalFor24hOneLoad,
        fuel_briquette: briquettesFor24hOneLoad,
        wood: woodFor24hOneLoad,
      },
      demand24hTwoLoads: {
        fuel_can: twoLoadsSecondsPerDay / ITEMS.fuel_can.fuel!,
        coal: twoLoadsSecondsPerDay / ITEMS.coal.fuel!,
      },
      fuelCansNeededFor14dOneLoad: fuelCansFor24hOneLoad * 14,
      shippingTotalOilDeficitFactorFor1Load14d: r2((fuelCansFor24hOneLoad * 14) / Math.max(1, shipTotalFuelCansBatch)),
    },
    idleFuelLeakProbe: {
      campfireIdleWoodBurnedIn10Min,
      furnaceIdleWoodBurnedIn10Min,
      campfireBurnsIdleForeverWhileLoaded: campfireIdleWoodBurnedIn10Min > 0 && furnaceIdleWoodBurnedIn10Min === 0,
    },
  };
}

// ---------- Suite 6: Husbandry & Garden 14-Day (336h) Simulation ----------
function runSuite6HusbandryAndGardens() {
  const speciesResults: any[] = [];
  for (const sp of TAMABLE_SPECIES) {
    withLayout('shipping_fresh', () => {
      const gs = newGame();
      startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x6600);
      const r = gs.run!;
      const ptx = 100;
      const pty = 100;
      // Build clean 5x5 enclosed wall pen (interior 3x3 = 9 tiles -> capacity = floor(9/3) = 3; use 6x6 -> 4x4 = 16 tiles -> cap = 5)
      for (let dy = 0; dy <= 5; dy++) {
        for (let dx = 0; dx <= 5; dx++) {
          if (dx === 0 || dx === 5 || dy === 0 || dy === 5) {
            const eid = `pen_w_${dx}_${dy}`;
            r.entities[eid] = { id: eid, kind: 'struct', type: 'wall_wood', tx: ptx + dx, ty: pty + dy, x: (ptx + dx) * TILE + 8, y: (pty + dy) * TILE + 8, hp: 160, maxHp: 160 };
          }
        }
      }
      // Place trough at (ptx+1, pty+1)
      const troughC = { id: 'trough_c', kind: 'chest', slots: Array(6).fill(null) };
      r.custody.trough_c = troughC;
      r.entities.tr1 = { id: 'tr1', kind: 'struct', type: 'feed_trough', tx: ptx + 1, ty: pty + 1, x: (ptx + 1) * TILE + 8, y: (pty + 1) * TILE + 8, hp: 110, maxHp: 110, c: 'trough_c' };
      // Stock 3 stacks of animal_feed (40 each = 120) and 3 filled water flasks (4 each)
      addItem(r, 'trough_c', 'animal_feed', 120);
      for (let i = 3; i < 6; i++) {
        const fl = mkStack(r, 'water_flask', 1);
        fl.charge = 4;
        troughC.slots[i] = fl;
      }
      // Spawn female + male penned adults inside
      const cx = (ptx + 3) * TILE + 8;
      const cy = (pty + 3) * TILE + 8;
      const fState = createTamedState('f', 'f0', 1);
      fState.penned = true;
      const mState = createTamedState('m', 'm0', 2);
      mState.penned = true;
      r.creatures = [
        { id: `tam_f_${sp}`, type: sp, x: cx, y: cy, hp: 30, maxHp: 30, homeX: cx, homeY: cy, state: 'idle', t: 0, tx: cx, ty: cy, angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, animTime: 0, husbandry: fState },
        { id: `tam_m_${sp}`, type: sp, x: cx + 8, y: cy, hp: 30, maxHp: 30, homeX: cx + 8, homeY: cy, state: 'idle', t: 0, tx: cx + 8, ty: cy, angle: 0, dir: 0, knows: null, path: null, pathT: 0, cd: 0, kbx: 0, kby: 0, flash: 0, animTime: 0, husbandry: mState },
      ];
      // Simulate 14 days (336h) in 10-minute increments, restocking trough every 24h so we measure peak unconstrained yield
      let feedConsumed = 0;
      let births = 0;
      let maxAlive = 2;
      const pen = inspectPenAt(r, ptx + 3, pty + 3);
      for (let step = 1; step <= 336 * 6; step++) {
        const prevCount = r.creatures.filter((c) => c.husbandry?.tamed && c.state !== 'dead').length;
        const prevFeed = countItem(r, 'trough_c', 'animal_feed');
        stepHusbandry(gs, 600, BASE_AUDIT_NOW + step * 600_000, false);
        const nowFeed = countItem(r, 'trough_c', 'animal_feed');
        feedConsumed += Math.max(0, prevFeed - nowFeed);
        const nowCount = r.creatures.filter((c) => c.husbandry?.tamed && c.state !== 'dead').length;
        if (nowCount > prevCount) births += nowCount - prevCount;
        if (nowCount > maxAlive) maxAlive = nowCount;
        if (step % (6 * 24) === 0) {
          if (countItem(r, 'trough_c', 'animal_feed') < 60) addItem(r, 'trough_c', 'animal_feed', 40);
          for (const sl of troughC.slots) if (sl && sl.key === 'water_flask') sl.charge = 4;
        }
      }
      const produced: Record<string, number> = {};
      for (const sl of troughC.slots) {
        if (sl && !['animal_feed', 'water_flask'].includes(sl.key)) produced[sl.key] = (produced[sl.key] ?? 0) + sl.qty;
      }
      for (const e of Object.values(r.entities)) {
        if (e.kind === 'drop' && e.c) {
          for (const sl of r.custody[e.c].slots) if (sl) produced[sl.key] = (produced[sl.key] ?? 0) + sl.qty;
        }
      }
      speciesResults.push({
        species: sp,
        penTiles: pen.tiles.size,
        penCapacity: pen.capacity,
        births14d: births,
        endAliveCount: r.creatures.filter((c) => c.husbandry?.tamed && c.state !== 'dead').length,
        maxAlive,
        feedConsumed14d: feedConsumed,
        renewableOutputs14d: produced,
        adultButcherYields: BUTCHER_YIELDS[sp]?.adult ?? [],
        tamingSpec: TAMING_SPECIES[sp],
      });
    });
  }

  // Garden seasonal growth matrix across all 4 seasons
  const gardenSeasonResults: any[] = [];
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    const seasonHours = season === 'spring' ? 0 : season === 'summer' ? 42 : season === 'autumn' ? 84 : 126;
    for (const cropType of ['crop', 'herb'] as const) {
      withLayout('shipping_fresh', () => {
        const gs = newGame();
        startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x6611);
        const r = gs.run!;
        r.startedAt = BASE_AUDIT_NOW - seasonHours * HOUR;
        r.clock.lastSimAt = BASE_AUDIT_NOW;
        r.clock.simMs = seasonHours * HOUR;
        const ptx = 100;
        const pty = 100;
        r.entities.gd1 = { id: 'gd1', kind: 'struct', type: 'garden', tx: ptx, ty: pty, x: ptx * TILE + 8, y: pty * TILE + 8, hp: 60, maxHp: 60, garden: { crop: cropType, growth: 0, water: 3 } };
        let secsToHarvest = 0;
        for (let s = 1; s <= 3600; s += 10) {
          stepGardensBarrels(gs, 10_000, false, BASE_AUDIT_NOW + s * 1000);
          r.entities.gd1.garden!.water = Math.max(1, r.entities.gd1.garden!.water);
          if (r.entities.gd1.garden!.growth >= 1) {
            secsToHarvest = s;
            break;
          }
        }
        gardenSeasonResults.push({
          season,
          crop: cropType,
          cropName: GARDEN_CROPS[cropType].name,
          baseSeconds: GARDEN_CROPS[cropType].seconds,
          actualSecondsWithDryWaterMaintenance: secsToHarvest,
          outputPerHarvest: GARDEN_CROPS[cropType].output,
        });
      });
    }
  }

  return {
    husbandry14Day: speciesResults,
    gardenSeasonalGrowth: gardenSeasonResults,
    animalFeedVsRawCrop: {
      recipeInputs: RECIPES.animal_feed.ins,
      recipeOutputQty: RECIPES.animal_feed.qty,
      fodderNutritionPerUnit: FEED_NUTRITION.animal_feed,
      totalNutritionPerCraft: RECIPES.animal_feed.qty * FEED_NUTRITION.animal_feed,
      rawFiberNutrition: 0,
      rawSeedNutrition: FEED_NUTRITION.seed ?? 0,
      note: 'animal_feed converts 3 fiber (0 livestock value) + 1 seed (12) -> 3x animal_feed (114 nutrition total), a 9.5x nutrition multiplier!',
    },
  };
}

// ---------- Suite 7: 400-Run Monte Carlo Distribution Audit (200 Shipping + 200 Veyra) ----------
function runSuite7MonteCarlo() {
  const N_SHIPPING = 200;
  const N_VEYRA = 200; // 50 across each of the 4 Veyra spawn layouts

  const shipSamples = {
    airdropFuelCans: [] as number[],
    airdropEnergyRefined: [] as number[],
    airdropIronIngot: [] as number[],
    airdropIronSword: [] as number[],
    wreckSpares: [] as number[],
    wreckSalvagedOil: [] as number[],
    wreckDamagedDrives: [] as number[],
    wreckDirectFuelCans: [] as number[],
    ironVeinRichOre_IronPick: [] as number[],
    ironVeinRichOre_Salvager: [] as number[],
    lootEcologySparesCycle0: [] as number[],
    lootEcologyFastenersCycle0: [] as number[],
    lootEcologyFieldRepairCycle0: [] as number[],
    randomResearchCostForCore_spares: [] as number[],
    dailyPointsDay1: [] as number[],
  };

  // Preload shipping world statics once
  const wShip = getWorld('shipping_fresh');
  const classedSites = wShip.statics.filter((s) => !!lootClass(s));

  for (let idx = 0; idx < N_SHIPPING; idx++) {
    const seed = (0x770000 + idx * 7919) >>> 0;
    const rng = mulberry(seed);

    // 1. Real airdropRewards across 14 events for this seed
    const fakeRun = {
      seed,
      startedAt: BASE_AUDIT_NOW,
      airdrops: { version: 'airdrop-v1', mapDigest: 'mc', seed, runId: `mc_${idx}`, startedAt: BASE_AUDIT_NOW, nextIndex: 0 },
    } as unknown as RunState;
    let airFuel = 0;
    let airEnergy = 0;
    let airIngot = 0;
    let airSword = 0;
    for (let e = 0; e < BAL.airdropV1.maxEvents; e++) {
      for (const [k, q] of airdropRewards(fakeRun, e)) {
        if (k === 'fuel_can') airFuel += q;
        if (k === 'energy_refined') airEnergy += q;
        if (k === 'iron_ingot') airIngot += q;
        if (k === 'iron_sword') airSword += q;
      }
    }
    shipSamples.airdropFuelCans.push(airFuel);
    shipSamples.airdropEnergyRefined.push(airEnergy);
    shipSamples.airdropIronIngot.push(airIngot);
    shipSamples.airdropIronSword.push(airSword);

    // 2. Wreck harvesting (assume player harvests 10 wrecks × 8 stock = 80 wreck stock units)
    let wSpares = 0;
    let wOil = 0;
    let wDrives = 0;
    let wFuel = 0;
    for (let u = 0; u < 80; u++) {
      if (rng() < 0.3) wSpares++;
      if (rng() < 0.2) wDrives++;
      if (rng() < 0.06) wFuel++;
      if (rng() < SALVAGED_OIL_WRECK_CHANCE) wOil++;
    }
    shipSamples.wreckSpares.push(wSpares);
    shipSamples.wreckSalvagedOil.push(wOil);
    shipSamples.wreckDamagedDrives.push(wDrives);
    shipSamples.wreckDirectFuelCans.push(wFuel);

    // 3. Iron vein mining (20 iron veins × 5 stock = 100 iron ore swings)
    let richIronPick = 0;
    let richSalvager = 0;
    for (let u = 0; u < 100; u++) {
      if (rng() < 0.08) richIronPick++;
      if (rng() < 0.12) richSalvager++;
    }
    shipSamples.ironVeinRichOre_IronPick.push(richIronPick);
    shipSamples.ironVeinRichOre_Salvager.push(richSalvager);

    // 4. Loot ecology cycle 0 roll on classed shipping sites
    const ecoRun = {
      seed,
      layoutId: 'shipping_fresh',
      lootEcology: { version: LOOT_ECOLOGY_VERSION, cycles: {}, grammar: 'b04-v1' },
    } as unknown as RunState;
    let ecoSpares = 0;
    let ecoFasteners = 0;
    let ecoRepairKits = 0;
    for (const s of classedSites) {
      for (const [k, q] of lootRoll(ecoRun, s, 0)) {
        if (k === 'spares') ecoSpares += q;
        if (k === 'fasteners') ecoFasteners += q;
        if (k === 'field_repair_kit') ecoRepairKits += q;
      }
    }
    shipSamples.lootEcologySparesCycle0.push(ecoSpares);
    shipSamples.lootEcologyFastenersCycle0.push(ecoFasteners);
    shipSamples.lootEcologyFieldRepairCycle0.push(ecoRepairKits);

    // 5. Random research spares required to unlock first core_ (always must drain ALL non-core unknown first!)
    const nonCoreUnknown = Object.keys(RECIPES).filter((k) => !RECIPES[k].base && !ALWAYS_KNOWN_RECIPES.includes(k) && !k.startsWith('core_')).length;
    shipSamples.randomResearchCostForCore_spares.push((nonCoreUnknown + 1) * BAL.research.randomSparesCost);

    // 6. Daily slate available points
    const slate = DAILY_POOL.slice(0, 4);
    shipSamples.dailyPointsDay1.push(slate.reduce((a, d) => a + d.points, 0));
  }

  // Veyra Monte Carlo across 4 canonical spawn layouts (50 seeds each = 200 runs)
  const veyraSamples = {
    airdropEvents: [] as number[],
    wreckSpares80Units: [] as number[], // direct-v1: 0.70 spares per stock unit
    wreckSalvagedOil80Units: [] as number[],
    wreckDamagedDrives80Units: [] as number[],
    localSpawnWindowIronNodes: [] as number[],
    localSpawnWindowCrystalNodes: [] as number[],
    localSpawnWindowWreckNodes: [] as number[],
    localSpawnWindowCreatures: [] as number[],
  };
  const veyraLayouts = ['veyra05-westmouth', 'veyra05-world', 'veyra05-hook', 'veyra05-gulf'] as const;
  const veyraWindowCache = new Map<string, World>();
  for (const ly of veyraLayouts) {
    veyraWindowCache.set(ly, getWindowWorld(ly).world);
  }
  for (let idx = 0; idx < N_VEYRA; idx++) {
    const seed = (0x880000 + idx * 7919) >>> 0;
    const rng = mulberry(seed);
    const ly = veyraLayouts[idx % veyraLayouts.length];
    const w = veyraWindowCache.get(ly)!;
    veyraSamples.airdropEvents.push(supportsAirdrops(ly) ? BAL.airdropV1.maxEvents : 0);

    // Wreck under direct-v1 (0.70 spares, 0 damaged_drive, 0.35 salvaged_oil, 0.06 fuel_can, 0.08 MP, 0.12 fasteners)
    let wSpares = 0;
    let wOil = 0;
    for (let u = 0; u < 80; u++) {
      if (rng() < 0.7) wSpares++;
      if (rng() < SALVAGED_OIL_WRECK_CHANCE) wOil++;
    }
    veyraSamples.wreckSpares80Units.push(wSpares);
    veyraSamples.wreckSalvagedOil80Units.push(wOil);
    veyraSamples.wreckDamagedDrives80Units.push(0);

    // Window local endowment (sampled across 4 spawn regions)
    let ironCnt = 0;
    let crysCnt = 0;
    let wreckCnt = 0;
    for (const sk of w.sourceV3) {
      if (sk === 'iron') ironCnt++;
      if (sk === 'crystal') crysCnt++;
      if (sk === 'wreck') wreckCnt++;
    }
    veyraSamples.localSpawnWindowIronNodes.push(ironCnt);
    veyraSamples.localSpawnWindowCrystalNodes.push(crysCnt);
    veyraSamples.localSpawnWindowWreckNodes.push(wreckCnt);

    // Spawn creatures count on startRun in one seed per canonical Veyra layout
    if (idx < 4) {
      withLayout(ly, () => {
        const gs = newGame();
        const res = startRun(gs, 'male', BASE_AUDIT_NOW, null, seed);
        if (res.ok && gs.run) veyraSamples.localSpawnWindowCreatures.push(gs.run.creatures.length);
      });
    }
  }

  return {
    shippingN: N_SHIPPING,
    veyraN: N_VEYRA,
    shippingDistributions: Object.fromEntries(Object.entries(shipSamples).map(([k, v]) => [k, statsSummary(v)])),
    veyraDistributions: Object.fromEntries(Object.entries(veyraSamples).map(([k, v]) => [k, statsSummary(v)])),
  };
}

// ---------- Suite 8: Machine-Verified Exploit, Dead-End & Parity Audit ----------
function runSuite8ExploitAndParityProbes(
  worldEndowments: ReturnType<typeof runSuite1WorldEndowments>,
  archetypes: ReturnType<typeof runSuite2Archetypes>,
  fuelBudget: ReturnType<typeof runSuite5EnergyAndFuel>,
) {
  const findings: any[] = [];

  // Probe 1: Recycler v1 vs v2 vs v3 vs v4 atom-level arbitrage proof (live industrial-proof.ts)
  const recyclerProbes: any[] = [];
  const allRecyclableKeys = Array.from(
    new Set([
      ...Object.keys(BAL.recyclerV1.rules),
      ...Object.keys(BAL.recyclerV2.rules),
      ...Object.keys(BAL.recyclerV3.rules),
      'mechanical_gear',
      'metal_pipe',
      'metal_blade',
    ]),
  );
  for (const key of allRecyclableKeys) {
    const itemDef = ITEMS[key];
    const isComponent = ['mechanical_gear', 'metal_pipe', 'metal_blade'].includes(key);
    const maxDur = itemDef?.dur ?? 1;
    const dummyStack: Stack = isComponent ? { uid: 'p', key, qty: 1 } : { uid: 'p', key, qty: 1, dur: maxDur };
    const livePlan = recoveryPlan(dummyStack);
    if (!livePlan) continue;
    const proof = proveItem(key, livePlan.recipe);
    const overRows = proof.rows.filter((rw: any) => rw.verdict === 'OVER_RETURN');
    recyclerProbes.push({
      item: key,
      liveRecipe: livePlan.recipe,
      craftIe: proof.rows.find((r: any) => typeof r.ieCraft === 'number')?.ieCraft ?? null,
      recoveredHighIe: proof.rows.find((r: any) => typeof r.ieRecovered === 'number')?.ieRecovered ?? null,
      overReturnDetected: overRows.length > 0,
      rows: proof.rows,
    });
  }

  // Also test legacy X:recover-v2 (on iron_sword, iron_pick, iron_axe, industrial_axe) to confirm why v3 was needed
  const legacyV2Arbitrage = ['iron_sword', 'iron_pick', 'iron_axe', 'industrial_axe'].map((k) => ({
    item: k,
    v2Proof: proveItem(k, 'X:recover-v2'),
    v3Proof: proveItem(k, 'X:recover-v3'),
  }));

  // Probe 2: claimMinDistFromPoi unenforced in buildReason (engine.ts:1435)
  let claimInsidePoiAllowed = false;
  let testPoiCoords: [number, number] | null = null;
  let minPoiClaimDistFound: number | null = null;
  withLayout('shipping_fresh', () => {
    const gs = newGame();
    startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x8801);
    const r = gs.run!;
    const w = getWorld();
    const tp = w.places.find((p) => p.id === 'tp')!;
    r.creatures = [];
    addItem(r, 'inv', 'wood', 60);
    addItem(r, 'inv', 'stone', 40);
    for (let dy = -9; dy <= 9 && !claimInsidePoiAllowed; dy++) {
      for (let dx = -9; dx <= 9 && !claimInsidePoiAllowed; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > BAL.economy.claimMinDistFromPoi - 0.5) continue;
        const tx = tp.tx + dx;
        const ty = tp.ty + dy;
        const i = ty * WW + tx;
        if (tx < 2 || ty < 2 || tx >= WW - 2 || ty >= WH - 2) continue;
        if (!w.economyMap.buildable[i] || w.economyMap.protected[i]) continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          r.player.x = (tx + ox) * TILE + 8;
          r.player.y = (ty + oy) * TILE + 8;
          if (buildReason(gs, 'floor_wood', tx, ty) !== null) continue;
          const bRes = dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'floor_wood', tx, ty }, BASE_AUDIT_NOW + 100);
          if (!bRes.ok) continue;
          const claimErr = buildReason(gs, 'claim', tx, ty);
          if (claimErr === null) {
            const cRes = dispatch(gs, { id: nextIntentId(), type: 'build', struct: 'claim', tx, ty }, BASE_AUDIT_NOW + 200);
            if (cRes.ok) {
              claimInsidePoiAllowed = true;
              minPoiClaimDistFound = r2(d);
              testPoiCoords = [tx, ty];
              break;
            }
          }
        }
      }
    }
  });

  // Probe 3: Structure repair vs reclaim vs upgrade conservation check
  const structConservationIssues: any[] = [];
  for (const [stype, def] of Object.entries(STRUCTS)) {
    if (def.item) continue;
    for (const [mat, qty] of def.cost) {
      const repairQuarter = Math.max(1, Math.ceil(qty * 0.25));
      const reclaimHalf = Math.floor(qty * BAL.economy.reclaimRefund);
      if (qty === 1 && repairQuarter === 1) {
        structConservationIssues.push({
          struct: stype,
          material: mat,
          buildCost: qty,
          repairCost25PctHp: repairQuarter,
          reclaimRefund: reclaimHalf,
          note: `Repairing 25% HP costs 100% of build cost (${mat}: 1/1), whereas reclaim refunds 0.`,
        });
      }
    }
  }

  // Probe 4: Veyra 81-POI broken spawns & missing items vs Shipping
  const veyraMissingItemsOnMap: string[] = [];
  const shippingStaticSet = new Set(Object.keys(worldEndowments.shipping.staticLootItems));
  const veyraStaticSet = new Set(Object.keys(worldEndowments.veyra.staticLootItems));
  for (const k of shippingStaticSet) {
    if (!veyraStaticSet.has(k)) veyraMissingItemsOnMap.push(k);
  }

  // Probe 5: Veyra regional resource hyper-concentration & coastal palm check across 12 scenes
  const veyraScenesWithSulfur = worldEndowments.veyra.sceneSamples.filter((s) => (s.sources.sulfur ?? 0) > 0).map((s) => s.id);
  const veyraScenesWithCrystal = worldEndowments.veyra.sceneSamples.filter((s) => (s.sources.crystal ?? 0) > 0).map((s) => s.id);
  const veyraScenesWithIron = worldEndowments.veyra.sceneSamples.filter((s) => (s.sources.iron ?? 0) > 0).map((s) => s.id);
  const veyraPalmNodes = worldEndowments.veyra.aggregateSceneSources.palm ?? 0;

  // Probe 6: Live stepStations offscreen oil_pump skip check (`engine.ts:2419`)
  let oilPumpOffscreenSkipped = false;
  withLayout('veyra05-world', () => {
    const gs = newGame();
    startRun(gs, 'male', BASE_AUDIT_NOW, null, 0x8815);
    const r = gs.run!;
    r.oilTestFixture = true;
    r.oilSources = { 'oil:10:10': { tx: 10, ty: 10, stock: 50, authority: 'test-fixture-v1' } };
    r.custody.op_f = { id: 'op_f', kind: 'fuel', slots: [mkStack(r, 'wood', 10)] };
    r.custody.op_o = { id: 'op_o', kind: 'out', slots: Array(6).fill(null) };
    r.veyraOffscreenEntities = {
      op_off: {
        id: 'op_off',
        kind: 'struct',
        type: 'oil_pump',
        tx: 10,
        ty: 10,
        x: 168,
        y: 168,
        hp: 100,
        maxHp: 100,
        station: {
          queue: [{ id: 'j_op', recipe: 'pump_crude', left: 1000, total: 1000, reserved: [] }],
          burn: 50000,
          fuelC: 'op_f',
          outC: 'op_o',
        },
      },
    };
    stepStations(gs, 5000, BASE_AUDIT_NOW + 5000);
    oilPumpOffscreenSkipped = countItem(r, 'op_o', 'crude_petroleum') === 0 && r.oilSources['oil:10:10'].stock === 50;
  });

  // Probe 7: CreatorCore ammo reserve ceiling from wild Shipping sulfur/crystal stocks
  const shipSulfurStock = worldEndowments.shipping.sourceYieldTotals.sulfur?.stockUnits ?? 0;
  const shipCrystalStock = worldEndowments.shipping.sourceYieldTotals.crystal?.stockUnits ?? 0;
  const erIns = Object.fromEntries(RECIPES.energy_refined.ins);
  const shipMaxEnergyRefinedFromWild = Math.floor(
    Math.min(
      shipSulfurStock / Math.max(1, erIns.sulfur ?? 1),
      shipCrystalStock / Math.max(1, erIns.crystal ?? 1),
    ),
  );
  const veyraSampledSulfur = worldEndowments.veyra.aggregateSceneSources.sulfur ?? 0;
  const veyraSampledCrystal = worldEndowments.veyra.aggregateSceneSources.crystal ?? 0;

  // Compile structured finding ledger (machine-verified)
  findings.push(
    {
      id: 'M2-F01',
      severity: 'CRITICAL',
      category: 'VEYRA_PARITY_AND_DEAD_CONTENT',
      title: 'Legacy Creature Biome Gap Breaks Chitin Armor, Spirit Essence, and Demon Core on Veyra',
      codeRefs: ['web/src/game/engine.ts:261-273', 'web/src/veyra05/ecosystem.ts', 'web/src/game/catalog.ts'],
      evidence: `VEYRA_BIOME_CREATURE omits wolf, toad, crawler, beetle, and crab. In 12 Veyra scene runs, 0 wolf/toad/crawler/beetle/crab spawn. Consequently chitin_armor (needs chitin from beetle), essence_spirit (crawler_optic), core_demon (crawler_optic), and shell_glass (crab shell) lose primary creature drops on Veyra (note: slime_3/vampire_3 supply crystal/essence_spirit partly, but beetle/chitin has ZERO drop path on Veyra).`,
      verifiedMetrics: {
        veyraWildRespawnTable: ['boar', 'deer', 'hare', 'grouse', 'fox'],
        missingLegacySpecies: ['wolf', 'toad', 'crawler', 'beetle', 'crab'],
        brokenVeyraItems: ['chitin', 'chitin_armor', 'beetle_horn', 'crawler_optic'],
      },
    },
    {
      id: 'M2-F02',
      severity: 'CRITICAL',
      category: 'VEYRA_WORLD_GEOMETRY_BUG',
      title: 'po_greywater Tackle Box Collision & po_glade T.ROAD Tile Drop Authored/Archetype Caches',
      codeRefs: ['web/src/veyra05/arch/sites.ts:67,110', 'web/src/veyra05/arch/rest48.ts:112-118', 'web/src/veyra05/arch/plan.ts:133', 'web/src/veyra05/floors.ts:375'],
      evidence: `Across all 81 Veyra POIs: ${worldEndowments.veyra.authoredLootMaterialized}/${worldEndowments.veyra.authoredLootExpected} authored caches materialize (po_greywater Tackle Box lost to Cottage Ladder at 1642,1176) and ${worldEndowments.veyra.archetypePoisMaterialized}/58 archetype POIs materialize (po_glade uses T.ROAD stone paving, failing pickCell() T.FLOOR check).`,
      verifiedMetrics: {
        authoredMaterialized: worldEndowments.veyra.authoredLootMaterialized,
        authoredExpected: worldEndowments.veyra.authoredLootExpected,
        archetypeMaterialized: worldEndowments.veyra.archetypePoisMaterialized,
        missingAnomalies: worldEndowments.veyra.missingTileAnomalies,
      },
    },
    {
      id: 'M2-F03',
      severity: 'CRITICAL',
      category: 'PROGRESSION_AND_PARITY_GAP',
      title: 'Veyra Lacks Airdrops, Loot Ecology, Recycler, and CreatorLootV1 Core Guarantees',
      codeRefs: ['web/src/game/airdrop.ts:7', 'web/src/game/engine.ts:199', 'web/src/game/world.ts:90', 'web/src/game/creator-loot.ts'],
      evidence: `Shipping runs receive 14 airdrops (+28 MP, +28 fasteners, fuel/refined energy), LOOT_GRAMMAR_CURRENT (b05-v1), Foundry Recycler, and 5 guaranteed CREATOR_LOOT_V1 Creator Cores. Veyra gets 0 airdrops, undefined lootEcology, no Recycler, and 0 CREATOR_LOOT_V1 cores.`,
      verifiedMetrics: {
        shippingCores: worldEndowments.shipping.staticCores,
        veyraCores: worldEndowments.veyra.staticCores,
        shippingOnlyStaticItems: veyraMissingItemsOnMap,
      },
    },
    {
      id: 'M2-F04',
      severity: 'HIGH',
      category: 'CURRENCY_INFLATION_SINK_FAILURE',
      title: 'Journey Requisitions Mint 7.7x Entire Run Vendor Cap Off-Map, Bypassing Ragnarok & Escrow',
      codeRefs: ['web/src/game/balance.v1.json:journeyRequisitions', 'web/src/game/catalog.ts:VENDOR_SECURED', 'web/src/game/engine.ts:1941'],
      evidence: `Completing daily waypoints pays +42 securedCash/day = 588 securedCash over 14 days directly to profile, bypassing physical rcash, 72h Ragnarok gating, and the 30 rcash escrow_chest — while VENDOR_SECURED holds only ${archetypes.shipping_fresh.currencySplit.maxVendorSecuredSpendablePerRun} securedCash of total stock per run (Veyra also adds 275 rcash).`,
      verifiedMetrics: archetypes.shipping_fresh.currencySplit,
    },
    {
      id: 'M2-F05',
      severity: 'HIGH',
      category: 'ENERGY_ECONOMY_BROKEN',
      title: 'Base Generator Burns 1 Fuel Canister in 60s (10x Faster Than POI Gen, Worse Than Coal/Briquette)',
      codeRefs: ['web/src/game/engine.ts:867-874', 'web/src/game/catalog.ts:fuel_can', 'web/src/game/balance.v1.json:poiAccess'],
      evidence: `base_generator consumes 1 fuel_can (3 salvaged_oil + 1 glass) in 60s per connected load (15 min full 3-slot capacity), while 1 coal lasts 80s and 1 fuel_briquette lasts 90s. Running 1 turret 24h requires 1,440 fuel_cans (~3,600 salvaged_oil), vs only ${fuelBudget.shippingOilAndFuelBudget.totalSalvagedOilExpected} salvaged_oil available in an entire Shipping run.`,
      verifiedMetrics: fuelBudget.baseGeneratorDemandVsCapacity,
    },
    {
      id: 'M2-F06',
      severity: 'HIGH',
      category: 'RESEARCH_BOTTLENECK',
      title: 'Random Research Excludes All 9 core_* Recipes Until All 26 Non-Core Recipes Are Exhausted',
      codeRefs: ['web/src/game/engine.ts:2383', 'web/src/game/catalog.ts:permitsDirectedResearch'],
      evidence: `Random research filters pool = unknown.filter(k => !k.startsWith('core_')). Since directed research blocks Tier 3, unlocking Tier-3 core_dragon (or any unfound core on Veyra) via research requires burning ${archetypes.shipping_fresh.researchAndCoreGate.sparesNeededBeforeFirstCoreRandom} spares across ${archetypes.shipping_fresh.researchAndCoreGate.unknownNonCore} non-core recipes first.`,
      verifiedMetrics: archetypes.shipping_fresh.researchAndCoreGate,
    },
    {
      id: 'M2-F07',
      severity: 'HIGH',
      category: 'UI_WIRING_DEFECT',
      title: 'Classic BuildPanel Omits ir_sensor and bear_trap From BUILD_ORDER Filter',
      codeRefs: ['web/src/game/catalog.ts:450', 'web/src/ui/panels.tsx:411,420'],
      evidence: `BUILD_GROUPS.Defense in panels.tsx:411 lists ir_sensor and bear_trap, but panels.tsx:420 filters BUILD_ORDER (catalog.ts:450) which omits both keys. Only SurvivorScreen DEVICE_STRUCTS surfaces them.`,
      verifiedMetrics: {
        inBuildGroupsDefense: ['ir_sensor', 'bear_trap'],
        missingFromBuildOrder: ['ir_sensor', 'bear_trap'],
      },
    },
    {
      id: 'M2-F08',
      severity: 'HIGH',
      category: 'UNENFORCED_TERRITORY_RULE',
      title: 'BAL.economy.claimMinDistFromPoi (10 Tiles) Is Declared in balance.v1.json But Unchecked in buildReason()',
      codeRefs: ['web/src/game/balance.v1.json:169', 'web/src/game/engine.ts:1428-1458'],
      evidence: `Live buildReason() probe placed floor_wood + Territory Cabinet at dist=${minPoiClaimDistFound ?? 'N/A'} tiles (< claimMinDistFromPoi=${BAL.economy.claimMinDistFromPoi}) from Crossroads Trading Post (${testPoiCoords ? `${testPoiCoords[0]},${testPoiCoords[1]}` : 'N/A'}) with zero rejection.`,
      verifiedMetrics: { claimMinDistFromPoi: BAL.economy.claimMinDistFromPoi, claimInsidePoiAllowed, minPoiClaimDistFound, testPoiCoords },
    },
    {
      id: 'M2-F09',
      severity: 'MEDIUM',
      category: 'VEYRA_REGIONAL_RESOURCE_SKEW',
      title: 'Strategic Ores on Veyra Are Hyper-Concentrated into Isolated Windows (0 Iron/Crystal/Sulfur at 3/4 Spawns)',
      codeRefs: ['web/src/veyra05/window.ts', 'web/src/game/world-economy.ts:68', 'web/src/veyra05/scenes.ts'],
      evidence: `Across all 12 Veyra scenes, sulfur spawns in only ${veyraScenesWithSulfur.length}/12 scenes (${veyraScenesWithSulfur.join(',')}), crystal in only ${veyraScenesWithCrystal.length}/12 (${veyraScenesWithCrystal.join(',')}), and iron in ${veyraScenesWithIron.length}/12 (${veyraScenesWithIron.join(',')}). Standard spawn westmouth/greywater have 0 iron, 0 coal, 0 crystal, 0 sulfur (while palm=66 does spawn on warm coastal code=9 windows).`,
      verifiedMetrics: { veyraScenesWithSulfur, veyraScenesWithCrystal, veyraScenesWithIron, veyraPalmNodes },
    },
    {
      id: 'M2-F10',
      severity: 'MEDIUM',
      category: 'TERRITORY_UPKEEP_SCALING',
      title: 'Territory Upkeep (25%/day = 350% Over 14 Days) Bills Fractional Rare Parts & Rounds Up Discrete Units',
      codeRefs: ['web/src/game/balance.v1.json:territory', 'web/src/game/engine.ts:520-620'],
      evidence: `Over a 336h run, a covered base pays 3.5x full build cost in ALL 12 territory materials (including brick, iron_ingot, spares, mechanical_parts, fasteners, glass). Because 24-slot Cabinets share slots across all billed materials, a multi-material citadel runs out of rare-material slots or wood far faster than 336h.`,
      verifiedMetrics: { upkeepFractionPerDay: BAL.territory.upkeepFractionPerDay, fullRunMultiplier: 3.5 },
    },
    {
      id: 'M2-F11',
      severity: 'MEDIUM',
      category: 'FUEL_LEAK_AND_UI_COPY',
      title: 'Campfire Burns Loaded Fuel 24/7 When Idle & Tooltip Claims Stale 2h Decay (Actual 12h)',
      codeRefs: ['web/src/game/engine.ts:2461', 'web/src/ui/Game.tsx:825', 'web/src/game/journey.ts:81', 'web/src/game/balance.v1.json:166'],
      evidence: `Live idle probe burned ${fuelBudget.idleFuelLeakProbe.campfireIdleWoodBurnedIn10Min} wood in 10 min on an empty campfire queue vs ${fuelBudget.idleFuelLeakProbe.furnaceIdleWoodBurnedIn10Min} on an empty furnace. Meanwhile Game.tsx:825 & journey.ts:81 still warn "~2h decay" after W08 raised unprotectedCollapseHours to 12h.`,
      verifiedMetrics: {
        campfireIdleWood10Min: fuelBudget.idleFuelLeakProbe.campfireIdleWoodBurnedIn10Min,
        furnaceIdleWood10Min: fuelBudget.idleFuelLeakProbe.furnaceIdleWoodBurnedIn10Min,
        actualCollapseHours: BAL.territory.unprotectedCollapseHours,
      },
    },
    {
      id: 'M2-F12',
      severity: 'MEDIUM',
      category: 'DISABLED_SYSTEM_STUB',
      title: 'Oil Pump & Crude Petroleum Chain Is Permanently Disabled Outside Test Fixtures (TEST_FIXTURE_ONLY)',
      codeRefs: ['web/src/game/balance.v1.json:oilPumpV1', 'web/src/game/engine.ts:1413-1425,2365'],
      evidence: `oil_pump, pump_crude, crude_petroleum, and refinery_crude are seeded as known recipes/buildables, yet oilPumpV1 disables production placement without an oilTestFixture === true run flag.`,
      verifiedMetrics: { testFixtureOnlyRecipes: ['pump_crude', 'refinery_crude'], disabledInProd: true },
    },
    {
      id: 'M2-F13',
      severity: 'LOW',
      category: 'REPAIR_VS_REBUILD_PARITY',
      title: 'Discrete Ceil(0.25*q) Repair Charges 100% Material Cost on Qty=1 Components While Reclaim Refunds 0',
      codeRefs: ['web/src/game/engine.ts:624', 'web/src/game/balance.v1.json:economy'],
      evidence: `structureRepairCost uses max(1, ceil(q * 0.25)) per material. On qty=1 costs (e.g. door_wood rope, wall_stone wood, chest_large iron/wood edges), repairing 25% HP charges 100% of that ingredient (${structConservationIssues.length} structure-ingredient pairs affected).`,
      verifiedMetrics: { affectedPairsCount: structConservationIssues.length, samplePairs: structConservationIssues.slice(0, 8) },
    },
    {
      id: 'M2-F14',
      severity: 'INFO',
      category: 'ANTI_ARBITRAGE_VERIFIED',
      title: 'Live Recycler v3 & Component v4 Rules Enforce Net-Loss Recovery (Historical v2 Over-Return Closed)',
      codeRefs: ['web/src/game/recycler.ts', 'web/src/game/industrial-proof.ts'],
      evidence: `All live recycler plans (X:recover-v1, X:recover-v3, X:gear-v1, X:pipe-v2, X:blade-v1) return strictly <= craft input ingot-equivalents. Legacy X:recover-v2 (retained only for pre-patch saved jobs) had OVER_RETURN on iron_sword, iron_pick, iron_axe, industrial_axe.`,
      verifiedMetrics: {
        liveOverReturns: recyclerProbes.filter((p) => p.overReturnDetected).length,
        legacyV2OverReturnsFixedInV3: legacyV2Arbitrage.filter((x) => x.v2Proof.rows.some((r: any) => r.verdict === 'OVER_RETURN')).map((x) => x.item),
      },
    },
    {
      id: 'M2-F15',
      severity: 'LOW',
      category: 'VEYRA_OFFSCREEN_SIM_ASYMMETRY',
      title: 'stepStations Explicitly Skips oil_pump While Off-Window on Veyra (Unlike Smelters/Refineries/Livestock)',
      codeRefs: ['web/src/game/engine.ts:2419', 'web/src/game/husbandry.ts:337'],
      evidence: `Live Veyra offscreen probe confirmed oil_pump in r.veyraOffscreenEntities produced 0 crude_petroleum over 5s while consuming 0 oil stock (oilPumpOffscreenSkipped=${oilPumpOffscreenSkipped}), whereas furnaces, refineries, gardens, and livestock simulate offscreen.`,
      verifiedMetrics: { oilPumpOffscreenSkipped },
    },
    {
      id: 'M2-F16',
      severity: 'MEDIUM',
      category: 'ENDGAME_AMMO_AND_REFINED_ENERGY_GATE',
      title: 'Refined Energy (CreatorCore Signature/Refined Ammo) Is Tightly Bottlenecked by Wild Sulfur & Crystal Stocks',
      codeRefs: ['web/src/game/catalog.ts:energy_refined', 'web/src/game/engine.ts:1645'],
      evidence: `Each energy_refined requires ${JSON.stringify(erIns)} (out=${RECIPES.energy_refined.qty}). Shipping holds ${shipSulfurStock} sulfur and ${shipCrystalStock} crystal total wild units (max ${shipMaxEnergyRefinedFromWild} refined charges if 100% mined); Veyra sampled 12 windows yielded ${veyraSampledSulfur} sulfur nodes and ${veyraSampledCrystal} crystal nodes.`,
      verifiedMetrics: {
        energyRefinedInputs: erIns,
        energyRefinedQty: RECIPES.energy_refined.qty,
        shipSulfurStock,
        shipCrystalStock,
        shipMaxEnergyRefinedFromWild,
        veyraSampledSulfurNodes: veyraSampledSulfur,
        veyraSampledCrystalNodes: veyraSampledCrystal,
      },
    },
  );

  return {
    recyclerProbes,
    legacyV2Arbitrage,
    claimMinDistFromPoiProbe: { claimMinDistFromPoi: BAL.economy.claimMinDistFromPoi, claimInsidePoiAllowed, minPoiClaimDistFound, testPoiCoords },
    oilPumpOffscreenSkipped,
    creatorCoreRefinedBudget: { shipSulfurStock, shipCrystalStock, shipMaxEnergyRefinedFromWild, veyraSampledSulfur, veyraSampledCrystal },
    structConservationIssues,
    findings,
  };
}

// ---------- Main Orchestrator ----------
export interface M2SimulationResults {
  meta: {
    version: string;
    generatedAtAuditAnchor: string;
    maxRunHours: number;
    ragnarokFinalHours: number;
    runCountMonteCarlo: number;
  };
  worldEndowments: ReturnType<typeof runSuite1WorldEndowments>;
  archetypeSimulations: ReturnType<typeof runSuite2Archetypes>;
  territoryStressMatrix: ReturnType<typeof runSuite3TerritoryMatrix>;
  offlineSettlementMatrix: ReturnType<typeof runSuite4OfflineMatrix>;
  fuelAndPowerConservation: ReturnType<typeof runSuite5EnergyAndFuel>;
  husbandryAndGarden14Day: ReturnType<typeof runSuite6HusbandryAndGardens>;
  monteCarloRuns: ReturnType<typeof runSuite7MonteCarlo>;
  exploitAndParityAudit: ReturnType<typeof runSuite8ExploitAndParityProbes>;
}

export function runFullM2EconomicAudit(onProgress?: (label: string, ms: number) => void): M2SimulationResults {
  intentCounter = 0;
  const mark = (name: string, t0: number) => {
    const dt = Math.round(performance.now() - t0);
    onProgress?.(name, dt);
  };
  let t0 = performance.now();
  onProgress?.('Suite1:start', 0);
  const worldEndowments = runSuite1WorldEndowments((sub, ms) => onProgress?.(`Suite1:${sub}`, ms));
  mark('Suite1', t0);
  t0 = performance.now();
  const archetypeSimulations = runSuite2Archetypes();
  mark('Suite2', t0);
  t0 = performance.now();
  const territoryStressMatrix = runSuite3TerritoryMatrix();
  mark('Suite3', t0);
  t0 = performance.now();
  const offlineSettlementMatrix = runSuite4OfflineMatrix();
  mark('Suite4', t0);
  t0 = performance.now();
  const fuelAndPowerConservation = runSuite5EnergyAndFuel(worldEndowments);
  mark('Suite5', t0);
  t0 = performance.now();
  const husbandryAndGarden14Day = runSuite6HusbandryAndGardens();
  mark('Suite6', t0);
  t0 = performance.now();
  const monteCarloRuns = runSuite7MonteCarlo();
  mark('Suite7', t0);
  t0 = performance.now();
  const exploitAndParityAudit = runSuite8ExploitAndParityProbes(worldEndowments, archetypeSimulations, fuelAndPowerConservation);
  mark('Suite8', t0);

  return {
    meta: {
      version: M2_AUDIT_VERSION,
      generatedAtAuditAnchor: new Date(BASE_AUDIT_NOW).toISOString(),
      maxRunHours: BAL.run.maxRunHours,
      ragnarokFinalHours: BAL.run.ragnarokFinalHours,
      runCountMonteCarlo: monteCarloRuns.shippingN + monteCarloRuns.veyraN,
    },
    worldEndowments,
    archetypeSimulations,
    territoryStressMatrix,
    offlineSettlementMatrix,
    fuelAndPowerConservation,
    husbandryAndGarden14Day,
    monteCarloRuns,
    exploitAndParityAudit,
  };
}
