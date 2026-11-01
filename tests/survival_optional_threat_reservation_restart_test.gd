extends "res://tests/survival_optional_threat_fault_test.gd"
## Three actual OS processes. First: fail the durable reservation before any
## enemy exists. Second: reconstruct, reserve, and land a genuine Hero hit with
## the old post-hit fault armed. Third: verify the same source cannot rearm.
## Test-only interruption is not a power cut; no mocked damage or teleport.
const RESERVATION_SAVE := "user://tests/optional_reservation_restart.json"
const RESERVATION_AUDIT := "user://tests/optional_reservation_restart_audit.json"
const RECEIPT := "survival.encounter.optional_skeleton.first_hit.v1"

func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = RESERVATION_SAVE
	var mode := "first"
	if OS.get_cmdline_user_args().has("--hit"):
		mode = "hit"
	elif OS.get_cmdline_user_args().has("--check"):
		mode = "check"
	_expect(bool(_save().call(&"configure_storage", save_path, true)), "real disk profile opens for " + mode)
	var ow := await _boot()
	if ow != null:
		await _reservation_phase(ow, mode)
	if is_instance_valid(_host):
		_host.queue_free()
		_host = null
	await process_frame
	_finish_reservation(mode)

func _finish_reservation(mode: String) -> void:
	paused = false
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	print("OPTIONAL THREAT RESERVATION RESTART %s - %d checks phase=%s" % ["PASSED" if failures.is_empty() else "FAILED", checks, mode])
	quit(0 if failures.is_empty() else 1)

func _reservation_phase(ow: Node, mode: String) -> void:
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var session := root.get_node("GameSession")
	var site := Vector2i(-1, -1)
	var safe := nav.cell_of(hero.global_position)
	var saved := {}
	if mode != "first":
		var file := FileAccess.open(RESERVATION_AUDIT, FileAccess.READ)
		_expect(file != null, "previous OS process recorded the physical site")
		if file == null:
			return
		var raw: Variant = JSON.parse_string(file.get_as_text())
		file.close()
		_expect(raw is Dictionary and raw.has("site") and raw.has("safe"), "site audit parses")
		if not raw is Dictionary or not raw.has("site") or not raw.has("safe"):
			return
		saved = raw
		site = Vector2i(int(saved.site[0]), int(saved.site[1]))
		safe = Vector2i(int(saved.safe[0]), int(saved.safe[1]))
		var center := Vector2(site.x * 16 + 8, site.y * 16 + 15)
		if hero.global_position.distance_to(center) <= 320.0:
			var path := _route(nav.cell_of(hero.global_position), safe, nav, hero)
			var escaped := not path.is_empty() and await _walk_path(hero, path)
			_expect(escaped and hero.global_position.distance_to(center) > 320.0, "ordinary input reaches the original spawn-safe distance")
			if not escaped or hero.global_position.distance_to(center) <= 320.0:
				return
	var score_before := int(session.get("score"))
	var inventory_before: Dictionary = (_save().call(&"get_snapshot") as Dictionary).get("inventory", {}).duplicate(true)
	if mode == "first":
		_expect(not bool(_save().call(&"is_transaction_applied", RECEIPT)), "fresh profile has no encounter reservation")
		_expect(bool(_save().call(&"configure_test_save_interruption", "after_temporary")), "arm fault before enemy exposure")
		var found := _configure_site(ow)
		site = found.site
		var blocked := found.node as Node2D
		_expect(bool(found.ok) and site.x >= 0, "physical site validates even when reservation is refused")
		_expect(blocked.get_node_or_null("BoundedSkeleton") == null and bool(blocked.get("_spent")), "failed pre-spawn write exposes no enemy")
		_expect(not bool(_save().call(&"is_transaction_applied", RECEIPT)) and int(session.get("score")) == score_before, "failed reservation grants neither receipt nor hit score")
		_expect(((_save().call(&"get_snapshot") as Dictionary).get("inventory", {}) as Dictionary) == inventory_before, "failed reservation preserves exact inventory")
		if site.x >= 0:
			var output := FileAccess.open(RESERVATION_AUDIT, FileAccess.WRITE)
			_expect(output != null, "site audit is written for separate process")
			if output != null:
				output.store_string(JSON.stringify({"site": [site.x, site.y], "safe": [safe.x, safe.y]}, "", true, true))
				output.close()
	elif mode == "hit":
		_expect(not bool(_save().call(&"is_transaction_applied", RECEIPT)), "new process selects pre-reservation save")
		var rebuilt := _configure_site(ow, site)
		var encounter := rebuilt.node as Node2D
		_expect(bool(rebuilt.ok) and encounter.get_node_or_null("BoundedSkeleton") != null, "successful durable reservation exposes real enemy")
		_expect(bool(_save().call(&"is_transaction_applied", RECEIPT)), "reservation is durable before first hit")
		if not bool(rebuilt.ok) or encounter.get_node_or_null("BoundedSkeleton") == null:
			return
		var hit := await _real_hit(ow, encounter, true)
		_expect(hit and bool(encounter.get("_spent")), "real Hero hit occurs after reservation with old fault boundary armed")
		_expect(int(session.get("score")) > score_before, "real attack actually awarded existing combat score")
		_expect(bool(_save().call(&"is_transaction_applied", RECEIPT)), "hit cannot precede the durable one-use reservation")
	elif mode == "check":
		_expect(bool(_save().call(&"is_transaction_applied", RECEIPT)), "third OS process restores the durable reservation")
		var rebuilt := _configure_site(ow, site)
		var encounter := rebuilt.node as Node2D
		_expect(bool(rebuilt.ok) and encounter.get_node_or_null("BoundedSkeleton") == null, "same previously hit source cannot expose a second enemy")
		_expect(int(session.get("score")) == score_before, "reconstruction yields no repeat hit score")
