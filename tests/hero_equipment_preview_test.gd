extends SceneTree

const PREVIEW := preload("res://game/ui/screens/hub/tabs/components/hero_equipment_preview.gd")
const MANAGER := preload("res://game/heroes/hero_soul_manager.gd")
const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")
const ROSTER_SOURCE := "res://game/ui/screens/hub/tabs/arsenal_tab.gd"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var old_soul: Dictionary = SOULS.create_instance(
		&"sword_hero", SOULS.Rarity.NORMAL, 3, &"preview_old_soul", 1201
	)
	var new_soul: Dictionary = SOULS.create_instance(
		&"sword_hero", SOULS.Rarity.MAGIC, 7, &"preview_new_soul", 1202
	)
	var archer_soul: Dictionary = SOULS.create_instance(
		&"archer_hero", SOULS.Rarity.NORMAL, 3, &"preview_archer", 1203
	)
	var armor: Dictionary = AUX_RULES.generate_item(
		&"soul_vessel", &"normal", 7, 606, &"preview_armor"
	)
	var boots: Dictionary = AUX_RULES.generate_item(
		&"soul_boots", &"normal", 7, 607, &"preview_boots"
	)
	var jewelry: Dictionary = AUX_RULES.generate_item(
		&"soul_trace", &"normal", 7, 608, &"preview_jewelry"
	)
	for item: Dictionary in [armor, boots, jewelry]:
		_expect(AUX_RULES.validate_item(item).is_empty(),
			"Canonical generated auxiliary instance validates")
	var fixture := {
		"progression": {
			"player": {
				"level": 7,
				"stat_allocation": {"hp": 0, "damage": 0, "mana": 0},
			},
			"unlocked_heroes": {"sword_hero": true, "archer_hero": true},
		},
		"inventory": {
			"hero_souls": [old_soul, new_soul, archer_soul],
			"auxiliary_equipment": [armor, boots, jewelry],
		},
		"hero_loadouts": {
			"sword_hero": {
				"hero_weapon": String(old_soul["instance_id"]),
				"armor": "", "boots": "", "jewelry": "",
			},
			"archer_hero": {
				"hero_weapon": String(archer_soul["instance_id"]),
				"armor": String(armor["uuid"]),
				"boots": "", "jewelry": "",
			},
		},
		"auxiliary_loadout": {
			"soul_vessel": "", "soul_boots": "", "soul_trace": "",
		},
		"soul_team": {
			"active_hero": "sword_hero",
			"reserve_souls": ["archer_hero"],
			"selected_soul_instances": {
				"sword_hero": String(old_soul["instance_id"]),
				"archer_hero": String(archer_soul["instance_id"]),
			},
		},
	}
	var original: Dictionary = fixture.duplicate(true)
	var base := MANAGER.project_hero_combat(fixture, SWORD)
	_expect(not base.is_empty(), "Base combat projection available for Sword")
	var weapon := PREVIEW.compare(
		fixture, "sword_hero", "hero_weapon", String(new_soul["instance_id"])
	)
	_expect(not weapon.is_empty(), "New Hero Weapon has exact-instance preview")
	if not weapon.is_empty():
		var manual := fixture.duplicate(true)
		manual["hero_loadouts"]["sword_hero"]["hero_weapon"] = String(new_soul["instance_id"])
		manual["soul_team"]["selected_soul_instances"]["sword_hero"] = String(new_soul["instance_id"])
		_expect_projection(weapon, MANAGER.project_hero_combat(manual, SWORD),
			"Hero Weapon preview matches manual clone")
		_expect(String(weapon.get("preview_slot", "")) == "hero_weapon",
			"Weapon comparison returns the correct equipment slot")
	var armor_preview := PREVIEW.compare(
		fixture, "sword_hero", "armor", String(armor["uuid"])
	)
	_expect(not armor_preview.is_empty(), "Armor transfer can be previewed")
	if not armor_preview.is_empty():
		_expect(String(armor_preview.get("transferred_from", "")) == "archer_hero",
			"Preview visibly identifies the losing Hero on transfer")
		var manual_armor := fixture.duplicate(true)
		manual_armor["hero_loadouts"]["archer_hero"]["armor"] = ""
		manual_armor["hero_loadouts"]["sword_hero"]["armor"] = String(armor["uuid"])
		_expect_projection(armor_preview, MANAGER.project_hero_combat(manual_armor, SWORD),
			"Armor transfer preview matches manual cloned loadout")
		_expect(float((armor_preview.get("delta", {}) as Dictionary).get("hp", 0.0)) > 0.0,
			"Equipping real armor improves projected HP")
	for row: Dictionary in [
		{"slot": "boots", "id": String(boots["uuid"])},
		{"slot": "jewelry", "id": String(jewelry["uuid"])},
	]:
		var preview: Dictionary = PREVIEW.compare(
			fixture, "sword_hero", String(row["slot"]), String(row["id"])
		)
		_expect(not preview.is_empty(), "%s has a real comparison" % row["slot"])
		if not preview.is_empty():
			var manual_gear := fixture.duplicate(true)
			manual_gear["hero_loadouts"]["sword_hero"][String(row["slot"])] = String(row["id"])
			_expect_projection(preview, MANAGER.project_hero_combat(manual_gear, SWORD),
				"%s preview uses combat authority" % row["slot"])
	var same := PREVIEW.compare(
		fixture, "sword_hero", "hero_weapon", String(old_soul["instance_id"])
	)
	_expect(not same.is_empty(), "Current weapon allows a zero-delta preview")
	if not same.is_empty():
		_expect(is_zero_approx(float((same["delta"] as Dictionary).get("damage", 100.0))),
			"Equipping the same exact weapon has zero damage delta")
	_expect(PREVIEW.compare(fixture, "archer_hero", "hero_weapon",
		String(new_soul["instance_id"])).is_empty(),
		"Wrong Hero cannot preview someone else's weapon")
	_expect(PREVIEW.compare(fixture, "sword_hero", "boots",
		String(armor["uuid"])).is_empty(),
		"Wrong auxiliary slot cannot preview as equipped")
	_expect(PREVIEW.compare(fixture, "sword_hero", "jewelry",
		"missing-item").is_empty(),
		"Orphan item UUID fails closed")
	var duplicated := fixture.duplicate(true)
	(duplicated["inventory"]["auxiliary_equipment"] as Array).append(armor.duplicate(true))
	_expect(PREVIEW.compare(duplicated, "sword_hero", "armor",
		String(armor["uuid"])).is_empty(),
		"Duplicate item UUID fails closed")
	var locked := fixture.duplicate(true)
	locked["progression"]["unlocked_heroes"]["sword_hero"] = false
	_expect(PREVIEW.compare(locked, "sword_hero", "armor",
		String(armor["uuid"])).is_empty(),
		"Locked Hero cannot appear equip-ready")
	_expect(fixture == original, "All comparisons are read-only")
	var roster_source := FileAccess.get_file_as_string(ROSTER_SOURCE)
	_expect(roster_source.contains("EQUIPMENT_PREVIEW.compare"),
		"Arsenal UI delegates comparisons to canonical projector")
	_expect(roster_source.contains("EquipmentComparisonPanel")
		and roster_source.contains("_select_equipment_preview"),
		"Selected item has a visible on-demand comparison UI")
	_finish()


func _expect_projection(preview: Dictionary, expected: Dictionary, description: String) -> void:
	var projected: Dictionary = preview.get("projected", {})
	var baseline: Dictionary = preview.get("baseline", {})
	var deltas: Dictionary = preview.get("delta", {})
	for key: String in ["hp", "mana", "character_damage", "damage"]:
		_expect(absf(float(projected.get(key, 0.0)) - float(expected.get(key, 0.0))) < 0.0001,
			"%s: %s output equals gameplay projection" % [description, key])
		_expect(absf(float(deltas.get(key, 0.0))
			- (float(expected.get(key, 0.0)) - float(baseline.get(key, 0.0)))) < 0.0001,
			"%s: %s delta includes existing build effects" % [description, key])


func _expect(ok: bool, message: String) -> void:
	_checks += 1
	if not ok:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("HERO EQUIPMENT PREVIEW TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	print("HERO EQUIPMENT PREVIEW TEST FAILED - %d / %d" % [
		_failures.size(), _checks,
	])
	quit(1)
