# WMP-02 / MAP-LR03R — corrective physical-world package

WMP-01 (the parent package one directory up) is **preserved byte-for-byte**: its
`manifest.v1.json`, `revisionDigest`, layers, rasters, evidence, docs, README and
`evidence/artifact_index.v1.json` were deliberately NOT regenerated. Everything
here is additive and versioned. The only files outside `v2/` are two new entry
points, `reproduce_v2.sh` and `clean-room_v2.sh`.

## Commands

```sh
cd veyra-world-master
./reproduce_v2.sh       # v2 build x2 (determinism), handoff, views, v2 tests, isolated clean room
./clean-room_v2.sh      # isolated WMP-01 75/75 + WMP-02 47/47 with equal digests
node v2/src/build_v2.mjs        # deterministic corrective compiler (writes v2/ only)
node v2/src/intake_v2.mjs       # typed GeographicHandoff + 3 windows x 18 masks
node v2/src/views_v2.mjs        # 8 analytical before/after PNGs
node v2/src/run_v2.mjs          # WMP_V2_TESTS 47/47 (29 physical, 11 negative fixtures)
node v2/src/artifact_index_v2.mjs
```

## Layout

| Path | Contents |
|---|---|
| `v2/src/` | all WMP-02 source (kept here so v1's pinned artifact index stays valid) |
| `v2/manifest.v2.json` | v2 manifest: pins parent v1 SHA + 8 layers + 11 rasters |
| `v2/layers/` | preflight audit, vertical/transport/build/roof/environment corrections, decisions, per-defect register |
| `v2/rasters/` | 11 normalized reproducible u8 rasters |
| `v2/handoff/` | complete typed `EconomyMap` + `GeographicHandoff`, structural self-check |
| `v2/evidence/windows/` | 3 complete spatial windows × 18 masks + continuity report |
| `v2/evidence/views/` | 8 technical PNGs + index (NOT Web renders, NOT art) |
| `v2/evidence/tests/` | 47/47 results, 18 negative-fixture records |
| `v2/evidence/` | clean-room report, build determinism, supplementary artifact index |
| `v2/docs/` | **one consolidated delta report**, preflight audit, intake contract, executed gates |

## Headline corrections

- 7/8 vertical blockers **VERIFIED_GEOMETRY** corrected candidates, 1 narrow
  **PROPOSED**, 0 fully BLOCKED; **no canonical portal moved**.
- 12 measured bridge decks (5 verified dry-land connectors; `br_5`, `br_b` still
  BLOCKED); 7 disconnected roads → 3 coincident-endpoint artefacts + 4 measured
  dry-land connectors; 11 crossings and outlet `rv_grey_low` measured.
- 23/23 build envelopes reconciled exactly with LR02: v1's 12 overlaps were 9;
  3 exact false-positive IDs removed; 23 usable connected dry subsets; 3 homes.
- 153 roofs physically assessed, 99 corrected source-room insets.
- 11 reproducible normalized environment rasters; no invented Gameplay rates.
- Complete typed handoff with 14 explicitly UNRESOLVED Gameplay-owned fields;
  Gameplay `compileEconomy()` / `diagnoseStarts()` NOT executed; Web untouched.

Read **one** consolidated report: `v2/docs/MAP_LR03R_DELTA_REPORT.md`.

PR #44 remains OPEN / DRAFT / HOLD / NO MERGE. Status is
`CORRECTED_PHYSICAL_WORLD_MASTER_CANDIDATE__NOT_SEALED`. Next-action owner:
Gameplay / Creator.
