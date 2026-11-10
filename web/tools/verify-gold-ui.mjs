/**
 * Browser smoke for the REAL SOH/Veyra app, not the standalone PR #52 prototype.
 * No QA state injection, no UI mocks. Saves four pixel-perfect screenshot artifacts.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const output = path.join(cwd, 'evidence', 'gold-ui-composed');
fs.mkdirSync(output, {recursive:true});
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'], {cwd,stdio:'pipe'});
let serverLog = '';
server.stdout.on('data', b=> {serverLog+=b.toString()});
server.stderr.on('data', b=> {serverLog+=b.toString()});
async function awaitServer(){
  for(let k=0;k<120;k++){
    try {let r=await fetch('http://127.0.0.1:5173/');if(r.ok)return;}
    catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  throw new Error('Vite server did not start: '+serverLog.slice(-3000));
}
const report={errors:[],screens:[],inventory:{},journey:{},map:{}};
let browser;
try {
  await awaitServer();
  browser=await chromium.launch({headless:true});
  for(const width of [640,1280]){
    const page=await browser.newPage({viewport:{width,height:width===640?360:720},deviceScaleFactor:1,hasTouch:false});
    page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())});
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle',timeout:60000});
    await page.getByRole('button',{name:'New run'}).waitFor({timeout:30000});
    await page.getByRole('button',{name:'New run'}).click();
    await page.getByRole('button',{name:'Begin the 14 days'}).click();
    await page.locator('canvas').first().waitFor({timeout:30000});
    await page.waitForTimeout(700);
    const prefix=width+'-';
    const shot=async label=>{const name=prefix+label+'.png';await page.screenshot({path:path.join(output,name)});report.screens.push(name)};
    // A real UI preference must survive the same R12 save/restart as the game,
    // without fabricating a daily reward or a new profile authority.
    await page.locator('.gold-waymark select').selectOption('explore');
    await page.waitForTimeout(1800);
    await page.reload({waitUntil:'networkidle',timeout:60000});
    await page.getByRole('button',{name:/Continue/}).waitFor({timeout:30000});
    await page.getByRole('button',{name:/Continue/}).click();
    await page.locator('.gold-waymark select').waitFor({timeout:10000});
    const restored=await page.locator('.gold-waymark select').inputValue();
    if(restored!=='explore')throw new Error('Gold Waymark tracked goal not restored from R12 save: '+restored);
    report.journey[width]={restored};
    await shot('game');
    await page.keyboard.press('i');
    await page.locator('.gold-inventory').waitFor({timeout:10000});
    await page.waitForTimeout(400); // Capture after panel entrance animation, not a transparent in-between frame.
    const inv=await page.locator('.gold-inv-grid').evaluate(el=>({count:el.querySelectorAll('.slot').length,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,gridWidth:Math.round(el.getBoundingClientRect().width),slotWidth:parseFloat(getComputedStyle(el.querySelector('.slot')).width||'0')}));
    report.inventory[width]=inv;
    if(inv.count!==24)throw new Error('Inventory expected 24 authentic slots, got '+inv.count);
    if(inv.clientHeight<inv.scrollHeight)throw new Error('Inventory scroll overflow at '+width+': '+JSON.stringify(inv));
    if(inv.slotWidth!==42)throw new Error('Slot not 42px at '+width+': '+JSON.stringify(inv));
    await shot('inventory');
    // Gold WORK is no longer an unconnected showcase. It reads the real known
    // recipes and checks actual R12 station/material gates; no reward injection.
    await page.getByRole('tab',{name:/WORK/}).click();
    await page.getByTestId('gold-work').waitFor({timeout:10000});
    const workCount=await page.locator('.gold-work__recipe').count();
    if(workCount<1)throw new Error('Gold WORK shows no real known recipes');
    const detail=await page.locator('.gold-work__detail').innerText();
    if(!detail.trim())throw new Error('Gold WORK missing recipe detail');
    await page.waitForTimeout(350);
    report.inventory[width].workRecipes=workCount;
    report.inventory[width].workHasDetail=detail.trim().length>10;
    await shot('work');
    await page.getByRole('tab',{name:/PACK/}).click();
    if(await page.locator('.gold-inv-grid .slot').count()!==24)throw new Error('Pack cells missing after WORK → PACK');
    await page.keyboard.press('i');
    await page.keyboard.press('j');
    await page.getByRole('dialog',{name:'Expedition Ledger'}).waitFor({timeout:10000});
    await page.waitForTimeout(400);
    const goals=await page.locator('.gold-ledger__goal').count();
    if(goals!==7)throw new Error('Ledger expected seven optional goals, got '+goals);
    report.journey[width]={...report.journey[width],goals,sourceReal:await page.locator('.gold-ledger__chronicle').count()};
    await shot('ledger');
    await page.getByRole('tab',{name:'CHRONICLE'}).click();
    await page.locator('.gold-ledger__chronicle--full').waitFor({timeout:10000});
    report.journey[width].chronicleReceipts=await page.locator('.gold-ledger__chronicle--full .gold-ledger__event').count();
    await shot('chronicle');
    await page.getByRole('tab',{name:'LEGACY'}).click();
    await page.locator('.gold-ledger__achievements').waitFor({timeout:10000});
    await shot('legacy');
    await page.getByRole('tab',{name:'FIELD NOTES'}).click();
    await page.keyboard.press('j');
    await page.keyboard.press('m');
    const map=await page.locator('.panel-h').filter({hasText:/Map/}).count();
    report.map[width]={mapPanelHeadings:map};
    if(!map)throw new Error('M did not open real World Map');
    await page.waitForTimeout(400);
    await shot('map');
    await page.keyboard.press('m');
    await page.keyboard.press('c');
    await page.getByTestId('gold-work').waitFor({timeout:10000});
    const cWork=await page.getByRole('tab',{name:/WORK/}).getAttribute('aria-selected');
    if(cWork!=='true')throw new Error('C did not open the unified Gold WORK tab');
    report.inventory[width].cShortcutWork=cWork==='true';
    await shot('shortcut-work');
    await page.keyboard.press('i');
    await page.locator('.gold-inv-grid .slot').first().waitFor({timeout:10000});
    report.inventory[width].iShortcutPack=true;
    await page.close();
  }
  if(report.errors.length)throw new Error('Browser JS errors: '+report.errors.join(' | '));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  process.stdout.write('GOLD UI COMPOSED BROWSER PASS\n'+JSON.stringify(report,null,2)+'\n');
} catch(e) {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,error:String(e),serverLog:serverLog.slice(-2000)},null,2));
  process.stderr.write(String(e)+'\n');
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
