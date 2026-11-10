/**
 * F02/C01 — urban port complexes, THREE INDEPENDENT CIVIC PROGRAMS.
 * GEO audited with source reader & GOLD dock nodes, not poi centre guesses:
 * Gulfhead: inland hill market (2104,1756) to south-west river sea quay (2049,1858)
 * Westmouth: river-mouth tide crossing and sea wharf at (652,1117)
 * Saltwick: west shore salt-pans & quays at (3055,651)
 * Architectural principles: shore access; distinct public/working routes;
 * meaningful 4-level choice; externally readable towers and galleries;
 * recoverable loops, not obligatory identical basement/floor structure.
 */
import {Plan, type ArchPlan, type Rect, type Level} from './plan';
import {waterYard as yard, pierDeck as deck, waterfrontHouse as house,
 waterUpper as upper, piersideDetails as props} from './waterfront';

function ground(p:Plan,id:string,name:string,rects:Rect[],stone=true) {yard(p,id,name,rects,stone)}
function shaped(p:Plan,id:string,name:string,lv:Level,rects:Rect[],roof:'tile'|'tin'|'wood'|'thatch'|'light'|'hull'|null,mat:'wood'|'stone'|'brick'='stone'){
 p.structure(id,name,lv,{roof,mat});p.room(id,name,lv,id,rects);
}
function raised(p:Plan,id:string,name:string,lv:1|2,rects:Rect[]) {deck(p,id,name,rects,lv)}
function offsetFootprint(p:Plan,id:string,rects:Rect[]){const r=p.p.rooms.find(r=>r.id===p.p.poi+'.'+id&&r.level===0);if(!r)throw new Error('Missing urban building '+id);r.rects=rects;}


/** The Gulfhead arrival is a two-part urban district, not a freestanding jetty. */
export function gulfheadHarbor():ArchPlan{
 const p=new Plan('po_gulfhead','Gulfhead Port Quarter',
  'A hill-market above a river gulf. Two very different approaches meet at the southern quay: civic ridge street and lower freight spine.',
  [2021,1714,139,160]);
 // Public roads use the existing GOLD ridge; the tidal water is ONLY approached on marked decks.
 ground(p,'ridge_road','Ridge Caravan Street',[[2076,1717,8,35],[2090,1734,8,30],[2085,1750,40,7],[2118,1744,8,40],[2100,1773,26,7],[2074,1776,29,7]],true);
 ground(p,'market_square','Irregular market square',[[2078,1736,35,14],[2068,1741,15,14],[2080,1756,22,15],[2101,1761,12,12]],true);
 ground(p,'pilgrim_way','Public Crescent from ridge to river',[[2071,1770,8,47],[2059,1807,20,9],[2058,1813,9,40],[2050,1846,22,9],[2045,1851,24,7]],true);
 ground(p,'freight_street','Lower service route',[[2122,1753,9,49],[2102,1794,29,8],[2081,1798,22,8],[2077,1802,11,22],[2066,1820,22,7],[2066,1824,6,25]],false);
 ground(p,'goods_terraces','Cargo steps and sorting apron',[[2047,1836,29,7],[2044,1843,32,11],[2053,1853,23,12]],true);
 ground(p,'threshold_lanes','Guild threshold walks',[[2103,1733,10,8],[2050,1828,13,12]],true);
 // Fish-bone quays extend left into actual GOLD river and near-shore sea.
 deck(p,'outer_gulf_quay','Gulfhead Split Jetty',[[2038,1851,16,6],[2034,1847,5,16],[2030,1857,26,5],[2045,1858,5,12]],0);
 deck(p,'merchant_finger','Merchant Bow Pier',[[2041,1838,6,18],[2032,1838,16,5],[2033,1834,5,11]],0);
 // civic buildings are offset around a real plaza rather than one block of boxes.
 house(p,'civic_hall','Gulfhead Merchants Assembly',[2082,1721,23,13],'S','tile','stone');
 house(p,'spice_hall','Covered Spice & Fish Exchange',[2112,1726,20,12],'W','thatch','wood');
 house(p,'caravan_lodge','Old Caravan Lodging',[2060,1754,16,13],'E','wood','stone');
 house(p,'chart_house','Tide Chart House',[2132,1750,13,16],'W','tin','stone');
 house(p,'coopers','Coopers and Winch Repair',[2090,1784,20,13],'S','hull','wood');
 house(p,'grain_market','Gulfhead Grain Weighing Hall',[2128,1780,17,15],'W','tile','brick');
 house(p,'river_warehouse','Lower River Warehouse',[2079,1832,18,14],'W','tin','stone');
 house(p,'quay_watch','Customs and Quay Watch',[2037,1825,14,11],'E','wood','stone');
 offsetFootprint(p,'coopers',[[2090,1784,14,9],[2096,1790,14,7]]);
 offsetFootprint(p,'civic_hall',[[2082,1721,16,13],[2098,1727,7,7]]);

 // Lower hill passage ties market goods directly to quay, two accessible hatches.
 shaped(p,'hill_archive','Merchant Underpass and Toll Archive',-1,
   [[2075,1757,16,7],[2083,1763,5,30],[2081,1790,8,25],[2071,1812,18,8],[2064,1818,10,20]],null,'stone');
 p.stair(2089,1759,0,-1,2089,1759,'Assembly Ledger Hatch','hatch');
 p.stair(2069,1832,0,-1,2069,1832,'Dock Freight Passage','exterior');
 p.prop(2085,1760,-1,'shelf');p.prop(2085,1800,-1,'crate_stack');p.prop(2073,1819,-1,'barrel_stack');
 p.note(2084,1790,-1,'A tunnel carried bonded goods beneath the ridge streets. The quay and market had different keys.');
 // Upper mixed market walk turns from masonry roof to open aerial bridge over goods alley.
 upper(p,'public_gallery','Merchants Hall Loggia',1,[[2084,1723,19,9],[2095,1730,8,20],[2087,1747,17,7]],'tile','stone');
 raised(p,'market_balcony','Market Arcades and Skywalk',1,
   [[2077,1748,15,5],[2077,1742,6,10],[2089,1745,18,5],[2105,1745,16,5],[2117,1742,5,14],[2117,1754,10,4]]);
 upper(p,'chart_upper','Tide Chart Gallery',1,[[2133,1752,10,12],[2122,1755,13,4]],'light','stone');
 raised(p,'cargo_gantry','Freight Aerial Conveyor',1,
   [[2095,1790,5,20],[2084,1805,13,5],[2084,1805,5,31],[2065,1830,23,5],[2058,1832,11,6],[2057,1837,5,24]]);
 // Doorways across upper roofs are intentional. The level-1 town hall wall
 // otherwise seals the bridge despite the walk being painted around it.
 p.door(2087,1748,1,'public_gallery','West arcade connecting arch','arch');
 p.door(2103,1748,1,'public_gallery','East market connecting arch','arch');
 p.door(2093,1747,1,'public_gallery','Roof atrium passage','arch');
 p.door(2122,1756,1,'chart_upper','Tide Gallery market arch','arch');
 p.stair(2094,1730,0,1,2094,1730,'Assembly Roof Stair','interior');
 p.stair(2123,1756,0,1,2123,1756,'Chart House External Steps','exterior');
 p.stair(2097,1792,0,1,2097,1792,'Coopers Hoist Stair','exterior');
 p.stair(2060,1858,0,1,2060,1858,'Quay Gantry Ladder','ladder');
 // Two distinctive roof destinations: a slender tower and open merchant banner walk.
 shaped(p,'market_tower','Gulfhead Bell and Tariff Tower',2,
   [[2090,1725,10,7],[2095,1731,6,8]],'light','stone');
 raised(p,'banner_walk','Market Rooftop Signal Walk',2,[[2086,1729,7,5],[2086,1731,14,5]]);
 p.door(2090,1730,2,'market_tower','West Bell Lookout arch','arch');
 p.stair(2097,1734,1,2,2097,1734,'Tariff Bell Ladder','ladder');
 upper(p,'quay_control','Gulf Crane Control Pavilion',2,[[2055,1838,8,9],[2059,1845,5,5]],null,'wood');
 raised(p,'crane_veranda','Open Hoist Operating Deck',2,[[2055,1840,11,5],[2059,1844,6,8]]);
 p.door(2062,1842,2,'quay_control','Quay roof loading arch','arch');
 p.door(2062,1847,2,'quay_control','Crane veranda arch','arch');
 p.stair(2060,1844,1,2,2060,1844,'Gulf Crane Operating Ladder','ladder');
 props(p,'c01_city_banner',[[2094,1734,2],[2121,1749,1],[2048,1833,0]]);
 props(p,'c01_arched_gate',[[2086,1751,0],[2119,1754,0],[2067,1824,0]]);
 props(p,'c01_canopy_market',[[2080,1760,0],[2092,1759,0],[2107,1756,0]]);
 props(p,'c01_cargo_hook',[[2089,1832,1],[2060,1850,1],[2058,1848,2]]);
 props(p,'c01_quay_lamp',[[2050,1853,0],[2041,1859,0],[2062,1841,0],[2104,1742,0]]);
 props(p,'c01_roof_dormer',[[2096,1787,0],[2089,1724,0],[2136,1785,0]]);
 props(p,'c01_mooring',[[2035,1859,0],[2047,1860,0],[2036,1840,0]]);
 p.note(2090,1751,0,'The civic road descends from the hills. The freight route is deliberately separate until the tide-facing warehouses.');
 p.note(2051,1857,0,'The jetty is beside the genuine GOLD river mouth; its timber does not turn water into land.');
 return p.build();
}

/** Westmouth is a canal crossing and fortified market belt, not another Gulfhead. */
export function westmouthHarbor():ArchPlan{
 const p=new Plan('po_westmouth','Westmouth Canal Port',
  'City streets straddle a river-mouth trade gate. Old sea wall, upper counting bridge, tide gallery and market roofs reveal alternate crossings.',
  [632,1051,137,116]);
 ground(p,'old_road','Westmouth High Street',[[698,1055,9,64],[699,1108,34,8],[718,1112,7,27],[680,1092,25,8]],true);
 ground(p,'market_belt','Festival and market alleys',[[670,1079,43,7],[677,1083,8,33],[672,1111,46,9],[688,1120,9,22]],true);
 ground(p,'rope_lane','Ropeward service streets',[[661,1096,17,7],[660,1102,8,25],[659,1119,31,7],[653,1121,13,6]],false);
 ground(p,'canal_stairs','Canal quay descent',[[650,1108,18,8],[646,1111,18,15],[651,1120,15,9]],true);
 deck(p,'mouth_finger','Mouth South Pier',[[642,1114,19,5],[640,1114,5,20],[635,1130,16,5]],0);
 deck(p,'north_tide_gate','Northern Berthing Dock',[[643,1104,20,4],[638,1098,9,11],[636,1095,15,5]],0);
 ground(p,'south_towpath','Rivermouth Towpath behind pilot houses',[[686,1138,34,5]],true);
 ground(p,'doorway_spurs','Back lanes to ledger houses',[[705,1099,21,6],[718,1102,11,9],[692,1118,15,8],[662,1122,16,13]],true);
 // A narrow river between both quays remains GOLD, with bridges only in authored decks.
 house(p,'fish_market','Westmouth Covered Fish Exchange',[682,1065,24,12],'S','tile','stone');
 house(p,'canal_lodge','River Gatehouse',[710,1074,19,12],'W','tin','stone');
 house(p,'guildhouse','Harbour Guild Hall',[726,1093,22,16],'W','tile','brick');
 house(p,'netters','Net-Menders Court House',[660,1077,17,14],'E','hull','wood');
 house(p,'fishworks','Pickle and Smoke Works',[658,1130,21,14],'N','wood','wood');
 house(p,'pilot_house',"Old Pilot's House",[695,1125,14,12],'N','thatch','stone');
 house(p,'canal_office','Canal Customs Office',[681,1124,14,12],'N','tin','stone');
 offsetFootprint(p,'fish_market',[[682,1065,17,12],[699,1070,7,7]]);
 offsetFootprint(p,'guildhouse',[[726,1093,14,16],[740,1100,8,9]]);

 // Tide-engine inspection below dry bank: separate from the sea, with two exits.
 shaped(p,'tide_vault','Old Tide Chamber',-1,
   [[677,1118,14,13],[686,1117,24,7],[702,1119,10,20]],null,'stone');
 p.stair(688,1129,0,-1,688,1129,'Customs Tide Hatch','hatch');
 p.stair(703,1130,0,-1,703,1130,'Pilot House Tunnel Stair','interior');
 p.prop(689,1120,-1,'pipes');p.prop(708,1130,-1,'barrel_stack');
 p.note(689,1120,-1,'A shuttered tidal inspection tunnel once connected the two sides of the shipping toll road.');
 upper(p,'market_mezz','Fish Market Auction Mezzanine',1,
   [[684,1067,20,10],[698,1074,6,11]],'tile','stone');
 raised(p,'upper_arch','The Canal Customs Skybridge',1,
   [[697,1084,7,21],[698,1099,30,5],[721,1082,7,23]]);
 upper(p,'guild_upper','Guild Registry and Admiralty Room',1,
   [[729,1095,17,12],[725,1095,5,9]],'tile','brick');
 raised(p,'net_gallery','Westmouth Net-Sorting Gallery',1,
   [[671,1086,8,21],[665,1100,14,5],[663,1104,5,20],[656,1119,12,5]]);
 p.door(699,1084,1,'market_mezz','Auction-to-customs skybridge','arch');
 p.door(725,1101,1,'guild_upper','Guild customs bridge','arch');
 p.stair(698,1073,0,1,698,1073,'Market Mezzanine Stair','interior');
 p.stair(735,1104,0,1,735,1104,'Guild Upper Stair','interior');
 p.stair(674,1088,0,1,674,1088,'Netters Exterior Stair','exterior');
 p.stair(662,1122,0,1,662,1122,'Quay Gallery Ladder','ladder');
 raised(p,'guild_veranda','Admiralty Lookout Veranda',2,[[729,1099,14,5],[735,1102,7,8]]);
 p.door(735,1102,2,'guild_veranda','Guild rooftop plaza arch','arch');
 p.stair(737,1104,1,2,737,1104,'Guild Bell Stair','ladder');
 shaped(p,'pilot_tower','Narrow Rivermouth Pilot Tower',2,
   [[695,1125,8,8],[697,1131,6,6]],'light','stone');
 raised(p,'pilot_veranda','Rivermouth Flag Platform',2,[[692,1128,9,6],[696,1132,10,4]]);
 upper(p,'pilot_loft','Pilot House Upper Rooms',1,[[697,1127,9,9]],'thatch','stone');
 p.stair(699,1132,0,1,699,1132,'Pilot House Loft Steps','interior');
 p.door(695,1129,2,'pilot_tower','Pilot Rooftop West Arch','arch');
 p.door(702,1133,2,'pilot_tower','Pilot Rooftop East Arch','arch');
 p.stair(699,1132,1,2,699,1132,'Pilot Flag Ladder','ladder');
 props(p,'c01_arched_gate',[[698,1115,0],[664,1118,0],[725,1101,0]]);
 props(p,'c01_canopy_market',[[690,1083,0],[706,1081,0],[688,1113,0]]);
 props(p,'c01_city_banner',[[735,1102,2],[697,1132,2],[703,1088,1]]);
 props(p,'c01_mooring',[[641,1117,0],[636,1132,0],[638,1098,0]]);
 props(p,'c01_quay_lamp',[[650,1119,0],[661,1120,0],[678,1115,0],[699,1078,0]]);
 props(p,'c01_roof_dormer',[[692,1070,0],[732,1097,0],[701,1128,0]]);
 props(p,'c01_rope_cart',[[663,1123,0],[674,1116,0],[702,1134,0]]);
 p.note(672,1106,0,'Narrow lanes meet at the river toll. Two overhead galleries overlook the working and public routes.');
 return p.build();
}

/** Saltwick Harbor: salt terrace city wrapped around a tidal cut, not a generic fishing port. */
export function saltwickHarbor():ArchPlan{
 const p=new Plan('po_saltharbor','Saltwick Harbor',
  'An old sea-salt harbour where drying yards form terraces above the bay, a sea-wall cloister protects the market, and the tide works are entered from below.',
  [3035,626,121,105]);
 ground(p,'salt_roads','Saltwick Stone High Road',[[3082,632,7,61],[3083,650,47,7],[3092,671,40,7],[3118,654,8,37],[3070,658,16,8]],true);
 ground(p,'salt_market','Covered Salt Market Court',[[3090,646,24,24],[3112,659,24,12],[3090,667,15,14]],true);
 ground(p,'brine_lane','Wet Brine Works Lane',[[3061,647,30,6],[3055,648,16,17],[3058,660,29,7],[3075,663,12,22]],false);
 ground(p,'evaporation_courts','Drying terraces above tide',[[3093,681,32,8],[3083,683,31,6],[3098,690,20,5]],true);
 ground(p,'sea_cloister','Sea-Wall Cloister',[[3055,638,10,24],[3060,640,22,7],[3062,659,18,8]],true);
 ground(p,'civic_approaches','Covered salt court access lanes',[[3099,638,18,10],[3064,635,30,8],[3085,642,11,15],[3068,639,10,14],[3123,659,16,14],[3097,677,12,21],[3067,658,20,11]],true);
 // Saltwick GOLD quay is to WEST. Separate stone head and timber seaward finger.
 deck(p,'saltwick_stone_quay','Saltwick Tide Quay',[[3049,643,14,6],[3043,644,9,17],[3043,656,22,5]],0);
 deck(p,'saltwick_float','Low Salt Barges Loading Finger',[[3045,649,6,25],[3039,665,20,5],[3056,657,5,12]],0);
 house(p,'salt_exchange','Saltwick Customs & Salt Exchange',[3090,629,24,12],'S','tile','stone');
 house(p,'market_hall','White Salt Market',[3110,642,24,12],'W','wood','brick');
 house(p,'guild_kitchen','Harbour Kitchen and Coopers',[3135,662,15,13],'W','tin','wood');
 house(p,'evap_works','Brine Evaporation Shed',[3094,695,18,11],'N','hull','wood');
 house(p,'tide_house','Tide-Work Pump Hall',[3066,667,16,12],'N','tin','stone');
 house(p,'coast_watch','Seawall Saltwarden',[3058,630,14,11],'E','light','stone');
 offsetFootprint(p,'salt_exchange',[[3090,629,17,12],[3107,633,7,8]]);
 offsetFootprint(p,'market_hall',[[3110,642,19,12],[3125,648,9,6]]);
 offsetFootprint(p,'coast_watch',[[3058,630,10,11],[3068,634,4,7]]);

 // Multi-arm underground salt cistern, with loop into high terrace via second exit.
 shaped(p,'brine_cistern','Old Brine Cistern and Causeway',-1,
   [[3069,665,13,9],[3080,667,22,6],[3097,671,8,24],[3096,691,20,5]],null,'stone');
 p.stair(3074,670,0,-1,3074,670,'Pump Intake Hatch','hatch');
 p.stair(3107,694,0,-1,3107,694,'Terrace Cistern Stair','interior');
 p.prop(3074,668,-1,'pipes');p.prop(3099,682,-1,'barrel_stack');p.note(3094,675,-1,'Salt water settles below the market before workers carry it to the drying terraces.');
 upper(p,'white_arcades','Salt Market Cloister Gallery',1,
   [[3093,631,20,9],[3094,639,8,18],[3100,651,27,6]],'tile','stone');
 raised(p,'salt_balcony','Open Salt Court Balconies',1,
   [[3085,647,12,5],[3083,649,6,23],[3073,661,16,5],[3072,660,6,17]]);
 upper(p,'evap_platform','Evaporation Works Upper Stage',1,
   [[3096,696,14,9],[3101,691,8,7]],'wood','wood');
 raised(p,'salt_haulway','Brine Hoist Skywalk',1,
   [[3075,676,6,14],[3079,685,27,5],[3102,687,6,15]]);
 // Open tiered walkway at the sea wall with two access sockets.
 raised(p,'seawall_skywalk','Saltwarden High Sea Walk',1,[[3059,645,18,6],[3072,647,12,5],[3082,647,14,5]]);
 upper(p,'saltwarden_upper','Saltwarden Loft',1,[[3061,632,11,9]],'light','stone');
 p.stair(3068,636,0,1,3068,636,'Seawall Loft Stair','interior');
 p.door(3071,649,1,'salt_balcony','Salt arcades crossover','arch');
 p.door(3099,651,1,'white_arcades','Salt market balcony arch','arch');
 p.door(3104,693,1,'evap_platform','Evaporation gallery arch','arch');
 p.stair(3103,636,0,1,3103,636,'Exchange Grand Stair','interior');
 p.stair(3074,672,0,1,3074,672,'Pump House Hoist Stair','exterior');
 p.stair(3105,698,0,1,3105,698,'Evaporation Stairs','interior');
 p.stair(3059,650,0,1,3059,650,'Seawall Gallery Ladder','ladder');
 shaped(p,'white_tower','Saltwarden Bell Tower',2,
   [[3062,631,10,9],[3067,637,5,6]],'light','stone');
 raised(p,'white_roofwalk','Saltwarden Coastal Veranda',2,
   [[3059,635,7,7],[3065,637,9,5]]);
 p.door(3062,635,2,'white_tower','Saltwarden west seawall arch','arch');
 p.door(3071,639,2,'white_tower','Saltwarden east coast arch','arch');
 p.stair(3068,636,1,2,3068,636,'Bell Tower Stair','ladder');
 raised(p,'market_canopy','Open Salt Market Roof Lookout',2,
   [[3094,633,10,6],[3099,637,10,4]]);
 p.stair(3100,636,1,2,3100,636,'Market Canopy Ladder','ladder');
 props(p,'c01_white_salt_pan',[[3096,686,0],[3107,686,0],[3114,686,0],[3104,695,0]]);
 props(p,'c01_brine_pipe',[[3076,674,0],[3076,682,1],[3089,688,1]]);
 props(p,'c01_city_banner',[[3103,636,2],[3068,638,2],[3124,651,0]]);
 props(p,'c01_canopy_market',[[3095,655,0],[3107,659,0],[3119,669,0]]);
 props(p,'c01_roof_dormer',[[3100,633,0],[3120,646,0],[3064,633,0]]);
 props(p,'c01_mooring',[[3046,656,0],[3055,668,0],[3042,667,0]]);
 props(p,'c01_quay_lamp',[[3055,649,0],[3074,656,0],[3090,669,0]]);
 p.note(3095,669,0,'This is not a mere ferry pier. Brine enters through tide gates and salt leaves by road, both visible from the market roof.');
 return p.build();
}
export const C01_GRAMMAR={family:'F02',sites:['po_gulfhead','po_westmouth','po_saltharbor'],
 method:'reusable water-deck transport, 4-level physical circulation, purposeful 3D roof access, locally researched routes',
 difference:['Gulfhead ridge market to distant gulf berth','Westmouth tidal river-mouth market with public/worker archways','Saltwick salt works and coast cloister linked through cistern'],
 gameplayBoundary:['no boats or travel mechanics','no loot, economy or NPC authority','no alteration of GOLD water']};