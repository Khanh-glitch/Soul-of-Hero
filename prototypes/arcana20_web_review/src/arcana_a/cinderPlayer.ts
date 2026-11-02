/** #01 A lead only. Fixed-step player; not a complete or approved fusion. */
import {CinderCrown} from './cinderCrown';import {Framebuffer} from './engine/framebuffer';
export class CinderCrownPlayer {
 readonly duration=8;readonly frame=new Framebuffer();private spell=new CinderCrown();tick=0;
 renderAtSeconds(seconds:number){if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;const want=Math.floor(seconds*60+1e-8);if(want<this.tick){this.spell=new CinderCrown();this.tick=0;}while(this.tick<want){this.tick++;this.spell.update(1/60,this.tick/60);}this.frame.clear();this.spell.render(this.frame,this.tick/60);this.frame.computeBloom();return {frame:this.frame,time:this.tick/60};}
}
