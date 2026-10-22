@tool
class_name WeaponDefinition
extends Resource

@export var weapon_id: StringName
@export var display_name: String
@export_multiline var short_description: String
@export var icon: Texture2D
@export var unlock_feature: StringName
@export var unlock_condition: String
@export_range(0, 999, 1) var unlock_campaign_level: int = 0
@export var normal_attack: WeaponAttackProfile
@export var hand_skill: WeaponSkillProfile
@export var spirit_trigger: SpiritTriggerDefinition
@export var spirit_action: SpiritActionDefinition
@export var hand_animation_library: StringName
@export var spirit_animation_library: StringName
@export var mastery_track: Resource
@export var monster_part_compatibility_tags: PackedStringArray
@export var rarity_compatibility_tags: PackedStringArray
@export var weapon_tags: PackedStringArray
@export_multiline var hand_ui_description: String
@export_multiline var spirit_ui_description: String


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if weapon_id.is_empty():
		errors.append("Weapon ID is required.")
	if display_name.is_empty():
		errors.append("Weapon display name is required.")
	if normal_attack == null:
		errors.append("A normal Hand attack profile is required.")
	else:
		errors.append_array(normal_attack.get_validation_errors())
	if hand_skill == null:
		errors.append("A Hand skill profile is required.")
	else:
		errors.append_array(hand_skill.get_validation_errors())
	if spirit_trigger == null:
		errors.append("A Spirit trigger definition is required.")
	else:
		errors.append_array(spirit_trigger.get_validation_errors())
	if spirit_action == null:
		errors.append("A Spirit action definition is required.")
	else:
		errors.append_array(spirit_action.get_validation_errors())
	return errors


func is_valid_definition() -> bool:
	return get_validation_errors().is_empty()
