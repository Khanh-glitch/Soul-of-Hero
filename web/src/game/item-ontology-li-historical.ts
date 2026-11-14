/**
 * Item Ontology V2 — Last Island HISTORICAL crosswalk (137 historical ids vs the 86-id atlas crosswalk).
 *
 * REFERENCE-ONLY. Nothing here is imported by the game runtime, and the historical CSV is never a catalog input.
 * The 137 ids are multi-version, multi-mode evidence about another game. They are NOT a parity target:
 * no SOH item, recipe, id or price is added, renamed or changed because of this file.
 *
 * Inputs (delivered by Control Tower on PR #61, issuecomment-6878834990; bytes pinned by test):
 *   web/ref/item-ontology-v2/li-historical/LI_137_ITEM_HISTORICAL_ATLAS_AUDIT.csv
 *   web/ref/item-ontology-v2/li-historical/LI_137_VS_86_ITEM_DIFF_20261114.txt
 *
 * Every historical id gets one explicit decision. The 84 ids shared with the atlas keep the verdict already
 * recorded in LI_CROSSWALK (it is read, not retyped); the 53 historical-only ids are decided in HISTORICAL_ONLY.
 * Figures the source does not support stay UNKNOWN.
 */
import { LI_CROSSWALK, type LiVerdict } from './item-ontology-decisions';

export const LI_HISTORICAL_INPUTS = Object.freeze({
  dir: 'ref/item-ontology-v2/li-historical',
  csv: { name: 'LI_137_ITEM_HISTORICAL_ATLAS_AUDIT.csv', drive_id: '15_nzs8tyEV7QlzUt18N7Kc48sBzdcsk3', bytes: 36494, lines: 138,
    sha256: 'e4a1b066429d7afc8b9e91dc024ceed317058738e45163f02662d6315a4570c5' },
  diff: { name: 'LI_137_VS_86_ITEM_DIFF_20261114.txt', drive_id: '10rDJar3QgbjMSrD42XsT_omA32WXiAIR', bytes: 9323, lines: 79,
    sha256: '67b8fb988ddda6039fee6d21f048f527dc6931eebc54cbc80271aca572430d04' },
});

export type LiGrade = 'ATLAS_INDEXED' | 'EXTERNAL_CRAFT_OR_INPUT' | 'OFFICIAL_MODERN' | 'NOT_IN_HISTORICAL_SET';
/** How the historical id relates to the 86-id atlas / to SOH. */
export type LiRelation =
  | 'EXACT_ID'              // same id in the historical set and in the atlas crosswalk
  | 'ALIAS_OF_ATLAS_ID'     // another name for an id the atlas already has
  | 'ALIAS_OF_SOH_ITEM'     // the same thing SOH already has under its own id
  | 'VERSION_VARIANT'       // an older / alternative-edition form of an atlas id
  | 'EVENT_LIMITED'         // dated event content or an input only an event recipe uses
  | 'MODERN_ADDITION'       // graded OFFICIAL_MODERN: later official content, absent from the older atlas
  | 'DISTINCT_HISTORICAL'   // a separate historical item with no atlas id
  | 'ATLAS_ONLY_NAMING';    // in the atlas, absent from the historical set (naming / version difference)
/** Whether the GAMEPLAY ROLE exists in SOH. Independent of whether the id exists. */
export type LiRoleStatus =
  | 'ROLE_PRESENT'
  | 'ROLE_PRESENT_DIFFERENT_SHAPE'
  | 'NO_MECHANIC'           // SOH has no system that would use it; importing it would create a useless item
  | 'DECLINED_REDUNDANT'    // the mechanic exists and something already holds the role; one more would be count, not depth
  | 'EVENT_ONLY'            // not a standing gameplay role
  | 'BACKLOG'
  | 'DESIGN_CANDIDATE';     // SOH has the slot or system and no item in this position. A candidate for the owning area to weigh. NOT approved, NOT added.

export interface HistDecision { relation: LiRelation; related: string; role: string; soh: string; verdict: LiVerdict; status: LiRoleStatus; why: string }
const H = (relation: LiRelation, related: string, role: string, soh: string, verdict: LiVerdict, status: LiRoleStatus, why: string): HistDecision =>
  ({ relation, related, role, soh, verdict, status, why });
const GUN = 'SOH has no gun mechanic (ranged combat is bow + Creator Core).';

/** The 53 ids that are in the historical set and not in the 86-id atlas crosswalk. */
export const HISTORICAL_ONLY: Readonly<Record<string, HistDecision>> = Object.freeze({
  // ── ammunition and explosives: older-edition forms of ids the atlas already carries ──
  ammo_556_base: H('VERSION_VARIANT', 'ammo_556', 'Rifle ammunition, earlier recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', `Earlier-edition recipe of atlas id ammo_556. ${GUN}`),
  ammo_556_he_old: H('VERSION_VARIANT', 'ammo_556_he', 'Explosive rifle ammunition, earlier recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', `Earlier-edition recipe of atlas id ammo_556_he. ${GUN}`),
  ammo_762_base: H('VERSION_VARIANT', 'ammo_762', 'Rifle ammunition, earlier recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', `Earlier-edition recipe of atlas id ammo_762. ${GUN}`),
  ammo_762_he_old: H('VERSION_VARIANT', 'ammo_762_he', 'Explosive rifle ammunition, earlier recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', `Earlier-edition recipe of atlas id ammo_762_he. ${GUN}`),
  ammo_9mm_base: H('VERSION_VARIANT', 'ammo_9mm', 'Pistol ammunition, earlier recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', `Earlier-edition recipe of atlas id ammo_9mm. ${GUN}`),
  ammo_8mm_handmade: H('DISTINCT_HISTORICAL', '-', 'Handmade ammunition', '-', 'NOT_ADDED', 'NO_MECHANIC', `No atlas id; the bench is UNKNOWN in the source. ${GUN}`),
  gunpowder_legacy: H('VERSION_VARIANT', 'gunpowder', 'Propellant, legacy recipe', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Same thing as atlas id gunpowder: the historical CSV gives both ids the identical 30 charcoal + 20 sulfur_powder recipe. Feeds only ammunition and explosives.'),
  explosive_material: H('DISTINCT_HISTORICAL', 'handmade_explosives', 'Explosive intermediate', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Possibly the same thing as atlas id handmade_explosives; the sources do not establish that, so the alias is left UNKNOWN. Bench UNKNOWN. SOH has no demolition or raiding-by-explosive mechanic.'),
  handmade_explosive_pack: H('DISTINCT_HISTORICAL', 'handmade_explosives', 'Placed demolition charge', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Built from explosive_material; relation to atlas id handmade_explosives is UNKNOWN. Bench UNKNOWN. SOH has no demolition or raiding-by-explosive mechanic.'),
  flamethrower: H('DISTINCT_HISTORICAL', '-', 'Fuel-fed weapon', '-', 'NOT_ADDED', 'NO_MECHANIC', `Research unlock with no recorded recipe (inputs UNKNOWN). ${GUN}`),
  molotov_cocktail: H('DISTINCT_HISTORICAL', '-', 'Thrown fire weapon', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Research unlock with no recorded recipe (inputs UNKNOWN). SOH has no thrown-weapon mechanic; the atlas grenades were not added for the same reason.'),
  old_military_mine: H('DISTINCT_HISTORICAL', '-', 'Hidden placed trap', 'deploy_bear_trap', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'The role (a placed trap that punishes whoever steps on it) is held by the Bear Trap and Spike Trap. The explosive form is not added. No recipe or loot recorded.'),
  // ── turrets ──
  auto_rifle_turret: H('DISTINCT_HISTORICAL', '-', 'Automated base defence', 'structure:arrow_turret', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH automated defence is the Arrow Turret, fed with arrows instead of built around a rifle. Bench UNKNOWN.'),
  auto_shotgun_turret: H('DISTINCT_HISTORICAL', 'auto_rifle_turret', 'Automated base defence, shotgun form', '-', 'NOT_ADDED', 'NO_MECHANIC', `Built around a shotgun. ${GUN} The defence role itself is held by the Arrow Turret.`),
  tracking_auto_turret: H('DISTINCT_HISTORICAL', 'auto_rifle_turret', 'Automated base defence, tracking form', '-', 'NOT_ADDED', 'NO_MECHANIC', `Built around an AKM. ${GUN} The defence role itself is held by the Arrow Turret.`),
  rocket_turret: H('DISTINCT_HISTORICAL', 'auto_rifle_turret', 'Automated base defence, rocket form', '-', 'NOT_ADDED', 'NO_MECHANIC', `Built around a rocket launcher; bench UNKNOWN. ${GUN}`),
  // ── armour ──
  iron_plate_chest: H('DISTINCT_HISTORICAL', '-', 'Body armour, first crafted tier', 'leather_armor', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH first crafted body armour is the Leather Jerkin (hide-based, like the historical recipe, without the plate). Bench UNKNOWN.'),
  refined_iron_chest: H('DISTINCT_HISTORICAL', '-', 'Body armour, top crafted tier', 'chitin_armor', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH top crafted body armour is Chitin Plate, gated by a creature material instead of refined iron. Bench UNKNOWN.'),
  iron_plate_helmet: H('DISTINCT_HISTORICAL', '-', 'Head armour, first crafted tier', 'scrap_helm', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH head armour is the Scrap Helm (metal + leather). Bench UNKNOWN.'),
  refined_iron_helmet: H('DISTINCT_HISTORICAL', '-', 'Head armour, second crafted tier', '-', 'NOT_ADDED', 'DESIGN_CANDIDATE', 'SOH already has head protection: a head slot and the Scrap Helm (-10%). What it does not have is a second head-armour tier, where the body slot has three steps. Candidate for an additional tier, for the item owner to weigh; not approved and not added. Bench UNKNOWN.'),
  iron_plate_boots: H('DISTINCT_HISTORICAL', '-', 'Foot armour', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH equipment slots are head, body and back. There is no foot slot. Bench UNKNOWN.'),
  iron_plate_pants: H('DISTINCT_HISTORICAL', '-', 'Leg armour', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH equipment slots are head, body and back. There is no leg slot. Bench UNKNOWN.'),
  refined_iron_boots: H('DISTINCT_HISTORICAL', '-', 'Foot armour, top tier', '-', 'NOT_ADDED', 'NO_MECHANIC', 'No foot slot in SOH. Bench UNKNOWN.'),
  refined_iron_legs: H('DISTINCT_HISTORICAL', '-', 'Leg armour, top tier', '-', 'NOT_ADDED', 'NO_MECHANIC', 'No leg slot in SOH. Bench UNKNOWN.'),
  animal_hide: H('ALIAS_OF_SOH_ITEM', '-', 'Hunted hide, armour input', 'hide', 'HAVE_SAME_ROLE', 'ROLE_PRESENT', 'SOH Raw Hide: dropped by hunted animals, cured into Leather, which every crafted armour piece spends.'),
  needle_thread: H('DISTINCT_HISTORICAL', '-', 'Armour binder', '-', 'NOT_ADDED', 'DECLINED_REDUNDANT', 'The binder step in SOH armour recipes is Rope or Leather. A dedicated binder would add a step with no decision in it. Bench UNKNOWN.'),
  // ── event content and its inputs ──
  birthday_cake_2022: H('EVENT_LIMITED', '-', '2022 anniversary event item', '-', 'NOT_ADDED', 'EVENT_ONLY', 'Dated event content (official notice 2022-11-09, event 11-10 to 11-16): 10 cream + 10 egg + 10 flour, edible, restores hunger and HP. Not a standing gameplay role.'),
  reunion_mooncake_lottery_pack: H('EVENT_LIMITED', '-', 'Festival lottery pack', '-', 'NOT_ADDED', 'EVENT_ONLY', 'Dated event content with a lottery payout. Not a standing gameplay role.'),
  cream: H('EVENT_LIMITED', 'birthday_cake_2022', 'Event recipe input', '-', 'NOT_ADDED', 'EVENT_ONLY', 'Event drop from barrels, crates and monsters during the 2022 event (official notice 2022-11-09). The only recorded use is the cake; any other use is UNKNOWN.'),
  flour: H('EVENT_LIMITED', 'birthday_cake_2022', 'Event recipe input', '-', 'NOT_ADDED', 'EVENT_ONLY', 'Event drop from barrels, crates and monsters during the 2022 event (official notice 2022-11-09). The only recorded use is the cake; any other use is UNKNOWN.'),
  egg_flour: H('EVENT_LIMITED', 'reunion_mooncake_lottery_pack', 'Event recipe input', '-', 'NOT_ADDED', 'EVENT_ONLY', 'The only recorded use is the mooncake pack. Source and any other use are UNKNOWN.'),
  red_bean_paste: H('EVENT_LIMITED', 'reunion_mooncake_lottery_pack', 'Event recipe input', '-', 'NOT_ADDED', 'EVENT_ONLY', 'The only recorded use is the mooncake pack. Source and any other use are UNKNOWN.'),
  egg: H('DISTINCT_HISTORICAL', '-', 'Animal product', 'grouse_egg', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH has the Grouse Egg: laid by fed, penned Black Grouse and eaten as food. The only documented historical egg is an event drop used for the 2022 cake (official notice 2022-11-09); whether it existed outside that event is UNKNOWN.'),
  // ── plants and seeds ──
  nettle: H('DISTINCT_HISTORICAL', '-', 'Gathered fibre plant', 'fiber', 'HAVE_SAME_ROLE', 'ROLE_PRESENT', 'The atlas names nettle as the plant source of Cloth. SOH gathers Plant Fiber and weaves Cloth from it.'),
  nettle_seed: H('DISTINCT_HISTORICAL', 'nettle', 'Crop seed', 'seed', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH farming uses one generic Wild Seeds item in a Garden Plot (it grows Sunroot, not fibre). The planting role exists; a per-crop seed does not.'),
  wild_berry_seed: H('DISTINCT_HISTORICAL', 'wild_berry', 'Crop seed', 'seed', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'Same as nettle_seed: one generic Wild Seeds item. Berries in SOH are gathered from regrowing bushes.'),
  // ── access cards ──
  green_card: H('DISTINCT_HISTORICAL', '-', 'POI access card, lowest tier', 'keycard', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH has one physical Vault Keycard, not a colour ladder. Veyra has 0 keycard doors and none is added.'),
  blue_card: H('DISTINCT_HISTORICAL', 'green_card', 'POI access card, middle tier', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH has a single access tier; there is no door that would ask for a second colour.'),
  purple_card: H('DISTINCT_HISTORICAL', 'green_card', 'POI access card, top tier', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH has a single access tier; there is no door that would ask for a third colour.'),
  // ── other externally-sourced ids ──
  charcoal: H('ALIAS_OF_SOH_ITEM', '-', 'Burnt-wood input', 'charcoal', 'HAVE_SAME_ROLE', 'ROLE_PRESENT', 'Same id and same origin (wood). In the historical recipes it feeds gunpowder; in SOH it is fuel and an input to Fuel Briquettes and industrial Energy. No change needed.'),
  large_furnace: H('DISTINCT_HISTORICAL', '-', 'Second smelting tier', 'structure:furnace', 'HAVE_DIFFERENT_SHAPE', 'ROLE_PRESENT_DIFFERENT_SHAPE', 'SOH upgrades the one Furnace in place (kiln lining at Workbench level 2: better fuel economy) instead of building a second, larger structure. The historical throughput is an open question in the atlas itself (U04) and stays UNKNOWN.'),
  low_quality_fuel_can: H('ALIAS_OF_ATLAS_ID', 'low_quality_fuel', 'Portable fuel', 'fuel_can', 'HAVE_SAME_ROLE', 'ROLE_PRESENT', 'Container name for atlas id low_quality_fuel, already crosswalked to the Fuel Canister.'),
  territory_cabinet: H('ALIAS_OF_SOH_ITEM', '-', 'Land claim', 'structure:claim', 'HAVE_SAME_ROLE', 'ROLE_PRESENT', 'SOH structure `claim` is the Territory Cabinet. The historical 1000-wood hand recipe is not copied; SOH cost is unchanged.'),
  iron_folding_ladder: H('VERSION_VARIANT', 'steel_folding_ladder', 'Climbing', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Iron form of atlas id steel_folding_ladder (same recipe shape: wooden ladder + gears + metal). Bench UNKNOWN. No vertical traversal mechanic in SOH.'),
  glider_legacy: H('DISTINCT_HISTORICAL', '-', 'Aerial traversal', '-', 'NOT_ADDED', 'NO_MECHANIC', 'No flight or vertical traversal in SOH. Bench UNKNOWN.'),
  // ── OFFICIAL_MODERN (8) ──
  bizon_smg: H('MODERN_ADDITION', 'smg', 'Firearm', '-', 'NOT_ADDED', 'NO_MECHANIC', `Later official firearm, crate loot only. ${GUN}`),
  flamethrower_gas_ammo: H('MODERN_ADDITION', 'flamethrower', 'Weapon fuel', '-', 'NOT_ADDED', 'NO_MECHANIC', `Ammunition for the flamethrower. ${GUN}`),
  electric_resistor: H('MODERN_ADDITION', '-', 'POI power-repair part', '-', 'NOT_ADDED', 'NO_MECHANIC', 'The official notice of 2022-11-09 documents only that the toolbox category drops it. The POI power-repair role comes from an atlas source description (generator/resistor dependency), not from that notice. SOH points of interest have no power-repair step. Quantities are UNKNOWN.'),
  inferno_chariot: H('MODERN_ADDITION', '-', 'Armed vehicle', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH vehicles (Hand Cart, Utility Motorbike) carry and move; there is no vehicle combat.'),
  inferno_chariot_blueprint: H('MODERN_ADDITION', 'inferno_chariot', 'Recipe unlock for the armed vehicle', '-', 'NOT_ADDED', 'NO_MECHANIC', 'SOH already unlocks recipes with its generic Blueprint item; what this one unlocks has no mechanic in SOH.'),
  mountain_bicycle_blueprint: H('MODERN_ADDITION', '-', 'Recipe unlock for a one-seat pedalled vehicle', '-', 'NOT_ADDED', 'DESIGN_CANDIDATE', 'Not simply fuel-free. Official notice 2022-11-09: pedalling consumes the air in the rider\'s lungs, faster pedalling consumes it faster, coasting restores it, and once it is used up the rider loses HP. One seat; can be picked back up; cannot be placed in a radiation zone. SOH has the Hand Cart and the fuelled Utility Motorbike and the Blueprint unlock mechanism, and no exertion-for-speed vehicle. Vehicle design candidate for the vehicle owner; not approved and not added.'),
  self_revive_defibrillator: H('MODERN_ADDITION', '-', 'Self-revive from the downed state', '-', 'NOT_ADDED', 'NO_MECHANIC', 'Official notice 2022-11-09: used while downed, takes 10 seconds, stops the downed bleed, cancelled by moving. SOH death goes straight to respawn; there is no downed state to recover from.'),
  suicide_robot: H('MODERN_ADDITION', '-', 'Deployed explosive drone', '-', 'NOT_ADDED', 'NO_MECHANIC', 'No drone or demolition mechanic in SOH.'),
});

// ── Source support (derived; the hash-pinned historical CSV is never edited) ─────────────────────────────────────
/** The one official page read for this correction. Used only for the ids it actually documents. */
export const OFFICIAL_NOTICE_2022 = Object.freeze({
  url: 'https://hero.yingxiong.com/info/2022/1109/13052.html',
  date: '2022-11-09',
  title: 'Official maintenance notice dated 2022-11-09 for the 2022-11-10 update',
});
export type NoticeKind = 'ANNOUNCED_AS_NEW' | 'EVENT' | 'DROP_CATEGORY_ONLY' | 'NAMED_ONLY';
export interface NoticeEvidence { kind: NoticeKind; quote: string; documents: string }
const N = (kind: NoticeKind, quote: string, documents: string): NoticeEvidence => ({ kind, quote, documents });
/** What the notice says, by historical id. `quote` is the notice's own text. Nothing outside this table takes its date. */
export const NOTICE_EVIDENCE: Readonly<Record<string, NoticeEvidence>> = Object.freeze({
  mountain_bicycle_blueprint: N('ANNOUNCED_AS_NEW', '新载具-山地自行车 … 所有工具箱有几率掉落自行车图纸 … 踩动自行车时将消耗人物肺部的空气 … 在肺部空气消耗完毕时会开始扣除人物血量', 'New one-seat vehicle; blueprint can drop from every toolbox; pedalling consumes lung air and exhaustion costs HP.'),
  self_revive_defibrillator: N('ANNOUNCED_AS_NEW', '新道具-自救除颤器 … 击杀港口boss每次必掉落4个 … 可在倒地状态下使用，使用时间为10秒', 'New revive item; dropped by the port boss and the Avenger; used while downed over 10 seconds.'),
  electric_resistor: N('DROP_CATEGORY_ONLY', '工具箱类（掉落电阻丝、近战武器、防御装置等）', 'Only that the toolbox category drops it. Its function is not described.'),
  birthday_cake_2022: N('EVENT', '使用奶油*10、鸡蛋*10、面粉*10可制作狂欢蛋糕，蛋糕可以食用，增加饥饿值和生命值', 'Event recipe and effect, 2022-11-10 to 2022-11-16. The notice calls it 狂欢蛋糕 in the recipe line and 生日蛋糕 in the exchange line.'),
  cream: N('EVENT', '打碎油桶、开箱子、击杀怪物，有概率获得奶油、鸡蛋、面粉等物品', 'Event drop and cake input.'),
  egg: N('EVENT', '打碎油桶、开箱子、击杀怪物，有概率获得奶油、鸡蛋、面粉等物品', 'Event drop and cake input.'),
  flour: N('EVENT', '打碎油桶、开箱子、击杀怪物，有概率获得奶油、鸡蛋、面粉等物品', 'Event drop and cake input.'),
  glider_legacy: N('NAMED_ONLY', '【修复】滑翔翼在空中离线无法降落的问题', 'A glider exists at this date. The "legacy" recipe is not described.'),
  iron_folding_ladder: N('NAMED_ONLY', '【修复】铁质折叠梯子|新纪元远距离下显示透明的问题', 'The item exists at this date. No recipe.'),
  large_furnace: N('NAMED_ONLY', '大熔炉|雷霆之怒', 'Named as a skin target. No recipe or throughput.'),
  territory_cabinet: N('NAMED_ONLY', '领地柜|雷霆之怒', 'Named as a skin target. No recipe.'),
  green_card: N('NAMED_ONLY', '低级补给箱（绿卡房产出）', 'Green-card rooms are named. The card item itself is not described.'),
  blue_card: N('NAMED_ONLY', '中级补给箱（蓝卡房产出）', 'Blue-card rooms are named. The card item itself is not described.'),
  purple_card: N('NAMED_ONLY', '高级补给箱（紫卡房产出）', 'Purple-card rooms are named. The card item itself is not described.'),
});

/**
 * DIRECT                a source opened for this work documents the id itself (its own atlas entry, or the official notice).
 * INDIRECT              a source opened for this work only refers to it (atlas ingredient / loot reference or prose mention; named in passing in the notice).
 * LEGACY_CLAIM          rests on a cited external page that was NOT re-read here. Neither confirmed nor refuted.
 * UNSUPPORTED_CITATION  the cited source was opened and does not contain the id, and nothing else opened here supports it.
 * DIRECT means the id is documented, not that every figure on the row is.
 */
export type SourceSupport = 'DIRECT' | 'INDIRECT' | 'LEGACY_CLAIM' | 'UNSUPPORTED_CITATION';
export type CitationCheck =
  | 'CITED_SOURCE_CONTAINS_ID'        // cites ATLAS_v2.json and the id is an atlas id
  | 'CITED_SOURCE_MENTIONS_ONLY'      // cites ATLAS_v2.json; the id is not an atlas id but the string occurs inside another name or in prose
  | 'CITED_SOURCE_LACKS_ID'           // cites ATLAS_v2.json and the string does not occur in it at all
  | 'CITED_SOURCE_READ_AND_SUPPORTS'  // cites the official notice and the notice documents it
  | 'CITED_SOURCE_NOT_REREAD'         // cites an external page that was not re-read in this correction
  | 'NOT_APPLICABLE';

/** SOH side: defined in the catalog vs usable by a player in live play. Derived from catalog flags and the projection, not from a play session. */
export type SohLive = 'LIVE_PLAYER_FUNCTION' | 'LIVE_WITH_LIMIT' | 'CATALOG_PRESENT_NOT_LIVE' | 'NOT_APPLICABLE';
export interface LiveInputs {
  /** item id -> runtime_reachability from the ontology projection (manifest.csv) */
  reachability: Readonly<Record<string, string>>;
  /** structures the catalog marks MODULE_PENDING (not player-buildable) */
  pendingStructures: readonly string[];
  /** structures with no player route (item-ontology UNOBTAINABLE_STRUCTURES) */
  unobtainableStructures: readonly string[];
}
/** Limits that reachability alone cannot show: the SOH item is live, the Last Island ROLE it is matched to is only partly live. */
export const LIVE_LIMITS: Readonly<Record<string, string>> = Object.freeze({
  crude_oil: 'Salvaged Oil is live (salvage bonus, vendor). The Last Island role of crude pumped from the ground is NOT live: Crude Petroleum is fixture-only and the Oil Pump produces nothing in live play. This row does not establish a working Oil Pump.',
});

/** Atlas ids that the historical set does not carry. */
export const ATLAS_ONLY: Readonly<Record<string, string>> = Object.freeze({
  raw_iron_ore: 'Atlas naming. The historical set does not list the raw ore as its own id. Decision unchanged from the atlas crosswalk.',
  refined_iron_ore: 'Atlas naming. The historical set does not list the refined ore as its own id. Decision unchanged from the atlas crosswalk.',
});

/** Role status for shared ids whose atlas verdict is NOT_ADDED for a reason other than "no mechanic". */
const SHARED_DECLINED = new Set(['animal_fat', 'grilled_mushroom', 'needle_tube', 'syringe']);

/** Shared ids where the historical `match_soh` column and the atlas verdict point different ways, and which one stands. */
export const SHARED_DISAGREEMENTS: Readonly<Record<string, string>> = Object.freeze({
  canned_meat: 'Historical says missing. Atlas verdict stands: the preserved-food role is Salted Roast.',
  electric_door: 'Historical says missing. The atlas verdict stands for the catalog only: SOH defines the Powered Door structure, but it is MODULE_PENDING and not player-buildable, so for live play the historical reading is right (see soh_live_status).',
  electronic_parts: 'Historical says missing. Atlas verdict stands: powered devices spend Parts in SOH; a separate electronics item was reviewed and rejected.',
  fruit_juice: 'Historical says missing. Atlas verdict stands: thirst is served by water containers and broth.',
  sulfur_powder: 'Historical says missing. Atlas verdict stands: SOH has Sulfur, used for Cores and Essences instead of ammunition.',
  grilled_mushroom: 'Historical says analogy. Atlas verdict stands: the cooked-food role exists, this specific meal was declined as redundant.',
  tin_can: 'Historical says analogy. Atlas verdict stands: with no spoilage mechanic the can has no job.',
});

export interface HistSourceRow { id: string; name: string; group: string; source_evidence: string; match_soh: string; year_mode: string; recipe_input: string; recipe_bench: string; loot: string; source: string }

/** Minimal RFC-4180 reader (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); f = ''; out.push(row); row = []; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); out.push(row); }
  return out;
}
export function parseHistorical(text: string): HistSourceRow[] {
  const [head, ...rows] = parseCsv(text);
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])) as unknown as HistSourceRow);
}

export interface LiHistRow {
  li_id: string; li_name: string; in_historical_137: 'yes' | 'no'; in_atlas_86: 'yes' | 'no';
  provenance_grade: LiGrade; atlas_index_form: string; historical_match_soh: string;
  relation: LiRelation; related_id: string; li_role: string; historical_recipe: string; historical_loot: string;
  soh_equivalent: string; verdict: LiVerdict | 'UNDECIDED'; role_status: LiRoleStatus | 'UNDECIDED';
  agrees_with_historical: 'yes' | 'no' | 'n/a'; why: string;
  /** the historical CSV's own citation, verbatim */
  source: string;
  soh_live_status: SohLive; soh_live_note: string;
  source_support_status: SourceSupport; support_basis: string; citation_check: CitationCheck;
  /** only a source that was opened and found to support the row; '-' otherwise */
  verified_source_url: string;
  /** '2022-11-09 …' only for ids in NOTICE_EVIDENCE; UNKNOWN otherwise */
  evidence_date: string; source_note: string;
}
export const LI_HIST_COLUMNS: (keyof LiHistRow)[] = ['li_id', 'li_name', 'in_historical_137', 'in_atlas_86', 'provenance_grade', 'atlas_index_form',
  'historical_match_soh', 'relation', 'related_id', 'li_role', 'historical_recipe', 'historical_loot', 'soh_equivalent', 'verdict', 'role_status',
  'agrees_with_historical', 'why', 'source', 'soh_live_status', 'soh_live_note', 'source_support_status', 'support_basis', 'citation_check',
  'verified_source_url', 'evidence_date', 'source_note'];

const statusOf = (id: string, v: LiVerdict): LiRoleStatus =>
  v === 'HAVE_SAME_ROLE' ? 'ROLE_PRESENT' : v === 'HAVE_DIFFERENT_SHAPE' ? 'ROLE_PRESENT_DIFFERENT_SHAPE' : v === 'BACKLOG' ? 'BACKLOG'
    : SHARED_DECLINED.has(id) ? 'DECLINED_REDUNDANT' : 'NO_MECHANIC';
const agrees = (m: string, v: string): 'yes' | 'no' => ((m === 'missing') === (v === 'NOT_ADDED' || v === 'BACKLOG') ? 'yes' : 'no');
/** The source's own figures, verbatim. An empty cell is reported as not recorded; UNKNOWN stays UNKNOWN. */
const recipeText = (s: HistSourceRow): string => {
  const ins = s.recipe_input.trim(); const bench = s.recipe_bench.trim();
  if (!ins && !bench) return 'not recorded';
  let body = 'inputs UNKNOWN';
  if (ins && ins !== '{}') { try { body = Object.entries(JSON.parse(ins) as Record<string, number>).map(([k, q]) => `${q} ${k}`).join(' + '); } catch { body = ins; } }
  return `bench ${bench || 'not recorded'}: ${body}`;
};

const ATLAS_PATH = 'web/ref/atlas/extracted/ATLAS_v2.json';
const DATE_TEXT: Record<NoticeKind, string> = {
  ANNOUNCED_AS_NEW: '2022-11-09 (announced as new in the 2022-11-10 update)',
  EVENT: '2022-11-09 (event window 2022-11-10 to 2022-11-16)',
  DROP_CATEGORY_ONLY: '2022-11-09 (named as a drop; introduction date UNKNOWN)',
  NAMED_ONLY: '2022-11-09 (named only; introduction date UNKNOWN)',
};
type Support = Pick<LiHistRow, 'source_support_status' | 'support_basis' | 'citation_check' | 'verified_source_url' | 'evidence_date' | 'source_note'>;
function supportOf(id: string, cited: string, form: string, atlasText: string, grade: string): Support {
  const citesAtlas = cited.includes('ATLAS_v2.json');
  const citesNotice = cited === OFFICIAL_NOTICE_2022.url;
  const entry = form === 'item entry' || form === 'recipe entry';
  const ref = form === 'ingredient or loot reference only';
  const mention = !entry && !ref && atlasText.includes(id);
  const n = NOTICE_EVIDENCE[id];
  const nDirect = !!n && n.kind !== 'NAMED_ONLY';
  const citation_check: CitationCheck = citesAtlas ? (entry || ref ? 'CITED_SOURCE_CONTAINS_ID' : mention ? 'CITED_SOURCE_MENTIONS_ONLY' : 'CITED_SOURCE_LACKS_ID')
    : citesNotice ? (n ? 'CITED_SOURCE_READ_AND_SUPPORTS' : 'CITED_SOURCE_NOT_REREAD') : cited ? 'CITED_SOURCE_NOT_REREAD' : 'NOT_APPLICABLE';
  const status: SourceSupport = entry || nDirect ? 'DIRECT' : ref || mention || n ? 'INDIRECT' : citesAtlas ? 'UNSUPPORTED_CITATION' : 'LEGACY_CLAIM';
  const basis: string[] = [];
  if (entry) basis.push(`ATLAS_${form === 'item entry' ? 'ITEM' : 'RECIPE'}_ENTRY`);
  if (ref) basis.push('ATLAS_INGREDIENT_OR_LOOT_REFERENCE');
  if (mention) basis.push('ATLAS_STRING_MENTION');
  if (n) basis.push(`OFFICIAL_NOTICE_2022_11_09:${n.kind}`);
  if (!basis.length) basis.push(citesAtlas ? 'NONE' : 'CITED_EXTERNAL_PAGE_NOT_REREAD');
  const urls: string[] = [];
  if (entry || ref || mention) urls.push(ATLAS_PATH);
  if (n) urls.push(OFFICIAL_NOTICE_2022.url);
  const notes: string[] = [];
  if (citation_check === 'CITED_SOURCE_LACKS_ID') notes.push(`The historical row cites ATLAS_v2.json, and the string "${id}" does not occur anywhere in that file. The citation is not proof of this row.`);
  if (citation_check === 'CITED_SOURCE_MENTIONS_ONLY') notes.push(`The historical row cites ATLAS_v2.json; "${id}" is not an atlas id there, the string occurs only inside another name or in prose.`);
  if (citation_check === 'CITED_SOURCE_NOT_REREAD') notes.push('The cited external page was not re-read in this correction; the row is carried as a claim.');
  if (n) notes.push(`Official notice: ${n.documents} Notice text: ${n.quote}`);
  if (grade === 'OFFICIAL_MODERN' && !n) notes.push('OFFICIAL_MODERN is the label inherited from the historical CSV. No official source for this id was opened here; the label is not verification.');
  if (grade === 'OFFICIAL_MODERN' && n) notes.push('OFFICIAL_MODERN is an inherited label; here it is backed by the notice to the extent stated.');
  return { source_support_status: status, support_basis: basis.join(' + '), citation_check, verified_source_url: urls.join(' ; ') || '-',
    evidence_date: n ? DATE_TEXT[n.kind] : 'UNKNOWN', source_note: notes.join(' ') || '-' };
}
function liveOf(liId: string, soh: string, verdict: string, live: LiveInputs): Pick<LiHistRow, 'soh_live_status' | 'soh_live_note'> {
  if (verdict !== 'HAVE_SAME_ROLE' && verdict !== 'HAVE_DIFFERENT_SHAPE') return { soh_live_status: 'NOT_APPLICABLE', soh_live_note: '-' };
  const struct = soh.startsWith('structure:') ? soh.slice(10) : soh.startsWith('deploy_') ? soh.slice(7) : null;
  if (struct && live.pendingStructures.includes(struct)) return { soh_live_status: 'CATALOG_PRESENT_NOT_LIVE', soh_live_note: `\`${struct}\` is MODULE_PENDING in the catalog: defined, not player-buildable. The role exists on paper only.` };
  if (struct && live.unobtainableStructures.includes(struct)) return { soh_live_status: 'CATALOG_PRESENT_NOT_LIVE', soh_live_note: `\`${struct}\` has no player route.` };
  if (!soh.startsWith('structure:')) {
    const reach = live.reachability[soh] ?? 'UNKNOWN';
    if (!/SHIPPING|VEYRA/.test(reach)) return { soh_live_status: 'CATALOG_PRESENT_NOT_LIVE', soh_live_note: `Projection reachability: ${reach}.` };
    if (LIVE_LIMITS[liId]) return { soh_live_status: 'LIVE_WITH_LIMIT', soh_live_note: LIVE_LIMITS[liId] };
    if (reach !== 'SHIPPING_AND_VEYRA') return { soh_live_status: 'LIVE_WITH_LIMIT', soh_live_note: `Projection reachability: ${reach}. Not obtainable on the other world.` };
    return { soh_live_status: 'LIVE_PLAYER_FUNCTION', soh_live_note: `Projection reachability: ${reach}.` };
  }
  return { soh_live_status: 'LIVE_PLAYER_FUNCTION', soh_live_note: 'Structure is not MODULE_PENDING and has a player route.' };
}

export interface LiAtlasIndex { items: Record<string, unknown>; recipes: { id: string }[] }

export function buildLiHistorical(csvText: string, atlasIds: readonly string[], atlas: LiAtlasIndex, atlasText: string, live: LiveInputs): LiHistRow[] {
  const src = parseHistorical(csvText);
  const inAtlas = new Set(atlasIds);
  const recipeIds = new Set(atlas.recipes.map((r) => r.id));
  const form = (id: string) => (atlas.items[id] ? 'item entry' : recipeIds.has(id) ? 'recipe entry' : inAtlas.has(id) ? 'ingredient or loot reference only' : 'not an atlas id');
  const rows: LiHistRow[] = src.map((s) => {
    const shared = inAtlas.has(s.id);
    const a = shared ? LI_CROSSWALK[s.id] : undefined;
    const h = shared ? undefined : HISTORICAL_ONLY[s.id];
    const verdict = a?.verdict ?? h?.verdict ?? 'UNDECIDED';
    const agree = agrees(s.match_soh, verdict);
    const why = a ? (SHARED_DISAGREEMENTS[s.id] ? `${a.why} [${SHARED_DISAGREEMENTS[s.id]}]` : a.why) : h?.why ?? '';
    return {
      li_id: s.id, li_name: s.name, in_historical_137: 'yes', in_atlas_86: shared ? 'yes' : 'no',
      provenance_grade: s.source_evidence as LiGrade, atlas_index_form: form(s.id), historical_match_soh: s.match_soh,
      relation: shared ? 'EXACT_ID' : h?.relation ?? 'DISTINCT_HISTORICAL', related_id: h?.related ?? '-',
      li_role: a?.role ?? h?.role ?? 'UNCLASSIFIED', historical_recipe: recipeText(s), historical_loot: s.loot.trim() || 'not recorded',
      soh_equivalent: a?.soh ?? h?.soh ?? '?', verdict,
      role_status: a ? statusOf(s.id, a.verdict) : h?.status ?? 'UNDECIDED',
      agrees_with_historical: verdict === 'UNDECIDED' ? 'n/a' : agree, why, source: s.source,
      ...liveOf(s.id, a?.soh ?? h?.soh ?? '?', verdict, live), ...supportOf(s.id, s.source, form(s.id), atlasText, s.source_evidence),
    };
  });
  const hist = new Set(src.map((s) => s.id));
  for (const id of atlasIds) {
    if (hist.has(id)) continue;
    const a = LI_CROSSWALK[id];
    rows.push({
      li_id: id, li_name: '-', in_historical_137: 'no', in_atlas_86: 'yes', provenance_grade: 'NOT_IN_HISTORICAL_SET', atlas_index_form: form(id),
      historical_match_soh: '-', relation: 'ATLAS_ONLY_NAMING', related_id: '-', li_role: a?.role ?? 'UNCLASSIFIED', historical_recipe: 'not in historical set',
      historical_loot: 'not in historical set', soh_equivalent: a?.soh ?? '?', verdict: a?.verdict ?? 'UNDECIDED',
      role_status: a ? statusOf(id, a.verdict) : 'UNDECIDED', agrees_with_historical: 'n/a', why: `${a?.why ?? ''} [${ATLAS_ONLY[id] ?? 'UNEXPLAINED'}]`.trim(),
      source: ATLAS_PATH,
      ...liveOf(id, a?.soh ?? '?', a?.verdict ?? 'UNDECIDED', live), ...supportOf(id, '', form(id), atlasText, 'NOT_IN_HISTORICAL_SET'),
    });
  }
  return rows.sort((x, y) => (x.li_id < y.li_id ? -1 : x.li_id > y.li_id ? 1 : 0));
}

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const liHistoricalCsv = (rows: LiHistRow[]) =>
  [LI_HIST_COLUMNS.join(','), ...rows.map((r) => LI_HIST_COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

const tally = <T,>(xs: T[], f: (x: T) => string) => { const m = new Map<string, number>(); for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
const tbl = (head: string[], body: (string | number)[][]) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');

export function liHistoricalMd(rows: LiHistRow[]): string {
  const I = LI_HISTORICAL_INPUTS;
  const hist = rows.filter((r) => r.in_historical_137 === 'yes');
  const only = hist.filter((r) => r.in_atlas_86 === 'no');
  const shared = hist.filter((r) => r.in_atlas_86 === 'yes');
  const atlasOnly = rows.filter((r) => r.in_historical_137 === 'no');
  const gaps = rows.filter((r) => r.role_status === 'DESIGN_CANDIDATE');
  const by = (st: SourceSupport) => hist.filter((r) => r.source_support_status === st);
  const unsupported = by('UNSUPPORTED_CITATION');
  const lacks = hist.filter((r) => r.citation_check === 'CITED_SOURCE_LACKS_ID');
  const mentionOnly = hist.filter((r) => r.citation_check === 'CITED_SOURCE_MENTIONS_ONLY');
  const dated = hist.filter((r) => r.evidence_date !== 'UNKNOWN');
  const notLive = rows.filter((r) => r.soh_live_status === 'CATALOG_PRESENT_NOT_LIVE' || r.soh_live_status === 'LIVE_WITH_LIMIT');
  const modern = hist.filter((r) => r.provenance_grade === 'OFFICIAL_MODERN');
  const dis = hist.filter((r) => r.agrees_with_historical === 'no');
  const unknown = hist.filter((r) => /UNKNOWN/.test(r.historical_recipe));
  const names = (xs: LiHistRow[]) => xs.map((r) => `\`${r.li_id}\``).join(', ') || 'none';
  return [
    '# Last Island historical crosswalk — 137 historical ids vs the 86-id atlas',
    '',
    'GENERATED by `web/src/game/item-ontology-li-historical.ts`; checked for drift by `web/tests/item-ontology-v2-li-historical.test.ts`. Do not edit by hand.',
    '',
    '**Reference only.** The 137 ids are multi-version, multi-mode evidence about another game, not a parity target. This crosswalk adds no SOH item, recipe, id or price. The historical files are not read by the game runtime.',
    '',
    '## Inputs',
    '',
    tbl(['File', 'Drive id', 'Bytes', 'Lines', 'SHA-256'], [I.csv, I.diff].map((f) => [`\`${I.dir}/${f.name}\``, `\`${f.drive_id}\``, f.bytes, f.lines, `\`${f.sha256}\``])),
    '',
    '## Counts',
    '',
    `- Historical ids: **${hist.length}**. Atlas crosswalk ids: **${shared.length + atlasOnly.length}**. Shared exact ids: **${shared.length}**. Historical-only: **${only.length}**. Atlas-only: **${atlasOnly.length}** (${names(atlasOnly)}).`,
    `- Rows in this crosswalk: **${rows.length}** (every id on either side, one decision each).`,
    `- 137 is not "86 ids + 51 recipes". It is ${tally(hist, (r) => r.provenance_grade).map(([k, n]) => `${n} ${k}`).join(' + ')}.`,
    '',
    '### Provenance grade × where the id sits',
    '',
    tbl(['Grade', 'Shared with atlas', 'Historical only'], tally(hist, (r) => r.provenance_grade).map(([g]) => [g, shared.filter((r) => r.provenance_grade === g).length, only.filter((r) => r.provenance_grade === g).length])),
    '',
    'The grade is the label the historical CSV gives itself. It is not a statement that the row\'s citation was checked. That check is the next section.',
    '',
    '## Source support (derived; the historical CSV is unchanged)',
    '',
    'The hash-pinned CSV is kept byte for byte, defects included. These columns are computed next to it: `source_support_status`, `support_basis`, `citation_check`, `verified_source_url`, `evidence_date`, `source_note`.',
    '',
    '- **DIRECT**: a source opened for this work documents the id itself (its own entry in `ATLAS_v2.json`, or the official notice). It means the id is documented, not that every figure on the row is.',
    '- **INDIRECT**: a source opened for this work only refers to it (atlas ingredient or loot reference, a string inside another name, or a passing mention in the notice).',
    '- **LEGACY_CLAIM**: rests on a cited external page that was not re-read here. Neither confirmed nor refuted.',
    '- **UNSUPPORTED_CITATION**: the cited source was opened, does not contain the id, and nothing else opened here supports it.',
    '',
    tbl(['Support', 'ATLAS_INDEXED', 'EXTERNAL_CRAFT_OR_INPUT', 'OFFICIAL_MODERN', 'Total'], (['DIRECT', 'INDIRECT', 'LEGACY_CLAIM', 'UNSUPPORTED_CITATION'] as SourceSupport[]).map((st) => [st, ...['ATLAS_INDEXED', 'EXTERNAL_CRAFT_OR_INPUT', 'OFFICIAL_MODERN'].map((g) => by(st).filter((r) => r.provenance_grade === g).length), by(st).length])),
    '',
    `Only source opened beyond the repository: ${OFFICIAL_NOTICE_2022.title}, ${OFFICIAL_NOTICE_2022.url}. The third-party pages the CSV cites were not re-read.`,
    '',
    '### Citations to `ATLAS_v2.json` that the file does not bear out',
    '',
    `${hist.filter((r) => r.source.includes('ATLAS_v2.json')).length} historical rows cite \`ATLAS_v2.json\`. For ${lacks.length} of them the id string does not occur in the file at all, and for ${mentionOnly.length} more it is not an atlas id and occurs only inside another name or in prose. This is a defect in the supplied research, reproduced here and not corrected in the raw file.`,
    '',
    tbl(['Id', 'Grade', 'Citation check', 'Support after this correction', 'What does support it'], [...lacks, ...mentionOnly].map((r) => [`\`${r.li_id}\``, r.provenance_grade, r.citation_check, r.source_support_status, r.support_basis])),
    '',
    '### Unresolved citations',
    '',
    `**${unsupported.length}** rows have no supporting source at all after this correction: ${names(unsupported)}. Their decisions stand on the row's own claim only and should be read that way.`,
    '',
    `A further **${by('LEGACY_CLAIM').length}** rows are LEGACY_CLAIM: they cite third-party pages (or, for \`reunion_mooncake_lottery_pack\`, a different official page) that were not re-read: ${names(by('LEGACY_CLAIM'))}.`,
    '',
    '### What the official notice of 2022-11-09 documents',
    '',
    `Dates are given to these ${dated.length} ids only. Every other row's date is UNKNOWN.`,
    '',
    tbl(['Id', 'Kind', 'Evidence date', 'What the notice documents', 'Notice text'], dated.map((r) => { const n = NOTICE_EVIDENCE[r.li_id]; return [`\`${r.li_id}\``, n.kind, r.evidence_date, n.documents, n.quote]; })),
    '',
    `\`OFFICIAL_MODERN\` is an inherited label, not verification. Of its ${modern.length} ids the notice backs ${modern.filter((r) => NOTICE_EVIDENCE[r.li_id]).length} (${names(modern.filter((r) => NOTICE_EVIDENCE[r.li_id]))}); the other ${modern.filter((r) => !NOTICE_EVIDENCE[r.li_id]).length} have no opened source (${names(modern.filter((r) => !NOTICE_EVIDENCE[r.li_id]))}).`,
    '',
    '### Relation of the historical-only ids to the atlas and to SOH',
    '',
    tbl(['Relation', 'Count', 'Ids'], tally(only, (r) => r.relation).map(([k, n]) => [k, n, names(only.filter((r) => r.relation === k))])),
    '',
    '### Gameplay-role status (all rows)',
    '',
    tbl(['Role status', 'Shared', 'Historical only', 'Atlas only'], tally(rows, (r) => r.role_status).map(([k]) => [k, shared.filter((r) => r.role_status === k).length, only.filter((r) => r.role_status === k).length, atlasOnly.filter((r) => r.role_status === k).length])),
    '',
    '## Design candidates (not approved, not added)',
    '',
    `A missing id is not a missing mechanic. Of ${only.length} historical-only ids, **${gaps.length}** sit where SOH has the slot or system and no item in that position. They are candidates for the owning area to weigh. Neither is approved, and neither is claimed to be necessary.`,
    '',
    tbl(['Historical id', 'Grade', 'Source support', 'Role', 'What is and is not there'], gaps.map((r) => [`\`${r.li_id}\``, r.provenance_grade, r.source_support_status, r.li_role, r.why])),
    '',
    '## Defined in the catalog vs usable in live play',
    '',
    'A `HAVE_*` verdict says SOH defines something for the role. `soh_live_status` says whether a player can use it. It is derived from catalog flags and the reachability projection, not from a play session.',
    '',
    tbl(['SOH live status', 'Rows'], tally(rows.filter((r) => r.soh_live_status !== 'NOT_APPLICABLE'), (r) => r.soh_live_status)),
    '',
    tbl(['Last Island id', 'SOH', 'Verdict', 'Live status', 'Note'], notLive.map((r) => [`\`${r.li_id}\``, `\`${r.soh_equivalent}\``, r.verdict, r.soh_live_status, r.soh_live_note])),
    '',
    '## The five omissions the diff asked to investigate',
    '',
    tbl(['Historical id', 'SOH', 'Verdict', 'Role status', 'Finding'], ['charcoal', 'egg', 'animal_hide', 'large_furnace', 'electric_resistor'].map((id) => rows.find((r) => r.li_id === id)!).map((r) => [`\`${r.li_id}\``, `\`${r.soh_equivalent}\``, r.verdict, r.role_status, r.why])),
    '',
    '## Where the historical `match_soh` column and this crosswalk disagree',
    '',
    `${dis.length} of ${hist.length}. In every case the crosswalk verdict stands, for the reason given.`,
    '',
    tbl(['Id', 'Historical', 'Crosswalk', 'SOH', 'Reason'], dis.map((r) => [`\`${r.li_id}\``, r.historical_match_soh, r.verdict, `\`${r.soh_equivalent}\``, r.why])),
    '',
    '## Figures left UNKNOWN',
    '',
    `${unknown.length} historical rows carry an UNKNOWN bench or an empty input list in the source. They are reproduced as UNKNOWN, not filled in: ${names(unknown)}.`,
    '',
    `The \`year_mode\` column is the same generic note on all ${hist.length} rows, so the source does not date any single id. Version relations above come from the id names and recipes, and are marked UNKNOWN where those do not settle it.`,
    '',
    '## All decisions',
    '',
    tbl(['Id', 'Grade', 'Source support', 'In 86', 'Relation', 'Related', 'Historical', 'SOH', 'Verdict', 'Role status', 'SOH live'], rows.map((r) => [`\`${r.li_id}\``, r.provenance_grade, r.source_support_status, r.in_atlas_86, r.relation, r.related_id, r.historical_match_soh, `\`${r.soh_equivalent}\``, r.verdict, r.role_status, r.soh_live_status])),
    '',
  ].join('\n');
}
