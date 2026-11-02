/** P0-inspired #01 shared-clock A lead + selected C outer tongues, diagnostic.
 * Actor depth, F01 material separation, viewport post and parity remain open. */
import {CinderCrownPlayer} from '../arcana_a/cinderPlayer';import {aTransform} from '../arcana_a/anchors';import {CinderOuter} from './cinderOuter';import {Frame} from './engine/frame';
export class CinderFusion {
 readonly duration=8;readonly a=new CinderCrownPlayer();readonly c=new CinderOuter();readonly cFrame=new Frame();readonly aTransform;readonly cTransform;private shared=0;private child=0;private alive=true;
 constructor(caster:{x:number;y:number},target:{x:number;y:number}){const a=this.aTransform=aTransform(caster,target),dx=232-244,dy=124-116;this.cTransform={...a,x:a.x+a.a*dx+a.c*dy,y:a.y+a.b*dx+a.d*dy};}
 renderAtSeconds(seconds:number){if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;const want=Math.floor(seconds*60+1e-8);if(want<this.shared){this.shared=0;this.child=0;this.alive=true;}while(this.shared<want){this.shared++;const target=this.shared+41;let guard=0;while(this.alive&&this.child<target&&guard<4){this.child++;guard++;if(this.child>=468)this.alive=false;}}
  const af=this.a.renderAtSeconds(this.shared/60)!;this.cFrame.clear();this.cFrame.t=this.child/60;if(this.alive)this.c.render(this.cFrame,this.cFrame.t);return {time:af.time,cTime:this.child/60,cActive:this.alive,aFrame:af.frame,cFrame:this.cFrame,aTransform:this.aTransform,cTransform:this.cTransform};
 }
}
