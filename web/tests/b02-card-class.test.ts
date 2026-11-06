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
  it('the real vault door: a green-tagged card is refused, the vault card opens and reports its real class',()=>{
    const g=start(),r=g.run!,door=doorOf(g);move(g,door.x,door.y+16);
    addItem(r,'inv','keycard',1);const card=C(r,'inv').slots.find(s=>s?.key==='keycard')!;card.meta='green';
    const bad=act(g,'door',{eid:door.id});expect(bad.ok).toBe(false);expect(bad.reason).toMatch(/Sealed/);expect(card.charge).toBe(3);
    card.meta='vault';const ok=act(g,'door',{eid:door.id},T+2);expect(ok.ok).toBe(true);expect(ok.reason ?? ok.message ?? '').not.toContain('Green');
    expect(card.charge).toBe(2);
  });
  it('fixture: a green door reports "Green card scanned" and refuses a vault card; restored afterwards',()=>{
    const g=start(),r=g.run!,door=doorOf(g);move(g,door.x,door.y+16);
    const w=getWorld('shipping_fresh');const contract=w.poiAccess!.doors.find(d=>d.tx===door.tx&&d.ty===door.ty)!;
    const saved=contract.cardClass;
    try{
      contract.cardClass='green';
      addItem(r,'inv','keycard',1);const card=C(r,'inv').slots.find(s=>s?.key==='keycard')!;
      const vault=act(g,'door',{eid:door.id});expect(vault.ok).toBe(false);expect(card.charge).toBe(3);
      card.meta='green';const res=act(g,'door',{eid:door.id},T+2);expect(res.ok).toBe(true);
      expect(String(res.message??res.reason??'')+JSON.stringify(res)).toContain('Green card scanned');
      expect(countItem(r,'inv','keycard')).toBe(1);
    } finally { contract.cardClass=saved; }
    expect(contract.cardClass).toBe(saved);
  });
});
