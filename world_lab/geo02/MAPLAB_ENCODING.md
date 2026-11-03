# MAP-GEO-02 · Veyra encoding resolved from Map Lab Studio v3 source

**Task 2 result: the biome legend, elevation unit and road/river width semantics were NOT
unavailable. They were simply not embedded in the canonical `.sohmap.json`. They are now resolved
from the pinned Map Lab Studio v3 reference source. No legend was inferred from colour or
appearance.**

## 1. Custody chain (all hashes verified by `src/lib/maplab_source.mjs`)

| Step | Value |
|---|---|
| Source input branch | `input/greywater-poi-pilot-20261102` @ `0602b59af626d96fc2f76351cdf95ad66863f66e` |
| Outer package | `SOH_Greywater_POI_Agent_Input_v1.zip` SHA-256 `4fbf68d10d3627de15aada1bb324649a6232aea3eceb84cb1911728fbc606bb8` |
| `INPUT_SHA256.txt` | all **4** entries re-hashed `MATCH` inside the outer zip |
| Inner package | `02_map_studio_v3.zip` SHA-256 `887a389cc4da3d50377ebc3ff5c6327651794d84acbcb8b14de0215329ab464e` |
| Offline editor | `public/downloads/SoulOfHero_MapLab.html` SHA-256 `8f69d9fae7163dc9fb7c8c8eb62ac0eaf9e773012ad69650676e3deabcc9b990` |
| Default seed | `04_map_studio_default_seed.sohmap.json` SHA-256 `f39847a15d2a9bec9eddb4d027acabc92009025a19b6f26b5736b69f23fdaf4d` |
| Generation link | the default seed has **byte-identical** `terrain.elev`, `terrain.biome`, `gw/gh/cell/seed` **and identical object arrays** to Veyra GOLD; only `project.name` and `project.meta` differ → the pinned source is the writer of Veyra's arrays |
| Verbatim excerpts | `source_excerpt/*.ts` (8 files) with `SHA256SUMS`, re-verified against the inner zip |

`node src/encoding.mjs` prints `zipChain=VERIFIED` when the git objects and `unzip` are available;
otherwise it still verifies every pinned excerpt hash and records `NOT_AVAILABLE_LOCALLY`.

> The Greywater POI **art pilot** in `AGENT_HANDOFF.md` is out of scope. Only the Map Studio v3
> encoder/analysis source is used, as a semantic reference. No environment-art experiment, no
> production merge, no prototype revival.

## 2. Biome legend — `source_excerpt/types.ts :: BIOMES[]`

| code | key | name (source) | land cells | sea cells |
|---:|---|---|---:|---:|
| 0 | `meadow` | Bình nguyên / canh tác | see `output/maplab_encoding.v1.json` | 28,624 |
| 1 | `forest` | Rừng lá rộng | | |
| 2 | `ancient` | Rừng cổ (sống động) | | |
| 3 | `conifer` | Rừng thông / cao nguyên | | |
| 4 | `marsh` | Đầm lầy / cửa sông | | |
| 5 | `desert` | Sa mạc / cồn cát | | |
| 6 | `scrub` | Thảo nguyên khô | | |
| 7 | `rock` | Đá trần / núi | | |
| 8 | `snow` | Lạnh / tuyết | | |
| 9 | `volcanic` | Núi lửa / obsidian | | |
| 10 | `toxic` | Đất độc / lưu huỳnh | | |
| 11 | `beach` | Bãi cát ven biển | | |

Exact per-code counts are in `output/maplab_encoding.v1.json → biomeLegend`.

**Critical caveat:** `terrain.ts generateTerrain()` executes
`if (!mask[k]) { t.biome[k] = 0; continue; }`. Code `0` is `meadow` **on land** but a
**"no biome" sea sentinel** on the 28,624 non-land cells. A flat 12-code → single `Biome` table
would mislabel all sea cells as meadow. Any approved Gameplay mapping needs a land/sea guard.

**Still unresolved:** the legend is on a *different branch*, is **not embedded** in the canonical
JSON, is **not approved**, and is **not a mapping** to Gameplay's 14-string `Biome` enum (which has
no `UNKNOWN` member). CD-03 therefore remains a real blocker — but the legend itself is no longer
"unknown".

## 3. Elevation unit

- Serialization (`store.ts`): `btoa(String.fromCharCode(...Uint8Array))`, decoded by
  `Uint8Array.from(atob(s), c => c.charCodeAt(0))`. `format:"soh-maplab"`, `version:1`,
  arrays `elev` and `biome`, both 43,750 bytes. GEO-01's base64 decoding is confirmed correct.
- Unit (`analysis.ts computeFields`, `terrain.ts elevAt`): **`elev[i] / 255`** — an **abstract
  normalized height scalar**, 0..1. Byte `0` = sea; land bytes are `1..255`
  (`Math.max(1, Math.round(clamp(e,0,1)*255))`). Veyra raw range `0..243`, 238 distinct values.
- `types.ts` line 2: *"World units are abstract `u`. Real-world scale is NOT approved by Gameplay
  Tower (Bible §11.5: no invented km/minutes)."* → **no metres, no kilometres, no approved world
  scale**. Elevation is dimensionless until a joint transform is approved.
- Slope (`terrain.ts slopeAt` / `analysis.ts computeFields`):
  `hypot(∂(elev/255)/∂x, ∂(elev/255)/∂y) × 100`, x/y in authoring units. Source comment:
  *"Relative steepness index (elevation units per world unit × 100). Heuristic scale, not a Bible
  value."* Map Lab's `RULES` (`buildSlopeMax 0.5`, `cartSlopeMax 0.7`, `footSlopeMax 1.5`) and
  `FOOT_B`/`CART_B` biome multipliers are **editor heuristics**, not Gameplay passability laws.

## 4. Road / river width semantics

| Item | Source | Meaning |
|---|---|---|
| `River.width` | `types.ts River.width` | **editor stroke width in abstract authoring units**; Veyra has 17 rivers, widths vary |
| river mask | `terrain.ts riverMask` | `g.lineWidth = Math.max(r.width, 9)` → effective **9u minimum** raster stroke |
| river carve | `terrain.ts generateTerrain` | `R = canal ? 16 : max(20, width*4)` authoring units; `a = 0.22` (canal `0.05`) |
| ford heuristic | `graph.ts` | unbridged crossing is foot-fordable only if `rd.ford \|\| riv.fordable \|\| (kind!=="canal" && width<=3)`; **always blocks cart** |
| road width | `types.ts Road` | **NO width field. NOT_IN_SOURCE.** |
| road raster | `analysis.ts rasterRoads` | **all** non-ferry roads stroked at `c.lineWidth = 9` authoring units (foot and cart alike); a second identical 9u stroke for cart roads |
| SVG strokes | `exporter.ts renderSVG` | cart `3.4u`, others `1.6u` — **display only** |
| bridge glyph | `exporter.ts renderSVG` | `13 × 7.2u` rectangle — **display glyph**, not a physical deck span |
| bridge validity | `validate.ts BRIDGE-VALID` | bridge must be within **14u** of both road and river centrelines |
| graph constants | `graph.ts` | `SNAP_TOL=7` (editor junction merge tolerance), `ACCESS_R=48` (POI→road), `DOCK_R=40`, `BRIDGE_R=22` (bridge covers a crossing), resample step `8u` |

**Therefore:** neither the 9u analysis stroke, the 3.4u/1.6u display strokes nor the 13×7.2u
bridge glyph is a physical road width, channel width, bridge span or swept-clearance envelope.
`RoadGeometry.widthTiles` and physical cart clearance remain `UNDEFINED`. Do **not** promote any
of these editor numbers into a Gameplay passability rule.

## 5. Consequence for GEO-01's contract

CD-03, CD-07 and CD-08 were corrected in `../geo01/src/contract.mjs` and
`../geo01/output/contract_boundary.v1.json`. The verdict is unchanged:
`DIRECT_RUNTIME_INTAKE_BLOCKED__INDEPENDENT_GEOGRAPHY_EXPORT_PROVIDED`. The missing pieces are
now *approval/mapping/transform*, not *discovery*.

Run: `node src/encoding.mjs` → `output/maplab_encoding.v1.json` + `output/rasters/manifest.v1.json`
and five source-semantic `.u8` masks (`landMaplab`, `lakeMaplab`, `riverMaplab`,
`roadFootMaplab`, `roadCartMaplab`). Masks are an analytic cell-centre reproduction of
`maskFromDraw()`/`rasterRoads()`; canvas antialiasing can differ by at most one boundary cell.
