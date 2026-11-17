/** Complete test-file inventory, deterministic shards and an external watchdog for
 * synchronous code (Vitest's in-process timeout cannot interrupt a blocked event loop).
 * No omitted suite: the natural-route file is an explicit extra shard. Exit 2 means
 * incomplete/timeout; exit 1 means completed failures; only exit 0 means all green.
 * Usage: node scripts/regression-shards.mjs <output-directory>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const root=process.cwd(),out=path.resolve(process.argv[2]??'../tmp/verification/current-regression');fs.mkdirSync(out,{recursive:true});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=['src','tests'].flatMap(walk).filter(p=>/\.(test|spec)\.[cm]?[jt]sx?$/.test(p)).sort();
const isolated='tests/arena1-round2-newgame-routes.test.ts',ordinary=files.filter(f=>f!==isolated);
const groups=Array.from({length:4},(_,i)=>ordinary.filter((_,j)=>j%4===i));if(files.includes(isolated))groups.push([isolated]);
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const hash=crypto.createHash('sha256');for(const f of [...walk('src'),...walk('tests')].sort()){hash.update(f);hash.update(fs.readFileSync(f));}
const manifest={sha,sourceAndTestsSHA256:hash.digest('hex'),files,groups,watchdogSeconds:1800,maxConcurrent:2,startedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
let next=0;const results=[];
async function run(index){return new Promise(resolve=>{
 const output=fs.openSync(path.join(out,`shard-${index}.log`),'w'),started=Date.now();let timedOut=false;
 const args=['node_modules/vitest/vitest.mjs','run',...groups[index],'--maxWorkers=1','--testTimeout=120000','--reporter=verbose','--reporter=json',`--outputFile.json=${path.join(out,`shard-${index}.json`)}`];
 const child=spawn(process.execPath,args,{cwd:root,stdio:['ignore',output,output],detached:true});
 const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},3000).unref();},manifest.watchdogSeconds*1000);
 child.on('exit',(code,signal)=>{clearTimeout(timer);fs.closeSync(output);const result={index,files:groups[index],code,signal,timedOut,durationMs:Date.now()-started};results.push(result);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({manifestSHA:sha,results},null,2));console.log(JSON.stringify(result));resolve();});
 });}
async function worker(){while(next<groups.length){const i=next++;await run(i);}}
await Promise.all([worker(),worker()]);
const final={...manifest,finishedAt:new Date().toISOString(),results,scope:'Engineering regression; browser and Creator acceptance are independent.'};fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(final,null,2));
process.exit(results.some(r=>r.timedOut||r.signal||r.code===null)?2:results.some(r=>r.code!==0)?1:0);
