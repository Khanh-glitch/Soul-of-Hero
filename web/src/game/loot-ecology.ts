import { WW, type RunState } from './core';
import type { StaticEnt } from './world';

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
  const kind=r.lootEcology?.version===LOOT_ECOLOGY_VERSION ? lootClass(site) : null;if(!kind)return [];
  const def=LOOT_CLASSES[kind], input=`${LOOT_ECOLOGY_VERSION}|${r.seed}|${lootSourceId(r,site)}|${cycle}|option-1`;
  let h=2166136261;for(let i=0;i<input.length;i++)h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h=(h^(h>>>16))>>>0;
  const pick=def.options[h%def.options.length];return [[...def.fixed],[pick[0],pick[1]]];
}
