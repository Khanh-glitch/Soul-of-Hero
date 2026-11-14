// ARENA 1 — provenance and status ledger for the FINAL ITEM SET (Bible §0.2a).
//
// Three tables, all DATA (nothing here is read by the simulation):
//   LI_RECIPE_LEDGER  for every formula this cutover added or changed: the Last Island original as recorded in
//                     `web/ref/last-island-copy-first/FINAL_THREE_GROUP_ITEM_SET_20261115.json` (`li_source_audit`),
//                     the SOH value, and WHY they differ. No Last Island number is restated from memory.
//   ITEM_SOURCE       where a player physically gets each new id on Veyra (source_id, condition, reserve, respawn).
//   ITEM_STATUS       PLAYABLE / IMPLEMENTED_NOT_PROVEN / BLOCKED per roster id, with the evidence or the blocker.
//
// UNIT RULE (the one systematic LI -> SOH adjustment). Last Island counts bulk materials in the hundreds per craft
// (an Iron Axe is 75 ingots + 100 wood). SOH nodes pay 1 unit per stock point (a tree holds 4-6 wood, a vein 5 ore),
// stacks cap at 30-60 and the pack has 24 slots, so an LI bulk number cannot physically be carried, let alone
// gathered. The existing SOH Iron Axe (3 ingots) already sits at LI/25. This ledger applies the same divisors to
// every imported formula instead of tuning each one by feel:
//     wood, stone, iron_ingot ........ LI / 25   (round, min 1)
//     refined_iron_ingot, cloth ...... LI / 5    (round, min 1)
//     animal_hide .................... LI / 10   (round, min 1)
//     crafted components and food .... LI x 1    (plates, gears, blades, tins, needle thread, berries, mushrooms)
// A row that follows the rule is `LI_SCALED`; a row at the literal LI numbers is `LI_EXACT`; anything else is
// `SOH_ADJUSTED` with its own reason. Output quantities, craft seconds, stations where LI recorded none, and every
// item stat are `SOH_TRIAL` values chosen here — the evidence set has no LI stat table.
export type LedgerKind = 'LI_EXACT' | 'LI_SCALED' | 'SOH_ADJUSTED' | 'SOH_ONLY';
export type LiGrade = 'DIRECT' | 'INDIRECT' | 'LEGACY_CLAIM' | 'UNSUPPORTED_CITATION' | 'NONE';
export interface LedgerRow {
  li_id: string | null; grade: LiGrade;
  /** LI ingredients exactly as the audit JSON records them; null = the audit has no recipe for this id. */
  li: Record<string, number> | null;
  /** LI workbench tier as recorded ('0'..'3'), or null when not recorded. */
  li_station: string | null;
  kind: LedgerKind; reason: string; impact: string;
}
const R = (li_id: string | null, grade: LiGrade, li: Record<string, number> | null, li_station: string | null, kind: LedgerKind, reason: string, impact: string): LedgerRow => ({ li_id, grade, li, li_station, kind, reason, impact });
const UNIT = 'Unit rule (bulk divisors).';

/** Keyed by SOH recipe id (or `struct:<type>` for a build cost). */
export const LI_RECIPE_LEDGER: Readonly<Record<string, LedgerRow>> = Object.freeze({
  wood_club: R('wood_club', 'DIRECT', { wood: 300 }, '0', 'LI_SCALED', UNIT, '12 wood = two or three trees with a knife: the first weapon upgrade, hand-made, no station.'),
  cleaver: R('cleaver', 'DIRECT', { iron_ingot: 15, metal_blade: 1 }, '1', 'LI_SCALED', UNIT, 'First use of a Metal Blade outside the Salvager Axe. Bench tier 1; the blade itself needs a level-2 bench.'),
  machete: R('machete', 'DIRECT', { iron_ingot: 100, metal_blade: 3 }, '2', 'LI_SCALED', UNIT, 'Replaces Iron Sword (5 ingots + 1 leather). Dearer: 4 ingots + 3 blades (12 more ingots inside the blades). Same combat stats as the sword it replaces.'),
  needle_thread: R('needle_thread', 'LEGACY_CLAIM', { cloth: 10, iron_ingot: 5 }, null, 'LI_SCALED', UNIT + ' LI output count and station are not recorded: 2 per craft at a level-1 bench is an SOH trial value.', 'Gate material for all eight LI armour pieces. A full iron-plate head + chest set needs 6 thread = 6 cloth (36 fiber) + 3 ingots.'),
  syringe: R('syringe', 'DIRECT', { needle_tube: 1, low_quality_fuel: 10, iron_ingot: 10 }, '2', 'SOH_ADJUSTED', 'LI low-quality fuel is a stackable liquid unit; the SOH Fuel Canister is one indivisible 60-second can, so "10 fuel" cannot be paid. The fuel term is paid in its LI feedstock instead: LI makes 1 fuel from 3 fat, so 10 fuel = 30 fat, scaled /15 to 2 Animal Fat. Iron by the unit rule.', 'A 35 HP instant heal that costs a looted Needle Tube: bounded by tube supply, not by herbs.'),
  low_quality_fuel: R('low_quality_fuel', 'DIRECT', { animal_fat: 3, cloth: 1 }, null, 'SOH_ADJUSTED', 'Output unit differs: LI yields one small fuel unit, SOH yields one whole 60-second Fuel Canister. 6 fat + 1 cloth per can is an SOH trial value. Station is the Furnace and the formula is tier 1 (learned, not starter) so the PA1 v1.2 ruling "no improvised bench canister" still holds.', 'Second fuel route beside refining oil: about 8 boar or deer kills per canister. Lets a hunter run a generator or motorbike without an oil site, slowly.'),
  iron_plate_helmet: R('iron_plate_helmet', 'LEGACY_CLAIM', { iron_plate: 1, animal_hide: 30, needle_thread: 3 }, null, 'LI_SCALED', UNIT, 'Head armour 14% (Scrap Helm is 10%).'),
  iron_plate_chest: R('iron_plate_chest', 'LEGACY_CLAIM', { iron_plate: 3, animal_hide: 40, needle_thread: 3 }, null, 'LI_SCALED', UNIT, 'Body armour 28% between Leather Jerkin 20% and Chitin Plate 35%; 5.5 kg.'),
  refined_iron_helmet: R('refined_iron_helmet', 'LEGACY_CLAIM', { animal_hide: 50, needle_thread: 6, refined_iron_ingot: 15 }, null, 'LI_SCALED', UNIT, 'Head armour 20%, research tier 3.'),
  refined_iron_chest: R('refined_iron_chest', 'LEGACY_CLAIM', { animal_hide: 50, needle_thread: 8, refined_iron_ingot: 25 }, null, 'LI_SCALED', UNIT, 'Body armour 36%, the best crafted body piece (side-boss Coreplate stays above at 38%).'),
  dried_meat: R('dried_meat', 'DIRECT', { animal_meat: 1 }, null, 'LI_EXACT', 'Literal LI numbers. Station (campfire) and 20 s are SOH trial values.', 'Lighter and less filling than a roast (26 vs 34 hunger, 0.2 vs 0.4 kg): a weight trade, not an upgrade.'),
  grilled_mushroom: R('grilled_mushroom', 'DIRECT', { mushroom: 1 }, null, 'LI_EXACT', 'Literal LI numbers.', 'Removes the raw Marsh Cap radiation penalty.'),
  mushroom_soup: R('mushroom_soup', 'DIRECT', { mushroom: 5, tin_can: 1 }, null, 'LI_EXACT', 'Literal LI numbers.', 'Successor of the retired Root Broth as the warm bowl; costs a looted tin.'),
  canned_meat: R('canned_meat', 'DIRECT', { animal_meat: 10, tin_can: 1 }, null, 'SOH_ADJUSTED', 'LI game animals pay meat in bulk; an SOH boar pays 2. Ten SOH cuts roasted are worth 340 hunger, so a 10-cut tin worth one meal would never be made. 3 cuts per tin, 70 hunger: slightly less food than three roasts (102), in a third of the slots.', 'A slot-efficiency item bounded by tin supply. No preservation timer exists in SOH, so it is not sold as "does not spoil".'),
  fruit_juice: R('fruit_juice', 'DIRECT', { wild_berry: 3 }, null, 'LI_EXACT', 'Literal LI numbers. Hand-made: LI records no station.', 'Drink without a flask: 26 thirst for 3 berries.'),
  fruit_wine: R('fruit_wine', 'DIRECT', { wild_berry: 5, tin_can: 1 }, null, 'LI_EXACT', 'Literal LI numbers.', 'Portable warmth (24) for cold regions.'),
  jam: R('jam', 'DIRECT', { wild_berry: 10, cloth: 5, tin_can: 1 }, null, 'LI_SCALED', 'Berries and tin literal; cloth by the unit rule (5 -> 1).', 'Stamina food (30) for hauling.'),
  motorbike_kit: R('motorcycle', 'DIRECT', { refined_iron_ingot: 200, vehicle_frame: 1, mechanical_gear: 30, iron_plate: 30 }, null, 'SOH_ADJUSTED', 'Shape is LI (Frame + Gears + Plates + refined iron, no intermediate Motor Drive). Counts are an SOH trial: gears and plates /10 rounded to 2 and 3 because each SOH gear / plate craft already embeds refined ingots; refined iron 4. Previous SOH kit: frame + drive + 2 plates + 2 fasteners.', 'The retired Motor Drive (2 ingots, 2 machine parts, 2 fasteners, 3 Parts) is replaced by 2 gears + 1 plate + 4 refined ingots. Bench level 3 unchanged.'),
  essence_nature: R(null, 'NONE', null, null, 'SOH_ONLY', 'Group B Core fuel, no LI counterpart. Only the seed input changed: generic seed -> Bitterleaf Seed.', 'Nature Essence now competes with Bitterleaf planting for the same seed.'),
  animal_feed: R(null, 'NONE', null, null, 'SOH_ONLY', 'Group C husbandry. Generic seed -> Wild Berry Seed (the most renewable cultivar: berry bushes regrow).', 'Fodder draws on berry-bush seed instead of oak seed.'),
  'struct:power_switch': R('switch', 'DIRECT', { iron_ingot: 10, electronic_parts: 2, parts: 10 }, null, 'LI_SCALED', UNIT + ' Parts 10 -> 1 (Parts are the scarce SOH research currency, /10).', 'Was 1 ingot + 1 fasteners + 1 Parts. Now needs 2 Electronic Parts: wiring starts after the first wreck or Crawler.'),
  'struct:pressure_switch': R('pressure_switch', 'DIRECT', { iron_ingot: 50, parts: 15, electronic_parts: 10, iron_plate: 2 }, null, 'LI_SCALED', UNIT + ' Electronic Parts /5, Parts /10, plate 2 -> 1.', 'Was 1 ingot + 1 machine part + 1 fasteners. Now needs an Iron Plate, i.e. a level-2 bench and refined iron.'),
  'struct:ir_sensor': R('infrared_switch', 'DIRECT', { iron_ingot: 30, electronic_parts: 10, parts: 15 }, null, 'LI_SCALED', UNIT + ' Electronic Parts /5, Parts /10.', 'Was 1 gear + 1 ingot + 2 fasteners. The gear is gone; 2 Electronic Parts take its place.'),
});

/** Drafted but deliberately NOT in RECIPES: the product has no working use yet, so a craft would be a trap. */
export const DRAFT_RECIPES_NOT_LIVE: Readonly<Record<string, { li: Record<string, number> | null; grade: LiGrade; blockedBy: string }>> = Object.freeze({
  iron_plate_pants: { li: { iron_plate: 2, animal_hide: 30, needle_thread: 3 }, grade: 'LEGACY_CLAIM', blockedBy: 'no leg equipment slot (run.custody.eq is 3 slots: head, body, back; widening it is a save-schema change)' },
  iron_plate_boots: { li: { iron_plate: 1, animal_hide: 30, needle_thread: 3 }, grade: 'LEGACY_CLAIM', blockedBy: 'no foot equipment slot' },
  refined_iron_legs: { li: { animal_hide: 50, needle_thread: 6, refined_iron_ingot: 15 }, grade: 'LEGACY_CLAIM', blockedBy: 'no leg equipment slot' },
  refined_iron_boots: { li: { animal_hide: 50, needle_thread: 6, refined_iron_ingot: 15 }, grade: 'LEGACY_CLAIM', blockedBy: 'no foot equipment slot' },
  wooden_ladder: { li: { wood: 300, rope: 3 }, grade: 'DIRECT', blockedBy: 'no climbing / vertical traversal action in the 1-tile top-down physics' },
  steel_folding_ladder: { li: { refined_iron_ingot: 30, wooden_ladder: 1, mechanical_gear: 3 }, grade: 'DIRECT', blockedBy: 'no climbing action; depends on wooden_ladder' },
  large_furnace: { li: null, grade: 'INDIRECT', blockedBy: 'LI recipe not in the source set; no structure type; furnace upgrade code is keyed to type "furnace" (Building, PR #56)' },
  green_card: { li: null, grade: 'INDIRECT', blockedBy: 'loot-only in LI; no Veyra door declares a card colour (0 keycard doors on Veyra)' },
  blue_card: { li: null, grade: 'INDIRECT', blockedBy: 'same as green_card' },
  purple_card: { li: null, grade: 'INDIRECT', blockedBy: 'same as green_card' },
  electric_resistor: { li: null, grade: 'DIRECT', blockedBy: 'no consumer is evidenced in the LI source set; inventing one would fabricate a mechanic' },
});

/** K3 source rows for ids that enter the world as loot or drops (not as a recipe output). */
export interface SourceRow { source_id: string; kind: 'node' | 'creature' | 'garden'; yields: string; condition: string; reserve: string; respawn: string; veyra: string; antiFarm: string }
export const ITEM_SOURCE: Readonly<Record<string, readonly SourceRow[]>> = Object.freeze({
  seed_sunroot: [{ source_id: 'SOURCES.grass', kind: 'node', yields: '8% per stock unit', condition: 'any tool with plant power (the starting knife: 3)', reserve: '2 stock per tuft', respawn: 'regrows (300 s base, seasonal crop table)', veyra: 'Tall Grass is placed in the meadow, lakeshore and coast windows', antiFarm: 'node stock and regrow timer are saved per tile; a reload never refills a tuft' }],
  seed_bitterleaf: [{ source_id: 'SOURCES.herb', kind: 'node', yields: '30% per stock unit', condition: 'plant power', reserve: '2 stock', respawn: 'regrows (600 s base, herb table)', veyra: 'wild Bitterleaf patches', antiFarm: 'saved per tile' }],
  seed_wildberry: [{ source_id: 'SOURCES.bush', kind: 'node', yields: '30% per stock unit', condition: 'plant power', reserve: '3 stock', respawn: 'regrows (420 s base)', veyra: 'Berry Bushes', antiFarm: 'saved per tile' }],
  animal_fat: [
    { source_id: 'CREATURES.boar', kind: 'creature', yields: '1 at 80%', condition: 'kill (40 HP, charges)', reserve: 'one roll per animal', respawn: 'Veyra wildlife spawner (forest, grass, meadow)', veyra: 'spawns', antiFarm: 'a dead actor is on spawner cooldown; drops are ordinary saved ground stacks' },
    { source_id: 'CREATURES.deer', kind: 'creature', yields: '1 at 60%', condition: 'kill (32 HP, flees)', reserve: 'one roll per animal', respawn: 'Veyra wildlife spawner (forest, meadow, hill)', veyra: 'spawns', antiFarm: 'same' }],
  tin_can: [
    { source_id: 'SOURCES.scrap', kind: 'node', yields: '35% per stock unit', condition: 'scrap power (knife: 1, slow)', reserve: '4 stock, finite', respawn: 'none', veyra: 'Roadside Scrap along roads and yards', antiFarm: 'finite node, stock saved' },
    { source_id: 'SOURCES.wreck', kind: 'node', yields: '20% per stock unit', condition: 'scrap power', reserve: '8 stock, finite', respawn: 'none', veyra: 'Car Wrecks', antiFarm: 'finite node, stock saved' }],
  needle_tube: [
    { source_id: 'SOURCES.scrap', kind: 'node', yields: '10% per stock unit', condition: 'scrap power', reserve: '4 stock, finite', respawn: 'none', veyra: 'Roadside Scrap', antiFarm: 'finite node' },
    { source_id: 'CREATURES.vampire_2', kind: 'creature', yields: '1 at 40%', condition: 'kill a Blood Archivist (52 HP, night, Argus Academy and snow)', reserve: 'one roll per animal', respawn: 'habitat anchor po_academy (4) + snow roaming', veyra: 'spawns', antiFarm: 'habitat cooldown per anchor id' }],
  electronic_parts: [
    { source_id: 'SOURCES.wreck', kind: 'node', yields: '15% per stock unit', condition: 'scrap power', reserve: '8 stock, finite', respawn: 'none', veyra: 'Car Wrecks', antiFarm: 'finite node' },
    { source_id: 'CREATURES.orc_1', kind: 'creature', yields: '1 at 30%', condition: 'kill a Scrap Gnawer (42 HP)', reserve: 'one roll per animal', respawn: 'habitat anchor po_freightyard (4) + forest / sand roaming', veyra: 'spawns', antiFarm: 'habitat cooldown' },
    { source_id: 'CREATURES.crawler', kind: 'creature', yields: '1 at 50%', condition: 'kill a Scrap Crawler (44 HP, ranged) on toxic ground', reserve: 'one roll per animal', respawn: 'Veyra roaming row T.TOXIC (added by this cutover, repair order B)', veyra: 'spawn row added; not yet observed in play', antiFarm: 'ordinary spawner cooldown' }],
});

export type ItemStatus = 'PLAYABLE' | 'IMPLEMENTED_NOT_PROVEN' | 'BLOCKED';
/** Status of the ids this cutover touched. Every roster id NOT listed here is an inherited runtime item that
 *  ARENA 1 round 1 did not re-prove: its status is IMPLEMENTED_NOT_PROVEN by definition (`statusOf`).
 *  PLAYABLE is reserved for an id observed in the real browser build with player input; an engine scenario
 *  (tests/final-item-set.test.ts) is evidence for IMPLEMENTED_NOT_PROVEN, never for PLAYABLE. */
export const ITEM_STATUS: Readonly<Record<string, { status: ItemStatus; note: string }>> = Object.freeze({
  ...Object.fromEntries(Object.entries(DRAFT_RECIPES_NOT_LIVE).map(([id, d]) => [id, { status: 'BLOCKED' as ItemStatus, note: d.blockedBy }])),
  door_powered: { status: 'BLOCKED', note: 'MODULE_PENDING_STRUCTURES: the lock / electrical module contract is undecided; no build entry' },
  crude_petroleum: { status: 'BLOCKED', note: 'no oil site on any shipping map (fixture-only authority)' },
  deploy_oil_pump: { status: 'BLOCKED', note: 'placeable only on an oil site; none exists' },
});
export function statusOf(id: string): { status: ItemStatus; note: string } {
  return ITEM_STATUS[id] ?? { status: 'IMPLEMENTED_NOT_PROVEN', note: 'engine scenario or inherited runtime; not observed in the browser build in ARENA 1 round 1' };
}

/** V — asset contract seed. Physical description of the ids this cutover introduced, for Arena 2 (final pixels are
 *  theirs). `icon` in the catalog is an existing key reused as a TEMPORARY fallback for every one of these. */
export interface VisualBrief { shape: string; material: string; silhouette: string; size: 'tiny' | 'small' | 'medium' | 'large'; contexts: ('inventory' | 'world_drop' | 'equipped' | 'held' | 'placed')[] }
const V = (shape: string, material: string, silhouette: string, size: VisualBrief['size'], contexts: VisualBrief['contexts']): VisualBrief => ({ shape, material, silhouette, size, contexts });
const INV: VisualBrief['contexts'] = ['inventory', 'world_drop'];
export const VISUAL_BRIEF: Readonly<Record<string, VisualBrief>> = Object.freeze({
  seed_sunroot: V('four plump teardrop seeds in a loose pile', 'dry seed husk', 'warm amber-brown cluster, one bright orange seed on top; must read apart from the two other seeds by COLOUR and one distinct top shape', 'tiny', INV),
  seed_bitterleaf: V('thin flat oval seeds with a tiny sprout curl', 'dry seed, green shoot', 'dark green cluster with one pale leaf tick', 'tiny', INV),
  seed_wildberry: V('small round pips, one still inside a berry skin', 'pip and dried berry flesh', 'crimson-pink cluster, one round berry outline', 'tiny', INV),
  animal_fat: V('irregular slab of tallow with a cut face', 'animal fat', 'pale cream-yellow block, soft rounded corners, no fur', 'small', INV),
  tin_can: V('short open cylinder, lid bent back, no label', 'tin-plated steel', 'grey cylinder with a bright rim highlight and a jagged lid', 'small', INV),
  electronic_parts: V('small green board with two relays and trailing wires', 'PCB, copper, plastic', 'green rectangle, yellow and silver dots, two wire tails; must NOT read as the round Parts gear', 'small', INV),
  electric_resistor: V('coil of bare resistance wire on a ceramic bobbin', 'nichrome wire, ceramic', 'orange-brown coil, pale core', 'small', INV),
  needle_tube: V('empty glass injector barrel with a steel needle, no plunger', 'glass, steel', 'thin pale diagonal with a bright tip', 'tiny', INV),
  needle_thread: V('spool of thread with a needle stuck through it', 'cotton thread, steel needle', 'pale lilac spool, one diagonal silver needle', 'tiny', INV),
  syringe: V('filled injector with plunger drawn', 'glass, steel, red fluid', 'red-filled diagonal barrel, white plunger, bright needle', 'small', INV),
  dried_meat: V('two dark twisted jerky strips tied with twine', 'dried meat', 'dark brown strips, thin and wrinkled; darker and thinner than Roast Meat', 'small', INV),
  canned_meat: V('sealed tin with a meat-red band', 'tin, paper band', 'grey cylinder, red-brown band, closed flat lid', 'small', INV),
  grilled_mushroom: V('single cap on a short skewer with grill marks', 'cooked mushroom, wood skewer', 'tan cap with dark bars; brown not purple (raw Marsh Cap is purple)', 'small', INV),
  mushroom_soup: V('open tin of pale soup with steam', 'tin, soup', 'grey cylinder, cream surface, two steam ticks', 'small', INV),
  fruit_juice: V('small stoppered bottle of pink juice', 'glass, juice', 'bottle shape, bright pink fill', 'small', INV),
  fruit_wine: V('corked dark bottle', 'dark glass, cork', 'bottle shape, deep purple fill, tan cork', 'small', INV),
  jam: V('tin covered with a tied cloth cap', 'tin, cloth, jam', 'grey cylinder, pink-red cloth dome with a string', 'small', INV),
  wood_club: V('thick tapered branch, bark stripped at the grip', 'raw wood', 'brown club, heavy end up, lighter grip', 'medium', ['inventory', 'world_drop', 'held']),
  cleaver: V('broad rectangular blade with a short wooden handle and a hang hole', 'iron, wood', 'wide bright rectangle on a short brown grip; wider and squarer than the knife', 'small', ['inventory', 'world_drop', 'held']),
  machete: V('long single-edged blade widening toward the tip, wrapped grip', 'iron, leather wrap', 'long bright curve, no crossguard (the retired sword had one)', 'medium', ['inventory', 'world_drop', 'held']),
  iron_plate_helmet: V('riveted dome of plate over a hide liner with cheek flaps', 'iron plate, hide', 'dark steel dome, lighter rim, hide flaps', 'medium', ['inventory', 'world_drop', 'equipped']),
  iron_plate_chest: V('three overlapping plates on a hide vest with stitching', 'iron plate, hide, thread', 'dark steel torso, visible stitch line, hide shoulders', 'large', ['inventory', 'world_drop', 'equipped']),
  iron_plate_pants: V('hide trousers with two thigh plates', 'iron plate, hide', 'two-leg shape, steel thigh blocks', 'medium', ['inventory', 'world_drop', 'equipped']),
  iron_plate_boots: V('hide boots with a plate toe cap', 'iron plate, hide', 'pair of boots, steel toes', 'small', ['inventory', 'world_drop', 'equipped']),
  refined_iron_helmet: V('smooth one-piece helmet with a brow ridge', 'refined iron, hide liner', 'teal-steel dome with a bright ridge; cleaner than the riveted iron plate helmet', 'medium', ['inventory', 'world_drop', 'equipped']),
  refined_iron_chest: V('fitted cuirass with a raised centre line', 'refined iron, hide', 'teal-steel torso, bright centre line', 'large', ['inventory', 'world_drop', 'equipped']),
  refined_iron_legs: V('articulated leg guards on hide', 'refined iron, hide', 'two-leg shape, teal knee plates', 'medium', ['inventory', 'world_drop', 'equipped']),
  refined_iron_boots: V('plated boots with ankle guard', 'refined iron, hide', 'pair of boots, teal plating', 'small', ['inventory', 'world_drop', 'equipped']),
  green_card: V('plastic access card with a chip and a stripe', 'plastic', 'green rectangle, pale stripe', 'tiny', INV),
  blue_card: V('plastic access card with a chip and a stripe', 'plastic', 'blue rectangle, pale stripe', 'tiny', INV),
  purple_card: V('plastic access card with a chip and a stripe', 'plastic', 'purple rectangle, pale stripe', 'tiny', INV),
  wooden_ladder: V('two rails and five rungs lashed with rope', 'wood, rope', 'tall brown ladder', 'large', ['inventory', 'world_drop', 'placed']),
  steel_folding_ladder: V('folded metal ladder with a hinge', 'refined iron', 'teal-steel folded ladder, hinge dot', 'large', ['inventory', 'world_drop', 'placed']),
  large_furnace: V('wide brick-and-iron smelter with two doors and a stack', 'stone, iron', 'twice the footprint of the Furnace, orange glow', 'large', ['inventory', 'placed']),
});
