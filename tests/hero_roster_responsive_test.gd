extends SceneTree

const HOME_SCENE_PATH := "res://game/ui/screens/home/home_map_screen.tscn"
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const TEST_SAVE_PATH := "user://tests/hero_roster_responsive_test.json"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload exists")
	if save == null:
		_finish()
		return
	_remove_generations()
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated Hero Roster profile loads")
	_expect(save.grant_player_levels(5, "test:roster:level_six"), "fixture reaches player level six and opens skill allocation")
	_expect(save.transact_once(
		"test:roster:level_six_features",
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {})
			var features: Dictionary = progression.get("features", {})
			features["skill_allocation"] = true
			features["skill_respec"] = true
			progression["features"] = features
			candidate["progression"] = progression
			return true
	), "fixture applies the authored Level 6 Skill feature reward")
	var axe := SOULS.create_instance(&"axe_hero", SOULS.Rarity.MAGIC, 5, &"responsive_test", 847437)
	_expect(save.grant_hero_soul(axe, "test:roster:axe"), "fixture owns a Magic Axe Hero Soul")
	var vessel := AUX_RULES.generate_item(&"soul_vessel", &"normal", 2, 1280720, &"responsive_test")
	_expect(save.grant_auxiliary_equipment(vessel, "test:roster:vessel"), "fixture owns one equippable Soul Vessel")

	# 1280x720 maps to the project's 640x360 logical canvas. The user's
	# 847x437 embedded window expands horizontally to about 698x360 logical.
	await _exercise_layout(Vector2(640.0, 360.0), "1280x720")
	await _exercise_layout(Vector2(698.0, 360.0), "847x437")
	_finish()


func _exercise_layout(logical_size: Vector2, display_case: String) -> void:
	var host := Control.new()
	host.name = "ResponsiveHost%s" % display_case.replace("x", "_")
	host.size = logical_size
	root.add_child(host)
	var packed := load(HOME_SCENE_PATH) as PackedScene
	_expect(packed != null, "%s loads the production Home Map scene" % display_case)
	if packed == null:
		host.free()
		return
	var home := packed.instantiate() as Control
	host.add_child(home)
	home.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	await process_frame
	home.call("open_function", &"hero_roster")
	await process_frame
	await process_frame

	var roster := home.find_child("HeroRosterTab", true, false) as Control
	var summary := home.find_child("RosterSummary", true, false) as Control
	var tabs := home.find_child("RosterTabs", true, false) as TabContainer
	var split := home.find_child("SoulInventorySplit", true, false) as HSplitContainer
	var sword_card := home.find_child("SwordIdentityButton", true, false) as Button
	var axe_card := home.find_child("AxeIdentityButton", true, false) as Button
	var player_summary := home.find_child("PlayerSummary", true, false) as Label
	_expect(roster != null, "%s instantiates the production Hero Roster inside Home Map" % display_case)
	if roster != null:
		_expect(roster.size.x >= logical_size.x - 20.0, "%s roster fills the Home overlay content width" % display_case)
		_expect(roster.size.y >= 285.0, "%s roster keeps a usable content height" % display_case)
	_expect(summary != null and summary.size.y <= 28.0 and summary.size.x > 500.0, "%s summary stays on one compact row" % display_case)
	_expect(tabs != null and tabs.size.x > 500.0 and tabs.size.y > 245.0, "%s progression tabs remain visible and usable" % display_case)
	_expect(split != null and split.size.x > 500.0 and split.size.y > 135.0, "%s Soul inventory and detail panes receive real space" % display_case)
	_expect(sword_card != null and sword_card.size.x > 180.0 and sword_card.size.y >= 35.0, "%s Sword Identity card is readable" % display_case)
	_expect(axe_card != null and not axe_card.disabled and axe_card.size.x > 180.0, "%s owned Axe Identity card is readable and selectable" % display_case)
	_expect(player_summary != null and "CẤP 6" in player_summary.text and "XP 0" in player_summary.text, "%s header exposes player Level and XP" % display_case)
	if tabs != null:
		_expect(tabs.get_tab_count() == 4, "%s exposes Team & Souls, Stats, Skills and Aux Gear" % display_case)
		for index: int in tabs.get_tab_count():
			tabs.current_tab = index
			await process_frame
			_expect(tabs.get_tab_control(index).visible, "%s tab %d can be opened" % [display_case, index])

	# Exercise the actual Axe selection and Soul Team SaveService seam once.
	if axe_card != null:
		axe_card.pressed.emit()
		await process_frame
		await process_frame
		var set_reserve := _button_with_text(home, "ĐẶT LÀM DỰ BỊ 1")
		var sell_soul := _button_starting_with(home, "BÁN  •")
		var fusion := _button_starting_with(home, "GHÉP ")
		var soul_copy := _collect_text(home)
		_expect("MA THUẬT" in soul_copy and "THUỘC TÍNH 1 / 1" in soul_copy, "%s selected Axe exposes rarity and rolled affix capacity" % display_case)
		_expect("BẢN SAO CUỐI" in soul_copy, "%s last owned Axe Soul exposes its anti-brick protection" % display_case)
		_expect(sell_soul != null and sell_soul.pressed.get_connections().size() > 0, "%s Hero Soul Sell action is connected and visibly gated" % display_case)
		_expect(fusion != null and fusion.pressed.get_connections().size() > 0, "%s Hero Soul Fuse action is connected and visibly gated" % display_case)
		_expect(sell_soul != null and sell_soul.disabled and "Ải 8" in sell_soul.tooltip_text, "%s Sell UI names its real Level 8 feature source" % display_case)
		_expect(fusion != null and fusion.disabled and "Ải 10" in fusion.tooltip_text, "%s Fusion UI names its real Level 10 feature source" % display_case)
		var team: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_value(["soul_team"], {})
		if String((team.get("reserve_souls", ["", ""]) as Array)[0]).is_empty():
			_expect(set_reserve != null and not set_reserve.disabled, "%s Axe exposes a connected Reserve action" % display_case)
			if set_reserve != null and not set_reserve.disabled:
				set_reserve.pressed.emit()
				await process_frame
				var updated: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_value(["soul_team"], {})
				_expect(String((updated.get("reserve_souls", ["", ""]) as Array)[0]) == "axe_hero", "%s Reserve action persists through SaveService" % display_case)
	else:
		_expect(false, "%s cannot exercise Axe selection without its Identity card" % display_case)

	# Stats allocate through the same SaveService used by combat/progression.
	if tabs != null:
		tabs.current_tab = 1
		await process_frame
		var stat_copy := _collect_text(tabs.get_tab_control(1)).to_upper()
		_expect("HP" in stat_copy and "MANA" in stat_copy and "POWER" in stat_copy, "%s Stats UI exposes exactly the three approved base-stat names" % display_case)
		_expect("MILESTONE" not in stat_copy and "MỐC" not in stat_copy and "HIỆU ỨNG" not in stat_copy and "PLANNED" not in stat_copy, "%s Stats UI contains no milestone/effect rows" % display_case)
		var add_stat := _button_with_text(home, "+1")
		var before_stats: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_player_progression_snapshot().get("stats", {})
		var before_hp := int((before_stats.get("allocation", {}) as Dictionary).get("hp", 0))
		_expect(add_stat != null and not add_stat.disabled and add_stat.pressed.get_connections().size() > 0, "%s Stat +1 action is available and connected" % display_case)
		if add_stat != null and not add_stat.disabled:
			add_stat.pressed.emit()
			await process_frame
			var after_stats: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_player_progression_snapshot().get("stats", {})
			_expect(int((after_stats.get("allocation", {}) as Dictionary).get("hp", 0)) == before_hp + 1, "%s Stat +1 persists through SaveService" % display_case)

	# The roster must truthfully expose the now-verified six-track live bridge.
	if tabs != null:
		tabs.current_tab = 2
		await process_frame
		_expect("CẢ 6 NHÁNH ÁP DỤNG TỨC THÌ" in _collect_text(home).to_upper(), "%s Skills tab reports the verified live combat integration" % display_case)
		var sword_skill_identity := home.find_child("SwordSkillIdentityButton", true, false) as Button
		var axe_skill_identity := home.find_child("AxeSkillIdentityButton", true, false) as Button
		_expect(sword_skill_identity != null and not sword_skill_identity.disabled, "%s Skills tab exposes owned Sword Identity" % display_case)
		_expect(axe_skill_identity != null and not axe_skill_identity.disabled, "%s Skills tab exposes owned Axe Identity" % display_case)
		if axe_skill_identity != null and not axe_skill_identity.disabled:
			axe_skill_identity.pressed.emit()
			await process_frame
			var axe_skill_copy := _collect_text(home).to_upper()
			_expect("CHIẾN BINH RÌU" in axe_skill_copy and "ĐẶT LẠI CHIẾN BINH RÌU" in axe_skill_copy, "%s selecting Axe switches the complete skill panel" % display_case)
			var before_skills: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_player_progression_snapshot().get("skills", {})
			var before_axe: Dictionary = (before_skills.get("allocations", {}) as Dictionary).get("axe_hero", {})
			var before_normal := int(before_axe.get("normal_attack", 0))
			var add_axe_skill := _button_with_text(tabs.get_tab_control(2), "+1")
			_expect(add_axe_skill != null and not add_axe_skill.disabled, "%s Axe exposes an enabled rank allocation action" % display_case)
			if add_axe_skill != null and not add_axe_skill.disabled:
				add_axe_skill.pressed.emit()
				await process_frame
				var after_skills: Dictionary = (root.get_node("SaveService") as LivingArsenalSaveService).get_player_progression_snapshot().get("skills", {})
				var after_axe: Dictionary = (after_skills.get("allocations", {}) as Dictionary).get("axe_hero", {})
				_expect(int(after_axe.get("normal_attack", 0)) == before_normal + 1, "%s Axe rank allocation persists through SaveService" % display_case)

	# Aux Gear must show the real fixture item and enabled UUID actions.
	if tabs != null:
		tabs.current_tab = 3
		await process_frame
		var equip := _button_with_text(home, "TRANG BỊ")
		_expect(equip != null and not equip.disabled, "%s unlocked Soul Vessel exposes a usable Equip action" % display_case)
		_expect(_button_with_text(home, "YÊU THÍCH") != null and _button_with_text(home, "KHÓA") != null, "%s auxiliary protection actions are visible" % display_case)
		_expect(_button_starting_with(home, "BÁN ") != null, "%s auxiliary Sell action is visible" % display_case)

	host.free()
	await process_frame


func _button_with_text(node: Node, copy: String) -> Button:
	if node is Button and (node as Button).text == copy:
		return node as Button
	for child: Node in node.get_children():
		var found := _button_with_text(child, copy)
		if found != null:
			return found
	return null


func _button_starting_with(node: Node, prefix: String) -> Button:
	if node is Button and (node as Button).text.begins_with(prefix):
		return node as Button
	for child: Node in node.get_children():
		var found := _button_starting_with(child, prefix)
		if found != null:
			return found
	return null


func _collect_text(node: Node) -> String:
	var result := ""
	if node is Label:
		result += (node as Label).text + "\n"
	elif node is Button:
		result += (node as Button).text + "\n"
	for child: Node in node.get_children():
		result += _collect_text(child)
	return result


func _remove_generations() -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var path := TEST_SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func _finish() -> void:
	_remove_generations()
	if _failures.is_empty():
		print("HERO ROSTER RESPONSIVE TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("HERO ROSTER RESPONSIVE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
