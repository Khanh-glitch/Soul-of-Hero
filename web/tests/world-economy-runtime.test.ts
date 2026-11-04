import { describe, expect, it } from 'vitest';
import { BAL, TILE, WW, WORLD_SEED } from '../src/game/core';
import { getWorld, setActiveLayout, SRC_KEYS } from '../src/game/world';
import { SOURCES } from '../src/game/catalog';
import { buildReason, blockGrid, harvestHit, markDirty, newGame, dispatch, sourceAt, addItem } from '../src/game/engine';
import { validate, serializeSnapshot } from '../src/game/persist';
import { mapDigest } from '../src/game/map-package';
import { diagnoseStarts, compileEconomy, sourceDigest } from '../src/game/world-economy';
import legacyShipping from './fixtures/7b9805b2-shipping-v3.json';
const now=Date.UTC(2026,10,3); let n=0;
const make=()=>{setActiveLayout('shipping');const g=newGame();expect(dispatch(g,{id:`start-${++n}`,type:'startRun',character:'female',region:0,seed:123},now).ok).toBe(true);g.run!.creatures=[];return g;};
const snapshot=(g:ReturnType<typeof make>)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload);

describe('versioned economy in the real engine',()=>{
 it('compiles shipping deterministically, with accessible starts and no protected or inaccessible placement',()=>{
  const w=getWorld('shipping'),m=w.economyMap;expect(diagnoseStarts(m,w.sourceV3)).toEqual([]);expect(compileEconomy(m).sources).toEqual(w.sourceV3);
  expect(legacyShipping.save.run.sourceMap).toEqual({id:'shipping',revision:1,rules:3,seed:WORLD_SEED,digest:sourceDigest(w.sourceV3),mapDigest:mapDigest(w)}); const g=make(),r=g.run!, fresh=getWorld();expect(r.sourceMap).toEqual({id:'shipping_fresh',revision:1,rules:3,seed:WORLD_SEED,digest:sourceDigest(fresh.sourceV3),mapDigest:mapDigest(fresh)});
  for(let i=0;i<w.sourceV3.length;i++)if(w.sourceV3[i]){expect(m.protected[i]).toBe(0);expect(m.walkable[i]).toBe(1);expect(m.road[i]).toBe(0);expect(SOURCES[w.sourceV3[i]!]).toBeDefined();}
  expect(w.sourceV3.filter(x=>x==='scrap').length).toBeGreaterThan(0);expect(w.sourceV3.filter(x=>x==='iron').length).toBeGreaterThan(0);
 });
 it('preserves depleted v3 stock across serialization and rejects a mismatched source identity',()=>{
  const g=make(),r=g.run!,w=getWorld(),i=w.sourceV3.findIndex(k=>k==='rock'),x=i%WW,y=Math.floor(i/WW);expect(sourceAt(r,x,y)?.key).toBe('rock');
  const hit=harvestHit(g,x,y,{stone:999},now+1,0,0);expect(hit.depleted).toBe(true); const restored=snapshot(g);expect(validate(restored)).toBeTruthy();expect(sourceAt(restored.run,x,y)?.stock).toBe(0);expect(harvestHit(restored,x,y,{stone:999},now+2,0,0).result).toBe('empty');
  restored.run.sourceMap.digest='00000000';expect(validate(restored)).toBeNull();
 });
 it('keeps v1/v2 source cells and run-owned custody unchanged, including v2 palm depletion',()=>{
  setActiveLayout('shipping');const g=structuredClone(legacyShipping.save) as ReturnType<typeof make>,r=g.run!,w=getWorld(),i=w.sourceOverlayV2.findIndex(x=>x>=0),x=i%WW,y=Math.floor(i/WW);r.sourceLayoutVersion=2;delete r.sourceMap;markDirty();
  expect(sourceAt(r,x,y)?.key).toBe('palm');expect(harvestHit(g,x,y,{wood:999},now+1,0,0).depleted).toBe(true);
  const loot=Object.values(r.entities).find(e=>e.kind==='loot'&&e.c)!;const uid=r.custody[loot.c!].slots.find(Boolean)?.uid;
  const restored=snapshot(g);expect(validate(restored)).toBeTruthy();expect(sourceAt(restored.run,x,y)?.stock).toBe(0);expect(restored.run.custody[loot.c!].slots.find(Boolean)?.uid).toBe(uid);
  const old=structuredClone(restored);delete old.run.sourceLayoutVersion;delete old.run.sources[i];expect(validate(old)).toBeTruthy();expect(sourceAt(old.run,x,y)).toBeNull();
 });
 it('allows a physical claim closer than the old 10-tile landmark radius, but protects roads and POI geometry',()=>{
  const g=make(),r=g.run!,w=getWorld();addItem(r,'inv','wood',10);addItem(r,'inv','stone',5);
  const p=w.places.find(q=>q.id==='tp')!;let spot:{x:number,y:number}|undefined;
  for(let y=p.ty-9;y<=p.ty+9&&!spot;y++)for(let x=p.tx-9;x<=p.tx+9&&!spot;x++)if(Math.hypot(x-p.tx,y-p.ty)<10){r.player.x=(x+1)*TILE+8;r.player.y=y*TILE+8;if(!buildReason(g,'claim',x,y))spot={x,y};}
  expect(spot).toBeDefined();expect(dispatch(g,{id:`claim-${++n}`,type:'build',struct:'claim',tx:spot!.x,ty:spot!.y},now+1).ok).toBe(true);
  const b=w.buildings.find(b=>b.id==='b_tp')!;const cell=(b.y-1)*WW+b.x;expect(w.economyMap.protected[cell]).toBe(1);r.player.x=b.x*TILE+8;r.player.y=(b.y-1)*TILE+8;expect(buildReason(g,'campfire',b.x,b.y-1)).not.toBeNull();
 });
 it('has a nonboss foot-connected cash and seller opportunity with positive remainder',()=>{
  const g=make(),r=g.run!,w=getWorld();for(const e of Object.values(r.entities))if(e.kind==='door'&&!e.locked)e.open=true;markDirty();
  const grid=blockGrid(r), start={tx:Math.floor(r.player.x/TILE),ty:Math.floor(r.player.y/TILE)},seen=new Uint8Array(grid.length),q=[start.ty*WW+start.tx];seen[q[0]]=1;
  for(let h=0;h<q.length;h++){const i=q[h],x=i%WW,y=Math.floor(i/WW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*WW+nx;if(nx<0||ny<0||nx>=WW||ny>=200||seen[j]||[1,2,3,5].includes(grid[j]))continue;seen[j]=1;q.push(j);}}
  const accessible=(x:number,y:number,radius:number)=>q.some(i=>Math.hypot((i%WW)*TILE+8-x,Math.floor(i/WW)*TILE+8-y)<=radius*TILE);
  const vendor=Object.values(r.entities).find(e=>e.kind==='vendor')!;const chests=Object.values(r.entities).filter(e=>e.kind==='cash'&&(e.stock?.cash??0)>BAL.economy.escrowChestPrice);
  expect(accessible(vendor.x,vendor.y,2.6)).toBe(true);expect(chests.some(e=>accessible(e.x,e.y,2.2))).toBe(true);
  expect(q.some(i=>w.economyMap.buildable[i]&&!w.economyMap.protected[i]&&!w.sourceV3[i])).toBe(true);
  // Graph proof only: excludes dynamic creatures/weather, closed-door interaction cost and human play.
 });
});
