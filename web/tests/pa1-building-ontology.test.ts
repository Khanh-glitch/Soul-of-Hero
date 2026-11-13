import {afterAll,describe,it,expect} from 'vitest';
import {TILE,T,WW,type GameState} from '../src/game/core';
import {DEPLOYABLE_TYPES,PA1_BASE_GEOMETRY,PA1_BUILD_PAGES,PA1_UPGRADE_ONLY_GEOMETRY,
  ITEMS,RECIPES,STRUCTS,BUILD_ORDER,STRUCTURE_UPGRADES} from '../src/game/catalog';
import {newGame,dispatch,addItem,countItem,C,buildReason,markDirty,blockedAt,clearWallLine,roofAt} from '../src/game/engine';
import {getWorld,getActiveLayout,setActiveLayout} from '../src/game/world';
import {structurePreparation} from '../src/game/action-readiness';
import {serializeSnapshot,selectSnapshots,validate} from '../src/game/persist';

const T0=Date.UTC(2026,10,13,9);let serial=0;
const act=(g:GameState,type:string,p:object={})=>dispatch(g,{id:'pa1-'+ ++serial,type,...p},Math.max(T0,g.run?.clock.lastSimAt??T0));
function setup(){
  setActiveLayout('shipping');
  const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:98}).ok).toBe(true);
  const r=g.run!,w=getWorld(),avoid=w.accessCorridors?.mask;
  r.creatures=[];
  let xx=0,yy=0;
  outer:for(let y=8;y<185;y++)for(let x=8;x<185;x++){
    let ok=true;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
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
  const build=(type:string,dx=0,dy=0)=>act(g,'build',{struct:type,tx:xx+dx,ty:yy+dy});
  return {g,r,x:xx,y:yy,build};
}
afterAll(()=>setActiveLayout('shipping'));

describe('PA1 building geometry vs physical device custody',()=>{
  it('uses an exact declared device list; no stone/iron/brick/steel piece is directly buildable',()=>{
    expect(DEPLOYABLE_TYPES).toHaveLength(24);
    for(const k of DEPLOYABLE_TYPES) {
      const d=STRUCTS[k],id='deploy_'+k;
      expect(d.item).toBe(id);
      expect(ITEMS[id]?.max).toBe(1);
      expect(ITEMS[id]?.dur).toBe(d.hp);
      expect(RECIPES[id].ins).toEqual(d.cost);
      expect(RECIPES[id].base).toBe(true);
    }
    expect(PA1_BASE_GEOMETRY).toHaveLength(15);
    expect(PA1_BUILD_PAGES.Foundation).toHaveLength(4);
    expect(PA1_BUILD_PAGES.Wall).toHaveLength(8);
    expect(PA1_BUILD_PAGES.Roof).toHaveLength(3);
    expect(new Set(PA1_BASE_GEOMETRY).size).toBe(15);
    for(const key of PA1_BASE_GEOMETRY){
      expect(STRUCTS[key]).toBeDefined();
      expect(STRUCTS[key].item).toBeUndefined();
      expect(RECIPES[key]).toBeUndefined();
      expect(BUILD_ORDER).toContain(key);
    }
    for(const type of PA1_UPGRADE_ONLY_GEOMETRY)expect(BUILD_ORDER).not.toContain(type);
    expect(BUILD_ORDER).not.toContain('door_powered');
    expect(STRUCTURE_UPGRADES.wall_stone).toBeUndefined(); // brick must never impersonate steel
  });

  it('builds and removes every wooden shape through real intents, with physical collisions, sight and roof cover',()=>{
    const o=setup();
    expect(addItem(o.r,'inv','wood',240)).toBe(0);
    expect(addItem(o.r,'inv','fiber',120)).toBe(0);
    expect(addItem(o.r,'inv','rope',8)).toBe(0);
    const px=o.r.player.x,py=o.r.player.y;
    for(const key of PA1_BUILD_PAGES.Wall){
      expect(buildReason(o.g,key,o.x,o.y),key).toBeNull();
      const result=o.build(key);
      expect(result.ok,key+':'+JSON.stringify(result)).toBe(true);
      const e=Object.values(o.r.entities).find(v=>v.kind==='struct'&&v.type===key&&v.tx===o.x&&v.ty===o.y);
      expect(e,key+' entity').toBeTruthy();
      expect(blockedAt(o.r,o.x,o.y),key+' collision').toBe(STRUCTS[key].block);
      o.r.player.x=(o.x-2)*TILE+8;o.r.player.y=o.y*TILE+8;markDirty();
      const visible=clearWallLine(o.r,o.r.player,{x:(o.x+2)*TILE+8,y:o.y*TILE+8});
      const expectedTransparent=STRUCTS[key].visionTransparent===true||STRUCTS[key].sealsRoom===false;
      expect(visible,key+' LOS').toBe(expectedTransparent);
      o.r.player.x=px;o.r.player.y=py;markDirty();
      expect(act(o.g,'reclaim',{eid:e!.id}).ok,key+' reclaim').toBe(true);
      expect(o.r.entities[e!.id]).toBeUndefined();
    }
    expect(o.build('floor_wood').ok).toBe(true);
    const fl=Object.values(o.r.entities).find(v=>v.type==='floor_wood'&&v.tx===o.x&&v.ty===o.y)!;
    for(const roof of [...PA1_BUILD_PAGES.Roof,'ceiling_wood','ceiling_triangle_wood']){
      expect(o.build(roof).ok,roof+' place').toBe(true);
      expect(roofAt(o.r,o.x,o.y)).toBe(true);
      const e=Object.values(o.r.entities).find(v=>v.type===roof&&v.tx===o.x&&v.ty===o.y)!;
      expect(act(o.g,'reclaim',{eid:e.id}).ok,roof+' reclaim').toBe(true);
    }
    expect(act(o.g,'reclaim',{eid:fl.id}).ok).toBe(true);
    for(const floor of ['floor_wood','floor_triangle_wood']){
      expect(o.build(floor).ok,floor).toBe(true);
      const e=Object.values(o.r.entities).find(v=>v.type===floor&&v.tx===o.x&&v.ty===o.y)!;
      expect(blockedAt(o.r,o.x,o.y)).toBe(false);
      expect(act(o.g,'reclaim',{eid:e.id}).ok).toBe(true);
    }
    expect(validate(selectSnapshots([serializeSnapshot(o.g),null]).gs!)).not.toBeNull();
  },120000);

  it('installs a paid door into an existing open frame with durable provenance',()=>{
    const o=setup();
    expect(addItem(o.r,'inv','wood',45)).toBe(0);
    expect(addItem(o.r,'inv','rope',4)).toBe(0);
    expect(o.build('wall_doorframe_wood').ok).toBe(true);
    const e=Object.values(o.r.entities).find(v=>v.kind==='struct'&&v.type==='wall_doorframe_wood')!;
    const eid=e.id,before=countItem(o.r,'inv','wood');
    expect(blockedAt(o.r,o.x,o.y)).toBe(false);
    const installed=o.build('door_wood');
    expect(installed.ok,JSON.stringify(installed)).toBe(true);
    expect(e.id).toBe(eid);expect(e.type).toBe('door_wood');
    expect(e.framePaid).toBe(true);
    expect(countItem(o.r,'inv','wood')).toBe(before-6);
    expect(blockedAt(o.r,o.x,o.y)).toBe(true);
    const saved=selectSnapshots([serializeSnapshot(o.g),null]).gs!;
    expect(saved.run!.entities[eid].framePaid).toBe(true);
    expect(validate(saved)).not.toBeNull();
    expect(act(o.g,'door',{eid}).ok).toBe(true);
    expect(blockedAt(o.r,o.x,o.y)).toBe(false);
    expect(act(o.g,'reclaim',{eid}).ok).toBe(true);
    expect(o.r.entities[eid]).toBeUndefined();
    expect(validate(o.g)).not.toBeNull();
  });
  it('crafts a chest from original paid wood, places exact packed UID, saves, reclaims, and does not heal',()=>{
    const o=setup();
    expect(addItem(o.r,'inv','wood',24)).toBe(0);
    expect(o.build('chest_small').ok).toBe(false);
    const before=countItem(o.r,'inv','wood');
    expect(act(o.g,'craft',{recipe:'deploy_chest_small'}).ok).toBe(true);
    expect(countItem(o.r,'inv','wood')).toBe(before-8);
    const pack=C(o.r,'inv').slots.find(s=>s?.key==='deploy_chest_small')!;
    const uid=pack.uid;
    expect(pack.dur).toBe(STRUCTS.chest_small.hp);
    const paidWood=countItem(o.r,'inv','wood');
    expect(o.build('chest_small').ok).toBe(true);
    const e=Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type==='chest_small')!;
    expect(e.deployed?.uid).toBe(uid);
    expect(countItem(o.r,'inv','wood')).toBe(paidWood);
    expect(C(o.r,'inv').slots.filter(s=>s?.uid===uid)).toHaveLength(0);
    const restored=selectSnapshots([serializeSnapshot(o.g),null]).gs!;
    expect(restored.run!.entities[e.id].deployed?.uid).toBe(uid);
    expect(validate(restored)).not.toBeNull();
    e.hp=23;
    expect(act(o.g,'reclaim',{eid:e.id}).ok).toBe(true);
    const returned=C(o.r,'inv').slots.find(s=>s?.uid===uid)!;
    expect(returned).toBeTruthy();
    expect(returned.key).toBe('deploy_chest_small');
    expect(returned.dur).toBe(23);
    expect(o.build('chest_small').ok).toBe(true);
    const e2=Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type==='chest_small')!;
    expect(e2.deployed?.uid).toBe(uid);
    expect(e2.hp).toBe(23);
    expect(validate(o.g)).not.toBeNull();
  });

  it('rejects direct higher-tier building and requires an owned cabinet before an in-place floor upgrade',()=>{
    const o=setup();
    addItem(o.r,'inv','wood',40);addItem(o.r,'inv','stone',30);
    const before=countItem(o.r,'inv','stone');
    for(const high of ['floor_stone','wall_stone','wall_brick','door_iron','roof_tile'])
      expect(o.build(high).ok).toBe(false);
    expect(countItem(o.r,'inv','stone')).toBe(before);
    expect(o.build('floor_wood').ok).toBe(true);
    const floor=Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type==='floor_wood')!;
    expect(act(o.g,'upgradeStructure',{eid:floor.id}).ok).toBe(false);
    expect(act(o.g,'craft',{recipe:'deploy_claim'}).ok).toBe(true);
    expect(o.build('claim').ok).toBe(true);
    expect(act(o.g,'upgradeStructure',{eid:floor.id}).ok).toBe(true);
    expect(floor.type).toBe('floor_stone');
    expect(countItem(o.r,'inv','stone')).toBe(before-5-6);
    expect(validate(o.g)).not.toBeNull();
  });
});

describe('PA1 Deploy readiness projection matches what placement actually spends',()=>{
  // The UI must never promise a placement the engine will refuse: for a device, the placement
  // spends the CRAFTED PACK (no second material payment), so the pack — not the ore list — is
  // the readiness authority. This is the same function SurvivorScreen renders.
  it('refuses to call raw materials "prepared" and names the pack instead',()=>{
    const o=setup();
    addItem(o.r,'inv','wood',14);addItem(o.r,'inv','stone',4);
    const prep=structurePreparation(o.r,'workbench');
    expect(prep.pack?.key).toBe('deploy_workbench');
    expect(prep.materials).toBe(false);
    expect(prep.next).toMatch(/Craft the packed Workbench first/);
    expect(o.build('workbench').ok).toBe(false);              // the engine agrees with the UI
    expect(countItem(o.r,'inv','wood')).toBe(14);             // a refused placement spends nothing
  });
  it('goes green on the crafted pack and spends only the pack when placing',()=>{
    const o=setup();
    addItem(o.r,'inv','wood',14);addItem(o.r,'inv','stone',4);
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
    expect(countItem(o.r,'inv','wood')).toBe(0);expect(countItem(o.r,'inv','stone')).toBe(0);
    let prep=structurePreparation(o.r,'workbench');
    expect(prep.materials).toBe(true);
    expect(prep.next).toMatch(/spends the packed device, not its materials/);
    expect(o.build('workbench').ok).toBe(true);
    expect(countItem(o.r,'inv','deploy_workbench')).toBe(0);   // the pack left the pack slot…
    const bench=Object.values(o.r.entities).find(e=>e.kind==='struct'&&e.type==='workbench')!;
    expect(bench.hp).toBe(STRUCTS.workbench.hp);               // …and the device arrived at full HP
    expect(structurePreparation(o.r,'workbench').materials).toBe(false);   // one pack, one placement
    expect(o.build('workbench',1,0).ok).toBe(false);
  });
  it('a spent-down pack blocks the CTA and asks for a repair, not for more ore',()=>{
    const o=setup();
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(false);   // no materials yet
    addItem(o.r,'inv','wood',14);addItem(o.r,'inv','stone',4);
    expect(act(o.g,'craft',{recipe:'deploy_workbench'}).ok).toBe(true);
    const slot=C(o.r,'inv').slots.findIndex(s=>s?.key==='deploy_workbench');
    o.r.custody.inv.slots[slot]!.dur=0;                         // FIXTURE: burn the pack's condition off
    const prep=structurePreparation(o.r,'workbench');
    expect(prep.materials).toBe(false);
    expect(prep.next).toMatch(/damaged — repair it before placing/);
    expect(o.build('workbench').ok).toBe(false);
  });
  it('keeps plain geometry on the material rule, because a shape is not an item',()=>{
    const o=setup();
    addItem(o.r,'inv','wood',4);
    const prep=structurePreparation(o.r,'floor_wood');
    expect(prep.pack).toBeUndefined();
    expect(prep.materials).toBe(true);
    expect(prep.next).toBe('Materials ready · choose a legal site');
    expect(o.build('floor_wood').ok).toBe(true);
    expect(countItem(o.r,'inv','wood')).toBe(0);                // geometry pays materials, once
  });
});
