import { TILE, type RunState } from './core';
import { CREATURES } from './catalog';
import { clearPhysicalLine } from './engine';
import { humanCanUseEntity, isGuardPost } from './human-jobs';
import type { HumanRecord } from './humanworld';

type Point={x:number;y:number};
/** Local field cue, not an alarm feed. Don't reveal another floor, an unseen
 * target, a stale assignment, or the position of an archived guard/post. */
export function watchCue(r:RunState,h:HumanRecord,body:Point,now:number){
  if(!r.humanWorld || h.occupation!=='guard'||h.following||h.transit||r.player.dead||h.floor!==(r.veyraFloor??0)||
    !['WORKING','MOVING','FIGHTING','IDLE'].includes(h.state)||Math.hypot(r.player.x-body.x,r.player.y-body.y)>9*TILE)return;
  const intent=h.intent,alarm=intent?.watchResponse,task=intent?.work;
  const id=alarm?.postId??(task?.kind==='guard'&&!task.itemUid?task.entityId:h.guardedEntityId);
  const post=id?r.entities[id]:undefined;
  if(!isGuardPost(r.humanWorld,h,post)||(post.floor??0)!==h.floor||!clearPhysicalLine(r,r.player,body,false,true))return;
  const site=post.id===r.humanWorld.communities[h.community!].storeEntityId?'store':'gate';
  const fight=!!alarm&&intent?.kind==='fight',returning=!!alarm&&intent?.kind==='work'&&h.state!=='WORKING';
  if(!fight&&!returning && (!(h.state==='WORKING'&&task?.kind==='guard'&&!task.itemUid || h.state==='IDLE'&&now-(h.lastWatchAt??0)<=3000)||!humanCanUseEntity(r,h,post)))return;
  const m=fight?r.creatures.find(m=>m.id===alarm.enemyId && m.state!=='dead' && (m.floor??0)===h.floor):undefined;
  const target=m&&clearPhysicalLine(r,r.player,m,true)?m:undefined;
  return {body,post:clearPhysicalLine(r,r.player,post,false,true)?post:undefined,target,
    priority:fight?2:returning?1:0,label:fight?(target?`Guard: ${CREATURES[target.type]?.name??'Hostile'}!`:'Guard: Trouble!'):
      returning?`Guard: Back to ${site}`:`Guard: ${site==='store'?'Store':'Gate'} watch`};
}
export function drawWatchCue(g:CanvasRenderingContext2D,cue:NonNullable<ReturnType<typeof watchCue>>){
  const x=Math.round(cue.body.x),y=Math.round(cue.body.y)-32,tint=cue.priority===2?'#ffbf72':'#a4e5d3';
  g.save();g.font='bold 11px sans-serif';g.textAlign='center';g.textBaseline='bottom';
  const width=Math.ceil(g.measureText(cue.label).width)+10;
  g.fillStyle='#12212b';g.fillRect(x-Math.ceil(width/2),y-14,width,14);g.fillRect(x-1,y,3,3);
  g.fillStyle=tint;g.fillText(cue.label,x,y-1);
  // The pennant is anchored to the post, not the returning body. The two
  // orange ticks identify the living target rather than all nearby wildlife.
  if(cue.post){const px=Math.round(cue.post.x)+6,py=Math.round(cue.post.y)-6;
    g.fillStyle='#162731';g.fillRect(px-1,py-10,2,10);g.fillRect(px,py-10,8,6);g.fillStyle='#a4e5d3';g.fillRect(px,py-9,6,3);}
  if(cue.target){const tx=Math.round(cue.target.x)+10,ty=Math.round(cue.target.y)-9;g.fillStyle='#26171d';g.fillRect(tx-1,ty-1,5,9);g.fillStyle=tint;g.fillRect(tx,ty,3,4);g.fillRect(tx,ty+6,3,1);}
  g.restore();
}
