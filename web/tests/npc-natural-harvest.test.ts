import {shiftVeyraWindowBy} from '../src/veyra05/continuity';
import {it,expect} from 'vitest';
import {newGame,startRun,beginReceiptSink,endReceiptSink,markDirty} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';
import {measureWorldWork} from '../src/game/world-work';
import {validate} from '../src/game/persist';
import {applyFloor} from '../src/veyra05/floors';
import {getWindowWorld} from '../src/veyra05/window';
import {T0} from './helpers/g1b-kit';
it('normal population naturally selects real harvest and delivers exact physical cargo',()=>{
 setActiveLayout('veyra05-greywater');let gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
 let r=gs.run!,hw=r.humanWorld!,ids=Object.keys(hw.people),o=r.sourceMap!.veyra!.originAu,ox=o[0]*2,oy=o[1]*2;
 const starting=Object.fromEntries(Object.values(hw.people).map(h=>[h.actorId,{gx:h.gx,gy:h.gy,floor:h.floor}]));
 beginReceiptSink();const stages=new Set<string>();const sample=measureWorldWork(()=>{
 for(const ms of [5,20,40,65,90,120].map(s=>s*1000)){
  settle(gs,T0+ms,true);
  for(const h of Object.values(gs.run!.humanWorld!.people))if(h.harvestJob)stages.add(h.state==='MOVING'?(h.harvestJob.phase==='delivery'?'delivery':'travel'):h.state==='WORKING'?'work':'planning');
  const snapshot=JSON.parse(JSON.stringify(gs)),loaded=validate(snapshot);expect(loaded).not.toBeNull();gs=loaded!;r=gs.run!;hw=r.humanWorld!;
  if(ms===5000){const jobs=JSON.stringify(Object.values(hw.people).filter(h=>h.harvestJob).map(h=>[h.actorId,h.gx,h.gy,h.harvestJob]));expect(shiftVeyraWindowBy(gs,64,0,markDirty)).toBe(true);expect(JSON.stringify(Object.values(hw.people).filter(h=>h.harvestJob).map(h=>[h.actorId,h.gx,h.gy,h.harvestJob]))).toBe(jobs);}
  if(ms===20000){const w=getWindowWorld(r.layoutId!);expect(applyFloor(gs,w,w.floors,1,undefined,markDirty)).toBe(true);}
  if(ms===65000){const w=getWindowWorld(r.layoutId!);expect(applyFloor(gs,w,w.floors,0,undefined,markDirty)).toBe(true);}
 }
 });const events=endReceiptSink();
 const completed=events.filter(e=>e.kind==='human.harvest.complete');
 console.log(JSON.stringify({case:'natural-harvest-120s',...sample,completed,deliveries:events.filter(e=>e.kind==='human.cargo.deliver'),selected:events.filter(e=>e.kind==='human.harvest.select').slice(0,8),stages:[...stages]}));
 expect(Object.keys(hw.people)).toEqual(ids);expect([...stages].sort()).toEqual(['delivery','planning','travel','work']);expect(completed.length).toBeGreaterThan(0);
 const jobIds=completed.map(e=>e.detail.split(':')[0]);expect(new Set(jobIds).size).toBe(jobIds.length);
 // Harvest deliveries only: a cook's first paid meal can reach the same warehouse ledger inside these two
 // minutes, and that row names its station and recipe instead of a source.
 const ledger=Object.values(hw.communities).flatMap(c=>Object.values(c.cargoLedger??{}).flat()).filter(l=>!l.recipe);expect(ledger.length).toBeGreaterThan(0);expect(ledger.every(l=>l.qty>0&&!!l.sourceId)).toBe(true);
 const actors=completed.map(e=>e.detail.split(':').slice(1,-1).join(':'));
 expect(actors.some(id=>{const p=starting[id];return p&&p.gx>=ox&&p.gx<ox+200&&p.gy>=oy&&p.gy<oy+200;})).toBe(true);
 expect(actors.some(id=>{const p=starting[id];return p&&(p.gx<ox||p.gx>=ox+200||p.gy<oy||p.gy>=oy+200);})).toBe(true);
},90000);
