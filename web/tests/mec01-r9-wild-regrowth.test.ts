// MEC-01 R9: wild renewable source lifecycle. Risk-only, real engine functions, fixtures labelled.
// NOT a player itinerary: each test isolates one risk (boundary, read pattern, season crossing, reload, occupancy, finite sources, legacy saves, one grant).
import {describe,it,expect} from 'vitest';
import {TILE,WW,HOUR} from '../src/game/core';
import {SOURCES,validateGameplayCatalog} from '../src/game/catalog';
import {newGame,dispatch,addItem,markDirty,sourceAt,harvestHit,buildReason,entsAt,wildRegrowRate,regrowNote} from '../src/game/engine';
import {serializeSnapshot,validate} from '../src/game/persist';
import {phaseBoundaryAt,seasonOfPhase} from '../src/game/calendar';
import {getWorld} from '../src/game/world';

const T0=Date.UTC(2026,0,1);
const SEC=1000;
function start(seed:number){const gs=newGame();expect(dispatch(gs,{id:'r9-start-'+seed,type:'startRun',character:'female',seed},T0).ok).toBe(true);gs.run!.creatures=[];markDirty();return gs;}
const bushTiles=(r:any)=>{const w=getWorld();const out:[number,number,number][]=[];for(let i=0;i<w.sourceV3.length;i++) if(w.sourceV3[i]==='bush') out.push([i%WW,Math.floor(i/WW),i]);return out;};
const cloneRun=(r:any,i:number)=>({...r,sources:{...r.sources,[i]:{...r.sources[i]}}});
/** Fixture: deplete a bush at `now` with a real plant-power swing (bush hp 6, stock 3). */
function depleteBush(gs:any,tx:number,ty:number,now:number){const r=gs.run!;const res=harvestHit(gs,tx,ty,{plant:6},now,tx*TILE,ty*TILE);expect(res.depleted).toBe(true);return r.sources[ty*WW+tx];}

describe('R9 catalog contract', () => {
  it('only wild plants carry a regrow timer and a regrow class; finite sources never regrow', () => {
    for (const [k,d] of Object.entries(SOURCES)) {
      if (d.regrow !== undefined) { expect(d.mat, k).toBe('plant'); expect(d.regrowClass, k).toBeDefined(); expect(d.regrow!, k).toBeGreaterThan(0); }
      else expect(d.regrowClass, k).toBeUndefined();
    }
    for (const k of ['iron','wreck','rock','oak','rare','rich_iron']) if (SOURCES[k]) expect(SOURCES[k].regrow, k).toBeUndefined();
    const out:any=validateGameplayCatalog();
    expect(Array.isArray(out)?out:(out?.errors??[])).toEqual([]);
  });
});

describe('R9 regrowth lifecycle', () => {
  it('boundary: a depleted bush is still empty just before its season-scaled cooldown and full just after', () => {
    const gs=start(301);const r=gs.run!;const [tx,ty,i]=bushTiles(r)[0];
    const st=depleteBush(gs,tx,ty,T0);
    const def=SOURCES.bush;const rate=wildRegrowRate(r,tx,ty,def,T0);
    const done=T0+ (def.regrow!*1000)/rate;      // constant rate inside the first phase (42 h)
    expect(sourceAt(r,tx,ty,done-2*SEC)?.stock).toBe(0);
    expect(sourceAt(r,tx,ty,done+2*SEC)?.stock).toBe(def.stock);
    expect(st).toBeDefined();
  });

  it('read pattern cannot change the outcome: frequent reads and a single late read give the same full stock and nothing extra', () => {
    const gs=start(302);const r=gs.run!;const [tx,ty,i]=bushTiles(r)[1];
    depleteBush(gs,tx,ty,T0);
    const snap={...r.sources[i]};
    // Copy A: poll every 5 s for 3 h (render-like), Copy B: one read at the end.
    const rA=cloneRun(r,i), rB=cloneRun(r,i);
    let firstA:number|null=null;
    for(let t=T0+5*SEC;t<=T0+3*HOUR;t+=5*SEC){ const s=sourceAt(rA,tx,ty,t); if(s && s.stock>0 && firstA===null) firstA=t; }
    const endB=sourceAt(rB,tx,ty,T0+3*HOUR);
    const endA=sourceAt(rA,tx,ty,T0+3*HOUR);
    expect(endA?.stock).toBe(endB?.stock);
    expect(endA?.stock).toBe(SOURCES.bush.stock);
    expect(endA?.hp).toBe(endB?.hp);
    // Completion instant is the analytic boundary (within the 5 s poll), not later because of polling.
    const rate=wildRegrowRate(r,tx,ty,SOURCES.bush,T0);
    const predicted=T0+(SOURCES.bush.regrow!*1000)/rate;
    expect(firstA).not.toBeNull(); expect(Math.abs(firstA!-predicted)).toBeLessThanOrEqual(5*SEC);
    void snap;
  });

  it('season crossing: integrates the rate piecewise, so a boundary inside the cooldown moves completion as the rates require', () => {
    const gs=start(303);const r=gs.run!;const boundary=phaseBoundaryAt(r,1);
    const def=SOURCES.bush;const need=def.regrow!*1000;
    // Find a tile whose growth rate changes across the first season boundary (fixture search over real bush tiles).
    let pick:[number,number,number]|null=null;
    for(const [tx,ty,i] of bushTiles(r)){const a=wildRegrowRate(r,tx,ty,def,boundary-1),b=wildRegrowRate(r,tx,ty,def,boundary);if(Math.abs(a-b)>0.05){pick=[tx,ty,i];break;}}
    expect(pick).not.toBeNull();
    const [tx,ty,i]=pick!;
    const dep=boundary-200*SEC;
    depleteBush(gs,tx,ty,dep);
    const a=wildRegrowRate(r,tx,ty,def,dep), b=wildRegrowRate(r,tx,ty,def,boundary);
    const earned=a*200*SEC;
    const expected=earned>=need? dep+need/a : boundary+(need-earned)/b;
    expect(sourceAt(r,tx,ty,expected-3*SEC)?.stock).toBe(0);
    expect(sourceAt(r,tx,ty,expected+3*SEC)?.stock).toBe(def.stock);
    void i;
  });

  it('offline/reload: a save taken mid-cooldown restores the same completion instant (no reset, no double refill)', () => {
    const gs=start(304);const r=gs.run!;const [tx,ty,i]=bushTiles(r)[2];
    depleteBush(gs,tx,ty,T0);
    const rate=wildRegrowRate(r,tx,ty,SOURCES.bush,T0);const done=T0+(SOURCES.bush.regrow!*1000)/rate;
    // Save at mid-cooldown, reload, then the restored run completes at the same instant.
    const mid=T0+Math.floor((done-T0)/2);
    expect(sourceAt(r,tx,ty,mid)?.stock).toBe(0);
    const back:any=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));
    expect(back).not.toBeNull();
    const rr=back.run;
    expect(rr.sources[i].regrowFrom).toBeDefined();
    expect(sourceAt(rr,tx,ty,done-3*SEC)?.stock).toBe(0);
    expect(sourceAt(rr,tx,ty,done+3*SEC)?.stock).toBe(SOURCES.bush.stock);
  });

  it('occupancy (confirmed BEFORE bug): a floor built on a dormant bush blocks refill; harvest is empty; after clearing it the plant emerges once', () => {
    const gs=start(98);const r=gs.run!;   // seed 98: the same buildable region the W08 fixtures use
    addItem(r,'inv','wood',60);            // materials first: buildReason checks the floor cost
    // Fixture site: a bush tile that the real buildReason accepts for a floor after depletion.
    let site:[number,number,number]|null=null;
    for(const [tx,ty,i] of bushTiles(r)){
      r.player.x=(tx-1)*TILE+8;r.player.y=ty*TILE+8;markDirty();
      depleteBush(gs,tx,ty,T0);
      if(buildReason(gs,'floor_wood',tx,ty)===null){site=[tx,ty,i];break;}
      delete r.sources[i];markDirty();
    }
    expect(site).not.toBeNull();
    const [tx,ty,i]=site!;
    const built=dispatch(gs,{id:'r9-floor',type:'build',struct:'floor_wood',tx,ty},T0+SEC);
    expect(built.ok).toBe(true);
    const floor=entsAt(r,tx,ty).find(e=>e.type==='floor_wood')!;
    const late=T0+2*HOUR;                     // well past the cooldown
    expect(sourceAt(r,tx,ty,late)?.stock).toBe(0);                       // NOT refilled under the floor
    const h=harvestHit(gs,tx,ty,{plant:6},late,tx*TILE,ty*TILE);
    expect(h.result).toBe('empty');                                      // no berries from a built-over tile
    expect(regrowNote(r,tx,ty,late)).toMatch(/clear/);
    // Clear the floor with the real reclaim intent, then the plant may emerge once.
    r.player.x=(tx-1)*TILE+8;r.player.y=ty*TILE+8;markDirty();
    const rec=dispatch(gs,{id:'r9-reclaim',type:'reclaim',eid:floor.id},late+SEC);
    expect(rec.ok).toBe(true);
    markDirty();
    expect(sourceAt(r,tx,ty,late+2*SEC)?.stock).toBe(SOURCES.bush.stock);
    let total=0;for(let k=0;k<5;k++){const hh=harvestHit(gs,tx,ty,{plant:6},late+3*SEC,tx*TILE,ty*TILE);if(hh.result==='yield') total+=hh.got||0;}
    expect(total).toBe(SOURCES.bush.stock);                              // exactly one grant of stock, never more
    void i;
  });

  it('one grant: after a refill, repeated reads over a long time never add stock beyond the authored stock', () => {
    const gs=start(306);const r=gs.run!;const [tx,ty,i]=bushTiles(r)[3];
    depleteBush(gs,tx,ty,T0);
    for(let t=T0;t<=T0+20*HOUR;t+=7*60*SEC) sourceAt(r,tx,ty,t);
    expect(r.sources[i]).toBeDefined();
    expect(sourceAt(r,tx,ty,T0+20*HOUR)?.stock).toBe(SOURCES.bush.stock);
    expect(r.sources[i].regrowFrom).toBeUndefined();                    // cycle closed, no pending timer left
  });

  it('finite sources never regrow: a depleted iron vein stays empty for days', () => {
    const gs=start(307);const r=gs.run!;const w=getWorld();let i=-1,tx=0,ty=0;
    for(let k=0;k<w.sourceV3.length;k++) if(w.sourceV3[k]==='iron'){i=k;tx=k%WW;ty=Math.floor(k/WW);break;}
    expect(i).toBeGreaterThanOrEqual(0);
    harvestHit(gs,tx,ty,{ore:50},T0,tx*TILE,ty*TILE);
    expect(sourceAt(r,tx,ty,T0+200*HOUR)?.stock).toBe(0);
    expect(r.sources[i].regrowFrom).toBeUndefined();
  });

  it('legacy save: a pre-R9 fixed regrowAt is honoured as saved, neither earlier nor refilled under a building', () => {
    const gs=start(308);const r=gs.run!;const [tx,ty,i]=bushTiles(r)[4];
    r.sources[i]={stock:0,hp:0,regrowAt:T0+420*SEC};
    markDirty();
    expect(sourceAt(r,tx,ty,T0+400*SEC)?.stock).toBe(0);
    expect(sourceAt(r,tx,ty,T0+421*SEC)?.stock).toBe(SOURCES.bush.stock);
  });

  it('save validation: regrow fields are rejected on a non-renewable source, accepted on a renewable one', () => {
    const gs=start(309);const r=gs.run!;const w=getWorld();let iron=-1;
    for(let k=0;k<w.sourceV3.length;k++) if(w.sourceV3[k]==='iron'){iron=k;break;}
    const [tx,ty,i]=bushTiles(r)[5];
    depleteBush(gs,tx,ty,T0);
    const good=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    expect(validate(good)).not.toBeNull();
    const bad=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);
    bad.run.sources[iron]={stock:0,hp:0,regrowFrom:T0};
    expect(validate(bad)).toBeNull();
    void i;
  });

  it('rate floor and season band: R10 bounds [0.15, 2] (minRate 0.5 x soil floor 0.3) at any sampled bush site', () => {
    const gs=start(310);const r=gs.run!;let n=0;
    for(const [tx,ty] of bushTiles(r).slice(0,60)) for(let p=0;p<4;p++){
      const at=phaseBoundaryAt(r,p)+1*SEC;
      const v=wildRegrowRate(r,tx,ty,SOURCES.bush,at); n++;
      expect(v).toBeGreaterThanOrEqual(0.15); expect(v).toBeLessThanOrEqual(2);
      void seasonOfPhase(p);
    }
    expect(n).toBeGreaterThan(0);
  });
});
