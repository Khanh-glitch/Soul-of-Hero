extends SceneTree

const TEST_SAVE_PATH := "user://tests/auxiliary_equipment_upgrade_migration_test.json"
const REPORT_PATH := "res://.artifacts/auxiliary_equipment_upgrade_migration_report.json"
const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const STONE_ID := "soul_upgrade_stone_normal"
const FOCUS_UUID := "516d1291-7d9a-ab52-7784-10b69b55b2b0"

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

	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated upgrade-migration profile loads")
	_expect(
		int(save.get_value(["inventory", "auxiliary_equipment_version"], 0)) == 4,
		"new profiles stamp auxiliary equipment version four",
	)
	var default_loadout: Dictionary = save.get_value(["auxiliary_loadout"], {})
	_expect(
		default_loadout.keys() == ["soul_vessel", "soul_boots", "soul_trace"],
		"new loadout persists the exact Vessel, Boots, Trace order",
	)

	var legacy := _legacy_fixture(save.get_snapshot())
	_test_migration_corruption_rejection(save, legacy)
	_remove_non_primary_generations(TEST_SAVE_PATH)
	_expect(_write_json(TEST_SAVE_PATH, legacy), "markerless legacy auxiliary fixture writes")
	_expect(save.reload_save(), "legacy auxiliary profile migrates and auto-commits")

	var migrated_inventory: Dictionary = save.get_value(["inventory"], {})
	_expect(
		int(migrated_inventory.get("auxiliary_equipment_version", 0)) == 4,
		"migration stamps auxiliary equipment version four",
	)
	var migrated_items: Array = migrated_inventory.get("auxiliary_equipment", [])
	_expect(migrated_items.size() == 2, "migration retains Vessel and Trace but removes Focus gear")
	_expect(_find_item(migrated_items, FOCUS_UUID).is_empty(), "retired Focus UUID is absent from live equipment")
	var vessel := _find_slot(migrated_items, "soul_vessel")
	var trace := _find_slot(migrated_items, "soul_trace")
	_expect(not vessel.is_empty() and not trace.is_empty(), "surviving legacy equipment keeps both canonical slots")
	_expect(int(vessel.get("upgrade_rank", -1)) == 0, "legacy Vessel starts upgrade rank zero")
	_expect(int(trace.get("upgrade_rank", -1)) == 0, "legacy Trace starts upgrade rank zero")
	var migrated_loadout: Dictionary = save.get_value(["auxiliary_loadout"], {})
	_expect(
		migrated_loadout.keys() == ["soul_vessel", "soul_boots", "soul_trace"],
		"migration replaces Focus with the canonical Boots slot",
	)
	_expect(
		String(migrated_loadout.get("soul_vessel", "")) == String(vessel.get("uuid", "")),
		"unlocked Vessel remains equipped by its stable UUID",
	)
	_expect(String(migrated_loadout.get("soul_boots", "")).is_empty(), "new Boots slot starts empty")
	_expect(
		String(migrated_loadout.get("soul_trace", "")).is_empty(),
		"level-four Trace is safely unequipped until its new level-seven unlock",
	)

	var stone: Dictionary = (migrated_inventory.get("item_stacks", {}) as Dictionary).get(STONE_ID, {})
	_expect(int(stone.get("quantity", 0)) == 6, "each retired Focus adds exactly one same-rarity stone")
	_expect(String(stone.get("kind", "")) == "material", "upgrade stone is a material stack")
	_expect(String(stone.get("rarity", "")) == "normal", "upgrade stone preserves Focus rarity")
	_expect(
		String(stone.get("icon_path", "")) == "res://assets/library/downloaded/rpg_icons_400/Icon321.png",
		"Normal upgrade stone uses the canonical first crystal icon",
	)
	var audit: Dictionary = save.get_legacy_audit()
	var focus_archive: Dictionary = audit.get("soul_focus_equipment_pre_v2", {})
	var archived_items: Array = focus_archive.get("items", [])
	_expect(archived_items.size() == 1, "migration archives the exact retired Focus instance")
	_expect(
		String((archived_items[0] as Dictionary).get("uuid", "")) == FOCUS_UUID,
		"Focus audit preserves its stable UUID",
	)
	_expect(
		String((focus_archive.get("loadout", {}) as Dictionary).get("soul_focus", "")) == FOCUS_UUID,
		"Focus audit preserves the legacy equipped loadout",
	)

	_expect(save.reload_save(), "migrated profile reloads without rerunning conversion")
	_expect(
		int(save.get_value(["inventory", "item_stacks", STONE_ID, "quantity"], 0)) == 6,
		"second reload does not duplicate the converted stone",
	)
	_expect(
		(save.get_legacy_audit().get("soul_focus_equipment_pre_v2", {}) as Dictionary).get("items", []).size() == 1,
		"second reload preserves one immutable Focus archive",
	)

	var vessel_uuid := String(vessel.get("uuid", ""))
	for rank: int in range(1, RULES.MAX_UPGRADE_RANK + 1):
		_expect(
			save.upgrade_auxiliary_equipment(vessel_uuid, "test:aux_upgrade:rank_%d" % rank),
			"same-rarity stone atomically advances Vessel to rank %d" % rank,
		)
		var upgraded := _find_item(save.get_value(["inventory", "auxiliary_equipment"], []), vessel_uuid)
		_expect(int(upgraded.get("upgrade_rank", -1)) == rank, "persisted Vessel rank equals %d" % rank)
	_expect(
		is_equal_approx(
			RULES.upgrade_multiplier(_find_item(
				save.get_value(["inventory", "auxiliary_equipment"], []),
				vessel_uuid,
			)),
			1.15,
		),
		"rank five has the canonical fifteen-percent multiplier",
	)
	_expect(
		int(save.get_value(["inventory", "item_stacks", STONE_ID, "quantity"], 0)) == 1,
		"five upgrades consume exactly five stones",
	)
	_expect(
		not save.upgrade_auxiliary_equipment(vessel_uuid, "test:aux_upgrade:over_cap"),
		"rank-five item rejects an over-cap upgrade",
	)
	_expect(
		int(save.get_value(["inventory", "item_stacks", STONE_ID, "quantity"], 0)) == 1,
		"rejected over-cap upgrade consumes no stone",
	)
	_expect(
		not save.upgrade_auxiliary_equipment(vessel_uuid, "test:aux_upgrade:rank_5"),
		"an already-applied upgrade receipt is idempotent",
	)
	_expect(save.consume_inventory_item(&"soul_upgrade_stone_normal", 1, "test:aux_upgrade:drain"), "last test stone can be consumed")
	var trace_uuid := String(trace.get("uuid", ""))
	_expect(
		not save.upgrade_auxiliary_equipment(trace_uuid, "test:aux_upgrade:no_stone"),
		"upgrade without a same-rarity stone fails",
	)
	_expect(
		int(_find_item(save.get_value(["inventory", "auxiliary_equipment"], []), trace_uuid).get("upgrade_rank", -1)) == 0,
		"failed material check leaves the target rank unchanged",
	)

	_expect(save.reload_save(), "rank upgrades survive a JSON round trip")
	_expect(
		int(_find_item(save.get_value(["inventory", "auxiliary_equipment"], []), vessel_uuid).get("upgrade_rank", -1)) == 5,
		"round trip retains rank five",
	)
	_test_rank_corruption_rejection(save, vessel_uuid)
	_finish()


func _legacy_fixture(current: Dictionary) -> Dictionary:
	var fixture := current.duplicate(true)
	var progression: Dictionary = fixture.get("progression", {}).duplicate(true)
	var player: Dictionary = progression.get("player", {}).duplicate(true)
	player["level"] = 4
	progression["player"] = player
	fixture["progression"] = progression

	var vessel := RULES.generate_item(&"soul_vessel", &"normal", 2, 97001, &"legacy_aux_v1")
	var trace := RULES.generate_item(&"soul_trace", &"normal", 4, 97002, &"legacy_aux_v1")
	vessel.erase("upgrade_rank")
	trace.erase("upgrade_rank")
	var focus := {
		"uuid": FOCUS_UUID,
		"slot": "soul_focus",
		"rarity": "normal",
		"item_level": 7,
		"primary": {"stat_id": "max_mana_flat", "unit": "flat", "value": 8.0},
		"affixes": [],
		"favorite": true,
		"locked": true,
	}
	var inventory: Dictionary = fixture.get("inventory", {}).duplicate(true)
	inventory.erase("auxiliary_equipment_version")
	inventory["auxiliary_equipment"] = [vessel, trace, focus]
	inventory["item_stacks"] = {
		STONE_ID: {"kind": "material", "quantity": 5},
	}
	fixture["inventory"] = inventory
	fixture["auxiliary_loadout"] = {
		"soul_vessel": String(vessel.get("uuid", "")),
		"soul_trace": String(trace.get("uuid", "")),
		"soul_focus": FOCUS_UUID,
	}
	return fixture


func _test_rank_corruption_rejection(save: LivingArsenalSaveService, vessel_uuid: String) -> void:
	var over_cap := save.get_snapshot()
	var over_inventory: Dictionary = over_cap.get("inventory", {}).duplicate(true)
	var over_items: Array = (over_inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
	for index: int in over_items.size():
		if over_items[index] is Dictionary \
				and String((over_items[index] as Dictionary).get("uuid", "")) == vessel_uuid:
			var item := (over_items[index] as Dictionary).duplicate(true)
			item["upgrade_rank"] = RULES.MAX_UPGRADE_RANK + 1
			over_items[index] = item
	over_inventory["auxiliary_equipment"] = over_items
	over_cap["inventory"] = over_inventory
	var over_prepared: Dictionary = save.call("_prepare_document", over_cap)
	_expect(not bool(over_prepared.get("ok", false)), "over-cap persisted upgrade rank is rejected")
	_expect(String(over_prepared.get("error", "")).contains("upgrade_rank"), "rank corruption reports its exact field")

	var missing := save.get_snapshot()
	var missing_inventory: Dictionary = missing.get("inventory", {}).duplicate(true)
	var missing_items: Array = (missing_inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
	if not missing_items.is_empty() and missing_items[0] is Dictionary:
		var first := (missing_items[0] as Dictionary).duplicate(true)
		first.erase("upgrade_rank")
		missing_items[0] = first
	missing_inventory["auxiliary_equipment"] = missing_items
	missing["inventory"] = missing_inventory
	var missing_prepared: Dictionary = save.call("_prepare_document", missing)
	_expect(not bool(missing_prepared.get("ok", false)), "v2 item without upgrade rank is rejected")


func _test_migration_corruption_rejection(
		save: LivingArsenalSaveService,
		legacy: Dictionary,
) -> void:
	var overflow := legacy.duplicate(true)
	var overflow_inventory: Dictionary = overflow.get("inventory", {}).duplicate(true)
	var overflow_stacks: Dictionary = overflow_inventory.get("item_stacks", {}).duplicate(true)
	var overflow_stone: Dictionary = overflow_stacks.get(STONE_ID, {}).duplicate(true)
	overflow_stone["quantity"] = 999999
	overflow_stacks[STONE_ID] = overflow_stone
	overflow_inventory["item_stacks"] = overflow_stacks
	overflow["inventory"] = overflow_inventory
	var overflow_prepared: Dictionary = save.call("_prepare_document", overflow)
	_expect(not bool(overflow_prepared.get("ok", false)), "Focus conversion rejects a full destination stack without clamping")

	var malformed := legacy.duplicate(true)
	var malformed_inventory: Dictionary = malformed.get("inventory", {}).duplicate(true)
	var malformed_items: Array = (malformed_inventory.get("auxiliary_equipment", []) as Array).duplicate(true)
	for index: int in malformed_items.size():
		if malformed_items[index] is Dictionary \
				and String((malformed_items[index] as Dictionary).get("slot", "")) == "soul_focus":
			var malformed_focus := (malformed_items[index] as Dictionary).duplicate(true)
			malformed_focus["primary"] = {"stat_id": "max_mana_flat", "unit": "flat", "value": -1.0}
			malformed_items[index] = malformed_focus
	malformed_inventory["auxiliary_equipment"] = malformed_items
	malformed["inventory"] = malformed_inventory
	var malformed_prepared: Dictionary = save.call("_prepare_document", malformed)
	_expect(not bool(malformed_prepared.get("ok", false)), "malformed legacy Focus is rejected instead of minted into a stone")

	var missing_focus := legacy.duplicate(true)
	var missing_inventory: Dictionary = missing_focus.get("inventory", {}).duplicate(true)
	var without_focus: Array = []
	for raw_item: Variant in missing_inventory.get("auxiliary_equipment", []):
		if raw_item is Dictionary and String((raw_item as Dictionary).get("slot", "")) != "soul_focus":
			without_focus.append(raw_item)
	missing_inventory["auxiliary_equipment"] = without_focus
	missing_focus["inventory"] = missing_inventory
	var missing_focus_prepared: Dictionary = save.call("_prepare_document", missing_focus)
	_expect(not bool(missing_focus_prepared.get("ok", false)), "equipped Focus UUID must resolve before its slot can be retired")


func _find_slot(items: Array, slot_id: String) -> Dictionary:
	for raw_item: Variant in items:
		if raw_item is Dictionary and String((raw_item as Dictionary).get("slot", "")) == slot_id:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _find_item(items: Array, uuid: String) -> Dictionary:
	for raw_item: Variant in items:
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _write_json(path: String, data: Dictionary) -> bool:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data, "\t") + "\n")
	file.close()
	return true


func _remove_non_primary_generations(path: String) -> void:
	for suffix: String in [".bak", ".tmp", ".pre_v2.bak"]:
		_remove_file(path + suffix)


func _remove_generations(path: String) -> void:
	_remove_file(path)
	_remove_non_primary_generations(path)


func _remove_file(path: String) -> void:
	if not FileAccess.file_exists(path):
		return
	var absolute := ProjectSettings.globalize_path(path)
	DirAccess.remove_absolute(absolute)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("FAIL: %s" % message)


func _finish() -> void:
	var report := {
		"suite": "auxiliary_equipment_upgrade_migration",
		"checks": _checks,
		"failures": _failures,
		"status": "pass" if _failures.is_empty() else "fail",
	}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(REPORT_PATH.get_base_dir()))
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	print("AUXILIARY UPGRADE MIGRATION TESTS: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)
