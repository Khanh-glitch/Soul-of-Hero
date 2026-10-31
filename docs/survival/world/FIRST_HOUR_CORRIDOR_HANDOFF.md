# A1 first-hour roadside corridor handoff

Status: **SOURCE VERIFIED / LOCAL 101 TESTS PASS / CI NATIVE PENDING / NOT PRODUCTION PLAYABLE**  
Branch: `arena/e385312a-soul-of-hero` · PR #20 · implementation checkpoint follows this document's commit.

## What the player gets

One bounded, revisitable supply loop off the existing canonical postern road in `r_ashen_crown`, inside the already-approved one-chunk connector annex `chunk:6:3`:

`Refuge -> existing safe approach -> postern (392,200) -> three physical roadside crates -> Ashen Waystation locker/cache -> existing retreat lane -> postern`.

This is not a new POI, not a teleport, and not a continent redesign. It uses three already-authored `src_crown_salvage` resource nodes and the existing canonical Waystation cache. The other three authored salvage nodes remain contract-only and were not deleted.

## Durable identity chain

Authority: `data/survival/world/corridor/crown_roadside.corridor.v1.json`.

| physical instance_id | source_class_id | region_id | cell | stand | canonical A1 POI identity | existing resource node |
|---|---|---|---:|---:|---|---|
| `si:r_ashen_crown:roadside_supply:01` | `sc_roadside_supply_cache_v1` | `r_ashen_crown` | `(395,219)` | `(395,220)` | `null` — non-POI roadside object | `res:src_crown_salvage:05` |
| `si:r_ashen_crown:roadside_supply:02` | `sc_roadside_supply_cache_v1` | `r_ashen_crown` | `(400,216)` | `(400,217)` | `null` — non-POI roadside object | `res:src_crown_salvage:03` |
| `si:r_ashen_crown:roadside_supply:03` | `sc_roadside_supply_cache_v1` | `r_ashen_crown` | `(402,220)` | `(402,221)` | `null` — non-POI roadside object | `res:src_crown_salvage:01` |
| `si:r_ashen_crown:waystation_cache:01` | `sc_waystation_timed_cache_v1` | `r_ashen_crown` | `(406,203)` | `(406,202)` | `poi_crown_waystation` / `node_waystation_cache` / `cache_restock` | canonical slice object |

A source class is a reusable supply vocabulary, **not** a POI. The three roadside instances share one class but have distinct durable instance IDs and physical bodies. The Waystation cache is a separate class/instance bound to the canonical POI action; its existing reward/cooldown lock is untouched.

## A3 alignment without A1 economics

A3 PR #19 category `poi:roadside_cache` and records `road_scrap`, `road_supplies` are referenced as provenance. A3's `opening_marches` is treated as an economy proposal alias, **split** from A1 canonical region `r_ashen_crown`.

For the three roadside instances A1 deliberately authors:

- `reward_items = null`
- `yield_per_claim = null`
- `replenishment_seconds = null`
- no drop rate, weight, chance, or loot-table ID
- `economy_binding.status = PENDING_A3_INSTANCE_BINDING`

A3 must bind each `si:*` instance to approved source records/loot tables and atomic receipts. A0 must not grant loot merely because the native fixture reaches a stand. The canonical Waystation `cache_restock` remains the existing slice reward lock: 3 `iron_scrap` + 2 `knowledge_spares`, 1800 s, owned by A0/A3 production integration.

## Physical route, collision and revisitation

- Outbound authored cells: 77 required nav cells including stands; return lane reuses the existing Waystation retreat to `(392,200)`.
- Every required cell is `walk=1`, `hazard=0`, not water, and clear of the real 12×16 Hero body against slice obstacles, container bodies, and solid decor lower-body boxes.
- Roadside crate collision: visual `camp_crate` 18×16, body 16×6 offset `(0,3)` from cell center. Exact south stand is 23 px from node center, inside 24 px interaction radius, with 1 px toe clearance.
- Adverse native proof: a full-tile 16×16 container body intersects the exact stand; the authored inset body does not.
- The route does not cross container bodies. The retreat lane avoids the crates, so revisitation is a physical walk back, not a reset.
- No hazard was disabled. No Hero resize, POI move, reward change, legacy-map replacement, or 192-chunk import.

## Art admission

The corridor uses the inherited original SOH atlas already consumed by `OverworldWorld`/`OverworldTiles`:

- terrain/road edges: existing `overworld_tiles.png` ground/detail masks; visible dirt-road spur `=` and pebble aprons `o`;
- containers: original `camp_crate`;
- landmark/dressing: original `signpost`, `cart`, `wall_stub`, `column_broken`, `tree_dead`, `bush`, `rock_a`, `rock_c`.

All selected frames are `license: original` in `data/overworld/art_manifest.json`. No generic colored box is used as final art. No new third-party art is imported by this checkpoint.

The 43 Craftpix packs remain admitted by CT D050 as candidates, but their ZIP bytes are not present in this Arena checkout and raw-art redistribution is forbidden. This checkpoint therefore does **not** claim Craftpix integration. Exact future minimal admissions are recorded in `RESEARCH_AND_LICENSES.md`: road/path 574220, trees 385863, bushes 141354, ruins 934618, rocks 974061, containers 218281, village/buildings 504452/812442. They require local bytes + license proof + native scale/palette review before replacing inherited frames.

## A8 southern POI transform review

See `A8_SITE_TRANSFORM_CONTRACT.md` and `data/survival/world/corridor/a8_site_transforms.v1.json`.

A1 confirms canonical cells Quarry `(30,280)`, Orchard `(140,360)`, Mill `(120,300)` and capability alignment. The exact 1:1 socket-to-anchor transform is computed, but all three A8 isolated 960×600 scenes **fail the authored 4-tile footprint** and lie outside the current connector annex. Direct overworld mount is `REJECT_FOOTPRINT_MISMATCH`. A8 must provide a compact overworld shell or explicitly use an interior/local expedition transition; A0 must choose the mount mode and preserve global-pixel save coordinates.

## Narrow A0 mounting handoff

1. Compose the existing 448×256 connector annex first (`compile_connector.py`). Do not replace legacy sources.
2. Apply `detail_overlay` from `crown_roadside.corridor.v1.json` to the composed detail layer inside `chunk:6:3` only.
3. Append `decor` props using production `OverworldWorld` prop rules; mount the three roadside container bodies with the authored `collision.size_px/offset_px`.
4. Mount the existing slice obstacles, including the corrected locker footprint. Do not duplicate the Waystation cache body.
5. Bind A3 instance economics separately. Keep SaveService authoritative; use durable `si:*` IDs for receipts/cooldowns.
6. Prove fresh-save normal input from Refuge through the corridor and back, genuine rewards once, reload persistence, and camera limits from composed bounds.
7. Keep `production_native_playable=false` until A0 production acceptance and CT product gate.

## Evidence

Local at this checkpoint:

- `compile_corridor.py`: 2 classes, 4 physical instances, 3 roadside + 1 POI object, 0 new POIs, 77 required nav cells, 36 detail cells, 8 decor props.
- `validate_corridor.py`: 0 errors.
- `pytest tests/survival/world -q`: **101 passed**.
- `check_determinism.py`: **236 artifacts**, tree `54cc776b9ca22ec6b98987231b5e400610ccb325fe1caa8a0251d4262566715b`.
- World/slice/connector validators: pass; `validate_handoff.py`: pass after A1 task-status enum correction.
- Authoring previews: `evidence/corridor_overview.png`, `evidence/corridor_container_player_scale.png`, debug stand overlay. These are atlas previews, not native gameplay acceptance.
- Native fixture: `tests/survival/world/corridor_native_test.gd`, CI job `godot-connector-native` corridor step. CI result is recorded in `ci_evidence.json` after the run; do not infer PASS from this document.

PR #20 mergeability: the only conflict was `docs/survival/WORKLOG.md`. It was resolved by reviewed non-force merge `e16285ff` of base `86831332`, preserving both CT and A1 history. GitHub subsequently reported PR #20 `MERGEABLE`. No world data was deleted, no force-push, no blind rebase, no self-merge.
