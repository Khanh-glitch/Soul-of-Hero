import {expect,it} from 'vitest';
import {newGame,startRun} from '../src/game/engine';
import {advanceEvacuation,boardEvac,departEvac,evacSchedule} from '../src/game/humanworld';
import {setActiveLayout} from '../src/game/world';
import {HOUR} from '../src/game/core';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
function setup(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);const r=gs.run!,hw=r.humanWorld!,t=Object.values(hw.evacuation)[0],h=Object.values(hw.people)[0],at=T0+1000;
 r.qaOffset=evacSchedule().openHour*HOUR;advanceEvacuation(r,hw,at);h.gx=t.siteGx;h.gy=t.siteGy;h.floor=0;expect(boardEvac(r,hw,h,t.tripId,at).ok).toBe(true);return {gs,r,hw,t,h,at,hold:r.custody[t.vessel!.holdId]};}
it('pays in real food, water and repair parts; an embarked pilot and hull clock survive reload',()=>{const {gs,r,hw,t,h,at,hold}=setup(),v=t.vessel!;v.hull=20;
 const berry=hold.slots.find(s=>s?.key==='berries')!,water=hold.slots.find(s=>s?.key==='water_flask')!,parts=hold.slots.find(s=>s?.key==='spares')!,before=[berry.qty,water.charge!,parts.qty];
 expect(departEvac(r,hw,t.tripId,at).ok).toBe(true);expect([berry.qty,water.charge,parts.qty]).toEqual(before.map(n=>n-1));expect(v.helm).toBe(h.actorId);expect(v.hull).toBe(45);
 advanceEvacuation(r,hw,at+HOUR);expect(v.hull).toBe(41);const copy=validate(JSON.parse(JSON.stringify(gs)))!.run!,c=copy.humanWorld!,trip=c.evacuation[t.tripId];advanceEvacuation(copy,c,at+HOUR);expect(trip.vessel!.hull).toBe(41);advanceEvacuation(copy,c,trip.arriveAt!);expect(c.people[h.actorId].state).toBe('EVACUATED');expect(trip.phase).toBe('SERVICE_ENDED');});
it('refuses departure with an empty pantry without consuming water',()=>{const {r,hw,t,h,at,hold}=setup();hold.slots[hold.slots.findIndex(s=>s?.key==='berries')]=null;const before=JSON.stringify(hold);expect(departEvac(r,hw,t.tripId,at).ok).toBe(false);expect(JSON.stringify(hold)).toBe(before);expect(t.phase).toBe('FAILED');expect(h.transit).toBeUndefined();expect(r.receipts.some(q=>q.kind==='evac.failed')).toBe(true);});
it('a wreck at sea never lands or returns its passengers to island work',()=>{const {r,hw,t,h,at}=setup();departEvac(r,hw,t.tripId,at);t.vessel!.hull=3;advanceEvacuation(r,hw,at+HOUR);advanceEvacuation(r,hw,t.arriveAt!);expect(t.phase).toBe('FAILED');expect(t.vessel!.hull).toBe(0);expect(h.state).toBe('ON_VESSEL');expect(t.arrivalReceipt).toBeUndefined();});
