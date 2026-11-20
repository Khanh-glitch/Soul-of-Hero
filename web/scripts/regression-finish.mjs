/** Run AFTER starting regression-shards, in its measured web checkout. Wait for
 * a durable terminal manifest, fill missing results serially, and compare failed
 * files to a second checkout. Resumes from JSON, never marks unknowns as passed.
 * node regression-finish.mjs shard-dir recovery-dir baseline-web baseline-report...
 * Outputs are engineering data only; there is no auto-commit or release gate. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync,spawn} from 'node:child_process';
const [shards,serial,base,...prior]=process.argv.slice(2).map(p=>path.resolve(p));const scripts=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(serial,{recursive:true});const baselineDir=path.join(serial,'baseline');fs.mkdirSync(baselineDir,{recursive:true});
const sha=cwd=>execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim();
const m=JSON.parse(fs.readFileSync(path.join(shards,'manifest.json')));if(sha(process.cwd())!==m.sha)throw Error('Wrong source checkout');const parent=sha(base);if(!parent.startsWith('79ac5f0'))throw Error('Wrong comparison checkout');
const summary=path.join(shards,'summary.json');if(!fs.existsSync(summary)){console.log('Waiting for ongoing full regression; not starting another worker.');await new Promise(resolve=>{const w=fs.watch(shards,()=>{if(fs.existsSync(summary)){w.close();resolve();}});if(fs.existsSync(summary)){w.close();resolve();}});}
const exec=(args,cwd=process.cwd(),opts={})=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{cwd,stdio:'inherit',env:{...process.env,BASELINE_SHA:parent},...opts});c.once('error',reject);c.once('exit',(code,sig)=>resolve(code??sig));});
await exec([path.join(scripts,'regression-serial.mjs'),path.join(shards,'manifest.json'),serial]);
const reports=()=>[...prior,...fs.readdirSync(baselineDir).filter(f=>f.endsWith('.json')).map(f=>path.join(baselineDir,f))].filter(fs.existsSync);
const reconcile=async()=>{const code=await exec([path.join(scripts,'regression-reconcile.mjs'),shards,serial,serial,...reports()]);if(code!==0)throw Error(`reconcile exit ${code}`);return JSON.parse(fs.readFileSync(path.join(serial,'reconciled.json')));};
const review=await reconcile();const pending=new Set(review.failures.filter(v=>v.class==='UNINVESTIGATED'&&v.baseline==='missing or different failure').map(v=>v.file));
for(const f of pending){const id=String(m.files.indexOf(f)).padStart(3,'0'),log=path.join(baselineDir,id+'.txt'),json=path.join(baselineDir,id+'.json'),done=path.join(baselineDir,id+'.status');if(fs.existsSync(done))continue;
 if(!fs.existsSync(path.join(base,f))){fs.writeFileSync(done,'not present on baseline\n');continue;}
 const fd=fs.openSync(log,'w');const args=['node_modules/vitest/vitest.mjs','run',f,'--maxWorkers=1','--testTimeout=120000','--reporter=verbose','--reporter=json','--outputFile.json='+json];console.log('BASELINE',f);
 const child=spawn(process.execPath,args,{cwd:base,detached:true,stdio:['ignore',fd,fd]});let timeout=false;const timer=setTimeout(()=>{timeout=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},m.watchdogSeconds*1000);const [code,signal]=await new Promise(r=>child.once('exit',(...a)=>r(a)));clearTimeout(timer);fs.closeSync(fd);fs.writeFileSync(done,JSON.stringify({file:f,code,signal,timeout,sha:parent})+'\n');await reconcile();}
const final=await reconcile();console.log('Qualification finished (not acceptance).');process.exitCode=final.files.every(f=>f.status==='PASSED')?0:1;
