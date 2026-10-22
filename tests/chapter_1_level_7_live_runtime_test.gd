extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_7.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _test_real_threat_and_failure()
	await _test_three_wave_success()
	_finish()


func _test_real_threat_and_failure() -> void:
	var game := await _spawn_game()
	_expect(game != null, "Shared gameplay scene starts Level 7")
	if game == null:
		return
	var entity_root := game.get_node("Level/Entities") as Node2D
	var entities := _live_entities(entity_root)
	var controller := game.get_node_or_null("Level7BeaconRuntime")
	var beacon := entities.get("l7_soul_beacon") as SoulBeacon
	var exit_gate := entities.get("l7_exit") as ExitGate
	_expect(controller != null, "Live Level 7 installs its dedicated Beacon runtime")
	_expect(beacon != null and beacon.health == beacon.max_health, "Live Soul Beacon starts with real full health")
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Live north exit starts open for destination-only completion")
	var beacon_panel := game.get_node_or_null("Level7BeaconRuntime/BeaconHUD/BeaconHUDRoot/BeaconStatusPanel") as Control
	_expect(beacon_panel != null, "Beacon health/wave HUD is player-visible")
	for viewport_size: Vector2i in [Vector2i(847, 437), Vector2i(1280, 720)]:
		get_tree().root.size = viewport_size
		await get_tree().process_frame
		var panel_rect := beacon_panel.get_global_rect() if beacon_panel != null else Rect2()
		var viewport_rect := get_tree().root.get_visible_rect()
		_expect(
			beacon_panel != null
				and panel_rect.position.x >= -1.0
				and panel_rect.position.y >= -1.0
				and panel_rect.end.x <= viewport_rect.end.x + 1.0
				and panel_rect.end.y <= viewport_rect.end.y + 1.0,
			"Beacon HUD stays on-screen at %dx%d" % [viewport_size.x, viewport_size.y],
		)
	var initial_snapshot: Dictionary = controller.call(&"get_snapshot") if controller != null else {}
	_expect(bool(initial_snapshot.get("configured", false)), "Beacon runtime reports a valid three-wave configuration")
	_expect(int(initial_snapshot.get("total_enemies", 0)) == 21 and int(initial_snapshot.get("active_enemies", -1)) == 0, "All twenty-one pack members begin dormant before the warning timer")
	var dormant := 0
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_type", "")) in ["skeleton", "skeleton_reaper", "vampire"]:
			if child.process_mode == Node.PROCESS_MODE_DISABLED and not (child as CanvasItem).visible:
				dormant += 1
	_expect(dormant == 21, "Dormant wave packs cannot attack or body-block before activation")

	_expect(bool(controller.call(&"force_start_next_wave_for_test")), "Focused runtime can advance the authored Wave 1 warning")
	var wave_one: Dictionary = controller.call(&"get_snapshot")
	_expect(int(wave_one.get("wave", 0)) == 1 and int(wave_one.get("active_enemies", 0)) == 6, "Wave 1 activates its five authored enemies plus one runtime pack member")
	var attacker := entities.get("l7_w1_sword_01") as SkeletonEnemy
	_expect(attacker != null and attacker.visible and attacker.process_mode != Node.PROCESS_MODE_DISABLED, "Wave 1 Sword becomes a live actor")
	if attacker != null and beacon != null:
		_expect(attacker.get("_priority_target") == beacon, "Wave attacker targets the Soul Beacon rather than a static marker")
		attacker.global_position = beacon.global_position + Vector2(31.0, 0.0)
		var health_before := beacon.health
		for frame: int in 150:
			await get_tree().physics_frame
			if beacon.health < health_before:
				break
		var attack_area := attacker.get_node("AttackArea") as Area2D
		_expect(
			beacon.health < health_before,
			"Real Skeleton AI reaches and damages the Beacon (state=%s frame=%s distance=%.1f range=%.1f cooldown=%.2f los=%s overlap=%s)" % [
				attacker.get("_state"),
				(attacker.get_node("AnimatedSprite2D") as AnimatedSprite2D).frame,
				attacker.global_position.distance_to(beacon.global_position),
				attacker.attack_range,
				attacker.get("_attack_cooldown_left"),
				attacker.call(&"_has_line_of_sight", beacon),
				attack_area.overlaps_body(beacon),
			],
		)
		attacker.take_damage(9999, Vector2.ZERO)
		await get_tree().process_frame
		var reaper := entities.get("l7_w1_reaper_01") as AdvancedDungeonEnemy
		var reaper_health_before := beacon.health
		if reaper != null:
			reaper.global_position = beacon.global_position + Vector2(118.0, 0.0)
			for frame: int in 240:
				await get_tree().physics_frame
				if beacon.health < reaper_health_before:
					break
		_expect(reaper != null and beacon.health < reaper_health_before, "Real Bone Reaper AI throws a damaging disc at the Beacon")

	if beacon != null:
		beacon.take_damage(beacon.max_health * 2, beacon.global_position + Vector2.LEFT * 32.0)
	await get_tree().process_frame
	var failed_snapshot: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(failed_snapshot.get("failed", false)) and not bool(failed_snapshot.get("cleared", true)), "Beacon death produces a real defense defeat")
	_expect(get_tree().paused, "Beacon defeat freezes harmful gameplay")
	var failure_overlay := game.get_node_or_null("Level7BeaconRuntime/BeaconHUD/BeaconHUDRoot/BeaconFailureOverlay") as Control
	_expect(failure_overlay != null and failure_overlay.visible, "Beacon defeat shows a retry/return failure overlay")
	_expect(
		failure_overlay != null
			and failure_overlay.find_child("RetryButton", true, false) != null
			and failure_overlay.find_child("ReturnHomeButton", true, false) != null,
		"Failure overlay exposes stable Retry and Return actions",
	)
	_expect(exit_gate != null and exit_gate.is_open, "Beacon defense remains optional and never relocks the exit")
	_expect(GameSession.sigils == 0 and not GameSession.objective_finished, "Beacon defeat grants no objective key and no completion")
	get_tree().paused = false
	game.queue_free()
	await get_tree().process_frame


func _test_three_wave_success() -> void:
	var game := await _spawn_game()
	if game == null:
		return
	var entity_root := game.get_node("Level/Entities") as Node2D
	var entities := _live_entities(entity_root)
	var controller := game.get_node("Level7BeaconRuntime")
	var beacon := entities.get("l7_soul_beacon") as SoulBeacon
	var exit_gate := entities.get("l7_exit") as ExitGate
	var expected_active := [6, 7, 8]
	for wave_index: int in 3:
		_expect(bool(controller.call(&"force_start_next_wave_for_test")), "Wave %d starts only after the prior wave is clear" % (wave_index + 1))
		var started: Dictionary = controller.call(&"get_snapshot")
		_expect(int(started.get("wave", 0)) == wave_index + 1, "Wave %d reports its ordered wave number" % (wave_index + 1))
		_expect(int(started.get("active_enemies", 0)) == expected_active[wave_index], "Wave %d activates its authored core plus runtime pack members" % (wave_index + 1))
		_kill_visible_wave(entity_root)
		await get_tree().process_frame
		await get_tree().process_frame
		var cleared_wave: Dictionary = controller.call(&"get_snapshot")
		_expect(int(cleared_wave.get("active_enemies", -1)) == 0, "Wave %d fully clears before another wave can start" % (wave_index + 1))

	await get_tree().process_frame
	var final_snapshot: Dictionary = controller.call(&"get_snapshot")
	var runtime_snapshot: Dictionary = game.call(&"get_runtime_snapshot")
	var encounter: Dictionary = (runtime_snapshot.get("session", {}) as Dictionary).get("encounter", {})
	_expect(bool(final_snapshot.get("cleared", false)) and not bool(final_snapshot.get("failed", true)), "All three waves clear while the Beacon survives")
	_expect(beacon != null and beacon.is_alive(), "Successful defense retains a live Beacon")
	_expect(int(final_snapshot.get("defeated_enemies", 0)) == 21, "Successful defense counts all twenty-one pack deaths exactly once")
	_expect(bool(encounter.get("complete", false)), "Encounter authority confirms both clear-all and Beacon survival objectives")
	_expect(GameSession.sigils == 1, "Beacon stabilization grants the one in-run exit key")
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "North exit remains open after all three optional waves")
	_expect(not GameSession.objective_finished, "Wave clear opens the exit but does not auto-complete the level")
	game.queue_free()
	await get_tree().process_frame


func _spawn_game() -> Node2D:
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


func _live_entities(entity_root: Node2D) -> Dictionary:
	var result := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = child
	return result


func _kill_visible_wave(entity_root: Node2D) -> void:
	var victims: Array[Node] = []
	for child: Node in entity_root.get_children():
		if (
			String(child.get_meta(&"level_entity_type", "")) in ["skeleton", "skeleton_reaper", "vampire"]
			and child is CanvasItem
			and (child as CanvasItem).visible
			and child.has_method(&"take_damage")
		):
			victims.append(child)
	for victim: Node in victims:
		victim.call(&"take_damage", 9999, Vector2.ZERO)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 7 LIVE RUNTIME FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 7 LIVE RUNTIME PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("CHAPTER 1 LEVEL 7 LIVE RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
