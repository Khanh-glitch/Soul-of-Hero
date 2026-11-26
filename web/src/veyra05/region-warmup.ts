/**
 * The regions a new game needs first, worked out before any run exists by opening a throwaway game. Used by the
 * prebuild worker while the title screen is up. In the order a new game asks for them:
 *   1. the regions the game compiles while it is being created (settlement set-up reads the ground at fixed places),
 *   2. the region under each resident,
 *   3. the regions next to a resident (region-demand.ts).
 * Residents start in fixed settlements, at spots that differ from game to game. Measured against three other new
 * games: of about 120 regions under their residents 24 to 31 were not under a resident here, but all except 1 to 3
 * were on this list as a neighbour; of about 165 neighbouring regions 37 to 39 were not on this list. What is not
 * on the list is requested by the run itself once it exists (region-prebuild.ts).
 */
import { newGame, startRun } from '../game/engine';
import { setActiveLayout } from '../game/world';
import { U05_WORLD_LAYOUT_ID } from './scenes';
import { regionsWanted } from './region-demand';
import { setPrebuiltRegionSource, type VeyraPlacementRules } from './window';

/** Call only where no real game runs (the worker): it switches the active layout and takes over this thread's
 * prebuilt-region source for the length of the call. */
export function newGameRegions(): [layoutId: string, rules: VeyraPlacementRules][] {
  const gs = newGame(); setActiveLayout(U05_WORLD_LAYOUT_ID);
  const out: [string, VeyraPlacementRules][] = [], seen = new Set<string>();
  const add = (layoutId: string, rules: VeyraPlacementRules) => { const key = rules + ':' + layoutId; if (!seen.has(key)) { seen.add(key); out.push([layoutId, rules]); } };
  // Every region the game compiles while it creates the run passes through here (nothing is served: it compiles as always).
  setPrebuiltRegionSource((layoutId, rules) => { add(layoutId, rules); return undefined; });
  try { startRun(gs, 'female', Date.now(), null, 1); } finally { setPrebuiltRegionSource(null); }
  const r = gs.run; if (!r) return out;
  const rules: VeyraPlacementRules = r.sourceMap?.rules === 4 ? 4 : 3;
  const { urgent, nearby } = regionsWanted(r);
  for (const layoutId of urgent) add(layoutId, rules);
  for (const layoutId of nearby) add(layoutId, rules);
  return out;
}
