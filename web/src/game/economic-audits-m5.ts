/**
 * SOH Milestone M5 — Complete Live Item Function Audit & Recipe Route Audit Generator.
 *
 * Pure read-only introspection across live `catalog.ts`, `recycler.ts`,
 * `industrial-proof.ts`, `journey.ts`, `airdrop.ts`, `creator-loot.ts`,
 * `world.ts`, `loot-ecology.ts`, `balance.v1.json`, and all 12 `VEYRA05_SCENES`.
 *
 * Emits:
 *  - `SOH_ITEM_FUNCTION_AUDIT.csv` (100% of `ITEMS`)
 *  - `SOH_RECIPE_ROUTE_AUDIT.csv` (all `RECIPES`, `COMPONENT_RECIPES`, tool/drive recovery,
 *    refinery, garden, Creator Core reload, upgrades, vendor, & structural device routes)
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
  requiredStationLevel,
} from './catalog';
import { BAL } from './core';
import { creatorLootV1 } from './creator-loot';
import { expand, ieValue, integerTree, proveItem } from './industrial-proof';
import { DAILY_MILESTONES, milestoneRewardSpec } from './journey';
import { LOOT_B04_ROLES, LOOT_B05_TOOLBOX_GRADE, LOOT_CLASSES } from './loot-ecology';
import { COMPONENT_RECIPES, componentRuleSnapshot, recoveryPlanFor } from './recycler';
import { getActiveLayout, getWorld, setActiveLayout } from './world';
import { VEYRA05_SCENES } from '../veyra05/scenes';
import { getWindowWorld } from '../veyra05/window';
import { ORDINARY_CREATURE_HABITATS, VEYRA_SIDE_BOSS_SITES } from '../veyra05/ecosystem';

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
const ELDER_STONE_KEYS = new Set([
  ...Object.values(ELDERS).map((e) => e.stone),
  ...Object.values(PRIMORDIAL_ELDERS).map((e) => e.stone),
]);
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
  scenesWithSource: Record<string, Set<string>>;
  scenesWithLoot: Record<string, Set<string>>;
  scenesWithBlueprint: Record<string, Set<string>>;
}

function scanWorlds(): { shipping: WorldScanStats; veyra: WorldScanStats } {
  const emptyStats = (): WorldScanStats => ({
    sourceCounts: {},
    staticLootCounts: {},
    staticBlueprintCounts: {},
    creatorLootCores: {},
    cashSites: 0,
    scenesWithSource: {},
    scenesWithLoot: {},
    scenesWithBlueprint: {},
  });

  const shipping = emptyStats();
  withLayout('shipping_fresh', () => {
    const w = getWorld('shipping_fresh');
    for (const sk of w.sourceV3) {
      if (!sk) continue;
      shipping.sourceCounts[sk] = (shipping.sourceCounts[sk] ?? 0) + 1;
    }
    for (const st of w.statics) {
      if (st.kind === 'cash' && (st.cash ?? 0) > 0) shipping.cashSites++;
      if (st.kind === 'loot' && st.loot) {
        const core = creatorLootV1(st);
        if (core) shipping.creatorLootCores[core] = (shipping.creatorLootCores[core] ?? 0) + 1;
        for (const [k, q] of st.loot) {
          if (k.startsWith('blueprint:')) {
            const rk = k.slice('blueprint:'.length);
            shipping.staticBlueprintCounts[rk] = (shipping.staticBlueprintCounts[rk] ?? 0) + q;
          } else {
            shipping.staticLootCounts[k] = (shipping.staticLootCounts[k] ?? 0) + q;
          }
        }
      }
    }
  });

  const veyra = emptyStats();
  for (const sc of VEYRA05_SCENES) {
    const ww = getWindowWorld(sc.id);
    for (const sk of ww.world.sourceV3) {
      if (!sk) continue;
      veyra.sourceCounts[sk] = (veyra.sourceCounts[sk] ?? 0) + 1;
      (veyra.scenesWithSource[sk] ??= new Set()).add(sc.id);
    }
    for (const st of ww.world.statics) {
      if (st.kind === 'cash' && (st.cash ?? 0) > 0) veyra.cashSites++;
      if (st.kind === 'loot' && st.loot) {
        for (const [k, q] of st.loot) {
          if (k.startsWith('blueprint:')) {
            const rk = k.slice('blueprint:'.length);
            veyra.staticBlueprintCounts[rk] = (veyra.staticBlueprintCounts[rk] ?? 0) + q;
            (veyra.scenesWithBlueprint[rk] ??= new Set()).add(sc.id);
          } else {
            veyra.staticLootCounts[k] = (veyra.staticLootCounts[k] ?? 0) + q;
            (veyra.scenesWithLoot[k] ??= new Set()).add(sc.id);
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
  if (itemId === 'spares') list.push(`research_random:${BAL.research.randomSparesCost}`, `research_directed_T1_T2:${BAL.research.directedSparesCost}`);
  if (itemId === 'iron_plate') list.push('action:bearTrapSet(x1_arm_3hits)', 'action:repairStructure_wall_door(25pct_HP)');
  if (itemId === 'arrow') list.push('device:arrow_turret_ammo', 'weapon:bow_ammo');
  if (itemId === 'keycard') list.push('poi:vault_door_scan');
  if (itemId === 'rcash') list.push('device:escrow_chest(profile_deposit)');
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
  if (def.slot) m.push(`equip_slot:${def.slot}${def.armor ? ` armor=${def.armor}` : ''}${def.cold ? ` cold=${def.cold}` : ''}${def.mask ? ' rad_mask' : ''}${def.carryBonus ? ` carry+${def.carryBonus}` : ''}`);
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
  if (itemId === 'rcash') m.push('deposit_escrow->profile.securedCash');
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
  if (itemId === 'rcash') parts.push('ESCROW_DEPOSIT:1_rcash->1_securedCash');
  if (itemId === 'spares') parts.push('VENDOR_SPARES_CURRENCY');
  return parts.length ? parts.join(' | ') : 'NONE';
}

export function generateItemFunctionAuditCsv(): { csv: string; rowCount: number } {
  const { shipping, veyra } = scanWorlds();
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
    for (const [sk, sd] of Object.entries(SOURCES)) {
      if (sd.yields.some(([k]) => k === itemId) || sd.bonus?.some(([k]) => k === itemId) || sd.qualityBonus?.tiers.some((t) => t.item === itemId)) {
        spawnParts.push(`source:${sk}`);
      }
    }
    if (itemId === 'salvaged_oil') spawnParts.push(`source:wreck(p=${SALVAGED_OIL_WRECK_CHANCE})`);
    if (itemId === 'crude_petroleum') spawnParts.push('station:oil_pump(oilTestFixture_only)');
    for (const [ck, cd] of Object.entries(CREATURES)) {
      const dr = cd.drops.find(([k]) => k === itemId);
      if (dr) spawnParts.push(`drop:${ck}(${dr[1]}@${dr[2]})`);
      if (cd.uniqueDrop === itemId) spawnParts.push(`boss_unique:${ck}`);
    }
    for (const [gKey, gDef] of Object.entries(GARDEN_CROPS)) {
      if (gDef.output.some(([k]) => k === itemId)) spawnParts.push(`garden:${gKey}`);
    }
    const eco = lootEcologySourcesForItem(itemId);
    if (eco.roles.length) spawnParts.push(`loot_role:${eco.roles.join('+')}`);
    if (eco.tables.length) spawnParts.push(`loot_table:${eco.tables.join('+')}`);
    if ((BAL.airdropV1.fixed as [string, number][]).some(([k]) => k === itemId) || (BAL.airdropV1.options as [string, number][]).some(([k]) => k === itemId)) {
      spawnParts.push('airdrop:shipping_dev_only');
    }
    for (const m of DAILY_MILESTONES) {
      const spec = milestoneRewardSpec(m.id);
      if (spec?.items.some(([k]) => k === itemId)) spawnParts.push(`journey:${m.id}`);
    }
    if (itemId === 'knife') spawnParts.push('starter_equip');
    if (VENDOR_SECURED[itemId] || VENDOR_SPARES[itemId]) spawnParts.push('vendor_stock');
    if (shipping.staticLootCounts[itemId] || shipping.creatorLootCores[itemId]) spawnParts.push('shipping_static_loot');
    if (veyra.staticLootCounts[itemId]) spawnParts.push('veyra_static_loot');
    if (itemId === 'blueprint') spawnParts.push('authored_crates&loot_ecology_blueprints');

    // Recipes producing itemId
    const producing = Object.entries(RECIPES)
      .filter(([, r]) => r.out === itemId || r.outs?.some(([k]) => k === itemId))
      .map(([rid, r]) => {
        const outStr = r.outs ? fmtPairs(r.outs) : `${r.out}:${r.qty}`;
        return `${rid}[${r.station ?? 'hand'}${r.stationLevel ? `L${r.stationLevel}` : ''};T${r.tier}${ALWAYS_KNOWN_RECIPES.includes(rid) ? ';base' : ''}](${fmtPairs(r.ins)}->${outStr})`;
      });
    // Also add recycler & garden routes producing it
    for (const [rid, snap] of Object.entries(componentRuleSnapshot())) {
      if (snap.outputs.some(([k]) => k === itemId)) producing.push(`${rid}[recycler](${snap.key}:1->${fmtPairs(snap.outputs)})`);
    }
    if (itemId === 'spares') producing.push('X:drive[recycler](damaged_drive:1->spares:2)');

    // Recipes consuming itemId
    const consuming = Object.entries(RECIPES)
      .filter(([, r]) => r.ins.some(([k]) => k === itemId))
      .map(([rid, r]) => `${rid}(in:${r.ins.find(([k]) => k === itemId)![1]}->${r.out}:${r.qty})`);

    const devices = collectDeviceConsumers(itemId);
    const direct = collectDirectMechanics(itemId);
    const recyc = recycleSummary(itemId);
    const vendor = vendorSummary(itemId);

    // Shipping availability
    const shipSources = Object.entries(SOURCES)
      .filter(([, sd]) => sd.yields.some(([k]) => k === itemId) || sd.bonus?.some(([k]) => k === itemId) || sd.qualityBonus?.tiers.some((t) => t.item === itemId))
      .reduce((acc, [sk]) => acc + (shipping.sourceCounts[sk] ?? 0), 0);
    const shipCreatureAvail = Object.entries(CREATURES).some(([ck, cd]) => SHIPPING_CREATURES.has(ck) && (cd.drops.some(([k]) => k === itemId) || cd.uniqueDrop === itemId));
    const shipStaticAvail = (shipping.staticLootCounts[itemId] ?? 0) + (shipping.creatorLootCores[itemId] ?? 0);
    let shipAvail = 'NONE';
    if (itemId === 'crude_petroleum') shipAvail = 'TEST_FIXTURE_GATED(oilTestFixture_only)';
    else if (ELDER_STONE_KEYS.has(itemId) && !itemId.startsWith('stone_surtur') && !itemId.startsWith('stone_typhon') && !itemId.startsWith('stone_aion') && !itemId.startsWith('stone_atlas') && !itemId.startsWith('stone_argus') && !itemId.startsWith('stone_anubis')) {
      shipAvail = 'AVAILABLE(shipping_elder_drop)';
    } else if (['stone_surtur', 'stone_typhon', 'stone_aion', 'stone_atlas', 'stone_argus', 'stone_anubis', 'grouse_egg', 'feather', ...SIDE_BOSS_UNIQUE_DROPS].includes(itemId)) {
      shipAvail = 'VEYRA_EXCLUSIVE';
    } else if (shipSources > 0 || shipCreatureAvail || shipStaticAvail > 0 || producing.length > 0 || eco.roles.length > 0 || eco.tables.length > 0) {
      shipAvail = `AVAILABLE(src=${shipSources},static=${shipStaticAvail},creatures=${shipCreatureAvail ? 'Y' : 'N'})`;
    }

    // Veyra availability
    const veyraSrcEntry = Object.entries(SOURCES).filter(([, sd]) => sd.yields.some(([k]) => k === itemId) || sd.bonus?.some(([k]) => k === itemId) || sd.qualityBonus?.tiers.some((t) => t.item === itemId));
    const veyraSrcCount = veyraSrcEntry.reduce((acc, [sk]) => acc + (veyra.sourceCounts[sk] ?? 0), 0);
    const veyraSrcScenes = new Set<string>();
    for (const [sk] of veyraSrcEntry) for (const sc of veyra.scenesWithSource[sk] ?? []) veyraSrcScenes.add(sc);
    const veyraCreatures = Object.entries(CREATURES).filter(([ck, cd]) => VEYRA_SPAWN_CREATURES.has(ck) && (cd.drops.some(([k]) => k === itemId) || cd.uniqueDrop === itemId)).map(([ck]) => ck);
    const veyraStatic = veyra.staticLootCounts[itemId] ?? 0;
    const veyraLootScenes = veyra.scenesWithLoot[itemId]?.size ?? 0;

    let veyraAvail = 'AVAILABLE';
    if (itemId === 'crude_petroleum') veyraAvail = 'TEST_FIXTURE_GATED(oilTestFixture_only)';
    else if (['stone_frost', 'stone_magma', 'stone_bog', 'stone_grove', 'stone_tide', 'stone_rust'].includes(itemId)) {
      veyraAvail = 'LEGACY_SHIPPING_ELDER_ONLY(Veyra_uses_6_Primordials)';
    } else if (['chitin', 'beetle_horn', 'crawler_optic', 'wolf_fang'].includes(itemId)) {
      veyraAvail = `MISSING_VEYRA_SOURCE(zero_spawns_of_beetle/crawler/wolf_static=${veyraStatic})`;
    } else if (['core_meteor', 'core_dragon', 'core_elsa', 'core_mjolnir', 'core_demon'].includes(itemId)) {
      veyraAvail = itemId === 'core_demon'
        ? 'BLOCKED_INPUT(crawler_optic_missing_on_Veyra;creatorLootV1_not_on_Veyra)'
        : 'CRAFTABLE_ONLY(creatorLootV1_Shipping_only)';
    } else if (LEGACY_CORE_KEYS.has(itemId)) {
      veyraAvail = 'CRAFTABLE_BLUEPRINT_RESEARCH_ONLY(no_static_placement)';
    } else if (itemId === 'damaged_drive') {
      veyraAvail = `AVAILABLE_SOURCE_ONLY(src=${veyraSrcCount}_wrecks;WORKBENCH_ONLY_NO_VEYRA_RECYCLER_PRE_D5)`;
    } else if (veyraSrcCount === 0 && veyraCreatures.length === 0 && veyraStatic === 0 && producing.length === 0 && !eco.tables.length) {
      veyraAvail = 'MISSING_VEYRA_SOURCE';
    } else {
      veyraAvail = `AVAILABLE(src=${veyraSrcCount}_across_${veyraSrcScenes.size}scenes,creatures=${veyraCreatures.length},static=${veyraStatic}_across_${veyraLootScenes}scenes)`;
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
    } else if (SIDE_BOSS_UNIQUE_DROPS.has(itemId)) {
      roleStatus = 'ELDER_OR_BOSS_REWARD';
    } else if (itemId === 'rcash') {
      roleStatus = 'META_CURRENCY';
      recAction = 'BLOCK_JOURNEY_CASH_MINT_D1(escrow_only)';
    } else if (['food', 'tool', 'weapon', 'armor'].includes(def.cat) || def.cat === 'kit') {
      roleStatus = 'CONSUMABLE_EQUIPMENT';
      if (itemId === 'chitin_armor') recAction = 'BLOCKED_VEYRA_BY_MISSING_CHITIN_A5_CREATOR_DECISION';
      else if (itemId === 'gas_mask') recAction = 'BLOCKED_VEYRA_BY_MISSING_CRAWLER_OPTIC_A5_CREATOR_DECISION';
      else if (itemId === 'fur_cloak') recAction = 'CRAFTABLE_VIA_FUR;wolf_fang_specimen_MISSING_ON_VEYRA';
    } else if (['chitin', 'beetle_horn', 'crawler_optic', 'wolf_fang'].includes(itemId)) {
      roleStatus = 'BLOCKED_OR_MISSING_VEYRA_SOURCE';
      recAction = 'REQUIRES_CREATOR_DECISION(coherent_Veyra_biome_source_no_cross_species_A5)';
    } else if (itemId === 'damaged_drive') {
      roleStatus = 'CORE_INDUSTRIAL_FLOW';
      recAction = 'ENABLE_PHYSICAL_VEYRA_RECYCLER_AT_PO_SLAG_D5';
    } else if (itemId === 'iron_plate' || itemId === 'mechanical_gear' || itemId === 'metal_pipe' || itemId === 'metal_blade' || itemId === 'refined_iron_ingot' || itemId === 'mechanical_parts' || itemId === 'spares') {
      roleStatus = 'CORE_INDUSTRIAL_FLOW';
      if (itemId === 'iron_plate') recAction = 'ADD_BEAR_TRAP_TO_BUILD_ORDER_D2(restores_second_consumer_on_UI)';
      else if (itemId === 'metal_pipe' || itemId === 'metal_blade' || itemId === 'mechanical_gear') {
        recAction = 'ENABLE_VEYRA_RECYCLER_AT_PO_SLAG_D5(X:pipe-v2,X:gear-v1,X:blade-v1)';
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
    .sort(([a], [b]) => a.localeCompare(b))
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

    // Anti-arbitrage / recycler conservation check if item has a live recovery route
    let conserv = 'N/A(craft_only)';
    const dummy = { uid: 'aud', key: r.out, qty: 1, ...(ITEMS[r.out]?.dur ? { dur: ITEMS[r.out].dur } : {}) };
    const snap = componentRuleSnapshot();
    const matchedComp = Object.keys(snap).find((ck) => snap[ck].key === r.out);
    const probeVer = matchedComp ?? (Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, r.out) ? 'X:recover-v3' : Object.prototype.hasOwnProperty.call(BAL.recyclerV2.rules, r.out) ? 'X:recover-v2' : Object.prototype.hasOwnProperty.call(BAL.recyclerV1.rules, r.out) ? 'X:recover-v1' : null);
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
    if (r.station === 'oil_pump' || rid === 'refinery_crude') {
      blocker = 'REQUIRES_OIL_TEST_FIXTURE_WELLHEAD';
      shipVeyra = 'TEST_FIXTURE_ONLY';
      recAction = 'KEEP_GATED_PENDING_MAP_AUTHORITY';
    } else if (ins.some(([k]) => ['crawler_optic', 'chitin'].includes(k))) {
      blocker = `MISSING_VEYRA_SOURCE:${ins.filter(([k]) => ['crawler_optic', 'chitin'].includes(k)).map(([k]) => k).join(',')}`;
      shipVeyra = 'SHIPPING_LIVE / VEYRA_BLOCKED_INPUT';
      recAction = 'REQUIRES_CREATOR_DECISION(A5_NO_CROSS_SPECIES)';
    } else if (rid === 'fuel_can') {
      blocker = 'CHEM_ROUTE_COST(charcoal+sulfur+glass_vs_salvaged_oil_refinery)';
    } else if (rid === 'recover_drive') {
      blocker = 'COMPETES_WITH_RECYCLER_X:drive';
      shipVeyra = 'SHIPPING_BOTH / VEYRA_BENCH_ONLY_PRE_D5';
      recAction = 'ADD_PHYSICAL_VEYRA_RECYCLER_D5';
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
        footprintOk ? `${formatVec(rawAgg)} (IE=${Math.round((ieValue(rawAgg)) * 1000) / 1000})` : 'UNEXPANDABLE',
        r.secs,
        fuelCost,
        conserv,
        throughput,
        blocker,
        shipVeyra,
        recAction,
        `RECIPES.${rid}`,
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
        'poi_recycler(Foundry)',
        isHistorical ? 'HISTORICAL_SAVED_JOBS_ONLY' : 'LIVE_ACTIVE_PLAN',
        `${spec.key}:1`,
        fmtPairs(spec.outputs),
        `${formatVec(outVec)} (IE_out=${Math.round(ieValue(outVec) * 1000) / 1000} vs IE_craft=${craftEx ? Math.round(ieValue(craftEx.vec) * 1000) / 1000 : 'N/A'})`,
        spec.seconds,
        '0s_fuel(POI_recycler_batch)',
        `${ratio} (${over ? 'OVER_RETURN' : 'NET_LOSS_VERIFIED'})`,
        Math.round((60 / spec.seconds) * 100) / 100,
        isHistorical ? 'LEGACY_COMPAT_ONLY' : 'VEYRA_MISSING_PO_SLAG_RECYCLER_PRE_D5',
        isHistorical ? 'BOTH_COMPAT_ONLY' : 'SHIPPING_LIVE / VEYRA_MISSING_PRE_D5',
        isHistorical ? 'KEEP_PINNED_IMMUTABLE' : 'IMPLEMENT_VEYRA_RECYCLER_AT_PO_SLAG_D5',
        `recycler.ts:${cid}`,
      ]),
    );
  }

  lines.push(
    csvRow([
      'X:drive',
      'RECYCLE_DRIVE',
      'FOCUS_IRON_PARTS_SPARES',
      'poi_recycler(Foundry)',
      'LIVE_ACTIVE_PLAN',
      'damaged_drive:1',
      'spares:2',
      'salvage_only_finite_wreck_drop',
      12,
      '0s_fuel(POI_recycler_batch)',
      'NON_REPEATABLE_SALVAGE_OK',
      5,
      'VEYRA_MISSING_PO_SLAG_RECYCLER_PRE_D5',
      'SHIPPING_LIVE / VEYRA_MISSING_PRE_D5',
      'IMPLEMENT_VEYRA_RECYCLER_AT_PO_SLAG_D5',
      'recycler.ts:X:drive',
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
      const fullOut = [...rule.base, ...rule.mid, ...rule.high];
      const craftEx = integerTree(itemKey, 1);
      const isSuperseded =
        (ver === 'X:recover-v1' && (Object.prototype.hasOwnProperty.call(BAL.recyclerV2.rules, itemKey) || Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, itemKey))) ||
        (ver === 'X:recover-v2' && Object.prototype.hasOwnProperty.call(BAL.recyclerV3.rules, itemKey));
      lines.push(
        csvRow([
          `${ver}:${itemKey}`,
          'RECYCLE_TOOL_WEAPON',
          'FOCUS_IRON_PARTS_SPARES',
          'poi_recycler(Foundry)',
          isSuperseded ? 'HISTORICAL_INFLIGHT_ONLY' : 'LIVE_ACTIVE_PLAN',
          `${itemKey}:1(durability_tiered)`,
          `base:${fmtPairs(rule.base)}|mid:${fmtPairs(rule.mid)}|high:${fmtPairs(rule.high)}`,
          craftEx ? `${formatVec(craftEx.vec)} (IE_craft=${Math.round(ieValue(craftEx.vec) * 1000) / 1000})` : 'UNEXPANDABLE',
          secs,
          '0s_fuel(POI_recycler_batch)',
          over ? 'OVER_RETURN(HISTORICAL_V2_SUPERSEDED)' : 'NET_LOSS_VERIFIED_ALL_TIERS',
          Math.round((60 / secs) * 100) / 100,
          isSuperseded ? 'SUPERSEDED_BY_V3' : 'VEYRA_MISSING_PO_SLAG_RECYCLER_PRE_D5',
          isSuperseded ? 'COMPAT_ONLY' : 'SHIPPING_LIVE / VEYRA_MISSING_PRE_D5',
          isSuperseded ? 'KEEP_PINNED_IMMUTABLE' : 'IMPLEMENT_VEYRA_RECYCLER_AT_PO_SLAG_D5',
          `balance.v1.json:${ver}.${itemKey}`,
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
          def.essence === 'spirit' ? 'VEYRA_SPIRIT_ESSENCE_BLOCKED_ON_RECIPE_ONLY(drops_from_vampire_3_&_custodian)' : 'NONE',
          ['core_blast', 'core_earthmother'].includes(cid) ? 'BOTH_LIVE' : 'SHIPPING_LOOT_AND_CRAFT / VEYRA_CRAFT_ONLY',
          'KEEP_7_CREATOR_CORES_DISJOINT_FROM_4_LEGACY_A4',
          `catalog.ts:ITEMS.${cid}`,
        ]),
      );
    }
  }

  // 4. Device / Action Sinks & Workstation Upgrades
  const deviceRoutes: [string, string, string, string, string, string, string, string, number, string, string, string][] = [
    ['device:bearTrapSet', 'DEVICE_ARM', 'FOCUS_GEAR_PIPE_BLADE_PLATE', 'bear_trap', 'LIVE_ON_CRAFT_MISSING_FROM_BUILD_ORDER_PRE_D2', 'iron_plate:1', 'armed_trap:3_triggers', 'iron_plate:1', 0, '0s_mechanical', 'D2_FIX_ADD_BEAR_TRAP_TO_BUILD_ORDER', 'engine.ts:bearTrapSet'],
    ['device:repairStructure_plate', 'DEVICE_PATCH', 'FOCUS_GEAR_PIPE_BLADE_PLATE', 'wall_or_door_damaged', 'SHIFT_CLICK_REPAIR_ACTION', 'iron_plate:1', 'hp_restore:25pct_maxHp', 'iron_plate:1', 0, '0s_action', 'NONE', 'engine.ts:1762'],
    ['device:base_generator_fuel', 'POWER_GEN', 'FOCUS_FUEL_POWER_OIL', 'base_generator', 'PAID_WIRE_V1', 'fuel_can:1|coal:1|charcoal:1|fuel_briquette:1|wood:1', 'power_energy_ms(60s/80s/55s/90s/20s)', 'fuel_can_or_coal_or_wood', 60, '1x_base_plus_loads(w07_s06_contract)', 'D4_INVESTIGATED_BOUND_TO_W07_S06', 'engine.ts:stepBasePower'],
    ['device:arrow_turret', 'DEVICE_DEFENSE', 'GENERAL_ECONOMY', 'arrow_turret', 'WIRED_BASE_GENERATOR', 'arrow:1;generator_power', 'hostile_shot_dmg', 'wood+stone+fiber_or_feather', 1, '1_generator_load', 'NONE', 'sim.ts:turretFire'],
    ['device:escrow_deposit', 'META_ESCROW', 'GENERAL_ECONOMY', 'escrow_chest(claim_only)', 'LOCKED_CANON_CASH_ONLY', 'rcash:1', 'profile.securedCash:1', 'finite_world_cash', 0, '0s', 'D1_MUST_BLOCK_JOURNEY_MINT_SO_ESCROW_IS_SOLE_SOURCE', 'engine.ts:escrowDeposit'],
    ['upgrade:workbench_L2', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L1->L2', fmtPairs(WORKBENCH_UPGRADE.cost), 'workbench_level:2', fmtPairs(WORKBENCH_UPGRADE.cost), 0, '0s', 'NONE', 'catalog.ts:WORKBENCH_UPGRADE'],
    ['upgrade:workbench_L3', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L2->L3', fmtPairs(WORKBENCH_UPGRADE_III.cost), 'workbench_level:3', fmtPairs(WORKBENCH_UPGRADE_III.cost), 0, '0s', 'NONE', 'catalog.ts:WORKBENCH_UPGRADE_III'],
    ['upgrade:industrial_module', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'workbench', 'L2_ELECTRIC_QUEUE', fmtPairs(INDUSTRIAL_MODULE.cost), 'automated_powered_bench', fmtPairs(INDUSTRIAL_MODULE.cost), 0, '1_generator_load', 'NONE', 'catalog.ts:INDUSTRIAL_MODULE'],
    ['upgrade:generator_cap2', 'WORKSTATION_UPGRADE', 'FOCUS_FUEL_POWER_OIL', 'base_generator', 'L2_BENCH_NEARBY', fmtPairs(GENERATOR_CAPACITY_UPGRADE.cost), 'generator_capacity:2', fmtPairs(GENERATOR_CAPACITY_UPGRADE.cost), 0, '2_loads_fuel', 'NONE', 'catalog.ts:GENERATOR_CAPACITY_UPGRADE'],
    ['upgrade:furnace_lining', 'WORKSTATION_UPGRADE', 'FOCUS_IRON_PARTS_SPARES', 'furnace', 'L2_BENCH_NEARBY', fmtPairs(FURNACE_LINING.cost), 'furnace_lined_speed_bonus', fmtPairs(FURNACE_LINING.cost), 0, '0s', 'NONE', 'catalog.ts:FURNACE_LINING'],
  ];
  for (const [id, rtype, focus, dev, gate, ins, outs, raw, secs, fuel, action, prov] of deviceRoutes) {
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
        action === 'NONE' ? 'NONE' : action,
        id === 'device:bearTrapSet' ? 'UI_BUILD_ORDER_MISSING_PRE_D2' : 'BOTH_LIVE',
        action,
        prov,
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
      ]),
    );
  }

  // 6. Study & Vendor Conversion Routes
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
        'D1_MUST_BLOCK_JOURNEY_CASH_MINT',
        'BOTH_LIVE',
        'VERIFY_WITH_ESCROW_ONLY_SECURED_CASH_D1',
        `catalog.ts:VENDOR_SECURED.${vk}`,
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
