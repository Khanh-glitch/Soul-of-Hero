# R13-A3-CLOSE — handoff, evidence and remaining seams

**Branch:** `arena/daadd745-soul-of-hero`
**PR:** #19 (OPEN — never self-merged, base `feature/survival-rpg-foundation-20261029`)
**Audited predecessor:** `b751a29f213d3c934caa204eb8d2d86943f07b65` (PR #19, A3 lead-reassign review)
**Audit of record:** [`R13_A3_CLOSE_AUDIT.md`](R13_A3_CLOSE_AUDIT.md)
**Adoption contract:** [`A0_ADOPTION_CONTRACT_V2.json`](A0_ADOPTION_CONTRACT_V2.json) (generated, 29 files)
**Manifest:** [`a0_adoption_manifest.md`](a0_adoption_manifest.md) (v2)
**Source contract:** [`R13_A3_VALUE_SOURCE_CONTRACTS.md`](R13_A3_VALUE_SOURCE_CONTRACTS.md)

This file is the takeover deliverable. It states only what an exact SHA executed.

---

## 1. Commit chain on this branch

| SHA | Subject |
|---|---|
| `b751a29f2` | predecessor head that this takeover audited (unchanged, not rewritten) |
| `90efc7ae6` | replace duplicate queue/clock/knowledge with canonical authority; fail-closed source receipt |
| `10980b0ea` | fix nested `var` re-declaration; publish native failures as annotations |
| `49ddcae71` | adoption contract v2, physical-owner tightening, call-resolution gate |
| `2a2c81a5f` | normalise JSON numbers at the source-receipt boundary |
| `3936cdc0f` | fix receipt location, publish evidence notices, gate the expected I/O line |
| `a0206d98a` | fix the expected-I/O log filter (escaped dot), name failed assertions |
| `f767d10d3` | worklog entry (docs only; does not trigger the A3 workflow) |
| `ad967ccbb` | handoff document (first draft) |
| `45b67c503` | annotate the adapter log when the engine exits nonzero |
| `4a812ceea` | reject exit codes as evidence; repair the adapter step |
| `61f9dfff7` | rebuild the native-adapter job; gate continuation damage |
| `e042d904b` | two-process suites gate named copies of their logs |
| `a8f5c08ac` | gate before annotating; trace the routes group |
| `ac148f877` | **final: authenticate the third source before asserting the tool gate** |

## 2. Native evidence

### 2.1 First full two-process pass — run [41233482362](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41233482362), SHA `3936cdc0f`

Job `R13 A3 VALUE ECONOMY NATIVE (GODOT 4.7)`:

* static hazard gate — PASS
* import with the real Godot 4.7 parser — PASS
* **R13 process 1 — PASS**
* **R13 process 2 — PASS**
* **two-process receipt verification — PASS**

Receipt values published by `tools/ci/r13_receipt_notices.py` as check-run notices
(the raw log is not retrievable in this environment):

```
p1=2405 p2=2433 distinct=True save=user://tests/r13_value_economy_p1.json
job=job_000003 granted=4 duplicate=nothing_to_collect
bindings=7b9670f4971d2f16 a8=REJECTED_PENDING_EVIDENCE_FAIL_CLOSED
  auth_tx=soh.a3.source_auth.a1_waystation_roadside_cache_v3.9fbbdcd28ac756ffbb6335620b1fda55
  harvest_tx=soh.a3.source_claim.a1_waystation_roadside_cache_v3.1
source=a1_waystation_roadside_cache_v3
  rewards=[iron_scrap x3 (road_scrap), knowledge_spares x2 (road_supplies)] tool_after=80
preparation oak 20->15 iron 23->20 output_at_prepare=0
conservation {"ok": true, "output": 4, "problems": [], "source_claim_receipts": 1}
verdict ok=True findings=[] p2_checks={'checks_failed': 0, 'checks_passed': 13}
```

What that proves, mechanically:

1. two **distinct OS processes** (2405, 2433) wrote the receipts;
2. both used the same durable save and the same A1 binding document SHA;
3. process 1 authenticated a physical source through the live host receipt, harvested
   A1's pinned rewards and wore the tool 100 → 80 **inside one transaction**;
4. research knowledge was learned through the canonical queue, and paid production
   escrowed `oak_wood 5 + iron_scrap 3` with **zero output at prepare time**;
5. a *new OS process* reloaded the save, refused the claim before maturity
   (`nothing_to_collect`), matured the job on the A0 active-tick receipt, collected
   exactly once (4 `quarry_core_fragment`), refused the duplicate claim and changed
   nothing;
6. conservation held: output batch, prepaid inputs, exactly one
   `soh.a3.source_claim.*` receipt, and no ghost `a3_station_jobs` key;
7. the Quarry seam stayed closed (`REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`) in the
   same run.

Also on the same SHA: `A3 CATALOG / BALANCE CONTRACTS` PASS and
`A3 NATIVE SAVE ADAPTER` PASS (V5 adapter, world restart, V6 offline + two-process
offline settlement, V5 tool use, V7 meta + two-process meta).

### 2.2 Single-process negative controls

Run 41233482362 reached the step and executed the suite; the step failed **only**
because the log gate counted the *intentional* obstructed-write line
(`ERROR: SaveService: Could not write the temporary save file.`) as an engine error.
The filter written for that line was double-escaped and never matched. `a0206d98a`
fixes the filter, asserts the negative control actually fired, and echoes every
`[FAIL]` assertion as its own annotation. The re-run outcome is recorded in §4.

### 2.3 The unrelated failure

`Godot 4.7 Runtime Validation` fails on its **"Original main baseline comparison"**
step on every SHA including the predecessor and main-derived commits, while its
native import/render jobs pass. Per the work order this is **not** attributed to A3
and is not used as A3 evidence.

### 2.4 FINAL exact-SHA run — [41236254354](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41236254354), SHA `ac148f877fffbc30ec66cbd5ac90cbb888717c31`

| Job | Conclusion |
|---|---|
| `A3 CATALOG / BALANCE CONTRACTS` | success |
| `A3 NATIVE SAVE ADAPTER` (V5 adapter 566 checks/27 cases, world restart, V6 offline + two-process, V5 tool use, V7 meta + two-process) | success |
| `R13 A3 VALUE ECONOMY NATIVE (GODOT 4.7)` | **success** |

Notices published from that job (read back through the check-run annotation API):

```
R13 NATIVE PASSED - 135 checks
p1=2399 p2=2428 distinct=True save=user://tests/r13_value_economy_p1.json
job=job_000003 granted=4 duplicate=nothing_to_collect
bindings=7b9670f4971d2f16 a8=REJECTED_PENDING_EVIDENCE_FAIL_CLOSED
  auth_tx=soh.a3.source_auth.a1_waystation_roadside_cache_v3.9fbbdcd28ac756ffbb6335620b1fda55
  harvest_tx=soh.a3.source_claim.a1_waystation_roadside_cache_v3.1
source=a1_waystation_roadside_cache_v3
  rewards=[iron_scrap x3 (road_scrap), knowledge_spares x2 (road_supplies)] tool_after=80
preparation oak 20->15 iron 23->20 output_at_prepare=0
conservation {"ok": true, "output": 4, "problems": [], "source_claim_receipts": 1}
verdict ok=True findings=[] p2_checks={'checks_failed': 0, 'checks_passed': 13}
```

Every step of the R13 job succeeded on that SHA: static hazard gate, real-engine
import, process 1, process 2, two-process receipt verification, and the
single-process negative-control suite (135 executed assertions).

## 3. What changed in behaviour (not just in wording)

| Area | Before (audited) | Now |
|---|---|---|
| Queue | second A3 queue + own job counter + `queued_at_unix` | canonical `enqueue/advance/collect/cancel`; no A3 job state at all |
| Clock | `set_time_source(Callable)`, wall clock | A0 `soh.economy.active_tick.v1` receipt; absent host fails closed |
| Knowledge | `mastery.a3_learned_recipes` | canonical `survival.knowledge.recipes` via `research_recipe` |
| Source identity | fabricated ids, owner string `"A1"` | five pinned A1 bindings, `soh.economy.source_receipt.v1`, live-host equality, owner = A1 source class id |
| Quarry | flag flipped in a test | reads the REJECTED A8 document + its SHA; no Quarry reward/cost/POI exists |
| Core vs material | `quarry_core_fragment` described as "Skill Core" in places | fragment is an ordinary stack material; a Skill Core is an instance-backed `skill_core` with finite uses |
| Routes | one dictionary recipe | two routes with catalog-derived inputs, durations, research gates, fuel and finite A1 supply |

## 4. Status table (exact-head evidence only)

| Gate | Status |
|---|---|
| Static hazard gate (Variant inference, duplicate `var`, unresolved call, second authority, cross-step shell state) | ✅ executes on every push, verified to fail on an injected historical defect |
| Real Godot 4.7 import | ✅ |
| Two distinct OS processes, one paid durable settlement, duplicate refused | ✅ run 41233482362 and again on 41236254354 |
| Single-process negatives (forgery ×7, cooldown, one-time exhaustion, tool wear, full bag, obstructed write + rollback + retry, cancel escrow, stale run, reset) | ✅ 135 checks, run 41236254354 |
| V5–V7 canonical regression (adapter, world restart, V6 offline ×2, tool use, V7 meta ×2) | ✅ same workflow, run 41236254354 |
| A0 composition of the 29 files | ❌ pending A0 (contract delivered) |
| A6 UI integration, A8 Quarry, human/Web playtest, final balance | ❌ not claimed |

## 5. Unresolved owner seams

1. **A0** must compose the 29 files by the hashes in `A0_ADOPTION_CONTRACT_V2.json`,
   replace the 1789-line vendored fork, and mount the active-tick host before any
   product claim. R17's `A3_SERVICE_REFUSED_BY_SCOPE` stays open from the A0 side.
2. **A1** must mount a real source host returning `soh.economy.source_receipt.v1`
   from the live world slice (discovery, stand cell, active seconds). Until then the
   only source host is the test composition root and the gameplay layer has none —
   which is the correct fail-closed default.
3. **A8** must supply a durable Quarry instance, native collision/reload proof and a
   new APPROVED authorization document with a new SHA.
4. **A7** owns the composed-tree verdict, balance and acceptance. `PRODUCT_COMPOSED_PASS`
   must not be written from this branch.

## 5b. Durable records updated and read back

| Record | State |
|---|---|
| PR #19 comment | posted: `#issuecomment-6548445380` (SHA, run link, notices, seams, no self-merge) and read back via the API |
| `docs/survival/WORKLOG.md` | appended twice (takeover entry, green-SHA entry) |
| `docs/survival/economy/A0_ADOPTION_CONTRACT_V2.json` | regenerated from the tested tree (29 files, 0 missing) |
| Google Docs tab `04 · Nhật ký LIVE & bàn giao` (`t.h4haqfdoyzzn`) | appended the R13-A3-CLOSE entry and verified the readback (`find_text` match at index 508610) — **not** `DOCS_SYNC_PENDING` |
| Tabs 1, 2, 03, 05 | read (tab list + tab 04 text); no requirement/decision change was needed, so tab 03 was not rewritten |

## 6. Next actionable integration gate

1. A0 composes the tree from `A0_ADOPTION_CONTRACT_V2.json` and mounts
   `soh.economy.active_tick.v1`.
2. A1 mounts the source host callable.
3. Re-run `tools/ci/gd_r13_static_check.py`, the two-process R13 suite and
   `tools/ci/verify_r13_receipts.py` **inside the composed tree**, not this branch.
4. Only then can A7 evaluate balance, A6 render the projections and A8 open the Quarry.
