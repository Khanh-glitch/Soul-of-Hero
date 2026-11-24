// QUARANTINED (Item Ontology V2, 2026-11-14): string-edited in round 2, not runnable to completion on base or head. See e2e/QUARANTINE.json. Not evidence.
// Controlled proximity fixtures only: no claim of natural travel, route safety or gated-door access.
// The browser performs real E/right-click actions on authentic, unmodified authored containers.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/w06-loot-fixture';await mkdir(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
const {newGame,dispatch,C}=await vite.ssrLoadModule('/src/game/engine.ts');
const {lootClass,LOOT_CLASSES}=await vite.ssrLoadModule('/src/game/loot-ecology.ts');
const {getWorld,setActiveLayout}=await vite.ssrLoadModule('/src/game/world.ts');
const {serializeSnapshot}=await vite.ssrLoadModule('/src/game/persist.ts');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});const report=[];
try {
 for(const kind of ['toolbox','supply','military','advanced']){
  setActiveLayout('shipping_fresh');const now=Date.now(),g=newGame();assert(dispatch(g,{id:'start-fixture',type:'startRun',character:'female',seed:99},now).ok);const r=g.run;
  const site=getWorld('shipping_fresh').statics.find(s=>lootClass(s)===kind),e=Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===site.tx&&e.ty===site.ty);
  r.player.x=e.x;r.player.y=e.y; // ONLY fixture proximity; no inventory grants or cache mutations.
  const initial=C(r,e.c).slots.filter(Boolean).length,snapshot=serializeSnapshot(g),ctx=await browser.newContext({viewport:{width:640,height:360}});await ctx.addInitScript(value=>localStorage.setItem('soh.state.v3',value),snapshot);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:4194/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue/i}).first().click();await page.waitForFunction(()=>window.__soh?.run);await page.waitForTimeout(5500);const overlay=page.getByRole('button',{name:'Continue',exact:true});if(await overlay.isVisible().catch(()=>false))await overlay.click();
  await page.mouse.move(330,180);await page.keyboard.press('e');const panel=page.locator('.panel').filter({hasText:LOOT_CLASSES[kind].name}).first();await panel.waitFor({timeout:5000});
  await page.waitForTimeout(500);const text=await panel.innerText();assert.match(text,/Withdraw only/);assert.match(text,new RegExp(`${LOOT_CLASSES[kind].hours}h`));await page.screenshot({path:`${out}/${kind}-before-640.png`});
  const selected={toolbox:'Parts',supply:'Bandage',military:'Basic Energy',advanced:'Refined Energy'}[kind];await panel.locator(`[title="${selected}"]`).last().click({button:'right'});await page.waitForTimeout(200);
  const after=await page.evaluate(id=>{const r=window.__soh.run,e=r.entities[id];return {remaining:r.custody[e.c].slots.filter(Boolean).length,inventory:r.custody.inv.slots.filter(Boolean).map(s=>[s.key,s.qty])};},e.id);
  assert.equal(after.remaining,initial-1);assert(after.inventory.some(([k])=>k===LOOT_CLASSES[kind].fixed[0]));await page.screenshot({path:`${out}/${kind}-partial-640.png`});assert.deepEqual(errors,[]);report.push({kind,site:`${site.poi} ${site.tx},${site.ty}`,initial,after,ui:text});await ctx.close();
 }
 await writeFile(`${out}/trace.json`,JSON.stringify({method:'Controlled proximity fixtures; authentic site stock, normal browser keyboard and mouse, not natural travel or lock access.',report},null,2));console.log('PASS: four class panels opened with E and real partial withdrawals; 640x360 screenshots',report.map(x=>x.kind).join(', '));
} finally {await browser.close();await vite.close();}
