import {describe,it,expect} from 'vitest';
import { BSource,type BId } from '../src/arcana_b/player';
import { CSource,type CId } from '../src/arcana_c/player';
import { compositeB } from '../src/arcana_b/composite';
import { compositeC } from '../src/arcana_c/composite';
import { worldRect } from '../src/arcana_b/worldRect';

describe('field ROI cropping, not P0 parity',()=>{
 it.each([[2,5.12],[3,7.25],[8,5.3],[7,6.62],[10,4.84],[17,6.45],[20,6.8],[20,9.5]] as [BId|CId,number][])('cropped output equals full-scene output for source %i',(id,t)=>{
  const isB=id===2||id===3||id===8;const s=isB?new BSource(id as BId,{x:185,y:130},{x:290,y:190}):new CSource(id as CId,{x:185,y:130},{x:290,y:190});
  const frame=s.renderAtSeconds(t)!;const f='r' in frame?frame.r:frame.frame,m=frame.transform;
  const width=384,height=240,original=new Uint8ClampedArray(width*height*4);for(let i=0;i<original.length;i+=4)original.set([(i*3)%256,(i*7)%256,(i*11)%256,255],i);
  const full=original.slice(), cropped=original.slice(),box=worldRect(m,0,0,width,height),sub=new Uint8ClampedArray(box.w*box.h*4);
  for(let y=0;y<box.h;y++)sub.set(original.subarray(((y+box.y)*width+box.x)*4,((y+box.y)*width+box.x+box.w)*4),y*box.w*4);
  if(isB){compositeB(full,width,height,f as BSource['renderer'],m,0,0);compositeB(sub,box.w,box.h,f as BSource['renderer'],m,box.x,box.y);}
  else{compositeC(full,width,height,f as CSource['frame'],m,0,0);compositeC(sub,box.w,box.h,f as CSource['frame'],m,box.x,box.y);}
  for(let y=0;y<box.h;y++)cropped.set(sub.subarray(y*box.w*4,(y+1)*box.w*4),((y+box.y)*width+box.x)*4);
  expect(cropped).toEqual(full);
 });
});
