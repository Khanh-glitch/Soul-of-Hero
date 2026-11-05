import { describe, expect, it } from 'vitest';
import { TILE, WW, type Entity } from '../src/game/core';
import { addItem, blockGrid, buildReason, countItem, dispatch, killPlayer, markDirty, newGame, respawn } from '../src/game/engine';
import { getWorld, setActiveLayout } from '../src/game/world';
import { mapDigest } from '../src/game/map-package';
import { serializeSnapshot, validate } from '../src/game/persist';
import legacy from './fixtures/7b9805b2-shipping-v3.json';
const now=Date.UTC(2026,10,1)+2;
function run(layout:string,seed=1){setActiveLayout(layout);const g=newGame();expect(dispatch(g,{id:'start',type:'startRun',character:'female',seed,region:0},now).ok).toBe(true);return g;}
describe('LR02 seeded sandbox and authoritative wall access',()=>{
 it('preserves actual historical shipping snapshot and geometry, while new shipping/dev runs have no fixed starters',()=>{
  expect(mapDigest(getWorld('shipping'))).toBe('f773dae0');expect(mapDigest(getWorld('dev_delta'))).toBe('74b3ed67');expect(validate(structuredClone(legacy.save))).toBeTruthy();
  for(const layout of ['shipping','dev_delta']){const seen=new Set<string>();for(let seed=1;seed<=10;seed++){const g=run(layout,seed),r=g.run!,w=getWorld();expect(r.layoutId).toBe(`${layout}_fresh`);expect(w.starts).toEqual([]);expect(w.places.some(p=>p.kind==='start')).toBe(false);expect(w.buildings.some(b=>/^b_s[0-3]$/.test(b.id))).toBe(false);expect(w.statics.some(s=>/^s[0-3]$/.test(s.poi||''))).toBe(false);expect(r.spawnChoice).toBeDefined();expect(r.player.x).toBe((r.spawnChoice!.x+.5)*TILE);expect(r.player.y).toBe((r.spawnChoice!.y+.5)*TILE);seen.add(`${r.spawnChoice!.x},${r.spawnChoice!.y}`);const restored=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(restored)).toBeTruthy();delete restored.run.spawnChoice;expect(validate(restored)).toBeNull();}expect(seen.size).toBeGreaterThanOrEqual(8);}
 });
 it('rejects through-wall build, repair, upgrade and device access without spending, but allows target contact',()=>{
  const g=run('shipping',17),r=g.run!;r.creatures=[];const w=getWorld(),grid=blockGrid(r);let x=0,y=0;
  outer:for(let yy=20;yy<180;yy++)for(let xx=20;xx<175;xx++){let ok=true;for(let dx=0;dx<=3;dx++){const i=yy*WW+xx+dx;if(grid[i]||!w.economyMap.buildable[i]||w.sourceV3[i])ok=false;}if(ok){x=xx;y=yy;break outer;}}
  expect(x).toBeGreaterThan(0);r.player.x=x*TILE+8;r.player.y=y*TILE+8;addItem(r,'inv','wood',60);addItem(r,'inv','stone',60);
  const wall:Entity={id:'test-wall',kind:'struct',type:'wall_wood',x:(x+1)*TILE+8,y:y*TILE+8,tx:x+1,ty:y,hp:40,maxHp:160};r.entities[wall.id]=wall;markDirty();const before=countItem(r,'inv','wood');
  expect(buildReason(g,'claim',x+2,y)).toMatch(/wall blocks/i);expect(dispatch(g,{id:'blocked-build',type:'build',struct:'claim',tx:x+2,ty:y},now+1).ok).toBe(false);expect(countItem(r,'inv','wood')).toBe(before);
  const other:Entity={id:'test-target',kind:'struct',type:'wall_wood',x:(x+2)*TILE+8,y:y*TILE+8,tx:x+2,ty:y,hp:40,maxHp:160};r.entities[other.id]=other;markDirty();
  expect(dispatch(g,{id:'blocked-repair',type:'repairStructure',eid:other.id},now+2).ok).toBe(false);expect(dispatch(g,{id:'blocked-upgrade',type:'upgradeStructure',eid:other.id},now+3).ok).toBe(false);expect(other.hp).toBe(40);expect(other.type).toBe('wall_wood');expect(countItem(r,'inv','wood')).toBe(before);
  const device:Entity={id:'test-gen',kind:'struct',type:'base_generator',x:(x+3)*TILE+8,y:y*TILE+8,tx:x+3,ty:y,basePower:{enabled:false,energy:0}};r.entities[device.id]=device;markDirty();expect(dispatch(g,{id:'blocked-device',type:'basePower',eid:device.id,enabled:true},now+4).ok).toBe(false);expect(device.basePower!.enabled).toBe(false);
  expect(dispatch(g,{id:'contact-repair',type:'repairStructure',eid:wall.id},now+5).ok).toBe(true);expect(wall.hp).toBeGreaterThan(40);delete r.entities[wall.id];markDirty();expect(dispatch(g,{id:'open-repair',type:'repairStructure',eid:other.id},now+6).ok).toBe(true);expect(other.hp).toBeGreaterThan(40);
 });
 it('uses a paid owned bed without spawning inside an adjacent wall; death custody remains singular',()=>{
  const g=run('veyra-greywater-lr02-u20',55),r=g.run!,w=getWorld();r.creatures=[];addItem(r,'inv','wood',12);addItem(r,'inv','stone',5);addItem(r,'inv','fiber',10);let spot:{x:number;y:number}|undefined;
  const grid=blockGrid(r);outer:for(let y=10;y<190;y++)for(let x=10;x<188;x++){if([0,1,2].every(dx=>!grid[y*WW+x+dx]&&w.economyMap.buildable[y*WW+x+dx]&&!w.sourceV3[y*WW+x+dx])){spot={x,y};break outer;}}expect(spot).toBeDefined();
  const {x,y}=spot!;r.player.x=x*TILE+8;r.player.y=y*TILE+8;expect(dispatch(g,{id:'paid-claim',type:'build',struct:'claim',tx:x+1,ty:y},now+1).ok).toBe(true);expect(dispatch(g,{id:'paid-bed',type:'build',struct:'bed_straw',tx:x+2,ty:y},now+2).ok).toBe(true);const bed=Object.values(r.entities).find(e=>e.type==='bed_straw')!;
  const wall:Entity={id:'bed-wall-fixture',kind:'struct',type:'wall_wood',x:bed.x,y:bed.y+TILE,tx:bed.tx,ty:bed.ty!+1,hp:160,maxHp:160};r.entities[wall.id]=wall;markDirty();killPlayer(g,now+3,'fixture');expect(Object.values(r.entities).filter(e=>e.kind==='bag')).toHaveLength(1);expect(respawn(g,now+4).ok).toBe(true);expect(r.player.x).toBe(bed.x);expect(r.player.y).toBe(bed.y);expect(blockGrid(r)[Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE)]).not.toBe(3);expect(Object.values(r.entities).filter(e=>e.kind==='bag')).toHaveLength(1);expect(validate(JSON.parse(JSON.parse(serializeSnapshot(g)).payload))).toBeTruthy();
 });

});
