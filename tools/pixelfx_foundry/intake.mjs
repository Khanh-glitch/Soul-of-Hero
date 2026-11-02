#!/usr/bin/env node
// Generic PixelFX source-native discovery and export baseline.
// Usage:
// node tools/pixelfx_foundry/intake.mjs --upstream /path/to/pixelfx --out /tmp/pixelfx-out --ids ice/ice-lance
// Add --export for actual frame generation; without --export it builds the manifest only.
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, copyFileSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const argv=process.argv.slice(2);
const flag=(name,defaultValue="")=>{const i=argv.indexOf(name);return i<0?defaultValue:argv[i+1];};
const has=(name)=>argv.includes(name);
const upstream=resolve(flag("--upstream",".")), out=resolve(flag("--out","pixelfx-out"));
const maxSide=Number(flag("--page","2048")), exportAll=has("--export"), select=flag("--ids","");
const digest=b=>createHash("sha256").update(b).digest("hex");
const atomic=(file,data)=>{mkdirSync(dirname(file),{recursive:true});const tmp=file+".tmp";writeFileSync(tmp,JSON.stringify(data,null,2));renameSync(tmp,file);};
const git=(...args)=>execFileSync("git",["-C",upstream,...args],{encoding:"utf8"}).trim();
const rel=file=>relative(out,file).replaceAll("\\","/");
const rgba32 = words => {const dst=new Uint8ClampedArray(words.length*4);for(let i=0;i<words.length;i++){const w=words[i]>>>0;dst[i*4]=w&255;dst[i*4+1]=(w>>>8)&255;dst[i*4+2]=(w>>>16)&255;dst[i*4+3]=w>>>24;}return dst;};
const lightRGBA = words => {const dst=rgba32(words);for(let i=0;i<words.length;i++)dst[i*4+3]=words[i]&0xffffff?255:0;return dst;};
const save=(e,path,bytes)=>{const b=Buffer.from(bytes);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,b);e.export.files.push({path:rel(path),sha256:digest(b),bytes:b.length});};
async function run(){
 if(!existsSync(join(upstream,"tools/lib/fxlib.mjs")))throw Error("Provide a local OFFICIAL PixelFX checkout via --upstream");
 if(!Number.isInteger(maxSide)||maxSide<256||maxSide>8192)throw Error("Invalid --page");
 const sha=git("rev-parse","HEAD");
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error("Upstream checkout lacks a complete git SHA");
 if(git("status","--porcelain")&&!has("--allow-dirty"))throw Error("Upstream is dirty; supply a clean pinned git checkout");
 const src=await import(pathToFileURL(join(upstream,"tools/lib/fxlib.mjs")).href);
 const core=await import(pathToFileURL(join(upstream,"src/core/index.js")).href);
 const ids=src.allIds();
 if(ids.length!==244||new Set(ids).size!==244)throw Error("Expected exactly 244 unique FX IDs; found "+ids.length+"/"+new Set(ids).size+" at "+sha);
 const wanted=select?select.split(",").map(x=>x.trim()).filter(Boolean):ids;
 for(const id of wanted)if(!ids.includes(id))throw Error("Unknown ID: "+id);
 const indexPath=join(out,"index.json"),old=existsSync(indexPath)?JSON.parse(readFileSync(indexPath,"utf8")):null;
 if(old&&old.upstream_sha!==sha)throw Error("Existing output belongs to a different upstream SHA");
 const previous=new Map((old?.effects||[]).map(e=>[e.id,e]));
 const index={schema:"soh.pixelfx.intake.v1",upstream_sha:sha,upstream:"https://github.com/patch-gg/pixelfx",count:ids.length,categories:{},effects:[],updated:new Date().toISOString(),notes:"Asset registration does not grant SOH_READY"};
 for(const id of ids){
  const fx=await src.loadEffect(id),m=fx.meta,category=id.split("/")[0];
  index.categories[category]=(index.categories[category]||0)+1;
  const e={id,category,name:m.name,tags:m.tags||[],implementation:fx.mod.create?"simulated":"pure",hasAct:!!fx.mod.act,actorDependent:!!m.actor||!!fx.mod.act?.onBody,meta:{fps:m.fps,duration:m.duration,loop:m.loop,size:m.size,pivot:m.origin},presentation:{anchor:"UNREVIEWED",extraShapes:false,nightSafe:true},export:{state:"DISCOVERED",files:[]},qa:{pixelParity:"UNTESTED",imageReview:"PENDING",sohReady:false}};
  index.effects.push(previous.get(id)?.export?.state==="EXPORTED_VERIFIED"?previous.get(id):e);
 }
 if(Object.keys(index.categories).length!==21)throw Error("Expected 21 categories");
 atomic(indexPath,index);
 if(!exportAll){console.log("DISCOVERED",ids.length,"effects/21 categories",sha);return;}
 for(const id of wanted){
  const e=index.effects.find(x=>x.id===id);
  if(e.export?.state==="EXPORTED_VERIFIED"&&e.export.files.every(f=>existsSync(join(out,f.path))&&digest(readFileSync(join(out,f.path)))===f.sha256)){console.log("VERIFIED CACHE",id);continue;}
  const fx=await src.loadEffect(id),r=src.renderFrames(fx,{bg:"none"});
  e.export={state:"IN_PROGRESS",files:[],frames:r.n,fps:r.fps,frameSize:[r.w,r.h],pivot:fx.meta.origin,frameHashes:r.frames.map(f=>digest(Buffer.from(f.clear))),pages:{}};
  if(r.w>maxSide||r.h>maxSide) {e.export.state="BLOCKED_OVERSIZE";atomic(indexPath,index);continue;}
  // Official canonical source composite already includes light; NEVER add emissive twice.
  for(let i=0;i<r.n;i++){
   const ff=core.createFrame(r.w,r.h);ff.color.set(r.frames[i].raw);ff.light.set(r.frames[i].light);
   const recreated=core.composite(ff,new Uint8ClampedArray(r.w*r.h*4),null);
   if(Buffer.compare(Buffer.from(recreated),Buffer.from(r.frames[i].clear))!==0)throw Error(id+" channel composition mismatch at "+i);
  }
  const channels={combined:f=>f.clear,color:f=>rgba32(f.raw),light:f=>lightRGBA(f.light)};
  const cols=Math.max(1,Math.floor(maxSide/r.w)),rows=Math.max(1,Math.floor(maxSide/r.h)),perPage=cols*rows;
  for(const [ch,fn] of Object.entries(channels)){
   e.export.pages[ch]=[];
   for(let base=0;base<r.n;base+=perPage){
    const n=Math.min(perPage,r.n-base),height=Math.ceil(n/cols);
    const atlas=src.canvas(cols*r.w,height*r.h,[0,0,0,0]);
    for(let j=0;j<n;j++)atlas.paste(fn(r.frames[base+j]),r.w,r.h,(j%cols)*r.w,Math.floor(j/cols)*r.h);
    const p=join(out,"assets",id,ch+"-"+Math.floor(base/perPage)+".png");
    save(e,p,atlas.png());
    e.export.pages[ch].push({path:rel(p),first:base,count:n,columns:cols,rows:height,dimensions:[cols*r.w,height*r.h]});
   }
  }
  e.qa.pixelParity="SOURCE_BUFFER_RECOMPOSITE_PASS";
  e.qa.imageReview="PENDING_HUMAN_REVIEW";
  e.export.state="EXPORTED_VERIFIED";
  atomic(indexPath,index);
  console.log("EXPORTED",id,r.n,"frames");
 }
 for(const filename of ["LICENSE","NOTICE.md"]){const input=join(upstream,filename);if(existsSync(input))copyFileSync(input,join(out,filename));}
 atomic(indexPath,index);
 console.log("FINISHED",index.effects.filter(e=>e.export.state==="EXPORTED_VERIFIED").length,"/",ids.length,"EXPORTED; SOH_READY is NOT inferred");
}
run().catch(e=>{console.error("INTAKE FAILURE",e.message);process.exitCode=1;});
