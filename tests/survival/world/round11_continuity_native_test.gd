extends SceneTree
## Round 11 isolated native source-window admission test.
## Real Knight scene/body/motion/camera + ordinary Input actions, exact source
## chunks, a one-chunk fixture streaming halo, physical forward/return routes.
## NOT production: no A0 mount/save/health rules, A3 rewards, A8 interactions,
## A6 warning presentation, final machine art, boss, Gold or D071 completion.

const KNIGHT := "res://game/characters/knight/knight.tscn"
const WAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_waystation.slice.json"
const TILE := 16
const LOGICAL := Vector2i(640, 360)
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]

var failures: Array[String] = []
var checks := 0
var inputs_path := "artifacts/a1-continuity/continuity_native_inputs.json"
var connector_root := "artifacts/a1-connector-art"
var out_root := "artifacts/a1-continuity"
var resolutions: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
var inputs: Dictionary = {}
var atlas: Dictionary = {}
var chunk_inputs: Dictionary = {}
var mounted_chunks: Dictionary = {}
var trial_bodies: Dictionary = {}
var crowd_bodies: Array[StaticBody2D] = []
var host: Node2D
var chunk_root: Node2D
var entities: Node2D
var body_root: Node2D
var hero: CharacterBody2D
var camera: Camera2D
var world: OverworldWorld
var terrain_texture: Texture2D
var props_texture: Texture2D
var shared_tiles: TileSet
var ground_source := 0
var stream_enabled := true
var motion_tracking := false
var contact_mode := "journey"
var physics_serial := 0
var current_chunk_id := ""
var current_region_id := ""
var current_biome_id := ""
var current_hazard_id := ""
var last_hero_position := Vector2.ZERO
var last_camera_position := Vector2.ZERO
var max_hero_step := 0.0
var max_camera_seam_step := 0.0
var stream_violations: Array[String] = []
var teleport_violations: Array[String] = []
var unexpected_contacts: Array[Dictionary] = []
var stream_events: Array[Dictionary] = []
var region_transitions: Array[Dictionary] = []
var chunk_transitions: Array[Dictionary] = []
var field_transitions: Array[Dictionary] = []
var journey_trace: Array[Dictionary] = []
var spawn_results: Array[Dictionary] = []
var hazard_results: Array[Dictionary] = []
var endpoint_results: Array[Dictionary] = []
var screenshots: Array[String] = []
var capture_rows: Array[Dictionary] = []
var capability_context: Array[String] = []
var dry_metrics: Dictionary = {}
var wet_metrics: Dictionary = {}
var current_phase := "ordinary"
var abort := false

func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--inputs="):
			inputs_path = arg.trim_prefix("--inputs=")
		elif arg.begins_with("--connector-root="):
			connector_root = arg.trim_prefix("--connector-root=")
		elif arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
		elif arg.begins_with("--resolutions="):
			resolutions.clear()
			for part: String in arg.trim_prefix("--resolutions=").split(","):
				var wh: PackedStringArray = part.split("x")
				if wh.size() == 2:
					resolutions.append(Vector2i(int(wh[0]), int(wh[1])))
	physics_frame.connect(_on_physics_frame)
	call_deferred("_run")

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("A1_CONTINUITY PASS: " + label)
	else:
		failures.append(label)
		print("A1_CONTINUITY FAIL: " + label)

func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}

func _abs(name: String) -> String:
	return ProjectSettings.globalize_path(connector_root.path_join(name))

func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))

func _foot(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * TILE + 8, cell.y * TILE + 15)

func _cell_of(position: Vector2) -> Vector2i:
	return Vector2i(clampi(int(floor(position.x / TILE)), 0, 1023), clampi(int(floor(position.y / TILE)), 0, 767))

func _chunk_of_cell(cell: Vector2i) -> String:
	return "chunk:%d:%d" % [cell.x / 64, cell.y / 64]

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
	if hero == null:
		return []
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, _foot(cell) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 8)

func _build_shared_tiles() -> void:
	shared_tiles = TileSet.new()
	shared_tiles.tile_size = Vector2i(TILE, TILE)
	var source := TileSetAtlasSource.new()
	source.texture = terrain_texture
	source.texture_region_size = Vector2i(TILE, TILE)
	ground_source = shared_tiles.add_source(source)
	for frame: String in atlas.terrain:
		var rect: Array = atlas.terrain[frame]
		source.create_tile(Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE))

func _decode_chunk_source(chunk: Dictionary) -> Dictionary:
	var doc := _read_json(String(chunk.source_path))
	var decoded: Dictionary = {}
	for layer_name: String in ["region", "biome", "hazard", "surface", "walk"]:
		var values: Array = []
		for raw_run: Variant in doc.get("layers", {}).get(layer_name, []):
			var run: Array = raw_run
			for _i: int in range(int(run[1])):
				values.append(int(run[0]))
		decoded[layer_name] = values
	return {"doc": doc, "decoded": decoded}

func _add_ground_sprite(parent: Node2D, frame: String, top_left: Vector2, z: int) -> void:
	var rect: Array = atlas.terrain[frame]
	var texture := AtlasTexture.new()
	texture.atlas = terrain_texture
	texture.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = top_left
	sprite.z_index = z
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	parent.add_child(sprite)

func _add_prop_sprite(parent: Node2D, frame: String, bottom_center: Vector2) -> Sprite2D:
	var rect: Array = atlas.props[frame]
	var texture := AtlasTexture.new()
	texture.atlas = props_texture
	texture.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = bottom_center
	sprite.offset = Vector2(-float(rect[2]) * 0.5, -float(rect[3]))
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	parent.add_child(sprite)
	return sprite

func _build_site_visual(visual: Dictionary, ground_parent: Node2D, visual_parent: Node2D) -> void:
	if String(visual.kind) == "a8_exact_shell_skin":
		var origin: Array = visual.origin_px
		var base := Vector2(float(origin[0]), float(origin[1]))
		var skin: Dictionary = visual.skin
		for y: int in range(skin.ground_rows.size()):
			var row: Array = skin.ground_rows[y]
			for x: int in range(row.size()):
				_add_ground_sprite(ground_parent, String(row[x]), base + Vector2(x * TILE, y * TILE), -4)
		for raw: Variant in skin.get("overlays", []):
			var overlay: Dictionary = raw
			var cell: Array = overlay.cell
			_add_ground_sprite(ground_parent, String(overlay.frame), base + Vector2(int(cell[0]) * TILE, int(cell[1]) * TILE), -3)
		for raw: Variant in skin.get("props", []):
			var prop: Dictionary = raw
			var at: Array = prop.local_px
			_add_prop_sprite(visual_parent, String(prop.frame), base + Vector2(float(at[0]), float(at[1])))
	else:
		var origin: Array = visual.origin_px
		var base := Vector2(float(origin[0]), float(origin[1]))
		for raw: Variant in visual.frames:
			var prop: Dictionary = raw
			var offset: Array = prop.offset_px
			_add_prop_sprite(visual_parent, String(prop.frame), base + Vector2(float(offset[0]), float(offset[1])))

func _mount_chunk(cid: String) -> void:
	var chunk: Dictionary = chunk_inputs[cid]
	var node := Node2D.new()
	node.name = "Source_" + cid.replace(":", "_")
	chunk_root.add_child(node)
	var ground := TileMapLayer.new()
	ground.name = "Ground"
	ground.z_index = -10
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	ground.tile_set = shared_tiles
	node.add_child(ground)
	var rows: Array = chunk.ground.rows
	var origin: Array = chunk.origin
	for y: int in range(rows.size()):
		var row: Array = rows[y]
		for x: int in range(row.size()):
			var frame := String(row[x])
			var rect: Array = atlas.terrain[frame]
			ground.set_cell(Vector2i(int(origin[0]) + x, int(origin[1]) + y), ground_source, Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE))
	for i: int in range(chunk.collision_rects.size()):
		var rect: Dictionary = chunk.collision_rects[i]
		var wp: Array = rect.world_px
		var sp: Array = rect.size_px
		var body := StaticBody2D.new()
		body.name = "Solid_%d" % i
		body.collision_layer = 1
		body.collision_mask = 0
		body.position = Vector2(float(wp[0]) + float(sp[0]) * 0.5, float(wp[1]) + float(sp[1]) * 0.5)
		var shape := CollisionShape2D.new()
		var rectangle := RectangleShape2D.new()
		rectangle.size = Vector2(float(sp[0]), float(sp[1]))
		shape.shape = rectangle
		body.add_child(shape)
		node.add_child(body)
	var visual_node := Node2D.new()
	visual_node.name = "Visual_" + cid.replace(":", "_")
	entities.add_child(visual_node)
	for raw: Variant in chunk.get("site_visuals", []):
		_build_site_visual(raw, node, visual_node)
	mounted_chunks[cid] = {"node": node, "visuals": visual_node, "source": _decode_chunk_source(chunk)}

func _drain_chunk(cid: String) -> void:
	var record: Dictionary = mounted_chunks[cid]
	(record.node as Node).queue_free()
	(record.visuals as Node).queue_free()
	mounted_chunks.erase(cid)

func _desired_chunks(cid: String) -> Dictionary:
	var desired: Dictionary = {}
	var parts: PackedStringArray = cid.split(":")
	var cx := int(parts[1])
	var cy := int(parts[2])
	for dy: int in range(-1, 2):
		for dx: int in range(-1, 2):
			var candidate := "chunk:%d:%d" % [cx + dx, cy + dy]
			if chunk_inputs.has(candidate):
				desired[candidate] = true
	return desired

func _update_stream(record_event: bool = true) -> void:
	if hero == null or not stream_enabled:
		return
	var cell := _cell_of(hero.global_position)
	var cid := _chunk_of_cell(cell)
	if not chunk_inputs.has(cid):
		stream_violations.append("Hero entered unavailable source chunk " + cid)
		return
	var desired := _desired_chunks(cid)
	var added: Array[String] = []
	var drained: Array[String] = []
	for candidate: String in desired:
		if not mounted_chunks.has(candidate):
			_mount_chunk(candidate)
			added.append(candidate)
	for candidate: String in mounted_chunks.keys():
		if not desired.has(candidate):
			if candidate == cid:
				stream_violations.append("attempted to drain current chunk " + cid)
				continue
			_drain_chunk(candidate)
			drained.append(candidate)
	if not mounted_chunks.has(cid):
		stream_violations.append("current chunk not mounted " + cid)
	if record_event and (cid != current_chunk_id or not added.is_empty() or not drained.is_empty()):
		stream_events.append({"frame": physics_serial, "from_chunk": current_chunk_id, "to_chunk": cid,
			"mounted": added, "drained": drained, "hero_foot": [hero.global_position.x, hero.global_position.y],
			"camera": [camera.global_position.x, camera.global_position.y]})
	if cid != current_chunk_id:
		if record_event and not current_chunk_id.is_empty():
			var camera_delta := camera.global_position.distance_to(last_camera_position)
			max_camera_seam_step = maxf(max_camera_seam_step, camera_delta)
			chunk_transitions.append({"frame": physics_serial, "from": current_chunk_id, "to": cid,
				"cell": [cell.x, cell.y], "camera_delta_px": camera_delta})
		current_chunk_id = cid

func _field_at_hero() -> Dictionary:
	if hero == null or not stream_enabled:
		return {}
	var cell := _cell_of(hero.global_position)
	var cid := _chunk_of_cell(cell)
	if not mounted_chunks.has(cid):
		return {}
	var source: Dictionary = mounted_chunks[cid].source
	var doc: Dictionary = source.doc
	var decoded: Dictionary = source.decoded
	var origin: Array = doc.origin
	var size: Array = doc.size
	var local := Vector2i(cell.x - int(origin[0]), cell.y - int(origin[1]))
	if local.x < 0 or local.y < 0 or local.x >= int(size[0]) or local.y >= int(size[1]):
		return {}
	var index := local.y * int(size[0]) + local.x
	var result := {"cell": [cell.x, cell.y], "chunk_id": cid}
	for layer_name: String in ["region", "biome", "hazard", "surface"]:
		var raw := int(decoded[layer_name][index])
		var legend: Array = doc.get("legend", {}).get(layer_name, [])
		var value := ""
		if raw > 0 and raw <= legend.size():
			value = String(legend[raw - 1])
		result[layer_name + "_id"] = value
		result[layer_name] = raw
	result["walk"] = int(decoded.walk[index])
	return result

func _apply_field() -> void:
	var field := _field_at_hero()
	if field.is_empty():
		return
	var base_speed := float(inputs.hero.move_speed_px_s)
	var multiplier := 1.0
	if String(field.biome_id) == "freshwater_marsh":
		multiplier = float(inputs.hazard_fields.marsh.test_only_speed_multiplier_proposal)
	hero.move_speed = base_speed * multiplier
	var region := String(field.region_id)
	var biome := String(field.biome_id)
	var hazard := String(field.hazard_id)
	if region != current_region_id:
		if not current_region_id.is_empty():
			region_transitions.append({"frame": physics_serial, "from": current_region_id, "to": region, "cell": field.cell})
		current_region_id = region
	if biome != current_biome_id or hazard != current_hazard_id:
		field_transitions.append({"frame": physics_serial, "cell": field.cell, "region_id": region,
			"from_biome": current_biome_id, "to_biome": biome, "from_hazard": current_hazard_id, "to_hazard": hazard,
			"speed_multiplier_test_only": multiplier, "health": hero.health})
		current_biome_id = biome
		current_hazard_id = hazard

func _on_physics_frame() -> void:
	if not motion_tracking or hero == null or not is_instance_valid(hero):
		return
	physics_serial += 1
	if stream_enabled:
		_update_stream()
		_apply_field()
	var hero_delta := hero.global_position.distance_to(last_hero_position)
	max_hero_step = maxf(max_hero_step, hero_delta)
	if hero_delta > 20.0:
		teleport_violations.append("frame %d displacement %.3f" % [physics_serial, hero_delta])
	if contact_mode == "journey":
		for i: int in range(hero.get_slide_collision_count()):
			var collision := hero.get_slide_collision(i)
			unexpected_contacts.append({"frame": physics_serial, "normal": [collision.get_normal().x, collision.get_normal().y],
				"foot": [hero.global_position.x, hero.global_position.y]})
	last_hero_position = hero.global_position
	if camera != null:
		last_camera_position = camera.global_position

func _reset_tracking() -> void:
	last_hero_position = hero.global_position
	last_camera_position = camera.global_position
	var field := _field_at_hero()
	if not field.is_empty():
		current_chunk_id = String(field.chunk_id)
		current_region_id = String(field.region_id)
		current_biome_id = String(field.biome_id)
		current_hazard_id = String(field.hazard_id)
		_apply_field()

func _reset_hero(cell: Vector2i) -> void:
	motion_tracking = false
	_set_direction(Vector2.ZERO)
	hero.global_position = _foot(cell)
	hero.velocity = Vector2.ZERO
	hero.health = 100
	camera.reset_smoothing()
	camera.force_update_scroll()
	if stream_enabled:
		_update_stream(false)
	_reset_tracking()
	motion_tracking = true

func _spawn_source_hero(start: Vector2i) -> void:
	var scene := load(KNIGHT) as PackedScene
	hero = scene.instantiate() as CharacterBody2D
	entities.add_child(hero)
	hero.global_position = _foot(start)
	camera = hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = 16384
	camera.limit_bottom = 12288
	camera.make_current()
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rectangle := body_shape.shape as RectangleShape2D
	_expect(rectangle.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8), "real Knight 12x16 body at (0,-8)")
	_expect(hero.motion_mode == CharacterBody2D.MOTION_MODE_FLOATING and hero.collision_mask == 5, "A0-comparable floating Hero collision profile")
	_expect(hero.move_speed == 96.0 and hero.acceleration == 900.0 and hero.friction == 1100.0, "A0-comparable 96/900/1100 motion constants")
	_expect(camera.position == Vector2(0, -8) and camera.position_smoothing_enabled and camera.position_smoothing_speed == 7.0 and camera.zoom == Vector2.ONE, "real Hero stand camera and smoothing preserved")
	_reset_tracking()

func _capture(name: String, all_resolutions: bool = false) -> void:
	RenderingServer.render_loop_enabled = true
	var selected: Array[Vector2i] = []
	if all_resolutions:
		selected = resolutions
	else:
		selected = [Vector2i(1280, 720)]
	for resolution: Vector2i in selected:
		root.size = resolution
		camera.force_update_scroll()
		await process_frame
		await process_frame
		await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var filename := name.get_basename() + "_%dx%d.png" % [resolution.x, resolution.y]
		var path := _out(filename)
		if image != null and image.get_size() == resolution and image.save_png(path) == OK:
			screenshots.append(path)
			capture_rows.append({"path": path, "resolution": [resolution.x, resolution.y], "sha256": FileAccess.get_sha256(path),
				"hero_foot": [hero.global_position.x, hero.global_position.y], "camera": [camera.global_position.x, camera.global_position.y],
				"phase": current_phase, "production_frame": false})
			_expect(true, "native source-window capture " + filename)
		else:
			_expect(false, "native source-window capture " + filename)
	root.size = Vector2i(1280, 720)
	camera.force_update_scroll()
	await process_frame
	await process_frame
	RenderingServer.render_loop_enabled = false

func _drive_cells(label: String, cells: Array) -> Dictionary:
	if cells.is_empty():
		_expect(false, label + " has physical cells")
		return {"ok": false}
	var first: Array = cells[0]
	var first_cell := Vector2i(int(first[0]), int(first[1]))
	if hero.global_position.distance_to(_foot(first_cell)) > 20.0:
		_expect(false, label + " is continuous with current Hero position")
		return {"ok": false}
	var start_position := hero.global_position
	var previous_position := hero.global_position
	var start_frame := physics_serial
	var travelled := 0.0
	var max_speed := 0.0
	var reached := 0
	for raw: Variant in cells:
		var c: Array = raw
		var cell := Vector2i(int(c[0]), int(c[1]))
		if not _hits_at(cell).is_empty():
			_expect(false, label + " preflight clear at " + str(c))
			return {"ok": false}
		var target := _foot(cell)
		var deadline := physics_serial + 180
		while hero.global_position.distance_to(target) > 1.25 and physics_serial < deadline and not abort:
			_set_direction(target - hero.global_position)
			await physics_frame
			travelled += previous_position.distance_to(hero.global_position)
			max_speed = maxf(max_speed, hero.velocity.length())
			previous_position = hero.global_position
		_set_direction(Vector2.ZERO)
		await physics_frame
		travelled += previous_position.distance_to(hero.global_position)
		previous_position = hero.global_position
		if hero.global_position.distance_to(target) > 4.5:
			_expect(false, label + " ordinary movement reached " + str(c))
			return {"ok": false}
		reached += 1
	_set_direction(Vector2.ZERO)
	for _i: int in range(6):
		await physics_frame
	var frames := physics_serial - start_frame
	var metrics := {"ok": true, "label": label, "cells": cells.size(), "reached_cells": reached,
		"frames": frames, "travelled_px": travelled, "average_speed_px_s": travelled / maxf(1.0, frames / 60.0),
		"max_speed_px_s": max_speed, "start_foot": [start_position.x, start_position.y],
		"end_foot": [hero.global_position.x, hero.global_position.y], "health": hero.health,
		"phase": current_phase, "contact_mode": contact_mode}
	journey_trace.append(metrics)
	_expect(true, "%s frame-stepped forward/return segment (%d cells, %d frames)" % [label, cells.size(), frames])
	return metrics

func _mount_body(id: String, socket_cell: Vector2i, size: Vector2, frames: Array = []) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = "Trial_" + id.replace(".", "_").replace(":", "_")
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = _foot(socket_cell) - Vector2(0, 7)
	var shape := CollisionShape2D.new()
	var rectangle := RectangleShape2D.new()
	rectangle.size = size
	shape.shape = rectangle
	body.add_child(shape)
	if world != null:
		world.blocker_root.add_child(body)
	else:
		body_root.add_child(body)
	var visual := Node2D.new()
	visual.name = "Visual_" + id.replace(".", "_").replace(":", "_")
	entities.add_child(visual)
	for raw: Variant in frames:
		var spec: Dictionary = raw
		var offset: Array = spec.offset_px
		_add_prop_sprite(visual, String(spec.frame), body.position + Vector2(float(offset[0]), float(offset[1])))
	trial_bodies[id] = {"body": body, "visual": visual, "socket_cell": [socket_cell.x, socket_cell.y], "size_px": [size.x, size.y]}
	return body

func _remove_body(id: String) -> void:
	if not trial_bodies.has(id):
		return
	var record: Dictionary = trial_bodies[id]
	(record.body as Node).queue_free()
	(record.visual as Node).queue_free()
	trial_bodies.erase(id)

func _visual_frames(endpoint_id: String) -> Array:
	for raw: Variant in inputs.visual_identity_proposals:
		var visual: Dictionary = raw
		if String(visual.endpoint_id) == endpoint_id:
			return visual.frames
	return []

func _endpoint_distance(socket_cell: Vector2i) -> float:
	return hero.global_position.distance_to(_foot(socket_cell) - Vector2(0, 7))

func _live_path(start: Vector2i, goal: Vector2i, bounds: Rect2i) -> Array:
	if not bounds.has_point(goal) or not _hits_at(goal).is_empty():
		return []
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {start: start}
	var head := 0
	var steps: Array[Vector2i] = [Vector2i(1, -1), Vector2i(1, 1), Vector2i(-1, -1), Vector2i(-1, 1), Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]
	while head < queue.size():
		var cursor := queue[head]
		head += 1
		if cursor == goal:
			break
		for step: Vector2i in steps:
			var next := cursor + step
			if not bounds.has_point(next) or previous.has(next) or not _hits_at(next).is_empty():
				continue
			if step.x != 0 and step.y != 0:
				if not _hits_at(cursor + Vector2i(step.x, 0)).is_empty() or not _hits_at(cursor + Vector2i(0, step.y)).is_empty():
					continue
			previous[next] = cursor
			queue.append(next)
	if not previous.has(goal):
		return []
	var path: Array = []
	var cursor := goal
	while true:
		path.push_front([cursor.x, cursor.y])
		if cursor == start:
			break
		cursor = previous[cursor]
	return path

func _has_diagonal(cells: Array) -> bool:
	for i: int in range(1, cells.size()):
		var a: Array = cells[i - 1]
		var b: Array = cells[i]
		if abs(int(b[0]) - int(a[0])) == 1 and abs(int(b[1]) - int(a[1])) == 1:
			return true
	return false

func _verify_sources() -> void:
	_expect(not inputs.is_empty() and inputs.get("production_native_playable", true) == false, "single Round 11 source packet loaded with production fence")
	if inputs.is_empty():
		abort = true
		return
	var hashes_ok := true
	for raw: Variant in inputs.chunks:
		var chunk: Dictionary = raw
		chunk_inputs[String(chunk.chunk_id)] = chunk
		if not FileAccess.file_exists(String(chunk.source_path)) or FileAccess.get_sha256(String(chunk.source_path)) != String(chunk.source_sha256):
			hashes_ok = false
			print("A1_CONTINUITY source hash mismatch: " + String(chunk.chunk_id))
	_expect(hashes_ok and chunk_inputs.size() == 54, "54 exact chunk whole-file hashes verified (20 route-required + halo)")
	_expect(inputs.route_required_chunk_ids.size() == 20, "narrow route family has 20 required source chunks, not continent mass-fill")
	_expect(inputs.ordinary_expedition.future_chest_mounted == false and inputs.last72_expedition.future_chest_mounted == true, "ordinary and last72 physical mounting are separated")
	_expect(inputs.loadout.weapon == "knife_only" and not bool(inputs.loadout.gun) and not bool(inputs.loadout.core) and int(inputs.loadout.bosses_required) == 0, "knife-first route requires no gun, Core or boss")
	var migration: Dictionary = inputs.source_manifest_migration
	var migration_ok := true
	for raw: Variant in migration.files:
		var row: Dictionary = raw
		var actual := FileAccess.get_sha256("res://" + String(row.path))
		if actual != String(row.a1_current_sha256):
			migration_ok = false
	_expect(migration_ok and int(migration.changed_file_count) == 6 and String(migration.decision) == "NO_BLIND_REPIN_ATOMIC_COHERENT_SET_ONLY", "A0 SourceManifest migration is atomic; six changed whole files are not blind-repinned")
	_expect(migration.hash_domains.has("whole_file") and migration.hash_domains.has("payload_subset") and migration.hash_domains.has("raw_rgba"), "whole-file/payload/raw-RGBA hash domains remain distinct")
	atlas = _read_json(String(inputs.atlas_path))
	terrain_texture = load("res://assets/environment/survival_world/terrain.png") as Texture2D
	props_texture = load("res://assets/environment/survival_world/props.png") as Texture2D
	_expect(not atlas.is_empty() and terrain_texture != null and props_texture != null, "verified current atlas textures loaded without recolor or private assets")
	_build_shared_tiles()

func _build_source_host() -> void:
	host = Node2D.new()
	host.name = "A1Round11SourceFixture"
	root.add_child(host)
	chunk_root = Node2D.new()
	chunk_root.name = "StreamedSourceChunks"
	host.add_child(chunk_root)
	body_root = Node2D.new()
	body_root.name = "TrialPhysicalBodies"
	host.add_child(body_root)
	entities = Node2D.new()
	entities.name = "FootSortedReferencesAndHero"
	entities.y_sort_enabled = true
	host.add_child(entities)
	world = null
	_spawn_source_hero(Vector2i(56, 218))
	_update_stream(false)
	_reset_tracking()
	motion_tracking = true

func _run_spawn_matrix() -> void:
	var spawn: Dictionary = inputs.spawn_safety
	var unique: Dictionary = {}
	var zones: Dictionary = {}
	for raw: Variant in spawn.cases:
		var case: Dictionary = raw
		var cell := Vector2i(int(case.spawn_cell[0]), int(case.spawn_cell[1]))
		_reset_hero(cell)
		await physics_frame
		await physics_frame
		var clear := _hits_at(cell).is_empty() and int(case.source.walk) == 1 and int(case.source.hazard) == 0
		_expect(clear, "deterministic safe spawn seed %d at %s" % [int(case.seed), str(case.spawn_cell)])
		var forward := await _drive_cells("spawn seed %d to regional rally" % int(case.seed), case.forward_cells)
		var returned: Dictionary = {"ok": false}
		if bool(forward.get("ok", false)):
			returned = await _drive_cells("spawn seed %d physical rally return" % int(case.seed), case.return_cells)
		spawn_results.append({"seed": case.seed, "zone_id": case.zone_id, "spawn_cell": case.spawn_cell,
			"clear": clear, "forward_ok": forward.get("ok", false), "return_ok": returned.get("ok", false)})
		unique[str(case.spawn_cell)] = true
		zones[String(case.zone_id)] = true
		if abort:
			return
	_expect(unique.size() == 18 and zones.size() == 3, "18 distinct deterministic starts span three broad safe regions")
	for raw: Variant in spawn.zone_links:
		var link: Dictionary = raw
		var start: Array = link.forward_cells[0]
		_reset_hero(Vector2i(int(start[0]), int(start[1])))
		await physics_frame
		var forward := await _drive_cells("safe region home link " + String(link.zone_id), link.forward_cells)
		if bool(forward.get("ok", false)):
			await _drive_cells("safe region home link physical return " + String(link.zone_id), link.return_cells)
		if abort:
			return
	await _capture("spawn_regional_rally")

func _run_expeditions() -> void:
	_reset_hero(Vector2i(56, 218))
	current_phase = "ordinary"
	var recycler: Dictionary = {}
	for raw: Variant in inputs.trial_endpoint_stress.source_cases:
		if String(raw.endpoint_id) == "endpoint.ragnarok.recycler":
			recycler = raw
	_mount_body("endpoint.ragnarok.recycler", Vector2i(126, 440), Vector2(28, 28), _visual_frames("endpoint.ragnarok.recycler"))
	await physics_frame
	await physics_frame
	_expect(not trial_bodies.has("a8_deep_chest_south_quarry_01"), "days1-11 expedition has no future chest body")
	for raw: Variant in inputs.ordinary_expedition.legs:
		var leg: Dictionary = raw
		var result := await _drive_cells("ordinary " + String(leg.leg_id), leg.cells)
		if not bool(result.get("ok", false)):
			abort = true
			return
		if String(leg.leg_id) == "home_to_quarry_outer":
			await _capture("ordinary_south_quarry")
		elif String(leg.leg_id) == "quarry_to_amber_mill":
			await _capture("ordinary_amber_mill")
		elif String(leg.leg_id) == "amber_mill_to_fishers_piles":
			await _capture("ordinary_fishers_piles", true)
		elif String(leg.leg_id) == "fishers_piles_to_home":
			await _capture("ordinary_home_return")
	_expect(hero.global_position.distance_to(_foot(Vector2i(56, 218))) <= 4.5 and hero.health == 100, "ordinary three-region knife-first loop physically returned home without health/reward mutation")
	# The Hero stays at the returned home position; only the fixture phase/body changes.
	current_phase = "ragnarok_day12"
	var chest: Dictionary = inputs.chest_source_proposal
	_mount_body(String(chest.proposal_id), Vector2i(33, 280), Vector2(28, 28), [{"frame": "cache_closed", "offset_px": [0, 8]}])
	await physics_frame
	await physics_frame
	_expect(trial_bodies.has(String(chest.proposal_id)) and not bool(chest.interaction_enabled), "last72 chest is physical but sealed/non-interactive")
	for raw: Variant in inputs.last72_expedition.legs:
		var leg: Dictionary = raw
		var result := await _drive_cells("last72 " + String(leg.leg_id), leg.cells)
		if not bool(result.get("ok", false)):
			abort = true
			return
		if String(leg.leg_id) == "dry_control_8_steps":
			dry_metrics = result
		elif String(leg.leg_id) == "marsh_enter_8_steps":
			wet_metrics = result
			await _capture("last72_marsh_transition")
		elif String(leg.leg_id) == "fishers_piles_to_sealed_quarry_cache":
			_expect(_endpoint_distance(Vector2i(33, 280)) <= 62.0, "deep chest stand is within 62px neutral geometry radius")
			_expect(hero.test_move(hero.global_transform, Vector2(0, -12)), "deep chest 28x28 body blocks socket face, not the stand")
			_expect(trial_bodies.size() == 2 and inputs.reward_items_granted == 0, "sealed chest exposes no A3 reward or interaction implementation")
			await _capture("last72_sealed_quarry_cache", true)
		elif String(leg.leg_id) == "sealed_quarry_cache_to_home":
			await _capture("last72_home_return")
	_expect(not dry_metrics.is_empty() and not wet_metrics.is_empty(), "equal eight-step dry/marsh motion controls executed")
	if not dry_metrics.is_empty() and not wet_metrics.is_empty():
		var dry_max := float(dry_metrics.max_speed_px_s)
		var wet_max := float(wet_metrics.max_speed_px_s)
		var ratio := wet_max / maxf(0.001, dry_max)
		_expect(absf(dry_max - 96.0) < 2.0 and absf(wet_max - 62.4) < 2.0 and absf(ratio - 0.65) < 0.04,
			"test-only marsh response measured 96 -> 62.4px/s (ratio %.3f), A7/final balance still open" % ratio)
		_expect(float(wet_metrics.average_speed_px_s) < float(dry_metrics.average_speed_px_s) * 0.82, "marsh physical travel is slower than equal-step dry control")
	_expect(hero.global_position.distance_to(_foot(Vector2i(56, 218))) <= 4.5 and hero.health == 100, "last72 sealed-source route physically returned with no damage or profile credit")

func _run_hazard_probes() -> void:
	for raw: Variant in inputs.hazard_fields.probes:
		var probe: Dictionary = raw
		capability_context.clear()
		_reset_hero(Vector2i(int(probe.safe_cell[0]), int(probe.safe_cell[1])))
		await physics_frame
		var before := hero.health
		var forward := await _drive_cells("hazard enter " + String(probe.hazard_id), probe.forward_cells)
		var active := _field_at_hero()
		_expect(bool(forward.get("ok", false)) and String(active.get("hazard_id", "")) == String(probe.hazard_id), "real hazard field active inside " + String(probe.hazard_id))
		if String(probe.hazard_id) == "hz_crown_heat":
			await _capture("hazard_heat_edge")
		else:
			await _capture("hazard_cold_edge")
		var returned := await _drive_cells("hazard safe retreat " + String(probe.hazard_id), probe.return_cells)
		var cleared := _field_at_hero()
		_expect(bool(returned.get("ok", false)) and String(cleared.get("hazard_id", "")).is_empty() and hero.health == before, "safe retreat clears geographic exposure without A0 health mutation " + String(probe.hazard_id))
		capability_context.append(String(probe.required_capability))
		hazard_results.append({"hazard_id": probe.hazard_id, "kind": probe.kind,
			"without_capability": {"required": probe.required_capability, "present": false, "warning_signal": true},
			"with_capability": {"required": probe.required_capability, "present": capability_context.has(String(probe.required_capability)), "resistance_or_damage_claim": false},
			"forward_ok": forward.get("ok", false), "return_ok": returned.get("ok", false),
			"health_before": before, "health_after": hero.health, "damage_application": "A0_NOT_APPLIED"})
		_expect(capability_context.has(String(probe.required_capability)), "gear-tier readout remains a signal only " + String(probe.hazard_id))

func _run_endpoint_source_cases() -> void:
	current_phase = "ordinary"
	_remove_body("a8_deep_chest_south_quarry_01")
	for raw: Variant in inputs.trial_endpoint_stress.source_cases:
		var case: Dictionary = raw
		var endpoint_id := String(case.endpoint_id)
		if not trial_bodies.has(endpoint_id):
			_mount_body(endpoint_id, Vector2i(int(case.socket_cell[0]), int(case.socket_cell[1])), Vector2(28, 28), _visual_frames(endpoint_id))
		_reset_hero(Vector2i(int(case.diagonal_start_cell[0]), int(case.diagonal_start_cell[1])))
		await physics_frame
		await physics_frame
		var bounds := Rect2i(Vector2i(int(case.socket_cell[0]) - 12, int(case.socket_cell[1]) - 10), Vector2i(28, 28))
		var start := _cell_of(hero.global_position)
		var goal := Vector2i(int(case.stand_cell[0]), int(case.stand_cell[1]))
		var path := _live_path(start, goal, bounds)
		_expect(not path.is_empty() and _has_diagonal(path), "diagonal live-shape approach exists " + endpoint_id)
		var forward := await _drive_cells("endpoint diagonal approach " + endpoint_id, path)
		_expect(bool(forward.get("ok", false)) and _endpoint_distance(Vector2i(int(case.socket_cell[0]), int(case.socket_cell[1]))) <= 62.0, "endpoint diagonal stand remains in 62px radius " + endpoint_id)
		_expect(hero.test_move(hero.global_transform, Vector2(0, -12)), "endpoint body adverse north probe " + endpoint_id)
		await _capture("endpoint_" + endpoint_id.replace(".", "_"), true)
		var returned := await _drive_cells("endpoint physical retreat " + endpoint_id, case.return_cells)
		# Larger-body proxy is an explicit stress variant, not a change to A0 Hero.
		var body_shape := hero.get_node("BodyShape") as CollisionShape2D
		var rectangle := body_shape.shape as RectangleShape2D
		rectangle.size = Vector2(20, 24)
		_reset_hero(Vector2i(int(case.diagonal_start_cell[0]), int(case.diagonal_start_cell[1])))
		await physics_frame
		var large_path := _live_path(_cell_of(hero.global_position), goal, bounds)
		_expect(not large_path.is_empty(), "20x24 larger-body path exists " + endpoint_id)
		var large := await _drive_cells("endpoint 20x24 larger-body approach " + endpoint_id, large_path)
		var large_return: Dictionary = {"ok": false}
		if bool(large.get("ok", false)):
			large_return = await _drive_cells("endpoint 20x24 larger-body retreat " + endpoint_id, _reverse_cells(large_path))
		rectangle.size = Vector2(12, 16)
		endpoint_results.append({"endpoint_id": endpoint_id, "diagonal_ok": forward.get("ok", false),
			"return_ok": returned.get("ok", false), "large_body_ok": large.get("ok", false),
			"large_return_ok": large_return.get("ok", false), "body_size_px": [28, 28],
			"large_hero_proxy_px": [20, 24], "production_endpoint": false})

func _reverse_cells(cells: Array) -> Array:
	var copy := cells.duplicate(true)
	copy.reverse()
	return copy

func _mount_waystation_obstacles() -> int:
	var slice := _read_json(WAY_SLICE)
	var count := 0
	for raw: Variant in slice.get("immutable_geography", {}).get("static_obstacles", []):
		var obstacle: Dictionary = raw
		if not bool(obstacle.get("blocks_nav", false)):
			continue
		var size: Array = obstacle.get("collision_size_px", [16, 16])
		var offset: Array = obstacle.get("collision_offset_px", [0, 0])
		for raw_cell: Variant in obstacle.get("cells", []):
			var cell: Array = raw_cell
			var body := StaticBody2D.new()
			body.name = "CanonicalWaystationObstacle"
			body.collision_layer = 1
			body.collision_mask = 0
			body.position = Vector2(int(cell[0]) * TILE + 8 + float(offset[0]), int(cell[1]) * TILE + 8 + float(offset[1]))
			var shape := CollisionShape2D.new()
			var rectangle := RectangleShape2D.new()
			rectangle.size = Vector2(float(size[0]), float(size[1]))
			shape.shape = rectangle
			body.add_child(shape)
			world.blocker_root.add_child(body)
			count += 1
	return count

func _build_connector_host() -> void:
	stream_enabled = false
	motion_tracking = false
	if host != null:
		host.queue_free()
	await process_frame
	await process_frame
	hero = null
	camera = null
	mounted_chunks.clear()
	trial_bodies.clear()
	host = Node2D.new()
	host.name = "A1CombinedWaystationFixture"
	root.add_child(host)
	entities = Node2D.new()
	entities.y_sort_enabled = true
	host.add_child(entities)
	world = OverworldWorld.new()
	host.add_child(world)
	var data := _read_json(_abs("annex_world.v1.json"))
	var props := _read_json(_abs("annex_props.v1.json"))
	var props_path := _out("combined_connector_props.json")
	var file := FileAccess.open(props_path, FileAccess.WRITE)
	file.store_string(JSON.stringify({"schema": props.get("schema", ""), "props": props.get("props", [])}))
	file.close()
	var ok := world.build(data, _abs("annex_layers.v1.json"), props_path, entities)
	_expect(ok and world.width == 448 and world.height == 256, "combined connector source world built")
	_expect(_mount_waystation_obstacles() == 12, "12 canonical Waystation obstacle cells mounted with both trial endpoints")
	var scene := load(KNIGHT) as PackedScene
	hero = scene.instantiate() as CharacterBody2D
	entities.add_child(hero)
	hero.global_position = _foot(Vector2i(382, 200))
	hero.move_speed = 96.0
	camera = hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = world.width * TILE
	camera.limit_bottom = world.height * TILE
	camera.make_current()
	camera.reset_smoothing()
	_mount_body("endpoint.ragnarok.deposit", Vector2i(404, 202), Vector2(28, 28), _visual_frames("endpoint.ragnarok.deposit"))
	_mount_body("endpoint.ragnarok.fixed_vendor", Vector2i(412, 202), Vector2(28, 28), _visual_frames("endpoint.ragnarok.fixed_vendor"))
	await physics_frame
	await physics_frame
	_reset_tracking()
	motion_tracking = true
	_expect(trial_bodies.size() == 2 and camera.limit_right == 7168 and camera.position_smoothing_enabled, "simultaneous deposit+vendor 28x28 bodies and A0-comparable camera seam")

func _run_combined_waystation() -> void:
	await _build_connector_host()
	var bounds := Rect2i(Vector2i(376, 192), Vector2i(48, 32))
	var start := _cell_of(hero.global_position)
	var shared := Vector2i(408, 207)
	var path := _live_path(start, shared, bounds)
	_expect(not path.is_empty(), "physical legacy/annex seam path exists with both machines")
	var seam := await _drive_cells("combined static streaming-seam source composition", path)
	_expect(bool(seam.get("ok", false)) and inputs.trial_endpoint_stress.combined.dynamic_streaming_claim == false, "static source seam crossed; dynamic production streaming not claimed")
	await _capture("combined_waystation_seam")
	var deposit := Vector2i(404, 204)
	var vendor := Vector2i(412, 204)
	var deposit_path := _live_path(shared, deposit, bounds)
	var deposit_ok := await _drive_cells("combined diagonal deposit approach", deposit_path)
	_expect(bool(deposit_ok.get("ok", false)) and _endpoint_distance(Vector2i(404, 202)) <= 62.0, "combined deposit stand clear with vendor also mounted")
	_expect(hero.test_move(hero.global_transform, Vector2(0, -12)), "combined deposit adverse north body probe")
	await _capture("combined_deposit_and_vendor")
	var vendor_path := _live_path(deposit, vendor, bounds)
	var vendor_ok := await _drive_cells("combined diagonal vendor approach", vendor_path)
	_expect(bool(vendor_ok.get("ok", false)) and _endpoint_distance(Vector2i(412, 202)) <= 62.0, "combined vendor stand clear with deposit also mounted")
	_expect(hero.test_move(hero.global_transform, Vector2(0, -12)), "combined vendor adverse north body probe")
	await _capture("combined_vendor_and_deposit", true)
	var returned := await _drive_cells("combined physical seam retreat", _live_path(vendor, start, bounds))
	_expect(bool(returned.get("ok", false)), "combined deposit+vendor route physically retreats across seam")
	# Larger Hero stress uses the same body offset/camera and both 28x28 machines.
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rectangle := body_shape.shape as RectangleShape2D
	rectangle.size = Vector2(20, 24)
	_reset_hero(shared)
	await physics_frame
	var large_path := _live_path(shared, vendor, bounds)
	_expect(not large_path.is_empty() and _has_diagonal(large_path), "combined 20x24 diagonal path with both machines")
	var large := await _drive_cells("combined 20x24 larger-body approach", large_path)
	var large_return: Dictionary = {"ok": false}
	if bool(large.get("ok", false)):
		large_return = await _drive_cells("combined 20x24 larger-body retreat", _reverse_cells(large_path))
	rectangle.size = Vector2(12, 16)
	# Occupancy adverse: two physical crowd proxies force a real alternate route.
	_reset_hero(shared)
	for cell: Vector2i in [Vector2i(408, 204), Vector2i(408, 205)]:
		var body := StaticBody2D.new()
		body.name = "CrowdProxy"
		body.collision_layer = 1
		body.collision_mask = 0
		body.position = _foot(cell) - Vector2(0, 7)
		var shape := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = Vector2(12, 16)
		shape.shape = rect
		body.add_child(shape)
		world.blocker_root.add_child(body)
		crowd_bodies.append(body)
	await physics_frame
	await physics_frame
	contact_mode = "adverse"
	_expect(hero.test_move(hero.global_transform, Vector2(0, -48)), "crowd proxy blocks direct central approach (adverse non-vacuity)")
	contact_mode = "journey"
	var crowd_path := _live_path(shared, vendor, bounds)
	var crowd_ok := await _drive_cells("combined crowd alternate route", crowd_path)
	_expect(not crowd_path.is_empty() and bool(crowd_ok.get("ok", false)), "crowd occupancy preserves an alternate physical vendor approach")
	for body: StaticBody2D in crowd_bodies:
		body.queue_free()
	crowd_bodies.clear()
	# Non-interactive screen overlay must not eat movement or alter geometry.
	var layer := CanvasLayer.new()
	var overlay := ColorRect.new()
	overlay.color = Color(0.03, 0.02, 0.04, 0.25)
	overlay.position = Vector2.ZERO
	overlay.size = Vector2(640, 40)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(overlay)
	root.add_child(layer)
	var overlay_path := _live_path(vendor, deposit, bounds)
	var overlay_ok := await _drive_cells("combined noninteractive overlay approach", overlay_path)
	_expect(bool(overlay_ok.get("ok", false)) and overlay.mouse_filter == Control.MOUSE_FILTER_IGNORE, "screen overlay does not block physical endpoint approach")
	layer.queue_free()
	endpoint_results.append({"endpoint_id": "combined.deposit+vendor", "seam_ok": seam.get("ok", false),
		"deposit_ok": deposit_ok.get("ok", false), "vendor_ok": vendor.get("ok", false),
		"return_ok": returned.get("ok", false), "large_ok": large.get("ok", false),
		"large_return_ok": large_return.get("ok", false), "crowd_alternate_ok": crowd_ok.get("ok", false),
		"overlay_ok": overlay_ok.get("ok", false), "dynamic_streaming_claim": false,
		"body_size_px": [28, 28], "interaction_radius_px": 62, "production_endpoint": false})

func _finish() -> void:
	_set_direction(Vector2.ZERO)
	RenderingServer.render_loop_enabled = true
	var report := {
		"schema": "soh.world.a1_round11_continuity_native_report.v1",
		"ok": failures.is_empty() and not abort,
		"checks": checks, "failures": failures, "abort": abort,
		"source_contract_sha256": inputs.get("source_contract_sha256", ""),
		"a0_commit": inputs.get("a0_commit", ""), "a8_commit": inputs.get("a8_commit", ""), "a3_commit": inputs.get("a3_commit", ""),
		"spawn_results": spawn_results, "journeys": journey_trace, "hazards": hazard_results,
		"endpoints": endpoint_results, "stream_events": stream_events,
		"region_transitions": region_transitions, "chunk_transitions": chunk_transitions,
		"field_transitions": field_transitions, "screenshots": screenshots, "captures": capture_rows,
		"dry_control": dry_metrics, "marsh_control": wet_metrics,
		"stream_violations": stream_violations, "teleport_violations": teleport_violations,
		"unexpected_contacts": unexpected_contacts, "max_hero_step_px": max_hero_step,
		"max_camera_seam_step_px": max_camera_seam_step,
		"mounted_chunk_count_at_finish": mounted_chunks.size(),
		"production_native_playable": false, "production_world_traversable": false,
		"production_spawn_approved": false, "chest_authorized": false,
		"reward_items_granted": 0, "save_mutation": false, "health_damage_applied": false,
		"final_friction_or_damage_balance_approved": false, "final_A8_A6_art_approved": false,
		"darkness_and_D071_completed": false,
		"scope": "REAL_GODOT_HERO_EXACT_SOURCE_CHUNKS_WITH_FIXTURE_STREAMING_NOT_PRODUCTION_MOUNT",
	}
	var file := FileAccess.open(_out("continuity_native_report.json"), FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "  "))
		file.close()
	print("A1_CONTINUITY SUMMARY checks=%d failures=%d captures=%d spawn_cases=%d stream_events=%d" % [checks, failures.size(), screenshots.size(), spawn_results.size(), stream_events.size()])
	if failures.is_empty() and not abort:
		print("A1 CONTINUITY NATIVE FIXTURE PASSED - real Knight/source chunks/physical return; production integration still A0-owned")
		quit(0)
	else:
		print("A1 CONTINUITY NATIVE FIXTURE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(_out(""))
	root.content_scale_size = LOGICAL
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.snap_2d_transforms_to_pixel = true
	root.snap_2d_vertices_to_pixel = true
	root.size = Vector2i(1280, 720)
	inputs = _read_json(inputs_path)
	_verify_sources()
	if abort:
		_finish()
		return
	_build_source_host()
	await physics_frame
	await physics_frame
	RenderingServer.render_loop_enabled = false
	await _run_spawn_matrix()
	if not abort:
		await _run_expeditions()
	if not abort:
		await _run_hazard_probes()
	if not abort:
		await _run_endpoint_source_cases()
	if not abort:
		await _run_combined_waystation()
	_expect(stream_violations.is_empty(), "fixture stream never drained current/missing Hero chunk")
	_expect(teleport_violations.is_empty() and max_hero_step <= 20.0, "all within-run travel is continuous frame motion, not teleport")
	_expect(unexpected_contacts.is_empty(), "valid routes have no unexpected physical collision contacts")
	_expect(stream_events.size() >= 20 and chunk_transitions.size() >= 10, "dynamic source chunk halo mount/drain and seam crossings are non-vacuous")
	_expect(region_transitions.size() >= 4, "actual Hero crossed multiple canonical region fields")
	_expect(max_camera_seam_step <= 20.0, "tracked A0-comparable camera remains continuous at chunk seams")
	_expect(screenshots.size() >= 20 and capture_rows.size() == screenshots.size(), "useful native 720p/1440p/2160 captures are non-vacuous")
	_finish()
