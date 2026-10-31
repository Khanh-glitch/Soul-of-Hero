# A7 R14 — cross-system player-capability certification

**Overall: `FAIL`** · composition `f6d5cf789995` · maturity **TEST_HARNESS_VALID**

| track | verdict | cases |
|---|---|---|
| T1 | **FAIL** | T1.1=PASS, T1.2=FAIL, T1.3=BLOCKED, T1.4=FAIL, T1.5=PASS, T1.6=BLOCKED, T1.7=BLOCKED |
| T2 | **BLOCKED** | T2.1=BLOCKED, T2.2=BLOCKED, T2.3=BLOCKED, T2.4=BLOCKED, T2.5=BLOCKED, T2.6=BLOCKED |
| T3 | **FAIL** | T3.1=BLOCKED, T3.2=BLOCKED, T3.3=BLOCKED, T3.4=BLOCKED, T3.5=BLOCKED, T3.6=PASS, T3.7=PASS, T3.8=PASS, T3.9=BLOCKED, T3.10=BLOCKED, T3.11=FAIL |
| T4 | **BLOCKED** | T4.1=NOT_IMPLEMENTED, T4.2=NOT_IMPLEMENTED, T4.3=NOT_IMPLEMENTED, T4.4=BLOCKED, T4.5=NOT_IMPLEMENTED, T4.6=BLOCKED, T4.7=NOT_IMPLEMENTED, T4.8=BLOCKED |

Cases: 32 · PASS 5 · FAIL 3 · BLOCKED 19 · NOT_IMPLEMENTED 5

## Cases

| id | verdict | code | owner | stage | title |
|---|---|---|---|---|---|
| T1.1 | **PASS** | `COMPOSITION_IDENTITY` | A7 | source | one exact immutable composition |
| T1.2 | **FAIL** | `COMPOSITION_DROPS_OWNER_WORK` | A0 | source | one authoritative world (no rendered sidecar) |
| T1.3 | **BLOCKED** | `BLOCKED_LIVE_WORLD_UNRESOLVED` | A0 | runtime | player spawns safely on the authored continent |
| T1.4 | **FAIL** | `SITE_OUTSIDE_LIVE_WORLD` | A0 | source | canonical POI approaches lie inside the playable world |
| T1.5 | **PASS** | `INPUT_BOOTSTRAP_INDEPENDENT` | A7 | runtime | input bootstrap is diagnosed as harness config, not A1 fault |
| T1.6 | **BLOCKED** | `BLOCKED_NO_MOVEMENT_RUN` | A0 | runtime | physical movement and collision with normal input |
| T1.7 | **BLOCKED** | `BLOCKED_NO_NATIVE_EVIDENCE` | A0 | runtime | the authority script loads and instantiates in this engine build |
| T2.1 | **BLOCKED** | `BLOCKED_NO_ENTRY_RUN` | A8 | source | two canonical sites ship real scenes |
| T2.2 | **BLOCKED** | `BLOCKED_NO_ROUTE_RUN` | A0 | runtime | ordinary route from spawn to each site |
| T2.3 | **BLOCKED** | `BLOCKED_NO_MELEE_RUN` | A3 | source | knife-first exploration is possible |
| T2.4 | **BLOCKED** | `BLOCKED_NO_EARNED_EVIDENCE` | A7 | receipt | no fixture credential counts as player-earned capability |
| T2.5 | **BLOCKED** | `BLOCKED_NO_REVISIT_RECEIPT` | A8 | receipt | safe retreat and durable revisit with the same identity |
| T2.6 | **BLOCKED** | `BLOCKED_NO_BLOCKED_ACCESS_RUN` | A8 | contract | deeper access is genuinely blocked before preparation |
| T3.1 | **BLOCKED** | `BLOCKED_NO_HARVEST_RUN` | A3 | source | authentic finite source → inventory |
| T3.2 | **BLOCKED** | `BLOCKED_NO_TOOL_WEAR_RUN` | A0 | runtime | tool wear is enforced for a player's tool |
| T3.3 | **BLOCKED** | `BLOCKED_NO_RESEARCH_RUN` | A3 | source | three distinct research methods are real and distinguishable |
| T3.4 | **BLOCKED** | `BLOCKED_NO_CRAFT_RUN` | A3 | source | recipe sinks exist for what the sources produce |
| T3.5 | **BLOCKED** | `BLOCKED_NO_PROVENANCE_REJECTION` | A3 | contract | owner-string-only source authentication is refused |
| T3.6 | **PASS** | `FUEL_REQUIRED` | A3 | contract | missing physical fuel fails a job |
| T3.7 | **PASS** | `DUPLICATE_REFUSED` | A0 | contract | duplicate job ids and early claims are refused |
| T3.8 | **PASS** | `STALE_RUN_REFUSED` | A0 | contract | stale run and expired window are refused |
| T3.9 | **BLOCKED** | `BLOCKED_NO_2PID_RECEIPT` | A0 | receipt | funded job completes in a separate process, exactly once |
| T3.10 | **BLOCKED** | `BLOCKED_NO_OUTCOME_RUN` | A3 | outcome | the payoff changes a later choice |
| T3.11 | **FAIL** | `A3_SERVICE_REFUSED_BY_SCOPE` | A0 | source | the submitted A3 economy service is the one the product runs |
| T4.1 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | Core can be carried, used and stored |
| T4.2 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | AVFX | runtime | a physical Core gates research |
| T4.3 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | trace-based threat and bag recovery |
| T4.4 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | the 336-hour run ends and resets |
| T4.5 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A0 | runtime | last72 Elder territory transformation |
| T4.6 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | physical chest-sourced Ragnarok cash |
| T4.7 | **NOT_IMPLEMENTED** | `FEATURE_ABSENT` | A3 | runtime | multiple fixed-site deposits |
| T4.8 | **BLOCKED** | `BLOCKED_NO_FEATURE_RUN` | A0 | runtime | evacuation and complete run-local wipe |

## First failure

`T1.2` · **COMPOSITION_DROPS_OWNER_WORK** · owner **A0**

the composed controller does not mount A0WorldAuthority although A0's own committed controller does (1643 lines vs 1367); A0's declared resolution replaces it with a stale merge artifact, so the composed product runs the legacy sidecar (384, 256) while the authored continent is (1024, 768). This is a source/composition finding: it does not claim the control tree runs — see T1.7, where the control's authority script is graded (NOT verified)

repro: `python3 tools/a0/compose_owners.py --owner a1=… ; diff the composed game/overworld/chapter1_overworld.gd against A0's committed file`

## First blocker

`T1.3` · **BLOCKED_LIVE_WORLD_UNRESOLVED** · owner **A0**

the probe could not resolve which world is live on this tree (live_source=UNRESOLVED_CONTROLLER_NOT_RUNNABLE); an unknown live world is not a pass and not a failure — see T1.7 for the native reason

## Evidence per case

### T1.1 — PASS `COMPOSITION_IDENTITY`
the declared tree reproduces byte for byte
- declared tree=f6d5cf789995
- recomputed tree=f6d5cf789995 (git-write-tree)

### T1.2 — FAIL `COMPOSITION_DROPS_OWNER_WORK`
the composed controller does not mount A0WorldAuthority although A0's own committed controller does (1643 lines vs 1367); A0's declared resolution replaces it with a stale merge artifact, so the composed product runs the legacy sidecar (384, 256) while the authored continent is (1024, 768). This is a source/composition finding: it does not claim the control tree runs — see T1.7, where the control's authority script is graded (NOT verified)
- live world (384, 256) resolved from `legacy_sidecar` (game/overworld/chapter1_overworld.gd), legacy document (384, 256)
- A1 authored frame (1024, 768) (game/survival/a1_authored_source.gd:30)
- sidecar markers ['render_legacy := true'] (game/survival/a0_authored_world_mount.gd:12,29)
- A0 poi-mount refusal `A0_WORLD_ABSENT` (game/survival/a0_poi_mount.gd:69)
- composed controller mounts A0WorldAuthority=False, A0AuthoredWorldMount=True, authority default authored=False, 1367 lines
- reconciled control (A0's own controller restored): mounts A0WorldAuthority=True, 1643 lines, runtime_authority_verified=False (controller_runnable=False, authority_runnable=False), live_source=UNRESOLVED_AUTHORITY_NOT_RUNNABLE
- control engine errors: {"SCRIPT ERROR": 4, "Parse Error": 2, "Failed to load script": 1, "Compile Error": 1} (see r14_ci/control.native.txt) — the control tree does not compile cleanly
- the control's authored world is NOT runtime-verified — its own script errors are recorded in T1.7; this case therefore claims a *source/composition* difference only, never that the control tree plays
- live scene mounts A0AuthoredWorldMount=True behind `survival/a0_authored_stream` which defaults off=True and is defined in project.godot=False (game/overworld/chapter1_overworld.gd:65,275-277)
- A0WorldAuthority present=True, referenced by production=False (tests/survival_a0_authored_world_route_test.gd)

### T1.3 — BLOCKED `BLOCKED_LIVE_WORLD_UNRESOLVED`
the probe could not resolve which world is live on this tree (live_source=UNRESOLVED_CONTROLLER_NOT_RUNNABLE); an unknown live world is not a pass and not a failure — see T1.7 for the native reason
- game/survival/world/a1_authored_world_reader.gd:1011: func choose_safe_spawn(run_seed: int) -> Dictionary:
- probe: {"cell": [389, 291], "chunk_id": "chunk:6:4", "in_live_world": null, "live_frame": null, "live_resolved": false, "live_source": "UNRESOLVED_CONTROLLER_NOT_RUNNABLE", "ok": true, "production_spawn_approval": false, "region": "r_ashen_crown", "standable": true, "traversal": ""}

### T1.4 — FAIL `SITE_OUTSIDE_LIVE_WORLD`
3/3 canonical sites cannot be approached; package_status=A8_OWNER_CONTRACT_REFRESH_READY_FOR_A0_REVIEW_NOT_MOUNTED
- poi_crown_south_quarry (30, 280) scene=res://game/survival/world_content/scenes/south_quarry.tscn
- poi_crown_south_orchard (140, 360) scene=res://game/survival/world_content/scenes/south_orchard_ruin.tscn
- poi_crown_south_mill (120, 300) scene=res://game/survival/world_content/scenes/south_crown_mill.tscn

### T1.5 — PASS `INPUT_BOOTSTRAP_INDEPENDENT`
the reader configures with and without the bootstrap
- before={"input_action_present": true, "reader_ok": true, "reason": ""}
- after={"input_action_present": true, "reader_ok": true, "reason": ""}

### T1.6 — BLOCKED `BLOCKED_NO_MOVEMENT_RUN`
requires `A7C T1.6 {"input_moves":true,"collision_blocks":true}` from a real player walk on the composed tree
- game/survival/gameplay_input_gate.gd:92: var result := Input.get_vector("move_left", "move_right", "move_up", "move_down")

### T1.7 — BLOCKED `BLOCKED_NO_NATIVE_EVIDENCE`
requires `A7C NATIVE_LOAD {…}` from the probe; no native marker was recorded
- probe NATIVE_LOAD: {}
- composed probe log engine errors: {'SCRIPT ERROR': 3, 'Parse Error': 2, 'Failed to load script': 1, 'Compile Error': 0}

### T2.1 — BLOCKED `BLOCKED_NO_ENTRY_RUN`
scenes exist; nobody has physically entered them
- scenes: ['fourth_salt_lookout_test.tscn', 'native_poi_shell_template.tscn', 'native_poi_template.tscn', 'poi_pilot.tscn', 'south_crown_mill.tscn', 'south_crown_mill_overworld.tscn', 'south_orchard_ruin.tscn', 'south_orchard_ruin_overworld.tscn', 'south_quarry.tscn', 'south_quarry_overworld.tscn']
- present for ['south_orchard', 'south_quarry'] of ['south_orchard', 'south_quarry']

### T2.2 — BLOCKED `BLOCKED_NO_ROUTE_RUN`
requires a walked route marker per site; a teleport into a POI interior is not a route and is rejected by this harness
- poi_crown_south_quarry cell=(30, 280)
- poi_crown_south_orchard cell=(140, 360)
- poi_crown_south_mill cell=(120, 300)

### T2.3 — BLOCKED `BLOCKED_NO_MELEE_RUN`
no item id contains 'knife', so the knife-first journey's starting tool is not in the catalog; whether the starting melee is playable is NOT decided here — melee lives in the weapon subsystem (game/characters/knight/knight.gd:220: @onready var weapon_manager: WeaponManager = $WeaponManager) and this probe runs no combat, so no player-level melee claim is made
- 57 item ids; knife-like=[]; kinds={'blueprint': 4, 'consumable': 2, 'equipment': 5, 'key_item': 4, 'material': 34, 'skill_core': 3, 'station_kit': 5}
- melee/tool equipment ids=['stone_pick', 'iron_pick', 'salvage_hammer']
- melee subsystem hits=['game/characters/knight/knight.gd:220: @onready var weapon_manager: WeaponManager = $WeaponManager', 'game/characters/knight/knight.gd:759: var hand_weapon := weapon_manager.get_hand_weapon()', 'game/characters/knight/knight.gd:1025: or not current_action.is_empty() or weapon_manager.is_swap_in_progress():']

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

### T3.2 — BLOCKED `BLOCKED_NO_TOOL_WEAR_RUN`
3 contract symbol(s) and 2 consumer call(s) exist, but no run shows a player's tool condition dropping; a contract is not wear
- A3 contract: game/survival/economy/unique_ownership_guard.gd:130: if int(record["max_condition"]) <= 0 or int(record["condition"]) > int(record["max_condition"]) or int(record["uses"]) > int(record["max_uses"]):
- A3 contract: game/survival/economy/vendor/a3_economy_service.gd:255: var condition_cost := 1
- A0 consumer: game/survival/economy/a0_economy_adapter.gd:51: var wear: Dictionary = apply_tool_use_plan(candidate, planned)
- A0 consumer: game/survival/economy/vendor/a3_economy_service.gd:269: func apply_tool_use_plan(candidate: Dictionary, plan: Dictionary) -> Dictionary:

### T3.3 — BLOCKED `BLOCKED_NO_RESEARCH_RUN`
three escrow shapes exist; no player has spent them
- blueprint -> game/survival/economy/offline_operation_planner.gd:279
- specimen -> game/survival/economy/offline_operation_planner.gd:280
- targeted -> game/survival/economy/offline_operation_planner.gd:278

### T3.4 — BLOCKED `BLOCKED_NO_CRAFT_RUN`
sinks are declared; nothing has been crafted from a real source
- progression_model keys=['assumptions', 'capability_bootstrap', 'capability_grant_policy', 'capability_pois', 'explicit_bootstrap_pois', 'hazard_mitigation', 'hazards', 'late_goals', 'novice_bootstrap', 'product_sources', 'purpose', 'route_network']
- sink sections=['capability_bootstrap', 'capability_pois', 'hazards', 'late_goals', 'route_network', 'shelter']

### T3.5 — BLOCKED `BLOCKED_NO_PROVENANCE_REJECTION`
no run shows an owner-string-only source claim being refused. No provenance refusal exists (`authenticate_source`/`is_source_authenticated`), but the escrow mismatch codes this case used to pass on are escrow integrity, not source authorisation
- escrow vocabulary (a different invariant): `arm_job_id_mismatch` at game/survival/economy/offline_operation_planner.gd:138
- escrow vocabulary (a different invariant): `escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:498
- escrow vocabulary (a different invariant): `fuel_escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:257
- escrow vocabulary (a different invariant): `input_escrow_mismatch` at game/survival/economy/offline_operation_planner.gd:255
- measured surface is A0's vendored fork (game/survival/economy/vendor/a3_economy_service.gd, 1789 lines); A3's submitted service is refused by scope (T3.11)

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

### T3.11 — FAIL `A3_SERVICE_REFUSED_BY_SCOPE`
A3's submitted economy service is refused as out of scope, so the composed product runs A0's vendored fork instead; Track 3's consumer tests are then testing a copy, not the submitted service
- submitted service present=False (game/survival/economy/a3_economy_service.gd)
- refused by composition scope=True (7 A3 economy file(s))
- vendor fork=game/survival/economy/vendor/a3_economy_service.gd present=True lines=1789 sha=109c268036bb

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

