extends "res://tests/survival_foundation_test.gd"
## A0 RunLifecycle at the real SaveService boundary. A fixed authoritative wall
## clock (test-only, gated by --survival-run-clock-test) is used so the 264 h
## entry/last72 boundary and the 336 h deadline can be tested at +-1 s. Every
## write is an ordinary SaveService commit; the second process reads the same
## disk profile.
const Lifecycle = preload("res://game/survival/economy/a0_run_lifecycle.gd")
const RUN_SAVE := "user://tests/a0_run_lifecycle.json"
const AUDIT := "user://tests/a0_run_lifecycle_audit.json"
const H := 3600
const BASE := 1800000000

var _lifecycle: Node


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = RUN_SAVE
	var verify := OS.get_cmdline_user_args().has("--verify-run")
	var loaded := bool(_save().call(&"configure_storage", save_path, true))
	_expect(loaded, "authoritative disk profile loads")
	if not loaded:
		_finish()
		return
	_lifecycle = Lifecycle.new()
	_lifecycle.name = "RunLifecycle"
	root.add_child(_lifecycle)
	_expect(bool(_lifecycle.call(&"configure", _save())), "run lifecycle binds the authoritative SaveService")
	if verify:
		_verify_process()
	else:
		_first_process()
	_finish()


func _finish() -> void:
	if OS.get_cmdline_user_args().has("--keep-run"):
		if failures.is_empty():
			print("A0 RUN LIFECYCLE PASSED - %d checks" % checks)
			quit(0)
		else:
			print("A0 RUN LIFECYCLE FAILED - %d/%d" % [failures.size(), checks])
			quit(1)
		return
	for path: String in [save_path, AUDIT]:
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	if failures.is_empty():
		print("A0 RUN LIFECYCLE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 RUN LIFECYCLE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _set_clock(at: int) -> void:
	var ok := bool(_lifecycle.call(&"configure_test_clock", at))
	_expect(ok, "authoritative wall clock set to %d (test-only path)" % at)


func _state() -> Dictionary:
	return _lifecycle.call(&"phase")


func _first_process() -> void:
	_set_clock(BASE)
	_expect(String(_state().get("state", "")) == "absent", "a fresh profile has no run")

	var started: Dictionary = _lifecycle.call(&"start_run", "run-round11-a")
	_expect(bool(started.get("ok", false)), "one new run starts (%s)" % str(started.get("reason", "")))
	var run: Dictionary = (started.get("run", {}) as Dictionary)
	_expect(int(run.get("run_expires_at_unix", 0)) - int(run.get("run_started_at_unix", 0)) == 1209600,
		"the run deadline is the creator-locked 336 h")
	var again: Dictionary = _lifecycle.call(&"start_run", "run-round11-b")
	_expect(not bool(again.get("ok", true)) and String(again.get("reason", "")) == "run_already_active",
		"a live run cannot be silently replaced")

	# Reset keeps ONLY the secured profile; every run-local namespace is fresh.
	var preserved := {"secured_ragnarok_currency": 12, "achievements": {"elder_stones": ["stone_a"]},
		"currency_receipts": [{"receipt_id": "r1", "delta": 12}]}
	var seeded: bool = bool(_save().call(&"transact_once", "soh.a0.test.profile.seed", func(candidate: Dictionary) -> bool:
		var profile: Dictionary = preserved.duplicate(true)
		profile["run"] = candidate["profile"]["run"]
		profile["run_history"] = candidate["profile"]["run_history"]
		candidate["profile"] = profile
		# Real run-local state: carried items and survival progress. The reset must
		# drop both while keeping the secured profile above.
		var inventory: Dictionary = candidate.get("inventory", {})
		inventory["item_stacks"] = {"iron_scrap": {"item_id": "iron_scrap", "kind": "material", "quantity": 7}}
		candidate["inventory"] = inventory
		var survival: Dictionary = candidate.get("survival", {})
		survival["totals"] = {"harvests": 4}
		candidate["survival"] = survival
		return true, {"kind": "test_seed"}))
	_expect(bool(seeded), "a secured profile and a dirty world are seeded through SaveService")
	_expect(((_save().call(&"get_snapshot") as Dictionary).get("inventory", {}) as Dictionary).get("item_stacks", {}).has("iron_scrap"),
		"the seeded run really carries items before the boundary")


	# Phase boundaries: 264 h = entry -> last72, 336 h = deadline.
	_set_clock(BASE + 950399)
	_expect(String(_state().get("phase", "")) == "entry", "entry phase 1 s before the last-72 boundary")
	_set_clock(BASE + 950400)
	_expect(String(_state().get("phase", "")) == "last72", "last-72 phase starts exactly at 264 h")
	_set_clock(BASE + 1209599)
	var before: Dictionary = _state()
	_expect(String(before.get("state", "")) == "active" and not bool(before.get("just_expired", true)),
		"run is still active 1 s before the deadline")
	_expect(int(before.get("seconds_remaining", 0)) == 1, "seconds remaining is exact at the deadline edge")
	_set_clock(BASE + 1209600)
	var at_deadline: Dictionary = _state()
	_expect(String(at_deadline.get("state", "")) == "expired", "run expires exactly at 336 h")
	_expect(String(at_deadline.get("phase", "")) == "expired", "phase becomes expired at 336 h")

	# An expired run cannot be played, and expiry is not a caller's opinion.
	var early: Dictionary = _lifecycle.call(&"end_run", "expired", "run-round11-a")
	_expect(bool(early.get("ok", false)), "expiry settles once the deadline is real")
	_expect(bool(FileAccess.file_exists(save_path)), "the expiry is a durable commit")
	var twice: Dictionary = _lifecycle.call(&"end_run", "expired", "run-round11-a")
	_expect(not bool(twice.get("ok", true)) and String(twice.get("reason", "")) == "no_active_run",
		"an already-ended run cannot be charged twice")
	var history: Array = ((_save().call(&"get_snapshot") as Dictionary).get("profile", {}) as Dictionary).get("run_history", [])
	_expect(history.size() == 1, "exactly one history record after one ended run (%d)" % history.size())

	_set_clock(BASE + 1209700)
	var next_run: Dictionary = _lifecycle.call(&"start_run", "run-round11-b")
	_expect(bool(next_run.get("ok", false)), "a new run opens after the old one ended (%s)" % str(next_run.get("reason", "")))
	var next: Dictionary = (next_run.get("run", {}) as Dictionary)
	_expect(int(next.get("run_epoch", 0)) == 2, "the new run carries epoch 2")
	_expect(String(next.get("run_id", "")) == "run-round11-b", "the new run has its own durable identity")
	var document := _save().call(&"get_snapshot") as Dictionary
	var profile: Dictionary = document.get("profile", {})
	_expect(int(profile.get("secured_ragnarok_currency", 0)) == 12, "secured currency survives the run boundary")
	_expect(((profile.get("achievements", {}) as Dictionary).get("elder_stones", []) as Array).has("stone_a"),
		"elder stones survive the run boundary")
	_expect((profile.get("currency_receipts", []) as Array).size() == 1, "deposit receipts survive the run boundary")
	_expect((profile.get("run_history", []) as Array).size() == 1, "run history survives the run boundary")
	_expect(not document.has("world_slice") or (document.get("world_slice", {}) as Dictionary).is_empty(),
		"the ended run's POI state does not leak into the new run")
	var stacks: Dictionary = (document.get("inventory", {}) as Dictionary).get("item_stacks", {})
	_expect(not stacks.has("iron_scrap"), "the ended run's carried items do not leak into the new run")
	_expect(int((document.get("survival", {}) as Dictionary).get("totals", {}).get("harvests", 0)) == 0,
		"the ended run's survival progress does not leak into the new run")
	_expect(not document.has("survival_economy") or (document.get("survival_economy", {}) as Dictionary).is_empty(),
		"the ended run's stations/jobs/cooldowns do not leak into the new run")
	var receipts: Dictionary = document.get("applied_transactions", {})
	_expect(not receipts.has("a1slice:poi_crown_waystation:cache_restock:1"), "no old claim receipt survives the reset")

	# A rollback must not resurrect the run or move its deadline.
	_set_clock(BASE + 100)
	_expect(String(_state().get("state", "")) == "active", "a wall-clock rollback never revives an ended run")
	_expect(int(_state().get("run_started_at_unix", 0)) == BASE + 1209700, "the start time is durable, not recomputed")

	# Voluntary exit and physical evacuation are ordinary player choices, but both
	# require the explicit token and both are durable exactly once.
	_set_clock(BASE + 1210000)
	_expect(not bool(_lifecycle.call(&"abandon_run", "GUESS").get("ok", true)), "an untokened abandon is refused")
	var evacuated: Dictionary = _lifecycle.call(&"abandon_run", "RUN_SOUL_OF_HERO_END", true)
	_expect(bool(evacuated.get("ok", false)), "a player evacuation ends the run")
	var ended: Dictionary = _save().call(&"get_snapshot").get("profile", {}).get("run", {})
	_expect(String(ended.get("state", "")) == "exited" and String(ended.get("end_reason", "")) == "evacuation",
		"the evacuation is recorded as the durable end reason")

	_set_clock(BASE + 1210100)
	var third: Dictionary = _lifecycle.call(&"start_run", "run-round11-c")
	_expect(bool(third.get("ok", false)), "a third run opens after the evacuation")
	_expect(int((third.get("run", {}) as Dictionary).get("run_epoch", 0)) == 3, "run epochs are strictly increasing")
	_expect(int((_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("secured_ragnarok_currency", 0)) == 12,
		"even a voluntary exit keeps the secured profile")
	var history_after: Array = (_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("run_history", [])
	_expect(history_after.size() == 2, "two ended runs produced exactly two history records (%d)" % history_after.size())

	var audit := {
		"run": _state(),
		"snapshot": _lifecycle.call(&"snapshot"),
		"balance": int((_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("secured_ragnarok_currency", 0)),
		"history": history_after.size(),
		"transactions": (_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size(),
	}
	var file := FileAccess.open(AUDIT, FileAccess.WRITE)
	_expect(file != null, "first process writes the lifecycle audit")
	if file != null:
		file.store_string(JSON.stringify(audit, "\t", true, true))
		file.close()


func _verify_process() -> void:
	_set_clock(BASE + 1210200)
	var file := FileAccess.open(AUDIT, FileAccess.READ)
	_expect(file != null, "second process reads the lifecycle audit")
	if file == null:
		return
	var baseline: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(baseline is Dictionary, "lifecycle audit is valid JSON")
	if not baseline is Dictionary:
		return
	var base: Dictionary = baseline
	var state := _state()
	_expect(String(state.get("run_id", "")) == String((base.get("run", {}) as Dictionary).get("run_id", "x")),
		"separate process restores the same run identity")
	_expect(int(state.get("run_epoch", 0)) == 3, "separate process restores the durable epoch")
	_expect(int(state.get("run_started_at_unix", 0)) == BASE + 1210100, "the deadline is not recomputed on relaunch")
	_expect(int((_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("secured_ragnarok_currency", -1)) == 12,
		"separate process restores the secured profile")
	_expect(((_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("run_history", []) as Array).size() == 2,
		"separate process restores both run history records")
	_expect((_save().call(&"get_snapshot") as Dictionary).get("applied_transactions", {}).size() == int(base.get("transactions", -1)),
		"relaunch adds no transaction by itself")
	var replay_start: Dictionary = _lifecycle.call(&"start_run", "run-round11-c")
	_expect(not bool(replay_start.get("ok", true)), "a relaunch cannot start a second run over the live one")
	_expect(int((_save().call(&"get_snapshot").get("profile", {}) as Dictionary).get("secured_ragnarok_currency", -1)) == 12,
		"a refused replacement start cannot change the profile")
	# Wall time has not reached the new deadline, so rounding must refuse expiry.
	var bogus: Dictionary = _lifecycle.call(&"end_run", "expired")
	_expect(not bool(bogus.get("ok", true)) and String(bogus.get("reason", "")) == "not_expired",
		"a caller cannot declare an unexpired run expired")
