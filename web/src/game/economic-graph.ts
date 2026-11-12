/**
 * SOH Economic Multigraph Extractor & Structural Validator (WP1 / M1).
 *
 * Extracts the authoritative typed directed multigraph directly from Soul of Hero's
 * live runtime catalogs (`ITEMS`, `SOURCES`, `RECIPES`, `STRUCTS`, `CREATURES`,
 * `ELDERS`, `PRIMORDIAL_ELDERS`, `BAL`, `recycler`, `loot-ecology`, `loot-source-spec`,
 * `husbandry`, `airdrop`, `world`, `veyra05`) without synthesizing or modifying mechanics.
 *
 * Kept pure (no direct Vite `import.meta.glob` / `?raw` imports) so browser bundles stay
 * clean while Vitest / CLI harnesses inject live compiled `World` & Veyra floor snapshots.
 */

import {
  ACHIEVEMENTS,
  ALWAYS_KNOWN_RECIPES,
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
  PRIMORDIAL_TO_LEGACY_DOMAIN,
  RECIPES,
  SALVAGED_OIL_WRECK_CHANCE,
  SOURCES,
  STRUCTURE_UPGRADES,
  STRUCTS,
  VENDOR_SECURED,
  VENDOR_SPARES,
  WORKBENCH_UPGRADE,
  WORKBENCH_UPGRADE_III,
  permitsDirectedResearch,
  requiredStationLevel,
  stationBurnable,
} from './catalog';
import { BAL } from './core';
import {
  BUTCHER_YIELDS,
  FEED_NUTRITION,
  HUSBANDRY_BREEDING_RULES,
  HUSBANDRY_YIELDS,
  TAMABLE_SPECIES,
  TAMING_SPECIES,
} from './husbandry';
import {
  LOOT_B04_ROLES,
  LOOT_B05_TOOLBOX_GRADE,
  LOOT_CLASSES,
  lootClass,
  type LootClass,
} from './loot-ecology';
import {
  SHIPPING_LOOT_SOURCES,
  expectedAccess,
} from './loot-source-spec';
import { componentRuleSnapshot } from './recycler';
import { creatorLootV1 } from './creator-loot';
import type { StaticEnt } from './world';

export type NodeKind =
  | 'item'
  | 'blueprint'
  | 'world_source'
  | 'creature'
  | 'elder'
  | 'husbandry'
  | 'container'
  | 'station'
  | 'recipe'
  | 'vendor_offer'
  | 'currency'
  | 'requisition'
  | 'structure'
  | 'poi_gate'
  | 'sink'
  | 'player_state';

export type LayerScope = 'shared' | 'shipping' | 'dev_delta' | 'veyra05' | 'test_fixture';

export type RuntimeStatus =
  | 'LIVE_SHIPPING_AND_VEYRA'
  | 'LIVE_SHIPPING_ONLY'
  | 'LIVE_VEYRA_ONLY'
  | 'UNWIRED_ON_VEYRA'
  | 'TEST_FIXTURE_ONLY'
  | 'PARTIAL_STUB';

export type EdgeKind =
  | 'HARVEST_YIELD'
  | 'HARVEST_BONUS'
  | 'HARVEST_QUALITY_TIER'
  | 'CREATURE_DROP'
  | 'SIDE_BOSS_UNIQUE_DROP'
  | 'ELDER_STONE_DROP'
  | 'HUSBANDRY_FEED_TAME'
  | 'HUSBANDRY_PEN_FEED'
  | 'HUSBANDRY_RENEWABLE_YIELD'
  | 'HUSBANDRY_BREED'
  | 'HUSBANDRY_BUTCHER'
  | 'LOOT_STATIC_FIXED'
  | 'LOOT_ECOLOGY_POOL'
  | 'CREATOR_LOOT_UNIQUE'
  | 'AIRDROP_DROP'
  | 'CASH_CHEST_MINT'
  | 'CRAFT_INPUT'
  | 'CRAFT_OUTPUT'
  | 'STATION_FUEL'
  | 'RECYCLE_INPUT'
  | 'RECYCLE_OUTPUT'
  | 'RESEARCH_RANDOM'
  | 'RESEARCH_DIRECTED'
  | 'RESEARCH_SPECIMEN'
  | 'BLUEPRINT_LEARN'
  | 'REPAIR_INPUT'
  | 'FIELD_REPAIR'
  | 'DISMANTLE_SALVAGE'
  | 'UPGRADE_COST'
  | 'BUILD_COST'
  | 'TERRITORY_UPKEEP_PER_24H'
  | 'RECLAIM_REFUND'
  | 'CORE_LOAD'
  | 'CORE_CAST_SINK'
  | 'CORE_CAST_OUTPUT'
  | 'POWER_FUEL'
  | 'POWER_ALLOCATION'
  | 'VEHICLE_DEPLOY'
  | 'VEHICLE_FUEL_SINK'
  | 'VEHICLE_WEAR_REPAIR'
  | 'VEHICLE_LUBRICATE'
  | 'GARDEN_PLANT_INPUT'
  | 'GARDEN_HARVEST_OUTPUT'
  | 'TENDER_AUTOMATE'
  | 'VENDOR_TRADE_SPARES'
  | 'VENDOR_TRADE_SECURED'
  | 'ESCROW_PURCHASE'
  | 'ESCROW_DEPOSIT'
  | 'JOURNEY_REQUISITION'
  | 'POI_ACCESS_GATE'
  | 'TURRET_AMMO_SINK'
  | 'TRAP_ARM_SINK'
  | 'SURVIVAL_CONSUME'
  | 'HAZARD_DRAIN'
  | 'RUN_WIPE_SINK';

export interface EconGate {
  id: string;
  kind: 'station' | 'knowledge' | 'layout' | 'fixture' | 'policy' | 'poi_access' | 'lifecycle' | 'spawner';
  layerScope: LayerScope;
  rule: string;
  codeRef: string;
}

export interface EconNode {
  id: string;
  kind: NodeKind;
  label: string;
  layerScope: LayerScope;
  runtimeStatus: RuntimeStatus;
  meta: Record<string, unknown>;
}

export interface EconEdge {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  qtyIn?: number;
  qtyOut?: number;
  ratePerUnit?: number;
  probability?: number;
  durationSec?: number;
  periodSec?: number;
  gateIds: string[];
  layerScope: LayerScope;
  runtimeStatus: RuntimeStatus;
  authority: 'LIVE_VERIFIED_SOH';
  codeRef: string;
  notes?: string;
}

export interface VeyraPoiExtraction {
  id: string;
  name: string;
  arche: string;
  levels: number[];
  authoredCacheCount: number;
  statics: Array<{
    level: number;
    kind: StaticEnt['kind'];
    tx: number;
    ty: number;
    label?: string;
    cash?: number;
    locked?: string;
    loot?: [string, number][];
    fromArchetypePreset?: boolean;
  }>;
}

export interface VeyraHabitatExtraction {
  species: string;
  poiId: string;
  count: number;
  leashTiles: number;
}

export interface VeyraSideBossExtraction {
  species: string;
  poiId: string;
  name: string;
  floor: number;
}

export interface VeyraPrimordialExtraction {
  key: string;
  poiId: string;
  floor: number;
}

export interface EconomicExtractionInput {
  shippingStatics: StaticEnt[];
  shippingPoiDoors: Array<{ tx: number; ty: number; requirement: 'power' | 'keycard'; cardClass?: string }>;
  shippingSourceCounts: Record<string, number>;
  devDeltaExtraStatics: StaticEnt[];
  devDeltaPoiDoors: Array<{ tx: number; ty: number; requirement: 'power' | 'keycard'; cardClass?: string }>;
  veyraPois: VeyraPoiExtraction[];
  veyraOrdinaryHabitats: VeyraHabitatExtraction[];
  veyraWildSpecies: string[];
  veyraSideBosses: VeyraSideBossExtraction[];
  veyraPrimordials: VeyraPrimordialExtraction[];
  veyraSampledSourceCounts: Record<string, number>;
}

export interface EconomicDiagnostics {
  shippingReachableItems: string[];
  shippingUnreachableItems: string[];
  veyraReachableItems: string[];
  veyraUnreachableItems: string[];
  shippingUncraftableRecipes: string[];
  veyraUncraftableRecipes: string[];
  itemsWithoutNonWipeSink: string[];
  shippingOnlySystems: string[];
  veyraOnlySystems: string[];
  testFixtureOnlyChains: string[];
}

export interface SohEconomicGraph {
  schemaVersion: 'soh.economic-graph.v1';
  baseline: {
    repo: string;
    commit: string;
    branch: string;
  };
  gates: Record<string, EconGate>;
  nodes: EconNode[];
  edges: EconEdge[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    gateCount: number;
    nodesByKind: Record<string, number>;
    edgesByKind: Record<string, number>;
    edgesByRuntimeStatus: Record<string, number>;
    veyraPoiStats: {
      totalPois: number;
      authoredCachePois: number;
      authoredCacheTotal: number;
      archetypeLootPois: number;
      rcashPois: number;
      vendorPois: number;
      evacPois: number;
      elderPois: number;
      keycardDoors: number;
      powerDoors: number;
    };
    shippingSourceCounts: Record<string, number>;
    veyraSampledSourceCounts: Record<string, number>;
  };
  diagnostics: EconomicDiagnostics;
}

const SHIPPING_SPAWN_CREATURES = new Set(['boar', 'wolf', 'toad', 'crawler', 'beetle', 'crab']);

function stableSortById<T extends { id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function addDaysHours(): number {
  return BAL.run.maxRunHours * 3600;
}

export function buildSohEconomicGraph(input: EconomicExtractionInput): SohEconomicGraph {
  const gates = buildGates();
  const nodeMap = new Map<string, EconNode>();
  const edgeMap = new Map<string, EconEdge>();

  const addNode = (node: EconNode) => {
    if (nodeMap.has(node.id)) return;
    nodeMap.set(node.id, node);
  };

  let seq = 0;
  const addEdge = (edge: Omit<EconEdge, 'id' | 'authority'> & { id?: string }) => {
    const id =
      edge.id ??
      `E:${edge.kind}:${edge.from}->${edge.to}:${++seq}`;
    if (edgeMap.has(id)) {
      throw new Error(`Duplicate edge id: ${id}`);
    }
    edgeMap.set(id, {
      ...edge,
      id,
      authority: 'LIVE_VERIFIED_SOH',
    });
  };

  // 1. Currencies & Player State / Sinks
  addNode({
    id: 'currency:spares',
    kind: 'currency',
    label: 'Spares (Run-local Currency)',
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    meta: { physicalItem: 'item:spares', persistsAcrossWipe: false },
  });
  addNode({
    id: 'currency:rcash',
    kind: 'currency',
    label: 'Ragnarok Cash (Run-local Physical Cash)',
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    meta: { physicalLootItem: false, heldAsItemKey: 'rcash', ragnarokCreatureDrop: true, persistsAcrossWipe: false },
  });
  addNode({
    id: 'currency:secured_cash',
    kind: 'currency',
    label: 'Secured Cash (Profile Meta-Currency)',
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    meta: { persistsAcrossWipe: true, sourcePaths: ['escrow_deposit', 'journey_requisition'] },
  });
  addNode({
    id: 'currency:score',
    kind: 'currency',
    label: 'Run Score / Achievements',
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    meta: { achievementsCount: Object.keys(ACHIEVEMENTS).length },
  });

  const playerStates: Array<[string, string, Record<string, unknown>]> = [
    ['player:hp', 'Player Health (HP)', { max: BAL.player.maxHp }],
    ['player:hunger', 'Player Hunger', { drainPerMin: BAL.player.hungerDrainPerMin, offlinePerHour: BAL.player.offlineHungerPerHour }],
    ['player:thirst', 'Player Thirst', { drainPerMin: BAL.player.thirstDrainPerMin, offlinePerHour: BAL.player.offlineThirstPerHour }],
    ['player:warmth', 'Player Warmth / Thermal', { coldThreshold: BAL.comfortV1.coldThreshold, cap: BAL.comfortV1.scoreCap }],
    ['player:rad', 'Player Radiation', { damagePerMinOver50: BAL.player.radDamagePerMinOver50 }],
    ['player:stamina', 'Player Stamina', { max: BAL.player.maxStamina, regen: BAL.player.staminaRegen }],
    ['player:knowledge', 'Run Recipe Knowledge', { alwaysKnownCount: ALWAYS_KNOWN_RECIPES.length }],
    ['profile:secured_cash', 'Profile Secured Cash Vault', { persistent: true }],
  ];
  for (const [id, label, meta] of playerStates) {
    addNode({
      id,
      kind: 'player_state',
      label,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta,
    });
  }

  const sinkDefs: Array<[string, string, LayerScope, RuntimeStatus, Record<string, unknown>]> = [
    ['sink:tool_durability_wear', 'Tool & Weapon Durability Wear', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:ammo_consumption', 'Bow & Projectile Arrow Consumption', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:core_charge_consumption', 'Creator Core Reserve Consumption (basic/refined/signature)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:station_fuel_burn', 'Campfire / Furnace / Refinery Burn Fuel Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:generator_fuel_burn', 'Base Field Generator Fuel Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:tender_fuel_burn', 'Garden Tender (farm_controller) Energy Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:vehicle_fuel_burn', 'Motorbike Fuel Consumption Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:vehicle_hp_wear', 'Motorbike Chassis Wear Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { wearPerPixel: BAL.motorbike.wearPerPixel }],
    ['sink:lubricant_consumption', 'Motorbike Lubricant Coating Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { distancePx: BAL.oilRefineryV1.lubricantDistancePx }],
    ['sink:turret_arrow_consumption', 'Arrow Turret Live & Offline Ammo Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:trap_arm_wear', 'Bear Trap Arming & Trigger Wear Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { uses: BAL.bearTrapV1.uses }],
    ['sink:territory_upkeep_24h', 'Territory Cabinet 25%/24h Structural Upkeep', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { fractionPerDay: BAL.territory.upkeepFractionPerDay }],
    ['sink:structure_repair_cost', 'Manual Structure Repair Material Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:structure_reclaim_loss', 'Structure Reclaim 50% Material Destruction Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { lossFraction: 1 - BAL.economy.reclaimRefund }],
    ['sink:specimen_destructive_study', 'Destructive Specimen / Equipment Study Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:blueprint_consume_learn', 'Single-Use Blueprint Consumption Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:spares_research_sink', 'Research Table Spares Currency Sink (4 / 9)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { random: BAL.research.randomSparesCost, directed: BAL.research.directedSparesCost }],
    ['sink:vendor_spares_sink', 'Trading Post Spares Purchase Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:vendor_rcash_escrow_sink', 'Escrow Chest Purchase (30 Physical Ragnarok Cash)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { price: BAL.economy.escrowChestPrice }],
    ['sink:vendor_secured_cash_sink', 'Secured Cash Outlay Sink (Run-start / Vendor)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:food_water_consume', 'Food, Medicine & Water Consumption Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:poi_keycard_burn', 'POI Vault Keycard Use Burn (Shipping/dev_delta)', 'shipping', 'LIVE_SHIPPING_ONLY', { usesPerCard: BAL.poiAccess.cardUses }],
    ['sink:poi_generator_fuel_burn', 'POI Generator Fuel Canister Burn (Shipping/dev_delta)', 'shipping', 'LIVE_SHIPPING_ONLY', { runtimeSec: BAL.poiAccess.fuelRuntimeMs / 1000 }],
    ['sink:recycler_recovery_loss', 'Foundry Recycler Material Loss vs Craft Cost', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:husbandry_feed_water_drain', 'Livestock Pen Feed & Hydration Consumption Sink', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['sink:run_wipe_336h', '336-Hour Run End Full Asset Wipe', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { maxRunHours: BAL.run.maxRunHours }],
  ];
  for (const [id, label, layerScope, runtimeStatus, meta] of sinkDefs) {
    addNode({ id, kind: 'sink', label, layerScope, runtimeStatus, meta });
  }

  // 2. ITEMS (all catalog items + blueprints)
  for (const [key, def] of Object.entries(ITEMS)) {
    addNode({
      id: `item:${key}`,
      kind: 'item',
      label: def.name,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: {
        cat: def.cat,
        weight: def.w,
        max: def.max,
        dur: def.dur ?? null,
        charge: def.charge ?? null,
        fuel: def.fuel ?? null,
        waterContainer: !!def.waterContainer,
        creatorCore: def.creatorCore ?? null,
        essence: def.essence ?? null,
        legacyCore: def.core ?? null,
        specimen: def.specimen ?? null,
        studyRecipe: def.studyRecipe ?? null,
        hasRepair: !!def.repair,
        hasSalvage: !!def.salvage,
        placeStruct: def.place ?? null,
        food: def.food ?? null,
        slot: def.slot ?? null,
        armor: def.armor ?? null,
        dmg: def.dmg ?? null,
        carryBonus: def.carryBonus ?? null,
      },
    });

    // Item -> item repair / salvage / study / fuel / food / wipe edges
    if (def.repair) {
      const repairGate = def.repair.station === 'workbench' ? 'gate:wb_l1' : `gate:station_${def.repair.station}`;
      for (const [mat, qty] of def.repair.cost) {
        addEdge({
          kind: 'REPAIR_INPUT',
          from: `item:${mat}`,
          to: `item:${key}`,
          qtyIn: qty,
          qtyOut: 1,
          gateIds: [repairGate],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `catalog.ts:ITEMS.${key}.repair`,
          notes: 'Restores full item durability at workbench',
        });
      }
    }
    if (def.dur && !def.core) {
      addEdge({
        kind: 'FIELD_REPAIR',
        from: 'item:field_repair_kit',
        to: `item:${key}`,
        qtyIn: 1,
        ratePerUnit: BAL.player.fieldRepairDurability,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:useItem.field_repair_kit',
        notes: `Restores up to ${BAL.player.fieldRepairDurability} durability in inventory`,
      });
      addEdge({
        kind: 'CRAFT_INPUT',
        from: `item:${key}`,
        to: 'sink:tool_durability_wear',
        ratePerUnit: 1 / def.dur,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.dur`,
      });
    }
    if (def.salvage) {
      const salvageGate = def.salvage.station === 'workbench' ? 'gate:wb_l1' : `gate:station_${def.salvage.station}`;
      for (const [mat, qty] of def.salvage.yields) {
        addEdge({
          kind: 'DISMANTLE_SALVAGE',
          from: `item:${key}`,
          to: `item:${mat}`,
          qtyIn: 1,
          qtyOut: qty,
          gateIds: [salvageGate],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `catalog.ts:ITEMS.${key}.salvage`,
        });
      }
    }
    if (def.fuel) {
      if (stationBurnable(key)) {
        for (const st of ['campfire', 'furnace', 'furnace_lined', 'refinery', 'oil_pump']) {
          const isFixture = st === 'oil_pump';
          addEdge({
            kind: 'STATION_FUEL',
            from: `item:${key}`,
            to: `station:${st}`,
            qtyIn: 1,
            durationSec: st === 'furnace_lined' ? def.fuel / BAL.fuel.linedFurnaceFuelMultiplier : def.fuel,
            gateIds: isFixture ? ['gate:station_fuel_non_canister', 'gate:oil_test_fixture'] : ['gate:station_fuel_non_canister'],
            layerScope: isFixture ? 'test_fixture' : 'shared',
            runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
            codeRef: 'catalog.ts:stationBurnable',
          });
        }
      }
      addEdge({
        kind: 'POWER_FUEL',
        from: `item:${key}`,
        to: 'station:base_generator',
        qtyIn: 1,
        durationSec: def.fuel,
        gateIds: ['gate:base_power_wire_v1'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:stepBasePower',
      });
      addEdge({
        kind: 'POWER_FUEL',
        from: `item:${key}`,
        to: 'station:farm_controller',
        qtyIn: 1,
        durationSec: def.fuel,
        gateIds: ['gate:wb_l2'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:stepTenders',
      });
    }
    if (def.food) {
      addEdge({
        kind: 'SURVIVAL_CONSUME',
        from: `item:${key}`,
        to: 'sink:food_water_consume',
        qtyIn: 1,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.food`,
      });
      if (def.food.hp && def.food.hp > 0) {
        addEdge({
          kind: 'SURVIVAL_CONSUME',
          from: `item:${key}`,
          to: 'player:hp',
          qtyIn: 1,
          ratePerUnit: def.food.hp,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `catalog.ts:ITEMS.${key}.food.hp`,
        });
      }
      if (def.food.hunger) {
        addEdge({
          kind: 'SURVIVAL_CONSUME',
          from: `item:${key}`,
          to: 'player:hunger',
          qtyIn: 1,
          ratePerUnit: def.food.hunger,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `catalog.ts:ITEMS.${key}.food.hunger`,
        });
      }
      if (def.food.thirst) {
        addEdge({
          kind: 'SURVIVAL_CONSUME',
          from: `item:${key}`,
          to: 'player:thirst',
          qtyIn: 1,
          ratePerUnit: def.food.thirst,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `catalog.ts:ITEMS.${key}.food.thirst`,
        });
      }
    }
    if (def.specimen && RECIPES[def.specimen]) {
      addEdge({
        kind: 'RESEARCH_SPECIMEN',
        from: `item:${key}`,
        to: `recipe:${def.specimen}`,
        qtyIn: 1,
        durationSec: BAL.research.specimenSeconds,
        gateIds: ['gate:station_research', 'gate:knowledge_run_local'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.specimen`,
        notes: 'Consumes 1 specimen item (0 Spares) to unlock recipe',
      });
      addEdge({
        kind: 'RESEARCH_SPECIMEN',
        from: `item:${key}`,
        to: 'sink:specimen_destructive_study',
        qtyIn: 1,
        gateIds: ['gate:station_research'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.specimen`,
      });
    }
    if (def.studyRecipe && RECIPES[def.studyRecipe]) {
      addEdge({
        kind: 'RESEARCH_SPECIMEN',
        from: `item:${key}`,
        to: `recipe:${def.studyRecipe}`,
        qtyIn: 1,
        durationSec: BAL.research.specimenSeconds,
        gateIds: ['gate:station_research', 'gate:knowledge_run_local'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.studyRecipe`,
        notes: 'Consumes 1 finished equipment item (0 Spares) to unlock recipe',
      });
      addEdge({
        kind: 'RESEARCH_SPECIMEN',
        from: `item:${key}`,
        to: 'sink:specimen_destructive_study',
        qtyIn: 1,
        gateIds: ['gate:station_research'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:ITEMS.${key}.studyRecipe`,
      });
    }

    // Run-end 336h wipe applies to every physical run-local item
    addEdge({
      kind: 'RUN_WIPE_SINK',
      from: `item:${key}`,
      to: 'sink:run_wipe_336h',
      periodSec: addDaysHours(),
      gateIds: ['gate:run_wipe_336h'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:settle',
    });
  }

  // Core study table (CORE_STUDY) + Creator Core loading / cast sinks
  for (const [coreItem, recipeKey] of Object.entries(CORE_STUDY)) {
    if (!ITEMS[coreItem] || !RECIPES[recipeKey]) continue;
    addEdge({
      kind: 'RESEARCH_SPECIMEN',
      from: `item:${coreItem}`,
      to: `recipe:${recipeKey}`,
      qtyIn: 1,
      durationSec: BAL.research.specimenSeconds,
      gateIds: ['gate:station_research', 'gate:knowledge_run_local'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:CORE_STUDY.${coreItem}`,
      notes: 'Destructively studies Core to learn its crafting recipe',
    });
    addEdge({
      kind: 'RESEARCH_SPECIMEN',
      from: `item:${coreItem}`,
      to: 'sink:specimen_destructive_study',
      qtyIn: 1,
      gateIds: ['gate:station_research'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:CORE_STUDY.${coreItem}`,
    });
  }

  for (const [key, def] of Object.entries(ITEMS)) {
    if (!def.creatorCore) continue;
    const ess = `item:essence_${def.essence}`;
    addEdge({
      kind: 'CORE_LOAD',
      from: 'item:energy_basic',
      to: `item:${key}`,
      qtyIn: 1,
      qtyOut: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:coreLoad.basic',
      notes: 'Cap 40 basic charges',
    });
    addEdge({
      kind: 'CORE_LOAD',
      from: 'item:energy_refined',
      to: `item:${key}`,
      qtyIn: 1,
      qtyOut: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:coreLoad.refined',
      notes: 'Cap 12 refined charges',
    });
    addEdge({
      kind: 'CORE_LOAD',
      from: 'item:energy_refined',
      to: `item:${key}`,
      qtyIn: 1,
      qtyOut: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:coreLoad.signature_energy',
      notes: 'Paired 1:1 with matching essence (cap 4 signature charges)',
    });
    addEdge({
      kind: 'CORE_LOAD',
      from: ess,
      to: `item:${key}`,
      qtyIn: 1,
      qtyOut: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:coreLoad.signature_essence',
      notes: 'Paired 1:1 with energy_refined',
    });
    addEdge({
      kind: 'CORE_CAST_SINK',
      from: `item:${key}`,
      to: 'sink:core_charge_consumption',
      qtyIn: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'sim.ts:coreCast',
    });
    if (def.creatorCore === 'earthmother') {
      addEdge({
        kind: 'CORE_CAST_OUTPUT',
        from: `item:${key}`,
        to: 'item:wood',
        qtyIn: 1,
        qtyOut: BAL.creatorCoreEarthmother.treeCount * BAL.creatorCoreEarthmother.woodPerTree,
        durationSec: BAL.creatorCoreEarthmother.treeMs / 1000,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'sim.ts:stepNatureTrees',
        notes: 'Refined mode spends 1 refined charge to grow 10 temporary trees yielding 10 wood',
      });
    }
  }

  // Legacy cores (fire/earth/storm/frost) carry charge (12) without Creator reserve reloading
  for (const legCore of ['core_fire', 'core_earth', 'core_storm', 'core_frost']) {
    addEdge({
      kind: 'CORE_CAST_SINK',
      from: `item:${legCore}`,
      to: 'sink:core_charge_consumption',
      qtyIn: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:ITEMS.${legCore}.charge`,
    });
  }

  // Spares & rcash currency bridges
  addEdge({
    kind: 'CRAFT_OUTPUT',
    from: 'item:spares',
    to: 'currency:spares',
    ratePerUnit: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'catalog.ts:ITEMS.spares',
  });
  addEdge({
    kind: 'CASH_CHEST_MINT',
    from: 'item:rcash',
    to: 'currency:rcash',
    ratePerUnit: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'catalog.ts:ITEMS.rcash',
    notes: 'Physical rcash item held in custody and deposited via Escrow Chest',
  });
  addEdge({
    kind: 'ESCROW_PURCHASE',
    from: 'currency:rcash',
    to: 'item:escrow_chest',
    qtyIn: BAL.economy.escrowChestPrice,
    qtyOut: 1,
    gateIds: ['gate:escrow_cash_only'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:buy.escrow',
  });
  addEdge({
    kind: 'ESCROW_PURCHASE',
    from: 'currency:rcash',
    to: 'sink:vendor_rcash_escrow_sink',
    qtyIn: BAL.economy.escrowChestPrice,
    gateIds: ['gate:escrow_cash_only'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:buy.escrow',
  });
  addEdge({
    kind: 'ESCROW_DEPOSIT',
    from: 'currency:rcash',
    to: 'currency:secured_cash',
    ratePerUnit: 1,
    gateIds: ['gate:escrow_cash_only', 'gate:claim_2_limit'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:deposit',
    notes: 'Requires built Escrow Chest inside claimed Territory',
  });
  addEdge({
    kind: 'ESCROW_DEPOSIT',
    from: 'currency:secured_cash',
    to: 'profile:secured_cash',
    ratePerUnit: 1,
    gateIds: ['gate:escrow_cash_only'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:deposit',
  });

  // 3. STATIONS & STRUCTURES
  const stations: Array<[string, string, LayerScope, RuntimeStatus, Record<string, unknown>]> = [
    ['station:hand', 'Hand Crafting (No Station)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:campfire', 'Campfire', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { burnableFuel: true }],
    ['station:furnace', 'Furnace', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { burnableFuel: true }],
    ['station:furnace_lined', 'Kiln-Lined Furnace', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { fuelMult: BAL.fuel.linedFurnaceFuelMultiplier }],
    ['station:workbench_1', 'Workbench (Level 1)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { level: 1 }],
    ['station:workbench_2', 'Workbench (Level 2)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { level: 2 }],
    ['station:workbench_3', 'Workbench (Level 3)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { level: 3 }],
    ['station:workbench_industrial', 'Powered Industrial Workbench', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { workSpeedMultiplier: BAL.industrialPower.workSpeedMultiplier }],
    ['station:research', 'Research Table', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { randomSpares: BAL.research.randomSparesCost, directedSpares: BAL.research.directedSparesCost }],
    ['station:recycler', 'Foundry Recycler (Shipping Foundry Yard + Veyra po_slag)', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { worldEntity: true, veyraSite: { poi: 'po_slag', tx: 2414, ty: 1896 } }],
    ['station:oil_pump', 'Oil Pump (Test-Fixture Only)', 'test_fixture', 'TEST_FIXTURE_ONLY', { fixtureAuthority: BAL.oilPumpV1.fixtureAuthority, requiresWorkbenchLevel: BAL.oilPumpV1.requiresWorkbenchLevel }],
    ['station:refinery', 'Oil Refinery', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { requiresWorkbenchLevel: BAL.oilRefineryV1.requiresWorkbenchLevel }],
    ['station:garden', 'Garden Plot', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:garden_cold_frame', 'Cold-Frame Garden Plot', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { warming: BAL.garden.coldFrameWarming }],
    ['station:farm_controller', 'Garden Tender', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:barrel', 'Rain Barrel', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:feed_trough', 'Feed & Water Trough', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { slots: STRUCTS.feed_trough.slots }],
    ['station:base_generator', 'Field Generator', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { defaultCapacity: 1, upgradedCapacity: 2 }],
    ['station:arrow_turret', 'Arrow Turret', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:ir_sensor', 'Infrared Sensor', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { rangeTiles: BAL.irSensorV1.rangeTiles }],
    ['station:door_powered', 'Powered Door', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:bear_trap', 'Bear Trap', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { uses: BAL.bearTrapV1.uses }],
    ['station:claim', 'Territory Cabinet', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { radius: BAL.economy.claimRadius, maxClaims: BAL.economy.maxClaims }],
    ['station:escrow', 'Escrow Chest', 'shared', 'LIVE_SHIPPING_AND_VEYRA', {}],
    ['station:cart', 'Hand Cart', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { slots: BAL.cart.slots, maxWeight: BAL.cart.maxWeight }],
    ['station:cart_freight', 'Freight Cart', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { slots: BAL.cart.freightSlots, maxWeight: BAL.cart.freightMaxWeight }],
    ['station:motorbike', 'Motorbike', 'shared', 'LIVE_SHIPPING_AND_VEYRA', { slots: BAL.motorbike.slots, maxWeight: BAL.motorbike.maxWeight, tank: BAL.motorbike.tank }],
    ['station:poi_generator', 'POI Access Generator (Shipping/dev_delta)', 'shipping', 'LIVE_SHIPPING_ONLY', { fuelRuntimeSec: BAL.poiAccess.fuelRuntimeMs / 1000 }],
  ];
  for (const [id, label, layerScope, runtimeStatus, meta] of stations) {
    addNode({ id, kind: 'station', label, layerScope, runtimeStatus, meta });
  }

  for (const [sKey, sDef] of Object.entries(STRUCTS)) {
    const isFixture = sKey === 'oil_pump';
    addNode({
      id: `structure:${sKey}`,
      kind: 'structure',
      label: sDef.name,
      layerScope: isFixture ? 'test_fixture' : 'shared',
      runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
      meta: {
        hp: sDef.hp,
        layer: sDef.layer,
        need: sDef.need,
        slots: sDef.slots ?? 0,
        station: sDef.station ?? null,
        cost: sDef.cost,
      },
    });

    for (const [mat, qty] of sDef.cost) {
      addEdge({
        kind: 'BUILD_COST',
        from: `item:${mat}`,
        to: `structure:${sKey}`,
        qtyIn: qty,
        qtyOut: 1,
        gateIds: isFixture ? ['gate:oil_test_fixture'] : sDef.need === 'claim' ? ['gate:claim_2_limit'] : [],
        layerScope: isFixture ? 'test_fixture' : 'shared',
        runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:STRUCTS.${sKey}.cost`,
      });
      if ((BAL.territory.materials as readonly string[]).includes(mat)) {
        addEdge({
          kind: 'TERRITORY_UPKEEP_PER_24H',
          from: `item:${mat}`,
          to: `structure:${sKey}`,
          ratePerUnit: qty * BAL.territory.upkeepFractionPerDay,
          periodSec: 24 * 3600,
          gateIds: ['gate:claim_2_limit'],
          layerScope: isFixture ? 'test_fixture' : 'shared',
          runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'balance.v1.json:territory.upkeepFractionPerDay',
        });
        addEdge({
          kind: 'TERRITORY_UPKEEP_PER_24H',
          from: `item:${mat}`,
          to: 'sink:territory_upkeep_24h',
          ratePerUnit: qty * BAL.territory.upkeepFractionPerDay,
          periodSec: 24 * 3600,
          gateIds: ['gate:claim_2_limit'],
          layerScope: isFixture ? 'test_fixture' : 'shared',
          runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'engine.ts:stepTerritory',
        });
      }
      const refund = Math.floor(qty * BAL.economy.reclaimRefund);
      if (refund > 0) {
        addEdge({
          kind: 'RECLAIM_REFUND',
          from: `structure:${sKey}`,
          to: `item:${mat}`,
          qtyIn: 1,
          qtyOut: refund,
          gateIds: [],
          layerScope: isFixture ? 'test_fixture' : 'shared',
          runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'engine.ts:reclaim',
        });
      }
      if (qty - refund > 0) {
        addEdge({
          kind: 'RECLAIM_REFUND',
          from: `item:${mat}`,
          to: 'sink:structure_reclaim_loss',
          ratePerUnit: qty - refund,
          gateIds: [],
          layerScope: isFixture ? 'test_fixture' : 'shared',
          runtimeStatus: isFixture ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'engine.ts:reclaim',
        });
      }
    }

    if (sDef.layer === 'wall') {
      addEdge({
        kind: 'REPAIR_INPUT',
        from: 'item:iron_plate',
        to: `structure:${sKey}`,
        qtyIn: 1,
        ratePerUnit: Math.ceil(sDef.hp * BAL.ironPlatePatchV1.fraction),
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:repair.ironPlatePatchV1',
        notes: 'Patches up to 25% maxHp per iron_plate on damaged wall/door structures',
      });
    }
  }

  for (const [fromStruct, toStruct] of Object.entries(STRUCTURE_UPGRADES)) {
    const targetCost = STRUCTS[toStruct]?.cost ?? [];
    for (const [mat, qty] of targetCost) {
      addEdge({
        kind: 'UPGRADE_COST',
        from: `item:${mat}`,
        to: `structure:${toStruct}`,
        qtyIn: qty,
        qtyOut: 1,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:STRUCTURE_UPGRADES.${fromStruct}->${toStruct}`,
      });
    }
  }

  // Station & Cart Upgrades
  const upgradeSpecs: Array<[string, string, readonly [string, number][], string[], string]> = [
    ['structure:workbench', 'station:workbench_2', WORKBENCH_UPGRADE.cost, ['gate:wb_l1'], 'catalog.ts:WORKBENCH_UPGRADE'],
    ['station:workbench_2', 'station:workbench_3', WORKBENCH_UPGRADE_III.cost, ['gate:wb_l2'], 'catalog.ts:WORKBENCH_UPGRADE_III'],
    ['station:workbench_2', 'station:workbench_industrial', INDUSTRIAL_MODULE.cost, ['gate:wb_l2'], 'catalog.ts:INDUSTRIAL_MODULE'],
    ['structure:furnace', 'station:furnace_lined', FURNACE_LINING.cost, ['gate:wb_l2'], 'catalog.ts:FURNACE_LINING'],
    ['station:base_generator', 'station:base_generator', GENERATOR_CAPACITY_UPGRADE.cost, ['gate:wb_l2'], 'catalog.ts:GENERATOR_CAPACITY_UPGRADE'],
    ['station:cart', 'station:cart_freight', CART_FREIGHT_UPGRADE.cost, ['gate:wb_l2'], 'catalog.ts:CART_FREIGHT_UPGRADE'],
    ['structure:garden', 'station:garden_cold_frame', GARDEN_FRAME_COST, [], 'catalog.ts:GARDEN_FRAME_COST'],
  ];
  for (const [, targetStation, cost, gIds, codeRef] of upgradeSpecs) {
    for (const [mat, qty] of cost) {
      addEdge({
        kind: 'UPGRADE_COST',
        from: `item:${mat}`,
        to: targetStation,
        qtyIn: qty,
        qtyOut: 1,
        gateIds: gIds,
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef,
      });
    }
  }

  // Power allocation, turret ammo, bear trap arming, motorbike lifecycle
  for (const loadNode of ['station:arrow_turret', 'station:workbench_industrial', 'station:door_powered', 'station:ir_sensor']) {
    addEdge({
      kind: 'POWER_ALLOCATION',
      from: 'station:base_generator',
      to: loadNode,
      qtyIn: 1,
      gateIds: ['gate:base_power_wire_v1'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'engine.ts:powerAllocation',
    });
  }
  addEdge({
    kind: 'TURRET_AMMO_SINK',
    from: 'item:arrow',
    to: 'sink:turret_arrow_consumption',
    qtyIn: 1,
    gateIds: ['gate:base_power_wire_v1'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'sim.ts:turretFire',
  });
  addEdge({
    kind: 'TRAP_ARM_SINK',
    from: 'item:iron_plate',
    to: 'sink:trap_arm_wear',
    qtyIn: 1,
    ratePerUnit: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'balance.v1.json:bearTrapV1',
    notes: '1 iron_plate arms or re-arms Bear Trap (3 triggers per trap life)',
  });
  addEdge({
    kind: 'CRAFT_INPUT',
    from: 'item:arrow',
    to: 'sink:ammo_consumption',
    qtyIn: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'sim.ts:bowFire',
  });
  addEdge({
    kind: 'VEHICLE_DEPLOY',
    from: 'item:cart_kit',
    to: 'station:cart',
    qtyIn: 1,
    qtyOut: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:deployCart',
  });
  addEdge({
    kind: 'VEHICLE_DEPLOY',
    from: 'item:motorbike_kit',
    to: 'station:motorbike',
    qtyIn: 1,
    qtyOut: 1,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:deployVehicle',
  });
  addEdge({
    kind: 'VEHICLE_FUEL_SINK',
    from: 'item:fuel_can',
    to: 'sink:vehicle_fuel_burn',
    qtyIn: 1,
    ratePerUnit: BAL.motorbike.canFuel,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:vehicleRefuel',
    notes: `+${BAL.motorbike.canFuel} tank units (tank max ${BAL.motorbike.tank})`,
  });
  addEdge({
    kind: 'VEHICLE_WEAR_REPAIR',
    from: 'item:mechanical_parts',
    to: 'station:motorbike',
    qtyIn: 1,
    ratePerUnit: BAL.motorbike.repairHp,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:vehicleRepair',
  });
  addEdge({
    kind: 'VEHICLE_WEAR_REPAIR',
    from: 'item:fasteners',
    to: 'station:motorbike',
    qtyIn: 1,
    ratePerUnit: BAL.motorbike.repairHp,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:vehicleRepair',
  });
  addEdge({
    kind: 'VEHICLE_LUBRICATE',
    from: 'item:lubricant',
    to: 'sink:lubricant_consumption',
    qtyIn: 1,
    ratePerUnit: BAL.oilRefineryV1.lubricantDistancePx,
    gateIds: [],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:vehicleLubricate',
    notes: `Halves wear over ${BAL.oilRefineryV1.lubricantDistancePx} px (cap 1.5x)`,
  });

  // 4. RECIPES & BLUEPRINTS & RESEARCH
  for (const [rKey, rDef] of Object.entries(RECIPES)) {
    const isCrude = rKey === 'pump_crude' || rKey === 'refinery_crude';
    const isKnownAtStart = ALWAYS_KNOWN_RECIPES.includes(rKey);
    const stationNode =
      rDef.station === null
        ? 'station:hand'
        : rDef.station === 'workbench'
          ? `station:workbench_${requiredStationLevel(rDef)}`
          : `station:${rDef.station}`;
    const gateIds: string[] = ['gate:knowledge_run_local'];
    if (rDef.station === 'workbench') {
      gateIds.push(`gate:wb_l${requiredStationLevel(rDef)}`);
    } else if (rDef.station && rDef.station !== 'oil_pump') {
      gateIds.push(`gate:station_${rDef.station}`);
    }
    if (isCrude) gateIds.push('gate:oil_test_fixture');
    if (rDef.station === 'refinery') gateIds.push('gate:wb_l2');

    addNode({
      id: `recipe:${rKey}`,
      kind: 'recipe',
      label: rDef.alias ?? `${ITEMS[rDef.out]?.name ?? rDef.out} (${rKey})`,
      layerScope: isCrude ? 'test_fixture' : 'shared',
      runtimeStatus: isCrude ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
      meta: {
        out: rDef.out,
        qty: rDef.qty,
        outs: rDef.outs ?? [[rDef.out, rDef.qty]],
        ins: rDef.ins,
        station: stationNode,
        secs: rDef.secs,
        tier: rDef.tier,
        knownAtStart: isKnownAtStart,
        directedResearchAllowed: permitsDirectedResearch(rDef),
      },
    });

    if (isKnownAtStart) {
      addEdge({
        kind: 'BLUEPRINT_LEARN',
        from: 'player:knowledge',
        to: `recipe:${rKey}`,
        qtyOut: 1,
        gateIds: [],
        layerScope: isCrude ? 'test_fixture' : 'shared',
        runtimeStatus: isCrude ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'catalog.ts:ALWAYS_KNOWN_RECIPES',
        notes: 'Seeded in r.knowledge.recipes at run start',
      });
    } else {
      addNode({
        id: `blueprint:${rKey}`,
        kind: 'blueprint',
        label: `Blueprint: ${ITEMS[rDef.out]?.name ?? rDef.out}`,
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        meta: { recipe: rKey, tier: rDef.tier },
      });
      addEdge({
        kind: 'BLUEPRINT_LEARN',
        from: `blueprint:${rKey}`,
        to: `recipe:${rKey}`,
        qtyIn: 1,
        qtyOut: 1,
        gateIds: ['gate:knowledge_run_local'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:useItem.blueprint',
      });
      addEdge({
        kind: 'BLUEPRINT_LEARN',
        from: `blueprint:${rKey}`,
        to: 'sink:blueprint_consume_learn',
        qtyIn: 1,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:useItem.blueprint',
      });

      // Random research (`4` Spares -> random unknown recipe)
      addEdge({
        kind: 'RESEARCH_RANDOM',
        from: 'currency:spares',
        to: `recipe:${rKey}`,
        qtyIn: BAL.research.randomSparesCost,
        qtyOut: 1,
        durationSec: BAL.research.randomSeconds,
        gateIds: ['gate:station_research', 'gate:knowledge_run_local'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:research.random',
        notes: rDef.tier >= 3 ? 'Core / tier-3 recipes fall in fallback pool after non-core tier<3 recipes' : undefined,
      });

      if (permitsDirectedResearch(rDef)) {
        addEdge({
          kind: 'RESEARCH_DIRECTED',
          from: 'currency:spares',
          to: `recipe:${rKey}`,
          qtyIn: BAL.research.directedSparesCost,
          qtyOut: 1,
          durationSec: BAL.research.directedSeconds,
          gateIds: ['gate:station_research', 'gate:knowledge_run_local', 'gate:directed_research_tier_lt_3'],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'engine.ts:research.directed',
        });
      }
    }

    for (const [inItem, qty] of rDef.ins) {
      addEdge({
        kind: 'CRAFT_INPUT',
        from: `item:${inItem}`,
        to: `recipe:${rKey}`,
        qtyIn: qty,
        durationSec: rDef.secs,
        gateIds,
        layerScope: isCrude ? 'test_fixture' : 'shared',
        runtimeStatus: isCrude ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:RECIPES.${rKey}.ins`,
      });
    }
    const outs = rDef.outs ?? ([[rDef.out, rDef.qty]] as [string, number][]);
    for (const [outItem, qty] of outs) {
      addEdge({
        kind: 'CRAFT_OUTPUT',
        from: `recipe:${rKey}`,
        to: `item:${outItem}`,
        qtyOut: qty,
        durationSec: rDef.secs,
        gateIds,
        layerScope: isCrude ? 'test_fixture' : 'shared',
        runtimeStatus: isCrude ? 'TEST_FIXTURE_ONLY' : 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:RECIPES.${rKey}.out`,
      });
    }
  }
  addEdge({
    kind: 'RESEARCH_RANDOM',
    from: 'currency:spares',
    to: 'sink:spares_research_sink',
    ratePerUnit: 1,
    gateIds: ['gate:station_research'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:research',
  });

  // 5. FOUNDRY RECYCLER (Shipping Foundry Yard + Veyra po_slag Foundry Recycler per D5)
  type RecyclerBandRule = { base: [string, number][]; mid: [string, number][]; high: [string, number][] };
  const mergedToolRules: Record<string, { version: string; seconds: number; rule: RecyclerBandRule }> = {};
  for (const [k, rule] of Object.entries(BAL.recyclerV1.rules as Record<string, RecyclerBandRule>)) {
    mergedToolRules[k] = { version: 'v1', seconds: BAL.recyclerV1.seconds, rule };
  }
  for (const [k, rule] of Object.entries(BAL.recyclerV2.rules as Record<string, RecyclerBandRule>)) {
    mergedToolRules[k] = { version: 'v2', seconds: BAL.recyclerV2.seconds, rule };
  }
  for (const [k, rule] of Object.entries(BAL.recyclerV3.rules as Record<string, RecyclerBandRule>)) {
    mergedToolRules[k] = { version: 'v3', seconds: BAL.recyclerV3.seconds, rule };
  }

  for (const [itemKey, info] of Object.entries(mergedToolRules)) {
    const rNodeId = `recipe:recycler:${itemKey}:${info.version}`;
    addNode({
      id: rNodeId,
      kind: 'recipe',
      label: `Recycler Recover (${ITEMS[itemKey]?.name ?? itemKey})`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: { recyclerVersion: info.version, seconds: info.seconds, ...info.rule },
    });
    addEdge({
      kind: 'RECYCLE_INPUT',
      from: `item:${itemKey}`,
      to: rNodeId,
      qtyIn: 1,
      durationSec: info.seconds,
      gateIds: ['gate:recycler_site'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `recycler.ts:recoveryPlan.${info.version}`,
    });
    for (const [band, list] of [['base', info.rule.base], ['mid', info.rule.mid], ['high', info.rule.high]] as const) {
      for (const [outKey, qty] of list) {
        addEdge({
          kind: 'RECYCLE_OUTPUT',
          from: rNodeId,
          to: `item:${outKey}`,
          qtyOut: qty,
          durationSec: info.seconds,
          gateIds: ['gate:recycler_site'],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `recycler.ts:recoveryPlan.${info.version}.${band}`,
          notes: `Condition tier=${band}`,
        });
      }
    }
    addEdge({
      kind: 'RECYCLE_INPUT',
      from: `item:${itemKey}`,
      to: 'sink:recycler_recovery_loss',
      qtyIn: 1,
      gateIds: ['gate:recycler_site'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'industrial-proof.ts',
    });
  }

  // X:drive (damaged_drive -> 2 spares, 12s) + X:pipe-v2 / X:gear-v1 / X:blade-v1
  const compRules = componentRuleSnapshot();
  const driveNodeId = 'recipe:recycler:component:X:drive';
  addNode({
    id: driveNodeId,
    kind: 'recipe',
    label: 'Recycler Drive Recovery (Damaged Drive -> X:drive)',
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    meta: { recyclerRecipe: 'X:drive', key: 'damaged_drive', seconds: 12, outputs: [['spares', 2]] },
  });
  addEdge({
    kind: 'RECYCLE_INPUT',
    from: 'item:damaged_drive',
    to: driveNodeId,
    qtyIn: 1,
    durationSec: 12,
    gateIds: ['gate:recycler_site'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'recycler.ts:recoveryPlan.X:drive',
  });
  addEdge({
    kind: 'RECYCLE_OUTPUT',
    from: driveNodeId,
    to: 'item:spares',
    qtyOut: 2,
    durationSec: 12,
    gateIds: ['gate:recycler_site'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'recycler.ts:recoveryPlan.X:drive',
  });

  for (const [recipeId, comp] of Object.entries(compRules)) {
    const rNodeId = `recipe:recycler:component:${recipeId}`;
    addNode({
      id: rNodeId,
      kind: 'recipe',
      label: `Recycler Component (${ITEMS[comp.key]?.name ?? comp.key} -> ${recipeId})`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: { recyclerRecipe: recipeId, key: comp.key, seconds: comp.seconds, outputs: comp.outputs },
    });
    addEdge({
      kind: 'RECYCLE_INPUT',
      from: `item:${comp.key}`,
      to: rNodeId,
      qtyIn: 1,
      durationSec: comp.seconds,
      gateIds: ['gate:recycler_site'],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `recycler.ts:COMPONENT_RULES.${recipeId}`,
    });
    for (const [outKey, qty] of comp.outputs) {
      addEdge({
        kind: 'RECYCLE_OUTPUT',
        from: rNodeId,
        to: `item:${outKey}`,
        qtyOut: qty,
        durationSec: comp.seconds,
        gateIds: ['gate:recycler_site'],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `recycler.ts:COMPONENT_RULES.${recipeId}`,
      });
    }
  }

  // 6. WORLD SOURCES (`SOURCES` + Test-fixture Oil Site)
  const placedShippingSources = new Set(Object.keys(input.shippingSourceCounts));
  const placedVeyraSources = new Set(Object.keys(input.veyraSampledSourceCounts));

  for (const [srcKey, sDef] of Object.entries(SOURCES)) {
    const onShipping = placedShippingSources.has(srcKey);
    const onVeyra = placedVeyraSources.has(srcKey);
    const runtimeStatus: RuntimeStatus =
      onShipping && onVeyra
        ? 'LIVE_SHIPPING_AND_VEYRA'
        : onShipping
          ? 'LIVE_SHIPPING_ONLY'
          : onVeyra
            ? 'LIVE_VEYRA_ONLY'
            : 'UNWIRED_ON_VEYRA';
    addNode({
      id: `world_source:${srcKey}`,
      kind: 'world_source',
      label: sDef.name,
      layerScope: 'shared',
      runtimeStatus,
      meta: {
        mat: sDef.mat,
        hp: sDef.hp,
        stock: sDef.stock,
        regrowSec: sDef.regrow ?? null,
        regrowClass: sDef.regrowClass ?? null,
        shippingTiles: input.shippingSourceCounts[srcKey] ?? 0,
        veyraSampledTiles: input.veyraSampledSourceCounts[srcKey] ?? 0,
      },
    });
    for (const [yItem, qty] of sDef.yields) {
      addEdge({
        kind: 'HARVEST_YIELD',
        from: `world_source:${srcKey}`,
        to: `item:${yItem}`,
        qtyOut: qty,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus,
        codeRef: `catalog.ts:SOURCES.${srcKey}.yields`,
      });
    }
    for (const [bItem, chance] of sDef.bonus ?? []) {
      if (srcKey === 'wreck' && bItem === 'damaged_drive') {
        addEdge({
          kind: 'HARVEST_BONUS',
          from: 'world_source:wreck',
          to: 'item:damaged_drive',
          qtyOut: 1,
          probability: chance,
          gateIds: ['gate:recycler_site'],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: 'wreck-economy.ts:wreckBonuses',
          notes: 'Live on Shipping & Veyra veyra05-world (D5 po_slag recycler-v1); legacy static Veyra saves without recycler retain direct-v1 fallback',
        });
        addEdge({
          kind: 'HARVEST_BONUS',
          from: 'world_source:wreck',
          to: 'item:spares',
          qtyOut: 1,
          probability: 0.7,
          gateIds: [],
          layerScope: 'veyra05',
          runtimeStatus: 'LIVE_VEYRA_ONLY',
          codeRef: 'wreck-economy.ts:wreckBonuses',
          notes: 'Historical direct-v1 fallback retained only for legacy static Veyra layouts or pre-D5 saves lacking an authorized recycler',
        });
      } else {
        addEdge({
          kind: 'HARVEST_BONUS',
          from: `world_source:${srcKey}`,
          to: `item:${bItem}`,
          qtyOut: 1,
          probability: chance,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus,
          codeRef: `catalog.ts:SOURCES.${srcKey}.bonus`,
        });
      }
    }
    if (srcKey === 'wreck') {
      addEdge({
        kind: 'HARVEST_BONUS',
        from: 'world_source:wreck',
        to: 'item:salvaged_oil',
        qtyOut: 1,
        probability: SALVAGED_OIL_WRECK_CHANCE,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'engine.ts:harvestHit.SALVAGED_OIL_WRECK_CHANCE',
        notes: 'Fires whenever sourceLayoutVersion === 3 (Shipping + Veyra)',
      });
    }
    if (sDef.qualityBonus) {
      for (const tier of sDef.qualityBonus.tiers) {
        addEdge({
          kind: 'HARVEST_QUALITY_TIER',
          from: `world_source:${srcKey}`,
          to: `item:${tier.item}`,
          qtyOut: 1,
          probability: tier.chance,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus,
          codeRef: `catalog.ts:SOURCES.${srcKey}.qualityBonus`,
          notes: `Requires playerTool ${sDef.qualityBonus.power} power >= ${tier.minPower}`,
        });
      }
    }
  }

  addNode({
    id: 'world_source:oil_site_fixture',
    kind: 'world_source',
    label: 'Authorized Oil Site (Test-Fixture Only)',
    layerScope: 'test_fixture',
    runtimeStatus: 'TEST_FIXTURE_ONLY',
    meta: { authority: BAL.oilPumpV1.fixtureAuthority, maxSourceStock: BAL.oilPumpV1.maxSourceStock },
  });
  addEdge({
    kind: 'HARVEST_YIELD',
    from: 'world_source:oil_site_fixture',
    to: 'station:oil_pump',
    qtyIn: 1,
    qtyOut: 1,
    durationSec: BAL.oilPumpV1.secs,
    gateIds: ['gate:oil_test_fixture', 'gate:wb_l2'],
    layerScope: 'test_fixture',
    runtimeStatus: 'TEST_FIXTURE_ONLY',
    codeRef: 'engine.ts:stepStations.oil_pump',
  });

  // 7. GARDENS & LIVESTOCK HUSBANDRY
  for (const [cropKey, cropDef] of Object.entries(GARDEN_CROPS)) {
    const recId = `recipe:garden:${cropKey}`;
    addNode({
      id: recId,
      kind: 'recipe',
      label: `Garden Plot: ${cropDef.name}`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: { seconds: cropDef.seconds, inputs: cropDef.inputs, output: cropDef.output },
    });
    for (const [inItem, qty] of cropDef.inputs) {
      addEdge({
        kind: 'GARDEN_PLANT_INPUT',
        from: `item:${inItem}`,
        to: recId,
        qtyIn: qty,
        durationSec: cropDef.seconds,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:GARDEN_CROPS.${cropKey}.inputs`,
      });
    }
    for (const [outItem, qty] of cropDef.output) {
      addEdge({
        kind: 'GARDEN_HARVEST_OUTPUT',
        from: recId,
        to: `item:${outItem}`,
        qtyOut: qty,
        durationSec: cropDef.seconds,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `catalog.ts:GARDEN_CROPS.${cropKey}.output`,
      });
    }
  }
  addEdge({
    kind: 'TENDER_AUTOMATE',
    from: 'station:farm_controller',
    to: 'station:garden',
    gateIds: ['gate:wb_l2'],
    layerScope: 'shared',
    runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
    codeRef: 'engine.ts:stepTenders',
    notes: `Plant ${BAL.garden.tenderPlantEnergySeconds}s, pump ${BAL.garden.tenderPumpEnergySeconds}s, harvest ${BAL.garden.tenderHarvestEnergySeconds}s`,
  });

  for (const species of TAMABLE_SPECIES) {
    const hNode = `husbandry:${species}`;
    const tameSpec = TAMING_SPECIES[species];
    const renewSpec = HUSBANDRY_YIELDS[species];
    const butcherSpec = BUTCHER_YIELDS[species];
    addNode({
      id: hNode,
      kind: 'husbandry',
      label: `Penned Livestock (${CREATURES[species]?.name ?? species})`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: {
        feedingsToTame: tameSpec.feedingsToTame,
        gestationHours: HUSBANDRY_BREEDING_RULES.gestationHoursBySpecies[species],
        cycleHours: renewSpec?.cycleHours ?? null,
      },
    });
    for (const foodItem of tameSpec.preferredFoods) {
      addEdge({
        kind: 'HUSBANDRY_FEED_TAME',
        from: `item:${foodItem}`,
        to: hNode,
        qtyIn: tameSpec.feedingsToTame,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `husbandry.ts:TAMING_SPECIES.${species}`,
      });
    }
    for (const [feedItem, nut] of Object.entries(FEED_NUTRITION)) {
      addEdge({
        kind: 'HUSBANDRY_PEN_FEED',
        from: `item:${feedItem}`,
        to: 'sink:husbandry_feed_water_drain',
        qtyIn: 1,
        ratePerUnit: nut,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: 'husbandry.ts:FEED_NUTRITION',
      });
    }
    if (renewSpec) {
      addEdge({
        kind: 'HUSBANDRY_RENEWABLE_YIELD',
        from: hNode,
        to: `item:${renewSpec.primary[0]}`,
        qtyOut: renewSpec.primary[1],
        periodSec: renewSpec.cycleHours * 3600,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `husbandry.ts:HUSBANDRY_YIELDS.${species}`,
        notes: renewSpec.femaleOnlyPrimary ? 'Female adults only' : undefined,
      });
      if (renewSpec.secondary) {
        addEdge({
          kind: 'HUSBANDRY_RENEWABLE_YIELD',
          from: hNode,
          to: `item:${renewSpec.secondary[0]}`,
          qtyOut: renewSpec.secondary[1],
          periodSec: renewSpec.cycleHours * 3600,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `husbandry.ts:HUSBANDRY_YIELDS.${species}`,
        });
      }
    }
    addEdge({
      kind: 'HUSBANDRY_BREED',
      from: hNode,
      to: hNode,
      qtyOut: 1,
      periodSec: (HUSBANDRY_BREEDING_RULES.gestationHoursBySpecies[species] ?? 8) * 3600,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: 'husbandry.ts:HUSBANDRY_BREEDING_RULES',
      notes: 'Requires opposite-sex adult pair at >=50% hunger & hydration inside closed pen',
    });
    if (butcherSpec) {
      for (const [dropKey, qty] of butcherSpec.adult) {
        addEdge({
          kind: 'HUSBANDRY_BUTCHER',
          from: hNode,
          to: `item:${dropKey}`,
          qtyOut: qty,
          gateIds: [],
          layerScope: 'shared',
          runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
          codeRef: `husbandry.ts:BUTCHER_YIELDS.${species}.adult`,
        });
      }
    }
  }

  // 8. CREATURES, SIDE BOSSES, ELDERS & PRIMORDIALS
  const veyraCreatureSpawnSet = new Set([
    ...input.veyraOrdinaryHabitats.map((h) => h.species),
    ...input.veyraWildSpecies,
    ...input.veyraSideBosses.map((b) => b.species),
  ]);

  for (const [cKey, cDef] of Object.entries(CREATURES)) {
    const onShipping = SHIPPING_SPAWN_CREATURES.has(cKey);
    const onVeyra = veyraCreatureSpawnSet.has(cKey);
    const runtimeStatus: RuntimeStatus =
      onShipping && onVeyra
        ? 'LIVE_SHIPPING_AND_VEYRA'
        : onShipping
          ? 'LIVE_SHIPPING_ONLY'
          : onVeyra
            ? 'LIVE_VEYRA_ONLY'
            : 'UNWIRED_ON_VEYRA';
    const layerScope: LayerScope = onShipping && onVeyra ? 'shared' : onShipping ? 'shipping' : 'veyra05';
    const gateIds = onShipping && !onVeyra ? ['gate:shipping_spawner'] : onVeyra && !onShipping ? ['gate:veyra_spawner'] : [];

    addNode({
      id: `creature:${cKey}`,
      kind: 'creature',
      label: cDef.name,
      layerScope,
      runtimeStatus,
      meta: {
        hp: cDef.hp,
        dmg: cDef.dmg,
        biome: cDef.biome,
        shippingSpawn: onShipping,
        veyraSpawn: onVeyra,
        tamable: !!cDef.tamable,
        isSideBoss: !!cDef.uniqueDrop,
      },
    });
    for (const [dItem, qty, prob] of cDef.drops) {
      addEdge({
        kind: 'CREATURE_DROP',
        from: `creature:${cKey}`,
        to: `item:${dItem}`,
        qtyOut: qty,
        probability: prob,
        gateIds,
        layerScope,
        runtimeStatus,
        codeRef: `catalog.ts:CREATURES.${cKey}.drops`,
      });
    }
    if (cDef.uniqueDrop) {
      addEdge({
        kind: 'SIDE_BOSS_UNIQUE_DROP',
        from: `creature:${cKey}`,
        to: `item:${cDef.uniqueDrop}`,
        qtyOut: 1,
        probability: 1,
        gateIds: ['gate:veyra_spawner'],
        layerScope: 'veyra05',
        runtimeStatus: 'LIVE_VEYRA_ONLY',
        codeRef: `catalog.ts:CREATURES.${cKey}.uniqueDrop`,
        notes: 'Max 1 per run (sideBossDefeated gate)',
      });
    }
  }

  for (const [eKey, eDef] of Object.entries(ELDERS)) {
    addNode({
      id: `elder:legacy:${eKey}`,
      kind: 'elder',
      label: `${eDef.name} (Legacy Shipping Elder)`,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      meta: { hpLatent: eDef.hpLatent, hpAwake: eDef.hpAwake, stone: eDef.stone, region: eDef.region },
    });
    for (const [dropItem, qty, codeRef] of [
      [eDef.stone, 1, `catalog.ts:ELDERS.${eKey}.stone`],
      ['spares', 6, 'engine.ts:killCreature.elder'],
      ['crystal', 2, 'engine.ts:killCreature.elder'],
    ] as const) {
      addEdge({
        kind: 'ELDER_STONE_DROP',
        from: `elder:legacy:${eKey}`,
        to: `item:${dropItem}`,
        qtyOut: qty,
        probability: 1,
        gateIds: ['gate:shipping_spawner'],
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef,
      });
    }
  }

  for (const [pKey, pDef] of Object.entries(PRIMORDIAL_ELDERS)) {
    addNode({
      id: `elder:primordial:${pKey}`,
      kind: 'elder',
      label: `${pDef.name} (Veyra Primordial)`,
      layerScope: 'veyra05',
      runtimeStatus: 'LIVE_VEYRA_ONLY',
      meta: {
        hpLatent: pDef.hpLatent,
        hpAwake: pDef.hpAwake,
        stone: pDef.stone,
        legacyDomain: PRIMORDIAL_TO_LEGACY_DOMAIN[pKey],
        region: pDef.region,
      },
    });
    for (const [dropItem, qty, codeRef] of [
      [pDef.stone, 1, `catalog.ts:PRIMORDIAL_ELDERS.${pKey}.stone`],
      ['spares', 6, 'engine.ts:killCreature.elder'],
      ['crystal', 2, 'engine.ts:killCreature.elder'],
    ] as const) {
      addEdge({
        kind: 'ELDER_STONE_DROP',
        from: `elder:primordial:${pKey}`,
        to: `item:${dropItem}`,
        qtyOut: qty,
        probability: 1,
        gateIds: ['gate:veyra_spawner'],
        layerScope: 'veyra05',
        runtimeStatus: 'LIVE_VEYRA_ONLY',
        codeRef,
      });
    }
  }

  // 9. CONTAINERS: SHIPPING STATIC + DEV_DELTA + B05 ECOLOGY POOLS + AIRDROP + VEYRA 81 POIS
  const registerStaticSite = (
    containerId: string,
    label: string,
    s: StaticEnt,
    scope: 'shipping' | 'dev_delta',
    gateIds: string[],
  ) => {
    const status: RuntimeStatus = 'LIVE_SHIPPING_ONLY';
    addNode({
      id: containerId,
      kind: 'container',
      label,
      layerScope: scope,
      runtimeStatus: status,
      meta: { kind: s.kind, poi: s.poi ?? null, tx: s.tx, ty: s.ty, cash: s.cash ?? 0 },
    });
    if (s.kind === 'loot') {
      for (const [rawKey, qty] of s.loot ?? []) {
        const target = rawKey.startsWith('blueprint:') ? `blueprint:${rawKey.slice(10)}` : `item:${rawKey}`;
        addEdge({
          kind: 'LOOT_STATIC_FIXED',
          from: containerId,
          to: target,
          qtyOut: qty,
          probability: 1,
          gateIds,
          layerScope: scope,
          runtimeStatus: status,
          codeRef: `world.ts:${scope}.statics`,
        });
      }
      const cUnique = creatorLootV1(s);
      if (cUnique) {
        addEdge({
          kind: 'CREATOR_LOOT_UNIQUE',
          from: containerId,
          to: `item:${cUnique}`,
          qtyOut: 1,
          probability: 1,
          gateIds: [...gateIds, 'gate:creator_loot_v1'],
          layerScope: scope,
          runtimeStatus: status,
          codeRef: 'creator-loot.ts:creatorLootV1',
        });
      }
    } else if (s.kind === 'cash' && s.cash) {
      addEdge({
        kind: 'CASH_CHEST_MINT',
        from: containerId,
        to: 'item:rcash',
        qtyOut: s.cash,
        probability: 1,
        gateIds,
        layerScope: scope,
        runtimeStatus: status,
        codeRef: `world.ts:${scope}.cash`,
      });
    }
  };

  input.shippingStatics.forEach((s, idx) => {
    if (s.kind !== 'loot' && s.kind !== 'cash') return;
    const gateIds: string[] = [];
    if (s.poi === 'factory_vault') gateIds.push('gate:poi_keycard');
    if (s.poi === 'light_top') gateIds.push('gate:poi_power');
    registerStaticSite(
      `container:shipping:${s.poi ?? 'world'}:${idx}`,
      `Shipping ${s.poi ?? 'world'} (${s.kind})`,
      s,
      'shipping',
      gateIds,
    );
  });

  input.devDeltaExtraStatics.forEach((s, idx) => {
    if (s.kind !== 'loot' && s.kind !== 'cash') return;
    const gateIds = s.label?.toLowerCase().includes('vault') ? ['gate:poi_keycard', 'gate:poi_power'] : [];
    registerStaticSite(
      `container:dev_delta:${s.poi ?? 'relay'}:${idx}`,
      `dev_delta ${s.poi ?? 'relay'} (${s.kind})`,
      s,
      'dev_delta',
      gateIds,
    );
  });

  // B05 / W06 Ecology Pools (Shipping / dev_delta only)
  for (const cls of Object.keys(LOOT_CLASSES) as LootClass[]) {
    const classNodeId = `container:shipping:ecology_class:${cls}`;
    const def = LOOT_CLASSES[cls];
    const b04 = LOOT_B04_ROLES[cls];
    addNode({
      id: classNodeId,
      kind: 'container',
      label: `W06/B04 Ecology Class (${def.name} · ${def.hours}h)`,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      meta: { lootClass: cls, cooldownHours: def.hours, role: b04.role, grade: b04.grade },
    });
    const gateIds = cls === 'advanced' ? ['gate:loot_ecology_w06', 'gate:poi_keycard'] : ['gate:loot_ecology_w06'];
    addEdge({
      kind: 'LOOT_ECOLOGY_POOL',
      from: classNodeId,
      to: `item:${def.fixed[0]}`,
      qtyOut: def.fixed[1],
      probability: 1,
      periodSec: def.hours * 3600,
      gateIds,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      codeRef: `loot-ecology.ts:LOOT_CLASSES.${cls}.fixed`,
    });
    for (const [optItem, optQty] of def.options) {
      addEdge({
        kind: 'LOOT_ECOLOGY_POOL',
        from: classNodeId,
        to: `item:${optItem}`,
        qtyOut: optQty,
        probability: 1 / def.options.length,
        periodSec: def.hours * 3600,
        gateIds,
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: `loot-ecology.ts:LOOT_CLASSES.${cls}.options`,
      });
    }
    for (const [fxItem, fxQty] of b04.fixed) {
      addEdge({
        kind: 'LOOT_ECOLOGY_POOL',
        from: classNodeId,
        to: `item:${fxItem}`,
        qtyOut: fxQty,
        probability: 1,
        periodSec: def.hours * 3600,
        gateIds,
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: `loot-ecology.ts:LOOT_B04_ROLES.${cls}.fixed`,
      });
    }
    for (const [pItem, pQty] of b04.pool) {
      addEdge({
        kind: 'LOOT_ECOLOGY_POOL',
        from: classNodeId,
        to: `item:${pItem}`,
        qtyOut: pQty,
        probability: 1 / b04.pool.length,
        periodSec: def.hours * 3600,
        gateIds,
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: `loot-ecology.ts:LOOT_B04_ROLES.${cls}.pool`,
      });
    }
  }

  for (const spec of SHIPPING_LOOT_SOURCES) {
    const poolNodeId = `container:shipping:ecology:${spec.id}`;
    const expAccess = expectedAccess(spec);
    addNode({
      id: poolNodeId,
      kind: 'container',
      label: `B05 Loot Site (${spec.sourceId} · ${spec.role}/${spec.grade} · ${spec.stock})`,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      meta: {
        poi: spec.match.poi,
        role: spec.role,
        grade: spec.grade,
        stock: spec.stock,
        expectedAccess: expAccess,
        cooldownHours: spec.cooldownHours,
      },
    });
    const w06 = LOOT_CLASSES[spec.role];
    const gateIds = expAccess === 'door-required' ? ['gate:loot_ecology_w06', 'gate:poi_keycard'] : ['gate:loot_ecology_w06'];
    const periodSec = spec.stock === 'renewable' ? spec.cooldownHours * 3600 : undefined;
    addEdge({
      kind: 'LOOT_ECOLOGY_POOL',
      from: poolNodeId,
      to: `item:${w06.fixed[0]}`,
      qtyOut: w06.fixed[1],
      probability: 1,
      periodSec,
      gateIds,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      codeRef: `loot-ecology.ts:LOOT_CLASSES.${spec.role}.fixed`,
    });
    for (const [optItem, optQty] of w06.options) {
      addEdge({
        kind: 'LOOT_ECOLOGY_POOL',
        from: poolNodeId,
        to: `item:${optItem}`,
        qtyOut: optQty,
        probability: 1 / w06.options.length,
        periodSec,
        gateIds,
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: `loot-ecology.ts:LOOT_CLASSES.${spec.role}.options`,
      });
    }
    if (spec.role === 'toolbox') {
      const tbl = LOOT_B05_TOOLBOX_GRADE[spec.grade];
      for (const [fxItem, fxQty] of tbl.fixed) {
        addEdge({
          kind: 'LOOT_ECOLOGY_POOL',
          from: poolNodeId,
          to: `item:${fxItem}`,
          qtyOut: fxQty,
          probability: 1,
          periodSec,
          gateIds,
          layerScope: 'shipping',
          runtimeStatus: 'LIVE_SHIPPING_ONLY',
          codeRef: `loot-ecology.ts:LOOT_B05_TOOLBOX_GRADE.${spec.grade}.fixed`,
        });
      }
      for (const [pItem, pQty] of tbl.pool) {
        addEdge({
          kind: 'LOOT_ECOLOGY_POOL',
          from: poolNodeId,
          to: `item:${pItem}`,
          qtyOut: pQty,
          probability: 1 / tbl.pool.length,
          periodSec,
          gateIds,
          layerScope: 'shipping',
          runtimeStatus: 'LIVE_SHIPPING_ONLY',
          codeRef: `loot-ecology.ts:LOOT_B05_TOOLBOX_GRADE.${spec.grade}.pool`,
        });
      }
    }
    void lootClass;
  }

  // Airdrop v1 (Shipping / dev_delta only)
  addNode({
    id: 'container:shipping:airdrop_v1',
    kind: 'container',
    label: 'Public Airdrop Crate (airdrop-v1)',
    layerScope: 'shipping',
    runtimeStatus: 'LIVE_SHIPPING_ONLY',
    meta: {
      firstHours: BAL.airdropV1.firstHours,
      cadenceHours: BAL.airdropV1.cadenceHours,
      maxEvents: BAL.airdropV1.maxEvents,
      lockSeconds: BAL.airdropV1.lockSeconds,
    },
  });
  for (const [ak, aq] of BAL.airdropV1.fixed as [string, number][]) {
    addEdge({
      kind: 'AIRDROP_DROP',
      from: 'container:shipping:airdrop_v1',
      to: `item:${ak}`,
      qtyOut: aq,
      probability: 1,
      periodSec: BAL.airdropV1.cadenceHours * 3600,
      gateIds: ['gate:airdrop_v1'],
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      codeRef: 'airdrop.ts:airdropRewards.fixed',
    });
  }
  const weightSum = (BAL.airdropV1.weights as number[]).reduce((a, b) => a + b, 0);
  (BAL.airdropV1.options as [string, number][]).forEach(([ok, oq], i) => {
    addEdge({
      kind: 'AIRDROP_DROP',
      from: 'container:shipping:airdrop_v1',
      to: `item:${ok}`,
      qtyOut: oq,
      probability: (BAL.airdropV1.weights as number[])[i] / weightSum,
      periodSec: BAL.airdropV1.cadenceHours * 3600,
      gateIds: ['gate:airdrop_v1'],
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      codeRef: 'airdrop.ts:airdropRewards.options',
    });
  });

  // POI access doors on Shipping & dev_delta
  for (const d of [...input.shippingPoiDoors, ...input.devDeltaPoiDoors]) {
    const id = `poi_gate:${d.requirement}:${d.tx}_${d.ty}`;
    addNode({
      id,
      kind: 'poi_gate',
      label: `POI Door (${d.requirement}) @ ${d.tx},${d.ty}`,
      layerScope: 'shipping',
      runtimeStatus: 'LIVE_SHIPPING_ONLY',
      meta: d,
    });
    if (d.requirement === 'keycard') {
      addEdge({
        kind: 'POI_ACCESS_GATE',
        from: 'item:keycard',
        to: id,
        qtyIn: 1,
        gateIds: ['gate:poi_keycard'],
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: 'engine.ts:poiAccess.keycard',
      });
      addEdge({
        kind: 'POI_ACCESS_GATE',
        from: 'item:keycard',
        to: 'sink:poi_keycard_burn',
        qtyIn: 1 / BAL.poiAccess.cardUses,
        gateIds: ['gate:poi_keycard'],
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: 'balance.v1.json:poiAccess.cardUses',
      });
    } else {
      addEdge({
        kind: 'POI_ACCESS_GATE',
        from: 'item:fuel_can',
        to: id,
        qtyIn: 1,
        durationSec: BAL.poiAccess.fuelRuntimeMs / 1000,
        gateIds: ['gate:poi_power'],
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: 'engine.ts:poiAccess.power',
      });
      addEdge({
        kind: 'POI_ACCESS_GATE',
        from: 'item:fuel_can',
        to: 'sink:poi_generator_fuel_burn',
        qtyIn: 1,
        durationSec: BAL.poiAccess.fuelRuntimeMs / 1000,
        gateIds: ['gate:poi_power'],
        layerScope: 'shipping',
        runtimeStatus: 'LIVE_SHIPPING_ONLY',
        codeRef: 'balance.v1.json:poiAccess.fuelRuntimeMs',
      });
    }
  }

  // Veyra 81 POIs (authored caches + globalExtraStatics archetype/rcash/vendor/evac)
  let authoredCachePois = 0;
  let authoredCacheTotal = 0;
  let archetypeLootPois = 0;
  let rcashPois = 0;
  let vendorPois = 0;
  let evacPois = 0;
  let elderPois = 0;
  let veyraKeycardDoors = 0;
  let veyraPowerDoors = 0;

  for (const poi of input.veyraPois) {
    if (poi.authoredCacheCount > 0) authoredCachePois++;
    if (poi.arche === 'elder_site' || poi.id.startsWith('po_surtur') || poi.id.startsWith('po_typhon') || poi.id.startsWith('po_elderwood') || poi.id.startsWith('po_gate') || poi.id.startsWith('po_hall_eyes') || poi.id.startsWith('po_necropolis')) {
      // Check against actual primordial POI list
    }
    let hasArchetypeLoot = false;
    let hasRcash = false;
    let hasVendor = false;
    let hasEvac = false;

    poi.statics.forEach((st, idx) => {
      if (st.kind === 'door') {
        if (st.locked === 'keycard') veyraKeycardDoors++;
        if (st.locked === 'power') veyraPowerDoors++;
      }
      if (st.kind === 'vendor') hasVendor = true;
      if (st.kind === 'evac') hasEvac = true;
      if (st.kind !== 'loot' && st.kind !== 'cash') return;
      if (st.kind === 'loot' && !st.fromArchetypePreset) authoredCacheTotal++;
      if (st.kind === 'loot' && st.fromArchetypePreset) hasArchetypeLoot = true;
      if (st.kind === 'cash') hasRcash = true;

      const cid = `container:veyra:${poi.id}:L${st.level}:${idx}`;
      addNode({
        id: cid,
        kind: 'container',
        label: `Veyra ${poi.name} (${poi.id}) ${st.kind}`,
        layerScope: 'veyra05',
        runtimeStatus: 'LIVE_VEYRA_ONLY',
        meta: {
          poiId: poi.id,
          level: st.level,
          kind: st.kind,
          fromArchetypePreset: !!st.fromArchetypePreset,
          cash: st.cash ?? 0,
        },
      });
      if (st.kind === 'loot') {
        for (const [rawKey, qty] of st.loot ?? []) {
          const target = rawKey.startsWith('blueprint:') ? `blueprint:${rawKey.slice(10)}` : `item:${rawKey}`;
          addEdge({
            kind: 'LOOT_STATIC_FIXED',
            from: cid,
            to: target,
            qtyOut: qty,
            probability: 1,
            gateIds: [],
            layerScope: 'veyra05',
            runtimeStatus: 'LIVE_VEYRA_ONLY',
            codeRef: st.fromArchetypePreset ? 'veyra05/floors.ts:ARCHETYPE_LOOT' : `veyra05/arch/sites.ts:${poi.id}`,
          });
        }
      } else if (st.kind === 'cash' && st.cash) {
        addEdge({
          kind: 'CASH_CHEST_MINT',
          from: cid,
          to: 'item:rcash',
          qtyOut: st.cash,
          probability: 1,
          gateIds: [],
          layerScope: 'veyra05',
          runtimeStatus: 'LIVE_VEYRA_ONLY',
          codeRef: `veyra05/floors.ts:RCASH_BY_POI.${poi.id}`,
        });
      }
    });

    if (hasArchetypeLoot) archetypeLootPois++;
    if (hasRcash) rcashPois++;
    if (hasVendor) vendorPois++;
    if (hasEvac) evacPois++;
  }
  elderPois = input.veyraPrimordials.length;

  // 10. VENDOR OFFERS & JOURNEY REQUISITIONS
  for (const [vKey, offer] of Object.entries(VENDOR_SPARES)) {
    const id = `vendor_offer:spares:${vKey}`;
    addNode({
      id,
      kind: 'vendor_offer',
      label: `Trader (Spares): ${ITEMS[vKey]?.name ?? vKey}`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: offer,
    });
    addEdge({
      kind: 'VENDOR_TRADE_SPARES',
      from: 'currency:spares',
      to: `item:${vKey}`,
      qtyIn: offer.price,
      qtyOut: offer.qty,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:VENDOR_SPARES.${vKey}`,
      notes: `Max stock ${offer.stock} per run`,
    });
    addEdge({
      kind: 'VENDOR_TRADE_SPARES',
      from: 'currency:spares',
      to: 'sink:vendor_spares_sink',
      qtyIn: offer.price,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:VENDOR_SPARES.${vKey}`,
    });
  }

  for (const [vKey, offer] of Object.entries(VENDOR_SECURED)) {
    const id = `vendor_offer:secured:${vKey}`;
    addNode({
      id,
      kind: 'vendor_offer',
      label: `Trader (Secured Cash): ${ITEMS[vKey]?.name ?? vKey}`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: offer,
    });
    addEdge({
      kind: 'VENDOR_TRADE_SECURED',
      from: 'currency:secured_cash',
      to: `item:${vKey}`,
      qtyIn: offer.price,
      qtyOut: 1,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:VENDOR_SECURED.${vKey}`,
      notes: `Max stock ${offer.stock} per run`,
    });
    addEdge({
      kind: 'VENDOR_TRADE_SECURED',
      from: 'currency:secured_cash',
      to: 'sink:vendor_secured_cash_sink',
      qtyIn: offer.price,
      gateIds: [],
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      codeRef: `catalog.ts:VENDOR_SECURED.${vKey}`,
    });
  }

  type JourneyReqDef = { points: number; securedCash: number; items: [string, number][] };
  const journeyReqs = ((BAL as unknown as { journeyRequisitions?: Record<string, JourneyReqDef> }).journeyRequisitions ?? {});
  for (const [reqKey, req] of Object.entries(journeyReqs)) {
    const id = `requisition:${reqKey}`;
    addNode({
      id,
      kind: 'requisition',
      label: `Daily Ledger Requisition (${reqKey})`,
      layerScope: 'shared',
      runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
      meta: req as Record<string, unknown>,
    });
    if (req.securedCash > 0) {
      addEdge({
        kind: 'JOURNEY_REQUISITION',
        from: id,
        to: 'currency:secured_cash',
        qtyOut: req.securedCash,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `balance.v1.json:journeyRequisitions.${reqKey}`,
      });
    }
    for (const [itemKey, qty] of req.items) {
      addEdge({
        kind: 'JOURNEY_REQUISITION',
        from: id,
        to: `item:${itemKey}`,
        qtyOut: qty,
        gateIds: [],
        layerScope: 'shared',
        runtimeStatus: 'LIVE_SHIPPING_AND_VEYRA',
        codeRef: `balance.v1.json:journeyRequisitions.${reqKey}.items`,
      });
    }
  }

  const nodes = stableSortById([...nodeMap.values()]);
  const edges = stableSortById([...edgeMap.values()]);

  // Build summaries & structural reachability diagnostics
  const nodesByKind: Record<string, number> = {};
  for (const n of nodes) nodesByKind[n.kind] = (nodesByKind[n.kind] ?? 0) + 1;
  const edgesByKind: Record<string, number> = {};
  const edgesByRuntimeStatus: Record<string, number> = {};
  for (const e of edges) {
    edgesByKind[e.kind] = (edgesByKind[e.kind] ?? 0) + 1;
    edgesByRuntimeStatus[e.runtimeStatus] = (edgesByRuntimeStatus[e.runtimeStatus] ?? 0) + 1;
  }

  const diagnostics = computeReachabilityDiagnostics(nodes, edges);

  return {
    schemaVersion: 'soh.economic-graph.v1',
    baseline: {
      repo: 'Khanh-glitch/Soul-of-Hero',
      commit: '52f27959f732aa8b47d6a897c9a5aa7d708cf926',
      branch: 'arena/f561fd0d-soul-of-hero',
    },
    gates,
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      gateCount: Object.keys(gates).length,
      nodesByKind,
      edgesByKind,
      edgesByRuntimeStatus,
      veyraPoiStats: {
        totalPois: input.veyraPois.length,
        authoredCachePois,
        authoredCacheTotal,
        archetypeLootPois,
        rcashPois,
        vendorPois,
        evacPois,
        elderPois,
        keycardDoors: veyraKeycardDoors,
        powerDoors: veyraPowerDoors,
      },
      shippingSourceCounts: input.shippingSourceCounts,
      veyraSampledSourceCounts: input.veyraSampledSourceCounts,
    },
    diagnostics,
  };
}

function computeReachabilityDiagnostics(nodes: EconNode[], edges: EconEdge[]): EconomicDiagnostics {
  const allItems = Object.keys(ITEMS).sort();
  const isShippingEdge = (e: EconEdge) =>
    e.runtimeStatus === 'LIVE_SHIPPING_AND_VEYRA' || e.runtimeStatus === 'LIVE_SHIPPING_ONLY';
  const isVeyraEdge = (e: EconEdge) =>
    e.runtimeStatus === 'LIVE_SHIPPING_AND_VEYRA' || e.runtimeStatus === 'LIVE_VEYRA_ONLY';

  const solveReachable = (edgeFilter: (e: EconEdge) => boolean): { items: Set<string>; craftableRecipes: Set<string> } => {
    const activeEdges = edges.filter(edgeFilter);
    const items = new Set<string>(['knife', 'water_flask', 'torch']); // starter pack
    const knownRecipes = new Set<string>(ALWAYS_KNOWN_RECIPES);
    const currencies = new Set<string>(['secured_cash']);

    // Direct world sources, creatures, elders, containers, requisitions, vendors
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of activeEdges) {
        if (e.kind === 'CASH_CHEST_MINT' && e.from === 'item:rcash' && e.to === 'currency:rcash') {
          if (items.has('rcash') && !currencies.has('rcash')) {
            currencies.add('rcash');
            changed = true;
          }
          continue;
        }
        if (
          e.kind === 'HARVEST_YIELD' ||
          e.kind === 'HARVEST_BONUS' ||
          e.kind === 'HARVEST_QUALITY_TIER' ||
          e.kind === 'CREATURE_DROP' ||
          e.kind === 'SIDE_BOSS_UNIQUE_DROP' ||
          e.kind === 'ELDER_STONE_DROP' ||
          e.kind === 'LOOT_STATIC_FIXED' ||
          e.kind === 'LOOT_ECOLOGY_POOL' ||
          e.kind === 'CREATOR_LOOT_UNIQUE' ||
          e.kind === 'AIRDROP_DROP' ||
          e.kind === 'JOURNEY_REQUISITION' ||
          e.kind === 'CASH_CHEST_MINT'
        ) {
          if (e.to.startsWith('item:')) {
            const k = e.to.slice(5);
            if (!items.has(k)) {
              items.add(k);
              changed = true;
            }
          } else if (e.to.startsWith('blueprint:')) {
            const rk = e.to.slice(10);
            if (!knownRecipes.has(rk)) {
              knownRecipes.add(rk);
              changed = true;
            }
          } else if (e.to.startsWith('currency:')) {
            const ck = e.to.slice(9);
            if (!currencies.has(ck)) {
              currencies.add(ck);
              changed = true;
            }
          }
        }
        if (e.kind === 'CRAFT_OUTPUT' && e.from === 'item:spares' && e.to === 'currency:spares' && items.has('spares')) {
          if (!currencies.has('spares')) {
            currencies.add('spares');
            changed = true;
          }
        }
        if (e.kind === 'VENDOR_TRADE_SPARES' && e.to.startsWith('item:') && currencies.has('spares')) {
          const k = e.to.slice(5);
          if (!items.has(k)) {
            items.add(k);
            changed = true;
          }
        }
        if (e.kind === 'VENDOR_TRADE_SECURED' && e.to.startsWith('item:') && currencies.has('secured_cash')) {
          const k = e.to.slice(5);
          if (!items.has(k)) {
            items.add(k);
            changed = true;
          }
        }
        if (e.kind === 'ESCROW_PURCHASE' && e.to === 'item:escrow_chest' && currencies.has('rcash')) {
          if (!items.has('escrow_chest')) {
            items.add('escrow_chest');
            changed = true;
          }
        }
        if (e.kind === 'RESEARCH_RANDOM' && e.to.startsWith('recipe:') && currencies.has('spares')) {
          const rk = e.to.slice(7);
          if (!knownRecipes.has(rk)) {
            knownRecipes.add(rk);
            changed = true;
          }
        }
        if (e.kind === 'RESEARCH_SPECIMEN' && e.from.startsWith('item:') && e.to.startsWith('recipe:')) {
          const ik = e.from.slice(5);
          const rk = e.to.slice(7);
          if (items.has(ik) && !knownRecipes.has(rk)) {
            knownRecipes.add(rk);
            changed = true;
          }
        }
        if (e.kind === 'HUSBANDRY_RENEWABLE_YIELD' || e.kind === 'HUSBANDRY_BUTCHER') {
          const sp = e.from.slice('husbandry:'.length);
          const tameableFoods = TAMING_SPECIES[sp]?.preferredFoods ?? [];
          if (tameableFoods.some((f) => items.has(f)) && e.to.startsWith('item:')) {
            const k = e.to.slice(5);
            if (!items.has(k)) {
              items.add(k);
              changed = true;
            }
          }
        }
        if (e.kind === 'CORE_CAST_OUTPUT' && e.from.startsWith('item:') && e.to.startsWith('item:')) {
          if (items.has(e.from.slice(5)) && items.has('energy_refined') && !items.has(e.to.slice(5))) {
            items.add(e.to.slice(5));
            changed = true;
          }
        }
        if (e.kind === 'RECYCLE_OUTPUT' && e.from.startsWith('recipe:recycler:')) {
          const compSnap = componentRuleSnapshot();
          const parts = e.from.split(':');
          let srcItem: string | undefined;
          if (parts[2] === 'component') {
            const recipeKey = parts.slice(3).join(':');
            srcItem = recipeKey === 'X:drive' ? 'damaged_drive' : compSnap[recipeKey]?.key;
          } else {
            srcItem = parts[2];
          }
          if (srcItem && items.has(srcItem) && e.to.startsWith('item:')) {
            const k = e.to.slice(5);
            if (!items.has(k)) {
              items.add(k);
              changed = true;
            }
          }
        }
      }

      // Check garden + craft recipes
      for (const [gk, gDef] of Object.entries(GARDEN_CROPS)) {
        if (gDef.inputs.every(([k]) => items.has(k))) {
          for (const [outK] of gDef.output) {
            if (!items.has(outK)) {
              items.add(outK);
              changed = true;
            }
          }
        }
        void gk;
      }
      for (const [rKey, rDef] of Object.entries(RECIPES)) {
        if (!knownRecipes.has(rKey)) continue;
        const allowed = activeEdges.some((e) => e.kind === 'CRAFT_OUTPUT' && e.from === `recipe:${rKey}`);
        if (!allowed) continue;
        if (rDef.ins.every(([inK]) => items.has(inK))) {
          const outs = rDef.outs ?? [[rDef.out, rDef.qty]];
          for (const [outK] of outs) {
            if (!items.has(outK)) {
              items.add(outK);
              changed = true;
            }
          }
        }
      }
    }

    const craftableRecipes = new Set<string>();
    for (const [rKey, rDef] of Object.entries(RECIPES)) {
      const allowed = activeEdges.some((e) => e.kind === 'CRAFT_OUTPUT' && e.from === `recipe:${rKey}`);
      if (allowed && knownRecipes.has(rKey) && rDef.ins.every(([inK]) => items.has(inK))) {
        craftableRecipes.add(rKey);
      }
    }

    return { items, craftableRecipes };
  };

  const shipRes = solveReachable(isShippingEdge);
  const veyraRes = solveReachable(isVeyraEdge);

  const itemsWithoutNonWipeSink: string[] = [];
  for (const itemKey of allItems) {
    const outEdges = edges.filter((e) => e.from === `item:${itemKey}` && e.kind !== 'RUN_WIPE_SINK');
    if (outEdges.length === 0) itemsWithoutNonWipeSink.push(itemKey);
  }

  return {
    shippingReachableItems: allItems.filter((k) => shipRes.items.has(k)),
    shippingUnreachableItems: allItems.filter((k) => !shipRes.items.has(k)),
    veyraReachableItems: allItems.filter((k) => veyraRes.items.has(k)),
    veyraUnreachableItems: allItems.filter((k) => !veyraRes.items.has(k)),
    shippingUncraftableRecipes: Object.keys(RECIPES).filter((k) => !shipRes.craftableRecipes.has(k)).sort(),
    veyraUncraftableRecipes: Object.keys(RECIPES).filter((k) => !veyraRes.craftableRecipes.has(k)).sort(),
    itemsWithoutNonWipeSink,
    shippingOnlySystems: nodes.filter((n) => n.runtimeStatus === 'LIVE_SHIPPING_ONLY').map((n) => n.id),
    veyraOnlySystems: nodes.filter((n) => n.runtimeStatus === 'LIVE_VEYRA_ONLY').map((n) => n.id),
    testFixtureOnlyChains: nodes.filter((n) => n.runtimeStatus === 'TEST_FIXTURE_ONLY').map((n) => n.id),
  };
}

function buildGates(): Record<string, EconGate> {
  const list: EconGate[] = [
    { id: 'gate:wb_l1', kind: 'station', layerScope: 'shared', rule: 'Requires built Workbench level >= 1', codeRef: 'catalog.ts:requiredStationLevel' },
    { id: 'gate:wb_l2', kind: 'station', layerScope: 'shared', rule: 'Requires upgraded Workbench level >= 2', codeRef: 'catalog.ts:WORKBENCH_UPGRADE' },
    { id: 'gate:wb_l3', kind: 'station', layerScope: 'shared', rule: 'Requires upgraded Workbench level >= 3', codeRef: 'catalog.ts:WORKBENCH_UPGRADE_III' },
    { id: 'gate:wb_industrial', kind: 'station', layerScope: 'shared', rule: 'Requires Industrial Module + active wire-v1 power', codeRef: 'catalog.ts:INDUSTRIAL_MODULE' },
    { id: 'gate:station_campfire', kind: 'station', layerScope: 'shared', rule: 'Requires Campfire + fuel', codeRef: 'catalog.ts:STRUCTS.campfire' },
    { id: 'gate:station_furnace', kind: 'station', layerScope: 'shared', rule: 'Requires Furnace + fuel', codeRef: 'catalog.ts:STRUCTS.furnace' },
    { id: 'gate:station_refinery', kind: 'station', layerScope: 'shared', rule: 'Requires Oil Refinery near L2 Workbench + fuel', codeRef: 'catalog.ts:STRUCTS.refinery' },
    { id: 'gate:station_research', kind: 'station', layerScope: 'shared', rule: 'Requires Research Table', codeRef: 'catalog.ts:STRUCTS.research' },
    { id: 'gate:station_fuel_non_canister', kind: 'policy', layerScope: 'shared', rule: 'stationBurnable(): burns fuel items EXCEPT fuel_can', codeRef: 'catalog.ts:stationBurnable' },
    { id: 'gate:knowledge_run_local', kind: 'knowledge', layerScope: 'shared', rule: 'Recipe must exist in r.knowledge.recipes (run-local)', codeRef: 'catalog.ts:isRecipeKnown' },
    { id: 'gate:directed_research_tier_lt_3', kind: 'knowledge', layerScope: 'shared', rule: 'permitsDirectedResearch(r): only recipe.tier < 3 eligible for 9-Spares directed research', codeRef: 'catalog.ts:permitsDirectedResearch' },
    { id: 'gate:creator_loot_v1', kind: 'layout', layerScope: 'shipping', rule: 'Enabled only on shipping_fresh / dev_delta_fresh; absent on Veyra', codeRef: 'engine.ts:190' },
    { id: 'gate:loot_ecology_w06', kind: 'layout', layerScope: 'shipping', rule: 'Enabled only on shipping_fresh / dev_delta_fresh; absent on Veyra', codeRef: 'engine.ts:190' },
    { id: 'gate:airdrop_v1', kind: 'layout', layerScope: 'shipping', rule: 'supportsAirdrops() allows shipping_fresh / dev_delta_fresh only', codeRef: 'airdrop.ts:supportsAirdrops' },
    { id: 'gate:recycler_site', kind: 'layout', layerScope: 'shared', rule: 'webRecyclerSite() authorizes Foundry Yard on shipping_fresh/dev_delta_fresh and VEYRA_RECYCLER_SITE (po_slag) on isVeyra05Layout (null on legacy static Veyra layouts)', codeRef: 'world.ts:webRecyclerSite' },
    { id: 'gate:oil_test_fixture', kind: 'fixture', layerScope: 'test_fixture', rule: 'Requires r.oilTestFixture === true with authority test-fixture-v1', codeRef: 'engine.ts:1414' },
    { id: 'gate:poi_keycard', kind: 'poi_access', layerScope: 'shipping', rule: 'Requires physical keycard (3 charges); absent from Veyra loot tables', codeRef: 'engine.ts:poiAccess' },
    { id: 'gate:poi_power', kind: 'poi_access', layerScope: 'shipping', rule: 'Requires POI generator + fuel_can (180s runtime); absent from Veyra POIs', codeRef: 'engine.ts:poiAccess' },
    { id: 'gate:veyra_spawner', kind: 'spawner', layerScope: 'veyra05', rule: 'Veyra ecosystem spawns 9 ordinary + 5 wildlife + 4 side bosses + 6 Primordials (excludes wolf/toad/crawler/beetle/crab)', codeRef: 'veyra05/ecosystem.ts' },
    { id: 'gate:shipping_spawner', kind: 'spawner', layerScope: 'shipping', rule: 'Shipping biome spawner spawns boar/wolf/toad/crawler/beetle/crab + 6 legacy Elders', codeRef: 'sim.ts:trySpawnCreature' },
    { id: 'gate:claim_2_limit', kind: 'policy', layerScope: 'shared', rule: 'Max 2 claims, radius 25 tiles, >=10 tiles from POIs, 25%/24h upkeep', codeRef: 'balance.v1.json:economy' },
    { id: 'gate:base_power_wire_v1', kind: 'policy', layerScope: 'shared', rule: 'Requires orthogonal wire-v1 cable path from fueled base_generator', codeRef: 'engine.ts:wireReachable' },
    { id: 'gate:escrow_cash_only', kind: 'policy', layerScope: 'shared', rule: 'LOCKED_CANON cash-only escrow; converts rcash -> securedCash', codeRef: 'engine.ts:deposit' },
    { id: 'gate:ragnarok_final_72h', kind: 'lifecycle', layerScope: 'shared', rule: 'Final 72h (hour 264..336): suppresses creature rcash drops & boosts threats 1.6x', codeRef: 'engine.ts:isRagnarok' },
    { id: 'gate:run_wipe_336h', kind: 'lifecycle', layerScope: 'shared', rule: '336h maxRunHours wipe clears all run-local inventory/structures/knowledge', codeRef: 'engine.ts:settle' },
  ];
  return Object.fromEntries(list.map((g) => [g.id, g]));
}

export function validateEconomicGraph(graph: SohEconomicGraph): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  for (const n of graph.nodes) {
    if (!n.id) errors.push('Node missing id');
    if (nodeIds.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
    nodeIds.add(n.id);
  }
  const edgeIds = new Set<string>();
  for (const e of graph.edges) {
    if (!e.id) errors.push('Edge missing id');
    if (edgeIds.has(e.id)) errors.push(`Duplicate edge id: ${e.id}`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from)) errors.push(`Edge ${e.id} dangling from: ${e.from}`);
    if (!nodeIds.has(e.to)) errors.push(`Edge ${e.id} dangling to: ${e.to}`);
    for (const gId of e.gateIds) {
      if (!graph.gates[gId]) errors.push(`Edge ${e.id} unknown gate: ${gId}`);
    }
  }
  for (const itemKey of Object.keys(ITEMS)) {
    if (!nodeIds.has(`item:${itemKey}`)) errors.push(`Missing item node: ${itemKey}`);
  }
  for (const srcKey of Object.keys(SOURCES)) {
    if (!nodeIds.has(`world_source:${srcKey}`)) errors.push(`Missing world_source node: ${srcKey}`);
  }
  for (const recKey of Object.keys(RECIPES)) {
    if (!nodeIds.has(`recipe:${recKey}`)) errors.push(`Missing recipe node: ${recKey}`);
  }
  for (const structKey of Object.keys(STRUCTS)) {
    if (!nodeIds.has(`structure:${structKey}`)) errors.push(`Missing structure node: ${structKey}`);
  }
  for (const cKey of Object.keys(CREATURES)) {
    if (!nodeIds.has(`creature:${cKey}`)) errors.push(`Missing creature node: ${cKey}`);
  }
  for (const eKey of Object.keys(ELDERS)) {
    if (!nodeIds.has(`elder:legacy:${eKey}`)) errors.push(`Missing legacy elder node: ${eKey}`);
  }
  for (const pKey of Object.keys(PRIMORDIAL_ELDERS)) {
    if (!nodeIds.has(`elder:primordial:${pKey}`)) errors.push(`Missing primordial elder node: ${pKey}`);
  }
  return errors;
}
