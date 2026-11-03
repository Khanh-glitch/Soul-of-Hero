# MAP-GEO-02 · Spatial Geometry Hardening

> **MAP DESIGNS THE PHYSICAL WORLD. GAMEPLAY POPULATES AND SIMULATES IT.**
> Continues from `6364c893`. MAP-GEO-01's source preservation/export is accepted and **not
> redone**. Current Web terrain/sea art untouched. No new environment-art experiment.

**Outcome:** a more physically defensible `sp_lake → po_kilns` corridor and a `PROPOSED`
`po_kilns` physical shell that Gameplay can inspect in the **2000×1400 authoring space** —
with a corrected Map/Gameplay boundary, source-resolved encoding semantics, a four-layer
connectivity audit, and a visually inspectable before/after diagram. Nothing was merged into
runtime, no Gameplay population was performed, and **no physically traversable cart route is
claimed**.

## 1. What changed

| # | Task | Result |
|---|---|---|
| 1 | Ownership correction | `contract_boundary.v1.json` + 4 GEO-01 docs corrected. Physical POI rooms/entrances/passages/door openings/circulation/sockets/retreat = **`MAP_RESPONSIBILITY_NOT_IN_SOURCE`** (7 rows). Locked states, loot, power, hazard intensity, interactions stay Gameplay. `geography.v1.json` left byte-for-byte unchanged; 243 stale owner strings superseded by an overlay. |
| 2 | Encoding semantics | **Found**, not declared unavailable: 12 named biome codes, `byte/255` abstract normalized elevation, `hypot(∂h)×100` slope index, editor width semantics, `SNAP_TOL=7` etc. — all from pinned Map Lab Studio v3 source. Never inferred from appearance. |
| 3 | Corridor audit | 4 non-conflated connectivity layers; junction tolerance, both bridges, zero-clearance cells, river widths, surface continuity and derived connectors audited; 8 failing/needs-authoring findings. |
| 4 | `po_kilns` candidate | Bounded `PROPOSED` footprint/approach/3 entrance options/4 working spaces/5 circulation paths/retreat. Separate from canon, no recipes/loot/locks/power/machinery. |
| 5 | Gameplay package | `output/geometry_package.v1.json`: exact source IDs, unresolved constraints, 2000×1400 preserved, authored-vs-PROPOSED distinct. |

## 2. Source fingerprints (verified)

| Object | SHA-256 / value |
|---|---|
| Veyra GOLD `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` (332,249 B) |
| Input branch `input/greywater-poi-pilot-20261102` | `0602b59af626d96fc2f76351cdf95ad66863f66e` |
| Outer `SOH_Greywater_POI_Agent_Input_v1.zip` | `4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8`; all 4 `INPUT_SHA256.txt` entries `MATCH` |
| Inner `02_map_studio_v3.zip` | `887a389cc4da3d50377eb3ff5c6327651794d84acbcb8b14de0215329ab464e` |
| `SoulOfHero_MapLab.html` | `8f69d9fae7163dc9fb7c8c8eb62ac0eaf9e773012ad69650676e3deabcc9b990` |
| `04_map_studio_default_seed.sohmap.json` | `f39847a15d2a9bec9eddb4d027acabc92009025a19b6f26b5736b69f23fdaf4d`; **byte-identical `elev`/`biome`/grid/seed and object arrays** to Veyra GOLD → this source wrote Veyra's arrays |
| 8 verbatim `source_excerpt/*.ts` | `SHA256SUMS`, all `MATCH` against the inner zip |

`zipChain=VERIFIED` is emitted when git objects + `unzip` are present; otherwise the pinned
excerpts still verify. Details: `MAPLAB_ENCODING.md`.

**Resolved from source (NOT from appearance):**
`BIOMES 0..11` = meadow / forest / ancient / conifer / marsh / desert / scrub / rock / snow /
volcanic / toxic / beach. **Code 0 = meadow on land but a "no biome" sea sentinel on 28,624
sea cells** — a flat code→Biome table would mislabel the sea. Elevation = `byte/255` dimensionless
(0 = sea, 1..255 land; raw 0..243), **no real-world unit** (Bible §11.5). River `width` = editor
stroke, mask `max(width,9)u`, carve `max(20,width*4)u`. Roads have **no width field**: 9u editor
analysis stroke, 3.4u/1.6u display strokes, 13×7.2u bridge **display glyph** — none is physical.
`SNAP_TOL=7`, `ACCESS_R=48`, `DOCK_R=40`, `BRIDGE_R=22`, slope/build limits are **editor
heuristics, not Gameplay law**.

## 3. Verified geometry & route evidence

- `po_kilns [905,785]`, `arche:smelter`, `foot` 496.7424 au², `deep:null`, `gate:none`.
  `rd_16` (trail) terminates **inside** the foot at `[905,785]`; exact west-edge crossing
  `[891.4531,786.1953]`.
- `br_4` **cart** covers `rd_b × rv_silver` at 0.1433au; `br_a` **foot** covers
  `rd_20 × rv_silver` at 0.0342au. Both `BRIDGE-VALID` (<14u). `rv_silver.width=4` → 9u mask,
  20u carve. `channelSpanFitVerified=false`.
- GEO-01 routes: RT-1 **400.1147au**, RT-2 403.9036au, RT-3 398.0289au; 50-step BFS path;
  1 zero-clearance cell `[732,652]` (0 au) at `br_4`.
- **RT-1 is NOT a cart route**: `rd_b` cart + `rd_13`/`rd_1w`/`rd_16` trails. Nearest cart road
  to `po_kilns` is `rd_n` at 56.8792au > `ACCESS_R=48`. `br_a` blocks cart (RT-3 foot only).
- GEO-01 `joinToleranceAu=8` ≠ editor `SNAP_TOL=7`: 4 endpoint joins exist only at 8;
  resampled graph 1,444 nodes @7 vs 790 @8 with 773 self-merges @8 that would delete road edges.
- Raster candidates connect (foot & cart Dijkstra) but take **0 river cells / no bridge** and
  ~half off the 9u cart-road raster — a connected raster is **not** a route.
- Full details: `CORRIDOR_AUDIT.md`, `output/corridor_audit.v1.json`.

## 4. Derived outputs

| File | Contents |
|---|---|
| `output/maplab_encoding.v1.json` | source-linked legend/units/width semantics + graph constants |
| `output/rasters/manifest.v1.json` + 5 `.u8` | source-semantic land/lake/river/roadFoot/roadCart masks (43,750 cells each) |
| `output/ownership_correction.v1.json` | overlay superseding 243 stale GEO-01 owner strings |
| `output/corridor_audit.v1.json` | 4 connectivity layers + all audit items + 8 findings |
| `output/poi_po_kilns.proposed.v1.json` | **PROPOSED**, non-canonical `po_kilns` shell |
| `output/geometry_package.v1.json` | concise Gameplay-facing geometry package |
| `output/audit_before_after.svg` / `.png` / `.html` | visually inspectable before/after geometry audit (1800×1240, with POI zoom insets) |
| `../geo01/output/contract_boundary.v1.json` | corrected (55 fields, 12 deltas, 7 `MAP_RESPONSIBILITY_NOT_IN_SOURCE` rows) |

## 5. Known blockers

1. `authoringUnitToRuntimeTile` / world scale **`UNDECIDED`** (PR44 pins 200×200 @ TILE=16;
   Veyra 250×175 @ 8u on 2000×1400). No rescale applied.
2. Physical road width, river channel width, bridge deck span, cart/foot footprint **`UNDEFINED`**;
   swept clearance **UNVALIDATED**. `channelSpanFitVerified=false`.
3. Biome 12→14 Gameplay mapping + land/sea guard **not approved**; climate `UNDEFINED`.
4. `po_kilns` physical shell is `NOT_IN_SOURCE` in canon; the candidate is `PROPOSED` only.
5. 4 derived connectors need Map spatial authoring; 2 exceed `ACCESS_R=48`.
6. No Gameplay passability/loaded-cart/ford/ferry rules, no population, no survivability claim,
   no static-screenshot-as-gameplay-validation.

## 6. Next executable seam

Gameplay can inspect `geometry_package.v1.json` **in authoring units**. To consume it:
(1) approve world-scale/grid transform; (2) approve biome mapping + climate contract;
(3) approve physical road/river/bridge dimensions and validate swept clearance;
(4) Gameplay supplies locked states/loot/power/interactions and its own passability rules;
(5) only then consider a versioned `RuntimeMapPackage`. Map must author **canonical** POI shell
geometry (the `PROPOSED` candidate is not canonical) and re-derive the road graph at `SNAP_TOL=7`.

## 7. Reproduce

```bash
cd world_lab/geo02 && ./reproduce.sh
# or, to re-check the accepted GEO-01 baseline:
cd ../geo01 && ./reproduce.sh     # REPRODUCE_OK, VERIFY_PASS 18/18, GEO_TESTS 15/15
```

Steps: `encoding` → `ownership` → `audit` → `poi_design` → `render` → `package` → `test`.
`src/test.mjs` re-runs the whole pipeline and asserts **byte-identical** derived outputs, hash
custody, 4-layer separation, PROPOSED/canonical separation, no gameplay keys, no invented
passability rules and the 2000×1400 frame.

## 8. Gates

Deterministic reproducible source-linked data ✅ · visually inspectable before/after audit ✅ ·
explicit existing-authored vs PROPOSED ✅ · no runtime merge ✅ · no new Gameplay population ✅ ·
**no physically traversable cart-route claim** ✅ · no invented passability rules ✅ ·
2000×1400 authoring space preserved ✅ · current Web terrain/sea art untouched ✅ ·
no MAP-R01 art merge / no canonical rewrite / no force-push ✅.
