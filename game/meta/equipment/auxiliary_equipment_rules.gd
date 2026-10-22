class_name AuxiliaryEquipmentRules
extends RefCounted

## Pure generation, validation, loadout, and sell rules for auxiliary gear.

const DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const MAX_UPGRADE_RANK := 5
const UPGRADE_BONUS_PER_RANK := 0.03
const REQUIRED_ITEM_FIELDS := [
	"uuid",
	"slot",
	"rarity",
	"item_level",
	"primary",
	"affixes",
	"upgrade_rank",
	"favorite",
	"locked",
]


static func generate_item(
		slot_id: StringName,
		rarity_id: StringName,
		item_level: int,
		seed: int,
		generation_namespace: StringName = &"drop",
		allowed_affix_ids: Variant = null
) -> Dictionary:
	if not DEFINITIONS.get_catalog_errors().is_empty():
		return {}
	var slot := String(slot_id)
	var rarity := String(rarity_id)
	var generation_scope := String(generation_namespace)
	if (
			not DEFINITIONS.is_valid_slot(slot)
			or not DEFINITIONS.is_valid_rarity(rarity)
			or item_level < DEFINITIONS.MIN_ITEM_LEVEL
			or item_level > DEFINITIONS.MAX_ITEM_LEVEL
			or not _is_valid_id(generation_scope)
	):
		return {}

	var affix_definitions := DEFINITIONS.affix_definitions(slot)
	var affix_filter := _resolve_affix_filter(
		affix_definitions,
		allowed_affix_ids,
		DEFINITIONS.affix_count(rarity),
	)
	if not bool(affix_filter.get("valid", false)):
		return {}
	var remaining: Array[String] = []
	for affix_id: String in affix_filter.get("ids", PackedStringArray()):
		remaining.append(affix_id)

	var stable_key := "auxiliary_equipment:%s:%s:%d:%s:%d" % [
		slot,
		rarity,
		item_level,
		generation_scope,
		seed,
	]
	if allowed_affix_ids != null:
		stable_key += ":affix_filter:%s" % ",".join(PackedStringArray(remaining))
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var rarity_multiplier := DEFINITIONS.roll_multiplier(rarity)
	var level_multiplier := 1.0 + 0.01 * float(item_level - 1)
	var primary_definition := DEFINITIONS.primary_definition(slot)
	var primary := {
		"stat_id": String(primary_definition["stat_id"]),
		"unit": String(primary_definition["unit"]),
		"value": _roll_value(primary_definition, rarity_multiplier, level_multiplier, rng),
	}

	var affixes: Array[Dictionary] = []
	for _affix_index: int in DEFINITIONS.affix_count(rarity):
		var selected_index := rng.randi_range(0, remaining.size() - 1)
		var affix_id := String(remaining[selected_index])
		remaining.remove_at(selected_index)
		var affix_definition: Dictionary = affix_definitions[affix_id]
		affixes.append({
			"affix_id": affix_id,
			"unit": String(affix_definition["unit"]),
			"value": _roll_value(affix_definition, rarity_multiplier, level_multiplier, rng),
		})

	return {
		"uuid": _deterministic_uuid(stable_key),
		"slot": slot,
		"rarity": rarity,
		"item_level": item_level,
		"primary": primary,
		"affixes": affixes,
		"upgrade_rank": 0,
		"favorite": false,
		"locked": false,
	}


static func _resolve_affix_filter(
		affix_definitions: Dictionary,
		allowed_affix_ids: Variant,
		required_count: int
) -> Dictionary:
	var result := PackedStringArray()
	if allowed_affix_ids == null:
		for raw_affix_id: Variant in affix_definitions.keys():
			result.append(String(raw_affix_id))
		result.sort()
		return {"valid": result.size() >= required_count, "ids": result}
	if not allowed_affix_ids is Array and not allowed_affix_ids is PackedStringArray:
		return {"valid": false, "ids": PackedStringArray()}
	var seen := {}
	for raw_affix_id: Variant in allowed_affix_ids:
		if not raw_affix_id is String and not raw_affix_id is StringName:
			return {"valid": false, "ids": PackedStringArray()}
		var affix_id := String(raw_affix_id)
		if seen.has(affix_id) or not affix_definitions.has(affix_id):
			return {"valid": false, "ids": PackedStringArray()}
		seen[affix_id] = true
		result.append(affix_id)
	result.sort()
	return {"valid": result.size() >= required_count, "ids": result}


static func validate_item(item: Dictionary) -> PackedStringArray:
	var errors := PackedStringArray()
	for field_name: String in REQUIRED_ITEM_FIELDS:
		if not item.has(field_name):
			errors.append("Auxiliary equipment is missing required field '%s'." % field_name)

	var uuid_value: Variant = item.get("uuid", null)
	if not uuid_value is String or not _is_valid_uuid(String(uuid_value)):
		errors.append("Auxiliary equipment uuid is invalid.")
	var slot_value: Variant = item.get("slot", null)
	var slot := String(slot_value) if slot_value is String or slot_value is StringName else ""
	if not DEFINITIONS.is_valid_slot(slot):
		errors.append("Auxiliary equipment slot is invalid.")
	var rarity_value: Variant = item.get("rarity", null)
	var rarity := String(rarity_value) if rarity_value is String or rarity_value is StringName else ""
	if not DEFINITIONS.is_valid_rarity(rarity):
		errors.append("Auxiliary equipment rarity is invalid.")
	var item_level_value: Variant = item.get("item_level", null)
	if not item_level_value is int or int(item_level_value) < DEFINITIONS.MIN_ITEM_LEVEL \
			or int(item_level_value) > DEFINITIONS.MAX_ITEM_LEVEL:
		errors.append("Auxiliary equipment item_level must be an integer from 1 to 100.")

	_validate_primary(errors, slot, item.get("primary", null))
	_validate_affixes(errors, slot, rarity, item.get("affixes", null))
	var upgrade_rank_value: Variant = item.get("upgrade_rank", null)
	if not upgrade_rank_value is int \
			or int(upgrade_rank_value) < 0 \
			or int(upgrade_rank_value) > MAX_UPGRADE_RANK:
		errors.append("Auxiliary equipment upgrade_rank must be an integer from 0 to %d." % MAX_UPGRADE_RANK)
	if not item.get("favorite", null) is bool:
		errors.append("Auxiliary equipment favorite flag must be bool.")
	if not item.get("locked", null) is bool:
		errors.append("Auxiliary equipment locked flag must be bool.")
	return errors


static func upgrade_multiplier(item: Dictionary) -> float:
	var rank_value: Variant = item.get("upgrade_rank", 0)
	if not rank_value is int:
		return 1.0
	return 1.0 + UPGRADE_BONUS_PER_RANK * float(clampi(int(rank_value), 0, MAX_UPGRADE_RANK))


static func validate_shared_loadout(loadout: Dictionary, account_level: int) -> PackedStringArray:
	var errors := PackedStringArray()
	if account_level < 1:
		errors.append("Account level must be at least 1.")
	var seen_slots := {}
	var seen_uuids := {}
	for raw_slot_id: Variant in loadout.keys():
		if not raw_slot_id is String and not raw_slot_id is StringName:
			errors.append("Auxiliary loadout slot keys must be strings.")
			continue
		var slot_id := String(raw_slot_id)
		if not DEFINITIONS.is_valid_slot(slot_id):
			errors.append("Auxiliary loadout contains unknown slot '%s'." % slot_id)
			continue
		if seen_slots.has(slot_id):
			errors.append("Auxiliary loadout duplicates slot '%s'." % slot_id)
		seen_slots[slot_id] = true
		if not is_slot_unlocked(slot_id, account_level):
			errors.append("Auxiliary slot '%s' is locked until account level %d." % [slot_id, DEFINITIONS.unlock_level(slot_id)])
		var item_value: Variant = loadout[raw_slot_id]
		if not item_value is Dictionary:
			errors.append("Auxiliary slot '%s' must contain one item Dictionary." % slot_id)
			continue
		var item: Dictionary = item_value
		for item_error: String in validate_item(item):
			errors.append("slot '%s': %s" % [slot_id, item_error])
		if String(item.get("slot", "")) != slot_id:
			errors.append("Auxiliary item slot must match its shared loadout slot '%s'." % slot_id)
		var uuid := String(item.get("uuid", ""))
		if seen_uuids.has(uuid):
			errors.append("One auxiliary item uuid cannot occupy multiple shared slots.")
		seen_uuids[uuid] = true
	return errors


static func is_slot_unlocked(slot_id: String, account_level: int) -> bool:
	return DEFINITIONS.is_valid_slot(slot_id) \
		and account_level >= DEFINITIONS.unlock_level(slot_id)


static func unlocked_slots(account_level: int) -> PackedStringArray:
	var result := PackedStringArray()
	for slot_id: String in DEFINITIONS.SLOT_IDS:
		if is_slot_unlocked(slot_id, account_level):
			result.append(slot_id)
	return result


static func can_sell(item: Dictionary) -> bool:
	return validate_item(item).is_empty() \
		and not bool(item.get("favorite", false)) \
		and not bool(item.get("locked", false))


static func hero_soul_reference_value(rarity_id: String, item_level: int) -> int:
	if not DEFINITIONS.is_valid_rarity(rarity_id) \
			or item_level < DEFINITIONS.MIN_ITEM_LEVEL \
			or item_level > DEFINITIONS.MAX_ITEM_LEVEL:
		return 0
	return roundi(
		10.0
		* float(DEFINITIONS.sell_weight(rarity_id))
		* (1.0 + 0.01 * float(item_level - 1))
	)


static func sell_value(item: Dictionary) -> int:
	if not can_sell(item):
		return 0
	var hero_value := hero_soul_reference_value(
		String(item["rarity"]),
		int(item["item_level"])
	)
	return roundi(float(hero_value) * 0.60)


static func _validate_primary(errors: PackedStringArray, slot_id: String, primary_value: Variant) -> void:
	if not primary_value is Dictionary:
		errors.append("Auxiliary equipment primary must be exactly one Dictionary.")
		return
	if not DEFINITIONS.is_valid_slot(slot_id):
		return
	var expected := DEFINITIONS.primary_definition(slot_id)
	var primary: Dictionary = primary_value
	if String(primary.get("stat_id", "")) != String(expected.get("stat_id", "")):
		errors.append("Auxiliary equipment primary is not valid for slot '%s'." % slot_id)
	if String(primary.get("unit", "")) != String(expected.get("unit", "")):
		errors.append("Auxiliary equipment primary unit does not match its definition.")
	if not _is_positive_finite_number(primary.get("value", null)):
		errors.append("Auxiliary equipment primary value must be positive and finite.")


static func _validate_affixes(
		errors: PackedStringArray,
		slot_id: String,
		rarity_id: String,
		affixes_value: Variant
) -> void:
	if not affixes_value is Array:
		errors.append("Auxiliary equipment affixes must be an Array.")
		return
	if not DEFINITIONS.is_valid_slot(slot_id) or not DEFINITIONS.is_valid_rarity(rarity_id):
		return
	var affixes: Array = affixes_value
	var expected_count := DEFINITIONS.affix_count(rarity_id)
	if affixes.size() != expected_count:
		errors.append("Rarity '%s' requires exactly %d affixes." % [rarity_id, expected_count])
	var allowed := DEFINITIONS.affix_definitions(slot_id)
	var seen_ids := {}
	for raw_affix: Variant in affixes:
		if not raw_affix is Dictionary:
			errors.append("Auxiliary equipment affix entries must be Dictionaries.")
			continue
		var affix: Dictionary = raw_affix
		var affix_id := String(affix.get("affix_id", ""))
		if not allowed.has(affix_id):
			errors.append("Affix '%s' is not allowed for slot '%s'." % [affix_id, slot_id])
			continue
		if seen_ids.has(affix_id):
			errors.append("Auxiliary equipment cannot roll duplicate affix '%s'." % affix_id)
		seen_ids[affix_id] = true
		var definition: Dictionary = allowed[affix_id]
		if String(affix.get("unit", "")) != String(definition.get("unit", "")):
			errors.append("Affix '%s' unit does not match its definition." % affix_id)
		if not _is_positive_finite_number(affix.get("value", null)):
			errors.append("Affix '%s' value must be positive and finite." % affix_id)


static func _roll_value(
		definition: Dictionary,
		rarity_multiplier: float,
		level_multiplier: float,
		rng: RandomNumberGenerator
) -> float:
	return snappedf(
		rng.randf_range(float(definition["min"]), float(definition["max"]))
		* rarity_multiplier
		* level_multiplier,
		0.01
	)


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


static func _is_positive_finite_number(value: Variant) -> bool:
	return (value is int or value is float) \
		and is_finite(float(value)) \
		and float(value) > 0.0


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
