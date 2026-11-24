// Run from web/ on the measured checkout. Instrument the existing test with observations only.
// Both observations are read-only. After the last original assertion, exercise expiry + New Game for K8.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url)),tmp='tests/tmp-final-ledger.test.ts';const before=`writeFileSync(process.env.LEDGER_DIR+'/opening-sites.json',JSON.stringify(Object.values(hw.communities).map(c=>({poi:c.poi,residents:c.memberIds,beds:c.homeBeds,stores:c.storeContainers,water:c.waterSources,stations:c.workStations,storeEntity:c.storeEntityId})),null,2));`;
const after=`writeFileSync(process.env.LEDGER_DIR+'/dual-ledger.json',JSON.stringify({run:r.id,seed:r.seed,summary,coverage:elderCoverage(hw),elders:hw.elderPressure,trips:hw.evacuation,outcomes:Object.values(hw.people).map(h=>({id:h.actorId,community:h.community,outcome:h.outcome,threat:h.threat}))},null,2));`;
const source=readFileSync('tests/npc-dual-rescue-same-run.test.ts','utf8');for(const marker of ['const trip: EvacTrip','expect(summary.total)'])if(source.split(marker).length!==2)throw Error('Source marker mismatch');const last='expect(summary.evacuated + summary.survived + summary.dead + summary.unresolved).toBe(summary.total);';if(source.split(last).length!==2)throw Error('K8 marker mismatch');const next=`
    const wall=T0+1000+336*HOUR;
    expect(endRun(gs,'expired',wall).ok).toBe(true);expect(gs.run).toBeNull();
    const history=gs.profile.humanRunHistory.at(-1);expect(history.runId).toBe(r.id);expect(history.outcomes).toEqual(summary);
    expect(startRun(gs,'female',wall+1,null,7607,{tx:100,ty:100}).ok).toBe(true);
    const next=gs.run;expect(next.id).not.toBe(r.id);expect(next.custody).not.toBe(r.custody);
    expect(Object.values(next.humanWorld.people).filter(h=>h.outcome)).toHaveLength(0);
    expect(Object.values(next.humanWorld.evacuation).flatMap(t=>t.departures??[])).toHaveLength(0);
    writeFileSync(process.env.LEDGER_DIR+'/k8.json',JSON.stringify({history,nextRun:next.id,newDepartures:0,newAssignedOutcomes:0},null,2));`;
writeFileSync(tmp,"import {endRun} from '../src/game/engine';\nimport {writeFileSync} from 'node:fs';\n"+source.replace(last,last+next).replace('const trip: EvacTrip',before+'\n    const trip: EvacTrip').replace('expect(summary.total)',after+'\n    expect(summary.total)'),{flag:'wx'});try{const p=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',tmp,'--maxWorkers=1','--testTimeout=120000'],{stdio:'inherit',env:{...process.env,LEDGER_DIR:dir}});process.exitCode=p.status??1;}finally{unlinkSync(tmp);}
