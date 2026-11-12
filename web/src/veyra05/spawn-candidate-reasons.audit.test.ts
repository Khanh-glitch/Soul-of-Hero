/**
 * WESTMOUTH SPAWN REJECTION FORENSICS — source-coded condition trace.
 * Branch-local, read-only gameplay authority: a QA landing is used only to
 * construct RunState for a failed region so the real collision engine can be read.
 * This is NOT a successful legal player start and NEVER counts as playable evidence.
 *
 * Run: SOH_SPAWN_REASON_AUDIT=1 npx vitest run --fileParallelism=false
 *   --testTimeout=600000 src/veyra05/spawn-candidate-reasons.audit.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { T } from '../game/core';
import { newGame, startRun, blockGrid, sourceAt } from '../game/engine';
import { setActiveLayout, getWorld } from '../game/world';
import { getWindowWorld } from './window';
import { layoutIdAt, U05_WORLD_LAYOUT_ID } from './scenes';
import { windowAround, auToTile } from './frame';
import { GOLD } from './reader';

const location=path.resolve(process.cwd(),'evidence/veyra-spawn-reasons/manifest.json');
const material:{schema:string,records:any[],notes:string[]}={
  schema:'veyra-spawn-reasons-v1',records:[],
  notes:[
    'Failed-start collision evaluation requires QA-only inspection landing to build a RunState. The QA diagnostic never proves a legal start.',
    'The per-candidate predicate is a traced copy of engine.ts chooseLegalSpawn, pinned to its source revision; it must be updated after gameplay implementation changes.',
    'All source reachability uses existing engine.sourceAt and blockGrid, local 30-step walk graph, not actual player input.',
  ],
};
function persist(){fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,JSON.stringify(material,null,2)+'\n');}
const probes=[
 {name:'bz_westmouth',origin:[673,1096] as const,seed:0x5f00f56},
 {name:'bz_greywater',origin:[1482,1122] as const,seed:0x5eeda00},
 {name:'bz_gulfwest',origin:[1659,1739] as const,seed:0x5f04d34},
];

function inspectDiagnostic(name:string,origin:readonly [number,number],seed:number){
 const layout=layoutIdAt(origin[0],origin[1]);
 if(!setActiveLayout(layout))throw Error('Unknown window layout '+layout);
 const w=getWorld(),wdata=getWindowWorld(layout);
 const normal=newGame();
 const result=startRun(normal,'male',Date.UTC(2026,10,12,5),null,seed);
 const rec:any={
  name,seed,layout,windowOrigin:origin,normalStart:{ok:result.ok,reason:(result as any).reason??null,spawn:normal.run?.spawnChoice??null},
  prefilter:w.spawnEligible.reduce((a,b)=>a+b,0),
  freshTiles:w.fresh.reduce((a,b)=>a+b,0),
  nodesCompiled:w.sourceV3.filter(Boolean).length,
 };
 // Valid successful normal start can directly expose true RunState.
 // A failed start cannot: its RunState was discarded. Use QA landing solely
 // to inspect the otherwise identical physical collision grid.
 let state=normal.run;
 if(!state){
  const diagnostic=newGame();
  const qa=startRun(diagnostic,'male',Date.UTC(2026,10,12,5),null,seed,{tx:100,ty:100});
  if(!qa.ok||!diagnostic.run){
   rec.diagnosticUnavailable=(qa as any).reason??'QA landing could not find a collision-safe footprint';
   return rec;
  }
  state=diagnostic.run;
  rec.collisonStateCreatedViaQA=true;
  rec.qaUsed=state.qaUsed;
 }else{
  rec.collisonStateCreatedViaQA=false;rec.qaUsed=state.qaUsed;
 }
 const grid=blockGrid(state);
 const walkable=w.economyMap.walkable;
 const src=w.sourceV3;
 const n=200*200;
 const measures:Record<string,number>={
  prefilter:0,centerSafe:0,clear3x3:0,water:0,wood:0,stone:0,food:0,sites9:0,
  fullMatch:0,noWaterAmong3x3:0,passedWaterOnly:0,allExceptWater:0,
 };
 const failMasks:Record<string,number>={};
 const samples:any[]=[];
 const detailTotals:Record<string,number>={};
 function safe(x:number,y:number){
  if(x<=2||y<=2||x>=197||y>=197)return false;
  const i=y*200+x,t=w.tiles[i];
  return grid[i]===0&&!!walkable[i]&&!([T.TOXIC,T.ASH,T.SNOW] as number[]).includes(t);
 }
 const runCandidate=(x:number,y:number)=>{
  const start=y*200+x;
  const seen=new Uint8Array(n),q=new Int32Array(n),depth=new Uint8Array(n);
  let h=0,tail=0;seen[start]=1;q[tail++]=start;
  let wood=false,stone=false,food=false,water=false,sites=0;
  while(h<tail){
   const i=q[h++],px=i%200,py=(i/200)|0;
   if(w.economyMap.buildable[i]&&!src[i])sites++;
   for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=px+dx,ny=py+dy;
    if(nx<1||ny<1||nx>=199||ny>=199)continue;
    const j=ny*200+nx;
    if(w.fresh[j])water=true;
    const source=sourceAt(state!,nx,ny);
    if(source&&source.stock>0&&!source.fire){
     if(['oak','pine','snowpine','palm','willow'].includes(source.key))wood=true;
     if(source.key==='rock')stone=true;
     if(['bush','mushroom'].includes(source.key))food=true;
    }
    if((dx||dy)&&depth[i]<30&&!seen[j]&&grid[j]===0&&walkable[j]){
     seen[j]=1;depth[j]=depth[i]+1;q[tail++]=j;
    }
   }
   // engine short-circuits when this condition becomes true
   if(wood&&stone&&food&&water&&sites>=9)break;
  }
  return {wood,stone,food,water,sites:sites>=9,buildableSeen:sites,explored:tail};
 };
 for(let i=0;i<n;i++){
  if(!w.spawnEligible[i])continue;
  measures.prefilter++;
  const x=i%200,y=(i/200)|0;
  if(!safe(x,y))continue;
  measures.centerSafe++;
  let clear=true;
  for(let dy=-1;dy<=1&&clear;dy++)for(let dx=-1;dx<=1;dx++){
   if(!safe(x+dx,y+dy)){clear=false;break;}
  }
  if(!clear)continue;
  measures.clear3x3++;
  const d=runCandidate(x,y);
  if(d.wood)measures.wood++;
  if(d.stone)measures.stone++;
  if(d.food)measures.food++;
  if(d.water)measures.water++;
  if(d.sites)measures.sites9++;
  const missing=['wood','stone','food','water','sites'].filter(k=>!(d as any)[k]);
  const key=missing.length?missing.join('+'):'PASS';
  failMasks[key]=(failMasks[key]||0)+1;
  if(!d.water)measures.noWaterAmong3x3++;
  if(d.water && !(d.wood&&d.stone&&d.food&&d.sites))measures.passedWaterOnly++;
  if(!d.water&&d.wood&&d.stone&&d.food&&d.sites)measures.allExceptWater++;
  if(!missing.length)measures.fullMatch++;
  if(samples.length<10 || (!missing.length && samples.length<14))
   samples.push({local:[x,y],global:[x+origin[0],y+origin[1]],missing,buildableSeen:d.buildableSeen,explored:d.explored});
 }
 rec.candidateStageCounts=measures;
 rec.missingCombinationCounts=Object.fromEntries(Object.entries(failMasks).sort((a,b)=>b[1]-a[1]));
 rec.candidateExamples=samples;
 rec.adjacentFreshCells=w.fresh.reduce((a,b)=>a+b,0);
 rec.poiCount=wdata.poiIds.length;
 rec.policy='COPY OF LEGAL-SPAWN PREDICATE FOR CAUSE TRIAGE, QA DIAGNOSTIC IF NORMAL START FAILED';
 return rec;
}

describe('Veyra candidate-level spawn reason trace',()=>{
 it.skipIf(process.env.SOH_SPAWN_REASON_AUDIT!=='1')('categorizes failure conditions on exact previously failed Westmouth window',()=>{
  for(const p of probes){
   const result=inspectDiagnostic(p.name,p.origin,p.seed);
   material.records.push(result);persist();
   expect(result.prefilter).toBeGreaterThan(0);
  }
 },600000);
});
