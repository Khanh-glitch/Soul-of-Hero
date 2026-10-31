# A7 checkpoint 2 — math correction, blocker triage, product-readiness audit (2026-10-30)

Work: CT review `CT_A6_A7_INDEPENDENT_ACCEPTANCE_AND_NEXT_A6_A7_A8_WORK_20261030.md`, user lock D051/D052.
State: **ANALYSIS_COMPLETE / NATIVE_NOT_TESTED / HUMAN_NOT_TESTED / NO_GAMEPLAY_EDIT**.
Read first: [`PLAYER_BLOCKERS.md`](PLAYER_BLOCKERS.md) (generated) — this report is the evidence around it.

## 1. The verified math defect is fixed

`LootTable.expected_claims_to_reach` accumulated `Σ_{t≥1} P(T > t)` and called it `E[T]`, dropping
`P(T > 0) = 1`. Every non-empty hitting time was low by exactly one claim.

- **Fix:** exact backward solution of `E[k] = (1 + Σ_{q≥1} p_q E[k+q]) / (1 − p_0)` over `Fraction`s
  (`EXACT_LINEAR_SYSTEM`, no truncation). Above 128 units the module falls back to the survival sum and reports
  an explicit upper bound instead of a silent tail.
- **Oracles (independent of A3 data):** guaranteed 1 unit/claim → `E = target` (the CT case that returned 0);
  fair coin → `E = 2·target`; 2 units/claim → `E = target/2`; `Σ_t (1 − P(T ≤ t))` via `p_reach_by` must agree
  with the linear system to 5 dp; seeded 4000-run Monte Carlo must agree within 0.25 claims.
- **Corrected values:** 4 `knowledge_spares` **3.525289745** (was 2.525289745); research gate 3.525 (was 2.525);
  `claims_needed` rows and `sensitivity.json` regenerated. Distribution-based numbers (means, `P≥1`, percentiles,
  adversarial cases) are unchanged, as expected.
- Existing tests that asserted the wrong value were corrected, not deleted; assertion `A13` now pins the
  corrected value and the exact method.

## 2. Findings were re-triaged, not extended

57 observations → **5 player-facing blockers**. Each has one owner, the smallest safe correction, an exact
reproduce command and a closure test that flips FAIL → PASS. The finding list survives as an appendix in
`results/findings.json`; `results/blockers.json` carries the triage (`blocker_id`, `evidence_class`,
traceability-only count = 3).

Evidence classes are separated, which was the CT objection:

| Class | Meaning | Blockers |
|---|---|---|
| `RUNTIME_MOUNT_GAP` | the fix is a mount/host decision on existing systems | BLK-1 |
| `STATIC_AUTHORING_GAP` | the data itself does not join or does not bootstrap | BLK-2, BLK-4 |
| `SOURCE_BLOCKED` | the required asset is not in the build and A7 cannot verify it exists | BLK-3 |
| `PRODUCT_SURFACE_GAP` | the player-facing surface is developer-facing or duplicated | BLK-5 |

Also corrected: "0 of 16 loot sources have no POI" was the wrong unit. A3 writes **16 records over 10
class-style targets** (`poi:roadside_cache`, 5 of them), A1 authors **no container vocabulary**, publishes
`poi_*` instances and `r_*` regions, and 3 of 3 declared regions are unresolved. The missing thing is one
identifier contract plus instances — not ten tickets. And `loot_bearing_in_authored_contract` replaces the old
name so nobody reads "0 native loot-bearing POIs" as a live-world measurement.

## 3. Product-readiness audit (`results/product.json`)

18 sha256-pinned production files (A0 `9d287f33`, A6 `8bc561df`) plus a tree-wide mount/art index, captured by
`tools/survival/balance/build_product_snapshot.py`. Verdicts: **4 FAIL, 1 WARN, 2 PASS**.

- `PROD-01` FAIL — home screen offers `bestiary, campaign, hero_roster, modes, settings, storage`; no survival,
  world, POI or container destination. No production scene references any survival UI scene (closed island).
- `PROD-02` FAIL — 0 of 2 authored loot tables referenced by production code; the only openable container is
  the dungeon `RewardChest`, whose signal is `opened(score_reward, contained_sigil)`.
- `PROD-03` FAIL — mounted body is `game/characters/knight/knight.tscn`; production references to the locked
  sources (555940 / 419402) are **0**, armour-stage references are **0**, and swordsman 180537 appears nowhere
  in production (a closure test asserts it can never satisfy the avatar gate).
- `PROD-04` FAIL — 93 player-visible strings carry developer vocabulary (`FIXTURE`, `PROJECTION`,
  `BLOCKED_PENDING`, `PREVIEW`); currently unmounted, so the risk is shipping, not current exposure.
- `PROD-05` PASS — no unqualified success claim; fixture journeys say "fixture" and "BLOCKED".
- `PROD-06` WARN — A0 `hud.gd`, A0 `overworld_hud.gd` and A6 `player_first_hud.gd` all render player status.
- `PROD-07` PASS — 0 unconnected items in the 56-item catalog (every item has a source, output, or input).

## 4. Verify it yourself

```bash
python3 tools/survival/balance/run_analysis.py            # regenerate every artifact + PLAYER_BLOCKERS.md
python3 tools/survival/balance/run_analysis.py --check    # "artifacts up to date"
python3 tools/survival/balance/run_analysis.py --print-blockers
python3 tools/survival/balance/run_tests.py               # 164 tests
python3 tools/survival/balance/build_product_snapshot.py  # only to move the A0/A6 pin
```

Artifacts: `provenance, findings, access, opportunity, sensitivity, adversarial, product, blockers, summary,
digest` in `data/survival/balance/results/`. Digest is stable across output directories and contains no
timestamps.

## 5. Non-claims

No Godot run, no input, no save/reload, no collision, no performance, no human playtest. The product audit is a
static read of pinned bytes: "mounted" means a production scene references the file, never that it runs.
Armour-stage sprites remain `SOURCE_BLOCKED` and were not assumed to exist. No loot rate was invented, no A1/A3
data or other owner's code was edited, and `docs/survival/{STATE,WORKLOG}` are outside A7's owned paths.

## 6. What would move the needle next (owner order)

1. **A0** — one home-screen destination hosting the existing A1 world (closes BLK-1).
2. **A1 + A3** — one identifier rule and one `roadside_cache` instance on a reachable POI (closes BLK-2).
3. **A0 + A6** — mount a canonical bald body; keep armour stages `SOURCE_BLOCKED` (closes BLK-3).
4. **A3** — one non-loot `knowledge_spares` source, loot table untouched (closes BLK-4).
5. **A6** — debug panel behind opt-in, one owner for status (closes BLK-5).
