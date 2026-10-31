# A7 method — how every number in this checkpoint is produced

Everything is recomputed from pinned JSON. Nothing is copied from a report, including the Control Tower
numbers — those are re-derived here and compared (they match; see §7).

## 1. Provenance

`data/survival/balance/snapshot_manifest.json` pins, for each upstream file: owner, upstream path, upstream
branch/commit, size and SHA-256.

- `verify_snapshots` re-hashes the local copy. Mismatch = `SNAPSHOT_HASH_MISMATCH` (BLOCKER).
- `verify_upstream` compares the pinned commit's blob **in binary mode** (text mode would translate newlines
  and silently change the hash). If the commit is not fetched locally the check reports
  `SKIPPED_REF_NOT_FETCHED`; skipped is never treated as a pass. Because "are those commits fetched here?" is an
  environment fact rather than a repository fact, its result is **not** written into the committed artifact:
  `provenance.json` records `upstream_drift_check.status = ENVIRONMENT_DEPENDENT_NOT_IN_ARTIFACT`, and
  `python3 tools/survival/balance/run_analysis.py --check-upstream` performs the comparison live (exit 1 on
  drift). A shallow clone therefore reproduces every artifact byte-for-byte.
- `verify_owner_pins` compares A3's own pinned A1 hashes (`a1_source_adoption.v2.json → a1_source.file_sha256`)
  with the pinned A1 snapshots, so an owner disagreement is visible.

Pinned inputs (commit → file):

| Owner | Commit | Files used |
|---|---|---|
| A1 (PR #20) | `2951bf8559b2e289ce99fd4d394d44c46fdd91b1` | `world_plan.v1.json`, `poi_route_graph.json`, `material_source_contracts.json`, `pacing_analysis.json`, `novice_bootstrap_contract.json`, `a1_a3_material_decisions.json`, waystation/relay authoring specs |
| A3 (PR #19) | `18e7afcbd576bbd9bfbcc509b2ee13216186a522` | `loot_tables.json`, `items.json`, `sources.json`, `recipes.json`, `research.json`, `stations.json`, `progression_model.json`, `a1_source_adoption.v2.json` |

A3's adoption contract pins A1 at `91a35449…`; the six overlapping file hashes it records are identical to the
bytes at A1 head `2951bf85…`, so no drift is hidden by the two different commit ids
(`PIN_DRIFT_VS_ADOPTION_CONTRACT` = 0).

## 2. Geometry and travel time

- Edge length = sum of Euclidean segments of A1's authored polyline, in **tiles**.
- Speed = A3 assumption `walk_px_per_second = 96`, `tile_px = 16` → **6 tiles/s**; `seconds = tiles × 16 / 96`.
- Routing = Dijkstra over the authored route graph, capability-gated: an edge is usable only if
  `edge.required_capabilities ⊆ capabilities_held`.
- Capabilities are re-evaluated **after each stop**, because A1 grants them by visiting a POI (this is what
  makes Waystation → Relay possible: the Relay spur itself requires `cap_salvage`).
- "Safe belief" patterns forbid edges whose risk label is `high`/`combat`; the underprepared pattern instead
  *declares an intent* (`intended_route_ids`) and the tool reports the lock plus the permitted fallback.

Travel time is movement only. Gathering, searching, interaction, combat, reading, UI and death/recovery are
separate lines; the last four are never modelled as zero, they are listed as `unmodelled_time`.

## 3. Loot mathematics (exact, no sampling)

For a table with `rolls` independent draws:

- an entry is legal unless its item carries one of the table's `excluded_tags`;
- draw weight = `weight / Σ weight` over legal entries;
- quantity ~ Uniform{lo..hi} (integers, inclusive);
- one claim = the Cartesian product of `rolls` draws, enumerated exactly with rational probabilities
  (`fractions.Fraction`), so `Σ P = 1` exactly. `roadside_cache` has 3 rolls × 7 quantity outcomes = 343 states.

Derived quantities:

- `mean(item)`, `variance`, `p_at_least_one`, `max` per claim;
- `covariance(a, b)` — items are mutually exclusive within a draw, so this is negative and is reported as a
  structural property, not an error;
- `expected_claims_to_reach(item, k)`: `T` counts whole claims, so `T ≥ 1` and
  `E[T] = Σ_{t≥0} P(T > t) = 1 + Σ_{t≥1} P(T > t)`. The `t = 0` term is `P(T > 0) = 1`; omitting it
  under-reports every non-empty hitting time by exactly one claim (the defect the 2026-10-30 CT review found,
  fixed here). The reported value is solved exactly backwards from `E[target] = 0`:
  `E[k] = (1 + Σ_{q≥1} p_q E[k+q]) / (1 - p_0)` over `Fraction`s — no truncation. Above 128 units the module
  falls back to the survival sum and reports the bound `E ≤ value + P(T>t)·(target-1)/p_success` instead of
  pretending the tail is zero. Two independent checks run in the suite: the analytic oracles (guaranteed → cost
  equals the target; fair coin → `2·target`) and `Σ_t (1 - P(T ≤ t))` computed through `p_reach_by`;
- `p_reach_by(item, k, n)`;
- `p_none_of(items)` — the exact "nothing useful this claim" probability.

Two readings of `rolls` exist because A3's JSON does not state replacement. Reading A (with replacement) is
used everywhere; reading B (without-replacement draft) is computed for the same table and reported beside it so
the ambiguity is visible instead of hidden (`sensitivity.json → reading_sensitivity`).

## 4. Claims (anti-duplication policy)

`ClaimEngine` enforces what the data already declares:

| Rule | Source | Effect |
|---|---|---|
| one-time reward claimed at most once, ever | A1 reward `policy: ONE_TIME`, A3 `one_time: true` | second claim blocked, flag persists across "sessions" (= reload) |
| per-session cap | A3 `max_claims_per_session` | excess claims blocked |
| zero restock is not renewal | A3/A1 `replenishment_seconds == 0` on a non-one-time source | in-session farming blocked |
| capability requirement | A3 `requires_capabilities` / `requires_items` | claim blocked with `capability_required` |

Capacity: one slot per distinct item type; `stack_limit` adds slots above that; `storage: instance` items
(e.g. `core_ember`) occupy one slot and are flagged `UNIQUE_INSTANCE_DUPLICATION_BLOCKED` if modelled above 1.

## 5. Time budget

A session is **2700 s of active time** (A3's 45-minute assumption). A pattern's accounted seconds are
`travel + gather (6 s/claim) + interaction (45 s/stop)`, all three taken from A3's own assumption block. The
result is compared with the budget to give `trips_per_session_floor`. This is *not* a claim that a human will
finish a trip in that time; combat, thinking and menus are missing by design.

## 6. Material sinks and usefulness

`recipes.json` + `research.json` define the sinks. For each item the tool records which recipes and
technologies consume it and the total units per production cycle (`sink_depth`). A looted unit counts as
*useful* if it feeds a recipe/technology **or** the item is a terminal-use kind (`skill_core`, `equipment`,
`consumable`, `key_item`, `station_kit`). Everything else is reported as `sinkless_units` rather than being
quietly valued.

`sink_coverage(trip)` compares one trip's loot with named early sinks (`research_kit`, `furnace_kit`,
`workbench_kit`, `stone_pick`, `weave_cloth`, all five technologies) and reports the exact shortfall. The basis
is deliberately narrow: **trip loot only**, no native harvesting and no prior stock, because native harvesting is
verified elsewhere (A0) and mixing the two would hide which system provides the material.

## 7. Probability sensitivity (hypotheses only)

- `p_at_least_one(N, p) = 1 − (1−p)^N`.
- `crates_needed_for_confidence(p, c)` = smallest N with `1 − (1−p)^N ≥ c`.
- The grid is built from `hypotheses.v1.json → core_probability`: `p ∈ {0, 0.2%, 0.5%, 1%, 2%}`,
  crates/trip `∈ {0,1,2,4,8,16}`, trips `∈ {1,10,20}`. Every row carries
  `label = HYPOTHETICAL_NOT_A3_TUNING`.
- The *actual* number of eligible roadside containers today is **derived**: count of authored tables that can
  emit an item tagged `core` **and** whose A3 source POI resolves to an A1 container = 0. So the grid answers
  "what if one existed", and the honest current answer is "not applicable yet".
- Seeded resampling (`random.Random(20261030)`) draws from the authored weights only, to show spread
  (p10/p50/p90) instead of a bare mean. Same seed ⇒ identical output; the test suite asserts it.

## 8. Assertions

`summary.json → assertions` are computed, not typed. They include:

| id | claim |
|---|---|
| A01 | `roadside_cache` per-claim expectation = 3.6 scrap / 1.35 spares / 0.45 notes / 0.45 seeds |
| A02 | no authored table can emit a `core`-tagged item; the junk table excludes the tag |
| A03 | 118 authored POIs, 0 natively loot bearing |
| A04 | all 16 A3 loot sources fail A1 POI resolution |
| A05 | 178 resource nodes counted as nodes, eligible containers = 0 |
| A06 | the tool's own first-hour route length reproduces A1's 1541.72 tiles within 1 tile |
| A07 | no authored capability gate requires the capability it is the only source of |
| A08 | the `knowledge_spares` ↔ research-station bootstrap cycle is present and reported |
| A09 | the duplicated locker claim is blocked, not double-counted |
| A10 | ≥20 adversarial cases, all passing |
| A11 | A3's pinned A1 hashes agree with the pinned A1 snapshot |
| A12 | the east-seam shortcut is reported as capability-locked, never as a passable unmitigated crossing |

## 9. Determinism

`report.build()` is a pure function of the snapshots and the hypothesis file. Artifacts are written with
`sort_keys=True`, fixed rounding, no timestamps and no absolute paths; `digest.json` records each artifact's
SHA-256 and a combined digest. `run_analysis.py --check` and
`tests/survival/balance/test_artifacts.py::test_committed_artifacts_are_current` fail if the committed results
no longer match. A rebuild on another machine with the same snapshots must produce identical bytes.
