extends "res://tests/survival_normal_home_journey_test.gd"
## Focused technical fixture: test-granted kit/materials and actor positioning.
## Exercises the real paid structure, A0 panel/session, pinned A3, and real
## monotonic time. It is NOT the normal-input first-hour player journey.

var _original_physics_rate := 60

func _finish() -> void:
	Engine.physics_ticks_per_second = _original_physics_rate
	paused = false
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("A0 RESEARCH CLOCK UI %s - %d checks (FIXTURE FUNDED)" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _job_elapsed(host: Node, job_id: String) -> int:
	return int(((host.call(&"jobs") as Dictionary).get(job_id, {}) as Dictionary).get("elapsed", -1))

func _body() -> void:
	_original_physics_rate = Engine.physics_ticks_per_second
	_body_complete = false
	var ow := _host.get_child(0)
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var hero := ow.get(&"player") as CharacterBody2D
	var world := ow.get(&"world") as OverworldWorld
	var host := ow.get(&"economy_session") as Node
	var panel := ow.get(&"economy_panel") as Node
	_expect(host != null and panel != null, "actual overworld owns one A3 economy session and panel")
	if host == null or panel == null:
		_body_complete = true
		return
	hero.set_physics_process(false)
	_clear_inventory()
	_expect(build.select_piece("station_research"), "actual research station is selectable")
	var cell := Vector2i(-1, -1)
	for y in range(6, world.height - 7, 4):
		if cell.x >= 0:
			break
		for x in range(6, world.width - 7, 4):
			hero.global_position = Vector2(x * 16 + 8, y * 16 + 8)
			if build.validate_cell(Vector2i(x, y)).is_empty():
				cell = Vector2i(x, y)
				break
	_expect(cell.x >= 0, "fixture finds valid station footprint")
	if cell.x < 0:
		_body_complete = true
		return
	_expect(_give("research_kit", 1) and _give("knowledge_spares", 4) and _give("iron_scrap", 3), "explicit fixture grants research inputs")
	var placed: Dictionary = build.try_place(cell, "fixture.research.station")
	var station_id := String(placed.get("entity_id", ""))
	_expect(bool(placed.get("ok", false)) and not station_id.is_empty() and _count("research_kit") == 0, "physical station consumes its kit through real placement")
	if station_id.is_empty():
		_body_complete = true
		return
	var far := hero.global_position
	hero.global_position = far + Vector2(512, 0)
	var denied: Dictionary = host.call(&"queue_technology", "tech_smelting", station_id)
	_expect(not bool(denied.get("ok", true)) and _count("knowledge_spares") == 4 and _count("iron_scrap") == 3, "distant research is refused without custody change")
	hero.global_position = far
	hero.set_physics_process(true)
	await _tap_action(&"economy_toggle")
	var button := panel.find_child("Technology_tech_smelting_%s" % station_id, true, false) as Button
	var scroll := _owning_scroll(button) if button != null else null
	_expect(button != null and scroll != null and button.text.contains("4 knowledge spares") and button.text.contains("3 iron scrap"), "panel displays catalog-owned technology and exact cost")
	if button == null or scroll == null or not await _scroll_to(scroll, button):
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * button.get_global_rect().get_center())
	var id := ""
	for key: Variant in (host.call(&"jobs") as Dictionary).keys():
		var job: Dictionary = (host.call(&"jobs") as Dictionary)[key]
		if String(job.get("kind", "")) == "technology" and String(job.get("target", "")) == "tech_smelting":
			id = String(key)
	_expect(not id.is_empty() and _count("knowledge_spares") == 0 and _count("iron_scrap") == 0, "real pointer queues A3 research and reserves exact inputs")
	if id.is_empty():
		_body_complete = true
		return
	var duplicate: Dictionary = host.call(&"queue_technology", "tech_smelting", station_id)
	_expect(not bool(duplicate.get("ok", true)) and String(duplicate.get("reason", "")) == "research_pending", "duplicate research cannot charge twice")
	var modal_elapsed := _job_elapsed(host, id)
	await create_timer(1.5).timeout
	_expect(_job_elapsed(host, id) == modal_elapsed, "visible panel pauses real active work")
	await _tap_action(&"economy_toggle")
	Engine.physics_ticks_per_second = 30
	var start := _job_elapsed(host, id)
	await create_timer(4.5).timeout
	var low := _job_elapsed(host, id) - start
	Engine.physics_ticks_per_second = 120
	start = _job_elapsed(host, id)
	await create_timer(4.5).timeout
	var high := _job_elapsed(host, id) - start
	Engine.physics_ticks_per_second = _original_physics_rate
	print("RESEARCH_CLOCK_TRACE rate30=%d rate120=%d" % [low, high])
	_expect(low >= 3 and low <= 5 and high >= 3 and high <= 5, "30Hz and 120Hz grant comparable elapsed seconds, not callback counts")
	var deadline := Time.get_ticks_msec() + 45000
	var current: Dictionary = (host.call(&"jobs") as Dictionary).get(id, {})
	while String(current.get("status", "")) != "ready" and Time.get_ticks_msec() < deadline:
		await process_frame
		current = (host.call(&"jobs") as Dictionary).get(id, {})
	_expect(String(current.get("status", "")) == "ready", "real active time finishes permanent technology")
	if String(current.get("status", "")) == "ready":
		var snap: Dictionary = _save().call(&"get_snapshot")
		_expect(((snap.get("survival_economy", {}) as Dictionary).get("technologies", {}) as Dictionary).has("tech_smelting"), "A3 saves permanent technology")
		_expect(bool(_save().call(&"reload_save")), "research reloads from authoritative disk")
		var after: Dictionary = _save().call(&"get_snapshot")
		_expect(((after.get("survival_economy", {}) as Dictionary).get("technologies", {}) as Dictionary).has("tech_smelting"), "permanent technology survives reload")
	_body_complete = true
