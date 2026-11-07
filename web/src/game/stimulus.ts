/** Source-identified finite impulses. They never carry player coordinates. */
import {BAL,TILE,dist,type Entity,type RunState,type WorldStimulus} from './core';
export function landingStimulus(r:RunState,e:Entity,at:number):WorldStimulus {
  const index=e.airdrop!.index,sourceId=`airdrop:${index}:${e.id}`;
  return {version:'world-stimulus-v1',id:`${sourceId}:landing`,sourceId,eventIndex:index,kind:'airdrop-landing',modality:'sound',eligibility:'audible-landing-v1',x:e.x,y:e.y,at,expiresAt:at+BAL.worldStimulusV1.signalMs,range:BAL.worldStimulusV1.landingSoundRange,strength:1};
}
/** A landing near player-built structures is not a proxy order to approach a home. */
export function stimulusNearHome(r:RunState,s:WorldStimulus) {
  return Object.values(r.entities).some(e=>e.kind==='struct' && (e.owner===undefined||e.owner==='player') && dist(e.x,e.y,s.x,s.y)<=BAL.worldStimulusV1.homeExclusionTiles*TILE);
}
/** W08: a committed player weapon release. Identity is the receipt sequence, so a retried render or reload cannot mint a second source. */
export function combatSourceId(seq:number){return `combat:${seq}`;}
export function combatStimulus(seq:number,kind:'ranged'|'melee',x:number,y:number,at:number):WorldStimulus {
  const sourceId=combatSourceId(seq);
  return {version:'world-stimulus-v1',id:`${sourceId}:sound`,sourceId,eventIndex:seq,kind:'combat-sound',modality:'sound',eligibility:kind==='ranged'?'audible-ranged-v1':'audible-melee-v1',x,y,at,expiresAt:at+BAL.worldStimulusV1.signalMs,range:BAL.worldStimulusV1.combatSoundRanges[kind],strength:1};
}
/** Adds a combat signal and keeps only the newest bounded set; older unexpired entries are dropped, never replayed. */
export function pushCombatStimulus(r:RunState,s:WorldStimulus) {
  const list=(r.worldStimuli||[]).concat(s).sort((a,b)=>a.at-b.at||a.eventIndex-b.eventIndex);
  const cap=BAL.worldStimulusV1.combatSignalCap;
  r.worldStimuli=list.length>cap?list.slice(list.length-cap):list;
}
