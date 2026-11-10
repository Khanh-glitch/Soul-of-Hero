import { CORE_STUDY, ITEMS, RECIPES, requiredStationLevel } from './catalog';
import { CREATOR_LOOT_V1 } from './creator-loot';

/** A read-only description derived from the same runtime catalogs and source
 * policy. WMP has no sourced POI contract and is intentionally not inferred. */
export const CREATOR_CORE_KEYS = ['core_blast','core_meteor','core_dragon','core_elsa','core_earthmother','core_mjolnir','core_demon'] as const;
export function creatorContractV1(key: typeof CREATOR_CORE_KEYS[number]) {
  const item=ITEMS[key],recipe=RECIPES[key],reward=CREATOR_LOOT_V1.find(r=>r.core===key);
  return { version:'creator-acquisition-v1', key, source:reward ? {siteId:reward.id,poi:reward.poi,marker:reward.marker,layouts:['shipping_fresh','dev_delta_fresh'],rarity:'guaranteed' as const,quantity:1,respawn:'unique' as const,initialSignature:3} : {siteId:null,layouts:[],rarity:'crafted' as const,quantity:1,respawn:'not-applicable' as const,initialSignature:0},
    knowledge:recipe.base?'base':CORE_STUDY[key]?'study-core-or-research':'research',recipe:{inputs:recipe.ins,output:recipe.qty,station:recipe.station,level:requiredStationLevel(recipe),seconds:recipe.secs}, essence:item.essence,
    ammo:{basic:'energy_basic',refined:'energy_refined',signature:['energy_refined',`essence_${item.essence}`],capacity:{basic:40,refined:12,signature:4}},repair:'not-applicable-reserve-recharge',ownership:'physical UID and custody; death bag',wmpAccess:'owner-contract-missing' };
}
