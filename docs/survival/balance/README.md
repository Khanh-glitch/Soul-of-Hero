# A7 — Independent systems QA & balance (survival / early-game exploration & loot discovery)

**Owner:** A7. **Owned paths only:** `docs/survival/balance/**`, `tools/survival/balance/**`,
`tests/survival/balance/**`, `data/survival/balance/**`.
**Status of this checkpoint:** executable analysis + deterministic tests + machine-readable results +
independent review. `ANALYSIS_COMPLETE / NATIVE_NOT_TESTED / HUMAN_NOT_TESTED / NO_GAMEPLAY_EDIT`.

This is a *measurement and challenge* tool. It reads A1's authored world and A3's authored economy as
pinned snapshots, recomputes what they imply, and refuses to state numbers the data does not contain.
It changes no loot table, no rate, no world file and no other agent's code.

## What it answers

1. **Which authored POIs can actually be played or looted today?** (Spoiler: 0 of 118 hand out A3 loot.)
2. **Do A3's loot sources exist at A1's places?** (Spoiler: 0 of 16 loot sources resolve to an A1 POI id.)
3. **What is one expedition worth, split into travel / gathering / interaction time and non-Core loot?**
4. **How do the authored material sinks (recipes, technologies) line up with what a trip actually yields?**
5. **What would have to be true for a "first Core" to be a luck event, and is it one today?**
6. **What breaks under absent sources, unlucky rolls, locked routes, bag limits, repeated claims and
   wrong item ownership?** — with fault-injection cases that prove the checks fire.

## Commands

```bash
# 1. Rebuild every artifact (writes data/survival/balance/results/*.json)
python3 tools/survival/balance/run_analysis.py

# 2. Fail if the committed artifacts are stale (CI-friendly)
python3 tools/survival/balance/run_analysis.py --check

# 3. Run the full deterministic test suite (stdlib unittest, no third-party deps)
python3 tools/survival/balance/run_tests.py

# Equivalent, without the wrapper:
python3 -m unittest discover -s tests/survival/balance -p "test_*.py"

# 4. Print the headline numbers
python3 tools/survival/balance/run_analysis.py --print-summary

# 5. Live upstream drift check (needs the A1/A3 commits fetched; exits 1 on drift)
python3 tools/survival/balance/run_analysis.py --check-upstream
```

Python 3.11+, standard library only. `pytest` also collects the test files if it is installed; it is not
required and the tool does not import it.

## Layout

```
data/survival/balance/
  snapshot_manifest.json         # SHA-256 pin for every upstream file this analysis read
  snapshot/*.json                # verbatim read-only copies of A1/A3 authored data
  hypotheses.v1.json             # the ONLY place a non-authored number may appear
  results/                       # generated: provenance, findings, access, opportunity, sensitivity,
                                 # adversarial, summary, digest
tools/survival/balance/
  run_analysis.py                # CLI
  run_tests.py                   # test runner
  sohbalance/
    provenance.py   snapshot hashes, upstream drift, cross-owner pin comparison
    model.py        typed read-only view over the snapshots
    findings.py     finding codes / severities / assertions
    geo.py          authored polylines, capability-gated routing, travel time
    loot.py         exact loot mathematics (distribution, expectation, hitting time, sinks)
    access.py       source<->POI<->region bindings, ownership integrity, craft ladders, hazards
    routes.py       expedition patterns, claim policy engine, capacity, risk
    sensitivity.py  labelled probability sensitivity + seeded resampling
    adversarial.py  fault injection + behaviour cases
    checks.py       single aggregation used by both the report and the tests
    report.py       deterministic artifact writer
tests/survival/balance/          # 127 unittest cases across 8 modules
docs/survival/balance/           # this file + METHOD + INDEPENDENT_REVIEW + LIMITATIONS
```

## Status vocabulary used everywhere

| Label | Meaning |
|---|---|
| `NATIVE_TESTED` | not used by this checkpoint for gameplay; nothing here runs Godot |
| `AUTHORED_CONTRACT_NOT_NATIVE` | the data exists; no build executes it |
| `HYPOTHESIS_NOT_GAMEPLAY_TUNING` | an assumption needed to produce an answer; not a rate, not a proposal |
| `UNMODELLED_*` | the model explicitly has no number (e.g. death chance for a band-only risk label) |
| `NOT_TESTED` | no evidence either way; see `LIMITATIONS.md` |

## Hard rules encoded in the tool

- **Planned ≠ playable.** A1's `content_readiness` is respected; `Model.is_loot_bearing_natively()` returns
  `False` for every POI today, so no report can accidentally claim otherwise.
- **Resource nodes ≠ supply crates.** The 178 `resource_nodes` stay on the harvest axis; eligible
  roadside containers are counted separately and currently evaluate to `0`.
- **A3's 14-session model ≠ human playtest.** It is cited only as a conservation/scenario model.
- **Gold-blocked Cores ≠ usable skills.** Cores remain `BLOCKED_PENDING_A4`; the tool never assigns them a cast.
- **No invented Core rates, no table edits.** The only loot table that exists (`roadside_cache`) excludes the
  `core` tag; the probability grid in `sensitivity.json` is labelled hypothetical and its "eligible containers
  today" input is derived as `0`, not assumed.

## Reading order for a reviewer

1. `INDEPENDENT_REVIEW_20261030.md` — what was measured, what is broken, what it means.
2. `METHOD.md` — the formulas, so the numbers can be re-derived by hand.
3. `LIMITATIONS.md` — everything this checkpoint does *not* prove.
4. `data/survival/balance/results/summary.json` — machine-readable headline + assertions.
