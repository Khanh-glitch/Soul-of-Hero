/** Reconcile original shards, per-file recovery and baselines. No inference from
 * a filename, a test title alone, an omitted test, or a green build. */
import fs from 'node:fs';import path from 'node:path';
const [shards,serial,out,...parents]=process.argv.slice(2);
const read=f=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):null;
const m=read(path.join(shards,'manifest.json')),progress=read(path.join(serial,'progress.json'));
if(progress&&progress.sha!==m.sha)throw Error('Mixed recovery SHA');
const relative=t=>m.files.find(f=>t.name===f||t.name.endsWith('/'+f));
const message=s=>(s??'').replace(/\x1b\[[\d;]*m/g,'').split('\n')[0];
// Test names can reach several assertions with the same generic message. Match
// the first project frame as well, ignoring only the checkout's absolute prefix.
const location=s=>(s??'').split('\n').map(l=>l.match(/\/(src|tests)\/([^():]+:\d+:\d+)\)?$/)).find(Boolean)?.slice(1).join('/')??'';
const failures=[],files=[];
// A baseline may be a focused run: skipped asserts in such a run are not evidence.
const base=parents.flatMap(p=>read(p)?.testResults??[]);
function compare(t,a){const f=relative(t),rows=base.filter(b=>relative(b)===f);const raw=a?a.failureMessages[0]:t.message, msg=message(raw), site=location(raw);
 const candidates=a?rows.flatMap(b=>b.assertionResults).filter(b=>b.fullName===a.fullName):rows;const parent=candidates.find(b=>b.status==='failed'&&msg&&!msg.includes('STACK_TRACE_ERROR')&&message(a?b.failureMessages[0]:b.message)===msg&&location(a?b.failureMessages[0]:b.message)===site);
 const parentPassed=candidates.some(b=>b.status==='passed');
 return {file:f,assertion:a?.fullName??'<suite>',message:msg,site,class:/timed out|timeout/i.test(msg)?'ENV-TIMEOUT':parent?'INHERITED':'UNINVESTIGATED',baseline:parent?'same failure':parentPassed?'passed; investigate differential':'missing or different failure'};
}
for(const [i,g] of m.groups.entries()){
 const group=read(path.join(shards,`shard-${i}.json`))?.testResults??[];
 for(const f of g){const s=progress?.files[f],id=String(m.files.indexOf(f)).padStart(3,'0');
 const source=group.find(t=>relative(t)===f)??(s?.log?read(path.join(serial,id+'.json'))?.testResults.find(t=>relative(t)===f):null);
 const status=s?.status==='PARTIAL-WATCHDOG'||s?.status==='ENV-TIMEOUT'?s.status:source?.status?.toUpperCase()??s?.status??'NO_REPORT';
 const a=source?.assertionResults??[];const fileStatus=status==='PASSED'&&(!a.length||a.every(v=>v.status==='pending'||v.status==='skipped'))?'SKIPPED':status;files.push({file:f,shard:i,status:fileStatus,passed:a.filter(v=>v.status==='passed').length,failed:a.filter(v=>v.status==='failed').length,skipped:a.filter(v=>v.status==='pending'||v.status==='skipped').length,report:group.includes(source)?`shard-${i}.json`:source?`serial/${id}.json`:null});
 for(const v of a.filter(v=>v.status==='failed'))failures.push(compare(source,v));if(source?.status==='failed'&&!a.some(v=>v.status==='failed'))failures.push(compare(source));
 }}
const countBy=(arr,key)=>arr.reduce((o,v)=>(o[v[key]]=(o[v[key]]??0)+1,o),{});
fs.mkdirSync(out,{recursive:true});const data={sha:m.sha,baseline:process.env.BASELINE_SHA??null,asOf:new Date().toISOString(),fingerprint:m.sourceAndTestsSHA256,fileCounts:countBy(files,'status'),failureCounts:countBy(failures,'class'),files,failures};fs.writeFileSync(path.join(out,'reconciled.json'),JSON.stringify(data,null,2)+'\n');console.log(data.asOf,JSON.stringify(data.fileCounts),JSON.stringify(data.failureCounts));
