/**
 * Item Ontology V2 — report builder. PURE: (projection, LI atlas) → strings.
 *
 * One data object (`buildOntologyData`) feeds the manifest CSV, the LI crosswalk CSV, the appendix
 * Markdown and the HTML explorer, so the four can never disagree. `tests/item-ontology-v2.test.ts`
 * regenerates them from the live multigraph and fails when a committed artifact has drifted.
 */
import type { ItemOntologyProjection, OntologyItem, OntologyRecipe } from './item-ontology';
import { ITEM_CLASS_LABEL, ITEM_CLASS_MEANING } from './item-class';
import { SOH_PROVISIONAL_ITEMS } from './catalog';
import {
  ADD_CANDIDATES_REVIEWED, DOMAIN_AXIS, LI_CROSSWALK, PARTS_OPTIONS, PARTS_RECOMMENDATION, PARTS_SCOPE, PROPOSALS,
  decisionFor, type Disposition, type Domain, type Proposal, type RecipeLine, type StructLine,
} from './item-ontology-decisions';

/** The commit the audit was taken on (PR #56 head). Authored, so the artifacts are stable across commits. */
export const ONTOLOGY_BASELINE = {
  repo: 'Khanh-glitch/Soul-of-Hero',
  branch: 'feature/pa1-building-ontology-20261113',
  sha: '934f4471326116737f206d2fb2d9a84ba77328da',
  pr: 56,
  rejected_pr: 60,
} as const;

export interface LiAtlas {
  recipes: { id: string; name: string; bench: number | null; ingredients: Record<string, number>; domain: string; kind: string }[];
  items: Record<string, { label: string; channels: string[] }>;
  loot_edges: { item: string; container: string }[];
}

export interface LiCrosswalkRow {
  li_id: string; li_role: string; li_source: string; li_recipe: string; li_consumers: string;
  soh_equivalent: string; verdict: string; why: string;
}

export interface ManifestRow {
  old_id: string; proposed_id: string; display_name: string; level: string; domain: string; source: string; consumer: string;
  action: string; role: string; LI_reference: string; decision: Disposition; justification: string;
  migration_required: string; authority_status: string;
  station_tier: string; research_tier: string; runtime_reachability: string; proposal: string;
}

export const MANIFEST_COLUMNS: (keyof ManifestRow)[] = [
  'old_id', 'proposed_id', 'display_name', 'level', 'domain', 'source', 'consumer', 'action', 'role', 'LI_reference',
  'decision', 'justification', 'migration_required', 'authority_status',
  'station_tier', 'research_tier', 'runtime_reachability', 'proposal',
];

const BIBLE_PROTECTED = /^(core_(blast|meteor|dragon|elsa|earthmother|mjolnir|demon)|energy_|essence_|stone_|rcash|escrow_chest|blueprint)/;
const MIGRATION: Record<string, string> = {
  P1: 'NO (display name only) — DONE', P2: 'NO (not authorised; nothing changes)', P3: 'DONE (recipe revision 3; rev 2 frozen; piped recipe retired)',
  P4: 'DONE (recipe revision 3; rev 2 frozen)', P5: 'NO (new recycler rule key only) — DONE', P6: 'NO (not authorised; nothing changes)',
  P7: 'NO (display name only) — DONE', P8: 'TBD (content decision)', P9: 'NO', P10: 'TBD (owner ruling)',
};
const PROPOSAL_STATUS: Record<string, string> = Object.fromEntries(PROPOSALS.map((x) => [x.id, x.status]));

function sourceSummary(i: OntologyItem): string {
  const parts: string[] = [];
  if (i.produced_by.length) parts.push(`craft[${i.produced_by.join(' ')}]`);
  const kinds = new Set([...i.acquisition_types.shipping, ...i.acquisition_types.veyra].filter((k) => k !== 'CRAFT_OUTPUT'));
  for (const k of [...kinds].sort()) {
    const s = i.acquisition_types.shipping.includes(k), v = i.acquisition_types.veyra.includes(k);
    parts.push(s && v ? k : `${k}(${s ? 'shipping' : 'veyra'} only)`);
  }
  if (!parts.length && i.acquisition_types.fixture.length) parts.push(`TEST_FIXTURE_ONLY[${i.acquisition_types.fixture.join(' ')}]`);
  if (!parts.length) parts.push(i.id === 'knife' || i.id === 'water_flask' || i.id === 'torch' ? 'starter kit' : 'none found in graph');
  return parts.join('; ');
}

function consumerSummary(i: OntologyItem): string {
  const t = i.consumer_targets, m = i.maintenance_targets.length;
  const head = t.length ? `${t.length} target(s): ${t.slice(0, 6).join(' ')}${t.length > 6 ? ' …' : ''}` : 'no craft/build consumer';
  return m ? `${head}; ${m} upkeep use(s)` : head;
}

export interface OntologyData {
  schema: 'soh.item-ontology-report.v2';
  baseline: typeof ONTOLOGY_BASELINE;
  counts: ItemOntologyProjection['counts'];
  research: ItemOntologyProjection['research'];
  domains: typeof DOMAIN_AXIS;
  classes: { id: string; label: string; meaning: string }[];
  manifest: ManifestRow[];
  disposition_counts: Record<string, number>;
  items: OntologyItem[];
  recipes: OntologyRecipe[];
  dominated_alternatives: ItemOntologyProjection['dominated_alternatives'];
  twin_intermediates: ItemOntologyProjection['twin_intermediates'];
  recycle_loops: ItemOntologyProjection['recycle_loops'];
  veyra_blocked_recipes: string[];
  shipping_blocked_recipes: string[];
  proposals: readonly Proposal[];
  parts: { scope: readonly string[]; options: typeof PARTS_OPTIONS; recommendation: typeof PARTS_RECOMMENDATION };
  li_crosswalk: LiCrosswalkRow[];
  add_reviewed: typeof ADD_CANDIDATES_REVIEWED;
}

export function buildLiCrosswalk(atlas: LiAtlas): LiCrosswalkRow[] {
  const ids = new Set<string>();
  const usedBy = new Map<string, string[]>();
  const recipe = new Map<string, LiAtlas['recipes'][number]>();
  for (const r of atlas.recipes) {
    ids.add(r.id); recipe.set(r.id, r);
    for (const k of Object.keys(r.ingredients)) { ids.add(k); usedBy.set(k, [...(usedBy.get(k) ?? []), r.id]); }
  }
  for (const k of Object.keys(atlas.items)) ids.add(k);
  const loot = new Map<string, Set<string>>();
  for (const e of atlas.loot_edges) { ids.add(e.item); loot.set(e.item, (loot.get(e.item) ?? new Set()).add(e.container)); }
  return [...ids].sort().map((id) => {
    const row = LI_CROSSWALK[id];
    const r = recipe.get(id);
    const src: string[] = [];
    if (atlas.items[id]) src.push(...atlas.items[id].channels);
    if (loot.has(id)) src.push(`loot: ${[...loot.get(id)!].sort().join(', ')}`);
    if (r) src.push('craft');
    const u = usedBy.get(id) ?? [];
    return {
      li_id: id,
      li_role: row?.role ?? 'UNCLASSIFIED',
      li_source: src.join('; ') || 'not recorded in atlas',
      li_recipe: r ? `bench ${r.bench ?? '-'}: ${Object.entries(r.ingredients).map(([k, q]) => `${q} ${k}`).join(' + ')}` : 'no recipe recorded',
      li_consumers: u.length ? `${u.length}: ${u.slice(0, 6).join(' ')}${u.length > 6 ? ' …' : ''}` : 'end item / none recorded',
      soh_equivalent: row?.soh ?? '?',
      verdict: row?.verdict ?? 'UNCLASSIFIED',
      why: row?.why ?? '',
    };
  });
}

export function buildOntologyData(p: ItemOntologyProjection, atlas: LiAtlas): OntologyData {
  const provisional = new Set(SOH_PROVISIONAL_ITEMS);
  const manifest: ManifestRow[] = p.items.map((i) => {
    const d = decisionFor(i.id);
    const authority = i.generated_deployable ? 'GENERATED_FROM_DEPLOYABLE_TYPES'
      : BIBLE_PROTECTED.test(i.id) ? 'BIBLE_PROTECTED' : provisional.has(i.id) ? 'SOH_PROVISIONAL' : 'RUNTIME_CATALOG';
    return {
      old_id: i.id,
      proposed_id: d?.proposed_id ?? i.id,
      display_name: d?.proposed_name ? `${i.name} → ${d.proposed_name}` : d?.was_name ? `${i.name} (was: ${d.was_name})` : i.name,
      level: `L${i.craft_depth}`,
      domain: d?.domain ?? 'UNASSIGNED',
      source: sourceSummary(i),
      consumer: consumerSummary(i),
      action: i.direct_use.filter((u) => !u.startsWith('graph:')).join(' ') || (i.consumer_targets.length || i.maintenance_targets.length ? 'ingredient' : 'none'),
      role: i.item_class ? ITEM_CLASS_LABEL[i.item_class] : i.cat,
      LI_reference: d?.li ?? 'none',
      decision: d?.decision ?? 'DEFER',
      justification: d?.why ?? 'NO DECISION RECORDED',
      migration_required: d?.proposal ? MIGRATION[d.proposal] ?? 'TBD' : 'NO',
      authority_status: d?.proposal ? `${authority}; ${PROPOSAL_STATUS[d.proposal] ?? 'OPEN'}(${d.proposal})` : `${authority}; NO_CHANGE_PROPOSED`,
      station_tier: i.station_tier ?? '-',
      research_tier: i.research_tier === null ? '-' : String(i.research_tier),
      runtime_reachability: i.runtime_reachability,
      proposal: d?.proposal ?? '',
    };
  });
  for (const a of ADD_CANDIDATES_REVIEWED) {
    manifest.push({
      old_id: '-', proposed_id: a.li, display_name: a.li, level: '-', domain: '-', source: 'Last Island reference', consumer: '-', action: '-', role: '-',
      LI_reference: a.li, decision: 'ADD_CANDIDATE', justification: `Reviewed, ${a.verdict}: ${a.why}`, migration_required: 'NO',
      authority_status: a.verdict === 'BACKLOG' ? 'UNAPPROVED_BACKLOG; NOT_ADDED' : 'REVIEWED; NOT_ADDED',
      station_tier: '-', research_tier: '-', runtime_reachability: '-', proposal: '',
    });
  }
  const disposition_counts: Record<string, number> = {};
  for (const m of manifest) disposition_counts[m.decision] = (disposition_counts[m.decision] ?? 0) + 1;
  return {
    schema: 'soh.item-ontology-report.v2', baseline: ONTOLOGY_BASELINE, counts: p.counts, research: p.research,
    domains: DOMAIN_AXIS,
    classes: (Object.keys(ITEM_CLASS_LABEL) as (keyof typeof ITEM_CLASS_LABEL)[]).map((id) => ({ id, label: ITEM_CLASS_LABEL[id], meaning: ITEM_CLASS_MEANING[id] })),
    manifest, disposition_counts, items: p.items, recipes: p.recipes,
    dominated_alternatives: p.dominated_alternatives, twin_intermediates: p.twin_intermediates, recycle_loops: p.recycle_loops,
    veyra_blocked_recipes: p.veyra_blocked_recipes, shipping_blocked_recipes: p.shipping_blocked_recipes,
    proposals: PROPOSALS, parts: { scope: PARTS_SCOPE, options: PARTS_OPTIONS, recommendation: PARTS_RECOMMENDATION },
    li_crosswalk: buildLiCrosswalk(atlas), add_reviewed: ADD_CANDIDATES_REVIEWED,
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────────────────────────
const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv<T extends object>(rows: T[], cols: (keyof T)[]): string {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}
export const manifestCsv = (d: OntologyData) => toCsv(d.manifest, MANIFEST_COLUMNS);
export const LI_COLUMNS: (keyof LiCrosswalkRow)[] = ['li_id', 'li_role', 'li_source', 'li_recipe', 'li_consumers', 'soh_equivalent', 'verdict', 'why'];
export const liCrosswalkCsv = (d: OntologyData) => toCsv(d.li_crosswalk, LI_COLUMNS);

// ── Markdown appendix ──────────────────────────────────────────────────────────────────────────
const bom = (xs: [string, number][]) => xs.map(([k, q]) => `${q} ${k}`).join(' + ') || '—';
const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)].join('\n');
const recipeRows = (xs: RecipeLine[] | undefined) => (xs ?? []).map((r) => [`\`${r.id}\``, bom(r.ins), bom(r.out), r.station, r.note ?? '']);
const structRows = (xs: StructLine[] | undefined) => (xs ?? []).map((r) => [`\`${r.id}\``, bom(r.cost), r.note ?? '']);

export function appendixMd(d: OntologyData): string {
  const c = d.counts;
  const o: string[] = [];
  const byDecision = (x: Disposition) => d.manifest.filter((m) => m.decision === x);
  o.push('# Item Ontology V2 — appendix to the Bible and the industrial-economy ledger');
  o.push('');
  o.push('> GENERATED by `web/tests/item-ontology-v2.test.ts` from the live economic multigraph (`economic-graph.ts` → `item-ontology.ts`) and the decision table (`item-ontology-decisions.ts`). Do not edit by hand: change the source and regenerate with `SOH_WRITE_ONTOLOGY=1`. This appendix is not a second canon. Rules live in `web/ref/bible.md`; this file records an audit and a set of proposals awaiting approval.');
  o.push('');
  o.push('## 1. Baseline');
  o.push('');
  o.push(`Audited on \`${d.baseline.repo}\` branch \`${d.baseline.branch}\` at \`${d.baseline.sha}\` (head of draft PR #${d.baseline.pr}); round 2 changes are measured against that same base. PR #${d.baseline.rejected_pr} was not used as a base and its graph module was not copied.`);
  o.push('');
  o.push(table(['Measure', 'Value', 'Where it comes from'], [
    ['Runtime item ids', String(c.items), '`ITEMS` in `catalog.ts`'],
    ['— written by hand', String(c.items_static), 'literal rows (includes 12 Elder stones)'],
    ['— generated packed devices', String(c.items_generated_deployable), '`deploy_<type>` loop over `DEPLOYABLE_TYPES` (PA1)'],
    ['Recipes', String(c.recipes), '`RECIPES`'],
    ['— generated `deploy_*` recipes', String(c.recipes_deploy), 'cost copied from `STRUCTS`'],
    ['Recipe revision', String(c.recipe_revision), '`recipe-migration.ts`'],
    ['Retired recipes', c.retired_recipes.join(', ') || 'none', '`RETIRED_RECIPES` (item kept)'],
    ['Multigraph', `${c.graph_nodes} nodes / ${c.graph_edges} edges`, '`buildSohEconomicGraph`'],
  ]));
  o.push('');
  o.push('## 2. Six different things the old audit called "level"');
  o.push('');
  o.push(table(['Field', 'Meaning', 'Source'], [
    ['`craft_depth`', 'Recipes between the item and raw inputs (L0 = not crafted). Shortest live route.', 'recipe graph'],
    ['`station_tier`', 'Station and station level the route needs.', '`RecipeDef.station` + `stationLevel`'],
    ['`research_tier`', 'Knowledge tier of the recipe (0 = known at start).', '`RecipeDef.tier`'],
    ['`rarity`', 'Always `null`. The game has no rarity stat and the graph solver ignores probability; inventing one would be fiction.', '—'],
    ['`acquisition_type`', 'Edge kinds that put the item into a player\'s hands, per layout.', 'multigraph in-edges'],
    ['`runtime_reachability`', 'Whether the reachability fixpoint can obtain it on Shipping / Veyra. A loot-table row does not count unless the container is reachable.', '`diagnostics.*ReachableItems`'],
  ]));
  o.push('');
  o.push('### Level graph (craft depth)');
  o.push('');
  o.push(table(['Depth', 'Items', 'Examples'], Object.keys(c.by_craft_depth).sort().map((k) => {
    const ex = d.items.filter((i) => `L${i.craft_depth}` === k && !i.generated_deployable && !i.id.startsWith('stone_')).slice(0, 8).map((i) => i.id).join(', ');
    return [k, String(c.by_craft_depth[k]), ex];
  })));
  o.push('');
  o.push(`Reachability: ${Object.entries(c.by_reachability).map(([k, v]) => `${k} ${v}`).join(' · ')}.`);
  o.push('');
  o.push('## 3. One material axis per domain');
  o.push('');
  o.push(table(['Domain', 'Axis a newcomer should be able to repeat', 'Items'], (Object.keys(d.domains) as Domain[]).map((k) =>
    [d.domains[k].title, d.domains[k].axis, String(d.manifest.filter((m) => m.domain === k).length)])));
  o.push('');
  o.push('## 4. What the audit found');
  o.push('');
  o.push('### 4.1 Alternative recipes that are not a choice');
  o.push('');
  o.push(table(['Output', 'Cheaper', 'Dearer', 'Verdict', 'Note'], d.dominated_alternatives.map((x) => [x.out, `\`${x.cheaper}\``, `\`${x.dearer}\``, x.verdict, x.note])));
  o.push('');
  o.push('`STRICTLY_DOMINATED` is fake complexity. `KNOWLEDGE_BYPASS` and `STATION_TRADEOFF` are real choices and are kept.');
  o.push('');
  o.push('### 4.2 Twin intermediates (same raw inputs, same station tier)');
  o.push('');
  o.push(table(['A', 'B', 'Shared raw inputs', 'Station tier'], d.twin_intermediates.map((t) => [t.a, t.b, t.raw_inputs.join(', '), t.station_tier])));
  o.push('');
  o.push('### 4.3 Recycler loops, read as if Machine Parts and Parts were one resource');
  o.push('');
  o.push(table(['Item', 'Rule', 'Returns', 'Parts in', 'Parts out', 'Verdict'], d.recycle_loops.map((l) => [l.item, l.rule, bom(l.outputs), String(l.parts_in), String(l.parts_out), l.merged_parts_verdict])));
  o.push('');
  o.push('A `PARTS_POSITIVE` row is harmless today (Machine Parts are not a currency) and would be a research-currency mint under a merge. This is the main evidence against Option B below.');
  o.push('');
  o.push('### 4.4 Item signals');
  o.push('');
  o.push(table(['Item', 'Depth', 'Signals'], d.items.filter((i) => i.signals.length && !i.id.startsWith('stone_')).map((i) => [i.id, `L${i.craft_depth}`, i.signals.join(', ')])));
  o.push('');
  o.push(`Recipes that cannot run on Shipping: ${d.shipping_blocked_recipes.map((x) => `\`${x}\``).join(', ') || 'none'}. On Veyra: ${d.veyra_blocked_recipes.map((x) => `\`${x}\``).join(', ') || 'none'}.`);
  o.push('');
  o.push('## 5. Dispositions');
  o.push('');
  o.push(table(['Decision', 'Count'], Object.keys(d.disposition_counts).sort().map((k) => [k, String(d.disposition_counts[k])])));
  o.push('');
  for (const dec of ['RENAME', 'REDESIGN', 'MERGE_CANDIDATE', 'RETIRE_CANDIDATE', 'DEFER', 'ADD_CANDIDATE'] as Disposition[]) {
    const rows = byDecision(dec);
    if (!rows.length) continue;
    o.push(`### ${dec}`);
    o.push('');
    o.push(table(['Item', 'Name', 'Proposal', 'Why'], rows.map((m) => [m.old_id === '-' ? m.proposed_id : `\`${m.old_id}\``, m.display_name, m.proposal || '—', m.justification])));
    o.push('');
  }
  o.push(`KEEP (${byDecision('KEEP').length}) is listed row by row, with a reason each, in \`manifest.csv\`.`);
  o.push('');
  o.push('### Newcomer load');
  o.push('');
  const res = c.by_cat.res ?? 0;
  o.push(`Before this PR ${res} items shared the single chip "MATERIAL". They now show one of ${Object.keys(c.by_class).length} classes (display only). Round 2 removed one redundant recipe (\`vehicle_frame_piped\`), gave Pipe and Blade a required consumer and Plate a Recycler rule, and left exactly one item called Parts. The item count did not change: Fasteners and Plank stay by ruling.`);
  o.push('');
  o.push('## 6. Parts decision package');
  o.push('');
  o.push(`Scope: ${d.parts.scope.map((x) => `\`${x}\``).join(', ')}. Research costs today: random ${d.research.random_spares} / directed ${d.research.directed_spares} \`spares\`.`);
  o.push('');
  o.push(table(['Item', 'Depth', 'Made by', 'Non-craft sources', 'Craft/build targets', 'Upkeep uses', 'Recycler'], d.parts.scope.map((id) => {
    const i = d.items.find((x) => x.id === id)!;
    const kinds = [...new Set([...i.acquisition_types.shipping, ...i.acquisition_types.veyra])].filter((k) => k !== 'CRAFT_OUTPUT').length;
    return [`\`${id}\` (${i.name})`, `L${i.craft_depth}`, i.produced_by.join(', ') || 'not craftable', String(kinds), String(i.consumer_targets.length), String(i.maintenance_targets.length), i.recycle ? `${i.recycle.rule} → ${bom(i.recycle.outputs)}` : 'no rule'];
  })));
  o.push('');
  const keys = Object.keys(d.parts.options[0].scores) as (keyof typeof d.parts.options[0]['scores'])[];
  o.push(table(['Criterion', ...d.parts.options.map((x) => `Option ${x.id}: ${x.title}`)], [
    ['Summary', ...d.parts.options.map((x) => x.summary)],
    ...keys.map((k) => [k.replace(/_/g, ' '), ...d.parts.options.map((x) => x.scores[k])]),
  ]));
  o.push('');
  o.push(`**Recommendation: Option ${d.parts.recommendation.choose}.** ${d.parts.recommendation.reason}`);
  o.push('');
  o.push('## 7. Proposals and their round-2 status');
  o.push('');
  o.push('IMPLEMENTED = live at recipe revision ' + c.recipe_revision + '. NOT_AUTHORISED = ruled out; analysis only. OPEN = not implemented, owner decision needed. Measured before/after numbers: `web/evidence/item-ontology-v2/round2-simulations.json`. Open findings: `ROUND2_FINDINGS.md`. **Item V2 is not complete while any row is OPEN.**');
  o.push('');
  o.push(table(['Id', 'Title', 'Status', 'Ruling', 'Items'], d.proposals.map((p) => [p.id, p.title, p.status, p.ruling, p.items.join(', ')])));
  o.push('');
  for (const p of d.proposals) {
    o.push(`### ${p.id}. ${p.title} — ${p.status}`);
    o.push('');
    o.push(`**Ruling.** ${p.ruling}`);
    o.push('');
    if (p.shipped?.length) { o.push('Shipped:'); o.push(''); for (const x of p.shipped) o.push(`- ${x}`); o.push(''); }
    o.push(`**Problem.** ${p.problem}`);
    o.push('');
    o.push(`**${p.status.startsWith('IMPLEMENTED') ? 'Decision' : 'Round-1 proposal (not implemented)'}.** ${p.decision}`);
    o.push('');
    if (p.before_recipes?.length) { o.push('Recipes before:'); o.push(''); o.push(table(['Recipe', 'Inputs', 'Output', 'Station', 'Note'], recipeRows(p.before_recipes))); o.push(''); }
    if (p.after_recipes?.length) { o.push('Recipes after:'); o.push(''); o.push(table(['Recipe', 'Inputs', 'Output', 'Station', 'Note'], recipeRows(p.after_recipes))); o.push(''); }
    if (p.before_structs?.length) { o.push('Structure cost before:'); o.push(''); o.push(table(['Structure', 'Cost', 'Note'], structRows(p.before_structs))); o.push(''); }
    if (p.after_structs?.length) { o.push('Structure cost after:'); o.push(''); o.push(table(['Structure', 'Cost', 'Note'], structRows(p.after_structs))); o.push(''); }
    o.push('Migration:'); o.push(''); for (const m of p.migration) o.push(`- ${m}`); o.push('');
    o.push(`**Risk.** ${p.risk}`); o.push('');
    o.push(p.status.startsWith('IMPLEMENTED') ? 'Tests:' : 'Tests a future change would need:'); o.push(''); for (const t of p.tests) o.push(`- ${t}`); o.push('');
  }
  o.push('## 8. Last Island crosswalk');
  o.push('');
  const lv: Record<string, number> = {};
  for (const r of d.li_crosswalk) lv[r.verdict] = (lv[r.verdict] ?? 0) + 1;
  o.push(`${d.li_crosswalk.length} Last Island item ids from \`web/ref/atlas/extracted/ATLAS_v2.json\`: ${Object.entries(lv).map(([k, v]) => `${k} ${v}`).join(' · ')}. Full rows in \`li-crosswalk.csv\`. The atlas records no drop rates, recycler yields or smelt ratios (its unresolved list U01–U12), so Last Island is used for structure only, never for numbers.`);
  o.push('');
  o.push(table(['LI item', 'Role in LI', 'SOH equivalent', 'Verdict', 'Why'], d.li_crosswalk.filter((r) => !/^(Gun|Ammunition|Explosive|Gun body|Heavy weapon part|Ammunition reagent)$/.test(r.li_role) || r.li_id === 'sulfur_powder').map((r) => [r.li_id, r.li_role, r.soh_equivalent, r.verdict, r.why])));
  o.push('');
  o.push(`The ${d.li_crosswalk.filter((r) => /^(Gun|Ammunition|Explosive|Gun body|Heavy weapon part)$/.test(r.li_role) || r.li_id === 'gunpowder').length} firearm, ammunition and explosive rows are all NOT_ADDED for the same reason (no gun mechanic in SOH) and are listed in the CSV.`);
  o.push('');
  return o.join('\n') + '\n';
}

// ── HTML explorer ──────────────────────────────────────────────────────────────────────────────
export function explorerHtml(d: OntologyData): string {
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soul of Hero — Item Ontology V2</title>
<style>
:root{--bg:#f6f5f1;--panel:#fff;--ink:#1d2327;--mute:#5d676d;--line:#d9d6cd;--acc:#1f6f6b;--warn:#a4541a;--bad:#a12d2d;--ok:#2c6e3f;--chip:#ebe8df}
@media(prefers-color-scheme:dark){:root{--bg:#15191b;--panel:#1e2427;--ink:#e6e3da;--mute:#9aa4a8;--line:#333c40;--acc:#5fc0b8;--warn:#e0a060;--bad:#e58080;--ok:#7fcf93;--chip:#2a3236}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:16px 20px 0;max-width:1400px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 8px}h3{font-size:14px;margin:16px 0 6px}
.sub{color:var(--mute);font-size:13px}main{max-width:1400px;margin:0 auto;padding:0 20px 60px}
nav{display:flex;gap:4px;flex-wrap:wrap;margin:14px 0 0;border-bottom:1px solid var(--line)}
nav button{background:none;border:0;border-bottom:2px solid transparent;color:var(--mute);padding:8px 12px;font:inherit;cursor:pointer}
nav button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--acc);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.card b{display:block;font-size:22px}.card span{color:var(--mute);font-size:12px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center}
input,select{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}input[type=search]{min-width:240px}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{position:sticky;top:0;background:var(--panel);font-size:12px;color:var(--mute);font-weight:600;white-space:nowrap}tr:last-child td{border-bottom:0}
tbody tr.row{cursor:pointer}tbody tr.row:hover{background:var(--chip)}
code{font:12px ui-monospace,Menlo,Consolas,monospace;background:var(--chip);padding:1px 4px;border-radius:4px}
.chip{display:inline-block;padding:1px 7px;border-radius:10px;background:var(--chip);font-size:11px;font-weight:600;white-space:nowrap;margin:1px 2px 1px 0}
.KEEP{color:var(--ok)}.RENAME,.REDESIGN,.DEFER{color:var(--warn)}.MERGE_CANDIDATE,.RETIRE_CANDIDATE{color:var(--bad)}.ADD_CANDIDATE{color:var(--acc)}
.detail td{background:var(--bg);font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.box{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}.box p{margin:6px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:800px){.two{grid-template-columns:1fr}}
.mute{color:var(--mute)}.rec{font-weight:700;color:var(--acc)}ul{margin:6px 0;padding-left:20px}.count{color:var(--mute);font-size:12px}
</style></head><body>
<header><h1>Soul of Hero — Item Ontology V2</h1>
<div class="sub" id="sub"></div>
<nav id="nav" role="tablist"></nav></header>
<main id="main"></main>
<script id="data" type="application/json">${json}</script>
<script>
const D=JSON.parse(document.getElementById('data').textContent);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const bom=x=>(x||[]).map(([k,q])=>q+' '+k).join(' + ')||'—';
const chip=(t,c)=>'<span class="chip '+(c||'')+'">'+esc(t)+'</span>';
const M=Object.fromEntries(D.manifest.map(m=>[m.old_id,m]));
const tbl=(head,rows)=>'<div class="wrap"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const tr=cells=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
document.getElementById('sub').innerHTML='Generated from the live economic multigraph at <code>'+D.baseline.sha.slice(0,9)+'</code> ('+esc(D.baseline.branch)+'). '+D.counts.items+' items · '+D.counts.recipes+' recipes · '+D.counts.graph_nodes+' nodes / '+D.counts.graph_edges+' edges. Round 2: each proposal carries its status — implemented at this recipe revision, not authorised, or still open.';
const TABS={Overview:overview,Items:items,Recipes:recipes,'Proposals and status':changes,'Parts decision':parts,'Last Island':li,Findings:findings};
const nav=document.getElementById('nav'),main=document.getElementById('main');
Object.keys(TABS).forEach((t,i)=>{const b=document.createElement('button');b.textContent=t;b.setAttribute('role','tab');b.onclick=()=>show(t);nav.appendChild(b)});
function show(t){[...nav.children].forEach(b=>b.setAttribute('aria-selected',b.textContent===t));main.innerHTML='';TABS[t]();location.hash=encodeURIComponent(t)}
function overview(){
 const c=D.counts;
 main.innerHTML='<div class="cards">'+[[c.items,'runtime items'],[c.items_generated_deployable,'generated packed devices'],[c.recipes,'recipes'],[c.recipe_revision,'recipe revision'],[D.proposals.filter(x=>x.status.indexOf('IMPLEMENTED')===0).length,'proposals implemented'],[D.proposals.filter(x=>x.status==='NOT_AUTHORISED').length,'not authorised'],[D.proposals.filter(x=>x.status==='OPEN').length,'still open'],[D.li_crosswalk.length,'Last Island items compared']].map(([n,l])=>'<div class="card"><b>'+n+'</b><span>'+l+'</span></div>').join('')+'</div>'
 +'<h2>Decisions</h2><div class="cards">'+Object.entries(D.disposition_counts).sort().map(([k,v])=>'<div class="card"><b class="'+k+'">'+v+'</b><span>'+k+'</span></div>').join('')+'</div>'
 +'<h2>Level graph (craft depth)</h2>'+tbl(['Depth','Items','Meaning'],Object.keys(c.by_craft_depth).sort().map(k=>tr([chip(k),c.by_craft_depth[k],k==='L0'?'Not crafted: gathered, looted, dropped or granted':'Needs '+k.slice(1)+' recipe step(s) from raw inputs'])))
 +'<p class="mute">Craft depth is not rarity, not station tier and not research tier. Each is a separate column on the Items tab. Rarity is deliberately empty: the game has no rarity stat.</p>'
 +'<h2>One material axis per domain</h2>'+tbl(['Domain','Axis','Items'],Object.entries(D.domains).map(([k,v])=>tr(['<b>'+esc(v.title)+'</b>',esc(v.axis),D.manifest.filter(m=>m.domain===k).length])))
 +'<h2>Reachability</h2>'+tbl(['Status','Items'],Object.entries(c.by_reachability).map(([k,v])=>tr([chip(k),v])))
 +'<h2>Player-facing classes (replaces the single MATERIAL chip)</h2>'+tbl(['Class','Meaning','Items'],D.classes.filter(x=>c.by_class[x.id]).map(x=>tr([chip(x.label),esc(x.meaning),c.by_class[x.id]])));
}
function items(){
 main.innerHTML='<div class="bar"><input type="search" id="q" placeholder="Search id, name, source…" aria-label="Search items"><select id="fd" aria-label="Decision"><option value="">All decisions</option>'+Object.keys(D.disposition_counts).sort().map(k=>'<option>'+k+'</option>').join('')+'</select><select id="fdom" aria-label="Domain"><option value="">All domains</option>'+Object.entries(D.domains).map(([k,v])=>'<option value="'+k+'">'+esc(v.title)+'</option>').join('')+'</select><select id="fl" aria-label="Depth"><option value="">All depths</option>'+Object.keys(D.counts.by_craft_depth).sort().map(k=>'<option>'+k+'</option>').join('')+'</select><label><input type="checkbox" id="gen"> show generated devices and Elder stones</label><span class="count" id="n"></span></div><div id="t"></div>';
 const draw=()=>{const q=document.getElementById('q').value.toLowerCase(),fd=document.getElementById('fd').value,fdom=document.getElementById('fdom').value,fl=document.getElementById('fl').value,gen=document.getElementById('gen').checked;
  const rows=D.manifest.filter(m=>(!fd||m.decision===fd)&&(!fdom||m.domain===fdom)&&(!fl||m.level===fl)&&(gen||fd||!/^(deploy_|stone_)/.test(m.old_id))&&(!q||JSON.stringify(m).toLowerCase().includes(q)));
  document.getElementById('n').textContent=rows.length+' rows';
  document.getElementById('t').innerHTML=tbl(['Item','Name','Level','Station','Research','Class','Domain','Reachable','Decision','Why'],rows.map(m=>'<tr class="row" data-id="'+esc(m.old_id==='-'?m.proposed_id:m.old_id)+'"><td><code>'+esc(m.old_id==='-'?m.proposed_id:m.old_id)+'</code></td><td>'+esc(m.display_name)+'</td><td>'+chip(m.level)+'</td><td>'+esc(m.station_tier)+'</td><td>'+esc(m.research_tier)+'</td><td>'+chip(m.role)+'</td><td>'+esc((D.domains[m.domain]||{}).title||m.domain)+'</td><td>'+esc(m.runtime_reachability.replace(/_/g,' ').toLowerCase())+'</td><td>'+chip(m.decision,m.decision)+(m.proposal?' <code>'+m.proposal+'</code>':'')+'</td><td>'+esc(m.justification)+'</td></tr>'));
  document.querySelectorAll('#t tr.row').forEach(r=>r.onclick=()=>toggle(r))};
 ['q','fd','fdom','fl','gen'].forEach(i=>document.getElementById(i).oninput=draw);draw();
}
function toggle(r){if(r.nextSibling&&r.nextSibling.className==='detail'){r.nextSibling.remove();return}
 const i=D.items.find(x=>x.id===r.dataset.id);if(!i)return;const m=M[i.id];
 const src=i.sources.map(s=>'<li>'+esc(s.kind)+' ← <code>'+esc(s.from)+'</code> <span class="mute">'+esc(s.layer)+(s.qty!=null?' ×'+s.qty:'')+(s.probability!=null?' p='+s.probability:'')+(s.count>1?' ('+s.count+' edges)':'')+'</span></li>').join('')||'<li class="mute">none</li>';
 const con=i.consumers.map(s=>'<li>'+esc(s.kind)+' → <code>'+esc(s.to)+'</code> <span class="mute">'+esc(s.layer)+(s.qty!=null?' ×'+s.qty:'')+(s.count>1?' ('+s.count+' edges)':'')+'</span></li>').join('')||'<li class="mute">none</li>';
 const d=document.createElement('tr');d.className='detail';d.innerHTML='<td colspan="10"><p>'+esc(i.desc)+'</p><div class="grid"><div><h3>Sources ('+i.sources.length+')</h3><ul>'+src+'</ul></div><div><h3>Consumers ('+i.consumers.length+')</h3><ul>'+con+'</ul></div><div><h3>Facts</h3><ul><li>Does: '+(i.direct_use.map(u=>chip(u)).join('')||'<span class="mute">nothing on its own</span>')+'</li><li>Made by: '+(i.produced_by.map(x=>'<code>'+x+'</code>').join(' ')||'not craftable')+'</li><li>Raw cost per unit: '+esc(Object.entries(i.raw_per_unit).map(([k,q])=>q+' '+k).join(' + ')||'—')+'</li><li>Recycler: '+(i.recycle?'<code>'+esc(i.recycle.rule)+'</code> → '+esc(bom(i.recycle.outputs)):'no rule')+'</li><li>Knowledge: '+esc(i.knowledge)+'</li><li>Signals: '+(i.signals.map(s=>chip(s)).join('')||'<span class="mute">none</span>')+'</li><li>Authority: '+esc(m.authority_status)+'</li><li>Migration: '+esc(m.migration_required)+'</li><li>Last Island: '+esc(m.LI_reference)+'</li></ul></div></div></td>';
 r.after(d)}
function recipes(){
 main.innerHTML='<div class="bar"><input type="search" id="q" placeholder="Search recipe, input, output…" aria-label="Search recipes"><label><input type="checkbox" id="gen"> show generated deploy recipes</label><span class="count" id="n"></span></div><div id="t"></div>';
 const dom=new Set(D.dominated_alternatives.filter(x=>x.verdict==='STRICTLY_DOMINATED').map(x=>x.dearer));
 const prop={};D.proposals.forEach(p=>(p.before_recipes||[]).forEach(r=>prop[r.id]=p.id));
 const draw=()=>{const q=document.getElementById('q').value.toLowerCase(),gen=document.getElementById('gen').checked;
  const rows=D.recipes.filter(r=>(gen||!r.id.startsWith('deploy_'))&&(!q||JSON.stringify([r.id,r.ins,r.outs,r.station_tier]).toLowerCase().includes(q)));
  document.getElementById('n').textContent=rows.length+' recipes';
  document.getElementById('t').innerHTML=tbl(['Recipe','Inputs','Output','Station','Research','Known at start','Depth','Raw cost per unit','Layouts','Flags'],rows.map(r=>tr(['<code>'+esc(r.id)+'</code>',esc(bom(r.ins)),esc(bom(r.outs)),esc(r.station_tier),'t'+r.research_tier,r.starter_known?'yes':'no',chip('L'+r.depth),esc(Object.entries(r.bom.raw).map(([k,v])=>v+' '+k).join(' + ')),(r.craftable_shipping?'Shipping ':'')+(r.craftable_veyra?'Veyra':'')||'<span class="MERGE_CANDIDATE">neither</span>',(dom.has(r.id)?chip('strictly dominated','MERGE_CANDIDATE'):'')+(prop[r.id]?chip('changes in '+prop[r.id],'RENAME'):'')+(r.alias?chip('alternate'):'')])))};
 ['q','gen'].forEach(i=>document.getElementById(i).oninput=draw);draw();
}
const rt=x=>x&&x.length?tbl(['Recipe','Inputs','Output','Station','Note'],x.map(r=>tr(['<code>'+esc(r.id)+'</code>',esc(bom(r.ins)),esc(bom(r.out)),esc(r.station),esc(r.note||'')]))):'';
const st=x=>x&&x.length?tbl(['Structure','Cost','Note'],x.map(r=>tr(['<code>'+esc(r.id)+'</code>',esc(bom(r.cost)),esc(r.note||'')]))):'';
function changes(){
 main.innerHTML='<p class="mute">Round 2 status of every proposal. IMPLEMENTED = live at recipe revision '+D.counts.recipe_revision+'. NOT AUTHORISED = ruled out, analysis only. OPEN = not implemented; Item V2 is not complete while any is open. Measured numbers are in <code>web/evidence/item-ontology-v2/round2-simulations.json</code>; open findings in <code>ROUND2_FINDINGS.md</code>.</p>'+D.proposals.map(p=>'<div class="box" id="'+p.id+'"><h2 style="margin-top:0">'+p.id+'. '+esc(p.title)+' '+chip(p.status.replace(/_/g,' '),p.status.indexOf('IMPLEMENTED')===0?'KEEP':p.status==='OPEN'?'RENAME':'MERGE_CANDIDATE')+'</h2><p>'+p.items.map(i=>'<code>'+i+'</code>').join(' ')+'</p><p><b>Ruling.</b> '+esc(p.ruling)+'</p>'+(p.shipped?'<h3>Shipped</h3><ul>'+p.shipped.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>':'')+'<p><b>Problem.</b> '+esc(p.problem)+'</p><p><b>'+(p.status.indexOf('IMPLEMENTED')===0?'Decision':'Round-1 proposal (not implemented)')+'.</b> '+esc(p.decision)+'</p>'+((p.before_recipes||p.before_structs)?'<div class="two"><div><h3>Before</h3>'+rt(p.before_recipes)+st(p.before_structs)+'</div><div><h3>After</h3>'+rt(p.after_recipes)+st(p.after_structs)+'</div></div>':'')+'<h3>Migration</h3><ul>'+p.migration.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul><p><b>Risk.</b> '+esc(p.risk)+'</p><h3>Tests</h3><ul>'+p.tests.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>').join('');
}
function parts(){
 const keys=Object.keys(D.parts.options[0].scores);
 main.innerHTML='<h2>The eight items</h2>'+tbl(['Item','Depth','Made by','Craft/build targets','Upkeep uses','Recycler','Decision'],D.parts.scope.map(id=>{const i=D.items.find(x=>x.id===id),m=M[id];return tr(['<code>'+id+'</code> '+esc(m.display_name),chip('L'+i.craft_depth),i.produced_by.map(x=>'<code>'+x+'</code>').join(' ')||'<b>not craftable</b>',i.consumer_targets.length,i.maintenance_targets.length,i.recycle?'<code>'+esc(i.recycle.rule)+'</code> → '+esc(bom(i.recycle.outputs)):'no rule',chip(m.decision,m.decision)])}))
 +'<p class="mute">Research costs '+D.research.random_spares+' (random) or '+D.research.directed_spares+' (directed) <code>spares</code>.</p>'
 +'<h2>Options</h2>'+tbl(['Criterion'].concat(D.parts.options.map(o=>'Option '+o.id+': '+o.title)),[tr(['Summary'].concat(D.parts.options.map(o=>esc(o.summary))))].concat(keys.map(k=>tr(['<b>'+k.replace(/_/g,' ')+'</b>'].concat(D.parts.options.map(o=>esc(o.scores[k])))))))
 +'<div class="box"><span class="rec">Recommendation: Option '+D.parts.recommendation.choose+'.</span> '+esc(D.parts.recommendation.reason)+'</div>'
 +'<h2>Why merging is unsafe: Recycler loops if Machine Parts were Parts</h2>'+tbl(['Item','Rule','Returns','Parts in','Parts out','Verdict'],D.recycle_loops.map(l=>tr(['<code>'+l.item+'</code>','<code>'+esc(l.rule)+'</code>',esc(bom(l.outputs)),l.parts_in,l.parts_out,chip(l.merged_parts_verdict.replace(/_/g,' '),l.merged_parts_verdict==='PARTS_POSITIVE'?'MERGE_CANDIDATE':'')])));
}
function li(){
 main.innerHTML='<div class="bar"><input type="search" id="q" placeholder="Search Last Island item…" aria-label="Search Last Island items"><select id="fv" aria-label="Verdict"><option value="">All verdicts</option>'+[...new Set(D.li_crosswalk.map(r=>r.verdict))].sort().map(v=>'<option>'+v+'</option>').join('')+'</select><span class="count" id="n"></span></div><p class="mute">Last Island is a structural reference. The atlas has no drop rates, recycler yields or smelt ratios, so no number here is copied from it.</p><div id="t"></div>';
 const draw=()=>{const q=document.getElementById('q').value.toLowerCase(),fv=document.getElementById('fv').value;const rows=D.li_crosswalk.filter(r=>(!fv||r.verdict===fv)&&(!q||JSON.stringify(r).toLowerCase().includes(q)));
  document.getElementById('n').textContent=rows.length+' of '+D.li_crosswalk.length;
  document.getElementById('t').innerHTML=tbl(['LI item','Role','Source','Recipe','Consumers','SOH equivalent','Verdict','Why'],rows.map(r=>tr(['<code>'+esc(r.li_id)+'</code>',esc(r.li_role),esc(r.li_source),esc(r.li_recipe),esc(r.li_consumers),r.soh_equivalent==='-'?'—':'<code>'+esc(r.soh_equivalent)+'</code>',chip(r.verdict.replace(/_/g,' '),r.verdict==='NOT_ADDED'?'DEFER':r.verdict==='BACKLOG'?'MERGE_CANDIDATE':'KEEP'),esc(r.why)])))};
 ['q','fv'].forEach(i=>document.getElementById(i).oninput=draw);draw();
}
function findings(){
 main.innerHTML='<h2>Alternative recipes</h2><p class="mute">Strictly dominated = never the rational choice. Knowledge bypass and station trade-off are real choices.</p>'+tbl(['Output','Cheaper','Dearer','Verdict','Note'],D.dominated_alternatives.map(x=>tr(['<code>'+x.out+'</code>','<code>'+x.cheaper+'</code>','<code>'+x.dearer+'</code>',chip(x.verdict.replace(/_/g,' '),x.verdict==='STRICTLY_DOMINATED'?'MERGE_CANDIDATE':''),esc(x.note)])))
 +'<h2>Twin intermediates</h2>'+tbl(['A','B','Shared raw inputs','Station tier'],D.twin_intermediates.map(t=>tr(['<code>'+t.a+'</code>','<code>'+t.b+'</code>',esc(t.raw_inputs.join(', ')),esc(t.station_tier)])))
 +'<h2>Item signals</h2>'+tbl(['Item','Depth','Signals'],D.items.filter(i=>i.signals.length&&!i.id.startsWith('stone_')).map(i=>tr(['<code>'+i.id+'</code>',chip('L'+i.craft_depth),i.signals.map(s=>chip(s)).join('')])))
 +'<h2>Recipes that cannot run</h2><p>Shipping: '+(D.shipping_blocked_recipes.map(x=>'<code>'+x+'</code>').join(' ')||'none')+'</p><p>Veyra: '+(D.veyra_blocked_recipes.map(x=>'<code>'+x+'</code>').join(' ')||'none')+'</p>';
}
show(Object.keys(TABS).find(t=>t===decodeURIComponent(location.hash.slice(1)))||'Overview');
</script></body></html>
`;
}
