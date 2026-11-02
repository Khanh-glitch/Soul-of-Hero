/** #05 P0 C release component, not a complete registered skill.
 * P0 CAbyssalBloomLate retains the original C Tide #05 setup and simulation,
 * but suppresses all C rendering before TP=5.6; A owns the opening.
 * The parent fusion must advance the C clock by +0.6s and orient target-up. */
import {TIDE} from './spells/tide';import type {SpellDef} from './spells/types';
const original=TIDE[0];
export const abyssalLate:SpellDef={...original,name:'Abyssal Bloom C release (component)',make(rng,fx){const source=original.make(rng,fx);return {update:(dt,t)=>source.update(dt,t),render:(f,t)=>{if(t>=5.6)source.render(f,t);}};}};
/** P0 upright target anchor for gravity/column, same scale as C's basis. */
export function abyssalUpright(caster:{x:number;y:number},target:{x:number;y:number}){const anchor={x:252,y:112},len=Math.hypot(target.x-caster.x,target.y-caster.y),scale=len>1?Math.max(.6,Math.min(3.5,len/Math.hypot(140,-14))):1;return {a:scale,b:0,c:0,d:scale,x:target.x-anchor.x*scale,y:target.y-anchor.y*scale};}
