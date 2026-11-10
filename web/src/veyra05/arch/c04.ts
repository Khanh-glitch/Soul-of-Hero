/**
 * C04 — SMALL LANDINGS IN THREE STATES (authored, not prefabricated).
 * WESTBANK: inhabited trading bank / dual quay loop, public and freight circulation.
 * DROWNED: shipwrecked pier; a missing ground-level span bridged only by the
 *          surviving *upper* truss; dry bank culvert as an alternate route.
 * TERN HUT: extreme bird-cliff proximity, two long asymmetric access routes,
 *           modest little nest-watch. Canonical GOLD coordinates stay fixed.
 *
 * Source inspiration: FAO village landings, tidal jetties, breakwater/shore
 * service logic. Exploration adaptation: upper/lower alternatives and visible
 * architectural clues, never invented boat/loot/trade Gameplay mechanics.
 */
import {Plan,type Rect} from './plan';
import {waterYard as yard,pierDeck as deck,waterfrontHouse as house,waterUpper as upper,piersideDetails as props} from './waterfront';

export function westbankLanding(){
 const b=new Plan('po_westbank','Westbank Landing','Lived-in tidal bank: linked market court, drying sheds, raised tally veranda and a forked boardwalk to open sea.',[1804,1817,116,102]);
 // The river widens into a coastal bank EAST of the POI marker. Approach is at 1836/1860; GOLD pier node is 1873/1883.
 yard(b,'westbank_track','Old freight road',[[1828,1834,7,35],[1829,1865,32,6],[1857,1865,7,20],[1859,1879,20,6],[1814,1834,17,4],[1813,1835,5,18]],true);
 yard(b,'public_market','Public stone court',[[1814,1848,27,15],[1837,1851,11,13],[1840,1860,8,13],[1832,1849,27,5]],true);
 yard(b,'fish_lane','Fish and net court',[[1823,1871,41,8],[1832,1877,37,6]],false);
 yard(b,'bank_terrace','Stepped working bank',[[1857,1879,27,8],[1857,1886,20,6],[1869,1890,15,5]],true);
 deck(b,'double_wharf','Two-face unloading wharf',[[1873,1882,8,18],[1878,1892,26,5],[1898,1890,6,12]],0);
 deck(b,'crab_finger','Fishing finger with cross-head',[[1875,1873,5,17],[1875,1873,20,4],[1891,1875,5,9]],0);
 // Public and working circulation never cross blindly; the shared courtyard or upper veranda offers a visible alternative.
 house(b,'custom_hall','Westbank Arrival & Ferry Hall',[1817,1838,20,11],'S','tile','stone');
 b.prop(1822,1841,0,'bench');b.prop(1830,1843,0,'map_table');b.prop(1833,1844,0,'c04_quay_sign');
 house(b,'tally_house','Westbank Cargo Tally',[1847,1839,15,13],'S','tin','stone');
 b.prop(1850,1844,0,'desk');b.prop(1856,1848,0,'crate_stack');
 house(b,'repair_barn','Net Menders and Slip Workshop',[1817,1874,17,11],'E','wood');
 b.prop(1824,1878,0,'net_rack');b.prop(1829,1881,0,'anvil');
 house(b,'coopers_shop','Cooper and Cordage Shop',[1838,1877,14,11],'E','hull','wood');
 b.prop(1843,1880,0,'barrel_stack');b.prop(1848,1884,0,'shelf');
 house(b,'brine_shed','Salt and Drying Shelter',[1849,1858,16,9],'S','thatch','wood');
 b.prop(1853,1861,0,'fish_drying_rack');b.prop(1858,1863,0,'grain_sack');
 // Tidal pump wheel race: access through the cooper and a second hatch in the yard, a coherent sub-ground loop.
 b.structure('tidal_undercroft','Tidal Gate Undercroft',-1,{mat:'stone',roof:null});
 b.room('west_culvert','Culvert Pump Passage',-1,'tidal_undercroft',[[1826,1880,16,6],[1840,1882,21,4],[1858,1882,11,7]]);
 b.stair(1828,1880,0,-1,1828,1880,'Repair Barn Pump Hatch','hatch');
 b.stair(1861,1886,0,-1,1861,1886,'Bank Spillway Steps','exterior');
 b.prop(1840,1884,-1,'pipes');b.prop(1862,1887,-1,'c04_tide_gate');
 b.note(1845,1883,-1,'The pumps keep the lower bank dry. Two entrances let workmen move without crossing the market.');
 // Raised L-shaped public balcony plus freighter hoist, linked by a broad bridge and two ground stairs.
 upper(b,'market_gallery','Westbank Market Upper Gallery',1,[[1819,1839,16,9],[1832,1846,6,11],[1834,1852,15,4]],'tile','stone');
 deck(b,'freight_skyway','Rope-Hoist Transfer Skyway',[[1848,1851,7,12],[1850,1860,11,5],[1857,1862,6,20],[1861,1878,21,4]],1);
 b.stair(1829,1847,0,1,1829,1847,'Ferry Hall Back Stair','interior');
 b.stair(1854,1848,0,1,1853,1851,'Tally-house Hoist Stair','interior');
 b.stair(1878,1880,0,1,1878,1880,'Wharf Upriver Ladder','ladder');
 b.door(1847,1853,1,'market_gallery','Gallery-to-hoist passage','arch');
 props(b,'c04_rope_pulley',[[1858,1863,1],[1864,1879,1]]);
 props(b,'c04_bollard',[[1874,1888,0],[1877,1895,0],[1898,1895,0],[1893,1875,0]]);
 props(b,'c04_lamp',[[1837,1853,0],[1860,1884,0],[1877,1882,1]]);
 // Off-centre tiny watch lantern; it does not repeat a large industrial tower.
 upper(b,'bank_signal','Westbank Watch Loft',2,[[1850,1842,10,9],[1857,1848,5,5]],'light','stone');
 deck(b,'bank_veranda','Watch Loft Windward Balcony',[[1846,1848,6,5],[1850,1850,6,6],[1853,1851,6,3]],2);
 b.stair(1851,1854,1,2,1852,1853,'Tally Watch Ladder','ladder');
 b.door(1857,1851,2,'bank_signal','Windward balcony arch','arch');
 props(b,'c04_signal',[[1855,1844,2],[1851,1853,2]]);
 b.note(1831,1860,0,'The busy public yard and the quayside working route are connected by a higher freight gallery.');
 return b.build();
}

export function drownedPier(){
 const b=new Plan('po_dpier','Drowned Pier','Storm-shattered berth: missing planks, collapsed slip and a surviving high truss form a visual puzzle, not an invisible jump.',[420,1002,117,97]);
 // True GOLD coastline is to EAST. The named dock is ~470,1044.
 yard(b,'shingle_way','Old Shingle Road',[[438,1017,7,33],[442,1042,29,7],[424,1017,16,4],[424,1019,6,15]],true);
 yard(b,'ruined_court','Broken Customs Yard',[[425,1029,32,19],[449,1028,18,14]],true);
 yard(b,'haulway','Old Wreck Haulway',[[460,1045,24,6],[465,1036,8,16]],true);
 house(b,'abandoned_office','Drowned Customs House',[428,1019,18,12],'S','tin','stone');
 b.prop(434,1024,0,'desk');b.prop(438,1026,0,'rubble');b.prop(432,1027,0,'c04_torn_notice');
 house(b,'salt_store','Salt-Rusted Gear House',[448,1020,17,12],'S','wood','wood');
 b.prop(452,1025,0,'net_rack');b.prop(460,1026,0,'barrel_stack');
 house(b,'boat_grave','Smashed Boat Yard',[424,1052,17,10],'E','hull','wood');
 b.prop(430,1056,0,'boat_hull');b.prop(433,1059,0,'cart_broken');
 yard(b,'shorewreck','Storm-scattered timbers',[[441,1051,35,7],[462,1057,16,5]],false);
 // Two separated ground islands. The missing span [488..500] stays actual water and is UNWALKABLE.
 deck(b,'shattered_first','Surviving Old Pier Approach',[[470,1040,18,6],[485,1038,5,10]],0);
 deck(b,'stranded_head','Drowned Pier Far Platform',[[501,1039,15,8],[505,1036,4,14]],0);
 // Tide-rake detour goes BELOW the missing main deck, creating a second hard-to-spot return.
 deck(b,'tide_rake','Thin Salvage Tide Rake',[[486,1046,4,7],[488,1050,18,2],[504,1047,3,5]],0);
 // Raise a surviving iron/worn-wood truss over the missing ground bridge.
 deck(b,'standing_truss','Old Pier Upper Truss',[[476,1041,13,4],[487,1041,17,3],[500,1039,8,5]],1);
 deck(b,'truss_landward','Overhead Shore Catwalk',[[465,1036,14,4],[458,1032,12,5]],1);
 b.stair(466,1036,0,1,466,1036,'Upper Salvage Ladder','exterior');
 b.stair(508,1042,0,1,508,1042,'Far Pier Return Ladder','ladder');
 b.stair(483,1042,0,1,483,1042,'Broken Girder Climb','ladder');
 // Dry-bank hollow only, not an imaginary undersea dungeon.
 b.structure('old_culvert','Old Bank Drain',-1,{mat:'stone',roof:null});
 b.room('drain_main','Bank Drainage Gallery',-1,'old_culvert',[[431,1035,15,8],[444,1039,20,4],[460,1040,11,7]]);
 b.stair(435,1039,0,-1,435,1039,'Customs Drain Hatch','hatch');
 b.stair(466,1043,0,-1,466,1043,'Beach Outfall Ladder','exterior');
 b.prop(439,1038,-1,'pipes');b.prop(460,1042,-1,'c04_algae_sluice');
 // Offset old semaphore is an outdoor perch above truss, not a square third-storey building.
 deck(b,'beacon_fragment','Leaning Signal Perch',[[468,1031,8,6],[473,1034,10,3]],2);
 b.stair(470,1035,1,2,470,1035,'Signal Spar Ladder','ladder');
 props(b,'c04_splinter_pile',[[479,1041,0],[487,1044,0],[507,1046,0]]);
 props(b,'c04_broken_post',[[473,1040,0],[484,1045,0],[505,1042,0],[513,1042,0],[490,1041,1]]);
 props(b,'c04_warning',[[449,1036,0],[470,1040,0]]);
 props(b,'c04_crow',[[471,1034,2],[478,1036,1]]);
 b.note(495,1042,1,'A stretch of pier is gone below; only the suspended truss crosses the water-gap.');
 b.note(453,1041,0,'Two routes: investigate the dry drain, or follow the high salvage truss to reach the stranded end.');
 return b.build();
}

export function ternHutPier(){
 const b=new Plan('po_gullpier','Tern Hut Pier','A tiny seabird-keeper outpost on an exposed island: long cliff approach, split dry/wet routes and a small nest-watch perch.',[3650,851,126,121]);
 // GOLD dock is northwest of canonical POI center: ~3683,882. The shoreline slopes NW/SE.
 yard(b,'island_track','Windbent Island Path',[[3714,936,21,6],[3710,921,7,20],[3704,915,11,7],[3695,902,11,12],[3685,891,15,14],[3699,915,7,14],[3691,901,8,13],[3699,911,10,11],[3705,919,12,6],[3690,916,8,16],[3691,928,22,6],[3690,914,12,5]],true);
 yard(b,'sheltered_yard','Seabird Keeper Yard',[[3708,929,32,15],[3716,937,28,8]],false);
 yard(b,'shore_ramp','West Shore Landing Ramp',[[3678,885,14,8],[3683,891,11,12],[3690,900,7,7],[3689,896,8,10]],true);
 deck(b,'tern_quay','Tern Inlet Pier',[[3675,876,6,21],[3669,878,17,5],[3669,882,6,10]],0);
 deck(b,'low_float','Low Mooring Finger',[[3674,887,18,4],[3687,881,5,12]],0);
 house(b,'keeper_house','Seabird Keeper Hut',[3720,926,15,11],'W','thatch','wood');
 b.prop(3725,930,0,'bed');b.prop(3728,933,0,'table');b.prop(3722,934,0,'c04_feather_basket');
 house(b,'weather_lock','Tern Wind & Rope Locker',[3703,913,12,9],'S','wood','wood');
 b.prop(3707,918,0,'net_rack');b.prop(3711,916,0,'rope_coil');
 house(b,'reed_drying','Coastal Net Drying Shed',[3696,921,11,8],'N','hull','wood');
 b.prop(3701,924,0,'net_rack');b.prop(3699,925,0,'c04_feather_basket');
 // Lower shore route follows sheltered terrain. The upper route is a windy L-shaped lookout above water.
 deck(b,'high_trestle','Exposed Ternwatch Boardwalk',[[3714,928,8,5],[3706,925,13,4],[3697,918,13,4],[3697,908,5,12],[3688,906,13,5],[3688,894,5,16]],1);
 deck(b,'nest_platform','Birdwatch Platform',[[3683,893,12,6],[3683,889,5,7]],1);
 b.stair(3718,931,0,1,3718,931,'Keeper Hut Exterior Stair','exterior');
 b.stair(3689,895,0,1,3689,895,'North Shore Ladder','ladder');
 b.stair(3709,918,0,1,3709,918,'Rope Locker Back Stair','exterior');
 // Tiny irregular second-level observation platform, not another generic town tower.
 deck(b,'tern_perch','Narrow Tern Perch',[[3706,912,5,8],[3703,909,7,5],[3700,912,8,4]],2);
 b.stair(3700,915,1,2,3702,914,'Tern Perch Rope Ladder','ladder');
 props(b,'c04_tern',[[3707,911,2],[3705,910,2],[3687,894,1],[3678,881,0]]);
 props(b,'c04_reed_screen',[[3712,932,0],[3707,927,1],[3688,902,0]]);
 props(b,'c04_lamp',[[3716,935,0],[3687,895,0]]);
 props(b,'c04_bollard',[[3676,879,0],[3675,890,0]]);
 b.note(3714,936,0,'The low path to the pier is sheltered. The high route passes the nesting cliff, then descends near the far quay.');
 b.note(3706,911,2,'The perching platform is deliberately small. No fortress towers belong at this bird-keeper hut.');
 return b.build();
}

export const C04_GRAMMAR={pilot:'C03 — completed predecessor',family:'F02',reused:['authored over-water deck','dry-bank undercroft','upper return route','multi-level stairs','visual-navigation cues'],new:['split living public/working waterfront','physically broken water gap + overhead survivable truss','island cliff access from off-centre dock','bird-keeper smaller scale'],scope:['po_westbank','po_dpier','po_gullpier']} as const;