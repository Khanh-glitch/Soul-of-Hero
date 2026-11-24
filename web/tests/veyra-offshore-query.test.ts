import {it,expect} from 'vitest';
import {globalBaseGeometry,globalBaseFreshMask,globalSourceCandidates,buildWindowWorld} from '../src/veyra05/window';
import {T} from '../src/game/core';
it('investigating a remote sea cell does not require a player spawn or create a resource or floor',()=>{
 const gx=48,gy=48,id='veyra05-at-0-0';
 expect(globalBaseGeometry(gx,gy,0,4)).toMatchObject({tile:T.DEEP,walkable:false,source:null,fresh:false});
 expect(globalBaseFreshMask(gx,gy)).toBe(false);
 expect(globalBaseGeometry(gx,gy,-1,4)).toBeNull();
 expect(globalSourceCandidates(gx,gy,0,4,new Set(['mushroom']))).toEqual([]);
 expect(()=>buildWindowWorld(id,4)).toThrow('No walkable terrain');
});
