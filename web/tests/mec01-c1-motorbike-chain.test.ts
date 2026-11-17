// Current factory source -> furnace -> plates/gear/pipe/frame -> paid L3/research -> dry kit.
// Source takes are real authorized custody transfers, NOT a natural journey: positions,
// supplementary raw stock, disabled ambient creatures and station time are controlled fixtures.
import {afterEach, describe, expect, it} from 'vitest';
import {type GameState} from '../src/game/core';
import {RECIPES, WORKBENCH_UPGRADE_III} from '../src/game/catalog';
import {addItem, C, countItem, dispatch, newGame, stepStations} from '../src/game/engine';
import {getWorld, setActiveLayout} from '../src/game/world';
import {specForSite} from '../src/game/loot-source-spec';
import {beside, buildCarried, command, craftCollect, reload} from './support/current-industry';
const START=Date.UTC(2026,10,17), SEED=4242;
let n=0;
afterEach(()=>setActiveLayout('shipping'));
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(command(g,'startRun',{character:'female',seed:SEED},START)).toMatchObject({ok:true});g.run!.creatures=[];return g;}

describe('C1 current factory materials -> paid dry motorbike kit',()=>{
  it('pays the current chain using actual factory stock plus explicitly controlled raw supplements; pending jobs and kit UID reload',()=>{
    const g=start(),r=g.run!;
    // Identify the AUTHORED source by its versioned source contract, not a retired item in runtime custody.
    const site=getWorld(r.layoutId).statics.find(s=>specForSite(s)?.id==='factory-exterior-industrial')!;
    expect(site).toBeTruthy();
    const cache=Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===site.tx&&e.ty===site.ty)!;
    expect(cache).toBeTruthy();beside(g,cache.tx!+1,cache.ty!);
    const sourceBefore=structuredClone(C(r,cache.c!));
    for(const key of ['spares','refined_iron_ingot','mechanical_gear']) {
      expect(sourceBefore.slots.some(s=>s?.key===key),`current factory output ${key}`).toBe(true);
      for(let slot=0;slot<C(r,cache.c!).slots.length;slot++)if(C(r,cache.c!).slots[slot]?.key===key)
        expect(command(g,'move',{from:cache.c,fs:slot,to:'inv'},START+5)).toMatchObject({ok:true});
    }
    expect(C(r,cache.c!).slots.some(s=>s?.key==='machete')).toBe(true);
    expect(C(r,'inv').slots.some(s=>s&&['mechanical_parts','fasteners','iron_sword','damaged_drive'].includes(s.key))).toBe(false);
    // Raw supplementary stock, not naturally acquired. Already-taken factory quantities reduce these grants.
    for(const [key,target] of [['iron_ingot',43],['charcoal',17],['spares',62],['wood',28],['stone',22]] as const) {
      const need=Math.max(0,target-countItem(r,'inv',key));expect(addItem(r,'inv',key,need)).toBe(0);
    }
    const furnace=buildCarried(g,'furnace',START+10);
    let now=START+100;
    beside(g,furnace.tx!-1,furnace.ty!);
    const fuel=C(r,'inv').slots.findIndex(s=>s?.key==='charcoal');
    expect(command(g,'move',{from:'inv',fs:fuel,to:furnace.station!.fuelC,qty:3},now)).toMatchObject({ok:true});
    // Refine current charcoal-paid stock until the current kit/plate/frame bills can all be paid.
    while(countItem(r,'inv','refined_iron_ingot')<14){craftCollect(g,furnace,'refined_iron_ingot',now+=30000);}
    const bench=buildCarried(g,'workbench',now+=30000);
    expect(command(g,'upgradeStation',{eid:bench.id},now+2)).toMatchObject({ok:true});
    while(countItem(r,'inv','mechanical_gear')<4)craftCollect(g,bench,'mechanical_gear',now+=30000);
    for(let i=0;i<3;i++)craftCollect(g,bench,'iron_plate',now+=30000);
    craftCollect(g,bench,'metal_pipe',now+=30000);
    craftCollect(g,bench,'vehicle_frame',now+=30000);
    for(const [key,qty] of WORKBENCH_UPGRADE_III.cost)expect(countItem(r,'inv',key),key).toBeGreaterThanOrEqual(qty);
    expect(command(g,'upgradeStation',{eid:bench.id},now+=30000)).toMatchObject({ok:true});
    expect(bench.station!.level).toBe(3);
    const research=buildCarried(g,'research',now+=100);
    expect(command(g,'research',{eid:research.id,mode:'directed',recipe:'motorbike_kit'},now+=100)).toMatchObject({ok:true});
    stepStations(g,45000,now+=45000);
    const out=research.station!.outC,bp=C(r,out).slots.findIndex(s=>s?.meta==='motorbike_kit');
    expect(bp).toBeGreaterThanOrEqual(0);
    expect(command(g,'move',{from:out,fs:bp,to:'inv'},now+1)).toMatchObject({ok:true});
    const slot=C(r,'inv').slots.findIndex(s=>s?.meta==='motorbike_kit');
    expect(command(g,'useItem',{slot},now+2)).toMatchObject({ok:true});
    const kitUid=craftCollect(g,bench,'motorbike_kit',now+=100);
    const back=reload(g).run!;
    expect(C(back,'inv').slots.find(s=>s?.uid===kitUid)).toMatchObject({key:'motorbike_kit',qty:1});
    expect(back.entities[bench.id].station!.level).toBe(3);
    expect(back.knowledge.recipes).toContain('motorbike_kit');
    expect(countItem(back,'inv','vehicle_frame')).toBe(0);
    expect(countItem(back,'inv','mechanical_gear')).toBe(0);
    expect(countItem(back,'inv','fuel_can')).toBe(0); // packed DRY, no invented drive/fuel
    expect(RECIPES.motorbike_kit.ins.map(([k])=>k)).not.toContain('vehicle_drive');
  });
  it('ordinary survival verbs (eat, drink) work without motorbike, Elder or Core ever entering the pack', () => {
    const g = start(); const r = g.run!;
    expect(r.custody.inv.slots.some(s => s?.key === 'motorbike_kit')).toBe(false);
    const berry = r.custody.inv.slots.findIndex(s => s?.key === 'berries');
    const before = r.player.hunger;
    expect(dispatch(g, { id: 'c1-eat', type: 'useItem', slot: berry }, START + 1).ok).toBe(true);
    expect(r.player.hunger).toBeGreaterThan(before);
    const flask = r.custody.inv.slots.findIndex(s => s?.key === 'water_flask');
    const beforeT = r.player.thirst;
    expect(dispatch(g, { id: 'c1-drink', type: 'useItem', slot: flask }, START + 2).ok).toBe(true);
    expect(r.player.thirst).toBeGreaterThan(beforeT);
    // No Elder kill, Creator Core study or motorbike is on the critical path of eating or drinking:
    expect(r.custody.inv.slots.some(s => s?.key.startsWith('core_'))).toBe(false);
    expect(r.player.vehicle).toBeUndefined();
  });
});
