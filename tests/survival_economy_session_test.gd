extends "res://tests/survival_foundation_test.gd"
## Actual mounted overworld, production A0 clock/port and byte-pinned A3 service.
## Starting materials are collected from mounted nodes by test-driven interaction
## with a teleported, physics-disabled Hero and cleared inventory. Later fault
## cases use fixture grants. This is NOT a normal-input fresh-save journey.

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

# Test drives actual spawned resource nodes and transaction service, not player
# navigation or pointer dispatch. Inventory was explicitly cleared by harness.
func _harvest_mounted(ow: Node, hero: Node2D, kind: String, item: String, target: int) -> bool:
	var nodes: Dictionary = ow.get(&"survival_nodes")
	for value: Variant in nodes.values():
		var node := value as SurvivalResourceNode
		if node == null or node.resource_kind != kind:
			continue
		hero.global_position = node.global_position
		while _count(item) < target and node.can_interact(hero):
			node.interact(hero)
			if not bool(node.last_result().get("ok", false)):
				return false
			await create_timer(0.25).timeout
		if _count(item) >= target:
			return true
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
	_expect(await _harvest_mounted(ow, hero, "oak_tree", WOOD, 8), "mounted oak nodes transact sufficient wood without material grant")
	_expect(await _harvest_mounted(ow, hero, "scrap_pile", IRON, 2), "mounted scrap node transacts iron without material grant")
	_expect(await _harvest_mounted(ow, hero, "reed_clump", "reed_fibre", 6), "mounted reed nodes transact fibre without material grant")
	# Open the actual A0 production panel through its normal action and click a
	# visible recipe button; resource interactions above are test-driven.
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
	var modal_before: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	await create_timer(1.2).timeout
	var modal_after: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	_expect(int(modal_before.get("elapsed", -1)) == int(modal_after.get("elapsed", -2)), "visible gameplay modal grants no active production")
	panel.call(&"close_panel")
	await process_frame
	# A representative foreign modal must prevent opening our panel. This is a
	# generic A0 contract check, not an integration test of the real A6 UI.
	var other_modal := Control.new()
	other_modal.add_to_group(&"gameplay_modal")
	ow.add_child(other_modal)
	var blocked_toggle := InputEventAction.new()
	blocked_toggle.action = &"economy_toggle"
	blocked_toggle.pressed = true
	Input.parse_input_event(blocked_toggle)
	await process_frame
	blocked_toggle.pressed = false
	Input.parse_input_event(blocked_toggle)
	await process_frame
	_expect(not bool(panel.call(&"is_open")), "crafting panel cannot open over another gameplay modal")
	other_modal.queue_free()
	await process_frame
	var adapter: RefCounted = host.get(&"_adapter")
	var snapshot: Dictionary = host.call(&"_snapshot", "hand")
	var forged := snapshot.duplicate(true)
	forged["active_ticks"] = int(forged.active_ticks) + 9
	var denied: Dictionary = adapter.call(&"advance", "hand", forged, "native.forged")
	_expect(not bool(denied.get("ok", false)) and String(denied.get("reason", "")).begins_with("time_receipt_mismatch"), "actual A3 rejects forged UI tick receipt")
	var zero: Dictionary = adapter.call(&"advance", "hand", snapshot, "native.zero")
	_expect(not bool(zero.get("ok", false)) and String(zero.get("reason", "")) == "no_elapsed_time", "new receipt with zero elapsed time rejected")
	var partial_deadline := Time.get_ticks_msec() + 3000
	while Time.get_ticks_msec() < partial_deadline:
		var records: Dictionary = host.get(&"_stations")
		if int((records.get("hand", {}) as Dictionary).get("steps", 0)) >= 5:
			break
		await physics_frame
	var partial_records: Dictionary = host.get(&"_stations")
	_expect(int((partial_records.get("hand", {}) as Dictionary).get("steps", 0)) >= 5, "active callbacks accumulate a partial second before pause")
	paused = true
	_expect(int(((host.get(&"_stations") as Dictionary).get("hand", {}) as Dictionary).get("steps", -1)) == 0, "tree pause immediately discards partial active steps")
	var before: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	await create_timer(0.5, true).timeout
	var after: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	_expect(int(before.get("elapsed", -1)) == int(after.get("elapsed", -2)), "paused tree cannot grant production ticks")
	paused = false
	host.notification(Node.NOTIFICATION_APPLICATION_FOCUS_OUT)
	var focus_before: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	await create_timer(1.2).timeout
	var focus_after: Dictionary = (host.call(&"jobs") as Dictionary).get(hand_job, {})
	_expect(int(focus_before.get("elapsed", -1)) == int(focus_after.get("elapsed", -2)), "focus-out notification prevents production while inactive")
	host.notification(Node.NOTIFICATION_APPLICATION_FOCUS_IN)
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
	var wrong_hand: Dictionary = host.call(&"queue_recipe", "workbench_kit", bench)
	var wrong_bench: Dictionary = host.call(&"queue_recipe", "weave_cloth", "hand")
	_expect(String(wrong_hand.get("reason", "")) == "station_recipe_mismatch" and String(wrong_bench.get("reason", "")) == "station_recipe_mismatch" and _count("reed_fibre") == 6, "intent cannot bind hand jobs to bench or bench jobs to hand")
	var weave: Dictionary = host.call(&"queue_recipe", "weave_cloth", bench)
	var weave_id := String(weave.get("job_id", ""))
	_expect(bool(weave.get("ok", false)) and _count("reed_fibre") == 3, "real placed workbench reserves fibre in actual A3 queue")
	_expect(await _wait_job(host, weave_id, "ready", 30.0), "active gameplay clock completes actual workbench queue")
	var output: Dictionary = host.call(&"collect", weave_id)
	_expect(bool(output.get("ok", false)) and _count("binding_cloth") == 2, "real workbench produces and collects useful crafting material")
	var cancel_start: Dictionary = host.call(&"queue_recipe", "weave_cloth", bench)
	var cancel_id := String(cancel_start.get("job_id", ""))
	_expect(bool(cancel_start.get("ok", false)) and _count("reed_fibre") == 0, "second job reserves remaining inputs")
	_expect(bool(_save().call(&"patch_state_path", ["survival", "structures", bench, "station_enabled"], false)), "disable persisted placed station")
	_expect(await _wait_job(host, cancel_id, "paused", 5.0), "disabled station pauses actual queued job")
	var disabled_before: Dictionary = (host.call(&"jobs") as Dictionary).get(cancel_id, {})
	await create_timer(1.2).timeout
	var disabled_after: Dictionary = (host.call(&"jobs") as Dictionary).get(cancel_id, {})
	_expect(int(disabled_before.get("elapsed", -1)) == int(disabled_after.get("elapsed", -2)), "disabled time cannot be banked as production")
	_expect(bool(_save().call(&"patch_state_path", ["survival", "structures", bench, "station_condition"], 0)) and bool(_save().call(&"patch_state_path", ["survival", "structures", bench, "station_enabled"], true)), "zero condition remains inoperative even when enabled")
	await create_timer(1.2).timeout
	var broken: Dictionary = (host.call(&"jobs") as Dictionary).get(cancel_id, {})
	_expect(String(broken.get("status", "")) == "paused" and int(broken.get("elapsed", -1)) == int(disabled_after.get("elapsed", -2)), "broken station does not grant work")
	_expect(bool(svc.call(&"remove_structure", bench)), "station can be removed with escrow preserved")
	await process_frame
	_expect(bool((host.call(&"cancel", cancel_id) as Dictionary).get("ok", false)), "removed station job can be cancelled")
	_expect(bool((host.call(&"collect", cancel_id) as Dictionary).get("ok", false)) and _count("reed_fibre") == 3, "cancelled removed-station escrow returns once")
	_expect(bool(_save().call(&"reload_save")) and _count("binding_cloth") == 2 and _count("reed_fibre") == 3, "production and returned inputs survive save reload")
	# One-process simulated interruption, not an OS kill or a power-loss test.
	for boundary: String in ["after_temporary", "after_backup", "after_primary_removed", "after_primary_renamed"]:
		_expect(_give(WOOD, 6) and _give(IRON, 2), "prepare fault case " + boundary)
		var wood_before := _count(WOOD)
		var iron_before := _count(IRON)
		var ids_before := (host.call(&"jobs") as Dictionary).keys()
		_expect(bool(_save().call(&"configure_test_save_interruption", boundary)), "arm explicit debug interruption " + boundary)
		var interrupted: Dictionary = host.call(&"queue_recipe", "workbench_kit", "hand")
		_expect(not bool(interrupted.get("ok", false)), "interrupted enqueue reports no success " + boundary)
		_expect(bool(_save().call(&"reload_save")), "reload durable generation " + boundary)
		var fresh_id := ""
		for key: Variant in (host.call(&"jobs") as Dictionary).keys():
			if key not in ids_before:
				fresh_id = String(key)
		if fresh_id.is_empty():
			_expect(_count(WOOD) == wood_before and _count(IRON) == iron_before, "no committed job means inputs remain " + boundary)
		else:
			_expect(_count(WOOD) == wood_before - 6 and _count(IRON) == iron_before - 2, "committed job owns exact reserved inputs " + boundary)
			_expect(bool((host.call(&"cancel", fresh_id) as Dictionary).get("ok", false)) and bool((host.call(&"collect", fresh_id) as Dictionary).get("ok", false)), "recover interrupted escrow " + boundary)
			_expect(_count(WOOD) == wood_before and _count(IRON) == iron_before, "returned escrow conserved " + boundary)
		_expect(bool((adapter.call(&"ownership_audit") as Dictionary).get("ok", false)), "ownership audit survives interruption " + boundary)
	_body_complete = true
