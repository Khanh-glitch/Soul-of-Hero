extends "res://tests/survival_normal_input_gather_test.gd"
## Continuation of the actual fresh-save ordinary-input production journey.
## No grants, teleports, direct harvest or fabricated clock. Still not B0:
## canonical POIs, expedition, genuine threat/death and human play are absent.

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("NORMAL HOME JOURNEY %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _gather_until(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability, kind: String, item: String, quantity: int) -> bool:
	var camera := ow.get(&"camera") as Camera2D
	for attempt in range(80):
		if _count(item) >= quantity:
			return true
		var node := await _walk_to_kind(ow, hero, nav, kind)
		if node == null:
			print("HOME_GATHER_FAIL item=%s count=%d reason=no_reachable_node position=%s" % [item, _count(item), str(hero.global_position)])
			return false
		camera.reset_smoothing()
		camera.force_update_scroll()
		await create_timer(0.3).timeout
		var before := _count(item)
		await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
		if _count(item) <= before:
			print("HOME_GATHER_FAIL item=%s count=%d node=%s result=%s" % [item, before, node.node_id, str(node.last_result())])
			return false
	return _count(item) >= quantity

func _place_at(ow: Node, build: SurvivalBuildSystem, cell: Vector2i) -> bool:
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var position := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
	var window := root.get_final_transform() * (camera.get_canvas_transform() * position)
	Input.warp_mouse(window)
	await process_frame
	await process_frame
	await _click_window(window)
	var result := not build.entity_at_layer(cell, "object").is_empty()
	if not result:
		print("HOME_PLACE_FAIL cell=%s preview=%s reason=%s mouse=%s" % [str(cell), str(build.preview_cell()), build.last_rejection(), str(root.get_mouse_position())])
	return result

# Search a bounded 40-cell radius with production spatial rules, without moving
# the Hero. This is planning only: every paid click still runs full validation.
func _site_clear(build: SurvivalBuildSystem, center: Vector2i) -> bool:
	var world := build.world
	for dy in range(-2, 3):
		for dx in range(-2, 3):
			var cell := center + Vector2i(dx, dy)
			if cell.x < 0 or cell.y < 0 or cell.x >= world.width or cell.y >= world.height \
					or world.is_solid_cell(cell.x, cell.y) or world.is_water_cell(cell.x, cell.y) \
					or build._near_authored_place(cell, 5) or build._on_route_detail(cell) \
					or build._near_shortcut(cell, 4) or not build.entity_at_layer(cell, "object").is_empty() \
					or build._world_blocker_in_cell(cell):
				return false
	return true

func _shape_clear(cell: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	if not nav.in_bounds(cell) or not nav.is_free(cell):
		cache[cell] = false
		return false
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape.shape
	query.transform = Transform2D(0.0, Vector2(cell.x * 16 + 8, cell.y * 16 + 15) + shape.position)
	query.collision_mask = hero.collision_mask
	query.exclude = [hero.get_rid()]
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	cache[cell] = clear
	return clear

func _route(start: Vector2i, goal: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D) -> Array[Vector2i]:
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {start: start}
	var cache: Dictionary = {}
	var cursor := 0
	while cursor < queue.size() and not previous.has(goal):
		var cell := queue[cursor]
		cursor += 1
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT]:
			var next := cell + step
			if previous.has(next) or not _shape_clear(next, nav, hero, cache):
				continue
			previous[next] = cell
			queue.append(next)
	var path: Array[Vector2i] = []
	if not previous.has(goal):
		return path
	while goal != start:
		path.push_front(goal)
		goal = previous[goal]
	return path

func _walk_path(hero: CharacterBody2D, path: Array[Vector2i]) -> bool:
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			print("HOME_ROUTE_FAIL actor=%s target=%s" % [str(hero.global_position), str(cell)])
			return false
	_set_direction(Vector2.ZERO)
	return true

func _body() -> void:
	await super._body()
	if not failures.is_empty() or _count("binding_cloth") != 2:
		_body_complete = true
		return
	_body_complete = false
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var nav := ow.get(&"traversability") as OverworldTraversability
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	_expect(await _gather_until(ow, hero, nav, "oak_tree", WOOD, 40), "ordinary inputs gather 40 oak for a real shelter")
	if _count(WOOD) < 40:
		_body_complete = true
		return
	_expect(await _gather_until(ow, hero, nav, "scrap_pile", IRON, 3), "ordinary inputs gather three scrap for door, chest and bed")
	if _count(IRON) < 3:
		_body_complete = true
		return
	# Choose a nearby legal site, then actually walk there; the test never moves
	# the Hero by assignment or builds from beyond the normal six-cell reach.
	var start := nav.cell_of(hero.global_position)
	var distances := nav.reachable_from(start)
	var center := Vector2i(-1, -1)
	for radius in range(0, 41):
		if center.x >= 0:
			break
		for dy in range(-radius, radius + 1):
			if center.x >= 0:
				break
			for dx in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dy)) != radius:
					continue
				var candidate := start + Vector2i(dx, dy)
				if not nav.in_bounds(candidate) or distances[candidate.y * nav.width + candidate.x] < 0:
					continue
				if _site_clear(build, candidate):
					center = candidate
					break
	_expect(center.x >= 0, "bounded search finds a reachable prospective shelter site")
	if center.x < 0:
		_body_complete = true
		return
	var path := _route(start, center, nav, hero)
	_expect(center == start or not path.is_empty(), "live Hero-shape route leads to proposed shelter")
	if center != start and path.is_empty():
		_body_complete = true
		return
	var walked := await _walk_path(hero, path)
	_expect(walked and nav.cell_of(hero.global_position) == center, "ordinary movement reaches chosen shelter site")
	if not walked:
		_body_complete = true
		return
	await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_2")
	var origin := center - Vector2i(2, 2)
	var valid := true
	for y in range(5):
		for x in range(5):
			if not build.validate_cell(origin + Vector2i(x, y)).is_empty():
				valid = false
	print("HOME_SITE center=%s origin=%s valid=%s" % [str(center), str(origin), str(valid)])
	_expect(valid, "current reachable ground supports a shelter around the real Hero")
	if not valid:
		_body_complete = true
		return
	for y in range(5):
		for x in range(5):
			if x != 0 and x != 4 and y != 0 and y != 4:
				continue
			if x == 2 and y == 0:
				continue
			var placed := await _place_at(ow, build, origin + Vector2i(x, y))
			_expect(placed, "ordinary pointer paid wall %d,%d" % [x, y])
			if not placed:
				_body_complete = true
				return
	await _tap_action(&"build_slot_3")
	_expect(await _place_at(ow, build, origin + Vector2i(2, 0)), "ordinary pointer paid usable door")
	var room: String = build.room_topology.room_at(center)
	_expect(not room.is_empty(), "actual authored enclosure has a derived room and roof")
	await _tap_action(&"build_slot_5")
	var bed_cell := origin + Vector2i(3, 3)
	_expect(await _place_at(ow, build, bed_cell), "ordinary pointer paid bed inside room")
	await _tap_action(&"build_slot_4")
	var chest_cell := origin + Vector2i(1, 3)
	_expect(await _place_at(ow, build, chest_cell), "ordinary pointer paid chest inside room")
	await _tap_action(&"build_toggle")
	_expect(not build.active and _count(WOOD) == 0 and _count(IRON) == 0, "shelter charges exactly player-gathered material")
	_expect(bool(_save().call(&"reload_save")) and not (build.room_topology.room_at(center)).is_empty() \
		and not build.entity_at_layer(bed_cell, "object").is_empty() and not build.entity_at_layer(chest_cell, "object").is_empty(),
		"door, bed and chest remain in authoritative saved shelter")
	_body_complete = true
