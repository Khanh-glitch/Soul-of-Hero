/** Controlled drop fixtures: cache/dispatcher custody regression, not natural farming. */
import {afterEach,expect,it} from 'vitest';
import {WW} from '../src/game/core';
import {fundBuild} from './support/paid-build';
import {beside,buildCarried} from './support/current-industry';
import {tick,FX,type Input} from '../src/game/sim';
import {ITEMS} from '../src/game/catalog';
import {C,blockGrid,countItem,dispatch,entsAt,markDirty,mkStack,newGame,roofRoom,spawnDrop,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
const NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
function setup(){
 setActiveLayout('shipping_fresh');const gs=newGame();expect(startRun(gs,'female',NOW,1,901).ok).toBe(true);
 const r=gs.run!;return {gs,r};
}
it('a whole drop pickup retains collision, tile index and roof caches, UID and durable replay refusal',()=>{
 const {gs,r}=setup(),e=spawnDrop(r,'wood',3,r.player.x,r.player.y,NOW,undefined,false),s=C(r,e.c!).slots[0]!;
 const indexed=Object.values(r.entities).find(x=>x.tx!==undefined && x.kind!=='drop')!;
 const grid=blockGrid(r),tiles=entsAt(r,indexed.tx!,indexed.ty!),room=roofRoom(r,r.player.x,r.player.y),before=grid.slice();
 const intent={id:'cache-pickup',type:'pickup',eid:e.id};
 expect(dispatch(gs,intent,NOW+1)).toMatchObject({ok:true});
 expect(r.entities[e.id]).toBeUndefined();expect(C(r,e.c!)).toBeUndefined();
 expect(C(r,'inv').slots.find(x=>x?.uid===s.uid)).toEqual(s);
 expect(blockGrid(r)===grid,'non-spatial pickup must not rebuild 40,000 collision cells').toBe(true);
 expect(blockGrid(r)).toEqual(before);expect(entsAt(r,indexed.tx!,indexed.ty!)).toBe(tiles);expect(roofRoom(r,r.player.x,r.player.y)).toBe(room);
 const copy=selectSnapshots([serializeSnapshot(gs)]).gs!;expect(copy).toBeTruthy();
 expect(dispatch(copy,intent,NOW+2)).toMatchObject({ok:false,dup:true});
 expect(C(copy.run!,'inv').slots.find(x=>x?.uid===s.uid)).toEqual(s);
});
it('partial/full refusal leaves remainder, receiver identity, geometry and total material unchanged',()=>{
 const {gs,r}=setup(),inv=C(r,'inv');inv.slots=inv.slots.map(()=>mkStack(r,'stone',ITEMS.stone.max));
 inv.slots[0]=mkStack(r,'wood',ITEMS.wood.max-2);const receiver=inv.slots[0].uid;
 const e=spawnDrop(r,'wood',5,r.player.x,r.player.y,NOW,undefined,false),s=C(r,e.c!).slots[0]!,uid=s.uid,grid=blockGrid(r);
 expect(dispatch(gs,{id:'partial',type:'pickup',eid:e.id},NOW+1)).toMatchObject({ok:true});
 expect(s.qty).toBe(3);expect(s.uid).toBe(uid);expect(inv.slots[0]?.uid).toBe(receiver);expect(countItem(r,'inv','wood')+s.qty).toBe(ITEMS.wood.max+3);
 const before=JSON.stringify([r.custody,r.entities,r.seenIntents]);expect(dispatch(gs,{id:'full',type:'pickup',eid:e.id},NOW+2)).toMatchObject({ok:false});
 expect(JSON.stringify([r.custody,r.entities,r.seenIntents])).toBe(before);expect(blockGrid(r)).toBe(grid);
 inv.slots[1]=null;expect(dispatch(gs,{id:'remaining',type:'pickup',eid:e.id},NOW+3)).toMatchObject({ok:true});
 expect(inv.slots[1]).toEqual(s);expect(r.entities[e.id]).toBeUndefined();expect(blockGrid(r)===grid).toBe(true);
});
it('structural removal still rebuilds collision, indexed entities and roof observations',()=>{
 const {gs,r}=setup();fundBuild(gs,'wall_wood',NOW);const wall=buildCarried(gs,'wall_wood',NOW);
 beside(gs,wall.tx!-1,wall.ty!);const grid=blockGrid(r),tiles=entsAt(r,wall.tx!,wall.ty!),room=roofRoom(r,r.player.x,r.player.y);
 expect(grid[wall.ty!*WW+wall.tx!]).toBe(3);expect(tiles).toContain(wall);
 expect(dispatch(gs,{id:'cache-reclaim',type:'reclaim',eid:wall.id},NOW+2)).toMatchObject({ok:true});
 expect(blockGrid(r)===grid).toBe(false);expect(blockGrid(r)[wall.ty!*WW+wall.tx!]).not.toBe(3);
 expect(entsAt(r,wall.tx!,wall.ty!)).not.toContain(wall);expect(roofRoom(r,r.player.x,r.player.y)===room).toBe(false);
});
it('real auto pickup keeps manual drops and other-floor custody untouched',()=>{
 const {gs,r}=setup();const auto=Array.from({length:16},()=>spawnDrop(r,'wood',1,r.player.x,r.player.y,NOW-500,undefined,false));
 const manual=spawnDrop(r,'wood',2,r.player.x,r.player.y,NOW-500,undefined,false);manual.manual=true;
 const upstairs=spawnDrop(r,'wood',3,r.player.x,r.player.y,NOW-500,undefined,false);(upstairs as typeof upstairs & {floor:number}).floor=1;
 const before=countItem(r,'inv','wood'),input:Input={up:false,down:false,left:false,right:false,mx:r.player.x,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false};
 tick(gs,input,40,NOW+40);FX.length=0;
 expect(countItem(r,'inv','wood')-before).toBe(16);
 for(const e of auto){expect(r.entities[e.id]).toBeUndefined();expect(C(r,e.c!)).toBeUndefined();}
 expect(r.entities[manual.id]).toBe(manual);expect(C(r,manual.c!).slots[0]?.qty).toBe(2);
 expect(r.entities[upstairs.id]).toBe(upstairs);expect(C(r,upstairs.c!).slots[0]?.qty).toBe(3);
});
