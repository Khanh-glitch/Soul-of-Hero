class_name TargetingService
extends RefCounted

const DEFAULT_ENEMY_MASK := 4
const MAX_QUERY_RESULTS := 64

## Performs one physics query at cast/trigger time. It deliberately does not
## maintain or poll an enemy list every frame.


static func acquire_nearest(
		source: Node2D,
		origin: Vector2,
		facing: Vector2,
		maximum_range: float,
		cone_degrees: float = 180.0,
		low_health_preference: float = 0.0,
		collision_mask: int = DEFAULT_ENEMY_MASK,
		extra_exclude: Array[RID] = []
) -> Node2D:
	var targets := acquire_up_to(
		source,
		origin,
		facing,
		maximum_range,
		cone_degrees,
		1,
		low_health_preference,
		collision_mask,
		extra_exclude
	)
	return targets[0] if not targets.is_empty() else null


static func acquire_up_to(
		source: Node2D,
		origin: Vector2,
		facing: Vector2,
		maximum_range: float,
		cone_degrees: float,
		maximum_targets: int,
		low_health_preference: float = 0.0,
		collision_mask: int = DEFAULT_ENEMY_MASK,
		extra_exclude: Array[RID] = []
) -> Array[Node2D]:
	var selected: Array[Node2D] = []
	if not is_instance_valid(source) or not source.is_inside_tree():
		return selected
	if maximum_range <= 0.0 or maximum_targets <= 0:
		return selected

	var circle := CircleShape2D.new()
	circle.radius = maximum_range
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = circle
	query.transform = Transform2D(0.0, origin)
	query.collision_mask = collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = extra_exclude.duplicate()
	if source is CollisionObject2D:
		query.exclude.append((source as CollisionObject2D).get_rid())

	var normalized_facing := facing.normalized()
	if normalized_facing.is_zero_approx():
		normalized_facing = Vector2.RIGHT
	var clamped_cone := clampf(cone_degrees, 0.0, 360.0)
	var minimum_dot := cos(deg_to_rad(clamped_cone * 0.5))
	var candidates: Array[Dictionary] = []
	var seen: Dictionary = {}

	for result: Dictionary in source.get_world_2d().direct_space_state.intersect_shape(query, MAX_QUERY_RESULTS):
		var collider: Variant = result.get("collider")
		if not collider is Node2D:
			continue
		var target := collider as Node2D
		var target_id := target.get_instance_id()
		if seen.has(target_id) or target == source or not CombatDamage.is_alive(target):
			continue
		if not target.has_method(&"take_damage"):
			continue
		var offset := target.global_position - origin
		var distance_squared := offset.length_squared()
		if distance_squared > maximum_range * maximum_range:
			continue
		if clamped_cone < 359.9 and not offset.is_zero_approx():
			if normalized_facing.dot(offset.normalized()) + 0.0001 < minimum_dot:
				continue
		seen[target_id] = true
		var health_factor := lerpf(1.0, 0.65 + CombatDamage.health_ratio(target) * 0.35, clampf(low_health_preference, 0.0, 1.0))
		candidates.append({
			"target": target,
			"score": distance_squared * health_factor * health_factor,
		})

	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a["score"]) < float(b["score"])
	)
	for candidate: Dictionary in candidates:
		selected.append(candidate["target"] as Node2D)
		if selected.size() >= maximum_targets:
			break
	return selected


## Selects enemies by their distance to an explicit world-space pointer while
## still enforcing the weapon's range from the acting character. This is kept
## separate from facing assistance so a mouse click can deliberately choose a
## farther enemy without changing keyboard/controller targeting semantics.
static func acquire_near_point(
		source: Node2D,
		origin: Vector2,
		selection_point: Vector2,
		maximum_range: float,
		selection_radius: float,
		maximum_targets: int = 1,
		collision_mask: int = DEFAULT_ENEMY_MASK,
		extra_exclude: Array[RID] = []
) -> Array[Node2D]:
	var selected: Array[Node2D] = []
	if not is_instance_valid(source) or not source.is_inside_tree():
		return selected
	if maximum_range <= 0.0 or selection_radius <= 0.0 or maximum_targets <= 0:
		return selected

	var circle := CircleShape2D.new()
	circle.radius = selection_radius
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = circle
	query.transform = Transform2D(0.0, selection_point)
	query.collision_mask = collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = extra_exclude.duplicate()
	if source is CollisionObject2D:
		query.exclude.append((source as CollisionObject2D).get_rid())

	var candidates: Array[Dictionary] = []
	var seen: Dictionary = {}
	for result: Dictionary in source.get_world_2d().direct_space_state.intersect_shape(query, MAX_QUERY_RESULTS):
		var collider: Variant = result.get("collider")
		if not collider is Node2D:
			continue
		var target := collider as Node2D
		var target_id := target.get_instance_id()
		if seen.has(target_id) or target == source or not CombatDamage.is_alive(target):
			continue
		if not target.has_method(&"take_damage"):
			continue
		if origin.distance_squared_to(target.global_position) > maximum_range * maximum_range:
			continue
		seen[target_id] = true
		candidates.append({
			"target": target,
			"score": selection_point.distance_squared_to(target.global_position),
		})

	candidates.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a["score"]) < float(b["score"])
	)
	for candidate: Dictionary in candidates:
		selected.append(candidate["target"] as Node2D)
		if selected.size() >= maximum_targets:
			break
	return selected


static func acquire_nearest_to_point(
		source: Node2D,
		origin: Vector2,
		selection_point: Vector2,
		maximum_range: float,
		selection_radius: float,
		collision_mask: int = DEFAULT_ENEMY_MASK,
		extra_exclude: Array[RID] = []
) -> Node2D:
	var targets := acquire_near_point(
		source,
		origin,
		selection_point,
		maximum_range,
		selection_radius,
		1,
		collision_mask,
		extra_exclude
	)
	return targets[0] if not targets.is_empty() else null


static func predict_target_position(target: Node2D, seconds: float) -> Vector2:
	if not is_instance_valid(target):
		return Vector2.ZERO
	var predicted := target.global_position
	if seconds <= 0.0:
		return predicted
	if target is CharacterBody2D:
		predicted += (target as CharacterBody2D).velocity * seconds
	return predicted
