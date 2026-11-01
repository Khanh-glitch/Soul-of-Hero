extends "res://tests/survival_normal_home_journey_test.gd"
## LW1 C08 setup: reuse the existing ordinary-input paid home journey verbatim,
## but keep the authoritative save so the C08 gate can load a real player-built
## home. No ecology/threat is enabled here; this only gathers, crafts and builds
## through the same key/mouse path as the baseline regression.

const C08_HOME_SAVE := "user://tests/lw1_c08_home.json"


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 6)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = C08_HOME_SAVE
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await _boot()
	if _host != null:
		await _body()
		if not _body_complete:
			_expect(false, "paid home setup body ran to completion")
	_teardown()
	await process_frame
	await process_frame
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	var verdict := "PASSED" if failures.is_empty() else "FAILED"
	print("LW1 C08 HOME SETUP %s - %d checks (save kept: %s)" % [verdict, checks, save_path])
	quit(0 if failures.is_empty() else 1)
