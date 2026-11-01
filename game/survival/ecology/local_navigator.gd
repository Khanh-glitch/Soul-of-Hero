class_name SOHEcologyLocalNavigator
extends RefCounted
## Bounded physical route planner for C08 evidence goals. It reuses the live
## OverworldTraversability terrain/prop cache and the actor's actual collision
## shape. A heuristic path is only a proposal: every cell and swept edge is
## checked against the same physics world the CharacterBody2D moves through.
## It never receives a house/POI target and never opens or damages a blocker.

const POLICY := preload("res://game/survival/ecology/trace_policy.gd")
const TILE := 16.0
const STEPS := [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]

var last_reason := ""
var last_expansions := 0
var last_path_cells := 0

var _body: CharacterBody2D
var _nav: OverworldTraversability
var _shape: CollisionShape2D
var _shape_offset := Vector2.ZERO
var _exclude: Array[RID] = []


func configure(body: CharacterBody2D, nav: OverworldTraversability) -> bool:
	if body == null or nav == null:
		last_reason = "navigator_seats_absent"
		return false
	_body = body
	_nav = nav
	_shape = body.get_node_or_null("BodyCollision") as CollisionShape2D
	if _shape == null or _shape.shape == null:
		last_reason = "navigator_body_shape_absent"
		return false
	_shape_offset = _shape.position
	_exclude = [body.get_rid()]
	var player := body.get_tree().get_first_node_in_group(&"player") as CollisionObject2D
	if player != null:
		_exclude.append(player.get_rid())
	last_reason = ""
	return true


func point(cell: Vector2i) -> Vector2:
	return Vector2(float(cell.x) * TILE + TILE * 0.5, float(cell.y) * TILE + TILE - 1.0)


func plan(goal_world: Vector2) -> Array[Vector2i]:
	var empty: Array[Vector2i] = []
	last_expansions = 0
	last_path_cells = 0
	if _body == null or _nav == null or _shape == null or not _body.is_inside_tree():
		last_reason = "navigator_unconfigured"
		return empty
	var start := _nav.cell_of(_body.global_position)
	var goal := _nav.cell_of(goal_world)
	if not _nav.in_bounds(goal):
		last_reason = "goal_out_of_bounds"
		return empty
	if start == goal:
		last_reason = "already_at_goal"
		return empty
	var region := Rect2i(start, Vector2i.ONE).merge(Rect2i(goal, Vector2i.ONE)).grow(POLICY.NAV_MARGIN_CELLS)
	region = region.intersection(Rect2i(Vector2i.ZERO, Vector2i(_nav.width, _nav.height)))
	var clear_cache := {}
	var edge_cache := {}
	if not _cell_clear(goal, clear_cache):
		last_reason = "goal_blocked"
		return empty
	var open: Array[Vector2i] = [start]
	var open_set := {start: true}
	var closed := {}
	var g_score := {start: 0}
	var f_score := {start: _heuristic(start, goal)}
	var came_from := {}
	while not open.is_empty() and last_expansions < POLICY.NAV_MAX_EXPANSIONS:
		var best_index := 0
		var best_f := int(f_score.get(open[0], 2147483647))
		for i in range(1, open.size()):
			var candidate_f := int(f_score.get(open[i], 2147483647))
			if candidate_f < best_f:
				best_f = candidate_f
				best_index = i
		var current := open[best_index]
		open.remove_at(best_index)
		open_set.erase(current)
		if closed.has(current):
			continue
		closed[current] = true
		last_expansions += 1
		if current == goal:
			var path: Array[Vector2i] = []
			var cursor := goal
			while cursor != start:
				path.push_front(cursor)
				cursor = came_from[cursor]
			last_reason = "path_found"
			last_path_cells = path.size()
			return path
		for step: Vector2i in STEPS:
			var next := current + step
			if closed.has(next) or not region.has_point(next):
				continue
			if not _cell_clear(next, clear_cache):
				continue
			if not _edge_clear(current, next, edge_cache):
				continue
			var tentative := int(g_score.get(current, 2147483647)) + 1
			if tentative >= int(g_score.get(next, 2147483647)):
				continue
			came_from[next] = current
			g_score[next] = tentative
			f_score[next] = tentative + _heuristic(next, goal)
			if not open_set.has(next):
				open.append(next)
				open_set[next] = true
	last_reason = "no_bounded_physical_path"
	return empty


func _heuristic(a: Vector2i, b: Vector2i) -> int:
	return absi(a.x - b.x) + absi(a.y - b.y)


func _query(transform: Transform2D) -> PhysicsShapeQueryParameters2D:
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = _shape.shape
	query.transform = transform
	query.collision_mask = _body.collision_mask
	query.exclude = _exclude
	query.collide_with_bodies = true
	query.collide_with_areas = false
	return query


func _placement(cell: Vector2i) -> Transform2D:
	return Transform2D(0.0, point(cell) + _shape_offset)


func _cell_clear(cell: Vector2i, cache: Dictionary) -> bool:
	if cache.has(cell):
		return bool(cache[cell])
	var clear := _nav.in_bounds(cell) and _nav.is_free(cell)
	if clear:
		var space := _body.get_world_2d().direct_space_state
		clear = space.intersect_shape(_query(_placement(cell)), 1).is_empty()
	cache[cell] = clear
	return clear


func _edge_clear(from: Vector2i, to: Vector2i, cache: Dictionary) -> bool:
	var key := str(from) + ">" + str(to)
	if cache.has(key):
		return bool(cache[key])
	var space := _body.get_world_2d().direct_space_state
	var query := _query(_placement(from))
	# If the actor is already touching a corner, let its own move_and_slide
	# resolve the immediate contact; do not invent a path through the overlap.
	if not space.intersect_shape(query, 1).is_empty():
		cache[key] = true
		return true
	query.motion = _placement(to).origin - query.transform.origin
	var fractions := space.cast_motion(query)
	var clear := fractions.size() >= 2 and fractions[0] >= 0.999
	cache[key] = clear
	return clear
