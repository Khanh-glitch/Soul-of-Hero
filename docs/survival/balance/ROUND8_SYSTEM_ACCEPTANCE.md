# Round 8 — system acceptance: 14 days, Ragnarok, two economies

_Executed 2026-10-30 against composition `03887d9bebf4` with a real Godot
`4.7.stable.custom_build` built from `godotengine/godot@4.7-stable`
(editor target, headless). Every verdict below is a line from
`data/survival/balance/results/native_runs.v1.json`, produced by
`python3 tools/survival/balance/run_native.py --composition refs/comp/full --write`.
Logs are in `.artifacts/native_runs/03887d9bebf4/` and are hashed into the ledger.

This round is not another dashboard. Three things are new and executable: a
composition tool that pins exact owner bytes, a probe family that judges the
*system* instead of a module, and a native run that actually happened.

## 1. The composition, exactly

`tools/survival/balance/compose.py` builds an immutable commit from live owner
refs. A file's owner is decided by path prefix, `merge` vs `replace` is declared
per prefix (A0 vendors a *stale* copy of A3's economy service, so replacing that
directory silently breaks the runtime), and every file records
`{path, owner, source_sha, blob}`. Re-running the tool reproduces the same SHAs.

| profile | commit | files | overlays |
|---|---|---|---|
| `a0` | `3ade72538c04` | 5148 | — |
| `world` | `f617cc20436a` | 5442 | a1, a8 |
| `economy` | `2dbc5623a5b2` | 5162 | a3 |
| **`full`** | **`03887d9bebf4`** | **5475** | **a1, a3, a6, a8** |

Sources: A0 `arena/dea2428e` `8750fd8a` · A1 `arena/e385312a` `178a5ba2` ·
A3 `arena/7a12b27e` `a5d11141` · A6 `arena/443f004f` `63d3fae5` ·
A8 `arena/2d7e6d7a` `54c66b89` · AVFX `feature/vfx-lab-gate0` `abf7bdc8`
(reference only, never overlaid) · control tower
`docs/ct-loot-discovery-gate-20261030` `971e0b95`. Manifest:
`data/survival/balance/results/compositions.v1.json` (digest level; the 5 MB
per-file provenance rows are reproducible with
`compose.py --all --write <dir>`, so they are not committed).

## 2. Result at a glance

| verdict | count | what it means |
|---|---|---|
| PASS | 2 | executed and asserted, on this composition |
| FAIL | 3 | implemented and violated — a real defect |
| BLOCKED | 0 | nothing was unmeasurable |
| RED_NOT_IMPLEMENTED | 10 | the rule does not exist; the exact missing symbol is named |

Round 7 on frozen `f3556747` had 0 PASS · 3 FAIL · 6 RED and judged only A0. This
is the current production composition and it includes 261 A1 world files, A3's
economy, A6's HUD and A8's POI surface.

## 3. B0 status — the first hour

`first_hour_route_probe.gd`, `bed_death_bag_probe.gd` and
`avatar_body_probe.gd` each run **34 checks, 33 of which pass**, and all three
fail on the *same* check:

```
FAIL  ordinary placement input pays for the physical workbench
NORMAL_BUILD_TRACE target=(29,185) world=(472.0,2968.0) window=(27.17,27.99)
  preview=(12,168) mouse_view=(0.0,0.0)
  hovered=ClickBlocker:<Control#614297790347> rejection=solid_terrain kit=1
```

The player manufactures the kit, selects it as the build input, and stands on
reachable ground — but the pointer ray hits a HUD `ClickBlocker` control and the
placement is rejected as `solid_terrain`. **B0 remains `NOT_CLAIMED`**, and for a
sharper reason than round 7: the chain now breaks at one identified control-vs-world
ray bug, not at "the GUI never reserves anything".

**A save does survive a new OS process.** `r_persistence_probe.gd` writes through
`SaveService` in process A, spawns process B (different PID, verified), and reads
back: a `tutorials` flag returns `true` and an inventory grant returns `987.0` for
the int `987`. The float spelling is accepted as the same number; the probe also
shows the save refuses `1234567` in one stack, so quantities are bounded rather
than silently truncated. 13 checks, PASS.

## 4. D055–D067 coverage

| rule | probe | verdict | evidence |
|---|---|---|---|
| D055 336 h maximum, D066 abandon ≠ logout/death, no manufactured victory | `r055_season_probe.gd` | RED | A3's planner ships `RUN_SECONDS := 1209600` and rejects any other expiry as `run_expiry_not_14_real_days` (13-day and 15-day projections both refused, 13 checks). A0's save has **no** run namespace at all: `save_namespace_keys` = `applied_transactions … tutorials`, no `run_id`, no expiry constant, no finalize/abandon entry point. No aggregate `journey_score`/`season_score` symbol exists (guard passes). |
| D056 persistence categories | `r055`, `r063` | RED | `profile.secured_ragnarok_currency` does not exist; none of `achievements` / `run_history` / `secured_ragnarok_currency` are present in the save. |
| D057 profile → Home → paid door → harvest → workbench | journey probes | FAIL | see §3: 33/34 checks pass; placement ray is blocked by a HUD control. |
| D058 hazards are dangers + supplies, not walkable cells | `d058_random_spawn_probe.gd`; `r_goals` | RED (2 missing) / data PASS | A1 authors 10 hazards with severity 2–4, all naming the capability that handles them, 3 inside the starter quarter, and `poi_route_graph` gates 33 edges behind `cap_filter`. No run-start selector exists, and the spawn is a single authored cell. |
| D059 shelter vs wilderness offline death | `d059_offline_hunger_probe.gd`, `r060` | RED | A3's policy **forbids** A3 from mutating HP/hunger and disables cultivation/collectors; A0 has no `satiety`/`hunger`/`hp`/`last_seen_at_unix` in the save, so the settlement has nowhere to land. |
| D060 continuous clock, finite prepared work, no ACTIVE-only credit | `r060_offline_time_probe.gd` | RED (1 missing, 1 FAIL) | Real: policy validates (`policy_error=""`), ACTIVE-only list has 3 source ids, `forbidden_offline_effects` names HP/hunger, monster raids, free materials, source-cooldown credit; state validator refuses schema≠1, negative high-water, fractional high-water, non-numeric sequence, non-string run id; a lossless `1000000.0` is **accepted**. |
| D061 trace-based home discovery | `d061_trail_probe.gd` | RED | no trail state and no mounted hostile to target a home, so the rule has nothing to gate yet. |
| D062 six awakened elders / six stones / sealed manifestations / 264 h & 312 h phases | `r062_stones_probe.gd` | RED (3 missing) | no `awakened_elder`, `elder_boss`, `elder_territory`, `achievement_stone`, `evacuation_point` or `evacuate_run` identifier in `game/` or `data/`; no `ragnarok` phase field. A1's 11 regions name no elder territory, so the six bosses have no authored home. |
| D063 losable currency, deposit only at a physical endpoint | `r063_currency_custody_probe.gd` | RED (2 missing) | no currency token, deposit endpoint, vending or recycler symbol in `game/`. |
| D064 fixed vending, recycler not a money printer | `r063` | RED | same absence; A7's model below defines the invariants. |
| D065 evacuation ≠ abandonment | `r062` | RED | no evacuation symbol; the model below separates them. |
| D067 broad safe spawn, melee-only viability | `r_goals`, `d058` | data PASS / RED runtime | 32 POIs and 21 of 123 route nodes are reachable **with no capability at all**, offering 12 material kinds and 4 of them (`timber`, `stone`, `iron`, `salvage`) plus `burn_charcoal` → `smelt_iron` with no research gate. |

## 5. The 14-day / Ragnarok / currency / stone / evacuation results

* **14 days:** the arithmetic exists once, in A3, and is enforced (`1209600 s`,
  reject-by-name on 13 or 15 days). It is **unreachable from play**: the adapter
  A0 actually loads (`vendor/a3_economy_service.gd`, 72 967 B, 78 methods) lacks
  `plan_offline_operations`, `forecast_offline_food` and
  `apply_offline_operation_plan`, all of which exist in A3 live (82 907 B, 87
  methods). Two probes report this as FAIL, not as a footnote.
* **Ragnarok:** nothing. No phase field, no 264 h boundary, no 312 h catastrophe,
  no elder. A run cannot reach its finale because a run cannot begin.
* **Currency:** nothing. No token, no carry, no deposit endpoint, no vendor, no
  recycler. `profile.secured_ragnarok_currency` is not a save category.
* **Stones:** nothing. Six is a decision with no artifact behind it.
* **Evacuation:** nothing, and D065's narrow consequence
  (`evacuation_finalizes_run`) is deliberately left `null` in the tuning file
  rather than guessed.

## 6. Corruption proofs

Two kinds, kept apart on purpose.

**Real product refusals (executed):** `r055` corrupts A3's live policy — a 13-day
deadline → `invalid_run_deadline`; a claimed user rate approval →
`invalid_policy_identity_or_rate_approval`; `auto_collect` and
`auto_start_next_queue` → `forbidden_automation`; a non-list ACTIVE-only field →
`invalid_policy_list:active_only_sources_unchanged`. `r060` corrupts planner state
→ `unsupported_offline_schema`, `invalid_offline_high_water` (negative **and**
fractional), `invalid_offline_sequence`, `invalid_offline_state`; corrupted world
calendars → run mismatch, regressed world time, missing identity, rate overclaimed.
`r_persistence` proves a replayed transaction key is refused and an implausible
stack is refused. **Lossless `1000000.0` is accepted**, so an int/float re-parse is
never reported as loss.

**Acceptance-model refusals (labelled `MODEL_ORACLE`, product status unchanged):**
`r063` attacks a state machine with the ten named cases — chest deposit without a
bank (`not_at_bank`), carrying without owning, storing inside the run and losing
it, one recovery bag (a second death replaces, not stacks), physical deposit,
multiple deposits additive, replay (`duplicate_deposit`), loss at expiry **and**
abandon with zero payout, only the secured balance crossing the reset, old tokens
unable to pay twice, fixed-price purchase (`not_at_vendor`, `insufficient`, no
change minted), recycler refusing a payout above goods' worth and capped by the run
faucet, and conservation of every unit across bank + purse + spent. `r062` refuses
evacuation from the wrong place, evacuation without a route trace, and a second
terminal state; stones never pay currency.

## 7. Counterfactual journeys (Phase 4)

Eight journeys scored on shipped data (`r_goals_counterfactuals_probe.gd`, PASS,
15 checks): first-hour melee scavenger, home-oriented survivor, explorer to a rare
Core, Ragnarok scavenger, one-stone, six-stone, evacuee, early restarter. Real
numbers only: 118 POIs, 130 edges, 27 material kinds, 15 Core sites in 10 regions
(all `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`), 10 preserved legacy dungeon doors.

Dominance found on the declared weights:
`explorer_rare_core > ragnarok_scavenger`, `first_hour_melee_scavenger > evacuee`,
`first_hour_melee_scavenger > early_restarter`. Two of those are healthy (a
first-hour player beats giving up). The first is not: **as authored, exploring
early strictly beats scavenging during the finale**, because nothing in the last
72 hours pays better than a Core found on day 2. That is a design question for the
creator, and it is exactly what the "do days 1–11 change days 12–14?" test was for.
Investment does beat restarting (`durable` 0.40 vs 0.10).

Weights live in `data/survival/balance/ragnarok_tuning.v1.json`; every value is
classed `LOCKED_USER` (336 h, 72 h, 24 h, six elders, six stones, sealed
manifestations, physical banking, no recycler money, no auto victory),
`DERIVED_ARITHMETIC` (264 h, 312 h) or `AI_TUNABLE` (danger curve, drop weights,
bank-trip minutes). No AI number is presented as a decision.

## 8. Highest-value owner fixes, in order

1. **A0/A6 — placement ray vs HUD.** One blocker stops all three first-hour
   journeys: `hovered=ClickBlocker … rejection=solid_terrain`. Filter HUD controls
   out of the world placement ray.
2. **A0 — re-vendor A3's economy service.** A0 ships 9 exported functions fewer
   than A3 live, including every offline-operations entry point. The 14-day
   arithmetic physically cannot reach the runtime until this is re-vendored.
3. **A0 — a durable run record.** `run_id`, `run_started_at_unix`,
   `run_expires_at_unix = start + 1209600`, plus `finalize_run` / `abandon_run`
   writing one terminal receipt, and `profile.secured_ragnarok_currency` as the
   third permitted persistent category.
4. **A1/A4 — six elder territories in the eleven regions**, each with a genuine
   approach route, a sealed manifestation before 264 h and one unique stone.
5. **A0/A3 — currency custody**: token ids, a physical deposit endpoint writing
   only to the secured balance, fixed-price vending, a bounded recycler.
6. **A0 — satiety/HP + `last_seen_at_unix`** so A3's planner has a settlement
   target, and a run-start selector so D058's random spawn is possible.

## 9. What the player can actually do on `03887d9bebf4`

| The player can | The player cannot |
|---|---|
| boot, choose a profile, reach the Home map and enter the survival overworld | place a paid workbench on reachable ground — the HUD intercepts the placement ray |
| gather authored scrap and oak, manufacture a kit, select it as a build input | place the station, so the first-hour chain still stops short of a station |
| play a 34-check journey that passes 33 of its own assertions | start a 14-day run, see a Ragnarok phase, bank currency, meet an elder or evacuate |
| save and recover state across a genuine second OS process | see the new authored world: 108 of 118 POIs are plan-only, 10 are preserved legacy doors |

## 10. R0–R5

| level | state |
|---|---|
| **R0** compiles and boots | **yes** — real Godot 4.7, headless, 15 probes executed |
| **R1** the journey runs | **no** — station placement refused (see §3) |
| **R2** the run exists | **no** — no run record; A3's clock is correct but unreachable |
| **R3** the finale exists | **no** — no elders, phases or stones |
| **R4** the two economies hold | **no** — no currency; invariants proven only as an A7 model |
| **R5** the 14-day experience is coherent | **no** — days 12–14 are gated on R2–R4 |

What is real at the end of this round: a reproducible composition, a real engine,
a ledger whose every line came from a process that exited, and one specific
first-hour defect instead of a status word.
