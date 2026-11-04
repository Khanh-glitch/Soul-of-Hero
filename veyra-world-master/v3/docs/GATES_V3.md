# WMP-03 Map-owned gate ledger

`WMP03_MAP_CORRECTIVE_READY_FOR_GAMEPLAY_REVIEW` requires **every Map-owned gate below** to
be proven by executable evidence. All are PASS. Gameplay/Creator-owned gates are explicitly
out of Map scope and are listed as remaining owners in the delta report.

| Gate | Requirement | Evidence | Result |
| --- | --- | --- | --- |
| G-01 | Recheck live HEADs, concurrency, PR44 before editing | `PREFLIGHT_AUDIT_V3.md` §2 | PASS: Map `c600f041`, PR44 `d73aa63f` DRAFT/OPEN, no new comments |
| G-02 | Reproduce WMP-02 baseline | isolated `./reproduce_v2.sh` | PASS: 75/75, 47/47, `872502373e…`, index 102/5,827,481 |
| G-03 | WMP-01 + WMP-02 byte-for-byte unchanged | `git diff c600f041` excluding `v3/` + 2 scripts | PASS: empty |
| G-04 | Build v3 twice deterministically | `build_determinism_v3.json` | PASS: identical `1356735557…` |
| G-05 | Clean room without GOLD/MapLab/network | `clean_room_v3.json` | PASS: equal digests, `noExternalGoldTree/noLegacyLab/noMigrationReader/noNetwork=true` |
| G-06 | Independent negative fixtures against each prior defect | `negative_fixtures.v3.json` | PASS: 17 fixtures / 17 defect IDs, all PASS |
| G-07 | Physical suite with zero failures | `test_results.v3.json` | PASS: 91/91 (74 physical + 17 negative), FAIL=0 |
| G-08 | Inspect actual technical images | 7/7 PNGs read directly | PASS: all labelled technical, not visual acceptance |
| G-09 | Report changed measurements | `measured_delta.v3.json` + delta report §3–7 | PASS: before/after tables for 4 P0s + structural |
| G-10 | Typed interfaces with provenance + UNKNOWN/PROPOSED/VERIFIED | `map_physical_semantics.v3.json` | PASS: 15 fields, 6-value vocabulary, no-authority claims |
| G-11 | Preserve compatibility without unapproved authoritative values | `INTAKE_CONTRACT_V3.md` §1–5 | PASS: 13-array shape kept, `cargoPassable` zeroed, explicit boundary |
| G-12 | P0-01 terrain | `terrain_height_class.v3.json` | PASS: 305 connected cliffs, 6 regions validated, units UNRESOLVED |
| G-13 | P0-02 roads | `road_rasterization_delta.v3.json` | PASS: 76.198→5.6569 au max drift, 92 IDs, 4-connected |
| G-14 | P0-03 water traversal | `water_traversal.v3.json` | PASS: 219→0 ferry walkable, 267→0 water walkable, 0 permissions |
| G-15 | P0-04 construction | `construction_semantics.v3.json` | PASS: 1242→7035 possible cells, 6481 outside surveyed zones |
| G-16 | Bounded structural checks without redesign | `structural_checks.v3.json` | PASS: 81 POIs, 18 overlaps, 153 roofs, 0 shrinks, 0 relocations |
| G-17 | Complete spatial windows | `window_report.v3.json` | PASS: 3×25 masks, duplicates=0, coverage=43750/43750 |
| G-18 | No overclaims | manifest / interface / handoff `noClaims` | PASS: no playable/visual/sealed/merge/validator claims |
| G-19 | Commit + push only Map branch; PR44 DRAFT/unmerged | `COMMIT_REFERENCE.md` | PASS after push |
| G-20 | One exact-SHA PR44 handoff comment if permitted | PR44 comment | PASS after post |

### What a PASS does NOT mean

- `mapStructuralSelfCheckV3() errors=0` is **not** `validateGeographicHandoff()`.
- 7 analytical PNGs are **not** 640×360 1× pixel legibility or creator visual acceptance.
- 91/91 Map tests are **not** independent CI or Gameplay runtime ingestion.
- `READY_FOR_GAMEPLAY_REVIEW` is **not** `WORLD_MASTER_SEALED`, `VEYRA_PLAYABLE`,
  `VISUAL_ACCEPTED` or `MERGE_READY`.
