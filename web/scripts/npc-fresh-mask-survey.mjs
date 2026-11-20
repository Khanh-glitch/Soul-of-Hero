// Run from web/: node scripts/npc-fresh-mask-survey.mjs measured-web-directory h24.save.gz report.json
// Repeated *static* terrain reads on the occupied h24 sites, not a survival or frame-time benchmark.
import {createServer} from 'vite';import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const [rootArg,save,out]=process.argv.slice(2),root=resolve(rootArg);const hash=v=>createHash('sha256').update(v).digest('hex');
const bytes=gunzipSync(readFileSync(save)),r=JSON.parse(JSON.parse(bytes).payload).run;
const positions=Object.values(r.humanWorld.communities).filter(c=>c.memberIds.length&&c.storeTile).map(c=>c.storeTile);
const v=await createServer({root,configFile:join(root,'vite.http.config.ts'),server:{middlewareMode:true,hmr:false}});
try{const {globalBaseFreshMask}=await v.ssrLoadModule('/src/veyra05/window.ts'),{profileWorldWork}=await v.ssrLoadModule('/src/game/world-work.ts');
 const passes=[];for(let i=0;i<2;i++){
  const {result,timings,elapsedMs}=profileWorldWork(()=>{const answers=[];let wet=0;for(const [x,y] of positions)for(let dy=-24;dy<=24;dy++){const span=24-Math.abs(dy);for(let dx=-span;dx<=span;dx++){const a=Number(globalBaseFreshMask(x+dx,y+dy));answers.push(a);wet+=a;}}
   return {queries:answers.length,wet,digest:hash(Buffer.from(answers))};});passes.push({...result,terrainCompiles:timings.compileCanonicalTerrainRegion?.calls??0,elapsedMs});
 }writeFileSync(out,JSON.stringify({scope:'Static potable mask including canonical overlays; elapsed times under shared load, not FPS',saveSHA:hash(bytes),sourceSHA:hash(readFileSync(join(root,'src/veyra05/window.ts'))),sites:positions.length,passes},null,2)+'\n');
}finally{await v.close();}
