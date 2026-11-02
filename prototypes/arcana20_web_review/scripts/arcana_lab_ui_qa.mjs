// Internal, unready developer fixture UI test. No game delivery implied.
import { chromium } from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const base=process.env.SOH_URL||'http://127.0.0.1:4176/';
await page.goto(base+'?arcanaBdev=1&arcanaGpu=1');await page.getByRole('button',{name:'New run',exact:true}).click();await page.getByRole('button',{name:'Meadow Bay',exact:true}).click();await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
await page.waitForFunction(()=>Boolean(window.__soh?.run),null,{timeout:45000});await page.keyboard.press('KeyI');
await page.getByRole('button',{name:'Add Furnace Wyrm Core'}).click();await page.waitForFunction(()=>window.__soh.run.custody.inv.slots.some(s=>s?.key==='core_arcana_02'));
const inv=page.locator('.panel').filter({hasText:'Internal Core fixtures'});assert.equal(await inv.getByRole('button',{name:/^Add .* Core$/}).count(),20);
await inv.locator('.slot').nth(6).click();await inv.locator('.slot').nth(3).click();await page.keyboard.press('KeyI');
await page.mouse.move(850,350);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();
await page.waitForFunction(()=>window.__soh.run.custody.inv.slots[0]?.key==='core_arcana_02'&&window.__soh.run.custody.inv.slots[0]?.charge===2,null,{timeout:30000});
const state=await page.evaluate(()=>({qaUsed:window.__soh.run.qaUsed,slot:window.__soh.run.custody.inv.slots[0],keys:Object.keys(localStorage)}));
assert(state.qaUsed);assert(state.keys.some(k=>k.startsWith('soh.arcana-lab.v')));assert(!state.keys.some(k=>k.startsWith('soh.state.v')));assert.deepEqual(errors,[]);
await page.goto(base);await page.getByRole('button',{name:'New run',exact:true}).waitFor({timeout:45000});
console.log(JSON.stringify({scope:'internal diagnostic, fixture UI only, not playtest-ready',fixtureButtons:20,charge:state.slot.charge,qaUsed:state.qaUsed,separateLocalStorage:true,ordinarySaveUnaffected:true,errors},null,2));await browser.close();
