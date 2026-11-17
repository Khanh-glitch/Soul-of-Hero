# Global continuity implementation phase — NOT final acceptance

Parent b727345. Preserves earlier K1 claims, cargo rollback, beds, aid/Trust, source protections and VFX.

## Actual causal integration

- Global route queries consume existing engine global collision, terrain/source/structure deltas and authored floor layers. No player camera/window change. Waypoints are cardinal tiles or exact bidirectional authored stair endpoints. Locked, G1B-authority, powered/access-controlled doors are not granted access. Ordinary unlocked doors update the actual live/archive door ledger and receipt only on contact.
- A* is resumable across planner calls (256 expansions/call, 48,000 total limit), with actor+origin+destination identity; reloading rebuilds derived search, never advances the person. Every path tile is checked on completion; every movement admission checks current physical geometry again, including saved partial motion. Motion saves destination floor and physical profile travel time. Long paths and all travel contexts are NOT yet certified.
- Planner is round-robin rather than changing its base index during iteration. One distant expensive plan per transaction, up to eight total plans. This is bounded query work, not offscreen population deletion or time-free arrival. Complete 336h throughput remains unmeasured.
- Shared world integrator now cuts at human movement/work/planning/biological boundaries. The old one-tile-per-weather-slot cap is removed. Offscreen community stock requires actual cardinal contact on the real floor; no community-wide pantry radius. Occupation target lookup and execution now see live AND archived authorized entities; existing job/worker output claims unchanged. Full natural eight-role loops remain incomplete.
- Thirst can cause autonomous bank selection in a 24-tile local catchment, real routing and two-second drinking/refill. Water uses the ordinary player potable-map mask and ice veto; one real carried water-container instance can refill to its catalog capacity. No water item or charge is granted before physical timed completion, and sea/upper-floor icons are not potable. This supplies reusable infrastructure, NOT certification that all 286 humans have reachable water or food.

## Regression recovery

The original full run was stopped after a CPU profile, rather than waiting indefinitely. Parsing/sorting IDs in allRunEntities dominated samples. A second isolated natural-route run was inspected non-mutatively: food seed 11 was at 13,046 actual 50ms ticks / 10.8733 game minutes, proving progress rather than an assumed infinite engine loop. That earlier-source run was also stopped to rerun current code.

Derived entity sort views now verify membership, object references AND ID on every call and return an independent array; direct add/delete/replacement/archive edits are tested. No persistent stale membership cache or omitted actor is used. No performance target is claimed without the required matched workload.

App/test TypeScript checks remain required. Nine focused suites: 68 passed (31.82s); subsequent admission recheck: 33/33 across navigation/P0 suites (12.93s). Initial broad-search timeout regressions were reproduced and corrected by bounded resumable search and distant-plan budgeting, without raising focused-test timeouts. Build passed before the last admission-recheck change, so it is not final-SHA packaging acceptance.

## Explicit gaps

This phase is ENGINEERING evidence, not browser A–I acceptance. The census remains uncertified: no arbitrary people/food/beds were added or deleted. Remote shared harvest/regrowth, intercommunity imports, residential/travel origin reconciliation, complete role ecology, distant combat and six-Elder community assault/visible transport are not closed. An ordinary new-run smoke is not evidence for them. No Creator approval awarded. Whole assignment PARTIAL; work continues.
