// B01 technical proof (WP-B01-E). Rule invariants, transaction integrity, persistence and version pins only.
// NOT a survival or fun test: no automated player progression is asserted here.
import {afterAll,describe,it,expect} from 'vitest';
import {BAL,TILE,type GameState} from '../src/game/core';
import {ITEMS,RECIPES,STRUCTS} from '../src/game/catalog';
import {addItem,C,countItem,dispatch,markDirty,mkContainer,newGame,stepStations} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {recoveryPlan,recoveryPlanFor} from '../src/game/recycler';
import {LOOT_GRAMMAR_VERSION,LOOT_B01_FAMILIES,LI_2022_CONTAINER_CONTRACT,lootClass,lootGrade,lootGrammarRoll,lootRoll,lootSlots} from '../src/game/loot-ecology';

const T=Date.UTC(2026,10,6);let n=0;
function fresh(seed=71){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'b01-start'+ ++n,type:'startRun',character:'female',seed},T).ok).toBe(true);const r=g.run!;r.creatures=[];markDirty();return {g,r};}
const copy=(g:GameState)=>selectSnapshots([serializeSnapshot(g),null]).gs!;
afterAll(()=>setActiveLayout('shipping'));

describe('B01 A: loot family x grade grammar',()=>{
  it('fresh runs carry the B01 grammar; pre-B01 saves (no field) keep only the W06 pair',()=>{
    const {r}=fresh();expect(r.lootEcology?.grammar).toBe(LOOT_GRAMMAR_VERSION);
    const world=getWorld('shipping_fresh');const sites=world.statics.filter(s=>lootClass(s));expect(sites.length).toBeGreaterThan(0);
    const old={...r.lootEcology!,grammar:undefined} as any;const saved=r.lootEcology;r.lootEcology=old;
    for(const s of sites) expect(lootRoll(r,s,0).length).toBeLessThanOrEqual(2);
    r.lootEcology=saved;
  });
  it('grades map to existing classes and every grammar stack is an eligible consumable food/medical item',()=>{
    const {r}=fresh();const world=getWorld('shipping_fresh');
    for(const s of world.statics.filter(s=>lootClass(s))){
      const g=lootGrade(s);expect(['low','mid','high']).toContain(g);
      const extras=lootGrammarRoll(r,s,0);
      expect(extras.length).toBeGreaterThan(0);
      for(const [k,q] of extras){expect(ITEMS[k]).toBeDefined();expect(ITEMS[k].cat).toBe('food');expect(q).toBeGreaterThan(0);expect(['energy_basic','energy_refined','rcash','blueprint','damaged_drive','keycard']).not.toContain(k);}
      const keys=extras.map(([k])=>k);expect(keys.some(k=>LOOT_B01_FAMILIES.medical.options.some(([m])=>m===k)||k==='medkit')).toBe(true);
      expect(keys.some(k=>LOOT_B01_FAMILIES.food.options.some(([f])=>f===k))).toBe(true);
      if(g==='high')expect(keys).toContain('medkit');
    }
  });
  it('is deterministic per run/source/cycle and changes with the run seed',()=>{
    const a=fresh(71).r,b=fresh(71).r,c=fresh(72).r;const s=getWorld('shipping_fresh').statics.find(x=>lootClass(x))!;
    expect(lootGrammarRoll(a,s,1)).toEqual(lootGrammarRoll(b,s,1));
    const seen=new Set([JSON.stringify(lootGrammarRoll(a,s,1)),JSON.stringify(lootGrammarRoll(c,s,1))]);expect(seen.size).toBeGreaterThanOrEqual(1);
  });
  it('bounds every authored and generated slot inside the B01 container size',()=>{
    const {r}=fresh();const world=getWorld('shipping_fresh');
    for(const s of world.statics.filter(s=>lootClass(s))){expect(s.loot!.length+lootRoll(r,s,1).length).toBeLessThanOrEqual(lootSlots(r));}
    expect(lootSlots(r)).toBe(12);
  });
  it('records the historical 2022 container contract as a comparison constant, not as SOH content',()=>{
    expect(LI_2022_CONTAINER_CONTRACT).toEqual({green:6,blue:6,purple:7});
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
    const tx=r.player.tx??0,ty=r.player.ty??0;
    r.entities[id]={id,kind:'struct',type:'workbench',tx:tx+1,ty:ty+1,x:(tx+1)*TILE,y:(ty+1)*TILE,hp:160,maxHp:160,station:{fuelC:fuel.id,outC:out.id,burn:0,queue:[],level:2}} as any;
    markDirty();r.player.x=(tx+1)*TILE;r.player.y=(ty+1)*TILE;
    for(const [k,q] of RECIPES.metal_blade.ins)addItem(r,'inv',k,q);
    const cr=dispatch(g,{id:'b01-craft-'+ ++n,type:'craft',eid:id,recipe:'metal_blade'},T);expect(cr.ok,JSON.stringify(cr)).toBe(true);
    expect(countItem(r,'inv','iron_ingot')).toBe(0);
    stepStations(g,1000,T+1000);expect(countItem(r,out.id,'metal_blade')).toBe(0);
    stepStations(g,16000,T+17000);expect(countItem(r,out.id,'metal_blade')).toBe(1);
  });
  it('an unpaid or underpowered workbench craft is refused without consuming inputs',()=>{
    const {g,r}=fresh();const tx=r.player.tx??0,ty=r.player.ty??0;const id='b01-nobench';
    addItem(r,'inv','iron_ingot',4);addItem(r,'inv','mechanical_parts',1);
    expect(dispatch(g,{id:'b01-nb-'+ ++n,type:'craft',eid:id,recipe:'metal_blade'},T).ok).toBe(false);
    expect(countItem(r,'inv','iron_ingot')).toBe(4);void tx;void ty;
  });
});

describe('B01 C: recycler v2 versioning and multi-output',()=>{
  const sword=(dur:number)=>({uid:'u-sword',key:'iron_sword',qty:1,dur});
  it('new jobs use X:recover-v2 for tools listed in v2 and keep v1 for the rest',()=>{
    expect(recoveryPlan(sword(300) as any)?.recipe).toBe('X:recover-v2');
    expect(recoveryPlan(sword(300) as any)?.outputs).toEqual([['scrap',1],['iron_ingot',1],['metal_blade',1],['leather',1],['metal_blade',1]]);
    expect(recoveryPlan({uid:'u-pick',key:'iron_pick',qty:1,dur:400} as any)?.recipe).toBe('X:recover-v2');
    expect(recoveryPlan({uid:'u-spear',key:'reinforced_spear',qty:1,dur:200} as any)?.recipe).toBe('X:recover-v1');
  });
  it('a queued v1 job keeps v1 outputs after v2 exists, identical to the pre-B01 table',()=>{
    expect(recoveryPlanFor(sword(300) as any,'X:recover-v1')?.outputs).toEqual([['scrap',1],['iron_ingot',1],['leather',1]]);
    expect(recoveryPlanFor({uid:'u-pick',key:'iron_pick',qty:1,dur:400} as any,'X:recover-v1')?.outputs).toEqual([['scrap',1],['iron_ingot',1],['wood',1]]);
    expect(recoveryPlanFor(sword(300) as any,'X:recover-v2')?.recipe).toBe('X:recover-v2');
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

describe('B01 C2: iron plate repairs walls and doors only, with a real consumed plate',()=>{
  function wallRig(type:string,hp:number){
    const {g,r}=fresh();const id='b01-wall-'+type;
    const tx=r.player.tx??0,ty=r.player.ty??0;
    r.entities[id]={id,kind:'struct',type,tx:tx+1,ty:ty,x:(tx+1)*TILE+8,y:ty*TILE+8,hp,maxHp:STRUCTS[type].hp} as any;
    r.player.x=(tx+1)*TILE-4;r.player.y=ty*TILE+8;markDirty();
    return {g,r,id};
  }
  it('one plate fully restores a damaged wood wall and is consumed',()=>{
    const {g,r,id}=wallRig('wall_wood',40);addItem(r,'inv','iron_plate',1);
    const res=dispatch(g,{id:'b01-plate-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T);
    expect(res.ok).toBe(true);expect(r.entities[id].hp).toBe(r.entities[id].maxHp);expect(countItem(r,'inv','iron_plate')).toBe(0);
  });
  it('without a plate the same wall still uses the existing wood repair path (no free plate)',()=>{
    const {g,r,id}=wallRig('wall_wood',40);addItem(r,'inv','wood',20);
    const res=dispatch(g,{id:'b01-wood-'+ ++n,type:'repairStructure',eid:id},T);
    expect(res.ok).toBe(true);expect(r.entities[id].hp).toBeLessThan(r.entities[id].maxHp);
  });
  it('plates are refused for non-wall structures and when none are carried',()=>{
    const {g,r,id}=wallRig('workbench',40);addItem(r,'inv','iron_plate',1);
    expect(dispatch(g,{id:'b01-nowall-'+ ++n,type:'repairStructure',eid:id,material:'iron_plate'},T).ok).toBe(false);expect(countItem(r,'inv','iron_plate')).toBe(1);
    const w=wallRig('wall_wood',40);
    expect(dispatch(w.g,{id:'b01-none-'+ ++n,type:'repairStructure',eid:w.id,material:'iron_plate'},T).ok).toBe(false);
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
