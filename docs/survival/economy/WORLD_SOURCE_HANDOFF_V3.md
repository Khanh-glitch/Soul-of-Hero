# A3 world-source handoff — V4 checkpoint

Code SHA: `9f617946` on `arena/7a12b27e-soul-of-hero` / PR #19. Status: **A3-owned adapter + native fixtures authored; local Python/validator/model/syntax PASS; native Godot and two-OS-process restart evidence PENDING CI**. This is not an A0 production mount, not A1 geometry acceptance, not A4 Gold parity, and not human playtest approval.

## What changed in V4

1. **Host cell type fixed.** `world_source_adapter.gd` accepts native `Vector2i` and JSON `[int, int]` cells, rejects float/bool/string spoofing, and compares exact stand cells. The previous Array-only check would have rejected the documented native host.
2. **Replay idempotency fixed.** `world_action` signs the request only. The generation-derived canonical key is written into mutable SaveService receipt metadata inside the mutator. Replaying the same `event_id` after the claim generation advances returns `ALREADY_APPLIED` with the original key; a different request under the same event id returns `event_id_conflict`.
3. **A1 identity reconciled without geography edits.** The physical Waystation cache is canonically `si:r_ashen_crown:waystation_cache:01`; `node_waystation_cache` is its pinned interaction-node alias. `binding_for` resolves only exact pinned aliases and fails closed on collision. Projection exposes both. Deadfall remains the A1 slice node `node_waystation_approach_deadfall`.
4. **One no-Core notes crate bound.** A3 authorizes the existing `road_notes` proposal (1 `research_notes` / 1800 active s) on exactly one A1 physical crate `si:r_ashen_crown:roadside_supply:01`, stand `(395,220)`. The other two A1 roadside crates remain unbound. This replaces the legacy `soul_ember -> make_notes` bootstrap for ordinary tool research; it adds no scrap/spares abundance and no Core.
5. **A8 Quarry fail-closed.** `A8_QUARRY_AUTHORIZATION_V4.json` rejects `brace_east_shelf`, `chock_west_ramp`, and `extract_outcrop` pending evidence. No cost/yield/cooldown is guessed. The adapter has no Quarry binding; caller-supplied prices/flags are rejected. A7 BLK-5 remains open by design.
6. **Native negatives extended.** Cases 21–25 cover canonical zero-item locker/ledger, si/node aliasing, replay after generation advance, cooldown boundaries, new-session no offline credit, spoofed time quantum/sequence/regression, UI flag injection, partial relay cost, full bag, failed `.tmp` save, no-Core source→research→processing→iron_pick chain, inventory/knowledge conservation, hidden projection privacy, and Quarry rejection. Exact check counts will be reported only from a green native run.
7. **Two-OS-process restart proof added.** `economy_world_restart_test.gd` phase 1 writes a canonical claim; phase 2 runs in a separate Godot process, reloads the same save, verifies exact inventory, idempotent replay, full remaining cooldown with no offline credit, and generation 2 only after 1800 active seconds. Workflow runs both phases.

## Canonical authority unchanged

| Source/action | Reward/cost | Cooldown | Key |
|---|---:|---:|---|
| Waystation locker | `cap_salvage`, **0 items** | one-time | `a1slice:poi_crown_waystation:pry_locker:1` |
| Waystation ledger | `cap_seal_1`, **0 items** | one-time | `a1slice:poi_crown_waystation:seal_ledger:1` |
| Waystation cache | 3 `iron_scrap` + 2 `knowledge_spares` | 1800 active s | `a1slice:poi_crown_waystation:cache_restock:{claim_index}` |
| Approach deadfall | 2 `oak_wood` | 300 active s | `a1slice:poi_crown_waystation:gather_deadfall:{claim_index}` |
| Relay hand-crank | costs 2 `iron_scrap` + 1 `oak_wood`; grants `cap_power_1` | one-time | `a1slice:poi_crown_relay_shed:hand_crank_bypass:1` |
| Roadside notes crate 01 | 1 `research_notes` | 1800 active s | `a3src:r_ashen_crown:roadside_supply:01:claim:{claim_index}` |

The old extra locker reward must never return. No Core probability, free Core, Gold value, or new Spares grant is introduced.

## A0-ready atomic adapter boundary

A0 owns runtime/production mounts, SaveService, the pausable active-session clock, discovery, hero position, and physical interaction nodes. A3 owns item/source/research truth and the pure adapter. A0 must:

1. Refresh vendored `a3_economy_service.gd` and pins from `verification/v4/a3_sha256.txt`.
2. Mount `data/survival/items/world_source_bindings.v3.json` unchanged.
3. Provide `configure_world_host(Callable)` returning `soh.economy.world_host.v1` with `poi_id`, `discovered`, `hero_cell` (`Vector2i` or `[int,int]`), `active_seconds`, `session_id`, `session_index`, `sequence`, `world_revision`. Optional identity fields (`world_instance_id`, `interaction_node_id`, `source_class_id`, `region_id`, `canonical_poi_id`) are checked against the pinned binding when present.
4. Route one physical A1/A8 intent to `world_action({poi_id, action_id, instance_id?}, event_id)`. The request may contain **only** those fields. Costs, rewards, cooldown, generation, capability, and receipt are derived from the binding and host, never from UI flags.
5. Call `advance_world_time(poi_id, event_id)` from the pausable world clock. Max quantum 3600 active seconds; new sessions baseline the host and preserve remaining cooldown. No offline catch-up.

Save namespace remains `world_slice` inside the same SaveService candidate as inventory. There is no second save authority, side journal, or A3 inventory service. `SaveService.transact_once` remains the commit boundary; A0's pinned facade continues to reject mutators not authored by the adapter.

## A6 read-only state contract

`world_projection(poi_id)` returns:

- undiscovered: `{poi_id, visibility:"HIDDEN", sources:[], actions:[]}`;
- discovered: `{poi_id, visibility:"DISCOVERED", state, capabilities, active_seconds, sources[], actions[]}`.

Each source exposes canonical `instance_id`, pinned `world_instance_id`/`interaction_node_id`, class/region/POI identity, `claim_count`, `ready`, `remaining_active_seconds`, `cooldown_active_seconds`, `requires_capabilities`, and deterministic rewards. Each action exposes one-time state, costs, rewards, and capability grants. A6 sends intents only; it never receives the mutator, host receipt, or authority to set `ready`.

## No-Core loop evidence scope

Native case 23 now completes: locker/ledger → roadside notes crate → canonical cache claims → deadfall/relay → live harvest → home storage round trip → workbench/furnace → scrap-smelt bootstrap ingots → research kit → smelting technology → ore smelting → weave cloth → targeted iron_pick research → craft one iron_pick → reload. It uses **no** legacy bone/ember grant and **no** Skill Core. The modeled active-time cost is dominated by seven 1800-second cache claims; this is a conservation/obtainability fixture, **not** evidence that the pacing is enjoyable. Human playtest remains `NOT_HUMAN_PLAYTESTED`.

## A8 Quarry ruling

**REJECTED_PENDING_EVIDENCE_FAIL_CLOSED.** A8's 2-oak / 2-stone / 2-stone-yield / 45-second values are explicitly S2 fixture inputs, not prices. Missing evidence: durable A1/A0 physical instance, native two-route collision/reload proof, A3 net-yield model against existing stone/oak sinks, site-bound active-time replenishment authority, and human pacing evidence. A3 will not stamp a guessed 1-item price to satisfy A7's static checker. See `A8_QUARRY_AUTHORIZATION_V4.json`.

## Verification

Local at code SHA `9f617946`: 41 Python tests OK; validator PASS (56 items / 36 recipes / 5 techs / 36 sources / 7 stations / 3 bindings / 3 actions, 0 cycles); progression model 15 scenarios PASS (`SIMULATION_ONLY`); tree-sitter 0 ERROR nodes in 4 GDScript files (syntax only). Immutable conservation fixture `balance_report.json` unchanged. Logs: `verification/v4/`.

Native Godot: prior `100b3406` catalog jobs succeeded, native jobs remained queued. New runs for `9f617946` are pending at this checkpoint. **No native PASS is claimed until the exact SHA runs green.** The two-process restart step is authored but not yet executed.

## Unresolved authority

- Gold / Skill Core casts remain `BLOCKED_PENDING_A4`; no synthetic `ready` dict is parity.
- A0 production mount, A1 physical world integration, A6 UI, and human playtest are not accepted by this handoff.
- A8 Quarry remains fail-closed.
- Long-session disk benchmark and browser normal-input journey remain untested.
