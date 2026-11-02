extends "res://tests/survival_normal_input_gather_test.gd"
## Negative prerequisite probe for the CT's proposed canonical y=200 crossing.
## Fresh production overworld and real Knight, no teleport and no map modifications.
## PASS means the current blocker was observed, NOT that a seam or B0 works.

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("CANONICAL SEAM PREREQUISITE BLOCKER CONFIRMED - %d checks" % checks)
		quit(0)
	else:
		print("CANONICAL SEAM PROBE INCONCLUSIVE - %d/%d" % [failures.size(), checks])
		quit(1)

# Plan against the actual live Hero shape and physics bodies, not merely the
# one-cell terrain/prop grid. A tile centre is not a Hero foot position: its
# 12x16 body is offset 8 px north. Cache each spatial query for bounded BFS.
func _physical_cell_clear(cell: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	if not nav.in_bounds(cell) or not nav.is_free(cell):
		cache[cell] = false
		return false
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, Vector2(cell.x * 16 + 8, cell.y * 16 + 15) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	cache[cell] = clear
	return clear

func _physical_route(start: Vector2i, nav: OverworldTraversability, hero: CharacterBody2D) -> Array[Vector2i]:
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {start: start}
	var cache: Dictionary = {}
	var cursor := 0
	var goal := Vector2i(-1, -1)
	while cursor < queue.size():
		var current := queue[cursor]
		cursor += 1
		if current == Vector2i(368, 200):
			goal = current
			break
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT]:
			var next := current + step
			if previous.has(next) or not _physical_cell_clear(next, nav, hero, cache):
				continue
			previous[next] = current
			queue.append(next)
	print("SEAM_SHAPE_NAV visited=%d tested=%d goal=%s" % [cursor, cache.size(), str(goal)])
	var path: Array[Vector2i] = []
	if goal == Vector2i(-1, -1):
		return path
	while goal != start:
		path.push_front(goal)
		goal = previous[goal]
	return path

func _body() -> void:
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var world := ow.get(&"world") as OverworldWorld
	var nav := ow.get(&"traversability") as OverworldTraversability
	var start := nav.cell_of(hero.global_position)
	var border := Vector2i(383, 200)
	var proposed := Vector2i(384, 200)
	var distances := nav.reachable_from(start)
	print("SEAM_START actual=%s authored=%s offset=%d width=%d height=%d" % [str(start), str(nav.spawn_cell()), nav.spawn_offset(), world.width, world.height])
	_expect(nav.spawn_cell() == Vector2i(56, 218) and nav.in_bounds(start) and nav.is_free(start), "actual fresh Hero starts at resolved Refuge ground")
	_expect(world.width == 384 and world.height == 256, "production legacy world bounds unchanged")
	_expect(world.is_solid_cell(border.x, border.y) and nav.blocked_kind(border) == 1, "legacy x383,y200 is solid terrain in mounted world")
	_expect(not nav.in_bounds(proposed) and world.is_solid_cell(proposed.x, proposed.y), "A1 x384,y200 is outside legacy navigation and queries fail closed")
	_expect(distances[border.y * nav.width + border.x] == -1, "no production navigation path reaches proposed legacy crossing cell")
	var boundary_query := PhysicsShapeQueryParameters2D.new()
	boundary_query.shape = (hero.get_node("BodyShape") as CollisionShape2D).shape
	boundary_query.transform = Transform2D(0.0, Vector2(383 * 16 + 8, 200 * 16 + 7))
	boundary_query.collision_mask = hero.collision_mask
	boundary_query.exclude = [hero.get_rid()]
	boundary_query.collide_with_bodies = true
	boundary_query.collide_with_areas = false
	var hits := hero.get_world_2d().direct_space_state.intersect_shape(boundary_query, 8)
	print("SEAM_BOUNDARY_PHYSICS hit_count=%d" % hits.size())
	_expect(not hits.is_empty(), "live physics has a solid collision body at legacy x383,y200")
	var path := _physical_route(start, nav, hero)
	var goal := Vector2i(368, 200)
	_expect(not path.is_empty(), "live Hero-shape navigation finds an approach toward y200")
	if path.is_empty():
		_body_complete = true
		return
	print("SEAM_ROUTE goal=%s length=%d start=%s" % [str(goal), path.size(), str(hero.global_position)])
	var failed_at := Vector2i(-1, -1)
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 4.5:
			failed_at = cell
			break
	_set_direction(Vector2.ZERO)
	print("SEAM_ROUTE_END hero=%s failed_at=%s goal=%s" % [str(hero.global_position), str(failed_at), str(goal)])
	_expect(failed_at == Vector2i(-1, -1), "actual Hero follows ordinary held movement from Refuge to approach, without teleport")
	if failed_at == Vector2i(-1, -1) and goal.y == 200:
		var before := hero.global_position
		_set_direction(Vector2(1000, 0))
		for i in range(120):
			await physics_frame
		_set_direction(Vector2.ZERO)
		await physics_frame
		print("SEAM_PHYSICS before=%s after=%s velocity=%s" % [str(before), str(hero.global_position), str(hero.velocity)])
		_expect(hero.global_position.x < 370 * 16 and hero.global_position.x < 383 * 16, "real Hero cannot walk through legacy solid boundary toward x383,y200")
	else:
		print("SEAM_PHYSICS not tested: approach absent, failed or off y200")
		_expect(false, "actual physics attempt at y200 was performed")
	_body_complete = true
