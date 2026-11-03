import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/world-economy'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try { const c=await browser.newContext({viewport:{width:640,height:360}}), p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:4180',{waitUntil:'networkidle'});await p.getByRole('button',{name:/New run/i}).click();await p.getByText('Pinewatch',{exact:true}).click();await p.getByRole('button',{name:/Begin the 14 days/}).click();await p.waitForFunction(()=>window.__soh?.run);assert.equal(await p.evaluate(()=>window.__soh.run.sourceLayoutVersion),3);
 await p.waitForTimeout(500);for(const [w,h] of [[640,360],[1280,720]]){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(350);await p.screenshot({path:`${out}/natural-world-${w}x${h}.png`,animations:'disabled'});}assert.deepEqual(errors,[]);await c.close();console.log('PASS: v3 new run rendered from natural fresh profile at both viewports');
} finally {await browser.close();}
