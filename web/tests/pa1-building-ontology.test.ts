import {afterAll,describe,it,expect} from 'vitest';
import {TILE,T,WW,type GameState} from '../src/game/core';
import {DEPLOYABLE_TYPES,PA1_BASE_GEOMETRY,PA1_UPGRADE_ONLY_GEOMETRY,
  ITEMS,RECIPES,STRUCTS,BUILD_ORDER,STRUCTURE_UPGRADES} from '../src/game/catalog';
import {newGame,dispatch,addItem,countItem,C,buildReason,markDirty} from '../src/game/engine';
import {getWorld,getActiveLayout,setActiveLayout} from '../src/game/world';
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
    expect(PA1_BASE_GEOMETRY).toHaveLength(4);
    for(const type of PA1_UPGRADE_ONLY_GEOMETRY)expect(BUILD_ORDER).not.toContain(type);
    expect(BUILD_ORDER).not.toContain('door_powered');
    expect(STRUCTURE_UPGRADES.wall_stone).toBeUndefined(); // brick must never impersonate steel
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
