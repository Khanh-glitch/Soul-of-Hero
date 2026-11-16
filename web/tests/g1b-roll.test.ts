/**
 * G1B — approved loot contract vs. the runtime roll (pure; no world).
 * Every number is read from evidence/g1b/approved/g1b-approved-runtime-contract-v1.json; nothing is retyped here.
 */
import { describe, expect, it } from 'vitest';
import contract from '../evidence/g1b/approved/g1b-approved-runtime-contract-v1.json';
import { ITEMS } from '../src/game/catalog';
import { liveItemId } from '../src/game/final-item-set';
import { G1B_CHESTS, G1B_CORE_TIERS, G1B_SOURCE_SITES, G1B_BASE_SOURCE_SITES, G1B_SITES, G1B_CHEST_SLOTS, g1bCoreOutcomes, g1bPositivePairs, g1bRefreshHours, g1bRoll, g1bSeed, type G1bPoolRow } from '../src/game/g1b';
import { ITEM_DESIGN } from '../src/game/item-crafting-design';

const C = contract as any;
const max = (k: string) => ITEMS[k]?.max ?? 1;
const share = (rows: G1bPoolRow[], item: string) => { const t = rows.reduce((a, r) => a + r.weight, 0); return rows.filter(r => r.item === item).reduce((a, r) => a + r.weight, 0) / (t || 1); };
const meanQty = (rows: G1bPoolRow[], item: string) => { const r = rows.find(v => v.item === item); return r ? (r.qty[0] + r.qty[1]) / 2 : 0; };
const CORES = new Set(Object.values(G1B_CORE_TIERS).flat());

describe('G1B approved contract', () => {
  it('has exactly the 16 approved chest variants; the 130 approved source ids are all present, unchanged', () => {
    expect(Object.keys(G1B_CHESTS)).toHaveLength(16); expect(C.chests).toHaveLength(16);
    // the 130 approved slots are the BASE of the layout (kept id for id); batch 2 adds room / floor / road sources on top
    expect(G1B_BASE_SOURCE_SITES).toHaveLength(130); expect(new Set(G1B_BASE_SOURCE_SITES.map(s => s.id)).size).toBe(130);
    expect(new Set(G1B_BASE_SOURCE_SITES.map(s => s.id))).toEqual(new Set(C.sourceSlots.map((s: any) => s.source_id)));
    expect(G1B_SOURCE_SITES.length).toBeGreaterThan(130); expect(new Set(G1B_SOURCE_SITES.map(s => s.id)).size).toBe(G1B_SOURCE_SITES.length);
    for (const s of G1B_SOURCE_SITES) { expect(G1B_CHESTS[s.variant], s.id).toBeTruthy(); expect(g1bRefreshHours(s.id), s.id).toBe(G1B_CHESTS[s.variant].refresh_hours); }
    for (const s of C.sourceSlots) { expect(G1B_SITES[s.source_id].variant, s.source_id).toBe(s.variant); expect(g1bRefreshHours(s.source_id), s.source_id).toBe(Number(s.refresh_hours_base)); }
    const zones: Record<string, number> = {}; for (const s of G1B_BASE_SOURCE_SITES) zones[s.zone] = (zones[s.zone] || 0) + 1;
    expect(zones).toEqual({ POI: 85, ROAD: 26, CARD_ROOM: 19 });
  });

  it('every item a chest can issue is a live catalog item; no Field Core, no Essence, nothing retired', () => {
    for (const c of Object.values(G1B_CHESTS)) for (const r of [...c.anchor, ...c.regular, ...c.bonus]) {
      expect(ITEMS[r.item], `${c.id} → ${r.item}`).toBeTruthy(); expect(liveItemId(r.item), r.item).toBe(r.item);
      expect(ITEMS[r.item].core, r.item).toBeFalsy(); expect(r.item.startsWith('essence_'), r.item).toBe(false); expect(ITEMS[r.item].creatorCore, `${r.item} must come only from the Core outcome`).toBeFalsy();
      expect(r.qty[0]).toBeGreaterThanOrEqual(1); expect(r.qty[1]).toBeGreaterThanOrEqual(r.qty[0]); expect(r.weight).toBeGreaterThan(0);
    }
    for (const id of CORES) expect(ITEMS[id]?.creatorCore, id).toBeTruthy();
    expect(CORES.size).toBe(7);
  });

  it('positive (chest, item) pairs are exactly the 219 approved rows', () => {
    const want = (C.itemOdds as any[]).map(r => `${r.chest}|${r.item_id}`).sort();
    expect(want).toHaveLength(219); expect(new Set(want).size).toBe(219);
    expect(g1bPositivePairs()).toEqual(want);
  });

  it('per-item odds computed from the runtime pools equal the approved odds table (all 219 rows)', () => {
    const bad: string[] = [];
    for (const row of C.itemOdds as any[]) {
      const c = G1B_CHESTS[row.chest]; let p: number, units: number;
      if (CORES.has(row.item_id)) {
        // generic (non-themed) site: the tier chance is split evenly inside the tier
        p = 0; for (const [code, pct] of Object.entries(c.core_outcome_percent)) { const ids = G1B_CORE_TIERS[code[0] as 'C' | 'M' | 'R']; if (ids.includes(row.item_id)) p += pct / 100 / ids.length; }
        units = p;
      } else {
        const pa = share(c.anchor, row.item_id), pr = share(c.regular, row.item_id), pb = share(c.bonus, row.item_id) * c.bonus_probability_pct / 100;
        p = 1 - (1 - pa) * Math.pow(1 - pr, c.regular_draws) * (1 - pb);
        units = pa * meanQty(c.anchor, row.item_id) + c.regular_draws * pr * meanQty(c.regular, row.item_id) + pb * meanQty(c.bonus, row.item_id);
      }
      if (Math.abs(p * 100 - row.at_least_one_pct) > 0.06 || Math.abs(units - row.expected_units_per_open) > 0.006) bad.push(`${row.chest}|${row.item_id}: runtime ${(p * 100).toFixed(3)}% / ${units.toFixed(4)}u vs approved ${row.at_least_one_pct}% / ${row.expected_units_per_open}u`);
    }
    expect(bad).toEqual([]);
  });

  it('per-source Core odds (site theme included) equal all 373 approved rows and keep the tier total', () => {
    expect(C.perSourceCoreOdds).toHaveLength(373); const bad: string[] = [];
    for (const row of C.perSourceCoreOdds as any[]) {
      const o = g1bCoreOutcomes(row.source_key, row.chest).find(v => v.core === row.core_id && v.level === row.core_level);
      if (!o || Math.abs(o.pct - row.absolute_probability_pct) > 0.0051) bad.push(`${row.source_key}/${row.chest}/${row.core_id} Lv${row.core_level}: runtime ${o?.pct} vs approved ${row.absolute_probability_pct}`);
    }
    expect(bad).toEqual([]);
    for (const s of G1B_SOURCE_SITES) { const c = G1B_CHESTS[s.variant]; const total = Object.values(c.core_outcome_percent).reduce((a, b) => a + b, 0); expect(g1bCoreOutcomes(s.site, s.variant).reduce((a, o) => a + o.pct, 0), s.id).toBeCloseTo(total, 9); }
    for (const v of ['food_low', 'food_mid', 'food_high', 'medical_low', 'medical_mid', 'medical_high']) expect(g1bCoreOutcomes('po_slag', v)).toEqual([]);
  });

  it('source authority: the seven chest Cores are BOTH (crafted or found) and every issued item may legally come from the world', () => {
    for (const id of CORES) expect((ITEM_DESIGN as any)[id][0], id).toBe('BOTH');
    // every other issued item already carries the acquire policy the approved table states (no silent source-authority drift)
    for (const row of C.itemOdds as any[]) { const cur = (ITEM_DESIGN as any)[row.item_id]?.[0]; expect(['BOTH', 'WORLD_ONLY'], `${row.item_id} is ${cur}: a chest may not issue a craft-only item`).toContain(cur); if (!CORES.has(row.item_id)) expect(cur, row.item_id).toBe(row.policy_current_or_proposed); }
  });
});

describe('G1B roll law', () => {
  it('is deterministic for (run, source, cycle) and changes with each of them', () => {
    const sid = G1B_SOURCE_SITES[0].id; const a = g1bRoll('run-A', sid, 0, max);
    expect(g1bRoll('run-A', sid, 0, max)).toEqual(a); expect(a.seed).toBe(g1bSeed('run-A', sid, 0));
    const seeds = new Set([a.seed, g1bSeed('run-B', sid, 0), g1bSeed('run-A', sid, 1), g1bSeed('run-A', G1B_SOURCE_SITES[1].id, 0)]); expect(seeds.size).toBe(4);
  });

  it('every source: 1 anchor + N regular + optional bonus + at most one Core; merged to stack caps, never truncated, fits the chest', () => {
    for (const s of G1B_SOURCE_SITES) {
      const def = G1B_CHESTS[s.variant]; const anchors = new Set(def.anchor.map(r => r.item)), all = new Set([...def.anchor, ...def.regular, ...def.bonus].map(r => r.item));
      const minU = Math.min(...def.anchor.map(r => r.qty[0])) + def.regular_draws * Math.min(...def.regular.map(r => r.qty[0]));
      const maxU = Math.max(...def.anchor.map(r => r.qty[1])) + def.regular_draws * Math.max(...def.regular.map(r => r.qty[1])) + (def.bonus.length ? Math.max(...def.bonus.map(r => r.qty[1])) : 0);
      for (let run = 0; run < 40; run++) {
        const { stacks } = g1bRoll('law-' + run, s.id, run % 3, max); const cores = stacks.filter(v => v.from === 'core'), goods = stacks.filter(v => v.from !== 'core');
        expect(stacks.length).toBeGreaterThan(0); expect(stacks.length, s.id).toBeLessThanOrEqual(G1B_CHEST_SLOTS);
        expect(cores.length).toBeLessThanOrEqual(1);
        for (const c of cores) { expect(CORES.has(c.key)).toBe(true); expect(c.qty).toBe(1); expect([1, 2, 3]).toContain(c.level); }
        if (!Object.values(def.core_outcome_percent).some(p => p > 0)) expect(cores).toHaveLength(0);
        for (const g of goods) { expect(all.has(g.key), `${s.id} issued ${g.key}`).toBe(true); expect(g.qty).toBeGreaterThanOrEqual(1); expect(g.qty).toBeLessThanOrEqual(max(g.key)); expect(g.level).toBeUndefined(); }
        expect(goods.some(g => anchors.has(g.key)), `${s.id} has no anchor item`).toBe(true);
        const units = goods.reduce((a, g) => a + g.qty, 0); expect(units).toBeGreaterThanOrEqual(minU); expect(units).toBeLessThanOrEqual(maxU);
        // merged: a key has at most one stack below its cap
        const partial: Record<string, number> = {}; for (const g of goods) if (g.qty < max(g.key)) partial[g.key] = (partial[g.key] || 0) + 1;
        expect(Object.values(partial).every(n => n === 1), `${s.id} left unmerged stacks`).toBe(true);
      }
    }
  });

  it('measured bonus and Core rates over 30 000 rolls match the approved percentages', () => {
    const pickSid = (variant: string) => G1B_SOURCE_SITES.find(s => s.variant === variant)!;
    for (const variant of ['supply_low', 'toolbox_high', 'military_mid', 'military_high', 'food_mid']) {
      const s = pickSid(variant), def = G1B_CHESTS[variant]; const N = 30000; let core = 0, bonus = 0; const byCore: Record<string, number> = {};
      for (let i = 0; i < N; i++) { const { stacks } = g1bRoll('mc-' + i, s.id, 0, max); const c = stacks.find(v => v.from === 'core'); if (c) { core++; byCore[`${c.key}:${c.level}`] = (byCore[`${c.key}:${c.level}`] || 0) + 1; } if (stacks.some(v => v.from === 'bonus')) bonus++; }
      const coreP = Object.values(def.core_outcome_percent).reduce((a, b) => a + b, 0) / 100, tol = (p: number) => 4 * Math.sqrt(Math.max(p * (1 - p), 1e-4) / N);
      expect(Math.abs(core / N - coreP), `${variant} core ${core / N} vs ${coreP}`).toBeLessThan(tol(coreP));
      // a bonus item that merged into an anchor/regular stack is not visible as its own stack, so the visible rate is a lower bound
      expect(bonus / N).toBeLessThanOrEqual(def.bonus_probability_pct / 100 + tol(def.bonus_probability_pct / 100));
      for (const o of g1bCoreOutcomes(s.site, variant)) expect(Math.abs((byCore[`${o.core}:${o.level}`] || 0) / N - o.pct / 100), `${variant} ${o.core} Lv${o.level}`).toBeLessThan(tol(o.pct / 100));
    }
  });
});
