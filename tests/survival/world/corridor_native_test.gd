extends SceneTree
## A1 isolated native fixture for the first-hour roadside supply corridor.
## NOT production: no A3 economy, no SaveService mutation, no production controller.
## Composes the existing connector annex, paints the authored corridor overlay,
## mounts real container collision, and drives the real Knight on ordinary input.

const CORRIDOR := "res://data/survival/world/corridor/crown_roadside.corridor.v1.json"
const WAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_waystation.slice.json"
const RELAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_relay_shed.slice.json"
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]

var failures: Array[String] = []
var checks := 0
var trace: Array[Dictionary] = []
var connector_root := "artifacts/a1-connector"
var out_root := "artifacts/a1-corridor"
var host: Node2D
var hero: CharacterBody2D
var world: OverworldWorld
var nav: OverworldTraversability
var corridor: Dictionary
var screenshots: Array[String] = []

func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--connector-root="):
			connector_root = arg.trim_prefix("--connector-root=")
		elif arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
	call_deferred("_run")

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("CORRIDOR PASS: " + label)
	else:
		failures.append(label)
		print("CORRIDOR FAIL: " + label)

func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}

func _abs(name: String) -> String:
	return ProjectSettings.globalize_path(connector_root.path_join(name))

func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))

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

func _hits_at(cell: Vector2i) -> Array[Dictionary]:
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, _foot(cell) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 8)

func _mount_body(id: String, cell: Vector2i, size: Vector2, offset: Vector2) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = id.replace(":", "_").replace("/", "_")
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = Vector2(cell.x * 16 + 8 + offset.x, cell.y * 16 + 8 + offset.y)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	body.add_child(shape)
	world.blocker_root.add_child(body)
	return body

func _mount_slice_obstacles(path: String) -> int:
	var slice := _read_json(path)
	var count := 0
	for raw: Variant in slice.get("immutable_geography", {}).get("static_obstacles", []):
		var obs: Dictionary = raw
		if not bool(obs.get("blocks_nav", false)):
			continue
		var size_arr: Array = obs.get("collision_size_px", [16, 16])
		var off_arr: Array = obs.get("collision_offset_px", [0, 0])
		for raw_cell: Variant in obs.get("cells", []):
			var c: Array = raw_cell
			_mount_body(String(obs.get("obstacle_id", "slice")), Vector2i(int(c[0]), int(c[1])), Vector2(float(size_arr[0]), float(size_arr[1])), Vector2(float(off_arr[0]), float(off_arr[1])))
			count += 1
	return count

func _drive_cells(label: String, cells: Array) -> bool:
	var start := nav.cell_of(hero.global_position)
	for raw: Variant in cells:
		var c: Array = raw
		var target := _foot(Vector2i(int(c[0]), int(c[1])))
		var deadline := Time.get_ticks_msec() + 4000
		while hero.global_position.distance_to(target) > 1.5 and Time.get_ticks_msec() < deadline:
			_set_direction(target - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		if hero.global_position.distance_to(target) > 5.0:
			_expect(false, label + " ordinary movement reached " + str(c))
			return false
		await physics_frame
	_set_direction(Vector2.ZERO)
	await physics_frame
	var end := nav.cell_of(hero.global_position)
	trace.append({"leg": label, "start": [start.x, start.y], "end": [end.x, end.y], "cells": cells.size()})
	_expect(true, label + " walked authored cells without teleport (%d)" % cells.size())
	return true

func _capture(name: String) -> void:
	var camera := hero.get_node("Camera") as Camera2D
	camera.force_update_scroll()
	await process_frame
	await process_frame
	var image := root.get_texture().get_image()
	var path := _out(name)
	if image != null and image.save_png(path) == OK:
		screenshots.append(path)
		_expect(true, "player-scale native capture " + name)
	else:
		_expect(false, "player-scale native capture " + name)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(_out(""))
	corridor = _read_json(CORRIDOR)
	_expect(not corridor.is_empty() and corridor.get("production_native_playable") == false, "corridor contract loaded and scoped non-production")
	var save := root.get_node_or_null("SaveService")
	if save != null and save.has_method("configure_storage"):
		save.call("configure_storage", "user://tests/a1_corridor_native.json", true)
	host = Node2D.new()
	root.add_child(host)
	var entities := Node2D.new()
	entities.y_sort_enabled = true
	host.add_child(entities)
	world = OverworldWorld.new()
	host.add_child(world)
	var data := _read_json(_abs("annex_world.v1.json"))
	var props := _read_json(_abs("annex_props.v1.json"))
	var prop_list: Array = props.get("props", [])
	for raw: Variant in corridor.get("decor", []):
		var d: Dictionary = raw
		prop_list.append({"frame": d.frame, "x": d.x, "y": d.y, "z": 0, "flags": "", "lit": false})
	var props_path := _out("corridor_props.v1.json")
	var pf := FileAccess.open(props_path, FileAccess.WRITE)
	pf.store_string(JSON.stringify({"schema": props.get("schema", ""), "props": prop_list}))
	pf.close()
	var ok := world.build(data, _abs("annex_layers.v1.json"), props_path, entities)
	_expect(ok and world.width == 448 and world.height == 256, "composed connector annex remains 448x256")
	nav = OverworldTraversability.new()
	nav.build(world)
	var painted := 0
	for raw: Variant in corridor.get("detail_overlay", []):
		var patch: Dictionary = raw
		var c: Array = patch.cell
		var atlas := OverworldTiles.cell_for(world.tiles_meta, String(patch.token), "detail")
		if atlas.x >= 0:
			world.detail_layer.set_cell(Vector2i(int(c[0]), int(c[1])), OverworldTiles.GROUND_SOURCE, atlas)
			painted += 1
	_expect(painted == corridor.get("detail_overlay", []).size(), "authored gravel approach/apron painted with inherited SOH atlas (%d cells)" % painted)
	await physics_frame
	await physics_frame
	var knight_scene := load("res://game/characters/knight/knight.tscn") as PackedScene
	hero = knight_scene.instantiate() as CharacterBody2D
	entities.add_child(hero)
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rect := body_shape.shape as RectangleShape2D
	_expect(rect.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8), "real pinned Knight body unchanged")
	var start := Vector2i(392, 200)
	hero.global_position = _foot(start)
	var camera := hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = world.width * 16
	camera.limit_bottom = world.height * 16
	camera.make_current()
	camera.force_update_scroll()
	await physics_frame
	await physics_frame
	_expect(nav.unreachable_endpoints(data).is_empty(), "all legacy dungeon/camp/discovery endpoints remain nav-reachable")
	# Adverse full-tile container proof at the first roadside stand.
	var first: Dictionary = {}
	for raw: Variant in corridor.get("instances", []):
		var inst: Dictionary = raw
		if inst.get("poi_binding", {}).get("kind") == "non_poi_roadside_instance":
			first = inst
			break
	var fc: Array = first.cell
	var fs: Array = first.stand_cell
	var adverse := _mount_body("adverse_full_tile_container", Vector2i(int(fc[0]), int(fc[1])), Vector2(16, 16), Vector2.ZERO)
	await physics_frame
	await physics_frame
	var adverse_hit := false
	for hit: Dictionary in _hits_at(Vector2i(int(fs[0]), int(fs[1]))):
		var collider := hit.get("collider") as Node
		if collider != null and String(collider.name).contains("adverse_full_tile"):
			adverse_hit = true
	_expect(adverse_hit, "adverse proof: full-tile container intersects exact roadside stand")
	adverse.queue_free()
	await physics_frame
	await physics_frame
	var slice_bodies := _mount_slice_obstacles(WAY_SLICE) + _mount_slice_obstacles(RELAY_SLICE)
	var container_bodies := 0
	for raw: Variant in corridor.get("instances", []):
		var inst: Dictionary = raw
		var c: Array = inst.cell
		var sprite := world._make_sprite(String(inst.visual_frame))
		sprite.position = Vector2(int(c[0]) * 16 + 8, int(c[1]) * 16 + 16)
		sprite.name = "Source_" + String(inst.instance_id).replace(":", "_")
		world.props_root.add_child(sprite)
		if inst.get("poi_binding", {}).get("kind") == "non_poi_roadside_instance":
			var col: Dictionary = inst.get("collision", {})
			var sz: Array = col.get("size_px", [16, 6])
			var off: Array = col.get("offset_px", [0, 3])
			_mount_body(String(inst.instance_id), Vector2i(int(c[0]), int(c[1])), Vector2(float(sz[0]), float(sz[1])), Vector2(float(off[0]), float(off[1])))
			container_bodies += 1
	_expect(slice_bodies == 12 and container_bodies == 3, "slice obstacles + three physical roadside containers mounted")
	await physics_frame
	await physics_frame
	var stand_report: Array[Dictionary] = []
	for raw: Variant in corridor.get("instances", []):
		var inst: Dictionary = raw
		var sc: Array = inst.stand_cell
		var stand := Vector2i(int(sc[0]), int(sc[1]))
		var clear := nav.is_free(stand) and _hits_at(stand).is_empty()
		var c: Array = inst.cell
		var dist := _foot(stand).distance_to(Vector2(int(c[0]) * 16 + 8, int(c[1]) * 16 + 8))
		_expect(clear and dist <= float(inst.interaction_radius_px), "instance %s stand clear and in range (%.2fpx)" % [inst.instance_id, dist])
		stand_report.append({"instance_id": inst.instance_id, "stand": sc, "clear": clear, "distance_px": dist})
	var route: Dictionary = corridor.get("route", {})
	var outbound_ok := await _drive_cells("postern->containers->Waystation", route.get("outbound_cells", []))
	if outbound_ok:
		await _capture("waystation_locker_player_scale.png")
	var return_ok := false
	if outbound_ok:
		return_ok = await _drive_cells("Waystation->postern retreat/revisit", route.get("return_cells", []))
	if return_ok:
		await _capture("postern_return_player_scale.png")
	# Capture each roadside stand on a second physical visit to prove revisitation.
	for raw: Variant in corridor.get("instances", []):
		var inst: Dictionary = raw
		if inst.get("poi_binding", {}).get("kind") != "non_poi_roadside_instance":
			continue
		var sc: Array = inst.stand_cell
		var stand := Vector2i(int(sc[0]), int(sc[1]))
		var out_cells: Array = route.get("outbound_cells", [])
		var path: Array = []
		for idx: int in range(out_cells.size()):
			path.append(out_cells[idx])
			var pc: Array = out_cells[idx]
			if int(pc[0]) == stand.x and int(pc[1]) == stand.y:
				break
		if path.is_empty() or path[-1] != [stand.x, stand.y]:
			_expect(false, "revisit path exists for " + String(inst.instance_id))
			continue
		var revisited := await _drive_cells("revisit " + String(inst.instance_id), path)
		if revisited:
			await _capture(String(inst.instance_id).replace(":", "_") + ".png")
	_set_direction(Vector2.ZERO)
	var report := {
		"schema": "soh.world.corridor_native_fixture.v1",
		"native_fixture_verified": failures.is_empty(),
		"production_native_playable": false,
		"a3_economy_integrated": false,
		"reward_items_granted": 0,
		"checks": checks,
		"failures": failures,
		"trace": trace,
		"stands": stand_report,
		"screenshots": screenshots,
		"detail_cells_painted": painted,
		"container_bodies": container_bodies,
		"slice_obstacle_cells": slice_bodies,
		"adverse_full_tile_container_intersect": adverse_hit,
		"method": "real Knight + ordinary Input.action_press along authored corridor cells; isolated fixture, not production economy/save"
	}
	var file := FileAccess.open(_out("corridor_native_report.json"), FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
		file.close()
	if host != null:
		host.queue_free()
	await process_frame
	await process_frame
	if failures.is_empty():
		print("A1 CORRIDOR NATIVE FIXTURE PASSED - %d checks (production integration still A0-owned)" % checks)
		quit(0)
	else:
		print("A1 CORRIDOR NATIVE FIXTURE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _revisit_path(start: Vector2i, goal: Vector2i) -> Array:
	var distances := nav.reachable_from(start)
	if distances[goal.y * nav.width + goal.x] < 0:
		return []
	var path: Array = []
	var cursor := goal
	while cursor != start:
		path.push_front([cursor.x, cursor.y])
		var here := distances[cursor.y * nav.width + cursor.x]
		var previous := cursor
		for step: Vector2i in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]:
			var n := cursor + step
			if nav.in_bounds(n) and distances[n.y * nav.width + n.x] == here - 1:
				previous = n
				break
		if previous == cursor:
			return []
		cursor = previous
	return path
