/** Separate exact-SHA Map LR02 patch intake; never mutates the LR01 package. */
import raw from '../../../geography/veyra-lr02/greywater_spatial_patch.v1.json?raw';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { BODY_SHA } from './intake';
export const PATCH_SOURCE_SHA='3c073d9da07b0ad936a57293a51dbba968a885dc';
export const PATCH_RAW_SHA='2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78';
export const PATCH_BODY_SHA='db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a';
export interface Solid {id:string;parentWallId:string;parentPoiId:string;aAu:[number,number];bAu:[number,number];thicknessAu:number;blocksMovement:boolean;blocksSight:boolean;status:string}
export interface Opening {id:string;wallId:string;centreAu:[number,number];aAu:[number,number];bAu:[number,number];normalAu:[number,number];openingAu:number;staticHole:boolean;blocksMovement:boolean;status:string}
export interface GreywaterPatch {schema:string;version:number;revision:number;revisionDigest:string;digestMethod:string;parent:{schema:string;revision:number;revisionDigest:string};staticArchitecture:{poiId:string;staticSolids:Solid[];staticOpenings:Opening[]};spawnEligibility:{contract:{schema?:string;decision?:string};greywaterEligibleArea:{id:string;sourceResolutionAu:number;cellCount:number;cellIndices:number[]}}}
const hash=(s:string)=>bytesToHex(sha256(s));
export function validateGreywaterPatch(text:string):GreywaterPatch {
  if(hash(text)!==PATCH_RAW_SHA)throw Error('LR02 patch bytes differ from pinned Map commit');
  const value=JSON.parse(text) as GreywaterPatch;
  const {revisionDigest,digestMethod,...body}=value;
  if(value.schema!=='soh.map.lr02.greywater_spatial_patch.v1'||value.version!==1||value.revision!==1||revisionDigest!==PATCH_BODY_SHA||hash(JSON.stringify(body))!==PATCH_BODY_SHA||value.parent?.schema!=='soh.map.lr01.geography_package.v1'||value.parent?.revision!==1||value.parent?.revisionDigest!==BODY_SHA)throw Error('LR02 identity or parent mismatch');
  const a=value.staticArchitecture,area=value.spawnEligibility?.greywaterEligibleArea;
  if(value.spawnEligibility?.contract?.schema!=='soh.map.lr02.spawn_eligibility_contract.v1'||value.spawnEligibility.contract.decision!=='SEEDED_RANDOM_LEGAL_POSITION_SAMPLING')throw Error('LR02 spawn contract mismatch');
  if(a?.poiId!=='po_greywater'||!Array.isArray(a.staticSolids)||a.staticSolids.length!==15||!Array.isArray(a.staticOpenings)||a.staticOpenings.length!==8||!area||area.id!=='se.greywater_bounded.v1'||area.sourceResolutionAu!==8||area.cellCount!==107||!Array.isArray(area.cellIndices)||area.cellIndices.length!==area.cellCount||new Set(area.cellIndices).size!==area.cellCount||area.cellIndices.some(i=>!Number.isInteger(i)||i<0||i>=250*175))throw Error('LR02 geometry or eligibility contract invalid');
  const ids=new Set<string>();for(const s of a.staticSolids){if(!s.id||ids.has(s.id)||s.parentPoiId!=='po_greywater'||s.status!=='PROPOSED'||!s.blocksMovement||!s.blocksSight||!Number.isFinite(s.thicknessAu)||s.thicknessAu<=0||![...s.aAu,...s.bAu].every(Number.isFinite))throw Error('Invalid LR02 solid');ids.add(s.id);}
  for(const o of a.staticOpenings){if(!o.id||ids.has(o.id)||!o.staticHole||o.blocksMovement||o.status!=='PROPOSED'||o.openingAu<=0||![...o.aAu,...o.bAu,...o.centreAu,...o.normalAu].every(Number.isFinite))throw Error('Invalid LR02 opening');ids.add(o.id);}
  return value;
}
export const greywaterPatch=validateGreywaterPatch(raw);
