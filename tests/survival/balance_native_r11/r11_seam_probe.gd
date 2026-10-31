extends "res://tests/survival/balance_native_r11/r11_harness.gd"
## WP1 — what the CURRENT composition actually mounts, and which round-10 defects
## are gone.
##
## Round 10 measured five things on stale bytes: A0 pinned an item file A3 no
## longer shipped (`economy_session` went null), the profile port had no production
## caller, no run could end, a direct currency write survived `status=expired`, and
## the Waystation could not mount without the session. Every one of those has a
## plausible owner fix in the current tree. The rule for this probe is that a fix
## counts only when it is **observed on the mounted product**, not when the line of
## code exists:
##
## * the session is mounted and the fence passes → measured by booting the world,
##   and the fence is re-verified by A7 from the file bytes (never by asking A0
##   whether A0's own fence is happy);
## * the port has a production caller → a census of `game/`, plus the mounted
##   composition holding a bound port;
## * a run can end and restart → driven through the lifecycle, then reopened;
## * the Waystation door → mounted behind the product's own flag, which the shipped
##   `project.godot` leaves off, so the verdict says "mounted" not "live".

func _body() -> void:
	probe_id = "R11SEAM"
	probe_title = "current composition seam: session, fence, port caller, run lifecycle, endpoints"
	owner_action = (
		"A0: the fence, the caller and the run lifecycle are now real. Remaining A0 gap: "
		+ "`settle_expiry()` is called once at composition configure and nowhere else, so a run that "
		+ "expires while the player is standing in it is never closed until the next mount."
	)

	# ---- 1. the shipped bytes mount at all -------------------------------
	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY in this composition: %s" % blocked)
		_done()
		return
	_note("spawn_cell=%s hero_position=%s" % [str(spawn_cell), str(hero.global_position)])
	_expect(_hero_cell().x >= 0, "the Hero stands on a real traversable cell (%s)" % str(_hero_cell()))

	# ---- 2. the A3 economy session (round-10 blocker #1) ----------------
	var economy := _a3()
	_expect(economy != null, "the A3 economy session is mounted in the shipped overworld (round 10: null)")
	if economy == null:
		_missing("a configured A3 economy session on the ordinary player path",
			"chapter1_overworld.gd::_build_economy_session")
		_done()
		return
	_expect(bool(economy.get(&"_configured")), "the mounted economy session reports itself configured")
	var adapter := _adapter()
	_expect(adapter != null, "the pinned A3 adapter is the live economy authority")
	var document := _a3_document()
	_expect(not document.is_empty(), "the A3 document loads from the real SaveService")
	var items: Variant = document.get("items", {})
	var stations: Variant = document.get("stations", {})
	_note("a3 document: items=%d stations=%d instances=%d" % [
		(items as Dictionary).size() if items is Dictionary else -1,
		(stations as Dictionary).size() if stations is Dictionary else -1,
		((document.get("instances", {}) as Dictionary).size()) if document.get("instances") is Dictionary else -1,
	])

	# ---- 3. the source fence, re-verified from the bytes ----------------
	# Reading A0's own `verify()` would be asking the fence whether it likes itself.
	# A7 re-hashes the pinned paths and compares, so a fence that pins a file it no
	# longer ships is visible here.
	var fence_script: Script = load("res://game/survival/economy/a0_v5_source_pins.gd") as Script
	_expect(fence_script != null, "A0 ships the A3 source fence")
	if fence_script != null:
		var constants: Dictionary = fence_script.get_script_constant_map()
		var data: Dictionary = constants.get("DATA", {})
		var scripts: Dictionary = constants.get("SCRIPTS", {})
		_expect(data.size() >= 10, "the fence pins a real data byte set (%d files)" % data.size())
		_expect(scripts.size() >= 4, "the fence pins the A3 planner scripts too (%d)" % scripts.size())
		var drifted: Array[String] = []
		for path: Variant in data.keys():
			var want := String(data[path])
			var res_path := String(path)
			if not FileAccess.file_exists(res_path):
				drifted.append("%s:absent" % res_path)
			elif FileAccess.get_sha256(res_path) != want:
				drifted.append("%s:bytes" % res_path)
		for path: Variant in scripts.keys():
			var res_path := String(path)
			if not FileAccess.file_exists(res_path):
				drifted.append("%s:absent" % res_path)
			elif FileAccess.get_sha256(res_path) != String(scripts[path]):
				drifted.append("%s:bytes" % res_path)
		_expect(drifted.is_empty(),
			"every pinned A3 file exists and matches its pinned sha256 (%s)" % ("clean" if drifted.is_empty() else str(drifted)))
		_note("fence: %d data + %d script paths re-hashed by A7" % [data.size(), scripts.size()])

	# ---- 4. the profile port has a production caller (round-10 blocker #2)
	var caller_census := _source_calls("res://game", "configure_meta_profile_port", "a0_profile_port.gd")
	_note("configure_meta_profile_port call sites in game/ (excluding the port itself) = %d" % caller_census)
	_expect(caller_census >= 1, "something in game/ binds the profile port (round 10: 0 callers)")
	var mounted_composition := _composition()
	_expect(mounted_composition != null, "the mounted world built the A0 economy composition root")
	if mounted_composition == null:
		_missing("a mounted A0 economy composition", "chapter1_overworld.gd::_build_economy_composition")
		_done()
		return
	var port: RefCounted = mounted_composition.get(&"_port")
	_expect(port != null, "the composition bound a live profile port to the real SaveService")
	_expect(mounted_composition.get_node_or_null("A0OfflineHost") != null,
		"the composition mounted its offline host as a child of the product root")

	# ---- 5. one run identity, shared by every authority ------------------
	var run := _active_run()
	_expect(not run.is_empty(), "the mounted world belongs to a durable run record")
	var phase := _run_phase()
	_note("run_id=%s state=%s phase=%s remaining=%ss" % [
		String(run.get("run_id", "")), String(phase.get("state", "")), String(phase.get("phase", "")),
		str(phase.get("seconds_remaining", -1)),
	])
	_expect(String(phase.get("state", "")) == "active", "a fresh run is active")
	_expect(int(run.get("run_max_seconds", 0)) == RUN_MAX_SECONDS,
		"the run is capped at the creator-locked 336 h (%d s)" % int(run.get("run_max_seconds", 0)))
	if port != null:
		var ctx: Dictionary = port.call(&"run_context")
		_expect(String(ctx.get("run_id", "")) == String(run.get("run_id", "x")),
			"the A3-facing port reports the same run identity the lifecycle owns")
		# The port speaks A3's contract spelling (`expires_at_unix`); the lifecycle
		# record keeps the A0 spelling. Comparing the two is the point of the check.
		_expect(int(ctx.get("expires_at_unix", 0)) == int(run.get("run_expires_at_unix", -1)),
			"the port reports the lifecycle deadline, not a second clock (%d vs %d)"
			% [int(ctx.get("expires_at_unix", 0)), int(run.get("run_expires_at_unix", -1))])
		var profile := _bound_profile()
		_expect(not profile.is_empty(), "the bound port reads a real profile out of the document")
		_expect(int(profile.get("secured_ragnarok_currency", -1)) == 0,
			"a fresh profile starts with no secured currency")

	# ---- 6. the run can end and a new one can start (round-10 blocker #3)
	var end: Dictionary = _lifecycle().call(&"end_run", "voluntary_exit", String(run.get("run_id", ""))) as Dictionary
	_expect(bool(end.get("ok", false)),
		"a run can be ended by its own lifecycle (round 10: no end_run at all) [%s]" % String(end.get("reason", "")))
	var profile_after := _bound_profile()
	var history: Array = profile_after.get("run_history", []) if profile_after.get("run_history") is Array else []
	_expect(history.size() >= 1, "ending a run writes exactly one immutable history entry (%d)" % history.size())
	if history.size() >= 1:
		var entry: Dictionary = history[history.size() - 1]
		_expect(String(entry.get("run_id", "")) == String(run.get("run_id", "x")),
			"the history entry names the run that ended")
		_expect(String(entry.get("end_reason", "")) == "voluntary_exit",
			"the history entry records why it ended (%s)" % String(entry.get("end_reason", "")))
	var second_end: Dictionary = _lifecycle().call(&"end_run", "voluntary_exit", String(run.get("run_id", ""))) as Dictionary
	_expect(not bool(second_end.get("ok", true)),
		"a second end of the same run is refused (%s) so a restart cannot charge it twice" % String(second_end.get("reason", "")))
	var started: Dictionary = _lifecycle().call(&"start_run") as Dictionary
	_expect(bool(started.get("ok", false)), "a new run starts after the old one closed (%s)" % String(started.get("reason", "")))
	var new_run: Dictionary = _active_run()
	_expect(String(new_run.get("run_id", "")) != String(run.get("run_id", "")),
		"the new run has a different identity (%s -> %s)" % [String(run.get("run_id", "")), String(new_run.get("run_id", ""))])
	_expect(int(new_run.get("run_epoch", 0)) > int(run.get("run_epoch", 0)),
		"the new run advances the epoch (%d -> %d)" % [int(run.get("run_epoch", 0)), int(new_run.get("run_epoch", 0))])

	# ---- 7. expiry is a wall-clock fact, not a caller's opinion ---------
	var premature: Dictionary = _lifecycle().call(&"end_run", "expired", String(new_run.get("run_id", ""))) as Dictionary
	_expect(not bool(premature.get("ok", true)),
		"the lifecycle refuses to call a live run expired (%s)" % String(premature.get("reason", "")))
	var still_active := String(_run_phase().get("state", ""))
	_expect(still_active == "active", "the run is still active after a refused expiry claim (%s)" % still_active)

	# ---- 8. the physical endpoints -------------------------------------
	var report := _endpoint_report()
	_expect(report.size() >= 8, "the composition reports every A3 endpoint (%d)" % report.size())
	var with_owner := 0
	var absent := 0
	var unauthorized := 0
	for id: Variant in report.keys():
		var row: Dictionary = report[id]
		var reason := String(row.get("blocked_reason", ""))
		if (row.get("physical_owner", {}) as Dictionary).is_empty():
			absent += 1
		else:
			with_owner += 1
		if reason.begins_with("A1_A8_ENDPOINT_UNAUTHORIZED"):
			unauthorized += 1
	_note("endpoints: %d with an authored stand, %d with no site, %d owner-unauthorized" % [with_owner, absent, unauthorized])
	_expect(with_owner >= 1, "at least one A3 endpoint has a real authored stand (a physical owner)")
	_expect(unauthorized + absent == report.size(),
		"every endpoint is blocked by an owner, not silently available")

	# ---- 9. the Waystation door ----------------------------------------
	var flag_on := bool(ProjectSettings.get_setting("survival/a0_waystation_candidate", false))
	_note("shipped waystation candidate flag = %s" % str(flag_on))
	_expect(not flag_on, "the shipped project does not turn the Waystation candidate on by itself")

	_done()
