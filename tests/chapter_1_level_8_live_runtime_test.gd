extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_8.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")
const ENEMY_SCALER := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _test_branch(&"reaper", 6, &"vampire", 3)
	await _test_branch(&"vampire", 3, &"reaper", 6)
	_finish()


func _test_branch(
		selected_branch: StringName,
		expected_count: int,
		unselected_branch: StringName,
		unselected_count: int,
) -> void:
	var game := await _spawn_game()
	_expect(game != null, "%s route starts the shared gameplay scene" % selected_branch.capitalize())
	if game == null:
		return
	var entity_root := game.get_node("Level/Entities") as Node2D
	var player := game.get_node("Level/Entities/Knight") as Node2D
	var controller := game.get_node_or_null("Level8ReliquaryRuntime")
	var entities := _live_entities(entity_root)
	var chest := entities.get("l8_elite_chest") as RewardChest
	var exit_gate := entities.get("l8_exit") as ExitGate
	_expect(controller != null, "Level 8 installs its dedicated Reliquary runtime")
	if controller == null:
		await _dispose_game(game)
		return
	var initial: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(initial.get("configured", false)) and String(initial.get("selected_branch", "")).is_empty(), "Reliquary starts configured with no implicit branch choice")
	_expect(_count_live_branch_enemies(entity_root) == 0, "All nine alternatives are truly absent before the physical choice")
	_expect(chest != null and chest.is_interaction_locked(), "Elite chest starts interaction-locked")
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Exit starts open; encounter and chest are optional rewards")
	var status_panel := controller.find_child("ReliquaryStatusPanel", true, false) as Control
	_expect(status_panel != null, "Compact Reliquary choice/progress HUD is player-visible")
	for viewport_size: Vector2i in [Vector2i(847, 437), Vector2i(1280, 720)]:
		get_tree().root.size = viewport_size
		await get_tree().process_frame
		var panel_rect := status_panel.get_global_rect() if status_panel != null else Rect2()
		var viewport_rect := get_tree().root.get_visible_rect()
		_expect(
			status_panel != null
				and panel_rect.position.x >= -1.0
				and panel_rect.position.y >= -1.0
				and panel_rect.end.x <= viewport_rect.end.x + 1.0
				and panel_rect.end.y <= viewport_rect.end.y + 1.0,
			"Reliquary HUD stays on-screen at %dx%d" % [viewport_size.x, viewport_size.y],
		)

	var selected_seal := controller.call(&"get_branch_seal", selected_branch) as ReliquaryBranchSeal
	var other_seal := controller.call(&"get_branch_seal", unselected_branch) as ReliquaryBranchSeal
	_expect(selected_seal != null and other_seal != null, "Both authored physical seals exist for the %s choice" % selected_branch)
	if selected_seal == null or other_seal == null:
		await _dispose_game(game)
		return
	selected_seal.call(&"_on_body_entered", player)
	_expect(selected_seal.interact(player), "Player physically presses interact on the %s seal" % selected_branch)
	await get_tree().process_frame
	var chosen: Dictionary = controller.call(&"get_snapshot")
	_expect(String(chosen.get("selected_branch", "")) == String(selected_branch), "First physical choice binds the %s route" % selected_branch)
	_expect(bool(chosen.get("other_branch_locked", false)), "First choice permanently locks the other branch")
	_expect(selected_seal.get_branch_state() == ReliquaryBranchSeal.SealState.CHOSEN and other_seal.get_branch_state() == ReliquaryBranchSeal.SealState.LOCKED, "Chosen seal opens while the other seal visibly locks")
	var selected_barrier := selected_seal.find_child("BarrierShape", true, false) as CollisionShape2D
	var other_barrier := other_seal.find_child("BarrierShape", true, false) as CollisionShape2D
	_expect(selected_barrier != null and selected_barrier.disabled and other_barrier != null and not other_barrier.disabled, "Choice opens only the selected physical passage")
	_expect(int(chosen.get("spawned_count", 0)) == expected_count and int(chosen.get("active_enemies", 0)) == expected_count, "Selected %s branch spawns its exact %d guardians" % [selected_branch, expected_count])
	_expect(_count_live_branch(entity_root, selected_branch) == expected_count, "All selected %s branch actors are live beside the independent approach packs" % selected_branch)
	_expect(_count_live_branch(entity_root, unselected_branch) == 0, "No %s actor from the unselected %d-unit branch ever spawns" % [unselected_branch, unselected_count])
	_expect(not bool(controller.call(&"choose_branch_for_test", unselected_branch)), "A second branch choice is rejected")

	entities = _live_entities(entity_root)
	var elite_id := String(chosen.get("elite_entity_id", ""))
	var elite := entities.get(elite_id) as Node2D
	var elites := get_tree().get_nodes_in_group(&"elite_enemies")
	var level_elites := 0
	for candidate: Node in elites:
		if candidate.get_parent() == entity_root and _is_branch_enemy(candidate, selected_branch):
			level_elites += 1
	_expect(elite != null and level_elites == 1, "Exactly one selected guardian is promoted to Elite")
	var elite_axes: Dictionary = elite.get_meta(&"elite_combat_axes", {}) if elite != null else {}
	_expect(elite != null and StringName(elite.get_meta(&"elite_modifier_id", "")) == &"triple_stat_elite" and elite_axes == ELITE_MODIFIER.get_combat_axes(), "Elite carries the complete authored pressure-axis snapshot")
	var normal := _first_normal_branch_enemy(entity_root, selected_branch, elite_id)
	_expect(normal != null, "Selected branch retains at least one normal comparison guardian")
	if elite != null and normal != null:
		_expect(int(elite.get("max_health")) == roundi(float(normal.get("max_health")) * ELITE_MODIFIER.health_multiplier), "Elite maximum health follows only its authored durability axis")
		var elite_profile: Dictionary = elite.call(&"get_combat_profile")
		var normal_profile: Dictionary = normal.call(&"get_combat_profile")
		_expect(int(elite_profile.get("damage", 0)) == roundi(float(normal_profile.get("damage", 0.0)) * ELITE_MODIFIER.damage_multiplier), "Elite outgoing damage follows only its authored damage axis")
		_expect(is_equal_approx(float(elite_profile.get("cooldown", 0.0)), float(normal_profile.get("cooldown", 0.0)) / ELITE_MODIFIER.attack_rate_multiplier), "Elite cadence follows only its authored attack-rate axis")
		_expect(float(elite_axes.get("sustained_dps", 99.0)) < 2.0, "Elite damage and cadence cannot compose into an accidental 9x DPS spike")
		var elite_xp: Dictionary = elite.get_meta(&"experience_reward_projection", {})
		var normal_xp: Dictionary = normal.get_meta(&"experience_reward_projection", {})
		_expect(ENEMY_SCALER.is_experience_reward_current(elite), "Elite XP is finalized after its combat axes")
		_expect(is_equal_approx(float(elite_xp.get("final_score", -1.0)), float(elite.get("score_reward"))), "Elite XP threat reads the post-Elite final score")
		_expect(String(elite_xp.get("population_plan_signature", "")) == String(normal_xp.get("population_plan_signature", "")) and not String(elite_xp.get("population_plan_signature", "")).is_empty(), "Elite and normal guardians share the realized Level 8 population authority")
		_expect(float(elite_xp.get("reward_units", 0.0)) > float(normal_xp.get("reward_units", 0.0)), "Elite risk pays more XP than its same-branch normal guardian")
	var runtime_before_clear: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(int(runtime_before_clear.get("total_enemies", 0)) == expected_count and int(runtime_before_clear.get("defeated_enemies", -1)) == 0, "Canonical encounter total contains only the selected branch, with no fake defeats")

	_kill_selected_branch(entity_root, selected_branch)
	await get_tree().process_frame
	await get_tree().process_frame
	var cleared: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(cleared.get("branch_clear", false)) and int(cleared.get("defeated_enemies", 0)) == expected_count, "All selected guardians must die before branch clear")
	_expect(chest != null and not chest.is_interaction_locked() and not chest.is_open(), "Branch clear unseals but does not auto-open the real chest")
	_expect(GameSession.sigils == 0 and exit_gate != null and exit_gate.is_open, "Enemy clear grants no sigil but the destination remains open")
	var encounter_before_chest: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(not bool(encounter_before_chest.get("complete", true)), "Encounter remains incomplete until chest interaction")

	chest.call(&"_on_body_entered", player)
	_expect(chest.interact(player), "Player physically presses interact on the unsealed Elite chest")
	await get_tree().process_frame
	var claimed: Dictionary = controller.call(&"get_snapshot")
	var final_encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(bool(claimed.get("chest_claimed", false)) and chest.is_open(), "Chest opened signal records one physical claim")
	_expect(GameSession.sigils == 1, "The claimed Elite chest owns exactly one exit sigil")
	_expect(bool(final_encounter.get("complete", false)) and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Chest claim completes encounter authority and opens the exit")
	_expect(not GameSession.objective_finished, "Chest claim opens the route without auto-completing the level")
	exit_gate.call(&"_on_body_entered", player)
	await get_tree().process_frame
	_expect(GameSession.objective_finished, "Crossing the live north portal completes the selected %s route" % selected_branch)
	await _dispose_game(game)


func _dispose_game(game: Node) -> void:
	if not is_instance_valid(game):
		return
	for audio_node: Node in game.find_children("*", "", true, false):
		if audio_node is AudioStreamPlayer:
			(audio_node as AudioStreamPlayer).stop()
		elif audio_node is AudioStreamPlayer2D:
			(audio_node as AudioStreamPlayer2D).stop()
	game.free()
	# Chest/exit feedback can still own a mixer-side sample for one real tick even
	# after its scene is freed. Waiting here keeps headless shutdown deterministic.
	await get_tree().create_timer(0.10, true).timeout


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


func _count_live_branch_enemies(entity_root: Node2D) -> int:
	return _count_live_branch(entity_root, &"reaper") + _count_live_branch(entity_root, &"vampire")


func _count_live_branch(entity_root: Node2D, branch_id: StringName) -> int:
	var result := 0
	for child: Node in entity_root.get_children():
		if _is_branch_enemy(child, branch_id) and not child.is_queued_for_deletion():
			result += 1
	return result


func _count_live_type(entity_root: Node2D, entity_type: String) -> int:
	var result := 0
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_type", "")) == entity_type and not child.is_queued_for_deletion():
			result += 1
	return result


func _enemy_type_for(branch_id: StringName) -> String:
	return "skeleton_reaper" if branch_id == &"reaper" else "vampire"


func _first_normal_branch_enemy(entity_root: Node2D, branch_id: StringName, elite_id: String) -> Node2D:
	for child: Node in entity_root.get_children():
		if _is_branch_enemy(child, branch_id) \
				and String(child.get_meta(&"level_entity_id", "")) != elite_id:
			return child as Node2D
	return null


func _kill_selected_branch(entity_root: Node2D, branch_id: StringName) -> void:
	var victims: Array[Node] = []
	for child: Node in entity_root.get_children():
		if _is_branch_enemy(child, branch_id) and child.has_method(&"take_damage"):
			victims.append(child)
	for victim: Node in victims:
		victim.call(&"take_damage", 99999, Vector2.ZERO)


func _is_branch_enemy(candidate: Node, branch_id: StringName) -> bool:
	var entity_id := String(candidate.get_meta(&"level_entity_id", ""))
	var expected_prefix := "l8_reaper_" if branch_id == &"reaper" else "l8_vampire_"
	return entity_id.begins_with(expected_prefix) \
		and String(candidate.get_meta(&"level_entity_type", "")) == _enemy_type_for(branch_id)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 8 LIVE RUNTIME FAIL: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 8 LIVE RUNTIME PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("CHAPTER 1 LEVEL 8 LIVE RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
