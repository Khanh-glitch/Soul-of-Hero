extends Control
## Schematic: only caller-disclosed normalized coordinates. Pan/zoom are visual.
signal place_selected(id: String)
var _points: Array[Dictionary] = []
var _zoom := 1.0
var _pan := Vector2.ZERO

func set_places(places: Array) -> void:
	_points.clear()
	for raw: Variant in places:
		if not raw is Dictionary or not bool(raw.get("revealed", false)): continue
		var pos: Variant = raw.get("position", null)
		if not pos is Vector2: continue
		if not is_finite(pos.x) or not is_finite(pos.y): continue
		if pos.x < 0.0 or pos.y < 0.0 or pos.x > 1.0 or pos.y > 1.0: continue
		_points.append({"id": String(raw.get("id", "")), "position": pos})
	queue_redraw()

func set_zoom(value: float, anchor := Vector2(-1, -1)) -> void:
	var focus := size * 0.5 if anchor.x < 0 else anchor
	var next := clampf(value, 1.0, 4.0)
	var local := (focus - _pan) / _zoom
	_zoom = next
	_pan = focus - local * _zoom
	_clamp_pan()
	queue_redraw()

func reset_view() -> void:
	_zoom = 1.0
	_pan = Vector2.ZERO
	queue_redraw()

func _clamp_pan() -> void:
	_pan.x = clampf(_pan.x, -size.x * (_zoom - 1.0), 0.0)
	_pan.y = clampf(_pan.y, -size.y * (_zoom - 1.0), 0.0)

func _point_position(normalized: Vector2) -> Vector2:
	return (normalized * (size - Vector2(12, 12)) + Vector2(6, 6)) * _zoom + _pan

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("202d39"), true)
	for i in range(1, 8):
		var x := size.x * i / 8.0 * _zoom + _pan.x
		if x >= 0 and x <= size.x: draw_line(Vector2(x, 0), Vector2(x, size.y), Color("314450"), 1)
	for i in range(1, 4):
		var y := size.y * i / 4.0 * _zoom + _pan.y
		if y >= 0 and y <= size.y: draw_line(Vector2(0, y), Vector2(size.x, y), Color("314450"), 1)
	for p: Dictionary in _points:
		var pos := _point_position(p.position)
		if pos.x < 4 or pos.y < 4 or pos.x > size.x - 4 or pos.y > size.y - 4: continue
		draw_rect(Rect2(pos - Vector2(4, 4), Vector2(8, 8)), Color("75d3bd"), true)
		draw_rect(Rect2(pos - Vector2(2, 2), Vector2(4, 4)), Color("f4e6c8"), true)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and event.button_mask & MOUSE_BUTTON_MASK_RIGHT:
		_pan += event.relative
		_clamp_pan()
		queue_redraw()
		accept_event()
		return
	if not event is InputEventMouseButton or not event.pressed: return
	if event.button_index == MOUSE_BUTTON_WHEEL_UP:
		set_zoom(_zoom * 1.25, event.position)
		accept_event()
		return
	if event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		set_zoom(_zoom / 1.25, event.position)
		accept_event()
		return
	if event.button_index != MOUSE_BUTTON_LEFT: return
	var best_id := ""
	var best_distance := 14.0
	for p: Dictionary in _points:
		var distance := _point_position(p.position).distance_to(event.position)
		if distance < best_distance:
			best_distance = distance
			best_id = String(p.id)
	if not best_id.is_empty():
		place_selected.emit(best_id)
		accept_event()
