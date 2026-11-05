# MAP → GAMEPLAY HANDOFF — `MAP-GEO-REJOIN-01` (exact source-pinned)

**Recipient:** Gameplay owner, branch `arena/d4bfcfff-soul-of-hero`
**Live PR44 HEAD (verified 2026-11-05):** `6e7d116b4400ea3c24373fe884b7fad258f4f7bc` — OPEN, **NOT edited or merged by Map**.
**Sender:** Map / U05 physical geography, branch `arena/2e3cfbd2-soul-of-hero`,
parent HEAD `99a196f3b601155ae216ba8968d4f94ee2d0a157`; exact packet commit is recorded in
`creator-u05/evidence/mapgeo01-delivery.json`.
**Active authority:** `WMP-04R1`, `MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING`,
`U=0.5 AU/tile`, `TILE=16 px`, native `640×360` at `1×`, hero `16×24`.

> This is an **interface handoff**, not an integration, not a merge, not an
> acceptance claim. Map does **not** edit PR44.

---

## 1. Live-ref drift you must account for

The Gameplay branch moved from the task-observed `2f0836587b76a4a98fffedf8c202fb37cbb2a67c`
to `6e7d116b4400ea3c24373fe884b7fad258f4f7bc` ("Prove and improve natural living home route").
Creator-verified head remains `5b3e683402bbc8540dea9404576164097e753f97`; U05 source pin
`b5c8004ca4e77be62484fb3cd296fe296d7de4c9`.

| Live Gameplay file | State at `6e7d116b…` | Consequence |
|---|---|---|
| `web/ref/bible.md` | blob `19145e0474109f6275c50c4a2408d5b4ddd2eb68`, file SHA `9851ad25a1389029dd83f448dc77b6670c1b3548e962e951ba9e34f4f5e0bed3` | §K6 ownership + §11.3 C07/C09 changed (Creator 2026-11-05 claim/upkeep). **§V and §11.5 are unchanged.** `web/ref/bible.md` is absent in the Map worktree; do not use `creator-u05/web-u05/ref/bible.md` as a substitute. |
| `web/src/game/art.ts` | blob `a1a0c77c24dd7063c6aa2916aae6cd5f55439082` | U05 vendored copy is pinned to `b5c8004c` blob `9312b4c4a82238953508286a07d1a9a67b9ab155`; live added `S.claim`. **Do not silently re-vendor.** |
| `web/src/game/render.ts` | terrain painter block unchanged | `PAL/PRIO/texel/renderChunk` block = 8,276 bytes, SHA `f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803`, **byte-identical** at `b5c8004c…`, `2f083658…` and `6e7d116b…`. Creator-locked Beacon road appearance is preserved; no widening/recolour/redraw. |

## 2. Exact pinned Map sources (SHA-256 in `evidence/mapgeo01-gameplay-handoff.json :: pinnedSources`)

| Group | Files |
|---|---|
| Authority | `veyra-world-master/CURRENT_WORLD_MASTER.json`, `v4/r1/manifest.r1.json`, `data/canon/VEYRA_GOLD_MAP.sohmap.json` (`88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256`) |
| Rasters | `v4/r1/data/biomeEffective.r1.u8` (`43e700ef…`), `v4/data/marineRegion.v4.u8` (`615a5ce0…`), `v4/r1/data/coldTransition.r1.u8` (`e7849ccb…`), `v3/rasters/cliffCandidate.v3.u8` (`6b2897d7…`) |
| Contracts | `world_lab/src/gold/REAL_MAP_CONVERSION_CONTRACT.md`, `creator-u05/contracts/CREATOR_CHOSEN_U05.v1.json`, `contracts/LAYER_INVENTORY.json` |
| Map runtime (unchanged) | `web-u05/src/u05/world.ts` (`78317efe…`), `src/u05/terrain.ts` (`3d3fa160…`), `src/u05/lw/geometry.ts` (`b10bab33…`), `src/u05/lw/sources.generated.ts`, `src/game/art.ts` (`896aa51a…`), `src/terrain-only/main.ts` |
| Protected executable | `creator-u05/SoulOfHero_TerrainOnly_U05_x10.html` (`540f095e1a29a228a989ae017eb888a54861f2a5a077b2686e9a5697c81c6ab0`) — **read-only, never rebuilt** |
| Evidence | `evidence/mapgeo01-preflight.json`, `mapgeo01-physical-audit.json`, `mapgeo01-reconciliation.json`, `mapgeo01-traversal.json`, `mapgeo01-shots/*.png` (16 × native 640×360) |
| Reconciled register | `map-data/MAPGEO01_FINDINGS_RECONCILED.json`; original `map-data/U05_GEOMETRY_CONFLICTS.json` **unchanged** (`2ac08fd0…`) |

## 3. What Map exposes

```
window.__terrain.sampleTile(tx,ty)  -> TileSample
  authoredLand, water, lake, river, road, bridge, dock, coast, poiId, zoneId,
  elevation, heightClass, cliffCandidate, walkableCandidate, cargoCandidate,
  buildableCandidate, waterTraversalClass, permissions
window.__terrain.u05Tile(tx,ty)     -> VISIBLE terrain tile code (verbatim SOH painter)
window.__terrain.terrainBlocked(tx,ty) -> natural-terrain collision ONLY
```

**Typed boundary (must be preserved):**

| Layer | Authority | Never mint |
|---|---|---|
| Visible surface | `u05Tile()` → `PAL/PRIO/texel` | permission, collision law |
| Physical geometry | `sampleTile()` flags + candidate rasters + `terrainBlocked()` | Gameplay permission |
| Gameplay permission | `permissions` — `foot`/`cart` are **MAP CANDIDATES**, `build`/`boat`/`swim`/`ferryFoot` are **`false` everywhere** | walkable water, carts, boats, loading capacity, POI doors, build rights |

## 4. What Gameplay must own (named interfaces still missing)

1. **`WorldTraversal`** for 12 GOLD bridges: real span, `bridge_width`, `load_validity`,
   `alternate_edges`. Measured: **12/12 centres render `RIVER`, 12/12
   `terrainBlocked=true`, 0 physically crossable** (`MGP-D01`). Map will not stamp an
   arbitrary bridge deck over the river: the GOLD bridge node radius (12 AU = 24 tiles)
   is a diagnostic area, not an approved span.
2. **`POIAccessGraphCandidate`**: 26 missing exterior entrance records,
   `door_positions`, `room_geometry`, `power_nodes`, `exit_paths`, `stand_positions`.
3. **`BuildSiteSample`**: legal placement after A0 protection/collision/route/resource/
   dynamic-occupancy checks for 19 buildable-zone overlaps (remeasured at U=0.5).
4. **Permissions & costs**: foot/cart/boat/swim/ferry, cart swept clearance, loading
   capacity, `t_foot`, `t_cart_loaded`, `t_cart_unloaded`, `distance_to_road`.
5. **Docks**: boarding/disembark cells, water depth, harbour collision for 27 docks.
6. **Cliff law & vertical links**: WMP-03 has 305 `cliffCandidate` cells (code 0/1)
   but the U05 rule `cliff>=2` yields **0 physical `T.CLIFF` tiles** (`MGP-D10`);
   8 vertical-link blockers unresolved.
7. **Retreat routes** for 63 POIs; MAP-SPAWN-04 / HOME-03 / POI-02 / LOG-03 / U1–U5 /
   CAMERA full-runtime tests.
8. **Creator decisions**: missing Beacon helicopter sprite (`NO_RELOCATION__NO_SUBSTITUTE`),
   `po_timberyard` centre on a `RIVER` tile (no auto-relocation).

## 5. Hard rules

- Do **not** import raw GOLD at runtime; use `api/current.mjs` and the U=0.5 additive reprojection.
- Do **not** treat visible surfaces, QA screenshots or candidate rasters as Gameplay permission.
- Do **not** invent walkable water, approved carts/boats, loading capacity, POI doors or build rights.
- Do **not** amend GOLD polygons / coastlines / roads / docks / resources; all **81 canonical POI IDs** unchanged.
- Do **not** widen, recolour or redraw the Creator-locked Beacon road; production atlas is `NOT_AUTHORIZED`.
- `footOnSea=FORBIDDEN`; the 8 inherited ferries are optional suggestions, **not** physical permissions.
- Map does **not** edit or merge PR44. Integration is the Gameplay owner's action.

## 6. Measured packet summary

| Metric | Value |
|---|---|
| 62 findings | `0` correctable Map geometry defects / `12` intentional overlaps / `46` Gameplay-A8 / `1` Creator / `3` missing evidence |
| Polygon findings remeasured at U=0.5 | `30` (7 zones were double-counted in the 1 AU sums) |
| Physical defects named | `10` with owner + severity |
| Bridges / roads / docks / spawns / POIs | `12` (`0` crossable) / `92` (`92` continuous, `31` water-overridden) / `27` / `4` (all dry, road 29–57 tiles away) / `81` |
| Traversals in isolated viewer | `6` → `4 PASS / 1 FAIL (bridge crossing) / 1 PARTIAL (no cliff)`; `16` native 640×360 shots; `0` browser errors |
| GOLD amendments | **`0`** |
| Acceptance | `PAPER=MEASURED`, `RUNTIME=ISOLATED_VIEWER_PHYSICAL_PARTIAL`, `VISUAL=NOT_REQUESTED_AND_NOT_GRANTED`, `GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED` |

## 7. One recommended next action

**Pin `6e7d116b4400ea3c24373fe884b7fad258f4f7bc`, consume this packet, and decide
`MGP-D01` (bridge span/art + `WorldTraversal` collision contract) with the Creator.**
That is the smallest decision that removes the only FAIL traversal and lets all 31
water-overridden road segments be evaluated as real alternatives. No other action
should be started before that decision; no `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`,
`MERGE_READY` or production-merge claim is made here.
