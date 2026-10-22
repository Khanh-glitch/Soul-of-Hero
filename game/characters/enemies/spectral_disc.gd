class_name SpectralDisc
extends Area2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const EnemyDifficultyScalerScript := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

signal completed

@export_range(40.0, 500.0, 1.0) var travel_speed := 190.0
@export_range(32.0, 400.0, 1.0) var maximum_distance := 188.0
@export_range(1, 99, 1) var damage := 14

var _owner_enemy: Node2D
var _intended_target: Node2D
var _direction := Vector2.RIGHT
var _origin := Vector2.ZERO
var _returning := false
var _phase_hits: Dictionary = {}
var _trail_emit_left := 0.0
var _damage_options: Dictionary = {}
var _damage_input_kind := EnemyDifficultyScalerScript.INPUT_KIND_RUNTIME_PROJECTED
var _damage_channel := &""
var _damage_input_value := 14.0

@onready var _visual: AnimatedSprite2D = %FloatingSkullAsset


func setup(
	owner_enemy: Node2D,
	target_position: Vector2,
	configured_damage: float,
	intended_target: Node2D = null,
	damage_input_kind: StringName = EnemyDifficultyScalerScript.INPUT_KIND_RUNTIME_PROJECTED,
	damage_channel: StringName = &"",
	damage_options: Dictionary = {},
) -> void:
	_owner_enemy = owner_enemy
	_intended_target = intended_target
	_damage_input_value = maxf(0.0, configured_damage)
	damage = maxi(1, roundi(_damage_input_value))
	_damage_input_kind = damage_input_kind
	_damage_channel = damage_channel
	_damage_options = damage_options.duplicate(true)
	global_position = owner_enemy.global_position + Vector2(0.0, -10.0)
	_origin = global_position
	_direction = global_position.direction_to(target_position)
	if _direction.is_zero_approx():
		_direction = Vector2.RIGHT
	_update_visual_orientation()


func get_travel_direction() -> Vector2:
	return _direction


func get_damage_input_kind() -> StringName:
	return _damage_input_kind


func get_damage_channel() -> StringName:
	return _damage_channel


func get_damage_input_value() -> float:
	return _damage_input_value


func _physics_process(delta: float) -> void:
	if not is_instance_valid(_owner_enemy):
		_finish()
		return

	if _returning:
		var return_target := _owner_enemy.global_position + Vector2(0.0, -10.0)
		if global_position.distance_to(return_target) <= 10.0:
			_finish()
			return
		_direction = global_position.direction_to(return_target)
	elif global_position.distance_to(_origin) >= maximum_distance:
		_begin_return()
	_update_visual_orientation()

	var motion := _direction * travel_speed * delta
	var query := PhysicsRayQueryParameters2D.create(global_position, global_position + motion, 1)
	query.exclude = [get_rid()]
	if not get_world_2d().direct_space_state.intersect_ray(query).is_empty():
		_begin_return()
		motion = _direction * travel_speed * delta
	global_position += motion
	_trail_emit_left -= delta
	if _trail_emit_left <= 0.0:
		_trail_emit_left = 0.085
		VfxCatalog.spawn(get_parent(), &"reaper_trail", global_position, _direction.angle() + PI, 0.82, Color(0.64, 0.86, 1.0, 0.34), 6)
	_apply_overlaps()


func _apply_overlaps() -> void:
	var phase := 1 if _returning else 0
	for body: Node2D in get_overlapping_bodies():
		if (
			not body.is_in_group(&"player")
			and not body.is_in_group(&"defense_objective")
		) or not body.has_method(&"take_damage"):
			continue
		var hit_key := "%d:%d" % [body.get_instance_id(), phase]
		if _phase_hits.has(hit_key):
			continue
		_phase_hits[hit_key] = true
		_apply_damage_hit(body)
	# Static defense objectives can sit exactly on an Area2D broad-phase edge.
	# A narrow distance fallback prevents the Reaper disc from visually crossing
	# the Beacon without dealing damage; the normal player path remains overlap-
	# only and therefore unchanged in every existing level.
	if (
		is_instance_valid(_intended_target)
		and _intended_target.is_in_group(&"defense_objective")
		and _intended_target.has_method(&"take_damage")
		and global_position.distance_to(_intended_target.global_position + Vector2(0.0, -7.0)) <= 29.0
	):
		var objective_hit_key := "%d:%d" % [_intended_target.get_instance_id(), phase]
		if not _phase_hits.has(objective_hit_key):
			_phase_hits[objective_hit_key] = true
			_apply_damage_hit(_intended_target)


func _apply_damage_hit(target: Node) -> Dictionary:
	match _damage_input_kind:
		EnemyDifficultyScalerScript.INPUT_KIND_AUTHORED:
			return EnemyDifficultyScalerScript.apply_authored_damage_hit(
				_owner_enemy,
				target,
				_damage_input_value,
				global_position,
				_damage_options,
			)
		EnemyDifficultyScalerScript.INPUT_KIND_CONFIGURED_AUTHORED:
			return EnemyDifficultyScalerScript.apply_configured_damage_hit(
				_owner_enemy,
				target,
				_damage_channel,
				_damage_input_value,
				global_position,
				_damage_options,
			)
		_:
			return EnemyDifficultyScalerScript.apply_runtime_damage_hit(
				_owner_enemy,
				target,
				_damage_input_value,
				global_position,
				_damage_options,
			)


func _begin_return() -> void:
	if _returning:
		return
	_returning = true
	_phase_hits.clear()
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.62, Color(0.62, 0.96, 1.0, 0.68), 8)
	if is_instance_valid(_owner_enemy):
		_direction = global_position.direction_to(_owner_enemy.global_position + Vector2(0.0, -10.0))
	_update_visual_orientation()


func _update_visual_orientation() -> void:
	if is_instance_valid(_visual):
		_visual.flip_h = _direction.x < -0.01


func _finish() -> void:
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position, _direction.angle(), 0.64, Color(0.64, 0.96, 1.0, 0.48), 7)
	completed.emit()
	queue_free()
