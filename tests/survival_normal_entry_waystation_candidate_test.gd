extends "res://tests/survival_normal_entry_home_restart_test.gd"
## Normal application entry -> paid home -> A1 Waystation -> Relay -> return.
## One profile, ordinary synthetic controls; independent process is inherited.
## Explicit guarded candidate, not B0 combat/death/recovery or human approval.

func _console() -> void:
	ProjectSettings.set_setting("survival/a0_waystation_candidate", true)
	await super._console()

func _walk_to(hero: CharacterBody2D, nav: OverworldTraversability, cell: Vector2i, label: String) -> bool:
	var start := nav.cell_of(hero.global_position)
	var path := _route(start, cell, nav, hero)
	var ok := start == cell or (not path.is_empty() and await _walk_path(hero, path))
	var deadline := Time.get_ticks_msec() + 2500
	var target := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
	while ok and nav.cell_of(hero.global_position) != cell and Time.get_ticks_msec() < deadline:
		_set_direction(target - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	ok = ok and nav.cell_of(hero.global_position) == cell
	_expect(ok, label)
	return ok

func _use(ow: Node, hero: CharacterBody2D, point: Node2D) -> void:
	var end := Time.get_ticks_msec() + 2500
	while hero.global_position.distance_to(point.global_position) > 24.0 and Time.get_ticks_msec() < end:
		_set_direction(point.global_position - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	await _click_window(root.get_final_transform() * (camera.get_canvas_transform() * point.global_position))
	await process_frame

func _after_home_continuation() -> void:
	if not is_instance_valid(_host) or _host.get_child_count() == 0:
		_expect(false, "paid-home continuation has a production world")
		return
	var ow := _host.get_child(0)
	var host := ow.get_node_or_null("WaystationRuntime")
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	_expect(host != null and hero != null and nav != null, "production world owns one candidate host and Hero")
	if host == null or hero == null or nav == null:
		return
	var home := nav.cell_of(hero.global_position)
	var before: Dictionary = _save().call(&"inventory_totals")
	if not await _walk_to(hero, nav, Vector2i(408, 199), "ordinary input walks from paid home to Waystation locker"):
		return
	await _use(ow, hero, host.get_node("Locker") as Node2D)
	var unlocked: Dictionary = _save().call(&"get_snapshot")
	_expect((_save().call(&"inventory_totals") as Dictionary) == before, "locker provides no invented loot")
	_expect(((unlocked.get("world_slice", {}) as Dictionary).get("capabilities", []) as Array).has("cap_salvage"), "locker grants salvage access")
	if not await _walk_to(hero, nav, Vector2i(406, 202), "ordinary input walks to physical cache stand"):
		return
	await _use(ow, hero, host.get_node("Cache") as Node2D)
	var cached: Dictionary = _save().call(&"inventory_totals")
	_expect(int(cached.get("iron_scrap", 0)) == int(before.get("iron_scrap", 0)) + 3 and int(cached.get("knowledge_spares", 0)) == int(before.get("knowledge_spares", 0)) + 2, "physical cache grants exactly A3 canonical loot")
	if not await _walk_to(hero, nav, Vector2i(410, 202), "ordinary input walks to ledger"):
		return
	await _use(ow, hero, host.get_node("Ledger") as Node2D)
	var sealed: Dictionary = _save().call(&"get_snapshot")
	_expect((_save().call(&"inventory_totals") as Dictionary) == cached and ((sealed.get("world_slice", {}) as Dictionary).get("capabilities", []) as Array).has("cap_seal_1"), "ledger records seal and no items")
	if not await _walk_to(hero, nav, Vector2i(398, 201), "ordinary input walks to deadfall"):
		return
	await _use(ow, hero, host.get_node("Deadfall") as Node2D)
	var gathered: Dictionary = _save().call(&"inventory_totals")
	_expect(int(gathered.get("oak_wood", 0)) == int(cached.get("oak_wood", 0)) + 2, "deadfall gives exactly two oak")
	if not await _walk_to(hero, nav, Vector2i(442, 234), "ordinary input walks to Relay"):
		return
	await _use(ow, hero, host.get_node("Crank") as Node2D)
	var after: Dictionary = _save().call(&"inventory_totals")
	var powered: Dictionary = _save().call(&"get_snapshot")
	_expect(int(after.get("iron_scrap", 0)) == int(gathered.get("iron_scrap", 0)) - 2 and int(after.get("oak_wood", 0)) == int(gathered.get("oak_wood", 0)) - 1, "Relay consumes exact canonical materials")
	_expect(((powered.get("world_slice", {}) as Dictionary).get("capabilities", []) as Array).has("cap_power_1"), "Relay grants power capability")
	await _use(ow, hero, host.get_node("Crank") as Node2D)
	_expect((_save().call(&"inventory_totals") as Dictionary) == after, "repeated Relay action cannot consume or grant twice")
	if await _walk_to(hero, nav, home, "ordinary input returns to the same paid home"):
		(ow.get(&"state") as OverworldState).set_world_position(hero.global_position, true)
