@tool
class_name WeaponSkillProfile
extends Resource

@export var skill_id: StringName
@export var behavior_id: StringName
@export var display_name: String
@export_multiline var description: String
@export_range(0.0, 60.0, 0.05) var cooldown_seconds: float = 4.0
@export_range(0.0, 999.0, 0.5) var mana_cost: float = 0.0
@export_range(0.0, 9999.0, 1.0) var damage: float = 25.0
@export_range(0.0, 9999.0, 1.0) var stagger: float = 10.0
@export_range(0.0, 1024.0, 1.0) var knockback: float = 0.0
@export var movement_allowed: bool = false
@export_range(0.0, 1.0, 0.01) var movement_speed_multiplier: float = 0.0
@export_range(0.0, 1024.0, 1.0) var movement_distance: float = 0.0
@export_range(0.0, 5.0, 0.01) var movement_duration: float = 0.0
@export_range(0.0, 5.0, 0.01) var invulnerability_start_seconds: float = 0.0
@export_range(0.0, 5.0, 0.01) var invulnerability_duration_seconds: float = 0.0
@export var ignore_unit_collision_during_movement: bool = false
@export_range(1, 16, 1) var projectile_count: int = 1
@export var piercing: bool = false
@export_range(0.0, 180.0, 0.5) var fallback_spread_degrees: float = 0.0
@export var target_rules: WeaponTargetRules
@export var animation_name: StringName
@export_range(0.01, 5.0, 0.01) var action_duration: float = 0.35
@export_range(0.0, 5.0, 0.01) var hit_window_start_seconds: float = 0.0
@export_range(0.0, 5.0, 0.01) var hit_window_end_seconds: float = 0.0
@export_group("Optional outbound and return behavior")
@export_range(0.0, 1600.0, 1.0) var outbound_speed: float = 0.0
@export_range(0.0, 1600.0, 1.0) var return_speed: float = 0.0
@export_range(0.0, 10.0, 0.05) var automatic_recall_seconds: float = 0.0
@export_range(1.0, 64.0, 1.0) var path_width: float = 8.0
@export_range(0.0, 9999.0, 1.0) var cross_hit_stagger_bonus: float = 0.0
@export_range(0.0, 128.0, 1.0) var return_snap_distance: float = 7.0
@export var stop_outbound_on_world: bool = true
@export_group("")
@export var projectile_scene: PackedScene
@export var hitbox_scene: PackedScene
@export var vfx_scene: PackedScene
@export var sfx: AudioStream
@export var damage_tags: PackedStringArray


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if skill_id.is_empty():
		errors.append("Skill ID is required.")
	if behavior_id.is_empty():
		errors.append("Skill behavior ID is required.")
	if cooldown_seconds < 0.0:
		errors.append("Skill cooldown cannot be negative.")
	if not is_finite(mana_cost) or mana_cost < 0.0:
		errors.append("Skill Mana cost must be finite and non-negative.")
	if action_duration <= 0.0 or hit_window_start_seconds < 0.0 or hit_window_end_seconds < hit_window_start_seconds or hit_window_end_seconds > action_duration:
		errors.append("Skill hit timing must be ordered inside action_duration.")
	if target_rules == null:
		errors.append("Skill target rules are required.")
	else:
		errors.append_array(target_rules.get_validation_errors())
	if behavior_id == &"throw_and_recall":
		if outbound_speed <= 0.0 or return_speed <= 0.0:
			errors.append("Throw & Recall requires positive outbound and return speeds.")
		if automatic_recall_seconds <= 0.0:
			errors.append("Throw & Recall requires a positive automatic recall time.")
	return errors
