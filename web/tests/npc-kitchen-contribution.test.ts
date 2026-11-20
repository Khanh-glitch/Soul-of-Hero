import {expect,it} from 'vitest';
import {C,dispatch,kitchenShortfall,mkStack,newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
it('requires the actual last ingredient at the live warehouse; refusals leave both inventories untouched',()=>{
 // Controlled inventory/position fixtures, not evidence of a hunt or garden harvest.
 setActiveLayout('veyra05-hook');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=gs.run!,c=r.humanWorld!.communities['com:po_hook'],e=r.entities[c.storeEntityId!],stock=C(r,e.c!),bag=C(r,'inv');r.player.x=e.x;r.player.y=e.y+16;
 stock.slots[10]=mkStack(r,'crop',3);const meat=mkStack(r,'meat',2);bag.slots[5]=meat;
 const cmd={id:'gift',type:'kitchenContribution',eid:e.id,recipe:'stew',stackUid:meat.uid};const refuse=()=>{
   const before=JSON.stringify([bag,stock,r.receipts,r.nextId]);expect(dispatch(gs,cmd,T0).ok).toBe(false);expect(JSON.stringify([bag,stock,r.receipts,r.nextId])).toBe(before);};
 expect(kitchenShortfall(r,e)).toEqual({recipe:'stew',key:'meat',qty:1});cmd.stackUid='changed';refuse();cmd.stackUid=meat.uid;
 meat.production={jobId:'other',workerId:'other'};refuse();delete meat.production;
 const hp=e.hp;e.hp=0;refuse();e.hp=hp;e.owner='player';refuse();e.owner=c.id;e.floor=1;refuse();e.floor=0;
 stock.slots[11]=mkStack(r,'stone',1);refuse(); // full, no mergeable pair of co-ingredients
 const herb=stock.slots.find(s=>s?.key==='herb')!,other=mkStack(r,'herb',1);stock.slots[11]=other;
 const row={at:T0,jobId:'j',workerId:'hn',qty:1,key:'herb'};c.cargoLedger={[herb.uid]:[{...row,fromUid:herb.uid,intoUid:herb.uid}],[other.uid]:[{...row,fromUid:other.uid,intoUid:other.uid}]};refuse();
 delete c.cargoLedger[other.uid];expect(dispatch(gs,cmd,T0).ok).toBe(true);expect(stock.slots).toHaveLength(12);expect(stock.slots.filter(s=>s?.key==='herb')).toEqual([herb]);expect(herb.qty).toBe(4);expect(meat.qty).toBe(1);
 expect(dispatch(gs,{...cmd,id:'again'},T0).ok).toBe(false);expect(meat.qty).toBe(1);
 expect(dispatch(gs,{id:'take',type:'move',from:stock.id,to:'inv',fs:11},T0).ok).toBe(false);
});
