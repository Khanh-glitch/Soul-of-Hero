extends SceneTree

const DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const REPORT_PATH := "res://.artifacts/auxiliary_equipment_report.json"

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_canonical_catalog()
	_test_asset_presentation_catalog()
	_test_deterministic_generation()
	_test_simple_live_affix_filter()
	_test_fail_closed_validation()
	_test_shared_slot_unlocks()
	_test_sell_formula_and_protection()
	_finish()


func _test_canonical_catalog() -> void:
	var errors := DEFINITIONS.get_catalog_errors()
	_expect(errors.is_empty(), "auxiliary equipment catalog validates: %s" % "; ".join(errors))
	_expect(
		DEFINITIONS.SLOT_IDS == ["soul_vessel", "soul_boots", "soul_trace"],
		"V0.5 exposes armor, boots, then jewelry in equipment-slot order"
	)
	_expect(
		DEFINITIONS.RARITY_IDS == ["normal", "magic", "rare", "epic", "legendary", "crystal", "mythic", "eternal"],
		"V0.4 uses the eight canonical string rarity IDs"
	)
	_expect(DEFINITIONS.RARITY_AFFIX_COUNTS == [0, 1, 2, 3, 4, 4, 4, 5], "rarities own the canonical affix counts")
	_expect(DEFINITIONS.RARITY_SELL_WEIGHTS == [1, 3, 9, 27, 81, 243, 729, 2187], "rarities own the canonical Hero Soul sell weights")
	_expect(DEFINITIONS.unlock_level("soul_vessel") == 2, "Soul Vessel unlocks at account level 2")
	_expect(DEFINITIONS.unlock_level("soul_boots") == 4, "Soul Boots unlock at account level 4")
	_expect(DEFINITIONS.unlock_level("soul_trace") == 7, "Soul Trace jewelry unlocks at account level 7")
	_expect(DEFINITIONS.primary_definition("soul_vessel").get("stat_id") == "max_hp_flat", "Soul Vessel owns the HP primary")
	_expect(DEFINITIONS.primary_definition("soul_boots").get("stat_id") == "movement_speed", "Soul Boots own the movement primary")
	_expect(DEFINITIONS.primary_definition("soul_trace").get("stat_id") == "damage_flat", "Soul Trace owns the damage primary")
	_expect(not DEFINITIONS.is_valid_slot("soul_focus"), "crystals are materials and cannot validate as equipment")

	var affix_owners := {}
	var pools_are_disjoint := true
	for slot_id: String in DEFINITIONS.SLOT_IDS:
		var pool := DEFINITIONS.affix_definitions(slot_id)
		for raw_affix_id: Variant in pool.keys():
			var affix_id := String(raw_affix_id)
			if affix_owners.has(affix_id):
				pools_are_disjoint = false
			affix_owners[affix_id] = slot_id
	_expect(pools_are_disjoint, "every affix belongs to exactly one auxiliary slot pool")


func _test_asset_presentation_catalog() -> void:
	var errors := PRESENTATION.get_catalog_errors()
	_expect(errors.is_empty(), "RPG400 semantic equipment catalog validates: %s" % "; ".join(errors))
	var expected_ranges := {
		"soul_vessel": Vector2i(151, 200),
		"soul_boots": Vector2i(221, 240),
		"soul_trace": Vector2i(241, 260),
	}
	for slot_id: String in DEFINITIONS.SLOT_IDS:
		for rarity_index: int in DEFINITIONS.RARITY_IDS.size():
			var rarity_id := String(DEFINITIONS.RARITY_IDS[rarity_index])
			var item := {
				"uuid": "catalog-fixture-%s" % slot_id,
				"slot": slot_id,
				"rarity": rarity_id,
				"item_level": rarity_index + 1,
			}
			var first := PRESENTATION.presentation_for(item)
			var repeat := PRESENTATION.presentation_for(item)
			var icon_id := int(first.get("icon_id", 0))
			var expected_range: Vector2i = expected_ranges[slot_id]
			_expect(first == repeat, "%s %s presentation is deterministic" % [slot_id, rarity_id])
			_expect(
				icon_id >= expected_range.x and icon_id <= expected_range.y,
				"%s %s stays inside its approved icon range" % [slot_id, rarity_id],
			)
			_expect(
				not String(first.get("display_name", "")).is_empty()
					and ResourceLoader.exists(String(first.get("icon_path", ""))),
				"%s %s has an authored name and imported icon" % [slot_id, rarity_id],
			)

	var crystal_icon_ids := PackedInt32Array()
	for rarity_id: String in DEFINITIONS.RARITY_IDS:
		var presentation := PRESENTATION.upgrade_stone_presentation(rarity_id)
		crystal_icon_ids.append(int(presentation.get("icon_id", 0)))
		_expect(
			String(presentation.get("item_id", "")) == "soul_upgrade_stone_%s" % rarity_id
				and String(presentation.get("kind", "")) == "material",
			"each rarity owns one stackable upgrade-stone material",
		)
	var unique_crystal_icons := {}
	for icon_id: int in crystal_icon_ids:
		unique_crystal_icons[icon_id] = true
	_expect(unique_crystal_icons.size() == 8, "upgrade materials expose eight distinct rarity shapes")

	var speed_preview := PRESENTATION.speed_preview("future-speed-item")
	var speed_icon_id := int(speed_preview.get("icon_id", 0))
	_expect(
		speed_icon_id >= 221 and speed_icon_id <= 240
			and bool(speed_preview.get("available_for_loot", false)),
		"boots 221-240 are backed by a live movement mechanic",
	)


func _test_deterministic_generation() -> void:
	var normal_vessel := RULES.generate_item(&"soul_vessel", &"normal", 2, 1001, &"test_drop")
	_expect(normal_vessel.size() == 9, "generated item uses the compact nine-field persistence shape")
	for field_name: String in RULES.REQUIRED_ITEM_FIELDS:
		_expect(normal_vessel.has(field_name), "generated item includes '%s'" % field_name)
	_expect(RULES.validate_item(normal_vessel).is_empty(), "generated Normal Soul Vessel validates")
	_expect(normal_vessel["slot"] == "soul_vessel" and normal_vessel["rarity"] == "normal", "generated item preserves slot and string rarity")
	_expect((normal_vessel["primary"] as Dictionary).get("stat_id") == "max_hp_flat", "Soul Vessel rolls exactly its slot primary")
	_expect((normal_vessel["affixes"] as Array).is_empty(), "Normal rarity rolls no affixes")
	_expect(int(normal_vessel["upgrade_rank"]) == 0, "new equipment starts at upgrade rank zero")
	_expect(not normal_vessel["favorite"] and not normal_vessel["locked"], "new auxiliary items start unprotected")

	var magic_boots := RULES.generate_item(&"soul_boots", &"magic", 4, 2002, &"test_drop")
	_expect(RULES.validate_item(magic_boots).is_empty(), "generated Magic Soul Boots validate")
	_expect((magic_boots["primary"] as Dictionary).get("stat_id") == "movement_speed", "Soul Boots roll exactly their slot primary")
	_expect((magic_boots["affixes"] as Array).size() == 1, "Magic rarity rolls exactly one affix")
	var boots_affix_id := String(((magic_boots["affixes"] as Array)[0] as Dictionary).get("affix_id", ""))
	_expect(DEFINITIONS.affix_definitions("soul_boots").has(boots_affix_id), "Soul Boots generation stays inside their affix pool")

	var eternal_trace := RULES.generate_item(&"soul_trace", &"eternal", 100, 3003, &"boss_drop")
	_expect(RULES.validate_item(eternal_trace).is_empty(), "generated Eternal Soul Trace validates")
	_expect((eternal_trace["affixes"] as Array).size() == 5, "Eternal rarity rolls exactly five affixes")
	var trace_ids := {}
	var trace_pool_only := true
	for affix_value: Variant in eternal_trace["affixes"]:
		var affix_id := String((affix_value as Dictionary).get("affix_id", ""))
		if not DEFINITIONS.affix_definitions("soul_trace").has(affix_id) or trace_ids.has(affix_id):
			trace_pool_only = false
		trace_ids[affix_id] = true
	_expect(trace_pool_only, "Eternal generation selects five unique live jewelry affixes")

	var repeat_trace := RULES.generate_item(&"soul_trace", &"eternal", 100, 3003, &"boss_drop")
	_expect(repeat_trace == eternal_trace, "same generation inputs reproduce the complete item deterministically")
	var different_seed := RULES.generate_item(&"soul_trace", &"eternal", 100, 3004, &"boss_drop")
	_expect(different_seed.get("uuid") != eternal_trace.get("uuid"), "different seed produces a different deterministic uuid")
	var different_namespace := RULES.generate_item(&"soul_trace", &"eternal", 100, 3003, &"quest_reward")
	_expect(different_namespace.get("uuid") != eternal_trace.get("uuid"), "generation namespace prevents cross-source uuid collisions")
	_expect(String(eternal_trace.get("uuid", "")).length() == 36, "generated uuid uses the stable 8-4-4-4-12 shape")

	_expect(RULES.generate_item(&"invalid_slot", &"normal", 1, 1).is_empty(), "unknown slot generation fails closed")
	_expect(RULES.generate_item(&"soul_vessel", &"ancient", 1, 1).is_empty(), "unknown rarity generation fails closed")
	_expect(RULES.generate_item(&"soul_vessel", &"normal", 0, 1).is_empty(), "item level below 1 fails closed")
	_expect(RULES.generate_item(&"soul_vessel", &"normal", 101, 1).is_empty(), "item level above 100 fails closed")
	_expect(RULES.generate_item(&"soul_vessel", &"normal", 2, 1, &"Bad Namespace").is_empty(), "invalid generation namespace fails closed")


func _test_simple_live_affix_filter() -> void:
	var simple_affixes := DEFINITIONS.simple_live_affix_ids("soul_vessel")
	_expect(
		simple_affixes == PackedStringArray(["max_hp_percent", "barrier_capacity_percent"]),
		"the introductory Armor pool exposes HP and a visible Barrier",
	)
	_expect(
		DEFINITIONS.simple_live_affix_ids("soul_boots") \
			== PackedStringArray(["movement_speed_percent", "dodge_chance_percent"]),
		"the Boots lesson exposes movement and a visible NÉ proc",
	)
	_expect(
		DEFINITIONS.simple_live_affix_ids("soul_trace") \
			== PackedStringArray(["damage_percent"]),
		"the jewelry lesson exposes only its direct LIVE damage stat first",
	)
	_expect(
		not "relay_shield" in simple_affixes and not "health_regen" in simple_affixes,
		"the introductory pool contains no relay, trigger, or regeneration rule",
	)
	var expected_live := {
		"soul_vessel": PackedStringArray([
			"max_hp_percent", "barrier_capacity_percent", "armor_power_percent", "health_regen",
			"healing_received", "armor_mana_percent",
		]),
		"soul_boots": PackedStringArray([
			"movement_speed_percent", "dodge_chance_percent", "dash_cooldown_rate", "dash_speed_percent",
			"boots_power_percent", "max_hp_from_boots_percent",
		]),
		"soul_trace": PackedStringArray([
			"damage_percent", "mana_percent", "mana_regen", "cooldown_rate",
			"mana_efficiency",
		]),
	}
	var live_catalog_exact := true
	for slot_id: String in DEFINITIONS.SLOT_IDS:
		live_catalog_exact = live_catalog_exact \
			and DEFINITIONS.live_affix_ids(slot_id) == expected_live[slot_id]
	_expect(
		live_catalog_exact,
		"the canonical random pool contains exactly the auxiliary effects with runtime consumers",
	)
	_expect(
		not DEFINITIONS.live_affix_ids("soul_trace").has("critical_chance")
			and not DEFINITIONS.live_affix_ids("soul_vessel").has("relay_shield")
			and DEFINITIONS.live_affix_ids("soul_focus").is_empty(),
		"unsupported critical/relay hooks and retired Focus equipment cannot enter random pools",
	)

	var seen_affixes := {}
	var filtered_items_are_valid := true
	for seed: int in range(7100, 7300):
		var item := RULES.generate_item(
			&"soul_vessel",
			&"magic",
			3,
			seed,
			&"simple_live_test",
			simple_affixes,
		)
		filtered_items_are_valid = filtered_items_are_valid \
			and RULES.validate_item(item).is_empty()
		var affixes: Array = item.get("affixes", [])
		filtered_items_are_valid = filtered_items_are_valid and affixes.size() == 1
		if affixes.size() == 1:
			var affix_id := String((affixes[0] as Dictionary).get("affix_id", ""))
			filtered_items_are_valid = filtered_items_are_valid and affix_id in simple_affixes
			seen_affixes[affix_id] = true
	_expect(filtered_items_are_valid, "filtered Magic generation always yields one valid simple LIVE affix")
	_expect(
		seen_affixes.keys().all(func(affix_id: Variant) -> bool: return affix_id in simple_affixes)
			and seen_affixes.size() == simple_affixes.size(),
		"deterministic filtered rolls can reach both and only the introductory affixes",
	)

	var legacy := RULES.generate_item(&"soul_vessel", &"magic", 3, 7350, &"compatibility")
	var explicit_null := RULES.generate_item(
		&"soul_vessel",
		&"magic",
		3,
		7350,
		&"compatibility",
		null,
	)
	var filtered := RULES.generate_item(
		&"soul_vessel",
		&"magic",
		3,
		7350,
		&"compatibility",
		simple_affixes,
	)
	_expect(legacy == explicit_null, "omitting the optional affix filter preserves legacy generation exactly")
	_expect(
		filtered.get("uuid") != legacy.get("uuid")
			and filtered == RULES.generate_item(
				&"soul_vessel", &"magic", 3, 7350, &"compatibility", simple_affixes,
			),
		"filtered generation is deterministic and owns a collision-safe UUID namespace",
	)
	_expect(
		RULES.generate_item(
			&"soul_vessel", &"magic", 3, 1, &"filter_validation", "max_hp_percent",
		).is_empty(),
		"a non-collection affix filter fails closed",
	)
	_expect(
		RULES.generate_item(
			&"soul_vessel",
			&"magic",
			3,
			2,
			&"filter_validation",
			["max_hp_percent", "max_hp_percent"],
		).is_empty(),
		"a duplicate affix filter fails closed",
	)
	_expect(
		RULES.generate_item(
			&"soul_vessel",
			&"magic",
			3,
			3,
			&"filter_validation",
			["critical_chance"],
		).is_empty(),
		"a cross-slot affix filter fails closed",
	)
	_expect(
		RULES.generate_item(
			&"soul_vessel",
			&"rare",
			3,
			4,
			&"filter_validation",
			["max_hp_percent"],
		).is_empty(),
		"a filter smaller than the rarity affix count fails closed",
	)
	var tier_two_boots := RULES.generate_item(
		&"soul_boots",
		&"magic",
		5,
		7401,
		&"tier_ladder",
		DEFINITIONS.simple_live_affix_ids("soul_boots"),
	)
	var tier_three_vessel := RULES.generate_item(
		&"soul_vessel",
		&"epic",
		9,
		7402,
		&"tier_ladder",
		DEFINITIONS.live_affix_ids("soul_vessel"),
	)
	var tier_four_trace := RULES.generate_item(
		&"soul_trace",
		&"legendary",
		20,
		7403,
		&"tier_ladder",
		DEFINITIONS.live_affix_ids("soul_trace"),
	)
	_expect(
		RULES.validate_item(tier_two_boots).is_empty()
			and RULES.validate_item(tier_three_vessel).is_empty()
			and RULES.validate_item(tier_four_trace).is_empty(),
		"tier-filtered Boots, Vessel, and Trace items retain canonical item validation",
	)


func _test_fail_closed_validation() -> void:
	var vessel := RULES.generate_item(&"soul_vessel", &"epic", 12, 4101, &"validation")
	_expect(RULES.validate_item(vessel).is_empty(), "baseline validation fixture is valid")

	var missing_primary := vessel.duplicate(true)
	missing_primary.erase("primary")
	_expect(_has_error(RULES.validate_item(missing_primary), "missing required field 'primary'"), "missing primary is rejected")

	var wrong_primary := vessel.duplicate(true)
	wrong_primary["primary"] = {"stat_id": "damage_flat", "unit": "flat", "value": 5.0}
	_expect(_has_error(RULES.validate_item(wrong_primary), "not valid for slot"), "cross-slot primary is rejected")

	var cross_slot_affix := vessel.duplicate(true)
	var cross_affixes: Array = cross_slot_affix["affixes"]
	cross_affixes[0] = {"affix_id": "critical_chance", "unit": "percent", "value": 2.0}
	cross_slot_affix["affixes"] = cross_affixes
	_expect(_has_error(RULES.validate_item(cross_slot_affix), "not allowed for slot"), "cross-slot affix is rejected")

	var wrong_affix_count := vessel.duplicate(true)
	(wrong_affix_count["affixes"] as Array).pop_back()
	_expect(_has_error(RULES.validate_item(wrong_affix_count), "requires exactly 3 affixes"), "rarity affix underflow is rejected")

	var eternal := RULES.generate_item(&"soul_trace", &"eternal", 20, 4102, &"validation")
	var duplicate_affix := eternal.duplicate(true)
	(duplicate_affix["affixes"] as Array)[1] = ((duplicate_affix["affixes"] as Array)[0] as Dictionary).duplicate(true)
	_expect(_has_error(RULES.validate_item(duplicate_affix), "duplicate affix"), "duplicate affix IDs are rejected")

	var bad_uuid := vessel.duplicate(true)
	bad_uuid["uuid"] = "not-a-uuid"
	_expect(_has_error(RULES.validate_item(bad_uuid), "uuid is invalid"), "malformed uuid is rejected")

	var float_level := vessel.duplicate(true)
	float_level["item_level"] = 12.0
	_expect(_has_error(RULES.validate_item(float_level), "must be an integer"), "non-integer item_level is rejected")

	var invalid_flags := vessel.duplicate(true)
	invalid_flags["favorite"] = 1
	invalid_flags["locked"] = "false"
	var flag_errors := RULES.validate_item(invalid_flags)
	_expect(_has_error(flag_errors, "favorite flag must be bool") and _has_error(flag_errors, "locked flag must be bool"), "non-bool protection flags are rejected")

	var non_finite := vessel.duplicate(true)
	(non_finite["primary"] as Dictionary)["value"] = INF
	_expect(_has_error(RULES.validate_item(non_finite), "positive and finite"), "non-finite stat values are rejected")

	var invalid_rank := vessel.duplicate(true)
	invalid_rank["upgrade_rank"] = RULES.MAX_UPGRADE_RANK + 1
	_expect(_has_error(RULES.validate_item(invalid_rank), "upgrade_rank"), "upgrade rank above the hard cap is rejected")
	var rank_five := vessel.duplicate(true)
	rank_five["upgrade_rank"] = 5
	_expect(is_equal_approx(RULES.upgrade_multiplier(rank_five), 1.15), "five upgrades scale original rolls by exactly fifteen percent")


func _test_shared_slot_unlocks() -> void:
	_expect(RULES.unlocked_slots(1).is_empty(), "no auxiliary slot leaks before account level 2")
	_expect(RULES.unlocked_slots(2) == PackedStringArray(["soul_vessel"]), "account level 2 unlocks only Soul Vessel")
	_expect(RULES.unlocked_slots(4) == PackedStringArray(["soul_vessel", "soul_boots"]), "account level 4 adds Soul Boots")
	_expect(RULES.unlocked_slots(7) == PackedStringArray(["soul_vessel", "soul_boots", "soul_trace"]), "account level 7 unlocks all three shared slots")

	var vessel := RULES.generate_item(&"soul_vessel", &"rare", 2, 5001, &"loadout")
	var boots := RULES.generate_item(&"soul_boots", &"rare", 4, 5002, &"loadout")
	var trace := RULES.generate_item(&"soul_trace", &"rare", 7, 5003, &"loadout")
	_expect(_has_error(RULES.validate_shared_loadout({"soul_vessel": vessel}, 1), "locked until account level 2"), "Soul Vessel cannot equip early")
	_expect(RULES.validate_shared_loadout({"soul_vessel": vessel}, 2).is_empty(), "one shared Soul Vessel equips at level 2")
	_expect(_has_error(RULES.validate_shared_loadout({"soul_vessel": vessel, "soul_boots": boots}, 3), "locked until account level 4"), "Soul Boots cannot equip early")
	_expect(RULES.validate_shared_loadout({"soul_vessel": vessel, "soul_boots": boots}, 4).is_empty(), "Vessel and Boots share the account loadout at level 4")
	_expect(_has_error(RULES.validate_shared_loadout({"soul_trace": trace}, 6), "locked until account level 7"), "Soul Trace jewelry cannot equip early")
	_expect(
		RULES.validate_shared_loadout({"soul_vessel": vessel, "soul_boots": boots, "soul_trace": trace}, 7).is_empty(),
		"all three slot-correct items share one account loadout at level 7"
	)

	var duplicate_uuid_trace := trace.duplicate(true)
	duplicate_uuid_trace["uuid"] = vessel["uuid"]
	_expect(
		_has_error(RULES.validate_shared_loadout({"soul_vessel": vessel, "soul_trace": duplicate_uuid_trace}, 7), "cannot occupy multiple"),
		"one item uuid cannot occupy two shared slots"
	)
	var mismatched_trace := trace.duplicate(true)
	mismatched_trace["slot"] = "soul_vessel"
	_expect(
		_has_error(RULES.validate_shared_loadout({"soul_trace": mismatched_trace}, 7), "must match its shared loadout slot"),
		"item slot must match the shared loadout key"
	)
	_expect(_has_error(RULES.validate_shared_loadout({"hero_specific_slot": vessel}, 100), "unknown slot"), "hero-specific or unknown slots fail closed")


func _test_sell_formula_and_protection() -> void:
	var normal := RULES.generate_item(&"soul_vessel", &"normal", 1, 6001, &"sell")
	_expect(RULES.hero_soul_reference_value("normal", 1) == 10, "Normal level 1 Hero Soul reference value is 10")
	_expect(RULES.sell_value(normal) == 6, "Normal level 1 gear sells for exactly 60 percent")
	_expect(RULES.hero_soul_reference_value("magic", 10) == 33, "Magic level 10 Hero Soul formula rounds canonically")
	var magic := RULES.generate_item(&"soul_trace", &"magic", 10, 6002, &"sell")
	_expect(RULES.sell_value(magic) == 20, "Magic level 10 gear rounds 60 percent of the Hero Soul value")
	_expect(RULES.hero_soul_reference_value("eternal", 100) == 43521, "Eternal level 100 uses weight 2187 and level scaling")
	var eternal := RULES.generate_item(&"soul_trace", &"eternal", 100, 6003, &"sell")
	_expect(RULES.sell_value(eternal) == 26113, "Eternal level 100 gear sells for the exact rounded 60 percent value")
	_expect(RULES.can_sell(eternal), "valid unprotected gear can be sold")
	var favorite := eternal.duplicate(true)
	favorite["favorite"] = true
	_expect(not RULES.can_sell(favorite) and RULES.sell_value(favorite) == 0, "favorite gear is protected from sale")
	var locked := eternal.duplicate(true)
	locked["locked"] = true
	_expect(not RULES.can_sell(locked) and RULES.sell_value(locked) == 0, "locked gear is protected from sale")
	_expect(RULES.sell_value({}) == 0, "invalid gear has no sell value")
	_expect(RULES.hero_soul_reference_value("invalid", 1) == 0, "unknown rarity has no economy value")


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for error: String in errors:
		if error.to_lower().contains(fragment.to_lower()):
			return true
	return false


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _finish() -> void:
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("AUXILIARY EQUIPMENT TEST PASSED - %d checks" % _checks)
	else:
		print("AUXILIARY EQUIPMENT TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
