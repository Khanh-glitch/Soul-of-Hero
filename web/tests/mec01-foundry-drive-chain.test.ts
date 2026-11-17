// Historical filename retained for regression continuity. Drive recipes are retired.
// Shipping contract cache -> useful Salvager Pick; Veyra natural wreck provenance and
// two real 15 s Recycler jobs -> paid bench/Floor -1 are covered by wp3-veyra-recycler-integration.
// These probes use fixture positions, ambient suppression and labelled supplementary raw stock.
import {afterEach, describe,it,expect} from 'vitest';
import {type GameState} from '../src/game/core';
import {WORKBENCH_UPGRADE} from '../src/game/catalog';
import {addItem,C,countItem,newGame,lootSiteAccess} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {specForSite,validLootSourceContract} from '../src/game/loot-source-spec';
import {beside,buildCarried,command,craftCollect,reload} from './support/current-industry';
const START=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(command(g,'startRun',{character:'female',seed:101},START)).toMatchObject({ok:true});g.run!.creatures=[];return g;}
function cache(g:GameState){
  const r=g.run!,site=getWorld(r.layoutId).statics.find(s=>specForSite(s)?.id==='factory-exterior-industrial')!;
  expect(site).toBeTruthy();expect(lootSiteAccess(r,site)).toBe('open');
  return Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===site.tx&&e.ty===site.ty)!;
}
function bench(g:GameState){
  for(const [k,q] of [['wood',14],['stone',4]] as const)expect(addItem(g.run!,'inv',k,q)).toBe(0);
  return buildCarried(g,'workbench',START+10);
}
function upgrade(g:GameState,e:ReturnType<typeof bench>){
  for(const [k,q] of WORKBENCH_UPGRADE.cost)expect(addItem(g.run!,'inv',k,q)).toBe(0);
  expect(command(g,'upgradeStation',{eid:e.id},START+12)).toMatchObject({ok:true});
}
describe('Foundry current gear -> useful L2 Salvager Pick, not retired Motor Drive',()=>{
  it('the versioned authored cache is open and supplies live gear/Parts without retired item assumptions',()=>{
    const g=start(),r=g.run!,e=cache(g);
    expect(validLootSourceContract(r.lootEcology!.sourceContract)).toBe(true);
    expect(C(r,e.c!).slots.some(s=>s?.key==='mechanical_gear')).toBe(true);
    expect(C(r,e.c!).slots.some(s=>s?.key==='spares')).toBe(true);
    expect(C(r,e.c!).slots.some(s=>s?.key==='machete')).toBe(true);
    expect(C(r,e.c!).slots.some(s=>s&&['damaged_drive','iron_sword','mechanical_parts','fasteners'].includes(s.key))).toBe(false);
  });
  it('takes an actual cache gear, pays the bench/upgrade/tool recipe, reloads reservations and collects the useful tool',()=>{
    const g=start(),r=g.run!,c=cache(g);beside(g,c.tx!+1,c.ty!);
    for(const k of ['mechanical_gear','spares'])for(let fs=0;fs<C(r,c.c!).slots.length;fs++)if(C(r,c.c!).slots[fs]?.key===k)
      expect(command(g,'move',{from:c.c,fs,to:'inv'},START+5)).toMatchObject({ok:true});
    const gear=C(r,'inv').slots.find(s=>s?.key==='mechanical_gear')!;
    expect(gear.qty).toBe(1);
    // Iron pick/raw bench bill are controlled supplements, not claimed natural inputs.
    expect(addItem(r,'inv','iron_pick',1)).toBe(0);
    const b=bench(g);upgrade(g,b);
    const before=reload(g);expect(C(before.run!,'inv').slots.some(s=>s?.uid===gear.uid)).toBe(true);
    const uid=craftCollect(g,b,'industrial_pick_geared',START+100);
    expect(countItem(r,'inv','mechanical_gear')).toBe(0);expect(countItem(r,'inv','iron_pick')).toBe(0);
    const back=reload(g).run!;
    expect(C(back,'inv').slots.find(s=>s?.uid===uid)).toMatchObject({key:'industrial_pick',qty:1});
    expect(back.entities[b.id].station!.queue).toHaveLength(0);
    expect(Object.values(back.custody).flatMap(c=>c.slots).some(s=>s?.uid===gear.uid)).toBe(false);
  });
  it('missing gear refuses atomically without consuming the pick or Parts',()=>{
    const g=start(),r=g.run!,b=bench(g);upgrade(g,b);
    addItem(r,'inv','iron_pick',1);addItem(r,'inv','spares',2);
    const before=JSON.stringify(C(r,'inv'));
    expect(command(g,'craft',{eid:b.id,recipe:'industrial_pick_geared'},START+100)).toMatchObject({ok:false,reason:expect.stringMatching(/Mechanical Gear 0\/1/)});
    expect(JSON.stringify(C(r,'inv'))).toBe(before);expect(b.station!.queue).toHaveLength(0);
  });
  it('a fully funded recipe cannot bypass L2 and keeps all physical inputs',()=>{
    const g=start(),r=g.run!,b=bench(g);
    for(const [k,q] of [['iron_pick',1],['mechanical_gear',1],['spares',2]] as const)addItem(r,'inv',k,q);
    const before=JSON.stringify(C(r,'inv'));
    expect(command(g,'craft',{eid:b.id,recipe:'industrial_pick_geared'},START+100)).toMatchObject({ok:false,reason:expect.stringMatching(/level 2/)});
    expect(JSON.stringify(C(r,'inv'))).toBe(before);expect(b.station!.queue).toHaveLength(0);
  });
});
