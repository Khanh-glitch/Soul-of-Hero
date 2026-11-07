/** Source-identified finite impulses. They never carry player coordinates. */
import {BAL,TILE,dist,type Entity,type RunState,type WorldStimulus} from './core';
export function landingStimulus(r:RunState,e:Entity,at:number):WorldStimulus {
  const index=e.airdrop!.index,sourceId=`airdrop:${index}:${e.id}`;
  return {version:'world-stimulus-v1',id:`${sourceId}:landing`,sourceId,eventIndex:index,kind:'airdrop-landing',modality:'sound',eligibility:'audible-landing-v1',x:e.x,y:e.y,at,expiresAt:at+BAL.worldStimulusV1.signalMs,range:BAL.worldStimulusV1.landingSoundRange,strength:1};
}
/** W08: a committed player weapon release. Identity is the receipt sequence, so a retried render or reload cannot mint a second source. */
export function combatSourceId(seq:number){return `combat:${seq}`;}
/** Eligibility per committed combat kind. Persist validation derives kind from eligibility through this single table. */
export const COMBAT_ELIGIBILITY = {ranged:'audible-ranged-v1',melee:'audible-melee-v1',signature:'audible-signature-v1'} as const;
export type CombatKind = keyof typeof COMBAT_ELIGIBILITY;
export function combatKindOf(eligibility:unknown):CombatKind|undefined {
  return (Object.keys(COMBAT_ELIGIBILITY) as CombatKind[]).find(k=>COMBAT_ELIGIBILITY[k]===eligibility);
}
export function combatStimulus(seq:number,kind:CombatKind,x:number,y:number,at:number):WorldStimulus {
  const sourceId=combatSourceId(seq);
  return {version:'world-stimulus-v1',id:`${sourceId}:sound`,sourceId,eventIndex:seq,kind:'combat-sound',modality:'sound',eligibility:COMBAT_ELIGIBILITY[kind] as any,x,y,at,expiresAt:at+BAL.worldStimulusV1.signalMs,range:BAL.worldStimulusV1.combatSoundRanges[kind],strength:1};
}
/** Adds a combat signal. Overflow evicts only the oldest combat entries; a still-valid airdrop is never displaced by combat noise. */
export function pushCombatStimulus(r:RunState,s:WorldStimulus) {
  const all=r.worldStimuli||[];
  const others=all.filter(w=>w.kind!=='combat-sound');
  const combat=all.filter(w=>w.kind==='combat-sound').concat(s).sort((a,b)=>a.at-b.at||a.eventIndex-b.eventIndex);
  const cap=BAL.worldStimulusV1.combatSignalCap;
  const kept=combat.length>cap?combat.slice(combat.length-cap):combat;
  r.worldStimuli=others.concat(kept).sort((a,b)=>a.at-b.at||a.eventIndex-b.eventIndex);
}
