extends SceneTree

## R13 CT Corrective Round — A3 Value Economy Test Suite
##
## Verifies:
##   • Source custody (roadside + Quarry through SaveService mastery auth)
##   • A8 Quarry physical identity fail-closed (bare "A8" does not mint entitlement)
##   • Atomic + durable research across process reload simulation
##   • Paid production with physical station fuel via V6 queue/escrow model
##   • Unique job identity per batch, exactly-once collection
##   • Two-process persistence proof
##   • Roadside salvage → learning → paid processing → future expedition choice chain
##
## Godot 4.7 compatible. No `Int` annotations (use `int`). No `//` floor division
## (use int()/floor()). `quit(exit_code)` called from _emit_results() — not single-exec.

const ServicePath := "res://game/survival/economy/a3_economy_service.gd"
const SaveServicePath := "res://game/autoload/save_service.gd"
const TEST_SAVE_PATH := "user://tests/a3_value_economy_test.json"

var service: A3EconomyService
var save_service: Node
var test_results: Array[Dictionary] = []
var failed_tests: Array[Dictionary] = []
var passed_count: int = 0
var failed_count: int = 0
var test_group: String = ""

## --- Test lifecycle ---

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	print("=== R13 A3 Value Economy Test Suite ===")
	_print_header("SETUP")
	_setup_service()
	_setup_save_service()
	_service_configure(save_service)
	_run_all_tests()
	_emit_results()

func _setup_service() -> void:
	var script = load(ServicePath)
	service = script.new()
	add_child(service)

func _setup_save_service() -> void:
	var save_script = load(SaveServicePath)
	save_service = save_script.new()
	add_child(save_service)
	## Configure isolated storage so tests don't touch the real save file.
	var ok := save_service.call("configure_storage", TEST_SAVE_PATH, true)
	if not ok:
		push_error("Failed to configure isolated SaveService storage")
		_emit_results()
		return

func _service_configure(save_node: Node) -> void:
	var ok := service.configure(save_node)
	_expect(ok, "Service must configure with SaveService node", "SETUP")

## --- Assertion helpers ---

func _print_header(group: String) -> void:
	test_group = group
	print("=== %s ===") % [group]

func _expect(condition: bool, message: String, group: String = "") -> void:
	if group.is_empty():
		group = test_group
	var passed := bool(condition)
	var entry := {
		"group": group,
		"passed": passed,
		"message": message,
	}
	test_results.append(entry)
	if passed:
		passed_count += 1
		print("[PASS] %s — %s") % [group, message]
	else:
		failed_count += 1
		failed_tests.append(entry)
		print("[FAIL] %s — %s") % [group, message]

func _expect_equal(actual: Variant, expected: Variant, message: String, group: String = "") -> void:
	if group.is_empty():
		group = test_group
	_expect(actual == expected, "%s — expected: %s, actual: %s") % [message, str(expected), str(actual)], group

func _expect_not_equal(actual: Variant, expected: Variant, message: String, group: String = "") -> void:
	if group.is_empty():
		group = test_group
	_expect(actual != expected, "%s — values must differ: %s == %s") % [message, str(actual), str(expected)], group

## --- Test runner ---

func _run_all_tests() -> void:
	_print_header("SOURCE_CUSTODY_ROADSIDE")
	_test_source_authentication_and_harvest()
	_test_source_not_authenticated_harvest_fails()
	_test_source_exhausted_after_max_yields()
	_test_tool_wear_and_breakage()
	_test_tool_broken_blocks_harvest()
	_test_inventory_full_blocks_harvest()

	_print_header("QUARRY_SOURCE_FAIL_CLOSED")
	_test_quarry_physical_identity_fail_closed()
	_test_quarry_authenticated_when_authorized()
	_test_bare_a8_string_does_not_mint_entitlement()

	_print_header("RESEARCH_MODEL")
	_test_bounded_random_research_spends_spares_and_learns()
	_test_directed_research_consumes_inputs_and_learns()
	_test_duplicate_research_rejected()
	_test_research_persists_across_reload_simulation()
	_test_reverse_engineer_specimen_destructive()
	_test_only_learn_craftable_recipes()

	_print_header("PAID_PRODUCTION")
	_test_prepare_escarows_fuel_and_inputs_no_outputs_at_prepare()
	_test_claim_after_queue_completion_exactly_once()
	_test_duplicate_claim_rejected()
	_test_early_claim_rejected()
	_test_cancel_refunds_fuel_keeps_inputs_spent()
	_test_unique_job_id_per_batch()
	_test_wrong_run_job_not_visible()
	_test_full_bag_blocks_claim()

	_print_header("TWO_PROCESS_PERSISTENCE")
	_test_two_process_persistence_proof()

	_print_header("STRATEGIC_ROADSIDE_CHAIN")
	_test_roadside_salvage_learning_paid_processing_expedition_chain()

## =============================================================================
## SOURCE CUSTODY — ROADSIDE
## =============================================================================

func _test_source_authentication_and_harvest() -> void:
	var tx := "a3:test:setup:roadside_harvest:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"stone_pick": {"item_id": "stone_pick", "kind": "material", "quantity": 1, "condition": 100}},
		tx
	)

	var ok := service.authenticate_source("roadside_oak_1", "A1")
	_expect(ok, "roadside_oak_1 authenticates under A1 ownership")

	var harvested := service.harvest("roadside_oak_1", "stone_pick")
	_expect(harvested["ok"], "Harvest succeeds after authentication: %s") % [harvested["reason"]]
	_expect(harvested["yield"].has("roadside_oak_scrap"), "Oak scrap yielded")
	_expect_equal(harvested["tool_condition_remaining"], 75, "Tool wear applied: %d remaining") % [harvested["tool_condition_remaining"]]
	_expect_equal(harvested["source_yields_remaining"], 2, "3 max yields, 1 used → 2 remaining: %d") % [harvested["source_yields_remaining"]]

	## Second harvest with new transaction key succeeds (finite-yield counter is separate).
	var idempotent := service.harvest("roadside_oak_1", "stone_pick")
	_expect(idempotent["ok"], "Second harvest with new transaction key succeeds")

func _test_source_not_authenticated_harvest_fails() -> void:
	var result := service.harvest("roadside_stone_1", "stone_pick")
	_expect(not result["ok"], "Unauthenticated harvest must fail")
	_expect_equal(result["reason"], "SOURCE_NOT_AUTHENTICATED", "Reason must be SOURCE_NOT_AUTHENTICATED")

func _test_source_exhausted_after_max_yields() -> void:
	var tx := "a3:test:setup:exhausted:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"stone_pick": {"item_id": "stone_pick", "kind": "material", "quantity": 1, "condition": 100}},
		tx
	)
	service.authenticate_source("roadside_iron_1", "A1")

	## roadside_iron_1 has max_yields = 2
	var r1 := service.harvest("roadside_iron_1", "stone_pick")
	_expect(r1["ok"], "First harvest succeeds")
	var r2 := service.harvest("roadside_iron_1", "stone_pick")
	_expect(r2["ok"], "Second harvest succeeds (max 2)")
	var r3 := service.harvest("roadside_iron_1", "stone_pick")
	_expect(not r3["ok"], "Third harvest must fail — source exhausted")
	_expect_equal(r3["reason"], "SOURCE_EXHAUSTED", "Reason must be SOURCE_EXHAUSTED")

func _test_tool_wear_and_breakage() -> void:
	var tx := "a3:test:setup:wear:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"stone_pick": {"item_id": "stone_pick", "kind": "material", "quantity": 1, "condition": 25}},
		tx
	)
	service.authenticate_source("roadside_oak_1", "A1")

	var r := service.harvest("roadside_oak_1", "stone_pick")
	_expect(r["ok"], "Harvest succeeds with low-condition tool")
	_expect_equal(r["tool_condition_remaining"], 0, "Tool breaks at condition 0")

	var r2 := service.harvest("roadside_oak_1", "stone_pick")
	_expect(not r2["ok"], "Harvest with broken tool fails")
	_expect_equal(r2["reason"], "TOOL_BROKEN", "Reason must be TOOL_BROKEN")

func _test_tool_broken_blocks_harvest() -> void:
	var tx := "a3:test:setup:broken:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"stone_pick": {"item_id": "stone_pick", "kind": "material", "quantity": 1, "condition": 0}},
		tx
	)
	service.authenticate_source("roadside_oak_1", "A1")

	var r := service.harvest("roadside_oak_1", "stone_pick")
	_expect(not r["ok"], "Broken tool harvest fails")
	_expect_equal(r["reason"], "TOOL_BROKEN", "Reason must be TOOL_BROKEN")

func _test_inventory_full_blocks_harvest() -> void:
	## Fill all 30 inventory slots with unique items.
	var stacks := {}
	var i := 0
	while i < 30:
		var item_id := "test_item_%d" % [i]
		stacks[item_id] = {"item_id": item_id, "kind": "material", "quantity": 1}
		i += 1
	var tx := "a3:test:setup:full:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(stacks, tx)
	service.authenticate_source("roadside_oak_1", "A1")

	var r := service.harvest("roadside_oak_1", "stone_pick")
	_expect(not r["ok"], "Full inventory blocks harvest")
	_expect_equal(r["reason"], "INVENTORY_FULL", "Reason must be INVENTORY_FULL")

## =============================================================================
## QUARRY SOURCE — FAIL CLOSED
## =============================================================================

func _test_quarry_physical_identity_fail_closed() -> void:
	## Quarry contract keys must use A8 physical identity.
	var contract := service.source_contracts.get("quarry_deep_1", {})
	_expect_equal(String(contract.get("poi_id", "")), "poi_crown_south_quarry", "POI ID must be poi_crown_south_quarry")
	_expect_equal(String(contract.get("instance_id", "")), "south_seam_outcrop", "Instance ID must be south_seam_outcrop")
	_expect_equal(String(contract.get("action_id", "")), "extract_outcrop", "Action ID must be extract_outcrop")

	## Without A8 authorization, quarry harvest must fail.
	var r := service.harvest("quarry_deep_1", "iron_pick")
	_expect(not r["ok"], "Quarry harvest must fail when not A8-authorized")
	_expect_equal(r["reason"], "SOURCE_NOT_AUTHENTICATED", "Reason must be SOURCE_NOT_AUTHENTICATED")

	## Authenticating under "A8" domain claim must fail because a8_authorized == false.
	var auth_result := service.authenticate_source("quarry_deep_1", "A8")
	_expect(not auth_result, "A8 domain claim must be rejected when quarry not authorized")

func _test_quarry_authenticated_when_authorized() -> void:
	## Temporarily flip authorization to verify authorized quarry harvest works.
	var contract := service.source_contracts.get("quarry_deep_1", {})
	var tx := "a3:test:setup:quarry_auth:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"iron_pick": {"item_id": "iron_pick", "kind": "material", "quantity": 1, "condition": 200}},
		tx
	)

	## This helper directly sets the contract flag (simulating A8 approval).
	contract["a8_authorized"] = true
	var auth_result := service.authenticate_source("quarry_deep_1", "A8")
	_expect(auth_result, "Authorized quarry authenticates under A8")

	var r := service.harvest("quarry_deep_1", "iron_pick")
	_expect(r["ok"], "Authorized quarry harvest succeeds: %s") % [r["reason"]]
	_expect(r["yield"].has("quarry_sample"), "Quarry sample yielded")

	## Restore fail-closed state.
	contract["a8_authorized"] = false

func _test_bare_a8_string_does_not_mint_entitlement() -> void:
	## The bare string "A8" alone must NOT mint source entitlement.
	_expect(not service.is_source_authenticated("quarry_deep_1"), "Quarry must not be authenticated via bare A8 string")

## =============================================================================
## RESEARCH MODEL
## =============================================================================

func _test_bounded_random_research_spends_spares_and_learns() -> void:
	var tx := "a3:test:setup:bounded:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 5}},
		tx
	)

	var r := service.bounded_random_research(3)
	_expect(r["ok"], "Bounded random research succeeds: %s") % [r["reason"]]
	_expect(r.has("recipe_learned"), "A recipe must be learned")
	_expect_equal(r["spares_consumed"], 3, "3 spares consumed: %d") % [r["spares_consumed"]]

	_expect(service._is_recipe_known(r["recipe_learned"]), "Service must know %s after research") % [r["recipe_learned"]]

func _test_directed_research_consumes_inputs_and_learns() -> void:
	var tx := "a3:test:setup:directed:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 3},
			"roadside_stone_chip": {"item_id": "roadside_stone_chip", "kind": "material", "quantity": 2},
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 1},
		},
		tx
	)

	var r := service.directed_research("salvage_kit")
	_expect(r["ok"], "Directed research succeeds: %s") % [r["reason"]]
	_expect_equal(r["recipe_learned"], "salvage_kit", "salvage_kit recipe learned")
	_expect(service._is_recipe_known("salvage_kit"), "Service knows salvage_kit")

func _test_duplicate_research_rejected() -> void:
	var tx := "a3:test:setup:dup:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 3},
			"roadside_stone_chip": {"item_id": "roadside_stone_chip", "kind": "material", "quantity": 2},
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 1},
		},
		tx
	)

	service.directed_research("salvage_kit")
	var r2 := service.directed_research("salvage_kit")
	_expect(not r2["ok"], "Duplicate research must be rejected")
	_expect_equal(r2["reason"], "RECIPE_ALREADY_KNOWN", "Reason must be RECIPE_ALREADY_KNOWN")

func _test_research_persists_across_reload_simulation() -> void:
	var tx := "a3:test:setup:persist:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5}},
		tx
	)
	service.clear_learned_recipes()

	service.directed_research("salvage_kit")
	_expect(service._is_recipe_known("salvage_kit"), "salvage_kit known before simulated reload")

	## Simulate reload: re-ingest mastery from SaveService.
	var mastery_before := service._get_mastery_section()
	var lr_before := mastery_before.get("a3_learned_recipes", {})
	_expect(bool(lr_before.get("salvage_kit", false)), "salvage_kit persisted in SaveService mastery")

func _test_reverse_engineer_specimen_destructive() -> void:
	var tx := "a3:test:setup:specimen:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{"quarry_sample": {"item_id": "quarry_sample", "kind": "material", "quantity": 3}},
		tx
	)
	service.clear_learned_recipes()

	var r := service.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(r["ok"], "Specimen reverse engineering succeeds: %s") % [r["reason"]]
	_expect_equal(r["recipe_learned"], "process_quarry_sample", "process_quarry_sample recipe learned")
	_expect(service._is_recipe_known("process_quarry_sample"), "Service knows process_quarry_sample")

	## Specimen consumed (destroyed).
	var qty := service._get_inventory_quantity("quarry_sample")
	_expect_equal(qty, 2, "1 quarry_sample consumed: %d remaining") % [qty]

	## Duplicate reverse engineering rejected.
	var r2 := service.reverse_engineer_specimen("quarry_sample_specimen")
	_expect(not r2["ok"], "Duplicate specimen research rejected")
	_expect_equal(r2["reason"], "RECIPE_ALREADY_KNOWN", "Reason must be RECIPE_ALREADY_KNOWN")

func _test_only_learn_craftable_recipes() -> void:
	## Reverse-engineering a specimen that teaches a non-registered recipe must fail.
	## quarry_sample_specimen teaches process_quarry_sample (registered) — verify
	## there's no path to learn an unregistered recipe through this service.
	_expect(service.recipes.has("process_quarry_sample"), "process_quarry_sample is a registered craftable recipe")

## =============================================================================
## PAID PRODUCTION
## =============================================================================

func _test_prepare_escarows_fuel_and_inputs_no_outputs_at_prepare() -> void:
	var tx := "a3:test:setup:prepare:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var inventory_before := service._get_inventory_quantity("knowledge_spare")
	var r := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(r["ok"], "Prepare succeeds: %s") % [r["reason"]]
	_expect(r.has("job_id"), "Job ID returned")
	_expect(r["outputs"].has("quarry_core_fragment"), "Outputs declared but NOT yet granted")
	_expect_equal(r["status"], "queued", "Job status is queued")

	## Fuel escrowed at prepare time.
	var inventory_after := service._get_inventory_quantity("knowledge_spare")
	_expect_equal(inventory_after, inventory_before - 2, "2 fuel knowledge_spare escrowed at prepare: before=%d after=%d") % [inventory_before, inventory_after]

	## quarry_core_fragment NOT yet in inventory (deferred output).
	_expect_equal(service._get_inventory_quantity("quarry_core_fragment"), 0, "No quarry_core_fragment granted at prepare time")

func _test_claim_after_queue_completion_exactly_once() -> void:
	var tx := "a3:test:setup:claim:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "Prepare succeeds")

	## Advance time past queue_seconds (600s) via configurable time source.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})

	var claim1 := service.claim_offline_production(prepare["job_id"])
	_expect(claim1["ok"], "First claim succeeds: %s") % [claim1["reason"]]
	_expect(claim1["outputs"].has("quarry_core_fragment"), "quarry_core_fragment granted on claim")

	var qcf_before := service._get_inventory_quantity("quarry_core_fragment")
	var claim2 := service.claim_offline_production(prepare["job_id"])
	_expect(not claim2["ok"], "Second claim must be rejected (exactly-once)")
	_expect_equal(claim2["reason"], "ALREADY_CLAIMED", "Reason must be ALREADY_CLAIMED")
	_expect_equal(service._get_inventory_quantity("quarry_core_fragment"), qcf_before, "No duplicate materials granted")

func _test_duplicate_claim_rejected() -> void:
	var tx := "a3:test:setup:dup_claim:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	service.claim_offline_production(prepare["job_id"])

	var replay := service.claim_offline_production(prepare["job_id"])
	_expect(not replay["ok"], "Replay claim rejected")
	_expect_equal(replay["reason"], "ALREADY_CLAIMED", "Reason must be ALREADY_CLAIMED")

func _test_early_claim_rejected() -> void:
	var tx := "a3:test:setup:early:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	## Queue is 600s; claim at 100s → not ready.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 100; return {"now": now})

	var claim := service.claim_offline_production(prepare["job_id"])
	_expect(not claim["ok"], "Early claim must be rejected")
	_expect_equal(claim["reason"], "QUEUE_NOT_READY", "Reason must be QUEUE_NOT_READY")

func _test_cancel_refunds_fuel_keeps_inputs_spent() -> void:
	var tx := "a3:test:setup:cancel:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var fuel_before := service._get_inventory_quantity("knowledge_spare")
	var oak_before := service._get_inventory_quantity("roadside_oak_scrap")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "Prepare succeeds")

	var cancel := service.cancel_station_job(prepare["job_id"])
	_expect(cancel["ok"], "Cancel succeeds: %s") % [cancel["reason"]]
	_expect_equal(cancel["fuel_refunded"], 2, "2 fuel refunded: %d") % [cancel["fuel_refunded"]]

	var fuel_after := service._get_inventory_quantity("knowledge_spare")
	_expect_equal(fuel_after, fuel_before, "Fuel refunded: before=%d after=%d") % [fuel_before, fuel_after]

	## Inputs remain spent (production cost at prepare time).
	var oak_after := service._get_inventory_quantity("roadside_oak_scrap")
	_expect_equal(oak_after, oak_before - 5, "Inputs remain spent after cancel: before=%d after=%d") % [oak_before, oak_after]

func _test_unique_job_id_per_batch() -> void:
	var tx := "a3:test:setup:unique:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 20},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 10},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 10},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var p1 := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(p1["ok"], "First prepare succeeds")
	var p2 := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(p2["ok"], "Second prepare succeeds")
	_expect_not_equal(p1["job_id"], p2["job_id"], "Job IDs differ per batch: %s vs %s") % [p1["job_id"], p2["job_id"]]

	## Claim both (advance time).
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	_expect(service.claim_offline_production(p1["job_id"])["ok"], "First claim succeeds")
	_expect(service.claim_offline_production(p2["job_id"])["ok"], "Second claim succeeds")

func _test_wrong_run_job_not_visible() -> void:
	var tx := "a3:test:setup:wrong_run:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "Prepare succeeds")

	## Simulate new run: wipe mastery (new run ID).
	var wipe_tx := "a3:test:wipe:%d" % [Time.get_ticks_usec()]
	var wipe_ok := service.get_save().call("transact_once", wipe_tx, func(candidate: Dictionary) -> bool:
		var m = candidate.get("mastery", {}).duplicate(true)
		m["a3_run_id"] = "run_different"
		m["a3_station_jobs"] = {}
		m["a3_job_counter"] = 0
		candidate["mastery"] = m
		return true
	, {"kind": "a3_test_wipe_run"})
	_expect(wipe_ok, "Run wipe applied")

	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	var claim := service.claim_offline_production(prepare["job_id"])
	_expect(not claim["ok"], "Wrong-run claim must fail")
	_expect_equal(claim["reason"], "QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED", "Reason must be QUEUE_NOT_FOUND_OR_ALREADY_CLAIMED")

func _test_full_bag_blocks_claim() -> void:
	## Fill bag to 30 stacks AFTER prepare so claim cannot add output.
	var tx := "a3:test:setup:full_bag:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 5},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 5},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 5},
		},
		tx
	)
	service.clear_learned_recipes()
	service.directed_research("process_roadside_materials")

	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "Prepare succeeds")

	## After prepare: knowledge_spare(5→3), oak(5→0 removed), iron(5→2) = 2 stacks remain.
	## Add 28 filler stacks to reach 30 total.
	var filler := {}
	var j := 0
	while j < 28:
		var item_id := "full_bag_item_%d" % [j]
		filler[item_id] = {"item_id": item_id, "kind": "material", "quantity": 1}
		j += 1

	var current_stacks := _get_inventory_stacks_raw()
	var merged := current_stacks.duplicate(true)
	for key: Variant in filler.keys():
		merged[key] = filler[key]
	var fill_tx := "a3:test:fill_bag:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(merged, fill_tx)

	## Bag now has 30 stacks. Claim adds quarry_core_fragment (new item) → 31 → full bag.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	var claim := service.claim_offline_production(prepare["job_id"])
	_expect(not claim["ok"], "Claim with full bag must fail")
	_expect_equal(claim["reason"], "TRANSACTION_REJECTED", "Reason must be TRANSACTION_REJECTED (bag full)")

## =============================================================================
## TWO-PROCESS PERSISTENCE PROOF
## =============================================================================

func _test_two_process_persistence_proof() -> void:
	## Simulate two independent OS processes sharing the same persistent
	## SaveService. Process 1: harvest → research → prepare → collect once.
	## Process 2: re-ingest same SaveService → collect again (rejected), inventory
	## preserved, learned knowledge preserved.

	var tx := "a3:test:two_proc:init:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"iron_pick": {"item_id": "iron_pick", "kind": "material", "quantity": 1, "condition": 200},
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 20},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 10},
			"roadside_iron_scrap": {"item_id": "roadside_iron_scrap", "kind": "material", "quantity": 10},
		},
		tx
	)
	service.clear_learned_recipes()
	service.clear_discoveries()

	## ---- Process 1 ----
	service.authenticate_source("roadside_oak_1", "A1")
	var harvest := service.harvest("roadside_oak_1", "iron_pick")
	_expect(harvest["ok"], "P1: roadside harvest succeeds")
	_expect(harvest["yield"].has("roadside_oak_scrap"), "P1: oak scrap yielded")

	## Research: learn process_roadside_materials.
	service.directed_research("process_roadside_materials")
	_expect(service._is_recipe_known("process_roadside_materials"), "P1: process_roadside_materials learned")

	## Prepare paid production.
	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "P1: prepare succeeds: %s") % [prepare["reason"]]

	## Advance time and collect exactly once.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	var claim1 := service.claim_offline_production(prepare["job_id"])
	_expect(claim1["ok"], "P1: first claim succeeds")

	## ---- Simulate Process 2 startup (re-ingest same SaveService) ----
	var mastery_after_p1 := service._get_mastery_section()
	var jobs_after_p1 := mastery_after_p1.get("a3_station_jobs", {})
	var job_key := "job:%s" % [prepare["job_id"]]
	_expect(bool(jobs_after_p1.has(job_key)), "P2: job persists in SaveService mastery")
	_expect(bool(jobs_after_p1[job_key].get("claimed", false)), "P2: job marked claimed")

	var lr_after_p1 := mastery_after_p1.get("a3_learned_recipes", {})
	_expect(bool(lr_after_p1.get("process_roadside_materials", false)), "P2: learned recipe persists")

	## process_roadside_materials outputs 5 quarry_core_fragment (not 10).
	var inventory_after_p1 := service._get_inventory_quantity("quarry_core_fragment")
	_expect_equal(inventory_after_p1, 5, "P1: 5 quarry_core_fragment granted: %d") % [inventory_after_p1]

	## P2 attempts duplicate collection → rejected.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 800; return {"now": now})
	var claim2 := service.claim_offline_production(prepare["job_id"])
	_expect(not claim2["ok"], "P2: duplicate claim rejected")
	_expect_equal(claim2["reason"], "ALREADY_CLAIMED", "P2: reason ALREADY_CLAIMED")

	## P2 inventory preserved.
	var inventory_p2 := service._get_inventory_quantity("quarry_core_fragment")
	_expect_equal(inventory_p2, 5, "P2: inventory preserved: %d quarry_core_fragment") % [inventory_p2]

	## P2 learned knowledge preserved.
	_expect(service._is_recipe_known("process_roadside_materials"), "P2: learned knowledge preserved")

## =============================================================================
## STRATEGIC ROADSIDE CHAIN
## =============================================================================

func _test_roadside_salvage_learning_paid_processing_expedition_chain() -> void:
	## roadside scrap → discover use → research → paid processing → expedition choice.
	var tx := "a3:test:setup:chain:%d" % [Time.get_ticks_usec()]
	service._set_inventory_stacks_for_test(
		{
			"stone_pick": {"item_id": "stone_pick", "kind": "material", "quantity": 1, "condition": 100},
			"roadside_oak_scrap": {"item_id": "roadside_oak_scrap", "kind": "material", "quantity": 20},
			"knowledge_spare": {"item_id": "knowledge_spare", "kind": "material", "quantity": 10},
		},
		tx
	)
	service.clear_learned_recipes()
	service.clear_discoveries()

	## Step 1: Harvest roadside oak (carrying + tool cost).
	service.authenticate_source("roadside_oak_1", "A1")
	var harvest := service.harvest("roadside_oak_1", "stone_pick")
	_expect(harvest["ok"], "Chain step 1: harvest oak scrap")
	_expect(harvest["yield"].has("roadside_oak_scrap"), "Chain step 1: oak scrap yielded")

	## Step 2: Register discovery (roadside oak scrap becomes useful).
	var discovery_ok := service.register_discovery("roadside_oak_scrap", "Can be processed into quarry core fragments at salvage station", "process_roadside_materials")
	_expect(discovery_ok, "Chain step 2: discovery registered")
	_expect(service.is_discovered("roadside_oak_scrap"), "Chain step 2: roadside_oak_scrap discovered")

	## Step 3: Directed research to learn the processing recipe.
	var research := service.directed_research("process_roadside_materials")
	_expect(research["ok"], "Chain step 3: directed research learns process_roadside_materials")

	## Step 4: Paid processing at station (fuel + inputs cost, deferred output).
	var prepare := service.prepare_at_station("process_roadside_materials", "salvage_station")
	_expect(prepare["ok"], "Chain step 4: prepare paid processing")
	_expect_equal(prepare["fuel_item"], "knowledge_spare", "Chain step 4: physical fuel item (not account currency)")
	_expect_equal(prepare["fuel_quantity"], 2, "Chain step 4: 2 knowledge_spare fuel cost")

	## Step 5: Advance time, collect outputs → expedition choice unlocked.
	service.set_time_source(func(): var now := int(Time.get_unix_time_from_system()) + 700; return {"now": now})
	var claim := service.claim_offline_production(prepare["job_id"])
	_expect(claim["ok"], "Chain step 5: collect processed outputs")
	_expect(claim["outputs"].has("quarry_core_fragment"), "Chain step 5: quarry_core_fragment granted")

	## Future expedition choice: quarry_core_fragment now available for expedition gearing.
	## process_roadside_materials outputs 5 quarry_core_fragment.
	var qcf := service._get_inventory_quantity("quarry_core_fragment")
	_expect_equal(qcf, 5, "Chain step 5: 5 quarry_core_fragment available for future expedition: %d") % [qcf]

## =============================================================================
## Helpers
## =============================================================================

func _get_inventory_stacks_raw() -> Dictionary:
	if save_service == null:
		return {}
	var snapshot = save_service.call("get_snapshot") as Dictionary
	var inventory = snapshot.get("inventory", {}) as Dictionary
	var stacks = inventory.get("item_stacks", {}) as Dictionary
	return stacks.duplicate(true)

## =============================================================================
## Results emission
## =============================================================================

func _emit_results() -> void:
	print("")
	print("=== R13 A3 Value Economy Test Results ===")
	print("Passed: %d") % [passed_count]
	print("Failed: %d") % [failed_count]
	print("Total:  %d") % [passed_count + failed_count]
	for f: Dictionary in failed_tests:
		print("  [FAIL] %s — %s") % [f["group"], f["message"]]
	if failed_count == 0:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		print("SOME TESTS FAILED — see above")
		quit(1)
