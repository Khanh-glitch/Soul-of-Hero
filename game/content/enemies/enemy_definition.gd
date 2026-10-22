@tool
class_name EnemyDefinition
extends Resource

## Authoring contract for one reusable enemy archetype.
##
## Runtime state belongs to the enemy instance. This resource only describes
## stable identity, baseline combat tuning, presentation hooks, and rewards.

@export_category("Identity")
@export var enemy_id: StringName
@export var layout_type_ids: PackedStringArray
@export var display_name: String
@export_multiline var bestiary_summary: String
@export var role_tags: PackedStringArray
@export var development_only := false
@export var density_eligible := true

@export_category("Runtime")
@export var base_scene: PackedScene
@export var attack_behavior_id: StringName
@export var target_logic_id: StringName = &"nearest_player"
@export var projectile_profile: Resource

@export_category("Vitals and movement")
@export_range(1.0, 999999.0, 1.0) var max_health := 70.0
@export_range(0.0, 2000.0, 1.0) var movement_speed := 58.0
@export_range(0.0, 2000.0, 1.0) var preferred_range := 24.0
@export_range(0.0, 2000.0, 1.0) var attack_range := 38.0
@export_range(0.0, 4000.0, 1.0) var awareness_range := 150.0

@export_category("Attack readability")
@export_range(0.0, 30.0, 0.01) var telegraph_seconds := 0.3
@export_range(0.0, 30.0, 0.01) var recovery_seconds := 0.85
@export_range(0.01, 30.0, 0.01) var attack_cooldown_seconds := 0.85
@export_range(0.0, 999999.0, 1.0) var attack_damage := 14.0
@export_range(0.0, 999999.0, 1.0) var stagger_damage := 8.0
@export_range(0.0, 2000.0, 1.0) var knockback := 0.0

@export_category("Resistance and rewards")
@export_range(0.0, 1000.0, 0.01) var stagger_resistance := 0.0
@export_range(0.0, 1.0, 0.01) var crowd_control_resistance := 0.0
@export var loot_table_id: StringName
@export_range(0, 999999, 1) var mastery_reward := 0
@export_range(0, 999999, 1) var score_reward := 0

@export_category("Presentation hooks")
@export var audio_profile_id: StringName
@export var telegraph_vfx: PackedScene
@export var hit_vfx: PackedScene
@export var death_vfx: PackedScene

@export_category("Authoring")
@export_multiline var authoring_notes: String


func get_validation_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	ContentId.append_if_invalid(errors, enemy_id, "Enemy ID")
	ContentId.append_duplicate_or_invalid_ids(errors, layout_type_ids, "Enemy layout type IDs")
	if display_name.strip_edges().is_empty():
		errors.append("Enemy display name is required.")
	if base_scene == null:
		errors.append("Enemy base scene is required.")
	ContentId.append_if_invalid(errors, attack_behavior_id, "Attack behavior ID")
	ContentId.append_if_invalid(errors, target_logic_id, "Target logic ID")
	ContentId.append_duplicate_or_invalid_ids(errors, role_tags, "Enemy role tags")
	if max_health <= 0.0:
		errors.append("Enemy max health must be greater than zero.")
	if movement_speed < 0.0 or preferred_range < 0.0 or attack_range < 0.0:
		errors.append("Enemy movement and range values cannot be negative.")
	if awareness_range < attack_range:
		errors.append("Enemy awareness range must be at least its attack range.")
	if telegraph_seconds < 0.0 or recovery_seconds < 0.0:
		errors.append("Enemy telegraph and recovery durations cannot be negative.")
	if attack_cooldown_seconds <= 0.0:
		errors.append("Enemy attack cooldown must be greater than zero.")
	if attack_damage < 0.0 or stagger_damage < 0.0 or knockback < 0.0:
		errors.append("Enemy damage, stagger, and knockback cannot be negative.")
	if stagger_resistance < 0.0:
		errors.append("Enemy stagger resistance cannot be negative.")
	if crowd_control_resistance < 0.0 or crowd_control_resistance > 1.0:
		errors.append("Enemy crowd-control resistance must stay between zero and one.")
	for optional_id: Dictionary in [
		{"value": loot_table_id, "label": "Loot table ID"},
		{"value": audio_profile_id, "label": "Audio profile ID"},
	]:
		var value: StringName = optional_id.value
		if not value.is_empty():
			ContentId.append_if_invalid(errors, value, optional_id.label)
	return errors


## Layout JSON may keep short legacy type names while save/content references
## use the durable canonical enemy_id. The canonical ID is always an implicit
## alias, so new content does not need to repeat it in layout_type_ids.
func get_layout_type_ids() -> PackedStringArray:
	var result := PackedStringArray()
	if not enemy_id.is_empty():
		result.append(String(enemy_id))
	for raw_id: String in layout_type_ids:
		if not result.has(raw_id):
			result.append(raw_id)
	return result


func build_runtime_snapshot() -> EnemyRuntimeSnapshot:
	var snapshot := EnemyRuntimeSnapshot.new()
	snapshot.enemy_id = enemy_id
	snapshot.layout_type_ids = get_layout_type_ids()
	snapshot.display_name = display_name
	snapshot.role_tags = role_tags.duplicate()
	snapshot.development_only = development_only
	snapshot.density_eligible = density_eligible
	snapshot.base_scene = base_scene
	snapshot.attack_behavior_id = attack_behavior_id
	snapshot.target_logic_id = target_logic_id
	snapshot.projectile_profile = projectile_profile
	snapshot.max_health = max_health
	snapshot.movement_speed = movement_speed
	snapshot.preferred_range = preferred_range
	snapshot.attack_range = attack_range
	snapshot.awareness_range = awareness_range
	snapshot.telegraph_seconds = telegraph_seconds
	snapshot.recovery_seconds = recovery_seconds
	snapshot.attack_cooldown_seconds = attack_cooldown_seconds
	snapshot.attack_damage = attack_damage
	snapshot.stagger_damage = stagger_damage
	snapshot.knockback = knockback
	snapshot.stagger_resistance = stagger_resistance
	snapshot.crowd_control_resistance = crowd_control_resistance
	snapshot.loot_table_id = loot_table_id
	snapshot.mastery_reward = mastery_reward
	snapshot.score_reward = score_reward
	snapshot.audio_profile_id = audio_profile_id
	snapshot.telegraph_vfx = telegraph_vfx
	snapshot.hit_vfx = hit_vfx
	snapshot.death_vfx = death_vfx
	return snapshot


func is_valid_definition() -> bool:
	return get_validation_errors().is_empty()
