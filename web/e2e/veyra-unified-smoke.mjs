import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = process.env.SOH_URL || 'http://127.0.0.1:4191/';
const out = 'evidence/veyra-r5-single-game';
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto(root,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button',{name:'World Map · 81 POIs'}).waitFor({timeout:90000});
  await page.screenshot({path:out+'/01-actual-title.png'});
  await page.getByRole('button',{name:'World Map · 81 POIs'}).click();
  const select=page.getByTestId('poi-select');
  await select.waitFor({timeout:90000});
  const ids=await select.locator('option').evaluateAll(a=>a.map(o=>o.value).filter(Boolean));
  assert.equal(ids.length,81,'Inspector must expose all 81 POIs, not 11 old sites');
  for(const id of ['po_elderwood','po_hall_eyes','po_gate','po_necropolis','po_surtur','po_typhon']) assert(ids.includes(id),'Missing Elder '+id);
  await select.selectOption('po_elderwood');
  await page.getByText('ID: po_elderwood').waitFor({timeout:30000});
  await page.screenshot({path:out+'/02-actual-81-poi-map.png'});
  await page.getByRole('button',{name:/Inspect & Play at/}).click();
  await page.waitForFunction(()=>window.__soh?.run?.qaUsed===true,null,{timeout:120000});
  const qa=await page.evaluate(()=>({layout:window.__soh.run.layoutId,units:window.__soh.run.sourceMap?.veyra?.unitsPerTile}));
  assert.equal(qa.units,0.5,'Creator runtime must use U=0.5 GOLD');
  assert.match(qa.layout,/^veyra05-/,'Creator runtime must not use legacy map');
  await page.screenshot({path:out+'/03-actual-inspection-gameplay.png'});
  await page.keyboard.press('KeyM');
  await select.waitFor({timeout:90000});
  await page.getByRole('button',{name:/Back to Game/}).click();
  await page.getByRole('button',{name:'New run'}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'New run'}).click();
  assert.equal(await page.getByText('VEYRA · Unified World · 81 canonical POIs').count(),1,'Must show one map choice');
  await page.getByRole('button',{name:/Begin the 14 days/}).click();
  await page.waitForFunction(()=>window.__soh?.run?.layoutId==='veyra05-world',null,{timeout:120000});
  const normal=await page.evaluate(()=>({layout:window.__soh.run.layoutId,qa:window.__soh.run.qaUsed,units:window.__soh.run.sourceMap?.veyra?.unitsPerTile}));
  assert.equal(normal.qa,false,'Normal run cannot inherit Creator QA');
  assert.equal(normal.units,0.5);
  await page.screenshot({path:out+'/04-actual-one-game-new-run.png'});
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('PASS: one game, all 81 source POIs, six modern Elder sites, real QA and normal gameplay:',JSON.stringify({qa,normal}));
} catch(e) {
  await page.screenshot({path:out+'/FAIL-browser.png'}).catch(()=>{});
  console.error('BROWSER GATE FAILED:',e,'page errors',errors);
  process.exitCode=1;
} finally {
  await browser.close();
}
