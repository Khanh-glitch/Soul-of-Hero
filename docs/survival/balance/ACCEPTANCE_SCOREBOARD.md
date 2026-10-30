# A7 acceptance scoreboard — round 4 (corrected gate)

_Pinned 2026-10-30. Every row is reproducible from the bytes named here; nothing below was
observed in a running Godot session. Regenerate with
`python3 tools/survival/balance/run_analysis.py`, prove the artifacts still match the
snapshots with `--check`, run the suite with `python3 tools/survival/balance/run_tests.py`._

Round 4 exists because round 3 shipped three claims that the owners' own source contradicted.
Those claims are corrected in §6 rather than deleted, and the gate that produced them was
rebuilt so the same mistakes fail a test instead of surviving as prose.

## 1. What this scoreboard answers

One question: **can a player do one useful thing yet, and if not, exactly which link is
missing and who closes it?**

Six proof levels are used everywhere. Static inspection can never award more than `S3`,
because A7 executes nothing.

| Level | Meaning | Who can award it |
|---|---|---|
| `S0_ABSENT` | the link does not exist | A7 (grep / source read) |
| `S1_AUTHORED_ONLY` | authored data or a contract describes it; no code path | A7 |
| `S2_SCENE_FIXTURE` | a native scene demonstrates it with fake state | A7 |
| `S3_PRODUCTION_SEAM` | the production owner API exists and is reachable in source | A7 |
| `S4_NATIVE_COMMITTED` | native normal-input commit **+** reload in a second process | **owner only** |
| `S5_FULL_RELEASE` | `S4` + OS restart, visual inspection, human quality review | **owner + human** |

The four entry claims are tracked separately and never promote one another:
**A** route exists in source (`SOURCE_PRESENT`, S3) · **B** it runs in native Godot
(`STALE_HEAD`, **not claimed**) · **C** A1 continent + Waystation cache + A8 POI actually
mounted and reachable (`ABSENT`, S0) · **D** useful A3-authorised persisted reward claimable
(`PARTIAL`, S3).

## 2. Exact code under test

| Owner | Head | What it is |
|---|---|---|
| A0 | `7315f8e8` | app root, save service, HUD, overworld, A3 catalog mirror (PR #21, `CONFLICTING`) |
| A1 | `7fd000e1` | world data + the vertical-slice **handoff contract** |
| A3 | `c23292be` | items, sources, recipes, stations, loot tables |
| A6 | `bed3fc81` | player-first HUD, avatar adapter + art manifest |
| A8 | `2d7f10d3` | native POI sites + `quarry_integration_candidate.v1.json` |
| A8 task | `9332cb9b` | docs only (no scenes) |

**45 files** sha256-pinned in `data/survival/balance/snapshot/product_manifest.json`, plus a
`tree_index.txt` so a `res://` claim can be checked against real paths. `load_snapshot`
raises on any byte drift.

**CI evidence.** `data/survival/balance/evidence/ci_runs.v1.json` records **21** workflow
runs: **19 queued, 2 completed**. The two completed runs (`1c5d4413`, `bffb872d`) contain no
acceptance phrases, so nothing here is `S4`. A run only counts for the commit it ran on.

## 3. The chain that matters

Two chains are walked link by link, `L1`→`L8`; a chain is only as good as its weakest link.
**13 of 16 links are still blocked.**

| Link | `waystation_cache` (A1 contract) | `a8_quarry` (A8 native scene) |
|---|---|---|
| L1 entry — normal input reaches it | `S3` route exists in source; native run `STALE_HEAD` | `S3` same route; scene still `test_harness_only` |
| L2 route — walkable path to the stand | `S1` the reachable overworld has no A1 city node | `S2` walkable inside its own harness scene only, `physical_instance_id = null` |
| L3 interaction — real input on a placed object | `S1` `cache_restock` exists only in data | `S2` emits `soh.native_poi.intent.v1` in a harness |
| L4 authorization — A3-authorized cost/reward | **`S3`** A3 adopted A1's rebind: 3 scrap + 2 spares / 1800 s | `S0` two route actions carry `cost_quantity: null`, "no approved price" |
| L5 commit — `SaveService.transact_once` | `S3` API + key exist; **8** proven mounted callers, none keyed on A1's cache | `S2` `PoiAuthorityFixture` commits instead of `SaveService` |
| L6 reload — survives save/reload | `S3` a real two-process test exists in source; its run is `STALE_HEAD` | `S0` in-memory only |
| L7 no duplicate — replay refused | `S3` guard exists, not joined to the cache | `S2` dedup inside the fixture |
| L8 outcome — reward feeds a sink | **`S3`** `knowledge_spares` → `research_kit`, `make_notes`, `core_blank` | `S3` `stone_chunk` → picks / furnaces |

**Chain verdict: `waystation_cache` = `S1_AUTHORED_ONLY` (weakest `L2_ROUTE`);
`a8_quarry` = `S0_ABSENT` (weakest `L4_AUTHORIZATION`).** One honest sentence: the entry and
the price now exist, the container does not — the player can walk into A0's world and find
nothing to open.

## 4. Five blockers, each with one owner and one test

| # | Blocker | Owner | Class | Smallest safe correction | Test that flips it |
|---|---|---|---|---|---|
| BLK-1 | The world is reachable, but the A1 cache and A8 site are not mounted in it | A0 (+A1 cell, +A8 scene) | missing production mount | place ONE existing node/scene into the overworld the route already reaches | `test_integration_gate.py::GateClosureTests::test_blk1_closes_when_content_is_mounted` |
| BLK-2 | A0 ships a stale copy of A3's source catalog (34/36 rows; 2 drifted) | A0 | source-data incompatibility | re-sync the two rows; **no quantity change** — A1 and A3 already agree on 3 + 2 | `test_quality.py::QualityClosureTests::test_blk2_closes_when_the_a0_mirror_matches_a3` |
| BLK-3 | Mounted body is Knight art; the locked avatar has no installed frames | A6 (+A0 mount) | player-facing visual defect | install the grade-0 idle sheet for one gender (555940 male / 419402 female); grades 1–2 stay `SOURCE_BLOCKED` | `test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical` |
| BLK-4 | No A1-contract-keyed claim, and no native run on the pinned head | A0 (+A8 drops its fixture) | fixture-only success | one caller keyed on `a1slice:poi_crown_waystation:cache_restock:1` inside `transact_once`, then land the queued entry workflow green | `test_integration_gate.py::GateClosureTests::test_blk4_needs_both_a_contract_caller_and_native_evidence` |
| BLK-5 | A8's route actions have an item id but no authorized quantity | A3 | unauthorized cost | A3 authorizes a one-time construction cost per action; A8 deletes its self-declared value | `test_integration_gate.py::GateClosureTests::test_blk5_closes_when_a3_prices_the_two_route_actions` |

Every closure test builds the **defective** input first, requires the probe to FAIL, applies
the single owner edit, and requires PASS. Three adversarial tests keep the gate honest:
a comment, a dead function or an unmounted file containing `transact_once` never counts as
production integration, and a same-process reload never substitutes for a second OS process.

`BLK-4.native_required_for_closure = true`: no static edit closes it. `S4` is awarded only
by a green run on the pinned commit, so the queued workflows keep it `NOT_TESTED`.

## 5. Quality checks — five pass, two fail

| ID | Question | Verdict |
|---|---|---|
| Q-01 | Is a POI marked complete while empty? | PASS — 118 POIs, **0** loot-bearing in the authored contract, none labelled complete |
| Q-02 | Duplicate HUD ownership? | PASS — three scripts, disjoint jobs; dev vocabulary behind `_developer_diagnostics` (default `false`) |
| Q-03 | Invalid item/source mapping? | **FAIL** — A0's mirror is `DRIFT` (34/36); 0 unknown items, 0 unmapped site costs |
| Q-04 | Correct avatar identity and armour state? | **FAIL `WRONG_MOUNTED_IDENTITY`** — mounted `game/characters/knight/knight.tscn`; canonical refs `{555940:0, 419402:0, 180537:0}`; grades 1–2 `NULL_SOURCE_BLOCKED`; `visual_state NOT_TESTED` |
| Q-05 | Orphaned crafting/research outputs? | PASS |
| Q-06 | UI buttons without a genuine owner action? | PASS |
| Q-07 | Save/loot claims supported only by fixtures? | PASS — fixture text is labelled read-only where it appears |

`PROD-01…07` keep the broad file-level view (`4 FAIL / 2 WARN / 1 PASS`). Where a broad check
and a job-level check disagree, the job-level one decides and the disagreement is named here:
`PROD-06 WARN` ("two surfaces render player status") is superseded by `Q-02 PASS` (health /
provisions / context are different jobs). The raw file-level debug-token list stays on the
record as hygiene, not as a player blocker.

## 6. Corrections to A7's own round-3 claims

| # | Round-3 claim | Status | What is actually true |
|---|---|---|---|
| CORR-1 | "No survival entry exists; the home screen has no survival destination." | **WRONG AS STATED** | A0 ships an ordinary menu route — Home hub → campaign destination → `EnterOverworldButton` → `AppFlow.open_overworld`, no test flag. The detector searched only for a key literally named `survival`. What remains true: the world contains no A1 node and no A8 scene, and no native run has verified the route. |
| CORR-2 | "16 mounted callers commit through `transact_once` (structures, death, bed, door, recipes…)." | **OVERSTATED** | 65 raw tokens → **8** proven mounted callers: `harvest`, `_transfer`, `_transfer_all` in `SurvivalService` and 5 campaign paths in `AppFlow`. Eight more actions are called only from files A7 does not pin, so they are reported as **unproven**, not counted and not called dead. |
| CORR-3 | "A3 has not adopted A1's binding." | **STALE** | A3 adopted it at `c23292be`: 2/2 rebinds + 1 live-source reuse, yields 3 / 2, 1800 s renewable. The surviving defect moved to A0's mirrored copy (BLK-2). |
| CORR-4 | "The avatar closes when the manifest names an idle sheet." | **FALSE COMPLETION** | An invented `res://` path is not an installed image. Q-04 now requires the mounted body to resolve to 555940/419402 **and** every claimed sheet to exist in the pinned tree. Native load, directional animation, equipped armour and rendered frames remain separate, higher acceptance. |
| CORR-5 | "A mounted path committing through `transact_once` closes BLK-4." | **INVALID PASS** | A string-injected test proved nothing about compilation, mounting, authorization, receipt identity, durability, reload or replay. Replaced by a precise static-seam state plus native-only `S4/S5`. |

### Closed or reclassified (not carried as blockers)

| Was | Disposition | Evidence |
|---|---|---|
| "First research is a bootstrap cycle" | `CLOSED_MEASURED_FALSE` | A1 pays **2 `knowledge_spares` per cache claim**, renewable in 1800 s; `research_kit` is a **workbench** recipe needing 3 — two claims reach it with no station and **no invented rate**. Measured this round: the first-hour loop returns 3 `iron_scrap` + 2 `knowledge_spares` from one crown claim, so the second claim is pacing, not a dead end. |
| "Debug UI ships on screen and duplicates A0's HUD" | `CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN` | Survival UI is not mounted by any production scene; vocabulary sits behind a default-false dev flag; the three HUD jobs are disjoint. |
| "16 mounted callers cover every survival action" | `RECLASSIFIED` | 8 proven, 8 unproven (unpinned callers). |
| "A1's region ids are unresolved" | `RECLASSIFIED` | Class ids (`poi:*`), physical instances (`poi_*`) and regions (`r_*`) are three vocabularies. 10 class ids remain unresolved by design; 1 instance is bound; 3 region names stay A1-side. Renaming either set is an owner decision, not a 6th ticket. |

## 7. Evidence ledger

| Kind | Value |
|---|---|
| Pinned files | 45 (+ `tree_index.txt`) |
| Findings → blockers | 55 observations → 5 blockers; 3 closed; 6 traceability only |
| Gate tests | 30 (`test_integration_gate.py`), including 4 anti-spoof classes |
| Quality tests | 13 (`test_quality.py`), 7 detector + 6 closure |
| Owned suite | 211 tests, all green |
| Assertions | A01–A22, all hold |
| Native runs verified on these heads | **0** — 19 queued, 2 completed on other commits |
| 4-Spares expectation | `E[T] = 3.525289745` (unchanged) |
| Route under test | 1541.72 tiles (unchanged) |
| A7-authored gameplay edits | **0** (`NO_GAMEPLAY_EDIT`) |

Labels that apply to everything above: `NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`,
`NO_GAMEPLAY_EDIT`.

## 8. Next smallest owner action

1. **A0** — one mount (BLK-1) + re-sync two mirror rows (BLK-2): a single scene placement and
   a two-line data copy. Nothing else unblocks until the container exists.
2. **A0** — land one queued workflow green on the pinned commit; that is the only path to
   `S4` and it costs no code.
3. **A3** — authorize a quantity for `brace_east_shelf` / `chock_west_ramp` (BLK-5). A cost,
   not a loot rate.
4. **A6** — install one grade-0 idle sheet and point the manifest at the installed file
   (BLK-3). Grades 1–2 stay blocked; no Knight/Swordsman substitution.
