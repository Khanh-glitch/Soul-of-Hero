import { describe,it,expect } from 'vitest';
import { getWorld, installMapPackage, listLayouts, setActiveLayout } from '../src/game/world';
import { instantiateMapPackage, mapDigest, validateRuntimeMapPackage } from '../src/game/map-package';
import { newGame, dispatch, sourceAt, harvestHit, addItem, C } from '../src/game/engine';
import { serializeSnapshot, validate } from '../src/game/persist';
import { tick, type Input } from '../src/game/sim';
import { WW } from '../src/game/core';
const now=Date.UTC(2026,10,3);
import { manifest } from './fixtures/runtime-map';
describe('versioned map loader, no geography rewrite',()=>{
 it('rejects malformed or unsupported inputs with diagnostics',()=>{expect(validateRuntimeMapPackage(null)).toContain('map package must be an object');expect(validateRuntimeMapPackage({geometry:{economy:{width:1}}}).length).toBeGreaterThan(0);const p=manifest();p.geometry.economy.width=72;expect(validateRuntimeMapPackage(p).some(x=>x.includes('runtime requires exactly'))).toBe(true);const narrow=manifest();const road=narrow.geometry.roads[0];road.widthTiles=2;const a=road.cells[0],b=road.cells[1],neighbor=a+(Math.abs(b-a)===1?WW:1);(narrow.geometry.economy.cargoPassable as number[])[neighbor]=0;expect(validateRuntimeMapPackage(narrow).some(x=>x.includes('advertised width is obstructed'))).toBe(true);});
 it('installs a valid descriptor, instantiates it in the game, and pins geometry and source custody',()=>{
  const p=manifest();expect(validateRuntimeMapPackage(p)).toEqual([]);const w=instantiateMapPackage(p);expect(w.tiles).toEqual(Uint8Array.from(p.tiles));expect(installMapPackage(p)).toEqual([]);expect(installMapPackage(p).some(x=>x.includes('already installed'))).toBe(true);expect(listLayouts().some(x=>x.id===`${p.id}@${p.revision}`)).toBe(true);expect(setActiveLayout(`${p.id}@${p.revision}`)).toBe(true);
  try {const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',region:0,seed:123},now).ok).toBe(true);const r=g.run!,world=getWorld();expect(r.sourceMap!.mapDigest).toBe(mapDigest(world));const i=world.sourceV3.findIndex(k=>k==='rock'),x=i%WW,y=Math.floor(i/WW);expect(harvestHit(g,x,y,{stone:999},now+1,0,0).depleted).toBe(true);const snap=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(snap)).toBeTruthy();expect(sourceAt(snap.run,x,y)?.stock).toBe(0);snap.run.sourceMap.mapDigest='00000000';expect(validate(snap)).toBeNull();
  } finally {setActiveLayout('shipping');}
 });
 it('retains separate immutable revisions under the same map id',()=>{
  const p=manifest();p.id='revision_fixture';p.geometry.economy.id=p.id;const p2=structuredClone(p);p2.revision=2;p2.geometry.economy.revision=2;expect(installMapPackage(p)).toEqual([]);expect(installMapPackage(p2)).toEqual([]);expect(setActiveLayout('revision_fixture@1')).toBe(true);const a=getWorld();expect(setActiveLayout('revision_fixture@2')).toBe(true);const b=getWorld();expect(a.economyMap.revision).toBe(1);expect(b.economyMap.revision).toBe(2);expect(mapDigest(a)).not.toBe(mapDigest(b));setActiveLayout('shipping');
 });
 it('honors an authored cargo restriction during real loaded-cart collision',()=>{
  const p=manifest();p.id='corridor_fixture';p.geometry.economy.id=p.id;
  const provisional=instantiateMapPackage(p),m=p.geometry.economy;let cell=-1;
  for(let y=10;y<190&&cell<0;y++)for(let x=10;x<190&&cell<0;x++){let ok=true;for(let dy=-1;dy<=1;dy++)for(let dx=0;dx<=6;dx++){const i=(y+dy)*WW+x+dx;if(!m.walkable[i]||!m.cargoPassable[i]||m.protected[i]||m.road[i]||provisional.sourceV3[i])ok=false;}if(ok)cell=y*WW+x;}
  expect(cell).toBeGreaterThan(0);(m.cargoPassable as number[])[cell+4]=0;expect(installMapPackage(p)).toEqual([]);setActiveLayout(`${p.id}@${p.revision}`);
  try {const g=newGame();expect(dispatch(g,{id:'start-corridor',type:'startRun',character:'female',region:0,seed:212},now).ok).toBe(true);const r=g.run!;r.creatures=[];const x=cell%WW,y=Math.floor(cell/WW);r.player.x=(x+2)*16+8;r.player.y=y*16+8;addItem(r,'inv','cart_kit',1);r.player.active=C(r,'inv').slots.findIndex(s=>s?.key==='cart_kit');expect(dispatch(g,{id:'place-corridor',type:'placeCart',x:(x+1)*16+8,y:y*16+8},now+1).ok).toBe(true);const cart=Object.values(r.entities).find(e=>e.kind==='cart')!;addItem(r,cart.c!,'stone',100);expect(dispatch(g,{id:'grab-corridor',type:'grabCart',eid:cart.id},now+2).ok).toBe(true);const input:Input={up:false,down:false,left:false,right:true,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};for(let k=0;k<120;k++)tick(g,input,50,now+50*(k+1));expect(cart.x).toBeLessThan((x+4)*16);expect(r.player.x-cart.x).toBeLessThanOrEqual(26.01);expect(C(r,cart.c!).slots.filter(Boolean).reduce((n,s)=>n+s!.qty,0)).toBe(100);expect(validate(JSON.parse(JSON.parse(serializeSnapshot(g)).payload))).toBeTruthy();}finally{setActiveLayout('shipping');}
 });
 it('rejects changed source stock and preserves legacy v3 without the new digest',()=>{setActiveLayout('shipping');const g=newGame();dispatch(g,{id:'start',type:'startRun',character:'female',region:0,seed:456},now);const w=getWorld(),r=g.run!,i=w.sourceV3.findIndex(x=>x==='rock');harvestHit(g,i%WW,Math.floor(i/WW),{stone:999},now+1,0,0);const copy=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);delete copy.run.sourceMap.mapDigest;expect(validate(copy)).toBeTruthy();copy.run.sources[i].stock=999;expect(validate(copy)).toBeNull();});
});
