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
	var goal := Vector2i(-1, -1)
	var score := 2147483647
	for y in range(195, 206):
		for x in range(350, 370):
			var cell := Vector2i(x, y)
			if distances[y * nav.width + x] < 0:
				continue
			var s := (absi(368 - x) + absi(200 - y)) * 10000 + distances[y * nav.width + x]
			if s < score:
				score = s
				goal = cell
	_expect(goal != Vector2i(-1, -1), "runtime navigation finds a reachable approach toward y200")
	if goal == Vector2i(-1, -1):
		_body_complete = true
		return
	var path: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		var here := distances[cursor.y * nav.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var neighbour := cursor + step
			if nav.in_bounds(neighbour) and distances[neighbour.y * nav.width + neighbour.x] == here - 1:
				previous = neighbour
				break
		if previous == cursor:
			_expect(false, "navigation route reconstructs")
			_body_complete = true
			return
		cursor = previous
	print("SEAM_ROUTE goal=%s length=%d start=%s" % [str(goal), path.size(), str(hero.global_position)])
	var failed_at := Vector2i(-1, -1)
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 6.0 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 6.0:
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
