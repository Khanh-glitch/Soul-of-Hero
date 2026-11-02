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
import {Framebuffer as AFramebuffer} from '../src/arcana_a/engine/framebuffer';import {Chronoshard} from '../src/arcana_a/chronoshard';import {aTransform} from '../src/arcana_a/anchors';import {compositeA} from '../src/arcana_a/composite';
it('cropped A #18 compositor equals full frame with rotations and edge clipping',()=>{const w=640,h=360,source=new AFramebuffer(),spell=new Chronoshard();for(const [caster,target,cx,cy,t] of [[{x:320,y:180},{x:400,y:200},0,0,3.2],[{x:1000,y:750},{x:900,y:700},890,720,6.2],[{x:100,y:100},{x:95,y:60},0,0,7.2]] as const){source.clear();spell.render(source,t);source.computeBloom();const m=aTransform(caster,target),full=new Uint8ClampedArray(w*h*4);for(let i=0;i<full.length;i+=4)full.set([60,100,140,255],i);const cropped=full.slice();compositeA(full,w,h,source,m,cx,cy);const box=worldRect(m,cx,cy,w,h,source.W,source.H);const part=new Uint8ClampedArray(box.w*box.h*4);for(let y=0;y<box.h;y++)part.set(cropped.subarray(((y+box.y)*w+box.x)*4,((y+box.y)*w+box.x+box.w)*4),y*box.w*4);compositeA(part,box.w,box.h,source,m,cx+box.x,cy+box.y);for(let y=0;y<box.h;y++)cropped.set(part.subarray(y*box.w*4,(y+1)*box.w*4),((y+box.y)*w+box.x)*4);expect(cropped).toEqual(full);}},120000);
import {referenceCompositeA} from './fixtures/a_composite_reference';
it('A baseline-tone lookup is byte-identical to the previous scalar formula',()=>{const w=640,h=360,f=new AFramebuffer();new Chronoshard().render(f,5.3);f.computeBloom();const m=aTransform({x:250,y:180},{x:355,y:205}),old=new Uint8ClampedArray(w*h*4);for(let i=0;i<old.length;i+=4){const p=i/4;old[i]=(p*13)%256;old[i+1]=(p*19+7)%256;old[i+2]=(p*23+15)%256;old[i+3]=255;}const next=old.slice();referenceCompositeA(old,w,h,f,m,0,0);compositeA(next,w,h,f,m,0,0);expect(Buffer.compare(Buffer.from(old),Buffer.from(next))).toBe(0);},120000);
