# MAP → Gameplay | MAP-LR02 final handoff (M0–M5)

**Creator rule:** MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.
**Branch:** `arena/2e3cfbd2-soul-of-hero` · **PR44:** OPEN / DRAFT / HOLD, base `arena/4795760e-soul-of-hero`, no merge.
**LR01 v1 is pinned and untouched:** F deliverable `7651ff0baa4ec136170bcf1cdf8ecf16fe9a2df9`, metadata HEAD `74062a5baf2731451fad9638c4243c7459ce8e24`, body digest `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`, whole-package SHA `ac9317ae385d47327f02765e4b2e8ca8465c504f3c7146737ab3ff9b91952eb4`, raw SHA `b4cc77228caf847d1ad0d8a680457ca65731202513a047826e8bd973662e19ad`.
**M0 rev1 is immutable:** `db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a` / raw `2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78`. `reproduce.sh` VERIFIES it; the generator's default `GUARD` exits 2 rather than overwriting.

## Exact reproducible command

```
cd world_lab/lr02 && ./reproduce.sh     # EXIT=0
```

Gates: `M0_VERIFY_OK`, `M1_PORTAL_GEOMETRY_OK`, `M2_SPAWN_ELIGIBILITY_OK`, `M3_ARCHITECTURE_OK`, `M3B_REGION_STATIC_OK`, `M4_VISUAL_OK`, `M5_PACKAGE_OK`, `LR02_TESTS 46/46`, `LR02_REPRODUCE_OK`.

## Package index (digest = SHA-256 of JSON.stringify(body) after removing revisionDigest/digestMethod)

| File | Schema | revisionDigest |
| --- | --- | --- |
| `world_lab/lr02/output/greywater_spatial_patch.v1.json` | `soh.map.lr02.greywater_spatial_patch.v1` | `db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a` |
| `world_lab/lr02/output/portal_geometry.v1.json` | `soh.map.lr02.portal_geometry.v1` | `5888572471fecf15a86f056b0179c98043cabe2f0a84808768ed155c736a02b7` |
| `world_lab/lr02/output/spawn_eligibility.v1.json` | `soh.map.lr02.spawn_eligibility.v1` | `637dd4e8706133773d1fe58643b74386a3832f7acbe5d00b5ec91ecc7a1573fc` |
| `world_lab/lr02/output/world_architecture.v1.json` | `soh.map.lr02.world_architecture.v1` | `b909a6227fa69991ffb57d1b011ae4f797d1b113e2441bd3277f00c50fc070ea` |
| `world_lab/lr02/output/region_static_geometry.v1.json` | `soh.map.lr02.region_static_geometry.v1` | `b13dd27578067b9cae2db3d3cb5421fdf6157460d62d853304fd411abbae8734` |
| `world_lab/lr02/output/visual/visual_layers.v1.json` | `soh.map.lr02.visual_layers.v1` | raw `2488b87a13880fe5c8d0cafa17e2aaad857b21a737aec0b8e5ef010498340eb8` |
| `world_lab/lr02/output/resource_inputs.v1.json` | `soh.map.lr02.resource_inputs.v1` | `fad1de9a960600146e6d96478ad9e5dcf752a63522acd6fff0903b936bcbde59` |
| `world_lab/lr02/output/population_inputs.v1.json` | `soh.map.lr02.population_inputs.v1` | `9c1d61bfd1a82948d198a2387c7247a8e9c1f4e78036d294c7e945d16a15a478` |
| `world_lab/lr02/output/geography_package.v2.json` | `soh.map.lr02.geography_package.v2` | `2f292bcdafd38d9c64ac0fa402b902023daa97cfd57f140e9eb6e2fc3fc84ce1` |

`geography_package.v2.json` embeds the COMPLETE LR01 v1 package verbatim in `parentPackage`; every LR02 addition is in the separate `lr02` namespace. No LR01 byte was rewritten.

## What Map delivered (ready)

- **M1** all 81 POIs: 63 `VERIFIED` + 18 `VERIFIED_WITH_EXCEPTIONS`, **0 FAIL**, 463 clipped solids, 169 static openings, `1004/1004` spatial tests, `8/8` negatives, `EXACT_COVERAGE` ID mappings, adapter consistency.
- **M2** `5151/15077` statically eligible cells, 16 candidate regions with full `cellIndices`, 3 landmasses, 18 zones, 23 build-site envelopes (14 verified / 9 water-overlap requiring dry subset). Status: `DERIVED_STATIC_ELIGIBILITY__NOT_RUNTIME_SPAWN_AUTHORITY`.
- **M3** measured `[732,652]` zero-clearance `br_4`/`rd_b` approach (Elder `el_aion` overlap), PROPOSED non-canonical deck, 7 disconnected roads (3 FALSE DISCONNECTS with coincident endpoints), 13 flagged false joins, 5 unbridged crossings, 27 dock approaches, `po_kilns` two preserved alternatives with `UNDECIDED` decision, 23 build-area suitability rows, 6 real representative regions.
- **M3b** versioned source-linked `cellIndices` export (answer to PR44 `6620503177`) and 7 region static-geometry views (28 POI records, 175 solids, 63 openings). **Roof polygons explicitly UNRESOLVED** — no invented canopy, no landmark substitution.
- **M4** 6 unmodified real `640×360` Web screenshots preserved as class (1); 6 portable static-wall SVG art layers in the exact Web `T.PWALL` palette; 6 genuine `640×360` before/after pairs, both explicitly class (2) Map-only analytical previews; layer order and integration instructions. Class (3) actual Web-rendered integration proof is `NOT_AVAILABLE__GAMEPLAY_OWNED`.
- **M5** source-preserving v2 package, terrain/resource INPUTS (21 GEO-01 rasters + 280 authored habitat markers, no resource population), population INPUT envelopes (no spawn, no actors, no occupancy), and this handoff.

## Compatibility matrix (read-only observation of Gameplay HEAD `240db32a1a69211f87af161796498b82afcde20e`)

| ID | Seam | Observed | Map position | Status |
| --- | --- | --- | --- | --- |
| CMP-01 | schema pin | intake.ts strictly pins LR01 v1 schema/revision/packageId/stage and whole-package SHA | v2 is a SEPARATE reviewed package; no silent v1 pin rewrite | `NEW_PIN_REQUIRED` |
| CMP-02 | coordinate origin | originAu [640,440]; frameAu [2000,1400]; cell-centre-v1 | authoring units unchanged; transform UNDECIDED | `DIAGNOSTIC` |
| CMP-03 | static collision seam | projectVeyra() still returns statics:[] at the committed head | M1/M0 supply clipped solids + static holes with exact ID mapping | `OPEN` |
| CMP-04 | status crosswalk | Map VERIFIED is geometric proof only, never playable acceptance | [object Object] | `PROVIDED` |
| CMP-05 | spawn reader | no reader of cellIndices in committed Web code; chooseLegalSpawn uses runtime-only eligibility | M2 contract SEEDED_RANDOM_LEGAL_POSITION_SAMPLING; Map supplies areas, Gameplay samples | `OPEN` |
| CMP-06 | diagnostic scale | U=1.6 and U=2.0 same-origin projections; 9au analytical stroke | no au-to-tile/px scale approved | `DIAGNOSTIC_ONLY` |
| CMP-07 | road/water width | editor stroke widths; SNAP_TOL/ACCESS_R are graph heuristics | physical channel width UNDEFINED; br_4 PROPOSED deck is non-canonical | `UNRESOLVED` |
| CMP-08 | roof/canopy polygons | Gameplay requested future region-specific roof polygons; no invented canopy | roof polygons explicitly UNRESOLVED; LR01 has coverage descriptors only | `UNRESOLVED` |
| CMP-09 | visual layers | Web art is original pixel art; no third-party sprites | M4 portable SVG static-wall layers + layer order; class-3 Web integration proof NOT_AVAILABLE | `METHOD_PROVIDED` |
| CMP-10 | Gameplay ACK | PR44 6620503177 independently verified M0 raw SHA 2a9cfcc4… and body digest db5bcc3d… | M0 rev1 immutable; reproduce.sh verifies instead of rewriting | `ACKNOWLEDGED` |

Observed Gameplay facts (no Gameplay file modified):
- chooseLegalSpawn() uses runtime-only eligibility (full 200x200 walkable grid, real collision, hazards, local source reachability) with seeded non-repeating traversal; randomSpawn:true.
- shipping_fresh / dev_delta_fresh remove fixed starter shelters, crates and start roads; historical shipping snapshot and mapDigest fingerprints remain loadable.
- clearWallLine() now blocks through-wall build/repair/upgrade/device access; contact access still allowed.
- projectVeyra() at the committed head returns statics:[]; no LR02 package reader was found in the committed Web tree.
- 10 tested seeds per scale, 6/6 proposed Greywater room traversal at U=1.6/2.0 and negative solid LOS were reported by Gameplay as work in progress, NOT as committed integration proof.

Status crosswalk: `VERIFIED → VALIDATED` (Map geometric proof only), `UNKNOWN → UNDECIDED`, `INVALID → BLOCKED`. Map `VERIFIED` is NEVER playable acceptance.

## What remains unverified (Gameplay-owned / joint)

Committed Web ingestion of the new package schemas and SHA pins; runtime static collision seam; approved au→tile transform; real roof/canopy polygons; dynamic doors/locks/power/destruction; seeded final legal spawn and K6 persistence; compiled local resource and paid structure in Veyra; playable traversal from exterior portal into another room; native `640×360` creator visual acceptance and perf; occupancy/claims/hazards/actor separation; Gameplay implementation command. **No playable Veyra, no final world, no creator approval.**

PR44 comments: F `6619191264`, K6 `6619188131`, joint `6619478477`, Map ACK `6619637224`, GAME-LR02 `6619873863`, M0 `6620427232`, Gameplay M0b intake `6620503177`, M1–M3b `6620589329`.

Evidence: `docs/EVIDENCE_M1_M5.md`, `docs/MILESTONE_M4_VISUAL.md`.
