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
		"Any NOT_DETECTED row above is an owner defect, not a missing feature: the validator accepted a "
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
	var first := bool(
		save.call(
			&"transact_once",
			key,
			func(candidate: Dictionary) -> bool:
				candidate["a7_corrupt_probe"] = int(candidate.get("a7_corrupt_probe", 0)) + 1
				return true,
			{"kind": "probe_only", "entity_id": "corrupt"}
		)
	)
	_expect(first, "C1 a real transaction commits before it is corrupted")
	_expect(bool(save.call(&"is_transaction_applied", key)), "C1 the receipt is recorded for the committed key")
	var applied_once := int(_snapshot().get("a7_corrupt_probe", 0))
	_expect(applied_once == 1, "C1 the effect was applied exactly once")

	# Corrupt the receipt: keep the effect, drop the receipt. This is what a
	# truncated or hand-edited save looks like. The product must refuse to replay
	# the key afterwards, because the effect already happened.
	var corrupted := bool(
		save.call(
			&"transact_once",
			"a7.corrupt.receipt.remove.%d" % Time.get_ticks_usec(),
			func(candidate: Dictionary) -> bool:
				var receipts: Dictionary = candidate.get("applied_transactions", {})
				if receipts.has(key):
					receipts.erase(key)
					candidate["applied_transactions"] = receipts
					return true
				return false
			,
			{"kind": "probe_only", "entity_id": "corrupt"}
		)
	)
	_expect(corrupted, "C1 the receipt can be removed for the corruption test")
	var detection := _receipt_guard_reports(save, key)
	_note("C1 receipt_removed=%s replayed_key_detected=%s" % [str(corrupted), str(detection)])
	_expect(
		detection,
		"C1 after the receipt is lost, the product still refuses the replayed key "
		+ "(otherwise one lost receipt is one free duplicate)"
	)
	# Leave no probe residue in later corruption steps.
	save.call(&"configure_storage", save_path, true)


## A replay is "detected" when the product refuses it *or* re-applies it without
## changing the durable effect. Silent second application is the failure.
func _receipt_guard_reports(save: Node, key: String) -> bool:
	var before := int(_snapshot().get("a7_corrupt_probe", 0))
	var replay := bool(
		save.call(
			&"transact_once",
			key,
			func(candidate: Dictionary) -> bool:
				candidate["a7_corrupt_probe"] = int(candidate.get("a7_corrupt_probe", 0)) + 1
				return true,
			{"kind": "probe_only", "entity_id": "corrupt"}
		)
	)
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
		"time": {"clock_by_poi": {}, "last_tick": 0},
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
	var max_clock := int(economy.get_script_constant_map().get("MAX_CLOCK_SECONDS", 0))
	_note("C3 max_clock_seconds=%d" % max_clock)
	var base := {
		"schema": int(economy.get_script_constant_map().get("SCHEMA", 2)),
		"instances": {},
		"jobs": {},
		"technologies": {},
		"commands": {},
		"counter": 0,
		"time": {"clock_by_poi": {"poi_crown_waystation": 1000}, "last_tick": 1000},
	}
	var ok_error := String(service.call(&"_state_error", base))
	_expect(ok_error.is_empty(), "C3 a plausible clock is accepted (non-vacuous baseline)")

	var future: Dictionary = base.duplicate(true)
	future["time"] = {"clock_by_poi": {"poi_crown_waystation": max_clock + 1}, "last_tick": max_clock + 1}
	var future_error := String(service.call(&"_state_error", future))
	_note("C3 future_clock_error=%s" % JSON.stringify(future_error))
	_expect(not future_error.is_empty(), "C3 a clock past the contract maximum is detected")

	var negative: Dictionary = base.duplicate(true)
	negative["time"] = {"clock_by_poi": {"poi_crown_waystation": -5}, "last_tick": -5}
	var negative_error := String(service.call(&"_state_error", negative))
	_note("C3 negative_clock_error=%s" % JSON.stringify(negative_error))
	_expect(not negative_error.is_empty(), "C3 a rewound (negative) clock is detected")

	var backwards: Dictionary = base.duplicate(true)
	backwards["time"] = {"clock_by_poi": {"poi_crown_waystation": 900}, "last_tick": 5000}
	var backwards_error := String(service.call(&"_state_error", backwards))
	_note("C3 last_tick_ahead_error=%s" % JSON.stringify(backwards_error))
	_expect(
		not backwards_error.is_empty(),
		"C3 a clock that moved backwards relative to the last tick is detected"
	)


# ------------------------------------------------------------ C4 stored output
func _corrupt_stored_output() -> void:
	var state_script: Script = load(SURVIVAL_STATE) as Script
	if state_script == null:
		_missing("SurvivalStateData.sanitize", SURVIVAL_STATE)
		return
	var valid := {
		"schema": 1,
		"resource_nodes": {"tree@1,2": {"kind": "tree", "spent_until": 0}},
		"structures": {},
		"containers": {"chest_1": {"item_stacks": {"oak_wood": {"item_id": "oak_wood", "quantity": 4}}}},
		"spawn_anchor": "",
		"death_bags": {},
		"pending_death": "",
		"knowledge": {"recipes": {}},
		"counters": {"structure": 0, "container_sweeps": 0, "bed_activations": 0, "deaths": 0},
	}
	var baseline: Dictionary = state_script.call(&"sanitize", valid)
	var baseline_stacks: Dictionary = (baseline.get("containers", {}).get("chest_1", {}) as Dictionary).get("item_stacks", {})
	_expect(baseline_stacks.size() == 1, "C4 the sanitizer keeps a well-formed stored stack (non-vacuous)")

	var negative := valid.duplicate(true)
	negative["containers"] = {"chest_1": {"item_stacks": {"oak_wood": {"item_id": "oak_wood", "quantity": -3}}}}
	var negative_out: Dictionary = state_script.call(&"sanitize", negative)
	var negative_stacks: Dictionary = (negative_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("item_stacks", {})
	var negative_quantity := int((negative_stacks.get("oak_wood", {}) as Dictionary).get("quantity", 0))
	_note("C4 negative_quantity_after_sanitize=%d" % negative_quantity)
	_expect(negative_quantity >= 0, "C4 a negative stored quantity cannot survive the sanitizer")

	var absurd := valid.duplicate(true)
	absurd["containers"] = {
		"chest_1": {"item_stacks": {"oak_wood": {"item_id": "oak_wood", "quantity": 999999999}}}
	}
	var absurd_out: Dictionary = state_script.call(&"sanitize", absurd)
	var absurd_stacks: Dictionary = (absurd_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("item_stacks", {})
	var absurd_quantity := int((absurd_stacks.get("oak_wood", {}) as Dictionary).get("quantity", 0))
	_note("C4 absurd_quantity_after_sanitize=%d" % absurd_quantity)
	_expect(
		absurd_quantity == 0 or absurd_quantity <= 50,
		"C4 an out-of-contract stored quantity is dropped or clamped, not trusted"
	)

	var swapped := valid.duplicate(true)
	swapped["containers"] = {"chest_1": {"item_stacks": {"oak_wood": {"item_id": "core_ashen", "quantity": 4}}}}
	var swapped_out: Dictionary = state_script.call(&"sanitize", swapped)
	var swapped_stacks: Dictionary = (swapped_out.get("containers", {}).get("chest_1", {}) as Dictionary).get("item_stacks", {})
	var kept_id := String((swapped_stacks.get("oak_wood", {}) as Dictionary).get("item_id", ""))
	_note("C4 swapped_identity_after_sanitize=%s" % JSON.stringify(kept_id))
	_expect(
		kept_id != "core_ashen",
		"C4 a stack whose key and item_id disagree is repaired or dropped, so an item cannot be renamed into a Core"
	)


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
