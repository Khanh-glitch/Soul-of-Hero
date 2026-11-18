/** Characterizes a technical input discontinuity; NOT approval of its design.
 * No gameplay law change. A real UI audit also reproduces empty selected slot
 * -> collected fiber -> held harvesting stops while stock remains. */
import {afterEach,expect,it} from 'vitest';
import {C,mkStack,newGame,startRun} from '../src/game/engine';
import {tick,FX,type Input} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
const NOW=Date.UTC(2026,10,17,12);
afterEach(()=>{FX.length=0;setActiveLayout('shipping');});
it.each([false,true])('records current hold/fresh-press behavior with resource in active slot=%s',filled=>{
 setActiveLayout('shipping_fresh');const gs=newGame();expect(startRun(gs,'female',NOW,1,901).ok).toBe(true);const r=gs.run!;r.creatures=[];
 const slot=C(r,'inv').slots.indexOf(null);expect(slot).toBeGreaterThanOrEqual(0);r.player.active=slot;
 if(filled)C(r,'inv').slots[slot]=mkStack(r,'fiber',1);
 const input:Input={up:false,down:false,left:false,right:false,mx:r.player.x+16,my:r.player.y,attack:true,attackPressed:false,roll:false,cancel:false};
 tick(gs,input,40,NOW+40);
 if(filled){
  expect(r.player.action).toBeNull();
  input.attackPressed=true;tick(gs,input,40,NOW+80);
  expect(r.player.action?.kind).toBe('swing');expect(r.player.action?.slot).toBe(-1);
 }else expect(r.player.action?.kind).toBe('swing');
});
