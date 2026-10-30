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

# Send distinct press/release objects across physics and render boundaries.
# Godot 4.7 warns that mutating/reusing one event in the same frame is unsafe.
func _tap_action(action: StringName) -> void:
	var press := InputEventAction.new()
	press.action = action
	press.pressed = true
	Input.parse_input_event(press)
	await physics_frame
	await process_frame
	var release := InputEventAction.new()
	release.action = action
	release.pressed = false
	Input.parse_input_event(release)
	await physics_frame
	await process_frame

func _click_window(position: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = position
	Input.parse_input_event(motion)
	var press := InputEventMouseButton.new()
	press.position = position
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	Input.parse_input_event(press)
	await physics_frame
	await process_frame
	var release := InputEventMouseButton.new()
	release.position = position
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	Input.parse_input_event(release)
	await physics_frame
	await process_frame

func _gather_until(ow: Node, hero: CharacterBody2D, nav: OverworldTraversability, kind: String, item: String, quantity: int) -> bool:
	var camera := ow.get(&"camera") as Camera2D
	for attempt in range(80):
		if _count(item) >= quantity:
			return true
		var node := await _walk_to_kind(ow, hero, nav, kind)
		if node == null:
			var cell := nav.cell_of(hero.global_position)
			var reachable := nav.reachable_from(cell)
			var open_cells := 0
			for value: int in reachable:
				if value >= 0:
					open_cells += 1
			var same_kind := 0
			var harvestable := 0
			for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
				var candidate := raw as SurvivalResourceNode
				if candidate != null and candidate.resource_kind == kind:
					same_kind += 1
					if bool(_survival().call(&"is_node_harvestable", candidate.node_id, kind)):
						harvestable += 1
			print("HOME_GATHER_FAIL item=%s count=%d reason=no_reachable_node attempt=%d position=%s cell=%s free=%s reachable_cells=%d kind_nodes=%d harvestable=%d" % [
				item, _count(item), attempt, str(hero.global_position), str(cell), str(nav.is_free(cell)),
				open_cells, same_kind, harvestable])
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

## The Hero is a 12x16 rectangle whose origin sits at its feet, so a stand cell
## places the body one pixel into the row above. A cell-centre query alone is
## therefore not proof that the body can *travel* between two cells: the planner
## also casts the same shape along each candidate segment.
func _shape_placement(cell: Vector2i, hero: CharacterBody2D) -> Transform2D:
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	return Transform2D(0.0, Vector2(cell.x * 16 + 8, cell.y * 16 + 15) + shape.position)

func _shape_query(hero: CharacterBody2D) -> PhysicsShapeQueryParameters2D:
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape.shape
	query.collision_mask = hero.collision_mask
	query.exclude = [hero.get_rid()]
	query.collide_with_bodies = true
	query.collide_with_areas = false
	return query

func _shape_clear(cell: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	if not nav.in_bounds(cell) or not nav.is_free(cell):
		cache[cell] = false
		return false
	var query := _shape_query(hero)
	query.transform = _shape_placement(cell, hero)
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	cache[cell] = clear
	return clear

## Swept clearance for one 16px step. Both endpoints may be clear while the
## straight segment clips a corner, which is exactly how a walker wedges.
##
## If the Hero already overlaps something it cannot be judged from here; the
## step is allowed and the walker's own contact handling deals with it. That
## keeps a body that is momentarily inside a doorway from losing its whole path.
func _sweep_clear(from: Vector2i, to: Vector2i, hero: CharacterBody2D) -> bool:
	var space := hero.get_world_2d().direct_space_state
	var query := _shape_query(hero)
	query.transform = _shape_placement(from, hero)
	if not space.intersect_shape(query, 1).is_empty():
		return true
	query.motion = _shape_placement(to, hero).origin - query.transform.origin
	var fractions := space.cast_motion(query)
	return fractions.size() >= 2 and fractions[0] >= 0.999

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
			if cache.has("edge:" + str(cell) + ">" + str(next)):
				if not bool(cache["edge:" + str(cell) + ">" + str(next)]):
					continue
			elif not _sweep_clear(cell, next, hero):
				cache["edge:" + str(cell) + ">" + str(next)] = false
				continue
			cache["edge:" + str(cell) + ">" + str(next)] = true
			previous[next] = cell
			queue.append(next)
	var path: Array[Vector2i] = []
	if not previous.has(goal):
		return path
	while goal != start:
		path.push_front(goal)
		goal = previous[goal]
	return path

## Ordinary continuous walking, one planned cell at a time.
##
## A player holds a direction and, when the body stops moving, tries another
## direction until the corner is cleared; that is reproduced here. When the body
## makes no progress the slide contacts are printed with their colliders and
## normals so a wedge is diagnosable instead of merely failing.
func _walk_path(hero: CharacterBody2D, path: Array[Vector2i]) -> bool:
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		var stalled := 0
		var escapes := 0
		var escape_frames := 0
		var escape_direction := Vector2.ZERO
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			if escape_frames > 0:
				escape_frames -= 1
				_set_direction(escape_direction)
				await physics_frame
				continue
			var before := hero.global_position
			_set_direction(point - before)
			await physics_frame
			stalled = stalled + 1 if hero.global_position.distance_to(before) < 0.25 else 0
			if stalled < 5:
				continue
			escapes += 1
			if escapes > 6:
				break
			_report_wedge(hero, cell, before, escapes)
			escape_direction = _escape_direction(hero, before, point, escapes)
			escape_frames = 10
			stalled = 0
		if hero.global_position.distance_to(point) > 4.5:
			_set_direction(Vector2.ZERO)
			print("HOME_ROUTE_FAIL actor=%s target=%s" % [str(hero.global_position), str(cell)])
			return false
	_set_direction(Vector2.ZERO)
	return true

## Slide contacts prove whether a stall is a real physical contact and against
## what; the normals say which directions the body can still slide.
func _report_wedge(hero: CharacterBody2D, cell: Vector2i, at: Vector2, attempt: int) -> void:
	var contacts: Array[String] = []
	for index: int in hero.get_slide_collision_count():
		var collision := hero.get_slide_collision(index)
		var other := collision.get_collider()
		contacts.append("%s normal=%s position=%s" % [
			other.name if other is Node else str(other),
			str(collision.get_normal()), str(collision.get_position())])
	print("A0_WALK_STALL cell=%s at=%s velocity=%s motion=%s attempt=%d contacts=%d [%s]" % [
		str(cell), str(at), str(hero.velocity), str(hero.get_last_motion()), attempt,
		contacts.size(), "; ".join(contacts)])

## A player wiggles: try the four cardinal directions in a rotating order that
## starts with the one most likely to slide along the contact.
func _escape_direction(hero: CharacterBody2D, at: Vector2, point: Vector2, attempt: int) -> Vector2:
	var to_target := (point - at).normalized()
	var order: Array[Vector2] = []
	if absf(to_target.x) >= absf(to_target.y):
		order = [Vector2(0, -signf(to_target.x)), Vector2(0, signf(to_target.x)),
			Vector2(to_target.x, 0), Vector2(-to_target.x, 0)]
	else:
		order = [Vector2(-signf(to_target.y), 0), Vector2(signf(to_target.y), 0),
			Vector2(0, to_target.y), Vector2(0, -to_target.y)]
	for candidate: Vector2 in order:
		if candidate.length() < 0.5:
			continue
		var query := _shape_query(hero)
		query.transform = Transform2D(0.0, hero.global_position + (hero.get_node("BodyShape") as CollisionShape2D).position)
		query.motion = candidate * 6.0
		var fractions := hero.get_world_2d().direct_space_state.cast_motion(query)
		if fractions.size() >= 2 and fractions[0] > 0.5:
			return candidate
	return order[(attempt - 1) % order.size()] if not order.is_empty() else Vector2.ZERO

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
	print("HOME_BUILD_BEFORE active=%s selected=%s" % [str(build.active), build.selected_piece])
	if not build.active:
		await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_2")
	print("HOME_BUILD_MODE active=%s selected=%s modal=%s paused=%s wood=%d iron=%d" % [str(build.active), build.selected_piece, str(ow.call(&"_has_gameplay_modal")), str(paused), _count(WOOD), _count(IRON)])
	_expect(build.active and build.selected_piece == "wall_wood", "ordinary build inputs arm and select paid walls")
	if not build.active or build.selected_piece != "wall_wood":
		_body_complete = true
		return
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
	var door_cell := origin + Vector2i(2, 0)
	var door_placed := await _place_at(ow, build, door_cell)
	_expect(door_placed, "ordinary pointer paid usable door")
	if not door_placed:
		_body_complete = true
		return
	var door_id := build.entity_at_layer(door_cell, "object")
	var room: String = build.room_topology.room_at(center)
	_expect(not room.is_empty(), "actual authored enclosure has a derived room and roof")
	await _tap_action(&"build_slot_5")
	var bed_cell := origin + Vector2i(3, 3)
	var bed_placed := await _place_at(ow, build, bed_cell)
	_expect(bed_placed, "ordinary pointer paid bed inside room")
	if not bed_placed:
		_body_complete = true
		return
	var bed_id := build.entity_at_layer(bed_cell, "object")
	await _tap_action(&"build_toggle")
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	var bed_active := String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id
	_expect(bed_active, "ordinary world click activates the paid safe bed")
	if not bed_active:
		print("HOME_BED_FAIL interaction=%s hero=%s" % [str(build.structure_node(bed_id).last_interaction()), str(hero.global_position)])
		_body_complete = true
		return
	await _tap_action(&"build_toggle")
	await _tap_action(&"build_slot_4")
	var chest_cell := origin + Vector2i(1, 3)
	var chest_placed := await _place_at(ow, build, chest_cell)
	_expect(chest_placed, "ordinary pointer paid chest inside room")
	if not chest_placed:
		_body_complete = true
		return
	var chest_id := build.entity_at_layer(chest_cell, "object")
	await _tap_action(&"build_toggle")
	_expect(not build.active and _count(WOOD) == 0 and _count(IRON) == 0, "shelter charges exactly player-gathered material")
	var far_door := build.structure_node(door_id)
	var view := ow.get(&"camera") as Camera2D
	view.reset_smoothing()
	view.force_update_scroll()
	await process_frame
	var far_pointer := root.get_final_transform() * (view.get_canvas_transform() * (far_door.global_position + Vector2(8, 8)))
	_expect(hero.global_position.distance_to(far_door.global_position) > SurvivalStructure.REACH, "door begins beyond its normal interaction reach")
	await _click_window(far_pointer)
	_expect(not bool(((_survival().call(&"structures") as Dictionary).get(door_id, {}) as Dictionary).get("door_open", false)),
		"pointing at a far door does not bypass normal reach")
	var near_chest: Array[Vector2i] = [center + Vector2i.LEFT]
	var moved_chest := await _walk_path(hero, near_chest)
	_expect(moved_chest, "ordinary movement approaches the built chest")
	if not moved_chest:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	var chest := build.structure_node(chest_id)
	var stored := int(chest.chest_contents().get("binding_cloth", 0)) == 2 and _count("binding_cloth") == 0
	_expect(stored, "ordinary world click stashes the two manufactured cloth in the paid chest")
	if not stored:
		print("HOME_CHEST_FAIL interaction=%s hero=%s" % [str(chest.last_interaction()), str(hero.global_position)])
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(int(chest.chest_contents().get("binding_cloth", 0)) == 0 and _count("binding_cloth") == 2,
		"ordinary second click returns exactly two cloth to the bag")
	var saved := bool(_save().call(&"reload_save"))
	var records: Dictionary = _survival().call(&"structures")
	_expect(saved and String((records.get(door_id, {}) as Dictionary).get("piece", "")) == "door_wood" \
		and String((records.get(bed_id, {}) as Dictionary).get("piece", "")) == "bed_wood" \
		and String((records.get(chest_id, {}) as Dictionary).get("piece", "")) == "chest_wood" \
		and String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id \
		and _count("binding_cloth") == 2, "paid structures, active bed and cloth survive authoritative reload")
	var near_door: Array[Vector2i] = [center + Vector2i.UP]
	var moved_door := await _walk_path(hero, near_door)
	_expect(moved_door, "ordinary movement approaches the door from within the room")
	if not moved_door:
		_body_complete = true
		return
	# Interaction chooses the nearest object, not the clicked screen position.
	# From the cell centre the bed can be nearer than the door's top-left origin;
	# physically approach the door, without walking into its closed collider.
	var door := build.structure_node(door_id)
	for _frame in range(60):
		if hero.global_position.y <= door.global_position.y + 22.0:
			break
		_set_direction(Vector2.UP * 16.0)
		await physics_frame
	_set_direction(Vector2.ZERO)
	await physics_frame
	print("HOME_DOOR_APPROACH hero=%s door=%s bed=%s chest=%s" % [str(hero.global_position), str(door.global_position), str(build.structure_node(bed_id).global_position), str(chest.global_position)])
	var camera := ow.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var door_pointer := root.get_final_transform() * (camera.get_canvas_transform() * (door.global_position + Vector2(8, 8)))
	await _click_window(door_pointer)
	var opened := bool(((_survival().call(&"structures") as Dictionary).get(door_id, {}) as Dictionary).get("door_open", false))
	_expect(opened, "ordinary pointer on the paid door opens it despite nearer furniture")
	if not opened:
		print("HOME_DOOR_FAIL door=%s bed=%s chest=%s" % [str(door.last_interaction()), str(build.structure_node(bed_id).last_interaction()), str(chest.last_interaction())])
		_body_complete = true
		return
	await physics_frame
	await physics_frame
	var outside: Array[Vector2i] = [center + Vector2i(0, -4)]
	var exited := await _walk_path(hero, outside)
	print("HOME_EXIT hero=%s cell=%s door=%s walked=%s" % [str(hero.global_position), str(nav.cell_of(hero.global_position)), str(door_cell), str(exited)])
	_expect(exited and nav.cell_of(hero.global_position).y < door_cell.y, "ordinary movement exits the actual home")
	if not exited:
		_body_complete = true
		return
	var returned := await _walk_path(hero, near_door)
	_expect(returned and not (build.room_topology.room_at(nav.cell_of(hero.global_position))).is_empty(),
		"ordinary movement returns through the door into the same home")
	if not returned:
		_body_complete = true
		return
	# A resource expedition after the home exists: plan against the live Hero
	# shape (including new wall/door bodies), then use only ordinary movement.
	var exit_path := _route(nav.cell_of(hero.global_position), center + Vector2i(0, -4), nav, hero)
	var left_again := not exit_path.is_empty() and await _walk_path(hero, exit_path)
	_expect(left_again, "ordinary movement leaves home for a resource expedition")
	if not left_again:
		_body_complete = true
		return
	var from_cell := nav.cell_of(hero.global_position)
	var distances_after_build := nav.reachable_from(from_cell)
	var options: Array[Dictionary] = []
	var shape_cache: Dictionary = {}
	for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
		var oak := raw as SurvivalResourceNode
		if oak == null or oak.resource_kind != "oak_tree" or not bool(_survival().call(&"is_node_harvestable", oak.node_id, "oak_tree")):
			continue
		var goal := nav.cell_of(oak.global_position)
		if not nav.in_bounds(goal) or goal.distance_squared_to(center) < 36 or not _shape_clear(goal, nav, hero, shape_cache):
			continue
		var distance := distances_after_build[goal.y * nav.width + goal.x]
		if distance >= 0:
			options.append({"node": oak, "goal": goal, "distance": distance})
	options.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.distance) < int(b.distance))
	var source: SurvivalResourceNode = null
	var source_path: Array[Vector2i] = []
	for index in range(mini(options.size(), 8)):
		var option: Dictionary = options[index]
		var attempt_path := _route(from_cell, option.goal, nav, hero)
		if not attempt_path.is_empty():
			source = option.node as SurvivalResourceNode
			source_path = attempt_path
			break
	_expect(source != null, "bounded shape-aware planning finds a live oak source away from home")
	if source == null:
		_body_complete = true
		return
	var reached_source := await _walk_path(hero, source_path)
	_expect(reached_source and source.can_interact(hero), "ordinary movement reaches the live oak source")
	if not reached_source or not source.can_interact(hero):
		_body_complete = true
		return
	await create_timer(0.3).timeout
	var before_oak := _count(WOOD)
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(_count(WOOD) == before_oak + 2, "ordinary world click harvests two oak on the expedition")
	if _count(WOOD) != before_oak + 2:
		print("HOME_EXPEDITION_HARVEST_FAIL node=%s result=%s actor=%s" % [source.node_id, str(source.last_result()), str(hero.global_position)])
		_body_complete = true
		return
	var home_path := _route(nav.cell_of(hero.global_position), center + Vector2i.UP, nav, hero)
	_expect(not home_path.is_empty(), "live-shape route leads from source back through the open door")
	if home_path.is_empty():
		_body_complete = true
		return
	var home_again := await _walk_path(hero, home_path)
	_expect(home_again and not (build.room_topology.room_at(nav.cell_of(hero.global_position))).is_empty(),
		"ordinary movement brings gathered oak back into the same home")
	if not home_again:
		_body_complete = true
		return
	var back_to_chest := await _walk_path(hero, near_chest)
	_expect(back_to_chest, "ordinary movement reaches the home chest after the expedition")
	if not back_to_chest:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	var contents := chest.chest_contents()
	_expect(int(contents.get(WOOD, 0)) == 2 and int(contents.get("binding_cloth", 0)) == 2 \
		and _count(WOOD) == 0 and _count("binding_cloth") == 0,
		"ordinary chest click stores expedition oak and manufactured cloth together")
	var reloaded := bool(_save().call(&"reload_save"))
	var after_reload: Dictionary = _survival().call(&"container_contents", chest_id)
	_expect(reloaded and int(after_reload.get(WOOD, 0)) == 2 and int(after_reload.get("binding_cloth", 0)) == 2 \
		and _count(WOOD) == 0 and _count("binding_cloth") == 0,
		"expedition and crafted custody persist on exactly the chest side after reload")
	if not reloaded:
		_body_complete = true
		return
	# Recreate the actual overworld against the disk save, not just live nodes.
	ow.queue_free()
	await process_frame
	_host.queue_free()
	_host = null
	await process_frame
	var disk_loaded := bool(_save().call(&"reload_save"))
	var fresh := await _boot()
	_expect(disk_loaded and fresh != null, "saved journey boots a fresh production overworld")
	if fresh == null:
		_body_complete = true
		return
	var fresh_build := fresh.get(&"survival_build") as SurvivalBuildSystem
	var fresh_nav := fresh.get(&"traversability") as OverworldTraversability
	var fresh_hero := fresh.get(&"player") as CharacterBody2D
	var fresh_chest := fresh_build.structure_node(chest_id)
	var reconstructed := fresh_chest != null and fresh_build.structure_node(bed_id) != null \
		and fresh_build.structure_node(door_id) != null and not (fresh_build.room_topology.room_at(center)).is_empty() \
		and String((_survival().call(&"document") as Dictionary).get("spawn_anchor", "")) == bed_id
	_expect(reconstructed, "fresh world reconstructs the same roofed room, door, chest and active bed")
	if not reconstructed:
		_body_complete = true
		return
	var fresh_contents := fresh_chest.chest_contents()
	_expect(int(fresh_contents.get(WOOD, 0)) == 2 and int(fresh_contents.get("binding_cloth", 0)) == 2 \
		and _count(WOOD) == 0 and _count("binding_cloth") == 0,
		"fresh world preserves exact chest-side expedition and crafted custody")
	var fresh_start := fresh_nav.cell_of(fresh_hero.global_position)
	var fresh_path := _route(fresh_start, near_chest[0], fresh_nav, fresh_hero)
	var fresh_approach := (fresh_start == near_chest[0]) or (not fresh_path.is_empty() and await _walk_path(fresh_hero, fresh_path))
	_expect(fresh_approach, "ordinary movement in the reconstructed world reaches the same chest")
	if not fresh_approach:
		_body_complete = true
		return
	await _click_window(root.get_final_transform() * (root.get_visible_rect().size * 0.5))
	_expect(_count(WOOD) == 2 and _count("binding_cloth") == 2 and fresh_chest.chest_contents().is_empty(),
		"ordinary click recovers both exact stacks from the reconstructed chest")
	_expect(bool(_save().call(&"reload_save")) and _count(WOOD) == 2 and _count("binding_cloth") == 2 \
		and (_survival().call(&"container_contents", chest_id) as Dictionary).is_empty(),
		"recovered stacks survive disk reload without duplicate chest custody")
	# Physical keyboard and GUI input, against the same home/chest and save.
	var key_down := InputEventKey.new()
	key_down.keycode = KEY_V
	key_down.physical_keycode = KEY_V
	key_down.pressed = true
	Input.parse_input_event(key_down)
	await physics_frame
	await process_frame
	var key_up := InputEventKey.new()
	key_up.keycode = KEY_V
	key_up.physical_keycode = KEY_V
	key_up.pressed = false
	Input.parse_input_event(key_up)
	await physics_frame
	await process_frame
	var panel := fresh.get(&"chest_panel") as CanvasLayer
	var storage_opened := panel != null and bool(panel.call(&"is_open"))
	_expect(storage_opened, "V opens the nearby chest selective modal through keyboard input")
	if not storage_opened:
		_body_complete = true
		return
	var deposit_wood := panel.find_child("Deposit_oak_wood", true, false) as Button
	_expect(deposit_wood != null, "ordinary bag item has a selective deposit button")
	if deposit_wood == null:
		_body_complete = true
		return
	var storage_scroll := _owning_scroll(deposit_wood)
	var wood_visible := storage_scroll != null and await _scroll_to(storage_scroll, deposit_wood)
	_expect(wood_visible, "ordinary wheel input reveals the oak deposit button")
	if wood_visible:
		await _click_window(root.get_final_transform() * deposit_wood.get_global_rect().get_center())
	_expect(_count(WOOD) == 1 and _count("binding_cloth") == 2 and int(fresh_chest.chest_contents().get(WOOD, 0)) == 1, "pointer deposits one oak without sweeping cloth")
	var quantity := panel.find_child("Quantity", true, false) as SpinBox
	if quantity != null:
		await _click_window(root.get_final_transform() * (quantity.get_global_rect().position + Vector2(quantity.size.x - 8.0, quantity.size.y * 0.25)))
	_expect(quantity != null and int(quantity.value) == 2, "pointer increases selective transfer quantity to two")
	var deposit_cloth := panel.find_child("Deposit_binding_cloth", true, false) as Button
	var cloth_visible := deposit_cloth != null and storage_scroll != null and await _scroll_to(storage_scroll, deposit_cloth)
	_expect(cloth_visible, "ordinary wheel input reveals the cloth deposit button")
	if cloth_visible:
		await _click_window(root.get_final_transform() * deposit_cloth.get_global_rect().get_center())
	print("HOME_STORAGE_TRACE after_cloth qty=%s bag=%s chest=%s" % [str(quantity.value if quantity != null else -1), str(_save().call(&"inventory_totals")), str(fresh_chest.chest_contents())])
	# Successful transfers rebuild the rows, freeing the old Button. Use the
	# pre-click visibility result, not a stale post-refresh object reference.
	_expect(cloth_visible and _count("binding_cloth") == 0 and int(fresh_chest.chest_contents().get("binding_cloth", 0)) == 2, "pointer deposits exactly two cloth")
	# Reset to one with the corresponding lower SpinBox arrow.
	if quantity != null:
		await _click_window(root.get_final_transform() * (quantity.get_global_rect().position + Vector2(quantity.size.x - 8.0, quantity.size.y * 0.75)))
	var take_wood := panel.find_child("Take_oak_wood", true, false) as Button
	var take_visible := take_wood != null and storage_scroll != null and await _scroll_to(storage_scroll, take_wood)
	_expect(take_visible, "ordinary wheel input reveals the stored oak take button")
	if take_visible:
		await _click_window(root.get_final_transform() * take_wood.get_global_rect().get_center())
	print("HOME_STORAGE_TRACE after_take qty=%s bag=%s chest=%s" % [str(quantity.value if quantity != null else -1), str(_save().call(&"inventory_totals")), str(fresh_chest.chest_contents())])
	_expect(take_visible and _count(WOOD) == 2 and not fresh_chest.chest_contents().has(WOOD) and int(fresh_chest.chest_contents().get("binding_cloth", 0)) == 2, "pointer takes only the selected oak while cloth remains stored")
	var close := panel.find_child("CloseChest", true, false) as Button
	if close != null:
		await _click_window(root.get_final_transform() * close.get_global_rect().get_center())
	_expect(close != null and not bool(panel.call(&"is_open")), "pointer closes selective storage modal")
	_expect(bool(_save().call(&"reload_save")) and _count(WOOD) == 2 and _count("binding_cloth") == 0 and int((_survival().call(&"container_contents", chest_id) as Dictionary).get("binding_cloth", 0)) == 2, "selective custody survives reload without duplication")
	_body_complete = true
