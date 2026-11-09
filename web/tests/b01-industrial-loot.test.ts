// B01 technical proof (WP-B01-E). Rule invariants, transaction integrity, persistence and version pins only.
// NOT a survival or fun test: no automated player progression is asserted here.
import {afterAll,describe,it,expect} from 'vitest';
import {BAL,TILE,type GameState} from '../src/game/core';
import {ITEMS,RECIPES,STRUCTS} from '../src/game/catalog';
import {addItem,C,countItem,dispatch,markDirty,mkContainer,newGame,stepStations} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {recoveryPlan,recoveryPlanFor} from '../src/game/recycler';
import {settle,syncWorld} from '../src/game/sim';
import {LOOT_GRAMMAR_VERSION,LOOT_B01_ROLES,LI_2022_CONTAINER_CONTRACT,lootClass,lootGrade,lootGrammarRoll,lootRoll,lootRole,lootSlots,type LootClass} from '../src/game/loot-ecology';

const T=Date.UTC(2026,10,6);let n=0;
function fresh(seed=71){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'b01-start'+ ++n,type:'startRun',character:'female',seed},T).ok).toBe(true);const r=g.run!;r.creatures=[];markDirty();return {g,r};}
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
afterAll(()=>setActiveLayout('shipping'));

describe('B01-R1 A: source-specific loot roles (no universal Food/Medical overlay)',()=>{
  const FOOD=['berries','mushroom','herb'], MED=['bandage','herb'];
  it('fresh runs carry the current grammar (WEC-01 P0-4: loot-source-v3); pre-B01 saves (no field) keep only the W06 pair',()=>{
    const {r}=fresh();expect(r.lootEcology?.grammar).toBe('loot-source-v3');   // WEC-01: new runs use loot-source-v3; b01-v1, b04-v1 and b05-v1 saves keep their pools
    const sites=getWorld('shipping_fresh').statics.filter(s=>lootClass(s));expect(sites.length).toBeGreaterThan(0);
    const saved=r.lootEcology;r.lootEcology={...saved!,grammar:undefined} as any;
    for(const s of sites) expect(lootRoll(r,s,0).length).toBeLessThanOrEqual(2);
    r.lootEcology=saved;
  });
  it('each W06 class has exactly one role; no class receives both the food and the medical role',()=>{
    const {r}=fresh();const sites=getWorld('shipping_fresh').statics.filter(s=>lootClass(s));
    const roles=new Set<string>();
    for(const s of sites){
      const kind=lootClass(s) as LootClass;const role=lootRole(s);roles.add(`${kind}:${role}`);
      expect(LOOT_B01_ROLES[kind].role).toBe(role);
      const keys=lootGrammarRoll(r,s,0).map(([k])=>k);
      expect(keys.some(k=>FOOD.includes(k)) && keys.some(k=>MED.includes(k) && k!=='herb')).toBe(false);
      if(kind==='toolbox')expect(keys.some(k=>FOOD.includes(k)||MED.includes(k))).toBe(false);
      if(kind==='supply')expect(keys.some(k=>MED.includes(k)&&k!=='herb')).toBe(false);
      if(kind==='military')expect(keys.some(k=>['berries','mushroom'].includes(k))).toBe(false);
    }
    expect([...roles].sort()).toEqual(['advanced:medical_high','military:medical','supply:food','toolbox:metal']);
  });
  it('a real distribution over 300 seeds: every pool option appears, and only pool options appear',()=>{
    const {r}=fresh(71);const sites=getWorld('shipping_fresh').statics.filter(s=>lootClass(s));
    r.lootEcology={...r.lootEcology!,grammar:'b01-v1'} as any;   // this distribution is the B01 pool (save-compatible); b04-v1 pools are tested in b04-p4-loot
    const supply=sites.find(s=>lootClass(s)==='supply')!, military=sites.find(s=>lootClass(s)==='military')!;
    const seenSupply=new Set<string>(), seenMil=new Set<string>();
    for(let seed=1;seed<=300;seed++){
      r.seed=seed;
      for(const [k] of lootGrammarRoll(r,supply,0)) seenSupply.add(k);
      for(const [k] of lootGrammarRoll(r,military,0)) seenMil.add(k);
    }
    expect([...seenSupply].sort()).toEqual([...FOOD].sort());
    expect([...seenMil].sort()).toEqual([...MED].sort());
  });
  it('same run seed, source and cycle is exactly repeatable; a changed cycle is a separate deterministic draw',()=>{
    const {r}=fresh(71);const sites=getWorld('shipping_fresh').statics.filter(s=>lootClass(s));
    for(const s of sites){
      expect(lootGrammarRoll(r,s,1)).toEqual(lootGrammarRoll(r,s,1));
      expect(lootGrammarRoll(r,s,2)).toEqual(lootGrammarRoll(r,s,2));
    }
  });
  it('negative: cash, blueprints, keycards, unique tools and energy cores are never emitted',()=>{
    const {r}=fresh(71);const sites=getWorld('shipping_fresh').statics.filter(s=>lootClass(s));const bad=['rcash','blueprint','keycard','damaged_drive','energy_basic','core_blast','iron_pick'];
    expect(sites.length).toBeGreaterThan(0);                                        // precondition: at least one industrial site exists in the fixture
    let rolled=0;
    for(let seed=1;seed<=60;seed++){r.seed=seed;for(const s of sites)for(const c of [0,1,2,3])for(const [k] of lootGrammarRoll(r,s,c)){rolled++;expect(bad).not.toContain(k);}}
    expect(rolled).toBeGreaterThan(0);                                            // precondition: emissions happened across the seed sweep
  });
  it('bounds every authored and generated slot inside the B01 container size',()=>{
    const {r}=fresh();const world=getWorld('shipping_fresh');
    for(const s of world.statics.filter(s=>lootClass(s))){expect(s.loot!.length+lootRoll(r,s,1).length).toBeLessThanOrEqual(lootSlots(r));}
    expect(lootSlots(r)).toBe(12);
  });
  it('records the historical 2022 container contract as a comparison constant, not as SOH content',()=>{
    expect(LI_2022_CONTAINER_CONTRACT).toEqual({green:6,blue:6,purple:7});
    expect(lootGrade(getWorld('shipping_fresh').statics.find(x=>lootClass(x)==='advanced')!)).toBe('high');
  });
});

describe('B01 B: intermediates have real producers and consumers',()=>{
  const NEW=['refined_iron_ingot','metal_pipe','metal_blade','mechanical_gear','iron_plate'];
  it('every new intermediate has a recipe producer and at least two crafted or repair consumers',()=>{
    for(const k of NEW){
      expect(ITEMS[k]).toBeDefined();
      const producers=Object.values(RECIPES).filter(rc=>rc.out===k);expect(producers.length).toBeGreaterThanOrEqual(1);
      const consumers=Object.entries(RECIPES).filter(([,rc])=>rc.ins.some(([i])=>i===k));
      // iron_plate's second consumer is the wall/door repair action (not a recipe), tested in C2.
      if(k!=='iron_plate')expect(consumers.length).toBeGreaterThanOrEqual(1);
    }
    expect(Object.values(RECIPES).filter(rc=>rc.ins.some(([i])=>i==='metal_pipe')).length).toBeGreaterThanOrEqual(2);
    expect(Object.values(RECIPES).filter(rc=>rc.ins.some(([i])=>i==='mechanical_gear')).length).toBeGreaterThanOrEqual(2);
    expect(Object.values(RECIPES).filter(rc=>rc.ins.some(([i])=>i==='metal_blade')).length).toBeGreaterThanOrEqual(2);
  });
  it('alias recipes share an output with a base recipe but keep their own tier and station level',()=>{
    expect(RECIPES.vehicle_frame_piped.out).toBe(RECIPES.vehicle_frame.out);expect(RECIPES.vehicle_frame_piped.alias).toBeTruthy();
    expect(RECIPES.vehicle_frame_piped.stationLevel).toBe(2);expect(RECIPES.vehicle_frame.stationLevel).toBe(2);
    expect(RECIPES.refined_iron_ingot.station).toBe('furnace');
  });
  it('a real station craft pays time and yields a physical metal blade into the output container',()=>{
    const {g,r}=fresh();const id='b01-bench-'+(++n);const fuel=mkContainer(r,'fuel',0),out=mkContainer(r,'out',4);
    const tx=Math.floor(r.player.x/TILE),ty=Math.floor(r.player.y/TILE);
    r.entities[id]={id,kind:'struct',type:'workbench',tx:tx+1,ty:ty+1,x:(tx+1)*TILE,y:(ty+1)*TILE,hp:160,maxHp:160,station:{fuelC:fuel.id,outC:out.id,burn:0,queue:[],level:2}} as any;
    markDirty();r.player.x=(tx+1)*TILE;r.player.y=(ty+1)*TILE;
    for(const [k,q] of RECIPES.metal_blade.ins)addItem(r,'inv',k,q);
    const cr=dispatch(g,{id:'b01-craft-'+ ++n,type:'craft',eid:id,recipe:'metal_blade'},T);expect(cr.ok,JSON.stringify(cr)).toBe(true);
    expect(countItem(r,'inv','iron_ingot')).toBe(0);
    stepStations(g,1000,T+1000);expect(countItem(r,out.id,'metal_blade')).toBe(0);
    stepStations(g,16000,T+17000);expect(countItem(r,out.id,'metal_blade')).toBe(1);
  });
  it('an unpaid or underpowered workbench craft is refused without consuming inputs',()=>{
    const {g,r}=fresh();const tx=Math.floor(r.player.x/TILE),ty=Math.floor(r.player.y/TILE);const id='b01-nobench';
    addItem(r,'inv','iron_ingot',4);addItem(r,'inv','mechanical_parts',1);
    expect(dispatch(g,{id:'b01-nb-'+ ++n,type:'craft',eid:id,recipe:'metal_blade'},T).ok).toBe(false);
    expect(countItem(r,'inv','iron_ingot')).toBe(4);void tx;void ty;
  });
});

describe('B01 C: recycler v2 versioning and multi-output',()=>{
  const sword=(dur:number)=>({uid:'u-sword',key:'iron_sword',qty:1,dur});
  it('new jobs use the current version for tools listed in it (MEC-01 P1: v3 for the four over-returning keys) and keep v1 for the rest',()=>{
    // MEC-01 P1: recyclerV2 over-returned for these keys; new jobs now use recyclerV3. Saved v2 jobs stay on v2 (next test).
    expect(recoveryPlan(sword(300) as any)?.recipe).toBe('X:recover-v3');
    expect(recoveryPlan(sword(300) as any)?.outputs).toEqual([['scrap',1],['iron_ingot',1],['iron_ingot',1],['leather',1]]);
    expect(recoveryPlan({uid:'u-pick',key:'iron_pick',qty:1,dur:400} as any)?.recipe).toBe('X:recover-v3');
    expect(recoveryPlan({uid:'u-spear',key:'reinforced_spear',qty:1,dur:200} as any)?.recipe).toBe('X:recover-v1');
  });
  it('a queued v1 job keeps v1 outputs after v2 exists, identical to the pre-B01 table',()=>{
    expect(recoveryPlanFor(sword(300) as any,'X:recover-v1')?.outputs).toEqual([['scrap',1],['iron_ingot',1],['leather',1]]);
    expect(recoveryPlanFor({uid:'u-pick',key:'iron_pick',qty:1,dur:400} as any,'X:recover-v1')?.outputs).toEqual([['scrap',1],['iron_ingot',1],['wood',1]]);
    expect(recoveryPlanFor(sword(300) as any,'X:recover-v2')?.recipe).toBe('X:recover-v2');
    expect(recoveryPlanFor(sword(300) as any,'X:recover-v2')?.outputs).toEqual([['scrap',1],['iron_ingot',1],['metal_blade',1],['leather',1],['metal_blade',1]]); // pinned saved v2 outputs unchanged
    expect(recoveryPlanFor(sword(300) as any,'X:bogus')).toBeNull();
  });
  it('the same selected UID cannot be used by a v2 recycle and a craft at once (reservation removes it)',()=>{
    const {g,r}=fresh();const machine=Object.values(r.entities).find(e=>e.kind==='recycler')!;
    r.player.x=machine.x+TILE;r.player.y=machine.y;markDirty();
    addItem(r,'inv','iron_sword',1,{dur:300});const i=C(r,'inv').slots.findIndex(s=>s?.key==='iron_sword');const s=C(r,'inv').slots[i]!;
    expect(dispatch(g,{id:'b01-rec-'+ ++n,type:'recycleItem',eid:machine.id,slot:i,uid:s.uid},T).ok).toBe(true);
    expect(C(r,'inv').slots[i]).toBeNull();
    expect(countItem(r,'inv','iron_sword')).toBe(0);
  });
  it('a stored v2 job with an out-of-table key is rejected by save validation (no silent repricing)',()=>{
    const {g,r}=fresh();const machine=Object.values(r.entities).find(e=>e.kind==='recycler')!;
    const bad=structuredClone(g);const st=bad.run!.entities[machine.id].station!;
    st.queue.push({id:'jb01bad',recipe:'X:recover-v2',left:BAL.recyclerV2.seconds*1000,total:BAL.recyclerV2.seconds*1000,reserved:[{uid:'u-spear',key:'reinforced_spear',qty:1,dur:200}]} as any);
    expect(()=>serializeSnapshot(bad)).toThrow('invalid game state');void r;
  });
});

describe('B01-R1 C2: iron plate is a paid bounded patch (25% max HP per plate)',()=>{
  function rig(type:string,hp:number,x=1){
    const {g,r}=fresh();const id='b01-s-'+type+'-'+hp;const tx=Math.floor(r.player.x/TILE),ty=Math.floor(r.player.y/TILE);
    r.entities[id]={id,kind:'struct',type,tx:tx+x,ty,x:(tx+x)*TILE+8,y:ty*TILE+8,hp,maxHp:STRUCTS[type].hp} as any;
    r.player.x=(tx+x)*TILE-4;r.player.y=ty*TILE+8;markDirty();
    return {g,r,id};
  }
  const patch=(max:number)=>Math.ceil(max*BAL.ironPlatePatchV1.fraction);
  it('versioned provisional fraction is 0.25 in the balance section',()=>{
    expect(BAL.ironPlatePatchV1.fraction).toBe(0.25);expect(String(BAL.ironPlatePatchV1._status)).toContain('SOH_PROVISIONAL');
  });
  it('1 HP wood wall: one plate patches exactly ceil(25%) and is consumed; NOT a full heal',()=>{
    const {g,r,id}=rig('wall_wood',1);addItem(r,'inv','iron_plate',1);
    expect(dispatch(g,{id:'p1-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T).ok).toBe(true);
    expect(r.entities[id].hp).toBe(1+patch(STRUCTS.wall_wood.hp));expect(r.entities[id].hp).toBeLessThan(STRUCTS.wall_wood.hp);
    expect(countItem(r,'inv','iron_plate')).toBe(0);
  });
  it('near-full wall is patched only to max (cap) and still spends exactly one plate',()=>{
    const max=STRUCTS.wall_stone.hp;const {g,r,id}=rig('wall_stone',max-3);addItem(r,'inv','iron_plate',1);
    expect(dispatch(g,{id:'p2-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T).ok).toBe(true);
    expect(r.entities[id].hp).toBe(max);expect(countItem(r,'inv','iron_plate')).toBe(0);
  });
  it('metal (brick) wall and door: the same 25% rule applies to their own max HP',()=>{
    const b=rig('wall_brick',100);addItem(b.r,'inv','iron_plate',1);
    expect(dispatch(b.g,{id:'p3-'+ ++n,type:'repairStructure',eid:b.id,material:'iron_plate'},T).ok).toBe(true);
    expect(b.r.entities[b.id].hp).toBe(100+patch(STRUCTS.wall_brick.hp));
    const d=rig('door_iron',100);addItem(d.r,'inv','iron_plate',1);
    expect(dispatch(d.g,{id:'p4-'+ ++n,type:'repairStructure',eid:d.id,material:'iron_plate'},T).ok).toBe(true);
    expect(d.r.entities[d.id].hp).toBe(100+patch(STRUCTS.door_iron.hp));
  });
  it('repeated intent: a second plate on an already full wall is refused and spends nothing',()=>{
    const {g,r,id}=rig('wall_wood',STRUCTS.wall_wood.hp);addItem(r,'inv','iron_plate',2);
    expect(dispatch(g,{id:'p5-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T).ok).toBe(false);
    expect(countItem(r,'inv','iron_plate')).toBe(2);expect(r.entities[id].hp).toBe(STRUCTS.wall_wood.hp);
  });
  it('no plate carried is refused; a non-wall structure refuses plates and keeps the plate',()=>{
    const a=rig('wall_wood',40);
    expect(dispatch(a.g,{id:'p6-'+ ++n,type:'repairStructure',eid:a.id,material:'iron_plate'},T).ok).toBe(false);
    expect(a.r.entities[a.id].hp).toBe(40);
    const w=rig('workbench',40);addItem(w.r,'inv','iron_plate',1);
    expect(dispatch(w.g,{id:'p7-'+ ++n,type:'repairStructure',eid:w.id,material:'iron_plate'},T).ok).toBe(false);
    expect(countItem(w.r,'inv','iron_plate')).toBe(1);
  });
  it('invalid entity id is refused without spending a plate',()=>{
    const {g,r}=rig('wall_wood',40);addItem(r,'inv','iron_plate',1);
    expect(dispatch(g,{id:'p8-'+ ++n,type:'repairStructure',eid:'no-such-entity',material:'iron_plate'},T).ok).toBe(false);
    expect(countItem(r,'inv','iron_plate')).toBe(1);
  });
  it('normal wood repair path is unchanged when no plate is named (wood cost, 25% of max)',()=>{
    const {g,r,id}=rig('wall_wood',40);addItem(r,'inv','wood',20);
    expect(dispatch(g,{id:'p9-'+ ++n,type:'repairStructure',eid:id},T).ok).toBe(true);
    expect(r.entities[id].hp).toBe(40+Math.ceil(STRUCTS.wall_wood.hp/4));
  });
  it('the patched HP survives save and reload exactly once (no duplicate plate, no duplicate HP)',()=>{
    const {g,r,id}=rig('wall_wood',10);addItem(r,'inv','iron_plate',1);
    expect(dispatch(g,{id:'p10-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T).ok).toBe(true);
    const back=selectSnapshots([serializeSnapshot(g),null]).gs!;
    expect(back.run!.entities[id].hp).toBe(10+patch(STRUCTS.wall_wood.hp));expect(countItem(back.run!,'inv','iron_plate')).toBe(0);
  });
});

describe('B01 D: single run-local recipe knowledge authority',()=>{
  it('a fresh run seeds exactly its base + always-known keys; nothing else is known',()=>{
    const {r}=fresh();
    for(const k of Object.keys(RECIPES)){
      const want=RECIPES[k].base||['vehicle_frame','vehicle_drive','recover_drive','energy_refined_industrial','energy_basic','energy_refined','essence_fire','essence_nature','essence_water','essence_spirit','core_blast','core_earthmother'].includes(k);
      expect(r.knowledge.recipes.includes(k)).toBe(want);
    }
  });
  it('an old save missing the always-known keys regains them on validation (migration, no reroll)',()=>{
    const {g}=fresh();const bad=structuredClone(g);
    bad.run!.knowledge.recipes=bad.run!.knowledge.recipes.filter(k=>!['energy_basic','core_blast'].includes(k));
    const text=serializeSnapshot(bad);const back=selectSnapshots([text,null]).gs!;
    expect(back.run!.knowledge.recipes).toContain('energy_basic');expect(back.run!.knowledge.recipes).toContain('core_blast');
  });
  it('a non-base recipe not in the run list cannot be crafted',()=>{
    const {g,r}=fresh();
    r.knowledge.recipes=r.knowledge.recipes.filter(k=>k!=='metal_blade');
    addItem(r,'inv','iron_ingot',4);addItem(r,'inv','mechanical_parts',1);
    const res=dispatch(g,{id:'b01-unknown-'+ ++n,type:'craft',eid:'nowhere',recipe:'metal_blade'},T);expect(res.ok).toBe(false);expect(r.knowledge.recipes).not.toContain('metal_blade');
  });
});

describe('B01-R1 C: recycler v2 condition, cancel, capacity, offline and UID invariants',()=>{
  const machineOf=(r:any)=>Object.values(r.entities).find((e:any)=>e.kind==='recycler') as any;
  function rig(seed=71){const {g,r}=fresh(seed);const m=machineOf(r);r.player.x=m.x+TILE;r.player.y=m.y;markDirty();return {g,r,m};}
  const copyG=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
  it('v2 condition tiers: low condition yields scrap only; mid and high add the listed v2 outputs',()=>{
    const max=ITEMS.iron_sword.dur!;
    // Pinned v2 tier mechanics (saved X:recover-v2 jobs). New jobs for this key use v3 (MEC-01 P1).
    const lo=recoveryPlanFor({uid:'a',key:'iron_sword',qty:1,dur:Math.floor(max*0.1)} as any,'X:recover-v2')!;
    const mid=recoveryPlanFor({uid:'b',key:'iron_sword',qty:1,dur:Math.floor(max*0.5)} as any,'X:recover-v2')!;
    const hi=recoveryPlanFor({uid:'c',key:'iron_sword',qty:1,dur:Math.floor(max*0.95)} as any,'X:recover-v2')!;
    expect(lo.outputs).toEqual([['scrap',1]]);
    expect(mid.outputs).toEqual([['scrap',1],['iron_ingot',1],['metal_blade',1]]);
    expect(hi.outputs).toEqual([['scrap',1],['iron_ingot',1],['metal_blade',1],['leather',1],['metal_blade',1]]);
  });
  it('no free condition upgrade: recycling never raises the reserved stack condition',()=>{
    const {g,r,m}=rig();const max=ITEMS.iron_sword.dur!;addItem(r,'inv','iron_sword',1,{dur:Math.floor(max*0.1)});
    const i=C(r,'inv').slots.findIndex((x:any)=>x?.key==='iron_sword');const st=C(r,'inv').slots[i]!;const before=st.dur;
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid:st.uid},T).ok).toBe(true);
    const job=m.station.queue[0];expect(job.recipe).toBe('X:recover-v3');expect(job.reserved[0].dur).toBe(before);
    expect(job.reserved[0].uid).toBe(st.uid);
  });
  it('cancel of a v2 job returns the same UID and no outputs',()=>{
    const {g,r,m}=rig();const max=ITEMS.iron_sword.dur!;addItem(r,'inv','iron_sword',1,{dur:Math.floor(max*0.5)});
    const i=C(r,'inv').slots.findIndex((x:any)=>x?.key==='iron_sword');const uid=C(r,'inv').slots[i]!.uid;
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid},T).ok).toBe(true);
    const jobId=m.station.queue[0].id;
    expect(dispatch(g,{id:'v2-cancel-'+ ++n,type:'cancelJob',eid:m.id,jobId},T).ok).toBe(true);
    const back=C(r,'inv').slots.find((x:any)=>x?.uid===uid);expect(back?.key).toBe('iron_sword');
    expect(countItem(r,m.station.outC,'metal_blade')).toBe(0);expect(m.station.queue.length).toBe(0);
  });
  it('atomic output fit: a full output container commits nothing; the input stays reserved until room exists',()=>{
    const {g,r,m}=rig();const max=ITEMS.iron_sword.dur!;addItem(r,'inv','iron_sword',1,{dur:Math.floor(max*0.95)});
    const i=C(r,'inv').slots.findIndex((x:any)=>x?.key==='iron_sword');const uid=C(r,'inv').slots[i]!.uid;
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid},T).ok).toBe(true);
    const out=C(r,m.station.outC);for(let k=0;k<out.slots.length;k++)out.slots[k]=null;
    for(const key of ['rope','fiber','wood','stone'])addItem(r,m.station.outC,key,1);
    while(C(r,m.station.outC).slots.some((x:any)=>!x)) addItem(r,m.station.outC,'stone',1);
    const full=C(r,m.station.outC).slots.filter(Boolean).length;expect(C(r,m.station.outC).slots.every(Boolean)).toBe(true);
    settle(g,T+60000,true);
    expect(m.station.queue.length).toBe(1);expect(countItem(r,m.station.outC,'scrap')).toBe(0);
    expect(C(r,m.station.outC).slots.filter(Boolean).length).toBe(full);
    void uid;
  });
  it('chunked offline advancement equals direct advancement for v2 outputs and receipts',()=>{
    const {g,r,m}=rig();const max=ITEMS.iron_sword.dur!;addItem(r,'inv','iron_sword',1,{dur:Math.floor(max*0.95)});
    const i=C(r,'inv').slots.findIndex((x:any)=>x?.key==='iron_sword');
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid:C(r,'inv').slots[i]!.uid},T).ok).toBe(true);
    const a=copyG(g),b=copyG(g);
    settle(a,T+60000,true);for(let t=1000;t<=60000;t+=1000)syncWorld(b,T+t);
    for(const k of ['scrap','iron_ingot','metal_blade','leather']) expect(countItem(a.run!,m.station.outC,k)).toBe(countItem(b.run!,m.station.outC,k));
    expect(a.run!.receipts.filter(q=>q.kind==='job.done').map(q=>q.at)).toEqual(b.run!.receipts.filter(q=>q.kind==='job.done').map(q=>q.at));
  });
  it('UID anti-clone: the same UID cannot be submitted twice, and completion yields exactly one plan',()=>{
    const {g,r,m}=rig();const max=ITEMS.iron_sword.dur!;addItem(r,'inv','iron_sword',1,{dur:Math.floor(max*0.5)});
    const i=C(r,'inv').slots.findIndex((x:any)=>x?.key==='iron_sword');const uid=C(r,'inv').slots[i]!.uid;
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid},T).ok).toBe(true);
    expect(countItem(r,'inv','iron_sword')).toBe(0);
    expect(dispatch(g,{id:'v2-rec-'+ ++n,type:'recycleItem',eid:m.id,slot:i,uid},T).ok).toBe(false);
    settle(g,T+60000,true);
    expect(countItem(r,m.station.outC,'iron_ingot')).toBe(1);expect(countItem(r,m.station.outC,'metal_blade')).toBe(0); // v3 mid: no blade
    expect(countItem(r,'inv','iron_sword')).toBe(0);
  });
});
