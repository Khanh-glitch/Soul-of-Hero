import { BAL, TILE, type RunState, type Stack } from './core';
import { basicCoreReach } from './core-ray';
import { clearPhysicalLine, coreCastBlock } from './engine';
import type { CoreMode } from './g1b';
import { humanWorldPosition, playerAtSea, type HumanRecord } from './humanworld';

type Point={x:number;y:number};
const storm=BAL.creatorCoreMjolnir;
const modes:CoreMode[]=['basic','refined','signature'];
export function humanCastReach(s:Stack,mode:CoreMode){
  if(mode==='basic')return basicCoreReach(s.key);
  if(s.key==='core_mjolnir')return storm.targetRange;
  if(s.key==='core_dragon' && mode==='refined')return BAL.creatorCoreDragon.tornadoSpeed*BAL.creatorCoreDragon.tornadoSeconds;
  return s.key==='core_meteor'&&mode==='refined'?BAL.creatorCoreMeteor.targetRange:0;
}
export function availableCore(r:RunState,h:HumanRecord,now:number){
  return r.custody[h.inv.packId].slots.some(s=>s && modes.some(m=>humanCastReach(s,m)>0 && !coreCastBlock(r,s,m,now,h.inv.packId)));
}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Avoid a visibly occupied impact area. This is a decision, not immunity:
 * another body may still walk into an already paid strike during its tell. */
export function safeAreaAim(r:RunState,h:HumanRecord,origin:Point,aim:Point,core:Stack,mode:CoreMode){
  const moving=core.key==='core_dragon';
  const radius=moving?BAL.creatorCoreDragon.tornadoRadius:core.key==='core_meteor'?BAL.creatorCoreMeteor.radius:mode==='signature'?storm.attractRadius:storm.strikeRadius;
  if(distance(origin,aim)<=radius)return false;
  const dx=aim.x-origin.x,dy=aim.y-origin.y,len2=dx*dx+dy*dy;
  // The tornado damages along its route, not just at the selected endpoint.
  const exposed=(p:Point)=>{
    const t=moving?Math.max(0,Math.min(1,((p.x-origin.x)*dx+(p.y-origin.y)*dy)/len2)):1;
    return Math.hypot(p.x-origin.x-t*dx,p.y-origin.y-t*dy)<=radius && clearPhysicalLine(r,origin,p,true);
  };
  if(h.intent?.target!=='player' && !r.player.dead && exposed(r.player) && !playerAtSea(r))return false;
  for(const p of Object.values(r.humanWorld!.people)){
    if(p===h || p.actorId===h.intent?.target || p.floor!==h.floor || p.transit || p.state==='DEAD' || p.state==='EVACUATED')continue;
    const pos=humanWorldPosition(p);
    if(exposed({x:origin.x+(pos.gx-h.gx-.5)*TILE,y:origin.y+(pos.gy-h.gy-.5)*TILE}))return false;
  }
  return !r.creatures.some(m=>m.husbandry?.tamed && m.state!=='dead' && (m.floor??0)===h.floor && exposed(m));
}
export function chooseHumanCast(r:RunState,h:HumanRecord,origin:Point,target:Point,now:number){
  const d=distance(origin,target);let best:{core:Stack;mode:CoreMode;score:number}|undefined;
  for(const core of r.custody[h.inv.packId].slots){
    if(!core)continue;
    const basic=basicCoreReach(core.key);if(!basic)continue;
    const payable=(m:CoreMode)=>!coreCastBlock(r,core,m,now,h.inv.packId);
    if(d<=basic && payable('basic') && (!best || best.score<2))best={core,mode:'basic',score:2};
    const reach=humanCastReach(core,'refined');
    if(!reach || d>reach)continue;
    const sig=core.key==='core_mjolnir' && payable('signature'),ref=payable('refined');
    if(!sig && !ref)continue;
    const main=r.creatures.find(m=>m.id===h.intent?.target);
    const area=core.key==='core_dragon'?BAL.creatorCoreDragon.tornadoRadius:core.key==='core_meteor'?BAL.creatorCoreMeteor.radius:storm.attractRadius;
    const active=(m:RunState['creatures'][number])=>(m.floor??0)===h.floor && ['attack','tell','chase'].includes(m.state) && !m.husbandry?.tamed && !m.elder?.submerged && !m.atk?.burrow;
    const group=!!main && active(main) && r.creatures.some(m=>m!==main && active(m) && distance(m,target)<=area && distance(m,origin)<=reach && clearPhysicalLine(r,origin,m,true));
    if(sig && group && safeAreaAim(r,h,origin,target,core,'signature'))return {core,mode:'signature' as const,score:4};
    const score=(core.key==='core_meteor' && main?.elder || (core.key==='core_dragon'||core.key==='core_meteor') && group)?3:1;
    if(ref && score>(best?.score??0) && safeAreaAim(r,h,origin,target,core,'refined'))best={core,mode:'refined',score};
  }
  return best;
}
