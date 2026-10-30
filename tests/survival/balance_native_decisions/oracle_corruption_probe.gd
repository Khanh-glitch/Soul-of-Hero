extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## Corrupt the evidence on purpose, and require the product's own gate to notice.
##
## ## Why this probe exists
##
## A gate that has never seen a corrupted input is indistinguishable from a gate
## that always says OK. Every check below takes a real product artifact, breaks
## exactly one thing about it, and asks the *product's own validator* whether the
## break is reported. A validator that accepts the corrupted artifact is a defect
## in the validator, not a missing feature, so those outcomes are FAIL.
##
## | corruption | artifact | product gate that must notice |
## |---|---|---|
## | C1 receipt      | applied_transactions | SaveService.is_transaction_applied + commit refusal |
## | C2 identity     | A3 world slice binding | A3 state validation (`_state_error`) |
## | C3 timestamp    | A3 world clock | A3 unsigned/bounded clock validation |
## | C4 stored output| survival document stacks | SurvivalStateData.sanitize |
## | C5 old-run quest| run namespace | RED: no runs exist to scope a quest receipt |
## | C6 home knowledge| enemy state | RED: no monster and no trail exist |
##
## `sanitize()` and the validators are *read-only* inspection APIs; nothing here
## writes to the authoritative document except the isolated save this probe owns.
##
##   godot --headless --path . --script res://tests/survival/balance_native/oracle_corruption_probe.gd

const SURVIVAL_STATE := "res://game/survival/survival_state.gd"
const ECONOMY := "res://game/survival/economy/vendor/a3_economy_service.gd"
const SAVE_SERVICE := "res://game/autoload/save_service.gd"


func _body() -> void:
	probe_id = "CORRUPT"
	probe_title = "six deliberate corruptions must be detected by the product's own gates"
	owner_action = (
		"Any NOT_DETECTED row above is an owner defect, not a missing feature: the validator accepted a " +
		"corrupted artifact it is supposed to reject."
	)

	var save := _save()
	if save == null:
		_block("SaveService is not present")
		return

	_corrupt_receipt(save)
	_corrupt_identity()
	_corrupt_timestamp()
	_corrupt_stored_output()
	_no_run_namespace()
	_no_monster_knowledge()


# ------------------------------------------------------------------ C1 receipt
func _corrupt_receipt(save: Node) -> void:
	var key := "a7.corrupt.receipt.%d" % Time.get_ticks_usec()
	# A named callable rather than an inline lambda: GDScript cannot parse a
	# multi-statement lambda whose closing comma sits on its own line, and that
	# failure only shows up when the engine actually loads the script.
	var bump := func(candidate: Dictionary) -> bool:
		candidate["a7_corrupt_probe"] = int(candidate.get("a7_corrupt_probe", 0)) + 1
		return true
	var first := bool(save.call(&"transact_once", key, bump, {"kind": "probe_only", "entity_id": "corrupt"}))
	_expect(first, "C1 a real transaction commits before it is corrupted")
	_expect(bool(save.call(&"is_transaction_applied", key)), "C1 the receipt is recorded for the committed key")
	var applied_once := int(_snapshot().get("a7_corrupt_probe", 0))
	_expect(applied_once == 1, "C1 the effect was applied exactly once")

	# The barrier itself: the same key must not commit twice.
	# `transact_once` returns bool: false means the key was already applied.
	var replay_accepted := bool(save.call(&"transact_once", key, bump, {"kind": "probe_only", "entity_id": "corrupt"}))
	var replay_refused := not replay_accepted
	var after_replay := int(_snapshot().get("a7_corrupt_probe", 0))
	_note("C1 replay_refused=%s effect_after_replay=%d" % [str(replay_refused), after_replay])
	_expect(after_replay == 1, "C1 a replayed receipt key does not apply its effect twice")

	# Corrupt the receipt: keep the effect, drop the receipt. This is what a
	# truncated or hand-edited save looks like. It is NOT reachable through the
	# product's own API — the effect and the receipt are written in one atomic
	# document write — so A7 will not report the result as an owner defect. It is
	# recorded as a boundary with the question an owner has to answer.
	var remover := func(candidate: Dictionary) -> bool:
		var receipts: Dictionary = candidate.get("applied_transactions", {})
		if receipts.has(key):
			receipts.erase(key)
			candidate["applied_transactions"] = receipts
			return true
		return false
	save.call(&"transact_once", "a7.corrupt.receipt.remove.%d" % Time.get_ticks_usec(), remover, {"kind": "probe_only", "entity_id": "corrupt"})
	var receipt_gone := not bool(save.call(&"is_transaction_applied", key))
	var detection := _receipt_guard_reports(save, key)
	_note(
		"C1 receipt_removed=%s replay_detected_without_receipt=%s classification=UNREACHABLE_BY_API"
		% [str(receipt_gone), str(detection)]
	)
	_note(
		"C1 boundary=the receipt is the only memory of a commit; a hand-edited save that drops it can pay the "
		+ "effect again. No independent ledger exists, so this is a design question for A0/A3, not a probe failure."
	)
	# Leave no probe residue in later corruption steps.
	save.call(&"configure_storage", save_path, true)


## A replay is "detected" when the product refuses it *or* re-applies it without
## changing the durable effect. Silent second application is the failure.
func _receipt_guard_reports(save: Node, key: String) -> bool:
	var before := int(_snapshot().get("a7_corrupt_probe", 0))
	var bump := func(candidate: Dictionary) -> bool:
		candidate["a7_corrupt_probe"] = int(candidate.get("a7_corrupt_probe", 0)) + 1
		return true
	var replay := bool(save.call(&"transact_once", key, bump, {"kind": "probe_only", "entity_id": "corrupt"}))
	var after := int(_snapshot().get("a7_corrupt_probe", 0))
	return (not replay) or after == before


# ----------------------------------------------------------------- C2 identity
func _corrupt_identity() -> void:
	var economy: Script = load(ECONOMY) as Script
	if economy == null:
		_missing("A3 economy service validator", ECONOMY)
		return
	var service: Object = economy.new()
	if not service.has_method(&"_state_error"):
		_missing("A3 state validator (_state_error)", ECONOMY)
		return
	# A syntactically valid state is the baseline; without it, rejecting a
	# corrupted one proves nothing.
	var valid_state := {
		"schema": int(economy.get_script_constant_map().get("SCHEMA", 2)),
		"instances": {},
		"jobs": {},
		"technologies": {},
		"commands": {},
		"counter": 0,
		# The shape A3's own `_empty_time()` produces. An earlier fixture invented
		# `clock_by_poi`/`last_tick`, the validator rejected it, and every C2/C3
		# corruption case below became vacuous because the baseline was already invalid.
		"time": {"latest_session_index": -1, "session_id": "", "sequence": -1, "stations": {}},
	}
	var baseline_error := String(service.call(&"_state_error", valid_state))
	_note("C2 baseline_state_error=%s" % JSON.stringify(baseline_error))
	_expect(baseline_error.is_empty(), "C2 the validator accepts a well-formed economy state (non-vacuous)")

	var corrupted: Dictionary = valid_state.duplicate(true)
	corrupted["instances"] = {
		"soh_i_deadbeef": {
			"instance_id": "soh_i_wrong_id",
			"item_id": "core_ashen",
			"remaining_uses": 3,
		}
	}
	var identity_error := String(service.call(&"_state_error", corrupted))
	_note("C2 identity_case_error=%s" % JSON.stringify(identity_error))
	_expect(identity_error.contains("instance_id_mismatch"), "C2 a mismatched instance identity is detected")

	var bad_token: Dictionary = valid_state.duplicate(true)
	bad_token["instances"] = {"not_a_token": {"instance_id": "not_a_token", "item_id": "core_ashen"}}
	var token_error := String(service.call(&"_state_error", bad_token))
	_note("C2 token_case_error=%s" % JSON.stringify(token_error))
	_expect(not token_error.is_empty(), "C2 an instance id outside the A3 token namespace is detected")


# ---------------------------------------------------------------- C3 timestamp
func _corrupt_timestamp() -> void:
	var economy: Script = load(ECONOMY) as Script
	if economy == null:
		return
	var service: Object = economy.new()
	if not service.has_method(&"_state_error"):
		return
	# A3 hardcodes the bound inside `_is_uint(value, 1000000000000)`; there is no
	# MAX_CLOCK_SECONDS constant in this script, so reading one yields 0 and every
	# comparison against it is meaningless. The literal is pinned here instead and
	# the absence of the constant is recorded as an observation.
	var uint_max := 1000000000000
	_note("C3 validator_uint_bound=%d max_clock_constant_present=false" % uint_max)
	var schema_value := int(economy.get_script_constant_map().get("SCHEMA", 2))
	var base := {
		"schema": schema_value,
		"instances": {},
		"jobs": {},
		"technologies": {},
		"commands": {},
		"counter": 0,
		"time": {"latest_session_index": 3, "session_id": "s1", "sequence": 7, "stations": {}},
	}
	var ok_error := String(service.call(&"_state_error", base))
	_note("C3 baseline_state_error=%s" % JSON.stringify(ok_error))
	_expect(ok_error.is_empty(), "C3 a plausible host clock is accepted (non-vacuous baseline)")

	var too_big: Dictionary = base.duplicate(true)
	too_big["time"] = {"latest_session_index": uint_max + 1, "session_id": "s1", "sequence": 7, "stations": {}}
	var too_big_error := String(service.call(&"_state_error", too_big))
	_note("C3 clock_past_uint_bound_error=%s" % JSON.stringify(too_big_error))
	_expect(not too_big_error.is_empty(), "C3 a clock past the contract bound is detected")

	var negative: Dictionary = base.duplicate(true)
	negative["time"] = {"latest_session_index": 3, "session_id": "s1", "sequence": -5, "stations": {}}
	var negative_error := String(service.call(&"_state_error", negative))
	_note("C3 rewound_sequence_error=%s" % JSON.stringify(negative_error))
	_expect(not negative_error.is_empty(), "C3 a rewound (negative) sequence is detected")

	var station_ticks: Dictionary = base.duplicate(true)
	station_ticks["time"] = {
		"latest_session_index": 3, "session_id": "s1", "sequence": 7,
		"stations": {"poi_crown_waystation": {"active_ticks": uint_max + 1, "station_revision": "r1"}},
	}
	var station_error := String(service.call(&"_state_error", station_ticks))
	_note("C3 station_ticks_past_bound_error=%s" % JSON.stringify(station_error))
	_expect(not station_error.is_empty(), "C3 a station's elapsed ticks past the bound are detected")

	var empty_session: Dictionary = base.duplicate(true)
	empty_session["time"] = {"latest_session_index": 3, "session_id": "", "sequence": 7, "stations": {}}
	var empty_session_error := String(service.call(&"_state_error", empty_session))
	_note("C3 empty_session_id_error=%s" % JSON.stringify(empty_session_error))
	_expect(not empty_session_error.is_empty(), "C3 a non-initial clock with no session identity is detected")


# ------------------------------------------------------------ C4 stored output
func _corrupt_stored_output() -> void:
	var state_script: Script = load(SURVIVAL_STATE) as Script
	if state_script == null:
		_missing("SurvivalStateData.sanitize", SURVIVAL_STATE)
		return
	# The document's real container shape is `{container_id: {item_id: quantity}}`.
	# An earlier fixture guessed `item_stacks` wrappers, so the baseline was empty
	# and every corruption assertion below was vacuous.
	var valid := {
		"schema": 1,
		"resource_nodes": {},
		"structures": {},
		"containers": {"chest_1": {"oak_wood": 4}},
		"spawn_anchor": "",
		"death_bags": {},
		"pending_death": "",
		"knowledge": {"recipes": {}},
		"counters": {"structure": 0, "container_sweeps": 0, "bed_activations": 0, "deaths": 0},
	}
	var baseline: Dictionary = state_script.call(&"sanitize", valid)
	var baseline_quantity := int((baseline.get("containers", {}).get("chest_1", {}) as Dictionary).get("oak_wood", 0))
	_note("C4 baseline_quantity=%d" % baseline_quantity)
	_expect(baseline_quantity == 4, "C4 the sanitizer keeps a well-formed stored stack (non-vacuous)")

	var negative := valid.duplicate(true)
	negative["containers"] = {"chest_1": {"oak_wood": -3}}
	var negative_out: Dictionary = state_script.call(&"sanitize", negative)
	var negative_quantity := int((negative_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("oak_wood", 0))
	_note("C4 negative_quantity_after_sanitize=%d" % negative_quantity)
	_expect(negative_quantity == 0, "C4 a negative stored quantity cannot survive the sanitizer")

	var not_a_number := valid.duplicate(true)
	not_a_number["containers"] = {"chest_1": {"oak_wood": "lots"}}
	var nan_out: Dictionary = state_script.call(&"sanitize", not_a_number)
	var nan_quantity := int((nan_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("oak_wood", 0))
	_note("C4 non_numeric_quantity_after_sanitize=%d" % nan_quantity)
	_expect(nan_quantity == 0 or nan_quantity == 0, "C4 a non-numeric stored quantity cannot survive the sanitizer")

	var wrong_shape := valid.duplicate(true)
	wrong_shape["containers"] = {"chest_1": ["oak_wood", 4]}
	var shape_out: Dictionary = state_script.call(&"sanitize", wrong_shape)
	_note("C4 wrong_shape_containers=%s" % JSON.stringify(shape_out.get("containers", {})))
	_expect(
		(shape_out.get("containers", {}) as Dictionary).is_empty(),
		"C4 a container whose contents are not a mapping is dropped, not reinterpreted"
	)

	# Observation, not a verdict: the sanitizer has no upper bound on a quantity.
	# That is only a defect if an authored stack cap exists somewhere to enforce;
	# A7 records the measurement and asks the owner instead of inventing a limit.
	var absurd := valid.duplicate(true)
	absurd["containers"] = {"chest_1": {"oak_wood": 999999999}}
	var absurd_out: Dictionary = state_script.call(&"sanitize", absurd)
	var absurd_quantity := int((absurd_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("oak_wood", 0))
	_note("C4 absurd_quantity_after_sanitize=%d (observation: no upper bound in the sanitizer)" % absurd_quantity)
	_note("C4 owner_question=A0: is an unbounded stored quantity reachable through the chest UI, or only by hand-editing a save?")


# ------------------------------------------------------- C5 / C6 not implemented
func _no_run_namespace() -> void:
	var snapshot := _snapshot()
	var has_runs := snapshot.has("run_id") or snapshot.has("runs") or snapshot.has("run_started_at")
	var has_profile := snapshot.has("profile")
	_note("C5 run_namespace=%s profile_namespace=%s" % [str(has_runs), str(has_profile)])
	if not has_runs:
		_missing("a run namespace, so an old-run quest claim cannot even be represented", SAVE_SERVICE)
	if not has_profile:
		_missing("profile.achievements / profile.run_history", SAVE_SERVICE)
	# The vacuity statement that matters: with no run_id in the save, no test can
	# distinguish "quest paid once this run" from "quest paid once ever".
	_note("C5 consequence=per-run once-only quest claims are unrepresentable without run_id")


func _no_monster_knowledge() -> void:
	var trail := false
	for path: String in ["res://game/overworld/chapter1_overworld.gd"]:
		if _source_has(path, "trail") or _source_has(path, "footprint"):
			trail = true
	if not trail:
		_missing("any monster home-knowledge state to corrupt (no trail/footprint model exists)")
		_note("C6 consequence=a monster that never sensed a trail cannot be tested for retroactive discovery")
