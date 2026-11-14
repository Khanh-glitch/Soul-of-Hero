/**
 * Item Ontology V2 — facts, decisions and generated artifacts, all checked against the LIVE game.
 *
 * Regenerate the committed artifacts after an intentional change:
 *   SOH_WRITE_ONTOLOGY=1 npx vitest run tests/item-ontology-v2.test.ts --testTimeout=600000
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS, RECIPES, STRUCTS, SOH_PROVISIONAL_ITEMS } from '../src/game/catalog';
import { buildSohEconomicGraph, type SohEconomicGraph } from '../src/game/economic-graph';
import { UNOBTAINABLE_STRUCTURES, projectItemOntology, type ItemOntologyProjection } from '../src/game/item-ontology';
import { buildRound2Findings, round2FindingsMd, type LiAtlasFull, type Round2Findings } from '../src/game/item-ontology-findings';
import { LEGACY_RECIPES, RECIPE_REVISION, RETIRED_RECIPES } from '../src/game/recipe-migration';
import { componentRuleSnapshot } from '../src/game/recycler';
import { RES_ITEM_CLASS, itemClass, itemClassLabel } from '../src/game/item-class';
import { ITEM_DECISIONS, LI_CROSSWALK, PARTS_RECOMMENDATION, PARTS_SCOPE, PROPOSALS, decisionFor } from '../src/game/item-ontology-decisions';
import {
  MANIFEST_COLUMNS, appendixMd, buildOntologyData, explorerHtml, liCrosswalkCsv, manifestCsv, type LiAtlas, type OntologyData,
} from '../src/game/item-ontology-report';
import { collectExtractionInput } from './support/economic-extraction-input';

const OUT = resolve(__dirname, '../ref/item-ontology-v2');
const ATLAS = resolve(__dirname, '../ref/atlas/extracted/ATLAS_v2.json');
const WRITE = process.env.SOH_WRITE_ONTOLOGY === '1';

let graph: SohEconomicGraph;
let p: ItemOntologyProjection;
let data: OntologyData;
let atlas: LiAtlas;
let findings: Round2Findings;
const item = (id: string) => p.items.find((i) => i.id === id)!;
const sorted = (xs: [string, number][]) => [...xs].map(([k, q]) => `${k}:${q}`).sort();

beforeAll(() => {
  graph = buildSohEconomicGraph(collectExtractionInput());
  p = projectItemOntology(graph);
  atlas = JSON.parse(readFileSync(ATLAS, 'utf8')) as LiAtlas;
  data = buildOntologyData(p, atlas);
  findings = buildRound2Findings(p, atlas as unknown as LiAtlasFull);
}, 600_000);

describe('projection is an adapter over the existing multigraph, not a second catalog', () => {
  it('covers every runtime item and recipe exactly once', () => {
    expect(p.items.map((i) => i.id).sort()).toEqual(Object.keys(ITEMS).sort());
    expect(p.recipes.map((r) => r.id).sort()).toEqual(Object.keys(RECIPES).sort());
    expect(p.counts.items).toBe(Object.keys(ITEMS).length);
    expect(p.counts.items_static + p.counts.items_generated_deployable).toBe(p.counts.items);
    expect(p.counts.graph_nodes).toBe(graph.nodes.length);
    expect(p.counts.graph_edges).toBe(graph.edges.length);
  });

  it('keeps craft depth, station tier, research tier, rarity, acquisition and reachability as separate facts', () => {
    for (const i of p.items) {
      expect(i.rarity, i.id).toBeNull(); // the game has no rarity stat; none may be invented
      if (i.produced_by.length === 0) expect(i.craft_depth, i.id).toBe(0);
    }
    // depth is structural: a recipe sits one above its deepest input
    for (const r of p.recipes) {
      if (r.layer === 'STUB') continue;
      const deepest = Math.max(0, ...r.ins.map(([k]) => item(k).craft_depth));
      expect(r.depth, r.id).toBe(deepest + 1);
    }
    // depth and research tier disagree in both directions, so one cannot stand in for the other
    expect(item('motorbike_kit').craft_depth).toBeGreaterThan(item('core_fire').craft_depth);
    expect(item('core_fire').research_tier!).toBeGreaterThan(item('motorbike_kit').research_tier!);
  });

  it('does not call an item reachable because a loot table mentions it', () => {
    const cp = item('crude_petroleum');
    expect(cp.runtime_reachability).toBe('FIXTURE_ONLY');
    expect(cp.signals).toContain('TEST_FIXTURE_SOURCE_ONLY');
    for (const id of ['chitin', 'crawler_optic', 'wolf_fang', 'beetle_horn', 'keycard']) {
      expect(item(id).runtime_reachability, id).toBe('SHIPPING_ONLY');
    }
    const reachByDiag = new Set([...graph.diagnostics.shippingReachableItems, ...graph.diagnostics.veyraReachableItems]);
    for (const i of p.items) expect(i.runtime_reachability !== 'FIXTURE_ONLY' && i.runtime_reachability !== 'UNREACHABLE', i.id).toBe(reachByDiag.has(i.id));
  });

  it('audit fix: the physical Blueprint is reachable on both layouts', () => {
    expect(graph.diagnostics.shippingUnreachableItems).not.toContain('blueprint');
    expect(graph.diagnostics.veyraUnreachableItems).not.toContain('blueprint');
    expect(item('blueprint').runtime_reachability).toBe('SHIPPING_AND_VEYRA');
  });

  it('traces sources and consumers from graph edges', () => {
    const spares = item('spares');
    expect(spares.produced_by).toEqual([]); // the research currency has no craft recipe
    expect(spares.direct_use).toContain('graph:RESEARCH_RANDOM');
    expect(spares.direct_use).toContain('graph:VENDOR_TRADE_SPARES');
    expect(spares.recycled_from.some((x) => x.includes('X:drive'))).toBe(true);
    expect(item('lead_rope').direct_use).toContain('held_tool');
    expect(item('boar_tusk').direct_use).toContain('specimen_study');
    for (const i of p.items) {
      if (i.id === 'blueprint') continue; // minted through `blueprint:<recipe>` nodes, covered by the audit-fix test
      for (const s of i.sources) expect(graph.edges.some((e) => e.to === `item:${i.id}` && e.kind === s.kind && (e.from === s.from || e.from.startsWith(s.from + ':'))), `${i.id} <- ${s.from}`).toBe(true);
    }
  });

  it('round 2 removed the fake-complexity cases it was allowed to, and still reports the rest', () => {
    // P3: no strictly dominated alternative is left, and the Pipe is no longer hostage to one.
    expect(p.dominated_alternatives.filter((d) => d.verdict === 'STRICTLY_DOMINATED')).toEqual([]);
    expect(item('metal_pipe').signals.filter((s) => s.startsWith('ONLY_USED_BY_DOMINATED_RECIPE'))).toEqual([]);
    expect(item('metal_pipe').consumer_targets).toContain('make:vehicle_frame');
    // P4: the Blade has a consumer that is not an optional alternate.
    expect(item('metal_blade').consumer_targets).toContain('make:industrial_axe');
    // P5: all four technical components have a Recycler rule.
    expect(item('iron_plate').recycle?.rule).toBe('X:plate-v1');
    for (const id of ['metal_pipe', 'mechanical_gear', 'metal_blade', 'iron_plate']) expect(item(id).recycle, id).not.toBeNull();
    // P2 not authorised: the twin is still there and still reported, not hidden.
    expect(p.twin_intermediates.some((t) => t.a === 'mechanical_parts' && t.b === 'fasteners')).toBe(true);
    // P6: Plank's only listed consumer cannot exist in a live world.
    expect(UNOBTAINABLE_STRUCTURES).toContain('wall_plank');
    expect(item('plank').signals).toContain('NO_REACHABLE_CONSUMER:wall_plank');
    // Under a merged Parts resource the Recycler would mint research currency from an Iron Axe.
    expect(p.recycle_loops.find((l) => l.item === 'iron_axe')!.merged_parts_verdict).toBe('PARTS_POSITIVE');
  });
});

describe('player-facing class (Group A, display only)', () => {
  it('classifies every `res` item explicitly and nothing stale', () => {
    const res = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'res').sort();
    expect(Object.keys(RES_ITEM_CLASS).sort()).toEqual(res);
    for (const k of Object.keys(ITEMS)) expect(itemClass(k), k).not.toBeNull();
  });

  it('has exactly one PARTS item, it is uncraftable, and no chip says MATERIAL any more', () => {
    const parts = p.items.filter((i) => i.item_class === 'PARTS').map((i) => i.id);
    expect(parts).toEqual(['spares']);
    expect(item('mechanical_parts').item_class).toBe('COMPONENT');
    for (const k of Object.keys(ITEMS)) expect(itemClassLabel(k, 'MATERIAL'), k).not.toBe('MATERIAL');
  });

  it('agrees with the graph: SALVAGE/ORE/NATURAL are never crafted, COMPONENT/METAL always are', () => {
    for (const i of p.items) {
      const liveMade = i.produced_by.filter((r) => { const x = p.recipes.find((y) => y.id === r)!; return x.craftable_shipping || x.craftable_veyra; });
      if (['SALVAGE', 'ORE', 'NATURAL', 'PARTS', 'SPECIMEN'].includes(i.item_class ?? '')) expect(liveMade, i.id).toEqual([]);
      if (['COMPONENT', 'METAL'].includes(i.item_class ?? '')) expect(i.produced_by.length, i.id).toBeGreaterThan(0);
    }
  });

  it('description fixes changed text only', () => {
    expect(ITEMS.fur.name).toBe('Fur');
    for (const k of Object.keys(ITEMS)) {
      expect(ITEMS[k].desc, k).not.toMatch(/SOH_PROVISIONAL|PA1 v\d/);
    }
    expect([...SOH_PROVISIONAL_ITEMS].sort()).toEqual(['animal_feed', 'custodian_lantern', 'feather', 'grouse_egg', 'lead_rope', 'relic_shaleheart', 'ronin_nodachi', 'tidemarshal_trident']);
    for (const k of SOH_PROVISIONAL_ITEMS) expect(ITEMS[k], k).toBeDefined();
    expect(ITEMS.root_broth.desc).toMatch(/Grouse Eggs/);
  });
});

describe('decisions', () => {
  it('has an explicit decision for every hand-written item and none for ids that no longer exist', () => {
    for (const id of Object.keys(ITEMS)) expect(decisionFor(id), id).toBeDefined();
    for (const id of Object.keys(ITEM_DECISIONS)) expect(ITEMS[id], id).toBeDefined();
    const explicit = Object.keys(ITEMS).filter((k) => !k.startsWith('deploy_') && !k.startsWith('stone_'));
    expect(Object.keys(ITEM_DECISIONS).sort()).toEqual(explicit.sort());
  });

  it('after round 2 nothing is left as an unexecuted RENAME/REDESIGN/MERGE/RETIRE; every non-KEEP row points at a proposal', () => {
    const c = data.disposition_counts;
    for (const k of ['DEFER', 'ADD_CANDIDATE']) expect(c[k] ?? 0, k).toBeGreaterThan(0);
    for (const k of ['RENAME', 'REDESIGN', 'MERGE_CANDIDATE', 'RETIRE_CANDIDATE']) expect(c[k] ?? 0, k).toBe(0);
    const ids = new Set(PROPOSALS.map((x) => x.id));
    for (const [id, d] of Object.entries(ITEM_DECISIONS)) {
      if (d.decision === 'KEEP') continue;
      expect(d.proposal && ids.has(d.proposal), id).toBe(true);
      expect(PROPOSALS.find((x) => x.id === d.proposal)!.items, id).toContain(id);
    }
    for (const pr of PROPOSALS) {
      expect(pr.migration.length, pr.id).toBeGreaterThan(0);
      for (const i of pr.items) expect(ITEMS[i], `${pr.id}:${i}`).toBeDefined();
    }
    for (const m of data.manifest.filter((x) => x.decision === 'MERGE_CANDIDATE' || x.decision === 'RETIRE_CANDIDATE')) {
      const pr = PROPOSALS.find((x) => x.id === m.proposal)!;
      expect((pr.before_recipes?.length ?? 0) > 0 && (pr.after_recipes?.length ?? 0) > 0, m.old_id).toBe(true);
    }
  });

  it('proposal recipes are true: implemented ones match the frozen rev-2 ledger before and the live catalog after', () => {
    const live = (id: string) => p.recipes.find((x) => x.id === id);
    for (const pr of PROPOSALS) {
      const done = pr.status === 'IMPLEMENTED' || pr.status === 'IMPLEMENTED_PARTIAL';
      for (const b of pr.before_recipes ?? []) {
        if (done) {
          const frozen = LEGACY_RECIPES[`${b.id}@2`];
          expect(frozen, `${pr.id}:${b.id}@2 frozen`).toBeDefined();
          expect(sorted(b.ins), `${pr.id}:${b.id} ins`).toEqual(sorted(frozen.ins as [string, number][]));
          expect(sorted(b.out), `${pr.id}:${b.id} out`).toEqual([`${frozen.out}:${frozen.qty}`]);
        } else {
          const r = live(b.id);
          expect(r, `${pr.id}:${b.id}`).toBeDefined();
          expect(sorted(b.ins), `${pr.id}:${b.id} ins`).toEqual(sorted(r!.ins));
          expect(sorted(b.out), `${pr.id}:${b.id} out`).toEqual(sorted(r!.outs));
          expect(b.station, `${pr.id}:${b.id} station`).toBe(r!.station_tier);
        }
      }
      // Structure costs quoted anywhere must equal the live catalog: round 2 changed NO structure cost.
      for (const b of pr.before_structs ?? []) expect(sorted(b.cost), `${pr.id}:${b.id}`).toEqual(sorted(STRUCTS[b.id].cost as [string, number][]));
      for (const a of pr.after_recipes ?? []) {
        for (const [k] of [...a.ins, ...a.out]) expect(ITEMS[k], `${pr.id}:${a.id}:${k}`).toBeDefined();
        if (!done) continue;
        if (a.ins.length === 0) { expect(RETIRED_RECIPES as readonly string[], `${pr.id}:${a.id} retired`).toContain(a.id); expect(RECIPES[a.id]).toBeUndefined(); continue; }
        const r = live(a.id)!;
        expect(sorted(a.ins), `${pr.id}:${a.id} live ins`).toEqual(sorted(r.ins));
        expect(sorted(a.out), `${pr.id}:${a.id} live out`).toEqual(sorted(r.outs));
        expect(a.station, `${pr.id}:${a.id} live station`).toBe(r.station_tier);
      }
      for (const a of pr.after_structs ?? []) for (const [k] of a.cost) expect(ITEMS[k], `${pr.id}:${a.id}:${k}`).toBeDefined();
      expect(pr.ruling.length, pr.id).toBeGreaterThan(10);
      if (done) expect(pr.shipped?.length ?? 0, pr.id).toBeGreaterThan(0);
    }
  });

  it('round 2 status: exactly the authorised proposals are live, and nothing else moved', () => {
    const status = Object.fromEntries(PROPOSALS.map((x) => [x.id, x.status]));
    expect(status).toEqual({ P1: 'IMPLEMENTED', P2: 'NOT_AUTHORISED', P3: 'IMPLEMENTED_PARTIAL', P4: 'IMPLEMENTED', P5: 'IMPLEMENTED', P6: 'NOT_AUTHORISED', P7: 'IMPLEMENTED', P8: 'OPEN', P9: 'OPEN', P10: 'OPEN' });
    expect(RECIPE_REVISION).toBe(3);
    // P1 / P7 — display only, ids untouched
    expect(ITEMS.spares.name).toBe('Parts'); expect(ITEMS.spares.vi).toBe('Linh kiện');
    expect(ITEMS.mechanical_parts.name).toBe('Machine Parts'); expect(ITEMS.mechanical_parts.vi).toBe('Bộ phận máy');
    expect(Object.values(ITEMS).filter((d) => d.name === 'Parts').length).toBe(1);
    expect(RECIPES.spares).toBeUndefined();
    for (const d of Object.values(ITEMS)) expect(d.name, d.name).toMatch(/^[\x20-\x7e]+$/);
    for (const [k, d] of Object.entries(ITEMS)) if (d.creatorCore && k !== 'core_mjolnir') expect(d.vi, k).toBeTruthy();
    // P3 — frame only; fluid machines untouched
    expect(RECIPES.vehicle_frame_piped).toBeUndefined();
    expect(sorted(STRUCTS.oil_pump.cost as [string, number][])).toEqual(sorted([['iron_ingot', 3], ['mechanical_parts', 2], ['spares', 2], ['brick', 2]]));
    expect(sorted(STRUCTS.refinery.cost as [string, number][])).toEqual(sorted([['iron_ingot', 4], ['mechanical_parts', 3], ['spares', 5], ['brick', 6], ['glass', 2]]));
    // P5 — new key, old rules byte-for-byte where they were
    const rules = componentRuleSnapshot();
    expect(rules['X:plate-v1']).toEqual({ key: 'iron_plate', seconds: 10, outputs: [['iron_ingot', 1]] });
    expect(rules['X:pipe-v3'].outputs).toEqual([['refined_iron_ingot', 1]]);
    expect(sorted(rules['X:gear-v1'].outputs)).toEqual(['iron_ingot:1', 'mechanical_parts:2']);
    expect(sorted(rules['X:blade-v1'].outputs)).toEqual(['iron_ingot:2', 'mechanical_parts:1']);
    // P2 / P6 — not authorised, so nothing about them changed
    expect(sorted(RECIPES.fasteners.ins)).toEqual(['iron_ingot:1', 'scrap:1']); expect(RECIPES.fasteners.qty).toBe(3);
    expect(sorted(RECIPES.plank.ins)).toEqual(['wood:2']);
    expect(sorted(STRUCTS.wall_plank.cost as [string, number][])).toEqual(['plank:3']);
    expect(decisionFor('fasteners')!.decision).toBe('KEEP');
    expect(decisionFor('plank')!.decision).toBe('DEFER');
    expect(data.manifest.filter((m) => ['RENAME', 'REDESIGN', 'MERGE_CANDIDATE', 'RETIRE_CANDIDATE'].includes(m.decision)).map((m) => m.old_id)).toEqual([]);
    expect(PARTS_RECOMMENDATION.choose).toBe('A');
    for (const id of PARTS_SCOPE) expect(ITEMS[id], id).toBeDefined();
  });

  it('round 2 findings are computed from the live game and say what they measured', () => {
    // P2: every consumer listed, and the merge is shown to cost more — not asserted to be neutral.
    const f = findings.P2;
    expect(f.rows.length).toBeGreaterThanOrEqual(14);
    for (const id of ['vehicle_drive', 'motorbike_kit', 'iron_plate', 'mechanical_gear']) expect(f.rows.some((x) => x.consumer === id), id).toBe(true);
    expect(f.rows.find((x) => x.consumer === 'door_powered')!.live).toBe(false);
    expect(f.totals.m1_scrap).toBeGreaterThan(f.totals.before_scrap);
    expect(f.totals.m1_worst_scrap_ratio).toBe(3);
    // P6: the 240 HP wall is not obtainable today.
    expect(findings.P6.tiers.find((t) => t.id === 'wall_plank')).toMatchObject({ hp: 240, buildable_directly: false, upgrade_from: [], obtainable: false });
    expect(findings.P6.tiers.find((t) => t.id === 'wall_stone')!.obtainable).toBe(true);
    // P8: the matrix covers the eight named items and agrees with the blocked-recipe list.
    expect(findings.P8.rows.map((x) => x.id)).toEqual(['chitin', 'crawler_optic', 'wolf_fang', 'beetle_horn', 'boar_tusk', 'keycard', 'core_demon', 'essence_spirit']);
    for (const x of findings.P8.rows) expect(x.gap === 'NO_VEYRA_SOURCE', x.id).toBe(['SHIPPING_ONLY', 'FIXTURE_ONLY', 'UNREACHABLE'].includes(x.reachability));
    expect(findings.P8.rows.find((x) => x.id === 'core_demon')!.gap).toBe('NO_VEYRA_SOURCE');
    // P9
    expect(findings.P9.reachability).toBe('FIXTURE_ONLY');
    // P10: four legacy + seven creator, different save fields
    expect(findings.P10.legacy.length).toBe(4); expect(findings.P10.creator.length).toBe(7);
    expect(findings.P10.creator_loot_markers.length).toBe(3);
    // LI: 86 ids; the only way this corpus yields 137 is ids + recipe entries.
    expect(findings.LI.counts.unique_item_ids).toBe(86);
    expect(findings.LI.counts.recipe_entries).toBe(51);
    expect(findings.LI.counts.ids_plus_recipe_entries).toBe(137);
  });

  it('no proposed recipe makes the research currency craftable', () => {
    for (const pr of PROPOSALS) for (const a of pr.after_recipes ?? []) expect(a.out.some(([k]) => k === 'spares'), `${pr.id}:${a.id}`).toBe(false);
  });

  it('crosswalks every Last Island item id in the atlas, one row each', () => {
    expect(data.li_crosswalk.length).toBe(86);
    expect(data.li_crosswalk.filter((r) => r.verdict === 'UNCLASSIFIED').map((r) => r.li_id)).toEqual([]);
    const ids = new Set(data.li_crosswalk.map((r) => r.li_id));
    for (const k of Object.keys(LI_CROSSWALK)) expect(ids.has(k), k).toBe(true);
    for (const r of data.li_crosswalk) {
      if (r.verdict === 'NOT_ADDED' || r.verdict === 'BACKLOG') continue;
      const soh = r.soh_equivalent;
      if (soh.startsWith('structure:')) expect(STRUCTS[soh.slice(10)], r.li_id).toBeDefined();
      else expect(ITEMS[soh], `${r.li_id} -> ${soh}`).toBeDefined();
    }
    // backlog stays backlog: no energy-circuit item exists in production
    for (const k of Object.keys(ITEMS)) expect(k).not.toMatch(/energy_ore|energy_circuit|energy_refinery|energy_extractor/);
  });
});

describe('generated artifacts come from one data object and have not drifted', () => {
  const files = (): Record<string, string> => ({
    'ontology.json': JSON.stringify(data, null, 1) + '\n',
    'manifest.csv': manifestCsv(data),
    'li-crosswalk.csv': liCrosswalkCsv(data),
    'APPENDIX.md': appendixMd(data),
    'index.html': explorerHtml(data),
    'ROUND2_FINDINGS.md': round2FindingsMd(findings),
    'round2-findings.json': JSON.stringify(findings, null, 1) + '\n',
  });

  it('manifest has the required columns in the required order, one row per item', () => {
    expect(MANIFEST_COLUMNS.slice(0, 14)).toEqual(['old_id', 'proposed_id', 'display_name', 'level', 'domain', 'source', 'consumer', 'action', 'role', 'LI_reference', 'decision', 'justification', 'migration_required', 'authority_status']);
    expect(data.manifest.filter((m) => m.old_id !== '-').map((m) => m.old_id).sort()).toEqual(Object.keys(ITEMS).sort());
    for (const m of data.manifest) for (const c of MANIFEST_COLUMNS.slice(0, 14)) expect(String(m[c]).length, `${m.old_id}.${c}`).toBeGreaterThan(0);
    expect(data.manifest.filter((m) => m.domain === 'UNASSIGNED')).toEqual([]);
  });

  it('the HTML embeds exactly the data the CSV and appendix were built from', () => {
    const html = explorerHtml(data);
    const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)!;
    expect(JSON.parse(m[1])).toEqual(JSON.parse(JSON.stringify(data)));
    const md = appendixMd(data);
    expect(md).toContain(`| Runtime item ids | ${Object.keys(ITEMS).length} |`);
    expect(md).toContain(`| Recipes | ${Object.keys(RECIPES).length} |`);
    expect(manifestCsv(data).trim().split('\n').length).toBeGreaterThan(Object.keys(ITEMS).length);
  });

  it('committed files equal a fresh generation', () => {
    const f = files();
    if (WRITE) {
      mkdirSync(OUT, { recursive: true });
      for (const [name, body] of Object.entries(f)) writeFileSync(resolve(OUT, name), body, 'utf8');
    }
    for (const [name, body] of Object.entries(f)) {
      const path = resolve(OUT, name);
      expect(existsSync(path), `${name} missing: run with SOH_WRITE_ONTOLOGY=1`).toBe(true);
      expect(readFileSync(path, 'utf8') === body, `${name} drifted from the live game: regenerate with SOH_WRITE_ONTOLOGY=1`).toBe(true);
    }
  });
});
