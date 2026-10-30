extends "res://tests/survival_connector_pilot_test.gd"
## Separate-process pilot of the real A0 host and A3 source against the actual
## Hero, controller and A1 connector. Synthetic ordinary inputs; NOT production
## mount, human validation or the complete home/danger journey.
const HOST = preload("res://game/survival/waystation_host.gd")
const GEOMETRY = preload("res://game/survival/waystation_geometry.gd")
const PATH := "user://tests/waystation_input_restart.json"
const AUDIT := "user://tests/waystation_input_restart_audit.json"

func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = PATH
	var second := OS.get_cmdline_user_args().has("--restart")
	_expect(bool(_save().call(&"configure_storage", PATH, true)), "one real disk profile opens")
	if second:
		var f := FileAccess.open(AUDIT, FileAccess.READ)
		_expect(f != null, "first process wrote audit")
		if f == null:
			_finish(); return
		var expected: Variant = JSON.parse_string(f.get_as_text())
		_expect(expected is Dictionary, "first process audit parses")
		if not expected is Dictionary:
			_finish(); return
		var actual: Dictionary = _save().call(&"get_snapshot")
		for section: String in ["inventory", "survival", "world_slice", "applied_transactions"]:
			_expect(actual.get(section, {}) == expected.get(section, {}), "independent process preserves exact " + section)
	var ow := await _boot()
	if ow == null:
		_finish(); return
	var physical_world := ow.get(&"world") as OverworldWorld
	var body_count := physical_world.blocker_root.get_child_count()
	var duplicate_mount: Dictionary = GEOMETRY.mount(physical_world, "res://artifacts/a0-connector/slices/")
	_expect(not bool(duplicate_mount.get("ok", true)) and physical_world.blocker_root.get_child_count() == body_count, "duplicate source mount fails without adding any collider")
	var host := HOST.new()
	host.name = "WaystationRuntime"
	ow.add_child(host)
	var hero := ow.get(&"player") as CharacterBody2D
	var session := ow.get(&"economy_session") as Node
	_expect(session != null and host.configure(ow, hero, session), "real A0 host binds to the actual pilot Hero and EconomySession")
	if session != null:
		var before_clock := int(session.get("_world_seconds"))
		await create_timer(1.5).timeout
		_expect(int(session.get("_world_seconds")) >= before_clock + 1, "active world clock advances in real time")
		var modal := Control.new()
		modal.add_to_group(&"gameplay_modal")
		root.add_child(modal)
		await physics_frame
		var modal_clock := int(session.get("_world_seconds"))
		await create_timer(1.2).timeout
		_expect(int(session.get("_world_seconds")) == modal_clock, "visible gameplay modal accrues no active time")
		modal.queue_free()
		await process_frame
		await _journey(ow, hero, host, second)
	if is_instance_valid(_host):
		_host.queue_free()
	await process_frame
	if not second and _body_complete:
		var snapshot: Dictionary = _save().call(&"get_snapshot")
		var record := {}
		for section: String in ["inventory", "survival", "world_slice", "applied_transactions"]:
			record[section] = snapshot.get(section, {})
		var file := FileAccess.open(AUDIT, FileAccess.WRITE)
		_expect(file != null, "first process creates separate audit after scene exit")
		if file != null:
			file.store_string(JSON.stringify(record)); file.close()
	_finish()

func _click_point(ow: Node, hero: CharacterBody2D, point: Node2D) -> void:
	# Refine ordinary input to A1's exact range without crossing the collider.
	var deadline := Time.get_ticks_msec() + 2500
	while hero.global_position.distance_to(point.global_position) > 24.0 and Time.get_ticks_msec() < deadline:
		_set_direction(point.global_position - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * (camera.get_canvas_transform() * point.global_position))
	await process_frame

func _journey(ow: Node, hero: CharacterBody2D, host: Node, second: bool) -> void:
	var nav := ow.get(&"traversability") as OverworldTraversability
	var refuge := nav.cell_of(hero.global_position)
	var before: Dictionary = _save().call(&"inventory_totals")
	var locker := host.get_node("Locker") as Node2D
	var cache := host.get_node("Cache") as Node2D
	if not second:
		if not await _leg(hero, nav, Vector2i(408, 199), "Refuge to canonical locker"):
			return
		await _click_point(ow, hero, locker)
		var unlocked: Dictionary = _save().call(&"get_snapshot")
		_expect(((_save().call(&"inventory_totals")) as Dictionary) == before, "normal pointer unlocks locker without physical loot")
		_expect(((unlocked.get("world_slice", {}) as Dictionary).get("capabilities", []) as Array).has("cap_salvage"), "A3 grants canonical salvage capability")
	if not await _leg(hero, nav, Vector2i(406, 202), "ordinary input to exact external cache stand"):
		return
	await _click_point(ow, hero, cache)
	var after: Dictionary = _save().call(&"inventory_totals")
	if second:
		_expect(after == before, "independent-process cache replay during cooldown grants nothing")
	else:
		_expect(int(after.get("iron_scrap", 0)) == int(before.get("iron_scrap", 0)) + 3 and int(after.get("knowledge_spares", 0)) == int(before.get("knowledge_spares", 0)) + 2, "actual cache grants exactly canonical 3 scrap and 2 spares")
		var snapshot: Dictionary = _save().call(&"get_snapshot")
		var poi: Dictionary = ((snapshot.get("world_slice", {}) as Dictionary).get("pois", {}) as Dictionary).get("poi_crown_waystation", {})
		var key := "a1slice:poi_crown_waystation:cache_restock:1"
		_expect(int(poi.get("cache_claim_count", 0)) == 1 and (poi.get("reward_receipts", {}) as Dictionary).has(key), "canonical logical receipt and claim generation persisted with reward")
		var found := false
		for record: Variant in (snapshot.get("applied_transactions", {}) as Dictionary).values():
			if record is Dictionary and String((record.get("metadata", {}) as Dictionary).get("a1_transaction_key", "")) == key:
				found = true
		_expect(found, "same SaveService commit records canonical A1 receipt metadata")
		await _click_point(ow, hero, cache)
		_expect((_save().call(&"inventory_totals") as Dictionary) == after, "second physical activation cannot duplicate the source")
	if not await _leg(hero, nav, refuge, "return to Refuge"):
		return
	if not second:
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)
	_body_complete = true

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	print("A0 WAYSTATION INPUT RESTART %s - %d checks (ISOLATED CONNECTOR)" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)
