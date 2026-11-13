// PA1 browser acceptance for the BUILDING vs DEPLOY split and packed-device custody.
// Real controls only: the shipped title screen's three clicks, the B and C hotkeys, real palette
// tiles, real clicks. Nothing is injected into React state or the engine, and no claim is made about
// numbers the catalog already guarantees — this file exists to prove what the PLAYER is SHOWN:
//   1) the Build palette carries the wooden geometry pages and NO device;
//   2) every Deploy row states the PACK as the thing placement spends (never the raw ore list), and
//      never claims "Materials prepared" while still asking the player to craft a pack;
//   3) the Research Table's family panel is legible when a table happens to be within reach.
// Conservation, UID and save proofs live in web/tests/pa1-*.test.ts and are NOT re-claimed here.
// Startup follows e2e/pa1-building-palette.mjs exactly: that sequence is the CI-proven one.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='evidence/pa1-deploy-custody';
await mkdir(out,{recursive:true});
const rec={sha:process.env.BUILD_SHA||'unknown',status:'RUNNING',screenshots:[],geometryPages:[],devices:[],research:null,errors:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',e=>rec.errors.push('pageerror:'+e.message));
page.on('console',m=>{if(m.type()==='error')rec.errors.push('console:'+m.text());});
async function shot(name){const path=name+'.png';await page.screenshot({path:out+'/'+path,animations:'disabled'});rec.screenshots.push(path);}
// The exact fifteen names catalog.ts puts on the three geometry pages, in page order. An exact list
// is the strong form of "no device in the Build palette": a device slipping in, a wooden shape
// disappearing, or a page being re-sorted all fail here, whereas a word filter would still pass on
// 'Wood Door' vs 'Door Power' ambiguity. web/tests/pa1-building-ontology.test.ts pins the same 15
// ids from the other side, so the UI claim and the data claim cannot drift apart quietly.
const GEOMETRY_PAGES={
  Foundation:['Wood Floor','Wood Triangle Foundation','Wood Ceiling','Wood Triangle Ceiling'],
  Wall:['Wood Wall','Wood Window Wall','Wood Door Frame','Wood Door','Wood Half Wall','Wood Pillar','Wood Triangle Gable','Wood Fence'],
  Roof:['Thatch Roof','Thatch Slope Roof','Thatch Corner Roof'],
};
// The vocabulary structurePreparation() is allowed to answer with, per the shipped code:
// pack wording for a device that owns a packed item, site wording for the oil pump, and the ordinary
// material wording for base geometry (a powered door is not a packed device yet — see ledger §24).
const LEGIBLE=/(Craft the packed|spends the packed device|damaged — repair it|authorized oil site|Materials ready|Materials prepared|Get \d|Needs materials)/;
try{
  const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200);
  await page.getByRole('button',{name:'New run',exact:true}).click();
  await page.getByRole('button',{name:'VEYRA · Unified World',exact:true}).click();
  await page.getByRole('button',{name:'Begin the 14 days',exact:true}).click();
  await page.waitForSelector('canvas',{timeout:45000});

  // 1) BUILDING = geometry only.
  await page.keyboard.press('b');
  const bar=page.getByTestId('pa1-expanded-buildbar');
  await bar.waitFor({timeout:15000});
  for(const [name,count] of [['Foundation',4],['Wall',8],['Roof',3]]){
    await bar.getByRole('button',{name:new RegExp('^'+name+'\\s')}).click();
    const chips=bar.locator('.buildbar__row .bslot:not(.mode)');
    assert.equal(await chips.count(),count,'Wrong geometry count on the '+name+' page');
    // A slot carries only a hotkey + an <img alt=name>, so read the alt: textContent alone would be
    // just the digit and make every label assertion vacuous.
    const labels=await chips.locator('img').evaluateAll(els=>els.map(el=>el.alt||''));
    assert.deepEqual(labels,GEOMETRY_PAGES[name],'Wrong contents on the '+name+' page');
    rec.geometryPages.push({name,count,labels});
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
    const rows=[];
    for(let i=0;i<n;i++){
      const tile=tiles.nth(i);
      const id=await tile.getAttribute('data-recipe');
      await tile.click();
      const detail=page.locator('.sv-detail');
      await detail.waitFor({timeout:8000});
      const status=(await detail.locator('.sv-readiness').innerText()).replace(/\s+/g,' ').trim();
      const cta=await detail.locator('.sv-go').innerText();
      const ctaDisabled=await detail.locator('.sv-go').isDisabled();
      assert.match(status,new RegExp(LEGIBLE.source),cat+'/'+id+' readiness is not a stated requirement: '+status);
      // The double-payment lie this file exists to catch: a row may not claim materials are prepared
      // while the same row still tells the player to go craft something first.
      if(/Craft the pack first/i.test(cta))
        assert.ok(!/Materials prepared/i.test(status),cat+'/'+id+' promised prepared materials and demanded a craft: '+status);
      if(!ctaDisabled) assert.match(cta,/Choose site/i,cat+'/'+id+' enabled CTA must send the player to a site: '+cta);
      rows.push({id,state:await tile.getAttribute('data-state'),status,cta,ctaDisabled});
    }
    if(cat==='Stations'){
      // One exact pin, on the row a fresh run always blocks for the same reason: no pack carried.
      const wb=rows.find(x=>x.id==='S:workbench');
      assert.ok(wb,'Workbench row disappeared from the Deploy screen');
      assert.match(wb.status,/Craft the packed Workbench first/, 'workbench status: '+wb.status);
      assert.match(wb.cta,/Craft the pack first/i,'workbench CTA: '+wb.cta);
      // The diagram must show the PACK as the input, not the ore list.
      const needTitle=await page.locator('.sv-detail .sv-diagram .ins .need').first().getAttribute('title');
      assert.match(String(needTitle),/placement spends this item/,'workbench diagram input: '+needTitle);
    }
    rec.devices.push({category:cat,tiles:n,rows});
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
  }else rec.research={open:false,note:'no station within reach on this spawn — the panel is covered by web/tests/pa1-recipe-migration.test.ts'};

  assert.equal(rec.errors.length,0,'Browser console/page errors: '+JSON.stringify(rec.errors));
  rec.status='PASS_BROWSER_UI';
}catch(e){
  rec.status='FAIL';rec.failure=String(e);try{await shot('FAIL')}catch{}
  // The Actions log is served from blob storage, which the offline development sandbox cannot reach;
  // a workflow command lands in an annotation that api.github.com does expose, so the failure is
  // diagnosable without re-running anything. `%` is escaped because it is the command's own metachar.
  const flat=(rec.failure||'').replace(/\s+/g,' ').replace(/%/g,'%25').slice(0,1500);
  console.log('::error::PA1_DEPLOY_CUSTODY '+flat.replace(/\r/g,'%0D').replace(/\n/g,'%0A')+' || errors='+JSON.stringify(rec.errors.slice(0,3)).replace(/%/g,'%25'));
}
finally{
  await writeFile(out+'/manifest.json',JSON.stringify(rec,null,2)+'\n');
  console.log('PA1_DEPLOY_CUSTODY '+JSON.stringify({status:rec.status,sha:rec.sha,geometry:rec.geometryPages.map(p=>({name:p.name,count:p.count})),devices:rec.devices.map(d=>({category:d.category,tiles:d.tiles,rows:d.rows.length})),research:rec.research?.open,errors:rec.errors,failure:rec.failure}));
  await context.close();await browser.close();
}
if(rec.status!=='PASS_BROWSER_UI')process.exitCode=1;
