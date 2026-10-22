extends SceneTree

const TEST_SAVE_PATH := "user://tests/hero_soul_fusion_live_affix_test.json"
const RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const COMBAT_AFFIXES := preload("res://game/meta/hero_souls/hero_soul_combat_affixes.gd")
const AUXILIARY_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const LEVEL_8_REWARD := preload("res://data/content/rewards/chapter_1_level_8_reward.tres")
const LEVEL_9_REWARD := preload("res://data/content/rewards/chapter_1_level_9_reward.tres")
const LEVEL_10_REWARD := preload("res://data/content/rewards/chapter_1_level_10_reward.tres")
const STRESS_SEEDS_PER_HERO_AND_RARITY := 128

var _checks := 0
var _failures: Array[String] = []
var _stress_fusion_count := 0
var _stress_affix_count := 0


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_canonical_prototype_contract()
	_test_campaign_reward_signatures()
	_test_seeded_fusion_stress()
	_test_pure_fusion_protection()
	_test_atomic_save_fusion()
	_finish()


func _test_canonical_prototype_contract() -> void:
	for hero_id: StringName in [&"sword_hero", &"axe_hero"]:
		var contract := COMBAT_AFFIXES.prototype_fusion_roll_contract(hero_id)
		var tags: PackedStringArray = contract.get("supported_action_tags", PackedStringArray())
		var allowed: PackedStringArray = contract.get("allowed_affix_ids", PackedStringArray())
		_expect(not contract.is_empty(), "%s owns a canonical prototype Fusion contract" % hero_id)
		_expect(
			tags.has("melee") and tags.has("active") and tags.has("summon")
				and tags.has("departure") and not tags.has("projectile"),
			"%s contract names its live action surface and excludes off-kit projectile tags" % hero_id
		)
		var all_allowed_are_live := allowed.size() == COMBAT_AFFIXES.LIVE_AFFIX_IDS.size()
		for affix_id: String in allowed:
			all_allowed_are_live = all_allowed_are_live and COMBAT_AFFIXES.is_live_affix(affix_id)
		_expect(all_allowed_are_live, "%s Fusion whitelist is exactly the canonical LIVE affix set" % hero_id)
	_expect(
		COMBAT_AFFIXES.prototype_fusion_roll_contract(&"future_hero").is_empty(),
		"an unauthored Hero Identity fails closed instead of inheriting wildcard actions"
	)


func _test_campaign_reward_signatures() -> void:
	var level_8_grants: Array = LEVEL_8_REWARD.auxiliary_equipment_grants
	var level_8_item: Dictionary = (level_8_grants[0] as Resource).call("create_item_instance")
	var level_8_affix_ids := PackedStringArray()
	var all_level_8_affixes_are_live := true
	for raw_affix: Variant in level_8_item.get("affixes", []):
		if not raw_affix is Dictionary:
			all_level_8_affixes_are_live = false
			continue
		var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
		level_8_affix_ids.append(affix_id)
		all_level_8_affixes_are_live = all_level_8_affixes_are_live \
			and affix_id in AUXILIARY_DEFINITIONS.live_affix_ids("soul_vessel")
	level_8_affix_ids.sort()
	_expect(
		String(level_8_item.get("uuid", "")) == "5444fa20-0680-b49a-dbb5-4a553e46a8b1"
			and String(level_8_item.get("slot", "")) == "soul_vessel"
			and level_8_affix_ids.size() == 3
			and all_level_8_affixes_are_live
			and level_8_item == (level_8_grants[0] as Resource).call("create_item_instance"),
		"Level 8 keeps its stable entitlement identity and grants three LIVE Armor affixes (actual %s / %s / live=%s)" % [
			String(level_8_item.get("uuid", "")),
			", ".join(level_8_affix_ids),
			str(all_level_8_affixes_are_live),
		]
	)

	var level_9_soul := _first_reward_soul(LEVEL_9_REWARD)
	var level_9_signature := _affix_signature(level_9_soul)
	_expect(
		String(level_9_soul.get("instance_id", "")) == "5a0bb38635cd55413a87e61c"
			and level_9_signature == "healing_received:7.95,active_power:7.54",
		"Level 9 deterministic Rare Sword Soul follows the current rarity scaling contract (actual %s / %s)" % [
			String(level_9_soul.get("instance_id", "")),
			level_9_signature,
		]
	)

	var level_10_soul := _first_reward_soul(LEVEL_10_REWARD)
	var level_10_signature := _affix_signature(level_10_soul)
	_expect(
		String(level_10_soul.get("instance_id", "")) == "514c356c4da98824cda12751"
			and level_10_signature == "dodge:3.78,active_skill_power:7.86,barrier_capacity:8.79",
		"Level 10 deterministic Epic Sword Soul follows the current rarity scaling contract (actual %s / %s)" % [
			String(level_10_soul.get("instance_id", "")),
			level_10_signature,
		]
	)


func _test_seeded_fusion_stress() -> void:
	var all_outputs_structurally_valid := true
	var all_outputs_deterministic := true
	var every_affix_live := true
	var every_affix_matches_actions := true
	var every_output_uuid_unique := true
	var seen_output_ids := {}
	var seen_live_affixes := {}
	var first_problem := ""
	var hero_index := 0
	for hero_id: StringName in [&"sword_hero", &"axe_hero"]:
		var contract := COMBAT_AFFIXES.prototype_fusion_roll_contract(hero_id)
		var tags: PackedStringArray = contract["supported_action_tags"]
		for source_rarity: int in range(RULES.Rarity.NORMAL, RULES.Rarity.ETERNAL):
			for sample: int in STRESS_SEEDS_PER_HERO_AND_RARITY:
				var input_seed_base := 3000000 + hero_index * 1000000 + source_rarity * 10000 + sample * 10
				var output_seed := 8000000 + hero_index * 1000000 + source_rarity * 10000 + sample
				var inputs: Array[Dictionary] = []
				for input_index: int in RULES.FUSION_INPUT_COUNT:
					inputs.append(RULES.create_instance(
						hero_id,
						source_rarity,
						1 + ((sample + input_index * 7) % 100),
						&"fusion_live_stress_input",
						input_seed_base + input_index,
						RULES.AFFINITY_WARRIOR
					))
				var fused := RULES.fuse(inputs, output_seed)
				var repeated := RULES.fuse(inputs, output_seed)
				_stress_fusion_count += 1
				var output_id := String(fused.get("instance_id", ""))
				if seen_output_ids.has(output_id):
					every_output_uuid_unique = false
					if first_problem.is_empty(): first_problem = "duplicate output UUID %s" % output_id
				seen_output_ids[output_id] = true
				var expected_level := 1
				for input: Dictionary in inputs:
					expected_level = maxi(expected_level, int(input.get("item_level", 1)))
				var affixes: Array = fused.get("affixes", [])
				var structurally_valid := (
					not fused.is_empty()
					and int(fused.get("rarity", -1)) == source_rarity + 1
					and int(fused.get("item_level", 0)) == expected_level
					and int(fused.get("fusion_cost", 0)) == RULES.fusion_cost_for_inputs(inputs)
					and (fused.get("consumed_instance_ids", []) as Array).size() == RULES.FUSION_INPUT_COUNT
					and affixes.size() == RULES.affix_slot_count(source_rarity + 1)
					and RULES.validate_instance(fused).is_empty()
				)
				all_outputs_structurally_valid = all_outputs_structurally_valid and structurally_valid
				all_outputs_deterministic = all_outputs_deterministic and fused == repeated
				if not structurally_valid and first_problem.is_empty():
					first_problem = "%s rarity %d seed %d failed structure" % [hero_id, source_rarity, output_seed]
				for raw_affix: Variant in affixes:
					var affix := raw_affix as Dictionary
					var affix_id := String(affix.get("affix_id", ""))
					_stress_affix_count += 1
					seen_live_affixes[affix_id] = true
					if not COMBAT_AFFIXES.is_live_affix(affix_id):
						every_affix_live = false
						if first_problem.is_empty(): first_problem = "unsupported affix %s" % affix_id
					var definition: Dictionary = RULES.AFFIX_CATALOG.get(affix_id, {})
					for required_tag: String in definition.get("required_action_tags", []):
						if not tags.has(required_tag):
							every_affix_matches_actions = false
							if first_problem.is_empty(): first_problem = "%s requires off-kit tag %s" % [affix_id, required_tag]
		hero_index += 1

	var expected_outputs := 2 * RULES.MAX_RARITY * STRESS_SEEDS_PER_HERO_AND_RARITY
	_expect(
		_stress_fusion_count == expected_outputs,
		"seeded stress covers %d Sword/Axe fusions across every upward rarity" % expected_outputs
	)
	_expect(all_outputs_structurally_valid, "all stress outputs preserve 3-to-1 rarity/level/cost/validation invariants (%s)" % first_problem)
	_expect(all_outputs_deterministic, "repeating every stress seed returns the exact same UUID and affix rolls")
	_expect(every_output_uuid_unique and seen_output_ids.size() == expected_outputs, "all stress transactions produce collision-free deterministic output UUIDs")
	_expect(every_affix_live, "all %d rolled Fusion affixes are consumed by live gameplay" % _stress_affix_count)
	_expect(every_affix_matches_actions, "no stress output requires an action outside the Sword/Axe prototype kits")
	var reachable_live := {}
	var melee_tags: PackedStringArray = COMBAT_AFFIXES.prototype_fusion_roll_contract(
		&"sword_hero"
	).get("supported_action_tags", PackedStringArray())
	for affix_id: String in COMBAT_AFFIXES.LIVE_AFFIX_IDS:
		var definition: Dictionary = RULES.AFFIX_CATALOG.get(affix_id, {})
		var reachable := true
		for required_tag: String in definition.get("required_action_tags", []):
			reachable = reachable and melee_tags.has(required_tag)
		if reachable:
			reachable_live[affix_id] = true
	var seen_only_reachable := true
	for raw_affix_id: Variant in seen_live_affixes.keys():
		seen_only_reachable = seen_only_reachable \
			and reachable_live.has(String(raw_affix_id))
	_expect(
		seen_only_reachable and seen_live_affixes.size() == reachable_live.size(),
		"stress reaches every live Sword/Axe affix without admitting an off-kit or display-only roll"
	)


func _test_pure_fusion_protection() -> void:
	var inputs := _normal_sword_inputs(9100000)
	var locked_inputs := inputs.duplicate(true)
	locked_inputs[0]["locked"] = true
	_expect(not RULES.fusion_errors(locked_inputs).is_empty(), "locked input remains protected from Fusion")
	var favorite_inputs := inputs.duplicate(true)
	favorite_inputs[0]["favorite"] = true
	_expect(not RULES.fusion_errors(favorite_inputs).is_empty(), "favorite input remains protected from Fusion")
	var equipped_inputs := inputs.duplicate(true)
	equipped_inputs[0]["equipped"] = true
	_expect(not RULES.fusion_errors(equipped_inputs).is_empty(), "equipped input remains protected from Fusion")
	var socketed_inputs := inputs.duplicate(true)
	socketed_inputs[0]["monster_soul_id"] = "future_monster_soul"
	_expect(not RULES.fusion_errors(socketed_inputs).is_empty(), "socketed Monster Soul input remains protected from Fusion")
	var unknown_inputs: Array[Dictionary] = []
	for index: int in RULES.FUSION_INPUT_COUNT:
		unknown_inputs.append(RULES.create_instance(
			&"future_hero", RULES.Rarity.NORMAL, 1, &"fusion_unknown", 9200000 + index
		))
	_expect(RULES.fuse(unknown_inputs, 9200100).is_empty(), "unauthored Hero Fusion fails closed without wildcard affixes")


func _test_atomic_save_fusion() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(save != null, "SaveService autoload is available for the atomic Fusion check")
	if save == null:
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated Fusion profile loads")
	var inputs := _normal_sword_inputs(9300000)
	var input_ids: Array[String] = []
	for index: int in inputs.size():
		var input := inputs[index]
		input_ids.append(String(input["instance_id"]))
		_expect(
			save.grant_hero_soul(input, "test:fusion_live:grant:%d" % index),
			"Fusion input %d commits once" % (index + 1)
		)
	_expect(save.transact_once(
		"test:fusion_live:unlock",
		func(candidate: Dictionary) -> bool:
			candidate["currencies"]["account"] = 100000
			candidate["progression"]["features"]["hero_soul_fusion"] = true
			return true
	), "isolated profile receives explicit Level 10 Fusion permission and Gold")

	var starter: Dictionary = (save.get_value(["inventory", "hero_souls"], []) as Array)[0]
	_expect(
		save.select_hero_soul_instance(input_ids[0], "test:fusion_live:select_input"),
		"one duplicate can be selected to exercise equipped protection"
	)
	_expect(
		not save.fuse_hero_souls(input_ids, 9300100, "test:fusion_live:blocked_equipped"),
		"SaveService rejects a set containing the exact selected Soul instance"
	)
	_expect(
		save.select_hero_soul_instance(String(starter["instance_id"]), "test:fusion_live:restore_starter"),
		"starter selection releases the duplicate without changing inventory"
	)

	var expected := RULES.fuse(inputs, 9300100)
	var expected_cost := int(expected.get("fusion_cost", 0))
	_expect(
		save.fuse_hero_souls(input_ids, 9300100, "test:fusion_live:commit"),
		"three released matching Souls fuse atomically after permission"
	)
	var after: Array = save.get_value(["inventory", "hero_souls"], [])
	var fused := _find_soul(after, String(expected.get("instance_id", "")))
	_expect(after.size() == 2 and not fused.is_empty(), "atomic Fusion consumes exactly three inputs and appends exactly one expected UUID")
	_expect(int(save.get_value(["currencies", "account"], 0)) == 100000 - expected_cost, "atomic Fusion deducts the exact input-aware Gold cost once")
	_expect(
		_affix_signature(fused) == _affix_signature(expected)
			and _all_affixes_live_for_hero(fused, &"sword_hero"),
		"persisted output matches the deterministic pure roll and every affix is live/on-kit"
	)
	var stable_inventory := JSON.stringify(after)
	var stable_gold := int(save.get_value(["currencies", "account"], 0))
	_expect(
		not save.fuse_hero_souls(input_ids, 9300100, "test:fusion_live:commit"),
		"reusing the successful transaction receipt cannot pay twice"
	)
	_expect(
		not save.fuse_hero_souls(input_ids, 9300100, "test:fusion_live:consumed_retry"),
		"a new receipt cannot reuse already-consumed UUIDs"
	)
	_expect(
		JSON.stringify(save.get_value(["inventory", "hero_souls"], [])) == stable_inventory
			and int(save.get_value(["currencies", "account"], 0)) == stable_gold,
		"idempotent retries mutate neither inventory nor Gold"
	)
	_expect(save.reload_save(), "committed live-affix Fusion survives disk reload")
	_expect(
		not _find_soul(
			save.get_value(["inventory", "hero_souls"], []),
			String(expected.get("instance_id", ""))
		).is_empty(),
		"reload preserves exactly the deterministic fused UUID"
	)


func _first_reward_soul(bundle: Resource) -> Dictionary:
	var grants: Array = bundle.get("hero_soul_grants")
	return (grants[0] as Resource).call("create_soul_instance")


func _normal_sword_inputs(seed_base: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for index: int in RULES.FUSION_INPUT_COUNT:
		result.append(RULES.create_instance(
			&"sword_hero",
			RULES.Rarity.NORMAL,
			5 + index,
			&"fusion_live_input",
			seed_base + index,
			RULES.AFFINITY_WARRIOR
		))
	return result


func _find_soul(souls: Array, instance_id: String) -> Dictionary:
	for raw_soul: Variant in souls:
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			return (raw_soul as Dictionary).duplicate(true)
	return {}


func _all_affixes_live_for_hero(soul: Dictionary, hero_id: StringName) -> bool:
	var contract := COMBAT_AFFIXES.prototype_fusion_roll_contract(hero_id)
	var tags: PackedStringArray = contract.get("supported_action_tags", PackedStringArray())
	for raw_affix: Variant in soul.get("affixes", []):
		if not raw_affix is Dictionary:
			return false
		var affix_id := String((raw_affix as Dictionary).get("affix_id", ""))
		if not COMBAT_AFFIXES.is_live_affix(affix_id):
			return false
		var definition: Dictionary = RULES.AFFIX_CATALOG.get(affix_id, {})
		for required_tag: String in definition.get("required_action_tags", []):
			if not tags.has(required_tag):
				return false
	return true


func _affix_signature(owner: Dictionary) -> String:
	var parts: Array[String] = []
	for raw_affix: Variant in owner.get("affixes", []):
		if raw_affix is Dictionary:
			var affix := raw_affix as Dictionary
			parts.append("%s:%.2f" % [
				String(affix.get("affix_id", "")),
				float(affix.get("value", 0.0)),
			])
	return ",".join(parts)


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	if _failures.is_empty():
		print(
			"HERO SOUL FUSION LIVE AFFIX TEST PASSED - %d checks; %d seeded outputs; %d affixes"
			% [_checks, _stress_fusion_count, _stress_affix_count]
		)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("HERO SOUL FUSION LIVE AFFIX TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		print("PASS  ", message)
	else:
		_failures.append(message)
