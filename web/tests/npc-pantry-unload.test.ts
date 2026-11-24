import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {it,expect} from 'vitest';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {depositHumanOutputs} from '../src/game/humanworld';
import {consolidatePantry} from '../src/game/human-pantry';
import type {Container} from '../src/game/core';

// Exact h8 live-world lots; exercise the arrival transaction, not a claim
// that the player or the old scheduler selected a new intent in this test.
const bytes=gunzipSync(readFileSync('evidence/npc-integration/coast-62c9dae/h8.save.gz')).toString();
function scene(){
 const gs=selectSnapshots([bytes]).gs!,r=gs.run!,hw=r.humanWorld!,h=hw.people.hm,c=hw.communities[h.community!];
 expect(setActiveLayout(r.layoutId!)).toBe(true);return {gs,r,hw,h,c,bin:r.custody[c.storeContainers[0]],pack:r.custody[h.inv.packId],now:r.clock.lastSimAt};
}
it('unloads the paid Hook meal at the full pantry; reload and repeated arrival cannot unload it again',()=>{
 const {gs,r,h,bin,pack,now}=scene();const meal=pack.slots.find(s=>s?.uid==='saha')!;
 expect(meal.production).toMatchObject({jobId:'jah5',workerId:'hm',recipe:'grilled_mushroom'});
 expect(bin.slots).not.toContain(null);expect(h.workOutputs?.[meal.uid]).toBe(1);
 const n=bin.slots.length,herbs=()=>bin.slots.reduce((n,s)=>n+(s?.key==='herb'?s.qty:0),0);const qty=herbs();
 depositHumanOutputs(r,h,now);
 const repack=r.receipts.find(v=>v.kind==='human.pantry.repack');expect(repack).toBeTruthy();
 expect(JSON.parse(repack!.detail)).toMatchObject({actor:'hm',meal:'saha',containerId:bin.id,fromUid:'s1a5',intoUid:'s2uk',key:'herb',qty:3});
 expect(bin.slots).toHaveLength(n);expect(herbs()).toBe(qty);expect(bin.slots.find(s=>s?.uid===meal.uid)).toMatchObject({key:meal.key,qty:1});expect(pack.slots.some(s=>s?.uid===meal.uid)).toBe(false);
 expect(h.deliveryWait).toBeUndefined();expect(h.workOutputs?.[meal.uid]).toBeUndefined();
 const after=selectSnapshots([serializeSnapshot(gs)]).gs!.run!,before=JSON.stringify(after.custody);depositHumanOutputs(after,after.humanWorld!.people.hm,now);
 expect(JSON.stringify(after.custody)).toBe(before);expect(after.humanWorld!.communities[h.community!].cargoLedger?.[meal.uid]).toHaveLength(1);
});
it('keeps a paid meal in the pack when out of contact or when the entire pantry is committed',()=>{
 const {r,h,hw,c,bin,pack,now}=scene(),stock=JSON.stringify(bin.slots),cargo=JSON.stringify(pack.slots),x=h.gx;
 h.gx+=10;depositHumanOutputs(r,h,now);h.gx=x;
 expect(JSON.stringify(bin.slots)).toBe(stock);expect(JSON.stringify(pack.slots)).toBe(cargo);
 // A competing worker names all lots in this negative case. The receiving
 // cook may neither discard them nor override the reservations to make room.
 const worker=hw.people.hl;worker.intent={intentId:'fixture-wait',actorId:worker.actorId,kind:'work',startAt:now,dueAt:now+1000,preconditions:[],reserved:bin.slots.map(s=>s!.uid)};
 depositHumanOutputs(r,h,now);expect(JSON.stringify(bin.slots)).toBe(stock);expect(JSON.stringify(pack.slots)).toBe(cargo);expect(h.deliveryWait?.containerId).toBe(bin.id);
 const small:Container={...bin,slots:[{uid:'a',key:'herb',qty:1},{uid:'b',key:'herb',qty:1}]};
 c.cargoLedger={transfer:[{jobId:'fixture',workerId:h.actorId,at:now,fromUid:'a',intoUid:'b',key:'herb',qty:1}]};
 expect(consolidatePantry(small,c,hw)).toBeUndefined();expect(small.slots.every(Boolean)).toBe(true);
});
