/** Collision-grid equivalence: HEAD engine.ts vs the optimised working tree, cell by cell.
 * Both module instances share ONE world/engine state, so they see identical inputs.
 * States exercised: pristine, terrain edits (incl. expired), source edits (exhausted/burnt),
 * structures/doors/ladders/loot/airdrops, Veyra ground reset and storey sync.
 * Software dev build; this is a correctness + CPU benchmark, not a physical-GPU FPS claim. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5194';
const out=process.env.SOH_GRID_OUT||'evidence/solo-final-fallback/20261117/frame-work/block-grid-equivalence.json';
const headRef=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const headSource=execFileSync('git',['show',headRef+':web/src/game/engine.ts'],{encoding:'utf8'});
const newSource=readFileSync('src/game/engine.ts','utf8');
mkdirSync('.cache/block-grid-baseline',{recursive:true});
writeFileSync('.cache/block-grid-baseline/engine.ts',headSource
  .replace(/(from\s*['"])\.\/([^'"]+)(['"])/g,(_,a,p,b)=>a+'/src/game/'+p+b)
  .replace(/(from\s*['"])\.\.\/([^'"]+)(['"])/g,(_,a,p,b)=>a+'/src/'+p+b));
const layouts=(process.env.SOH_GRID_LAYOUTS||'shipping,shipping_fresh,dev_delta,veyra05-greywater,veyra05-cinder,veyra05-at-1920-512').split(',');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__grid',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));
 await page.goto(base+'/__grid');
 const report=await page.evaluate(async({layouts})=>{
  const NEW=await import('/src/game/engine.ts'),OLD=await import('/.cache/block-grid-baseline/engine.ts');
  const W=await import('/src/game/world.ts'),C=await import('/src/game/core.ts');
  const WIN=await import('/src/veyra05/window.ts'),FL=await import('/src/veyra05/floors.ts');
  const epoch=Date.UTC(2026,10,17,12),N=C.WW*C.WH,results=[];
  const compare=(label,r,extra)=>{
   OLD.markDirty();NEW.markDirty();
   const a=OLD.blockGrid(r),b=NEW.blockGrid(r);
   if(a.length!==N||b.length!==N)throw Error(`${label}: unexpected grid length ${a.length}/${b.length}`);
   let mismatches=0;const first=[];
   for(let i=0;i<N;i++)if(a[i]!==b[i]){mismatches++;if(first.length<8)first.push({i,tx:i%C.WW,ty:(i/C.WW)|0,head:a[i],optimised:b[i]});}
   return {label,cells:N,mismatches,first,...(extra||{})};
  };
  for(const layout of layouts){
   if(!W.setActiveLayout(layout)){results.push({layout,status:'layout-unavailable'});continue;}
   const gs=NEW.newGame();let started=null;
   for(const seed of [901,902,903,1234,7,424242]){started=NEW.startRun(gs,'female',epoch,null,seed);if(started.ok)break;}
   if(!started?.ok){results.push({layout,status:'start-failed',reason:JSON.stringify(started)});continue;}
   const r=gs.run;
   // startRun may canonicalise the requested id (e.g. `shipping` -> `shipping_fresh`); both module
   // instances read the SAME run, so compare on the actual layout and record the substitution.
   const entry={layout,requestedLayout:layout,actualLayout:r.layoutId,seed:r.seed,version:r.sourceLayoutVersion,statics:W.getWorld().statics.length,checks:[]};
   if(!W.setActiveLayout(r.layoutId)){results.push({layout,status:'actual-layout-unavailable',actual:r.layoutId});continue;}
   // A veyra05-* request must not silently come back as a non-veyra run: that means the engine
   // module instance is not the one this harness is driving (stale HMR graph), which would make
   // every check below vacuous. Fail loudly instead of writing green evidence.
   if(layout.startsWith('veyra05')&&!String(r.layoutId).startsWith('veyra05'))throw Error(`module-identity failure: requested ${layout} but the run started on ${r.layoutId}`);
   // Canary: a tile written through the harness's world module must be visible to the engine.
   {
    const wCanary=W.getWorld(),ci=5*C.WW+5,keep=wCanary.tiles[ci];
    wCanary.tiles[ci]=keep===C.T.PWALL?C.T.FLOOR:C.T.PWALL;NEW.markDirty();OLD.markDirty();
    const seenNew=NEW.effTile(r,5,5),seenOld=OLD.effTile(r,5,5);
    wCanary.tiles[ci]=keep;NEW.markDirty();OLD.markDirty();
    if(seenNew!==wCanary.tiles[ci]&&seenNew===keep)throw Error(`module-identity failure: optimised engine sees a different world instance (canary ${seenNew} vs ${keep})`);
    if(seenOld!==seenNew)throw Error('module-identity failure: the two engine instances see different worlds');
    entry.canary={written:keep===C.T.PWALL?C.T.FLOOR:C.T.PWALL,seenByBothEngines:seenNew};
   }
   entry.checks.push(compare('pristine',r,{sourceCells:0}));
   // deterministic terrain edits, including an expired and a future-timed entry
   const edited=[];for(let i=0;i<N;i+=199){const t=[C.T.PWALL,C.T.FLOOR,C.T.CLIFF,C.T.ICE,C.T.SHALLOW,C.T.GRASS][edited.length%6];r.terrain[i]={t};edited.push(i);}
   r.terrain[edited[1]]={t:C.T.PWALL,until:1};                     // expired legacy timer
   r.terrain[edited[2]]={t:C.T.FLOOR,untilAt:epoch+3_600_000};     // live absolute timer
   r.terrain[edited[3]]={t:C.T.LAVA,untilAt:epoch-1};              // expired absolute timer
   entry.checks.push(compare('terrain-edits',r,{terrainCells:edited.length}));
   // source edits: exhaust, burn and damage real sources
   const srcCells=[];for(let i=0;i<N&&srcCells.length<60;i++){const tx=i%C.WW,ty=(i/C.WW)|0;const s=NEW.sourceAt(r,tx,ty);if(!s)continue;srcCells.push({i,key:s.key});}
   srcCells.forEach((c,n)=>{r.sources[c.i]=n%5===0?{stock:0,hp:0,uid:'grid-'+n}:n%5===1?{stock:0,hp:1,burnt:true,uid:'grid-'+n}:{stock:1,hp:2,uid:'grid-'+n};});
   entry.checks.push(compare('source-edits',r,{sourceCells:srcCells.length,keys:[...new Set(srcCells.map(c=>c.key))]}));
   for(const c of srcCells)delete r.sources[c.i];
   // structures: blocking wall, open/closed doors on authored door tiles, ladder, loot, airdrop
   const w=W.getWorld(),ents=[];let n=0;
   const put=e=>{e.id='grid-e'+(n++);e.x=(e.tx*C.TILE)+8;e.y=(e.ty*C.TILE)+8;e.hp=e.hp??100;e.maxHp=e.maxHp??100;e.born=epoch;r.entities[e.id]=e;ents.push(e.id);};
   for(let i=0;i<N&&ents.length<3;i+=997){const tx=i%C.WW,ty=(i/C.WW)|0;if(w.tiles[i]===C.T.GRASS)put({kind:'struct',type:'wall_wood',tx,ty});}
   const doors=w.statics.filter(s=>s.kind==='door').slice(0,4);
   doors.forEach((d,k)=>put({kind:'door',type:'door_wood',tx:d.tx,ty:d.ty,open:k%2===0}));
   const cliff=[];for(let i=0;i<N&&cliff.length<2;i+=613)if(w.tiles[i]===C.T.CLIFF)cliff.push(i);
   for(const i of cliff)put({kind:'struct',type:'wall_wood',tx:i%C.WW,ty:(i/C.WW)|0,ladder:{len:3,dir:[0,1]},hp:80});
   for(let i=0;i<N&&ents.length<12;i+=3011){const tx=i%C.WW,ty=(i/C.WW)|0;put({kind:'loot',tx,ty});put({kind:'airdrop',tx:(tx+1)%C.WW,ty,airdrop:{phase:'locked'}});}
   entry.checks.push(compare('entities',r,{entities:ents.length,doorStatics:doors.length,ladders:cliff.length}));
   // Veyra world-content rewrites: ground reset and storey sync both replace the arrays in place
   if(r.layoutId.startsWith('veyra05')){
    const ww=WIN.getWindowWorld(r.layoutId);
    WIN.resetWindowToGround(ww);
    entry.checks.push(compare('after-ground-reset',r,{revisionBumped:true}));
    if(ww.floors.layers.size>1){
     const target=[...ww.floors.layers.keys()].find(l=>l!==FL.activeFloor(r));
     if(target!==undefined){FL.applyFloor(gs,ww,ww.floors,target);entry.checks.push(compare('after-storey-switch',r,{floor:FL.activeFloor(r),layers:ww.floors.layers.size}));}
    }
    FL.syncFloor(gs,ww,ww.floors,NEW.markDirty);
    entry.checks.push(compare('after-floor-sync',r,{floor:FL.activeFloor(r)}));
   }
   // In-place world content rewrites invalidated by markDirty() alone: the exact staleness class a
   // content-keyed cache would miss (sanctuary wall writes, multi-tile prop footprint writes).
   {
    const w2=W.getWorld(),tilesBackup=w2.tiles.slice(),walkBackup=w2.economyMap.walkable.slice();
    let hits=0;for(let i=0;i<N&&hits<200;i+=373){w2.tiles[i]=C.T.PWALL;w2.economyMap.walkable[i]=0;hits++;}
    entry.checks.push(compare('tiles-rewritten-in-place',r,{rewrittenCells:hits}));
    w2.tiles.set(tilesBackup);w2.economyMap.walkable.set(walkBackup);
    entry.checks.push(compare('tiles-restored-in-place',r,{rewrittenCells:hits}));
    if(r.layoutId.startsWith('veyra05')){
     const ww2=WIN.getWindowWorld(r.layoutId);
     const layer=ww2.floors.layers.get(FL.activeFloor(r))??ww2.floors.ground;
     const propBackup=layer.solidProps.slice();let props=0;
     for(let i=0;i<N&&props<300;i+=509){layer.solidProps[i]=1;props++;}
     entry.checks.push(compare('solid-props-rewritten-in-place',r,{propCells:props}));
     layer.solidProps.set(propBackup);
     entry.checks.push(compare('solid-props-restored-in-place',r,{propCells:props}));
    }
   }
   for(const id of ents)delete r.entities[id];
   for(const i of edited)delete r.terrain[i];
   entry.checks.push(compare('restored',r));
   // rebuild cost, alternating HEAD/optimised on the restored state
   const rounds=[];
   for(let rep=0;rep<6;rep++)for(const which of ['head','optimised']){const mod=which==='head'?OLD:NEW;mod.markDirty();const t=performance.now();mod.blockGrid(r);rounds.push({which,ms:performance.now()-t});}
   const agg=which=>{const t=rounds.filter(x=>x.which===which).map(x=>x.ms).sort((a,b)=>a-b);return {rounds:t.length,medianMs:t[t.length>>1],minMs:t[0],maxMs:t.at(-1)};};
   entry.rebuild={head:agg('head'),optimised:agg('optimised')};
   entry.status='compared';results.push(entry);
  }
  return {results};
 },{layouts});
 assert.deepEqual(errors,[],'page errors');
 const bad=report.results.flatMap(e=>(e.checks||[]).filter(c=>c.mismatches>0).map(c=>({layout:e.layout,...c})));
 const summary=report.results.map(e=>({layout:e.layout,status:e.status,version:e.version,statics:e.statics,checks:(e.checks||[]).length,mismatches:(e.checks||[]).reduce((n,c)=>n+c.mismatches,0),rebuild:e.rebuild}));
 const payload={headRef,sourceSHA256:{head:createHash('sha256').update(headSource).digest('hex'),optimised:createHash('sha256').update(newSource).digest('hex')},layouts,summary,mismatchingChecks:bad,detail:report.results,errors,limitations:'Two module instances of engine.ts (HEAD from git, optimised from the working tree) sharing one world/run state in a dev browser. Cell-by-cell equality of blockGrid plus synchronous rebuild timing. Software GPU; no physical-GPU FPS, natural-acquisition or experience claim.'};
 mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
 console.log(JSON.stringify({summary,mismatchingChecks:bad,errors},null,1));
 assert.deepEqual(bad,[],'collision grid must be cell-identical to HEAD');
}finally{await browser.close();}
