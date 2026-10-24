class_name Chapter1EnvironmentArt
extends Node2D

## Chapter 1 environment presentation layer.
##
## This node is attached to a live `DungeonLevel` and builds the architecture
## *around* the authored gameplay map without touching it: a taller stone facade
## above every visible wall face, contact shadows where walls meet the floor,
## warm light pools at authored landmarks, and a per-level palette.
##
## Why it exists: the authored level JSON is the gameplay authority (collision,
## entities, tests, byte-identical generator output) and must not be rewritten to
## make a room look built. Everything here is derived deterministically from that
## JSON plus one small theme document per level, so the same source revision
## always produces the same picture and no gameplay contract moves.
##
## Layering (matches the level scene's own z-order):
##   Backdrop  -10   authored floor
##   Facade     -9   derived wall mass (this node)
##   Shadow     -5   derived contact shadow (this node)
##   Geometry    0   authored collision walls
##   Decor       2   authored props
##   Entities    3   Knight, enemies, interactables
##
## Nothing in this layer has collision. A prop that is meant to be solid must be
## authored into the level JSON's Geometry layer instead, where the collision
## tileset and the route tests can see it.

const SpriteFramesFactory := preload("res://game/world/sprite_frame_factory.gd")

const THEME_DIR := "res://data/environment/chapter1"
const FACADE_NODE := "EnvironmentFacade"
const SHADOW_NODE := "EnvironmentShadow"
const LIGHT_NODE := "EnvironmentLights"

const SOURCE_WALL_SHEET := 1   # atlas_walls_low.png, the chapter's shared stone


class _ShadowPainter extends Node2D:
	var colour := Color(0, 0, 0, 0.45)
	var tile_size := 16
	var strips: Array = []

	func _draw() -> void:
		for strip: Rect2 in strips:
			draw_rect(strip, colour, true)

## Defaults used when a theme omits a value. Deliberately warm: the reference
## chapters read as lit masonry, not as a blue-grey tile sheet.
const DEFAULT_PALETTE := {
	"backdrop": [0.70, 0.62, 0.58],
	"geometry": [0.88, 0.76, 0.64],
	"decor": [0.95, 0.86, 0.76],
	"world": [0.78, 0.72, 0.70],
	"background": [0.05, 0.035, 0.04],
}
const DEFAULT_FACADE := {
	"rows": 2,
	"body": [[2, 2], [1, 2], [3, 2], [2, 3]],
	"cap": [[2, 0], [10, 0]],
	"side": [[1, 1], [3, 1]],
	"thickness": 1,
}
const DEFAULT_SHADOW := {"color": [0.0, 0.0, 0.0, 0.46], "depth": 7, "side": 4}

## Landmark lights are derived from the authored entities, not hand-placed: an
## objective that the player must find gets a light, so the lighting cannot drift
## away from the gameplay that the frozen suites validate.
const ENTITY_LIGHTS := {
	"sigil": {"color": [1.0, 0.78, 0.42], "energy": 0.85, "scale": 2.2},
	"checkpoint": {"color": [0.62, 0.82, 1.0], "energy": 0.75, "scale": 2.6},
	"exit_gate": {"color": [1.0, 0.86, 0.55], "energy": 1.0, "scale": 3.2},
	"chest": {"color": [1.0, 0.80, 0.45], "energy": 0.55, "scale": 1.8},
	"hooded_archer_miniboss": {"color": [1.0, 0.55, 0.35], "energy": 0.9, "scale": 3.0},
	"vampire": {"color": [0.95, 0.40, 0.45], "energy": 0.8, "scale": 2.6},
	"vampire_castellan": {"color": [1.0, 0.35, 0.40], "energy": 1.1, "scale": 3.4},
}

var level_data_path := ""
var theme: Dictionary = {}
var _tile_size := 16


static func theme_path_for(level_path: String) -> String:
	return "%s/%s.json" % [THEME_DIR, level_path.get_file().get_basename()]


static func has_theme(level_path: String) -> bool:
	return FileAccess.file_exists(theme_path_for(level_path))


## Attach (or refresh) the presentation layer for a level. Safe to call again
## after a map reload: the previous children are freed first.
static func attach(level: Node) -> Chapter1EnvironmentArt:
	if level == null or not level.has_method("get_level_snapshot"):
		return null
	if bool(Engine.get_meta(&"chapter1_art_disabled", false)):
		# Capture harnesses use this to photograph the same map without the art
		# layer. It disables presentation only; geometry, collision, entities and
		# HUD are untouched, so the pair is a true A/B of the art system.
		return null
	var path := String(level.get("level_data_path"))
	if path.is_empty() or not has_theme(path):
		return null
	var existing := level.get_node_or_null(NodePath("EnvironmentArt")) as Chapter1EnvironmentArt
	if existing != null:
		existing.rebuild()
		return existing
	var layer := Chapter1EnvironmentArt.new()
	layer.name = "EnvironmentArt"
	layer.level_data_path = path
	level.add_child(layer)
	layer.rebuild()
	return layer


func rebuild() -> void:
	theme = _load_theme(level_data_path)
	_tile_size = int(theme.get("tile_size", 16))
	_clear_children()
	_apply_palette()
	_build_facade()
	_build_shadows()
	_build_lights()


# -- theme -------------------------------------------------------------------
func _load_theme(path: String) -> Dictionary:
	var theme_path := theme_path_for(path)
	if not FileAccess.file_exists(theme_path):
		return {}
	var file := FileAccess.open(theme_path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _level_document() -> Dictionary:
	var level := get_parent()
	if level == null or not level.has_method("get_level_snapshot"):
		return {}
	var document: Variant = level.get("level_data")
	return document if document is Dictionary else {}


func _color(key: String, table: String) -> Color:
	var source: Dictionary = theme.get(table, {})
	var raw: Variant = source.get(key, (DEFAULT_PALETTE as Dictionary).get(key, []))
	return _to_color(raw, Color.WHITE)


static func _to_color(raw: Variant, fallback: Color) -> Color:
	if raw is Array and (raw as Array).size() >= 3:
		var channels: Array = raw as Array
		return Color(
			float(channels[0]),
			float(channels[1]),
			float(channels[2]),
			float(channels[3]) if channels.size() >= 4 else 1.0,
		)
	return fallback


func _clear_children() -> void:
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()


# -- palette -----------------------------------------------------------------
func _apply_palette() -> void:
	var level := get_parent()
	if level == null:
		return
	for property: String in ["backdrop_tint", "geometry_tint", "decor_tint"]:
		var key := property.replace("_tint", "")
		if key in level:
			level.set(property, _color(key, "palette"))
	var host := level.get_parent()
	if host == null:
		return
	var world_tint := host.get_node_or_null("WorldTint") as CanvasModulate
	if world_tint != null:
		world_tint.color = _color("world", "palette")
	var background := host.get_node_or_null("Background/Color") as Polygon2D
	if background != null:
		background.color = _color("background", "palette")


# -- architecture ------------------------------------------------------------
func _build_facade() -> void:
	var document := _level_document()
	if document.is_empty():
		return
	var level := get_parent()
	var floor := _cell_set(document, "Backdrop")
	var geometry := _cell_set(document, "Geometry")
	if floor.is_empty():
		return
	var config: Dictionary = theme.get("facade", {})
	var rows := int(config.get("rows", (DEFAULT_FACADE as Dictionary)["rows"]))
	var body: Array = config.get("body", (DEFAULT_FACADE as Dictionary)["body"])
	var cap: Array = config.get("cap", (DEFAULT_FACADE as Dictionary)["cap"])
	var side: Array = config.get("side", (DEFAULT_FACADE as Dictionary)["side"])
	if rows <= 0 or body.is_empty():
		return

	var facade := TileMapLayer.new()
	facade.name = FACADE_NODE
	facade.z_index = -9
	var reference := level.get_node_or_null("Decor") as TileMapLayer
	if reference == null:
		return
	facade.tile_set = reference.tile_set
	add_child(facade)

	# A wall cell whose south neighbour is floor is a wall the player sees the
	# face of. Extend that face upward so the room sits inside a building
	# instead of floating in the level background.
	var placed := {}
	for cell: Vector2i in geometry:
		var below := Vector2i(cell.x, cell.y + 1)
		if not floor.has(below):
			continue
		var stack := 0
		for step: int in range(1, rows + 1):
			var target := Vector2i(cell.x, cell.y - step)
			if floor.has(target) or geometry.has(target) or placed.has(target):
				break
			var tile: Array = body[posmod(cell.x * 7 + cell.y * 13 + step * 5, body.size())]
			facade.set_cell(target, SOURCE_WALL_SHEET, Vector2i(int(tile[0]), int(tile[1])))
			placed[target] = true
			stack = step
		if stack == rows:
			var cap_cell := Vector2i(cell.x, cell.y - rows - 1)
			if not floor.has(cap_cell) and not geometry.has(cap_cell) and not placed.has(cap_cell):
				var cap_tile: Array = cap[posmod(cell.x * 3 + cell.y, cap.size())]
				facade.set_cell(cap_cell, SOURCE_WALL_SHEET, Vector2i(int(cap_tile[0]), int(cap_tile[1])))

	# Side returns: one column of stone on the outside of an east/west wall so a
	# vertical run of wall reads as having thickness rather than as a painted edge.
	if not side.is_empty():
		for cell: Vector2i in geometry:
			for direction: int in [-1, 1]:
				var neighbour := Vector2i(cell.x + direction, cell.y)
				var inward := Vector2i(cell.x - direction, cell.y)
				if floor.has(neighbour) or geometry.has(neighbour) or placed.has(neighbour):
					continue
				if not (floor.has(inward) or geometry.has(inward)):
					continue
				var tile: Array = side[posmod(cell.x * 11 + cell.y * 5, side.size())]
				facade.set_cell(neighbour, SOURCE_WALL_SHEET, Vector2i(int(tile[0]), int(tile[1])))
				placed[neighbour] = true
	facade.update_internals()


func _cell_set(document: Dictionary, layer_name: String) -> Dictionary:
	var layers: Dictionary = document.get("layers", {})
	var raw: Variant = layers.get(layer_name, [])
	var cells := {}
	if not raw is Array:
		return cells
	for entry: Variant in raw:
		if entry is Dictionary and (entry as Dictionary).has("x"):
			cells[Vector2i(int((entry as Dictionary)["x"]), int((entry as Dictionary)["y"]))] = true
	return cells


# -- contact shadow ----------------------------------------------------------
func _build_shadows() -> void:
	var document := _level_document()
	if document.is_empty():
		return
	var floor := _cell_set(document, "Backdrop")
	var geometry := _cell_set(document, "Geometry")
	if floor.is_empty():
		return
	var config: Dictionary = theme.get("shadow", {})
	var colour := _to_color(config.get("color", (DEFAULT_SHADOW as Dictionary)["color"]), Color(0, 0, 0, 0.45))
	var depth := int(config.get("depth", (DEFAULT_SHADOW as Dictionary)["depth"]))
	var side := int(config.get("side", (DEFAULT_SHADOW as Dictionary)["side"]))

	var shadow := _ShadowPainter.new()
	shadow.name = SHADOW_NODE
	shadow.z_index = -5
	shadow.colour = colour
	shadow.tile_size = _tile_size
	var strips: Array = []
	for cell: Vector2i in floor:
		if geometry.has(Vector2i(cell.x, cell.y - 1)):
			strips.append(Rect2(
				float(cell.x * _tile_size),
				float(cell.y * _tile_size),
				float(_tile_size),
				float(depth),
			))
		if geometry.has(Vector2i(cell.x - 1, cell.y)):
			strips.append(Rect2(
				float(cell.x * _tile_size),
				float(cell.y * _tile_size),
				float(side),
				float(_tile_size),
			))
		if geometry.has(Vector2i(cell.x + 1, cell.y)):
			strips.append(Rect2(
				float(cell.x * _tile_size + _tile_size - side),
				float(cell.y * _tile_size),
				float(side),
				float(_tile_size),
			))
	shadow.strips = strips
	add_child(shadow)


# -- light -------------------------------------------------------------------
func _build_lights() -> void:
	var entries: Variant = theme.get("lights", [])
	if not entries is Array or (entries as Array).is_empty():
		entries = _derived_lights()
	if not entries is Array:
		return
	var lights := Node2D.new()
	lights.name = LIGHT_NODE
	lights.z_index = 1
	add_child(lights)
	var texture := SpriteFramesFactory.make_radial_texture(128)
	for raw: Variant in entries:
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw as Dictionary
		var cell_raw: Variant = entry.get("cell", [])
		if not cell_raw is Array or (cell_raw as Array).size() < 2:
			continue
		var light := PointLight2D.new()
		light.texture = texture
		light.position = Vector2(
			float(int((cell_raw as Array)[0]) * _tile_size) + _tile_size * 0.5,
			float(int((cell_raw as Array)[1]) * _tile_size) + _tile_size * 0.5,
		)
		light.color = _to_color(entry.get("color", [1.0, 0.62, 0.32]), Color(1, 0.62, 0.32))
		light.energy = float(entry.get("energy", 0.9))
		light.texture_scale = float(entry.get("scale", 2.4))
		# Shadows on many overlapping lights are expensive and can hide hazards;
		# only authored landmark lights that ask for it cast them.
		light.shadow_enabled = bool(entry.get("shadow", false))
		lights.add_child(light)


func _derived_lights() -> Array:
	var document := _level_document()
	var entities: Variant = document.get("entities", [])
	var entries: Array = []
	if not entities is Array:
		return entries
	for raw: Variant in entities:
		if not raw is Dictionary:
			continue
		var entity: Dictionary = raw as Dictionary
		var kind := String(entity.get("type", ""))
		if not ENTITY_LIGHTS.has(kind):
			continue
		var config: Dictionary = ENTITY_LIGHTS[kind]
		var position: Variant = entity.get("position", [])
		if not position is Array or (position as Array).size() < 2:
			continue
		var cell := Vector2i(
			int((position as Array)[0]) / _tile_size,
			int((position as Array)[1]) / _tile_size,
		)
		entries.append({
			"cell": [cell.x, cell.y],
			"color": config.get("color", [1.0, 0.7, 0.4]),
			"energy": config.get("energy", 0.8),
			"scale": config.get("scale", 2.4),
		})
	return entries
