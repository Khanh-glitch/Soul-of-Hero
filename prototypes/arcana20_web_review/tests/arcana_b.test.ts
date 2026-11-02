import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Renderer, SET, BLEND } from '../src/arcana_b/engine/renderer';
import { BSource,bTransform,transformPoint,type BId } from '../src/arcana_b/player';
import { compositeB } from '../src/arcana_b/composite';
import { referenceCompositeB } from './fixtures/b_composite_reference';

function digest(r:Renderer) {const h=createHash('sha256');for(const a of [r.main,r.alb,r.shade,r.inkCoverage,r.decalCoverage,r.lightBuf,r.worldWarp,r.worldInfluence])h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex');}
describe('experimental source-B field producer, not P0 parity validation',()=>{
 it('preserves an untouched live scene and transports authored black coverage, not RGB keys',()=>{
  const r=new Renderer();r.begin();const world=new Uint8ClampedArray(384*216*4);for(let i=0;i<world.length;i+=4)world.set([128,160,180,255],i);
  const before=world.slice();const m={a:1,b:0,c:0,d:1,x:0,y:0};compositeB(world,384,216,r,m,0,0);expect(world).toEqual(before);
  r.plot(10,10,0,0,0,SET,1);expect(r.inkCoverage[10+10*384]).toBe(1);compositeB(world,384,216,r,m,0,0);
  expect(world[(10+10*384)*4]).toBeLessThan(before[(10+10*384)*4]);expect(world.slice(0,4)).toEqual(before.slice(0,4));
 });
 it('composes coverage, including black, through sequential warps',()=>{
  const r=new Renderer();r.begin();r.plot(12,10,0,0,0,SET,1);r.plot(20,10,1,0,0,BLEND,.5);expect(r.inkCoverage[20+10*384]).toBe(.5);
  r.warp(10,10,10,10,(_x,_y,o)=>{o[0]=11;o[1]=10});
  r.warp(9,10,9,10,(_x,_y,o)=>{o[0]=10;o[1]=10});
  expect(r.worldWarp[(9+10*384)*2]).toBe(2);
  r.warp(11,10,11,10,(_x,_y,o)=>{o[0]=12;o[1]=10});
  expect(r.inkCoverage[11+10*384]).toBe(1);expect(r.worldInfluence[11+10*384]).toBe(1);
 });
 it.each([[2,5.12],[3,7.25],[8,5.3]] as [BId,number][])('optimized pixel compositor matches scalar reference for source %i', (id,t)=>{
  const b=new BSource(id,{x:110,y:110},{x:210,y:145}),f=b.renderAtSeconds(t)!;
  const width=240,height=180,world=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<world.length;i+=4){world[i]=(i*7)%256;world[i+1]=(i*3)%256;world[i+2]=(i*13)%256;world[i+3]=255;}
  const expected=world.slice();referenceCompositeB(expected,width,height,f.r,f.transform,0,0);compositeB(world,width,height,f.r,f.transform,0,0);
  expect(world).toEqual(expected);
 });
 it('pins the correct authored center to the actual target while keeping meteor/maw world-up',()=>{
  for(const id of [2,3,8] as BId[]){const target={x:280,y:200},m=bTransform(id,{x:180,y:245},target);
   const anchor=id===2?{x:262,y:104}:{x:192+(id===3?16:26),y:112};const p=transformPoint(m,anchor);
   expect(p.x).toBeCloseTo(target.x,8);expect(p.y).toBeCloseTo(target.y,8);if(id!==2)expect(m.b).toBe(0);
  }
 });
 it.each([[2,5.12],[3,7.25],[8,5.3]] as [BId,number][])('source effect %i deterministically produces authored fields and expires', (id,t)=>{
  const a=new BSource(id,{x:100,y:100},{x:200,y:100});const frame=a.renderAtSeconds(t)!;
  expect(frame.r.worldInfluence.some(v=>v!==0)).toBe(true);const first=digest(frame.r);
  const again=a.renderAtSeconds(t)!;expect(digest(again.r)).toBe(first);
  expect(a.renderAtSeconds(a.duration)).toBeNull();expect(a.renderAtSeconds(-1)).toBeNull();
 });
});
