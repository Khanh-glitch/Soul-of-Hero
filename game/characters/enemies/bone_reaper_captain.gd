class_name BoneReaperCaptain
extends AdvancedDungeonEnemy

## Level 5 miniboss variant. It deliberately reuses the approved Bone Reaper
## animation and returning-disc runtime while giving the final arena a durable,
## queryable combat identity of its own.

const CAPTAIN_PROFILE := {
	"max_health": 258,
	"score": 650,
	"patrol_speed": 32.0,
	"chase_speed": 52.0,
	"detection": 230.0,
	"disengage": 310.0,
	"preferred_min": 78.0,
	"preferred_max": 148.0,
	"ability_range": 204.0,
	"telegraph": 0.64,
	"strike_duration": 0.30,
	"recovery": 0.68,
	"cooldown": 1.80,
	"damage": 18,
}


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	# Seed the captain's choreography before pre-tree binding so range-band and
	# movement ratios come from this controller, not the base Reaper defaults.
	if not is_inside_tree() and _profile.is_empty():
		set_combat_profile(CAPTAIN_PROFILE)
	return super.configure_from_definition(snapshot)


func _ready() -> void:
	super()
	if not has_configured_definition():
		set_combat_profile(CAPTAIN_PROFILE)
		health = max_health
	set_meta(&"miniboss_id", &"bone_reaper_captain")
	add_to_group(&"minibosses")
	add_to_group(&"boss_enemies")
	set_meta(&"is_boss_enemy", true)
	if not has_configured_definition():
		health_changed.emit(health, max_health)


func get_archetype_id() -> StringName:
	return &"bone_reaper_captain"


func get_ability_summary() -> String:
	return "Bone Reaper Captain: a tougher returning-disc executioner guarding the imprisoned Axe Soul."
