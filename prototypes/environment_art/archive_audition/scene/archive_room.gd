@tool
class_name ArchiveRoom
extends Node2D

## The Monastic Archive prototype room.
##
## Everything in the room is built at runtime from `room.json`, which is produced
## by art_src/room_author.py together with the original art. There is no
## hand-painted duplicate of the layout, so the authored data, the preview
## renderer and the Godot scene cannot drift apart.
##
## Layer order (back to front):
##   Floor (-12) → FloorDecals (-11) → Water (-10) → Stairs (-10)
##   → WallFace (-6) → WallCap (-5) → WallMounts (-4) → Entities (y-sorted, 0)
##
## Collision is real: every wall cell and every `solid` prop contributes a
## StaticBody2D rectangle, and the Knight is a CharacterBody2D from the shipping
## scene, so traversal claims in the report are testable rather than asserted.

const ROOM_PATH := "res://prototypes/environment_art/archive_audition/room.json"
const TILE_ART := "res://prototypes/environment_art/archive_audition/art/archive_tiles.png"
const CAP_ART := "res://prototypes/environment_art/archive_audition/art/wall_caps.png"
const PROP_ART := "res://prototypes/environment_art/archive_audition/art/props.png"
const LIGHT_ART := "res://prototypes/environment_art/archive_audition/art/light_radial.png"
const KNIGHT_SCENE := "res://game/characters/knight/knight.tscn"

const T := 16

# Layer node names, so the capture harness can find them.
const FLOOR_LAYER := "Floor"
const DECAL_LAYER := "FloorDecals"
const WATER_LAYER := "Water"
const STAIR_LAYER := "Stairs"
const FACE_LAYER := "WallFace"
const CAP_LAYER := "WallCap"

@export var spawn_knight := true
@export var ambient_tint := Color(0.46, 0.44, 0.50, 1.0)
@export var fog_darkness := 0.55

var room: Dictionary = {}
var knight: Node2D
var camera: Camera2D

var _tile_set: TileSet
var _atlas: TileSetAtlasSource
var _cap_atlas: TileSetAtlasSource
var _prop_texture: Texture2D


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	_load_room()
	_build_layers()
	_build_walls()
	_build_props()
	_build_lights()
	if spawn_knight:
		_spawn_knight()


func _load_room() -> void:
	var file := FileAccess.open(ROOM_PATH, FileAccess.READ)
	if file == null:
		push_error("ArchiveRoom: cannot open %s" % ROOM_PATH)
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		push_error("ArchiveRoom: invalid room.json")
		return
	room = parsed


# ---------------------------------------------------------------------------
# Tile layers
# ---------------------------------------------------------------------------
func _make_sources() -> void:
	_atlas = TileSetAtlasSource.new()
	_atlas.texture = load(TILE_ART)
	_atlas.texture_region_size = Vector2i(T, T)
	# the atlas is 8 columns of 16 px tiles and as many rows as the art needs
	var rows: int = int(ceil(float(_atlas.texture.get_height()) / float(T)))
	var columns: int = int(ceil(float(_atlas.texture.get_width()) / float(T)))
	for y: int in rows:
		for x: int in columns:
			if not _atlas.has_tile(Vector2i(x, y)):
				_atlas.create_tile(Vector2i(x, y))

	_cap_atlas = TileSetAtlasSource.new()
	_cap_atlas.texture = load(CAP_ART)
	_cap_atlas.texture_region_size = Vector2i(T, T)
	for y: int in 4:
		for x: int in 4:
			_cap_atlas.create_tile(Vector2i(x, y))


func _layer(name: String, z: int, tint: Color) -> TileMapLayer:
	var layer := TileMapLayer.new()
	layer.name = name
	layer.z_index = z
	layer.z_as_relative = false
	layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	layer.modulate = tint
	# A TileSetAtlasSource may only belong to one TileSet, so every layer shares
	# this single TileSet; giving each layer its own silently broke the layers
	# built before the last one (their tiles resolved to nothing).
	layer.tile_set = _tile_set
	add_child(layer)
	return layer


func _build_layers() -> void:
	if room.is_empty():
		return
	_make_sources()
	_prop_texture = load(PROP_ART)
	_tile_set = TileSet.new()
	_tile_set.tile_size = Vector2i(T, T)
	_tile_set.add_source(_atlas, 0)
	_tile_set.add_source(_cap_atlas, 1)

	var floor_layer := _layer(FLOOR_LAYER, -12, Color(1, 1, 1))
	var decal_layer := _layer(DECAL_LAYER, -11, Color(1, 1, 1))
	var water_layer := _layer(WATER_LAYER, -10, Color(1, 1, 1))
	var stair_layer := _layer(STAIR_LAYER, -10, Color(1, 1, 1))
	var face_layer := _layer(FACE_LAYER, -6, Color(0.94, 0.92, 0.92))
	var cap_layer := _layer(CAP_LAYER, -5, Color(0.9, 0.9, 0.94))

	for cell: Array in room["layers"]["floor"]:
		floor_layer.set_cell(Vector2i(cell[0], cell[1]), 0, Vector2i(cell[3], cell[4]))
	for cell: Array in room["layers"]["decal"]:
		decal_layer.set_cell(Vector2i(cell[0], cell[1]), 0, Vector2i(cell[2], cell[3]))
	for cell: Array in room["layers"]["water"]:
		water_layer.set_cell(Vector2i(cell[0], cell[1]), 0, Vector2i(cell[2], cell[3]))
	for cell: Array in room["layers"]["stair"]:
		stair_layer.set_cell(Vector2i(cell[0], cell[1]), 0, Vector2i(cell[3], cell[4]))
	for cell: Array in room["layers"]["face"]:
		face_layer.set_cell(Vector2i(cell[0], cell[1]), 0, Vector2i(cell[2], cell[3]))
	for cell: Array in room["layers"]["cap"]:
		var mask: int = cell[2]
		cap_layer.set_cell(Vector2i(cell[0], cell[1]), 1, Vector2i(mask % 4, mask / 4))


# ---------------------------------------------------------------------------
# Collision
# ---------------------------------------------------------------------------
func _build_walls() -> void:
	var body := StaticBody2D.new()
	body.name = "WallCollision"
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	# merge horizontal runs of wall cells into single rectangles
	var rows: Dictionary = {}
	for cell: Array in room["layers"]["cap"]:
		rows.get_or_add(int(cell[1]), []).append(int(cell[0]))
	for cell: Array in room["layers"]["face"]:
		rows.get_or_add(int(cell[1]), []).append(int(cell[0]))
	for y: int in rows:
		var xs: Array = rows[y]
		xs.sort()
		var start: int = xs[0]
		var prev: int = xs[0]
		for i: int in range(1, xs.size()):
			if xs[i] == prev + 1:
				prev = xs[i]
				continue
			_add_box(body, start, y, prev - start + 1, 1)
			start = xs[i]
			prev = xs[i]
		_add_box(body, start, y, prev - start + 1, 1)


func _add_box(body: StaticBody2D, x: int, y: int, w: int, h: int) -> void:
	var shape := RectangleShape2D.new()
	shape.size = Vector2(w * T, h * T)
	var collider := CollisionShape2D.new()
	collider.shape = shape
	collider.position = Vector2(x * T + w * T * 0.5, y * T + h * T * 0.5)
	body.add_child(collider)


# ---------------------------------------------------------------------------
# Props
# ---------------------------------------------------------------------------
func _build_props() -> void:
	var wall_mounts := _sorted_container("WallMounts", -4)
	wall_mounts.z_as_relative = false
	for item: Dictionary in room["wall_items"]:
		var sprite := _sprite(item["source"])
		var cell: Array = item["cell"]
		var src: Array = item["source"]
		sprite.position = Vector2(
			float(cell[0]) * T + T * 0.5,
			float(cell[1]) * T + T,
		)
		sprite.offset = Vector2(0.0, -float(src[3]))
		wall_mounts.add_child(sprite)

	var entities := _sorted_container("Entities", 0)
	entities.y_sort_enabled = true
	for prop: Dictionary in room["props"]:
		var source: Array = prop["source"]
		var sprite := _sprite(source)
		sprite.name = "%s_%d_%d" % [prop["sprite"], prop["cell"][0], prop["cell"][1]]
		sprite.position = Vector2(float(prop["x"]), float(prop["y"]))
		sprite.offset = Vector2(0.0, -float(source[3]))
		entities.add_child(sprite)
		if bool(prop.get("solid", false)):
			var body := StaticBody2D.new()
			body.collision_layer = 1
			body.collision_mask = 0
			var shape := RectangleShape2D.new()
			shape.size = Vector2(
				float(source[2]) * 0.62,
				min(float(source[3]) * 0.42, float(T) * 1.2)
			)
			var collider := CollisionShape2D.new()
			collider.shape = shape
			collider.position = Vector2(
				float(prop["x"]), float(prop["y"]) - shape.size.y * 0.5
			)
			body.add_child(collider)
			entities.add_child(body)


func _sprite(source: Array) -> Sprite2D:
	var atlas := AtlasTexture.new()
	atlas.atlas = _prop_texture
	atlas.region = Rect2(source[0], source[1], source[2], source[3])
	var sprite := Sprite2D.new()
	sprite.texture = atlas
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.centered = true
	return sprite


func _sorted_container(name: String, z: int) -> Node2D:
	var node := Node2D.new()
	node.name = name
	node.z_index = z
	node.z_as_relative = false
	add_child(node)
	return node


# ---------------------------------------------------------------------------
# Lighting
# ---------------------------------------------------------------------------
func _build_lights() -> void:
	var modulate_node := CanvasModulate.new()
	modulate_node.name = "RoomAmbient"
	modulate_node.color = ambient_tint
	add_child(modulate_node)

	var radial: Texture2D = load(LIGHT_ART)
	var holder := Node2D.new()
	holder.name = "Lights"
	holder.z_index = 30
	holder.z_as_relative = false
	add_child(holder)
	for light: Dictionary in room["lights"]:
		var lamp := PointLight2D.new()
		lamp.texture = radial
		var colour: Array = light["color"]
		lamp.color = Color(float(colour[0]), float(colour[1]), float(colour[2]))
		lamp.energy = float(light["energy"])
		lamp.texture_scale = float(light["scale"])
		lamp.position = Vector2(float(light["x"]), float(light["y"]))
		lamp.shadow_enabled = false
		lamp.blend_mode = Light2D.BLEND_MODE_ADD
		holder.add_child(lamp)


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------
func _spawn_knight() -> void:
	var packed: PackedScene = load(KNIGHT_SCENE)
	if packed == null:
		push_error("ArchiveRoom: knight scene missing")
		return
	knight = packed.instantiate() as Node2D
	knight.name = "Knight"
	var spawn: Array = room["spawn"]
	knight.position = Vector2(float(spawn[0]), float(spawn[1]))
	var entities := get_node_or_null("Entities") as Node2D
	if entities != null:
		entities.add_child(knight)
	else:
		add_child(knight)
	camera = knight.get_node_or_null("Camera") as Camera2D
	if camera != null:
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = int(room["width"]) * T
		camera.limit_bottom = int(room["height"]) * T
		camera.position_smoothing_enabled = false
		camera.limit_smoothed = false
		camera.enabled = true
		camera.make_current()
		camera.reset_smoothing()


func place_knight(cell_or_px: Vector2) -> void:
	if knight == null:
		return
	knight.global_position = cell_or_px


func camera_point(name: String) -> Vector2:
	var points: Dictionary = room.get("camera_points", {})
	if not points.has(name):
		return Vector2.ZERO
	var point: Array = points[name]
	return Vector2(float(point[0]), float(point[1]))
