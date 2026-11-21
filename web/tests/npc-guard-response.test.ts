import {it,expect} from 'vitest';
import {newGame,startRun,clearPhysicalLine,mkCreature,markDirty,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {stepHumanCombat} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {humanCanUseEntity} from '../src/game/human-jobs';
import {damageCreature,settle} from '../src/game/sim';
import {CREATURES} from '../src/game/catalog';
import {TILE} from '../src/game/core';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {T0} from './helpers/g1b-kit';
// Away from the player the guard is planned on the first one-second beat (T0+1 s), walks to the post and
// completes the first watch at T0+12.1 s. Every later instant in this file is counted from this checkpoint.
const CP=13000;
function checkpoint(){
 setActiveLayout('veyra05-world');const gs=newGame();expect(startRun(gs,'female',T0,null,7606).ok).toBe(true);const r=gs.run!,hw=r.humanWorld!,comm=hw.communities['com:po_vend_gulf'];
 const h=comm.memberIds.map(id=>hw.people[id]).find(h=>h.occupation==='guard')!,post=r.entities[comm.storeEntityId!];
 for(let sec=2;sec<=12;sec+=2)settle(gs,T0+sec*1000,true);settle(gs,T0+CP,true);expect(h.guardedEntityId).toBe(post.id);expect(h.lastWatchAt).toBeGreaterThan(T0);expect(humanCanUseEntity(r,h,post)).toBe(true);
 return {gs,r,hw,h,post};
}
function encounter(){const {gs,r,hw,h,post}=checkpoint();const [ax,ay]=r.sourceMap!.veyra!.originAu;
 const occupied=new Set(Object.values(hw.people).filter(p=>p!==h).map(p=>`${p.floor}:${p.gx}:${p.gy}`));
 const nav=humanNavigation(r,occupied,true),pos=(x:number,y:number)=>({x:(x-ax*2+.5)*TILE,y:(y-ay*2+.5)*TILE});
 const tile=[[4,0],[-4,0],[0,4],[0,-4],[-3,1],[1,-3]].map(([dx,dy])=>({tx:h.gx+dx,ty:h.gy+dy,floor:h.floor})).find(p=>nav.free(p,h)&&nav.route(h,p)?.length&&clearPhysicalLine(r,pos(h.gx,h.gy),pos(p.tx,p.ty),true));expect(tile).toBeDefined();
 const {x,y}=pos(tile!.tx,tile!.ty);const wolf=mkCreature(r,'wolf',x,y,CREATURES.wolf.hp);wolf.state='chase';wolf.floor=0;r.creatures.push(wolf);
 return {gs,r,hw,h,post,wolf,ax,ay};}
it('autonomously reaches the Gulf market warehouse and watches it on a normal New Game',()=>{const {gs,h,post}=checkpoint();expect(gs.run!.qaUsed).toBe(false);console.log('NATURAL_WATCH',JSON.stringify({seed:gs.run!.seed,guard:h.actorId,post:post.id,at:h.lastWatchAt,gx:h.gx,gy:h.gy}));});
it('responds to a staged wolf, reloads away from the post, and resumes the original watch',()=>{
 const initial=encounter(),id=initial.h.actorId,pid=initial.post.id,mid=initial.wolf.id;let gs=initial.gs;
 const r=()=>gs.run!,h=()=>r().humanWorld!.people[id],wolf=()=>r().creatures.find(m=>m.id===mid)!;
 const start=[h().gx,h().gy],weapon=h().equip.weapon!,dur=weapon.dur!,hits:{at:number;before:number;after:number;gx:number;gy:number}[]=[];
 let saved=0,job='',events:ReturnType<typeof endReceiptSink>;beginReceiptSink();try{
 for(let ms=CP+250;ms<=CP+48000;ms+=250){const now=T0+ms;settle(gs,now,true);
   if(!saved && h().intent?.watchResponse && h().intent?.kind==='fight' && !humanCanUseEntity(r(),h(),r().entities[pid])){
     saved=ms;job=h().intent!.intentId;gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(h().intent).toMatchObject({intentId:job,watchResponse:{postId:pid,enemyId:mid}});
   }
   stepHumanCombat(r(),r().humanWorld!,now,(m,n,a,attacker)=>{const before=m.hp;damageCreature(gs,m,n,a,now,130,attacker.actorId);if(attacker.actorId===id&&m.id===mid)hits.push({at:ms,before,after:m.hp,gx:h().gx,gy:h().gy});});
   if(saved && wolf().state==='dead' && h().lastWatchAt!>T0+saved)break;
 }}finally{events=endReceiptSink();}
 expect(saved).toBeGreaterThan(0);expect(hits.length).toBeGreaterThan(0);expect(hits.at(-1)!.after).toBeLessThanOrEqual(0);expect(h().equip.weapon?.uid).toBe(weapon.uid);expect(h().equip.weapon?.dur).toBe(dur-hits.length);
 expect(h().guardedEntityId).toBe(pid);expect(humanCanUseEntity(r(),h(),r().entities[pid])).toBe(true);
 const trace=events.filter(e=>e.kind.startsWith('human.guard.')&&e.detail.includes(job));expect(trace.map(e=>e.kind)).toEqual(['human.guard.alert','human.guard.recall','human.guard.duty']);expect(trace[2].at-trace[1].at).toBeGreaterThan(8000);expect(r().qaUsed).toBe(false);
 console.log('CONTROLLED_GUARD',JSON.stringify({seed:r().seed,start:T0,post:pid,guard:id,from:start,saved,weapon:weapon.uid,durBefore:dur,durAfter:h().equip.weapon?.dur,hits,trace}));
},120000);
it('does not alert on a passive, out-of-floor, tamed, or occluded creature',()=>{
 const {gs,r,h,wolf,ax,ay}=encounter();wolf.state='wander';settle(gs,T0+CP+1000,true);expect(h.intent?.target).not.toBe(wolf.id);
 wolf.state='chase';wolf.floor=1;settle(gs,T0+CP+2000,true);expect(h.intent?.target).not.toBe(wolf.id);
 wolf.floor=0;wolf.husbandry={tamed:true} as typeof wolf.husbandry;settle(gs,T0+CP+3000,true);expect(h.intent?.target).not.toBe(wolf.id);delete wolf.husbandry;
 const gx=Math.floor(wolf.x/TILE),gy=Math.floor(wolf.y/TILE),tx=gx-Math.sign(gx-h.gx+ax*2),ty=gy-Math.sign(gy-h.gy+ay*2);
 r.entities.shutter={id:'shutter',kind:'door',open:false,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE};markDirty();expect(clearPhysicalLine(r,{x:(h.gx-ax*2+.5)*TILE,y:(h.gy-ay*2+.5)*TILE},wolf,true)).toBe(false);
 settle(gs,T0+CP+4000,true);expect(h.intent?.target).not.toBe(wolf.id);expect(r.receipts.some(e=>e.kind==='human.guard.alert')).toBe(false);
});
it('cancels a pending swing when the wolf disengages and never reports duty at a captured warehouse',()=>{
 const {gs,r,h,hw,post,wolf}=encounter(),last=h.lastWatchAt,dur=h.equip.weapon!.dur;
 let pending=false;beginReceiptSink();let trace:ReturnType<typeof endReceiptSink>;
 try{for(let ms=CP+250;ms<=CP+6000;ms+=100){const now=T0+ms;settle(gs,now,true);stepHumanCombat(r,hw,now);if(!h.intent?.swing)continue;
   pending=true;expect(h.intent.watchResponse?.postId).toBe(post.id);expect(humanCanUseEntity(r,h,post)).toBe(false);
   const bad=JSON.parse(JSON.stringify(gs));bad.run.humanWorld.people[h.actorId].intent.watchResponse.enemyId='other';expect(validate(bad)).toBeNull();
   wolf.state='wander';stepHumanCombat(r,hw,h.intent.swing.contactAt,()=>{throw Error('landed a stale swing');});expect(h.intent.swing).toBeUndefined();
   settle(gs,now+200,true);expect(h.intent?.kind).toBe('work');post.owner='player';settle(gs,now+15000,true);break;
 }}finally{trace=endReceiptSink();}
 expect(pending).toBe(true);expect(h.equip.weapon!.dur).toBe(dur);expect(h.lastWatchAt).toBe(last);expect(trace.filter(e=>e.kind==='human.guard.duty'&&e.detail.includes(h.actorId))).toHaveLength(0);
});
