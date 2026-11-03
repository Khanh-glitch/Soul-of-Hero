import {describe,it,expect} from 'vitest';import {visualTick,getVisualQuality,setVisualQuality} from '../src/game/visualQuality';
describe('experimental visual cadence, not approved shipping profiles',()=>{it('high preserves every source tick and reduced profiles quantize outside impacts',()=>{for(let i=0;i<60;i++){expect(visualTick(20,i/60,'high')).toBe(i);expect(visualTick(20,i/60,'balance')).toBe(i-i%2);expect(visualTick(20,i/60,'performance')).toBe(i-i%3);}});it('protects priority impact and blackout windows at every tick',()=>{for(const [id,start,end] of [[17,5.65,6.6],[18,4.9,6.5],[19,7.3,8.5],[20,6.25,7.65]])for(let i=Math.ceil(start*60);i<=Math.floor(end*60);i++){expect(visualTick(id,i/60,'balance')).toBe(i);expect(visualTick(id,i/60,'performance')).toBe(i);}});it('only mutates the isolated visual setting',()=>{setVisualQuality('performance');expect(getVisualQuality()).toBe('performance');setVisualQuality('high');expect(getVisualQuality()).toBe('high');});});
import {BSource} from '../src/arcana_b/player';import {CSource} from '../src/arcana_c/player';import {DSource} from '../src/arcana_d/player';import {createHash} from 'node:crypto';
function digest(arrays:Array<ArrayBufferView>){const h=createHash('sha256');for(const a of arrays)h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex');}
describe('high cadence source clock equivalence, limited samples',()=>{it('matches original raw-seconds fixed-step output for B, C and D',()=>{const a={x:104,y:150},b={x:232,y:124},b0=new BSource(2,a,b),b1=new BSource(2,a,b),c0=new CSource(7,a,b),c1=new CSource(7,a,b),d0=new DSource(a,b),d1=new DSource(a,b);for(const s of [.013,.041,1.077,3.912,5.503]){const q=visualTick(2,s,'high')/60;const bf=b0.renderAtSeconds(s)!,bg=b1.renderAtSeconds(q)!;expect(bf.t).toBe(bg.t);expect(digest([bf.r.main,bf.r.alb,bf.r.lightBuf,bf.r.worldWarp])).toBe(digest([bg.r.main,bg.r.alb,bg.r.lightBuf,bg.r.worldWarp]));const cf=c0.renderAtSeconds(s)!,cg=c1.renderAtSeconds(q)!;expect(cf.t).toBe(cg.t);expect(digest([cf.frame.ink,cf.frame.light,cf.frame.disp])).toBe(digest([cg.frame.ink,cg.frame.light,cg.frame.disp]));const df=d0.renderAtSeconds(s)!,dg=d1.renderAtSeconds(q)!;expect(df.fields.commands).toEqual(dg.fields.commands);expect(digest([df.warp.data,df.warp.influence])).toBe(digest([dg.warp.data,dg.warp.influence]));}},120000);});

describe('per-cast cadence switching',()=>{
 it('does not rewind at a forward-time quality change, but supports actual backwards seeks',async()=>{
  const {VisualClock}=await import('../src/game/visualQuality'),a=new VisualClock(),b=new VisualClock();
  expect(a.sample(20,61/60,'high')).toBe(61);
  expect(a.sample(20,61.5/60,'performance')).toBe(61);
  expect(a.sample(20,62.1/60,'performance')).toBe(61);
  expect(a.sample(20,63/60,'performance')).toBe(63);
  expect(b.sample(20,31/60,'balance')).toBe(30); // independent concurrent cast
  expect(a.sample(20,29/60,'performance')).toBe(27); // intentional rewind
  expect(a.sample(20,6.3,'performance')).toBe(378); // protected peak
 });
});
