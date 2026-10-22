extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_9.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const DIFFICULTY_RULES := preload("res://game/meta/progression/difficulty_rules.gd")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/crimson_reaper_elite.tres")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "Level 9 starts the shared production gameplay scene")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame

	var entity_root := game.get_node("Level/Entities") as Node2D
	var player := game.get_node("Level/Entities/Knight") as Node2D
	var controller := game.get_node_or_null("Level9CrimsonGateRuntime")
	var entities := _live_entities(entity_root)
	var exit_gate := entities.get("l9_exit") as ExitGate
	_expect(controller != null, "Level 9 installs its dedicated Crimson Gate runtime")
	if controller == null:
		await _teardown_game(game)
		_finish()
		return
	var initial: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(initial.get("configured", false)) and int(initial.get("seal_count", 0)) == 3, "Runtime resolves exactly three physical Gate Seals")
	_expect(int(initial.get("activated_seals", -1)) == 0 and not bool(initial.get("boss_spawned", true)), "No seal is faked and the Crimson Reaper is absent before interaction")
	_expect(_count_live_type(entity_root, "gate_seal") == 3, "All three physical GateSeal actors are live")
	_expect(_count_live_type(entity_root, "crimson_reaper") == 0, "Deferred Crimson Reaper marker is truly absent before all seals")
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Exit starts open; seals and boss are optional content")
	var initial_encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(int(initial_encounter.get("total_enemies", 0)) == 1 and int(initial_encounter.get("defeated_enemies", -1)) == 0, "Canonical encounter owns exactly one named enemy, with no fake defeat")

	var panel := controller.find_child("CrimsonGateStatusPanel", true, false) as Control
	var status_label := controller.find_child("CrimsonGateStatusLabel", true, false) as Label
	var progress_label := controller.find_child("SealProgressLabel", true, false) as Label
	_expect(panel != null and status_label != null and progress_label != null, "Compact Crimson Gate objective HUD is player-visible")
	for viewport_size: Vector2i in [Vector2i(847, 437), Vector2i(1280, 720)]:
		get_tree().root.size = viewport_size
		await get_tree().process_frame
		var panel_rect := panel.get_global_rect() if panel != null else Rect2()
		var viewport_rect := get_tree().root.get_visible_rect()
		_expect(
			panel != null
				and panel_rect.position.x >= -1.0
				and panel_rect.position.y >= -1.0
				and panel_rect.end.x <= viewport_rect.end.x + 1.0
				and panel_rect.end.y <= viewport_rect.end.y + 1.0,
			"Crimson Gate HUD stays on-screen at %dx%d" % [viewport_size.x, viewport_size.y],
		)

	var seal_ids: Array[StringName] = [&"l9_west_gate_seal", &"l9_east_gate_seal", &"l9_north_gate_seal"]
	for index: int in seal_ids.size():
		var seal_id := seal_ids[index]
		var seal := controller.call(&"get_gate_seal", seal_id) as GateSeal
		_expect(seal != null, "%s resolves to a real GateSeal interactable" % seal_id)
		if seal == null:
			continue
		seal.call(&"_on_body_entered", player)
		_expect(seal.can_interact(player), "%s becomes interactable only near the player" % seal_id)
		_expect(seal.interact(player), "Player physically presses interact on %s" % seal_id)
		await get_tree().process_frame
		var after_seal: Dictionary = controller.call(&"get_snapshot")
		_expect(seal.is_activated() and int(after_seal.get("activated_seals", 0)) == index + 1, "Physical seal %d advances the objective exactly once" % [index + 1])
		_expect(GameSession.sigils == index + 1, "Physical seal %d owns portal sigil %d/3" % [index + 1, index + 1])
		if index < 2:
			_expect(not bool(after_seal.get("boss_spawned", true)) and _count_live_type(entity_root, "crimson_reaper") == 0, "Crimson Reaper remains absent after only %d seal(s)" % [index + 1])

	var after_three: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(after_three.get("all_seals_broken", false)) and bool(after_three.get("boss_spawned", false)), "Third physical seal awakens the Crimson Reaper")
	_expect(int(after_three.get("activated_seals", 0)) == 3 and GameSession.sigils == 3, "Seal and portal counters stop at exactly 3/3")
	_expect(_count_live_type(entity_root, "crimson_reaper") == 1, "Exactly one dedicated Crimson Reaper actor materializes")
	_expect(String(after_three.get("boss_runtime_identity", "")) == "crimson_reaper" and String(after_three.get("boss_display_name", "")) == "Crimson Reaper", "Boss exposes its distinct runtime identity and readable name")
	_expect(String(after_three.get("elite_modifier_id", "")) == "crimson_reaper_elite" and (after_three.get("elite_combat_axes", {}) as Dictionary) == ELITE_MODIFIER.get_combat_axes(), "Boss carries the dedicated authored Elite pressure axes")
	_expect(exit_gate != null and exit_gate.is_open, "Three seals do not change the already-open destination")

	var boss := controller.call(&"get_crimson_reaper") as Node2D
	_expect(boss is CrimsonReaperEnemy, "Spawned boss uses the dedicated CrimsonReaperEnemy runtime class")
	_expect(boss != null and boss.is_in_group(&"elite_enemies") and boss.is_in_group(&"enemy_crimson_reaper"), "Boss is both a live Elite and its own combat identity")
	var nameplate := boss.find_child("BossNameplate", true, false) as Label if boss != null else null
	_expect(nameplate != null and nameplate.text == "CRIMSON REAPER" and nameplate.modulate.a > 0.0, "Crimson nameplate makes the named Elite readable in combat")
	if boss != null:
		var profile: Dictionary = boss.call(&"get_combat_profile")
		var stage_projection := DIFFICULTY_RULES.stage_modifiers(
			9,
			GameSession.active_difficulty,
		)
		var projected_base_health := roundi(86.0 * float(stage_projection["health_multiplier"]))
		var projected_base_damage := roundi(14.0 * float(stage_projection["damage_multiplier"]))
		_expect(
			int(boss.get("max_health")) == roundi(float(projected_base_health) * ELITE_MODIFIER.health_multiplier)
				and int(boss.get("health")) == int(boss.get("max_health")),
			"Elite durability axis applies after the Level 9/difficulty projection and refills health",
		)
		_expect(
			int(profile.get("damage", 0)) == roundi(float(projected_base_damage) * ELITE_MODIFIER.damage_multiplier),
			"Elite damage axis applies after the Level 9/difficulty projection",
		)
		_expect(is_equal_approx(float(profile.get("cooldown", 0.0)), 2.1 / ELITE_MODIFIER.attack_rate_multiplier), "Elite cadence follows only its authored attack-rate axis")
		var xp_projection: Dictionary = boss.get_meta(&"experience_reward_projection", {})
		_expect(ENEMY_SCALER.is_experience_reward_current(boss), "Crimson Reaper XP is finalized after the Elite axes")
		_expect(is_equal_approx(float(xp_projection.get("final_score", -1.0)), float(boss.get("score_reward"))), "Crimson Reaper XP threat reads the post-Elite final score")
		_expect(String(xp_projection.get("elite_modifier_id", "")) == "crimson_reaper_elite" and not String(xp_projection.get("population_plan_signature", "")).is_empty(), "Crimson Reaper XP carries its Elite identity and realized Level 9 plan signature")
		_expect(float((ELITE_MODIFIER.get_combat_axes() as Dictionary).get("sustained_dps", 99.0)) < 2.0, "Crimson Reaper Elite cannot compose into an accidental 9x DPS spike")
	var level_elites := 0
	for candidate: Node in get_tree().get_nodes_in_group(&"elite_enemies"):
		if candidate.get_parent() == entity_root \
				and String(candidate.get_meta(&"level_entity_id", "")) == "l9_crimson_reaper":
			level_elites += 1
	_expect(level_elites == 1, "Level 9 contains exactly one named objective Elite beside optional mutated pack enemies")

	var first_seal := controller.call(&"get_gate_seal", seal_ids[0]) as GateSeal
	first_seal.call(&"_on_body_entered", player)
	_expect(first_seal.interact(player), "Re-interacting an already broken seal is safely consumed")
	await get_tree().process_frame
	var after_repeat: Dictionary = controller.call(&"get_snapshot")
	_expect(int(after_repeat.get("activated_seals", 0)) == 3 and GameSession.sigils == 3, "Repeated seal interaction cannot duplicate objective or sigil progress")
	var encounter_before_kill: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(int((encounter_before_kill.get("custom_events", {}) as Dictionary).get("gate_seal_collected", 0)) == 3, "Canonical event count remains exactly three")
	_expect(not bool(encounter_before_kill.get("complete", true)), "Encounter remains incomplete until the named Elite dies")

	boss.call(&"take_damage", 99999, Vector2.ZERO)
	await get_tree().process_frame
	await get_tree().process_frame
	var final: Dictionary = controller.call(&"get_snapshot")
	var final_encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(bool(final.get("boss_defeated", false)), "Dedicated boss death updates the Crimson Gate runtime")
	_expect(int(final_encounter.get("defeated_enemies", 0)) == 1 and bool(final_encounter.get("complete", false)), "Canonical encounter records exactly one authoritative enemy death")
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Three physical seals plus boss death open the real exit")
	_expect(status_label != null and status_label.text.contains("ĐÃ HẠ"), "Objective HUD visibly directs the player to the open portal")
	_expect(not GameSession.objective_finished, "Boss death opens the route without auto-completing the level")
	exit_gate.call(&"_on_body_entered", player)
	await get_tree().process_frame
	_expect(GameSession.objective_finished, "Crossing the live north portal completes Level 9")
	await _teardown_game(game)
	_finish()


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


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 9 LIVE RUNTIME FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 9 LIVE RUNTIME PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 9 LIVE RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
