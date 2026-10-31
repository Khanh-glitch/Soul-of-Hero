# Soul of Hero — World Visual Design & Implementation Audition

**Pilot submission.** One continuous authored area near the Waystation, composed and
implemented from pinned existing project pixels, reproducible from source.

- Source: `Khanh-glitch/Soul-of-Hero` @ `f6baaee0ad0ecc5162196e290ede9ccdf45982b1`
  (branch `reviews/ct-a0-a1-a3-a7-20261030-2345`)
- Nothing in production was modified. No geography was written or redrawn.
- Reproduce: `cd prototypes/world_visual_pilot && python3 tools/author_placement.py &&
  python3 tools/compose.py --policy pilot --lighting day --out evidence/pilot --sequence &&
  python3 tools/verify_pilot.py`

---

## 1. What is actually being submitted

A working compositor, not a mock-up. `tools/compose.py` re-implements A1's own runtime
composition rules — `variant_index`, `flip_id`, masked-frame resolution,
`overlay_variant_index`, flat frames at `z = -1`, y-sorted foot-anchored props — and draws
the authored cells from byte-pinned atlases at 1:1, then crops a 320×180 world window and
magnifies it by exactly 2× NEAREST into the 640×360 project viewport.

Every pixel in the evidence therefore comes from one of four pinned PNGs:

| file | sha256 | size |
|---|---|---|
| `overworld_tiles.png` | `cef87705…c861ed61` | 512×144 |
| `overworld_props.png` | `6cb97558…65687e68` | 512×446 |
| `light_radial.png` | `8a294ed2…731de2ef` | 256×256 |
| `knight_idle_sheet.png` | `ada93dd7…d64b24c0` | 1200×80 |

`source_manifest.json` lists every frame actually used: atlas crop rectangle, source file,
SHA-256, use count, layer, and whether the crop resolves to a real entry in A1's frame
tables (63 distinct frames, 0 unresolved). `data/placement_trace.pilot.day.json` records
all 7,463 individual draw operations with cell, crop, paste pixel and flip.

## 2. Source recovery — and the blocker

> **This section describes pilot 1, which was rejected.** It is kept because the rejection
> reason is recorded here. The sources are no longer unreachable: the 43 CraftPix ZIPs were
> delivered through the Drive connector and pilot 2 renders from them — see
> [`prototypes/world_visual_pilot2/PILOT2.md`](../../prototypes/world_visual_pilot2/PILOT2.md).
> The APEX-CHAOS GitHub route below is still closed and should not be retried.

| attempt | result |
|---|---|
| `git ls-remote https://github.com/Khanh-glitch/APEX-CHAOS` | `403 — Write access to repository not granted` |
| `codeload.github.com/.../zip/refs/heads/43-new-asset` | `404` |
| GitHub repository search for `APEX-CHAOS` | no such repository (only unrelated namesakes) |

Pilot 1 fell back to the project's own shipped art — `assets/overworld/overworld_tiles.png`,
`overworld_props.png`, `light_radial.png` and the knight `_Idle.png` sheet — and that fallback
is exactly what the creator rejected: it reused old atlases and showed the obsolete Knight
instead of the D051 base avatars. **Do not repeat that fallback.**

Live blocker for Gate 2 is unchanged: no Godot binary and no way to obtain one from this
sandbox (no egress to GitHub release assets or Google storage; no Vulkan ICD, libGL or
libEGL), so no Python render here may be presented as a native capture.

## 3. The area

Authored window `corridor = [368,192] 50×34 cells` (1,700 cells), unchanged, cut with a
SHA-256 pin from the authored annex:

- the east–west maintained road and its junction, with the waystation approach;
- a north–south lane that carries on past the layby;
- the collapsed fen shelf: 316 authored `b` cells, every one of them capped by authored
  solid `#` — the wet ground exists in the ground layer and is hidden by the cliff solid;
- the cliff mass along the west edge of the road (177 authored `;` cells under solid rock);
- the roadside layby with the authored deadfall node;
- the waystation footprint `[403,195] 11×11`, anchor `[408,200]`, nodes locker `[408,198]`,
  cache `[406,203]`, ledger `[411,202]`, entrance `[403,200]`, and 54 required nav cells.

Cameras (all five inside that window, adjacent along the road):

| station | centre | role |
|---|---|---|
| `fen_edge` | 382,199 | cliff shelf and road margin |
| `home_first` | 397,200 | road, cliff face, waystation pennant |
| `waystation_west` | 406,203 | the yard itself |
| `return` | 400,210 | camp receding, road continuous north/south |
| `explore_first` | 399,219 | roadside layby and deadfall |
| `marsh_water` | 357,124 | marsh → water test, separate pinned window |

## 4. What the composition actually changes (and why)

`data/placement.v1.json` is a hand-editable layer file produced by
`tools/author_placement.py`. Its rules are conditioned on authored terrain, so a frame can
only appear where the cells justify it. 609 props, 1,087 decals, 58 lights, 26 prop frames.

1. **Cliff frames on cliff cells.** A1's authored windows scatter 190 `cliff_patch*`
   decals — all 6 cliff frames, 175 of them in the old window — with no relation to where
   the rock is. They land on moor, road and fen. The pilot's `cliff_face` / `cliff_crack` /
   `cliff_rim` rules fire only on `#` solid cells (301 / 88 / rim), and `cliff_foot_boulder`
   puts real boulder silhouettes along the foot of the mass, which is the only thing that
   makes the rock read at 1× (the shipped `cliff#N` tiles are near-flat fills — see
   `evidence/pilot/cliff_tiles_6x.png`).
2. **A ground apron under the camp** (`yard_apron`, 179 marks) so the waystation is a place
   rather than props standing on untouched lawn.
3. **Road continuity** — `verge_tuft` 135, `road_fringe` 97, `margin_pebbles` 85,
   `margin_rock` / `margin_bush` straddling the seam at sub-cell offsets, so the authored
   stair-step between carriageway and moor stops reading as a staircase.
4. **Tonal break-up** inside the flat families — `moor_tuft` 90, `moor_crack`,
   `moor_pebbles`, `road_pebbles`, `road_worn`.
5. **Contact shadows.** A 1–3 px procedural ellipse under every standing prop, drawn at
   final pixel scale. This is the single largest legibility change: pasted sprites stop
   floating. (`Renderer.contact_shadow`.)
6. **Light.** Warm additive cookies from the shipped `light_radial.png` under the lanterns
   and the fire; soft cool multiply cookies under the cliff shelf and the props. Day is a
   slight cool tint, night a deep blue tint with the same lamps at 1.45× strength.
7. **One authored artifact removed, on purpose.** A1 paints `cliff_shade1…4` as full-tile
   opaque frames on walkable ground, where they print hard 16×16 dark squares. The pilot
   drops 521 such cells (`tuning.drop_detail_tokens = "1234"`, recorded in the trace as
   `detail_dropped`) and replaces them with the soft shade cookie. No cell token was edited;
   the authored data still says what it said.

## 5. Proof, not adjectives

Comparison sheets at identical cells and identical cameras:
`evidence/compare/compare_home_first.png`, `compare_waystation_west.png`,
`compare_fen_edge.png` (authored above, pilot below).

Against the rejected A1 frames, specifically:

| rejected A1 problem | evidence it was solved |
|---|---|
| 175 cliff decals on non-cliff cells; rock unreadable | `compare_fen_edge.png` — rock mass now reads as a silhouetted wall with a shaded foot, no patches on the road |
| flat brown carriageway filling the frame with no landmark | `compare_home_first.png` — cliff face, boulder line, signpost, lantern and camp edge share the frame; the road is bounded on both sides |
| hard stair-stepped road/moor seam | same sheet — the seam is broken by tufts, pebbles and straddling rocks |
| no light source anywhere | lantern pools and a fire pool, warm against cool shade; `pilot_day_waystation_west_640x360.png` vs `pilot_night_waystation_west_640x360.png` |
| sprites floating on the ground | contact shadows in every pilot capture |
| hard 16×16 dark squares from `cliff_shade` | removed; gradual shading band at the cliff foot instead |

## 6. Verification (`tools/verify_pilot.py`, 9 checks, all pass)

```
[PASS] no placement prop collider covers a contract cell        (109 contract cells, 2 colliding props)
[PASS] every route/nav/entrance/stand cell is reachable          (1,196 reachable cells)
[PASS] BFS route from hero spawn to the POI anchor is body-clear (17 cells, 12×16 body + 2 px margin)
[PASS] props do not lengthen the authored walking path           (17 with props, 17 authored-only)
[PASS] pilot props only claim their own footprint                (8 cells: cart 2, tree_dead 6, none contract)
[PASS] marsh is walkable and deep water is not                   (313 marsh cells, 45 water cells, 0 water reachable)
[PASS] a marsh cell stands on the shore of the impassable water  (shore at 344,127)
[PASS] every evaluation capture is an exact 2× NEAREST magnification
[PASS] every traced frame resolves to an atlas crop              (63 frames, 0 unresolved)
```

The two colliding props are `cart` and `tree_dead`; their A1 blocker boxes
(`w × 0.82`, `h × 0.42`, centred at the feet) claim 8 cells, all outside the contract, and
the walking path is the same length with and without them.

Movement: `evidence/pilot/sequence/` — 17 frames walked from `[392,200]` to `[408,200]`
along the BFS path, camera following, plus `walk_filmstrip.png` and `walk_loop.gif`.
Camera continuity: the five station captures share cells at their edges — `home_first`
shows the west edge of `waystation_west`, `return` shows the road `waystation_west` leaves.

## 7. Findings that the acceptance decision must weigh

These are authored-geography facts, not implementation choices. They are also the reason
this pilot is small.

1. **There is no traversable wet ground in the Waystation corridor.** In
   `[368,192] 50×34` the ground layer holds 316 `b` (bog) cells and 853 `;` / 531 `d`;
   **all 316 bog cells are capped by an authored solid `#`.** Walkable bog/mud/shallow
   cells in the window: **0.** The nearest cell that is both walkable and adjacent to deep
   water is 89 cells away (`[361,124]`). So the brief's "suitable transition toward wetter
   ground" cannot be demonstrated inside a contiguous first-hour corridor near the
   Waystation without changing the authored cells, which the brief forbids. The marsh →
   water test is therefore shipped as a separate pinned window (`water_test`,
   `[344,112] 28×20`) and is **not** contiguous with the corridor. This is the single
   largest discrepancy between the brief and the current authored world.
2. **A roofed waystation structure cannot be placed without changing walkability.** A1's
   blocker box is `0.82 × sprite width`; `camp_tent` is 46 px wide → 37.7 px body, i.e.
   ±18.9 px from the anchor, ~2.4 cells each side. The yard's usable band between the
   authored route column `x408` and the footprint edge is narrower than that, and
   `camp_pavilion` (74 px) is worse. Every candidate position either covers a route cell or
   covers the east–west carriageway. The pilot therefore carries the waystation's vertical
   read with the pennant, two lanterns, a fire and a rail fence — all non-colliding — and
   reports the missing roof rather than faking clearance.
3. **A1's own `home_first` centre cannot show the waystation.** `[394,201]` spans
   `x384–404`; the footprint starts at `x403`. The stated read ("waystation roof and
   pennant visible down the road") is not achievable from A1's own camera. The pilot uses
   `[397,200]` and adds `[406,203]`; both are inside the unchanged window.
4. **The shipped `cliff#N` tiles are near-flat fills** (a lavender field with sparse
   dashes). At 6× magnification there is no rock structure to compose with. Section 4's
   boulder line, shade band and tonal variation are mitigation, not a fix; the fix is art.
5. **The atlas has no alpha-blended ground transition set.** `path#N`, `moss#N`,
   `stone_mottleN` and `rubble#N` are opaque full tiles, so they cannot be used to blend
   one ground family into another; only `tuft`, `pebbles`, `crack`, `ashdrift` and `poolN`
   are true decals. This is why boundary treatment is prop-driven.

## 8. Boundaries respected

No file outside `prototypes/world_visual_pilot/` and `docs/world-visual-audition/` was
touched. A0 GameRoot, A3 economy, A6 HUD, A8 POI authority and all canonical world data are
untouched; the authored cells are read-only inputs, verified by SHA-256 on every render and
reported as `cells_touched: 0` in `source_manifest.json`. No ZIP, and no commercial source
archive, is included or published. No merge or replacement of A1 production source is
proposed here.

## 9. Executable test instructions

No Godot binary exists in the authoring sandbox, so nothing in this submission is presented
as engine-verified. Everything below is executed by the reviewer in one pass.

```bash
cd prototypes/world_visual_pilot
python3 -m pip install --user pillow            # only dependency
python3 tools/extract_slice.py \
    --annex-layers /path/to/annex_layers.v1.json \
    --annex-props /path/to/annex_props.v1.json \
    --annex-world /path/to/annex_world.v1.json \
    --route /path/to/first_hour_route.v1.json \
    --slice /path/to/poi_crown_waystation.slice.json \
    --out data/corridor_cells.v1.json           # SHA-256 pinned inputs
python3 tools/author_placement.py               # -> data/placement.v1.json (rules + census)
python3 tools/compose.py --policy authored --lighting day --out evidence/baseline
python3 tools/compose.py --policy pilot   --lighting day --out evidence/pilot --sequence
python3 tools/compose.py --policy pilot   --lighting night --out evidence/pilot
python3 tools/verify_pilot.py                   # 9 checks, writes verify.json + manifest
```

Godot: open `godot/` (standalone project, 640×360 viewport, integer scaling) and press F5 —
the hero walks the verified 17-cell path and the camera follows. The scene re-implements the
same composition from the same pinned JSON; it is shipped as a reproduction, not as tested
output.

## 10. Accept or reject

If the visual standard here is accepted, the next increment is: (a) pick the pilot's second
area *with* a real wet-ground interface rather than assuming one (this chunk has none), and
(b) resolve the roof question as a contract decision — either a smaller blocker for large
props or a declared building footprint — because the current collider rule forbids any
structure in a one-cell-wide yard. Neither should be attempted before this frame standard is
accepted.
