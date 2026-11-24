import {it,expect} from 'vitest';
import {newGame,startRun,blockGrid,beginReceiptSink,endReceiptSink} from '../src/game/engine';
import {humanCanUseEntity} from '../src/game/human-jobs';
import {settle,tick} from '../src/game/sim';
import {validate} from '../src/game/persist';
import {setActiveLayout} from '../src/game/world';
import {TILE,WW,WH,type RunState} from '../src/game/core';
import {T0} from './helpers/g1b-kit';

// Only the player's walking keys are scripted. Use a walkway on the dry side
// of the pier; do not write positions, aggro, damage, guard intents or gear.
function walkToPier(r:RunState,goal:number){
 const grid=blockGrid(r),start=Math.floor(r.player.y/TILE)*WW+Math.floor(r.player.x/TILE);
 const via=new Map([[start,-1]]),queue=[start];
 for(let i=0;i<queue.length&&!via.has(goal);i++)for(const d of [-WW,-1,1,WW]){
   const n=queue[i]+d;if(n<0||n>=WW*WH||via.has(n)||grid[n]!==0||Math.abs(n%WW-queue[i]%WW)>1)continue;
   via.set(n,queue[i]);queue.push(n);
 }
 expect(via.has(goal)).toBe(true);const path:number[][]=[],[ax,ay]=r.sourceMap!.veyra!.originAu;
 for(let n=goal;n!==start;n=via.get(n)!)path.unshift([n%WW+ax*2,Math.floor(n/WW)+ay*2]);return path;
}
it('a walk to Mere Pier draws a generated ooze; the posted guard intercepts it and returns after Continue',()=>{
 setActiveLayout('veyra05-world');let gs=newGame();expect(startRun(gs,'female',T0,null,7542).ok).toBe(true);
 const r=()=>gs.run!,comm=r().humanWorld!.communities['com:po_mere'],pid=comm.storeEntityId!,id=comm.memberIds.find(id=>r().humanWorld!.people[id].occupation==='guard')!;
 const guard=()=>r().humanWorld!.people[id],post=()=>r().entities[pid];
 const wildlife=r().creatures.find(m=>m.type==='slime_2'&&Math.hypot(m.x-post().x,m.y-post().y)<8*TILE)!;
 expect(wildlife.state).not.toBe('attack');const mid=wildlife.id,monster=()=>r().creatures.find(m=>m.id===mid);
 const path=walkToPier(r(),(post().ty!+4)*WW+post().tx!+1),weapon=guard().equip.weapon!,initialDur=weapon.dur!;
 const hits:{ms:number;hp:number;dur:number;gx:number;gy:number}[]=[];let index=0,job='',saved=0,dead=false,trace:ReturnType<typeof endReceiptSink>;
 beginReceiptSink();try{
   for(let s=2;s<=8;s+=2)settle(gs,T0+s*1000,true);
   for(let ms=8050;ms<=60000;ms+=50){
     const [ax,ay]=r().sourceMap!.veyra!.originAu,px=r().player.x/TILE+ax*2,py=r().player.y/TILE+ay*2;
     if(index<path.length && Math.abs(path[index][0]+.5-px)<.15 && Math.abs(path[index][1]+.5-py)<.15)index++;
     const [dx,dy]=index<path.length?[path[index][0]+.5-px,path[index][1]+.5-py]:[0,0];
     const hp=monster()?.hp,dur=guard().equip.weapon?.dur;
     tick(gs,{up:dy<-.14,down:dy>.14,left:dx<-.14,right:dx>.14,attack:false,attackPressed:false,roll:false,cancel:false,mx:0,my:0},50,T0+ms);
     const h=guard(),m=monster();if(m?.state==='dead')dead=true;
     if(m && hp!==undefined && m.hp<hp){expect(h.intent?.target).toBe(mid);expect(h.equip.weapon?.dur).toBe(dur!-1);hits.push({ms,hp:m.hp,dur:dur!-1,gx:h.gx,gy:h.gy});}
     if(!saved && hits.length===1 && h.intent?.watchResponse){
       expect(humanCanUseEntity(r(),h,post())).toBe(false);saved=ms;job=h.intent.intentId;
       gs=validate(JSON.parse(JSON.stringify(gs)))!;expect(gs).toBeTruthy();expect(guard().intent).toMatchObject({intentId:job,watchResponse:{postId:pid,enemyId:mid}});expect(monster()?.hp).toBe(hits[0].hp);
     }
     if(saved && dead && h.lastWatchAt!>T0+saved && h.guardedEntityId===pid)break;
   }
 }finally{trace=endReceiptSink().filter(e=>e.kind.startsWith('human.guard.')&&e.detail.includes(id));}
 expect(index).toBe(path.length);expect(dead).toBe(true);expect(saved).toBeGreaterThan(0);expect(r().qaUsed).toBe(false);
 expect(trace.map(e=>e.kind)).toEqual(['human.guard.duty','human.guard.alert','human.guard.recall','human.guard.duty']);
 expect(trace[0].detail).toContain(pid);expect(trace.slice(1).every(e=>e.detail.includes(job)&&e.detail.includes(pid))).toBe(true);
 expect(trace[3].at-trace[2].at).toBeGreaterThan(8000);expect(humanCanUseEntity(r(),guard(),post())).toBe(true);
 expect(guard().equip.weapon).toMatchObject({uid:weapon.uid,dur:initialDur-hits.length});
 console.log('NATURAL_GUARD',JSON.stringify({seed:r().seed,start:T0,guard:id,post:pid,enemy:mid,enemyType:wildlife.type,initialHp:wildlife.maxHp,playerSteps:path.length,weapon:weapon.uid,initialDur,saved,hits,returned:[guard().gx,guard().gy,guard().floor],trace}));
},180000);
