import {afterEach,describe,expect,it} from 'vitest';
import {type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,newGame} from '../src/game/engine';
import {VENDOR_SPARES} from '../src/game/catalog';
import {setActiveLayout} from '../src/game/world';
import {serializeSnapshot,validate} from '../src/game/persist';
const T=Date.UTC(2026,10,5);let n=0;const act=(g:GameState,type:string,data:object={},id=`m-${++n}`)=>dispatch(g,{id,type,...data},T+10);
const snap=(g:GameState)=>JSON.parse(JSON.parse(serializeSnapshot(g)).payload) as GameState;
afterEach(()=>setActiveLayout('shipping'));
describe('run-local finite Spares market',()=>{
 it('requires the real trader and physical Spares, spends bounded stock exactly once, survives reload, and cannot buy or resell arbitrary items',()=>{
  setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:77}).ok).toBe(true);const r=g.run!,v=Object.values(r.entities).find(e=>e.kind==='vendor')!;addItem(r,'inv','spares',60);
  expect(act(g,'buySpares',{eid:v.id,item:'iron_ore'}).ok).toBe(false);r.player.x=v.x;r.player.y=v.y;const initial=countItem(r,'inv','spares');expect(act(g,'buySpares',{eid:v.id,item:'__proto__'}).ok).toBe(false);expect(act(g,'buySpares',{eid:v.id,item:'iron_ore'},'same').ok).toBe(true);expect(act(g,'buySpares',{eid:v.id,item:'iron_ore'},'same')).toMatchObject({ok:false,dup:true});expect(countItem(r,'inv','iron_ore')).toBe(2);expect(countItem(r,'inv','spares')).toBe(initial-3);expect(r.vendorStock['spares:iron_ore']).toBe(VENDOR_SPARES.iron_ore.stock-1);
  const forged=snap(g);forged.run!.vendorStock['spares:iron_ore']=100;expect(validate(forged)).toBeNull();const s=snap(g);expect(validate(s)).toBeTruthy();for(let i=1;i<VENDOR_SPARES.iron_ore.stock;i++)expect(act(s,'buySpares',{eid:v.id,item:'iron_ore'}).ok).toBe(true);const b=countItem(s.run!,'inv','spares');expect(act(s,'buySpares',{eid:v.id,item:'iron_ore'}).ok).toBe(false);expect(countItem(s.run!,'inv','spares')).toBe(b);expect(s.run!.vendorStock['spares:iron_ore']).toBe(0);expect(act(s,'sell',{eid:v.id,item:'iron_ore'}).ok).toBe(false);expect(validate(snap(s))).toBeTruthy();
 });
 it('keeps purchased output physical if inventory is full',()=>{setActiveLayout('shipping_fresh');const g=newGame();expect(act(g,'startRun',{character:'female',seed:78}).ok).toBe(true);const r=g.run!,v=Object.values(r.entities).find(e=>e.kind==='vendor')!;r.player.x=v.x;r.player.y=v.y;addItem(r,'inv','spares',20);const inv=C(r,'inv');for(let i=0;i<inv.slots.length;i++)if(!inv.slots[i])addItem(r,'inv','knife',1);expect(inv.slots.every(Boolean)).toBe(true);expect(act(g,'buySpares',{eid:v.id,item:'glass'}).ok).toBe(true);expect(Object.values(r.entities).some(e=>e.kind==='drop'&&C(r,e.c!).slots.some(s=>s?.key==='glass'))).toBe(true);expect(validate(snap(g))).toBeTruthy();});
});
