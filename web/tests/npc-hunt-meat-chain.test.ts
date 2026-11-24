import {expect,it} from 'vitest';
import {newGame,startRun,clearPhysicalLine} from '../src/game/engine';
import {stepHumans,stepHumanCombat} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {planHumanOccupation} from '../src/game/human-jobs';
import {serviceRecipeBoard} from '../src/game/human-procurement';
import {damageCreature} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';

it('only a lethal guard strike drops meat, then the guard moves that UID into village custody',()=>{
  setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);
  const r=gs.run!,hw=r.humanWorld!,guard=Object.values(hw.people).find(h=>h.occupation==='guard')!,c=hw.communities[guard.community!];
  const [sx,sy]=c.storeTile!,[ax,ay]=r.sourceMap!.veyra!.originAu,px=(x:number)=>(x-ax*2+.5)*16,py=(y:number)=>(y-ay*2+.5)*16;
  const nav=humanNavigation(r);const bank=[[sx-1,sy],[sx+1,sy],[sx,sy-1],[sx,sy+1]].find(([x,y])=>nav.free({tx:x,ty:y,floor:0},guard)&&clearPhysicalLine(r,{x:px(x),y:py(y)},{x:px(sx),y:py(sy)},true,true))!;
  [guard.gx,guard.gy]=bank;guard.floor=0;expect(serviceRecipeBoard(r,hw,guard,T0)).toBe(true);
  const wolf={...r.creatures[0],id:'hunt-wolf',type:'wolf',state:'chase' as const,x:px(guard.gx)+1,y:py(guard.gy),floor:0 as const,hp:100,maxHp:100,elder:undefined,sideBoss:undefined,husbandry:undefined};r.creatures.push(wolf);
  guard.state='FIGHTING';guard.intent={intentId:'defend',actorId:guard.actorId,kind:'fight',target:wolf.id,reserved:[],preconditions:[],startAt:T0,dueAt:T0};
  const strike=(now:number)=>stepHumanCombat(r,hw,now,(m,dmg,a,h)=>damageCreature(gs,m,dmg,a,now,130,h.actorId));
  strike(T0+1000);expect(wolf.hp).toBe(100);strike(guard.intent!.swing!.contactAt);expect(wolf.hp).toBeLessThan(100);expect(wolf.hp).toBeGreaterThan(0);expect(guard.gameDrop).toBeUndefined();
  wolf.hp=1;strike(T0+5000);strike(T0+6000);expect(wolf.state).toBe('dead');const claim=guard.gameDrop!;expect(claim.creatureId).toBe(wolf.id);
  const drop=r.entities[claim.entityId];expect(r.custody[drop.c!].slots[0]?.uid).toBe(claim.stackUid);
  stepHumans(r,hw,T0+6100);expect(guard.state).toBe('IDLE');
  expect(planHumanOccupation(r,hw,guard,T0+6200,(tx,ty,floor)=>nav.route(guard,{tx,ty,floor}))).toBe(true);
  for(let t=8000;t<=60000;t+=2000){stepHumans(r,hw,T0+t);if(Object.values(c.cargoLedger??{}).flat().some(v=>v.fromUid===claim.stackUid))break;}
  expect(r.entities[drop.id]).toBeUndefined();expect(r.custody[drop.c!]).toBeUndefined();
  const delivery=Object.values(c.cargoLedger??{}).flat().filter(v=>v.sourceId===wolf.id);expect(delivery).toHaveLength(1);
  expect(delivery[0].fromUid).toBe(claim.stackUid);expect(r.custody[c.storeContainers[0]].slots.find(s=>s?.uid===delivery[0].intoUid)?.key).toBe('meat');
},90000);
