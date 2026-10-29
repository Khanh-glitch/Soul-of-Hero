class_name OverworldTiles
extends RefCounted
## Builds the Hollow Marches TileSet from the shipped atlas.
##
## The atlas is the *production art* (`assets/environment/overworld/
## overworld_tiles.png`) plus the frame table written by
## `tools/overworld/art.py`. Nothing is synthesised at runtime: the game draws
## the same pixels the art tool authored, which is why the author preview and
## the game screenshots agree.
##
## Three layers use this single TileSet:
##   Ground  – opaque terrain, no collision
##   Detail  – transparent overlays (roads, banks, cracks, moss)
##   Solid   – obstacle tiles that carry the physics layer, plus invisible
##             blockers for deep water

const TILE := 16
const GROUND_SOURCE := 0
## Solid/detail tiles are ordinary atlas tiles; the physics polygon is only
## installed on the frames whose code means "obstacle".
const BLOCKER_PREFIX := "blocker#"


static func load_meta(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}


## Build the TileSet. `texture` must be the imported atlas resource.
static func build(texture: Texture2D, meta: Dictionary) -> TileSet:
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(TILE, TILE)
	# Godot 4.7: add_physics_layer() returns void; the first layer it creates on
	# a fresh TileSet is index 0.
	tile_set.add_physics_layer()
	const PHYSICS_LAYER := 0
	tile_set.set_physics_layer_collision_layer(PHYSICS_LAYER, 1)
	tile_set.set_physics_layer_collision_mask(PHYSICS_LAYER, 0)

	var source := TileSetAtlasSource.new()
	source.texture = texture
	source.texture_region_size = Vector2i(TILE, TILE)
	var columns := int(meta.get("columns", 32))
	var rows := int(meta.get("rows", 1))
	for y in range(rows):
		for x in range(columns):
			source.create_tile(Vector2i(x, y))
	tile_set.add_source(source, GROUND_SOURCE)

	var full := PackedVector2Array([
		Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8),
	])
	var index: Dictionary = meta.get("index", {})
	for frame_name: String in index:
		var rect: Array = index[frame_name]
		var coords := Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE)
		var tile_data := source.get_tile_data(coords, 0)
		if tile_data == null:
			continue
		# Every non-ground frame is either an overlay (no collision) or an
		# obstacle/blocker (full-tile collision). The mirrored variants below
		# reuse this same tile data, so they inherit the collision polygon; the
		# polygon is a full symmetric square, so mirroring is a no-op for physics.
		if _carries_collision(frame_name):
			tile_data.set_collision_polygons_count(PHYSICS_LAYER, 1)
			tile_data.set_collision_polygon_points(PHYSICS_LAYER, 0, full)
	return tile_set


static func _carries_collision(frame_name: String) -> bool:
	if frame_name.begins_with(BLOCKER_PREFIX):
		return true
	var code := frame_name.split("#")[0]
	return code in ["cliff", "wall", "canopy", "rubble"]


## Atlas cell for a decoded layer token, e.g. "=7" -> the road tile with the
## 0b0111 neighbour mask, "~" -> a water variant.
## Per-TILE variant pick for scattered overlays.
##
## `variant_index` deliberately quantises to a 3x3 block, because ground variants
## carry a tone and a per-tile choice made the four stone tones a checkerboard.
## An overlay is the opposite case: it is a *feature* (a pool, a patch), so a
## per-block pick draws the same feature nine times in a row and the feature
## reads as a lattice. Different hash, different quantisation, on purpose.
static func overlay_variant_index(x: int, y: int, count: int) -> int:
	if count <= 1:
		return 0
	var mixed := abs((x * 92837111) ^ (y * 689287499) ^ 0x51ED270B)
	return mixed % count


## How many frames a multi-variant overlay carries (1 when it is single-frame).
static func detail_variant_count(meta: Dictionary, code: String) -> int:
	var entry: Dictionary = (meta.get("codes", {}) as Dictionary).get("detail", {}).get(code, {})
	var names: Array = entry.get("variant_names", [])
	return names.size()


static func cell_for(meta: Dictionary, token: String, layer_name: String) -> Vector2i:
	var index: Dictionary = meta.get("index", {})
	var codes: Dictionary = meta.get("codes", {})
	if token.is_empty():
		return Vector2i(-1, -1)
	var code := token.substr(0, 1)
	var mask := token.substr(1) if token.length() > 1 else ""
	var frame := ""
	if layer_name == "ground":
		var names: Array = (codes.get("ground", {}) as Dictionary).get(code, [])
		if names.is_empty():
			return Vector2i(-1, -1)
		frame = String(names[0]) if mask.is_empty() else String(names[mask.hex_to_int() % names.size()])
	else:
		var table: Dictionary = codes.get(layer_name, {})
		var entry: Dictionary = table.get(code, {})
		if entry.is_empty():
			return Vector2i(-1, -1)
		var base := String(entry.get("frame", ""))
		if bool(entry.get("masked", false)) and not mask.is_empty():
			var m := mask.hex_to_int()
			var variants := int(entry.get("variants", 16))
			if variants > 0 and m >= variants:
				m = m % variants
			frame = "%s#%d" % [base, m]
		elif entry.has("variant_names"):
			# Multi-variant overlay: same per-cell lattice hash as ground, so a
			# scattered overlay (the fen's pools) cannot draw one frame on every
			# cell it covers. Empty mask means the caller did not pass a position,
			# in which case the first frame is the safe answer.
			var names: Array = entry.get("variant_names", [])
			if names.is_empty():
				frame = base
			elif mask.is_empty():
				frame = String(names[0])
			else:
				frame = String(names[mask.hex_to_int() % names.size()])
		else:
			frame = base
	var rect: Array = index.get(frame, [])
	if rect.size() < 2:
		return Vector2i(-1, -1)
	return Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE)


## Stable per-cell variant choice for ground tiles (no RNG state, so a saved
## screenshot and a live frame agree).
## Side of the coarse cell that picks a ground variant, in tiles.
##
## The variant used to be chosen per tile. With four tones of one stone in the
## atlas that turned a plaza into a checkerboard: every 16 px cell was its own
## shade, and at the camera's 2x zoom the eye reads the tile grid, not the
## weathering. The choice is now made per BLOCK x BLOCK cluster, so a tone runs
## for a few tiles and reads as a damp patch or a paler seam instead of noise.
const VARIANT_BLOCK := 3


static func variant_index(x: int, y: int, count: int) -> int:
	if count <= 1:
		return 0
	var bx := int(floor(float(x) / float(VARIANT_BLOCK)))
	var by := int(floor(float(y) / float(VARIANT_BLOCK)))
	# Ragged patch edges: one tile in six borrows a neighbouring cluster's tone,
	# so a weathered area has a broken outline instead of a 3-tile rectangle.
	var jitter := absi((x * 83492791) ^ (y * 2654435761)) % 6
	if jitter == 0:
		bx -= 1
	elif jitter == 1:
		by -= 1
	bx += 4096
	by += 4096
	return absi((bx * 73856093) ^ (by * 19349663)) % count


## The `alternative_tile` argument for the ground cell at (x, y).
##
## The ground variant is picked per 3x3 block (a per-tile pick turned the four
## stone tones into a checkerboard), which meant the same 16 px tile was drawn
## *nine times in a row* and every feature pixel inside it printed a 3-tile
## lattice. Godot 4 mirrors a tile for free through the alternative-tile bits, so
## each cell is mirrored on a per-tile hash: the tone stays coherent across a
## block while the detail decorrelates inside it.
##
## Deliberately *not* the same hash as `variant_index`, so a block's nine tiles
## do not share a mirror pattern either.
static func flip_id(x: int, y: int) -> int:
	var mixed := absi((x * 374761393) ^ (y * 668265263) ^ 0x9E3779B9)
	match mixed % 4:
		1:
			return TileSetAtlasSource.TRANSFORM_FLIP_H
		2:
			return TileSetAtlasSource.TRANSFORM_FLIP_V
		3:
			return TileSetAtlasSource.TRANSFORM_FLIP_H | TileSetAtlasSource.TRANSFORM_FLIP_V
		_:
			return 0
