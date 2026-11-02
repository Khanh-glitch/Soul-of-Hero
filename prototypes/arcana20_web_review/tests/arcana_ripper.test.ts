import {describe,it,expect} from 'vitest';import {RipperContour} from '../src/arcana_c/fusion20/contour';import {RipperDebris} from '../src/arcana_c/fusion20/debris';
describe('P0 #20 contour and debris scaffolding (not visual parity)',()=>{
 it('retains the deterministic nine-point C spine and fixed C/A phase mapping',()=>{const c=new RipperContour();expect(c.way).toHaveLength(9);expect(c.way).toEqual(new RipperContour().way);expect(c.at(0)).toMatchObject({x:86,y:62});expect(c.at(1).x).toBeCloseTo(334);expect(c.at(1).y).toBeCloseTo(172);expect(c.aTime(3)).toBeCloseTo(1);expect(c.aTime(6.6)).toBeCloseTo(5.3);expect(c.aTime(7.15)).toBeCloseTo(6.1);expect(c.width(.5,2.9)).toBe(0);expect(c.width(.5,6)).toBeGreaterThan(0);expect(c.width(.5,10)).toBe(0);});
 it('replays A debris deterministically at fixed steps and never manufactures world pixels',()=>{const c=new RipperContour(),a=new RipperDebris(),b=new RipperDebris();a.advanceTo(5.5,c);for(let t=0;t<=330;t++)b.advanceTo(t/60,c);expect(a.particles).toEqual(b.particles);expect(a.particles.length).toBeGreaterThan(0);expect(a.particles.length).toBeLessThanOrEqual(343);expect(()=>a.advanceTo(1,c)).toThrow();a.advanceTo(8,c);expect(a.particles).toHaveLength(0);});
});

import {CSource} from '../src/arcana_c/player';import {Frame,W,H} from '../src/arcana_c/engine/frame';import {compositeC} from '../src/arcana_c/composite';
describe('experimental #20 fusion live-world fields, not P0 parity',()=>{
 it('retains the C interior and A pull, world fragments, additive debris and remainder',()=>{
  const src=new CSource(20,{x:112,y:126},{x:210,y:116});
  const open=src.renderAtSeconds(4.5)!.frame;expect(open.worldFragment.some((v,i)=>i%4===3&&v===1)).toBe(true);expect(open.disp.some((v,i)=>i%4===0&&v!==0)).toBe(true);
  const collision=src.renderAtSeconds(6.8)!.frame;expect(collision.worldFragment.some((v,i)=>i%4===2&&v===1)).toBe(true);expect(collision.liveLight.size).toBeGreaterThan(0);
  const close=src.renderAtSeconds(9.5)!.frame;expect(close.worldFragment.some((v,i)=>i%4===3&&v===2)).toBe(true);expect(close.liveLight.size).toBe(0);
  expect(src.renderAtSeconds(10.4)).toBeNull();
 });
 it('composites every overlapping additive live-world sample and authored inversion without brightness keys',()=>{
  const f=new Frame(),m={a:1,b:0,c:0,d:1,x:0,y:0};f.clear();f.worldSample(4,4,1,1,1);f.worldSample(5,4,1,1,2);f.addLiveWorldLight(6,4,1,1,.25);f.addLiveWorldLight(6,4,2,1,.5);
  expect(f.liveLight.get(4*W+6)).toHaveLength(2);const data=new Uint8ClampedArray(W*H*4);for(let i=0;i<data.length;i+=4){data[i]=64;data[i+1]=128;data[i+2]=192;data[i+3]=255;}const at=(x:number,y:number,c=0)=>(y*W+x)*4+c;data[at(1,1)]=0;data[at(2,1)]=200;compositeC(data,W,H,f,m,0,0);
  expect(data[at(4,4)]).not.toBe(64);expect(data[at(5,4)]).toBe(255);expect(data[at(6,4)]).toBeGreaterThan(64);expect(data[at(8,4)]).toBe(64);
 });
});
