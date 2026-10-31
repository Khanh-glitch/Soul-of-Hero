extends "res://tests/survival/balance_native_ragnarok/r_harness.gd"
## D059 / D060 — one continuous world clock, finite prepared work, no offline
## credit for ACTIVE-only sources, and a starvation rule that belongs to A0.
##
## ## Why this probe is mostly real assertions
## A3 shipped `offline_operation_planner.gd`: a validated policy, a validated
## time projection (run id, 14-day expiry, interval bounds, high-water mark,
## projection sequence, world calendar), a planner that clamps every interval to
## the run expiry, and a food forecast. That is executable code with contracts,
## so it is driven here for real. What is *not* implemented is A0's side: the
## runtime save has no satiety, no HP and no last-seen stamp, so the settlement
## the planner is designed to feed has nowhere to land. Both facts are reported,
## separately, because they have different owners and different fixes.

const NEEDS_KEYS := ["satiety", "hunger", "hp", "health", "last_seen_at", "last_seen_unix"]


func _body() -> void:
	probe_id = "R060"
	probe_title = "continuous clock, bounded prepared work, no ACTIVE-only credit, A0-owned hunger"
	owner_action = (
		"A0: persist satiety/HP plus last_seen_at_unix in the authoritative save and settle the elapsed interval "
		+ "through A3's planner exactly once; re-vendor A3's economy service so plan_offline_operations and "
		+ "forecast_offline_food exist at runtime. A3: keep the ACTIVE-only list authoritative and the clock rate "
		+ "provisional until a player-facing rate is approved."
	)

	var planner_script: Script = load(PLANNER) as Script
	if planner_script == null:
		_missing("A3 offline_operation_planner.gd", PLANNER)
		_missing_needs()
		return

	var policy_payload := _json(POLICY_JSON)
	var policy: Dictionary = policy_payload.get("policy", {})
	_note("policy_keys=%s" % JSON.stringify(_sorted_keys(policy)))

	# ---- 1. the shipped policy keeps the promises that cost nothing -----
	var active_only: Array = policy.get("active_only_sources_unchanged", [])
	_note("active_only_sources=%s" % JSON.stringify(active_only))
	_expect(active_only.size() >= 3, "ACTIVE-only sources are named, so no offline credit can be claimed for them")

	var forbidden: Array = policy.get("forbidden_offline_effects", [])
	var forbidden_text := JSON.stringify(forbidden).to_lower()
	_note("forbidden_offline_effects=%d" % forbidden.size())
	_expect(forbidden_text.contains("hp/hunger mutation"), "A3 is explicitly forbidden from mutating HP or hunger")
	_expect(forbidden_text.contains("monster raids"), "offline monster raids and base damage are explicitly forbidden")
	_expect(forbidden_text.contains("free materials"), "free offline materials are explicitly forbidden")
	_expect(forbidden_text.contains("source cooldown"), "offline source-cooldown credit is explicitly forbidden")

	for domain: String in ["cultivation", "collectors"]:
		var entry: Dictionary = policy.get(domain, {})
		var status := String(entry.get("status", ""))
		_note("%s_status=%s" % [domain, status])
		_expect(status.begins_with("DISABLED"), "%s is disabled rather than approximated with invented yields" % domain)
		_expect(not String(entry.get("reason", "")).is_empty(), "%s says why it is disabled" % domain)

	var tick := int(policy.get("operation_tick_microseconds", 0))
	_note("operation_tick_microseconds=%d" % tick)
	_expect(tick == 1000000, "prepared work advances on real elapsed microseconds, not a hoped-for tick rate")
	var provenance := String(policy.get("operation_tick_provenance", ""))
	_note("tick_provenance_cites_owner_file=%s" % str(provenance.contains("economy_session.gd")))

	var max_armed := int(policy.get("max_armed_operations", 0))
	_expect(max_armed > 0 and max_armed <= 1024, "prepared work is bounded by a declared maximum (%d)" % max_armed)

	# ---- 2. the projection is a real gate, not a comment ----------------
	var planner: Object = planner_script.new()
	var configured := bool(planner.call(&"configure", null, policy, Callable()))
	_note("planner_configured=%s" % str(configured))

	var empty_state: Dictionary = _static_call(planner_script, &"empty_state")
	_note("empty_state_keys=%s" % JSON.stringify(_sorted_keys(empty_state)))
	_expect(
		String(_static_call(planner_script, &"state_error", [empty_state])).is_empty(),
		"the planner accepts its own empty state (non-vacuous baseline)"
	)

	# A JSON round trip turns 1000000 into 1000000.0. That is not data loss and
	# must not be reported as one, so the cases below separate the two:
	#   * an integral float is the same number written differently -> accepted;
	#   * a fractional value, a negative one, a wrong schema or a wrong type is a
	#     real corruption -> refused.
	var reparsed: Dictionary = empty_state.duplicate(true)
	reparsed["last_authenticated_unix"] = 1000000.0
	reparsed["last_projection_sequence"] = 3.0
	var reparsed_error := String(_static_call(planner_script, &"state_error", [reparsed]))
	_note("lossless_float_reparse_error=%s" % JSON.stringify(reparsed_error))
	_expect(reparsed_error.is_empty(), "an integral float from a JSON round trip is accepted, not treated as loss")

	var state_cases := [
		{"id": "schema_2", "field": "schema", "value": 2, "expect": "unsupported_offline_schema"},
		{"id": "negative_high_water", "field": "last_authenticated_unix", "value": -1, "expect": "invalid_offline_high_water"},
		{"id": "fractional_high_water", "field": "last_authenticated_unix", "value": 1.5, "expect": "invalid_offline_high_water"},
		{"id": "sequence_not_numeric", "field": "last_projection_sequence", "value": "many", "expect": "invalid_offline_sequence"},
		{"id": "run_id_not_string", "field": "run_id", "value": 7, "expect": "invalid_offline_state"},
	]
	for case: Dictionary in state_cases:
		var corrupt: Dictionary = empty_state.duplicate(true)
		corrupt[String(case["field"])] = case["value"]
		var reason := String(_static_call(planner_script, &"state_error", [corrupt]))
		_note("state_corruption_%s=%s" % [String(case["id"]), JSON.stringify(reason)])
		_expect(reason == String(case["expect"]), "a corrupted planner state is refused by name (%s)" % String(case["id"]))

	# ---- 3. world calendar: provisional rate, no invented years ---------
	var projection := _projection()
	var baseline := String(planner.call(&"_validate_projection", projection))
	_note("baseline_projection_error=%s" % JSON.stringify(baseline))
	_expect(baseline.is_empty(), "a well-formed projection is accepted (non-vacuous baseline)")

	var calendar_cases := [
		{"id": "rate_claimed_locked", "path": "rate_approval", "value": "USER_LOCKED", "expect": "rate"},
		{"id": "calendar_run_mismatch", "path": "run_id", "value": "someone_else", "expect": "run"},
		{"id": "world_time_regressed", "path": "end_world_us", "value": 0, "expect": "regress"},
		{"id": "calendar_missing_field", "path": "rate_policy_id", "value": "", "expect": "identity"},
	]
	for case: Dictionary in calendar_cases:
		var corrupt: Dictionary = projection.duplicate(true)
		(corrupt["world_calendar"] as Dictionary)[String(case["path"])] = case["value"]
		var reason := String(planner.call(&"_validate_projection", corrupt))
		_note("calendar_corruption_%s=%s" % [case["id"], JSON.stringify(reason)])
		_expect(not reason.is_empty(), "a corrupted world calendar is refused (%s)" % case["id"])

	# ---- 4. the A0 half that does not exist -----------------------------
	_missing_needs()

	# ---- 5. can a player reach any of this? -----------------------------
	var vendored := _has_methods(A0_VENDORED, ["plan_offline_operations", "forecast_offline_food"])
	_note("runtime_vendored_adapter_absent=%s" % JSON.stringify(vendored["absent"]))
	_expect(
		vendored["absent"].is_empty(),
		"the runtime's vendored adapter can plan offline operations (absent: %s)" % JSON.stringify(vendored["absent"])
	)
	_done()

func _missing_needs() -> void:
	var snapshot := _snapshot()
	var found: Array = []
	for key: String in NEEDS_KEYS:
		if snapshot.has(key):
			found.append(key)
	_note("needs_keys_in_save=%s" % JSON.stringify(found))
	if found.is_empty():
		_missing("satiety/HP and last_seen_at_unix in the authoritative save (D059 settlement target)", SAVE_SERVICE)


func _projection() -> Dictionary:
	return {
		"contract": "soh.economy.offline_time.v1",
		"run_id": "run-a7-r060",
		"run_started_at_unix": 1000000,
		"run_expires_at_unix": 1000000 + RUN_SECONDS,
		"interval_start_unix": 1000000 + 3600,
		"interval_end_unix": 1000000 + 7200,
		"last_authenticated_unix": 1000000 + 3600,
		"projection_sequence": 2,
		"projection_id": "proj-a7-r060",
		"world_calendar": {
			"run_id": "run-a7-r060",
			"calendar_id": "a7_calendar",
			"rate_policy_id": "a7_rate",
			"start_world_us": 1000,
			"end_world_us": 2000,
			"rate_approval": "NOT_USER_LOCKED",
		},
		"stations": {},
	}


func _sorted_keys(dictionary: Dictionary) -> Array:
	var keys: Array = dictionary.keys()
	keys.sort()
	return keys
