// PA1 P1 — the recovered research screen must be reachable and legible in the SHIPPED UI.
//
// Method: real Title-screen clicks into the ISOLATED Full-Gear QA sandbox (the `industry` preset — it
// builds a real compound with a real Research Table next to the spawn, and never touches production
// saves), then real movement keys plus the real E hotkey until the on-screen interaction prompt names
// that table. Nothing is injected: the driver only reads the DOM and the prompt the player can see.
// Why this exists: `web/tests/pa1-recipe-migration.test.ts` proves the family ledger in the store, and a
// green store test would also be green if the panel had no way in. This file is the "the player can
// actually open it" half, and it is what turns `research.open` from an aspiration into an assertion.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/pa1-research-visible';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],attempts:0,prompt:'',research:{open:false},errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console:'+m.text());});
async function shot(name){const path=name+'.png';await page.screenshot({path:out+'/'+path,animations:'disabled'});rec.screenshots.push(path);}
const panel=()=>page.getByText('Technology families',{exact:true});
const promptText=async()=>{const el=page.locator('.prompt').first();return (await el.count())?(await el.innerText()).replace(/\s+/g,' ').trim():'';};
// The read-only driver view the shipped UI already publishes (camera, stage transform, current target).
// It is the same target the on-screen prompt is naming, so the loop is steered by what the player can see.
const labelOf=async()=>{
  let v=null;
  try { v=await page.evaluate(()=>typeof window.__sohView==='function' ? window.__sohView() : null); } catch { v=null; }
  if(v&&v.target&&v.target.label) return String(v.target.label);
  return await promptText();
};
try{
  const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200);
  await page.getByRole('button',{name:/Full-Gear QA Sandbox/}).click();
  await page.getByTestId('qa-preset-industry').click();
  await page.getByRole('button',{name:'Launch QA Sandbox'}).click();
  await page.waitForSelector('canvas',{timeout:45000});
  await page.waitForTimeout(1200);
  await shot('00-qa-industry-spawn');

  // The `industry` compound is a column: Workbench, Furnace, Refinery and Research Table on one tile
  // line, with the spawn one tile left and one tile up of the table. So a short real tap walks the
  // player to the one free tile beside it; the sweep keeps trying because the neighbouring stations
  // win the tie-break at some offsets. A tile at the shipped 72 px/s is ~240 ms of held key.
  const taps=['s','d','s','a','w','s','d','w','s','d','s','a'];
  let opened=false;
  rec.labels=[];
  for(let round=0;round<8 && !opened;round++){
    for(const key of taps){
      for(let i=0;i<2 && !opened;i++){
        rec.attempts++;
        const label=await labelOf(); rec.prompt=label;
        if(rec.labels.length<24) rec.labels.push(round+':'+key+'='+label);
        if(/research/i.test(label)){
          await page.keyboard.press('e');
          await page.waitForTimeout(260);
          opened=(await panel().count())>0;
          if(opened) break;
        }
        await page.keyboard.down(key); await page.waitForTimeout(240); await page.keyboard.up(key);
        await page.waitForTimeout(120);
      }
      if(opened) break;
    }
  }
  rec.research.open=opened;
  assert.ok(opened,'the Research Table never became usable from the real UI; last target '+JSON.stringify(rec.prompt)+' after '+rec.attempts+' taps; saw '+JSON.stringify(rec.labels));
  await shot('01-research-panel-1280');

  // The recovered ledger, in the player's own words: all eleven family names, the one price the paper
  // authorises, and the honest status of a family whose enforcement has not been approved.
  const box=page.locator('.panel').filter({hasText:'Technology families'}).first();
  const text=(await box.innerText()).replace(/\s+/g,' ').trim();
  rec.research.text=text.slice(0,3000);
  const FAMS=['ENERGY','METALLURGY','MOBILITY','ELECTRICAL','AGRICULTURE','ARMORY','EXPLORATION','ARCANA','STEEL','DEFENSE','CORE_SPECIFIC'];
  const seen=FAMS.filter(f=>new RegExp('\\b'+f+'\\b').test(text));
  const missing=FAMS.filter(f=>!seen.includes(f));
  rec.research.families=seen;
  assert.equal(missing.length,0,'families missing from the shipped panel: '+JSON.stringify(missing));
  const energy=(text.match(/ENERGY\b[\s\S]{0,220}?(?=METALLURGY|MOBILITY|ELECTRICAL|AGRICULTURE|ARMORY|EXPLORATION|ARCANA|STEEL|DEFENSE|CORE_SPECIFIC|$)/)?.[0] ?? '').replace(/\s+/g,' ').trim();
  rec.research.energyRow=energy;
  assert.match(energy,/cost recorded \(5 Spares \+ 2 Iron Ingot\)/,'the recovered ENERGY cost is not shown as a cost the player can read: '+energy);
  assert.match(energy,/9 formulas/,'the ENERGY family does not state its recovered membership (3 plants + 6 fuel-chain formulas): '+energy);
  assert.match(energy,/nothing withheld in this build/,'an unenforced family must say so, not hint at a gate: '+energy);
  assert.ok((text.match(/open design · no authorized cost/g) ?? []).length>=10,'at least ten undecided families must be labelled undecided: '+text.slice(0,600));
  assert.ok(!/ENERGY[^.]{0,120}(Required|locked|buy)/i.test(text),'the panel may not claim the ENERGY study gates anything today: '+energy);

  // And it must stay legible on the shipped minimum viewport, not only on a desktop.
  await page.setViewportSize({width:640,height:360});
  await page.waitForTimeout(300);
  assert.ok((await panel().count())>0,'the family list vanished at 640x360');
  await shot('02-research-panel-640');
  assert.equal(rec.errors.length,0,'Browser console/page errors: '+JSON.stringify(rec.errors.slice(0,3)));
  rec.status='PASS_BROWSER_UI';
}catch(e){rec.status='FAIL';rec.failure=String(e);try{await shot('FAIL')}catch{}}
finally{
  await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
  console.log('PA1_RESEARCH_VISIBLE '+JSON.stringify({status:rec.status,sha:rec.sha,research:{open:rec.research.open,families:rec.research.families,energyRow:rec.research.energyRow},attempts:rec.attempts,errors:rec.errors.slice(0,2),failure:rec.failure}));
  await context.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_UI')process.exitCode=1;
