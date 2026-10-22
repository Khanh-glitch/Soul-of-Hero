class_name MonsterSoulRules
extends RefCounted

## Pure V0.4 Monster Soul access, compatibility, rank, bonding and severance
## rules. No method in this file writes saves or mutates runtime combat actors.

const DEFINITIONS := preload("res://game/meta/monster_souls/monster_soul_definitions.gd")

const ACCESS_HIDDEN := "hidden"
const ACCESS_LOCKED := "locked"
const ACCESS_AVAILABLE := "available"
const ESSENCE_FROM_DUPLICATE := 1

const REQUIRED_INSTANCE_FIELDS := [
	"uuid",
	"definition_id",
	"rank",
	"essence_count",
	"bonded_hero_soul_uuid",
]


static func system_access_state(player_level: int, chapter_5_boss_cleared: bool) -> String:
	if player_level < DEFINITIONS.SYSTEM_UNLOCK_LEVEL:
		return ACCESS_HIDDEN
	if not chapter_5_boss_cleared:
		return ACCESS_LOCKED
	return ACCESS_AVAILABLE


static func is_system_visible(player_level: int) -> bool:
	return player_level >= DEFINITIONS.SYSTEM_UNLOCK_LEVEL


static func is_system_available(player_level: int, chapter_5_boss_cleared: bool) -> bool:
	return system_access_state(player_level, chapter_5_boss_cleared) == ACCESS_AVAILABLE


static func create_instance(
		definition_id: StringName,
		seed: int,
		generation_namespace: StringName = &"drop"
) -> Dictionary:
	var normalized_definition_id := String(definition_id).strip_edges().to_lower()
	var normalized_namespace := String(generation_namespace).strip_edges().to_lower()
	if not DEFINITIONS.get_catalog_errors().is_empty() \
			or not DEFINITIONS.has_definition(normalized_definition_id) \
			or not _is_valid_id(normalized_namespace):
		return {}
	var stable_key := "monster_soul:%s:%s:%d" % [
		normalized_definition_id,
		normalized_namespace,
		seed,
	]
	return {
		"uuid": _deterministic_uuid(stable_key),
		"definition_id": normalized_definition_id,
		"rank": DEFINITIONS.MIN_RANK,
		"essence_count": 0,
		"bonded_hero_soul_uuid": "",
	}


static func create_guaranteed_first_instance(
		player_level: int,
		chapter_5_boss_cleared: bool,
		seed: int
) -> Dictionary:
	if not is_system_available(player_level, chapter_5_boss_cleared):
		return {}
	return create_instance(
		StringName(DEFINITIONS.FIRST_GUARANTEED_DEFINITION_ID),
		seed,
		&"chapter_5_guaranteed"
	)


static func validate_instance(instance: Dictionary) -> PackedStringArray:
	var errors := PackedStringArray()
	for field_name: String in REQUIRED_INSTANCE_FIELDS:
		if not instance.has(field_name):
			errors.append("Monster Soul instance is missing required field '%s'." % field_name)
	var uuid_value: Variant = instance.get("uuid", null)
	if not uuid_value is String or not _is_valid_uuid(String(uuid_value)):
		errors.append("Monster Soul uuid is invalid.")
	var definition_value: Variant = instance.get("definition_id", null)
	var definition_id := String(definition_value) if definition_value is String or definition_value is StringName else ""
	if not DEFINITIONS.has_definition(definition_id):
		errors.append("Monster Soul definition_id is invalid.")
	var rank_value: Variant = instance.get("rank", null)
	if not rank_value is int or int(rank_value) < DEFINITIONS.MIN_RANK \
			or int(rank_value) > DEFINITIONS.MAX_RANK:
		errors.append("Monster Soul rank must be an integer from %d to %d." % [DEFINITIONS.MIN_RANK, DEFINITIONS.MAX_RANK])
	var essence_value: Variant = instance.get("essence_count", null)
	if not essence_value is int or int(essence_value) < 0:
		errors.append("Monster Soul essence_count must be a non-negative integer.")
	var bonded_value: Variant = instance.get("bonded_hero_soul_uuid", null)
	if not bonded_value is String:
		errors.append("Monster Soul bonded_hero_soul_uuid must be a String.")
	return errors


static func resolved_profile(definition_id: String, rank: int) -> Dictionary:
	if not DEFINITIONS.has_definition(definition_id) \
			or rank < DEFINITIONS.MIN_RANK or rank > DEFINITIONS.MAX_RANK:
		return {}
	var profile := DEFINITIONS.get_definition(definition_id)
	profile["rank"] = rank
	profile["stat_package"] = _resolve_rank_package(profile["stat_package"], rank)
	for field_name: String in DEFINITIONS.MODIFIER_FIELDS:
		var modifier: Dictionary = profile[field_name]
		modifier["numeric_values"] = _resolve_rank_package(modifier["numeric_by_rank"], rank)
		modifier.erase("numeric_by_rank")
		profile[field_name] = modifier
	return profile


static func compatibility_errors(
		definition_id: String,
		supported_action_tags: PackedStringArray
) -> PackedStringArray:
	var errors := PackedStringArray()
	if not DEFINITIONS.has_definition(definition_id):
		errors.append("Unknown Monster Soul definition '%s'." % definition_id)
		return errors
	var tag_set := {}
	for raw_tag: String in supported_action_tags:
		var tag := raw_tag.strip_edges().to_lower()
		if not _is_valid_id(tag):
			errors.append("Hero action tag '%s' is invalid." % raw_tag)
			continue
		tag_set[tag] = true
	var definition := DEFINITIONS.get_definition(definition_id)
	for raw_required: Variant in definition.get("required_action_tags", []):
		var required_tag := String(raw_required)
		if not tag_set.has(required_tag):
			errors.append("Hero Soul does not support required action tag '%s'." % required_tag)
	for raw_forbidden: Variant in definition.get("forbidden_action_tags", []):
		var forbidden_tag := String(raw_forbidden)
		if tag_set.has(forbidden_tag):
			errors.append("Hero Soul contains forbidden action tag '%s'." % forbidden_tag)
	return errors


static func convert_duplicate_to_essence(duplicate: Dictionary) -> Dictionary:
	if not validate_instance(duplicate).is_empty() \
			or not String(duplicate.get("bonded_hero_soul_uuid", "")).is_empty():
		return {}
	var definition_id := String(duplicate["definition_id"])
	return {
		"family": DEFINITIONS.get_family(definition_id),
		"essence_amount": ESSENCE_FROM_DUPLICATE,
		"destroyed_monster_soul_uuid": String(duplicate["uuid"]),
	}


static func add_family_essence(
		instance: Dictionary,
		family: StringName,
		amount: int
) -> Dictionary:
	if not validate_instance(instance).is_empty() or amount <= 0:
		return {}
	if int(instance["rank"]) >= DEFINITIONS.MAX_RANK:
		return {}
	var definition_family := DEFINITIONS.get_family(String(instance["definition_id"]))
	if String(family) != definition_family:
		return {}
	var updated := instance.duplicate(true)
	updated["essence_count"] = int(updated["essence_count"]) + amount
	return updated


static func rank_up_errors(instance: Dictionary) -> PackedStringArray:
	var errors := validate_instance(instance)
	if not errors.is_empty():
		return errors
	if int(instance["rank"]) >= DEFINITIONS.MAX_RANK:
		errors.append("Monster Soul is already at maximum Rank %d." % DEFINITIONS.MAX_RANK)
	if int(instance["essence_count"]) < DEFINITIONS.ESSENCE_PER_RANK:
		errors.append("Monster Soul rank-up requires %d family Essence." % DEFINITIONS.ESSENCE_PER_RANK)
	return errors


static func rank_up(instance: Dictionary) -> Dictionary:
	var errors := rank_up_errors(instance)
	if not errors.is_empty():
		return {"ok": false, "errors": errors}
	var updated := instance.duplicate(true)
	updated["rank"] = int(updated["rank"]) + 1
	updated["essence_count"] = int(updated["essence_count"]) - DEFINITIONS.ESSENCE_PER_RANK
	return {
		"ok": true,
		"monster_soul": updated,
		"essence_spent": DEFINITIONS.ESSENCE_PER_RANK,
		"failure_chance": 0.0,
	}


static func bonding_errors(
		hero_soul: Dictionary,
		monster_soul: Dictionary,
		player_level: int,
		chapter_5_boss_cleared: bool,
		supported_action_tags: PackedStringArray,
		is_in_combat: bool
) -> PackedStringArray:
	var errors := PackedStringArray()
	var access_state := system_access_state(player_level, chapter_5_boss_cleared)
	if access_state == ACCESS_HIDDEN:
		errors.append("Monster Soul socket is hidden before player Level %d." % DEFINITIONS.SYSTEM_UNLOCK_LEVEL)
	elif access_state == ACCESS_LOCKED:
		errors.append("Monster Soul system requires the Chapter 5 boss clear.")
	if is_in_combat:
		errors.append("Monster Soul cannot be bonded during combat.")
	var hero_uuid := _hero_soul_uuid(hero_soul)
	if hero_uuid.is_empty():
		errors.append("Hero Soul requires a uuid or instance_id before bonding.")
	if _hero_socket_aliases_conflict(hero_soul):
		errors.append("Hero Soul Monster Soul socket aliases disagree.")
	if not _installed_monster_soul_uuid(hero_soul).is_empty():
		errors.append("Hero Soul already has its one Monster Soul socket occupied.")
	for instance_error: String in validate_instance(monster_soul):
		errors.append(instance_error)
	if not String(monster_soul.get("bonded_hero_soul_uuid", "")).is_empty():
		errors.append("Monster Soul is already bonded to a Hero Soul.")
	var definition_id := String(monster_soul.get("definition_id", ""))
	for compatibility_error: String in compatibility_errors(definition_id, supported_action_tags):
		errors.append(compatibility_error)
	return errors


static func bond(
		hero_soul: Dictionary,
		monster_soul: Dictionary,
		player_level: int,
		chapter_5_boss_cleared: bool,
		supported_action_tags: PackedStringArray,
		is_in_combat: bool = false
) -> Dictionary:
	var errors := bonding_errors(
		hero_soul,
		monster_soul,
		player_level,
		chapter_5_boss_cleared,
		supported_action_tags,
		is_in_combat
	)
	if not errors.is_empty():
		return {"ok": false, "errors": errors}
	var hero_uuid := _hero_soul_uuid(hero_soul)
	var monster_uuid := String(monster_soul["uuid"])
	var bonded_hero := hero_soul.duplicate(true)
	## Current prototype callers use monster_soul_id; the FULL schema names the
	## same UUID monster_soul_instance_id. Set both during the migration window.
	bonded_hero["monster_soul_id"] = monster_uuid
	bonded_hero["monster_soul_instance_id"] = monster_uuid
	bonded_hero["locked"] = true
	var bonded_monster := monster_soul.duplicate(true)
	bonded_monster["bonded_hero_soul_uuid"] = hero_uuid
	return {
		"ok": true,
		"hero_soul": bonded_hero,
		"monster_soul": bonded_monster,
		"auto_locked_hero_soul": true,
	}


static func severance_errors(
		hero_soul: Dictionary,
		monster_soul: Dictionary,
		soul_severance_count: int
) -> PackedStringArray:
	var errors := PackedStringArray()
	if soul_severance_count < 1:
		errors.append("Soul Severance item is required.")
	for instance_error: String in validate_instance(monster_soul):
		errors.append(instance_error)
	var hero_uuid := _hero_soul_uuid(hero_soul)
	if hero_uuid.is_empty():
		errors.append("Hero Soul requires a uuid or instance_id for severance.")
	if _hero_socket_aliases_conflict(hero_soul):
		errors.append("Hero Soul Monster Soul socket aliases disagree.")
	var monster_uuid := String(monster_soul.get("uuid", ""))
	if _installed_monster_soul_uuid(hero_soul) != monster_uuid:
		errors.append("Hero Soul does not contain the selected Monster Soul.")
	if String(monster_soul.get("bonded_hero_soul_uuid", "")) != hero_uuid:
		errors.append("Monster Soul bond does not match the selected Hero Soul.")
	return errors


static func sever(
		hero_soul: Dictionary,
		monster_soul: Dictionary,
		soul_severance_count: int
) -> Dictionary:
	var errors := severance_errors(hero_soul, monster_soul, soul_severance_count)
	if not errors.is_empty():
		return {"ok": false, "errors": errors}
	var returned_hero := hero_soul.duplicate(true)
	returned_hero["monster_soul_id"] = ""
	returned_hero["monster_soul_instance_id"] = ""
	## Keep the safety lock. The player may explicitly unlock the returned Hero
	## Soul later; severance itself must never make a formerly protected item sellable.
	returned_hero["locked"] = true
	return {
		"ok": true,
		"hero_soul": returned_hero,
		"destroyed_monster_soul_uuid": String(monster_soul["uuid"]),
		"monster_soul_destroyed": true,
		"remaining_soul_severance": soul_severance_count - 1,
	}


static func _resolve_rank_package(package_value: Variant, rank: int) -> Dictionary:
	var result := {}
	if not package_value is Dictionary:
		return result
	for raw_field_name: Variant in (package_value as Dictionary).keys():
		var values_value: Variant = (package_value as Dictionary)[raw_field_name]
		if values_value is Array and (values_value as Array).size() >= rank:
			result[String(raw_field_name)] = (values_value as Array)[rank - 1]
	return result


static func _hero_soul_uuid(hero_soul: Dictionary) -> String:
	var uuid := String(hero_soul.get("uuid", "")).strip_edges()
	if not uuid.is_empty():
		return uuid
	return String(hero_soul.get("instance_id", "")).strip_edges()


static func _installed_monster_soul_uuid(hero_soul: Dictionary) -> String:
	var full_schema_id := String(hero_soul.get("monster_soul_instance_id", "")).strip_edges()
	if not full_schema_id.is_empty():
		return full_schema_id
	return String(hero_soul.get("monster_soul_id", "")).strip_edges()


static func _hero_socket_aliases_conflict(hero_soul: Dictionary) -> bool:
	var current_id := String(hero_soul.get("monster_soul_id", "")).strip_edges()
	var full_schema_id := String(hero_soul.get("monster_soul_instance_id", "")).strip_edges()
	return not current_id.is_empty() and not full_schema_id.is_empty() and current_id != full_schema_id


static func _deterministic_uuid(stable_key: String) -> String:
	var digest := stable_key.sha256_text()
	return "%s-%s-%s-%s-%s" % [
		digest.substr(0, 8),
		digest.substr(8, 4),
		digest.substr(12, 4),
		digest.substr(16, 4),
		digest.substr(20, 12),
	]


static func _is_valid_uuid(value: String) -> bool:
	var parts := value.split("-", false)
	if parts.size() != 5:
		return false
	var expected_lengths := [8, 4, 4, 4, 12]
	for index: int in parts.size():
		var part := String(parts[index])
		if part.length() != int(expected_lengths[index]):
			return false
		for char_index: int in part.length():
			var code := part.unicode_at(char_index)
			if not (code >= 48 and code <= 57) and not (code >= 97 and code <= 102):
				return false
	return true


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
