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
const BACKING_NODE := "EnvironmentWallBacking"
const TRIM_NODE := "EnvironmentWallTrim"
const FLOOR_WEAR_NODE := "EnvironmentFloorWear"
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
	# 0,x,y is dungeon_tileset_ii, the sheet the authored walls already use, so the
	# derived storey continues the same masonry instead of restating the level in a
	# second, noisier material.
	"courses": [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
	"cap": [[0, 1, 0], [0, 2, 0], [0, 3, 0]],
	"side": [[0, 1, 1], [0, 3, 1]],
	"backing": [[0, 2, 1]],
	"trim": [
		{"tiles": [[0, 5, 1], [0, 4, 1]], "light": true, "energy": 0.85, "scale": 2.0},
		{"tiles": [[0, 1, 2], [0, 2, 2], [0, 1, 3]], "light": false},
	],
	"trim_spacing": 11,
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
	_build_lights()
	var document := _level_document()
	if not document.is_empty():
		_build_floor_wear(_cell_set(document, "Backdrop"), _cell_set(document, "Geometry"))
	_build_facade()
	_build_shadows()
	if not document.is_empty():
		_build_trim(_cell_set(document, "Geometry"), _cell_set(document, "Backdrop"))


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
		if not key in level:
			continue
		var colour := _color(key, "palette")
		level.set(property, colour)
		# DungeonLevel applies its exported tints once in _ready(), so the live
		# TileMapLayers have to be repainted as well or the theme is invisible.
		var layer := level.get_node_or_null(key.capitalize()) as TileMapLayer
		if layer != null:
			layer.modulate = colour
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
# Tile entries are [source, x, y]; a bare [x, y] means the shared stone sheet.
func _tile_source(entry: Array) -> int:
	if entry.size() >= 3:
		return int(entry[0])
	return SOURCE_WALL_SHEET


func _tile_coords(entry: Array) -> Vector2i:
	if entry.size() >= 3:
		return Vector2i(int(entry[1]), int(entry[2]))
	if entry.size() == 2:
		return Vector2i(int(entry[0]), int(entry[1]))
	return Vector2i.ZERO


func _set(layer: TileMapLayer, cell: Vector2i, entry: Array) -> void:
	layer.set_cell(cell, _tile_source(entry), _tile_coords(entry))


## Cells the player can see the face of: a wall block immediately north of walkable
## floor. Everything in this file keys off this set, so the derived architecture
## can never appear where the authored map says there is open ground.
func _visible_faces(geometry: Dictionary, floor: Dictionary) -> Array[Vector2i]:
	var faces: Array[Vector2i] = []
	for cell: Vector2i in geometry:
		if floor.has(Vector2i(cell.x, cell.y + 1)):
			faces.append(cell)
	faces.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		if a.y == b.y:
			return a.x < b.x
		return a.y < b.y)
	return faces


func _build_facade() -> void:
	var document := _level_document()
	if document.is_empty():
		return
	var level := get_parent()
	var floor := _cell_set(document, "Backdrop")
	var geometry := _cell_set(document, "Geometry")
	if floor.is_empty() or geometry.is_empty():
		return
	var reference := level.get_node_or_null("Decor") as TileMapLayer
	if reference == null:
		return
	var config: Dictionary = theme.get("facade", {})

	# 1. Solid stone behind the authored wall band. Several of the authored wall
	#    tiles are decorative and carry transparent holes, so without this the
	#    "walls" let the level background through and no amount of facade above
	#    them reads as architecture. No collision: this sits behind Geometry.
	var backing: Array = config.get("backing", (DEFAULT_FACADE as Dictionary)["backing"])
	if not backing.is_empty():
		var wall := TileMapLayer.new()
		wall.name = BACKING_NODE
		wall.z_index = -9
		wall.tile_set = reference.tile_set
		wall.modulate = Color(0.80, 0.78, 0.80, 1.0)
		add_child(wall)
		for cell: Vector2i in geometry:
			if floor.has(cell):
				continue
			_set(wall, cell, backing[posmod(cell.x * 31 + cell.y * 17, backing.size())])
		wall.update_internals()

	# 2. Facade above the wall band: masonry courses plus a coping course, using
	#    the same brick the authored walls use so the derived storey reads as the
	#    continuation of the room rather than a different material.
	var rows := int(config.get("rows", (DEFAULT_FACADE as Dictionary)["rows"]))
	var courses: Array = config.get("courses", (DEFAULT_FACADE as Dictionary)["courses"])
	var cap: Array = config.get("cap", (DEFAULT_FACADE as Dictionary)["cap"])
	var side: Array = config.get("side", (DEFAULT_FACADE as Dictionary)["side"])
	if rows <= 0 or courses.is_empty():
		return
	var facade := TileMapLayer.new()
	facade.name = FACADE_NODE
	facade.z_index = -9
	facade.tile_set = reference.tile_set
	add_child(facade)

	var placed := {}
	for cell: Vector2i in _visible_faces(geometry, floor):
		# Climb over the wall band's own courses, then stack the facade on the
		# topmost stone. Without this the first probe hits the band itself.
		var top := cell.y
		while geometry.has(Vector2i(cell.x, top - 1)):
			top -= 1
		if placed.has(Vector2i(cell.x, top)):
			continue
		var stack := 0
		for step: int in range(1, rows + 1):
			var target := Vector2i(cell.x, top - step)
			if floor.has(target) or geometry.has(target) or placed.has(target):
				break
			_set(facade, target, courses[posmod(cell.x * 5 + step * 3, courses.size())])
			placed[target] = true
			stack = step
		if stack == rows:
			var cap_cell := Vector2i(cell.x, top - rows - 1)
			if not floor.has(cap_cell) and not geometry.has(cap_cell) and not placed.has(cap_cell):
				_set(facade, cap_cell, cap[posmod(cell.x * 3 + cell.y, cap.size())])
				placed[cap_cell] = true

	# 3. Side returns: one column of stone on the outside of an east/west wall so a
	#    vertical run of wall reads as having thickness, not as a painted edge.
	if not side.is_empty():
		for cell: Vector2i in geometry:
			for direction: int in [-1, 1]:
				var neighbour := Vector2i(cell.x + direction, cell.y)
				var inward := Vector2i(cell.x - direction, cell.y)
				if floor.has(neighbour) or geometry.has(neighbour) or placed.has(neighbour):
					continue
				if not (floor.has(inward) or geometry.has(inward)):
					continue
				_set(facade, neighbour, side[posmod(cell.y, side.size())])
				placed[neighbour] = true
	facade.update_internals()


## Floor wear. The authored floor is deliberately uniform so that gameplay
## markers stay readable, but a hall of 5,000 identical tiles reads as a grid.
## Scattering the sheet's own rubble and cracked slabs at a low, deterministic
## rate gives the floor history without touching collision or coverage.
func _build_floor_wear(floor: Dictionary, geometry: Dictionary) -> void:
	var config: Dictionary = theme.get("floor", {})
	var wear: Array = config.get("wear", [])
	if wear.is_empty() or floor.is_empty():
		return
	var rate := maxi(1, int(config.get("rate", 17)))
	var reference := get_parent().get_node_or_null("Decor") as TileMapLayer
	if reference == null:
		return
	var layer := TileMapLayer.new()
	layer.name = FLOOR_WEAR_NODE
	layer.z_index = -9
	layer.tile_set = reference.tile_set
	add_child(layer)
	for cell: Vector2i in floor:
		if geometry.has(cell):
			continue
		if posmod(cell.x * 7919 + cell.y * 104729, rate) != 0:
			continue
		_set(layer, cell, wear[posmod(cell.x * 13 + cell.y * 7, wear.size())])
	layer.update_internals()


## Wall-mounted dressing: torches and banners hung on the visible wall faces at a
## fixed rhythm. Collision-free by construction (the cells are already solid), and
## deterministic, so the same map always hangs the same brackets.
func _build_trim(geometry: Dictionary, floor: Dictionary) -> void:
	var config: Dictionary = theme.get("facade", {})
	var trim: Array = config.get("trim", [])
	if trim.is_empty():
		return
	var reference := get_parent().get_node_or_null("Decor") as TileMapLayer
	if reference == null:
		return
	var spacing := maxi(1, int(config.get("trim_spacing", 9)))
	var layer := TileMapLayer.new()
	layer.name = TRIM_NODE
	layer.z_index = 1
	layer.tile_set = reference.tile_set
	add_child(layer)
	var lights: Node2D = get_node_or_null(LIGHT_NODE) as Node2D
	var index := 0
	var last_x := -9999
	for cell: Vector2i in _visible_faces(geometry, floor):
		if cell.x - last_x < spacing:
			continue
		# Skip corners: a bracket hung on the very end of a run looks pinned on.
		if not geometry.has(Vector2i(cell.x - 1, cell.y)) or not geometry.has(Vector2i(cell.x + 1, cell.y)):
			continue
		var entry: Variant = trim[posmod(index, trim.size())]
		index += 1
		last_x = cell.x
		if not entry is Dictionary:
			continue
		var spec: Dictionary = entry
		var tiles: Array = spec.get("tiles", [])
		if tiles.is_empty():
			continue
		_set(layer, cell, tiles[posmod(cell.x, tiles.size())])
		if lights == null or not bool(spec.get("light", false)):
			continue
		var light := PointLight2D.new()
		light.position = Vector2(cell.x * _tile_size + _tile_size * 0.5, cell.y * _tile_size + _tile_size)
		light.texture = SpriteFramesFactory.make_radial_texture(128)
		var colour: Array = spec.get("color", [1.0, 0.72, 0.42])
		light.color = Color(float(colour[0]), float(colour[1]), float(colour[2]), 1.0)
		light.energy = float(spec.get("energy", 0.8))
		light.texture_scale = float(spec.get("scale", 1.6))
		light.shadow_enabled = false
		lights.add_child(light)
	layer.update_internals()


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
