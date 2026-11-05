// Short fixture-based UI smoke. This is NOT a new-game or human playtest.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/economy-smoke';await fs.mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem,mkContainer}=await vite.ssrLoadModule('/src/game/engine.ts');
const {serializeSnapshot}=await vite.ssrLoadModule('/src/game/persist.ts');
const now=Date.now(),gs=newGame();dispatch(gs,{id:'fixture-start',type:'startRun',region:0,character:'female',seed:909},now);const r=gs.run;r.creatures=[];
for(const [k,q] of [['wood',15],['stone',10],['scrap',6],['fiber',6],['spares',20],['iron_sword',1],['iron_ingot',3],['mechanical_parts',4]])addItem(r,'inv',k,q);
r.custody.inv.slots.find(s=>s?.key==='iron_sword').dur=0;
r.knowledge.recipes.push('industrial_pick','industrial_axe');
function station(id,type,dx,dy) {const fuel=mkContainer(r,'fuel',3),out=mkContainer(r,'out',6),tx=Math.floor(r.player.x/16)+dx,ty=Math.floor(r.player.y/16)+dy;r.entities[id]={id,kind:'struct',type,tx,ty,x:tx*16+8,y:ty*16+8,hp:40,maxHp:160,station:{fuelC:fuel.id,outC:out.id,burn:0,queue:[]}};}
station('fixture-bench','workbench',1,0);station('fixture-research','research',0,-1);
const snapshot=serializeSnapshot(gs), browser=await chromium.launch({headless:true,args:['--no-sandbox']}),ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});
await ctx.addInitScript(value=>localStorage.setItem('soh.state.v3',value),snapshot);const page=await ctx.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).click();await page.waitForFunction(()=>window.__soh?.run);await page.waitForTimeout(500);
 const continueBtn=page.getByRole('button',{name:'Continue',exact:true});if(await continueBtn.isVisible().catch(()=>false))await continueBtn.click();
 await page.keyboard.press('c');const find=page.getByLabel('Find known recipe');await find.fill('salvager');assert.equal(await find.inputValue(),'salvager');assert(await page.getByText('Salvager Pick',{exact:false}).count()>0);assert(await page.getByText('Salvager Axe',{exact:false}).count()>0);
 await page.waitForTimeout(500);await page.screenshot({path:`${out}/craft-640x360.png`});await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(200);await page.screenshot({path:`${out}/craft-1280x720.png`});
 await page.keyboard.press('Escape');assert(await find.isVisible());
 await page.getByRole('button',{name:/Salvager Pick/}).click();await page.getByText('Ingredients & known sub-recipes',{exact:false}).click();assert(await page.getByText('Known ways to craft',{exact:false}).count()>0);await page.screenshot({path:`${out}/recipe-details-1280x720.png`});await page.getByRole('button',{name:'Close details'}).click();
 await page.keyboard.press('Escape');await page.keyboard.press('r');const research=page.locator('.panel').filter({hasText:'Directed study'}).first();await research.waitFor();await research.getByText('Directed study',{exact:false}).first().click();const rs=page.getByLabel('Find research recipe');await rs.fill('cart');assert.equal(await rs.inputValue(),'cart');assert(await research.getByRole('button',{name:/Hand Cart/}).count()>0);
 await page.waitForTimeout(400);await page.screenshot({path:`${out}/research-1280x720.png`});await page.setViewportSize({width:640,height:360});await page.waitForTimeout(200);await page.screenshot({path:`${out}/research-640x360.png`});
 await rs.blur();await page.keyboard.press('Escape');await page.mouse.move(340,186);await page.waitForTimeout(300);await page.keyboard.press('e');const bench=page.locator('.panel').filter({hasText:'Equipment maintenance'}).first();await bench.waitFor();await bench.locator('summary').click();const row=bench.getByText('Iron Sword',{exact:false}).locator('xpath=..');await row.getByRole('button',{name:'Repair'}).click();assert.equal(await page.evaluate(()=>window.__soh.run.custody.inv.slots.find(s=>s?.key==='iron_sword').dur),350);
 await page.screenshot({path:`${out}/repaired-640x360.png`});await page.keyboard.press('Escape');await page.keyboard.press('v');await page.mouse.click(340,186);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__soh.run.entities['fixture-bench'].hp),80);
 assert.deepEqual(errors,[]);console.log('PASS fixture UI: craft/research searches, no keyboard shortcut leakage; broken sword repair and structure repair; screenshots at both sizes.');
} finally {await browser.close();await vite.close();}
