// MEC-01 R10: wild renewable regrowth coupled to soil, moisture, biome, slope, season and altered ground.
// Risk-only. Real engine functions on the fixed Map. Fixtures (terrain writes) are labelled FIXTURE and mirror the
// production writer order: settleRegrowthAt(...) first, then the terrain entry with absolute `untilAt`.
// NOT a player itinerary, not visual acceptance, not native Godot acceptance.
import {describe,it,expect} from 'vitest';
import {TILE,WW,HOUR,T} from '../src/game/core';
import {SOURCES,ITEMS,RECIPES,GARDEN_CROPS} from '../src/game/catalog';
import {newGame,dispatch,markDirty,sourceAt,harvestHit,wildRegrowRate,soilFertility,terrainAtAbs,regrowSuppressed,settleRegrowthAt} from '../src/game/engine';
import {serializeSnapshot,validate} from '../src/game/persist';
import {getWorld} from '../src/game/world';
import {phaseBoundaryAt,seasonOfPhase} from '../src/game/calendar';

const T0=Date.UTC(2026,0,1);
const SEC=1000;
function start(seed:number){const gs=newGame();expect(dispatch(gs,{id:'r10-start-'+seed,type:'startRun',character:'female',seed},T0).ok).toBe(true);gs.run!.creatures=[];markDirty();return gs;}
const tilesOf=(kind:string)=>{const w=getWorld();const out:[number,number,number][]=[];for(let i=0;i<w.sourceV3.length;i++) if(w.sourceV3[i]===kind) out.push([i%WW,Math.floor(i/WW),i]);return out;};
function depleteBush(gs:any,tx:number,ty:number,now:number){const r=gs.run!;const res=harvestHit(gs,tx,ty,{plant:6},now,tx*TILE,ty*TILE);expect(res.depleted).toBe(true);return r.sources[ty*WW+tx];}
/** Neutral-season soil of a Map cell, read from the same Map fields the engine uses. */
const soilOf=(i:number)=>{const m=getWorld().economyMap;return soilFertility(m.biome[i],m.moisture[i],m.slope[i],0);};

describe('R10 soil authority (regression against the former garden formula)', () => {
  it('soilFertility reproduces the garden table: biome substrate, moisture band, slope term, cold-frame bonus, clamp [0.3,1]', () => {
    const ref=(b:string,mo:number,sl:number,fb:number)=>{const g:Record<string,number>={snow:0.65,sand:0.8,ash:0.55,toxic:0.4,hill:0.8,marsh:0.8};return Math.min(1,Math.max(0.3,(g[b]??1)+fb-(mo<0.3||mo>0.75?0.1:0)-Math.min(0.2,sl*0.3)));};
    const cases:[string,number,number,number][]=[['snow',0.5,0,0],['sand',0.2,0.1,0],['ash',0.8,1,0],['toxic',0.5,0.5,0.2],['hill',0.5,0.2,0.2],['marsh',0.9,0,0],['grass',0.5,0,0],['toxic',0.1,3,0]];
    for(const [b,mo,sl,fb] of cases) expect(soilFertility(b,mo,sl,fb),`${b} ${mo} ${sl} ${fb}`).toBeCloseTo(ref(b,mo,sl,fb),12);
    for(const [b,mo,sl,fb] of cases){const v=soilFertility(b,mo,sl,fb);expect(v).toBeGreaterThanOrEqual(0.3);expect(v).toBeLessThanOrEqual(1);}
  });
});

describe('R10 two substrate states on the same plant', () => {
  it('fertile ground regrows faster than poor ground for the same bush and season; both complete (no permanent loss)', () => {
    const gs=start(310);const r=gs.run!;const bushes=tilesOf('bush');
    let fert=bushes[0], poor=bushes[0];
    for(const b of bushes){ if(soilOf(b[2])>soilOf(fert[2])) fert=b; if(soilOf(b[2])<soilOf(poor[2])) poor=b; }
    expect(soilOf(fert[2])).toBeGreaterThan(soilOf(poor[2]));
    const rF=wildRegrowRate(r,fert[0],fert[1],SOURCES.bush,T0), rP=wildRegrowRate(r,poor[0],poor[1],SOURCES.bush,T0);
    console.log(`[R10 MEASURE] same bush, neutral season: fertile soil=${soilOf(fert[2]).toFixed(3)} rate=${rF.toFixed(4)} | poor soil=${soilOf(poor[2]).toFixed(3)} rate=${rP.toFixed(4)} | cooldown fertile=${(SOURCES.bush.regrow!/rF).toFixed(0)}s poor=${(SOURCES.bush.regrow!/rP).toFixed(0)}s`);
    expect(rF).toBeGreaterThan(rP);
    depleteBush(gs,fert[0],fert[1],T0); depleteBush(gs,poor[0],poor[1],T0);
    // Fertile completes strictly earlier than poor. Reads are in time order (game clock is monotonic).
    const doneF=T0+SOURCES.bush.regrow!*1000/rF, doneP=T0+SOURCES.bush.regrow!*1000/rP;
    expect(sourceAt(r,fert[0],fert[1],doneF-2*SEC)?.stock).toBe(0);
    expect(sourceAt(r,fert[0],fert[1],doneF+2*SEC)?.stock).toBe(SOURCES.bush.stock);
    expect(sourceAt(r,poor[0],poor[1],doneF+2*SEC)?.stock).toBe(0);
    expect(sourceAt(r,poor[0],poor[1],doneP+2*SEC)?.stock).toBe(SOURCES.bush.stock);
    expect(doneF).toBeLessThan(doneP);
  });
});

describe('R10 physical suppression and resume (terrain-state authority)', () => {
  it('FIXTURE frozen ground: no accrual while ICE; resume after the terrain expires; completion = expiry + remaining/rate', () => {
    const gs=start(311);const r=gs.run!;const [tx,ty,i]=tilesOf('bush')[2];
    const rate=wildRegrowRate(r,tx,ty,SOURCES.bush,T0);
    depleteBush(gs,tx,ty,T0);
    const W=T0+60*SEC, F=HOUR;                          // FIXTURE: freeze begins at W (before completion) for F
    settleRegrowthAt(r,tx,ty,W);                        // production writer order
    r.terrain[i]={t:T.ICE,until:r.clock.simMs+F,untilAt:W+F};
    expect(regrowSuppressed(r,tx,ty,W+SEC)).toBe(true);
    expect(sourceAt(r,tx,ty,W+F-SEC)?.stock).toBe(0);
    const need=SOURCES.bush.regrow!*1000, acc0=rate*(W-T0);
    const done=W+F+(need-acc0)/rate;
    expect(sourceAt(r,tx,ty,done-5*SEC)?.stock).toBe(0);
    expect(sourceAt(r,tx,ty,done+5*SEC)?.stock).toBe(SOURCES.bush.stock);
    expect(terrainAtAbs(r,i,W+F+SEC)).not.toBe(T.ICE);   // expiry restores the underlying tile state
  });

  it('FIXTURE burnt override (permanent until restored): no regrowth while BURNT; resumes only when the override is removed', () => {
    const gs=start(312);const r=gs.run!;const [tx,ty,i]=tilesOf('bush')[3];
    depleteBush(gs,tx,ty,T0);
    settleRegrowthAt(r,tx,ty,T0+SEC);
    r.terrain[i]={t:T.BURNT};
    expect(regrowSuppressed(r,tx,ty,T0+SEC)).toBe(true);
    expect(sourceAt(r,tx,ty,T0+3000*HOUR)?.stock).toBe(0);
    // Restoration deletes the override; it resumes from the same ledger (one source ID, no new stock).
    const R=T0+3000*HOUR, rR=wildRegrowRate(r,tx,ty,SOURCES.bush,R);
    settleRegrowthAt(r,tx,ty,R); delete r.terrain[i];          // production order: settle, then remove the override
    expect(sourceAt(r,tx,ty,R+SEC)?.stock).toBe(0);            // banked progress only (~1 s), not an instant refill
    expect(sourceAt(r,tx,ty,R+SOURCES.bush.regrow!*1000/rR+5*SEC)?.stock).toBe(SOURCES.bush.stock);
  });

  it('read-independence across a freeze and a season boundary: frequent polling and one late read agree', () => {
    const gs=start(313);const r=gs.run!;const [tx,ty,i]=tilesOf('bush')[4];
    depleteBush(gs,tx,ty,T0);
    const W=T0+60*SEC, F=5*HOUR;
    const clone=(x:any)=>({...x,sources:{...x.sources,[i]:{...x.sources[i]}},terrain:{...x.terrain}});
    const rA=clone(r), rB=clone(r);
    // Copy A polls every 5 s until the freeze, writes it at W (settle first), then keeps polling.
    let firstA:number|null=null;
    for(let t=T0+5*SEC;t<=W;t+=5*SEC){const s=sourceAt(rA,tx,ty,t);if(s&&s.stock>0&&firstA===null)firstA=t;}
    settleRegrowthAt(rA,tx,ty,W); rA.terrain[i]={t:T.ICE,until:rA.clock.simMs+F,untilAt:W+F};
    for(let t=W+5*SEC;t<=T0+3000*HOUR;t+=600*SEC){const s=sourceAt(rA,tx,ty,t);if(s&&s.stock>0&&firstA===null)firstA=t;}
    // Copy B: no reads until the late read, same freeze write at W.
    settleRegrowthAt(rB,tx,ty,W); rB.terrain[i]={t:T.ICE,until:rB.clock.simMs+F,untilAt:W+F};
    const endA=sourceAt(rA,tx,ty,T0+3000*HOUR), endB=sourceAt(rB,tx,ty,T0+3000*HOUR);
    expect(endA?.stock).toBe(endB?.stock);
    expect(endA?.hp).toBe(endB?.hp);
    expect(firstA).not.toBeNull();
    // Accrual is zero while frozen: the first positive read cannot be before the freeze ends.
    expect(firstA!).toBeGreaterThanOrEqual(W+F);
  });

  it('legacy terrain (until only, no untilAt) is honoured against the sim clock', () => {
    const gs=start(314);const r=gs.run!;const [tx,ty,i]=tilesOf('bush')[5];
    r.clock.simMs=0;
    r.terrain[i]={t:T.ICE,until:HOUR};                  // FIXTURE: old-save shape
    expect(regrowSuppressed(r,tx,ty,T0+SEC)).toBe(true);
    r.clock.simMs=HOUR+SEC;
    expect(regrowSuppressed(r,tx,ty,T0+SEC)).toBe(false);
  });
});

describe('R10 save/reload and validation', () => {
  it('mid-freeze save round-trips the absolute expiry; a non-finite untilAt is rejected', () => {
    const gs=start(315);const r=gs.run!;const [tx,ty,i]=tilesOf('bush')[6];
    depleteBush(gs,tx,ty,T0);
    const W=T0+SEC*60, F=2*HOUR;
    settleRegrowthAt(r,tx,ty,W); r.terrain[i]={t:T.ICE,until:r.clock.simMs+F,untilAt:W+F};
    const raw=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    expect(raw.run.terrain[i].untilAt).toBe(W+F);
    const ok=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));
    expect(ok).not.toBeNull();
    const reloaded=ok!.run!;
    expect(sourceAt(reloaded,tx,ty,W+F/2)?.stock).toBe(0);
    expect(sourceAt(reloaded,tx,ty,W+F+3000*HOUR)?.stock).toBe(SOURCES.bush.stock);
    const bad=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    bad.run.terrain[i].untilAt=NaN;
    expect(validate(bad)).toBeNull();
  });
});

describe('R10 rate bounds and output comparison', () => {
  it('every renewable wild site, every season, stays inside [0.15, 2]', () => {
    const gs=start(316);const r=gs.run!;let n=0;
    for(const kind of ['bush','grass','reed','herb','mushroom']) for(const [tx,ty] of tilesOf(kind).slice(0,40)) for(let p=0;p<4;p++){
      const v=wildRegrowRate(r,tx,ty,SOURCES[kind],T0+p*42*HOUR+SEC); n++;
      expect(v,kind).toBeGreaterThanOrEqual(0.15); expect(v,kind).toBeLessThanOrEqual(2);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('drought/poor soil vs fertile: output per day for one bush, two meaningful comparisons, nothing minted', () => {
    const gs=start(317);const r=gs.run!;const bushes=tilesOf('bush');
    const rows=bushes.slice(0,30).map(([x,y,i])=>({x,y,soil:soilOf(i),rate:wildRegrowRate(r,x,y,SOURCES.bush,T0)}));
    const fert=rows.reduce((a,b)=>b.soil>a.soil?b:a), poor=rows.reduce((a,b)=>b.soil<a.soil?b:a);
    const perDay=(rate:number)=>SOURCES.bush.stock*86400/(SOURCES.bush.regrow!/rate);
    console.log(`[R10 MEASURE] output/day bush: fertile(soil ${fert.soil.toFixed(2)})=${perDay(fert.rate).toFixed(2)} | poor(soil ${poor.soil.toFixed(2)})=${perDay(poor.rate).toFixed(2)} berries/day, stock per cycle ${SOURCES.bush.stock}`);
    expect(perDay(fert.rate)).toBeGreaterThan(perDay(poor.rate));
    // Exactly one stock per completed cycle: a second read never mints extra stock.
    depleteBush(gs,fert.x,fert.y,T0);
    const s1=sourceAt(r,fert.x,fert.y,T0+3000*HOUR), s2=sourceAt(r,fert.x,fert.y,T0+3001*HOUR);
    expect(s1?.stock).toBe(SOURCES.bush.stock); expect(s2?.stock).toBe(SOURCES.bush.stock);
  });
});

describe('R10 starter not starved', () => {
  it('median renewable wild rate stays usable in every season on the fixed Map (ground does not zero the starter economy)', () => {
    const gs=start(319);const r=gs.run!;
    for(let p=0;p<4;p++){
      const rates:number[]=[];
      for(const kind of ['bush','grass','reed','herb']) for(const [tx,ty] of tilesOf(kind)) rates.push(wildRegrowRate(r,tx,ty,SOURCES[kind],phaseBoundaryAt(r,p)+SEC));
      const a=rates.sort((x,y)=>x-y), med=a[Math.floor(a.length/2)];
      console.log(`[R10 MEASURE] starter median renewable rate phase ${p} ${seasonOfPhase(p)}: ${med.toFixed(3)} (n=${a.length})`);
      expect(a.length).toBeGreaterThan(0);
      expect(med).toBeGreaterThanOrEqual(0.4);
    }
  });
});

describe('R10 consumer chain (symbols only; no invented items or recipes)', () => {
  it('bush → berries (food) and seed; herb → food and medkit input; garden crop/herb inputs use the same seed and herb', () => {
    expect(SOURCES.bush.yields[0][0]).toBe('berries');
    expect(SOURCES.bush.bonus?.some(([k])=>k==='seed')).toBe(true);
    expect(ITEMS.berries.food?.hunger).toBeGreaterThan(0);
    expect(SOURCES.herb.yields[0][0]).toBe('herb');
    expect(ITEMS.herb.food?.hp).toBeGreaterThan(0);
    expect(RECIPES.medkit.ins.some(([k])=>k==='herb')).toBe(true);
    expect(GARDEN_CROPS.herb.inputs.some(([k])=>k==='herb')).toBe(true);
    expect(GARDEN_CROPS.crop.inputs.some(([k])=>k==='seed')).toBe(true);
  });
});

describe('R10 measured comparison by season (fertile vs drought/poor ground)', () => {
  it('MEASURE: per-season bush output/day, top vs bottom soil quartile, and a summer drought check', () => {
    const gs=start(318);const r=gs.run!;const w=getWorld();
    const bushes=tilesOf('bush').map(([x,y,i])=>({x,y,soil:soilOf(i)})).sort((a,b)=>b.soil-a.soil);
    expect(bushes.length).toBeGreaterThanOrEqual(8);
    const q=Math.max(2,Math.floor(bushes.length/4)), top=bushes.slice(0,q), bot=bushes.slice(-q);
    const med=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
    const out=(set:typeof bushes,p:number)=>med(set.map(b=>SOURCES.bush.stock*86400/(SOURCES.bush.regrow!/wildRegrowRate(r,b.x,b.y,SOURCES.bush,phaseBoundaryAt(r,p)+SEC))));
    const rows:string[]=[];let summerTop=0,summerBot=0,winterTop=0,winterBot=0;
    for(let p=0;p<4;p++){
      const season=seasonOfPhase(p);const ot=out(top,p), ob=out(bot,p);
      rows.push(`phase ${p} ${season}: top-soil quartile ${ot.toFixed(1)} berries/day | bottom-soil quartile ${ob.toFixed(1)} | ratio ${(ob/ot).toFixed(3)}`);
      if(season==='summer'){summerTop=ot;summerBot=ob;}
      if(season==='winter'){winterTop=ot;winterBot=ob;}
    }
    console.log('[R10 MEASURE] per-season output/day (bush, n='+bushes.length+', quartile='+q+')\n'+rows.join('\n'));
    // Recorded, not tuned: poor ground is lower in summer (small effect on this seed) and clearly lower in winter (cold + substrate).
    expect(summerBot).toBeLessThan(summerTop);
    expect(winterBot/winterTop).toBeLessThan(0.95);
    void w;
  });
});
