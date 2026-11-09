import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, SOURCES, WORKBENCH_UPGRADE, WORKBENCH_UPGRADE_III, validateGameplayCatalog } from '../src/game/catalog';
import { TILE, type Entity, type GameState } from '../src/game/core';
import { addItem, C, countItem, destroyStructure, dispatch, markDirty, mkContainer, newGame, stepStations } from '../src/game/engine';
import { getWorld, SRC_KEYS } from '../src/game/world';
import { settle } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';

const T0 = Date.UTC(2026, 10, 1); let seq = 0;
const act = (gs: GameState, type: string, p: object = {}, id = `p${++seq}`, now = T0 + 10) => dispatch(gs, {id,type,...p}, Math.max(now,gs.run?.clock.lastSimAt??now));
function fresh() { const gs=newGame(); expect(act(gs,'startRun',{character:'female',region:0,seed:10}).ok).toBe(true); return gs; }
function station(gs:GameState,type:'workbench'|'research'|'campfire') {
  const r=gs.run!, p=r.player, fuel=mkContainer(r,'fuel',3), out=mkContainer(r,'out',6);
  const e:Entity={id:`station${++seq}`,kind:'struct',type,x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:100,station:{fuelC:fuel.id,outC:out.id,burn:0,queue:[]}};r.entities[e.id]=e;markDirty();return e;
}
function give(gs:GameState,key:string,qty=1){ expect(addItem(gs.run!,'inv',key,qty)).toBe(0); }
function slot(gs:GameState,key:string) { return C(gs.run!,'inv').slots.findIndex(s=>s?.key===key); }
function stacks(gs:GameState){const r=gs.run!;return [...Object.values(r.custody).flatMap(c=>c.slots.filter(Boolean)),...Object.values(r.entities).flatMap(e=>(e.station?.queue||[]).flatMap(j=>j.reserved||[]))];}

describe('physical progression',()=>{
  it('definitions, source placement and bounded supply connect the proposed chain',()=>{
    expect(validateGameplayCatalog()).toBe(true);
    expect(RECIPES.scrap_ingot.out).toBe('iron_ingot');
    expect(RECIPES.mechanical_parts.ins).toContainEqual(['iron_ingot',1]);
    expect(WORKBENCH_UPGRADE.cost).toContainEqual(['mechanical_parts',2]);
    expect(ITEMS.iron_sword.repair!.cost).toContainEqual(['mechanical_parts',1]);
    expect(RECIPES.reinforced_spear.stationLevel).toBe(2);
    expect(SOURCES.scrap.yields).toContainEqual(['scrap',1]);
    const w=getWorld('shipping'); expect([...w.src].some(i=>i>=0&&SRC_KEYS[i]==='scrap')).toBe(true);
    expect(w.statics.some(e=>e.poi==='factory'&&e.loot?.some(([k])=>k==='iron_sword'))).toBe(true);
    expect(ITEMS.iron_sword.salvage!.yields).toEqual([['iron_ingot',1]]);
  });
  it('repair keeps the physical UID, consumes exactly its typed cost and rejects replay/full repair',()=>{
    const gs=fresh(),r=gs.run!,bench=station(gs,'workbench'); give(gs,'iron_sword');give(gs,'iron_ingot');give(gs,'mechanical_parts');
    const i=slot(gs,'iron_sword'), item=C(r,'inv').slots[i]!, uid=item.uid;item.dur=1;
    const cmd={eid:bench.id,slot:i,uid,mode:'repair'};
    expect(act(gs,'maintainItem',cmd,'repair-once').ok).toBe(true);
    expect(item.dur).toBe(ITEMS.iron_sword.dur);expect(item.uid).toBe(uid);expect(countItem(r,'inv','iron_ingot')).toBe(0);expect(countItem(r,'inv','mechanical_parts')).toBe(0);
    expect(act(gs,'maintainItem',cmd,'repair-once')).toMatchObject({ok:false,dup:true});
    expect(act(gs,'maintainItem',cmd).ok).toBe(false);expect(validate(gs)).toBeTruthy();
    const restored=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload);expect(validate(restored)).toBeTruthy();expect(C(restored.run!,'inv').slots[i]!.uid).toBe(uid);
  });
  it('rejects repair when target, distance, owner, type, action or costs are invalid without mutation',()=>{
    const gs=fresh(),r=gs.run!,bench=station(gs,'workbench');give(gs,'iron_sword');const i=slot(gs,'iron_sword'),item=C(r,'inv').slots[i]!;item.dur=15;
    for(const cmd of [{eid:bench.id,slot:i,uid:item.uid,mode:'repair'},{eid:bench.id,slot:i,uid:'wrong',mode:'repair'},{eid:bench.id,slot:99,uid:item.uid,mode:'repair'}]) {const before=JSON.stringify(gs);expect(act(gs,'maintainItem',cmd).ok).toBe(false);expect(JSON.stringify(gs)).toBe(before);}
    give(gs,'iron_ingot');give(gs,'mechanical_parts');const cmd={eid:bench.id,slot:i,uid:item.uid,mode:'repair'};
    bench.owner='other';expect(act(gs,'maintainItem',cmd).ok).toBe(false);bench.owner=undefined;
    bench.x+=100;expect(act(gs,'maintainItem',cmd).ok).toBe(false);bench.x-=100;
    bench.type='campfire';expect(act(gs,'maintainItem',cmd).ok).toBe(false);bench.type='workbench';
    r.player.action={kind:'swing',t:1,dur:300,angle:0,slot:i};expect(act(gs,'maintainItem',cmd).ok).toBe(false);r.player.action=null;
    expect(item.dur).toBe(15);expect(countItem(r,'inv','mechanical_parts')).toBe(1);
  });
  it('destructive study reserves real equipment identity, cancels or finishes exactly once including full output',()=>{
    const gs=fresh(),r=gs.run!,bench=station(gs,'research');give(gs,'iron_sword'); const i=slot(gs,'iron_sword'), s=C(r,'inv').slots[i]!;s.dur=100;const original={...s};
    expect(act(gs,'research',{eid:bench.id,mode:'specimen',slot:i}).ok).toBe(false);
    expect(act(gs,'research',{eid:bench.id,mode:'specimen',slot:i,uid:'stale'}).ok).toBe(false);
    expect(act(gs,'research',{eid:bench.id,mode:'specimen',slot:i,uid:s.uid}).ok).toBe(true);const job=bench.station!.queue[0];expect(job.reserved![0]).toEqual(original);
    const out=C(r,bench.station!.outC);for(let x=0;x<6;x++)addItem(r,out.id,'stone_axe',1);
    stepStations(gs,30000,T0+30000);expect(bench.station!.queue).toHaveLength(1);expect(stacks(gs).filter(x=>x?.uid===s.uid)).toHaveLength(1);
    expect(act(gs,'cancelJob',{eid:bench.id,jobId:job.id},'cancel-study').ok).toBe(true);expect(stacks(gs).filter(x=>x?.uid===s.uid)).toEqual([original]);
    expect(act(gs,'cancelJob',{eid:bench.id,jobId:job.id},'cancel-study')).toMatchObject({ok:false,dup:true});
    const j=slot(gs,'iron_sword');expect(act(gs,'research',{eid:bench.id,mode:'specimen',slot:j,uid:s.uid}).ok).toBe(true);out.slots[0]=null;stepStations(gs,30000,T0+60000);
    expect(stacks(gs).some(x=>x?.uid===s.uid)).toBe(false);expect(out.slots.filter(x=>x?.key==='blueprint'&&x.meta==='iron_sword')).toHaveLength(1);expect(validate(gs)).toBeTruthy();
  });
  it('station destruction and full pack preserve the reserved item in one physical bag',()=>{
    const gs=fresh(),r=gs.run!,e=station(gs,'research');give(gs,'iron_sword');const i=slot(gs,'iron_sword'),s=C(r,'inv').slots[i]!;
    expect(act(gs,'research',{eid:e.id,mode:'specimen',slot:i,uid:s.uid}).ok).toBe(true);
    while(C(r,'inv').slots.includes(null))give(gs,'stone_axe');
    const bag=destroyStructure(r,e,T0)!;expect(C(r,bag.c!).slots.filter(x=>x?.uid===s.uid)).toHaveLength(1);expect(validate(gs)).toBeTruthy();
  });
  it('salvage consumes a single exact UID for bounded output, even with a full inventory',()=>{
    const gs=fresh(),r=gs.run!,e=station(gs,'workbench');give(gs,'iron_sword');const i=slot(gs,'iron_sword'),s=C(r,'inv').slots[i]!;
    while(C(r,'inv').slots.includes(null))give(gs,'stone_axe');
    const cmd={eid:e.id,slot:i,uid:s.uid,mode:'salvage'};expect(act(gs,'maintainItem',cmd,'salvage').ok).toBe(true);
    expect(countItem(r,'inv','iron_ingot')).toBe(1);expect(stacks(gs).some(x=>x?.uid===s.uid)).toBe(false);expect(act(gs,'maintainItem',cmd,'salvage')).toMatchObject({ok:false,dup:true});expect(countItem(r,'inv','iron_ingot')).toBe(1);expect(validate(gs)).toBeTruthy();
  });
  it('requires a paid upgrade for the new recipe; old stations and queued jobs remain valid after restart',()=>{
    const gs=fresh(),r=gs.run!,e=station(gs,'workbench');give(gs,'iron_ingot',4);give(gs,'scrap',2);give(gs,'wood',2);r.knowledge.recipes.push('reinforced_spear');
    expect(act(gs,'craft',{eid:e.id,recipe:'mechanical_parts'}).ok).toBe(true);stepStations(gs,12000,T0+12000);
    const out=C(r,e.station!.outC);const oi=out.slots.findIndex(s=>s?.key==='mechanical_parts');expect(oi).toBeGreaterThanOrEqual(0);expect(act(gs,'move',{from:out.id,fs:oi,to:'inv'}).ok).toBe(true);
    expect(act(gs,'craft',{eid:e.id,recipe:'reinforced_spear'}).ok).toBe(false);
    expect(act(gs,'upgradeStation',{eid:e.id},'upgrade').ok).toBe(true);expect(e.station!.level).toBe(2);expect(countItem(r,'inv','mechanical_parts')).toBe(0);
    expect(act(gs,'upgradeStation',{eid:e.id},'upgrade')).toMatchObject({ok:false,dup:true});
    const restored=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as GameState;expect(validate(restored)).toBeTruthy();expect(restored.run!.entities[e.id].station!.level).toBe(2);
    // First craft produces parts, already paid; then paid advanced recipe and output.
    give(restored,'scrap',2);expect(act(restored,'craft',{eid:e.id,recipe:'mechanical_parts'}).ok).toBe(true);stepStations(restored,12000,T0+24000);
    const rr=restored.run!,o=C(rr,rr.entities[e.id].station!.outC),j=o.slots.findIndex(s=>s?.key==='mechanical_parts');expect(act(restored,'move',{from:o.id,fs:j,to:'inv'}).ok).toBe(true);
    give(restored,'iron_ingot',1);expect(act(restored,'craft',{eid:e.id,recipe:'reinforced_spear'}).ok).toBe(true);stepStations(restored,20000,T0+44000);
    expect(o.slots.some(s=>s?.key==='reinforced_spear')).toBe(true);expect(ITEMS.reinforced_spear.dmg).toBeGreaterThan(ITEMS.wood_spear.dmg!);
    delete rr.entities[e.id].station!.level;expect(validate(restored)).toBeTruthy(); // additive v3 legacy default = level 1
    rr.entities[e.id].station!.level=4 as any;expect(validate(restored)).toBeNull();
  });
  it('upgrades II to III once with paid materials and produces a real industrial energy batch without regating legacy recipes',()=>{
    const gs=fresh(),r=gs.run!,e=station(gs,'workbench');e.station!.level=2;
    for(const [k,q] of WORKBENCH_UPGRADE_III.cost)give(gs,k,q);
    const known=structuredClone(r.knowledge);give(gs,'crystal',2);give(gs,'iron_ingot',2);give(gs,'charcoal',2);
    expect(act(gs,'craft',{eid:e.id,recipe:'energy_refined_industrial'}).ok).toBe(false);
    expect(act(gs,'upgradeStation',{eid:e.id},'upgrade-three').ok).toBe(true);expect(e.station!.level).toBe(3);expect(r.knowledge).toEqual(known);
    expect(act(gs,'upgradeStation',{eid:e.id},'upgrade-three')).toMatchObject({ok:false,dup:true});expect(act(gs,'upgradeStation',{eid:e.id}).ok).toBe(false);
    expect(act(gs,'craft',{eid:e.id,recipe:'energy_refined_industrial'}).ok).toBe(true);expect(countItem(r,'inv','crystal')).toBe(0);expect(countItem(r,'inv','charcoal')).toBe(0);
    const restored=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as GameState;expect(validate(restored)).toBeTruthy();stepStations(restored,40000,T0+40010);
    const out=C(restored.run!,restored.run!.entities[e.id].station!.outC);expect(out.slots.find(s=>s?.key==='energy_refined')?.qty).toBe(12);expect(validate(restored)).toBeTruthy();
    expect(RECIPES.core_fire.tier).toBe(3);expect(RECIPES.core_fire.stationLevel).toBeUndefined();
  });
  it.each(['herb_roast','salted_meat'])('funded home job %s continues through persisted offline time, not free output',recipe=>{
    const gs=fresh(),r=gs.run!,e=station(gs,'campfire');give(gs,'meat');give(gs,recipe==='herb_roast'?'herb':'raw_salt');addItem(r,e.station!.fuelC,'wood',1);
    expect(act(gs,'craft',{eid:e.id,recipe}).ok).toBe(true);expect(countItem(r,'inv','meat')).toBe(0);
    const saved=JSON.parse(JSON.parse(serializeSnapshot(gs)).payload) as GameState;expect(validate(saved)).toBeTruthy();
    settle(saved,T0+30000);const se=saved.run!.entities[e.id],out=C(saved.run!,se.station!.outC);expect(out.slots.filter(s=>s?.key===recipe)).toHaveLength(1);
    const i=out.slots.findIndex(s=>s?.key===recipe);expect(act(saved,'move',{from:out.id,fs:i,to:'inv'}).ok).toBe(true);const n=slot(saved,recipe);saved.run!.player.hp=50;expect(act(saved,'useItem',{slot:n}).ok).toBe(true);expect(saved.run!.player.hp).toBe(recipe==='herb_roast'?65:58);expect(validate(saved)).toBeTruthy();
  });
});
