/** Experimental source-B player, ported from original authored TS and adapted
 * to P0's field-based world pass. Not a parity or performance claim. */
import { furnaceWyrm, meteorLoom } from './effects/pyre';
import { undertowMaw } from './effects/tide';
import { Renderer } from './engine/renderer';
import type { Effect } from './engine/fx';

import { bTransform, B_CASTER, B_TARGET, type BId, type BTransform } from './anchors';
export { bTransform, transformPoint } from './anchors';
export type { BId, BTransform } from './anchors';
const effects:Record<BId,Effect> = {2:furnaceWyrm,3:meteorLoom,8:undertowMaw};
export class BSource {
  readonly renderer=new Renderer(); readonly effect:Effect; readonly state:any; readonly transform:BTransform;
  readonly id:BId; readonly duration:number;
  constructor(id:BId,caster:{x:number;y:number},target:{x:number;y:number}) {
    this.id=id;this.effect=effects[id];this.duration=this.effect.duration;
    this.renderer.caster={...B_CASTER};this.renderer.target={...B_TARGET};
    this.state=this.effect.setup(this.renderer);this.transform=bTransform(id,caster,target);
  }
  /** Fixed 60Hz authored clock; render only the most recent tick. */
  renderAtSeconds(seconds:number) {
    if (!Number.isFinite(seconds) || seconds<0 || seconds>=this.duration) return null;
    const t=Math.floor(seconds*60+1e-8)/60;
    const r=this.renderer;r.begin();this.effect.render(r,t,this.state);r.lighting();this.effect.post?.(r,t,this.state);
    return {t,r,transform:this.transform};
  }
}
