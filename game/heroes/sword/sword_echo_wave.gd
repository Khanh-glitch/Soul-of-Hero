class_name SwordEchoWave
extends Node2D

## Short-lived spectral sword wave used only by Soul Echo's third combo step.
## It owns a swept physics query and never creates marks, i-frames, or combo
## state. The caller supplies the already-reduced Echo damage.

signal hit_confirmed(target: Node, damage: int, context: Dictionary)
signal completed(hit_count: int)

const MAX_QUERY_RESULTS := 32
const ECHO_DAMAGE_SOURCE: StringName = &"sword_soul_echo"
const SWORD_COMBAT_SOURCE: StringName = &"sword_hero"
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
@export_flags_2d_physics var enemy_collision_mask := 4
@export_flags_2d_physics var world_collision_mask := 1
@export_range(1.0, 1600.0, 1.0) var travel_speed := 360.0
@export_range(4.0, 400.0, 1.0) var maximum_distance := 112.0
@export_range(1.0, 64.0, 1.0) var path_width := 18.0
@export var wave_color := Color(1.0, 0.98, 0.90, 0.66)
@export var trail_color := Color(1.0, 1.0, 1.0, 0.32)

var _source: WeakRef
var _direction := Vector2.RIGHT
var _damage := 0
var _travelled := 0.0
var _configured := false
var _finished := false
var _hit_ids: Dictionary = {}
var _hit_count := 0
var _context: Dictionary = {}

@onready var _sprite: Sprite2D = $CrescentSprite


func _ready() -> void:
	top_level = true
	z_index = 8
	_apply_wave_color()


func setup(
		source: Node2D,
		start_position: Vector2,
		direction: Vector2,
		damage_amount: int,
		context: Dictionary = {},
		custom_speed := -1.0,
		custom_distance := -1.0,
		custom_width := -1.0,
		custom_wave_color := Color.TRANSPARENT,
		custom_trail_color := Color.TRANSPARENT
) -> bool:
	if source == null or damage_amount <= 0 or direction.is_zero_approx():
		queue_free()
		return false
	_source = weakref(source)
	_direction = direction.normalized()
	_damage = damage_amount
	_context = context.duplicate(true)
	_context["attack_kind"] = &"soul_echo_wave"
	_context["combo_step"] = 3
	_context["is_echo"] = true
	_context["cue_id"] = &"soul_echo_hit"
	_context["combo_count"] = 3
	_context["impact_strength"] = float(_context.get("impact_strength", 1.15))
	if custom_speed > 0.0:
		travel_speed = custom_speed
	if custom_distance > 0.0:
		maximum_distance = custom_distance
	if custom_width > 0.0:
		path_width = custom_width
	if custom_wave_color.a > 0.0:
		wave_color = custom_wave_color
	if custom_trail_color.a > 0.0:
		trail_color = custom_trail_color
	_apply_wave_color()
	global_position = start_position
	rotation = _direction.angle()
	_configured = true
	return true


func _physics_process(delta: float) -> void:
	if not _configured or _finished:
		return
	var remaining := maximum_distance - _travelled
	if remaining <= 0.0:
		_finish()
		return
	var distance := minf(travel_speed * delta, remaining)
	var start := global_position
	var finish := start + _direction * distance
	var wall_query := PhysicsRayQueryParameters2D.create(
		start, finish, world_collision_mask
	)
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		wall_query.exclude = [source.get_rid()]
	var wall := get_world_2d().direct_space_state.intersect_ray(wall_query)
	if not wall.is_empty():
		finish = (wall.position as Vector2) - _direction * 2.0
	_damage_segment(start, finish)
	global_position = finish
	_travelled += distance
	if not wall.is_empty() or _travelled >= maximum_distance - 0.001:
		_finish()


func _damage_segment(start: Vector2, finish: Vector2) -> void:
	var segment := finish - start
	if segment.length_squared() <= 0.0001 or get_world_2d() == null:
		return
	var sweep := RectangleShape2D.new()
	sweep.size = Vector2(segment.length() + path_width, path_width)
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = sweep
	query.transform = Transform2D(segment.angle(), (start + finish) * 0.5)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]
	for result: Dictionary in get_world_2d().direct_space_state.intersect_shape(query, MAX_QUERY_RESULTS):
		var target := result.get("collider") as Node
		if target == null:
			continue
		var target_id := target.get_instance_id()
		if _hit_ids.has(target_id):
			continue
		_hit_ids[target_id] = true
		var hit_context := _context.duplicate(true)
		hit_context["hit_position"] = result.get("point", finish)
		hit_context["travel_direction"] = _direction
		hit_context["damage_source"] = ECHO_DAMAGE_SOURCE
		if not CombatDamage.apply_confirmed(target, _damage, start, SWORD_COMBAT_SOURCE, hit_context):
			continue
		_hit_count += 1
		hit_confirmed.emit(target, _damage, hit_context)
		_finish()
		return


func cancel() -> void:
	_finish()


func _finish() -> void:
	if _finished:
		return
	_finished = true
	_configured = false
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position, _direction.angle(), 0.42, Color(1.0, 0.98, 0.90, 0.36), 7)
	completed.emit(_hit_count)
	queue_free()


func _apply_wave_color() -> void:
	if is_instance_valid(_sprite):
		_sprite.modulate = wave_color
