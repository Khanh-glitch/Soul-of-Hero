extends SceneTree

const SCENE := preload("res://game/ui/screens/hub/tabs/arsenal_tab.tscn")
const HERO_SOUL_MANAGER := preload("res://game/heroes/hero_soul_manager.gd")
const PROGRESSION := preload("res://game/meta/progression/player_progression_rules.gd")
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ARCHER: HeroDefinition = preload("res://game/heroes/data/archer_hero.tres")
const AXE: HeroDefinition = preload("res://game/heroes/data/axe_hero.tres")
const ARSENAL_SOURCE_PATH := "res://game/ui/screens/hub/tabs/arsenal_tab.gd"
const HERO_DEFINITIONS := {
	"sword_hero": SWORD,
	"archer_hero": ARCHER,
	"axe_hero": AXE,
}

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var ui := SCENE.instantiate()
	root.add_child(ui)
	await process_frame
	await process_frame
	var minimum_size: Vector2 = ui.get_combined_minimum_size()
	_expect(minimum_size.x <= 624.0, "Arsenal meta UI fits the 640px logical viewport (minimum %.1fpx)" % minimum_size.x)
	var tabs := _find_type(ui, "TabContainer") as TabContainer
	_expect(tabs != null and tabs.get_tab_count() == 4, "Meta UI exposes four focused progression sections")
	var visible_text := _collect_text(ui).to_upper()
	_expect("CHỈ SỐ" in visible_text and "HERO SOUL" in visible_text, "Snapshot and inventory are visible without external documentation")
	_expect("THUỘC TÍNH" in visible_text and "THƯỜNG" in visible_text, "Hero Soul detail exposes rarity and affix capacity")
	_expect("ĐÒN CƠ BẢN" in visible_text and "CÔNG THỨC V" in visible_text, "effective base-hit preview and formula version are player-facing")
	_test_projection_source_and_runtime_parity(ui)
	_test_exact_next_point_projection(ui)
	_test_unsupported_affix_comparison(ui)
	var has_real_stat_action := false
	for button: Button in _buttons(ui):
		if button.text == "+1":
			has_real_stat_action = button.pressed.get_connections().size() > 0
			break
	_expect(has_real_stat_action, "Allocation action is connected and uses an explicit unlock state")
	_expect("TRANG BỊ" in visible_text and "BÁN" in visible_text, "Auxiliary inventory exposes its persisted actions")
	_expect(ui.has_method("_equip_aux") and ui.has_method("_sell_aux"), "Auxiliary equip and sell actions use real SaveService seams")
	ui.free()
	if _failures.is_empty():
		print("META PROGRESSION UI TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures: push_error(failure)
		quit(1)


func _test_projection_source_and_runtime_parity(ui: Node) -> void:
	var source := FileAccess.get_file_as_string(ARSENAL_SOURCE_PATH)
	_expect(
		source.contains("HERO_SOUL_MANAGER.project_hero_combat"),
		"Arsenal delegates combat projection to HeroSoulManager's pure entry"
	)
	_expect(
		not source.contains("next_point_returns")
		and not source.contains("core_damage_multiplier")
		and not source.contains("weapon_damage_multiplier"),
		"Arsenal copies neither legacy next-point returns nor combat multipliers"
	)
	_expect(
		source.contains("_snapshot_with_selected_soul")
		and source.contains("selected_soul_instances"),
		"Soul comparison projects a cloned selection instead of counting affixes"
	)
	var save := root.get_node_or_null("/root/SaveService")
	_expect(save != null and save.has_method("get_snapshot"), "runtime parity has a read-only full SaveService snapshot")
	if save == null or not save.has_method("get_snapshot"):
		return
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var team_value: Variant = snapshot.get("soul_team", {})
	var team := team_value as Dictionary if team_value is Dictionary else {}
	var hero_id := String(team.get("active_hero", ""))
	var hero := HERO_DEFINITIONS.get(hero_id) as HeroDefinition
	var expected := (
		HERO_SOUL_MANAGER.project_hero_combat(snapshot, hero)
		if hero != null
		else {}
	)
	var summary := ui.find_child("EffectiveCombatSummary", true, false) as Label
	_expect(summary != null and not expected.is_empty(), "active Hero effective summary has a valid pure projection")
	if summary == null or expected.is_empty():
		return
	var hp_copy := String(ui.call("_number_copy", float(expected.get("hp", 0.0))))
	var mana_copy := String(ui.call("_number_copy", float(expected.get("mana", 0.0))))
	var damage_copy := String(ui.call(
		"_number_copy",
		float(expected.get("character_damage", 0.0))
	))
	_expect(
		summary.text.contains("HP %s" % hp_copy)
		and summary.text.contains("MANA %s" % mana_copy)
		and summary.text.contains("POWER %s" % damage_copy)
		and summary.text.contains("CÔNG THỨC V%d" % int(expected.get("formula_version", 0))),
		"rendered effective HP/Mana/Power and version equal the pure manager projection"
	)


func _test_exact_next_point_projection(ui: Node) -> void:
	var fixture := _comparison_fixture()
	var projected_next: Dictionary = ui.call(
		"_next_stat_projection",
		fixture,
		SWORD,
		&"damage"
	)
	var explicit_next := fixture.duplicate(true)
	var progression: Dictionary = explicit_next["progression"]
	var player: Dictionary = progression["player"]
	var allocation: Dictionary = player["stat_allocation"]
	allocation["damage"] = 1
	player["stat_allocation"] = allocation
	progression["player"] = player
	explicit_next["progression"] = progression
	var expected := HERO_SOUL_MANAGER.project_hero_combat(explicit_next, SWORD)
	_expect(not projected_next.is_empty() and not expected.is_empty(), "valid next Stat Point produces a read-only projection")
	_expect_close(
		float(projected_next.get("character_damage", 0.0)),
		float(expected.get("character_damage", -1.0)),
		"next Power point preview equals cloning the save and re-projecting"
	)
	_expect_close(
		float(projected_next.get("damage", 0.0)),
		float(expected.get("damage", -1.0)),
		"next Power point includes the selected weapon's exact effective delta"
	)
	var malformed := fixture.duplicate(true)
	malformed.erase("progression")
	_expect(
		(ui.call("_next_stat_projection", malformed, SWORD, &"damage") as Dictionary).is_empty(),
		"next-point preview fails closed when persisted progression is missing"
	)


func _test_unsupported_affix_comparison(ui: Node) -> void:
	var fixture := _comparison_fixture()
	var inventory: Dictionary = fixture["inventory"]
	var souls: Array = inventory["hero_souls"]
	var equipped := souls[0] as Dictionary
	var candidate := souls[1] as Dictionary
	_expect(SOULS.validate_instance(equipped).is_empty(), "unsupported-affix baseline fixture is a valid Hero Soul")
	_expect(SOULS.validate_instance(candidate).is_empty(), "unsupported-affix candidate fixture is a valid Hero Soul")
	var comparison := String(ui.call(
		"_comparison_copy",
		candidate,
		equipped,
		fixture
	))
	_expect(
		comparison.contains("ĐÒN CƠ BẢN 0")
		and comparison.contains("HP 0")
		and comparison.contains("MANA 0"),
		"unsupported affix roll differences advertise no fake HP/Mana/base-hit power"
	)


func _comparison_fixture() -> Dictionary:
	var equipped := SOULS.create_instance(
		&"sword_hero", SOULS.Rarity.MAGIC, 1, &"ui_parity_equipped", 81001
	)
	var candidate := SOULS.create_instance(
		&"sword_hero", SOULS.Rarity.MAGIC, 1, &"ui_parity_candidate", 81002
	)
	equipped["affixes"] = [{"affix_id": "critical_damage", "value": 5.0}]
	candidate["affixes"] = [{"affix_id": "critical_damage", "value": 14.0}]
	return {
		"progression": {
			"player": {
				"level": 1,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
				"skill_allocations": {"sword_hero": PROGRESSION.empty_skill_tracks()},
			},
		},
		"inventory": {
			"hero_souls": [equipped, candidate],
			"auxiliary_equipment": [],
		},
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": ["", ""],
			"selected_soul_instances": {
				"sword_hero": String(equipped["instance_id"]),
			},
		},
		"auxiliary_loadout": {
			"soul_vessel": "",
			"soul_boots": "",
			"soul_trace": "",
		},
	}


func _find_type(node: Node, type_name: String) -> Node:
	if node.is_class(type_name): return node
	for child: Node in node.get_children():
		var found := _find_type(child, type_name)
		if found != null: return found
	return null


func _buttons(node: Node) -> Array[Button]:
	var result: Array[Button] = []
	if node is Button: result.append(node)
	for child: Node in node.get_children(): result.append_array(_buttons(child))
	return result


func _collect_text(node: Node) -> String:
	var result := ""
	if node is Label: result += (node as Label).text + "\n"
	elif node is Button: result += (node as Button).text + "\n"
	for child: Node in node.get_children(): result += _collect_text(child)
	return result


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(
		is_equal_approx(actual, expected),
		"%s (expected %.4f, got %.4f)" % [message, expected, actual]
	)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition: _failures.append(message)
