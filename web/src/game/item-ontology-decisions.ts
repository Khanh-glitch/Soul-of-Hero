/**
 * Item Ontology V2 — the DESIGN layer (decisions), kept apart from the FACT layer (item-ontology.ts).
 *
 * Nothing in this file changes the game. It records, per runtime item id, what the V2 audit proposes
 * (KEEP / RENAME / REDESIGN / MERGE_CANDIDATE / RETIRE_CANDIDATE / ADD_CANDIDATE / DEFER), the Last
 * Island reference it was compared against, and — for anything that would change progression, value
 * or saved assets — a Group-B proposal with exact before/after recipes and a migration plan.
 *
 * Every numeric claim about the CURRENT game is NOT typed here: the report generator reads it from
 * the projection of the live economic multigraph and the test fails if a "before" recipe quoted in
 * a proposal no longer matches RECIPES / STRUCTS. Only proposals ("after") are authored by hand.
 */

export type Disposition = 'KEEP' | 'RENAME' | 'REDESIGN' | 'MERGE_CANDIDATE' | 'RETIRE_CANDIDATE' | 'ADD_CANDIDATE' | 'DEFER';

export type Domain =
  | 'INDUSTRY' | 'BUILDING' | 'POWER' | 'TRANSPORT' | 'GEAR' | 'FARMING' | 'HUSBANDRY' | 'SURVIVAL' | 'CORE' | 'SPECIAL';

/** One material axis per domain: the sentence a newcomer should be able to repeat. */
export const DOMAIN_AXIS: Record<Domain, { title: string; axis: string }> = {
  INDUSTRY: { title: 'Industry & metallurgy', axis: 'Ore → Iron Ingot → Refined Iron Ingot; Scrap → Machine Parts → Gear / Pipe / Plate / Blade. Parts (found, never crafted) pays for knowledge and technology.' },
  BUILDING: { title: 'Building', axis: 'Wood → Stone → Brick → Iron (Glass for windows, Rope for fittings, Iron Plate for patching).' },
  POWER: { title: 'Power & automation', axis: 'Solid fuel (Wood → Charcoal → Coal → Briquette) heats stations; Fuel Canister runs generators; packed devices are built from Iron + Machine Parts + Parts.' },
  TRANSPORT: { title: 'Transport', axis: 'Hand Cart (wood + iron) → Utility Motorbike (Frame + Drive + Plates), run on Fuel Canister, serviced with Lubricant.' },
  GEAR: { title: 'Tools, weapons & worn gear', axis: 'Stone/wood starter → Iron tier → Salvager tier (iron tool + Machine Parts + Parts); hide → Leather → armour; Canvas → pack and canteen.' },
  FARMING: { title: 'Farming', axis: 'Wild Seeds / Bitterleaf → Garden Plot → Sunroot / Bitterleaf → cooked food and Fodder.' },
  HUSBANDRY: { title: 'Husbandry', axis: 'Taming Lead + feed → penned animal → renewable product (egg, feather, fur, hide, meat).' },
  SURVIVAL: { title: 'Survival & medical', axis: 'Raw food → Campfire meal (hunger / thirst / warmth / health trade-offs); Fiber → Bandage → Medkit; Gland → Purge Tonic; water containers.' },
  CORE: { title: 'Creator Core', axis: 'Core (the weapon) + Basic / Refined Energy (the ammunition) + one Essence (the Signature fuel).' },
  SPECIAL: { title: 'Special, Elder & Ragnarok', axis: 'Blueprints and specimens teach recipes; keycard opens vaults; Elder stones, relics, Ragnarok cash and the Escrow Chest carry the run objective.' },
};

export interface ItemDecision {
  domain: Domain;
  decision: Disposition;
  /** Proposed player-facing name when it differs from today (id never changes silently). */
  proposed_name?: string;
  /** Proposed id when the decision would move the item (MERGE/RETIRE target). */
  proposed_id?: string;
  /** Last Island item id(s) compared against, or 'none' when LI has no counterpart. */
  li: string;
  why: string;
  /** Group-B proposal id that carries the before/after + migration, when one is needed. */
  proposal?: string;
}

const D = (domain: Domain, decision: Disposition, li: string, why: string, extra: Partial<ItemDecision> = {}): ItemDecision =>
  ({ domain, decision, li, why, ...extra });

/** Explicit row for every non-generated item. The test fails on a missing or stale id. */
export const ITEM_DECISIONS: Readonly<Record<string, ItemDecision>> = Object.freeze({
  // ── Industry & metallurgy ────────────────────────────────────────────────────────────────────
  iron_ore: D('INDUSTRY', 'KEEP', 'raw_iron_ore', 'Root of the metal axis; one clear job (smelt).'),
  rich_iron_ore: D('INDUSTRY', 'KEEP', 'refined_iron_ore', 'Quality tier of the same node (better pick → richer ore). Single recipe consumer is correct for an ore: it IS the shortcut to Refined Iron.'),
  coal: D('INDUSTRY', 'KEEP', 'none', 'Refining reagent and best mined fuel. Two jobs, both legible.'),
  iron_ingot: D('INDUSTRY', 'KEEP', 'iron_ingot', 'Most-consumed crafted material in the game; same role as in LI.'),
  refined_iron_ingot: D('INDUSTRY', 'KEEP', 'refined_iron_ingot', 'Second metal tier; gates Pipe / Gear / Plate exactly as in LI.'),
  scrap: D('INDUSTRY', 'KEEP', 'parts', 'SOH splits LI "Parts" into raw Scrap (bulk, smeltable) and Parts (scarce). Scrap is the bulk half and stays.'),
  spares: D('INDUSTRY', 'RENAME', 'parts', 'This IS the LI Parts role: found / recovered, never crafted, spent on research, trade, Cores and technology (Bible §0.2 "Spares/linh kiện", K4). The id stays; the display name becomes "Parts / Linh kiện" so the backbone resource has the backbone name.', { proposed_name: 'Parts', proposal: 'P1' }),
  mechanical_parts: D('INDUSTRY', 'RENAME', 'none', 'Crafted from Scrap + Iron; NOT a research currency. Its current name collides with the Parts axis. Re-labelled as the crafted machine component ("Machine Parts / Cụm máy"); never shown as "Parts".', { proposed_name: 'Machine Parts', proposal: 'P1' }),
  fasteners: D('INDUSTRY', 'MERGE_CANDIDATE', 'none', 'Twin of Machine Parts: same raw inputs (iron ore + scrap), same station tier, both generic "small metal bits" with 18 vs 22 consumers and no distinct mechanic. Two near-identical intermediates are fake depth.', { proposed_id: 'mechanical_parts', proposal: 'P2' }),
  metal_pipe: D('INDUSTRY', 'REDESIGN', 'metal_pipe', 'Only consumer is vehicle_frame_piped, which is strictly dominated by the plain frame recipe — so today a Pipe is never the rational choice. LI uses Pipe for fluid/pressure machines. Give it that job.', { proposal: 'P3' }),
  metal_blade: D('INDUSTRY', 'REDESIGN', 'metal_blade', 'Only used by two optional alternative recipes. LI makes the Blade the cutting edge of the refined axe. Make it the required edge of the Salvager Axe; keep the two alternates as honest shortcuts.', { proposal: 'P4' }),
  mechanical_gear: D('INDUSTRY', 'KEEP', 'mechanical_gear', 'Four distinct consumers (bear trap, IR sensor, drive, pick) plus a versioned Recycler rule. Same job as LI.'),
  iron_plate: D('INDUSTRY', 'REDESIGN', 'iron_plate', 'Real jobs (motorbike, wall patching, trap re-arm) so the item stays; but it is the only one of the four technical components with no Recycler rule. Add one.', { proposal: 'P5' }),
  damaged_drive: D('INDUSTRY', 'KEEP', 'none', 'The physical "appliance to recycle": the only way the Recycler mints Parts. Carries the LI recycler loop without making Parts craftable.'),
  salvaged_oil: D('INDUSTRY', 'KEEP', 'crude_oil', 'LI red-barrel oil. Live source of all fuel and lubricant.'),
  crude_petroleum: D('INDUSTRY', 'DEFER', 'crude_oil', 'Second raw oil with NO live source: the Oil Pump adapter is test-fixture only. Not shown to players today. Decide when the pump ships; until then it must not be advertised.', { proposal: 'P9' }),
  lubricant: D('TRANSPORT', 'KEEP', 'none', 'One clear job (vehicle service). By-product of the industrial refinery batch.'),
  fuel_can: D('POWER', 'KEEP', 'low_quality_fuel', 'Liquid fuel for generators and vehicles; also a POI fuel gate. Bench recipe already retired at revision 2.'),
  // ── Power / solid fuel ───────────────────────────────────────────────────────────────────────
  charcoal: D('POWER', 'KEEP', 'none', 'Second rung of the solid-fuel ladder (wood 20 s → charcoal 55 s) and input to Briquette.'),
  fuel_briquette: D('POWER', 'KEEP', 'none', 'Top rung (90 s), renewable from wood; the choice against mined Coal (80 s) is real: labour vs travel.'),
  // ── Building ─────────────────────────────────────────────────────────────────────────────────
  wood: D('BUILDING', 'KEEP', 'wood', 'Universal starter material and fuel.'),
  stone: D('BUILDING', 'KEEP', 'none', 'Second building tier; feeds Brick, Glass, Basic Energy.'),
  fiber: D('BUILDING', 'KEEP', 'cloth', 'Rope / Cloth / Bandage root. LI goes plant → cloth directly; SOH keeps the gather step.'),
  plank: D('BUILDING', 'RETIRE_CANDIDATE', 'none', 'One consumer (Plank Wall = 3 plank), and its own description prices it as "6 wood". A whole item + recipe that is only a renamed 2 wood adds a click, not a decision.', { proposed_id: 'wood', proposal: 'P6' }),
  brick: D('BUILDING', 'KEEP', 'none', 'Third building tier; also refinery / pump housing.'),
  glass: D('BUILDING', 'KEEP', 'none', 'Windows, mask, canteen, fuel batches. Two recipes are a genuine regional choice (Frost Crystal vs Crab Shell).'),
  rope: D('BUILDING', 'KEEP', 'rope', 'Thirteen consumers; binding material across building, gear and husbandry.'),
  // ── Gear materials ───────────────────────────────────────────────────────────────────────────
  hide: D('GEAR', 'KEEP', 'none', 'Hunting / husbandry output; Leather and Water Flask input.'),
  leather: D('GEAR', 'KEEP', 'none', 'Eight consumers across tools and armour.'),
  cloth: D('GEAR', 'KEEP', 'cloth', 'Mask, repair kit, canvas.'),
  treated_canvas: D('GEAR', 'KEEP', 'none', 'Gates the two carry upgrades (pack, canteen); ties Salt + Bitterleaf into gear, which is SOH depth worth protecting.'),
  fur: D('GEAR', 'KEEP', 'none', 'Cold-weather armour input. Name fixed in this PR ("Wolf Fur" → "Fur": it never dropped from wolves).'),
  chitin: D('GEAR', 'DEFER', 'none', 'Single consumer (Chitin Plate) and no Veyra source. The item is fine; the Veyra gap needs a creature placement decision.', { proposal: 'P8' }),
  shell: D('GEAR', 'KEEP', 'none', 'Three consumers; coastal alternative for Glass.'),
  gland: D('SURVIVAL', 'KEEP', 'none', 'Single consumer (Purge Tonic) is right for a medical reagent: creature → cure is a readable two-step chain.'),
  // ── Ores with a domain job ───────────────────────────────────────────────────────────────────
  crystal: D('CORE', 'KEEP', 'none', 'Fifteen consumers: Refined Energy, Cores, Glass. The Core-side ore.'),
  sulfur: D('CORE', 'KEEP', 'sulfur_powder', 'Core and essence reagent. LI uses sulfur for AP ammunition, which SOH does not import.'),
  raw_salt: D('SURVIVAL', 'KEEP', 'none', 'Food preservation flavour (Salted Roast) and Canvas treatment.'),
  // ── Tools / weapons / armour ─────────────────────────────────────────────────────────────────
  knife: D('GEAR', 'KEEP', 'none', 'Starter kit item with no recipe by design; repaired with Scrap.'),
  torch: D('GEAR', 'KEEP', 'none', 'Light + ignition; also the Torch Post input.'),
  iron_axe: D('GEAR', 'KEEP', 'iron_axe', 'Iron tool tier.'),
  iron_pick: D('GEAR', 'KEEP', 'none', 'Iron tool tier; unlocks Rich Iron Ore quality.'),
  industrial_axe: D('GEAR', 'REDESIGN', 'refined_iron_axe', 'Top axe. LI builds it from Blades + Pipe; SOH builds it from generic Machine Parts. Give the Blade its job here.', { proposal: 'P4' }),
  industrial_pick: D('GEAR', 'KEEP', 'none', 'Top pick; its geared alternate is a real knowledge bypass (more iron, no research).'),
  wood_spear: D('GEAR', 'KEEP', 'wood_club', 'Starter weapon.'),
  iron_sword: D('GEAR', 'KEEP', 'machete', 'Iron melee; Blade alternate trades a higher station for skipping research.'),
  reinforced_spear: D('GEAR', 'KEEP', 'none', 'Reach weapon; Blade alternate is a knowledge bypass.'),
  bow: D('GEAR', 'KEEP', 'none', 'Only ranged weapon. SOH deliberately has no firearms.'),
  arrow: D('GEAR', 'KEEP', 'none', 'Bow and turret ammunition. Chip now reads AMMO instead of MATERIAL.'),
  leather_armor: D('GEAR', 'KEEP', 'none', 'Body armour tier 1.'),
  chitin_armor: D('GEAR', 'DEFER', 'none', 'Body armour tier 2; uncraftable on Veyra because Chitin has no source there.', { proposal: 'P8' }),
  fur_cloak: D('GEAR', 'KEEP', 'none', 'Cold protection (back slot).'),
  gas_mask: D('GEAR', 'KEEP', 'none', 'Radiation / gas protection; spends Parts.'),
  scrap_helm: D('GEAR', 'KEEP', 'none', 'Cheap head armour; a Scrap sink.'),
  trail_pack: D('GEAR', 'KEEP', 'none', 'Carry bonus; the reward of the Canvas chain.'),
  field_repair_kit: D('GEAR', 'KEEP', 'none', 'Portable repair for forty targets.'),
  // ── Farming ──────────────────────────────────────────────────────────────────────────────────
  seed: D('FARMING', 'KEEP', 'none', 'Garden input and bird feed.'),
  crop: D('FARMING', 'KEEP', 'none', 'Garden staple (Sunroot).'),
  herb: D('FARMING', 'KEEP', 'none', 'Eight consumers: food, medicine, canvas. Winter crop.'),
  berries: D('FARMING', 'KEEP', 'wild_berry', 'Forage food and taming bait.'),
  mushroom: D('FARMING', 'KEEP', 'mushroom', 'Marsh forage; feed. Raises radiation when eaten raw, which is its trade-off.'),
  // ── Husbandry ────────────────────────────────────────────────────────────────────────────────
  lead_rope: D('HUSBANDRY', 'KEEP', 'none', 'Held tool for taming. The multigraph has no edge for it because it is checked, not consumed — recorded as a held tool so it is not misread as useless.'),
  animal_feed: D('HUSBANDRY', 'KEEP', 'none', 'Pen and trough feed.'),
  feather: D('HUSBANDRY', 'KEEP', 'none', 'Grouse product; the fletched-arrow recipe (8 instead of 6) is the reason to keep birds.'),
  grouse_egg: D('HUSBANDRY', 'KEEP', 'none', 'Renewable food from penned grouse.'),
  // ── Survival & medical ───────────────────────────────────────────────────────────────────────
  meat: D('SURVIVAL', 'KEEP', 'animal_meat', 'Raw food; harmful uncooked.'),
  cooked_meat: D('SURVIVAL', 'KEEP', 'dried_meat', 'Baseline meal.'),
  herb_roast: D('SURVIVAL', 'KEEP', 'none', 'Healing meal (15 HP): different from Salted Roast by stat, not just by name.'),
  salted_meat: D('SURVIVAL', 'KEEP', 'canned_meat', 'Hunger meal (42).'),
  root_broth: D('SURVIVAL', 'KEEP', 'mushroom_soup', 'Meat-free meal with thirst; two routes (garden or eggs) now both named in the description.'),
  stew: D('SURVIVAL', 'KEEP', 'none', 'Best meal, warmth 25; the only researched food.'),
  water_flask: D('SURVIVAL', 'KEEP', 'none', 'Starter water container.'),
  trail_canteen: D('SURVIVAL', 'KEEP', 'none', 'Upgraded water container.'),
  bandage: D('SURVIVAL', 'KEEP', 'bandage', 'Basic heal. Chip now reads MEDICAL instead of FOOD.'),
  medkit: D('SURVIVAL', 'KEEP', 'medkit', 'Strong heal.'),
  antirad: D('SURVIVAL', 'KEEP', 'none', 'Radiation cure.'),
  // ── Creator Core ─────────────────────────────────────────────────────────────────────────────
  energy_basic: D('CORE', 'KEEP', 'none', 'Core ammunition, hand-made. Bible-protected.'),
  energy_refined: D('CORE', 'KEEP', 'none', 'Stronger Core ammunition. Bible-protected.'),
  essence_fire: D('CORE', 'KEEP', 'none', 'One of the four Essences. Bible-protected.'),
  essence_nature: D('CORE', 'KEEP', 'none', 'One of the four Essences. Bible-protected.'),
  essence_water: D('CORE', 'KEEP', 'none', 'One of the four Essences. Bible-protected.'),
  essence_spirit: D('CORE', 'KEEP', 'none', 'One of the four Essences. Uncraftable on Veyra today (ingredient gap).', { proposal: 'P8' }),
  core_blast: D('CORE', 'RENAME', 'none', 'Creator Core. Vietnamese display name inside an otherwise English item list.', { proposed_name: 'Big Bang', proposal: 'P7' }),
  core_meteor: D('CORE', 'RENAME', 'none', 'Creator Core. Display-language consistency.', { proposed_name: 'Meteor', proposal: 'P7' }),
  core_dragon: D('CORE', 'RENAME', 'none', 'Creator Core. Display-language consistency.', { proposed_name: "Dragon's Breath", proposal: 'P7' }),
  core_elsa: D('CORE', 'RENAME', 'none', 'Creator Core. Display-language consistency.', { proposed_name: "Elsa's Sword", proposal: 'P7' }),
  core_earthmother: D('CORE', 'RENAME', 'none', 'Creator Core. Display-language consistency.', { proposed_name: "Earth Mother's Breath", proposal: 'P7' }),
  core_mjolnir: D('CORE', 'KEEP', 'none', 'Creator Core; name already language-neutral.'),
  core_demon: D('CORE', 'RENAME', 'none', 'Creator Core; also uncraftable on Veyra.', { proposed_name: 'Demon Core', proposal: 'P7' }),
  core_fire: D('CORE', 'DEFER', 'none', 'Legacy core outside the seven Creator Cores, still craftable and castable. Whether four extra cores remain is a Bible ruling, not an audit fix.', { proposal: 'P10' }),
  core_earth: D('CORE', 'DEFER', 'none', 'Legacy core; see core_fire.', { proposal: 'P10' }),
  core_storm: D('CORE', 'DEFER', 'none', 'Legacy core; see core_fire.', { proposal: 'P10' }),
  core_frost: D('CORE', 'DEFER', 'none', 'Legacy core; see core_fire.', { proposal: 'P10' }),
  // ── Special ──────────────────────────────────────────────────────────────────────────────────
  blueprint: D('SPECIAL', 'KEEP', 'none', 'Recipe paper. The audit reported it unreachable; that was a solver defect, fixed in this PR.'),
  wolf_fang: D('SPECIAL', 'KEEP', 'none', 'Specimen: studied to learn Fur Cloak. No Veyra source.', { proposal: 'P8' }),
  crawler_optic: D('SPECIAL', 'KEEP', 'none', 'Specimen and component. No Veyra source.', { proposal: 'P8' }),
  boar_tusk: D('SPECIAL', 'KEEP', 'none', 'Specimen: studied to learn Iron Sword.'),
  beetle_horn: D('SPECIAL', 'KEEP', 'none', 'Specimen: studied to learn Chitin Plate. No Veyra source.', { proposal: 'P8' }),
  keycard: D('SPECIAL', 'KEEP', 'none', 'Vault access; LI green/red/blue cards collapsed to one. No Veyra source.', { proposal: 'P8' }),
  rcash: D('SPECIAL', 'KEEP', 'none', 'Ragnarok currency. Bible-protected.'),
  escrow_chest: D('SPECIAL', 'RENAME', 'none', 'Escrow mechanic is Bible-protected; only the display language is inconsistent.', { proposed_name: 'Escrow Chest', proposal: 'P7' }),
  relic_shaleheart: D('SPECIAL', 'KEEP', 'none', 'Veyra side-boss unique.'),
  ronin_nodachi: D('SPECIAL', 'KEEP', 'none', 'Veyra side-boss unique.'),
  tidemarshal_trident: D('SPECIAL', 'KEEP', 'none', 'Veyra side-boss unique.'),
  custodian_lantern: D('SPECIAL', 'KEEP', 'none', 'Veyra side-boss unique.'),
  // ── Transport ────────────────────────────────────────────────────────────────────────────────
  vehicle_frame: D('TRANSPORT', 'REDESIGN', 'vehicle_frame', 'Stays as the motorbike chassis (LI has the same item). Its two recipes collapse to the piped one.', { proposal: 'P3' }),
  vehicle_drive: D('TRANSPORT', 'KEEP', 'none', 'Looks like a twin of the Frame (same raw inputs, same single consumer) but is the item a Damaged Drive visibly relates to, and it is where Gears enter the bike. Kept; revisit only if P2–P4 leave it still redundant.'),
  motorbike_kit: D('TRANSPORT', 'KEEP', 'motorcycle', 'Deepest craft in the game (L4). The reward of the whole industry axis.'),
  cart_kit: D('TRANSPORT', 'KEEP', 'none', 'Early freight.'),
});

/** Generated ids get a rule instead of 36 identical rows. */
export function decisionFor(id: string): ItemDecision | undefined {
  if (ITEM_DECISIONS[id]) return ITEM_DECISIONS[id];
  if (id.startsWith('deploy_')) return D(id.match(/generator|cable|switch|sensor|controller/) ? 'POWER' : 'BUILDING', 'KEEP', 'none', 'Packed device generated from DEPLOYABLE_TYPES (craft once, place, pack up). Cost equals the structure cost; no separate tuning.');
  if (id.startsWith('stone_')) return D('SPECIAL', 'KEEP', 'none', 'Elder stone: unique per run, one per Elder. Bible-protected.');
  return undefined;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Group-B proposals: NOT implemented. Each is executable once approved.
// ───────────────────────────────────────────────────────────────────────────────────────────────

export type RecipeLine = { id: string; ins: [string, number][]; out: [string, number][]; station: string; note?: string };
export type StructLine = { id: string; cost: [string, number][]; note?: string };

export interface Proposal {
  id: string;
  title: string;
  recommendation: 'APPROVE' | 'APPROVE_LATER' | 'HOLD';
  group: 'B';
  items: string[];
  problem: string;
  decision: string;
  /** Current recipes this proposal touches. The test proves each equals the live catalog. */
  before_recipes?: RecipeLine[];
  after_recipes?: RecipeLine[];
  before_structs?: StructLine[];
  after_structs?: StructLine[];
  migration: string[];
  risk: string;
  tests: string[];
}

export const PROPOSALS: readonly Proposal[] = [
  {
    id: 'P1', group: 'B', recommendation: 'APPROVE',
    title: 'Parts axis — Option A: one item called Parts, one called Machine Parts',
    items: ['spares', 'mechanical_parts'],
    problem: 'Two items compete for the word "Parts". `spares` ("Spares") is the scarce, uncraftable resource that pays for research, vendor trade, every Core and every powered device — the Last Island Parts role. `mechanical_parts` ("Mechanical Parts") is a bench product made from Scrap and Iron. PR #60 renamed the crafted one to "Parts", which put the backbone name on the wrong item.',
    decision: 'Display rename only. `spares` → "Parts" (VI: "Linh kiện"). `mechanical_parts` → "Machine Parts" (VI: "Cụm máy"). No id, recipe, source, cost or research price changes. Parts stays uncraftable; the only mint remains Recycler Damaged Drive → 2.',
    migration: [
      'No save migration: ids, stacks and recipes are untouched.',
      'Change `ITEMS.spares.name`, `ITEMS.mechanical_parts.name` and their descriptions; sweep UI strings that hard-code "Spares" (research panel, vendor, Journey).',
      'Update Bible §0.2 / K4 wording in the same commit (term "Spares/linh kiện" → "Parts/Linh kiện (id spares)").',
    ],
    risk: 'Low. Players and docs that say "Spares" need one release note. Tests that pin the display string must be updated in the same commit.',
    tests: ['item-ontology-v2: exactly one item has class PARTS and no other item name contains the word "Parts" alone', 'existing research / vendor tests unchanged (they use ids)'],
  },
  {
    id: 'P2', group: 'B', recommendation: 'APPROVE_LATER',
    title: 'Merge Forged Fasteners into Machine Parts',
    items: ['fasteners', 'mechanical_parts'],
    problem: 'Fasteners and Machine Parts are made at the same bench tier from the same two raw inputs and are both generic assembly bits. A newcomer has to learn two names for one idea, and most advanced recipes ask for both.',
    decision: 'Retire the `fasteners` recipe and replace every Fasteners cost with Machine Parts at ceil(n / 2) (2 Fasteners ≈ 1 Machine Part in raw value: 0.67 iron + 0.67 scrap vs 0.5 iron + 1 scrap). The item id stays in the catalog so nothing a player owns disappears.',
    before_recipes: [
      { id: 'fasteners', ins: [['iron_ingot', 1], ['scrap', 1]], out: [['fasteners', 3]], station: 'workbench_1' },
      { id: 'iron_plate', ins: [['refined_iron_ingot', 2], ['fasteners', 1]], out: [['iron_plate', 2]], station: 'workbench_2' },
      { id: 'mechanical_gear', ins: [['refined_iron_ingot', 1], ['iron_ingot', 1], ['mechanical_parts', 2], ['fasteners', 1]], out: [['mechanical_gear', 1]], station: 'workbench_2' },
      { id: 'vehicle_drive', ins: [['iron_ingot', 2], ['mechanical_parts', 2], ['fasteners', 2], ['spares', 3]], out: [['vehicle_drive', 1]], station: 'workbench_2' },
      { id: 'vehicle_drive_geared', ins: [['mechanical_gear', 1], ['iron_ingot', 1], ['fasteners', 2], ['spares', 2]], out: [['vehicle_drive', 1]], station: 'workbench_2' },
      { id: 'motorbike_kit', ins: [['vehicle_frame', 1], ['vehicle_drive', 1], ['iron_plate', 2], ['fasteners', 2]], out: [['motorbike_kit', 1]], station: 'workbench_3' },
      { id: 'field_repair_kit', ins: [['fasteners', 2], ['cloth', 1]], out: [['field_repair_kit', 1]], station: 'workbench_1' },
      { id: 'trail_pack', ins: [['treated_canvas', 1], ['leather', 2], ['fasteners', 2], ['rope', 2]], out: [['trail_pack', 1]], station: 'workbench_2' },
      { id: 'trail_canteen', ins: [['treated_canvas', 2], ['leather', 1], ['glass', 1], ['fasteners', 1]], out: [['trail_canteen', 1]], station: 'workbench_2' },
    ],
    after_recipes: [
      { id: 'fasteners', ins: [], out: [], station: '-', note: 'RETIRED (added to RETIRED_RECIPES; frozen as fasteners@2)' },
      { id: 'fasteners_rework', ins: [['fasteners', 2]], out: [['mechanical_parts', 1]], station: 'workbench_1', note: 'NEW, always known, 1 s: lets a player convert old stock by choice; nothing is converted automatically' },
      { id: 'iron_plate', ins: [['refined_iron_ingot', 2], ['mechanical_parts', 1]], out: [['iron_plate', 2]], station: 'workbench_2' },
      { id: 'mechanical_gear', ins: [['refined_iron_ingot', 1], ['iron_ingot', 1], ['mechanical_parts', 3]], out: [['mechanical_gear', 1]], station: 'workbench_2' },
      { id: 'vehicle_drive', ins: [['iron_ingot', 2], ['mechanical_parts', 3], ['spares', 3]], out: [['vehicle_drive', 1]], station: 'workbench_2' },
      { id: 'vehicle_drive_geared', ins: [['mechanical_gear', 1], ['iron_ingot', 1], ['mechanical_parts', 1], ['spares', 2]], out: [['vehicle_drive', 1]], station: 'workbench_2' },
      { id: 'motorbike_kit', ins: [['vehicle_frame', 1], ['vehicle_drive', 1], ['iron_plate', 2], ['mechanical_parts', 1]], out: [['motorbike_kit', 1]], station: 'workbench_3' },
      { id: 'field_repair_kit', ins: [['mechanical_parts', 1], ['cloth', 1]], out: [['field_repair_kit', 1]], station: 'workbench_1' },
      { id: 'trail_pack', ins: [['treated_canvas', 1], ['leather', 2], ['mechanical_parts', 1], ['rope', 2]], out: [['trail_pack', 1]], station: 'workbench_2' },
      { id: 'trail_canteen', ins: [['treated_canvas', 2], ['leather', 1], ['glass', 1], ['mechanical_parts', 1]], out: [['trail_canteen', 1]], station: 'workbench_2' },
    ],
    migration: [
      'Bump RECIPE_REVISION 2 → 3. Freeze every touched recipe as `<id>@2` in LEGACY_RECIPES so in-progress station jobs finish with the inputs they already consumed and the output they were promised.',
      'Add `fasteners` to RETIRED_RECIPES (same mechanism that retired the bench `fuel_can`). A run that already learned it keeps the knowledge flag; the recipe simply stops being offered.',
      'Keep `ITEMS.fasteners`. Stacks in inventory, chests, dropped bags and loot tables stay valid. Add the always-known `fasteners_rework` (2 → 1 Machine Part) so old stock has a use. No automatic conversion, so no rounding loss or gain.',
      'Structure, upgrade and repair costs that list Fasteners (the manifest lists all 11) move to ceil(n / 2) Machine Parts. Already-placed structures are unaffected; reclaim refunds use the cost recorded at placement.',
      'Loot tables: replace Fasteners entries with Machine Parts at the same ceil(n / 2) rule in a NEW loot table version; containers already rolled keep their contents.',
      'This reverses part of PA1 v1.2 (ledger §26), which introduced Fasteners. Record the reversal in the ledger and Bible changelog in the same commit.',
    ],
    risk: 'Medium. Recipes that used a single Fastener get slightly dearer in Scrap (1 Machine Part > 1 Fastener). Reverses a one-day-old PA1 decision, so it needs the owner\'s explicit yes. Do it after P1 so the surviving item already has its final name.',
    tests: ['recipe-migration: every `<id>@2` equals the pre-change recipe', 'in-flight job started at rev 2 completes with rev-2 output after reload', 'economic sim: motorbike raw cost before/after within ±10 % iron and scrap', 'save round-trip: a chest holding Fasteners loads with the same count'],
  },
  {
    id: 'P3', group: 'B', recommendation: 'APPROVE',
    title: 'Give the Metal Pipe a real job',
    items: ['metal_pipe', 'vehicle_frame'],
    problem: 'The Pipe has exactly one consumer, the alternate frame recipe `vehicle_frame_piped`, and that recipe costs strictly more than the plain `vehicle_frame` for the same output at the same station. A rational player never makes a Pipe. Finding one in loot is a Recycler ticket for 1 Refined Iron and nothing else.',
    decision: 'The piped recipe becomes THE frame recipe, and the two fluid machines take Pipes in place of one Machine Part each (Last Island uses Pipes for the extractor and for frames).',
    before_recipes: [
      { id: 'vehicle_frame', ins: [['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2]], out: [['vehicle_frame', 1]], station: 'workbench_2' },
      { id: 'vehicle_frame_piped', ins: [['metal_pipe', 1], ['iron_ingot', 2], ['mechanical_parts', 2], ['spares', 2]], out: [['vehicle_frame', 1]], station: 'workbench_2' },
    ],
    after_recipes: [
      { id: 'vehicle_frame', ins: [['metal_pipe', 1], ['iron_ingot', 2], ['mechanical_parts', 2], ['spares', 2]], out: [['vehicle_frame', 1]], station: 'workbench_2', note: 'rev 3; rev 2 frozen' },
      { id: 'vehicle_frame_piped', ins: [], out: [], station: '-', note: 'RETIRED (identical to the new vehicle_frame)' },
    ],
    before_structs: [
      { id: 'oil_pump', cost: [['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2], ['brick', 2]] },
      { id: 'refinery', cost: [['iron_ingot', 4], ['mechanical_parts', 3], ['spares', 5], ['brick', 6], ['glass', 2]] },
    ],
    after_structs: [
      { id: 'oil_pump', cost: [['iron_ingot', 3], ['mechanical_parts', 1], ['metal_pipe', 2], ['spares', 2], ['brick', 2]] },
      { id: 'refinery', cost: [['iron_ingot', 4], ['mechanical_parts', 2], ['metal_pipe', 2], ['spares', 5], ['brick', 6], ['glass', 2]] },
    ],
    migration: [
      'Bump RECIPE_REVISION; freeze `vehicle_frame@<old>` and `vehicle_frame_piped@<old>`; add `vehicle_frame_piped` to RETIRED_RECIPES.',
      'Frames already crafted are unchanged items. Frame jobs in progress finish at their frozen revision.',
      'Packed Refinery / Oil Pump items already crafted keep working; `deploy_*` recipes are generated from STRUCTS, so the new cost applies only to packs crafted after the change. Reclaim refunds read the cost stored at placement.',
      'Consequence to accept: a Refinery now needs a level-2 Workbench first (Pipes are made there). Today it needs none. This is the intended gate — refining becomes a mid-game step — but it is a real pacing change.',
    ],
    risk: 'Medium: pushes fuel production behind Workbench II. Mitigation already in the game: the Furnace recipe `refine_salvaged_oil` still makes fuel without a Refinery.',
    tests: ['projection: metal_pipe.consumer_targets ≥ 3 and no ONLY_USED_BY_DOMINATED_RECIPE signal', 'projection: no STRICTLY_DOMINATED pair remains for vehicle_frame', 'route sim: wreck loot → pipe → refinery → fuel_can completes'],
  },
  {
    id: 'P4', group: 'B', recommendation: 'APPROVE',
    title: 'Make the Metal Blade the edge of the Salvager Axe',
    items: ['metal_blade', 'industrial_axe'],
    problem: 'The Blade is only an optional ingredient in two alternate weapon recipes. Its Recycler rule returns exactly what went in, so it is neutral there too. Nothing in the game requires a Blade.',
    decision: 'The Salvager Axe takes one Blade in place of one Machine Part. The two alternate weapon recipes stay: they are honest shortcuts (more iron, no research).',
    before_recipes: [
      { id: 'industrial_axe', ins: [['iron_axe', 1], ['mechanical_parts', 2], ['spares', 2]], out: [['industrial_axe', 1]], station: 'workbench_2' },
    ],
    after_recipes: [
      { id: 'industrial_axe', ins: [['iron_axe', 1], ['metal_blade', 1], ['mechanical_parts', 1], ['spares', 2]], out: [['industrial_axe', 1]], station: 'workbench_2', note: 'rev 3; rev 2 frozen. Adds 4 Iron Ingot of raw cost.' },
    ],
    migration: [
      'Freeze `industrial_axe@<old>`; existing axes and in-progress jobs are untouched.',
      'Recycler: add a NEW rule key for the axe built at the new revision (rules are immutable and versioned; never edit X:recover-v3). Return must stay ≤ inputs (Bible K4).',
    ],
    risk: 'Low. One tool gets 4 iron dearer; the Pick is unchanged, so the two top tools stop being copies of each other.',
    tests: ['projection: metal_blade has a non-alternate consumer', 'recycler: new rule returns no more Machine Parts than the recipe consumed'],
  },
  {
    id: 'P5', group: 'B', recommendation: 'APPROVE',
    title: 'Add a Recycler rule for Iron Plate',
    items: ['iron_plate'],
    problem: 'Pipe, Gear and Blade each have a versioned Recycler rule; Plate has none, so a looted Plate you do not need is dead weight. The four technical components should behave alike.',
    decision: 'New immutable rule `X:plate-v1`: 1 Iron Plate → 1 Iron Ingot. Deliberately lossy (a Plate costs 1 Refined Iron + half a Fastener), so craft → recycle → craft can never be net-positive.',
    migration: ['Add the rule under a NEW key in COMPONENT_RULES; no existing rule is edited, so queued Recycler jobs are unaffected.', 'No save migration.'],
    risk: 'Low. Returns less than the cheapest input, so it cannot be farmed.',
    tests: ['recycler: plate rule output value < plate recipe input value', 'projection: iron_plate.recycle is non-null and verdict is PARTS_NEUTRAL or PARTS_NEGATIVE'],
  },
  {
    id: 'P6', group: 'B', recommendation: 'APPROVE_LATER',
    title: 'Retire Plank',
    items: ['plank'],
    problem: 'Plank exists to build one thing. 3 Plank = 6 Wood, and the Plank Wall description already says "for 6 wood". The item adds a bench step and an inventory row, not a choice.',
    decision: 'Plank Wall costs 6 Wood directly. The `plank` recipe is retired; the item stays so existing stacks are valid, and can be split back to Wood.',
    before_recipes: [{ id: 'plank', ins: [['wood', 2]], out: [['plank', 1]], station: 'workbench_1' }],
    after_recipes: [
      { id: 'plank', ins: [], out: [], station: '-', note: 'RETIRED' },
      { id: 'plank_split', ins: [['plank', 1]], out: [['wood', 2]], station: 'hand', note: 'NEW, always known: exact value back, by player choice' },
    ],
    before_structs: [{ id: 'wall_plank', cost: [['plank', 3]] }],
    after_structs: [{ id: 'wall_plank', cost: [['wood', 6]] }],
    migration: [
      'Freeze `plank@<old>`, add to RETIRED_RECIPES. Keep `ITEMS.plank`.',
      'Placed Plank Walls are unaffected; reclaim refunds use the stored cost (Plank), which `plank_split` turns back into Wood 1:2.',
      'Creature drop table: the one Plank drop becomes 2 Wood in a new table version.',
      'Alternative if the owner wants a sawn-timber tier instead: keep Plank and move Wood Door, Iron-bound Chest and Hand Cart onto it. That is a bigger cost change and is NOT the recommendation.',
    ],
    risk: 'Low value risk (exact 1:2). It removes the Workbench requirement from the Plank Wall, which makes the 240 HP wall available earlier — accept or add `need` on the structure.',
    tests: ['save round-trip with Plank in a chest', 'reclaim of a pre-change Plank Wall refunds Plank, never Wood'],
  },
  {
    id: 'P7', group: 'B', recommendation: 'APPROVE',
    title: 'One display language for item names',
    items: ['core_blast', 'core_meteor', 'core_dragon', 'core_elsa', 'core_earthmother', 'core_demon', 'escrow_chest'],
    problem: 'Seven items show Vietnamese names in an otherwise English inventory. The names are canon; the mixture is not.',
    decision: 'Show the English name with the canonical Vietnamese name kept as subtitle/alias. Ids and mechanics untouched.',
    migration: ['Display strings only. Any test or e2e that selects by the Vietnamese label must move to the id.'],
    risk: 'Low. Needs the owner to confirm the English wording of canon names.',
    tests: ['item-ontology-v2: no item name mixes languages'],
  },
  {
    id: 'P8', group: 'B', recommendation: 'HOLD',
    title: 'Veyra source gaps',
    items: ['chitin', 'chitin_armor', 'crawler_optic', 'wolf_fang', 'beetle_horn', 'keycard', 'core_demon', 'essence_spirit'],
    problem: 'These items have no reachable source on the Veyra layout, and three recipes are uncraftable there. On Veyra a player can see or learn recipes they can never complete.',
    decision: 'Do not invent sources in an ontology PR. Until Veyra creature and POI placement is decided, hide Veyra-unreachable recipes from the craft list on that layout (a filter driven by this projection), and treat each gap as a content task.',
    migration: ['None for hiding. Adding sources later is a loot/creature change and needs its own approval.'],
    risk: 'Leaving it means dead recipes on Veyra; fixing it wrong means free rare items.',
    tests: ['projection lists exactly these ids as NOT_REACHABLE_ON_VEYRA'],
  },
  {
    id: 'P9', group: 'B', recommendation: 'HOLD',
    title: 'Crude Petroleum has no live source',
    items: ['crude_petroleum'],
    problem: 'The Oil Pump that produces it runs only in the test fixture. On both live layouts the item cannot be obtained and its recipes cannot run.',
    decision: 'Keep the id (the pump work depends on it); keep it out of player-facing lists until the pump is live. Salvaged Oil remains the single live oil.',
    migration: ['None.'],
    risk: 'None while hidden.',
    tests: ['projection: crude_petroleum runtime_reachability is FIXTURE_ONLY'],
  },
  {
    id: 'P10', group: 'B', recommendation: 'HOLD',
    title: 'Four legacy cores beside the seven Creator Cores',
    items: ['core_fire', 'core_earth', 'core_storm', 'core_frost'],
    problem: 'The Bible fixes seven Creator Cores. Four older cores are still craftable (8–10 Parts each) and castable, so the Core list a newcomer sees has eleven entries in two rule-sets.',
    decision: 'Owner ruling needed: either they are canon "minor cores" (then say so in the Bible and label them), or their recipes are retired while existing cores keep working until the run reset. The audit recommends the second, after confirming every legacy effect has a Creator Core counterpart.',
    migration: ['If retired: RETIRED_RECIPES for the four recipes; items, charge and learned state untouched; per-run reset removes them naturally.'],
    risk: 'Touches player assets and a Bible-protected system; not safe to decide inside an audit.',
    tests: ['save round-trip of a charged legacy core'],
  },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Parts decision package (deliverable 6)
// ───────────────────────────────────────────────────────────────────────────────────────────────

export const PARTS_SCOPE = ['spares', 'mechanical_parts', 'scrap', 'fasteners', 'metal_pipe', 'mechanical_gear', 'iron_plate', 'metal_blade'] as const;

export interface PartsOption {
  id: 'A' | 'B'; title: string; summary: string;
  scores: Record<'implementation_cost' | 'clarity' | 'gameplay_choice' | 'scarcity' | 'exploit_risk' | 'save_compatibility', string>;
}

export const PARTS_OPTIONS: readonly PartsOption[] = [
  {
    id: 'A', title: 'Two distinct axes',
    summary: '`spares` is shown as Parts and stays the uncraftable progression resource. `mechanical_parts` is shown as Machine Parts, a crafted component. Gear / Pipe / Plate / Blade keep their ids and get one clear job each (P3–P5). Fasteners fold into Machine Parts later (P2).',
    scores: {
      implementation_cost: 'Small: two display names now; three small recipe proposals after.',
      clarity: 'High: one word, one item. "Parts are found; Machine Parts are made."',
      gameplay_choice: 'Kept: Parts still competes between research, trade, Cores and devices (Bible K4).',
      scarcity: 'Unchanged: no new Parts source, no craft recipe.',
      exploit_risk: 'None added: the research currency still cannot be crafted.',
      save_compatibility: 'Full: no id or recipe changes in P1.',
    },
  },
  {
    id: 'B', title: 'Collapse to a single Parts item',
    summary: 'Merge `mechanical_parts` into `spares` so there is one Parts item, as in Last Island. Every recipe that takes Machine Parts takes Parts instead.',
    scores: {
      implementation_cost: 'Large: 22 consumer targets and 13 repair costs rewired, every Recycler return re-versioned, loot tables re-rolled, inventory conversion.',
      clarity: 'Highest on paper: one item.',
      gameplay_choice: 'Reduced: bulk machine-building and scarce research would draw on the same pool, so one starves the other.',
      scarcity: 'Broken unless the Machine Parts recipe is deleted: today 2 Scrap + 1 Iron Ingot makes 2, i.e. 5 Scrap would buy 2 research Parts.',
      exploit_risk: 'High. The live graph already contains a Parts-positive loop under a merge: an Iron Axe uses no Machine Parts but its Recycler rule returns one. Every such rule would have to be rewritten.',
      save_compatibility: 'Risky: converting stacks changes the value of what players hold; in-flight jobs and versioned Recycler jobs need special cases.',
    },
  },
];

export const PARTS_RECOMMENDATION = {
  choose: 'A' as const,
  reason: 'Option A gets the clarity benefit for almost no cost and keeps the research currency uncraftable. Option B can only be made safe by deleting the Machine Parts recipe, rewriting every Recycler return and converting player inventories — a large migration whose end state is a single pool where building machines and buying knowledge fight each other. That removes a decision the Bible asks for (K4) rather than clarifying it.',
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Last Island crosswalk (deliverable 3). One row per LI item id in ATLAS_v2.json.
// LI source / recipe / consumer columns are read from the atlas by the generator, not typed here.
// ───────────────────────────────────────────────────────────────────────────────────────────────

export type LiVerdict = 'HAVE_SAME_ROLE' | 'HAVE_DIFFERENT_SHAPE' | 'NOT_ADDED' | 'BACKLOG';
export interface LiRow { role: string; soh: string; verdict: LiVerdict; why: string }
const L = (role: string, soh: string, verdict: LiVerdict, why: string): LiRow => ({ role, soh, verdict, why });
const FIREARM = (what: string): LiRow => L(what, '-', 'NOT_ADDED', 'Firearm system. SOH has no gun mechanic (ranged combat is bow + Creator Core); importing the material without the mechanic would be an item with no use.');

export const LI_CROSSWALK: Readonly<Record<string, LiRow>> = Object.freeze({
  parts: L('Universal progression material: looted, recycled, never crafted; pays for research and every advanced recipe', 'spares', 'HAVE_SAME_ROLE', 'Same role. SOH additionally splits off bulk Scrap and crafted Machine Parts. Proposal P1 gives `spares` the Parts name.'),
  iron_ingot: L('Base metal', 'iron_ingot', 'HAVE_SAME_ROLE', 'Same furnace step.'),
  refined_iron_ingot: L('Second metal tier', 'refined_iron_ingot', 'HAVE_SAME_ROLE', 'Same role; SOH also allows upgrading 3 iron + coal.'),
  raw_iron_ore: L('Mined ore', 'iron_ore', 'HAVE_SAME_ROLE', 'Same.'),
  refined_iron_ore: L('Rare ore yield for refined metal', 'rich_iron_ore', 'HAVE_SAME_ROLE', 'Same; SOH ties the yield to pick quality.'),
  metal_blade: L('Cutting component for axes and blades', 'metal_blade', 'HAVE_DIFFERENT_SHAPE', 'Exists but nothing requires it. Proposal P4.'),
  metal_pipe: L('Tube component for frames, fluid machines (and guns)', 'metal_pipe', 'HAVE_DIFFERENT_SHAPE', 'Exists but its only recipe is dominated. Proposal P3.'),
  mechanical_gear: L('Moving-machine component', 'mechanical_gear', 'HAVE_SAME_ROLE', 'Same consumers: trap, sensor, vehicle.'),
  iron_plate: L('Armour / casing component', 'iron_plate', 'HAVE_SAME_ROLE', 'Same, plus wall patching. Missing Recycler rule: P5.'),
  torsion_spring: L('Spring used only by firearms', '-', 'NOT_ADDED', 'All eleven LI consumers are guns. No SOH mechanic would use it.'),
  electronic_parts: L('Rare electrical component gating every powered device', 'spares', 'HAVE_DIFFERENT_SHAPE', 'Considered as an ADD and rejected: in SOH powered devices already spend Parts, and that contention (research vs devices vs Cores) is the K4 design. A second rare currency would dissolve it.'),
  vehicle_frame: L('Vehicle chassis', 'vehicle_frame', 'HAVE_SAME_ROLE', 'Same.'),
  motorcycle: L('Vehicle', 'motorbike_kit', 'HAVE_SAME_ROLE', 'Same; SOH adds a Drive sub-assembly.'),
  wood: L('Base material', 'wood', 'HAVE_SAME_ROLE', 'Same.'),
  cloth: L('Textile', 'cloth', 'HAVE_SAME_ROLE', 'Same; made from Plant Fiber.'),
  rope: L('Binding', 'rope', 'HAVE_SAME_ROLE', 'Same.'),
  crude_oil: L('Raw oil from red barrels / extraction base', 'salvaged_oil', 'HAVE_SAME_ROLE', 'Salvaged Oil is live. Crude Petroleum (pumped) is fixture-only: P9.'),
  low_quality_fuel: L('Fuel for generator and refinery', 'fuel_can', 'HAVE_SAME_ROLE', 'Same role.'),
  animal_fat: L('Animal by-product turned into fuel', '-', 'NOT_ADDED', 'SOH fuel comes from oil and wood; a second fuel source from hunting would duplicate Charcoal.'),
  oil_refinery: L('Fuel-making station', 'deploy_refinery', 'HAVE_SAME_ROLE', 'Same.'),
  fuel_generator: L('Power source', 'deploy_base_generator', 'HAVE_SAME_ROLE', 'Same.'),
  switch: L('Manual power switch', 'deploy_power_switch', 'HAVE_SAME_ROLE', 'Same.'),
  pressure_switch: L('Pressure trigger', 'deploy_pressure_switch', 'HAVE_SAME_ROLE', 'Same.'),
  infrared_switch: L('Motion trigger', 'deploy_ir_sensor', 'HAVE_SAME_ROLE', 'Same.'),
  electric_door: L('Powered door', 'structure:door_powered', 'HAVE_SAME_ROLE', 'A structure in SOH, not an item.'),
  bear_trap: L('Trap', 'deploy_bear_trap', 'HAVE_SAME_ROLE', 'Same, with a Gear.'),
  wood_spikes: L('Passive defence', 'deploy_spikes', 'HAVE_SAME_ROLE', 'Same.'),
  drawing_bench: L('Research station', 'deploy_research', 'HAVE_SAME_ROLE', 'Research Table.'),
  energy_refinery: L('Energy station', '-', 'BACKLOG', 'Unapproved backlog (Energy Ore + energy circuit). Not added.'),
  energy_extractor: L('Energy station', '-', 'BACKLOG', 'Unapproved backlog. Not added.'),
  iron_axe: L('Iron tool', 'iron_axe', 'HAVE_SAME_ROLE', 'Same.'),
  refined_iron_axe: L('Top tool, built from Blades and a Pipe', 'industrial_axe', 'HAVE_DIFFERENT_SHAPE', 'SOH builds it from Machine Parts. Proposal P4 brings the Blade in.'),
  machete: L('Bladed melee weapon', 'iron_sword', 'HAVE_SAME_ROLE', 'Same role; Blade route exists as an alternate.'),
  cleaver: L('Bladed melee weapon', 'iron_sword', 'HAVE_SAME_ROLE', 'One iron melee weapon is enough for SOH.'),
  wood_club: L('Starter weapon', 'wood_spear', 'HAVE_SAME_ROLE', 'Same role.'),
  wooden_ladder: L('Climbing', '-', 'NOT_ADDED', 'No vertical traversal mechanic in SOH.'),
  steel_folding_ladder: L('Climbing', '-', 'NOT_ADDED', 'No vertical traversal mechanic in SOH.'),
  bandage: L('Basic heal', 'bandage', 'HAVE_SAME_ROLE', 'Same.'),
  medkit: L('Strong heal', 'medkit', 'HAVE_SAME_ROLE', 'Same role; SOH recipe is herbal, not fuel-based.'),
  syringe: L('Medical intermediate', '-', 'NOT_ADDED', 'Would add a step between Bandage and Medkit with no decision in it.'),
  needle_tube: L('Looted medical component', '-', 'NOT_ADDED', 'Only feeds the Syringe.'),
  animal_meat: L('Raw food', 'meat', 'HAVE_SAME_ROLE', 'Same.'),
  dried_meat: L('Simple cooked meat', 'cooked_meat', 'HAVE_SAME_ROLE', 'Same role.'),
  canned_meat: L('Preserved meat', 'salted_meat', 'HAVE_DIFFERENT_SHAPE', 'SOH preserves with Salt; there is no spoilage timer, so a can would be decoration.'),
  tin_can: L('Looted container for preserved food', '-', 'NOT_ADDED', 'No spoilage mechanic to give it a job.'),
  wild_berry: L('Forage', 'berries', 'HAVE_SAME_ROLE', 'Same.'),
  mushroom: L('Forage', 'mushroom', 'HAVE_SAME_ROLE', 'Same.'),
  mushroom_soup: L('Cooked forage', 'root_broth', 'HAVE_DIFFERENT_SHAPE', 'Root Broth fills the meat-free meal slot.'),
  grilled_mushroom: L('Cooked forage', '-', 'NOT_ADDED', 'A sixth near-equal campfire meal would be count, not depth.'),
  fruit_juice: L('Drink', 'water_flask', 'HAVE_DIFFERENT_SHAPE', 'Thirst is handled by water containers and broth.'),
  fruit_wine: L('Drink', '-', 'NOT_ADDED', 'No mechanic beyond thirst.'),
  jam: L('Preserved food', '-', 'NOT_ADDED', 'No spoilage mechanic.'),
  gunpowder: FIREARM('Ammunition reagent'),
  sulfur_powder: L('Ammunition reagent', 'sulfur', 'HAVE_DIFFERENT_SHAPE', 'SOH Sulfur feeds Cores and Essences instead of ammunition.'),
  launcher_mechanism: FIREARM('Heavy weapon part'),
  rifle_body: FIREARM('Gun body'), handgun_body: FIREARM('Gun body'), shotgun_body: FIREARM('Gun body'), smg_body: FIREARM('Gun body'), sniper_body: FIREARM('Gun body'),
  akm: FIREARM('Gun'), qbz97: FIREARM('Gun'), famas: FIREARM('Gun'), smg: FIREARM('Gun'), k31: FIREARM('Gun'), m24: FIREARM('Gun'), mg4: FIREARM('Gun'),
  semi_auto_rifle: FIREARM('Gun'), semi_auto_pistol: FIREARM('Gun'), simple_revolver: FIREARM('Gun'), single_shot_shotgun: FIREARM('Gun'), double_barrel_shotgun: FIREARM('Gun'), rocket_launcher: FIREARM('Gun'),
  ammo_12g: FIREARM('Ammunition'), ammo_12g_ap: FIREARM('Ammunition'), ammo_556: FIREARM('Ammunition'), ammo_556_he: FIREARM('Ammunition'), ammo_762: FIREARM('Ammunition'), ammo_762_he: FIREARM('Ammunition'), ammo_9mm: FIREARM('Ammunition'), rocket_ammo: FIREARM('Ammunition'),
  barrel_bomb: FIREARM('Explosive'), dirt_grenade: FIREARM('Explosive'), improved_grenade: FIREARM('Explosive'), handmade_explosives: FIREARM('Explosive'), military_c4: FIREARM('Explosive'),
});

/** Items considered for ADD. The audit's answer is that none should be added now. */
export const ADD_CANDIDATES_REVIEWED: readonly { li: string; verdict: 'REJECTED' | 'BACKLOG'; why: string }[] = [
  { li: 'electronic_parts', verdict: 'REJECTED', why: 'Would split the Parts contention the Bible relies on (K4).' },
  { li: 'torsion_spring', verdict: 'REJECTED', why: 'Firearm-only.' },
  { li: 'tin_can', verdict: 'REJECTED', why: 'No spoilage mechanic.' },
  { li: 'animal_fat', verdict: 'REJECTED', why: 'Duplicates existing fuel routes.' },
  { li: 'energy_refinery / energy_extractor', verdict: 'BACKLOG', why: 'Unapproved Energy Ore backlog; explicitly out of scope.' },
];
