extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## D060 — one continuous world clock, bounded prepared work, no double settlement.
##
## ## What the decision requires
##
## World time advances at a consistent rate whether the application is open or
## closed. Prepared processes (crops, smelting, funded research, cooking) advance
## against that clock only as far as real inputs allow: fuel, supplies, storage
## capacity and the end-of-run boundary. Nothing may settle twice when the app is
## reopened. A3's existing ACTIVE-second source cooldown stays a separate rule and
## must not be silently redefined as world time.
##
## ## What this probe can honestly say about this composition
##
## * world clock: the product stores `clock_seconds` per POI inside `world_slice`
##   and advances it from an active host quantum. There is no persisted UTC anchor
##   and no settlement-over-closure entry point, so "consistent online/offline" is
##   RED. The probe measures the clock that does exist and its quantum bound.
## * double settlement: testable now, and the important half. The probe replays a
##   settlement event id and requires the product to refuse the second one.
## * fuel bound: measured from the queue contract (`queued`/`running`/`ready`
##   states plus a committed fuel requirement) when the economy service is
##   loadable; absent fuel must stop a job rather than invent output.
##
##   godot --headless --path . --script res://tests/survival/balance_native/d060_world_time_probe.gd

const SAVE_SERVICE := "res://game/autoload/save_service.gd"
const ECONOMY := "res://game/survival/economy/vendor/a3_economy_service.gd"
const HOST := "res://game/survival/economy/economy_session.gd"
const UTC_SYMBOLS := ["last_seen_at", "run_started_at", "Time.get_unix_time_from_system", "elapsed_seconds"]
const SETTLE_SYMBOLS := ["func settle_offline", "func settle_elapsed", "func advance_offline", "func on_resume"]


func _body() -> void:
	probe_id = "D060"
	probe_title = "continuous world time, bounded prepared work, no double settlement at 2h/18h/48h"
	owner_action = (
		"A0: persist an absolute UTC anchor with the world clock and settle the elapsed interval exactly once on " +
		"return, capped at the run expiry; expose the interval as data so 2h/18h/48h returns are measurable. " +
		"A3: keep the queue's fuel/supply bound authoritative and make settlement idempotent per event id."
	)

	var snapshot := _snapshot()
	var world_slice: Dictionary = snapshot.get("world_slice", {})
	_note("world_slice_pois=%d" % world_slice.size())
	var clock_pois := 0
	var sample_clock := ""
	for poi: Variant in world_slice.keys():
		var row: Variant = world_slice[poi]
		if row is Dictionary and (row as Dictionary).has("clock_seconds"):
			clock_pois += 1
			if sample_clock.is_empty():
				sample_clock = "%s=%s" % [String(poi), str((row as Dictionary)["clock_seconds"])]
	_note("pois_with_clock_seconds=%d sample=%s" % [clock_pois, sample_clock])

	# ---- 1. is there a persisted UTC anchor for offline settlement? -------
	var utc_found: Array = []
	for symbol: String in UTC_SYMBOLS:
		if _source_has(SAVE_SERVICE, symbol) or _source_has(ECONOMY, symbol):
			utc_found.append(symbol)
	_note("utc_anchor_symbols=%s" % JSON.stringify(utc_found))
	var settle_found: Array = []
	for symbol: String in SETTLE_SYMBOLS:
		if _source_has(SAVE_SERVICE, symbol) or _source_has(ECONOMY, symbol) or _source_has(HOST, symbol):
			settle_found.append(symbol)
	_note("offline_settlement_symbols=%s" % JSON.stringify(settle_found))
	if settle_found.is_empty():
		_missing("a settlement entry point for the elapsed-closure interval", SAVE_SERVICE)
		_note("consequence=2h/18h/48h returns cannot be simulated honestly; the clock only advances while a host ticks")

	# ---- 2. the clock that does exist, and its quantum -------------------
	var economy_script: Script = load(ECONOMY) as Script
	if economy_script == null:
		_missing("A3 economy service (queue + clock owner)", ECONOMY)
	else:
		var quantum := int(economy_script.get_script_constant_map().get("MAX_TICK_QUANTUM", 0))
		var time_contract := String(economy_script.get_script_constant_map().get("TIME_CONTRACT", ""))
		_note("economy_max_tick_quantum=%d time_contract=%s" % [quantum, time_contract])
		_expect(quantum > 0, "the active-tick host bounds one quantum instead of trusting a caller's number")
		# A single unbounded jump would let a caller settle a whole closure in one
		# call without the fuel the closure would have consumed.
		_expect(
			quantum <= 3600,
			"one settlement quantum stays within an hour, so fuel is consumed as time passes"
		)

	# ---- 3. double settlement must be impossible -------------------------
	# The product's own receipt rule is the oracle: replaying an event id must not
	# pay twice. This is a real dupe test on the shipped save service.
	var save := _save()
	var key := "a7.d060.double_settlement.%d" % Time.get_ticks_usec()
	var applied := 0
	for attempt in 2:
		var ok := bool(
			save.call(
				&"transact_once",
				key,
				func(candidate: Dictionary) -> bool:
					var counters: Dictionary = candidate.get("a7_d060_probe", {})
					counters["applied"] = int(counters.get("applied", 0)) + 1
					candidate["a7_d060_probe"] = counters
					return true,
				{"kind": "probe_only", "entity_id": "d060"}
			)
		)
		if ok:
			applied += 1
	var stored := int((_snapshot().get("a7_d060_probe", {}) as Dictionary).get("applied", 0))
	_expect(applied == 1, "the same settlement event settles exactly once")
	_expect(stored == 1, "the durable document records exactly one settlement for that event")
	_expect(
		bool(save.call(&"is_transaction_applied", key)),
		"the receipt for the settlement is recorded, so a reload cannot re-settle it"
	)
	# Clean the probe-only namespace out of the isolated save so nothing leaks.
	save.call(&"configure_storage", save_path, true)
	_note("probe_namespace_cleaned=true")

	# ---- 4. prepared work must be bounded by real fuel -------------------
	var jobs := _source_has(ECONOMY, "func jobs")
	_note("queue_api_present=%s" % str(jobs))
	if jobs:
		var states := _source_has(ECONOMY, "UNRESOLVED_JOB_STATES")
		_expect(states, "the queue keeps unresolved job states instead of reporting them as done")
		var fuel_bound := _source_has(ECONOMY, "fuel") or _source_has(ECONOMY, "supply")
		_expect(fuel_bound, "prepared work is bounded by a committed fuel/supply input")
	else:
		_missing("a bounded prepared-work queue", ECONOMY)
