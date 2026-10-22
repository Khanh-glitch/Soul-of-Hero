class_name ComplexityProgressionRules
extends RefCounted

## Canonical 100-stage disclosure policy for randomly generated loot.
##
## Source rarity remains presentation and reward potential.  The active stage
## selects one immutable profile below, and the resolved payload can never
## exceed that profile's rarity or roll an affix without a LIVE consumer.

const RARITY_RULES := preload("res://game/loot/loot_rarity_rules.gd")
const AUXILIARY_DEFINITIONS := preload(
	"res://game/meta/equipment/auxiliary_equipment_definitions.gd"
)
const HERO_SOUL_COMBAT_AFFIXES := preload(
	"res://game/meta/hero_souls/hero_soul_combat_affixes.gd"
)

const POLICY_ID := &"progressive_loot_v3"
const AVAILABILITY_POLICY_KEY := "complexity_policy"
const FEATURE_HERO_SOUL := "soul_hero"

const REASON_STAGE_ONE := &"stage_one_material_lesson"
const REASON_VESSEL_LESSON := &"soul_vessel_lesson"
const REASON_CORE_EQUIPMENT := &"core_equipment_lesson"
const REASON_EXPANDED_EQUIPMENT := &"expanded_live_equipment"
const REASON_HERO_SOUL_LOCKED := &"hero_soul_lesson_required"
const REASON_FULL_RANDOM_LOOT := &"full_live_random_loot"
const REASON_INVALID_STAGE := &"invalid_stage"
const REASON_INVALID_AVAILABILITY := &"invalid_runtime_availability"

const AUXILIARY_SCOPE_NONE := &"none"
const AUXILIARY_SCOPE_VESSEL_SIMPLE := &"vessel_simple"
const AUXILIARY_SCOPE_CORE_SIMPLE := &"core_simple"
const AUXILIARY_SCOPE_ALL_LIVE := &"all_live"
const HERO_AFFIX_SCOPE_NONE := &"none"
const HERO_AFFIX_SCOPE_CORE := &"simple_core"
const HERO_AFFIX_SCOPE_ALL_LIVE := &"all_live"

const SIMPLE_CORE_HERO_AFFIX_IDS := [
	"max_hp", "core_damage", "max_mana", "normal_attack_power",
]

## The complete ladder lives in this table.  Systems consume profiles rather
## than reproducing stage thresholds in loot, UI, telemetry, or tests.
const TIER_PROFILES := [
	{
		"profile_id": &"tier_0_materials",
		"tier": 0,
		"stage_min": 1,
		"stage_max": 1,
		"rarity_cap": &"normal",
		"base_random_families": ["material"],
		"random_auxiliary_enabled": false,
		"allowed_auxiliary_slots": [],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_NONE,
		"hero_soul_min_stage": 101,
		"hero_affix_scope": HERO_AFFIX_SCOPE_NONE,
		"reason": REASON_STAGE_ONE,
		"hero_locked_reason": REASON_STAGE_ONE,
		"hero_enabled_reason": REASON_STAGE_ONE,
	},
	{
		"profile_id": &"tier_1_vessel",
		"tier": 1,
		"stage_min": 2,
		"stage_max": 3,
		"rarity_cap": &"magic",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_VESSEL_SIMPLE,
		"hero_soul_min_stage": 101,
		"hero_affix_scope": HERO_AFFIX_SCOPE_NONE,
		"reason": REASON_VESSEL_LESSON,
		"hero_locked_reason": REASON_VESSEL_LESSON,
		"hero_enabled_reason": REASON_VESSEL_LESSON,
	},
	{
		"profile_id": &"tier_2_core_build",
		"tier": 2,
		"stage_min": 4,
		"stage_max": 5,
		"rarity_cap": &"rare",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_CORE_SIMPLE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_CORE,
		"reason": REASON_CORE_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
	{
		"profile_id": &"tier_3_live_builds",
		"tier": 3,
		"stage_min": 6,
		"stage_max": 9,
		"rarity_cap": &"epic",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots", "soul_trace"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_ALL_LIVE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_ALL_LIVE,
		"reason": REASON_EXPANDED_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
	{
		"profile_id": &"tier_4_legendary",
		"tier": 4,
		"stage_min": 10,
		"stage_max": 20,
		"rarity_cap": &"legendary",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots", "soul_trace"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_ALL_LIVE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_ALL_LIVE,
		"reason": REASON_EXPANDED_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
	{
		"profile_id": &"tier_5_crystal",
		"tier": 5,
		"stage_min": 21,
		"stage_max": 40,
		"rarity_cap": &"crystal",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots", "soul_trace"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_ALL_LIVE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_ALL_LIVE,
		"reason": REASON_EXPANDED_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
	{
		"profile_id": &"tier_6_mythic",
		"tier": 6,
		"stage_min": 41,
		"stage_max": 70,
		"rarity_cap": &"mythic",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots", "soul_trace"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_ALL_LIVE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_ALL_LIVE,
		"reason": REASON_EXPANDED_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
	{
		"profile_id": &"tier_7_eternal",
		"tier": 7,
		"stage_min": 71,
		"stage_max": 100,
		"rarity_cap": &"eternal",
		"base_random_families": ["material", "equipment", "consumable"],
		"random_auxiliary_enabled": true,
		"allowed_auxiliary_slots": ["soul_vessel", "soul_boots", "soul_trace"],
		"auxiliary_affix_scope": AUXILIARY_SCOPE_ALL_LIVE,
		"hero_soul_min_stage": 5,
		"hero_affix_scope": HERO_AFFIX_SCOPE_ALL_LIVE,
		"reason": REASON_EXPANDED_EQUIPMENT,
		"hero_locked_reason": REASON_HERO_SOUL_LOCKED,
		"hero_enabled_reason": REASON_FULL_RANDOM_LOOT,
	},
]

const _PUBLIC_FIELDS := [
	"policy_id",
	"valid",
	"stage_level",
	"tier_profile_id",
	"complexity_tier",
	"rarity_cap",
	"allowed_random_families",
	"random_auxiliary_enabled",
	"random_hero_soul_enabled",
	"allowed_auxiliary_slots",
	"allowed_auxiliary_affixes",
	"allowed_hero_soul_affixes",
	"reason",
]


static func policy_for_stage(stage_level: int, feature_state: Dictionary = {}) -> Dictionary:
	if stage_level < 1 or stage_level > 100:
		var invalid := _build_policy(1, {}, false, REASON_INVALID_STAGE)
		invalid["requested_stage_level"] = stage_level
		return invalid
	return _build_policy(stage_level, feature_state, true)


static func availability_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> Dictionary:
	return policy_for_stage(stage_level, feature_state)


static func tier_profile_for_stage(stage_level: int) -> Dictionary:
	if stage_level < 1 or stage_level > 100:
		return {}
	for raw_profile: Variant in TIER_PROFILES:
		var profile := raw_profile as Dictionary
		if stage_level >= int(profile["stage_min"]) \
				and stage_level <= int(profile["stage_max"]):
			return profile.duplicate(true)
	return {}


static func complexity_tier_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> int:
	return int(policy_for_stage(stage_level, feature_state).get("complexity_tier", 0))


static func rarity_cap_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> StringName:
	return StringName(policy_for_stage(stage_level, feature_state).get("rarity_cap", &"normal"))


static func allowed_slots_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> PackedStringArray:
	var policy := policy_for_stage(stage_level, feature_state)
	return PackedStringArray(policy.get("allowed_auxiliary_slots", PackedStringArray()))


static func allowed_affixes_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> Dictionary:
	var policy := policy_for_stage(stage_level, feature_state)
	return (policy.get("allowed_auxiliary_affixes", {}) as Dictionary).duplicate(true)


static func allowed_hero_soul_affixes_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> PackedStringArray:
	var policy := policy_for_stage(stage_level, feature_state)
	return PackedStringArray(policy.get("allowed_hero_soul_affixes", PackedStringArray()))


static func disclosure_reason_for_stage(
		stage_level: int,
		feature_state: Dictionary = {}
) -> StringName:
	return StringName(policy_for_stage(stage_level, feature_state).get("reason", REASON_INVALID_STAGE))


static func get_tier_profile_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if TIER_PROFILES.size() != RARITY_RULES.IDS.size():
		errors.append("The loot ladder requires one profile per rarity tier.")
	var expected_stage_min := 1
	var previous_rarity_index := -1
	var seen_ids := {}
	for profile_index: int in TIER_PROFILES.size():
		var profile: Dictionary = TIER_PROFILES[profile_index]
		var profile_id := String(profile.get("profile_id", ""))
		var stage_min := int(profile.get("stage_min", 0))
		var stage_max := int(profile.get("stage_max", 0))
		var rarity_index := RARITY_RULES.rarity_index(profile.get("rarity_cap", &"normal"))
		if profile_id.is_empty() or seen_ids.has(profile_id):
			errors.append("Loot tier profile IDs must be unique and non-empty.")
		seen_ids[profile_id] = true
		if int(profile.get("tier", -1)) != profile_index:
			errors.append("Loot tier profile '%s' has a non-canonical tier." % profile_id)
		if stage_min != expected_stage_min or stage_max < stage_min:
			errors.append("Loot tier profile '%s' leaves a stage gap or overlap." % profile_id)
		expected_stage_min = stage_max + 1
		if rarity_index != profile_index or rarity_index < previous_rarity_index:
			errors.append("Loot tier profile '%s' has a non-monotonic rarity cap." % profile_id)
		previous_rarity_index = rarity_index
		for slot_id: String in profile.get("allowed_auxiliary_slots", []):
			if not AUXILIARY_DEFINITIONS.is_valid_slot(slot_id):
				errors.append("Loot tier profile '%s' contains unknown slot '%s'." % [profile_id, slot_id])
		var hero_scope := StringName(profile.get("hero_affix_scope", HERO_AFFIX_SCOPE_NONE))
		for affix_id: String in _hero_affixes_for_scope(hero_scope):
			if not HERO_SOUL_COMBAT_AFFIXES.is_live_affix(affix_id):
				errors.append("Loot tier profile '%s' contains non-LIVE Hero affix '%s'." % [profile_id, affix_id])
	if expected_stage_min != 101:
		errors.append("Loot tier profiles must cover stages 1 through 100 exactly once.")
	return errors


static func has_policy_request(availability: Dictionary) -> bool:
	return availability.has(AVAILABILITY_POLICY_KEY)


## Empty means legacy unrestricted behavior.  Once a caller opts into the
## policy envelope, every canonical field is tamper-checked and malformed data
## becomes tier-zero Normal materials.
static func resolve_availability(availability: Dictionary) -> Dictionary:
	if not has_policy_request(availability):
		return {}
	var raw_value: Variant = availability.get(AVAILABILITY_POLICY_KEY, null)
	if not raw_value is Dictionary:
		return fail_closed_policy()
	var raw: Dictionary = raw_value
	var stage_value: Variant = availability.get(
		"active_stage_level",
		raw.get("stage_level", null),
	)
	var feature_value: Variant = availability.get(
		"feature_state",
		raw.get("feature_state", null),
	)
	if not stage_value is int or not feature_value is Dictionary:
		return fail_closed_policy()
	var expected := policy_for_stage(int(stage_value), feature_value as Dictionary)
	if not bool(expected.get("valid", false)) or not _metadata_matches(raw, expected):
		return fail_closed_policy()
	return expected


static func fail_closed_policy() -> Dictionary:
	return _build_policy(1, {}, false, REASON_INVALID_AVAILABILITY)


static func metadata_for_payload(policy: Dictionary) -> Dictionary:
	if policy.is_empty():
		return {}
	var result := {}
	for field_name: String in _PUBLIC_FIELDS:
		if policy.has(field_name):
			var value: Variant = policy[field_name]
			result[field_name] = value.duplicate(true) if value is Dictionary else value
	return result


static func cap_rarity(rarity_value: Variant, policy: Dictionary) -> StringName:
	var rarity := RARITY_RULES.normalize(rarity_value)
	var cap := RARITY_RULES.normalize(policy.get("rarity_cap", &"normal"))
	if RARITY_RULES.rarity_index(rarity) > RARITY_RULES.rarity_index(cap):
		return cap
	return rarity


static func allows_random_family(policy: Dictionary, family_id: StringName) -> bool:
	var families: Variant = policy.get("allowed_random_families", PackedStringArray())
	return (families is PackedStringArray or families is Array) \
		and String(family_id) in families


static func _build_policy(
		stage_level: int,
		feature_state: Dictionary,
		valid: bool,
		reason_override: StringName = &""
) -> Dictionary:
	var profile := tier_profile_for_stage(stage_level)
	if profile.is_empty():
		profile = (TIER_PROFILES[0] as Dictionary).duplicate(true)
		valid = false
	var features := {
		FEATURE_HERO_SOUL: _bool_feature(feature_state, FEATURE_HERO_SOUL),
	}
	# Rarity tiers span several stage levels (Epic is 6-9), while equipment
	# onboarding has exact level gates. Filter the canonical slot order through
	# each definition's unlock level so stage 6 cannot roll the level-7 Jewelry
	# slot and future gate tuning does not require another parallel table.
	var allowed_slots := PackedStringArray()
	for slot_id: String in profile.get("allowed_auxiliary_slots", []):
		if AUXILIARY_DEFINITIONS.unlock_level(slot_id) <= stage_level:
			allowed_slots.append(slot_id)
	var allowed_affixes := _auxiliary_affixes_for_scope(
		StringName(profile.get("auxiliary_affix_scope", AUXILIARY_SCOPE_NONE)),
		allowed_slots,
	)
	var allowed_hero_affixes := _hero_affixes_for_scope(
		StringName(profile.get("hero_affix_scope", HERO_AFFIX_SCOPE_NONE))
	)
	var hero_gate_reached := stage_level >= int(profile.get("hero_soul_min_stage", 101))
	var hero_soul_enabled := hero_gate_reached and bool(features[FEATURE_HERO_SOUL])
	var families := PackedStringArray(profile.get("base_random_families", ["material"]))
	if hero_soul_enabled:
		families.append("hero_soul")
	var reason := StringName(profile.get("reason", REASON_INVALID_STAGE))
	if hero_gate_reached:
		reason = StringName(profile.get(
			"hero_enabled_reason" if hero_soul_enabled else "hero_locked_reason",
			reason,
		))
	if not reason_override.is_empty():
		reason = reason_override
	return {
		"policy_id": POLICY_ID,
		"valid": valid,
		"stage_level": stage_level,
		"tier_profile_id": StringName(profile.get("profile_id", &"tier_0_materials")),
		"complexity_tier": int(profile.get("tier", 0)),
		"rarity_cap": RARITY_RULES.normalize(profile.get("rarity_cap", &"normal")),
		"allowed_random_families": families,
		"random_auxiliary_enabled": bool(profile.get("random_auxiliary_enabled", false)),
		"random_hero_soul_enabled": hero_soul_enabled,
		"allowed_auxiliary_slots": allowed_slots,
		"allowed_auxiliary_affixes": allowed_affixes,
		"allowed_hero_soul_affixes": allowed_hero_affixes,
		"reason": reason,
		"feature_state": features,
	}


static func _metadata_matches(raw: Dictionary, expected: Dictionary) -> bool:
	for field_name: String in _PUBLIC_FIELDS:
		if not raw.has(field_name) or raw[field_name] != expected[field_name]:
			return false
	return raw.get("feature_state", null) == expected.get("feature_state", null)


static func _auxiliary_affixes_for_scope(
		scope: StringName,
		allowed_slots: PackedStringArray
) -> Dictionary:
	var result := {}
	for slot_id: String in allowed_slots:
		match scope:
			AUXILIARY_SCOPE_VESSEL_SIMPLE, AUXILIARY_SCOPE_CORE_SIMPLE:
				result[slot_id] = AUXILIARY_DEFINITIONS.simple_live_affix_ids(slot_id)
			AUXILIARY_SCOPE_ALL_LIVE:
				result[slot_id] = AUXILIARY_DEFINITIONS.live_affix_ids(slot_id)
			_:
				return {}
	return result


static func _hero_affixes_for_scope(scope: StringName) -> PackedStringArray:
	var requested := PackedStringArray()
	match scope:
		HERO_AFFIX_SCOPE_CORE:
			requested = PackedStringArray(SIMPLE_CORE_HERO_AFFIX_IDS)
		HERO_AFFIX_SCOPE_ALL_LIVE:
			requested = PackedStringArray(HERO_SOUL_COMBAT_AFFIXES.LIVE_AFFIX_IDS)
		_:
			return requested
	var result := PackedStringArray()
	for affix_id: String in requested:
		if HERO_SOUL_COMBAT_AFFIXES.is_live_affix(affix_id):
			result.append(affix_id)
	return result


static func _bool_feature(feature_state: Dictionary, feature_id: String) -> bool:
	var value: Variant = feature_state.get(feature_id, false)
	return value is bool and bool(value)
