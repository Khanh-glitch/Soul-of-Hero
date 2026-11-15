import legacyShipping from './fixtures/7b9805b2-shipping-v3.json';
import { liveItemId, liveItemPer, liveRecipeId, isRetiredLive } from '../src/game/final-item-set';
import { ITEMS } from '../src/game/catalog';
import {afterEach,describe,expect,it} from 'vitest';
import {HOUR,TILE,WW,type GameState,type Entity} from '../src/game/core';
import {C,dispatch,newGame,lootCooldown,renewableStock,stepLootRespawn,countItem,harvestHit,sourceAt,mkContainer,stepStations} from '../src/game/engine';
import {LOOT_CLASSES,lootClass,lootRoll,lootSiteIndex,lootSlots,type LootClass} from '../src/game/loot-ecology';
import {getWorld,setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,4);let seq=0;
const act=(g:GameState,type:string,p:object={},now=T+1)=>dispatch(g,{id:`w06-${++seq}`,type,...p},now);
function start(layout='shipping_fresh',seed=99){setActiveLayout(layout);const g=newGame();expect(act(g,'startRun',{character:'female',seed},T).ok).toBe(true);return g;}
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
function target(g:GameState,kind:LootClass){const r=g.run!,site=getWorld(r.layoutId).statics.find(s=>lootClass(s)===kind)!;expect(site).toBeTruthy();const e=Object.values(r.entities).find(e=>e.kind==='loot'&&e.tx===site.tx&&e.ty===site.ty)!;return {site,e,c:C(r,e.c!)};}
function nearby(g:GameState,e:Entity){g.run!.player.x=e.x;g.run!.player.y=e.y+TILE;} // controlled fixture, not natural route evidence
afterEach(()=>setActiveLayout('shipping'));
describe('W06 pinned authored cache ecology',()=>{
 it('classifies only authored sites, preserves authored/unique stock, and bounds all generated slots in both fresh layouts',()=>{
  for(const layout of ['shipping_fresh','dev_delta_fresh']){const g=start(layout),r=g.run!,world=getWorld(layout);expect(r.lootEcology?.version).toBe('w06-v1');
   for(const s of world.statics.filter(s=>lootClass(s))){const e=Object.values(r.entities).find(x=>x.kind==='loot'&&x.tx===s.tx&&x.ty===s.ty)!;const items=C(r,e.c!).slots.filter(Boolean);expect(items.length).toBeLessThanOrEqual(lootSlots(r));/* item set v3: an authored table may still name a retired id (the tables are digest-pinned); the crate holds the successor at the declared ratio, and two authored rows that now share a successor share a stack */const want=new Map<string,number>();for(const [key,qty] of s.loot!){const [k0,m0]=key.split(':'),k=liveItemId(k0),meta=m0?(liveRecipeId(m0)??m0):'';want.set(k+':'+meta,(want.get(k+':'+meta)||0)+Math.ceil(qty*liveItemPer(k0)));}for(const [km,qty] of want){const [k,meta]=km.split(':');expect(items.filter(x=>x!.key===k&&(!meta||x!.meta===meta)).reduce((n,x)=>n+x!.qty,0),layout+' '+s.tx+','+s.ty+' '+km).toBeGreaterThanOrEqual(qty);}for(const x of items)expect(isRetiredLive(x!.key),x!.key).toBe(false);const roll=lootRoll(r,s,0);expect(roll.length).toBeGreaterThanOrEqual(2);expect(roll.length).toBeLessThanOrEqual(2+3); /* B01 adds <=3 grammar stacks on fresh runs; the W06 pair is unchanged */}
   for(const kind of ['toolbox','supply','military','advanced'] as const)expect(world.statics.some(s=>lootClass(s)===kind)).toBe(true);
   expect(validate(snap(g))).toBeTruthy();
  }
  expect(lootClass({kind:'loot',tx:2,ty:3,poi:'unknown',loot:[['spares',1]]})).toBeNull();
 });
 it('reproduces source/cycle rolls and rejects forged cycle, exceptional stock and inflated public inventory',()=>{
  const g=start(),r=g.run!,{site,e,c}=target(g,'advanced'),index=lootSiteIndex(site);expect(lootRoll(r,site,0)).toEqual(lootRoll(structuredClone(r),site,0));
  const before=snap(g);expect(lootRoll(before.run!,site,0)).toEqual(lootRoll(r,site,0));
  const bad=structuredClone(before);bad.run!.lootEcology!.cycles[index]=1;expect(validate(bad)).toBeNull();
  const forged=structuredClone(before);forged.run!.lootEcology!.cycles['0']=1;expect(validate(forged)).toBeNull();
  const inflated=structuredClone(before);inflated.run!.custody[c.id].slots.find(s=>s?.key==='energy_refined')!.qty=100;expect(validate(inflated)).toBeNull();
  nearby(g,e);for(let i=0;i<c.slots.length;i++)if(c.slots[i])expect(act(g,'drop',{c:c.id,slot:i}).ok).toBe(true);
  const due=r.lootRespawnAt![index];expect(due).toBe(T+1+48*HOUR);stepLootRespawn(r,due-1);expect(r.entities[e.id]).toBeUndefined();stepLootRespawn(r,due);
  const replacement=Object.values(r.entities).find(x=>x.kind==='loot'&&x.tx===site.tx&&x.ty===site.ty)!;expect(r.lootEcology!.cycles[index]).toBe(1);expect(C(r,replacement.c!).slots.filter(Boolean).map(s=>[s!.key,s!.qty])).toEqual(renewableStock(r,site,1));
  expect(C(r,replacement.c!).slots.every(s=>!s||(!s.key.startsWith('core_')&&s.key!=='blueprint'&&s.key!=='keycard'&&s.key!=='rcash'))).toBe(true);expect(validate(snap(g))).toBeTruthy();
  const rare=structuredClone(g),slot=rare.run!.custody[replacement.c!].slots.findIndex(x=>!x);rare.run!.custody[replacement.c!].slots[slot]=structuredClone(before.run!.custody[c.id].slots.find(s=>s?.key.startsWith('core_'))!);expect(validate(rare)).toBeNull();
 });
 it('has bounded repeatable stock, distinct physical UIDs, no partial refill, and exact class cooldowns across cycles',()=>{
  for(const kind of ['toolbox','supply','military','advanced'] as const){const g=start(),r=g.run!,{site}=target(g,kind),seen=new Set<string>();let at=T+1;
   for(let cycle=0;cycle<4;cycle++){const e=Object.values(r.entities).find(x=>x.kind==='loot'&&x.tx===site.tx&&x.ty===site.ty)!,c=C(r,e.c!);nearby(g,e);const original=c.slots.filter(Boolean);for(const s of original){expect(seen.has(s!.uid)).toBe(false);seen.add(s!.uid);}const first=c.slots.findIndex(Boolean);expect(act(g,'drop',{c:c.id,slot:first},at).ok).toBe(true);stepLootRespawn(r,at+100*HOUR);expect(r.entities[e.id]).toBeTruthy();
    for(let i=0;i<c.slots.length;i++)if(c.slots[i])expect(act(g,'drop',{c:c.id,slot:i},at).ok).toBe(true);const due=r.lootRespawnAt![lootSiteIndex(site)];expect(due).toBe(at+LOOT_CLASSES[kind].hours*HOUR);stepLootRespawn(r,due);expect(r.lootEcology!.cycles[lootSiteIndex(site)]).toBe(cycle+1);expect(validate(snap(g))).toBeTruthy();at=due+1;
   }
  }
 });
 it('old runs keep their old stock and cooldown without an ecology pin',()=>{setActiveLayout('shipping');const g=structuredClone(legacyShipping.save) as GameState,r=g.run!;expect(r.lootEcology).toBeUndefined();const site=getWorld('shipping').statics.find(s=>lootClass(s)==='toolbox')!;expect(lootRoll(r,site,0)).toEqual([]);expect(lootCooldown(site,r)).toBe(lootCooldown(site));expect(validate(snap(g))).toBeTruthy();});
 it('source items actually feed survival and a finite Core reload',()=>{
  const g=start(),r=g.run!;const supply=target(g,'supply');nearby(g,supply.e);const bandage=supply.c.slots.findIndex(s=>s?.key==='bandage');expect(act(g,'move',{from:supply.c.id,fs:bandage,to:'inv'}).ok).toBe(true);r.player.hp=50;const inv=C(r,'inv'),b=inv.slots.findIndex(s=>s?.key==='bandage');expect(act(g,'useItem',{slot:b}).ok).toBe(true);expect(r.player.hp).toBeGreaterThan(50);
  const military=target(g,'military');nearby(g,military.e);const core=military.c.slots.findIndex(s=>s && ITEMS[s.key]?.creatorCore),energy=military.c.slots.findIndex(s=>s?.key==='energy_basic');expect(core).toBeGreaterThanOrEqual(0);expect(act(g,'move',{from:military.c.id,fs:core,to:'inv'}).ok).toBe(true);expect(act(g,'move',{from:military.c.id,fs:energy,to:'inv'}).ok).toBe(true);const slot=inv.slots.findIndex(s=>s && ITEMS[s.key]?.creatorCore),body=inv.slots[slot]!;expect(countItem(r,'inv','energy_basic')).toBe(4);expect(act(g,'loadCore',{slot,uid:body.uid,mode:'basic'}).ok).toBe(true);expect(body.reserves!.basic).toBe(4);expect(countItem(r,'inv','energy_basic')).toBe(0);expect(validate(snap(g))).toBeTruthy();
 });
 it('item set v3: a toolbox that rolls the retired Field Repair Kit hands out 2 Parts instead, and the kit action refuses without spending anything',()=>{
  const probe=start(),ps=target(probe,'toolbox').site;let seed=0;while(seed<500 && !lootRoll({...probe.run!,seed},ps,0).some(([k])=>k==='field_repair_kit'))seed++;expect(seed).toBeLessThan(500);
  const roll=lootRoll({...probe.run!,seed},ps,0),owed=new Map<string,number>();for(const [k,q] of roll)owed.set(liveItemId(k),(owed.get(liveItemId(k))||0)+Math.ceil(q*liveItemPer(k)));
  for(const [k,q] of ps.loot!){const k0=k.split(':')[0];if(liveItemId(k0)==='spares')owed.set('spares',(owed.get('spares')||0)+Math.ceil(q*liveItemPer(k0)));}
  const g=start('shipping_fresh',seed),r=g.run!,{e,c}=target(g,'toolbox');nearby(g,e);
  expect(c.slots.some(s=>s?.key==='field_repair_kit')).toBe(false);expect(c.slots.filter(s=>s?.key==='spares').reduce((n,s)=>n+s!.qty,0)).toBe(owed.get('spares'));expect(owed.get('spares')).toBeGreaterThanOrEqual(2);
  const parts=c.slots.findIndex(s=>s?.key==='spares');expect(act(g,'move',{from:c.id,fs:parts,to:'inv'}).ok).toBe(true);
  const inv=C(r,'inv'),tool=inv.slots[0]!,kitSlot=inv.slots.findIndex(s=>s?.key==='spares'),kitStack=inv.slots[kitSlot]!,had=kitStack.qty;tool.dur=1;
  expect(act(g,'fieldRepair',{slot:0,uid:tool.uid,kitSlot,kitUid:kitStack.uid}).ok).toBe(false);expect(tool.dur).toBe(1);expect(kitStack.qty).toBe(had);expect(validate(snap(g))).toBeTruthy();
 });
 it('existing authorized near-road car wreck uses HP, physical drops and finite depletion, not an invented barrel',()=>{
  const g=start(),r=g.run!,w=getWorld('shipping_fresh'),m=w.economyMap;let index=-1;
  for(let i=0;i<w.sourceV3.length;i++){if(w.sourceV3[i]!=='wreck')continue;const x=i%WW,y=Math.floor(i/WW);let near=false;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(Math.abs(dx)+Math.abs(dy)>=2&&Math.abs(dx)+Math.abs(dy)<=3&&x+dx>=0&&x+dx<WW&&y+dy>=0&&y+dy<200&&m.road[(y+dy)*WW+x+dx])near=true;if(near){index=i;break;}}
  expect(index).toBeGreaterThanOrEqual(0);const tx=index%WW,ty=Math.floor(index/WW),src=sourceAt(r,tx,ty,T)!;expect(src.key).toBe('wreck');expect(src.stock).toBe(8);expect(src.hp).toBe(30);
  const hit=harvestHit(g,tx,ty,{scrap:30},T+1,tx*TILE,ty*TILE);expect(hit.depleted).toBe(true);expect(r.sources[index].hp).toBe(0);expect(r.sources[index].stock).toBe(0);const drops=Object.values(r.entities).filter(e=>e.kind==='drop').map(e=>C(r,e.c!).slots[0]!);expect(drops.some(s=>s.key==='scrap')).toBe(false);expect(drops.filter(s=>s.key==='spares').reduce((a,s)=>a+s.qty,0)).toBeGreaterThanOrEqual(8); /* item set v3: the wreck's guaranteed yield is Parts; its bonus roll can add more */expect(new Set(drops.map(s=>s.uid)).size).toBe(drops.length);expect(harvestHit(g,tx,ty,{scrap:30},T+2,tx*TILE,ty*TILE).result).toBe('empty');expect(validate(snap(g))).toBeTruthy();
 });

 it('item set v3: the Foundry toolbox fasteners arrive as Parts, which hold no formula to study — the table refuses and keeps the stack',()=>{
  const g=start(),r=g.run!,e=Object.values(r.entities).find(e=>e.kind==='loot'&&e.poi==='factory'&&C(r,e.c!).slots.some(s=>s?.key==='spares'))!,c=C(r,e.c!);nearby(g,e);expect(c.slots.some(s=>s?.key==='fasteners')).toBe(false);const slot=c.slots.findIndex(s=>s?.key==='spares');expect(act(g,'move',{from:c.id,fs:slot,to:'inv'}).ok).toBe(true);const inv=C(r,'inv'),sample=inv.slots.findIndex(s=>s?.key==='spares'),uid=inv.slots[sample]!.uid,had=inv.slots[sample]!.qty;
  // A controlled research-table fixture; the specimen itself came from the authored toolbox.
  const fuel=mkContainer(r,'fuel',3),out=mkContainer(r,'out',6),table:Entity={id:'fixture-research',kind:'struct',type:'research',x:r.player.x,y:r.player.y,tx:Math.floor(r.player.x/TILE),ty:Math.floor(r.player.y/TILE),hp:160,maxHp:160,station:{fuelC:fuel.id,outC:out.id,burn:0,queue:[]}};r.entities[table.id]=table;
  expect(act(g,'research',{eid:table.id,mode:'specimen',slot:sample,uid}).ok).toBe(false);expect(inv.slots[sample]!.qty).toBe(had);expect(table.station!.queue).toHaveLength(0);expect(r.knowledge.recipes).not.toContain('fasteners');expect(validate(snap(g))).toBeTruthy();
 });

});
