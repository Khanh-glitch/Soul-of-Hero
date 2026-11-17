import { expect } from 'vitest';
import type { GameState, Stack } from '../../src/game/core';
import { RECIPES, STRUCTS } from '../../src/game/catalog';
import { addItem, C, dispatch } from '../../src/game/engine';
import { isRetiredLive } from '../../src/game/final-item-set';

let seq = 0;
/** Controlled mechanics fixture, NOT natural acquisition: supplies the current raw bill,
 * executes the real hand recipe and returns the paid pack for UID assertions.
 * Geometry still pays its direct bill. Never restores retired formulas or grants knowledge. */
export function fundBuild(g: GameState, type: string, now: number): Stack | undefined {
  const d = STRUCTS[type], r = g.run!;
  const rc = d.item?.startsWith('deploy_') ? RECIPES[d.item] : undefined;
  for (const [key, qty] of rc?.ins ?? d.cost) {
    expect(isRetiredLive(key), `retired fixture input ${key}`).toBe(false);
    expect(addItem(r, 'inv', key, qty), `fixture capacity ${key}`).toBe(0);
  }
  if (!rc) return;
  expect(rc.station).toBeNull();
  const before = new Set(C(r, 'inv').slots.filter(Boolean).map(s => s!.uid));
  expect(dispatch(g, { id: `paid-build-craft-${++seq}`, type: 'craft', recipe: d.item }, now)).toMatchObject({ ok: true });
  const pack = C(r, 'inv').slots.find(s => s && s.key === d.item && !before.has(s.uid))!;
  expect(pack, `new physical pack ${type}`).toBeTruthy();
  return pack;
}
