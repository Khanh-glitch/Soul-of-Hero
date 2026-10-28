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
		# obstacle/blocker (full-tile collision).
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
		else:
			frame = base
	var rect: Array = index.get(frame, [])
	if rect.size() < 2:
		return Vector2i(-1, -1)
	return Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE)


## Stable per-cell variant choice for ground tiles (no RNG state, so a saved
## screenshot and a live frame agree).
static func variant_index(x: int, y: int, count: int) -> int:
	if count <= 1:
		return 0
	return abs((x * 73856093) ^ (y * 19349663)) % count
