# A3 world-source handoff — V5 checkpoint

Code SHA: `692128aaf36597712653258905ff6cedb6110766` on `arena/7a12b27e-soul-of-hero` / PR #19. Status: **A3-owned adapter + native fixtures authored; local Python/validator/model/syntax PASS; native Godot and two-OS-process restart evidence PENDING**. This is not an A0 production mount, not A1 geometry acceptance, not A4 Gold parity, and not human playtest approval.

## What the player can do in the A3 contract

A weak-melee, no-Core start can choose two materially different first-hour routes:

- **Explore-first:** open the Waystation locker for `cap_salvage` (zero items), take the renewable notes crate 01, loot one-time roadside crates 02/03, make the first canonical cache claim, then return home to harvest oak/stone/reed/scrap and build paid production.
- **Home-first:** harvest fresh A0 oak/stone/scrap nodes, craft `stone_pick` and a paid `workbench_kit`, build a furnace, then leave for the A1 corridor crates/cache to fund `research_kit` and basic-tool research.

Both routes can reach a paid workbench/furnace/research chain, learn `iron_pick` through targeted research, and craft one physical `iron_pick` without any Skill Core, Gold, legacy `soul_ember`/`crypt_bone_shard` grant, or free Spares. The Relay still costs exactly 2 `iron_scrap` + 1 `oak_wood` and grants `cap_power_1`. Locker and ledger still grant zero items.

**Important limitation:** `stone_pick`, `iron_pick`, and `salvage_hammer` are currently **UNWIRED_A0**. Crafting them changes inventory/custody, but the pinned A0 harvest path does not check or wear them. The actually wired useful outputs in this increment are the paid station kits, Relay power capability, permanent recipe knowledge, and the physical tool instance as a conserved crafted product. Tool gameplay effect requires the A0 host contract below.

## What changed in V5

1. **No-Core chain defect fixed.** Native case 23 no longer assumes A0 `iron_vein` yields `iron_ore`; the pinned A0 catalog yields `iron_scrap`. The chain now uses scrap smelting, one-time crates, live A0 scrap/oak/stone/reed nodes, and explicit basic-tool research pricing. It no longer requires seven forced cache claims or `tech_smelting`/`smelt_ore` for the basic pick.
2. **Two A1 roadside crates bound as one-time early salvage.** Crate 02 (`si:r_ashen_crown:roadside_supply:02`, stand `(400,217)`) grants 3 `iron_scrap` + 2 `knowledge_spares` once. Crate 03 (`si:r_ashen_crown:roadside_supply:03`, stand `(402,221)`) grants 2 `oak_wood` + 1 `research_notes` once. `max_claims=1`, cooldown 0, exhausted projection, no renewable abundance inflation.
3. **Canonical first-hour rates preserved.** Cache remains 3 scrap + 2 spares / 1800 active s. Notes crate 01 remains 1 note / 1800 active s. Deadfall remains 2 oak / 300 active s. Relay remains 2 scrap + 1 oak. Locker/ledger remain zero-item capability actions.
4. **Basic-tool research policy made explicit.** `iron_pick.research_cost = {knowledge_spares:3, research_notes:1}`. Default targeted research remains 6 spares + 2 notes for recipes without an override. This is catalog data, not a UI flag, and it separates basic tool learning from advanced/Core research.
5. **One-time source semantics added.** Adapter/service/Python oracle reject `max_claims>0` with nonzero cooldown, reject source/binding `max_claims` drift, return `ALREADY_APPLIED` for exhausted sources, and expose `exhausted`/`max_claims` in the read-only A6 projection.
6. **Tool effect forensics published.** `A0_TOOL_HOST_CONTRACT_V5.json` marks picks/hammer `UNWIRED_A0`, pins current A0 PR #21 head `69070a1138730536050053c5aa47334b7b2c3836`, and specifies the smallest atomic read-only plan + same-candidate commit contract. No capability is invented.
7. **Pacing lower-bound model added.** `progression_v5.py` computes 20/45/90/180-minute envelopes for explore-first and home-first using pinned A3 costs, A0 node yields, A1 corridor waypoints, and Knight walk speed. It is `MODEL_ONLY`, not a player journey, not collision-verified BFS, and not human approval.

## Canonical authority unchanged

| Source/action | Reward/cost | Cooldown | Key |
|---|---:|---:|---|
| Waystation locker | `cap_salvage`, **0 items** | one-time | `a1slice:poi_crown_waystation:pry_locker:1` |
| Waystation ledger | `cap_seal_1`, **0 items** | one-time | `a1slice:poi_crown_waystation:seal_ledger:1` |
| Waystation cache | 3 `iron_scrap` + 2 `knowledge_spares` | 1800 active s | `a1slice:poi_crown_waystation:cache_restock:{claim_index}` |
| Approach deadfall | 2 `oak_wood` | 300 active s | `a1slice:poi_crown_waystation:gather_deadfall:{claim_index}` |
| Relay hand-crank | costs 2 `iron_scrap` + 1 `oak_wood`; grants `cap_power_1` | one-time | `a1slice:poi_crown_relay_shed:hand_crank_bypass:1` |
| Roadside notes crate 01 | 1 `research_notes` | 1800 active s | `a3src:r_ashen_crown:roadside_supply:01:claim:{claim_index}` |
| Roadside crate 02 | 3 `iron_scrap` + 2 `knowledge_spares` | **one-time**, no replenish | `a3src:r_ashen_crown:roadside_supply:02:claim:{claim_index}` |
| Roadside crate 03 | 2 `oak_wood` + 1 `research_notes` | **one-time**, no replenish | `a3src:r_ashen_crown:roadside_supply:03:claim:{claim_index}` |

The old extra locker reward must never return. No Core probability, free Core, Gold value, or new renewable Spares grant is introduced.

## A0-ready atomic adapter boundary

A0 owns runtime/production mounts, SaveService, the pausable active-session clock, discovery, hero position, and physical interaction nodes. A3 owns item/source/research truth and the pure adapter. A0 must:

1. Refresh vendored A3 service/adapter and pins from `verification/v5/a3_sha256.txt`.
2. Mount `data/survival/items/world_source_bindings.v3.json` unchanged, including one-time crates 02/03.
3. Provide `configure_world_host(Callable)` returning `soh.economy.world_host.v1` with `poi_id`, `discovered`, `hero_cell` (`Vector2i` or `[int,int]`), `active_seconds`, `session_id`, `session_index`, `sequence`, `world_revision`. Optional identity fields are checked against the pinned binding when present.
4. Route one physical A1 intent to `world_action({poi_id, action_id, instance_id?}, event_id)`. The request may contain **only** those fields. Costs, rewards, cooldown, generation, capability, and receipt are derived from the binding and host, never from UI flags.
5. Call `advance_world_time(poi_id, event_id)` from the pausable world clock. Max quantum 3600 active seconds; new sessions baseline the host and preserve remaining cooldown. No offline catch-up.
6. For tool effects, implement `A0_TOOL_HOST_CONTRACT_V5.json`: A3 returns a read-only tool-use plan; A0 applies condition/revision inside the **same** SaveService harvest candidate. If atomic tool-use + harvest is unavailable, reject the swing.

Save namespace remains `world_slice` inside the same SaveService candidate as inventory. There is no second save authority, side journal, or A3 inventory service.

## A6 read-only state contract

`world_projection(poi_id)` returns:

- undiscovered: `{poi_id, visibility:"HIDDEN", sources:[], actions:[]}`;
- discovered: `{poi_id, visibility:"DISCOVERED", state, capabilities, active_seconds, sources[], actions[]}`.

Each source exposes canonical identity, `claim_count`, `max_claims`, `exhausted`, `ready`, `remaining_active_seconds`, `cooldown_active_seconds`, requirements, and deterministic rewards. One-time exhausted sources are not shown as cooling down. A6 sends intents only; it never receives the mutator, host receipt, or authority to set `ready`.

## Pacing evidence scope

`progression_v5.py` lower bounds at the current code SHA:

- 20-minute milestone (`stone_pick` + paid workbench + first harvest loop): ~37 s model lower bound.
- 45-minute milestone (paid furnace + `research_kit` + first note): ~273 s model lower bound.
- 90-minute milestone (`iron_pick` learned + crafted): ~2202 s model lower bound, including one 1800 s active cache wait.
- 180-minute milestone (repeat cache/deadfall, Relay, surplus, safe return/storage): ~4017 s model lower bound.

These are deliberately lower bounds: they exclude UI reading, combat, navigation detours, failed attempts, and human decision time. They replace the old case-23 arithmetic of seven cache claims / six forced 1800 s waits / 10,800 active s as the **only** modeled route. They are not playtest approval.

## A0 tool host contract — UNWIRED

Current A0 evidence at PR #21 head `69070a11`:

- `SurvivalService.harvest(node_id, kind, now_unix=-1)` has no tool parameter.
- `SurvivalResourceNode.interact(player)` calls `harvest(node_id, resource_kind)` with no tool instance.
- No A0 harvest/obstacle/action consumes or checks `stone_pick`, `iron_pick`, or `salvage_hammer`.

Smallest exact contract is in `A0_TOOL_HOST_CONTRACT_V5.json`. Acceptance requires native A0 tests for bare-hand refusal, owned-tool success, broken/stale/foreign tool refusal, full-bag no-wear, reload preservation, two-process revision safety, and A6 read-only condition display.

## A8 Quarry ruling

**REJECTED_PENDING_EVIDENCE_FAIL_CLOSED.** A8 PR #26 head `c8b4bc881d6744bac0f0826a639624ee1434e534` is pinned. A3 does not authorize `brace_east_shelf`, `chock_west_ramp`, or `extract_outcrop`. Precise evidence list:

1. durable A1/A0 physical site instance for `poi_crown_south_quarry`;
2. native two-route collision/reload proof for east brace, west chock, and leave-unworked;
3. A3 net-yield model comparing route cost + travel/exposure against existing stone/oak sinks and sources;
4. site-bound active-time replenishment authority, not wall-clock or fixture memory;
5. human pacing evidence that the Quarry is a meaningful return trip, not a filler toll.

A7 BLK-5 remains open by design. No guessed 1-item price or filler POI grant is issued.

## Verification

Local at code SHA `692128aa`:

- 47 Python tests OK, including V5 one-time crate, research override, tool-contract, and pacing negatives.
- Validator PASS: 56 items / 36 recipes / 5 techs / 40 sources / 7 stations / 5 bindings / 3 actions; 0 errors/cycles; `NOT_HUMAN_PLAYTESTED`; `A0_A1_A4_PENDING`.
- Conservation fixture `simulate_economy.py` PASS; immutable historical fixture preserved.
- Product progression model remains `SIMULATION_ONLY`; V5 pacing model is `MODEL_ONLY`.
- tree-sitter GDScript parse: 0 ERROR nodes in service, adapter, adapter test, restart test (syntax only, not native execution).
- Logs: `verification/v5/`.

Native Godot: runs `41036542096` (push) and `41036550568` (pull_request) for `692128aa` are **queued** at this checkpoint. A local headless Godot 4.7 engine is being built from official MIT-licensed source `5b4e0cb0fd279832bbdd69fed5354d4e5ad26f88` to execute the adapter/restart suites while hosted runners are blocked. **No native PASS is claimed until an exact-SHA run completes green.**

## R0–R5

- **R0 primary source:** A1/A0/A8 pins re-read; A0 current head still lacks tool wiring; A1 pinned files byte-identical at `939720d5`.
- **R1 patch forensics:** V5 diff limited to A3 allowed paths; no A0/A1/A4/A6 production edits; stale `9f617946` placeholder removed.
- **R2 adversarial oracles:** one-time exhaustion, max_claims drift, renewable-rate drift, research override default, UI spoof, replay/conflict, cooldown/quantum/session negatives authored.
- **R3 real Godot + visual:** native execution pending; local engine build in progress; no visual/player-journey claim.
- **R4 systemic/14-day value:** pacing lower-bound model and source/sink graph updated; long-session disk benchmark and human systemic value remain unproven.
- **R5 binary verdicts:** `ACCEPTED_SCOPED_ENGINEERING` only after native green; currently `SOURCE/CONTRACT_PASS_SCOPED`, `PLAYER-PROGRESSION_NOT_PROVEN`, `NATIVE_PENDING`, `A0_MOUNT_HOLD`, `TOOL_EFFECT_UNWIRED`.

## NEXT_ATOMIC_ACTION

A0: mount the five A3 world bindings (including one-time crates 02/03) in the physical overworld, wire `world_action`/`advance_world_time` to real Knight interaction and pausable active time, then implement the atomic tool-use host contract. A3 will rerun native adapter + two-process restart at the resulting integration SHA and update PR #19. Do not merge PR #19 before owner gates and native evidence.
