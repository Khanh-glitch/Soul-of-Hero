# A7 R14 — cross-system player-capability certification

**Overall: `FAIL`** · composition `f6d5cf789995` · maturity **TEST_HARNESS_VALID**

| track | verdict | cases |
|---|---|---|
| T1 | **FAIL** | T1.1=PASS, T1.2=FAIL, T1.3=BLOCKED, T1.4=FAIL, T1.5=BLOCKED, T1.6=BLOCKED |
| T2 | **FAIL** | T2.1=BLOCKED, T2.2=BLOCKED, T2.3=FAIL, T2.4=BLOCKED, T2.5=BLOCKED, T2.6=BLOCKED |
| T3 | **FAIL** | T3.1=BLOCKED, T3.2=FAIL, T3.3=BLOCKED, T3.4=BLOCKED, T3.5=PASS, T3.6=PASS, T3.7=PASS, T3.8=PASS, T3.9=BLOCKED, T3.10=BLOCKED |
| T4 | **BLOCKED** | T4.1=NOT_IMPLEMENTED, T4.2=NOT_IMPLEMENTED, T4.3=NOT_IMPLEMENTED, T4.4=BLOCKED, T4.5=NOT_IMPLEMENTED, T4.6=BLOCKED, T4.7=NOT_IMPLEMENTED, T4.8=BLOCKED |

Cases: 30 · PASS 5 · FAIL 4 · BLOCKED 16 · NOT_IMPLEMENTED 5

## Cases

| id | verdict | code | owner | stage | title |
|---|---|---|---|---|---|
| T1.1 | **PASS** | `COMPOSITION_IDENTITY` | A7 | source | one exact immutable composition |
| T1.2 | **FAIL** | `SIDECAR_WORLD` | A0 | source | one authoritative world (no rendered sidecar) |
| T1.3 | **BLOCKED** | `BLOCKED_NO_SPAWN_EVIDENCE` | A0 | runtime | player spawns safely on the authored continent |
| T1.4 | **FAIL** | `SITE_OUTSIDE_LIVE_WORLD` | A0 | source | canonical POI approaches lie inside the playable world |
| T1.5 | **BLOCKED** | `BLOCKED_MISSING_BOOTSTRAP_CONTROL` | A7 | runtime | input bootstrap is diagnosed as harness config, not A1 fault |
| T1.6 | **BLOCKED** | `BLOCKED_NO_MOVEMENT_RUN` | A0 | runtime | physical movement and collision with normal input |
| T2.1 | **BLOCKED** | `BLOCKED_NO_ENTRY_RUN` | A8 | source | two canonical sites ship real scenes |
| T2.2 | **BLOCKED** | `BLOCKED_NO_ROUTE_RUN` | A0 | runtime | ordinary route from spawn to each site |
| T2.3 | **FAIL** | `NO_KNIFE_ITEM` | A3 | source | knife-first exploration is possible |
| T2.4 | **BLOCKED** | `BLOCKED_NO_EARNED_EVIDENCE` | A7 | receipt | no fixture credential counts as player-earned capability |
| T2.5 | **BLOCKED** | `BLOCKED_NO_REVISIT_RECEIPT` | A8 | receipt | safe retreat and durable revisit with the same identity |
| T2.6 | **BLOCKED** | `BLOCKED_NO_BLOCKED_ACCESS_RUN` | A8 | contract | deeper access is genuinely blocked before preparation |
| T3.1 | **BLOCKED** | `BLOCKED_NO_HARVEST_RUN` | A3 | source | authentic finite source → inventory |
| T3.2 | **FAIL** | `TOOL_WEAR_ABSENT` | A0 | source | tool wear and inventory limits are enforced |
| T3.3 | **BLOCKED** | `BLOCKED_NO_RESEARCH_RUN` | A3 | source | three distinct research methods are real and distinguishable |
| T3.4 | **BLOCKED** | `BLOCKED_NO_CRAFT_RUN` | A3 | source | recipe sinks exist for what the sources produce |
| T3.5 | **PASS** | `ESCROW_MISMATCH_REFUSED` | A3 | contract | owner-string-only source authentication is refused |
| T3.6 | **PASS** | `FUEL_REQUIRED` | A3 | contract | missing physical fuel fails a job |
| T3.7 | **PASS** | `DUPLICATE_REFUSED` | A0 | contract | duplicate job ids and early claims are refused |
| T3.8 | **PASS** | `STALE_RUN_REFUSED` | A0 | contract | stale run and expired window are refused |
| T3.9 | **BLOCKED** | `BLOCKED_NO_2PID_RECEIPT` | A0 | receipt | funded job completes in a separate process, exactly once |
| T3.10 | **BLOCKED** | `BLOCKED_NO_OUTCOME_RUN` | A3 | outcome | the payoff changes a later choice |
| T4.1 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | Core can be carried, used and stored |
| T4.2 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | AVFX | runtime | a physical Core gates research |
| T4.3 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | trace-based threat and bag recovery |
| T4.4 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | the 336-hour run ends and resets |
| T4.5 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | last72 Elder territory transformation |
| T4.6 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | physical chest-sourced Ragnarok cash |
| T4.7 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A3 | runtime | multiple fixed-site deposits |
| T4.8 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | evacuation and complete run-local wipe |

## First failure

`T1.2` · **SIDECAR_WORLD** · owner **A0**

runtime 384x256 != authored 1024x768; A0's mount declares the authored stream runs beside the legacy world; 3 A8 site(s) outside the live world: poi_crown_south_quarry(30, 280), poi_crown_south_orchard(140, 360), poi_crown_south_mill(120, 300)

repro: `game/survival/a0_authored_world_mount.gd:12,29`

## First blocker

`T1.3` · **BLOCKED_NO_SPAWN_EVIDENCE** · owner **A0**

requires `A7C T1.3 {…}` from tests/survival/a7_certification_probe.gd

repro: `godot --headless --script res://tests/survival/a7_certification_probe.gd`

## Evidence per case

### T1.1 — PASS `COMPOSITION_IDENTITY`
the declared tree reproduces byte for byte
- declared tree=f6d5cf789995
- recomputed tree=f6d5cf789995 (git-write-tree)

### T1.2 — FAIL `SIDECAR_WORLD`
runtime 384x256 != authored 1024x768; A0's mount declares the authored stream runs beside the legacy world; 3 A8 site(s) outside the live world: poi_crown_south_quarry(30, 280), poi_crown_south_orchard(140, 360), poi_crown_south_mill(120, 300)
- live runtime world bounds (384, 256) (data/overworld/hollow_marches.json)
- A1 authored frame (1024, 768) (game/survival/a1_authored_source.gd:30)
- sidecar markers ['render_legacy := true']
- A0 poi-mount refusal `A0_WORLD_ABSENT` (game/survival/a0_poi_mount.gd:69)

### T1.3 — BLOCKED `BLOCKED_NO_SPAWN_EVIDENCE`
requires `A7C T1.3 {…}` from tests/survival/a7_certification_probe.gd
- game/survival/world/a1_authored_world_reader.gd:1011: func choose_safe_spawn(run_seed: int) -> Dictionary:

### T1.4 — FAIL `SITE_OUTSIDE_LIVE_WORLD`
3/3 canonical sites cannot be approached; package_status=A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED
- poi_crown_south_quarry (30, 280) scene=res://game/survival/world_content/scenes/south_quarry.tscn
- poi_crown_south_orchard (140, 360) scene=res://game/survival/world_content/scenes/south_orchard_ruin.tscn
- poi_crown_south_mill (120, 300) scene=res://game/survival/world_content/scenes/south_crown_mill.tscn

### T1.5 — BLOCKED `BLOCKED_MISSING_BOOTSTRAP_CONTROL`
both a pre-bootstrap and a bootstrapped run must be recorded
- before={}
- after={}

### T1.6 — BLOCKED `BLOCKED_NO_MOVEMENT_RUN`
requires `A7C T1.6 {"input_moves":true,"collision_blocks":true}` from a real player walk on the composed tree
- game/survival/gameplay_input_gate.gd:92: var result := Input.get_vector("move_left", "move_right", "move_up", "move_down")

### T2.1 — BLOCKED `BLOCKED_NO_ENTRY_RUN`
scenes exist; nobody has physically entered them
- scenes: ['fourth_salt_lookout_test.tscn', 'native_poi_shell_template.tscn', 'native_poi_template.tscn', 'poi_pilot.tscn', 'south_crown_mill.tscn', 'south_crown_mill_overworld.tscn', 'south_orchard_ruin.tscn', 'south_orchard_ruin_overworld.tscn', 'south_quarry.tscn', 'south_quarry_overworld.tscn']
- present for ['south_orchard', 'south_quarry'] of ['south_orchard', 'south_quarry']

### T2.2 — BLOCKED `BLOCKED_NO_ROUTE_RUN`
requires a walked route marker per site; a teleport into a POI interior is not a route and is rejected by this harness
- poi_crown_south_quarry cell=(30, 280)
- poi_crown_south_orchard cell=(140, 360)
- poi_crown_south_mill cell=(120, 300)

### T2.3 — FAIL `NO_KNIFE_ITEM`
P3 (knife-first) cannot be played: no knife exists in the item catalog
- 57 item ids; knife-like=[]

### T2.4 — BLOCKED `BLOCKED_NO_EARNED_EVIDENCE`
requires `A7C T2.4 {"fixture_grants":0,"player_earned":true}` from the run that claims the capability
- marker={}

### T2.5 — BLOCKED `BLOCKED_NO_REVISIT_RECEIPT`
requires an exit+return receipt for the same site_instance_id in a second process
- game/survival/a0_poi_mount.gd:158: func finish_transition(save: Node, site_instance_id: String) -> Dictionary:
- game/survival/a0_poi_mount.gd:168: return {"ok": false, "reason": "A0_RUN_IDENTITY_MISMATCH"}

### T2.6 — BLOCKED `BLOCKED_NO_BLOCKED_ACCESS_RUN`
gates are declared; no run shows the player actually refused at the threshold
- 7 production_mount_gates declared
- package_status=A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED

### T3.1 — BLOCKED `BLOCKED_NO_HARVEST_RUN`
bindings exist; no real harvest receipt in this composition
- world_source_bindings.v3.json declares 5 entries
- data/survival/items/world_source_bindings.v3.json:85: "source_id": "road_scrap",
- data/survival/items/world_source_bindings.v3.json:95: "source_id": "road_supplies",

### T3.2 — FAIL `TOOL_WEAR_ABSENT`
no wear model exists to certify
- no durability/tool-wear symbol in game/survival

### T3.3 — BLOCKED `BLOCKED_NO_RESEARCH_RUN`
three escrow shapes exist; no player has spent them
- blueprint -> game/survival/economy/offline_operation_planner.gd:279
- specimen -> game/survival/economy/offline_operation_planner.gd:280
- targeted -> game/survival/economy/offline_operation_planner.gd:278

### T3.4 — BLOCKED `BLOCKED_NO_CRAFT_RUN`
sinks are declared; nothing has been crafted from a real source
- progression_model keys=['assumptions', 'capability_bootstrap', 'capability_grant_policy', 'capability_pois', 'explicit_bootstrap_pois', 'hazard_mitigation', 'hazards', 'late_goals', 'novice_bootstrap', 'product_sources', 'purpose', 'route_network']
- sink sections=['capability_bootstrap', 'capability_pois', 'hazards', 'late_goals', 'route_network', 'shelter']

### T3.5 — PASS `ESCROW_MISMATCH_REFUSED`
the planner refuses mismatched escrow by name
- `arm_job_id_mismatch` at game/survival/economy/offline_operation_planner.gd:138
- `escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:498
- `fuel_escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:257
- `input_escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:255
- `invalid_recipe_escrow` at game/survival/economy/offline_operation_planner.gd:253
- `invalid_research_escrow` at game/survival/economy/offline_operation_planner.gd:271
- `offline_contract_mismatch` at game/survival/economy/offline_operation_planner.gd:175
- `offline_time_receipt_mismatch` at game/survival/economy/offline_operation_planner.gd:162

### T3.6 — PASS `FUEL_REQUIRED`
fuel escrow is enforced by name
- game/survival/economy/offline_operation_planner.gd:257

### T3.7 — PASS `DUPLICATE_REFUSED`
duplicate/once-only path present
- game/survival/economy/a0_offline_host.gd:17: ##     SaveService idempotency key, so a second process, a replay or an
- game/survival/economy/offline_operation_planner.gd:521: ## must first use proposal_id as the idempotent transaction key and re-check the
- game/survival/economy/a0_economy_adapter.gd:21: return {"ok": false, "reason": "untrusted_economy_mutator", "duplicate": false}

### T3.8 — PASS `STALE_RUN_REFUSED`
expiry/identity guards present
- game/survival/economy/offline_operation_planner.gd:316: result["reason"] = "run_id_mismatch"; return false
- game/survival/economy/a0_economy_composition.gd:93: if bool(_last_settle.get("run_expired", false)):

### T3.9 — BLOCKED `BLOCKED_NO_2PID_RECEIPT`
requires a second-OS-process settlement receipt with a duplicate refusal; the R13 O4 oracle rules apply unchanged
- game/survival/economy/a0_offline_host.gd:175: last_settle = {"ok": true, "reason": "nothing_to_settle", "duplicate": false,

### T3.10 — BLOCKED `BLOCKED_NO_OUTCOME_RUN`
requires a recorded before/after choice that the new material unlocked
- data/survival/recipes/progression_model.json:80: "route_network": {
- data/survival/recipes/progression_model.json:1758: "capability_pois": [

### T4.1 — NOT_IMPLEMENTED `FEATURE_ABSENT`
`core_use` does not exist in this composition, so the gate cannot run and nothing may be claimed for it
- no `core_use` symbol in game/survival

### T4.2 — NOT_IMPLEMENTED `FEATURE_ABSENT`
`core_research` does not exist in this composition, so the gate cannot run and nothing may be claimed for it
- no `core_research` symbol in game/survival

### T4.3 — NOT_IMPLEMENTED `FEATURE_ABSENT`
`threat` does not exist in this composition, so the gate cannot run and nothing may be claimed for it
- no `threat` symbol in game/survival

### T4.4 — BLOCKED `BLOCKED_NO_FEATURE_RUN`
`run_reset` symbols exist (game/survival/economy/a0_run_lifecycle.gd:58: or not save.has_method(&"get_snapshot") or not save.has_method(&"reset_run_preserving_profile"):); no runtime evidence
- game/survival/economy/a0_run_lifecycle.gd:58: or not save.has_method(&"get_snapshot") or not save.has_method(&"reset_run_preserving_profile"):

### T4.5 — NOT_IMPLEMENTED `FEATURE_ABSENT`
`last72_elders` does not exist in this composition, so the gate cannot run and nothing may be claimed for it
- no `last72_elders` symbol in game/survival

### T4.6 — BLOCKED `BLOCKED_NO_FEATURE_RUN`
`chest_currency` symbols exist (game/survival/chest_inventory_panel.gd:113: func open_chest(chest: SurvivalStructure, hero: Node2D, service: Node) -> bool:); no runtime evidence
- game/survival/chest_inventory_panel.gd:113: func open_chest(chest: SurvivalStructure, hero: Node2D, service: Node) -> bool:

### T4.7 — NOT_IMPLEMENTED `FEATURE_ABSENT`
`fixed_deposit` does not exist in this composition, so the gate cannot run and nothing may be claimed for it
- no `fixed_deposit` symbol in game/survival

### T4.8 — BLOCKED `BLOCKED_NO_FEATURE_RUN`
`evacuation` symbols exist (game/survival/economy/a0_run_lifecycle.gd:224: if reason not in ["expired", "voluntary_exit", "evacuation"]:); no runtime evidence
- game/survival/economy/a0_run_lifecycle.gd:224: if reason not in ["expired", "voluntary_exit", "evacuation"]:

