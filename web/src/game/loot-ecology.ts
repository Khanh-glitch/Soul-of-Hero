import { WW, type RunState } from './core';
import type { StaticEnt } from './world';
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

/** B01 family × grade grammar (SOH_PROVISIONAL). Applies ONLY to runs whose lootEcology.grammar === 'b01-v1',
 * i.e. fresh runs created after B01. Saves without the field keep exact W06 rolls (no reroll).
 * Food and Medical are separate families; Toolbox/Military/Supply keep their W06 picks above.
 * Grades come from the existing four classes; no card-room POI is invented.
 * Historical reference only, NOT copied into SOH: 2022-11-09 container announcement (Green 6 / Blue 6 / Purple 7 items
 * with category guarantees; see LI_2022_CONTAINER_CONTRACT). Category guarantees ≠ individual item odds. */
export const LOOT_GRAMMAR_VERSION = 'b01-v1' as const;
export type LootFamily = 'toolbox' | 'supply' | 'military' | 'food' | 'medical';
export type LootGrade = 'low' | 'mid' | 'high';
export const LOOT_B01_FAMILIES: Record<'food' | 'medical', { name: string; options: readonly (readonly [string, number])[] }> = {
  food: { name: 'Food', options: [['berries', 2], ['mushroom', 2], ['herb', 2]] },
  medical: { name: 'Medical', options: [['bandage', 1], ['herb', 1]] },
};
/** Container slots: pre-B01 runs stay at 8 (saves unchanged); B01 runs need room for authored + W06 + grammar stacks. */
export function lootSlots(r:RunState):number { return r.lootEcology?.grammar===LOOT_GRAMMAR_VERSION ? 12 : 8; }
export const LOOT_B01_MEDKIT_HIGH: readonly [string, number] = ['medkit', 1];
/** Historical v2022 reference only (original counts; SOH does not copy them). */
export const LI_2022_CONTAINER_CONTRACT = { green: 6, blue: 6, purple: 7 } as const;
export function lootGrade(site: StaticEnt): LootGrade | null {
  const kind = lootClass(site); if (!kind) return null;
  return kind === 'advanced' ? 'high' : kind === 'supply' ? 'low' : 'mid';
}
function hashPick(input: string): number {
  let h = 2166136261; for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0;
}
/** Deterministic per run/source/cycle. Food/medical picks are independent of the W06 roll. Only eligible
 * consumable foods are emitted (checked against the catalog), never guns, cash, blueprints or unique items. */
export function lootGrammarRoll(r: RunState, site: StaticEnt, cycle: number): [string, number][] {
  if (r.lootEcology?.grammar !== LOOT_GRAMMAR_VERSION) return [];
  const grade = lootGrade(site); if (!grade) return [];
  const base = `${LOOT_GRAMMAR_VERSION}|${r.seed}|${lootSourceId(r, site)}|${cycle}`;
  const pickFrom = (fam: 'food' | 'medical', slot: string) => {
    const opts = LOOT_B01_FAMILIES[fam].options.filter(([k]) => ITEMS[k]?.cat === 'food');
    return opts[hashPick(`${base}|${slot}`) % opts.length];
  };
  const food = pickFrom('food', 'food'), medical = pickFrom('medical', 'medical');
  const out: [string, number][] = [];
  if (grade === 'low') out.push([food[0], food[1]], [medical[0], medical[1]]);
  if (grade === 'mid') out.push([food[0], food[1]], [medical[0], medical[1]]);
  if (grade === 'high') out.push([food[0], food[1] * 2], [medical[0], medical[1]], [...LOOT_B01_MEDKIT_HIGH]);
  return out.filter(([k]) => !!ITEMS[k]);
}
