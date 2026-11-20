import {groveCells,spiritDestination} from './core-sites';
import { BAL, TILE, VIEW_W, VIEW_H, WW, WH, clamp, type RunState, type Stack } from './core';
import { basicCoreReach } from './core-ray';
import { clearPhysicalLine, coreCastBlock } from './engine';
import type { CoreMode } from './g1b';
import { humanWorldPosition, playerAtSea, type HumanRecord } from './humanworld';

type Point={x:number;y:number};
const storm=BAL.creatorCoreMjolnir;
const modes:CoreMode[]=['basic','refined','signature'];
export function humanCastReach(s:Stack,mode:CoreMode){
  if(mode==='basic')return basicCoreReach(s.key);
  switch(s.key){
    case 'core_mjolnir':return storm.targetRange;
    case 'core_dragon':return BAL.creatorCoreDragon.tornadoSpeed*BAL.creatorCoreDragon.tornadoSeconds;
    case 'core_earthmother':return BAL.creatorCoreEarthmother.groveRange;
    case 'core_demon':return BAL.creatorCoreDemon.beamRange;
    case 'core_elsa':return mode==='signature'?VIEW_H/2:BAL.creatorCoreElsa.auraRadius;
    case 'core_meteor':return BAL.creatorCoreMeteor.targetRange;
    case 'core_blast':return mode==='refined'?100*BAL.creatorCoreBlast.bombSeconds:BAL.creatorCoreBlast.signatureSpeed*BAL.creatorCoreBlast.signatureLife;
    default:return 0;
  }
}
export function availableCore(r:RunState,h:HumanRecord,now:number){
  return r.custody[h.inv.packId].slots.some(s=>s && modes.some(m=>humanCastReach(s,m)>0 && !coreCastBlock(r,s,m,now,h.inv.packId)));
}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Avoid a visibly occupied impact area. This is a decision, not immunity:
 * another body may still walk into an already paid strike during its tell. */
export function safeAreaAim(r:RunState,h:HumanRecord,origin:Point,aim:Point,core:Stack,mode:CoreMode){
  const d=distance(origin,aim);if(!d)return false;
  if(core.key==='core_demon' && mode==='signature')return !spiritDestination(r,aim.x,aim.y,{...origin,owner:h.actorId});
  if(core.key==='core_earthmother' && mode==='refined' && ((r.natureTrees?.length??0)+BAL.creatorCoreEarthmother.treeCount>100 || groveCells(r,aim.x,aim.y,origin).length!==BAL.creatorCoreEarthmother.treeCount))return false;
  // Targeted dives touch only the captured hostile creatures. Freeze covers
  // the caster's view: do not freeze a visible tame animal anywhere in it.
  if(mode==='signature' && (core.key==='core_dragon'||core.key==='core_elsa')){
    const vx=clamp(origin.x-VIEW_W/2,0,WW*TILE-VIEW_W),vy=clamp(origin.y-VIEW_H/2,0,WH*TILE-VIEW_H);
    const visible=(p:Point)=>p.x>=vx&&p.x<vx+VIEW_W&&p.y>=vy&&p.y<vy+VIEW_H&&clearPhysicalLine(r,origin,p,true);
    const primary=r.creatures.find(m=>m.id===h.intent?.target);
    return !!primary && activeThreat(r,h,primary,origin,humanCastReach(core,mode)) && visible(primary) &&
      (core.key==='core_dragon'||!r.creatures.some(m=>m.state!=='dead'&&(m.floor??0)===h.floor&&m.husbandry?.tamed&&visible(m)));
  }
  if(core.key==='core_elsa')return !r.creatures.some(m=>m.husbandry?.tamed && m.state!=='dead' && (m.floor??0)===h.floor && distance(origin,m)<BAL.creatorCoreElsa.auraRadius && clearPhysicalLine(r,origin,m,true));
  let radius=core.key==='core_dragon'?BAL.creatorCoreDragon.tornadoRadius:core.key==='core_earthmother'?BAL.creatorCoreEarthmother.rootRange:core.key==='core_meteor'?BAL.creatorCoreMeteor.radius:mode==='signature'?storm.attractRadius:storm.strikeRadius;
  let moving=core.key==='core_dragon';
  let end=aim;
  if(core.key==='core_demon'){
    moving=true;radius=BAL.creatorCoreDemon.beamWidth/2+3;
    end={x:origin.x+(aim.x-origin.x)*BAL.creatorCoreDemon.beamRange/d,y:origin.y+(aim.y-origin.y)*BAL.creatorCoreDemon.beamRange/d};
  }
  if(core.key==='core_blast'){
    const range=humanCastReach(core,mode),bomb=mode==='refined';
    end={x:origin.x+(aim.x-origin.x)*range/d,y:origin.y+(aim.y-origin.y)*range/d};
    // A timed bomb stops at a wall; only throw with a clear lane to its fuse
    // endpoint. Include the full lifetime of the secondary fragments.
    if(bomb && (range-d>30 || !clearPhysicalLine(r,origin,end,true)))return false;
    moving=!bomb;radius=bomb?120*.65+10:30;
  }
  if(d<=radius)return false;
  const dx=end.x-origin.x,dy=end.y-origin.y,len2=dx*dx+dy*dy;
  const exposed=(p:Point)=>{
    if(core.key==='core_meteor' && mode==='signature'){
      const left=clamp(origin.x-VIEW_W/2,0,WW*TILE-VIEW_W),top=clamp(origin.y-VIEW_H/2,0,WH*TILE-VIEW_H);
      return p.x>=left-radius && p.x<=left+VIEW_W+radius && p.y>=top-radius && p.y<=top+VIEW_H+radius;
    }
    const t=moving?clamp(((p.x-origin.x)*dx+(p.y-origin.y)*dy)/len2,0,1):1;
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
function activeThreat(r:RunState,h:HumanRecord,m:RunState['creatures'][number],origin:Point,reach:number){
  return (m.floor??0)===h.floor && ['attack','tell','chase'].includes(m.state) && !m.husbandry?.tamed && !m.elder?.submerged && !m.atk?.burrow && distance(m,origin)<=reach && clearPhysicalLine(r,origin,m,true);
}
export function chooseHumanCast(r:RunState,h:HumanRecord,origin:Point,target:Point,now:number){
  const d=distance(origin,target);let best:{core:Stack;mode:CoreMode;score:number;aim?:Point}|undefined;
  for(const core of r.custody[h.inv.packId].slots){
    if(!core)continue;
    const basic=basicCoreReach(core.key);if(!basic)continue;
    const payable=(m:CoreMode)=>!coreCastBlock(r,core,m,now,h.inv.packId);
    if(d<=basic && payable('basic') && (!best || best.score<2))best={core,mode:'basic',score:2};
    const refReach=humanCastReach(core,'refined'),sigReach=humanCastReach(core,'signature');
    const sig=sigReach>0 && d<=sigReach && payable('signature'),ref=refReach>0 && d<=refReach && payable('refined');
    if(!sig && !ref)continue;
    if(sig && core.key==='core_demon' && h.hp<=.4*h.maxHp && d>0){
      // Escape only to a currently visible, physically reachable tile farther
      // from this observed threat. Never borrow the player's map knowledge.
      const away=Math.atan2(origin.y-target.y,origin.x-target.x);
      for(const offset of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2]){
        const aim={x:(Math.floor(origin.x/TILE)+Math.round(4*Math.cos(away+offset))+.5)*TILE,y:(Math.floor(origin.y/TILE)+Math.round(4*Math.sin(away+offset))+.5)*TILE};
        if(distance(aim,target)>d+TILE && safeAreaAim(r,h,origin,aim,core,'signature'))return {core,mode:'signature' as const,score:5,aim};
      }
    }
    const main=r.creatures.find(m=>m.id===h.intent?.target);
    const area=core.key==='core_dragon'?BAL.creatorCoreDragon.tornadoRadius:core.key==='core_meteor'?BAL.creatorCoreMeteor.radius:core.key==='core_blast'?30:core.key==='core_earthmother'?BAL.creatorCoreEarthmother.rootRange:storm.attractRadius;
    const reach=sig?sigReach:refReach;
    const group=!!main && activeThreat(r,h,main,origin,reach) && r.creatures.some(m=>m!==main && distance(m,target)<=area && activeThreat(r,h,m,origin,reach));
    if(sig && core.key!=='core_demon' && group && safeAreaAim(r,h,origin,target,core,'signature'))return {core,mode:'signature' as const,score:4};
    const score=(core.key==='core_elsa' && h.hp<h.maxHp*.6 || core.key==='core_meteor' && main?.elder || core.key!=='core_mjolnir' && group)?3:1;
    if(ref && score>(best?.score??0) && safeAreaAim(r,h,origin,target,core,'refined'))best={core,mode:'refined',score};
  }
  return best;
}
