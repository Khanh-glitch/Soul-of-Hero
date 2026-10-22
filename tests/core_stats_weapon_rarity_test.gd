extends SceneTree

const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const MANAGER_SCRIPT := preload("res://game/heroes/hero_soul_manager.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_three_plain_core_stats()
	_test_smooth_growth_projection()
	_test_rare_sword_live_damage_delta()
	_finish()


func _test_three_plain_core_stats() -> void:
	_expect(PROGRESSION.CORE_STAT_IDS == [&"hp", &"mana", &"damage"], "core schema keeps the stable HP, Mana and Power storage keys")
	var definitions := PROGRESSION.core_stat_definitions()
	_expect(definitions.size() == 3, "core schema cannot expose a fourth allocatable stat")
	for stat_id: StringName in PROGRESSION.CORE_STAT_IDS:
		var definition := definitions.get(String(stat_id), {}) as Dictionary
		_expect(not bool(definition.get("has_secondary_effects", true)), "%s remains a plain numeric stat" % stat_id)
	var snapshot := PROGRESSION.stat_snapshot(20, {"hp": 10, "mana": 40, "damage": 50})
	_expect((snapshot.get("secondary_effects", []) as Array).is_empty(), "allocating core stats emits no perks or secondary effects")
	_expect((snapshot.get("milestones", {}) as Dictionary).values().all(func(value: Variant) -> bool: return (value as Array).is_empty()), "legacy milestone IDs are inert in the live snapshot")


func _test_smooth_growth_projection() -> void:
	var level_five := PROGRESSION.level_growth_snapshot(5)
	var level_six := PROGRESSION.level_growth_snapshot(6)
	_expect_close(float(level_six["hp_flat"]) - float(level_five["hp_flat"]), 19.2119202, "level six continues the smooth diminishing HP curve")
	_expect_close(float(level_six["damage_percent"]) - float(level_five["damage_percent"]), 0.0, "level six grants no automatic Power")
	_expect_close(float(level_six["mana_flat"]) - float(level_five["mana_flat"]), 9.6059601, "level six continues the smooth diminishing Mana curve")
	_expect(not bool(level_five.get("next_level_is_surge", true)), "growth projection keeps the retired surge flag false")


func _test_rare_sword_live_damage_delta() -> void:
	var normal := SOUL_RULES.create_instance(
		&"sword_hero", SOUL_RULES.Rarity.NORMAL, 1, &"core_test_normal", 76001
	)
	var rare := SOUL_RULES.create_instance(
		&"sword_hero", SOUL_RULES.Rarity.RARE, 9, &"core_test_rare", 76002
	)
	# Isolate inherent weapon power: these two live affixes do not modify core
	# or Normal Attack Power, so the before/after delta proves the weapon-Power rule.
	rare["affixes"] = [
		{"affix_id": "defense_while_attacking", "value": 4.0},
		{"affix_id": "active_power", "value": 6.0},
	]
	_expect_close(float(rare.get("weapon_damage_percent", 0.0)), 128.0, "Rare Lv9 Sword exposes 128% character Power")
	_expect(int(rare.get("affix_slot_capacity", 0)) == 2, "Rare weapon exposes two affix slots")
	_expect((SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.ETERNAL, 9, &"tier_test", 76003).get("affixes", []) as Array).size() == 7, "Eternal equipment opens seven affix slots")

	var player := Node2D.new()
	root.add_child(player)
	var manager := MANAGER_SCRIPT.new() as HeroSoulManager
	player.add_child(manager)
	manager.set_process(false)
	_expect(manager.configure_team(player, SWORD, null), "live manager configures the Sword hero")
	var baseline_save := _save_with_selection(normal, normal)
	_expect(manager.configure_combat_stats_from_save(baseline_save, 100.0, 100.0), "live manager equips the Normal Sword")
	var baseline := manager.get_active_combat_snapshot()
	var baseline_hit := manager.scale_active_action_damage(&"normal_attack", 20.0)
	var rare_save := _save_with_selection(normal, rare)
	_expect(manager.configure_combat_stats_from_save(rare_save, 100.0, 100.0), "live manager equips the Rare Sword immediately")
	var upgraded := manager.get_active_combat_snapshot()
	var upgraded_hit := manager.scale_active_action_damage(&"normal_attack", 20.0)
	_expect_close(float(baseline.get("character_damage", 0.0)), float(upgraded.get("character_damage", -1.0)), "equipping a weapon does not rewrite the character's plain Power stat")
	_expect_close(float(baseline.get("damage", 0.0)), 20.0, "Normal Sword consumes 100% of character Power")
	_expect_close(float(upgraded.get("damage", 0.0)), 25.6, "Rare Lv9 Sword consumes 128% of character Power")
	_expect(baseline_hit == 20 and upgraded_hit == 26, "real Normal Attack damage jumps from 20 to 26 after equip")
	_expect((upgraded.get("core_stat_ids", []) as Array) == [&"hp", &"mana", &"damage"], "live snapshot still exposes exactly the three core stats")
	player.free()


func _save_with_selection(starter: Dictionary, selected: Dictionary) -> Dictionary:
	return {
		"progression": {
			"player": {
				"level": 1,
				"stat_allocation": {"hp": 0, "mana": 0, "damage": 0},
				"skill_allocations": {"sword_hero": PROGRESSION.empty_skill_tracks()},
			},
		},
		"inventory": {
			"hero_souls": [starter.duplicate(true), selected.duplicate(true)],
			"auxiliary_equipment": [],
		},
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": ["", ""],
			"selected_soul_instances": {"sword_hero": String(selected["instance_id"])},
		},
		"auxiliary_loadout": {"soul_vessel": "", "soul_boots": "", "soul_trace": ""},
	}


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("CORE STATS + WEAPON RARITY TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("CORE STATS + WEAPON RARITY TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
