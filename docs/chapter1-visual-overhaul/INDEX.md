# Chapter 1 — visual overhaul

Shared presentation layer: `game/levels/presentation/chapter1_environment_art.gd`.
Per-level themes: `data/environment/chapter1/<level_id>.json`.
Native frames: `.github/workflows/chapter1-visual-overhaul.yml` (production `AppRoot` → `AppFlow.start_campaign_level`).

| Level | Title | Native frames | Status |
| --- | --- | --- | --- |
| L01 | Crypt Entrance | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L02 | Ossuary Fork | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L03 | Crossfire Archive | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L04 | Spiral Reliquary | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L05 | Blood Crucible | 5 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L06 | Soul Anchor Relay | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L07 | The Failing Beacon | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L08 | Divided Reliquary | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L09 | The Crimson Gate | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |
| L10 | Castellan Throne | 4 | `TECHNICALLY VALID — VISUAL NOT READY` |

## Gameplay gates (frozen, unchanged expectations)

| Suite | Result |
| --- | --- |
| `chapter_1_map_design_test` | PASSED |
| `chapter_1_campaign_map_design_test` | PASSED |
| `chapter_1_collision_route_test` | PASSED |

`chapter_1_balance_matrix_test` is a known pre-existing failure on this
branch: it fails the same way on the pre-sprint tree and touches no file
this sprint changed. This workflow records its log in
`regressions/logs/chapter_1_balance_matrix_test.txt` and deliberately does
not gate on it, rather than quietly dropping or relabelling it.

## Gallery

`gallery/chapter1_after_overview.png` — one AFTER frame per level.
`gallery/level5_to_10_comparison.png` — BEFORE/AFTER pairs for Levels 5-10.
`L01/` … `L10/` — native frames, before/after pairs, crops, `REVIEW.md`.

## Cost of the presentation layer

Measured on the capture frame of the same run, art off vs art on:

| Level | Nodes | Draw calls | Static memory |
| --- | --- | --- | --- |
| chapter_1_level_10 | 640 -> 655 | 91 -> 104 | 98.1 MiB |
| chapter_1_level_1 | 677 -> 697 | 74 -> 77 | 104.9 MiB |
| chapter_1_level_2 | 695 -> 715 | 72 -> 91 | 128.8 MiB |
| chapter_1_level_3 | 750 -> 771 | 69 -> 80 | 108.3 MiB |
| chapter_1_level_4 | 780 -> 798 | 72 -> 76 | 108.1 MiB |
| chapter_1_level_5 | 870 -> 1073 | 103 -> 110 | 119.6 MiB |
| chapter_1_level_6 | 865 -> 884 | 66 -> 78 | 110.0 MiB |
| chapter_1_level_7 | 664 -> 678 | 92 -> 103 | 107.7 MiB |
| chapter_1_level_8 | 680 -> 698 | 107 -> 118 | 104.1 MiB |
| chapter_1_level_9 | 718 -> 731 | 105 -> 118 | 101.2 MiB |
