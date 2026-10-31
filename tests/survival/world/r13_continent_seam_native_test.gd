extends SceneTree
## R13 isolated composed-owner seam evidence. The consumer sample creates the
## production-callable A1 façade; real A8 scenes own their visuals/collision and
## the real A0/A6 scene owns movement and D051 presentation. Only independent
## test setup resets write coordinates. Every journey uses Input actions and the
## controller's move_and_slide(). This is not an A0 production mount or human,
## visual, interior, loot, save or D051-art acceptance gate.

const CONTINENT := preload("res://game/survival/world/a1_continent_interface.gd")
const CONSUMER := preload("res://game/survival/world/a1_continent_consumer_sample.gd")
const MOVE_ACTIONS: Array[String] = ["move_left", "move_right", "move_up", "move_down"]
const LOGICAL := Vector2i(640, 360)
const RESOLUTIONS: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(2560, 1440), Vector2i(3840, 2160)]
const BLOCKED_CELL := Vector2i(82, 405)
const BLOCKED_APPROACH := Vector2i(83, 405)

var failures: Array[String] = []
var checks := 0
var abort := false
var out_root := "artifacts/a1-r13-continent-seam"
var require_d051_art := false
var continent: A1ContinentInterface
var host: Node2D
var site_root: Node2D
var hero: CharacterBody2D
var camera: Camera2D
var shells: Dictionary = {}
var avatar_state: Dictionary = {}
var identity_selection: Dictionary = {"attempted": false}
var motion_tracking := false
var suppress_stale_slide_frame := false
var contact_mode := "journey"
var expected_block_contacts := 0
var physics_serial := 0
var independent_resets := 0
var last_position := Vector2.ZERO
var max_step := 0.0
var teleport_violations: Array[String] = []
var stream_violations: Array[String] = []
var unexpected_contacts: Array[Dictionary] = []
var journeys: Array[Dictionary] = []
var site_arrivals: Array[Dictionary] = []
var spawn_results: Array[Dictionary] = []
var negative_controls: Array[Dictionary] = []
var captures: Array[Dictionary] = []
var chunk_transitions: Array[Dictionary] = []
var region_transitions: Array[Dictionary] = []
var current_chunk_id := ""
var current_region_id := ""
var current_world_id := ""
var current_time_of_day := 0.35
var current_drive_label := ""
var started_ticks := 0
var consumer_sample_used := false
var initial_spawn: Dictionary = {}
var first_hour_route: Dictionary = {}


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--out-root="):
			out_root = arg.trim_prefix("--out-root=")
		elif arg == "--require-d051-art":
			require_d051_art = true
	physics_frame.connect(_on_physics_frame)
	call_deferred("_run")


func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("A1_R13 PASS: " + label)
	else:
		failures.append(label)
		print("A1_R13 FAIL: " + label)


func _json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


func _write_json(path: String, value: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value, "  "))
	file.close()
	return true


func _out(name: String) -> String:
	return ProjectSettings.globalize_path(out_root.path_join(name))


func _vec(value: Array) -> Vector2:
	return Vector2(float(value[0]), float(value[1]))


func _cell(value: Array) -> Vector2i:
	return Vector2i(int(value[0]), int(value[1]))


func _foot(cell: Vector2i) -> Vector2:
	var mapped: Dictionary = continent.cell_to_world(cell)
	return mapped.get("world_px", Vector2.INF)


func _camera_rect() -> Rect2:
	return Rect2(hero.global_position - Vector2(320, 180), Vector2(640, 360))


func _record_negative(case_id: String, refused: bool, actual: String, expected: String, extra: Dictionary = {}) -> void:
	var row := {"id": case_id, "refused": refused, "actual": actual, "expected": expected, "pass": refused and actual == expected}
	for key: String in extra:
		row[key] = extra[key]
	negative_controls.append(row)
	_expect(bool(row.pass), "negative %s -> %s (actual %s)" % [case_id, expected, actual])


func _verify_bootstrap() -> void:
	var bootstrap := root.get_node_or_null("InputBootstrap")
	_expect(bootstrap != null, "InputBootstrap autoload initialized before input/body diagnosis")
	if bootstrap == null:
		abort = true
		return
	var missing: Array[String] = []
	for action: String in MOVE_ACTIONS + ["interact"]:
		if not InputMap.has_action(action):
			missing.append(action)
	_expect(missing.is_empty(), "InputBootstrap installed movement and interaction actions before actor construction")
	if not missing.is_empty():
		abort = true


func _select_isolated_identity() -> void:
	if not require_d051_art:
		return
	var save := root.get_node_or_null("SaveService")
	identity_selection = {"attempted": true, "gender": "male", "source": "r13_isolated_native", "production_profile": false}
	if save == null or not save.has_method("set_player_avatar") or not save.has_method("get_player_appearance_projection"):
		identity_selection["ok"] = false
		_expect(false, "composed A0 SaveService exposes the real D051 owner projection")
		abort = true
		return
	var accepted: bool = save.call("set_player_avatar", "male", "r13_isolated_native")
	identity_selection["ok"] = accepted
	identity_selection["projection"] = save.call("get_player_appearance_projection")
	_expect(accepted and String((identity_selection.projection as Dictionary).get("gender", "")) == "male",
		"real A0 owner projection selects canonical male D051 in isolated user profile")
	if not accepted:
		abort = true


func _build_host() -> void:
	host = Node2D.new()
	host.name = "R13IsolatedComposedContinent"
	root.add_child(host)
	var opened: Dictionary = CONSUMER.create(host)
	consumer_sample_used = true
	_expect(bool(opened.get("ok", false)), "executable consumer sample configures without fixture inputs: " + String(opened.get("error", "")))
	if not bool(opened.get("ok", false)):
		abort = true
		return
	continent = opened.continent as A1ContinentInterface
	site_root = Node2D.new()
	site_root.name = "RealA8OverworldShells"
	host.add_child(site_root)
	_mount_real_a8_shells()
	_spawn_hero()
	continent.stream.bind_focus(hero)


func _mount_real_a8_shells() -> void:
	for key: String in ["quarry", "orchard", "mill"]:
		var descriptor: Dictionary = CONSUMER.a8_shell_descriptor(continent, key)
		_expect(bool(descriptor.get("ok", false)), "public manifest supplies A8 descriptor " + key)
		if not bool(descriptor.get("ok", false)):
			abort = true
			continue
		var shell_spec: Dictionary = descriptor.shell
		var scene_path := String(shell_spec.scene)
		var packed := load(scene_path) as PackedScene
		_expect(packed != null, "real A8 overworld scene loads " + key)
		if packed == null:
			abort = true
			continue
		var shell := packed.instantiate() as Node2D
		shell.name = "RealA8_" + key
		shell.position = _vec(shell_spec.origin_world_px)
		site_root.add_child(shell)
		shells[key] = shell
		var identity: Dictionary = descriptor.instance_identity
		_expect(shell.has_method("get_source_id") and String(shell.call("get_source_id")) == String(identity.poi_id)
			and _cell(descriptor.canonical_cell) == shell.call("get_canonical_cell"), "A8 scene and manifest identities match " + key)
		var bodies := 0
		for child: Node in shell.get_children():
			if child is StaticBody2D:
				bodies += 1
		_expect(bodies == (descriptor.collision.exclusions as Array).size(),
			"real A8 bodies equal descriptive exclusions without duplication " + key)
		var door: Dictionary = descriptor.door_target
		_expect(shell.global_position + shell.call("get_entry_position") == _vec(door.world_px),
			"real A8 entry transform equals public door target " + key)


func _spawn_hero() -> void:
	var scene_path := String(continent.manifest.runtime.player_scene)
	var packed := load(scene_path) as PackedScene
	_expect(packed != null, "actual composed player scene loads after InputBootstrap")
	if packed == null:
		abort = true
		return
	hero = packed.instantiate() as CharacterBody2D
	_expect(hero != null, "actual composed player is a physics CharacterBody2D")
	if hero == null:
		abort = true
		return
	hero.name = "RealComposedD051PhysicalController"
	host.add_child(hero)
	camera = hero.get_node("Camera") as Camera2D
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = 16384
	camera.limit_bottom = 12288
	camera.make_current()
	var shape := hero.get_node("BodyShape") as CollisionShape2D
	var rectangle := shape.shape as RectangleShape2D
	_expect(rectangle != null and rectangle.size == Vector2(12, 16) and shape.position == Vector2(0, -8),
		"real D051 physical body remains 12x16 at (0,-8)")
	_expect(hero.motion_mode == CharacterBody2D.MOTION_MODE_FLOATING and hero.collision_layer == 2 and hero.collision_mask == 5,
		"real composed controller collision interface")
	_expect(camera.zoom == Vector2.ONE and camera.position == Vector2(0, -8), "actual 1x player camera contract")
	var presenter := hero.get_node_or_null("AvatarPresenter")
	_expect(presenter != null, "actual composed A6 D051 presenter is attached to the physical controller")
	if presenter != null and presenter.has_method("get_presentation_state"):
		avatar_state = presenter.call("get_presentation_state")
		if require_d051_art:
			_expect(bool(avatar_state.get("ready", false)) and String(avatar_state.get("gender", "")) == "male"
				and bool(avatar_state.get("has_avatar_sprite", false)), "canonical D051 avatar is active; visual acceptance remains separate")


func _reset_actor(cell: Vector2i) -> void:
	motion_tracking = false
	independent_resets += 1
	_release_input()
	hero.global_position = _foot(cell)
	hero.velocity = Vector2.ZERO
	suppress_stale_slide_frame = true
	camera.reset_smoothing()
	camera.force_update_scroll()
	_sync_stream(false)
	_reset_identity_tracking()
	motion_tracking = true


func _reset_identity_tracking() -> void:
	last_position = hero.global_position
	var sample: Dictionary = continent.sample_world(hero.global_position)
	current_chunk_id = String(sample.get("chunk_id", ""))
	current_region_id = String(sample.get("region_id", ""))
	current_world_id = String(sample.get("world_id", ""))


func _sync_stream(record_transition: bool = true) -> void:
	if hero == null or continent == null:
		return
	var result: Dictionary = CONSUMER.sync_actor(continent, hero, _camera_rect())
	if not bool(result.get("ok", false)):
		stream_violations.append(String(result.get("error", "stream update failed")))
		return
	var sample: Dictionary = continent.sample_world(hero.global_position)
	if not bool(sample.get("ok", false)):
		stream_violations.append("actor left authored world identity")
		return
	var cid := String(sample.chunk_id)
	if not continent.active_chunk_ids().has(cid):
		stream_violations.append("actor chunk not acquired " + cid)
	if cid != current_chunk_id:
		if record_transition and not current_chunk_id.is_empty():
			chunk_transitions.append({"frame": physics_serial, "from": current_chunk_id, "to": cid,
				"world_id": String(sample.world_id), "cell": sample.cell_array})
		current_chunk_id = cid
	var region := String(sample.region_id)
	if region != current_region_id:
		if record_transition and not current_region_id.is_empty():
			var previous: Dictionary = continent.sample_world(last_position)
			region_transitions.append({"frame": physics_serial, "from": current_region_id, "to": region,
				"world_id": String(sample.world_id), "from_world_id": current_world_id, "cell": sample.cell_array,
				"from_biome_id": String(previous.get("biome_id", "")), "to_biome_id": String(sample.biome_id),
				"from_surface_id": String(previous.get("surface_id", "")), "to_surface_id": String(sample.surface_id)})
		current_region_id = region
		continent.set_time_of_day(current_time_of_day, current_region_id)
	current_world_id = String(sample.world_id)


func _on_physics_frame() -> void:
	if not motion_tracking or hero == null or not is_instance_valid(hero):
		return
	physics_serial += 1
	_sync_stream()
	var delta := hero.global_position.distance_to(last_position)
	max_step = maxf(max_step, delta)
	if delta > 20.0:
		teleport_violations.append("frame %d displacement %.3f during %s" % [physics_serial, delta, current_drive_label])
	var record_contacts := not suppress_stale_slide_frame
	suppress_stale_slide_frame = false
	if record_contacts and contact_mode == "journey":
		for index: int in range(hero.get_slide_collision_count()):
			var collision := hero.get_slide_collision(index)
			var collider: Object = collision.get_collider()
			unexpected_contacts.append({"frame": physics_serial, "drive": current_drive_label,
				"foot": [hero.global_position.x, hero.global_position.y],
				"collider": String((collider as Node).name) if collider is Node else ""})
	elif record_contacts and contact_mode == "expected_block" and hero.get_slide_collision_count() > 0:
		expected_block_contacts += 1
	last_position = hero.global_position


func _release_input() -> void:
	for action: String in MOVE_ACTIONS:
		Input.action_release(action)


func _set_direction(delta: Vector2) -> void:
	_release_input()
	if delta.is_zero_approx():
		return
	var distance := delta.length()
	var direction := delta / distance
	var base_speed := maxf(1.0, float(hero.move_speed))
	var acceleration := maxf(1.0, float(hero.acceleration))
	var braking_speed := sqrt(2.0 * acceleration * 0.8 * maxf(0.0, distance - 0.5))
	var strength := clampf(clampf(braking_speed, 0.0, base_speed) / base_speed, 0.0, 1.0)
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


func _hits_at(cell: Vector2i) -> Array[Dictionary]:
	return _hits_point(_foot(cell))


func _hits_point(point: Vector2) -> Array[Dictionary]:
	if hero == null:
		return []
	var body_shape := hero.get_node("BodyShape") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_shape.shape
	query.transform = Transform2D(0.0, point + body_shape.position)
	query.collision_mask = hero.collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [hero.get_rid()]
	return hero.get_world_2d().direct_space_state.intersect_shape(query, 16)


func _drive_point(label: String, target: Vector2, check_contacts: bool = true) -> Dictionary:
	RenderingServer.render_loop_enabled = false
	current_drive_label = label
	contact_mode = "journey" if check_contacts else "expected_block"
	var start := hero.global_position
	var previous := start
	var start_frame := physics_serial
	var started := Time.get_ticks_msec()
	var travelled := 0.0
	var deadline := physics_serial + 240
	var completed := false
	while physics_serial < deadline and not abort:
		var distance := hero.global_position.distance_to(target)
		if distance <= 0.65 and hero.velocity.length() <= 6.0:
			completed = true
			break
		_set_direction(Vector2.ZERO if distance <= 0.65 else target - hero.global_position)
		await physics_frame
		travelled += previous.distance_to(hero.global_position)
		previous = hero.global_position
	_release_input()
	for _i: int in range(6):
		await physics_frame
	var frames := physics_serial - start_frame
	var row := {"ok": completed and hero.global_position.distance_to(target) <= 4.5,
		"label": label, "frames": frames, "wall_ms": Time.get_ticks_msec() - started,
		"travelled_px": travelled, "start_foot": [start.x, start.y],
		"end_foot": [hero.global_position.x, hero.global_position.y],
		"target_foot": [target.x, target.y], "input_driven": true,
		"position_writes": 0, "production_mount": false}
	journeys.append(row)
	_expect(bool(row.ok), label + " reached through real controller movement")
	return row


func _drive_cells(label: String, cells: Array[Vector2i]) -> Dictionary:
	if cells.is_empty():
		_expect(false, label + " has path cells")
		return {"ok": false}
	var first := _foot(cells[0])
	if hero.global_position.distance_to(first) > 20.0:
		_expect(false, label + " is continuous with current actor position")
		return {"ok": false}
	for cell: Vector2i in cells:
		var source: Dictionary = continent.sample_cell(cell)
		if not bool(source.get("ok", false)) or not bool(source.get("source_walkable", false)):
			_expect(false, label + " source walk preflight " + str(cell))
			return {"ok": false}
	var start_frame := physics_serial
	var started := Time.get_ticks_msec()
	var start := hero.global_position
	var total := 0.0
	for cell: Vector2i in cells:
		var mounted: Dictionary = continent.physics_sample_cell(cell)
		if bool(mounted.get("ok", false)) and not _hits_at(cell).is_empty():
			_expect(false, label + " acquired real body clearance preflight " + str(cell))
			return {"ok": false}
		if not bool(mounted.get("ok", false)) and String(mounted.get("error", "")) != "CHUNK_NOT_ACQUIRED":
			_expect(false, label + " mounted preflight error " + str(cell))
			return {"ok": false}
		var result: Dictionary = await _drive_point(label + " " + str(cell), _foot(cell))
		total += float(result.get("travelled_px", 0.0))
		if not bool(result.get("ok", false)):
			return result
		var arrived: Dictionary = continent.physics_sample_cell(cell)
		if not bool(arrived.get("ok", false)) or not _hits_at(cell).is_empty():
			_expect(false, label + " acquired real body clearance on arrival " + str(cell))
			return {"ok": false}
	var row := {"ok": true, "label": label, "cell_count": cells.size(),
		"frames": physics_serial - start_frame, "wall_ms": Time.get_ticks_msec() - started,
		"travelled_px": total, "start_foot": [start.x, start.y],
		"end_foot": [hero.global_position.x, hero.global_position.y],
		"input_driven": true, "position_writes": 0, "production_mount": false}
	journeys.append(row)
	_expect(true, "%s physical segment (%d cells)" % [label, cells.size()])
	return row


func _run_contract_checks() -> void:
	var report: Dictionary = continent.source_report()
	_expect(bool(report.ok) and bool(report.interface_ready) and int(report.verified_chunks) == 192,
		"R13 façade verifies the complete 192-chunk authored world")
	var visual: Dictionary = continent.stream.source_visual_summary()
	_expect(int(visual.get("real_asset_frames", 0)) >= 30 \
		and int(visual.get("continent_chunk_records", 0)) == 192 \
		and int(visual.get("continent_decor_props", 0)) >= 1000 \
		and int(visual.get("region_transition_visual_band_cells", 0)) == 3,
		"live stream binds real source-rect art and bounded continent decor")
	_expect(String(continent.manifest.world.world_id) == "world:soh_continent_v1"
		and continent.world_rect() == Rect2(0, 0, 16384, 12288), "stable canonical world identity and pixel bounds")
	for cell: Vector2i in [Vector2i(0, 0), Vector2i(63, 63), Vector2i(64, 64), Vector2i(1023, 767), Vector2i(30, 280)]:
		var center: Dictionary = continent.cell_to_world(cell, &"cell_center")
		var foot: Dictionary = continent.cell_to_world(cell)
		var inverse: Dictionary = continent.world_to_cell(foot.world_px)
		var chunk: Dictionary = continent.chunk_for_cell(cell)
		_expect(bool(center.ok) and bool(inverse.ok) and inverse.cell == cell and bool(chunk.ok)
			and not String(chunk.source_sha256).is_empty(), "cell/foot/chunk/source round trip " + str(cell))
	var boundary: Dictionary = continent.chunk_for_cell(Vector2i(64, 64))
	_expect(String(boundary.chunk_id) == "chunk:1:1" and boundary.origin_cell == Vector2i(64, 64),
		"64-cell chunk boundary uses floor identity without rounding drift")
	var negative_point: Dictionary = continent.world_to_cell(Vector2(-0.125, 0))
	_record_negative("negative_coordinates", not bool(negative_point.get("ok", false)), String(negative_point.get("error", "")), "WORLD_BOUNDS")
	var negative_cell: Dictionary = continent.cell_to_world(Vector2i(-1, 0))
	_expect(not bool(negative_cell.get("ok", false)) and String(negative_cell.get("error", "")) == "CELL_BOUNDS",
		"negative cell cannot manufacture world pixels")
	var released: Dictionary = continent.release_chunks()
	var unloaded: Dictionary = continent.physics_sample_cell(Vector2i(30, 283))
	_record_negative("unloaded_cell", not bool(unloaded.get("ok", false)), String(unloaded.get("error", "")), "CHUNK_NOT_ACQUIRED",
		{"source_query_remained_valid": bool(continent.sample_cell(Vector2i(30, 283)).get("ok", false))})
	_expect(bool(released.ok) and int(released.active_count) == 0, "explicit chunk release drains every acquired chunk")
	var forbidden: Dictionary = continent.build_eligibility(Vector2i(30, 280), Callable(self, "_allow_build_probe"))
	_record_negative("forbidden_building", not bool(forbidden.get("ok", false)), String(forbidden.get("reason", "")), "a1_no_build_candidate")
	var unsafe: Dictionary = continent.validate_spawn_cell(Vector2i(30, 280))
	_record_negative("unsafe_spawn", not bool(unsafe.get("ok", false)), String(unsafe.get("error", "")), "SPAWN_CELL_UNSAFE")
	_run_source_mutation_negatives()


func _allow_build_probe() -> Dictionary:
	return {"ok": true}


func _run_source_mutation_negatives() -> void:
	var stale: Dictionary = continent.interface_manifest()
	var original_hash := String(stale.source_pins.world_plan.sha256)
	stale["source_pins"]["world_plan"]["sha256"] = ("0" if original_hash.substr(0, 1) != "0" else "1") + original_hash.substr(1)
	var stale_path := "user://r13_stale_continent_interface.json"
	_expect(_write_json(stale_path, stale), "stale source control fixture written outside source tree")
	var stale_probe := CONTINENT.new() as A1ContinentInterface
	root.add_child(stale_probe)
	var stale_ok := stale_probe.configure("res://data/survival/world", "", stale_path)
	_record_negative("stale_source_hash", not stale_ok, String(stale_probe.last_error), "interface_source_hash:world_plan")
	root.remove_child(stale_probe)
	stale_probe.queue_free()
	var bad_path := "user://r13_incompatible_player.tscn"
	_expect(_write_incompatible_player(bad_path), "incompatible body control derives from the actual player scene")
	var shape_probe := CONTINENT.new() as A1ContinentInterface
	root.add_child(shape_probe)
	var shape_ok := shape_probe.configure("res://data/survival/world", bad_path)
	_record_negative("incompatible_body_shape", not shape_ok, String(shape_probe.last_error), "reader:runtime_interface:PLAYER_BODY_SHAPE_SIZE")
	root.remove_child(shape_probe)
	shape_probe.queue_free()


func _write_incompatible_player(path: String) -> bool:
	var packed := load(String(continent.manifest.runtime.player_scene)) as PackedScene
	if packed == null:
		return false
	var bad := packed.instantiate() as CharacterBody2D
	if bad == null:
		return false
	var collision := bad.get_node_or_null("BodyShape") as CollisionShape2D
	if collision == null:
		bad.free()
		return false
	var rectangle := collision.shape.duplicate() as RectangleShape2D
	rectangle.size = Vector2(20, 16)
	collision.shape = rectangle
	var scene := PackedScene.new()
	var pack_error := scene.pack(bad)
	var save_error := ResourceSaver.save(scene, path) if pack_error == OK else ERR_CANT_CREATE
	bad.free()
	return pack_error == OK and save_error == OK


func _run_spawn_matrix() -> void:
	var unique: Dictionary = {}
	var chunks: Dictionary = {}
	var regions: Dictionary = {}
	for index: int in range(36):
		var seed := 1103 + index * 7919
		var chosen: Dictionary = CONSUMER.select_run_spawn(continent, seed)
		var repeat: Dictionary = continent.choose_safe_spawn(seed)
		var valid: bool = bool(chosen.get("ok", false)) and chosen.get("cell", Vector2i(-1, -1)) == repeat.get("cell", Vector2i(-2, -2))
		if valid:
			var cell: Vector2i = chosen.cell
			var sample: Dictionary = continent.sample_cell(cell)
			valid = bool(continent.validate_spawn_cell(cell).get("ok", false)) and bool(sample.source_walkable) \
				and String(sample.hazard_id).is_empty() and bool(chosen.get("indexed_candidate", false)) \
				and int(chosen.get("safe_basic_material_families_minimum", 0)) >= 2 \
				and int(chosen.get("opportunity_radius_cells", 0)) == 64 \
				and int(chosen.get("road_max_distance_cells", 0)) == 32 \
				and (chosen.region_entry_capabilities as Array).is_empty()
			unique[str(cell)] = true
			chunks[String(chosen.chunk_id)] = true
			regions[String(chosen.region_id)] = true
			spawn_results.append({"seed": seed, "cell": chosen.cell_array, "chunk_id": String(chosen.chunk_id),
				"region_id": String(chosen.region_id), "actor_origin_px": chosen.actor_origin_px_array,
				"minimum_material_families": int(chosen.safe_basic_material_families_minimum),
				"index_verified": bool(chosen.indexed_candidate), "deterministic": true})
		_expect(valid, "broad deterministic nonlethal spawn seed %d" % seed)
	_expect(unique.size() >= 30 and chunks.size() >= 12 and regions.size() >= 3,
		"36 seeds retain broad cell/chunk/regional variety through the public consumer")
	var selected: Dictionary = continent.choose_safe_spawn(1103)
	initial_spawn = {"seed": 1103, "cell": selected.get("cell_array", []),
		"chunk_id": String(selected.get("chunk_id", "")), "region_id": String(selected.get("region_id", "")),
		"actor_origin_px": selected.get("actor_origin_px_array", [])}
	_reset_actor(selected.cell)
	await physics_frame
	await physics_frame
	_expect(_hits_at(selected.cell).is_empty(), "selected initial spawn is clear for the actual composed body")


func _run_first_hour_route() -> void:
	const ROUTE_PATH := "res://data/survival/world/corridor/first_hour_route.v1.json"
	var route: Dictionary = _json(ROUTE_PATH)
	var outbound: Array = route.get("outbound_cells", [])
	var returning: Array = route.get("return_cells", [])
	_expect(String(route.get("route_id", "")) == "a1_corridor:crown_roadside_local_v1"
		and outbound.size() == 66 and returning.size() == 30,
		"committed first-hour corridor route loads without a fixture-only path")
	if outbound.size() != 66 or returning.size() != 30:
		abort = true
		return
	var start := _cell(route.start_cell)
	var layby := Vector2i(400, 220)
	var goal := _cell(route.goal_cell)
	_reset_actor(start)  # Labelled independent setup; the complete route below is input-driven.
	await physics_frame
	await physics_frame
	first_hour_route = {"route_id": String(route.route_id), "source_sha256": FileAccess.get_sha256(ROUTE_PATH),
		"start_cell": route.start_cell, "layby_cell": [layby.x, layby.y], "goal_cell": route.goal_cell,
		"outbound_cells": outbound.size(), "return_cells": returning.size(), "outbound_ok": false,
		"return_ok": false, "input_driven": true, "position_writes": 0}
	var to_layby: Array[Vector2i] = []
	for index: int in range(1, 35):
		to_layby.append(_cell(outbound[index]))
	var layby_result: Dictionary = await _drive_cells("first-hour postern to supply layby", to_layby)
	_expect(bool(layby_result.ok) and continent.world_to_cell(hero.global_position).get("cell", Vector2i(-1, -1)) == layby,
		"real controller reaches first-hour supply layby through the committed route")
	await _capture("first_hour_layby", 0.35, "")
	var to_waystation: Array[Vector2i] = []
	for index: int in range(35, outbound.size()):
		to_waystation.append(_cell(outbound[index]))
	var outbound_result: Dictionary = await _drive_cells("first-hour supply layby to Waystation", to_waystation)
	var outbound_ok: bool = bool(layby_result.ok) and bool(outbound_result.ok) \
		and continent.world_to_cell(hero.global_position).get("cell", Vector2i(-1, -1)) == goal
	first_hour_route["outbound_ok"] = outbound_ok
	_expect(outbound_ok, "real controller completes first-hour outbound route to the Waystation")
	await _capture("first_hour_waystation", 0.35, "")
	var back: Array[Vector2i] = []
	for index: int in range(1, returning.size()):
		back.append(_cell(returning[index]))
	var return_result: Dictionary = await _drive_cells("first-hour Waystation return to postern", back)
	var return_ok: bool = bool(return_result.ok) \
		and continent.world_to_cell(hero.global_position).get("cell", Vector2i(-1, -1)) == start
	first_hour_route["return_ok"] = return_ok
	first_hour_route["ok"] = outbound_ok and return_ok
	_expect(return_ok, "real controller returns from Waystation to the first-hour postern")


func _site_path(descriptor: Dictionary) -> Array[Vector2i]:
	var retreat := _cell(descriptor.retreat_target.cell)
	var approach := _cell(descriptor.physical_approach.cell)
	var path: Array[Vector2i] = []
	var steps := retreat.y - approach.y
	for offset: int in range(1, steps + 1):
		path.append(retreat + Vector2i(0, -offset))
	return path


func _run_site(key: String) -> void:
	var descriptor: Dictionary = continent.site(key)
	var shell := shells.get(key) as Node2D
	_expect(descriptor.get("ok", false) and shell != null, "real A8 site ready for physical journey " + key)
	if shell == null:
		abort = true
		return
	_reset_actor(_cell(descriptor.retreat_target.cell))
	await physics_frame
	await physics_frame
	var path := _site_path(descriptor)
	var forward: Dictionary = await _drive_cells(key + " retreat to approach", path)
	if not bool(forward.get("ok", false)):
		abort = true
		return
	var approach_point := _vec(descriptor.physical_approach.actor_origin_px)
	_expect(hero.global_position.distance_to(approach_point) <= 4.5 and _hits_point(approach_point).is_empty(),
		"actual A8 approach socket reached and body-clear " + key)
	var door: Dictionary = await _drive_point(key + " approach to physical door", _vec(descriptor.door_target.world_px))
	_expect(bool(door.ok) and not String(shell.call("get_context_hint", hero)).is_empty(),
		"actual A8 door socket reachable with inward facing " + key)
	if key in ["quarry", "orchard"]:
		await _capture(key + "_day", 0.35, key)
		await _capture(key + "_night", 0.82, key)
	var back: Array[Vector2i] = [_cell(descriptor.physical_approach.cell)]
	for index: int in range(path.size() - 1, -1, -1):
		var cell: Vector2i = path[index]
		if cell != _cell(descriptor.physical_approach.cell):
			back.append(cell)
	back.append(_cell(descriptor.retreat_target.cell))
	var returned: Dictionary = await _drive_cells(key + " door to approach and retreat", back)
	_expect(bool(returned.ok) and hero.global_position.distance_to(_vec(descriptor.retreat_target.actor_origin_px)) <= 4.5,
		"actual A8 approach journey physically returns to retreat " + key)
	site_arrivals.append({"site_key": key, "poi_id": String(descriptor.instance_identity.poi_id),
		"site_instance_id": String(descriptor.instance_identity.site_instance_id),
		"canonical_cell": descriptor.canonical_cell, "approach_cell": descriptor.physical_approach.cell,
		"door_target": descriptor.door_target.world_px, "retreat_cell": descriptor.retreat_target.cell,
		"approach_ok": bool(forward.ok), "door_ok": bool(door.ok), "return_ok": bool(returned.ok),
		"real_a8_scene": String(descriptor.shell.scene), "real_d051_controller": String(continent.manifest.runtime.player_scene),
		"interior_entered": false, "production_scene_mounted": false})


func _run_region_transition() -> void:
	var start := Vector2i(336, 383)
	_reset_actor(start)  # Labelled fixture reset; every subsequent crossing is input-driven.
	await physics_frame
	await physics_frame
	var before_region := current_region_id
	var before_chunk := current_chunk_id
	_expect(continent.world_to_cell(hero.global_position).get("cell", Vector2i(-1, -1)) == start,
		"region journey starts at body-clear Crown grass after a labelled independent reset")
	var cells: Array[Vector2i] = []
	for y: int in range(383, 392):
		cells.append(Vector2i(336, y))
	var result: Dictionary = await _drive_cells("Crown grass to Mirrormere marsh physical region/chunk transition", cells)
	var after: Dictionary = continent.sample_world(hero.global_position)
	_expect(bool(result.ok) and before_region == "r_ashen_crown" and String(after.region_id) == "r_mirrormere"
		and String(after.biome_id) == "freshwater_marsh" and String(after.surface_id) == "marsh"
		and before_chunk != String(after.chunk_id) and String(after.world_id) == "world:soh_continent_v1",
		"physical crossing changes region and chunk but never world identity")
	await _capture("region_transition", 0.35, "")
	var back: Array[Vector2i] = []
	for y: int in range(390, 382, -1):
		back.append(Vector2i(336, y))
	await _drive_cells("Mirrormere marsh to Crown grass physical return", back)


func _run_blocked_terrain_negative() -> void:
	_reset_actor(BLOCKED_APPROACH)
	await physics_frame
	await physics_frame
	var blocked: Dictionary = continent.physics_sample_cell(BLOCKED_CELL)
	_expect(bool(blocked.get("ok", false)) and not bool(blocked.get("source_walkable", true))
		and bool(blocked.get("source_static_blocked", false)) and bool(blocked.environment.is_river),
		"blocked control is real river terrain in an acquired chunk")
	_expect(not _hits_at(BLOCKED_CELL).is_empty(), "blocked control has real terrain collision")
	contact_mode = "expected_block"
	expected_block_contacts = 0
	current_drive_label = "expected river refusal"
	var deadline := physics_serial + 90
	while physics_serial < deadline:
		_set_direction(_foot(BLOCKED_CELL) - hero.global_position)
		await physics_frame
	_release_input()
	var settle := physics_serial + 45
	while physics_serial < settle and hero.velocity.length() > 0.1:
		await physics_frame
	await physics_frame
	var refused := expected_block_contacts > 0 and hero.global_position.distance_to(_foot(BLOCKED_CELL)) > 4.5
	_record_negative("blocked_terrain", refused, "PHYSICALLY_REFUSED" if refused else "PHYSICALLY_REACHED", "PHYSICALLY_REFUSED",
		{"contacts": expected_block_contacts, "cell": [BLOCKED_CELL.x, BLOCKED_CELL.y]})
	contact_mode = "expected_block_hold"


func _capture(view_id: String, time_of_day: float, site_key: String) -> void:
	RenderingServer.render_loop_enabled = true
	current_time_of_day = time_of_day
	continent.set_time_of_day(time_of_day, current_region_id)
	for resolution: Vector2i in RESOLUTIONS:
		var started := Time.get_ticks_msec()
		root.size = resolution
		camera.force_update_scroll()
		await process_frame
		await process_frame
		await process_frame
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var filename := "%s_%dx%d.png" % [view_id, resolution.x, resolution.y]
		var path := _out(filename)
		if image == null or image.get_size() != resolution or image.save_png(path) != OK:
			_expect(false, "native 1x capture " + filename)
			continue
		var colors: Dictionary = {}
		var minimum := 1.0
		var maximum := 0.0
		for y: int in range(1, 9):
			for x: int in range(1, 17):
				var color := image.get_pixel(mini(image.get_width() - 1, image.get_width() * x / 17), mini(image.get_height() - 1, image.get_height() * y / 9))
				var luminance: float = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
				minimum = minf(minimum, luminance)
				maximum = maxf(maximum, luminance)
				colors[color.to_rgba32()] = true
		var actor_sample: Dictionary = continent.sample_world(hero.global_position)
		var live_hashes: Dictionary = {}
		for cid: String in continent.active_chunk_ids():
			live_hashes[cid] = String((continent.stream.loaded_chunks[cid] as Dictionary).source_sha256)
		var row := {"view_id": view_id, "path": path, "resolution": [resolution.x, resolution.y],
			"sha256": FileAccess.get_sha256(path), "time_of_day": time_of_day,
			"camera_zoom": [camera.zoom.x, camera.zoom.y], "logical_viewport": [LOGICAL.x, LOGICAL.y],
			"render_scale": 1, "world_id": String(actor_sample.world_id), "region_id": String(actor_sample.region_id),
			"biome_id": String(actor_sample.biome_id), "surface_id": String(actor_sample.surface_id),
			"chunk_id": String(actor_sample.chunk_id), "actor_foot": [hero.global_position.x, hero.global_position.y],
			"site_key": site_key, "real_a8_scene": String((shells.get(site_key) as Node2D).scene_file_path) if shells.has(site_key) else "",
			"avatar": avatar_state.duplicate(true), "live_source_chunk_hashes": live_hashes,
			"source_visual": continent.stream.source_visual_summary(),
			"sample_unique_colors": colors.size(), "sample_luminance_range": maximum - minimum,
			"capture_wall_ms": Time.get_ticks_msec() - started,
			"production_frame": false, "visual_acceptance": "NOT_TESTED"}
		captures.append(row)
		_expect(colors.size() >= 3 and maximum - minimum > 0.03, "nonblank native 1x capture " + filename)
	root.size = Vector2i(1280, 720)
	camera.force_update_scroll()
	await process_frame
	await process_frame
	RenderingServer.render_loop_enabled = false


func _verify_capture_pairs() -> void:
	for key: String in ["quarry", "orchard"]:
		for resolution: Vector2i in RESOLUTIONS:
			var day := ""
			var night := ""
			var day_factor := -1.0
			var night_factor := -1.0
			for row: Variant in captures:
				var capture := row as Dictionary
				if capture.resolution != [resolution.x, resolution.y]:
					continue
				if String(capture.view_id) == key + "_day":
					day = String(capture.sha256)
					day_factor = float((capture.source_visual as Dictionary).get("night_factor", -1.0))
				elif String(capture.view_id) == key + "_night":
					night = String(capture.sha256)
					night_factor = float((capture.source_visual as Dictionary).get("night_factor", -1.0))
			_expect(not day.is_empty() and not night.is_empty() and day != night and day_factor != night_factor,
				"%s day/night source lighting and pixels differ at %dx%d" % [key, resolution.x, resolution.y])


func _finish() -> void:
	_release_input()
	var art_staged := bool(avatar_state.get("ready", false)) and bool(avatar_state.get("has_avatar_sprite", false))
	var report := {
		"schema": "soh.world.a1_r13_continent_seam_native_report.v1",
		"ok": failures.is_empty() and not abort, "checks": checks, "failures": failures, "abort": abort,
		"godot_version": Engine.get_version_info(), "input_bootstrap_initialized": root.get_node_or_null("InputBootstrap") != null,
		"consumer_sample_used": consumer_sample_used, "consumer_sample_path": "res://game/survival/world/a1_continent_consumer_sample.gd",
		"interface_manifest_sha256": FileAccess.get_sha256("res://data/survival/world/a1_continent_interface.v1.json"),
		"world_plan_sha256": FileAccess.get_sha256("res://data/survival/world/world_plan.v1.json"),
		"runtime_script_hashes": {
			"interface": FileAccess.get_sha256("res://game/survival/world/a1_continent_interface.gd"),
			"consumer_sample": FileAccess.get_sha256("res://game/survival/world/a1_continent_consumer_sample.gd"),
			"native_driver": FileAccess.get_sha256("res://tests/survival/world/r13_continent_seam_native_test.gd"),
			"player_scene": FileAccess.get_sha256("res://game/characters/knight/knight.tscn"),
			"player_script": FileAccess.get_sha256("res://game/characters/knight/knight.gd"),
		},
		"source_report": continent.source_report() if continent != null else {},
		"avatar": avatar_state, "identity_selection": identity_selection,
		"d051_art_required": require_d051_art,
		"d051_art_staged": art_staged,
		"spawn_results": spawn_results, "initial_spawn": initial_spawn, "first_hour_route": first_hour_route,
		"site_arrivals": site_arrivals, "journeys": journeys, "negative_controls": negative_controls,
		"captures": captures, "chunk_transitions": chunk_transitions, "region_transitions": region_transitions,
		"unexpected_contacts": unexpected_contacts, "stream_violations": stream_violations,
		"teleport_violations": teleport_violations, "max_hero_step_px": max_step,
		"independent_fixture_resets": independent_resets, "physics_frames": physics_serial,
		"elapsed_seconds": float(Time.get_ticks_msec() - started_ticks) / 1000.0,
		"travel_position_writes": 0, "reward_items_granted": 0,
		"isolated_test_profile_writes": ["player_avatar"] if bool(identity_selection.get("attempted", false)) else [],
		"production_save_mutation": false, "production_native_playable": false,
		"production_world_traversable": false, "production_A8_scene_mounted": false,
		"production_A8_interior_entered": false, "production_D051_visual_accepted": false,
		"dispositions": {
			"SOURCE_INTERFACE_READY": "PASS" if continent != null and continent.is_ready() else "FAIL",
			"COMPOSED_NATIVE_SEAM": "PASS" if failures.is_empty() and not abort else "FAIL",
			"PRODUCTION_MOUNTED": "NOT_TESTED", "PLAYER_PLAYABLE": "NOT_TESTED",
			"VISUALLY_ACCEPTED": "NOT_TESTED", "D051_VISUALLY_ACCEPTED": "NOT_TESTED",
			"D051_LICENSED_ART_STAGED": "PASS" if art_staged else "BLOCKED_SOURCE_TRANSPORT",
			"A8_INTERIOR_OR_LOOT_ACCEPTED": "NOT_TESTED",
		},
		"scope": "R13_ISOLATED_EXACT_OWNER_COMPOSITION_REAL_CONTROLLER_AND_A8_SHELLS_NOT_PRODUCTION",
	}
	_write_json(_out("r13_native_report.json"), report)
	print("A1_R13 SUMMARY checks=%d failures=%d captures=%d sites=%d negatives=%d journeys=%d seconds=%.1f" % [
		checks, failures.size(), captures.size(), site_arrivals.size(), negative_controls.size(), journeys.size(),
		float(Time.get_ticks_msec() - started_ticks) / 1000.0])
	if failures.is_empty() and not abort:
		print("A1 R13 CONTINENT SEAM NATIVE FIXTURE PASSED - production mounting and visual/human acceptance remain separate")
		quit(0)
	else:
		print("A1 R13 CONTINENT SEAM NATIVE FIXTURE FAILED")
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
	_verify_bootstrap()
	if abort:
		_finish()
		return
	_select_isolated_identity()
	if abort:
		_finish()
		return
	_build_host()
	if abort:
		_finish()
		return
	await physics_frame
	await physics_frame
	RenderingServer.render_loop_enabled = false
	_run_contract_checks()
	if not abort:
		await _run_spawn_matrix()
	if not abort:
		await _run_first_hour_route()
	for key: String in ["quarry", "mill", "orchard"]:
		if not abort:
			await _run_site(key)
	if not abort:
		await _run_region_transition()
	if not abort:
		await _run_blocked_terrain_negative()
	_verify_capture_pairs()
	_expect(bool(first_hour_route.get("ok", false)), "committed first-hour corridor outbound and return are physically complete")
	_expect(site_arrivals.size() >= 2, "at least two distinct real A8 approach/door/retreat journeys completed")
	_expect(not region_transitions.is_empty() and not chunk_transitions.is_empty(), "native region and chunk transitions executed")
	_expect(unexpected_contacts.is_empty(), "valid driven routes have no unexpected physical contacts")
	_expect(stream_violations.is_empty(), "actor source chunk remains acquired across every driven boundary")
	_expect(teleport_violations.is_empty() and max_step <= 20.0, "no within-journey coordinate mutation or teleport")
	_finish()
