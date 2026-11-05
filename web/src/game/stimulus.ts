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
