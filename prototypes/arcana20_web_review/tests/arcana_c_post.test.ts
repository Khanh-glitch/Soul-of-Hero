import {describe,it,expect} from 'vitest';import {combineCPost,compositeCPost,hasCPost} from '../src/arcana_c/post';
const neutral=()=>({shakeX:0,shakeY:0,chroma:0,invert:0,desat:0,flash:[0,0,0] as [number,number,number]});
describe('C optional LDR pre-HUD post (not HDR or P0 acceptance)',()=>{
 it('leaves neutral scenes unchanged and preserves black pixels',()=>{const d=new Uint8ClampedArray([0,0,0,255,100,130,200,255]),before=d.slice();compositeCPost(d,2,1,neutral());expect(d).toEqual(before);});
 it('applies channel-swizzled inversion to live world, not a background',()=>{const d=new Uint8ClampedArray([0,64,128,255]);const p={...neutral(),invert:1};compositeCPost(d,1,1,p);expect([...d]).toEqual([191,127,255,255]);});
 it('arbitrates overlap deterministically and expires on empty input',()=>{const m={a:1,b:0,c:0,d:1,x:0,y:0},p={tick:396,transform:m,shake:10,flash:.35,flashColor:[1,.5,1] as [number,number,number],kick:6,chroma:0,invert:1,desat:.1},combined=combineCPost([p,p]);expect(combined.invert).toBe(1);expect(combined.chroma).toBe(6);expect(combined.flash[0]).toBeCloseTo(.196);expect(hasCPost(combined)).toBe(true);expect(hasCPost(combineCPost([]))).toBe(false);});
});
import {CSource} from '../src/arcana_c/player';
it('exposes actual #20 collision inversion only during the authored interval',()=>{const s=new CSource(20,{x:112,y:126},{x:210,y:116});expect(s.renderAtSeconds(6.58)!.post.invert).toBe(0);expect(s.renderAtSeconds(6.6)!.post.invert).toBe(1);expect(s.renderAtSeconds(6.7)!.post.invert).toBe(0);});
