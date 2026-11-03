// Adapter for the current generated geometry. A new map owner must supply the
// same semantics directly; it need not use this shipping-specific extraction.
import { T, TILE, WW, WH, WORLD_SEED } from './core';
import type { MapContentPackV1 } from './content';
import type { Biome, EconomyMap } from './world-economy';
import type { Building, StaticEnt, Place } from './world';
export function adaptCurrentGeometry(pack:MapContentPackV1, tiles:Uint8Array, fresh:Uint8Array, seaDist:Uint8Array, elevation:Float32Array, buildings:Building[], statics:StaticEnt[], starts:Place[], elders:Place[]):EconomyMap {
  const n=WW*WH, biome:Biome[]=Array(n), moisture=new Float32Array(n),temperature=new Float32Array(n), slope=new Float32Array(n), walkable=new Uint8Array(n),buildable=new Uint8Array(n),cargoPassable=new Uint8Array(n),road=new Uint8Array(n),protectedCells=new Uint8Array(n),industrial=new Uint8Array(n),coast=new Uint8Array(n);
  const names:Biome[]=['water','water','sand','grass','meadow','forest','marsh','hill','wall','snow','ash','toxic','road','road','floor','wall','lava','ash','water','water'];
  for(let y=0;y<WH;y++)for(let x=0;x<WW;x++){
    const i=y*WW+x,t=tiles[i];biome[i]=names[t]; road[i]=+(t===T.ROAD||t===T.BRIDGE); coast[i]=+(seaDist[i]<=4 && !fresh[i]);
    walkable[i]=+(![T.DEEP,T.CLIFF,T.PWALL,T.LAVA].includes(t));buildable[i]=+(![T.DEEP,T.SHALLOW,T.RIVER,T.CLIFF,T.PWALL,T.LAVA,T.FLOOR,T.ROAD,T.BRIDGE,T.ICE].includes(t));cargoPassable[i]=+(!!walkable[i]&&![T.SHALLOW,T.RIVER,T.ICE].includes(t));
    // Existing map exposes biome, not continuous climate fields: use explicit
    // conservative biome and latitude proxies for THIS legacy island, not game weather.
    // A future map must supply authored climate/moisture rather than reuse these proxies.
    moisture[i]=t===T.MARSH?.85:t===T.FOREST?.65:t===T.SAND?.25:.45;
    temperature[i]=t===T.SNOW?.1:t===T.ASH?.9:Math.min(.9, Math.max(.1, (y / WH) * 1.2));
    if(x>0&&x<WW-1&&y>0&&y<WH-1)slope[i]=Math.max(Math.abs(elevation[i]-elevation[i-1]),Math.abs(elevation[i]-elevation[i+1]),Math.abs(elevation[i]-elevation[i-WW]),Math.abs(elevation[i]-elevation[i+WW]));
  }
  const mask=(x0:number,y0:number,x1:number,y1:number,arr:Uint8Array)=>{for(let y=Math.max(0,y0);y<=Math.min(WH-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(WW-1,x1);x++)arr[y*WW+x]=1;};
  for(const b of buildings)mask(b.x-1,b.y-1,b.x+b.w,b.y+b.h,protectedCells);
  for(const s of statics) { mask(s.tx-1,s.ty-1,s.tx+1,s.ty+1,protectedCells); if(s.kind!=='door'||s.locked) {const i=s.ty*WW+s.tx;walkable[i]=0;cargoPassable[i]=0;} }
  for(const s of starts)mask(s.tx-2,s.ty-2,s.tx+2,s.ty+2,protectedCells);
  for(const e of elders)mask(e.tx-5,e.ty-5,e.tx+5,e.ty+5,protectedCells);
  // Existing roads/bridges remain open to both walking and cargo.
  for(let i=0;i<n;i++)if(road[i])mask(i%WW-1,Math.floor(i/WW)-1,i%WW+1,Math.floor(i/WW)+1,protectedCells);
  for(const site of pack.infrastructure){const b=buildings.find(x=>x.id===site.buildingId);if(!b)throw new Error(`Map ${pack.id} infrastructure references missing building ${site.buildingId}`);mask(b.x-site.radius,b.y-site.radius,b.x+b.w+site.radius,b.y+b.h+site.radius,industrial);}
  return {id:pack.id,revision:1,seed:WORLD_SEED,width:WW,height:WH,tileSize:TILE,biome,elevation,slope,moisture,temperature,freshwater:fresh,coast,walkable,buildable,cargoPassable,road,protected:protectedCells,industrial,starts:starts.map(s=>({id:s.id,x:s.tx,y:s.ty}))};
}
