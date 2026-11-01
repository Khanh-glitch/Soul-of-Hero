# SOH World Formation Bible V1 — causal geography first (2026-11-01)

**STATUS: CAUSAL WORLD-DESIGN HYPOTHESIS PRESENTED / NOT CANON GEOGRAPHY / NOT GODOT.** Direct creator asked to stop random-looking V2.2 world redraw and define actual reasons for site locations, rivers, infrastructure, former civilization and player-world coupling. Main authority remains `CURRENT_PRODUCT_CONTRACT.md` and `DECISIONS.md` post D062–D074; the creator did not yet personally approve any new map layout, fictional history, six canonical Boss identities or production art.

## Evidence and negative audit of V2.2
**REAL local V2.2 source inspected**: `SOH_WORLD_V22_SOURCE.json` extracted from the archived ZIP. 26 site objects have `xy`, `history`, `kind`, but **0 of 26** have encoded physical `dependencies`/`inputs`/`outputs` or upstream `site_ids`; 12 road objects have only `points`, `cause` and `grade` with **0 road-endpoint economic object references**. All six Elder objects are `xy` + `theme` + `ecology` + text state, not actual territory polygons or effect masks. Previous 6/9→9/9 quadrant target is NOT gameplay evidence. This pinpoints why V2.2 POI and roads felt like arbitrary icon scattering even when descriptions read well. Do NOT create “V2.3” by adding site count or painting different biome colors.

**Historical boundary (H1 2019 only):** 2019 July29 official launch stated former civilization restart, original 15-day fully-reset sandbox, scavenging/building/POI/solo types (https://game.xiaomi.com/viewpoint/1103968488_1564399232104_9). 2019 Aug2 roadside barrel/box + rare-gun chance and lab needing power/credential/hazard gear (https://www.gamersky.com/handbooksy/201908/1209408.shtml). Official Aug7 resource guide describes low-tier point sources (gas/market), medium power/key rooms and deep airport/port/lab/bunker sources (https://hero.yingxiong.com/m/info/2019/0807/7028.html). 2019 Oct31 official update rebuilt region/road/city and airport 4–5× (https://hero.yingxiong.com/info/2019/1031/8033.html). **DO NOT** invent an exact 2019 full-world map or adopt 15-day as SOH's locked **14-day** real UTC run.

## Core creative thesis — USER REVIEW REQUIRED
A singular coherent continent with river basins, fractured geology and **several locally viable former economies** linked by historical trade. Natural terrain predates POIs; communities were formed where water/soil/wood/ore/ports made sense; they produced, stored, transported and used real goods; their decline left physically intelligible failures (power grid down → pumps fail → flooding, rockfall breaks quarry roads, shoreline storms destroy berths, habitat reclaims fields); the **player decides freely** how to exploit and survive those leftovers. This is new SOH design FICTION/HYPOTHESIS, not a Last Island historical fact or previously user-locked lore. Do not invent one mandatory capital city, compulsory critical bridge, houses/quest paths or three donor loot crates per spawn.

### Six ECOLOGICAL mechanisms, NOT six required regions
1. Windward forest catchment: orographic rain, creeks, woodland, mushrooms, timber; historic logging and sawmill; rain mud/cover/track risks.
2. Ancient northern folded bedrock: exposed ore/seams, upper water, cold mountain saddle; quarry and maintenance/trade pass; snow/cliffs/wear/rockslide risks.
3. Central/southern alluvial valley: actual downhill perennial water, floodplain and dry terraces, grain/herbs/food/fish; fields, waterways, mill, road markets; flood/season tradeoffs.
4. Leeward hot fractured rock: dry lee side, fissure gas/sulfur, ore/hot stone; smelter/forge and ore freight; heat, dust and gaseous hazards.
5. Tidal coast and sheltered harbor: naturally deep waters, wave breaks/salt/fish, ferries and customs/shipping; storm/sea level/boat freight tradeoffs.
6. Fen + karst underflow: slow drainage/tidal peat, limestone caves, disappearing streams and springs; pump/filter/cave store; poison/bog/sinkhole and optional wetlands routes.

**None** is a mechanically fixed biome quota/house district; boundaries follow runoff, geology, surface material, coast and weather. User build freedom on any physically legal footprint throughout map. Avoid “one boss per biome” layout symmetry; historical artifacts and Elder geographic territories can interleave with ecological mechanisms.

## Thirteen CAUSAL facility archetypes — not a 13-POI quota
Each is a meaningful world role to include where material access and route costs justify it; multiple small, one compound, moved or excluded after simulation:
| Facility role | Why physically there | Inputs → outputs | Player-facing potential |
|---|---|---|---|
| Timber camp | Good managed stand and haulable banks | forest+tools → logs/fuel feed | wood/melee/tracks |
| Water sawmill | usable water head, timber haul road | logs+water → planks/mechanics | home/repair |
| Quarry | exposed seam+haul grade | bedrock+pick+support → stone/ore | tools, cargo, deep access |
| Mountain waystation | natural saddle/shelter | travellers/food → shelter/repair traces | weather, alternative transit |
| Irrigation hamlet | alluvium+upstream intake | water+soil → food/fiber | crop/medicine |
| Watermill/store | legitimate water head + farm roads | grain+water → flour/parts | processes/repair |
| Foundry/forge ruins | ore transport, fuel & cooling | ore+charcoal+water → ingots/parts | gear, smelting, hazard |
| Hydro/switchworks | headwater drop & transmission line | water head+parts → power | turn on portions of real POIs |
| Repair/trade relay | actual resource-road junction | timber+grain+ore+parts → spares/trade | optional physical vendor/recycle |
| Port/customs | sheltered navigable bay + road | products+boats → shipping/custody | realistic fixed deposit/evac candidates |
| Fishing yard | protected cove and coast resources | fish+wood+salt → food/boat repair | ordinary quiet survival |
| Drainage/filtration station | flood/peat land once reclaimed | power+filter → dry corridors/treated water | toxic hazard, optional routes |
| Karst specimen archive | caves with high dry chamber/access | samples+energy+security → research | layered POI, rare Core candidate |

**Every candidate must have:** environmental cause; inputs/outputs; nearby historically plausible support; at least one exterior value; deeper-gate logic only if warranted; finite physically sourced loot/SaveService; reason to revisit OR conscious one-time value; honest collision/door/footprint/retreat; gameplay failure if omitted. A pretty ruin with no former utility or survival consequence should be removed.

## 7 historical transport RELATIONSHIPS, not drawn roads / not a 7-road quota
- lumber hauling: timber camp ↔ sawmill ↔ nearby commerce
- mountain ore freight: quarry ↔ mountain saddle ↔ repair junction
- valley food freight: field hamlets ↔ mill ↔ repair/trade
- ore production: quarry ↔ foundry ↔ repair/port
- power maintenance: hydro works ↔ foundry ↔ secure powered archive
- coast trade: relay ↔ customs/port ↔ fishing yard
- pump maintenance: filtration ↔ karst archive ↔ coastal outflow

**Do not draw road before site causes.** A transport edge must have credible slope, load, season, crossing/bridge, road width, and independent footpath choices. NO automatic walkability from a stylized line drawn across water.

## 6 material networks (real player opportunity costs)
1. wooded catchment → yard → sawmill → timber/planks/charcoal (repair, building, forge)
2. fracture/ore → quarry → foundry → station/workshop parts (tool wear/gear/knowledge)
3. alluvial water/soil → harvest → mill/storehouse → food/fiber (farm/offline preparation)
4. headwater drop → hydro/switch → physically powered deeper industrial/POI access
5. tidal bay → fishing/boatwork → customs/freight → mobility/recycle/deposit/evac candidates
6. drainage contaminants/peat → pump/filters → safely navigable deeper fen/karst research

**Economies are structural opportunities, not mandatory quest chain.** The player may harvest trees far from roads, make a house anywhere legal, acquire physical Core through authentic rare sources, bypass industry, and abandon/restart early. Do not guarantee free “one important item” per spawn, and do not turn production into compulsory tutorial grind.

## Elder impact system — 6 distinct habitat HYPOTHESES (boss identities not invented)
- Deep roots/spores in old windward forest: humidity/fungus grows into physically traversable roots.
- Glacial cold in high cirque: exposed pass/chill/snowdrift, genuine other lowland options.
- Fissure heat/sulfur in leeward fault: vent source and wind create spatial warnings.
- Fen toxicity/tidal surge in lower estuary: actual water level/peat flood, filtered path.
- Karst deep fracture: sinkhole/cave acoustics, physical descend/climb/flood.
- Storm ridge: lightning and exposed stone/old conductors, avoidable physical track.

All six must have discoverable weaker pre-event states and distinct day12–14 awakenings, preparation gear and non-boss alternative progression. These are **terrain influence archetypes only** until mapped to the exact six source-authentic Ragnarok bosses; don't overwrite Gold skills or published identity.

## Player-agency invariants & destructive tests
- Any world cell/footprint legal under support, actual slope/water/flood, site occupancy, collision and owner authority can hold a player-built house/farm/outpost. There are no recommended home neighborhoods, scripted prebuilt homes or invisible designer region exclusions.
- Spawn from a large dynamically safe real land surface without guaranteed crates or forced proximity to a quest POI.
- Quiet melee/no Core can use ordinary resource collection, roadside source-backed salvage and exterior POI loot without boss/Key-I guarantee. Rare physical charged Core immediately usable, distinct USE/KEEP/RESEARCH with three prices/methods A3 controls.
- Under 336h run world, player funds physical farm/forge/research while offline, returns or doesn't. Room/cargo/bed/bag/track/hazards physically matter.
- Tiered POIs expose clues/outer resources before deeper key/power/hazard locks; multiple historical dependencies without singular forced route.
- Final72 rare currency only in authentic limited rare chests, physically carried/lost via bag, **multiple fixed-machine deposits** with atomic receipts, no forced Elder, optional physical evacuation. Six stones exceptional voluntary challenge. No fake money via victory-score.
- TEST counterfactuals: 3 arbitrarily user-chosen build sites in same broad ecology; unlucky roadside loot; Core-first, home-first, walk-only 3 sessions, a flooded bridge, missing power, isolated POI, late no-boss cash, bank unreachable with cargo, 336h expiry/restart. Don't claim PASS until real-source native tests.

## Artifact made in this conversation (not automatically available to agents)
- `SOH_WORLD_FORMATION_BIBLE_V1.md`: detailed ~3500-word Vietnamese writer's bible
- `SOH_WORLD_FORMATION_CAUSAL_GRAPH_V1.json`: complete causal schema 6 ecologies, 13 site roles, 7 road roles, 6 material flows, 6 elder habitat slots and temporal rules, source states (not positions)
- `SOH_WORLD_FORMATION_QA_V1.json`: negative source audit and **11 design-schema consistency checks PASS**; NOT geography, gameplay, hydrology, pixel art or native acceptance
- `SOH_WORLD_FORMATION_LAB_STANDALONE.html`: local OFFLINE interactive four-view causal graph; click POIs and examine causes/inputs/outputs/collapse/gameplay. THIS IS AN ABSTRACT GRAPH, not another map with arbitrary POI positions.
- `build_formation_v1.py`: reproduces the JSON, MD, HTML and ZIP.
- Real ZIP exact current-chat path `/mnt/data/SOH_WORLD_FORMATION_BIBLE_V1_20261101.zip`, `SHA256 bbb7a9c903369738a41546c835655ff41988a86ba534aeb7d77966c5fb86664d`. ZIP test and JS syntax checked. Browser screenshot/visual acceptance NOT claimed. Do not tell Arena it already sees this ZIP or the private art files.

## Next REAL stage
Use causal relationships to AUTHOR a fresh spatial terrain masterplan (source-to-mouth rivers, fault topography, natural harbor, old freight network, legitimate footprints), then check random physically eligible start/build points, travel/cargo/risk/three independent player journeys and six real boss territories. User visually reviews that physical paper plan. ONLY THEN audit 42–43 private CraftPix ZIPs and prepare exact asset-source/rect BOM, THEN send bounded map-agent production prompt and native Godot 4.7 eye-reviewed acceptance. No owner/PR/production geography/Gold/A0 changes or Arena dispatch performed by this research.
