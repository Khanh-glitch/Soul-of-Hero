# A7 acceptance scoreboard — round 5 (gatekeeper of integrated player value)

_Pinned 2026-10-30. Every row is reproducible from the bytes named here; nothing below was
observed in a running Godot session. Regenerate with
`python3 tools/survival/balance/run_analysis.py`, prove the artifacts still match the pinned
bytes with `--check`, run the suite with `python3 tools/survival/balance/run_tests.py`._

Round 5 changed the question. Rounds 3–4 asked "what does the source say?" and produced
findings. This round asks "**can a player do one useful thing, and if not, which single link is
missing and who closes it?**" Three of A7's own earlier claims were wrong; they are corrected in
§7, not deleted, and each correction now has a test that fails if the mistake returns.

## 1. The four questions, kept apart

Never promoted into one another, and never inferred from the others:

| Claim | Question | State at this pin | Level |
|---|---|---|---|
| **A** | does a route from the normal menu into the survival overworld exist **in source**? | `SOURCE_PRESENT` | `S3_PRODUCTION_SEAM` |
| **B** | does it **run in native Godot**? | `QUEUED` — 5 runs sit on `51f2cce8`, none finished | `NOT_CLAIMED` |
| **C** | are the A1 continent, the Waystation cache and the A8 POI **actually mounted and reachable**? | `ABSENT` | `S0_ABSENT` |
| **D** | is a **useful A3-authorised, persisted** reward claimable? | `PARTIAL` | `S2_SCENE_FIXTURE` |

`C` is read from **production paths only**. Round 5 pinned A0's own test harness, and that
harness names `node_waystation_cache`; counting it would have flipped `C` to `SOURCE_PRESENT`.
It does not count, and the two excluded files are reported as `non_production_references`
rather than hidden (`CORR-7`).

## 2. Proof levels

| Level | Meaning | Who can award it |
|---|---|---|
| `S0_ABSENT` | the link does not exist | A7 (source read / grep) |
| `S1_AUTHORED_ONLY` | authored data or a contract describes it; no code path | A7 |
| `S2_SCENE_FIXTURE` | a native scene demonstrates it with fake or injected state | A7 |
| `S3_PRODUCTION_SEAM` | the production owner API exists and is reachable in source | A7 |
| `S4_NATIVE_VERIFIED` | **all five** clauses on the pinned sha: exact sha · normal entry · independent second process · authorised commit · negative replay | **owner only** |
| `S5_FULL_RELEASE` | `S4` + OS restart + rendered frames + human quality review | **owner + human** |

`S4` is a conjunction, not a tick. At this pin **0 of 5 clauses hold**, so
`s4_granted = false` and `s5_granted = false`. The repository asserts this (`A27`), so A7 cannot
accidentally promote itself.

## 3. Exact code under test

| Owner | Head | What it is |
|---|---|---|
| A0 | `51f2cce8` | app root, save service, HUD, overworld, A3 catalog mirror (PR #21) |
| A1 | `2f6edd3f` | world data + the vertical-slice handoff contract |
| A3 | `100b3406` | items, sources, recipes, stations, loot tables + adopted A1 bindings |
| A6 | `8bc0af5a` | player-first HUD, avatar adapter + art manifest |
| A8 | `5ccf7b3f` | native POI sites + `quarry_integration_candidate.v1.json` |
| A8 task | `9332cb9b` | `feature/surv-a8-reuse-audit-010a` — the reuse audit, **unmerged** |

**52 files** are sha256-pinned in `data/survival/balance/snapshot/product_manifest.json`,
plus `tree_index.txt` so a `res://` claim can be checked against real paths.
`load_snapshot` raises on any byte drift, and `test_snapshot_hashes_are_verified_on_load`
proves the check runs.

## 4. CI evidence, read honestly

`data/survival/balance/evidence/ci_runs.v1.json` records **33** workflow runs:
**18 queued, 15 completed — all 15 completed runs failed.**

| Workflow | On the pinned sha | What it means |
|---|---|---|
| `a0-normal-entry-home-restart.yml` | 3 queued | `B` and `C3` are unproven, not failed |
| `a0-waystation-input-restart.yml` | 3 queued | real Hero input has never produced a receipt |
| `a0-save-precision.yml` | 2 queued | the fix exists; no native run has exercised it |
| `a8-world-content-native.yml` | `STALE_HEAD` (runs on `2d7f10d3`) | import passes, the contract step fails, no artifact |
| `survival-runtime-validation.yml` | 6 queued | headless parse only, never gameplay |

Two labels from the failed runs are quoted verbatim because they name the defect better than
any summary: `inventory`, `survival document`, `post-boot inventory` (run `41018366655`) and
`custody after reload`, `disk unchanged after interrupted write` (run `41022547962`).

A run counts only for the commit it ran on. Queued is `QUEUED`, never "probably fine".

## 5. The chain that matters

Two chains, `L1`→`L8`; a chain is only as good as its weakest link.
**13 of 16 links are blocked.**

| Link | `waystation_cache` | `a8_quarry` |
|---|---|---|
| `L1_ENTRY` — normal entry reaches the world | `S3` blocked (`B` unproven) | `S3` blocked (`B` unproven) |
| `L2_ROUTE` — placed on a reachable route | `S1` blocked — **no production mount** | `S2` blocked — fixture scene only |
| `L3_INTERACTION` — the player can interact | `S1` blocked | `S2` blocked |
| `L4_AUTHORIZATION` — A3 prices it | `S3` **open** (3/3 bindings adopted) | `S0` blocked — 2 actions unpriced |
| `L5_COMMIT` — committed through `transact_once` with a receipt | `S3` blocked — 8 mounted survival callers, 0 keyed on the A1 contract | `S2` blocked — in-memory fixture |
| `L6_RELOAD` — survives a second process | `S3` blocked | `S0` blocked |
| `L7_NO_DUPLICATE` — replay refused | `S3` blocked | `S2` blocked |
| `L8_OUTCOME` — the reward is useful | `S3` **open** | `S3` **open** |

**The first-hour chain, walked end to end.** Menu → overworld exists in source (`A`). Physical
route: A1 authors exactly 4 corridor bodies and publishes the cache as
`si:r_ashen_crown:waystation_cache:01` with interaction node `node_waystation_cache` — but no
production A0 file names either, so the route cannot be walked (`C`). Interaction: authored
only. Cost/reward: A3 fully authorises it (3 `iron_scrap`, 2 `knowledge_spares`, 1800 s). A0
committed receipt: no caller is keyed on the A1 transaction key. Save/reload: written, never
proven. No duplicate: `transact_once` rejects replays in source, never probed. Useful outcome:
the only consumer would be the research ladder, which cannot start (below).

## 6. Independent oracles (answers from outside the file being judged)

| Oracle | Verdict | What it proves |
|---|---|---|
| `engine_api` | `UNKNOWN_ENGINE_STATIC` — **15 calls** | Every flagged call is `Vector2.from_array(...)`, which no Godot release exposes (`Vector2` has exactly one static method, `from_angle`). A8's import step passes and its contract step fails, so the audit is the only thing separating "parsed" from "works". |
| `save_fidelity` | `ROUND_TRIP_EXACT` — 1 authoritative writer, 0 lossy | At `51f2cce8` the writer is `JSON.stringify(snapshot, "\t", true, true)`. Godot's default prints floats with `14 - floor(log10(|x|))` decimals, which is exactly why two whole-document comparisons failed. The fix is in the tree; it is unproven natively. |
| `knowledge_gate` | `SEEDED_ONLY_BY_LOOT` | Every spare recipe (`make_spares`, `study_axe_insignia`, `study_predator_jaw`) needs a research station, and the `research_kit` that builds one costs 3 spares. The only non-circular seed is `road_supplies` (2/claim, 1800 s) — looted from the cache that is mounted nowhere. The ladder is circular until `BLK-1` closes. |
| `authorization` | `NO_UNBACKED_AUTHORIZATION` — 1 claim, 0 rejected | The single `AUTHORIZED_BY_A3` marker matches A3's pinned bytes for the same source id. Authorization is not taken on the owner's word. |

The save-fidelity verdict is a *computed* condition, not a claim: `A24` requires
`ROUND_TRIP_EXACT` to be the negation of the recorded lossy writers.

## 7. The five player-facing blockers

Each has one owner, one smallest safe correction, and a test that flips `FAIL`→`PASS`.
A blocker closes only when **its own source condition holds and the native evidence it needs
is verified** (`OPEN_CONDITIONS`); an unrelated red check cannot open or close it.

| # | Blocker | Owner | Class | Closure |
|---|---|---|---|---|
| `BLK-1` | The A1 cache and A8 site are placed in no world a player can reach | A0 (mount) + A1 + A8 | missing production mount | claim `C` `SOURCE_PRESENT` from a production path |
| `BLK-2` | A8 calls `Vector2.from_array`, which no Godot release exposes | A8 | native runtime failure | oracle `unknown_call_count == 0` **and** the contract step green |
| `BLK-3` | The precision fix is in the tree, but no native run on the pinned sha has exercised it | A0 | source-of-truth defect, unproven | `ROUND_TRIP_EXACT` **and** `a0_save_precision` `VERIFIED` on the sha |
| `BLK-4` | The only A3-authorised reward proof is a fixture, and its own reload checks fail | A0 + A3 | fixture-only success | all five `S4` clauses hold on the pinned sha |
| `BLK-5` | The mounted body is still the Knight; the locked avatar art is not imported | A6 + A0 | player-facing visual defect | `Q-04` `REFERENCE_CONSISTENT` for the canonical body |

Full detail — **exact owner-side native commands**, the static reproduction, the minimal
correction, and what stays unproven after closure — is generated into
[`PLAYER_BLOCKERS.md`](PLAYER_BLOCKERS.md). A7 runs none of those commands; they are written so
the owner can, on the pinned sha, without reading CI YAML.

### Closed this round, and why it is honest

| Was | Disposition | Why |
|---|---|---|
| A0 shipped a stale mirror of A3's catalog | `CLOSED_BY_OWNER_SOURCE` | `Q-03` now reports `MATCH` over all 36 rows |
| A3 had not adopted A1's first-hour binding | `CLOSED_BY_OWNER_SOURCE` | 2/2 instance rebinds adopted; yields unchanged (3, 2), no rate moved |
| A1's instance id and A3's node id might not meet | `CLOSED_BY_OWNER_SOURCE` | A1 publishes both ids for one object; A3 binds the interaction node id |
| The only survival UI is developer-facing and duplicates the HUD | `CLOSED_NOT_PLAYER_FACING` | nothing mounts it; diagnostics default `false` |

### Reclassified, not closed

| Earlier claim | Round-5 truth |
|---|---|
| `CORR-6` "the first-research bootstrap cycle is closed" | True **only once the cache is mounted**. Today the seed is circular and lives behind `BLK-1`. |
| `CORR-7` "claim `C` reads every pinned A0 byte" | Would have produced a false positive: the newly pinned test harness names the node. Now production-only. |
| `CORR-8` "A6 points the manifest at an invented sheet" | Not what the bytes say. A6 declares `BASE_ART_NOT_IMPORTED` and its adapter returns `SOURCE_BLOCKED`. The defect is non-import, not spoofing. |

### Quality checks

| ID | Status | Scope |
|---|---|---|
| `Q-01` `Q-02` `Q-03` `Q-05` `Q-06` `Q-07` | `PASS` | empty-POI completeness, HUD ownership + developer text, A3 mirror, item/source mapping, orphaned outputs, buttons with no action host, fixture-only claims |
| `Q-04` | `FAIL` | avatar identity: the mounted scene is `knight.tscn`, no canonical sheet is imported |

Product checks: `PROD-01`/`PROD-02` fail (nothing openable, nothing lootable), `PROD-03` fails
(wrong body), `PROD-04` fails on hygiene only, `PROD-05`/`PROD-06` warn, `PROD-07` passes.

## 8. What A7 measured and did not change

- 4-Spares packet `E[T] = 3.525289745` — unchanged, recomputed from the pinned catalog.
- Route length 1541.72 tiles; 118 authored POIs of which **0** carry A3 loot natively.
- 13 of 16 chain links blocked; 15 completed CI runs, all failing; 0 native passes.
- 27 assertions hold, 231 tests pass, 24 of 24 adversarial cases pass.
- **No gameplay file, loot table, rate, price or quantity was edited.** A7 owns only
  `tools/survival/balance/**`, `tests/survival/balance/**` and its own docs/artifacts.

Explicit non-claims: this is not a playtest, not native acceptance, not human quality review,
and A7 proposes no Core drop rate.

## 9. Next smallest owner actions, in order

1. **A8** — replace the 15 `Vector2.from_array(...)` sites with `Vector2(x, y)`; push; let
   `a8-world-content-native.yml` run on the sha. Smallest possible change, unblocks `BLK-2`.
2. **A0** — place the existing A1 node in the production overworld, and add the one caller
   keyed on `a1slice:poi_crown_waystation:cache_restock:1`. Unblocks `BLK-1` + `BLK-4`.
3. **A0** — dispatch `a0-save-precision` and the two restart workflows on `51f2cce8`; the fixes
   are already in the tree, only the runs are missing. Unblocks `BLK-3`.
4. **A6** — import one canonical grade-0 sheet and point the manifest at the installed file.
   Unblocks `BLK-5`.
5. **Nobody** — do not add loot, raise rates or invent Spares. The chain is blocked on a mount,
   not on generosity.

## 10. Reproduce

```bash
python3 tools/survival/balance/run_analysis.py            # rebuild every artifact
python3 tools/survival/balance/run_analysis.py --check    # prove artifacts match the pins
python3 tools/survival/balance/run_tests.py               # 231 tests
python3 tools/survival/balance/run_analysis.py --check-upstream   # only if A1/A3 refs are fetched
```

Artifacts: `data/survival/balance/results/{gate,quality,oracle,blockers,product,summary}.json`,
evidence `data/survival/balance/evidence/ci_runs.v1.json`, pins
`data/survival/balance/snapshot/{snapshot_manifest,product_manifest}.json`.
