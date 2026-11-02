/** Experimental source-C effects under diagnostic development; not P0 acceptance. */
import type { BTransform } from '../arcana_b/anchors';
import { ripperFusion } from './fusion20/ripper';
import { Frame } from './engine/frame';
import { Rng } from './engine/math';
import { TIDE } from './spells/tide';
import { TEMPEST } from './spells/tempest';
import { ASTRAL } from './spells/astral';
import type { FX,Inst,SpellDef } from './spells/types';
import type { RGB } from './engine/palette';
import { cTransform,type CId } from './anchors';
export {cTransform} from './anchors';
export type {CId} from './anchors';
const effects:Record<CId,SpellDef>={7:TIDE[2],10:TEMPEST[1],17:ASTRAL[0],20:ripperFusion};
export class CSource {
  readonly frame=new Frame();readonly def:SpellDef;readonly transform:BTransform;
  readonly id:CId; readonly duration:number; tick=0; private instance!:Inst;private shake=0;private flash=0;private flashColor:RGB=[0,0,0];private kick=0;
  private fx:FX;
  constructor(id:CId,caster:{x:number;y:number},target:{x:number;y:number}){
    this.id=id;this.def=effects[id];this.duration=this.def.dur;this.transform=cTransform(id,caster,target);
    this.fx={shake:a=>{this.shake=Math.max(this.shake,a)},flash:(c,k)=>{if(k>=this.flash*.6){this.flashColor=c;this.flash=Math.max(this.flash,k)}},kick:k=>{this.kick=Math.max(this.kick,k)},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};this.reset();
  }
  private reset(){this.tick=0;this.shake=this.flash=this.kick=0;this.fx.ambient=1;this.fx.ambientEcho=0;this.instance=this.def.make(new Rng(1000+(this.id-1)*7919),this.fx)}
  renderAtSeconds(seconds:number){
    if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;
    const want=Math.floor(seconds*60+1e-8);if(want<this.tick)this.reset();
    while(this.tick<want){this.tick++;this.fx.ambient=1;this.fx.ambientEcho=0;this.instance.update(1/60,this.tick/60);this.shake*=.86;if(this.shake<.3)this.shake=0;this.flash*=.82;this.kick*=.88;}
    const t=this.tick/60;this.frame.clear();this.frame.t=t;this.fx.invert=0;this.fx.desat=0;this.fx.chroma=0;this.fx.bloom=1;this.instance.render(this.frame,t);
    return {t,frame:this.frame,transform:this.transform,post:{stageShade:this.frame.stageShade,stageBlackout:this.frame.stageBlackout,shake:this.shake,flash:this.flash,flashColor:this.flashColor,kick:this.kick,invert:this.fx.invert,desat:this.fx.desat,chroma:this.fx.chroma}};
  }
}
