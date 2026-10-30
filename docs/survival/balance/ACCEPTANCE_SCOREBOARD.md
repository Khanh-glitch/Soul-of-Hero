# A7 acceptance scoreboard — round 3 (integration gate)

_Pinned 2026-10-30. Every row is reproducible from the bytes named here; nothing below
was observed in a running Godot session. Regenerate with
`python3 tools/survival/balance/run_analysis.py`, then `--check` proves the artifacts
still match the snapshots._

## 1. What this scoreboard answers

One question: **can a player do one useful thing yet, and if not, exactly which link is
missing and who closes it?**

It is deliberately not an inventory of features. Five proof levels are used everywhere,
and static inspection can never award more than `S3`:

| Level | Meaning |
|---|---|
| `S0_ABSENT` | the link does not exist |
| `S1_AUTHORED_ONLY` | authored data / a contract describes it; no code path |
| `S2_FIXTURE_ONLY` | a native scene demonstrates it with fake state |
| `S3_OWNER_SEAM_UNWIRED` | the production owner API exists but is not joined for this action |
| `S4_NATIVE_COMMITTED` | native normal-input commit **+** reload proven by the owning agent |
| `S5_FULL_NORMAL_INPUT` | `S4` + fresh OS process restart + inspected visual evidence |

## 2. Exact code under test

| Owner | Head | What it is |
|---|---|---|
| A0 | `77e434a7` | app root, save service, HUD, resource nodes, A3 catalog mirror |
| A1 | `2951bf85` | world data + the vertical-slice **handoff contract** |
| A3 | `18e7afcb` | items, sources, recipes, stations, loot tables |
| A6 | `bed3fc81` | player-first HUD, avatar adapter + art manifest |
| A8 | `f9ed82b9` | native POI sites (`crown_south_quarry`, mill, orchard ruin) |
| A8 task | `9332cb9b` | docs only (no scenes) |

37 files sha256-pinned in `data/survival/balance/snapshot/product_manifest.json`.
The tool refuses to load if any byte changed (`load_snapshot` raises on drift).

## 3. The chain that matters

Two chains are walked link by link, `L1`→`L8`. A chain is only as good as its weakest link.

| Link | `waystation_cache` (A1 contract) | `a8_quarry` (A8 native scene) |
|---|---|---|
| L1 entry — normal input reaches it | `S0_ABSENT` — home has no survival destination | `S0_ABSENT` — scene is `test_harness_only` |
| L2 route — walkable path to the stand | `S1_AUTHORED_ONLY` — authored geometry, nothing draws it | `S2_FIXTURE_ONLY` — walkable inside the scene only |
| L3 interaction — real input on a placed object | `S1_AUTHORED_ONLY` — `cache_restock` exists only in data | `S2_FIXTURE_ONLY` — emits `soh.native_poi.intent.v1` in a harness |
| L4 authorization — A3-authorized cost/reward | `S1_AUTHORED_ONLY` — A1 authorizes 3 scrap + 2 spares; A3 has not adopted the binding | `S0_ABSENT` — site pays fixed `stone_chunk` and says "A3 cost authorization absent" |
| L5 commit — `SaveService.transact_once` | `S3_OWNER_SEAM_UNWIRED` — API + key exist, no caller | `S3_OWNER_SEAM_UNWIRED` — `PoiAuthorityFixture` commits instead |
| L6 reload — survives save/reload | `S3_OWNER_SEAM_UNWIRED` — receipts in the document, never restored in a new process | `S0_ABSENT` — in-memory only |
| L7 no duplicate — replay refused | `S3_OWNER_SEAM_UNWIRED` — replay rejection exists, not joined | `S2_FIXTURE_ONLY` — deduplicated inside the fixture |
| L8 outcome — reward feeds a sink | `S1_AUTHORED_ONLY` — `knowledge_spares` → `research_kit`, `make_notes`, `core_blank` | `S1_AUTHORED_ONLY` — `stone_chunk` → picks / furnaces |

**Chain verdict: `S0_ABSENT`, weakest link `L1_ENTRY`.** 14 of 16 links are still blocked.
There is no path from the home screen to a committed, reloadable, non-duplicating player
action — that is the honest headline, and it is one missing mount rather than sixteen
unrelated problems.

## 4. Four blockers (was five)

| # | Blocker | Owner | Class | Smallest safe correction | Test that flips it |
|---|---|---|---|---|---|
| BLK-1 | No production mount: no interaction reachable with normal input | A0 (+A1/A8) | missing production mount | one home destination hosting the existing world + site scenes, no test flag | `test_integration_gate.py::GateClosureTests::test_blk1_closes_when_a_home_destination_exists` |
| BLK-2 | A1 already authorizes the first-hour cache; A3 has not adopted the binding | A3 (+A8) | source-data incompatibility | adopt A1's own rebind: `poi_id` → `poi_crown_waystation` on `road_scrap` / `road_supplies`; **no rate change** | `...::test_blk2_closes_when_a3_adopts_the_a1_binding_without_changing_yields` |
| BLK-3 | Mounted body is Knight art; locked avatar has no installed frames | A6 (+A0) | player-facing visual defect | install the grade-0 idle sheet for the chosen gender; keep grades 1–2 `SOURCE_BLOCKED` | `test_quality.py::QualityClosureTests::test_blk3_closes_when_the_mounted_body_and_grade0_sheet_are_canonical` |
| BLK-4 | Every existing reward path is fixture-only: nothing committed, reloaded or de-duplicated | A0 (+A8) | fixture-only success | wire the claim to `transact_once` with A1's key; add the two-process reload test | `...::test_blk4_closes_when_a_mounted_path_commits_through_transact_once` |

Each closure test builds the *defective* input first, requires the probe to be FAIL, applies
the one owner edit, and requires PASS. `test_blk2_does_not_close_by_inventing_a_rate` and
`test_same_process_reload_alone_does_not_close_blk4` prove the wrong fixes do **not** close them.

### Closed by measurement (not by code change)

| Was | Disposition | Why the earlier claim was wrong |
|---|---|---|
| "First research is a bootstrap cycle" | `CLOSED_MEASURED_FALSE` | A1 authorizes **2 `knowledge_spares` per Waystation cache claim** (renewable, 1800 s), and `research_kit` is a **workbench** recipe needing 3 spares — so the ladder starts without any station. Two claims (= one cooldown) reach it. **No new source, no new rate.** |
| "Debug UI ships on screen and duplicates A0's HUD" | `CLOSED_NOT_PLAYER_FACING_AT_THIS_PIN` | The old ~100-token figure was a whole-file grep. On mounted surfaces the vocabulary is behind `_developer_diagnostics` (default `false`), and the survival UI is not mounted by any production scene. The three HUD scripts own **disjoint** jobs (health / provisions / context-core-feedback). |

The bootstrap-cycle *detector* is kept as an early warning for the `make_spares` ↔
research-station edge; it is no longer a player-facing blocker.

## 5. Quality checks for "half-built mistaken for finished"

| ID | Defect class | Status | Evidence at this pin |
|---|---|---|---|
| Q-01 | empty POIs mislabelled complete | **PASS** | 106/118 are contract-only, none mounted; 0 effect-free options |
| Q-02 | duplicate HUD ownership / exposed developer text | **PASS** | 3 surfaces, disjoint jobs; debug flag default `false` |
| Q-03 | invalid item/source mapping | **PASS** | 0 sources or site costs/rewards outside `items.json`; A0 mirror matches A3 36/36 |
| Q-04 | incorrect avatar identity / armour state | **FAIL** | mounted body Knight; grade-0 sheet not installed; grades 1–2 `NULL_SOURCE_BLOCKED` |
| Q-05 | orphaned crafting/research outputs | **PASS** | 0 orphans; 10 terminal outputs, all consumed (charcoal = fuel ×4) |
| Q-06 | buttons without a genuine owner action | **PASS** | 6 `_has_action_host()` guards, workspace forwards, storage adapter read-only |
| Q-07 | save/loot claims supported only by fixtures | **PASS** | every demo declares `TEST FIXTURE ONLY`; no overclaim token in a fixture path |

Only **Q-04** fails, and it is the same defect as BLK-3 — one blocker, one check, no double
counting. `PROD-04/05/06` (the broad file-level audit) stay `FAIL`/`WARN`: they are hygiene
signals over whole files, superseded by the job-level and mount-level measurements above,
and they are deliberately not re-tightened to manufacture agreement.

## 6. Reproducible tests: 191, no inflation

| Suite | Count | What it proves |
|---|---|---|
| pre-existing balance/oracle suite | 164 | unchanged; `E[T]` for 4 spares = `3.525289745`, route length 1541.72 tiles |
| `test_integration_gate.py` | 16 | chain shape, S≤3 discipline, one simulated owner edit per blocker, wrong-fix refusals |
| `test_quality.py` | 11 | each detector fails on a hand-built defect and passes without it |

`python3 tools/survival/balance/run_analysis.py --check` → `artifacts up to date`.

## 7. Owner-side native commands (the only route to S4/S5)

A7 runs no Godot here, so `S4`/`S5` are **not claimed**. These are the exact strings mined
from the owners' own workflows:

```bash
# A0 import + headless runtime
godot --headless --path . --user-data-dir artifacts/ud_import --import
godot --path . --rendering-method gl_compatibility --rendering-driver opengl3 \
  --script res://tests/survival_foundation_test.gd

# the commit proof that does not exist yet: TWO processes, one user-data dir
godot --headless --path . --user-data-dir artifacts/ud_loot \
  --script res://tests/survival_slice_claim_commit.gd
godot --headless --path . --user-data-dir artifacts/ud_loot \
  --script res://tests/survival_slice_reload_no_duplicate.gd

# A8 native contract + capture
godot --headless --path . --editor --quit
godot --headless --path . --script tests/survival/world_content/native_poi_contract_test.gd
xvfb-run -a godot --path . --resolution "1280x720" --rendering-method gl_compatibility \
  --script tools/survival/world_content/capture_native_pilot.gd -- --width=1280 --height=720 \
  --output=.artifacts/a8-world-content/pilot-1280x720.png
```

`S4` requires the seven assertions in `gate.json → owner_assertions_for_S4` to hold in a
single native run: entry with no test flag, exact cost removed once, exact reward added
once, one recorded receipt, second-process restore, replay leaves inventory unchanged,
reward consumed by the named sink.

## 8. Next smallest action, in order

1. **A0** — one home destination mounting the existing A1 world host + A8 site scene behind
   the normal input gate. Closes `L1` and makes the whole chain testable.
2. **A3** — adopt A1's rebind on two rows (`poi_id` only). Closes `L4`; no quantity moves.
3. **A0** — `transact_once` call site + the two-process reload test. Closes `L5`–`L7`.
4. **A6** — install the grade-0 idle sheet for one gender. Closes `Q-04`.

Nothing here asks any owner to redesign a system, add content, or change a drop rate.

## 9. Explicit non-claims

- No native run was performed by A7; `NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`, `NO_GAMEPLAY_EDIT`.
- `S4`/`S5` are unreachable from static evidence and are not reported anywhere above.
- No Core drop rate is derived, chosen or recommended; `A3` has no authored Core rate.
- The 14-session model and the `3.525289745` expectation describe an authored table, not a playtest.
- No A0/A1/A3/A6/A8 file was modified by this work; only A7-owned balance/QA paths changed.
