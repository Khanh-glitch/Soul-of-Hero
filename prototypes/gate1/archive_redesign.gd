extends Node2D

## Gate 1 runtime adapter — Candidate B's archive furniture on Candidate A's
## Chapter 1 Level 3.
##
## PROTOTYPE-LOCAL. This node is added to the live `DungeonLevel` and does five
## things, none of which touch the level format:
##
##   1. it refuses to decorate any level other than Level 3;
##   2. it inserts each whole prop sprite into the level's own y-sorted
##      `Entities` container, so props occlude and are occluded exactly like
##      Candidate A's actors — no separate render layer, no z_index games;
##   3. it gives each solid prop ONE static rectangle, derived by the authoring
##      script from the sprite's rendered width, so the body can never drift
##      from the art;
##   4. it adds no TileSet source, no second Knight, no HUD, no campaign node;
##   5. it reports every refusal through `get_failures()` instead of failing
##      quietly.
##
## Everything it draws comes from `overlay_level3_archive.json`, which
## `tools/gate1/author_overlay.py` generates and validates. Nothing is placed
## or nudged at runtime.

const OVERLAY_PATH := "res://prototypes/gate1/visual_placement.json"
const EXPECTED_LEVEL := "res://data/levels/chapter_1_level_3.json"

@export var overlay_path := OVERLAY_PATH

var props_added := 0
var colliders_added := 0
var _failures: Array[String] = []


func attach_to_level(level: Node) -> bool:
	## `level` must be the live DungeonLevel for Level 3. Returns false and
	## records why if this overlay does not belong here.
	var level_path := String(level.get("level_data_path"))
	if level_path != EXPECTED_LEVEL:
		_fail("overlay targets %s but the live level is %s" % [EXPECTED_LEVEL, level_path])
		return false
	var data := _load_overlay()
	if data.is_empty():
		return false
	var container := level.get_node_or_null("Entities") as Node2D
	if container == null:
		_fail("the live level has no Entities container to sort against")
		return false
	if not container.y_sort_enabled:
		# Never silently re-order somebody else's actors: report it.
		_fail("Entities is not y-sorted, so props could not occlude correctly")
		return false
	_build(data, container, level)
	_build_architectural_material(data, level)
	return _failures.is_empty()


func _load_overlay() -> Dictionary:
	var file := FileAccess.open(overlay_path, FileAccess.READ)
	if file == null:
		_fail("cannot open %s" % overlay_path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		_fail("%s is not a JSON object" % overlay_path)
		return {}
	return parsed as Dictionary


func _build(data: Dictionary, container: Node2D, level: Node) -> void:
	var atlas_path := String(data.get("atlas", ""))
	var sheet: Texture2D = load(atlas_path)
	if sheet == null:
		_fail("cannot load the prop atlas %s" % atlas_path)
		return

	var tint_values: Array = data.get("modulate", [1.0, 1.0, 1.0, 1.0])
	var tint_alpha := 1.0
	if tint_values.size() > 3:
		tint_alpha = float(tint_values[3])
	var prop_tint := Color(
		float(tint_values[0]), float(tint_values[1]),
		float(tint_values[2]), tint_alpha
	)

	# One node owns every body, so the whole overlay can be removed in one go.
	var collision_root := Node2D.new()
	collision_root.name = "ArchiveCollision"
	add_child(collision_root)

	for entry: Dictionary in data.get("props", []):
		var region: Array = entry["source"]
		var width := float(region[2])
		var height := float(region[3])

		var sprite := Sprite2D.new()
		var texture := AtlasTexture.new()
		texture.atlas = sheet
		texture.region = Rect2(float(region[0]), float(region[1]), width, height)
		sprite.texture = texture
		sprite.centered = true
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.modulate = prop_tint
		sprite.name = String(entry.get("id", "archive_prop"))
		sprite.position = Vector2(float(entry["x"]), float(entry["base_y"]))
		# Centred sprite: lifting by half the frame height puts the art's base
		# exactly on the standing line the validator checked.
		sprite.offset = Vector2(0.0, -height * 0.5)
		container.add_child(sprite)
		props_added += 1

		if not bool(entry.get("solid", false)):
			continue
		var box: Array = entry["collider"]
		var body := StaticBody2D.new()
		body.name = "solid_" + String(entry.get("id", "prop"))
		body.collision_layer = int(data.get("collision_layer", 1))
		body.collision_mask = 0  # a wall: never queries actors
		var shape := RectangleShape2D.new()
		shape.size = Vector2(float(box[2]), float(box[3]))
		var shape_node := CollisionShape2D.new()
		shape_node.shape = shape
		# box[0..1] is the shape CENTRE in level pixels (the JSON contract).
		body.position = Vector2(float(box[0]), float(box[1]))
		body.add_child(shape_node)
		collision_root.add_child(body)
		colliders_added += 1

	print("GATE1 OVERLAY: %d props (%d solid) attached to %s"
		% [props_added, colliders_added, String(level.get("level_data_path"))])


func _fail(message: String) -> void:
	_failures.append(message)
	push_error("Gate1 overlay: " + message)


func get_failures() -> Array[String]:
	return _failures


func _build_architectural_material(data: Dictionary, level: Node) -> void:
	## Two independent VISUAL layers, separate from canonical 0x72
	## Geometry collision/TileSets. Level JSON retains sources 0/1 only.
	var art: Dictionary = data.get("material", {})
	var texture: Texture2D = load(String(art.get("atlas", "")))
	if texture == null:
		_fail("Gate1 architectural TileSet texture missing")
		return
	var atlas_source := TileSetAtlasSource.new()
	atlas_source.texture = texture
	atlas_source.texture_region_size = Vector2i(16, 16)
	var cols := texture.get_width() / 16
	var rows := texture.get_height() / 16
	for y in range(rows):
		for x in range(cols):
			atlas_source.create_tile(Vector2i(x, y))
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(16, 16)
	tile_set.add_source(atlas_source, 0)

	var floor_layer := TileMapLayer.new()
	floor_layer.name = "Gate1MaterialFloor"
	floor_layer.z_index = -8
	floor_layer.z_as_relative = false
	floor_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	floor_layer.tile_set = tile_set
	floor_layer.modulate = Color(0.84, 0.81, 0.84)
	level.add_child(floor_layer)
	for tile: Array in art.get("floor", []):
		floor_layer.set_cell(Vector2i(int(tile[0]), int(tile[1])), 0, Vector2i(int(tile[2]), int(tile[3])))

	var wall_layer := TileMapLayer.new()
	wall_layer.name = "Gate1MasonryFace"
	wall_layer.z_index = 1
	wall_layer.z_as_relative = false
	wall_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	wall_layer.tile_set = tile_set
	wall_layer.modulate = Color(0.86, 0.84, 0.88)
	level.add_child(wall_layer)
	for tile: Array in art.get("wall_face", []):
		wall_layer.set_cell(Vector2i(int(tile[0]), int(tile[1])), 0, Vector2i(int(tile[2]), int(tile[3])))

	var lamp_tex: Texture2D = load("res://prototypes/gate1/art/light_radial.png")
	if lamp_tex == null:
		_fail("Gate1 light texture missing")
		return
	for source: Dictionary in data.get("lights", []):
		var lamp := PointLight2D.new()
		lamp.name = "Gate1LocalLantern"
		lamp.texture = lamp_tex
		lamp.position = Vector2(float(source["x"]), float(source["y"]))
		lamp.energy = float(source["energy"])
		lamp.texture_scale = float(source["scale"])
		lamp.color = Color(1.0, 0.79, 0.57, 1.0)
		level.add_child(lamp)
