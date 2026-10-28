# Third-party environment art — evaluation record

Every asset considered for the overworld is listed here with what was measured,
what was accepted, and what was rejected. The rule the mission set is that art
is judged from the real thing, so each decision below cites a number or a file,
not an impression.

Nothing in this document was decided from a thumbnail.

## What is actually on disk

| Source | Where | License |
| --- | --- | --- |
| 0x72 DungeonTileset II v1.7 | `assets/environment/dungeon_0x72/dungeon_tileset_ii.png` (512×512) | CC0 1.0 (`THIRD_PARTY.md`) |
| 0x72 low-wall atlas | `assets/environment/dungeon_0x72/atlas_walls_low.png` (192×64) | CC0 1.0 |
| Eight downloaded packs | `assets/library/downloaded/` (`complete_ui_book_styles_free`, `dark_vfx_01_02`, `flying_demon_2d_pixel_art`, `free_topdown_pixel_dungeon`, `rpg_arsenal_1_1`, `rpg_icons_400`, `treasure_chests_1_2a`, `wizard_pack`) | mixed, recorded per package in `data/asset_library/download_catalog.json` |
| Download catalog | `data/asset_library/download_catalog.json` — 87 packages | per package |

## Dark World and Classical Ruin Tiles — not evaluable

Both were named in the mission and neither exists anywhere in this repository or
in the asset catalog:

- `data/asset_library/download_catalog.json` lists 87 packages. Searching the
  whole catalog for `dark`, `ruin`, `classical`, `dungeon`, `cave`, `crypt`,
  `tomb` and `castle` returns six ids — `rpg_worlds_caves_2_1`,
  `free_topdown_pixel_dungeon`, `dark_vfx_01_02`, `necromancer`, `nightborne`,
  `blood_moon_tower_free` — and none of them is a Dark World or Classical Ruin
  tileset. Three of the six are marked `missing_local_proof` in the catalog.
- A filesystem search for `*dark*world*`, `*classical*ruin*` and `*ruin*tile*`
  over the working tree returns nothing.
- The packs are therefore **not evaluable**, which is not the same as rejected.
  No claim is made about their quality. To make the evaluation possible the pack
  (and its license terms) has to be supplied; the acceptance test that would run
  the moment it arrives is the same one applied to 0x72 below.

## 0x72 DungeonTileset II — accepted for dungeons, rejected for the overworld

The atlas is top-down, which is the first requirement: it is not side-view art
being forced into a world it was not drawn for. It is already the source for the
Chapter 1 dungeon interiors (`game/levels/crypt_entrance.tscn`,
`game/levels/dungeon_level.gd`), where its 16×16 grid, hard black outlines and
24-colour ramp are consistent with the dungeon palette. **That integration
stays.**

For the overworld it fails on two measurements.

### 1. Terrain: it would print a grid over the world

The overworld's ground tiles are generated to be seamless, because the world is
a single contiguous field of them. Mean absolute channel difference across a
tile's outer edge ("seam score", lower is better) for the overworld's own ground:

| Tiles | Frames | Median seam | Worst |
| --- | --- | --- | --- |
| `dirt` | 5 | 1.56 | 2.35 |
| `grass` | 6 | 1.15 | 2.16 |
| `gravel` | 4 | 0.66 | 1.26 |
| `moor` | 4 | 1.16 | 1.54 |

The same measurement on the 0x72 atlas's floor tiles, over the twelve fully
opaque 16×16 candidates in its floor block: best case **14.6**, typical
**18–25**, i.e. roughly ten to twenty times the overworld's seam. Tiled across a
region, those tiles draw a visible lattice — exactly the artefact the overworld's
autotiling exists to avoid. (The overworld's own `path` and `road` tiles score
41 and 20 on purpose: they are *edge* frames chosen by a neighbour mask, not
fills, so the number there is a feature and not a defect.)

### 2. Props: the scale does not divide

Overworld prop frames are sized to their object, not to a 16×16 lattice —
`sarcophagus` 34×22, `gravestone` 18×26, `cart` 38×26, `column` 20×46. The 0x72
props are strict 16×16 sprites. Reusing them means either non-integer scaling,
which destroys pixel art, or accepting sprites a third of the size of the
overworld's equivalents. Neither is an improvement, so no 0x72 prop is used in
the overworld.

### 3. Provenance

The overworld sheet's frame-by-frame provenance is in
`data/overworld/art_manifest.json`. Every frame is either `generated` (original
work in `tools/overworld/art.py` / `art_props.py`) or an `override` in
`assets/environment/overworld/overrides/`. Both are original work owned by the
project, and the manifest says so per frame, so adding a CC0-derived frame later
would require recording the pack and its license there — the audit reads the
manifest, not this document.

## Summary

| Asset | Verdict | Reason |
| --- | --- | --- |
| 0x72 DungeonTileset II — dungeon interiors | **accepted** (in use) | top-down, grid-consistent with the dungeon palette |
| 0x72 DungeonTileset II — overworld terrain | **rejected** | seam score 14.6–24.9 vs the overworld's 0.66–2.35 |
| 0x72 DungeonTileset II — overworld props | **rejected** | strict 16×16 grid vs prop frames of 18–46 px; no integer fit |
| Dark World tileset | **not evaluable** | not present in the repository or the catalog |
| Classical Ruin tileset | **not evaluable** | not present in the repository or the catalog |

The overworld's art therefore remains entirely generated-plus-handpainted in this
repository. Where a frame needed a human hand, it is an override PNG (six
landmarks, four camp props today), not a third-party import: see
`docs/overworld/ART_DIRECTION.md` and `tools/overworld/manual_landmarks.py`.
