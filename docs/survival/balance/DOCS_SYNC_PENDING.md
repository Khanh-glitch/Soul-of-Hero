# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 1)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim):** `gh issue comment 16` → `Resource not accessible by integration, Locations: [{Line:1 Column:49}]`.
The session's GitHub integration can create pull requests but has **no issue-write permission**. This is a
permission blocker, not a content blocker: the text below is final and needs no further authoring.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) **was written and read back** on
2026-10-30 (entry found at index `156980`, `total_match_count = 1`). Nothing is pending there.

**Action required:** someone with issue-write access posts the text below on Issue #16
(`[QA WORKSTREAM — NO EXTRA AI] Independent deep review & balance gates`), then deletes this file or marks it
resolved. Git — PR #25 and `CHECKPOINT_1_REPORT.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 1 — executable inspector delivered (evidence below; not an assertion of IN_PROGRESS).

Branch pushed: `arena/353cf120-soul-of-hero` (Arena session branch; `feature/surv-a7-balance-060a` @ `15e0222a`
is merged into it, so the diff vs the work-order base is exactly the 56 added files). PR for independent review:
#25. **Not self-merged.**

Commits: `815049b8` (tool + tests + data + docs), `c34d57bc` (artifact reproducibility from a shallow clone),
`0a6f9bf4` (checkpoint report).

### Reproduce

```
python3 tools/survival/balance/run_analysis.py            # rebuild artifacts
python3 tools/survival/balance/run_analysis.py --check    # "artifacts up to date"
python3 tools/survival/balance/run_analysis.py --check-upstream
python3 tools/survival/balance/run_tests.py               # Ran 127 tests ... OK
```

Python 3.11.2, standard library only. Verified from a fresh `git clone --depth 1` of the branch.

### Results (`data/survival/balance/results/*.json`, digest `f4acb101965f50035fa84a6561f57dcd3ce6cbe66393ca269f041f0ecdd227c3`)

- Findings: 57 (0 blocker / 20 major / 28 minor / 9 info), 12 codes.
- 118 authored POIs, **0** natively loot-bearing; **0/16** A3 loot sources resolve to an A1 POI; eligible
  containers today = 0 (the 178 A1 resource nodes are not crates).
- Reachability 15 / 24 / 25 / 39 / 108 by capability stage; playable 1/2/2/2/2; loot-bearing 0 everywhere.
- Loot math reproduces CT: 3.6 / 1.35 / 0.45 / 0.45 per claim; P(no tracked item) 0.166375 per claim,
  0.004605 per trip.
- 5 expedition patterns incl. the deliberately underprepared P3; 24/24 adversarial cases; 12/12 computed
  assertions hold.
- Core-drop probability grid is `HYPOTHETICAL_NOT_A3_TUNING` — no rate was invented.

### Non-claims

`NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`: no Godot run, no save/reload, no collision, no performance, no playtest.
A3's 14-session model is not a human sequence and `roadside_claims = 0` is a sample limitation. L1-S special road
supply = `RESEARCH_DIRECTION` only.

Full detail: `docs/survival/balance/INDEPENDENT_REVIEW_20261030.md`, `LIMITATIONS.md`, `CHECKPOINT_1_REPORT.md`.
