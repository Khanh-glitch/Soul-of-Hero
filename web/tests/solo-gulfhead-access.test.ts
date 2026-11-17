/** Focused runtime counterexample to the frozen dry-only reachability census.
 * Controlled exterior inspection position/creatures; no terrain, source or door injection.
 * This proves lawful wading, NOT a dry cargo route or a natural gameplay journey. */
import {afterEach,it,expect} from 'vitest';
import {TILE,WW} from '../src/game/core';
import {blockGrid,dispatch,markDirty,newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {layoutIdAt} from '../src/veyra05/scenes';
import {getWindowWorld} from '../src/veyra05/window';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';
const NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
for(const [ox,oy]of [[1960,1730],[1977,1739]])it(`Quay Watch has an actual player wading approach at origin ${ox},${oy}`,()=>{
 const layout=layoutIdAt(ox,oy);setActiveLayout(layout);const gs=newGame();expect(startRun(gs,'male',NOW,null,101).ok).toBe(true);
 const r=gs.run!,ww=getWindowWorld(layout);r.creatures=[];
 const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.tx===2050-ox&&e.ty===1830-oy)!;expect(door).toBeDefined();expect(door.locked).toBeUndefined();
 const i=(gx:number,gy:number)=>(gy-oy)*WW+gx-ox;
 expect(blockGrid(r)[i(2052,1830)]).toBe(4); // river is wadeable for a player, not a cart
 expect(blockGrid(r)[i(2051,1830)]).toBe(0);expect(blockGrid(r)[i(2050,1830)]).toBe(3);
 const terrain=Array.from(ww.floors.ground.tiles),sources=ww.floors.ground.sources.slice();
 r.player.x=(2052-ox)*TILE+8;r.player.y=(1830-oy)*TILE+8;markDirty();let at=NOW,seq=0;
 const step=()=>{at+=40;tick(gs,{up:false,down:false,left:true,right:false,mx:r.player.x-40,my:r.player.y,attack:false,attackPressed:false,roll:false,cancel:false} as Input,40,at);};
 for(let n=0;n<24;n++)step();
 expect(r.player.x/TILE+ox).toBeGreaterThan(2051); // closed door blocks the physical player radius
 expect(dispatch(gs,{id:`quay-${++seq}`,type:'door',eid:door.id},at)).toMatchObject({ok:true});
 for(let n=0;n<24;n++)step();
 expect(r.player.x/TILE+ox).toBeLessThan(2050); // actual body entered the room, not dry-only flood assertion
 expect(Array.from(ww.floors.ground.tiles)).toEqual(terrain);expect(ww.floors.ground.sources).toEqual(sources);
 const loaded=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));expect(loaded).not.toBeNull();expect(loaded!.run!.entities[door.id].open).toBe(true);
},20000);
