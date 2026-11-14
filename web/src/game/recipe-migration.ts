// PA1 R1 — RECIPE / JOB MIGRATION LEDGER (2026-11-13).
//
// Why this file exists: `persist.ts` validates a saved station job against the
// CURRENT catalog (station identity, duration and — for the refinery — the exact
// reserved inputs), and `engine.stepStations` commits the output of the CURRENT
// recipe. A bare BOM rewrite therefore either bricks an old save (validation
// rejects it and the run becomes unopenable) or silently pays a new yield for
// old inputs (a material mint). Both violate the Creator conservation law
// (`bible.md` K1/K4: one payment, no free duplication).
//
// Rule: every recipe a cutover changes or retires gets its previous definition
// frozen here under `<id>@<revision it was live in>`. A job is stamped with the
// revision in force when it was queued (`Job.rv`) and is always resolved through
// `recipeAtRevision`. Saved economics never move. Jobs written BEFORE stamping
// existed (no `rv`) resolve against revision 1 when this cutover superseded that
// recipe, and against the live table otherwise — i.e. they receive exactly what
// they paid for, and nothing is re-priced underneath a queued job.
//
// Provenance of the new (revision 2) definitions: `docs/design/pa1-recovery/
// PA1_RECOVERED_RECIPE_PROVENANCE_15.csv` (v1.1 recovered paper BOMs) with the
// `docs/design/PA1_OIL_MOBILITY_V1_2_ACCEPTANCE.md` v1.2 dry-kit override.
// Nothing in this file invents a Last Island number: the retired `fuel_can`
// direct recipe and the dangling `fuel_can.studyRecipe` pointer are removed
// because v1.2 §2 orders it, and the retired definition is kept here so old
// queued jobs and old held blueprints stay loadable.
import type { Recipe } from './catalog';

/** Live catalog revision. Bump by exactly 1 whenever a recipe is changed or retired,
 *  and freeze the superseded definition in `LEGACY_RECIPES` under `<id>@<old rev>`. */
export const RECIPE_REVISION = 3;

/** The revision a save written before job stamping existed must resolve to. */
export const PRE_STAMPING_REVISION = 1;

/** FROZEN definitions. Never edit or delete an entry; a save may still hold a job
 *  stamped with that revision. A new cutover APPENDS a key and bumps RECIPE_REVISION. */
export const LEGACY_RECIPES: Readonly<Record<string, Recipe>> = Object.freeze({
  // Rev 1 — live values before the PA1 recipe cutover.
  'metal_pipe@1': { out: 'metal_pipe', qty: 1, ins: [['refined_iron_ingot', 2], ['mechanical_parts', 1]], station: 'workbench', stationLevel: 2, secs: 18, base: true, tier: 2 },
  'mechanical_gear@1': { out: 'mechanical_gear', qty: 1, ins: [['iron_ingot', 2], ['mechanical_parts', 2], ['fasteners', 1]], station: 'workbench', stationLevel: 2, secs: 20, base: true, tier: 2 },
  'iron_plate@1': { out: 'iron_plate', qty: 2, ins: [['refined_iron_ingot', 2], ['metal_pipe', 1], ['mechanical_parts', 1]], station: 'workbench', stationLevel: 2, secs: 18, base: true, tier: 2 },
  // v1.1 kit: two raw ingots and, in the retired paper master, a packaged fuel can.
  'motorbike_kit@1': { out: 'motorbike_kit', qty: 1, ins: [['vehicle_frame', 1], ['vehicle_drive', 1], ['iron_ingot', 2], ['fasteners', 2]], station: 'workbench', stationLevel: 3, secs: 40, tier: 2 },
  // RETIRED at rev 2 (v1.2 §2): the workbench "anyone can improvise a canister"
  // shortcut is gone. Fuel comes from a real Furnace study route or an Oil Refinery.
  'fuel_can@1': { out: 'fuel_can', qty: 1, ins: [['charcoal', 1], ['sulfur', 1], ['glass', 1]], station: 'workbench', stationLevel: 2, secs: 20, tier: 2 },
  // Rev 2 — live values before the Item Ontology V2 cutover (Control Tower ruling, PR #61 round 2).
  // P3: the plain frame is superseded by the piped BOM; the piped alternative id is retired.
  'vehicle_frame@2': { out: 'vehicle_frame', qty: 1, ins: [['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2]], station: 'workbench', stationLevel: 2, secs: 25, base: true, tier: 1 },
  'vehicle_frame_piped@2': { out: 'vehicle_frame', qty: 1, alias: 'Utility Frame (piped)', ins: [['metal_pipe', 1], ['iron_ingot', 2], ['mechanical_parts', 2], ['spares', 2]], station: 'workbench', stationLevel: 2, secs: 22, base: true, tier: 2 },
  // P4: the Salvager Axe took two Machine Parts and no Blade.
  'industrial_axe@2': { out: 'industrial_axe', qty: 1, ins: [['iron_axe', 1], ['mechanical_parts', 2], ['spares', 2]], station: 'workbench', stationLevel: 2, secs: 25, tier: 2 },
});

/** Recipe ids removed from the live catalog by a cutover, in the order retired.
 *  Knowledge carrying one of these ids is pruned on load; a queued job or a held
 *  blueprint referencing it stays valid through `LEGACY_RECIPES`. */
export const RETIRED_RECIPES: readonly string[] = ['fuel_can', 'vehicle_frame_piped'];
export const isRetiredRecipe = (id: unknown): boolean =>
  typeof id === 'string' && RETIRED_RECIPES.includes(id);
/** A blueprint may legally name a retired formula: the paper is a real item the
 *  player earned, and deleting it from a save would be a silent material loss. */
export const hasLegacyDefinition = (id: unknown): boolean => latestLegacyDefinition(id) !== null;
/** The newest frozen definition of a recipe id, whatever revision retired or changed it. */
export function latestLegacyDefinition(id: unknown): Recipe | null {
  if (typeof id !== 'string') return null;
  for (let rev = RECIPE_REVISION - 1; rev >= PRE_STAMPING_REVISION; rev--) {
    const key = `${id}@${rev}`;
    if (Object.prototype.hasOwnProperty.call(LEGACY_RECIPES, key)) return LEGACY_RECIPES[key];
  }
  return null;
}

/** Which revisions this cutover touched — used by save migration and by tests that
 *  must prove a legacy job is not re-priced. */
export const CUT_OVER_REVISIONS: Readonly<Record<number, readonly string[]>> = Object.freeze({
  1: ['metal_pipe', 'mechanical_gear', 'iron_plate', 'motorbike_kit', 'fuel_can'],
  2: ['vehicle_frame', 'vehicle_frame_piped', 'industrial_axe'],
});

/** The definition a job queued at `rev` must be paid out under.
 *  - `rev === undefined`: a save written before stamping existed; it resolves as
 *    revision 1, so an old payment never buys a later (larger or different) recipe.
 *  - `rev === RECIPE_REVISION`: the live table.
 *  - any older revision: the oldest frozen entry at or after it, else the live table
 *    (an unchanged recipe has one definition valid across every revision).
 *  - a revision NEWER than this build: null, and the save fails closed. */
export function recipeAtRevision(id: string, rev: number | undefined, live: Record<string, Recipe>): Recipe | null {
  const current = Object.prototype.hasOwnProperty.call(live, id) ? live[id] : null;
  // A save written before stamping existed was written while revision 1 was live.
  if (rev === undefined) rev = PRE_STAMPING_REVISION;
  if (rev > RECIPE_REVISION) return null;
  if (rev === RECIPE_REVISION) return current;
  // The definition in force at `rev` is the OLDEST frozen entry at or after it: a recipe untouched by
  // the rev-1 cutover but changed at rev 2 was still its `@2` definition while revision 1 was live.
  for (let at = rev; at < RECIPE_REVISION; at++) {
    const key = `${id}@${at}`;
    if (Object.prototype.hasOwnProperty.call(LEGACY_RECIPES, key)) return LEGACY_RECIPES[key];
  }
  return current;
}
/** The station a saved job belongs to, resolved at the job's own revision. A
 *  retired recipe keeps its historical station so an old queue still validates. */
export function jobStationAtRevision(id: string, rev: number | undefined, live: Record<string, Recipe>): string | null {
  const rc = recipeAtRevision(id, rev, live);
  return rc ? rc.station : null;
}

/** ---------- Research families (recovered paper v1.1 §3, names only) ----------
 * Paper lists eleven families. ONLY `ENERGY` has a recovered material cost
 * (`5 spares + 2 iron_ingot`, one-time, atomic). Every other family fee is
 * `OPEN_DESIGN` and MUST NOT be enforced: `price === null` means "no gate", and
 * the runtime refuses to unlock a family without an authorized price rather than
 * inventing one. Armor discovery patterns and Creator-Core studies stay on their
 * own mechanisms and are never merged into this table. */
export type ResearchFamily = {
  id: string;
  /** null = family name is known but its price is not decided: no gate is applied. */
  price: [string, number][] | null;
  status: 'SOURCE_APPROVED' | 'OPEN_DESIGN';
  /** Whether membership in this family withholds the formula from starter knowledge.
   *  `false` keeps the family as a recorded, purchasable ledger WITHOUT changing what a
   *  survivor can already craft today. The recovered paper names the families and the
   *  ENERGY price; it never says the shipped Refinery / Oil Pump / Field Generator packs
   *  were locked behind a study, and the Control Tower ordered starter crafting preserved,
   *  so enforcement is an OPEN DESIGN DECISION (see OPERATIONS ledger) rather than a
   *  fact this increment may invent. Flipping one flag here is all a future approval needs. */
  enforce: boolean;
  note: string;
};
export const RESEARCH_FAMILIES: Readonly<Record<string, ResearchFamily>> = Object.freeze({
  ENERGY: { id: 'ENERGY', price: [['spares', 5], ['iron_ingot', 2]], status: 'SOURCE_APPROVED', enforce: false, note: 'Recovered v1.1 ENERGY starter study materials (5 Parts + 2 Iron Ingot), one-time paid unlock. Its three packed devices are still starter knowledge in this build, so the study records the unlock and grants anything the survivor did not already know; it does not take what they already have.' },
  METALLURGY: { id: 'METALLURGY', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN. No runtime gate until the Creator sets a cost.' },
  MOBILITY: { id: 'MOBILITY', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN. The v1.2 dry kit is a recipe correction, not a paid unlock.' },
  ELECTRICAL: { id: 'ELECTRICAL', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Wire hardware (cables, switches, sensors) is documented as a family; price UNKNOWN, so the survival bootstrap stays open.' },
  AGRICULTURE: { id: 'AGRICULTURE', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN.' },
  ARMORY: { id: 'ARMORY', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN. Armor patterns stay tied to first-pickup discovery, NOT to this family.' },
  EXPLORATION: { id: 'EXPLORATION', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN.' },
  ARCANA: { id: 'ARCANA', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN.' },
  STEEL: { id: 'STEEL', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Gates the paper `steel_ingot` item and the 45 upper-tier upgrade costs; BOTH are unapproved. Nothing may be gated here yet.' },
  DEFENSE: { id: 'DEFENSE', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Family name recovered; price UNKNOWN.' },
  CORE_SPECIFIC: { id: 'CORE_SPECIFIC', price: null, enforce: false, status: 'OPEN_DESIGN', note: 'Seven per-Core studies; costs UNKNOWN and must never be merged with the four armor discovery patterns.' },
});
/** Recipe → family. Only recipes whose membership is evidenced are listed; an
 *  unlisted recipe has NO family gate and keeps its current knowledge authority. */
export const RECIPE_FAMILY: Readonly<Record<string, string>> = Object.freeze({
  // Energy PRODUCTION installations. The refinery, the pump and the base
  // generator are the physical plant of the energy chain, so the recovered
  // ENERGY starter study pays for exactly these three packed devices.
  deploy_refinery: 'ENERGY',
  deploy_oil_pump: 'ENERGY',
  deploy_base_generator: 'ENERGY',
  // PA1 P1: the same recovered chapter prices the WORK that plant does — pumping crude
  // and refining it into canisters and lubricant. Membership declares what the ENERGY
  // study covers; it withholds nothing while `enforce` is undecided (see the note on
  // RESEARCH_FAMILIES.ENERGY), so starter crafting stays exactly as the Control Tower
  // ordered. Flipping that one flag is all a future approval needs.
  // Deliberately NOT a member: `refine_salvaged_oil`, the furnace salvage fallback. It is a
  // survival path for players with no refinery, not part of the approved energy plant, and it
  // is not free starter knowledge — claiming it would make the study the only way to run a
  // generator, which the recovered paper does not say.
  pump_crude: 'ENERGY',
  refinery_crude: 'ENERGY',
  refinery_fuel: 'ENERGY',
  refinery_fuel_batch: 'ENERGY',
  refinery_industrial: 'ENERGY',
  refinery_lubricant: 'ENERGY',
});
export const familyOfRecipe = (id: string): string | null =>
  Object.prototype.hasOwnProperty.call(RECIPE_FAMILY, id) ? RECIPE_FAMILY[id] : null;
/** True only when a family is priced AND its enforcement is approved: a recipe is
 *  withheld from starter knowledge exactly in that case. */
export const isFamilyGated = (id: string): boolean => {
  const fam = familyOfRecipe(id);
  return !!fam && RESEARCH_FAMILIES[fam].price !== null && RESEARCH_FAMILIES[fam].enforce;
};
export const familyEnforced = (family: string): boolean =>
  !!RESEARCH_FAMILIES[family] && RESEARCH_FAMILIES[family].price !== null && RESEARCH_FAMILIES[family].enforce;
/** A family can only be bought while its price is decided. */
export const purchasableFamilies = (): string[] =>
  Object.values(RESEARCH_FAMILIES).filter(f => f.price !== null).map(f => f.id);
/** Members of a family, in a stable order. */
export const familyMembers = (family: string): string[] =>
  Object.keys(RECIPE_FAMILY).filter(k => RECIPE_FAMILY[k] === family).sort();
