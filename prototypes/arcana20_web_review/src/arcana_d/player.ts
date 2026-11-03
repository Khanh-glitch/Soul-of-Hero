/** Fixed-step source-D player. Experimental and not P0 acceptance. */
import {sourceTransform} from '../game/sourceTransform';import {ConstellationState} from './constellationState';import {constellationCommands} from './commands';import type {DCommand} from './commands';import {DWarp} from './warp';
export class DSource {
 private state=new ConstellationState();private warp=new DWarp();readonly duration=9.8;readonly transform;
 constructor(caster:{x:number;y:number},target:{x:number;y:number}){this.transform=sourceTransform(caster,target,{x:148,y:172},{x:244,y:132});}
 renderAtSeconds(seconds:number){
  if(!Number.isFinite(seconds)||seconds<0||seconds>=this.duration)return null;
  const want=Math.floor(seconds*60+1e-8),rewind=want<this.state.tick;if(rewind){this.state=new ConstellationState();this.warp=new DWarp();}
  const carryEligible=!rewind&&want-this.state.tick<=4;
  let burstTick=-1,burstCommands:DCommand[]=[],burstFlash:ReturnType<typeof constellationCommands>['flash']=null;
  while(this.state.tick<want){this.state.advanceTo((this.state.tick+1)/60);this.warp.step(this.state.tick/60);if(carryEligible&&this.state.burst){burstTick=this.state.tick;const burst=constellationCommands(this.state);burstCommands=burst.commands.filter(c=>c.role==='burst-filament');burstFlash=burst.flash;}}
  const fields=constellationCommands(this.state);
  // The source commands are never modified. An optional presentation path
  // may carry a one-tick authored flash across up to three skipped fixed
  // steps, rather than silently losing it at a low display refresh rate.
  const carriedFlash=!fields.flash&&burstTick>=0&&want-burstTick<=3?burstFlash:null;
  const carriedCommands=carriedFlash?burstCommands:[];
  return {fields,warp:this.warp,transform:this.transform,carriedFlash,carriedCommands};
 }
}
