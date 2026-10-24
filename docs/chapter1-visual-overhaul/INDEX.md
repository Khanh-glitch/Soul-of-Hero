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

`chapter_1_balance_matrix_test` is a known pre-existing, baseline-matched
failure on this branch and is reported in `regressions/` rather than
silently passed. See the Level 5 review for the pinned-baseline proof.

## Gallery

`gallery/chapter1_after_overview.png` — one AFTER frame per level.
`L01/` … `L10/` — native frames, before/after pairs, crops, `REVIEW.md`.
