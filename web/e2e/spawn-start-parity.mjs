/** Does the patched engine start runs on exactly the same layouts/seeds as HEAD?
 * Both engine instances share one world module, so each attempt re-selects the layout first.
 * Outcome parity only (ok + reason + resulting layoutId/player), no timing claim. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5194';
const outFile=process.env.SOH_SPAWN_OUT||'evidence/solo-final-fallback/20261117/frame-work/spawn-start-parity.json';
/** Baseline git ref for before/after harnesses. HEAD moved when the optimisation was committed, so
 * `HEAD` is NO LONGER a pre-patch baseline: these harnesses pin the ref the recorded evidence was
 * measured against and refuse to run a vacuous (byte-identical) comparison. Override with
 * SOH_BASE_REF when a later round needs a new baseline. */
const baseRef=execFileSync('git',['rev-parse',process.env.SOH_BASE_REF||'53c168808e4264c39625ad3bd409211de005dfa7'],{encoding:'utf8'}).trim();
const headRef=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const headSource=execFileSync('git',['show',baseRef+':web/src/game/engine.ts'],{encoding:'utf8'});
if(headSource===readFileSync('src/game/engine.ts','utf8'))throw Error(`vacuous comparison: engine.ts at SOH_BASE_REF ${baseRef} is byte-identical to the working tree; pass a pre-patch ref`);
mkdirSync('.cache/block-grid-baseline',{recursive:true});
writeFileSync('.cache/block-grid-baseline/engine.ts',headSource
  .replace(/(from\s*['\"])\.\/([^'\"]+)(['\"])/g,(_,a,p,b)=>a+'/src/game/'+p+b)
  .replace(/(from\s*['\"])\.\.\/([^'\"]+)(['\"])/g,(_,a,p,b)=>a+'/src/'+p+b));
const layouts=(process.env.SOH_SPAWN_LAYOUTS||'veyra05-slag,veyra05-cinder,veyra05-greywater,shipping').split(',');
const seeds=(process.env.SOH_SPAWN_SEEDS||'901,902,903,1234,7,424242').split(',').map(Number);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const out={baseRef,headRef,layouts,seeds,rows:[],errors:[]};
try{
 const page=await browser.newPage();page.setDefaultTimeout(300000);page.on('pageerror',e=>out.errors.push(e.message));
 await page.route('**/__spawn',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));
 await page.goto(base+'/__spawn');
 out.rows=await page.evaluate(async({layouts,seeds})=>{
  const NEW=await import('/src/game/engine.ts'),OLD=await import('/.cache/block-grid-baseline/engine.ts'),W=await import('/src/game/world.ts');
  const epoch=Date.UTC(2026,10,17,12),rows=[];
  for(const layout of layouts)for(const seed of seeds){
   const attempt={layout,seed};
   for(const [tag,mod] of [['head',OLD],['optimised',NEW]]){
    W.setActiveLayout(layout);mod.markDirty();
    const gs=mod.newGame();let res=null,err=null;
    try{res=mod.startRun(gs,'female',epoch,null,seed);}catch(e){err=String(e);}
    attempt[tag]=err?{threw:err}:{ok:!!res?.ok,reason:res?.reason??null,layoutId:gs.run?.layoutId??null,
      player:gs.run?[Math.round(gs.run.player.x),Math.round(gs.run.player.y)]:null,version:gs.run?.sourceLayoutVersion??null};
    if(gs.run){gs.run.ended={at:epoch,reason:'parity probe cleanup'};}
    W.setActiveLayout('shipping');mod.markDirty();
   }
   attempt.same=JSON.stringify(attempt.head)===JSON.stringify(attempt.optimised);
   rows.push(attempt);
  }
  return rows;
 },{layouts,seeds});
 assert.deepEqual(out.errors,[],'page errors');
 const diverged=out.rows.filter(r=>!r.same);
 out.diverged=diverged;
 out.summary={attempts:out.rows.length,identical:out.rows.length-diverged.length,diverged:diverged.length,
  startOk:{head:out.rows.filter(r=>r.head.ok).length,optimised:out.rows.filter(r=>r.optimised.ok).length}};
 writeFileSync(outFile,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify(out.summary,null,1));
 for(const r of out.rows)console.log(r.layout,r.seed,'head',r.head.ok??r.head.threw,r.head.reason??'','| opt',r.optimised.ok??r.optimised.threw,r.optimised.reason??'','| same',r.same);
 assert.deepEqual(diverged,[],'HEAD and optimised engines must agree on every startRun outcome');
}finally{await browser.close();}
