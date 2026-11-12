import {describe,it,expect} from 'vitest';
import {newGame,startRun,blockGrid,sourceAt,chooseLegalSpawn} from '../game/engine';
import {setActiveLayout,getActiveLayout} from '../game/world';
import {getWindowWorld} from './window';
import {layoutIdAt} from './scenes';
import {localSpawnScreen} from './global-spawn-eligibility';
import {unverifiedOffshoreExcluded} from './global-start-discovery';

/**
 * Uses REAL engine map, collision, and sourceAt stock; QA landing is only
 * used in the impossible Westmouth window to create diagnostic RunState.
 * Never interpret its existence as a valid legal spawn.
 */
describe('Veyra exact local eligibility pre-screen',()=>{
 it('screens Westmouth centroid out but retains Greywater legal cells',()=>{
  const old=getActiveLayout();
  try {
   const bad=layoutIdAt(673,1096);
   expect(setActiveLayout(bad)).toBe(true);
   const a=newGame(),no=startRun(a,'male',Date.UTC(2026,10,12,5),null,0x5f00f56);
   expect(no.ok).toBe(false);
   const q=newGame(),qa=startRun(q,'male',Date.UTC(2026,10,12,5),null,0x5f00f56,{tx:100,ty:100});
   expect(qa.ok).toBe(true);
   expect(q.run?.qaUsed).toBe(true);
   const w=getWindowWorld(bad).world;
   const denied=localSpawnScreen(w,blockGrid(q.run!), (tx,ty)=>sourceAt(q.run!,tx,ty),
    (gx,gy)=>unverifiedOffshoreExcluded(gx,gy));
   expect(denied.candidates).toBe(0);

   const good=layoutIdAt(1482,1122);
   expect(setActiveLayout(good)).toBe(true);
   const g=newGame(),yes=startRun(g,'male',Date.UTC(2026,10,12,5),null,0x5eeda00);
   expect(yes.ok).toBe(true);
   expect(g.run?.qaUsed).toBe(false);
   const allowed=localSpawnScreen(getWindowWorld(good).world,blockGrid(g.run!),
    (tx,ty)=>sourceAt(g.run!,tx,ty),unverifiedOffshoreExcluded);
   expect(allowed.candidates).toBeGreaterThan(0);
   const local=g.run!.spawnChoice!;
   expect(allowed.mask[local.y*200+local.x]).toBe(1);
  } finally {setActiveLayout(old);}
 },120000);

 it('never invents freshwater or 40k legal cells in Gulf West',()=>{
  const old=getActiveLayout();
  try{
   const dry=layoutIdAt(1659,1739);
   expect(setActiveLayout(dry)).toBe(true);
   const w=getWindowWorld(dry).world;
   expect(w.fresh.reduce((sum,v)=>sum+(v?1:0),0)).toBe(0);
   expect(w.spawnEligible!.reduce((sum,v)=>sum+(v?1:0),0)).toBe(0);
  }finally{setActiveLayout(old);}
 },120000);
});
