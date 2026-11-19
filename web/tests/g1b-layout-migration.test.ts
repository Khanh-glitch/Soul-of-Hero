/**
 * G1B batch 3 — P0: Batch-2 → Batch-3 save-layout migration (layout=2 → layout=3).
 *
 * Root cause of the P0 gate: a Batch-2 save (e35863e87) carries 557 chests + 6 fixtures stamped
 * `g1b.layout = 2`. The old persist.ts only migrated UNSTAMPED saves (layout === undefined), so a stamped
 * Batch-2 save skipped migration and the validator then demanded the full 729-source set — rejecting a valid
 * Batch-2 run on Batch-3. This test pins the atomic, idempotent layout=2 → layout=3 migration.
 *
 * The migration must:
 *   - check the save carries EXACTLY the recognized Batch-2 set (130 base + 427 frozen ecology + 6 fixtures);
 *   - ADD the 172 missing Batch-3 chests as CLOSED, cycle=0, unrolled, empty;
 *   - leave every Batch-2 source id, position, storey, state, cycle, roll, contents, refill timer, Core and
 *     unrelated ledger byte-identical;
 *   - be idempotent: re-loading the migrated save adds nothing and refreshes no chest;
 *   - reject foreign ids, a deliberately-missing old source, and a forged / future revision.
 */
import { describe, expect, it } from 'vitest';
import { WW, WH, TILE, type Entity } from '../src/game/core';
import { newGame, startRun, mkContainer, mkStack, g1bEntities, markDirty } from '../src/game/engine';
import { setActiveLayout } from '../src/game/world';
import { layoutIdAt } from '../src/veyra05/scenes';
import { auToTile, windowAround } from '../src/veyra05/frame';
import { validate, serializeSnapshot } from '../src/game/persist';
import { G1B_SOURCE_SITES, G1B_BASE_SOURCE_SITES, G1B_FIXTURES, G1B_CHEST_SLOTS, G1B_LAYOUT_REVISION, g1bSeed } from '../src/game/g1b';
import { G1B_BATCH2_ECOLOGY } from '../src/game/g1b-ecology-batch2.frozen';
import { T0 } from './helpers/g1b-kit';

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

function startAt(ax: number, ay: number, seed = 8801) {
  const [gtx, gty] = auToTile(ax, ay);
  const win = windowAround(gtx, gty);
  setActiveLayout(layoutIdAt(win.originTx, win.originTy));
  const gs = newGame();
  const lx = Math.max(8, Math.min(WW - 9, gtx - win.originTx)), ly = Math.max(8, Math.min(WH - 9, gty - win.originTy));
  expect(startRun(gs, 'female', T0, null, seed, { tx: lx, ty: ly }).ok).toBe(true);
  return gs;
}

/** Strip the 172 Batch-3-only chests from a current run and stamp it as a Batch-2 save. */
function forgeBatch2Save(gs: any): any {
  const r = gs.run;
  const strip = (container: any) => {
    for (const [id, e] of Object.entries(container) as [string, Entity][]) {
      const sid = e?.g1b?.sid;
      if (sid && !BATCH2_IDS.has(sid)) {
        if(!e.c)throw new Error('Source fixture has no custody container');
        const c = r.custody[e.c]; if (c) { for (const s of c.slots) s && (s.qty = 0, delete s.key); }
        delete container[id]; delete r.custody[e.c];
      }
    }
  };
  strip(r.entities); strip(r.g1b.far);
  r.g1b.layout = 2;
  return JSON.parse(JSON.stringify(gs));
}

describe('G1B P0 — Batch-2 → Batch-3 layout migration', () => {
  it('a stamped Batch-2 save (557 chests, layout=2) migrates to the full 729-source layout=3', () => {
    const gs = startAt(921, 259);
    const r: any = gs.run!;
    // a partially-looted, opened chest with a pending refill, a Core in the pack, and a saved inventory
    const chest = g1bEntities(r).find((e: any) => e.g1b!.sid && BATCH2_IDS.has(e.g1b.sid) && e.g1b.kind === 'chest')!;
    chest.g1b!.state = 'opened'; chest.g1b!.cycle = 2; chest.g1b!.roll = { rev: 'g1b-approved-v1', seed: g1bSeed(r.id, chest.g1b!.sid, 2), at: T0 };
    const c = r.custody[chest.c!]; c.slots[0] = mkStack(r, 'metal_pipe', 3);
    chest.g1b!.refillAt = undefined;
    r.custody.inv.slots[0] = Object.assign(mkStack(r, 'core_meteor', 1), { lvl: 2, dur: 250 });
    r.custody.inv.slots[1] = mkStack(r, 'energy_basic', 5);
    const forged = forgeBatch2Save(gs);
    expect(forged.run.g1b.layout).toBe(2);
    // before migration: the Batch-2 save carries only the 557-source set, not the full current set
    const preSids = new Set<string>();
    for (const e of [...Object.values(forged.run.entities), ...Object.values(forged.run.g1b.far)] as any[]) if (e?.g1b?.sid) preSids.add(e.g1b.sid);
    expect(preSids.size).toBe(BATCH2_IDS.size);
    // migrate: validate mutates in place (the load path) and must bring it to the current revision
    const migrated = validate(JSON.parse(JSON.stringify(forged)));
    expect(migrated).not.toBeNull();
    const mr: any = migrated!.run;
    expect(mr.g1b.layout).toBe(G1B_LAYOUT_REVISION);
    // exactly 729 chests + 6 fixtures
    const sids = new Set<string>();
    for (const e of [...Object.values(mr.entities), ...Object.values(mr.g1b.far)] as any[]) if (e?.g1b?.sid) sids.add(e.g1b.sid);
    expect(sids.size).toBe(G1B_SOURCE_SITES.length + G1B_FIXTURES.length);
    // every Batch-2 chest id survived, at its saved state
    const bySid = new Map<string, any>();
    for (const e of [...Object.values(mr.entities), ...Object.values(mr.g1b.far)] as any[]) if (e?.g1b?.sid) bySid.set(e.g1b.sid, e);
    for (const id of BATCH2_IDS) expect(bySid.has(id), id).toBe(true);
    const migratedChest = bySid.get(chest.g1b!.sid)!;
    expect(migratedChest.g1b!.state).toBe('opened');
    expect(migratedChest.g1b!.cycle).toBe(2);
    expect(migratedChest.g1b!.roll).toEqual(chest.g1b!.roll);
    expect(migratedChest.g1b!.refillAt).toBeUndefined();
    expect(r.custody[chest.c!].slots[0].qty).toBe(3);
    expect(migratedChest.g1b!.state).toBe('opened');
    // the 172 new chests were added CLOSED, cycle=0, unrolled, empty
    for (const id of NEW_IDS) {
      const e = bySid.get(id)!;
      expect(e, id).toBeTruthy();
      expect(e.g1b.state, id).toBe('closed');
      expect(e.g1b.cycle, id).toBe(0);
      expect(e.g1b.roll, id).toBeUndefined();
      expect(mr.custody[e.c].slots.every((s: any) => !s), id).toBe(true);
    }
    // the Core and inventory survived
    const core = mr.custody.inv.slots.find((s: any) => s?.key === 'core_meteor')!;
    expect(core.lvl).toBe(2); expect(core.dur).toBe(250);
    expect(mr.custody.inv.slots[1].key).toBe('energy_basic');
  }, 180000);

  it('the migration is idempotent: re-loading the migrated save adds nothing and refreshes no chest', () => {
    const gs = startAt(921, 259);
    const r: any = gs.run!;
    const chest = g1bEntities(r).find((e: any) => e.g1b!.sid && BATCH2_IDS.has(e.g1b.sid) && e.g1b.kind === 'chest')!;
    chest.g1b!.state = 'empty'; chest.g1b!.cycle = 4; chest.g1b!.refillAt = T0 + 72 * 3600_000;
    const forged = forgeBatch2Save(gs);
    const once = validate(JSON.parse(JSON.stringify(forged)));
    expect(once).not.toBeNull();
    const onceText = JSON.stringify(once);
    const twice = validate(JSON.parse(onceText));
    expect(twice).not.toBeNull();
    expect(JSON.stringify(twice)).toBe(onceText);          // byte-identical: no second migration
    const mr: any = twice!.run;
    const bySid = new Map<string, any>();
    for (const e of [...Object.values(mr.entities), ...Object.values(mr.g1b.far)] as any[]) if (e?.g1b?.sid) bySid.set(e.g1b.sid, e);
    expect(bySid.get(chest.g1b!.sid).g1b.refillAt).toBe(T0 + 72 * 3600_000);   // timer untouched
  }, 180000);

  it('rejects a forged / future revision, foreign ids, and a deliberately-missing old source', () => {
    const gs = startAt(921, 259);
    // (a) future revision
    const gs2 = JSON.parse(JSON.stringify(gs)); gs2.run.g1b.layout = G1B_LAYOUT_REVISION + 1;
    expect(validate(gs2)).toBeNull();
    // (b) foreign (unknown) source id
    const gs3 = JSON.parse(JSON.stringify(gs)); gs3.run.g1b.layout = 2;
    const e = Object.values(gs3.run.entities).find((q: any) => q?.g1b?.sid && BATCH2_IDS.has(q.g1b.sid)) as any;
    e.g1b.sid = 'veyra.g1b:forged:supply_low:x.01';
    expect(validate(gs3)).toBeNull();
    // (c) a deliberately-missing old source (drop one Batch-2 chest, keep layout=2)
    const gs4 = JSON.parse(JSON.stringify(gs)); gs4.run.g1b.layout = 2;
    const drop = Object.values(gs4.run.entities).find((q: any) => q?.g1b?.sid && BATCH2_IDS.has(q.g1b.sid) && q.g1b.kind === 'chest') as any;
    delete gs4.run.entities[drop.id]; delete gs4.run.custody[drop.c];
    expect(validate(gs4)).toBeNull();
  }, 180000);

  it('an unstamped round-1 save (130 chests) still migrates to the current layout', () => {
    const gs = startAt(921, 259);
    const r: any = gs.run!;
    // strip every non-round-1 chest and unstamp
    const round1 = new Set<string>([...G1B_BASE_SOURCE_SITES.map((q: any) => q.id), ...G1B_FIXTURES.map((q: any) => q.id)]);
    const strip = (container: any) => { for (const [id, e] of Object.entries(container) as [string, Entity][]) { if (e?.g1b?.sid && !round1.has(e.g1b.sid)) { if(!e.c)throw new Error('Source fixture has no custody container'); delete r.custody[e.c]; delete container[id]; } } };
    strip(r.entities); strip(r.g1b.far); delete r.g1b.layout;
    const save = JSON.parse(JSON.stringify(gs));
    const migrated = validate(save);
    expect(migrated).not.toBeNull();
    expect(migrated!.run!.g1b!.layout).toBe(G1B_LAYOUT_REVISION);
  }, 180000);

  it('a current (layout=3) save validates and persists without migration', () => {
    const gs = startAt(921, 259);
    expect(gs.run!.g1b!.layout).toBe(G1B_LAYOUT_REVISION);
    expect(validate(JSON.parse(JSON.stringify(gs)))).not.toBeNull();
    const snap = serializeSnapshot(JSON.parse(JSON.stringify(gs)));
    const loaded = validate(JSON.parse(JSON.parse(snap).payload));
    expect(loaded).not.toBeNull();
    expect(loaded!.run!.g1b!.layout).toBe(G1B_LAYOUT_REVISION);
  }, 180000);
});
