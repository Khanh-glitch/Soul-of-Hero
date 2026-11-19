import {expect,it} from 'vitest';
import {findRunEntity,newGame,startRun} from '../src/game/engine';
import {humanNavigation} from '../src/game/human-navigation';
import {humanCanUseEntity,planHumanOccupation} from '../src/game/human-jobs';
import {stepHumans} from '../src/game/humanworld';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
function ruin(){setActiveLayout('veyra05-greywater');const gs=newGame();startRun(gs,'female',T0,null,7606,{tx:100,ty:100});const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.occupation==='builder')!,comm=hw.communities[h.community!],store=findRunEntity(r,comm.storeEntityId)!;store.hp=0;const nav=humanNavigation(r);const plan=()=>planHumanOccupation(r,hw,h,T0+100,(tx,ty,floor)=>nav.route(h,{tx,ty,floor},4000));return {r,hw,h,store,plan};}
it('braces the collapsed store on site with two real carried wood; same custody reopens',()=>{const {r,hw,h,store,plan}=ruin(),wood=r.custody[h.inv.packId].slots.find(s=>s?.key==='wood')!,before=wood.qty,contents=JSON.stringify(r.custody[store.c!]);expect(humanCanUseEntity(r,h,store)).toBe(false);expect(plan()).toBe(true);expect(h.intent?.work?.entityId).toBe(store.id);
 for(let i=1;i<200&&store.hp===0;i++)stepHumans(r,hw,T0+i*2000);expect(store.hp).toBe(store.maxHp);expect(wood.qty).toBe(before-2);expect(humanCanUseEntity(r,h,store)).toBe(true);expect(JSON.stringify(r.custody[store.c!])).toBe(contents);expect(r.receipts.some(q=>q.kind==='human.store.rebuilt')).toBe(true);},90000);
it('no wood or a lost load means no reconstruction and no phantom stock',()=>{const {r,hw,h,store,plan}=ruin();const pack=r.custody[h.inv.packId];expect(plan()).toBe(true);pack.slots[pack.slots.findIndex(s=>s?.key==='wood')]=null;const before=JSON.stringify(r.custody[store.c!]);for(let i=1;i<200&&h.intent?.work?.entityId===store.id;i++)stepHumans(r,hw,T0+i*2000);expect(store.hp).toBe(0);expect(h.lastWorkBlock).toMatch(/wood/);expect(JSON.stringify(r.custody[store.c!])).toBe(before);},90000);
