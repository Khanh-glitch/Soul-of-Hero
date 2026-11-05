# WMP-04R1 pilot asset inventory — KEEP / REWORK / PROVEN MISSING

Evidence: real 640×360 Chromium screenshots in `evidence/shots/`, runtime inspection in
`evidence/qa-report.json`, exhaustive sprite/catalog search in Gameplay `f8fcde91`.

## KEEP (existing SOH art that performs better; preserved untouched)

| Asset / behaviour | Where proven | Why kept |
|---|---|---|
| Original `shipping_fresh` forest/coast, trees, water waves, HUD, quickbar, day/night lighting | `COMPARE_baseline_original_vs_pilot.png`; `01_AFTER_wmp04r1-baseline-forest_{day,night}.png` | Identical terrain, coast, forest density, HUD and pixel-art coherence between untouched Gameplay build and pilot scene 1. Only seed-dependent weather/creature positions differ — no visual degradation. |
| `T.SNOW` speckled snow palette + `snowpine`/`pine` sprites + rock boulders | `02_AFTER_wmp04r1-snow-highlands_day.png` | Snow is clearly readable against green meadow/forest; snow-pine identity is preserved; no new snow tileset needed. |
| `T.SAND` desert palette, palm trees, scrub tufts, pebble/rock sprites | `03_AFTER_wmp04r1-oasis-corridor_day.png` | Arid ground, coast and authored road band are legible; existing desert art is better than any generated substitute. |
| `T.ASH`/volcanic dark ground, dead-tree sprites, shore water waves, beach strip | `04_AFTER_wmp04r1-cinder-shore_day.png` | Water boundary is crisp; geographic danger is readable as terrain, not invented damage. |
| `T.DEEP` open-ocean waves and authored `Beacon Rock Light` POI label | `05_AFTER_wmp04r1-deathwater-beacon_day.png` | Marine domain reads as open water; landmark location is shown without fabricating a helicopter. |
| `T.HILL` brown palette reused for `scrub_dry_steppe` | `COMPARE_wmp04r1-dry-transition.png` | Reusing an EXISTING SOH palette distinguishes dry steppe from green meadow and pale desert without authorising a production atlas. |
| Authored GOLD polygons / centrelines for coast, lakes, rivers, roads, POI footprints | `web-pilot/src/game/veyra/projection.ts` | No coastline/water/building/portal/road was replaced by a lower-resolution raster square. |
| Original camera, character, WASD/controller input, `qaAdvance` day/night clock, weather, save/load | `evidence/qa-report.json` (journey, straight journey, save reload) | All verified functional; 233/233 pinned Gameplay tests pass on both trees. |

## REWORK (works, but needs an owner decision before production)

| Item | Evidence | Owner | Why |
|---|---|---|---|
| WMP-03 `cliffCandidate` faces render as **flat, blocky dark-grey rectangles** rather than vertical cliff faces | snow/cinder day shots; tiles sampled as `T.CLIFF` (tile id 8) | GAMEPLAY art + WMP-03 geometry intake | Height/cliff composition is the weakest visual element. 8 AU analytical cells become ~4×4 tile blocks at U=2. Do not cover with random props; needs a real cliff/height presentation decision. **No new tileset authorised.** |
| HUD pilot annotation is dense at 640×360 and can overlap the POI "Discovered" banner | `05_..._deathwater-beacon_day.png`, `04_..._cinder-shore_day.png` | PILOT (cosmetic, non-geographic) | Readable but crowded; a creator-facing layout pass is advisable. It is QA text, not SOH art. |
| `T.CLIFF` is used both for the world boundary and for WMP-03 connected cliff faces | `projection.ts` | GAMEPLAY | Same palette and collision class; a dedicated cliff presentation would improve material readability. |
| Scene 3 (Oasis) and scene 5 (Deathwater) show **zero WMP-04R1 biome delta** at their canonical origins | `COMPARE_wmp04r1-oasis-corridor.png`, `COMPARE_wmp04r1-deathwater-beacon.png`, `map-data/GENERATED_META.json` `sceneStats` | MAP / Control Tower (scene-placement decision) | WMP-04R1 changed 3,884 analytical cells: 3,094 → snow, 790 → scrub dry steppe. None fall in those two windows. The pilot proves the real dry delta with a separate QA diagnostic pair instead of faking a difference. A future creator-facing scene list may relocate those two windows. |
| `buildable` is a Map zone **candidate** but the existing Web `buildReason()` consumes it as a placement gate | `web-pilot/src/game/engine.ts` (`buildReason`), `world-economy.ts` | **GAMEPLAY** | Semantic status must not silently become gameplay permission. Preserved unchanged from `f8fcde91`; not resolved by this pilot. |
| POI entrance/door behaviour is not instantiated in the existing Web Veyra projection (`statics=[]`, `buildings=[]`, `entities=0`) | `evidence/qa-report.json` `inspect` for all 10 WMP scenes | **GAMEPLAY** | Genuine sea/cliff collision is proven; POI entrance/frontage collision cannot be validated here. WMP-03 surveyed 55 exterior entrances, but static architecture runtime ingestion is a Gameplay dependency. |

## PROVEN MISSING (reported honestly, not substituted)

| Item | Exhaustive evidence | Owner |
|---|---|---|
| **Stranded helicopter scene object** `poi_beacon_engine_out_helicopter` at AU `[272,652]` | `map-data/marine_sites.v4.json` declares `kind: stranded_helicopter`, `physicalState: GROUND_STATIONARY__ENGINE_FAILED`, `gameplayOwnership: … Gameplay machines/vehicles`. `git grep -in "helicopter\|helipad\|chopper\|rotor\|rotorcraft\|aircraft" f8fcde91 -- .` finds **no runtime sprite, entity, structure or machine**: only `web/ref/bible.md` (lore) and a binary reference prototype zip. Existing `S.wreck` / `SOURCES.wreck` is a **Car Wreck** (32×20, 2 variants); `roof_hull` is a ship hull. Substituting either would fabricate the landmark, so none was placed. Scene 5 shows the exact location + `Beacon Rock Light` authored POI + HUD `OBJECT PROVEN MISSING`. | **GAMEPLAY machines/vehicles**, with A0/A3 unique-item custody and A8 interaction |
| Boat / swim / ferry foot traversal on open water | `map-data/marine_navigation.v4.json`: `footOnSea = FORBIDDEN; cargoPassable on sea likewise false`; `api/current.mjs`: `footPassableOnSea=false`, `boatOrSwimPermission=UNRESOLVED_GAMEPLAY`, `activeCollisionPermission=false`. Runtime: `walkableWater=0`, `cargoWater=0`, `buildableWater=0`, `roadOnWater=0` in all 10 WMP scenes; real sea-collision probe walked 47.1 px and stopped before the water boundary with `seaSamples=0`. | **GAMEPLAY** (nav/collision law), WMP-03 `approvedTraversal.status=UNKNOWN` |
| Western Depths Leviathan AI / spawn | `marine_sites.v4.json`: `spawnAndAiOwner: GAMEPLAY`, `ONE_UNIQUE_WORLD_ENTITY_REQUESTED`, `lootRewards: UNDECIDED`. No creature was added. | **GAMEPLAY** + A0 |
| Helicopter flight / repair / flight-log recovery / salvage loot | `repairFlightStatus: NOT_APPROVED`, `noStartingLootGrant: true`, `interactionCandidate` only. | **GAMEPLAY** |
| Production atlas / new tileset / human art approval | `CURRENT_WORLD_MASTER.json`: `productionAtlas=NOT_AUTHORIZED`, `creatorVisualApproval=NOT_REQUESTED`, `BASE_GAME_ART_PRESERVED__NO_NEW_TILESET_SELECTED`. | **Control Tower / creator** |
| Numeric geothermal temperature, damage rate, weather damage, snow cold damage | `marine_sites.v4.json`: `numericTemperature: UNRESOLVED_GAMEPLAY`; `coldTransition` is a 0..3 **class**, never °C or a rate. | **GAMEPLAY** |
| Full Gameplay semantic validator (`validateGeographicHandoff`, `validateEconomyMap`, `compileEconomy`, `diagnoseStarts`, `approvedTraversal`) | `api/current.mjs`: `candidateEconomyMap.status = CANDIDATE_ONLY__NEEDS_GAMEPLAY_REVIEW`. WMP-03 recorded `gameplayValidatorsExecuted=false`. | **GAMEPLAY** (intake review) |

## Not created / not claimed

No boat, Leviathan AI, helicopter flight, loot site, fixed spawn reward, player-owned
structure, new POI, new tileset, canonical relocation, Gameplay runtime authority
change, numeric authority, world-master sealing, `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`
or `MERGE_READY`. No merge, no production integration, no human art approval.
