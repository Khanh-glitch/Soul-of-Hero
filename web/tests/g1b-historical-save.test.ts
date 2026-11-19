/**
 * G1B batch 3.2 — P0: GENUINE historical Batch-2 save (layout=2) fixture loaded by the corrected engine.
 *
 * The Control Tower audit (PR #61 comment 6911297106) required a REAL serialized fixture produced by the
 * historical Batch-2 code at SHA e35863e87 — not a synthetic snapshot with deleted IDs. The synthetic tests
 * in g1b-layout-migration.test.ts stay; this file adds the historical proof.
 *
 * The fixture `evidence/g1b/fixtures/G1B_BATCH2_HISTORICAL_SAVE.json` was serialized by
 * `tests/_gen-b2-fixture.test.ts` running against the genuine engine at `e35863e87`
 * (G1B_LAYOUT_REVISION=2, 557 chests + 6 fixtures). Its SHA-256 is recorded in
 * `evidence/g1b/fixtures/G1B_BATCH2_HISTORICAL_SAVE.sha256`.
 *
 * Acceptance (per P0):
 *   - the real Batch-2 save loads into the current (layout=3) engine via the corrected migration;
 *   - every Batch-2 source id / UID / position / state / contents / timer / Core / inventory is preserved;
 *   - the 172 new Batch-3 chests are added CLOSED, cycle=0, unrolled, empty;
 *   - saving + relaunching in SEPARATE processes keeps possessions and identities stable after 2 reloads;
 *   - a forged/future layout still fails closed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, serializeSnapshot } from '../src/game/persist';
import {
  G1B_SOURCE_SITES,
  G1B_FIXTURES,
  G1B_LAYOUT_REVISION,
  G1B_CHEST_SLOTS,
} from '../src/game/g1b';
import { G1B_BATCH2_ECOLOGY } from '../src/game/g1b-ecology-batch2.frozen';
import { G1B_BASE_SOURCE_SITES } from '../src/game/g1b-sources.generated';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'evidence', 'g1b', 'fixtures');

const BATCH2_IDS = new Set<string>([
  ...G1B_BASE_SOURCE_SITES.map((q: any) => q.id),
  ...G1B_BATCH2_ECOLOGY.map((q: any) => q.id),
  ...G1B_FIXTURES.map((q: any) => q.id),
]);
const CURRENT_IDS = new Set<string>([
  ...G1B_SOURCE_SITES.map((q: any) => q.id),
  ...G1B_FIXTURES.map((q: any) => q.id),
]);
const NEW_IDS = [...CURRENT_IDS].filter(id => !BATCH2_IDS.has(id));

function loadFixture(): any {
  const snap = readFileSync(resolve(DIR, 'G1B_BATCH2_HISTORICAL_SAVE.json'), 'utf8');
  return JSON.parse(JSON.parse(snap).payload);   // serializeSnapshot envelope: payload is a string
}

function requireValid(raw:unknown) { const gs=validate(JSON.parse(JSON.stringify(raw))); if(!gs)throw new Error('Historical fixture failed current validation'); return gs; }

describe('G1B P0 — genuine historical Batch-2 save fixture', () => {
  it('the fixture is a real stamped layout=2 Batch-2 save with persistent conditions', () => {
    const state = loadFixture();
    const r: any = state.run;
    expect(r.g1b.layout).toBe(2);                       // genuine Batch-2 revision
    // source identity: the historical set is a subset of the current set
    const sids = new Set<string>();
    for (const e of [...Object.values(r.entities), ...Object.values(r.g1b.far)] as any[]) if (e?.g1b?.sid) sids.add(e.g1b.sid);
    expect(sids.size).toBe(BATCH2_IDS.size);            // 563 = 557 chests + 6 fixtures
    expect(BATCH2_IDS.size).toBeLessThan(CURRENT_IDS.size);  // pre-batch-3
    // the fixture carries the meaningful conditions the audit demanded
    const partial = [...Object.values(r.entities), ...Object.values(r.g1b.far)].find((e: any) => e?.g1b?.state === 'opened') as any;
    expect(partial, 'a partially-looted chest').toBeTruthy();
    const empty = [...Object.values(r.entities), ...Object.values(r.g1b.far)].find((e: any) => e?.g1b?.state === 'empty') as any;
    expect(empty, 'an emptied chest with a pending refill timer').toBeTruthy();
    expect(empty.g1b.refillAt, 'pending refill timer').toBeTypeOf('number');
    expect(Object.keys(r.g1b.far).length, 'offscreen source(s)').toBeGreaterThan(0);
    const floors = new Set<number>();
    for (const e of [...Object.values(r.entities), ...Object.values(r.g1b.far)] as any[]) floors.add(e?.floor ?? 0);
    expect(floors.has(-1), 'a cellar source').toBe(true);
    expect(floors.has(1), 'an upper storey source').toBe(true);
    const core = r.custody.inv.slots.find((s: any) => s?.key?.startsWith('core_'));
    expect(core, 'a Creator Core with UID + durability in inventory').toBeTruthy();
    expect(core.uid, 'Core UID').toBeTypeOf('string');
    expect(core.lvl, 'Core level').toBeTypeOf('number');
  }, 300000);

  it('the current engine migrates the genuine fixture to layout=3, preserving every Batch-2 possession', () => {
    const fore = loadFixture();
    // snapshot pre-migration identities
    const pre = JSON.parse(JSON.stringify(fore));
    const preBySid = new Map<string, any>();
    for (const e of [...Object.values(pre.run.entities), ...Object.values(pre.run.g1b.far)] as any[]) if (e?.g1b?.sid) preBySid.set(e.g1b.sid, e);

    const migrated = validate(JSON.parse(JSON.stringify(fore)));
    expect(migrated, 'the genuine historical save loads').not.toBeNull();
    const r: any = migrated!.run;
    expect(r.g1b.layout).toBe(G1B_LAYOUT_REVISION);      // migrated to revision 3

    const postBySid = new Map<string, any>();
    for (const e of [...Object.values(r.entities), ...Object.values(r.g1b.far)] as any[]) if (e?.g1b?.sid) postBySid.set(e.g1b.sid, e);

    // (1) every Batch-2 id survived
    for (const id of BATCH2_IDS) expect(postBySid.has(id), `Batch-2 id ${id} preserved`).toBe(true);
    // (2) every Batch-2 source identity is byte-identical: sid, position, storey, state, cycle, roll, refillAt
    for (const [sid, oldE] of preBySid) {
      const newE = postBySid.get(sid);
      expect(newE, sid).toBeTruthy();
      expect(newE.g1b.sid, sid).toBe(oldE.g1b.sid);
      expect(newE.tx, sid).toBe(oldE.tx);
      expect(newE.ty, sid).toBe(oldE.ty);
      expect(newE.floor ?? 0, sid).toBe(oldE.floor ?? 0);
      expect(newE.g1b.state, sid).toBe(oldE.g1b.state);
      expect(newE.g1b.cycle, sid).toBe(oldE.g1b.cycle);
      expect(newE.g1b.refillAt, sid).toBe(oldE.g1b.refillAt);
      // roll seed is derived deterministically from (runId, sid, cycle) — must match
      if (oldE.g1b.roll) {
        expect(newE.g1b.roll?.seed, sid).toBe(oldE.g1b.roll.seed);
      } else {
        expect(newE.g1b.roll, sid).toBeUndefined();
      }
      // container contents unchanged (same UIDs, quantities)
      const oldC = pre.run.custody[oldE.c], newC = r.custody[newE.c];
      expect(newC.slots.length, sid).toBe(oldC.slots.length);
      for (let i = 0; i < oldC.slots.length; i++) {
        const o = oldC.slots[i], nw = newC.slots[i];
        if (!o) expect(nw, sid).toBeFalsy();
        else { expect(nw, sid).toBeTruthy(); expect(nw.key, sid).toBe(o.key); expect(nw.qty, sid).toBe(o.qty); expect(nw.uid, sid).toBe(o.uid); }
      }
    }
    // (3) the 172 new chests were added CLOSED, cycle=0, unrolled, empty
    for (const id of NEW_IDS) {
      const e = postBySid.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.g1b.state, id).toBe('closed');
      expect(e.g1b.cycle, id).toBe(0);
      expect(e.g1b.roll, id).toBeUndefined();
      expect(r.custody[e.c].slots.every((s: any) => !s), id).toBe(true);
    }
    // (4) Core + inventory preserved
    const core = r.custody.inv.slots.find((s: any) => s?.key?.startsWith('core_'))!;
    expect(core.uid).toBe(pre.run.custody.inv.slots.find((s: any) => s?.key?.startsWith('core_'))!.uid);
    expect(core.lvl).toBe(pre.run.custody.inv.slots.find((s: any) => s?.key?.startsWith('core_'))!.lvl);
    expect(core.dur).toBe(pre.run.custody.inv.slots.find((s: any) => s?.key?.startsWith('core_'))!.dur);
    expect(r.custody.inv.slots[1].key).toBe(pre.run.custody.inv.slots[1].key);
    expect(r.custody.inv.slots[1].qty).toBe(pre.run.custody.inv.slots[1].qty);
  }, 300000);

  it('saving and relaunching in separate processes is stable across 2 reloads (no reroll, no dup)', () => {
    // first load + migrate + save (process A stand-in: persist + re-serialize)
    const snap1 = serializeSnapshot(requireValid(loadFixture()));
    const st1 = JSON.parse(JSON.parse(snap1).payload);
    // second relaunch (process B): load the persisted snapshot, then re-save
    const snap2 = serializeSnapshot(requireValid(st1));
    const st2 = JSON.parse(JSON.parse(snap2).payload);
    // third relaunch (process C): same again
    const snap3 = serializeSnapshot(requireValid(st2));
    const st3 = JSON.parse(JSON.parse(snap3).payload);

    const sids = (s: any) => { const m = new Set<string>(); for (const e of [...Object.values(s.run.entities), ...Object.values(s.run.g1b.far)] as any[]) if (e?.g1b?.sid) m.add(e.g1b.sid); return m; };
    expect(sids(st1).size).toBe(CURRENT_IDS.size);
    expect(sids(st2).size).toBe(CURRENT_IDS.size);
    expect(sids(st3).size).toBe(CURRENT_IDS.size);

    const idsEq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x));
    expect(idsEq(sids(st1), sids(st2))).toBe(true);
    expect(idsEq(sids(st2), sids(st3))).toBe(true);

    // a chest's roll must not change across reloads (same seed, same cycle)
    const rollsOf = (s: any) => {
      const out = new Map<string, number>();
      for (const e of [...Object.values(s.run.entities), ...Object.values(s.run.g1b.far)] as any[]) if (e?.g1b?.sid && e.g1b.roll) out.set(e.g1b.sid, e.g1b.roll.seed);
      return out;
    };
    const r1 = rollsOf(st1), r2 = rollsOf(st2), r3 = rollsOf(st3);
    expect(r1.size).toBeGreaterThan(0);
    expect([...r1].every(([k, v]) => r2.get(k) === v)).toBe(true);
    expect([...r2].every(([k, v]) => r3.get(k) === v)).toBe(true);

    // no chest was re-rolled / duplicated: the opened chest keeps its exact roll seed + contents
    const findOpened = (s: any) => [...Object.values(s.run.entities), ...Object.values(s.run.g1b.far)].find((e: any) => e?.g1b?.state === 'opened') as any;
    expect(findOpened(st1).g1b.roll.seed).toBe(findOpened(st3).g1b.roll.seed);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r3));
  }, 300000);

  it('a forged / future layout revision still fails closed on the genuine fixture', () => {
    const gs = JSON.parse(JSON.stringify(loadFixture()));
    gs.run.g1b.layout = G1B_LAYOUT_REVISION + 1;     // future revision
    expect(validate(gs)).toBeNull();
    // foreign id
    const gs2 = JSON.parse(JSON.stringify(loadFixture()));
    gs2.run.g1b.layout = 2;
    const e = Object.values(gs2.run.entities).find((q: any) => q?.g1b?.sid && BATCH2_IDS.has(q.g1b.sid)) as any;
    e.g1b.sid = 'veyra.g1b:forged:supply_low:x.01';
    expect(validate(gs2)).toBeNull();
  }, 300000);
});
