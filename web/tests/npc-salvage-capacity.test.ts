import { it, expect } from 'vitest';
import { C, globalSourceAt, mkStack, newGame, startRun } from '../src/game/engine';
import { humanHarvest, equipHumanTool } from '../src/game/humanworld';
import { humanNavigation } from '../src/game/human-navigation';
import { setActiveLayout } from '../src/game/world';
import { T0 } from './helpers/g1b-kit';

it('a field component must fit with the base yield; a rejected strike cannot consume stock or reroll it',()=>{
  setActiveLayout('veyra05-greywater'); const gs=newGame();
  expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!, hw=r.humanWorld!, comm=hw.communities['com:po_slag'];
  const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='salvager')!;
  const pack=C(r,h.inv.packId), knife=pack.slots.find(s=>s?.key==='knife')!;
  expect(equipHumanTool(r,h,knife.uid,T0)).toBe(true);
  const gx=2357,gy=1843,src=globalSourceAt(r,gx,gy,0,T0)!;
  expect(src).toMatchObject({key:'road_salvage_bale',protected:false,stock:3});
  const nav=humanNavigation(r),bank=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({tx:gx+x,ty:gy+y,floor:0})).find(p=>nav.free(p,h,true))!;
  h.gx=bank.tx; h.gy=bank.ty; h.floor=0;
  h.harvestJob={id:'hj1',gx,gy,floor:0,key:src.key,sourceId:src.sourceId,phase:'source',startedAt:T0};
  for(let i=0;i<pack.slots.length-1;i++)pack.slots[i]=mkStack(r,'wood',1);
  const hit=(at:number)=>humanHarvest(r,hw,h,gx,gy,at,true);
  expect(hit(T0+1)).toMatchObject({result:'yield',got:0}); // the first cut has not released stock
  const before={...src.states[src.i]},dur=knife.dur;
  for(const at of [T0+2,T0+3])expect(hit(at)).toMatchObject({result:'blocked',reason:expect.stringContaining('pack full')});
  expect(src.states[src.i]).toEqual(before); expect(knife.dur).toBe(dur);
  pack.slots[0]=null;expect(hit(T0+4).result).toBe('yield');expect(src.states[src.i].stock).toBe(2);
  const paid=pack.slots.filter(s=>s?.production?.jobId==='hj1');
  expect(paid.map(s=>[s!.key,s!.qty]).sort()).toEqual([['metal_pipe',1],['spares',2]]);
});
