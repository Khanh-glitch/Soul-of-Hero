import { describe, expect, it } from 'vitest';
import { BAL, TILE, WW, type Entity, type GameState } from '../src/game/core';
import { ITEMS, GARDEN_CROPS } from '../src/game/catalog';
import { addItem, blockGrid, C, cartLimit, countItem, dispatch, harvestHit, markDirty, mkContainer, newGame, sourceAt, stepGardensBarrels, stepStations } from '../src/game/engine';
import { getWorld, SRC_KEYS } from '../src/game/world';
import { settle, tick, type Input } from '../src/game/sim';
import { serializeSnapshot, validate } from '../src/game/persist';
const T=Date.UTC(2026,10,1); let seq=0;
const act=(g:GameState,type:string,p:object={},id=`log-${++seq}`,now=T+1)=>dispatch(g,{id,type,...p},now);
function fresh(){const g=newGame();expect(act(g,'startRun',{character:'male',region:0,seed:555}).ok).toBe(true);g.run!.creatures=[];return g;}
function give(g:GameState,k:string,n=1){expect(addItem(g.run!,'inv',k,n)).toBe(0);}
function bench(g:GameState){const r=g.run!,p=r.player,f=mkContainer(r,'fuel',3),o=mkContainer(r,'out',6);const e:Entity={id:`fixture-${++seq}`,kind:'struct',type:'workbench',x:p.x+16,y:p.y,tx:Math.floor(p.x/TILE)+1,ty:Math.floor(p.y/TILE),hp:100,maxHp:160,station:{fuelC:f.id,outC:o.id,burn:0,queue:[],level:2}};r.entities[e.id]=e;markDirty();return e;}
function plot(g:GameState){const r=g.run!,p=r.player;const e:Entity={id:`fixture-${++seq}`,kind:'struct',type:'garden',x:p.x+8,y:p.y,tx:Math.floor(p.x/TILE),ty:Math.floor(p.y/TILE),hp:60,maxHp:60,garden:{crop:null,growth:0,water:0}};r.entities[e.id]=e;markDirty();return e;}
function cart(g:GameState){const r=g.run!,p=r.player;give(g,'cart_kit');const slot=C(r,'inv').slots.findIndex(s=>s?.key==='cart_kit');p.active=slot;const uid=C(r,'inv').slots[slot]!.uid;expect(act(g,'placeCart',{x:p.x+4,y:p.y+4}).ok).toBe(true);return {e:Object.values(r.entities).find(e=>e.kind==='cart')!,uid};}
const snapshot=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;

describe('integrated logistics and cultivation',()=>{
 it('pays for one upgrade at an owned level-2 bench; preserves cargo, UID and upgrade through pack, save and redeploy',()=>{
  const g=fresh(),r=g.run!,{e,uid}=cart(g),b=bench(g);give(g,'mechanical_parts',4);give(g,'iron_ingot',2);give(g,'spares',3);addItem(r,e.c!,'stone',5);
  const cmd={eid:e.id,uid,benchId:b.id};b.station!.level=1;expect(act(g,'upgradeCart',cmd).ok).toBe(false);b.station!.level=2;b.owner='other';expect(act(g,'upgradeCart',cmd).ok).toBe(false);b.owner=undefined;
  expect(act(g,'upgradeCart',{...cmd,uid:'stale'}).ok).toBe(false);e.owner='other';expect(act(g,'upgradeCart',cmd).ok).toBe(false);expect(act(g,'grabCart',{eid:e.id}).ok).toBe(false);e.owner=undefined;
  expect(act(g,'upgradeCart',cmd,'upgrade-once').ok).toBe(true);expect(act(g,'upgradeCart',cmd,'upgrade-once')).toMatchObject({ok:false,dup:true});expect(act(g,'upgradeCart',cmd).ok).toBe(false);
  expect(countItem(r,'inv','mechanical_parts')).toBe(0);expect(countItem(r,'inv','iron_ingot')).toBe(0);expect(countItem(r,'inv','spares')).toBe(0);expect(countItem(r,e.c!,'stone')).toBe(5);expect(C(r,e.c!).slots).toHaveLength(32);expect(cartLimit(e)).toBe(360);
  expect(act(g,'reclaim',{eid:e.id}).ok).toBe(false);expect(act(g,'move',{from:e.c,fs:0,to:'inv'}).ok).toBe(true);expect(act(g,'reclaim',{eid:e.id}).ok).toBe(true);
  const saved=snapshot(g),rr=saved.run!,s=C(rr,'inv').slots.find(s=>s?.uid===uid)!;expect(s.upgrade).toBe('freight');expect(validate(saved)).toBeTruthy();rr.player.active=C(rr,'inv').slots.indexOf(s);
  expect(act(saved,'placeCart',{x:rr.player.x+4,y:rr.player.y+4}).ok).toBe(true);const placed=Object.values(rr.entities).find(e=>e.kind==='cart')!;expect(placed.deployed!.uid).toBe(uid);expect(placed.deployed!.upgrade).toBe('freight');expect(C(rr,placed.c!).slots).toHaveLength(32);expect(validate(saved)).toBeTruthy();
 });
 it('upgrade rejects missing materials, distant bench and legacy deployed identity without spending',()=>{
  const g=fresh(),r=g.run!,{e,uid}=cart(g),b=bench(g);give(g,'mechanical_parts',4);give(g,'iron_ingot',2);give(g,'spares',2);const cmd={eid:e.id,uid,benchId:b.id};
  expect(act(g,'upgradeCart',cmd).ok).toBe(false);give(g,'spares');b.x+=300;expect(act(g,'upgradeCart',cmd).ok).toBe(false);b.x-=300;
  const deployed=e.deployed;delete e.deployed;expect(act(g,'upgradeCart',cmd).ok).toBe(false);e.deployed=deployed;expect(countItem(r,'inv','mechanical_parts')).toBe(4);expect(C(r,e.c!).slots).toHaveLength(24);
 });
 it('changes actual loaded movement at 300 kg but still has terrain and weight friction',()=>{
  const base=fresh(),r=base.run!,{e,uid}=cart(base),b=bench(base);give(base,'mechanical_parts',4);give(base,'iron_ingot',2);give(base,'spares',3);expect(act(base,'upgradeCart',{eid:e.id,uid,benchId:b.id}).ok).toBe(true);
  addItem(r,e.c!,'stone',250);expect(countItem(r,e.c!,'stone')*ITEMS.stone.w).toBe(300);
  const normal=structuredClone(base),nr=normal.run!,ne=nr.entities[e.id];delete ne.deployed!.upgrade;C(nr,ne.c!).slots.length=24;
  const input:Input={up:false,down:false,left:true,right:false,mx:r.player.x-30,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false};r.player.pulling=e.id;nr.player.pulling=e.id;
  tick(base,input,50,T+50);tick(normal,input,50,T+50);expect(Math.abs(r.player.vx)).toBeGreaterThan(Math.abs(nr.player.vx)*2);expect(Math.abs(r.player.vx)).toBeLessThan(BAL.player.speed);
 });
 it('funds Bitterleaf with seed, specimen and three flask charges, waits wet time, harvests once and enables medicine',()=>{
  const g=fresh(),r=g.run!,e=plot(g),b=bench(g);give(g,'seed');give(g,'herb');const f=C(r,'inv').slots.find(s=>s?.key==='water_flask')!; f.charge=4; // fixture: flask refilled at fresh water
  expect(act(g,'garden',{eid:e.id,crop:'herb'},'plant').ok).toBe(true);expect(countItem(r,'inv','herb')).toBe(0);expect(countItem(r,'inv','seed')).toBe(0);expect(act(g,'garden',{eid:e.id,crop:'crop'},'plant')).toMatchObject({ok:false,dup:true});
  stepGardensBarrels(g,600000,false);expect(e.garden!.growth).toBe(0);for(let i=0;i<3;i++)expect(act(g,'garden',{eid:e.id}).ok).toBe(true);expect(f.charge).toBe(1);
  expect(act(g,'garden',{eid:e.id}).ok).toBe(false);expect(f.charge).toBe(1);stepGardensBarrels(g,600000,false);expect(e.garden!.growth).toBe(1);expect(act(g,'garden',{eid:e.id},'harvest').ok).toBe(true);expect(countItem(r,'inv','herb')).toBe(3);expect(countItem(r,'inv','seed')).toBe(1);expect(act(g,'garden',{eid:e.id},'harvest')).toMatchObject({ok:false,dup:true});
  r.knowledge.recipes.push('antirad');give(g,'gland');expect(act(g,'craft',{eid:b.id,recipe:'antirad'}).ok).toBe(true);stepStations(g,10000,T+10000);expect(C(r,b.station!.outC).slots.some(s=>s?.key==='antirad')).toBe(true);expect(countItem(r,'inv','herb')).toBe(1);expect(ITEMS.antirad.food!.rad).toBe(-45);expect(GARDEN_CROPS.herb.seconds).toBe(600);
 });
 it('drops physical harvest when inventory is full without replaying it',()=>{
  const g=fresh(),r=g.run!,e=plot(g);give(g,'seed');give(g,'herb');expect(act(g,'garden',{eid:e.id,crop:'herb'}).ok).toBe(true);e.garden!.growth=1;
  const empty=C(r,'inv').slots.filter(s=>!s).length;give(g,'cart_kit',empty);expect(C(r,'inv').slots.every(Boolean)).toBe(true);
  expect(act(g,'garden',{eid:e.id},'full-harvest').ok).toBe(true);expect(act(g,'garden',{eid:e.id},'full-harvest')).toMatchObject({ok:false,dup:true});
  const drops=Object.values(r.entities).filter(e=>e.kind==='drop').flatMap(e=>C(r,e.c!).slots.filter(Boolean));expect(drops.filter(s=>s?.key==='herb').reduce((n,s)=>n+s!.qty,0)).toBe(3);expect(drops.filter(s=>s?.key==='seed').reduce((n,s)=>n+s!.qty,0)).toBe(1);expect(validate(snapshot(g))).toBeTruthy();
 });
 it('settles funded Bitterleaf only once across a saved offline interval and legacy garden intent still plants Sunroot',()=>{
  const g=fresh(),r=g.run!,e=plot(g);give(g,'seed');give(g,'herb');C(r,'inv').slots.find(s=>s?.key==='water_flask')!.charge=4;expect(act(g,'garden',{eid:e.id,crop:'herb'}).ok).toBe(true);for(let i=0;i<3;i++)expect(act(g,'garden',{eid:e.id}).ok).toBe(true);
  const saved=snapshot(g);settle(saved,T+600001);const garden=saved.run!.entities[e.id].garden!;expect(garden.growth).toBeCloseTo(1);const before=JSON.stringify(garden);settle(saved,T+600001);expect(JSON.stringify(garden)).toBe(before);expect(act(saved,'garden',{eid:e.id},'offline-harvest',T+600002).ok).toBe(true);expect(countItem(saved.run!,'inv','herb')).toBe(3);
  expect(act(saved,'garden',{eid:e.id},'legacy-plant',T+600003).ok).toBe(true);expect(garden.crop).toBe('crop');expect(validate(saved)).toBeTruthy();
 });
 it('links garden-funded tonic and freight custody to the finite hazardous foundry crate (position fixture, not route proof)',()=>{
  const g=fresh(),r=g.run!,garden=plot(g),b=bench(g),{e:cartEntity,uid}=cart(g);give(g,'seed');give(g,'herb');give(g,'gland');give(g,'mechanical_parts',4);give(g,'iron_ingot',2);give(g,'spares',3);
  expect(act(g,'upgradeCart',{eid:cartEntity.id,uid,benchId:b.id}).ok).toBe(true);C(r,'inv').slots.find(s=>s?.key==='water_flask')!.charge=4;
  expect(act(g,'garden',{eid:garden.id,crop:'herb'}).ok).toBe(true);for(let i=0;i<3;i++)expect(act(g,'garden',{eid:garden.id}).ok).toBe(true);stepGardensBarrels(g,600000,false);expect(act(g,'garden',{eid:garden.id}).ok).toBe(true);
  r.knowledge.recipes.push('antirad');expect(act(g,'craft',{eid:b.id,recipe:'antirad'}).ok).toBe(true);stepStations(g,10000,T+10000);const tonicSlot=C(r,b.station!.outC).slots.findIndex(s=>s?.key==='antirad');expect(act(g,'move',{from:b.station!.outC,fs:tonicSlot,to:'inv'}).ok).toBe(true);
  const crate=Object.values(r.entities).find(e=>e.kind==='loot' && e.poi==='factory' && C(r,e.c!).slots.some(s=>s?.key==='mechanical_parts'))!;expect(crate).toBeTruthy();
  r.player.x=crate.x+16;r.player.y=crate.y;cartEntity.x=r.player.x+4;cartEntity.y=r.player.y;expect(getWorld().zone[Math.floor(r.player.y/16)*WW+Math.floor(r.player.x/16)]).toBe(7);
  settle(g,T+600001);expect(r.player.rad).toBeGreaterThan(0);const previous=r.player.rad;const tonic=C(r,'inv').slots.findIndex(s=>s?.key==='antirad');expect(act(g,'useItem',{slot:tonic},'take-tonic',T+600002).ok).toBe(true);expect(r.player.rad).toBeLessThan(previous);expect(act(g,'useItem',{slot:tonic},'take-tonic',T+600003)).toMatchObject({ok:false,dup:true});
  const sourceSlot=C(r,crate.c!).slots.findIndex(s=>s?.key==='mechanical_parts');expect(act(g,'move',{from:crate.c,fs:sourceSlot,to:'inv'},'loot-parts',T+600004).ok).toBe(true);expect(C(r,crate.c!).slots[sourceSlot]).toBeNull();expect(act(g,'move',{from:crate.c,fs:sourceSlot,to:'inv'},'loot-parts',T+600005)).toMatchObject({ok:false,dup:true});
  const partsSlot=C(r,'inv').slots.findIndex(s=>s?.key==='mechanical_parts');expect(act(g,'move',{from:'inv',fs:partsSlot,to:cartEntity.c},'load-parts',T+600006).ok).toBe(true);expect(countItem(r,cartEntity.c!,'mechanical_parts')).toBe(2);const restored=snapshot(g);expect(countItem(restored.run!,restored.run!.entities[cartEntity.id].c!,'mechanical_parts')).toBe(2);expect(C(restored.run!,restored.run!.entities[crate.id].c!).slots[sourceSlot]).toBeNull();
 });
 it('adds palms only to previously empty tiles on run-pinned v2; legacy source depletion and burns are unchanged',()=>{
  for(const layout of ['shipping','dev_delta'] as const){const w=getWorld(layout);const overlay=[...w.sourceOverlayV2].map((v,i)=>v>=0?i:-1).filter(i=>i>=0);expect(overlay.length).toBeGreaterThan(0);expect(overlay.every(i=>w.src[i]===-1 && SRC_KEYS[w.sourceOverlayV2[i]]==='palm')).toBe(true);expect(w.statics.every(s=>w.sourceOverlayV2[s.ty*WW+s.tx]<0)).toBe(true);}
  const g=fresh(),r=g.run!,w=getWorld('shipping'),i=w.sourceOverlayV2.findIndex(v=>v>=0),tx=i%WW,ty=Math.floor(i/WW);r.sourceLayoutVersion=2;delete r.sourceMap;markDirty();expect(r.sourceLayoutVersion).toBe(2);expect(sourceAt(r,tx,ty)?.key).toBe('palm');expect(blockGrid(r)[i]).toBe(2);
  expect(harvestHit(g,tx,ty,{wood:999},T+2,tx*TILE,ty*TILE).depleted).toBe(true);const saved=snapshot(g);expect(sourceAt(saved.run!,tx,ty)?.stock).toBe(0);expect(blockGrid(saved.run!)[i]).not.toBe(2);
  const legacy=structuredClone(saved);delete legacy.run!.sourceLayoutVersion;delete legacy.run!.sources[i];const j=w.src.findIndex(v=>v>=0),jx=j%WW,jy=Math.floor(j/WW);const orig=SRC_KEYS[w.src[j]];legacy.run!.sources[j]={stock:0,hp:0,burnt:false};expect(sourceAt(legacy.run!,tx,ty)).toBeNull();expect(sourceAt(legacy.run!,jx,jy)).toMatchObject({key:orig,stock:0});legacy.run!.sources[j].burnt=true;expect(sourceAt(legacy.run!,jx,jy)?.key).toBe('deadtree');expect(validate(legacy)).toBeTruthy();
 });
});
