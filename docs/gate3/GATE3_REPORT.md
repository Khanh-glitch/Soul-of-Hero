# SOUL OF HERO — GATE 3: architectural rebuild, visual identity, playable level design

**Status: delivered. Committed and pushed on `arena/6e89e68d-soul-of-hero`. No PR, no
merge, no deploy, nothing promoted to production.**

Nothing under `data/`, `game/`, `tests/`, `assets/` or `project.godot` was modified.
`git diff --name-only fa83414..HEAD -- data game tests assets project.godot` returns 0
files. The one level substitution is made inside the CI runner only, from
`prototypes/gate3/level_data/`.

| | |
| --- | --- |
| green end-to-end run, all three storeys | [`40081969068`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40081969068) @ `d48eee2` — **conclusion: success**; floors 1, 2 and 3 in one descent, HP 1100 → 438, including the mid-fight frame |
| the run before it, same conclusion | [`40081378592`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40081378592) @ `13054b5` — success, HP 1100 → 444 |
| three earlier green three-storey runs | [`40074357646`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40074357646) @ `4bffb81` (HP 1100 → 826), [`40073875673`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40073875673) @ `a6afe5d` (→ 2), [`40069612470`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40069612470) @ `a4c7e31` (→ 96) |
| repository suite for this branch | [`40081969077`](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40081969077) @ `d48eee2` — *Import and headless runtime tests* **success**, *Xvfb rendered gameplay captures* **success**, *Original main baseline comparison* **failure** (unchanged `main`; see §9) |
| Godot | `4.7.stable.official.5b4e0cb0f` (`evidence/logs/version.txt`) |
| trial level sha256 | `25a51aa9834278c9415cf7039933e3c1bc4238bb33aa0d2111db620cccf2036d` |
| Candidate A pin used for BEFORE | `5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54` |

The workflow was re-run against the commit that carries this delivery (`d48eee2`), so every
number above is reproduced at the delivered revision; the evidence commit the bot
published on top of it only adds the frames and logs from that run.

Every image in `docs/gate3/evidence/` is a native `1280×720` (or `1024×576`) capture
produced by `prototypes/gate3/capture_gate3.tscn` on the CI runner, through the real
campaign entry, the production HUD, the production input actions and the level's own
floor doors. The single offline artefact, `route_and_connectivity_diagram.png`, says so
on its own face and is not counted as a screenshot.

---

## 1. Selected direction, and why

**Option A — Evolved Carved Cloister**, implemented; Option B — Controlled Reliquary
Spine, rejected and documented in `docs/gate3/DESIGN_DECISION.md` with the same
eight-axis table it uses for A.

The brief's own constraint decided it. Option B re-cuts the plan that the level's 79
entities, its hazards, its four floor doors and its tuning were authored against; that
is a gameplay contract change, and Gate 3 is explicitly not allowed to smuggle one in.
Option A keeps Candidate A's building where it stands and rebuilds the relationships
inside it, which is the only version of this gate whose delivery can be *proved* rather
than asserted. What B was right about — a processional reading of the nave, a screen
of columns at the garth, a destination at the west end — is taken as *relationship*
rather than as *new plan*: a recess-and-pier rhythm, four corner piers with a coping
ring, and a real recess plus lantern around the armarium.

---

## 2. What was implemented (Phase C)

| # | requirement | implementation | cells |
| --- | --- | --- | --- |
| C1 | sealed shaft `x27..33 y16..20` given a real function | floored, opened west at `x34 y16..17`, south side sealed by masonry, one lantern above, read as the collapsed head of the stair to the deep stacks. No fake stair, no implied interaction | 44 |
| C2 | magenta/purple `Decor` replaced | Candidate A's `Decor` layer hidden at runtime (a visibility change, not a data change) and archive fittings painted in the eleven-role material; **plus** the actual source of the magenta, which was the hazard art — see §3 | 109 `Gate3_decor` cells |
| C3 | flat wall bands broken by structure | recess and pier rhythm derived from the level's own wall runs: `wall_face` 979, `niche` 241, `mass` 707, `coping` 34 cells, all aligned to real geometry, none covering a walkable cell | 1961 |
| C4 | garth must read as a designed courtyard | 9 parapet cells opened, 4 corner piers canted in, a coping ring, shoreline on 30 cells; all 66 original water cells kept | 13 |
| C5 | south ambulatory around the spike at `(46,21)` | pier block `x50..52` opened, bay framing the spike built; both directions walked by the real 12×16 Knight body | 6 |
| C6 | five hard vault falloff bands → one efficient method | one 116×96 RGBA distance-field shade sprite, linearly filtered, in a single node with a 26-cell falloff; no steps at any zoom | 1 node |
| C7 | bespoke architecture on floors 2–3, distinct per floor | same eleven roles, different purpose per storey: floor 2 is a stack level (shelf bays, armarium, reading lamps), floor 3 is a camp (benches, stores, the exit approach) | 36 props, 6 lights across all three storeys |

Measured totals (`evidence/logs/stats.txt`, `evidence/logs/after.txt`):
`PROPS 36 (17 solid) · LIGHTS 6 · ENTITIES 79`, material layers
`rock 5872 / floor 3413 / coping 34 / water 66 / water_edge 30 / wall_face 979 /
niche 241 / mass 707 / shadow 508 / weather 326 / decor 109`.

Level-document diff against the pinned Candidate A baseline: **Backdrop +62 cells,
Geometry +11 / −27, Decor 0**, entities byte-identical and in their original order
(79/79). `prototypes/gate3/level_data/chapter_1_level_3_gate3.json` is generated by
`tools/gate3/author_gate3.py` and checked into git byte-for-byte; the workflow fails if
regenerating it produces a different file.

---

## 3. C2, correctly diagnosed — the magenta was not the decoration layer

Gate 2 recorded C2 as "the magenta/purple `Decor`", with a warm multiply suggested as
the fix. That diagnosis was wrong, and the wrong fix is why it never worked.

**What the pixels say.** The 73 authored `Decor` cells resolve to cobweb, skull, barrel
and garlic-rack frames — none of them violet, and none of them near the lavender blocks
in the frames. The violet is the *hazard* sprite:
`assets/environment/dungeon/items/spikes/peaks_1..4.png` are fully opaque 16×16 frames
whose background is a flat plate, RGB (61, 37, 59), 151/256 pixels of frame 1. At the 2×
the level draws them, every spike bay reads as a lavender card on dark stone. A multiply
tint cannot remove an opaque plate, which is exactly why Gate 2's fix did nothing.

**What was done, and the iteration that followed.** Production art is frozen, so
`tools/gate3/make_derived_art.py` writes a prototype-local derived copy of the four
frames, records the source and derived sha256 in `prototypes/gate3/art/derived_art.json`,
and refuses to derive if the source plate ever changes. `--check` reproduces the frames
byte-for-byte in CI (`evidence/logs/derived_art.txt`).

First attempt: clear the plate to alpha 0. Measured in the native frame
(`inspection_crop_hazard_bay_3x.png` from that build) this was **rejected**: pale steel
spikes floating on dark stone read as harmless rubble, which trades a readability defect
for a worse one. Hazard visibility is not allowed to go down.

Second attempt, shipped: repaint only the plate as a dark crimson pit, RGB (72, 30, 30)
at alpha 210, and neutralise the plate's violet shadow step (54, 32, 48) to (38, 30, 34).
733 plate pixels and 39 shadow pixels per frame set, no spike pixel added, removed or
moved; the four-frame 8 fps animation and the hazard's damage are untouched. The bay now
reads as a marked danger that belongs to this dungeon's warm stone — see
`inspection_crop_hazard_bay_3x.png` (3× crop of the native AFTER frame).

The harness measures this on the renderer's own pixels rather than on the file: no
pixel of RGB (61, 37, 59) may survive in a live hazard frame, and the frame must still
fill at least three quarters of its cell, so "violet gone" cannot be satisfied by
"hazard gone".

---

## 4. Phase D — camera

Two framings were evaluated at both required resolutions, from the same `landmark`
station (`evidence/camera_comparison.png`, four native frames):

| option | what it is | Knight visible | hazards cropped | HUD | verdict |
| --- | --- | --- | --- | --- | --- |
| baseline | the level's own camera, zoom 1.0 | yes, centred | no | intact | readable but the station's subject is small in a 1280×720 frame |
| archive | 2.0 zoom, bounded to the room | yes, centred | no | intact | the recess, the lantern and the armarium read as one subject; keeps pixel art at integer scale |

Implementation is prototype-local only: the AFTER capture applies the 2.0 framing for
its evidence frames, and both framings are captured at 1280×720 and 1024×576 so the
comparison is like-for-like (`evidence/logs/after.txt`, `GATE3 CAMERA` lines, and
`GATE3 RESOLUTION: rendering at (1024, 576)`).

**The camera does not hide weak design.** The 3× crops in `evidence/` are taken from
frames at a given station, not from the tightest possible crop: `armarium_alcove`,
`cloister_garth`, `descent_landing`, `south_loop`, `bay_rhythm`, `shade_depth` and
`hazard_bay` all use the 1280×720 frame at 3× nearest-neighbour, so every pixel a
reviewer sees is the pixel the game drew.

---

## 5. Phase E — the five beats, preserved

| beat | station | evidence |
| --- | --- | --- |
| arrival | `spawn` → `archive_entry` | `after_spawn.png`, `after_archive_entry.png` |
| armarium discovery | `landmark` | `after_landmark.png`, `inspection_crop_armarium_alcove_3x.png` |
| cloister traversal | `descent_landing`, `cloister` | `after_descent_landing.png`, `after_cloister.png`, `inspection_crop_cloister_garth_3x.png` |
| reading-area confrontation | `south_loop`, `combat_space` | `after_south_loop.png`, `after_combat_space.png`, 9 live fights in the deep log |
| deeper danger / descent | the two floor doors | `GATE3 FLOOR DOOR: Tầng 2 moved the Knight 415 px`, `after_floor2_arrival.png` |

Objectives, rewards and campaign logic are untouched: the level document's entity list
is byte-identical to the pin, and the capture enters through the real campaign route
(`GATE3 CAMPAIGN ROUTE: chapter_1_level_3, real HUD and active Level 3`).

---

## 6. Phase F — the 15 verification items

All results below are from the green run `40081969068` unless stated. Line references
are to `docs/gate3/evidence/logs/*.txt`.

| # | item | result |
| --- | --- | --- |
| 1 | level hash pinned | `GATE3 LEVEL: … sha256=25a51aa9…` in both AFTER and deep logs; `gate3_pin.txt` and `base_pin.txt` record the BEFORE pin `5ea50e9c…` |
| 2 | 79 entities vs pinned fixture | `_expect(entities.size() == EXPECTED_ENTITIES)` passes; JSON comparison against `chapter_1_level_3_a.json` shows the entity arrays are equal, in order |
| 3 | full geometry cell-diff manifest | Backdrop +62, Geometry +11/−27, Decor 0; per-cell lists in `prototypes/gate3/visual_placement.json`; regeneration is byte-checked in CI |
| 4 | Knight-clearance connectivity | `audit`: standable floor after carving by a 12×16 body, 871 cells from spawn without doors, 2850 with door edges |
| 5 | original 5 legs walked | archive_entry 97 px/7 cells, landmark 113/7, descent_landing 78/15, cloister 129/9, combat_space 195/14 — all with production input actions |
| 6 | south ambulatory both directions | `south_loop` (13 cells) and `return_route` (18 cells) walked by the real body; `audit` strict **PASS 23 cells** and permissive **PASS 23 cells** |
| 7 | prop collision / non-overlap | `COLLISION: Knight at (713.1, 342.5) is clear of every wall and prop`; 17 solid footprints probed, each covered by a body; open floor next to him free of bodies |
| 8 | gameplay entities + HUD | 79 entities live, `exactly one HUD in the scene`, HUD visible in every frame; enemies spawned and fought |
| 9 | TileSet / material-layer validity | 11 material layers, every layer's cell count asserted, no material cell over a walkable cell |
| 10 | camera + HUD positioning | 4 camera frames at 1280×720 and 1024×576; `GATE3 CAMERA FRAMES: 4` |
| 11 | live combat | deep run: 7 fights, targets killed, `GATE3 COMBAT` lines carry frame counts and both HP values; plus a native frame captured **mid-fight** (`after_combat_load.png`, sheet `combat_under_load.png`) rather than a still of a room containing an enemy |
| 12 | legitimate floor transitions | `FLOOR DOOR: Tầng 2 moved the Knight 415 px to (1704.0, 680.0)` — the door's own `interact()`, not a teleport; landing cell asserted against the door's authored `target_position` |
| 13 | art provenance | `GATE3 SOURCE MANIFEST OK: 5 copies byte-identical to Candidate B`; derived-art hashes reproducible; production art untouched |
| 14 | repository regression suite | branch suite: *Import and headless runtime tests* success, *Xvfb rendered gameplay captures* success; the `main`-baseline job fails and is reported separately in §9 |
| 15 | log scan | 0 `ERROR:` and 0 `SCRIPT ERROR:` in every capture log; the only warnings are the driver's V-Sync notice and the ObjectDB notice investigated in §10 |

### Route and damage, honestly

| pass | cells | pixels | fights | HP | note |
| --- | --- | --- | --- | --- | --- |
| BEFORE (Candidate A) | 73 | 935 | 0 | 1100 → 1100 | floor-1 tour only; the BEFORE build has no shaft to walk to |
| AFTER, floor-1 tour | 83 | 988 | 0 | 1100 → 1100 | +10 cells and +53 px of new walkable route through the repaired shaft and the opened ambulatory |
| AFTER, deep (this run) | 168 | 3484 | 9 | 1100 → 438 | **floors 1–3 in one descent**, through both doors, 662 health spent |
| AFTER, deep (`40081378592`) | 147 | 3475 | 7 | 1100 → 444 | 656 spent |
| AFTER, deep (`40074357646`) | 113 | 3475 | 7 | 1100 → 826 | 274 spent |
| AFTER, deep (`40073875673`) | 84 | 3468 | 9 | 1100 → 2 | 1098 spent |
| AFTER, deep (`40069612470`) | 146 | 3473 | 9 | 1100 → 96 | 1004 spent |

Environmental damage is reported as measured, not as intended: the deep log carries one
line per tick that costs health, with the cell, the `on_hazard` flag, the distance to the
nearest enemy and the dash count, so a drain can be attributed to a hazard, to an enemy
or to neither. The run that died did so twice for two different, named reasons — see §7.

### Performance and load

Measured at the end of the AFTER walk with the entire overlay live, under the CI's
software rasteriser (`llvmpipe`), which is a ceiling and not a target:

```
GATE3 PERF: 90 physics frames in 1656 ms, 18.40 ms per frame (software GL)
GATE3 PERF: nodes=844 objects=13949 draw_calls_in_frame=242 objects_in_frame=3805
GATE3 PERF: physics_process=1.39 ms render_process=147.65 ms
```

Physics — the part that decides whether the game *plays* — is 1.39 ms of a 16.67 ms
budget. The render figure is software rasterisation of a 116×96 cell map with 2690
objects in frame and is not representative of GPU rendering; it is reported so the
claim "we measured it" is checkable rather than asserted.

---

## 7. Phase G — corrective iterations after the first complete candidate

Four visual/gameplay corrections were made *after* a complete candidate existed, each
one driven by something measured rather than by taste.

**G1 — the violet plate (visual).** First complete candidate still had the lavender
cards. Root-caused to the hazard atlas (not `Decor`), derived a prototype-local copy,
then rejected the first derived treatment (fully transparent plate) in the native frame
because it made the hazard quieter, and shipped the crimson pit instead. Evidence:
`inspection_crop_hazard_bay_3x.png`, before/after crops of the same bay, and the
pixel-level assertions in §3.

**G2 — the hazard frame must be verified where it is drawn.** The contract now inspects
the texture the renderer uses, not the file on disk: no RGB (61, 37, 59) pixel may
survive, the frame must still fill its cell, animation stays at 4 frames, and no hazard
may still be an `AtlasTexture` of the production frame.

**G3 — the walk was losing health it could not account for.** The harness gained a line
per damaging tick. That immediately produced the run that died on a spike cell at
`(79, 18)`: 900 frames standing on one hazard with a skeleton beside it, `on_hazard=true`
on every tick, HP 906 → 0, because the walk skipped combat on hazard cells while the
enemy refused to let it leave. The fix — leave the hazard first, always, by the step that
stays closest to the waypoint — is what made the deep pass green again.

**G4 — three measured dead ends, recorded so they are not repeated.** Engaging at 72 px
of range, casting the Sword Hero's skill/ultimate in a crowd, and retreating to a safer
cell were each implemented, run and measured. All three made the run worse: casting roots
the Knight in place, and a Knight in hit-stun is not retreating, he is standing still
being hit — a 300-frame withdrawal cost 462–616 health and left the enemy at 12–14 px.
Contact engagement plus a dash out of every hit is what survives, and that is what ships.

---

## 8. Floor-by-floor coverage

| storey | reached through | evidence |
| --- | --- | --- |
| floor 1 | authored spawn | 8 native frames, 6 Gate-2 stations plus the repaired shaft and the return route |
| floor 2 | `f1_f2_down` door, `interact()`, `412 px` moved to `(1702, 678)` | `after_floor2_arrival.png`, `after_floor2_stacks.png` — captured in the green run at HP 156 |
| floor 3 | `f2_f3_down` door, `interact()`, `465 px` moved to `(152, 1288)` | `after_floor3_camp.png` — captured in the same run at HP 2, `GATE3 DEPTH: floor 3 reached on foot and captured` |

The audit proves all three storeys reachable for the authored geometry: floor 1
16/16 entities, floor 2 17/17, floor 3 14/14, `result OK (0 unreachable entities)`.

---

## 9. Repository suite, and the `main` baseline

`40068521170`, the branch's own **Godot 4.7 Runtime Validation** workflow at the same
commit:

* *Import and headless runtime tests* — **success**
* *Xvfb rendered gameplay captures* — **success**
* *Original main baseline comparison* — **failure**, on both of its steps
  (step 8 *campaign-entry runtime test on original main*, step 9 *production smoke test
  on original main*)

The third job runs the same tests against **unchanged `main`** and fails there too. It
is a pre-existing baseline failure, not a regression introduced by Gate 3, and it is
reported here as a failure: no part of this gate claims it as green.

---

## 10. The ObjectDB notice — investigated, not resolved

Three reports have now quoted this notice with three different meanings, so it was
measured directly (`evidence/logs/leaks.txt`):

```
before   notices=1 instances=7
after    notices=1 instances=7
deep     notices=1 instances=7
```

* Each capture log contains exactly **one** notice, and that notice names **7** leaked
  instances. Gate 2's report counted "three `ObjectDB` leak notices" across its two
  logs, and Gate 1's "seven" matches the *instance* count of a single run. The
  discrepancy is therefore a units error — notices versus instances — carried forward
  between reports, not a change in behaviour.
* A `--headless --verbose` run of the same scene **does not reproduce it at all**
  (0 notices), so the leak belongs to the rendered capture path, not to loading the
  level or the overlay.
* The engine's shutdown notice sometimes escalates to `ERROR: 4 resources still in use at
  exit` (seen in the deep log of run `40073399046`) and sometimes stops at the warning.
  The step's script-error gate now distinguishes that engine notice from a game `ERROR:`
  by name, because failing a run on Godot's own leak report while investigating that same
  leak is not a useful signal.
* Godot only names leaked instances under `--verbose`, and the headless run that can
  afford verbose output is exactly the run that does not leak. The seven objects are
  therefore **still unidentified**.

This is recorded as an unresolved, low-severity issue. It is not claimed as fixed, and
the workflow step that measures it says so in its own output.

---

## 10a. The evidence files, and what each one is

| file | what it is |
| --- | --- |
| `comparison_{spawn,archive_entry,landmark,descent_landing,cloister,south_loop,combat_space,return_route}.png` | BEFORE / AFTER pairs at the six Gate 2 stations plus the repaired shaft and the return route |
| `comparison_{floor2_arrival,floor2_stacks,floor3_camp}.png` | the same pairing for the two lower storeys |
| `after_*.png`, `before_*.png` | the raw native 1280×720 frames the sheets are built from |
| `after_combat_load.png`, `combat_under_load.png` | the frame taken mid-fight, and the same frame labelled |
| `after_cam_{baseline,archive}_{1280,1024}_landmark.png`, `camera_comparison.png` | the camera evaluation: two framings at two resolutions |
| `inspection_crop_{armarium_alcove,cloister_garth,descent_landing,south_loop,bay_rhythm,shade_depth,hazard_bay}_3x.png` | seven labelled 3× nearest-neighbour crops of native frames |
| `route_and_connectivity_diagram.png` | the one offline artefact: the authored plan, the props and the descents, labelled as a diagram on its own face |
| `CHANGE_MANIFEST.md` | machine-generated inventory, cell diff and frozen-path proof |
| `logs/*.txt` | every capture log, the authoring checks, the audit, the leak probe and the log scan |

## 11. Provenance and changed files

Two machine-generated documents, both `--check`-enforced in CI:

`docs/gate3/evidence/CHANGE_MANIFEST.md`, written by
`tools/gate3/write_change_manifest.py`, inventories the 22 files of code and
documentation that produce the evidence (the published evidence directory is excluded
because every capture run rewrites it), the layer-by-layer cell diff against the pinned
baseline — Backdrop +62, Geometry +11/−27, Decor 0 — with every changed cell coordinate
listed, the 79-entity comparison, and the frozen paths. It refuses to be written at all
if the entity list differs from Candidate A's.

`docs/gate3/SOURCE_MANIFEST.md` (regenerated by `tools/gate3/write_source_manifest.py`,
`--check` enforced):

* 5 copies are byte-identical to Candidate B: the two atlases the overlay draws from,
  and the three documents it reads.
* `prototypes/gate3/level_data/chapter_1_level_3_gate3.json` derives from
  `chapter_1_level_3_a.json` (sha256 `5ea50e9c…`) — 75 cell edits, entities untouched.
* `prototypes/gate3/art/peaks_1..4.png` derive from
  `assets/environment/dungeon/items/spikes/peaks_1..4.png`: the plate repainted, the
  violet shadow step neutralised, every spike pixel copied unchanged. Source and derived
  hashes are in `prototypes/gate3/art/derived_art.json`.
* The shade field is generated at runtime from the material roles; it is not an asset.

Changed files, `fa83414`..`HEAD`, evidence excluded (20 files, 156,601 insertions, 0
deletions — nothing in the tree was removed):

```
docs/gate3/ARCHITECTURAL_AUDIT.md                    docs/gate3/DESIGN_DECISION.md
docs/gate3/GATE3_REPORT.md                           docs/gate3/SOURCE_MANIFEST.md
docs/gate3/evidence/**                               .github/workflows/gate3-runtime.yml
prototypes/gate3/capture_gate3.gd                    prototypes/gate3/capture_gate3.tscn
prototypes/gate3/gate3_redesign.gd                   prototypes/gate3/gate3_redesign.tscn
prototypes/gate3/level_data/chapter_1_level_3_gate3.json
prototypes/gate3/visual_placement.json               prototypes/gate3/art/{peaks_1..4}.png
prototypes/gate3/art/derived_art.json                tools/gate3/author_gate3.py
tools/gate3/worldmodel.py                            tools/gate3/make_derived_art.py
tools/gate3/make_evidence_sheets.py                  tools/gate3/write_source_manifest.py
tools/gate3/write_change_manifest.py
```

The complete, machine-generated version of this list — with sizes, hashes and every
changed cell — is `docs/gate3/evidence/CHANGE_MANIFEST.md`.

---

## 12. Unresolved defects and limitations

1. **The deep route is marginal, and needs a retry to be reliable.** The green run walks
   all three storeys in one descent (168 cells, 3484 px, 9 fights, HP 1100 → 438), but
   earlier builds died on floor 1 in roughly half their attempts, so the workflow retries
   the whole Godot process up to three times, each attempt keeping its own log, and the
   step prints which attempt produced the evidence. A green deep log can mean "second
   attempt", and says so when it does. An in-process retry through
   `reload_current_scene()` was tried first and rejected: it hung the step instead of
   failing it.
   Measured cause: two or more skeletons converging, and hit-stun, which means a Knight
   in contact with a crowd cannot disengage — retreating was measured three times and
   lost every time. The harness's policy is the aggressive one that survives best, and the
   full descent varies enormously for a Knight using only basic attacks and a dash: 662
   health spent in the green run at HEAD, 656 at `13054b5`, 274 at `4bffb81`, 1098 at
   `a6afe5d`, 1004 at `a4c7e31`. The descent always completes; the health it costs is not controlled,
   and that variance is the honest finding about this level's difficulty. This is a genuine difficulty finding about `chapter_1_level_3`, not a
   correction the gate is allowed to make: enemies are part of the frozen entity list.
2. **The shipped death flow has no respawn.** `game/ui/HUD.tscn` contains a
   `RespawnButton` ("HỒI SINH") wired to nothing, hidden in `_ready()`, and `hud.gd`
   never connects it; the only wired death buttons restart the level. Dying on floor 2
   therefore costs the whole level, which is what makes (1) as expensive as it is. This
   is a production defect outside Gate 3's writable paths — recorded, not touched.
3. **The ObjectDB notice is characterised but not explained** (§10).
4. **The lower-storey frames come from one specific run.** `after_floor2_*`,
   `after_floor3_camp.png` and `after_combat_load.png` in the tree were captured by run
   `40081969068`; the committed
   evidence files are whatever the last publishing run produced, and each log names its
   own run's route so a frame can be matched to the log that made it.
5. **Camera bounds on floors 2–3 were not re-tuned.** The 2.0 framing was evaluated at
   the floor-1 landmark only; the lower storeys keep the level's own camera.
6. **Performance is measured under a software rasteriser**, so the render figure is a
   ceiling; no GPU number exists for this build in CI.
7. **The archive material is drawn behind two production layers, and therefore does not
   appear.** `crypt_entrance.tscn` gives `Backdrop` z = −10 and `Geometry` z = 0, while
   every Gate 3 material layer is added with `z_as_relative = false` at z = −30 … −10, and
   `_hide_level_layers()` hides only `Decor`. Comparing `before_spawn.png` with
   `after_spawn.png` at floor and wall pixels returns identical values, which is how the
   error was found: 5 800 authored cells (floor, wall face, mass, niche, coping, weather,
   wall shadow) and the `Gate3_Shade` field never reach the screen, and the visible
   masonry is the 0x72 tileset with its salmon wall caps. Only `rock`, the props, the
   hazard reskin and the lights are on screen. `docs/gate3/ROUND_4_PLAN.md` records the
   fix that is proposed for the next round, together with the other three review items
   (combat stability, respawn, lower-storey camera). Nothing in this report is retracted:
   the material evidence in §8 measured the authored document and the capture logs, not
   the composited frame.

---

## 13. Reproduction

```bash
# the authored documents, and the checks the workflow runs on them
python3 tools/gate3/author_gate3.py --check
python3 tools/gate3/write_change_manifest.py --check
python3 tools/gate3/author_gate3.py --stats
python3 tools/gate3/write_source_manifest.py --check
python3 tools/gate3/make_derived_art.py --check          # needs Pillow
python3 tools/gate3/worldmodel.py audit \
  --level prototypes/gate3/level_data/chapter_1_level_3_gate3.json

# the native captures (Godot 4.7 required; the CI image provides it)
cp prototypes/gate0/level_data/chapter_1_level_3_a.json data/levels/chapter_1_level_3.json
godot --path . --resolution 1280x720 res://prototypes/gate3/capture_gate3.tscn        # BEFORE
cp prototypes/gate3/level_data/chapter_1_level_3_gate3.json data/levels/chapter_1_level_3.json
godot --path . --resolution 1280x720 res://prototypes/gate3/capture_gate3.tscn -- --overlay
godot --path . --resolution 1280x720 res://prototypes/gate3/capture_gate3.tscn -- --overlay --deep
```

The substitution in steps 3–5 is a runner-local action; the workflow never commits it
back, and `git diff --name-only fa83414..HEAD -- data game tests assets project.godot`
is the check that proves it.

## 14. Rollback

Gate 3 is additive: every file it adds lives under `docs/gate3/`, `prototypes/gate3/`,
`tools/gate3/` or `.github/workflows/gate3-runtime.yml`, and no production file is
touched. Rollback is `git revert -m 1 <merge>` or, on this branch, reverting the range
`fa83414..HEAD`; nothing outside those four paths needs restoring, and deleting
`prototypes/gate3/` and `tools/gate3/` returns the repository to its Gate 2 state
without touching the game.
