# Repair ledger

One row per defect. "Evidence" is what proved the defect was real; "verification"
is what proves the repair works, on the branch, in a native build.

Status key: **fixed** (repaired and verified), **open** (confirmed, not repaired in
this pass), **partial** (the mechanism is repaired, the art direction is not).

## A — missing content

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| A1 | Level 7 places a prop frame `barrels` that the `vigil` kit does not have, at 20 cells | `tools/level7/architecture_vigil.py:219` built a `kinds` list containing both `barrels` and `barrel`; the atlas has only `barrel` | The list names frames, not descriptions. `barrels` → `barrel` at all three positions; the prop count is unchanged (213) | `tools/validate_chapter1_art_refs.py` passes; native log `AUTHORED PROPS: missing=0` | fixed |
| A2 | Level 8 places `banner_pale` twice; no such frame existed, so the nave's two banners never drew | Audit cross-check of document frames against `reliquary_props.json` | `prop_banner_pale()` authored: pale linen drop on an iron rope, house chalice sigil in iron thread, torn hem, cool folds so it stays pale on pale marble. The wine velvet `drape` is untouched | Kit regenerated (19 props), art-ref validator passes, native log `missing=0` | fixed |
| A3 | Level 5's document had no `kit`, `ambient` or `background`, silently inheriting renderer defaults | Document keys vs the other five architecture documents | The generator states all three | Document diff; renderer reads the same values it was already falling back to, so the frame is unchanged by design | fixed |
| A4 | Any future frame typo would ship silently | A1 and A2 both reached a player | `tools/validate_chapter1_art_refs.py` reads every chapter 1 document against its kit atlas and fails on any unresolved frame; wired into `validate_chapter_1_assets.ps1` and into the architecture workflow | Run on the branch: 6 documents, 6 kits, PASS. Before the repairs it reported exactly A1 and A2 and nothing else, which is how the check was validated | fixed |
| A5 | Native renderer skipped a missing frame without a word | `_build_props` `continue` on an unknown frame | A missing frame now warns with the level file, the frame and the kit, and is counted | `AUTHORED PROPS: missing=0 clamped=0` on all six L5–L10 logs | fixed |

## B — boundaries and clipping

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| B1 | Every level paints architecture above row 0, where `camera_bounds` starting at y=0 made it invisible, so each top wall was sliced flat by the screen edge | Audit static model: painted cells above row 0 — L7 176, L5 139, L6 122, L9 64, L4 50, L3 48, L8 40, L10 40, L2 19 | Six rows (96 px) of headroom: `camera_bounds` in the map generator and all ten shipped documents, rock fill and wall pass extended to `WORLD_TOP_ROW` | `ENVIRONMENT BEDROCK` and `CRUCIBLE ART` lines in the sweep logs; `AUTHORED PROPS: clamped=0` | fixed |
| B2 | 53 props were cut by the top of the screen (L9 banners −52 px, L8 columns −60 px, L6 banners −32 px, L7 banners −30 px) | Audit: sprite tops above y=0 per level | Headroom (B1) removes the cause; `_build_props` also drops a sprite that would still cross the world top, in whole tiles, and counts it | `clamped=0` on all six levels: with the headroom in place nothing needed moving | fixed |
| B3 | The level schema rejected the headroom, failing CI on the first push | Run `40191815223`, step 9 `Frozen Level 5 suites` — `camera_bounds must define a positive rectangle inside the level` | `HEADROOM_LIMIT := 256` and an explicit rule: top may be up to sixteen rows above row 0, everything else unchanged | Run `40191815223`'s successor on `7f8e765`: architecture breakthrough **success** | fixed |
| B4 | Walls end without a crown where they meet the top of the world | Audit clip-top table; visible in every top wall of L5–L10 | Wall pass keeps two rows for cornice and cap, compresses its extrusion to what the space allows, and repaints the band's own top cell as coping when there is no space at all | Sweep mosaics; `CRUCIBLE ART: wall_cells=` non-zero on every level | fixed |
| B5 | L1–L4 facade stacked courses past the top of the world | Same model, applied to `chapter1_environment_art.gd` | Facade courses, pier crest and coping are built inside `WORLD_TOP_ROW` | `ENVIRONMENT BEDROCK` logs; mosaics | fixed |
| B6 | L5 portal, L9 gate framing, L10 hall headroom are individually unresolved | Audit sections B and K | — | — | open |

## C — voids

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| C1 | Unmarked cells inside the map draw the level background, so rooms have holes punched between them: L1 112, L2 762, L3 182, L4 640 enclosed | Audit void count per level | Every unmarked cell inside the map gets rock, on a layer behind the backdrops, derived from the map and never painted in | The first version printed exactly the audit's numbers (`enclosed_void=112/762/182/640`); the shipped version prints `void_cells=3164 / 10648 / 3636 / 4008` plus `headroom_cells` | fixed |
| C2 | The outer void is background, so the keep reads as a floor plan floating on black | AFTER mosaics of L01–L04 at 1:1 | The outer void gets rock too, and so does the headroom strip above the map. Two values were tried first and rejected on the evidence (see C4) | Mosaics `L01..L04_mosaic.png` on the branch; `headroom_cells` in the log | fixed |
| C4 | The two-value rock split painted rectangular patches of two greys across the maps, which reads as inconsistent material rather than as depth; and the headroom strip was still background | AFTER frames at `bc3d3a3` | One rock value everywhere, including the headroom: hierarchy comes from the floor being a lighter material, not from the outside being a hole | Frames at `7c5e4d5` | fixed |
| C3 | Rooms are still repetitive: identical wall bands, no doors, no buttresses, no niches, and the outer rock is undifferentiated | L01–L04 mosaics | — | — | open |

## D — hierarchy

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Light pools were 179–1638 px, so in L5, L6, L8 and L9 a single lamp covered the room and flattened floor, wall and prop to one value | Audit lighting findings; authored scales of 0.7–6.4 across the six generators | `kitlib.clamp_light` (and the same rule restated in L5's frozen pipeline): radius 140–400 px, core ≤ 1.15 energy. Radius is compressed by `r^0.6` and energy rolls off above 0.85 rather than being clipped, so the author's ordering survives | After the pass: L5 10 distinct radii, L6 7, L8 8, L9 7, L10 6 — 207 px to 399 px | fixed |
| D2 | The L9 gate read as a blue dome: a 614 px cold flood over the arch and the arena floor | Audit K; `docs/chapter1-audit/L09` frames | Gate light 1.05/2.4 → 0.66/1.3, and the portcullis the kit has always drawn is placed in the mouth of the arch, hung one cell up so it reads as raised | `gate_house` document diff; mosaics | fixed |
| D3 | Floor and wall hold the same value in L5, L6, L7 and L10, so rooms have no ground plane | Audit H | — | — | open |
| D4 | Hero objects do not read: L10's throne, L7's beacon, L5's bowl | Audit K | — | — | open |

## E — art direction

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| E1 | 1-px hairline motifs (L6 conduit, L7 lane, L9 iron band, L10 carpet) read as unfinished line art | Audit G | — | — | open |
| E2 | Prop composition is mechanical: prop runs at fixed spacing, identical silhouettes repeated | Audit J; L09 and L10 mosaics show chains of identical props at a constant interval | — | — | open |
| E3 | Bedrock is a flat field of one tile | Audit F | Partly addressed by C1/C2 (two values, three tiles, hashed per cell) | Mosaics | partial |

## F — identity

| # | Defect | Evidence | Repair | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | L1–L4 share one theme and have no prop layer, so four different dungeon roles look the same | Audit L | — | — | open |
| F2 | L9's four seal medallions do not read as four stations | Audit E | — | — | open |

## Scorekeeping

* Gates A and B's clipping mechanism: repaired and verified on the branch.
* Gates C and D: the two structural causes (hollow maps, flooded light) are
  repaired and verified; the art direction on top of them is not.
* Gates E and F: not started.
