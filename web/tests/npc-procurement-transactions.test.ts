import {describe,it,expect} from 'vitest';
import {newGame,startRun,C,beginReceiptSink,endReceiptSink,findRunEntity} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {equipHumanTool} from '../src/game/humanworld';
import {humanEntityTile,moveHumanGoods} from '../src/game/human-jobs';
import {observeRecipeSources,serviceRecipeBoard,communityFoodDeficit,requestedSourceReports} from '../src/game/human-procurement';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs;}
describe('procurement transaction fixtures (NOT natural completion)',()=>{
 it('equips and unequips the existing UID, rejects claims/broken tools/incapacity, survives reload',()=>{
  const gs=scene(),r=gs.run!,h=r.humanWorld!.people.h11,pack=C(r,h.inv.packId),knife=pack.slots.find(s=>s?.key==='knife')!,uid=knife.uid;
  expect(h.equip.weapon).toBeNull();expect(equipHumanTool(r,h,uid,T0)).toBe(true);expect(h.equip.weapon).toBe(knife);expect(pack.slots.some(s=>s?.uid===uid)).toBe(false);
  expect(equipHumanTool(r,h,uid,T0)).toBe(false);expect(equipHumanTool(r,h,undefined,T0)).toBe(true);expect(pack.slots.find(s=>s?.uid===uid)).toBe(knife);expect(h.equip.weapon).toBeNull();
  knife.dur=0;expect(equipHumanTool(r,h,uid,T0)).toBe(false);knife.dur=300;knife.production={jobId:'fixture-other-claim',workerId:'other'};expect(equipHumanTool(r,h,uid,T0)).toBe(false);delete knife.production;
  h.state='DOWNED';expect(equipHumanTool(r,h,uid,T0)).toBe(false);h.state='IDLE';expect(equipHumanTool(r,h,uid,T0)).toBe(true);
  const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).toBeTruthy();const lh=loaded.run!.humanWorld!.people.h11;expect(lh.equip.weapon?.uid).toBe(uid);expect(C(loaded.run!,lh.inv.packId).slots.some(s=>s?.uid===uid)).toBe(false);
 });
 it('requires reached authorized board and carries bounded canonical knowledge, finite cloth and water only once',()=>{
  const gs=scene(),r=gs.run!,hw=r.humanWorld!,cook=hw.people.hv,worker=hw.people.h11,c=hw.communities[cook.community!],e=findRunEntity(r,c.storeEntityId)!;
  observeRecipeSources(r,cook,T0);expect(cook.recipeSourceReports?.some(p=>p.key==='road_fuel_rack')).toBe(true);
  expect(serviceRecipeBoard(r,hw,cook,T0)).toBe(false);expect(c.foodRequest).toBeUndefined();expect(c.recipeSourceReports).toBeUndefined();
  // Contact/setup is explicit controlled fixture positioning; no goods/station granted.
  const [gx,gy]=humanEntityTile(r,e);cook.gx=gx+1;cook.gy=gy;cook.floor=e.floor??0;
  beginReceiptSink();expect(serviceRecipeBoard(r,hw,cook,T0+1)).toBe(true);expect(c.foodRequest?.recipe).toBe('jam');expect(c.recipeSourceReports?.some(p=>p.key==='road_fuel_rack')).toBe(true);
  expect(communityFoodDeficit(r,hw,worker)).toEqual([]);expect(requestedSourceReports(r,hw,worker)).toEqual([]);
  const cloth=C(r,worker.inv.packId).slots.find(s=>s?.key==='cloth')!,clothQty=cloth.qty;expect(serviceRecipeBoard(r,hw,worker,T0+2)).toBe(false);expect(cloth.qty).toBe(clothQty);
  worker.gx=gx;worker.gy=gy+1;worker.floor=e.floor??0;
  // Full store blocks admission without losing cloth; move finite water to free
  // capacity through the same reached-board duty-ration transfer on service.
  expect(serviceRecipeBoard(r,hw,worker,T0+3)).toBe(true);expect(worker.recipeKnownRequestId).toBe(c.foodRequest!.id);expect(requestedSourceReports(r,hw,worker).some(p=>p.key==='road_fuel_rack')).toBe(true);
  expect(C(r,worker.inv.packId).slots.filter(s=>s?.key==='cloth').reduce((n,s)=>n+s!.qty,0)).toBe(clothQty-1);
  const after=JSON.stringify([C(r,worker.inv.packId).slots,C(r,e.c!).slots]);expect(serviceRecipeBoard(r,hw,worker,T0+3)).toBe(true);expect(JSON.stringify([C(r,worker.inv.packId).slots,C(r,e.c!).slots])).toBe(after);
  const events=endReceiptSink();expect(events.filter(e=>e.kind==='human.procurement.contribute')).toHaveLength(1);
  const transfer=JSON.parse(events.find(e=>e.kind==='human.procurement.contribute')!.detail!);expect(transfer.from[0].uid).toBe(cloth.uid);expect(transfer.qty).toBe(1);expect(transfer.received.reduce((n:number,s:{qty:number})=>n+s.qty,0)).toBe(1);
  const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).toBeTruthy();const lr=loaded.run!,lh=lr.humanWorld!.people.h11;expect(serviceRecipeBoard(lr,lr.humanWorld!,lh,T0+4)).toBe(true);expect(C(lr,lh.inv.packId).slots.filter(s=>s?.key==='cloth').reduce((n,s)=>n+s!.qty,0)).toBe(clothQty-1);
  // Ownership revocation denies even exact contact.
  e.owner='player';expect(serviceRecipeBoard(r,hw,worker,T0+5)).toBe(false);
 });
});
