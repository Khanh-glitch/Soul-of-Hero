# R13 map-art escalation — full supplied-asset exploitation

## Status and honest boundary

**Implementation/source-validation record. Native after-art evidence is pending at this writing.**

This is an A1 world-source semantics and visual-presentation change on the existing
`world:soh_continent_v1`. It is not an A0 production mount, an A8 interior/loot
acceptance, D051 visual acceptance, human playability acceptance, or a claim that
the continent is hand-painted production-complete. The 11 authored presentation
windows remain benchmarks; they are not a substitute for live continent coverage.

The pre-art native baseline is run `41218574375` at
`e1e4e9a4d4a0f7f0d38360d638715a0c9f144208` (15 native PNGs). The later
instrumentation-only run `41221287667` at
`1d9a788f34edcbb9ec6e5403cf5fe5c053e2dd8c` did **not** produce a route report or
PNGs: Godot rejected two inferred Boolean types in the new route driver. Explicit
`bool` declarations fix that test-only parse error. No route/geography change was
made in response. That run also retained the separate licensed-art transport
failure; supplied-art rights are not being re-litigated here.

## Actual pixels versus catalog rows

The selected outdoor grammar is the committed **Cainos / Ocean Cainos** 16 px
three-quarter family. All imported frames are unscaled and unrecolored source
rectangles. The source ref recorded for the imported binaries is
`e1e4e9a4d4a0f7f0d38360d638715a0c9f144208`, the last pre-escalation A1 art baseline.

- 36 new atlas frames: 10 terrain and 26 prop crops.
- Ground sources: `cainos_tileset_grass.png`, `cainos_tileset_stone_ground.png`,
  and `ocean_tileset_grass.png`.
- Prop sources: `cainos_plant.png`, `cainos_props.png`, and `ocean_plant.png`.
- Existing Overworld inherited frames and every legacy atlas rectangle remain
  present; new frames are appended rather than blindly re-pinning old crops.
- Chapter 1 interior art, archive-audition interiors, and the inspected dungeon
  water/wall/trap family are documented as **not used for this outdoor P0**.
- Catalog-only rows without committed readable pixel paths in the scanned refs
  are named separately in the manifest. A catalog row is not treated as an image.

`data/survival/world/art/asset_exploitation.v1.json` is the authoritative
human/machine-readable source inventory. For every imported frame it records the
source file, source ref, source-file SHA-256, exact `(x,y,w,h)` source rectangle,
atlas rectangle, source-raw and atlas-raw RGBA hashes, scale, semantic role, and
palette/perspective policy. Atlas alpha composition may normalize RGB in fully
transparent pixels; tests therefore verify source and atlas hashes separately
and require exact visible RGBA and alpha equality.

## Live continent method (not 192 chunks of random filler)

`tools/survival/worldgen/compile_continent_art.py` emits
`data/survival/world/art/continent_decor.v1.json` with exactly 192 chunk records.
The committed composition has 2,081 props in 156 non-empty chunks; empty chunks
are allowed and expected. Placement uses stable hash ranking **inside causal
eligible clusters**, not a uniform decoration quota.

- **Macro:** authored 1024×768 geography, coast/river/region silhouettes, 64×64
  chunks, water, roads, POIs and collision remain unchanged. Live non-curated
  ground uses source surface/biome mappings with the real Cainos/Ocean tiles.
- **Transitions:** a deterministic three-cell visual blend band samples the
  actual adjacent region at authored region rectangles. It changes only chosen
  ground frames, never region IDs, source layers or collision.
- **Meso:** road margins, real junctions, forest/stone masses, resource/POI/spawn
  clearances and explicit Quarry/Orchard compositions determine clusters.
- **Micro:** low tufts/stones use eligible walkable margins; tall scenery stays
  off roads and outside spawn/POI/resource clearances. All of it is visual-only;
  no new collider, build permission, POI, reward or save behavior is emitted.
- **P0:** 14 Quarry approach props plus 8 low shell-edge accents; 13 Orchard
  approach props plus 6 low shell-edge accents. A8's public 128×128 transform
  and doorway-clear rectangle derive the perimeter positions. Canonical,
  approach, retreat, road, spawn, resource and doorway cells stay clear.
- **First hour:** the existing Crown treatment is revised in place. It now has
  28 sourced decorative props and 15 distinct real-asset prop frames, while the
  cache IDs/cells/frames, Waystation anchor, route and canonical corridor pin
  remain intact.

The runtime fail-closed loader verifies the decor file hash, atlas/world-plan
pins, real-asset manifest hash, 192 chunk records, frame bindings and per-cell
curated-window exclusion before mounting the stream.

## Canonical and owner preservation

No A0 GameRoot, dynamic player-collision integration, world/save authority,
camera, A8 local scene, or A3 loot source is edited by this work. Canonical
1024×768 geography, 192 chunks, Knight body pins, routes, source walk/build
layers, POI coordinates and R13 façade behavior remain the contract.

The explicit first-hour relock preserves the `ad39bde6` A0 historical profile
and baseline payload hashes. Only Crown `props` may differ; Amber/Frost payloads,
all other Crown payload keys, and canonical instance/POI bindings must remain
identical. `relock_first_hour_art.py` fails otherwise.
`repin_r13_visual_sources.py` updates only enumerated A1 visual pins.

## Physical route and evidence contract

The native driver physically follows the committed first-hour route from
`[392,200]` through supply layby `[400,220]` to Waystation `[408,199]` and back:
66 outbound cells and 30 return cells. InputBootstrap remains mandatory. Travel
uses the real CharacterBody2D controller; the route itself permits zero position
writes and the report independently checks streaming, teleport and contact
violations.

The after-art native matrix is seven views × three resolutions = **21 PNGs**:
Quarry day/night, Orchard day/night, Crown→Mirrormere transition, first-hour
layby and first-hour Waystation at 1280×720, 2560×1440 and 3840×2160. All are
native 1× with a 640×360 logical viewport. The independent validator additionally
requires every capture to report the new renderer: at least 30 real asset frames,
192 chunk records, at least 1,000 bounded decor props, the three-cell transition
band and a 40-character source ref. These are anti-stale-renderer checks, not a
visual acceptance score.

Before/after review must compare the new native Quarry, Orchard and transition
PNGs against the frozen pre-art run above. Non-native Pillow previews are sanity
renders only and are never substituted for that evidence.

## Source gates and downstream actions

Final candidate source gates: **173 survival-world tests passed** (including the
43 focused art/provenance/R13 tests), R13 and Round 12 compiler `--check` passed,
world-art/mount validation passed, GDScript parsing and workflow YAML parsing
passed, and double-compile determinism passed for 278 JSON artifacts with tree
SHA-256 `7f5e5521b3c2de1495a85d4591b9ef4f4bff54a3041b2a7e1c00fa4e88293b78`.
The exact final native run/SHA is recorded in the PR20 submission rather than
being inferred from this implementation document.

Downstream consumers should retain the atlas/manifest/decor files together,
consume the existing façade, and leave production mounting, A8 interaction/loot,
D051 acceptance and human visual/playability acceptance to their explicit owners.
