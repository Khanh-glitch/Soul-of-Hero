class_name CombatImpactBurst
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

var _elapsed := 0.0
var _duration := 0.16
var _strength := 1.0
var _is_echo := false


func configure(world_position: Vector2, context: Dictionary = {}) -> void:
	global_position = world_position
	_strength = clampf(float(context.get("impact_strength", 1.0)), 0.25, 3.0)
	_duration = clampf(float(context.get("impact_duration", 0.16)), 0.06, 0.45)
	_is_echo = bool(context.get("is_echo", false)) or StringName(context.get("cue_id", &"")) == &"soul_echo_hit"
	z_index = int(context.get("impact_z_index", 110))
	_spawn_asset_impact(context)
	_duration = maxf(_duration, 0.42)
	process_mode = Node.PROCESS_MODE_PAUSABLE


func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed >= _duration:
		queue_free()
		return


func _spawn_asset_impact(context: Dictionary) -> void:
	var effect_id := &"blade_impact"
	var weapon_id := StringName(context.get("weapon_id", &""))
	var material := StringName(context.get("impact_material", &""))
	if _is_echo:
		effect_id = &"echo_impact"
	elif weapon_id == &"axe":
		effect_id = &"axe_impact"
	elif material == &"flesh":
		effect_id = &"blood_impact"
	elif material == &"bone":
		effect_id = &"bone_impact"
	var direction: Variant = context.get("impact_direction", Vector2.RIGHT)
	var angle := (direction as Vector2).angle() if direction is Vector2 and not (direction as Vector2).is_zero_approx() else 0.0
	var custom_tint := Color.TRANSPARENT
	var requested_tint: Variant = context.get("impact_color", null)
	if requested_tint is Color:
		custom_tint = requested_tint
	VfxCatalog.spawn(
		self,
		effect_id,
		global_position,
		angle,
		clampf(0.75 + _strength * 0.28, 0.72, 1.6),
		custom_tint,
		z_index
	)
	if _is_echo and int(context.get("combo_step", 0)) == 4:
		VfxCatalog.spawn(
			self,
			&"echo_impact",
			global_position,
			angle + PI * 0.5,
			clampf(0.9 + _strength * 0.26, 0.9, 1.7),
			Color(1.0, 0.98, 0.90, 0.64),
			z_index + 1
		)

