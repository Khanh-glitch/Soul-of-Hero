# LW1 C08 takeover — live handoff (read this first)

**Branch (only branch this session may use):** `arena/136e69c5-soul-of-hero`
**Base ancestry preserved:** `1f110589c60589be674586aff326a687448eb33c` (PR #33 WIP) on top of
`fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1` (PR #31 code composition).
**Rule authority:** canonical Bible `a8c718b55130cff29b3adc5e7c531f9211ca22df` §0.2 D061, K2, K5, §11.3 C08.
**Work order:** `b07163ccc4009602c4bfff3435b65abb93e6ebd4`.

## State (truthful, updated every step)

| Step | Status | Evidence |
|---|---|---|
| WIP preserved (`c08_trace_store.gd` + `tests/c08_trace_store_unit_test.gd`) | DONE, 5 concrete defects fixed | unit gate |
| Trace store wired to real Hero body, K8 run id + run clock, K2 surface | DONE | `C08_SOURCE` JSON in native log |
| Skeleton perception adapter (no target injection, direct LOS preserved) | DONE | A window: 721 PATROL ticks, 0 sensed |
| Counterfactual A (no trace ⇒ no home GPS) | **PASS** | run 41386508209, `C08_A` |
| Counterfactual B (valid chain ⇒ arrival at home) | **FAILING: route plan** | `no_route_home`; bed cell was the goal, fixed to a free interior cell |
| Counterfactual C (expired chain ⇒ loses, never jumps) | blocked behind B | gated by design |
| K8: quit may not erase a live trail | IMPLEMENTED, not yet proven | live-only ledger in the existing save document (`c08_traces`, `patch_state_path`); unit gate green, native relaunch pending |
| Native frames | captured 1280×720, non-flat, inspected next | `artifacts/shots/*.png` |
| Regressions (Godot 4.7 Runtime Validation on this branch) | see run list | re-check after every push |

## Exact failing point and next action

`survival_c08_trace_causality_test.gd::_route_plan()` planned the walk home to
`nav.cell_of(home)`, which is the paid bed's own cell and therefore not shape-clear
for the Hero. It now plans to `_stand_cell()` (a free interior cell) and prints
`C08_ROUTE_FAIL reason=…` for every refusal. Next: push, read the new
`C08_B` line, then C.

## Commands that must be run next (no re-research needed)

```bash
git log --oneline -3
gh run list --branch arena/136e69c5-soul-of-hero --workflow "C08 trace causality (native)" --limit 3
# annotations are the readable CI channel in this sandbox (artifacts/log downloads are blocked):
gh api repos/Khanh-glitch/Soul-of-Hero/commits/<sha>/check-runs \
  | python3 -c 'import json,sys;[print(c["id"],c["name"],c["conclusion"]) for c in json.load(sys.stdin)["check_runs"]]'
gh api repos/Khanh-glitch/Soul-of-Hero/check-runs/<id>/annotations
```

## Known gates that are NOT proven (do not report C08 done before these)

1. B and C native pass, with per-hop trace identity evidence.
2. Native relaunch restoring a live ledger and dropping expired marks.
3. New-run wipe.
4. Visual inspection of the decoded frames by a human/agent (not just stats).
5. PR #31 regression workflows on this branch.
6. C09 offline consequence (a persisted creature acting on persisted evidence) —
   the Round-12 seam is one-shot by design (`first_hit` receipt), so persisted
   evidence currently has no persistent observer. Explicitly out of C08 scope.
