import {describe,it,expect} from 'vitest';
import {WW,T,TILE} from '../src/game/core';
import {blockGrid,dispatch,markDirty,newGame,startRun} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {layoutIdAt} from '../src/veyra05/scenes';
import {getWindowWorld} from '../src/veyra05/window';
import {activeFloor,authoredPlan} from '../src/veyra05/floors';
import {G1B_SOURCE_SITES} from '../src/game/g1b';
import {tick,type Input} from '../src/game/sim';
import {serializeSnapshot,validate} from '../src/game/persist';

const NOW=Date.UTC(2026,10,17,11),N4=[[1,0],[-1,0],[0,1],[0,-1]];
describe('Hook Garden Cottage actual compiled approach, not census classification',()=>{
  for(const [ox,oy]of [[2499,590],[2516,599]])it(`normal door path at streamed origin ${ox},${oy}`,()=>{
    const layout=layoutIdAt(ox,oy);expect(setActiveLayout(layout)).toBe(true);
    const gs=newGame();expect(startRun(gs,'male',NOW,null,101).ok).toBe(true);
    const r=gs.run!,ww=getWindowWorld(layout),floor=ww.floors.ground;
    expect(activeFloor(r)).toBe(0);
    const index=(x:number,y:number)=>(y-oy)*WW+x-ox;
    const door=Object.values(r.entities).find(e=>e.kind==='door'&&e.tx===2599-ox&&e.ty===690-oy);
    expect(door,'the real authored North door was instantiated').toBeDefined();
    const walk=(start:[number,number])=>{const grid=blockGrid(r),seen=new Set<string>(),q=[start];while(q.length){const [x,y]=q.pop()!,k=`${x},${y}`;if(seen.has(k)||x<2589||x>2608||y<686||y>701||grid[index(x,y)]!==0)continue;seen.add(k);for(const [dx,dy]of N4)q.push([x+dx,y+dy]);}return seen;};
    const exterior:[number,number]=[2599,688];
    expect(blockGrid(r)[index(...exterior)]).toBe(0);
    expect(walk(exterior).has('2599,689'),'outside standable approach').toBe(true);
    expect(walk(exterior).has('2599,691'),'closed door prevents entering cottage').toBe(false);
    r.player.x=(2599-ox)*TILE+8;r.player.y=(689-oy)*TILE+8;
    expect(dispatch(gs,{id:'hook-open',type:'door',eid:door!.id},NOW+1)).toMatchObject({ok:true});
    expect(door!.open).toBe(true);markDirty();
    expect(walk(exterior).has('2599,691'),'open door leads into physical interior').toBe(true);
    expect(floor.tiles[index(2599,691)]).not.toBe(T.PWALL);
    expect(floor.solidProps[index(2599,691)]).toBe(0);
    // Technical collision proof with ordinary movement input, not teleporting inside.
    r.creatures=[];let now=NOW+1;
    for(let n=0;n<15;n++){
      now+=40;tick(gs,{up:false,down:true,left:false,right:false,mx:r.player.x,my:r.player.y+40,
        attack:false,attackPressed:false,roll:false,cancel:false} as Input,40,now);
    }
    expect(r.player.y/TILE+oy,'player radius can pass the open threshold').toBeGreaterThan(691);
    expect(r.player.y/TILE+oy).toBeLessThan(698);
    expect(activeFloor(r)).toBe(0);
    const plan=authoredPlan('po_hook')!;
    expect(plan.levels.get(0)!.doors.find(d=>d.x===2598&&d.y===693)?.kind).toBe('arch');
    const reloaded=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));expect(reloaded).not.toBeNull();
    expect(reloaded!.run!.entities[door!.id].open).toBe(true);
    // Frozen ecology deliberately assigns no chest to this previously unreachable room.
    // Proving a door route must NOT fabricate a source, relocate one or grant loot.
    expect(G1B_SOURCE_SITES.filter(s=>s.site==='po_hook'&&s.gx>=2592&&s.gx<2606&&s.gy>=690&&s.gy<699)).toEqual([]);
  },120000);
});
