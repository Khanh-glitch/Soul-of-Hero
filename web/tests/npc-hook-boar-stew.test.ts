import {expect,it} from 'vitest';
import {C,beginReceiptSink,blockGrid,dispatch,endReceiptSink,markDirty,newGame,startRun} from '../src/game/engine';
import {type GameState} from '../src/game/core';
import {validate} from '../src/game/persist';
import {settle,tick} from '../src/game/sim';
import {setActiveLayout} from '../src/game/world';
import {shiftVeyraWindowBy,windowOrigin} from '../src/veyra05/continuity';
import {T0} from './helpers/g1b-kit';

// Driver for ordinary walking and swinging the starter weapon. Follow the
// live animal and then its actual dropped lot; no actor, damage or loot setup.
function hunt(gs:GameState){
 const r=gs.run!,p=r.player;const boar=r.creatures.filter(m=>m.type==='boar'&&!m.husbandry?.tamed).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 expect(boar.hp).toBe(boar.maxHp);const id=boar.id,initial=boar.hp,start=r.clock.lastSimAt;
 let waypoint:number[]|undefined,lastGoal='',path:number[][]=[],uid='',qty=0,drop='',killedAt=0;
 for(let now=start+50;now<=start+90000;now+=50){
   const m=r.creatures.find(m=>m.id===id);if(!m||p.dead)break;
   if(m.state==='dead'&&!uid){const d=Object.values(r.entities).find(e=>e.kind==='drop'&&e.born===r.clock.lastSimAt&&C(r,e.c!).slots[0]?.key==='meat'&&Math.hypot(e.x-m.x,e.y-m.y)<30);
     expect(d).toBeDefined();const lot=C(r,d!.c!).slots[0]!;uid=lot.uid;qty=lot.qty;drop=d!.id;killedAt=r.clock.lastSimAt;}
   if(uid&&C(r,'inv').slots.some(s=>s?.uid===uid&&s.qty===qty))return {id,initial,killedAt,drop,uid,qty,pickedAt:r.clock.lastSimAt};
   const target=(drop&&r.entities[drop])||m,grid=blockGrid(r),from=Math.floor(p.y/16)*200+Math.floor(p.x/16),gx=Math.floor(target.x/16),gy=Math.floor(target.y/16),end=gy*200+gx,goal=`${end}:${windowOrigin(r)}`;
   if(!waypoint||lastGoal!==goal){
     const via=new Map([[from,-1]]),q=[from];let closest=from;
     for(let i=0;i<q.length&&!via.has(end);i++)for(const delta of [-200,-1,1,200]){const n=q[i]+delta;if(via.has(n)||Math.abs(n%200-q[i]%200)>1||![0,4].includes(grid[n]))continue;
       via.set(n,q[i]);q.push(n);if(Math.hypot(n%200-gx,Math.floor(n/200)-gy)<Math.hypot(closest%200-gx,Math.floor(closest/200)-gy))closest=n;}
     path=[];for(let n=via.has(end)?end:closest;n!==from;n=via.get(n)!)path.unshift([n%200+.5,Math.floor(n/200)+.5]);waypoint=path.shift();lastGoal=goal;
   }
   const dist=Math.hypot(p.x-m.x,p.y-m.y),[dx,dy]=dist<18||!waypoint?[(target.x-p.x)/16,(target.y-p.y)/16]:[waypoint[0]-p.x/16,waypoint[1]-p.y/16];const attack=!uid&&dist<24;
   tick(gs,{up:dy<-.13,down:dy>.13,left:dx<-.13,right:dx>.13,attack,attackPressed:attack,cancel:false,roll:false,mx:m.x,my:m.y},50,now);
   if(waypoint&&Math.abs(waypoint[0]-p.x/16)<.17&&Math.abs(waypoint[1]-p.y/16)<.17)waypoint=path.shift();
 }
 throw Error('No physical pickup of the boar lot');
}
it('makes one Hook stew from the first garden lot and a hunted boar; only inter-region travel is staged',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);
 const r=()=>gs.run!,community=()=>r().humanWorld!.communities['com:po_hook'];
 for(let s=30;s<=630;s+=30){settle(gs,T0+s*1000,true);if(s===30)gs=validate(JSON.parse(JSON.stringify(gs)))!;}
 const crop=Object.values(community().cargoLedger??{}).flat().find(row=>row.key==='crop')!;
 expect(crop.qty).toBe(3);expect(crop.fromUid).toBe(crop.intoUid);gs=validate(JSON.parse(JSON.stringify(gs)))!;
 const stock=()=>C(r(),community().storeContainers[0]);expect(stock().slots.find(s=>s?.uid===crop.intoUid)?.qty).toBe(3);
 beginReceiptSink();let trace:ReturnType<typeof endReceiptSink>,saved='',game:ReturnType<typeof hunt>;
 try{
   game=hunt(gs);expect(game.qty).toBe(2);gs=validate(JSON.parse(JSON.stringify(gs)))!;
   // Controlled arrival, NOT a claimed cross-island freight route. Inventory,
   // warehouse, cook, campfire, source and NPC positions remain untouched.
   const [sx,sy]=community().storeTile!,[ox,oy]=windowOrigin(r());shiftVeyraWindowBy(gs,sx-100-ox,sy-100-oy,markDirty);
   const store=r().entities[community().storeEntityId!],start=r().clock.lastSimAt;
   const cmd={id:'hook-boar-kitchen',type:'kitchenContribution',eid:store.id,recipe:'stew',stackUid:game.uid};
   r().player.x=store.x;r().player.y=store.y+5*16;expect(dispatch(gs,cmd,start).ok).toBe(false);
   r().player.y=store.y+16;expect(dispatch(gs,cmd,start).ok).toBe(true);expect(dispatch(gs,cmd,start)).toMatchObject({ok:false,dup:true});
   expect(C(r(),'inv').slots.find(s=>s?.uid===game.uid)?.qty).toBe(1);const bins=stock().slots.length;expect(bins).toBe(12);
   const fireId=community().workStations.find(id=>r().entities[id]?.type==='campfire')!,fire=()=>r().entities[fireId];
   for(let s=2;s<=150;s+=2){settle(gs,start+s*1000,true);const job=fire().station!.queue.find(j=>j.recipe==='stew');
     if(!saved&&job){saved=job.id;gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(fire().station!.queue.find(j=>j.id===saved)?.left).toBe(job.left);expect(dispatch(gs,cmd,start+s*1000)).toMatchObject({ok:false,dup:true});}
     if(saved&&Object.values(r().custody).some(c=>c.slots.some(v=>v?.key==='stew'&&v.production?.jobId===saved)&&c.id!==fire().station!.outC))break;
   }
 }finally{trace=endReceiptSink();}
 expect(saved).toBeTruthy();const rows=(k:string)=>trace.filter(e=>e.kind===k).map(e=>({at:e.at,...JSON.parse(e.detail)}));
 expect(trace.some(e=>e.kind==='creature.kill'&&e.detail===`boar:${game.id}`)).toBe(true);
 const gifts=rows('human.kitchen.contribute');expect(gifts).toHaveLength(1);const gift=gifts[0];expect(gift).toMatchObject({sourceUid:game.uid,qty:1,key:'meat',into:stock().id});
 const pays=rows('human.production.pay').filter(x=>x.jobId===saved);expect(pays).toHaveLength(1);const pay=pays[0];expect(pay.recipe).toBe('stew');
 const withdraw=rows('human.work.input').filter(l=>l.workerId===pay.workerId&&l.containerId===stock().id&&l.inputs.some((v:{uid:string})=>v.uid===crop.intoUid));expect(withdraw).toHaveLength(1);
 const bill=rows('human.work.input').filter(l=>l.orderId===withdraw[0].orderId);expect(bill.map(l=>l.inputs[0].key).sort()).toEqual(['crop','herb','meat']);
 for(const line of bill){expect(line.received).toHaveLength(1);expect(pay.inputs).toContainEqual({...line.received[0],containerId:line.into});}
 expect(bill.find(l=>l.inputs[0].key==='meat').inputs[0]).toEqual({uid:gift.receivedUid,key:'meat',qty:1});expect(withdraw[0].inputs[0].qty).toBe(2);expect(stock().slots.find(s=>s?.uid===crop.intoUid)?.qty).toBe(1);
 const finish=rows('human.production.finish').filter(x=>x.jobId===saved),pickup=rows('human.production.pickup').filter(x=>x.production?.jobId===saved);expect(finish).toHaveLength(1);expect(pickup).toHaveLength(1);
 const packId=r().humanWorld!.people[pay.workerId].inv.packId;expect(finish[0].outputs).toEqual([{uid:pickup[0].uid,key:'stew',qty:1}]);
 expect(pickup[0]).toMatchObject({qty:1,workerId:pay.workerId,containerId:packId,production:{inputs:pay.inputs}});
 expect(C(r(),packId).slots.find(s=>s?.uid===pickup[0].uid)).toMatchObject({key:'stew',qty:1,production:{jobId:saved}});
 // Follow the paid lot without moving the player, reserving a bin, or changing
 // any villager. A route marked FOUND is not a delivery receipt.
 const cook=()=>r().humanWorld!.people[pay.workerId];
 const end=r().clock.lastSimAt+150000;
 while(!cook().deliveryWait && r().clock.lastSimAt<end) settle(gs,r().clock.lastSimAt+2000,true);
 const waiting=()=>{
   const h=cook(),c=stock(),[sx,sy]=community().storeTile!;
   expect(h.deliveryWait?.containerId).toBe(c.id);
   expect(Math.abs(h.gx-sx)+Math.abs(h.gy-sy)).toBeLessThanOrEqual(1);
   expect(c.slots).toHaveLength(12);expect(c.slots.every(Boolean)).toBe(true);
   expect(h.workOutputs?.[pickup[0].uid]).toBe(1);
   expect(C(r(),packId).slots.find(s=>s?.uid===pickup[0].uid)).toMatchObject({key:'stew',qty:1,production:{jobId:saved}});
   expect(Object.values(community().cargoLedger??{}).flat().some(row=>row.jobId===saved)).toBe(false);
   return {at:r().clock.lastSimAt,position:[h.gx,h.gy,h.floor],store:[sx,sy],containerId:c.id,reason:h.lastWorkBlock,occupied:c.slots.filter(Boolean).length,carried:pickup[0].uid};
 };
 const arrival=waiting();gs=validate(JSON.parse(JSON.stringify(gs)))!;waiting();settle(gs,arrival.at+30000,true);const afterReload=waiting();
 console.log('HOOK_STEW_RETURN',JSON.stringify({seed:r().seed,start:T0,jobId:saved,worker:pay.workerId,arrival,afterReload}));
 console.log('HOOK_BOAR_STEW',JSON.stringify({seed:r().seed,start:T0,scope:'player hunt; controlled inter-region arrival; autonomous cooking',crop,game,pack:rows('human.kitchen.repack'),gift,bill,pay,saved,finish,pickup}));
},600000);
