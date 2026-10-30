# D055–D061 contract matrix — `f3556747219a`

**Verdict.** `D_SERIES_NOT_ACCEPTABLE` — implemented 0, partial 1, absent 6.

| Decision | State | Owner | Missing requirements | Native probe |
|---|---|---|---|---|
| `D055` | `ABSENT` (0/3) | A0 | `durable_run_key`, `expiry_1209600`, `season_end_entry` | `d055_d057_season_probe.gd` |
| `D056` | `ABSENT` (0/3) | A0 (namespace) + A3 (reward scope) | `profile_achievements`, `run_history`, `season_reset_entry` | `d055_d057_season_probe.gd` |
| `D057` | `ABSENT` (0/2) | A0 (events) + A3 (rewards) + A6 (UI) | `quest_state`, `quest_receipt_run_scoped` | `d055_d057_season_probe.gd` |
| `D058` | `ABSENT` (0/2) | A1 (pool) + A0 (selection/persist) + A3 (survivability evidence) | `start_selector`, `eligible_cell_set` | `d058_random_spawn_probe.gd` |
| `D059` | `ABSENT` (0/4) | A0 (settlement/HP) + A3 (provisions) + A1 (shelter) + A6 (warning) | `satiety_state`, `hp_floor`, `offline_settlement`, `last_seen_at` | `d059_offline_hunger_probe.gd` |
| `D060` | `PARTIAL` (3/4) | A0 (clock) + A3 (queue bound) + A6 (return report) | `offline_clock_anchor` | `d060_world_time_probe.gd` |
| `D061` | `ABSENT` (0/2) | A0/A5 (trail + pursuit) + A1 (surfaces) + A6 (signs) | `trail_state`, `trail_decay` | `d061_trail_probe.gd` |

## D055 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `durable_run_key`: **no** — the run must be a persisted save key, not a local variable — —
- `expiry_1209600`: **no** — 14x24x3600 seconds must be enforced somewhere — —
- `season_end_entry`: **no** — a season must be able to end and a new one to begin — —

## D056 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `profile_achievements`: **no** — durable account achievements — —
- `run_history`: **no** — immutable result record per completed run — —
- `season_reset_entry`: **no** — the next run starts from zero; a combat `reset_run()` is not this — —

## D057 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `quest_state`: **no** — the starter chain must exist as state — —
- `quest_receipt_run_scoped`: **no** — paid once per run, not once ever — —

## D058 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `start_selector`: **no** — a run start must be chosen, not authored once — —
- `eligible_cell_set`: **no** — A1 must publish the candidate pool — —

## D059 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `satiety_state`: **no** — offline hunger needs a persisted hunger value — —
- `hp_floor`: **no** — the 1 HP shelter floor is a rule, not an accident — —
- `offline_settlement`: **no** — elapsed closure time must settle once — —
- `last_seen_at`: **no** — elapsed time needs a durable anchor — —

## D060 — PARTIAL

**May claim.** no acceptance claim: part of the rule is absent

- `world_clock_key`: yes — one persisted world timeline — `game/survival/economy/world_source_adapter.gd:122`
- `offline_clock_anchor`: **no** — online and offline intervals must share an absolute anchor — —
- `bounded_queue`: yes — prepared work must be inspectable — `game/survival/economy/economy_session.gd:392`, `game/survival/economy/vendor/a3_economy_service.gd:26`
- `fuel_bound`: yes — a queue without committed fuel must stop — `game/survival/economy/economy_panel.gd:108`, `game/survival/economy/economy_session.gd:444`, `game/survival/economy/vendor/a3_economy_service.gd:907`

## D061 — ABSENT

**May claim.** CONTRACT_ONLY / RED_NOT_IMPLEMENTED

- `trail_state`: **no** — home discovery needs a real player trail; a build-placement footprint is not one — —
- `trail_decay`: **no** — trails must fade or wash away — —
- guard `no_home_coordinate`: clean — FORBIDDEN: a monster must not store the home location — —

## Rejected near-misses (spoof ledger)

| Id | Decision | Symbol | Token in tree | Counts as satisfied | Why rejected |
|---|---|---|---|---|---|
| `SP-01` | `D061` | `game/survival/survival_build_system.gd` | yes | never | a build-placement tile footprint of a structure; no card, no decay, no monster reads it |
| `SP-02` | `D060` | `game/survival/economy/world_source_adapter.gd` | yes | never | matches `clock_seconds` only inside an error string, not a persisted clock key |
| `SP-03` | `D055` | `game/autoload/game_session.gd` | yes | never | in-memory combat campaign run id; save_service.gd has no run_id key, so no durable season run |
| `SP-04` | `D056` | `game/autoload/game_session.gd` | yes | never | resets score/sigils/checkpoint for a combat level; it does not start a season or keep a run history |
| `SP-05` | `D061` | `game/autoload/save_service.gd` | yes | never | a tutorial-completion flag, not a monster pursuing a detected trail |
| `SP-06` | `D060` | `game/survival/economy/vendor/a3_economy_service.gd` | yes | never | bounds one tick delta; it cannot settle an 18 h or 48 h absence because no absolute anchor is stored |
| `SP-07` | `D057` | `game/autoload/save_service.gd` | yes | never | the only `quest` occurrences are prose in comments; no quest state or quest receipt exists |
| `SP-08` | `D060` | `game/survival/economy/world_source_adapter.gd` | yes | never | monotonic accumulated in-game seconds advanced by session index; it carries no wall-clock anchor |

**Rule.** IMPLEMENTED means every required symbol exists in production code of this exact tree. It is not a native pass: the probe must still run and hold. ABSENT rows are CONTRACT_ONLY and must never be reported as accepted. Forbidden constructs are guards: they can only subtract from a row, never add to it. Every near-miss in `spoofs` was opened and rejected; it never counts as satisfied.
