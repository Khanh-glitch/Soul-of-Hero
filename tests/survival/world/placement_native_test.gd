extends SceneTree
## A1 native geography review of A8's existing six territories + four sockets.
## Uses the real pinned Knight body and ordinary Input actions. Source windows
## are bounded evidence only: no production mount, rewards, boss, SaveService
## mutation, A3 economy, A8 interaction emission or Gold/VFX changes.

const KNIGHT := "res://game/characters/knight/knight.tscn"
const WAY_SLICE := "res://data/survival/world/vertical_slice/poi_crown_waystation.slice.json"
const LOGICAL := Vector2i(640, 360)
const TILE := 16
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]

var failures: Array[String] = []
var checks := 0
var inputs_path := "artifacts/a1-placement/placement_native_inputs.json"
var connector_root := "artifacts/a1-connector-art"
var out_root := "artifacts/a1-placement"
var inputs: Dictionary = {}
var report_rows: Array[Dictionary] = []
var screenshots: Array[String] = []
var trace: Array[Dictionary] = []
var host: Node2D
var hero: CharacterBody2D
var camera: Camera2D
var world: OverworldWorld
var collision_root: Node2D
var props_root: Node2D
var current_review: Dictionary = {}
var total_corner_hits := 0

func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--inputs="):
			inputs_path = arg.trim_prefix("--inputs=")
		elif arg.begins_with("--connector-root="):
			connector_root = arg.trim_prefix("--connector-root=")
		elif arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
	call_deferred("_run")

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("A1_PLACEMENT PASS: " + label)
	else:
		failures.append(label)
		print("A1_PLACEMENT FAIL: " + label)

func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}

func _abs(name: String) -> String:
	return ProjectSettings.globalize_path(connector_root.path_join(name))

func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))

func _foot(cell: Array) -> Vector2:
	return Vector2(float(cell[0]) * TILE + 8, float(cell[1]) * TILE + 15)

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

func _hits_at(cell: Array) -> Array[Dictionary]:
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, _foot(cell) + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 8)

func _sha_bytes(bytes: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(bytes)
	return ctx.finish().hex_encode()

func _verify_asset_provenance() -> void:
	var manifest := _read_json(String(inputs.asset_provenance_path))
	_expect(not manifest.is_empty(), "first-hour asset provenance loaded")
	if manifest.is_empty():
		return
	var current: Dictionary = manifest.profiles.a1_current
	var files_ok := true
	for path: String in current.files:
		var expected := String(current.files[path].sha256)
		if not FileAccess.file_exists("res://" + path) or FileAccess.get_sha256("res://" + path) != expected:
			files_ok = false
			print("A1_PLACEMENT provenance file mismatch: " + path)
	_expect(files_ok, "current first-hour whole-file hashes match exact bytes")
	var atlas := _read_json(String(inputs.atlas_path))
	var sheets: Dictionary = {}
	for kind: String in ["terrain", "props"]:
		var texture := load("res://assets/environment/survival_world/" + kind + ".png") as Texture2D
		_expect(texture != null, "provenance atlas image loaded " + kind)
		if texture != null:
			sheets[kind] = texture.get_image()
	var matched := 0
	for row: Dictionary in manifest.crop_compatibility:
		var kind := String(row.kind)
		if not sheets.has(kind):
			continue
		var frame := String(row.frame)
		var rect: Array = atlas[kind][frame]
		if rect != row.current_rect:
			continue
		var image: Image = sheets[kind].duplicate()
		image.convert(Image.FORMAT_RGBA8)
		var crop := image.get_region(Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])))
		crop.convert(Image.FORMAT_RGBA8)
		if _sha_bytes(crop.get_data()) == String(row.raw_rgba_sha256):
			matched += 1
	_expect(matched == 181, "Godot RGBA crop hashes match all 181 first-hour legacy crops")
	var d: Dictionary = manifest.discrepancy_resolution
	_expect(int(d.total_crop_count) == 181 and int(d.matched_crop_count) == 181 and not bool(d.pixel_drift_found),
		"payload-subset versus whole-file discrepancy is explicitly resolved")

func _mount_body(id: String, cell: Vector2i, size: Vector2, offset: Vector2) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = id.replace(":", "_").replace("/", "_")
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = Vector2(cell.x * TILE + 8 + offset.x, cell.y * TILE + 8 + offset.y)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	body.add_child(shape)
	world.blocker_root.add_child(body)
	return body

func _mount_waystation_obstacles() -> int:
	var slice := _read_json(WAY_SLICE)
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

func _build_connector() -> bool:
	world = OverworldWorld.new()
	host.add_child(world)
	var data := _read_json(_abs("annex_world.v1.json"))
	var props := _read_json(_abs("annex_props.v1.json"))
	var prop_list: Array = props.get("props", [])
	var props_path := _out("connector_props.json")
	var pf := FileAccess.open(props_path, FileAccess.WRITE)
	pf.store_string(JSON.stringify({"schema": props.get("schema", ""), "props": prop_list}))
	pf.close()
	var ok := world.build(data, _abs("annex_layers.v1.json"), props_path, host)
	_expect(ok and world.width == 448 and world.height == 256, "connector annex native world built")
	_expect(_mount_waystation_obstacles() > 0, "canonical Waystation obstacles mounted for socket review")
	return ok

func _build_ground(review: Dictionary, atlas: Dictionary) -> void:
	var ground := TileMapLayer.new()
	ground.name = "SourceGround"
	ground.z_index = -10
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE, TILE)
	var src := TileSetAtlasSource.new()
	src.texture = load("res://assets/environment/survival_world/terrain.png") as Texture2D
	src.texture_region_size = Vector2i(TILE, TILE)
	var source_id := ts.add_source(src)
	var used: Dictionary = {}
	var g: Dictionary = review.ground
	for row: Array in g.rows:
		for frame: String in row:
			used[frame] = true
	for frame: String in used:
		var r: Array = atlas.terrain[frame]
		src.create_tile(Vector2i(int(r[0]) / TILE, int(r[1]) / TILE))
	ground.tile_set = ts
	host.add_child(ground)
	var origin: Array = g.origin_cell
	for y: int in range(g.rows.size()):
		var row: Array = g.rows[y]
		for x: int in range(row.size()):
			var frame := String(row[x])
			var r: Array = atlas.terrain[frame]
			ground.set_cell(Vector2i(int(origin[0]) + x, int(origin[1]) + y), source_id, Vector2i(int(r[0]) / TILE, int(r[1]) / TILE))

func _build_source_window(review: Dictionary, atlas: Dictionary) -> void:
	_build_ground(review, atlas)
	collision_root = Node2D.new()
	collision_root.name = "SourceCollision"
	host.add_child(collision_root)
	for i: int in range(review.collision_rects.size()):
		var r: Dictionary = review.collision_rects[i]
		var body := StaticBody2D.new()
		body.name = "SourceSolid_%d" % i
		body.collision_layer = 1
		body.collision_mask = 0
		var wp: Array = r.world_px
		var sp: Array = r.size_px
		body.position = Vector2(float(wp[0]) + float(sp[0]) * 0.5, float(wp[1]) + float(sp[1]) * 0.5)
		var shape := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = Vector2(float(sp[0]), float(sp[1]))
		shape.shape = rect
		body.add_child(shape)
		collision_root.add_child(body)
	props_root = Node2D.new()
	props_root.name = "SourceProps"
	props_root.y_sort_enabled = true
	host.add_child(props_root)
	var props_tex := load("res://assets/environment/survival_world/props.png") as Texture2D
	for raw: Variant in review.props:
		var p: Dictionary = raw
		var frame := String(p.frame)
		var r: Array = atlas.props[frame]
		var at := AtlasTexture.new()
		at.atlas = props_tex
		at.region = Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
		var sprite := Sprite2D.new()
		sprite.texture = at
		sprite.centered = false
		sprite.position = Vector2(float(p.cell[0]) * TILE + 8, float(p.cell[1]) * TILE + 16)
		sprite.offset = Vector2(-float(r[2]) * 0.5, -float(r[3]))
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		props_root.add_child(sprite)

func _mount_endpoint(review: Dictionary, atlas: Dictionary) -> void:
	var endpoint: Dictionary = review.endpoint
	var body := StaticBody2D.new()
	body.name = "ProposedEndpointCollision"
	body.collision_layer = 1
	body.collision_mask = 0
	var wp: Array = endpoint.socket_world_px
	body.position = Vector2(float(wp[0]), float(wp[1]))
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	var size: Array = endpoint.collision_size_px
	rect.size = Vector2(float(size[0]), float(size[1]))
	shape.shape = rect
	body.add_child(shape)
	if collision_root != null:
		collision_root.add_child(body)
	else:
		world.blocker_root.add_child(body)
	var frame: Variant = endpoint.get("native_marker_frame", null)
	if frame != null and not String(frame).is_empty():
		var r: Array = atlas.props[String(frame)]
		var at := AtlasTexture.new()
		at.atlas = load("res://assets/environment/survival_world/props.png") as Texture2D
		at.region = Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
		var sprite := Sprite2D.new()
		sprite.name = "ProposalMarkerNotFinalArt"
		sprite.texture = at
		sprite.position = body.position
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.z_index = 1
		host.add_child(sprite)

func _spawn_hero(start: Array) -> void:
	var scene := load(KNIGHT) as PackedScene
	hero = scene.instantiate() as CharacterBody2D
	if props_root != null:
		props_root.add_child(hero)
	else:
		host.add_child(hero)
	hero.global_position = _foot(start)
	camera = hero.get_node("Camera") as Camera2D
	camera.position_smoothing_enabled = false
	camera.limit_left = -100000
	camera.limit_top = -100000
	camera.limit_right = 100000
	camera.limit_bottom = 100000
	camera.zoom = Vector2.ONE
	camera.make_current()
	camera.force_update_scroll()

func _capture(name: String) -> void:
	camera.force_update_scroll()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	if image != null and image.save_png(_out(name)) == OK:
		screenshots.append(_out(name))
		_expect(true, "native placement capture " + name)
	else:
		_expect(false, "native placement capture " + name)

func _drive_cells(label: String, cells: Array) -> bool:
	for raw: Variant in cells:
		var c: Array = raw
		if not _hits_at(c).is_empty():
			_expect(false, label + " preflight Hero shape clear at " + str(c))
			return false
		var target := _foot(c)
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
	trace.append({"review_id": current_review.id, "leg": label, "cells": cells.size(), "end_foot": [hero.global_position.x, hero.global_position.y]})
	_expect(true, label + " (%d cells)" % cells.size())
	return true

func _probe_directions(review: Dictionary) -> Dictionary:
	var probes: Array[Dictionary] = []
	for direction: Vector2 in [Vector2(0, -12), Vector2(8, -8), Vector2(-8, -8), Vector2(12, 0), Vector2(-12, 0), Vector2(0, 12), Vector2(8, 8), Vector2(-8, 8)]:
		var hit := hero.test_move(hero.global_transform, direction)
		probes.append({"delta": [direction.x, direction.y], "collision": hit})
		if hit:
			total_corner_hits += 1
	return {"probes": probes}

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(_out(""))
	root.content_scale_size = LOGICAL
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.snap_2d_transforms_to_pixel = true
	root.snap_2d_vertices_to_pixel = true
	root.size = Vector2i(1280, 720)
	var save := root.get_node_or_null("SaveService")
	if save != null and save.has_method("configure_storage"):
		save.call("configure_storage", "user://tests/a1_placement_native.json", true)
	inputs = _read_json(inputs_path)
	_expect(not inputs.is_empty() and inputs.reviews.size() == 10, "placement inputs contain six territories + four endpoints")
	if inputs.is_empty():
		_finish()
		return
	_verify_asset_provenance()
	var atlas := _read_json(String(inputs.atlas_path))
	for review_raw: Variant in inputs.reviews:
		current_review = review_raw
		host = Node2D.new()
		host.name = "A1PlacementSourceWindow"
		root.add_child(host)
		world = null
		collision_root = null
		props_root = null
		var built := true
		if String(current_review.collision_mode) == "connector_annex":
			built = _build_connector()
		else:
			_build_source_window(current_review, atlas)
		if current_review.kind == "endpoint":
			_mount_endpoint(current_review, atlas)
		_expect(built, "source window built " + String(current_review.id))
		_spawn_hero(current_review.start_cell)
		await physics_frame
		await physics_frame
		var forward_ok := await _drive_cells("forward existing-cell Hero route " + String(current_review.id), current_review.forward_cells)
		var probe: Dictionary = {}
		if forward_ok:
			probe = _probe_directions(current_review)
			if current_review.kind == "endpoint":
				var endpoint: Dictionary = current_review.endpoint
				var distance := hero.global_position.distance_to(Vector2(float(endpoint.socket_world_px[0]), float(endpoint.socket_world_px[1])))
				_expect(distance <= float(endpoint.interaction_radius_px), "stand remains inside neutral interaction radius " + String(current_review.id))
				var north_hit := hero.test_move(hero.global_transform, Vector2(0, -12))
				_expect(north_hit, "proposed endpoint body blocks socket face without blocking stand " + String(current_review.id))
			await _capture(String(current_review.id).replace(".", "_") + "_goal_1280x720.png")
		var return_ok := false
		if forward_ok:
			return_ok = await _drive_cells("return existing-cell Hero route " + String(current_review.id), current_review.return_cells)
			if return_ok:
				await _capture(String(current_review.id).replace(".", "_") + "_return_1280x720.png")
		report_rows.append({
			"id": current_review.id, "kind": current_review.kind, "poi_id": current_review.poi_id,
			"decision": current_review.decision, "canonical_cell": current_review.canonical_cell,
			"start_cell": current_review.start_cell, "goal_cell": current_review.goal_cell,
			"path_cell_count": current_review.path_cell_count,
			"forward_ok": forward_ok, "return_ok": return_ok,
			"hazard_exposure_cells": current_review.hazard_exposure_cells,
			"probes": probe, "production_status": "AUTHORED_SOURCE_WINDOW_NOT_PRODUCTION_MOUNTED",
		})
		hero = null
		camera = null
		host.queue_free()
		await process_frame
		await process_frame
	_expect(total_corner_hits > 0, "swept corner/edge probes are non-vacuous")
	_finish()

func _finish() -> void:
	var report := {
		"schema": "soh.world.a1_placement_native_report.v1",
		"ok": failures.is_empty(), "checks": checks, "failures": failures,
		"reviews": report_rows, "trace": trace, "screenshots": screenshots,
		"source_contract_sha256": inputs.get("source_contract_sha256", ""),
		"a8_commit": inputs.get("a8_commit", ""),
		"production_native_playable": false,
		"production_world_traversable": false,
		"hazard_damage_and_ragnarok_projection_tested": false,
		"scope": "REAL_GODOT_HERO_SHAPE_SOURCE_WINDOWS_NOT_PRODUCTION_MOUNT",
	}
	var file := FileAccess.open(_out("placement_native_report.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("A1_PLACEMENT SUMMARY checks=%d failures=%d captures=%d reviews=%d" % [checks, failures.size(), screenshots.size(), report_rows.size()])
	quit(0 if failures.is_empty() else 1)
