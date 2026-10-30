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

## Stricter than _walk_to: assert the live shape really has a route, walk it with
## ordinary movement, then refine into the exact destination cell and trace it.
func _leg_to(hero: CharacterBody2D, nav: OverworldTraversability, destination: Vector2i, label: String) -> bool:
	var start := nav.cell_of(hero.global_position)
	var target := Vector2(destination.x * 16 + 8, destination.y * 16 + 15)
	var walked := false
	var attempts := 0
	var planned_ok := start == destination
	while attempts < 4 and nav.cell_of(hero.global_position) != destination and not bool(hero.get(&"dead")):
		attempts += 1
		var here := nav.cell_of(hero.global_position)
		var path := _route(here, destination, nav, hero)
		if here != destination and path.is_empty():
			print("A0_STAND_ROUTE_MISSING %s start=%s target=%s attempt=%d" % [label, str(here), str(destination), attempts])
			break
		planned_ok = true
		walked = await _walk_with_unstick(hero, path)
		var deadline := Time.get_ticks_msec() + 2500
		while walked and nav.cell_of(hero.global_position) != destination and Time.get_ticks_msec() < deadline:
			_set_direction(target - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		if not walked:
			# A stale shape or a body wedged on a prop edge is ordinary terrain for a
			# player: replan from where the Hero actually stands and keep walking.
			print("A0_STAND_REPLAN %s cell=%s attempt=%d dead=%s" % [label, str(nav.cell_of(hero.global_position)), attempts, str(bool(hero.get(&"dead")))])
			await physics_frame
			await physics_frame
	_expect(planned_ok, label + " live-shape route exists")
	var arrived := nav.cell_of(hero.global_position) == destination
	print("A0_STAND_TRACE %s start=%s target=%s actual=%s cell=%s walked=%s arrived=%s attempts=%d dead=%s health=%d" % [label, str(start), str(destination), str(hero.global_position), str(nav.cell_of(hero.global_position)), str(walked), str(arrived), attempts, str(bool(hero.get(&"dead"))), int(hero.get(&"health"))])
	if bool(hero.get(&"dead")):
		_expect(false, "ordinary journey does not kill the Hero before " + label)
		return false
	_expect(arrived, label)
	return arrived

## Diagonal walking toward each cell centre, with an ordinary player's escape when
## a wide body wedges on a solid corner: sidestep perpendicular for a few frames,
## then keep going. The inherited helper wedged at the same corner in both legs.
func _walk_with_unstick(hero: CharacterBody2D, path: Array[Vector2i]) -> bool:
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 6000
		var stuck := 0
		var nudges := 0
		var nudge_frames := 0
		var nudge := Vector2.ZERO
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			if nudge_frames > 0:
				nudge_frames -= 1
				_set_direction(nudge)
				await physics_frame
				continue
			var delta := point - hero.global_position
			var before := hero.global_position
			_set_direction(delta)
			await physics_frame
			stuck = stuck + 1 if hero.global_position.distance_to(before) < 0.4 else 0
			if stuck >= 6:
				nudges += 1
				if nudges > 10:
					break
				nudge = Vector2(signf(delta.y), -signf(delta.x)) if absf(delta.x) >= absf(delta.y) else Vector2(-signf(delta.y), signf(delta.x))
				nudge_frames = 18
				stuck = 0
				print("A0_UNSTICK %s actor=%s target=%s nudge=%d" % [str(cell), str(hero.global_position), str(point), nudges])
		if hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			print("A0_UNSTICK_FAIL actor=%s target=%s" % [str(hero.global_position), str(cell)])
			return false
	_set_direction(Vector2.ZERO)
	return true

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

## The inherited journeys finish inside the paid room. A closed door really does
## block the route planner, so the player has to walk to it and open it before any
## outside stand is reachable -- ordinary movement and pointer input only.
func _open_closed_doors(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability) -> bool:
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	if build == null:
		return true
	var structures: Dictionary = _survival().call(&"structures")
	var ids: Array = structures.keys()
	ids.sort()
	for value: Variant in ids:
		var id := String(value)
		var record: Dictionary = structures[id]
		if String(record.get("piece", "")) != "door_wood" or bool(record.get("door_open", false)):
			continue
		var node: Node2D = build.structure_node(id)
		if node == null:
			continue
		var door_cell := nav.cell_of(node.global_position + Vector2(8, 8))
		var approach := Vector2i(-9999, -9999)
		for step: Vector2i in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
			var candidate: Vector2i = door_cell + step
			if not _route(nav.cell_of(hero.global_position), candidate, nav, hero).is_empty():
				approach = candidate
				break
		if approach.x == -9999:
			print("HOME_DOOR_UNREACHABLE door=%s cell=%s hero=%s" % [id, str(door_cell), str(nav.cell_of(hero.global_position))])
			continue
		if not await _walk_to(hero, nav, approach, "ordinary input approaches the closed home door"):
			return false
		await _use(ow, hero, node)
		var opened := bool(((_survival().call(&"structures") as Dictionary).get(id, {}) as Dictionary).get("door_open", false))
		_expect(opened, "ordinary pointer opens the home door before leaving the room")
		if not opened:
			return false
		print("HOME_DOOR_OPENED door=%s cell=%s" % [id, str(door_cell)])
	return true

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
	if not await _open_closed_doors(ow, hero, nav):
		return
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
