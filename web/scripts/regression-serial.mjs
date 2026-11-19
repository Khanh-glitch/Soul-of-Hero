/** Recovery runner for a memory-constrained host. Start in a clean measured checkout
 * with the manifest from regression-shards. Each file gets durable JSON + a log,
 * regardless of a later OOM/timeout. Never infer PASS from the process exit alone. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync,spawn} from 'node:child_process';
const [manifestPath,output]=process.argv.slice(2),m=JSON.parse(fs.readFileSync(manifestPath)),out=path.resolve(output);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const fingerprint=()=>{const h=crypto.createHash('sha256');for(const f of [...walk('src'),...walk('tests')].sort()){h.update(f);h.update(fs.readFileSync(f));}return h.digest('hex');};
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==m.sha||fingerprint()!==m.sourceAndTestsSHA256)throw Error('Wrong measured checkout');
fs.mkdirSync(out,{recursive:true});const index=path.join(out,'progress.json'),results=fs.existsSync(index)?JSON.parse(fs.readFileSync(index)):{};
if(results.sha&&results.sha!==m.sha)throw Error('Wrong output directory');results.sha=m.sha;results.files??={};const save=()=>{fs.writeFileSync(index+'.tmp',JSON.stringify(results,null,2)+'\n');fs.renameSync(index+'.tmp',index);};
for(const f of m.files){if(results.files[f])continue;const id=String(m.files.indexOf(f)).padStart(3,'0'),log=fs.openSync(path.join(out,id+'.txt'),'w'),json=path.join(out,id+'.json');fs.rmSync(json,{force:true});const at=Date.now();let timeout=false;
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',f,'--maxWorkers=1','--testTimeout=120000','--reporter=verbose','--reporter=json','--outputFile.json='+json],{detached:true,stdio:['ignore',log,log]});
const timer=setTimeout(()=>{timeout=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},1800000);const [code,signal]=await new Promise(resolve=>child.once('exit',(...args)=>resolve(args)));clearTimeout(timer);fs.closeSync(log);
let j;try{j=JSON.parse(fs.readFileSync(json));}catch{}const status=timeout?'ENV-TIMEOUT':!j||signal?'UNINVESTIGATED':code===0&&j.success&&j.numPassedTests>0?'PASSED':'REVIEW';results.files[f]={status,code,signal,ms:Date.now()-at,passed:j?.numPassedTests,failed:j?.numFailedTests,skipped:j?.numPendingTests,log:id+'.txt'};save();console.log(id,status,f);}
process.exitCode=Object.values(results.files).every(v=>v.status==='PASSED')?0:1;
