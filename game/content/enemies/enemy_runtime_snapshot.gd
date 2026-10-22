class_name EnemyRuntimeSnapshot
extends RefCounted

## Detached, typed runtime input for one enemy instance.
##
## EnemyDefinition is authoring data shared by every spawn. Controllers receive
## this copied snapshot so a live instance never holds or mutates the catalog
## resource itself. Difficulty, Elite and temporary effects project on top of
## these authored values after binding.

var enemy_id: StringName
var layout_type_ids := PackedStringArray()
var display_name := ""
var role_tags := PackedStringArray()
var development_only := false
var density_eligible := true

var base_scene: PackedScene
var attack_behavior_id: StringName
var target_logic_id: StringName
var projectile_profile: Resource

var max_health := 1.0
var movement_speed := 0.0
var preferred_range := 0.0
var attack_range := 0.0
var awareness_range := 0.0

var telegraph_seconds := 0.0
var recovery_seconds := 0.0
var attack_cooldown_seconds := 0.0
var attack_damage := 0.0
var stagger_damage := 0.0
var knockback := 0.0

var stagger_resistance := 0.0
var crowd_control_resistance := 0.0
var loot_table_id: StringName
var mastery_reward := 0
var score_reward := 0

var audio_profile_id: StringName
var telegraph_vfx: PackedScene
var hit_vfx: PackedScene
var death_vfx: PackedScene


func is_valid() -> bool:
	return (
		not enemy_id.is_empty()
		and base_scene != null
		and max_health > 0.0
		and movement_speed >= 0.0
		and preferred_range >= 0.0
		and attack_range >= 0.0
		and awareness_range >= attack_range
		and telegraph_seconds >= 0.0
		and recovery_seconds >= 0.0
		and attack_cooldown_seconds > 0.0
		and attack_damage >= 0.0
	)


func to_dictionary() -> Dictionary:
	return {
		"enemy_id": String(enemy_id),
		"layout_type_ids": Array(layout_type_ids),
		"display_name": display_name,
		"role_tags": Array(role_tags),
		"development_only": development_only,
		"density_eligible": density_eligible,
		"attack_behavior_id": String(attack_behavior_id),
		"target_logic_id": String(target_logic_id),
		"max_health": max_health,
		"movement_speed": movement_speed,
		"preferred_range": preferred_range,
		"attack_range": attack_range,
		"awareness_range": awareness_range,
		"telegraph_seconds": telegraph_seconds,
		"recovery_seconds": recovery_seconds,
		"attack_cooldown_seconds": attack_cooldown_seconds,
		"attack_damage": attack_damage,
		"stagger_damage": stagger_damage,
		"knockback": knockback,
		"stagger_resistance": stagger_resistance,
		"crowd_control_resistance": crowd_control_resistance,
		"loot_table_id": String(loot_table_id),
		"mastery_reward": mastery_reward,
		"score_reward": score_reward,
		"audio_profile_id": String(audio_profile_id),
	}
