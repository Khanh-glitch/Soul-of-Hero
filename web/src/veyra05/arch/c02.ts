/**
 * VEYRA F02 / C02 — THREE DISTINCT INDUSTRIAL HARBOR DISTRICTS.
 * Georeferenced from GOLD terrain, roads and dock nodes, not POI-title guesses.
 * Ironholm = wet-side ore-to-rail freight handling, dock north of POI.
 * Emberport = ash/heat-worn industrial quay on southeastern coastal edge.
 * Sandgate = river/sea tidal sluice, warehouses and raised flood transfer.
 * No invented gameplay authority, industrial hazards, boats, currency or loot.
 */
import { Plan, type ArchPlan, type Rect, type Level } from './plan';
import {waterYard, pierDeck, waterfrontHouse, waterUpper, piersideDetails} from './waterfront';

function street(p:Plan,id:string,name:string,rs:Rect[],stone=true){waterYard(p,id,name,rs,stone)}
function pier(p:Plan,id:string,name:string,rs:Rect[],lv:0|1|2=0){pierDeck(p,id,name,rs,lv)}
function shelter(p:Plan,id:string,name:string,r:Rect,side:'N'|'S'|'E'|'W',mat:'wood'|'stone'|'brick'='stone'){waterfrontHouse(p,id,name,r,side,mat==='wood'?'tin':'hull',mat)}
function mass(p:Plan,id:string,name:string,lv:Level,rs:Rect[],roof:'tile'|'tin'|'wood'|'light'|'hull'|null='tin',mat:'wood'|'stone'|'brick'='stone') {p.structure(id,name,lv,{mat,roof});p.room(id,name,lv,id,rs)}
function truss(p:Plan,id:string,name:string,lv:1|2,rs:Rect[]){p.structure(id,name,lv,{mat:'wood',roof:null,open:true});p.room(id,name,lv,id,rs,{open:true,carve:true})}
function details(p:Plan,kind:string,pts:[number,number,Level][]){piersideDetails(p,kind,pts)}
function mark(p:Plan,x:number,y:number,lv:Level,text:string){p.note(x,y,lv,text)}

/** Ironholm: from hillside rail tracks to the northward sea ore tipple. */
export function ironholmIndustrialHarbor():ArchPlan {
 const p=new Plan('po_ironharbor','Ironholm Harbor / Ore Quay',
 'Ore arrives from inland workshops. An inclined haulage line drops to the northwest sea quay below a split foundry gantry, with two service routes and a tall crane.',
 [2154,2424,135,144]);
 // Land road trends north/south to a dock near 2236,2445. Streets below are intentionally
 // articulated narrow roads, not a rectangular terrain-filling plaza.
 street(p,'road_spine','Ironholm Ore-cart Street',[[2213,2470,8,69],[2209,2518,38,8],[2229,2460,11,18],[2222,2448,17,12]],true);
 street(p,'coke_lane','Foundry maintenance lane',[[2222,2495,41,6],[2256,2480,8,36],[2236,2510,25,7]],false);
 street(p,'lower_sort','Quay sorting forecourt',[[2197,2452,40,8],[2204,2458,13,25],[2204,2466,27,7],[2192,2473,24,8]],true);
 street(p,'service_loop','Twin repair alleys',[[2217,2482,28,7],[2240,2484,7,34],[2228,2512,16,6],[2220,2530,33,6]],false);
 street(p,'tally_square','Small workers tally court',[[2200,2528,24,11],[2191,2516,15,17]],true);
 street(p,'track_switches','Ore track switches and workshop turnouts',[[2209,2487,4,4],[2204,2456,31,5],[2215,2465,24,5],[2200,2479,64,5],[2198,2483,11,54],[2205,2490,19,5],[2217,2490,12,7],[2220,2497,62,5],[2246,2500,8,39],[2204,2511,68,5],[2189,2529,80,6],[2190,2533,25,8],[2199,2480,8,57],[2233,2455,8,38]],true);
 // GOLD water on the WEST; the north dock is land, so pier reaches westward.
 pier(p,'ore_quay','Ore Tippler Finger Quay',[[2192,2444,47,5],[2192,2439,7,19],[2184,2454,20,5],[2182,2451,5,17]],0);
 pier(p,'north_barge','Ore Transfer Platform',[[2203,2444,22,5],[2206,2434,5,12],[2194,2433,17,5]],0);
 shelter(p,'scalehouse','Ore Weighing House',[2237,2448,14,13],'W');
 shelter(p,'ore_shed','Covered Ironstone Sorting Shed',[2243,2473,18,15],'W');
 shelter(p,'winch_hall','Haulage Winch Hall',[2191,2485,18,14],'E');
 shelter(p,'workers','Quay Crew Lodging',[2190,2501,14,10],'E','wood');
 shelter(p,'forge_shop','Rail and Brake Repair Shop',[2254,2518,16,12],'W','brick');
 shelter(p,'tallyhouse','Harbor Records House',[2186,2538,16,11],'N','stone');
 shelter(p,'coaling','Coal Transfer Annex',[2269,2487,13,15],'W','brick');
 mass(p,'split_smeltery','Ore Separation / Twin Mill',0,[[2228,2487,18,10],[2235,2496,12,18],[2242,2509,8,9]],'tin','brick');
 p.door(2228,2492,0,'split_smeltery','Mill western access','main');
 p.door(2246,2517,0,'split_smeltery','Furnace side access','arch');
 // Level -1 deliberately stays within dry inland ground: the ore wheelrace and
 // smelter undercroft join via two distinct exits.
 mass(p,'under_rail','Counterweight Inspection Tunnel',-1,[[2203,2492,13,8],[2213,2494,22,5],[2231,2491,13,17],[2236,2505,11,7]],null,'stone');
 p.stair(2206,2495,0,-1,2206,2495,'Winch counterweight hatch','hatch');
 p.stair(2241,2508,0,-1,2241,2508,'Mill undercroft steps','interior');
 p.prop(2217,2496,-1,'gear_rack');p.prop(2237,2500,-1,'pipes');
 // Huge broken-L overhead transfer above separate work buildings.
 truss(p,'rail_overhead','Inclined Ore Conveyor Trestle',1,[[2204,2454,7,36],[2204,2483,29,7],[2226,2486,12,13],[2233,2492,9,15],[2237,2500,6,14]]);
 mass(p,'smeltery_gallery','Mill Hammer and Gear Gallery',1,[[2236,2488,18,11],[2245,2493,10,14]],'tin','brick');
 p.door(2236,2494,1,'smeltery_gallery','Belt gallery western pass','arch');
 p.stair(2209,2489,0,1,2208,2488,'Winch gantry stairs','exterior');
 p.stair(2241,2505,0,1,2241,2505,'Mill iron stair','interior');
 p.stair(2208,2455,0,1,2208,2455,'Quay hoist stair','ladder');
 // Top cranes are not copied from urban public belfries. Their roof shapes and
 // load arms form a spatial composition with a long dry high-level return.
 truss(p,'ore_bridge','Above-track Crane Bridge',2,[[2214,2485,14,5],[2207,2485,9,8],[2226,2486,14,5],[2232,2486,7,11]]);
 mass(p,'crane_cabin','Offset Crane Driving Cabin',2,[[2234,2489,12,8],[2239,2496,8,5]],'light','stone');
 p.door(2236,2491,2,'crane_cabin','Crane cab gallery entrance','arch');
 p.stair(2227,2488,1,2,2227,2488,'Overhead crane ladder','ladder');
 p.stair(2238,2490,1,2,2238,2490,'Crane machine ladder','ladder');
 // Two access points to the ore pier, distinctive upper rig silhouette.
 details(p,'c02_ore_tipple',[[2197,2446,0],[2209,2457,1]]);
 details(p,'c02_rail_wagon',[[2203,2459,0],[2211,2472,0],[2235,2522,0]]);
 details(p,'c02_chain_gantry',[[2207,2484,1],[2238,2492,1],[2221,2487,2]]);
 details(p,'c02_industrial_chimney',[[2251,2481,0],[2268,2491,0]]);
 details(p,'c02_steel_truss',[[2206,2463,1],[2223,2488,2]]);
 details(p,'c02_ore_bins',[[2203,2468,0],[2203,2473,0],[2258,2509,0]]);
 details(p,'c02_warning_lamp',[[2191,2449,0],[2205,2453,0],[2215,2492,0],[2235,2507,1]]);
 mark(p,2206,2450,0,'Ore descends from rail wagons; the dock lifts it by a cantilever gantry. The sea remains GOLD water.');
 mark(p,2226,2488,1,'This bridge carries ore across the yard: service stairs at the mill and at the quay form a traversal loop.');
 return p.build();
}

/** Emberport: heat/ash-side dry plant and a fan of coastal working decks. */
export function emberIndustrialHarbor():ArchPlan {
 const p=new Plan('po_ember','Emberport / Ashworks Quay',
  'An ash-black port on a southeast coastline: slag sorting courts, mineral works, chimney stacks and a shore conveyor to a scalloped sea loading platform.',
  [2442,1620,156,160]);
 street(p,'ash_road','Cinder Market Service Road',[[2477,1630,9,63],[2468,1660,30,8],[2492,1660,12,45]],true);
 street(p,'slag_cart','Ash Cart Loop',[[2500,1675,26,9],[2514,1681,9,27],[2486,1698,42,7],[2486,1695,8,20]],false);
 street(p,'kiln_yard','Kiln Separation Courtyard',[[2462,1641,27,8],[2461,1646,7,31],[2463,1671,33,8],[2484,1668,17,7]],true);
 street(p,'service_pass','Dross-lane & quay path',[[2498,1649,33,6],[2524,1650,8,30],[2512,1678,21,9],[2514,1684,10,18]],false);
 street(p,'coastal_apron','Heatshield Coastal Apron',[[2510,1688,31,11],[2525,1692,19,15],[2534,1700,23,5]],true);
 pier(p,'ember_quay','Ember Sea-facing Slag Quay',[[2520,1696,33,5],[2533,1695,7,24],[2532,1710,25,6],[2548,1709,8,14]],0);
 pier(p,'coal_boom','Outer Stack Transfer Stage',[[2545,1699,11,5],[2550,1699,5,22],[2548,1716,17,5]],0);
 shelter(p,'shift_house','Ember Shift and Cooling House',[2467,1624,17,12],'S','stone');
 shelter(p,'ash_hall','Ash Ledger and Screening Hall',[2450,1652,18,13],'E','brick');
 shelter(p,'slag_warehouse','Slag Storage Kiln',[2496,1628,18,14],'S','brick');
 shelter(p,'cinder_repair','Cinder Repair Yard Office',[2529,1633,16,13],'W','stone');
 shelter(p,'tanker_house','Tanker Pipe Inspection House',[2450,1682,18,12],'E','wood');
 shelter(p,'lighthouse','Ember Beacon and Signal House',[2537,1662,14,11],'W','stone');
 mass(p,'furnace_complex','Split Ashworks Furnace',0,[[2488,1646,17,11],[2497,1656,10,12],[2502,1661,13,7]],'tin','brick');
 p.door(2493,1646,0,'furnace_complex','Furnace north maintenance entrance','main');
 p.door(2508,1667,0,'furnace_complex','Furnace south side hatch','arch');
 street(p,'ash_industrial_walkways','Ashworks maintenance ribbons',[[2452,1638,83,5],[2462,1644,95,5],[2460,1645,8,47],[2473,1633,8,60],[2491,1638,10,66],[2507,1643,11,60],[2521,1638,11,65],[2449,1669,104,5],[2462,1681,82,5],[2453,1694,104,5],[2465,1641,16,11]],true);
 // Heat trench is DRY inspection space, not lava simulation.
 mass(p,'dry_duct','Cool-down Air Duct and Ash Service Tunnel',-1,
  [[2473,1650,20,7],[2487,1654,8,27],[2491,1672,24,7],[2508,1675,8,16]],null,'stone');
 p.stair(2478,1652,0,-1,2478,1652,'Ash ledger duct hatch','hatch');
 p.stair(2511,1688,0,-1,2511,1688,'Coast intake maintenance hatch','hatch');
 p.prop(2489,1662,-1,'pipes');p.prop(2508,1677,-1,'c02_heat_grate');
 truss(p,'hot_belt','Ore and Slag High Belt',1,
  [[2498,1635,6,25],[2499,1654,17,5],[2508,1657,7,23],[2509,1678,18,5],[2521,1679,7,22],[2526,1695,9,5]]);
 truss(p,'hot_belt_bypass','External Cooling-belt Bypass',1,[[2503,1641,6,12],[2504,1650,7,4],[2507,1653,4,7]]);
 mass(p,'furnace_gallery','Ashworks Cooling Gallery',1,
  [[2489,1647,13,11],[2496,1654,11,13]],'tin','brick');
 p.door(2501,1656,1,'furnace_gallery','Furnace upper vent arch','arch');
 p.door(2497,1654,1,'furnace_gallery','Cooling gallery north passage','arch');
 p.door(2502,1658,1,'furnace_gallery','Cooling gallery loading passage','arch');
 p.stair(2501,1654,0,1,2501,1654,'Slagworks ladder','ladder');
 p.stair(2527,1698,0,1,2527,1698,'Tide-end hoist return ladder','ladder');
 p.stair(2511,1679,0,1,2511,1679,'Coolant tower exterior staircase','exterior');
 // Twin stack vantage is offset, rather than a square rooftop storey.
 mass(p,'chimney_watch','Separated Stack Control Pod',2,
  [[2510,1656,8,8],[2514,1663,9,7]],'light','stone');
 truss(p,'stack_rail','Exposed Heat Shield Rail',2,
  [[2500,1656,13,5],[2506,1653,8,5],[2515,1663,14,5]],'wood');
 p.door(2513,1659,2,'chimney_watch','Stack deck safety passage','arch');
 p.door(2510,1658,2,'chimney_watch','Stack western inspection hatch','arch');
 p.door(2522,1665,2,'chimney_watch','Stack eastern platform door','arch');
 p.stair(2511,1657,1,2,2511,1657,'Upper stack ladder','ladder');
 details(p,'c02_industrial_chimney',[[2493,1646,0],[2512,1660,0],[2518,1638,0]]);
 details(p,'c02_heat_grate',[[2478,1672,0],[2494,1669,0],[2515,1691,0]]);
 details(p,'c02_rail_wagon',[[2507,1681,0],[2522,1685,0]]);
 details(p,'c02_chain_gantry',[[2528,1699,0],[2527,1694,1]]);
 details(p,'c02_warning_lamp',[[2518,1697,0],[2537,1709,0],[2513,1662,2]]);
 details(p,'c02_ore_bins',[[2477,1663,0],[2492,1689,0],[2518,1698,0]]);
 details(p,'c02_steel_truss',[[2509,1661,1],[2526,1688,1]]);
 mark(p,2501,1672,0,'The furnace-fed transfer route remains above the ash; the lower duct is accessible from two dry-side hatches.');
 mark(p,2536,1713,0,'A wide split-stage transfer dock reaches into the real southeastern sea, with independent loading fingers.');
 return p.build();
}

/** Sandgate: shallow river-to-sea flood port with tidal channels and raised gates. */
export function sandgateIndustrialHarbor():ArchPlan {
 const p=new Plan('po_sandgate','Sandgate / Sluice Port',
  'A mixed river-and-sea crossing. Goods follow a bank-road into a flood-control yard; an elevated gatewalk links warehouses while a lower culvert feeds the dock.',
  [1335,2184,154,159]);
 street(p,'trade_road','Sandgate Upper Approach Road',[[1401,2195,8,64],[1391,2240,31,8],[1408,2249,8,29]],true);
 street(p,'granary_lane','Dune Warehouse Lane',[[1418,2239,32,6],[1445,2238,8,40],[1420,2255,31,8]],false);
 street(p,'sluice_court','Irregular Tidal Customs Yard',[[1397,2264,37,10],[1409,2258,13,19],[1390,2274,18,10],[1388,2280,16,6]],true);
 street(p,'river_lane','Dike Maintenance Lane',[[1379,2220,26,6],[1377,2220,7,60],[1380,2273,18,8]],false);
 street(p,'quay_bench','Breakwater Quay Apron',[[1387,2285,30,8],[1398,2279,19,13]],true);
 // Two distinct water faces: main river mouth and southern sea fork.
 pier(p,'sluice_dock','Estuary Customs Berth',[[1379,2286,23,6],[1381,2291,8,16],[1381,2300,19,5]],0);
 pier(p,'southern_finger','Sandgate Outer Landing',[[1391,2288,8,15],[1387,2300,15,5],[1383,2300,5,13]],0);
 shelter(p,'gate_office','Sandgate Toll Gatehouse',[1406,2207,17,13],'S','stone');
 shelter(p,'ware_A','Upper Grain Transit Warehouse',[1421,2220,18,14],'S','brick');
 shelter(p,'ware_B','Canal Store and Rope Loft',[1455,2242,18,14],'W','wood');
 shelter(p,'pilot','Sandgate Pilot Survey Office',[1420,2273,13,12],'W','stone');
 shelter(p,'repair','Tidal Sluice Repair Shop',[1353,2249,20,13],'E','brick');
 shelter(p,'netting','Estuary Net Store',[1352,2271,18,13],'E','wood');
 mass(p,'central_gate','Counterweight Flood-Gate Assembly',0,
  [[1388,2242,18,12],[1396,2252,10,15],[1402,2260,11,8]],'tile','stone');
 p.door(1404,2267,0,'central_gate','Flood gate southern arch','main');
 p.door(1392,2242,0,'central_gate','Flood gate northern arch','arch');
 street(p,'canal_service_links','River-side sluice service routes',[[1365,2220,81,5],[1359,2238,98,5],[1362,2256,107,5],[1368,2272,90,5],[1375,2280,45,5],[1368,2228,9,58],[1432,2225,8,60],[1450,2246,8,32],[1401,2205,8,63],[1388,2248,31,5]],true);
 // Lower structure is placed on land: two accessible dry hatches.
 mass(p,'sluice_cellar','Flood Gate Counterweight Culvert',-1,
  [[1390,2246,13,8],[1397,2252,9,25],[1396,2272,14,7]],null,'stone');
 p.stair(1393,2248,0,-1,1393,2248,'Gatehouse weight hatch','hatch');
 p.stair(1405,2276,0,-1,1405,2276,'Sluice service ladder','ladder');
 p.prop(1398,2253,-1,'c02_counterweight');p.prop(1402,2273,-1,'c02_heat_grate');
 truss(p,'gatewalk','Above-current Tidal Gate Walk',1,
  [[1390,2236,10,25],[1397,2258,13,6],[1404,2259,20,5],[1416,2256,12,11],[1424,2255,19,5]]);
 mass(p,'warehouse_bridge','Grain Ledger Gallery',1,[[1423,2222,15,9],[1428,2230,11,11]],'tin','stone');
 truss(p,'transit_bridge','Sky Freight Slips',1,[[1425,2237,8,22],[1426,2255,11,4]],'wood');
 p.door(1428,2239,1,'warehouse_bridge','High freight window arch','arch');
 p.stair(1394,2244,0,1,1394,2244,'Gate counterweight stair','exterior');
 p.stair(1429,2239,0,1,1429,2239,'Upper grain warehouse stair','interior');
 p.stair(1426,2258,0,1,1426,2258,'Tidal warehouse service ladder','ladder');
 mass(p,'dike_watch','Asymmetric Dike Gauge Watch',2,[[1394,2239,8,8],[1398,2245,8,6]],'light','stone');
 truss(p,'flood_roof','Shallow Canal Watch Deck',2,[[1389,2241,8,5],[1391,2239,9,7],[1397,2244,11,5]]);
 p.door(1397,2244,2,'dike_watch','Dike top viewing passage','arch');
 p.door(1394,2241,2,'dike_watch','Dike watch west gate','arch');
 p.door(1401,2246,2,'dike_watch','Dike watch south gate','arch');
 p.door(1403,2245,2,'dike_watch','Dike eastern inspection passage','arch');
 p.door(1398,2247,2,'dike_watch','West canal watch hatch','arch');
 p.stair(1396,2243,1,2,1396,2243,'Gate watch ladder','ladder');
 details(p,'c02_counterweight',[[1399,2243,0],[1397,2241,1],[1396,2241,2]]);
 details(p,'c02_tide_gate',[[1394,2263,0],[1388,2287,0],[1398,2248,2]]);
 details(p,'c02_chain_gantry',[[1427,2236,1],[1407,2262,1]]);
 details(p,'c02_rail_wagon',[[1416,2263,0],[1423,2245,0]]);
 details(p,'c02_warning_lamp',[[1393,2289,0],[1381,2299,0],[1401,2257,1]]);
 details(p,'c02_steel_truss',[[1429,2256,1],[1391,2246,2]]);
 details(p,'c02_ore_bins',[[1430,2239,0],[1409,2271,0]]);
 mark(p,1394,2262,0,'The sluice regulates the river mouth; its underground counterweight can be inspected from two entrances.');
 mark(p,1387,2302,0,'River and seawater stay canonical GOLD cells. Only the dock timber becomes a walkable construction.');
 return p.build();
}
export const C02_IDS=['po_ironharbor','po_ember','po_sandgate'] as const;