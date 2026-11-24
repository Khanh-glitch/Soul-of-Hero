/**
 * Seed-diversity and startup-performance audit (NO real player input).
 * All successful coordinates must be gameplay-issued and on the mainland.
 * This is a reproducible bounded test sample, NOT 11.2M-cell exhaustiveness.
 */
import {describe,it,expect} from 'vitest';
import {newGame,startRun} from '../game/engine';
import {getActiveLayout,setActiveLayout} from '../game/world';
import {validate} from '../game/persist';
import {U05_WORLD_LAYOUT_ID} from './scenes';
import {windowOrigin} from './continuity';
import {unverifiedOffshoreExcluded} from './global-start-discovery';

describe('Veyra global spawn randomized-run diversity',()=>{
 it('produces independently validated starts for a diverse set of seeds',()=>{
  const before=getActiveLayout(),now=Date.UTC(2026,10,12,11);
  const seeds=[0,1,2,3,42,43,1001,2012,0x5eeda00,0x5f00f56,0x12345678,0x51abcd99,0xabcdef01,0xffffffff,0x8badf00d,0x99887766];
  const outcomes:{seed:number;ok:boolean;ms:number;layout:string|null;global:number[]|null;reason:string|null}[]=[];
  try{
   for(const seed of seeds){
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    const gs=newGame(),t=Date.now(),rc=startRun(gs,'male',now,null,seed);
    const ms=Date.now()-t;
    const r=gs.run;
    const global=r?.spawnChoice ? windowOrigin(r).map((v,i)=>v+(i===0?r.spawnChoice!.x:r.spawnChoice!.y)):null;
    outcomes.push({seed,ok:rc.ok,ms,layout:r?.layoutId??null,global,reason:(rc as {reason?:string}).reason??null});
    if(rc.ok){
      expect(r?.qaUsed).toBe(false);
      expect(r?.spawnRegion).toBe(-1);
      expect(validate(gs)).not.toBeNull();
      expect(global&&unverifiedOffshoreExcluded(global[0],global[1])).toBe(true);
    }
   }
  }finally{setActiveLayout(before);}
  console.log('GLOBAL_SPAWN_STRESS '+JSON.stringify(outcomes));
  expect(outcomes.every(x=>x.ok)).toBe(true);
  const unique=new Set(outcomes.map(x=>x.global?.join(',')).filter(Boolean));
  // QA diversity floor only, not an approved number of canonical spawn points.
  expect(unique.size).toBeGreaterThan(8);
 },600000);
});
