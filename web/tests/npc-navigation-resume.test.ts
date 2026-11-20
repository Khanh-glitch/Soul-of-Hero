import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectSnapshots, serializeSnapshot } from '../src/game/persist';
import { settle } from '../src/game/sim';
import { setActiveLayout } from '../src/game/world';
import control from '../evidence/npc-integration/first-day-7606/navigation-fork-control.json';

// Same old pre-nutrition h8 access save and same measured warm arm as the
// three-process isolation experiment. No copying live navigation maps here.
const path = process.env.SOH_NAV_CONTROL_H8;
it.skipIf(!path)(
  'restores ten consecutive whole-run hashes through the production snapshot codec',
  () => {
    const warm = selectSnapshots([readFileSync(path!, 'utf8')]).gs!,
      t = warm.run!.clock.lastSimAt;
    expect(setActiveLayout(warm.run!.layoutId!)).toBe(true);
    settle(warm, t + 300000, true);
    const text = serializeSnapshot(warm),
      resumed = selectSnapshots([text]).gs!;
    expect(setActiveLayout(resumed.run!.layoutId!)).toBe(true);
    for (const row of control.samples) {
      settle(resumed, t + 300000 + row.second * 1000, true);
      expect(createHash('sha256').update(JSON.stringify(resumed.run)).digest('hex')).toBe(row.warmRunSha256);
    }
  },
  120000,
);
