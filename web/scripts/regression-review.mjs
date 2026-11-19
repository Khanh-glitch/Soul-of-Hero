/** Review a regression-shards directory, including incomplete/watchdog runs.
 * Optional focused JSON reports compare precisely the same assertion on both SHAs.
 * Usage: node scripts/regression-review.mjs fullDir outDir paired-head.json paired-base.json
 * A green assertion in a partial log never certifies a file. No automatic waivers. */
import fs from 'node:fs';import path from 'node:path';
const [dir,out,matched,...baselines]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const read=p=>p&&fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;
const m=read(path.join(dir,'manifest.json')),progress=read(path.join(dir,'progress.json'));
const strip=s=>s.replace(/\x1b\[[\d;]*m/g,'');const rel=n=>m.files.find(f=>n===f||n.endsWith('/'+f));
const files=new Map(m.files.map(f=>[f,{file:f,shard:m.groups.findIndex(g=>g.includes(f)),status:'UNINVESTIGATED',passedAssertionsSeen:0}]));
const flat=report=>(report?.testResults??[]).flatMap(t=>t.assertionResults.map(a=>({file:rel(t.name),...a})));const parents=baselines.map(read).filter(Boolean);const base=parents.flatMap(flat);const failures=new Map();
const key=(f,n)=>f+':'+n.replaceAll(' > ',' ');
function classify(a){const b=base.find(v=>v.file===a.file&&v.fullName===a.fullName);const message=strip(a.failureMessages?.[0]??'').split('\n')[0];const parent=strip(b?.failureMessages?.[0]??'').split('\n')[0];const timeout=/timed out|timeout/i.test(message);return {file:a.file,assertion:a.fullName,message,parent,class:timeout?'ENV-TIMEOUT':(b?.status==='failed'&&message&&parent===message)?'INHERITED':'UNINVESTIGATED'};}
for(const [i,group] of m.groups.entries()){
 const report=read(path.join(dir,`shard-${i}.json`)),log=path.join(dir,`shard-${i}.log`);const timedOut=progress?.results.find(r=>r.index===i)?.timedOut;
 if(!report&&fs.existsSync(log))for(const l of strip(fs.readFileSync(log,'utf8')).split('\n')){const x=l.match(/^\s*([✓×]) (\S+\.(?:tsx?|jsx?)) > (.+?)\s+[\d.]+m?s\s*$/);if(!x||!group.includes(x[2]))continue;const f=files.get(x[2]);f.status='PARTIAL_LOG';if(x[1]==='✓')f.passedAssertionsSeen++;else failures.set(key(x[2],x[3]),{file:x[2],assertion:x[3],class:'UNINVESTIGATED',message:'Partial verbose log; JSON not yet available'});}
 if(timedOut)for(const name of group){const f=files.get(name);f.watchdog='SHARD_INTERRUPTED';}
 for(const t of report?.testResults??[]){const f=files.get(rel(t.name));if(!f)continue;f.status=t.status.toUpperCase();if(t.status==='failed'&&!t.assertionResults.some(a=>a.status==='failed')){const p=parents.flatMap(r=>r.testResults).find(v=>rel(v.name)===f.file&&v.status==='failed'&&v.message&&v.message===t.message);failures.set(key(f.file,'<suite>'),{file:f.file,assertion:'<suite>',message:t.message,class:p?'INHERITED':'UNINVESTIGATED'});}f.passedAssertionsSeen=t.assertionResults.filter(a=>a.status==='passed').length;f.skipped=t.assertionResults.filter(a=>a.status==='skipped'||a.status==='pending').length;}
 for(const a of flat(report).filter(a=>a.status==='failed'))failures.set(key(a.file,a.fullName),classify(a));
}
for(const a of (matched??'').split(',').flatMap(p=>flat(read(p))).filter(a=>a.status==='failed'))failures.set(key(a.file,a.fullName),classify(a));
const review={measuredSHA:m.sha,sourceAndTestsSHA256:m.sourceAndTestsSHA256,asOf:new Date().toISOString(),baselineSHA:parents.length?process.env.BASELINE_SHA:null,complete:!!read(path.join(dir,'summary.json'))&&[...files.values()].every(f=>['PASSED','FAILED','SKIPPED'].includes(f.status)),files:[...files.values()],failures:[...failures.values()]};
fs.writeFileSync(path.join(out,'regression-review.json'),JSON.stringify(review,null,2)+'\n');console.log(review.measuredSHA,review.files.length,'files;',review.failures.length,'failures seen; complete:',review.complete);
