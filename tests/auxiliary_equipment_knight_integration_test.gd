extends Node

const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const REPORT_PATH := "res://.artifacts/auxiliary_equipment_knight_integration_report.json"
const RELOAD_CHECK_COUNT_META := &"core_stats_knight_reload_check_count"
const LEVEL_SEVEN_HP := 217
const LEVEL_SEVEN_MANA := 158.519850599
const LEVEL_SEVEN_DAMAGE := 20.0
const LEVEL_TWO_ALLOCATED_HP := 134
const LEVEL_TWO_ALLOCATED_MANA := 117.0
const LEVEL_TWO_ALLOCATED_DAMAGE := 24.74078722294093

var _checks := 0
var _failures: Array[String] = []


func start(_game: Node2D) -> void:
	_run.call_deferred()


func _run() -> void:
	await get_tree().physics_frame
	var knight := get_tree().get_first_node_in_group(&"player") as KnightController
	_expect(knight != null, "runtime Knight is available")
	if knight == null:
		_finish()
		return
	if _is_saved_progression_reload_phase():
		_restore_pre_reload_check_count()
		_test_reloaded_player_progression(knight)
		_finish()
		return

	var items := _controlled_items()
	var equipped := _save_snapshot(items, true)
	var unequipped := _save_snapshot(items, false)
	_expect(knight.refresh_auxiliary_equipment_from_save(unequipped), "Knight accepts an empty shared loadout snapshot")
	var empty_stats := knight.get_combat_stat_snapshot()
	_expect(knight.max_health == LEVEL_SEVEN_HP, "level-seven snapshot applies live baseline Max HP growth")
	_expect(is_equal_approx(knight.max_mana, LEVEL_SEVEN_MANA), "level-seven snapshot applies live baseline Max Mana growth")
	_expect_close(float(empty_stats.get("damage", 0.0)), LEVEL_SEVEN_DAMAGE, "level-seven snapshot grants no automatic Power")
	_expect(
		int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) == 20,
		"baseline level never enters the central Sword hit calculation"
	)

	_expect(knight.refresh_auxiliary_equipment_from_save(equipped), "Knight refreshes all three equipped auxiliary slots")
	var geared_stats := knight.get_combat_stat_snapshot()
	_expect(knight.max_health == 243, "Armor and Boots reach live Knight after level growth")
	_expect(is_equal_approx(knight.max_mana, 166.44584312895), "Jewelry Mana reaches live Knight after level growth")
	_expect_close(float(geared_stats.get("damage", 0.0)), 23.1, "Soul Trace raises Power through the canonical flat and percent buckets")
	var geared_manager := knight.get_hero_soul_manager()
	_expect(geared_manager.mitigate_active_incoming_damage(100, false) == 98, "idle Knight receives Armor but not Footwork")
	knight.player_state = KnightController.PlayerState.MOVE
	knight.velocity = Vector2(60.0, 0.0)
	var moving_context := knight.get_incoming_damage_context()
	var moving_multipliers := moving_context.get("damage_taken_multipliers", {}) as Dictionary
	_expect_close(
		float(moving_multipliers.get("target/active_hero_soul_defense", 0.0)),
		0.95,
		"Knight forwards real movement state so Footwork becomes live"
	)
	knight.current_action = "sword_attack_1"
	knight.player_state = KnightController.PlayerState.ATTACK
	knight.velocity = Vector2(-60.0, 0.0)
	var backpedal_context := knight.get_incoming_damage_context()
	var backpedal_multipliers := backpedal_context.get("damage_taken_multipliers", {}) as Dictionary
	_expect_close(
		float(backpedal_multipliers.get("target/active_hero_soul_defense", 0.0)),
		0.90,
		"backpedaling during an attack combines movement Footwork with attack Guard"
	)
	knight.current_action = "hit"
	knight.player_state = KnightController.PlayerState.HURT
	knight.velocity = Vector2(112.0, 0.0)
	var hurt_context := knight.get_incoming_damage_context()
	var hurt_multipliers := hurt_context.get("damage_taken_multipliers", {}) as Dictionary
	_expect_close(
		float(hurt_multipliers.get("target/active_hero_soul_defense", 0.0)),
		0.98,
		"forced hurt knockback does not masquerade as player Footwork"
	)
	knight.current_action = ""
	knight.player_state = KnightController.PlayerState.MOVE
	knight.velocity = Vector2.ZERO
	var stopped_context := knight.get_incoming_damage_context()
	var stopped_multipliers := stopped_context.get("damage_taken_multipliers", {}) as Dictionary
	_expect_close(
		float(stopped_multipliers.get("target/active_hero_soul_defense", 0.0)),
		0.98,
		"Knight removes Footwork immediately when velocity reaches zero"
	)
	knight.player_state = KnightController.PlayerState.IDLE
	_expect(
		int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) == 23,
		"central Sword hit calculation consumes equipped Power"
	)
	var realtime := knight.get_realtime_state()
	_expect(
		is_equal_approx(float(realtime.get("max_mana", 0.0)), 166.45)
		and not (realtime.get("hero", {}) as Dictionary).get("combat_stats", {}).is_empty(),
		"runtime telemetry publishes the same derived combat snapshot"
	)

	_expect(knight.refresh_auxiliary_equipment_from_save(unequipped), "Knight refreshes after unequipping all three slots")
	var restored := knight.get_combat_stat_snapshot()
	_expect(knight.max_health == LEVEL_SEVEN_HP and is_equal_approx(knight.max_mana, LEVEL_SEVEN_MANA), "unequip removes bonuses while preserving level growth")
	_expect_close(float(restored.get("damage", 0.0)), LEVEL_SEVEN_DAMAGE, "unequip removes the equipment Power bonus")
	_expect(
		int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) == 20,
		"unequip restores authored Power regardless of level"
	)
	if not _test_and_reload_saved_player_progression(knight):
		_finish()


func _test_and_reload_saved_player_progression(knight: KnightController) -> bool:
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "live Knight accepts the authoritative fresh profile")
	_expect(knight.max_health == 100 and is_equal_approx(knight.max_mana, 100.0), "fresh profile enters gameplay at authored HP and Mana")
	_expect(SaveService.grant_player_levels(1, "core_stats_runtime_level_2", {"test": "live_knight"}), "runtime fixture grants enough points through SaveService")
	_expect(int(SaveService.get_player_progression_snapshot().get("player_level", 0)) == 2, "live profile reaches player level two")
	_expect(knight.max_health == 120 and is_equal_approx(knight.max_mana, 110.0), "level-up commit refreshes the live Knight without reopening a screen")

	_expect(SaveService.allocate_player_stat(&"hp", 1, "core_stats_runtime_hp"), "one HP Stat Point allocates through SaveService")
	_expect(knight.max_health == LEVEL_TWO_ALLOCATED_HP, "allocated HP refreshes live Knight Max HP immediately")

	_expect(SaveService.allocate_player_stat(&"damage", 6, "core_stats_runtime_damage"), "six Power points allocate through the stable SaveService key")
	var damage_stats := knight.get_combat_stat_snapshot()
	_expect_close(float(damage_stats.get("damage", 0.0)), LEVEL_TWO_ALLOCATED_DAMAGE, "allocated Power refreshes the live attack snapshot immediately")
	_expect(int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) == 25, "allocated Power changes an actual Sword hit")

	_expect(SaveService.allocate_player_stat(&"mana", 1, "core_stats_runtime_mana"), "one Mana Stat Point allocates through SaveService")
	_expect(is_equal_approx(knight.max_mana, LEVEL_TWO_ALLOCATED_MANA), "allocated Mana refreshes live Knight Max Mana immediately")

	var manager := knight.get_hero_soul_manager()
	_expect(manager.configure_team(knight, SWORD, AXE), "live runtime configures Active Sword and Reserve Axe")
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "shared progression refreshes after team configuration")
	var active := manager.get_active_combat_snapshot()
	var reserve := manager.get_reserve_combat_snapshot()
	_expect_close(float(active.get("hp", 0.0)), LEVEL_TWO_ALLOCATED_HP, "Active Sword receives saved level and HP progression")
	_expect_close(float(reserve.get("hp", 0.0)), LEVEL_TWO_ALLOCATED_HP, "Reserve Axe receives the same saved level and HP progression")
	_expect_close(float(active.get("damage", 0.0)), LEVEL_TWO_ALLOCATED_DAMAGE, "Active Sword receives saved Power progression")
	_expect_close(float(reserve.get("damage", 0.0)), LEVEL_TWO_ALLOCATED_DAMAGE, "Reserve Axe receives the same saved Power progression")
	_expect_close(float(active.get("mana", 0.0)), LEVEL_TWO_ALLOCATED_MANA, "Active Sword receives saved level and Mana progression")
	_expect_close(float(reserve.get("mana", 0.0)), LEVEL_TWO_ALLOCATED_MANA, "Reserve Axe receives the same saved level and Mana progression")
	_expect(SaveService.save_now(), "allocated player progression is durable before gameplay reload")
	if not _failures.is_empty():
		return false

	get_tree().root.set_meta(RELOAD_CHECK_COUNT_META, _checks)
	var reload_error := get_tree().reload_current_scene()
	if reload_error != OK:
		get_tree().root.remove_meta(RELOAD_CHECK_COUNT_META)
		_expect(false, "gameplay scene reload starts successfully")
		return false
	return true


func _test_reloaded_player_progression(knight: KnightController) -> void:
	_expect(SaveService.load_save(), "gameplay reload reads the durable profile from disk")
	var progression := SaveService.get_player_progression_snapshot()
	var stats := progression.get("stats", {}) as Dictionary
	var allocation := stats.get("allocation", {}) as Dictionary
	_expect(int(progression.get("player_level", 0)) == 2, "reloaded gameplay preserves player level")
	_expect(
		int(allocation.get("hp", 0)) == 1
		and int(allocation.get("damage", 0)) == 6
		and int(allocation.get("mana", 0)) == 1,
		"reloaded gameplay preserves all three Stat Point allocations"
	)
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "reloaded Knight consumes the durable profile")
	_expect(knight.max_health == LEVEL_TWO_ALLOCATED_HP, "reloaded live Knight retains level and allocated Max HP")
	_expect(is_equal_approx(knight.max_mana, LEVEL_TWO_ALLOCATED_MANA), "reloaded live Knight retains level and allocated Max Mana")
	_expect_close(float(knight.get_combat_stat_snapshot().get("damage", 0.0)), LEVEL_TWO_ALLOCATED_DAMAGE, "reloaded live Knight retains level and allocated Power")
	_expect(int(knight.call(&"_get_action_damage", "sword_attack_1", {}, 0)) == 25, "reloaded Sword hit retains allocated Power")

	var manager := knight.get_hero_soul_manager()
	_expect(manager.configure_team(knight, SWORD, AXE), "reloaded gameplay restores an Active/Reserve team for parity verification")
	_expect(knight.refresh_auxiliary_equipment_from_save(SaveService.get_snapshot()), "reloaded Active/Reserve team consumes shared progression")
	var reserve := manager.get_reserve_combat_snapshot()
	_expect_close(float(reserve.get("hp", 0.0)), LEVEL_TWO_ALLOCATED_HP, "reloaded Reserve Axe retains shared HP progression")
	_expect_close(float(reserve.get("damage", 0.0)), LEVEL_TWO_ALLOCATED_DAMAGE, "reloaded Reserve Axe retains shared Power progression")
	_expect_close(float(reserve.get("mana", 0.0)), LEVEL_TWO_ALLOCATED_MANA, "reloaded Reserve Axe retains shared Mana progression")


func _is_saved_progression_reload_phase() -> bool:
	var stats := SaveService.get_player_progression_snapshot().get("stats", {}) as Dictionary
	var allocation := stats.get("allocation", {}) as Dictionary
	return (
		int(allocation.get("hp", 0)) == 1
		and int(allocation.get("damage", 0)) == 6
		and int(allocation.get("mana", 0)) == 1
	)


func _restore_pre_reload_check_count() -> void:
	if not get_tree().root.has_meta(RELOAD_CHECK_COUNT_META):
		return
	_checks += int(get_tree().root.get_meta(RELOAD_CHECK_COUNT_META, 0))
	get_tree().root.remove_meta(RELOAD_CHECK_COUNT_META)


func _controlled_items() -> Array:
	var vessel := RULES.generate_item(&"soul_vessel", &"eternal", 7, 92001, &"knight_combat_test")
	(vessel["primary"] as Dictionary)["value"] = 10.0
	vessel["affixes"] = [
		{"affix_id": "max_hp_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "damage_reduction", "unit": "percent", "value": 2.0},
		{"affix_id": "health_regen", "unit": "percent_per_second", "value": 1.0},
		{"affix_id": "healing_received", "unit": "percent", "value": 10.0},
		{"affix_id": "guard_while_attacking", "unit": "percent", "value": 5.0},
	]
	var boots := RULES.generate_item(&"soul_boots", &"eternal", 7, 92002, &"knight_combat_test")
	(boots["primary"] as Dictionary)["value"] = 10.0
	boots["affixes"] = [
		{"affix_id": "movement_speed_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "dash_cooldown_rate", "unit": "percent", "value": 10.0},
		{"affix_id": "dash_speed_percent", "unit": "percent", "value": 20.0},
		{"affix_id": "footwork_damage_reduction", "unit": "percent", "value": 3.0},
		{"affix_id": "max_hp_from_boots_percent", "unit": "percent", "value": 2.0},
	]
	var trace := RULES.generate_item(&"soul_trace", &"eternal", 7, 92003, &"knight_combat_test")
	(trace["primary"] as Dictionary)["value"] = 2.0
	trace["affixes"] = [
		{"affix_id": "damage_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "mana_percent", "unit": "percent", "value": 5.0},
		{"affix_id": "mana_regen", "unit": "flat_per_second", "value": 1.0},
		{"affix_id": "cooldown_rate", "unit": "percent", "value": 4.0},
		{"affix_id": "mana_efficiency", "unit": "percent", "value": 10.0},
	]
	return [vessel, boots, trace]


func _save_snapshot(items: Array, equipped: bool) -> Dictionary:
	return {
		"progression": {"player": {"level": 7}},
		"inventory": {"auxiliary_equipment": items.duplicate(true)},
		"auxiliary_loadout": {
			"soul_vessel": String((items[0] as Dictionary)["uuid"]) if equipped else "",
			"soul_boots": String((items[1] as Dictionary)["uuid"]) if equipped else "",
			"soul_trace": String((items[2] as Dictionary)["uuid"]) if equipped else "",
		},
	}


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify({
			"ok": _failures.is_empty(),
			"checks": _checks,
			"failures": _failures,
		}, "\t") + "\n")
		report.close()
	if _failures.is_empty():
		print("AUXILIARY EQUIPMENT KNIGHT INTEGRATION TEST PASSED - %d checks" % _checks)
	else:
		print("AUXILIARY EQUIPMENT KNIGHT INTEGRATION TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
