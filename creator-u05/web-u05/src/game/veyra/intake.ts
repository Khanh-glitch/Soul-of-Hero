/** Stage 1: read-only Map geography. No gameplay population or runtime statics. */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export const MAP_SOURCE_SHA = '74062a5baf2731451fad9638c4243c7459ce8e24';
export const PACKAGE_CANONICAL_SHA = 'ac9317ae385d47327f02765e4b2e8ca8465c504f3c7146737ab3ff9b91952eb4';
export const BODY_SHA = 'e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63';
export const CANON_SHA = '88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256';
export type MapStatus = 'SOURCE_AUTHORED'|'DERIVED'|'PROPOSED'|'VALIDATED'|'UNRESOLVED'|'BLOCKED'|'UNDECIDED';
export interface PayloadRef { file:string; bytes:number; sha256:string; present?:boolean }
export interface RasterRef extends PayloadRef {name:string; dtype:string; grid:{gw:number;gh:number;cellAu:number;order:string} }
export interface GeographicFeature {id:string;collection:string;status:MapStatus[];sourceRef:string}
export interface GeographyStage1 {
  schema:'soh.map.lr01.geography_package.v1'; schemaVersion:1; revision:1; packageId:'veyra-geography-map-lr01'; revisionDigest:string; stage:'STAGE_1_MAP_GEOGRAPHY';
  provenance:{canon:{commit:string;path:string;bytes:number;sha256:string}};
  payloads:Record<string,PayloadRef[]>;
  body:{packageId:string;frame:{authoring:{w:number;h:number;unit:string};sourceGrid:{gw:number;gh:number;cell:number}};statusVocabulary:MapStatus[];counts:{featureIndex:number};featureIndex:GeographicFeature[];
    terrain:{biomeLegend:{code:number;key:string}[]}; rasterLayers:RasterRef[]; compactMasks:{landWaterRle:number[][];biomeRle:number[][];roadClassRle:number[][];elevationRle:number[][]}; [key:string]:unknown};
}
export type PayloadReader = (sourcePath:string)=>Uint8Array|undefined;
const hash=(data:Uint8Array|string)=>bytesToHex(sha256(data));
export function expandRle(runs:number[][], maxValue:number, cells=43750):Uint8Array {
  if(!Array.isArray(runs))throw Error('RLE must be an array');const out=new Uint8Array(cells);let offset=0;
  for(const pair of runs){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||pair[0]<0||pair[0]>maxValue||!Number.isSafeInteger(pair[1])||pair[1]<1||offset+pair[1]>cells)throw Error('invalid RLE run');out.fill(pair[0],offset,offset+pair[1]);offset+=pair[1];}
  if(offset!==cells)throw Error('incomplete RLE');return out;
}
function point(p:unknown):boolean {return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=2000&&p[1]>=0&&p[1]<=1400;}
function inspectPoi(data:Uint8Array, ids:Set<string>, errors:string[]) {
  try {
    const q=JSON.parse(new TextDecoder().decode(data));if(q.schema!=='soh.map.lr01.poi_layouts.v1'||q.version!==1||!Array.isArray(q.layouts)||q.layouts.length!==81){errors.push('invalid POI layout schema');return;}
    const poiIds=new Set<string>(),spatialIds=new Set<string>();
    for(const poi of q.layouts){if(!ids.has(poi.poiId)||poiIds.has(poi.poiId)){errors.push(`invalid POI cross-reference ${poi.poiId}`);continue;}poiIds.add(poi.poiId);
      const rooms=new Set<string>((poi.rooms||[]).map((r:{id:string})=>r.id));
      for(const group of ['levels','rooms','walls','portals','sockets']) for(const item of (poi[group]||[])){
        if(!item.id||spatialIds.has(item.id)||item.parentPoiId!==poi.poiId)errors.push(`invalid spatial ID ${item.id}`);spatialIds.add(item.id);
        for(const key of ['aAu','bAu','atAu','centroidAu']) if(item[key]!==undefined&&!point(item[key]))errors.push(`invalid ${item.id}.${key}`);
        if(item.polygonAu!==undefined&&(!Array.isArray(item.polygonAu)||item.polygonAu.length<3||!item.polygonAu.every(point)))errors.push(`invalid ${item.id}.polygonAu`);
        if(group==='portals' && [item.fromRoomId,item.toRoomId].some((v:unknown)=>v!==null&&v!==undefined&&!rooms.has(String(v))))errors.push(`invalid portal room reference ${item.id}`);
      }
    }
  } catch { errors.push('malformed POI layouts payload'); }
}
/** Strictly pinned LR01 v1. A new Map revision needs a separately reviewed pin.
 * All reference bytes, including QA views and raw raster payloads, must be supplied. */
export function validateStage1(value:unknown, read:PayloadReader):string[] {
 try {
  const p=value as GeographyStage1, errors:string[]=[];if(!p||typeof p!=='object')return ['invalid package'];
  if(p.schema!=='soh.map.lr01.geography_package.v1'||p.schemaVersion!==1||p.revision!==1||p.packageId!=='veyra-geography-map-lr01'||p.stage!=='STAGE_1_MAP_GEOGRAPHY'||p.body?.packageId!==p.packageId)errors.push('unknown schema, version, map ID or stage');
  if(hash(JSON.stringify(p))!==PACKAGE_CANONICAL_SHA)errors.push('package metadata digest mismatch');
  if(p.revisionDigest!==BODY_SHA||hash(JSON.stringify(p.body))!==BODY_SHA)errors.push('body revision digest mismatch');
  const f=p.body?.frame;if(f?.authoring?.w!==2000||f.authoring.h!==1400||f.authoring.unit!=='authoring_unit'||f.sourceGrid?.gw!==250||f.sourceGrid.gh!==175||f.sourceGrid.cell!==8)errors.push('invalid authoring frame');
  const canon=p.provenance?.canon;if(canon?.commit!=='19d8c6ec820f324a6ac12733165e43b5e2c6eab2'||canon.sha256!==CANON_SHA||canon.path!=='map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json')errors.push('unknown canon revision');
  const source=read(canon?.path);if(!source||source.length!==canon?.bytes||hash(source)!==CANON_SHA)errors.push('missing or corrupt canonical source');
  const vocabulary=['SOURCE_AUTHORED','DERIVED','PROPOSED','VALIDATED','UNRESOLVED','BLOCKED','UNDECIDED'];if(JSON.stringify(p.body.statusVocabulary)!==JSON.stringify(vocabulary))errors.push('unknown status vocabulary');
  const ids=new Set<string>();if(!Array.isArray(p.body.featureIndex)||p.body.featureIndex.length!==579||p.body.counts?.featureIndex!==579)errors.push('invalid feature count');
  else for(const x of p.body.featureIndex){if(!x.id||ids.has(x.id)||!x.sourceRef||!Array.isArray(x.status)||x.status.some(s=>!vocabulary.includes(s)))errors.push(`invalid feature ${x.id}`);ids.add(x.id);}
  const expected=['meadow','forest','ancient','conifer','marsh','desert','scrub','rock','snow','volcanic','toxic','beach'];
  if(!Array.isArray(p.body.terrain?.biomeLegend)||p.body.terrain.biomeLegend.length!==12||p.body.terrain.biomeLegend.some((b,i)=>b.code!==i||b.key!==expected[i]))errors.push('invalid source biome legend');
  const layers=new Map<string,Uint8Array>();const paths=new Set<string>();
  function check(ref:PayloadRef,path:string){if(!ref||!path||path.includes('..')||paths.has(path)||!Number.isSafeInteger(ref.bytes)||ref.bytes<0||!/^[a-f0-9]{64}$/.test(ref.sha256)){errors.push(`invalid payload reference ${path}`);return;}paths.add(path);const bytes=read(path);if(!bytes||bytes.length!==ref.bytes||hash(bytes)!==ref.sha256)errors.push(`missing or corrupt payload ${path}`);else if(path==='world_lab/lr01/output/poi_layouts.v1.json')inspectPoi(bytes,ids,errors);}
  for(const arr of Object.values(p.payloads||{})){if(!Array.isArray(arr)){errors.push('invalid payload list');continue;}for(const ref of arr)check(ref,`world_lab/lr01/${ref.file}`);}
  if(!Array.isArray(p.body.rasterLayers)||p.body.rasterLayers.length!==21)errors.push('missing raster references');
  else for(const ref of p.body.rasterLayers){check(ref,ref.file);const data=read(ref.file);if(ref.dtype!=='u8'||ref.bytes!==43750||ref.grid?.gw!==250||ref.grid?.gh!==175||ref.grid?.cellAu!==8||layers.has(ref.name))errors.push(`invalid raster ${ref.name}`);else if(data?.length===43750)layers.set(ref.name,data);}
  const mask=p.body.compactMasks;const water=expandRle(mask.landWaterRle,2),biome=expandRle(mask.biomeRle,11),road=expandRle(mask.roadClassRle,5),elev=expandRle(mask.elevationRle,255);
  const rawBiome=layers.get('biomeCode'),rawRoad=layers.get('roadClass'),rawElev=layers.get('elevation'),rawWater=layers.get('waterClass');
  if(!rawBiome||!rawRoad||!rawElev||!rawWater)errors.push('missing core raster layers');
  else for(let i=0;i<43750;i++){if(biome[i]!==rawBiome[i]||road[i]!==rawRoad[i]||elev[i]!==rawElev[i]||water[i]!== (rawWater[i]===1?1:rawWater[i]===2||rawWater[i]===3?2:0)){errors.push(`compact raster mismatch at ${i}`);break;}}
  // Code zero means meadow only on land; never interpret the sea sentinel as a biome.
  if(p.payloads && Object.values(p.payloads).reduce((n,a)=>n+a.length,0)!==79)errors.push('invalid payload count');
  return errors;
 } catch { return ['malformed geography package']; }
}
