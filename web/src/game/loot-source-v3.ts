/** WEC-01 Slice 2: loot-source-v3, the versioned contract for ALL 14 authored Shipping Fresh boxes.
 * Additive: loot-source-v2 (B05 pinned digest) and its saves are untouched. New runs use this contract.
 * Identity: authored POI + exact anchor tile (tx,ty). The loot signature is NOT part of identity, so a stock
 * edit cannot silently re-identify a box. Each spec must match exactly one authored static (1:1, checked).
 * Geometry, POIs, doors, items and Core placement belong to Map/world.ts and creator-loot.ts; nothing here adds them.
 * All numbers and stock partitions are SOH_PROVISIONAL gameplay policy, not Last Island drop odds. */
import type { StaticEnt, World } from './world';
import type { PhysicalAccess } from './loot-source-spec';

export const LOOT_SOURCE_V3_VERSION = 'loot-source-v3' as const;
export type V3Family = 'textile' | 'supply' | 'food' | 'equipment' | 'raw_industrial' | 'industrial_salvage' | 'vault_high' | 'power_high' | 'special_core' | 'expedition' | 'access' | 'survival';
export type V3Access = { kind: 'open' } | { kind: 'poi-door'; poi: string; requirement: 'keycard' | 'power' };
export type V3Stack = readonly [string, number];
export interface LootSourceV3Spec {
  id: string; sourceId: string;
  /** Authored identity: poi + exact anchor tile. */
  poi: string; tx: number; ty: number;
  family: V3Family;
  /** Legacy W06 class kept for the pinned W06 roll (unchanged). */
  role: 'toolbox' | 'supply' | 'military' | 'advanced';
  grade: 'low' | 'mid' | 'high';
  access: V3Access;
  /** 'finite': never recreated by ordinary timers and no pool. 'renewable': ordinary renewal only. */
  stock: 'finite' | 'renewable';
  cooldownHours: number;
  capacity: number;
  /** Authored stacks that ordinary renewal may restock (every other authored stack is never re-minted). */
  renewAuthored: readonly string[];
  /** Ordinary renewal: these stacks are always restocked (the authored grade fixed part). Empty when the source has none. */
  fixed?: readonly V3Stack[];
  /** Ordinary renewal alternatives: one alternative (stack list) is picked deterministically per run/source/cycle. */
  pool: readonly (readonly V3Stack[])[];
  /** Exceptional one-time stock, drawn at most once per run (open sources at start, door sources on physical opening). */
  once: readonly V3Stack[];
  provenance: string;
  /** Set when the Map geometry does not enforce the declared gate. The spec then declares the MEASURED access and records the blocker. */
  mapBlocker?: string;
}
const FACTORY_GATE = { kind: 'poi-door', poi: 'factory', requirement: 'keycard' } as const;
const LIGHT_GATE = { kind: 'poi-door', poi: 'light', requirement: 'power' } as const;
const OPEN = { kind: 'open' } as const;

export const SHIPPING_LOOT_SOURCES_V3: readonly LootSourceV3Spec[] = [
  { id: 'tp-bow-cache', sourceId: 'shipping.tp.bow-cache.textile', poi: 'tp', tx: 96, ty: 114, family: 'textile', role: 'toolbox', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['rope', 'cloth'], pool: [[['rope', 2]], [['cloth', 2]]], once: [], provenance: 'world.ts tp crate; authored blueprint:bow is never re-minted' },
  { id: 'tp-wood-supply', sourceId: 'shipping.tp.wood-supply.ordinary', poi: 'tp', tx: 107, ty: 121, family: 'supply', role: 'supply', grade: 'low', access: OPEN,
    stock: 'renewable', cooldownHours: 12, capacity: 2, renewAuthored: ['wood'], pool: [[['wood', 3]], [['fiber', 3]]], once: [], provenance: 'world.ts tp crate; authored iron_ingot is finite' },
  { id: 'mill-food-cache', sourceId: 'shipping.mill.food-cache.food', poi: 'mill', tx: 120, ty: 88, family: 'food', role: 'supply', grade: 'low', access: OPEN,
    stock: 'renewable', cooldownHours: 12, capacity: 2, renewAuthored: ['seed', 'crop'], pool: [[['seed', 2]], [['crop', 1]]], once: [], provenance: 'Food role. blueprint:stew is authored and never re-minted. Historical LI Food Box is mapped to this role, not a fifth W06 class.' },
  { id: 'mill-equipment-cache', sourceId: 'shipping.mill.equipment-cache.building', poi: 'mill', tx: 126, ty: 98, family: 'equipment', role: 'supply', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['leather'], pool: [[['leather', 1]], [['cloth', 1]]], once: [], provenance: 'blueprint:brick is authored and never re-minted' },
  { id: 'vault1-core', sourceId: 'shipping.factory.vault1.advanced-keycard', poi: 'factory_vault', tx: 160, ty: 96, family: 'vault_high', role: 'advanced', grade: 'high', access: FACTORY_GATE,
    stock: 'finite', cooldownHours: 48, capacity: 2, renewAuthored: [], pool: [], once: [['refined_iron_ingot', 2], ['medkit', 1]], provenance: 'Keycard gate (factory door). Creator core_dragon is placed by creator-loot.ts at spawn.' },
  { id: 'vault2-gasmask', sourceId: 'shipping.factory.vault2.advanced-keycard', poi: 'factory_vault', tx: 162, ty: 96, family: 'vault_high', role: 'advanced', grade: 'high', access: FACTORY_GATE,
    stock: 'finite', cooldownHours: 48, capacity: 2, renewAuthored: [], pool: [], once: [['mechanical_gear', 1], ['refined_iron_ingot', 1]], provenance: 'Same keycard gate as Vault1, distinct source id. Creator core_demon is placed at spawn.' },
  { id: 'factory-exterior-industrial', sourceId: 'shipping.factory.exterior.industrial', poi: 'factory', tx: 150, ty: 103, family: 'industrial_salvage', role: 'toolbox', grade: 'high', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 3, renewAuthored: ['scrap', 'spares', 'mechanical_parts', 'fasteners'],
    fixed: [['refined_iron_ingot', 1], ['mechanical_gear', 1]], pool: [[['metal_blade', 1]], [['metal_pipe', 1]], [['iron_plate', 1]]], once: [], provenance: 'Same authored high-grade renewal as the historical b05 roll: fixed refined + gear, one pool stack. iron_sword is authored once and never re-minted (no repeat weapon).' },
  { id: 'factory-raw', sourceId: 'shipping.factory.exterior.raw-ore', poi: 'factory', tx: 154, ty: 96, family: 'raw_industrial', role: 'toolbox', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['iron_ore', 'coal'], pool: [[['iron_ore', 2]], [['coal', 2]]], once: [], provenance: 'Raw industrial input for the furnace. It is not mechanically a Toolbox.' },
  { id: 'light-top-storm', sourceId: 'shipping.light.upper.storm-power', poi: 'light_top', tx: 27, ty: 176, family: 'power_high', role: 'advanced', grade: 'high', access: OPEN,
    stock: 'finite', cooldownHours: 48, capacity: 2, renewAuthored: [], pool: [], once: [['refined_iron_ingot', 1], ['mechanical_parts', 1]], provenance: 'Creator core_meteor is placed at spawn by creator-loot.ts. Finite high one-time stock.', mapBlocker: 'MAP-LIGHT-UPPER: the powered door at (28,179) does not seal the upper room. Measured shortest walk from spawn to the cache is 203 tiles with every door shut. The declared power gate is therefore NOT physically enforced; the access stays open until Map geometry or a Creator decision changes it.' },
  { id: 'light-exterior-fuel', sourceId: 'shipping.light.exterior.fuel-rope', poi: 'light', tx: 31, ty: 175, family: 'supply', role: 'supply', grade: 'low', access: OPEN,
    stock: 'renewable', cooldownHours: 12, capacity: 2, renewAuthored: ['rope'], pool: [[['rope', 1]]], once: [], provenance: 'Fuel policy: the authored fuel_can is finite and never renewed (generator consumer). Only rope renews. No medical alternative: B01 forbids a Food/Medical overlay on a Supply class.' },
  { id: 'wreck-frost-core', sourceId: 'shipping.wreck.frost.special-core', poi: 'wreck', tx: 129, ty: 181, family: 'special_core', role: 'military', grade: 'high', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['spares'], pool: [[['spares', 2]], [['arrow', 4]]], once: [], provenance: 'core_frost is authored once, never re-minted. Spares renewal is an explicit ordinary pool (ordinary renewal, not a free market).' },
  { id: 'wreck-textile', sourceId: 'shipping.wreck.textile.expedition', poi: 'wreck', tx: 133, ty: 180, family: 'expedition', role: 'military', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['cloth', 'treated_canvas'], pool: [[['cloth', 1]], [['treated_canvas', 1]]], once: [], provenance: 'fuel_can is authored once and never renewed. blueprint:arrow is authored once.' },
  { id: 'watch-access', sourceId: 'shipping.watch.access.keycard', poi: 'watch', tx: 86, ty: 57, family: 'access', role: 'military', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 24, capacity: 2, renewAuthored: ['torch'], pool: [[['torch', 1]], [['fiber', 2]]], once: [], provenance: 'Card custody is FINITE: the authored keycard is never renewed or duplicated. blueprint:fur_cloak is authored once. Creator core_mjolnir is placed at spawn.' },
  { id: 'evac-survival', sourceId: 'shipping.evac.pier.survival', poi: 'evac', tx: 172, ty: 24, family: 'survival', role: 'supply', grade: 'mid', access: OPEN,
    stock: 'renewable', cooldownHours: 12, capacity: 2, renewAuthored: ['water_flask', 'medkit'], pool: [[['water_flask', 1]], [['medkit', 1]]], once: [], provenance: 'Nonboss endgame survival supply.' },
];

const fnv = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); };
/** Digest cache keyed by the spec array identity: the authored table is immutable at runtime, so hashing it once is exact. */
const digestCache = new WeakMap<readonly LootSourceV3Spec[], string>();
export function lootSourceV3Digest(specs: readonly LootSourceV3Spec[] = SHIPPING_LOOT_SOURCES_V3): string {
  let d = digestCache.get(specs);
  if (d === undefined) { d = fnv(JSON.stringify(specs)); digestCache.set(specs, d); }
  return d;
}
/** Authored identity match: POI + exact anchor tile. */
export function v3SpecForSite(site: StaticEnt, specs: readonly LootSourceV3Spec[] = SHIPPING_LOOT_SOURCES_V3): LootSourceV3Spec | null {
  if (site.kind !== 'loot' || !site.poi) return null;
  return specs.find(s => s.poi === site.poi && s.tx === site.tx && s.ty === site.ty) ?? null;
}
export function v3ExpectedAccess(spec: LootSourceV3Spec): PhysicalAccess { return spec.access.kind === 'open' ? 'open' : 'door-required'; }

export interface LootSourceV3Record { sourceId: string; access: PhysicalAccess; matches: number }
export interface LootSourceV3Contract { version: typeof LOOT_SOURCE_V3_VERSION; digest: string; sites: Record<string, LootSourceV3Record> }
/** Builds the contract from the real world. Every spec must match exactly one authored static, else it is recorded as 'unreachable'. */
export function buildLootSourceContractV3(world: World, measure: (site: StaticEnt) => PhysicalAccess, specs: readonly LootSourceV3Spec[] = SHIPPING_LOOT_SOURCES_V3): LootSourceV3Contract {
  const sites: Record<string, LootSourceV3Record> = {};
  for (const spec of specs) {
    const hits = world.statics.filter(s => s.kind === 'loot' && s.poi === spec.poi && s.tx === spec.tx && s.ty === spec.ty);
    if (hits.length !== 1) { sites[spec.sourceId] = { sourceId: spec.sourceId, access: 'unreachable', matches: hits.length }; continue; }
    sites[spec.sourceId] = { sourceId: spec.sourceId, access: measure(hits[0]), matches: 1 };
  }
  return { version: LOOT_SOURCE_V3_VERSION, digest: lootSourceV3Digest(specs), sites };
}
/** Fail closed: digest pinned, every spec recorded exactly once, and every access exactly as the spec expects. */
export function validLootSourceContractV3(c: unknown, specs: readonly LootSourceV3Spec[] = SHIPPING_LOOT_SOURCES_V3): boolean {
  const x = c as LootSourceV3Contract;
  if (!x || typeof x !== 'object' || x.version !== LOOT_SOURCE_V3_VERSION || x.digest !== lootSourceV3Digest(specs) || !x.sites || typeof x.sites !== 'object') return false;
  if (Object.keys(x.sites).length !== specs.length) return false;
  return specs.every(s => x.sites[s.sourceId]?.sourceId === s.sourceId && x.sites[s.sourceId].matches === 1 && x.sites[s.sourceId].access === v3ExpectedAccess(s));
}
