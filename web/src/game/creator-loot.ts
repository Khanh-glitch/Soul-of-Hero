import type { StaticEnt } from './world';

/** Versioned Gameplay-owned rewards in already-authored Shipping/Dev sites.
 * `marker` identifies the existing crate, not a new Map coordinate. These
 * are guaranteed unique physical items, not a probability table. */
export const CREATOR_LOOT_V1 = [
  { id:'factory_vault/core_fire', poi:'factory_vault', marker:'core_fire', core:'core_dragon' },
  { id:'light_top/core_storm', poi:'light_top', marker:'core_storm', core:'core_meteor' },
  { id:'factory_vault/blueprint:gas_mask', poi:'factory_vault', marker:'blueprint:gas_mask', core:'core_demon' },
  { id:'watch/keycard', poi:'watch', marker:'keycard', core:'core_mjolnir' },
  { id:'wreck/core_frost', poi:'wreck', marker:'core_frost', core:'core_elsa' },
] as const;
export function creatorLootV1(site: StaticEnt): string | undefined {
  if (site.kind !== 'loot') return;
  return CREATOR_LOOT_V1.find(c => c.poi === site.poi && site.loot?.some(([key]) => key === c.marker))?.core;
}
