@tool
class_name RewardHeroSoulGrant
extends Resource

## One deterministic Hero Soul entitlement authored inside a reward bundle.
##
## The roll is derived only from these persisted content fields. A first-clear
## retry, save migration, or another machine therefore resolves the same
## instance ID and affix roll instead of creating a second random item.

const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const MAX_ITEM_LEVEL := 100

@export_category("Identity")
@export var grant_id: StringName
@export var hero_id: StringName

@export_category("Deterministic roll")
@export_enum("Normal:0", "Magic:1", "Rare:2", "Epic:3", "Legendary:4", "Crystal:5", "Mythic:6", "Eternal:7") var rarity := 0
@export_range(1, MAX_ITEM_LEVEL, 1) var item_level := 1
@export var source_id: StringName
@export var seed := 1
@export_enum("warrior", "ranger", "magician") var affinity := "warrior"
@export var variant_id: StringName
@export var supported_action_tags := PackedStringArray(["*"])

@export_category("Recruitment")
@export var granted_feature_ids := PackedStringArray()
@export var assign_to_first_reserve := false


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, grant_id, "Hero Soul grant ID")
	ContentId.append_if_invalid(errors, hero_id, "Hero Soul Hero ID")
	ContentId.append_if_invalid(errors, source_id, "Hero Soul source ID")
	if rarity < HERO_SOUL_RULES.Rarity.NORMAL or rarity > HERO_SOUL_RULES.MAX_RARITY:
		errors.append("Hero Soul reward rarity is unsupported.")
	if item_level < 1 or item_level > MAX_ITEM_LEVEL:
		errors.append("Hero Soul reward item level must be between 1 and %d." % MAX_ITEM_LEVEL)
	if StringName(affinity) not in HERO_SOUL_RULES.VALID_AFFINITIES:
		errors.append("Hero Soul reward affinity is unsupported.")
	ContentId.append_duplicate_or_invalid_ids(errors, granted_feature_ids, "Granted feature ID")
	if assign_to_first_reserve:
		errors.append("Hero Soul rewards are inventory-only; explicit wardrobe Equip is required.")
	var soul := create_soul_instance()
	if soul.is_empty():
		errors.append("Hero Soul reward could not create its deterministic instance.")
	else:
		for soul_error: String in HERO_SOUL_RULES.validate_instance(soul):
			errors.append("Hero Soul reward instance: %s" % soul_error)
	return errors


func create_soul_instance() -> Dictionary:
	return HERO_SOUL_RULES.create_instance(
		hero_id,
		rarity,
		item_level,
		source_id,
		seed,
		StringName(affinity),
		variant_id,
		supported_action_tags
	)


func to_summary() -> Dictionary:
	var soul := create_soul_instance()
	return {
		"grant_id": String(grant_id),
		"instance_id": String(soul.get("instance_id", "")),
		"hero_id": String(hero_id),
		"rarity": rarity,
		"rarity_name": HERO_SOUL_RULES.rarity_name(rarity),
		"rarity_display_name": HERO_SOUL_RULES.rarity_display_name_vi(rarity),
		"item_level": item_level,
		"weapon_damage_percent": float(soul.get("weapon_damage_percent", 100.0)),
		"affix_slot_capacity": int(soul.get("affix_slot_capacity", 0)),
		"affix_tier": int(soul.get("affix_tier", 0)),
		"source_id": String(source_id),
		"variant_id": String(soul.get("variant_id", "")),
		"affixes": (soul.get("affixes", []) as Array).duplicate(true),
		"granted_features": Array(granted_feature_ids),
		"assign_to_first_reserve": assign_to_first_reserve,
	}
