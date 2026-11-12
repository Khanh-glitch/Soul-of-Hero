/**
 * Necessary (never sufficient) survival co-location screen for a fresh run.
 * Uses the SAME source stock and collision objects supplied to Gameplay; every
 * surviving tile MUST still pass engine.chooseLegalSpawn's exact BFS.
 * No resource grants, no radius relaxation, no terrain mutation.
 *
 * Five reverse BFS distance fields are much cheaper than running a 30-step
 * source walk from every possible 3x3 cell. Sources themselves may be blocked:
 * seed from free orthogonally adjacent standing cells exactly as the real
 * engine's sourceAt adjacency does. Distances <=30 are necessary, not proof.
 */
import { T, WW, WH } from '../game/core';
import type { World } from '../game/world';

export type SpawnSourceSnapshot = {key:string;stock:number;fire?:number}|null;
export type LocalSpawnScreen = {
  mask:Uint8Array;
  candidates:number;
  safe3x3:number;
  fiveSourceNeighborhoods:number;
  sources:{wood:number;stone:number;food:number;water:number;buildable:number};
};

const dirs=[0,1,-1,WW,-WW] as const;
const families=['wood','stone','food','water','buildable'] as const;
type Family=typeof families[number];
const woods=new Set(['oak','pine','snowpine','palm','willow']);
const foods=new Set(['bush','mushroom']);

/** Conservative filter. Real sourceAt may reject a source (burning/depleted).
 * An empty mask means no strict 30-step candidate can exist in this window. */
export function localSpawnScreen(
  w:World,
  grid:Uint8Array,
  sourceAt:(tx:number,ty:number)=>SpawnSourceSnapshot,
  allowedGlobalTile?:(gx:number,gy:number)=>boolean,
):LocalSpawnScreen {
  const n=WW*WH, walk=w.economyMap.walkable;
  if(grid.length!==n||w.fresh.length!==n||w.sourceV3.length!==n)throw Error('SPAWN_SCREEN_WORLD_SIZE_MISMATCH');
  const free=new Uint8Array(n), staticAt=new Uint8Array(n);
  for(const e of w.statics)if(e.tx>=0&&e.ty>=0&&e.tx<WW&&e.ty<WH)staticAt[e.ty*WW+e.tx]=1;
  for(let i=0;i<n;i++)free[i]=grid[i]===0&&!!walk[i]&&!staticAt[i]?1:0;

  const seeds:Record<Family,Uint8Array>={
    wood:new Uint8Array(n),stone:new Uint8Array(n),food:new Uint8Array(n),
    water:new Uint8Array(n),buildable:new Uint8Array(n),
  };
  const srcCounts:Record<Family,number>={wood:0,stone:0,food:0,water:0,buildable:0};
  function seed(f:Family,i:number){
    const x=i%WW,y=(i/WW)|0;
    for(const off of dirs){
      if(off===1&&x===WW-1||off===-1&&x===0||off===WW&&y===WH-1||off===-WW&&y===0)continue;
      const j=i+off;
      if(free[j])seeds[f][j]=1;
    }
  }
  for(let i=0;i<n;i++){
    if(w.fresh[i]){srcCounts.water++;seed('water',i);}
    const key=w.sourceV3[i];
    if(key){
      const src=sourceAt(i%WW,(i/WW)|0);
      if(src&&src.stock>0&&!src.fire){
        const f:Family|null=woods.has(src.key)?'wood':src.key==='rock'?'stone':foods.has(src.key)?'food':null;
        if(f){srcCounts[f]++;seed(f,i);}
      }
    }
    if(w.economyMap.buildable[i]&&!key&&!staticAt[i]){srcCounts.buildable++;seed('buildable',i);}
  }
  const out=new Uint8Array(n);
  if(families.some(f=>srcCounts[f]===0))return {mask:out,candidates:0,safe3x3:0,fiveSourceNeighborhoods:0,sources:srcCounts};

  function distanceField(start:Uint8Array){
    const distance=new Uint8Array(n).fill(255),queue=new Int32Array(n);
    let head=0,tail=0;
    for(let i=0;i<n;i++)if(start[i]){distance[i]=0;queue[tail++]=i;}
    while(head<tail){
      const i=queue[head++],depth=distance[i],x=i%WW,y=(i/WW)|0;
      if(depth===30)continue;
      for(const off of [1,-1,WW,-WW]){
        if(off===1&&x>=WW-2||off===-1&&x<=1||off===WW&&y>=WH-2||off===-WW&&y<=1)continue;
        const j=i+off;
        if(free[j]&&distance[j]===255){distance[j]=depth+1;queue[tail++]=j;}
      }
    }
    return distance;
  }
  const dist=Object.fromEntries(families.map(f=>[f,distanceField(seeds[f])])) as Record<Family,Uint8Array>;
  let safe3x3=0,five=0,candidates=0;
  const ox=w.economyMap.origin?.x??0,oy=w.economyMap.origin?.y??0;
  for(let y=3;y<WH-3;y++)for(let x=3;x<WW-3;x++){
    const i=y*WW+x;
    if(!free[i]||[T.TOXIC,T.ASH,T.SNOW].includes(w.tiles[i]))continue;
    let safe=true;
    for(let dy=-1;dy<=1&&safe;dy++)for(let dx=-1;dx<=1;dx++){
      const j=i+dy*WW+dx;
      if(!free[j]||[T.TOXIC,T.ASH,T.SNOW].includes(w.tiles[j])){safe=false;break;}
    }
    if(!safe)continue;
    safe3x3++;
    if(!families.every(f=>dist[f][i]<=30))continue;
    five++;
    if(allowedGlobalTile&&!allowedGlobalTile(ox+x,oy+y))continue;
    out[i]=1;candidates++;
  }
  return {mask:out,candidates,safe3x3,fiveSourceNeighborhoods:five,sources:srcCounts};
}
