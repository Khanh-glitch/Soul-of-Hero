extends RefCounted
## SURV-030A V6 additive offline-operation planner.
##
## This is NOT a second clock, inventory, or save authority. A0 injects one
## authenticated real-UTC/world-calendar projection; A3 plans bounded deltas for
## already-paid, explicitly armed jobs. A0 alone commits the returned proposal
## inside its existing SaveService transaction by calling apply_to_candidate().
##
## Time domains are deliberately separate:
##   D055 run deadline: real UTC, exactly 14 * 24 hours, including app closure.
##   D060 world calendar: A0-owned continuous projection; A3 does not choose a
##        fictional day/year length or weather rate.
##   operation clock: real elapsed seconds ONLY for armed prepared jobs.
##   V5 source cooldowns: remain ACTIVE-only in world_source_adapter/economy_service.

const TIME_CONTRACT := "soh.economy.offline_time.v1"
const PLAN_CONTRACT := "soh.economy.offline_plan.v1"
const NEEDS_CONTRACT := "soh.economy.offline_needs.v1"
const FOOD_FORECAST_CONTRACT := "soh.economy.offline_food_forecast.v1"
const RUN_SECONDS := 1209600
const MAX_OPERATIONS := 256
const MAX_UNIX := 4102444800
const MAX_WORLD_US := 9000000000000000000

var _adapter: RefCounted
var _policy: Dictionary = {}
var _policy_sha256 := ""
var _host: Callable

func configure(adapter: RefCounted, policy: Dictionary, host: Callable = Callable()) -> bool:
	_adapter = adapter
	_policy = policy.duplicate(true)
	_policy_sha256 = canonical_sha256(_policy)
	_host = host if host.is_valid() else Callable()
	return validate_policy() == ""

func set_host(host: Callable) -> void:
	_host = host if host.is_valid() else Callable()

func policy_sha256() -> String:
	return _policy_sha256

func validate_policy() -> String:
	if _policy.is_empty():
		return "missing_offline_policy"
	if int(_policy.get("run_deadline_seconds", 0)) != RUN_SECONDS:
		return "invalid_run_deadline"
	if int(_policy.get("operation_tick_microseconds", 0)) != 1000000:
		return "unsupported_operation_tick"
	if bool(_policy.get("auto_collect", true)) or bool(_policy.get("auto_start_next_queue", true)):
		return "forbidden_automation"
	if str(_policy.get("output_custody", "")) != "EXISTING_JOB_ESCROW_UNTIL_PLAYER_COLLECT":
		return "unsupported_output_custody"
	if str(_policy.get("policy_id", "")).is_empty() or str(_policy.get("user_rate_approval", "")) != "NOT_USER_LOCKED":
		return "invalid_policy_identity_or_rate_approval"
	var max_armed := int(_policy.get("max_armed_operations", 0))
	if max_armed < 1 or max_armed > MAX_OPERATIONS:
		return "invalid_armed_operation_limit"
	for field in ["eligible_craft_recipes", "eligible_research_recipes", "eligible_technologies", "ineligible_categories", "active_only_sources_unchanged", "forbidden_offline_effects"]:
		if not _policy.get(field) is Array:
			return "invalid_policy_list:" + field
		for entry: Variant in (_policy[field] as Array):
			if not entry is String or str(entry).is_empty():
				return "invalid_policy_entry:" + field
	for category in ["core", "reconstruction"]:
		if not (_policy.get("ineligible_categories", []) as Array).has(category):
			return "forbidden_category_not_excluded:" + category
	for field in ["cultivation", "collectors"]:
		var section: Variant = _policy.get(field, {})
		if not section is Dictionary or not str((section as Dictionary).get("status", "")).begins_with("DISABLED_"):
			return "unapproved_offline_source:" + field
	if _adapter != null and not _adapter.catalog.is_empty():
		for rid: Variant in (_policy.get("eligible_craft_recipes", []) as Array):
			var r: Dictionary = _adapter.recipe(str(rid))
			if r.is_empty() or str(r.get("category", "")) in (_policy.get("ineligible_categories", []) as Array):
				return "invalid_eligible_craft_recipe:" + str(rid)
		for rid: Variant in (_policy.get("eligible_research_recipes", []) as Array):
			if _adapter.recipe(str(rid)).is_empty():
				return "invalid_eligible_research_recipe:" + str(rid)
		for tid: Variant in (_policy.get("eligible_technologies", []) as Array):
			if (_adapter.catalog.get("technologies", {}) as Dictionary).get(str(tid), {}).is_empty():
				return "invalid_eligible_technology:" + str(tid)
	return ""

## Godot JSON round-trips whole numbers as floats. Canonical hashing normalizes
## integral floats to ints so an arm/escrow/proposal hash survives save reload.
static func _canonical_value(value: Variant) -> Variant:
	if value is float:
		var f := float(value)
		if is_finite(f) and f == floor(f) and absf(f) <= 9000000000000000.0:
			return int(f)
		return f
	if value is Dictionary:
		var dict_out := {}
		for key: Variant in (value as Dictionary).keys():
			dict_out[str(key)] = _canonical_value((value as Dictionary)[key])
		return dict_out
	if value is Array:
		var array_out: Array = []
		for entry: Variant in (value as Array):
			array_out.append(_canonical_value(entry))
		return array_out
	return value

static func canonical_sha256(value: Variant) -> String:
	return JSON.stringify(_canonical_value(value), "", true, true).sha256_text()

static func empty_state() -> Dictionary:
	return {"schema": 1, "run_id": "", "last_authenticated_unix": 0, "last_projection_sequence": 0, "armed": {}}

static func _uint(value: Variant, maximum: int) -> bool:
	if not (value is int) and not (value is float):
		return false
	var n := float(value)
	return n >= 0.0 and n <= float(maximum) and n == floor(n)

static func state_error(raw: Variant) -> String:
	if not raw is Dictionary:
		return "invalid_offline_state"
	var s: Dictionary = raw
	if int(s.get("schema", 0)) != 1:
		return "unsupported_offline_schema"
	if not s.get("run_id", null) is String or not s.get("armed", null) is Dictionary:
		return "invalid_offline_state"
	if not _uint(s.get("last_authenticated_unix", null), MAX_UNIX):
		return "invalid_offline_high_water"
	if not _uint(s.get("last_projection_sequence", null), 1000000000000):
		return "invalid_offline_sequence"
	var armed: Dictionary = s.get("armed", {})
	if armed.size() > MAX_OPERATIONS:
		return "too_many_armed_operations"
	for job_id: Variant in armed.keys():
		var record: Variant = armed[job_id]
		if not record is Dictionary:
			return "invalid_arm_record"
		var r: Dictionary = record
		if str(r.get("job_id", "")) != str(job_id):
			return "arm_job_id_mismatch"
		for field in ["run_id", "station_id", "station_revision", "policy_sha256", "escrow_sha256"]:
			if not r.get(field, null) is String or str(r[field]).is_empty():
				return "invalid_arm_field:" + field
		for field in ["armed_at_unix", "last_settled_unix", "tick_microseconds", "duration_ticks", "elapsed_at_arm"]:
			if not _uint(r.get(field, null), 1000000000000):
				return "invalid_arm_number:" + field
		if int(r.get("tick_microseconds", 0)) != 1000000:
			return "unsupported_arm_tick"
	return ""

func _host_projection() -> Dictionary:
	if not _host.is_valid():
		return {}
	var value: Variant = _host.call()
	return value if value is Dictionary else {}

func _exact_host_request(request: Variant) -> String:
	if not request is Dictionary:
		return "invalid_offline_request"
	var host := _host_projection()
	if host.is_empty():
		return "offline_time_host_unavailable"
	if canonical_sha256(request) != canonical_sha256(host):
		return "offline_time_receipt_mismatch"
	return ""

func _validate_projection(p: Dictionary) -> String:
	var expected := ["contract", "run_id", "run_started_at_unix", "run_expires_at_unix",
		"interval_start_unix", "interval_end_unix", "last_authenticated_unix",
		"projection_sequence", "projection_id", "world_calendar", "stations"]
	if p.size() != expected.size():
		return "offline_projection_unknown_fields"
	for field in expected:
		if not p.has(field):
			return "offline_projection_missing:" + field
	if str(p.contract) != TIME_CONTRACT:
		return "offline_contract_mismatch"
	var run_id := str(p.run_id)
	if run_id.is_empty() or run_id.length() > 96:
		return "invalid_run_id"
	for field in ["run_started_at_unix", "run_expires_at_unix", "interval_start_unix", "interval_end_unix", "last_authenticated_unix"]:
		if not p[field] is int or int(p[field]) < 0 or int(p[field]) > MAX_UNIX:
			return "offline_timestamp_not_integer:" + field
	var started := int(p.run_started_at_unix)
	var expires := int(p.run_expires_at_unix)
	if expires != started + RUN_SECONDS:
		return "run_expiry_not_14_real_days"
	if int(p.interval_start_unix) < started or int(p.interval_end_unix) < int(p.interval_start_unix):
		return "invalid_offline_interval"
	if not p.projection_sequence is int or int(p.projection_sequence) < 0 or int(p.projection_sequence) > 1000000000000:
		return "invalid_projection_sequence"
	if not p.projection_id is String or str(p.projection_id).is_empty() or str(p.projection_id).length() > 128:
		return "invalid_projection_id"
	if not p.world_calendar is Dictionary or not p.stations is Dictionary:
		return "invalid_projection_domain"
	var calendar: Dictionary = p.world_calendar
	var calendar_fields := ["run_id", "calendar_id", "rate_policy_id", "start_world_us", "end_world_us", "rate_approval"]
	if calendar.size() != calendar_fields.size():
		return "world_calendar_unknown_fields"
	for field in calendar_fields:
		if not calendar.has(field):
			return "world_calendar_missing:" + field
	if str(calendar.run_id) != run_id:
		return "world_calendar_run_mismatch"
	if str(calendar.get("calendar_id", "")).is_empty() or str(calendar.get("rate_policy_id", "")).is_empty():
		return "invalid_world_calendar_identity"
	if str(calendar.get("rate_approval", "")) != "NOT_USER_LOCKED":
		return "world_calendar_rate_not_provisional"
	for field in ["start_world_us", "end_world_us"]:
		if not calendar[field] is int or int(calendar[field]) < 0 or int(calendar[field]) > MAX_WORLD_US:
			return "world_timestamp_not_integer:" + field
	if int(calendar.end_world_us) < int(calendar.start_world_us):
		return "world_calendar_regressed"
	for sid: Variant in (p.stations as Dictionary).keys():
		var station: Variant = p.stations[sid]
		if not station is Dictionary:
			return "invalid_station_projection"
		var st: Dictionary = station
		if str(st.get("owner_run_id", "")) != run_id:
			return "station_run_mismatch"
		if not st.get("station_revision", null) is String or str(st.station_revision).is_empty():
			return "invalid_station_revision"
		if not st.get("operational", null) is bool or not st.get("condition", null) is int:
			return "invalid_station_projection_state"
		if int(st.condition) < 0 or int(st.condition) > 100:
			return "invalid_station_condition"
	return ""

func _allowlisted(job: Dictionary) -> bool:
	var kind := str(job.get("kind", ""))
	var target := str(job.get("target", ""))
	if kind == "craft":
		var r: Dictionary = _adapter.recipe(target)
		if r.is_empty() or str(r.get("category", "")) in (_policy.get("ineligible_categories", []) as Array):
			return false
		return (_policy.get("eligible_craft_recipes", []) as Array).has(target)
	if kind == "research":
		return (_policy.get("eligible_research_recipes", []) as Array).has(target)
	if kind == "technology":
		return (_policy.get("eligible_technologies", []) as Array).has(target)
	return false

func _escrow_sha(job: Dictionary) -> String:
	return canonical_sha256({"reserved": job.get("reserved", {}), "reserved_fuel": job.get("reserved_fuel", {}),
		"reserved_instances": job.get("reserved_instances", {})})

func _paid_escrow_error(job: Dictionary) -> String:
	var kind := str(job.get("kind", ""))
	var reserved: Dictionary = job.get("reserved", {})
	var fuel: Dictionary = job.get("reserved_fuel", {})
	var instances: Dictionary = job.get("reserved_instances", {})
	if kind == "craft":
		var r: Dictionary = _adapter.recipe(str(job.get("target", "")))
		if r.is_empty() or not _adapter._valid_recipe_outputs(r):
			return "invalid_recipe_escrow"
		if canonical_sha256(reserved) != canonical_sha256(r.get("inputs", {})):
			return "input_escrow_mismatch"
		if canonical_sha256(fuel) != canonical_sha256(r.get("fuel", {})):
			return "fuel_escrow_mismatch"
		if not instances.is_empty():
			return "unexpected_craft_specimen"
	elif kind == "technology":
		var t: Dictionary = _adapter.catalog.get("technologies", {}).get(str(job.get("target", "")), {})
		if t.is_empty() or canonical_sha256(reserved) != canonical_sha256(t.get("inputs", {})):
			return "technology_escrow_mismatch"
		if not fuel.is_empty() or not instances.is_empty():
			return "unexpected_technology_escrow"
	elif kind == "research":
		if not fuel.is_empty():
			return "unexpected_research_fuel"
		var r: Dictionary = _adapter.recipe(str(job.get("target", "")))
		if r.is_empty():
			return "invalid_research_escrow"
		var targeted: Dictionary = r.get("research_cost", {"knowledge_spares": 6, "research_notes": 2})
		var blueprint := {"knowledge_spares": 3}
		for iid: Variant in _adapter.catalog.get("items", {}).keys():
			if str(_adapter.catalog["items"][iid].get("unlocks_recipe", "")) == str(job.get("target", "")):
				blueprint[str(iid)] = 1
		var specimen := {"knowledge_spares": 5}
		var matches_targeted := canonical_sha256(reserved) == canonical_sha256(targeted) and instances.is_empty()
		var matches_blueprint := canonical_sha256(reserved) == canonical_sha256(blueprint) and instances.is_empty()
		var matches_specimen := canonical_sha256(reserved) == canonical_sha256(specimen) and instances.size() == 1
		if matches_specimen:
			var outputs: Dictionary = r.get("outputs", {})
			var expected_item := str(outputs.keys()[0]) if outputs.size() == 1 else ""
			for iid: Variant in instances.keys():
				var rec: Dictionary = instances[iid]
				if str(rec.get("item_id", "")) != expected_item or not str(rec.get("location", "")).begins_with("research:"):
					matches_specimen = false
		if not matches_targeted and not matches_blueprint and not matches_specimen:
			return "research_escrow_mismatch"
	else:
		return "unsupported_job_kind"
	for id: Variant in reserved.keys():
		if _adapter.item(str(id)).is_empty() or int(reserved[id]) <= 0:
			return "invalid_reserved_item"
	for id: Variant in fuel.keys():
		if _adapter.item(str(id)).is_empty() or int(fuel[id]) <= 0:
			return "invalid_reserved_fuel"
	return ""

## Called by economy_service.arm_offline_operation inside the existing A3
## SaveService transaction. It only records opt-in custody; it never advances work.
func arm(candidate: Dictionary, state: Dictionary, job_id: String, result: Dictionary) -> bool:
	var policy_error := validate_policy()
	if not policy_error.is_empty():
		result["reason"] = policy_error; return false
	var projection := _host_projection()
	var projection_error := _validate_projection(projection)
	if not projection_error.is_empty():
		result["reason"] = projection_error; return false
	var offline: Dictionary = state.get("offline", empty_state())
	var offline_error := state_error(offline)
	if not offline_error.is_empty():
		result["reason"] = offline_error; return false
	var run_id := str(projection.run_id)
	if str(offline.get("run_id", "")) != "" and str(offline.run_id) != run_id:
		result["reason"] = "run_id_mismatch"; return false
	var now := int(projection.interval_end_unix)
	if now >= int(projection.run_expires_at_unix):
		result["reason"] = "run_expired"; return false
	if now < int(offline.get("last_authenticated_unix", 0)):
		result["reason"] = "clock_rollback"; return false
	if int(projection.projection_sequence) < int(offline.get("last_projection_sequence", 0)):
		result["reason"] = "stale_projection_sequence"; return false
	var job: Dictionary = (state.get("jobs", {}) as Dictionary).get(job_id, {})
	if job.is_empty():
		result["reason"] = "unknown_job"; return false
	if str(job.get("status", "")) not in ["queued", "running", "paused"]:
		result["reason"] = "job_not_preparable"; return false
	if not _allowlisted(job):
		result["reason"] = "operation_not_offline_eligible"; return false
	var escrow_error := _paid_escrow_error(job)
	if not escrow_error.is_empty():
		result["reason"] = escrow_error; return false
	var station_id := str(job.get("station_id", ""))
	var station: Dictionary = _adapter._station(station_id, str(job.get("station_kind", "")), int(job.get("tier", 0)))
	if station.is_empty():
		result["reason"] = "station_unavailable"; return false
	var projected: Dictionary = (projection.stations as Dictionary).get(station_id, {})
	if projected.is_empty() or not bool(projected.get("operational", false)) or int(projected.get("condition", 0)) <= 0:
		result["reason"] = "station_projection_unavailable"; return false
	if str(projected.get("station_revision", "")) != str(station.get("station_revision", "")):
		result["reason"] = "station_revision_mismatch"; return false
	var armed: Dictionary = offline.get("armed", {})
	if armed.has(job_id):
		result["reason"] = "already_armed"; return false
	if armed.size() >= mini(MAX_OPERATIONS, int(_policy.get("max_armed_operations", MAX_OPERATIONS))):
		result["reason"] = "armed_operation_limit"; return false
	armed[job_id] = {
		"job_id": job_id, "run_id": run_id, "station_id": station_id,
		"station_revision": str(station.station_revision), "armed_at_unix": now,
		"last_settled_unix": now, "tick_microseconds": int(_policy.operation_tick_microseconds),
		"duration_ticks": int(job.get("duration", 0)), "elapsed_at_arm": int(job.get("elapsed", 0)),
		"policy_sha256": _policy_sha256, "escrow_sha256": _escrow_sha(job)
	}
	offline["schema"] = 1
	offline["run_id"] = run_id
	offline["armed"] = armed
	offline["last_authenticated_unix"] = now
	offline["last_projection_sequence"] = maxi(int(offline.get("last_projection_sequence", 0)), int(projection.projection_sequence))
	state["offline"] = offline
	result["job_id"] = job_id
	result["armed_at_unix"] = now
	result["receipt_metadata"] = {"offline_arm": job_id, "run_id": run_id, "policy_sha256": _policy_sha256}
	return true

func plan(request: Variant) -> Dictionary:
	if _adapter == null or _adapter._save == null:
		return {"ok": false, "reason": "not_configured"}
	var candidate: Dictionary = _adapter._save.call(&"get_snapshot")
	return plan_candidate(candidate, request)

## Read-only. The returned proposal is a bounded delta, not a commit.
func plan_candidate(candidate: Dictionary, request: Variant) -> Dictionary:
	var request_error := _exact_host_request(request)
	if not request_error.is_empty():
		return {"ok": false, "reason": request_error}
	var p: Dictionary = request
	var projection_error := _validate_projection(p)
	if not projection_error.is_empty():
		return {"ok": false, "reason": projection_error}
	var state_error_text: String = _adapter._candidate_state_error(candidate)
	if not state_error_text.is_empty():
		return {"ok": false, "reason": state_error_text}
	var state: Dictionary = _adapter._state(candidate)
	var offline: Dictionary = state.get("offline", empty_state())
	var offline_error := state_error(offline)
	if not offline_error.is_empty():
		return {"ok": false, "reason": offline_error}
	if str(offline.get("run_id", "")) != "" and str(offline.run_id) != str(p.run_id):
		return {"ok": false, "reason": "run_id_mismatch"}
	var high_water := int(offline.get("last_authenticated_unix", 0))
	if int(p.interval_start_unix) < high_water or int(p.interval_end_unix) < high_water:
		return {"ok": false, "reason": "clock_rollback"}
	if int(p.last_authenticated_unix) < int(p.run_started_at_unix) or int(p.last_authenticated_unix) > int(p.interval_start_unix):
		return {"ok": false, "reason": "invalid_projection_high_water"}
	if str(offline.get("run_id", "")) != "" and int(p.last_authenticated_unix) != high_water:
		return {"ok": false, "reason": "projection_high_water_mismatch"}
	if int(p.projection_sequence) < int(offline.get("last_projection_sequence", 0)):
		return {"ok": false, "reason": "stale_projection_sequence"}
	var expires := int(p.run_expires_at_unix)
	var effective_end := mini(int(p.interval_end_unix), expires)
	var interval_start := int(p.interval_start_unix)
	var run_expired := int(p.interval_end_unix) >= expires
	var operations: Array[Dictionary] = []
	var blocked: Array[Dictionary] = []
	var armed: Dictionary = offline.get("armed", {})
	var jobs: Dictionary = state.get("jobs", {})
	var station_id_set := {}
	for raw_record: Variant in armed.values():
		var record_station := str((raw_record as Dictionary).get("station_id", ""))
		if not record_station.is_empty():
			station_id_set[record_station] = true
	var station_ids: Array = station_id_set.keys()
	station_ids.sort()
	for sid: Variant in station_ids:
		var station_id := str(sid)
		var cursor := maxi(interval_start, high_water)
		var station_jobs: Array = []
		for job_id: Variant in jobs.keys():
			var job: Dictionary = jobs[job_id]
			if str(job.get("station_id", "")) == station_id and str(job.get("status", "")) in ["queued", "running", "paused"]:
				station_jobs.append(str(job_id))
		station_jobs.sort()
		var station_blocked := false
		for job_id: Variant in station_jobs:
			var job: Dictionary = jobs[job_id]
			var record: Dictionary = armed.get(job_id, {})
			if record.is_empty():
				blocked.append({"job_id": job_id, "station_id": station_id, "reason": "unarmed_queue_predecessor"})
				station_blocked = true
				break
			if station_blocked:
				blocked.append({"job_id": job_id, "station_id": station_id, "reason": "blocked_by_earlier_queue_job"})
				continue
			var reason := _operation_block_reason(p, offline, job, record)
			if not reason.is_empty():
				blocked.append({"job_id": job_id, "station_id": station_id, "reason": reason})
				station_blocked = true
				continue
			var start := maxi(cursor, maxi(int(record.armed_at_unix), high_water))
			var remaining_ticks := int(job.duration) - int(job.elapsed)
			var available_seconds := maxi(0, effective_end - start)
			var tick_us := int(record.tick_microseconds)
			var applied_ticks := mini(remaining_ticks, int(float(available_seconds) * 1000000.0 / float(tick_us)))
			var to_unix := start + int(float(applied_ticks) * float(tick_us) / 1000000.0)
			if applied_ticks <= 0:
				blocked.append({"job_id": job_id, "station_id": station_id,
					"reason": "run_expired" if effective_end >= expires else "insufficient_elapsed"})
				station_blocked = true
				continue
			var completes := applied_ticks >= remaining_ticks
			var stop_reason := "COMPLETED" if completes else ("RUN_EXPIRED" if run_expired else "INSUFFICIENT_ELAPSED")
			operations.append({
				"job_id": job_id, "run_id": str(p.run_id), "station_id": station_id,
				"station_revision": str(record.station_revision), "kind": str(job.kind), "target": str(job.target),
				"operation_clock": "REAL_ELAPSED_PREPARED_ONLY", "from_unix": start, "to_unix": to_unix,
				"applied_ticks": applied_ticks, "elapsed_before": int(job.elapsed),
				"elapsed_after": int(job.elapsed) + applied_ticks, "duration_ticks": int(job.duration),
				"completes": completes, "stop_reason": stop_reason,
				"reserved_inputs": (job.get("reserved", {}) as Dictionary).duplicate(true),
				"reserved_fuel": (job.get("reserved_fuel", {}) as Dictionary).duplicate(true),
				"outputs_if_complete": _preview_outputs(job), "output_custody": str(_policy.output_custody),
				"escrow_sha256": str(record.escrow_sha256), "policy_sha256": _policy_sha256
			})
			if completes:
				cursor = to_unix
			else:
				cursor = effective_end
				station_blocked = true
	var economy_sha := canonical_sha256(candidate.get(_adapter.ROOT, {}))
	var proposal_id := canonical_sha256({"request": p, "policy_sha256": _policy_sha256, "economy_sha256": economy_sha})
	var calendar: Dictionary = p.world_calendar
	return {
		"ok": true, "contract": PLAN_CONTRACT, "proposal_id": proposal_id,
		"policy_sha256": _policy_sha256, "base_economy_sha256": economy_sha,
		"run_id": str(p.run_id), "run_started_at_unix": int(p.run_started_at_unix),
		"run_expires_at_unix": expires, "run_expired": run_expired,
		"interval_start_unix": interval_start, "interval_end_unix": int(p.interval_end_unix),
		"effective_end_unix": effective_end, "elapsed_real_seconds": maxi(0, effective_end - interval_start),
		"world_calendar": {"calendar_id": str(calendar.calendar_id), "rate_policy_id": str(calendar.rate_policy_id),
			"elapsed_world_us": int(calendar.end_world_us) - int(calendar.start_world_us), "rate_approval": str(calendar.rate_approval)},
		"operations": operations, "blocked": blocked,
		"active_source_cooldowns_changed": false, "world_action_claims": 0,
		"auto_collect": false, "auto_start_next_queue": false
	}

func _operation_block_reason(p: Dictionary, offline: Dictionary, job: Dictionary, record: Dictionary) -> String:
	if str(record.get("run_id", "")) != str(p.run_id):
		return "run_id_mismatch"
	if str(record.get("policy_sha256", "")) != _policy_sha256:
		return "policy_changed"
	if not _allowlisted(job):
		return "operation_not_offline_eligible"
	var escrow_error := _paid_escrow_error(job)
	if not escrow_error.is_empty():
		return escrow_error
	if str(record.get("escrow_sha256", "")) != _escrow_sha(job):
		return "escrow_mismatch"
	var station_id := str(job.station_id)
	var projected: Dictionary = (p.stations as Dictionary).get(station_id, {})
	if projected.is_empty():
		return "station_projection_missing"
	if not bool(projected.get("operational", false)) or int(projected.get("condition", 0)) <= 0:
		return "station_not_operational_for_interval"
	if str(projected.get("station_revision", "")) != str(record.get("station_revision", "")):
		return "station_revision_mismatch"
	var current: Dictionary = _adapter._station(station_id, str(job.station_kind), int(job.tier))
	if current.is_empty() or str(current.get("station_revision", "")) != str(record.station_revision):
		return "station_revision_mismatch"
	if int(record.get("last_settled_unix", 0)) > int(p.interval_end_unix):
		return "already_settled_beyond_interval"
	return ""

func _preview_outputs(job: Dictionary) -> Dictionary:
	if str(job.get("kind", "")) == "craft":
		return (_adapter.recipe(str(job.target)).get("outputs", {}) as Dictionary).duplicate(true)
	return {}

## A0 calls this INSIDE its own SaveService.transact_once mutator. It recomputes
## the plan from the candidate and ignores proposal-supplied deltas. The caller
## must first use proposal_id as the idempotent transaction key and re-check the
## authenticated projection at commit time. No file or inventory is saved here.
func apply_to_candidate(candidate: Dictionary, proposal: Dictionary, request: Variant) -> Dictionary:
	if not proposal is Dictionary or str(proposal.get("contract", "")) != PLAN_CONTRACT \
			or not proposal.get("proposal_id", null) is String or str(proposal.proposal_id).length() != 64:
		return {"ok": false, "reason": "invalid_offline_proposal"}
	var fresh := plan_candidate(candidate, request)
	if not bool(fresh.get("ok", false)):
		return fresh
	if str(proposal.proposal_id) != str(fresh.proposal_id):
		return {"ok": false, "reason": "stale_offline_proposal"}
	var state: Dictionary = _adapter._state(candidate)
	var offline: Dictionary = state.get("offline", empty_state())
	var armed: Dictionary = offline.get("armed", {})
	var completed: Array[String] = []
	var applied_total := 0
	for raw: Variant in fresh.operations:
		var op: Dictionary = raw
		var applied := int(op.applied_ticks)
		if applied <= 0:
			continue
		var job_id := str(op.job_id)
		var job: Dictionary = state["jobs"][job_id]
		var record: Dictionary = armed[job_id]
		if str(record.get("escrow_sha256", "")) != _escrow_sha(job):
			return {"ok": false, "reason": "escrow_mismatch_at_commit"}
		job["elapsed"] = int(job.elapsed) + applied
		applied_total += applied
		if bool(op.completes):
			if not _adapter._finish_job(candidate, state, job):
				return {"ok": false, "reason": "invalid_job_output"}
			completed.append(job_id)
			armed.erase(job_id)
		else:
			job["status"] = "running"
			record["last_settled_unix"] = int(op.to_unix)
	offline["armed"] = armed
	offline["last_authenticated_unix"] = maxi(int(offline.get("last_authenticated_unix", 0)), int(fresh.effective_end_unix))
	offline["last_projection_sequence"] = maxi(int(offline.get("last_projection_sequence", 0)), int((request as Dictionary).projection_sequence))
	state["offline"] = offline
	candidate[_adapter.ROOT] = state
	return {"ok": true, "proposal_id": str(fresh.proposal_id), "applied_ticks": applied_total,
		"completed": completed, "run_expired": bool(fresh.run_expired), "effective_end_unix": int(fresh.effective_end_unix)}

## D059 item-consumption forecast only. A0 owns satiety, HP, shelter validity,
## death, and the actual debit. Rates are A0-supplied provisional inputs, not an
## A3 or user-approved hunger balance. This function never mutates the candidate.
func forecast_food(candidate: Dictionary, request: Variant, needs: Variant) -> Dictionary:
	var request_error := _exact_host_request(request)
	if not request_error.is_empty():
		return {"ok": false, "reason": request_error}
	var p: Dictionary = request
	var projection_error := _validate_projection(p)
	if not projection_error.is_empty():
		return {"ok": false, "reason": projection_error}
	if not needs is Dictionary:
		return {"ok": false, "reason": "invalid_needs_projection"}
	var n: Dictionary = needs
	var expected := ["contract", "run_id", "satiety", "max_satiety", "drain_per_hour", "shelter", "food", "custody_projection_id"]
	if n.size() != expected.size():
		return {"ok": false, "reason": "needs_unknown_fields"}
	for field in expected:
		if not n.has(field):
			return {"ok": false, "reason": "needs_missing:" + field}
	if str(n.contract) != NEEDS_CONTRACT or str(n.run_id) != str(p.run_id):
		return {"ok": false, "reason": "needs_run_mismatch"}
	for field in ["satiety", "max_satiety", "drain_per_hour"]:
		if not n[field] is int or int(n[field]) < 0 or int(n[field]) > 1000000:
			return {"ok": false, "reason": "invalid_needs_number:" + field}
	if int(n.satiety) > int(n.max_satiety) or int(n.max_satiety) <= 0:
		return {"ok": false, "reason": "invalid_satiety_bounds"}
	if not n.shelter is Dictionary or not n.shelter.get("valid", null) is bool or not n.shelter.get("shelter_id", null) is String:
		return {"ok": false, "reason": "invalid_shelter_projection"}
	if not n.food is Array or not n.custody_projection_id is String or str(n.custody_projection_id).is_empty():
		return {"ok": false, "reason": "invalid_food_custody"}
	var effective_end := mini(int(p.interval_end_unix), int(p.run_expires_at_unix))
	var elapsed := maxi(0, effective_end - int(p.interval_start_unix))
	var required := int(ceil(float(int(n.drain_per_hour) * elapsed) / 3600.0))
	var remaining := required
	var provided := 0
	var debits := {}
	var food: Array = (n.food as Array).duplicate(true)
	food.sort_custom(func(a: Variant, b: Variant) -> bool:
		var ka := str((a as Dictionary).get("container_id", "")) + ":" + str((a as Dictionary).get("item_id", ""))
		var kb := str((b as Dictionary).get("container_id", "")) + ":" + str((b as Dictionary).get("item_id", ""))
		return ka < kb)
	var claimed := {}
	var container_debits: Array[Dictionary] = []
	for raw: Variant in food:
		if not raw is Dictionary:
			return {"ok": false, "reason": "invalid_food_record"}
		var f: Dictionary = raw
		var item_id := str(f.get("item_id", ""))
		var definition: Dictionary = _adapter.item(item_id)
		if definition.is_empty() or str(definition.get("kind", "")) != "consumable" or not (definition.get("tags", []) as Array).has("food"):
			return {"ok": false, "reason": "not_approved_food_item:" + item_id}
		if not f.get("quantity", null) is int or int(f.quantity) < 0 or not f.get("satiety_per_unit", null) is int or int(f.satiety_per_unit) <= 0:
			return {"ok": false, "reason": "invalid_food_quantity"}
		if not f.get("container_id", null) is String or str(f.container_id).is_empty():
			return {"ok": false, "reason": "invalid_food_container"}
		var container_id := str(f.container_id)
		var available := _food_in_custody(candidate, container_id, item_id)
		var claim_key := container_id + ":" + item_id
		var already := int(claimed.get(claim_key, 0))
		if already + int(f.quantity) > available:
			return {"ok": false, "reason": "food_stock_exceeds_save_custody:" + item_id}
		claimed[claim_key] = already + int(f.quantity)
		if remaining <= 0:
			continue
		var units := mini(int(f.quantity), int(ceil(float(remaining) / float(int(f.satiety_per_unit)))))
		if units > 0:
			debits[item_id] = int(debits.get(item_id, 0)) + units
			container_debits.append({"container_id": container_id, "item_id": item_id, "quantity": units})
			provided += units * int(f.satiety_per_unit)
			remaining = maxi(0, required - provided)
	var satiety_after := clampi(int(n.satiety) + provided - required, 0, int(n.max_satiety))
	var sheltered := bool((n.shelter as Dictionary).valid)
	return {"ok": true, "contract": FOOD_FORECAST_CONTRACT, "run_id": str(p.run_id),
		"forecast_id": canonical_sha256({"request": p, "needs": n}), "elapsed_real_seconds": elapsed,
		"run_expired": int(p.interval_end_unix) >= int(p.run_expires_at_unix),
		"satiety_required": required, "satiety_provided_by_food": provided,
		"proposed_item_debits": debits, "proposed_container_debits": container_debits,
		"custody_projection_id": str(n.custody_projection_id),
		"food_custody_sha256": _food_custody_sha(candidate),
		"satiety_before": int(n.satiety), "satiety_after": satiety_after,
		"food_exhausted": remaining > 0, "shelter_valid": sheltered,
		"shelter_hp_floor_applies": sheltered and satiety_after == 0 and required > 0,
		"wilderness_starvation_risk": not sheltered and satiety_after == 0 and required > 0,
		"hp_delta": 0, "a3_mutates_hp_or_hunger": false, "rate_approval": "A0_PROVISIONAL_NOT_USER_LOCKED"}

## Read-only cross-check against the SAME SaveService candidate. A0 supplies the
## container projection, but A3 refuses to forecast debits beyond durable stock.
func _food_in_custody(candidate: Dictionary, container_id: String, item_id: String) -> int:
	if container_id == "bag":
		var total := 0
		for key: Variant in _adapter._bag_stacks(candidate).keys():
			var record: Variant = _adapter._bag_stacks(candidate)[key]
			if record is Dictionary and _adapter._stack_base_id(str(key), record) == item_id:
				total += int((record as Dictionary).get("quantity", 0))
		return total
	if container_id == "home_storage":
		var total := 0
		for key: Variant in _adapter._storage_stacks(candidate).keys():
			var record: Variant = _adapter._storage_stacks(candidate)[key]
			if record is Dictionary and _adapter._stack_base_id(str(key), record) == item_id:
				total += int((record as Dictionary).get("quantity", 0))
		return total
	var survival: Dictionary = candidate.get("survival", {})
	var containers: Dictionary = survival.get("containers", {})
	var contents: Variant = containers.get(container_id, {})
	if not contents is Dictionary:
		return 0
	return int((contents as Dictionary).get(item_id, 0))

func _food_custody_sha(candidate: Dictionary) -> String:
	var survival: Dictionary = candidate.get("survival", {})
	return canonical_sha256({"inventory": candidate.get("inventory", {}), "storage": candidate.get("storage", {}),
		"containers": survival.get("containers", {})})
