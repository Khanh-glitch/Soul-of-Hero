/**
 * THREE AUTHORED VEYRA COMPOUNDS.
 *
 * Greywater Hamlet  — a lake town organised by water: cart road → north gate →
 *   paved green → longhouse hall and loft, fisher's cottage, granary with an
 *   outside stair and roof lookout, smithy forge yard and boat shed. Cellars in
 *   the longhouse and cottage are joined by a smuggled crawl: the second way in.
 *
 * Argus Academy     — a formal institution: south gate and forecourt → paved
 *   quadrangle with a sundial → west great hall (nave + transept + vestry) with
 *   an upper gallery, a north library with stacks, a map room linked by a
 *   SKYBRIDGE, a three-stage observatory tower, a paved service yard with a
 *   generator shed, and a sealed archive beneath the vestry reached from inside.
 *
 * Ironholm Foundry  — a working ore works: rail spur along the river bank → ore
 *   yard and tipple tower → conveyor bridge → casting hall with a furnace row
 *   and a crane-catwalk loop over the floor, pay office with a foreman's floor,
 *   and a flooded pump adit under the hall that loops back to a yard hatch.
 */
import { Plan, type ArchPlan } from './plan';
import { addBarrier, addDwelling, addGround, addLoft, addRoofDeck } from './f01';

export function greywaterHamlet(): ArchPlan {
  const b = new Plan('po_greywater', 'Greywater Hamlet', 'Lake town on the cart road · 4 levels', [1584, 1152, 88, 60]);

  // ── paved village ground: every exterior door and stair foot lands on it
  b.structure('grounds', 'Hamlet Grounds', 0, { mat: 'stone', roof: null, open: true });
  b.room('apron', 'Hamlet Paving', 0, 'grounds', [[1586, 1160, 78, 49]], { open: true });
  b.room('green', 'Village Green', 0, 'grounds', [[1594, 1164, 26, 20]], { open: true });
  b.room('north_lane', 'North Cart Lane', 0, 'grounds', [[1624, 1152, 16, 14]], { open: true });
  b.room('east_yard', 'East Drying Yard', 0, 'grounds', [[1648, 1174, 18, 22]], { open: true });
  b.room('west_lane', 'Lake Path', 0, 'grounds', [[1584, 1174, 12, 20]], { open: true });

  // ── flood wall: the hamlet's one defensive structure, built after the lake rose
  b.structure('wall', 'Flood Wall', 0, { mat: 'stone', roof: null, barrier: true });
  b.room('wall_n', 'Flood Wall · North', 0, 'wall', [[1584, 1160, 40, 1], [1638, 1160, 30, 1]]);
  b.room('wall_s', 'Flood Wall · South', 0, 'wall', [[1584, 1208, 40, 1], [1638, 1208, 30, 1]]);
  b.room('wall_w', 'Flood Wall · West', 0, 'wall', [[1584, 1160, 1, 16], [1584, 1184, 1, 25]]);
  b.room('wall_e', 'Flood Wall · East', 0, 'wall', [[1664, 1160, 1, 16], [1664, 1184, 1, 25]]);
  b.note(1629, 1161, 0, 'The north gate is the only cart entrance. The wall is older than the road.');

  // ── long house: hall + west wing (L), with a sleeping loft above
  b.structure('longhouse', 'Long House', 0, { mat: 'wood', roof: 'thatch' });
  b.room('hall', 'Long House · Common Hall', 0, 'longhouse', [[1592, 1166, 20, 9]]);
  b.room('wing', 'Long House · West Wing', 0, 'longhouse', [[1592, 1175, 9, 9]]);
  b.door(1604, 1174, 0, 'longhouse', 'Hall Door', 'main');
  b.door(1592, 1179, 0, 'longhouse', 'West Door', 'service');
  b.partition(1600, 1167, 1600, 1173, 0);
  b.door(1600, 1171, 0, 'longhouse', 'Hall ↔ Wing', 'arch');
  b.structure('longhouse_loft', 'Long House Loft', 1, { mat: 'wood', roof: 'thatch' });
  b.room('loft', 'Long House · Sleeping Loft', 1, 'longhouse_loft', [[1594, 1168, 16, 6]]);
  b.stair(1608, 1171, 0, 1, 1608, 1169, 'Loft Stair', 'interior');
  b.prop(1597, 1179, 0, 'hearth'); b.prop(1602, 1171, 0, 'table'); b.prop(1595, 1169, 0, 'bench');
  b.prop(1595, 1180, 0, 'bed'); b.prop(1597, 1181, 0, 'bed'); b.prop(1606, 1169, 0, 'shelf');
  b.prop(1598, 1170, 1, 'bed'); b.prop(1603, 1170, 1, 'bed'); b.prop(1608, 1168, 1, 'crate_stack');
  b.cache(1601, 1170, 1, 'Loft Chest', [['cloth', 3], ['rope', 2], ['bandage', 1]]);
  b.note(1602, 1172, 0, 'Twelve bowls still set on the hall table. Nobody came back for supper.');

  // ── fisher's cottage, with the smoke cellar below
  b.structure('cottage', 'Fisher’s Cottage', 0, { mat: 'wood', roof: 'tile' });
  b.room('cot_living', 'Fisher’s Cottage · Living Room', 0, 'cottage', [[1636, 1170, 14, 9]]);
  b.partition(1644, 1171, 1644, 1172, 0);
  b.room('cot_back', 'Fisher’s Cottage · Net Room', 0, 'cottage', [[1644, 1171, 6, 4]], {});
  b.door(1641, 1178, 0, 'cottage', 'Cottage Door', 'main');
  b.door(1644, 1173, 0, 'cottage', 'Net Room Door', 'interior');
  b.prop(1639, 1173, 0, 'table'); b.prop(1647, 1176, 0, 'bed'); b.prop(1648, 1172, 0, 'net_rack');
  b.cache(1642, 1176, 0, 'Tackle Box', [['rope', 3], ['fiber', 5], ['meat', 1]]);

  // ── granary: grain store, drying loft and roof lookout — outside stair is the alternate route
  b.structure('granary', 'Granary', 0, { mat: 'wood', roof: 'tin' });
  b.room('gran_store', 'Granary · Grain Store', 0, 'granary', [[1654, 1164, 12, 10]]);
  b.door(1659, 1164, 0, 'granary', 'Granary Door', 'main');
  b.prop(1658, 1168, 0, 'crate_stack'); b.prop(1662, 1171, 0, 'barrel_stack'); b.prop(1656, 1172, 0, 'grain_sack');
  b.structure('granary_loft', 'Granary Drying Loft', 1, { mat: 'wood', roof: 'tin' });
  b.room('gran_loft', 'Granary · Drying Loft', 1, 'granary_loft', [[1655, 1165, 10, 7]]);
  b.stair(1652, 1168, 0, 1, 1655, 1168, 'Outside Stair', 'exterior');
  b.prop(1657, 1167, 1, 'grain_sack'); b.prop(1661, 1170, 1, 'grain_sack'); b.prop(1656, 1169, 1, 'crate_stack');
  b.cache(1662, 1166, 1, 'Loft Strongbox', [['seed', 5], ['crop', 3], ['cloth', 2]]);
  b.structure('granary_deck', 'Granary Roof Lookout', 2, { mat: 'wood', roof: null });
  b.room('deck', 'Granary Roof Lookout', 2, 'granary_deck', [[1656, 1166, 8, 5]]);
  b.stair(1660, 1170, 1, 2, 1660, 1168, 'Roof Ladder', 'ladder');
  b.prop(1657, 1167, 2, 'lookout'); b.prop(1662, 1169, 2, 'banner');
  b.cache(1662, 1168, 2, 'Lookout Cache', [['arrow', 8], ['torch', 2], ['bandage', 2]]);

  // ── smithy and its open forge yard
  b.structure('smithy', 'Smithy', 0, { mat: 'stone', roof: 'wood' });
  b.room('smith', 'Smithy', 0, 'smithy', [[1592, 1188, 12, 9]]);
  b.door(1598, 1196, 0, 'smithy', 'Smithy Door', 'main');
  b.structure('forge_yard', 'Forge Yard', 0, { mat: 'stone', roof: null, open: true });
  b.room('forge', 'Forge Yard', 0, 'forge_yard', [[1604, 1188, 9, 9]], { open: true });
  b.prop(1600, 1192, 0, 'anvil'); b.prop(1596, 1192, 0, 'forge'); b.prop(1607, 1191, 0, 'coal_pile');
  b.cache(1594, 1194, 0, 'Smith’s Chest', [['iron_ingot', 2], ['fasteners', 4], ['scrap', 4]]);

  // ── boat shed on the lake path
  b.structure('boatshed', 'Boat Shed', 0, { mat: 'wood', roof: 'hull' });
  b.room('boat', 'Boat Shed', 0, 'boatshed', [[1652, 1180, 13, 9]]);
  b.door(1658, 1188, 0, 'boatshed', 'Boat Shed Door', 'main');
  b.prop(1656, 1183, 0, 'boat_hull'); b.prop(1661, 1185, 0, 'net_rack');
  b.cache(1662, 1184, 0, 'Boat Locker', [['rope', 3], ['treated_canvas', 2], ['meat', 1]]);

  // ── cellars + smugglers' crawl (the hidden loop between two buildings)
  b.structure('cellars', 'Hamlet Cellars', -1, { mat: 'stone', roof: null });
  b.room('lh_cellar', 'Long House Cellar', -1, 'cellars', [[1592, 1168, 14, 7]]);
  b.room('crawl_w', 'Smugglers’ Crawl · West', -1, 'cellars', [[1606, 1171, 13, 2]], { carve: true });
  b.room('crawl_e', 'Smugglers’ Crawl · East', -1, 'cellars', [[1619, 1170, 3, 5]], { carve: true });
  b.room('crawl_n', 'Smugglers’ Crawl · North Leg', -1, 'cellars', [[1622, 1172, 14, 2]], { carve: true });
  b.room('cot_cellar', 'Cottage Smoke Cellar', -1, 'cellars', [[1636, 1172, 12, 6]]);
  b.room('smoke_room', 'Smoke Store', -1, 'cellars', [[1648, 1172, 4, 6]], { secret: true });
  b.stair(1596, 1172, 0, -1, 1596, 1172, 'Cellar Hatch', 'hatch');
  b.stair(1642, 1176, 0, -1, 1642, 1176, 'Cottage Ladder', 'ladder');
  b.door(1624, 1172, -1, 'cellars', 'Crawl Bulkhead', 'arch');
  b.prop(1628, 1172, -1, 'crate_stack'); b.prop(1631, 1172, -1, 'bones'); b.prop(1610, 1171, -1, 'barrel_stack');
  b.prop(1638, 1174, -1, 'barrel_stack'); b.prop(1650, 1175, -1, 'smoke_rack');
  b.cache(1646, 1174, -1, 'Smugglers’ Hoard', [['spares', 3], ['iron_ingot', 2], ['fuel_can', 1]]);
  b.note(1628, 1171, -1, 'A crawl dug between two cellars, shored with boat timber. Whatever they moved, they moved it at night.');

  // ── green furniture
  b.prop(1608, 1184, 0, 'well'); b.prop(1598, 1182, 0, 'market_stall'); b.prop(1618, 1180, 0, 'market_stall');
  b.prop(1628, 1162, 0, 'lantern'); b.prop(1636, 1162, 0, 'lantern'); b.prop(1604, 1198, 0, 'bench');
  b.note(1607, 1186, 0, 'The well rope is new. Someone still draws water here.');
  return b.build();
}

export function argusAcademy(): ArchPlan {
  const b = new Plan('po_academy', 'Argus Academy', 'Cloister college · skybridge · sealed archive', [1836, 496, 78, 60]);

  // ── paved institution grounds
  b.structure('grounds', 'Academy Grounds', 0, { mat: 'stone', roof: null, open: true });
  b.room('apron', 'Academy Paving', 0, 'grounds', [[1842, 502, 66, 52]], { open: true });
  b.room('quad', 'Cloister Quadrangle', 0, 'grounds', [[1852, 510, 34, 26]], { open: true });
  b.room('forecourt', 'Ceremonial Forecourt', 0, 'grounds', [[1862, 536, 18, 18]], { open: true });
  b.room('north_walk', 'North Walk', 0, 'grounds', [[1840, 496, 48, 8]], { open: true });
  b.room('service_yard', 'Service Yard', 0, 'grounds', [[1836, 512, 12, 40]], { open: true });
  b.room('avenue', 'Ceremonial Avenue', 0, 'grounds', [[1869, 536, 6, 16]], { open: true });
  b.structure('pylons', 'Gate Pylons', 0, { mat: 'stone', roof: null, barrier: true });
  b.room('pylon_w', 'Gate Pylon · West', 0, 'pylons', [[1865, 548, 2, 2]]);
  b.room('pylon_e', 'Gate Pylon · East', 0, 'pylons', [[1876, 548, 2, 2]]);
  b.note(1871, 550, 0, 'The gate carries a college seal, half-scoured away.');

  // ── great hall (T): nave + transept + vestry
  b.structure('hall', 'Great Hall', 0, { mat: 'stone', roof: 'tile' });
  b.room('nave', 'Great Hall · Nave', 0, 'hall', [[1838, 502, 20, 10]]);
  b.room('transept', 'Great Hall · Transept', 0, 'hall', [[1848, 512, 10, 12]]);
  b.room('vestry', 'Great Hall · Vestry', 0, 'hall', [[1838, 512, 9, 8]]);
  b.partition(1838, 512, 1846, 512, 0);
  b.door(1842, 512, 0, 'hall', 'Vestry Arch', 'arch');
  b.door(1847, 511, 0, 'hall', 'Hall Front Door', 'main');
  b.door(1838, 518, 0, 'hall', 'Vestry Service Door', 'service');
  b.door(1846, 518, 0, 'hall', 'Vestry Door', 'interior');
  b.partition(1847, 512, 1847, 523, 0);
  b.door(1847, 518, 0, 'hall', 'Vestry ↔ Transept', 'arch');
  b.structure('gallery', 'Great Hall Gallery', 1, { mat: 'stone', roof: 'tile' });
  b.room('gal', 'Great Hall · Upper Gallery', 1, 'gallery', [[1840, 504, 16, 6], [1849, 510, 8, 8]]);
  b.stair(1852, 509, 0, 1, 1852, 507, 'Grand Stair', 'interior');
  b.prop(1844, 505, 0, 'lectern'); b.prop(1850, 504, 0, 'bench'); b.prop(1856, 504, 0, 'bench');
  b.prop(1852, 518, 0, 'banner'); b.prop(1844, 520, 0, 'shelf'); b.prop(1840, 507, 0, 'orrery');
  b.prop(1843, 505, 1, 'bookshelf'); b.prop(1852, 512, 1, 'desk');
  b.cache(1855, 505, 1, 'Provost’s Cabinet', [['cloth', 3], ['herb', 3], ['fasteners', 2]]);
  b.note(1846, 505, 0, 'The lecture board still carries a tide table for a sea that stopped answering.');

  // ── library and map room, joined to the gallery by a skybridge
  b.structure('library', 'Library', 0, { mat: 'stone', roof: 'tin' });
  b.room('reading', 'Library · Reading Room', 0, 'library', [[1868, 502, 18, 10]]);
  b.room('stacks', 'Library · Stacks', 0, 'library', [[1870, 512, 16, 8]]);
  b.door(1868, 506, 0, 'library', 'Library Door', 'main');
  b.door(1874, 511, 0, 'library', 'Stacks Arch', 'arch');
  b.prop(1872, 505, 0, 'bookshelf'); b.prop(1876, 508, 0, 'bookshelf'); b.prop(1880, 516, 0, 'bookshelf');
  b.prop(1884, 505, 0, 'desk'); b.prop(1874, 516, 0, 'bookshelf');
  b.structure('library_upper', 'Library Map Room', 1, { mat: 'stone', roof: 'tin' });
  b.room('map_room', 'Library · Map Room', 1, 'library_upper', [[1870, 504, 14, 6]]);
  b.stair(1882, 509, 0, 1, 1882, 507, 'Library Stair', 'interior');
  b.prop(1873, 506, 1, 'map_table'); b.prop(1878, 505, 1, 'desk'); b.prop(1882, 505, 1, 'shelf');
  b.cache(1882, 508, 1, 'Cartographer’s Case', [['cloth', 2], ['spares', 2], ['rope', 2]]);
  b.structure('sky', 'Skybridge', 1, { mat: 'stone', roof: 'tin' });
  b.room('skybridge', 'Skybridge', 1, 'sky', [[1856, 506, 14, 2]], { carve: true });
  b.door(1856, 506, 1, 'sky', 'Gallery Bridge Door', 'arch');
  b.door(1869, 506, 1, 'sky', 'Map Room Bridge Door', 'arch');
  b.note(1862, 505, 1, 'The bridge is glassless; the drop to the quadrangle is two storeys.');

  // ── observatory: instrument room → drum → open deck
  b.structure('obs', 'Observatory', 0, { mat: 'stone', roof: 'light' });
  b.room('obs_base', 'Observatory · Instrument Room', 0, 'obs', [[1892, 530, 10, 9]]);
  b.door(1896, 538, 0, 'obs', 'Observatory Door', 'main');
  b.prop(1895, 534, 0, 'orrery'); b.prop(1899, 533, 0, 'shelf');
  b.structure('obs_drum', 'Observatory Drum', 1, { mat: 'stone', roof: 'light' });
  b.room('obs_mid', 'Observatory · Drum', 1, 'obs_drum', [[1894, 531, 6, 5]]);
  b.stair(1898, 535, 0, 1, 1897, 534, 'Spiral Stair', 'interior');
  b.structure('obs_deck', 'Observatory Roof Deck', 2, { mat: 'stone', roof: null });
  b.room('obs_deck', 'Observatory Roof Deck', 2, 'obs_deck', [[1894, 531, 6, 5]]);
  b.stair(1895, 532, 1, 2, 1895, 533, 'Deck Ladder', 'ladder');
  b.prop(1896, 533, 2, 'telescope');
  b.cache(1897, 532, 2, 'Astronomer’s Lockbox', [['crystal', 1], ['bandage', 2], ['torch', 1]]);

  // ── sealed archive below the vestry, with a service corridor from the yard
  b.structure('archive', 'Sealed Archive', -1, { mat: 'stone', roof: null });
  b.room('archive_hall', 'Sealed Archive', -1, 'archive', [[1842, 516, 18, 9]]);
  b.room('vault', 'Vault Stack', -1, 'archive', [[1860, 519, 8, 6]], { secret: true });
  b.room('corridor_w', 'Archive Service Corridor', -1, 'archive', [[1836, 525, 10, 3]], { carve: true });
  b.room('corridor_s', 'Archive Service Shaft', -1, 'archive', [[1836, 526, 3, 10]], { secret: true, carve: true });
  b.stair(1842, 518, 0, -1, 1842, 518, 'Archive Stair', 'interior');
  b.stair(1838, 534, 0, -1, 1838, 528, 'Service Hatch', 'hatch');
  b.partition(1860, 519, 1860, 524, -1);
  b.door(1860, 521, -1, 'archive', 'Vault Stack Door', 'interior');
  b.prop(1850, 517, -1, 'bookshelf'); b.prop(1856, 522, -1, 'bookshelf'); b.prop(1846, 520, -1, 'rubble');
  b.prop(1866, 522, -1, 'crate_stack'); b.prop(1839, 530, -1, 'pipes');
  b.cache(1864, 521, -1, 'Sealed Vault Crate', [['iron_ingot', 3], ['spares', 4], ['crystal', 1]]);
  b.note(1845, 519, -1, 'Shelves emptied in a hurry; the ledger lists forty-one crates and eleven remain.');

  // ── service yard and generator shed
  b.structure('shed', 'Generator Shed', 0, { mat: 'brick', roof: 'tin' });
  b.room('gen_shed', 'Generator Shed', 0, 'shed', [[1836, 542, 10, 7]]);
  b.door(1841, 548, 0, 'shed', 'Shed Door', 'service');
  b.prop(1839, 545, 0, 'pump'); b.prop(1843, 546, 0, 'coal_pile'); b.prop(1838, 539, 0, 'cart_broken');
  b.cache(1843, 544, 0, 'Maintenance Locker', [['fuel_can', 1], ['fasteners', 5], ['scrap', 3]]);
  b.prop(1871, 523, 0, 'sundial'); b.prop(1868, 546, 0, 'lantern'); b.prop(1876, 546, 0, 'lantern');
  b.prop(1860, 520, 0, 'bench'); b.prop(1880, 530, 0, 'bench'); b.prop(1856, 545, 0, 'market_stall');
  return b.build();
}

export function ironholmFoundry(): ArchPlan {
  const b = new Plan('po_ironmine', 'Ironholm Foundry', 'Ore works · catwalk loop · flooded adit', [2352, 2548, 66, 62]);

  // ── working ground: rail spur, ore yard, hall apron
  b.structure('grounds', 'Works Grounds', 0, { mat: 'stone', roof: null, open: true });
  b.room('apron', 'Works Paving', 0, 'grounds', [[2348, 2552, 62, 40]], { open: true });
  b.room('ore_yard', 'Ore Yard', 0, 'grounds', [[2364, 2570, 18, 18]], { open: true });
  b.room('rail_spur', 'Rail Spur', 0, 'grounds', [[2352, 2578, 22, 3]], { open: true });
  b.room('hall_apron', 'Hall Apron', 0, 'grounds', [[2382, 2572, 30, 10]], { open: true });
  b.structure('perimeter', 'Perimeter Wall', 0, { mat: 'stone', roof: null, barrier: true });
  b.room('p_west', 'Perimeter Wall · West', 0, 'perimeter', [[2362, 2568, 1, 14], [2362, 2586, 1, 18]]);
  b.room('p_north', 'Perimeter Wall · North', 0, 'perimeter', [[2362, 2548, 20, 1], [2386, 2548, 26, 1]]);
  b.note(2372, 2579, 0, 'The gate chain is cut, not broken. Someone left in a hurry.');

  // ── casting hall with a furnace row under the crane catwalk
  b.structure('hall', 'Casting Hall', 0, { mat: 'brick', roof: 'tin' });
  b.room('cast', 'Casting Hall', 0, 'hall', [[2386, 2560, 22, 15]]);
  b.room('furnace', 'Furnace Row', 0, 'hall', [[2398, 2562, 8, 10]], { hazard: true });
  b.door(2390, 2574, 0, 'hall', 'Hall Main Door', 'main');
  b.door(2406, 2560, 0, 'hall', 'Hall Service Door', 'service');
  b.partition(2397, 2562, 2397, 2573, 0);
  b.door(2397, 2568, 0, 'hall', 'Furnace Door', 'arch');
  b.prop(2400, 2564, 0, 'furnace_big'); b.prop(2400, 2570, 0, 'furnace_big'); b.prop(2399, 2567, 0, 'coal_pile');
  b.prop(2390, 2564, 0, 'chain_hoist'); b.prop(2392, 2571, 0, 'anvil'); b.prop(2388, 2572, 0, 'ingot_stack');
  b.note(2392, 2562, 0, 'Moulds still queued at the pour line. The last cast never left the floor.');

  // ── crane catwalk loop above the hall: two stairs, one circuit
  b.structure('catwalk', 'Crane Catwalk', 1, { mat: 'stone', roof: null });
  b.room('cat_n', 'Crane Catwalk · North', 1, 'catwalk', [[2388, 2562, 18, 2]], { carve: true });
  b.room('cat_s', 'Crane Catwalk · South', 1, 'catwalk', [[2388, 2570, 18, 2]], { carve: true });
  b.room('cat_w', 'Crane Catwalk · West Landing', 1, 'catwalk', [[2388, 2562, 2, 10]], { carve: true });
  b.room('cat_e', 'Crane Cab', 1, 'catwalk', [[2404, 2562, 2, 10]], { carve: true });
  b.stair(2387, 2563, 0, 1, 2388, 2563, 'North Catwalk Stair', 'catwalk');
  b.stair(2387, 2571, 0, 1, 2388, 2571, 'South Catwalk Stair', 'catwalk');
  b.prop(2404, 2568, 1, 'crane_controls'); b.prop(2392, 2563, 1, 'chain_hoist');
  b.cache(2404, 2566, 1, 'Crane Cab Locker', [['mechanical_parts', 2], ['fasteners', 6], ['field_repair_kit', 1]]);

  // ── pay office: clerk's floor and foreman's floor, reached by its own stair
  b.structure('office', 'Pay Office', 0, { mat: 'brick', roof: 'tin' });
  b.room('office', 'Pay Office · Clerk’s Floor', 0, 'office', [[2352, 2554, 10, 8]]);
  b.door(2356, 2561, 0, 'office', 'Office Door', 'main');
  b.prop(2355, 2557, 0, 'desk'); b.prop(2359, 2556, 0, 'shelf');
  b.structure('office_up', 'Pay Office Upper', 1, { mat: 'brick', roof: 'tin' });
  b.room('office_up', 'Foreman’s Office', 1, 'office_up', [[2353, 2555, 8, 6]]);
  b.stair(2359, 2558, 0, 1, 2358, 2556, 'Office Stair', 'interior');
  b.prop(2355, 2557, 1, 'desk'); b.prop(2358, 2557, 1, 'safe');
  b.cache(2358, 2559, 1, 'Paymaster’s Safe', [['spares', 4], ['iron_ingot', 3], ['blueprint:brick', 1]]);

  // ── tipple tower and conveyor to the catwalk
  b.structure('tipple', 'Tipple Tower', 0, { mat: 'stone', roof: 'tin' });
  b.room('tipple_base', 'Tipple Tower · Base', 0, 'tipple', [[2366, 2562, 10, 10]]);
  b.door(2371, 2571, 0, 'tipple', 'Tipple Door', 'main');
  b.prop(2368, 2566, 0, 'screen_mesh'); b.prop(2372, 2568, 0, 'ore_pile');
  b.structure('tipple_up', 'Tipple Screen', 1, { mat: 'stone', roof: 'tin' });
  b.room('tipple_up', 'Tipple Tower · Screen Floor', 1, 'tipple_up', [[2368, 2564, 7, 6]]);
  b.stair(2373, 2567, 0, 1, 2372, 2565, 'Tipple Stair', 'interior');
  b.prop(2370, 2566, 1, 'screen_mesh');
  b.structure('head', 'Tipple Head Deck', 2, { mat: 'stone', roof: null });
  b.room('head_deck', 'Tipple Head Deck', 2, 'head', [[2369, 2566, 5, 4]]);
  b.stair(2371, 2567, 1, 2, 2371, 2567, 'Head Ladder', 'ladder');
  b.prop(2370, 2567, 2, 'lookout');
  b.cache(2372, 2566, 2, 'Head Deck Cache', [['coal', 4], ['crystal', 1], ['torch', 2]]);
  b.structure('conveyor', 'Conveyor Bridge', 1, { mat: 'stone', roof: 'tin' });
  b.room('conveyor', 'Conveyor Bridge', 1, 'conveyor', [[2375, 2565, 14, 2]], { carve: true });
  b.door(2388, 2565, 1, 'conveyor', 'Catwalk Bridge Door', 'arch');

  // ── flooded pump adit below the hall, looping to a yard hatch
  b.structure('adit', 'Pump Adit', -1, { mat: 'stone', roof: null });
  b.room('adit', 'Pump Adit', -1, 'adit', [[2390, 2578, 14, 10]]);
  b.room('pump_house', 'Pump House', -1, 'adit', [[2400, 2580, 6, 6]], { secret: true });
  b.room('sump', 'Flooded Sump', -1, 'adit', [[2366, 2580, 12, 6]]);
  b.room('culvert', 'Culvert', -1, 'adit', [[2378, 2582, 12, 3]], { carve: true });
  b.stair(2394, 2572, 0, -1, 2394, 2580, 'Adit Stair', 'interior');
  b.stair(2369, 2584, 0, -1, 2369, 2584, 'Ore Yard Hatch', 'hatch');
  b.partition(2400, 2580, 2400, 2585, -1);
  b.door(2400, 2583, -1, 'adit', 'Pump House Door', 'interior');
  b.prop(2396, 2584, -1, 'pipes'); b.prop(2393, 2586, -1, 'rubble'); b.prop(2403, 2583, -1, 'pump');
  b.prop(2382, 2583, -1, 'water_pool'); b.prop(2370, 2582, -1, 'bones');
  b.cache(2403, 2585, -1, 'Drowned Store', [['iron_ore', 5], ['coal', 4], ['field_repair_kit', 1]]);
  b.note(2381, 2583, -1, 'The culvert grate was cut from the inside. Someone used the river to leave, not to arrive.');

  b.prop(2372, 2575, 0, 'ore_cart'); b.prop(2378, 2584, 0, 'ore_cart'); b.prop(2377, 2574, 0, 'ore_pile');
  b.prop(2354, 2579, 0, 'bollard');
  return b.build();
}


// VEYRA R5 world: staged in the isolated browser branch, never production.
import { straitLandingRecovery, hookMerePierRecovery, southfootLandingRecovery } from './c03_recovery';
import { westbankLanding, drownedPier, ternHutPier } from './c04';
import { gulfheadHarbor, westmouthHarbor, saltwickHarbor } from './c01';
import { ironholmIndustrialHarbor, emberIndustrialHarbor, sandgateIndustrialHarbor } from './c02';
import { fallsPowerhouse, greywaterPumphouse, oldPumpingPlant, aionEdgeSawmill,
 mossbrookMill, verdantTimberyard, fractureQuarry, greybackQuarry, obsidianQuarry,
 charcoalKilns, slagworksFoundry, sulfurWorks, grainSiloComplex, deltaFilterStation,
 geothermalStation } from './f03';
import { REST48_IDS, makeRest48Plan } from './rest48';

export const AUTHORED_SITES: Record<string, () => ArchPlan> = {
  po_greywater: greywaterHamlet,
  po_academy: argusAcademy,
  po_ironmine: ironholmFoundry,
  po_hook: hookVillage,
  po_oasis: mirageCamp,
  po_cindercamp: cinderCamp,
  po_strait: straitLandingRecovery, // PROVISIONAL C03 — NOT actual Breakthrough
  po_mere: hookMerePierRecovery,
  po_southfoot: southfootLandingRecovery,
  po_westbank: westbankLanding,
  po_dpier: drownedPier,
  po_gullpier: ternHutPier,
  po_gulfhead: gulfheadHarbor,
  po_westmouth: westmouthHarbor,
  po_saltharbor: saltwickHarbor,
  po_ironharbor: ironholmIndustrialHarbor,
  po_ember: emberIndustrialHarbor,
  po_sandgate: sandgateIndustrialHarbor,
  po_falls: fallsPowerhouse,
  po_pumphouse: greywaterPumphouse,
  po_oldpump: oldPumpingPlant,
  po_sawaion: aionEdgeSawmill,
  po_mill: mossbrookMill,
  po_timberyard: verdantTimberyard,
  po_fracquarry: fractureQuarry,
  po_greyquarry: greybackQuarry,
  po_obsq: obsidianQuarry,
  po_kilns: charcoalKilns,
  po_slag: slagworksFoundry,
  po_sulfur: sulfurWorks,
  po_siloc: grainSiloComplex,
  po_filter: deltaFilterStation,
  po_geo: geothermalStation,
};
// 48 remaining sites, including the six distinct Elder sanctuaries.
// Keep this explicit generator registry keyed by the 81 canonical GOLD IDs.
for(const id of REST48_IDS) {
  if (AUTHORED_SITES[id]) throw new Error('Duplicate VEYRA canonical POI id '+id);
  AUTHORED_SITES[id] = () => makeRest48Plan(id);
}


/* ════════════════════════════════════════════════════════════════════════════
 * H01 · F01 — RESIDENTIAL SETTLEMENTS & LIVELIHOODS
 * Hook Village / Mirage Camp / Cinder Camp.
 * Shared grammar in arch/f01.ts; three different geographies, street graphs,
 * material palettes and hidden routes. See F01_GRAMMAR for the production
 * method later triads should reuse without copying these footprints.
 * ════════════════════════════════════════════════════════════════════════════ */

export function hookVillage(): ArchPlan {
  const b = new Plan('po_hook', 'Hook Village', 'Peninsula fishing village on the Verdant shore', [2548, 626, 104, 88]);

  b.structure('grounds', 'Hook Village Grounds', 0, { mat: 'stone', roof: null, open: true });
  addGround(b, 'grounds', 'green', 'Hook Village Green', [[2584, 654, 42, 26]]);
  addGround(b, 'grounds', 'shore_yard', 'Net-Drying Shore Yard', [[2556, 634, 42, 20]]);
  addGround(b, 'grounds', 'east_common', 'East Meadow Common', [[2624, 656, 26, 38]]);
  addGround(b, 'grounds', 'south_gardens', 'South Garden Plots', [[2564, 688, 68, 18]]);
  addGround(b, 'grounds', 'main_street', 'Hook Main Street', [[2558, 652, 92, 4], [2588, 654, 4, 36], [2624, 654, 4, 34], [2568, 680, 72, 4], [2608, 650, 7, 30]]);
  addBarrier(b, 'breakwater', 'Old Breakwater', [[2552, 650, 1, 14], [2552, 672, 1, 12], [2552, 692, 18, 1]], 'stone');
  b.note(2555, 657, 0, 'The breakwater is older than the houses. It was built before the marsh took the west shore.');

  addDwelling(b, { id: 'jetty_store', name: 'Jetty Store & Fish Market', rect: [2560, 640, 15, 10], mat: 'wood', roof: 'hull', doorSide: 'S', grounds: 'grounds' });
  b.prop(2564, 644, 0, 'boat_hull'); b.prop(2570, 646, 0, 'net_rack'); b.prop(2566, 647, 0, 'market_stall');

  addDwelling(b, { id: 'net_house', name: 'Net-Mender’s House', rect: [2580, 638, 14, 9], mat: 'wood', roof: 'thatch', doorSide: 'S', grounds: 'grounds' });
  addLoft(b, 'net_loft', 'Net-Mender’s Sleeping Loft', [2582, 640, 10, 6], [2591, 645], 'thatch');
  b.prop(2584, 642, 0, 'net_rack'); b.prop(2588, 644, 0, 'table'); b.prop(2585, 641, 1, 'bed'); b.prop(2589, 642, 1, 'bed');
  b.cache(2584, 644, 0, 'Tackle Chest', [['rope', 3], ['fiber', 4], ['meat', 1]]);

  // Elder cottage: one L-shaped mass, hall plus sleeping wing
  b.structure('elder_cottage', 'Hook Elder Cottage', 0, { mat: 'wood', roof: 'thatch' });
  b.room('elder_hall', 'Hook Elder Cottage · Hall', 0, 'elder_cottage', [[2602, 642, 17, 8]]);
  b.room('elder_wing', 'Hook Elder Cottage · Sleeping Wing', 0, 'elder_cottage', [[2602, 650, 9, 9]]);
  b.partition(2609, 643, 2609, 648, 0);
  b.door(2609, 646, 0, 'elder_cottage', 'Hall ↔ Wing', 'arch');
  b.door(2611, 649, 0, 'elder_cottage', 'Cottage Door', 'main');
  b.prop(2605, 645, 0, 'hearth'); b.prop(2613, 644, 0, 'table'); b.prop(2604, 654, 0, 'bed'); b.prop(2607, 656, 0, 'bed');
  b.note(2612, 647, 0, 'A tide chart is pinned over the hearth, marked in three different hands.');

  addDwelling(b, { id: 'smokehouse', name: 'Hook Smokehouse', rect: [2626, 644, 13, 10], mat: 'stone', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  b.prop(2630, 647, 0, 'smoke_rack'); b.prop(2634, 650, 0, 'barrel_stack');

  addDwelling(b, { id: 'granary', name: 'Hook Granary & Cart Store', rect: [2612, 676, 15, 10], mat: 'wood', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  addLoft(b, 'granary_loft', 'Hook Granary Drying Loft', [2614, 678, 11, 6], [2610, 681], 'tin');
  b.prop(2617, 680, 0, 'grain_sack'); b.prop(2622, 683, 0, 'crate_stack'); b.prop(2617, 679, 1, 'grain_sack');
  b.cache(2620, 682, 1, 'Granary Loft Box', [['seed', 4], ['crop', 3], ['cloth', 2]]);

  addDwelling(b, { id: 'smith_cottage', name: 'Net-Smith Cottage', rect: [2570, 684, 13, 9], mat: 'wood', roof: 'tile', doorSide: 'N', grounds: 'grounds' });
  b.prop(2574, 688, 0, 'anvil'); b.prop(2578, 690, 0, 'table'); b.prop(2572, 686, 0, 'bed');

  addDwelling(b, { id: 'garden_cottage', name: 'Garden Cottage', rect: [2592, 690, 14, 9], mat: 'wood', roof: 'thatch', doorSide: 'N', grounds: 'grounds' });
  b.partition(2599, 691, 2599, 694, 0); b.door(2599, 693, 0, 'garden_cottage', 'Garden Cottage Partition', 'arch');
  b.prop(2595, 694, 0, 'bed'); b.prop(2601, 692, 0, 'shelf'); b.prop(2596, 696, 0, 'grain_sack');

  addDwelling(b, { id: 'boat_repair', name: 'Boat-Repair Shed', rect: [2632, 664, 14, 10], mat: 'wood', roof: 'hull', doorSide: 'W', grounds: 'grounds' });
  b.prop(2636, 668, 0, 'boat_hull'); b.prop(2641, 670, 0, 'net_rack'); b.prop(2638, 672, 0, 'crate_stack');
  b.cache(2642, 666, 0, 'Boat-Repair Locker', [['rope', 2], ['treated_canvas', 2], ['fasteners', 3]]);

  // Ice/smoke cellars joined by a low crawl: the village's second way between work and home.
  b.structure('hook_cellars', 'Hook Ice & Smoke Cellars', -1, { mat: 'stone', roof: null });
  b.room('elder_cellar', 'Elder Cottage Cellar', -1, 'hook_cellars', [[2602, 644, 13, 7]]);
  b.room('crawl_w', 'Ice Crawl · West', -1, 'hook_cellars', [[2615, 647, 11, 2]], { carve: true });
  b.room('crawl_e', 'Ice Crawl · East', -1, 'hook_cellars', [[2626, 647, 3, 5]], { carve: true });
  b.room('smoke_cellar', 'Smokehouse Cellar', -1, 'hook_cellars', [[2629, 645, 9, 7]]);
  b.room('ice_store', 'Old Ice Store', -1, 'hook_cellars', [[2638, 647, 4, 5]], { secret: true });
  b.stair(2605, 646, 0, -1, 2605, 646, 'Elder Cellar Hatch', 'hatch');
  b.stair(2630, 648, 0, -1, 2630, 648, 'Smokehouse Hatch', 'hatch');
  b.prop(2618, 647, -1, 'barrel_stack'); b.prop(2632, 648, -1, 'smoke_rack'); b.prop(2606, 648, -1, 'crate_stack');
  b.cache(2640, 649, -1, 'Ice Store Cache', [['meat', 3], ['rope', 2], ['torch', 1]]);
  b.note(2620, 647, -1, 'A low crawl joins the ice cellar to the smokehouse. It stays cold even in high summer.');

  b.prop(2604, 666, 0, 'well'); b.prop(2592, 662, 0, 'market_stall'); b.prop(2616, 670, 0, 'bench');
  b.prop(2568, 652, 0, 'lantern'); b.prop(2636, 660, 0, 'lantern');
  return b.build();
}

export function mirageCamp(): ArchPlan {
  const b = new Plan('po_oasis', 'Mirage Camp', 'Oasis caravan camp above the Mirage Pool', [1290, 1934, 92, 68]);

  b.structure('grounds', 'Mirage Camp Grounds', 0, { mat: 'stone', roof: null, open: true });
  addGround(b, 'grounds', 'oasis_common', 'Oasis Common', [[1308, 1944, 54, 36]]);
  addGround(b, 'grounds', 'caravan_yard', 'North Caravan Yard', [[1296, 1936, 44, 18]]);
  addGround(b, 'grounds', 'shore_path', 'Pool Shore Path', [[1306, 1968, 42, 16]]);
  addGround(b, 'grounds', 'east_yard', 'East Date Yard', [[1350, 1946, 28, 34]]);
  addGround(b, 'grounds', 'south_common', 'South Sleeping Common', [[1332, 1978, 38, 14]]);
  addBarrier(b, 'windbreak', 'Desert Windbreak', [[1298, 1938, 30, 1], [1298, 1938, 1, 16], [1368, 1942, 1, 14]], 'stone');
  b.note(1312, 1939, 0, 'The windbreak is only on the desert side. The pool side was left open on purpose.');

  addDwelling(b, { id: 'common_hall', name: 'Caravan Common Hall', rect: [1304, 1942, 17, 10], mat: 'wood', roof: 'thatch', doorSide: 'S', grounds: 'grounds' });
  b.partition(1312, 1943, 1312, 1947, 0); b.door(1312, 1945, 0, 'common_hall', 'Common Hall Kitchen Arch', 'arch');
  b.prop(1307, 1946, 0, 'hearth'); b.prop(1310, 1948, 0, 'table'); b.prop(1315, 1944, 0, 'bench'); b.prop(1317, 1948, 0, 'grain_sack');

  addLoft(b, 'common_loft', 'Common Hall Storage Loft', [1305, 1943, 8, 6], [1308, 1948], 'thatch');
  b.prop(1307, 1945, 1, 'crate_stack'); b.prop(1310, 1946, 1, 'grain_sack');

  addDwelling(b, { id: 'wellhouse', name: 'Wellhouse & Cistern Head', rect: [1328, 1956, 11, 8], mat: 'stone', roof: 'tile', doorSide: 'N', grounds: 'grounds' });
  b.prop(1331, 1959, 0, 'well'); b.prop(1335, 1961, 0, 'pump');
  b.stair(1332, 1960, 0, -1, 1332, 1960, 'Cistern Hatch', 'hatch');

  addDwelling(b, { id: 'merchant_house', name: 'Caravan Merchant House', rect: [1348, 1942, 15, 10], mat: 'stone', roof: 'tile', doorSide: 'W', grounds: 'grounds' });
  addLoft(b, 'merchant_loft', 'Merchant Sleeping Loft', [1350, 1944, 11, 6], [1346, 1948], 'tile', 'stone');
  b.prop(1352, 1946, 0, 'desk'); b.prop(1357, 1948, 0, 'shelf'); b.prop(1353, 1945, 1, 'bed'); b.prop(1357, 1946, 1, 'crate_stack');
  b.cache(1354, 1948, 0, 'Merchant’s Counter Box', [['cloth', 3], ['rope', 2], ['fasteners', 3]]);

  addDwelling(b, { id: 'date_store', name: 'Date & Grain Store', rect: [1360, 1960, 14, 10], mat: 'wood', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  b.prop(1366, 1964, 0, 'grain_sack'); b.prop(1368, 1967, 0, 'barrel_stack'); b.prop(1362, 1967, 0, 'crate_stack');
  b.stair(1364, 1964, 0, -1, 1364, 1964, 'Date Store Hatch', 'hatch');

  addDwelling(b, { id: 'shore_house', name: 'Pool-Shore Sleeping House', rect: [1312, 1968, 12, 8], mat: 'wood', roof: 'thatch', doorSide: 'N', grounds: 'grounds' });
  b.prop(1315, 1971, 0, 'bed'); b.prop(1319, 1973, 0, 'table');
  addDwelling(b, { id: 'east_house', name: 'East Sleeping House', rect: [1336, 1976, 13, 8], mat: 'stone', roof: 'tile', doorSide: 'N', grounds: 'grounds' });
  b.prop(1339, 1979, 0, 'bed'); b.prop(1344, 1980, 0, 'shelf');
  addDwelling(b, { id: 'caravan_house', name: 'Caravan Rest House', rect: [1356, 1980, 12, 8], mat: 'wood', roof: 'wood', doorSide: 'W', grounds: 'grounds' });
  b.prop(1360, 1983, 0, 'bed'); b.prop(1363, 1985, 0, 'bench');
  addDwelling(b, { id: 'wash_house', name: 'Laundry & Bath Shed', rect: [1318, 1984, 12, 7], mat: 'stone', roof: 'tin', doorSide: 'N', grounds: 'grounds' });
  b.prop(1321, 1987, 0, 'water_pool'); b.prop(1325, 1988, 0, 'bench');

  // Underground cistern and cool store: water logic, not a treasure tunnel for its own sake.
  b.structure('cistern', 'Mirage Cistern & Cool Store', -1, { mat: 'stone', roof: null });
  b.room('cistern_room', 'Underground Cistern', -1, 'cistern', [[1326, 1956, 14, 8]]);
  b.room('cistern_link', 'Cistern Link', -1, 'cistern', [[1339, 1961, 22, 3]], { carve: true });
  b.room('date_cellar', 'Date Store Cellar', -1, 'cistern', [[1360, 1962, 10, 6]]);
  b.room('cool_store', 'Cool Store', -1, 'cistern', [[1370, 1963, 4, 5]], { secret: true });
  b.prop(1330, 1959, -1, 'water_pool'); b.prop(1335, 1962, -1, 'pipes'); b.prop(1363, 1965, -1, 'grain_sack');
  b.cache(1371, 1965, -1, 'Cool Store Cache', [['crop', 3], ['seed', 3], ['cloth', 2]]);
  b.note(1348, 1960, -1, 'The link runs downhill from the cistern to the date cellar. Spilled water would never reach the grain.');

  b.prop(1333, 1952, 0, 'well'); b.prop(1318, 1958, 0, 'market_stall'); b.prop(1342, 1956, 0, 'market_stall');
  b.prop(1324, 1948, 0, 'lantern'); b.prop(1352, 1972, 0, 'lantern'); b.prop(1344, 1968, 0, 'bench');
  b.note(1334, 1953, 0, 'Every roof in camp sheds water toward the cistern court, even the ones that look flat.');
  return b.build();
}

export function cinderCamp(): ArchPlan {
  const b = new Plan('po_cindercamp', 'Cinder Camp', 'Basalt and char-timber camp on the Cinder shore', [3146, 1734, 92, 68]);

  b.structure('grounds', 'Cinder Camp Grounds', 0, { mat: 'stone', roof: null, open: true });
  addGround(b, 'grounds', 'ash_court', 'Ash Court', [[3166, 1748, 50, 36]]);
  addGround(b, 'grounds', 'west_landing', 'West Landing', [[3148, 1740, 30, 24]]);
  addGround(b, 'grounds', 'south_yard', 'South Work Yard', [[3178, 1778, 44, 20]]);
  addGround(b, 'grounds', 'north_apron', 'North Shelter Apron', [[3170, 1738, 44, 16]]);
  addGround(b, 'grounds', 'east_work_yard', 'East Work Yard', [[3214, 1752, 20, 22]]);
  addBarrier(b, 'ash_berm', 'Ash Berm', [[3172, 1796, 24, 1], [3204, 1796, 28, 1], [3234, 1762, 1, 16], [3234, 1786, 1, 12]], 'stone');
  b.note(3186, 1795, 0, 'The berm breaks the ash wind. The gaps are where the carts come through.');

  addDwelling(b, { id: 'gate_house', name: 'Gate Watch House', rect: [3154, 1744, 13, 10], mat: 'stone', roof: 'tin', doorSide: 'E', grounds: 'grounds' });
  addLoft(b, 'gate_loft', 'Gate Watch Loft', [3156, 1746, 9, 6], [3164, 1750], 'tin', 'stone');
  addRoofDeck(b, 'gate_deck', 'Gate Lookout Deck', [3156, 1746, 9, 6], [3163, 1749], 'stone');
  b.prop(3158, 1749, 0, 'lantern'); b.prop(3157, 1747, 2, 'lookout'); b.prop(3161, 1750, 1, 'bench');

  addDwelling(b, { id: 'char_hall', name: 'Char Hall & Sleeping Alcove', rect: [3172, 1746, 17, 11], mat: 'stone', roof: 'tin', doorSide: 'S', grounds: 'grounds' });
  b.partition(3180, 1747, 3180, 1751, 0); b.door(3180, 1749, 0, 'char_hall', 'Char Hall Alcove Arch', 'arch');
  b.prop(3175, 1750, 0, 'hearth'); b.prop(3178, 1753, 0, 'table'); b.prop(3183, 1748, 0, 'bed'); b.prop(3185, 1752, 0, 'shelf');
  b.stair(3178, 1752, 0, -1, 3178, 1752, 'Shelter Hatch', 'hatch');

  addDwelling(b, { id: 'forge_house', name: 'Cinder Forge Workshop', rect: [3200, 1746, 14, 10], mat: 'stone', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  b.prop(3204, 1750, 0, 'forge'); b.prop(3208, 1748, 0, 'anvil'); b.prop(3210, 1752, 0, 'coal_pile'); b.prop(3202, 1753, 0, 'ingot_stack');
  b.stair(3204, 1752, 0, -1, 3204, 1752, 'Forge Cellar Hatch', 'hatch');
  b.cache(3206, 1748, 0, 'Forge Tool Chest', [['fasteners', 4], ['scrap', 3], ['coal', 3]]);

  addDwelling(b, { id: 'coal_store', name: 'Coal & Ash Store', rect: [3220, 1754, 13, 10], mat: 'wood', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  b.prop(3224, 1758, 0, 'coal_pile'); b.prop(3228, 1761, 0, 'barrel_stack');

  addDwelling(b, { id: 'miner_house_a', name: 'Miner’s Cottage A', rect: [3176, 1776, 13, 9], mat: 'stone', roof: 'wood', doorSide: 'N', grounds: 'grounds' });
  b.prop(3179, 1779, 0, 'bed'); b.prop(3184, 1781, 0, 'table');
  addDwelling(b, { id: 'miner_house_b', name: 'Miner’s Cottage B', rect: [3198, 1780, 14, 9], mat: 'wood', roof: 'tin', doorSide: 'N', grounds: 'grounds' });
  b.prop(3201, 1783, 0, 'bed'); b.prop(3206, 1785, 0, 'shelf'); b.prop(3203, 1786, 0, 'coal_pile');
  addDwelling(b, { id: 'east_house', name: 'East Ash House', rect: [3220, 1774, 12, 9], mat: 'stone', roof: 'tin', doorSide: 'W', grounds: 'grounds' });
  b.prop(3223, 1777, 0, 'bed'); b.prop(3227, 1780, 0, 'bench');
  addDwelling(b, { id: 'cool_house', name: 'Cooling & Bath House', rect: [3158, 1770, 13, 8], mat: 'stone', roof: 'tin', doorSide: 'E', grounds: 'grounds' });
  b.prop(3161, 1773, 0, 'water_pool'); b.prop(3165, 1775, 0, 'bench');

  // A worked-out lava tube, roofed and shored, used as the camp's cool shelter.
  b.structure('lava_shelter', 'Cinder Shelter Tube', -1, { mat: 'stone', roof: null });
  b.room('shelter_main', 'Lava-Tube Shelter', -1, 'lava_shelter', [[3174, 1748, 15, 8]]);
  b.room('shelter_link', 'Shelter Link', -1, 'lava_shelter', [[3189, 1752, 16, 2]], { carve: true });
  b.room('forge_cellar', 'Forge Cellar Store', -1, 'lava_shelter', [[3205, 1750, 9, 6]], { secret: true });
  b.prop(3178, 1751, -1, 'bench'); b.prop(3183, 1753, -1, 'barrel_stack'); b.prop(3208, 1753, -1, 'coal_pile'); b.prop(3194, 1752, -1, 'bones');
  b.cache(3211, 1752, -1, 'Forge Cellar Cache', [['coal', 4], ['iron_ingot', 2], ['bandage', 2]]);
  b.note(3196, 1752, -1, 'The tube stays cool at noon. The camp stores bandages here, not treasure.');

  b.prop(3188, 1766, 0, 'forge'); b.prop(3192, 1770, 0, 'ore_cart'); b.prop(3172, 1762, 0, 'lantern'); b.prop(3214, 1768, 0, 'lantern'); b.prop(3182, 1768, 0, 'bench');
  return b.build();
}