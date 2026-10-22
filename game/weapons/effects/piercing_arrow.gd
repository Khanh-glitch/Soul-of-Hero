class_name PiercingArrowEffect
extends Area2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

signal target_hit(target: Node, damage: int)
signal completed(reason: StringName, hit_count: int, position: Vector2)

const DEFAULT_WORLD_MASK := 1
const DEFAULT_ENEMY_MASK := 4
const MAX_SEGMENT_TARGETS := 32

@export_range(1.0, 1600.0, 1.0) var speed := 460.0
@export_range(8.0, 20000.0, 1.0) var maximum_distance := 380.0
@export_range(2.0, 64.0, 1.0) var projectile_length := 18.0
@export_range(1.0, 32.0, 1.0) var projectile_width := 6.0
@export_flags_2d_physics var enemy_collision_mask := DEFAULT_ENEMY_MASK
@export_flags_2d_physics var world_collision_mask := DEFAULT_WORLD_MASK
@export var arrow_color := Color(0.35, 0.88, 1.0, 1.0)

@onready var hit_shape: CollisionShape2D = %HitShape
@onready var _trail_sprite: Sprite2D = %TrailSprite
@onready var _arrow_sprite: Sprite2D = %ArrowSprite

var _source: WeakRef
var _direction := Vector2.RIGHT
var _damage := 0
var _weapon_id: StringName = &"bow"
var _start_position := Vector2.ZERO
var _distance_travelled := 0.0
var _configured := false
var _hit_target_ids: Dictionary = {}
var _hit_count := 0
var _maximum_targets := MAX_SEGMENT_TARGETS
var _stagger_amount := 0.0
var _boss_stagger_amount := -1.0
var _damage_decay_per_hit := 0.0
var _damage_floor_ratio := 1.0
var _shared_target_hits: Dictionary = {}
var _per_target_hit_cap := 1
var _visual_elapsed := 0.0


func _ready() -> void:
	top_level = true
	if _configured:
		global_position = _start_position
	_update_collision_shape()
	rotation = _direction.angle()
	_sync_asset_visuals(0.0)


## Pierces every enemy once along direction, but ray-stops on World before the
## next movement segment. Add to the world before setup for unambiguous coords.
func setup(
		source: Node2D,
		start_position: Vector2,
		direction: Vector2,
		damage_amount: int,
		source_weapon_id: StringName = &"bow",
		custom_speed: float = -1.0,
		custom_maximum_distance: float = -1.0,
		visual_color: Color = Color(0.35, 0.88, 1.0, 1.0),
		custom_maximum_targets: int = MAX_SEGMENT_TARGETS,
		stagger_amount: float = 0.0,
		custom_projectile_width: float = -1.0,
		shared_target_hits: Dictionary = {},
		per_target_hit_cap: int = 1,
		damage_decay_per_hit: float = 0.0,
		damage_floor_ratio: float = 1.0,
		boss_stagger_amount: float = -1.0,
) -> void:
	_source = weakref(source)
	_start_position = start_position
	_direction = direction.normalized()
	if _direction.is_zero_approx():
		_direction = Vector2.RIGHT
	_damage = maxi(0, damage_amount)
	_weapon_id = source_weapon_id
	if custom_speed > 0.0:
		speed = custom_speed
	if custom_maximum_distance > 0.0:
		maximum_distance = custom_maximum_distance
	if custom_projectile_width > 0.0:
		projectile_width = clampf(custom_projectile_width, 1.0, 32.0)
	arrow_color = visual_color
	_maximum_targets = clampi(custom_maximum_targets, 1, MAX_SEGMENT_TARGETS)
	_stagger_amount = maxf(0.0, stagger_amount)
	_boss_stagger_amount = boss_stagger_amount
	_damage_decay_per_hit = clampf(damage_decay_per_hit, 0.0, 1.0)
	_damage_floor_ratio = clampf(damage_floor_ratio, 0.0, 1.0)
	_shared_target_hits = shared_target_hits
	_per_target_hit_cap = maxi(1, per_target_hit_cap)
	_configured = true
	if is_inside_tree():
		global_position = _start_position
		rotation = _direction.angle()
		_update_collision_shape()
		_sync_asset_visuals(0.0)


func _physics_process(delta: float) -> void:
	if not _configured:
		return
	var remaining_distance := maximum_distance - _distance_travelled
	if remaining_distance <= 0.0:
		_finish(&"range")
		return

	var segment_distance := minf(speed * delta, remaining_distance)
	var segment_start := global_position
	var segment_end := segment_start + _direction * segment_distance
	var world_hit := _world_intersection(segment_start, segment_end)
	if not world_hit.is_empty():
		segment_end = world_hit.get("position", segment_end)

	_damage_segment(segment_start, segment_end)
	var actual_distance := segment_start.distance_to(segment_end)
	global_position = segment_end
	_distance_travelled += actual_distance
	if not world_hit.is_empty():
		_finish(&"world")
	elif _distance_travelled + 0.001 >= maximum_distance:
		_finish(&"range")
	else:
		_sync_asset_visuals(delta)


func _world_intersection(segment_start: Vector2, segment_end: Vector2) -> Dictionary:
	var exclude: Array[RID] = [get_rid()]
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		exclude.append(source.get_rid())
	var query := PhysicsRayQueryParameters2D.create(segment_start, segment_end, world_collision_mask, exclude)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.hit_from_inside = true
	return get_world_2d().direct_space_state.intersect_ray(query)


func _damage_segment(segment_start: Vector2, segment_end: Vector2) -> void:
	var segment := segment_end - segment_start
	var segment_length := segment.length()
	if segment_length <= 0.001:
		return
	var sweep_shape := RectangleShape2D.new()
	sweep_shape.size = Vector2(segment_length + projectile_length, projectile_width)
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = sweep_shape
	query.transform = Transform2D(segment.angle(), (segment_start + segment_end) * 0.5)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]

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
		if _hit_count >= _maximum_targets:
			_finish(&"target_cap")
			return
		var collider: Variant = hit.get("collider")
		if not collider is Node:
			continue
		var target := collider as Node
		var target_id := target.get_instance_id()
		if _hit_target_ids.has(target_id):
			continue
		if int(_shared_target_hits.get(target_id, 0)) >= _per_target_hit_cap:
			continue
		_hit_target_ids[target_id] = true
		var damage_ratio := maxf(
			_damage_floor_ratio, 1.0 - _damage_decay_per_hit * float(_hit_count)
		)
		var hit_damage := maxi(1, roundi(float(_damage) * damage_ratio))
		if CombatDamage.apply_confirmed(target, hit_damage, segment_start, _weapon_id, {
			"hero_id": &"archer_hero",
			"source_kind": &"projectile",
		}):
			_hit_count += 1
			_shared_target_hits[target_id] = int(_shared_target_hits.get(target_id, 0)) + 1
			var hit_position := (target as Node2D).global_position if target is Node2D else segment_end
			VfxCatalog.spawn(get_parent(), &"bow_impact", hit_position, rotation, 0.52, arrow_color, 9)
			var resolved_stagger := _stagger_amount
			if _boss_stagger_amount >= 0.0 and (
				target.is_in_group(&"boss_enemies") or target.is_in_group(&"bosses")
			):
				resolved_stagger = _boss_stagger_amount
			if resolved_stagger > 0.0 and target.has_method(&"apply_stagger"):
				target.call(&"apply_stagger", resolved_stagger, {
					"source_weapon_id": _weapon_id,
					"source_kind": &"projectile",
				})
			target_hit.emit(target, hit_damage)
			if _hit_count >= _maximum_targets:
				_finish(&"target_cap")
				return


func _finish(reason: StringName) -> void:
	if not _configured:
		return
	_configured = false
	monitoring = false
	hit_shape.set_deferred(&"disabled", true)
	_trail_sprite.visible = false
	_arrow_sprite.visible = false
	if reason == &"world":
		VfxCatalog.spawn(get_parent(), &"bow_impact", global_position, rotation, 0.44, arrow_color, 8)
	completed.emit(reason, _hit_count, global_position)
	queue_free()


func _update_collision_shape() -> void:
	var rectangle := hit_shape.shape as RectangleShape2D
	if rectangle != null:
		rectangle = rectangle.duplicate() as RectangleShape2D
		hit_shape.shape = rectangle
		rectangle.size = Vector2(projectile_length, projectile_width)


func _sync_asset_visuals(delta: float) -> void:
	if not is_instance_valid(_trail_sprite) or not is_instance_valid(_arrow_sprite):
		return
	_trail_sprite.visible = _configured
	_arrow_sprite.visible = _configured
	if not _configured:
		return
	_visual_elapsed += delta
	_trail_sprite.frame = int(_visual_elapsed * 24.0) % maxi(1, _trail_sprite.hframes)
	_trail_sprite.position.x = -projectile_length * 0.86
	_trail_sprite.scale = Vector2(maxf(0.45, projectile_length / 32.0), maxf(0.34, projectile_width / 12.0))
	_trail_sprite.modulate = Color(arrow_color, 0.46)
	_arrow_sprite.scale = Vector2(projectile_length / 30.0, maxf(0.72, projectile_width / 5.0))
	_arrow_sprite.modulate = arrow_color
