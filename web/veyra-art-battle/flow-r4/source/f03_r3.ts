/**
 * VEYRA — F03 WORKING BATCH: fifteen canonical industrial/infrastructure sites.
 *
 * The exact F03 -> 26-triad canonical taxonomy is not present in available source.
 * This candidate grouping therefore assigns ONLY existing GOLD IDs, records each,
 * and MUST be reconciled with the controlling 26-triad document before changing
 * the official family inventory. No POI IDs, geography, loot, actors, transport,
 * work, hazard effect, production economy or save authority are created here.
 *
 * Field research distilled into spatial relationships:
 *   Power/water: intake -> dry service works -> headhouse -> walk above water.
 *   Timber: incoming logs -> sawline -> drying yard -> loading bridge.
 *   Quarry: access -> stepped extraction face -> spoil -> hoist/cabin.
 *   Refining: input bay -> kiln/furnace -> weathered sorting -> high vent.
 *   Utility: treatment/holding -> service ring -> raised monitoring route.
 */
import {Plan, type ArchPlan, type Rect, type Level, type RoofStyle, type Mat} from './plan';

interface F03Site { id:string; name:string; cx:number;cy:number; group:'WATER'|'TIMBER'|'QUARRY'|'PROCESS'|'UTILITY'; label:string; signature:string; i:number; dx:number;dy:number; }
/** Authored anchors sampled on GOLD dry ground, NOT changed world origin/POI. */
export function f03Profiles():Record<string,F03Site> {return {
 po_falls: {id:'po_falls',name:'Falls Powerhouse',cx:1444,cy:876,group:'WATER',label:'River turbine gallery',signature:'Dam intake and two return inspection paths over the downstream channel',i:0,dx:-9,dy:-19},
 po_pumphouse: {id:'po_pumphouse',name:'Greywater Pumphouse',cx:1712,cy:1118,group:'WATER',label:'Lakeside intake works',signature:'Pumping station with a long over-water intake trestle and reservoir lookout',i:1,dx:-27,dy:-31},
 po_oldpump: {id:'po_oldpump',name:'Old Pumping Plant',cx:1700,cy:1958,group:'WATER',label:'Disused water machinery',signature:'Buried pipe gallery, broken pump casing and a rooftop gauge walkway',i:2,dx:17,dy:-20},
 po_sawaion: {id:'po_sawaion',name:'Aion Edge Sawmill',cx:1496,cy:1336,group:'TIMBER',label:'Powered log sawline',signature:'Feed carriage, wet saw-house, elevated transfer belt and sawdust pit',i:0,dx:-19,dy:14},
 po_mill: {id:'po_mill',name:'Mossbrook Mill',cx:1986,cy:1460,group:'TIMBER',label:'River-grain and timber mill',signature:'Wheelhouse, narrow bridge, grain store and two exterior return routes',i:1,dx:28,dy:-18},
 po_timberyard: {id:'po_timberyard',name:'Verdant Timberyard',cx:2026,cy:926,group:'TIMBER',label:'Open log sorting district',signature:'Stacked log racks, open gantry and split grading shed',i:2,dx:28,dy:21},
 po_fracquarry: {id:'po_fracquarry',name:'Fracture Quarry',cx:1200,cy:1050,group:'QUARRY',label:'Cut-stone fracture face',signature:'Stepped quarry benches, oblique haulage switchbacks, under-face tunnel',i:0,dx:-25,dy:-20},
 po_greyquarry: {id:'po_greyquarry',name:'Greyback Quarry',cx:1012,cy:1304,group:'QUARRY',label:'Grey rock quarry terraces',signature:'Gravel screen yard, half-height crane, covered tool cut and spoil returns',i:1,dx:24,dy:20},
 po_obsq: {id:'po_obsq',name:'Obsidian Quarry',cx:3300,cy:1552,group:'QUARRY',label:'Volcanic glass cutting face',signature:'Dark shard terrace, long open ramp and overhanging rock picker',i:2,dx:-27,dy:16},
 po_kilns: {id:'po_kilns',name:'Charcoal Kilns',cx:1810,cy:1570,group:'PROCESS',label:'Charcoal retort yards',signature:'Multiple offset kilns, air-circulation court, ash walkway and draught tower',i:0,dx:29,dy:-21},
 po_slag: {id:'po_slag',name:'Slagworks Foundry',cx:2380,cy:1872,group:'PROCESS',label:'Slag and bloom sorting works',signature:'Asymmetric furnace, quenched-material gallery and overhead slag transfer',i:1,dx:-26,dy:23},
 po_sulfur: {id:'po_sulfur',name:'Sulfur Works',cx:3536,cy:1776,group:'PROCESS',label:'Sulfur condensing yard',signature:'Sealed retort line, disused extractor and dry maintenance underpass',i:2,dx:29,dy:15},
 po_siloc: {id:'po_siloc',name:'Grain Silo Complex',cx:2180,cy:1520,group:'UTILITY',label:'Silo transfer and elevators',signature:'Grain elevator, multi-bay storage and an external high catwalk',i:0,dx:23,dy:-21},
 po_filter: {id:'po_filter',name:'Delta Sluice & Filter Station',cx:1868,cy:1736,group:'UTILITY',label:'Delta treatment cells',signature:'Staggered settling basin walk, lower service chambers and filter bridge',i:1,dx:-27,dy:-19},
 po_geo: {id:'po_geo',name:'Geothermal Station',cx:3472,cy:1832,group:'UTILITY',label:'Volcanic power exchange',signature:'Steam manifolds, raised condenser platform and sheltered pressure tower',i:2,dx:28,dy:20},
};}


// F03 redesign R2: five PROCESS-LED grammars, NOT a universal harbour cross.
// Geometry and visual footprints reflect production processes. Most places do
// NOT use four levels; a small kiln or log yard has no reason for a roof tower.
function f03Open(p:Plan,id:string,name:string,level:Level,rects:Rect[],mat:Mat='stone',deck=false){
 p.structure(id,name,level,{open:true,mat,roof:null});p.room(id,name,level,id,rects,{open:true,carve:deck});
}
function f03Mass(p:Plan,id:string,name:string,level:Level,rects:Rect[],roof:RoofStyle|null='tin',mat:Mat='stone'){
 p.structure(id,name,level,{mat,roof});p.room(id,name,level,id,rects);
}
function f03Door(p:Plan,id:string,name:string,r:Rect,side:'N'|'E'|'S'|'W',roof:RoofStyle,mat:Mat='stone'){
 const [x,y,w,h]=r;f03Mass(p,id,name,0,[r],roof,mat);
 const px=side==='W'?x:side==='E'?x+w-1:x+Math.floor(w/2),py=side==='N'?y:side==='S'?y+h-1:y+Math.floor(h/2);
 p.door(px,py,0,id,`${name} · work entrance`,'main');
 const q:Rect=side==='W'?[x-5,py-2,6,5]:side==='E'?[x+w-1,py-2,6,5]:side==='N'?[px-2,y-5,5,6]:[px-2,y+h-1,5,6];
 f03Open(p,id+'_threshold',name+' threshold',0,[q]);
}
function f03Props(p:Plan,kind:string,level:Level,pts:Array<[number,number]>) {for(const[x,y]of pts)p.prop(x,y,level,kind)}
function f03Start(s:F03Site){return new Plan(s.id,s.name,s.signature,[s.cx-49,s.cy-49,99,99]);}
function f03Path(p:Plan,id:string,name:string,level:Level,rects:Rect[],mat:Mat='stone',art=false){f03Open(p,id,name,level,rects,mat,art)}
/** WATER: landscape headrace -> turbine housing -> tailrace. No aerial harbour plaza. */
function f03Water(s:F03Site){const{x,y,i}={x:s.cx,y:s.cy,i:s.i},p=f03Start(s);
 f03Path(p,'flow_route','Headwater to turbine service path',0,
  [[x-8,y-32,7,57],[x-9,y-10,30,6],[x+12,y-15,8,34],[x-2,y+14,27,6],[x-33,y-25,26,5],[x-4,y-6,6,19]],'stone');
 f03Path(p,'sluice_apron','Narrow stone river apron',0,
  [[x-34,y-15,29,5],[x-35,y-28,6,20],[x-23,y-23,6,17]],'wood',true);
 f03Door(p,'turbine_hall',i===2?'Silent Pump Engine':'Turbine and Rotor House',[x+18,y-12,20,17],'W','tile','stone');
 f03Door(p,'intake_shack',i===1?'Reservoir Gatehouse':'Water Intake Gatehouse',[x-38,y-35,16,14],'E','wood','stone');
 f03Door(p,'pipe_store','Pressure Pipe and Tool Store',[x+11,y+21,19,11],'N','tin','wood');
 f03Path(p,'pipe_lane','Pipe maintenance bend',0,[[x+17,y+15,6,11],[x+17,y+11,7,5],[x-8,y-13,30,5]],'stone');
 // Dry service cellar is underneath a real turbine building, not an open pit.
 f03Mass(p,'dry_turbine_pit','Enclosed Turbine Bearing Room',-1,[[x+20,y-8,15,12],[x+29,y+2,6,7]],null,'stone');
 p.stair(x+24,y-5,0,-1,x+24,y-5,'Turbine service hatch','hatch');
 // Compact mezzanine OVER the engine house, reached through the same building.
 f03Mass(p,'rotor_gallery','Rotor Inspection Mezzanine',1,[[x+21,y-10,14,9],[x+30,y-3,6,5]],'wood','wood');
 p.stair(x+29,y-6,0,1,x+29,y-6,'Machine-room interior stair','interior');
 p.prop(x+26,y-6,1,'f03_gauge_panel');p.prop(x+29,y-3,1,'f03_valve');
 p.prop(x+2,y+1,0,'f03_waterwheel');p.prop(x+12,y+2,0,'f03_pipe_bundle');
 f03Props(p,'f03_steel_gate',0,[[x-26,y-17],[x-30,y-28]]);
 p.prop(x+26,y+3,0,'f03_turbine');p.prop(x+14,y+24,0,'pipes');
 if(i===0){ // Falls: the power station hugs a waterfall, with a true side return.
  f03Path(p,'waterfall_gallery','Falls lookout and bypass',0,[[x-37,y-7,29,5],[x-38,y-18,5,15],[x-34,y+1,32,4]],'wood',true);
  p.prop(x-25,y-8,0,'f03_waterwheel');p.note(x-30,y-10,0,'The falls headrace meets the rotor, then the tailwater bypasses the powerhouse.');
 }else if(i===1){ // Pumphouse: reservoir side platforms and pressure valve court.
  f03Path(p,'reservoir_bench','Reservoir intake work edge',0,[[x-42,y-37,8,43],[x-40,y-38,24,5],[x-42,y+1,35,5]],'wood',true);
  p.prop(x-32,y-6,0,'f03_valve');p.prop(x+2,y+10,0,'f03_filter_tank');
 }else{ // Derelict: abandoned pipe maze, NOT another watchtower.
  f03Path(p,'broken_pipes','Shallow fractured pressure channels',0,[[x-16,y+16,29,6],[x-19,y+4,5,15],[x-31,y+1,17,5]],'stone',true);
  p.prop(x-16,y+18,0,'f03_rust_pipe');p.prop(x-7,y+16,0,'rubble');
 }
 return p.build();}
/** TIMBER: log feed orientation -> saw processing -> yard storage. Small loft only. */
function f03Timber(s:F03Site){const x=s.cx,y=s.cy,i=s.i,p=f03Start(s);
 f03Path(p,'long_feed','Long axis log-feed grading rail',0,
 [[x-42,y-4,73,7],[x-16,y-23,6,27],[x+19,y-9,6,35],[x-23,y+20,54,6],[x-23,y+3,6,22],[x+22,y+15,11,8]],'wood',false);
 f03Path(p,'double_track','Twin saw carriage rails',0,[[x-41,y-1,70,2]],'wood',true);
 f03Door(p,'saw_house',i===2?'Log Measuring Office':i===1?'Mill Wheel and Grinding House':'Main Crosscut Sawhouse',
 [x-26,y-28,21,17],'S','wood','wood');
 f03Door(p,'dry_store','Kiln-Dried Timber Shed',[x+19,y+20,18,12],'N','wood','wood');
 f03Door(p,'feed_shed','Incoming Log Store',[x-39,y+17,17,13],'E','wood','wood');
 f03Path(p,'sawline_south','Timber Sorting Branch',0,[[x-33,y+8,52,5],[x-33,y+10,5,19],[x+5,y+12,7,16],[x+4,y+24,30,5]],'wood',true);
 f03Mass(p,'saw_attic','Low Beam Drive-Loft',1,[[x-24,y-26,17,13],[x-16,y-17,9,6]],'wood','wood');
 p.stair(x-12,y-17,0,1,x-12,y-17,'Saw belt loft ladder','ladder');
 p.prop(x-13,y-21,1,'f03_chain_rail');
 f03Props(p,'f03_log_cradle',0,[[x-35,y-1],[x-20,y-1],[x+1,y-1],[x+15,y-1]]);
 f03Props(p,'f03_timber_pile',0,[[x+24,y+15],[x+15,y+28],[x-28,y+13]]);
 p.prop(x-9,y-3,0,'f03_sawframe');p.prop(x+5,y+12,0,'f03_sawdust');
 if(i===0){ // powered saw line, parallel timber receiving conveyors
  f03Path(p,'carriage_return','Low carriage return',0,[[x-38,y-13,53,5],[x-38,y-12,5,12]],'wood',true);
  p.prop(x-27,y-10,0,'f03_chain_rail');
 } else if(i===1){ // Mossbrook: mill wheel along a smaller stream, distinct trade
  f03Path(p,'wheelrace_sill','Mill wheel footbridge',0,[[x+5,y-19,24,5],[x+23,y-24,5,22]],'wood',true);
  p.prop(x+18,y-18,0,'f03_waterwheel');p.prop(x+28,y+1,0,'grain_sack');
 } else { // open timberyard, deliberately no forced basement or watchtower
  f03Path(p,'grading_rows','Log grading spur',0,[[x-30,y+27,61,5],[x-24,y-5,5,34]],'wood',true);
  f03Props(p,'f03_timber_pile',0,[[x-25,y+22],[x+3,y+26],[x+26,y+27]]);
 }
 p.note(x+1,y+5,0,'Logs enter along the feed rails, pass the saw line, then leave for the drying shed.');
 return p.build();}
/** QUARRY: staggered lithology terraces; shaft under ROCK, not open-air port pits. */
function f03Quarry(s:F03Site){const x=s.cx,y=s.cy,i=s.i,p=f03Start(s);
 // The bench sequence has offsets, chokepoints and flared excavation faces;
 // a central open plaza would erase its geology and visual rhythm.
 f03Path(p,'entry_cut','Narrow quarry entrance cut',0,[[x-4,y-43,7,47],[x-9,y-7,15,10]],'stone');
 f03Path(p,'bench_spine','Staggered ore benches and switchbacks',0,
 [[x-30,y+1,40,6],[x-30,y+2,7,18],[x-30,y+16,30,6],[x-4,y+15,7,19],
  [x-5,y+29,34,6],[x+22,y+5,7,28],[x+6,y-8,26,6]],'stone',true);
 f03Path(p,'fractured_wallwalk','Broken rock-cut rim',0,
 [[x-39,y-15,29,5],[x-39,y-16,6,19],[x-34,y-2,10,5],[x-14,y-9,15,6]],'stone',true);
 f03Door(p,'cutting_room',i===2?'Glass Shard Workshop':'Rock Cutting House',[x+26,y-12,19,15],'W','hull','stone');
 f03Door(p,'survey_hut','Surveyor Shack',[x-41,y-32,18,12],'S','wood','wood');
 // Survey hut outer threshold flows from the NW rim by a carved gravel trail.
 f03Path(p,'survey_access','Survey Hut Return',0,[[x-33,y-19,6,12],[x-32,y-10,23,6],[x-14,y-7,9,7]],'stone');
 f03Path(p,'ore_loading','Crushed rock stock lane',0,[[x+5,y-6,29,6],[x+22,y-12,7,19],[x+4,y+4,21,5]],'stone');
 // Tunnel cut only into solid geological bank, one portal at the bench edge.
 f03Mass(p,'geology_adit','Short Enclosed Rock Adit',-1,
 [[x-25,y+18,32,6],[x-25,y+10,7,13],[x+1,y+15,9,13]],null,'stone');
 p.stair(x-1,y+18,0,-1,x-1,y+18,'Ore face adit descent','hatch');
 p.prop(x-18,y+18,-1,'f03_ore_seam');p.prop(x+4,y+22,-1,'f03_ore_seam');
 // A SHORT rock-rim lookout, not the enormous gantry copied from F02.
 f03Path(p,'rim_lip','Upper fractured cut face',1,[[x+19,y-11,7,20],[x+16,y-9,13,5],[x+21,y+5,14,5]],'stone',true);
 p.stair(x+22,y-4,0,1,x+22,y-4,'Quarry ledge steps','exterior');
 p.prop(x+25,y+6,1,'f03_crane');
 f03Props(p,i===2?'f03_glass_spoil':'f03_ore_seam',0,[[x-28,y+3],[x-21,y+17],[x+3,y+31]]);
 f03Props(p,'f03_spoil_heap',0,[[x-30,y+26],[x+8,y+26],[x+25,y+19]]);
 p.prop(x+6,y+4,0,'f03_crusher');p.prop(x-12,y-14,0,'f03_ore_ramp');
 if(i===0){p.prop(x-35,y-17,0,'f03_ore_seam');p.note(x-22,y+13,0,'The broken fracture face runs down a switchback of real extraction benches.');}
 else if(i===1){f03Path(p,'screen_spur','Greyback Gravel Screening Spur',0,[[x-13,y+9,22,5],[x+6,y+7,6,21]],'stone',true);p.prop(x+7,y+12,0,'f03_screen');}
 else {f03Path(p,'obsidian_rake','Obsidian Shard Survey Spur',0,[[x-37,y+22,20,6],[x-38,y+20,6,15]],'stone',true);p.prop(x-32,y+24,0,'f03_glass_spoil');}
 return p.build();}
/** PROCESS: heat/batch rhythm and ventilation, NO default buried tunnels. */
function f03Process(s:F03Site){const x=s.cx,y=s.cy,i=s.i,p=f03Start(s);
 f03Path(p,'retort_court','Tapered kiln and work court',0,
 [[x-13,y-13,30,23],[x-8,y-31,7,22],[x-10,y+6,27,7],[x+13,y-20,9,35]],'stone',false);
 f03Path(p,'kiln_fireboxes','Heat-blackened kiln footings',0,[[x-11,y-10,9,9],[x+4,y-10,10,9],[x-4,y+3,11,10]],'stone',true);
 f03Path(p,'fuel_lane','Fuel feed and ash removal',0,
 [[x-39,y-7,29,6],[x-38,y-24,6,20],[x-31,y+7,43,6],[x+2,y+11,5,18],[x+15,y+10,11,20],[x+14,y-22,7,15],[x-34,y-22,13,6],[x-24,y-20,6,19],[x+11,y-21,9,11],[x+15,y+9,14,12]],'stone');
 f03Door(p,'fuel_drying','Dry Fuel Preparation Shed',[x-44,y-27,18,13],'E','wood','brick');
 f03Door(p,'cooling_house','Ventilated Output Sorting',[x+19,y+14,24,13],'W','tin','stone');
 f03Path(p,'cooling_yard','Output cooling ledge',0,[[x+11,y+9,22,6],[x+18,y+4,6,24],[x-3,y+25,25,5]],'stone');
 f03Props(p,'f03_kiln_vat',0,[[x-7,y-6],[x+7,y-6],[x-1,y+7],[x+4,y+2]]);
 f03Props(p,'f03_charcoal_rick',0,[[x-29,y+1],[x-25,y+8],[x+12,y+27]]);
 p.prop(x+10,y-12,0,'f03_chimney');p.prop(x-35,y-18,0,'f03_condenser');
 // Only furnace or sulfur processing has a tall inspection platform.
 if(i===0){
  f03Path(p,'draught_walk','Low Kiln Draught Terrace',1,[[x+11,y-17,8,16],[x+6,y-7,18,5]],'stone',true);
  p.stair(x+15,y-9,0,1,x+15,y-9,'Kiln draught ladder','ladder');
  p.prop(x+19,y-6,1,'f03_vent_pipe');
 }else if(i===1){
  f03Mass(p,'slag_furnace','Tall Foundry Furnace Bay',0,[[x+16,y-28,23,17],[x+23,y-13,15,7]],'tin','brick');
  p.door(x+16,y-19,0,'slag_furnace','Smelter side doorway','main');
  f03Path(p,'smelter_access','Furnace feed return',0,[[x+11,y-21,7,20],[x+16,y-16,8,5]],'stone');
  f03Path(p,'heat_gallery','Open Furnace Chimney Catwalk',1,[[x+17,y-25,7,19],[x+21,y-22,14,5]],'wood',true);
  p.stair(x+19,y-15,0,1,x+19,y-15,'Foundry firewatch stair','exterior');
  p.prop(x+26,y-20,1,'f03_vent_pipe');p.prop(x-1,y+1,0,'f03_slag_pool');
 }else{
  f03Path(p,'sealed_retort','Sulfur Condensing Service Line',0,[[x+14,y-23,7,34],[x+13,y-21,23,5]],'stone');
  f03Mass(p,'condensing_gallery','Sealed Condenser Shaft',1,[[x+17,y-19,13,12],[x+25,y-15,7,7]],'tin','brick');
  p.stair(x+21,y-12,0,1,x+21,y-12,'Sulfur condenser enclosed stair','interior');
  p.prop(x+24,y-13,1,'f03_condenser');p.prop(x+6,y-8,0,'f03_rust_pipe');
 }
 p.note(x+1,y+11,0,'Feedstock is loaded before heating; spent material cools in the separate output yard.');
 return p.build();}
/** UTILITY: SILO vertical, FILTER mostly horizontal, GEOTHERMAL manifold. */
function f03Utility(s:F03Site){const x=s.cx,y=s.cy,i=s.i,p=f03Start(s);
 if(i===0){
  f03Path(p,'silo_truckloop','Grain transport loop',0,
   [[x-32,y-11,55,7],[x-32,y-10,7,27],[x-25,y+12,57,7],[x+26,y-19,7,37],[x-23,y-24,7,18],[x-8,y+12,7,14],[x-4,y-8,7,26],[x+7,y-15,7,12],[x-23,y-13,6,12]],'stone');
  f03Mass(p,'grain_elevator','Large Offset Grain Elevator',0,
   [[x+9,y-30,25,22],[x+28,y-21,10,18]],'tin','stone');
  p.door(x+9,y-17,0,'grain_elevator','Grain elevator west entrance','main');
  f03Path(p,'elevator_access','Elevator turn apron',0,[[x+4,y-19,10,7]],'stone');
  f03Door(p,'receiving_bay','Bagged Grain Receiving',[x-39,y-30,19,13],'E','tin','wood');
  f03Door(p,'rail_office','Dry Grain Grading',[x-15,y+20,19,11],'N','wood','wood');
  f03Mass(p,'silo_second','Silo Gallery',1,[[x+12,y-28,21,19],[x+28,y-22,9,14]],'light','stone');
  p.stair(x+18,y-16,0,1,x+18,y-16,'Grain elevator interior stairs','interior');
  f03Mass(p,'silo_roof','Silo Discharge House',2,[[x+16,y-25,17,12],[x+27,y-19,8,8]],'wood','wood');
  p.stair(x+20,y-17,1,2,x+20,y-17,'Silo discharge roof stair','interior');
  f03Props(p,'f03_silo',0,[[x-8,y-13],[x+2,y+1],[x+17,y+5]]);
  p.prop(x+24,y-18,2,'f03_chain_rail');
 } else if(i===1){
  f03Path(p,'settling_cells','Staggered Settling Basin Service Rim',0,
   [[x-40,y-25,72,6],[x-40,y-20,6,41],[x-35,y+16,68,6],[x+26,y-22,7,44],[x-13,y-23,6,42]],'stone');
  f03Path(p,'filter_core','Separated Basin Transfer',0,
   [[x-31,y-9,23,6],[x-9,y-4,35,6],[x-7,y-20,6,34],[x-2,y+7,29,5]],'stone',true);
  f03Door(p,'chemical_store','Dry Filter Media Store',[x-41,y+24,19,11],'N','wood','stone');
  f03Door(p,'control_room','Water Test and Valve House',[x+29,y+22,16,13],'N','tile','stone');
  f03Path(p,'filter_yard','Testing and Service Path',0,[[x-31,y+14,70,5],[x-31,y+12,6,15],[x+36,y+16,6,13]],'stone');
  f03Mass(p,'valve_below','Covered Filter Maintenance Channel',-1,[[x-10,y-7,25,9],[x+10,y-4,8,16]],null,'stone');
  p.stair(x+1,y-3,0,-1,x+1,y-3,'Filter service access','hatch');
  f03Path(p,'water_sample','Low Gauge Walk over Basin',1,[[x-8,y-17,6,23],[x-8,y+2,24,5]],'wood',true);
  p.stair(x-4,y-5,0,1,x-4,y-5,'Filter check bridge stair','exterior');
  f03Props(p,'f03_filter_tank',0,[[x-23,y-13],[x+10,y-12],[x+9,y+11],[x+4,y+2]]);p.prop(x-7,y+9,0,'f03_valve');
 } else{
  f03Path(p,'manifold_court','Thermal Pump and Manifold Court',0,
   [[x-15,y-17,36,28],[x-6,y-34,7,22],[x-28,y-11,18,6],[x+14,y+7,24,6]],'stone',true);
  f03Path(p,'thermal_line','Steam Return Channels',0,
   [[x-35,y-28,7,29],[x-33,y-28,26,6],[x+30,y-23,7,40],[x-13,y+14,46,5],[x-20,y+8,7,18],[x+17,y-23,13,7]],'stone');
  f03Door(p,'condenser','Thermal Condenser Workshop',[x+18,y-30,21,16],'W','tin','stone');
  f03Door(p,'cooling_shed','Steam Cooling Station',[x-40,y+14,22,13],'E','wood','stone');
  f03Path(p,'service_stair_route','Valve Tower Service Return',0,[[x+20,y-17,12,7],[x+22,y-12,7,27],[x-21,y+10,12,9]],'stone');
  f03Mass(p,'steam_deck','Thermal Vessel Inspection Loft',1,[[x+20,y-28,17,13],[x+27,y-17,9,6]],'tin','stone');
  p.stair(x+26,y-21,0,1,x+26,y-21,'Steam vessel interior stair','interior');
  f03Props(p,'f03_geo_manifold',0,[[x-5,y-9],[x+12,y+7],[x-27,y-6]]);
  f03Props(p,'f03_vent_pipe',0,[[x+23,y+13],[x-21,y+17]]);
 }
 p.note(x,y,0,'Every route follows the materials or water movement of this particular utility.');
 return p.build();}
/**
 * R3 spatial acceptance pilot. These three sites are authored separately instead of
 * inheriting one F03 family template. Existing POI IDs, geography, stairs API and
 * gameplay authority remain unchanged. Roads do not enter roofed floor plates;
 * only deliberately one-cell-deep door thresholds touch a building footprint.
 *
 * Discovery grades: Quarry = DEEP, Falls = MEDIUM, Sawmill = COMPACT.
 */
function r3FallsPowerhouse(s:F03Site):ArchPlan {
 const x=s.cx,y=s.cy,p=f03Start(s);
 // Water first: a dry, narrow, stone service route follows the headrace; not
 // a gigantic paved courtyard. The turbine hall lies EAST of the walkway.
 f03Path(p,'headrace_path','Headrace inspection path',0,
  [[x-13,y-34,6,53],[x-13,y-11,25,5],[x+7,y-15,6,38],
   [x-12,y+14,31,5],[x+15,y+7,6,15]],'stone');
 f03Path(p,'falls_walk','Waterfall bypass and downstream return',0,
  [[x-33,y-18,6,33],[x-33,y-18,22,5],[x-30,y-8,20,6],[x-31,y+10,21,5]],'wood',true);
 f03Door(p,'intake_shack','Water Intake Gatehouse',[x-38,y-35,16,14],'E','wood','stone');
 // East doorway at -23,-28. Its apron ends exactly at the road; no stone
 // traverses the gatehouse's timber roof.
 f03Path(p,'intake_turn','Gate-control approach',0,
  [[x-22,y-29,11,5],[x-22,y-24,4,8],[x-28,y-19,9,5]],'stone');
 f03Door(p,'turbine_hall','Turbine and Rotor House',[x+22,y-12,20,17],'W','tile','stone');
 f03Path(p,'rotor_access','Turbine hall working threshold',0,
  [[x+11,y-6,11,5],[x+16,y-6,5,15]],'stone');
 f03Door(p,'pipe_store','Pressure Pipe and Tool Store',[x+11,y+23,19,11],'N','tin','wood');
 f03Path(p,'pipe_delivery','Pipe store service spur',0,
  [[x+17,y+14,6,9]],'stone');
 // Enclosed lower bearing service; the widened bypass and return pocket give
 // the player a reason to inspect beyond the immediate vertical ladder.
 f03Mass(p,'turbine_subfloor','Bearing Chamber and Tailrace Service Passage',-1,
  [[x+24,y-9,16,14],[x+20,y+1,18,6],[x+19,y+4,7,11]],null,'stone');
 p.stair(x+29,y-5,0,-1,x+29,y-5,'Turbine bearing access hatch','hatch');
 p.prop(x+23,y+10,-1,'f03_rust_pipe');
 p.prop(x+34,y+1,-1,'f03_valve');
 p.note(x+22,y+10,-1,'The outlet narrows behind the turbine. This lower return tells why the machine house stands here.');
 // The mezzanine remains inside the engine house; no flying upper plaza.
 f03Mass(p,'rotor_gallery','Rotor Balancing Mezzanine',1,
  [[x+24,y-10,16,12]],'wood','wood');
 p.stair(x+34,y-5,0,1,x+34,y-5,'Internal rotor inspection stair','interior');
 p.prop(x+28,y-5,1,'f03_gauge_panel');
 p.prop(x+36,y-1,1,'f03_valve');
 p.note(x+26,y-8,1,'The upper gauge faces the intake. Read it before going down to the bearing room.');
 // Machinery belongs at intake, wet works and pipe store, respectively.
 p.prop(x-28,y-16,0,'f03_steel_gate');
 p.prop(x-27,y+3,0,'f03_waterwheel');
 p.prop(x+16,y+1,0,'f03_pipe_bundle');
 p.prop(x+29,y+1,0,'f03_turbine');
 p.prop(x+22,y+21,0,'pipes');
 p.note(x-31,y+10,0,'Below the walkway the falls rejoin the river; an alternate route returns to the same service spine.');
 return p.build();
}
function r3AionSawmill(s:F03Site):ArchPlan {
 const x=s.cx,y=s.cy,p=f03Start(s);
 // A compact working POI: two complementary loops, not an oversized maze.
 // The log stream travels W->E, bypasses the human walkway and reaches
 // storage only AFTER it has passed the sawhouse.
 f03Path(p,'log_feed','Incoming log feed carriage',0,
  [[x-43,y-5,61,7],[x-22,y-5,6,31],[x-22,y+19,46,6],
   [x+14,y-5,6,27],[x+14,y+12,17,5]],'wood');
 f03Path(p,'saw_access','Walkway to crosscut room',0,
  [[x-16,y-15,6,12],[x-27,y-11,11,5],[x-27,y-11,7,14]],'wood',true);
 f03Door(p,'saw_house','Main Crosscut Sawhouse',[x-25,y-32,22,17],'S','wood','wood');
 f03Door(p,'feed_shed','Incoming Log Store',[x-40,y+18,16,12],'E','wood','wood');
 f03Path(p,'feed_shed_access','Materials receiving turn',0,
  [[x-24,y+19,7,7]],'wood');
 f03Door(p,'dry_store','Dry Timber Sorting Shed',[x+24,y+19,17,13],'N','wood','wood');
 f03Path(p,'dry_store_access','Outbound planks and staging',0,
  [[x+19,y+14,12,5],[x+14,y+11,7,5]],'wood',true);
 // An alternate narrow walkway for workers avoids the busy log rails.
 f03Path(p,'inspection_bypass','Saw maintenance return walk',0,
  [[x-39,y-14,6,20],[x-39,y-14,26,5],[x-36,y+2,16,5]],'wood',true);
 // Loft is really part of the sawhouse, accessible through its ground floor.
 f03Mass(p,'saw_attic','Belt Drive Loft',1,
  [[x-23,y-30,18,13]],'wood','wood');
 p.stair(x-11,y-21,0,1,x-11,y-21,'Saw belt maintenance ladder','ladder');
 p.prop(x-13,y-23,1,'f03_chain_rail');
 p.note(x-18,y-24,1,'The belt runs directly above the crosscut saw; this service loft is a short optional detour.');
 // Machines and stock are placed on process stations, not at random.
 p.prop(x-34,y-2,0,'f03_log_cradle');
 p.prop(x-21,y-2,0,'f03_log_cradle');
 p.prop(x-7,y-22,0,'f03_sawframe');
 p.prop(x-7,y-10,0,'f03_sawdust');
 p.prop(x-37,y+23,0,'f03_timber_pile');
 p.prop(x+22,y+8,0,'f03_timber_pile');
 p.prop(x+32,y+24,0,'f03_timber_pile');
 p.note(x-30,y+5,0,'Raw logs arrive on the western carriage. Workers follow the separate side walk, not the rails.');
 p.note(x+18,y+24,0,'Cut lumber goes east to the dry sorting shed. This is the outgoing route back to the main yard.');
 return p.build();
}
function r3FractureQuarry(s:F03Site):ArchPlan {
 const x=s.cx,y=s.cy,p=f03Start(s);
 // DEEP POI: approach -> branching survey/rim -> descending stepped ore face
 // -> optional adit -> short high ledge. No harbour-style bridge courtyard.
 f03Path(p,'entrance_cut','Narrow stone approach at fracture rim',0,
  [[x-4,y-43,7,49],[x-9,y-6,15,10]],'stone');
 f03Path(p,'quarry_benches','Rock-cut switchbacks',0,
  [[x-27,y+1,30,6],[x-27,y+1,7,20],[x-27,y+16,29,6],
   [x-3,y+16,6,19],[x-3,y+29,28,6],[x+20,y+4,6,31],
   [x+6,y-9,20,6]],'stone',true);
 f03Path(p,'rim_return','Survey rim and short sheltered backtrack',0,
  [[x-33,y-14,32,5],[x-33,y-19,6,11],[x-32,y-10,7,12]],'stone');
 f03Door(p,'survey_hut','Surveyor Station',[x-41,y-33,18,12],'S','wood','wood');
 f03Path(p,'survey_threshold','Survey notebook access',0,
  [[x-33,y-21,6,9],[x-32,y-15,8,5]],'stone');
 f03Door(p,'cutting_room','Rock Cutting and Screening House',[x+26,y-12,19,15],'W','hull','stone');
 f03Path(p,'ore_loading','Ore sorting and plant entry',0,
  [[x+7,y-9,19,6],[x+19,y-10,7,12],[x+11,y+1,12,5]],'stone');
 // Under-face adit: optional geology branch with a far pocket and a real
 // return to the original shaft. No disconnected staged "fake tunnel".
 f03Mass(p,'geology_adit','Under-Face Survey Adit',-1,
  [[x-25,y+16,33,7],[x-26,y+8,7,17],[x-30,y+9,11,6],
   [x+1,y+14,9,16]],null,'stone');
 p.stair(x-1,y+18,0,-1,x-1,y+18,'Descent through extraction face','hatch');
 p.prop(x-24,y+11,-1,'f03_ore_seam');
 p.prop(x+5,y+26,-1,'f03_ore_seam');
 p.note(x-27,y+10,-1,'Survey marks end in a narrow side pocket. The geological seam bends back toward the original shaft.');
 p.note(x+4,y+27,-1,'The intact vein here explains why the quarry was cut to these lower benches.');
 // Modest outlook, not a huge bridge; overlooks the actual crusher's lane.
 f03Path(p,'upper_lip','Short rock ledge above ore screen',1,
  [[x+20,y-10,6,18],[x+19,y+3,16,5]],'stone',true);
 p.stair(x+22,y-4,0,1,x+22,y-4,'Climb to broken ledge','exterior');
 p.prop(x+28,y+5,1,'f03_crane');
 p.note(x+30,y+5,1,'The upper hoist overlooks the separated rock-cut and loading lane, not a public bridge.');
 // Ore and spent spoil sit at the excavation edge; crushing is near exit.
 p.prop(x-25,y+3,0,'f03_ore_seam');
 p.prop(x-24,y+19,0,'f03_ore_seam');
 p.prop(x+1,y+31,0,'f03_spoil_heap');
 p.prop(x+15,y+29,0,'f03_spoil_heap');
 p.prop(x+10,y-3,0,'f03_crusher');
 p.prop(x+23,y+9,0,'f03_ore_ramp');
 p.note(x-18,y+17,0,'Quarry bench two reveals an optional cut under the rock face; the main road continues to the crusher.');
 p.note(x-31,y-14,0,'The survey shack sits on a real rim trail, separate from loaded ore transport.');
 return p.build();
}

function f03WritePlan(id:string):ArchPlan{
 const s=f03Profiles()[id];if(!s)throw Error('Unknown canonical F03 site '+id);
 if(id==='po_falls')return r3FallsPowerhouse(s);
 if(id==='po_sawaion')return r3AionSawmill(s);
 if(id==='po_fracquarry')return r3FractureQuarry(s);
 if(s.group==='WATER')return f03Water(s);
 if(s.group==='TIMBER')return f03Timber(s);
 if(s.group==='QUARRY')return f03Quarry(s);
 if(s.group==='PROCESS')return f03Process(s);
 return f03Utility(s);
}

export function fallsPowerhouse(){return f03WritePlan('po_falls');}
export function greywaterPumphouse(){return f03WritePlan('po_pumphouse');}
export function oldPumpingPlant(){return f03WritePlan('po_oldpump');}
export function aionEdgeSawmill(){return f03WritePlan('po_sawaion');}
export function mossbrookMill(){return f03WritePlan('po_mill');}
export function verdantTimberyard(){return f03WritePlan('po_timberyard');}
export function fractureQuarry(){return f03WritePlan('po_fracquarry');}
export function greybackQuarry(){return f03WritePlan('po_greyquarry');}
export function obsidianQuarry(){return f03WritePlan('po_obsq');}
export function charcoalKilns(){return f03WritePlan('po_kilns');}
export function slagworksFoundry(){return f03WritePlan('po_slag');}
export function sulfurWorks(){return f03WritePlan('po_sulfur');}
export function grainSiloComplex(){return f03WritePlan('po_siloc');}
export function deltaFilterStation(){return f03WritePlan('po_filter');}
export function geothermalStation(){return f03WritePlan('po_geo');}
export const F03_TARGET_IDS=['po_falls','po_pumphouse','po_oldpump','po_sawaion','po_mill','po_timberyard','po_fracquarry','po_greyquarry','po_obsq','po_kilns','po_slag','po_sulfur','po_siloc','po_filter','po_geo'] as const;