// MEC-01 R2 — C3 companion (SEPARATE OS PROCESS): resume a half-finished funded furnace+workbench save from disk.
// This file is the child half of tests/mec01-c3-offline-resume.test.ts. It is NOT meaningful standalone:
// it reads the save produced by the parent through MEC01_C3_SAVE, settles the offline clock inside THIS process,
// writes the settled state to MEC01_C3_RESUMED and a custody report to MEC01_C3_RESULT.
// If no save is present (e.g. somebody ran this file directly), it SKIPS rather than failing the suite.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { writeFileSync } from './_evidenceFs';
import { settle } from '../src/game/sim';
import { selectSnapshots, serializeSnapshot, validate } from '../src/game/persist';
import { C, countItem } from '../src/game/engine';

const SAVE = process.env.MEC01_C3_SAVE ?? '';
const RESUMED = process.env.MEC01_C3_RESUMED ?? '';
const RESULT = process.env.MEC01_C3_RESULT ?? '';
const run = !!SAVE && existsSync(SAVE);

(run ? describe : describe.skip)('MEC-01 C3 child (separate process resume)', () => {
  it('settles the offline clock from the on-disk save and reports exact output UIDs', () => {
    const text = readFileSync(SAVE, 'utf8');
    const loaded = selectSnapshots([text, null]);
    expect(loaded.gs, 'parent save must load through the game-own loader').toBeTruthy();
    expect(loaded.bad).toEqual([]);
    const gs = loaded.gs!;
    const startedAt = gs.run!.startedAt;
    // Walk away: settle five minutes of offline clock — enough to finish both queued jobs (simulated clock, not wall clock).
    settle(gs, startedAt + 5 * 60_000, true);
    expect(validate(gs), 'settled state must pass the game-own validator').toBeTruthy();
    // Custody report: every output stack in every container, with UID and qty.
    const stacks: { cid: string; key: string; qty: number; uid: string }[] = [];
    for (const [cid, c] of Object.entries(gs.run!.custody) as [string, any][])
      for (const s of c.slots as (any | null)[]) if (s) stacks.push({ cid, key: s.key, qty: s.qty, uid: s.uid });
    const queues = Object.values(gs.run!.entities).filter(e => e.station).map(e => ({ id: e.id, type: e.type, left: e.station!.queue.map(j => [j.id, j.recipe, j.left, j.total]) }));
    writeFileSync(RESUMED, serializeSnapshot(gs));
    writeFileSync(RESULT, JSON.stringify({ startedAt, stacks, queues, revision: gs.revision }, null, 2));
    expect(stacks.length).toBeGreaterThan(0);
    void C; void countItem;
  }, 120000);   // child runs in its own vitest process; the default 5 s is too short under a loaded full run
});
