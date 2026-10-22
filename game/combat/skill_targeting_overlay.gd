class_name SkillTargetingOverlay
extends Node2D

## The only procedural combat visual: a non-authoritative virtual targeting
## zone. Real skill VFX must come from the asset-backed VFX library.

const FILL := Color(0.25, 0.82, 1.0, 0.16)
const EDGE := Color(0.48, 0.94, 1.0, 0.92)
const INVALID := Color(1.0, 0.25, 0.20, 0.82)

var armed := false
var profile: Dictionary = {}
var source: Node2D
var aim_world := Vector2.ZERO
var _snap_world := Vector2.ZERO
var _mouse_origin := Vector2.ZERO
var _mouse_has_moved := false


func arm_skill(next_profile: Dictionary, source_node: Node2D, snapped_world: Vector2) -> void:
	profile = next_profile.duplicate(true)
	source = source_node
	_snap_world = snapped_world
	aim_world = snapped_world
	_mouse_origin = get_viewport().get_mouse_position()
	_mouse_has_moved = false
	armed = true
	visible = _uses_zone()
	queue_redraw()


func cancel() -> void:
	armed = false
	profile.clear()
	source = null
	visible = false
	queue_redraw()


func confirm() -> Dictionary:
	if not armed:
		return {}
	var result := {
		"aim_world": aim_world,
		"direction": (aim_world - _origin()).normalized(),
		"profile": profile.duplicate(true),
		"mouse_retargeted": _mouse_has_moved,
	}
	cancel()
	return result


func _process(_delta: float) -> void:
	if not armed:
		return
	var mouse_screen := get_viewport().get_mouse_position()
	if not _mouse_has_moved and mouse_screen.distance_squared_to(_mouse_origin) > 9.0:
		_mouse_has_moved = true
	if _mouse_has_moved:
		aim_world = get_canvas_transform().affine_inverse() * mouse_screen
	else:
		aim_world = _snap_world
	queue_redraw()


func _draw() -> void:
	if not armed or not _uses_zone():
		return
	var origin := to_local(_origin())
	var endpoint := to_local(aim_world)
	var direction := (endpoint - origin).normalized()
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var shape := String(profile.get("aim", "area"))
	var range_value := float(profile.get("range", 180.0))
	var radius := float(profile.get("radius", 54.0))
	var edge := INVALID if bool(profile.get("invalid", false)) else EDGE
	if shape.contains("cone"):
		var half_angle := deg_to_rad(float(profile.get("cone_degrees", 70.0)) * 0.5)
		var points := PackedVector2Array([origin])
		for index: int in 18:
			var angle := lerpf(-half_angle, half_angle, float(index) / 17.0)
			points.append(origin + direction.rotated(angle) * range_value)
		draw_colored_polygon(points, FILL)
		draw_polyline(points, edge, 2.0, true)
	elif shape.contains("line"):
		var width := float(profile.get("width", 22.0))
		var normal := direction.orthogonal() * width * 0.5
		var end := origin + direction * range_value
		var points := PackedVector2Array([origin + normal, end + normal, end - normal, origin - normal])
		draw_colored_polygon(points, FILL)
		draw_polyline(PackedVector2Array([points[0], points[1], points[2], points[3], points[0]]), edge, 2.0, true)
	else:
		draw_circle(endpoint, radius, FILL)
		draw_arc(endpoint, radius, 0.0, TAU, 48, edge, 2.0, true)
		draw_line(origin, endpoint, edge * Color(1, 1, 1, 0.55), 1.0, true)


func _origin() -> Vector2:
	return source.global_position if is_instance_valid(source) else global_position


func _uses_zone() -> bool:
	var shape := String(profile.get("aim", "self"))
	return shape not in ["self", "buff", "single_target"]
