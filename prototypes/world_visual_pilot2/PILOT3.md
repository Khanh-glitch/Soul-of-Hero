# Waystation Audition — Pilot 3 (source-crop and composition correction)

Baseline reviewed: `c7b6bbc91d1b7bf3fa70da9c257a156a616e265b` (pilot 2, not accepted).
Branch: `arena/103e4440-soul-of-hero`.

**What this submission is:** a corrected asset-selection pipeline, an inspection sheet of
every frame drawn, and two compositions of the same authored Waystation corridor that are
meant to be compared, not accepted. **Everything here is a Pillow compositor render. There
is no Godot capture and no input-driven movement** — Gate 2 remains blocked, see §5.

Nothing in production was edited. A0/A1/A3/A6/A8 code and data are untouched; the corridor
window is the same SHA-pinned `data/cells2.json` used by pilots 1–2.

---

## 1. Part A — the asset-selection process, and what was wrong with it

`tools3/inspect_sources.py` renders `evidence3/inspect_sprites_1280.png` (every frame used,
with its original PNG, the selected rectangle marked on it, the extracted RGBA at 2×, alpha
bounds, source canvas size, intended scale, foot anchor, purpose and verdict),
`evidence3/inspect_rejected_1280.png` (the pilot-2 crops that are now refused, with the
measured reason) and `evidence3/inspect_materials_1280.png` (material samples). Machine
readable output: `evidence3/inspect_sources.json`.

### 1.1 Checks that now gate every frame (`sources3.validate_rects`)

| check | rule |
|---|---|
| whole object | the rectangle must be the file's alpha bbox, or **exactly** a connected component's bbox of a sprite sheet — never a sub-rectangle of a larger piece |
| no neighbour | sheet crops must equal a component bbox exactly, so a neighbouring sprite cannot be swallowed |
| not empty | alpha must be non-zero |
| no clipping | the rectangle must contain its component's bbox |
| native scale | scale is fixed at 1.0; there is no resampling path in the renderer at all |
| anchor | every sprite is foot-anchored (bottom centre) unless it is a material tile |
| placement | layouts assert unique `(crop, foot)` pairs, no two props co-located, and no prop standing on a solid `#` cell |

Result on this submission: **39 frames, 0 failing**, 7 rejected.

### 1.2 The specific investigations

**Overlapping `fence_h` / `gate`.** In pilot 2 the two rectangles were
`(0,8,144,46)` and `(96,4,64,46)`. They overlap in x = 96…144: 48 px wide, 42 px tall,
~2 000 px of shared source, and `fence_h` also clipped the next palisade bay at x = 144.
The root cause is that `Tileset2.png`'s palisade bays *touch*, so connected-component
analysis cannot isolate one bay: the whole 191 × 256 upper block is a single component.
Rather than guess a better sub-rectangle, both crops are **withdrawn**. The palisade is not
used by any pilot-3 layout. (Cost: candidate A loses the gate that pilot 2 used as its
landmark; the counter canopy replaces it.)

**Duplicate coordinates.** `burned` was appended twice at the same world point
(398.6, 203.4) by two separate edits — two identical sprites drawn at one place. The
renderer now raises on a duplicate `(crop, foot)` and on co-located props with different
crops, and the layouts are checked at build time.

**Arbitrary road rotations and healing.** Pilot 2 rotated 96 × 6 *bands* by 90° to make the
edges of a vertical road, and patched fully transparent columns of the fill strip with
`heal_columns`. Both are gone:
* material fills must now be 100 % opaque interior samples (verified, not repaired);
* the 6 px pavement edge band is the road pack's own edge, used **native** on the north and
  south borders of the paving and rotated as a whole band for the east and west borders.
  No crop is stretched, no pixel column is duplicated, no alpha is synthesised. Where a
  band would have needed inventing, the edge is simply not drawn.

**Colour-statistic clay selection.** Pilot 2 picked the "clay" tile by scoring warm-pixel
ratio over the whole pre-rendered `FieldsTileset.png`, i.e. whatever scored highest became a
material. That is replaced: solid `#` cells are drawn as a **boulder mass** from the rock
pack (56–62 px and 26–43 px frames, hash-placed, no tinting), so an impassable shelf reads
as talus and can never be mistaken for walkable ground.

**Mixed prop scale.** Pilot 2 halved trees and rocks (`scale: 0.5`, NEAREST) to fit a 22 px
D051 body. Any resampling of pixel art is now forbidden; the layout may only use frames that
are already in band. All pilot-3 sprites are native: 16–73 px against a 22 px body.

**Paving specks.** The authored `d` layer is dotted with single-cell specks. The renderer
keeps the connected paving components that read as a *place* (≥ 12 cells) and lets smaller
specks read as moor. The authored layer is **not** modified — the filter is a rendering
decision and the dropped cell count is reported in the trace.

### 1.3 Materials actually used

| material | source | rule |
|---|---|---|
| moor grass | 574220 `Ground_grass.png` | 16×16 samples from uniform blob interiors, 100 % opaque, filtered to one coherent green tone (4 samples + flips) |
| stone paving | 574220 `Road1_grass.png` | 16×16 opaque window, cool grey-blue (`blue ratio ≥ 0.35`, low spread) so the pick cannot land on timber or verge (6 samples) |
| pavement edge | 574220 `Road1_grass.png` | the pack's own 6 px band, native for N/S and whole-band rotated for E/W |
| talus | 974061 rock pack | whole boulders, hash-placed on `#` cells |

An earth-track material was derived and then **withdrawn**: at one cell wide the pack's
earth road tile is a brick course and read as a low wall across the yard
(`inspect_materials_1280.png` keeps the samples and the note).

---

## 2. Part B — two compositions, same captured geometry

Both candidates use: the authored corridor window (368,192, 50×34 cells), the authored
paving, the authored cliff, the same four POI nodes (locker 408,198 · ledger 411,202 ·
cache 406,203 · deadfall 398,202), the same entrance (403,200), the same three cameras, the
same lighting rig and the same D051 male in the gameplay frames. **Only the layout differs.**
No new POI, roof, road, reward or interaction is invented.

| | Candidate A — the post is open | Candidate B — the post was overrun |
|---|---|---|
| landmark | red counter canopy (73×65), north edge, facing the road | bracketed trophy skull (34×43) standing where the counter was |
| secondary | hand cart + planks, south-west, apart from the counter | debris diagonal: broken cart → planks → flattened crate → marker |
| hierarchy | two masses, wide empty pavement between them | one diagonal that drags the eye to the marker |
| habitation cue | barrels, crates, lantern, torch post, signpost | no torch, one guttering lantern, banner, skull sign, burned snags |
| cliff | one boulder fallen onto the paving | two boulders encroaching, moor reclaiming the east edge |
| prop count | 16 | 19 (not a quality argument — recorded only so the counts are auditable) |

Every cluster carries its reason as data (`data/layouts3.json`, `reason` field per prop) and
each prop's inspection verdict is in `evidence3/inspect_sources.json`.

### Cameras (identical for both candidates)

| station | centre | why |
|---|---|---|
| `s1_approach` | 394,201 | A1's authored `home_first` camera |
| `s2_plaza` | 400,204 | consecutive point on the same authored outbound route |
| `s3_counter` | 406,202 | arrival, POI nodes in frame |

Evidence: for each candidate and each lighting, three 640×360 frames (the logical viewport),
three 1280×720 nearest-neighbour copies, the native 320×180 world window, the full world
image, a draw-op trace and a report with per-file SHA-256 — `evidence3/report3.json`.
Characters: **male D051 only** in all 12 gameplay frames; the female body appears only in
`<layout>_<lighting>_validation_female_640x360.png`, an identical-condition capture of the
same camera and lighting. No Knight, no substitute.

---

## 3. Part C — self-critique, against the images

Read `evidence3/compare_rejected_vs_candidates_1280.png` and the two
`contact_<layout>_<lighting>_1280x720.png` sheets. What I actually see:

**Fixed against pilot 2**
1. *Sprite integrity*: every object is whole and native; no clipped fences, no red plank,
   no duplicate coordinates, no NEAREST-halved trees. Inspector-verified, not asserted.
2. *Silhouette and scale*: crates 16–25 px, barrels 20–22 px, signposts 16–21 × 40 px,
   torches 28 × 42 px, counter 73 × 65 px all sit plausibly against the 22 px body. Pilot 2's
   boulders were twice the character's height; the current talus is in band.
3. *Material harmony*: stone yard + olive moor + warm timber reads as one palette. The pilot-2
   clay shelf (auto-picked orange) is gone and the blue road ribbon is gone.

**Still wrong — my own judgement**
4. *The paving shape is the composition's biggest liability.* The authored `d` layer is
   stippled, so the yard renders as an amoeba with ragged bays and one-cell necks. Neither
   candidate turns this into a legible plaza; B's debris diagonal disguises it better than A,
   which exposes it.
5. *No clean route reading.* Because the road pack has no 3-cell-wide straight module — every
   piece is a hand-composed blob with baked fringes — a readable carriageway cannot be built
   without either a stretched crop or a synthesised fringe, both of which are refused. The
   route is therefore carried by prop arrangement and by the author's own nav cells, not by a
   painted road. **This is a source-art limitation, not a layout oversight.**
6. *Tile seams*: the pavement's E/W band rotation is invisible at the plaza's long edges but
   the 16 px step of the mask is not; the boundary still stair-steps.
7. *Contact*: props have no contact shadow. The rock pack's frames carry baked grass shadows,
   the timber sprites do not, so crates and barrels look pasted on the stone.
8. *Night*: the blue ambient multiply (0.40) flattens material difference; the warm lamp pools
   read but the yard loses its stone/grass distinction. A (two lights) holds up better than B
   (one light), which was the intent, but B's night is close to unreadable at 640×360.
9. *Player visibility*: a 22 px body at 2× is 44 px tall in a 640×360 frame — legible, but it
   is the smallest meaningful silhouette on screen; the counter canopy is 6× its area.

**Between the two candidates.** B is the more convincing image: one diagonal, one marker, a
legible story. A is tidier and easier to navigate but flatter — two masses on a field of
stone. **Neither is production-ready and I am not declaring a winner.** If a choice is forced,
B is the better read; A is the safer base to author from.

---

## 4. What was removed / reorganised / replaced

* removed: the whole pilot-2 palisade and gate (overlapping rects, unisolatable components),
  the `spikes` crop, the healed road fill, the clay auto-tile, all NEAREST downscaling, and
  the duplicated burn placement;
* replaced: the derived 175-cell road ribbon with the authored paving, and the assertion of
  quality by draw-op counts with a per-frame inspection verdict;
* reorganised: props from scattered per-cell decoration into 4–5 clusters, each with a
  stated spatial or gameplay reason, all on the authored paving or verge.

Not used as evidence of quality anywhere in this document: prop counts, source counts,
hash counts, or how long it took to build.

---

## 5. Part D — evidence, SHA, and the stopping point

Reproduce:

```bash
cd prototypes/world_visual_pilot2
python3 tools3/compose3.py --out evidence3        # layouts, 3 views, day+night, validation
python3 tools3/inspect_sources.py                 # inspection sheets + verdicts
```

Requires Pillow and the private archives under `$SOH_ASSET_VAULT`
(default `/home/user/asset_vault/x`), which are git-ignored and never committed.

Artifacts: `evidence3/` (58 PNGs + `report3.json` + `inspect_*.json` + 4 traces),
`data/layouts3.json`, `data/stations3.json`, `data/cells2.json` (A1 geometry, unchanged),
`tools3/{sources3,inspect_sources,compose3}.py`.

**Gate 2 is still not met and cannot be met in this sandbox:** no Godot 4.7 binary, no
Vulkan ICD / libGL / libEGL, and no egress to any host that serves one. Nothing in
`evidence3/` is a native capture, none of it shows input-driven movement, and the new props
have no authored collision. Native Godot capture, real input and collision verification
remain mandatory before any production integration, and should run on the existing
authorized CI runner rather than here.

**Stop point:** two candidate compositions for the creator's visual selection. No further
regions, no merge, no production edits, no self-declared acceptance.
