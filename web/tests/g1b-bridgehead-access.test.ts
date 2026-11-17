/** Controlled bridgehead inspection, no source relocation, terrain edits or grants.
 * The frozen source is in wadeable river: this is not a dry cargo/drop-placement claim. */
import {afterEach,it,expect} from 'vitest';
import {getWindowWorld} from '../src/veyra05/window';
import {layoutIdAt} from '../src/veyra05/scenes';
import {newGame,startRun,blockGrid,C,dispatch,g1bEntities,markDirty} from '../src/game/engine';
import {setActiveLayout} from '../src/game/world';
import {WW,TILE} from '../src/game/core';
import {__openSite} from './helpers/g1b-ecology';
import {serializeSnapshot,validate} from '../src/game/persist';
const SID='veyra.g1b:br_5:toolbox_damaged:head.01',NOW=Date.UTC(2026,10,17);
afterEach(()=>setActiveLayout('shipping'));
for(const [ox,oy]of [[1840,1526],[1857,1535]])it(`opens the real wading bridgehead source at ${ox},${oy} and persists one roll`,()=>{
 const layout=layoutIdAt(ox,oy);setActiveLayout(layout);const gs=newGame();expect(startRun(gs,'female',NOW,null,101).ok).toBe(true);
 const r=gs.run!,ww=getWindowWorld(layout),ground=ww.floors.ground;
 const e=Object.values(r.entities).find(e=>e.g1b?.sid===SID)!;expect(e).toBeDefined();
 expect([e.tx!+ox,e.ty!+oy]).toEqual([1940,1626]);expect(e.g1b!.state).toBe('closed');
 const survey=__openSite(ox+100,oy+100)!;expect(survey).not.toBeNull();
 expect(survey.pass(0,1940,1626)).toBe(false); // dry source-placement policy is unchanged
 expect(survey.playerPass(0,1940,1626)).toBe(true); // audit-only foot traversal
 expect(ground.walkable[(1626-oy)*WW+1940-ox]).toBe(0); // raw river mask is NOT the player's collision authority
 r.player.x=(1940-ox)*TILE+8;r.player.y=(1625-oy)*TILE+8;markDirty();
 expect(blockGrid(r)[(1625-oy)*WW+1940-ox]).toBe(4);
 expect(dispatch(gs,{id:'bridge-open',type:'g1bOpen',eid:e.id},NOW+1)).toMatchObject({ok:true});
 expect(e.g1b!.state).toBe('opened');expect(C(r,e.c!).slots.some(Boolean)).toBe(true);
 const slots=JSON.stringify(C(r,e.c!)),cycle=e.g1b!.cycle,ids=g1bEntities(r).map(e=>e.g1b!.sid).sort();
 const loaded=validate(JSON.parse(JSON.parse(serializeSnapshot(gs)).payload));expect(loaded).not.toBeNull();
 expect(JSON.stringify(C(loaded!.run!,e.c!))).toBe(slots);expect(loaded!.run!.entities[e.id].g1b!.cycle).toBe(cycle);
 expect(g1bEntities(loaded!.run!).map(e=>e.g1b!.sid).sort()).toEqual(ids);
 expect(dispatch(loaded!,{id:'bridge-open',type:'g1bOpen',eid:e.id},NOW+2)).toMatchObject({ok:false,dup:true});
 expect(JSON.stringify(C(loaded!.run!,e.c!))).toBe(slots);
},20000);
