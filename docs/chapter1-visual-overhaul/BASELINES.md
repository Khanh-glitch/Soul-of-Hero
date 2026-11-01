# Baselines

Branch: `arena/6e89e68d-soul-of-hero` (the only authorized branch).
Evidence commit before this sprint: `564c65ec4472fd0481aa475f5e69346278a5dbfb`.

Map sources are the production campaign documents and were not edited by
this overhaul; the presentation layer is additive and derived:

| Level | Map source |
| --- | --- |
| L01 | `data/levels/crypt_entrance.json` |
| L02 | `data/levels/chapter_1_level_2.json` |
| L03 | `data/levels/chapter_1_level_3.json` |
| L04 | `data/levels/chapter_1_level_4.json` |
| L05 | `data/levels/chapter_1_level_5.json` |
| L06 | `data/levels/chapter_1_level_6.json` |
| L07 | `data/levels/chapter_1_level_7.json` |
| L08 | `data/levels/chapter_1_level_8.json` |
| L09 | `data/levels/chapter_1_level_9.json` |
| L10 | `data/levels/chapter_1_level_10.json` |

Exact per-file hashes: `regressions/source_pins.txt`, toolchain and HEAD:
`regressions/toolchain.txt`.

## What BEFORE means here

`--no-art` boots the *same* map with the presentation layer disabled: same
geometry, same collision, same entities, same HUD, same camera stations.
The before/after pairs therefore isolate exactly one variable — the art
layer — instead of comparing two different maps.
