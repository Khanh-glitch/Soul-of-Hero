/** Exact native-resolution fallback art & React lifecycle audit; not performance. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.SOH_BASE_URL||'http://127.0.0.1:5190',out=process.env.SOH_UI_PIXELS_OUT||'evidence/solo-final-fallback/20261117/ui-canvas/pixels.json';
mkdirSync('.cache',{recursive:true});writeFileSync('.cache/ui-canvas-pixel-probe.tsx',`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {ArtImage} from '/src/ui/common';import {getArt} from '/src/game/art';import {loadItemAtlas} from '/src/game/item-atlas';
export async function run(){
 const A=getArt(),entries=[...Object.entries(A.st).map(([k,c])=>['st:'+k,c]),...Object.entries(A.icon)],host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let copies=0,encodes=0;const orig=CanvasRenderingContext2D.prototype.drawImage,enc=HTMLCanvasElement.prototype.toDataURL;
 CanvasRenderingContext2D.prototype.drawImage=function(...a){if(this.canvas.dataset.icon==='drawn')copies++;return orig.apply(this,a);};HTMLCanvasElement.prototype.toDataURL=function(){encodes++;throw Error('fallback encode forbidden');};
 const render=(rev=0,items=entries)=>flushSync(()=>root.render(<div data-rev={rev}>{items.map(([key])=><ArtImage key={key} k={key} />)}</div>));
 try{
 render();const initialCopies=copies,mismatches=[];
 for(const [key,src]of entries){const c=[...host.querySelectorAll('canvas')].find(c=>c.dataset.item===key);if(!c){mismatches.push({key,reason:'missing canvas'});continue;}const a=src.getContext('2d').getImageData(0,0,src.width,src.height).data,b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 if(src.width!==c.width||src.height!==c.height||a.length!==b.length||!a.every((x,i)=>x===b[i]))mismatches.push({key,reason:'pixels/dimensions'});}
 for(let i=1;i<=20;i++)render(i);const rerenderCopies=copies-initialCopies;
 // Same mounted key, changed source, then dimensions: no stale pixels/effect dependencies.
 const first=entries[0],different=entries.find(([k,c])=>c.width!==first[1].width||c.height!==first[1].height);if(!different)throw Error('no varying native dimensions');const sourceKeys=[first[0],different[0]];flushSync(()=>root.render(<ArtImage k={sourceKeys[0]}/>));flushSync(()=>root.render(<ArtImage k={sourceKeys[1]}/>));const changed=host.querySelector('canvas'),src=entries.find(([k])=>k===sourceKeys[1])[1];
 const actual=changed.getContext('2d').getImageData(0,0,changed.width,changed.height).data,expected=src.getContext('2d').getImageData(0,0,src.width,src.height).data;const sourceChangeExact=actual.length===expected.length&&actual.every((b,i)=>b===expected[i]);
 flushSync(()=>root.render(<ArtImage k="fiber"/>));flushSync(()=>root.render(<ArtImage k="unknown-no-sprite"/>));const emptyCanvas=host.querySelector('canvas'),unknownCleared=emptyCanvas.getContext('2d').getImageData(0,0,emptyCanvas.width,emptyCanvas.height).data.every(b=>b===0);
 flushSync(()=>root.unmount());const emptyAfterUnmount=host.childElementCount===0;HTMLCanvasElement.prototype.toDataURL=enc;
 // Approved atlas still wins after normal loader: mapped item must not be canvas.
 const atlasReady=await loadItemAtlas(),approvedHost=document.createElement('div'),approvedRoot=createRoot(approvedHost);document.body.append(approvedHost);flushSync(()=>approvedRoot.render(<ArtImage k="wood"/>));const approvedImg=approvedHost.querySelector('img[data-icon="atlas157"]')!==null;flushSync(()=>approvedRoot.unmount());approvedHost.remove();
 return {checked:entries.length,mismatches,initialCopies,rerenderCopies,sourceChangeExact,unknownCleared,encodes,emptyAfterUnmount,atlasReady,approvedImg};
 }finally{CanvasRenderingContext2D.prototype.drawImage=orig;HTMLCanvasElement.prototype.toDataURL=enc;host.remove();}
}
`);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/__pixel_audit',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(base+'/__pixel_audit');
 const result=await page.evaluate(async()=>{const refresh=await import('/@react-refresh');refresh.default.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;const m=await import('/.cache/ui-canvas-pixel-probe.tsx');return await m.run();});
 mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({...result,errors,scope:'Native RGBA equality for every procedural structure/item; real React layout effects, unchanged-source rerenders, changed-source reuse/unmount, then approved atlas priority. Pixel readbacks after render, not FPS evidence.'},null,2)+'\n');console.log(JSON.stringify(result));
 assert(result.checked>=286);assert.deepEqual(result.mismatches,[]);assert.equal(result.rerenderCopies,0);assert.equal(result.encodes,0);assert.equal(result.initialCopies,result.checked);assert(result.sourceChangeExact&&result.unknownCleared&&result.emptyAfterUnmount&&result.approvedImg&&result.atlasReady);assert.deepEqual(errors,[]);
}finally{await browser.close();}
