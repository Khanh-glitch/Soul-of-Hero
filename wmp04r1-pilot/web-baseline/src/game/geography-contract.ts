// Additional handoff requirements for a future playable map. The placement
// compiler only needs EconomyMap; it must not pretend a partial raster proves
// the richer POI, route, and endgame geometry required by the Bible.
import type { EconomyMap } from './world-economy';
import { validateEconomyMap, compileEconomy, diagnoseStarts } from './world-economy';
export interface RoadGeometry { id:string; cells:number[]; surface:string; widthTiles:number; bridgeCells:number[]; cargoPassable:boolean }
export interface PoiGeometry { id:string; kind:'residential'|'industrial'|'mining'|'agricultural'|'other'; footprint:number[]; entrances:number[]; rooms:number[][]; doors:number[]; powerNodes:number[]; hazardCells:number[]; exteriorLootSites:number[]; interiorLootSites:number[]; retreatPaths:number[][] }
export interface GeographicHandoff {
  economy:EconomyMap; roads:RoadGeometry[]; pois:PoiGeometry[]; criticalPaths:number[][];
  buildSites:{id:string; cells:number[]; loadingCells:number[]}[];
  nonbossCashSites:number[]; vendorSites:number[]; evacuationSites:number[];
}
export function validateGeographicHandoff(h:Partial<GeographicHandoff>):string[] {
  if(!h.economy)return ['economy raster is required'];const errors=validateEconomyMap(h.economy);if(errors.length)return errors;const n=h.economy.width*h.economy.height;
  const valid=(i:unknown)=>Number.isInteger(i)&&Number(i)>=0&&Number(i)<n;
  const path=(p:unknown)=>Array.isArray(p)&&p.length>0&&p.every(valid)&&p.every((v,j)=>j===0||Math.abs(v-p[j-1])===h.economy!.width||(Math.abs(v-p[j-1])===1&&Math.floor(v/h.economy!.width)===Math.floor(p[j-1]/h.economy!.width)));
  if(!Array.isArray(h.roads)||!h.roads.length)errors.push('authored road geometry, width and cargo access required');
  else for(const r of h.roads)if(!r||!r.id||!r.surface||!Number.isFinite(r.widthTiles)||r.widthTiles<=0||typeof r.cargoPassable!=='boolean'||!path(r.cells)||!Array.isArray(r.bridgeCells)||!r.bridgeCells.every(c=>valid(c)&&r.cells.includes(c))||!r.cells.every(c=>!!h.economy!.road[c])||(r.cargoPassable&&!r.cells.every(c=>!!h.economy!.cargoPassable[c])))errors.push(`invalid road geometry ${r?.id||'(unnamed)'}`);
  // Width is an authored tile cross-section, not a guarantee that a cart can
  // turn at a corner. Validate the advertised width against physical masks.
  if (Array.isArray(h.roads)) for (const r of h.roads) if (r && path(r.cells) && r.cells.length >= 2 && Number.isInteger(r.widthTiles) && r.widthTiles >= 1 && r.widthTiles <= 32) {
    let validWidth=true;const before=-Math.floor((r.widthTiles-1)/2),after=before+r.widthTiles-1;
    for(let i=0;i<r.cells.length&&validWidth;i++){const cell=r.cells[i],a=r.cells[i===r.cells.length-1?i-1:i],b=r.cells[i===r.cells.length-1?i:i+1],horizontal=Math.abs(b-a)===1;const x:number=cell%h.economy!.width;const y:number=Math.floor(cell/h.economy!.width);
      for(let k=before;k<=after;k++){const nx:number=x+(horizontal?0:k),ny:number=y+(horizontal?k:0),j:number=ny*h.economy!.width+nx;if(nx<0||ny<0||nx>=h.economy!.width||ny>=h.economy!.height||!h.economy!.walkable[j]||(r.cargoPassable&&!h.economy!.cargoPassable[j])){validWidth=false;break;}}
    }
    if(!validWidth)errors.push(`road ${r.id} advertised width is obstructed in the supplied raster`);
  } else if (r) errors.push(`road ${r.id||'(unnamed)'} requires 2+ cells and an integer width of 1..32 tiles`);
  if(!Array.isArray(h.pois)||!h.pois.length)errors.push('authored POI footprints, access, rooms, hazards and loot sites required');
  else for(const p of h.pois){if(!p||!p.id||!['residential','industrial','mining','agricultural','other'].includes(p.kind)||!p.footprint?.length||!p.footprint.every(valid)||!p.entrances?.length||!p.entrances.every(c=>valid(c)&&p.footprint.includes(c))||!Array.isArray(p.rooms)||!p.rooms.every(room=>Array.isArray(room)&&room.every(c=>valid(c)&&p.footprint.includes(c)))||!Array.isArray(p.doors)||!Array.isArray(p.powerNodes)||!Array.isArray(p.hazardCells)||!Array.isArray(p.exteriorLootSites)||!Array.isArray(p.interiorLootSites)||![...p.doors,...p.powerNodes,...p.hazardCells,...p.exteriorLootSites,...p.interiorLootSites].every(valid)||!Array.isArray(p.retreatPaths)||!p.retreatPaths.length||!p.retreatPaths.every(path))errors.push(`invalid or incomplete POI geometry ${p?.id||'(unnamed)'}`);}
  if(!Array.isArray(h.criticalPaths)||!h.criticalPaths.length||!h.criticalPaths.every(p=>path(p)&&p.every(i=>!!h.economy!.protected[i]&&!!h.economy!.walkable[i])))errors.push('authored contiguous critical paths required');
  if(!Array.isArray(h.buildSites)||!h.buildSites.length||h.buildSites.some(s=>!s||!s.id||!s.cells?.length||!s.cells.every(c=>valid(c)&&!!h.economy!.buildable[c])||!s.loadingCells?.length||!s.loadingCells.every(c=>valid(c)&&!!h.economy!.cargoPassable[c])))errors.push('buildable footprint and loading candidates required');
  for(const k of ['nonbossCashSites','vendorSites','evacuationSites'] as const)if(!Array.isArray(h[k])||!h[k]!.length||!h[k]!.every(valid))errors.push(`${k} geometry required`);
  if (!validateEconomyMap(h.economy).length) { const placement=compileEconomy(h.economy); errors.push(...placement.errors, ...diagnoseStarts(h.economy,placement.sources)); }
  return errors;
}
