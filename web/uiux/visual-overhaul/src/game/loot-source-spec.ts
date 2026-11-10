/** Versioned LootSourceSpec (loot-source-v2). Authorizes existing authored Shipping caches only.
 * Identity: authored sourceId + poi + the cache's full loot signature (exactly one match). An item's presence alone never identifies a source.
 * Role (container class), grade (independent tier), access (a physically proven door gate, never a bypass), stock (finite or renewable),
 * cooldown and capacity are independent fields. The contract is pinned by digest and recorded per run.
 * Geometry and gates remain Map/Creator-owned. This module never adds POIs, doors, chests or items. */
import type { StaticEnt, World } from './world';

export const LOOT_SOURCE_SPEC_VERSION = 'loot-source-v2' as const;
export type SpecRole = 'toolbox' | 'supply' | 'military' | 'advanced';
export type SpecGrade = 'low' | 'mid' | 'high';
export type SpecAccess = { kind: 'open' } | { kind: 'poi-door'; poi: string; requirement: 'keycard' | 'power' };
export type SpecStock = 'finite' | 'renewable';
export interface LootSourceSpec {
  version: typeof LOOT_SOURCE_SPEC_VERSION; id: string; sourceId: string;
  match: { poi: string; signature: string };
  role: SpecRole; grade: SpecGrade; access: SpecAccess;
  stock: SpecStock; cooldownHours: number; capacity: number;
}
/** Physical access outcome for one source, computed from the real collision grid at run start. */
export type PhysicalAccess = 'open' | 'door-required' | 'unreachable' | 'bypass';
export const lootSignature = (loot: [string, number][] | undefined) => (loot ?? []).map(([k, q]) => `${k}x${q}`).join('+');

/** Existing shipping caches only. Trading Post bow cache and Foundry exterior cache share a role, not a grade. */
export const SHIPPING_LOOT_SOURCES: readonly LootSourceSpec[] = [
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'factory-exterior-industrial', sourceId: 'shipping.factory.exterior.industrial-toolbox',
    match: { poi: 'factory', signature: 'scrapx6+sparesx3+iron_swordx1+mechanical_partsx2+fastenersx3' },
    role: 'toolbox', grade: 'high', access: { kind: 'open' }, stock: 'renewable', cooldownHours: 24, capacity: 3 }, // fixed refined+gear, plus one pool stack
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'tp-bow-cache-standard', sourceId: 'shipping.tp.bow-cache.standard-toolbox',
    match: { poi: 'tp', signature: 'ropex3+clothx2+blueprint:bowx1' },
    role: 'toolbox', grade: 'mid', access: { kind: 'open' }, stock: 'renewable', cooldownHours: 24, capacity: 2 },
  { version: LOOT_SOURCE_SPEC_VERSION, id: 'factory-vault-advanced', sourceId: 'shipping.factory.vault.advanced-keycard',
    match: { poi: 'factory_vault', signature: 'core_firex1+blueprint:core_earthx1+sparesx6' },
    role: 'advanced', grade: 'high', access: { kind: 'poi-door', poi: 'factory', requirement: 'keycard' }, stock: 'finite', cooldownHours: 48, capacity: 2 },
];

const fnv = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
/** Digest of the entire versioned contract. Any edit to a spec field changes it and invalidates b05 runs that recorded the old one. */
export function lootSourceContractDigest(specs: readonly LootSourceSpec[] = SHIPPING_LOOT_SOURCES): string { return fnv(JSON.stringify(specs)); }

/** Find the spec for a static cache by its authored identity. Returns null for every site the contract does not name (legacy path). */
export function specForSite(site: StaticEnt, specs: readonly LootSourceSpec[] = SHIPPING_LOOT_SOURCES): LootSourceSpec | null {
  if (site.kind !== 'loot' || !site.poi) return null;
  const sig = lootSignature(site.loot);
  return specs.find(s => s.match.poi === site.poi && s.match.signature === sig) ?? null;
}

/** The per-run record. Each spec must be found exactly once in the world; the physical access is measured, never assumed. */
export interface LootSourceRecord { sourceId: string; access: PhysicalAccess }
export interface LootSourceContract { version: typeof LOOT_SOURCE_SPEC_VERSION; digest: string; sites: Record<string, LootSourceRecord> }
/** Expected physical outcome for a spec. Open specs must be reachable without a door. Door specs must be sealed by their door. */
export function expectedAccess(spec: LootSourceSpec): PhysicalAccess { return spec.access.kind === 'open' ? 'open' : 'door-required'; }

export function buildLootSourceContract(world: World, measure: (site: StaticEnt) => PhysicalAccess, specs: readonly LootSourceSpec[] = SHIPPING_LOOT_SOURCES): LootSourceContract {
  const sites: Record<string, LootSourceRecord> = {};
  for (const spec of specs) {
    const hits = world.statics.filter(s => s.kind === 'loot' && s.poi === spec.match.poi && lootSignature(s.loot) === spec.match.signature);
    if (hits.length !== 1) { sites[spec.sourceId] = { sourceId: spec.sourceId, access: 'unreachable' }; continue; }
    sites[spec.sourceId] = { sourceId: spec.sourceId, access: measure(hits[0]) };
  }
  return { version: LOOT_SOURCE_SPEC_VERSION, digest: lootSourceContractDigest(specs), sites };
}

/** Durable check for a run's recorded contract: digest pinned, every spec recorded, every access exactly as expected. */
export function validLootSourceContract(c: unknown, specs: readonly LootSourceSpec[] = SHIPPING_LOOT_SOURCES): boolean {
  const x = c as LootSourceContract;
  if (!x || typeof x !== 'object' || x.version !== LOOT_SOURCE_SPEC_VERSION || x.digest !== lootSourceContractDigest(specs) || !x.sites || typeof x.sites !== 'object') return false;
  return specs.every(s => x.sites[s.sourceId]?.sourceId === s.sourceId && x.sites[s.sourceId].access === expectedAccess(s));
}
