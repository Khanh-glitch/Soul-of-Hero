extends Node2D

## Gate 2 runtime adapter — the archive's architecture and material on Candidate
## A's Chapter 1 Level 3.
##
## PROTOTYPE-LOCAL, exactly like Gate 0's overlay and Gate 1's redesign. This
## node is added to the live `DungeonLevel` and does five things, none of which
## change the level format:
##
##   1. it refuses to dress any level other than Chapter 1 Level 3;
##   2. it inserts each whole prop sprite into the level's own y-sorted
##      `Entities` container, so props occlude and are occluded exactly like
##      Candidate A's actors — no separate render layer, no z_index games;
##   3. it gives each solid prop ONE static rectangle, derived by the authoring
##      script from the sprite's own rendered width, so the body can never drift
##      from the art;
##   4. it composites the material layers (vault, floor, garth water, wall faces,
##      contact shadow, weather) OVER the level's own layers in separate
##      TileMapLayers, leaving the authored JSON, its TileSet sources and its
##      collision byte-identical;
##   5. it adds no second Knight, no HUD, no campaign node, and reports every
##      refusal through `get_failures()` instead of failing quietly.
##
## Everything it draws comes from `visual_placement.json`, which
## `tools/gate2/author_gate2.py` generates and validates. Nothing is placed or
## nudged at runtime.

const PLACEMENT_PATH := "res://prototypes/gate2/visual_placement.json"
const EXPECTED_LEVEL := "res://data/levels/chapter_1_level_3.json"

## Draw order, bottom to top. `layer_style` in the document carries each one's
## z_index and modulate; this list only fixes the order they are created in.
const MATERIAL_ORDER: Array[String] = [
	"vault_b5", "vault_b4", "vault_b3", "vault_b2", "vault_b1",
	"floor", "water", "water_edge", "shadow", "weather",
	"mass", "wall_face",
]

@export var placement_path := PLACEMENT_PATH

var props_added := 0
var colliders_added := 0
var material_layers_added := 0
var lights_added := 0
var _failures: Array[String] = []


func attach_to_level(level: Node) -> bool:
	## `level` must be the live DungeonLevel for Level 3. Returns false and
	## records why if this overlay does not belong here.
	var level_path := String(level.get("level_data_path"))
	if level_path != EXPECTED_LEVEL:
		_fail("overlay targets %s but the live level is %s" % [EXPECTED_LEVEL, level_path])
		return false
	var data := _load_placement()
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
	_build_props(data, container)
	_build_material(data, level)
	_build_lights(data, level)
	return _failures.is_empty()


func _load_placement() -> Dictionary:
	var file := FileAccess.open(placement_path, FileAccess.READ)
	if file == null:
		_fail("cannot open %s" % placement_path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		_fail("%s is not a JSON object" % placement_path)
		return {}
	return parsed as Dictionary


# ----------------------------------------------------------------- props ------

func _build_props(data: Dictionary, container: Node2D) -> void:
	var atlas_path := String(data.get("atlas", ""))
	var sheet: Texture2D = load(atlas_path)
	if sheet == null:
		_fail("cannot load the prop atlas %s" % atlas_path)
		return

	var tint_values: Array = data.get("modulate", [1.0, 1.0, 1.0, 1.0])
	var prop_tint := Color(
		float(tint_values[0]), float(tint_values[1]),
		float(tint_values[2]), float(tint_values[3]) if tint_values.size() > 3 else 1.0
	)

	# One node owns every body, so the whole overlay can be removed in one go.
	var collision_root := Node2D.new()
	collision_root.name = "Gate2Collision"
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
		sprite.name = String(entry.get("id", "gate2_prop"))
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

	print("GATE2 PROPS: %d sprites (%d solid) attached to %s"
		% [props_added, colliders_added, String(container.get_path())])


# -------------------------------------------------------------- material ------

func _build_material(data: Dictionary, level: Node) -> void:
	var art: Dictionary = data.get("material", {})
	var texture: Texture2D = load(String(art.get("atlas", "")))
	if texture == null:
		_fail("Gate2 material TileSet texture missing")
		return
	var tile := int(art.get("tile", 16))

	var atlas_source := TileSetAtlasSource.new()
	atlas_source.texture = texture
	atlas_source.texture_region_size = Vector2i(tile, tile)
	for y: int in range(texture.get_height() / tile):
		for x: int in range(texture.get_width() / tile):
			atlas_source.create_tile(Vector2i(x, y))
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(tile, tile)
	tile_set.add_source(atlas_source, 0)

	var style: Dictionary = art.get("layer_style", {})
	for role: String in MATERIAL_ORDER:
		var tiles: Array = art.get(role, [])
		if tiles.is_empty():
			continue
		var layer := TileMapLayer.new()
		layer.name = "Gate2_" + role
		var entry: Dictionary = style.get(role, {})
		layer.z_index = int(entry.get("z", 0))
		layer.z_as_relative = false
		layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		layer.tile_set = tile_set
		var tint: Array = entry.get("modulate", [1.0, 1.0, 1.0, 1.0])
		layer.modulate = Color(float(tint[0]), float(tint[1]), float(tint[2]), float(tint[3]))
		level.add_child(layer)
		material_layers_added += 1
		var applied := 0
		for cell: Array in tiles:
			layer.set_cell(Vector2i(int(cell[0]), int(cell[1])), 0,
				Vector2i(int(cell[2]), int(cell[3])))
			applied += 1
		if applied != layer.get_used_cells().size():
			_fail("%s applied %d of %d authored cells"
				% [layer.name, applied, layer.get_used_cells().size()])
		print("GATE2 MATERIAL: %s  %d cells  z=%d" % [layer.name, applied, layer.z_index])


# ---------------------------------------------------------------- lights ------

func _build_lights(data: Dictionary, level: Node) -> void:
	var lights: Array = data.get("lights", [])
	if lights.is_empty():
		return
	var lamp_tex: Texture2D = load(String(data.get("light_texture", "")))
	if lamp_tex == null:
		_fail("Gate2 light texture missing")
		return
	for source: Dictionary in lights:
		var lamp := PointLight2D.new()
		lamp.name = "Gate2LocalLantern"
		lamp.texture = lamp_tex
		lamp.position = Vector2(float(source["x"]), float(source["y"]))
		lamp.energy = float(source["energy"])
		lamp.texture_scale = float(source["scale"])
		var colour: Array = source.get("colour", [1.0, 0.79, 0.57])
		lamp.color = Color(float(colour[0]), float(colour[1]), float(colour[2]), 1.0)
		level.add_child(lamp)
		lights_added += 1
	print("GATE2 LIGHTS: %d local lanterns" % lights_added)


# --------------------------------------------------------------- report ------

func _fail(message: String) -> void:
	_failures.append(message)
	push_error("Gate2 overlay: " + message)


func get_failures() -> Array[String]:
	return _failures
