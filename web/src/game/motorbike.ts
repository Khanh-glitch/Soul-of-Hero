// Portable geometry contract: only worlds explicitly supplying vehicleGeometry
// can authorize deployment. External/diagnostic maps have no inferred permission.
import { BAL, TILE, WW, WH, T, type RunState } from './core';
import { getWorld } from './world';
import { blockGrid, effTile, clearPhysicalLine } from './engine';

export function vehicleCell(r:RunState,x:number,y:number,mode:'passable'|'parking'|'exit'='passable'):boolean {
  const w=getWorld(r.layoutId||'shipping'),v=w.vehicleGeometry,tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
  if(!v || v.version!=='vehicle-geometry-v1'||v.mapId!==w.economyMap.id||v.mapRevision!==w.economyMap.revision||v.width!==WW||v.height!==WH||v.tileSize!==TILE||[v.passable,v.road,v.slope,v.parking,v.exit].some(a=>!a||a.length!==WW*WH)||tx<0||ty<0||tx>=WW||ty>=WH)return false;
  const i=ty*WW+tx,b=blockGrid(r)[i],t=effTile(r,tx,ty);
  return !!v[mode][i] && Number.isFinite(v.slope[i]) && v.slope[i]<=BAL.motorbike.maxSlope && ![1,2,3,5].includes(b) && ![T.DEEP,T.SHALLOW,T.RIVER,T.ICE,T.LAVA].includes(t);
}
export function vehicleClear(r:RunState,x:number,y:number,ignore?:string,mode:'passable'|'parking'='passable'):boolean {
  const radius=BAL.motorbike.radius;
  if(![[-radius,-radius],[-radius,radius],[radius,-radius],[radius,radius],[0,0]].every(([dx,dy])=>vehicleCell(r,x+dx,y+dy,mode)))return false;
  return !Object.values(r.entities).some(e=>e.id!==ignore && (e.kind==='vehicle'||e.kind==='cart') && Math.hypot(e.x-x,e.y-y)<radius*2);
}

/** A reachable dry exit is required at deployment and on the driven path. */
export function vehicleExitPoint(r:RunState,x:number,y:number,ignore?:string):{x:number;y:number}|undefined {
  const points=[[0,16],[16,0],[-16,0],[0,-16],[16,16],[-16,16],[16,-16],[-16,-16]];
  return points.map(([dx,dy])=>({x:x+dx,y:y+dy})).find(q=>
    [[-3,-3],[-3,3],[3,-3],[3,3]].every(([dx,dy])=>vehicleCell(r,q.x+dx,q.y+dy,'exit')) &&
    clearPhysicalLine(r,{x,y},q,true) &&
    !Object.values(r.entities).some(o=>o.id!==ignore&&(o.kind==='vehicle'||o.kind==='cart')&&Math.hypot(o.x-q.x,o.y-q.y)<10));
}
