import {describe,it,expect,vi} from 'vitest';
import {CinderCrownPlayer} from '../src/arcana_a/cinderPlayer';
import {CinderCrown as Original} from '../../arcana_fusion20/original_source/package/handoff/sources/A/src/spells/pyre';
import {Framebuffer as OriginalFramebuffer} from '../../arcana_fusion20/original_source/package/handoff/sources/A/src/engine/framebuffer';

describe('source-A #01 lead component, not a complete fusion or P0 visual acceptance',()=>{
 it('matches original A raw RGB and flash through sampled fixed-step clocks including OUT',()=>{
  vi.stubGlobal('ImageData',class {data:Uint8ClampedArray;constructor(public width:number,public height:number){this.data=new Uint8ClampedArray(width*height*4);}});
  try{const original=new Original(),fb=new OriginalFramebuffer(416,234),adapted=new CinderCrownPlayer();let tick=0;
   for(const target of [1.5,3.8,3.95,4,4.5,5.2,6.6,7.8]){const want=Math.round(target*60);while(tick<want){tick++;original.update(1/60,tick/60);}fb.clear();original.render(fb,tick/60);const out=adapted.renderAtSeconds(target)!;expect(out.time).toBeCloseTo(target);expect(out.frame.flash).toEqual(fb.flash);expect(out.frame.buf).toEqual(fb.buf);}
  }finally{vi.unstubAllGlobals();}
 });
 it('replays deterministically after backwards seeks with independent simulation',()=>{const a=new CinderCrownPlayer(),b=new CinderCrownPlayer();const first=a.renderAtSeconds(4.5)!.frame.buf.slice();a.renderAtSeconds(7.8);a.renderAtSeconds(2);const second=a.renderAtSeconds(4.5)!.frame.buf;expect(second).toEqual(first);expect(b.renderAtSeconds(4.5)!.frame.buf).toEqual(first);expect(a.renderAtSeconds(8)).toBeNull();});
});
