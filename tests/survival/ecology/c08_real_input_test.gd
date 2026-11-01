extends "res://tests/survival_normal_input_gather_test.gd"
## LW1 C08 PLAYER-NATIVE gate on the retained Annex mechanics testbed.
## The home was paid for and built by ordinary input in c08_home_setup_test.gd;
## this process loads that real save. It never injects a trace, teleports the
## Hero, assigns an AI target, grants damage/loot, or edits the map.
##
## CASE A: zero valid trace + real home + player out of direct sight.
## CASE B/C: real input lures the existing Skeleton, retreats through the paid
## door, and observes trace knowledge / physical loss. Expiry uses the existing
## RunLifecycle test-clock boundary only after real movement created the traces.

const HOME_SAVE := "user://tests/lw1_c08_home.json"
const AUDIT := "user://tests/lw1_c08_audit.json"

var _world: Node
var _case := "a"
var _clock_boundary := false
var _keep := false


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 6)
	for arg: String in OS.get_cmdline_user_args():
		if arg == "--case-bc":
			_case = "bc"
		elif arg == "--keep-c08":
			_keep = true
	_clock_boundary = OS.get_cmdline_user_args().has("--survival-run-clock-test")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = HOME_SAVE
	ProjectSettings.set_setting("survival/a0_optional_threat", true)
	ProjectSettings.set_setting("survival/lw1_c08", true)
	if not bool(_save().call(&"configure_storage", save_path, true)):
		_expect(false, "real home save loads")
		_finish_c08()
		return
	await _boot()
	_world = _host.get_child(0) if _host != null and _host.get_child_count() > 0 else null
	_expect(_world != null, "production Annex boots with C08 enabled")
	if _world != null:
		if _case == "a":
			await _case_a()
		else:
			await _case_bc()
	_expect(_body_complete, "C08 case body ran to completion")
	_teardown()
	await process_frame
	_finish_c08()


func _finish_c08() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)
	var verdict := "PASSED" if failures.is_empty() else "FAILED"
	print("LW1 C08 REAL_INPUT CASE_%s %s - %d checks" % [_case.to_upper(), verdict, checks])
	if not _keep and FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	quit(0 if failures.is_empty() else 1)


func _store() -> Node:
	return _world.get(&"ecology") as Node


func _enemy() -> Node:
	for node: Node in get_nodes_in_group(&"enemies"):
		if is_instance_valid(node) and not node.is_queued_for_deletion() and node.has_method(&"ecology_enabled"):
			return node
	return null


func _structures() -> Dictionary:
	return _survival().call(&"structures") as Dictionary


func _home_door() -> Dictionary:
	for id: Variant in _structures().keys():
		var record: Dictionary = _structures()[id]
		if String(record.get("piece", "")) == "door_wood":
			var cell: Array = record.get("cell", [0, 0])
			return {"id": String(id), "cell": Vector2i(int(cell[0]), int(cell[1]))}
	return {}


func _has_real_home() -> bool:
	var walls := 0
	var door := false
	var bed := false
	for id: Variant in _structures().keys():
		var piece := String((_structures()[id] as Dictionary).get("piece", ""))
		if piece == "wall_wood":
			walls += 1
		elif piece == "door_wood":
			door = true
		elif piece == "bed_wood":
			bed = true
	return walls >= 4 and door and bed


func _capture(tag: String) -> void:
	await process_frame
	await process_frame
	var image := root.get_texture().get_image()
	var path := "user://tests/lw1_c08_%s_%s.png" % [_case, tag]
	image.save_png(ProjectSettings.globalize_path(path))
	print("LW1_C08_CAPTURE %s" % path)


func _log_state(tag: String, enemy: Node) -> void:
	var snap: Dictionary = enemy.call(&"ecology_snapshot") if enemy != null else {}
	var store := _store()
	var count := int(store.call(&"trace_count")) if store != null else -1
	print("LW1_C08_STATE tag=%s case=%s traces=%d enemy=%s" % [tag, _case, count, JSON.stringify(snap)])


func _case_a() -> void:
	_body_complete = false
	var store := _store()
	var enemy := _enemy()
	var hero: CharacterBody2D = _world.get(&"player")
	_expect(store != null and enemy != null and hero != null, "C08 store, real Skeleton and Hero are mounted")
	_expect(_has_real_home(), "a paid player-built home exists in the loaded save")
	if store == null or enemy == null or hero == null:
		_body_complete = true
		return
	_expect(int(store.call(&"trace_count")) == 0, "CASE A starts with zero valid trace")
	var mount: Dictionary = _world.get(&"threat_mount").call(&"snapshot")
	_expect(bool(mount.get("mounted", false)), "the existing optional threat mounted lawfully")
	var home := _home_door()
	_expect(not home.is_empty(), "the real home has a door")
	var saw_forbidden := false
	var start_pos: Vector2 = enemy.global_position
	for i in range(120):
		_set_direction(Vector2.ZERO)
		await physics_frame
		var snap: Dictionary = enemy.call(&"ecology_snapshot")
		var state := String(snap.get("state", ""))
		if state in ["CHASE", "FOLLOW_TRACE", "ATTACK", "INVESTIGATE"]:
			saw_forbidden = true
		if i % 30 == 0:
			_log_state("case_a_wait_%d" % i, enemy)
	_expect(not saw_forbidden, "CASE A monster never acquires player/home knowledge without evidence")
	_expect(int(store.call(&"trace_count")) == 0, "CASE A standing still creates no trace")
	var moved: float = enemy.global_position.distance_to(start_pos)
	print("LW1_C08_CASE_A enemy_moved_px=%.2f home_door=%s" % [moved, str(home.get("cell", Vector2i.ZERO))])
	await _capture("case_a")
	_body_complete = true


func _walk_until_chase(hero: CharacterBody2D, path: Array[Vector2i], enemy: Node) -> bool:
	for cell: Vector2i in path:
		var point := Vector2(cell.x * 16 + 8, cell.y * 16 + 15)
		var deadline := Time.get_ticks_msec() + 3500
		while hero.global_position.distance_to(point) > 4.5 and Time.get_ticks_msec() < deadline and not bool(hero.get(&"dead")):
			var snap: Dictionary = enemy.call(&"ecology_snapshot")
			if String(snap.get("state", "")) in ["CHASE", "ATTACK"]:
				_set_direction(Vector2.ZERO)
				return true
			_set_direction(point - hero.global_position)
			await physics_frame
		_set_direction(Vector2.ZERO)
		if bool(hero.get(&"dead")):
			return false
	return false


func _case_bc() -> void:
	_body_complete = false
	var store := _store()
	var enemy := _enemy()
	var hero: CharacterBody2D = _world.get(&"player")
	var nav := _world.get(&"traversability") as OverworldTraversability
	var build := _world.get(&"survival_build") as SurvivalBuildSystem
	_expect(store != null and enemy != null and hero != null and nav != null and build != null, "C08 seats are live")
	_expect(_has_real_home(), "CASE B/C uses the same paid player-built home")
	if store == null or enemy == null or hero == null or nav == null or build == null:
		_body_complete = true
		return
	var home := _home_door()
	_expect(not home.is_empty(), "home door exists")
	if home.is_empty():
		_body_complete = true
		return
	var door_cell: Vector2i = home["cell"]
	var mount: Dictionary = _world.get(&"threat_mount").call(&"snapshot")
	var site_arr: Array = mount.get("site_cell", [0, 0])
	var site := Vector2i(int(site_arr[0]), int(site_arr[1]))
	var target := site + Vector2i(3, 0)
	var path := _route(nav.cell_of(hero.global_position), target, nav, hero)
	_expect(not path.is_empty(), "ordinary input has a physical route toward the wild Skeleton")
	if path.is_empty():
		_body_complete = true
		return
	var aggro := await _walk_until_chase(hero, path, enemy)
	_log_state("after_approach", enemy)
	await _capture("approach")
	_expect(aggro, "real movement brings the Hero into the Skeleton's direct senses")
	if not aggro:
		_body_complete = true
		return
	# Retreat through the paid home. Every step is ordinary held input.
	var outside := door_cell + Vector2i(0, -1)
	var inside := door_cell + Vector2i(0, 2)
	var retreat := _route(nav.cell_of(hero.global_position), outside, nav, hero)
	var retreated := not retreat.is_empty() and await _walk_path(hero, retreat)
	_expect(retreated, "real input retreats to the home door")
	if not retreated:
		_body_complete = true
		return
	var inside_path: Array[Vector2i] = [inside]
	var entered := await _walk_path(hero, inside_path)
	_expect(entered, "real input enters the paid home")
	# Close the door with the normal world pointer.
	var camera := _world.get(&"camera") as Camera2D
	camera.reset_smoothing()
	camera.force_update_scroll()
	await process_frame
	var door_node: Node2D = build.structure_node(String(home["id"]))
	var pointer := root.get_final_transform() * (camera.get_canvas_transform() * (door_node.global_position + Vector2(8, 8)))
	await _click_window(pointer)
	var door_closed := not bool((_structures().get(String(home["id"]), {}) as Dictionary).get("door_open", false))
	_expect(door_closed, "ordinary pointer closes the paid door behind the Hero")
	await _capture("door_closed")
	# Observe the existing AI. It may chase while it can see, then must rely on
	# local trace evidence or lose the route; it may not teleport or breach.
	var saw_trace := false
	var saw_loss := false
	var max_trace_move := 0.0
	var last_enemy_pos: Vector2 = enemy.global_position
	var trace_start_pos: Vector2 = enemy.global_position
	for i in range(240):
		_set_direction(Vector2.ZERO)
		await physics_frame
		if not is_instance_valid(enemy) or enemy.is_queued_for_deletion():
			break
		var snap: Dictionary = enemy.call(&"ecology_snapshot")
		var state := String(snap.get("state", ""))
		if state == "FOLLOW_TRACE" and not String(snap.get("trace_id", "")).is_empty():
			if not saw_trace:
				trace_start_pos = enemy.global_position
			saw_trace = true
			max_trace_move = maxf(max_trace_move, enemy.global_position.distance_to(trace_start_pos))
		if saw_trace and state in ["PATROL", "RETURN_HABITAT"]:
			saw_loss = true
		if i % 40 == 0:
			_log_state("bc_wait_%d" % i, enemy)
		last_enemy_pos = enemy.global_position
	_expect(saw_trace, "CASE B the Skeleton actually enters FOLLOW_TRACE from local evidence")
	_expect(max_trace_move > 12.0, "CASE B the Skeleton physically moves along the trace chain (%.1f px)" % max_trace_move)
	await _capture("trace_follow")
	# Expiry boundary through the existing authoritative run clock. The traces
	# were created by real movement above; only the deadline is advanced.
	if _clock_boundary:
		var lifecycle := root.get_node_or_null("RunLifecycle")
		var phase: Dictionary = lifecycle.call(&"phase")
		var advanced := int(phase.get("now_unix", 0)) + 91
		_expect(bool(lifecycle.call(&"configure_test_clock", advanced)), "authoritative run clock accepts the test boundary")
		for i in range(90):
			await physics_frame
		var after: Dictionary = enemy.call(&"ecology_snapshot") if is_instance_valid(enemy) else {}
		_expect(int(store.call(&"trace_count")) == 0, "CASE C expired traces are removed")
		_expect(String(after.get("state", "")) != "FOLLOW_TRACE", "CASE C the Skeleton stops following expired evidence")
		_log_state("after_expiry", enemy)
		await _capture("expired")
	else:
		_expect(saw_loss, "CASE C the Skeleton loses the route when physical access/evidence ends")
	# The monster must not be inside the closed home or have damaged the door.
	var room: String = build.room_topology.room_at(nav.cell_of(last_enemy_pos))
	_expect(room.is_empty(), "the Skeleton never breaches into the closed home room")
	_expect(not bool((_structures().get(String(home["id"]), {}) as Dictionary).get("door_open", false)), "the paid door remains closed")
	_body_complete = true


func _click_window(position: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = position
	Input.parse_input_event(motion)
	var press := InputEventMouseButton.new()
	press.position = position
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	Input.parse_input_event(press)
	await physics_frame
	await process_frame
	var release := InputEventMouseButton.new()
	release.position = position
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	Input.parse_input_event(release)
	await physics_frame
	await process_frame
