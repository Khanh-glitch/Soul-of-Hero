extends SceneTree
## Two independent OS processes, one durable SaveService save. Phase one arms a
## paid forge/research operation; phase two projects 18h of authenticated offline
## time, commits once, replays the proposal, and proves no retroactive duplication.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const Economy = preload("res://game/survival/economy/economy_service.gd")
const PATH := "user://tests/a3_offline_two_process.json"
const RUN_START := 1800000000
const RUN_SECONDS := 1209600
const GAP := 64800

var checks := 0
var failures: Array[String] = []
var save: Node
var eco: RefCounted
var stations := {}
var host_current: Dictionary = {}
var sequence := 0

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _resolve(id: String) -> Dictionary:
	return stations.get(id, {}).duplicate(true)

func _offline_host() -> Dictionary:
	return host_current.duplicate(true)

func _projection(start_unix: int, end_unix: int) -> Dictionary:
	sequence += 1
	var station_projection := {}
	for id: Variant in stations.keys():
		station_projection[str(id)] = {"owner_run_id": "run-v6-restart", "station_revision": "rev-1", "operational": true, "condition": 100}
	return {"contract": "soh.economy.offline_time.v1", "run_id": "run-v6-restart",
		"run_started_at_unix": RUN_START, "run_expires_at_unix": RUN_START + RUN_SECONDS,
		"interval_start_unix": start_unix, "interval_end_unix": end_unix,
		"last_authenticated_unix": start_unix, "projection_sequence": sequence,
		"projection_id": "restart-projection-%d" % sequence,
		"world_calendar": {"run_id": "run-v6-restart", "calendar_id": "fixture-calendar", "rate_policy_id": "fixture-40min-day-NOT-LOCKED",
			"start_world_us": (start_unix - RUN_START) * 36000000, "end_world_us": (end_unix - RUN_START) * 36000000,
			"rate_approval": "NOT_USER_LOCKED"}, "stations": station_projection}

func _give(id: String, amount: int, event: String) -> void:
	_expect(bool(save.call(&"grant_inventory_item", id, "material", amount, event)), "grant " + id)

func _commit(proposal: Dictionary) -> Dictionary:
	var key := "soh.a3.offline_restart." + str(proposal.proposal_id)
	if bool(save.call(&"is_transaction_applied", key)):
		return {"ok": true, "duplicate": true}
	var request := host_current.duplicate(true)
	var result := {"ok": false, "reason": "rejected"}
	var applied: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var applied_result: Dictionary = eco.apply_offline_operation_plan(candidate, proposal, request)
		for result_key: Variant in applied_result.keys():
			result[result_key] = applied_result[result_key]
		return bool(applied_result.get("ok", false)), {"kind": "a3_offline_restart_settlement", "proposal_id": str(proposal.proposal_id)}))
	if not applied:
		if bool(save.call(&"is_transaction_applied", key)):
			return {"ok": true, "duplicate": true}
		if bool(result.get("ok", false)):
			return {"ok": false, "reason": "save_failed"}
	result["duplicate"] = false
	return result

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		save = SaveServiceClass.new()
		save.name = "SaveService"
		root.add_child(save)
	var phase := OS.get_environment("A3_OFFLINE_RESTART_PHASE")
	_expect(bool(save.call(&"configure_storage", PATH)), "real SaveService storage")
	stations = {"furnace": {"ok": true, "station_id": "furnace", "kind": "furnace", "tier": 1, "queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "rev-1"},
		"lab": {"ok": true, "station_id": "lab", "kind": "research", "tier": 1, "queue_capacity": 2, "operational": true, "condition": 100, "station_revision": "rev-1"}}
	if phase == "1":
		_expect(bool(save.call(&"reset_to_defaults", SaveServiceClass.RESET_ALL_TOKEN)), "explicit test-only reset before phase one")
		eco = Economy.new()
		_expect(bool(eco.configure(save, _resolve)) and bool(eco.configure_offline_time_host(_offline_host)), "phase one adapter")
		_give("iron_scrap", 3, "restart.scrap")
		_give("charcoal", 1, "restart.charcoal")
		_give("knowledge_spares", 3, "restart.spares")
		_give("research_notes", 1, "restart.notes")
		var forge: Dictionary = eco.enqueue("smelt_iron", "furnace", "restart.forge")
		var research: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "restart.research")
		_expect(bool(forge.ok) and bool(research.ok), "paid forge and targeted research before process exit")
		host_current = _projection(RUN_START, RUN_START)
		_expect(bool(eco.arm_offline_operation(str(forge.job_id), "restart.arm.forge").ok), "forge armed before exit")
		_expect(bool(eco.arm_offline_operation(str(research.job_id), "restart.arm.research").ok), "research armed before exit")
		var armed: Dictionary = eco.offline_operation_state()
		_expect((armed.armed as Dictionary).size() == 2, "two durable arm records")
		_expect(int(armed.last_authenticated_unix) == RUN_START, "no retroactive interval before arm")
	elif phase == "2":
		eco = Economy.new()
		_expect(bool(eco.configure(save, _resolve)) and bool(eco.configure_offline_time_host(_offline_host)), "fresh process reloads durable save")
		var armed_before: Dictionary = eco.offline_operation_state()
		_expect((armed_before.armed as Dictionary).size() == 2, "both arm records survived process boundary")
		_expect(not bool(eco.known("iron_pick")), "research not completed by load alone")
		host_current = _projection(RUN_START, RUN_START + GAP)
		var proposal: Dictionary = eco.plan_offline_operations(host_current)
		_expect(bool(proposal.ok) and (proposal.operations as Array).size() == 2, "18h plan covers only armed paid operations")
		var before: Dictionary = save.call(&"get_snapshot")
		var proposal_readonly: Dictionary = eco.plan_offline_operations(host_current)
		_expect(bool(proposal_readonly.ok), "read-only plan repeats deterministically")
		_expect(save.call(&"get_snapshot") == before, "read-only plan changed no save")
		var committed := _commit(proposal)
		_expect(bool(committed.ok) and not bool(committed.get("duplicate", false)), "A0-style SaveService applies proposal once")
		_expect(bool(eco.known("iron_pick")), "paid research completed across process boundary")
		var jobs: Dictionary = eco.jobs()
		var forge_ready := false
		for raw: Variant in jobs.values():
			var job: Dictionary = raw
			if str(job.kind) == "craft" and str(job.status) == "ready":
				forge_ready = true
		_expect(forge_ready, "forge output ready across process boundary")
		var replay := _commit(proposal)
		_expect(bool(replay.ok) and bool(replay.get("duplicate", false)), "replayed proposal is idempotent")
		var after_replay: Dictionary = save.call(&"get_snapshot")
		_expect(after_replay == save.call(&"get_snapshot"), "replay changed no save")
		host_current = _projection(RUN_START, RUN_START + 7200)
		var rollback: Dictionary = eco.plan_offline_operations(host_current)
		_expect(not bool(rollback.ok) and str(rollback.reason) == "clock_rollback", "older timestamp projection rejected")
		var collected := 0
		for raw_id: Variant in jobs.keys():
			var collected_result: Dictionary = eco.collect(str(raw_id), "restart.collect." + str(raw_id))
			if bool(collected_result.ok):
				collected += 1
		_expect(collected == 2, "both ready jobs collected once")
		_expect(int(eco.inventory_totals().get("iron_ingot", 0)) == 1, "exactly one ingot after 18h restart")
		_expect(eco.jobs().is_empty(), "no automatic queue continuation")
		host_current = _projection(RUN_START + GAP, RUN_START + GAP * 2)
		var later: Dictionary = eco.plan_offline_operations(host_current)
		_expect(bool(later.ok) and (later.operations as Array).is_empty(), "later absence cannot farm completed operations")
		_expect(bool(_commit(later).ok), "empty later settlement commits idempotently")
		_expect(int(eco.inventory_totals().get("iron_ingot", 0)) == 1, "no second ingot after later settlement")
	else:
		_expect(false, "A3_OFFLINE_RESTART_PHASE must be 1 or 2")
	if failures.is_empty():
		print("A3 OFFLINE RESTART PHASE %s PASSED - %d checks" % [phase, checks])
		quit(0)
	else:
		print("A3 OFFLINE RESTART PHASE %s FAILED - %d/%d" % [phase, failures.size(), checks])
		for f in failures:
			print("  - " + f)
		quit(1)
