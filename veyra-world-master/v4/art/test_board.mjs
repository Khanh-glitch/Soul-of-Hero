import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../../');
const require=createRequire(path.join(ROOT,'world_lab/package.json'));
const puppeteer=require('puppeteer-core');
const arch=require('@sparticuz/chromium');
const html=path.join(HERE,'AUDITION_01_REAL_ASSETS.html');
const output=path.join(HERE,'evidence');
fs.mkdirSync(output,{recursive:true});
function assertSource(){const s=fs.readFileSync(html,'utf8');assert.ok(s.includes('NOT NATIVE ACCEPTANCE'));assert.ok(s.includes('LAB COMPOSITION'));assert.ok(s.includes('WMP-04'));assert.ok((s.match(/data:image\/png;base64/g)||[]).length>=1);return s.length}
const sourceBytes=assertSource();
const exe=process.env.CHROME_BIN||await arch.executablePath();
const browser=await puppeteer.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
let errors=[],results=[];
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
 await page.goto(pathToFileURL(html).href,{waitUntil:'load',timeout:25000});
 await page.evaluate(()=>Promise.all(Object.values(imgs).map(i=>i.decode().catch(()=>null))));
 const groups=['forest','snow','dry','sea','architecture'];
 for(let j=0;j<groups.length;j++){
  const id=groups[j];await page.click('#nav button[data-id="'+id+'"]');await new Promise(resolve=>setTimeout(resolve,80));
  const z=await page.evaluate(()=>({
   title:document.getElementById('sceneTitle').textContent,
   summary:document.getElementById('numbers').textContent,
   sources:document.querySelectorAll('#sources .source').length,
   baselineLoaded:document.getElementById('baseline').naturalWidth===640,
   canvasNotEmpty:Array.from(document.getElementById('scene').getContext('2d').getImageData(0,0,640,360).data).some((n,k)=>k%4===3&&n!==0),
  }));
  assert.ok(z.title);assert.ok(z.summary.includes('WMP04 @ AU'));assert.equal(z.sources,3);assert.ok(z.baselineLoaded);assert.ok(z.canvasNotEmpty);
  const dest=path.join(output,String(j+1).padStart(2,'0')+'_'+id+'_source_and_lab.png');
  await page.screenshot({path:dest,fullPage:false});
  const size=fs.statSync(dest).size;assert.ok(size>35000);
  results.push({scene:id,...z,path:path.relative(ROOT,dest),bytes:size,sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')});
 }
 assert.deepEqual(errors,[]);
 await page.click('#nav button[data-id="snow"]');
 await page.click('#props');const propsOff=await page.evaluate(()=>document.getElementById('props').checked===false);assert.ok(propsOff);
 await page.click('#terrain');const terrainOff=await page.evaluate(()=>document.getElementById('terrain').checked===false);assert.ok(terrainOff);
 await page.click('#grid');const gridOn=await page.evaluate(()=>document.getElementById('grid').checked===true);assert.ok(gridOn);
 const o={schema:'soh.wmp04.art_audition_browser.qa.v1',status:'BROWSER_PREVIEW_PASS__NOT_NATIVE_GAMEPLAY',headSource:'103a755477a8086ff29c11aad0fcbdeab6900165',embeddedSourceBytes:sourceBytes,screens:results,errors};
 fs.writeFileSync(path.join(output,'browser_results.json'),JSON.stringify(o,null,2));
 console.log('WMP04_ART_BOARD_PASS',results.length,'scenes, 13 assets, no JS errors');
}catch(e){console.error('ART_BOARD_TEST_FAILURE',e);process.exitCode=1}
finally{await browser.close()}
