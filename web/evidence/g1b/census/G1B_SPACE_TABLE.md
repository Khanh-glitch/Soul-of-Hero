# G1B — every physical space of Veyra and its chests

_Generated from `G1B_SPACE_CENSUS.json` (the census is produced by `tests/g1b-ecology.test.ts` from the compiled runtime plan of each site). Do not edit by hand._

Columns: storey (-1 cellar, 0 ground, 1 upper, 2 roof/top) · kind · standable tiles · danger 1–4 · access cost (0 none; +1 other storey, +1 hidden, +1 card door, +1 locked) · chests before → after · variants · why.

## Greywater Hamlet (`po_greywater`, village) — 5 → 18 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Cottage Smoke Cellar | -1 | cellar | 41 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Smugglers’ Crawl · East | -1 | transit | 15 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Smugglers’ Crawl · North Leg | -1 | transit | 27 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Smugglers’ Crawl · West | -1 | transit | 25 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Long House Cellar | -1 | cellar | 53 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Smoke Store | -1 | cellar | 11 | 1 | 2 | 0 → 1 | food_mid | hidden room: finding it is the cost, grade raised; grade mid: danger 1 + access 2 (other storey, hidden) |
| Hamlet Paving | 0 | yard | 2149 | 1 | 0 | 1 → 1 | supply_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 0 |
| Boat Shed | 0 | room | 57 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Fisher’s Cottage · Net Room | 0 | room | 14 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Fisher’s Cottage · Living Room | 0 | room | 53 | 1 | 0 | 1 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| East Drying Yard | 0 | yard | 260 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Forge Yard | 0 | yard | 80 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Granary · Grain Store | 0 | room | 61 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Village Green | 0 | yard | 292 | 1 | 0 | 1 → 1 | medical_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 0 |
| Long House · Common Hall | 0 | room | 110 | 1 | 0 | 1 → 1 | food_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| North Cart Lane | 0 | transit | 220 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Smithy | 0 | room | 55 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Flood Wall · East | 0 | transit | 3 | 1 | 0 | 1 → 1 | supply_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Lake Path | 0 | transit | 164 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Long House · West Wing | 0 | room | 44 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Granary · Drying Loft | 1 | upper | 33 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Long House · Sleeping Loft | 1 | upper | 47 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Granary Roof Lookout | 2 | roof | 15 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |

## Argus Academy (`po_academy`, research) — 13 → 25 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Sealed Archive | -1 | cellar | 108 | 3 | 1 | 0 → 1 | supply_mid | cellar with a loot function (storage / general-purpose room; 108 standable tiles); grade mid: danger 3 + access 1 (other storey) |
| Archive Service Shaft | -1 | cellar | 24 | 3 | 2 | 0 → 1 | supply_high | cellar with a loot function (storage / general-purpose room; 24 standable tiles); hidden room: finding it is the cost, grade raised; grade high: danger 3 + access 2 (other storey, hidden) |
| Archive Service Corridor | -1 | transit | 30 | 3 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Vault Stack | -1 | cellar | 18 | 3 | 2 | 0 → 1 | military_high | cellar with a loot function ("Vault" in the room name; 18 standable tiles); hidden room: finding it is the cost, grade raised; grade high: danger 3 + access 2 (other storey, hidden); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Academy Paving | 0 | yard | 1527 | 3 | 0 | 3 → 3 | medical_low, supply_low, toolbox_damaged | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources; grade mid: danger 3 + access 0; 3 round-1 source(s) already stand here and count toward the 0 |
| Ceremonial Avenue | 0 | transit | 96 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ceremonial Forecourt | 0 | yard | 218 | 2 | 0 | 0 → 1 | supply_low | working yard (storage / general-purpose room; 218 standable tiles): one stack against cover; grade low: danger 2 + access 0 |
| Generator Shed | 0 | room | 32 | 2 | 0 | 0 → 1 | toolbox_low | room with a loot function ("Generator" in the room name; 32 standable tiles); grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Great Hall · Nave | 0 | room | 142 | 2 | 0 | 1 → 2 | supply_low, toolbox_high | room with a loot function (storage / general-purpose room; 142 standable tiles); large (142 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| North Walk | 0 | transit | 312 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Observatory · Instrument Room | 0 | room | 40 | 3 | 0 | 1 → 1 | medical_mid | room with a loot function ("Instrument" in the room name; 40 standable tiles); grade low: danger 3 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Cloister Quadrangle | 0 | yard | 633 | 3 | 0 | 2 → 2 | supply_low, supply_mid | working yard (no functional word in the name; site archetype "research"; 633 standable tiles): one stack against cover; grade mid: danger 3 + access 0; 2 round-1 source(s) already stand here and count toward the 1 |
| Library · Reading Room | 0 | room | 125 | 2 | 2 | 6 → 6 | room_green, room_green, room_green, room_green, room_green, room_green | room with a loot function (storage / general-purpose room; 125 standable tiles); grade mid: danger 2 + access 2 (card door); 6 round-1 source(s) already stand here and count toward the 1 |
| Service Yard | 0 | yard | 336 | 2 | 0 | 0 → 1 | supply_low | working yard (no functional word in the name; site archetype "research"; 336 standable tiles): one stack against cover; grade low: danger 2 + access 0 |
| Library · Stacks | 0 | room | 87 | 3 | 2 | 0 → 1 | supply_high | room with a loot function (storage / general-purpose room; 87 standable tiles); grade high: danger 3 + access 2 (card door) |
| Great Hall · Transept | 0 | room | 78 | 2 | 0 | 0 → 1 | supply_low | room with a loot function (storage / general-purpose room; 78 standable tiles); grade low: danger 2 + access 0 |
| Great Hall · Vestry | 0 | room | 35 | 2 | 0 | 0 → 1 | supply_low | room with a loot function (storage / general-purpose room; 35 standable tiles); grade low: danger 2 + access 0 |
| Great Hall · Upper Gallery | 1 | upper | 85 | 2 | 1 | 0 → 1 | supply_mid | upper-storey room with a loot function (storage / general-purpose room; 85 standable tiles); grade mid: danger 2 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Library · Map Room | 1 | upper | 39 | 2 | 3 | 0 → 1 | supply_high | upper-storey room with a loot function (storage / general-purpose room; 39 standable tiles); grade high: danger 2 + access 3 (other storey, card door); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Observatory · Drum | 1 | upper | 8 | 3 | 1 | 0 → 0 | — | only 8 standable tiles: too small to keep a chest and a clear lane |
| Skybridge | 1 | transit | 28 | 2 | 1 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Observatory Roof Deck | 2 | roof | 10 | 3 | 1 | 0 → 0 | — | only 10 standable tiles: too small to keep a chest and a clear lane |

## Ironholm Foundry (`po_ironmine`, mine) — 3 → 15 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Pump Adit | -1 | cellar | 70 | 3 | 1 | 0 → 1 | toolbox_low | cellar with a loot function ("Pump" in the room name; 70 standable tiles); grade low: danger 3 + access 1 (other storey) |
| Culvert | -1 | cellar | 36 | 3 | 1 | 0 → 1 | toolbox_low | cellar with a loot function ("Pump" in the building name; 36 standable tiles); grade low: danger 3 + access 1 (other storey) |
| Pump House | -1 | cellar | 19 | 3 | 2 | 0 → 1 | toolbox_high | cellar with a loot function ("Pump" in the room name; 19 standable tiles); hidden room: finding it is the cost, grade raised; grade high: danger 3 + access 2 (other storey, hidden); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Flooded Sump | -1 | cellar | 42 | 3 | 1 | 0 → 1 | toolbox_low | cellar with a loot function ("Pump" in the building name; 42 standable tiles); grade low: danger 3 + access 1 (other storey) |
| Works Paving | 0 | yard | 1341 | 3 | 0 | 0 → 2 | toolbox_low, toolbox_low | working yard (no functional word in the name; site archetype "mine"; 1341 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade low: danger 3 + access 0 |
| Casting Hall | 0 | room | 153 | 2 | 0 | 1 → 2 | military_low, toolbox_low | room with a loot function ("Casting" in the room name; 153 standable tiles); large (153 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Furnace Row | 0 | room | 67 | 3 | 0 | 0 → 1 | toolbox_low | room with a loot function ("Furnace" in the room name; 67 standable tiles); environmental hazard inside, grade raised; grade low: danger 3 + access 0 |
| Hall Apron | 0 | transit | 234 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pay Office · Clerk’s Floor | 0 | room | 38 | 2 | 0 | 1 → 1 | toolbox_low | room with a loot function (storage / general-purpose room; 38 standable tiles); grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Ore Yard | 0 | yard | 271 | 3 | 0 | 1 → 1 | supply_mid | working yard (storage / general-purpose room; 271 standable tiles): one stack against cover; grade mid: danger 3 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Rail Spur | 0 | transit | 41 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Tipple Tower · Base | 0 | room | 57 | 3 | 0 | 0 → 1 | toolbox_low | room with a loot function ("Tipple" in the room name; 57 standable tiles); grade low: danger 3 + access 0 |
| Crane Cab | 1 | upper | 18 | 2 | 1 | 0 → 1 | toolbox_low | upper-storey room with a loot function ("Crane" in the room name; 18 standable tiles); grade low: danger 2 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Crane Catwalk · North | 1 | transit | 28 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Crane Catwalk · South | 1 | transit | 28 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Crane Catwalk · West Landing | 1 | transit | 20 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Conveyor Bridge | 1 | transit | 26 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Foreman’s Office | 1 | upper | 18 | 2 | 1 | 0 → 1 | supply_mid | upper-storey room with a loot function (storage / general-purpose room; 18 standable tiles); grade mid: danger 2 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Tipple Tower · Screen Floor | 1 | upper | 17 | 2 | 1 | 0 → 1 | toolbox_low | upper-storey room with a loot function ("Tipple" in the room name; 17 standable tiles); grade low: danger 2 + access 1 (other storey) |
| Tipple Head Deck | 2 | roof | 6 | 3 | 1 | 0 → 0 | — | only 6 standable tiles: too small to keep a chest and a clear lane |

## Hook Village (`po_hook`, village) — 0 → 15 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ice Crawl · East | -1 | transit | 15 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ice Crawl · West | -1 | transit | 21 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Elder Cottage Cellar | -1 | cellar | 48 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Old Ice Store | -1 | cellar | 8 | 1 | 2 | 0 → 1 | food_mid | hidden room: finding it is the cost, grade raised; grade mid: danger 1 + access 2 (other storey, hidden); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Smokehouse Cellar | -1 | cellar | 39 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Boat-Repair Shed | 0 | room | 78 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Boat-Repair Shed Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East Meadow Common | 0 | yard | 807 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Hook Elder Cottage · Hall | 0 | room | 79 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Hook Elder Cottage · Sleeping Wing | 0 | room | 43 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Garden Cottage | 0 | room | 69 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Garden Cottage Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Hook Granary & Cart Store | 0 | room | 87 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Hook Granary & Cart Store Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Hook Village Green | 0 | yard | 944 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Jetty Store & Fish Market | 0 | room | 84 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Jetty Store & Fish Market Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Hook Main Street | 0 | transit | 378 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Net-Mender’s House | 0 | room | 67 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Net-Mender’s House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Net-Drying Shore Yard | 0 | yard | 543 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Net-Smith Cottage | 0 | room | 65 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Net-Smith Cottage Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Hook Smokehouse | 0 | room | 71 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Hook Smokehouse Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| South Garden Plots | 0 | yard | 961 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Hook Granary Drying Loft | 1 | upper | 27 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Net-Mender’s Sleeping Loft | 1 | upper | 24 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |

## Mirage Camp (`po_oasis`, village) — 0 → 12 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Cistern Link | -1 | transit | 64 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Underground Cistern | -1 | cellar | 60 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Cool Store | -1 | cellar | 8 | 1 | 2 | 0 → 0 | — | hidden room: finding it is the cost, grade raised; grade mid: danger 1 + access 2 (other storey, hidden); 1 authored one-time cache(s) also in this space (kept, not counted); no free wall tile for chest 1 without moving furniture: left out |
| Date Store Cellar | -1 | cellar | 34 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Caravan Rest House | 0 | room | 45 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Caravan Rest House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| North Caravan Yard | 0 | yard | 565 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Caravan Common Hall | 0 | room | 98 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Caravan Common Hall Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Date & Grain Store | 0 | room | 78 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Date & Grain Store Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East Sleeping House | 0 | room | 54 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| East Sleeping House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East Date Yard | 0 | yard | 673 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Caravan Merchant House | 0 | room | 89 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Caravan Merchant House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Oasis Common | 0 | yard | 566 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Pool-Shore Sleeping House | 0 | room | 10 | 1 | 0 | 0 → 0 | — | only 10 standable tiles: too small to keep a chest and a clear lane |
| Pool-Shore Sleeping House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pool Shore Path | 0 | transit | 180 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| South Sleeping Common | 0 | yard | 248 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Laundry & Bath Shed | 0 | room | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Laundry & Bath Shed Apron | 0 | transit | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Wellhouse & Cistern Head | 0 | room | 45 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Wellhouse & Cistern Head Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Common Hall Storage Loft | 1 | upper | 18 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Merchant Sleeping Loft | 1 | upper | 31 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |

## Cinder Camp (`po_cindercamp`, village) — 0 → 16 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Forge Cellar Store | -1 | cellar | 27 | 1 | 2 | 0 → 1 | toolbox_low | hidden room: finding it is the cost, grade raised; grade low: danger 1 + access 2 (other storey, hidden); 1 authored one-time cache(s) also in this space (kept, not counted) |
| Shelter Link | -1 | transit | 32 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Lava-Tube Shelter | -1 | cellar | 67 | 1 | 1 | 0 → 1 | medical_low | grade low: danger 1 + access 1 (other storey) |
| Ash Court | 0 | yard | 948 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Char Hall & Sleeping Alcove | 0 | room | 113 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Char Hall & Sleeping Alcove Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coal & Ash Store | 0 | room | 77 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Coal & Ash Store Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Cooling & Bath House | 0 | room | 52 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0 |
| Cooling & Bath House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East Ash House | 0 | room | 59 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| East Ash House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East Work Yard | 0 | yard | 299 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Cinder Forge Workshop | 0 | room | 77 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Cinder Forge Workshop Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Gate Watch House | 0 | room | 72 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0 |
| Gate Watch House Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Miner’s Cottage A | 0 | room | 66 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Miner’s Cottage A Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Miner’s Cottage B | 0 | room | 74 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Miner’s Cottage B Apron | 0 | transit | 10 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| North Shelter Apron | 0 | transit | 446 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| South Work Yard | 0 | yard | 604 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| West Landing | 0 | yard | 449 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Gate Watch Loft | 1 | upper | 25 | 1 | 1 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |
| Gate Lookout Deck | 2 | roof | 28 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |

## Strait Landing (`po_strait`, port) — 3 → 6 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Landward cart approach | 0 | transit | 355 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Strait Dispatch House | 0 | room | 177 | 1 | 0 | 1 → 1 | supply_mid | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Strait Dispatch House dry entrance | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Freight store alley to road | 0 | transit | 129 | 1 | 0 | 1 → 1 | food_mid | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Heavy freight transfer pier | 0 | yard | 499 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Two tidal slips with working gaps | 0 | yard | 228 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Dry Rope and Sail Store | 0 | room | 125 | 1 | 0 | 1 → 1 | medical_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Dry Rope and Sail Store dry entrance | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Landing lookout above dispatch | 1 | yard | 108 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |

## Hook Mere Pier (`po_mere`, pier) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Forest-side descent to the mere | 0 | transit | 133 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Landward return to the dry keeper hut | 0 | transit | 162 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Hook Mere Keeper Hut | 0 | room | 102 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Hook Mere Keeper Hut dry entrance | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Net-maintenance spur | 0 | transit | 153 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Long low mere landing | 0 | yard | 265 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Small sheltered pier roof | 1 | yard | 84 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |

## Southfoot Landing (`po_southfoot`, port) — 0 → 5 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Smaller tidal boat finger | 0 | yard | 223 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Southfoot main transfer wharf | 0 | yard | 237 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Southfoot coastal cart entrance | 0 | yard | 339 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Southfoot Freight Store | 0 | room | 206 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Southfoot Freight Store dry entrance | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Dry freight access off Southfoot road | 0 | transit | 212 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Southfoot Watch and Signals | 0 | room | 161 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0 |
| Southfoot Watch and Signals dry entrance | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| High coastal watch platform | 1 | yard | 117 | 1 | 1 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |

## Westbank Landing (`po_westbank`, pier) — 0 → 11 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Culvert Pump Passage | -1 | cellar | 142 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |
| Stepped working bank | 0 | yard | 219 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Salt and Drying Shelter | 0 | room | 80 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0 |
| Salt and Drying Shelter entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Cooper and Cordage Shop | 0 | room | 91 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Cooper and Cordage Shop entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Fishing finger with cross-head | 0 | yard | 11 | 1 | 0 | 0 → 0 | — | only 10 standable tiles: too small to keep a chest and a clear lane |
| Westbank Arrival & Ferry Hall | 0 | room | 144 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Westbank Arrival & Ferry Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Two-face unloading wharf | 0 | yard | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Fish and net court | 0 | yard | 283 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Public stone court | 0 | yard | 681 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Net Menders and Slip Workshop | 0 | room | 118 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Net Menders and Slip Workshop entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Westbank Cargo Tally | 0 | room | 126 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Westbank Cargo Tally entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Old freight road | 0 | yard | 314 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Rope-Hoist Transfer Skyway | 1 | yard | 310 | 1 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |
| Westbank Market Upper Gallery | 1 | upper | 162 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Westbank Watch Loft | 2 | roof | 64 | 1 | 1 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |
| Watch Loft Windward Balcony | 2 | roof | 68 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |

## Drowned Pier (`po_dpier`, pier) — 0 → 7 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Bank Drainage Gallery | -1 | cellar | 160 | 1 | 1 | 0 → 1 | supply_low | grade damaged: danger 1 + access 1 (other storey) |
| Drowned Customs House | 0 | room | 144 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade damaged: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Drowned Customs House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Smashed Boat Yard | 0 | room | 116 | 1 | 0 | 0 → 1 | toolbox_low | grade damaged: danger 1 + access 0 |
| Smashed Boat Yard entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Old Wreck Haulway | 0 | transit | 141 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken Customs Yard | 0 | yard | 463 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade damaged: danger 1 + access 0 |
| Salt-Rusted Gear House | 0 | room | 133 | 1 | 0 | 0 → 1 | toolbox_low | grade damaged: danger 1 + access 0 |
| Salt-Rusted Gear House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Surviving Old Pier Approach | 0 | transit | 1 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Old Shingle Road | 0 | transit | 386 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Storm-scattered timbers | 0 | yard | 195 | 1 | 0 | 0 → 1 | supply_low | grade damaged: danger 1 + access 0 |
| Drowned Pier Far Platform | 0 | yard | 2 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Thin Salvage Tide Rake | 0 | yard | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Old Pier Upper Truss | 1 | transit | 1 | 1 | 1 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Overhead Shore Catwalk | 1 | transit | 84 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Leaning Signal Perch | 2 | roof | 18 | 1 | 1 | 0 → 1 | toolbox_low | reachable roof / lookout: the climb is the cost; grade damaged: danger 1 + access 1 (other storey) |

## Tern Hut Pier (`po_gullpier`, pier) — 0 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Windbent Island Path | 0 | transit | 434 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Seabird Keeper Hut | 0 | room | 99 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Seabird Keeper Hut entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Low Mooring Finger | 0 | yard | 92 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Coastal Net Drying Shed | 0 | room | 37 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Coastal Net Drying Shed entrance apron | 0 | transit | 16 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Seabird Keeper Yard | 0 | yard | 560 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| West Shore Landing Ramp | 0 | transit | 217 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Tern Inlet Pier | 0 | yard | 17 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Tern Wind & Rope Locker | 0 | room | 55 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Tern Wind & Rope Locker entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Exposed Ternwatch Boardwalk | 1 | transit | 300 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Birdwatch Platform | 1 | yard | 74 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Narrow Tern Perch | 2 | roof | 107 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |

## Gulfhead Port Quarter (`po_gulfhead`, port) — 3 → 17 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Merchant Underpass and Toll Archive | -1 | cellar | 511 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Old Caravan Lodging | 0 | room | 139 | 1 | 0 | 0 → 1 | supply_low | grade damaged: danger 1 + access 0 |
| Old Caravan Lodging entrance apron | 0 | transit | 19 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Tide Chart House | 0 | room | 144 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Tide Chart House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Gulfhead Merchants Assembly | 0 | room | 171 | 1 | 0 | 1 → 1 | supply_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Gulfhead Merchants Assembly entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coopers and Winch Repair | 0 | room | 142 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Coopers and Winch Repair entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Lower service route | 0 | transit | 1105 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Cargo steps and sorting apron | 0 | yard | 575 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Gulfhead Grain Weighing Hall | 0 | room | 198 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Gulfhead Grain Weighing Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Irregular market square | 0 | yard | 1100 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Merchant Bow Pier | 0 | yard | 147 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Gulfhead Split Jetty | 0 | yard | 9 | 1 | 0 | 0 → 0 | — | only 9 standable tiles: too small to keep a chest and a clear lane |
| Public Crescent from ridge to river | 0 | yard | 707 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Customs and Quay Watch | 0 | room | 96 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Customs and Quay Watch entrance apron | 0 | transit | 5 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Ridge Caravan Street | 0 | transit | 952 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Lower River Warehouse | 0 | room | 177 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Lower River Warehouse entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Covered Spice & Fish Exchange | 0 | room | 165 | 1 | 0 | 1 → 1 | food_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Covered Spice & Fish Exchange entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Guild threshold walks | 0 | transit | 111 | 1 | 0 | 1 → 1 | supply_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Freight Aerial Conveyor | 1 | yard | 591 | 1 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |
| Tide Chart Gallery | 1 | upper | 100 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Market Arcades and Skywalk | 1 | transit | 314 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Merchants Hall Loggia | 1 | upper | 300 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Market Rooftop Signal Walk | 2 | transit | 66 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Open Hoist Operating Deck | 2 | roof | 34 | 1 | 1 | 0 → 1 | toolbox_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |
| Gulfhead Bell and Tariff Tower | 2 | roof | 64 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Gulf Crane Control Pavilion | 2 | roof | 42 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |

## Westmouth Canal Port (`po_westmouth`, port) — 0 → 16 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Old Tide Chamber | -1 | cellar | 386 | 1 | 1 | 0 → 1 | supply_low | grade damaged: danger 1 + access 1 (other storey) |
| River Gatehouse | 0 | room | 122 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| River Gatehouse entrance apron | 0 | transit | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Canal Customs Office | 0 | room | 106 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0 |
| Canal Customs Office entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Canal quay descent | 0 | yard | 222 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Back lanes to ledger houses | 0 | transit | 336 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Westmouth Covered Fish Exchange | 0 | room | 168 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Westmouth Covered Fish Exchange entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pickle and Smoke Works | 0 | room | 153 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Pickle and Smoke Works entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Harbour Guild Hall | 0 | room | 207 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Harbour Guild Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Festival and market alleys | 0 | yard | 703 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Mouth South Pier | 0 | yard | 7 | 1 | 0 | 0 → 0 | — | only 7 standable tiles: too small to keep a chest and a clear lane |
| Net-Menders Court House | 0 | room | 163 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Net-Menders Court House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Northern Berthing Dock | 0 | yard | 206 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Westmouth High Street | 0 | transit | 781 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Old Pilot's House | 0 | room | 102 | 1 | 0 | 0 → 1 | supply_low | grade damaged: danger 1 + access 0 |
| Old Pilot's House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ropeward service streets | 0 | transit | 237 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rivermouth Towpath behind pilot houses | 0 | transit | 170 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Guild Registry and Admiralty Room | 1 | upper | 170 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Fish Market Auction Mezzanine | 1 | upper | 160 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Westmouth Net-Sorting Gallery | 1 | yard | 271 | 1 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |
| Pilot House Upper Rooms | 1 | upper | 39 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| The Canal Customs Skybridge | 1 | transit | 377 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Admiralty Lookout Veranda | 2 | roof | 126 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |
| Narrow Rivermouth Pilot Tower | 2 | roof | 55 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Rivermouth Flag Platform | 2 | roof | 35 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |

## Saltwick Harbor (`po_saltharbor`, port) — 2 → 19 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Old Brine Cistern and Causeway | -1 | cellar | 348 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Wet Brine Works Lane | 0 | transit | 431 | 1 | 0 | 1 → 1 | food_mid | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Covered salt court access lanes | 0 | transit | 320 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Seawall Saltwarden | 0 | room | 83 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Seawall Saltwarden entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Brine Evaporation Shed | 0 | room | 131 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Brine Evaporation Shed entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Drying terraces above tide | 0 | yard | 522 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Harbour Kitchen and Coopers | 0 | room | 128 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Harbour Kitchen and Coopers entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| White Salt Market | 0 | room | 235 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| White Salt Market entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Saltwick Customs & Salt Exchange | 0 | room | 172 | 1 | 0 | 1 → 1 | supply_mid | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Saltwick Customs & Salt Exchange entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Covered Salt Market Court | 0 | yard | 976 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Saltwick Stone High Road | 0 | transit | 495 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Low Salt Barges Loading Finger | 0 | yard | 39 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Saltwick Tide Quay | 0 | yard | 81 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Sea-Wall Cloister | 0 | yard | 359 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Tide-Work Pump Hall | 0 | room | 123 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Tide-Work Pump Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Evaporation Works Upper Stage | 1 | upper | 112 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Open Salt Court Balconies | 1 | yard | 299 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Brine Hoist Skywalk | 1 | transit | 231 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Saltwarden Loft | 1 | upper | 54 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Saltwarden High Sea Walk | 1 | transit | 228 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Salt Market Cloister Gallery | 1 | upper | 311 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Open Salt Market Roof Lookout | 2 | roof | 100 | 1 | 1 | 0 → 1 | food_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |
| Saltwarden Coastal Veranda | 2 | roof | 43 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; grade low: danger 1 + access 1 (other storey) |
| Saltwarden Bell Tower | 2 | roof | 67 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |

## Ironholm Harbor / Ore Quay (`po_ironharbor`, port) — 2 → 14 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Counterweight Inspection Tunnel | -1 | cellar | 346 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |
| Coal Transfer Annex | 0 | room | 128 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Coal Transfer Annex entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Foundry maintenance lane | 0 | transit | 501 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rail and Brake Repair Shop | 0 | transit | 125 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rail and Brake Repair Shop entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Quay sorting forecourt | 0 | yard | 760 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Ore Transfer Platform | 0 | yard | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Ore Tippler Finger Quay | 0 | yard | 25 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Covered Ironstone Sorting Shed | 0 | room | 190 | 1 | 0 | 1 → 1 | supply_mid | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Covered Ironstone Sorting Shed entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ironholm Ore-cart Street | 0 | transit | 883 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ore Weighing House | 0 | room | 117 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Ore Weighing House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Twin repair alleys | 0 | transit | 392 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ore Separation / Twin Mill | 0 | room | 335 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Small workers tally court | 0 | yard | 517 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Harbor Records House | 0 | room | 111 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Harbor Records House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ore track switches and workshop turnouts | 0 | transit | 1025 | 1 | 0 | 1 → 1 | food_mid | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Haulage Winch Hall | 0 | room | 180 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Haulage Winch Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Quay Crew Lodging | 0 | room | 82 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Quay Crew Lodging entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Inclined Ore Conveyor Trestle | 1 | transit | 699 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Mill Hammer and Gear Gallery | 1 | upper | 239 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Offset Crane Driving Cabin | 2 | roof | 82 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |
| Above-track Crane Bridge | 2 | transit | 237 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Emberport / Ashworks Quay (`po_ember`, port) — 2 → 12 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Cool-down Air Duct and Ash Service Tunnel | -1 | cellar | 427 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Ash Ledger and Screening Hall | 0 | room | 161 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Ash Ledger and Screening Hall entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ashworks maintenance ribbons | 0 | transit | 1732 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Cinder Market Service Road | 0 | transit | 871 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Cinder Repair Yard Office | 0 | room | 154 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Cinder Repair Yard Office entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Outer Stack Transfer Stage | 0 | yard | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Heatshield Coastal Apron | 0 | transit | 262 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ember Sea-facing Slag Quay | 0 | yard | 36 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Split Ashworks Furnace | 0 | room | 273 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Kiln Separation Courtyard | 0 | yard | 719 | 1 | 0 | 1 → 1 | military_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Ember Beacon and Signal House | 0 | room | 94 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Ember Beacon and Signal House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Dross-lane & quay path | 0 | transit | 640 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ember Shift and Cooling House | 0 | room | 135 | 1 | 0 | 1 → 1 | supply_mid | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Ember Shift and Cooling House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ash Cart Loop | 0 | transit | 530 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Slag Storage Kiln | 0 | room | 177 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Slag Storage Kiln entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Tanker Pipe Inspection House | 0 | room | 148 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Tanker Pipe Inspection House entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ashworks Cooling Gallery | 1 | upper | 189 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Ore and Slag High Belt | 1 | transit | 502 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| External Cooling-belt Bypass | 1 | transit | 128 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Separated Stack Control Pod | 2 | roof | 62 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |
| Exposed Heat Shield Rail | 2 | transit | 112 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Sandgate / Sluice Port (`po_sandgate`, port) — 0 → 13 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Flood Gate Counterweight Culvert | -1 | cellar | 303 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |
| River-side sluice service routes | 0 | yard | 1200 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Counterweight Flood-Gate Assembly | 0 | room | 329 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Sandgate Toll Gatehouse | 0 | room | 150 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Sandgate Toll Gatehouse entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Dune Warehouse Lane | 0 | transit | 747 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Estuary Net Store | 0 | room | 161 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Estuary Net Store entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sandgate Pilot Survey Office | 0 | room | 98 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Sandgate Pilot Survey Office entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Breakwater Quay Apron | 0 | yard | 348 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Tidal Sluice Repair Shop | 0 | room | 179 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Tidal Sluice Repair Shop entrance apron | 0 | transit | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Dike Maintenance Lane | 0 | transit | 518 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Irregular Tidal Customs Yard | 0 | yard | 561 | 1 | 0 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 0 |
| Estuary Customs Berth | 0 | yard | 74 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Sandgate Outer Landing | 0 | yard | 3 | 1 | 0 | 0 → 0 | — | only 3 standable tiles: too small to keep a chest and a clear lane |
| Sandgate Upper Approach Road | 0 | transit | 587 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Upper Grain Transit Warehouse | 0 | room | 199 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Upper Grain Transit Warehouse entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Canal Store and Rope Loft | 0 | room | 177 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Canal Store and Rope Loft entrance apron | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Above-current Tidal Gate Walk | 1 | transit | 595 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sky Freight Slips | 1 | yard | 200 | 1 | 1 | 0 → 1 | supply_low | grade low: danger 1 + access 1 (other storey) |
| Grain Ledger Gallery | 1 | upper | 167 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |
| Asymmetric Dike Gauge Watch | 2 | roof | 61 | 1 | 1 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |
| Shallow Canal Watch Deck | 2 | roof | 62 | 1 | 1 | 0 → 1 | supply_low | reachable roof / lookout: the climb is the cost; guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |

## Falls Powerhouse (`po_falls`, powerplant) — 3 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Bearing Chamber and Tailrace Service Passage | -1 | cellar | 295 | 3 | 1 | 0 → 2 | supply_mid, supply_mid | cellar with a loot function (storage / general-purpose room; 295 standable tiles); large (295 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 1 (other storey) |
| Waterfall bypass and downstream return | 0 | transit | 490 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Headrace inspection path | 0 | transit | 793 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Water Intake Gatehouse | 0 | room | 153 | 2 | 0 | 1 → 2 | military_mid, supply_low | room with a loot function (storage / general-purpose room; 153 standable tiles); large (153 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Water Intake Gatehouse threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Gate-control approach | 0 | transit | 112 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pipe store service spur | 0 | transit | 29 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pressure Pipe and Tool Store | 0 | room | 138 | 2 | 2 | 1 → 1 | military_high | room with a loot function ("Pressure" in the room name; 138 standable tiles); grade low: danger 2 + access 2 (card door); 1 round-1 source(s) already stand here and count toward the 1 |
| Pressure Pipe and Tool Store threshold | 0 | transit | 24 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Turbine hall working threshold | 0 | transit | 83 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Turbine and Rotor House | 0 | room | 252 | 2 | 0 | 1 → 2 | supply_mid, toolbox_low | room with a loot function ("Turbine" in the room name; 252 standable tiles); large (252 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Turbine and Rotor House threshold | 0 | transit | 25 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rotor Balancing Mezzanine | 1 | upper | 124 | 2 | 1 | 0 → 1 | toolbox_low | upper-storey room with a loot function ("Rotor" in the room name; 124 standable tiles); grade low: danger 2 + access 1 (other storey) |

## Greywater Pumphouse (`po_pumphouse`, filter) — 3 → 7 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Enclosed Turbine Bearing Room | -1 | cellar | 145 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (145 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Headwater to turbine service path | 0 | transit | 868 | 2 | 0 | 1 → 1 | toolbox_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Reservoir Gatehouse | 0 | room | 0 | 2 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Reservoir Gatehouse threshold | 0 | transit | 0 | 2 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Pipe maintenance bend | 0 | yard | 180 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Pressure Pipe and Tool Store | 0 | room | 137 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Pressure Pipe and Tool Store threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Reservoir intake work edge | 0 | yard | 90 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Narrow stone river apron | 0 | transit | 94 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Turbine and Rotor House | 0 | room | 252 | 2 | 0 | 2 → 2 | medical_low, supply_low | large (252 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 2 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Turbine and Rotor House threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rotor Inspection Mezzanine | 1 | upper | 92 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |

## Old Pumping Plant (`po_oldpump`, facility) — 0 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Enclosed Turbine Bearing Room | -1 | cellar | 145 | 3 | 1 | 0 → 2 | toolbox_low, toolbox_low | cellar with a loot function ("Turbine" in the room name; 145 standable tiles); large (145 tiles) in a danger-3 site: second chest at the far wall; grade low: danger 3 + access 1 (other storey) |
| Shallow fractured pressure channels | 0 | transit | 327 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Headwater to turbine service path | 0 | transit | 811 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Water Intake Gatehouse | 0 | room | 154 | 2 | 0 | 0 → 2 | supply_low, supply_low | room with a loot function (storage / general-purpose room; 154 standable tiles); large (154 tiles) in a danger-2 site: second chest at the far wall; grade damaged: danger 2 + access 0 |
| Water Intake Gatehouse threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Pipe maintenance bend | 0 | yard | 180 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Pressure Pipe and Tool Store | 0 | room | 137 | 3 | 0 | 0 → 1 | toolbox_low | room with a loot function ("Pressure" in the room name; 137 standable tiles); grade low: danger 3 + access 0 |
| Pressure Pipe and Tool Store threshold | 0 | transit | 25 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Narrow stone river apron | 0 | transit | 314 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Silent Pump Engine | 0 | room | 258 | 3 | 0 | 0 → 2 | toolbox_low, toolbox_low | room with a loot function ("Pump" in the room name; 258 standable tiles); large (258 tiles) in a danger-3 site: second chest at the far wall; grade low: danger 3 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Silent Pump Engine threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rotor Inspection Mezzanine | 1 | upper | 92 | 2 | 1 | 0 → 1 | toolbox_low | upper-storey room with a loot function ("Rotor" in the room name; 92 standable tiles); grade low: danger 2 + access 1 (other storey) |

## Aion Edge Sawmill (`po_sawaion`, sawmill) — 2 → 4 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Dry Timber Sorting Shed | 0 | room | 145 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Outbound planks and staging | 0 | yard | 90 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Dry Timber Sorting Shed threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Incoming Log Store | 0 | room | 122 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Materials receiving turn | 0 | yard | 29 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Incoming Log Store threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Saw maintenance return walk | 0 | transit | 284 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Incoming log feed carriage | 0 | yard | 848 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Walkway to crosscut room | 0 | transit | 198 | 1 | 0 | 1 → 1 | toolbox_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Main Crosscut Sawhouse | 0 | room | 282 | 1 | 0 | 1 → 1 | supply_mid | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Main Crosscut Sawhouse threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Belt Drive Loft | 1 | transit | 162 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Mossbrook Mill (`po_mill`, mill) — 2 → 4 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Tool hut backwalk | 0 | yard | 224 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Dry Grain and Flour Store | 0 | room | 169 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Dry output delivery ramp | 0 | transit | 72 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Dry Grain and Flour Store threshold | 0 | transit | 24 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Miller Tool and Repair Hut | 0 | room | 125 | 1 | 0 | 1 → 1 | food_mid | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Miller Tool and Repair Hut threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Miller arrival and grain delivery | 0 | yard | 634 | 1 | 0 | 1 → 1 | supply_low | open ground with no working function in its name: no source |
| Mill wheel splash apron | 0 | transit | 268 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wheelhouse and Grinding Floor | 0 | room | 266 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Millstone entry and flow-control turn | 0 | yard | 14 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Wheelhouse and Grinding Floor threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Mill Belt and Grain Sieve Loft | 1 | transit | 161 | 1 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Verdant Timberyard (`po_timberyard`, sawmill) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Air-Dry Timber Storage Barn | 0 | room | 179 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0 |
| Air-Dry Timber Storage Barn threshold | 0 | transit | 22 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Outbound dry timber loading turn | 0 | yard | 47 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Log grading and sorting aisles | 0 | yard | 237 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Bank-side log haul and outgoing plank traffic | 0 | yard | 314 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Receiving station clerk approach | 0 | transit | 24 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Timber Receiving and Weigh Station | 0 | room | 62 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Timber Receiving and Weigh Station threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| East-bank ventilated treatment service | 0 | yard | 221 | 1 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Resin and Timber Treatment Shed | 0 | room | 166 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Resin and Timber Treatment Shed threshold | 0 | transit | 25 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Worker shortcut outside the haul track | 0 | transit | 129 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Log Count Gantry | 1 | yard | 80 | 1 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |

## Fracture Quarry (`po_fracquarry`, quarry) — 0 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Under-Face Survey Adit | -1 | cellar | 391 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (391 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Rock Cutting and Screening House | 0 | room | 211 | 2 | 0 | 0 → 2 | toolbox_low, toolbox_low | large (211 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Rock Cutting and Screening House threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Narrow stone approach at fracture rim | 0 | transit | 478 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ore sorting and plant entry | 0 | yard | 210 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Rock-cut switchbacks | 0 | transit | 887 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Survey rim and short sheltered backtrack | 0 | yard | 224 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Surveyor Station | 0 | room | 145 | 2 | 0 | 0 → 2 | toolbox_low, toolbox_low | large (145 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Surveyor Station threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Survey notebook access | 0 | yard | 74 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Short rock ledge above ore screen | 1 | yard | 185 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |

## Greyback Quarry (`po_greyquarry`, quarry) — 2 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Short Enclosed Rock Adit | -1 | cellar | 253 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (253 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Staggered ore benches and switchbacks | 0 | transit | 998 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Rock Cutting House | 0 | room | 206 | 2 | 0 | 0 → 2 | supply_low, supply_low | large (206 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Rock Cutting House threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Narrow quarry entrance cut | 0 | transit | 391 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken rock-cut rim | 0 | yard | 322 | 2 | 0 | 0 → 1 | toolbox_low | grade damaged: danger 2 + access 0 |
| Crushed rock stock lane | 0 | transit | 264 | 2 | 0 | 1 → 1 | supply_damaged | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Greyback Gravel Screening Spur | 0 | transit | 227 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Survey Hut Return | 0 | transit | 257 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Surveyor Shack | 0 | room | 145 | 2 | 0 | 1 → 2 | toolbox_damaged, toolbox_low | large (145 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Surveyor Shack threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Upper fractured cut face | 1 | yard | 270 | 2 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |

## Obsidian Quarry (`po_obsq`, quarry) — 0 → 6 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Short Enclosed Rock Adit | -1 | cellar | 253 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (253 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Staggered ore benches and switchbacks | 0 | transit | 1011 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Glass Shard Workshop | 0 | room | 206 | 2 | 0 | 0 → 2 | toolbox_low, toolbox_low | large (206 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Glass Shard Workshop threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Narrow quarry entrance cut | 0 | transit | 391 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken rock-cut rim | 0 | yard | 322 | 2 | 0 | 0 → 0 | — | grade damaged: danger 2 + access 0; no free wall tile for chest 1 without moving furniture: left out |
| Obsidian Shard Survey Spur | 0 | transit | 207 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Crushed rock stock lane | 0 | transit | 276 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Survey Hut Return | 0 | transit | 257 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Surveyor Shack | 0 | room | 145 | 2 | 0 | 0 → 2 | toolbox_low, toolbox_low | large (145 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Surveyor Shack threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Upper fractured cut face | 1 | yard | 270 | 2 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |

## Charcoal Kilns (`po_kilns`, smelter) — 2 → 9 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ventilated Output Sorting | 0 | room | 227 | 2 | 0 | 0 → 2 | supply_low, supply_low | large (227 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Ventilated Output Sorting threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Output cooling ledge | 0 | yard | 308 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Dry Fuel Preparation Shed | 0 | room | 155 | 2 | 0 | 1 → 2 | supply_low, supply_mid | large (155 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Dry Fuel Preparation Shed threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Fuel feed and ash removal | 0 | yard | 579 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Heat-blackened kiln footings | 0 | yard | 263 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Tapered kiln and work court | 0 | yard | 895 | 2 | 0 | 1 → 2 | toolbox_low, toolbox_low | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Low Kiln Draught Terrace | 1 | yard | 217 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |

## Slagworks Foundry (`po_slag`, smelter) — 3 → 12 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Quench Drain and Pump Maintenance Underpass | -1 | cellar | 236 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (236 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Central supply and smelter work route | 0 | yard | 933 | 2 | 0 | 1 → 1 | military_mid | open ground with no working function in its name: no source |
| Fuel receiving bay and return | 0 | transit | 199 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Charcoal and Coke Receiving | 0 | room | 172 | 2 | 0 | 1 → 2 | supply_high, supply_low | large (172 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Charcoal and Coke Receiving threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Primary Iron and Slag Furnace | 0 | room | 372 | 2 | 0 | 1 → 2 | toolbox_high, toolbox_low | large (372 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Primary Iron and Slag Furnace threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Furnace side intake | 0 | yard | 35 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Separated hot slag transfer and return loop | 0 | yard | 606 | 2 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Quenched Bloom Sorting Bay | 0 | room | 273 | 2 | 0 | 0 → 2 | toolbox_low, toolbox_low | large (273 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Quenched Bloom Sorting Bay threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sorted output shipping and drain rim | 0 | yard | 99 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Enclosed Furnace Firewatch and Vent Gallery | 1 | upper | 205 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (205 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |

## Sulfur Works (`po_sulfur`, mine) — 2 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ventilated Output Sorting | 0 | room | 194 | 2 | 0 | 0 → 2 | supply_low, supply_low | room with a loot function (storage / general-purpose room; 194 standable tiles); large (194 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Ventilated Output Sorting threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Output cooling ledge | 0 | yard | 273 | 2 | 0 | 0 → 1 | toolbox_low | working yard (no functional word in the name; site archetype "mine"; 273 standable tiles): one stack against cover; grade low: danger 2 + access 0 |
| Dry Fuel Preparation Shed | 0 | room | 155 | 2 | 0 | 1 → 2 | supply_low, supply_mid | room with a loot function (storage / general-purpose room; 155 standable tiles); large (155 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Dry Fuel Preparation Shed threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Fuel feed and ash removal | 0 | yard | 558 | 3 | 0 | 1 → 1 | toolbox_high | open ground with no working function in its name: no source |
| Heat-blackened kiln footings | 0 | yard | 260 | 3 | 0 | 0 → 1 | toolbox_low | working yard ("kiln" in the room name; 260 standable tiles): one stack against cover; grade low: danger 3 + access 0 |
| Tapered kiln and work court | 0 | yard | 624 | 3 | 0 | 0 → 1 | toolbox_low | working yard ("kiln" in the room name; 624 standable tiles): one stack against cover; grade low: danger 3 + access 0 |
| Sulfur Condensing Service Line | 0 | transit | 353 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sealed Condenser Shaft | 1 | transit | 132 | 3 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Grain Silo Complex (`po_siloc`, warehouse) — 3 → 10 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Elevator turn apron | 0 | transit | 35 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Large Offset Grain Elevator | 0 | room | 600 | 2 | 0 | 1 → 2 | food_high, food_low | large (600 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Dry Grain Grading | 0 | room | 138 | 2 | 0 | 0 → 1 | food_low | grade low: danger 2 + access 0 |
| Dry Grain Grading threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Bagged Grain Receiving | 0 | room | 172 | 2 | 0 | 1 → 2 | food_low, supply_mid | large (172 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Bagged Grain Receiving threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Grain transport loop | 0 | transit | 1482 | 2 | 0 | 1 → 1 | supply_mid | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Silo Gallery | 1 | upper | 416 | 2 | 1 | 0 → 2 | food_mid, food_mid | large (416 tiles) in a danger-2 site: second chest at the far wall; grade mid: danger 2 + access 1 (other storey) |
| Silo Discharge House | 2 | roof | 191 | 2 | 1 | 0 → 2 | food_mid, food_mid | large (191 tiles) in a danger-2 site: second chest at the far wall; grade mid: danger 2 + access 1 (other storey) |

## Delta Sluice & Filter Station (`po_filter`, filter) — 2 → 6 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Covered Filter Maintenance Channel | -1 | cellar | 240 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | large (240 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |
| Dry Filter Media Store | 0 | room | 139 | 2 | 0 | 0 → 1 | medical_low | grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Dry Filter Media Store threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Water Test and Valve House | 0 | room | 139 | 2 | 0 | 1 → 1 | medical_mid | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Water Test and Valve House threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Separated Basin Transfer | 0 | yard | 687 | 2 | 0 | 1 → 1 | supply_mid | open ground with no working function in its name: no source |
| Testing and Service Path | 0 | transit | 420 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Staggered Settling Basin Service Rim | 0 | yard | 1310 | 2 | 0 | 0 → 1 | supply_low | grade low: danger 2 + access 0; no free wall tile for chest 2 without moving furniture: left out |
| Low Gauge Walk over Basin | 1 | transit | 258 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Geothermal Station (`po_geo`, powerplant) — 2 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Thermal Condenser Workshop | 0 | room | 251 | 2 | 0 | 1 → 2 | supply_high, toolbox_low | room with a loot function ("Thermal" in the room name; 251 standable tiles); large (251 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Thermal Condenser Workshop threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Steam Cooling Station | 0 | room | 204 | 2 | 0 | 0 → 2 | medical_low, medical_low | room with a loot function ("Cooling Station" in the room name; 204 standable tiles); large (204 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0 |
| Steam Cooling Station threshold | 0 | transit | 25 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Thermal Pump and Manifold Court | 0 | yard | 1297 | 3 | 0 | 1 → 2 | military_mid, toolbox_low | working yard ("Thermal" in the room name; 1297 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade low: danger 3 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| Valve Tower Service Return | 0 | transit | 324 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Steam Return Channels | 0 | transit | 803 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Thermal Vessel Inspection Loft | 1 | upper | 198 | 2 | 1 | 0 → 2 | toolbox_low, toolbox_low | upper-storey room with a loot function ("Thermal" in the room name; 198 standable tiles); large (198 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 1 (other storey) |

## Argus Observatory (`po_observatory`, observatory) — 2 → 6 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Scholarly approach and side court | 0 | yard | 184 | 2 | 0 | 1 → 1 | toolbox_low | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |
| Instrument and Record Hall | 0 | room | 211 | 2 | 0 | 1 → 2 | supply_mid, toolbox_low | large (211 tiles) in a danger-2 site: second chest at the far wall; grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Instrument and Record Hall entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Field Records Annex | 0 | room | 77 | 2 | 0 | 0 → 1 | supply_low | grade low: danger 2 + access 0 |
| Field Records Annex entrance approach | 0 | transit | 11 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Stone Viewing Gallery | 1 | upper | 134 | 2 | 1 | 0 → 1 | supply_mid | grade mid: danger 2 + access 1 (other storey) |
| Open Instrument Perch | 2 | roof | 66 | 2 | 1 | 0 → 1 | toolbox_low | reachable roof / lookout: the climb is the cost; grade low: danger 2 + access 1 (other storey) |

## Argus Archive Vaults (`po_archive`, facility) — 9 → 11 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Buried Restricted Catalogue | -1 | cellar | 123 | 3 | 3 | 0 → 1 | military_high | cellar with a loot function ("Restricted" in the room name; 123 standable tiles); grade high: danger 3 + access 3 (other storey, card door) |
| Scholarly approach and side court | 0 | yard | 184 | 3 | 0 | 0 → 1 | toolbox_low | working yard (no functional word in the name; site archetype "facility"; 184 standable tiles): one stack against cover; grade low: danger 3 + access 0 |
| Archive Reading Court | 0 | room | 211 | 2 | 2 | 2 → 2 | medical_high, military_high | room with a loot function (storage / general-purpose room; 211 standable tiles); large (211 tiles) in a danger-2 site: second chest at the far wall; grade mid: danger 2 + access 2 (card door); 2 round-1 source(s) already stand here and count toward the 2; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Archive Reading Court entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Field Records Annex | 0 | room | 77 | 3 | 2 | 7 → 7 | room_purple, room_purple, room_purple, room_purple, room_purple, room_purple, room_purple | room with a loot function (storage / general-purpose room; 77 standable tiles); grade high: danger 3 + access 2 (card door); 7 round-1 source(s) already stand here and count toward the 1 |
| Field Records Annex entrance approach | 0 | transit | 11 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Hall of Eyes (`po_hall_eyes`, elder_site) — 2 → 7 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Argus / The Closed Mind Observatory | -1 | arena | 561 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| The blindfolded approach to the Hall of Eyes | 0 | transit | 991 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Offset cloister of the Watchers | 0 | yard | 1236 | 4 | 0 | 0 → 2 | supply_mid, supply_mid | working yard (no functional word in the name; site archetype "elder_site"; 1236 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade mid: danger 4 + access 0 |
| West Archive of Mirrors | 0 | room | 183 | 3 | 0 | 1 → 2 | supply_mid, supply_mid | room with a loot function (storage / general-purpose room; 183 standable tiles); large (183 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0; 1 round-1 source(s) already stand here and count toward the 2 |
| West Archive of Mirrors entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| ARGUS / Oculus of Sixfold Sight | 0 | arena | 606 | 4 | 0 | 1 → 1 | toolbox_low | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| East Archive of Mirrors | 0 | room | 183 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (storage / general-purpose room; 183 standable tiles); large (183 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| East Archive of Mirrors entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Elevated Eyes of the Watchers | 1 | yard | 1522 | 4 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |
| Third Eye observation tower | 2 | roof | 246 | 3 | 1 | 0 → 0 | — | open ground with no working function in its name: no source |

## Lantern Light (`po_lantern`, observatory) — 2 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Scholarly approach and side court | 0 | yard | 142 | 2 | 0 | 2 → 2 | medical_low, supply_low | grade low: danger 2 + access 0; 2 round-1 source(s) already stand here and count toward the 1 |
| Instrument and Record Hall | 0 | room | 8 | 2 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Instrument and Record Hall entrance approach | 0 | transit | 16 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Lightkeeper Store | 0 | room | 0 | 2 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Lightkeeper Store entrance approach | 0 | transit | 0 | 2 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Stone Viewing Gallery | 1 | upper | 3 | 2 | 1 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Open Instrument Perch | 2 | roof | 1 | 2 | 1 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |

## Lantern Cove Station (`po_lanternstn`, roadstop) — 0 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Scholarly approach and side court | 0 | yard | 70 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Instrument and Record Hall | 0 | room | 112 | 1 | 0 | 0 → 1 | toolbox_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Instrument and Record Hall entrance approach | 0 | transit | 16 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Field Records Annex | 0 | room | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Field Records Annex entrance approach | 0 | transit | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |

## Kestrel Radio Tower (`po_kestrel`, facility) — 2 → 4 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Signal Relay Cabin | 0 | room | 72 | 3 | 0 | 0 → 1 | toolbox_low | room with a loot function ("Signal" in the room name; 72 standable tiles); grade low: danger 3 + access 0 |
| Signal Relay Cabin entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Offset windward approach | 0 | transit | 213 | 3 | 0 | 1 → 1 | military_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Signal Maintenance Tower | 0 | room | 129 | 2 | 0 | 1 → 1 | toolbox_low | room with a loot function ("Signal" in the room name; 129 standable tiles); grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Signal Maintenance Tower entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Instrument Platform | 1 | upper | 50 | 2 | 1 | 0 → 1 | toolbox_low | upper-storey room with a loot function ("Instrument" in the room name; 50 standable tiles); grade low: danger 2 + access 1 (other storey) |
| Exposed Mast Walk | 2 | transit | 49 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Typhon's Fracture (`po_typhon`, elder_site) — 0 → 4 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Typhon / Sealed Under-Cleft | -1 | arena | 627 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Narrow east-rim stair return | 0 | transit | 101 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| The sheared eastern escarpment | 0 | yard | 811 | 4 | 0 | 0 → 2 | supply_mid, supply_mid | working yard (no functional word in the name; site archetype "elder_site"; 811 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade mid: danger 4 + access 0 |
| The broken road from Falls | 0 | transit | 371 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Typhon / Ice-Scar Pressure Cleft | 0 | arena | 830 | 4 | 0 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| The fractured western escarpment | 0 | yard | 687 | 3 | 0 | 0 → 1 | supply_mid | working yard (no functional word in the name; site archetype "elder_site"; 687 standable tiles): one stack against cover; grade mid: danger 3 + access 0 |
| Broken Skybridge Above the Rift | 1 | transit | 937 | 4 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Typhon High Rim | 2 | roof | 228 | 4 | 1 | 0 → 1 | supply_high | working yard (no functional word in the name; site archetype "elder_site"; 228 standable tiles): one stack against cover; reachable roof / lookout: the climb is the cost; grade high: danger 4 + access 1 (other storey) |

## Crushed Viaduct (`po_viaduct`, ruins) — 0 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Under-Cleft Survey Pocket | -1 | cellar | 59 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |
| Weathered Salvage Shelter | 0 | room | 57 | 2 | 0 | 0 → 1 | supply_low | grade damaged: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Weathered Salvage Shelter entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken stone margins | 0 | yard | 128 | 2 | 0 | 0 → 0 | — | grade damaged: danger 2 + access 0; no free wall tile for chest 1 without moving furniture: left out |
| Surviving fractured approach | 0 | transit | 863 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Shattered Freight Yard (`po_freightyard`, ruins) — 3 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Broken Rail Platform | 0 | transit | 164 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Collapsed Freight Ledger Booth | 0 | room | 57 | 2 | 0 | 2 → 2 | military_low, supply_mid | grade damaged: danger 2 + access 0; 2 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Collapsed Freight Ledger Booth entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken stone margins | 0 | yard | 128 | 2 | 0 | 0 → 0 | — | grade damaged: danger 2 + access 0; no free wall tile for chest 1 without moving furniture: left out |
| Surviving fractured approach | 0 | transit | 826 | 2 | 0 | 1 → 1 | toolbox_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Confluence Waystation (`po_confluence`, roadstop) — 2 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Travelers Supply Shelter | 0 | room | 24 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Travelers Supply Shelter entrance approach | 0 | transit | 0 | 1 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Road fork and passing place | 0 | transit | 658 | 1 | 0 | 1 → 1 | toolbox_damaged | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wayfarer Shelter | 0 | room | 94 | 1 | 0 | 1 → 1 | supply_damaged | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Wayfarer Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Ranger Hut (`po_ranger`, hamlet) — 2 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ranger Shelter | 0 | room | 101 | 1 | 0 | 1 → 1 | food_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Ranger Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Bent woodland exploration trail | 0 | transit | 505 | 1 | 0 | 1 → 1 | medical_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Low Woodland Lookout | 1 | upper | 35 | 1 | 1 | 0 → 1 | food_low | grade low: danger 1 + access 1 (other storey) |

## Mosslight Glade (`po_glade`, grove) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Glade Keeper Shelter | 0 | room | 75 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Glade Keeper Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Ancient open clearing | 0 | yard | 190 | 1 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Bent woodland exploration trail | 0 | transit | 485 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Sap Grove (`po_sapgrove`, grove) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ranger Shelter | 0 | room | 101 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Ranger Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Bent woodland exploration trail | 0 | transit | 505 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Heart of the Elderwood (`po_elderwood`, elder_site) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Aion / The Buried Heart of Time | -1 | arena | 505 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Aion / The Elderwood Heart — open combat clearing | 0 | arena | 923 | 4 | 0 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| The winding outer root approach | 0 | transit | 342 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| The living root labyrinth around the heart | 0 | yard | 808 | 4 | 0 | 0 → 0 | — | general open ground (paving / green / common): people cross it, nothing is stored in the open; the buildings around it carry the sources |
| Forked bough walkway above the Heart | 1 | transit | 576 | 4 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| The ancient crown overlook | 2 | roof | 195 | 4 | 1 | 0 → 1 | supply_high | working yard (no functional word in the name; site archetype "elder_site"; 195 standable tiles): one stack against cover; reachable roof / lookout: the climb is the cost; grade high: danger 4 + access 1 (other storey) |

## Meridian Research Station (`po_meridian`, research) — 8 → 9 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Meridian Field Annex | 0 | room | 101 | 2 | 2 | 7 → 7 | medical_high, room_blue, room_blue, room_blue, room_blue, room_blue, room_blue | room with a loot function ("Field Annex" in the room name; 101 standable tiles); grade mid: danger 2 + access 2 (card door); 7 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Meridian Field Annex entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Bent woodland exploration trail | 0 | transit | 505 | 3 | 0 | 1 → 1 | medical_mid | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Low Woodland Lookout | 1 | upper | 35 | 2 | 3 | 0 → 1 | medical_high | upper-storey room with a loot function (no functional word in the name; site archetype "research"; 35 standable tiles); grade high: danger 2 + access 3 (other storey, card door) |

## Ironvein Mine (`po_ironvein`, mine) — 2 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Stone Prospecting Cut | -1 | cellar | 52 | 3 | 1 | 0 → 1 | toolbox_low | cellar with a loot function ("Prospect" in the room name; 52 standable tiles); grade low: danger 3 + access 1 (other storey) |
| Prospector Shelter | 0 | room | 101 | 2 | 0 | 1 → 1 | supply_mid | room with a loot function ("Prospect" in the room name; 101 standable tiles); grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Prospector Shelter entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Short zigzag to prospecting adit | 0 | yard | 70 | 3 | 0 | 0 → 0 | — | open ground with no working function in its name: no source |
| Bent woodland exploration trail | 0 | transit | 496 | 3 | 0 | 1 → 1 | toolbox_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Ridge Pass Station (`po_ridgestop`, roadstop) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Travelers Supply Shelter | 0 | room | 93 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Travelers Supply Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Road fork and passing place | 0 | transit | 790 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wayfarer Shelter | 0 | room | 94 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Wayfarer Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sentry Lookout Floor | 1 | upper | 30 | 1 | 1 | 0 → 1 | supply_low | guard word in the name but the site is a low-danger settlement: Supply, not Military; grade low: danger 1 + access 1 (other storey) |

## Rapids Portage Hut (`po_rapids`, roadstop) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Travelers Supply Shelter | 0 | room | 93 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Travelers Supply Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Road fork and passing place | 0 | transit | 489 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wayfarer Shelter | 0 | room | 89 | 1 | 0 | 0 → 0 | — | no walking route from the open ground reaches this space in the compiled runtime (reported, not deleted): no source until it is reachable |
| Wayfarer Shelter entrance approach | 0 | transit | 3 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Westwood Hamlet (`po_westwood`, hamlet) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Woodland Sleeping Cottage | 0 | room | 70 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Woodland Sleeping Cottage entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Travelers Supply Shelter | 0 | room | 93 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Travelers Supply Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Road fork and passing place | 0 | transit | 782 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wayfarer Shelter | 0 | room | 94 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Wayfarer Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Footpath to sleeping cottage | 0 | transit | 48 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Fish Camp (`po_fishcamp`, hamlet) — 2 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Narrow forest track to net shed | 0 | transit | 14 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Small Fishing Netshed | 0 | room | 82 | 1 | 0 | 1 → 1 | food_low | grade low: danger 1 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Small Fishing Netshed entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Bent woodland exploration trail | 0 | transit | 526 | 1 | 0 | 1 → 1 | medical_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Necropolis of the Hollow Sun (`po_necropolis`, elder_site) — 0 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Anubis / Inner Judgement Crypt | -1 | arena | 534 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Guardian Sarcophagus Chapel | 0 | room | 189 | 3 | 0 | 0 → 2 | military_mid, supply_mid | room with a loot function ("Guard" in the room name; 189 standable tiles); large (189 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0; one Military Case only (the room is neither gated, hidden nor on another storey): the other chest is Supply |
| Guardian Sarcophagus Chapel entrance approach | 0 | transit | 17 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| ANUBIS / Court of the Hollow Sun | 0 | arena | 435 | 4 | 0 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| The Processional Avenue of Names | 0 | transit | 1172 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Walled tomb terraces and colonnades | 0 | yard | 1452 | 4 | 0 | 0 → 1 | supply_mid | large exposed ground in a danger-4 site (1452 tiles): one cache against cover rewards crossing it; grade mid: danger 4 + access 0 |
| Sepulchre of the Forgotten Names | 0 | room | 189 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (no functional word in the name; site archetype "elder_site"; 189 standable tiles); large (189 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| Sepulchre of the Forgotten Names entrance approach | 0 | transit | 17 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Elevated tomb-court circumambulation | 1 | yard | 1332 | 4 | 1 | 0 → 2 | supply_high, supply_high | working yard (no functional word in the name; site archetype "elder_site"; 1332 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade high: danger 4 + access 1 (other storey) |
| Hollow Sun overlook | 2 | roof | 240 | 4 | 1 | 0 → 1 | supply_high | working yard (no functional word in the name; site archetype "elder_site"; 240 standable tiles): one stack against cover; reachable roof / lookout: the climb is the cost; grade high: danger 4 + access 1 (other storey) |

## Dune Tombs (`po_tombs`, tomb) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Burial Chamber and Side Niche | -1 | cellar | 136 | 3 | 1 | 0 → 1 | supply_mid | cellar with a loot function (storage / general-purpose room; 136 standable tiles); grade mid: danger 3 + access 1 (other storey) |
| Sacred Threshold Hall | 0 | transit | 213 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sacred Threshold Hall entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Processional stone approach | 0 | transit | 297 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Sunken Cairns (`po_cairns`, ruins) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Burial Chamber and Side Niche | -1 | cellar | 136 | 2 | 1 | 0 → 1 | supply_mid | cellar with a loot function (storage / general-purpose room; 136 standable tiles); grade mid: danger 2 + access 1 (other storey) |
| Sacred Threshold Hall | 0 | transit | 213 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Sacred Threshold Hall entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Processional stone approach | 0 | transit | 297 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Bone Road Waystation (`po_bonestop`, roadstop) — 0 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Travelers Supply Shelter | 0 | room | 93 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Travelers Supply Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Road fork and passing place | 0 | transit | 790 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Wayfarer Shelter | 0 | room | 94 | 1 | 0 | 0 → 1 | medical_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Wayfarer Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Threshold Gate (`po_gate`, gate) — 0 → 5 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Atlas / Folded Subspace Vault | -1 | arena | 573 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Eastern Gate Anchor | 0 | room | 193 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (no functional word in the name; site archetype "gate"; 193 standable tiles); large (193 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| Eastern Gate Anchor entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Two dislocated buttress wings | 0 | yard | 1041 | 4 | 0 | 0 → 1 | supply_mid | large exposed ground in a danger-4 site (1041 tiles): one cache against cover rewards crossing it; grade mid: danger 4 + access 0 |
| The abandoned causeway and return path | 0 | transit | 522 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| ATLAS / The Unbroken Return Threshold | 0 | arena | 416 | 4 | 0 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Narrow return route to the vault hatch | 0 | transit | 60 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Western Gate Anchor | 0 | room | 193 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (no functional word in the name; site archetype "gate"; 193 standable tiles); large (193 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| Western Gate Anchor entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Gate-anchor buttress approaches | 0 | transit | 588 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| The Suspended Arch Span | 1 | transit | 1452 | 4 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Atlas Keystone and wide return overlook | 2 | transit | 502 | 3 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Beacon Rock Light (`po_beacon`, observatory) — 0 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Signal Relay Cabin | 0 | room | 0 | 2 | 0 | 0 → 0 | — | no standable tile in the compiled runtime |
| Signal Relay Cabin entrance approach | 0 | transit | 16 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Offset windward approach | 0 | transit | 386 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Signal Maintenance Tower | 0 | room | 129 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Signal Maintenance Tower entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Instrument Platform | 1 | upper | 50 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |
| Exposed Mast Walk | 2 | transit | 49 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Wreck Isle Salvage (`po_wreck`, ruins) — 3 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Weathered Salvage Shelter | 0 | room | 57 | 2 | 0 | 2 → 2 | military_mid, supply_mid | grade damaged: danger 2 + access 0; 2 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Weathered Salvage Shelter entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken stone margins | 0 | yard | 128 | 2 | 0 | 0 → 0 | — | grade damaged: danger 2 + access 0; no free wall tile for chest 1 without moving furniture: left out |
| Surviving fractured approach | 0 | transit | 863 | 2 | 0 | 1 → 1 | toolbox_high | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Tidepool Fishing Camp (`po_tidecamp`, hamlet) — 2 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Fisher Shelter | 0 | room | 84 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Fisher Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coastal path and small working apron | 0 | yard | 715 | 1 | 0 | 2 → 2 | food_low, supply_low | grade low: danger 1 + access 0; 2 round-1 source(s) already stand here and count toward the 1 |

## Seabird Nesting Cliffs (`po_gullnest`, grove) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Fisher Shelter | 0 | room | 84 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Fisher Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coastal path and small working apron | 0 | yard | 715 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |
| Seabird Survey Hut Loft | 1 | upper | 26 | 1 | 1 | 0 → 1 | toolbox_low | grade low: danger 1 + access 1 (other storey) |

## Gull Net Camp (`po_netcamp`, hamlet) — 0 → 2 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Fisher Shelter | 0 | room | 84 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Fisher Shelter entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coastal path and small working apron | 0 | yard | 715 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |

## Ember Watch (`po_emberwatch`, observatory) — 2 → 4 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Signal Relay Cabin | 0 | room | 72 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Signal Relay Cabin entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Offset windward approach | 0 | transit | 213 | 2 | 0 | 1 → 1 | medical_low | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Signal Maintenance Tower | 0 | room | 128 | 2 | 0 | 1 → 1 | military_low | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Signal Maintenance Tower entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Instrument Platform | 1 | upper | 50 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |
| Exposed Mast Walk | 2 | transit | 49 | 2 | 1 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Foundry of the First Fire (`po_surtur`, elder_site) — 0 → 8 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Surtur / The Volcano Heart-Furnace | -1 | arena | 608 | 4 | 1 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| The ash-choked pilgrim path | 0 | transit | 906 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| The Broken Crucible Reliquary | 0 | room | 206 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (no functional word in the name; site archetype "elder_site"; 206 standable tiles); large (206 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| The Broken Crucible Reliquary entrance approach | 0 | transit | 20 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| SURTUR / Foundry of the First Fire | 0 | arena | 726 | 4 | 0 | 0 → 0 | — | Primordial combat floor: a solid chest would change the fight, and its reward belongs to the encounter owner: no G1B source |
| Basalt furnace access and return | 0 | transit | 172 | 4 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Basalt crucible terraces | 0 | yard | 1378 | 4 | 0 | 0 → 1 | supply_mid | large exposed ground in a danger-4 site (1378 tiles): one cache against cover rewards crossing it; grade mid: danger 4 + access 0 |
| Basalt Archive of the First Spark | 0 | room | 206 | 3 | 0 | 0 → 2 | supply_mid, supply_mid | room with a loot function (storage / general-purpose room; 206 standable tiles); large (206 tiles) in a danger-3 site: second chest at the far wall; grade mid: danger 3 + access 0 |
| Basalt Archive of the First Spark entrance approach | 0 | transit | 20 | 3 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Upper Rim of the Primordial Forge | 1 | yard | 1552 | 4 | 1 | 0 → 2 | toolbox_high, toolbox_high | working yard ("Forge" in the room name; 1552 standable tiles): two separated stacks, the yard is large and the site is dangerous; grade high: danger 4 + access 1 (other storey) |
| Charred Crown of the Mountain | 2 | roof | 249 | 4 | 1 | 0 → 1 | supply_high | working yard (no functional word in the name; site archetype "elder_site"; 249 standable tiles): one stack against cover; reachable roof / lookout: the climb is the cost; grade high: danger 4 + access 1 (other storey) |

## Salt Pans (`po_saltpans`, quarry) — 2 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Evaporation and Drying Store | 0 | room | 84 | 2 | 0 | 1 → 1 | supply_low | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Evaporation and Drying Store entrance approach | 0 | transit | 14 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Salt Evaporation Beds | 0 | yard | 246 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Coastal path and small working apron | 0 | yard | 506 | 2 | 0 | 1 → 1 | toolbox_low | grade low: danger 2 + access 0; 1 round-1 source(s) already stand here and count toward the 1 |

## Saltwick Light (`po_saltlight`, observatory) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Signal Relay Cabin | 0 | room | 72 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0 |
| Signal Relay Cabin entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Offset windward approach | 0 | transit | 213 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Coast Signal Base | 0 | room | 129 | 2 | 0 | 0 → 1 | toolbox_low | grade low: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Coast Signal Base entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Instrument Platform | 1 | upper | 49 | 2 | 1 | 0 → 1 | toolbox_low | grade low: danger 2 + access 1 (other storey) |

## Kelp Racks (`po_racks`, hamlet) — 0 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Evaporation and Drying Store | 0 | room | 84 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Evaporation and Drying Store entrance approach | 0 | transit | 20 | 1 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Kelp-Drying Spines | 0 | yard | 269 | 1 | 0 | 0 → 1 | food_low | grade low: danger 1 + access 0 |
| Coastal path and small working apron | 0 | yard | 606 | 1 | 0 | 0 → 1 | supply_low | grade low: danger 1 + access 0 |

## Gull Isle Wreck (`po_gullwreck`, ruins) — 0 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Weathered Salvage Shelter | 0 | room | 57 | 2 | 0 | 0 → 1 | supply_low | grade damaged: danger 2 + access 0; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Weathered Salvage Shelter entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Broken stone margins | 0 | yard | 128 | 2 | 0 | 0 → 0 | — | grade damaged: danger 2 + access 0; no free wall tile for chest 1 without moving furniture: left out |
| Surviving fractured approach | 0 | transit | 863 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Ironholm Depot (`po_ironwh`, warehouse) — 3 → 3 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Ore Depot Records Annex | 0 | room | 109 | 2 | 0 | 2 → 2 | military_low, supply_mid | grade low: danger 2 + access 0; 2 round-1 source(s) already stand here and count toward the 1; 1 authored one-time cache(s) also in this space (kept, not counted) |
| Ore Depot Records Annex entrance approach | 0 | transit | 20 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Small documented maintenance approach | 0 | transit | 205 | 2 | 0 | 0 → 0 | — | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |
| Short covered freight apron | 0 | transit | 167 | 2 | 0 | 1 → 1 | toolbox_high | circulation (lane / stair landing / threshold / catwalk): a chest here would stand in the walking line and the space stores nothing |

## Meridian Archive Cache (`po_rc_meridian`, ragnarok_cache) — 1 → 1 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Dry Subfloor Service Cell | -1 | shell | 50 | 2 | 1 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 1 → 1 | supply_mid | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Foreman's Strongbox (`po_rc_ironvein`, ragnarok_cache) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Kestrel Tower Safe (`po_rc_kestrel`, ragnarok_cache) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Falls Dam Vault (`po_rc_dam`, ragnarok_cache) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Dry Subfloor Service Cell | -1 | shell | 50 | 2 | 1 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Sandgate Customs Strongbox (`po_rc_sandgate`, ragnarok_cache) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Saltwick Harbor Safe (`po_rc_salt`, ragnarok_cache) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Secured Instrument and Record Niche | 0 | shell | 109 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Secured Instrument and Record Niche entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Small documented maintenance approach | 0 | shell | 212 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Gulfhead Trading House [ĐỀ XUẤT] (`po_vend_gulf`, chest_vendor) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Public counter approach | 0 | shell | 291 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Proposed Counter Shell (NO trade logic) | 0 | shell | 112 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Proposed Counter Shell (NO trade logic) entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Strait Landing Counter [ĐỀ XUẤT] (`po_vend_strait`, chest_vendor) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Public counter approach | 0 | shell | 292 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Proposed Counter Shell (NO trade logic) | 0 | shell | 112 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Proposed Counter Shell (NO trade logic) entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Westmouth Evac Pier (`po_evac_west`, evac) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Evacuation assembly clearing | 0 | shell | 290 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) | 0 | shell | 112 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Southfoot Evac Beach (`po_evac_south`, evac) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Evacuation assembly clearing | 0 | shell | 295 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) | 0 | shell | 112 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |

## Hook Evac Point (`po_evac_hook`, evac) — 0 → 0 chests

| space | storey | kind | tiles | danger | access | before → after | variants | why |
|---|---:|---|---:|---:|---:|---:|---|---|
| Evacuation assembly clearing | 0 | shell | 296 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) | 0 | shell | 112 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
| Emergency Waiting Shelter (NO transport logic) entrance approach | 0 | shell | 20 | 2 | 0 | 0 → 0 | — | vendor / evacuation / recycler shell owned by another system: no G1B source |
