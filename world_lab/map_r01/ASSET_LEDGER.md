# MAP-R01 — exact asset / frame ledger

## Shipped asset files (all inside the Web public build)

| File | Bytes | Role |
|---|---:|---|
| `web/src/game/assets/soh_slice_atlas.png` | 23 547 | 256×274 RGBA crop sheet, **only** the 181 admitted A1 frames. SHA-256 `4844c6d485cae2c82e826d1e37c4cc85e6a0fe11fb08600bd37300d2e31885d1` |
| `web/src/game/assets/frame_ledger.v1.json` | 97 421 | exact slice rect, A1 origin rect, per-frame RGBA SHA-256, provenance source and rights class for every frame |
| `web/src/game/assets/assets.d.ts` | 132 | `*.png?inline` TypeScript declaration |
| `web/src/game/worldAssets.ts` | 6 596 | loader + deterministic selector + seams |
| `web/src/game/render.ts` (diff) | +4/−1 | 3 seams only |
| `web/tests/map_r01_assets.test.ts` | 2 913 | 7 new tests |

Nothing else from A1 or any pack is in the public build. The full A1 `terrain.png` (54828 B),
`props.png` (119345 B), `atlas.v1.json` (170126 B) and `first_hour_asset_provenance.v1.json`
(216762 B) were extracted to private scratch `/home/user/r01_scratch/` for **rect/hash reading
only**, never copied into `web/`. No raw CraftPix/Cainos ZIP and no Drive content is committed.

## Source identities (A1 `arena/e385312a-soul-of-hero` @ `ce9d4ba2`)

| A1 file | SHA-256 | Size | Note |
|---|---|---:|---|
| `assets/environment/survival_world/terrain.png` | `4d663a3dd1a865b8dcb2cfe9024c197e10ba3b0c8e8101c3ffe825d9e5ad5782` | 512×896 / 54828 B | compiled original SOH terrain atlas, 1769 rects / 184 families |
| `assets/environment/survival_world/props.png` | `5de614ec25db2d0b1a62393e5ebe18c9ae0dfc26d9aef0b247376cdeb7c43f32` | 1024×794 / 119345 B | compiled prop atlas, 164 rects |
| `data/survival/world/art/atlas.v1.json` | `a9f9137f7c57945f67d9657fda7bdf26794d049b21eff854dce4752e95f0d8c5` | 170126 B | schema `soh.world.art_atlas.v1`, `tile_px 16`, `filter nearest`, `scale 1`, feet anchor |
| `data/survival/world/art/world_art_grammar.v1.json` | — | 20659 B | 72-key palette, 8 semantic roles, 11 biome + 11 lighting profiles, 14 production rules |
| `data/survival/world/art/first_hour_asset_provenance.v1.json` | — | 216762 B | schema `soh.world.a1_first_hour_asset_provenance.v1`, `a1_current` crop profile with `raw_rgba_sha256` per frame |

`atlas.v1.json` licence string: *"original SOH art plus creator-rights-secured supplied pack
crops; source rectangles and hashes are explicit"*. A1 `RESEARCH_AND_LICENSES.md` states the baked
terrain/road/detail atlas is **original SOH art** (`build_world_art.py`), nine inherited props from
`assets/environment/overworld/overworld_props.png` carry `license:"original"` (`bush`,
`column_broken`, `rock_a`, `rock_c`, `rock_e`, `signpost`, `tree_dead`, `tree_pine`, `wall_stub`),
and **Cainos demo art was REJECTED** (standalone licence unproven); CraftPix freebie terms forbid
raw-art redistribution. `atlas.v1.json` / the provenance file still contain `cainos_*` / `ocean_*`
crop records from earlier checkpoints — MAP-R01 therefore **excludes every `cainos_*` and
`ocean_*` frame**. No claim of third-party rights or creator visual approval is made.

## Frames actually emitted at runtime (81 terrain frames)

Exhaustively enumerated by calling the shipped pure selector `selectFrameNames()` over all 8-neighbour
mask patterns and 16×16 tile coordinates; every name resolves in the ledger.

| Family | Frames | A1 origin sheet | Mask / variant rule | Web material |
|---|---|---|---|---|
| `grass_0..3` | 4 | terrain.png | `variant(tx,ty,0)%4` | `T.GRASS` base |
| `mix_grass_silt_1..15` | 15 | terrain.png | `variant%15+1` | `T.MEADOW` base |
| `forest_0..3` | 4 | terrain.png | `variant%4` | `T.FOREST` base |
| `dune_0..3` | 4 | terrain.png | `variant%4` | `T.SAND` inland base |
| `tidal_0..3` | 4 | terrain.png | `variant%4` | `T.SHALLOW` base |
| `lake_0..3` | 4 | terrain.png | `variant%4` | `T.DEEP` base |
| `river_0..3` | 4 | terrain.png | `variant%4` | `T.RIVER` base |
| `blend_grass_water_1..14` | 14 | terrain.png | corner mask `1=TL 2=TR 4=BR 8=BL`; `0` = base, `15` suppressed so a walkable tile is never painted as sea | grass/meadow ↔ water |
| `blend_grass_forest_1..14` | 14 | terrain.png | same corner mask, symmetric (`15 & ~grassMask` on forest tiles) | grass/meadow ↔ forest |
| `coast_dune_tidal_1..14` | 14 | terrain.png | edge mask `1=N 2=E 4=S 8=W`; `0` = dune base, `15` suppressed | sand ↔ water shoreline |

Mask conventions were **decoded from the atlas pixels**, not assumed: quadrant blue/green
classification for `blend_grass_water`/`blend_grass_forest`, edge-strip blue classification for
`coast_dune_tidal`, corner-opaque classification for `road_dirt`. Example: `grass_0` slice rect
`[0,0,16,16]`, A1 origin `[192,0,16,16]`, RGBA SHA-256
`29d64df5836253d14bb2ca18bc0d2579813039801d4cb52c5b1f0ba2712acb27` — exactly equal to the A1
`first_hour_asset_provenance.v1.json:a1_current` crop hash.

## Frames in the ledger but deliberately NOT emitted (100 candidates)

- `road_dirt_0..15` (16) — A1 plank blob set; **KEEP Web road** after direct comparison. Decoded
  `1=N 2=E 4=S 8=W` mask retained for a future pass.
- `rock_a`, `rock_c`, `bush`, `reeds` (4) — y-sorted prop seam candidates; **KEEP Web resource
  sprites** after direct comparison (`ASSET_DECISIONS.props=false`).
- `blend_grass_soil_0..15`, `coast_shell_tidal_1..15`, `track_dirt_0..15`, `shell_0..3`,
  `water_0..2`, `blend_*_0/15`, `coast_*_15`, `detail_dune_ripple_0..2`,
  `detail_water_ripple_0..2` and the remaining inherited props (`tree_dead`, `tree_pine`,
  `signpost`, `stump`, `deadfall`, `driftwood`, `cairn`, `fence_h`, `fence_v`, `boardwalk_post`,
  `pier_rail`, `lantern_post`, `column_broken`, `wall_stub`, `rock_e`) — admitted with full
  provenance so the next production pass can enable them without re-reading A1; none are drawn.

Full per-frame data is authoritative in `source/assets/frame_ledger.v1.json`; regenerate with
`tools/build_slice.mjs` from the A1 `ce9d4ba2` files.
