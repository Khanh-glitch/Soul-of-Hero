extends "res://tests/survival_foundation_test.gd"
## Actual mounted overworld, production A0 clock/port and byte-pinned A3 service.
## Resources are fixture grants; this is not a human or fresh-input journey.

func _finish() -> void:
	paused = false
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL ECONOMY SESSION PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL ECONOMY SESSION FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _wait_job(host: Node, id: String, status: String, seconds: float) -> bool:
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		var job: Dictionary = (host.call(&"jobs") as Dictionary).get(id, {})
		if String(job.get("status", "")) == status:
			return true
		await process_frame
	return false

func _body() -> void:
	var ow := _host.get_child(0)
	var host: Node = ow.get(&"economy_session")
	var build: SurvivalBuildSystem = ow.get(&"survival_build")
	var hero: CharacterBody2D = ow.get(&"player")
	var world: OverworldWorld = ow.get(&"world")
	var svc := _survival()
	_expect(host != null, "production overworld mounts actual economy session")
	if host == null:
		_body_complete = true
		return
	hero.set_physics_process(false)
	_clear_inventory()
	_expect(_give(WOOD, 8) and _give(IRON, 2) and _give("reed_fibre", 6), "fixture materials in real shared inventory")
	# Open the actual A0 production panel through its normal action and click a
	# visible recipe button; the materials themselves remain fixture grants.
	var toggle_event := InputEventAction.new()
	toggle_event.action = &"economy_toggle"
	toggle_event.pressed = true
	Input.parse_input_event(toggle_event)
	await process_frame
	toggle_event.pressed = false
	Input.parse_input_event(toggle_event)
	await process_frame
	await process_frame
	var panel: Node = ow.get(&"economy_panel")
	var button := panel.find_child("Recipe_workbench_kit_hand", true, false) as Button
	print("ECONOMY_GUI_TRACE action=%s panel=%s visible=%s button=%s" % [str(InputMap.has_action(&"economy_toggle")), str(panel != null), str((panel.get_node_or_null("EconomyOverlay") as Control).visible if panel != null else false), str(button != null)])
	_expect(button != null and button.is_visible_in_tree(), "normal economy input exposes hand-kit button")
	if button == null or not button.is_visible_in_tree():
		_body_complete = true
		return
	if button != null:
		var click_position := root.get_final_transform() * (button.get_global_transform_with_canvas() * (button.size * 0.5))
		var motion := InputEventMouseMotion.new()
		motion.position = click_position
		Input.parse_input_event(motion)
		var click := InputEventMouseButton.new()
		click.position = click_position
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = true
		Input.parse_input_event(click)
		await process_frame
		click.pressed = false
		Input.parse_input_event(click)
		await process_frame
	var hand_job := ""
	for key: Variant in (host.call(&"jobs") as Dictionary).keys():
		var job: Dictionary = (host.call(&"jobs") as Dictionary)[key]
		if String(job.get("target", "")) == "workbench_kit":
			hand_job = String(key)
	_expect(not hand_job.is_empty() and _count(WOOD) == 2 and _count(IRON) == 0, "player GUI click reserves actual A3 hand recipe inputs atomically")
	panel.call(&"close_panel")
	await process_frame
	var adapter: RefCounted = host.get(&"_adapter")
	var snapshot: Dictionary = host.call(&"_snapshot", "hand")
	var forged := snapshot.duplicate(true)
	forged["active_ticks"] = int(forged.active_ticks) + 9
	var denied: Dictionary = adapter.call(&"advance", "hand", forged, "native.forged")
	_expect(not bool(denied.get("ok", false)) and String(denied.get("reason", "")).begins_with("time_receipt_mismatch"), "actual A3 rejects forged UI tick receipt")
	var zero: Dictionary = adapter.call(&"advance", "hand", snapshot, "native.zero")
	_expect(not bool(zero.get("ok", false)) and String(zero.get("reason", "")) == "no_elapsed_time", "new receipt with zero elapsed time rejected")
	paused = true
	var before: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	await create_timer(0.5, true).timeout
	var after: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	_expect(int(before.get("elapsed", -1)) == int(after.get("elapsed", -2)), "paused tree cannot grant production ticks")
	paused = false
	_expect(bool(_save().call(&"reload_save")), "reload save while hand job reserved")
	var reload_job: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	_expect(int(reload_job.get("elapsed", -1)) == int(before.get("elapsed", -2)), "reload preserves job without offline accrual")
	_expect(await _wait_job(host, hand_job, "ready", 35.0), "actual physics-driven active session completes hand kit")
	var collected: Dictionary = host.call(&"collect", hand_job)
	_expect(bool(collected.get("ok", false)) and _count("workbench_kit") == 1, "A3 collects manufactured kit into sole inventory")
	_expect(not bool((host.call(&"collect", hand_job) as Dictionary).get("ok", false)) and _count("workbench_kit") == 1, "duplicate collection cannot mint another kit")
	build.select_piece("station_workbench")
	var origin := Vector2i(-1, -1)
	for y in range(6, world.height - 7, 4):
		if origin.x >= 0:
			break
		for x in range(6, world.width - 7, 4):
			hero.global_position = Vector2(x * 16 + 8, y * 16 + 8)
			if build.validate_cell(Vector2i(x, y)).is_empty():
				origin = Vector2i(x, y)
				break
	_expect(origin.x >= 0, "real world supports workbench footprint")
	if origin.x < 0:
		_body_complete = true
		return
	var placed := build.try_place(origin, "native.economy.bench")
	var bench := String(placed.get("entity_id", ""))
	_expect(bool(placed.get("ok", false)) and _count("workbench_kit") == 0, "manufactured kit pays for physically placed workbench")
	var weave: Dictionary = host.call(&"queue_recipe", "weave_cloth", bench)
	var weave_id := String(weave.get("job_id", ""))
	_expect(bool(weave.get("ok", false)) and _count("reed_fibre") == 3, "real placed workbench reserves fibre in actual A3 queue")
	_expect(await _wait_job(host, weave_id, "ready", 30.0), "active gameplay clock completes actual workbench queue")
	var output: Dictionary = host.call(&"collect", weave_id)
	_expect(bool(output.get("ok", false)) and _count("binding_cloth") == 2, "real workbench produces and collects useful crafting material")
	var cancel_start: Dictionary = host.call(&"queue_recipe", "weave_cloth", bench)
	var cancel_id := String(cancel_start.get("job_id", ""))
	_expect(bool(cancel_start.get("ok", false)) and _count("reed_fibre") == 0, "second job reserves remaining inputs")
	_expect(bool(svc.call(&"remove_structure", bench)), "station can be removed with escrow preserved")
	await process_frame
	_expect(bool((host.call(&"cancel", cancel_id) as Dictionary).get("ok", false)), "removed station job can be cancelled")
	_expect(bool((host.call(&"collect", cancel_id) as Dictionary).get("ok", false)) and _count("reed_fibre") == 3, "cancelled removed-station escrow returns once")
	_expect(bool(_save().call(&"reload_save")) and _count("binding_cloth") == 2 and _count("reed_fibre") == 3, "production and returned inputs survive save reload")
	_body_complete = true
