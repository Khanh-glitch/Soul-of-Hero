// B02-P1-B bear trap (trap-v1): paid, armed, one hit, spent/worn, rearm, reclaim, live-only. No offline kills.
import {describe,it,expect} from 'vitest';
import {TILE,WW,T} from '../src/game/core';
import {STRUCTS,ITEMS,RECIPES} from '../src/game/catalog';
import {BAL} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,C,markDirty,mkCreature} from '../src/game/engine';
import {settle,triggerBearTrap} from '../src/game/sim';
import {getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
const T0=Date.UTC(2026,0,1);let n=0;
function setup(){const g=newGame();expect(dispatch(g,{id:'bt-start'+ ++n,type:'startRun',character:'female',seed:97},T0).ok).toBe(true);const r=g.run!,x=80,y=80;r.creatures=[];
  for(let yy=y-6;yy<=y+6;yy++)for(let xx=x-6;xx<=x+8;xx++){const i=yy*WW+xx;r.terrain[i]={t:T.GRASS};if(getWorld().sourceV3[i])r.sources[i]={stock:0,hp:0};}
  markDirty();const pos=(tx:number,ty:number)=>{r.player.x=tx*TILE+8;r.player.y=ty*TILE+8;markDirty();};
  const act=(type:string,args:object={},now=T0)=>dispatch(g,{id:'bt-'+ ++n,type,...args},now);
  const build=(type:string,tx:number,ty:number,px=tx,py=ty+1)=>{pos(px,py);for(const [k,q] of STRUCTS[type].cost)addItem(r,'inv',k,q);if(STRUCTS[type].item){const recipe=STRUCTS[type].item!;expect(RECIPES[recipe].station).toBeNull();expect(act('craft',{recipe}).ok).toBe(true);}const res=act('build',{struct:type,tx,ty});expect(res.ok,`${type}: ${(res as any).reason}`).toBe(true);return Object.values(r.entities).find(e=>e.kind==='struct'&&e.tx===tx&&e.ty===ty&&e.type===type)!;};
  return {g,r,x,y,pos,act,build};}
const stepOn=(o:ReturnType<typeof setup>,tx:number,ty:number,state='chase')=>{const m=mkCreature(o.r,'wolf',tx*TILE+8,ty*TILE+8,40);m.state=state as any;m.cd=0;o.r.creatures.push(m);return m;};
describe('B02-P1-B bear trap: physical arm, one paid hit, spent, rearm, worn',()=>{
  it('crafts a paid gear/ingot pack; placed unarmed, so a creature stepping on it is not hit',()=>{
    const o=setup();expect(STRUCTS.bear_trap.cost).toEqual([['mechanical_gear',1],['iron_ingot',2]]);
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
  it('reclaim of a used trap returns its single original UID and damage, not raw materials',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0);
    const before=new Map(STRUCTS.bear_trap.cost.map(([k])=>[k,countItem(o.r,'inv',k)]));
    expect(o.act('reclaim',{eid:t.id}).ok).toBe(true);
    for(const [k,q] of STRUCTS.bear_trap.cost){const back=countItem(o.r,'inv',k)-(before.get(k)??0);expect(back).toBeLessThanOrEqual(Math.floor(q*BAL.economy.reclaimRefund));}
    const pack=C(o.r,'inv').slots.find(s=>s?.key===STRUCTS.bear_trap.item)!;expect(pack.uid).toBe(t.deployed!.uid);expect(pack.dur).toBe(t.hp);
    expect(countItem(o.r,'inv',STRUCTS.bear_trap.item!)).toBe(1);expect(countItem(o.r,'inv','iron_plate')).toBe(0);expect(Object.values(o.r.entities).some(e=>e.id===t.id)).toBe(false);
  });
  it('persists armed/spent state and uses across save and reload; corrupt trap state is refused',()=>{
    const o=setup();const t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);addItem(o.r,'inv','iron_plate',1);o.act('bearTrapSet',{eid:t.id});
    const m=stepOn(o,o.x+2,o.y);triggerBearTrap(o.g,m,T0);
    const back=selectSnapshots([serializeSnapshot(o.g),null]).gs!;expect(back.run!.entities[t.id].bearTrap).toMatchObject({state:'spent',uses:2});
    const bad=structuredClone(o.g);(bad.run!.entities[t.id] as any).bearTrap={version:'trap-v1',state:'exploded',uses:9};
    expect(()=>serializeSnapshot(bad)).toThrow('invalid game state');
  });
});

// Regression: re-packing a spent/worn trap must not replenish the mechanism for free.
it('spent and worn uses survive packing and actual resumed play after each snapshot',()=>{
  const o=setup(),t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);
  addItem(o.r,'inv','iron_plate',3);const uid=t.deployed!.uid;let g=o.g;
  for(let hit=0;hit<3;hit++){
    const r=g.run!,current=Object.values(r.entities).find(e=>e.type==='bear_trap')!;
    expect(dispatch(g,{id:`loop-arm-${hit}`,type:'bearTrapSet',eid:current.id},T0+hit).ok).toBe(true);
    const m=mkCreature(r,'wolf',(o.x+2)*TILE+8,o.y*TILE+8,40);m.state='chase';r.creatures.push(m);
    triggerBearTrap(g,m,T0+hit);
    expect(current.bearTrap!.uses).toBe(2-hit);
    expect(dispatch(g,{id:`loop-reclaim-${hit}`,type:'reclaim',eid:current.id},T0+hit).ok).toBe(true);
    const pack=C(r,'inv').slots.find(s=>s?.uid===uid)!;
    g=selectSnapshots([serializeSnapshot(g)]).gs!;expect(g).not.toBeNull();
    expect(C(g.run!,'inv').slots.find(s=>s?.uid===uid)).toEqual(pack);
    expect(dispatch(g,{id:`loop-build-${hit}`,type:'build',struct:'bear_trap',tx:o.x+2,ty:o.y},T0+hit).ok).toBe(true);
    const next=Object.values(g.run!.entities).find(e=>e.type==='bear_trap')!;
    expect(next.deployed!.uid).toBe(uid);expect(next.hp).toBe(pack.dur);expect(next.bearTrap!.uses).toBe(2-hit);
    expect(next.bearTrap!.state).toBe(hit===2?'worn':'spent');
  }
});

it('an armed pack keeps its paid plate across actual reload and redeployment, but never fires in inventory',()=>{
  const o=setup(),t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);
  addItem(o.r,'inv','iron_plate',1);expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(true);
  const uid=t.deployed!.uid;expect(o.act('reclaim',{eid:t.id}).ok).toBe(true);
  const g=selectSnapshots([serializeSnapshot(o.g)]).gs!,r=g.run!;
  const m=mkCreature(r,'wolf',(o.x+2)*TILE+8,o.y*TILE+8,40);m.state='chase';r.creatures.push(m);
  triggerBearTrap(g,m,T0+1);expect(m.hp).toBe(40);
  expect(dispatch(g,{id:'trap-reloaded-deploy',type:'build',struct:'bear_trap',tx:o.x+2,ty:o.y},T0+2).ok).toBe(true);
  const placed=Object.values(r.entities).find(e=>e.type==='bear_trap')!;
  expect(placed.deployed!.uid).toBe(uid);expect(placed.deployed!.bearTrap).toBeUndefined();
  expect(placed.bearTrap).toMatchObject({state:'armed',uses:3});expect(countItem(r,'inv','iron_plate')).toBe(0);
  triggerBearTrap(g,m,T0+3);expect(m.hp).toBeLessThan(40);expect(placed.bearTrap!.uses).toBe(2);
});

it('worn pack needs a paid Workbench repair; refused repair and deployment cannot reset its mechanism',()=>{
  const o=setup(),t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);
  addItem(o.r,'inv','iron_plate',3);
  for(let i=0;i<3;i++){expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(true);triggerBearTrap(o.g,stepOn(o,o.x+2,o.y),T0+i);}
  expect(t.bearTrap!.state).toBe('worn');expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(false);
  expect(o.act('reclaim',{eid:t.id}).ok).toBe(true);
  const slot=C(o.r,'inv').slots.findIndex(s=>s?.key==='deploy_bear_trap'),pack=C(o.r,'inv').slots[slot]!;
  const bench=o.build('workbench',o.x,o.y);o.pos(o.x+1,o.y+1);
  const request={eid:bench.id,slot,uid:pack.uid,mode:'repair'};
  const before=JSON.stringify(pack);expect(o.act('maintainItem',request).ok).toBe(false);expect(JSON.stringify(pack)).toBe(before);
  for(const [k,q] of ITEMS.deploy_bear_trap.repair!.cost)addItem(o.r,'inv',k,q);
  const counts=ITEMS.deploy_bear_trap.repair!.cost.map(([k])=>countItem(o.r,'inv',k));
  expect(o.act('maintainItem',request).ok).toBe(true);
  ITEMS.deploy_bear_trap.repair!.cost.forEach(([k,q],i)=>expect(countItem(o.r,'inv',k)).toBe(counts[i]-q));
  expect(pack.bearTrap).toBeUndefined();expect(pack.dur).toBe(STRUCTS.bear_trap.hp);
  expect(o.act('build',{struct:'bear_trap',tx:o.x+2,ty:o.y}).ok).toBe(true);
  const restored=Object.values(o.r.entities).find(e=>e.type==='bear_trap')!;
  expect(restored.deployed!.uid).toBe(pack.uid);expect(restored.bearTrap).toMatchObject({state:'unarmed',uses:3});
  expect(o.act('bearTrapSet',{eid:restored.id}).ok).toBe(false); // re-forge is NOT a free arming plate
  expect(()=>serializeSnapshot(o.g)).not.toThrow();
});

it('legacy placed traps preserve remaining uses on recovery; invalid packed mechanism fields fail closed',()=>{
  const o=setup(),t=o.build('bear_trap',o.x+2,o.y);o.pos(o.x+2,o.y+1);
  delete t.deployed; // supported pre-packed-device entity, not a forged source migration
  addItem(o.r,'inv','iron_plate',1);expect(o.act('bearTrapSet',{eid:t.id}).ok).toBe(true);
  triggerBearTrap(o.g,stepOn(o,o.x+2,o.y),T0);expect(()=>serializeSnapshot(o.g)).not.toThrow();
  expect(o.act('reclaim',{eid:t.id}).ok).toBe(true);
  const pack=C(o.r,'inv').slots.find(s=>s?.key==='deploy_bear_trap')!;
  expect(pack.bearTrap).toMatchObject({state:'spent',uses:2});
  for(const bad of [{version:'trap-v1',state:'spent',uses:3},{version:'trap-v1',state:'worn',uses:1},{version:'trap-v9',state:'armed',uses:3}]){
    const save=structuredClone(o.g),s=C(save.run!,'inv').slots.find(s=>s?.uid===pack.uid)!;(s as any).bearTrap=bad;
    expect(()=>serializeSnapshot(save)).toThrow('invalid game state');
    expect(dispatch(save,{id:'bad-trap-pack',type:'build',struct:'bear_trap',tx:o.x+2,ty:o.y},T0+4).ok).toBe(false);
    expect(C(save.run!,'inv').slots.find(s=>s?.uid===pack.uid)).toBe(s);
  }
  const foreign=structuredClone(o.g);C(foreign.run!,'inv').slots.find(s=>s?.uid===pack.uid)!.key='deploy_workbench';
  expect(()=>serializeSnapshot(foreign)).toThrow('invalid game state');
});
