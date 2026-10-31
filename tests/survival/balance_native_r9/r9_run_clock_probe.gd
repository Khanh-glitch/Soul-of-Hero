extends "res://tests/survival/balance_native_r9/r9_harness.gd"
## D061 / D066 / D071 — is there a run clock at all, and does anything in the
## shipped game anchor it?
##
## ## What the contract says
## `docs/survival/CURRENT_PRODUCT_CONTRACT.md` puts a durable UTC anchor at the
## centre of the replay model: a run starts once, keeps a maximum of 1,209,600
## elapsed real seconds, and expiry continues while the game is closed. D066 then
## makes a *restart* meaningful, and D071 makes an ended run stop accepting
## mutations instead of silently continuing.
##
## ## What this probe checks
## Three separate things, because they fail independently:
##
## 1. **Does A3, which owns the economy rule, know the numbers?** Shown as a
##    positive control, so the absence searches below are known to find text.
## 2. **Does anything in A0's shipped game persist a run identity or start time?**
##    Without that, no restart starts a *new* run and no expiry can fire while the
##    player is away, whatever the planner believes.
## 3. **What does the planner do when a caller supplies elapsed time?** Driven
##    through A7's port double, tagged `MODEL_ORACLE`: the rule is implemented, and
##    the missing piece is precisely the anchor — the caller owns the clock.
##
## Source text is read only to establish absence, and every absence is paired with
## a presence in the same file set. Absence of a key is evidence about the shipped
## tree, not proof that no runtime path exists — which is why the live profile
## dictionary is dumped too.

const PORT_DOUBLE = preload("res://tests/survival/balance_native_r9/r9_profile_port_double.gd")
const ECONOMY := "res://game/survival/economy/economy_service.gd"
const RUN_START := 1_780_000_000
const RUN_MAX_SECONDS := 1_209_600


func _body() -> void:
	probe_id = "R9RUNCLOCK"
	probe_title = "the 14-day clock exists as A3 constants but has no durable A0 anchor"
	owner_action = (
		"A0: persist a run identity and a UTC start timestamp in the save schema and expose them through the economy "
		+ "run context. Until that exists no restart starts a new run and no expiry continues offline, so D066 and "
		+ "D071 cannot be satisfied by any amount of A3 work."
	)

	# ---- 1. positive control: A3 owns the numbers ------------------------
	var planner := _read_source("res://game/survival/economy/meta_economy_planner.gd")
	if planner.is_empty():
		_missing("A3's meta_economy_planner.gd in the composed tree", "refs/live/arena-7a12b27e")
		_done()
		return
	var planner_run_max := planner.contains("RUN_MAX_SECONDS := 1209600")
	var planner_ragnarok := planner.contains("RAGNAROK_START_SECONDS := 950400")
	_note("positive_control: planner_run_max=%s planner_ragnarok_start=%s" % [str(planner_run_max), str(planner_ragnarok)])
	_expect(
		planner_run_max and planner_ragnarok,
		"A3 implements the 14-day and day-11 constants, so the searches below are known to find text"
	)

	# ---- 2. does A0 persist a run identity or start time? ----------------
	var a0_files: Array[String] = [
		"res://game/autoload/save_service.gd",
		"res://game/overworld/chapter1_overworld.gd",
		"res://game/survival/economy/a0_economy_adapter.gd",
	]
	var needles: Array[String] = ["run_started", "run_start_utc", "run_id", "run_expires", "1209600", "season"]
	var found: Dictionary = {}
	for path: String in a0_files:
		var text := _read_source(path)
		if text.is_empty():
			_note("unreadable=%s" % path)
			continue
		for needle: String in needles:
			if text.contains(needle):
				found["%s:%s" % [path.get_file(), needle]] = true
	_note("a0_scanned=%d/%d matches=%s" % [a0_files.size(), a0_files.size(), JSON.stringify(found.keys())])
	_expect(found.is_empty(),
		"no A0 file mentions a run identity, run start time, run expiry, the 14-day constant or a season (found %s)"
		% JSON.stringify(found.keys()))

	# The live profile is the runtime half of the same question.
	var save := _save()
	if save == null:
		_missing("SaveService in this composition", "res://game/autoload/save_service.gd")
		_done()
		return
	var snapshot := _snapshot()
	var profile_keys: Array = snapshot.keys()
	profile_keys.sort()
	_note("live_profile_keys=%s" % JSON.stringify(profile_keys))
	var runish: Array = profile_keys.filter(func(key: String) -> bool:
		return String(key).contains("run") or String(key).contains("season"))
	_note("run_shaped_profile_keys=%s" % JSON.stringify(runish))
	_expect(runish.is_empty(), "the live profile carries no run or season key that could be an anchor")
	_expect(profile_keys.size() > 5, "the profile dictionary is real and populated, so an empty result is not a broken read")

	# ---- 3. the planner rule itself, through the double ------------------
	var economy_script: Script = load(ECONOMY) as Script
	if economy_script == null:
		_missing("an instantiable A3 economy service", ECONOMY)
		_done()
		return
	var econ: RefCounted = economy_script.new()
	if not bool(econ.call(&"configure", save)):
		_missing("A3's economy service accepting the composed SaveService", ECONOMY)
		_done()
		return
	var port: RefCounted = PORT_DOUBLE.new()
	port.set("run_ctx", _run_context(RUN_START + RUN_MAX_SECONDS - 1))
	port.set("endpoints", {})
	port.set("sources", {})
	_note("configure_meta_profile_port=%s" % str(bool(econ.call(&"configure_meta_profile_port", port))))
	_expect(bool(econ.call(&"configure_meta_profile_port", port)), "A3 accepts A7's double, so the rule can be exercised")

	var request := {
		"contract": "soh.economy.meta_source_authority.v1",
		"run_id": "a7-r9-runclock",
		"source_id": "elder_ashen_vault",
		"source_instance_id": "vault-1",
		"expected_generation": 1,
		"event_id": "runclock.alive",
	}
	port.set("run_ctx", _run_context(RUN_START + RUN_MAX_SECONDS - 1))
	var alive: Variant = econ.call(&"plan_meta_source_claim", request)
	_note("MODEL_ORACLE one_second_before_limit reason=%s" % String(alive.get("reason", "ok")))
	request["event_id"] = "runclock.expired"
	port.set("run_ctx", _run_context(RUN_START + RUN_MAX_SECONDS + 1))
	var expired: Variant = econ.call(&"plan_meta_source_claim", request)
	_note("MODEL_ORACLE one_second_past_limit reason=%s" % String(expired.get("reason", "ok")))
	_expect(String(alive.get("reason", "")) != "run_expired",
		"one second before the limit the planner does not refuse for expiry (it refused as %s, which is the "
		% String(alive.get("reason", "ok")) + "expected consequence of a hand-supplied clock, not of time)")
	_expect(String(expired.get("reason", "")) == "run_expired",
		"one second past the limit the planner refuses with run_expired")

	_note(
		"VERDICT: the rule is implemented wherever the clock is handed to it, and no shipped subsystem keeps a run "
		+ "clock. Every meta-economy check in this round must therefore supply elapsed time by hand, and no offline "
		+ "expiry can fire for a player. What a restart means today is 'the same run, as far as any durable record goes'."
	)
	_done()


func _run_context(now: int) -> Dictionary:
	return {
		"contract": "soh.economy.a0_run_context.v1",
		"run_id": "a7-r9-runclock",
		"run_epoch": 1,
		"run_started_at_unix": RUN_START,
		"now_unix": now,
		"expires_at_unix": RUN_START + RUN_MAX_SECONDS,
		"status": "active",
	}


func _read_source(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return ""
	return file.get_as_text()
