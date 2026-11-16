/**
 * G1B batch 2 — what the added sources do to the economy. Odds, quantities, Core outcomes and timers are the approved
 * contract, untouched; only WHERE and HOW MANY chests exist changed. This computes exact expectations (no sampling)
 * for the 130-source layout and the current layout and keeps the committed report honest.
 *   G1B_WRITE=1  rewrites evidence/g1b/census/G1B_ECONOMY_BEFORE_AFTER.{json,md}
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ITEMS } from '../src/game/catalog';
import { G1B_CHESTS, G1B_SOURCE_SITES, G1B_BASE_SOURCE_SITES, G1B_ECOLOGY_SOURCES, G1B_GATE_BY_ID, g1bCoreOutcomes, g1bRefreshHours, type G1bSourceSite, type G1bPoolRow } from '../src/game/g1b';

const DIR = resolve(__dirname, '../evidence/g1b/census');
const census = JSON.parse(readFileSync(resolve(DIR, 'G1B_SPACE_CENSUS.json'), 'utf8'));
const spaceById: Record<string, any> = Object.fromEntries(census.spaces.map((s: any) => [s.id, s]));
const spaceOf = (s: G1bSourceSite): any => spaceById[(s as any).space ?? census.baseSpace[s.id]?.space];
const isGear = (k: string) => { const d: any = ITEMS[k]; return !!d && (d.dur !== undefined || d.slot !== undefined || d.dmg !== undefined || d.ranged !== undefined) && !d.creatorCore; };
const eRow = (rows: G1bPoolRow[]) => { const tw = rows.reduce((a, r) => a + r.weight, 0); let items = 0, gear = 0; for (const r of rows) { const q = (r.qty[0] + r.qty[1]) / 2 * r.weight / tw; items += q; if (isGear(r.item)) gear += q; } return { items, gear }; };
/** Exact expectation of one open of one source. */
function perOpen(s: G1bSourceSite) {
  const d = G1B_CHESTS[s.variant]; const a = eRow(d.anchor), r = eRow(d.regular), b = d.bonus.length ? eRow(d.bonus) : { items: 0, gear: 0 }, p = d.bonus_probability_pct / 100;
  const cores = g1bCoreOutcomes(s.site, s.variant); const core = cores.reduce((n, o) => n + o.pct, 0) / 100;
  const byLevel = [1, 2, 3].map(l => cores.filter(o => o.level === l).reduce((n, o) => n + o.pct, 0) / 100);
  return { draws: 1 + d.regular_draws + p, items: a.items + d.regular_draws * r.items + p * b.items, gear: a.gear + d.regular_draws * r.gear + p * b.gear, core, coreL1: byLevel[0], coreL2: byLevel[1], coreL3: byLevel[2], hours: g1bRefreshHours(s.id) };
}
type Agg = { chests: number; items: number; gear: number; cores: number; coreL1: number; coreL2: number; coreL3: number; itemsPerDay: number; gearPerDay: number; coresPerDay: number };
const zero = (): Agg => ({ chests: 0, items: 0, gear: 0, cores: 0, coreL1: 0, coreL2: 0, coreL3: 0, itemsPerDay: 0, gearPerDay: 0, coresPerDay: 0 });
const add = (a: Agg, s: G1bSourceSite) => { const e = perOpen(s); a.chests++; a.items += e.items; a.gear += e.gear; a.cores += e.core; a.coreL1 += e.coreL1; a.coreL2 += e.coreL2; a.coreL3 += e.coreL3; a.itemsPerDay += e.items * 24 / e.hours; a.gearPerDay += e.gear * 24 / e.hours; a.coresPerDay += e.core * 24 / e.hours; };
const round = (a: Agg): Agg => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.round(v * 1000) / 1000])) as Agg;
const gating = (s: G1bSourceSite) => { if (!s.gate) return s.zone === 'ROAD' ? 'open road' : 'open site'; const g = G1B_GATE_BY_ID[s.gate] as any; const need = [g?.card && `${g.card} card`, g?.power && 'power', g?.ppe && 'filter mask'].filter(Boolean).join(' + '); return `gated: ${need || 'gate'}`; };
const risk = (s: G1bSourceSite) => { if (s.zone === 'ROAD') return 'road'; const sp = spaceOf(s); return sp ? `danger ${sp.danger}` : 'danger ?'; };
const storey = (s: G1bSourceSite) => ({ '-1': 'cellar (-1)', '0': 'ground (0)', '1': 'upper (1)', '2': 'roof / top (2)' } as any)[String(s.level ?? 0)];
function table(list: readonly G1bSourceSite[], key: (s: G1bSourceSite) => string) { const m: Record<string, Agg> = {}; for (const s of list) add(m[key(s)] ??= zero(), s); return Object.fromEntries(Object.keys(m).sort().map(k => [k, round(m[k])])); }
function report(list: readonly G1bSourceSite[]) {
  const total = zero(); for (const s of list) add(total, s);
  return { total: round(total), byZone: table(list, s => s.zone), byGating: table(list, gating), byRisk: table(list, risk), byStorey: table(list, storey), byVariant: table(list, s => s.variant), bySite: table(list, s => s.site), bySpace: table(list.filter(s => s.zone !== 'ROAD'), s => spaceOf(s)?.id ?? `${s.site}/?`) };
}
function build() {
  return {
    schema: 'soh.g1b.economy-before-after.v1',
    method: 'Exact expectation from the approved pools: 1 anchor + N regular draws + bonus (p) + exclusive Core outcome. "items" = expected item units of one full open of every chest (the first visit of a new run); "…PerDay" = the ceiling if every chest were emptied the moment it restocks (refresh 12–72 game hours, starts when the chest is emptied). "gear" = units of tools / weapons / wearables. Odds are identical before and after.',
    before: report(G1B_BASE_SOURCE_SITES), after: report(G1B_SOURCE_SITES), added: report(G1B_ECOLOGY_SOURCES),
  };
}
const f1 = (n: number) => n.toFixed(1), f2 = (n: number) => n.toFixed(2);
function md(e: ReturnType<typeof build>) {
  const L: string[] = ['# G1B — economy before / after the room, floor and road ecology', '', '_Generated by `tests/g1b-economy.test.ts` (`G1B_WRITE=1`). Do not edit by hand._', '', e.method, ''];
  const cmp = (title: string, k: 'byZone' | 'byGating' | 'byRisk' | 'byStorey' | 'byVariant') => {
    L.push(`## ${title}`, '', '| | chests before | chests after | items / full open before | after | gear before | after | Cores / full open before | after | Cores / day ceiling before | after |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    const keys = [...new Set([...Object.keys(e.before[k]), ...Object.keys(e.after[k])])].sort(); const z = zero();
    for (const key of keys) { const b = e.before[k][key] ?? z, a = e.after[k][key] ?? z; L.push(`| ${key} | ${b.chests} | ${a.chests} | ${f1(b.items)} | ${f1(a.items)} | ${f1(b.gear)} | ${f1(a.gear)} | ${f2(b.cores)} | ${f2(a.cores)} | ${f2(b.coresPerDay)} | ${f2(a.coresPerDay)} |`); }
    const b = e.before.total, a = e.after.total; L.push(`| **all** | **${b.chests}** | **${a.chests}** | **${f1(b.items)}** | **${f1(a.items)}** | **${f1(b.gear)}** | **${f1(a.gear)}** | **${f2(b.cores)}** | **${f2(a.cores)}** | **${f2(b.coresPerDay)}** | **${f2(a.coresPerDay)}** |`, '');
  };
  const b = e.before.total, a = e.after.total;
  L.push('## Headline', '', `- Chests: **${b.chests} → ${a.chests}** (×${f2(a.chests / b.chests)}).`, `- Item units in one full sweep of the island: **${f1(b.items)} → ${f1(a.items)}** (×${f2(a.items / b.items)}).`, `- Gear units in one full sweep: **${f1(b.gear)} → ${f1(a.gear)}** (×${f2(a.gear / b.gear)}).`,
    `- Creator Cores in one full sweep: **${f2(b.cores)} → ${f2(a.cores)}** (×${f2(a.cores / b.cores)}); by level L1 ${f2(b.coreL1)} → ${f2(a.coreL1)}, L2 ${f2(b.coreL2)} → ${f2(a.coreL2)}, L3 ${f2(b.coreL3)} → ${f2(a.coreL3)}.`,
    `- Restock ceiling per game day: items ${f1(b.itemsPerDay)} → ${f1(a.itemsPerDay)}, Cores ${f2(b.coresPerDay)} → ${f2(a.coresPerDay)}.`, `- Core chance per chest, averaged: ${f1(100 * b.cores / b.chests)}% → ${f1(100 * a.cores / a.chests)}% (added chests alone: ${f1(100 * e.added.total.cores / e.added.total.chests)}%). The total still rises because there are more chests — a consequence for the Creator to judge in play; no odds, cap or pity was changed to mask it.`, `- The added ${e.added.total.chests} chests carry ${f1(e.added.total.items)} item units and ${f2(e.added.total.cores)} Cores per full sweep: ${f1(100 * e.added.total.chests / a.chests)}% of the chests, ${f1(100 * e.added.total.cores / a.cores)}% of the Cores.`, '');
  cmp('By zone', 'byZone'); cmp('By gating', 'byGating'); cmp('By risk of the space (census danger 1–4; roads apart)', 'byRisk'); cmp('By storey', 'byStorey'); cmp('By chest variant', 'byVariant');
  L.push('## By site', '', '| site | chests before | after | items / open before | after | Cores / open before | after |', '|---|---:|---:|---:|---:|---:|---:|');
  const z = zero(); for (const key of [...new Set([...Object.keys(e.before.bySite), ...Object.keys(e.after.bySite)])].sort()) { const p = e.before.bySite[key] ?? z, q = e.after.bySite[key] ?? z; L.push(`| ${key} | ${p.chests} | ${q.chests} | ${f1(p.items)} | ${f1(q.items)} | ${f2(p.cores)} | ${f2(q.cores)} |`); }
  L.push('', 'Per physical space (room / yard / cellar / upper floor / roof): `G1B_ECONOMY_BEFORE_AFTER.json` → `before.bySpace`, `after.bySpace`; the reason each space got its chests is in `G1B_SPACE_CENSUS.json`.', '');
  return L.join('\n');
}

describe('G1B economy before / after', () => {
  it('the committed report equals what the approved pools and the frozen layout produce', () => {
    const e = build(); const json = JSON.stringify(e, null, 1) + '\n', text = md(e);
    if (process.env.G1B_WRITE === '1') { writeFileSync(resolve(DIR, 'G1B_ECONOMY_BEFORE_AFTER.json'), json); writeFileSync(resolve(DIR, 'G1B_ECONOMY_BEFORE_AFTER.md'), text); }
    expect(existsSync(resolve(DIR, 'G1B_ECONOMY_BEFORE_AFTER.json')), 'run once with G1B_WRITE=1').toBe(true);
    expect(readFileSync(resolve(DIR, 'G1B_ECONOMY_BEFORE_AFTER.json'), 'utf8')).toBe(json); expect(readFileSync(resolve(DIR, 'G1B_ECONOMY_BEFORE_AFTER.md'), 'utf8')).toBe(text);
    expect(e.before.total.chests).toBe(130); expect(e.after.total.chests).toBe(G1B_SOURCE_SITES.length);
    for (const s of G1B_ECOLOGY_SOURCES) if (s.zone !== 'ROAD') expect(spaceOf(s), `${s.id} belongs to a censused space`).toBeTruthy();
  });
  it('odds untouched: the added chests are Core-poor per chest, no easy space got a Military case, road caches stay Damaged / Low', () => {
    const e = build();
    // more chests DO mean more Cores in total (reported, not hidden); per chest the added sources are less than half as Core-rich as the 130
    const perChest = (a: { cores: number; chests: number }) => a.cores / a.chests;
    expect(e.after.total.cores).toBeGreaterThan(e.before.total.cores); expect(perChest(e.added.total)).toBeLessThan(perChest(e.before.total) * 0.5);
    expect(e.after.total.coreL2 + e.after.total.coreL3, 'upgraded Cores stay rare: under 2 per full sweep of the island').toBeLessThan(2);
    const easyMilitary: Record<string, number> = {};
    for (const s of G1B_ECOLOGY_SOURCES) if (G1B_CHESTS[s.variant].family === 'military') { const sp = spaceOf(s); expect(sp.danger, `${s.id}: Military only in a danger-3+ site`).toBeGreaterThanOrEqual(3); if (sp.danger + sp.access < 4) easyMilitary[sp.id] = (easyMilitary[sp.id] ?? 0) + 1; }
    for (const [id, n] of Object.entries(easyMilitary)) expect(n, `${id}: an ungated ground room holds one Military Case at most`).toBe(1);
    for (const s of G1B_ECOLOGY_SOURCES) if (s.zone === 'ROAD') expect(['damaged', 'low']).toContain(G1B_CHESTS[s.variant].grade);
  });
});
