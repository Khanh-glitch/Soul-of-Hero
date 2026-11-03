# MAP-R01 — SOH Real Asset Bridge + Playable World Slice

**Execution order, not a research note.** This is a visual-only, asset-backed upgrade of the real
Canvas 2D Web game, applied to the untouched latest runtime PR38 head
`8421b9c3335c7648488ce8ae5dab43eb5787977e`. It is **one integrated playable Fisher's Point
first-hour slice**, not a parallel game, Godot scene, standalone showcase, generic asset library or
image-only laboratory.

## Hierarchy (as fixed by the creator)

| Layer | Ref | Head | Role in MAP-R01 |
|---|---|---|---|
| Playable runtime | `arena/4795760e-soul-of-hero` (PR38) | `8421b9c3` | **A** / integration target |
| Primary world art | `arena/e385312a-soul-of-hero` (PR20) | `ce9d4ba2` | A1 `terrain.png`, `props.png`, `atlas.v1.json`, `world_art_grammar.v1.json` |
| Map design canon | `map/veyra-gold-asset-canon-20261102` | `19d8c6ec` | `map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json`, `REAL_MAP_CONVERSION_CONTRACT.md` |
| Rejected MapLab | `arena/2e3cfbd2-soul-of-hero` @ `438b813c` | — | **B**, reference only, NOT approved for integration |
| Supplementary | Cainos / CraftPix / prototype packs, Drive `1pRNobw2FrKWQmelMdGpGnh3PUHPijjA0` | — | not imported |

This deliverable lives on the working branch `arena/2e3cfbd2-soul-of-hero` under `world_lab/map_r01/`.
The runtime repo has **no tracked `web/`** on that branch, so the reproducible artefact is a scoped
patch plus source copies, exactly as the real runtime consumes them.

## What was built (6 files, +4165/−1 in the runtime)

```
web/src/game/worldAssets.ts               NEW  small reusable PNG-atlas loader + deterministic selector
web/src/game/assets/soh_slice_atlas.png   NEW  256×274 crop sheet: ONLY the 181 admitted A1 frames
web/src/game/assets/frame_ledger.v1.json  NEW  exact rects, A1 origin rects, per-frame RGBA SHA-256, rights class
web/src/game/assets/assets.d.ts           NEW  `*.png?inline` TS declaration
web/src/game/render.ts                    EDIT 5 lines: 3 seams only, renderer NOT rewritten
web/tests/map_r01_assets.test.ts          NEW  7 tests (ledger integrity, deterministic selectors, KEEP fallback)
```

`render.ts` changes are limited to: one import, one `assetReady` flag, a `getChunk()` hook that calls
`worldAssetChunk()` **on top of the engine's own chunk canvas**, and one `drawSource()` hook inside the
existing y-sorted drawable list. No new PixelFX/VFX, no `fillRect`/hash/sine tile painting, no
geometry, collision, source, save or control change. When the sheet is not decoded yet the renderer
falls back to the untouched Web terrain.

### Capability delivered

- **Real atlas rects**: read from A1 `data/survival/world/art/atlas.v1.json`; every admitted frame
  carries its A1 origin rect and a computed RGBA SHA-256 that matches the A1
  `first_hour_asset_provenance.v1.json` `a1_current` crop profile where that profile covers it.
- **Nearest-neighbour, 16px grid, scale 1**: `imageSmoothingEnabled = false`, integer blits only.
- **Deterministic material/frame selector**: integer tile hash picks a *variant inside an already
  authored material*; it never paints a tile or derives a biome.
- **Compatible transitions** decoded from the atlas pixels, not guessed:
  - `blend_grass_water_0..15` / `blend_grass_forest_0..15` = corner mask `1=TL 2=TR 4=BR 8=BL`;
  - `coast_dune_tidal_1..15` = edge mask `1=N 2=E 4=S 8=W`;
  - `road_dirt_0..15` = road-neighbour edge mask. A walkable tile is never repainted as open sea
    (mask 15 is suppressed).
- **Y-sorted props**: `worldAssetSource()` is called inside the renderer's existing y-sorted list,
  with a feet anchor, pixel shadow and nearest-neighbour blit. It is pinned to **real `w.src`
  resource cells only** — no invented landmarks, no collision change.
- **Existing camera / day-night / weather / HUD / save** remain authoritative.

### Rights / provenance (parsed before any claim)

A1 `RESEARCH_AND_LICENSES.md` states the compiled terrain/road/detail atlas is **original SOH art
baked by `build_world_art.py`**, plus nine inherited frames from
`assets/environment/overworld/overworld_props.png` with `license: "original"`. It also records
**Cainos demo art as REJECTED** (standalone license unproven) and CraftPix freebie terms forbidding
raw-art redistribution. `atlas.v1.json` and `first_hour_asset_provenance.v1.json` nevertheless
still contain `cainos_*` / `ocean_*` crop records from earlier checkpoints. Therefore C **excludes
every `cainos_*` and `ocean_*` frame**, ships only a 23,547-byte crop sheet instead of the whole
compiled atlas, and makes **no claim of creator visual approval or third-party rights**. No raw
pack ZIP, no Drive content and no entire third-party pack is copied into the public build.

Source file SHA-256 pinned in the ledger:
`terrain.png 4d663a3d…`, `props.png 5de614ec…`, `atlas.v1.json a9f9137f…` (all at A1 `ce9d4ba2`).

## Direct visual comparison → per-material decisions

Three builds were built from PR38 `8421b9c3` and captured with the **same frozen epoch**, the same
run seed `2182077881`, the same spawn `(1352,2744)`, the same QA `+1h` day/night switch, the same
weather slots, the same native **640×360** viewport and the same physical key route. A/B/C end
positions match to 0.01 px; all three manifests report `errors: []`.
See `evidence/ABC-*.png` and `evidence/{A,B,C}/manifest.json`.

| Material | A (Web) | A1 candidate | Decision (after looking at the screenshots) |
|---|---|---|---|
| grass / meadow / forest ground | dense hash/sine stipple + orange speckles | `grass_0..3`, `mix_grass_silt_1..15`, `forest_0..3` — calm authored tufts | **REPLACE** — removes the noisy ground without B's confetti |
| sand / beach | flat dotted sand, hard blocky shore | `dune_0..3` + `coast_dune_tidal_1..15` | **REPLACE** — warm sand with a coherent shoreline fringe |
| shallow / deep / river | big sine wave dashes, patterned sea | `tidal_0..3`, `lake_0..3`, `river_0..3` | **REPLACE** — calm teal/blue, sparse dashes; no B-style patterned sea |
| grass↔water / grass↔forest edges | hard steps, priority dithering | `blend_grass_water_*`, `blend_grass_forest_*` | **REPLACE** — authored corner transitions |
| road | smooth brown dirt road | `road_dirt_0..15` wooden plank blob set | **KEEP A** — the plank set reads as scattered boardwalk squares, not the island road |
| rock / bush / reed sprites | brighter, outlined, matches Web trees | A1 inherited `rock_a`/`rock_c`/`bush`/`reeds` | **KEEP A** — A1 props are darker/boxier; `props:false`, seam retained for a later palette-matched pass |
| trees, player, creatures, structures, roofs, HUD, items, VFX | original Web art | — | **KEEP A** |
| snow / ash / toxic / lava / burnt / ice / bridge / floor / pwall / cliff / hill / marsh | original Web material | — | **KEEP A** (outside this slice) |
| B MapLab `mapArt.ts` (procedural grass, dashed sea, invented beacon/cairn/post/dory/stones/mast) | — | — | **REJECT** — reference only |

The visual-only gate is explicit and data-driven in `ASSET_DECISIONS` in `worldAssets.ts`.
`C1` (road+props ON) and `C2` (KEEP) were both captured and inspected; the shipped C is the KEEP
variant. C is calmer and more authored than A and avoids B's noisy grass, orange road stripes,
patterned sea and extra invented lights. This is a **visual judgement**, not a claim of creator approval.

## Verification (all executed on the built single-file Web app in real Chromium)

- `npx tsc --noEmit` → clean.
- `npm run build` → `dist/index.html 750.27 kB │ gzip: 329.06 kB` (A `651.71 kB`, B `661.40 kB`).
- `npm test` → **6 files / 91 tests pass** (5 pre-existing files / 84 tests untouched + 7 new).
- Fresh clean PR38 worktree: `git apply --check` OK → `git apply` → `tsc` clean → build `750.27 kB`
  → 91 tests pass (`VERIFY_OK`).
- Real browser: `errors: []` on all A/B/C captures and on verification.
- `evidence/verify/verify.json`: HUD clock/region/hotbar present; cumulative real walking
  **363.38 px** with HP unchanged; I/C/M/B panels all open; real LMB harvest on the real grass
  source at world tile `(83,176)` raised `skills.gather 0→2`; real `[E] Search crate` prompt at the
  Net Shed starter crate, container panel opened, `Take all` moved inventory `3→6`;
  **A-vs-C authority fingerprint identical** (seed, spawn, entity kinds/positions, POI list,
  inventory, terrain/source mutation counts). C changes visuals only.

## Reproduce

```bash
cd <clean worktree of PR38 8421b9c3>
git apply --check world_lab/map_r01/patch/map_r01.patch && git apply world_lab/map_r01/patch/map_r01.patch
cd web && npm ci && npx tsc --noEmit && npm run build && npm test
```

Capture (Chromium needs `/tmp/chromium` + `LD_LIBRARY_PATH=/tmp/al2023/lib`,
`--no-sandbox --disable-dev-shm-usage --disable-gpu`):

```bash
node world_lab/map_r01/tools/serve.mjs                    # serves /a /b /c on :4199
GAME_URL=http://127.0.0.1:4199/a/ OUT=shots/A TAG=A node world_lab/map_r01/tools/capture.mjs
GAME_URL=http://127.0.0.1:4199/b/ OUT=shots/B TAG=B node world_lab/map_r01/tools/capture.mjs
GAME_URL=http://127.0.0.1:4199/c/ OUT=shots/C TAG=C node world_lab/map_r01/tools/capture.mjs
node world_lab/map_r01/tools/composite.mjs
node world_lab/map_r01/tools/verify.mjs
```

`tools/build_slice.mjs` regenerates `soh_slice_atlas.png` + `frame_ledger.v1.json` from the A1
`ce9d4ba2` files (it expects them extracted into `/home/user/r01_scratch/`).

## Still to settle before full-world migration

Fisher's Point is **not** the final world. See `VEYRA_CROSSWALK.md` for the compact
`Veyra source concept → A1 geography/art → current Web representation → compatible seam →
unresolved differences` crosswalk, the decisions required before any Veyra→Web migration, and the
exact next production step. **No Veyra authoring coordinates were auto-scaled into Web's 200×200
island and no new gameplay law was introduced.**

PR38 is **not merged**; no creator visual approval is claimed.
