import {expect,it} from 'vitest';
import {newGame,startRun,findRunEntity,mkStack,blockGrid,dispatch,mkContainer,markDirty} from '../src/game/engine';
import {humanEntityTile} from '../src/game/human-jobs';
import {commandHuman,stepHumans,humanCart,recordIncident} from '../src/game/humanworld';
import {TILE,WW} from '../src/game/core';import {setActiveLayout} from '../src/game/world';import {T0} from './helpers/g1b-kit';
function scene(){setActiveLayout('veyra05-greywater');const gs=newGame();expect(startRun(gs,'female',T0,null,7606,{tx:100,ty:100}).ok).toBe(true);const r=gs.run!,hw=r.humanWorld!,h=Object.values(hw.people).find(h=>h.occupation==='guard')!;for(const p of Object.values(hw.people))p.nextThinkAt=T0+86400000;h.following=true;r.creatures=[];return {gs,r,hw,h};}
it('carrier walks to its own warehouse; closed capacity retains the whole manifest and reopening lands it once',()=>{
 const {r,hw,h}=scene(),store=findRunEntity(r,hw.communities[h.community!].storeEntityId)!,slots=r.custody[store.c!].slots,cart=humanCart(r,h);
 const a=mkStack(r,'wood',2),b=mkStack(r,'bandage',1);cart.slots[0]=a;cart.slots[1]=b;
 for(let i=0;i<slots.length;i++)slots[i]=mkStack(r,'stone',60);slots[0]=null;
 expect(commandHuman(r,hw,h,'wrong','carry',T0,'absent').ok).toBe(false);
 expect(commandHuman(r,hw,h,'trip','carry',T0,store.id).ok).toBe(true);
 const start=[h.gx,h.gy];for(let i=1;i<=120&&!h.intent?.blockReason?.includes('full');i++)stepHumans(r,hw,T0+i*1000);
 expect(h.intent?.blockReason).toContain('full');expect([h.gx,h.gy]).not.toEqual(start);
 const [tx,ty]=humanEntityTile(r,store);expect(Math.abs(tx-h.gx)+Math.abs(ty-h.gy)).toBeLessThanOrEqual(1);
 expect(slots[0]).toBeNull();expect(cart.slots.slice(0,2)).toEqual([a,b]);slots[1]=null;
 stepHumans(r,hw,T0+121000);stepHumans(r,hw,T0+122000);
 expect(cart.slots.every(s=>!s)).toBe(true);expect(r.custody[store.c!].slots.slice(0,2)).toEqual([a,b]);
 expect(r.receipts.filter(e=>e.kind==='human.companion.deliver')).toHaveLength(1);
});
it('guard escorts the player, responds to a nearby attack, and breaks off when that attacker disengages',()=>{
 const {r,hw,h}=scene(),o=r.sourceMap!.veyra!.originAu,g=blockGrid(r);const i=g.findIndex((v,i)=>i>WW*8&&i%WW>5&&i%WW<WW-5&&v===0&&g[i+1]===0&&g[i+2]===0);expect(i).toBeGreaterThan(0);
 h.gx=o[0]*2+i%WW;h.gy=o[1]*2+Math.floor(i/WW);h.floor=r.veyraFloor??0;r.player.x=(i%WW+1.5)*TILE;r.player.y=(Math.floor(i/WW)+.5)*TILE;
 const p=Object.values(hw.people).find(p=>p.community!==h.community)!;p.gx=h.gx+2;p.gy=h.gy;p.floor=h.floor;p.state='IDLE';
 expect(commandHuman(r,hw,h,'watch','defend',T0).ok).toBe(true);stepHumans(r,hw,T0+1000);expect(h.intent?.kind).toBe('follow');
 p.state='FIGHTING';p.intent={intentId:'attack',actorId:p.actorId,kind:'fight',target:'player',route:[],startAt:T0,dueAt:T0,preconditions:[],reserved:[]};stepHumans(r,hw,T0+2000);expect(h.intent).toMatchObject({kind:'fight',target:p.actorId,guardPlayer:true});
 p.intent=undefined;p.state='IDLE';stepHumans(r,hw,T0+3000);expect(h.intent).toMatchObject({kind:'follow',guardPlayer:true});expect(h.intent?.target).toBeUndefined();
});
it('only a witnessed deposit becomes a recovery route; the stolen UID survives reload and is reclaimed once',()=>{
 const {r,gs,hw,h}=scene(),o=r.sourceMap!.veyra!.originAu,g=blockGrid(r);
 const i=g.findIndex((v,i)=>i>WW*8&&i%WW>5&&i%WW<WW-7&&v===0&&g.slice(i,i+6).every(x=>x===0));expect(i).toBeGreaterThan(0);
 const tx=i%WW+4,ty=Math.floor(i/WW),cid=mkContainer(r,'chest',3).id;
 r.entities.testChest={id:'testChest',kind:'struct',type:'chest_small',born:T0,hp:60,tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE,c:cid};markDirty();r.player.x=(tx-.5)*TILE;r.player.y=(ty+.5)*TILE;
 h.following=false;h.state='IDLE';h.intent=undefined;h.floor=1;h.gx=o[0]*2+tx-3;h.gy=o[1]*2+ty;
 const stolen=mkStack(r,'bandage',1);r.custody.inv.slots[0]=stolen;
 const incident=recordIncident(r,hw,{kind:'robbery',victim:h.actorId,aggressor:'player',at:T0,place:{tx:h.gx,ty:h.gy,floor:0},witnesses:[],resolved:false,property:[stolen.uid],robbedQuantity:1},T0);
 const move=(n:number,from:string,to:string)=>dispatch(gs,{type:'move',id:`move:${n}`,from,to,fs:0,ts:0},T0+n);
 expect(move(1,'inv',cid).ok).toBe(true);expect(h.recoveryLead).toBeUndefined();expect(move(2,cid,'inv').ok).toBe(true);
 h.floor=0;expect(move(3,'inv',cid).ok).toBe(true);expect(h.recoveryLead?.incidentId).toBe(incident.id);
 const loaded=JSON.parse(JSON.stringify(r)) as typeof r, world=loaded.humanWorld!,actor=world.people[h.actorId];markDirty();
 for(let t=1;t<=120 && !world.incidents[incident.id].recoveredAt;t++)stepHumans(loaded,world,T0+t*1000);
 expect(loaded.custody[cid].slots[0]).toBeNull();expect(loaded.custody[actor.inv.packId].slots.some(s=>s?.uid===stolen.uid)).toBe(true);
 expect(Math.abs(actor.gx-tx-o[0]*2)+Math.abs(actor.gy-ty-o[1]*2)).toBeLessThanOrEqual(1);expect(loaded.receipts.filter(r=>r.kind==='human.grievance.recover')).toHaveLength(1);
});
it('home is a physical arrival, including already-there, lost site and reload during the expedition',()=>{
 const {gs,r,hw,h}=scene(),comm=hw.communities[h.home!],store=findRunEntity(r,comm.storeEntityId)!;
 h.bedId=undefined;const at=[h.gx,h.gy];expect(commandHuman(r,hw,h,'go','home',T0).ok).toBe(true);
 expect(h.following).toBe(true);expect([h.gx,h.gy]).toEqual(at);
 const saved=JSON.parse(JSON.stringify(gs)) as typeof gs,lr=saved.run!,world=lr.humanWorld!,walker=world.people[h.actorId],ls=findRunEntity(lr,store.id)!;
 const hp=ls.hp;ls.hp=0;markDirty();
 for(let n=1;n<=100&&!walker.intent?.blockReason?.includes('home site');n++)stepHumans(lr,world,T0+n*1000);
 expect(walker.intent?.blockReason).toContain('home site');expect(walker.following).toBe(true);
 expect(lr.receipts.some(e=>e.kind==='human.companion.home')).toBe(false);
 ls.hp=hp;markDirty();for(let n=101;n<=220&&walker.following;n++)stepHumans(lr,world,T0+n*1000);
 expect(walker.following).toBe(false);const [gx,gy]=humanEntityTile(lr,ls);
 expect(Math.abs(walker.gx-gx)+Math.abs(walker.gy-gy)).toBeLessThanOrEqual(1);expect(walker.floor).toBe(ls.floor??0);
 const arrivals=()=>lr.receipts.filter(e=>e.kind==='human.companion.home');expect(arrivals()).toHaveLength(1);
 walker.following=true;const here=[walker.gx,walker.gy];expect(commandHuman(lr,world,walker,'already-home','home',T0+221000).msg).toContain('Already home');expect([walker.gx,walker.gy]).toEqual(here);expect(walker.following).toBe(false);expect(arrivals()).toHaveLength(2);
});
it('cargo splits conserve parent and landed UIDs, reject invalid quantities and replay after reload',()=>{
 const {gs,r,h}=scene(),o=r.sourceMap!.veyra!.originAu;
 h.gx=o[0]*2+Math.floor(r.player.x/TILE);h.gy=o[1]*2+Math.floor(r.player.y/TILE);h.floor=r.veyraFloor??0;
 const cart=humanCart(r,h),s=mkStack(r,'wood',7);r.custody.inv.slots[0]=s;cart.slots.fill(null);
 const put=(qty:number,id:string)=>dispatch(gs,{id,type:'humanCargo',actorId:h.actorId,stackUid:s.uid,qty,direction:'give'},T0);
 const next=r.nextId;for(const bad of [0,8,1.5,-1])expect(put(bad,`bad-${bad}`).ok).toBe(false);
 cart.slots.fill(mkStack(r,'knife',1));const fullNext=r.nextId;
 expect(put(2,'full').ok).toBe(false);expect(r.nextId).toBe(fullNext);expect(s.qty).toBe(7);cart.slots.fill(null);
 expect(put(3,'split').ok).toBe(true);const child=cart.slots[0]!;expect(child.uid).not.toBe(s.uid);expect(child.qty).toBe(3);expect(s.qty).toBe(4);expect(r.nextId).toBe(next+2);
 expect(JSON.parse(r.receipts.at(-1)!.detail)).toMatchObject({parent:s.uid,portion:child.uid,landed:[{uid:child.uid,qty:3}]});
 const other=JSON.parse(JSON.stringify(gs)) as typeof gs;expect(dispatch(other,{id:'split',type:'humanCargo',actorId:h.actorId,stackUid:s.uid,qty:3,direction:'give'},T0+1).ok).toBe(false);
 expect(dispatch(other,{id:'unload',type:'humanCargo',actorId:h.actorId,stackUid:child.uid,qty:3,direction:'return'},T0+2).ok).toBe(true);
 expect(other.run!.custody.inv.slots.find(c=>c?.uid===child.uid)?.qty).toBe(3);
});
it('follow does not finish an obsolete trail after the player dies',()=>{
 const {r,hw,h}=scene();h.state='MOVING';h.intent={intentId:'follow-live',actorId:h.actorId,kind:'follow',startAt:T0,dueAt:T0,preconditions:[],reserved:[],route:[{tx:h.gx+1,ty:h.gy,floor:h.floor}]};r.player.dead=true;
 const start=[h.gx,h.gy];stepHumans(r,hw,T0+1000);expect(h.following).toBe(true);expect(h.intent?.blockReason).toContain('Waiting');expect(h.intent?.route).toEqual([]);expect([h.gx,h.gy]).toEqual(start);
});
