// B02-P1-B bear trap (trap-v1): paid, armed, one hit, spent/worn, rearm, reclaim, live-only. No offline kills.
import {describe,it,expect} from 'vitest';
import {TILE,WW,T} from '../src/game/core';
import {STRUCTS} from '../src/game/catalog';
import {BAL} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,markDirty,mkCreature} from '../src/game/engine';
import {settle,triggerBearTrap} from '../src/game/sim';
import {getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const T0=Date.UTC(2026,0,1);let n=0;
function setup(){const g=newGame();expect(dispatch(g,{id:'bt-start'+ ++n,type:'startRun',character:'female',seed:97},T0).ok).toBe(true);const r=g.run!,x=80,y=80;r.creatures=[];
  for(let yy=y-6;yy<=y+6;yy++)for(let xx=x-6;xx<=x+8;xx++){const i=yy*WW+xx;r.terrain[i]={t:T.GRASS};if(getWorld().sourceV3[i])r.sources[i]={stock:0,hp:0};}
  markDirty();const pos=(tx:number,ty:number)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();};
  const act=(type:string,args:object={},now=T0)=>dispatch(g,{id:'bt-'+ ++n,type,...args},now);
  const build=(type:string,tx:number,ty:number,px=tx,py=ty+1)=>{pos(px,py);for(const [k,q] of STRUCTS[type].cost)addItem(r,'inv',k,q);const res=act('build',{struct:type,tx,ty});expect(res.ok,`${type}: ${(res as any).reason}`).toBe(true);return Object.values(r.entities).find(e=>e.kind==='struct'&&e.tx===tx&&e.ty===ty&&e.type===type)!;};
  return {g,r,x,y,pos,act,build};}
const stepOn=(o:ReturnType<typeof setup>,tx:number,ty:number,state='chase')=>{const m=mkCreature(o.r,'wolf',tx*TILE+8,ty*TILE+8,40);m.state=state as any;m.cd=0;o.r.creatures.push(m);return m;};
describe('B02-P1-B bear trap: physical arm, one paid hit, spent, rearm, worn',()=>{
  it('costs gear, ingots and fasteners; placed unarmed, so a creature stepping on it is not hit',()=>{
    const o=setup();expect(STRUCTS.bear_trap.cost).toEqual([['mechanical_gear',1],['iron_ingot',2],['fasteners',2]]);
    const t=o.build('bear_trap',o.x+2,o.y);expect(t.bearTrap).toEqual({version:'trap-v1',state:'unarmed',uses:3});
    const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0);expect(m.hp).toBe(40);expect(t.bearTrap!.state).toBe('unarmed');
  });
  it('arming consumes exactly one Iron Plate; refused without one and the state stays unarmed',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);
    expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(false);expect(t.bearTrap!.state).toBe('unarmed');
    addItem(o.r,'inv','iron_plate',1);expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(true);
    expect(t.bearTrap!.state).toBe('armed');expect(countItem(o.r,'inv','iron_plate')).toBe(0);
    expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(false);expect(countItem(o.r,'inv','iron_plate')).toBe(0);
  });
  it('one paid hit per arming: armed trigger damages and stuns once, becomes spent, and does not retrigger',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);const hp0=m.hp;triggerBearTrap(o.g,m,T0);
    expect(m.hp).toBeLessThan(hp0);expect(m.cd).toBe(BAL.bearTrapV1.stunMs);expect(t.bearTrap).toMatchObject({state:'spent',uses:2});expect(t.hp).toBe(STRUCTS.bear_trap.hp-BAL.bearTrapV1.wearPerTrigger);
    const m2=stepOn(o,o.x+2,o.y);m2.cd=0;const hp2=m2.hp;triggerBearTrap(o.g,m2,T0+1000);expect(m2.hp).toBe(hp2);expect(t.bearTrap!.uses).toBe(2);
  });
  it('rearm is paid (one plate) and worn after the third hit: no further arming, reclaim only',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',3);
    o.act('bearTrapSet',{eid:t.id});
    for(let i=0;i<3;i++){const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0+i);if(t.bearTrap!.state==='spent'){m.cd=0;expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(true);}}
    expect(t.bearTrap).toMatchObject({state:'worn',uses:0});expect(countItem(o.r,'inv','iron_plate')).toBe(0);
    expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(false);
  });
  it('a sleeping creature on the plate does not trigger, and an adjacent creature cannot reach through the footprint',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const sleeper=stepOn(o,o.x+2,o.y,'sleep');triggerBearTrap(o.g,sleeper,T0);expect(t.bearTrap!.state).toBe('armed');
    const near=stepOn(o,o.x+3,o.y);triggerBearTrap(o.g,near,T0);expect(t.bearTrap!.state).toBe('armed');expect(near.hp).toBe(40);
  });
  it('live only: offline settlement with a creature on the armed trap never fires it (no offline kill)',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);const snap=selectSnapshots([serializeSnapshot(o.g),null]).gs!;
    settle(snap,T0+120000,true);
    const after=snap.run!.entities[t.id];expect(after.bearTrap!.state).toBe('armed');expect(after.bearTrap!.uses).toBe(3);void m;
  });
  it('reclaim of a used trap returns at most the bounded refund of its build cost, never more',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0);
    const before=new Map(STRUCTS.bear_trap.cost.map(([k])=>[k,countItem(o.r,'inv',k)]));
    expect(o.act('reclaim',{eid:t.id}).ok).toBe(true);
    for(const [k,q] of STRUCTS.bear_trap.cost){const back=countItem(o.r,'inv',k)-(before.get(k)??0);expect(back).toBeLessThanOrEqual(Math.floor(q*BAL.economy.reclaimRefund));}
    expect(countItem(o.r,'inv','iron_plate')).toBe(0);expect(Object.values(o.r.entities).some(e=>e.id===t.id)).toBe(false);
  });
  it('persists armed/spent state and uses across save and reload; corrupt trap state is refused',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0);
    const back=selectSnapshots([serializeSnapshot(o.g),null]).gs!;expect(back.run!.entities[t.id].bearTrap).toMatchObject({state:'spent',uses:2});
    const bad=structuredClone(o.g);(bad.run!.entities[t.id] as any).bearTrap={version:'trap-v1',state:'exploded',uses:9};
    expect(()=>serializeSnapshot(bad)).toThrow('invalid game state');
  });
});
