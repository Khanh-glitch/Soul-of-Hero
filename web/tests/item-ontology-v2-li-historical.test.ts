/**
 * Last Island historical crosswalk: 137 historical ids vs the 86-id atlas. Reference-only inputs, pinned by hash.
 * Regenerate: SOH_WRITE_ONTOLOGY=1 npx vitest run tests/item-ontology-v2-li-historical.test.ts
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ITEMS, STRUCTS, RECIPES, MODULE_PENDING_STRUCTURES } from '../src/game/catalog';
import { UNOBTAINABLE_STRUCTURES } from '../src/game/item-ontology';
import { LI_CROSSWALK } from '../src/game/item-ontology-decisions';
import { buildLiCrosswalk, type LiAtlas } from '../src/game/item-ontology-report';
import {
  ATLAS_ONLY, HISTORICAL_ONLY, LI_HISTORICAL_INPUTS, LIVE_LIMITS, NOTICE_EVIDENCE, OFFICIAL_NOTICE_2022, SHARED_DISAGREEMENTS, buildLiHistorical, liHistoricalCsv,
  liHistoricalMd, parseCsv, parseHistorical,
} from '../src/game/item-ontology-li-historical';

const WEB = resolve(__dirname, '..');
const OUT = resolve(WEB, 'ref/item-ontology-v2');
const DIR = resolve(WEB, LI_HISTORICAL_INPUTS.dir);
const WRITE = process.env.SOH_WRITE_ONTOLOGY === '1';
const csvBytes = readFileSync(resolve(DIR, LI_HISTORICAL_INPUTS.csv.name));
const diffBytes = readFileSync(resolve(DIR, LI_HISTORICAL_INPUTS.diff.name));
const atlasText = readFileSync(resolve(WEB, 'ref/atlas/extracted/ATLAS_v2.json'), 'utf8');
const atlas = JSON.parse(atlasText) as LiAtlas;
// reachability comes from the projection's own generated manifest (drift-checked in item-ontology-v2.test.ts)
const manifest = parseCsv(readFileSync(resolve(OUT, 'manifest.csv'), 'utf8'));
const reachability = Object.fromEntries(manifest.slice(1).map((r) => [r[manifest[0].indexOf('old_id')], r[manifest[0].indexOf('runtime_reachability')]]));
const live = { reachability, pendingStructures: MODULE_PENDING_STRUCTURES as readonly string[], unobtainableStructures: UNOBTAINABLE_STRUCTURES };
const atlasRows = buildLiCrosswalk(atlas);
const src = parseHistorical(csvBytes.toString('utf8'));
const rows = buildLiHistorical(csvBytes.toString('utf8'), atlasRows.map((r) => r.li_id), atlas, atlasText, live);
const row = (id: string) => rows.find((r) => r.li_id === id)!;
const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const SUPPORT_COUNTS = { DIRECT: 76, INDIRECT: 23, LEGACY_CLAIM: 23, UNSUPPORTED_CITATION: 15 };

describe('Last Island historical inputs are the delivered bytes', () => {
  it('CSV and diff match the size and SHA-256 Control Tower published', () => {
    expect(csvBytes.length).toBe(LI_HISTORICAL_INPUTS.csv.bytes);
    expect(sha(csvBytes)).toBe('e4a1b066429d7afc8b9e91dc024ceed317058738e45163f02662d6315a4570c5');
    expect(diffBytes.length).toBe(LI_HISTORICAL_INPUTS.diff.bytes);
    expect(sha(diffBytes)).toBe('67b8fb988ddda6039fee6d21f048f527dc6931eebc54cbc80271aca572430d04');
    expect(diffBytes.toString('utf8')).toContain(`CSV SHA256: ${LI_HISTORICAL_INPUTS.csv.sha256}`);
  });

  it('137 distinct historical ids, graded 84 / 45 / 8', () => {
    expect(src.length).toBe(137);
    expect(new Set(src.map((r) => r.id)).size).toBe(137);
    expect(count(src, (r) => r.source_evidence)).toEqual({ ATLAS_INDEXED: 84, EXTERNAL_CRAFT_OR_INPUT: 45, OFFICIAL_MODERN: 8 });
    expect(count(src, (r) => r.match_soh)).toEqual({ missing: 88, analogy: 34, direct: 15 });
  });
});

describe('137-vs-86 crosswalk', () => {
  const hist = rows.filter((r) => r.in_historical_137 === 'yes');
  const only = hist.filter((r) => r.in_atlas_86 === 'no');

  it('84 shared, 53 historical-only, 2 atlas-only: 139 rows, one per id', () => {
    expect(atlasRows.length).toBe(86);
    expect(rows.length).toBe(139);
    expect(new Set(rows.map((r) => r.li_id)).size).toBe(139);
    expect(hist.length).toBe(137);
    expect(hist.filter((r) => r.in_atlas_86 === 'yes').length).toBe(84);
    expect(only.length).toBe(53);
    expect(rows.filter((r) => r.in_historical_137 === 'no').map((r) => r.li_id)).toEqual(['raw_iron_ore', 'refined_iron_ore']);
    expect(Object.keys(ATLAS_ONLY).sort()).toEqual(['raw_iron_ore', 'refined_iron_ore']);
  });

  it('the grade says where an id sits: every shared id is ATLAS_INDEXED, every historical-only id is not', () => {
    for (const r of hist) expect(r.provenance_grade === 'ATLAS_INDEXED', r.li_id).toBe(r.in_atlas_86 === 'yes');
    expect(count(only, (r) => r.provenance_grade)).toEqual({ EXTERNAL_CRAFT_OR_INPUT: 45, OFFICIAL_MODERN: 8 });
    for (const r of only) expect(r.relation === 'MODERN_ADDITION', r.li_id).toBe(r.provenance_grade === 'OFFICIAL_MODERN');
  });

  it('every id has an explicit decision; the decision table is exactly the 53 historical-only ids', () => {
    expect(rows.filter((r) => r.verdict === 'UNDECIDED' || r.role_status === 'UNDECIDED' || r.li_role === 'UNCLASSIFIED' || !r.why).map((r) => r.li_id)).toEqual([]);
    expect(Object.keys(HISTORICAL_ONLY).sort()).toEqual(only.map((r) => r.li_id).sort());
    for (const k of Object.keys(HISTORICAL_ONLY)) expect(LI_CROSSWALK[k], `${k} must not be retyped: it is an atlas id`).toBeUndefined();
  });

  it('shared ids keep the atlas verdict unchanged', () => {
    for (const r of rows.filter((x) => x.in_atlas_86 === 'yes')) {
      expect(r.verdict, r.li_id).toBe(LI_CROSSWALK[r.li_id].verdict);
      expect(r.soh_equivalent, r.li_id).toBe(LI_CROSSWALK[r.li_id].soh);
    }
  });

  it('every SOH equivalent named is a real item or structure; related ids are real ids on one side or the other', () => {
    const known = new Set(rows.map((r) => r.li_id));
    for (const r of rows) {
      if (r.related_id !== '-') expect(known.has(r.related_id), `${r.li_id} related ${r.related_id}`).toBe(true);
      const has = r.verdict === 'HAVE_SAME_ROLE' || r.verdict === 'HAVE_DIFFERENT_SHAPE';
      expect(r.soh_equivalent !== '-', r.li_id).toBe(has);
      if (!has) continue;
      if (r.soh_equivalent.startsWith('structure:')) expect(STRUCTS[r.soh_equivalent.slice(10)], r.li_id).toBeDefined();
      else expect(ITEMS[r.soh_equivalent], `${r.li_id} -> ${r.soh_equivalent}`).toBeDefined();
    }
  });

  it('every disagreement with the historical match_soh column is explained', () => {
    const sharedDis = hist.filter((r) => r.in_atlas_86 === 'yes' && r.agrees_with_historical === 'no').map((r) => r.li_id).sort();
    expect(sharedDis).toEqual(Object.keys(SHARED_DISAGREEMENTS).sort());
    expect(only.filter((r) => r.agrees_with_historical === 'no').map((r) => r.li_id).sort()).toEqual(['nettle_seed', 'old_military_mine']);
  });

  it('unsupported figures stay UNKNOWN: no bench or quantity is invented', () => {
    for (const s of src) {
      const r = rows.find((x) => x.li_id === s.id)!;
      if (s.recipe_bench === 'UNKNOWN') expect(r.historical_recipe, s.id).toContain('bench UNKNOWN');
      if (!s.recipe_bench && !s.recipe_input) expect(r.historical_recipe, s.id).toBe('not recorded');
      if (s.recipe_input === '{}') expect(r.historical_recipe, s.id).toContain('inputs UNKNOWN');
    }
    expect(src.filter((s) => s.recipe_bench === 'UNKNOWN').length).toBe(19);
  });

  it('the two open positions are DESIGN_CANDIDATEs, not approved adds, and are described accurately', () => {
    const c = rows.filter((r) => r.role_status === 'DESIGN_CANDIDATE');
    expect(c.map((r) => r.li_id).sort()).toEqual(['mountain_bicycle_blueprint', 'refined_iron_helmet']);
    for (const r of c) { expect(r.verdict).toBe('NOT_ADDED'); expect(r.soh_equivalent).toBe('-'); expect(r.why).toMatch(/not approved and not added/); }
    expect(rows.some((r) => (r.role_status as string) === 'ROLE_GAP')).toBe(false);
    // Bicycle: the documented cost is exertion (lung air, then HP), not merely "fuel-free"
    expect(row('mountain_bicycle_blueprint').why).toMatch(/air in the rider's lungs/);
    expect(row('mountain_bicycle_blueprint').why).toMatch(/loses HP/);
    expect(NOTICE_EVIDENCE.mountain_bicycle_blueprint.quote).toContain('肺部的空气');
    expect(NOTICE_EVIDENCE.mountain_bicycle_blueprint.quote).toContain('扣除人物血量');
    // Helmet: an extra tier, not missing head protection. SOH has a head slot with exactly one armour piece.
    expect(row('refined_iron_helmet').why).toMatch(/already has head protection/);
    expect(Object.entries(ITEMS).filter(([, d]) => (d as { slot?: string; armor?: number }).slot === 'head' && (d as { armor?: number }).armor).map(([k]) => k)).toEqual(['scrap_helm']);
    expect(new Set(Object.values(ITEMS).map((d) => (d as { slot?: string }).slot).filter(Boolean))).toEqual(new Set(['head', 'body', 'back']));
    for (const k of Object.keys(ITEMS)) expect(k).not.toMatch(/bicycle|iron_helmet/);
  });

  it('no production item, recipe or structure was created from a historical-only id', () => {
    const preexisting = new Set(['charcoal']); // SOH's own Charcoal predates this crosswalk (same word, SOH's own recipe)
    for (const id of Object.keys(HISTORICAL_ONLY)) {
      if (preexisting.has(id)) continue;
      expect(ITEMS[id], id).toBeUndefined(); expect(RECIPES[id], id).toBeUndefined(); expect(STRUCTS[id], id).toBeUndefined();
    }
    expect(RECIPES.charcoal.ins).toEqual([['wood', 2]]);
  });

  it('the historical files and this module are reference-only: nothing in the runtime imports them', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const offenders = walk(resolve(WEB, 'src')).filter((p) => /\.(ts|tsx|js|json)$/.test(p) && !p.endsWith('item-ontology-li-historical.ts'))
      .filter((p) => /(from|import|require)\s*\(?\s*['"][^'"]*(li-historical|LI_137_)[^'"]*['"]/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
    expect(readFileSync(resolve(WEB, 'src/game/item-ontology-li-historical.ts'), 'utf8')).not.toMatch(/from 'node:|require\(/);
  });
});

describe('source support is derived next to the raw file, never written into it', () => {
  const hist = rows.filter((r) => r.in_historical_137 === 'yes');
  const citesAtlas = (id: string) => src.find((s) => s.id === id)!.source.includes('ATLAS_v2.json');

  it('the raw citation column is reproduced verbatim for all 137 rows', () => {
    for (const s of src) expect(row(s.id).source, s.id).toBe(s.source);
  });

  it('every row has exactly one of the four support classes', () => {
    expect(new Set(rows.map((r) => r.source_support_status))).toEqual(new Set(['DIRECT', 'INDIRECT', 'LEGACY_CLAIM', 'UNSUPPORTED_CITATION']));
    expect(count(hist, (r) => r.source_support_status)).toEqual(SUPPORT_COUNTS);
  });

  it('a citation to ATLAS_v2.json is never counted as proof when the id is not in that file', () => {
    const ext = src.filter((s) => s.source_evidence === 'EXTERNAL_CRAFT_OR_INPUT' && citesAtlas(s.id));
    const mod = src.filter((s) => s.source_evidence === 'OFFICIAL_MODERN' && citesAtlas(s.id));
    expect(ext.length).toBe(18); expect(mod.length).toBe(8);
    // no literal id among them; 14 of the 18 and all 8 do not occur even as a substring
    for (const s of [...ext, ...mod]) expect(atlasText.includes(`"${s.id}"`), s.id).toBe(false);
    expect(ext.filter((s) => !atlasText.includes(s.id)).length).toBe(14);
    expect(mod.filter((s) => !atlasText.includes(s.id)).length).toBe(8);
    for (const r of hist) {
      const inFile = atlasText.includes(r.li_id);
      if (citesAtlas(r.li_id) && !inFile) {
        expect(r.citation_check, r.li_id).toBe('CITED_SOURCE_LACKS_ID');
        expect(r.verified_source_url, r.li_id).not.toContain('ATLAS_v2.json');
        expect(r.source_note, r.li_id).toMatch(/does not occur anywhere in that file/);
        // supported only if the official notice documents it
        expect(r.source_support_status === 'UNSUPPORTED_CITATION', r.li_id).toBe(!NOTICE_EVIDENCE[r.li_id]);
      }
      if (r.verified_source_url.includes('ATLAS_v2.json')) expect(inFile, r.li_id).toBe(true);
      if (r.source_support_status === 'DIRECT') expect(r.verified_source_url, r.li_id).not.toBe('-');
      if (r.source_support_status === 'LEGACY_CLAIM' || r.source_support_status === 'UNSUPPORTED_CITATION') expect(r.verified_source_url, r.li_id).toBe('-');
    }
  });

  it('the 2022-11-09 date is given only to ids the official notice documents', () => {
    expect(OFFICIAL_NOTICE_2022.url).toBe('https://hero.yingxiong.com/info/2022/1109/13052.html');
    for (const k of Object.keys(NOTICE_EVIDENCE)) expect(src.some((s) => s.id === k), k).toBe(true);
    for (const r of rows) {
      const n = NOTICE_EVIDENCE[r.li_id];
      expect(r.evidence_date === 'UNKNOWN', r.li_id).toBe(!n);
      expect(r.verified_source_url.includes(OFFICIAL_NOTICE_2022.url), r.li_id).toBe(!!n);
      if (n) { expect(r.evidence_date.startsWith('2022-11-09'), r.li_id).toBe(true); expect(n.quote.length, r.li_id).toBeGreaterThan(3); }
      // being named in passing is never DIRECT on the strength of the notice alone
      if (n?.kind === 'NAMED_ONLY') expect(r.source_support_status, r.li_id).toBe('INDIRECT');
    }
    expect(Object.keys(NOTICE_EVIDENCE).filter((k) => NOTICE_EVIDENCE[k].kind === 'ANNOUNCED_AS_NEW').sort()).toEqual(['mountain_bicycle_blueprint', 'self_revive_defibrillator']);
  });

  it('OFFICIAL_MODERN is an inherited label: only the ids the notice documents are supported', () => {
    const mod = hist.filter((r) => r.provenance_grade === 'OFFICIAL_MODERN');
    expect(mod.filter((r) => r.source_support_status === 'DIRECT').map((r) => r.li_id).sort()).toEqual(['electric_resistor', 'mountain_bicycle_blueprint', 'self_revive_defibrillator']);
    expect(mod.filter((r) => r.source_support_status === 'UNSUPPORTED_CITATION').map((r) => r.li_id).sort()).toEqual(['bizon_smg', 'flamethrower_gas_ammo', 'inferno_chariot', 'inferno_chariot_blueprint', 'suicide_robot']);
    for (const r of mod) expect(r.source_note, r.li_id).toMatch(/inherited/);
    // the resistor's notice evidence is its drop category, nothing more
    expect(NOTICE_EVIDENCE.electric_resistor.kind).toBe('DROP_CATEGORY_ONLY');
  });

  it('unresolved citations are listed by name in the document', () => {
    const md = liHistoricalMd(rows);
    for (const r of hist.filter((x) => x.source_support_status === 'UNSUPPORTED_CITATION')) expect(md, r.li_id).toContain(`\`${r.li_id}\``);
    expect(md).toContain('### Unresolved citations');
    expect(md).not.toMatch(/Genuinely missing|genuine gap/i);
  });
});

describe('catalog-defined is not the same as live', () => {
  it('electric_door maps to a MODULE_PENDING structure and is flagged not live', () => {
    expect(MODULE_PENDING_STRUCTURES).toContain('door_powered');
    const r = row('electric_door');
    expect(r.soh_equivalent).toBe('structure:door_powered');
    expect(r.verdict).toBe('HAVE_SAME_ROLE'); // accepted catalog verdict, unchanged
    expect(r.soh_live_status).toBe('CATALOG_PRESENT_NOT_LIVE');
    expect(r.soh_live_note).toMatch(/MODULE_PENDING/);
  });
  it('crude_oil mapping does not claim a working Oil Pump', () => {
    const r = row('crude_oil');
    expect(r.soh_equivalent).toBe('salvaged_oil');
    expect(r.soh_live_status).toBe('LIVE_WITH_LIMIT');
    expect(r.soh_live_note).toMatch(/does not establish a working Oil Pump/);
    expect(reachability.crude_petroleum).toBe('FIXTURE_ONLY');
    expect(Object.keys(LIVE_LIMITS)).toEqual(['crude_oil']);
  });
  it('every HAVE_* row has a live status computed from the catalog; every other row has none', () => {
    for (const r of rows) {
      const has = r.verdict === 'HAVE_SAME_ROLE' || r.verdict === 'HAVE_DIFFERENT_SHAPE';
      expect(r.soh_live_status !== 'NOT_APPLICABLE', r.li_id).toBe(has);
      const st = r.soh_equivalent.startsWith('structure:') ? r.soh_equivalent.slice(10) : r.soh_equivalent.startsWith('deploy_') ? r.soh_equivalent.slice(7) : null;
      if (has && st && (MODULE_PENDING_STRUCTURES as readonly string[]).includes(st)) expect(r.soh_live_status, r.li_id).toBe('CATALOG_PRESENT_NOT_LIVE');
      if (has && !r.soh_equivalent.startsWith('structure:')) expect(reachability[r.soh_equivalent], r.li_id).toBeDefined();
    }
  });
});

describe('generated historical crosswalk artifacts have not drifted', () => {
  it('li-historical-crosswalk.csv and LI_HISTORICAL_CROSSWALK.md', () => {
    const f: Record<string, string> = { 'li-historical-crosswalk.csv': liHistoricalCsv(rows), 'LI_HISTORICAL_CROSSWALK.md': liHistoricalMd(rows) };
    for (const [name, body] of Object.entries(f)) {
      const path = resolve(OUT, name);
      if (WRITE) writeFileSync(path, body);
      expect(existsSync(path), `${name} missing: run with SOH_WRITE_ONTOLOGY=1`).toBe(true);
      expect(readFileSync(path, 'utf8') === body, `${name} drifted: regenerate with SOH_WRITE_ONTOLOGY=1`).toBe(true);
    }
  });
});
