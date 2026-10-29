# Restart checkpoint — Gold 93 native readiness factory

Written 2026-10-29. Branch `arena/4fa0fa84-soul-of-hero`, HEAD `9f5ec19`.

## Status: NOT GREEN. One CI job is red.

Runtime workflow run **40805377227** — https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40805377227

| job | conclusion |
|---|---|
| Reject any production or source-factory mutation | success |
| Disposable immutable Level 2 overlay | success |
| Venomwright 1..21 vs original TypeScript (21 shards) | success (all 21) |
| **Native Godot 4.7 runtime contract** | **failure** |

Inventory workflow `40798541206`: success.

The single red job fails at step **"Full native lifecycle and fail-closed coverage"**
with **exit code 124 (timeout)**. Nothing else in that job reports a failure — the
12 downstream steps are skipped, not failed.

## Why this is unresolved

The GitHub Actions **log and artifact download are unreachable from this sandbox**
(`gh run view --log` → `EOF`; artifact zip → `SSL_ERROR_SYSCALL` against
`productionresultssa11.blob.core.windows.net`, which is outside the network
allowlist). The only reachable signals are:

- `gh api repos/Khanh-glitch/Soul-of-Hero/actions/jobs/<job_id>` → per-step status
- `gh api repos/Khanh-glitch/Soul-of-Hero/check-runs/<job_id>/annotations` → the
  `::error::` annotation, which is how "exit code 124" was obtained.

So the failure *mode* is known (timeout) but the failure *site* inside
`tests/gold93_runtime_lifecycle_test.gd` is not. Get the log from the GitHub UI
first — one look at the log tail settles this.

## What was already tried (do not repeat)

All of these produced exit 124 in the same step:

| commit | change | result |
|---|---|---|
| `3bafc92` | replaced `emitted > 0` with a strict 1:1 intent-transmission assertion | 124 |
| `3d771ef` | cut the adapter sweep 18 casts → 7, capped at 900 ticks | 124 |
| `49e9919` | cut to 6 × 120 ticks + 1 full cast | 124 |
| `3ae0f85` | cut to a single representative 60-tick cast | 124 |
| `b9c01c1` | memoised `source_native_executable()` probe | 124 |
| `2dd2bae` | reverted the adapter cast out of the lifecycle test entirely | 124 |
| `9f5ec19` | raised the step budget 600 s → 1500 s | 124 (after ~25 min) |

The budget increase is the decisive data point: with 2.5× the time it still
exhausted it, so this is **not** "marginally too much work". It is either a hang
(infinite loop) or something pathologically slow. **Suspect a loop, not a cost
problem.** The most likely candidate is `Gold93SkillHandle.run_to_completion()`
not terminating because `VenomwrightSourceModule.is_finished()` never flips —
`_check_end()` matches on the authored task name (`SKILLS.defs()[id]["name"]`),
and if that string does not exactly match the name `ENGINE.cast()` registered,
the cast runs to its tick cap every time. Verify by printing `w.tasks` names.

## Real work landed and verified green

- **6/21 source-native ports, differential-parity verified.** Seeds 7/21/99, all
  `first_divergent_tick: -1` (bit-exact against the original TypeScript):
  001 Glassfang Hunt, 002, 003, 004, 005, 006.
- **21-shard differential matrix** replacing the serial suite — one job per skill,
  all 21 green, ~4 min for a ported skill vs ~1 min for an unported one.
- **Three-axis contract** in `core/gold93_runtime.gd`: `source_native_executable`,
  `source_parity_verified`, `host_adapter_castable`, plus invariants that
  parity ⊆ source-native and every host-adapter id has a source-native generator.
- **The bridge**: `skills/venomwright/venomwright_source_module.gd`
  (`VenomwrightSourceModule extends Gold93SkillModule`) plus thin ids 002–006 and
  `families/venom_source_native_canvas.gd`. One shared adapter over the
  source-native engine, not six hand-written approximations.
- `venom_s3.gd` holds ported skill 007 (Hatchery Fall) but is **intentionally
  unregistered** — no dispatch case in `venom_skills.gd`. Do not register it
  until the differential reports parity.

## Next genuinely unimplemented skill

**Venomwright 007 Hatchery Fall.** The generator is written and parses; it needs
`venom_skills.gd` case `7: return func(c): return S3.hatchery(c)`, then a
differential run. Then 008 Brine Serpents → 021, then ARCANA III 001–072
(starting with Black Sun Coronation).

## Environment notes for the restart

- A Godot binary does **not** survive a sandbox reset. A trimmed-module build was
  in flight at `/home/user/tools_build/godot` (log `/home/user/tools_build/build.log`).
- The sandbox reset also wipes local git refs/index. Always
  `git fetch origin arena/4fa0fa84-soul-of-hero && git reset --mixed origin/arena/4fa0fa84-soul-of-hero`
  before concluding work is lost — the remote branch is intact.
- `gdparse` (from `pip install --break-system-packages gdtoolkit`) gives syntax
  checking with no engine. It does **not** check identifiers or scope — a splice
  that leaves a block referencing a deleted variable will parse and then die at
  runtime.
- Source escrow: `/home/user/.gold93-private/sources/{venomwright,arcana}/src/game/`,
  outside the repo. Key is local-only; never commit or print it.
