extends Node2D

## Gate 3 runtime adapter — the archive's architecture, material and shade on
## Candidate A's Chapter 1 Level 3.
##
## PROTOTYPE-LOCAL. This node is added to the live `DungeonLevel` and does six
## things, none of which change the level format or any production file:
##
##   1. it refuses to dress any level other than Chapter 1 Level 3;
##   2. it inserts each whole prop sprite into the level's own y-sorted
##      `Entities` container, so props occlude and are occluded like the actors;
##   3. it gives each solid prop ONE static rectangle derived from the sprite's
##      own rendered width by `tools/gate3/author_gate3.py`;
##   4. it composites eleven material layers (rock, floor, kerb, water, shoreline,
##      contact shadow, weather, dressed mass, wall faces, recesses, fittings) over
##      the level's own layers in separate TileMapLayers, leaving the authored JSON,
##      its two TileSet sources and its collision byte-identical;
##   5. it hides Candidate A's live `Decor` layer (cobweb, skull and barrel frames
##      that do not belong in an archive) and paints the archive's own fittings
##      instead — a node visibility change, not a data or art change. It also swaps
##      every spike's animation for a prototype-local *derived* copy of the same
##      production frames with the flat violet plate repainted as a dark crimson pit:
##      the plate was the last genuinely magenta thing on screen, and it was the hazard
##      art rather than the decoration layer that carried it. Clearing it to nothing
##      was tried first and made the hazard quieter than the card it replaced; the pit
##      keeps the bay reading as a marked danger at a glance;
##   6. it builds ONE smooth shade field from a distance transform, replacing Gate
##      2's five hard vault bands: a 116x96 RGBA image, linearly filtered, so the
##      falloff has no steps at any zoom.
##
## Round 4 adds two corrections found by comparing before/after frames pixel by pixel:
## the level's own `Backdrop` and `Geometry` layers were drawn above every Gate 3
## material layer, so the archive stone never reached the screen; they are now hidden
## behind an exact-coverage proof. And the rock apron is carried further out in eight
## flip/transpose variants of the approved frames instead of two hash-alternated ones.
##
## It adds no second Knight, no HUD, no campaign node, and reports every refusal
## through `get_failures()` instead of failing quietly.

const PLACEMENT_PATH := "res://prototypes/gate3/visual_placement.json"
const EXPECTED_LEVEL := "res://data/levels/chapter_1_level_3.json"
## Prototype-local derived hazard frames (see tools/gate3/make_derived_art.py): the
## production spike frames with their flat violet plate repainted as a crimson pit.
const HAZARD_FRAME_PATHS := [
	"res://prototypes/gate3/art/peaks_1.png",
	"res://prototypes/gate3/art/peaks_2.png",
	"res://prototypes/gate3/art/peaks_3.png",
	"res://prototypes/gate3/art/peaks_4.png",
]

## Draw order, bottom to top. `layer_style` in the document carries each layer's
## absolute z_index and modulate; this list only fixes creation order.
const MATERIAL_ORDER: Array[String] = [
	"rock", "rock_deep", "floor", "coping", "water", "water_edge", "shadow", "weather",
	"mass", "wall_face", "niche", "decor",
]

## Round 4: `rock` and `rock_deep` carry a flip/transpose mask per cell. The runtime
## builds one explicit alternative tile per (frame, mask) pair, so the stone outside
## the building is eight shapes of the same approved frames rather than two.
## Bit 0 = flip horizontally, bit 1 = flip vertically, bit 2 = transpose.
const ROCK_VARIANT_ROLES: Array[String] = ["rock", "rock_deep"]

@export var placement_path := PLACEMENT_PATH

var props_added := 0
var colliders_added := 0
var material_layers_added := 0
var lights_added := 0
var hidden_layers: Array[String] = []
var hazards_reskinned := 0
var shade_built := false
var rock_variants_built := 0
var _atlas_source: TileSetAtlasSource
var _alternative_cache := {}
var _failures: Array[String] = []
var _shade_node: Sprite2D


func attach_to_level(level: Node) -> bool:
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
		_fail("Entities is not y-sorted, so props could not occlude correctly")
		return false
	_build_props(data, container)
	_reskin_hazards()
	_build_material(data, level)
	_build_shade(data, level)
	_hide_level_layers(data, level)
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
	collision_root.name = "Gate3Collision"
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
		sprite.name = String(entry.get("id", "gate3_prop"))
		sprite.position = Vector2(float(entry["x"]), float(entry["base_y"]))
		# Centred sprite: lifting by half the frame height puts the art's base
		# exactly on the standing line the validator checked.
		sprite.offset = Vector2(0.0, -height * 0.5)
		container.add_child(sprite)
		props_added += 1

		if not bool(entry.get("solid", false)):
			continue
		# The authored contract is a pixel bounding box: [left, top, right, bottom].
		# The body sits at its centre with the box's own extent, so the collider is
		# exactly the footprint the authoring tool validated against the floor.
		var box: Array = entry["collider"]
		var left := float(box[0])
		var top := float(box[1])
		var right := float(box[2])
		var bottom := float(box[3])
		var body := StaticBody2D.new()
		body.name = "solid_" + String(entry.get("id", "prop"))
		body.collision_layer = int(data.get("collision_layer", 1))
		body.collision_mask = 0  # a wall: never queries actors
		var shape := RectangleShape2D.new()
		shape.size = Vector2(right - left, bottom - top)
		var shape_node := CollisionShape2D.new()
		shape_node.shape = shape
		body.position = Vector2((left + right) * 0.5, (top + bottom) * 0.5)
		body.add_child(shape_node)
		collision_root.add_child(body)
		colliders_added += 1

	print("GATE3 PROPS: %d sprites (%d solid) attached to %s"
		% [props_added, colliders_added, String(container.get_path())])


# --------------------------------------------------------------- hazards ------

func _reskin_hazards() -> void:
	## C2, correctly diagnosed: the magenta Gate 2 was marked down for is the flat
	## violet plate baked into `assets/environment/dungeon/items/spikes/peaks_*.png`.
	## The plate is opaque, so no multiply tint can remove it; the production atlas is
	## frozen, so this loads a derived copy with that plate repainted. The spike
	## pixels, the frame count and the 8 fps animation are unchanged, so the hazard
	## stays exactly as dangerous and at least as legible: pale steel spikes now stand
	## in a dark crimson pit instead of on a lavender card. Erasing the plate outright
	## was tried first and read as harmless rubble, which is not an acceptable trade.
	var frames: Array[Texture2D] = []
	for path: String in HAZARD_FRAME_PATHS:
		var texture: Texture2D = load(path)
		if texture == null:
			_fail("cannot load the derived hazard frame %s" % path)
			return
		frames.append(texture)
	for node: Node in get_tree().get_nodes_in_group(&"dungeon_hazards"):
		var sprite := node.get_node_or_null("%AnimatedSprite2D") as AnimatedSprite2D
		if sprite == null:
			_fail("a spike hazard has no AnimatedSprite2D to re-skin")
			continue
		var source_frames := sprite.sprite_frames
		var fps := 8.0
		if source_frames != null and source_frames.has_animation(&"active"):
			fps = source_frames.get_animation_speed(&"active")
		var reworked := SpriteFrames.new()
		if reworked.has_animation(&"default"):
			reworked.remove_animation(&"default")
		reworked.add_animation(&"active")
		reworked.set_animation_speed(&"active", fps)
		reworked.set_animation_loop(&"active", true)
		for texture: Texture2D in frames:
			reworked.add_frame(&"active", texture)
		sprite.sprite_frames = reworked
		sprite.play(&"active")
		hazards_reskinned += 1
	if hazards_reskinned == 0:
		_fail("no spike hazards were found to re-skin, which cannot be right")
	else:
		print("GATE3 HAZARDS: %d spike hazards re-skinned onto derived frames (crimson pit, violet gone)"
			% hazards_reskinned)


# -------------------------------------------------------------- material ------

func _build_material(data: Dictionary, level: Node) -> void:
	var art: Dictionary = data.get("material", {})
	var texture: Texture2D = load(String(data.get("tile_atlas", "")))
	if texture == null:
		_fail("Gate3 material atlas missing")
		return
	var tile := int(data.get("tile", 16))

	var atlas_source := TileSetAtlasSource.new()
	atlas_source.texture = texture
	atlas_source.texture_region_size = Vector2i(tile, tile)
	for y: int in range(int(texture.get_height() / tile)):
		for x: int in range(int(texture.get_width() / tile)):
			atlas_source.create_tile(Vector2i(x, y))
	_atlas_source = atlas_source
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(tile, tile)
	tile_set.add_source(atlas_source, 0)

	var style: Dictionary = data.get("layer_style", {})
	for role: String in MATERIAL_ORDER:
		var tiles: Array = art.get(role, [])
		if tiles.is_empty():
			continue
		var layer := TileMapLayer.new()
		layer.name = "Gate3_" + role
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
		var variant_role := role in ROCK_VARIANT_ROLES
		for cell: Array in tiles:
			var atlas_coords := Vector2i(int(cell[2]), int(cell[3]))
			var variant := int(cell[6]) if variant_role and cell.size() > 6 else 0
			layer.set_cell(Vector2i(int(cell[0]), int(cell[1])), 0, atlas_coords,
				_alternative_for(atlas_coords, variant))
			applied += 1
		if variant_role:
			print("GATE3 VARIANTS: %s  %d cells, %d alternative tiles in use"
				% [role, applied, _alternative_cache.size()])
		if applied != layer.get_used_cells().size():
			_fail("%s applied %d of %d authored cells"
				% [layer.name, applied, layer.get_used_cells().size()])
		print("GATE3 MATERIAL: %s  %d cells  z=%d" % [layer.name, applied, layer.z_index])


func _alternative_for(atlas_coords: Vector2i, variant: int) -> int:
	## Round 4: eight rotations of the same quarry frames, made as real alternative
	## tiles so the flip is baked by the renderer and the cell data stays one atlas
	## source. `variant` 0 is the untouched frame.
	if variant == 0 or _atlas_source == null:
		return 0
	var key := "%d:%d:%d" % [atlas_coords.x, atlas_coords.y, variant]
	if _alternative_cache.has(key):
		return int(_alternative_cache[key])
	var alternative := _atlas_source.create_alternative_tile(atlas_coords)
	var data := _atlas_source.get_tile_data(atlas_coords, alternative)
	if data == null:
		_fail("cannot create rock variant %d for %s" % [variant, str(atlas_coords)])
		return 0
	rock_variants_built += 1
	data.flip_h = (variant & 1) != 0
	data.flip_v = (variant & 2) != 0
	data.transpose = (variant & 4) != 0
	_alternative_cache[key] = alternative
	return alternative


# ----------------------------------------------------------------- shade ------

func _build_shade(data: Dictionary, level: Node) -> void:
	## C6: Gate 2 graded the vault with five TileMapLayers four cells apart, and the
	## band edges were still visible under 3x inspection. This builds ONE texture
	## instead: a multi-source distance transform from everything the building
	## occupies, written into a 116x96 RGBA image and drawn with linear filtering, so
	## the falloff is continuous at every zoom and costs one sprite.
	var shade: Dictionary = data.get("shade", {})
	if shade.is_empty():
		_fail("the placement document carries no shade definition")
		return
	var document: Dictionary = level.get("level_data")
	var width := int(document.get("width", 0))
	var height := int(document.get("height", 0))
	if width <= 0 or height <= 0:
		_fail("cannot read the level size for the shade field")
		return

	var material: Dictionary = data.get("material", {})
	var lit := {}
	for role: String in ["floor", "wall_face", "mass", "niche", "coping", "decor", "weather"]:
		for cell: Array in material.get(role, []):
			lit[Vector2i(int(cell[0]), int(cell[1]))] = true

	var falloff := float(shade.get("falloff_cells", 26.0))
	var max_alpha := float(shade.get("max_alpha", 0.94))
	var distance := {}
	var frontier: Array[Vector2i] = []
	for cell: Vector2i in lit:
		distance[cell] = 0.0
		frontier.append(cell)
	while not frontier.is_empty():
		var next: Array[Vector2i] = []
		for cell: Vector2i in frontier:
			var base: float = distance[cell]
			if base >= falloff:
				continue
			for step: Vector2i in [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]:
				var neighbour: Vector2i = cell + step
				if neighbour.x < 0 or neighbour.y < 0 or neighbour.x >= width or neighbour.y >= height:
					continue
				if distance.has(neighbour):
					continue
				distance[neighbour] = base + 1.0
				next.append(neighbour)
		frontier = next

	var colour: Array = shade.get("colour", [0.05, 0.06, 0.09])
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(Color(float(colour[0]), float(colour[1]), float(colour[2]), 0.0))
	for y: int in range(height):
		for x: int in range(width):
			var d: float = distance.get(Vector2i(x, y), falloff)
			var t: float = clampf(d / falloff, 0.0, 1.0)
			var alpha := pow(t, 1.35) * max_alpha
			if alpha <= 0.002:
				continue
			image.set_pixel(x, y, Color(float(colour[0]), float(colour[1]), float(colour[2]), alpha))
	var texture := ImageTexture.create_from_image(image)

	var sprite := Sprite2D.new()
	sprite.name = "Gate3_Shade"
	sprite.texture = texture
	sprite.centered = false
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	sprite.z_index = int(shade.get("z_index", -14))
	sprite.z_as_relative = false
	sprite.scale = Vector2(16.0, 16.0)
	sprite.position = Vector2.ZERO
	level.add_child(sprite)
	_shade_node = sprite
	shade_built = true
	print("GATE3 SHADE: %dx%d distance field, falloff %.0f cells, one node"
		% [width, height, falloff])


# ----------------------------------------------------------- level layers -----

## Which Gate 3 layers are allowed to stand in for each production layer when it is
## hidden. Nothing is hidden unless every one of its cells has a replacement: an
## unpainted masonry cell would leave a wall the Knight collides with invisible.
const REPLACEMENTS := {
	"Backdrop": ["floor", "water", "water_edge", "coping"],
	"Geometry": ["wall_face", "mass", "niche"],
	"Decor": [],
}


func _hide_level_layers(data: Dictionary, level: Node) -> void:
	## C2, and the round-4 correction. Candidate A's `Decor` layer is the only cool
	## toned production art left in the room, so it is replaced by the archive's own
	## fittings. Round 4 found the real reason the archive material never appeared:
	## the level's `Backdrop` (z = -10) and `Geometry` (z = 0) TileMapLayers were drawn
	## *above* every Gate 3 layer (z = -30 ... -10), so 5 800 authored cells and the
	## whole shade field were behind the tiles they were meant to replace. Both are now
	## hidden, but only after every cell they own is proved to have a painted
	## replacement -- the same precondition `tools/gate3/author_gate3.py` checks
	## offline. Hiding a layer does not disable its collision: the TileSet physics
	## layer keeps the walls solid, which is exactly what is wanted here.
	var painted := _painted_cells(data)
	for layer_name: String in (data.get("hidden_level_layers", []) as Array):
		var layer := level.get_node_or_null(layer_name) as CanvasItem
		if layer == null:
			_fail("the live level has no '%s' layer to replace" % layer_name)
			continue
		var roles: Array = REPLACEMENTS.get(layer_name, [])
		if not roles.is_empty():
			var tile_layer := layer as TileMapLayer
			if tile_layer == null:
				_fail("'%s' is not a TileMapLayer, so its coverage cannot be proved" % layer_name)
				continue
			var missing: Array[Vector2i] = []
			var total := 0
			for cell: Vector2i in tile_layer.get_used_cells():
				total += 1
				if not painted.has(cell):
					missing.append(cell)
			if not missing.is_empty():
				_fail("%s has %d cells with no Gate3 replacement, first %s (+%d more)"
					% [layer_name, missing.size(), str(missing[0]),
						maxi(0, missing.size() - 3)])
				continue
			print("GATE3 COVERAGE: %s %d/%d cells painted by %s"
				% [layer_name, total, total, str(roles)])
		layer.visible = false
		hidden_layers.append(layer_name)
		print("GATE3 LAYER: %s hidden" % layer_name)


func _painted_cells(data: Dictionary) -> Dictionary:
	var cells := {}
	var material: Dictionary = data.get("material", {})
	var ground_roles: Array = REPLACEMENTS["Backdrop"]
	var wall_roles: Array = REPLACEMENTS["Geometry"]
	for role: String in ground_roles + wall_roles:
		for cell: Array in material.get(role, []):
			cells[Vector2i(int(cell[0]), int(cell[1]))] = true
	return cells


# ---------------------------------------------------------------- lights ------

func _build_lights(data: Dictionary, level: Node) -> void:
	var lights: Array = data.get("lights", [])
	if lights.is_empty():
		return
	var lamp_tex: Texture2D = load(String(data.get("light_texture", "")))
	if lamp_tex == null:
		_fail("Gate3 light texture missing")
		return
	for source: Dictionary in lights:
		var lamp := PointLight2D.new()
		lamp.name = "Gate3LocalLantern"
		lamp.texture = lamp_tex
		lamp.position = Vector2(float(source["x"]), float(source["y"]))
		lamp.energy = float(source["energy"])
		lamp.texture_scale = float(source["scale"])
		var colour: Array = source.get("colour", [1.0, 0.79, 0.57])
		lamp.color = Color(float(colour[0]), float(colour[1]), float(colour[2]), 1.0)
		level.add_child(lamp)
		lights_added += 1
	print("GATE3 LIGHTS: %d local lanterns" % lights_added)


# --------------------------------------------------------------- report ------

func _fail(message: String) -> void:
	_failures.append(message)
	push_error("Gate3 overlay: " + message)


func get_failures() -> Array[String]:
	return _failures
