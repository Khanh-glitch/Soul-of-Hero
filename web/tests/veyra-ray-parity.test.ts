import {it,expect} from 'vitest';
import {sampleTile} from '../src/veyra05/reader';
import {sampleTile as original} from './fixtures/veyra-reader-16b0cb9';
import {FRAME_W,FRAME_H} from '../src/veyra05/frame';
it('exact scanline parity preserves every sample field at polygon edges and dense compiler rows',()=>{
 const points:Array<[number,number]>=[];let seed=731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<4000;i++)points.push([rand()%FRAME_W,rand()%FRAME_H]);
 for(const [x,y]of [[1624,1184],[744,1180],[2350,1990],[1889,494]])for(let dy=-32;dy<=32;dy++)for(let dx=-32;dx<=32;dx++)points.push([x+dx,y+dy]);
 for(const [x,y]of points)expect(sampleTile(x,y)).toEqual(original(x,y));
 const at=performance.now();for(const [x,y]of points)original(x,y);const oldMs=performance.now()-at,next=performance.now();for(const [x,y]of points)sampleTile(x,y);
 console.log(JSON.stringify({case:'exact-authored-ray',samples:points.length,oldMs,newMs:performance.now()-next}));
},30000);
