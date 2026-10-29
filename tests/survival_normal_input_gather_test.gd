extends "res://tests/survival_foundation_test.gd"
## Partial fresh-save journey: real physics and injected ordinary input only.
## No fixture grants, actor teleports, direct harvest calls or mocked time. This
## does not yet establish the larger shelter/production/death journey.

func _finish() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("SURVIVAL NORMAL INPUT GATHER PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL NORMAL INPUT GATHER FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _set_direction(delta: Vector2) -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	if delta.x < -3.0:
		Input.action_press("move_left")
	elif delta.x > 3.0:
		Input.action_press("move_right")
	if delta.y < -3.0:
		Input.action_press("move_up")
	elif delta.y > 3.0:
		Input.action_press("move_down")

func _body() -> void:
	var ow := _host.get_child(0)
	var hero: CharacterBody2D = ow.get(&"player")
	var navigation: OverworldTraversability = ow.get(&"traversability")
	var start := navigation.cell_of(hero.global_position)
	var distances := navigation.reachable_from(start)
	var goal := Vector2i(-1, -1)
	var target: SurvivalResourceNode = null
	var best := 2147483647
	for raw: Variant in (ow.get(&"survival_nodes") as Dictionary).values():
		var node := raw as SurvivalResourceNode
		if node == null or node.resource_kind != "scrap_pile":
			continue
		var node_cell := navigation.cell_of(node.global_position)
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var cell := node_cell + Vector2i(dx, dy)
				if not navigation.in_bounds(cell):
					continue
				var distance := distances[cell.y * navigation.width + cell.x]
				if distance < 0 or distance >= best:
					continue
				best = distance
				goal = cell
				target = node
	_expect(target != null, "fresh spawn has a reachable planned scrap node")
	if target == null:
		_body_complete = true
		return
	var path: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		var here := distances[cursor.y * navigation.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var neighbour := cursor + step
			if navigation.in_bounds(neighbour) and distances[neighbour.y * navigation.width + neighbour.x] == here - 1:
				previous = neighbour
				break
		if previous == cursor:
			_expect(false, "reachable path can be reconstructed")
			_body_complete = true
			return
		cursor = previous
	var travelled := true
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 6.0 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			_set_direction(point - hero.global_position)
			await physics_frame
		if hero.global_position.distance_to(point) > 6.0:
			travelled = false
			print("NORMAL_GATHER_TRACE stuck at %s target %s" % [str(hero.global_position), str(point)])
			break
	_set_direction(Vector2.ZERO)
	_expect(travelled and not bool(hero.get(&"dead")) and target.can_interact(hero), "ordinary movement reaches a scrap node from fresh spawn")
	if not travelled or not target.can_interact(hero):
		_body_complete = true
		return
	var before := _count(IRON)
	var camera: Camera2D = ow.get(&"camera")
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var click := InputEventMouseButton.new()
	click.position = root.get_final_transform() * (root.get_visible_rect().size * 0.5)
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	Input.parse_input_event(click)
	await physics_frame
	await process_frame
	click.pressed = false
	Input.parse_input_event(click)
	await process_frame
	_expect(_count(IRON) == before + 1, "ordinary world pointer gathers actual nearby scrap")
	_expect(bool(_save().call(&"reload_save")) and _count(IRON) == before + 1, "player-gathered scrap survives reload")
	_body_complete = true
