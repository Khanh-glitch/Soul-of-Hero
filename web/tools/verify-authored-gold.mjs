import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Tests the real main Veyra runtime, not the Gold donor demo.
// Evidence uses identical native 640x360 stage and a 1280x720 integer-scaled window.
const cwd = process.cwd();
const dir = path.join(cwd,'evidence','gold-authored');
fs.mkdirSync(dir,{recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd,stdio:'pipe'});
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
  const controls=await page.locator('.sv-compact-nav button').count();
  const hot=await page.locator('.dgrid-tier--hot .dslot').count();
  const pack=await page.locator('.dgrid-tier--pack .dslot').count();
  const equipped=await page.locator('.sv-eqcell .dslot').count();
  const doll=await page.locator('.sv-doll').count();
  if(controls!==2||hot!==8||pack!==16||equipped!==3||doll!==1)throw new Error('Gold source layout missing: '+JSON.stringify({controls,hot,pack,equipped,doll}));
  pass(width+' Gold PACK',{controls,hot,pack,equipped,doll});
  await shot('pack');
  await page.getByRole('button',{name:'Turn character right'}).click();
  await shot('pack-turned');
  await page.getByRole('button',{name:/WORK Recipes/}).click();
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
  await page.close();
 }
 if(report.errors.length)throw new Error(report.errors.join(' | '));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
 console.log('AUTHORED GOLD SOH HOST PASS',JSON.stringify(report));
}catch(e){report.error=String(e);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1}
finally{if(browser)await browser.close();server.kill('SIGTERM')}
