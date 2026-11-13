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
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],attempts:0,prompt:'',inputAlive:null,research:{open:false},errors:[]};
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
  // Headless pages can be treated as backgrounded, which starves requestAnimationFrame — and the sim,
  // including player movement, only advances inside that loop. Bring the tab forward and hand focus to
  // the stage the way a click would, or every key tap below is delivered to a page that never ticks.
  await page.bringToFront();
  // Movement and E are ignored while ANY panel owns the screen (Game.tsx gates both on `!panelRef`), and
  // a blind Escape on a clear screen OPENS the pause menu — which then swallows every keystroke, which is
  // exactly how the first two sweeps of this gate burned 400 and 144 taps on one frozen target. So no
  // Escape guessing: click the affordance the overlay itself offers, repeatedly, until none is on screen.
  const menuUp=async()=>(await page.getByRole('button',{name:'Resume',exact:true}).count())>0;
  // Whatever owns the screen at launch — the QA launch report, a return digest, an experience modal or
  // the pause menu — has a close/Resume affordance. Click it instead of guessing at Escape: one blind
  // Escape on a clear screen OPENS the pause menu, which then swallows every movement key.
  rec.launchedWithPanel=await menuUp();
  for(let i=0;i<4;i++){
    const closer=page.locator('button:has-text("Resume"), button:has-text("Continue"), button:has-text("Dismiss"), button:has-text("Close")').first();
    if(await closer.count()===0) break;
    await closer.click({timeout:1500}).catch(()=>{});
    await page.waitForTimeout(260);
    rec.launchedWithPanel=true;
  }
  // The QA launch opens the Visual QA Lab drawer as well (Game.tsx: `useState(qaOpen, qaMode)`). The
  // drawer does not gate `panelRef`, but it does cover the left half of the stage, so close it with the
  // player's own [F9] toggle and record that we did — "which overlay owned the screen" is the difference
  // between a stuck walk and a run that ignores keys, and this line is what tells the next reader.
  rec.qaDrawerToggledWithF9=true;
  await page.keyboard.press('F9');
  await page.waitForTimeout(250);
  rec.menuStillUp=await menuUp();
  assert.ok(!rec.menuStillUp,'the pause menu refused to close, so no world input would be read');
  // Now that the screen is clear, hand focus to the stage exactly as a player's click would (it also
  // primes audio). If something still covers the canvas the click is refused, which is not fatal.
  await page.locator('canvas').first().click({position:{x:640,y:360},timeout:2500}).catch(()=>{});
  await page.waitForTimeout(400);

  const camPos=async()=>{
    try{ const v=await page.evaluate(()=>typeof window.__sohView==='function'?window.__sohView():null);
      if(v&&v.cam&&Number.isFinite(v.cam.x)) return {x:v.cam.x,y:v.cam.y}; }catch{}
    return null;
  };
  async function inputAlive(){
    const before=rec.camBefore ?? await camPos();
    await page.keyboard.down('w'); await page.waitForTimeout(1300); await page.keyboard.up('w');
    await page.waitForTimeout(250);
    const after=await camPos();
    if(before&&after) return Math.hypot(after.x-before.x,after.y-before.y)>4;   // the camera follows the player, so a real step moves it
    const clip={x:Math.round(1280/2-90),y:Math.round(720/2-70),width:180,height:140};
    const a=await page.screenshot({clip});
    await page.keyboard.down('w'); await page.waitForTimeout(1300); await page.keyboard.up('w');
    await page.waitForTimeout(200);
    return Buffer.compare(a,await page.screenshot({clip}))!==0;
  }
  rec.camBefore=await camPos();
  await shot('00-qa-industry-spawn');

  // Where the prompt can name the table at all. `findInteract` (src/game/sim.ts) keeps the NEAREST
  // interactable within 30 px of a point 6 px ahead of the player's aim, and the `industry` preset plants
  // its machine column one tile east of the spawn: workbench (bx+5,by), furnace (bx+5,by+1), refinery
  // (bx+5,by+2), Research Table (bx+5,by+3), player at (bx+4,by+2). From the spawn the refinery is 16 px
  // away and the table 22.6 px, so standing on the machine line the table can NEVER win the prompt — the
  // first sweep walked a 12x12 field on that row and named the refinery 144 times. South of the line the
  // machines fall out of the 30 px reach one by one and the table is what remains: at (bx+4,by+4) the
  // table is 22.6 px, the refinery 35.8 px and the farm controller 35.8 px, so the table is the ONLY
  // thing the prompt can name. That is a real player's maneuver — walk around the machine line and come
  // at the table from the open ground below it — so the driver walks south one tile at a time, probing
  // the spawn column and one tile either side at each row, and rotates the mouse through 8 compass
  // headings at every spot because that 6 px aim offset is the only lever on an equal-distance tie.
  // `e` is pressed only when the prompt the player can actually SEE names the table; a second, rougher
  // pass presses `e` at any station, in case the shipped wording differs from the match below, and closes
  // whatever console that opens.
  const TILE=230;                              // about one tile at the shipped 72 px/s
  const CX=640, CY=360;                        // the camera centers the player in a 1280x720 stage
  const RING=[[24,0],[0,24],[-24,0],[0,-24],[17,17],[-17,17],[17,-17],[-17,-17]];
  async function hold(key,ms){ await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(90); }
  const aimAt=async(dx,dy)=>{ await page.mouse.move(CX+dx,CY+dy); await page.waitForTimeout(45); };
  const labelCounts=new Map();
  const note=(label)=>{ if(!label) return; labelCounts.set(label,(labelCounts.get(label)??0)+1); };
  async function closePanel(){
    const x=page.getByRole('button',{name:/^(x|\u00d7|\u2715|close)$/i}).first();
    if(await x.count()){ await x.click({timeout:1200}).catch(()=>{}); await page.waitForTimeout(180); return; }
    await page.keyboard.press('Escape'); await page.waitForTimeout(180);
    if(await menuUp()){ const r=page.getByRole('button',{name:'Resume',exact:true}).first(); if(await r.count()) await r.click({timeout:1200}).catch(()=>{}); await page.waitForTimeout(180); }
  }
  async function tryOpen(tag,reckless){
    let best='';
    for(const [dx,dy] of RING){
      rec.attempts++;
      await aimAt(dx,dy);
      const label=await labelOf(); rec.prompt=label; note(label);
      if(!label) continue; best=label;
      if(/research/i.test(label) || (reckless && /use |open /i.test(label))){
        await page.keyboard.press('e');
        await page.waitForTimeout(330);
        if(await panel().count()>0){ rec.lastOpenedFrom=tag+'('+dx+','+dy+')'; rec.lastOpenedLabel=label; return true; }
        if(reckless) await closePanel();
      }
    }
    if(best && rec.labels.length<40) rec.labels.push(tag+'='+best);
    return false;
  }
  rec.labels=[];
  let opened=false;
  const rough=(mode)=>mode==='any';
  for(const mode of ['named','any']){
    for(let row=0;row<7 && !opened;row++){
      const tag=mode+'@'+row;
      // center column -> one east -> one west (back through center) -> one row south
      opened=await tryOpen(tag+',0',rough(mode));
      if(!opened){ await hold('d',TILE); opened=await tryOpen(tag+',E',rough(mode)); }
      if(!opened){ await hold('a',TILE); await hold('a',TILE); opened=await tryOpen(tag+',W',rough(mode)); }
      if(!opened){ await hold('d',TILE); await hold('s',TILE); }
    }
    if(!opened){ for(let k=0;k<7;k++) await hold('w',TILE); }        // walk home for the second pass
  }
  rec.distinctLabels=[...labelCounts.entries()].map(([l,n])=>n+'x '+l).slice(0,12);
  // The sweep did not reach the panel. Only now is it worth perturbing the player: the liveness probe
  // holds `w` for over a second, and doing that before the walk moves the spawn off the tile the whole
  // grid plan depends on. Here it can only help: it says whether the run ticks at all.
  const probeMoved=await inputAlive();
  rec.postMortem={inputAlive:probeMoved,camBefore:rec.camBefore,camAfter:await camPos()};
  assert.ok(probeMoved,'the run is not reading world input in this pinned build: a held `w` moved the camera by less than 4 px, so no walk can reach the table');
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
