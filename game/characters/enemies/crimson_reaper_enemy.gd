class_name CrimsonReaperEnemy
extends AdvancedDungeonEnemy

const RUNTIME_ENEMY_ID := &"crimson_reaper"
const DISPLAY_NAME := "Crimson Reaper"


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	return super.configure_from_definition(snapshot)


func _ready() -> void:
	super._ready()
	set_meta(&"runtime_enemy_id", RUNTIME_ENEMY_ID)
	set_meta(&"display_name", DISPLAY_NAME)
	set_meta(&"is_boss_enemy", true)
	add_to_group(&"boss_enemies")
	add_to_group(&"enemy_crimson_reaper")


func get_archetype_id() -> StringName:
	return RUNTIME_ENEMY_ID


func get_display_name() -> String:
	return DISPLAY_NAME
