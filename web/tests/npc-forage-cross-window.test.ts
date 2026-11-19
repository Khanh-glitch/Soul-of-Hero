import {expect,it} from 'vitest';
import {globalSourceAt,newGame,startRun,stepStations} from '../src/game/engine';
import {stepHumans} from '../src/game/humanworld';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

it('walks to a real off-window Marsh Cap, resumes the same job on reload and delivers its UID once',()=>{
  setActiveLayout('veyra05-greywater'); let gs=newGame();
  expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  let jobId='',stock=0,testedRace=false;
  for(let minute=1;minute<=150;minute++){
    const now=T0+minute*60000,r=gs.run!,hw=r.humanWorld!,cook=hw.people.hm;
    stepHumans(r,hw,now);stepStations(gs,60000,now);
    const job=cook.harvestJob;
    if(!jobId && job?.key==='mushroom' && cook.intent?.route?.length){
      expect(cook.occupation).toBe('cook');expect(cook.state).toBe('MOVING');
      expect(job.gx).toBeGreaterThanOrEqual(r.sourceMap!.veyra!.originAu[0]*2+200);
      stock=globalSourceAt(r,job.gx,job.gy,job.floor,now)!.stock;jobId=job.id;
      const resumed=validate(JSON.parse(JSON.stringify(gs)));expect(resumed).toBeTruthy();gs=resumed!;
      expect(gs.run!.humanWorld!.people[cook.actorId].harvestJob).toEqual(job);
    }else if(job?.id===jobId && job.phase==='source' && cook.state==='WORKING' && !testedRace){
      const fork=validate(JSON.parse(JSON.stringify(gs)))!.run!,fh=fork.humanWorld!,f=fh.people[cook.actorId];
      const src=globalSourceAt(fork,job.gx,job.gy,job.floor,now)!;
      src.states[src.i]={stock:0,hp:0};
      const before=JSON.stringify(fork.custody[f.inv.packId]);stepHumans(fork,fh,now+2000);
      expect(f.lastWorkBlock).toMatch(/depleted/);expect(JSON.stringify(fork.custody[f.inv.packId])).toBe(before);testedRace=true;
    }else if(job?.id===jobId && job.phase==='delivery'){
      expect(globalSourceAt(r,job.gx,job.gy,job.floor,now)!.stock).toBe(stock-1);
      expect(r.custody[cook.inv.packId].slots.find(s=>s?.production?.jobId===jobId)?.uid).toBeTruthy();
    }
    if(jobId&&!job){
      const c=hw.communities[cook.community!],delivery=Object.values(c.cargoLedger??{}).flat().filter(v=>v.jobId===jobId);
      expect(delivery).toHaveLength(1);expect(delivery[0].qty).toBe(1);
      expect(r.custody[c.storeContainers[0]].slots.some(s=>s?.key==='mushroom'&&s.uid===delivery[0].intoUid)).toBe(true);
      expect(testedRace).toBe(true);return;
    }
  }
  throw Error('cook did not deliver the selected off-window source');
},180000);
