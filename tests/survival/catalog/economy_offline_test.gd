extends SceneTree
## V6 native prepared-offline tests against the REAL SaveService.
## The clock/station/needs producers are explicit A0-style fixtures, not a
## production wall-clock authority, shelter validator, or human playtest.

const SaveServiceClass = preload("res://game/autoload/save_service.gd")
const Economy = preload("res://game/survival/economy/economy_service.gd")
const RUN_START := 1800000000
const RUN_SECONDS := 1209600
const WORLD_US_PER_REAL_SECOND := 36000000 # fixture-only 40-minute world day; NOT user locked

var checks := 0
var failures: Array[String] = []
var case_id := 0
var save: Node
var eco: RefCounted
var stations := {}
var path := ""
var host_current: Dictionary = {}
var projection_sequence := 0
var offline_now := RUN_START
var world_active_seconds := 0
var world_cell := Vector2i(408, 199)
var active_ticks := {}
var active_sequence := 0

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _begin(label: String) -> void:
	case_id += 1
	print("[offline case %02d] %s" % [case_id, label])
	path = "user://tests/a3_offline_%d_%d.json" % [Time.get_ticks_usec(), case_id]
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh authoritative save")
	stations = {}
	projection_sequence = 0
	offline_now = RUN_START
	world_active_seconds = 0
	world_cell = Vector2i(408, 199)
	active_ticks = {}
	active_sequence = 0
	eco = Economy.new()
	_expect(bool(eco.configure(save, _resolve)), "catalog + real SaveService adapter")
	_expect(bool(eco.configure_offline_time_host(_offline_host)), "opt-in offline time host")
	eco.configure_time_host(_active_host)
	eco.configure_world_host(_world_host)

func _resolve(id: String) -> Dictionary:
	return stations.get(id, {}).duplicate(true)

func _station(id: String, kind: String) -> void:
	stations[id] = {"ok": true, "station_id": id, "kind": kind, "tier": 1,
		"queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "rev-1"}

func _offline_host() -> Dictionary:
	return host_current.duplicate(true)

func _active_host(station_id: String) -> Dictionary:
	return {"contract": "soh.economy.active_tick.v1", "station_id": station_id,
		"session_id": "online-session", "session_index": 1, "sequence": active_sequence,
		"active_ticks": int(active_ticks.get(station_id, 0)),
		"station_revision": str(stations.get(station_id, {}).get("station_revision", "hand"))}

func _projection(start_unix: int, end_unix: int) -> Dictionary:
	projection_sequence += 1
	var station_projection := {}
	for id: Variant in stations.keys():
		var st: Dictionary = stations[id]
		station_projection[str(id)] = {"owner_run_id": "run-v6", "station_revision": str(st.station_revision),
			"operational": bool(st.operational), "condition": int(st.condition)}
	return {
		"contract": "soh.economy.offline_time.v1", "run_id": "run-v6",
		"run_started_at_unix": RUN_START, "run_expires_at_unix": RUN_START + RUN_SECONDS,
		"interval_start_unix": start_unix, "interval_end_unix": end_unix,
		"last_authenticated_unix": start_unix, "projection_sequence": projection_sequence,
		"projection_id": "fixture-projection-%d" % projection_sequence,
		"world_calendar": {"run_id": "run-v6", "calendar_id": "fixture-calendar", "rate_policy_id": "fixture-40min-day-NOT-LOCKED",
			"start_world_us": (start_unix - RUN_START) * WORLD_US_PER_REAL_SECOND,
			"end_world_us": (end_unix - RUN_START) * WORLD_US_PER_REAL_SECOND, "rate_approval": "NOT_USER_LOCKED"},
		"stations": station_projection
	}

func _world_host(_poi_id: String) -> Dictionary:
	return {"contract": "soh.economy.world_host.v1", "poi_id": "poi_crown_waystation", "discovered": true,
		"hero_cell": world_cell, "active_seconds": world_active_seconds, "session_id": "offline-world",
		"session_index": 1, "sequence": 0, "world_revision": "rev-1"}

func _give(id: String, amount: int) -> void:
	var kind := str(eco.item(id).get("kind", "material"))
	if kind in ["station_kit", "equipment", "skill_core"]:
		kind = "material"
	_expect(bool(save.call(&"grant_inventory_item", id, kind, amount, "offline.fixture.%d.%s.%d" % [case_id, id, Time.get_ticks_usec()])), "fixture grant " + id)

func _count(id: String) -> int:
	return int(eco.inventory_totals().get(id, 0))

func _snapshot() -> Dictionary:
	return save.call(&"get_snapshot")

func _arm(job_id: String) -> Dictionary:
	host_current = _projection(offline_now, offline_now)
	return eco.arm_offline_operation(job_id, "arm.%d.%s" % [case_id, job_id])

func _plan(start_unix: int, end_unix: int) -> Dictionary:
	host_current = _projection(start_unix, end_unix)
	return eco.plan_offline_operations(host_current)

func _commit(proposal: Dictionary) -> Dictionary:
	var key := "soh.a3.offline_settle." + str(proposal.get("proposal_id", ""))
	if bool(save.call(&"is_transaction_applied", key)):
		return {"ok": true, "duplicate": true}
	var request := host_current.duplicate(true)
	var result := {"ok": false, "reason": "rejected"}
	var applied: bool = bool(save.call(&"transact_once", key, func(candidate: Dictionary) -> bool:
		var applied_result: Dictionary = eco.apply_offline_operation_plan(candidate, proposal, request)
		for result_key: Variant in applied_result.keys():
			result[result_key] = applied_result[result_key]
		return bool(applied_result.get("ok", false)),
		{"kind": "a3_offline_settlement", "proposal_id": str(proposal.get("proposal_id", ""))}))
	if not applied:
		if bool(save.call(&"is_transaction_applied", key)):
			return {"ok": true, "duplicate": true}
		if bool(result.get("ok", false)):
			return {"ok": false, "reason": "save_failed"}
		return result
	result["duplicate"] = false
	return result

func _settle(start_unix: int, end_unix: int) -> Dictionary:
	var proposal := _plan(start_unix, end_unix)
	if not bool(proposal.get("ok", false)):
		return proposal
	var committed := _commit(proposal)
	if bool(committed.get("ok", false)):
		offline_now = end_unix
	return committed

func _fill_bag() -> void:
	var fill := func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		var stacks := {}
		for i in range(30):
			stacks["a3_offline_fill_%02d" % i] = {"item_id": "oak_wood", "kind": "material", "quantity": 50,
				"metadata": {"source": "native_fixture_capacity"}}
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "offline.fill.%d" % case_id, fill)), "fixture fills bag")

func _clear_bag() -> void:
	var clear := func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		inventory["item_stacks"] = {}
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "offline.clear.%d" % case_id, clear)), "fixture clears bag")

func _online_advance(station_id: String, seconds: int) -> void:
	var remaining := seconds
	var ticks := 0
	var guard := 0
	while remaining > 0 and guard < 400:
		var step := mini(600, remaining)
		ticks += step
		remaining -= step
		guard += 1
		active_ticks[station_id] = ticks
		active_sequence = guard
		var receipt := _active_host(station_id)
		var advanced: Dictionary = eco.advance(station_id, receipt, "online.%d.%s.%d" % [case_id, station_id, guard])
		if not bool(advanced.get("ok", false)):
			_expect(false, "online equivalent advance: " + str(advanced.get("reason", "")))
			return

func _case_parity(gap_seconds: int, label: String) -> void:
	_begin(label + " offline prepared forge")
	_station("furnace", "furnace")
	_give("oak_wood", 2); _give("iron_scrap", 3); _give("charcoal", 1)
	var job: Dictionary = eco.enqueue("smelt_iron", "furnace", "parity.offline.%d" % gap_seconds)
	_expect(bool(job.ok), "forge paid before absence")
	_expect(bool(_arm(str(job.job_id)).ok), "forge explicitly armed")
	var before := _snapshot()
	var proposal := _plan(RUN_START, RUN_START + gap_seconds)
	_expect(bool(proposal.ok) and str(proposal.contract) == "soh.economy.offline_plan.v1", "read-only offline plan")
	_expect(_snapshot() == before, "planning alone changes no save")
	_expect(int((proposal.operations[0] as Dictionary).applied_ticks) == 12, "only remaining paid forge ticks are proposed")
	_expect(bool(_commit(proposal).ok), "A0-style SaveService commit")
	_expect(str(eco.jobs()[job.job_id].status) == "ready", "forge ready after " + label)
	_expect(bool(eco.collect(str(job.job_id), "collect.offline.%d" % gap_seconds).ok), "player collects forge output")
	_expect(_count("iron_ingot") == 1 and _count("charcoal") == 0 and _count("iron_scrap") == 0, "offline output/fuel exact")

	_begin(label + " equivalent online forge")
	_station("furnace", "furnace")
	_give("oak_wood", 2); _give("iron_scrap", 3); _give("charcoal", 1)
	var online_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "parity.online.%d" % gap_seconds)
	_expect(bool(online_job.ok), "online forge paid")
	_online_advance("furnace", gap_seconds)
	_expect(str(eco.jobs()[online_job.job_id].status) == "ready", "online forge ready after same elapsed interval")
	_expect(bool(eco.collect(str(online_job.job_id), "collect.online.%d" % gap_seconds).ok), "online collect")
	_expect(_count("iron_ingot") == 1 and _count("charcoal") == 0 and _count("iron_scrap") == 0, "online/offline final inventory parity")

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		save = SaveServiceClass.new()
		save.name = "SaveService"
		root.add_child(save)

	_case_parity(7200, "2h")
	_case_parity(64800, "18h")
	_case_parity(172800, "48h")

	_begin("opt-in required; legacy active-only behavior unchanged")
	_station("furnace", "furnace")
	_give("oak_wood", 2)
	var unarmed: Dictionary = eco.enqueue("burn_charcoal", "furnace", "unarmed")
	_expect(bool(unarmed.ok), "legacy enqueue still works")
	var unarmed_plan := _plan(RUN_START, RUN_START + 64800)
	_expect(bool(unarmed_plan.ok) and (unarmed_plan.operations as Array).is_empty(), "unarmed job receives no offline progress")
	_expect(str(eco.jobs()[unarmed.job_id].status) == "queued" and int(eco.jobs()[unarmed.job_id].elapsed) == 0, "unarmed job unchanged")
	_expect(bool(_arm(str(unarmed.job_id)).ok), "explicit arm succeeds")
	_expect(bool(_settle(RUN_START, RUN_START + 64800).ok), "armed job settles")
	_expect(str(eco.jobs()[unarmed.job_id].status) == "ready", "armed job completes")

	_begin("missing fuel and tampered fuel escrow fail closed")
	_station("furnace", "furnace")
	_give("iron_scrap", 3)
	_expect(not bool(eco.enqueue("smelt_iron", "furnace", "no.fuel").ok), "smelt refuses without paid fuel")
	_give("charcoal", 1)
	var fuel_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "fuel.job")
	_expect(bool(_arm(str(fuel_job.job_id)).ok), "fuel-backed job armed")
	var corrupt := func(candidate: Dictionary) -> bool:
		candidate["survival_economy"]["jobs"][fuel_job.job_id]["reserved_fuel"] = {}
		return true
	_expect(bool(save.call(&"transact_once", "corrupt.fuel.%d" % case_id, corrupt)), "fixture tampers fuel escrow")
	var fuel_plan := _plan(RUN_START, RUN_START + 7200)
	_expect(bool(fuel_plan.ok) and (fuel_plan.operations as Array).is_empty(), "tampered fuel produces no operation")
	_expect(str((fuel_plan.blocked[0] as Dictionary).reason) == "fuel_escrow_mismatch", "fuel mismatch reason exact")
	_expect(int(eco.jobs()[fuel_job.job_id].elapsed) == 0, "tampered job did not advance")

	_begin("full storage keeps output in escrow; collect is atomic")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var full_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "full.job")
	_expect(bool(_arm(str(full_job.job_id)).ok), "full-bag job armed")
	_fill_bag()
	_expect(bool(_settle(RUN_START, RUN_START + 7200).ok), "settlement completes into job escrow")
	_expect(str(eco.jobs()[full_job.job_id].status) == "ready", "output waits ready, not lost")
	var full_before := _snapshot()
	var blocked_collect: Dictionary = eco.collect(str(full_job.job_id), "collect.full")
	_expect(not bool(blocked_collect.ok) and str(blocked_collect.reason) == "inventory_full", "full bag refuses collect")
	_expect(_snapshot() == full_before, "failed collect changes no inventory/job/receipt")
	_clear_bag()
	_expect(bool(eco.collect(str(full_job.job_id), "collect.after.clear").ok), "collect succeeds after space")
	_expect(_count("iron_ingot") == 1, "exactly one ingot after full-bag recovery")

	_begin("repeated settlement, replay and out-of-order rollback")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var repeat_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "repeat.job")
	_expect(bool(_arm(str(repeat_job.job_id)).ok), "repeat job armed")
	var repeat_proposal := _plan(RUN_START, RUN_START + 64800)
	_expect(bool(_commit(repeat_proposal).ok), "first 18h settlement")
	var after_first := _snapshot()
	var replay := _commit(repeat_proposal)
	_expect(bool(replay.ok) and bool(replay.get("duplicate", false)), "same proposal replay is receipt-idempotent")
	_expect(_snapshot() == after_first, "replay changes no save")
	var old_plan := _plan(RUN_START, RUN_START + 3600)
	_expect(not bool(old_plan.ok) and str(old_plan.reason) == "clock_rollback", "older interval rejected")
	_expect(bool(eco.collect(str(repeat_job.job_id), "collect.repeat").ok), "collect once")
	var later := _settle(RUN_START + 64800, RUN_START + 172800)
	_expect(bool(later.ok) and _count("iron_ingot") == 1, "later absence cannot duplicate completed output")

	_begin("crash before durable commit leaves no partial settlement")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var crash_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "crash.job")
	_expect(bool(_arm(str(crash_job.job_id)).ok), "crash job armed")
	var crash_proposal := _plan(RUN_START, RUN_START + 7200)
	var crash_before := _snapshot()
	var tmp_abs := ProjectSettings.globalize_path(path + ".tmp")
	_expect(DirAccess.make_dir_recursive_absolute(tmp_abs) == OK, "fixture obstructs temporary save write")
	var failed_commit := _commit(crash_proposal)
	_expect(not bool(failed_commit.ok), "obstructed commit fails")
	_expect(_snapshot() == crash_before, "failed commit leaves inventory/job/arm unchanged")
	DirAccess.remove_absolute(tmp_abs)
	_expect(bool(_commit(crash_proposal).ok), "retry after I/O repair commits once")
	_expect(str(eco.jobs()[crash_job.job_id].status) == "ready", "retry completes job")
	_expect(bool(eco.collect(str(crash_job.job_id), "collect.crash").ok) and _count("iron_ingot") == 1, "retry yields exactly one ingot")

	_begin("station revision change blocks offline progress")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var revision_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "revision.job")
	_expect(bool(_arm(str(revision_job.job_id)).ok), "revision job armed")
	stations["furnace"]["station_revision"] = "rev-2"
	var revision_plan := _plan(RUN_START, RUN_START + 7200)
	_expect(bool(revision_plan.ok) and (revision_plan.operations as Array).is_empty(), "changed station produces no delta")
	_expect(str((revision_plan.blocked[0] as Dictionary).reason) == "station_revision_mismatch", "station revision reason exact")
	_expect(int(eco.jobs()[revision_job.job_id].elapsed) == 0, "changed station job unchanged")

	_begin("14-real-day expiry clamps production and forbids post-expiry progress")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var expiry_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "expiry.job")
	offline_now = RUN_START + RUN_SECONDS - 5
	_expect(bool(_arm(str(expiry_job.job_id)).ok), "job armed five seconds before expiry")
	var expiry_proposal := _plan(RUN_START + RUN_SECONDS - 5, RUN_START + RUN_SECONDS + 100)
	_expect(bool(expiry_proposal.ok) and bool(expiry_proposal.run_expired), "expiry detected")
	_expect(int(expiry_proposal.effective_end_unix) == RUN_START + RUN_SECONDS, "settlement clamped to deadline")
	_expect(int((expiry_proposal.operations[0] as Dictionary).applied_ticks) == 5, "only five pre-expiry ticks proposed")
	_expect(bool(_commit(expiry_proposal).ok), "clamped settlement commits")
	_expect(str(eco.jobs()[expiry_job.job_id].status) == "running" and int(eco.jobs()[expiry_job.job_id].elapsed) == 5, "unfinished job does not complete after expiry")
	var post_expiry := _plan(RUN_START + RUN_SECONDS, RUN_START + RUN_SECONDS + 100)
	_expect(bool(post_expiry.ok) and (post_expiry.operations as Array).is_empty(), "post-expiry interval grants no work")

	_begin("expiry-adjacent completed job is claimable once")
	_station("furnace", "furnace")
	_give("iron_scrap", 3); _give("charcoal", 1)
	var near_job: Dictionary = eco.enqueue("smelt_iron", "furnace", "near.expiry")
	offline_now = RUN_START + RUN_SECONDS - 20
	_expect(bool(_arm(str(near_job.job_id)).ok), "near-expiry job armed")
	_expect(bool(_settle(RUN_START + RUN_SECONDS - 20, RUN_START + RUN_SECONDS + 10).ok), "near-expiry settlement")
	_expect(str(eco.jobs()[near_job.job_id].status) == "ready", "job completed before deadline")
	_expect(bool(eco.collect(str(near_job.job_id), "collect.near").ok) and _count("iron_ingot") == 1, "pre-expiry output exact")

	_begin("already-paid research completes offline without a new queue")
	_station("lab", "research")
	_give("knowledge_spares", 3); _give("research_notes", 1)
	var research: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "research.offline")
	_expect(bool(research.ok), "research paid before absence")
	_expect(bool(_arm(str(research.job_id)).ok), "research explicitly armed")
	_expect(bool(_settle(RUN_START, RUN_START + 64800).ok), "research settles offline")
	_expect(bool(eco.known("iron_pick")), "paid research knowledge unlocked")
	_expect(str(eco.jobs()[research.job_id].status) == "ready" and (eco.jobs()[research.job_id].outputs as Dictionary).is_empty(), "research creates no free item")
	_expect(bool(eco.collect(str(research.job_id), "collect.research").ok), "research receipt collected")
	_expect(eco.jobs().is_empty(), "no automatic next research queue")

	_begin("cultivation/Core/POI farming remain forbidden")
	_station("garden", "garden")
	_give("moonleaf_seed", 1); _give("compost", 1)
	var crop: Dictionary = eco.enqueue("grow_moonleaf", "garden", "crop.offline")
	_expect(bool(crop.ok), "legacy active-only cultivation can be paid")
	var crop_arm: Dictionary = _arm(str(crop.job_id))
	_expect(not bool(crop_arm.ok) and str(crop_arm.reason) == "operation_not_offline_eligible", "no approved offline crop yield")
	var offline_policy: Dictionary = eco.catalog.get("offline_policy", {})
	_expect((offline_policy.get("ineligible_categories", []) as Array).has("core") and (offline_policy.get("ineligible_categories", []) as Array).has("reconstruction"), "Core/reconstruction excluded from offline policy")
	_expect(str((offline_policy.get("collectors", {}) as Dictionary).get("status", "")).begins_with("DISABLED_"), "collectors disabled pending source authorization")
	_station("furnace", "furnace")
	_give("oak_wood", 2)
	var source_job: Dictionary = eco.enqueue("burn_charcoal", "furnace", "source.job")
	_expect(bool(_arm(str(source_job.job_id)).ok), "forge armed for source-cooldown isolation")
	world_cell = Vector2i(408, 199)
	_expect(bool(eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "pry_locker"}, "offline.locker").ok), "locker capability")
	world_cell = Vector2i(406, 202)
	var cache: Dictionary = eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock", "instance_id": "si:r_ashen_crown:waystation_cache:01"}, "offline.cache")
	_expect(bool(cache.ok), "canonical cache claimed once actively")
	var scrap_before := _count("iron_scrap")
	var spares_before := _count("knowledge_spares")
	_expect(bool(_settle(RUN_START, RUN_START + 172800).ok), "48h prepared forge settlement")
	_expect(_count("iron_scrap") == scrap_before and _count("knowledge_spares") == spares_before, "offline time minted no POI/cache loot")
	var projection: Dictionary = eco.world_projection("poi_crown_waystation")
	var cache_projection: Dictionary = {}
	for raw: Variant in projection.get("sources", []):
		if str((raw as Dictionary).instance_id) == "si:r_ashen_crown:waystation_cache:01":
			cache_projection = raw
	_expect(int(cache_projection.get("claim_count", 0)) == 1 and not bool(cache_projection.get("ready", true)), "1800 ACTIVE source cooldown unchanged by offline interval")

	_begin("D059 food forecast is read-only and bounded by real stock")
	_give("field_meal", 2)
	var food_before := _snapshot()
	host_current = _projection(RUN_START, RUN_START + 64800)
	var needs := {"contract": "soh.economy.offline_needs.v1", "run_id": "run-v6", "satiety": 100, "max_satiety": 100,
		"drain_per_hour": 100, "shelter": {"valid": true, "shelter_id": "home-1"},
		"food": [{"item_id": "field_meal", "quantity": 2, "satiety_per_unit": 100, "container_id": "bag"}],
		"custody_projection_id": "fixture-bag"}
	var forecast: Dictionary = eco.forecast_offline_food(host_current, needs)
	_expect(bool(forecast.ok), "food forecast accepted")
	_expect(int(forecast.satiety_required) == 1800 and int(forecast.satiety_provided_by_food) == 200, "18h food math exact")
	_expect(int((forecast.proposed_item_debits as Dictionary).get("field_meal", 0)) == 2, "only real food stock proposed for debit")
	_expect(int(forecast.satiety_after) == 0 and bool(forecast.food_exhausted), "stock exhaustion reported")
	_expect(bool(forecast.shelter_hp_floor_applies) and int(forecast.hp_delta) == 0 and not bool(forecast.a3_mutates_hp_or_hunger), "A0 owns sheltered 1HP floor; A3 forecasts only")
	_expect(_snapshot() == food_before, "forecast changes no save")
	needs["food"] = [{"item_id": "field_meal", "quantity": 3, "satiety_per_unit": 100, "container_id": "bag"}]
	var inflated: Dictionary = eco.forecast_offline_food(host_current, needs)
	_expect(not bool(inflated.ok) and str(inflated.reason).begins_with("food_stock_exceeds_save_custody"), "forecast cannot debit more food than the save owns")
	needs["food"] = [{"item_id": "field_meal", "quantity": 2, "satiety_per_unit": 100, "container_id": "bag"}]
	needs["shelter"] = {"valid": false, "shelter_id": ""}
	var wilderness: Dictionary = eco.forecast_offline_food(host_current, needs)
	_expect(bool(wilderness.ok) and bool(wilderness.wilderness_starvation_risk) and not bool(wilderness.shelter_hp_floor_applies), "unprotected risk is distinct")
	needs["food"] = []
	var empty_food: Dictionary = eco.forecast_offline_food(host_current, needs)
	_expect(bool(empty_food.ok) and bool(empty_food.food_exhausted) and (empty_food.proposed_item_debits as Dictionary).is_empty(), "no free food when pantry empty")

	_begin("prepared forge enables a concrete next home production choice")
	_station("furnace", "furnace")
	_station("bench", "workbench")
	_give("iron_scrap", 6); _give("charcoal", 2); _give("oak_wood", 4); _give("knowledge_spares", 3)
	var forge_a: Dictionary = eco.enqueue("smelt_iron", "furnace", "value.forge.a")
	var forge_b: Dictionary = eco.enqueue("smelt_iron", "furnace", "value.forge.b")
	_expect(bool(forge_a.ok) and bool(forge_b.ok), "two finite forge batches paid")
	_expect(not bool(eco.enqueue("research_kit", "bench", "value.before").ok), "research kit unaffordable before ingots exist")
	_expect(bool(_arm(str(forge_a.job_id)).ok) and bool(_arm(str(forge_b.job_id)).ok), "both batches armed")
	_expect(bool(_settle(RUN_START, RUN_START + 64800).ok), "18h return settlement")
	_expect(bool(eco.collect(str(forge_a.job_id), "value.collect.a").ok) and bool(eco.collect(str(forge_b.job_id), "value.collect.b").ok), "two ingots collected")
	_expect(_count("iron_ingot") == 2, "exact prepared output")
	var kit: Dictionary = eco.enqueue("research_kit", "bench", "value.after")
	_expect(bool(kit.ok), "returned ingots unlock paid research-kit construction")
	_expect(_count("iron_ingot") == 0 and _count("knowledge_spares") == 0 and _count("oak_wood") == 0, "next choice consumes real saved resources")

	if failures.is_empty():
		print("A3 OFFLINE OPERATIONS PASSED - %d checks / %d cases" % [checks, case_id])
		quit(0)
	else:
		print("A3 OFFLINE OPERATIONS FAILED - %d/%d" % [failures.size(), checks])
		for f in failures:
			print("  - " + f)
		quit(1)
