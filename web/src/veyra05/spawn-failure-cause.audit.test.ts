/**
 * Read-only SOH spawn failure cause triage. Uses EXACT compiled Veyra windows and normal startRun.
 * Does not change physical map, source stock or gameplay code.
 * Evidence class: window data + four current-region smoke starts; NOT complete global spawn eligibility.
 *
 * Run with: SOH_SPAWN_CAUSE_AUDIT=1 npx vitest run src/veyra05/spawn-failure-cause.audit.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { newGame, startRun } from '../game/engine';
import { setActiveLayout } from '../game/world';
import { T } from '../game/core';
import { U05_WORLD_LAYOUT_ID, layoutIdAt } from './scenes';
import { GOLD } from './reader';
import { FRAME_W, auToTile, windowAround, type WindowSpec } from './frame';
import { getWindowWorld } from './window';

type Entry = Record<string,unknown>;
const root=path.resolve(process.cwd(),'evidence/veyra-spawn-cause-audit');
const output=path.join(root,'manifest.json');
const manifest:Entry={
 schema:'veyra-spawn-cause-v1',
 executedAt:new Date().toISOString(),
 evidence:{source:'actual compiled Veyra 200x200 windows',starts:'four current implementation regions only',fullWorld:'NOT_RUN',movement:'NOT_RUN'},
};
function save(){fs.mkdirSync(root,{recursive:true});fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');}
function centroid(r:number[][]):[number,number]{
 let a=0,x=0,y=0;
 for(let i=0;i<r.length;i++){const [p,q]=r[i],[u,v]=r[(i+1)%r.length],c=p*v-u*q;a+=c;x+=(p+u)*c;y+=(q+v)*c;}
 return Math.abs(a)>1e-7?[x/(3*a),y/(3*a)]:[r[0][0],r[0][1]];
}
function countKeys(items:(string|null)[]){
 const r:Record<string,number>={};for(const x of items)if(x)r[x]=(r[x]||0)+1;return r;
}
function windowMetrics(win:WindowSpec, name:string):Entry{
 const id=layoutIdAt(win.originTx,win.originTy);
 const ww=getWindowWorld(id),w=ww.world;
 let freshwater=0,walk=0,biomeSafe=0,prefilter=0,eligibleDryNeighbourhood=0;
 const n=200*200;
 for(let i=0;i<n;i++){
  if(w.fresh[i])freshwater++;
  if(w.economyMap.walkable[i])walk++;
  const t=w.tiles[i],safe=!!w.economyMap.walkable[i]&&![T.TOXIC,T.ASH,T.SNOW,T.FLOOR,T.PWALL,T.LAVA,T.CLIFF,T.DEEP,T.SHALLOW,T.RIVER].includes(t);
  if(safe)biomeSafe++;
  if(w.spawnEligible?.[i])prefilter++;
  if(!safe)continue;
  const x=i%200,y=(i/200)|0;
  if(x<=2||y<=2||x>=197||y>=197)continue;
  let all=true;
  for(let dy=-1;dy<=1&&all;dy++)for(let dx=-1;dx<=1;dx++){
   const j=i+dy*200+dx;
   if(!w.economyMap.walkable[j]||[T.DEEP,T.SHALLOW,T.RIVER,T.CLIFF,T.LAVA,T.PWALL].includes(w.tiles[j])){all=false;break;}
  }
  if(all)eligibleDryNeighbourhood++;
 }
 const auBounds=[win.originTx/2,win.originTy/2,(win.originTx+200)/2,(win.originTy+200)/2];
 const authoredFresh=GOLD.project.resources.filter(r=>r.kind==='fresh_water'&&r.at[0]>=auBounds[0]&&r.at[0]<auBounds[2]&&r.at[1]>=auBounds[1]&&r.at[1]<auBounds[3]);
 const src=countKeys(w.sourceV3);
 const hasBasic={wood:0,stone:src.rock||0,food:(src.bush||0)+(src.mushroom||0),scrap:(src.scrap||0)+(src.wreck||0),ore:src.iron||0,coal:src.coalv||0};
 for(const k of ['oak','pine','snowpine','palm','willow'])hasBasic.wood+=(src[k]||0);
 return {name,layout:id,windowOrigin:[win.originTx,win.originTy],
   geometry:{freshwaterTiles:freshwater,walkableTiles:walk,safeSurfaceTiles:biomeSafe,
    dry3x3LocalPotential:eligibleDryNeighbourhood,spawnPrefilterCandidates:prefilter,
    fallbackAll40kTriggered:prefilter===40000},
   gold:{authoredFreshwaterMarkersInside:authoredFresh.length,markerIds:authoredFresh.map(x=>x.id)},
   sourceCounts:hasBasic,poiIds:ww.poiIds};
}
describe('Veyra source geometry: spawn rejection diagnostic (read-only)',()=>{
 it.skipIf(process.env.SOH_SPAWN_CAUSE_AUDIT!=='1')('measures authored water markers vs actual freshwater and nearby source options',()=>{
  const focus=['bz_greywater','bz_moss','bz_westmouth','bz_gulfwest','bz_delta','bz_slag','bz_argus','bz_cinder','bz_salt','bz_ironholm'];
  const sample:Entry[]=[];
  for(const id of focus){
    const zone=GOLD.project.zones.find(z=>z.id===id);
    if(!zone)throw Error('Unknown zone '+id);
    const au=centroid(zone.ring as number[][]),[gx,gy]=auToTile(au[0],au[1]);
    sample.push(windowMetrics(windowAround(gx,gy),id));manifest.zoneWindows=sample;save();
  }
  for(const id of ['ld_gull','ld_threshold','ld_wreck','ld_beacon']){
    const land=GOLD.project.land.find(z=>z.id===id);
    if(!land)throw Error('Unknown land '+id);
    const au=centroid(land.rings[0] as number[][]),[gx,gy]=auToTile(au[0],au[1]);
    sample.push(windowMetrics(windowAround(gx,gy),'island-'+id));manifest.zoneWindows=sample;save();
  }
  expect(sample.length).toBe(14);
 },600000);
 it.skipIf(process.env.SOH_SPAWN_CAUSE_AUDIT!=='1')('smoke-tests four implementation start windows, not a canonical spawn count',()=>{
  const out:Entry[]=[];
  for(let region=0;region<4;region++){
   for(let n=0;n<2;n++){
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    const gs=newGame(),now=Date.UTC(2026,10,12,12,0,0)+region*1000+n;
    const seed=(0x500f000 + region*131071 + n*17)>>>0;
    try{
      const rc=startRun(gs,'male',now,region,seed);
      const r=gs.run;
      const ww=r?.layoutId?getWindowWorld(r.layoutId):null;
      out.push({region,seed,success:rc.ok,reason:(rc as {reason?:string}).reason??null,
        actualLayout:r?.layoutId??null,actualSpawn:r?.spawnChoice??null,
        savedRegion:r?.spawnRegion??null,qaUsed:r?.qaUsed??null,
        actualWindowFreshwater:ww?.world.fresh.reduce((a,b)=>a+b,0)??null});
    }catch(e){out.push({region,seed,success:false,exception:String(e)});}
    manifest.implementationStarts=out;save();
   }
  }
  expect(out.length).toBe(8);
 },600000);
});
