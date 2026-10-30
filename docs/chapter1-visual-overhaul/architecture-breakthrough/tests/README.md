# Tests for the architecture breakthrough pass

The frozen suites are executed natively inside
`.github/workflows/chapter1-architecture.yml`, in the same job that regenerates the
art, validates the authored plan and captures the frames. Logs are copied verbatim
into `../L05/logs/` by the workflow's publish step, so the log and the frames in
this evidence folder always come from the same run.

Real entrypoints used (the split matters in this repo: SceneTree suites run with
`--script`, suites that need autoloads need their `.tscn`):

| Suite | Entrypoint | Runner | Result |
|---|---|---|---|
| `chapter_1_map_design_test` | `res://tests/chapter_1_map_design_test.gd` | `--script` | `CHAPTER 1 MAP DESIGN 837/837` |
| `chapter_1_campaign_map_design_test` | `.gd` | `--script` | `PASSED - 46292 checks across ten maps` |
| `chapter_1_collision_route_test` | `.tscn` | scene | `PASSED - 161 checks across ten live maps` |
| `chapter_1_level_5_miniboss_test` | `.gd` | `--script` | `PASSED - 77 checks` |
| `level_5_archer_pickup_test` | `.gd` | `--script` | `PASSED - 59 checks` |
| `chapter_1_level_5_live_loot_regression` | `.tscn` | scene | `PASSED - 22 checks` |
| `chapter_1_balance_matrix_test` | `.gd` | `--script` | **recorded only**: fails identically at baseline `a1ae892`, disclosed as pre-existing |

Additional gates in the same workflow:

* the art kit and the architecture plan are regenerated from source and compared
  byte for byte with the committed files (determinism),
* the harness and the presentation layer are compile-checked by running the scene
  headless with `--quit-after`, which resolves autoloads the way the game does,
* the capture step fails unless the architecture actually built
  (`wall_cells > 0`, `props > 0`) and the live boss frame exists,
* the workflow fails if the harness never booted, so a capture can no longer time
  out silently.
