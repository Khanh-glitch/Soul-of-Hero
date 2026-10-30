# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 4)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim, unchanged since checkpoint 2):** `gh issue comment 16` → `Resource not accessible by
integration, Locations: [{Line:1 Column:62}]`. The session's GitHub integration can open pull requests but has
**no issue-write permission**. Permission blocker, not a content blocker: the text below is final.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) — checkpoint 4 entry appended and read
back after checkpoints 1–3.

**Action required:** someone with issue-write access posts the text below on Issue #16, then deletes this file.
Git — PR #25, `ACCEPTANCE_SCOREBOARD.md`, `PLAYER_BLOCKERS.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 4 — the round-3 report was **rejected on three methodological points** (false absence, false-positive
closure, false-positive avatar). All three are now corrected in code and covered by tests. Branch
`arena/353cf120-soul-of-hero`, PR #25 updated (**not** self-merged). No gameplay file, loot table, rate or other
owner's code was touched; only A7-owned balance/QA paths.

### 1. Repin

| Owner | Head | Note |
|---|---|---|
| A0 | `7315f8e8` | PR #21 (`CONFLICTING`); overworld + save service + a mirror of A3's catalog |
| A1 | `7fd000e1` | handoff contract: 3 `iron_scrap` + 2 `knowledge_spares` / 1800 s, key `a1slice:poi_crown_waystation:cache_restock:1` |
| A3 | `c23292be` | **adopted** A1's rebind: `road_scrap` / `road_supplies` → `poi_crown_waystation` + `node_waystation_cache`, yields unchanged (3 / 2) |
| A6 | `bed3fc81` | grade-0 `idle_sheet` empty, grades 1–2 `null` → honest `SOURCE_BLOCKED` |
| A8 | `2d7f10d3` | native POI sites + `quarry_integration_candidate.v1.json`; scene still `test_harness_only` |

45 files sha256-pinned, plus `tree_index.txt`. CI evidence file: 21 runs, **19 queued / 2 completed**, and the two
completed runs (`1c5d4413`, `bffb872d`) contain no acceptance phrases ⇒ nothing above `S3` anywhere.

### 2. The three corrections

1. **False absence.** "No survival entry exists" was wrong: A0 ships Home hub → campaign destination →
   `EnterOverworldButton` → `AppFlow.open_overworld` with no test flag. The gate now separates **A** route exists in
   source (`S3`) / **B** runs natively (`STALE_HEAD`, not claimed) / **C** cache and POI mounted (`S0`) / **D** reward
   claimable and persisted (`PARTIAL`, `S3`). No claim promotes another.
2. **False closure.** The `transact_once` string-injection test is gone. BLK-4 now needs a precise static seam state
   (`MOUNTED_A1_CONTRACT_CALLER`) **and** a green native run on the pinned commit; `native_required_for_closure = true`.
   Adversarial tests prove a call in a comment, a dead function or an unmounted file never counts.
3. **False avatar.** Q-04 no longer accepts an invented `res://` path or a renamed scene. It requires the mounted body
   to resolve to Craftpix 555940/419402 **and** every claimed sheet to exist in the pinned tree. Native load,
   directional animation, equipped armour and rendered frames stay separate, higher acceptance.

### 3. Blockers (5, was 4), each with one owner and one flipping test

| # | Blocker | Owner | Class | Smallest safe correction |
|---|---|---|---|---|
| BLK-1 | world reachable, cache/site not mounted in it (0 A1 instance refs, 0 A8 scenes in the overworld) | A0 (+A1 cell, +A8 scene) | missing production mount | place ONE existing node/scene into the route's overworld |
| BLK-2 | A0's mirror of A3's catalog is `DRIFT` (34/36; 2 rows) | A0 | source-data incompatibility | re-sync two rows, **no quantity change** (A1 and A3 already agree on 3 + 2) |
| BLK-3 | mounted body is Knight; no grade-0 sheet installed | A6 (+A0) | player-facing visual defect | install one grade-0 idle sheet and point the manifest at it |
| BLK-4 | no A1-contract-keyed claim; no native run on the pinned head | A0 (+A8 drops its fixture) | fixture-only success | one caller keyed on `a1slice:…:cache_restock:1` inside `transact_once` |
| BLK-5 | A8 route actions have an item id, no authorized quantity | A3 | unauthorized cost | authorize a one-time construction cost, not a loot rate |

Closed or reclassified this round: bootstrap cycle (`CLOSED_MEASURED_FALSE` — 2 spares per claim, 3 needed, 2 claims),
debug/duplicate HUD (`CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN`), "16 mounted callers" → **8 proven / 8 unproven**,
region-vs-instance id confusion (`RECLASSIFIED` into BLK-2).

Measured consequence worth A3's attention: the first-hour loop now returns **3 `iron_scrap` + 2 `knowledge_spares`**
from a single crown claim, so the first research kit needs a second claim after the 1800 s restock. That is pacing,
not a dead end, and A7 asked for no rate change.

### 4. Verification

`python3 tools/survival/balance/run_analysis.py` → A01–A22 hold. `run_analysis.py --check` → artifacts match the
snapshots. `python3 tools/survival/balance/run_tests.py` → **211 tests, all green**, including 30 integration-gate
tests and 13 quality detector/closure tests. Unchanged anchors: 4-Spares `E[T] = 3.525289745`, route 1541.72 tiles,
118 POIs / 0 loot-bearing. Labels: `NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`, `NO_GAMEPLAY_EDIT`.

### 5. Next smallest owner action

A0: one mount + a two-row mirror sync. Then land one queued workflow green on the pinned commit — that is the only
route to `S4` and it costs no code. After that, A3 prices two A8 actions, and A6 installs one grade-0 sheet.
