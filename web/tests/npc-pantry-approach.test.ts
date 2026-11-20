import {expect,it} from 'vitest';
import {C,newGame,startRun} from '../src/game/engine';
import {stepHumans} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

it('a thirsty mechanic uses the free side of a stocked pantry rather than walking into a working colleague',()=>{
  // Controlled access geometry, not part of the all-island survival census.
  setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,c=hw.communities['com:po_greywater'],[tx,ty]=c.storeTile!,h=hw.people.h2;
  for(const p of Object.values(hw.people))p.nextThinkAt=T0+60000;
  h.gx=tx+1;h.gy=ty+1;h.floor=0;h.thirst=30;h.nextThinkAt=T0;h.state='IDLE';h.intent=undefined;
  const goal={tx,ty,floor:0},short=humanNavigation(r).route(h,goal)![0];expect(short).toBeTruthy();
  const colleague=hw.people.h5;colleague.gx=short.tx;colleague.gy=short.ty;colleague.floor=0;
  colleague.state='WORKING';colleague.intent={kind:'work',target:'occupation:guard',actorId:colleague.actorId,intentId:'fixture-watch',preconditions:[],reserved:[],startAt:T0,dueAt:T0+60000};
  const berries=C(r,c.storeContainers[0]).slots.find(s=>s?.key==='berries')!;const qty=berries.qty;
  stepHumans(r,hw,T0+1);const route=hw.people.h2.intent;expect(route?.target).toBe(c.storeEntityId);expect(route?.route).toHaveLength(1);expect(route?.route?.[0]).not.toEqual(short);
  expect(h.thirst).toBe(30);expect(berries.qty).toBe(qty);
  for(let s=100;s<=2000&&h.thirst<40;s+=100)stepHumans(r,hw,T0+s);
  expect(Math.abs(h.gx-tx)+Math.abs(h.gy-ty)).toBe(1);
  expect(h.thirst).toBe(42);expect(berries.qty).toBe(qty-3);expect([colleague.gx,colleague.gy]).toEqual([short.tx,short.ty]);
});
