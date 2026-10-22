class_name MonsterSoulDefinitions
extends RefCounted

## V0.4 Monster Soul data contract.
##
## This catalog is intentionally pure data. It does not unlock UI, grant loot,
## mutate combat actors, or persist anything. Those runtime layers may consume
## this contract only after the Level 50/Chapter 5 gate is satisfied.

const SYSTEM_UNLOCK_LEVEL := 50
const MIN_RANK := 1
const MAX_RANK := 3
const ESSENCE_PER_RANK := 3
const MAX_MECHANICAL_REWRITES := 3
const MAX_SOCKETS_PER_HERO_SOUL := 1

const REAPER_DEFINITION_ID := "reaper_monster_soul"
const REAPER_FAMILY_ID := "reaper"
const FIRST_GUARANTEED_DEFINITION_ID := REAPER_DEFINITION_ID
const SOUL_SEVERANCE_ITEM_ID := "soul_severance"

const MODIFIER_FIELDS := [
	"normal_active_modifier",
	"summon_modifier",
	"departure_modifier",
]
const MODULE_IDS := ["normal_active", "summon", "departure"]
const CHANGE_KINDS := ["mechanical_rewrite", "numeric_only", "cosmetic_only"]

## Reaper is the only authored family in this data-interface milestone.
## All rank arrays are Rank 1, Rank 2, Rank 3. Rank never changes mechanic IDs.
const DEFINITIONS := {
	REAPER_DEFINITION_ID: {
		"id": REAPER_DEFINITION_ID,
		"display_name": "Reaper Monster Soul",
		"family": REAPER_FAMILY_ID,
		"unlock_level": SYSTEM_UNLOCK_LEVEL,
		"source_enemy_ids": ["reaper_sovereign"],
		"guaranteed_first_reward": true,
		"paid_only": false,
		"stat_package": {
			"damage_percent": [6.0, 9.0, 12.0],
			"max_mana_percent": [4.0, 6.0, 8.0],
			"cooldown_recovery_percent": [3.0, 4.5, 6.0],
		},
		## `compatible_tags`/`forbidden_tags` preserve the FULL-spec names;
		## the explicit action-tag aliases make the matching semantics unambiguous.
		"compatible_tags": ["active", "summon", "departure", "relay"],
		"required_action_tags": ["active", "summon", "departure", "relay"],
		"forbidden_tags": ["no_projectile_mutation"],
		"forbidden_action_tags": ["no_projectile_mutation"],
		"normal_active_modifier": {
			"module_id": "normal_active",
			"change_kind": "mechanical_rewrite",
			"mechanic_id": "spectral_returning_arc",
			"numeric_by_rank": {
				"outbound_damage_multiplier": [1.08, 1.12, 1.16],
				"return_damage_multiplier": [0.55, 0.70, 0.85],
				"spectral_mark_seconds": [2.0, 2.5, 3.0],
			},
		},
		"summon_modifier": {
			"module_id": "summon",
			"change_kind": "mechanical_rewrite",
			"mechanic_id": "orbiting_reaper_echo",
			"numeric_by_rank": {
				"echo_damage_multiplier": [0.60, 0.75, 0.90],
				"orbit_seconds": [3.0, 3.5, 4.0],
				"maximum_hits": [2.0, 3.0, 4.0],
			},
		},
		"departure_modifier": {
			"module_id": "departure",
			"change_kind": "mechanical_rewrite",
			"mechanic_id": "spectral_harvest_return",
			"numeric_by_rank": {
				"return_wave_damage_multiplier": [0.70, 0.85, 1.00],
				"return_wave_width_multiplier": [1.00, 1.12, 1.25],
				"marked_target_bonus_percent": [8.0, 12.0, 16.0],
			},
		},
		"vfx_audio_theme": {
			"vfx_theme_id": "reaper_spectral_vfx",
			"audio_theme_id": "reaper_spectral_audio",
		},
		"max_rank": MAX_RANK,
	},
}


static func has_definition(definition_id: String) -> bool:
	return DEFINITIONS.has(definition_id)


static func get_definition(definition_id: String) -> Dictionary:
	if not has_definition(definition_id):
		return {}
	return (DEFINITIONS[definition_id] as Dictionary).duplicate(true)


static func get_family(definition_id: String) -> String:
	if not has_definition(definition_id):
		return ""
	return String((DEFINITIONS[definition_id] as Dictionary).get("family", ""))


static func mechanical_rewrite_count(definition: Dictionary) -> int:
	var count := 0
	for field_name: String in MODIFIER_FIELDS:
		var modifier_value: Variant = definition.get(field_name, {})
		if modifier_value is Dictionary \
				and String((modifier_value as Dictionary).get("change_kind", "")) == "mechanical_rewrite":
			count += 1
	return count


static func get_catalog_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if not DEFINITIONS.has(REAPER_DEFINITION_ID):
		errors.append("V0.4 Monster Soul catalog requires the first authored Reaper profile.")
	if not DEFINITIONS.has(FIRST_GUARANTEED_DEFINITION_ID):
		errors.append("The guaranteed first Monster Soul definition must exist in the catalog.")
	for raw_definition_id: Variant in DEFINITIONS.keys():
		var definition_id := String(raw_definition_id)
		if not _is_valid_id(definition_id):
			errors.append("Monster Soul definition ID '%s' is invalid." % definition_id)
			continue
		var definition_value: Variant = DEFINITIONS[raw_definition_id]
		if not definition_value is Dictionary:
			errors.append("Monster Soul definition '%s' must be a Dictionary." % definition_id)
			continue
		_validate_definition(errors, definition_id, definition_value as Dictionary)
	if DEFINITIONS.has(FIRST_GUARANTEED_DEFINITION_ID):
		var first_definition: Dictionary = DEFINITIONS[FIRST_GUARANTEED_DEFINITION_ID]
		if not bool(first_definition.get("guaranteed_first_reward", false)):
			errors.append("The first Monster Soul definition must be a guaranteed reward.")
	return errors


static func _validate_definition(
		errors: PackedStringArray,
		definition_id: String,
		definition: Dictionary
) -> void:
	if String(definition.get("id", "")) != definition_id:
		errors.append("Monster Soul definition '%s' must repeat its canonical ID." % definition_id)
	if String(definition.get("display_name", "")).strip_edges().is_empty():
		errors.append("Monster Soul definition '%s' requires a display name." % definition_id)
	var family := String(definition.get("family", ""))
	if not _is_valid_id(family):
		errors.append("Monster Soul definition '%s' has an invalid family." % definition_id)
	if int(definition.get("unlock_level", 0)) < SYSTEM_UNLOCK_LEVEL:
		errors.append("Monster Soul definition '%s' cannot unlock before Level %d." % [definition_id, SYSTEM_UNLOCK_LEVEL])
	if int(definition.get("max_rank", 0)) != MAX_RANK:
		errors.append("Monster Soul definition '%s' must cap at Rank %d." % [definition_id, MAX_RANK])
	if bool(definition.get("paid_only", true)):
		errors.append("Monster Soul definition '%s' cannot be paid-only." % definition_id)

	var source_ids: Variant = definition.get("source_enemy_ids", null)
	if not source_ids is Array or (source_ids as Array).is_empty():
		errors.append("Monster Soul definition '%s' requires at least one gameplay source enemy." % definition_id)
	else:
		_validate_id_array(errors, definition_id, "source_enemy_ids", source_ids as Array)

	_validate_rank_package(errors, definition_id, "stat_package", definition.get("stat_package", null))
	_validate_action_tags(errors, definition_id, definition)

	var seen_modules := {}
	for field_name: String in MODIFIER_FIELDS:
		var modifier_value: Variant = definition.get(field_name, null)
		if not modifier_value is Dictionary:
			errors.append("Monster Soul definition '%s' requires %s." % [definition_id, field_name])
			continue
		_validate_modifier(errors, definition_id, field_name, modifier_value as Dictionary, seen_modules)
	var rewrite_count := mechanical_rewrite_count(definition)
	if rewrite_count > MAX_MECHANICAL_REWRITES:
		errors.append("Monster Soul definition '%s' exceeds the %d-module mechanical rewrite cap." % [definition_id, MAX_MECHANICAL_REWRITES])

	var theme_value: Variant = definition.get("vfx_audio_theme", null)
	if not theme_value is Dictionary:
		errors.append("Monster Soul definition '%s' requires VFX/audio theme IDs." % definition_id)
	else:
		var theme: Dictionary = theme_value
		for field_name: String in ["vfx_theme_id", "audio_theme_id"]:
			if not _is_valid_id(String(theme.get(field_name, ""))):
				errors.append("Monster Soul definition '%s' has invalid %s." % [definition_id, field_name])


static func _validate_action_tags(
		errors: PackedStringArray,
		definition_id: String,
		definition: Dictionary
) -> void:
	var compatible_value: Variant = definition.get("compatible_tags", null)
	var required_value: Variant = definition.get("required_action_tags", null)
	var forbidden_value: Variant = definition.get("forbidden_tags", null)
	var forbidden_action_value: Variant = definition.get("forbidden_action_tags", null)
	if not compatible_value is Array or not required_value is Array:
		errors.append("Monster Soul definition '%s' requires compatible/required action tags." % definition_id)
		return
	if not forbidden_value is Array or not forbidden_action_value is Array:
		errors.append("Monster Soul definition '%s' requires forbidden action tags." % definition_id)
		return
	var compatible: Array = compatible_value
	var required: Array = required_value
	var forbidden: Array = forbidden_value
	var forbidden_action: Array = forbidden_action_value
	_validate_id_array(errors, definition_id, "required_action_tags", required)
	_validate_id_array(errors, definition_id, "forbidden_action_tags", forbidden_action)
	if compatible != required:
		errors.append("Monster Soul definition '%s' compatible_tags must mirror required_action_tags." % definition_id)
	if forbidden != forbidden_action:
		errors.append("Monster Soul definition '%s' forbidden_tags must mirror forbidden_action_tags." % definition_id)
	for raw_tag: Variant in required:
		if forbidden_action.has(raw_tag):
			errors.append("Monster Soul definition '%s' cannot require and forbid action tag '%s'." % [definition_id, raw_tag])


static func _validate_modifier(
		errors: PackedStringArray,
		definition_id: String,
		field_name: String,
		modifier: Dictionary,
		seen_modules: Dictionary
) -> void:
	var module_id := String(modifier.get("module_id", ""))
	if module_id not in MODULE_IDS:
		errors.append("Monster Soul definition '%s' has invalid module '%s'." % [definition_id, module_id])
	elif seen_modules.has(module_id):
		errors.append("Monster Soul definition '%s' duplicates module '%s'." % [definition_id, module_id])
	else:
		seen_modules[module_id] = true
	var expected_module := String(MODULE_IDS[MODIFIER_FIELDS.find(field_name)])
	if module_id != expected_module:
		errors.append("Monster Soul definition '%s' %s must target module '%s'." % [definition_id, field_name, expected_module])
	var change_kind := String(modifier.get("change_kind", ""))
	if change_kind not in CHANGE_KINDS:
		errors.append("Monster Soul definition '%s' module '%s' has invalid change kind." % [definition_id, module_id])
	if change_kind == "mechanical_rewrite" and not _is_valid_id(String(modifier.get("mechanic_id", ""))):
		errors.append("Monster Soul definition '%s' rewritten module '%s' requires a mechanic ID." % [definition_id, module_id])
	_validate_rank_package(errors, definition_id, "%s.numeric_by_rank" % field_name, modifier.get("numeric_by_rank", null))


static func _validate_rank_package(
		errors: PackedStringArray,
		definition_id: String,
		field_name: String,
		package_value: Variant
) -> void:
	if not package_value is Dictionary or (package_value as Dictionary).is_empty():
		errors.append("Monster Soul definition '%s' requires non-empty %s." % [definition_id, field_name])
		return
	var package: Dictionary = package_value
	for raw_stat_id: Variant in package.keys():
		var stat_id := String(raw_stat_id)
		if not _is_valid_id(stat_id):
			errors.append("Monster Soul definition '%s' has invalid numeric field '%s'." % [definition_id, stat_id])
			continue
		var values_value: Variant = package[raw_stat_id]
		if not values_value is Array or (values_value as Array).size() != MAX_RANK:
			errors.append("Monster Soul definition '%s' %s.%s requires exactly %d rank values." % [definition_id, field_name, stat_id, MAX_RANK])
			continue
		for raw_value: Variant in values_value as Array:
			if (not raw_value is int and not raw_value is float) \
					or not is_finite(float(raw_value)) or float(raw_value) <= 0.0:
				errors.append("Monster Soul definition '%s' %s.%s rank values must be positive and finite." % [definition_id, field_name, stat_id])
				break


static func _validate_id_array(
		errors: PackedStringArray,
		definition_id: String,
		field_name: String,
		values: Array
) -> void:
	var seen := {}
	for raw_value: Variant in values:
		var value := String(raw_value)
		if not _is_valid_id(value) or seen.has(value):
			errors.append("Monster Soul definition '%s' has invalid or duplicate %s entry '%s'." % [definition_id, field_name, value])
		seen[value] = true


static func _is_valid_id(value: String) -> bool:
	if value.is_empty():
		return false
	var previous_underscore := false
	for index: int in value.length():
		var code := value.unicode_at(index)
		var is_letter := code >= 97 and code <= 122
		var is_digit := code >= 48 and code <= 57
		if index == 0 and not is_letter:
			return false
		if not is_letter and not is_digit and code != 95:
			return false
		if code == 95:
			if previous_underscore:
				return false
			previous_underscore = true
		else:
			previous_underscore = false
	return not previous_underscore
