# Chapter 1 — visual overhaul

Shared presentation layer: `game/levels/presentation/chapter1_environment_art.gd`.
Per-level themes: `data/environment/chapter1/<level_id>.json`.
Native frames: `.github/workflows/chapter1-visual-overhaul.yml` (production `AppRoot` → `AppFlow.start_campaign_level`).

| Level | Title | Native frames | Status |
| --- | --- | --- | --- |
| L01 | Crypt Entrance | 7 | `INCOMPLETE — ART DELIVERY FAILED` |
| L02 | Ossuary Fork | 8 | `INCOMPLETE — ART DELIVERY FAILED` |
| L03 | Crossfire Archive | 9 | `INCOMPLETE — ART DELIVERY FAILED` |
| L04 | Spiral Reliquary | 8 | `INCOMPLETE — ART DELIVERY FAILED` |
| L05 | Blood Crucible | 9 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L06 | Soul Anchor Relay | 7 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L07 | The Failing Beacon | 4 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L08 | Divided Reliquary | 4 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L09 | The Crimson Gate | 4 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L10 | Castellan Throne | 4 | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |

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
| chapter_1_level_10 | 648 -> 734 | 97 -> 121 | 103.1 MiB |
| chapter_1_level_1 | 677 -> 701 | 74 -> 79 | 106.7 MiB |
| chapter_1_level_2 | 695 -> 718 | 72 -> 96 | 133.9 MiB |
| chapter_1_level_3 | 750 -> 776 | 69 -> 82 | 111.9 MiB |
| chapter_1_level_4 | 779 -> 802 | 72 -> 77 | 111.4 MiB |
| chapter_1_level_5 | 866 -> 1070 | 103 -> 110 | 119.8 MiB |
| chapter_1_level_6 | 866 -> 1103 | 66 -> 73 | 119.1 MiB |
| chapter_1_level_7 | 661 -> 908 | 92 -> 120 | 115.8 MiB |
| chapter_1_level_8 | 691 -> 843 | 119 -> 136 | 112.9 MiB |
| chapter_1_level_9 | 736 -> 833 | 118 -> 131 | 108.6 MiB |
