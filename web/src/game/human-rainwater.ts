/** Community rain storage uses the existing barrel, recipes, weather and custody.
 * The builder never places a filled barrel; only stepGardensBarrels can catch rain. */
import {T,TILE,WW,WH,uid,type Entity,type RunState} from './core';
import {RECIPES,STRUCTS} from './catalog';
import {allRunEntities,findRunEntity,globalCellTileAndClass,mkStack,markDirty,receipt} from './engine';
import {type Community,type HumanRecord,type HumanWorld} from './humanworld';
import {humanCanUseEntity,humanEntityTile} from './human-jobs';
import {materialPayment} from './material-payment';
import {windowOrigin} from '../veyra05/continuity';
import {isVeyra05Layout} from '../veyra05/scenes';
import {getWindowWorld,getWindowWorldForGlobalTile} from '../veyra05/window';
export const NO_LOCAL_BANK='I need water; no reachable potable bank was found in my local catchment.';
export function communityBarrel(r:RunState,c:Community){
  const e=findRunEntity(r,c.rainBarrelId);return e?.type==='barrel'&&e.kind==='struct'&&e.owner===c.id&&(e.hp??0)>0?e:undefined;
}
/** Commit one serving. A moved/destroyed/foreign barrel, a second arrival to
 * an empty barrel, or a body that has already drunk cannot consume a charge. */
export function drinkCommunityRain(r:RunState,h:HumanRecord,target:string,now:number){
  const c=h.community?r.humanWorld?.communities[h.community]:undefined;
  const b=c&&communityBarrel(r,c);
  if(h.transit||['DOWNED','DEAD','EVACUATED','ON_VESSEL'].includes(h.state)||!b||target!==`barrel:${b.id}`||h.thirst>=40||(b.water??0)<1||!humanCanUseEntity(r,h,b))return false;
  b.water=(b.water??0)-1;h.thirst=Math.min(100,h.thirst+25);
  receipt(r,now,'human.barrel.drink',`${h.actorId}:${b.id}:1`);return true;
}
/** The builder may twist the missing rope at the site from its paid hand recipe. */
export function barrelBill(twist:boolean):[string,number][]{return RECIPES.deploy_barrel.ins.flatMap(([k,q])=>k==='rope'&&twist?RECIPES.rope.ins.map(([a,n]):[string,number]=>[a,n*q]):[[k,q] as [string,number]]);}
export type RainSite={gx:number;gy:number;twist:boolean};
function lawful(r:RunState,hw:HumanWorld,c:Community,gx:number,gy:number,entities:Entity[]){
  if(!isVeyra05Layout(r.layoutId??'')||!c.storeTile)return false;
  const dist=Math.abs(gx-c.storeTile[0])+Math.abs(gy-c.storeTile[1]);if(dist<2||dist>8)return false;
  const [ox,oy]=windowOrigin(r),lx=gx-ox,ly=gy-oy,inside=lx>=0&&ly>=0&&lx<WW&&ly<WH;
  const rules=r.sourceMap?.rules===4?4:3;
  const view=inside?getWindowWorld(r.layoutId!,rules):getWindowWorldForGlobalTile(gx,gy,rules);
  const layer=view.floors.ground,x=gx-view.win.originTx,y=gy-view.win.originTy,i=y*WW+x;
  if(!layer.buildable[i]||layer.protectedCells[i]||layer.sources[i]||view.world.accessCorridors?.mask[i])return false;
  const {tile,cls}=globalCellTileAndClass(r,gx,gy,0,entities);
  if(cls!==0||[T.DEEP,T.SHALLOW,T.RIVER,T.CLIFF,T.PWALL,T.LAVA,T.FLOOR,T.ICE,T.ROAD,T.BRIDGE].includes(tile))return false;
  if(inside&&(r.veyraFloor??0)===0&&(!r.player.dead&&Math.floor(r.player.x/TILE)===lx&&Math.floor(r.player.y/TILE)===ly||r.creatures.some(m=>m.state!=='dead'&&(m.floor??0)===0&&Math.floor(m.x/TILE)===lx&&Math.floor(m.y/TILE)===ly)))return false;
  return !entities.some(e=>{if((e.floor??0)!==0)return false;const [x,y]=humanEntityTile(r,e);return x===gx&&y===gy;})&&!Object.values(hw.people).some(p=>!p.transit&&p.floor===0&&!['DEAD','EVACUATED'].includes(p.state)&&(p.gx===gx&&p.gy===gy||p.motion?.toGx===gx&&p.motion?.toGy===gy));
}
export function rainSite(r:RunState,hw:HumanWorld,c:Community){
  if(!c.storeTile)return;const [x,y]=c.storeTile,es=allRunEntities(r);
  for(let d=2;d<=8;d++)for(let dx=-d;dx<=d;dx++)for(const dy of new Set([d-Math.abs(dx),Math.abs(dx)-d]))if(lawful(r,hw,c,x+dx,y+dy,es))return {gx:x+dx,gy:y+dy};
}
export function installCatchment(r:RunState,hw:HumanWorld,h:HumanRecord,c:Community,site:RainSite,now:number){
  if(h.occupation!=='builder'||h.community!==c.id||h.floor!==0||Math.abs(h.gx-site.gx)+Math.abs(h.gy-site.gy)!==1||communityBarrel(r,c)||!lawful(r,hw,c,site.gx,site.gy,allRunEntities(r)))return false;
  const inputs=materialPayment(r.custody[h.inv.packId],barrelBill(site.twist),true);if(!inputs)return false;
  const [ox,oy]=windowOrigin(r),lx=site.gx-ox,ly=site.gy-oy,local=lx>=0&&ly>=0&&lx<WW&&ly<WH&&(r.veyraFloor??0)===0,tx=local?lx:site.gx,ty=local?ly:site.gy;
  const kit=mkStack(r,'deploy_barrel',1),id=uid(r,'e');
  const e:Entity={id,kind:'struct',type:'barrel',tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE,floor:0,poi:c.poi,owner:c.id,born:now,hp:kit.dur,maxHp:STRUCTS.barrel.hp,deployed:kit,water:0};
  (local?r.entities:(r.veyraOffscreenEntities??={}))[id]=e;c.rainBarrelId=id;markDirty();
  receipt(r,now,'human.barrel.built',JSON.stringify({actor:h.actorId,entity:id,kit:kit.uid,inputs,twistedRope:site.twist}));return true;
}
