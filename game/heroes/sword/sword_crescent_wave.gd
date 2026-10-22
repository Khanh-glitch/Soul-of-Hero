class_name SwordCrescentWave
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

signal target_hit(target: Node2D, damage: int)
signal completed(hit_count: int)

var _owner_actor_ref: WeakRef
var _direction := Vector2.RIGHT
var _damage := 1
var _speed := 275.0
var _maximum_distance := 150.0
var _width := 28.0
var _travelled := 0.0
var _launch_delay := 0.15
var _attack_instance_id := 0
var _hit_targets: Dictionary = {}
var _launched := false

func setup(
		owner_actor: Node2D,
		origin: Vector2,
		direction: Vector2,
		damage: int,
		attack_instance_id: int,
		speed: float,
		maximum_distance: float,
		width: float
) -> void:
	_owner_actor_ref = weakref(owner_actor) if is_instance_valid(owner_actor) else null
	global_position = origin
	_direction = direction.normalized() if not direction.is_zero_approx() else Vector2.RIGHT
	_damage = maxi(1, damage)
	_attack_instance_id = attack_instance_id
	_speed = maxf(40.0, speed)
	_maximum_distance = maxf(16.0, maximum_distance)
	_width = maxf(4.0, width)
	rotation = _direction.angle()


func _ready() -> void:
	top_level = true
	z_index = 7
	process_mode = Node.PROCESS_MODE_PAUSABLE


func _physics_process(delta: float) -> void:
	if _launch_delay > 0.0:
		_launch_delay -= delta
		return
	if not _launched:
		_launched = true
		_emit_cue(&"sword_wave")
	var travel := minf(_speed * delta, _maximum_distance - _travelled)
	if travel <= 0.0:
		_finish(false)
		return
	var previous := global_position
	var desired := previous + _direction * travel
	var wall_query := PhysicsRayQueryParameters2D.create(previous, desired, 1)
	var owner_actor: Node = _owner_actor_ref.get_ref() if _owner_actor_ref != null else null
	if is_instance_valid(owner_actor) and owner_actor is CollisionObject2D:
		wall_query.exclude = [(owner_actor as CollisionObject2D).get_rid()]
	var wall := get_world_2d().direct_space_state.intersect_ray(wall_query)
	if not wall.is_empty():
		desired = (wall.position as Vector2) - _direction * 3.0
	global_position = desired
	_travelled += previous.distance_to(global_position)
	_confirm_segment_hits(previous, global_position)
	if not wall.is_empty() or _travelled >= _maximum_distance - 0.01:
		_finish(not wall.is_empty())


func _confirm_segment_hits(segment_start: Vector2, segment_end: Vector2) -> void:
	var segment := segment_end - segment_start
	var segment_length := segment.length()
	if segment_length <= 0.001:
		return
	# Query the real collision shapes swept by the wave. Measuring only from each
	# enemy's origin missed large/off-center bodies even when the visible blade
	# clearly crossed their collider.
	var sweep := RectangleShape2D.new()
	sweep.size = Vector2(segment_length + _width, _width)
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = sweep
	query.transform = Transform2D(segment.angle(), (segment_start + segment_end) * 0.5)
	query.collision_mask = 4
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var owner_actor: Node = _owner_actor_ref.get_ref() if _owner_actor_ref != null else null
	if is_instance_valid(owner_actor) and owner_actor is CollisionObject2D:
		query.exclude = [(owner_actor as CollisionObject2D).get_rid()]
	var hits := get_world_2d().direct_space_state.intersect_shape(query, 64)
	hits.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var a_target := a.get("collider") as Node2D
		var b_target := b.get("collider") as Node2D
		if a_target == null:
			return false
		if b_target == null:
			return true
		return segment_start.distance_squared_to(a_target.global_position) \
			< segment_start.distance_squared_to(b_target.global_position)
	)
	for hit: Dictionary in hits:
		var candidate := hit.get("collider") as Node
		if candidate == null or not candidate.is_in_group(&"enemies") \
				or not candidate is Node2D or not candidate.has_method(&"take_damage"):
			continue
		var enemy := candidate as Node2D
		var target_id := enemy.get_instance_id()
		if _hit_targets.has(target_id):
			continue
		var closest := Geometry2D.get_closest_point_to_segment(enemy.global_position, segment_start, segment_end)
		if CombatDamage.apply_confirmed(enemy, _damage, closest, &"sword_hero", {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"sword_hero",
			"attack_id": &"crescent_recoil_wave",
			"combo_step": 3,
			"combo_count": 3,
			"cue_id": &"sword_wave",
			"impact_strength": 1.15,
			"hit_stop_seconds": 0.045,
			"direction": _direction,
		}):
			_hit_targets[target_id] = true
			target_hit.emit(enemy, _damage)
			# The pursuit mark belongs to exactly one unit. The blade wave is
			# consumed on the first confirmed enemy, just as it is by a wall.
			_finish(false)
			return


func _emit_cue(cue_id: StringName) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"sword_hero",
			"combo_step": 3,
		})


func _finish(collided_with_world := false) -> void:
	VfxCatalog.spawn(
		get_parent(),
		&"blade_impact" if collided_with_world else &"smoke_puff",
		global_position,
		_direction.angle(),
		0.7 if collided_with_world else 0.48,
		Color(1.0, 0.98, 0.90, 0.58),
		7
	)
	completed.emit(_hit_targets.size())
	queue_free()
