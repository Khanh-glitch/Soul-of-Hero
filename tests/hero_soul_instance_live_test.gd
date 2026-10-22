extends SceneTree

const TEST_SAVE_PATH := "user://tests/hero_soul_instance_live_test.json"
const REPORT_PATH := "res://.artifacts/hero_soul_instance_live_report.json"
const RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")

var _checks := 0
var _failures: Array[String] = []
var _save: LivingArsenalSaveService
var _soul_a: Dictionary
var _soul_b: Dictionary
var _axe_soul: Dictionary


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_save = root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(_save != null, "SaveService autoload is available")
	if _save == null:
		_finish()
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(_save.configure_storage(TEST_SAVE_PATH, true), "isolated Hero Soul instance profile loads")
	_build_fixture_souls()
	_test_exact_selection_and_protection()
	_test_exact_team_and_migration()
	await _test_live_manager_and_knight()
	_finish()


func _build_fixture_souls() -> void:
	_soul_a = RULES.create_instance(
		&"sword_hero", RULES.Rarity.ETERNAL, 20, &"instance_live_a", 98101,
		RULES.AFFINITY_WARRIOR
	)
	_soul_a["affixes"] = [
		{"affix_id": "max_hp", "value": 5.0},
		{"affix_id": "core_damage", "value": 5.0},
		{"affix_id": "max_mana", "value": 8.0},
		{"affix_id": "melee_damage", "value": 7.0},
		{"affix_id": "active_power", "value": 7.0},
	]
	_soul_b = RULES.create_instance(
		&"sword_hero", RULES.Rarity.ETERNAL, 20, &"instance_live_b", 98102,
		RULES.AFFINITY_WARRIOR
	)
	_soul_b["affixes"] = [
		{"affix_id": "summon_power", "value": 8.0},
		{"affix_id": "departure_power", "value": 8.0},
		{"affix_id": "cooldown_recovery", "value": 4.0},
		{"affix_id": "defense", "value": 7.0},
		{"affix_id": "defense_while_attacking", "value": 4.0},
	]
	_axe_soul = RULES.create_instance(
		&"axe_hero", RULES.Rarity.MAGIC, 6, &"instance_live_axe", 98103,
		RULES.AFFINITY_WARRIOR
	)
	_axe_soul["affixes"] = [
		{"affix_id": "defense_while_attacking", "value": 3.25},
	]
	_expect(_save.grant_hero_soul(_soul_a, "test:instance:grant_a"), "first same-Identity Soul instance is granted")
	_expect(_save.grant_hero_soul(_soul_b, "test:instance:grant_b"), "second same-Identity Soul instance is granted")
	_expect(_save.grant_hero_soul(_axe_soul, "test:instance:grant_axe"), "Axe Soul instance is granted")
	_expect(_save.transact_once(
		"test:instance:feature_fixture",
		func(candidate: Dictionary) -> bool:
			candidate["progression"]["features"]["hero_soul_sell"] = true
			return true
	), "fixture explicitly grants Hero Soul Sell before protection checks")


func _test_exact_selection_and_protection() -> void:
	var soul_a_id := String(_soul_a["instance_id"])
	var soul_b_id := String(_soul_b["instance_id"])
	_expect(
		_save.select_hero_soul_instance(soul_a_id, "test:instance:select_a"),
		"exact first Sword Soul copy selects atomically"
	)
	var team: Dictionary = _save.get_value(["soul_team"], {})
	var selections: Dictionary = team.get("selected_soul_instances", {})
	_expect(String(selections.get("sword_hero", "")) == soul_a_id, "selection stores the exact first instance ID")
	_expect(_equipped_instance_ids("sword_hero") == [soul_a_id], "only the selected same-Identity copy is equipped")
	_expect(
		not _save.sell_hero_soul(soul_a_id, "test:instance:sell_selected"),
		"selected instance is protected from sale"
	)
	_expect(
		_save.select_hero_soul_instance(soul_b_id, "test:instance:select_b"),
		"second same-Identity Soul copy can replace the first"
	)
	_expect(_equipped_instance_ids("sword_hero") == [soul_b_id], "switch clears the previous equipped flag and protects the new copy")
	_expect(_save.reload_save(), "exact Soul selection survives disk reload")
	selections = _save.get_value(["soul_team", "selected_soul_instances"], {})
	_expect(String(selections.get("sword_hero", "")) == soul_b_id, "reload preserves the selected second copy")
	_expect(_equipped_instance_ids("sword_hero") == [soul_b_id], "reload preserves consistent equipped flags")


func _test_exact_team_and_migration() -> void:
	var reserve_ids: Array[String] = [String(_soul_b["instance_id"]), ""]
	_expect(
		_save.set_soul_team_instances(
			String(_axe_soul["instance_id"]),
			reserve_ids,
			"test:instance:exact_team"
		),
		"team placement accepts exact Active Axe and Reserve Sword instances atomically"
	)
	var team: Dictionary = _save.get_value(["soul_team"], {})
	var selections: Dictionary = team.get("selected_soul_instances", {})
	_expect(
		String(team.get("active_hero", "")) == "axe_hero"
		and (team.get("reserve_souls", []) as Array)[0] == "sword_hero",
		"exact-copy team derives matching Hero identities"
	)
	_expect(
		String(selections.get("axe_hero", "")) == String(_axe_soul["instance_id"])
		and String(selections.get("sword_hero", "")) == String(_soul_b["instance_id"]),
		"team transaction stores both exact selected instances"
	)

	var before := _save.get_snapshot()
	var before_count := (_save.get_value(["inventory", "hero_souls"], []) as Array).size()
	var before_gold := int(_save.get_value(["currencies", "account"], 0))
	var legacy := before.duplicate(true)
	(legacy["soul_team"] as Dictionary).erase("selected_soul_instances")
	var legacy_inventory := legacy["inventory"] as Dictionary
	var legacy_souls: Array = (legacy_inventory.get("hero_souls", []) as Array).duplicate(true)
	for index: int in legacy_souls.size():
		var soul := (legacy_souls[index] as Dictionary).duplicate(true)
		soul["equipped"] = false
		legacy_souls[index] = soul
	legacy_inventory["hero_souls"] = legacy_souls
	legacy["inventory"] = legacy_inventory
	_expect(_write_raw_profile(legacy), "legacy profile without instance mapping is authored for migration")
	_expect(_save.reload_save(), "legacy instance selection migrates without a schema reset")
	team = _save.get_value(["soul_team"], {})
	selections = team.get("selected_soul_instances", {})
	_expect(
		String(selections.get("axe_hero", "")) == String(_axe_soul["instance_id"]),
		"migration deterministically selects the only active Axe instance"
	)
	var soul_a_id := String(_soul_a["instance_id"])
	var soul_b_id := String(_soul_b["instance_id"])
	var expected_best_sword := soul_a_id if soul_a_id < soul_b_id else soul_b_id
	_expect(
		String(selections.get("sword_hero", "")) == expected_best_sword,
		"migration deterministically selects the best same-Identity Sword copy when no old copy was equipped"
	)
	_expect(
		(_save.get_value(["inventory", "hero_souls"], []) as Array).size() == before_count
		and int(_save.get_value(["currencies", "account"], 0)) == before_gold,
		"migration duplicates neither Soul inventory nor economy"
	)
	_expect(_equipped_instance_ids("axe_hero") == [String(_axe_soul["instance_id"])], "migration rewrites the active Axe equipped flag consistently")


func _test_live_manager_and_knight() -> void:
	var empty_reserves: Array[String] = ["", ""]
	_expect(
		_save.set_soul_team_instances(
			String(_soul_a["instance_id"]), empty_reserves, "test:instance:runtime_team_a"
		),
		"runtime fixture selects first Sword instance as Active"
	)
	var controlled := Node2D.new()
	root.add_child(controlled)
	var manager := HeroSoulManager.new()
	controlled.add_child(manager)
	_expect(manager.configure_team(controlled, SWORD, null), "HeroSoulManager configures Active Sword")
	_expect(manager.configure_combat_stats_from_save(_save.get_snapshot(), 100.0, 100.0), "manager consumes full SaveService snapshot")
	var first := manager.get_active_combat_snapshot()
	_expect_close(float(first.get("hp", 0.0)), 105.0, "selected first copy applies Max HP")
	_expect_close(float(first.get("character_damage", 0.0)), 21.0, "selected first copy applies its core-Power affix to character Power")
	_expect_close(float(first.get("damage", 0.0)), 55.9125, "Eternal Lv20 weapon consumes 266.25 percent of character Power")
	_expect_close(float(first.get("mana", 0.0)), 108.0, "selected first copy applies Max Mana")
	_expect(manager.scale_active_action_damage(&"normal_attack", 20.0) == 60, "selected first copy applies weapon ratio then melee damage to a real action track")
	_expect(manager.scale_active_action_damage(&"active_skill", 20.0) == 60, "selected first copy applies weapon ratio then Active Skill power")
	_expect_close(manager.active_skill_cooldown(10.0), 10.0, "first copy leaves Active Skill cooldown unchanged")
	_expect(String(first.get("selected_hero_soul_instance_id", "")) == String(_soul_a["instance_id"]), "combat snapshot names the exact selected instance")

	_expect(
		_save.select_hero_soul_instance(String(_soul_b["instance_id"]), "test:instance:runtime_select_b"),
		"runtime switches to the second same-Identity copy"
	)
	_expect(manager.configure_combat_stats_from_save(_save.get_snapshot(), 100.0, 100.0), "manager refreshes after exact-copy switch")
	var second := manager.get_active_combat_snapshot()
	_expect_close(float(second.get("hp", 0.0)), 100.0, "second copy removes first copy's Max HP")
	_expect_close(float(second.get("character_damage", 0.0)), 20.0, "second copy removes first copy's core-Power affix")
	_expect_close(float(second.get("damage", 0.0)), 53.25, "second Eternal Lv20 copy retains its inherent weapon ratio")
	_expect_close(float(second.get("mana", 0.0)), 100.0, "second copy removes first copy's Max Mana")
	_expect(manager.scale_active_action_damage(&"unknown_track", 20.0) == 53, "unknown action track still uses weapon Power but receives no accidental affix bonus")
	_expect(manager.scale_active_action_damage(&"summon_skill", 20.0) == 58, "Summon keeps 53.25 weapon damage precise through its 1.08 multiplier")
	_expect(manager.scale_active_action_damage(&"departure_skill", 20.0) == 58, "Departure rounds 57.51 once at the end instead of rounding weapon damage first")
	_expect_close(manager.active_skill_cooldown(10.0), 9.6, "second copy applies capped deterministic cooldown recovery")
	_expect(manager.mitigate_active_incoming_damage(100, false) == 93, "second copy applies unconditional defense")
	_expect(manager.mitigate_active_incoming_damage(100, true) == 89, "second copy adds defense while attacking")
	var state := manager.get_state_snapshot()
	_expect(
		String(state.get("active_soul_instance_id", "")) == String(_soul_b["instance_id"])
		and (state.get("active_soul_live_affixes", []) as Array).size() == 5,
		"runtime state snapshot exposes exact Soul and applied live modifiers"
	)
	_test_auxiliary_effect_projection(manager)

	controlled.free()


func _test_auxiliary_effect_projection(manager: HeroSoulManager) -> void:
	var snapshot := _save.get_snapshot()
	var player: Dictionary = (snapshot["progression"] as Dictionary).get("player", {})
	player["level"] = 7
	(snapshot["progression"] as Dictionary)["player"] = player
	var vessel := AUX_RULES.generate_item(&"soul_vessel", &"rare", 7, 98111, &"instance_live_aux")
	vessel["affixes"] = [
		{"affix_id": "health_regen", "unit": "percent_per_second", "value": 0.5},
		{"affix_id": "damage_reduction", "unit": "percent", "value": 3.0},
	]
	var boots := AUX_RULES.generate_item(&"soul_boots", &"magic", 7, 98112, &"instance_live_aux")
	(boots["primary"] as Dictionary)["value"] = 4.0
	boots["affixes"] = [
		{"affix_id": "movement_speed_percent", "unit": "percent", "value": 5.0},
	]
	var trace := AUX_RULES.generate_item(&"soul_trace", &"magic", 7, 98113, &"instance_live_aux")
	trace["affixes"] = [
		{"affix_id": "cooldown_rate", "unit": "percent", "value": 6.0},
	]
	(snapshot["inventory"] as Dictionary)["auxiliary_equipment"] = [vessel, boots, trace]
	snapshot["auxiliary_loadout"] = {
		"soul_vessel": String(vessel["uuid"]),
		"soul_boots": String(boots["uuid"]),
		"soul_trace": String(trace["uuid"]),
	}
	_expect(manager.configure_combat_stats_from_save(snapshot, 100.0, 100.0), "manager accepts supported auxiliary effect hooks")
	_expect_close(manager.active_skill_cooldown(10.0), 9.0, "Soul and auxiliary cooldown recovery combine")
	_expect(manager.mitigate_active_incoming_damage(100, false) == 90, "auxiliary damage reduction combines with Soul defense")
	_expect(manager.mitigate_active_incoming_damage(100, true) == 86, "combined attack-time defense stays deterministic")
	_expect_close(manager.active_health_regen_per_second(100.0), 0.5, "health_regen projects percent Max HP per second")
	_expect_close(manager.active_move_speed(100.0), 109.0, "Boots primary and affix reach the live movement clock")
	var effects: Dictionary = manager.get_active_combat_snapshot().get("auxiliary_runtime_effects", {})
	_expect((effects.get("applied_live_effects", []) as Array).size() == 5, "all five auxiliary effect hooks are reported as live")
	_expect((effects.get("unsupported_effects", []) as Array).is_empty(), "generated equipment exposes no fake or unsupported stat")


func _equipped_instance_ids(hero_id: String) -> Array[String]:
	var result: Array[String] = []
	for raw_soul: Variant in _save.get_value(["inventory", "hero_souls"], []):
		if raw_soul is Dictionary \
				and String((raw_soul as Dictionary).get("hero_id", "")) == hero_id \
				and bool((raw_soul as Dictionary).get("equipped", false)):
			result.append(String((raw_soul as Dictionary).get("instance_id", "")))
	result.sort()
	return result


func _write_raw_profile(snapshot: Dictionary) -> bool:
	var file := FileAccess.open(TEST_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(snapshot, "\t") + "\n")
	file.close()
	return true


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
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
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print("HERO SOUL INSTANCE LIVE TEST PASSED - %d checks" % _checks)
	else:
		print("HERO SOUL INSTANCE LIVE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
