import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {newGame,startRun,beginReceiptSink,endReceiptSink,globalSourceAt} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';

// Actual pre-fix first-day checkpoint; never inject stock, position or a food intent.
const saved=process.env.SOH_SUBSISTENCE_H24;
it.skipIf(!saved)('Westbank scavenger picks a real meal instead of waiting to starve beside a bush',()=>{
 const gs=selectSnapshots([readFileSync(saved!,'utf8')]).gs!,r=gs.run!,hw=r.humanWorld!,h=hw.people.h1m,at=r.clock.lastSimAt;
 expect(setActiveLayout(r.layoutId!)).toBe(true);expect(h.hunger).toBeLessThan(5);expect(h.occupation).toBe('salvager');
 const source=()=>globalSourceAt(r,1828,1831,0,r.clock.lastSimAt)!;const before={food:h.hunger,stock:source().stock,dur:h.equip.weapon?.dur};
 beginReceiptSink();let events;try{settle(gs,at+8*60000,true);}finally{events=endReceiptSink();}
 const eats=events.filter(e=>e.kind==='human.consume').map(e=>JSON.parse(e.detail)).filter(e=>e.actorId===h.actorId&&e.key==='berries');
 expect(eats.some(e=>e.containerId===h.inv.packId&&e.qty===1)).toBe(true);expect(events.some(e=>e.kind==='human.harvest'&&e.detail.startsWith('h1m:bush@1828,1831:'))).toBe(true);
 expect(h.hunger).toBeGreaterThan(before.food);
 const bytes=serializeSnapshot(gs);const loaded=selectSnapshots([bytes]).gs!;expect(loaded).toBeTruthy();settle(loaded,r.clock.lastSimAt,true);expect(loaded.run!.humanWorld!.people.h1m.hunger).toBe(h.hunger);
 console.log(JSON.stringify({actor:h.actorId,before,after:{food:h.hunger,stock:source().stock},eats}));
},120000);

import {humanHarvest,humanPack} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {T0} from './helpers/g1b-kit';
it('a personal meal uses two physical hand strikes; distant, full and depleted attempts release nothing',()=>{
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,hw=r.humanWorld!,h=hw.people.h1m,x=1828,y=1831;const at=()=>globalSourceAt(r,x,y,0,T0)!;
 expect(at().key).toBe('bush');h.floor=0;h.gx=x+12;h.gy=y;
 const act=()=>humanHarvest(r,hw,h,x,y,T0,true,true);const initial=at().stock;
 expect(act().result).toBe('blocked');const nav=humanNavigation(r);const pos=[[x-1,y],[x+1,y],[x,y+1],[x,y-1]].find(([tx,ty])=>nav.free({tx,ty,floor:0},h,true))!;[h.gx,h.gy]=pos;
 const pack=humanPack(r,h),slots=pack.slots;pack.slots=slots.map((_,i)=>({uid:`full-${i}`,key:'stone',qty:40}));expect(act().result).toBe('blocked');expect(at().stock).toBe(initial);pack.slots=slots;
 const dur=h.equip.weapon?.dur;expect(act()).toMatchObject({result:'yield',got:0});expect(act()).toMatchObject({result:'yield',got:1});expect(at().stock).toBe(initial-1);expect(h.equip.weapon?.dur).toBe(dur);
 for(let i=0;i<initial*2&&at().stock>0;i++)act();expect(at().stock).toBe(0);expect(act().result).toBe('empty');
});
