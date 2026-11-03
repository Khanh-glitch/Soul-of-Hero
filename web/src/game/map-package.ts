/** Source-controlled, run-pinned map interchange. Packages are owned by the Map
 * Agent; this adapter consumes their geometry without painting or relocating it. */
import { BAL, TILE, WW, WH } from './core';
import { ELDERS, ITEMS, RECIPES } from './catalog';
import { validateGeographicHandoff, type GeographicHandoff } from './geography-contract';
import type { Building, Place, StaticEnt, World } from './world';
import { compileEconomy } from './world-economy';

export interface RuntimeMapPackage {
  schemaVersion: 1; id: string; revision: number; seed: number; title: string; description: string;
  geometry: GeographicHandoff;
  tiles: number[]; fresh: number[]; zone: number[]; seaDist: number[];
  buildings: Building[]; statics: StaticEnt[]; places: Place[];
}
const digestCache = new WeakMap<World, string>();
const hashText=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');};
/** Accidental-change guard, not a security signature. All fields affecting map
 * interpretation and source/POI geometry are covered, in canonical field order. */
export function mapDigest(w:World):string {
  const cached=digestCache.get(w);if(cached)return cached;const e=w.economyMap;
  const result=hashText(JSON.stringify({id:e.id,revision:e.revision,seed:e.seed,width:e.width,height:e.height,tileSize:e.tileSize,
    tiles:Array.from(w.tiles),fresh:Array.from(w.fresh),zone:Array.from(w.zone),seaDist:Array.from(w.seaDist),legacySources:Array.from(w.src),legacyOverlay:Array.from(w.sourceOverlayV2),
    buildings:w.buildings,statics:w.statics,places:w.places, starts:w.starts,elders:w.elders,
    biome:Array.from(e.biome),elevation:Array.from(e.elevation),slope:Array.from(e.slope),moisture:Array.from(e.moisture),temperature:Array.from(e.temperature),
    freshwater:Array.from(e.freshwater),coast:Array.from(e.coast),walkable:Array.from(e.walkable),buildable:Array.from(e.buildable),cargoPassable:Array.from(e.cargoPassable),road:Array.from(e.road),protected:Array.from(e.protected),industrial:Array.from(e.industrial),sourceV3:w.sourceV3,contract:w.packageContract}));digestCache.set(w,result);return result;
}
export function validateRuntimeMapPackage(value:unknown):string[] {
  try { return validatePackage(value); } catch { return ['malformed map package structure']; }
}
function validatePackage(value:unknown):string[] {
  if (!value || typeof value!=='object') return ['map package must be an object'];
  const p=value as RuntimeMapPackage, errors:string[]=[]; const e=p.geometry?.economy;
  if(p.schemaVersion!==1||!/^[a-z][a-z0-9_-]*$/.test(p.id||'')||!Number.isSafeInteger(p.revision)||p.revision<1||!Number.isSafeInteger(p.seed)||p.seed<0)errors.push('invalid package identity or schema');
  if(!p.title||typeof p.title!=='string'||typeof p.description!=='string')errors.push('package title and description required');
  if(!e)return [...errors,'geographic handoff required'];
  if(e.width!==WW||e.height!==WH||e.tileSize!==TILE)errors.push(`runtime requires exactly ${WW}x${WH} tiles of ${TILE} pixels; resize is not supported`);
  if(e.id!==p.id||e.revision!==p.revision||e.seed!==p.seed)errors.push('geographic identity disagrees with package');
  errors.push(...validateGeographicHandoff(p.geometry));const n=WW*WH;
  for(const [key,max] of [['tiles',19],['fresh',1],['zone',15],['seaDist',255]] as const){const a=p[key];if(!Array.isArray(a)||a.length!==n||a.some(x=>!Number.isInteger(x)||x<0||x>max))errors.push(`${key} must be ${n} bounded integer cells`);}
  const point=(x:number,y:number)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<WW&&y<WH;
  if(!Array.isArray(p.buildings)||p.buildings.some(b=>!b||!b.id||!b.name||typeof b.roof!=='string'||!point(b.x,b.y)||!Number.isInteger(b.w)||!Number.isInteger(b.h)||b.w<1||b.h<1||b.x+b.w>WW||b.y+b.h>WH))errors.push('invalid authored buildings');
  if(!Array.isArray(p.places)||p.places.some(a=>!a||!a.id||!a.name||!point(a.tx,a.ty)||!['start','poi','elder','evac'].includes(a.kind)))errors.push('invalid authored places');
  else {const ids=p.places.map(a=>a.id);if(new Set(ids).size!==ids.length)errors.push('duplicate place ids');const starts=p.places.filter(a=>a.kind==='start');if(!starts.length||starts.some(s=>!e.starts.some(a=>a.id===s.id&&a.x===s.tx&&a.y===s.ty))||starts.length!==e.starts.length)errors.push('starts disagree with geography');const elders=p.places.filter(a=>a.kind==='elder').map(a=>a.id);if(elders.length!==Object.keys(ELDERS).length||Object.keys(ELDERS).some(id=>!elders.includes(id)))errors.push('runtime requires all six uniquely identified Elder sites');}
  if(!Array.isArray(p.statics)||p.statics.some(s=>!s||!point(s.tx,s.ty)||!['loot','cash','vendor','evac','door','gen'].includes(s.kind)||s.kind==='cash'&&(!Number.isSafeInteger(s.cash)||s.cash!<=0||s.cash!>ITEMS.rcash.max*2)||s.kind==='door'&&s.locked!==undefined&&!['keycard','power'].includes(s.locked)||s.kind==='loot'&&(!Array.isArray(s.loot)||s.loot.length>8||s.loot.some(([k,q])=>!Number.isSafeInteger(q)||q<1||(k.startsWith('blueprint:')?q!==1||!RECIPES[k.slice(10)]:!ITEMS[k]||q>ITEMS[k].max)))))errors.push('invalid finite static entity or loot');
  if(!errors.length){
    for(let i=0;i<n;i++){if(p.fresh[i]!==e.freshwater[i]){errors.push(`freshwater mismatch at ${i}`);break;} if (!!e.road[i] !== (p.tiles[i]===12 || p.tiles[i]===13)){errors.push(`road raster mismatch at ${i}`);break;} if (e.cargoPassable[i] && [0,1,8,15,16,18,19].includes(p.tiles[i])){errors.push(`cargo raster contradicts terrain at ${i}`);break;}}
    const at=(kind:string,i:number)=>p.statics.some(s=>s.kind===kind&&s.ty*WW+s.tx===i);
    if(!p.geometry.nonbossCashSites.every(i=>at('cash',i))||!p.geometry.vendorSites.every(i=>at('vendor',i))||!p.geometry.evacuationSites.every(i=>at('evac',i)))errors.push('cash/vendor/evacuation contract sites must reference physical entities');
    if(!p.geometry.nonbossCashSites.some(i=>p.statics.some(s=>s.kind==='cash'&&s.ty*WW+s.tx===i&&(s.cash||0)>BAL.economy.escrowChestPrice)))errors.push('a declared nonboss cash chest must exceed the escrow purchase price');
    for(const poi of p.geometry.pois){
      const tagged=(kind:string,i:number)=>p.statics.some(s=>s.kind===kind&&s.poi===poi.id&&s.ty*WW+s.tx===i);
      if(!poi.doors.every(i=>tagged('door',i))||!poi.powerNodes.every(i=>tagged('gen',i))||![...poi.exteriorLootSites,...poi.interiorLootSites].every(i=>tagged('loot',i)))errors.push(`POI ${poi.id} contract does not reference matching physical statics`);
      if(poi.doors.some(i=>p.statics.some(s=>s.kind==='door'&&s.poi===poi.id&&s.locked==='power'&&s.ty*WW+s.tx===i))&&!poi.powerNodes.length)errors.push(`POI ${poi.id} has a power gate without an authored generator`);
    }
    const occupied=new Set<number>();for(const s of p.statics){const i=s.ty*WW+s.tx;if(occupied.has(i)){errors.push(`overlapping static entities at ${i}`);break;}occupied.add(i);}
  }
  return errors;
}
export function instantiateMapPackage(p:RuntimeMapPackage):World {
  const errors=validateRuntimeMapPackage(p);if(errors.length)throw new Error(`Invalid map package ${p?.id||'(unknown)'}: ${errors.join('; ')}`);
  // Own a deep copy: changes to an agent's manifest after registration must not
  // mutate a running world's source identity.
  const copy=JSON.parse(JSON.stringify(p)) as RuntimeMapPackage,e=copy.geometry.economy;
  const result=compileEconomy(e);if(result.errors.length)throw new Error(result.errors.join('; '));
  return {tiles:Uint8Array.from(copy.tiles),fresh:Uint8Array.from(copy.fresh),zone:Uint8Array.from(copy.zone),seaDist:Uint8Array.from(copy.seaDist),
    src:new Int8Array(WW*WH).fill(-1),sourceOverlayV2:new Int8Array(WW*WH).fill(-1),buildings:copy.buildings,statics:copy.statics,places:copy.places,
    starts:copy.places.filter(p=>p.kind==='start'),elders:copy.places.filter(p=>p.kind==='elder'),economyMap:e,sourceV3:result.sources,packageContract:copy.geometry};
}
