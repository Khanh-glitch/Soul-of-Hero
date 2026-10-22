class_name AxeFollowThroughEffect
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const VfxFactory := preload("res://game/vfx/spritesheet_vfx_factory.gd")
const AXE_SPIN := preload("res://assets/vfx/axe/axe_spin_32x32_8.png")

signal target_hit(target: Node, damage: int, phase: StringName, stagger: float)
signal completed(hit_count: int)

enum TravelState {
	OUTBOUND,
	RETURNING,
	FINISHED,
}

const DEFAULT_ENEMY_MASK := 4
const MAX_SEGMENT_TARGETS := 32

@export_flags_2d_physics var enemy_collision_mask := DEFAULT_ENEMY_MASK
@export var spirit_color := Color(0.98, 0.72, 0.28, 1.0)

var _source: WeakRef
var _target: WeakRef
var _weapon_id: StringName = &"axe"
var _start_position := Vector2.ZERO
var _endpoint := Vector2.ZERO
var _outbound_speed := 0.0
var _return_speed := 0.0
var _return_snap_distance := 7.0
var _path_width := 10.0
var _lifetime_remaining := 0.0
var _damage := 0
var _stagger := 0.0
var _state := TravelState.FINISHED
var _configured := false
var _outbound_hit_ids: Dictionary = {}
var _return_hit_ids: Dictionary = {}
var _hit_count := 0
var _trail_emit_left := 0.0
var _travel_direction := Vector2.RIGHT

@onready var _axe_sprite: AnimatedSprite2D = $AxeSprite


func _ready() -> void:
	top_level = true
	_axe_sprite.sprite_frames = VfxFactory.build_grid(AXE_SPIN, Vector2i(32, 32), 8, 18.0, 8)
	_axe_sprite.sprite_frames.set_animation_loop(&"play", true)
	_axe_sprite.play(&"play")
	if _configured:
		global_position = _start_position


func setup(
		source: Node2D,
		start_position: Vector2,
		endpoint: Vector2,
		primary_target: Node2D,
		damage_amount: int,
		stagger_amount: float,
		source_weapon_id: StringName,
		outbound_speed: float,
		return_speed: float,
		maximum_lifetime: float,
		path_width: float,
		return_snap_distance: float
) -> bool:
	var has_live_target := is_instance_valid(primary_target) and CombatDamage.is_alive(primary_target)
	var resolved_endpoint := primary_target.global_position if has_live_target else endpoint
	if source == null or outbound_speed <= 0.0 or return_speed <= 0.0 or resolved_endpoint.distance_to(start_position) <= 2.0:
		queue_free()
		return false
	_source = weakref(source)
	_target = weakref(primary_target) if has_live_target else null
	_start_position = start_position
	_endpoint = resolved_endpoint
	_damage = maxi(0, damage_amount)
	_stagger = maxf(0.0, stagger_amount)
	_weapon_id = source_weapon_id
	_outbound_speed = outbound_speed
	_return_speed = return_speed
	_lifetime_remaining = maxf(maximum_lifetime, 0.5)
	_path_width = maxf(path_width, 1.0)
	_return_snap_distance = maxf(return_snap_distance, 1.0)
	_state = TravelState.OUTBOUND
	_configured = true
	if is_inside_tree():
		global_position = _start_position
	return true


func _physics_process(delta: float) -> void:
	if not _configured or _state == TravelState.FINISHED:
		return
	_lifetime_remaining -= delta
	_trail_emit_left -= delta
	if _lifetime_remaining <= 0.0:
		_finish()
		return
	match _state:
		TravelState.OUTBOUND:
			var target := _target.get_ref() as Node2D if _target != null else null
			if target != null and CombatDamage.is_alive(target):
				_endpoint = target.global_position
			if _move_and_damage(_endpoint, _outbound_speed, delta, &"outbound"):
				_state = TravelState.RETURNING
		TravelState.RETURNING:
			var source := _source.get_ref() as Node2D if _source != null else null
			if source == null:
				_finish()
				return
			if global_position.distance_to(source.global_position) <= _return_snap_distance:
				global_position = source.global_position
				_finish()
				return
			if _move_and_damage(source.global_position, _return_speed, delta, &"return"):
				_finish()
	_emit_asset_trail()


func _move_and_damage(destination: Vector2, speed: float, delta: float, phase: StringName) -> bool:
	var start := global_position
	var offset := destination - start
	var reached := offset.length() <= speed * delta
	var finish := destination if reached else start + offset.normalized() * speed * delta
	if not offset.is_zero_approx():
		_travel_direction = offset.normalized()
	_damage_segment(start, finish, phase)
	global_position = finish
	return reached


func _damage_segment(segment_start: Vector2, segment_end: Vector2, phase: StringName) -> void:
	var segment := segment_end - segment_start
	var length := segment.length()
	if length <= 0.001:
		return
	var sweep := RectangleShape2D.new()
	sweep.size = Vector2(length + _path_width, _path_width)
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = sweep
	query.transform = Transform2D(segment.angle(), (segment_start + segment_end) * 0.5)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]
	var phase_hits := _outbound_hit_ids if phase == &"outbound" else _return_hit_ids
	for hit: Dictionary in get_world_2d().direct_space_state.intersect_shape(query, MAX_SEGMENT_TARGETS):
		var target := hit.get("collider") as Node
		if target == null:
			continue
		var target_id := target.get_instance_id()
		if phase_hits.has(target_id):
			continue
		phase_hits[target_id] = true
		if not CombatDamage.apply_confirmed(target, _damage, segment_start, _weapon_id, {
			"hero_id": &"axe_hero",
			"attack_id": &"axe_follow_through",
			"phase": phase,
			"direction": segment_start.direction_to(segment_end),
			"impact_strength": 1.18,
			"cue_id": &"axe_hit",
		}):
			continue
		CombatDamage.apply_stagger(target, _stagger, {
			"source_weapon_id": _weapon_id,
			"phase": phase,
			"spirit_action": &"follow_through",
		})
		_hit_count += 1
		target_hit.emit(target, _damage, phase, _stagger)


func _finish() -> void:
	if _state == TravelState.FINISHED:
		return
	_state = TravelState.FINISHED
	_configured = false
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.48, Color(1.0, 0.76, 0.34, 0.64), 8)
	completed.emit(_hit_count)
	queue_free()


func _emit_asset_trail() -> void:
	if _trail_emit_left > 0.0 or _state == TravelState.FINISHED:
		return
	_trail_emit_left = 0.085
	if is_instance_valid(_axe_sprite):
		_axe_sprite.modulate.a = 0.62 + sin(_lifetime_remaining * 16.0) * 0.10
	VfxCatalog.spawn(get_parent(), &"axe_trail", global_position, _travel_direction.angle() + PI, 0.84, Color(1.0, 0.70, 0.24, 0.30), 7)
