# LW1 C08 takeover — live handoff (read this first)

## 2026-11-02 P0 round — independent episodes (Control Tower order `d635fb7b`)

**Branch** `arena/136e69c5-soul-of-hero` · **Draft PR #34** · **HEAD `bbd8de5e`** (refresh before acting).
**CI** `.github/workflows/c08-trace-causality.yml` — now `Phase 1a/B`, `1b/C`, `1c/A+K8`, then relaunch, new run.

### Cause table — what actually produced the red oracle at `45fe0777` (not an AI defect)

| # | Observation | Source | Verdict |
|---|---|---|---|
| 1 | `expires = stamp + lifetime` is written at record creation; `configure_policy()` only affects future marks | `game/survival/c08_trace_store.gd:109` | B's 300 s marks are still valid during C. Correct behaviour, contaminated fixture. |
| 2 | `begin_window()` resets counters, not the store/world | `game/survival/c08_trace_follower.gd:99-117` | Correct. Prior evidence persists on purpose. |
| 3 | C walks the Hero near home and creates fresh lawful marks | `tests/survival_c08_trace_causality_test.gd` (`_counterfactual_c`) | A creature sensing them is legitimate evidence, not home GPS. Not a defect. |
| 4 | `C: the same walkable ground is used again` at `45fe0777` | route plan/door/actor collision | Stopped **before** any expiry was tested. No lost-trace conclusion may be drawn from it. |
| 5 | `goal_timeout` / `link_blocked` / `chain_end` / `expired` collapse into `lost_reason` | `c08_trace_follower.gd` | Reported per cause; P0 still wants per-state evidence lines (open item). |

### Fixture fix (P0)

Each case is its own OS process and its own `--user-data-dir`, rebuilt from the same
legitimate checkpoint (production world mount, paid home by real input, creature by
`_mount_optional_threat`). Cases share the scenario, never the trace state, the
chase, or the Hero's health. Episode A also owns the K8 ledger commit that the
relaunch and new-run phases read. No mark is deleted, no AI is disabled, no target is
injected, nothing teleports.

### Source library (fetched from `references/gameplay-prototypes-20261102`, SHA-256 verified)

| archive | SHA-256 | read | verdict |
|---|---|---|---|
| `soul-of-hero-rpg-development.zip` | `2b86f656…b75` | `src/engine/simulation.ts:805-855` | **ADAPT (idea only)**: `trackingTraceId` → explicit `nextTraceId` → `RETURN` when the tracked footprint is gone. LW1 already has strict `successor()` + `_stop("expired"/"chain_end")`; the phôi's 4-neighbour sensing radius is *not* copied. |
| `soul-of-hero-prototype.zip` | `01348a02…5b7` | `src/sim/simulationTick.ts:632-670` | **NEGATIVE ORACLE**: `f.prevId === cur.id \|\| (newer && within 1.6 tiles)` can join an unrelated chain. LW1 store's `successor()` is id-exact; the adversarial two-trail test is a P0 open item. |
| `develop-soul-of-hero-rpg (4).zip` | `f601ca17…1ba` | `src/game/state.ts:1033-1076`, `1237-1242` | **NEGATIVE ORACLE**: `harvest` never checks player↔source distance; `trail` accepts caller `x,y`. SOH source writes only the real actor position; the distant-harvest/remote-mark tests are open items. |
| `soul-of-hero-rpg-prototype (3).zip` | `12438a53…f55` | `src/tests/contracts_c01_c24.test.ts:591-774, 819-905` | **REJECT for now (P1)**: escrow/Ragnarok/inventory-custody hypotheses. No SOH action to bind them to in P0. |

### Episode results at `e8ec682a` (run 41420887725)

| episode | verdict | evidence |
|---|---|---|
| A (no trace) | last green at `45fe0777`, re-run pending in this split | `C08_A`: 721 PATROL samples, 0 sensed, 0 direct ticks, `min_home_distance 375` |
| B (valid chain) | **RED, and the red moves**: 3 hops in one run, 120 hops and a 139 px arrival in the next | `C08_B_LEG`, `C08_B`, `C08_B_ARMED`; the chain and the creature's patrol phase are coupled: `sensed 1` is reliable, `hops` is not, and the defence window can open when the creature is 400 px away (`862 -> 862`). |
| C (cold trail) | not yet observed in this split (B runs first; `if: always()` now added) | — |
| K8 / relaunch / new run | not yet observed at this HEAD | — |

### What is proven right now

1. Three cases run as **independent native episodes** in their own OS process and
   own save profile, from the same legitimate checkpoint. That was the P0 order.
2. A real paid home, a real door with a collider, a real creature mounted by the
   production path, real key input, the real K8 clock.
3. The creature follows **real contiguous marks**: 120-160 consecutive hops of
   21-27 px, `max_hop <= 27.5`, `refused 0`, `gave_up 0`, no jump, no injected
   target, no teleport; and it arrived 139 px from the house while still
   `INVESTIGATE`.
4. The remaining B redness is **scenario variance, not a passing trick**: the
   creature's patrol phase decides whether the chain continues, and the defence
   window sometimes opens when the creature is nowhere near.

### Next commands

```
gh run list --branch arena/136e69c5-soul-of-hero --workflow "C08 trace causality (native)" --limit 1
gh api repos/Khanh-glitch/Soul-of-Hero/actions/runs/<run>/jobs -q '.jobs[]|select(.name|test("NATIVE"))|.id'
gh api repos/Khanh-glitch/Soul-of-Hero/check-runs/<job>/annotations
```

**First thing a successor should fix:** make B's observation window start when the
creature is actually in reach (`_direct(enemy, hero)` false but distance < 300) and
record `lost_reason` per hop so a 3-hop chain says `link_blocked` / `goal_timeout` /
`gave_up` instead of only a count. Then re-read C.

### Next commands (older)

```
gh run list --branch arena/136e69c5-soul-of-hero --workflow "C08 trace causality (native)" --limit 1
gh api repos/Khanh-glitch/Soul-of-Hero/commits/<sha>/check-runs | grep -o '"id":[0-9]*'
gh api repos/Khanh-glitch/Soul-of-Hero/check-runs/<id>/annotations
```

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

## Progress ledger (newest last)

| commit | finding |
|---|---|
| `0eda95fd` | takeover handoff + Draft PR #34; route refusal printed |
| `e7af4962` | the paid room is sealed by a real door collider: the walk now opens it by ordinary click |
| `7f9d62b7` | the detection counter must stay inside detection range (A reported 723 phantom ticks) |
| `1d603992` | wedge diagnostics |
| `27bb86df` | stand cell chosen against real furniture; source counts chain breaks; follower counts `drive_calls`/`block_reason` |
| `fb0a033d` | the real defect: `stats.samples` raised a SCRIPT ERROR on a missing key and silently truncated a 56-cell walk |
| `2f7f53e1` | CI evidence split into short per-line annotations (GitHub truncates at 4 KB / 10 per step) |

## Exact failing point and next action

Measured on `2f7f53e1`: the outbound leg completes and lays real marks
(`records_written` 130, `live` 34, source sampled 3292 times), but the return leg
wedges. `C08_WEDGE` names the cause exactly: `cell [108,222]`, `state: ATTACK`,
creature body 11 px from the Hero on the route. A living body is not a wall - the
simplest honest answer is that a player does not walk back through a creature that
is standing in the doorway of his own returning path. The return leg now plans a
second lane seven cells to the north of the creature, and the walker's sidestep
around a blocking body is 24 frames x 10 attempts instead of 10 x 6.

B's arrival claim is now measured on the creature itself: at the first sample
inside 160 px of the house, its own `state_label()` must be `INVESTIGATE` and its
hop counter must be at least 6. A creature that chased the defender would be in
CHASE and one that was handed a target would still be in PATROL, so "it found the
house by following the trail" is a property of the creature, not of the test.

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
