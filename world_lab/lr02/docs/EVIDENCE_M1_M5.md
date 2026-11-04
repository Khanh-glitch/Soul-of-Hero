# MAP-LR02 evidence M1–M5 (factual, reproducible)

Run `cd world_lab/lr02 && ./reproduce.sh`. Parent LR01 body digest `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`; M0 published digest `db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a`. All numbers below come from generated packages, not from estimates.

## M1 — full-world portal geometry
- POIs `81`; verdicts `63 VERIFIED + 18 VERIFIED_WITH_EXCEPTIONS + 0 FAIL`; 463 clipped solid spans, 169 static openings.
- Enclosure classes: 26 open yards, 26 partial clusters, 29 full enclosures. All 18 exceptions are `VERTICAL_LINK_HAS_NO_PHYSICAL_OPENING` (canonical deep/vertical links unresolved), not fabricated holes.
- Spatial tests `1004/1004` applicable, 130 `NOT_APPLICABLE` open-yard tests, `8/8` injected negatives. `EXACT_COVERAGE` wall clipping; physical BFS agrees with graph BFS; LOS through gap vs solid.
- Adapter consistency verified for entrance, circulation, roof, retreat, collision and sight.
- Diagnostic U=1.6 / U=2.0 fits only; no approved scale.

## M2 — eligibility and build envelopes
- `5151/15077` (`0.3416`) statically eligible cells; 16 candidate regions, 3 landmasses (`ld_veyra`, `ld_saltwick`, `ld_ironholm`), 18 zones; 9,926 rejected cells with reason histogram; 40 small components discarded.
- Bounded Greywater AREA `se.greywater_bounded.v1`: 107 × 8au cells = 6,848 au², window `[680,550,900,660]`. `cellIndices` are authoritative, not a point. `sp_*` are provenance landmarks only.
- 23 build-site envelopes: 14 `VERIFIED_GEOMETRIC_ENVELOPE`, 9 `PARTIAL_WATER_OVERLAP__DRY_SUBSET_REQUIRED` (including `site.bz_greywater`). `occupancyStatus=UNKNOWN`, `sweptClearanceStatus=UNKNOWN`, claims Gameplay-owned.
- Status `DERIVED_STATIC_ELIGIBILITY__NOT_RUNTIME_SPAWN_AUTHORITY`. No runtime spawn point/compound/house/shelter/crate/beacon/cleared corridor/creature-free distance.

## M3 — broader physical architecture
- `[732,652]` cell 20341: `clearanceCells=0`, `waterClass=3`, `roadClass=1`, `elderGeometryId=3` (`el_aion`). `br_4` bearing `1.132195670812087` rad, proposed span 24 au, conservative proposed width 24 au (measured lateral dry land 64/72 au). `vehiclePassable=null`, swept clearance `UNKNOWN`, `cartPassable=false`. No canonical width.
- Disconnected roads 7: `rd_w`, `rd_1n`, `rd_1p`, `rd_22`, `rd_25`, `rd_28`, `rd_2a`. Three FALSE DISCONNECTS with coincident endpoints (`rd_22/rd_8`, `rd_25/rd_2i`, `rd_28/rd_0` at 0 au). 13 flagged false joins; 5 unbridged crossings; 12 bridges `cartPassable:false`; 8 ferries `BLOCKED`.
- `po_kilns`: nearest cart `rd_n` 57.1604 au to authored vertices (LR01 smoothed-node 56.8792 au), nearest foot/trail `rd_16` 0 au. `ALT-A` proposed connector and `ALT-B` foot-only both preserved; decision `UNDECIDED`.
- 27 dock approaches (15 within editor ACCESS_R=48), 23 loading envelopes, 24 archetype access patterns, 23 build-area suitability rows across 8 candidate regions.
- 6 representative regions: `zone_bz_hook` COAST, `land_ld_saltwick` ISLAND, `zone_bz_delta` WETLAND, `zone_bz_slag` INDUSTRIAL, `elder_el_typhon` ELDER_TERRITORY, `land_ld_ironholm` ISLAND — each with real raster, canonical vectors, POI geometry, loading/approach/choke proposals and unresolved owners.

## M3b — region static export (answers PR44 6620503177)
- 16-region `cellIndices` export via pinned `spawn_eligibility.v1.json` digest `637dd4e8706133773d1fe58643b74386a3832f7acbe5d00b5ec91ecc7a1573fc`; per-region digests for drift detection; no duplicate source of truth.
- 7 region static views, 28 POI records, 175 solids, 63 openings, exact ID mappings, collision/LOS adapters.
- Roof polygons `UNRESOLVED__NO_AUTHORED_ROOF_POLYGONS_IN_LR01`; LR01 stores only coverage descriptors. No invented canopy, no landmark swap.

## M4 — visual production
- Real `640×360` Web screenshots (class 1) preserved byte-for-byte from Gameplay HEAD `240db32a1a69211f87af161796498b82afcde20e`: `select-veyra-greywater-u16-640.png`, `start-veyra-greywater-u16-640.png`, `walk-veyra-greywater-u16-640.png`, `select-veyra-greywater-u20-640.png`, `start-veyra-greywater-u20-640.png`, `walk-veyra-greywater-u20-640.png`. Inspected: pixel trees, terrain variation, blue water with wave lines, HUD, native pixel readability.
- Web art provenance: `web/THIRD_PARTY.md` ("No third-party sprites, tiles or sound files are used"), `art.ts` (original pixel-by-pixel sprites, `OUT='#140c14'`), `render.ts` (`PAL`/`texel`/`renderChunk`/`draw()` shore glints). Assessed and NOT adopted: `cainos_demo`, `dungeon_0x72`, `ocean_cainos`, NinjaAdventure, Kenney, simplex-noise, easystar, idb, A1/MAP-R01/`web_art_patch`.
- 6 portable `640×360` transparent SVG static-wall layers painted with exact Web `T.PWALL` colours, pixel-snapped, `crispEdges`, with real door jambs at static openings; no grid/tint/arrow/label.
- 6 genuine `640×360` before/after pairs for Greywater and 5 distinct regions. Both sides are class (2) `MAP_ONLY_ANALYTICAL_PREVIEW`; LR01 debug header removed; terrain, hard-edged transitions, sparse large wave motifs and authored roads retained. Class (3) `ACTUAL_WEB_RENDERED_INTEGRATION_PROOF` is `NOT_AVAILABLE__GAMEPLAY_OWNED` — no preview is labelled Web-rendered.
- Images actually inspected: `zone_bz_greywater_before/after_640x360.png` (clipped wall spans + gaps appear only in after), `zone_bz_hook_after_640x360.png` (wave motifs preserved), real `start-veyra-greywater-u16-640.png`, `walk-veyra-greywater-u20-640.png`, `select-veyra-greywater-u16-640.png`.
- No new external asset, no noisy procedural grass, no generic polygon fill, no decorative debug overlay, no invented roof.
- Gameplay's own Web-rendered evidence (`poi-inside-640.png`, `poi-outside-640.png`, Oasis windows at `bfbf44df9ebf403290dce45ff197327947762e8e`) is Gameplay-owned proof of its M0/M2 diagnostic intake, **not** proof that the M4 SVG layers or M1/M3/M3b geometry were rendered in Web.

## M5 — source-preserving v2
- `geography_package.v2.json` digest `e3ba6d298fe2872cf5a39b2e3e8cc8704f54c5582f15cff49e2aacffdd20b3e7`; embeds full LR01 v1 package verbatim (`parentPackage`) with raw SHA `b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad` and re-verified body digest `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`.
- `resource_inputs.v1.json` `fad1de9a960600146e6d96478ad9e5dcf752a63522acd6fff0903b936bcbde59`: 21 GEO-01 rasters, 12-code biome legend, width semantics (physical channel width UNDEFINED), 280 authored habitat markers — INPUTS only, no resource population/stock/loot/starter kit.
- `population_inputs.v1.json` `9c1d61bfd1a82948d198a2387c7247a8e9c1f4e78036d294c7e945d16a15a478`: bounded areas + static geometry only; explicitly `NOT_POPULATION_AUTHORITY`.
- Docs: `GAMEPLAY_HANDOFF.md`, `MILESTONE_M4_VISUAL.md`, this file.

## Still not claimed
- NO playable Veyra or final world
- NO creator visual approval
- NO approved au-to-tile/px scale or canonical rewrite
- NO runtime spawn coordinate or spawn compound
- NO house/shelter/crate/beacon/cleared corridor/starter resources
- NO occupancy, claim, hazard, creature-free-distance or actor-separation verdict
- NO invented roof/canopy polygon
- NO invented canopy coverage
- NO approved physical road/river/bridge width or swept clearance
- NO cart-passable road/bridge/ferry verdict or approved boat rule
- NO forced land bridge
- NO Gameplay implementation command
- NO Web-rendered integration proof
- NO third-party or unverified art pack
