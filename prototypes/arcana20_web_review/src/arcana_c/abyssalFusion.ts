/** Internal #05 shared-clock scaffold; not yet mounted in the game.
 * A opening is drawn above C release. C runs +0.6s with P0 FusionPlayer's
 * maximum four child steps per shared tick, then retires at C 8.6s.
 * B's directed-water layer and actual live-world composites are not here. */
import {AbyssalLead} from '../arcana_a/abyssalLead';import {Framebuffer} from '../arcana_a/engine/framebuffer';import {aTransform} from '../arcana_a/anchors';import {Frame} from './engine/frame';import {Rng} from './engine/math';import {abyssalLate,abyssalUpright} from './abyssalLate';import type {FX,Inst} from './spells/types';import type {RGB} from './engine/palette';
export class AbyssalFusion {
 readonly duration=8.6;readonly aFrame=new Framebuffer();readonly cFrame=new Frame();readonly aTransform;readonly cTransform;readonly opening=new AbyssalLead();
 private shared=0;private child=0;private alive=true;private c!:Inst;private shake=0;private flash=0;private flashColor:RGB=[0,0,0];private kick=0;private fx!:FX;
 constructor(caster:{x:number;y:number},target:{x:number;y:number}){this.aTransform=aTransform(caster,target);this.cTransform=abyssalUpright(caster,target);this.reset();}
 private reset(){this.shared=0;this.child=0;this.alive=true;this.shake=this.flash=this.kick=0;this.fx={shake:a=>{this.shake=Math.max(this.shake,a)},flash:(c,k)=>{if(k>=this.flash*.6){this.flashColor=c;this.flash=Math.max(this.flash,k)}},kick:k=>{this.kick=Math.max(this.kick,k)},invert:0,desat:0,chroma:0,bloom:1,ambient:1,ambientEcho:0};this.c=abyssalLate.make(new Rng(32676),this.fx);}
 renderAtSeconds(seconds:number){if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;const wanted=Math.floor(seconds*60+1e-8);if(wanted<this.shared)this.reset();while(this.shared<wanted){this.shared++;const target=this.shared+36;let guard=0;while(this.alive&&this.child<target&&guard<4){this.child++;guard++;const t=this.child/60;this.fx.ambient=1;this.fx.ambientEcho=0;this.c.update(1/60,t);this.shake*=.86;if(this.shake<.3)this.shake=0;this.flash*=.82;this.kick*=.88;if(t>=8.6)this.alive=false;}}
  this.aFrame.clear();this.opening.render(this.aFrame,this.shared/60);this.cFrame.clear();this.cFrame.t=this.child/60;this.fx.invert=0;this.fx.desat=0;this.fx.chroma=0;this.fx.bloom=1;if(this.alive)this.c.render(this.cFrame,this.child/60);return {sharedTime:this.shared/60,cTime:this.child/60,cActive:this.alive,aFrame:this.aFrame,cFrame:this.cFrame,aTransform:this.aTransform,cTransform:this.cTransform,post:{stageShade:this.cFrame.stageShade,stageBlackout:this.cFrame.stageBlackout,shake:this.alive?this.shake:0,flash:this.alive?this.flash:0,flashColor:this.flashColor,kick:this.alive?this.kick:0,invert:this.fx.invert,desat:this.fx.desat,chroma:this.fx.chroma}};
 }
}
