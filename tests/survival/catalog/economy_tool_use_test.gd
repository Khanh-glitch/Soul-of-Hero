extends SceneTree
## V5 A0 handoff callable, native-fixture tested. This is NOT an A0 harvest
## integration and NOT a yield multiplier. A0 must commit the tool plan in the
## same SaveService transaction as the physical node hit and inventory grant.
const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const Economy = preload("res://game/survival/economy/economy_service.gd")
var checks := 0
var failures: Array[String] = []
var save: Node
var eco: RefCounted
var path := ""

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _request(tool_id: String, revision: int, kind := "stone_outcrop") -> Dictionary:
	return {"contract": "soh.economy.tool_use.v1", "node_id": "a3_stone_1", "resource_kind": kind,
		"tool_instance_id": tool_id, "expected_tool_revision": revision,
		"world_revision": "fixture-world-rev-1", "active_seconds": 12}

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		save = SaveServiceClass.new()
		save.name = "SaveService"
		root.add_child(save)
	path = "user://tests/a3_tool_use_%d.json" % Time.get_ticks_usec()
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh authoritative save")
	eco = Economy.new()
	_expect(bool(eco.configure(save)), "adapter configured")
	var pick: Dictionary = eco.grant_instance("stone_pick", "fixture.tool.pick")
	_expect(bool(pick.ok), "fixture owns a unique stone pick")
	var tool_id := str(pick.instance_id)
	var before: Dictionary = save.call(&"get_snapshot")
	var plan: Dictionary = eco.plan_tool_use(_request(tool_id, 0))
	_expect(bool(plan.ok) and bool(plan.allowed), "read-only tool plan allowed")
	_expect(int(plan.condition_cost) == 1 and int(plan.next_tool_revision) == 1 and int(plan.yield_multiplier) == 1, "condition cost exact; no yield multiplier")
	_expect(save.call(&"get_snapshot") == before, "planning alone changes no save")
	var wrong_kind: Dictionary = eco.plan_tool_use(_request(tool_id, 0, "scrap_pile"))
	_expect(not bool(wrong_kind.ok) and str(wrong_kind.reason) == "TOOL_KIND_MISMATCH", "stone pick cannot salvage scrap pile")
	var unknown_node: Dictionary = eco.plan_tool_use(_request(tool_id, 0, "fictional_node"))
	_expect(not bool(unknown_node.ok) and str(unknown_node.reason) == "NODE_KIND_UNKNOWN", "unknown node kind rejected")
	var stale: Dictionary = eco.plan_tool_use(_request(tool_id, 1))
	_expect(not bool(stale.ok) and str(stale.reason) == "TOOL_REVISION_STALE", "stale tool revision rejected")
	var foreign: Dictionary = eco.plan_tool_use(_request("soh_i_000000999999_0123abcd", 0))
	_expect(not bool(foreign.ok) and str(foreign.reason) == "TOOL_NOT_OWNED", "foreign tool token rejected")
	var atomic_debug := {"stage": "not_started", "result": {}}
	var mutator := func(candidate: Dictionary) -> bool:
		# Fixture stands in for A0's atomic node hit + yield grant. The real A0
		# harvest must perform its own node/inventory mutations in this candidate.
		if not bool(save.call(&"add_items_to_candidate", candidate, "stone_chunk", "material", 1, {"source": "native_fixture_node"})):
			atomic_debug["stage"] = "yield_grant"
			return false
		var result: Dictionary = eco.apply_tool_use_plan(candidate, plan)
		atomic_debug["stage"] = "tool_plan"
		atomic_debug["result"] = result
		return bool(result.get("ok", false))
	var applied: bool = bool(save.call(&"transact_once", "fixture.tool_use.atomic.1", mutator, {"kind": "native_fixture_atomic_tool_harvest"}))
	if not applied:
		print("  atomic_debug=" + str(atomic_debug) + " last_error=" + str(eco.last_error) + " plan_contract=" + str(plan.get("contract", "")) + " plan_request=" + str(plan.has("request")))
	_expect(applied, "tool wear commits only with fixture node yield")
	var record: Dictionary = eco.instance(tool_id)
	_expect(int(record.condition) == 99 and int(record.revision) == 1, "condition/revision advanced once")
	_expect(int(eco.inventory_totals().get("stone_chunk", 0)) == 1, "fixture yield exact")
	var replay: bool = bool(save.call(&"transact_once", "fixture.tool_use.atomic.1", func(_candidate: Dictionary) -> bool: return true))
	_expect(not replay, "same transaction key cannot wear tool twice")
	var stale_apply: Dictionary = eco.apply_tool_use_plan(save.call(&"get_snapshot"), plan)
	_expect(not bool(stale_apply.ok), "old plan cannot be applied after revision advance")
	var broken: Dictionary = eco.grant_instance("iron_pick", "fixture.tool.broken", -1, 0)
	_expect(bool(broken.ok), "fixture broken iron pick")
	var broken_plan: Dictionary = eco.plan_tool_use(_request(str(broken.instance_id), 0, "iron_vein"))
	_expect(not bool(broken_plan.ok) and str(broken_plan.reason) == "TOOL_BROKEN", "broken tool cannot authorize a swing")
	# WP2 interrupted write: real SaveService I/O failure rolls back tool wear AND yield.
	var tmp_abs: String = ProjectSettings.globalize_path(path + ".tmp")
	_expect(DirAccess.make_dir_recursive_absolute(tmp_abs) == OK, "fixture obstructs temporary save write")
	var fresh_plan: Dictionary = eco.plan_tool_use(_request(tool_id, 1))
	_expect(bool(fresh_plan.ok), "fresh plan after committed wear")
	var interrupted: Callable = func(candidate: Dictionary) -> bool:
		if not bool(save.call(&"add_items_to_candidate", candidate, "stone_chunk", "material", 1, {"source": "native_fixture_interrupted"})):
			return false
		var result: Dictionary = eco.apply_tool_use_plan(candidate, fresh_plan)
		return bool(result.get("ok", false))
	var blocked: bool = bool(save.call(&"transact_once", "fixture.tool_use.interrupted.1", interrupted, {"kind": "native_fixture_interrupted"}))
	_expect(not blocked, "obstructed write fails closed")
	_expect(int(eco.instance(tool_id).get("condition", -1)) == 99, "tool not worn on interrupted write")
	_expect(int(eco.inventory_totals().get("stone_chunk", 0)) == 1, "interrupted write grants no yield")
	DirAccess.remove_absolute(tmp_abs)
	var recovered: bool = bool(save.call(&"transact_once", "fixture.tool_use.interrupted.1", func(candidate: Dictionary) -> bool:
		var result: Dictionary = eco.apply_tool_use_plan(candidate, fresh_plan)
		if not bool(save.call(&"add_items_to_candidate", candidate, "stone_chunk", "material", 1, {"source": "native_fixture_recovered"})):
			return false
		return bool(result.get("ok", false)), {"kind": "native_fixture_recovered"}))
	_expect(recovered, "retry after I/O repair commits once")
	_expect(int(eco.instance(tool_id).get("condition", -1)) == 98, "retry wears tool exactly once more")
	_expect(int(eco.inventory_totals().get("stone_chunk", 0)) == 2, "retry grants exact yield")

	# WP2 full inventory: full bag rejects harvest before tool wear and before any yield.
	var clear_sc: Callable = func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		var stacks: Dictionary = inventory.get("item_stacks", {}).duplicate(true)
		stacks.erase("stone_chunk")
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "fixture.tool_use.empty_stone_chunk", clear_sc)), "fixture empties stone_chunk stack")
	var fill_bag: Callable = func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		var stacks: Dictionary = {}
		var i := 0
		while stacks.size() < 30:
			stacks["a3_fullbag_%02d" % i] = {"item_id": "oak_wood", "kind": "material", "quantity": 50}
			i += 1
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "fixture.tool_use.fill_bag", fill_bag)), "fixture fills bag to 30 stack capacity")
	var stacks_before: Dictionary = (save.call(&"get_inventory_stacks") as Dictionary)
	_expect(stacks_before.size() == 30, "bag is full: 30 stacks")
	var stone_before: int = int(eco.inventory_totals().get("stone_chunk", 0))
	_expect(stone_before == 0, "stone_chunk cleared before capacity test")
	var tool_before: int = int(eco.instance(tool_id).get("condition", -1))
	_expect(tool_before == 98, "tool condition recorded before capacity test")
	var save_before: Dictionary = save.call(&"get_snapshot")
	var full_bag_plan: Dictionary = eco.plan_tool_use(_request(tool_id, 2))
	_expect(bool(full_bag_plan.ok), "fresh plan for full-bag harvest")
	_expect(str(full_bag_plan.get("node_id", "")) == "a3_stone_1", "plan targets the correct node")
	_expect(str(full_bag_plan.get("resource_kind", "")) == "stone_outcrop", "plan targets correct resource kind")
	var full_bag_mut: Callable = func(candidate: Dictionary) -> bool:
		if not bool(save.call(&"add_items_to_candidate", candidate, "stone_chunk", "material", 1, {"source": "native_fixture_full_bag"})):
			return false
		var result: Dictionary = eco.apply_tool_use_plan(candidate, full_bag_plan)
		return bool(result.get("ok", false))
	var full_bag_res: bool = bool(save.call(&"transact_once", "fixture.tool_use.full_bag_harvest", full_bag_mut, {"kind": "native_fixture_full_bag"}))
	_expect(not full_bag_res, "full-bag harvest fails closed")
	_expect(save.call(&"get_snapshot") == save_before, "full-bag harvest changes no save")
	_expect(int(eco.instance(tool_id).get("condition", -1)) == tool_before, "full-bag harvest does not wear tool")
	_expect(int(eco.inventory_totals().get("stone_chunk", 0)) == stone_before, "full-bag harvest grants no yield")
	var stacks_after: Dictionary = (save.call(&"get_inventory_stacks") as Dictionary)
	_expect(stacks_after.size() == 30, "full-bag harvest does not add a stack")
	if failures.is_empty():
		print("A3 TOOL USE CALLABLE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A3 TOOL USE CALLABLE FAILED - %d/%d" % [failures.size(), checks])
		for f in failures:
			print("  - " + f)
		quit(1)
