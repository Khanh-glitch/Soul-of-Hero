class_name SurvivalRoofLayer
extends Node2D

## Developer-placeholder shingle roofs, derived from the same room topology as
## the construction system. Purely visual: collision always belongs to pieces.
## A doorway retains the previous room until the Hero leaves the threshold.
const TILE := 16
const FADE_SECONDS := 0.22
const EXIT_GRACE := 0.18

var build: Node2D
var hero: Node2D
var topology: RefCounted
var _footprints: Dictionary = {}
var _alpha: Dictionary = {}
var _revision := -1
var _current_room := ""
var _exit_grace := 0.0


func configure(build_ref: Node2D, hero_ref: Node2D, topology_ref: RefCounted) -> void:
	build = build_ref
	hero = hero_ref
	topology = topology_ref
	z_index = 30
	z_as_relative = false
	_refresh_geometry()


func _refresh_geometry() -> void:
	if topology == null or build == null:
		return
	var rooms: Dictionary = topology.get("rooms")
	var next: Dictionary = {}
	for raw_id: Variant in rooms.keys():
		var room_id := String(raw_id)
		var footprint: Dictionary = {}
		for cell: Vector2i in rooms[raw_id]:
			footprint[cell] = true
			# Wall/door boundary tiles provide a coherent silhouette. Shared
			# boundary tiles can be drawn by either roof, never another interior.
			for dy in range(-1, 2):
				for dx in range(-1, 2):
					var neighbour := cell + Vector2i(dx, dy)
					var entity_id: String = build.call(&"entity_at_layer", neighbour, "object")
					if entity_id.is_empty():
						continue
					var piece: Node = build.call(&"structure_node", entity_id)
					if piece != null and String(piece.get("piece_id")) in ["wall_wood", "door_wood"]:
						footprint[neighbour] = true
		next[room_id] = footprint
		if not _alpha.has(room_id):
			_alpha[room_id] = 0.0 if _hero_room() == room_id else 1.0
	for raw_id: Variant in _alpha.keys().duplicate():
		if not next.has(raw_id):
			_alpha.erase(raw_id)
	_footprints = next
	_revision = int(topology.get("revision"))
	if not _footprints.has(_current_room):
		_current_room = ""
	queue_redraw()


func _hero_room() -> String:
	if hero == null or not is_instance_valid(hero) or topology == null:
		return ""
	var cell := Vector2i(floori(hero.global_position.x / TILE), floori(hero.global_position.y / TILE))
	return String(topology.call(&"room_at", cell))


func _in_doorway() -> bool:
	if hero == null or not is_instance_valid(hero) or build == null:
		return false
	var cell := Vector2i(floori(hero.global_position.x / TILE), floori(hero.global_position.y / TILE))
	var entity_id: String = build.call(&"entity_at_layer", cell, "object")
	if entity_id.is_empty():
		return false
	var piece: Node = build.call(&"structure_node", entity_id)
	return piece != null and String(piece.get("piece_id")) == "door_wood"


func _process(delta: float) -> void:
	if topology == null:
		return
	if int(topology.get("revision")) != _revision:
		_refresh_geometry()
	var actual := _hero_room()
	if not actual.is_empty():
		_current_room = actual
		_exit_grace = EXIT_GRACE
	elif _in_doorway() and not _current_room.is_empty():
		_exit_grace = EXIT_GRACE
	elif _exit_grace > 0.0:
		_exit_grace = maxf(0.0, _exit_grace - delta)
	else:
		_current_room = ""
	var changed := false
	for raw_id: Variant in _alpha.keys():
		var room_id := String(raw_id)
		var previous := float(_alpha[room_id])
		var target := 0.0 if room_id == _current_room else 1.0
		var value := move_toward(previous, target, delta / FADE_SECONDS)
		if not is_equal_approx(previous, value):
			_alpha[room_id] = value
			changed = true
	if changed:
		queue_redraw()


func alpha_for(room_id: String) -> float:
	return float(_alpha.get(room_id, -1.0))


func _draw() -> void:
	# Programmatic art is explicitly a developer placeholder, not a licensed kit.
	for raw_id: Variant in _footprints.keys():
		var room_id := String(raw_id)
		var alpha := float(_alpha.get(room_id, 1.0))
		if alpha <= 0.001:
			continue
		var footprint: Dictionary = _footprints[raw_id]
		for raw_cell: Variant in footprint.keys():
			var cell: Vector2i = raw_cell
			var origin := Vector2(cell * TILE)
			draw_rect(Rect2(origin, Vector2(TILE, TILE)), Color(0.25, 0.22, 0.29, alpha))
			for row in range(0, TILE, 4):
				draw_rect(Rect2(origin + Vector2(0, row), Vector2(TILE, 1)), Color(0.16, 0.14, 0.20, alpha))
				draw_rect(Rect2(origin + Vector2(0, row + 1), Vector2(TILE, 1)), Color(0.35, 0.31, 0.40, alpha))
				var seam := 3 if row == 0 or row == 8 else 11
				draw_rect(Rect2(origin + Vector2(seam, row + 1), Vector2(1, 3)), Color(0.18, 0.16, 0.22, alpha))
			if not footprint.has(cell + Vector2i(0, 1)):
				draw_rect(Rect2(origin + Vector2(0, 14), Vector2(TILE, 2)), Color(0.14, 0.12, 0.17, alpha))
