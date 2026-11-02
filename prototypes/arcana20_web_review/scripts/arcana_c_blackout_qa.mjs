// Internal #17 stage ordering diagnostic with an explicitly advanced fixture clock.
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.SOH_URL||'http://127.0.0.1:4176/')+'?arcanaBdev=1&arcanaGpu=1');await page.getByRole('button',{name:'New run',exact:true}).click();await page.getByRole('button',{name:'Meadow Bay',exact:true}).click();await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();await page.waitForFunction(()=>window.__soh?.run,null,{timeout:45000});
await page.evaluate(()=>{const r=window.__soh.run;r.custody.inv.slots[3]={uid:'test-17',key:'core_arcana_17',qty:1,charge:3};r.player.active=3});await page.mouse.move(850,350);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();
await page.waitForFunction(()=>window.__soh.run.custody.inv.slots[3].charge===2,null,{timeout:30000});await page.evaluate(()=>window.__soh.run.clock.simMs+=5950);
await page.waitForFunction(()=>window.__arcanaCBlackout===true,null,{timeout:30000});
const result=await page.evaluate(()=>{const c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let black=0;for(let i=0;i<d.length;i+=4)if(d[i]<5&&d[i+1]<5&&d[i+2]<5)black++;return {blackRatio:black/(d.length/4),hudVisible:document.body.innerText.includes('Day ')};});
assert(result.blackRatio>.95);assert(result.hudVisible);assert.deepEqual(errors,[]);console.log(JSON.stringify({scope:'diagnostic stage blackout, fixture-advanced clock, not P0 parity',...result,errors},null,2));await browser.close();
