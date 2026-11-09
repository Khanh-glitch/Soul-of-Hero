// QA-only state preparation for disclosed browser fixtures. Reachable ONLY through the VITE_SOH_QA=1 build (see Game.tsx).
// Every mutation goes through the engine's own addItem, so UIDs, merge rules and ITEMS[key].max are the normal game rules.
import { addItem, C } from './engine';
import { ITEMS } from './catalog';
import type { GameState, RunState } from './core';

/** Fill every empty pack slot with legal Stone stacks (max per ITEMS.stone.max). Returns the resulting fill. */
export function qaFillPack(r: RunState): { filled: number; total: number } {
  for (let guard = 0; guard < 200 && C(r, 'inv').slots.includes(null); guard++) {
    const left = addItem(r, 'inv', 'stone', ITEMS.stone.max);
    if (left > 0) break;
  }
  return { filled: C(r, 'inv').slots.filter(Boolean).length, total: C(r, 'inv').slots.length };
}
/** Legal full pack for a cart test: one packed cart_kit, every other slot a legal Stone stack. */
export function qaPrepareFullPack(r: RunState): { filled: number; total: number } {
  addItem(r, 'inv', 'cart_kit', 1);
  return qaFillPack(r);
}
/** Affordability only: sets the profile's secured cash (the balance itself is never granted by the freight path). */
export function qaSetSecuredCash(gs: GameState, amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('bad amount');
  gs.profile.securedCash = amount;
}
