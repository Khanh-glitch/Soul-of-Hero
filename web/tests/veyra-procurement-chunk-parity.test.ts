import {it,expect} from 'vitest';
import {getChunk as original,resetStream as resetOriginal} from './fixtures/veyra-chunks-before-procurement';
import {getChunk,resetStream} from '../src/veyra05/chunks';
it('branch-local pure FBM preserves every canonical byte including original decor (not a visual quality reduction)',()=>{
 resetOriginal();resetStream();
 let samples=0;const features=new Set<number>();
 for(const [x,y]of [[1640,1170],[3200,1750],[1370,1970],[2520,750],[1610,1500],[2340,2550],[2500,980],[500,500],[2500,200],[3500,2200],[1000,1000],[50,50]])for(const [dx,dy]of [[0,0],[1,0],[0,1],[-1,0],[0,-1]]){
  const cx=Math.floor(x/32)+dx,cy=Math.floor(y/32)+dy,a=getChunk(cx,cy),b=original(cx,cy);
  for(const field of ['tile','flags','biome','feature','poi','zone','clim','elev','node'] as const)expect(a[field]).toEqual(b[field]);
  for(const f of a.feature)features.add(f);samples+=a.tile.length;
 }
 expect(samples).toBe(61440);expect(features.size).toBeGreaterThan(20);
},30000);
