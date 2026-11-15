/**
 * Creator Core V2 (G1B) helpers for the long-standing skill tests.
 *
 * Those tests were written against the old three-counter magazine (`Stack.reserves`, filled by `loadCore`). V2 has no
 * magazine: a cast takes its ammunition straight from the pack. The skill EFFECTS the tests prove (bomb, meteor rain,
 * dragon dive, grove, strikes, transit…) are unchanged, so the tests keep their bodies and read the pack through
 * `coreView`, which reports it as the three counters the old `loadCore` order would have produced:
 *   signature = casts payable with Refined Energy + matching Essence, refined = Refined Energy left over, basic = Basic Energy.
 */
import type { RunState, Stack } from '../../src/game/core';
import { ITEMS } from '../../src/game/catalog';
import { countItem } from '../../src/game/engine';

/** Replaces the removed reload step: the Core is taken to Lv3 so Q and E exist. Ammunition stays in the pack. */
export function armCore(core: Stack): { ok: true } { core.lvl = 3; return { ok: true }; }
export function coreView(r: RunState, core: Stack): { basic: number; refined: number; signature: number } {
  const refined = countItem(r, 'inv', 'energy_refined'), essence = countItem(r, 'inv', `essence_${ITEMS[core.key].essence}`);
  const signature = Math.min(refined, essence);
  return { basic: countItem(r, 'inv', 'energy_basic'), refined: refined - signature, signature };
}
