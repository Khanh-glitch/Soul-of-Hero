// A completed clock is not a passing campaign. Read actual milestone snapshots;
// missing files, missing living communities, and missing outcome evidence fail.
// Run: node scripts/npc-campaign-gate.mjs <npc-endurance output> [report.json]
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const [dir,file]=process.argv.slice(2);if(!dir)throw Error('Expected the endurance output directory');
const json=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const p=json('progress.json');const report={sha:p.sha,seed:p.seed,runId:p.runId,scope:'Engineering campaign only, not browser or creator review',checks:[]};
const check=(name,ok,evidence)=>report.checks.push({name,ok:!!ok,evidence});
check('Ordinary campaign covers every hour through h336',p.complete===true&&p.minute===336*60&&p.actors===286&&
 p.reports.length===336&&p.reports.every((row,i)=>row.minute===(i+1)*60&&/^[a-f0-9]{64}$/.test(row.digest)),
 {actors:p.actors,lastMinute:p.minute,observedHours:p.reports.length});
for(const hour of [264,312,335,336]){
 try{
  const m=json(`h${hour}.json`),text=gunzipSync(readFileSync(join(dir,`h${hour}.save.gz`))).toString(),gs=JSON.parse(JSON.parse(text).payload);
  const digest=createHash('sha256').update(text).digest('hex');
  check(`h${hour} identity and snapshot`,m.sha===p.sha&&m.seed===p.seed&&m.runId===p.runId&&!m.qa&&m.hour===hour&&m.digest===digest&&p.reports.find(q=>q.minute===hour*60)?.digest===digest,digest);
  if(hour<336){
    const r=gs.run,hw=r.humanWorld;
    check(`h${hour} ordinary world and exact clock`,r.id===p.runId&&r.seed===p.seed&&!r.qaUsed&&r.clock.lastSimAt===r.startedAt+hour*3600000&&Object.keys(hw.people).length===p.actors,r.clock.lastSimAt);
    if(hour===264||hour===312){
      const fit=Object.values(hw.people).filter(h=>h.community&&h.hp>=30&&h.hunger>=25&&h.thirst>=25&&!h.transit&&!['DEAD','DOWNED','EVACUATED','ON_VESSEL'].includes(h.state));
      const communities=[...new Set(fit.map(h=>h.community))];check(`h${hour} has residents fit to work`,fit.length>0,{count:fit.length,communities});
      const awake=Object.values(hw.elderPressure).filter(e=>e.awakenedAt!==undefined).map(e=>e.elderId);
      check(`h${hour} awakening`,hour===264?awake.length===0:new Set(awake).size===6,awake);
    }
    if(hour===335){const ports=Object.values(hw.evacuation).map(v=>v.site).sort();check('Only the three physical services',ports.join(',')==='po_evac_hook,po_evac_south,po_evac_west',ports);}
  }else{
    const o=gs.profile.humanRunHistory?.find(h=>h.runId===p.runId&&h.ending==='expired')?.outcomes;
    check('One K8 wipe, partitioned census',gs.run===null&&gs.profile.history.filter(h=>h.runId===p.runId&&h.ending==='expired').length===1&&o?.total===p.actors&&[o.dead,o.evacuated,o.survived,o.unresolved].every(n=>Number.isInteger(n)&&n>=0)&&o.total===o.dead+o.evacuated+o.survived+o.unresolved,o??null);
    const services=m.ports.flatMap(v=>(v.departures??[]).filter(d=>d.departedReceipt&&d.arrivalReceipt&&
      d.departAt<d.arriveAt&&d.arrivedAt>=d.arriveAt&&d.passengers.length<=v.capacity&&
      new Set(d.passengers.map(a=>a.seat)).size===d.passengers.length).map(d=>({site:v.site,round:d.round,
      passengers:d.passengers.filter(a=>a.actorId!=='player'&&a.boardedAt<=d.departAt).map(a=>a.actorId)})).filter(d=>d.passengers.length));
    const guarded=m.defenders.filter(h=>h.outcome==='SURVIVED_ON_ISLAND'&&h.threat?.guarded>0).map(h=>h.id);
    check('Same run: a passenger arrived AND a defended resident survived',o?.evacuated>0&&o.survived>0&&services.length&&guarded.length,{services,guarded,outcomes:o??null});
  }
 }catch(e){check(`h${hour} readable evidence`,false,String(e));}
}
report.passed=report.checks.every(c=>c.ok);const text=JSON.stringify(report,null,2)+'\n';if(file)writeFileSync(file,text);console.log(text);process.exitCode=report.passed?0:1;
