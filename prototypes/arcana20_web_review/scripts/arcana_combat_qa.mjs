// Automated combat-only browser probe for the experimental 20 Cores.
// These effects have NO P0 visual port yet; this is not a review build.
// Test fixtures insert existing inventory items; no code is injected into the app.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const executablePath = process.env.CHROMIUM_PATH || undefined;
const args = executablePath ? ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader'] : [];
const b = await chromium.launch({ headless: true, executablePath, args });
const ctx = await b.newContext({ viewport: {width:1280,height:720} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e=>{errors.push(e.message); console.error('pageerror',e.stack);});
await page.goto(process.env.SOH_URL || 'http://127.0.0.1:4175/');
await page.getByRole('button', {name:'New run',exact:true}).click();
await page.getByRole('button', {name:'Meadow Bay',exact:true}).click();
await page.getByRole('button', {name:'Begin the 14 days',exact:true}).click();
await page.waitForFunction(()=>Boolean(window.__soh?.run));
await page.waitForTimeout(1500);
let results = [];
for (const core of Array.from({length:20},(_,i)=>`core_arcana_${String(i+1).padStart(2,'0')}`)) {
  await page.evaluate(key=>{const r=window.__soh.run; r.custody.inv.slots[3]={uid:'test-'+key,key,qty:1,charge:3}; r.player.active=3;},core);
  await page.mouse.move(850, 350);
  await page.waitForTimeout(300);
  await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up();
  await page.waitForFunction(key => window.__soh.run.custody.inv.slots[3]?.key===key && window.__soh.run.custody.inv.slots[3].charge===2,core,{timeout:30000});
  results.push({core,chargesAfterCast:2});
  await page.waitForTimeout(700);
}
await page.keyboard.press('KeyI'); await page.waitForTimeout(250); assert(await page.locator('canvas').count()>0); await page.keyboard.press('KeyI');
assert.deepEqual(errors,[]);
console.log(JSON.stringify({scope:'experimental combat only; test-only inventory fixture; no P0 renderer',cores:results,jsErrors:errors},null,2));
await b.close();
