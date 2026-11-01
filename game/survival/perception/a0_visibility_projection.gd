class_name A0VisibilityProjection
extends RefCounted
## RESEARCH PILOT ONLY: bounded player-knowledge projection over EXISTING world cells.
##
## Does not author terrain, darkness, AI navigation, enemy sensors or SaveService.
## A0 must inject a read-only *sight opacity* callback backed by live A1/A8 geometry
## and dynamic doors. Walkability is NOT an opacity substitute: water is allowed
## to block walking while remaining visually transparent.
##
## Source inspiration: user-supplied prototype navigation.ts (PreciseShadowcasting).
## This GDScript uses conservative integer supercover LOS, NOT a port of rot-js.
## Do not claim visual or production parity until a real-world integration.
##
## One visibility state per cell: 0 UNKNOWN, 1 REMEMBERED, 2 CURRENTLY_VISIBLE.
## A remembered cell never grants fresh live entity/status observations.
## Only A0 SaveService may own a durable run-local snapshot of discovered indices.

const UNKNOWN := 0
const REMEMBERED := 1
const CURRENT := 2
const MAX_RADIUS := 32

var _size := Vector2i.ZERO
var _opacity_query: Callable = Callable()
var _visible: Dictionary = {}
var _discovered: Dictionary = {}
var _last_origin := Vector2i(-1, -1)
var _last_radius := -1
var _dirty := true
var last_error := ""


func configure(world_size: Vector2i, opacity_query: Callable) -> bool:
	last_error = ""
	if world_size.x <= 0 or world_size.y <= 0:
		last_error = "INVALID_WORLD_BOUNDS"
		return false
	if not opacity_query.is_valid():
		last_error = "MISSING_LIVE_OPACITY_AUTHORITY"
		return false
	_size = world_size
	_opacity_query = opacity_query
	_visible.clear()
	_discovered.clear()
	_last_origin = Vector2i(-1, -1)
	_last_radius = -1
	_dirty = true
	return true


func invalidate() -> void:
	## A0 must call on door/structure/chunk/lighting-geometry changes.
	_dirty = true


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < _size.x and cell.y < _size.y


func _is_opaque(cell: Vector2i) -> bool:
	if not in_bounds(cell) or not _opacity_query.is_valid():
		return true
	var answer: Variant = _opacity_query.call(cell)
	## A missing or malformed source reading fails CLOSED, not transparent.
	return true if typeof(answer) != TYPE_BOOL else bool(answer)


func has_line_of_sight(start: Vector2i, target: Vector2i, max_distance: int) -> bool:
	if not in_bounds(start) or not in_bounds(target):
		return false
	if max_distance < 0 or max_distance > MAX_RADIUS:
		return false
	var diff := target - start
	if diff.length_squared() > max_distance * max_distance:
		return false
	if start == target:
		return true
	var step_x := signi(diff.x)
	var step_y := signi(diff.y)
	var count_x := absi(diff.x)
	var count_y := absi(diff.y)
	var crossed_x := 0
	var crossed_y := 0
	var position := start
	## Integer supercover ray. At an exact corner, two opaque orthogonal
	## neighbours prevent diagonal vision. A solid target wall itself is visible.
	while crossed_x < count_x or crossed_y < count_y:
		var lhs := (1 + 2 * crossed_x) * count_y
		var rhs := (1 + 2 * crossed_y) * count_x
		if lhs == rhs:
			if _is_opaque(position + Vector2i(step_x, 0)) and _is_opaque(position + Vector2i(0, step_y)):
				return false
			position += Vector2i(step_x, step_y)
			crossed_x += 1
			crossed_y += 1
		elif lhs < rhs:
			position.x += step_x
			crossed_x += 1
		else:
			position.y += step_y
			crossed_y += 1
		if position != target and _is_opaque(position):
			return false
	return true


func refresh(origin: Vector2i, radius: int) -> bool:
	## Event-driven: no blind every-render-frame re-scan across the continent.
	## Caller must invalidate when live occlusion geometry changes.
	if not in_bounds(origin):
		last_error = "ORIGIN_OUT_OF_BOUNDS"
		_visible.clear()
		_last_origin = Vector2i(-1, -1)
		_dirty = true
		return false
	if radius < 0 or radius > MAX_RADIUS:
		last_error = "RADIUS_OUT_OF_BOUNDS"
		return false
	if not _opacity_query.is_valid():
		last_error = "MISSING_LIVE_OPACITY_AUTHORITY"
		return false
	if not _dirty and origin == _last_origin and radius == _last_radius:
		return false
	last_error = ""
	_visible.clear()
	for dy in range(-radius, radius + 1):
		for dx in range(-radius, radius + 1):
			if dx * dx + dy * dy > radius * radius:
				continue
			var cell := origin + Vector2i(dx, dy)
			if in_bounds(cell) and has_line_of_sight(origin, cell, radius):
				_visible[cell] = true
				_discovered[cell] = true
	_last_origin = origin
	_last_radius = radius
	_dirty = false
	return true


func visibility_state(cell: Vector2i) -> int:
	if not in_bounds(cell):
		return UNKNOWN
	if _visible.has(cell):
		return CURRENT
	return REMEMBERED if _discovered.has(cell) else UNKNOWN


func can_show_live_entity(cell: Vector2i) -> bool:
	## Enemies, bags, footprints, source stock, damaged structures, vendor status,
	## gate state, drops, portable equipment, and FX MUST use this.
	return visibility_state(cell) == CURRENT


func can_show_static_knowledge(cell: Vector2i) -> bool:
	## Only known inert topology may be drawn from exploration memory.
	return visibility_state(cell) != UNKNOWN


func visible_count() -> int:
	return _visible.size()


func discovered_count() -> int:
	return _discovered.size()


func discovered_indices_snapshot() -> PackedInt32Array:
	## Run-local data payload for A0 to *consider* persisting through its own
	## SaveService. This projection NEVER writes a save.
	var ids: Array[int] = []
	for raw_cell: Variant in _discovered.keys():
		var cell: Vector2i = raw_cell
		ids.append(cell.y * _size.x + cell.x)
	ids.sort()
	return PackedInt32Array(ids)


func load_run_local_discovered(snapshot: PackedInt32Array) -> void:
	## Called ONLY after A0 validates the active run identity and save scope.
	_discovered.clear()
	_visible.clear()
	for index: int in snapshot:
		if index < 0 or index >= _size.x * _size.y:
			continue
		_discovered[Vector2i(index % _size.x, floori(float(index) / float(_size.x)))] = true
	_last_origin = Vector2i(-1, -1)
	_last_radius = -1
	_dirty = true


func clear_for_new_run() -> void:
	_discovered.clear()
	_visible.clear()
	_last_origin = Vector2i(-1, -1)
	_last_radius = -1
	_dirty = true
