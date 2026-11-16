import { SOURCES } from './catalog';
import type { RunState } from './core';
import { getWorld, VEYRA_RECYCLER_SITE, webRecyclerSite } from './world';
import { isVeyra05Layout } from '../veyra05/scenes';

/** Immutable per-run rules. A pre-policy save is classified by its actual,
 * authorized machine, never by the currently selected title-screen layout. */
/** Expected bonus Parts per wreck stock unit, both policies (0.3 + 0.2 drives x 2 Parts = 0.7). */
export const WRECK_PARTS_BONUS = 0.7;
export type WreckEconomy = 'direct-v1' | 'recycler-v1';
export function hasAuthorizedRecycler(r: RunState): boolean {
  const layout = r.layoutId || 'shipping';
  const site = webRecyclerSite(getWorld(layout), layout);
  if (site && Object.values(r.entities).some(e => e.kind === 'recycler' && e.tx === site.tx && e.ty === site.ty && e.x === site.tx * 16 + 8 && e.y === site.ty * 16 + 8 && e.poi === 'factory' && !!e.station)) return true;
  if (!site && isVeyra05Layout(layout) && r.veyraOffscreenEntities) {
    return Object.values(r.veyraOffscreenEntities).some(e => e.kind === 'recycler' && e.tx === VEYRA_RECYCLER_SITE.tx && e.ty === VEYRA_RECYCLER_SITE.ty && e.x === VEYRA_RECYCLER_SITE.tx * 16 + 8 && e.y === VEYRA_RECYCLER_SITE.ty * 16 + 8 && e.poi === 'factory' && !!e.station);
  }
  return false;
}
export function wreckEconomy(r: RunState): WreckEconomy {
  return r.wreckEconomy ?? (hasAuthorizedRecycler(r) ? 'recycler-v1' : 'direct-v1');
}
/** The fallback preserves the pre-E02 wreck table and does not grant new drives.
 * Existing drives remain valid physical items and can still be used at a bench. */
export function wreckBonuses(r: RunState): readonly (readonly [string, number])[] {
  // Item set v3: the Damaged Drive is retired (1 drive = 2 Parts), so the split table (0.3 Parts + 0.2 drives) and the
  // direct table (0.7 Parts) are the same expected yield. Both policies now roll the direct 0.7; the per-run policy
  // field is kept only so old saves still validate.
  void wreckEconomy(r);
  return SOURCES.wreck.bonus!.filter(([key]) => key !== 'damaged_drive').map(([key, chance]) => [key, key === 'spares' ? WRECK_PARTS_BONUS : chance] as const);
}
