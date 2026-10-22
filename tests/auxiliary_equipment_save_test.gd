extends SceneTree

const TEST_SAVE_PATH := "user://tests/auxiliary_equipment_save_test.json"
const REPORT_PATH := "res://.artifacts/auxiliary_equipment_save_report.json"
const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save_service := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save_service != null, "SaveService autoload exists")
	if save_service == null:
		_finish()
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "isolated auxiliary-equipment profile loads")

	var initial_loadout: Dictionary = save_service.get_value(["auxiliary_loadout"], {})
	_expect(initial_loadout.size() == 3, "new profile owns the three canonical shared loadout slots")
	_expect(initial_loadout.values().all(func(value: Variant) -> bool: return String(value).is_empty()), "all auxiliary slots begin empty")
	_expect((save_service.get_value(["inventory", "auxiliary_equipment"], []) as Array).is_empty(), "new auxiliary inventory begins empty")
	_expect(int(save_service.get_value(["inventory", "hero_soul_rules_version"], 0)) == 4, "save records the canonical live-only Hero Weapon affix generation")
	_expect(int(save_service.get_value(["inventory", "auxiliary_equipment_version"], 0)) == 4, "save records the visible-defense auxiliary equipment generation")

	var vessel := RULES.generate_item(&"soul_vessel", &"normal", 2, 71001, &"save_test")
	var vessel_uuid := String(vessel["uuid"])
	_expect(save_service.grant_auxiliary_equipment(vessel, "test:aux:grant_vessel"), "valid Soul Vessel grant commits")
	_expect(not save_service.grant_auxiliary_equipment(vessel, "test:aux:grant_vessel"), "grant receipt is idempotent")
	_expect(not save_service.grant_auxiliary_equipment(vessel, "test:aux:duplicate_uuid"), "a duplicate UUID cannot enter inventory through another receipt")
	_expect((save_service.get_value(["inventory", "auxiliary_equipment"], []) as Array).size() == 1, "duplicate checks preserve one Vessel instance")
	_expect(not save_service.equip_auxiliary_equipment(vessel_uuid, "test:aux:equip_vessel_early"), "Soul Vessel cannot equip before player level two")
	_expect(save_service.grant_player_levels(1, "test:aux:level_two"), "player advances to level two")
	_expect(save_service.equip_auxiliary_equipment(vessel_uuid, "test:aux:equip_vessel"), "Soul Vessel equips when its slot unlocks")
	_expect(not save_service.equip_auxiliary_equipment(vessel_uuid, "test:aux:equip_vessel"), "equip receipt is idempotent")
	_expect(String(save_service.get_value(["auxiliary_loadout", "soul_vessel"], "")) == vessel_uuid, "loadout stores the equipped Vessel by stable UUID")
	_expect(not save_service.sell_auxiliary_equipment(vessel_uuid, "test:aux:sell_equipped"), "equipped auxiliary gear cannot be sold")
	_expect(save_service.unequip_auxiliary_slot(&"soul_vessel", "test:aux:unequip_vessel"), "Soul Vessel unequips atomically")
	_expect(not save_service.unequip_auxiliary_slot(&"soul_vessel", "test:aux:unequip_empty"), "an already-empty auxiliary slot rejects a no-op transaction")
	var vessel_sale_value := RULES.sell_value(vessel)
	_expect(save_service.sell_auxiliary_equipment(vessel_uuid, "test:aux:sell_vessel"), "unequipped unprotected Vessel sells")
	_expect(int(save_service.get_value(["currencies", "account"], -1)) == vessel_sale_value, "Vessel sale credits the exact shared-account formula")
	_expect((save_service.get_value(["inventory", "auxiliary_equipment"], []) as Array).is_empty(), "sale removes only the selected Vessel")

	var protected_jewelry := RULES.generate_item(&"soul_trace", &"magic", 7, 71002, &"save_test")
	protected_jewelry["favorite"] = true
	_expect(save_service.grant_auxiliary_equipment(protected_jewelry, "test:aux:grant_favorite_jewelry"), "favorite Jewelry may be safely stored")
	_expect(not save_service.sell_auxiliary_equipment(String(protected_jewelry["uuid"]), "test:aux:sell_favorite"), "favorite Jewelry is protected from sale")
	var locked_boots := RULES.generate_item(&"soul_boots", &"rare", 4, 71003, &"save_test")
	locked_boots["locked"] = true
	_expect(save_service.grant_auxiliary_equipment(locked_boots, "test:aux:grant_locked_boots"), "locked gear may be safely stored")
	_expect(not save_service.sell_auxiliary_equipment(String(locked_boots["uuid"]), "test:aux:sell_locked"), "locked gear is protected from sale")

	var boots := RULES.generate_item(&"soul_boots", &"rare", 4, 71004, &"save_test")
	var boots_uuid := String(boots["uuid"])
	_expect(save_service.grant_auxiliary_equipment(boots, "test:aux:grant_boots"), "unprotected Soul Boots grant commits")
	_expect(not save_service.equip_auxiliary_equipment(boots_uuid, "test:aux:equip_boots_early"), "Soul Boots cannot equip at player level two")
	_expect(save_service.grant_player_levels(2, "test:aux:level_four"), "player advances to level four")
	_expect(save_service.equip_auxiliary_equipment(boots_uuid, "test:aux:equip_boots"), "Soul Boots equips at player level four")

	var trace := RULES.generate_item(&"soul_trace", &"epic", 7, 71005, &"save_test")
	var trace_uuid := String(trace["uuid"])
	_expect(save_service.grant_auxiliary_equipment(trace, "test:aux:grant_trace"), "unprotected Soul Trace grant commits")
	_expect(not save_service.equip_auxiliary_equipment(trace_uuid, "test:aux:equip_trace_early"), "Soul Trace cannot equip at player level four")
	_expect(save_service.grant_player_levels(3, "test:aux:level_seven"), "player advances to level seven")
	_expect(save_service.equip_auxiliary_equipment(trace_uuid, "test:aux:equip_trace"), "Soul Trace equips at player level seven")

	_expect(save_service.reload_save(), "auxiliary inventory and loadout survive a JSON disk round trip")
	var reloaded_items: Array = save_service.get_value(["inventory", "auxiliary_equipment"], [])
	_expect(reloaded_items.size() == 4, "reload preserves favorite, locked, Boots and Trace instances")
	_expect(String(save_service.get_value(["auxiliary_loadout", "soul_trace"], "")) == trace_uuid, "reload preserves equipped Soul Trace UUID")
	_expect(String(save_service.get_value(["auxiliary_loadout", "soul_boots"], "")) == boots_uuid, "reload preserves equipped Soul Boots UUID")
	_expect(String(save_service.get_value(["auxiliary_loadout", "soul_vessel"], "occupied")) == "", "reload preserves the intentionally empty Vessel slot")
	_expect(int(save_service.get_player_progression_snapshot().get("player_level", 0)) == 7, "slot unlock account level persists with the loadout")
	_finish()


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	var report := {
		"checks": _checks,
		"failures": _failures.duplicate(),
		"passed": _checks - _failures.size(),
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
	if _failures.is_empty():
		print("AUXILIARY EQUIPMENT SAVE TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("AUXILIARY EQUIPMENT SAVE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
