extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## D055 / D066 — a run lasts at most 336 real hours, and a player may leave early.
##
## ## What is user-locked
## 336 real hours including offline time is a MAXIMUM, not a sentence: the player
## may abandon a run and start another. Logging out is not abandoning. Dying is
## not abandoning. Depositing currency is not abandoning. Expiry finalizes
## exactly once, and neither expiry nor abandonment pays a victory, a score or a
## conversion of unbanked goods into durable value.
##
## ## What this probe can actually execute today
## A0's save has no run record at all (checked below, not assumed). A3 *does* ship
## the 14-day arithmetic inside its offline-operations planner: `RUN_SECONDS`,
## a projection validator that rejects any expiry other than start + 1 209 600 s,
## an expiry clamp, a high-water mark and a projection sequence. Those are real
## code paths, so this probe drives them for real and reports the arithmetic as
## PASS/FAIL while keeping the lifecycle itself honest as RED.
##
## It also exercises the integration gap the two facts create: the runtime vendors
## an A3 adapter that does not contain the planner API at all, so the arithmetic
## that exists cannot reach a player.

const RUN_KEYS := ["run_id", "run_started_at", "run_started_at_unix", "run_expires_at", "run_expires_at_unix", "run"]
const LIFECYCLE_CALLS := [
	"func start_run(", "func end_run(", "func finish_run(", "func finalize_run(",
	"func abandon_run(", "func expire_run(", "func close_season(", "func start_new_run(",
]
const PLANNER_API := [
	"configure", "validate_policy", "plan", "plan_candidate", "apply_to_candidate",
	"forecast_food", "arm",
]


func _body() -> void:
	probe_id = "R055"
	probe_title = "336 real hours maximum, voluntary abandonment, one idempotent finalization"
	owner_action = (
		"A0: add a durable run record (run_id, run_started_at_unix, run_expires_at_unix = start + 1209600) to "
		+ "the authoritative save, plus finalize/abandon entry points that write one terminal receipt and pay no "
		+ "score, victory or unbanked conversion. Re-vendor A3's economy service so the offline planner API the "
		+ "runtime needs is actually present."
	)

	# ---- 1. does the runtime own a run at all? ---------------------------
	var top := _namespace_keys()
	_note("save_namespace_keys=%s" % JSON.stringify(top))
	var present_run: Array = []
	for key: String in RUN_KEYS:
		if top.has(key):
			present_run.append(key)
	_note("run_namespace_keys_found=%s" % JSON.stringify(present_run))
	if present_run.is_empty():
		_missing("a durable run record on SaveService (run_id + run_started_at_unix + run_expires_at_unix)", SAVE_SERVICE)

	var lifecycle: Array = []
	var save_text := _code_text(SAVE_SERVICE)
	for call: String in LIFECYCLE_CALLS:
		if save_text.contains(call):
			lifecycle.append(call)
	_note("run_lifecycle_calls_found=%s" % JSON.stringify(lifecycle))
	if lifecycle.is_empty():
		_missing("a run start/finalize/abandon entry point on SaveService", SAVE_SERVICE)
	if not save_text.contains("1209600") and not save_text.contains("1_209_600"):
		_missing("the 14 x 24 x 3600 = 1209600 s expiry constant in the runtime save", SAVE_SERVICE)

	# ---- 2. the arithmetic A3 *does* ship --------------------------------
	# Run it for real. If the planner is absent this is RED; if it is present, the
	# numbers below are assertions against production code.
	var policy_payload := _json(POLICY_JSON)
	var policy: Dictionary = policy_payload.get("policy", {})
	var planner_script: Script = load(PLANNER) as Script
	if planner_script == null:
		_missing("A3 offline_operation_planner.gd (the only shipped 14-day arithmetic)", PLANNER)
	else:
		var api := _has_methods(PLANNER, PLANNER_API)
		_note("planner_api_absent=%s" % JSON.stringify(api["absent"]))
		if not api["absent"].is_empty():
			_missing("planner API %s" % JSON.stringify(api["absent"]), PLANNER)
		var run_seconds := int(planner_script.get_script_constant_map().get("RUN_SECONDS", 0))
		_note("planner_run_seconds=%d expected=%d" % [run_seconds, RUN_SECONDS])
		_expect(run_seconds == RUN_SECONDS, "the shipped run length is exactly 336 real hours")

		var planner: Object = planner_script.new()
		_note("policy_id=%s status=%s" % [String(policy.get("policy_id", "")), String(policy.get("status", ""))])
		var configured := bool(planner.call(&"configure", null, policy, Callable()))
		_note("planner_configure_without_adapter=%s" % str(configured))
		var policy_error := String(planner.call(&"validate_policy"))
		_note("policy_error=%s" % JSON.stringify(policy_error))
		_expect(policy_error.is_empty(), "the authored offline-operations policy is well formed")

		# Every one of these is a corruption of a REAL policy, not a fixture: the
		# point is that the product refuses it and says which rule it broke.
		_expect(
			_rejects_policy(planner_script, policy, "run_deadline_seconds", 13 * 24 * 3600, "invalid_run_deadline"),
			"a 13-day deadline is refused by name (the run is at most 14 days, not any length)"
		)
		_expect(
			_rejects_policy(planner_script, policy, "user_rate_approval", "USER_LOCKED", "invalid_policy_identity_or_rate_approval"),
			"a policy that claims a user approval the creator never gave is refused"
		)
		_expect(
			_rejects_policy(planner_script, policy, "auto_collect", true, "forbidden_automation"),
			"the planner cannot be told to collect for the player (no offline harvest)"
		)
		_expect(
			_rejects_policy(planner_script, policy, "auto_start_next_queue", true, "forbidden_automation"),
			"the planner cannot be told to start the next queue job (no unattended play)"
		)
		_expect(
			_rejects_policy(planner_script, policy, "active_only_sources_unchanged", "on the honour system", "invalid_policy_list:active_only_sources_unchanged"),
			"a policy that stops enumerating ACTIVE-only sources is refused"
		)

	# ---- 3. expiry of a projection: 14 days, exactly once ---------------
	var projection := _projection(1000000, RUN_SECONDS, 400000, 400000)
	var planner2: Object = planner_script.new()
	planner2.call(&"configure", null, policy, Callable())
	var expiry_error := String(planner2.call(&"_validate_projection", projection))
	_note("valid_projection_error=%s" % JSON.stringify(expiry_error))
	_expect(expiry_error.is_empty(), "a projection whose expiry is exactly start + 1209600 s is accepted")

	for days: int in [13, 15]:
		var wrong := _projection(1000000, days * 24 * 3600, 400000, 400000)
		var wrong_error := String(planner2.call(&"_validate_projection", wrong))
		_note("projection_%d_day_error=%s" % [days, JSON.stringify(wrong_error)])
		_expect(
			wrong_error == "run_expiry_not_14_real_days",
			"a %d-day run is refused by name, not silently accepted" % days
		)

	var rollback := _projection(1000000, RUN_SECONDS, 300000, 200000)
	_expect(
		not String(planner2.call(&"_validate_projection", rollback)).is_empty(),
		"a projection whose interval ends before it starts is refused (clock rollback)"
	)

	# ---- 4. no manufactured victory -------------------------------------
	# D065/D063 forbid a run score or an automatic payout. This is a guard, so it
	# can only subtract: a forbidden symbol's *presence* is the defect.
	var score_hits := _files_matching(
		[_all_gd_under("res://game/survival"), SAVE_SERVICE],
		"\\b(diem_hanh_trinh|journey_score|aggregate_score|season_score|run_score)\\b"
	)
	_note("forbidden_score_symbols=%s" % JSON.stringify(score_hits))
	_expect(score_hits.is_empty(), "no withdrawn aggregate run score exists in production code")

	# ---- 5. the integration gap that makes 2 impossible from play -------
	# The runtime vendors its own copy of A3's service. If that copy lacks the
	# planner API, then the arithmetic above is unreachable by a player even
	# though it is correct.
	var vendored := _has_methods(A0_VENDORED, ["plan_offline_operations", "forecast_offline_food", "apply_offline_operation_plan"])
	_note("runtime_vendored_adapter_absent=%s" % JSON.stringify(vendored["absent"]))
	_expect(
		vendored["absent"].is_empty(),
		"the adapter the runtime actually loads exposes A3's offline API (absent: %s)" % JSON.stringify(vendored["absent"])
	)
	var canonical := _has_methods(A3_SERVICE, ["plan_offline_operations", "forecast_offline_food", "apply_offline_operation_plan"])
	_note("a3_canonical_adapter_present=%s" % JSON.stringify(canonical["present"]))
	_done()

# ---------------------------------------------------------------- helpers
func _projection(started: int, length: int, interval_start: int, interval_end: int) -> Dictionary:
	return {
		"contract": "soh.economy.offline_time.v1",
		"run_id": "run-a7-r055",
		"run_started_at_unix": started,
		"run_expires_at_unix": started + length,
		"interval_start_unix": started + interval_start,
		"interval_end_unix": started + interval_end,
		"last_authenticated_unix": started + interval_start,
		"projection_sequence": 1,
		"projection_id": "proj-a7-r055",
		"world_calendar": {
			"run_id": "run-a7-r055",
			"calendar_id": "a7_calendar",
			"rate_policy_id": "a7_rate",
			"start_world_us": 0,
			"end_world_us": 1000,
			"rate_approval": "NOT_USER_LOCKED",
		},
		"stations": {},
	}


## Fresh planner per corruption, so state from one case cannot rescue another.
func _rejects_policy(planner_script: Script, policy: Dictionary, field: String, value: Variant, expected: String) -> bool:
	var corrupted: Dictionary = policy.duplicate(true)
	corrupted[field] = value
	var planner: Object = planner_script.new()
	planner.call(&"configure", null, corrupted, Callable())
	var reason := String(planner.call(&"validate_policy"))
	_note("policy_corruption_%s=%s" % [field, JSON.stringify(reason)])
	return reason == expected or reason.begins_with(expected)


func _all_gd_under(root: String) -> Array:
	var found: Array = []
	var dir := DirAccess.open(root)
	if dir == null:
		return found
	for name: String in dir.get_files():
		if name.ends_with(".gd"):
			found.append(root.path_join(name))
	for sub: String in dir.get_directories():
		found.append_array(_all_gd_under(root.path_join(sub)))
	return found
