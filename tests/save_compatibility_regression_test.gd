extends SceneTree

const TEST_SAVE_PATH := "user://tests/save_compatibility_regression_test.json"
const REPORT_PATH := "res://.artifacts/save_compatibility_regression_report.json"
const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const SOUL_COMBAT := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const AUX_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")

const LEGACY_RARITY_MAP := [0, 1, 2, 3, 4, 7]
const LEGACY_AFFIX_COUNTS := [0, 2, 4, 6, 6, 6]
const LEGACY_AFFIX_IDS := [
	"max_hp_flat",
	"max_hp_percent",
	"damage_reduction",
	"health_regen",
	"stagger_resistance",
	"damage_flat",
]

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

	_test_explicit_legacy_soul_migration(save)
	_test_missing_rules_marker_detection(save)
	_test_affix_semantic_roundtrip_and_group_guard(save)
	_test_auxiliary_loadout_aliases(save)
	_test_auxiliary_same_slot_replacement(save)
	_test_auxiliary_protection_setters(save)
	_finish()


func _test_explicit_legacy_soul_migration(save: LivingArsenalSaveService) -> void:
	var fixture := _fresh_snapshot(save, "legacy migration fixture")
	var inventory: Dictionary = fixture.get("inventory", {}).duplicate(true)
	var legacy_souls: Array[Dictionary] = []
	for rarity: int in range(LEGACY_RARITY_MAP.size()):
		legacy_souls.append(_legacy_soul(
			"legacy_rarity_%d" % rarity,
			rarity,
			LEGACY_AFFIX_IDS.slice(0, int(LEGACY_AFFIX_COUNTS[rarity]))
		))
	inventory["hero_souls"] = legacy_souls
	inventory["hero_soul_rules_version"] = 1
	fixture["inventory"] = inventory
	var currencies: Dictionary = fixture.get("currencies", {}).duplicate(true)
	currencies["account"] = 4101
	fixture["currencies"] = currencies

	var first := _load_fixture(save, fixture, "explicit Hero Soul rules v1")
	_expect(int(first.get("currencies", {}).get("account", -1)) == 4101, "rules migration preserves unrelated profile data")
	_expect(int(first.get("inventory", {}).get("hero_soul_rules_version", 0)) == 4, "rules migration stamps Hero Soul rules v4 in memory")
	var first_affix_ids := {}
	for old_rarity: int in range(LEGACY_RARITY_MAP.size()):
		var instance_id := "legacy_rarity_%d" % old_rarity
		var migrated := _find_soul(first, instance_id)
		var expected_rarity := int(LEGACY_RARITY_MAP[old_rarity])
		_expect(not migrated.is_empty(), "legacy rarity %d Soul survives migration" % old_rarity)
		_expect(int(migrated.get("rarity", -1)) == expected_rarity, "legacy rarity %d maps to v2 rarity %d" % [old_rarity, expected_rarity])
		var expected_count := mini(int(LEGACY_AFFIX_COUNTS[old_rarity]), SOUL_RULES.affix_slot_count(expected_rarity))
		var affixes: Array = migrated.get("affixes", [])
		_expect(affixes.size() == expected_count, "legacy rarity %d trims to its v2 affix cap" % old_rarity)
		_expect(_affixes_are_live(affixes), "legacy rarity %d becomes canonical readable affixes" % old_rarity)
		_expect(_respects_group_cap(affixes), "legacy rarity %d keeps at most two affixes per stacking group" % old_rarity)
		first_affix_ids[instance_id] = _affix_ids(affixes)

	_expect(save.save_now(), "migrated Hero Soul rules can be committed durably")
	_expect(save.reload_save(), "durably migrated Hero Souls reload")
	_expect(int(save.get_value(["inventory", "hero_soul_rules_version"], 0)) == 4, "durable migration retains rules version 4")
	_expect(int(_find_soul(save.get_snapshot(), "legacy_rarity_5").get("rarity", -1)) == SOUL_RULES.Rarity.ETERNAL, "old Eternal remains Eternal after a second reload")

	var second := _load_fixture(save, fixture, "repeat explicit Hero Soul rules v1")
	for instance_id: String in first_affix_ids:
		_expect(
			_affix_ids(_find_soul(second, instance_id).get("affixes", [])) == first_affix_ids[instance_id],
			"legacy affix trimming is deterministic for %s" % instance_id
		)


func _test_missing_rules_marker_detection(save: LivingArsenalSaveService) -> void:
	var legacy_fixture := _fresh_snapshot(save, "missing-marker legacy fixture")
	var legacy_inventory: Dictionary = legacy_fixture.get("inventory", {}).duplicate(true)
	legacy_inventory.erase("hero_soul_rules_version")
	legacy_inventory["hero_souls"] = [
		_legacy_soul("markerless_legacy_eternal", 5, LEGACY_AFFIX_IDS.duplicate()),
	]
	legacy_fixture["inventory"] = legacy_inventory
	var legacy_currencies: Dictionary = legacy_fixture.get("currencies", {}).duplicate(true)
	legacy_currencies["account"] = 4201
	legacy_fixture["currencies"] = legacy_currencies
	var migrated := _load_fixture(save, legacy_fixture, "missing-marker legacy-shaped Soul")
	_expect(int(migrated.get("currencies", {}).get("account", -1)) == 4201, "legacy-shape detection does not reset the profile")
	var markerless_legacy := _find_soul(migrated, "markerless_legacy_eternal")
	_expect(int(markerless_legacy.get("rarity", -1)) == SOUL_RULES.Rarity.ETERNAL, "missing marker plus proven legacy shape maps old rarity 5 to Eternal 7")
	var preserved_legacy_affix_count := mini(
		LEGACY_AFFIX_IDS.size(),
		int(SOUL_RULES.AFFIX_SLOT_COUNTS[SOUL_RULES.Rarity.ETERNAL]),
	)
	_expect(
		(markerless_legacy.get("affixes", []) as Array).size() == preserved_legacy_affix_count,
		"missing-marker legacy Eternal preserves valid affixes up to the current Eternal cap",
	)

	var modern_fixture := _fresh_snapshot(save, "missing-marker modern fixture")
	var modern_inventory: Dictionary = modern_fixture.get("inventory", {}).duplicate(true)
	modern_inventory.erase("hero_soul_rules_version")
	modern_inventory["hero_souls"] = [
		SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.CRYSTAL, 31, &"markerless_modern", 82001),
		SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.MYTHIC, 32, &"markerless_modern", 82002),
		SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.ETERNAL, 33, &"markerless_modern", 82003),
	]
	modern_fixture["inventory"] = modern_inventory
	var modern := _load_fixture(save, modern_fixture, "missing-marker current v2 Souls")
	var modern_rarities: Array[int] = []
	for raw_soul: Variant in (modern.get("inventory", {}) as Dictionary).get("hero_souls", []):
		if raw_soul is Dictionary:
			modern_rarities.append(int((raw_soul as Dictionary).get("rarity", -1)))
	modern_rarities.sort()
	_expect(modern_rarities == [5, 6, 7], "missing marker preserves unambiguously current Crystal, Mythic and Eternal rarities")
	_expect(int(modern.get("inventory", {}).get("hero_soul_rules_version", 0)) == 4, "markerless current data is normalized to rules version 4")


func _test_affix_semantic_roundtrip_and_group_guard(save: LivingArsenalSaveService) -> void:
	_fresh_snapshot(save, "semantic affix roundtrip")
	var soul: Dictionary = SOUL_RULES.create_instance(
		&"sword_hero",
		SOUL_RULES.Rarity.ETERNAL,
		37,
		&"semantic_roundtrip",
		83001,
		SOUL_RULES.AFFINITY_MAGICIAN
	)
	var instance_id := String(soul.get("instance_id", ""))
	_expect(save.grant_hero_soul(soul, "test:compat:semantic_grant"), "modern semantic Hero Soul grant commits")
	var stored := _find_soul(save.get_snapshot(), instance_id)
	_expect(_affix_semantics_match(soul.get("affixes", []), stored.get("affixes", [])), "SaveService commit preserves complete affix semantics")
	_expect(save.reload_save(), "semantic Hero Soul reloads from JSON")
	var reloaded := _find_soul(save.get_snapshot(), instance_id)
	_expect(_affix_semantics_match(soul.get("affixes", []), reloaded.get("affixes", [])), "JSON roundtrip preserves affix value, roll, pool, group and tags")

	var before_count := (save.get_value(["inventory", "hero_souls"], []) as Array).size()
	var invalid := _compact_same_group_soul("compact_same_group")
	var invalid_candidate := save.get_snapshot()
	var invalid_inventory: Dictionary = invalid_candidate.get("inventory", {}).duplicate(true)
	var candidate_souls: Array = (invalid_inventory.get("hero_souls", []) as Array).duplicate(true)
	candidate_souls.append(invalid)
	invalid_inventory["hero_souls"] = candidate_souls
	invalid_candidate["inventory"] = invalid_inventory
	var prepared_value: Variant = save.call("_prepare_document", invalid_candidate)
	var prepared: Dictionary = prepared_value if prepared_value is Dictionary else {}
	_expect(not bool(prepared.get("ok", false)), "compact affixes cannot bypass the two-per-stacking-group invariant")
	_expect(String(prepared.get("error", "")).contains("stacking group"), "same-group persistence rejection reports its invariant")
	_expect((save.get_value(["inventory", "hero_souls"], []) as Array).size() == before_count, "validating a rejected same-group candidate changes no live inventory")


func _test_auxiliary_loadout_aliases(save: LivingArsenalSaveService) -> void:
	var fixture := _fresh_snapshot(save, "auxiliary alias fixture")
	var vessel := AUX_RULES.generate_item(&"soul_vessel", &"normal", 2, 84001, &"compat_alias")
	_set_fixture_player_level(fixture, 2)
	var inventory: Dictionary = fixture.get("inventory", {}).duplicate(true)
	inventory["auxiliary_equipment"] = [vessel]
	fixture["inventory"] = inventory
	fixture["auxiliary_loadout"] = {" SOUL_VESSEL ": String(vessel["uuid"])}
	var normalized := _load_fixture(save, fixture, "case-and-whitespace auxiliary slot alias")
	var loadout: Dictionary = normalized.get("auxiliary_loadout", {})
	_expect(String(loadout.get("soul_vessel", "")) == String(vessel["uuid"]), "slot alias normalizes without silently unequipping the item")
	_expect(loadout.keys().size() == 3 and not loadout.has(" SOUL_VESSEL "), "normalized auxiliary loadout keeps only canonical slot keys")

	var vessel_b := AUX_RULES.generate_item(&"soul_vessel", &"magic", 2, 84002, &"compat_alias")
	var valid_backup := fixture.duplicate(true)
	valid_backup["auxiliary_loadout"] = {
		"soul_vessel": String(vessel["uuid"]),
		"soul_boots": "",
		"soul_trace": "",
	}
	var backup_inventory: Dictionary = valid_backup.get("inventory", {}).duplicate(true)
	backup_inventory["auxiliary_equipment"] = [vessel, vessel_b]
	valid_backup["inventory"] = backup_inventory
	var backup_currencies: Dictionary = valid_backup.get("currencies", {}).duplicate(true)
	backup_currencies["account"] = 8401
	valid_backup["currencies"] = backup_currencies

	var collision := valid_backup.duplicate(true)
	collision["auxiliary_loadout"] = {
		"soul_vessel": String(vessel["uuid"]),
		"SOUL_VESSEL": String(vessel_b["uuid"]),
		"soul_boots": "",
		"soul_trace": "",
	}
	var collision_currencies: Dictionary = collision.get("currencies", {}).duplicate(true)
	collision_currencies["account"] = 8402
	collision["currencies"] = collision_currencies

	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "collision recovery profile initializes")
	_expect(_write_json(TEST_SAVE_PATH + ".bak", valid_backup), "valid canonical auxiliary backup writes")
	_expect(_write_json(TEST_SAVE_PATH, collision), "conflicting auxiliary alias primary writes")
	_expect(save.reload_save(), "conflicting alias primary recovers through the valid backup")
	_expect(int(save.get_value(["currencies", "account"], -1)) == 8401, "conflicting normalized slot keys reject the primary instead of choosing one silently")
	_expect(String(save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == String(vessel["uuid"]), "alias-collision recovery preserves the canonical backup loadout")


func _test_auxiliary_same_slot_replacement(save: LivingArsenalSaveService) -> void:
	_fresh_snapshot(save, "same-slot replacement")
	_expect(save.grant_player_levels(1, "test:compat:replacement_level"), "same-slot test unlocks Soul Vessel")
	var first := AUX_RULES.generate_item(&"soul_vessel", &"normal", 2, 85001, &"compat_replace")
	var second := AUX_RULES.generate_item(&"soul_vessel", &"rare", 9, 85002, &"compat_replace")
	var first_uuid := String(first["uuid"])
	var second_uuid := String(second["uuid"])
	_expect(save.grant_auxiliary_equipment(first, "test:compat:replacement_grant_a"), "first same-slot item enters inventory")
	_expect(save.grant_auxiliary_equipment(second, "test:compat:replacement_grant_b"), "second same-slot item enters inventory")
	_expect(save.equip_auxiliary_equipment(first_uuid, "test:compat:replacement_equip_a"), "first same-slot item equips")
	_expect(save.equip_auxiliary_equipment(second_uuid, "test:compat:replacement_equip_b"), "second same-slot item replaces the first")
	_expect(String(save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == second_uuid, "replacement loadout points only to the second item")
	_expect((save.get_value(["inventory", "auxiliary_equipment"], []) as Array).size() == 2, "same-slot replacement consumes neither item")
	_expect(save.sell_auxiliary_equipment(first_uuid, "test:compat:replacement_sell_old"), "replaced unequipped item can be sold")
	_expect(not save.sell_auxiliary_equipment(second_uuid, "test:compat:replacement_sell_equipped"), "replacement item remains protected while equipped")
	_expect(save.reload_save(), "same-slot replacement reloads")
	_expect(String(save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == second_uuid, "same-slot replacement remains durable")
	_expect(_find_auxiliary(save.get_snapshot(), first_uuid).is_empty(), "sold replaced item stays removed after reload")


func _test_auxiliary_protection_setters(save: LivingArsenalSaveService) -> void:
	_fresh_snapshot(save, "auxiliary protection setters")
	var has_favorite := save.has_method("set_auxiliary_equipment_favorite")
	var has_locked := save.has_method("set_auxiliary_equipment_locked")
	_expect(has_favorite, "SaveService exposes set_auxiliary_equipment_favorite")
	_expect(has_locked, "SaveService exposes set_auxiliary_equipment_locked")
	if not has_favorite or not has_locked:
		return

	var favorite_item := AUX_RULES.generate_item(&"soul_vessel", &"magic", 5, 86001, &"compat_protection")
	var favorite_uuid := String(favorite_item["uuid"])
	_expect(save.grant_auxiliary_equipment(favorite_item, "test:compat:favorite_grant"), "favorite setter fixture enters inventory")
	_expect(bool(save.call("set_auxiliary_equipment_favorite", favorite_uuid, true, "test:compat:favorite_on")), "favorite setter protects an owned item")
	_expect(not bool(save.call("set_auxiliary_equipment_favorite", favorite_uuid, true, "test:compat:favorite_on")), "favorite setter transaction is idempotent")
	_expect(bool(_find_auxiliary(save.get_snapshot(), favorite_uuid).get("favorite", false)), "favorite flag is visible in the saved inventory")
	_expect(save.reload_save(), "favorite protection reloads")
	_expect(bool(_find_auxiliary(save.get_snapshot(), favorite_uuid).get("favorite", false)), "favorite protection remains durable")
	_expect(not save.sell_auxiliary_equipment(favorite_uuid, "test:compat:favorite_sell_blocked"), "favorite item cannot be sold")
	_expect(bool(save.call("set_auxiliary_equipment_favorite", favorite_uuid, false, "test:compat:favorite_off")), "favorite protection can be removed")
	_expect(save.sell_auxiliary_equipment(favorite_uuid, "test:compat:favorite_sell"), "unfavorited item can be sold")

	var locked_item := AUX_RULES.generate_item(&"soul_trace", &"rare", 8, 86002, &"compat_protection")
	var locked_uuid := String(locked_item["uuid"])
	_expect(save.grant_auxiliary_equipment(locked_item, "test:compat:locked_grant"), "lock setter fixture enters inventory")
	_expect(bool(save.call("set_auxiliary_equipment_locked", locked_uuid, true, "test:compat:locked_on")), "lock setter protects an owned item")
	_expect(not bool(save.call("set_auxiliary_equipment_locked", locked_uuid, true, "test:compat:locked_on")), "lock setter transaction is idempotent")
	_expect(save.reload_save(), "locked protection reloads")
	_expect(bool(_find_auxiliary(save.get_snapshot(), locked_uuid).get("locked", false)), "locked protection remains durable")
	_expect(not save.sell_auxiliary_equipment(locked_uuid, "test:compat:locked_sell_blocked"), "locked item cannot be sold")
	_expect(bool(save.call("set_auxiliary_equipment_locked", locked_uuid, false, "test:compat:locked_off")), "lock protection can be removed")
	_expect(save.sell_auxiliary_equipment(locked_uuid, "test:compat:locked_sell"), "unlocked item can be sold")
	_expect(not bool(save.call("set_auxiliary_equipment_favorite", "00000000-0000-0000-0000-000000000000", true, "test:compat:missing_favorite")), "favorite setter rejects an unowned UUID")
	_expect(not bool(save.call("set_auxiliary_equipment_locked", "00000000-0000-0000-0000-000000000000", true, "test:compat:missing_lock")), "lock setter rejects an unowned UUID")


func _fresh_snapshot(save: LivingArsenalSaveService, label: String) -> Dictionary:
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "%s profile initializes" % label)
	return save.get_snapshot()


func _load_fixture(save: LivingArsenalSaveService, fixture: Dictionary, label: String) -> Dictionary:
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "%s isolated profile initializes" % label)
	_expect(_write_json(TEST_SAVE_PATH, fixture), "%s writes" % label)
	_expect(save.reload_save(), "%s loads" % label)
	return save.get_snapshot()


func _legacy_soul(instance_id: String, rarity: int, affix_ids: Array) -> Dictionary:
	var affixes: Array[Dictionary] = []
	for raw_affix_id: Variant in affix_ids:
		var affix_id := String(raw_affix_id)
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		affixes.append({
			"affix_id": affix_id,
			"field": String(definition["field"]),
			"unit": String(definition["unit"]),
			"value": float(definition["min"]),
		})
	return {
		"instance_id": instance_id,
		"hero_id": "sword_hero",
		"rarity": rarity,
		"item_level": 12,
		"affinity": "warrior",
		"variant_id": "",
		"affixes": affixes,
		"monster_soul_id": "",
		"locked": false,
		"favorite": false,
		"equipped": rarity == 0,
		"source_id": "legacy_test",
	}


func _compact_same_group_soul(instance_id: String) -> Dictionary:
	var affixes: Array[Dictionary] = []
	for affix_id: String in ["active_skill_power", "active_power", "summon_power"]:
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		affixes.append({
			"affix_id": affix_id,
			"field": String(definition["field"]),
			"unit": String(definition["unit"]),
			"value": float(definition["min"]),
		})
	return {
		"instance_id": instance_id,
		"hero_id": "sword_hero",
		"rarity": SOUL_RULES.Rarity.ETERNAL,
		"item_level": 20,
		"affinity": "magician",
		"variant_id": "",
		"affixes": affixes,
		"monster_soul_id": "",
		"locked": false,
		"favorite": false,
		"equipped": false,
		"source_id": "invalid_group_test",
	}


func _find_soul(snapshot: Dictionary, instance_id: String) -> Dictionary:
	var inventory: Dictionary = snapshot.get("inventory", {})
	for raw_soul: Variant in inventory.get("hero_souls", []):
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			return (raw_soul as Dictionary).duplicate(true)
	return {}


func _find_auxiliary(snapshot: Dictionary, uuid: String) -> Dictionary:
	var inventory: Dictionary = snapshot.get("inventory", {})
	for raw_item: Variant in inventory.get("auxiliary_equipment", []):
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _affix_ids(affixes_value: Variant) -> Array[String]:
	var result: Array[String] = []
	if not affixes_value is Array:
		return result
	for raw_affix: Variant in affixes_value:
		if raw_affix is Dictionary:
			result.append(String((raw_affix as Dictionary).get("affix_id", "")))
	return result


func _affixes_are_known_subset(affixes: Array, source_ids: Array) -> bool:
	var seen := {}
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			return false
		var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
		if not SOUL_RULES.AFFIX_CATALOG.has(affix_id) or not source_ids.has(affix_id) or seen.has(affix_id):
			return false
		seen[affix_id] = true
	return true


func _affixes_are_live(affixes: Array) -> bool:
	var seen := {}
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			return false
		var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
		if not SOUL_COMBAT.is_live_affix(affix_id) or seen.has(affix_id):
			return false
		seen[affix_id] = true
	return true


func _respects_group_cap(affixes: Array) -> bool:
	var group_counts := {}
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			return false
		var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
		if not SOUL_RULES.AFFIX_CATALOG.has(affix_id):
			return false
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		var group := String(definition.get("stacking_group", ""))
		group_counts[group] = int(group_counts.get(group, 0)) + 1
		if int(group_counts[group]) > SOUL_RULES.MAX_AFFIXES_PER_STACKING_GROUP:
			return false
	return true


func _affix_semantics_match(expected_value: Variant, actual_value: Variant) -> bool:
	if not expected_value is Array or not actual_value is Array:
		return false
	var expected: Array = expected_value
	var actual: Array = actual_value
	if expected.size() != actual.size():
		return false
	for index: int in expected.size():
		if not expected[index] is Dictionary or not actual[index] is Dictionary:
			return false
		var expected_affix: Dictionary = expected[index]
		var actual_affix: Dictionary = actual[index]
		for key: String in ["affix_id", "field", "unit", "pool", "stacking_group"]:
			if not actual_affix.has(key) or String(actual_affix[key]) != String(expected_affix.get(key, "")):
				return false
		for key: String in ["value", "roll_multiplier"]:
			if not actual_affix.has(key) \
					or not (actual_affix[key] is int or actual_affix[key] is float) \
					or not (expected_affix.get(key) is int or expected_affix.get(key) is float) \
					or not is_equal_approx(float(actual_affix[key]), float(expected_affix[key])):
				return false
		if not _string_arrays_match(expected_affix.get("tags", []), actual_affix.get("tags", [])):
			return false
	return true


func _string_arrays_match(expected_value: Variant, actual_value: Variant) -> bool:
	if not expected_value is Array or not actual_value is Array:
		return false
	var expected: Array = expected_value
	var actual: Array = actual_value
	if expected.size() != actual.size():
		return false
	for index: int in expected.size():
		if String(expected[index]) != String(actual[index]):
			return false
	return true


func _set_fixture_player_level(fixture: Dictionary, level: int) -> void:
	var progression: Dictionary = fixture.get("progression", {}).duplicate(true)
	var player: Dictionary = progression.get("player", {}).duplicate(true)
	player["level"] = level
	progression["player"] = player
	fixture["progression"] = progression


func _write_json(path: String, value: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value, "\t") + "\n")
	file.close()
	return true


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
		return
	_failures.append(message)
	push_error("FAIL  " + message)


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
		file.close()
	if _failures.is_empty():
		print("SAVE COMPATIBILITY REGRESSION PASSED - %d checks" % _checks)
		quit(0)
		return
	print("SAVE COMPATIBILITY REGRESSION FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
