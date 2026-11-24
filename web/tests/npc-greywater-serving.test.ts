import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {selectSnapshots} from '../src/game/persist';
import {C,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {settle} from '../src/game/sim';

// Optional matched replay of the original (pre-access) seed-7606 h8 save.
// Do not transplant h2, edit the pantry, or synthesize medicine/food.
const path=process.env.SOH_GREYWATER_H8;
it.skipIf(!path)('credits the same three physical berry servings to the same thirsty Greywater mechanic',()=>{
 const gs=selectSnapshots([readFileSync(path!,'utf8')]).gs!,r=gs.run!,hw=r.humanWorld!,h=hw.people.h2;
 expect(setActiveLayout(r.layoutId!)).toBe(true);expect(r.seed).toBe(7606);const start=r.startedAt+8*3600000;expect(r.clock.lastSimAt).toBe(start);
 const stock=C(r,hw.communities[h.community!].storeContainers[0]),lot=stock.slots.find(s=>s?.uid==='s160')!;
 expect(lot).toMatchObject({key:'berries',qty:24});const before={hunger:h.hunger,thirst:h.thirst};
 beginReceiptSink();let events;try{settle(gs,start+60000,true);}finally{events=endReceiptSink();}
 const uses=events.filter(e=>e.kind==='human.consume').map(e=>({at:e.at-start,...JSON.parse(e.detail)})).filter(e=>e.uid===lot.uid);
 expect(uses.every(e=>e.qty===1&&e.containerId===stock.id)).toBe(true);expect(24-lot.qty).toBe(uses.length);expect(uses.filter(e=>e.actorId==='h2')).toHaveLength(3);
 expect(h.thirst-before.thirst).toBeCloseTo(12,0);expect(h.hunger-before.hunger).toBeCloseTo(24,0);expect(r.qaUsed).toBeFalsy();
 console.log('GREYWATER_SERVING',JSON.stringify({before,after:{hunger:h.hunger,thirst:h.thirst},uses,stockAfter:lot.qty}));
});
