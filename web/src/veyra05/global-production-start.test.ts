/**
 * Runtime regression, NOT real-human play certification.
 * Starts from the genuine unified-world UI layout with NO QA landing.
 * Asserts selected global coordinate, persisted source identity, no offshore
 * starts, exact source BFS, and successful serialized reload.
 */
import {describe,it,expect} from 'vitest';
import {newGame,startRun,chooseLegalSpawn} from '../game/engine';
import {setActiveLayout,getActiveLayout,getWorld} from '../game/world';
import {validate,serializeSnapshot,selectSnapshots} from '../game/persist';
import {sourceDigest} from '../game/world-economy';
import {mapDigest} from '../game/map-package';
import {U05_WORLD_LAYOUT_ID} from './scenes';
import {windowOrigin} from './continuity';
import {unverifiedOffshoreExcluded} from './global-start-discovery';

describe('Veyra global fresh-run engine integration',()=>{
 it('starts an eligible mainland spawn, survives strict save/reload, and is deterministic',()=>{
  const old=getActiveLayout();
  try{
   const now=Date.UTC(2026,10,12,12);
   const seed=0x51abcd99;
   const outcomes:string[]=[];
   for(let attempt=0;attempt<2;attempt++){
    expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
    const gs=newGame(),t=Date.now();
    const rc=startRun(gs,'male',now,null,seed);
    const elapsed=Date.now()-t;
    console.log('GLOBAL_START_SAMPLE '+JSON.stringify({seed,elapsedMs:elapsed,ok:rc.ok,reason:(rc as any).reason??null,layout:gs.run?.layoutId,spawn:gs.run?.spawnChoice}));
    expect(rc.ok).toBe(true);
    expect(gs.run).not.toBeNull();
    const r=gs.run!;
    expect(r.qaUsed).toBe(false);
    expect(r.spawnRegion).toBe(-1);
    expect(r.layoutId).toMatch(/^veyra05-at-\\d+-\\d+$/);
    const [ox,oy]=windowOrigin(r);
    const global:[number,number]=[ox+r.spawnChoice!.x,oy+r.spawnChoice!.y];
    expect(unverifiedOffshoreExcluded(global[0],global[1])).toBe(true);
    expect(r.sourceMap?.digest).toBe(sourceDigest(getWorld().sourceV3));
    expect(r.sourceMap?.mapDigest).toBe(mapDigest(getWorld()));
    expect(validate(gs)).not.toBeNull();
    const packed=serializeSnapshot(gs);
    const restored=selectSnapshots([packed]);
    expect(restored.gs?.run?.layoutId).toBe(r.layoutId);
    expect(restored.gs?.run?.spawnChoice).toEqual(r.spawnChoice);
    expect(restored.gs?.run?.sourceMap).toEqual(r.sourceMap);
    outcomes.push(r.layoutId+':'+r.spawnChoice!.x+':'+r.spawnChoice!.y);
   }
   expect(outcomes[0]).toBe(outcomes[1]);
  }finally{setActiveLayout(old);}
 },300000);

 it('keeps explicitly requested legacy demonstration region behavior',()=>{
  const old=getActiveLayout();
  try{
   expect(setActiveLayout(U05_WORLD_LAYOUT_ID)).toBe(true);
   const gs=newGame(),result=startRun(gs,'female',Date.UTC(2026,10,12,12),1,0x5eeda00);
   expect(result.ok).toBe(true);
   expect(gs.run?.spawnRegion).toBe(1);
   expect(gs.run?.qaUsed).toBe(false);
  }finally{setActiveLayout(old);}
 },120000);
});
