// Controlled transaction/negative fixtures; natural selection is tested separately.
import {it,expect} from 'vitest';
import {newGame,startRun,C,mkStack,findRunEntity,harvestHit,sourceAt,globalSourceAt,markDirty} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {depositHumanOutputs,humanHarvest,humanConsume} from '../src/game/humanworld';
import {humanEntityTile} from '../src/game/human-jobs';
import {humanNavigation} from '../src/game/human-navigation';
import {ITEMS,SOURCES} from '../src/game/catalog';
import {T} from '../src/game/core';
import {FRAME_W} from '../src/veyra05/frame';
import {validate} from '../src/game/persist';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs;}
function delivery(){const gs=scene(),r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people)[0],comm=hw.communities[h.community!],store=findRunEntity(r,comm.storeEntityId)!;const [gx,gy]=humanEntityTile(r,store),nav=humanNavigation(r);
 const bank=[[gx+1,gy],[gx-1,gy],[gx,gy+1],[gx,gy-1]].find(([tx,ty])=>nav.free({tx,ty,floor:0},h,true))!;
 h.gx=bank[0];h.gy=bank[1];h.floor=0;h.state='IDLE';C(r,h.inv.packId).slots.fill(null);const s=mkStack(r,'berries',3);C(r,h.inv.packId).slots[0]=s;h.workOutputs={[s.uid]:3};h.workOutputSources={[s.uid]:{sourceId:'fixture-source',jobId:'fixture-job'}};
 return {gs,r,hw,h,comm,store,s};}
it('only the physically reached container receives cargo; partial merging records exact lineage and never replays',()=>{
 const {gs,r,h,comm,store,s}=delivery(),dst=C(r,store.c!);const receiver=mkStack(r,s.key,ITEMS[s.key].max-1);dst.slots=[receiver];
 comm.storeContainers.unshift('inv');const inv=JSON.stringify(C(r,'inv'));
 depositHumanOutputs(r,h,T0);expect(s.qty).toBe(2);expect(h.workOutputs![s.uid]).toBe(2);expect(receiver.qty).toBe(ITEMS[s.key].max);expect(JSON.stringify(C(r,'inv'))).toBe(inv);
 const lineage=Object.values(comm.cargoLedger!).flat();expect(lineage).toMatchObject([{fromUid:s.uid,intoUid:receiver.uid,qty:1,sourceId:'fixture-source'}]);
 const snapshot=JSON.stringify(r.custody);depositHumanOutputs(r,h,T0);expect(JSON.stringify(r.custody)).toBe(snapshot);
 comm.storeContainers.shift();
 const loaded=validate(JSON.parse(JSON.stringify(gs)))!;expect(loaded).not.toBeNull();const lh=loaded.run!.humanWorld!.people[h.actorId];depositHumanOutputs(loaded.run!,lh,T0);expect(C(loaded.run!,h.inv.packId).slots[0]!.qty).toBe(2);
});
it('wrong floor, distance, incapacitation, changed owner and physical walls deny delivery without debiting pack',()=>{
 const {r,h,comm,store,s}=delivery();C(r,store.c!).slots=[null];const p=[h.gx,h.gy];
 for(const change of [()=>h.floor=1,()=>{h.floor=0;h.gx+=10;},()=>{h.gx=p[0];h.state='DOWNED';},()=>{h.state='IDLE';store.owner='another';}]){change();depositHumanOutputs(r,h,T0);expect(s.qty).toBe(3);expect(C(r,store.c!).slots[0]).toBeNull();}
 store.owner=h.community;const o=r.sourceMap!.veyra!.originAu,lx=h.gx-o[0]*2,ly=h.gy-o[1]*2;
 r.terrain[ly*200+lx]={t:T.PWALL,until:r.clock.simMs+1};markDirty();depositHumanOutputs(r,h,T0);expect(s.qty).toBe(3);expect(C(r,store.c!).slots[0]).toBeNull();
 r.clock.simMs+=1;markDirty();depositHumanOutputs(r,h,T0+1);expect(C(r,h.inv.packId).slots[0]).toBeNull();expect(C(r,store.c!).slots[0]!.uid).toBe(s.uid);

});
it('player and two NPCs race one actual plant unit in all first-claim orders without duplicate output',()=>{
 for(const first of ['player','npc-a','npc-b']){
 const gs=scene(),r=gs.run!,hw=r.humanWorld!,[a,b]=Object.values(hw.people),w=getWorld(),o=r.sourceMap!.veyra!.originAu,nav=humanNavigation(r);let hit:{x:number;y:number;bx:number;by:number}|undefined;
 search:for(let i=0;i<w.sourceV3.length;i++){const k=w.sourceV3[i];if(!k||SOURCES[k].mat!=='plant')continue;const x=i%200,y=Math.floor(i/200),gx=o[0]*2+x,gy=o[1]*2+y;if(globalSourceAt(r,gx,gy,0,T0)?.protected)continue;
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(nav.free({tx:gx+dx,ty:gy+dy,floor:0},a,true)){hit={x,y,bx:gx+dx,by:gy+dy};break search;}}
 expect(hit).toBeTruthy();const p=hit!,i=p.y*200+p.x,gx=o[0]*2+p.x,gy=o[1]*2+p.y;r.sources[i]={stock:1,hp:1};markDirty();
 for(const h of [a,b]){h.gx=p.bx;h.gy=p.by;h.floor=0;h.state='IDLE';h.equip.weapon=null;h.stamina=100;C(r,h.inv.packId).slots.fill(null);}
 const outcomes:Record<string,number>={};for(const actor of [first,...['player','npc-a','npc-b'].filter(id=>id!==first)]){
 const res=actor==='player'?harvestHit(gs,p.x,p.y,{plant:1},T0,(p.bx-o[0]*2+.5)*16,(p.by-o[1]*2+.5)*16):humanHarvest(r,hw,actor==='npc-a'?a:b,gx,gy,T0,true);outcomes[actor]=res.got??0;}
 expect(Object.values(outcomes).filter(q=>q>0)).toHaveLength(1);expect(outcomes[first]).toBeGreaterThan(0);expect(sourceAt(r,p.x,p.y,T0)!.stock).toBe(0);
 }
});
