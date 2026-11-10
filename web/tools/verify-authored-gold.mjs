import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Tests the real main Veyra runtime, not the Gold donor demo.
// Evidence uses identical native 640x360 stage and a 1280x720 integer-scaled window.
const cwd = process.cwd();
const sourceGoldBytes = fs.readFileSync(path.join(cwd,'gold-authority/v2/src/index.css'));
const sourceGoldHash = createHash('sha256').update(sourceGoldBytes).digest('hex');
if(sourceGoldHash!=='2fb784fab321f76c2e764fe9ffa72b8b47f87f7190d39ad21150c377e425257b'){
  throw new Error('Creator Gold (2) exact full CSS source mutated; visual authority invalid: '+sourceGoldHash);
}
const dir = path.join(cwd,'evidence','gold-authored');
fs.mkdirSync(dir,{recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd,stdio:'pipe',env:{...process.env,VITE_SOH_QA:'1'}});
let serverLog = '';
server.stdout.on('data',c=>{serverLog+=c.toString()}); server.stderr.on('data',c=>{serverLog+=c.toString()});
let browser; const report={sha:process.env.GITHUB_SHA||null,screens:[],tests:[],errors:[]};
async function serverReady(){for(let i=0;i<90;i++){try{const r=await fetch('http://127.0.0.1:5173/');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,400))}throw new Error('Dev server not ready: '+serverLog.slice(-1200))}
function pass(label,detail){report.tests.push({label,detail})}
try{
 await serverReady(); browser=await chromium.launch({headless:true});
 for(const width of [640,1280]){
  const page=await browser.newPage({viewport:{width,height:width===640?360:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('button',{name:'New run'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'New run'}).click();
  await page.getByRole('button',{name:'Begin the 14 days'}).click();
  await page.locator('canvas').first().waitFor({timeout:20000});
  await page.waitForTimeout(600);
  const shot=async name=>{await page.screenshot({path:path.join(dir,width+'-'+name+'.png')});report.screens.push(width+'-'+name+'.png')};
  await shot('world');
  await page.keyboard.press('i');
  await page.locator('.sv').waitFor({timeout:8000});
  await page.waitForTimeout(320);
  // Full original Gold2 CSS must be mounted as a single isolated design system,
  // not a hand-selected subset of .sv styles mixed with R12 global controls.
  const sourceGold=await page.locator('[data-testid="gold-source-surface"]').evaluate(host=>{
    const shadow=host.shadowRoot;
    const css=shadow?.querySelector('style')?.textContent||'';
    const portrait=shadow?.querySelector('.sv-portrait');
    const svLeft=shadow?.querySelector('.sv-left');
    const panel=shadow?.querySelector('.sv');
    return {isolated:!!shadow,styleBytes:css.length,hasOriginalPanel:css.includes('.panel {'),
      hasOriginalMobile:css.includes('@media (max-width: 700px)'),
      portraitWidth:portrait?parseFloat(getComputedStyle(portrait).width):0,
      leftDisplay:svLeft?getComputedStyle(svLeft).display:'missing',
      panelBackground:panel?getComputedStyle(panel).backgroundImage:'missing'};
  });
  if(!sourceGold.isolated||sourceGold.styleBytes<70000||!sourceGold.hasOriginalPanel||!sourceGold.hasOriginalMobile){
    throw new Error('Gold2 full original stylesheet not isolated: '+JSON.stringify(sourceGold));
  }
  const expectedPortraitWidth=width===640?74:52;
  const expectedLeftDisplay=width===640?'grid':'flex';
  if(sourceGold.portraitWidth!==expectedPortraitWidth||sourceGold.leftDisplay!==expectedLeftDisplay){
    throw new Error('Gold2 media/source geometry diverged: '+JSON.stringify(sourceGold));
  }
  pass(width+' Gold source CSS isolated',sourceGold);
  const controls=await page.locator('.sv-compact-nav button').count();
  const hot=await page.locator('.dgrid-tier--hot .dslot').count();
  const pack=await page.locator('.dgrid-tier--pack .dslot').count();
  const equipped=await page.locator('.sv-eqcell .dslot').count();
  const doll=await page.locator('.sv-doll').count();
  if(controls!==2||hot!==8||pack!==16||equipped!==3||doll!==1)throw new Error('Gold source layout missing: '+JSON.stringify({controls,hot,pack,equipped,doll}));
  pass(width+' Gold PACK',{controls,hot,pack,equipped,doll});
  await shot('pack');
  // TRUE pointer-driven R12 custody move from protected hotbar into backpack,
  // then reverse. This exercises the original Gold2 dragSlots handlers; no QA
  // mutation, cheat inventory or click-to-click substitution.
  const from = page.locator('[data-dslot][data-c="inv"][data-s="0"]');
  const into = page.locator('[data-dslot][data-c="inv"][data-s="8"]');
  const originalLabel = await from.getAttribute('aria-label');
  if (!originalLabel || originalLabel.includes('empty')) throw new Error('Starter hotbar slot 0 missing physical item');
  const drag = async (src,dst) => {
    const a=await src.boundingBox(),b=await dst.boundingBox();
    if(!a||!b)throw new Error('Drag source/target invisible');
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:9});
    await page.mouse.up();
    await page.waitForTimeout(200);
  };
  await drag(from,into);
  if (!(await from.getAttribute('aria-label'))?.includes('empty') || (await into.getAttribute('aria-label'))?.includes('empty')) {
    throw new Error('Original Gold2 drag did not move real item custody from hotbar to backpack');
  }
  await shot('drag-hotbar-to-backpack');
  await drag(into,from);
  if ((await from.getAttribute('aria-label'))?.includes('empty') || !(await into.getAttribute('aria-label'))?.includes('empty')) {
    throw new Error('Gold2 drag reverse failed to restore original item in hotbar');
  }
  pass(width+' real custody drag',{forward:'hotbar→backpack',reverse:'backpack→hotbar'});
  await page.getByRole('button',{name:'Turn character right'}).click();
  await shot('pack-turned');
  if(width===640) {
    await page.locator('.sv-compact-nav button').nth(1).click();
  } else {
    // Original Gold2 at a >=701px CSS viewport shows both columns, and
    // the compact navigation is intentionally hidden. Open WORK via the
    // native game shortcut instead of clicking a hidden control.
    await page.keyboard.press('i');
    await page.keyboard.press('c');
  }
  await page.locator('.sv-right').waitFor({timeout:8000});
  if(await page.locator('.sv-cats button').count()!==8)throw new Error('Gold WORK missing original categories');
  pass(width+' Gold WORK',{categories:8,recipeTiles:await page.locator('.sv-tile').count()});
  await shot('work');
  await page.keyboard.press('i');
  await page.keyboard.press('c');
  await page.locator('.sv').waitFor({timeout:8000});
  const view=await page.locator('.sv').getAttribute('data-compact-view');
  if(view!=='work')throw new Error('C did not open original WORK: '+view);
  pass(width+' native shortcut',{C:view});
  await page.keyboard.press('c');
  await page.keyboard.press('m');
  await page.locator('.panel-h').filter({hasText:/Map/}).first().waitFor({timeout:8000});
  pass(width+' safe Map',{map:'M opens native map'});
  await shot('map');
  await page.keyboard.press('m');
  await page.keyboard.press('b');
  await page.locator('.buildbar').waitFor({timeout:8000});
  const buildButtons=await page.locator('.bslot').count();
  if(buildButtons<8)throw new Error('Source-authored Gold2 BuildBar lost tools: '+buildButtons);
  if(await page.getByTestId('legacy-build-helper').count()) throw new Error('Duplicate R12 build status overlaps Gold2 BuildBar');
  pass(width+' authored BuildBar',{tools:buildButtons});
  await shot('buildbar');
  await page.keyboard.press('b');
  // Reference-geometry evidence with a physically authored QA full-pack state,
  // never a reward or production-game cheat. This remains test-only because
  // VITE_SOH_QA=1 only runs under this isolated Playwright server.
  const advancedPack=await page.evaluate(()=>window.__sohQA?.preparePack?.());
  if(!advancedPack)throw new Error('Disclosed test-only full-pack fixture unavailable');
  await page.keyboard.press('i');
  await page.locator('.sv').waitFor({timeout:8000});
  await shot('pack-populated');
  pass(width+' populated source Gold screenshot',{fixture:advancedPack});
  await page.close();
 }
 if(report.errors.length)throw new Error(report.errors.join(' | '));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
 console.log('AUTHORED GOLD SOH HOST PASS',JSON.stringify(report));
}catch(e){report.error=String(e);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1}
finally{if(browser)await browser.close();server.kill('SIGTERM')}
