@tool
class_name WeaponAttackProfile
extends Resource

@export var attack_id: StringName
@export var display_name: String
@export_multiline var description: String
@export_range(1, 8, 1) var combo_count: int = 1
@export var combo_damage: PackedFloat32Array = PackedFloat32Array([10.0])
@export var combo_stagger: PackedFloat32Array = PackedFloat32Array([5.0])
@export var combo_knockback: PackedFloat32Array = PackedFloat32Array([0.0])
@export var combo_hit_stop: PackedFloat32Array = PackedFloat32Array([0.03])
@export var animation_names: PackedStringArray
@export var action_durations: PackedFloat32Array = PackedFloat32Array([0.3])
@export var hit_window_starts: PackedFloat32Array = PackedFloat32Array([0.1])
@export var hit_window_ends: PackedFloat32Array = PackedFloat32Array([0.2])
@export_range(0.01, 5.0, 0.01) var cadence_seconds: float = 0.3
@export_range(0.05, 5.0, 0.01) var combo_reset_seconds: float = 0.75
## Normal attacks use the shared Mana resource as well.  This is deliberately
## authored on the profile (rather than inferred from damage) so each Hero can
## have a distinct combat rhythm while all casts use the same payment seam.
@export_range(0.0, 999.0, 0.5) var mana_cost: float = 0.0
@export var hold_continues_combo: bool = false
@export var movement_allowed: bool = false
@export_range(0.0, 1.0, 0.01) var movement_speed_multiplier: float = 0.0
@export_group("Optional charge behavior")
@export var charge_enabled: bool = false
@export_range(0.05, 5.0, 0.01) var maximum_charge_seconds: float = 1.0
@export_range(0.0, 10.0, 0.05) var quick_release_damage_multiplier: float = 1.0
@export_range(0.0, 10.0, 0.05) var full_charge_damage_multiplier: float = 2.0
@export_range(1.0, 360.0, 1.0) var quick_release_arc_degrees: float = 70.0
@export_range(1.0, 360.0, 1.0) var full_charge_arc_degrees: float = 145.0
@export_range(0.0, 10.0, 0.05) var full_charge_stagger_multiplier: float = 2.0
@export_group("")
@export_range(0.0, 5.0, 0.01) var impact_delay_seconds: float = 0.0
@export var piercing: bool = false
@export var target_rules: WeaponTargetRules
@export var projectile_scene: PackedScene
@export var hitbox_scene: PackedScene
@export var vfx_scene: PackedScene
@export var sfx: AudioStream
@export var damage_tags: PackedStringArray


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if attack_id.is_empty():
		errors.append("Attack ID is required.")
	if combo_count < 1:
		errors.append("Combo count must be at least one.")
	if not is_finite(mana_cost) or mana_cost < 0.0:
		errors.append("Normal attack Mana cost must be a finite non-negative value.")
	for values: PackedFloat32Array in [combo_damage, combo_stagger, combo_knockback, combo_hit_stop]:
		if values.size() != combo_count:
			errors.append("Every combo value array must match combo_count.")
			break
	if not animation_names.is_empty() and animation_names.size() != combo_count:
		errors.append("Animation names must be empty or match combo_count.")
	for timings: PackedFloat32Array in [action_durations, hit_window_starts, hit_window_ends]:
		if timings.size() != combo_count:
			errors.append("Every attack timing array must match combo_count.")
			break
	if action_durations.size() == combo_count and hit_window_starts.size() == combo_count and hit_window_ends.size() == combo_count:
		for index: int in combo_count:
			if action_durations[index] <= 0.0 or hit_window_starts[index] < 0.0 or hit_window_ends[index] < hit_window_starts[index] or hit_window_ends[index] > action_durations[index]:
				errors.append("Attack timing windows must be ordered inside their action duration.")
				break
	if target_rules == null:
		errors.append("Attack target rules are required.")
	else:
		errors.append_array(target_rules.get_validation_errors())
	if charge_enabled:
		if maximum_charge_seconds <= 0.0:
			errors.append("A charge attack requires a positive maximum charge time.")
		if full_charge_damage_multiplier < quick_release_damage_multiplier:
			errors.append("Full-charge damage cannot be lower than quick-release damage.")
		if full_charge_arc_degrees < quick_release_arc_degrees:
			errors.append("Full-charge arc cannot be narrower than the quick-release arc.")
		if full_charge_stagger_multiplier < 1.0:
			errors.append("Full-charge stagger multiplier must be at least one.")
	return errors
