/**
 * Item Ontology V2 — ROUND 2 open findings (P2, P6, P8, P9, P10, Last Island coverage).
 *
 * ANALYSIS ONLY. Nothing in this file changes a recipe, a cost, a source or a save. Every number is
 * computed from the live catalog / the graph projection / the atlas file at generation time; the only
 * hand-written parts are the conclusions, and each conclusion names the measured row it rests on.
 * The Control Tower ruling for round 2: P2 and P6 are NOT authorised (Fasteners and Plank stay),
 * P8–P10 stay unimplemented but must end in a concrete conclusion and a resolution path.
 */
import {
  CREATURES, ITEMS, MODULE_PENDING_STRUCTURES, PA1_UPGRADE_ONLY_GEOMETRY, RECIPES, STRUCTS, STRUCTURE_UPGRADES,
  WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, CORE_STUDY, DEPLOYABLE_TYPES,
} from './catalog';
import { CREATOR_LOOT_V1 } from './creator-loot';
import { UNOBTAINABLE_STRUCTURES, type ItemOntologyProjection } from './item-ontology';

type Bom = [string, number][];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ───────────────────────────── P2 — Fasteners ─────────────────────────────
export interface P2Row {
  consumer: string; kind: 'recipe' | 'structure' | 'repair' | 'upgrade' | 'action'; live: boolean; fasteners: number;
  /** Raw (iron ingot, scrap) per use, pooled: the player shares batch leftovers between consumers. */
  before: { iron: number; scrap: number };
  /** Mechanism M1 — ceil(n / 2) Machine Parts (the Round 1 P2 text). */
  m1_machine_parts: number; m1: { iron: number; scrap: number }; m1_scrap_ratio: number;
  /** Mechanism M2 — the fastener batch ratio written straight into the consumer: ceil(n / 3) ingot + ceil(n / 3) scrap. */
  m2: { iron: number; scrap: number }; m2_ratio: number;
}
function p2(): { unit: Record<string, unknown>; rows: P2Row[]; totals: Record<string, number>; other_facts: string[]; conclusion: string[]; resolution: string[] } {
  const f = RECIPES.fasteners, mp = RECIPES.mechanical_parts;
  const fIron = f.ins.find(([k]) => k === 'iron_ingot')![1] / f.qty, fScrap = f.ins.find(([k]) => k === 'scrap')![1] / f.qty;
  const mIron = mp.ins.find(([k]) => k === 'iron_ingot')![1] / mp.qty, mScrap = mp.ins.find(([k]) => k === 'scrap')![1] / mp.qty;
  const rows: P2Row[] = [];
  const add = (consumer: string, kind: P2Row['kind'], n: number, live = true) => {
    const m1n = Math.ceil(n / 2), m2n = Math.ceil(n / f.qty);
    const before = { iron: r3(n * fIron), scrap: r3(n * fScrap) };
    const m1 = { iron: r3(m1n * mIron), scrap: r3(m1n * mScrap) };
    const m2 = { iron: m2n * f.ins.find(([k]) => k === 'iron_ingot')![1], scrap: m2n * f.ins.find(([k]) => k === 'scrap')![1] };
    rows.push({ consumer, kind, live, fasteners: n, before, m1_machine_parts: m1n, m1, m1_scrap_ratio: r3((m1n * mScrap) / (n * fScrap)), m2, m2_ratio: r3(m2.scrap / (n * fScrap)) });
  };
  const deploy = new Set((DEPLOYABLE_TYPES as readonly string[]).map((t) => 'deploy_' + t));
  for (const [id, rc] of Object.entries(RECIPES)) {
    if (deploy.has(id)) continue;                       // generated from STRUCTS; counted once, as the structure
    const n = rc.ins.find(([k]) => k === 'fasteners')?.[1]; if (n) add(id, 'recipe', n);
  }
  for (const [id, s] of Object.entries(STRUCTS)) {
    const n = (s.cost as Bom).find(([k]) => k === 'fasteners')?.[1];
    if (n) add(id, 'structure', n, !(MODULE_PENDING_STRUCTURES as readonly string[]).includes(id));
  }
  for (const [id, d] of Object.entries(ITEMS)) {
    const n = d.repair?.cost.find(([k]) => k === 'fasteners')?.[1]; if (n) add(id, 'repair', n);
  }
  for (const [label, u] of [['workbench → level 2', WORKBENCH_UPGRADE], ['workbench → level 3', WORKBENCH_UPGRADE_III]] as const) {
    const n = (u.cost as Bom).find(([k]) => k === 'fasteners')?.[1]; if (n) add(label, 'upgrade', n);
  }
  add('vehicleRepair (motorbike, engine.ts)', 'action', 1);
  const live = rows.filter((x) => x.live);
  const sum = (pick: (x: P2Row) => number) => r3(live.reduce((a, x) => a + pick(x), 0));
  const totals = {
    consumers: rows.length, live_consumers: live.length, single_fastener_consumers: live.filter((x) => x.fasteners === 1).length,
    before_iron: sum((x) => x.before.iron), before_scrap: sum((x) => x.before.scrap),
    m1_iron: sum((x) => x.m1.iron), m1_scrap: sum((x) => x.m1.scrap),
    m2_iron: sum((x) => x.m2.iron), m2_scrap: sum((x) => x.m2.scrap),
    m1_worst_scrap_ratio: Math.max(...live.map((x) => x.m1_scrap_ratio)), m1_best_scrap_ratio: Math.min(...live.map((x) => x.m1_scrap_ratio)),
    m2_worst_ratio: Math.max(...live.map((x) => x.m2_ratio)), m2_best_ratio: Math.min(...live.map((x) => x.m2_ratio)),
  };
  const drops = Object.entries(CREATURES).filter(([, c]) => (c.drops as [string, number, number][]).some(([k]) => k === 'fasteners')).map(([k]) => k);
  return {
    unit: {
      fasteners_recipe: `${f.ins.map(([k, q]) => `${q} ${k}`).join(' + ')} → ${f.qty} (researched: base=${f.base === true})`,
      machine_parts_recipe: `${mp.ins.map(([k, q]) => `${q} ${k}`).join(' + ')} → ${mp.qty} (base=${mp.base === true})`,
      per_fastener: { iron: r3(fIron), scrap: r3(fScrap) }, per_machine_part: { iron: r3(mIron), scrap: r3(mScrap) },
    },
    rows, totals,
    other_facts: [
      `Fasteners is a RESEARCHED formula (item.studyRecipe = ${ITEMS.fasteners.studyRecipe}); Machine Parts is known from the start. Removing the recipe deletes one research step from the Workbench III and motorbike routes.`,
      `Fasteners also arrive without crafting: creature drop from ${drops.join(', ') || 'none'} and authored industrial loot. A merge has to convert or strand those stacks.`,
      `${rows.filter((x) => !x.live).map((x) => x.consumer).join(', ') || 'No'} consumer is listed but not buildable today (module pending) and is excluded from the totals.`,
    ],
    conclusion: [
      `M1 (n Fasteners → ceil(n/2) Machine Parts) is NOT cost-neutral for a single consumer. Total iron is about unchanged (${totals.before_iron} → ${totals.m1_iron}) but scrap rises on every row: best case ${totals.m1_best_scrap_ratio}×, worst case ${totals.m1_worst_scrap_ratio}× (the ${totals.single_fastener_consumers} one-fastener consumers). Across all ${totals.live_consumers} live consumers scrap goes ${totals.before_scrap} → ${totals.m1_scrap}.`,
      `M2 (write the batch ratio into the consumer: ceil(n/3) ingot + ceil(n/3) scrap) costs exactly what one fastener batch costs today for an isolated craft, but removes leftover sharing: pooled cost rises up to ${totals.m2_worst_ratio}× on one-fastener consumers (${totals.before_scrap} → ${totals.m2_scrap} scrap overall).`,
      'No integer mapping removes Fasteners without a cost jump on the one- and two-fastener consumers. That is the blocker; it is arithmetic, not taste.',
    ],
    resolution: [
      'RULING APPLIED: Fasteners stay. The Round 1 disposition MERGE_CANDIDATE is withdrawn (now KEEP).',
      'If the twin signal is to be removed later, do it by DIFFERENTIATION, not by merge: Fasteners = researched joining stock for assemblies and field repair; Machine Parts = base mechanism stock. That needs no recipe change.',
      'A future merge is only admissible with a replacement that is priced per consumer in thirds (i.e. keeps a 3-per-batch unit) — which is Fasteners under another name. Close P2 unless a new mechanic is proposed.',
    ],
  };
}

// ───────────────────────────── P6 — Plank ─────────────────────────────
function p6() {
  const cost = (id: string) => STRUCTS[id].cost as Bom;
  const tiers = ['wall_wood', 'wall_plank', 'wall_stone', 'wall_brick'].map((id) => {
    const direct = !(PA1_UPGRADE_ONLY_GEOMETRY as readonly string[]).includes(id);
    const upgradedFrom = Object.entries(STRUCTURE_UPGRADES).filter(([, to]) => to === id).map(([from]) => from);
    return { id, hp: STRUCTS[id].hp, cost: cost(id), buildable_directly: direct, upgrade_from: upgradedFrom, obtainable: direct || upgradedFrom.length > 0 };
  });
  const plankWood = RECIPES.plank.ins.find(([k]) => k === 'wood')![1] / RECIPES.plank.qty;
  const planks = cost('wall_plank').find(([k]) => k === 'plank')![1];
  const woodWall = cost('wall_wood').find(([k]) => k === 'wood')![1];
  const plankConsumers = [
    ...Object.entries(RECIPES).filter(([, rc]) => rc.ins.some(([k]) => k === 'plank')).map(([k]) => 'recipe:' + k),
    ...Object.entries(STRUCTS).filter(([, s]) => (s.cost as Bom).some(([k]) => k === 'plank')).map(([k]) => 'structure:' + k),
  ];
  const drops = Object.entries(CREATURES).filter(([, c]) => (c.drops as [string, number, number][]).some(([k]) => k === 'plank')).map(([k]) => k);
  const wp = tiers.find((t) => t.id === 'wall_plank')!;
  const route = {
    today_if_reachable: { wood: woodWall + planks * plankWood, bench_seconds: planks * RECIPES.plank.secs, needs: ['Territory Cabinet (upgrade)', 'Workbench (plank)'], hp: STRUCTS.wall_plank.hp },
    without_workbench: { wood: woodWall + planks * plankWood, bench_seconds: 0, needs: ['Territory Cabinet (upgrade)'], hp: STRUCTS.wall_plank.hp },
    workbench_one_time: STRUCTS.workbench.cost as Bom,
    hp_per_wood: { wall_wood: r3(STRUCTS.wall_wood.hp / woodWall), wall_plank_cumulative: r3(STRUCTS.wall_plank.hp / (woodWall + planks * plankWood)), wall_plank_upgrade_step_only: r3((STRUCTS.wall_plank.hp - STRUCTS.wall_wood.hp) / (planks * plankWood)) },
  };
  return {
    tiers, plank: { recipe: `${RECIPES.plank.ins.map(([k, q]) => `${q} ${k}`).join(' + ')} → ${RECIPES.plank.qty} @ ${RECIPES.plank.station}, ${RECIPES.plank.secs}s`, consumers: plankConsumers, creature_drops: drops },
    structure_upgrades: { ...STRUCTURE_UPGRADES }, upgrade_only: [...PA1_UPGRADE_ONLY_GEOMETRY], route,
    unobtainable_structures: UNOBTAINABLE_STRUCTURES.map((id) => ({ id, name: STRUCTS[id].name, hp: STRUCTS[id].hp, cost: cost(id) })),
    conclusion: [
      wp.obtainable
        ? 'The 240 HP Plank Wall is obtainable.'
        : `MEASURED BLOCKER: a player cannot obtain the 240 HP Plank Wall in the live build. It is upgrade-only geometry (buildReason refuses to place it), and no entry of STRUCTURE_UPGRADES leads to it (wall_wood upgrades straight to ${STRUCTURE_UPGRADES.wall_wood}). The "240 HP wall route" the question asks about does not exist at this base.`,
      `The same test finds every structure in that state: ${UNOBTAINABLE_STRUCTURES.map((id) => `${id} (${STRUCTS[id].hp} HP)`).join(', ')}. The Brick Wall is affected exactly like the Plank Wall.`,
      `Consequence: Plank has ${plankConsumers.length} listed consumer (${plankConsumers.join(', ')}) and zero REACHABLE consumers. It is craftable (${RECIPES.plank.secs}s at a Workbench) and drops from ${drops.join(', ') || 'nothing'}, but nothing a player can do spends it. The Round 1 projection counted the structure cost as a consumer; that was an over-count.`,
      `If the tier were reachable, removing the Workbench step would leave the wood bill unchanged (${route.today_if_reachable.wood} wood cumulative) and save ${route.today_if_reachable.bench_seconds}s of bench time per wall plus the one-time Workbench. HP per wood: Wood Wall ${route.hp_per_wood.wall_wood}, Plank Wall cumulative ${route.hp_per_wood.wall_plank_cumulative} — the plank tier is LESS wood-efficient than the wood wall, so the bench step is not what protects the wood tier.`,
    ],
    resolution: [
      'RULING APPLIED: Plank stays; nothing is retired. The Round 1 disposition RETIRE_CANDIDATE is withdrawn (now DEFER, flagged NO_REACHABLE_CONSUMER).',
      'Option A — intermediate tier: route wall_wood → wall_plank → wall_stone. Measured side effect: the Stone Wall route gains one upgrade step (+' + planks * plankWood + ' wood, +' + planks * RECIPES.plank.secs + 's) unless STRUCTURE_UPGRADES is taught to branch. That is a cost change on a live route and needs approval.',
      'Option B — move the processing step: let a placed Wood Wall be upgraded to Plank Wall as an OPTIONAL side branch (map becomes one-to-many), Stone route untouched. No existing cost moves; this is the cheapest way to make Plank live.',
      'Option C — retire the Plank Wall tier and the item together. Rejected for this round by the ruling.',
      'Recommended next action: decide A or B in the building ontology PR (#56 line), because the upgrade map lives there; then re-run this section — it will flip to "obtainable" on its own.',
    ],
  };
}

// ───────────────────────────── P8 — Veyra source-access matrix ─────────────────────────────
const P8_ITEMS = ['chitin', 'crawler_optic', 'wolf_fang', 'beetle_horn', 'boar_tusk', 'keycard', 'core_demon', 'essence_spirit'] as const;
function p8(p: ItemOntologyProjection) {
  const byId = new Map(p.items.map((i) => [i.id, i]));
  const onVeyra = (layer: string) => layer === 'VEYRA' || layer === 'BOTH';
  const onShipping = (layer: string) => layer === 'SHIPPING' || layer === 'BOTH';
  const fmt = (s: { kind: string; from: string; probability: number | null; gates: string[] }) =>
    `${s.kind} ${s.from}${s.probability !== null && s.probability < 1 ? ` p=${s.probability}` : ''}${s.gates.length ? ` [${s.gates.join(',')}]` : ''}`;
  const rows = P8_ITEMS.map((id) => {
    const it = byId.get(id)!;
    const sources = it.sources.map((s) => ({ kind: s.kind as string, from: s.from, layer: s.layer as string, probability: s.probability ?? null, gates: s.gates ?? [] }));
    const found = sources.filter((s) => s.kind !== 'CRAFT_OUTPUT');
    const recipes = it.produced_by.map((rid) => ({ recipe: rid, inputs: (RECIPES[rid]?.ins ?? []) as Bom, veyra_blocked: p.veyra_blocked_recipes.includes(rid), shipping_blocked: p.shipping_blocked_recipes.includes(rid) }));
    const veyraFound = found.filter((s) => onVeyra(s.layer)), veyraCraft = recipes.filter((x) => !x.veyra_blocked);
    return {
      id, name: ITEMS[id].name, reachability: it.runtime_reachability as string,
      shipping_sources: found.filter((s) => onShipping(s.layer)).map(fmt), veyra_sources: veyraFound.map(fmt),
      other_layer_sources: found.filter((s) => !onShipping(s.layer) && !onVeyra(s.layer)).map((s) => `${fmt(s)} (${s.layer})`),
      recipes, teaches_recipe: ITEMS[id].specimen ?? null,
      veyra_consumers: it.consumers.filter((c) => onVeyra(c.layer as string)).map((c) => c.to),
      gap: veyraFound.length === 0 && veyraCraft.length === 0 ? 'NO_VEYRA_SOURCE' : veyraFound.length === 0 ? 'CRAFT_ONLY_ON_VEYRA' : recipes.some((x) => x.veyra_blocked) ? 'VEYRA_DROP_ONLY_CRAFT_BLOCKED' : 'HAS_VEYRA_SOURCE',
    };
  });
  const none = rows.filter((x) => x.gap === 'NO_VEYRA_SOURCE');
  const shippingSpawnerOnly = none.filter((x) => x.shipping_sources.length > 0 && x.shipping_sources.every((s) => s.includes('gate:shipping_spawner'))).map((x) => x.id);
  const containerOnly = none.filter((x) => x.shipping_sources.length + x.other_layer_sources.length > 0 && [...x.shipping_sources, ...x.other_layer_sources].every((s) => s.includes('container:'))).map((x) => x.id);
  const blockedBy = p.veyra_blocked_recipes.map((rid) => `${rid} (needs ${(RECIPES[rid]?.ins ?? []).map(([k]) => k).filter((k) => none.some((x) => x.id === k) || byId.get(k)?.runtime_reachability === 'FIXTURE_ONLY').join(', ') || 'a blocked input'})`);
  const partial = rows.filter((x) => x.gap === 'VEYRA_DROP_ONLY_CRAFT_BLOCKED');
  return {
    rows, veyra_blocked_recipes: p.veyra_blocked_recipes,
    conclusion: [
      `No Veyra source at all (${none.length} of ${rows.length}): ${none.map((x) => x.id).join(', ')}.`,
      `Cause, by item. Dropped only by creatures behind the Shipping spawner: ${shippingSpawnerOnly.join(', ') || 'none'}. Held only in authored Shipping/Dev containers: ${containerOnly.join(', ') || 'none'}. The creatures and crates exist; the Veyra layout has no placement for them.`,
      `Veyra-blocked recipes and the input that blocks each: ${blockedBy.join('; ')}.`,
      ...(partial.length ? [`Reachable on Veyra by drop but not by craft: ${partial.map((x) => `${x.id} (${x.veyra_sources.join('; ')})`).join(', ')}. For these the recipe is dead weight on Veyra while the item itself is obtainable.`] : []),
      `Has a Veyra source: ${rows.filter((x) => x.gap === 'HAS_VEYRA_SOURCE').map((x) => x.id).join(', ') || 'none'}.`,
      `Specimens also carry a research route (${rows.filter((x) => x.teaches_recipe).map((x) => `${x.id} → ${x.teaches_recipe}`).join('; ')}): without the specimen the formula can only come from a blueprint or paid study.`,
    ],
    resolution: [
      'No source was invented. The matrix is the work order for the Veyra content pass: per NO_VEYRA_SOURCE item choose (a) a Veyra spawner entry for the dropping creature, (b) an authored Veyra crate, or (c) an explicit "Shipping-only by design" ruling.',
      'Until that pass: hide the Veyra-blocked recipes from the Veyra craft list using `veyra_blocked_recipes` (display filter; no recipe or save change). NOT implemented this round — it changes what a Veyra player sees and was not in the authorised set.',
      'Keycard needs its own ruling: if Veyra has no keycard doors, "no source" is correct by design.',
    ],
  };
}

// ───────────────────────────── P9 — Crude Petroleum ─────────────────────────────
function p9(p: ItemOntologyProjection) {
  const it = p.items.find((i) => i.id === 'crude_petroleum')!;
  const makers = Object.entries(RECIPES).filter(([, rc]) => rc.out === 'crude_petroleum' || rc.outs?.some(([k]) => k === 'crude_petroleum')).map(([k]) => k);
  const users = Object.entries(RECIPES).filter(([, rc]) => rc.ins.some(([k]) => k === 'crude_petroleum')).map(([k]) => k);
  return {
    reachability: it.runtime_reachability, produced_by: makers, consumed_by: users, description_shown_to_player: ITEMS.crude_petroleum.desc,
    oil_pump_description: STRUCTS.oil_pump.desc, blocked_on: { veyra: p.veyra_blocked_recipes.filter((x) => makers.includes(x) || users.includes(x)), shipping: p.shipping_blocked_recipes.filter((x) => makers.includes(x) || users.includes(x)) },
    conclusion: [
      `Crude Petroleum stays FIXTURE_ONLY: the only oil source the engine accepts is one registered by the test fixture (registerTestOilSource), so ${makers.join(', ')} and ${users.join(', ')} cannot run on either live layout.`,
      'UI rule: no player-facing text may describe Crude Petroleum as something that can be pumped today. The item description and the Oil Pump description are quoted above so the wording can be reviewed against that rule.',
    ],
    resolution: [
      'Keep the id, the pump and the recipes (the oil-mobility work depends on them). No removal.',
      'Display fix to schedule with the pump work, not here: mark the two recipes and the Oil Pump as "no oil seep on this map" when the layout has no authored source, instead of offering a machine that can never start. Salvaged Oil → Fuel Can at the Furnace remains the one live fuel route.',
    ],
  };
}

// ───────────────────────────── P10 — legacy cores vs the seven Creator Cores ─────────────────────────────
const LEGACY_EFFECT: Record<string, { effect: string; unique: string; counterpart: string; vfx: string }> = {
  core_fire: { effect: 'sim.ts commitCore: one projectile, 45 damage', unique: 'Sets vegetation alight.', counterpart: 'Meteor (rare Fire): its first ability is also a fireball.', vfx: 'pixelfx fire/fireball + cast burst' },
  core_earth: { effect: 'sim.ts commitCore: 8 spike hazards, 32 damage each, effect "quake"', unique: 'Harvest utility: breaks rock nodes into resources.', counterpart: "Earth Mother's Breath (common Nature): rock / grove / roots — control, not harvest.", vfx: 'spike hazards + screen shake' },
  core_storm: { effect: 'sim.ts commitCore: up to 4 jumps, 30 damage, 45 when wet', unique: 'Weather-scaled damage.', counterpart: 'Mjolnir (rare Nature): five lightning strikes.', vfx: 'pixelfx lightning/chain-lightning + bolt' },
  core_frost: { effect: 'sim.ts commitCore, core="frost"', unique: 'Traversal utility: makes water crossable.', counterpart: "Elsa's Sword (rare Water): ice projectile, self-freeze, viewport freeze.", vfx: 'pixelfx ice/snowflake-burst' },
};
function p10(p: ItemOntologyProjection) {
  const byId = new Map(p.items.map((i) => [i.id, i]));
  const row = (id: string) => {
    const d = ITEMS[id], rc = RECIPES[id], it = byId.get(id)!;
    return {
      id, name: d.name, vi: d.vi ?? null, kind: d.creatorCore ? 'CREATOR_CORE' : 'LEGACY_CORE',
      mechanic: d.creatorCore ? `creatorCore="${d.creatorCore}": three abilities fed by Basic / Refined / Signature energy reserves (Stack.reserves)` : `core="${d.core}": one ability, ${d.charge} charges, one charge debited per cast (Stack.charge)`,
      recipe: rc ? `${rc.ins.map(([k, q]) => `${q} ${k}`).join(' + ')} @ workbench L${rc.stationLevel ?? 1}, ${rc.secs}s, tier ${rc.tier}${rc.base ? ', known at start' : ''}` : 'none',
      parts_cost: rc?.ins.find(([k]) => k === 'spares')?.[1] ?? 0,
      learned_by: rc?.base ? 'starter knowledge' : CORE_STUDY[id] ? 'studying the Core itself at a Research Table, or a blueprint' : 'blueprint / research',
      sources: it.sources.map((s) => `${s.kind} ${s.from} (${s.layer})`), reachability: it.runtime_reachability,
      save_fields: d.creatorCore ? 'key, uid, reserves{basic,refined,signature}' : 'key, uid, charge',
      gold_ui: 'tooltip uses the gold Core frame (panels.tsx: isCore = core || creatorCore)',
      ...(LEGACY_EFFECT[id] ? { ...LEGACY_EFFECT[id], effect: `${d.desc} [${LEGACY_EFFECT[id].effect}]` } : {}),
    };
  };
  const legacy = ['core_fire', 'core_earth', 'core_storm', 'core_frost'].map(row);
  const creator = Object.entries(ITEMS).filter(([, d]) => d.creatorCore).map(([id]) => row(id));
  const markers = CREATOR_LOOT_V1.filter((c) => /^core_(fire|earth|storm|frost)$/.test(c.marker)).map((c) => `${c.id} → ${c.core}`);
  return {
    legacy, creator, creator_loot_markers: markers,
    conclusion: [
      'The two families are different mechanics, not duplicates: a legacy core is a single-effect CHARGE tool (Stack.charge, 3–4 casts, re-charged as an item), a Creator Core is a three-ability RESERVE weapon (Stack.reserves) fed by the Energy/Essence economy.',
      'Two legacy effects have no Creator counterpart: Quake Core breaks rock into yield (harvest), Rime Core makes shallow water walkable (traversal). Ember and Storm overlap a Creator ability (fireball; lightning) but keep one distinct rule each (ignites vegetation; stronger in rain).',
      `The legacy cores are load-bearing for the Creator Cores themselves: CREATOR_LOOT_V1 finds the crate that holds a Creator Core by the legacy core in it (${markers.join('; ')}). Removing the legacy items from those crates silently removes three Creator Core sources.`,
      'Cost check: legacy cores cost 8–10 Parts at a level-1 Workbench but are tier-3 knowledge; the two common Creator Cores cost 4 Parts and are known from the start. The legacy four are not a cheaper path into the Creator line.',
      'The one real defect is presentation: all eleven use the same gold Core frame and the same "CORE" class, so a newcomer reads eleven Cores where the Bible names seven.',
    ],
    resolution: [
      'PROPOSED CANON DECISION (one, concrete): keep all four as a named minor class — "Field Core" / VN "Lõi dã chiến" — single-effect charge tools, explicitly NOT among the seven Creator Cores. Bible §Creator Cores gains one sentence saying so.',
      'What that implies when approved (nothing done now): class chip FIELD CORE instead of CORE; the gold frame and Creator VFX grammar reserved for the seven; no recipe, charge, loot or save change; ids unchanged.',
      'What it rules out: retiring the four recipes or stripping the items from crates. Both lose unique effects and the second breaks Creator Core loot lookup.',
      'Owner input still required: the name ("Field Core") and whether Ember/Storm should be re-tuned so they stop echoing Meteor/Mjolnir. Until then P10 is OPEN.',
    ],
  };
}

// ───────────────────────────── Last Island coverage ─────────────────────────────
export interface LiAtlasFull {
  recipes: { id: string; name?: string; ingredients: Record<string, number>; confidence?: string; kind?: string; domain?: string }[];
  items: Record<string, { label?: string; channels?: string[] }>;
  loot_edges: { item: string; container: string; relation?: string }[];
  stats?: Record<string, unknown>;
  unresolved?: { key: string; domain: string; question: string }[];
}
function li(atlas: LiAtlasFull) {
  const recipeOut = new Set(atlas.recipes.map((r) => r.id));
  const ingredient = new Set(atlas.recipes.flatMap((r) => Object.keys(r.ingredients)));
  const loot = new Set(atlas.loot_edges.map((e) => e.item));
  const itemsBlock = new Set(Object.keys(atlas.items));
  const all = new Set([...recipeOut, ...ingredient, ...loot, ...itemsBlock]);
  const rows = [...all].sort().map((id) => {
    const rec = atlas.recipes.filter((r) => r.id === id);
    const where = [recipeOut.has(id) && 'recipe_output', ingredient.has(id) && 'ingredient', loot.has(id) && 'loot_edge', itemsBlock.has(id) && 'items_block'].filter(Boolean) as string[];
    const conf = rec.map((r) => r.confidence ?? '?');
    const relations = [...new Set(atlas.loot_edges.filter((e) => e.item === id).map((e) => e.relation ?? '?'))];
    return {
      id, appears_in: where, recipe_entries: rec.length, confidence: conf.join('/') || '-', loot_relations: relations.join('/') || '-',
      status: rec.length > 1 ? 'DUPLICATE_RECIPE_ENTRY' : !recipeOut.has(id) && ingredient.has(id) && !loot.has(id) && !itemsBlock.has(id) ? 'INGREDIENT_ONLY_NO_SOURCE_RECORDED'
        : conf.some((c) => !/^[AB]/.test(c)) || (relations.length > 0 && relations.every((x) => !/confirmed/.test(x)) && !recipeOut.has(id)) ? 'UNVERIFIED' : 'RECORDED',
    };
  });
  const stem = (id: string) => id.replace(/^(stone|iron|refined_iron|refined|advanced|basic|small|large|wood|wooden|metal)_/, '').replace(/_(i|ii|iii|1|2|3|small|large)$/, '');
  const families: Record<string, string[]> = {};
  for (const id of all) (families[stem(id)] ??= []).push(id);
  const variants = Object.entries(families).filter(([, v]) => v.length > 1).map(([k, v]) => ({ stem: k, ids: v.sort() }));
  const count = (s: string) => rows.filter((x) => x.status === s).length;
  const total = all.size + atlas.recipes.length;
  return {
    counts: {
      unique_item_ids: all.size, recipe_entries: atlas.recipes.length, items_block: itemsBlock.size, unique_loot_items: loot.size, loot_edges: atlas.loot_edges.length,
      ids_plus_recipe_entries: total, recipe_outputs: recipeOut.size, ingredient_ids: ingredient.size,
      ids_in_more_than_one_place: rows.filter((x) => x.appears_in.length > 1).length,
      RECORDED: count('RECORDED'), UNVERIFIED: count('UNVERIFIED'), INGREDIENT_ONLY_NO_SOURCE_RECORDED: count('INGREDIENT_ONLY_NO_SOURCE_RECORDED'), DUPLICATE_RECIPE_ENTRY: count('DUPLICATE_RECIPE_ENTRY'),
      variant_families: variants.length,
    },
    rows, variants,
    conclusion: [
      `The atlas file in this repository (web/ref/atlas/extracted/ATLAS_v2.json) yields ${all.size} unique item ids: ${recipeOut.size} recipe outputs, ${ingredient.size} ingredient ids, ${loot.size} loot items and ${itemsBlock.size} entries in its items block, de-duplicated (${rows.filter((x) => x.appears_in.length > 1).length} ids appear in more than one of those places).`,
      `One arithmetic match for "137" exists in this corpus: ${all.size} unique ids + ${atlas.recipes.length} recipe entries = ${total}. ${total === 137 ? 'If that is where the figure comes from, 137 counts each of the ' + recipeOut.size + ' recipe outputs twice (once as an item, once as a recipe) and the two figures describe the same corpus. This is a HYPOTHESIS: the match could be coincidence.' : 'That sum is not 137, so the figure does not come from this file.'}`,
      `SOURCE NOT LOCATED: no file in the repository (atlas branches included) and nothing found in two searches of the connected Google Drive is a "research summary" with 137 rows. The reading above is therefore UNVERIFIED until the 137-entry document is supplied. If it is a different list, the ${Math.max(0, 137 - all.size)}-entry difference has to be diffed row by row; nothing here should be read as having done that.`,
      `Inside the 86: ${count('UNVERIFIED')} ids rest only on unconfirmed evidence (recipe confidence below B, or loot edges that are not "confirmed"), ${count('INGREDIENT_ONLY_NO_SOURCE_RECORDED')} are named only as an ingredient with no source recorded, ${count('DUPLICATE_RECIPE_ENTRY')} have more than one recipe entry, and ${variants.length} stems have tier/material variants.`,
    ],
    resolution: [
      'No Last Island item was added to SOH on the strength of this comparison. Firearms, ammunition and explosives stay out of scope.',
      'Next action for the owner: attach the 137-entry research summary (file or link). The generator will then diff it against these 86 ids and report missing / duplicate / variant / unverified per row.',
    ],
  };
}

export function buildRound2Findings(p: ItemOntologyProjection, atlas: LiAtlasFull) {
  return { scope: 'ANALYSIS ONLY — not implemented. Generated from the live catalog, the graph projection and ATLAS_v2.json.', P2: p2(), P6: p6(), P8: p8(p), P9: p9(p), P10: p10(p), LI: li(atlas) };
}
export type Round2Findings = ReturnType<typeof buildRound2Findings>;

// ───────────────────────────── Markdown ─────────────────────────────
const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: unknown[][]) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const bom = (b: Bom) => b.map(([k, q]) => `${q} ${k}`).join(' + ');
const list = (o: string[], title: string, items: string[]) => { o.push(`**${title}**`); o.push(''); for (const x of items) o.push(`- ${x}`); o.push(''); };

export function round2FindingsMd(f: Round2Findings): string {
  const o: string[] = [];
  o.push('# Item Ontology V2 — Round 2 open findings');
  o.push('');
  o.push('> GENERATED by `tests/item-ontology-v2.test.ts` from `src/game/item-ontology-findings.ts`. Do not edit by hand.');
  o.push('> Status of everything on this page: **ANALYSIS ONLY — NOT IMPLEMENTED.** Item V2 is not complete while these are open.');
  o.push('');
  o.push('## P2 — Fasteners: every consumer, before and after a merge');
  o.push('');
  o.push(`Unit prices. Fasteners: ${f.P2.unit.fasteners_recipe}. Machine Parts: ${f.P2.unit.machine_parts_recipe}.`);
  o.push('');
  o.push(table(['Consumer', 'Kind', 'Live', 'Fasteners', 'Before iron', 'Before scrap', 'M1 Machine Parts', 'M1 iron', 'M1 scrap', 'M1 scrap ×', 'M2 iron', 'M2 scrap', 'M2 ×'],
    f.P2.rows.map((x) => [x.consumer, x.kind, x.live ? 'yes' : 'NO', x.fasteners, x.before.iron, x.before.scrap, x.m1_machine_parts, x.m1.iron, x.m1.scrap, x.m1_scrap_ratio, x.m2.iron, x.m2.scrap, x.m2_ratio])));
  o.push('');
  o.push(`Totals over ${f.P2.totals.live_consumers} live consumers — before: ${f.P2.totals.before_iron} iron / ${f.P2.totals.before_scrap} scrap · M1: ${f.P2.totals.m1_iron} / ${f.P2.totals.m1_scrap} · M2: ${f.P2.totals.m2_iron} / ${f.P2.totals.m2_scrap}.`);
  o.push('');
  list(o, 'Other measured facts', f.P2.other_facts); list(o, 'Conclusion', f.P2.conclusion); list(o, 'Resolution path', f.P2.resolution);

  o.push('## P6 — Plank and the 240 HP wall');
  o.push('');
  o.push(table(['Wall', 'HP', 'Cost', 'Placeable directly', 'Upgrade from', 'Obtainable today'], f.P6.tiers.map((t) => [t.id, t.hp, bom(t.cost), t.buildable_directly ? 'yes' : 'no (upgrade-only)', t.upgrade_from.join(', ') || 'nothing', t.obtainable ? 'yes' : '**NO**'])));
  o.push('');
  o.push(`Plank: ${f.P6.plank.recipe}. Listed consumers: ${f.P6.plank.consumers.join(', ')}. Creature drops: ${f.P6.plank.creature_drops.join(', ') || 'none'}. Upgrade map: ${Object.entries(f.P6.structure_upgrades).map(([a, b]) => `${a} → ${b}`).join(', ')}.`);
  o.push('');
  o.push(table(['Unobtainable structure', 'HP', 'Cost'], f.P6.unobtainable_structures.map((u) => [`${u.id} (${u.name})`, u.hp, bom(u.cost)])));
  o.push('');
  list(o, 'Conclusion', f.P6.conclusion); list(o, 'Resolution path', f.P6.resolution);

  o.push('## P8 — Veyra source-access matrix');
  o.push('');
  o.push(table(['Item', 'Reachability', 'Shipping sources', 'Veyra sources', 'Recipe (Veyra)', 'Teaches', 'Gap'], f.P8.rows.map((x) => [
    `${x.id} (${x.name})`, x.reachability, x.shipping_sources.join('; ') || 'none', x.veyra_sources.join('; ') || '**none**',
    x.recipes.map((rc) => `${rc.recipe}: ${bom(rc.inputs)}${rc.veyra_blocked ? ' — BLOCKED on Veyra' : ''}`).join('; ') || 'not craftable', x.teaches_recipe ?? '-', x.gap])));
  o.push('');
  list(o, 'Conclusion', f.P8.conclusion); list(o, 'Resolution path', f.P8.resolution);

  o.push('## P9 — Crude Petroleum');
  o.push('');
  o.push(`Reachability: \`${f.P9.reachability}\`. Produced by: ${f.P9.produced_by.join(', ')}. Consumed by: ${f.P9.consumed_by.join(', ')}.`);
  o.push('');
  o.push(`Item text shown to the player: "${f.P9.description_shown_to_player}"`);
  o.push('');
  o.push(`Oil Pump text shown to the player: "${f.P9.oil_pump_description}"`);
  o.push('');
  list(o, 'Conclusion', f.P9.conclusion); list(o, 'Resolution path', f.P9.resolution);

  o.push('## P10 — the four legacy cores beside the seven Creator Cores');
  o.push('');
  o.push(table(['Core', 'Kind', 'Mechanic', 'Effect', 'Unique rule', 'Nearest Creator Core', 'Recipe', 'Learned by', 'Sources', 'Save fields', 'VFX'],
    f.P10.legacy.map((x) => [`${x.id} (${x.name})`, x.kind, x.mechanic, x.effect ?? '', x.unique ?? '', x.counterpart ?? '', x.recipe, x.learned_by, x.sources.join('; ') || 'craft only', x.save_fields, x.vfx ?? ''])));
  o.push('');
  o.push(table(['Creator Core', 'VN name', 'Mechanic', 'Recipe', 'Parts', 'Learned by', 'Reachability', 'Save fields'],
    f.P10.creator.map((x) => [`${x.id} (${x.name})`, x.vi ?? '-', x.mechanic, x.recipe, x.parts_cost, x.learned_by, x.reachability, x.save_fields])));
  o.push('');
  o.push('Gold UI today: all eleven use the same gold Core tooltip frame.');
  o.push('');
  list(o, 'Conclusion', f.P10.conclusion); list(o, 'Resolution path', f.P10.resolution);

  o.push('## Last Island — the 86 ids against the "137 entries"');
  o.push('');
  o.push(table(['Measure', 'Value'], Object.entries(f.LI.counts).map(([k, v]) => [k.replace(/_/g, ' '), v])));
  o.push('');
  list(o, 'Conclusion', f.LI.conclusion);
  o.push(table(['Variant family', 'Ids'], f.LI.variants.map((v) => [v.stem, v.ids.join(', ')])));
  o.push('');
  o.push(table(['Id', 'Appears in', 'Recipe entries', 'Confidence', 'Loot relation', 'Status'], f.LI.rows.filter((x) => x.status !== 'RECORDED').map((x) => [x.id, x.appears_in.join(', '), x.recipe_entries, x.confidence, x.loot_relations, x.status])));
  o.push('');
  list(o, 'Resolution path', f.LI.resolution);
  return o.join('\n') + '\n';
}
