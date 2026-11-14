// PA1 P1 — the recovered research screen must be reachable and legible in the SHIPPED UI.
//
// Method: real Title-screen clicks into the ISOLATED QA sandbox (the `research_access` preset — one
// authorized Research Table on free ground beside the spawn, and it never touches production saves), then
// real movement keys plus the real E hotkey until the on-screen interaction prompt names that table. Nothing is injected: the driver only reads the DOM and the prompt the player can see.
// Why this exists: `web/tests/pa1-recipe-migration.test.ts` proves the family ledger in the store, and a
// green store test would also be green if the panel had no way in. This file is the "the player can
// actually open it" half, and it is what turns `research.open` from an aspiration into an assertion.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/pa1-research-visible';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],attempts:0,prompt:'',inputAlive:null,research:{open:false,tabClicked:false,families:[],frames1280:[],frames640:[],purchaseControls:null,leakCheck:[]},hotbarSlotUsed:null,errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console:'+m.text());});
async function shot(name){const path=name+'.png';await page.screenshot({path:out+'/'+path,animations:'disabled'});rec.screenshots.push(path);}
const panel=()=>page.getByTestId('research-tab-families');            // the console's own control: proof it is open
const pane=()=>page.getByTestId('research-family-pane');              // the Technology tab's body
const famText=()=>page.getByText('Technology families',{exact:true}); // what the pane is headed by

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
  await page.getByTestId('qa-preset-research_access').click();
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

  // How this reaches the table: the preset this gate launches (`research_access`) places ONE Research
  // Table within a tile of the spot directly south of the spawn, on free ground, with nothing else placed
  // near the player. That matters because `findInteract` (src/game/sim.ts) keeps only the NEAREST
  // interactable inside 30 px of a point 6 px ahead of the aim: in the dense `industry` compound every
  // tile that can see the table can also see the refinery at 16 px, so the prompt can never name the
  // table there — three earlier revisions of this driver learned that the hard way (144 taps on "Use Oil
  // Refinery", then 336 across a machine column). On free ground the table is unavoidably the nearest
  // machine, so the walk is an orbit, not a tie to win: probe, nudge one tile, probe again, and press E
  // only when the prompt the player can actually SEE names the table. The mouse is rotated through 8
  // compass headings at every spot because that 6 px aim offset is the only lever on proximity.
  const TILE=230;                              // about one tile at the shipped 72 px/s
  const CX=640, CY=360;                        // the camera centers the player in a 1280x720 stage
  const RING=[[24,0],[0,24],[-24,0],[0,-24],[17,17],[-17,17],[17,-17],[-17,-17]];
  const ORBIT=['s','d','w','a'];               // a net-zero shuffle around the spawn band
  async function hold(key,ms){ await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(90); }
  const aimAt=async(dx,dy)=>{ await page.mouse.move(CX+dx,CY+dy); await page.waitForTimeout(45); };
  const labelCounts=new Map();
  const note=(label)=>{ if(!label) return; labelCounts.set(label,(labelCounts.get(label)??0)+1); };
  rec.labels=[];
  // `E` is not unconditionally "use": Game.tsx gives the key to the active stack first — `case 'KeyQ':
  // case 'KeyE'` arms a Creator Core's Refined/Signature skill when the hotbar item is a Core, and only
  // `else if (!ITEMS[active]?.creatorCore && !panel) interact()` reaches the station. The QA presets equip
  // full gear, so a Core sits on the bar and a bare `e` at the table arms a skill instead of opening the
  // panel (28 probes, one label, no panel: that is what the last run recorded). So the driver does what a
  // player does: pick a slot that is not a Core, then press `e`, and cancel any skill the attempt armed.
  async function openWithAnySlot(){
    for(const slot of ['1','2','3','4','5','6','7','8']){
      await page.keyboard.press(slot);
      await page.waitForTimeout(70);
      await page.keyboard.press('e');
      await page.waitForTimeout(320);
      if(await panel().count()>0){ rec.hotbarSlotUsed=slot; return true; }
      await page.mouse.click(CX,CY,{button:'right'});   // the right-button cancel the engine offers for an armed aim
      await page.waitForTimeout(90);
    }
    return false;
  }
  async function tryOpen(tag){
    for(const [dx,dy] of RING){
      rec.attempts++;
      await aimAt(dx,dy);
      const label=await labelOf(); rec.prompt=label; note(label);
      if(/research/i.test(label)){
        if(await openWithAnySlot()){ rec.lastOpenedFrom=tag+'('+dx+','+dy+')'; rec.lastOpenedLabel=label; return true; }
        if(rec.labels.length<40) rec.labels.push(tag+'('+dx+','+dy+')=e on all 8 slots, no panel: '+label);
      }
    }
    return false;
  }
  // A launch-time crash used to cost 224 blind taps before anyone saw it: the fixture only has to be
  // legible about that, so a page error right after launch fails here, with the error, not later.
  assert.equal(rec.errors.length,0,'the run errored on launch, so no prompt could ever appear: '+JSON.stringify(rec.errors.slice(0,3)));
  let opened=false;
  for(let i=0;i<28 && !opened;i++){
    opened=await tryOpen('probe'+i);
    if(opened) break;
    await hold(ORBIT[i%4],i<4?TILE:Math.round(TILE*0.7));   // first lap walks into the band, then it circles inside it
  }
  rec.research.open=opened;
  rec.distinctLabels=[...labelCounts.entries()].map(([l,n])=>n+'x '+l).slice(0,12);
  if(!opened){
    // The walk did not reach the panel. Only now is it worth perturbing the player: the liveness probe
    // holds `w` for over a second, so it runs after the orbit, when it can only add information about
    // whether this pinned build ticks at all. It must NEVER run on success — with the console open the
    // engine deliberately ignores movement keys (`!panelRef` gates them), so a probe that reports
    // "input dead" after a panel opened is measuring the panel, not the build. That exact ordering bug
    // turned a passing run into a failure: hotbarSlotUsed "1", lastOpenedFrom "probe0(17,17)",
    // research.open still false, because the throw came before the assignment.
    const probeMoved=await inputAlive();
    rec.postMortem={inputAlive:probeMoved,camBefore:rec.camBefore,camAfter:await camPos()};
    assert.ok(probeMoved,'the run is not reading world input in this pinned build: a held `w` moved the camera by less than 4 px, so no walk can reach the table');
  }
  assert.ok(opened,'the Research Table never became usable from the real UI; last target '+JSON.stringify(rec.prompt)+' after '+rec.attempts+' taps; saw '+JSON.stringify(rec.labels));
  await shot('01-research-panel-1280');

  // --- the Technology tab: clicked, not assumed -----------------------------------------------
  // DOM presence and innerText() do not prove legibility, so every check below measures the painted box:
  // the heading and the ENERGY row must be inside the viewport, on top of the family pane, at both the
  // desktop and the shipped minimum size. The other two research views are clicked too, because the tab
  // must not have eaten Blueprints or Specimens/Core study on the way in.
  const famTab=page.getByTestId('research-tab-families');
  await famTab.click();
  await page.waitForTimeout(320);
  rec.research.tabClicked=true;
  async function inFrame(locator,label,vp){
    const box=await locator.boundingBox();
    assert.ok(box,label+' has no bounding box: it is not painted on screen');
    const visible=await locator.isVisible();
    const fits=box.x>=-0.5 && box.y>=-0.5 && box.width>0 && box.height>0
      && box.x+box.width<=vp.width+0.5 && box.y+box.height<=vp.height+0.5;
    const hitTest=await page.evaluate(([cx,cy,sel])=>{
      const el=document.elementFromPoint(cx,cy); const pane=document.querySelector(sel);
      if(!el) return 'nothing-at-point';
      if(!pane) return 'no-pane';
      return pane.contains(el) ? 'inside-pane' : 'covered-by:'+el.tagName+'.'+String(el.className&&el.className.toString?el.className.toString():'');
    },[box.x+box.width/2,box.y+Math.min(box.height/2,10),'[data-testid="research-family-pane"]']);
    const recd={label,box:{x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.width),h:Math.round(box.height)},visible,fits,hitTest};
    assert.ok(visible,recd.label+' is not visible (hidden or zero-opacity)');
    assert.ok(fits,recd.label+' is outside the '+vp.width+'x'+vp.height+' viewport: '+JSON.stringify(recd.box));
    assert.equal(hitTest,'inside-pane',recd.label+' is not the thing the player would hit at that point');
    return recd;
  }
  const vp1280=page.viewportSize();
  rec.research.frames1280=[
    await inFrame(famText(),'Technology families heading',vp1280),
    await inFrame(page.getByTestId('family-row-ENERGY'),'ENERGY family row',vp1280),
  ];
  await shot('02-technology-families-1280');

  const box=pane();
  const text=(await box.innerText()).replace(/\s+/g,' ').trim();
  rec.research.text=text.slice(0,3000);
  rec.research.headingPainted=/TECHNOLOGY FAMILIES/i.test(text);
  assert.ok(rec.research.headingPainted,'the pane has no visible heading: '+text.slice(0,160));
  // The recovered ledger, in the player's own words: all eleven family names, the one price the paper
  // authorises, and the honest status of a family whose enforcement has not been approved.
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
  // Nothing may offer a purchase the ledger has not authorised, and no source commentary may be painted.
  // The buy control lives INSIDE a family row, so the row itself is what gets counted: a page-wide
  // getByRole('button',{name:...}) for a label this code never renders would pass forever and prove nothing.
  rec.research.purchaseControls={
    energyRow:await page.getByTestId('family-row-ENERGY').getByRole('button').count(),
    pane:await page.getByTestId('research-family-pane').getByRole('button').count(),
  };
  assert.equal(rec.research.purchaseControls.energyRow,0,'the unapproved ENERGY family must not present a buy control: '+JSON.stringify(rec.research.purchaseControls));
  assert.equal(rec.research.purchaseControls.pane,0,'the family pane must be readable text, not a shop: '+JSON.stringify(rec.research.purchaseControls));
  // Source commentary is a whole-console problem, not a pane problem — the leaked `//` lines sat in the
  // Blueprints column — so every tab's painted text runs through this check, and a failure names the tab.
  const leakFree=(t,label)=>{
    const bad=/\/\/|\bTODO\b|ContainerPanel|ResearchBody|StationConsole|ResearchFamilies|\bapi\.gs\b/.exec(t);
    if(bad)throw new Error('source text leaked into the '+label+' view of the shipped console ('+bad[0]+'): '+t.slice(0,300));
    return {label,chars:t.length,leak:null};
  };
  rec.research.leakCheck.push(leakFree(text,'Technology'));

  // The other two research views must still be reachable from the same console.
  const tabText=async(name)=>{
    await page.getByRole('button',{name:new RegExp('^'+name+'$')}).first().click();
    await page.waitForTimeout(260);
    return (await page.locator('.station-console').first().innerText()).replace(/\s+/g,' ').trim();
  };
  rec.research.blueprintsTab=await tabText('Blueprints');
  // Headings are CSS-uppercased (`.console-h{text-transform:uppercase}`) and innerText() returns the
  // transformed text, so section titles are matched case-insensitively. Row copy stays case-exact.
  assert.match(rec.research.blueprintsTab,/Directed study/i,'the Blueprints view lost its directed-study list');
  assert.match(rec.research.blueprintsTab,/Tinker/i,'the Blueprints view lost the random-study control');
  rec.research.leakCheck.push(leakFree(rec.research.blueprintsTab,'Blueprints'));
  rec.research.specimensTab=await tabText('Specimens & Cores');
  assert.match(rec.research.specimensTab,/Specimen \/ Core study/i,'the Specimens & Cores view lost its heading');
  rec.research.leakCheck.push(leakFree(rec.research.specimensTab,'Specimens & Cores'));
  await famTab.click(); await page.waitForTimeout(280);   // back to the ledger for the small-viewport shot
  assert.ok((await pane().count())>0,'the Technology tab did not re-open after visiting the other views');

  // And it must stay legible on the shipped minimum viewport, not only on a desktop.
  await page.setViewportSize({width:640,height:360});
  await page.waitForTimeout(400);
  const vp640=page.viewportSize();
  assert.ok((await famText().count())>0,'the family list vanished at 640x360');
  rec.research.frames640=[
    await inFrame(famText(),'Technology families heading @640',vp640),
    await inFrame(page.getByTestId('family-row-ENERGY'),'ENERGY family row @640',vp640),
  ];
  await shot('03-technology-families-640');
  const count=await page.getByTestId(/^family-row-/).count();
  rec.research.familyRows=count;
  assert.ok(count>=11,'the Technology pane listed only '+count+' of the 11 recovered families');
  assert.equal(rec.errors.length,0,'Browser console/page errors: '+JSON.stringify(rec.errors.slice(0,3)));
  rec.status='PASS_BROWSER_UI';
}catch(e){rec.status='FAIL';rec.failure=String(e);try{await shot('FAIL')}catch{}}
finally{
  await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
  console.log('PA1_RESEARCH_VISIBLE '+JSON.stringify({status:rec.status,sha:rec.sha,research:{open:rec.research.open,families:rec.research.families,energyRow:rec.research.energyRow},attempts:rec.attempts,errors:rec.errors.slice(0,2),failure:rec.failure}));
  await context.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_UI')process.exitCode=1;
