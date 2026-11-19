/**
 * SOH Veyra: evidence-producing full-world geometry + sampled live spawn/source audit.
 * Audit ONLY: it does not modify gameplay rules, source tables, save state or GOLD.
 *
 * TWO SEPARATE EVIDENCE CLASSES:
 *  1) Entire 4000x2800 authored chunk terrain, plus TERRAIN-ONLY components
 *     (upper bound on reachability; props/creatures/doors are NOT represented).
 *  2) Actual source-compiled 200x200 windows and newGame/startRun/chooseLegalSpawn
 *     at representative global geography probes (NOT all 11.2m actual spawn trials).
 *
 * Running:
 *   SOH_FULL_WORLD_AUDIT=1 npx vitest run --testTimeout=1800000 \
 *     src/veyra05/full-world-spawn-industrial.audit.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T } from '../game/core';
import { blockGrid, newGame, startRun } from '../game/engine';
import { setActiveLayout } from '../game/world';
import { CHUNK, FRAME_W, FRAME_H, FRAME_AU, auToTile, windowAround } from './frame';
import { getChunk, FL, streamStats } from './chunks';
import { GOLD, POIS } from './reader';
import { layoutIdAt } from './scenes';
import { getWindowWorld } from './window';

type RecordShape = Record<string, unknown>;
const OUTPUT = path.resolve(process.cwd(), 'evidence/veyra-global-spawn-audit/manifest.json');
const manifest: RecordShape = {
  schema: 'veyra-global-audit-v1',
  generatedAt: new Date().toISOString(),
  evidence: {
    fullRaster: 'all emitted chunks, exact tile codes & global geometry',
    components: 'terrain-only 4-neighbour graph, NOT player/legal pathfinding',
    regionProbes: 'actual source compiled and startRun.chooseLegalSpawn in selected windows, NOT full-world spawn enumeration',
    liveGameplay: 'NOT_RUN',
  },
  testedVersion: { frameAU: FRAME_AU, frameTiles: [FRAME_W, FRAME_H], chunks: [Math.ceil(FRAME_W/CHUNK), Math.ceil(FRAME_H/CHUNK)] },
};
function emit() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
}
function dominant(arr: Record<string, number>) {
  return Object.entries(arr).sort((a,b)=>b[1]-a[1]).slice(0,14);
}
function add(count: Record<string,number>, key: string, inc=1) { count[key]=(count[key]??0)+inc; }
// Actual player collision: b=4 SHALLOW/RIVER can be waded (not cargo passable).
// This graph is a GEOMETRY-ONLY superset of physical player reach: static props/doors/sources still block.
const blocked = new Set<number>([T.DEEP,T.CLIFF,T.PWALL,T.LAVA]);
const unsafe = new Set<number>([T.SNOW,T.ASH,T.TOXIC]);
function centroid(ring: number[][]): [number,number] {
  let a=0, x=0, y=0;
  for (let i=0;i<ring.length;i++) {
    const [ax,ay]=ring[i], [bx,by]=ring[(i+1)%ring.length];
    const q=ax*by-bx*ay; a+=q; x+=(ax+bx)*q; y+=(ay+by)*q;
  }
  if (Math.abs(a)<1e-8) return [ring[0][0],ring[0][1]];
  return [x/(3*a), y/(3*a)];
}
function globalTerrainScan() {
  const n=FRAME_W*FRAME_H, terrainWalk=new Uint8Array(n);
  const byTerrain: Record<string,number>={}, byZone:Record<string,number>={}, flags:Record<string,number>={};
  let emitted=0, land=0, broadSafe=0, mappedZones=0, sourcesVisual=0;
  const sx=Math.ceil(FRAME_W/CHUNK),sy=Math.ceil(FRAME_H/CHUNK);
  for(let cy=0;cy<sy;cy++) for(let cx=0;cx<sx;cx++){
    const chunk=getChunk(cx,cy);
    for(let ly=0;ly<CHUNK;ly++){
      const gy=cy*CHUNK+ly;if(gy>=FRAME_H)continue;
      for(let lx=0;lx<CHUNK;lx++){
        const gx=cx*CHUNK+lx;if(gx>=FRAME_W)continue;
        const off=ly*CHUNK+lx, index=gy*FRAME_W+gx,t=chunk.tile[off],f=chunk.flags[off];
        emitted++;
        if(f&FL.LAND) land++;
        if(f&FL.COAST)add(flags,'coastalTiles');
        if(f&FL.ROAD)add(flags,'roadTiles');
        if(f&FL.RIVER)add(flags,'riverTiles');
        if(f&FL.LAKE)add(flags,'lakeTiles');
        if(f&FL.POI)add(flags,'poiFootprintTiles');
        if(chunk.node[off])sourcesVisual++; // GOLD marker only; not compiled harvestable stock
        const z=chunk.zone[off];if(z!==255){mappedZones++;add(byZone,String(z));}
        add(byTerrain,String(t));
        if(!blocked.has(t)){
          terrainWalk[index]=1;
          if(!unsafe.has(t) && (f&FL.LAND)) broadSafe++;
        }
      }
    }
  }
  if(emitted!==n)throw Error('Global raster incomplete: '+emitted+' != '+n);
  // Terrain-only components: even a connected terrain mask cannot prove
  // bypass of solid props, doors, storms, NPCs or survival resource reach.
  const seen=new Uint8Array(n), queue=new Int32Array(n);
  const components: {size:number; sample:[number,number]; sampleAU:[number,number]}[]=[];
  let totalTerrainWalk=0;
  for(let start=0;start<n;start++){
    if(!terrainWalk[start]||seen[start])continue;
    let head=0,tail=0;queue[tail++]=start;seen[start]=1;
    while(head<tail){
      const pos=queue[head++],x=pos%FRAME_W,y=Math.floor(pos/FRAME_W);
      if(x>0){const j=pos-1;if(terrainWalk[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
      if(x+1<FRAME_W){const j=pos+1;if(terrainWalk[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
      if(y>0){const j=pos-FRAME_W;if(terrainWalk[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
      if(y+1<FRAME_H){const j=pos+FRAME_W;if(terrainWalk[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}}
    }
    totalTerrainWalk+=tail;
    const x=start%FRAME_W,y=Math.floor(start/FRAME_W);
    components.push({size:tail,sample:[x,y],sampleAU:[(x+0.5)*0.5,(y+0.5)*0.5]});
  }
  components.sort((a,b)=>b.size-a.size);
  manifest.fullRaster={
    exactCells:emitted,landMaskCells:land,roughTerrainSafeCells:broadSafe,
    terrainWalkableCells:totalTerrainWalk,
    terrainComponentsTotal:components.length,
    terrainComponentsTop20:components.slice(0,20),
    terrainComponentsSmall:components.filter(v=>v.size<30).length,
    authoredMarkerTaggedCells:sourcesVisual,
    zoneTaggedCells:mappedZones,
    terrainCounts:byTerrain,byZone,flags,
    streamStats:streamStats(),
    disclaimers:[
      'Full raster uses chunk ground tiles, not POI door/solid-prop/collision overlays',
      'Player can wade SHALLOW/RIVER (collision class 4); do not use this graph to certify cart/vehicle transport',
      'Global terrain component count is NOT a count of eligible player spawn clusters',
      'No sourceV3 procurement/durability/real interaction modeled by the raster scan',
    ],
  };
  emit();
  expect(emitted).toBe(n);
  expect(totalTerrainWalk).toBeGreaterThan(0);
}
function probeLocations() {
  // All 23 named geographic locality shapes, including less-used habitats;
  // plus one from each island polygon without a named locality.
  const probes: {key:string;au:[number,number]; class:string}[] = [];
  for(const z of GOLD.project.zones){
    probes.push({key:z.id,au:centroid(z.ring as number[][]),class:'named-locality'});
  }
  const already=new Set(probes.map(p=>p.key));
  for(const island of GOLD.project.land){
    const label='island-'+island.id;
    if(already.has(label))continue;
    if(island.id==='ld_veyra')continue;
    probes.push({key:label,au:centroid(island.rings[0] as number[][]),class:'landmass-interior'});
  }
  return probes;
}

/**
 * Per-probe REAL ENGINE blockGrid reachability; NOT simulated key presses.
 * A source may block its own tile: evaluate reachable adjacent standing cells.
 * This is within one 200x200 window only, so "none" is NOT whole-world scarcity.
 */
function probeActualCollisionReach(gs:ReturnType<typeof newGame>, sources:(string|null)[]) {
  const r=gs.run;
  if(!r || !r.spawnChoice) return {status:'NO_VALID_RUN'};
  const grid=blockGrid(r), width=200,height=200,n=width*height;
  const dist=new Int16Array(n).fill(-1),queue=new Int32Array(n);
  const {x:sx,y:sy}=r.spawnChoice, start=sy*width+sx;
  if(grid[start]!==0 && grid[start]!==4) return {status:'PLAYER_SPAWN_COLLISION_BLOCKED',tile:[sx,sy],code:grid[start]};
  let h=0,t=0;queue[t++]=start;dist[start]=0;
  const maxDepth=175;
  while(h<t) {
    const i=queue[h++],x=i%width,y=Math.floor(i/width),depth=dist[i];
    if(depth>=maxDepth)continue;
    for(const next of [x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1]) {
      if(next<0||dist[next]>=0)continue;
      const c=grid[next];
      if(c!==0&&c!==4)continue; // both free and player-wade pass
      dist[next]=depth+1;queue[t++]=next;
    }
  }
  const near=(tile:number)=>{
    if(tile<0||tile>=n)return -1;
    const x=tile%width,y=Math.floor(tile/width);
    let best=dist[tile];
    for(const j of [x>0?tile-1:-1,x+1<width?tile+1:-1,y>0?tile-width:-1,y+1<height?tile+width:-1]) {
      if(j<0||dist[j]<0)continue;
      best=best<0?dist[j]+1:Math.min(best,dist[j]+1);
    }
    return best;
  };
  const known=['oak','pine','snowpine','palm','willow','rock','bush','mushroom','scrap','wreck','iron','coalv'];
  const nearest:Record<string,{steps:number;tiles:number;reachable:number}>={};
  for(const key of known) nearest[key]={steps:-1,tiles:0,reachable:0};
  for(let i=0;i<n;i++){
    const key=sources[i];
    if(!key || !nearest[key])continue;
    const v=nearest[key];v.tiles++;
    const found=near(i);
    if(found<0)continue;
    v.reachable++;
    if(v.steps<0||v.steps>found)v.steps=found;
  }
  const categories={
    wood:['oak','pine','snowpine','palm','willow'],
    stone:['rock'],food:['bush','mushroom'],
    scrap:['scrap','wreck'],ore:['iron'],coal:['coalv'],
  } as const;
  const group:Record<string,{steps:number;reachableNodes:number}>={};
  for(const [k,ids] of Object.entries(categories)){
    const values=ids.map(id=>nearest[id]).filter(v=>v&&v.steps>=0);
    group[k]={steps:values.length?Math.min(...values.map(v=>v.steps)):-1,reachableNodes:values.reduce((s,v)=>s+v.reachable,0)};
  }
  const physicallyAccessibleLoot:RecordShape[]=[];
  for(const e of Object.values(r.entities)){
    if(e.kind!=='loot'||e.tx===undefined||e.ty===undefined)continue;
    const reachableSteps=near(e.ty*width+e.tx);
    const c=e.c?r.custody[e.c]:undefined;
    const stock=(c?.slots??[]).filter(Boolean).map(v=>({key:v!.key,qty:v!.qty,meta:v!.meta??null}));
    physicallyAccessibleLoot.push({poi:e.poi??null,label:e.label??null,localTile:[e.tx,e.ty],steps:reachableSteps,stock});
  }
  const closure={kind:'player-collision-BFS',radius:175,windowOnly:true,
    countVisited:t,minimumSources:group,
    nearestBySource:nearest,
    lootContainersSeen:physicallyAccessibleLoot.length,
    lootContainersReachable:physicallyAccessibleLoot.filter(z=>(z.steps as number)>=0).length,
    nearestLoot:physicallyAccessibleLoot.sort((a,b)=>{
      const aa=(a.steps as number)<0?9999:a.steps as number;
      const bb=(b.steps as number)<0?9999:b.steps as number;
      return aa-bb;
    }).slice(0,7),
    caveats:['BFS over actual blockGrid, not moving/swinging/collecting with player input',
      'No source proof after moving/reloading/stepping beyond current streamed window',
      'Cost excludes enemy threat, sunlight, hunger, damage, and return cargo']};
  return closure;
}

function sourceStartProbes(){
  const outputs:RecordShape[]=[];
  for(const [ordinal,p] of probeLocations().entries()){
    const [gx,gy]=auToTile(p.au[0],p.au[1]);
    const w=windowAround(gx,gy);
    const id=layoutIdAt(w.originTx,w.originTy);
    const rec:RecordShape={
      name:p.key,class:p.class,focusAU:p.au,windowGlobalOrigin:[w.originTx,w.originTy],
      allPOIAuthority:'none',scope:'representative window only',
    };
    try{
      const region=getWindowWorld(id);
      const sources:Record<string,number>={};
      for(const key of region.world.sourceV3)if(key)add(sources,key);
      const eligible=region.world.spawnEligible?.reduce((a,v)=>a+(v?1:0),0)??null;
      rec.sourceCounts=sources;rec.windowCandidatePrefilter=eligible;
      rec.encounteredPOIs=region.poiIds;
      const set=setActiveLayout(id);
      if(!set) throw Error('layout not selectable '+id);
      const gs=newGame();
      const result=startRun(gs,'male',Date.UTC(2026,10,12,5,0,0)+ordinal,null,(0x5eeda00+ordinal*7919)>>>0);
      rec.startOk=result.ok;
      if(result.ok && gs.run){
        rec.spawnLocalTile=gs.run.spawnChoice;
        rec.spawnGlobalTile=[w.originTx+gs.run.spawnChoice!.x,w.originTy+gs.run.spawnChoice!.y];
        rec.qaUsed=gs.run.qaUsed;
        rec.spawnRegionValue=gs.run.spawnRegion;
        rec.collisionReach=probeActualCollisionReach(gs,region.world.sourceV3);
      } else rec.failure=(result as {reason?:string}).reason??'unknown';
    }catch(e){
      rec.startOk=false;rec.exception=String(e);
    }
    outputs.push(rec);
    if(outputs.length%5===0){manifest.regionProbes=outputs;emit();}
  }
  manifest.regionProbes=outputs;
  manifest.summary={
    probes:outputs.length,
    startsAccepted:outputs.filter(r=>r.startOk===true).length,
    startsRejected:outputs.filter(r=>r.startOk===false).length,
    regionProbesWithSalvageReach:outputs.filter(r=>(r.collisionReach as any)?.minimumSources?.scrap?.steps>=0).length,
    regionProbesWithOreReach:outputs.filter(r=>(r.collisionReach as any)?.minimumSources?.ore?.steps>=0).length,
    regionProbesWithOpenLoot:outputs.filter(r=>(r.collisionReach as any)?.lootContainersReachable>0).length,
    landmassesReferenced:GOLD.project.land.length,
    zonesReferenced:GOLD.project.zones.length,
    scenarioTrials:'NOT_RUN: full route traversal/hunger/loot/return/offline needs separate real play evidence',
  };
  emit();
  expect(outputs.length).toBe(GOLD.project.zones.length+GOLD.project.land.length-1);
}
describe('VEYRA full-world terrain and industrial spawn audit (bounded chunk streaming)',()=>{
  it.skipIf(process.env.SOH_FULL_WORLD_AUDIT!=='1')('scans all 11.2M global terrain tiles + 4-neighbour terrain components',globalTerrainScan,1800000);
  it.skipIf(process.env.SOH_FULL_WORLD_AUDIT!=='1')('probes actual source-compiled windows and seeded startRun across geography',sourceStartProbes,1800000);
});
