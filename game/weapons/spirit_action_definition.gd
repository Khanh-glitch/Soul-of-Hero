@tool
class_name SpiritActionDefinition
extends Resource

@export var action_id: StringName
@export var behavior_id: StringName
@export var display_name: String
@export_multiline var description: String
@export_range(0.0, 60.0, 0.05) var cooldown_seconds: float = 2.0
@export_range(0.0, 9999.0, 1.0) var damage: float = 20.0
@export_range(0.0, 9999.0, 1.0) var stagger: float = 10.0
@export_range(0.0, 1024.0, 1.0) var knockback: float = 0.0
@export_range(1, 16, 1) var projectile_count: int = 1
@export var piercing: bool = false
@export var reverse_confirmed_event_vector: bool = false
@export var confirmed_event_vector_key: StringName
@export var return_to_spirit_orbit: bool = false
@export var completes_after_role_swap: bool = true
@export var precast_can_be_cancelled_on_swap: bool = true
@export var target_rules: WeaponTargetRules
@export var animation_name: StringName
@export_group("Optional traveling action behavior")
@export_range(0.0, 1600.0, 1.0) var outbound_speed: float = 0.0
@export_range(0.0, 1600.0, 1.0) var return_speed: float = 0.0
@export_range(0.5, 10.0, 0.1) var maximum_lifetime: float = 4.0
@export_range(1.0, 64.0, 1.0) var path_width: float = 8.0
@export_range(0.0, 128.0, 1.0) var return_snap_distance: float = 7.0
@export_group("")
@export var projectile_scene: PackedScene
@export var hitbox_scene: PackedScene
@export var vfx_scene: PackedScene
@export var sfx: AudioStream
@export var damage_tags: PackedStringArray


func build_action_context(confirmed_context: Dictionary) -> Dictionary:
	var result: Dictionary = confirmed_context.duplicate(true)
	if not confirmed_event_vector_key.is_empty():
		var raw_vector: Variant = confirmed_context.get(confirmed_event_vector_key, Vector2.ZERO)
		if raw_vector is Vector2:
			var direction := (raw_vector as Vector2).normalized()
			if reverse_confirmed_event_vector:
				direction = -direction
			result["action_direction"] = direction
	return result


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if action_id.is_empty():
		errors.append("Spirit action ID is required.")
	if behavior_id.is_empty():
		errors.append("Spirit behavior ID is required.")
	if cooldown_seconds < 0.0:
		errors.append("Spirit cooldown cannot be negative.")
	if reverse_confirmed_event_vector and confirmed_event_vector_key.is_empty():
		errors.append("Reverse-vector actions require a confirmed-event vector key.")
	if target_rules == null:
		errors.append("Spirit action target rules are required.")
	else:
		errors.append_array(target_rules.get_validation_errors())
	if behavior_id == &"follow_through_endpoint_and_return" and (outbound_speed <= 0.0 or return_speed <= 0.0):
		errors.append("Follow-through requires positive outbound and return speeds.")
	return errors
