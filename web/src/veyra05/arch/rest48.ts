/**
 * VEYRA REMAINING 48 — structural environment pass.
 * IDs and positions are verbatim from the 81 canonical GOLD POI roster. Names,
 * grouping and room functions preserve their contextual role. These are working
 * *spatial* plans, NOT 48 accepted final art pieces. No new sprites are created:
 * creator explicitly rejected F03 remake sprite quality; future art agent owns it.
 * No new loot, AI, economy, trade, death, evacuation transport, hazard or save rules.
 * A tiny cache/evac site does NOT get a pointless 4-level tower. This is intentional.
 * The 26-triad official grouping cannot be verified from currently available source.
 */
import {Plan, type ArchPlan, type Rect, type Level, type Mat, type RoofStyle} from './plan';

type Theme = 'ARCHIVE'|'SIGNAL'|'RUPTURE'|'WAY'|'WILD'|'CRYPT'|'COAST'|'UTILITY'|'SERVICE';
interface RestSite {id:string;name:string;cx:number;cy:number;family:Theme;index:number;concept:string;minor:boolean}
export const REST48_SITES:Record<string,RestSite> = {"po_observatory":{"id":"po_observatory","name":"Argus Observatory","cx":1916,"cy":340,"family":"ARCHIVE","index":0,"concept":"Sun dialcourt, side instrument gallery and a staggered telescope ascent","minor":false},"po_archive":{"id":"po_archive","name":"Argus Archive Vaults","cx":2036,"cy":452,"family":"ARCHIVE","index":1,"concept":"Vault anteroom, cataloguing wing and buried restricted stacks","minor":false},"po_hall_eyes":{"id":"po_hall_eyes","name":"Hall of Eyes","cx":1984,"cy":424,"family":"ARCHIVE","index":2,"concept":"Asymmetric ritual hall with interior colonnade and a single raised dais","minor":false},"po_lantern":{"id":"po_lantern","name":"Lantern Light","cx":2100,"cy":304,"family":"ARCHIVE","index":3,"concept":"A narrow keeper tower on a wind-facing approach, not a port warehouse","minor":false},"po_lanternstn":{"id":"po_lanternstn","name":"Lantern Cove Station","cx":2154,"cy":624,"family":"ARCHIVE","index":4,"concept":"Radio-booth and signal maintenance path near the cove road","minor":false},"po_kestrel":{"id":"po_kestrel","name":"Kestrel Radio Tower","cx":1400,"cy":600,"family":"SIGNAL","index":5,"concept":"Radio mast anchored by a short equipment bunker and service stair","minor":false},"po_typhon":{"id":"po_typhon","name":"Typhon's Fracture","cx":1112,"cy":704,"family":"RUPTURE","index":6,"concept":"Broken rock fissure with zigzag inspection path and a cut-through cleft","minor":false},"po_viaduct":{"id":"po_viaduct","name":"Crushed Viaduct","cx":1310,"cy":896,"family":"RUPTURE","index":7,"concept":"Interrupted stone bridge, side ramp and narrow surviving abutment","minor":false},"po_freightyard":{"id":"po_freightyard","name":"Shattered Freight Yard","cx":1380,"cy":1000,"family":"RUPTURE","index":8,"concept":"Stranded wagons and parallel freight platforms amid collapsed rail","minor":false},"po_confluence":{"id":"po_confluence","name":"Confluence Waystation","cx":1836,"cy":1336,"family":"WAY","index":9,"concept":"Riverside fork with sheltered wayfinding court and narrow rest house","minor":false},"po_ranger":{"id":"po_ranger","name":"Ranger Hut","cx":1600,"cy":1520,"family":"WILD","index":10,"concept":"Small forest hut with raised lookout deck and concealed path to trees","minor":false},"po_glade":{"id":"po_glade","name":"Mosslight Glade","cx":1564,"cy":1410,"family":"WILD","index":11,"concept":"Open woodland crescent with its only enclosed structure off-center","minor":false},"po_sapgrove":{"id":"po_sapgrove","name":"Sap Grove","cx":1920,"cy":1280,"family":"WILD","index":12,"concept":"Working grove, winding sap-tap trail and lean-to rather than a fort","minor":false},"po_elderwood":{"id":"po_elderwood","name":"Heart of the Elderwood","cx":1736,"cy":1424,"family":"WILD","index":13,"concept":"Circular ancient tree sanctuary with low branch crossing","minor":false},"po_meridian":{"id":"po_meridian","name":"Meridian Research Station","cx":2240,"cy":1380,"family":"WILD","index":14,"concept":"Research annex with observation cell and tucked field storeroom","minor":false},"po_ironvein":{"id":"po_ironvein","name":"Ironvein Mine","cx":2410,"cy":1310,"family":"WILD","index":15,"concept":"Sloped iron-adit entrance and ore-sorting niche, not a cargo port","minor":false},"po_ridgestop":{"id":"po_ridgestop","name":"Ridge Pass Station","cx":2356,"cy":1156,"family":"WAY","index":16,"concept":"Wind-cut mountain stop with a short sheltered lookout","minor":false},"po_rapids":{"id":"po_rapids","name":"Rapids Portage Hut","cx":2300,"cy":924,"family":"WAY","index":17,"concept":"Portage path with an elongated canoe shed and dry cargo platform","minor":false},"po_westwood":{"id":"po_westwood","name":"Westwood Hamlet","cx":848,"cy":1484,"family":"WAY","index":18,"concept":"Two small cottages on a woodland lane with a shared work court","minor":false},"po_fishcamp":{"id":"po_fishcamp","name":"Fish Camp","cx":704,"cy":1692,"family":"WILD","index":19,"concept":"Narrow fish-drying line, net-house and open sandy clearing","minor":false},"po_necropolis":{"id":"po_necropolis","name":"Necropolis of the Hollow Sun","cx":1208,"cy":2084,"family":"CRYPT","index":20,"concept":"Funerary processional entry, split tomb cluster and a lower ossuary","minor":false},"po_tombs":{"id":"po_tombs","name":"Dune Tombs","cx":1040,"cy":2172,"family":"CRYPT","index":21,"concept":"Low sandstone tomb entrance and two connected hidden burial rooms","minor":false},"po_cairns":{"id":"po_cairns","name":"Sunken Cairns","cx":940,"cy":1980,"family":"CRYPT","index":22,"concept":"Scattered prehistoric cairn ring and a single accessible stone crypt","minor":false},"po_bonestop":{"id":"po_bonestop","name":"Bone Road Waystation","cx":1504,"cy":1950,"family":"WAY","index":23,"concept":"Road rest beside old bones, with a roofed shelter and broken marker","minor":false},"po_gate":{"id":"po_gate","name":"Threshold Gate","cx":336,"cy":1024,"family":"WAY","index":24,"concept":"Gate court, offset watch shelter and a small elevated sentry platform","minor":false},"po_beacon":{"id":"po_beacon","name":"Beacon Rock Light","cx":536,"cy":1312,"family":"SIGNAL","index":25,"concept":"Working sea-cliff beacon with its existing helicopter reservation untouched","minor":false},"po_wreck":{"id":"po_wreck","name":"Wreck Isle Salvage","cx":368,"cy":1744,"family":"RUPTURE","index":26,"concept":"A grounded shipwreck salvage walk with two discrete shelter huts","minor":false},"po_tidecamp":{"id":"po_tidecamp","name":"Tidepool Fishing Camp","cx":340,"cy":1096,"family":"COAST","index":27,"concept":"Tidepool fishing shelter and open low-tide processing trail","minor":false},"po_gullnest":{"id":"po_gullnest","name":"Seabird Nesting Cliffs","cx":3744,"cy":856,"family":"COAST","index":28,"concept":"Cliff-nesting watch path with a low observation shelter","minor":false},"po_netcamp":{"id":"po_netcamp","name":"Gull Net Camp","cx":280,"cy":1696,"family":"COAST","index":29,"concept":"Fishnet drying camp with a compact loft and open shore-work yard","minor":false},"po_emberwatch":{"id":"po_emberwatch","name":"Ember Watch","cx":3240,"cy":1492,"family":"SIGNAL","index":30,"concept":"Highland fire observation with exterior lookout and supply shelter","minor":false},"po_surtur":{"id":"po_surtur","name":"Foundry of the First Fire","cx":3388,"cy":1652,"family":"CRYPT","index":31,"concept":"Ancient fire dais and a shallow ash-buried shrine, no industry bridge","minor":false},"po_saltpans":{"id":"po_saltpans","name":"Salt Pans","cx":3280,"cy":644,"family":"COAST","index":32,"concept":"Flat segmented salt evaporation pans with small pump hut","minor":false},"po_saltlight":{"id":"po_saltlight","name":"Saltwick Light","cx":3464,"cy":524,"family":"SIGNAL","index":33,"concept":"Narrow coastal marker tower with service cells","minor":false},"po_racks":{"id":"po_racks","name":"Kelp Racks","cx":3380,"cy":708,"family":"COAST","index":34,"concept":"Long kelp-drying rows and tool shelter, not a pier warehouse","minor":false},"po_gullwreck":{"id":"po_gullwreck","name":"Gull Isle Wreck","cx":3772,"cy":892,"family":"RUPTURE","index":35,"concept":"Wave-swept scattered wreck salvage with a short safe shore route","minor":false},"po_ironwh":{"id":"po_ironwh","name":"Ironholm Depot","cx":2472,"cy":2580,"family":"UTILITY","index":36,"concept":"Compact ore depot annex and a covered side loading platform","minor":false},"po_rc_meridian":{"id":"po_rc_meridian","name":"Meridian Archive Cache","cx":2276,"cy":1336,"family":"UTILITY","index":37,"concept":"Concealed archive niche adjacent to Meridian facilities","minor":true},"po_rc_ironvein":{"id":"po_rc_ironvein","name":"Foreman's Strongbox","cx":2444,"cy":1352,"family":"UTILITY","index":38,"concept":"Small foreman lockbox alcove near the iron adit","minor":true},"po_rc_kestrel":{"id":"po_rc_kestrel","name":"Kestrel Tower Safe","cx":1416,"cy":636,"family":"UTILITY","index":39,"concept":"Short radio-service crawl and equipment safe","minor":true},"po_rc_dam":{"id":"po_rc_dam","name":"Falls Dam Vault","cx":1508,"cy":908,"family":"UTILITY","index":40,"concept":"Dry dam maintenance vault with one keyed-looking metal door art only","minor":true},"po_rc_sandgate":{"id":"po_rc_sandgate","name":"Sandgate Customs Strongbox","cx":1436,"cy":2212,"family":"UTILITY","index":41,"concept":"Customs documents strongroom, no functional trading system","minor":true},"po_rc_salt":{"id":"po_rc_salt","name":"Saltwick Harbor Safe","cx":3120,"cy":644,"family":"UTILITY","index":42,"concept":"Saltwick record safe inside a small detached annex","minor":true},"po_vend_gulf":{"id":"po_vend_gulf","name":"Gulfhead Trading House [ĐỀ XUẤT]","cx":2132,"cy":1788,"family":"SERVICE","index":43,"concept":"Proposed trading counter space, architectural only; no trade behavior","minor":true},"po_vend_strait":{"id":"po_vend_strait","name":"Strait Landing Counter [ĐỀ XUẤT]","cx":2572,"cy":1000,"family":"SERVICE","index":44,"concept":"Proposed roadside counter, architectural only; no trade behavior","minor":true},"po_evac_west":{"id":"po_evac_west","name":"Westmouth Evac Pier","cx":684,"cy":1160,"family":"SERVICE","index":45,"concept":"Westmouth evacuation assembly shelter, no boat spawning","minor":true},"po_evac_south":{"id":"po_evac_south","name":"Southfoot Evac Beach","cx":2356,"cy":2180,"family":"SERVICE","index":46,"concept":"Southfoot evacuation beach marker, no transport activation","minor":true},"po_evac_hook":{"id":"po_evac_hook","name":"Hook Evac Point","cx":2784,"cy":748,"family":"SERVICE","index":47,"concept":"Hook evacuation assembly marker and small supply shed only","minor":true}};

export const REST48_IDS = Object.keys(REST48_SITES);
function open(p:Plan,id:string,name:string,lv:Level,rects:Rect[],mat:Mat='stone',raised=false){
 p.structure(id,name,lv,{open:true,roof:null,mat});p.room(id,name,lv,id,rects,{open:true,carve:raised});
}
function mass(p:Plan,id:string,name:string,lv:Level,rects:Rect[],roof:RoofStyle='wood',mat:Mat='wood'){
 p.structure(id,name,lv,{mat,roof});p.room(id,name,lv,id,rects);
}
function hut(p:Plan,id:string,name:string,r:Rect,side:'S'|'W'|'N'|'E',roof:RoofStyle='wood',mat:Mat='wood'){
 const[x,y,w,h]=r;mass(p,id,name,0,[r],roof,mat);
 let X=side==='W'?x:side==='E'?x+w-1:x+Math.floor(w/2),Y=side==='N'?y:side==='S'?y+h-1:y+Math.floor(h/2);
 p.door(X,Y,0,id,`${name} entrance`,'main');
 open(p,id+'_threshold',name+' entrance approach',0,[side==='N'?[X-2,y-4,5,5]:side==='S'?[X-2,y+h-1,5,5]:side==='E'?[x+w-1,Y-2,5,5]:[x-4,Y-2,5,5]]);
}
function climb(p:Plan,id:string,x:number,y:number,upper:1|2,kind:'ladder'|'interior'|'exterior'='ladder'){
 const lv=(upper===1?0:1) as Level;
 p.stair(x,y,lv,upper,x,y,`${id} · ${upper===1?'upper access':'roof perch'}`,kind);
}
function props(p:Plan,lv:Level,kind:string,pts:Array<[number,number]>){for(const[x,y]of pts)p.prop(x,y,lv,kind)}
// Every plan starts from a very small approach point; style is supplied by a
// meaningful place-specific geometry, never from a universal industrial cross.
function plan(s:RestSite,extent:number){const x=s.cx,y=s.cy;return new Plan(s.id,s.name,s.concept,[x-extent,y-extent,2*extent+1,2*extent+1]);}
function archive(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,v=s.index%5,p=plan(s,29);
 open(p,'approach','Scholarly approach and side court',0,[[x-3,y-8,6,9],[x-9,y-4,26,5],[x+9,y-16,5,13]],'stone');
 hut(p,'reading_hall',s.id==='po_archive'?'Archive Reading Court':'Instrument and Record Hall',[x-11,y-22,21,14],'S','tile','stone');
 hut(p,'side_office',s.id==='po_lantern'?'Lightkeeper Store':'Field Records Annex',[x+11,y-14,13,10],'W',v%2?'tin':'tile','stone');
 props(p,0,'shelf',[[x-5,y-17],[x+1,y-16],[x+16,y-11]]);
 p.prop(x-9,y+3,0,s.id==='po_observatory'?'sundial':'bench');
 if(s.id==='po_observatory'||s.id==='po_hall_eyes'||s.id==='po_lantern'){
  mass(p,'upper_gallery',s.id==='po_hall_eyes'?'Hall Oculus Walk':'Stone Viewing Gallery',1,[[x-8,y-20,16,10],[x-4,y-12,8,6]],'tile','stone');
  climb(p,'gallery staircase',x+3,y-15,1,'interior');p.prop(x+4,y-17,1,'telescope');
  if(s.id==='po_observatory'||s.id==='po_lantern'){
   open(p,'signal_perch','Open Instrument Perch',2,[[x-5,y-18,11,6]],'stone');climb(p,'instrument perch',x+2,y-17,2);
   p.prop(x-1,y-17,2,'lookout');
  }
 }else if(s.id==='po_archive'){
  mass(p,'sealed_catalogue','Buried Restricted Catalogue',-1,[[x-8,y-19,16,10],[x-3,y-11,7,5]],'wood','stone');
  p.stair(x+2,y-14,0,-1,x+2,y-14,'Stair down to archive shelves','hatch');
  p.prop(x-4,y-15,-1,'shelf');p.prop(x+4,y-16,-1,'shelf');
 }
 p.note(x-2,y-1,0,s.concept);return p.build();
}
function signal(s:RestSite):ArchPlan{
 // Beacon Rock Light has an MGP-D07 helicopter reservation at [541..546,1301..1306].
 // Keep every authored tower tile WEST of it; connect original GOLD center
 // by a low southern footpath instead of painting over a reserved fixture.
 const beacon=s.id==='po_beacon',x=beacon?s.cx-12:s.cx,y=s.cy;
 const p=beacon?new Plan(s.id,s.name,s.concept,[s.cx-45,s.cy-28,76,57]):plan(s,25);
 const small=s.id==='po_saltlight';
 open(p,'stair_path','Offset windward approach',0,[[x-3,y-4,6,22],[x-14,y+10,24,5],...(beacon?[[x+10,y-1,7,17],[x-2,y+10,15,5]] as Rect[]:[])],'stone');
 hut(p,'tower_base',small?'Coast Signal Base':'Signal Maintenance Tower',[x-7,y-18,14,14],'S','light','stone');
 hut(p,'relay_shed','Signal Relay Cabin',[x-21,y+3,12,10],'E','tin','wood');
 mass(p,'tower_one','Instrument Platform',1,[[x-5,y-16,10,10]],'wood','stone');climb(p,'tower inner ladder',x+1,y-12,1);
 p.prop(x-2,y-13,1,'lookout');
 if(!small){open(p,'mast_open','Exposed Mast Walk',2,[[x-3,y-15,7,7]],'wood');climb(p,'top aerial',x+1,y-11,2);p.prop(x-1,y-13,2,'signal_flag')}
 p.prop(x-5,y+8,0,'lantern');p.note(x+2,y+6,0,s.concept);return p.build();
}
function rupture(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,v=s.index%4,p=plan(s,31);
 // Broken topography, with a route around the void. No generic elevated harbour.
 open(p,'surviving_way','Surviving fractured approach',0,
 [[x-22,y-22,6,40],[x-22,y+12,42,6],[x+14,y-20,6,38],[x-22,y-22,13,6],[x+6,y-22,14,6],[x-2,y-2,5,20],[x+10,y-10,7,4]],'stone');
 open(p,'rock_cut','Broken stone margins',0,[[x-21,y-23,15,4],[x+1,y+16,17,4]],'stone');
 hut(p,'guard_shack',s.id==='po_freightyard'?'Collapsed Freight Ledger Booth':'Weathered Salvage Shelter',[x+18,y-13,12,9],'W','tin','stone');
 props(p,0,'rubble',[[x-8,y-12],[x-2,y+4],[x+12,y+6]]);
 if(s.id==='po_typhon'||s.id==='po_viaduct'){
   mass(p,'underside','Under-Cleft Survey Pocket',-1,[[x+9,y-12,12,9]],'wood','stone');
   p.stair(x+12,y-10,0,-1,x+12,y-10,'Edge survey descent','hatch');p.prop(x+15,y-9,-1,'rubble');
 }
 if(s.id==='po_freightyard'){
  open(p,'freight_platform','Broken Rail Platform',0,[[x-27,y-1,23,5],[x-26,y+1,5,10]],'wood');
  p.prop(x-21,y+3,0,'ore_cart');
 }
 if(s.id==='po_wreck'||s.id==='po_gullwreck'){
  p.prop(x-7,y+9,0,'boat_hull');p.prop(x-2,y-16,0,'rope_coil');
 }
 p.note(x,y+15,0,s.concept);return p.build();
}
function way(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,variant=s.index%4,p=plan(s,30);
 open(p,'switch','Road fork and passing place',0,[[x-4,y-27,8,51],[x-15,y-6,35,5],[x-23,y-4,9,10],[x+16,y-4,5,17],[x-11,y+11,10,4],[x+1,y-18,7,4]],'stone');
 hut(p,'wayhouse',s.id==='po_gate'?'Threshold Gatehouse':'Wayfarer Shelter',[x+8,y-22,14,11],'W','tile','stone');
 hut(p,'supply','Travelers Supply Shelter',[x-24,y+8,14,11],'E','wood','wood');
 p.prop(x-20,y+12,0,'bench');p.prop(x+11,y-18,0,'table');
 if(s.id==='po_gate'||s.id==='po_ridgestop'){
  mass(p,'gate_loft','Sentry Lookout Floor',1,[[x+10,y-20,10,7]],'wood','stone');climb(p,'sentry ladder',x+13,y-17,1);
  p.prop(x+13,y-16,1,'lookout');
 }else if(s.id==='po_westwood'){
   hut(p,'sleeping_cottage','Woodland Sleeping Cottage',[x-29,y-22,12,10],'E','thatch','wood');
   p.prop(x-18,y-16,0,'bed');
   open(p,'westwood_link','Footpath to sleeping cottage',0,[[x-18,y-17,16,4]],'wood');
 }
 p.prop(x-1,y-8,0,'banner');p.note(x+2,y+12,0,s.concept);return p.build();
}
function wild(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,p=plan(s,32),isSacred=s.id==='po_elderwood'||s.id==='po_glade';
 // A crooked network of natural desire paths rather than symmetrical court.
 open(p,'woodland_path','Bent woodland exploration trail',0,
 [[x-23,y-17,9,5],[x-18,y-17,4,26],[x-18,y+6,24,4],[x+3,y-13,4,23],[x-2,y-16,19,4],[x+6,y-20,4,14],[x-3,y-2,9,9]],'stone');
 if(isSacred){
  open(p,'grove_ring','Ancient open clearing',0,[[x-6,y-9,13,9],[x-11,y-4,21,4]],'stone');
  p.prop(x-1,y-1,0,'sundial'); // Existing stone marker only, the real forest canopy is GOLD terrain.
 }else if(s.id==='po_fishcamp'){
  hut(p,'netshed','Small Fishing Netshed',[x-28,y+9,14,10],'E','thatch','wood');
  open(p,'net_path','Narrow forest track to net shed',0,[[x-17,y+7,5,8]],'stone');
  props(p,0,'net_rack',[[x-14,y+10],[x+1,y+5]]);
 }else{
  hut(p,'field_hut',s.id==='po_meridian'?'Meridian Field Annex':s.id==='po_ironvein'?'Prospector Shelter':'Ranger Shelter',[x+9,y-24,15,11],'W','thatch','wood');
  p.prop(x+13,y-20,0,'shelf');
 }
 if(s.id==='po_ironvein'){
  mass(p,'iron_cut','Stone Prospecting Cut',-1,[[x-12,y-8,11,9]],'wood','stone');
  open(p,'prospector_access','Short zigzag to prospecting adit',0,[[x-14,y-4,14,5]],'stone');
  p.stair(x-8,y-4,0,-1,x-8,y-4,'Prospector adit entrance','hatch');
  p.prop(x-4,y-5,-1,'ore_cart');
 }
 if(s.id==='po_meridian'||s.id==='po_ranger'){
  mass(p,'platform','Low Woodland Lookout',1,[[x+10,y-22,11,7]],'wood','wood');climb(p,'observation ladder',x+14,y-19,1);
 }
 props(p,0,'bench',[[x-13,y+8],[x+5,y-12]]);
 p.note(x+1,y+8,0,s.concept);return p.build();
}
function crypt(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,p=plan(s,28),altar=s.id==='po_surtur';
 open(p,'procession','Processional stone approach',0,[[x-4,y-9,8,14],[x-13,y-1,27,5],[x+10,y-13,5,14]],'stone');
 hut(p,'entry','Sacred Threshold Hall',[x-11,y-23,21,14],'S',altar?'tin':'tile','stone');
 props(p,0,altar?'coal_pile':'bones',[[x-11,y+5],[x+12,y-3]]);
 // Lower rooms are justified for archaeological tombs, not for every POI.
 if(!altar){
  mass(p,'burial','Burial Chamber and Side Niche',-1,[[x-8,y-20,15,11],[x-4,y-11,8,5]],'tile','stone');
  p.stair(x+1,y-14,0,-1,x+1,y-14,'Tomb descending steps','interior');
  p.prop(x-4,y-15,-1,'bones');
 }else{
  open(p,'offering_rim','Low Charred Offering Rim',0,[[x-12,y+7,25,5],[x-2,y+3,5,6]],'stone');
  p.prop(x+2,y+8,0,'hearth');
 }
 p.note(x+1,y+7,0,s.concept);return p.build();
}
function coast(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,p=plan(s,28);
 open(p,'shore_foot','Coastal path and small working apron',0,
 [[x-4,y-25,7,38],[x-16,y-8,34,6],[x+10,y-14,6,16],[x-20,y+9,30,5],[x+2,y-18,7,5]],'wood');
 const isSalt=s.id==='po_saltpans'||s.id==='po_racks';
 hut(p,'coast_hut',isSalt?'Evaporation and Drying Store':'Fisher Shelter',[x+8,y-22,14,10],'W','thatch','wood');
 if(isSalt){
  open(p,'drying_beds',s.id==='po_saltpans'?'Salt Evaporation Beds':'Kelp-Drying Spines',0,
  [[x-22,y+6,8,13],[x-11,y+7,7,12],[x+1,y+7,7,12]],'stone');
  props(p,0,s.id==='po_racks'?'net_rack':'barrel_stack',[[x-18,y+11],[x-7,y+12],[x+4,y+12]]);
 }else{
  props(p,0,'net_rack',[[x-11,y-9],[x+11,y-3]]);
  p.prop(x+2,y+8,0,'lantern');
 }
 if(s.id==='po_gullnest'){
  mass(p,'cliff_watch','Seabird Survey Hut Loft',1,[[x+11,y-20,9,7]],'thatch','wood');climb(p,'cliff watch',x+14,y-17,1);
 }
 p.note(x,y+2,0,s.concept);return p.build();
}
function utility(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,p=plan(s,s.minor?17:23);
 open(p,'service_entry','Small documented maintenance approach',0,
 [[x-3,y-2,7,16],[x-11,y+7,24,5]],'stone');
 hut(p,'annex',s.id==='po_ironwh'?'Ore Depot Records Annex':'Secured Instrument and Record Niche',
 [x-8,y-13,16,11],'S','tin','stone');
 p.prop(x-4,y-10,0,'shelf');p.prop(x+2,y-9,0,'crate_stack');
 if(s.id==='po_rc_dam'||s.id==='po_rc_meridian'){
  mass(p,'dry_store','Dry Subfloor Service Cell',-1,[[x-6,y-11,12,8]],'wood','stone');
  p.stair(x+1,y-7,0,-1,x+1,y-7,'Dry service stair','hatch');p.prop(x+4,y-9,-1,'shelf');
 }
 if(s.id==='po_ironwh'){
  open(p,'side_bay','Short covered freight apron',0,[[x-19,y-5,13,7],[x-19,y+1,5,10],[x-8,y-2,8,5]],'stone');
  p.prop(x-14,y+3,0,'ore_cart');
 }
 p.note(x,y+8,0,s.concept);return p.build();
}
function service(s:RestSite):ArchPlan{
 const x=s.cx,y=s.cy,p=plan(s,20),v=s.id.startsWith('po_vend_');
 open(p,'clearway',v?'Public counter approach':'Evacuation assembly clearing',0,[[x-4,y-4,8,18],[x-14,y+7,29,6]],'stone');
 hut(p,'shelter',v?'Proposed Counter Shell (NO trade logic)':'Emergency Waiting Shelter (NO transport logic)',
 [x-8,y-15,16,11],'S',v?'tile':'thatch',v?'stone':'wood');
 props(p,0,v?'market_stall':'bench',[[x-9,y+9],[x+7,y+9]]);
 p.note(x+1,y+5,0,s.concept);
 return p.build();
}
export function makeRest48Plan(id:string):ArchPlan{
 const s=REST48_SITES[id];if(!s)throw Error('Unknown REST48 canonical GOLD site '+id);
 switch(s.family){
 case 'ARCHIVE':return archive(s);case 'SIGNAL':return signal(s);
 case 'RUPTURE':return rupture(s);case 'WAY':return way(s);
 case 'WILD':return wild(s);case 'CRYPT':return crypt(s);
 case 'COAST':return coast(s);case 'UTILITY':return utility(s);
 case 'SERVICE':return service(s);
 }
}