// B02-P1-C card-class reader enforcement (labelled fixture). Real Map placements of green/blue/purple doors
// do NOT exist in the authored world: BLOCKED_MAP. This file proves the reader rule on the one real vault door
// and on a fixture contract that is restored in finally.
import {afterEach,describe,expect,it} from 'vitest';
import {type GameState} from '../src/game/core';
import {addItem,C,countItem,dispatch,newGame} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
const T=Date.UTC(2026,10,6);let n=0;
function start(){setActiveLayout('shipping_fresh');const g=newGame();expect(dispatch(g,{id:'cc-start',type:'startRun',character:'female',seed:99},T).ok).toBe(true);g.run!.creatures=[];return g;}
const act=(g:GameState,type:string,p:object={},at=T+1)=>dispatch(g,{id:`cc-${++n}`,type,...p},at);
const move=(g:GameState,x:number,y:number)=>{g.run!.player.x=x;g.run!.player.y=y;};
const doorOf=(g:GameState)=>Object.values(g.run!.entities).find(e=>e.kind==='door'&&e.poi==='factory')!;
afterEach(()=>setActiveLayout('shipping'));
describe('B02-P1-C reader class enforcement',()=>{
  // ITEM SET V3: a card's class is its ITEM (Green / Blue / Purple Card), not a meta tag on one Keycard. The Shipping vault
  // door is the lowest tier, so the Green Card opens it; an old Keycard is issued as a Green Card.
  it('the real vault door: a Blue Card is refused, the Green Card opens and the message names the real card',()=>{
    const g=start(),r=g.run!,door=doorOf(g);move(g,door.x,door.y+16);
    addItem(r,'inv','blue_card',1);const wrong=C(r,'inv').slots.find(s=>s?.key==='blue_card')!;   // FIXTURE: Blue Cards have no source yet
    const bad=act(g,'door',{eid:door.id});expect(bad.ok).toBe(false);expect((bad as any).reason).toMatch(/Sealed/);expect(wrong.charge).toBe(3);
    addItem(r,'inv','keycard',1);expect(countItem(r,'inv','keycard')).toBe(0);const card=C(r,'inv').slots.find(s=>s?.key==='green_card')!;expect(card.charge).toBe(3);
    const ok=act(g,'door',{eid:door.id},T+2);expect(ok.ok).toBe(true);const okMsg=JSON.stringify(ok);expect(okMsg).toMatch(/Green Card scanned/);expect(okMsg).not.toContain('Blue');
    expect(card.charge).toBe(2);expect(wrong.charge).toBe(3);
  });
  it('fixture: a blue door reports "Blue Card scanned" and refuses a Green Card; restored afterwards',()=>{
    const g=start(),r=g.run!,door=doorOf(g);move(g,door.x,door.y+16);
    const w=getWorld('shipping_fresh');const contract=w.poiAccess!.doors.find(d=>d.tx===door.tx&&d.ty===door.ty)!;
    const saved=contract.cardClass;
    try{
      contract.cardClass='blue';
      addItem(r,'inv','green_card',1);const green=C(r,'inv').slots.find(s=>s?.key==='green_card')!;
      const refused=act(g,'door',{eid:door.id});expect(refused.ok).toBe(false);expect(green.charge).toBe(3);
      addItem(r,'inv','blue_card',1);const blue=C(r,'inv').slots.find(s=>s?.key==='blue_card')!;
      const res=act(g,'door',{eid:door.id},T+2);expect(res.ok).toBe(true);
      expect(JSON.stringify(res)).toContain('Blue Card scanned');
      expect(blue.charge).toBe(2);expect(green.charge).toBe(3);expect(countItem(r,'inv','green_card')).toBe(1);
    } finally { contract.cardClass=saved; }
    expect(contract.cardClass).toBe(saved);
  });
});
