// WEC-01 P0-2 / P0-3: B05 advanced Vault (keycard door) and finite-source lifecycle.
// Fixture disclosure: fresh shipping_fresh run via the real startRun intent; the keycard is added with addItem
// (the same fixture used by the S05 POI suite). No POI, door, item or coordinate is invented.
import {describe,it,expect} from 'vitest';
import {BAL,TILE,type GameState} from '../src/game/core';
import {addItem,C,dispatch,newGame,renewableStock} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {lootSiteAccess} from '../src/game/engine';
import {serializeSnapshot,selectSnapshots} from '../src/game/persist';
import {settle} from '../src/game/sim';
import {WW} from '../src/game/core';
import {specForSite} from '../src/game/loot-source-spec';

const START=Date.UTC(2026,10,5);let n=0;
function fresh():GameState{setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'w1-start',type:'startRun',character:'female',seed:77},START).ok).toBe(true);g.run!.creatures=[];return g;}
const act=(g:GameState,p:any,at:number)=>dispatch(g,{id:'w1-'+(++n),...p},at);
const at=(g:GameState,x:number,y:number)=>{g.run!.player.x=x;g.run!.player.y=y;};
const door=(g:GameState)=>Object.values(g.run!.entities).find(e=>e.kind==='door'&&e.locked==='keycard')!;
// Vault 1 is the authored core_fire cache (160,96). Vault 2 (blueprint:gas_mask, 162,96) is a separate source with no spec yet.
const vault=(g:GameState)=>Object.values(g.run!.entities).find(e=>e.kind==='loot'&&e.poi==='factory_vault'&&e.tx===160&&e.ty===96)!;
const count=(g:GameState,key:string)=>C(g.run!,vault(g).c!).slots.filter(s=>s?.key===key).reduce((a,s)=>a+(s?.qty||0),0);
const vaultSite=()=>getWorld('shipping_fresh').statics.find(s=>s.kind==='loot'&&s.poi==='factory_vault'&&s.loot?.some(([k])=>k==='core_fire'))!;

describe('B05 Vault: the advanced grammar is rolled once, only after the physical door opens (P0-2)', () => {
  it('nothing from the grammar exists while the keycard door is shut; the first legal open rolls it exactly once', () => {
    const g=fresh();const r=g.run!;addItem(r,'inv','keycard',1);
    expect(count(g,'refined_iron_ingot')).toBe(0);expect(count(g,'medkit')).toBe(0);
    at(g,door(g).x,door(g).y+16);
    expect(act(g,{type:'door',eid:door(g).id},START+2).ok).toBe(true);
    expect(door(g).open).toBe(true);
    expect(count(g,'refined_iron_ingot')).toBe(2);expect(count(g,'medkit')).toBe(1);
    expect(r.lootEcology!.deferredLoot).toEqual(['shipping.factory.vault.advanced-keycard']);
  });
  it('closing and reopening the door never rolls the one-time stock again', () => {
    const g=fresh();const r=g.run!;addItem(r,'inv','keycard',2);
    at(g,door(g).x,door(g).y+16);
    expect(act(g,{type:'door',eid:door(g).id},START+2).ok).toBe(true);
    expect(act(g,{type:'door',eid:door(g).id},START+3).ok).toBe(true);           // close (occupancy clear)
    expect(door(g).open).toBe(false);
    expect(act(g,{type:'door',eid:door(g).id},START+4).ok).toBe(true);           // reopen with the second card use
    expect(count(g,'refined_iron_ingot')).toBe(2);expect(count(g,'medkit')).toBe(1);
  });
  it('the one-time stock survives a save/reload and is never re-rolled after reload', () => {
    const g=fresh();const r=g.run!;addItem(r,'inv','keycard',2);
    at(g,door(g).x,door(g).y+16);expect(act(g,{type:'door',eid:door(g).id},START+2).ok).toBe(true);
    const back=selectSnapshots([serializeSnapshot(g),null]).gs!;
    expect(back).toBeTruthy();
    const bv=Object.values(back.run!.entities).find(e=>e.kind==='loot'&&e.poi==='factory_vault'&&e.tx===160&&e.ty===96)!;
    expect(C(back.run!,bv.c!).slots.filter(s=>s?.key==='refined_iron_ingot').reduce((a,s)=>a+s!.qty,0)).toBe(2);
    expect(back.run!.lootEcology!.deferredLoot).toEqual(['shipping.factory.vault.advanced-keycard']);
    const dr=Object.values(back.run!.entities).find(e=>e.kind==='door'&&e.locked==='keycard')!;
    at(back,dr.x,dr.y+16);
    dispatch(back,{id:'w1-reload-'+(++n),type:'door',eid:dr.id},START+5);
    expect(C(back.run!,bv.c!).slots.filter(s=>s?.key==='refined_iron_ingot').reduce((a,s)=>a+s!.qty,0)).toBe(2);
  });
  it('a shut door leaves the vault physically unreachable, so no roll can be taken', () => {
    const g=fresh();expect(lootSiteAccess(g.run!,vaultSite())).toBe('door-required');
  });
});

describe('finite Vault never respawns on an ordinary timer (P0-3)', () => {
  it('the finite vault has no renewable stock at any cycle, under either grammar', () => {
    const g=fresh();const r=g.run!;
    for (let c=1;c<=4;c++) expect(renewableStock(r,vaultSite(),c)).toEqual([]);
    expect(specForSite(vaultSite())?.stock).toBe('finite');
  });
  it('emptying the vault schedules no respawn and nothing reappears well past its 48 h cooldown (200 run hours, inside the 336 h run)', () => {
    const g=fresh();const r=g.run!;addItem(r,'inv','keycard',1);
    at(g,door(g).x,door(g).y+16);expect(act(g,{type:'door',eid:door(g).id},START+2).ok).toBe(true);
    const v=vault(g);
    // Real withdrawals: every stack leaves the container through the move intent (the final one retires the site).
    for (const [i,s] of C(r,v.c!).slots.entries()) if (s) {
      at(g,v.x,v.y+16);
      const res=act(g,{type:'move',from:v.c,fs:i,to:'inv'},START+10+i);
      expect(res.ok, `withdraw slot ${i}: ${(res as any).reason ?? ''}`).toBe(true);
    }
    // dispatch() may return a new run object: always read the live one.
    const live=()=>g.run!;
    expect((live().custody[v.c!]?.slots ?? []).some(Boolean)).toBe(false);
    const idx=v.ty!*WW+v.tx!;
    expect(live().depletedLootSites).toContain(idx);
    expect(live().lootRespawnAt?.[idx]).toBeUndefined();
    expect(Object.values(live().entities).some(e=>e.kind==='loot'&&e.poi==='factory_vault'&&e.tx===160&&e.ty===96)).toBe(false);
    settle(g,START+200*3600_000,true);
    expect(Object.values(live().entities).some(e=>e.kind==='loot'&&e.poi==='factory_vault'&&e.tx===160&&e.ty===96)).toBe(false);
    expect(live().lootRespawnAt?.[idx]).toBeUndefined();
    expect(BAL).toBeTruthy();
  });
});
