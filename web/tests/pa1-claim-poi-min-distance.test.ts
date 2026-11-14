import {afterAll,describe,it,expect} from 'vitest';
import {TILE,WW,type GameState} from '../src/game/core';
import {BAL} from '../src/game/core';
import {newGame,dispatch,addItem,countItem,buildReason,C,markDirty} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {serializeSnapshot,selectSnapshots,validate} from '../src/game/persist';

const T0=Date.UTC(2026,10,13,12);let seq=0;
const action=(g:GameState,type:string,p:object={})=>
  dispatch(g,{id:'poi-claim-'+ ++seq,type,...p},T0+seq*100);
const target=(g:GameState,tx:number,ty:number)=>{
  const r=g.run!;
  r.player.x=(tx-1)*TILE+8;r.player.y=(ty+1)*TILE+8;markDirty();
};
afterAll(()=>setActiveLayout('shipping'));

describe('PA1 Territory Cabinet source-authorized POI separation',()=>{
 it('rejects a REAL paid cabinet UID at 9 tiles from Trading Post; no material debit, no UID loss',()=>{
   setActiveLayout('shipping_fresh');
   const g=newGame();expect(action(g,'startRun',{character:'male',region:0,seed:0x8801}).ok).toBe(true);
   const r=g.run!,w=getWorld();r.creatures=[];
   const tp=w.places.find(x=>x.id==='tp')!;
   expect(tp.kind).toBe('poi');
   expect(BAL.economy.claimMinDistFromPoi).toBe(10);
   const tx=tp.tx,ty=tp.ty-9;
   target(g,tx,ty);
   addItem(r,'inv','wood',60);
   addItem(r,'inv','stone',15);
   const floor=action(g,'build',{struct:'floor_wood',tx,ty});
   expect(floor.ok,JSON.stringify(floor)).toBe(true);
   const cr=action(g,'craft',{recipe:'deploy_claim'});
   expect(cr.ok,JSON.stringify(cr)).toBe(true);
   const s=C(r,'inv').slots.find(v=>v?.key==='deploy_claim')!;
   expect(s?.uid).toBeTruthy();const uid=s.uid,wood=countItem(r,'inv','wood'),stone=countItem(r,'inv','stone');
   expect(buildReason(g,'claim',tx,ty)).toContain('at least 10 tiles');
   const rejected=action(g,'build',{struct:'claim',tx,ty});
   expect(rejected.ok).toBe(false);
   expect(C(r,'inv').slots.find(v=>v?.uid===uid)?.key).toBe('deploy_claim');
   expect(countItem(r,'inv','wood')).toBe(wood);
   expect(countItem(r,'inv','stone')).toBe(stone);
   expect(Object.values(r.entities).some(e=>e.type==='claim')).toBe(false);
   expect(validate(selectSnapshots([serializeSnapshot(g),null]).gs!)).not.toBeNull();
 });

 it('accepts legal paid Cabinet beyond POI radius when terrain, floor, custody and player reach allow',()=>{
   setActiveLayout('shipping_fresh');
   const g=newGame();expect(action(g,'startRun',{character:'male',region:0,seed:0x8801}).ok).toBe(true);
   const r=g.run!,w=getWorld();r.creatures=[];
   const tp=w.places.find(x=>x.id==='tp')!;
   addItem(r,'inv','wood',60);addItem(r,'inv','stone',15);
   const cr=action(g,'craft',{recipe:'deploy_claim'});expect(cr.ok,JSON.stringify(cr)).toBe(true);
   const uid=C(r,'inv').slots.find(v=>v?.key==='deploy_claim')!.uid;
   let placed=false;
   for(let dy=-20;dy<=20&&!placed;dy++)for(let dx=-20;dx<=20&&!placed;dx++){
     const tx=tp.tx+dx,ty=tp.ty+dy;
     if(Math.hypot(dx,dy)<BAL.economy.claimMinDistFromPoi+1)continue;
     if(tx<2||ty<2||tx>=WW-2||ty>=WW-2)continue;
     if(!w.economyMap.buildable[ty*WW+tx]||w.economyMap.protected[ty*WW+tx])continue;
     target(g,tx,ty);
     if(buildReason(g,'floor_wood',tx,ty)!==null)continue;
     if(!action(g,'build',{struct:'floor_wood',tx,ty}).ok)continue;
     const why=buildReason(g,'claim',tx,ty);
     if(why===null){
       const ok=action(g,'build',{struct:'claim',tx,ty});
       if(ok.ok){
         expect(Object.values(r.entities).find(e=>e.type==='claim')?.deployed?.uid).toBe(uid);
         placed=true;
       }
     }
   }
   expect(placed,'must locate one real legal claim beyond radius').toBe(true);
   expect(validate(g)).not.toBeNull();
 });

 it('uses actual Veyra POI anchors, not Shipping-specific hardcoding',()=>{
   setActiveLayout('veyra05-world');
   const g=newGame();const res=action(g,'startRun',{character:'male',region:0,seed:0xA101});
   expect(res.ok,JSON.stringify(res)).toBe(true);
   const w=getWorld();
   const candidate=w.places.find(p=>p.kind==='poi'&&p.tx>2&&p.ty>2&&p.tx<WW-2&&p.ty<WW-2);
   expect(candidate,'Veyra window has authored POI anchors').toBeDefined();
   const p=candidate!;
   const why=buildReason(g,'claim',p.tx+1,p.ty);
   expect(why).toContain('at least 10 tiles');
   // This is only a claim preflight authority check, not a natural walk to POI.
 });
});
