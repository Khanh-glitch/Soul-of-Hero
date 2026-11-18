/** Exact old/new terrain comparison. Test-only exports; no production test hooks.
 * Real Veyra chunks + all terrain pairs + directional/competing neighbours.
 * Direct chunk generation is synchronous CPU work, not a physical-GPU FPS test. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5193',out='evidence/solo-final-fallback/20261117/frame-work/terrain-chunks.json',baselineRef=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const oldSource=execFileSync('git',['show',baselineRef+':web/src/game/render.ts'],{encoding:'utf8'}),newSource=readFileSync('src/game/render.ts','utf8');
mkdirSync('.cache/terrain-profile',{recursive:true});
for(const [name,source] of [['before',oldSource],['after',newSource]])writeFileSync(`.cache/terrain-profile/${name}.ts`,source.replace(/(from\s*['"])(\.[^'"]+)(['"])/g,(_,a,p,b)=>a+posix.resolve('/src/game',p)+b)+'\nexport {renderChunk as __chunk};\n');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/__terrain',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(base+'/__terrain?reps='+(process.env.SOH_TERRAIN_REPS||'10'));
 const result=await page.evaluate(async()=>{
  const E=await import('/src/game/engine.ts'),W=await import('/src/game/world.ts'),C=await import('/src/game/core.ts'),before=await import('/.cache/terrain-profile/before.ts'),after=await import('/.cache/terrain-profile/after.ts');
  if(!W.setActiveLayout('veyra05-at-1920-512'))throw Error('layout missing');const gs=E.newGame(),epoch=Date.UTC(2026,10,17,12);if(!E.startRun(gs,'female',epoch,null,901).ok||gs.run.layoutId!=='veyra05-at-1920-512')throw Error('layout split');const r=gs.run;
  const state=JSON.stringify(gs),px=Math.floor(r.player.x/256),py=Math.floor(r.player.y/256),coords=[];
  for(let y=py-1;y<=py+1;y++)for(let x=px-1;x<=px+2;x++)coords.push([x,y]);
  const rounds=[];const module={before,after};
  // Warm each module once (discarded) so JIT/cache state is symmetric, then
  // alternate B/A for an even number of rounds and report per-round totals.
  for(const variant of ['before','after'])for(const [x,y]of coords)module[variant].__chunk(r,x,y);
  const reps=Number(new URLSearchParams(location.search).get('reps')||8);
  for(let i=0;i<reps;i++)for(const variant of ['before','after']){const times=[];for(const [x,y]of coords){const a=performance.now();module[variant].__chunk(r,x,y);times.push(performance.now()-a);}rounds.push({round:i,variant,totalMs:times.reduce((a,b)=>a+b,0),ms:times});}
  const checks=[];
  function compare(label,coords){let bytes=0;for(const [x,y] of coords){const a=before.__chunk(r,x,y),b=after.__chunk(r,x,y),ad=a.getContext('2d').getImageData(0,0,256,256).data,bd=b.getContext('2d').getImageData(0,0,256,256).data;for(let i=0;i<ad.length;i++)if(ad[i]!==bd[i])throw Error(`${label}: mismatch ${x},${y} byte ${i}: ${ad[i]} != ${bd[i]}`);bytes+=ad.length;}checks.push({label,chunks:coords.length,bytes,exact:true});}
  compare('actual Veyra spawn and neighbouring camera chunks',coords);
  if(state!==JSON.stringify(gs))throw Error('terrain renderer mutated state');
  const types=[...new Set(Object.values(C.T).filter(x=>typeof x==='number'))],saved=r.terrain;
  // Stride 3 keeps the 3x3 pair blocks disjoint; the compared chunk set must
  // cover the whole matrix, otherwise coverage is silently partial.
  const origin=2,stride=3,extent=origin+stride*(types.length-1)+1,chunks=Math.ceil(extent/16),fixtures=[];
  for(let j=0;j<chunks;j++)for(let i=0;i<chunks;i++)fixtures.push([i,j]);
  const covered=new Set();
  for(let a=0;a<types.length;a++)for(let b=0;b<types.length;b++){const x=origin+b*stride,y=origin+a*stride;if(x<chunks*16&&y<chunks*16)covered.add(a+':'+b);}
  if(covered.size!==types.length*types.length)throw Error(`fixture covers ${covered.size}/${types.length**2} pairs`);
  const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  try{
   // Pair matrix: every ordered material pair, surrounding sides and corners.
   // A second matrix has eight competing priorities; four directional matrices
   // include both diagonal and orthogonal seams and tile/chunk boundaries.
   for(const mode of ['pairs','competing','north','south','northwest','southeast']){
    r.terrain={};for(let a=0;a<types.length;a++)for(let b=0;b<types.length;b++){
     const x=origin+b*stride,y=origin+a*stride;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)r.terrain[(y+dy)*C.WW+x+dx]={t:types[a]};
     if(mode==='pairs')for(const [dx,dy]of dirs)r.terrain[(y+dy)*C.WW+x+dx]={t:types[b]};
     else if(mode==='competing')dirs.forEach(([dx,dy],i)=>{r.terrain[(y+dy)*C.WW+x+dx]={t:types[(b+i)%types.length]};});
     else {const [dx,dy]={north:[0,-1],south:[0,1],northwest:[-1,-1],southeast:[1,1]}[mode];r.terrain[(y+dy)*C.WW+x+dx]={t:types[b]};}
    }
    const beforeState=JSON.stringify(r.terrain);compare(mode,fixtures);if(beforeState!==JSON.stringify(r.terrain))throw Error('fixture mutated');
   }
  }finally{r.terrain=saved;}
  return {scene:{layout:r.layoutId,seed:r.seed,player:[r.player.x,r.player.y]},types,coords,rounds,summary:Object.fromEntries(['before','after'].map(v=>{const t=rounds.filter(x=>x.variant===v).map(x=>x.totalMs).sort((a,b)=>a-b);return [v,{rounds:t.length,medianRoundMs:t[t.length>>1],minRoundMs:t[0],maxRoundMs:t.at(-1)}];})),checks,stateUnchanged:state===JSON.stringify(gs)};
 });
 assert.deepEqual(errors,[]);assert(result.stateUnchanged);
 const report={baselineRef,sourceSHA256:{before:createHash('sha256').update(oldSource).digest('hex'),after:createHash('sha256').update(newSource).digest('hex')},...result,errors,limitations:'Direct synchronous terrain CPU benchmark, seed fixture, no natural acquisition/experience or physical GPU FPS claim. Readback only after timing. Synthetic pair matrix 20x20 within 64x64 tiles.'};mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
