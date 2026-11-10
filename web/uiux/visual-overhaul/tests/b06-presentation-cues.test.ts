import { describe, it, expect } from 'vitest';
import { deriveCues, MAPPED_RECEIPT_KINDS, type Receipt } from '../src/game/presentation-cues';

const rc = (seq: number, kind: string, detail: string): Receipt => ({ id: `r${seq}`, seq, at: 1000 + seq, kind, detail });

describe('B06 presentation cue contract (receipts only)', () => {
  it('maps committed receipts to typed cues carrying the cause receipt id and a subject', () => {
    const cues = deriveCues([
      rc(1, 'job.done', 'e8x:smelt_iron'),
      rc(2, 'station.state', 'e8x:idle>lit'),
      rc(3, 'core.commit', 'spirit charge→0'),
      rc(4, 'core.commit', 'sk1:dash:3'),
      rc(5, 'tool.break', 'axe:i42'),
      rc(6, 'loot.depleted', '3:e40'),
    ]);
    expect(cues.map(c => c.kind)).toEqual(['station_job_done', 'station_state_changed', 'core_committed', 'core_committed', 'tool_broke', 'loot_depleted']);
    expect(cues[0]).toMatchObject({ cause: 'job.done', receiptId: 'r1', subject: 'e8x' });
    expect(cues[2].subject).toBe('spirit');
    expect(cues[3].subject).toBe('sk1');
    expect(cues[4].subject).toBe('i42');
    expect(cues[5].subject).toBe('e40');
  });
  it('emits nothing for unmapped receipt kinds (no invented cues)', () => {
    expect(deriveCues([rc(1, 'run.start', 'x@y'), rc(2, 'some.unknown', 'z')])).toEqual([]);
  });
  it('only returns cues after a given sequence, so presentation can consume incrementally', () => {
    const list = [rc(1, 'turret.fire', 'e1:m2'), rc(2, 'turret.fire', 'e1:m3')];
    expect(deriveCues(list, 1).map(c => c.receiptId)).toEqual(['r2']);
  });
  it('every mapped kind is a real engine kind that appears as a literal receipt call', async () => {
    const fs = await import('node:fs/promises');
    const src = (await Promise.all(['engine.ts', 'sim.ts', 'persist.ts', 'thermal.ts', 'airdrop.ts', 'recycler.ts', 'poi-access.ts', 'loot-ecology.ts', 'motorbike.ts', 'core.ts'].map(f => fs.readFile(`src/game/${f}`, 'utf8').catch(() => '')))).join('\n');
    for (const k of MAPPED_RECEIPT_KINDS) expect(src.includes(`'${k}'`), k).toBe(true);
  });
});
