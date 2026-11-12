/**
 * SOH Milestone M5 — Complete Live Item Function Audit & Recipe Route Audit Generator.
 *
 * Pure read-only introspection across live `catalog.ts`, `recycler.ts`,
 * `industrial-proof.ts`, `husbandry.ts`, `journey.ts`, `airdrop.ts`, `creator-loot.ts`,
 * `world.ts`, `loot-ecology.ts`, `balance.v1.json`, all 12 `VEYRA05_SCENES`,
 * and all 82 Veyra POIs across Floor 0 and Floor -1.
 *
 * Emits:
 *  - `SOH_ITEM_FUNCTION_AUDIT.csv` (100% of `ITEMS`, 17 columns incl. `verification_tier`)
 *  - `SOH_RECIPE_ROUTE_AUDIT.csv` (RECIPES, Recycler, Core reload, Devices, Garden,
 *    Husbandry/Butchery, Research, Vendor/Escrow, Offscreen parity, 17 columns incl. `verification_tier`)
 */

import {
  ALWAYS_KNOWN_RECIPES,
  BUILD_ORDER,
  CART_FREIGHT_UPGRADE,
  CORE_STUDY,
  CREATURES,
  ELDERS,
  FURNACE_LINING,
  GARDEN_CROPS,
  GARDEN_FRAME_COST,
  GENERATOR_CAPACITY_UPGRADE,
  INDUSTRIAL_MODULE,
  ITEMS,
  PRIMORDIAL_ELDERS,
  RECIPES,
  SALVAGED_OIL_WRECK_CHANCE,
  SOURCES,
  STRUCTS,
  STRUCTURE_UPGRADES,
  VENDOR_SECURED,
  VENDOR_SPARES,
  WORKBENCH_UPGRADE,
  WORKBENCH_UPGRADE_III,
  permitsDirectedResearch,
} from './catalog';
import { BAL } from './core';
import { creatorLootV1 } from './creator-loot';
import { BUTCHER_YIELDS, HUSBANDRY_YIELDS } from './husbandry';
import { expand, ieValue, integerTree, proveItem } from './industrial-proof';
import { DAILY_MILESTONES, milestoneRewardSpec } from './journey';
import { LOOT_B04_ROLES, LOOT_B05_TOOLBOX_GRADE, LOOT_CLASSES } from './loot-ecology';
import { COMPONENT_RECIPES, componentRuleSnapshot, recoveryPlanFor } from './recycler';
import { getActiveLayout, getWorld, setActiveLayout } from './world';
import { authoredPlan } from '../veyra05/floors';
import {
  ORDINARY_CREATURE_HABITATS,
  VEYRA_PRIMORDIAL_SITES,
  VEYRA_SIDE_BOSS_SITES,
} from '../veyra05/ecosystem';
import { FRAME_H, FRAME_W, WINDOW_H, WINDOW_W, auToTile } from '../veyra05/frame';
import { POIS } from '../veyra05/reader';
import { VEYRA05_SCENES, layoutIdAt } from '../veyra05/scenes';
import { getWindowWorld, type WindowWorld } from '../veyra05/window';

const csvCell = (val: unknown): string => {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',');

const fmtPairs = (pairs: readonly [string, number][]) =>
  pairs.map(([k, q]) => `${k}:${q}`).join(';');

const CREATOR_CORE_KEYS = new Set(
  Object.keys(ITEMS).filter((k) => Boolean(ITEMS[k]?.creatorCore)),
);
const LEGACY_CORE_KEYS = new Set(
  Object.keys(ITEMS).filter((k) => Boolean(ITEMS[k]?.core) && !ITEMS[k]?.creatorCore),
);
const LEGACY_ELDER_STONE_KEYS = new Set(Object.values(ELDERS).map((e) => e.stone));
const PRIMORDIAL_STONE_KEYS = new Set(Object.values(PRIMORDIAL_ELDERS).map((e) => e.stone));
const ELDER_STONE_KEYS = new Set([...LEGACY_ELDER_STONE_KEYS, ...PRIMORDIAL_STONE_KEYS]);
const SIDE_BOSS_UNIQUE_DROPS = new Set(
  Object.values(CREATURES)
    .map((c) => c.uniqueDrop)
    .filter((x): x is string => Boolean(x)),
);

const SHIPPING_CREATURES = new Set(['boar', 'wolf', 'toad', 'crawler', 'beetle', 'crab']);
const VEYRA_SPAWN_CREATURES = new Set([
  'vampire_1', 'vampire_2', 'vampire_3',
  'orc_1', 'orc_2', 'orc_3',
  'slime_1', 'slime_2', 'slime_3',
  'boar', 'deer', 'hare', 'grouse', 'fox',
  ...ORDINARY_CREATURE_HABITATS.map((h) => h.species),
  ...VEYRA_SIDE_BOSS_SITES.map((b) => b.species),
]);

const VEYRA_MISSING_RAW_ITEMS = new Set(['chitin', 'beetle_horn', 'crawler_optic', 'wolf_fang']);

const PRIMORDIAL_BY_STONE: Record<string, { elderKey: string; poiId: string; floor: number }> = (() => {
  const map: Record<string, { elderKey: string; poiId: string; floor: number }> = {};
  for (const site of VEYRA_PRIMORDIAL_SITES) {
    const stone = PRIMORDIAL_ELDERS[site.key]?.stone;
    if (stone) map[stone] = { elderKey: site.key, poiId: site.poiId, floor: site.floor };
  }
  return map;
})();

const LEGACY_ELDER_BY_STONE: Record<string, string> = Object.fromEntries(
  Object.entries(ELDERS).map(([k, v]) => [v.stone, k]),
);

const RUNTIME_TESTED_ITEMS = new Set([
  'knife', 'spares', 'damaged_drive', 'salvaged_oil', 'fuel_can', 'coal', 'charcoal',
  'fuel_briquette', 'rcash', 'escrow_chest', 'iron_plate', 'bear_trap', 'mechanical_gear',
  'metal_pipe', 'metal_blade', 'refined_iron_ingot', 'mechanical_parts', 'blueprint',
  'grouse_egg', 'feather', 'fur', 'meat', 'hide', 'boar_tusk', 'crop', 'herb', 'seed',
  'iron_ingot', 'iron_pick', 'iron_axe', 'iron_sword', 'industrial_pick', 'industrial_axe',
  'reinforced_spear', 'arrow', 'wood', 'stone', 'fiber', 'scrap', 'glass', 'cloth',
  'core_fire', 'core_earth', 'core_storm', 'core_frost',
  'core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_mjolnir', 'core_demon',
  'energy_basic', 'energy_refined', 'essence_fire', 'essence_nature', 'essence_water', 'essence_spirit',
  'stone_surtur', 'stone_typhon', 'stone_aion', 'stone_atlas', 'stone_argus', 'stone_anubis',
  'relic_shaleheart', 'ronin_nodachi', 'tidemarshal_trident', 'custodian_lantern',
  'keycard', 'water_flask', 'medkit', 'cart_kit', 'vehicle_frame', 'leather_armor', 'fur_cloak', 'gas_mask',
]);

const WP3_NATURAL_PROOF_ITEMS = new Set([
  'damaged_drive', 'spares', 'scrap', 'wood', 'stone', 'iron_ingot', 'mechanical_parts', 'vehicle_frame',
]);

function withLayout<T>(layoutId: string, fn: () => T): T {
  const prev = getActiveLayout();
  setActiveLayout(layoutId);
  try {
    return fn();
  } finally {
    setActiveLayout(prev);
  }
}

interface WorldScanStats {
  sourceCounts: Record<string, number>;
  staticLootCounts: Record<string, number>;
  staticBlueprintCounts: Record<string, number>;
  creatorLootCores: Record<string, number>;
  cashSites: number;
  cashTotal: number;
  vendorSites: number;
  recyclerSites: number;
  scenesWithSource: Record<string, Set<string>>;
  poisWithLoot: Record<string, Set<string>>;
  poisWithBlueprint: Record<string, Set<string>>;
  floorMinus1Items: Set<string>;
}

function scanWorlds(): { shipping: WorldScanStats; veyra: WorldScanStats } {
  const emptyStats = (): WorldScanStats => ({
    sourceCounts: {},
    staticLootCounts: {},
    staticBlueprintCounts: {},
    creatorLootCores: {},
    cashSites: 0,
    cashTotal: 0,
    vendorSites: 0,
    recyclerSites: 0,
    scenesWithSource: {},
    poisWithLoot: {},
    poisWithBlueprint: {},
    floorMinus1Items: new Set<string>(),
  });

  const shipping = emptyStats();
  withLayout('shipping_fresh', () => {
    const w = getWorld('shipping_fresh');
    for (const sk of w.sourceV3) {
      if (!sk) continue;
      shipping.sourceCounts[sk] = (shipping.sourceCounts[sk] ?? 0) + 1;
    }
    for (const st of w.statics) {
      const poiTag = st.poi ?? `${st.tx},${st.ty}`;
      if (st.kind === 'cash' && (st.cash ?? 0) > 0) {
        shipping.cashSites++;
        shipping.cashTotal += st.cash ?? 0;
      }
      if (st.kind === 'vendor') shipping.vendorSites++;
      if (st.kind === 'recycler') shipping.recyclerSites++;
      if (st.kind === 'loot' && st.loot) {
        const core = creatorLootV1(st);
        if (core) shipping.creatorLootCores[core] = (shipping.creatorLootCores[core] ?? 0) + 1;
        for (const [k, q] of st.loot) {
          if (k.startsWith('blueprint:')) {
            const rk = k.slice('blueprint:'.length);
            shipping.staticBlueprintCounts[rk] = (shipping.staticBlueprintCounts[rk] ?? 0) + q;
            (shipping.poisWithBlueprint[rk] ??= new Set()).add(poiTag);
          } else {
            shipping.staticLootCounts[k] = (shipping.staticLootCounts[k] ?? 0) + q;
            (shipping.poisWithLoot[k] ??= new Set()).add(poiTag);
          }
        }
      }
    }
  });

  const veyra = emptyStats();
  const builtWindows = new Map<string, WindowWorld>();
  for (const sc of VEYRA05_SCENES) {
    const ww = getWindowWorld(sc.id);
    builtWindows.set(sc.id, ww);
    for (const sk of ww.world.sourceV3) {
      if (!sk) continue;
      veyra.sourceCounts[sk] = (veyra.sourceCounts[sk] ?? 0) + 1;
      (veyra.scenesWithSource[sk] ??= new Set()).add(sc.id);
    }
  }

  // Scan ALL 82 Veyra POIs across Floor 0 and Floor -1 using clustered cover windows, deduplicating global coords.
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
  const seenStaticCoords = new Set<string>();

  for (const poi of sortedPois) {
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
      const wid = layoutIdAt(ox, oy);
      ww = builtWindows.get(wid);
      if (!ww) {
        ww = getWindowWorld(wid);
        builtWindows.set(wid, ww);
      }
    }
    const ox = ww.win.originTx;
    const oy = ww.win.originTy;
    for (const [lv, layer] of ww.floors.layers.entries()) {
      for (const st of layer.statics) {
        const gtx = ox + st.tx;
        const gty = oy + st.ty;
        const coordKey = `${lv}:${gtx},${gty}:${st.kind}`;
        if (seenStaticCoords.has(coordKey)) continue;
        seenStaticCoords.add(coordKey);
        const poiTag = st.poi ?? authoredPlan(poi.id)?.plan.poi ?? poi.id;
        if (st.kind === 'cash' && (st.cash ?? 0) > 0) {
          veyra.cashSites++;
          veyra.cashTotal += st.cash ?? 0;
        } else if (st.kind === 'vendor') {
          veyra.vendorSites++;
        } else if (st.kind === 'recycler') {
          veyra.recyclerSites++;
        } else if (st.kind === 'loot' && st.loot) {
          for (const [k, q] of st.loot) {
            if (k.startsWith('blueprint:')) {
              const rk = k.slice('blueprint:'.length);
              veyra.staticBlueprintCounts[rk] = (veyra.staticBlueprintCounts[rk] ?? 0) + q;
              (veyra.poisWithBlueprint[rk] ??= new Set()).add(poiTag);
              if (lv < 0) veyra.floorMinus1Items.add('blueprint');
            } else {
              veyra.staticLootCounts[k] = (veyra.staticLootCounts[k] ?? 0) + q;
              (veyra.poisWithLoot[k] ??= new Set()).add(poiTag);
              if (lv < 0) veyra.floorMinus1Items.add(k);
            }
          }
        }
      }
    }
  }

  return { shipping, veyra };
}

function lootEcologySourcesForItem(itemId: string): { roles: string[]; tables: string[] } {
  const roles = new Set<string>();
  const tables = new Set<string>();
  for (const [cls, def] of Object.entries(LOOT_CLASSES)) {
    if (def.fixed[0] === itemId || def.options.some(([k]) => k === itemId)) tables.add(`w06:${cls}`);
  }
  for (const [cls, roleDef] of Object.entries(LOOT_B04_ROLES)) {
    if (roleDef.fixed.some(([k]) => k === itemId) || roleDef.pool.some(([k]) => k === itemId)) {
      roles.add(`${roleDef.role}(${cls})`);
    }
  }
  for (const [grade, gDef] of Object.entries(LOOT_B05_TOOLBOX_GRADE)) {
    if (gDef.fixed.some(([k]) => k === itemId) || gDef.pool.some(([k]) => k === itemId)) {
      tables.add(`b05_toolbox:${grade}`);
    }
  }
  return { roles: [...roles], tables: [...tables] };
}

function husbandrySourcesForItem(itemId: string): { yieldSpecies: string[]; butcherSpecies: string[] } {
  const yieldSpecies: string[] = [];
  const butcherSpecies: string[] = [];
  for (const [sp, h] of Object.entries(HUSBANDRY_YIELDS)) {
    if (h.primary[0] === itemId || h.secondary?.[0] === itemId) {
      yieldSpecies.push(`${sp}${h.femaleOnlyPrimary && h.primary[0] === itemId ? '(female_only)' : ''}`);
    }
  }
  for (const [sp, b] of Object.entries(BUTCHER_YIELDS)) {
    if (b.adult.some(([k]) => k === itemId) || b.juvenile.some(([k]) => k === itemId)) {
      butcherSpecies.push(sp);
    }
  }
  return { yieldSpecies, butcherSpecies };
}

function collectDeviceConsumers(itemId: string): string[] {
  const list: string[] = [];
  for (const [sk, st] of Object.entries(STRUCTS)) {
    const q = st.cost.find(([k]) => k === itemId)?.[1];
    if (q) list.push(`build:${sk}x${q}${BUILD_ORDER.includes(sk) ? '' : '(UI_MISSING_FROM_BUILD_ORDER)'}`);
  }
  for (const [from, to] of Object.entries(STRUCTURE_UPGRADES)) {
    const q = STRUCTS[to]?.cost.find(([k]) => k === itemId)?.[1];
    if (q) list.push(`upgrade_struct:${from}->${to}x${q}`);
  }
  for (const [label, cost] of [
    ['WORKBENCH_L2', WORKBENCH_UPGRADE.cost],
    ['WORKBENCH_L3', WORKBENCH_UPGRADE_III.cost],
    ['INDUSTRIAL_MODULE', INDUSTRIAL_MODULE.cost],
    ['FURNACE_LINING', FURNACE_LINING.cost],
    ['GEN_CAP_UPGRADE', GENERATOR_CAPACITY_UPGRADE.cost],
    ['CART_FREIGHT_UPGRADE', CART_FREIGHT_UPGRADE.cost],
    ['GARDEN_FRAME', GARDEN_FRAME_COST],
  ] as const) {
    const q = cost.find(([k]) => k === itemId)?.[1];
    if (q) list.push(`${label}x${q}`);
  }
  if ((BAL.territory.materials as string[]).includes(itemId)) list.push('territory_cabinet_upkeep');
  if (itemId === 'spares') {
    list.push(`research_random:${BAL.research.randomSparesCost}`, `research_directed_T1_T2:${BAL.research.directedSparesCost}`);
  }
  if (itemId === 'iron_plate') list.push('action:bearTrapSet(x1_arm_3hits)', 'action:repairStructure_wall_door(25pct_HP)');
  if (itemId === 'arrow') list.push('device:arrow_turret_ammo', 'weapon:bow_ammo');
  if (itemId === 'keycard') list.push('poi:vault_door_scan');
  if (itemId === 'rcash') list.push('device:escrow_chest(profile_deposit)', `vendor_cash:escrow_chest(${BAL.economy.escrowChestPrice})`);
  if (itemId === 'lubricant') list.push('vehicle:motorbike_wear_halver');
  if (itemId === 'animal_feed' || itemId === 'crop' || itemId === 'berries' || itemId === 'water_flask') {
    list.push('device:feed_trough');
  }
  if (itemId === 'water_flask' || itemId === 'trail_canteen') list.push('device:garden_watering');
  if (itemId === 'fuel_can') list.push('device:base_generator(60s)', 'vehicle:motorbike_fuel');
  if (['wood', 'coal', 'charcoal', 'fiber', 'fuel_briquette'].includes(itemId)) {
    list.push(`station_fuel(${ITEMS[itemId].fuel}s)`);
    list.push(`device:base_generator(${ITEMS[itemId].fuel}s)`);
  }
  if (itemId === 'energy_basic') list.push('creator_core:primary_reload_all_7');
  if (itemId === 'energy_refined') list.push('creator_core:technique_&_signature_reload_all_7');
  if (itemId.startsWith('essence_')) list.push(`creator_core:signature_reload(${itemId.slice('essence_'.length)})`);
  for (const [iid, def] of Object.entries(ITEMS)) {
    const rq = def.repair?.cost.find(([k]) => k === itemId)?.[1];
    if (rq) list.push(`repair_tool:${iid}x${rq}`);
  }
  if ((GARDEN_CROPS.crop.inputs as [string, number][]).some(([k]) => k === itemId)) list.push('garden:Sunroot');
  if ((GARDEN_CROPS.herb.inputs as [string, number][]).some(([k]) => k === itemId)) list.push('garden:Bitterleaf');
  return list;
}

function collectDirectMechanics(itemId: string): string[] {
  const def = ITEMS[itemId];
  const m: string[] = [];
  if (def.food) m.push(`consume_food(${Object.entries(def.food).map(([k, v]) => `${k}:${v}`).join(' ')})`);
  if (def.dmg) m.push(`combat_dmg:${def.dmg}(dur=${def.dur ?? 'inf'})`);
  if (def.power) m.push(`harvest_power(${Object.entries(def.power).map(([k, v]) => `${k}:${v}`).join(' ')})`);
  if (def.slot) {
    m.push(`equip_slot:${def.slot}${def.armor ? ` armor=${def.armor}` : ''}${def.cold ? ` cold=${def.cold}` : ''}${def.mask ? ' rad_mask' : ''}${def.carryBonus ? ` carry+${def.carryBonus}` : ''}`);
  }
  if (def.creatorCore) m.push(`creator_core_gold:${def.creatorCore}(essence=${def.essence},3_skills)`);
  if (def.core && !def.creatorCore) m.push(`legacy_core_charge:${def.core}(charges=${def.charge})`);
  if (def.fuel) m.push(`fuel:${def.fuel}s`);
  if (def.waterContainer) m.push(`water_container(${def.charge}_drinks)`);
  if (def.place) m.push(`deploy_struct:${def.place}`);
  if (def.light) m.push(`light_radius:${def.light}`);
  if (def.ranged) m.push(`ranged_ammo:${def.ranged}`);
  if (def.specimen) m.push(`study_specimen->${def.specimen}`);
  if (def.studyRecipe) m.push(`study_item->${def.studyRecipe}`);
  if (CORE_STUDY[itemId]) m.push(`core_study->${CORE_STUDY[itemId]}`);
  if (def.salvage) m.push(`workbench_salvage->${fmtPairs(def.salvage.yields)}`);
  if (itemId === 'blueprint') m.push('use_consume->unlock_encoded_recipe');
  if (itemId === 'field_repair_kit') m.push('use_field_repair:+100dur');
  if (itemId === 'lead_rope') m.push('tame_livestock:boar/deer/hare/grouse');
  if (ELDER_STONE_KEYS.has(itemId)) m.push('elder_keystone:victory_or_evac_trophy');
  if (itemId === 'rcash') m.push('deposit_escrow->profile.securedCash;buy_escrow_chest(30)');
  return m;
}

function recycleSummary(itemId: string): string {
  const snap = componentRuleSnapshot();
  const compRules = Object.entries(snap).filter(([, v]) => v.key === itemId);
  if (compRules.length) {
    return compRules.map(([rid, v]) => `${rid}(${v.seconds}s)->${fmtPairs(v.outputs)}`).join(' | ');
  }
  if (itemId === 'damaged_drive') return 'X:drive(12s)->spares:2';
  const rules: string[] = [];
  for (const [ver, tbl] of [
    ['X:recover-v3', BAL.recyclerV3.rules],
    ['X:recover-v2', BAL.recyclerV2.rules],
    ['X:recover-v1', BAL.recyclerV1.rules],
  ] as const) {
    const r = (tbl as Record<string, { base: [string, number][]; mid: [string, number][]; high: [string, number][] }>)[itemId];
    if (r) {
      rules.push(`${ver}(base:${fmtPairs(r.base)}|mid:${fmtPairs(r.mid)}|high:${fmtPairs(r.high)})`);
      break;
    }
  }
  const sal = ITEMS[itemId].salvage;
  if (sal) rules.push(`workbench_salvage->${fmtPairs(sal.yields)}`);
  return rules.length ? rules.join(' | ') : 'NONE';
}

function vendorSummary(itemId: string): string {
  const parts: string[] = [];
  const vs = VENDOR_SECURED[itemId];
  if (vs) parts.push(`BUY_SECURED:${vs.price}sc(stock=${vs.stock})`);
  const vp = VENDOR_SPARES[itemId];
  if (vp) parts.push(`BUY_SPARES:${vp.price}sp->qty=${vp.qty}(stock=${vp.stock})`);
  if (itemId === 'escrow_chest') parts.push(`BUY_PHYSICAL_RCASH:${BAL.economy.escrowChestPrice}rcash(stock=4)`);
  if (itemId === 'rcash') parts.push('ESCROW_DEPOSIT:1_rcash->1_securedCash;BUY_ESCROW_CHEST:30');
  if (itemId === 'spares') parts.push('VENDOR_SPARES_CURRENCY');
  return parts.length ? parts.join(' | ') : 'NONE';
}

function recipesProducingOnVeyra(itemId: string): { all: string[]; unblockedVeyra: string[] } {
  const all: string[] = [];
  const unblockedVeyra: string[] = [];
  for (const [rid, r] of Object.entries(RECIPES)) {
    if (r.out !== itemId && !r.outs?.some(([k]) => k === itemId)) continue;
    const outStr = r.outs ? fmtPairs(r.outs) : `${r.out}:${r.qty}`;
    const desc = `${rid}[${r.station ?? 'hand'}${r.stationLevel ? `L${r.stationLevel}` : ''};T${r.tier}${ALWAYS_KNOWN_RECIPES.includes(rid) ? ';base' : ''}](${fmtPairs(r.ins)}->${outStr})`;
    all.push(desc);
    const hasFixtureGate = r.station === 'oil_pump' || rid === 'refinery_crude';
    const hasMissingInput = (r.ins as [string, number][]).some(([ik]) => VEYRA_MISSING_RAW_ITEMS.has(ik));
    if (!hasFixtureGate && !hasMissingInput) unblockedVeyra.push(rid);
  }
  for (const [rid, snap] of Object.entries(componentRuleSnapshot())) {
    if (snap.outputs.some(([k]) => k === itemId)) {
      all.push(`${rid}[recycler](${snap.key}:1->${fmtPairs(snap.outputs)})`);
      unblockedVeyra.push(rid);
    }
  }
  if (itemId === 'spares') {
    all.push('X:drive[recycler](damaged_drive:1->spares:2)');
    unblockedVeyra.push('X:drive');
  }
  return { all, unblockedVeyra };
}

function sourceKeysForItem(itemId: string): string[] {
  const keys: string[] = [];
  for (const [sk, sd] of Object.entries(SOURCES)) {
    if (
      sd.yields.some(([k]) => k === itemId) ||
      sd.bonus?.some(([k]) => k === itemId) ||
      sd.qualityBonus?.tiers.some((t) => t.item === itemId)
    ) {
      keys.push(sk);
    }
  }
  if (itemId === 'salvaged_oil' && !keys.includes('wreck')) keys.push('wreck');
  return keys;
}

export function generateItemFunctionAuditCsv(): { csv: string; rowCount: number } {
  const { shipping, veyra } = scanWorlds();
  const totalVeyraBlueprints = Object.values(veyra.staticBlueprintCounts).reduce((a, b) => a + b, 0);
  const totalShipBlueprints = Object.values(shipping.staticBlueprintCounts).reduce((a, b) => a + b, 0);
  const totalVeyraBpPois = new Set(Object.values(veyra.poisWithBlueprint).flatMap((s) => [...s])).size;

  const header = [
    'item_id',
    'display_name',
    'category',
    'stack_max',
    'spawn_source_types',
    'recipe_inputs',
    'recipe_outputs_consuming_it',
    'device_building_consumers',
    'direct_use_mechanics',
    'recycle_output',
    'vendor_buy_sell_value',
    'shipping_availability',
    'veyra_availability',
    'economic_role_status',
    'recommended_action',
    'code_provenance',
    'verification_tier',
  ];

  const lines: string[] = [csvRow(header)];

  for (const itemId of Object.keys(ITEMS)) {
    const def = ITEMS[itemId];
    let categoryTag = def.cat;
    if (CREATOR_CORE_KEYS.has(itemId)) categoryTag = 'core[CREATOR_CORE_GOLD_SKU]';
    else if (LEGACY_CORE_KEYS.has(itemId)) categoryTag = 'core[LEGACY_CORE_CHARGE]';
    else if (ELDER_STONE_KEYS.has(itemId)) categoryTag = 'stone[ELDER_KEYSTONE]';
    else if (SIDE_BOSS_UNIQUE_DROPS.has(itemId)) categoryTag = `${def.cat}[SIDE_BOSS_UNIQUE_REWARD]`;

    // Sources & Drops
    const spawnParts: string[] = [];
    const srcKeys = sourceKeysForItem(itemId);
    for (const sk of srcKeys) {
      if (sk === 'wreck' && itemId === 'salvaged_oil') {
        spawnParts.push(`source:wreck(p=${SALVAGED_OIL_WRECK_CHANCE})`);
      } else {
        spawnParts.push(`source:${sk}`);
      }
    }
    if (itemId === 'crude_petroleum') spawnParts.push('station:oil_pump(oilTestFixture_only)');
    for (const [ck, cd] of Object.entries(CREATURES)) {
      const dr = cd.drops.find(([k]) => k === itemId);
      if (dr) spawnParts.push(`drop:${ck}(${dr[1]}@${dr[2]})`);
      if (cd.uniqueDrop === itemId) spawnParts.push(`boss_unique:${ck}`);
    }
    if (PRIMORDIAL_BY_STONE[itemId]) {
      const p = PRIMORDIAL_BY_STONE[itemId];
      spawnParts.push(`primordial_elder:${p.elderKey}@${p.poiId}(floor=${p.floor})`);
    }
    if (LEGACY_ELDER_BY_STONE[itemId]) {
      spawnParts.push(`legacy_elder:${LEGACY_ELDER_BY_STONE[itemId]}`);
    }
    for (const [gKey, gDef] of Object.entries(GARDEN_CROPS)) {
      if (gDef.output.some(([k]) => k === itemId)) spawnParts.push(`garden:${gKey}`);
    }
    const husb = husbandrySourcesForItem(itemId);
    if (husb.yieldSpecies.length) spawnParts.push(`husbandry_trough:${husb.yieldSpecies.join(',')}`);
    if (husb.butcherSpecies.length) spawnParts.push(`butcher:${husb.butcherSpecies.join(',')}`);

    const eco = lootEcologySourcesForItem(itemId);
    if (eco.roles.length) spawnParts.push(`loot_role:${eco.roles.join('+')}`);
    if (eco.tables.length) spawnParts.push(`loot_table:${eco.tables.join('+')}`);
    if (
      (BAL.airdropV1.fixed as [string, number][]).some(([k]) => k === itemId) ||
      (BAL.airdropV1.options as [string, number][]).some(([k]) => k === itemId)
    ) {
      spawnParts.push('airdrop:shipping_dev_only');
    }
    for (const m of DAILY_MILESTONES) {
      const spec = milestoneRewardSpec(m.id);
      if (spec?.items.some(([k]) => k === itemId)) spawnParts.push(`journey:${m.id}`);
    }
    if (itemId === 'knife') spawnParts.push('starter_equip(startRun_slot0)');
    if (VENDOR_SECURED[itemId]) spawnParts.push(`vendor_secured(${VENDOR_SECURED[itemId].price}sc;stock=${VENDOR_SECURED[itemId].stock})`);
    if (VENDOR_SPARES[itemId]) spawnParts.push(`vendor_spares(${VENDOR_SPARES[itemId].price}sp->${VENDOR_SPARES[itemId].qty};stock=${VENDOR_SPARES[itemId].stock})`);
    if (itemId === 'escrow_chest') spawnParts.push(`vendor_cash(${BAL.economy.escrowChestPrice}_rcash;stock=4)`);
    if (itemId === 'rcash') {
      spawnParts.push(`openCash_Ragnarok>=264h(shipping=${shipping.cashSites};veyra=${veyra.cashSites}_sites_${veyra.cashTotal}rcash)`);
    }
    if (shipping.staticLootCounts[itemId] || shipping.creatorLootCores[itemId]) spawnParts.push('shipping_static_loot');
    if (veyra.staticLootCounts[itemId]) {
      spawnParts.push(`veyra_static_loot(${veyra.poisWithLoot[itemId]?.size ?? 0}_POIs${veyra.floorMinus1Items.has(itemId) ? '_incl_Floor-1' : ''})`);
    }
    if (itemId === 'blueprint') {
      spawnParts.push(
        `authored_crates_Floor0_&_Floor-1(${totalVeyraBlueprints}_across_${totalVeyraBpPois}POIs)`,
        `research_table(random=${BAL.research.randomSparesCost}sp;directed=${BAL.research.directedSparesCost}sp)`,
      );
    }

    // Producing & consuming recipes
    const prod = recipesProducingOnVeyra(itemId);
    const producing = prod.all;
    const consuming = Object.entries(RECIPES)
      .filter(([, r]) => r.ins.some(([k]) => k === itemId))
      .map(([rid, r]) => `${rid}(in:${r.ins.find(([k]) => k === itemId)![1]}->${r.out}:${r.qty})`);

    const devices = collectDeviceConsumers(itemId);
    const direct = collectDirectMechanics(itemId);
    const recyc = recycleSummary(itemId);
    const vendor = vendorSummary(itemId);

    // Shipping availability (never raw unconditional 'AVAILABLE')
    const shipSources = srcKeys.reduce((acc, sk) => acc + (shipping.sourceCounts[sk] ?? 0), 0);
    const shipCreatureList = Object.entries(CREATURES)
      .filter(([ck, cd]) => SHIPPING_CREATURES.has(ck) && (cd.drops.some(([k]) => k === itemId) || cd.uniqueDrop === itemId))
      .map(([ck]) => ck);
    const shipStaticAvail = (shipping.staticLootCounts[itemId] ?? 0) + (shipping.creatorLootCores[itemId] ?? 0);
    const shipGarden = Object.entries(GARDEN_CROPS).filter(([, g]) => g.output.some(([k]) => k === itemId)).map(([gk]) => gk);
    const shipVendorChannels: string[] = [];
    if (VENDOR_SPARES[itemId] && shipping.vendorSites > 0) shipVendorChannels.push(`vendor_spares:${VENDOR_SPARES[itemId].price}sp`);
    if (VENDOR_SECURED[itemId] && shipping.vendorSites > 0) shipVendorChannels.push(`vendor_secured:${VENDOR_SECURED[itemId].price}sc_escrow`);
    if (itemId === 'escrow_chest' && shipping.vendorSites > 0) shipVendorChannels.push(`vendor_cash:${BAL.economy.escrowChestPrice}rcash`);

    let shipAvail = 'NONE';
    if (itemId === 'knife') {
      shipAvail = 'RUNTIME_GRANTED_AT_SPAWN(startRun_slot0)';
    } else if (itemId === 'crude_petroleum') {
      shipAvail = 'CONDITIONAL_TEST_FIXTURE_GATED(oilTestFixture_only)';
    } else if (itemId === 'rcash') {
      shipAvail = `CONDITIONAL_PHASE_GATED(Ragnarok>=264h_openCash_sites=${shipping.cashSites}_total=${shipping.cashTotal}rcash)`;
    } else if (itemId === 'escrow_chest') {
      shipAvail = `CONDITIONAL_VENDOR_PURCHASE(${BAL.economy.escrowChestPrice}_Ragnarok_rcash@vendor_stock=4)`;
    } else if (itemId === 'blueprint') {
      shipAvail = `PHYSICALLY_REACHABLE(static_blueprints=${totalShipBlueprints})+CONDITIONAL_RESEARCH(spares@research_table)`;
    } else if (LEGACY_ELDER_STONE_KEYS.has(itemId)) {
      shipAvail = `CONDITIONAL_BOSS_DEFEAT(legacy_elder:${LEGACY_ELDER_BY_STONE[itemId]})`;
    } else if (
      PRIMORDIAL_STONE_KEYS.has(itemId) ||
      ['grouse_egg', 'feather', ...SIDE_BOSS_UNIQUE_DROPS].includes(itemId)
    ) {
      shipAvail = 'VEYRA_EXCLUSIVE(0_on_Shipping)';
    } else {
      const ch: string[] = [];
      if (shipSources > 0 || shipStaticAvail > 0 || eco.tables.length > 0 || eco.roles.length > 0) {
        ch.push(`PHYSICALLY_REACHABLE(src=${shipSources},static=${shipStaticAvail},loot_tables=${eco.tables.length + eco.roles.length})`);
      }
      if (shipCreatureList.length > 0) ch.push(`CONDITIONAL_MOB_DROP(${shipCreatureList.join(',')})`);
      if (shipGarden.length > 0) ch.push(`CONDITIONAL_GARDEN(${shipGarden.join(',')})`);
      if (husb.yieldSpecies.some((sp) => SHIPPING_CREATURES.has(sp.split('(')[0])) || husb.butcherSpecies.some((sp) => SHIPPING_CREATURES.has(sp))) {
        ch.push('CONDITIONAL_HUSBANDRY_OR_BUTCHER');
      }
      if (shipVendorChannels.length > 0) ch.push(`CONDITIONAL_VENDOR_PURCHASE(${shipVendorChannels.join(';')})`);
      if (producing.length > 0) ch.push(`CONDITIONAL_CRAFTABLE(recipes=${producing.length})`);
      shipAvail = ch.length ? ch.join('+') : 'NONE';
    }

    // Veyra availability (across 12 scenes + all 82 POIs Floor 0 & Floor -1 + Primordials + Husbandry + Garden + Vendor)
    const veyraSrcCount = srcKeys.reduce((acc, sk) => acc + (veyra.sourceCounts[sk] ?? 0), 0);
    const veyraSrcScenes = new Set<string>();
    for (const sk of srcKeys) for (const sc of veyra.scenesWithSource[sk] ?? []) veyraSrcScenes.add(sc);
    const veyraCreatures = Object.entries(CREATURES)
      .filter(([ck, cd]) => VEYRA_SPAWN_CREATURES.has(ck) && (cd.drops.some(([k]) => k === itemId) || cd.uniqueDrop === itemId))
      .map(([ck]) => ck);
    const veyraStatic = veyra.staticLootCounts[itemId] ?? 0;
    const veyraLootPois = veyra.poisWithLoot[itemId]?.size ?? 0;
    const veyraGarden = shipGarden;
    const veyraHusbYield = Object.entries(HUSBANDRY_YIELDS)
      .filter(([sp, h]) => VEYRA_SPAWN_CREATURES.has(sp) && (h.primary[0] === itemId || h.secondary?.[0] === itemId))
      .map(([sp, h]) => `${sp}${h.femaleOnlyPrimary && h.primary[0] === itemId ? ':female' : ''}`);
    const veyraButcher = Object.entries(BUTCHER_YIELDS)
      .filter(([sp, b]) => VEYRA_SPAWN_CREATURES.has(sp) && (b.adult.some(([k]) => k === itemId) || b.juvenile.some(([k]) => k === itemId)))
      .map(([sp]) => sp);
    const veyraVendorChannels: string[] = [];
    if (VENDOR_SPARES[itemId] && veyra.vendorSites > 0) veyraVendorChannels.push(`vendor_spares:${VENDOR_SPARES[itemId].price}sp@${veyra.vendorSites}POIs`);
    if (VENDOR_SECURED[itemId] && veyra.vendorSites > 0) veyraVendorChannels.push(`vendor_secured:${VENDOR_SECURED[itemId].price}sc_escrow@${veyra.vendorSites}POIs`);
    if (itemId === 'escrow_chest' && veyra.vendorSites > 0) veyraVendorChannels.push(`vendor_cash:${BAL.economy.escrowChestPrice}rcash@${veyra.vendorSites}POIs`);

    let veyraAvail = 'MISSING_VEYRA_SOURCE';
    if (itemId === 'knife') {
      veyraAvail = 'RUNTIME_GRANTED_AT_SPAWN(startRun_slot0)';
    } else if (itemId === 'crude_petroleum') {
      veyraAvail = 'CONDITIONAL_TEST_FIXTURE_GATED(oilTestFixture_only)';
    } else if (LEGACY_ELDER_STONE_KEYS.has(itemId)) {
      veyraAvail = 'LEGACY_SHIPPING_ELDER_ONLY(Veyra_uses_6_Primordial_Stones)';
    } else if (PRIMORDIAL_BY_STONE[itemId]) {
      const p = PRIMORDIAL_BY_STONE[itemId];
      veyraAvail = `CONDITIONAL_BOSS_DEFEAT(primordial:${p.elderKey}@${p.poiId}_floor${p.floor})`;
    } else if (VEYRA_MISSING_RAW_ITEMS.has(itemId)) {
      veyraAvail = `MISSING_VEYRA_SOURCE(0_spawns_of_beetle/crawler/wolf;static=${veyraStatic})`;
    } else if (itemId === 'keycard') {
      veyraAvail = 'NOT_PLACED_ON_VEYRA(0_keycard_caches_and_0_keycard_doors;optional_Shipping_feature)';
    } else if (itemId === 'rcash') {
      veyraAvail = `CONDITIONAL_PHASE_GATED(Ragnarok>=264h_openCash_sites=${veyra.cashSites}_total=${veyra.cashTotal}rcash;0_mob_drops)`;
    } else if (itemId === 'escrow_chest') {
      veyraAvail = `CONDITIONAL_VENDOR_PURCHASE(${BAL.economy.escrowChestPrice}_Ragnarok_rcash@${veyra.vendorSites}vendorPOIs_stock=4)`;
    } else if (itemId === 'blueprint') {
      veyraAvail = `PHYSICALLY_REACHABLE(static_blueprints=${totalVeyraBlueprints}_across_${totalVeyraBpPois}POIs_Floor0_&_Floor-1)+CONDITIONAL_RESEARCH(spares@research_table)`;
    } else if (itemId === 'core_demon') {
      veyraAvail = `BLOCKED_VEYRA(0_static_creatorLoot_and_crawler_optic_missing_for_recipe)`;
    } else if (['core_meteor', 'core_dragon', 'core_elsa', 'core_mjolnir', 'core_blast', 'core_earthmother'].includes(itemId)) {
      veyraAvail = `CONDITIONAL_CRAFTABLE(recipes=${prod.unblockedVeyra.join(',')};0_static_creatorLoot_on_Veyra)`;
    } else if (LEGACY_CORE_KEYS.has(itemId)) {
      veyraAvail = `CONDITIONAL_CRAFTABLE(research_directed_or_core_study;static=${veyraStatic})`;
    } else if (itemId === 'chitin_armor') {
      veyraAvail = `BLOCKED_VEYRA(chitin_missing_0_beetle_spawns_on_Veyra)`;
    } else if (itemId === 'damaged_drive') {
      veyraAvail = `PHYSICALLY_REACHABLE(wrecks=${veyraSrcCount}_across_${veyraSrcScenes.size}scenes;D5_po_slag_recycler=${veyra.recyclerSites}site)`;
    } else {
      const ch: string[] = [];
      if (veyraSrcCount > 0) ch.push(`PHYSICALLY_REACHABLE(src=${veyraSrcCount}_across_${veyraSrcScenes.size}scenes)`);
      if (veyraStatic > 0) {
        ch.push(`PHYSICALLY_REACHABLE(static=${veyraStatic}_across_${veyraLootPois}POIs${veyra.floorMinus1Items.has(itemId) ? '_incl_Floor-1' : ''})`);
      }
      if (veyraCreatures.length > 0) {
        const isSideBoss = veyraCreatures.every((c) => c.startsWith('boss_'));
        ch.push(`${isSideBoss ? 'CONDITIONAL_BOSS_DEFEAT' : 'CONDITIONAL_MOB_DROP'}(${veyraCreatures.join(',')})`);
      }
      if (veyraGarden.length > 0) ch.push(`CONDITIONAL_GARDEN(${veyraGarden.join(',')};wild_seeds_reachable)`);
      if (veyraHusbYield.length > 0) ch.push(`CONDITIONAL_HUSBANDRY(${veyraHusbYield.join(',')})`);
      if (veyraButcher.length > 0) ch.push(`CONDITIONAL_BUTCHER(${veyraButcher.join(',')})`);
      if (veyraVendorChannels.length > 0) ch.push(`CONDITIONAL_VENDOR_PURCHASE(${veyraVendorChannels.join(';')})`);
      if (prod.unblockedVeyra.length > 0) {
        ch.push(`CONDITIONAL_CRAFTABLE(recipes=${prod.unblockedVeyra.join(',')})`);
      }
      if (!ch.length && eco.tables.length > 0) {
        ch.push(`CONDITIONAL_SHIPPING_LOOT_TABLE(${eco.tables.join(',')};0_Veyra_static)`);
      }
      veyraAvail = ch.length ? ch.join('+') : 'MISSING_VEYRA_SOURCE';
    }

    // Role classification — NEVER dismiss equipment, weapons, armor, ammo, cores, food, meds, or boss trophies!
    let roleStatus = 'CORE_FLOW';
    let recAction = 'KEEP_AS_IS';
    if (CREATOR_CORE_KEYS.has(itemId) || LEGACY_CORE_KEYS.has(itemId)) {
      roleStatus = 'CORE_SKILL_EQUIPMENT';
      if (itemId === 'core_demon') recAction = 'REQUIRES_CREATOR_DECISION(Veyra_spirit_specimen_or_loot_placement)';
      else if (['core_meteor', 'core_dragon', 'core_elsa', 'core_mjolnir'].includes(itemId)) recAction = 'REQUIRES_CREATOR_DECISION(Veyra_creatorLoot_placement)';
    } else if (ELDER_STONE_KEYS.has(itemId)) {
      roleStatus = 'ENDGAME_BOSS_STONE';
      if (PRIMORDIAL_BY_STONE[itemId]) recAction = 'VERIFIED_6_VEYRA_PRIMORDIAL_SITES';
    } else if (SIDE_BOSS_UNIQUE_DROPS.has(itemId)) {
      roleStatus = 'ELDER_OR_BOSS_REWARD';
    } else if (itemId === 'rcash') {
      roleStatus = 'META_CURRENCY';
      recAction = 'D1_VERIFIED_ESCROW_ONLY(Ragnarok>=264h_openCash;journey_cash=0)';
    } else if (['food', 'tool', 'weapon', 'armor'].includes(def.cat) || def.cat === 'kit') {
      roleStatus = 'CONSUMABLE_EQUIPMENT';
      if (itemId === 'chitin_armor') recAction = 'BLOCKED_VEYRA_BY_MISSING_CHITIN_A5_CREATOR_DECISION';
      else if (itemId === 'gas_mask') recAction = 'CRAFTABLE_ON_VEYRA(blueprint_or_directed_research;crawler_optic_shortcut_missing)';
      else if (itemId === 'fur_cloak') recAction = 'CRAFTABLE_ON_VEYRA(blueprint_or_directed_research;wolf_fang_shortcut_missing)';
      else if (itemId === 'escrow_chest') recAction = 'CONDITIONAL_VENDOR_PURCHASE(30_Ragnarok_rcash)';
    } else if (VEYRA_MISSING_RAW_ITEMS.has(itemId)) {
      roleStatus = 'BLOCKED_OR_MISSING_VEYRA_SOURCE';
      recAction = 'REQUIRES_CREATOR_DECISION(coherent_Veyra_biome_source_no_cross_species_A5)';
    } else if (itemId === 'damaged_drive') {
      roleStatus = 'CORE_INDUSTRIAL_FLOW';
      recAction = 'D5_VERIFIED_PHYSICAL_VEYRA_RECYCLER_AT_PO_SLAG';
    } else if (
      ['iron_plate', 'mechanical_gear', 'metal_pipe', 'metal_blade', 'refined_iron_ingot', 'mechanical_parts', 'spares'].includes(itemId)
    ) {
      roleStatus = 'CORE_INDUSTRIAL_FLOW';
      if (itemId === 'iron_plate') recAction = 'D2_FIXED_BEAR_TRAP_IN_BUILD_ORDER';
      else if (['metal_pipe', 'metal_blade', 'mechanical_gear'].includes(itemId)) {
        recAction = 'D5_VERIFIED_VEYRA_RECYCLER_AT_PO_SLAG(X:pipe-v2,X:gear-v1,X:blade-v1)';
      }
    } else if (itemId === 'crude_petroleum') {
      roleStatus = 'TEST_FIXTURE_GATED_FLOW';
      recAction = 'REQUIRES_MAP_WELLHEAD_AUTHORITY(M2-F12)';
    } else if (consuming.length === 0 && devices.length === 0 && recyc === 'NONE' && direct.length === 0) {
      roleStatus = 'DEAD_END_OR_LOW_LINK';
      recAction = 'REVIEW_SINK';
    } else {
      roleStatus = 'UTILITY_FLOW';
    }

    // Verification tier (strictly distinguish declared, conditional, physically reachable, runtime tested, never fake visually proven)
    let verificationTier = 'DECLARED_ONLY(catalog)';
    if (itemId === 'crude_petroleum') {
      verificationTier = 'CONDITIONAL_GATED(oilTestFixture_only)';
    } else if (VEYRA_MISSING_RAW_ITEMS.has(itemId) || itemId === 'chitin_armor' || itemId === 'core_demon') {
      verificationTier = 'BLOCKED_VEYRA(Shipping_runtime_tested)';
    } else if (itemId === 'keycard') {
      verificationTier = 'RUNTIME_TESTED(Shipping_vault_only;not_placed_Veyra)';
    } else if (LEGACY_ELDER_STONE_KEYS.has(itemId)) {
      verificationTier = 'DECLARED_ONLY(Shipping_ELDERS;superseded_Veyra)';
    } else if (RUNTIME_TESTED_ITEMS.has(itemId)) {
      if (itemId === 'knife') {
        verificationTier = 'RUNTIME_TESTED(startRun_spawn_slot0;not_yet_browser_verified)';
      } else if (itemId === 'rcash') {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_GATED(Ragnarok>=264h_openCash;not_yet_browser_verified)';
      } else if (itemId === 'escrow_chest') {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_VENDOR_PURCHASE(30_rcash;not_yet_browser_verified)';
      } else if (itemId === 'blueprint') {
        verificationTier = 'RUNTIME_TESTED+PHYSICALLY_REACHABLE(static_Floor0_&_Floor-1+research;not_yet_browser_verified)';
      } else if (PRIMORDIAL_BY_STONE[itemId]) {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_BOSS_DEFEAT(primordial_sanctuary;not_yet_browser_verified)';
      } else if (SIDE_BOSS_UNIQUE_DROPS.has(itemId)) {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_BOSS_DEFEAT(side_boss_site;not_yet_browser_verified)';
      } else if (WP3_NATURAL_PROOF_ITEMS.has(itemId)) {
        verificationTier = 'RUNTIME_TESTED(wp3_veyra_natural_loop;not_yet_browser_verified)';
      } else if (veyraSrcCount > 0 || veyraStatic > 0) {
        verificationTier = 'RUNTIME_TESTED+PHYSICALLY_REACHABLE(not_yet_browser_verified)';
      } else if (veyraHusbYield.length > 0 || veyraButcher.length > 0 || veyraCreatures.length > 0) {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_WORLD_DROP_OR_HUSBANDRY(not_yet_browser_verified)';
      } else {
        verificationTier = 'RUNTIME_TESTED+CONDITIONAL_CRAFT_OR_VENDOR(not_yet_browser_verified)';
      }
    } else if (veyraSrcCount > 0 || veyraStatic > 0 || shipSources > 0 || shipStaticAvail > 0) {
      verificationTier = 'PHYSICALLY_REACHABLE(world_scan_verified)';
    } else if (producing.length > 0 || shipVendorChannels.length > 0) {
      verificationTier = 'CONDITIONAL_GATED(craft_or_vendor_declared)';
    }

    const provenance = `ITEMS.${itemId}(cat=${def.cat})`;
    lines.push(
      csvRow([
        itemId,
        def.name,
        categoryTag,
        def.max,
        spawnParts.join(' | ') || 'NONE',
        producing.join(' | ') || 'NONE',
        consuming.join(' | ') || 'NONE',
        devices.join(' | ') || 'NONE',
        direct.join(' | ') || 'NONE',
        recyc,
        vendor,
        shipAvail,
        veyraAvail,
        roleStatus,
        recAction,
        provenance,
        verificationTier,
      ]),
    );
  }

  return { csv: lines.join('\n') + '\n', rowCount: lines.length - 1 };
}

function classifyFocusGroup(id: string, out: string, ins: [string, number][]): string {
  const keys = new Set([id, out, ...ins.map(([k]) => k)]);
  if ([...keys].some((k) => ['mechanical_gear', 'metal_pipe', 'metal_blade', 'iron_plate'].includes(k))) {
    return 'FOCUS_GEAR_PIPE_BLADE_PLATE';
  }
  if ([...keys].some((k) => ['refined_iron_ingot', 'mechanical_parts', 'spares', 'damaged_drive'].includes(k))) {
    return 'FOCUS_IRON_PARTS_SPARES';
  }
  if ([...keys].some((k) => ['fuel_can', 'fuel_briquette', 'salvaged_oil', 'crude_petroleum', 'coal', 'charcoal', 'lubricant'].includes(k))) {
    return 'FOCUS_FUEL_POWER_OIL';
  }
  if ([...keys].some((k) => k.startsWith('energy_') || k.startsWith('essence_') || k.startsWith('core_'))) {
    return 'FOCUS_CORE_ENERGY';
  }
  return 'GENERAL_ECONOMY';
}

function formatVec(v: Record<string, number> | undefined | null): string {
  if (!v) return 'UNEXPANDABLE';
  return Object.entries(v)
    .map(([k, q]) => `${k}:${Math.round(q * 1000) / 1000}`)
    .join(';');
}

export function generateRecipeRouteAuditCsv(): { csv: string; rowCount: number } {
  const header = [
    'route_id',
    'route_type',
    'focus_group',
    'station_or_device',
    'tier_and_gate',
    'inputs',
    'outputs',
    'raw_material_footprint',
    'craft_or_process_seconds',
    'energy_fuel_cost',
    'recycler_net_conservation_ratio',
    'per_minute_throughput_units',
    'bottleneck_or_blocker',
    'shipping_vs_veyra_route_status',
    'recommended_action',
    'code_provenance',
    'verification_tier',
  ];
  const lines: string[] = [csvRow(header)];

  // 1. All RECIPES
  for (const [rid, r] of Object.entries(RECIPES)) {
    const outs: [string, number][] = r.outs ? (r.outs as [string, number][]) : [[r.out, r.qty]];
    const ins = r.ins as [string, number][];
    const focus = classifyFocusGroup(rid, r.out, ins);
    const gateParts = [
      `T${r.tier}`,
      ALWAYS_KNOWN_RECIPES.includes(rid) ? 'ALWAYS_KNOWN' : 'UNLOCK_REQUIRED',
      permitsDirectedResearch(r) ? 'DIRECTED_OK' : 'NO_DIRECTED_T3',
    ];
    if (r.stationLevel) gateParts.push(`WORKBENCH_L${r.stationLevel}`);

    const rawAgg: Record<string, number> = {};
    let footprintOk = true;
    for (const [ik, iq] of ins) {
      const ex = expand(ik, iq);
      if (!ex) {
        footprintOk = false;
        break;
      }
      for (const [ak, aq] of Object.entries(ex.vec)) rawAgg[ak] = (rawAgg[ak] ?? 0) + aq;
    }
    const fuelCost =
      r.station === 'furnace' || r.station === 'campfire' || r.station === 'refinery' || r.station === 'oil_pump'
        ? `${r.secs}s_station_fuel`
        : r.station === 'workbench'
          ? '0s_direct_fuel(optional_industrial_power)'
          : '0s_hand';
    const throughput = r.secs > 0 ? Math.round(((r.qty * 60) / r.secs) * 100) / 100 : 0;

    let conserv = 'N/A(craft_only)';
    const dummy = { uid: 'aud', key: r.out, qty: 1, ...(ITEMS[r.out]?.dur ? { dur: ITEMS[r.out].dur } : {}) };
    const snap = componentRuleSnapshot();
    const matchedComp = Object.keys(snap).find((ck) => snap[ck].key === r.out);
    const probeVer = matchedComp ?? (
      Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, r.out)
        ? 'X:recover-v3'
        : Object.prototype.hasOwnProperty.call(BAL.recyclerV2.rules, r.out)
          ? 'X:recover-v2'
          : Object.prototype.hasOwnProperty.call(BAL.recyclerV1.rules, r.out)
            ? 'X:recover-v1'
            : null
    );
    if (probeVer) {
      const pr = proveItem(r.out, probeVer);
      const craftEx = expand(r.out, 1);
      const over = pr.rows.some((rw: any) => rw.verdict === 'OVER_RETURN');
      if (craftEx && ieValue(craftEx.vec) > 0) {
        const plan = recoveryPlanFor(dummy as any, probeVer);
        if (plan) {
          const outVec: Record<string, number> = {};
          let outOk = true;
          for (const [ok, oq] of plan.outputs) {
            const e = expand(ok, oq);
            if (!e) { outOk = false; break; }
            for (const [ak, aq] of Object.entries(e.vec)) outVec[ak] = (outVec[ak] ?? 0) + aq;
          }
          if (outOk) {
            const ratio = Math.round((ieValue(outVec) / ieValue(craftEx.vec)) * 1000) / 1000;
            conserv = `${ratio} (${over ? 'OVER_RETURN' : 'NET_LOSS_OK'} via ${probeVer})`;
          }
        }
      } else {
        conserv = over ? `OVER_RETURN(${probeVer})` : `NET_LOSS_OK(${probeVer})`;
      }
    }

    let blocker = 'NONE';
    let shipVeyra = 'BOTH_LIVE';
    let recAction = 'KEEP_AS_IS';
    let verTier = 'RUNTIME_TESTED(catalog+m5)';
    if (r.station === 'oil_pump' || rid === 'refinery_crude') {
      blocker = 'REQUIRES_OIL_TEST_FIXTURE_WELLHEAD';
      shipVeyra = 'CONDITIONAL_TEST_FIXTURE_ONLY';
      recAction = 'KEEP_GATED_PENDING_MAP_AUTHORITY';
      verTier = 'CONDITIONAL_GATED(oilTestFixture)';
    } else if (ins.some(([k]) => VEYRA_MISSING_RAW_ITEMS.has(k))) {
      blocker = `MISSING_VEYRA_SOURCE:${ins.filter(([k]) => VEYRA_MISSING_RAW_ITEMS.has(k)).map(([k]) => k).join(',')}`;
      shipVeyra = 'SHIPPING_LIVE / VEYRA_BLOCKED_INPUT';
      recAction = 'REQUIRES_CREATOR_DECISION(A5_NO_CROSS_SPECIES)';
      verTier = 'BLOCKED_VEYRA(Shipping_runtime_tested)';
    } else if (rid === 'fuel_can') {
      blocker = 'CHEM_ROUTE_COST(charcoal+sulfur+glass_vs_salvaged_oil_refinery)';
      verTier = 'RUNTIME_TESTED(m2+d4)';
    } else if (rid === 'recover_drive') {
      blocker = 'WORKBENCH_FALLBACK_COMPETES_WITH_RECYCLER_X:drive';
      shipVeyra = 'BOTH_LIVE(workbench_fallback+D5_po_slag_recycler)';
      recAction = 'KEEP_WORKBENCH_FALLBACK_WITH_D5_PHYSICAL_RECYCLER';
      verTier = 'RUNTIME_TESTED(d5+m1)';
    } else if (['scrap_ingot', 'mechanical_parts', 'vehicle_frame'].includes(rid)) {
      verTier = 'RUNTIME_TESTED(catalog+m5+wp3_veyra_natural_loop)';
    }

    lines.push(
      csvRow([
        rid,
        'CRAFT',
        focus,
        `${r.station ?? 'hand'}${r.stationLevel ? `:L${r.stationLevel}` : ''}`,
        gateParts.join(';'),
        fmtPairs(ins),
        fmtPairs(outs),
        footprintOk ? `${formatVec(rawAgg)} (IE=${Math.round(ieValue(rawAgg) * 1000) / 1000})` : 'UNEXPANDABLE',
        r.secs,
        fuelCost,
        conserv,
        throughput,
        blocker,
        shipVeyra,
        recAction,
        `RECIPES.${rid}`,
        verTier,
      ]),
    );
  }

  // 2. All Recycler Routes (COMPONENT_RECIPES + X:drive + v1/v2/v3 rules)
  for (const [cid, spec] of Object.entries(componentRuleSnapshot())) {
    const craftEx = expand(spec.key, 1);
    const outVec: Record<string, number> = {};
    for (const [ok, oq] of spec.outputs) {
      const e = expand(ok, oq);
      if (e) for (const [ak, aq] of Object.entries(e.vec)) outVec[ak] = (outVec[ak] ?? 0) + aq;
    }
    const pr = proveItem(spec.key, cid);
    const over = pr.rows.some((rw: any) => rw.verdict === 'OVER_RETURN');
    const ratio = craftEx && ieValue(craftEx.vec) > 0 ? Math.round((ieValue(outVec) / ieValue(craftEx.vec)) * 1000) / 1000 : 0;
    const isHistorical = cid === 'X:pipe-v1';
    lines.push(
      csvRow([
        cid,
        'RECYCLE_COMPONENT',
        'FOCUS_GEAR_PIPE_BLADE_PLATE',
        'poi_recycler(Foundry / po_slag)',
        isHistorical ? 'HISTORICAL_SAVED_JOBS_ONLY' : 'LIVE_ACTIVE_PLAN',
        `${spec.key}:1`,
        fmtPairs(spec.outputs),
        `${formatVec(outVec)} (IE_out=${Math.round(ieValue(outVec) * 1000) / 1000} vs IE_craft=${craftEx ? Math.round(ieValue(craftEx.vec) * 1000) / 1000 : 'N/A'})`,
        spec.seconds,
        '0s_fuel(POI_recycler_batch)',
        `${ratio} (${over ? 'OVER_RETURN' : 'NET_LOSS_VERIFIED'})`,
        Math.round((60 / spec.seconds) * 100) / 100,
        isHistorical ? 'LEGACY_COMPAT_ONLY' : 'NONE',
        isHistorical ? 'BOTH_COMPAT_ONLY' : 'BOTH_LIVE(Shipping_Foundry&Veyra_po_slag_D5)',
        isHistorical ? 'KEEP_PINNED_IMMUTABLE' : 'D5_VERIFIED_PHYSICAL_RECYCLER_AT_PO_SLAG',
        `recycler.ts:${cid}`,
        isHistorical ? 'RUNTIME_TESTED(save_compat)' : 'RUNTIME_TESTED(recycler+d5+industrial-proof)',
      ]),
    );
  }

  lines.push(
    csvRow([
      'X:drive',
      'RECYCLE_DRIVE',
      'FOCUS_IRON_PARTS_SPARES',
      'poi_recycler(Foundry / po_slag)',
      'LIVE_ACTIVE_PLAN',
      'damaged_drive:1',
      'spares:2',
      'salvage_only_finite_wreck_drop',
      12,
      '0s_fuel(POI_recycler_batch)',
      'NON_REPEATABLE_SALVAGE_OK',
      5,
      'NONE',
      'BOTH_LIVE(Shipping_Foundry&Veyra_po_slag_D5)',
      'D5_VERIFIED_PHYSICAL_RECYCLER_AT_PO_SLAG',
      'recycler.ts:X:drive',
      'RUNTIME_TESTED(d5+recycler+wp3_veyra_natural_loop)',
    ]),
  );

  for (const [ver, tbl, secs] of [
    ['X:recover-v3', BAL.recyclerV3.rules, BAL.recyclerV3.seconds],
    ['X:recover-v2', BAL.recyclerV2.rules, BAL.recyclerV2.seconds],
    ['X:recover-v1', BAL.recyclerV1.rules, BAL.recyclerV1.seconds],
  ] as const) {
    for (const [itemKey, rule] of Object.entries(tbl as Record<string, { base: [string, number][]; mid: [string, number][]; high: [string, number][] }>)) {
      const pr = proveItem(itemKey, ver);
      const over = pr.rows.some((rw: any) => rw.verdict === 'OVER_RETURN');
      const craftEx = integerTree(itemKey, 1);
      const isSuperseded =
        (ver === 'X:recover-v1' && (Object.prototype.hasOwnProperty.call(BAL.recyclerV2.rules, itemKey) || Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, itemKey))) ||
        (ver === 'X:recover-v2' && Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, itemKey));
      lines.push(
        csvRow([
          `${ver}:${itemKey}`,
          'RECYCLE_TOOL_WEAPON',
          'FOCUS_IRON_PARTS_SPARES',
          'poi_recycler(Foundry / po_slag)',
          isSuperseded ? 'HISTORICAL_INFLIGHT_ONLY' : 'LIVE_ACTIVE_PLAN',
          `${itemKey}:1(durability_tiered)`,
          `base:${fmtPairs(rule.base)}|mid:${fmtPairs(rule.mid)}|high:${fmtPairs(rule.high)}`,
          craftEx ? `${formatVec(craftEx.vec)} (IE_craft=${Math.round(ieValue(craftEx.vec) * 1000) / 1000})` : 'UNEXPANDABLE',
          secs,
          '0s_fuel(POI_recycler_batch)',
          over ? 'OVER_RETURN(HISTORICAL_V2_SUPERSEDED)' : 'NET_LOSS_VERIFIED_ALL_TIERS',
          Math.round((60 / secs) * 100) / 100,
          isSuperseded ? 'SUPERSEDED_BY_V3' : 'NONE',
          isSuperseded ? 'COMPAT_ONLY' : 'BOTH_LIVE(Shipping_Foundry&Veyra_po_slag_D5)',
          isSuperseded ? 'KEEP_PINNED_IMMUTABLE' : 'D5_VERIFIED_PHYSICAL_RECYCLER_AT_PO_SLAG',
          `balance.v1.json:${ver}.${itemKey}`,
          isSuperseded ? 'RUNTIME_TESTED(save_compat)' : 'RUNTIME_TESTED(industrial-proof+recycler+d5)',
        ]),
      );
    }
  }

  // 3. Core Energy Load Routes (7 Creator Core Gold SKUs)
  for (const cid of CREATOR_CORE_KEYS) {
    const def = ITEMS[cid];
    const ess = `essence_${def.essence}`;
    for (const [tierLabel, ins, outDesc] of [
      ['PRIMARY_10x', 'energy_basic:1', '10_primary_reserves'],
      ['TECHNIQUE_3x', 'energy_refined:1', '3_technique_reserves'],
      ['SIGNATURE_1x', `energy_refined:1;${ess}:1`, '1_signature_reserve'],
    ] as const) {
      lines.push(
        csvRow([
          `core_reload:${cid}:${tierLabel}`,
          'CORE_RELOAD',
          'FOCUS_CORE_ENERGY',
          `item:${cid}(creatorCore=${def.creatorCore})`,
          'ACTION_RELOAD(CREATOR_CORE_GOLD_SKU)',
          ins,
          outDesc,
          ins,
          0,
          'core_reserve_ammo',
          'N/A(combat_ammo_sink)',
          0,
          def.essence === 'spirit' && tierLabel === 'SIGNATURE_1x'
            ? 'VEYRA_ESSENCE_SPIRIT_RECIPE_BLOCKED(direct_drops_from_vampire_3_&_custodian_live)'
            : 'NONE',
          ['core_blast', 'core_earthmother'].includes(cid)
            ? 'BOTH_LIVE'
            : cid === 'core_demon'
              ? 'SHIPPING_LOOT_AND_CRAFT / VEYRA_CRAFT_BLOCKED_INPUT'
              : 'SHIPPING_LOOT_AND_CRAFT / VEYRA_CRAFT_ONLY',
          'KEEP_7_CREATOR_CORES_DISJOINT_FROM_4_LEGACY_A4',
          `catalog.ts:ITEMS.${cid}`,
          'RUNTIME_TESTED(creator-loot+core_energy)',
        ]),
      );
    }
  }

  // 4. Device / Action Sinks & Workstation Upgrades & Offscreen Parity
  const deviceRoutes: [string, string, string, string, string, string, string, string, number, string, string, string, string][] = [
    ['device:bearTrapSet', 'DEVICE_ARM', 'FOCUS_GEAR_PIPE_BLADE_PLATE', 'bear_trap', 'LIVE_ON_CRAFT_AND_BUILD_ORDER_D2_FIXED', 'iron_plate:1', 'armed_trap:3_triggers', 'iron_plate:1', 0, '0s_mechanical', 'D2_VERIFIED_BEAR_TRAP_IN_BUILD_ORDER', 'engine.ts:bearTrapSet', 'RUNTIME_TESTED(d2-corrective)'],
    ['device:repairStructure_plate', 'DEVICE_PATCH', 'FOCUS_GEAR_PIPE_BLADE_PLATE', 'wall_or_door_damaged', 'SHIFT_CLICK_REPAIR_ACTION', 'iron_plate:1', 'hp_restore:25pct_maxHp', 'iron_plate:1', 0, '0s_action', 'NONE', 'engine.ts:1762', 'RUNTIME_TESTED(repair_reclaim)'],
    ['device:base_generator_fuel', 'POWER_GEN', 'FOCUS_FUEL_POWER_OIL', 'base_generator', 'PAID_WIRE_V1', 'fuel_can:1|coal:1|charcoal:1|fuel_briquette:1|wood:1', 'power_energy_ms(60s/80s/55s/90s/20s)', 'fuel_can_or_coal_or_wood', 60, '1x_base_plus_loads(w07_s06_contract)', 'D4_VERIFIED_OFFSCREEN_POWER_PARITY', 'engine.ts:stepBasePower', 'RUNTIME_TESTED(d4+w07+s06+wp2_global_obstacles)'],
    ['device:arrow_turret', 'DEVICE_DEFENSE', 'GENERAL_ECONOMY', 'arrow_turret', 'WIRED_BASE_GENERATOR', 'arrow:1;generator_power', 'hostile_shot_dmg', 'wood+stone+fiber_or_feather', 1, '1_generator_load', 'NONE', 'sim.ts:turretFire', 'RUNTIME_TESTED(defense+s06)'],
    ['device:escrow_deposit', 'META_ESCROW', 'GENERAL_ECONOMY', 'escrow_chest(claim_only)', 'LOCKED_CANON_CASH_ONLY', 'rcash:1', 'profile.securedCash:1', 'finite_world_cash', 0, '0s', 'D1_VERIFIED_ESCROW_ONLY_SECURED_CASH', 'engine.ts:escrowDeposit', 'RUNTIME_TESTED(d1-corrective)'],
    ['industrial:offscreen_catchup', 'OFFSCREEN_SIM', 'FOCUS_IRON_PARTS_SPARES', 'workbench_L2_industrial/furnace/refinery/recycler/pen/garden', 'CAP_12H_WALL_CLOCK_D4', 'queued_inputs_&_generator_fuel', 'completed_outputs_&_decay_12h', 'queued_station_inputs', 0, 'offscreen_step_parity', 'D4_VERIFIED_12H_CAP_AND_RECYCLER_CATCHUP', 'engine.ts:stepOffscreen', 'RUNTIME_TESTED(d4+home-production)'],
    ['upgrade:workbench_L2', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L1->L2', fmtPairs(WORKBENCH_UPGRADE.cost), 'workbench_level:2', fmtPairs(WORKBENCH_UPGRADE.cost), 0, '0s', 'NONE', 'catalog.ts:WORKBENCH_UPGRADE', 'RUNTIME_TESTED(progression+wp3_veyra_natural_loop)'],
    ['upgrade:workbench_L3', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L2->L3', fmtPairs(WORKBENCH_UPGRADE_III.cost), 'workbench_level:3', fmtPairs(WORKBENCH_UPGRADE_III.cost), 0, '0s', 'NONE', 'catalog.ts:WORKBENCH_UPGRADE_III', 'RUNTIME_TESTED(progression)'],
    ['upgrade:industrial_module', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L2_ELECTRIC_QUEUE', fmtPairs(INDUSTRIAL_MODULE.cost), 'automated_powered_bench', fmtPairs(INDUSTRIAL_MODULE.cost), 0, '1_generator_load', 'NONE', 'catalog.ts:INDUSTRIAL_MODULE', 'RUNTIME_TESTED(b05-industrial)'],
    ['upgrade:generator_cap2', 'WORKSTATION_UPGRADE', 'FOCUS_FUEL_POWER_OIL', 'base_generator', 'L2_BENCH_NEARBY', fmtPairs(GENERATOR_CAPACITY_UPGRADE.cost), 'generator_capacity:2', fmtPairs(GENERATOR_CAPACITY_UPGRADE.cost), 0, '2_loads_fuel', 'NONE', 'catalog.ts:GENERATOR_CAPACITY_UPGRADE', 'RUNTIME_TESTED(k6-power)'],
    ['upgrade:furnace_lining', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'furnace', 'L2_BENCH_NEARBY', fmtPairs(FURNACE_LINING.cost), 'furnace_lined_speed_bonus', fmtPairs(FURNACE_LINING.cost), 0, '0s', 'NONE', 'catalog.ts:FURNACE_LINING', 'RUNTIME_TESTED(progression)'],
  ];
  for (const [id, rtype, focus, dev, gate, ins, outs, raw, secs, fuel, action, prov, verTier] of deviceRoutes) {
    lines.push(
      csvRow([
        id,
        rtype,
        focus,
        dev,
        gate,
        ins,
        outs,
        raw,
        secs,
        fuel,
        'N/A(device_sink)',
        secs > 0 ? Math.round((60 / secs) * 100) / 100 : 0,
        'NONE',
        'BOTH_LIVE',
        action,
        prov,
        verTier,
      ]),
    );
  }

  // 5. Garden Crop Routes
  for (const [gk, gd] of Object.entries(GARDEN_CROPS)) {
    lines.push(
      csvRow([
        `garden:${gk}`,
        'GARDEN_CROP',
        'GENERAL_ECONOMY',
        'garden(watered)',
        'OPEN_CROP_GROWTH',
        fmtPairs(gd.inputs),
        fmtPairs(gd.output),
        fmtPairs(gd.inputs),
        gd.seconds,
        'water(rain_or_flask)',
        'NET_PRODUCE_RENEWABLE',
        Math.round((60 / gd.seconds) * 100) / 100,
        'NONE',
        'BOTH_LIVE',
        'KEEP_AS_IS',
        `catalog.ts:GARDEN_CROPS.${gk}`,
        'RUNTIME_TESTED(garden+home-ecology)',
      ]),
    );
  }

  // 6. Husbandry & Butchery Routes
  for (const [sp, h] of Object.entries(HUSBANDRY_YIELDS)) {
    const outList: [string, number][] = [h.primary, ...(h.secondary ? [h.secondary] : [])];
    lines.push(
      csvRow([
        `husbandry:${sp}`,
        'HUSBANDRY_PEN_YIELD',
        'GENERAL_ECONOMY',
        'pen+feed_trough',
        h.femaleOnlyPrimary ? 'FEMALE_FOR_EGG;BOTH_SEXES_SECONDARY' : 'HYDRATED_FED_ADULT',
        'feed_nutrition+water',
        fmtPairs(outList),
        'renewable_crop_or_forage',
        Math.round(h.cycleHours * 3600),
        'trough_feed_&_water',
        'RENEWABLE_LIVESTOCK_YIELD',
        Math.round((60 / (h.cycleHours * 3600)) * 1000) / 1000,
        'NONE',
        sp === 'grouse' || sp === 'deer' || sp === 'hare' ? 'VEYRA_HABITATS_LIVE' : 'BOTH_LIVE',
        'KEEP_AS_IS',
        `husbandry.ts:HUSBANDRY_YIELDS.${sp}`,
        'RUNTIME_TESTED(audit-closure+review-r2)',
      ]),
    );
  }
  for (const [sp, b] of Object.entries(BUTCHER_YIELDS)) {
    lines.push(
      csvRow([
        `butcher:${sp}`,
        'BUTCHERY_HARVEST',
        'GENERAL_ECONOMY',
        'penned_livestock(blade)',
        'BRED_OR_TAMED_ADULT',
        `${sp}:1`,
        fmtPairs(b.adult),
        `tame_&_breed_${sp}`,
        0,
        'blade_durability',
        'TERMINAL_CARCASS_HARVEST',
        0,
        'NONE',
        sp === 'boar' ? 'BOTH_LIVE' : 'VEYRA_HABITATS_LIVE',
        'KEEP_AS_IS',
        `husbandry.ts:BUTCHER_YIELDS.${sp}`,
        'RUNTIME_TESTED(audit-closure+husbandry)',
      ]),
    );
  }

  // 7. Research Table, Study & Vendor / Escrow Conversion Routes
  lines.push(
    csvRow([
      'research:random_spares',
      'RESEARCH_UNLOCK',
      'FOCUS_IRON_PARTS_SPARES',
      'research(table)',
      'UNKNOWN_RECIPES_POOL',
      `spares:${BAL.research.randomSparesCost}`,
      'blueprint:1(unknown_recipe)',
      `spares:${BAL.research.randomSparesCost}`,
      BAL.research.randomSeconds,
      '0s_fuel',
      'N/A(knowledge_unlock)',
      Math.round((60 / BAL.research.randomSeconds) * 100) / 100,
      'NONE',
      'BOTH_LIVE',
      'KEEP_AS_IS',
      'engine.ts:research.random',
      'RUNTIME_TESTED(research+engine)',
    ]),
    csvRow([
      'research:directed_spares',
      'RESEARCH_UNLOCK',
      'FOCUS_IRON_PARTS_SPARES',
      'research(table)',
      'T0_T1_T2_ONLY(NO_T3)',
      `spares:${BAL.research.directedSparesCost}`,
      'blueprint:1(chosen_recipe)',
      `spares:${BAL.research.directedSparesCost}`,
      BAL.research.directedSeconds,
      '0s_fuel',
      'N/A(knowledge_unlock)',
      Math.round((60 / BAL.research.directedSeconds) * 100) / 100,
      'NONE',
      'BOTH_LIVE',
      'KEEP_AS_IS',
      'engine.ts:research.directed',
      'RUNTIME_TESTED(research+d1-d5)',
    ]),
    csvRow([
      'vendor_escrow:escrow_chest',
      'VENDOR_CASH_PURCHASE',
      'GENERAL_ECONOMY',
      'vendor(Shipping&2_Veyra_POIs)',
      `FINITE_STOCK:4;CONDITIONAL_RAGNAROK_RCASH`,
      `rcash:${BAL.economy.escrowChestPrice}`,
      'escrow_chest:1',
      `finite_Ragnarok_openCash:${BAL.economy.escrowChestPrice}`,
      0,
      '0s',
      'N/A(meta_escrow_unlock)',
      0,
      'NONE',
      'BOTH_LIVE(conditional:Ragnarok>=264h_rcash)',
      'KEEP_AS_IS',
      'engine.ts:vendor.buy.escrow_chest',
      'RUNTIME_TESTED(d1-corrective+m2)',
    ]),
  );

  for (const [itemKey, unlockedRecipe] of Object.entries(CORE_STUDY)) {
    lines.push(
      csvRow([
        `study_core:${itemKey}`,
        'SPECIMEN_OR_CORE_STUDY',
        'FOCUS_CORE_ENERGY',
        'research(table)',
        'CONSUME_CORE_FOR_RECIPE',
        `${itemKey}:1`,
        `unlock_recipe:${unlockedRecipe}`,
        `${itemKey}:1`,
        0,
        '0s',
        'N/A(knowledge_unlock)',
        0,
        'NONE',
        'BOTH_LIVE',
        'KEEP_AS_IS',
        `catalog.ts:CORE_STUDY.${itemKey}`,
        'RUNTIME_TESTED(research+core)',
      ]),
    );
  }
  for (const [vk, vp] of Object.entries(VENDOR_SPARES)) {
    lines.push(
      csvRow([
        `vendor_spares:${vk}`,
        'VENDOR_SPARES',
        ['salvaged_oil', 'coal'].includes(vk) ? 'FOCUS_FUEL_POWER_OIL' : 'FOCUS_IRON_PARTS_SPARES',
        'vendor(spares)',
        `FINITE_STOCK:${vp.stock}`,
        `spares:${vp.price}`,
        `${vk}:${vp.qty}`,
        `spares:${vp.price}`,
        0,
        '0s',
        'N/A(one_way_vendor)',
        0,
        'NONE',
        'BOTH_LIVE',
        'KEEP_AS_IS',
        `catalog.ts:VENDOR_SPARES.${vk}`,
        'RUNTIME_TESTED(m2+lr02)',
      ]),
    );
  }
  for (const [vk, vs] of Object.entries(VENDOR_SECURED)) {
    lines.push(
      csvRow([
        `vendor_secured:${vk}`,
        'VENDOR_SECURED',
        'GENERAL_ECONOMY',
        'vendor(securedCash)',
        `FINITE_STOCK:${vs.stock}`,
        `securedCash:${vs.price}`,
        `${vk}:1`,
        `securedCash:${vs.price}`,
        0,
        '0s',
        'N/A(one_way_meta_vendor)',
        0,
        'NONE(D1_ESCROW_ONLY_SECURED_CASH)',
        'BOTH_LIVE(conditional:escrow_Ragnarok_rcash)',
        'D1_VERIFIED_ESCROW_ONLY_SECURED_CASH',
        `catalog.ts:VENDOR_SECURED.${vk}`,
        'RUNTIME_TESTED(d1-corrective+m2)',
      ]),
    );
  }

  return { csv: lines.join('\n') + '\n', rowCount: lines.length - 1 };
}

export function auditSummaryStats() {
  return {
    totalCatalogItems: Object.keys(ITEMS).length,
    creatorCoreCount: CREATOR_CORE_KEYS.size,
    legacyCoreCount: LEGACY_CORE_KEYS.size,
    totalRecipes: Object.keys(RECIPES).length,
    componentRecipes: COMPONENT_RECIPES.length,
  };
}
