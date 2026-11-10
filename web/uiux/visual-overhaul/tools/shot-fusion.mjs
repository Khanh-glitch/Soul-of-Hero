import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
const out=path.resolve('evidence/fusion'); fs.mkdirSync(out,{recursive:true});
const html=path.resolve('dist/index.html');
if(!fs.existsSync(html))throw Error('Build first: dist/index.html absent');
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(html).pipe(res)});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={steps:[],errors:[],inventory:{},shots:[]};
async function check(viewport){
 const [width,height]=viewport,tag=String(width);
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 const page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push(tag+':JS:'+String(e)));
 page.on('console',e=>{if(e.type()==='error')report.errors.push(tag+':CONSOLE:'+e.text())});
 async function shot(name){const p=tag+'-'+name+'.png';await page.screenshot({path:path.join(out,p)});report.shots.push(p)}
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});await page.waitForTimeout(1100);
 await page.getByRole('button',{name:/Full-Gear QA Sandbox/i}).click();
 await page.locator('.dirbtn',{hasText:'Full-Gear World'}).first().click();
 await page.getByRole('button',{name:/Launch QA Sandbox/i}).click();
 await page.waitForTimeout(850);await page.keyboard.press('F9');await page.waitForTimeout(1800);
 await shot('01-game');
 await page.keyboard.press('KeyJ');await page.waitForTimeout(300);
 const ledger=page.locator('.ledger');if(!await ledger.isVisible())throw Error(tag+' A Ledger missing');
 await shot('02-ledger');
 // Track a real Fieldcraft objective, then switch without reopening Ledger.
 const track=page.locator('.ledger button',{hasText:/track/i});if(await track.count())await track.first().click();
 await page.keyboard.press('Escape');await page.waitForTimeout(220);
 const waymark=page.locator('.wm').first();if(!await waymark.isVisible())throw Error(tag+' Waymark missing');
 await shot('03-waymark');
 const switchBtn=page.getByRole('button',{name:'Switch tracked goal'});
 if(!await switchBtn.isVisible())throw Error(tag+' quick switch missing');
 await switchBtn.click();await page.waitForTimeout(160);
 if(!await page.locator('.wm__switch').isVisible())throw Error(tag+' no in-world goal switcher');
 const popup=await page.locator('.wm__switch').boundingBox();
 if(!popup || popup.x < 0 || popup.y < 0 || popup.x+popup.width > width+1 || popup.y+popup.height > height+1)throw Error(tag+' goal switcher clipped: '+JSON.stringify(popup));
 const options=await page.locator('.wm__switch-row').count();if(options<2)throw Error(tag+' expected multiple real goals');
 await shot('04-quick-switch');
 await page.locator('.wm__switch-row').nth(1).click();await page.waitForTimeout(220);
 report.steps.push(tag+' quick goal switched inline, options='+options);
 await page.keyboard.press('KeyI');await page.waitForTimeout(300);
 const pane=page.locator('.sv-left');if(!await pane.isVisible())throw Error(tag+' Survivor pack missing');
 const box=await pane.evaluate(e=>{
  const style=getComputedStyle(e);
  const item=e.querySelector('.iteminfo');
  const scroller=document.querySelector('.sv-tiles');
  return {overflowY:style.overflowY,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,
    itemOverflow:item?getComputedStyle(item).overflowY:null,
    catalogScrollbar:scroller?getComputedStyle(scroller).scrollbarWidth:null,
    bodyScroll:document.documentElement.scrollHeight>window.innerHeight+1,
    gridSlots:e.querySelectorAll('.dgrid .dslot').length,
    paneRect:e.getBoundingClientRect().toJSON(),gridRect:e.querySelector('.dgrid')?.getBoundingClientRect().toJSON()};
 });
 report.inventory[tag]=box;
 if(box.overflowY==='auto'||box.overflowY==='scroll'||box.itemOverflow==='auto'||box.itemOverflow==='scroll')throw Error(tag+' native Inventory rail remains '+JSON.stringify(box));
 if(box.bodyScroll)throw Error(tag+' browser document scrollbar remains');
 if(box.gridSlots!==24)throw Error(tag+' slots missing: '+box.gridSlots);
 if(box.scrollHeight>box.clientHeight+4)throw Error(tag+' Inventory content clipped by '+(box.scrollHeight-box.clientHeight)+'px: '+JSON.stringify(box));
 // Visual acceptance checks: not merely absence of scrollbars. Compact layout must
 // give the 24 items a usable native-pixel footprint and the inspector a real home.
 if(width<=700){
   const visual=await pane.evaluate(e=>{
     const box=x=>x?.getBoundingClientRect().toJSON();
     return {slot:box(e.querySelector('.dgrid .dslot')),avatar:box(e.querySelector('.sv-char')),
       grid:box(e.querySelector('.dgrid')),inspector:box(e.querySelector('.iteminfo')),
       pack:box(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
   });
   report.inventory[tag].visual=visual;
   if(visual.slot.width<40||visual.avatar.height<170)throw Error(tag+' compact Inventory still squeezed '+JSON.stringify(visual));
   if(visual.inspector.width<width*.72)throw Error(tag+' compact item inspector wasted horizontal space '+JSON.stringify(visual));
   if(visual.scrollWidth>visual.clientWidth+2)throw Error(tag+' compact pack horizontally clipped '+JSON.stringify(visual));
   if(visual.inspector.bottom>visual.pack.bottom+1)throw Error(tag+' compact inspector cut off '+JSON.stringify(visual));
 }
 await shot('05-inventory');
 if(width<=700){
   await page.locator('.sv-left .dgrid .dslot').first().click();await page.waitForTimeout(220);
   const selected=await pane.evaluate(e=>({
     item:e.querySelector('.iteminfo')?.getBoundingClientRect().toJSON(),
     pane:e.getBoundingClientRect().toJSON(),
     buttons:[...e.querySelectorAll('.sv-itemacts button')].map(b=>b.textContent?.trim()),
     clipped:e.scrollHeight>e.clientHeight+3
   }));
   report.inventory[tag].selected=selected;
   if(selected.clipped||!selected.item||selected.item.bottom>selected.pane.bottom+1||selected.buttons.length<2)
     throw Error(tag+' selected-item inspector/actions clipped or missing '+JSON.stringify(selected));
   await shot('06-inventory-selected');
   await page.keyboard.press('Escape');await page.waitForTimeout(80);
   await page.locator('.sv-compact-nav button').nth(1).click();await page.waitForTimeout(200);
   if(!await page.locator('.sv-right').isVisible())throw Error('Work tab failed');
   await shot('07-work');
 }
 await ctx.close();
}
try{for(const v of [[640,360],[1280,720]])await check(v);}finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'run-log.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
if(report.errors.length)process.exit(1);
