import { describe, expect, it } from 'vitest';
import { NPC_APPEARANCES, resolveNpcClip, resolveNpcFrame } from '../src/game/npc-art';
import type { HumanRecord, HumanState } from '../src/game/humanworld';
import type { Dir } from '../src/game/core';

const dirs: Dir[] = [0, 1, 2, 3];
const modes: { clip: 'idle' | 'walk' | 'use' | 'attack' | 'hurt' | 'downed' | 'dead'; state: HumanState; moving: boolean; intent?: any; wounds?: any[] }[] = [
  { clip: 'idle', state: 'IDLE', moving: false },
  { clip: 'walk', state: 'MOVING', moving: true },
  { clip: 'use', state: 'WORKING', moving: false, intent: { kind: 'work', target: 'harvest:10,10' } },
  { clip: 'attack', state: 'FIGHTING', moving: false },
  { clip: 'hurt', state: 'IDLE', moving: false, wounds: [{ bleeding: true, treated: false }] },
  { clip: 'downed', state: 'DOWNED', moving: false },
  { clip: 'dead', state: 'DEAD', moving: false },
];
function human(appearance: number, dir: Dir, mode: typeof modes[number]): HumanRecord {
  return {
    appearance, dir, state: mode.state, intent: mode.intent, wounds: mode.wounds ?? [],
    lastDamageAt: mode.clip === 'hurt' ? 200 : undefined,
    lastAttackAt: mode.clip === 'attack' ? 200 : undefined,
    equip: { head: null, body: null, legs: null, feet: null, weapon: null },
  } as unknown as HumanRecord;
}

describe('MetroCity NPC body continuity', () => {
  it('keeps all six recognizable base bodies and all four atlas directions through every state', () => {
    for (let appearance = 0; appearance < 6; appearance++) for (const mode of modes) for (const dir of dirs) {
      const h = human(appearance, dir, mode);
      const frame = resolveNpcFrame(h, 0.31, mode.moving);
      expect(frame, `${appearance}/${mode.clip}/${dir}`).not.toBeNull();
      expect(frame!.file).toBe(NPC_APPEARANCES[appearance].atlas);
      expect([frame!.sw, frame!.sh]).toEqual([16, 32]);
      expect(frame!.dir).toBe(dir);
      expect(frame!.clip).toBe(mode.clip);
      expect(frame!.row).toBe(dir === 0 ? 0 : dir === 3 ? 1 : 2);
      expect(frame!.mirrorX).toBe(dir === 1);
    }
  });

  it('uses the atlas right-profile row for both sides and only the left direction is reflected', () => {
    for (let appearance = 0; appearance < 6; appearance++) {
      const left = resolveNpcFrame(human(appearance, 1, modes[0]), 0, false)!;
      const right = resolveNpcFrame(human(appearance, 2, modes[0]), 0, false)!;
      expect(left.file).toBe(right.file);
      expect(left.row).toBe(2); expect(right.row).toBe(2);
      expect(left.mirrorX).toBe(true); expect(right.mirrorX).toBe(false);
    }
  });

  it('does not freeze a bleeding walker in a permanent hit pose or animate attacks without contact', () => {
    const h = human(0, 3, modes[1]);
    h.wounds = [{ bleeding: true, severity: 0.7, treated: false }]; h.lastDamageAt = 0;
    expect(resolveNpcClip(h, 1, true)).toBe('walk');
    h.state = 'FIGHTING';
    expect(resolveNpcClip(h, 1, false)).toBe('idle');
    h.lastAttackAt = 1000;
    expect(resolveNpcClip(h, 1.05, false)).toBe('attack');
    expect(resolveNpcClip(h, 1.5, false)).toBe('idle');
  });

  it('cycles the six authored walk poses while idle holds the proper base stance', () => {
    const walker = human(4, 0, modes[1]);
    expect(Array.from({ length: 6 }, (_, i) => resolveNpcFrame(walker, i / 9, true)!.frameIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    const idle = resolveNpcFrame(human(4, 0, modes[0]), 99, false)!;
    expect(idle.frameIndex).toBe(0); expect(idle.sx).toBe(0);
  });
});
