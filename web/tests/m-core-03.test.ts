import {afterAll,describe,expect,it} from 'vitest';
import {TILE,WW,type GameState,type Entity} from '../src/game/core';
import {ITEMS,RECIPES,SOURCES,isRecipeKnown} from '../src/game/catalog';
import {addItem,blockGrid,C,countItem,dispatch,harvestHit,killPlayer,markDirty,mkContainer,newGame,sourceAt,stepStations} from '../src/game/engine';
import {getWorld,setActiveLayout,webRecyclerSite} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
import {settle} from '../src/game/sim';
import {ITEM_RETIREMENT,isRetiredLive,liveItemPer} from '../src/game/final-item-set';
import {WRECK_PARTS_BONUS,wreckBonuses} from '../src/game/wreck-economy';
// ITEM SET V3: this suite was written for the Damaged Drive salvage choice. The drive is retired into Parts (1 -> 2), so
// the machine tests now run on a live Recycler input (Mechanical Gear, rule X:gear-v2) and the drive tests assert the retirement.
const now=Date.UTC(2026,10,4),act=(g:GameState,id:string,type:string,p:Record<string,unknown>={})=>dispatch(g,{id,type,...p},now+10);
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'start','startRun',{character:'female',seed:55}).ok).toBe(true);g.run!.creatures=[];return g;}
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterAll(()=>setActiveLayout('shipping'));
describe('physical salvage choice',()=>{
 it('item set v3: the Damaged Drive is retired into Parts; wreck stock stays finite and no recipe manufactures Parts',()=>{
  expect(ITEMS.damaged_drive,'still parseable for old saves').toBeDefined();expect(ITEM_RETIREMENT.damaged_drive).toMatchObject({stage:'LIVE',to:'spares'});expect(liveItemPer('damaged_drive')).toBe(2);
  expect(Object.values(RECIPES).some(r=>r.out==='damaged_drive'||r.out==='spares')).toBe(false);expect(RECIPES.recover_drive).toBeUndefined();
  expect(SOURCES.wreck.bonus!.some(([k])=>isRetiredLive(k))).toBe(false);expect(SOURCES.wreck.yields.some(([k])=>isRetiredLive(k))).toBe(false);
  const g=start(),r=g.run!,w=getWorld(),i=w.sourceV3.findIndex(k=>k==='wreck');expect(i).toBeGreaterThan(-1);
  // 0.3 Parts + 0.2 drives (2 Parts each) was 0.7 expected Parts: the same number is now rolled directly, on every run policy
  expect(WRECK_PARTS_BONUS).toBeCloseTo(.3+.2*2);expect(wreckBonuses(r)).toContainEqual(['spares',.7]);expect(wreckBonuses(r).some(([k])=>k==='damaged_drive')).toBe(false);
  r.rng=4;const x=i%WW,y=Math.floor(i/WW);expect(harvestHit(g,x,y,{scrap:999},now,r.player.x,r.player.y).depleted).toBe(true);expect(sourceAt(r,x,y)?.stock).toBe(0);expect(harvestHit(g,x,y,{scrap:999},now+1,0,0).result).toBe('empty');
  const dropped=Object.values(r.entities).filter(e=>e.kind==='drop').map(e=>C(r,e.c!).slots[0]!.key);expect(dropped).toContain('spares');expect(dropped.filter(isRetiredLive)).toEqual([]);expect(validate(snap(g))).toBeTruthy();
  // a granted drive (old loot row, old script) arrives as its successor
  const before=countItem(r,'inv','spares');addItem(r,'inv','damaged_drive',1);expect(countItem(r,'inv','damaged_drive')).toBe(0);expect(countItem(r,'inv','spares')).toBe(before+2);
 });
 it('installs a public machine only at the existing Foundry, and input reserve, cancellation, completed output, reload and replay conserve the item (item set v3: a Mechanical Gear; the Damaged Drive is retired)',()=>{
  const g=start(),r=g.run!,site=webRecyclerSite(getWorld(),'shipping_fresh');expect(site).toBeTruthy();const e=Object.values(r.entities).find(x=>x.kind==='recycler')!;expect(e).toMatchObject({...site,kind:'recycler'});r.player.x=e.x+TILE;r.player.y=e.y;markDirty();addItem(r,'inv','mechanical_gear',1);const slot=C(r,'inv').slots.findIndex(x=>x?.key==='mechanical_gear'),drive=C(r,'inv').slots[slot]!,u=drive.uid;
  expect(act(g,'bad','recycleItem',{eid:e.id,slot,uid:'bad'}).ok).toBe(false);expect(countItem(r,'inv','mechanical_gear')).toBe(1);expect(act(g,'recycle1','recycleItem',{eid:e.id,slot,uid:u}).ok).toBe(true);expect(countItem(r,'inv','mechanical_gear')).toBe(0);const j=e.station!.queue[0];expect(j.reserved![0].uid).toBe(u);expect(validate(snap(g))).toBeTruthy();expect(act(g,'cancel','cancelJob',{eid:e.id,jobId:j.id}).ok).toBe(true);expect(C(r,'inv').slots.some(x=>x?.uid===u)).toBe(true);expect(act(g,'cancel','cancelJob',{eid:e.id,jobId:j.id})).toMatchObject({ok:false,dup:true});
  const next=C(r,'inv').slots.findIndex(x=>x?.uid===u);expect(act(g,'recycle2','recycleItem',{eid:e.id,slot:next,uid:u}).ok).toBe(true);let loaded=snap(g);settle(loaded,now+20000);const le=loaded.run!.entities[e.id];expect(countItem(loaded.run!,le.station!.outC,'spares')).toBe(2);expect(le.station!.queue).toHaveLength(0);settle(loaded,now+20000);expect(countItem(loaded.run!,le.station!.outC,'spares')).toBe(2);expect(countItem(loaded.run!,le.station!.outC,'iron_ingot')).toBe(1);expect(act(loaded,'replay','recycleItem',{eid:e.id,slot:next,uid:u}).ok).toBe(false);expect(validate(snap(loaded))).toBeTruthy();
 });
 it('rejects distance, wall, full output, death-bag item, and supplies no duplicate output',()=>{
  const g=start(),r=g.run!,e=Object.values(r.entities).find(x=>x.kind==='recycler')!;addItem(r,'inv','mechanical_gear',1);const slot=C(r,'inv').slots.findIndex(x=>x?.key==='mechanical_gear'),u=C(r,'inv').slots[slot]!.uid;r.player.x=e.x+200;r.player.y=e.y;expect(act(g,'far','recycleItem',{eid:e.id,slot,uid:u}).ok).toBe(false);r.player.x=e.x+TILE;r.player.y=e.y;markDirty();for(let i=0;i<4;i++)addItem(r,e.station!.outC,'wood',60);expect(act(g,'full','recycleItem',{eid:e.id,slot,uid:u}).ok).toBe(false);expect(countItem(r,'inv','mechanical_gear')).toBe(1);C(r,e.station!.outC).slots.fill(null);
  const wall:Entity={id:'wall-fixture',kind:'struct',type:'wall_wood',x:e.x+TILE,y:e.y,tx:e.tx!+1,ty:e.ty,hp:100,maxHp:100};r.entities[wall.id]=wall;r.player.x=e.x+2*TILE;markDirty();expect(act(g,'wall','recycleItem',{eid:e.id,slot,uid:u}).ok).toBe(false);delete r.entities[wall.id];r.player.x=e.x+TILE;markDirty();killPlayer(g,now+20,'fixture');expect(Object.values(r.entities).some(b=>b.kind==='bag'&&C(r,b.c!).slots.some(s=>s?.uid===u))).toBe(true);expect(act(g,'dead','recycleItem',{eid:e.id,slot,uid:u}).ok).toBe(false);expect(countItem(r,e.station!.outC,'spares')).toBe(0);expect(validate(snap(g))).toBeTruthy();
 });
 it('the retired bench route (recover_drive) starts no work and debits nothing',()=>{
  const g=start(),r=g.run!,p=r.player,f=mkContainer(r,'fuel',0),o=mkContainer(r,'out',6),e:Entity={id:'bench-fixture',kind:'struct',type:'workbench',x:p.x+TILE,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:100,station:{fuelC:f.id,outC:o.id,queue:[],burn:0}};r.entities[e.id]=e;markDirty();addItem(r,'inv','spares',4);r.knowledge.recipes.push('recover_drive');markDirty();const before=countItem(r,'inv','spares');
  expect(act(g,'recover','craft',{eid:e.id,recipe:'recover_drive'}).ok).toBe(false);expect(e.station!.queue).toHaveLength(0);expect(countItem(r,'inv','spares')).toBe(before);expect(C(r,o.id).slots.every(s=>!s)).toBe(true);expect(validate(snap(g))).toBeTruthy();
 });
 it('holds finished work when output fills after reservation and produces once when space is freed',()=>{
  const g=start(),r=g.run!,e=Object.values(r.entities).find(x=>x.kind==='recycler')!;r.player.x=e.x+TILE;r.player.y=e.y;markDirty();addItem(r,'inv','mechanical_gear',1);const slot=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_gear'),drive=C(r,'inv').slots[slot]!;expect(act(g,'queue-blocked','recycleItem',{eid:e.id,slot,uid:drive.uid}).ok).toBe(true);for(let i=0;i<4;i++)addItem(r,e.station!.outC,'wood',60);stepStations(g,20000,now+20000);expect(e.station!.queue).toHaveLength(1);expect(e.station!.queue[0].left).toBe(0);expect(e.station!.queue[0].reserved?.[0].uid).toBe(drive.uid);expect(countItem(r,e.station!.outC,'spares')).toBe(0);expect(validate(snap(g))).toBeTruthy();C(r,e.station!.outC).slots[0]=null;C(r,e.station!.outC).slots[1]=null;stepStations(g,1,now+20001);expect(e.station!.queue).toHaveLength(0);expect(countItem(r,e.station!.outC,'spares')).toBe(2);stepStations(g,20000,now+40001);expect(countItem(r,e.station!.outC,'spares')).toBe(2);expect(validate(snap(g))).toBeTruthy();
 });
 it('recover_drive cannot be researched or crafted anywhere; Parts are not a Recycler input',()=>{
  const g=start(),r=g.run!,p=r.player;const f=mkContainer(r,'fuel',0),o=mkContainer(r,'out',4),table:Entity={id:'research-fixture',kind:'struct',type:'research',x:p.x+TILE,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:100,station:{fuelC:f.id,outC:o.id,queue:[],burn:0}};r.entities[table.id]=table;markDirty();addItem(r,'inv','spares',9);const parts=countItem(r,'inv','spares');
  expect(isRecipeKnown(r.knowledge.recipes,'recover_drive')).toBe(false);expect(act(g,'directed','research',{eid:table.id,mode:'directed',recipe:'recover_drive'}).ok).toBe(false);expect(countItem(r,'inv','spares')).toBe(parts);expect(table.station!.queue).toHaveLength(0);
  const recycler=Object.values(r.entities).find(e=>e.kind==='recycler')!;p.x=recycler.x+TILE;p.y=recycler.y;markDirty();expect(act(g,'wrong-station','craft',{eid:recycler.id,recipe:'recover_drive'}).ok).toBe(false);
  const slot=C(r,'inv').slots.findIndex(s=>s?.key==='spares'),u=C(r,'inv').slots[slot]!.uid;const res=act(g,'parts-in','recycleItem',{eid:recycler.id,slot,uid:u});expect(res.ok).toBe(false);expect(countItem(r,'inv','spares')).toBe(parts);expect(recycler.station!.queue).toHaveLength(0);
 });

});
