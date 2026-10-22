@tool
class_name GameplayTuningProfile
extends Resource

## Inspector-friendly mirror of config/gameplay_tuning.json.  The JSON remains
## the runtime/MCP source of truth; the Designer dock validates and applies this
## profile so non-programmers never need to edit JSON by hand.

const TuningSchema := preload("res://game/characters/knight/gameplay_tuning_schema.gd")

@export_category("Player movement")
@export_range(1.0, 600.0, 1.0) var move_speed := 112.0
@export_range(1.0, 600.0, 1.0) var crouch_speed := 44.0
@export_range(1.0, 5000.0, 1.0) var acceleration := 900.0
@export_range(1.0, 5000.0, 1.0) var friction := 1100.0
@export_range(1.0, 1200.0, 1.0) var dash_speed := 265.0
@export_range(0.05, 5.0, 0.01) var dash_duration := 0.18
@export_range(0.0, 10.0, 0.01) var dash_cooldown := 2.0
@export_range(1.0, 1200.0, 1.0) var roll_speed := 155.0
@export_range(0.05, 5.0, 0.01) var roll_duration := 0.48
@export_range(1.0, 1200.0, 1.0) var slide_speed := 142.0
@export_range(0.05, 5.0, 0.01) var slide_duration := 0.32
@export_range(1.0, 1200.0, 1.0) var hop_speed := 118.0
@export_range(0.05, 5.0, 0.01) var hop_duration := 0.4
@export_range(0.0, 128.0, 0.5) var hop_height := 8.0

@export_category("Player resources")
@export_range(1, 9999, 1) var max_health := 100
@export_range(1.0, 2000.0, 1.0) var max_stamina := 100.0
@export_range(0.0, 2000.0, 1.0) var stamina_regen := 26.0

@export_category("Base combat")
@export_range(0, 9999, 1) var light_damage := 18
@export_range(0, 9999, 1) var heavy_damage := 34
@export_range(0, 9999, 1) var crouch_damage := 22
@export_range(0.05, 10.0, 0.01) var combo_reset_time := 0.55
@export_range(0.0, 10.0, 0.01) var hit_invulnerability := 0.75


func to_document() -> Dictionary:
	return {
		"player": {
			"move_speed": move_speed,
			"crouch_speed": crouch_speed,
			"acceleration": acceleration,
			"friction": friction,
			"dash_speed": dash_speed,
			"dash_duration": dash_duration,
			"dash_cooldown": dash_cooldown,
			"roll_speed": roll_speed,
			"roll_duration": roll_duration,
			"slide_speed": slide_speed,
			"slide_duration": slide_duration,
			"hop_speed": hop_speed,
			"hop_duration": hop_duration,
			"hop_height": hop_height,
			"max_health": max_health,
			"max_stamina": max_stamina,
			"stamina_regen": stamina_regen,
		},
		"combat": {
			"light_damage": light_damage,
			"heavy_damage": heavy_damage,
			"crouch_damage": crouch_damage,
			"combo_reset_time": combo_reset_time,
			"hit_invulnerability": hit_invulnerability,
		},
	}


func load_document(document: Dictionary) -> Dictionary:
	var validation: Dictionary = TuningSchema.validate_document(document)
	if not bool(validation.get("ok", false)):
		return validation
	var player: Dictionary = document["player"]
	var combat: Dictionary = document["combat"]
	move_speed = float(player["move_speed"])
	crouch_speed = float(player["crouch_speed"])
	acceleration = float(player["acceleration"])
	friction = float(player["friction"])
	dash_speed = float(player["dash_speed"])
	dash_duration = float(player["dash_duration"])
	dash_cooldown = float(player["dash_cooldown"])
	roll_speed = float(player["roll_speed"])
	roll_duration = float(player["roll_duration"])
	slide_speed = float(player["slide_speed"])
	slide_duration = float(player["slide_duration"])
	hop_speed = float(player["hop_speed"])
	hop_duration = float(player["hop_duration"])
	hop_height = float(player["hop_height"])
	max_health = int(player["max_health"])
	max_stamina = float(player["max_stamina"])
	stamina_regen = float(player["stamina_regen"])
	light_damage = int(combat["light_damage"])
	heavy_damage = int(combat["heavy_damage"])
	crouch_damage = int(combat["crouch_damage"])
	combo_reset_time = float(combat["combo_reset_time"])
	hit_invulnerability = float(combat["hit_invulnerability"])
	emit_changed()
	return {"ok": true}


func get_validation_errors() -> PackedStringArray:
	var validation: Dictionary = TuningSchema.validate_document(to_document())
	return PackedStringArray() if bool(validation.get("ok", false)) else PackedStringArray([String(validation.get("error", "Invalid tuning."))])
