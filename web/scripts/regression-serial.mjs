/** Recover individual files after an interrupted regression-shards run. Run on the
 * measured checkout. Never treat a green line in a partial log as a completed file.
 * node regression-serial.mjs manifest.json output-dir [shard-index]
 * Reports for completed files in the ORIGINAL shard are reused, not rerun. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
const [manifestPath,output,onlyShard]=process.argv.slice(2);
const m=JSON.parse(fs.readFileSync(manifestPath)), dir=path.dirname(manifestPath), out=path.resolve(output);
if(onlyShard!==undefined&&!m.groups[onlyShard])throw Error('Unknown shard');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const hash=crypto.createHash('sha256');for(const f of [...walk('src'),...walk('tests')].sort()){hash.update(f);hash.update(fs.readFileSync(f));}
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==m.sha||hash.digest('hex')!==m.sourceAndTestsSHA256)throw Error('Wrong measured checkout');
fs.mkdirSync(out,{recursive:true});const index=path.join(out,'progress.json');
const results=fs.existsSync(index)?JSON.parse(fs.readFileSync(index)):{sha:m.sha,files:{}};
if(results.sha!==m.sha)throw Error('Wrong output directory');
const save=()=>{fs.writeFileSync(index+'.tmp',JSON.stringify(results,null,2)+'\n');fs.renameSync(index+'.tmp',index);};
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):null;
const original=read(path.join(dir,'progress.json'));
for(const [i,g] of m.groups.entries()){
 if(onlyShard!==undefined&&i!==Number(onlyShard))continue;
 const finished=original?.results.find(s=>s.index===i);
 if(!finished||finished.timedOut||finished.signal||![0,1].includes(finished.code))continue;
 for(const t of read(path.join(dir,`shard-${i}.json`))?.testResults??[]){const f=g.find(f=>t.name===path.resolve(f));if(!f||results.files[f])continue;const a=t.assertionResults;
 results.files[f]={status:t.status==='passed'&&a.some(a=>a.status==='passed')?'PASSED':'REVIEW',report:`shard-${i}.json`,passed:a.filter(x=>x.status==='passed').length,failed:a.filter(x=>x.status==='failed').length,skipped:a.filter(x=>['pending','skipped'].includes(x.status)).length};}
}
// A watchdog on a singleton identifies the exact file. Do not spend another
// 1800s rerunning an unchanged route stress to obtain the same non-verdict.
for(const r of original?.results??[]){if(!r.timedOut||m.groups[r.index]?.length!==1)continue;const [f]=m.groups[r.index];results.files[f]??={status:'ENV-TIMEOUT',ms:r.durationMs,originalLog:`shard-${r.index}.log`,passed:null,failed:null,skipped:null};}
const group=onlyShard===undefined?m.files:m.groups[Number(onlyShard)];
for(const f of group){
 if(results.files[f])continue;
 const id=String(m.files.indexOf(f)).padStart(3,'0'),log=fs.openSync(path.join(out,id+'.txt'),'w'),json=path.join(out,id+'.json');fs.rmSync(json,{force:true});
 const at=Date.now();let timeout=false;
 // The h336 test already ran into the shard watchdog. The standing order forbids
 // rerunning it unchanged just to duplicate that result. Preserve the exception
 // in the report; execute the two closure cases AFTER it. Never mark this file PASS.
 const bounded=f==='src/veyra05/review-r2-acceptance.test.ts'&&m.sha==='eb04debfb6ff36d29424dca898b2be6da57af8f2'&&original?.results.some(s=>s.index===0&&s.timedOut)&&fs.existsSync(path.join(dir,'shard-0.log'))&&['P0-1:', 'P0-2:', 'P1-3:', 'P1-4:'].every(label=>fs.readFileSync(path.join(dir,'shard-0.log'),'utf8').includes(label));
 const selector=bounded?['-t','R2-CLOSURE-']:[];
 results.running=f;save();console.log('RUN',f);
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',f,...selector,'--maxWorkers=1','--testTimeout=120000','--reporter=verbose','--reporter=json','--outputFile.json='+json],{detached:true,stdio:['ignore',log,log]});
 const timer=setTimeout(()=>{timeout=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},m.watchdogSeconds*1000);
 const [code,signal]=await new Promise(resolve=>child.once('exit',(...args)=>resolve(args)));clearTimeout(timer);fs.closeSync(log);
 let j;try{j=read(json);}catch{}const status=timeout?'ENV-TIMEOUT':!j||signal?'UNINVESTIGATED':bounded?'PARTIAL-WATCHDOG':code===0&&j.success&&j.numPassedTests>0?'PASSED':'REVIEW';
 results.files[f]={status,code,signal,ms:Date.now()-at,passed:j?.numPassedTests,failed:j?.numFailedTests,skipped:j?.numPendingTests,log:id+'.txt',...(bounded?{selector:selector[1],remaining:'P1-5 h336 interrupted; four earlier cases in shard-0.log'}:{})};delete results.running;save();console.log(id,status,f);
}
save();process.exitCode=group.every(f=>results.files[f]?.status==='PASSED')?0:1;
