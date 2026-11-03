// Real headless-Chromium smoke test of the browser review tool, with an honest DOM-only fallback.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import chromium,{inflate,setupLambdaEnvironment} from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const ROOT=process.cwd(),QA=path.join(ROOT,'qa'),OUT=path.join(QA,'browser_results.json');
fs.mkdirSync(QA,{recursive:true});
const checks=[],errors=[],consoleErrors=[];
const check=async(id,fn)=>{try{const d=await fn();checks.push({id,status:'PASS',...(d||{})});return true;}catch(e){checks.push({id,status:'FAIL',error:String(e.message||e)});throw e;}};
async function run(){
  let browser;
  try{
    const lib=await inflate(path.join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
    setupLambdaEnvironment(path.join(lib,'lib'));chromium.setGraphicsMode=false;
    const executablePath=await chromium.executablePath();
    browser=await puppeteer.launch({headless:'shell',executablePath,args:chromium.args,defaultViewport:{width:1500,height:1000,deviceScaleFactor:1},protocolTimeout:120000});
    const page=await browser.newPage();
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('requestfailed',r=>{if(!r.url().includes('favicon'))consoleErrors.push('requestfailed '+r.url());});
    await page.goto('http://127.0.0.1:3000',{waitUntil:'networkidle0',timeout:60000});
    await page.waitForFunction(()=>window.__SOH_READY__===true,{timeout:60000});
    const version=await browser.version();
    checks.push({id:'BROWSER_LAUNCH',status:'PASS',version,executable:'@sparticuz/chromium 153.0.0'});
    await check('NATIVE_CANVAS_AND_DATA',async()=>{const r=await page.evaluate(()=>{const c=document.querySelector('#viewport'),s=window.SOH_APP.state,d=window.SOH_APP.data;return{width:c.width,height:c.height,cssWidth:getComputedStyle(c).width,cssHeight:getComputedStyle(c).height,smoothing:c.getContext('2d').imageSmoothingEnabled,grid:[d.world.grid.w,d.world.grid.h],pois:d.poi.catalog.length,resources:d.world.objects.resources.length,props:d.ecology.props.length,blob:d.manifest.blob47.count,status:document.querySelector('#status').textContent};});assert.equal(r.width,640);assert.equal(r.height,360);assert.equal(r.cssWidth,'640px');assert.equal(r.cssHeight,'360px');assert.equal(r.smoothing,false);assert.deepEqual(r.grid,[500,350]);assert.equal(r.pois,81);assert.equal(r.resources,280);assert.equal(r.blob,47);assert.match(r.status,/GOLD/);return r;});
    await check('SHARED_RENDERER_NO_MISSING_SPRITES',async()=>{const r=await page.evaluate(()=>window.SOH_APP.render());assert.deepEqual(r.stats.missingSprites,[]);assert.ok(r.tiles>900&&r.tiles<1400);return r;});
    await check('TIME_VARIANT_LEVEL_PRESETS',async()=>{await page.select('#mode','night');await page.select('#variant','B');await page.select('#level','argus_l2');await page.select('#preset','3');const r=await page.evaluate(()=>({mode:window.SOH_APP.state.mode,variant:window.SOH_APP.state.variant,level:window.SOH_APP.state.level,camera:window.SOH_APP.state.camera.level,ecology:window.SOH_APP.data.ecology.props.length}));assert.equal(r.mode,'night');assert.equal(r.variant,'B');assert.equal(r.level,'exterior');assert.equal(r.camera,'exterior');assert.ok(r.ecology>1000);return r;});
    await check('DEBUG_OVERLAYS_AND_INSPECTOR',async()=>{await page.click('#showCollision');await page.click('#showIds');await page.click('#showRoute');await page.click('#viewport',{offset:{x:320,y:180}});const r=await page.evaluate(()=>({inspector:document.querySelector('#inspector').textContent,collision:document.querySelector('#showCollision').checked,route:document.querySelector('#showRoute').checked}));assert.match(r.inspector,/tile \[/);assert.match(r.inspector,/GOLD source IDs/);assert.equal(r.collision,true);assert.equal(r.route,true);return {inspectorLength:r.inspector.length};});
    await check('OVERVIEW_PICK_AND_KEYBOARD_MOVE',async()=>{await page.click('#overview',{offset:{x:250,y:175}});const before=await page.evaluate(()=>({x:window.SOH_APP.state.player.x,y:window.SOH_APP.state.player.y}));await page.evaluate(()=>{const s=window.SOH_APP.state,w=window.SOH_APP.data.world;for(let k=0;k<w.collision.length;k++)if(!w.collision[k]){s.player.x=(k%w.grid.w)*16+8;s.player.y=Math.floor(k/w.grid.w)*16+8;break;}});const p0=await page.evaluate(()=>({x:window.SOH_APP.state.player.x,y:window.SOH_APP.state.player.y}));await page.keyboard.down('d');await new Promise(r=>setTimeout(r,350));await page.keyboard.up('d');const p1=await page.evaluate(()=>({x:window.SOH_APP.state.player.x,y:window.SOH_APP.state.player.y}));assert.ok(Math.hypot(p1.x-p0.x,p1.y-p0.y)>1,'keyboard movement did not change position');return {before,p0,p1,overviewPick:true};});
    await check('CREATOR_EDIT_EXPORT_IMPORT_SAVE',async()=>{fs.writeFileSync(path.join(ROOT,'_scratch/browser_edits.json'),JSON.stringify({version:1,lockedRegions:[],lockedEdits:[],edits:[]},null,2));await page.click('#exportEdits');await page.click('#lockRegion');const input=await page.$('#importEdits');await input.uploadFile(path.join(ROOT,'_scratch/browser_edits.json'));await page.waitForFunction(()=>/Imported/.test(document.querySelector('#editStatus').textContent),{timeout:10000});await page.click('#saveEdits');await page.waitForFunction(()=>/Save:/.test(document.querySelector('#editStatus').textContent),{timeout:10000});const saved=JSON.parse(fs.readFileSync(path.join(ROOT,'data/creator_edits.json'),'utf8'));assert.equal(saved.version,1);assert.ok(Array.isArray(saved.edits));return {status:await page.$eval('#editStatus',e=>e.textContent),savedEdits:saved.edits.length,lockedRegions:saved.lockedRegions.length};});
    await check('HERO_SCENE_NATIVE_1X_AND_LABEL',async()=>{const r=await page.evaluate(()=>{const i=document.querySelector('#heroSceneImage');return{naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,cssWidth:getComputedStyle(i).width,cssHeight:getComputedStyle(i).height,rendering:getComputedStyle(i).imageRendering,panel:document.querySelector('#heroPanel').textContent,link:document.querySelector('header a').getAttribute('href')};});assert.equal(r.naturalWidth,640);assert.equal(r.naturalHeight,360);assert.equal(r.cssWidth,'640px');assert.equal(r.cssHeight,'360px');assert.match(r.rendering,/pixelated|crisp-edges/);assert.match(r.panel,/AI_DERIVED_HERO_PROP_NOT_REAL_ASSET/);assert.match(r.panel,/PLAYABILITY_UNPROVEN/);assert.equal(r.link,'/src/app/hero.html');return r;});
    await check('HERO_PROVENANCE_VIEW_PAGE',async()=>{
      const hp=await browser.newPage();
      hp.on('pageerror',e=>errors.push(String(e.message||e)));
      hp.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
      hp.on('requestfailed',r=>{if(!r.url().includes('favicon'))consoleErrors.push('requestfailed '+r.url());});
      try{
        await hp.goto('http://127.0.0.1:3000/src/app/hero.html',{waitUntil:'networkidle0',timeout:60000});
        await hp.waitForFunction(()=>window.__SOH_HERO_READY__===true,{timeout:30000});
        const r=await hp.evaluate(()=>({status:document.querySelector('#status').textContent,label:document.querySelector('#heroLabel').textContent,ledger:document.querySelector('#ledgerCount').textContent,scene:document.querySelector('#sceneCount').textContent,qa:document.querySelector('#qaCount').textContent,sha:document.querySelector('#imageSha').textContent,verdict:document.querySelector('#verdict').textContent,imgW:document.querySelector('#heroImage').naturalWidth,imgH:document.querySelector('#heroImage').naturalHeight}));
        assert.equal(r.imgW,640);assert.equal(r.imgH,360);
        assert.equal(r.label,'AI_DERIVED_HERO_PROP_NOT_REAL_ASSET');
        assert.match(r.ledger,/156 entries/);assert.match(r.ledger,/155 real crops/);
        assert.match(r.scene,/23×40/);assert.match(r.qa,/12\/12 PASS/);
        assert.match(r.sha,/^SHA [0-9a-f]{16}…$/);
        assert.match(r.verdict,/PLAYABILITY_UNPROVEN/);assert.match(r.verdict,/GAMEPLAY_INTEGRATION_BLOCKED/);
        return {hero_page:true,ledger:r.ledger,scene:r.scene,qa:r.qa,sha:r.sha,image:[r.imgW,r.imgH]};
      }finally{await hp.close();}
    });
    await check('NO_RUNTIME_OR_CONSOLE_ERRORS',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);return {pageErrors:0,consoleErrors:0};});
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(QA,'browser_app.png')});
    const result={generated:new Date().toISOString(),status:'PASS',runtime:'headless Chromium via @sparticuz/chromium + puppeteer-core',browser_version:version,url:'http://127.0.0.1:3000',checks,errors,consoleErrors,screenshot:'qa/browser_app.png',limitations:['Browser is the review/authoring surface, not Godot 4.7 or native gameplay.','Canvas uses the same shared scene renderer as Node captures; 640x360 1x is preserved.']};
    fs.writeFileSync(OUT,JSON.stringify(result,null,2));
    console.log('BROWSER_TEST PASS',checks.length,'checks');
  } catch(e){
    const result={generated:new Date().toISOString(),status:'FAIL',error:String(e.stack||e),checks,errors,consoleErrors,fallback:'none — no browser evidence claimed'};
    fs.writeFileSync(OUT,JSON.stringify(result,null,2));console.error('BROWSER_TEST FAIL',e);process.exitCode=1;
  } finally {if(browser)await browser.close();}
}
await run();
