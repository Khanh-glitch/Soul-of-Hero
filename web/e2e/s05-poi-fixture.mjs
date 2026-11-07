// Controlled proximity and inventory fixtures. Genuine browser inputs only after
// Continue; not evidence of natural acquisition, complete dungeon travel or Map acceptance.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='evidence/s05-poi-fixture';await mkdir(dir,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,addItem}=await vite.ssrLoadModule('/src/game/engine.ts');
const {setActiveLayout}=await vite.ssrLoadModule('/src/game/world.ts');
const {serializeSnapshot}=await vite.ssrLoadModule('/src/game/persist.ts');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']}),report=[];
try {
 for(const mode of ['card','generator']){
  setActiveLayout('shipping_fresh');const now=Date.now(),g=newGame();assert(dispatch(g,{id:'fixture-start',type:'startRun',character:'female',seed:99},now).ok);const r=g.run;r.creatures=[];
  const e=Object.values(r.entities).find(e=>e.kind===(mode==='card'?'door':'gen')&&e.poi===(mode==='card'?'factory':'light'));
  r.player.x=e.x+(mode==='generator'?16:0);r.player.y=e.y+(mode==='card'?20:0);r.player.aim=mode==='card'?-Math.PI/2:Math.PI;
  addItem(r,'inv',mode==='card'?'keycard':'fuel_can',1);
  const snapshot=serializeSnapshot(g),ctx=await browser.newContext({viewport:{width:640,height:360}});await ctx.addInitScript(s=>localStorage.setItem('soh.state.v3',s),snapshot);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4194/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).first().click();await page.waitForFunction(()=>window.__soh?.run);await page.waitForTimeout(5500);const overlay=page.getByRole('button',{name:'Continue',exact:true});if(await overlay.isVisible().catch(()=>false))await overlay.click();
  const pos=await page.evaluate(async id=>{const {cam}=await import('/src/game/render.ts');const e=window.__soh.run.entities[id];return{x:e.x-Math.round(cam.x),y:e.y-Math.round(cam.y)}},e.id);await page.mouse.move(pos.x,pos.y);await page.waitForTimeout(400);await page.screenshot({path:`${dir}/${mode}-before-640.png`});await page.keyboard.press('e');await page.waitForTimeout(400);
  const result=await page.evaluate(id=>{const r=window.__soh.run,e=r.entities[id];return {entity:{open:e.open,locked:e.locked,power:e.power,poiPower:e.poiPower,poiDoor:e.poiDoor},inventory:r.custody.inv.slots.filter(Boolean),player:{x:r.player.x,y:r.player.y},receipt:r.receipts.at(-1)}},e.id);
  if(mode==='card'){assert.equal(result.entity.open,true);assert.equal(result.entity.locked,'keycard');assert.equal(result.inventory.find(s=>s.key==='keycard').charge,2);await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');await page.waitForTimeout(100);result.afterWalk=await page.evaluate(()=>({x:window.__soh.run.player.x,y:window.__soh.run.player.y}));assert(result.afterWalk.y<e.y);}
  else {assert.equal(result.entity.power,1);assert(result.entity.poiPower.expiresAt>result.entity.poiPower.fueledAt);assert(!result.inventory.some(s=>s.key==='fuel_can'));}
  await page.screenshot({path:`${dir}/${mode}-after-640.png`});assert.deepEqual(errors,[]);report.push({mode,result,errors});await ctx.close();
 }
 await writeFile(`${dir}/trace.json`,JSON.stringify({method:'Controlled player proximity and granted card/fuel, creatures suppressed. Real E and W browser input; no natural acquisition or route claim.',report},null,2));console.log('PASS: controlled Foundry card scan and crossing; Lighthouse generator input',report.map(x=>x.mode));
}finally{await browser.close();await vite.close();}
