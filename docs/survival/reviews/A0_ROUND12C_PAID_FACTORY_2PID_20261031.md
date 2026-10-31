# A0 Round 12C — paid factory cycle, two independent processes

Status: **PARTIAL**. The paid first hour runs on real input up to the built furnace;
the two-process paid factory cycle is **not yet accepted**. Every number below is
from a run of this branch or of its composed tree; nothing here is projected.

Branch: `arena/dea2428e-soul-of-hero` (draft PR #21, unmerged).
Engine: Godot `4.7.stable.official.5b4e0cb0b` in CI (Xvfb, OpenGL 4.5 llvmpipe),
`4.7.stable.custom_build` locally.

## 1. Composition this round

| owner | SHA | copied / out of scope |
|---|---|---|
| A1 | `8551a323e444f755d7a29b1ad518aa29aeb039cb` | 308 / 156 |
| A3 | `b44e22df3af40939069189be14afc23ee1ce21c4` | 22 / 132 |
| A6 | `6d71410a370df805f8b29a018b61380d6c233b65` | 104 / 89 |
| A8 | `06d1758e2cf7e44c588d158745359d7617fe32d6` | 64 / 11 |

`conflicts=0 unresolved=0`, `COMPOSITION SEATS PASSED` (2087 checked, 0 failed,
2 KNOWN_STALE that predate this composition: `tests/survival_a6_modal_composition_test.gd`
→ missing `expedition_workspace.tscn`, `tools/survival/web_probe.tscn` → missing
`web_probe_ci.gd`). A0 also declares and consumes A1's production interface scope
`game/survival/world/`; A0 forks neither reader nor streamer.

## 2. What this round actually fixed

All of these were defects in A0's own gate; each one had made the gate either lie or
silently skip work.

1. **The audit path was the save path.** Process 2 "read the audit" and got a save
   document, so every later assertion was made against the wrong file. The audit now
   lives at `user://tests/a0_connected_audit.json` and the save at
   `user://tests/a0_connected_journey.json`.
2. **Collect buttons were matched three ways.** A6's panel says `COLLECT`, A0's said
   `Collect`, and one helper compared without normalising case. All selectors are now
   case-insensitive and the job label is found by scanning the row, not by assuming
   child 0 (the bar is child 0).
3. **Five inputs were never gathered at all** (2 oak for the charcoal, 6 scrap for
   the kit and the fuelled smelt). The paid cycle could not have run even if every
   click landed; the run now walks to 8 stone, 2 oak, 6 scrap first.
4. **The panel was opened with a blind toggle.** A press that closed an open panel
   made every following lookup fail. Open/close are idempotent helpers now, and every
   call is awaited — the previous version pressed C and kept executing on the same
   frame, reading the list the panel had built *before* the press.
5. **The player stood on the piece it had just placed.** Placement was asserted, then
   the recipe lookup was made from the cell the furnace now occupies. The body walks
   to the piece it built before asking for its recipes.
6. **Wheel input was never a wheel.** Two separate input-layer facts: a wheel event is
   routed through the hovered control, so the pointer must move onto the list first;
   and a wheel press left un-released keeps the GUI's mouse focus on the
   `ScrollContainer`, so **every later left press is delivered to the container, not
   the row**. Proof: `hovered=…/Recipe_weave_cloth_b1` with `pressed` signal
   `fired=false` and the panel notice still reading the previous `Done.` Each notch is
   now pressed and released with its own event object.
7. **A click on a freed row.** The panel frees its rows when it reopens; the test was
   clicking a button it had captured before the rebuild
   (`Cannot call method 'get_global_transform_with_canvas' on a previously freed
   instance`). Scrolling now returns the live row and the caller clicks that.

The CI job also gained a parse gate that runs the real binary (`--check-only`) over
every A0 test and game file it ships — `gdparse` accepted two scripts this round that
the engine refused (`Function "_move_pointer()" not found in base self`).

## 3. Two-process evidence measured so far

From the last complete durably-instrumented run (save kept, audit separate):

```
A0_CONNECTED prefix_complete=true checks=31 failures=0
A0_CONNECTED_DIAG after-prefix path=user://tests/a0_connected_journey.json
    exists=true size=16373 sha=2ddf1630bafd24e2 run_id=run-1793444511-1d301dd1
    epoch=1 state=active phase_state=active ltree=true
A0_CONNECTED_DIAG relaunch   path=user://tests/a0_connected_journey.json
    exists=true size=24849 sha=844f94358656f7cc run_id=run-1793445149-461f57a0
A0_CONNECTED_RUNID audit=run-1793445149-461f57a0 lifecycle=run-1793445149-461f57a0
A0_CONNECTED_OFFLINE_SETTLE {"ok":true,"reason":"nothing_to_settle", ...}
```

Read honestly: an independent second process **does** read the same save, resumes the
same run id and exposes the same world; the offline settle ran and reported
`nothing_to_settle` because the first process had aborted before preparing a job. The
gate therefore proves the run/save identity half of the two-process claim and proves
nothing yet about the paid offline return.

**Update after the harness fixes landed.** The newest run of this branch reports

```
A0_CONNECTED prefix_complete=false checks=24 failures=0
A0_CONNECTED_STOPPED stone=0 oak=0 scrap=0 reed=0 cloth=0 kit=0 steps=24 failures=0
```

i.e. the prefix now *stops silently before it gathers anything*: 24 checks pass, no
check fails, and the bag is empty at the end. Earlier runs of the same suite reached
`prefix_complete=true checks=31 failures=0`, so this is a stop, not a regression in
the assertions: the shared prefix has `return`s that record nothing, and the first
one it now takes is on the path to the first resource node. The next step is to make
every early return in the prefix name itself (the continuation already prints its own
stop with the bag).

The paid half is additionally blocked inside the first process, at the workplace
panel: the furnace
is placed, the player walks to it, `nearby_stations()` lists it — and the charcoal
recipe row cannot be revealed and pressed reliably. Last observed state of the list:
`scroll=[P:(102,89) S:(436,226)]`, row `[P:(138,301) S:(380,26)]`, `max_value=267`,
`scroll_vertical=0`, bar visible. The row was two pixels inside the clip, the press
went to the clip edge, and the wheel never moved the list.

## 4. Blockers (owner-tagged, fail-closed)

1. **A8 physical POI — A1/A8 agreement required.** A1's runtime world is 384×256
   (A0's playable inset; 98 304 cells) against A1's authored 1024×768 continent
   (786 432 cells; A0's playable coverage 0.0938). A8's own review contract puts the
   three south sites at canonical cells `(30,280)`, `(140,360)`, `(120,300)` with
   `inside_current_connector_annex=false` and its own
   `direct_overworld_mount_decision: REJECT_FOOTPRINT_MISMATCH`; the implied overworld
   bounds for a 960×600 local scene are e.g. `[-18,4186,942,4786]` px. A0 will not
   widen bounds over empty terrain or relocate A8 sites into the 448×256 pilot.
2. **A1 authored continent — A1↔A6.** A1's production reader is present at `8551a323`
   and A0 mounts it, but the mount refuses with
   `A1_AUTHORED_SOURCE_DEPENDENCY_HASH:FIXTURE_KNIGHT_SCRIPT`: A1's runtime contract
   pins `game/characters/knight/knight.gd` at `0f24ffdf…` while the composed file is
   `d5a573d1…`. A1 pins the bytes of a hero script A6 edits. A0 records the refusal by
   name and keeps its own world and player working.
3. **No authentic death — A3/A4 damage policy.** Shipped enemy contact damage is 14
   against a hero pool of 1100, and the encounter leash (160 px) ends the fight long
   before 79 landed hits. Balance is not A0's to invent, so the threat gate reports
   `A0_THREAT_DEATH_NOT_TESTED` with the measured numbers (70 observed damage, 5 hits,
   hp 1100→1016) instead of manufacturing a death.
4. **Visual evidence could not be opened at 1×.** CI does produce
   `capture_connected_*.png` at 2560×1440 and 3840×2160 (2 images per leg, `error=0`),
   but this sandbox's network allowlist does not include the GitHub artifact hosts
   (`results-receiver.actions.githubusercontent.com`, `productionresultssa*.blob`), so
   every `gh run download` / `gh run view --log` ends in `EOF`. `VISUAL_UX` is
   therefore `NOT_TESTED` for a transport reason, not a claim that the pixels are fine.

## 5. Gates

| gate | verdict | scope |
|---|---|---|
| Real-input first hour (gather → bench → cloth) | PASS (CI 720p, Xvfb) | 31 checks, 0 failures, normal input only |
| Paid furnace placement | PASS (CI 720p) | kit through GUI, build pointer, `resolve_station` |
| Paid furnace use → smelt → depart (process 1) | FAIL | blocked at workplace panel scroll/queue |
| Independent process 2 resume | PARTIAL | same save, same run id; paid return not reached |
| Offline settle exactly once | FAIL (not reached) | `nothing_to_settle` only |
| A1 authored continent mounted | NOT_APPLICABLE | A1 owner blocker (see §4.2) |
| A8 physical POI + safe retreat | NOT_APPLICABLE | A1/A8 blocker (see §4.1) |
| Authentic death from gameplay | NOT_TESTED | A3/A4 damage policy absent |
| Native captures at 1440p/2160p | NOT_TESTED | produced in CI, not downloadable here |

## 6. Next primary capability

Make the shared prefix loud: every early `return` in `survival_normal_input_gather_test`
records a reason and a bag snapshot, so the gate never again reports
`prefix_complete=false failures=0` without saying which step it gave up on. Then
finish the workplace panel path in the first process: wheel the recipe list until the
row is comfortably inside the viewport, press the visible part of the row, and prove
the button's `pressed` signal fired before asserting the job. Everything downstream
(charcoal, fuelled smelt, KEY_P prepare, `depart_world` flush, second-process settle,
one GUI collect, `make_parts`) is already written and unevaluated; it needs this one
interaction to become measurable.
