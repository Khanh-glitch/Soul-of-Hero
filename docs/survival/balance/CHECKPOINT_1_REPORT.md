# A7 checkpoint 1 — execution report (2026-10-30)

> **Superseded by [`CHECKPOINT_2_REPORT.md`](CHECKPOINT_2_REPORT.md).** Kept for history. Two numbers here were
> corrected after the CT review and must not be quoted: the research gate is **3.525** claims (not 2.525), and
> the suite is **164 tests** (not 127). The 16 "unresolved sources" are 16 records over 10 class targets.

Work order: `docs/survival/tasks/CT_A7_20261030_ACTIVATION_DELTA.md` (+ `SURV-060A_A7_WORK_ORDER.md`).
Checkpoint state: **ANALYSIS_COMPLETE / NATIVE_NOT_TESTED / HUMAN_NOT_TESTED / NO_GAMEPLAY_EDIT**.

## What was built

An executable, deterministic inspector for early-game exploration and loot discovery. It reads A1's authored
world and A3's authored economy as **pinned, byte-verified snapshots**, recomputes their implications, and
refuses to state any number the source data does not contain. No gameplay file, table, rate or other agent's
code was modified.

| Path | Contents |
|---|---|
| `tools/survival/balance/run_analysis.py` | CLI: rebuild artifacts, `--check` (stale-artifact gate), `--print-summary`, `--check-upstream`, `--results-dir` |
| `tools/survival/balance/run_tests.py` | stdlib test runner (`python3 tools/survival/balance/run_tests.py [module ...]`) |
| `tools/survival/balance/sohbalance/` | 13 modules: `provenance, geo, loot, access, routes, sensitivity, model, hypotheses, checks, adversarial, findings, report` |
| `tests/survival/balance/` | `_support.py` + 8 `test_*.py`, **127 cases** |
| `data/survival/balance/snapshot*` | 16 verbatim upstream extracts + SHA-256 manifest |
| `data/survival/balance/hypotheses.v1.json` | the only place a non-authored number is allowed to appear |
| `data/survival/balance/results/` | `provenance, findings, access, opportunity, sensitivity, adversarial, summary, digest` |
| `docs/survival/balance/` | `README.md`, `METHOD.md`, `INDEPENDENT_REVIEW_20261030.md`, `LIMITATIONS.md`, this report |

## Exact commands and results

Environment: `python3 3.11.2`, standard library only (`pytest` and `jsonschema` are **not** installed, so nothing
depends on them).

```bash
python3 tools/survival/balance/run_analysis.py            # writes/refreshes data/survival/balance/results/*.json
python3 tools/survival/balance/run_analysis.py --check    # -> "artifacts up to date" (exit 0)
python3 tools/survival/balance/run_analysis.py --print-summary
python3 tools/survival/balance/run_analysis.py --check-upstream   # -> 16/16 MATCH (needs the refs fetched)
python3 tools/survival/balance/run_tests.py               # -> Ran 127 tests ... OK
python3 -m unittest discover -s tests/survival/balance -p "test_*.py"   # same suite, no wrapper
```

Reproducibility was verified from a **fresh shallow clone of this branch** (`git clone --depth 1`): `--check`
reported `artifacts up to date` and all 127 tests passed, with no repository state carried over. Artifact bytes
are stable across output directories (identical `digest.json`), have no timestamps, and are sorted.

`digest.json`: `combined_sha256 = f4acb101965f50035fa84a6561f57dcd3ce6cbe66393ca269f041f0ecdd227c3`
(`access 770b7898…`, `adversarial a3f2985f…`, `findings 2e71ac9b…`, `opportunity 3b20600a…`,
`provenance af65b6d5…`, `sensitivity 0f2ce876…`, `summary 598dcd1d…`).

## Machine-readable headline results

- **Findings: 57** — BLOCKER 0 / MAJOR 20 / MINOR 28 / INFO 9, across 12 codes. Regenerate with
  `run_analysis.py`; each finding carries code, severity, subject, evidence path and owner request.
- **Coverage ladder:** `NATIVE_PROVEN` 13 items / 9 recipes / 0 technologies; `+LEGACY` 20 / 9 / 0;
  `AUTHORED_PLAN` 56 / 36 / 5.
- **Exploration has no loot-bearing destination:** 118 authored POIs, **0** natively loot-bearing; 16 of 16 A3
  loot sources fail A1 POI resolution; eligible roadside containers today = **0**. The 178 A1 resource nodes stay
  on the harvest axis and are never counted as crates (assertion A05).
- **Reachability:** EMPTY_HANDED 15, AFTER_WAYSTATION 24, AFTER_RELAY 25, AFTER_APOTHECARY 39, ALL_CAPS 108 —
  playable 1/2/2/2/2, loot-bearing 0 at every stage. `cap_filter` alone opens 14 POIs (25 → 39).
- **Loot math reproduced exactly:** `roadside_cache` per claim → iron_scrap µ 3.6 (`P≥1` 0.784, max 12),
  spares 1.35 (0.657), notes 0.45 (0.385875), grain_seed 0.45 (0.385875); covariance −1.62; the 343 outcome
  bundles sum to 1. P(no tracked item) 0.166375 per claim, 0.004605 per 3-claim trip. Reading B (without
  replacement) reported beside it: scrap 0.913369, spares 0.856022, notes 0.615304.
- **Five patterns** on the 2700 s hypothesis: P1 416.0 s (travel 257.0 s / 1541.72 t, gather 24 s, interact
  135 s) → 6 trips/session; P2 392.2 s → covers `weave_cloth`; P3 underprepared 199.7 s → 4 units; P4
  hypothetical container search 428.2 s → covers `tech_smelting`; P5 `core_ember` 174.2 s at medium/0.03 risk,
  retention 0.97 / 0.985 / 1.00 at 0 / 50 / 100 % recovery.
- **Sensitivity (`HYPOTHETICAL_NOT_A3_TUNING`):** containers needed for a 50 / 90 % first Core at p = 0.2 % →
  347 / 1151; 0.5 % → 139 / 460; 1 % → 69 / 230; 2 % → 35 / 114; p = 0 → `null`. Seeded 4000-run spread over 14
  sessions × 3 claims: scrap p10 125 / p90 173, spares 47 / 68, notes 14 / 25, zero-runs 0. Research gate: 3.525 (corrected in checkpoint 2; this file said 2.525)
  claims, P(covered within 10 sessions) 0.997437.
- **Adversarial: 24/24 pass** (12 injected data faults each detected; 12 behaviour cases: zero eligible crates,
  absent sources, inaccessible routes, unlucky player, capacity limits, repeated claims, roll exhaustion,
  save/reload duplication, insufficient inventory, losing the Core with original-bag recovery, no-Core trip
  utility, incorrect item ownership).
- **12 computed assertions all hold**, including reproduction of A1's published 1541.72-tile first hour and the
  CT review's 3.6 / 1.35 / 0.45 / 0.45 per-claim expectations.

## Explicit non-claims

`NOT_TESTED`: no native Godot run, no scene/`SaveService`/inventory/death/station/POI execution, no reload test,
no collision or boat-speed validation, no performance measurement. No human playtest — comprehension, fun,
Core excitement and pacing are unmeasured. A3's 14-session model is not a human sequence; its
`roadside_claims = 0` is a **sample limitation**, not evidence that nobody claimed. Planned POIs ≠ playable,
Gold-blocked Cores ≠ verified usable skills. Core drop rates are **absent** and none were invented; the
probability grid is labelled hypothetical. Risk bands `early/mid/late` carry no death model (`UNMODELLED`), and
A3's death assumptions cover only 6 of 130 edges. L1-S special road supply is `RESEARCH_DIRECTION` only.

## Branch / commit

- Repository: `Khanh-glitch/Soul-of-Hero`.
- Session branch pushed: **`arena/353cf120-soul-of-hero`** (Arena fixes this branch name for the session; the
  work-order branch `feature/surv-a7-balance-060a` cannot be pushed to from this session and was **not**
  modified). The work-order base `feature/surv-a7-balance-060a` @ `15e0222a` is **merged into** this branch, so
  the diff against the intended base is exactly the 56 added files.
- Deliverable commit: `815049b80de5048a1fe5143d2e1796693091cde1` (tool + tests + data + docs);
  reproducibility fix `c34d57bcb7b2da8b01b8b78ea1a29ad6534151d0`; work-order base merge `00ac6906`.
- Pull request opened against `feature/surv-a7-balance-060a` for independent review; **not self-merged**, no
  force-push, `main` untouched.

## Docs / issue sync (verified 2026-10-30)

- **Google Docs tab 04 (`04 · Nhật ký LIVE & bàn giao`, tab `t.h4haqfdoyzzn` of document
  `1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo`): WRITTEN AND READ BACK.** An A7 checkpoint-1 entry was appended
  (commit SHAs, commands, 127/127 tests, 57 findings, non-claims, next actions) and the readback found the entry
  at index `156980` with `total_match_count = 1`. No existing entry was edited or deleted.
- **GitHub Issue #16: `DOCS_SYNC_PENDING`.** `gh issue comment 16` failed with
  `Resource not accessible by integration` — this session's GitHub integration can open pull requests but has no
  issue-write permission. The exact text to mirror is preserved verbatim in
  `docs/survival/balance/DOCS_SYNC_PENDING.md`; Git (PR #25 + this report) is authoritative until someone with
  issue-write access posts it. This is a **permission blocker, not a content blocker**.
- `docs/survival/{STATE.json,WORKLOG.md}` are outside A7's owned paths and were deliberately **not** edited; the
  A7 status is recorded here and in `docs/survival/balance/README.md` for the owner to mirror.

## Next recommendations (in priority order)

1. **A1:** bind the 16 A3 loot sources (`loot_sources`) to real POI ids — this single change converts §9 of the
   review from hypothetical to measurable and closes 16 `SOURCE_POI_UNRESOLVED` + 16 `SOURCE_REGION_UNRESOLVED`.
2. **A3:** provide a non-loot path to `knowledge_spares`, or authorise the locker's `ONE_TIME` quantity; today
   the research station has a bootstrap cycle (`BOOTSTRAP_DEPENDENCY_CYCLE`).
3. **A1/A3:** split `risk` into severity + band. 124 of 130 edges currently carry no death assumption, so cargo
   loss cannot be computed anywhere except the 6 modelled edges.
4. **A3:** fix `venom: 60` mitigation being attached to an `acid_gas` POI (resistance chain blocked).
5. **A1:** decide item ownership for `waystation_locker` / `a1_crown_salvage` quantities (2 `ITEM_OVEROWNED`).
6. **A0:** land one native, non-loot Core source and one reload-duplication test; until then every Core claim in
   this tool stays catalog-only.
7. **A7 (next checkpoint):** re-pin the snapshots after (1)–(4), then re-run; the tool already accepts an L1-S
   supply table, so a real container class can be measured without code changes.
