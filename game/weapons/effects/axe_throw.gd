class_name AxeThrowEffect
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const VfxFactory := preload("res://game/vfx/spritesheet_vfx_factory.gd")
const AXE_SPIN := preload("res://assets/vfx/axe/axe_spin_32x32_8.png")

signal target_hit(target: Node, damage: int, phase: StringName, cross_cut: bool, stagger: float)
signal cross_cut_confirmed(target: Node, extra_stagger: float)
signal recall_started(manual: bool, from_position: Vector2)
signal completed(hit_count: int, principal_endpoint: Vector2, primary_target: Node, manual_recall: bool)

enum TravelState {
	OUTBOUND,
	WAITING,
	RETURNING,
	FINISHED,
}

const DEFAULT_WORLD_MASK := 1
const DEFAULT_ENEMY_MASK := 4
const MAX_SEGMENT_TARGETS := 32

@export_flags_2d_physics var enemy_collision_mask := DEFAULT_ENEMY_MASK
@export_flags_2d_physics var world_collision_mask := DEFAULT_WORLD_MASK
@export var axe_color := Color(0.92, 0.58, 0.22, 1.0)

var _source: WeakRef
var _weapon_id: StringName = &"axe"
var _direction := Vector2.RIGHT
var _start_position := Vector2.ZERO
var _principal_endpoint := Vector2.ZERO
var _maximum_distance := 0.0
var _outbound_speed := 0.0
var _return_speed := 0.0
var _automatic_recall_remaining := 0.0
var _path_width := 10.0
var _return_snap_distance := 7.0
var _stop_outbound_on_world := true
var _damage := 0
var _stagger := 0.0
var _cross_hit_stagger_bonus := 0.0
var _distance_travelled := 0.0
var _state := TravelState.FINISHED
var _configured := false
var _manual_recall := false
var _outbound_hit_ids: Dictionary = {}
var _return_hit_ids: Dictionary = {}
var _hit_count := 0
var _primary_target_ref: WeakRef
var _trail_emit_left := 0.0

@onready var _axe_sprite: AnimatedSprite2D = $AxeSprite


func _ready() -> void:
	top_level = true
	_axe_sprite.sprite_frames = VfxFactory.build_grid(AXE_SPIN, Vector2i(32, 32), 8, 16.0, 8)
	_axe_sprite.sprite_frames.set_animation_loop(&"play", true)
	_axe_sprite.play(&"play")
	if _configured:
		global_position = _start_position


func setup(
		source: Node2D,
		start_position: Vector2,
		direction: Vector2,
		damage_amount: int,
		stagger_amount: float,
		cross_hit_stagger_bonus: float,
		source_weapon_id: StringName,
		outbound_speed: float,
		return_speed: float,
		maximum_distance: float,
		automatic_recall_seconds: float,
		path_width: float,
		return_snap_distance: float,
		stop_outbound_on_world: bool
) -> bool:
	if source == null or direction.is_zero_approx() or outbound_speed <= 0.0 or return_speed <= 0.0 or maximum_distance <= 0.0:
		queue_free()
		return false
	_source = weakref(source)
	_start_position = start_position
	_principal_endpoint = start_position
	_direction = direction.normalized()
	_damage = maxi(0, damage_amount)
	_stagger = maxf(0.0, stagger_amount)
	_cross_hit_stagger_bonus = maxf(0.0, cross_hit_stagger_bonus)
	_weapon_id = source_weapon_id
	_outbound_speed = outbound_speed
	_return_speed = return_speed
	_maximum_distance = maximum_distance
	_automatic_recall_remaining = maxf(automatic_recall_seconds, 0.01)
	_path_width = maxf(path_width, 1.0)
	_return_snap_distance = maxf(return_snap_distance, 1.0)
	_stop_outbound_on_world = stop_outbound_on_world
	_state = TravelState.OUTBOUND
	_configured = true
	if is_inside_tree():
		global_position = _start_position
	return true


func request_recall(manual := true) -> bool:
	if not _configured or _state == TravelState.RETURNING or _state == TravelState.FINISHED:
		return false
	_manual_recall = _manual_recall or manual
	_state = TravelState.RETURNING
	if is_inside_tree():
		VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.62, Color(1.0, 0.70, 0.24, 0.68), 8)
	recall_started.emit(manual, global_position)
	return true


func is_away() -> bool:
	return _configured and _state != TravelState.FINISHED


func get_travel_state() -> TravelState:
	return _state


func _physics_process(delta: float) -> void:
	if not _configured or _state == TravelState.FINISHED:
		return
	_automatic_recall_remaining -= delta
	_trail_emit_left -= delta
	if _automatic_recall_remaining <= 0.0 and _state != TravelState.RETURNING:
		request_recall(false)

	match _state:
		TravelState.OUTBOUND:
			_update_outbound(delta)
		TravelState.WAITING:
			pass
		TravelState.RETURNING:
			_update_return(delta)
	_update_visual_phase()
	_emit_asset_trail()


func _update_outbound(delta: float) -> void:
	var remaining := _maximum_distance - _distance_travelled
	if remaining <= 0.001:
		_state = TravelState.WAITING
		return
	var segment_start := global_position
	var segment_end := segment_start + _direction * minf(_outbound_speed * delta, remaining)
	var world_hit: Dictionary = {}
	if _stop_outbound_on_world:
		world_hit = _world_intersection(segment_start, segment_end)
		if not world_hit.is_empty():
			segment_end = world_hit.get("position", segment_end)
	_damage_segment(segment_start, segment_end, &"outbound")
	_distance_travelled += segment_start.distance_to(segment_end)
	global_position = segment_end
	_principal_endpoint = segment_end
	if not world_hit.is_empty() or _distance_travelled + 0.001 >= _maximum_distance:
		_state = TravelState.WAITING


func _update_return(delta: float) -> void:
	var source := _source.get_ref() as Node2D if _source != null else null
	if source == null:
		_finish()
		return
	var destination := source.global_position
	if global_position.distance_to(destination) <= _return_snap_distance:
		global_position = destination
		_finish()
		return
	var segment_start := global_position
	var offset := destination - segment_start
	var segment_end := destination if offset.length() <= _return_speed * delta else segment_start + offset.normalized() * _return_speed * delta
	_damage_segment(segment_start, segment_end, &"return")
	global_position = segment_end
	if global_position.distance_to(destination) <= _return_snap_distance:
		global_position = destination
		_finish()


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
	var hits: Array[Dictionary] = get_world_2d().direct_space_state.intersect_shape(query, MAX_SEGMENT_TARGETS)
	hits.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var a_target := a.get("collider") as Node2D
		var b_target := b.get("collider") as Node2D
		if a_target == null:
			return false
		if b_target == null:
			return true
		return segment_start.distance_squared_to(a_target.global_position) < segment_start.distance_squared_to(b_target.global_position)
	)
	for hit: Dictionary in hits:
		var target := hit.get("collider") as Node
		if target == null:
			continue
		var target_id := target.get_instance_id()
		if phase_hits.has(target_id):
			continue
		phase_hits[target_id] = true
		var cross_cut := phase == &"return" and _outbound_hit_ids.has(target_id)
		var impact_direction := segment_start.direction_to(segment_end)
		if not CombatDamage.apply_confirmed(target, _damage, segment_start, _weapon_id, {
			"hero_id": &"axe_hero",
			"attack_id": &"axe_throw",
			"phase": phase,
			"cross_cut": cross_cut,
			"direction": impact_direction,
			"impact_strength": 1.45 if cross_cut else 1.05,
			"cue_id": &"axe_cross_cut" if cross_cut else &"axe_hit",
		}):
			continue
		if _primary_target_ref == null:
			_primary_target_ref = weakref(target)
		var applied_stagger := _stagger + (_cross_hit_stagger_bonus if cross_cut else 0.0)
		CombatDamage.apply_stagger(target, applied_stagger, {
			"source_weapon_id": _weapon_id,
			"phase": phase,
			"cross_cut": cross_cut,
		})
		_hit_count += 1
		target_hit.emit(target, _damage, phase, cross_cut, applied_stagger)
		if cross_cut:
			var impact_position := (target as Node2D).global_position if target is Node2D else segment_end
			VfxCatalog.spawn(get_parent(), &"axe_cleave", impact_position, impact_direction.angle() + PI * 0.25, 1.05, Color(1.0, 0.72, 0.26, 0.82), 10)
			VfxCatalog.spawn(get_parent(), &"axe_cleave", impact_position, impact_direction.angle() - PI * 0.25, 1.05, Color(1.0, 0.90, 0.58, 0.68), 10)
			cross_cut_confirmed.emit(target, _cross_hit_stagger_bonus)


func _world_intersection(segment_start: Vector2, segment_end: Vector2) -> Dictionary:
	var exclude: Array[RID] = []
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		exclude.append(source.get_rid())
	var query := PhysicsRayQueryParameters2D.create(segment_start, segment_end, world_collision_mask, exclude)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.hit_from_inside = true
	return get_world_2d().direct_space_state.intersect_ray(query)


func _finish() -> void:
	if _state == TravelState.FINISHED:
		return
	_state = TravelState.FINISHED
	_configured = false
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.55, Color(1.0, 0.72, 0.28, 0.72), 8)
	var primary_target := _primary_target_ref.get_ref() as Node if _primary_target_ref != null else null
	completed.emit(_hit_count, _principal_endpoint, primary_target, _manual_recall)
	queue_free()


func _update_visual_phase() -> void:
	if not is_instance_valid(_axe_sprite):
		return
	_axe_sprite.modulate = (
		Color(1.0, 0.86, 0.58, 1.0)
		if _state == TravelState.RETURNING
		else Color(1.0, 1.0, 1.0, 1.0)
	)


func _emit_asset_trail() -> void:
	if _trail_emit_left > 0.0 or _state == TravelState.WAITING or _state == TravelState.FINISHED:
		return
	_trail_emit_left = 0.09
	var tint := Color(1.0, 0.88, 0.58, 0.32) if _state == TravelState.RETURNING else Color(0.70, 0.76, 0.82, 0.26)
	VfxCatalog.spawn(get_parent(), &"axe_trail", global_position, _direction.angle() + PI, 0.72, tint, 6)
