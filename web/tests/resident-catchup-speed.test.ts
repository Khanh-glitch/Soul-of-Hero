import {describe,it,expect,beforeAll} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {humanEventBoundary,humanNeedsContext,makeHuman,prepareHumansForCatchUp,stepHumans,tickNeeds,withHumanRoster} from '../src/game/humanworld';
import type {RunState} from '../src/game/core';
import {T0} from './helpers/g1b-kit';
// The catch-up after an absence was made faster in two ways that must never change what happens on the island:
// residents share one list inside a simulation call, and their records are prepared once for heavy reading.
// These tests run the same world with and without each of them and require the same saved text.
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs.run!;}
const clone=(r:RunState):RunState=>JSON.parse(JSON.stringify(r));
/** The offline loop in small: next boundary, needs, then the human step, for `slices` slices. */
function run(r:RunState,slices:number){
 const hw=r.humanWorld!;let t=Math.max(hw.lastStepAt??0,hw.lastNeedsAt??0,hw.lastResolvedAt);
 for(let i=0;i<slices;i++){t+=humanEventBoundary(r,hw,t,5000,true);tickNeeds(r,hw,t);stepHumans(r,hw,t,true);}
 return JSON.stringify(r);
}
describe('faster catch-up keeps the same island',()=>{
 let base:RunState;
 beforeAll(()=>{base=scene();},120_000);
 it('preparing the records changes no field, no value and no field order',()=>{
  const r=clone(base),hw=r.humanWorld!,before=JSON.stringify(hw),orders=Object.values(hw.people).map(h=>Object.keys(h).join());
  prepareHumansForCatchUp(hw);
  expect(JSON.stringify(hw)).toBe(before);
  expect(Object.values(hw.people).map(h=>Object.keys(h).join())).toEqual(orders);
  expect(Object.values(hw.people).every(h=>Object.getOwnPropertySymbols(h).length===0)).toBe(true);
  prepareHumansForCatchUp(hw);
  expect(JSON.stringify(hw)).toBe(before);
 });
 it('gives the same saved world with and without prepared records, and with and without the shared list',()=>{
  const plain=clone(base),prepared=clone(base),shared=clone(base),both=clone(base),start=JSON.stringify(plain);
  const expected=run(plain,60);
  expect(expected).not.toBe(start);
  prepareHumansForCatchUp(prepared.humanWorld!);
  expect(run(prepared,60)).toBe(expected);
  expect(withHumanRoster(shared.humanWorld,()=>run(shared,60))).toBe(expected);
  prepareHumansForCatchUp(both.humanWorld!);
  expect(withHumanRoster(both.humanWorld,()=>run(both,60))).toBe(expected);
 },120_000);
 it('never serves a stale resident list',()=>{
  const a=clone(base),b=clone(base),hwA=a.humanWorld!,hwB=b.humanWorld!,first=Object.values(hwA.people)[0];
  const claims=(r:RunState,bed:string)=>humanNeedsContext(r,r.humanWorld!).bedClaims.get(bed)??0;
  const add=(r:RunState,bed:string)=>makeHuman(r,r.humanWorld!,{sourceId:'test',gx:first.gx,gy:first.gy,floor:first.floor,profile:first.profile,occupation:first.occupation,disposition:first.disposition,proficiency:0,community:first.community,bedId:bed});
  withHumanRoster(hwA,()=>{
   expect(claims(a,'bed-one')).toBe(0);
   add(a,'bed-one');
   // A resident created inside the shared stretch is seen at once.
   expect(claims(a,'bed-one')).toBe(1);
   // Another world inside this one; a resident added to the outer world meanwhile is seen after it ends.
   withHumanRoster(hwB,()=>{add(a,'bed-two');expect(claims(b,'bed-two')).toBe(0);});
   expect(claims(a,'bed-two')).toBe(1);
   // A replaced `people` object (as tests and migrations do) is read directly, never from the list.
   const kept=Object.values(hwA.people)[0];hwA.people={[kept.actorId]:kept};
   expect(humanNeedsContext(a,hwA).bedClaims.size).toBe(kept.bedId?1:0);
   expect(claims(a,'bed-one')).toBe(0);
  });
 });
});
