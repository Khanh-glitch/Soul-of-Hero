extends Node

var failures: Array[String] = []
var checks := 0


func start(game: Node2D) -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_run.call_deferred(game)


func _run(game: Node2D) -> void:
	_expect(game != null, "main scene loads")
	for _frame: int in range(35):
		await get_tree().physics_frame

	var player := get_tree().get_first_node_in_group("player") as KnightController
	var level := game.get_node_or_null("Level") as DungeonLevel
	_expect(player != null, "default Knight exists")
	_expect(level != null, "DungeonLevel exists")
	if player == null or level == null:
		_finish()
		return

	_expect(player.sprite.sprite_frames.get_animation_names().size() == 34, "all 30 FreeKnight base animations plus four fixed Sword combo strips registered")
	_expect(level.geometry.get_used_cells().size() == 880, "redesigned three-floor silhouette has 880 perimeter wall cells")
	_expect(level.backdrop.get_used_cells().size() == 3860, "walkable floor fills the redesigned three-camp dungeon")
	_expect(level.backdrop.get_cell_source_id(Vector2i.ZERO) < 0, "black void remains outside the dungeon footprint")
	_expect(level.geometry.get_cell_source_id(level.geometry.get_used_cells()[0]) == 1, "geometry uses the dedicated low-wall atlas")
	var floor_cells: Array[Vector2i] = level.backdrop.get_used_cells()
	var floor_lookup: Dictionary = {}
	for floor_cell: Vector2i in floor_cells:
		floor_lookup[floor_cell] = true
	var components := _count_floor_components(floor_lookup)
	_expect(components == 3, "authored dungeon is split into exactly three door-linked floor footprints")
	var all_entities_on_floor := true
	for raw_entity: Variant in level.get_entities():
		if not raw_entity is Dictionary:
			all_entities_on_floor = false
			break
		var raw_position: Variant = raw_entity.get("position", [])
		if not raw_position is Array or raw_position.size() < 2:
			all_entities_on_floor = false
			break
		var entity_cell := Vector2i(
			floori(float(raw_position[0]) / 16.0),
			floori(float(raw_position[1]) / 16.0)
		)
		if level.backdrop.get_cell_source_id(entity_cell) < 0:
			all_entities_on_floor = false
			break
	_expect(all_entities_on_floor, "every configured entity spawns on walkable floor instead of wall, pit, or void")
	var floor_door_count := 0
	for raw_entity: Variant in level.get_entities():
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) == "floor_door":
			floor_door_count += 1
			var target_position: Array = raw_entity.get("target_position", [])
			var target_cell := Vector2i(floori(float(target_position[0]) / 16.0), floori(float(target_position[1]) / 16.0))
			_expect(level.backdrop.get_cell_source_id(target_cell) >= 0, "floor door target lands on walkable floor: %s" % raw_entity.get("id", ""))
	_expect(floor_door_count == 4, "level one has paired doors between floor 1/2 and floor 2/3")
	_expect(bool(LevelSchema.validate_level(level.level_data).get("ok", false)), "canonical map passes the shared top-down v2 schema")
	var invalid_atlas_level: Dictionary = level.level_data.duplicate(true)
	invalid_atlas_level.layers.Geometry[0].atlas = [99, 99]
	_expect(not bool(LevelSchema.validate_level(invalid_atlas_level).get("ok", false)), "schema rejects atlas cells the runtime TileSet cannot draw")
	var unknown_entity_level: Dictionary = level.level_data.duplicate(true)
	unknown_entity_level.entities.append({"id": "unknown", "type": "typo_enemy", "position": [120, 120]})
	_expect(not bool(LevelSchema.validate_level(unknown_entity_level).get("ok", false)), "schema rejects unregistered entity types")
	var missing_gate_level: Dictionary = level.level_data.duplicate(true)
	var entities_without_gate: Array = []
	for raw_entity: Variant in missing_gate_level.entities:
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) != "exit_gate":
			entities_without_gate.append(raw_entity)
	missing_gate_level.entities = entities_without_gate
	_expect(not bool(LevelSchema.validate_level(missing_gate_level).get("ok", false)), "schema requires exactly one top-down exit gate")
	var duplicate_player_level: Dictionary = level.level_data.duplicate(true)
	duplicate_player_level.entities.append({"id": "player_spawn_2", "type": "player", "position": [120, 104]})
	_expect(not bool(LevelSchema.validate_level(duplicate_player_level).get("ok", false)), "schema requires exactly one player spawn")
	_expect(not bool(GameplayTuningSchema.validate_patch("player", {"move_speed": -1}).get("ok", false)), "tuning schema rejects unsafe values before persistence")
	_expect(GameSession.required_sigils == int(level.level_data.metadata.required_sigils), "objective requirement comes from level metadata")
	_expect(player.motion_mode == CharacterBody2D.MOTION_MODE_FLOATING, "player uses top-down floating motion")
	_expect((player.collision_mask & 4) != 0, "player body collides with top-down enemies")
	_expect(player.global_position.distance_to(Vector2(104.0, 104.0)) < 2.0, "top-down spawn position is stable")
	_expect(game.get_node_or_null("HUD/HUDRoot") != null, "HUD and virtual controls instantiate")
	var authored_enemy_count := 0
	for raw_entity: Variant in level.get_entities():
		if raw_entity is Dictionary and String(raw_entity.get("type", "")) == "skeleton":
			authored_enemy_count += 1
	var pack_rules := preload("res://game/content/encounters/encounter_pack_rules.gd")
	var metadata: Dictionary = level.level_data.get("metadata", {})
	var expected_runtime_enemy_count := authored_enemy_count + (
		pack_rules.expected_bonus_count(
			metadata,
			GameSession.active_stage_level,
			GameSession.active_difficulty,
		)
		if pack_rules.uses_pack_model(metadata)
		else DifficultyRules.density_bonus_count(authored_enemy_count, GameSession.active_difficulty)
	)
	_expect(
		get_tree().get_nodes_in_group("enemies").size() == expected_runtime_enemy_count,
		"authored anchors materialize the selected difficulty's per-floor encounter packs",
	)

	for action: StringName in [
		&"move_left", &"move_right", &"move_up", &"move_down", &"jump",
		&"light_attack", &"heavy_attack", &"dash", &"roll", &"slide", &"crouch", &"interact",
	]:
		_expect(InputMap.has_action(action), "input action exists: %s" % action)

	var movement_start := player.global_position
	Input.action_press("move_down")
	for _frame: int in range(12):
		await get_tree().physics_frame
	Input.action_release("move_down")
	_expect(player.global_position.y > movement_start.y + 8.0, "WASD movement changes the Y axis")
	Input.action_press("move_right")
	var right_start := player.global_position.x
	for _frame: int in range(12):
		await get_tree().physics_frame
	Input.action_release("move_right")
	_expect(player.global_position.x > right_start + 8.0, "WASD movement changes the X axis")

	player.global_position = Vector2(72.0, 104.0)
	player.velocity = Vector2.ZERO
	Input.action_press("move_left")
	for _frame: int in range(20):
		await get_tree().physics_frame
	Input.action_release("move_left")
	_expect(player.global_position.x >= 69.0, "perimeter TileMap wall blocks movement into the black void")
	player.global_position = Vector2(104.0, 104.0)
	player.velocity = Vector2.ZERO
	await get_tree().physics_frame

	_expect(player.request_action("hop"), "hop/dodge can start")
	for _frame: int in range(8):
		await get_tree().physics_frame
	_expect(player.sprite.position.y < -31.5, "hop uses jump animation as top-down visual height")
	player.invulnerability_remaining = 0.0
	player.take_damage(1, player.global_position + Vector2.RIGHT * 20.0)
	_expect(player.sprite.position == Vector2(0.0, -31.0), "hurt interrupts hop without leaving the sprite elevated")
	player.respawn()
	for _frame: int in range(20):
		await get_tree().physics_frame

	# Realtime/MCP uses the exact same buffer as physical input. This guards the
	# original failure where only the first remote slash played and later presses
	# were discarded while its animation was still running.
	player.global_position = Vector2(160.0, 160.0)
	player.facing_direction = Vector2.RIGHT
	player.trigger_remote_action("attack", true)
	_expect(player.current_action == "sword_attack_1" and player.sprite.animation == &"sword_combo_1", "remote Attack starts fixed Sword combo frame strip 1")
	player.trigger_remote_action("attack", true)
	_expect(player._sword_combo_buffered, "remote Attack buffers while a Sword combo strip is running")
	var remote_step_2 := await _wait_for_action(player, "sword_attack_2")
	_expect(remote_step_2 and player.sprite.animation == &"sword_combo_2", "remote buffer advances into fixed Sword combo frame strip 2")
	Input.action_press(&"move_left")
	await get_tree().physics_frame
	_expect(player.action_direction.x > 0.9 and not player.sprite.flip_h, "live movement input cannot flip an authored Sword strip away from its locked action direction")
	Input.action_release(&"move_left")
	player.trigger_remote_action("attack", true)
	var remote_step_3 := await _wait_for_action(player, "sword_attack_3")
	_expect(remote_step_3 and player.sprite.animation == &"sword_combo_3", "remote buffer advances into fixed Sword combo frame strip 3")
	_expect(_count_sword_waves() > 0, "remote combo 3 spawns the authored travelling Crescent Recoil wave")
	player.trigger_remote_action("attack", true)
	var remote_step_4 := await _wait_for_action(player, "sword_attack_4")
	_expect(remote_step_4 and player.sprite.animation == &"sword_combo_4", "remote buffer advances into fixed Sword combo frame strip 4")
	player.trigger_remote_action("skill", true)
	await get_tree().process_frame
	var mid_combo_echo_steps: Dictionary = player._soul_echo._queued_steps if player._is_soul_echo_active() else {}
	_expect(mid_combo_echo_steps.has(4), "Soul Echo activated during combo 4 queues the still-running execution instead of wasting cooldown")
	for _frame: int in range(42):
		await get_tree().physics_frame
	player.respawn()
	for _frame: int in range(4):
		await get_tree().physics_frame

	var enemy := get_tree().get_nodes_in_group("enemies")[0] as SkeletonEnemy
	enemy.set_physics_process(false)
	enemy.health = enemy.max_health
	enemy.global_position = player.global_position + player.facing_direction * 20.0
	await get_tree().physics_frame
	var enemy_health_before: int = enemy.health
	player.light_damage = 27
	_expect(player.request_action("light_attack"), "light attack can start")
	for _frame: int in range(15):
		await get_tree().physics_frame
	_expect(enemy_health_before - enemy.health == 27, "hot-tuned light damage reaches an overlapping enemy")
	player.light_damage = 18
	for _frame: int in range(10):
		await get_tree().physics_frame
	_expect(player.request_action("light_attack"), "second light input is accepted")
	_expect(player.current_action == "combo_attack", "second light becomes designed combo animation")

	for _frame: int in range(48):
		await get_tree().physics_frame
	var los_blocker := StaticBody2D.new()
	los_blocker.collision_layer = 1
	los_blocker.collision_mask = 0
	var los_shape := CollisionShape2D.new()
	var los_rectangle := RectangleShape2D.new()
	los_rectangle.size = Vector2(4.0, 24.0)
	los_shape.shape = los_rectangle
	los_blocker.add_child(los_shape)
	game.add_child(los_blocker)
	enemy.global_position = player.global_position + player.facing_direction * 20.0
	los_blocker.global_position = player.global_position + player.facing_direction * 10.0 + Vector2(0.0, -7.0)
	await get_tree().physics_frame
	_expect(not player._has_attack_line_of_sight(enemy), "Knight attacks cannot pass through a top-down wall")
	los_blocker.queue_free()
	await get_tree().physics_frame
	enemy.global_position = player.global_position + Vector2.DOWN * 96.0
	await get_tree().physics_frame
	var dash_start_x := player.global_position.x
	_expect(player.request_action("dash"), "dash can start when stamina is available")
	for _frame: int in range(8):
		await get_tree().physics_frame
	_expect(absf(player.global_position.x - dash_start_x) > 18.0, "dash applies gameplay movement")

	var health_before := player.health
	player.invulnerability_remaining = 0.0
	player.take_resolved_damage(10, player.global_position + Vector2(20.0, 0.0))
	_expect(player.health == health_before - 10, "hurt state reduces health")
	player.respawn()
	_expect(player.health == player.max_health and not player.dead, "respawn restores the default character")
	player.kill()
	await get_tree().process_frame
	var pools_after_first_zero := player.get_hero_health_snapshot()
	if not String(pools_after_first_zero.get("reserve_hero_id", "")).is_empty():
		_expect(not player.dead and not get_tree().paused, "first depleted Hero transfers to its living reserve pool")
		player.kill()
		await get_tree().process_frame
	_expect(get_tree().paused and player.sprite.animation == &"death", "both depleted Hero pools freeze harmful gameplay without checkpoint resurrection")
	player.respawn()

	var original_entities: Array = level.get_entities().duplicate(true)
	var preserved_enemy_id := enemy.get_instance_id()
	var preserved_enemy_health := enemy.health
	var preserved_enemy_position := enemy.global_position
	var consumed_coin := game.get_node_or_null("Level/Entities/Coin01")
	var original_torch := game.get_node_or_null("Level/Entities/TorchA")
	var original_torch_id := original_torch.get_instance_id() if original_torch != null else 0
	_expect(consumed_coin != null, "managed coin has a stable entity ID")
	_expect(original_torch != null, "managed prop has a stable entity ID")
	if consumed_coin != null:
		consumed_coin.queue_free()
		await get_tree().process_frame
	var edited_entities: Array = original_entities.duplicate(true)
	for edited_entity: Dictionary in edited_entities:
		if String(edited_entity.get("id", "")) == "coin_01":
			edited_entity["position"] = [216, 120]
		elif String(edited_entity.get("id", "")) == "torch_a":
			edited_entity["type"] = "spikes"
	edited_entities.append({
		"id": "smoke_hot_reload_coin",
		"type": "coin",
		"position": [120, 120],
	})
	level.level_data["entities"] = edited_entities
	GameEvents.map_changed.emit("smoke")
	await get_tree().process_frame
	var entity_root := game.get_node("Level/Entities")
	_expect(entity_root.get_node_or_null("SmokeHotReloadCoin") != null, "entity JSON hot-reloads into the running level")
	_expect(is_instance_valid(enemy) and enemy.get_instance_id() == preserved_enemy_id, "entity hot-reload preserves unchanged enemy instances")
	_expect(enemy.health == preserved_enemy_health and enemy.global_position.is_equal_approx(preserved_enemy_position), "entity hot-reload preserves enemy runtime health and position")
	_expect(entity_root.get_node_or_null("Coin01") == null, "entity config edits do not respawn a consumed actor")
	var replaced_torch := entity_root.get_node_or_null("TorchA")
	_expect(replaced_torch != null and replaced_torch.get_instance_id() != original_torch_id and String(replaced_torch.get_meta("level_entity_type", "")) == "spikes", "changing a live entity type replaces its scene instance")
	level.level_data["entities"] = original_entities
	GameEvents.map_changed.emit("smoke_restore")
	await get_tree().process_frame
	_expect(entity_root.get_node_or_null("SmokeHotReloadCoin") == null, "entity hot-reload removes deleted runtime entities")
	var restored_torch := entity_root.get_node_or_null("TorchA")
	_expect(restored_torch != null and String(restored_torch.get_meta("level_entity_type", "")) == "torch", "restoring an entity type replaces it back deterministically")

	var old_source := level.decor.get_cell_source_id(Vector2i(3, 3))
	level.apply_cell_update("Decor", Vector2i(3, 3), Vector2i(6, 8))
	_expect(level.decor.get_cell_atlas_coords(Vector2i(3, 3)) == Vector2i(6, 8), "runtime tile update applies immediately")
	if old_source < 0:
		level.apply_cell_update("Decor", Vector2i(3, 3), Vector2i(-1, -1))

	var realtime_bridge := get_tree().root.get_node_or_null("RealtimeBridge")
	_expect(realtime_bridge != null, "realtime bridge autoload exists")
	var bridge_status: Dictionary = realtime_bridge.call("get_status") if realtime_bridge != null else {}
	_expect(bridge_status.has("connected"), "realtime bridge exposes connection status")
	var bridge_snapshot: Dictionary = realtime_bridge.call("get_runtime_state") if realtime_bridge != null else {}
	_expect(int(bridge_snapshot.get("session", {}).get("required_sigils", -1)) == GameSession.required_sigils, "MCP state includes the dynamic sigil requirement")
	if realtime_bridge != null:
		var health_before_failed_write := player.health
		var max_health_before_failed_write := player.max_health
		var tuning_path := "res://config/gameplay_tuning.json"
		var tuning_text_before := FileAccess.get_file_as_string(tuning_path)
		var tuning_lock_path := ProjectSettings.globalize_path(tuning_path) + ".write.lock"
		DirAccess.remove_absolute(tuning_lock_path)
		var tuning_lock_error := DirAccess.make_dir_absolute(tuning_lock_path)
		_expect(tuning_lock_error == OK, "smoke test acquires the shared tuning write lock")
		var rejected_tuning: Dictionary = realtime_bridge.call("_set_player_tuning", {
			"section": "player",
			"values": {"max_health": 1},
		})
		_expect(not bool(rejected_tuning.get("ok", false)), "MCP tuning reports a locked write instead of mutating runtime")
		_expect(player.health == health_before_failed_write and player.max_health == max_health_before_failed_write, "failed tuning persistence cannot clamp live health")
		_expect(FileAccess.get_file_as_string(tuning_path) == tuning_text_before, "failed tuning persistence leaves JSON unchanged")
		DirAccess.remove_absolute(tuning_lock_path)
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
		var recovery_path := "res://.artifacts/recovery_probe.json"
		var recovery_absolute := ProjectSettings.globalize_path(recovery_path)
		var recovery_backup := recovery_absolute + ".write.backup"
		var recovery_lock := recovery_absolute + ".write.lock"
		DirAccess.remove_absolute(recovery_absolute)
		DirAccess.remove_absolute(recovery_backup)
		DirAccess.remove_absolute(recovery_lock)
		var backup_file := FileAccess.open(recovery_backup, FileAccess.WRITE)
		if backup_file != null:
			backup_file.store_string("{\"revision\":1}\n")
			backup_file.close()
		var recovery_result: Error = realtime_bridge.call("_recover_interrupted_write", recovery_path)
		_expect(recovery_result == OK and FileAccess.file_exists(recovery_path), "bridge restores a complete backup after interrupted Windows replacement")
		_expect(FileAccess.get_file_as_string(recovery_path).contains("revision"), "recovered replacement remains readable")
		DirAccess.remove_absolute(recovery_absolute)
		DirAccess.remove_absolute(recovery_backup)
		DirAccess.remove_absolute(recovery_lock)
		var invalid_target_file := FileAccess.open(recovery_path, FileAccess.WRITE)
		if invalid_target_file != null:
			invalid_target_file.store_string("{broken-json\n")
			invalid_target_file.close()
		backup_file = FileAccess.open(recovery_backup, FileAccess.WRITE)
		if backup_file != null:
			backup_file.store_string("{\"revision\":2}\n")
			backup_file.close()
		var restored_json: Dictionary = realtime_bridge.call("_read_json_file", recovery_path)
		_expect(bool(restored_json.get("ok", false)) and int(restored_json.get("data", {}).get("revision", 0)) == 2, "invalid promoted JSON rolls back to its validated backup")
		_expect(not FileAccess.file_exists(recovery_backup), "validated rollback consumes the recovery backup")
		var valid_target_file := FileAccess.open(recovery_path, FileAccess.WRITE)
		if valid_target_file != null:
			valid_target_file.store_string("{\"revision\":3}\n")
			valid_target_file.close()
		backup_file = FileAccess.open(recovery_backup, FileAccess.WRITE)
		if backup_file != null:
			backup_file.store_string("{\"revision\":2}\n")
			backup_file.close()
		var verified_json: Dictionary = realtime_bridge.call("_read_json_file", recovery_path)
		_expect(bool(verified_json.get("ok", false)) and int(verified_json.get("data", {}).get("revision", 0)) == 3, "valid promoted JSON wins over its older backup")
		_expect(not FileAccess.file_exists(recovery_backup), "backup is removed only after the promoted JSON validates")
		DirAccess.remove_absolute(recovery_absolute)
		DirAccess.remove_absolute(recovery_backup)
		DirAccess.remove_absolute(recovery_lock)
	var snapshot: Dictionary = game.get_runtime_snapshot()
	_expect(snapshot.has("player") and snapshot.has("session") and snapshot.has("level"), "runtime snapshot covers player, session, and level")
	_expect(snapshot.player.get("movement_mode", "") == "top_down", "MCP snapshot identifies top-down movement")

	_finish()


func _expect(condition: bool, message: String) -> void:
	checks += 1
	if condition:
		print("PASS  ", message)
	else:
		failures.append(message)
		push_error("FAIL  " + message)


func _count_floor_components(floor_lookup: Dictionary) -> int:
	var remaining: Dictionary = floor_lookup.duplicate()
	var components := 0
	while not remaining.is_empty():
		var start := remaining.keys()[0] as Vector2i
		var frontier: Array[Vector2i] = [start]
		components += 1
		while not frontier.is_empty():
			var current: Vector2i = frontier.pop_back()
			if not remaining.has(current):
				continue
			remaining.erase(current)
			for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
				var neighbor := current + direction
				if floor_lookup.has(neighbor) and remaining.has(neighbor):
					frontier.append(neighbor)
	return components


func _wait_for_action(player: KnightController, expected_action: String, maximum_frames := 60) -> bool:
	for _frame: int in range(maximum_frames):
		if player.current_action == expected_action:
			return true
		await get_tree().physics_frame
	return player.current_action == expected_action


func _count_sword_waves() -> int:
	var count := 0
	for node: Node in get_tree().root.find_children("*", "", true, false):
		if node is SwordCrescentWave:
			count += 1
	return count


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report_file := FileAccess.open("res://.artifacts/smoke_report.json", FileAccess.WRITE)
	if report_file != null:
		report_file.store_string(JSON.stringify({
			"passed": failures.is_empty(),
			"checks": checks,
			"failures": failures,
		}, "  ") + "\n")
	if failures.is_empty():
		print("\nSMOKE TEST PASSED — %d checks" % checks)
		get_tree().quit(0)
	else:
		print("\nSMOKE TEST FAILED — %d/%d checks failed" % [failures.size(), checks])
		for failure: String in failures:
			print(" - ", failure)
		get_tree().quit(1)
