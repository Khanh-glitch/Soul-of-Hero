// ARENA 1 — FINAL ITEM SET RUNTIME REGISTRY (Bible §0.2a, Creator 2026-11-15).
//
// One authority for "is this id part of a new run?". The roster itself is the design file
// `web/ref/last-island-copy-first/FINAL_THREE_GROUP_ITEM_SET_20261115.json`; the table below is a
// verbatim projection of its `final_items`, pinned by `tests/final-item-set.test.ts` so the two can
// never drift apart silently. This module imports NOTHING from the catalog (the catalog, the engine
// and the save loader all import it), and it never decides balance: stats live in `catalog.ts`.
//
// What "retired" means here, precisely:
//   LIVE     the id can no longer be minted in ANY run. Every stack is created through `mkStack`,
//            which resolves the id through `liveItemId`; an old save is converted once on load
//            (`persist.validate`), with a counter in `run.migrated.retiredItems`. The catalog row is
//            kept ONLY so frozen legacy recipes, old loot-table signatures and old saves still parse.
//   PENDING  the roster orders it retired, but its consumers (recipes, structure costs, sources)
//            have not been rewired yet. It is still issued. It is NOT counted as done anywhere.
export type FinalGroup = 'A' | 'B' | 'C';
export type FinalOrigin = 'SOH_CURRENT' | 'LI_IMPORTED' | 'STRUCT_PACK' | 'SOH_APPROVED_DESIGN_NEW';
/** Save-level stamp. 1 (or absent) = written before the final item set; 2 = this cutover. */
export const ITEM_SET_VERSION = 2;

/** id -> [group, origin, Last Island id it stands for (when the roster names one)]. */
export const FINAL_ITEMS: Readonly<Record<string, readonly [FinalGroup, FinalOrigin, string?]>> = Object.freeze({
  energy_basic: ['B', 'SOH_CURRENT'],
  energy_refined: ['B', 'SOH_CURRENT'],
  essence_fire: ['B', 'SOH_CURRENT'],
  essence_nature: ['B', 'SOH_CURRENT'],
  essence_water: ['B', 'SOH_CURRENT'],
  essence_spirit: ['B', 'SOH_CURRENT'],
  core_blast: ['B', 'SOH_CURRENT'],
  core_meteor: ['B', 'SOH_CURRENT'],
  core_dragon: ['B', 'SOH_CURRENT'],
  core_elsa: ['B', 'SOH_CURRENT'],
  core_earthmother: ['B', 'SOH_CURRENT'],
  core_mjolnir: ['B', 'SOH_CURRENT'],
  core_demon: ['B', 'SOH_CURRENT'],
  crude_petroleum: ['A', 'SOH_CURRENT', 'crude_oil'],
  trail_pack: ['B', 'SOH_CURRENT'],
  trail_canteen: ['B', 'SOH_CURRENT'],
  wood: ['A', 'SOH_CURRENT', 'wood'],
  plank: ['B', 'SOH_CURRENT'],
  stone: ['A', 'SOH_CURRENT'],
  fiber: ['B', 'SOH_CURRENT'],
  iron_ore: ['A', 'SOH_CURRENT', 'raw_iron_ore'],
  rich_iron_ore: ['A', 'SOH_CURRENT', 'refined_iron_ore'],
  charcoal: ['A', 'SOH_CURRENT', 'charcoal'],
  crystal: ['B', 'SOH_CURRENT'],
  sulfur: ['B', 'SOH_CURRENT'],
  spares: ['A', 'SOH_CURRENT', 'parts'],
  iron_ingot: ['A', 'SOH_CURRENT', 'iron_ingot'],
  rope: ['A', 'SOH_CURRENT', 'rope'],
  hide: ['A', 'SOH_CURRENT', 'animal_hide'],
  leather: ['B', 'SOH_CURRENT'],
  fur: ['C', 'SOH_CURRENT'],
  chitin: ['C', 'SOH_CURRENT'],
  shell: ['C', 'SOH_CURRENT'],
  gland: ['C', 'SOH_CURRENT'],
  cloth: ['A', 'SOH_CURRENT', 'cloth'],
  glass: ['B', 'SOH_CURRENT'],
  berries: ['A', 'SOH_CURRENT', 'wild_berry'],
  meat: ['A', 'SOH_CURRENT', 'animal_meat'],
  cooked_meat: ['A', 'SOH_CURRENT'],
  mushroom: ['A', 'SOH_CURRENT', 'mushroom'],
  herb: ['C', 'SOH_CURRENT'],
  crop: ['C', 'SOH_CURRENT'],
  stew: ['C', 'SOH_CURRENT'],
  water_flask: ['B', 'SOH_CURRENT'],
  bandage: ['A', 'SOH_CURRENT', 'bandage'],
  medkit: ['A', 'SOH_CURRENT', 'medkit'],
  antirad: ['B', 'SOH_CURRENT'],
  knife: ['B', 'SOH_CURRENT'],
  stone_axe: ['A', 'SOH_CURRENT'],
  stone_pick: ['B', 'SOH_CURRENT'],
  iron_axe: ['A', 'SOH_CURRENT', 'iron_axe'],
  iron_pick: ['B', 'SOH_CURRENT'],
  industrial_pick: ['B', 'SOH_CURRENT'],
  industrial_axe: ['A', 'SOH_CURRENT', 'refined_iron_axe'],
  wood_spear: ['B', 'SOH_CURRENT'],
  bow: ['B', 'SOH_CURRENT'],
  reinforced_spear: ['B', 'SOH_CURRENT'],
  arrow: ['B', 'SOH_CURRENT'],
  torch: ['A', 'SOH_CURRENT'],
  leather_armor: ['B', 'SOH_CURRENT'],
  chitin_armor: ['C', 'SOH_CURRENT'],
  fur_cloak: ['C', 'SOH_CURRENT'],
  gas_mask: ['A', 'SOH_CURRENT'],
  scrap_helm: ['B', 'SOH_CURRENT'],
  core_fire: ['B', 'SOH_CURRENT'],
  core_earth: ['B', 'SOH_CURRENT'],
  core_storm: ['B', 'SOH_CURRENT'],
  core_frost: ['B', 'SOH_CURRENT'],
  blueprint: ['A', 'SOH_CURRENT'],
  wolf_fang: ['C', 'SOH_CURRENT'],
  crawler_optic: ['C', 'SOH_CURRENT'],
  boar_tusk: ['C', 'SOH_CURRENT'],
  beetle_horn: ['C', 'SOH_CURRENT'],
  fuel_can: ['A', 'SOH_CURRENT', 'low_quality_fuel'],
  rcash: ['C', 'SOH_CURRENT'],
  escrow_chest: ['C', 'SOH_CURRENT'],
  vehicle_frame: ['A', 'SOH_CURRENT', 'vehicle_frame'],
  refined_iron_ingot: ['A', 'SOH_CURRENT', 'refined_iron_ingot'],
  metal_pipe: ['A', 'SOH_CURRENT', 'metal_pipe'],
  metal_blade: ['A', 'SOH_CURRENT', 'metal_blade'],
  mechanical_gear: ['A', 'SOH_CURRENT', 'mechanical_gear'],
  iron_plate: ['A', 'SOH_CURRENT', 'iron_plate'],
  motorbike_kit: ['A', 'SOH_CURRENT', 'motorcycle'],
  cart_kit: ['C', 'SOH_CURRENT'],
  stone_surtur: ['C', 'SOH_CURRENT'],
  stone_typhon: ['C', 'SOH_CURRENT'],
  stone_aion: ['C', 'SOH_CURRENT'],
  stone_atlas: ['C', 'SOH_CURRENT'],
  stone_argus: ['C', 'SOH_CURRENT'],
  stone_anubis: ['C', 'SOH_CURRENT'],
  lead_rope: ['C', 'SOH_CURRENT'],
  animal_feed: ['C', 'SOH_CURRENT'],
  feather: ['C', 'SOH_CURRENT'],
  grouse_egg: ['C', 'SOH_CURRENT'],
  relic_shaleheart: ['C', 'SOH_CURRENT'],
  ronin_nodachi: ['C', 'SOH_CURRENT'],
  tidemarshal_trident: ['C', 'SOH_CURRENT'],
  custodian_lantern: ['C', 'SOH_CURRENT'],
  animal_fat: ['A', 'LI_IMPORTED', 'animal_fat'],
  blue_card: ['A', 'LI_IMPORTED', 'blue_card'],
  canned_meat: ['A', 'LI_IMPORTED', 'canned_meat'],
  cleaver: ['A', 'LI_IMPORTED', 'cleaver'],
  dried_meat: ['A', 'LI_IMPORTED', 'dried_meat'],
  electric_resistor: ['A', 'LI_IMPORTED', 'electric_resistor'],
  electronic_parts: ['A', 'LI_IMPORTED', 'electronic_parts'],
  fruit_juice: ['A', 'LI_IMPORTED', 'fruit_juice'],
  fruit_wine: ['A', 'LI_IMPORTED', 'fruit_wine'],
  green_card: ['A', 'LI_IMPORTED', 'green_card'],
  grilled_mushroom: ['A', 'LI_IMPORTED', 'grilled_mushroom'],
  iron_plate_boots: ['A', 'LI_IMPORTED', 'iron_plate_boots'],
  iron_plate_chest: ['A', 'LI_IMPORTED', 'iron_plate_chest'],
  iron_plate_helmet: ['A', 'LI_IMPORTED', 'iron_plate_helmet'],
  iron_plate_pants: ['A', 'LI_IMPORTED', 'iron_plate_pants'],
  jam: ['A', 'LI_IMPORTED', 'jam'],
  large_furnace: ['A', 'LI_IMPORTED', 'large_furnace'],
  machete: ['A', 'LI_IMPORTED', 'machete'],
  mushroom_soup: ['A', 'LI_IMPORTED', 'mushroom_soup'],
  needle_thread: ['A', 'LI_IMPORTED', 'needle_thread'],
  needle_tube: ['A', 'LI_IMPORTED', 'needle_tube'],
  purple_card: ['A', 'LI_IMPORTED', 'purple_card'],
  refined_iron_boots: ['A', 'LI_IMPORTED', 'refined_iron_boots'],
  refined_iron_chest: ['A', 'LI_IMPORTED', 'refined_iron_chest'],
  refined_iron_helmet: ['A', 'LI_IMPORTED', 'refined_iron_helmet'],
  refined_iron_legs: ['A', 'LI_IMPORTED', 'refined_iron_legs'],
  steel_folding_ladder: ['A', 'LI_IMPORTED', 'steel_folding_ladder'],
  syringe: ['A', 'LI_IMPORTED', 'syringe'],
  tin_can: ['A', 'LI_IMPORTED', 'tin_can'],
  wood_club: ['A', 'LI_IMPORTED', 'wood_club'],
  wooden_ladder: ['A', 'LI_IMPORTED', 'wooden_ladder'],
  deploy_bed_straw: ['A', 'STRUCT_PACK'],
  deploy_chest_small: ['A', 'STRUCT_PACK'],
  deploy_chest_large: ['A', 'STRUCT_PACK'],
  deploy_campfire: ['A', 'STRUCT_PACK'],
  deploy_furnace: ['A', 'STRUCT_PACK'],
  deploy_oil_pump: ['A', 'STRUCT_PACK'],
  deploy_refinery: ['A', 'STRUCT_PACK', 'oil_refinery'],
  deploy_workbench: ['A', 'STRUCT_PACK'],
  deploy_base_generator: ['A', 'STRUCT_PACK', 'fuel_generator'],
  deploy_power_cable: ['A', 'STRUCT_PACK'],
  deploy_power_switch: ['A', 'STRUCT_PACK', 'switch'],
  deploy_pressure_switch: ['A', 'STRUCT_PACK', 'pressure_switch'],
  deploy_ir_sensor: ['A', 'STRUCT_PACK', 'infrared_switch'],
  deploy_bear_trap: ['A', 'STRUCT_PACK', 'bear_trap'],
  deploy_spikes: ['A', 'STRUCT_PACK', 'wood_spikes'],
  deploy_barricade: ['A', 'STRUCT_PACK'],
  deploy_claim: ['B', 'STRUCT_PACK', 'territory_cabinet'],
  deploy_research: ['B', 'STRUCT_PACK', 'drawing_bench'],
  deploy_arrow_turret: ['B', 'STRUCT_PACK', 'auto_rifle_turret'],
  deploy_torch_post: ['B', 'STRUCT_PACK'],
  deploy_garden: ['C', 'STRUCT_PACK'],
  deploy_farm_controller: ['C', 'STRUCT_PACK'],
  deploy_barrel: ['C', 'STRUCT_PACK'],
  deploy_feed_trough: ['C', 'STRUCT_PACK'],
  door_powered: ['B', 'SOH_APPROVED_DESIGN_NEW', 'electric_door'],
  seed_sunroot: ['C', 'SOH_APPROVED_DESIGN_NEW'],
  seed_bitterleaf: ['C', 'SOH_APPROVED_DESIGN_NEW'],
  seed_wildberry: ['C', 'SOH_APPROVED_DESIGN_NEW'],
});
export const FINAL_ITEM_IDS: readonly string[] = Object.freeze(Object.keys(FINAL_ITEMS));
export const isFinalItem = (id: string): boolean => Object.prototype.hasOwnProperty.call(FINAL_ITEMS, id);

export type Retirement = {
  /** LIVE = enforced at the single minting choke point; PENDING = ordered, not yet rewired. */
  stage: 'LIVE' | 'PENDING';
  /** 1:1 successor a LIVE id resolves to. Always 1:1 so a stack, its uid and its count survive;
   *  a successor must be able to hold the old stack (`max` >= old `max`, checked by test). */
  to?: string;
  /** Roster reason (design file), shortened. */
  why: string;
  /** What still has to change before a PENDING id can go LIVE. */
  blockedBy?: string;
};
export const ITEM_RETIREMENT: Readonly<Record<string, Retirement>> = Object.freeze({
  // ---- LIVE in item set v2 ----
  seed: { stage: 'LIVE', to: 'seed_sunroot', why: 'Generic Wild Seeds replaced by three named cultivars; an old generic seed was planted as Sunroot by default, so it becomes a Sunroot seed.' },
  iron_sword: { stage: 'LIVE', to: 'machete', why: 'LI Machete is the iron long blade; SOH keeps Knife and Spear as the non-LI melee shapes.' },
  vehicle_drive: { stage: 'LIVE', to: 'mechanical_gear', why: 'LI motorcycle is Frame + Gear + Plates; no intermediate Motor Drive. One drive held at least one gear of value.' },
  root_broth: { stage: 'LIVE', to: 'mushroom_soup', why: 'LI Mushroom Soup is the warm bowl; Root Stew stays as the SOH cold-weather meal.' },
  herb_roast: { stage: 'LIVE', to: 'cooked_meat', why: 'Duplicate of the LI cooked-meat role.' },
  salted_meat: { stage: 'LIVE', to: 'dried_meat', why: 'LI Dried / Canned Meat carry preservation; no separate salt chain.' },
  fuel_briquette: { stage: 'LIVE', to: 'charcoal', why: 'No extra solid-fuel tier above LI wood / charcoal / low-quality fuel.' },
  // ---- PENDING: ordered by the roster, consumers not rewired in this revision ----
  salvaged_oil: { stage: 'PENDING', why: 'Merge into LI Crude Oil.', blockedBy: 'refine_salvaged_oil route + wreck oil channel + crude_petroleum has no live Veyra oil site' },
  lubricant: { stage: 'PENDING', why: 'No separate vehicle-maintenance material.', blockedBy: 'refinery co-product table in balance.v1.json and motorbike upkeep read it' },
  damaged_drive: { stage: 'PENDING', why: 'Recycler takes LI machine items directly.', blockedBy: 'recycler plans + wreck bonus table' },
  mechanical_parts: { stage: 'PENDING', why: 'Return consumers to LI Mechanical Gear / Parts / Electronic Parts.', blockedBy: '25 catalog consumers incl. bench upgrades, tool repairs, Core recipes' },
  fasteners: { stage: 'PENDING', why: 'No LI source; return to Needle Thread / Gear / Iron Plate per case.', blockedBy: '16 catalog consumers incl. wire hardware and bench III' },
  treated_canvas: { stage: 'PENDING', why: 'Packs and canteens must not need a non-LI treated cloth.', blockedBy: 'trail_pack / trail_canteen recipes + raw_salt' },
  field_repair_kit: { stage: 'PENDING', why: 'Repair with stations and real materials.', blockedBy: 'field repair action in engine + wreck / cache loot' },
  coal: { stage: 'PENDING', why: 'LI industrial heat uses wood / charcoal / fuel.', blockedBy: 'Coal Seam nodes are placed on the map (source digest) + refined-iron and essence recipes' },
  raw_salt: { stage: 'PENDING', why: 'No SOH salt chain.', blockedBy: 'Salt Shale nodes on the map + Tidemarshal drop + trident repair' },
  scrap: { stage: 'PENDING', why: 'LI Parts for R&D; metal recovered through LI sources.', blockedBy: 'Roadside Scrap / Car Wreck yields, 12 recipes, knife repair, creature drops' },
  brick: { stage: 'PENDING', why: 'House tiers use LI Stone / Iron.', blockedBy: 'wall_brick tier belongs to PR #56 (Building); furnace lining upgrade' },
  keycard: { stage: 'PENDING', why: 'Return to LI Green / Blue / Purple cards.', blockedBy: 'poi-access door contract is single-class; no Veyra door declares a card colour yet' },
});
export const RETIRED_ITEM_IDS: readonly string[] = Object.freeze(["salvaged_oil", "lubricant", "damaged_drive", "mechanical_parts", "fasteners", "treated_canvas", "field_repair_kit", "fuel_briquette", "coal", "raw_salt", "root_broth", "herb_roast", "salted_meat", "scrap", "brick", "seed", "iron_sword", "keycard", "vehicle_drive"]);
/** Old-schema Elder stones. Their migration is the existing Elder schema v1 -> v2 path in `persist.ts`. */
export const LEGACY_STONE_IDS: readonly string[] = Object.freeze(["stone_frost", "stone_magma", "stone_bog", "stone_grove", "stone_tide", "stone_rust"]);

export const isRetiredLive = (id: string): boolean => ITEM_RETIREMENT[id]?.stage === 'LIVE';
/** The id a stack of `id` must be minted as. Identity for everything that is not LIVE-retired. */
export function liveItemId(id: string): string {
  const r = ITEM_RETIREMENT[id];
  return r && r.stage === 'LIVE' && r.to ? r.to : id;
}

/** Recipe ids whose OUTPUT was retired, and the live formula a paper naming the old one now teaches.
 *  `null` = the knowledge is simply dropped (no successor formula exists). */
export const RECIPE_SUCCESSOR: Readonly<Record<string, string | null>> = Object.freeze({
  iron_sword: 'machete', iron_sword_blade: 'machete',
  root_broth: 'mushroom_soup', poached_eggs: null, herb_roast: null, salted_meat: 'dried_meat',
  fuel_briquette: null, vehicle_drive: null, vehicle_drive_geared: null,
});
export function liveRecipeId(id: string): string | null {
  return Object.prototype.hasOwnProperty.call(RECIPE_SUCCESSOR, id) ? RECIPE_SUCCESSOR[id] : id;
}
