# A3 V6 — Prepared offline operations, D055/D059/D060 handoff

Status: **UNWIRED_A0_PRODUCTION_MOUNT_REQUIRED**. This is additive A3 engineering, not a B0 product PASS, not a human playtest, and not an approved offline/world-calendar rate.

## Player benefit first

A player who **already paid** for two forge batches and explicitly arms them before closing the game can return after 18 hours to **two iron ingots waiting in job escrow**. With saved oak and knowledge spares, those ingots make a **research kit** affordable. The next expedition becomes a targeted learning choice instead of another scrap grind. The system does **not** add loot, Core grants, POI refresh, free materials, crop yields, or automatic queue chaining.

## What shipped in A3

- `game/survival/economy/offline_operation_planner.gd`: read-only, opt-in prepared-operation planner; candidate-only apply; D059 food forecast.
- `game/survival/economy/economy_service.gd`: additive public wrappers, optional `survival_economy.offline` namespace, arm-record pruning at the existing transaction boundary, and the previously missing V5 `plan_tool_use` / `apply_tool_use_plan` callables.
- `data/survival/recipes/offline_operations.v1.json` + schema: fail-closed allowlist policy.
- `data/survival/recipes/state.schema.json`: optional `offline` object; legacy saves without it remain valid.
- Native tests: `economy_offline_test.gd`, `economy_offline_restart_test.gd`, `economy_tool_use_test.gd`.
- Python contracts: `test_offline_operations.py`; validator now audits the offline policy.
- Exact machine-readable handoff: `A0_OFFLINE_OPERATION_CONTRACT_V6.json`.

## Three time domains — do not collapse them

1. **D055 run deadline:** real UTC, exactly `1,209,600` seconds. A0 owns `run_started_at` / expiry and the non-destructive run-end UI. A3 clamps settlement to `min(interval_end, run_expiry)` and proposes zero work after expiry.
2. **D060 world calendar:** A0-owned continuous online+offline projection. A3 validates and echoes it, reports `elapsed_world_us`, and **never** converts it into work, loot, cooldown, crops, or weather. `rate_approval` must remain `NOT_USER_LOCKED`; no fictional year length is approved here.
3. **Operation clock:** real elapsed seconds, `1 tick = 1,000,000 µs`, only for explicitly armed, already-paid, allowlisted jobs. The provenance is A0 PR #21 `economy_session.gd`: `record.ticks` increments once per 1,000,000 monotonic µs while gameplay is active; `TICKS_PER_SECOND=60` is only a diagnostic sub-step scale.

The Waystation cache **1800 ACTIVE seconds** remains ACTIVE-only. Offline time does not reduce it, claim it, or mint scrap/spares.

## Mount order (A0 only)

1. Pin/load the A3 adapter through the existing SaveService port; preserve `survival_economy.offline`. Absent namespace ⇒ empty state, **no retroactive credit**.
2. `configure(save_port, station_resolver)`.
3. If `load_catalog()` is called separately, call it **before** the offline host; it clears the host by design.
4. `configure_offline_time_host(a0_projection_callable)` **after** configure/load_catalog.
5. Player pays through existing `enqueue` / `research_*`, then explicitly calls `arm_offline_operation(job_id, event_id)`.
6. On return, A0 reads one authenticated projection and calls `plan_offline_operations(request)`.
7. A0 checks `is_transaction_applied(proposal_id)`, then commits through `SaveService.transact_once(proposal_id, mutator, metadata)`. Inside the mutator it calls `apply_offline_operation_plan(candidate, proposal, request)`.
8. A3 re-plans from the candidate, ignores proposal-supplied deltas, rejects drift, and completes output into the **existing job escrow**. The player still calls `collect`; a full bag leaves output safe in escrow.

A3 never writes disk. SaveService remains the sole inventory/transaction authority. A0 remains the sole time authority.

## Allowlist and forbidden effects

Eligible craft: `burn_charcoal`, `smelt_iron`. Eligible targeted research: `iron_pick`. Eligible technologies: `tech_smelting`, `tech_precision`.

Disabled/forbidden: cultivation, collectors, Core/reconstruction, POI loot claims, source-cooldown reduction, new research/craft queues, free materials, automatic harvest/replant, monster raids/base damage, and A3 HP/hunger mutation. Cultivation and collectors stay disabled because the pinned A1/A0 sources contain no approved planted plot, tank, weather/soil/season projection, or collector recipe. No crop yield is invented.

## D059 food forecast only

`forecast_offline_food(request, needs)` returns a bounded real-food debit forecast. A0 supplies satiety, drain rate, shelter validity, and container custody. A3 cross-checks proposed food against the **same SaveService candidate** (bag, home storage, or A0 container), refuses inflated stock, and returns `hp_delta: 0`, `a3_mutates_hp_or_hunger: false`. Valid shelter may floor HP at 1; wilderness starvation risk is reported separately. A0 owns the actual debit, HP, hunger, shelter, and death, and must use `forecast_id` as its own idempotency key while re-checking `food_custody_sha256`.

## V5 tool-use callable closed

`plan_tool_use(request)` and `apply_tool_use_plan(candidate, plan)` now exist. The plan is read-only, checks unique bag ownership, revision, condition, and tool/node kind, and always returns `yield_multiplier: 1`. A0 must apply it inside the **same** SaveService transaction as the physical node hit, depletion, and inventory grant. Full bag or failed save rejects the whole swing. This remains `UNWIRED_A0`; no A0 harvest signature was edited.

## Evidence level

- Authored: yes.
- Native-fixture-tested: see `verification/v6/` at the final pushed SHA.
- World-integrated: **no**.
- Human-reviewed / playtested: **no**.
- A0 production mount: **no**.
- A4 Gold parity / visual capture: **no**.

## Next atomic action

A0: mount `configure_offline_time_host` behind the authenticated run/world clock producer, add one native A0 test that pays + arms a forge job, closes/reopens, commits the returned proposal through SaveService, and collects exactly one ingot; keep PR #19 open until that mount and the D059 food-debit boundary are reviewed.
