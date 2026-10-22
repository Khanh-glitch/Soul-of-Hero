extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_10.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _test_patterns_hud_and_checkpoint_reset()
	await _test_base_hero_clear(&"sword_hero", 18)
	await _test_base_hero_clear(&"axe_hero", 34)
	_finish()


func _test_patterns_hud_and_checkpoint_reset() -> void:
	var game := await _spawn_game()
	_expect(game != null, "Shared gameplay scene starts the dedicated Level 10 map")
	if game == null:
		return
	var entity_root := game.get_node("Level/Entities") as Node2D
	var entities := _live_entities(entity_root)
	var boss := entities.get("l10_vampire_castellan") as VampireCastellan
	var player := entity_root.get_node_or_null("Knight") as KnightController
	var controller := game.get_node_or_null("Level10CastellanRuntime")
	var exit_gate := entities.get("l10_exit") as ExitGate
	_expect(controller != null and boss != null and player != null, "Level 10 installs one real Castellan actor and its dedicated runtime")
	_expect(_count_live_type(entity_root, "vampire_castellan") == 1 and _count_live_type(entity_root, "vampire") >= 1 and entities.has("l10_approach_vampire"), "Live scene keeps one dedicated boss while ordinary Vampires belong only to the independent approach packs")
	_expect(
		boss != null and boss.get_script() != preload("res://game/characters/enemies/advanced_enemy.gd"),
		"Castellan is a distinct combat class, not a renamed standard Vampire",
	)
	_expect(exit_gate != null and exit_gate.is_open, "North exit starts open for destination-only completion")
	if boss == null or player == null or controller == null:
		await _teardown_game(game)
		return

	var boss_panel := game.get_node_or_null("Level10CastellanRuntime/CastellanBossHUD/BossHudRoot/BossPanel") as Control
	var boss_name := controller.find_child("BossName", true, false) as Label
	var boss_bar := controller.find_child("BossHealthBar", true, false) as ProgressBar
	var phase_label := controller.find_child("BossPhase", true, false) as Label
	var generic_focus := game.find_child("FocusPanel", true, false) as Control
	_expect(boss_panel != null and boss_name != null and boss_bar != null and phase_label != null, "Readable boss name, health bar and phase label are visible runtime UI")
	_expect(
		boss_name != null
			and boss_name.text == "Vampire Castellan (Cấp 10)"
			and boss_bar.max_value == float(boss.max_health),
		"Boss HUD names the encounter and reports its stage/difficulty-scaled maximum health",
	)
	_expect(generic_focus != null and not generic_focus.visible, "dedicated Castellan HUD suppresses the duplicate generic target strip")
	for viewport_size: Vector2i in [Vector2i(847, 437), Vector2i(1280, 720)]:
		get_tree().root.size = viewport_size
		await get_tree().process_frame
		var panel_rect := boss_panel.get_global_rect() if boss_panel != null else Rect2()
		var viewport_rect := get_tree().root.get_visible_rect()
		_expect(
			boss_panel != null
				and panel_rect.position.x >= -1.0
				and panel_rect.position.y >= -1.0
				and panel_rect.end.x <= viewport_rect.end.x + 1.0
				and panel_rect.end.y <= viewport_rect.end.y + 1.0,
			"Boss HUD stays fully on-screen at %dx%d" % [viewport_size.x, viewport_size.y],
		)

	boss.set_physics_process(false)
	var telegraphs: Array[Dictionary] = []
	boss.attack_telegraphed.connect(func(pattern_id: StringName, seconds: float) -> void:
		telegraphs.append({"pattern": pattern_id, "seconds": seconds})
	)
	var boss_threats: Array[Dictionary] = []
	var threat_callback := func(
			threat_id: StringName,
			attacker: Node,
			intended_target: Node,
			origin: Vector2,
			danger_radius: float,
	) -> void:
		if attacker == boss:
			boss_threats.append({
				"id": threat_id,
				"target": intended_target,
				"origin": origin,
				"radius": danger_radius,
			})
	GameEvents.melee_threat_emitted.connect(threat_callback)
	player.global_position = boss.global_position + Vector2(96.0, 0.0)
	_expect(boss.debug_begin_pattern(&"blood_lunge"), "Phase 1 starts a real Blood Lunge pattern")
	_expect(telegraphs.size() == 1 and telegraphs[0].pattern == &"blood_lunge" and float(telegraphs[0].seconds) >= 0.70, "Blood Lunge exposes a fair pre-hit telegraph")
	_expect(
		boss_threats.size() == 1
			and boss_threats[0].target == player
			and String(boss_threats[0].id).contains("blood_lunge"),
		"Blood Lunge emits one unique melee-threat trigger for Reserve Sword"
	)
	var same_boss_id := boss.get_instance_id()
	var threshold := boss.get_phase_two_threshold_health()
	boss.take_damage(boss.max_health - threshold, player.global_position)
	_expect(boss.phase == 2 and boss.health == threshold and boss.get_instance_id() == same_boss_id, "One continuous actor crosses into Phase 2 at exactly 55% health")
	_expect(phase_label != null and phase_label.text.contains("GIAI ĐOẠN 2/2") and phase_label.text.contains("DẠ HUYẾT"), "Boss HUD visibly announces giai đoạn 2")
	var runtime_after_phase: Dictionary = game.call(&"get_runtime_snapshot")
	var encounter_after_phase: Dictionary = (runtime_after_phase.get("session", {}) as Dictionary).get("encounter", {})
	_expect(int((encounter_after_phase.get("custom_events", {}) as Dictionary).get("castellan_phase_two_started", 0)) == 1, "Phase transition reaches canonical encounter authority exactly once")
	_expect(exit_gate != null and exit_gate.is_open, "Boss phase transition does not affect the open destination")
	boss.call(&"_update_phase_transition", 1.20)

	player.set("invulnerability_remaining", 0.0)
	player.global_position = boss.global_position + Vector2(80.0, 20.0)
	_expect(boss.debug_begin_pattern(&"blink_lanes"), "Phase 2 introduces the genuinely new Blink Lanes pattern")
	var lane_anchor := player.global_position
	player.global_position = lane_anchor + Vector2(44.0, 44.0)
	var health_before_dodge := player.health
	boss.call(&"_update_telegraph", 1.02)
	_expect(player.health == health_before_dodge, "Moving diagonally out of both telegraphed lanes avoids all damage")
	boss.call(&"_update_strike", 0.25)
	boss.call(&"_update_recover", 0.60)

	player.set("invulnerability_remaining", 0.0)
	player.global_position = boss.global_position + Vector2(74.0, 0.0)
	_expect(boss.debug_begin_pattern(&"blink_lanes"), "Blink Lanes can cycle again after its authored recovery")
	var health_before_lane_hit := player.health
	boss.call(&"_update_telegraph", 1.02)
	var expected_lane_damage := EnemyDifficultyScaler.scale_direct_damage(boss, 18)
	_expect(
		player.health < health_before_lane_hit
			and health_before_lane_hit - player.health <= expected_lane_damage,
		"Remaining in a warned lane deals one bounded stage/difficulty-scaled pattern hit",
	)
	boss.call(&"_update_strike", 0.25)
	boss.call(&"_update_recover", 0.60)
	await _test_blink_edge_safety_and_blocked_fallback(entity_root, boss, player)

	player.set("invulnerability_remaining", 0.0)
	player.global_position = boss.global_position + Vector2(120.0, 0.0)
	var threats_before_disc := boss_threats.size()
	_expect(boss.debug_begin_pattern(&"disc_fan"), "Phase 2 exposes its separate three-gap Disc Fan pattern")
	_expect(boss_threats.size() == threats_before_disc, "ranged Disc Fan does not falsely advance Sword's melee trigger")
	boss.call(&"_update_telegraph", 0.84)
	_expect(_count_owned_discs(entity_root, boss.get_instance_id()) == 3, "Disc Fan materially creates three live spectral projectiles")

	player.kill()
	get_tree().paused = false
	await get_tree().process_frame
	await get_tree().process_frame
	var reset_snapshot: Dictionary = controller.call(&"get_snapshot")
	_expect(int(reset_snapshot.get("reset_count", 0)) == 1, "Player defeat triggers one checkpoint encounter rewind")
	_expect(boss.phase == 1 and boss.health == boss.max_health and boss.global_position.distance_to(Vector2(808.0, 408.0)) < 1.0, "Checkpoint rewind restores the same boss to full Phase 1 at its authored throne position")
	_expect(_count_owned_discs(entity_root, boss.get_instance_id()) == 0, "Checkpoint rewind cleans all boss-owned projectiles")
	if GameEvents.melee_threat_emitted.is_connected(threat_callback):
		GameEvents.melee_threat_emitted.disconnect(threat_callback)
	await _teardown_game(game)


func _test_blink_edge_safety_and_blocked_fallback(
		entity_root: Node2D,
		boss: VampireCastellan,
		player: KnightController,
) -> void:
	var authored_position := Vector2(808.0, 408.0)
	var bounds := boss.debug_get_blink_arena_bounds()
	var center := bounds.get_center()
	var edge_anchors: Array[Vector2] = [
		Vector2(bounds.position.x + 14.0, center.y),
		Vector2(bounds.end.x - 14.0, center.y),
		Vector2(center.x, bounds.position.y + 24.0),
		Vector2(center.x, bounds.end.y - 8.0),
	]
	for edge_index: int in edge_anchors.size():
		boss.global_position = authored_position
		var anchor := edge_anchors[edge_index]
		var attack_cycle := edge_index % 2
		var preferred_side := -1.0 if attack_cycle == 0 else 1.0
		var expected_destination: Vector2 = boss.call(&"_find_safe_blink_destination", anchor, preferred_side)
		_expect(
			expected_destination != authored_position and boss.debug_is_blink_destination_safe(expected_destination),
			"Blink resolver finds a collision-safe in-arena destination when the target hugs edge %d" % (edge_index + 1),
		)
		player.global_position = anchor
		boss.set("_attack_cycle", attack_cycle)
		_expect(boss.debug_begin_pattern(&"blink_lanes"), "Edge %d still enters the normal telegraphed Blink Lanes flow" % (edge_index + 1))
		player.global_position = anchor + Vector2(44.0, 44.0)
		boss.call(&"_update_telegraph", 1.02)
		_expect(
			boss.global_position.is_equal_approx(expected_destination)
				and boss.debug_is_blink_destination_safe(boss.global_position),
			"Edge %d resolves deterministically without entering a wall or leaving authored arena bounds" % (edge_index + 1),
		)
		boss.call(&"_update_strike", 0.25)
		boss.call(&"_update_recover", 0.60)

	# Every legal candidate is covered by a temporary world-layer body while
	# the known-good throne position remains clear. The production resolver
	# must cancel movement instead of forcing a teleport through geometry.
	boss.global_position = authored_position
	_expect(boss.debug_is_blink_destination_safe(authored_position), "Authored throne position is collision-safe before the fully-blocked fixture")
	var blocked_anchor := Vector2(center.x, bounds.end.y - 104.0)
	var blocked_candidates := boss.debug_get_blink_candidates(blocked_anchor, -1.0)
	var blockers: Array[StaticBody2D] = []
	for candidate: Vector2 in blocked_candidates:
		blockers.append(_add_blink_blocker(entity_root, candidate))
	await get_tree().physics_frame
	var legal_candidate_count := 0
	var all_legal_candidates_blocked := true
	for candidate: Vector2 in blocked_candidates:
		var shape_rect := Rect2(candidate - Vector2(10.0, 22.0), Vector2(20.0, 25.0))
		if (
			shape_rect.position.x >= bounds.position.x
			and shape_rect.position.y >= bounds.position.y
			and shape_rect.end.x <= bounds.end.x
			and shape_rect.end.y <= bounds.end.y
		):
			legal_candidate_count += 1
			all_legal_candidates_blocked = all_legal_candidates_blocked and not boss.debug_is_blink_destination_safe(candidate)
	_expect(legal_candidate_count > 0 and all_legal_candidates_blocked, "Fully-blocked fixture covers every otherwise in-bounds deterministic candidate")
	player.global_position = blocked_anchor
	boss.set("_attack_cycle", 0)
	_expect(boss.debug_begin_pattern(&"blink_lanes"), "Fully-blocked fallback still preserves the normal Blink Lanes telegraph")
	player.global_position = blocked_anchor + Vector2(44.0, 44.0)
	boss.call(&"_update_telegraph", 1.02)
	_expect(boss.global_position.is_equal_approx(authored_position), "When every candidate is blocked, Blink Lanes keeps the boss at its previous safe position")
	boss.call(&"_update_strike", 0.25)
	boss.call(&"_update_recover", 0.60)
	for blocker: StaticBody2D in blockers:
		blocker.queue_free()
	await get_tree().physics_frame
	boss.global_position = authored_position


func _add_blink_blocker(parent: Node2D, position: Vector2) -> StaticBody2D:
	var blocker := StaticBody2D.new()
	blocker.collision_layer = 1
	blocker.collision_mask = 0
	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(64.0, 64.0)
	collision.shape = shape
	blocker.add_child(collision)
	parent.add_child(blocker)
	blocker.global_position = position
	return blocker


func _test_base_hero_clear(hero_id: StringName, expected_base_damage: int) -> void:
	var game := await _spawn_game()
	if game == null:
		return
	var entity_root := game.get_node("Level/Entities") as Node2D
	var entities := _live_entities(entity_root)
	var boss := entities.get("l10_vampire_castellan") as VampireCastellan
	var player := entity_root.get_node("Knight") as KnightController
	var exit_gate := entities.get("l10_exit") as ExitGate
	_expect(player.configure_soul_team_from_run({
		"active_hero": String(hero_id),
		"reserve_souls": ["", ""],
		"capacity": 2,
	}), "%s configures as the real active form without a loot prerequisite" % hero_id)
	boss.set_physics_process(false)
	var base_damage := player.scale_hero_action_damage(hero_id, &"normal_attack", float(expected_base_damage))
	_expect(base_damage >= expected_base_damage, "%s retains positive authored base damage on an empty/baseline loadout" % hero_id)
	var died_count := [0]
	boss.died.connect(func(_enemy: Node) -> void: died_count[0] += 1)
	var safety := 0
	var maximum_expected_swings := ceili(float(boss.max_health) / float(base_damage)) + 3
	while boss.health > 0 and safety < maximum_expected_swings:
		boss.take_damage(base_damage, player.global_position)
		if boss.phase == 2 and String((boss.get_runtime_snapshot() as Dictionary).get("state", "")) == "phase_transition":
			boss.call(&"_update_phase_transition", 1.20)
		safety += 1
	await get_tree().process_frame
	_expect(
		boss.health == 0
			and int(died_count[0]) == 1
			and safety < maximum_expected_swings,
		"%s can clear both scaled boss phases using only its base Normal Attack damage" % hero_id,
	)
	_expect(exit_gate != null and exit_gate.is_open and GameSession.sigils == 1, "%s boss kill grants exactly one key and opens the real exit" % hero_id)
	if exit_gate != null:
		exit_gate.call(&"_on_body_entered", player)
	await get_tree().process_frame
	_expect(GameSession.objective_finished, "%s crosses the north portal and completes Level 10" % hero_id)
	await _teardown_game(game)


func _spawn_game() -> Node2D:
	get_tree().paused = false
	var game := GAME_SCENE.instantiate() as Node2D
	if game == null:
		return null
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	return game


func _teardown_game(game: Node) -> void:
	if not is_instance_valid(game):
		return
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer", true, false):
		(audio_node as AudioStreamPlayer).stop()
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer2D", true, false):
		(audio_node as AudioStreamPlayer2D).stop()
	game.queue_free()
	await get_tree().process_frame


func _live_entities(entity_root: Node2D) -> Dictionary:
	var result := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = child
	return result


func _count_live_type(entity_root: Node2D, entity_type: String) -> int:
	var result := 0
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_type", "")) == entity_type and not child.is_queued_for_deletion():
			result += 1
	return result


func _count_owned_discs(entity_root: Node2D, boss_id: int) -> int:
	var result := 0
	for child: Node in entity_root.get_children():
		if child is SpectralDisc and int(child.get_meta(&"castellan_projectile_owner", 0)) == boss_id and not child.is_queued_for_deletion():
			result += 1
	return result


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 10 LIVE RUNTIME FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 10 LIVE RUNTIME PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 10 LIVE RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
