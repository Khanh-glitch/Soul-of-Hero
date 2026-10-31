extends SceneTree

## R13 A3 value-economy native suite (Godot 4.7, strict warnings-as-errors).
##
## Scope after the R13-A3-CLOSE takeover:
##   * physical source custody keyed to A1 pinned bindings and an injected
##     A0/A1 source receipt (no owner strings, no fabricated source ids);
##   * canonical V5-V7 EconomyService owns the ONLY station queue, the ONLY
##     recipe-knowledge store and the ONLY clock (A0 active-session receipt);
##   * tool wear, finite one-time sources and active-time cooldowns are real;
##   * two competitive routes with measurable, catalog-derived costs;
##   * ordinary stack material vs scarce physical finite-use Skill Core.
##
## Two processes, one durable save, machine-readable receipts:
##   A3_TEST_ROLE=process_1  -> authenticate, harvest, research, queue, exit
##   A3_TEST_ROLE=process_2  -> reload, mature, collect once, refuse duplicate
## Both write JSON receipts under A3_RECEIPT_DIR; tools/ci/verify_r13_receipts.py
## validates them so CI does not depend on shell variables leaking between steps.

const A3Service = preload("res://game/survival/economy/a3_economy_service.gd")
const EconomyService = preload("res://game/survival/economy/economy_service.gd")
const SaveService = preload("res://game/autoload/save_service.gd")
const SOURCE_RECEIPT_CONTRACT := "soh.economy.source_receipt.v1"
const A8_QUARRY_POI_ID := "poi_crown_south_quarry"

const TIME_CONTRACT := "soh.economy.active_tick.v1"
const DEFAULT_SAVE_PATH := "user://tests/r13_value_economy.json"
const RECEIPT_DIR_DEFAULT := "user://tests"

const SOURCE_CACHE := "a1_waystation_roadside_cache_v3"
const SOURCE_ONE_TIME := "a1_roadside_salvage_02_v5"
const SOURCE_TIMBER := "a1_roadside_timber_03_v5"
const SOURCE_NOTES := "a1_roadside_notes_01_v4"

const RECIPE_MATERIAL := "process_roadside_materials"
const RECIPE_SORT := "sort_core_fragments"

var a3: A3EconomyService
var eco
var save_service: Node
var save_path: String = DEFAULT_SAVE_PATH
var receipt_dir: String = RECEIPT_DIR_DEFAULT

var stations: Dictionary = {}
var station_ticks: Dictionary = {}
var station_revisions: Dictionary = {}
var active_seconds: int = 0
var clock_sequence: int = 0
var session_id: String = "r13_session"

var world_cells: Dictionary = {}
var world_discovered: Dictionary = {}
var world_sequences: Dictionary = {}

var test_results: Array[Dictionary] = []
var passed_count: int = 0
var failed_count: int = 0
var test_group: String = ""

## --- lifecycle ---

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	save_path = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if save_path.is_empty():
		save_path = DEFAULT_SAVE_PATH
	receipt_dir = OS.get_environment("A3_RECEIPT_DIR")
	if receipt_dir.is_empty():
		receipt_dir = RECEIPT_DIR_DEFAULT
	var role := OS.get_environment("A3_TEST_ROLE")
	print("=== R13 A3 VALUE ECONOMY (canonical queue/clock) ===")
	print("role=%s pid=%d save=%s" % [role, OS.get_process_id(), save_path])
	if not _setup():
		print("R13 SETUP FAILED")
		quit(1)
		return
	if role == "process_1":
		_run_process_1()
		return
	if role == "process_2":
		_run_process_2()
		return
	_run_full_suite()

func _setup() -> bool:
	if not _setup_save():
		return false
	eco = EconomyService.new()
	if not bool(eco.configure(save_service, _resolve_station)):
		print("canonical economy configure failed: %s" % [eco.last_error])
		return false
	eco.configure_time_host(_station_time_host)
	a3 = A3Service.new()
	if not bool(a3.configure(save_service, eco)):
		print("A3 configure failed: %s" % [a3.last_error])
		return false
	a3.configure_source_host(_source_host)
	_prepare_stations()
	_resume_clock_from_save()
	return true

## Two process mode: the second process is a genuinely new OS process, so its
## fixture clock must resume from the durable canonical time document instead of
## restarting at zero (which the canonical advance rightly rejects).
func _resume_clock_from_save() -> void:
	var document: Dictionary = eco.document()
	if document.is_empty():
		return
	var raw_time: Variant = document.get("time", {})
	if not raw_time is Dictionary:
		return
	var time: Dictionary = raw_time
	clock_sequence = maxi(clock_sequence, int(time.get("sequence", -1)) + 1)
	var raw_stations: Variant = time.get("stations", {})
	if not raw_stations is Dictionary:
		return
	var station_map: Dictionary = raw_stations
	for key: Variant in station_map.keys():
		var raw_entry: Variant = station_map[key]
		if not raw_entry is Dictionary:
			continue
		var entry: Dictionary = raw_entry
		var ticks := int(entry.get("active_ticks", 0))
		station_ticks[String(key)] = maxi(int(station_ticks.get(String(key), 0)), ticks)

func _setup_save() -> bool:
	save_service = root.get_node_or_null("SaveService")
	if save_service == null:
		save_service = SaveService.new()
		save_service.name = "SaveService"
		root.add_child(save_service)
	if not bool(save_service.call(&"configure_storage", save_path, true)):
		push_error("Failed to configure isolated SaveService storage at %s" % [save_path])
		return false
	return true

## --- A0/A1 fixture hosts (test composition root only) ---

func _prepare_stations() -> void:
	_install_station("workbench", "workbench", 1)
	_install_station("research", "research", 1)
	_install_station("furnace", "furnace", 1)

func _install_station(station_id: String, kind: String, tier: int) -> void:
	stations[station_id] = {
		"ok": true,
		"station_id": station_id,
		"kind": kind,
		"tier": tier,
		"queue_capacity": 3,
		"operational": true,
		"condition": 100,
		"station_revision": "rev-%s-1" % [station_id],
	}
	if not station_revisions.has(station_id):
		station_revisions[station_id] = "rev-%s-1" % [station_id]
	if not station_ticks.has(station_id):
		station_ticks[station_id] = 0

func _resolve_station(station_id: String) -> Dictionary:
	var raw: Variant = stations.get(station_id, {})
	if not raw is Dictionary:
		return {}
	var copy: Dictionary = (raw as Dictionary).duplicate(true)
	copy["station_revision"] = String(station_revisions.get(station_id, "rev-unknown"))
	return copy

func _station_time_host(station_id: String) -> Dictionary:
	return {
		"contract": TIME_CONTRACT,
		"station_id": station_id,
		"session_id": session_id,
		"session_index": 1,
		"sequence": clock_sequence,
		"active_ticks": int(station_ticks.get(station_id, 0)),
		"station_revision": String(station_revisions.get(station_id, "rev-unknown")),
	}

func _bindings_known(source_id: String) -> bool:
	var binding: Dictionary = a3.binding_for(source_id)
	return not binding.is_empty()

## The only producer of a physical source receipt in this fixture. It is
## deliberately a composition-root callable: nothing in the gameplay layer can
## reach it, and a3 re-calls it to detect caller-built dictionaries.
func _source_host(source_id: String) -> Dictionary:
	var binding: Dictionary = a3.binding_for(source_id)
	if binding.is_empty():
		return {}
	if not world_cells.has(source_id):
		var raw_cells: Variant = binding.get("stand_cells", [])
		if raw_cells is Array and not (raw_cells as Array).is_empty():
			world_cells[source_id] = (raw_cells as Array)[0]
		else:
			world_cells[source_id] = [0, 0]
	if not world_discovered.has(source_id):
		world_discovered[source_id] = true
	if not world_sequences.has(source_id):
		world_sequences[source_id] = 0
	return {
		"contract": SOURCE_RECEIPT_CONTRACT,
		"source_id": source_id,
		"owner": "A1",
		"poi_id": String(binding.get("poi_id", "")),
		"instance_id": String(binding.get("instance_id", "")),
		"action_id": String(binding.get("action_id", "")),
		"binding_identity": String(binding.get("identity", "")),
		"host_session_id": session_id,
		"host_sequence": int(world_sequences.get(source_id, 0)),
		"hero_cell": (world_cells[source_id] as Array).duplicate(),
		"discovered": bool(world_discovered.get(source_id, false)),
		"active_seconds": active_seconds,
		"a8_authorization_sha256": String(a3.a8_authorization().get("sha256", "")),
	}

func _receipt_for(source_id: String) -> Dictionary:
	return _source_host(source_id)

## --- clock helpers ---

func _advance_active_seconds(seconds: int) -> void:
	active_seconds += seconds
	clock_sequence += 1

func _tick_station(station_id: String, ticks: int, event_id: String) -> Dictionary:
	station_ticks[station_id] = int(station_ticks.get(station_id, 0)) + ticks
	advance_active_seconds(ticks)
	return eco.advance(station_id, _station_time_host(station_id), event_id)

## --- inventory helpers ---

func _count(item_id: String) -> int:
	return int(save_service.call(&"inventory_total", item_id))

func _stacks() -> Dictionary:
	var raw: Variant = save_service.call(&"get_inventory_stacks")
	if raw is Dictionary:
		return (raw as Dictionary).duplicate(true)
	return {}

func _give(item_id: String, quantity: int, tag: String) -> bool:
	return bool(save_service.call(&"grant_inventory_item", item_id, "material", quantity, "r13:give:%s:%s" % [tag, item_id]))

func _give_instance(item_id: String, source_event: String, condition: int) -> String:
	var result: Dictionary = eco.grant_instance(item_id, source_event, -1, condition)
	if not bool(result.get("ok", false)):
		return ""
	return String(result.get("instance_id", ""))

func _replace_inventory(stacks: Dictionary, tag: String) -> bool:
	var mutator := func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		inventory["item_stacks"] = stacks.duplicate(true)
		candidate["inventory"] = inventory
		return true
	return bool(save_service.call(&"transact_once", "r13:replace:%s:%d" % [tag, Time.get_ticks_usec()], mutator, {"kind": "r13_fixture_inventory"}))

func _mastery() -> Dictionary:
	var snapshot: Dictionary = _snapshot()
	var raw: Variant = snapshot.get("mastery", {})
	if raw is Dictionary:
		return raw as Dictionary
	return {}

func _snapshot() -> Dictionary:
	var raw: Variant = save_service.call(&"get_snapshot")
	if raw is Dictionary:
		return raw as Dictionary
	return {}

func _transaction_count_prefix(prefix: String) -> int:
	var snapshot: Dictionary = _snapshot()
	var raw: Variant = snapshot.get("applied_transactions", {})
	if not raw is Dictionary:
		return 0
	var transactions: Dictionary = raw
	var count := 0
	for key: Variant in transactions.keys():
		if String(key).begins_with(prefix):
			count += 1
	return count

## --- assertions ---

func _header(group: String) -> void:
	test_group = group
	print("=== %s ===" % [group])

func _expect(condition: bool, message: String) -> void:
	var entry := {"group": test_group, "passed": condition, "message": message}
	test_results.append(entry)
	if condition:
		passed_count += 1
		print("[PASS] %s - %s" % [test_group, message])
	else:
		failed_count += 1
		print("[FAIL] %s - %s" % [test_group, message])

func _expect_equal(actual: Variant, expected: Variant, message: String) -> void:
	_expect(actual == expected, "%s (expected=%s actual=%s)" % [message, str(expected), str(actual)])

## --- full single-process suite ---

func _run_full_suite() -> void:
	_header("CANONICAL_AUTHORITY")
	_test_canonical_authority()
	_header("SOURCE_CUSTODY")
	_test_source_custody()
	_header("SOURCE_FORGERY_FAIL_CLOSED")
	_test_source_forgery()
	_header("COOLDOWN_AND_SCARCITY")
	_test_cooldown_and_scarcity()
	_header("TOOL_CONDITION")
	_test_tool_condition()
	_header("BAG_AND_IO_FAILURE")
	_test_bag_and_io_failure()
	_header("CANONICAL_PRODUCTION_LIFECYCLE")
	_test_production_lifecycle()
	_header("KNOWLEDGE_MECHANISMS")
	_test_knowledge_mechanisms()
	_header("RUN_RESET_CLEANUP")
	_test_run_reset_cleanup()
	_header("ROUTES_AND_CORE_DISTINCTION")
	_test_routes_and_core_distinction()
	_emit_results()

## Every group starts from a fresh run so durable A1 supply, cooldowns and
## claim counters from an earlier group cannot leak into the next one.
func _begin_group(tag: String) -> void:
	print("--- group: %s" % [tag])
	save_service.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE")
	stations = {}
	station_ticks = {}
	station_revisions = {}
	active_seconds = 0
	clock_sequence = 0
	_prepare_stations()

func _test_canonical_authority() -> void:
	_begin_group("canonical_authority")
	_expect(a3.get_economy() == eco, "A3 delegates to the canonical EconomyService instance")
	_expect_equal(a3.get_projections().get("queue_authority", ""), "canonical_economy_service", "queue authority is canonical")
	_expect_equal(a3.get_projections().get("clock_authority", ""), "a0_active_session_receipt", "clock authority is A0 receipt")
	_expect_equal(a3.get_projections().get("knowledge_authority", ""), "canonical_economy_service", "knowledge authority is canonical")
	_expect(not a3.has_method("set_time_source"), "A3 exposes no caller-supplied clock")
	var ids: Array[String] = a3.source_ids()
	_expect(ids.size() == 5, "exactly the five pinned A1 bindings exist: %d" % [ids.size()])
	_expect(not ids.has("quarry_deep_1"), "fabricated quarry_deep_1 source id does not exist")
	var a8: Dictionary = a3.a8_authorization()
	_expect_equal(a8.get("approved", true), false, "A8 Quarry authorization is not APPROVED (fail closed)")
	_expect(String(a8.get("status", "")).begins_with("REJECTED"), "A8 status stays REJECTED_PENDING_EVIDENCE")
	_expect(not String(a3.bindings_document_sha256()).is_empty(), "A1 binding document hash is pinned")

func _test_source_custody() -> void:
	_begin_group("source_custody")
	_install_station("workbench", "workbench", 1)
	var tool := _give_instance("iron_pick", "r13:tool:custody", 100)
	_expect(not tool.is_empty(), "iron_pick instance granted")
	_expect(not a3.is_source_authenticated(SOURCE_CACHE), "source is unauthenticated before a receipt")
	var auth: Dictionary = a3.authenticate_source(_receipt_for(SOURCE_CACHE))
	_expect(bool(auth.get("ok", false)), "valid A1 host receipt authenticates the source: %s" % [auth.get("reason", "")])
	_expect(a3.is_source_authenticated(SOURCE_CACHE), "authentication is durable in SaveService mastery")
	var record: Dictionary = a3.source_auth_record(SOURCE_CACHE)
	_expect_equal(String(record.get("binding_identity", "")), String(a3.binding_for(SOURCE_CACHE).get("identity", "")), "durable record pins the A1 binding identity")
	var iron_before := _count("iron_scrap")
	var spares_before := _count("knowledge_spares")
	var harvest: Dictionary = a3.harvest(SOURCE_CACHE, tool, _receipt_for(SOURCE_CACHE))
	_expect(bool(harvest.get("ok", false)), "harvest from an authenticated source succeeds: %s" % [harvest.get("reason", "")])
	_expect_equal(_count("iron_scrap"), iron_before + 3, "A1 binding reward iron_scrap x3 granted")
	_expect_equal(_count("knowledge_spares"), spares_before + 2, "A1 binding reward knowledge_spares x2 granted")
	_expect_equal(int(harvest.get("tool_condition_remaining", -1)), 80, "tool wear applied inside the same transaction")
	_expect_equal(_transaction_count_prefix("soh.a3.source_claim."), 1, "one durable source claim receipt exists")

func _test_source_forgery() -> void:
	_begin_group("source_forgery")
	var forged := {}
	var result: Dictionary = a3.authenticate_source(forged)
	_expect(not bool(result.get("ok", true)), "empty dictionary cannot authenticate")
	_expect_equal(String(result.get("reason", "")), "SOURCE_RECEIPT_MISSING_FIELD", "shape check fires before any owner string")

	var owner_string_only := {"source_id": SOURCE_CACHE, "owner": "A1"}
	result = a3.authenticate_source(owner_string_only)
	_expect(not bool(result.get("ok", true)), "supplying owner=\"A1\" alone mints nothing")
	_expect_equal(String(result.get("reason", "")), "SOURCE_RECEIPT_MISSING_FIELD", "owner string is not authentication")

	var valid: Dictionary = _receipt_for(SOURCE_CACHE)
	var mismatch: Dictionary = valid.duplicate(true)
	mismatch["active_seconds"] = int(mismatch["active_seconds"]) + 600
	result = a3.authenticate_source(mismatch)
	_expect(not bool(result.get("ok", true)), "caller-raised active_seconds is rejected")
	_expect(String(result.get("reason", "")).begins_with("SOURCE_RECEIPT_MISMATCH"), "mismatch names the field: %s" % [result.get("reason", "")])

	var out_of_range: Dictionary = valid.duplicate(true)
	out_of_range["hero_cell"] = [1, 1]
	result = a3.authenticate_source(out_of_range)
	_expect(not bool(result.get("ok", true)), "hero outside A1 stand cells is rejected")

	var undiscovered: Dictionary = valid.duplicate(true)
	undiscovered["discovered"] = false
	result = a3.authenticate_source(undiscovered)
	_expect(not bool(result.get("ok", true)), "undiscovered POI cannot authenticate")

	var swapped: Dictionary = _receipt_for(SOURCE_CACHE).duplicate(true)
	var other: Dictionary = _receipt_for(SOURCE_ONE_TIME)
	swapped["instance_id"] = String(other.get("instance_id", ""))
	result = a3.authenticate_source(swapped)
	_expect(not bool(result.get("ok", true)), "identity swapped from another binding is rejected")

	var quarry: Dictionary = _receipt_for(SOURCE_CACHE).duplicate(true)
	quarry["source_id"] = "quarry_deep_1"
	result = a3.authenticate_source(quarry)
	_expect(not bool(result.get("ok", true)), "fabricated quarry source id is rejected")
	_expect_equal(String(result.get("reason", "")), "UNKNOWN_SOURCE_BINDING", "only pinned A1 bindings are sources")

	var quarry_poi: Dictionary = _receipt_for(SOURCE_CACHE).duplicate(true)
	quarry_poi["poi_id"] = A8_QUARRY_POI_ID
	result = a3.authenticate_source(quarry_poi)
	_expect(not bool(result.get("ok", true)), "claiming the Quarry POI id on a roadside binding is rejected")

	a3.configure_source_host(Callable())
	result = a3.authenticate_source(valid)
	_expect(not bool(result.get("ok", true)), "absent source host fails closed")
	_expect_equal(String(result.get("reason", "")), "SOURCE_HOST_UNAVAILABLE", "no host means no receipt")
	a3.configure_source_host(_source_host)

func _test_cooldown_and_scarcity() -> void:
	_begin_group("cooldown_scarcity")
	var tool := _give_instance("iron_pick", "r13:tool:cooldown", 100)
	a3.authenticate_source(_receipt_for(SOURCE_CACHE))
	## Break the cooldown precondition deliberately: claim once at the current
	## active second, then immediately again with the same A0 clock.
	var first: Dictionary = a3.harvest(SOURCE_CACHE, tool, _receipt_for(SOURCE_CACHE))
	_expect(bool(first.get("ok", false)), "first renewable claim succeeds")
	var second: Dictionary = a3.harvest(SOURCE_CACHE, tool, _receipt_for(SOURCE_CACHE))
	_expect(not bool(second.get("ok", true)), "second claim before the active-time cooldown is refused")
	_expect_equal(String(second.get("reason", "")), "SOURCE_COOLDOWN", "refusal reason is SOURCE_COOLDOWN")
	_expect_equal(int(second.get("remaining_active_seconds", 0)), 1800, "cooldown remaining is the A1 binding value")
	_advance_active_seconds(1800)
	var third: Dictionary = a3.harvest(SOURCE_CACHE, tool, _receipt_for(SOURCE_CACHE))
	_expect(bool(third.get("ok", false)), "claim after the cooldown succeeds: %s" % [third.get("reason", "")])

	## One-time source: finite, no cooldown, exhausted after max_claims=1.
	a3.authenticate_source(_receipt_for(SOURCE_ONE_TIME))
	var one: Dictionary = a3.harvest(SOURCE_ONE_TIME, tool, _receipt_for(SOURCE_ONE_TIME))
	_expect(bool(one.get("ok", false)), "one-time source claim succeeds once")
	_expect_equal(int(one.get("claims_remaining", -1)), 0, "one-time source has no claims left")
	var twice: Dictionary = a3.harvest(SOURCE_ONE_TIME, tool, _receipt_for(SOURCE_ONE_TIME))
	_expect(not bool(twice.get("ok", true)), "exhausted one-time source refuses a second claim")
	_expect_equal(String(twice.get("reason", "")), "SOURCE_EXHAUSTED", "refusal reason is SOURCE_EXHAUSTED")

func _test_tool_condition() -> void:
	_begin_group("tool_condition")
	var tool := _give_instance("iron_pick", "r13:tool:wear", 20)
	a3.authenticate_source(_receipt_for(SOURCE_TIMBER))
	a3.authenticate_source(_receipt_for(SOURCE_ONE_TIME))
	var first: Dictionary = a3.harvest(SOURCE_ONE_TIME, tool, _receipt_for(SOURCE_ONE_TIME))
	_expect(bool(first.get("ok", false)), "claim with a low-condition tool succeeds")
	_expect_equal(int(first.get("tool_condition_remaining", -1)), 0, "tool condition reaches zero")
	## A second, untouched one-time source isolates wear from supply limits.
	var second: Dictionary = a3.harvest(SOURCE_TIMBER, tool, _receipt_for(SOURCE_TIMBER))
	_expect(not bool(second.get("ok", true)), "worn-out tool cannot claim a different source")
	_expect_equal(String(second.get("reason", "")), "TOOL_BROKEN", "refusal reason is TOOL_BROKEN")
	var absent: Dictionary = a3.harvest(SOURCE_NOTES, "soh_i_does_not_exist", _receipt_for(SOURCE_NOTES))
	_expect_equal(String(absent.get("reason", "")), "TOOL_NOT_OWNED", "unknown tool instance fails closed")

func _test_bag_and_io_failure() -> void:
	_begin_group("bag_io")
	var tool := _give_instance("iron_pick", "r13:tool:bag", 100)
	a3.authenticate_source(_receipt_for(SOURCE_NOTES))
	## Fill the bag to capacity with distinct stacks.
	var stacks: Dictionary = _stacks()
	var filler := 0
	while stacks.size() < 30:
		var item_id := "r13_filler_%d" % [filler]
		stacks[item_id] = {"item_id": item_id, "kind": "material", "quantity": 1}
		filler += 1
	_expect(_replace_inventory(stacks, "full"), "fixture fills the bag to capacity")
	var full: Dictionary = a3.harvest(SOURCE_NOTES, tool, _receipt_for(SOURCE_NOTES))
	_expect(not bool(full.get("ok", true)), "full bag refuses the claim")
	_expect_equal(String(full.get("reason", "")), "TRANSACTION_REJECTED", "full bag surfaces as a rejected transaction")
	_expect_equal(_transaction_count_prefix("soh.a3.source_claim.%s." % [SOURCE_NOTES]), 0, "no claim receipt was written by the refused claim")

	## Obstruct the atomic temporary write: durability failure must roll back.
	var stacks_after: Dictionary = _stacks()
	var open_stacks: Dictionary = {}
	var removed := 0
	for key: Variant in stacks_after.keys():
		var record: Variant = stacks_after[key]
		var item_id := String((record as Dictionary).get("item_id", String(key))) if record is Dictionary else String(key)
		if removed < 3 and item_id.begins_with("r13_filler_"):
			removed += 1
			continue
		open_stacks[key] = record
	_expect_equal(removed, 3, "fixture removed three filler stacks, never an instance token")
	_expect(_replace_inventory(open_stacks, "space"), "fixture frees three bag slots")
	var tmp_abs := ProjectSettings.globalize_path(save_path + ".tmp")
	_expect(DirAccess.make_dir_recursive_absolute(tmp_abs) == OK, "fixture obstructs the temporary save write")
	var before_rewards := _count("research_notes")
	var io_failure: Dictionary = a3.harvest(SOURCE_NOTES, tool, _receipt_for(SOURCE_NOTES))
	_expect(not bool(io_failure.get("ok", true)), "failed disk write refuses the claim")
	_expect_equal(_count("research_notes"), before_rewards, "refused claim granted no reward")
	_expect_equal(_transaction_count_prefix("soh.a3.source_claim.%s." % [SOURCE_NOTES]), 0, "refused claim wrote no receipt")
	DirAccess.remove_absolute(tmp_abs)
	var retry: Dictionary = a3.harvest(SOURCE_NOTES, tool, _receipt_for(SOURCE_NOTES))
	_expect(bool(retry.get("ok", false)), "retry after the I/O repair succeeds: %s" % [retry.get("reason", "")])
	_expect_equal(_count("research_notes"), before_rewards + 1, "retry grants exactly one research note")

func _test_production_lifecycle() -> void:
	_begin_group("production")
	_install_station("workbench", "workbench", 1)
	_install_station("research", "research", 1)
	_give("oak_wood", 20, "production")
	_give("iron_scrap", 20, "production")
	_give("charcoal", 5, "production")
	_give("knowledge_spares", 20, "production")
	_give("research_notes", 6, "production")

	## Recipe knowledge is required first, through the canonical research queue.
	var research: Dictionary = a3.research_targeted(RECIPE_MATERIAL, "research", "r13.research.material")
	_expect(bool(research.get("ok", false)), "targeted research enqueues on the canonical research station: %s" % [research.get("reason", "")])
	_expect(not a3.is_recipe_known(RECIPE_MATERIAL), "recipe is not known before research matures")
	var research_job_id := String(research.get("job_id", ""))
	var research_tick: Dictionary = _tick_station("research", 40, "r13.tick.research")
	_expect(bool(research_tick.get("ok", false)), "research job matures on the A0 active clock: %s" % [research_tick.get("reason", "")])
	_expect(a3.is_recipe_known(RECIPE_MATERIAL), "recipe becomes known after maturity")
	var collected_research: Dictionary = a3.claim_production(research_job_id, "r13.collect.research")
	_expect(bool(collected_research.get("ok", false)), "research escrow is collected")
	var survival_raw: Variant = _snapshot().get("survival", {})
	var knowledge_ok := false
	if survival_raw is Dictionary:
		var knowledge_raw: Variant = (survival_raw as Dictionary).get("knowledge", {})
		if knowledge_raw is Dictionary:
			var recipes_raw: Variant = (knowledge_raw as Dictionary).get("recipes", {})
			if recipes_raw is Dictionary:
				knowledge_ok = (recipes_raw as Dictionary).has(RECIPE_MATERIAL)
	_expect(knowledge_ok, "knowledge lives in the canonical survival.knowledge.recipes store")
	_expect(not _mastery().has("a3_learned_recipes"), "no parallel A3 learned-recipe map exists")
	_expect(not _mastery().has("a3_station_jobs"), "no parallel A3 station queue exists")

	## Paid production: escrow at enqueue, output only after maturity.
	var oak_before := _count("oak_wood")
	var prepare: Dictionary = a3.prepare_at_station(RECIPE_MATERIAL, "workbench", "r13.prepare.1")
	_expect(bool(prepare.get("ok", false)), "paid production enqueues on the canonical workbench: %s" % [prepare.get("reason", "")])
	var job_id := String(prepare.get("job_id", ""))
	_expect_equal(_count("oak_wood"), oak_before - 5, "inputs are escrowed at enqueue")
	_expect_equal(_count("quarry_core_fragment"), 0, "no output is granted at enqueue")
	_expect(a3.jobs().has(job_id), "job is visible through the canonical queue")
	var queued_job: Dictionary = a3.job(job_id)
	_expect_equal(String(queued_job.get("status", "")), "queued", "job starts queued")

	var early: Dictionary = a3.claim_production(job_id, "r13.collect.early")
	_expect(not bool(early.get("ok", true)), "claim before maturity is refused")
	_expect_equal(String(early.get("reason", "")), "nothing_to_collect", "early claim reason is nothing_to_collect")

	var tick: Dictionary = _tick_station("workbench", 20, "r13.tick.workbench")
	_expect(bool(tick.get("ok", false)), "workbench maturity uses the A0 receipt: %s" % [tick.get("reason", "")])
	var ready_job: Dictionary = a3.job(job_id)
	_expect_equal(String(ready_job.get("status", "")), "ready", "job is ready after maturity")

	var collect: Dictionary = a3.claim_production(job_id, "r13.collect.1")
	_expect(bool(collect.get("ok", false)), "collection after maturity succeeds")
	_expect_equal(_count("quarry_core_fragment"), 4, "exactly one output batch granted")
	var duplicate: Dictionary = a3.claim_production(job_id, "r13.collect.1")
	_expect(bool(duplicate.get("ok", false)), "replaying the same collection event is idempotent, not a second grant")
	_expect_equal(_count("quarry_core_fragment"), 4, "replay grants nothing extra")
	var second_claim: Dictionary = a3.claim_production(job_id, "r13.collect.2")
	_expect(not bool(second_claim.get("ok", true)), "a different event id on a collected job is refused")
	_expect_equal(String(second_claim.get("reason", "")), "nothing_to_collect", "collected job has nothing left to collect")

	## Cancel returns escrow instead of silently destroying it.
	var prepare_cancel: Dictionary = a3.prepare_at_station(RECIPE_MATERIAL, "workbench", "r13.prepare.cancel")
	_expect(bool(prepare_cancel.get("ok", false)), "second production enqueues")
	var cancel_id := String(prepare_cancel.get("job_id", ""))
	var oak_at_cancel := _count("oak_wood")
	var cancel: Dictionary = a3.cancel_production(cancel_id, "r13.cancel.1")
	_expect(bool(cancel.get("ok", false)), "cancel succeeds")
	_expect_equal(_count("oak_wood"), oak_at_cancel, "cancel moves escrow back into the job, not straight into the bag")
	var cancelled_collect: Dictionary = a3.claim_production(cancel_id, "r13.collect.cancelled")
	_expect(bool(cancelled_collect.get("ok", false)), "cancelled escrow is collectable exactly once")
	_expect_equal(_count("oak_wood"), oak_at_cancel + 5, "collecting a cancelled job returns the inputs")
	var cancelled_again: Dictionary = a3.claim_production(cancel_id, "r13.collect.cancelled.again")
	_expect(not bool(cancelled_again.get("ok", true)), "cancelled escrow cannot be collected twice")

	## Absent A0 time host: no clock, no progress.
	eco.configure_time_host(Callable())
	var no_host: Dictionary = eco.advance("workbench", _station_time_host("workbench"), "r13.tick.nohost")
	_expect(not bool(no_host.get("ok", true)), "advance without an A0 time host fails closed")
	eco.configure_time_host(_station_time_host)

func _test_knowledge_mechanisms() -> void:
	_begin_group("knowledge")
	_give("knowledge_spares", 20, "knowledge")
	_give("research_notes", 6, "knowledge")
	_give("moonleaf", 10, "knowledge")
	_give("binding_cloth", 5, "knowledge")
	_install_station("research", "research", 1)
	## Mechanism 2: targeted research (paid in physical knowledge materials).
	var targeted: Dictionary = a3.research_targeted("minor_salve", "research", "r13.research.targeted")
	_expect(bool(targeted.get("ok", false)), "targeted research is one of three canonical mechanisms: %s" % [targeted.get("reason", "")])
	_tick_station("research", 40, "r13.tick.targeted")
	a3.claim_production(String(targeted.get("job_id", "")), "r13.collect.targeted")
	_expect(a3.is_recipe_known("minor_salve"), "targeted research teaches the recipe")
	var again: Dictionary = a3.research_targeted("minor_salve", "research", "r13.research.targeted.again")
	_expect(not bool(again.get("ok", true)), "re-researching a known recipe is refused")
	_expect_equal(String(again.get("reason", "")), "already_known", "refusal reason is already_known")

	## Mechanism 3: destructive specimen research consumes a physical instance.
	## The canonical gate is genuine: Core re-crafting needs the technology chain
	## first, so this path proves both the fail-closed prerequisite and the
	## destructive consumption of a scarce physical Skill Core.
	_give("iron_scrap", 10, "tech")
	_give("soul_ember", 10, "tech")
	_give("crypt_bone_shard", 5, "tech")
	_give("research_notes", 10, "tech")
	_give("iron_ingot", 5, "tech")
	var specimen := _give_instance("core_ember", "r13:specimen:ember", 100)
	_expect(not specimen.is_empty(), "physical Skill Core specimen instance granted")

	var blocked: Dictionary = a3.research_specimen("craft_core_ember", specimen, "research", "r13.research.specimen.blocked")
	_expect(not bool(blocked.get("ok", true)), "specimen research fails closed without the technology chain")
	_expect_equal(String(blocked.get("reason", "")), "technology_missing", "missing technology is named, not silently allowed")
	_expect(a3.instance_record(specimen).get("location", "") == "bag", "refused research does not destroy the specimen")

	var tech_one: Dictionary = a3.research_technology("tech_smelting", "research", "r13.tech.smelting")
	_expect(bool(tech_one.get("ok", false)), "tech_smelting research enqueues: %s" % [tech_one.get("reason", "")])
	_tick_station("research", 40, "r13.tick.tech.smelting")
	a3.claim_production(String(tech_one.get("job_id", "")), "r13.collect.tech.smelting")
	var tech_two: Dictionary = a3.research_technology("tech_precision", "research", "r13.tech.precision")
	_expect(bool(tech_two.get("ok", false)), "tech_precision research enqueues: %s" % [tech_two.get("reason", "")])
	_tick_station("research", 40, "r13.tick.tech.precision")
	a3.claim_production(String(tech_two.get("job_id", "")), "r13.collect.tech.precision")
	var tech_three: Dictionary = a3.research_technology("tech_core_binding", "research", "r13.tech.binding")
	_expect(bool(tech_three.get("ok", false)), "tech_core_binding research enqueues: %s" % [tech_three.get("reason", "")])
	_tick_station("research", 40, "r13.tick.tech.binding")
	a3.claim_production(String(tech_three.get("job_id", "")), "r13.collect.tech.binding")

	var specimen_research: Dictionary = a3.research_specimen("craft_core_ember", specimen, "research", "r13.research.specimen")
	_expect(bool(specimen_research.get("ok", false)), "authorised specimen research enqueues: %s" % [specimen_research.get("reason", "")])
	_expect(String(a3.instance_record(specimen).get("location", "")).begins_with("research:"), "specimen instance is consumed into research custody at enqueue")
	_tick_station("research", 40, "r13.tick.specimen")
	a3.claim_production(String(specimen_research.get("job_id", "")), "r13.collect.specimen")
	_expect(a3.is_recipe_known("craft_core_ember"), "destructive specimen research teaches the Core recipe")
	_expect_equal(_count("core_ember"), 0, "the studied Skill Core was destroyed, not duplicated")

func _test_run_reset_cleanup() -> void:
	_begin_group("reset")
	a3.authenticate_source(_receipt_for(SOURCE_NOTES))
	_expect(not _mastery().get("a3_source_receipts", {}).is_empty(), "source receipts persisted before reset")
	var reset_ok: bool = bool(save_service.call(&"reset_to_defaults", "RESET_SOUL_OF_HERO_SAVE"))
	_expect(reset_ok, "new-run reset applies")
	var mastery := _mastery()
	_expect(not mastery.has("a3_source_receipts"), "new run clears A3 source custody")
	_expect(not mastery.has("a3_discoveries"), "new run clears A3 discoveries")
	_expect(not a3.is_source_authenticated(SOURCE_CACHE), "no source stays authenticated across a new run")
	var stale_claim: Dictionary = a3.claim_production("job_000001", "r13.collect.stale")
	_expect(not bool(stale_claim.get("ok", true)), "stale job id cannot be claimed after a new run")
	_expect_equal(String(stale_claim.get("reason", "")), "nothing_to_collect", "stale claim reason is nothing_to_collect")

func _test_routes_and_core_distinction() -> void:
	_begin_group("routes")
	## The reset test wiped the run, so this group creates its own material state.
	_give("quarry_core_fragment", 10, "routes")
	var core := _give_instance("core_ember", "r13:routes:core", 100)
	_expect(not core.is_empty(), "routes group owns a physical Skill Core instance")
	var routes: Dictionary = a3.route_comparison()
	var raw_routes: Variant = routes.get("routes", {})
	_expect(raw_routes is Dictionary, "route comparison returns named routes")
	if raw_routes is Dictionary:
		var named: Dictionary = raw_routes
		_expect(named.has("MATERIAL_ROUTE") and named.has("KNOWLEDGE_ROUTE"), "two genuinely different routes exist")
		var material: Dictionary = named.get("MATERIAL_ROUTE", {})
		var knowledge: Dictionary = named.get("KNOWLEDGE_ROUTE", {})
		_expect(int(material.get("total_duration_ticks", 0)) > 0, "material route has measurable production time")
		_expect(int(knowledge.get("total_duration_ticks", 0)) > 0, "knowledge route has measurable production time")
		_expect(not (material.get("total_inputs", {}) as Dictionary).is_empty(), "material route has measurable input costs")
		_expect(not (knowledge.get("total_inputs", {}) as Dictionary).is_empty(), "knowledge route has measurable input costs")
		_expect(String(material.get("next_player_opportunity", "")) != String(knowledge.get("next_player_opportunity", "")), "routes unlock different next-player opportunities")
		_expect(String(material.get("payoff_class", "")) != String(knowledge.get("payoff_class", "")), "routes pay off in different asset classes")
		_expect(int(knowledge.get("recipes_requiring_research", 0)) >= 1, "knowledge route requires research")
		_expect(not (material.get("finite_supply", []) as Array).is_empty(), "material route is limited by finite A1 supply")
		_expect(not (knowledge.get("finite_supply", []) as Array).is_empty(), "knowledge route is limited by finite A1 supply")

	var distinction: Dictionary = a3.skill_core_distinction()
	var ordinary: Dictionary = distinction.get("ordinary_material", {})
	_expect_equal(String(ordinary.get("storage", "")), "stack", "quarry_core_fragment is an ordinary stack material")
	_expect(not bool(ordinary.get("has_instance_identity", true)), "ordinary fragments have no instance identity")
	_expect(not bool(ordinary.get("can_cast", true)), "ordinary fragments cannot be cast")
	_expect(not bool(ordinary.get("has_finite_uses", true)), "ordinary fragments have no finite-use cast budget")
	_expect_equal(_count("quarry_core_fragment") > 0, true, "ordinary fragments are held as counts")
	var cores: Array = distinction.get("physical_skill_cores", [])
	_expect(cores.size() >= 1, "a physical Skill Core instance is distinguishable from a fragment")
	if cores.size() >= 1:
		var core: Dictionary = cores[0]
		_expect(not String(core.get("instance_id", "")).is_empty(), "Skill Core has a durable instance id")
		_expect(int(core.get("max_uses", 0)) >= 1, "Skill Core has finite uses")
		_expect_equal(String(core.get("item_id", "")).begins_with("core_"), true, "Skill Core item id is a core_* instance")

## --- process 1 ---

func _run_process_1() -> void:
	_install_station("workbench", "workbench", 1)
	_install_station("research", "research", 1)
	_give("oak_wood", 20, "p1")
	_give("iron_scrap", 20, "p1")
	_give("charcoal", 5, "p1")
	_give("knowledge_spares", 20, "p1")
	_give("research_notes", 6, "p1")
	var tool := _give_instance("iron_pick", "r13:p1:tool", 100)

	## 1. Physical source authentication through the A0/A1 receipt.
	var auth: Dictionary = a3.authenticate_source(_receipt_for(SOURCE_CACHE))
	if not bool(auth.get("ok", false)):
		_fail_process("P1", "authenticate failed: %s" % [auth.get("reason", "")])
		return
	## 2. Finite physical harvest with tool wear.
	var harvest: Dictionary = a3.harvest(SOURCE_CACHE, tool, _receipt_for(SOURCE_CACHE))
	if not bool(harvest.get("ok", false)):
		_fail_process("P1", "harvest failed: %s" % [harvest.get("reason", "")])
		return
	## 3. Research gating (canonical research queue).
	var research: Dictionary = a3.research_targeted(RECIPE_MATERIAL, "research", "r13.p1.research")
	if not bool(research.get("ok", false)):
		_fail_process("P1", "research enqueue failed: %s" % [research.get("reason", "")])
		return
	_tick_station("research", 40, "r13.p1.tick.research")
	a3.claim_production(String(research.get("job_id", "")), "r13.p1.collect.research")
	if not a3.is_recipe_known(RECIPE_MATERIAL):
		_fail_process("P1", "recipe not learned after research")
		return
	## 4. Paid production: escrow at enqueue, output deferred.
	var oak_before := _count("oak_wood")
	var iron_before := _count("iron_scrap")
	var prepare: Dictionary = a3.prepare_at_station(RECIPE_MATERIAL, "workbench", "r13.p1.prepare")
	if not bool(prepare.get("ok", false)):
		_fail_process("P1", "prepare failed: %s" % [prepare.get("reason", "")])
		return
	var job_id := String(prepare.get("job_id", ""))
	if _count("quarry_core_fragment") != 0:
		_fail_process("P1", "output granted at enqueue")
		return
	var receipt := {
		"role": "process_1",
		"pid": OS.get_process_id(),
		"save_path": save_path,
		"session_id": session_id,
		"active_seconds": active_seconds,
		"source_id": SOURCE_CACHE,
		"binding_identity": String(auth.get("binding_identity", "")),
		"bindings_sha256": a3.bindings_document_sha256(),
		"a8_status": String(a3.a8_authorization().get("status", "")),
		"auth_tx": String(auth.get("transaction_key", "")),
		"harvest_tx": String(harvest.get("transaction_key", "")),
		"harvest_rewards": harvest.get("rewards", []),
		"tool_condition_after_harvest": int(harvest.get("tool_condition_remaining", -1)),
		"recipe_learned": RECIPE_MATERIAL,
		"job_id": job_id,
		"recipe": RECIPE_MATERIAL,
		"station": "workbench",
		"oak_before": oak_before,
		"iron_before": iron_before,
		"oak_after": _count("oak_wood"),
		"iron_after": _count("iron_scrap"),
		"fragment_after_prepare": _count("quarry_core_fragment"),
		"expected_outputs": {"quarry_core_fragment": 4},
		"checks": {"checks_passed": 0, "checks_failed": 0},
	}
	if not _write_receipt("r13_p1_receipt.json", receipt):
		_fail_process("P1", "could not write receipt")
		return
	print("P1 PASSED - pid=%d job=%s bindings=%s" % [OS.get_process_id(), job_id, a3.bindings_document_sha256().left(12)])
	quit(0)

## --- process 2 ---

func _run_process_2() -> void:
	var p1: Variant = _read_receipt("r13_p1_receipt.json")
	if not p1 is Dictionary:
		_fail_process("P2", "missing or invalid P1 receipt")
		return
	var receipt: Dictionary = p1
	var job_id := String(receipt.get("job_id", ""))
	var expected_output := int((receipt.get("expected_outputs", {}) as Dictionary).get("quarry_core_fragment", 0))
	var checks_passed := 0
	var checks_failed := 0

	## 1. Durable custody and inventory survived the process boundary.
	if a3.is_source_authenticated(SOURCE_CACHE):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL source custody lost across reload")
	if String(a3.source_auth_record(SOURCE_CACHE).get("bindings_sha256", "")) == a3.bindings_document_sha256():
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL binding hash changed across reload")
	if a3.is_recipe_known(RECIPE_MATERIAL):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL learned recipe lost across reload")
	if a3.jobs().has(job_id):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL job lost across reload")
	if _count("oak_wood") == int(receipt.get("oak_after", -1)) and _count("iron_scrap") == int(receipt.get("iron_after", -1)):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL prepaid inventory changed across reload")
	if _count("quarry_core_fragment") == 0:
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL output appeared before maturity")

	## 2. Refusal before maturity — no clock, no output.
	var early: Dictionary = a3.claim_production(job_id, "r13.p2.collect.early")
	if not bool(early.get("ok", true)) and String(early.get("reason", "")) == "nothing_to_collect":
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL early claim was not refused: %s" % [early])
	if _count("quarry_core_fragment") == 0:
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL early refusal granted output")

	## 3. Mature through the canonical A0 time receipt, then grant exactly once.
	var tick: Dictionary = _tick_station("workbench", 20, "r13.p2.tick.workbench")
	if bool(tick.get("ok", false)):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL maturity advance refused: %s" % [tick])
	var collect: Dictionary = a3.claim_production(job_id, "r13.p2.collect.1")
	if not bool(collect.get("ok", false)):
		_fail_process("P2", "first collection refused: %s" % [collect.get("reason", "")])
		return
	if _count("quarry_core_fragment") == expected_output:
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL output quantity %d != %d" % [_count("quarry_core_fragment"), expected_output])
	var after_first := _count("quarry_core_fragment")

	## 4. Duplicate claim refused, inventory conserved.
	var duplicate: Dictionary = a3.claim_production(job_id, "r13.p2.collect.duplicate")
	if not bool(duplicate.get("ok", true)) and String(duplicate.get("reason", "")) == "nothing_to_collect":
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL duplicate claim was accepted: %s" % [duplicate])
	if _count("quarry_core_fragment") == after_first:
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL duplicate claim changed inventory")

	## 5. Conservation across the whole chain: outputs + inputs + escrow.
	var conservation: Dictionary = _conservation(receipt)
	if bool(conservation.get("ok", false)):
		checks_passed += 1
	else:
		checks_failed += 1
		print("P2 FAIL conservation: %s" % [conservation])

	var out: Dictionary = receipt.duplicate(true)
	out["role"] = "process_2"
	out["pid"] = OS.get_process_id()
	out["p1_pid"] = int(receipt.get("pid", 0))
	out["save_path"] = save_path
	out["reload"] = {
		"source_authenticated": a3.is_source_authenticated(SOURCE_CACHE),
		"recipe_known": a3.is_recipe_known(RECIPE_MATERIAL),
		"job_present": a3.jobs().has(job_id),
		"job_status_after_maturity": String(a3.job(job_id).get("status", "")),
	}
	out["early_refusal"] = early
	out["collect"] = collect
	out["duplicate"] = duplicate
	out["output_after_first_claim"] = after_first
	out["output_after_duplicate"] = _count("quarry_core_fragment")
	out["conservation"] = conservation
	out["checks"] = {"checks_passed": checks_passed, "checks_failed": checks_failed}
	if not _write_receipt("r13_p2_receipt.json", out):
		_fail_process("P2", "could not write receipt")
		return
	print("P2 PASSED - pid=%d job=%s granted=%d duplicate_refused=%s checks=%d/%d" % [
		OS.get_process_id(), job_id, after_first, str(duplicate.get("reason", "")), checks_passed, checks_passed + checks_failed,
	])
	quit(0 if checks_failed == 0 else 1)

## Conservation over the durable document: no item is created by a refusal and
## the prepaid inputs are exactly the ones the receipt recorded.
func _conservation(p1_receipt: Dictionary) -> Dictionary:
	var problems: Array[String] = []
	if _count("quarry_core_fragment") != int((p1_receipt.get("expected_outputs", {}) as Dictionary).get("quarry_core_fragment", -1)):
		problems.append("output_batch_mismatch")
	if _count("oak_wood") != int(p1_receipt.get("oak_after", -2)):
		problems.append("oak_input_drift")
	if _count("iron_scrap") != int(p1_receipt.get("iron_after", -2)):
		problems.append("iron_input_drift")
	if _transaction_count_prefix("soh.a3.source_claim.") != 1:
		problems.append("source_claim_receipt_count")
	if _mastery().has("a3_station_jobs"):
		problems.append("ghost_a3_queue")
	return {
		"ok": problems.is_empty(),
		"problems": problems,
		"output": _count("quarry_core_fragment"),
		"source_claim_receipts": _transaction_count_prefix("soh.a3.source_claim."),
	}

## --- process helpers ---

func _fail_process(label: String, message: String) -> void:
	print("%s FAILED - %s" % [label, message])
	quit(1)

func _write_receipt(file_name: String, payload: Dictionary) -> bool:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(receipt_dir))
	var file := FileAccess.open(receipt_dir + "/" + file_name, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(payload, "\t"))
	file.close()
	return true

func _read_receipt(file_name: String) -> Variant:
	var file := FileAccess.open(receipt_dir + "/" + file_name, FileAccess.READ)
	if file == null:
		return null
	var text := file.get_as_text()
	file.close()
	return JSON.parse_string(text)

## --- results ---

func _emit_results() -> void:
	print("")
	print("=== R13 Native Results ===")
	print("passed=%d failed=%d total=%d" % [passed_count, failed_count, passed_count + failed_count])
	for entry: Dictionary in test_results:
		if not bool(entry.get("passed", false)):
			print("  [FAIL] %s - %s" % [entry.get("group", ""), entry.get("message", "")])
	if failed_count == 0:
		print("R13 NATIVE PASSED - %d checks" % [passed_count])
		quit(0)
		return
	print("R13 NATIVE FAILED")
	quit(1)
