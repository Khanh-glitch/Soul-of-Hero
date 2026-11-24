import {it,expect} from 'vitest';
import {newGame,startRun,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {humanConsume} from '../src/game/humanworld';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

it('one serving has one bill and the same benefits for either need; an empty flask is not another serving',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,h=hw.people.h2,pack=r.custody[h.inv.packId];
 // Isolate portable stock; no permission to consume from a warehouse.
 h.community=undefined;h.state='IDLE';pack.slots.fill(null);
 for(const need of ['food','water'] as const){
  pack.slots[0]={uid:'test-stew',key:'stew',qty:1};h.hunger=h.thirst=h.warmth=20;h.hp=h.maxHp-5;
  expect(humanConsume(r,hw,h,need,T0)).toBe(true);expect([h.hunger,h.thirst,h.warmth,h.hp]).toEqual([65,40,45,h.maxHp]);
  expect(pack.slots[0]).toBeNull();expect(humanConsume(r,hw,h,need,T0)).toBe(false);
 }
 const flask={uid:'test-flask',key:'water_flask',qty:1,charge:1};pack.slots[0]=flask;h.hunger=h.thirst=50;
 beginReceiptSink();let rows;try{expect(humanConsume(r,hw,h,'water',T0)).toBe(true);expect(humanConsume(r,hw,h,'water',T0+1)).toBe(false);}finally{rows=endReceiptSink();}
 expect(rows.filter(e=>e.kind==='human.consume').map(e=>JSON.parse(e.detail))).toEqual([{actorId:h.actorId,uid:flask.uid,key:flask.key,containerId:pack.id,qty:0,charges:1}]);
 expect(pack.slots[0]).toEqual({...flask,charge:0,qty:1});expect([h.hunger,h.thirst]).toEqual([50,80]);
});
