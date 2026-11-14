/**
 * Item Ontology V2 — player-facing material class (Group A: display grouping only, no mechanics).
 *
 * `ItemDef.cat` puts 60+ unrelated things under one `res` bucket, so the inventory chip said
 * "MATERIAL" for wood, Parts, a Mechanical Gear and Fire Essence alike. This table splits that one
 * bucket into the classes a new survivor has to tell apart at a glance. It changes NO id, recipe,
 * source or stack rule; `cat` is untouched and still drives every runtime branch.
 *
 * Single source: the inventory chip, the ontology manifest `role` column and the HTML explorer all
 * read `itemClass()`. `tests/item-ontology-v2.test.ts` proves every `res` item is classified and that
 * each class agrees with what the economic multigraph says about the item's real sources.
 */
import { ITEMS } from './catalog';

export type ItemClass =
  | 'NATURAL' | 'ORE' | 'SALVAGE' | 'PARTS' | 'METAL' | 'COMPONENT' | 'PROCESSED' | 'ANIMAL'
  | 'FARM' | 'ENERGY' | 'SPECIMEN' | 'AMMO' | 'FUEL' | 'KEY'
  | 'FOOD' | 'MEDICAL' | 'TOOL' | 'WEAPON' | 'ARMOR' | 'CREATOR_CORE' | 'FIELD_CORE' | 'KIT' | 'DEVICE' | 'BLUEPRINT' | 'CASH' | 'ELDER_STONE';

/** Short chip text. Kept as plain English like the existing CAT_LABEL table it refines. */
export const ITEM_CLASS_LABEL: Record<ItemClass, string> = {
  NATURAL: 'NATURAL', ORE: 'ORE', SALVAGE: 'SALVAGE', PARTS: 'PARTS', METAL: 'METAL', COMPONENT: 'COMPONENT',
  PROCESSED: 'PROCESSED', ANIMAL: 'ANIMAL', FARM: 'FARM', ENERGY: 'CORE ENERGY', SPECIMEN: 'SPECIMEN', AMMO: 'AMMO',
  FUEL: 'FUEL', KEY: 'KEY', FOOD: 'FOOD', MEDICAL: 'MEDICAL', TOOL: 'TOOL', WEAPON: 'WEAPON', ARMOR: 'ARMOR',
  CREATOR_CORE: 'CREATOR CORE', FIELD_CORE: 'FIELD CORE', KIT: 'KIT', DEVICE: 'DEVICE', BLUEPRINT: 'BLUEPRINT', CASH: 'CASH', ELDER_STONE: 'ELDER STONE',
};

/** One-line meaning shown in the explorer legend (and usable as a tooltip). */
export const ITEM_CLASS_MEANING: Record<ItemClass, string> = {
  NATURAL: 'Gathered from living terrain: trees, boulders, grass.',
  ORE: 'Mined from a mineral node; feeds the furnace, Cores or fuel.',
  SALVAGE: 'Pulled from wrecks and roadside scrap; raw industrial input.',
  PARTS: 'Backbone progression resource: found or recovered, never crafted; pays for research, trade and technology.',
  METAL: 'Furnace metal: basic and refined ingots.',
  COMPONENT: 'Manufactured part with a specific technical job (gear, pipe, plate, blade, frame).',
  PROCESSED: 'Simple processed material: one step from a natural input.',
  ANIMAL: 'Animal product from hunting or husbandry.',
  FARM: 'Farming and livestock input.',
  ENERGY: 'Creator Core ammunition and Signature essence.',
  SPECIMEN: 'Study sample: destroyed at a Research Table to learn one recipe.',
  AMMO: 'Ammunition.', FUEL: 'Liquid fuel for generators and vehicles.', KEY: 'Access credential.',
  FOOD: 'Eaten or drunk.', MEDICAL: 'Heals or cures.', TOOL: 'Tool.', WEAPON: 'Weapon.', ARMOR: 'Worn equipment.',
  CREATOR_CORE: 'Creator Core: three skills (LMB / hold Q / hold E), reloaded from Basic, Refined and Signature energy reserves.',
  FIELD_CORE: 'Field Core (Lõi dã chiến): one ability on LMB, spent from a small fixed charge count. No energy reserves and no reload.',
  KIT: 'Packed kit.', DEVICE: 'Packed physical device; place it to use it.',
  BLUEPRINT: 'Recipe paper.', CASH: 'Ragnarok currency.', ELDER_STONE: 'Elder stone, unique per run.',
};

/** Every `cat: 'res'` item, explicitly. A new `res` item with no row fails the ontology test. */
export const RES_ITEM_CLASS: Readonly<Record<string, ItemClass>> = Object.freeze({
  wood: 'NATURAL', stone: 'NATURAL', fiber: 'NATURAL',
  iron_ore: 'ORE', rich_iron_ore: 'ORE', coal: 'ORE', crystal: 'ORE', raw_salt: 'ORE', sulfur: 'ORE',
  scrap: 'SALVAGE', damaged_drive: 'SALVAGE', salvaged_oil: 'SALVAGE', crude_petroleum: 'SALVAGE',
  spares: 'PARTS',
  iron_ingot: 'METAL', refined_iron_ingot: 'METAL',
  mechanical_parts: 'COMPONENT', fasteners: 'COMPONENT', metal_pipe: 'COMPONENT', metal_blade: 'COMPONENT',
  mechanical_gear: 'COMPONENT', iron_plate: 'COMPONENT', vehicle_frame: 'COMPONENT', vehicle_drive: 'COMPONENT',
  plank: 'PROCESSED', brick: 'PROCESSED', glass: 'PROCESSED', charcoal: 'PROCESSED', rope: 'PROCESSED',
  cloth: 'PROCESSED', leather: 'PROCESSED', treated_canvas: 'PROCESSED', fuel_briquette: 'PROCESSED', lubricant: 'PROCESSED',
  hide: 'ANIMAL', fur: 'ANIMAL', chitin: 'ANIMAL', shell: 'ANIMAL', gland: 'ANIMAL', feather: 'ANIMAL',
  seed: 'FARM', animal_feed: 'FARM',
  energy_basic: 'ENERGY', energy_refined: 'ENERGY', essence_fire: 'ENERGY', essence_nature: 'ENERGY',
  essence_water: 'ENERGY', essence_spirit: 'ENERGY',
  wolf_fang: 'SPECIMEN', crawler_optic: 'SPECIMEN', boar_tusk: 'SPECIMEN', beetle_horn: 'SPECIMEN',
  arrow: 'AMMO',
});

const MEDICAL = new Set(['bandage', 'medkit', 'antirad']);

/** Class of any runtime item id. Total over ITEMS; unknown ids fall back to their `cat`. */
export function itemClass(key: string): ItemClass | null {
  const d = ITEMS[key];
  if (!d) return null;
  if (d.cat === 'res') return RES_ITEM_CLASS[key] ?? null;
  if (d.cat === 'food') return MEDICAL.has(key) ? 'MEDICAL' : 'FOOD';
  if (d.cat === 'tool') return 'TOOL';
  if (d.cat === 'weapon') return 'WEAPON';
  if (d.cat === 'armor') return 'ARMOR';
  // P10 (Round 3): two Core classes. The split reads the SAME fields the engine already branches on
  // (`creatorCore` = reserve-fed three-skill Core, `core` = charge-fed single-ability Core); it adds no data.
  if (d.cat === 'core') return d.creatorCore ? 'CREATOR_CORE' : 'FIELD_CORE';
  if (d.cat === 'place') return 'DEVICE';
  if (d.cat === 'kit') return 'KIT';
  if (d.cat === 'bp') return 'BLUEPRINT';
  if (d.cat === 'cash') return 'CASH';
  if (d.cat === 'stone') return 'ELDER_STONE';
  if (d.cat === 'misc') return d.fuel ? 'FUEL' : 'KEY';
  return null;
}

/** Vietnamese class alias, shown next to the chip where one is canon. Display data only. */
export const ITEM_CLASS_VI: Partial<Record<ItemClass, string>> = { FIELD_CORE: 'Lõi dã chiến' };

/** One short line telling the two Core classes apart in the item details. Null for everything else. */
export function coreClassLine(key: string): string | null {
  const c = itemClass(key);
  if (c === 'CREATOR_CORE') return '3 skills · B / Q / E energy reserves';
  if (c === 'FIELD_CORE') return `1 ability · ${ITEMS[key].charge ?? 0} charges · no reload`;
  return null;
}

/** Chip text for the inventory: the refined class when known, else the legacy `cat` label. */
export function itemClassLabel(key: string, fallback: string): string {
  const c = itemClass(key);
  return c ? ITEM_CLASS_LABEL[c] : fallback;
}

/** Item Ontology V2 P8 (Round 3). Recipe inputs that NO creature, crate or node supplies on the Veyra layouts today.
 * Used only to word the craft-readiness line honestly ("no source on Veyra yet" instead of "Get 6 Ash Chitin"); it
 * hides nothing and grants nothing. It is NOT a second authority: `tests/item-ontology-v2-round3.test.tsx` requires it
 * to equal the projection's Veyra-unsourced recipe inputs, so the day the Veyra ecology owner adds a source the test
 * fails until this list is shortened. Work order: docs/design/VEYRA_WORLD_SOURCE_REPAIR_ORDER_2026-11-14.md */
export const VEYRA_UNSOURCED_INPUTS: readonly string[] = ['chitin', 'crawler_optic'];
