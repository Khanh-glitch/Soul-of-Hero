class_name ArcherEnemyArrow
extends Area2D

signal completed

const QUICK_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_quick_trail_vfx.png")
const PIERCE_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_pierce_trail_vfx.png")
const MARK_PROJECTILE_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_mark_projectile_vfx.png")
const EnemyDifficultyScalerScript := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

@export_range(40.0, 900.0, 1.0) var travel_speed := 390.0
@export_range(32.0, 600.0, 1.0) var maximum_distance := 320.0
@export_range(1, 99, 1) var damage := 12

var _owner_enemy: Node2D
var _direction := Vector2.RIGHT
var _origin := Vector2.ZERO
var _hit_bodies: Dictionary = {}
var _finished := false
var _visual_kind: StringName = &"quick"
var _damage_options: Dictionary = {}
var _damage_input_kind := EnemyDifficultyScalerScript.INPUT_KIND_RUNTIME_PROJECTED
var _damage_channel := &""
var _damage_input_value := 12.0

@onready var _visual: Sprite2D = %ArrowVisual
@onready var _trail: Sprite2D = %TrailVisual
@onready var _collision: CollisionShape2D = %ArrowCollision


func _ready() -> void:
	add_to_group(&"enemy_archer_projectiles")


func setup(
		owner_enemy: Node2D,
		direction: Vector2,
		configured_damage: float,
		configured_speed: float,
		configured_distance: float,
	configured_width: float = 6.0,
	visual_kind: StringName = &"quick",
	damage_input_kind: StringName = EnemyDifficultyScalerScript.INPUT_KIND_RUNTIME_PROJECTED,
	damage_channel: StringName = &"",
	damage_options: Dictionary = {},
) -> void:
	_owner_enemy = owner_enemy
	_direction = direction.normalized()
	if _direction.is_zero_approx():
		_direction = Vector2.RIGHT
	_damage_input_value = maxf(0.0, configured_damage)
	damage = maxi(1, roundi(_damage_input_value))
	_damage_input_kind = damage_input_kind
	_damage_channel = damage_channel
	_damage_options = damage_options.duplicate(true)
	travel_speed = maxf(40.0, configured_speed)
	maximum_distance = maxf(32.0, configured_distance)
	_visual_kind = visual_kind if visual_kind in [&"quick", &"pierce", &"mark"] else &"quick"
	global_position = owner_enemy.global_position + Vector2(0.0, -18.0) + _direction * 10.0
	_origin = global_position
	rotation = _direction.angle()
	_visual.scale = Vector2(1.0, maxf(1.0, configured_width / 5.0))
	match _visual_kind:
		&"mark":
			_trail.texture = MARK_PROJECTILE_VFX
			_trail.position.x = -31.0
			_trail.scale = Vector2.ONE * 0.46
			_trail.modulate = Color(0.92, 0.82, 1.0, 0.94)
			_visual.modulate = Color(0.76, 0.96, 1.0, 1.0)
		&"pierce":
			_trail.texture = PIERCE_TRAIL_VFX
			_trail.position.x = -29.0
			_trail.scale = Vector2.ONE * 0.44
			_trail.modulate = Color(0.90, 0.78, 1.0, 0.94)
			_visual.modulate = Color(0.90, 0.72, 1.0, 1.0)
		_:
			_trail.texture = QUICK_TRAIL_VFX
			_trail.position.x = -25.0
			_trail.scale = Vector2.ONE * 0.50
			_trail.modulate = Color(0.82, 0.98, 1.0, 0.94)
			_visual.modulate = Color.WHITE
	if is_instance_valid(_collision) and _collision.shape is RectangleShape2D:
		var rectangle := (_collision.shape as RectangleShape2D).duplicate() as RectangleShape2D
		_collision.shape = rectangle
		rectangle.size.y = maxf(3.0, configured_width)


func get_owner_enemy() -> Node2D:
	return _owner_enemy


func get_travel_direction() -> Vector2:
	return _direction


func get_visual_kind() -> StringName:
	return _visual_kind


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
	var motion := _direction * travel_speed * delta
	var query := PhysicsRayQueryParameters2D.create(global_position, global_position + motion, 1, [get_rid()])
	if not get_world_2d().direct_space_state.intersect_ray(query).is_empty():
		_finish()
		return
	global_position += motion
	_apply_overlaps()
	if global_position.distance_to(_origin) >= maximum_distance:
		_finish()


func _apply_overlaps() -> void:
	for body: Node2D in get_overlapping_bodies():
		if not body.is_in_group(&"player") or not body.has_method(&"take_damage"):
			continue
		var body_id := body.get_instance_id()
		if _hit_bodies.has(body_id):
			continue
		_hit_bodies[body_id] = true
		_apply_damage_hit(body)
		_finish()
		return


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


func _finish() -> void:
	if _finished:
		return
	_finished = true
	monitoring = false
	_collision.set_deferred(&"disabled", true)
	_trail.visible = false
	_visual.visible = false
	completed.emit()
	queue_free()
