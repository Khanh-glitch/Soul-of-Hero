import { WW, type RunState } from './core';
import { type StaticEnt } from './world';
import { specForSite, validLootSourceContract, type SpecGrade } from './loot-source-spec';
import { ITEMS } from './catalog';

/** W06 SOH_NEW_TUNED v1, not historical LI percentages or timer parity.
 * The eligibility keys refer only to existing authored caches, never new map cells.
 * 2019 official ammunition-source distinctions: hero.yingxiong.com/info/2019/0927/7249.html
 * 2022 card-room class guarantees: Atlas v4, 09/11/2022; not item-level odds.
 */
export type LootClass = 'toolbox' | 'supply' | 'military' | 'advanced';
export const LOOT_ECOLOGY_VERSION = 'w06-v1' as const;
export const LOOT_CLASSES: Record<LootClass,{name:string;hours:number;description:string;fixed:[string,number];options:readonly (readonly [string,number])[]}> = {
  toolbox: {name:'Toolbox',hours:24,description:'Parts for repairs, machinery and research.',fixed:['spares',2],options:[['fasteners',2],['field_repair_kit',1]]},
  supply: {name:'Supply cache',hours:12,description:'Food, healing and useful expedition supplies.',fixed:['bandage',1],options:[['berries',2],['herb',2]]},
  military: {name:'Military cache',hours:24,description:'Combat ammunition or materials, in riskier sites.',fixed:['energy_basic',4],options:[['arrow',4],['spares',2]]},
  advanced: {name:'Advanced military cache',hours:48,description:'Deeper-site energy and components; exceptional finds are finite.',fixed:['energy_refined',1],options:[['mechanical_parts',1],['spares',2]]},
};
/** Classify only explicitly authorized existing Web cache semantics, not arbitrary Map POIs. */
export function lootClass(site:StaticEnt):LootClass|null {
  if(site.kind!=='loot'||!site.loot || site.loot.length>5)return null;
  if(site.poi==='factory_vault'||site.poi==='light_top'||site.label==='Relay Vault Cache')return 'advanced';
  if(site.poi==='watch'||site.poi==='wreck')return 'military';
  if(site.poi==='factory'||site.label==='Maintenance Cache'||(site.poi==='tp'&&site.loot.some(([k])=>k==='blueprint:bow')))return 'toolbox';
  if(['tp','mill','light','evac'].includes(site.poi||''))return 'supply';
  return null;
}
export function lootSourceId(r:RunState,site:StaticEnt) { return `${r.layoutId||'shipping'}:${site.poi||'unknown'}:${site.tx},${site.ty}`; }
export function lootSiteIndex(site:StaticEnt) { return site.ty*WW+site.tx; }
/** Independent hash, never consumes world RNG. Same run/source/cycle always produces the same physical table. */
export function lootRoll(r:RunState,site:StaticEnt,cycle:number):[string,number][] {
  return [...w06LootRoll(r,site,cycle),...lootGrammarRoll(r,site,cycle)];
}
function w06LootRoll(r:RunState,site:StaticEnt,cycle:number):[string,number][] {
  const kind=r.lootEcology?.version===LOOT_ECOLOGY_VERSION ? lootClass(site) : null;if(!kind)return [];
  const def=LOOT_CLASSES[kind], input=`${LOOT_ECOLOGY_VERSION}|${r.seed}|${lootSourceId(r,site)}|${cycle}|option-1`;
  let h=2166136261;for(let i=0;i<input.length;i++)h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h=(h^(h>>>16))>>>0;
  const pick=def.options[h%def.options.length];return [[...def.fixed],[pick[0],pick[1]]];
}

/** B01-R1 source-specific material roles (SOH_PROVISIONAL). Applies ONLY to runs whose lootEcology.grammar === 'b01-v1'.
 * Each W06 class receives EXACTLY ONE grammar role. There is no universal Food+Medical overlay.
 *   supply   (12 h, low)  -> food role: one food stack from {berries, mushroom, herb}
 *   military (24 h, mid)  -> medical role: one medical stack from {bandage, herb}
 *   toolbox  (24 h, mid)  -> metal role: one refined iron ingot (feeds Metal Pipe and Iron Plate)
 *   advanced (48 h, high) -> medkit role + two refined iron ingots
 * Old saves (no grammar field) keep exact W06 rolls. Historical LI counts are NOT copied (see LI_2022_CONTAINER_CONTRACT). */
export const LOOT_GRAMMAR_VERSION = 'b01-v1' as const;
/** B04-P4 (SOH_PROVISIONAL): new runs use b04-v1, which widens the same four roles with physical sinks the source role can plausibly hold.
 * Old saves keep b01-v1 exactly. Pools are chosen deterministically per run/source/cycle; fixed stacks are unchanged. */
export const LOOT_GRAMMAR_B04 = 'b04-v1' as const;
/** B05 (loot-source-v2, SOH_PROVISIONAL): new runs only. Specified sites roll by authored grade; unspecified sites keep B04. */
export const LOOT_GRAMMAR_CURRENT = 'b05-v1' as const;
export function isKnownLootGrammar(v: unknown): v is 'b01-v1' | 'b04-v1' | 'b05-v1' { return v === LOOT_GRAMMAR_VERSION || v === LOOT_GRAMMAR_B04 || v === LOOT_GRAMMAR_CURRENT; }
/** Toolbox grade pools for B05. Mid keeps the B04 toolbox pool; high is an industrial intermediate cache. */
export const LOOT_B05_TOOLBOX_GRADE: Record<SpecGrade, { fixed: readonly (readonly [string, number])[]; pool: readonly (readonly [string, number])[] }> = {
  low:  { fixed: [], pool: [['fasteners', 1], ['scrap', 1]] },
  mid:  { fixed: [['refined_iron_ingot', 1]], pool: [['mechanical_gear', 1], ['metal_pipe', 1], ['iron_plate', 1]] },
  high: { fixed: [['refined_iron_ingot', 1], ['mechanical_gear', 1]], pool: [['metal_blade', 1], ['metal_pipe', 1], ['iron_plate', 1]] },
};
export type LootRole = 'food' | 'medical' | 'metal' | 'medical_high';
export type LootGrade = 'low' | 'mid' | 'high';
export const LOOT_B01_ROLES: Record<LootClass, { role: LootRole; grade: LootGrade; fixed: readonly (readonly [string, number])[]; pool: readonly (readonly [string, number])[] }> = {
  supply:   { role: 'food',        grade: 'low',  fixed: [], pool: [['berries', 1], ['mushroom', 1], ['herb', 1]] },
  military: { role: 'medical',     grade: 'mid',  fixed: [], pool: [['bandage', 1], ['herb', 1]] },
  toolbox:  { role: 'metal',       grade: 'mid',  fixed: [['refined_iron_ingot', 1]], pool: [] },
  advanced: { role: 'medical_high', grade: 'high', fixed: [['medkit', 1], ['refined_iron_ingot', 2]], pool: [] },
};
export const LOOT_B04_ROLES: typeof LOOT_B01_ROLES = {
  supply:   { role: 'food',        grade: 'low',  fixed: [], pool: [['berries', 1], ['mushroom', 1], ['herb', 1]] },
  military: { role: 'medical',     grade: 'mid',  fixed: [], pool: [['bandage', 1], ['herb', 1], ['arrow', 4]] },
  toolbox:  { role: 'metal',       grade: 'mid',  fixed: [['refined_iron_ingot', 1]], pool: [['mechanical_gear', 1], ['metal_pipe', 1], ['iron_plate', 1]] },
  advanced: { role: 'medical_high', grade: 'high', fixed: [['medkit', 1], ['refined_iron_ingot', 2]], pool: [['metal_blade', 1], ['mechanical_gear', 1], ['metal_pipe', 1]] },
};
/** The sprite family of a classed cache (B04-P4): each class has its own physical container art. */
export function lootSpriteKey(site: StaticEnt | null | undefined): string | null { const k = site ? lootClass(site) : null; return k ? `loot_${k}` : null; }
/** Historical v2022 reference only (original counts; SOH does not copy them). */
export const LI_2022_CONTAINER_CONTRACT = { green: 6, blue: 6, purple: 7 } as const;
/** Container slots: pre-B01 runs stay at 8 (saves unchanged); B01 runs need room for authored + W06 + grammar stacks. */
export function lootSlots(r:RunState):number { return isKnownLootGrammar(r.lootEcology?.grammar) ? 12 : 8; }
export function lootGrade(site: StaticEnt): LootGrade | null {
  const kind = lootClass(site); return kind ? LOOT_B01_ROLES[kind].grade : null;
}
export function lootRole(site: StaticEnt): LootRole | null {
  const kind = lootClass(site); return kind ? LOOT_B01_ROLES[kind].role : null;
}
function hashPick(input: string): number {
  let h = 2166136261; for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0;
}
/** Items a grammar role may never emit: cash, blueprints, keycards, unique tools and fuel/energy cores. */
const LOOT_B01_FORBIDDEN = new Set(['rcash', 'blueprint', 'keycard', 'damaged_drive', 'energy_basic', 'energy_refined', 'core_blast', 'core_earthmother', 'iron_pick', 'iron_axe', 'iron_sword']);
/** Deterministic per run/source/cycle. Each class receives only its own role; no cross-role overlay. */
export function lootGrammarRoll(r: RunState, site: StaticEnt, cycle: number): [string, number][] {
  const g = r.lootEcology?.grammar; if (!isKnownLootGrammar(g)) return [];
  const kind = lootClass(site); if (!kind) return [];
  if (g === LOOT_GRAMMAR_CURRENT) {
    const spec = specForSite(site);
    if (spec) {
      // Fail closed: the run must carry a valid, digest-pinned contract and this source must be physically open.
      const c = r.lootEcology?.sourceContract;
      if (!c || !validLootSourceContract(c) || c.sites[spec.sourceId]?.access !== 'open') return [];
      if (spec.role !== 'toolbox') return [];                 // no source-authorized pool for this role yet: optional rolls stay off
      if (spec.stock === 'finite' && cycle > 0) return [];    // finite stock is not renewed
      const tbl = LOOT_B05_TOOLBOX_GRADE[spec.grade];
      const base = `${g}|${r.seed}|${lootSourceId(r, site)}|${cycle}|${spec.id}|${spec.grade}`;
      const out: [string, number][] = tbl.fixed.map(([k, q]) => [k, q]);
      if (tbl.pool.length) { const [k, q] = tbl.pool[hashPick(base) % tbl.pool.length]; out.push([k, q]); }
      return out.filter(([k]) => !!ITEMS[k] && !LOOT_B01_FORBIDDEN.has(k)).slice(0, spec.capacity);
    }
  }
  const def = (g === LOOT_GRAMMAR_B04 || g === LOOT_GRAMMAR_CURRENT ? LOOT_B04_ROLES : LOOT_B01_ROLES)[kind];
  const base = `${g}|${r.seed}|${lootSourceId(r, site)}|${cycle}|${def.role}`;
  const out: [string, number][] = def.fixed.map(([k, q]) => [k, q]);
  if (def.pool.length) { const [k, q] = def.pool[hashPick(base) % def.pool.length]; out.push([k, q]); }
  return out.filter(([k]) => !!ITEMS[k] && !LOOT_B01_FORBIDDEN.has(k));
}
