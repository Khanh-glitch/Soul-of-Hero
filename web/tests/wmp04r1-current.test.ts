import {afterEach,describe,expect,it} from 'vitest';
import {dispatch,newGame} from '../src/game/engine';
import {getWorld,setActiveLayout} from '../src/game/world';
import {verifyWmp04R1} from '../src/game/veyra/wmp04r1';
import {serializeSnapshot,validate} from '../src/game/persist';
import {tick,type Input} from '../src/game/sim';
const T=Date.UTC(2026,10,5);const idle:Input={up:false,down:false,left:false,right:true,mx:0,my:0,attack:false,attackPressed:false,roll:false,cancel:false};
afterEach(()=>setActiveLayout('shipping'));
describe('Map owner WMP-04R1 diagnostic on current Gameplay',()=>{
 it('verifies all seven pinned rasters, current source compilation and conservative water collision',()=>{expect(verifyWmp04R1().ok).toBe(true);for(const id of ['wmp04r1-snow-highlands','wmp04r1-oasis-corridor','wmp04r1-cinder-shore','wmp04r1-deathwater-beacon']){expect(setActiveLayout(id)).toBe(true);const w=getWorld();expect(w.veyra?.worldRevision).toBe('WMP-04R1');expect(w.wmp04r1?.integrity.ok).toBe(true);expect(w.statics).toEqual([]);expect(w.buildings).toEqual([]);expect(w.sourceV3.some(Boolean)).toBe(true);for(let i=0;i<w.tiles.length;i++)if(w.economyMap.biome[i]==='water'){expect(w.economyMap.walkable[i]).toBe(0);expect(w.economyMap.cargoPassable[i]).toBe(0);}}});
 it('starts a physical run and saves its exact WMP identity without altering legacy layouts',()=>{setActiveLayout('wmp04r1-snow-highlands');const g=newGame();expect(dispatch(g,{id:'wmp-start',type:'startRun',character:'female',seed:88},T).ok).toBe(true);expect((g.run!.sourceMap as any).veyra?.worldRevision).toBe('WMP-04R1');for(let i=1;i<=8;i++)tick(g,idle,50,T+i*50);const snapshot=JSON.parse(JSON.parse(serializeSnapshot(g)).payload);expect(validate(snapshot)).toBeTruthy();snapshot.run.sourceMap.veyra.activeRevisionDigest='tampered';expect(validate(snapshot)).toBeNull();});
});
