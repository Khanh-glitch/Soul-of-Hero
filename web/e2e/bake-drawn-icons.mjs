/** Bake existing ORIGINAL procedural UI pixels; never edits/creates approved art.
 * Run from web/ against Vite. Node zlib is build tooling ONLY; no PNG encoder ships.
 * Use --check for source/pixel equality without writing. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const target='e2e/support/drawn-icons-experiment.json';
const sources=['art.ts','industrial-art.ts','hero-art.ts','vehicle-art.ts','core-art.ts','core.ts','catalog.ts'].map(p=>'src/game/'+p);
const provenance=Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const table=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const t=Buffer.from(type),body=Buffer.concat([t,data]);let crc=0xffffffff;for(const b of body)crc=table[(crc^b)&255]^(crc>>>8);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
function png(w,h,rgba){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)rgba.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
try{
 const page=await browser.newPage();await page.route('**/__bake_icons',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body>Original procedural icon build tooling</body>'}));
 await page.goto((process.env.SOH_BASE_URL||'http://127.0.0.1:5173')+'/__bake_icons');
 const pixels=await page.evaluate(async()=>{const {getArt}=await import('/src/game/art.ts'),art=getArt(),out={};for(const [type,group]of Object.entries({icon:art.icon,st:art.st}))for(const [id,c]of Object.entries(group)){const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let b='';for(const n of p)b+=String.fromCharCode(n);out[(type==='st'?'st:':'')+id]={w:c.width,h:c.height,rgba:btoa(b)};}return out;});
 const icons=Object.fromEntries(Object.entries(pixels).map(([key,p])=>[key,{w:p.w,h:p.h,rgbaSha256:createHash('sha256').update(Buffer.from(p.rgba,'base64')).digest('hex'),url:png(p.w,p.h,Buffer.from(p.rgba,'base64'))}]));
 const result={schema:'soh-original-drawn-ui-pixels-v1',provenance,icons};
 // Browser PNG decode proves the actual exported assets, not just encoder roundtrip assumptions.
 const mismatches=await page.evaluate(async icons=>{const {getArt}=await import('/src/game/art.ts'),art=getArt(),bad=[];for(const [key,v]of Object.entries(icons)){const img=new Image();img.src=v.url;await img.decode();const c=document.createElement('canvas');c.width=v.w;c.height=v.h;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const a=g.getImageData(0,0,v.w,v.h).data,src=key.startsWith('st:')?art.st[key.slice(3)]:art.icon[key],b=src.getContext('2d').getImageData(0,0,v.w,v.h).data;if(a.length!==b.length||!a.every((x,i)=>x===b[i]))bad.push(key);}return bad;},icons);
 if(mismatches.length)throw Error('Pixel changes: '+mismatches.join(','));
 if(process.argv.includes('--check')){if(JSON.stringify(JSON.parse(readFileSync(target)))!==JSON.stringify(result))throw Error('Baked assets stale. Regenerate with node e2e/bake-drawn-icons.mjs');}
 else writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',count:Object.keys(icons).length,pixelMismatches:mismatches,bytes:JSON.stringify(result).length,check:process.argv.includes('--check')}));
}finally{await browser.close();}
