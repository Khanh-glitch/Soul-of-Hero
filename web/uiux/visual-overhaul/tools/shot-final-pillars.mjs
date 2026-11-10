import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('evidence/final-pillars');
const dist = path.resolve('dist');
fs.mkdirSync(out, {recursive:true});
const server=http.createServer((req,res)=>{
  res.writeHead(200,{'Content-Type':'text/html'});
  fs.createReadStream(path.join(dist,'index.html')).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({args:['--no-sandbox']});
const log=[], errors=[];
try {
for (const [width,height] of [[640,360],[1280,720]]) {
  const tag=String(width);
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(tag+':'+String(e).slice(0,200)));
  page.on('console',m=>{if(m.type()==='error')errors.push(tag+':'+m.text().slice(0,200))});
  await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(1200);
  await page.getByRole('button',{name:/Full-Gear QA Sandbox/i}).click();
  await page.locator('.dirbtn',{hasText:'Full-Gear World'}).first().click();
  await page.getByRole('button',{name:/Launch QA Sandbox/i}).click();
  await page.waitForTimeout(900);
  await page.keyboard.press('F9');await page.waitForTimeout(2700);

  await page.keyboard.press('KeyM');await page.waitForTimeout(400);
  const map=page.locator('.field-map');
  if(!await map.isVisible())throw Error(tag+' map shortcut did not open real Field Chart');
  const rect=await map.boundingBox();
  if(!rect||rect.x<0||rect.y<0||rect.x+rect.width>width+1||rect.y+rect.height>height+1)
    throw Error(tag+' map viewport clipped '+JSON.stringify(rect));
  const canvas=page.locator('.chart-canvas');
  if(!await canvas.isVisible())throw Error(tag+' actual map canvas missing');
  await page.screenshot({path:out+'/'+tag+'-01-field-chart.png'});
  const before=await page.locator('.chart-zoom button.gold').first().textContent();
  await canvas.hover();
  await page.mouse.wheel(0,240);await page.waitForTimeout(350);
  const after=await page.locator('.chart-zoom button.gold').first().textContent();
  if(before===after)throw Error(tag+' wheel zoom did not change zoom: '+before);
  log.push(tag+' field chart actual wheel zoom '+before+' => '+after);
  await page.screenshot({path:out+'/'+tag+'-02-field-chart-zoom.png'});
  const notesTab=page.locator('.map-tabs button',{hasText:'Notes'}).first();
  await notesTab.click();await page.waitForTimeout(200);
  await page.screenshot({path:out+'/'+tag+'-03-field-chart-notes.png'});
  log.push(tag+' Notes filter activated');

  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  await page.keyboard.press('KeyN');await page.waitForTimeout(250);
  const notes=page.locator('.field-notes-panel');
  if(!await notes.isVisible())throw Error(tag+' Field Notes journal did not open by N');
  await page.screenshot({path:out+'/'+tag+'-04-field-notes.png'});
  log.push(tag+' contextual Notes journal visible by real keyboard input');
  await ctx.close();
}
} finally {
 await browser.close();server.close();
}
fs.writeFileSync(path.join(out,'run-log.json'),JSON.stringify({log,errors},null,2));
console.log(JSON.stringify({screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')).length,log,errors},null,2));
if(errors.length)process.exit(2);
