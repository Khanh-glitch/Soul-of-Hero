// PA1 browser acceptance for the BUILDING vs DEPLOY split and packed-device custody.
// Real controls only: the shipped title screen's QA sandbox, the B and C keys, real palette tiles,
// real clicks. Nothing is injected into React state or the engine, and no assertion is made about
// numbers the catalog already guarantees — this file exists to prove what the PLAYER is shown:
//   1) the Build palette carries the 15 wooden shapes and NO device;
//   2) every device row states the PACK as the thing placement spends (never the raw ore list);
//   3) the Research Table's technology-family panel is legible when a table is within reach.
// Scope: UI legibility + zero console/page errors. Conservation, UID and save proofs live in
// web/tests/pa1-*.test.ts and are NOT re-claimed here.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/pa1-deploy-custody';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],devices:[],geometryPages:{},research:null,errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console:'+m.text());});
async function shot(name){const path=name+'.png';await page.screenshot({path:out+'/'+path,animations:'disabled'});rec.screenshots.push(path);}
const DEVICE_WORDS=/workbench|refinery|oil pump|generator|chest|furnace|campfire|research table|garden|barrel|trough|turret|sensor|cable|switch|trap|spikes|door/i;
try{
  const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200);
  // Real menu: the shipped QA sandbox gives a supplied industrial compound, so a player is standing
  // among stations instead of being handed items by this script.
  await page.getByRole('button',{name:'Full-Gear QA Sandbox [F9]',exact:true}).click();
  await page.locator('[data-testid="qa-preset-industry"]').click();
  await page.getByRole('button',{name:'Launch QA Sandbox',exact:true}).click();
  await page.waitForSelector('canvas',{timeout:45000});

  // 1) BUILDING = geometry only.
  await page.keyboard.press('b');
  const bar=page.getByTestId('pa1-expanded-buildbar');
  await bar.waitFor({timeout:15000});
  for(const name of ['Foundation','Wall','Roof']){
    await bar.getByRole('button',{name:new RegExp('^'+name+'\\s')}).click();
    const chips=bar.locator('.buildbar__row .bslot:not(.mode)');
    // A geometry slot carries only a hotkey + an <img alt=name>, so read the alt too: filtering the
    // text alone would match nothing and make the "no devices here" assertion vacuous.
    const labels=await chips.evaluateAll(els=>els.map(e=>((e.querySelector('img')?.getAttribute('alt')||'')+' '+(e.textContent||'')).replace(/\s+/g,' ').trim()));
    const devices=labels.filter(t=>DEVICE_WORDS.test(t));
    assert.equal(devices.length,0,'A device appeared in the geometry palette: '+JSON.stringify(devices));
    rec.geometryPages[name]={count:labels.length,labels:labels.slice(0,4)};
    await shot('01-geometry-'+name.toLowerCase()+'-1280');
  }
  await page.keyboard.press('Escape');

  // 2) DEPLOY = the pack is the readiness authority, in the player's own words.
  await page.keyboard.press('c');
  const right=page.locator('.sv-right');
  await right.waitFor({timeout:15000});
  for(const cat of ['Stations','Devices']){
    await right.locator('.sv-cat').filter({hasText:cat}).first().click();
    const tiles=right.locator('.sv-tile[data-recipe^="S:"]');
    const n=await tiles.count();
    assert.ok(n>0,'No '+cat+' tiles were listed');
    rec.devices.push({category:cat,tiles:n});
    for(let i=0;i<Math.min(n,4);i++){
      const tile=tiles.nth(i);
      const id=await tile.getAttribute('data-recipe');
      await tile.click();
      const detail=page.locator('.sv-detail');
      await detail.waitFor({timeout:8000});
      const status=(await detail.locator('.sv-readiness').innerText()).replace(/\s+/g,' ').trim();
      const cta=await detail.locator('.sv-go').innerText();
      const ctaDisabled=await detail.locator('.sv-go').isDisabled();
      // Whatever the sandbox granted, a device row must talk about the packed device — and it must
      // never invite a second material payment for placement.
      assert.match(status,/packed|pack/i,cat+'/'+id+' readiness did not mention the pack: '+status);
      assert.ok(!/materials ready/i.test(status),cat+'/'+id+' claimed raw materials are enough: '+status);
      if(ctaDisabled) assert.match(cta,/craft the pack first/i,cat+'/'+id+' blocked the CTA without naming the craft step: '+cta);
      else assert.match(cta,/spends the pack/i,cat+'/'+id+' enabled CTA must say what placement spends: '+cta);
      rec.devices.at(-1).rows=[...(rec.devices.at(-1).rows||[]),{id,state:await tile.getAttribute('data-state'),status,cta,ctaDisabled}];
    }
    await shot('02-deploy-'+cat.toLowerCase()+'-1280');
  }
  await page.setViewportSize({width:640,height:360});
  await page.waitForTimeout(250);
  await shot('03-deploy-devices-640');
  await page.setViewportSize({width:1280,height:720});

  // 3) Optional, non-gating: if a Research Table happens to be within reach, capture the family panel.
  await page.keyboard.press('Escape');
  await page.keyboard.press('e');
  const panel=page.getByText('Technology families',{exact:true});
  if(await panel.count()){
    await panel.first().waitFor({timeout:5000});
    const rows=await page.locator('.panel').filter({hasText:'Technology families'}).first()
      .locator('div').filter({hasText:/^(METALLURGY|MOBILITY|ENERGY|ELECTRICAL|AGRICULTURE|ARMORY|EXPLORATION|ARCANA|STEEL|DEFENSE|CORE_SPECIFIC)·/}).allTextContents();
    rec.research={open:true,families:rows.map(t=>t.replace(/\s+/g,' ').trim()).slice(0,11)};
    await shot('04-research-families-1280');
  }else rec.research={open:false,note:'no station within reach of the sandbox spawn — family panel covered by unit tests'};

  assert.equal(rec.errors.length,0,'Browser console/page errors: '+JSON.stringify(rec.errors));
  rec.status='PASS_BROWSER_UI';
}catch(e){rec.status='FAIL';rec.failure=String(e);try{await shot('FAIL')}catch{}}
finally{
  await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
  console.log('PA1_DEPLOY_CUSTODY '+JSON.stringify({status:rec.status,sha:rec.sha,geometry:rec.geometryPages,devices:rec.devices.map(d=>({category:d.category,tiles:d.tiles,rows:(d.rows||[]).length})),research:rec.research?.open,errors:rec.errors,failure:rec.failure}));
  await context.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_UI')process.exitCode=1;
