extends SceneTree

const COMBAT_AFFIXES := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")

const SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_rarity_contract()
	_test_affix_catalog()
	_test_deterministic_affix_rolls()
	_test_variant_rules()
	_test_fusion_and_sale_economy()
	_finish()


func _test_rarity_contract() -> void:
	_expect(
		SOUL_RULES.RARITY_NAMES == ["Normal", "Magic", "Rare", "Epic", "Legendary", "Crystal", "Mythic", "Eternal"],
		"Hero Souls expose the eight approved V0.4 rarity labels"
	)
	_expect(SOUL_RULES.Rarity.NORMAL == 0 and SOUL_RULES.Rarity.ETERNAL == 7, "V0.4 rarity indices span Normal 0 through Eternal 7")
	_expect(SOUL_RULES.Rarity.COMMON == SOUL_RULES.Rarity.NORMAL, "legacy Rarity.COMMON remains a compatibility alias for Normal")
	_expect(SOUL_RULES.AFFIX_SLOT_COUNTS == [0, 1, 2, 3, 4, 5, 6, 7], "every rarity step opens one additional affix slot")
	_expect(SOUL_RULES.SELL_WEIGHTS == [1, 3, 9, 27, 81, 243, 729, 2187], "sell weights triple at every rarity")
	var expected_ranges := [
		Vector2(0.0, 0.0),
		Vector2(0.80, 1.00),
		Vector2(1.10, 1.30),
		Vector2(1.45, 1.70),
		Vector2(1.90, 2.20),
		Vector2(2.45, 2.80),
		Vector2(3.10, 3.55),
		Vector2(3.90, 4.50),
	]
	_expect(SOUL_RULES.ROLL_MULTIPLIER_RANGES == expected_ranges, "rarity roll multiplier ranges match the V0.4 table")
	for rarity: int in SOUL_RULES.RARITY_NAMES.size():
		_expect(SOUL_RULES.rarity_name(rarity) == SOUL_RULES.RARITY_NAMES[rarity], "rarity %d resolves its display label" % rarity)
		_expect(SOUL_RULES.affix_slot_count(rarity) == SOUL_RULES.AFFIX_SLOT_COUNTS[rarity], "rarity %d resolves its affix count" % rarity)
		_expect(SOUL_RULES.rarity_roll_multiplier_range(rarity) == expected_ranges[rarity], "rarity %d resolves its roll multiplier range" % rarity)
		_expect(not SOUL_RULES.rarity_display_name_vi(rarity).is_empty(), "rarity %d exposes centralized Vietnamese display copy" % rarity)
		_expect(SOUL_RULES.affix_tier_for_rarity(rarity) == rarity, "rarity %d maps to its explicit affix tier" % rarity)
	_expect(SOUL_RULES.weapon_damage_percent(SOUL_RULES.Rarity.RARE, 9) == 128.0, "Rare Lv9 weapon uses 128 percent of character Power")
	var every_weapon_level_is_stronger := true
	for rarity: int in SOUL_RULES.RARITY_NAMES.size():
		for item_level: int in range(1, 100):
			every_weapon_level_is_stronger = every_weapon_level_is_stronger and (
				SOUL_RULES.weapon_damage_percent(rarity, item_level + 1)
					> SOUL_RULES.weapon_damage_percent(rarity, item_level)
			)
	_expect(every_weapon_level_is_stronger, "every higher weapon level has a strictly higher Power percentage")
	_expect(not SOUL_RULES.player_can_obtain_rarity(SOUL_RULES.Rarity.RARE, SOUL_RULES.Rarity.MAGIC), "Hero Identity minimum rarity remains enforced")


func _test_affix_catalog() -> void:
	var expected_ranges := {
		"max_hp": Vector2(4.0, 6.0),
		"core_damage": Vector2(3.0, 5.0),
		"max_mana": Vector2(5.0, 8.0),
		"defense": Vector2(4.0, 7.0),
		"movement": Vector2(2.0, 4.0),
		"attack_speed": Vector2(2.0, 4.0),
		"crit_chance": Vector2(1.5, 3.0),
		"crit_damage": Vector2(8.0, 12.0),
		"cooldown_recovery": Vector2(2.0, 4.0),
		"mana_regen": Vector2(5.0, 8.0),
		"dodge": Vector2(1.5, 3.0),
		"healing_received": Vector2(5.0, 8.0),
		"melee_damage": Vector2(4.0, 7.0),
		"defense_while_attacking": Vector2(2.0, 4.0),
		"stagger_resist": Vector2(6.0, 10.0),
		"low_hp_defense": Vector2(5.0, 8.0),
		"melee_threat_shield": Vector2(2.0, 4.0),
		"close_range_damage": Vector2(4.0, 7.0),
		"projectile_damage": Vector2(4.0, 7.0),
		"projectile_speed": Vector2(6.0, 10.0),
		"dash_cooldown": Vector2(4.0, 7.0),
		"post_dash_damage": Vector2(5.0, 8.0),
		"move_attack_penalty_reduction": Vector2(10.0, 20.0),
		"execute_damage": Vector2(5.0, 8.0),
		"active_skill_power": Vector2(4.0, 7.0),
		"active_mana_cost": Vector2(4.0, 7.0),
		"active_cooldown": Vector2(3.0, 5.0),
		"summon_cooldown": Vector2(3.0, 5.0),
		"effect_duration": Vector2(5.0, 8.0),
		"area_size": Vector2(4.0, 7.0),
		"active_power": Vector2(4.0, 7.0),
		"summon_power": Vector2(5.0, 8.0),
		"departure_power": Vector2(5.0, 8.0),
		"relay_shield": Vector2(2.0, 4.0),
		"ready_window_seconds": Vector2(0.10, 0.18),
		"no_relay_refund": Vector2(4.0, 7.0),
		"relay_arrival_speed": Vector2(3.0, 6.0),
		"departure_distance_damage": Vector2(5.0, 10.0),
		"relay_mana_restore": Vector2(2.0, 4.0),
		"summon_multi_hit_cooldown": Vector2(4.0, 7.0),
	}
	var rollable_ids := SOUL_RULES.get_rollable_affix_ids()
	var canonical_live_ids := PackedStringArray(COMBAT_AFFIXES.LIVE_AFFIX_IDS)
	canonical_live_ids.sort()
	_expect(
		rollable_ids == canonical_live_ids,
		"new Hero Weapons roll exactly the canonical runtime-live affix set",
	)
	_expect(_count_pool(SOUL_RULES.POOL_UNIVERSAL) == 12, "Universal pool contains exactly twelve affixes")
	_expect(_count_affinity(SOUL_RULES.AFFINITY_WARRIOR) == 6, "Warrior affinity contains exactly six affixes")
	_expect(_count_affinity(SOUL_RULES.AFFINITY_RANGER) == 6, "Ranger affinity contains exactly six affixes")
	_expect(_count_affinity(SOUL_RULES.AFFINITY_MAGICIAN) == 6, "Magician affinity contains exactly six affixes")
	_expect(_count_pool(SOUL_RULES.POOL_SOUL_ACTION) == 10, "Soul Action pool contains exactly ten affixes")
	_expect(SOUL_RULES.AFFIX_POOL_WEIGHTS_BELOW_LEGENDARY == {
		"universal": 35.0,
		"matching_affinity": 45.0,
		"soul_action": 15.0,
		"off_affinity": 5.0,
	}, "pre-Legendary pool weights match 35/45/15/5")
	_expect(SOUL_RULES.AFFIX_POOL_WEIGHTS_LEGENDARY_PLUS == {
		"universal": 35.0,
		"matching_affinity": 40.0,
		"soul_action": 15.0,
		"off_affinity": 10.0,
	}, "Legendary-plus pool weights match 35/40/15/10")

	var definitions_are_complete := true
	for affix_id: String in expected_ranges:
		if not SOUL_RULES.AFFIX_CATALOG.has(affix_id):
			definitions_are_complete = false
			continue
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		var expected_range: Vector2 = expected_ranges[affix_id]
		var tags: Variant = definition.get("tags", [])
		definitions_are_complete = definitions_are_complete \
			and is_equal_approx(float(definition.get("min", -1.0)), expected_range.x) \
			and is_equal_approx(float(definition.get("max", -1.0)), expected_range.y) \
			and tags is Array and not (tags as Array).is_empty() \
			and not String(definition.get("field", "")).is_empty() \
			and not String(definition.get("unit", "")).is_empty() \
			and not String(definition.get("stacking_group", "")).is_empty()
	_expect(definitions_are_complete, "the complete readable catalog preserves exact ranges, tags, units and stacking groups")
	_expect(SOUL_RULES.AFFIX_CATALOG.has("max_hp_flat") and not rollable_ids.has("max_hp_flat"), "prototype affix IDs remain readable but cannot enter new rolls")
	var localized_all := true
	for affix_id: String in rollable_ids:
		var display: Dictionary = SOUL_RULES.affix_display_metadata(affix_id, 5.0, 2)
		localized_all = localized_all and not String(display.get("display_name", "")).is_empty() \
			and not String(display.get("description", "")).is_empty() \
			and not String(display.get("display_name", "")).contains("_")
	_expect(localized_all, "every runtime-live roll exposes Vietnamese-ready names and descriptions")
	var every_roll_is_live := true
	for affix_id: String in rollable_ids:
		every_roll_is_live = every_roll_is_live and COMBAT_AFFIXES.is_live_affix(affix_id)
	_expect(every_roll_is_live, "no newly rollable affix can enter the CHƯA KÍCH HOẠT state")


func _test_deterministic_affix_rolls() -> void:
	var normal := SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.NORMAL, 1, &"starter", 1001)
	var magic := SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.MAGIC, 5, &"drop", 1002)
	var eternal := SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.ETERNAL, 100, &"drop", 1003, SOUL_RULES.AFFINITY_MAGICIAN)
	_expect(SOUL_RULES.validate_instance(normal).is_empty(), "starter Normal Sword Soul validates")
	_expect((normal["affixes"] as Array).is_empty(), "Normal rarity rolls no affixes")
	_expect((magic["affixes"] as Array).size() == 1, "Magic rarity rolls exactly one affix")
	_expect((eternal["affixes"] as Array).size() == 7, "Eternal rarity rolls exactly seven affixes")
	_expect(
		magic["affixes"] == SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.MAGIC, 5, &"drop", 1002)["affixes"],
		"affix generation is deterministic for a content seed"
	)

	var all_rolls_valid := true
	var saw_matching_affinity := false
	var saw_off_affinity := false
	var saw_universal := false
	var saw_soul_action := false
	var legendary_synergy_guaranteed := true
	for affinity: StringName in SOUL_RULES.VALID_AFFINITIES:
		for seed: int in range(2000, 2256):
			var affixes: Array = SOUL_RULES.roll_affixes(SOUL_RULES.Rarity.ETERNAL, affinity, seed)
			var seen_ids := {}
			var group_counts := {}
			var has_synergy_affix := false
			all_rolls_valid = all_rolls_valid and affixes.size() == 7
			for affix: Dictionary in affixes:
				var affix_id := String(affix.get("affix_id", ""))
				var group := String(affix.get("stacking_group", ""))
				var multiplier := float(affix.get("roll_multiplier", 0.0))
				all_rolls_valid = all_rolls_valid \
					and not seen_ids.has(affix_id) \
					and multiplier >= 3.90 and multiplier <= 4.50 \
					and float(affix.get("value", 0.0)) > 0.0 \
					and int(affix.get("tier", 0)) == 7 \
					and not String(affix.get("display_name", "")).is_empty() \
					and float(affix.get("roll_max", 0.0)) >= float(affix.get("roll_min", 0.0))
				seen_ids[affix_id] = true
				group_counts[group] = int(group_counts.get(group, 0)) + 1
				all_rolls_valid = all_rolls_valid and int(group_counts[group]) <= SOUL_RULES.MAX_AFFIXES_PER_STACKING_GROUP
				var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
				var pool := String(definition["pool"])
				saw_universal = saw_universal or pool == SOUL_RULES.POOL_UNIVERSAL
				saw_soul_action = saw_soul_action or pool == SOUL_RULES.POOL_SOUL_ACTION
				if pool == SOUL_RULES.POOL_AFFINITY:
					saw_matching_affinity = saw_matching_affinity or StringName(definition["affinity"]) == affinity
					saw_off_affinity = saw_off_affinity or StringName(definition["affinity"]) != affinity
					has_synergy_affix = has_synergy_affix or StringName(definition["affinity"]) == affinity
				has_synergy_affix = has_synergy_affix or pool == SOUL_RULES.POOL_SOUL_ACTION
			legendary_synergy_guaranteed = legendary_synergy_guaranteed and has_synergy_affix
	_expect(all_rolls_valid, "deterministic rolls never duplicate an affix or exceed two per stacking group")
	for rarity: int in range(SOUL_RULES.Rarity.LEGENDARY, SOUL_RULES.Rarity.ETERNAL + 1):
		for affinity: StringName in SOUL_RULES.VALID_AFFINITIES:
			for seed: int in range(2300, 2364):
				var has_synergy_affix := false
				for affix: Dictionary in SOUL_RULES.roll_affixes(rarity, affinity, seed):
					var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[String(affix["affix_id"])]
					var pool := String(definition["pool"])
					has_synergy_affix = has_synergy_affix \
						or pool == SOUL_RULES.POOL_SOUL_ACTION \
						or (pool == SOUL_RULES.POOL_AFFINITY and StringName(definition["affinity"]) == affinity)
				legendary_synergy_guaranteed = legendary_synergy_guaranteed and has_synergy_affix
	_expect(legendary_synergy_guaranteed, "every Legendary-plus roll guarantees one Soul Action or matching-affinity affix")
	_expect(saw_matching_affinity and saw_off_affinity, "weighted rolls include both matching and off-affinity definitions")
	_expect(saw_universal and saw_soul_action, "weighted rolls include both Universal and Soul Action definitions")

	var supported_tags := PackedStringArray(["melee", "active", "relay", "departure"])
	var tag_filter_is_fail_closed := true
	for seed: int in range(2400, 2528):
		for affix: Dictionary in SOUL_RULES.roll_affixes(SOUL_RULES.Rarity.ETERNAL, SOUL_RULES.AFFINITY_WARRIOR, seed, supported_tags):
			var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[String(affix["affix_id"])]
			var required_tags: Variant = definition.get("required_action_tags", [])
			if required_tags is Array:
				for required_tag: String in required_tags:
					tag_filter_is_fail_closed = tag_filter_is_fail_closed and supported_tags.has(required_tag)
	_expect(tag_filter_is_fail_closed, "supported_action_tags fail closed and exclude unsupported projectile-only affixes")

	var simple_core_ids := PackedStringArray([
		"max_hp", "core_damage", "max_mana", "defense",
	])
	var filtered_rolls_live := true
	for seed: int in range(2600, 2728):
		var filtered := SOUL_RULES.create_instance(
			&"sword_hero",
			SOUL_RULES.Rarity.RARE,
			5,
			&"progressive_loot_test",
			seed,
			SOUL_RULES.AFFINITY_WARRIOR,
			&"",
			PackedStringArray(["melee", "active", "summon", "departure"]),
			simple_core_ids,
		)
		var affixes: Array = filtered.get("affixes", [])
		filtered_rolls_live = filtered_rolls_live and affixes.size() == 2
		for affix: Dictionary in affixes:
			var affix_id := String(affix.get("affix_id", ""))
			filtered_rolls_live = filtered_rolls_live \
				and simple_core_ids.has(affix_id) \
				and COMBAT_AFFIXES.is_live_affix(affix_id)
	_expect(
		filtered_rolls_live,
		"create_instance's concrete allowlist rolls only simple LIVE core affixes",
	)
	_expect(
		SOUL_RULES.roll_affixes(
			SOUL_RULES.Rarity.RARE,
			SOUL_RULES.AFFINITY_WARRIOR,
			2800,
			PackedStringArray(["melee"]),
			PackedStringArray(["future_unsupported_affix"]),
		).is_empty(),
		"an allowlist with no rollable LIVE intersection fails closed to no affixes",
	)

	var duplicate_instance: Dictionary = eternal.duplicate(true)
	duplicate_instance["affixes"] = [_affix_record("max_hp"), _affix_record("max_hp")]
	_expect(_has_error(SOUL_RULES.validate_instance(duplicate_instance), "duplicate affix"), "instance validation rejects duplicate affix IDs")
	var overstacked_instance: Dictionary = eternal.duplicate(true)
	overstacked_instance["affixes"] = [
		_affix_record("active_power"),
		_affix_record("summon_power"),
		_affix_record("departure_power"),
	]
	_expect(_has_error(SOUL_RULES.validate_instance(overstacked_instance), "stacking group 'skill_power'"), "instance validation rejects a third affix from one stacking group")


func _test_variant_rules() -> void:
	_expect(SOUL_RULES.variant_minimum_rarity(SOUL_RULES.Rarity.NORMAL) == SOUL_RULES.Rarity.LEGENDARY, "Normal Heroes begin variant eligibility at Legendary")
	_expect(SOUL_RULES.variant_minimum_rarity(SOUL_RULES.Rarity.MAGIC) == SOUL_RULES.Rarity.CRYSTAL, "Magic Heroes begin variant eligibility at Crystal")
	_expect(SOUL_RULES.variant_minimum_rarity(SOUL_RULES.Rarity.LEGENDARY) == SOUL_RULES.Rarity.ETERNAL, "variant threshold clamps to Eternal")
	_expect(is_equal_approx(SOUL_RULES.variant_chance(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.LEGENDARY), 0.05), "Legendary variant base chance is five percent")
	_expect(is_equal_approx(SOUL_RULES.variant_chance(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.CRYSTAL), 0.08), "Crystal variant base chance is eight percent")
	_expect(is_equal_approx(SOUL_RULES.variant_chance(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.MYTHIC), 0.12), "Mythic variant base chance is twelve percent")
	_expect(is_equal_approx(SOUL_RULES.variant_chance(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.ETERNAL), 0.20), "Eternal variant base chance is twenty percent")
	_expect(SOUL_RULES.variant_chance(SOUL_RULES.Rarity.MAGIC, SOUL_RULES.Rarity.LEGENDARY) == 0.0, "rarities below minimum plus four cannot roll a variant")
	var expected_attempt_chances := [0.05, 0.10, 0.15, 0.20, 1.0]
	var pity_curve_matches := true
	for index: int in expected_attempt_chances.size():
		pity_curve_matches = pity_curve_matches and is_equal_approx(
			SOUL_RULES.variant_chance_for_attempt(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.LEGENDARY, index + 1),
			expected_attempt_chances[index]
		)
	_expect(pity_curve_matches, "eligible failures add five percentage points and the fifth attempt is guaranteed")
	_expect(SOUL_RULES.should_roll_variant(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.LEGENDARY, 5, 77), "variant pity guarantees the fifth eligible attempt")
	_expect(not SOUL_RULES.should_roll_variant(SOUL_RULES.Rarity.MAGIC, SOUL_RULES.Rarity.LEGENDARY, 5, 77), "pity never bypasses the rarity threshold")
	_expect(
		SOUL_RULES.should_roll_variant(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.ETERNAL, 2, 8101)
		== SOUL_RULES.should_roll_variant(SOUL_RULES.Rarity.NORMAL, SOUL_RULES.Rarity.ETERNAL, 2, 8101),
		"variant rolls are deterministic for one seed and pity attempt"
	)
	_expect(SOUL_RULES.next_variant_attempt_number(1, false) == 2 and SOUL_RULES.next_variant_attempt_number(4, false) == 5, "variant pity attempt advances and caps at five")
	_expect(SOUL_RULES.next_variant_attempt_number(5, true) == 1, "successful variant rolls reset pity to attempt one")


func _test_fusion_and_sale_economy() -> void:
	var sell_weights_match := true
	for rarity: int in SOUL_RULES.RARITY_NAMES.size():
		sell_weights_match = sell_weights_match and SOUL_RULES.sell_value_for(rarity, 1) == 10 * SOUL_RULES.SELL_WEIGHTS[rarity]
	_expect(sell_weights_match, "level-one sell values use base ten times the exact rarity weight")
	_expect(SOUL_RULES.sell_value_for(SOUL_RULES.Rarity.NORMAL, 1) == 10, "level-one Normal Soul sells for ten")
	_expect(SOUL_RULES.sell_value_for(SOUL_RULES.Rarity.NORMAL, 100) == 20, "sell item-level scaling uses one percent per level after level one")
	_expect(
		SOUL_RULES.fusion_cost(SOUL_RULES.Rarity.NORMAL, 8)
		== 2 * SOUL_RULES.FUSION_INPUT_COUNT * SOUL_RULES.sell_value_for(SOUL_RULES.Rarity.NORMAL, 8),
		"compatibility fusion_cost API equals twice the total sell value of three uniform inputs"
	)

	var fusion_inputs: Array[Dictionary] = []
	for index: int in SOUL_RULES.FUSION_INPUT_COUNT:
		fusion_inputs.append(SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.NORMAL, index + 1, &"drop", 9000 + index))
	_expect(SOUL_RULES.fusion_errors(fusion_inputs).is_empty(), "three matching Normal Souls are valid fusion inputs")
	var expected_input_cost := 0
	for soul: Dictionary in fusion_inputs:
		expected_input_cost += SOUL_RULES.sell_value(soul)
	expected_input_cost *= SOUL_RULES.FUSION_SELL_MULTIPLIER
	_expect(SOUL_RULES.fusion_cost_for_inputs(fusion_inputs) == expected_input_cost, "input-aware fusion cost is twice the exact sum of all sell values")
	var fused := SOUL_RULES.fuse(fusion_inputs, 9100)
	_expect(int(fused.get("rarity", -1)) == SOUL_RULES.Rarity.MAGIC, "fusion guarantees the next rarity")
	_expect(int(fused.get("item_level", 0)) == 3, "fusion output keeps the highest input item level")
	_expect(int(fused.get("fusion_cost", 0)) == expected_input_cost, "fusion persists the exact input-aware cost")
	_expect((fused.get("consumed_instance_ids", []) as Array).size() == SOUL_RULES.FUSION_INPUT_COUNT, "fusion records exactly three consumed instances")
	fusion_inputs[0]["locked"] = true
	_expect(not SOUL_RULES.fusion_errors(fusion_inputs).is_empty(), "locked Souls remain protected from fusion")
	fusion_inputs[0]["locked"] = false
	fusion_inputs[0]["monster_soul_id"] = "vampire_soul"
	_expect(not SOUL_RULES.fusion_errors(fusion_inputs).is_empty(), "socketed Monster Souls must be removed before fusion")

	var eternal_inputs: Array[Dictionary] = []
	for index: int in SOUL_RULES.FUSION_INPUT_COUNT:
		eternal_inputs.append(SOUL_RULES.create_instance(&"sword_hero", SOUL_RULES.Rarity.ETERNAL, 1, &"drop", 9200 + index))
	_expect(_has_error(SOUL_RULES.fusion_errors(eternal_inputs), "cannot be fused upward"), "Eternal remains the hard fusion ceiling")
	_expect(SOUL_RULES.fusion_cost(SOUL_RULES.Rarity.ETERNAL, 1) == 0, "Eternal has no upward fusion cost")


func _count_pool(pool: String) -> int:
	var count := 0
	for affix_id: String in SOUL_RULES.AFFIX_CATALOG:
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		if String(definition.get("pool", "")) == pool:
			count += 1
	return count


func _count_affinity(affinity: StringName) -> int:
	var count := 0
	for affix_id: String in SOUL_RULES.AFFIX_CATALOG:
		var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
		if String(definition.get("pool", "")) == SOUL_RULES.POOL_AFFINITY and StringName(definition.get("affinity", "")) == affinity:
			count += 1
	return count


func _affix_record(affix_id: String) -> Dictionary:
	var definition: Dictionary = SOUL_RULES.AFFIX_CATALOG[affix_id]
	return {
		"affix_id": affix_id,
		"field": definition["field"],
		"unit": definition["unit"],
		"value": float(definition["min"]),
		"stacking_group": definition["stacking_group"],
	}


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for error: String in errors:
		if error.contains(fragment):
			return true
	return false


func _finish() -> void:
	if _failures.is_empty():
		print("HERO SOUL RULES TEST PASSED - %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("HERO SOUL RULES TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
