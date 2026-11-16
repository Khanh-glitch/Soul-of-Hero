/**
 * G1B — CREATOR-APPROVED chest system + Creator Core V2 (pure data and arithmetic; no run state here).
 *
 * Every number comes from `evidence/g1b/approved/g1b-approved-runtime-contract-v1.json` (the 16 pools, 219 positive
 * chest-item rows, Core outcome percentages, 130 source slots) or from section F of the approved design (upgrade
 * bills, cooldowns, wear, repair). Nothing is tuned here. Source tiles live in `g1b-sources.generated.ts`.
 *
 * Separation: this is NOT the G1A salvage layer, the authored Shipping caches (`loot-ecology.ts`), player storage,
 * Airdrop / Harpoon, Ragnarok cash or NPC stock. Field Cores and Essences never appear in a chest.
 */
import contract from '../../evidence/g1b/approved/g1b-approved-runtime-contract-v1.json';
import { G1B_BASE_SOURCE_SITES, G1B_GATES, G1B_FIXTURES, type G1bSourceSite, type G1bGate, type G1bFixture } from './g1b-sources.generated';
import { G1B_ECOLOGY_SOURCES, G1B_LAYOUT_REVISION } from './g1b-ecology.generated';
/** Every chest source of the run: the 130 round-1 ids (unchanged ids and tiles) followed by the room / floor / road ecology. */
const G1B_SOURCE_SITES: readonly G1bSourceSite[] = Object.freeze([...G1B_BASE_SOURCE_SITES, ...G1B_ECOLOGY_SOURCES]);

export const G1B_VERSION = 'g1b-v1' as const;
/** Loot-table revision stored with every roll. Bump only with a new approved contract. */
export const G1B_LOOT_REVISION = 'g1b-approved-v1';
export const G1B_CHEST_SLOTS = 12;

export type G1bFamily = 'supply' | 'toolbox' | 'military' | 'food' | 'medical';
export type G1bGrade = 'damaged' | 'low' | 'mid' | 'high';
export interface G1bPoolRow { item: string; weight: number; qty: [number, number] }
export interface G1bChestDef {
  id: string; family: G1bFamily; grade: G1bGrade; anchor: G1bPoolRow[]; regular: G1bPoolRow[]; regular_draws: number;
  bonus: G1bPoolRow[]; bonus_probability_pct: number; core_outcome_percent: Record<string, number>; refresh_hours: number;
}
export const G1B_CHESTS: Readonly<Record<string, G1bChestDef>> = Object.freeze(Object.fromEntries(((contract as any).chests as G1bChestDef[]).map(c => [c.id, c])));
export const G1B_CORE_TIERS: Readonly<Record<'C' | 'M' | 'R', readonly string[]>> = (contract as any).coreTiers;
/** Site theme: that Core gets weight 2 inside its own tier, then the tier is renormalised. The tier total never changes. */
export const G1B_CORE_THEME: Readonly<Record<string, string>> = Object.freeze({ po_academy: 'core_meteor', po_observatory: 'core_meteor', po_wreck: 'core_elsa', po_falls: 'core_mjolnir', po_slag: 'core_dragon', po_archive: 'core_demon' });

export const G1B_FAMILY_COLUMN: Readonly<Record<G1bFamily, number>> = { supply: 0, toolbox: 1, military: 2, food: 3, medical: 4 };
/** Approved §H presentation: scale and sheen period per grade (seconds). Scale never changes collision. */
export const G1B_GRADE_VISUAL: Readonly<Record<G1bGrade, { scale: number; sheen: [number, number] | null }>> = {
  damaged: { scale: 0.8, sheen: null }, low: { scale: 0.9, sheen: [20, 28] }, mid: { scale: 1.0, sheen: [12, 18] }, high: { scale: 1.14, sheen: [8, 15] },
};
export const G1B_FAMILY_NAME: Readonly<Record<G1bFamily, string>> = { supply: 'Supply Crate', toolbox: 'Toolbox', military: 'Military Case', food: 'Food Box', medical: 'Medical Case' };
export const G1B_GRADE_NAME: Readonly<Record<G1bGrade, string>> = { damaged: 'Damaged', low: 'Low', mid: 'Mid', high: 'High' };
export const g1bChestName = (variant: string) => { const c = G1B_CHESTS[variant]; return c ? `${G1B_GRADE_NAME[c.grade]} ${G1B_FAMILY_NAME[c.family]}` : 'Crate'; };

export const G1B_SITES: Readonly<Record<string, G1bSourceSite>> = Object.freeze(Object.fromEntries(G1B_SOURCE_SITES.map(s => [s.id, s])));
export const G1B_FIXTURE_BY_ID: Readonly<Record<string, G1bFixture>> = Object.freeze(Object.fromEntries(G1B_FIXTURES.map(f => [f.id, f])));
export const G1B_GATE_BY_ID: Readonly<Record<string, G1bGate>> = Object.freeze(Object.fromEntries(G1B_GATES.map(g => [g.id, g])));
export const g1bGateAtDoor = (gx: number, gy: number): G1bGate | undefined => G1B_GATES.find(g => g.door[0] === gx && g.door[1] === gy);
export { G1B_SOURCE_SITES, G1B_BASE_SOURCE_SITES, G1B_ECOLOGY_SOURCES, G1B_LAYOUT_REVISION, G1B_GATES, G1B_FIXTURES };
export type { G1bSourceSite, G1bGate, G1bFixture };

/** Refresh hours of one physical source (contract `refresh_hours_base` of that slot). */
const SLOT_HOURS: Record<string, number> = Object.fromEntries(((contract as any).sourceSlots as any[]).map(s => [s.source_id, Number(s.refresh_hours_base)]));
export const g1bRefreshHours = (sid: string): number => SLOT_HOURS[sid] ?? G1B_CHESTS[G1B_SITES[sid]?.variant]?.refresh_hours ?? 24;

// ---------- seeded arithmetic ----------
export function g1bHash(text: string): number { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }
export function g1bRng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const g1bSeed = (runId: string, sid: string, cycle: number) => g1bHash(`${runId}|${sid}|${cycle}|${G1B_LOOT_REVISION}`);

export interface G1bCoreOutcome { core: string; level: 1 | 2 | 3; pct: number }
/** The mutually exclusive Core outcomes of one chest at one site, as ABSOLUTE percentages (their sum is the chest's Core chance). */
export function g1bCoreOutcomes(site: string, variant: string): G1bCoreOutcome[] {
  const def = G1B_CHESTS[variant]; if (!def) return []; const theme = G1B_CORE_THEME[site]; const out: G1bCoreOutcome[] = [];
  for (const [code, pct] of Object.entries(def.core_outcome_percent)) {
    const tier = code[0] as 'C' | 'M' | 'R', level = Number(code.slice(2)) as 1 | 2 | 3; const ids = G1B_CORE_TIERS[tier]; if (!ids || !(pct > 0)) continue;
    const w = ids.map(id => (id === theme ? 2 : 1)); const total = w.reduce((a, b) => a + b, 0);
    ids.forEach((id, i) => out.push({ core: id, level, pct: pct * w[i] / total }));
  }
  return out;
}

const pick = (rows: G1bPoolRow[], u: number): G1bPoolRow => { const total = rows.reduce((a, r) => a + r.weight, 0); let x = u * total; for (const r of rows) { x -= r.weight; if (x < 0) return r; } return rows[rows.length - 1]; };
const qtyOf = (row: G1bPoolRow, u: number) => row.qty[0] + Math.floor(u * (row.qty[1] - row.qty[0] + 1));

export interface G1bRolledStack { key: string; qty: number; level?: 1 | 2 | 3; from: 'anchor' | 'regular' | 'bonus' | 'core' }
/**
 * One complete roll: 1 anchor + N regular (WITH replacement) + bonus (p%) + exactly one exclusive Core outcome (or none).
 * Duplicate ids merge up to the item's stack cap; the overflow starts a new stack and is never truncated.
 * Pure: same (runId, sourceId, cycle) always gives the same stacks.
 */
export function g1bRoll(runId: string, sid: string, cycle: number, stackMax: (key: string) => number): { seed: number; stacks: G1bRolledStack[] } {
  const site = G1B_SITES[sid]; const def = site && G1B_CHESTS[site.variant]; const seed = g1bSeed(runId, sid, cycle);
  if (!site || !def) return { seed, stacks: [] };
  const rnd = g1bRng(seed); const stacks: G1bRolledStack[] = [];
  const add = (key: string, qty: number, from: G1bRolledStack['from']) => {
    const max = Math.max(1, stackMax(key));
    for (const s of stacks) { if (qty <= 0) break; if (s.key !== key || s.level !== undefined || s.qty >= max) continue; const n = Math.min(qty, max - s.qty); s.qty += n; qty -= n; }
    while (qty > 0) { const n = Math.min(qty, max); stacks.push({ key, qty: n, from }); qty -= n; }
  };
  const a = pick(def.anchor, rnd()); add(a.item, qtyOf(a, rnd()), 'anchor');
  for (let i = 0; i < def.regular_draws; i++) { const r = pick(def.regular, rnd()); add(r.item, qtyOf(r, rnd()), 'regular'); }
  const bu = rnd(), bp = rnd(), bq = rnd();
  if (def.bonus.length && bu * 100 < def.bonus_probability_pct) { const b = pick(def.bonus, bp); add(b.item, qtyOf(b, bq), 'bonus'); }
  let x = rnd() * 100;
  for (const o of g1bCoreOutcomes(site.site, site.variant)) { x -= o.pct; if (x < 0) { stacks.push({ key: o.core, qty: 1, level: o.level, from: 'core' }); break; } }
  return { seed, stacks };
}

/** Every (chest, item) pair that can appear from the anchor / regular / bonus pools — must equal the 219 approved rows. */
export function g1bPositivePairs(): string[] {
  const out = new Set<string>();
  for (const c of Object.values(G1B_CHESTS)) {
    for (const r of [...c.anchor, ...c.regular, ...c.bonus]) if (r.weight > 0) out.add(`${c.id}|${r.item}`);
    for (const [code, pct] of Object.entries(c.core_outcome_percent)) if (pct > 0) for (const id of G1B_CORE_TIERS[code[0] as 'C' | 'M' | 'R']) out.add(`${c.id}|${id}`);
  }
  return [...out].sort();
}

// ======================================================================================================
// Creator Core V2 (approved §F). No reload, no internal magazine: a cast takes its ammunition from the pack.
// ======================================================================================================
export type CoreMode = 'basic' | 'refined' | 'signature';
export const CORE_V2 = Object.freeze({
  maxDur: 300,
  repairPoints: 75,
  /** Level needed for each skill: Lv1 LMB, Lv2 +Q, Lv3 +E. */
  modeLevel: { basic: 1, refined: 2, signature: 3 } as Record<CoreMode, 1 | 2 | 3>,
  upgrade: { 2: { benchLevel: 2, ms: 45_000 }, 3: { benchLevel: 3, ms: 75_000 } } as Record<2 | 3, { benchLevel: number; ms: number }>,
});
export interface CoreSpec { tier: 'C' | 'M' | 'R'; cooldownMs: Record<CoreMode, number>; wear: Record<CoreMode, number>; bills: Record<2 | 3, [string, number][]> }
const spec = (tier: 'C' | 'M' | 'R', cd: [number, number, number], wear: [number, number, number], l2: [string, number][], l3: [string, number][]): CoreSpec =>
  ({ tier, cooldownMs: { basic: cd[0] * 1000, refined: cd[1] * 1000, signature: cd[2] * 1000 }, wear: { basic: wear[0], refined: wear[1], signature: wear[2] }, bills: { 2: l2, 3: l3 } });
export const CORE_SPECS: Readonly<Record<string, CoreSpec>> = Object.freeze({
  core_blast: spec('C', [0.7, 10, 50], [1, 4, 12], [['spares', 5], ['iron_ingot', 3], ['crystal', 2], ['sulfur', 2]], [['spares', 10], ['refined_iron_ingot', 3], ['crystal', 4], ['sulfur', 4]]),
  core_earthmother: spec('C', [0.9, 18, 55], [1, 5, 12], [['spares', 5], ['iron_ingot', 3], ['crystal', 2], ['herb', 3], ['seed_bitterleaf', 2]], [['spares', 10], ['refined_iron_ingot', 3], ['crystal', 4], ['herb', 5], ['seed_bitterleaf', 4]]),
  core_meteor: spec('M', [0.9, 14, 60], [1, 5, 14], [['spares', 7], ['iron_ingot', 4], ['crystal', 3], ['sulfur', 3]], [['spares', 12], ['refined_iron_ingot', 4], ['crystal', 5], ['sulfur', 5], ['mechanical_gear', 1]]),
  core_elsa: spec('M', [0.8, 22, 70], [1, 5, 12], [['spares', 7], ['iron_ingot', 3], ['crystal', 3], ['shell', 3]], [['spares', 12], ['refined_iron_ingot', 3], ['crystal', 5], ['shell', 5], ['glass', 2]]),
  core_mjolnir: spec('M', [0.8, 15, 65], [1, 5, 13], [['spares', 7], ['iron_ingot', 4], ['crystal', 3], ['electronic_parts', 2]], [['spares', 13], ['refined_iron_ingot', 4], ['crystal', 5], ['electronic_parts', 4], ['mechanical_gear', 2]]),
  core_dragon: spec('R', [1.1, 12, 75], [1, 6, 16], [['spares', 11], ['refined_iron_ingot', 3], ['crystal', 4], ['sulfur', 5]], [['spares', 17], ['refined_iron_ingot', 6], ['crystal', 7], ['sulfur', 8], ['mechanical_gear', 2]]),
  core_demon: spec('R', [1.0, 12, 80], [1, 5, 16], [['spares', 9], ['iron_ingot', 4], ['crystal', 4], ['crawler_optic', 2]], [['spares', 16], ['refined_iron_ingot', 5], ['crystal', 6], ['crawler_optic', 3], ['glass', 2]]),
});
export const CORE_REPAIR_BILL: Readonly<Record<'C' | 'M' | 'R', [string, number][]>> = Object.freeze({
  C: [['spares', 1], ['iron_ingot', 1]], M: [['spares', 2], ['iron_ingot', 1]], R: [['spares', 2], ['refined_iron_ingot', 1]],
});
/** Ammunition one accepted cast removes from the pack. `essence` is the Core's own element. */
export function coreAmmo(mode: CoreMode, essence: string | undefined): [string, number][] {
  if (mode === 'basic') return [['energy_basic', 1]];
  if (mode === 'refined') return [['energy_refined', 1]];
  return [['energy_refined', 1], [`essence_${essence}`, 1]];
}
export interface CoreStackV2 { key: string; dur?: number; lvl?: 1 | 2 | 3; cd?: Partial<Record<CoreMode, number>>; upg?: { to: 2 | 3; readyAt: number }; reserves?: { basic: number; refined: number; signature: number } }
/** A Core minted before V2 had all three skills: it stays Lv3 so nothing a player owned is lost. */
export const coreLevel = (s: CoreStackV2): 1 | 2 | 3 => s.lvl ?? 3;
export const coreDur = (s: CoreStackV2): number => s.dur ?? CORE_V2.maxDur;

/** What the HUD needs to say about a Core without touching it: effective level (a finished upgrade counts), wear, timers. */
export function coreReadout(s: CoreStackV2, now: number) {
  const done = !!s.upg && now >= s.upg.readyAt; const lvl = done ? s.upg!.to : coreLevel(s); const sp = CORE_SPECS[s.key];
  return { lvl, dur: coreDur(s), maxDur: CORE_V2.maxDur, upgradingTo: s.upg && !done ? s.upg.to : null, upgradeLeftMs: s.upg && !done ? s.upg.readyAt - now : 0,
    modes: (['basic', 'refined', 'signature'] as CoreMode[]).map(mode => ({ mode, key: mode === 'basic' ? 'LMB' : mode === 'refined' ? 'Q' : 'E', unlocked: lvl >= CORE_V2.modeLevel[mode], needLvl: CORE_V2.modeLevel[mode], cdLeftMs: Math.max(0, (s.cd?.[mode] ?? 0) - now), wear: sp?.wear[mode] ?? 0 })) };
}
