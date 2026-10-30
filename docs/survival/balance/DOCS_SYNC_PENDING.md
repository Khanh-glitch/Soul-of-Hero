# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 2)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim):** `gh issue comment 16` → `Resource not accessible by integration, Locations: [{Line:1 Column:49}]`.
The session's GitHub integration can open pull requests but has **no issue-write permission**. Permission
blocker, not a content blocker: the text below is final.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) **written and read back** twice —
checkpoint 1 at index `156980`, checkpoint 2 at index `175097`. Nothing pending there.

**Action required:** someone with issue-write access posts the text below on Issue #16, then deletes this file.
Git — PR #25, `PLAYER_BLOCKERS.md`, `CHECKPOINT_2_REPORT.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 2 — math defect fixed, 57 observations consolidated into 5 player-facing blockers, product-readiness
audit added. Branch `arena/353cf120-soul-of-hero`, commit `3979f0a1`, PR #25 updated (**not** self-merged). No
gameplay file, loot table, rate or other owner's code was touched.

### 1. Verified math defect fixed

`expected_claims_to_reach` summed `Σ_{t≥1}P(T>t)` and called it `E[T]`, dropping `P(T>0)=1`, so every non-empty
expectation was one claim low. It now solves `E[k]=(1+Σ_{q≥1}p_qE[k+q])/(1−p_0)` exactly over `Fraction`s; above
128 units it falls back to the survival sum with a published upper bound. Independent oracles: guaranteed
1 unit/claim → `E = target` (the CT case that returned 0), fair coin → `E = 2·target`, 2 units/claim →
`E = target/2`, a second derivation through `Σ_t(1−P(T ≤ t))`, and a seeded 4000-run Monte Carlo.
**Corrected: 4 `knowledge_spares` = 3.525289745 (was 2.525289745); research gate 3.525.** Dependent tests were
corrected (not deleted) and artifacts, digests and prose regenerated.

### 2. Five blockers instead of a findings list

| # | Blocker | Owner | Class |
|---|---|---|---|
| BLK-1 | Player cannot enter the survival loop at all | A0 mount + A1 | RUNTIME_MOUNT_GAP |
| BLK-2 | Loot has no host and its ids do not join A1 | A1 ids + A3 + A0 | STATIC_AUTHORING_GAP |
| BLK-3 | Mounted body is Knight; 555940/419402 absent, no armour stage | A0 + A6 | SOURCE_BLOCKED |
| BLK-4 | First research is a bootstrap cycle | A3 | STATIC_AUTHORING_GAP |
| BLK-5 | Only survival UI is developer-facing and duplicates A0's HUD | A6 | PRODUCT_SURFACE_GAP |

Each has player impact, a reproduce command, the smallest safe correction, and a closure test that asserts the
blocker on pinned bytes and then requires the minimal in-memory fix to flip the check to PASS.

Also corrected: A3 writes **16 loot records over 10 class targets** (`poi:roadside_cache` = 5), A1 authors **no
container vocabulary**, and 3/3 declared regions are unresolved — one identifier contract, not ten POIs.

### 3. Product audit (`results/product.json`, 18 pinned A0/A6 files)

`PROD-01` FAIL no survival entry point · `PROD-02` FAIL nothing grants authored loot (only the score/sigil
`RewardChest`) · `PROD-03` FAIL mounted body is Knight, canonical refs 0, armour stage 0 · `PROD-04` FAIL 93
developer-vocabulary strings on survival UI · `PROD-05` PASS no fake success screen · `PROD-06` WARN duplicate
status HUDs · `PROD-07` PASS 0 unconnected items.

### Reproduce

```
python3 tools/survival/balance/run_analysis.py            # artifacts + PLAYER_BLOCKERS.md
python3 tools/survival/balance/run_analysis.py --check    # "artifacts up to date"
python3 tools/survival/balance/run_analysis.py --print-blockers
python3 tools/survival/balance/run_tests.py               # 164 tests OK
```

Verified from a fresh `git clone --depth 1` of `3979f0a1`.

### Non-claims

`NATIVE_NOT_TESTED`, `HUMAN_NOT_TESTED`. The product audit is a static read of pinned bytes: "mounted" means a
production scene references the file, never that it runs. Armour stages stay `SOURCE_BLOCKED`. No loot rate was
invented, and `docs/survival/{STATE,WORKLOG}` were not edited (outside A7's owned paths).
