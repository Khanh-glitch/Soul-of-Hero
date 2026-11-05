import type { StaticEnt } from './world';

/** Gameplay-owned additions to existing Web loot sites, never new Map cells.
 * Each unique reward appears once only on new versioned runs. The renewable
 * ordinary-stock policy deliberately excludes it. */
export function creatorLootV1(site: StaticEnt): string | undefined {
  if (site.kind !== 'loot') return;
  if (site.poi === 'factory_vault' && site.loot?.some(([key]) => key === 'core_fire')) return 'core_dragon';
  if (site.poi === 'light_top' && site.loot?.some(([key]) => key === 'core_storm')) return 'core_meteor';
  if (site.poi === 'wreck' && site.loot?.some(([key]) => key === 'core_frost')) return 'core_elsa';
}
