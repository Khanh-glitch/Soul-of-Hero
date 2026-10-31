extends SceneTree
## Round 12 isolated native deep-world integration evidence.
## Real A0-comparable Knight body/motion/camera, original OverworldWorld inset,
## strict 192-chunk reader, bounded live stream, exact A8/roadside source bodies.
## NOT an A0 production mount, SaveService, reward, A8 interior or final art test.

const READER := preload("res://game/survival/world/a1_authored_world_reader.gd")
const STREAM := preload("res://game/survival/world/a1_authored_world_stream.gd")
const KNIGHT := "res://game/characters/knight/knight.tscn"
const TILE := 16
const LOGICAL := Vector2i(640, 360)
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]

var failures: Array[String] = []
var checks := 0
var abort := false
var inputs_path := "artifacts/a1-round12/round12_native_inputs.json"
var out_root := "artifacts/a1-round12"
var resolutions: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
var inputs: Dictionary = {}
var atlas: Dictionary = {}
var reader: Variant = null
var stream: Variant = null
var host: Node2D
var entities: Node2D
var body_root: Node2D
var a8_ground_root: Node2D
var world: OverworldWorld
var hero: CharacterBody2D
var camera: Camera2D
var terrain_texture: Texture2D
var props_texture: Texture2D
var motion_tracking := false
var contact_mode := "journey"
var current_phase := "source_checks"
var current_drive_label := ""
var current_drive_target := Vector2i.ZERO
var physics_serial := 0
var independent_resets := 0
var last_hero_position := Vector2.ZERO
var last_camera_position := Vector2.ZERO
var max_hero_step := 0.0
var max_camera_step := 0.0
var current_chunk_id := ""
var current_region_id := ""
var current_biome_id := ""
var current_hazard_id := ""
var current_time_of_day := 0.35
var unexpected_contacts: Array[Dictionary] = []
var teleport_violations: Array[String] = []
var stream_violations: Array[String] = []
var journey_trace: Array[Dictionary] = []
var spawn_results: Array[Dictionary] = []
var site_arrivals: Array[Dictionary] = []
var discovery_log: Array[Dictionary] = []
var discovered: Dictionary = {}
var hazard_results: Array[Dictionary] = []
var dynamic_results: Dictionary = {}
var region_transitions: Array[Dictionary] = []
var field_transitions: Array[Dictionary] = []
var chunk_transitions: Array[Dictionary] = []
var capture_rows: Array[Dictionary] = []
var screenshots: Array[String] = []
var stream_events: Array[Dictionary] = []
var stream_performance: Array[Dictionary] = []
var stream_generation := 0
var salvage_arrival: Dictionary = {}
var expected_block_contacts := 0
var prepare_measurements: Array[Dictionary] = []
var started_ticks := 0
var budget_probe := false


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--inputs="):
			inputs_path = arg.trim_prefix("--inputs=")
		elif arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
		elif arg == "--budget-probe":
			budget_probe = true
		elif arg.begins_with("--resolutions="):
			resolutions.clear()
			for part: String in arg.trim_prefix("--resolutions=").split(","):
				var wh := part.split("x")
				if wh.size() == 2:
					resolutions.append(Vector2i(int(wh[0]), int(wh[1])))
	physics_frame.connect(_on_physics_frame)
	call_deferred("_run")


func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("A1_R12 PASS: " + label)
	else:
		failures.append(label)
		print("A1_R12 FAIL: " + label)


func _json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))


func _source_path(path: String) -> String:
	return path if path.begins_with("res://") or path.begins_with("user://") or path.begins_with("/") else "res://" + path


func _foot(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * TILE + 8, cell.y * TILE + 15)


func _cell_of(at: Vector2) -> Vector2i:
	return Vector2i(clampi(floori(at.x / TILE), 0, 1023), clampi(floori(at.y / TILE), 0, 767))


func _rect(array: Array) -> Rect2:
	return Rect2(float(array[0]), float(array[1]), float(array[2]), float(array[3]))


func _verify_sources() -> void:
	_expect(not inputs.is_empty(), "derived native inputs parsed")
	if inputs.is_empty():
		abort = true
		return
	_expect(FileAccess.get_sha256(_source_path(String(inputs.source_contract))) == String(inputs.source_contract_sha256), "runtime contract exact bytes")
	_expect(FileAccess.get_sha256(_source_path(String(inputs.spawn_index_path))) == String(inputs.spawn_index_sha256), "spawn index exact bytes")
	_expect(FileAccess.get_sha256("res://data/survival/world/world_plan.v1.json") == String(inputs.world_plan_sha256), "master geography exact bytes")
	for key: String in (inputs.source_manifest as Dictionary):
		var pin: Dictionary = inputs.source_manifest[key]
		if FileAccess.get_sha256("res://" + String(pin.path)) != String(pin.sha256):
			_expect(false, "source hash " + key)
			abort = true
	_expect(not abort, "all pinned A0/A8/A1/Hero/legacy source bytes match")
	_expect(int(inputs.reward_items_granted) == 0 and bool(inputs.save_mutation) == false, "derived packet has no reward or save mutation")
	atlas = _json(String(inputs.atlas_path))
	terrain_texture = load(String((atlas.textures as Dictionary).terrain)) as Texture2D
	props_texture = load(String((atlas.textures as Dictionary).props)) as Texture2D
	_expect(terrain_texture != null and props_texture != null, "accepted A1 atlas textures load in Godot")


func _build_host() -> void:
	host = Node2D.new()
	host.name = "A1Round12IsolatedContinent"
	root.add_child(host)
	world = OverworldWorld.new()
	world.name = "OriginalA0LegacyInset"
	host.add_child(world)
	entities = Node2D.new()
	entities.name = "OriginalAndA8FootSortedEntities"
	entities.y_sort_enabled = true
	var world_data := _json(String(inputs.legacy.world_data))
	_expect(world.build(world_data, String(inputs.legacy.layers), String(inputs.legacy.props), entities), "real OverworldWorld builds original 384x256 inset")
	for raw: Variant in (inputs.legacy.seam_carves as Array):
		var seam := raw as Dictionary
		world._shortcut_carve[String(seam.id)] = (seam.carve as Array).duplicate()
		world.set_shortcut_open(String(seam.id), true)
	_expect(world.shortcut_carve_boxes().size() >= 6, "only four original shortcuts plus two isolated seam carves are registered")
	reader = READER.new()
	stream = STREAM.new()
	stream.name = "Round12LiveSourceStream"
	host.add_child(stream)
	_expect(bool(stream.configure("res://data/survival/world", reader, false)), "strict reader and live stream configure: " + String(stream.last_error))
	if abort:
		return
	body_root = Node2D.new()
	body_root.name = "ExactA8SourceBodies"
	host.add_child(body_root)
	a8_ground_root = Node2D.new()
	a8_ground_root.name = "ExactA8SourceGround"
	a8_ground_root.z_index = -4
	host.add_child(a8_ground_root)
	host.add_child(entities)
	_mount_a8_sites()
	_spawn_hero(Vector2i(56, 218))
	_update_stream(false)
	stream.bind_focus(hero)
	_reset_tracking()
	motion_tracking = true


func _add_ground_sprite(frame: String, top_left: Vector2, parent: Node2D) -> void:
	if not atlas.terrain.has(frame):
		_expect(false, "A8 ground frame exists " + frame)
		return
	var rect: Array = atlas.terrain[frame]
	var texture := AtlasTexture.new()
	texture.atlas = terrain_texture
	texture.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = top_left
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.light_mask = 2
	parent.add_child(sprite)


func _add_a8_prop(frame: String, bottom_center: Vector2, site_id: String) -> void:
	if not atlas.props.has(frame):
		_expect(false, "A8 prop frame exists " + frame)
		return
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
	sprite.light_mask = 2
	sprite.set_meta("a8_source_proxy", site_id)
	entities.add_child(sprite)


func _mount_a8_sites() -> void:
	for key: String in (inputs.physical_sites as Dictionary):
		var site: Dictionary = reader.physical_site(key)
		_expect(bool(site.get("ok", false)), "reader exact A8 transform " + key)
		var origin: Array = site.shell_origin_world_px
		var base := Vector2(float(origin[0]), float(origin[1]))
		var visual: Dictionary = site.visual_layout
		var rows: Array = visual.ground_rows
		for y: int in range(rows.size()):
			var row: Array = rows[y]
			for x: int in range(row.size()):
				_add_ground_sprite(String(row[x]), base + Vector2(x * TILE, y * TILE), a8_ground_root)
		for raw: Variant in visual.get("overlays", []):
			var overlay := raw as Dictionary
			var cell: Array = overlay.cell
			_add_ground_sprite(String(overlay.frame), base + Vector2(int(cell[0]) * TILE, int(cell[1]) * TILE), a8_ground_root)
		for raw: Variant in visual.get("props", []):
			var prop := raw as Dictionary
			var at: Array = prop.local_px
			_add_a8_prop(String(prop.frame), base + Vector2(float(at[0]), float(at[1])), String(site.site_id))
		for raw: Variant in site.obstacles:
			var body := raw as Dictionary
			_add_body(String(site.site_id) + ":obstacle", _rect(body.rect_px), body_root)
		_expect(bool(site.fixture_proxy_only) and not bool(site.production_scene_mounted), "A8 proxy is not misreported as a mounted scene " + key)


func _add_body(id: String, rect: Rect2, parent: Node2D) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = id.replace(":", "_").replace("/", "_") + str(parent.get_child_count())
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = rect.get_center()
	body.set_meta("source_id", id)
	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = rect.size
	collision.shape = shape
	body.add_child(collision)
	parent.add_child(body)
	return body


func _spawn_hero(start: Vector2i) -> void:
	var scene := load(KNIGHT) as PackedScene
	hero = scene.instantiate() as CharacterBody2D
	hero.name = "RealA0ComparableKnight"
	entities.add_child(hero)
	hero.global_position = _foot(start)
	hero.move_speed = float(inputs.hero.move_speed_px_s)
	hero.acceleration = float(inputs.hero.acceleration_px_s2)
	hero.friction = float(inputs.hero.friction_px_s2)
	camera = hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = 16384
	camera.limit_bottom = 12288
	camera.make_current()
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var rectangle := body_shape.shape as RectangleShape2D
	_expect(rectangle.size == Vector2(12, 16) and body_shape.position == Vector2(0, -8), "real Knight 12x16 body at (0,-8)")
	_expect(hero.motion_mode == CharacterBody2D.MOTION_MODE_FLOATING and hero.collision_mask == 5, "A0-comparable floating collision profile")
	_expect(hero.move_speed == 96.0 and hero.acceleration == 900.0 and hero.friction == 1100.0, "A0-comparable 96/900/1100 motion constants")
	_expect(camera.position == Vector2(0, -8) and camera.position_smoothing_enabled and camera.zoom == Vector2.ONE, "real Hero stand camera at logical player scale")


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
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 16)


func _stream_rect() -> Rect2:
	return Rect2(hero.global_position - Vector2(480, 360), Vector2(960, 720))


func _update_stream(record_transition: bool = true) -> void:
	if hero == null or stream == null:
		return
	var result: Dictionary = stream.update_stream(hero.global_position, _stream_rect())
	if not bool(result.get("ok", false)):
		stream_violations.append(String(result.get("error", "stream update failed")))
		return
	var cell := _cell_of(hero.global_position)
	var cid := String(reader.chunk_id_at(cell))
	if not (stream.loaded_chunks as Dictionary).has(cid):
		stream_violations.append("Hero chunk not mounted " + cid)
	if cid != current_chunk_id:
		if record_transition and not current_chunk_id.is_empty():
			chunk_transitions.append({"frame": physics_serial, "from": current_chunk_id, "to": cid,
				"cell": [cell.x, cell.y], "camera_delta_px": camera.global_position.distance_to(last_camera_position)})
		current_chunk_id = cid


func _apply_field() -> void:
	var cell := _cell_of(hero.global_position)
	var identity: Dictionary = reader.cell_identity(cell)
	if not bool(identity.get("ok", false)):
		stream_violations.append("Hero left authored source identity")
		return
	hero.move_speed = float(inputs.hero.move_speed_px_s)
	var region := String(identity.region_id)
	var biome := String(identity.biome_id)
	var hazard := String(identity.hazard_id)
	if region != current_region_id:
		if not current_region_id.is_empty():
			region_transitions.append({"frame": physics_serial, "from": current_region_id, "to": region, "cell": [cell.x, cell.y]})
		current_region_id = region
	if biome != current_biome_id or hazard != current_hazard_id:
		field_transitions.append({"frame": physics_serial, "cell": [cell.x, cell.y], "region_id": region,
			"from_biome": current_biome_id, "to_biome": biome, "from_hazard": current_hazard_id, "to_hazard": hazard,
			"health": hero.health, "speed_multiplier_applied": 1.0})
		current_biome_id = biome
		current_hazard_id = hazard
	stream.set_time_of_day(current_time_of_day, region)
	for raw: Variant in reader.pois_near(cell, 12, []):
		var row := raw as Dictionary
		if not bool(row.locked_without_supplied_capabilities):
			continue
		var pid := String(row.poi_id)
		if not discovered.has(pid):
			discovered[pid] = true
			discovery_log.append({"poi_id": pid, "frame": physics_serial, "cell": [cell.x, cell.y],
				"distance_cells": int(row.distance_cells), "required_capabilities": (row.poi as Dictionary).required_capabilities,
				"full_access_granted": false})


func _on_physics_frame() -> void:
	if not motion_tracking or hero == null or not is_instance_valid(hero):
		return
	physics_serial += 1
	_update_stream()
	_apply_field()
	var hero_delta := hero.global_position.distance_to(last_hero_position)
	max_hero_step = maxf(max_hero_step, hero_delta)
	if hero_delta > 20.0:
		teleport_violations.append("frame %d displacement %.3f at %s" % [physics_serial, hero_delta, current_drive_label])
	var camera_delta := camera.global_position.distance_to(last_camera_position)
	max_camera_step = maxf(max_camera_step, camera_delta)
	if contact_mode == "journey":
		for i: int in range(hero.get_slide_collision_count()):
			var collision := hero.get_slide_collision(i)
			var collider: Object = collision.get_collider()
			unexpected_contacts.append({"frame": physics_serial, "normal": [collision.get_normal().x, collision.get_normal().y],
				"foot": [hero.global_position.x, hero.global_position.y], "drive_label": current_drive_label,
				"target_cell": [current_drive_target.x, current_drive_target.y], "velocity": [hero.velocity.x, hero.velocity.y],
				"collider": String((collider as Node).name) if collider is Node else ""})
	elif contact_mode == "expected_block" and hero.get_slide_collision_count() > 0:
		expected_block_contacts += 1
	last_hero_position = hero.global_position
	last_camera_position = camera.global_position


func _reset_tracking() -> void:
	last_hero_position = hero.global_position
	last_camera_position = camera.global_position
	var identity: Dictionary = reader.cell_identity(_cell_of(hero.global_position))
	current_chunk_id = String(identity.get("chunk_id", ""))
	current_region_id = String(identity.get("region_id", ""))
	current_biome_id = String(identity.get("biome_id", ""))
	current_hazard_id = String(identity.get("hazard_id", ""))


func _reset_hero(cell: Vector2i) -> void:
	motion_tracking = false
	independent_resets += 1
	_set_direction(Vector2.ZERO)
	hero.global_position = _foot(cell)
	hero.velocity = Vector2.ZERO
	hero.health = 100
	camera.reset_smoothing()
	camera.force_update_scroll()
	_update_stream(false)
	_reset_tracking()
	motion_tracking = true


func _set_direction(delta: Vector2) -> void:
	for action: String in MOVE_ACTIONS:
		Input.action_release(action)
	if delta.is_zero_approx():
		return
	var distance := delta.length()
	var direction := delta / distance
	var base_speed := maxf(1.0, hero.move_speed)
	var deceleration := maxf(1.0, hero.acceleration)
	var braking_speed := sqrt(2.0 * deceleration * 0.8 * maxf(0.0, distance - 0.5))
	var target_speed := clampf(braking_speed, 0.0, base_speed)
	var strength := clampf(target_speed / base_speed, 0.0, 1.0)
	if strength <= 0.001:
		return
	strength = maxf(0.21, strength)
	if direction.x < 0.0:
		Input.action_press("move_left", -direction.x * strength)
	elif direction.x > 0.0:
		Input.action_press("move_right", direction.x * strength)
	if direction.y < 0.0:
		Input.action_press("move_up", -direction.y * strength)
	elif direction.y > 0.0:
		Input.action_press("move_down", direction.y * strength)


func _drive_cells(label: String, cells: Array) -> Dictionary:
	current_drive_label = label
	contact_mode = "journey"
	if cells.is_empty():
		_expect(false, label + " has physical cells")
		return {"ok": false}
	var first: Array = cells[0]
	if hero.global_position.distance_to(_foot(Vector2i(int(first[0]), int(first[1])))) > 20.0:
		_expect(false, label + " is continuous with current Hero position")
		return {"ok": false}
	var start_position := hero.global_position
	var previous_position := hero.global_position
	var start_wall := Time.get_ticks_msec()
	var start_frame := physics_serial
	var travelled := 0.0
	var max_speed := 0.0
	var reached := 0
	for raw: Variant in cells:
		var c: Array = raw
		var cell := Vector2i(int(c[0]), int(c[1]))
		current_drive_target = cell
		if int(stream.resolved_walk(cell)) != 1:
			_expect(false, label + " source/dynamic walk preflight at " + str(c))
			return {"ok": false}
		if not _hits_at(cell).is_empty():
			_expect(false, label + " physical preflight clear at " + str(c))
			return {"ok": false}
		var target := _foot(cell)
		var deadline := physics_serial + 180
		var completed := false
		while physics_serial < deadline and not abort:
			var distance := hero.global_position.distance_to(target)
			if distance <= 0.65 and hero.velocity.length() <= 6.0:
				completed = true
				break
			if distance <= 0.65:
				_set_direction(Vector2.ZERO)
			else:
				_set_direction(target - hero.global_position)
			await physics_frame
			travelled += previous_position.distance_to(hero.global_position)
			max_speed = maxf(max_speed, hero.velocity.length())
			previous_position = hero.global_position
		if not completed:
			_expect(false, label + " reached and settled before deadline at " + str(c))
			return {"ok": false}
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
		"frames": frames, "wall_ms": Time.get_ticks_msec() - start_wall,
		"travelled_px": travelled, "average_speed_px_s": travelled / maxf(1.0, frames / 60.0),
		"max_speed_px_s": max_speed, "start_foot": [start_position.x, start_position.y],
		"end_foot": [hero.global_position.x, hero.global_position.y], "health": hero.health,
		"phase": current_phase, "production_mount": false}
	journey_trace.append(metrics)
	_expect(true, "%s physical segment (%d cells, %d frames)" % [label, cells.size(), frames])
	return metrics


func _run_reader_checks() -> void:
	current_phase = "reader_and_body_contracts"
	var report: Dictionary = reader.source_report()
	_expect(bool(report.ok) and int(report.verified_chunks) == 192 and int(report.poi_count) == 118, "full 1024x768 / 192-chunk / 118-POI source ready")
	_expect(reader.world_frame() == Vector2i(1024, 768) and reader.world_pixels().size == Vector2(16384, 12288), "reader bounds equal real authored terrain")
	for cell: Vector2i in [Vector2i(-1, 0), Vector2i(1024, 0), Vector2i(0, 768), Vector2i(2000, 2000)]:
		_expect(not bool(reader.cell_layers(cell).get("ok", false)), "outside frame has no manufactured terrain " + str(cell))
	for raw: Variant in (inputs.legacy.seam_carves as Array):
		var seam := raw as Dictionary
		_expect(bool(reader.check_seam(seam).get("ok", false)), "source seam road/walk contract " + String(seam.id))
	await physics_frame
	await physics_frame
	var seam_blocked := 0
	var seam_clear := 0
	for raw: Variant in (inputs.legacy.seam_carves as Array):
		var carve: Array = (raw as Dictionary).carve
		for y: int in range(int(carve[1]), int(carve[3]) + 1):
			for x: int in range(int(carve[0]), int(carve[2]) + 1):
				if _hits_at(Vector2i(x, y)).is_empty():
					seam_clear += 1
				else:
					seam_blocked += 1
	_expect(seam_clear > 0 and seam_blocked > 0, "tile carves open routes while original prop bodies still block (%d clear/%d blocked)" % [seam_clear, seam_blocked])
	for key: String in (inputs.physical_sites as Dictionary):
		var site: Dictionary = reader.physical_site(key)
		var approach: Array = site.approach_cell
		_expect(_hits_at(Vector2i(int(approach[0]), int(approach[1]))).is_empty(), "A8 approach Hero body clear " + key)
		_expect(site.shell_bounds_px == [128, 128] and site.doorway_clear_world_rect_px.size() == 4, "A8 128px shell and doorway preserved " + key)
	var temporal_a: Dictionary = reader.temporal_context(86400.0 * 14.0 + 3600.0, 335.5 * 3600.0)
	var temporal_b: Dictionary = reader.temporal_context(86400.0 * 14.0 + 3600.0, 335.5 * 3600.0)
	_expect(temporal_a == temporal_b and not bool(temporal_a.reset_required), "same online/offline time inputs produce identical world context")
	var reset_context: Dictionary = reader.temporal_context(86400.0 * 14.0 + 3600.0, 336.0 * 3600.0)
	_expect(bool(reset_context.reset_required) and not bool(reset_context.static_geography_mutation), "336h reset boundary never mutates master geography")
	_expect(FileAccess.get_sha256("res://data/survival/world/world_plan.v1.json") == String(inputs.world_plan_sha256), "world identity unchanged after temporal queries")


func _run_spawn_matrix() -> void:
	current_phase = "broad_spawn_and_J01"
	var unique: Dictionary = {}
	var chunks: Dictionary = {}
	var regions: Dictionary = {}
	var driven := 0
	for raw: Variant in (inputs.spawn_safety.cases as Array):
		var case := raw as Dictionary
		var cell := Vector2i(int(case.spawn_cell[0]), int(case.spawn_cell[1]))
		var chosen: Dictionary = reader.choose_safe_spawn(int(case.seed))
		_expect(bool(chosen.get("ok", false)) and chosen.get("cell", Vector2i(-1, -1)) == cell, "reader/compiler deterministic spawn seed %d" % int(case.seed))
		_reset_hero(cell)
		await physics_frame
		await physics_frame
		var opportunities: Dictionary = reader.opportunities_near(cell, 64)
		var has_material := not (opportunities.resource_nodes as Array).is_empty() or not (opportunities.pois as Array).is_empty() or not (opportunities.roadside_sources as Array).is_empty()
		var clear := _hits_at(cell).is_empty() and int(case.source.walk) == 1 and int(case.source.hazard) == 0 and has_material
		_expect(clear, "safe spawn/body/material seed %d at %s" % [int(case.seed), str(case.spawn_cell)])
		var forward: Dictionary = {"ok": true, "not_driven": true}
		var returned: Dictionary = {"ok": true, "not_driven": true}
		if bool(case.native_drive):
			forward = await _drive_cells("spawn seed %d to road rally" % int(case.seed), case.forward_cells)
			if bool(forward.get("ok", false)):
				returned = await _drive_cells("spawn seed %d road rally return" % int(case.seed), case.return_cells)
			driven += 1
		spawn_results.append({"seed": int(case.seed), "spawn_cell": case.spawn_cell, "chunk_id": String(case.source.chunk_id),
			"region_id": String(case.source.region_id), "clear": clear, "native_drive": bool(case.native_drive),
			"forward_ok": bool(forward.get("ok", false)), "return_ok": bool(returned.get("ok", false)),
			"road_distance_cells": int(case.eligibility.road_distance_cells), "independent_fixture_reset": true})
		unique[str(case.spawn_cell)] = true
		chunks[String(case.source.chunk_id)] = true
		regions[String(case.source.region_id)] = true
		if abort:
			return
	_expect(unique.size() == 36 and chunks.size() >= 12 and regions.size() == 3 and driven == 12, "36 distinct broad seeds / >=12 chunks / three regions / 12 physical returns")


func _check_site_arrival(key: String) -> void:
	var site: Dictionary = reader.physical_site(key)
	var approach: Array = site.approach_cell
	var entry: Array = site.entry_portal_world_px
	var distance := hero.global_position.distance_to(Vector2(float(entry[0]), float(entry[1])))
	_expect(hero.global_position.distance_to(_foot(Vector2i(int(approach[0]), int(approach[1])))) <= 4.5 and distance <= 16.0,
		"physical A8 outer approach/return anchor " + key)
	_expect(_hits_at(Vector2i(int(approach[0]), int(approach[1]))).is_empty(), "arrived A8 stand remains body-clear " + key)
	site_arrivals.append({"site_key": key, "poi_id": String(site.poi_id), "frame": physics_serial,
		"canonical_cell": site.canonical_cell, "approach_cell": approach, "entry_distance_px": distance,
		"outer_requires": site.outer_requires, "inner_requires": site.inner_requires,
		"interior_entered": false, "production_scene_mounted": false})


func _run_primary_journey() -> void:
	current_phase = "primary_no_teleport_J04_J07"
	_reset_hero(Vector2i(56, 218))
	var journey: Dictionary = inputs.primary_journey
	for raw: Variant in journey.legs:
		var leg := raw as Dictionary
		var result: Dictionary = await _drive_cells("primary " + String(leg.leg_id), leg.cells)
		if not bool(result.get("ok", false)):
			abort = true
			return
		var waypoint := String(leg.to_waypoint)
		if waypoint == "salvage":
			var source: Dictionary = inputs.roadside_sources[0]
			var stand: Array = source.stand_cell
			var near := hero.global_position.distance_to(_foot(Vector2i(int(stand[0]), int(stand[1])))) <= 4.5
			_expect(near and String(source.resource_node_id) == "res:src_crown_salvage:05", "ordinary authored roadside salvage physically approached")
			salvage_arrival = {"instance_id": String(source.instance_id), "resource_node_id": String(source.resource_node_id),
				"frame": physics_serial, "stand_cell": stand, "economy_binding": source.economy_binding,
				"reward_items_granted": 0, "interaction_executed": false}
			await _capture("primary_roadside_salvage", false)
		elif waypoint in ["quarry", "orchard", "mill"]:
			_check_site_arrival(waypoint)
			await _capture("primary_" + waypoint, waypoint in ["quarry", "orchard"])
		elif waypoint == "home":
			await _capture("primary_home_return", false)
	_expect(site_arrivals.size() == 3 and hero.global_position.distance_to(_foot(Vector2i(56, 218))) <= 4.5,
		"no-teleport inset -> salvage -> Quarry -> Orchard -> Mill -> inset return")
	_expect(hero.health == 100 and int(inputs.reward_items_granted) == 0, "primary expedition changed neither health nor rewards")
	_expect(discovery_log.size() >= 1, "locked POI identity discovered geographically before access")
	_expect(max_hero_step <= 20.0 and teleport_violations.is_empty(), "primary and all driven legs contain only continuous frame motion")


func _find_leg(journey: Dictionary, leg_id: String) -> Dictionary:
	for raw: Variant in journey.legs:
		if String((raw as Dictionary).leg_id) == leg_id:
			return (raw as Dictionary).duplicate(true)
	return {}


func _drive_expected_block(start: Vector2i, target: Vector2i) -> void:
	_reset_hero(start)
	await physics_frame
	await physics_frame
	contact_mode = "expected_block"
	expected_block_contacts = 0
	current_drive_label = "expected visible palisade refusal"
	var deadline := physics_serial + 90
	while physics_serial < deadline:
		_set_direction(_foot(target) - hero.global_position)
		await physics_frame
	_set_direction(Vector2.ZERO)
	await physics_frame
	_expect(expected_block_contacts > 0 and hero.global_position.distance_to(_foot(target)) > 4.5 and not _hits_at(target).is_empty(),
		"real Hero physically refused by visible dynamic full-cell body")
	contact_mode = "journey"


func _harvest_stream() -> void:
	if stream == null:
		return
	for raw: Variant in (stream.stream_events as Array):
		var event := (raw as Dictionary).duplicate(true)
		event["generation"] = stream_generation
		stream_events.append(event)
	var perf: Dictionary = stream.performance_report()
	perf["generation"] = stream_generation
	stream_performance.append(perf)


func _rebuild_stream(with_descriptor: Dictionary = {}) -> void:
	motion_tracking = false
	_harvest_stream()
	stream.clear_stream()
	host.remove_child(stream)
	stream.queue_free()
	reader = READER.new()
	stream = STREAM.new()
	stream.name = "Round12LiveSourceStreamReloaded"
	host.add_child(stream)
	host.move_child(stream, 1)
	stream_generation += 1
	_expect(bool(stream.configure("res://data/survival/world", reader, false)), "reader/stream reconstruct from source generation %d" % stream_generation)
	if not with_descriptor.is_empty():
		var cell: Array = with_descriptor.cell
		var applied: Dictionary = stream.apply_structure(Vector2i(int(cell[0]), int(cell[1])), String(with_descriptor.layer),
			int(with_descriptor.value), int(with_descriptor.expected_base), int(with_descriptor.revision), String(with_descriptor.structure_id))
		_expect(bool(applied.get("ok", false)), "plain run-local descriptor reapplied after source reload")
	stream.bind_focus(hero)
	_reset_tracking()
	motion_tracking = true


func _run_dynamic_reload() -> void:
	current_phase = "dynamic_structure_and_J12"
	var descriptor: Dictionary = inputs.dynamic_fixture
	var baseline := _find_leg(inputs.reload_baseline_journey, String(descriptor.baseline_leg_id))
	var detour := _find_leg(inputs.reload_journey, String(descriptor.detour_leg_id))
	_expect(not baseline.is_empty() and not detour.is_empty() and baseline.cells != detour.cells, "baseline and dynamic detour are distinct real legs")
	var start: Array = baseline.from_cell
	_reset_hero(Vector2i(int(start[0]), int(start[1])))
	var before: Dictionary = await _drive_cells("dynamic baseline passage", baseline.cells)
	if bool(before.get("ok", false)):
		await _drive_cells("dynamic baseline physical return", baseline.return_cells)
	var cell := Vector2i(int(descriptor.cell[0]), int(descriptor.cell[1]))
	var applied: Dictionary = stream.apply_structure(cell, String(descriptor.layer), int(descriptor.value),
		int(descriptor.expected_base), int(descriptor.revision), String(descriptor.structure_id))
	_expect(bool(applied.get("ok", false)) and int(stream.resolved_walk(cell)) == 0, "visible structure applies walk 1->0 with expected base")
	var stale: Dictionary = stream.apply_structure(cell, String(descriptor.layer), int(descriptor.value),
		int(descriptor.expected_base), 0, "fixture:stale_palisade")
	_expect(not bool(stale.get("ok", false)) and String(stale.get("error", "")) == "STALE_REVISION", "stale dynamic revision refused")
	var index := int(descriptor.baseline_cell_index)
	var previous: Array = baseline.cells[index - 1]
	await _drive_expected_block(Vector2i(int(previous[0]), int(previous[1])), cell)
	var saved_descriptor := descriptor.duplicate(true)
	_rebuild_stream(saved_descriptor)
	_reset_hero(Vector2i(int(start[0]), int(start[1])))
	_expect(int(stream.resolved_walk(cell)) == 0 and bool(stream.has_visible_structure(String(descriptor.structure_id))),
		"reloaded stream retains visible structure and collision")
	await _capture("dynamic_reloaded_palisade", false)
	var after: Dictionary = await _drive_cells("reloaded dynamic detour", detour.cells)
	if bool(after.get("ok", false)):
		await _drive_cells("reloaded dynamic detour physical return", detour.return_cells)
	dynamic_results = {"structure_id": String(descriptor.structure_id), "cell": descriptor.cell,
		"baseline_ok": bool(before.get("ok", false)), "detour_ok": bool(after.get("ok", false)),
		"expected_block_contacts": expected_block_contacts, "reload_generation": stream_generation,
		"save_service_used": false, "paid_construction_approved": false, "production_persistence": "NOT_TESTED"}


func _run_hazards() -> void:
	current_phase = "hazard_preparation_and_J06"
	for raw: Variant in (inputs.hazard_probes as Array):
		var probe := raw as Dictionary
		var safe: Array = probe.safe_cell
		var inside: Array = probe.inside_cell
		_reset_hero(Vector2i(int(safe[0]), int(safe[1])))
		var forward: Dictionary = await _drive_cells("warned hazard approach " + String(probe.hazard_id), probe.forward_cells)
		var profile: Dictionary = reader.traversal_profile(Vector2i(int(inside[0]), int(inside[1])))
		var prepared := String(profile.get("hazard_required_capability", "")) == String(probe.required_capability) \
			and not String(profile.get("hazard_clue", "")).is_empty() and String(profile.get("damage_application", "")) == "A0_NOT_APPLIED"
		var returned: Dictionary = {"ok": false}
		if bool(forward.get("ok", false)):
			returned = await _drive_cells("hazard physical retreat " + String(probe.hazard_id), probe.return_cells)
		_expect(prepared and bool(returned.get("ok", false)) and hero.health == 100, "hazard clue/capability/retreat without invented damage " + String(probe.hazard_id))
		hazard_results.append({"hazard_id": String(probe.hazard_id), "required_capability": String(probe.required_capability),
			"clue": String(probe.clue), "forward_ok": bool(forward.get("ok", false)), "retreat_ok": bool(returned.get("ok", false)),
			"health_after": hero.health, "damage_applied": false, "A6_presentation_approved": false})


func _capture(name: String, all_resolutions: bool, metadata: Dictionary = {}) -> void:
	RenderingServer.render_loop_enabled = true
	var selected: Array[Vector2i] = resolutions if all_resolutions else [Vector2i(1280, 720)]
	for resolution: Vector2i in selected:
		var capture_started := Time.get_ticks_msec()
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
			var colors: Dictionary = {}
			var minimum := 1.0
			var maximum := 0.0
			for y: int in range(1, 9):
				for x: int in range(1, 17):
					var color := image.get_pixel(mini(image.get_width() - 1, image.get_width() * x / 17), mini(image.get_height() - 1, image.get_height() * y / 9))
					var luminance := color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
					minimum = minf(minimum, luminance)
					maximum = maxf(maximum, luminance)
					colors[color.to_rgba32()] = true
			screenshots.append(path)
			var chunks: Dictionary = {}
			for cid: String in (stream.loaded_chunks as Dictionary):
				chunks[cid] = String((stream.loaded_chunks[cid] as Dictionary).source_sha256)
			var row := {"path": path, "resolution": [resolution.x, resolution.y], "sha256": FileAccess.get_sha256(path),
				"hero_foot": [hero.global_position.x, hero.global_position.y], "camera": [camera.global_position.x, camera.global_position.y],
				"phase": current_phase, "time_of_day": current_time_of_day, "region_id": current_region_id,
				"live_source_chunk_hashes": chunks, "sample_unique_colors": colors.size(), "sample_luminance_range": maximum - minimum,
				"capture_wall_ms": Time.get_ticks_msec() - capture_started,
				"production_frame": false, "visual_acceptance": "NOT_TESTED"}
			for key: String in metadata:
				row[key] = metadata[key]
			capture_rows.append(row)
			_expect(colors.size() > 8 and maximum - minimum > 0.03, "nonblank native source capture " + filename)
		else:
			_expect(false, "native source capture " + filename)
	root.size = Vector2i(1280, 720)
	camera.force_update_scroll()
	await process_frame
	await process_frame
	RenderingServer.render_loop_enabled = false


func _run_budget_probe() -> void:
	current_phase = "measured_budget_probe_not_full_fixture"
	var selected: Dictionary = {}
	for raw: Variant in (inputs.spawn_safety.cases as Array):
		if bool((raw as Dictionary).native_drive):
			selected = raw
			break
	_expect(not selected.is_empty(), "budget probe has a nontrivial physical spawn route")
	if selected.is_empty():
		abort = true
		return
	var cell := Vector2i(int(selected.spawn_cell[0]), int(selected.spawn_cell[1]))
	_reset_hero(cell)
	await _drive_cells("budget probe forward", selected.forward_cells)
	await _drive_cells("budget probe return", selected.return_cells)
	var view: Dictionary = {}
	for raw: Variant in (inputs.visual_views as Array):
		if String((raw as Dictionary).view_id) == "ember_forge_day":
			view = raw
			break
	_expect(not view.is_empty(), "budget probe has a late-region live-stream preparation")
	if view.is_empty():
		abort = true
		return
	var prepare_started := Time.get_ticks_msec()
	var stand: Array = view.stand_cell
	current_time_of_day = float(view.time_of_day)
	_reset_hero(Vector2i(int(stand[0]), int(stand[1])))
	stream.set_time_of_day(current_time_of_day, String(view.region_id))
	await physics_frame
	await physics_frame
	prepare_measurements.append({"view_id": String(view.view_id), "wall_ms": Time.get_ticks_msec() - prepare_started})
	await _capture("budget_probe", true, {"budget_probe": true, "view_id": String(view.view_id)})
	_expect(not budget_probe or site_arrivals.is_empty(), "budget probe is not misreported as full native fixture")


func _run_visual_matrix() -> void:
	current_phase = "live_stream_visual_matrix"
	_rebuild_stream()
	var seen_regions: Dictionary = {}
	for raw: Variant in (inputs.visual_views as Array):
		var view := raw as Dictionary
		var stand: Array = view.stand_cell
		var prepare_started := Time.get_ticks_msec()
		current_time_of_day = float(view.time_of_day)
		_reset_hero(Vector2i(int(stand[0]), int(stand[1])))
		stream.set_time_of_day(current_time_of_day, String(view.region_id))
		await physics_frame
		await physics_frame
		prepare_measurements.append({"view_id": String(view.view_id), "wall_ms": Time.get_ticks_msec() - prepare_started})
		await _capture("continent_" + String(view.view_id), bool(view.full_resolution),
			{"view_id": String(view.view_id), "center_cell": view.center_cell, "stand_cell": stand,
				"stand_is_safe_spawn": bool(view.stand_is_safe_spawn), "hazard_preparation_required": view.hazard_preparation_required,
				"treatment_source": String(view.treatment_source), "pair_of": String(view.get("pair_of", "")),
				"render_source": String(view.render_source)})
		seen_regions[String(view.region_id)] = true
	_expect(seen_regions.size() == 11 and capture_rows.size() >= 59, "live full-stream captures cover all 11 regions and three resolutions")
	var by_view: Dictionary = {}
	for row: Variant in capture_rows:
		by_view[String((row as Dictionary).get("view_id", ""))] = row
	for raw: Variant in (inputs.visual_views as Array):
		var view := raw as Dictionary
		var pair_of := String(view.get("pair_of", ""))
		if pair_of.is_empty():
			continue
		var night: Dictionary = by_view.get(String(view.view_id), {})
		var day: Dictionary = by_view.get(pair_of, {})
		_expect(not night.is_empty() and not day.is_empty() and String(night.sha256) != String(day.sha256),
			"same-view day/night pixels differ " + pair_of)
	current_time_of_day = 0.35


func _journey_report() -> Dictionary:
	return {
		"J01": {"scope": "36 broad safe source spawns; 12 physical road returns; nearby source identities; no inventory", "native_cases": spawn_results.size()},
		"J03": {"scope": "PLANNING_ONLY home/outpost distance, effort and source opportunity; no A0 activation or proven player value", "rows": inputs.logistics},
		"J04": {"scope": "PHYSICAL outer approaches and home return; knife/combat/interior/economy not evaluated", "site_arrivals": site_arrivals, "salvage": salvage_arrival},
		"J06": {"scope": "PHYSICAL warned hazard entry/retreat and asynchronous fields; no damage/mitigation/A6 approval", "rows": hazard_results},
		"J07": {"scope": "THREE COMPILED ALTERNATIVES PER A8 SITE; primary/reload driven, not every alternative physically driven", "routes": inputs.route_alternatives},
		"J12": {"scope": "VISIBLE RUN-LOCAL DESCRIPTOR RELOAD AND DETOUR ONLY; 336h production reset/Ragnarok NOT_TESTED", "dynamic": dynamic_results},
	}


func _finish() -> void:
	_set_direction(Vector2.ZERO)
	_harvest_stream()
	var report := {
		"schema": "soh.world.a1_round12_native_report.v1", "ok": failures.is_empty() and not abort,
		"budget_probe": budget_probe, "checks": checks, "failures": failures, "abort": abort,
		"source_contract_sha256": String(inputs.get("source_contract_sha256", "")),
		"world_plan_sha256": String(inputs.get("world_plan_sha256", "")),
		"godot_version": Engine.get_version_info(),
		"source_report": reader.source_report() if reader != null else {},
		"source_hash_manifest": inputs.get("source_manifest", {}),
		"runtime_script_hashes": {
			"reader": FileAccess.get_sha256("res://game/survival/world/a1_authored_world_reader.gd"),
			"stream": FileAccess.get_sha256("res://game/survival/world/a1_authored_world_stream.gd"),
			"native_driver": FileAccess.get_sha256("res://tests/survival/world/round12_deep_world_native_test.gd"),
		},
		"spawn_results": spawn_results, "journeys": journey_trace, "prepare_measurements": prepare_measurements,
		"journey_evaluation": _journey_report(),
		"site_arrivals": site_arrivals, "locked_poi_discoveries": discovery_log, "roadside_salvage": salvage_arrival,
		"hazards": hazard_results, "dynamic": dynamic_results, "stream_events": stream_events,
		"stream_performance": stream_performance, "region_transitions": region_transitions,
		"chunk_transitions": chunk_transitions, "field_transitions": field_transitions,
		"captures": capture_rows, "screenshots": screenshots,
		"unexpected_contacts": unexpected_contacts, "stream_violations": stream_violations,
		"teleport_violations": teleport_violations, "max_hero_step_px": max_hero_step, "max_camera_step_px": max_camera_step,
		"independent_fixture_resets": independent_resets, "elapsed_seconds": float(Time.get_ticks_msec() - started_ticks) / 1000.0,
		"reward_items_granted": 0, "save_mutation": false, "health_damage_applied": false,
		"production_native_playable": false, "production_world_traversable": false,
		"production_A8_scene_mounted": false, "production_A8_interior_entered": false,
		"production_online_offline_save_tested": false, "production_336h_reset_tested": false,
		"production_Ragnarok_projection_tested": false, "A6_warning_presentation_approved": false,
		"A7_player_preference_or_final_movement_approved": false, "A3_economy_approved": false,
		"dispositions": {
			"SOURCE_READY": "PASS" if reader != null and bool(reader.source_report().ok) else "FAIL",
			"NATIVE_FIXTURE_PASS": "NOT_TESTED" if budget_probe else ("PASS" if failures.is_empty() and not abort else "FAIL"),
			"PRODUCTION_MOUNTED": "NOT_TESTED", "PLAYER_PLAYABLE": "NOT_TESTED", "VISUALLY_ACCEPTED": "NOT_TESTED",
		},
		"scope": "ISOLATED_NATIVE_FULL_CONTINENT_SOURCE_STREAM_REAL_HERO_AND_EXACT_SOURCE_BODIES_NOT_PRODUCTION",
	}
	var file := FileAccess.open(_out("round12_native_report.json"), FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "  "))
		file.close()
	print("A1_R12 SUMMARY checks=%d failures=%d captures=%d spawns=%d journeys=%d stream_events=%d seconds=%.1f" % [checks, failures.size(), capture_rows.size(), spawn_results.size(), journey_trace.size(), stream_events.size(), float(Time.get_ticks_msec() - started_ticks) / 1000.0])
	if failures.is_empty() and not abort:
		if budget_probe:
			print("A1 ROUND12 BUDGET PROBE PASSED - not a full native fixture")
		else:
			print("A1 ROUND12 NATIVE FIXTURE PASSED - isolated source/stream evidence only; production and visual acceptance remain separate")
		quit(0)
	else:
		print("A1 ROUND12 NATIVE FIXTURE FAILED")
		quit(1)


func _run() -> void:
	started_ticks = Time.get_ticks_msec()
	DirAccess.make_dir_recursive_absolute(_out(""))
	root.content_scale_size = LOGICAL
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.snap_2d_transforms_to_pixel = true
	root.snap_2d_vertices_to_pixel = true
	root.size = Vector2i(1280, 720)
	inputs = _json(inputs_path)
	_verify_sources()
	if abort:
		_finish()
		return
	_build_host()
	await physics_frame
	await physics_frame
	RenderingServer.render_loop_enabled = false
	await _run_reader_checks()
	if budget_probe and not abort:
		await _run_budget_probe()
		_finish()
		return
	if not abort:
		await _run_spawn_matrix()
	if not abort:
		await _run_primary_journey()
	if not abort:
		await _run_dynamic_reload()
	if not abort:
		await _run_hazards()
	if not abort:
		await _run_visual_matrix()
	_expect(stream_violations.is_empty(), "bounded stream never drains or misses the Hero source chunk")
	_expect(unexpected_contacts.is_empty(), "valid driven routes have no unexpected physical contacts")
	_expect(teleport_violations.is_empty() and max_hero_step <= 20.0, "no within-route teleports")
	_expect(site_arrivals.size() >= 2 and not salvage_arrival.is_empty(), "at least two exact A8 POIs plus ordinary roadside salvage physically reached")
	_expect(dynamic_results.get("reload_generation", 0) >= 1, "dynamic run-local reload executed")
	_finish()
