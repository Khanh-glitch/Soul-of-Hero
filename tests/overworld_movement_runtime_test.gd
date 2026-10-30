extends "res://tests/overworld_runtime_case.gd"
## Movement is real physics on real collision: the knight answers input, terrain
## stops it, and the camera follows.

const WALK_FRAMES := 30


func _body() -> void:
	var world: Node = ow.get("world")
	var player: CharacterBody2D = ow.get("player")
	if world == null or player == null:
		_expect(false, "world/player available for movement test")
		return

	# 1. A clear stretch: the knight actually moves under a real input action.
	var open_cell := _find_open_run(world, Vector2i(1, 0), 6)
	_expect(open_cell != Vector2i(-1, -1), "found a six-tile clear run to walk along")
	if open_cell == Vector2i(-1, -1):
		return
	ow.call("teleport_to", _centre(open_cell))
	await _physics_frames(3)
	var origin := player.global_position
	Input.action_press(&"move_right")
	await _physics_frames(WALK_FRAMES)
	Input.action_release(&"move_right")
	await _physics_frames(2)
	var dx := player.global_position.x - origin.x
	_expect(dx > 24.0, "knight translated %.1f px under real input" % dx)
	_expect(absf(player.global_position.y - origin.y) < 4.0, "straight walk holds its lane")

	# 2. A wall: the same input produces no forward progress.
	var wall := _find_wall(world, Vector2i(0, -1))
	_expect(wall != Vector2i(-1, -1), "found a cliff face with walkable ground beneath it")
	if wall == Vector2i(-1, -1):
		return
	ow.call("teleport_to", _centre(wall) + Vector2(0, 10))
	await _physics_frames(3)
	var wall_start := player.global_position
	Input.action_press(&"move_up")
	await _physics_frames(40)
	Input.action_release(&"move_up")
	await _physics_frames(2)
	var travelled_up := wall_start.y - player.global_position.y
	_expect(travelled_up < 20.0, "cliff stops the knight after %.1f px" % travelled_up)

	# 3. The camera tracks the body it belongs to.
	var camera := player.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.reset_smoothing()
		await _physics_frames(2)
		_expect(camera.get_screen_center_position().distance_to(player.global_position) < 48.0,
			"camera follows the knight")
	_done()


func _centre(cell: Vector2i) -> Vector2:
	return Vector2(cell * 16) + Vector2(8, 8)


func _find_open_run(world: Node, direction: Vector2i, length: int) -> Vector2i:
	for y in range(24, 232, 3):
		for x in range(24, 360, 3):
			var ok := true
			for step in range(length + 3):
				var cell := Vector2i(x, y) + direction * step
				if bool(world.call("is_solid_cell", cell.x, cell.y)):
					ok = false
					break
			if ok:
				return Vector2i(x, y)
	return Vector2i(-1, -1)


func _find_wall(world: Node, _direction: Vector2i) -> Vector2i:
	# A solid cell with two open cells underneath it: stand in the first one and
	# walk north into the face. Both cells must be open or the knight would start
	# inside terrain and the test would prove nothing.
	for y in range(24, 231):
		for x in range(24, 360):
			if not bool(world.call("is_solid_cell", x, y)):
				continue
			if bool(world.call("is_solid_cell", x, y + 1)):
				continue
			if bool(world.call("is_solid_cell", x, y + 2)):
				continue
			return Vector2i(x, y + 1)
	return Vector2i(-1, -1)
