# 02 — ALL-VEYRA HUMAN ECOLOGY, SOURCES, POPULATION, AND 336-HOUR SUSTAINABILITY
**Baseline gate: BLOCKED; 81-POI runtime budget is a negative diagnostic, not a certification.**
Read Survivor Contract §§24.2–24.3, 25.7–25.8, 28–30, 37–38. Preserve protected G1B, W06/B05 and earlier PLAYER_EXPLORATION caches. Applicable code: npc-census.ts, engine.ts seedHumanWorld, humanworld.ts seedPopulation/rosterFor/communityStock/usingHumanBed/tickNeeds/humanConsume/humanHarvest/planAutonomousWork, human-shelter.ts, human-navigation.ts, Veyra floors and actual source APIs.

## A. KNOWN BASELINE — SOURCE AND BUDGET
81 registered POIs are geography classification inputs, NOT 81 mandatory inhabited settlements. 286 generated humans were seeded by rosterFor(class,rooms), with 20 physically registered authored bed_straw slots, 266 not assigned slots. communityStock(class,rooms) injects finite starting goods into community store container but is NOT an independently validated 336h location-sourced inventory. Audit at web/evidence/npc-integration/20261116-final-integration/runtime-81-poi-budget.csv reports opening shortfalls ~373600 hunger points and ~540240 thirst points without certified production/imports. These are initial stock-vs-needs arithmetic, NOT proven future unavoidable deaths, nor proof that all actors need permanent beds at current POI.
The existing water-bank work finds physically potable water in a local catchment, walks and drinks over two seconds, refills an already existing container; this does NOT prove global accessible water for every remote human. Current shared-harvest fallback in planAutonomousWork is explicitly active-window only. Medicine/Guard and profession loops depend on actual station/stock availability.

## B. FULL 81-POI CENSUS — MAKE MACHINE-READABLE AND HUMAN-AUDITABLE
Do not create residents just to hit POI quotas. For EACH of the 81 actual source POI IDs generate one record:
- poiId/name/class, region, authored geometry reference and exact compiler/layout revision, accessible ground/upper/basement floors, rooms/cells, roof and shelter, collision and real door/lock/card/power/PPE gates.
- Road/portal/stair entrances, connected region/route graph, hazard and Elder reach; show certifiable source-grounded walk times to potential food, water, shelter, work, evacuation. A POI icon does not prove route or usable water.
- Valid bed entity UID, floor, standable adjacent tile, healthy structure, owner, unique assigned claimant. Distinguish permanent residents, seasonal travelers, in-transit workers and temporary occupants; do not require on-site bed for travelers but DO require lawful rest and exposure consequences.
- Every human with runId/actorId/sourceId/starting region/source, living state, occupation, profile, gear/pack ownership, bed/home, physical global cell/floor, expected route and lifetime conditions. Finite arrivals source/entry/timing and no auto replacement of deceased specialists.
- Real potable nodes, safe approach tiles, current vessel/charge capacity, extraction/refill authority, source renewal law, obstruction/PPE; rivers/sea/ice or upstairs decoration must not be silently potable.
- All food sources: finite store container + authoritative origin, explicit source stock, natural regrowth/crop plots/animal output, recipes/tools/stations/fuel, import links with transport capacity, and depletions. Source anchor and ownership must be verifiable at game runtime.
- Workstations (real entity UID, station type, fuel/power/recipe access), protected player caches, distinct regional salvage stock and jobs.
- Two-sided trade/supply routes, sender receiver, cargo UID/quantity, paid carrier time, shipping loss/blocked events, migration source and route. No teleport import.
- Risk/defense supply/medical and Elder final-period contact coverage, updated when systems become real.
Mark evidence status separately per field: VERIFIED_PHYSICAL / VERIFIED_RUNTIME / SOURCE_AUTHORED_UNVERIFIED / NOT_IMPLEMENTED / INACCESSIBLE / NOT_APPLICABLE. Never turn missing into zeros or pass by relabeling.

## C. FOUR ECONOMIC SOURCE CLASSES — EXCLUSIVE AND AUDITABLE
1. PLAYER_EXPLORATION: ALL old and G1B player-facing authored static caches, plus associated spawn/loot/refill authority. NPC autonomous actions cannot debit them under ANY classification alias, even if cache lies within a human community or shares a tile.
2. SHARED_HARVEST: actual natural mutable sources, growth and tool/terrain yield shared with player. Same sourceId and stock state; worker must reach correct global tile/floor and charge tool wear, time and extraction. Global source adapter must use same authority as local harvest; no separate NPC roll or remote regenerated copy.
3. REGIONAL_HUMAN_ECONOMY: independent physical bags/workshops/merchant/community stores, regional salvage props, abandoned carts/boats/machines with distinct physical source UID and finite authored initial stock, authorized producer outputs and lawful imports. Same property can be obtained by player with legitimate access/trade/theft. No starting arbitrary 'regional stock' whose physical anchor or provenance is only a text label.
4. SPECIAL_AUTHORITY: all Core/Field Core/rare/score/escrow/credentials. Preserve canonical sources and unique item/Core UIDs; no NPC-generated random Core on loot or death.
For ALL classes add sourceId→physical anchor/floor→owner/rights→stock→extraction action→receipt→UID transfers→regrowth/replenishment terms. Prevent a regional cache being double-counted as a G1B chest or an NPC inventory. Audit finite total rare material/Core issuance across 336h; no surprise faucet.

## D. GLOBAL SOURCE / CARGO TRANSACTIONS
Implement a single actor-aware adapter for global source discovery, reachability and execution:
1. Actor has bounded local/known evidence of a source; no omniscient island search.
2. Plan and persist physical route with legal stair/door/PPE/collision/time and capacity, distinguish SEARCH_PENDING/NO_PATH/DENIED.
3. At actual source contact re-read stock, access, tool UID/durability, extraction allowance and equipment; reserve/debit eligible stock atomically; record job/event UID; use canonical regrowth/delta authority. Competing player/NPC attempts cannot both claim the final stock.
4. Place same legal yield in carry pack/cart UID custody without granting player XP; if no room, block before debit or use safe exact rollback. No clone in source or temporary shadow bag.
5. Carry via real path to authorized store/consumer/station; if robber attacks or actor dies en route, cargo remains with the correct body/cart/corpse; no magical delivery.
6. At arrival confirm destination owner, open/space/floor, move exact UID; log receipt. Reload or repeated interval does not replay completion.
7. Offscreen regrowth uses same natural source clock and spatial conditions as visible world. A remote village is not guaranteed free yield merely because it is away from player.

## E. BED, WATER, FOOD AND HEALTH LAWS
- Existing authored bed props may become canonical bed_straw with owner/floor/approach, one living claimant, actual enclosed roof, and real access path. A chest is never a bed. Physical sleeping is one activity, mutually exclusive with traveling/guarding/working. Losing a bed may cause fatigue/migration, not actor deletion.
- Rest must follow the same active and global shelter topology and door state. Distinguish valid temporary shelter/overnight rest, no invisible full rest due to community membership.
- Food and water needs accrue per REAL hour, with working/fighting modifiers, physical consumption/refill and eventual harm. Starvation/drink thresholds and bleeding require exact event order; do not instantly kill an absent settlement on first login for unrecorded events.
- Water requires verified potable mask and legal human bank tile; an icon, well art, floor mismatch or salt/ice source is insufficient. Refill only an already owned valid vessel under charge/time rules. Player and humans draw from same physically available water when finite.
- Medic and patient use real medicine stock and treatment duration; clothing/PPE, shelter and hazards can affect needs legally, not fixed invisible bonus.
- Supply scarcity is legitimate gameplay. Communities may ration, work, trade, move, decline or die, with actual outcomes. No guarantee every inhabitant survives to h336 and no forced total self-sufficiency at every POI.

## F. FINITE HUMAN ORIGINS AND POPULATION CAPACITY
Derive credible initial population and subsequent arrivals from eligible standing/habitable/camp/travel spaces, finite source and real access. 286 is neither minimum nor maximum. DO NOT delete masses just to make benches/supplies sufficient or optimize frame rate; if real authored capacity supports fewer permanent residents, classify transient populations with finite arrival origin, route, shelter and support, or document a real adjustment in the engine world-authored data without counterfeit content. A person cannot automatically respawn/reappear when a window loads or village loses a profession. Arrival is a source-debited/person-unique event with route and timestamp; out-migration is a physical route event; source stocks and people follow one life history.

## G. 336-HOUR BUDGET FORMALISM
For each occupied community and each necessary good, track:
opening authorized physical stock + accessible timed harvest/production + confirmed imports − consumption − exports − spoilage/loss − construction/medicine/fuel costs = accessible closing stock.
Every term must map to exact sources/events and time; balance cannot count unreachable/locked sources or failed future imports. Include upper/lower scenarios of drought, blocked road, damaged station, killed worker, player theft and rescue. The human cost ledger uses actual hours, current need bars, work modifiers and real activity. A deficit can be an accurate failure-state only if event simulation shows what humans do in response. Capacity includes beds, rest/shelter, routes, reachable stations and contamination/threat, not a single beds/POI multiplier.
Provide per-POI numeric output, uncertainty/blocked reason and globally reconciled sum; totals must not double count goods traveling between communities. Keep both opening-stock budget and dynamic 336h event-output budget; the first alone cannot certify success.

## H. CONCRETE NEGATIVE/END-TO-END TESTS
E01 no NPC autonomous debit of any G1B/legacy PLAYER_EXPLORATION cache over 1/24/336h; player source states unchanged even after same-tile human interaction.
E02 two workers and player race on one natural source with stock=1: exactly one lawful claim and one output, same after reload.
E03 cross-window/floor actual source from genuine Veyra geom: load, harvest, exhausted source, deliver offscreen, return to inspect same depleted state and held UID.
E04 20 originally registered bed slots, unique owners and physically reached restful occupants; 266 unassigned at baseline are NOT awarded phantom rest; show lawful transient/supply response.
E05 water: real potable bank, salt/ice denial, wrong floor denial, distant drink after real route, blocked door, vessel capacity, no duplicate refill.
E06 intercommunity cargo via documented road, actual carrying capacity, arrival/loss, interrupted delivery and save during transit; no instant import.
E07 actual shortages and medical loss; guard removed changes community defense; no replacement spawn; finite arrival after real schedule.
E08 dynamic 336h ledger snapshots at 8/24/48/264/312/336h, balancing production, imports and consumption with documented natural ecology. Make no unsupported “all survived” claims.
E09 New Game and legacy loaded save: no retroactive stock/person mint, migration stable over two reloads; run 2 cleans entities and custody.
**DONE:** not when the census script returns 81 rows; only when every occupied source is classified with physical causes, global economic pathways work and shortages/survival are actual outcomes under 336h.