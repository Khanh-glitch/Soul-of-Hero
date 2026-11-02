/** Fixed-step source-D player. Experimental and not P0 acceptance. */
import {sourceTransform} from '../game/sourceTransform';import {ConstellationState} from './constellationState';import {constellationCommands} from './commands';import {DWarp} from './warp';
export class DSource {
 private state=new ConstellationState();private warp=new DWarp();readonly duration=9.8;readonly transform;
 constructor(caster:{x:number;y:number},target:{x:number;y:number}){this.transform=sourceTransform(caster,target,{x:148,y:172},{x:244,y:132});}
 renderAtSeconds(seconds:number){if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;const want=Math.floor(seconds*60+1e-8);if(want<this.state.tick){this.state=new ConstellationState();this.warp=new DWarp();}while(this.state.tick<want){this.state.advanceTo((this.state.tick+1)/60);this.warp.step(this.state.tick/60);}return {fields:constellationCommands(this.state),warp:this.warp,transform:this.transform};}
}
