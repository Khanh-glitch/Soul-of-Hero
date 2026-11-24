import {it,expect} from 'vitest';
import {newGame,startRun,sourceAt,globalSourceAt} from '../src/game/engine';
import {setActiveLayout,getWorld} from '../src/game/world';
import {globalBaseGeometry} from '../src/veyra05/window';
import {FRAME_W} from '../src/veyra05/frame';
import {humanHarvest} from '../src/game/humanworld';
import {humanNavigation} from '../src/game/human-navigation';
import {HOUR} from '../src/game/core';
import {SOURCES} from '../src/game/catalog';
import {measureWorldWork} from '../src/game/world-work';
import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);return gs.run!;}
it('active global reads delegate to the identical finite player source object and never mint on repeat',()=>{
 const r=scene(),w=getWorld(),i=w.sourceV3.findIndex(k=>!!k&&!SOURCES[k].regrow),x=i%200,y=Math.floor(i/200),o=r.sourceMap!.veyra!.originAu,gx=Math.round(o[0]/.5)+x,gy=Math.round(o[1]/.5)+y;
 expect(i).toBeGreaterThanOrEqual(0);r.sources[i]={stock:0,hp:0};
 const a=globalSourceAt(r,gx,gy,0,T0)!;expect(a.st).toBe(r.sources[i]);expect(a.states).toBe(r.sources);expect(a.stock).toBe(0);
 expect(globalSourceAt(r,gx,gy,0,T0+336*HOUR)!.stock).toBe(0);expect(sourceAt(r,x,y,T0)!.st).toBe(a.st);
});
it('inactive-floor regrowth uses the same seasonal integration as active sourceAt without render compilation',()=>{
 const r=scene(),w=getWorld(),i=w.sourceV3.findIndex((k,i)=>!!k&&!!SOURCES[k].regrow&&!w.statics.some(s=>s.tx===i%200&&s.ty===Math.floor(i/200))),x=i%200,y=Math.floor(i/200),o=r.sourceMap!.veyra!.originAu,gx=Math.round(o[0]/.5)+x,gy=Math.round(o[1]/.5)+y,gi=gy*FRAME_W+gx;
 expect(i).toBeGreaterThanOrEqual(0);r.sources[i]={stock:0,hp:0,regrowFrom:T0,regrowAcc:0};
 const remote=JSON.parse(JSON.stringify(r)) as typeof r;remote.veyraFloor=2;remote.veyraGlobalSources??={};remote.veyraGlobalSources[gi]={...r.sources[i]};if(remote.veyraFloorState?.[0])remote.veyraFloorState[0].sources[i]=remote.veyraGlobalSources[gi];
 const sample=measureWorldWork(()=>{for(const at of [T0+HOUR,T0+8*HOUR,T0+48*HOUR]){
  const local=sourceAt(r,x,y,at)!,far=globalSourceAt(remote,gx,gy,0,at)!;
  expect([far.key,far.stock,far.hp,far.st]).toEqual([local.key,local.stock,local.hp,local.st]);
 }});expect(sample.counts.renderCompilations).toBe(0);
});
it('remote stock is one shared mutable ledger across reload and wrong floors cannot synthesize sources',()=>{
 const r=scene();let p:{x:number;y:number}|undefined;
 for(let y=980;y<1020&&!p;y++)for(let x=980;x<1020;x++)if(globalBaseGeometry(x,y,0,4)?.source){p={x,y};break;}
 expect(p).toBeTruthy();const a=globalSourceAt(r,p!.x,p!.y,0,T0)!,gi=p!.y*FRAME_W+p!.x;
 a.states[a.i]={stock:0,hp:0};expect(globalSourceAt(r,p!.x,p!.y,0,T0)!.st).toBe(a.states[gi]);
 const copy=JSON.parse(JSON.stringify(r));expect(globalSourceAt(copy,p!.x,p!.y,0,T0)!.stock).toBe(0);
 expect(globalSourceAt(r,p!.x,p!.y,3,T0)).toBeNull();
});

it('global contact extraction debits one finite unit once, blocks distant work and keeps UID custody',()=>{
 const r=scene(),hw=r.humanWorld!,[h,peer]=Object.values(hw.people),nav=humanNavigation(r);let found:{x:number;y:number;bank:{tx:number;ty:number;floor:number}}|undefined;
 search:for(let y=980;y<1020;y++)for(let x=980;x<1020;x++){
  const base=globalBaseGeometry(x,y,0,4),key=base?.source;if(!key||SOURCES[key].mat!=='plant'||globalSourceAt(r,x,y,0,T0)?.protected)continue;
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const bank={tx:x+dx,ty:y+dy,floor:0};if(nav.free(bank,h,true)){found={x,y,bank};break search;}}
 }
 expect(found).toBeTruthy();const p=found!,src=globalSourceAt(r,p.x,p.y,0,T0)!,gi=p.y*FRAME_W+p.x;
 src.states[gi]={stock:1,hp:1};
 expect(humanHarvest(r,hw,h,p.x,p.y,T0,true).result).toBe('blocked');
 for(const actor of [h,peer]){actor.gx=p.bank.tx;actor.gy=p.bank.ty;actor.floor=0;actor.state='IDLE';actor.stamina=100;actor.equip.weapon=null;r.custody[actor.inv.packId].slots.fill(null);}
 const first=humanHarvest(r,hw,h,p.x,p.y,T0,true);expect(first.result).toBe('yield');expect(first.got).toBeGreaterThan(0);
 expect(humanHarvest(r,hw,peer,p.x,p.y,T0,true).result).toBe('empty');expect(src.states[gi].stock).toBe(0);
 const pack=r.custody[h.inv.packId].slots.filter(Boolean);expect(pack.length).toBeGreaterThan(0);expect(new Set(pack.map(s=>s!.uid)).size).toBe(pack.length);
 const saved=JSON.parse(JSON.stringify(r));expect(humanHarvest(saved,saved.humanWorld,saved.humanWorld.people[peer.actorId],p.x,p.y,T0,true).result).toBe('empty');
},30000);
