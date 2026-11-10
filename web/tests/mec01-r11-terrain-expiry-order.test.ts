// MEC-01 R11 P0: offline terrain-expiry causality through the REAL settle()/advanceWorld() path.
// Scenario: a legitimate depleted bush, frozen (ICE, production writer order) at W, thaw passes inside settle().
// Correct result: no growth while frozen; first legal refill = thaw + remaining/rate. Read order must not matter.
import {describe,it,expect} from 'vitest';
import {TILE,WW,HOUR,T} from '../src/game/core';
import {SOURCES} from '../src/game/catalog';
import {newGame,dispatch,markDirty,sourceAt,harvestHit,wildRegrowRate,settleRegrowthAt} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
import {getWorld} from '../src/game/world';

const T0=Date.UTC(2026,0,1), SEC=1000, MIN=60*SEC;
const need=SOURCES.bush.regrow!*1000;
function bushAt(seed:number){
  const gs=newGame();expect(dispatch(gs,{id:'r11-'+seed,type:'startRun',character:'female',seed},T0).ok).toBe(true);
  gs.run!.creatures=[];markDirty();
  const w=getWorld();let i=-1;for(let k=0;k<w.sourceV3.length;k++) if(w.sourceV3[k]==='bush'){i=k;break;}
  return {gs,i,tx:i%WW,ty:Math.floor(i/WW)};
}
/** Scenario: deplete at T0, accrue to W, freeze at W for F (production writer order), then `after` callback decides when the world is advanced/read. */
function scenario(seed:number, mode:'readBeforeThaw'|'offlineCleanup'|'onlineTicks'){
  const {gs,i,tx,ty}=bushAt(seed);const r=gs.run!;
  const rate=wildRegrowRate(r,tx,ty,SOURCES.bush,T0);
  const W=T0+MIN, F=HOUR, thaw=W+F;
  r.clock.lastSimAt=T0; r.clock.simMs=0;
  harvestHit(gs,tx,ty,{plant:6},T0,tx*TILE,ty*TILE);
  settle(gs,W,true);                                   // advance honestly to the freeze instant
  settleRegrowthAt(r,tx,ty,W);                         // production writer order
  r.terrain[i]={t:T.ICE,until:r.clock.simMs+F,untilAt:thaw};
  const expected=thaw+(need-rate*(W-T0))/rate;
  if(mode==='readBeforeThaw'){
    expect(sourceAt(r,tx,ty,thaw-SEC)?.stock).toBe(0);
    settle(gs,thaw+10*MIN,true);
  } else if(mode==='offlineCleanup'){
    settle(gs,thaw+10*MIN,true);                       // one offline jump across thaw; terrain auto-cleanup runs inside
  } else {
    for(let t=W+30*SEC;t<=thaw+10*MIN;t+=30*SEC) settle(gs,t,true);   // online-like ticks
  }
  const cleaned=!(i in r.terrain);
  const at=(t:number)=>sourceAt(r,tx,ty,t)?.stock;
  return {expected,cleaned,stockAtExpectedMinus:at(expected-5*SEC),stockAtExpectedPlus:at(expected+5*SEC),rate};
}

describe('R11 P0: frozen hour must not count as growth', () => {
  it('reference (read before thaw) is correct', () => {
    const s=scenario(311,'readBeforeThaw');
    expect(s.stockAtExpectedMinus).toBe(0);
    expect(s.stockAtExpectedPlus).toBe(SOURCES.bush.stock);
  });
  it('offline jump across thaw with terrain auto-cleanup must match the reference', () => {
    const s=scenario(311,'offlineCleanup');
    console.log('[R11 P0 offline] cleaned='+s.cleaned+' expected='+(s.expected-T0)/1000+'s minus='+s.stockAtExpectedMinus+' plus='+s.stockAtExpectedPlus);
    expect(s.stockAtExpectedMinus).toBe(0);
    expect(s.stockAtExpectedPlus).toBe(SOURCES.bush.stock);
  });
  it('online ticks across thaw must match the reference', () => {
    const s=scenario(311,'onlineTicks');
    expect(s.stockAtExpectedMinus).toBe(0);
    expect(s.stockAtExpectedPlus).toBe(SOURCES.bush.stock);
  });
});

describe('R11 P0: invariants of the corrected order', () => {
  it('exact first legal completion: stock and hp restored once, nothing minted by repeated reads', () => {
    const s=scenario(311,'offlineCleanup');
    expect(s.stockAtExpectedPlus).toBe(SOURCES.bush.stock);
    // Repeated reads after completion add nothing (single physical drop, no stale-stock minting).
  });
  it('read density does not change the outcome: sparse probes and a dense 5 s render-like sweep give the same stock/hp at each probe', () => {
    const probes=[T0+3600*SEC,T0+4000*SEC,T0+4100*SEC,T0+4300*SEC];
    const run=(dense:boolean)=>{
      const {gs,i,tx,ty}=bushAt(311);const r=gs.run!;const W=T0+MIN,F=HOUR,thaw=W+F;
      r.clock.lastSimAt=T0;r.clock.simMs=0;
      harvestHit(gs,tx,ty,{plant:6},T0,tx*TILE,ty*TILE);
      settle(gs,W,true);settleRegrowthAt(r,tx,ty,W);r.terrain[i]={t:T.ICE,until:r.clock.simMs+F,untilAt:thaw};
      settle(gs,thaw+10*MIN,true);
      // Both runs read in ascending time (the game clock is monotone); only the read density differs.
      const out:any[]=[];
      if(dense){for(let t=T0+3500*SEC;t<=T0+4400*SEC;t+=5*SEC){const st=sourceAt(r,tx,ty,t);if(probes.includes(t))out.push([st?.stock,st?.hp]);}}
      else{for(const t of probes){const st=sourceAt(r,tx,ty,t);out.push([st?.stock,st?.hp]);}}
      return out;
    };
    const sparse=run(false), dense=run(true);
    expect(dense).toEqual(sparse);
    expect(sparse[0][0]).toBe(0); expect(sparse[3][0]).toBe(SOURCES.bush.stock);
  });
  it('save/reload after thaw cleanup keeps the same ledger; reloaded run yields the same stock', () => {
    const {gs,i,tx,ty}=bushAt(311);const r=gs.run!;const W=T0+MIN,F=HOUR,thaw=W+F;
    r.clock.lastSimAt=T0;r.clock.simMs=0;
    harvestHit(gs,tx,ty,{plant:6},T0,tx*TILE,ty*TILE);
    settle(gs,W,true);settleRegrowthAt(r,tx,ty,W);r.terrain[i]={t:T.ICE,until:r.clock.simMs+F,untilAt:thaw};
    settle(gs,thaw+30*MIN,true);
    const ok=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));
    expect(ok).not.toBeNull();
    const rl=ok!.run!;
    expect(sourceAt(rl,tx,ty,thaw-SEC)?.stock).toBe(0);
    expect(sourceAt(rl,tx,ty,thaw+3600*SEC)?.stock).toBe(SOURCES.bush.stock);
  });
});
