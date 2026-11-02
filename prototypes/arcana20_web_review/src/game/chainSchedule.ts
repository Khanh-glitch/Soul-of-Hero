/** Deterministic #09 source graph timings; damage amounts are web proposals. */
import {RNG} from '../arcana_a/engine/math';
export type ChainEvent={a:number;b:number;t0:number;fail:boolean;seed:number};
const ORDER=[0,1,2,7,3,4,5,6,7,2];
export function makeChainEvents(rng:RNG){const events:ChainEvent[]=[];let tt=1.35;for(let i=0;i<ORDER.length-1;i++){let f=0;while(f<rng.int(1,2)){events.push({a:ORDER[i],b:rng.int(0,7),t0:tt,fail:true,seed:rng.int(0,9999)});tt+=.07;f++;}events.push({a:ORDER[i],b:ORDER[i+1],t0:tt,fail:false,seed:rng.int(0,9999)});tt+=rng.range(.22,.42);}return events;}
export function chainSchedule(){return makeChainEvents(new RNG(0x9c4a));}
export function chainContacts(events:ChainEvent[]){const success=events.filter(e=>!e.fail),contacts=success.map(e=>({a:e.a,b:e.b,time:e.t0}));success.forEach((e,i)=>contacts.push({a:e.a,b:e.b,time:5+i*.028+.02}));return contacts.sort((a,b)=>a.time-b.time);}
