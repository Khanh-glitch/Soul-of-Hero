/** Versioned LootSourceSpec (loot-source-v2). Authorizes existing authored Shipping caches only.
 * Role = container class, grade = independent tier, access = an existing authored door contract, else fail closed.
 * Matching uses the authored POI and an authored item, never a free coordinate, name guess or distance. POI geometry
 * and gates remain Map/Creator-owned: this module can only reference doors that already exist in the world contract. */
import type { StaticEnt, World } from './world';

export const LOOT_SOURCE_SPEC_VERSION = 'loot-source-v2' as const;
export type SpecRole = 'toolbox' | 'supply' | 'military' | 'advanced';
export type SpecGrade = 'low' | 'mid' | 'high';
export type SpecAccess = { kind: 'open' } | { kind: 'poi-door'; poi: string; requirement: 'keycard' | 'power' };
export interface LootSourceSpec {
  version: typeof LOOT_SOURCE_SPEC_VERSION; id: string;
  match: { poi: string; hasItem: string };
  role: SpecRole; grade: SpecGrade; access: SpecAccess;
}

/** Existing shipping caches only. Trading Post bow cache and Foundry exterior cache share a role, not a grade. */
export const SHIPPING_LOOT_SOURCES: readonly LootSourceSpec[] = [
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'factory-exterior-industrial', match: { poi: 'factory', hasItem: 'iron_sword' }, role: 'toolbox', grade: 'high', access: { kind: 'open' } },
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'tp-bow-cache-standard', match: { poi: 'tp', hasItem: 'blueprint:bow' }, role: 'toolbox', grade: 'mid', access: { kind: 'open' } },
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'factory-vault-advanced', match: { poi: 'factory_vault', hasItem: 'core_fire' }, role: 'advanced', grade: 'high', access: { kind: 'poi-door', poi: 'factory', requirement: 'keycard' } },
];

/** open: no gate; gated: an authored door of the same POI and requirement exists; unproven: fail closed. */
export type ResolvedSource = { spec: LootSourceSpec; access: 'open' | 'gated' | 'unproven' } | null;

/** Access must be an authored door of the same POI, with the same lock requirement, in the current world contract. */
export function accessOpen(world: World, access: SpecAccess): boolean {
  if (access.kind === 'open') return true;
  const doors = world.poiAccess?.doors ?? [];
  return world.statics.some(s => s.kind === 'door' && s.poi === access.poi && s.locked === access.requirement
    && doors.some(d => d.tx === s.tx && d.ty === s.ty && d.requirement === access.requirement));
}

/** Returns null when no spec matches (legacy behaviour). A matching spec whose access cannot be proven fails closed. */
export function resolveLootSource(site: StaticEnt, world: World, specs: readonly LootSourceSpec[] = SHIPPING_LOOT_SOURCES): ResolvedSource {
  if (site.kind !== 'loot' || !site.poi) return null;
  const spec = specs.find(s => s.match.poi === site.poi && !!site.loot?.some(([k]) => k === s.match.hasItem));
  if (!spec) return null;
  if (spec.access.kind === 'open') return { spec, access: 'open' };
  return { spec, access: accessOpen(world, spec.access) ? 'gated' : 'unproven' };
}
