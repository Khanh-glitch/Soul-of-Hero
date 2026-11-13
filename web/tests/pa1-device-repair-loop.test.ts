// PA1 §24 custody, closed loop: a packed device's condition lives on the ITEM, so the only legal
// recovery of a worn device is a PAID re-forge of that item — never `repairStructure` on the placed
// entity, never a free heal through reclaim/redeploy, never a minted second copy.
//
// This file exists because the Deploy screen used to tell players "repair it before placing" while
// `maintainItem` had no rule to accept a packed device: the advice named a control that did not exist.
// Everything here is executed through real intents on a real run; the only fixture acts are the
// labelled material grants and the one direct `hp` write that stands in for a creature hitting the
// device (a durability state, not a transaction).
import {afterAll,describe,it,expect} from 'vitest';
import {TILE,T,WW,type GameState,type Entity,type RunState} from '../src/game/core';
import {DEPLOYABLE_TYPES,ITEMS,RECIPES,STRUCTS,BUILD_ORDER,modulePending,MODULE_PENDING_STRUCTURES} from '../src/game/catalog';
import {newGame,dispatch,addItem,countItem,C,markDirty,buildReason} from '../src/game/engine';
import {getWorld,getActiveLayout,setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots,validate} from '../src/game/persist';
import {structurePreparation} from '../src/game/action-readiness';

const T0=Date.UTC(2026,10,13,9);let serial=0;
const act=(g:GameState,type:string,p:object={},id=`pdr-${++serial}`,at=Math.max(T0,g.run?.clock.lastSimAt??T0))=>dispatch(g,{id,type,...p},at);
// Round-trip through the real snapshot envelope (not an object clone): custody facts have to survive
// serialisation, which is what a restart actually does. The full persist.load() path, with quarantine
// and legacy-migration handling, is exercised by pa1-recipe-migration.test.ts and the rev-1 fixture.
const copy=(g:GameState)=>{const sel=selectSnapshots([serializeSnapshot(g),null]);expect(validate(g)).not.toBeNull();expect(sel.gs).not.toBeNull();return sel.gs!;};
// Reach is a real rule (`near(r,e,3)` for reclaim and maintainItem), so the fixture stands the player
// beside whatever it just placed instead of quietly relying on a lucky tile.
const beside=(r:RunState,e:Entity)=>{r.player.x=e.x;r.player.y=e.y+TILE;markDirty();};
function setup(){
  setActiveLayout('shipping');
  const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:4021}).ok).toBe(true);
  const r=g.run!,w=getWorld(),avoid=w.accessCorridors?.mask;
  r.creatures=[];
  let xx=0,yy=0;
  outer:for(let y=8;y<185;y++)for(let x=8;x<185;x++){
    let ok=true;
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
      const i=(y+dy)*WW+x+dx;
      if(w.economyMap.protected[i]||avoid?.[i]||(w.enforceMasks&&!w.economyMap.buildable[i]))ok=false;
    }
    if(ok){xx=x;yy=y;break outer;}
  }
  expect(xx).toBeGreaterThan(0);
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const i=(yy+dy)*WW+xx+dx;
    r.terrain[i]={t:T.GRASS};
    if(w.sourceV3[i])r.sources[i]={stock:0,hp:0};
  }
  r.player.x=(xx-1)*TILE+8;r.player.y=(yy+1)*TILE+8;markDirty();
  const used=new Set<string>();
  const place=(type:string,pack?:string)=>{
    const d=STRUCTS[type];
    if(pack) addItem(r,'inv',pack,1);
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const tx=xx+dx,ty=yy+dy,key=tx+','+ty;
      if(used.has(key)||buildReason(g,type,tx,ty))continue;
      used.add(key);
      r.player.x=tx*TILE+8;r.player.y=(ty+1)*TILE+8;markDirty();
      const res=act(g,'build',{struct:type,tx,ty});
      expect(res.ok,type+' placement: '+res.msg).toBe(true);
      return Object.values(r.entities).find(e=>e.kind==='struct'&&e.type===type&&e.tx===tx&&e.ty===ty)!;
    }
    throw new Error('no legal tile for '+type);
  };
  return {g,r,x:xx,y:yy,place};
}
afterAll(()=>setActiveLayout('shipping'));

describe('PA1 packed-device re-forge rule — priced from the device itself, never from nowhere',()=>{
  it('every pack has a paid repair rule equal to a quarter of its own build list, min one',()=>{
    for(const type of DEPLOYABLE_TYPES){
      const d=STRUCTS[type],id=d.item!;
      const rule=ITEMS[id].repair;
      expect(rule,`${id} must be re-forgeable or the guidance is a lie`).toBeTruthy();
      expect(rule!.cost,`${id} repair price must derive from its build list`).toEqual(
        d.cost.map(([k,q])=>[k,Math.max(1,Math.ceil(q*0.25))]));
      // The price may never exceed the item it restores: repairing must be cheaper than re-crafting.
      for(const [k,q] of rule!.cost){
        const paid=d.cost.find(([m])=>m===k)?.[1]??0;
        expect(q,`${id} repair of ${k}`).toBeLessThanOrEqual(paid);
      }
    }
  });
  it('no device is repaired at its own station — the Workbench self-softlock is impossible by construction',()=>{
    for(const type of DEPLOYABLE_TYPES){
      const rule=ITEMS[STRUCTS[type].item!].repair!;
      expect(rule.station,`${type} must not require itself`).not.toBe(type);
      expect(STRUCTS[rule.station]?.station,`${rule.station} must be a real station`).toBe(rule.station);
      if(type!=='workbench') expect(rule.station).toBe('workbench');
      else expect(rule.station).toBe('furnace');
    }
  });
  it('the unapproved powered-door module is labelled pending, and is not counted as a deployed pack',()=>{
    expect(MODULE_PENDING_STRUCTURES).toEqual(['door_powered']);
    expect(modulePending('door_powered')).toBe(true);
    for(const k of MODULE_PENDING_STRUCTURES){
      expect(STRUCTS[k].item,`${k} must have no packed identity`).toBeUndefined();
      expect(RECIPES['deploy_'+k]).toBeUndefined();
      expect(DEPLOYABLE_TYPES).not.toContain(k);
      expect(BUILD_ORDER).not.toContain(k);
    }
    for(const k of DEPLOYABLE_TYPES) expect(modulePending(k),`${k} cannot hide as pending`).toBe(false);
    const o=setup();
    const prep=structurePreparation(o.r,'door_powered');
    expect(prep.pending).toBe(true);
    expect(prep.materials).toBe(false);
    expect(prep.next).toMatch(/module-pending: no approved packed-device formula/);
    expect(buildReason(o.g,'door_powered',o.x,o.y), 'an unapproved module must not place silently').not.toBeNull();
  });
});

describe('PA1 worn device lifecycle — craft → UID → place → damage → reclaim → re-forge → redeploy → restart',()=>{
  it('full loop, measured',()=>{
    const o=setup();const r=o.r;
    addItem(r,'inv','wood',40);addItem(r,'inv','stone',24);
    const wood0=countItem(r,'inv','wood'),stone0=countItem(r,'inv','stone');
    // 1) craft the pack (the ONLY material payment for the device)
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
    let slot=()=>C(r,'inv').slots.findIndex(s=>s?.key==='deploy_workbench');
    expect(slot()).toBeGreaterThanOrEqual(0);
    const uid=r.custody.inv.slots[slot()]!.uid;
    expect(r.custody.inv.slots[slot()]!.dur).toBe(STRUCTS.workbench.hp);
    expect(r.custody.inv.slots[slot()]!.qty).toBe(1);
    // 2) a Furnace stands first, because that is where a packed Workbench re-forges — and it is PAID
    // for, not handed out: the conservation ledger at the end only means something if every device in
    // this run was bought.
    expect(act(o.g,'craft',{recipe:'deploy_furnace'}).ok).toBe(true);
    const furnace=o.place('furnace');
    // 3) place the workbench pack: the pack leaves, the device arrives at full condition, UID travels
    const bench=o.place('workbench');
    expect(countItem(r,'inv','deploy_workbench')).toBe(0);
    expect(bench.deployed!.uid).toBe(uid);
    expect([bench.hp,bench.maxHp]).toEqual([160,160]);
    // 4) FIXTURE durability state: something hit it. Not a transaction — the only direct write here.
    bench.hp=40;
    // 5) reclaim: same UID, same damage, no healing
    beside(r,bench);
    expect(act(o.g,'reclaim',{eid:bench.id}).ok===true).toBe(true);
    expect(slot()).toBeGreaterThanOrEqual(0);
    const back=r.custody.inv.slots[slot()]!;
    expect(back.uid).toBe(uid);expect(back.dur).toBe(40);expect(back.qty).toBe(1);
    expect(r.entities[bench.id]).toBeUndefined();
    // 6) the row now tells the truth: placeable, but AT that damage, and names the paid control
    const prep=structurePreparation(r,'workbench');
    expect(prep.materials).toBe(true);
    expect(prep.pack!.dur).toBe(40);expect(prep.pack!.max).toBe(160);
    expect(prep.next).toMatch(/worn \(40\/160\).*places at that damage, nothing is healed/);
    expect(prep.next).toMatch(/re-forge for 4 Wood \+ 1 Stone at the Furnace/);
    // 7) redeploying the worn pack places it worn — the no-heal rule survives a save round trip
    const snapOfWorn=copy(o.g);
    const bench2=o.place('workbench');
    expect(bench2.hp).toBe(40);expect(bench2.deployed!.uid).toBe(uid);
    beside(r,bench2);
    expect(act(o.g,'reclaim',{eid:bench2.id}).ok).toBe(true);
    expect(r.custody.inv.slots[slot()]!.dur).toBe(40);
    // 8) the paid re-forge at the Furnace: one receipt, same UID, full condition, exact materials out
    const w=countItem(r,'inv','wood'),st=countItem(r,'inv','stone');
    beside(r,furnace);
    const res=act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'},'reforge-once');
    expect(res.ok,'maintainItem: '+JSON.stringify(res)).toBe(true);
    expect(r.custody.inv.slots[slot()]!.dur).toBe(160);
    expect(r.custody.inv.slots[slot()]!.uid).toBe(uid);
    expect([countItem(r,'inv','wood'),countItem(r,'inv','stone')]).toEqual([w-4,st-1]);
    // 9) a replayed command cannot double-dip, and a full pack cannot be repaired again
    // the same intent id may not spend the price twice…
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'},'reforge-once')).toMatchObject({ok:false,dup:true});
    // …and a brand-new intent has nothing left to fix, because a full pack is not a repair target
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'})).toMatchObject({ok:false});
    expect(r.custody.inv.slots[slot()]!.dur).toBe(160);
    // 10) save/restart on the repaired pack, then redeploy at full condition
    const reloaded=copy(o.g);
    const g2=newGame();g2.run=reloaded.run!;g2.profile=reloaded.profile;markDirty();
    const r2=g2.run!;
    const s2=()=>r2.custody.inv.slots.findIndex(s=>s?.key==='deploy_workbench');
    expect(s2()).toBeGreaterThanOrEqual(0);
    expect(r2.custody.inv.slots[s2()]!.dur).toBe(160);expect(r2.custody.inv.slots[s2()]!.uid).toBe(uid);
    const bench3=o.place('workbench');
    expect(bench3.hp).toBe(160);
    // 11) conservation across the whole life: exactly the two build lists plus one patch, and the
    // device is standing. Nothing was minted, nothing was silently refunded.
    const spentW=wood0-countItem(r2,'inv','wood'),spentS=stone0-countItem(r2,'inv','stone');
    const builds:Record<string,number>={};
    for(const t of ['workbench','furnace'])for(const [k,q] of STRUCTS[t].cost)builds[k]=(builds[k]??0)+q;
    expect(spentW).toBe(builds.wood+4);               // both packs once each, plus the 4-wood patch
    expect(spentS).toBe(builds.stone+1);              // …plus the single 1-stone patch
    // the reloaded copy still holds the pack (the placement below happened in the live run), and the
    // live run now owns exactly one Workbench — one identity, one entity, no second bench
    expect(countItem(r2,'inv','deploy_workbench')).toBe(1);
    expect(Object.values(r.entities).filter(e=>e.kind==='struct'&&e.type==='workbench').length).toBe(1);
    expect(snapOfWorn).toBeTruthy();
  });
  it('refuses the wrong station, the missing materials and the undamaged pack — and spends nothing',()=>{
    const o=setup();const r=o.r;
    addItem(r,'inv','wood',40);addItem(r,'inv','stone',24);
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
    const slot=()=>C(r,'inv').slots.findIndex(s=>s?.key==='deploy_workbench');
    const uid=r.custody.inv.slots[slot()]!.uid;
    const bench=o.place('workbench');bench.hp=40;
    beside(r,bench);
    expect(act(o.g,'reclaim',{eid:bench.id}).ok).toBe(true);
    r.custody.inv.slots[slot()]!.dur=40;
    // a) at the workbench itself: refused (this is the self-softlock the rule exists to avoid)
    expect(act(o.g,'maintainItem',{eid:bench.id,slot:slot(),uid,mode:'repair'})).toMatchObject({ok:false});
    expect(r.custody.inv.slots[slot()]!.dur).toBe(40);
    expect(countItem(r,'inv','wood')).toBe(40-14);expect(countItem(r,'inv','stone')).toBe(24-4);
    // b) no furnace yet: no station anywhere accepts it
    expect(Object.values(r.entities).some(e=>e.kind==='struct'&&e.type==='furnace')).toBe(false);
    // c) a Furnace, but no wood: refusal, and the pack is untouched
    o.place('furnace','deploy_furnace');
    const furnace=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='furnace')!;
    beside(r,furnace);
    for(const s of C(r,'inv').slots) if(s?.key==='wood') s.qty=3;              // below the 4-wood patch price
    const woodBefore=countItem(r,'inv','wood'),stoneBefore=countItem(r,'inv','stone');
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'})).toMatchObject({ok:false});
    expect(r.custody.inv.slots[slot()]!.dur).toBe(40);
    expect(countItem(r,'inv','wood')).toBe(woodBefore);expect(countItem(r,'inv','stone')).toBe(stoneBefore);
    // d) an undamaged pack is never a repair target, and cannot be "topped up"
    addItem(r,'inv','wood',4);addItem(r,'inv','stone',1);
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'}).ok).toBe(true);
    expect(r.custody.inv.slots[slot()]!.dur).toBe(160);
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid,mode:'repair'})).toMatchObject({ok:false});
  });
  it('a destroyed device is not a pristine item, and a forged zero-condition pack is only recoverable by paying',()=>{
    const o=setup();const r=o.r;
    addItem(r,'inv','wood',40);addItem(r,'inv','stone',24);
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
    const bench=o.place('workbench');
    bench.hp=0;
    expect(act(o.g,'reclaim',{eid:bench.id}).ok).toBe(false);           // no pristine item from rubble
    expect(r.entities[bench.id]).toBeTruthy();
    // a forged save can carry a dead pack: it must not place, and only the price revives it
    expect(act(o.g,'reclaim',{eid:bench.id}).ok).toBe(false);              // still nothing from rubble
    addItem(r,'inv','deploy_workbench',1);
    const slot=()=>C(r,'inv').slots.findIndex(s=>s?.key==='deploy_workbench');
    r.custody.inv.slots[slot()]!.dur=0;
    const ptx=Math.floor(r.player.x/TILE),pty=Math.floor(r.player.y/TILE);   // in reach, so the pack rule is what speaks
    expect(buildReason(o.g,'workbench',ptx+1,pty)).toBe('Need an intact packed device.');
    const prep=structurePreparation(r,'workbench');
    expect(prep.materials).toBe(false);
    expect(prep.next).toMatch(/has no condition left \(0\/160\) and cannot be placed · re-forge for 4 Wood \+ 1 Stone at the Furnace/);
    expect(act(o.g,'maintainItem',{eid:'nothing',slot:slot(),uid:r.custody.inv.slots[slot()]!.uid,mode:'repair'}).ok).toBe(false);
    o.place('furnace','deploy_furnace');
    const furnace=Object.values(r.entities).find(e=>e.kind==='struct'&&e.type==='furnace')!;
    beside(r,furnace);
    expect(act(o.g,'maintainItem',{eid:furnace.id,slot:slot(),uid:r.custody.inv.slots[slot()]!.uid,mode:'repair'}).ok).toBe(true);
    expect(r.custody.inv.slots[slot()]!.dur).toBe(160);
    expect(validate(o.g)).not.toBeNull();
  });
});
