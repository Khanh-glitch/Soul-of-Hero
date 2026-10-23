# Environment Art Audition — Candidate B: "The Monastic Archive"

One room, playable in Godot 4.7: the entrance to a damaged underground archive of a
monastic house. Everything visible in the room — tiles, props, wall caps, niche
reliefs, lighting sprite — is original art authored for this audition by
`art_src/author_archive_art.py`. No third-party sprites are used, so there is no
licence question to document: provenance is this repository.

Pass criteria this report answers to: no text anywhere in the build; the room must
read as a place for storing, protecting and studying manuscripts from the art alone.

---

## Concept

A scriptorium ante-room that has just been abandoned in a hurry. Records were carried
*out* through the door in the south wall; the move was interrupted by a collapse
that buried the doorway in rubble and opened a seep of water across the south-east
floor. What the player walks into is therefore an archive in the middle of being
evacuated and damaged at the same time: rows of writing tables still carrying open
manuscripts, a lectern left chained, stools knocked over, a scroll trail heading for
the exit — and, at the far end, one cabinet that was never emptied.

The room is a single hall, 50 × 30 cells (800 × 480 px), reached through the doorway
at the south and read along a diagonal quarry aisle that runs from the door to the
open cabinet on the north wall. Two rows of piers turn the hall into a vaulted
undercroft and break the floor into bays, so the player has left/right space as well
as depth.

**Why this is an archive, without a single word.** The north wall is a continuous
press bank: closed cupboards, a partial shelf, a drying rack for quires, an open
armarium with its leaves standing outside the carcass and three rows of rolled
records and bound codices inside. Both side walls carry blind arcading whose niches
hold scrolls, codices or nothing at all — a wall built to hold records, not to look
decorative. The furniture is writing furniture: long boards on trestles, benches,
a lectern with an ink horn, a paternoster, stools.

## Key visual decisions

- **The destination is lit, the hall is not.** Two candle lights flank the open
  armarium and blow the wall behind it warm; the rest of the room is carried by
  sconce pools and the Knight's own vision light. The warm cabinet at the end of a
  cold hall is the composition's job — it pulls the player north.
- **Under-croft, not a low shed.** Two rows of six round piers (rows 9 and 22) plus
  four wall bays give the hall a vault's rhythm without drawing a ceiling, which the
  camera never sees. Piers are solid, so they are also traversal furniture.
- **Stone reads as stone.** Wall caps are kept deliberately darker than any lit
  floor, and floor bevel contrast was lowered, so masonry never reads as floor and
  the floor never reads as a lit wall top.
- **Blind arcading instead of decoration.** Niches are a tile family
  (`face_niche_scrolls`, `_codices`, `_empty`, `_broken`) inset into the wall faces;
  each side wall gets a run of them, the east wall run breaks at the collapse.
  Nothing in the room imitates shelving with a hole in a wall — the shelves are
  actual cabinets with doors, plinths, cornices and shelf boards.
- **Contact and thickness everywhere.** Every prop is anchored by its standing cell
  (bottom-centre), so nothing floats into the wall band; the validator asserts floor
  contact for each one. Tables read as a top surface plus a five-pixel front edge
  rather than a slab; the open cabinet stands on a plinth.
- **Water is a seep, not a puddle decal.** The waterline is ragged per column rather
  than tile-aligned, its ramp is pulled towards the stone (saturated blue reads as
  spilled paint at gameplay zoom), and its north edge carries the cold breach light.
- **Damage tells one story.** The south doorway is half-buried by rubble coming down
  from the east; a fallen beam lies across the floor next to it; the east wall's run
  of niches ends in a broken one; the far east shelf is collapsed; the scroll trail
  runs from the tables towards the exit, not away from it.

## Implementation

| Piece | File |
| --- | --- |
| Original art generator (40 tiles, 34 props, wall caps, lights) | `art_src/author_archive_art.py` |
| Room layout author, emits `room.json` + PIL previews | `art_src/room_author.py` |
| Layout validator (wall ring, floor contact, footprints, route, cameras) | `art_src/validate_room.py` |
| Godot room scene, builds everything from `room.json` at runtime | `scene/archive_room.gd` |
| Native capture harness | `scene/capture_archive_room.gd` |
| 4× nearest-neighbour detail crops | `art_src/make_detail_crops.py` |
| Focused render gate | `.github/workflows/archive-room-capture.yml` |

`room.json` carries resolved atlas coordinates for every layer cell and every prop
source rect, so the Python preview renderer and the Godot scene draw the same data.
Nothing in the layout is duplicated by hand between tools, which is why the preview
and the runtime captures agree.

In Godot the room is a set of `TileMapLayer`s sharing one `TileSet` (floor, floor
decals, water, wall faces, wall caps), a `YSort` container for props and wall mounts,
merged static-body rectangles for the wall ring, per-prop colliders, `CanvasModulate`
ambient and 19 `PointLight2D` lamps. The Knight is the shipping
`res://game/characters/knight/knight.tscn` — same sprite, 12 × 16 collider, 96 px/s
camera — with the camera limits set to the room. There is no bespoke player code.

## Evidence

All frames are raw `1280×720` viewport captures from the game running at the
project's own 640 × 360 viewport, i.e. exact 2× of gameplay. No compositing, no
annotation, no scaling.

| File | What it shows |
| --- | --- |
| `captures/archive_room_arrival.png` | first impression on the threshold, camera clamped to the room |
| `captures/archive_room_entry.png` | main architectural feature and the story: lit cabinet, press bank, tables, doorway behind |
| `captures/archive_room_mid.png` | east study corner: desks, collapsed shelf, rubble, water, wall arcading |
| `captures/archive_room_end.png` | the destination up close: open armarium, flanking lights, piers |
| `captures/archive_room_walk.png` | after walking north from the spawn under the room's own collision |
| `captures/archive_room_overview.png` | the whole room, one frame |
| `captures/detail_armarium.png` | 4×: cabinet carcass, leaves, shelf rows, manuscript rows |
| `captures/detail_doorway.png` | 4×: voussoir arch, jambs, leaf, threshold, wall join |
| `captures/detail_breach.png` | 4×: rubble pile, fallen beam, waterline, niche run |
| `captures/detail_study.png` | 4×: long board, front edge, objects, bench |

Verification actually run (workflow `Archive Room — Godot 4.7 render`, run
`39943558642`, success):

1. Regenerating all art and `room.json` in CI reproduces the committed files
   byte-for-byte (`git diff --exit-code`).
2. `validate_room.py` → **PASSED**, 16 warnings, **0 unreachable floor cells**.
   Warnings are shared-tile soft overlaps (a bench standing under a table's end, a
   column among rubble) — deliberate arrangements, not gaps.
3. `scene/archive_room.gd` parses clean under `godot --check-only` (the log is
   published beside the frames), and the capture harness itself runs to completion
   inside Godot 4.7.
4. The capture harness renders six frames and asserts each is exactly 1280 × 720.
5. The walk test moves the Knight with `move_up` held for 150 physics frames under
   real collision and logs `(448.0, 372.0) → (448.0, 256.076)`, 115.9 px north,
   stopping against a table. That is the traversal claim, measured.

Frames land in `captures/`; the CI logs that produced them are in `captures/logs/`.

## Remaining limitations

- **The room is wider than one camera frame.** 50 cells against a 40-cell view is a
  deliberate choice (it gives the hall left/right exploration), but it means no
  single gameplay frame shows the whole architecture. The `overview` frame and
  `art/room_preview.png` are the whole-room references; the gameplay frames are
  honest fragments.
- **Entry framing favours the hall.** From the threshold the camera clamps to the
  room and the shelf bank sits just above the frame; the cabinet is visible as a
  warm glow, the presses only at the edges. The archive read is complete one step
  further in (`entry` and `end`), not on the very first frame.
- **The water is dark.** At ambient levels this low, the pool reads as wet, cold
  stone more than as standing water unless the breach light reaches it. It is a
  deliberate trade against the "blue paint" problem, not a finished treatment.
- **Lighting is runtime, not painted.** The Godot frames are lit by `PointLight2D`
  over an ambient tint; the Python previews bake their own light. Both use the same
  light list, but they are not pixel-identical, and the Godot result depends on the
  renderer (Compatibility used here).
- **The east quarter is sparse on purpose** (collapsed storage) but a player looking
  for a landmark there will find only rubble and one fallen shelf.
- **No audio, no interaction, no entity hooks.** This is a visual prototype; the
  room has collision and a camera, nothing to press.

## Files changed

New, all under `prototypes/environment_art/archive_audition/` unless noted:

```
.github/workflows/archive-room-capture.yml            focused render gate
prototypes/environment_art/archive_audition/
  README_RUN.md                                       how to author and render
  room.json                                           emitted layout (no hand edits)
  art/archive_tiles.png  art/wall_caps.png  art/props.png  art/light_radial.png
  art/tiles.json  art/props.json                      atlas frame tables
  art/room_preview.png  art/room_preview_entry.png    whole-room PIL previews
  art_src/author_archive_art.py                       original art generator
  art_src/room_author.py                              layout author
  art_src/validate_room.py                            layout validator
  art_src/make_detail_crops.py                        4x crop script
  scene/archive_room.tscn   scene/archive_room.gd     the playable room
  scene/capture_archive_room.tscn / .gd               native capture harness
  captures/archive_room_{arrival,entry,mid,end,walk,overview}.png   1280x720
  captures/detail_{armarium,doorway,breach,study}.png               4x crops
  captures/logs/*.txt                                 run logs
```

No existing campaign level, gameplay system, shared scene or test was modified.
