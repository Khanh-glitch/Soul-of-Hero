# Chapter 1 — audit of Levels 1–10

**Status: AUDIT ONLY. No game, art, data or level code was changed.**

This is the report the owner asked for: a deep look at every corner of every
level, the defects it turned up, and — for each one — the *approach* to fixing it.
No fix has been made. The only commits that accompany this report add observation
tooling (`tools/captures/chapter1_audit_sweep.*`, `tools/chapter1_audit/audit_sheets.py`,
`.github/workflows/chapter1-visual-audit.yml`) and the images this report cites.

---

## Tóm tắt (tiếng Việt)

Vòng audit đã chụp **toàn bộ** 10 level (không chỉ 5 trạm như bản handoff), ghép
thành ảnh mosaic 1:1 với từng pixel art, và đối chiếu với mô hình dựng hình của cả
hai pipeline. Kết quả chính:

1. **Bị cắt ở mép trên** (đúng như ảnh mẫu số 2 của bạn): mọi level 2–10 có tường/
   mặt dựng vẽ *phía trên* dòng 0 của map, tức là ngoài giới hạn camera, nên phần
   đỉnh bị chặt phẳng. Nặng nhất L7 (176 ô), L5 (139), L6 (122), L9 (64).
2. **Lỗ thủng giữa sàn** (cùng họ với ảnh mẫu số 1): L1–L4 có các "đảo" tường bao
   quanh một khoảng trống **không được vẽ gì**, nên hiện ra như cái hố đen có viền
   đá: L4 640 ô / 5 hố, L2 762 / 6, L3 182 / 6, L1 112 / 3.
3. **Prop đặt sai chỗ**: 53 prop vượt lên trên map và bị cắt giữa sprite; 2 khung
   hình không tồn tại trong atlas nên **19 prop ở L7 và 2 ở L8 không hề được vẽ**;
   prop chồng nhau (L5 79 cặp, L7 45, L8 34, L6 24); 2 prop che **thẳng lên vật thể
   tương tác** ở L9 (một trong 3 ấn của màn bị vùi dưới lò than).
4. **4 huy hiệu ấn ở L9 bị khuyết**: mỗi vòng thiếu 2–4 ô, nhìn rõ là vòng bị hở.
5. **Đường kẻ 1 px** (conduit/iron/lane) chạy xuyên sàn, tường và prop ở L6, L7, L9,
   L10 — đọc ra như nét vẽ vector/đường dây debug chứ không phải kiến trúc.
6. **Không có tương phản sàn–tường** ở L5, L6, L7, L10: sàn và đá nền cùng một giá
   trị sáng, nên không đọc được đâu là phòng.
7. **Cháy sáng** ở L7 (beacon trắng xoá, có cả mảng sáng hình chữ nhật vuông cạnh),
   L8 (hai cánh gần như trắng), L9 (nền đỏ bão hoà).
8. **Lặp y nguyên**: L7 có 4 cụm trang trí giống hệt nhau ở 4 góc; L6 có 3 "crystal"
   giống hệt; L10 có 4 chân nến giống hệt; L8 hai cánh lặp cùng một nhịp.
9. **L1–L4 không có prop nào** — chỉ có tường + sàn + vài đường trim; cả 4 màn dùng
   chung một theme duy nhất (`crypt_entrance.json`) nên nhìn như 4 biến thể của một
   màn, không có bản sắc riêng.

Thứ tự ưu tiên đề xuất và phương pháp fix cho từng lỗi ở phần **Fixes** bên dưới.

---

## 1. How this was observed

The handoff evidence photographs five named stations per level. Five frames cannot
audit a map: an 1856×1344 level is nearly three screens wide, and the stations sit
on the objectives. So the audit needed its own eyes.

**The sweep.** `tools/captures/chapter1_audit_sweep.tscn` boots the production
`AppRoot` / `AppFlow` exactly like the review harness, hides every actor and the
HUD, and steps the player camera across the level's own `camera_bounds` on a grid
that overlaps by a quarter frame. It records, per frame, the world rectangle the
renderer actually drew — read back from the viewport's canvas transform, not from
the camera. That distinction matters: `Camera2D.get_screen_center_position()`
returns the centre the camera is *aiming at*, and once a camera limit clamps the
view it disagrees with the pixels by tens of pixels. The first mosaics were built
from it and invented seams that looked exactly like map defects.

**The stitch.** `tools/chapter1_audit/audit_sheets.py` puts the frames back where
they were drawn, then checks that overlapping frames agree. Absolute brightness is
not a fair test (torches flicker between frames), so it searches a small shift and
reports the worst shift that produced the best agreement: `overlap_worst_shift_px`
in each `L<nn>_mosaic.json`. A non-zero value there would mean the mosaic is lying;
the alignment claim in this report only holds while it is 0.

**The scale.** The chapter renders to a 640×360 canvas which the window upscales
by 2. A 1280×720 screenshot is therefore 640×360 *world* units. Frames are reduced
by that integer factor with nearest-neighbour sampling, so **one mosaic pixel is
one art pixel** — the resolution the tiles were drawn at.

**Coverage** (`coverage_of_content`): 0.990–1.000 of the authored content rectangle
in every level. The mosaics live in `docs/chapter1-audit/`, with the per-level
manifests in `manifests/` and the run logs in `logs/`.

**Second, independent eye.** A model of both renderers
(`crucible_art.gd` for L5–L10, `chapter1_environment_art.gd` for L1–L4) was built
from the level JSON, the architecture documents and the kits, and used to count
what the renderer will paint where — wall stacks, facade rows, prop sprite
rectangles, camera limits. Findings that come only from that model are marked
**(static)**; findings confirmed in the mosaics are marked **(seen)**.

Crops used in this report are in `docs/chapter1-audit/detail/`. They are 2–3×
nearest-neighbour enlargements of the mosaics, brightness-lifted where a level is
too dark to read (lifted crops are noted).

---

## 2. Findings

Severity: **P0** = the defect breaks the read of a room or an objective;
**P1** = visible ugliness in normal play; **P2** = polish.

### A. The top of the world is cut flat — P0 *(this is the owner's image-2)*

**(seen)** Every level except L1 paints masonry, cornice and coping *above row 0
of the map*. Row 0 is the camera's top limit (`camera_bounds` start at `0,0` in all
ten levels), so that paint lands outside the visible world: the wall either stops
dead at the top of the screen, or its top course is sliced in half.

Evidence: `detail/clip-top_L05_gate-arch.png` — the stone arch and the emblem above
it are cut by the map's top edge; the same happens to the gate in L9
(`L09_mosaic.png`, top centre) and to the throne room in L10.

| level | painted cells above row 0 | columns affected | top wall face at row |
|---|---|---|---|
| L1 | 0 | 0 | 3 (51 cells sit exactly on row 0) |
| L2 | 19 | 19 | 3 |
| L3 | 48 | 16 | 0 and 3 |
| L4 | 50 | 50 | 3 |
| L5 | 139 | 69 | 1 |
| L6 | 122 | 61 | 3 |
| L7 | 176 | 88 | 3 |
| L8 | 40 | 20 | 3 |
| L9 | 64 | 32 | 3 |
| L10 | 40 | 20 | 3 |

**(static)** No level has any solid rows above its top wall face, so the wall stack
always runs out of map. L3 and L5 are the worst cases in kind: their authored
content reaches row 0, so *nothing* can ever be stacked above their top wall.

### B. Props cut in half at the top edge — P0

**(seen)** Sprites that reach above the map are clipped mid-sprite: the top of a
flame, the top half of a banner, the head of a torch. **(static)** 53 sprites:

* L6 — 6: `sconce` at row 3 (sprite top +32), `banner` at (52,3) and (114,3)
  (top −32), `lamp_standing` at (113,5).
* L7 — 33: `watch_pillar` at (45,8) and (51,8) with sprite top **−2 px**; `crates`
  at rows 4 (top +40); `spears` at (48,4) and (80,4).
* L8 — 3: `column` and `gate_frame` (top −60 / −20).
* L9 — 9: `gate_arch` (48,11) top +36, `gate_tower` (41,11) +40,
  `gate_tower_l` (55,11) +40, `banner` (36,3) and (60,3) top −52,
  `trophy_shields` (34,3) and (62,3), `brazier` (38,3).
* L10 — 2: `portal_pillar` (top +22).

Mosaic view: `L07_mosaic.png` top edge, where the prop row along the wall is a row
of chopped objects.

### C. Holes in the floor — P0 *(the family the owner's image-1 belongs to)*

**(seen)** In L1–L4 the layout contains "islands": small runs of wall that enclose
cells with no tile at all. `chapter1_environment_art.gd` paints the island's faces
and its coping, `_build_facade()` backs only *geometry* cells, and nothing paints
the enclosed cells. The result is a masonry frame around a pure-black shape, sitting
in the middle of a lit floor.

Evidence: `detail/holes_L01_room-island.png` (a stone well with an irregular black
notch), `detail/holes_L04_framed-void.png` (a 28×10-cell black rectangle with a
stone rim and a coping course, in the middle of a hall).

| level | enclosed void cells | separate holes | largest hole |
|---|---|---|---|
| L1 | 112 | 3 | 80 cells |
| L2 | 762 | 6 | 492 cells |
| L3 | 182 | 6 | ~120 cells |
| L4 | 640 | 5 | ~400 cells |
| L5–L10 | 0 black holes | — | bedrock covers them (see F) |

The same motif as the owner's example: a small, ornate, self-contained element
standing on a bare surface with nothing around it and no reason to be there.

### D. Props that stand for nothing — P0/P1

**(static)** Six different failures, all of them visible as an object that is
clipped, buried, doubled or absent:

| failure | L5 | L6 | L7 | L8 | L9 | L10 |
|---|---|---|---|---|---|---|
| sprite reaches above the map (B) | – | 6 | 33 | 3 | 9 | 2 |
| sprite outside the map rectangle | – | 2 | 5 | 3 | 4 | – |
| prop pair overlapping >30 % | 79 | 24 | 45 | 34 | 3 | 2 |
| two props on one cell | 10 | 1 | 2 | – | – | – |
| prop sprite over the wall band | 96 | 72 | 84 | 63 | 26 | 13 |
| prop over an interactive entity | – | – | – | – | 2 | – |

Two of these deserve their own line:

* **(static) Frames that do not exist.** L7 places `barrels` at 19 cells and L8
  places `banner_pale` twice; neither name is in `vigil_props.json` /
  `reliquary_props.json`. The placements are silently dropped — the level is emptier
  than its document says, and no gate catches it.
* **(seen) A seal buried under a prop.** `seal_brazier` at (80,46) is drawn over
  `gate_seal` at (78,45). One of L9's three seal stations is half-hidden — see
  `detail/props_L09_seal-buried.png`, where the brazier covers the right side of
  the ring. `exit_gate` at (48,7) is likewise covered by `gate_arch` at (48,11).

Duplicated props on one cell produce the "two lamps in one brazier" read, e.g. L7
(66,11) and (71,26) (brazier + barrel + torch bracket on one cell), L8
`sarcophagus` + `sarcophagus_open` at (37,22)/(38,23), L10 `candelabrum` + `rubble`
at (47,57).

### E. The four seal medallions in L9 are broken — P0

**(static + seen)** The gate seals are assembled from 25 offset-named floor tiles
(`ring_-2_-2` … `ring_2_2`). On all four medallions some offsets are missing over
walkable floor, so the circle has notches:

| medallion | tiles placed | missing over floor |
|---|---|---|
| (18,45) | 18 | 3 |
| (48,7) | 20 | 5 (one is the empty centre) |
| (48,32) | 22 | 3 |
| (78,45) | 15 | 2 |

Seen in `detail/props_L09_seal-buried.png` (the ring is open on its right side) and
in `L09_mosaic.png` at all four medallions. The same tiles are red-on-red against
the level's brick, so the intact parts barely read either.

### F. Flat rock: interiors read as emptiness, not as stone — P1

**(seen)** L5–L10 fill the whole map rectangle with bedrock (`_build_bedrock`).
That fixed the black voids of the earlier build, but the fill is a single flat
texture with a checker of two frames, so a room is surrounded by a large field of
undifferentiated grey. **(static)** 534 cells in L5, 568 in L6, 228/224/222/180 in
L7–L10 are "rock": neither a wall band nor a face, just paint. In L5 and L6 the
value of that rock is nearly the value of the floor, so the room does not separate
from the stone it was cut from.

**(seen)** Related: `_build_walls()` fills each uncovered *geometry* cell with a
rock tile, so isolated masonry clumps float inside the rock field (L7's right side,
`detail/light_L07_beacon.png`, the brick clump at mid-frame). They read as debris,
not as structure.

### G. Lines that read as vector guides — P1

**(seen + static)** Several levels paint long runs of a 1-cell frame that renders as
a thin line with a hard border: `conduit_h` × 286 and `conduit_v` × 25 in L6,
`iron_v` × 113 and `iron_h` × 85 in L9, `lane_h` × 332 and `lane_v` × 274 in L7,
`carpet_v/h` in L10. Over a floor they read as wiring or as debug guides; they pass
straight through wall bands and behind props.

Evidence: `detail/line_L09_iron-run.png` (two vertical iron runs crossing a wall,
a seal and the arena), and the near-vertical lines in `L06_mosaic.png` and
`L07_mosaic.png`.

Related, in the same family **(seen)**: hanging chains render as a 1-pixel dashed
line (visible in `detail/clip-top_L05_gate-arch.png`, right of the arch, and in
`detail/hero_L10_throne.png`) — the link texture is effectively invisible at this
size, so the chain reads as a rendering artefact.

### H. Floor and wall are the same material — P0 in L5/L6/L7/L10, P1 elsewhere

**(seen)** In L5, L6, L7 and L10 the walkable floor and the wall banding sit within
a few percent of the same value; the only difference is a texture. There is no
contact shadow at the wall foot, no coping in a contrasting stone, and no
distinction between "the paving you walk on" and "the stone it is cut into".
`detail/clip-top_L05_gate-arch.png` shows a floor and a wall in the same grey;
`L06_mosaic.png` is one pale-green field from edge to edge;
`L07_mosaic.png` is one tan field from edge to edge.

L8 and L9 do have figure/ground (cool floor vs crimson floor, gold coping), which
is why they read as rooms — but both are then over-lit into white (I).

### I. Blown-out light — P0 in L7/L8, P1 in L5/L6/L9

**(seen)** Additive lights stack until the centre of a feature is pure white:

* **L7 beacon** (`detail/light_L07_beacon.png`): value 255 over a large area, and —
  worse — the bright area has a **straight vertical edge**, i.e. a rectangular glow
  sprite whose bounds are visible in the world. Six copies of the same flame sprite
  and four of the same shield sit in one pile.
* **L8** (`detail/wash_L08_reliquary-wing.png`): the wing's wall and columns are
  230–255, detail gone; the floor of the crimson wing is a pink wash.
* **L9**: the arena floor around the gate is saturated red with the highlights
  clipped; the ambient is `[0.54, 0.46, 0.46]` on a `[0.046, 0.028, 0.032]`
  background, so there is a single bright plateau and no falloff.
* **L6**: 22 lights over a pale palette; walls and floor both wash to the same
  near-white at bay centres.

### J. Repetition — P1

**(seen)** Identical objects at identical spacing:

* L7: four identical dressing clusters, one per quadrant (`L07_mosaic.png`), each
  with the same crates/spears/shields/torch arrangement. This is the specific thing
  the previous brief ruled out ("no brick facade + torches every N").
* L6: three identical crystal-crown shrines on the same diagonal, and repeated pylon
  pairs down every wall.
* L8: five identical crimson drums across the vampire wing, five identical spires
  across the reaper wing.
* L10: four identical candelabra at mirrored positions; four identical banners.
* L5: the same urn/altar prop repeated around both arenas.

### K. Hero props do not read as what they are — P0

**(seen)**
* **L10 throne** (`detail/hero_L10_throne.png`): reads as a *bed or a shop counter* —
  a white slab, a pink slab, three grey panels with yellow diamonds and two hatched
  "curtains". It also carries a **pure-white 1-px outline** on the seat and the dais,
  which no other prop has. The crown above it floats with no connection.
* **L7 beacon**: a pile of six flames and four shields; the "beacon" itself is not
  identifiable.
* **L5 altars**: the red bowls on stone rings read as *tubs* — the rim/mouth
  treatment is a bright ellipse with no depth.
* **L6 crystal shrines**: three identical cones with a glowing ring; scale relative
  to the doorways is ~2×, so they read as decor placed at the wrong scale.
* **L9 gate**: the strongest hero prop in the chapter (blue portcullis in a pink
  arch) — and it is the one that is cut at the top.
* **L8 comparison**: the two wings are the clearest idea in the chapter (cold blue
  vs crimson), and it survives the over-exposure.

### L. Levels 1–4 have no dressing and no identity — P1

**(static + seen)** L1–L4 have no architecture document and therefore no prop
layer: `chapter1_environment_art.gd` builds facade, floor border, wear, trim,
shadows and lights only. Their sprites come from the level's own `Decor` tilemap.
All four additionally load the same theme (`data/environment/chapter1/`, one file
per level, all with identical `facade`, `trim` and `trim_spacing`), and L5's theme
file `crypt_entrance.json` is byte-identical to the others.

**(seen)** The consequence is a set of halls that differ only in layout — same floor,
same wall band, same tan coping, same sparse decor — floating in a flat black
background. L2's coping courses across a corridor read as a comb; L3 and L4 add the
framed holes of (C).

### M. Static data defects

* **(static)** L5's floor layer lists 87 cells twice, 86 of them with *different*
  frames; the last write wins, so the composition silently loses 87 authored tiles.
* **(static)** L7 `barrels` (19 placements) and L8 `banner_pale` (2) reference frames
  that do not exist in the atlas (see D).
* **(static)** L9's ring tiles are referenced by absolute offset names, which makes
  the medallion's completeness impossible to verify by eye and easy to break (E).
* **(static)** L5 `WALL-ISLAND`: 21 geometry islands of ≤6 cells, most of which
  enclose void (C).

---

## 3. What is *not* a defect

Some things in the mosaics look like defects and are not:

* **Seams between frames.** Verified by the shift search in the stitcher; see
  `overlap_worst_shift_px` in each mosaic's JSON.
* **Colour patches that differ between two frames of the same place.** Torch light
  flickers per frame; a mosaic cannot be seamless where the light moves.
* **Floating text and item labels** (e.g. "Kẻm" + count in L5, a magenta mark in L9).
  These are world-space UI, left visible because the sweep hides CanvasLayers, not
  entities. They are not part of the map.
* **Black outside the rooms.** That is the level background
  (`[0.05, 0.035, 0.04]` in the L1–L4 themes). Whether a dungeon should float in an
  unlit void is a design question (see K/L), not a rendering bug.
* **Floor "components" that appear disconnected** in a flood fill: doors are
  entities, and the sweep hides entities, so a short flood fill can strand a room
  that is in fact connected through a door.

---

## 4. Fixes — approach only, nothing applied

Ordered by what a player notices first. Each fix is described as a method so it can
be scoped before anyone touches a file.

**1. Stop the world being cut at the top (A, B).** Two viable methods, and the
chapter probably needs both:
* *Renderer clamp.* When a wall's stack would rise above row 0, compress it instead
  of drawing off-map: extrude 0 cells at the top row, paint the cornice and coping
  into the topmost in-map rows, and finish the wall with a coping tile at row 0.
  Same for props: clamp the anchor so a sprite's top is never above `y = 0`, or
  shift the cell down by `ceil(-top/16)`.
* *Authored depth.* For the three hero compositions (L5 portal, L9 gate, L10 throne)
  the wall above the feature is part of the subject, so give those rooms real
  geometry rows above the top face and move the room down the map, rather than
  flattening the architecture.
Either way, add a validator rule: **no painted cell above the camera's top limit**,
counted per level, so this cannot come back.

**2. Close the holes in the floor (C).** Decide per island what it is. If it is a
pillar or a well, fill its interior with structure (rock face, or a pit interior
with a rim and depth shading). If it is a plan accident, floor it. The rule to
enforce: **inside the playable rectangle, no cell may be unpainted unless it is
outside the map silhouette.** A validator can find these by flood-filling void from
the rectangle's border and flagging every void cell it does not reach.

**3. Make the props honest (D, E).**
* Validate that every placed frame exists in the kit's atlas — this alone restores
  19 + 2 props and turns two silent failures into a gate failure.
* Validate "one prop per cell", "sprite top ≥ 0", "prop cell not an entity cell",
  "prop not over a solid band unless it is a wall fixture with an explicit anchor".
* Move the L9 seal brazier off `gate_seal`, and the L9 gate arch off `exit_gate`.
* Generate the seal medallions from a single 5×5 pattern table (one source of
  truth), assert all 25 offsets are written, and restyle them so they read against
  the brick (contrast, not a 1-px red ring).

**4. Give the stone a value structure (F, H).** Bedrock needs to be *architecture*,
not fill: large courses, a value gradient that darkens away from the room, a dark
contact band at the foot of each wall, rubble only at the edges. Separately, pull
floor and wall apart by at least ~20 % lightness and stop painting lone geometry
cells as loose rock inside the fill.

**5. Cap the light (I).** One budget per room instead of a budget per light; smaller
inner radii so cone tips do not clip; a vignette; and replace any glow whose bounds
are visible with a radial texture verified for a clean alpha edge (the L7 rectangle
is the immediate example). L8's two wings and L9's arena should be re-lit from the
ambient up, not from the torches down.

**6. Turn the line motifs into architecture (G).** If the conduit/iron/lane runs
carry meaning (the lane markings in L7 do), make them read as built elements: two
cells wide with a shoulder tile, anchors at intervals, ends that terminate in a
piece of masonry, and a z-order rule that keeps them off props. Otherwise cut them
back to short inlays. Chains need a bigger link (2 px minimum) or a different
rendering at this scale.

**7. Break the repetition (J).** Per-instance variation: mirror frames, tint
variants, damage states, and a cap on how many identical props may share a screen.
L7's four quadrants and L8's two wings are the two places where an identical rhythm
is doing the most damage.

**8. Rebuild the three hero props K.** L10's throne needs its own silhouette pass
(taller back, arms, visible steps, no white outline); L7's beacon needs to be a
single readable object; L5's altars need depth in the bowl. This is the smallest
list with the largest effect, because these are the frames the player stands in
front of.

**9. Give L1–L4 a dressing layer and their own themes (K, L).** The renderer already
supports props, trim, wear and lights; these four levels simply have no documents.
Giving each one a theme (trim colour, coping, floor wear, light colour) plus a small
prop layer would remove most of the "same four rooms" impression without touching
layout, IDs, rewards or progression.

**10. Fix the data (M).** De-duplicate L5's 87 doubled floor cells, restore the two
missing kit frames, and add the two validators above to CI so the class cannot
return.

---

## 5. Per-level one-liners

| level | the audit's read |
|---|---|
| L1 | Cleanest of the four. Three framed holes (C), no dressing (L). Nothing clipped. |
| L2 | Largest map; six framed holes, one 492 cells; the coping across corridors reads as a comb. 19 facade cells clipped (A). |
| L3 | Content reaches row 0, so the facade is cut where it matters most. Six holes. |
| L4 | Worst holes in the chapter (640 cells, 5 of them) — large black rectangles with stone rims. 50 clipped facade columns. |
| L5 | Strong arenal composition, but dark and flat: rock 534 flat cells, 96 props over masonry, 79 prop collisions, 87 doubled floor cells. Portal arch cut at the top. |
| L6 | Reads as one pale-green field (H). 286+25 conduit cells as hairlines (G), 3 identical shrine clusters (J), 6 clipped sprites. |
| L7 | Best layout discipline (void only 36 cells), worst dressing: 4 identical clusters, blown-out beacon with a visible rectangular glow (I), 33 clipped sprites, 19 barrels that never render. |
| L8 | Clearest idea in the chapter (blue wing / crimson wing), killed by exposure (I) and repetition (J); 150 one-tile-tall wall faces mean the facade can never stack (A). |
| L9 | Strongest hero prop (the gate) — and it is the one cut at the top. All four seal rings broken (E), a seal buried under a brazier (D), iron runs as hairlines (G). |
| L10 | Legible throne-hall composition; the throne itself does not read (K), 4 identical candelabra, red carpet at maximum saturation, top wall cut. |

---

## 6. Reproducing this audit

```
# CI: photographs every level and publishes the mosaics
.github/workflows/chapter1-visual-audit.yml      (push, or workflow_dispatch)
# local, per level:
godot --path . --resolution 1280x720 \
  res://tools/captures/chapter1_audit_sweep.tscn -- \
  --slot=9 --out-dir=res://.artifacts/audit/level_9
python3 tools/chapter1_audit/audit_sheets.py \
  --artifacts .artifacts/audit --out docs/chapter1-audit
```

The run logs in `docs/chapter1-audit/logs/` print, per level, the camera bounds,
the authored content rectangle, the world view of one frame, and one line per frame
with the world rectangle it drew. Those logs are the audit's own record that the
pictures it reasons about are the pictures the game made.
