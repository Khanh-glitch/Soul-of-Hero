import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Frame } from '../src/arcana_c/engine/frame';
import { CSource,cTransform,type CId } from '../src/arcana_c/player';
import { compositeC } from '../src/arcana_c/composite';
import { transformPoint } from '../src/arcana_b/anchors';
import { C_ANCHOR } from '../src/arcana_c/anchors';
function digest(f:Frame){const h=createHash('sha256');for(const a of [f.ground,f.groundCoverage,f.ink,f.light,f.disp,f.worldInfluence,f.worldFragment])h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex')}
describe('experimental source-C field producer, not P0 parity validation',()=>{
 it('keeps untouched world pixels and applies black authored ink and ground separately',()=>{
  const f=new Frame();f.clear();const data=new Uint8ClampedArray(384*216*4);for(let i=0;i<data.length;i+=4)data.set([128,160,180,255],i);
  const before=data.slice(),m={a:1,b:0,c:0,d:1,x:0,y:0};compositeC(data,384,216,f,m,0,0);expect(data).toEqual(before);
  f.I(10,10,0,0,0,1);f.G(11,10,0,0,0,1);compositeC(data,384,216,f,m,0,0);
  expect(data[(10+10*384)*4]).toBe(0);expect(data[(11+10*384)*4]).toBe(0);expect(data[0]).toBe(before[0]);
 });
 it('source-world fragments sample live terrain and preserve ink coverage',()=>{
  const f=new Frame();f.clear();const world=new Uint8ClampedArray(384*216*4);for(let i=0;i<world.length;i+=4)world.set([30,50,70,255],i);
  world.set([210,120,40,255],(4*384+3)*4);f.blitBase(3,4,1,1,10,10);f.I(10,10,0,0,0,.5);
  compositeC(world,384,216,f,{a:1,b:0,c:0,d:1,x:0,y:0},0,0);const i=(10*384+10)*4;
  expect([...world.slice(i,i+3)]).toEqual([105,60,20]);
 });
 it('records horizon blackout as viewport post, not a black rectangle',()=>{
  const f=new CSource(17,{x:100,y:100},{x:200,y:100}).renderAtSeconds(6)!;
  expect(f.post.stageBlackout).toBe(true);expect(f.frame.worldInfluence.reduce((a,b)=>a+b,0)).toBeLessThan(10);
 });
 it('pins source targets to world targets where scale is not clamped',()=>{
  for(const id of [7,10,17] as CId[]){const target={x:340,y:200},m=cTransform(id,{x:200,y:200},target),p=transformPoint(m,C_ANCHOR[id]);expect(p.x).toBeCloseTo(target.x,8);expect(p.y).toBeCloseTo(target.y,8);}
 });
 it.each([[7,6.62],[10,4.84],[17,6.45]] as [CId,number][])('source %i fixed-step state is repeatable, including backwards seek',(id,t)=>{
  const one=new CSource(id,{x:100,y:100},{x:200,y:100}),two=new CSource(id,{x:100,y:100},{x:200,y:100});
  const a=one.renderAtSeconds(t)!;expect(a.frame.worldInfluence.some(v=>v!==0)).toBe(true);const first=digest(a.frame);
  expect(digest(two.renderAtSeconds(t)!.frame)).toBe(first);one.renderAtSeconds(1);expect(digest(one.renderAtSeconds(t)!.frame)).toBe(first);
  expect(one.renderAtSeconds(one.duration)).toBeNull();
 });
});
