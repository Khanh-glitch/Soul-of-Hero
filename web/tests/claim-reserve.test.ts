// Legacy M2 migration fixture: old linked chest stays physical and is never auto-spent.
import {describe,it,expect} from 'vitest';
import {TILE,uid} from '../src/game/core';
import {newGame,dispatch,mkContainer,addItem,countItem,markDirty} from '../src/game/engine';
import {settle} from '../src/game/sim';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
const T=Date.UTC(2026,0,1);let n=0;
describe('legacy linked reserve migration',()=>{
 it('grandfathers a bare totem, creates empty cabinet storage, and leaves the old chest and its UIDs alone',()=>{const gs=newGame();expect(dispatch(gs,{id:'old'+ ++n,type:'startRun',character:'female',seed:9},T).ok).toBe(true);const r=gs.run!,p=r.player;r.creatures=[];const tx=Math.floor(p.x/TILE)+1,ty=Math.floor(p.y/TILE),ci=uid(r,'e'),hi=uid(r,'e'),hc=mkContainer(r,'chest',12);r.entities[ci]={id:ci,kind:'struct',type:'claim',tx,ty,x:tx*TILE+8,y:ty*TILE+8,hp:200,maxHp:200,maintenance:{enabled:true,chestId:hi}};r.entities[hi]={id:hi,kind:'struct',type:'chest_small',tx:tx+1,ty,x:(tx+1)*TILE+8,y:ty*TILE+8,hp:100,maxHp:100,c:hc.id,claim:ci};addItem(r,hc.id,'wood',10);const uid0=hc.slots[0]!.uid;markDirty();const saved=selectSnapshots([serializeSnapshot(gs),null]).gs!;settle(saved,T+1000,true);const q=saved.run!,cab=q.entities[ci];expect(cab.cabinet?.legacy).toBe(true);expect(q.custody[cab.c!].slots).toHaveLength(24);expect(q.custody[cab.c!].slots.every(s=>!s)).toBe(true);expect(countItem(q,hc.id,'wood')).toBe(10);expect(q.custody[hc.id].slots[0]!.uid).toBe(uid0);expect(selectSnapshots([serializeSnapshot(saved),null]).gs).toBeTruthy();});
});
