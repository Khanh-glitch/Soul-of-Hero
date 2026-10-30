# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 5)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim, re-probed this round):** `gh issue comment 16` → `Resource not accessible by
integration, Locations: [{Line:1 Column:49}]`. The session's GitHub integration can open pull requests
but has **no issue-write permission**. Permission blocker, not a content blocker: the text below is final.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) — checkpoint 5 entry is
appended after checkpoints 1–4.

**Action required:** someone with issue-write access posts the text below on Issue #16, then deletes this
file. Git — PR #25, `ACCEPTANCE_SCOREBOARD.md`, `PLAYER_BLOCKERS.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 5 — the gate is now a **gatekeeper of integrated player value**, not a findings
generator. Five blockers (was five, but different ones), each with one owner, one smallest safe
correction and one test that flips `FAIL`→`PASS`. Branch `arena/353cf120-soul-of-hero`, PR #25
updated (**not** self-merged). No gameplay file, loot table, rate, price or owner code was touched.

### 1. Repin against current heads

| Owner | Head | Note |
|---|---|---|
| A0 | `51f2cce8` | PR #21; **new**: one-line float-precision fix in the authoritative save writer |
| A1 | `2f6edd3f` | handoff contract: 3 `iron_scrap` + 2 `knowledge_spares` / 1800 s, key `a1slice:poi_crown_waystation:cache_restock:1` |
| A3 | `100b3406` | **adopted** A1's 2/2 instance rebinds; yields unchanged (3 / 2) |
| A6 | `8bc0af5a` | manifest now states `BASE_ART_NOT_IMPORTED`; adapter returns `SOURCE_BLOCKED` |
| A8 | `5ccf7b3f` | native POI sites; contract step fails; no artifact produced |
| A8 task | `9332cb9b` | `feature/surv-a8-reuse-audit-010a` — the reuse audit, **unmerged** and not treated as A8 head |

**52 files** sha256-pinned (+ `tree_index.txt`). Roadside loot ids are read as a separate class from
region ids and physical instance ids: A1 publishes both `si:r_ashen_crown:waystation_cache:01` and
`node_waystation_cache` for one object and A3 binds the interaction node id, so the vocabularies meet
at a named seam instead of being aliased.

### 2. Three A7 self-corrections (recorded, tested, not deleted)

1. **`CORR-6`** — "the first-research bootstrap cycle is closed" was **conditional**, not true. Every
   spare recipe needs a research station, the `research_kit` that builds one costs 3 spares, and the
   only non-circular seed is `road_supplies` (2/claim, 1800 s) looted from the cache that is mounted
   nowhere. With the cache mounted, two claims do reach the kit — exactly as round 4 said, but only then.
2. **`CORR-7`** — claim **C** would have produced a **false positive this round**: pinning A0's own test
   harness made `node_waystation_cache` appear in the snapshot. `entry_content` now reads production
   paths only (`tests/`, `.github/`, `tools/` excluded) and reports the excluded references openly.
3. **`CORR-8`** — "A6 points the manifest at an invented sheet" is not what the bytes say. A6 declares
   `BASE_ART_NOT_IMPORTED`, `idle_sheet: ""`, `runtime_status: NOT_IMPORTED` and its adapter returns
   `SOURCE_BLOCKED`. It is honest; the defect is that the locked identity was never imported.

### 3. New: four independent oracles (answers come from outside the graded file)

| Oracle | Verdict | Why it matters |
|---|---|---|
| `engine_api` vs the engine's own class list | `UNKNOWN_ENGINE_STATIC`, **15** sites | all 15 are `Vector2.from_array(...)`; `Vector2` has exactly one static method (`from_angle`). A8's import step is green and its contract step is red — the audit is the only thing separating "parsed" from "works". |
| `save_fidelity` vs Godot's `JSON.stringify` contract | `ROUND_TRIP_EXACT`, 1 authoritative writer, 0 lossy | explains both failed whole-document comparisons (`inventory`, `survival document`, `custody after reload`, `disk unchanged after interrupted write`): the old writer printed floats with `14 - floor(log10|x|)` decimals. |
| `knowledge_gate` over the real recipe/source graph | `SEEDED_ONLY_BY_LOOT` | the first-hour ladder is circular until the cache is mounted. |
| `authorization` vs A3's pinned bytes | `NO_UNBACKED_AUTHORIZATION`, 1 claim, 0 rejected | an `AUTHORIZED_BY_A3` marker carries no weight on its own. |

### 4. The five blockers

| # | Blocker | Owner | Class | Smallest safe correction | Flips to PASS |
|---|---|---|---|---|---|
| BLK-1 | the A1 cache and A8 site are in **no** world a player can reach (0 production instance refs; claim C `ABSENT`) | A0 (+A1 cell, +A8 scene) | missing production mount | place the existing node in the production overworld; no data edit, no rate change | `test_blk1_needs_a_production_path_not_a_test_harness` |
| BLK-2 | 15 × `Vector2.from_array` in A8 scenes | A8 | native runtime failure | mechanical `Vector2(x, y)` conversion | `test_a8_call_sites_disappear_after_the_conversion` |
| BLK-3 | precision fix is in the tree, **unproven natively**; the workflow triggers only on A0's branch | A0 | source-of-truth defect, unproven | dispatch `a0-save-precision` on the pinned sha; no code change needed | `test_whole_document_reload_is_impossible_to_prove_without_full_precision` |
| BLK-4 | the only A3-authorised reward proof is a fixture that fails its own reload checks; `S4` is **0 of 5 clauses** | A0 (+A3) | fixture-only success | make the player-input half run and pass on the sha | `test_blk4_needs_all_five_s4_clauses` |
| BLK-5 | mounted body is the Knight; the D051-locked art is not imported | A6 (+A0) | player-facing visual defect | import one grade-0 idle sheet, point the manifest at the installed file | `test_blk5_closes_when_the_mounted_body_and_grade0_sheet_are_canonical` |

Closed by owner source this round: A0's stale A3 mirror (`Q-03` now `MATCH` over 36/36), A3's binding
adoption (3/3), and the region-vs-instance id question. Closed earlier and still closed: the
developer-facing duplicate HUD.

**`S4` stays false and is asserted to stay false** (`A27`): it is a conjunction of exact sha, normal
entry, independent second process, authorised commit and negative replay. CI at this pin is 33 runs,
**18 queued / 15 completed — all 15 failing**; nothing above `S3` is claimed anywhere.

### 5. Verification

`run_analysis.py` → 27/27 assertions hold. `run_analysis.py --check` → artifacts match the pins.
`run_tests.py` → **231 tests, all green** (30 integration-gate, 16 oracle, 13 quality detectors).
Unchanged anchors: 4-Spares `E[T] = 3.525289745`, route 1541.72 tiles, 118 POIs / 0 loot-bearing,
13/16 chain links blocked. Labels: `NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`, `NO_GAMEPLAY_EDIT`.

### 6. Next smallest owner action

A8 converts 15 mechanical call sites → BLK-2 closes on its own workflow. A0 then places one existing
node and adds one caller keyed on the A1 transaction key → BLK-1 and BLK-4. Both are smaller than any
new system, and neither needs a new reward, a new POI or a rate change.
