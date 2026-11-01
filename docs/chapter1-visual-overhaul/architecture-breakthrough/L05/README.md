# L05 — Blood Crucible: evidence index

All frames here are **native Godot 4.7 captures**, 1280×720, taken by
`tools/captures/crucible_capture.gd` through the real campaign boot
(`AppRoot` → `AppFlow.start_campaign_level("chapter_1_level_5")`) with a seeded
throwaway save. No image in this folder is synthetic, PIL-composed or re-used from
an earlier map revision; the workflow regenerates the art and the plan from source
first and fails on any byte difference, then captures.

## Gameplay stations (zoom 1.0, ordinary play view)

| File | Station | Cell |
|---|---|---|
| `images/after_f1_spawn.png` | Floor 1 — the first gameplay frame | (10, 17) |
| `images/after_f1_gate.png` | Floor 1 — the processional gate and shrine | (16, 14) |
| `images/after_f1_altar.png` | Floor 1 — the raised crucible on its island | (46, 19) |
| `images/after_f2_landing.png` | Floor 2 — the landing | (8, 47) |
| `images/after_f2_court.png` | Floor 2 — the blood court | (91, 47) |
| `images/after_f2_encounter.png` | Floor 2 — court encounter ground | (91, 47) |
| `images/after_f3_approach.png` | Floor 3 — the arena threshold | (70, 76) |
| `images/after_f3_fight.png` | Floor 3 — the live Hooded Archer fight, mid-combat | (85, 71) |

`f3_fight` is not posed: the harness walks the Knight in, wakes the archer, runs
≈150 physics frames of real combat and photographs it with volleys in the air.

## Floor overviews

`images/overview_floor{1,2,3}.png` are the same live level with the camera pulled
back by zoom (0.5 / 0.4 / 0.45) so a whole floor is legible. The filenames carry
`overview_`, they are never presented as gameplay-size frames.

## Before / after

`images/pair_*.png` put the **before** (identical map, collision, entities and HUD,
presentation layer disabled via `--no-art`) beside the **after**. The pair isolates
the architecture layer and nothing else.

## Comparisons and crops

* `comparisons/gold_vs_rejected_vs_after.png` — gold reference A
  (`docs/gate2/evidence/after_archive_entry.png`), gold reference B
  (`prototypes/environment_art/archive_audition/archive_room_end.png`), the
  rejected L5 baseline (`docs/chapter1-visual-overhaul/L05/images/after_entry.png`)
  and the current after frame, side by side at gameplay scale.
* `crops/crop_3x_*.png` — integer 3× nearest-neighbour centre crops, to inspect
  pixel-level craft (paving joints, wall courses, prop outlines).

## Logs

`logs/after.txt`, `logs/before.txt`, `logs/check_harness.txt` and one log per frozen
suite, all copied verbatim from the workflow run that produced the frames. The
after log carries the build line, e.g.

```
CRUCIBLE ART: floor_detail=5617 wall_cells=3303 bedrock=4609 props=114 lights=22 shadows=506
CRUCIBLE PERF: art=on nodes=1013 draw_calls=110 static_mb=116.4 fps=1
```

(`fps=1` is llvmpipe software rendering on the CI runner, not a game measurement.)

`manifest.json` pins the branch, the commit, the SHA-256 of every source that
produced the frames, the capture metrics for both runs, and the station cells.

## Reproducing

The workflow is `.github/workflows/chapter1-architecture.yml`. It regenerates
`assets/environment/chapter1/crucible/*` and
`data/levels/chapter_1_level_5_architecture.json` from the two Python generators,
fails if the committed bytes differ, imports the project, compile-checks the
harness and the presentation layer by running the scene headless, runs the frozen
Level 5 suites, captures art-on and `--no-art`, asserts that the architecture
actually built (`wall_cells > 0`) and that the live boss frame exists, then
publishes the logs and frames.
