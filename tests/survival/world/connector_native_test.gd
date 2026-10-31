extends SceneTree
## A1 isolated native geometry fixture for the canonical two-POI connector.
##
## This is NOT the production chapter1_overworld controller and does not claim
## production native playability. It composes the pinned legacy bake + exact A1
## delta + unchanged chunk6:3, mounts the two slice contracts' static obstacles,
## instantiates the real Knight scene, and drives ordinary held movement along a
## live-shape-verified route Refuge -> Waystation -> Relay -> Refuge.
##
## Run from the ROOT project (not the isolated reader project):
##   xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 godot --path . --rendering-method gl_compatibility --rendering-driver opengl3 --audio-driver Dummy --resolution 960x540 --windowed --script res://tests/survival/world/connector_native_test.gd -- --connector-root=artifacts/a1-connector

const WAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_waystation.slice.json"
const RELAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_relay_shed.slice.json"
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]

var failures: Array[String] = []
var checks := 0
var trace: Array[Dictionary] = []
var connector_root := "artifacts/a1-connector"
var report_path := "artifacts/a1-connector/connector_native_report.json"
var host: Node2D
var hero: CharacterBody2D
var nav: OverworldTraversability
var world: OverworldWorld


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--connector-root="):
			connector_root = arg.trim_prefix("--connector-root=")
		elif arg.begins_with("--report="):
			report_path = arg.trim_prefix("--report=")
	call_deferred("_run")


func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("CONNECTOR PASS: " + label)
	else:
		failures.append(label)
		print("CONNECTOR FAIL: " + label)


func _read_json(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		return parsed as Dictionary
	failures.append("json read failed: " + path)
	return {}


func _abs(name: String) -> String:
	return ProjectSettings.globalize_path(connector_root.path_join(name))


func _foot(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * 16 + 8, cell.y * 16 + 15)


func _set_direction(delta: Vector2) -> void:
	for action: String in MOVE_ACTIONS:
		Input.action_release(action)
	if delta.x < -0.5:
		Input.action_press("move_left")
	elif delta.x > 0.5:
		Input.action_press("move_right")
	if delta.y < -0.5:
		Input.action_press("move_up")
	elif delta.y > 0.5:
		Input.action_press("move_down")


func _shape_clear(cell: Vector2i, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	if not nav.in_bounds(cell) or not nav.is_free(cell):
		cache[cell] = false
		return false
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, _foot(cell) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	cache[cell] = clear
	return clear


func _intersect_at(cell: Vector2i) -> Array[Dictionary]:
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, _foot(cell) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 8)


func _grid_route(start: Vector2i, goal: Vector2i) -> Array[Vector2i]:
	var distances := nav.reachable_from(start)
	if distances[goal.y * nav.width + goal.x] < 0:
		return []
	var path: Array[Vector2i] = []
	var cursor := goal
	while cursor != start:
		path.push_front(cursor)
		var here := distances[cursor.y * nav.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]:
			var neighbour := cursor + step
			if nav.in_bounds(neighbour) and distances[neighbour.y * nav.width + neighbour.x] == here - 1:
				previous = neighbour
				break
		if previous == cursor:
			return []
		cursor = previous
	return path


func _shape_bfs(start: Vector2i, goal: Vector2i, cache: Dictionary) -> Array[Vector2i]:
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {start: start}
	var cursor := 0
	var found := false
	while cursor < queue.size():
		var current := queue[cursor]
		cursor += 1
		if current == goal:
			found = true
			break
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.DOWN, Vector2i.UP, Vector2i.LEFT]:
			var next := current + step
			if previous.has(next) or not _shape_clear(next, cache):
				continue
			previous[next] = current
			queue.append(next)
	var path: Array[Vector2i] = []
	if not found:
		return path
	var c := goal
	while c != start:
		path.push_front(c)
		c = previous[c]
	return path


func _route(start: Vector2i, goal: Vector2i) -> Array[Vector2i]:
	var cache: Dictionary = {}
	if not _shape_clear(start, cache) or not _shape_clear(goal, cache):
		return []
	var path := _grid_route(start, goal)
	var clear := not path.is_empty()
	for cell: Vector2i in path:
		if not _shape_clear(cell, cache):
			clear = false
			break
	if clear:
		return path
	return _shape_bfs(start, goal, cache)


func _drive(label: String, goal: Vector2i) -> bool:
	var start := nav.cell_of(hero.global_position)
	var path := _route(start, goal)
	if path.is_empty():
		_expect(false, label + " live-shape route exists")
		return false
	_expect(true, label + " live-shape route exists (%d cells)" % path.size())
	var crossed_border := false
	for cell: Vector2i in path:
		if cell.x >= 384:
			crossed_border = true
		var target := _foot(cell)
		var deadline := Time.get_ticks_msec() + 4000
		while hero.global_position.distance_to(target) > 1.5 and Time.get_ticks_msec() < deadline:
			_set_direction(target - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		if hero.global_position.distance_to(target) > 5.0:
			_expect(false, label + " ordinary movement reached %s (at %s)" % [str(cell), str(hero.global_position)])
			return false
		await physics_frame
	_set_direction(Vector2.ZERO)
	await physics_frame
	var end := nav.cell_of(hero.global_position)
	_expect(end.distance_to(Vector2(goal)) <= 1.0, label + " arrived near canonical stand cell")
	trace.append({"leg": label, "start": [start.x, start.y], "goal": [goal.x, goal.y], "end": [end.x, end.y], "cells": path.size(), "crossed_x384": crossed_border, "final_px": [hero.global_position.x, hero.global_position.y]})
	return true


func _mount_slice_obstacles(slice_path: String) -> int:
	var slice := _read_json(slice_path)
	var count := 0
	for raw: Variant in slice.get("immutable_geography", {}).get("static_obstacles", []):
		var obstacle: Dictionary = raw
		if not bool(obstacle.get("blocks_nav", false)):
			continue
		var size_arr: Array = obstacle.get("collision_size_px", [16, 16])
		var off_arr: Array = obstacle.get("collision_offset_px", [0, 0])
		for raw_cell: Variant in obstacle.get("cells", []):
			var c: Array = raw_cell
			var body := StaticBody2D.new()
			body.name = String(obstacle.get("obstacle_id", "slice_obstacle")) + "_%d_%d" % [int(c[0]), int(c[1])]
			body.collision_layer = 1
			body.collision_mask = 0
			body.position = Vector2(int(c[0]) * 16 + 8 + float(off_arr[0]), int(c[1]) * 16 + 8 + float(off_arr[1]))
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2(float(size_arr[0]), float(size_arr[1]))
			shape.shape = rect
			body.add_child(shape)
			world.blocker_root.add_child(body)
			count += 1
	return count


func _run() -> void:
	print("CONNECTOR TRACE boot root=" + connector_root)
	var save := root.get_node_or_null("SaveService")
	if save != null and save.has_method("configure_storage"):
		save.call("configure_storage", "user://tests/a1_connector_native.json", true)
	host = Node2D.new()
	root.add_child(host)
	var entities := Node2D.new()
	entities.y_sort_enabled = true
	host.add_child(entities)
	world = OverworldWorld.new()
	host.add_child(world)
	var data := _read_json(_abs("annex_world.v1.json"))
	var ok := world.build(data, _abs("annex_layers.v1.json"), _abs("annex_props.v1.json"), entities)
	print("CONNECTOR TRACE world_build=%s bounds=%dx%d" % [str(ok), world.width, world.height])
	_expect(ok and world.width == 448 and world.height == 256, "composed 448x256 world built from pinned legacy + one canonical chunk")
	nav = OverworldTraversability.new()
	nav.build(world)
	await physics_frame
	await physics_frame

	var knight_scene := load("res://game/characters/knight/knight.tscn") as PackedScene
	_expect(knight_scene != null, "Knight scene loads after autoload boot")
	if knight_scene == null:
		quit(1)
		return
	hero = knight_scene.instantiate() as CharacterBody2D
	entities.add_child(hero)
	print("CONNECTOR TRACE knight_added")
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rect := body_shape.shape as RectangleShape2D
	_expect(rect.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8) and hero.collision_layer == 2 and hero.collision_mask == 5, "real pinned Knight 12x16 body, offset, layer and mask")
	var start := nav.origin_cell()
	hero.global_position = _foot(start)
	print("CONNECTOR TRACE start=%s foot=%s" % [str(start), str(hero.global_position)])
	await physics_frame
	await physics_frame
	_expect(start == Vector2i(56, 218), "fixture initializes at resolved authored Refuge ground, not at the seam")
	var camera := hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = world.width * 16
	camera.limit_bottom = world.height * 16
	camera.make_current()
	camera.force_update_scroll()
	_expect(camera.limit_right == 7168 and camera.limit_bottom == 4096, "camera limits derive from composed canonical bounds")

	_expect(not world.is_solid_cell(383, 200) and not world.is_solid_cell(384, 200), "legacy/canonical border cells are physically clear after exact carve")
	_expect(world.is_solid_cell(384, 191) and world.is_solid_cell(447, 191), "unsupported annex padding fails closed")
	var blocked := nav.unreachable_endpoints(data)
	_expect(blocked.is_empty(), "all ten dungeon thresholds, camps and discoveries remain reachable (%d blocked)" % blocked.size())

	# Owner-specific locker-stand correction: first prove the ORIGINAL full-tile
	# blocker really intersects the exact stand, then mount the repaired A1 slice
	# collision footprint and prove the same stand is nav-free, live-shape clear,
	# and inside the authored interaction radius. No anchor substitution.
	var stand_cell := Vector2i(408, 199)
	var adverse := StaticBody2D.new()
	adverse.name = "obs_waystation_locker_bank_408_198_original_full_tile"
	adverse.collision_layer = 1
	adverse.collision_mask = 0
	adverse.position = Vector2(408 * 16 + 8, 198 * 16 + 8)
	var adverse_shape := CollisionShape2D.new()
	var adverse_rect := RectangleShape2D.new()
	adverse_rect.size = Vector2(16, 16)
	adverse_shape.shape = adverse_rect
	adverse.add_child(adverse_shape)
	world.blocker_root.add_child(adverse)
	await physics_frame
	await physics_frame
	var adverse_hits := _intersect_at(stand_cell)
	var adverse_names: Array[String] = []
	for hit: Dictionary in adverse_hits:
		var collider := hit.get("collider") as Node
		if collider != null:
			adverse_names.append(String(collider.name))
	var locker_adverse := false
	for adverse_name: String in adverse_names:
		if adverse_name.contains("original_full_tile"):
			locker_adverse = true
	_expect(locker_adverse, "adverse proof: original full-tile locker blocker intersects exact stand (408,199)")
	adverse.queue_free()
	await physics_frame
	await physics_frame

	var obstacles := _mount_slice_obstacles(WAY_SLICE) + _mount_slice_obstacles(RELAY_SLICE)
	print("CONNECTOR TRACE obstacles=%d" % obstacles)
	_expect(obstacles == 12, "two canonical slice static obstacle sets mounted with authored collision footprints (%d cells)" % obstacles)
	await physics_frame
	await physics_frame
	var locker_clear := nav.is_free(stand_cell) and _shape_clear(stand_cell, {}) and _intersect_at(stand_cell).is_empty()
	_expect(locker_clear, "exact Waystation locker stand (408,199) is nav-free and live-shape clear after repaired 16x14 locker collision")
	var way_slice := _read_json(WAY_SLICE)
	var locker_action: Dictionary = {}
	for a: Variant in way_slice.get("actions", []):
		var ad: Dictionary = a
		if String(ad.get("action_id", "")) == "pry_locker":
			locker_action = ad
	var locker_node: Dictionary = {}
	for n: Variant in way_slice.get("interaction_nodes", []):
		var nd: Dictionary = n
		if String(nd.get("node_id", "")) == "node_waystation_locker":
			locker_node = nd
	var locker_radius := float(locker_action.get("interaction_radius_px", 0))
	var node_cell: Array = locker_node.get("cell", [408, 198])
	var node_center := Vector2(int(node_cell[0]) * 16 + 8, int(node_cell[1]) * 16 + 8)
	var locker_range := _foot(stand_cell).distance_to(node_center)
	_expect(locker_radius == 24.0 and locker_range <= locker_radius, "exact locker stand is inside authored 24px interaction range (%.2fpx)" % locker_range)
	print("CONNECTOR TRACE pre_drive locker_stand_clear=%s relay_stand_clear=%s range=%.2f" % [str(locker_clear), str(_shape_clear(Vector2i(442, 234), {})), locker_range])
	var way_ok := await _drive("Refuge->WaystationLockerStand", stand_cell)
	if way_ok:
		camera.force_update_scroll()
		_expect(hero.global_position.x > 6144.0, "Hero physically crossed canonical x384 boundary on foot")
		_expect(hero.global_position.distance_to(_foot(stand_cell)) <= 5.0 and _intersect_at(stand_cell).is_empty(), "Hero physically stands at exact repaired locker stand (408,199), not the anchor")
	var relay_ok := false
	if way_ok:
		relay_ok = await _drive("Waystation->Relay", Vector2i(442, 234))
	if relay_ok:
		camera.force_update_scroll()
		var viewport_size := root.get_visible_rect().size
		var screen := hero.global_position - camera.get_screen_center_position() + viewport_size * 0.5
		_expect(screen.x >= 0.0 and screen.x <= viewport_size.x and screen.y >= 0.0 and screen.y <= viewport_size.y, "Hero remains inside camera viewport at Relay without camera teleport")
		await _drive("Relay->Refuge", start)

	_set_direction(Vector2.ZERO)
	var report := {
		"schema": "soh.world.connector_native_fixture.v1",
		"native_fixture_verified": failures.is_empty(),
		"production_native_playable": false,
		"checks": checks,
		"failures": failures,
		"trace": trace,
		"composed_bounds": [world.width, world.height],
		"slice_obstacle_cells": obstacles,
		"locker_stand_correction": {
			"stand_cell": [stand_cell.x, stand_cell.y],
			"anchor_cell": [408, 200],
			"original_full_tile_adverse_intersect": locker_adverse,
			"repaired_live_shape_clear": locker_clear,
			"interaction_radius_px": locker_radius,
			"stand_to_node_px": locker_range,
			"collision_size_px": [16, 14],
			"collision_offset_px": [0, -1]
		},
		"hero_body_px": [rect.size.x, rect.size.y],
		"camera_limit_right": camera.limit_right,
		"method": "real Knight scene + live PhysicsShapeQueryParameters2D route verification + ordinary Input.action_press movement; isolated composed-world fixture, not production controller",
	}
	var file := FileAccess.open(ProjectSettings.globalize_path(report_path), FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
		file.close()
	if host != null:
		host.queue_free()
	await process_frame
	await process_frame
	if failures.is_empty():
		print("A1 CONNECTOR NATIVE FIXTURE PASSED - %d checks (production integration still A0-owned)" % checks)
		quit(0)
	else:
		print("A1 CONNECTOR NATIVE FIXTURE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)
