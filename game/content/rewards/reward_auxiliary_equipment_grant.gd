@tool
class_name RewardAuxiliaryEquipmentGrant
extends Resource

## One deterministic, unique auxiliary-equipment entitlement authored inside a
## campaign reward bundle. Its explicitly authored UUID is stable across retries
## and balance revisions, so reconciliation can update the entitlement without
## ever duplicating it.

const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")
const AUXILIARY_DEFINITIONS := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const AUXILIARY_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")

@export_category("Identity")
@export var grant_id: StringName
@export var source_id: StringName
## Save-stable entitlement identity.  Unlike a generated drop UUID, this value
## must not change when a reward's seed, affix allow-list, or balance values are
## tuned.  Reward reconciliation can therefore update the one owned entitlement
## instead of silently adding a second item.
@export var stable_instance_id := ""

@export_category("Deterministic roll")
@export_enum("Armor:soul_vessel", "Boots:soul_boots", "Jewelry:soul_trace") var slot_id := "soul_vessel"
@export_enum("Normal:normal", "Magic:magic", "Rare:rare", "Epic:epic", "Legendary:legendary", "Crystal:crystal", "Mythic:mythic", "Eternal:eternal") var rarity_id := "normal"
@export_range(1, 100, 1) var item_level := 1
@export var seed := 1
## Guaranteed rewards author their complete affix set explicitly.  This keeps a
## first-clear reward stable when the wider catalog grows and prevents a
## display-only affix from ever being granted as if it were combat power.
@export var allowed_affix_ids := PackedStringArray()

@export_category("Tutorial convenience")
@export var equip_if_slot_empty := false


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, grant_id, "Auxiliary equipment grant ID")
	ContentId.append_if_invalid(errors, source_id, "Auxiliary equipment source ID")
	if not _is_valid_uuid(stable_instance_id):
		errors.append("Auxiliary equipment reward requires a valid stable instance UUID.")
	if not AUXILIARY_DEFINITIONS.is_valid_slot(slot_id):
		errors.append("Auxiliary equipment reward slot is unsupported.")
	if not AUXILIARY_DEFINITIONS.is_valid_rarity(rarity_id):
		errors.append("Auxiliary equipment reward rarity is unsupported.")
	if item_level < AUXILIARY_DEFINITIONS.MIN_ITEM_LEVEL \
			or item_level > AUXILIARY_DEFINITIONS.MAX_ITEM_LEVEL:
		errors.append("Auxiliary equipment reward item level must be between 1 and 100.")
	_append_affix_contract_errors(errors)
	if not errors.is_empty():
		return errors
	var item := create_item_instance()
	if item.is_empty():
		errors.append("Auxiliary equipment reward could not create its deterministic instance.")
	else:
		for item_error: String in AUXILIARY_RULES.validate_item(item):
			errors.append("Auxiliary equipment reward instance: %s" % item_error)
	return errors


func create_item_instance() -> Dictionary:
	if not _has_valid_roll_contract():
		return {}
	var item := AUXILIARY_RULES.generate_item(
		StringName(slot_id),
		StringName(rarity_id),
		item_level,
		seed,
		source_id,
		allowed_affix_ids,
	)
	if item.is_empty():
		return {}
	item["uuid"] = stable_instance_id
	return item


func to_summary() -> Dictionary:
	var item := create_item_instance()
	var presentation := AUXILIARY_PRESENTATION.presentation_for(item)
	return {
		"grant_id": String(grant_id),
		"uuid": String(item.get("uuid", "")),
		"slot": slot_id,
		"slot_name": _slot_name(slot_id),
		"display_name": String(presentation.get("display_name", _slot_name(slot_id))),
		"icon_path": String(presentation.get("icon_path", "")),
		"definition_id": String(presentation.get("definition_id", "")),
		"rarity": rarity_id,
		"rarity_name": rarity_id.capitalize(),
		"item_level": item_level,
		"source_id": String(source_id),
		"equip_if_slot_empty": equip_if_slot_empty,
		"primary": (item.get("primary", {}) as Dictionary).duplicate(true),
		"affixes": (item.get("affixes", []) as Array).duplicate(true),
	}


func _slot_name(value: String) -> String:
	return AUXILIARY_PRESENTATION.slot_display_name(value)


func _append_affix_contract_errors(errors: PackedStringArray) -> void:
	if not AUXILIARY_DEFINITIONS.is_valid_slot(slot_id) \
			or not AUXILIARY_DEFINITIONS.is_valid_rarity(rarity_id):
		return
	var required_count := AUXILIARY_DEFINITIONS.affix_count(rarity_id)
	if allowed_affix_ids.size() != required_count:
		errors.append(
			"Auxiliary equipment reward rarity '%s' requires exactly %d explicit affix IDs." \
			% [rarity_id, required_count]
		)
	var slot_affixes := AUXILIARY_DEFINITIONS.affix_definitions(slot_id)
	var live_affixes := AUXILIARY_DEFINITIONS.live_affix_ids(slot_id)
	var seen := {}
	for affix_id: String in allowed_affix_ids:
		if seen.has(affix_id):
			errors.append("Auxiliary equipment reward contains duplicate affix '%s'." % affix_id)
			continue
		seen[affix_id] = true
		if not slot_affixes.has(affix_id):
			errors.append(
				"Auxiliary equipment reward affix '%s' is not valid for slot '%s'." \
				% [affix_id, slot_id]
			)
		elif affix_id not in live_affixes:
			errors.append(
				"Auxiliary equipment reward affix '%s' has no LIVE runtime consumer." \
				% affix_id
			)


func _has_valid_roll_contract() -> bool:
	if not _is_valid_uuid(stable_instance_id) \
			or not AUXILIARY_DEFINITIONS.is_valid_slot(slot_id) \
			or not AUXILIARY_DEFINITIONS.is_valid_rarity(rarity_id) \
			or item_level < AUXILIARY_DEFINITIONS.MIN_ITEM_LEVEL \
			or item_level > AUXILIARY_DEFINITIONS.MAX_ITEM_LEVEL:
		return false
	var errors := PackedStringArray()
	_append_affix_contract_errors(errors)
	return errors.is_empty()


func _is_valid_uuid(value: String) -> bool:
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
