/** Exact-SHA Map M2 static candidate areas; not dynamic spawn authority. */
import raw from '../../../geography/veyra-lr02/spawn_eligibility.v1.json?raw';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
import {BODY_SHA,CANON_SHA} from './intake';
export const ELIGIBILITY_SOURCE_SHA='05f25672da61b4009f38c9a963e2652004dbdf51';
export const ELIGIBILITY_RAW_SHA='377d5452579d638711bb41fbedcab5dafc98af2c17327a90ec954b8c277a19b9';
export const ELIGIBILITY_BODY_SHA='637dd4e8706133773d1fe58643b74386a3832f7acbe5d00b5ec91ecc7a1573fc';
interface Region {candidateId:string;status:string;geometry:{unit:string;sourceResolutionAu:number;cellCount:number;cellIndices:number[]}}
interface Contract {schema:string;version:number;revision:number;revisionDigest:string;digestMethod:string;parent:{schema:string;revision:number;revisionDigest:string};source:{canonSha256:string};candidateRegions:Region[];coverage:{candidateRegions:number;staticallyEligibleCells:number}}
const hash=(s:string)=>bytesToHex(sha256(s));
export function validateEligibility(text:string):Contract {
 if(hash(text)!==ELIGIBILITY_RAW_SHA)throw Error('M2 bytes differ from pinned Map commit');const a=JSON.parse(text) as Contract,{revisionDigest,digestMethod,...body}=a;
 if(a.schema!=='soh.map.lr02.spawn_eligibility.v1'||a.version!==1||a.revision!==1||revisionDigest!==ELIGIBILITY_BODY_SHA||hash(JSON.stringify(body))!==ELIGIBILITY_BODY_SHA||a.parent?.schema!=='soh.map.lr01.geography_package.v1'||a.parent.revision!==1||a.parent.revisionDigest!==BODY_SHA||a.source?.canonSha256!==CANON_SHA||a.coverage?.candidateRegions!==16||a.coverage?.staticallyEligibleCells!==5151||a.candidateRegions?.length!==16)throw Error('M2 identity or parent mismatch');
 const ids=new Set<string>(),cells=new Set<number>();for(const r of a.candidateRegions){if(!r.candidateId||ids.has(r.candidateId)||r.status!=='DERIVED_STATIC_ELIGIBILITY__NOT_A_RUNTIME_SPAWN_POINT'||r.geometry.unit!=='authoring_unit'||r.geometry.sourceResolutionAu!==8||r.geometry.cellIndices.length!==r.geometry.cellCount)throw Error('Invalid M2 region');ids.add(r.candidateId);for(const i of r.geometry.cellIndices){if(!Number.isInteger(i)||i<0||i>=250*175||cells.has(i))throw Error('Invalid M2 cell');cells.add(i);}}if(cells.size!==5151)throw Error('M2 cell count mismatch');return a;
}
export const eligibleRegions=validateEligibility(raw);
