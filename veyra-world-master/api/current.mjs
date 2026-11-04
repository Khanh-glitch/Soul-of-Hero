
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld } from './world.mjs';
import { loadHandoffV3 } from '../v3/src/intake_v3.mjs';
import { planOpenWaterRoute } from '../v4/src/marine_routing.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRID_WIDTH=250,GRID_HEIGHT=175,CELL_AU=8;
const BIOMES=['meadow','forest','ancient','conifer','marsh','desert','scrub_dry_steppe','rock','snow','volcanic','toxic','beach'];
const ECONOMY={meadow:'meadow',forest:'forest',ancient:'forest',conifer:'forest',marsh:'marsh',desert:'sand',scrub_dry_steppe:'grass',rock:'hill',snow:'snow',volcanic:'ash',toxic:'toxic',beach:'sand'};
function loadRaster(file) {const b=fs.readFileSync(path.join(ROOT,file));if(b.length!==GRID_WIDTH*GRID_HEIGHT)throw Error('WMP04_BAD_RASTER '+file+' '+b.length);return new Uint8Array(b)}
export function createCurrentWorld(){
 const parent=createWorld();
 const S=parent._internal.S;
 const biome=loadRaster('v4/r1/data/biomeEffective.r1.u8'),marine=loadRaster('v4/data/marineRegion.v4.u8'),cold=loadRaster('v4/r1/data/coldTransition.r1.u8');
 const design=JSON.parse(fs.readFileSync(path.join(ROOT,'v4/r1/layers/geography_design.r1.json'),'utf8'));
 const sites=JSON.parse(fs.readFileSync(path.join(ROOT,'v4/layers/marine_sites.v4.json'),'utf8'));
 const nav=JSON.parse(fs.readFileSync(path.join(ROOT,'v4/layers/marine_navigation.v4.json'),'utf8'));
 const pointer=JSON.parse(fs.readFileSync(path.join(ROOT,'CURRENT_WORLD_MASTER.json'),'utf8'));
 if(pointer.activeRevision!=='WMP-04R1')throw Error('WMP04R1_NOT_ACTIVE');
 const cell=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=2000||y>=1400)throw Error('WMP04_COORDINATE_OUT_OF_RANGE');return Math.floor(y/CELL_AU)*GRID_WIDTH+Math.floor(x/CELL_AU)};
 const groundAt=({atAu})=>{const i=cell(...atAu);const code=biome[i];return {schema:'soh.wmp.v4.ground',status:'MAP_STATIC',atAu,cellIndex:i,biomeCode:code,biome:BIOMES[code],landId:S.landId[i],waterClass:S.waterClass[i],coldTransition:cold[i],rawElevation:S.elevation[i],rawSlope:S.slope[i],climateDegreesC:null,gameplayTemperatureRateApproved:false,sourceBiomesPreservedInWMP01:true}};
 const marineAt=({atAu})=>{const i=cell(...atAu),sea=S.waterClass[i]===1,region=marine[i];return{schema:'soh.wmp.v4.marine',atAu,cellIndex:i,waterClass:S.waterClass[i],isOpenSea:sea,regionCode:region,regionId:region===1?'marine_west_deadly_depths':region===2?'marine_cinder_geothermal_strait':null,openWaterNavigationCandidate:sea,freeHeadingCandidate:sea,noMandatoryFerryCorridor:true,footPassableOnSea:false,boatOrSwimPermission:'UNRESOLVED_GAMEPLAY',activeCollisionPermission:false,warning:'Open-water possibility is NOT gameplay permission or hazard-rate approval'}};
 const optionalMarineRoute=({fromAu,toAu,riskPolicy='min_distance'})=>planOpenWaterRoute({waterClass:S.waterClass,marineRegion:marine,fromAu,toAu,riskPolicy});
 const candidateEconomyMap=()=>{const h=loadHandoffV3(), m=h.economy,eco={...m,biome:m.biome.slice(),temperature:m.temperature.slice(),moisture:m.moisture.slice()};let n=0;for(let i=0;i<biome.length;i++){if(S.waterClass[i]||!S.landId[i])continue;const target=ECONOMY[BIOMES[biome[i]]];if(!['road','floor','wall','water'].includes(eco.biome[i]))eco.biome[i]=target;if(biome[i]===8){eco.temperature[i]=Math.min(eco.temperature[i],.15);eco.moisture[i]=Math.max(eco.moisture[i],.55)}else if(biome[i]===6||biome[i]===5){eco.temperature[i]=Math.max(eco.temperature[i],.6);eco.moisture[i]=Math.min(eco.moisture[i],.35)}n++}return {...h,economy:eco,worldRevision:'WMP-04R1',status:'CANDIDATE_ONLY__NEEDS_GAMEPLAY_REVIEW',environmentNumbers:'UNITLESS_HEURISTIC__NOT_CELSIUS_OR_DAMAGE_RATES',marineRegions:sites.regions,marineNavigation:nav.static,helicopter:sites.uniqueLandmarks[0],seaCreature:sites.uniqueLandmarks[1],coldTransitionRaster:'v4/r1/data/coldTransition.r1.u8',effectiveBiomeRaster:'v4/r1/data/biomeEffective.r1.u8',proof:{landCells:n,sourceMap:'WMP03',openWaterNoAutoPermission:true}}};
 return Object.freeze({version:'soh.wmp.current.v4r1',activeRevision:'WMP-04R1',parent,groundAt,marineAt,optionalMarineRoute,candidateEconomyMap,design,sites,marineNavigation:nav,rasters:{biomeEffective:biome,marineRegion:marine,coldTransition:cold},source:S,coords:{widthAu:2000,heightAu:1400,cellAu:CELL_AU,gridW:GRID_WIDTH,gridH:GRID_HEIGHT}});
}
