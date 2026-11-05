// Visual/interaction smoke only: an injected fixture supplies a workbench and items.
// It is NOT a legitimate New Game journey or evidence of normal source reachability.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out='evidence/progression-fixture';await fs.mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,mkContainer}=await vite.ssrLoadModule('/src/game/engine.ts');
const {serializeSnapshot}=await vite.ssrLoadModule('/src/game/persist.ts');
const now=Date.now(),gs=newGame();dispatch(gs,{id:'visual-fixture-start',type:'startRun',region:0,character:'female',seed:101},now);const r=gs.run;
for(const [key,qty] of [['iron_sword',1],['iron_ingot',3],['mechanical_parts',4],['wood',5],['fiber',5],['scrap',5]])addItem(r,'inv',key,qty);
const sword=r.custody.inv.slots.find(s=>s?.key==='iron_sword');sword.dur=127;
const fuel=mkContainer(r,'fuel',3),output=mkContainer(r,'out',6),tx=Math.floor(r.player.x/16)+1,ty=Math.floor(r.player.y/16);
const bench={id:'fixture-bench',kind:'struct',type:'workbench',tx,ty,x:tx*16+8,y:ty*16+8,hp:160,maxHp:160,station:{fuelC:fuel.id,outC:output.id,burn:0,queue:[]}};r.entities[bench.id]=bench;
const snapshot=serializeSnapshot(gs);const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const ctx=await browser.newContext({viewport:{width:640,height:360}});
await ctx.addInitScript(value=>localStorage.setItem('soh.state.v3',value),snapshot);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).click();await page.waitForFunction(()=>window.__soh?.run);await page.waitForTimeout(600);
 const continueBtn=page.getByRole('button',{name:'Continue',exact:true});if(await continueBtn.isVisible().catch(()=>false))await continueBtn.click();
 // Aim east and open station using ordinary mouse and E.
 await page.mouse.move(340,186);await page.waitForTimeout(300);await page.keyboard.press('e');await page.waitForTimeout(400);
 const panel=page.locator('.panel').filter({hasText:'Equipment maintenance'}).first();await panel.waitFor({timeout:5000});await panel.locator('summary').click();await page.waitForTimeout(200);
 await page.screenshot({path:`${out}/workbench-640x360.png`});await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(300);await page.screenshot({path:`${out}/workbench-1280x720.png`});
 const row=panel.getByText('Iron Sword',{exact:false}).locator('xpath=..');await row.getByRole('button',{name:'Repair'}).click();await page.waitForTimeout(300);
 const repaired=await page.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='iron_sword').dur);if(repaired!==350)throw Error(`repair failed: ${repaired}`);
 await page.screenshot({path:`${out}/repaired-1280x720.png`});await panel.getByRole('button',{name:'Upgrade workbench'}).click();await page.waitForTimeout(300);
 const level=await page.evaluate(()=>Object.values(window.__soh.run.entities).find(e=>e.type==='workbench').station.level);if(level!==2)throw Error(`upgrade failed: ${level}`);
 await page.screenshot({path:`${out}/upgraded-1280x720.png`});if(errors.length)throw Error(errors.join('; '));
 console.log('FIXTURE ONLY: E opened workbench; normal button clicks repaired sword 127->350 and upgraded station 1->2. Screenshots at 640x360 and 1280x720.');
} finally {await browser.close();await vite.close()}
