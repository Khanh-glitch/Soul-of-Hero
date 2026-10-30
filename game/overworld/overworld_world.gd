class_name OverworldWorld
extends Node2D
## Paints the Hollow Marches: three TileMapLayers for terrain and a y-sorted set
## of prop sprites for landmark architecture, camps, ruins and vegetation.
##
## The baked grids are the authority. This class decodes them, hands every cell
## to the TileSet, and keeps a second, authoritative copy of the *solid* grid so
## shortcuts can open a real hole in the terrain (collision included) at runtime
## and so tests can ask "is this cell walkable?" without touching physics nodes.

signal painted(ground_cells: int, solid_cells: int, prop_count: int)

const TILE := 16
const TILES_META_PATH := "res://data/overworld/overworld_tiles.json"
const TILES_TEXTURE: Texture2D = preload("res://assets/environment/overworld/overworld_tiles.png")
const PROPS_TEXTURE: Texture2D = preload("res://assets/environment/overworld/overworld_props.png")
const PROPS_META_PATH := "res://data/overworld/overworld_props.json"

## Props that stand on the ground and should be drawn *behind* a player
## standing in front of them, versus flat things that sit underfoot.
## Props that lie flat on the ground and must never be treated as occluders.
##
## The cliff decals belong here for the same reason the camp bedroll does: they are
## *surface* - patches of weathered rock and a projecting lip at the foot of a wall -
## and they are drawn across the wall they decorate, which means a sprite centred on a
## wall cell necessarily overhangs the walkable ground south of it. Once the decals
## were allowed onto the narrow walls (which is where they were needed), a player
## standing at the foot of any such wall was inside a patch's rect, and the occlusion
## system dutifully faded a piece of masonry they were nowhere near. A wall is not a
## thing standing in front of you.
const FLAT_PROPS := [
	"disc_cache", "disc_bones", "disc_lore", "camp_bedroll",
	"cliff_patch_a", "cliff_patch_b", "cliff_patch_c", "cliff_patch_d",
	"cliff_crack_a", "cliff_crack_b",
	"cliff_ledge_a", "cliff_ledge_b",
]

## Unmasked detail overlays that carry several frames. A single-frame overlay
## drawn on hundreds of scattered cells repeats identically and reads as a
## lattice, so these get a per-cell variant pick (see `_paint_grid`).
const DETAIL_VARIANT_CODES := ["p", "w", "q", "u"]
## Prop frames the shortcut system can swap at runtime: closed -> open.
const SHORTCUT_FRAMES := {
	"short_bridge": ["short_bridge_broken", "short_bridge_fixed"],
	"short_rubble": ["short_rubble_block", "short_rubble_cleared"],
	"short_conduit": ["short_conduit_off", "short_conduit_on"],
	"short_valve": ["short_valve_closed", "short_valve_open"],
}
const SHORTCUT_FRAME_ALIASES := {
	"short_bridge": "short_bridge",
	"short_bridge_broken": "short_bridge",
	"short_bridge_fixed": "short_bridge",
	"short_rubble": "short_rubble",
	"short_rubble_block": "short_rubble",
	"short_rubble_cleared": "short_rubble",
	"short_conduit": "short_conduit",
	"short_conduit_off": "short_conduit",
	"short_conduit_on": "short_conduit",
	"short_valve": "short_valve",
	"short_valve_closed": "short_valve",
	"short_valve_open": "short_valve",
}
## Frames whose sprite footprint should also block movement (landmarks and
## heavy architecture). The blocking box is the lower half of the sprite.
const SOLID_PROP_PREFIXES := [
	"lm_", "short_bridge", "short_rubble", "short_conduit", "short_valve",
	"wall_stub", "tree_dead", "tree_pine", "column", "statue", "camp_tent",
	"cart", "sarcophagus",
	# Camp furniture is solid for the same reason a tent is: a pavilion you can walk
	# through is not a pavilion. Added with the frames, not after; every one of them
	# is placed off the approach lane and the bake refuses any that is not.
	"camp_pavilion", "camp_wagon", "camp_rack", "camp_cookfire", "camp_table",
]

var width: int = 0
var height: int = 0
var data: Dictionary = {}
var tiles_meta: Dictionary = {}
var props_meta: Dictionary = {}

var ground_layer: TileMapLayer
var detail_layer: TileMapLayer
var solid_layer: TileMapLayer
var props_root: Node2D
var blocker_root: Node2D

## Authoritative copy of the solid grid (after shortcut unlocking).
var _solid: PackedStringArray = PackedStringArray()
var _ground: PackedStringArray = PackedStringArray()
## The detail (decal) layer, kept decoded alongside ground and solid so that
## gameplay can ask about a cell instead of reading a TileMapLayer's atlas
## coordinates. Survival placement is the first caller: roads are detail tiles,
## and "you may not build on the road" is a rule about cells, not sprites.
var _detail: PackedStringArray = PackedStringArray()
var _shortcut_open: Dictionary = {}
## frame name -> AtlasTexture, shared by every sprite that uses it.
var _atlas_cache: Dictionary = {}
var _shortcut_sprites: Dictionary = {}   # shortcut id -> Array[Sprite2D]
var _prop_blockers: Dictionary = {}      # shortcut id -> Array[StaticBody2D]
## Shortcut id -> [x0, y0, x1, y1] the runtime may carve. Authored in
## `tools/overworld/author.py` and baked into hollow_marches.json, so the
## collision the world opens is exactly the collision the geography drew.
var _shortcut_carve: Dictionary = {}
## Cells a shortcut has cleared, with the token they held, so closing restores
## the terrain exactly rather than guessing at a replacement.
var _carve_memory: Dictionary = {}       # shortcut id -> {Vector2i: String}


func build(world_data: Dictionary, layers_path: String, props_path: String,
		props_parent: Node2D = null) -> bool:
	data = world_data
	_shortcut_carve = {}
	for entry: Dictionary in world_data.get("shortcuts", []):
		var carve: Variant = entry.get("carve", null)
		if carve is Array and (carve as Array).size() == 4:
			_shortcut_carve[String(entry.get("id", ""))] = (carve as Array).duplicate()
	width = int(world_data.get("world_bounds", {}).get("w", 0))
	height = int(world_data.get("world_bounds", {}).get("h", 0))
	if width <= 0 or height <= 0:
		push_error("OverworldWorld: world bounds are invalid.")
		return false
	tiles_meta = _load_meta(TILES_META_PATH)
	props_meta = _load_meta(PROPS_META_PATH).get("frames", {})
	var layers := _load_meta(layers_path)
	if layers.is_empty():
		push_error("OverworldWorld: baked layers are missing at %s" % layers_path)
		return false

	_ground = _decode(layers, "ground")
	_solid = _decode(layers, "solid")
	_detail = _decode(layers, "detail")
	if _ground.size() != width * height or _solid.size() != width * height:
		push_error("OverworldWorld: baked grid does not match world bounds.")
		return false

	var tile_set := OverworldTiles.build(TILES_TEXTURE, tiles_meta)
	# Terrain draws under everything; the z bands are explicit so a prop can
	# never be painted over by the ground it stands on.
	ground_layer = _make_layer("Ground", tile_set, -30, false)
	detail_layer = _make_layer("Detail", tile_set, -28, false)
	solid_layer = _make_layer("Solid", tile_set, -26, true)
	# Props join the y-sorted entity layer so the player walks in front of a
	# tree and behind a tower.
	props_root = props_parent
	if props_root == null:
		props_root = Node2D.new()
		props_root.name = "Props"
		props_root.y_sort_enabled = true
		add_child(props_root)
	blocker_root = Node2D.new()
	blocker_root.name = "PropBlockers"
	add_child(blocker_root)

	var ground_cells := _paint_grid(ground_layer, _ground, "ground")
	var solid_cells := _paint_grid(solid_layer, _solid, "solid")
	_paint_grid(detail_layer, _detail, "detail")
	var prop_count := _paint_props(props_path)
	painted.emit(ground_cells, solid_cells, prop_count)
	return true


func _make_layer(layer_name: String, tile_set: TileSet, z: int, with_collision: bool) -> TileMapLayer:
	var layer := TileMapLayer.new()
	layer.name = layer_name
	layer.tile_set = tile_set
	layer.z_index = z
	layer.y_sort_enabled = false
	layer.collision_enabled = with_collision
	add_child(layer)
	return layer


func _decode(layers: Dictionary, layer_name: String) -> PackedStringArray:
	var entry: Dictionary = (layers.get("layers", {}) as Dictionary).get(layer_name, {})
	var runs: Array = entry.get("rle", [])
	var total := width * height
	var out := PackedStringArray()
	out.resize(total)
	var i := 0
	for run: Array in runs:
		if run.size() < 2:
			continue
		var token := String(run[0])
		var count := int(run[1])
		for _k in range(count):
			if i >= total:
				break
			out[i] = token
			i += 1
	if i != total:
		push_error("OverworldWorld: %s layer decoded %d of %d cells." % [layer_name, i, total])
	return out


func _paint_grid(layer: TileMapLayer, cells: PackedStringArray, layer_name: String) -> int:
	var painted := 0
	var codes: Dictionary = tiles_meta.get("codes", {})
	var ground_codes: Dictionary = codes.get("ground", {})
	for y in range(height):
		var row := y * width
		for x in range(width):
			var token := cells[row + x]
			if token.is_empty() or token == ".":
				continue
			var cell := Vector2i(-1, -1)
			if layer_name == "ground":
				var code := token.substr(0, 1)
				var names: Array = ground_codes.get(code, [])
				if names.is_empty():
					continue
				var pick := OverworldTiles.variant_index(x, y, names.size())
				cell = OverworldTiles.cell_for(tiles_meta, code + ("%x" % pick if names.size() > 1 else ""), "ground")
			elif layer_name == "detail" and DETAIL_VARIANT_CODES.has(token.substr(0, 1)):
				# A scattered overlay needs a per-cell frame or it draws the same
				# art on every cell it covers, which reads as a lattice. The mask
				# slot carries the variant pick, exactly as it does for ground.
				var vsize := OverworldTiles.detail_variant_count(tiles_meta, token.substr(0, 1))
				if vsize <= 1:
					cell = OverworldTiles.cell_for(tiles_meta, token, layer_name)
				else:
					cell = OverworldTiles.cell_for(tiles_meta,
						token.substr(0, 1) + "%x" % OverworldTiles.overlay_variant_index(x, y, vsize),
						layer_name)
			else:
				cell = OverworldTiles.cell_for(tiles_meta, token, layer_name)
			if cell.x < 0:
				continue
			# Ground gets a per-tile mirror so a block of one variant does not
			# print its own detail nine times; overlays stay unmirrored because
			# their edges are directional and must line up with their neighbours.
			var alt := OverworldTiles.flip_id(x, y) if layer_name == "ground" else 0
			layer.set_cell(Vector2i(x, y), OverworldTiles.GROUND_SOURCE, cell, alt)
			painted += 1
	return painted


func _paint_props(path: String) -> int:
	var doc := _load_meta(path)
	var entries: Array = doc.get("props", [])
	var count := 0
	for raw: Variant in entries:
		if not raw is Dictionary:
			continue
		var entry: Dictionary = raw
		var frame := String(entry.get("frame", ""))
		if frame.is_empty():
			continue
		var resolved := _resolve_frame(frame, entry)
		var sprite := _make_sprite(resolved)
		if sprite == null:
			continue
		var flags := String(entry.get("flags", ""))
		var pos := Vector2(float(entry.get("x", 0.0)), float(entry.get("y", 0.0)))
		if not flags.is_empty() and SHORTCUT_FRAME_ALIASES.has(frame):
			# Shortcut props are managed as a group so their state can be swapped.
			var shortcut_id := flags
			if not _shortcut_sprites.has(shortcut_id):
				_shortcut_sprites[shortcut_id] = []
			_shortcut_sprites[shortcut_id].append(sprite)
			sprite.set_meta("shortcut_id", shortcut_id)
			sprite.set_meta("shortcut_family", SHORTCUT_FRAME_ALIASES[frame])
		sprite.position = pos
		sprite.name = "P_%d_%s" % [count, frame]
		# The authored frame, kept on the node: the occlusion system needs to know
		# what a prop *is* (a landmark fades less than a bush), and after a
		# shortcut swap the node name no longer describes the frame on screen.
		sprite.set_meta("frame_name", frame)
		if FLAT_PROPS.has(frame):
			sprite.z_index = -1
		props_root.add_child(sprite)
		if _needs_prop_blocker(frame):
			# Size the body from the frame actually drawn, not from the shortcut
			# family name (which has no atlas entry of its own).
			_add_prop_blocker(sprite, resolved, flags)
		count += 1
	return count


func _resolve_frame(frame: String, entry: Dictionary) -> String:
	# Shortcut props are authored once and swap between their two states.
	if SHORTCUT_FRAME_ALIASES.has(frame):
		var family := String(SHORTCUT_FRAME_ALIASES[frame])
		var states: Array = SHORTCUT_FRAMES.get(family, [])
		if states.size() == 2:
			var open_state := bool(_shortcut_open.get(String(entry.get("flags", "")), false))
			return String(states[1] if open_state else states[0])
	return frame


func _make_sprite(frame: String) -> Sprite2D:
	var region: Dictionary = props_meta.get(frame, {})
	if region.is_empty():
		push_warning("OverworldWorld: unknown prop frame '%s'" % frame)
		return null
	var texture: AtlasTexture = _atlas_cache.get(frame, null)
	if texture == null:
		texture = AtlasTexture.new()
		texture.atlas = PROPS_TEXTURE
		texture.region = Rect2(
			float(region.get("x", 0)), float(region.get("y", 0)),
			float(region.get("w", 16)), float(region.get("h", 16)),
		)
		_atlas_cache[frame] = texture
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	# Anchor the sprite on its feet: the author writes the ground contact point.
	sprite.offset = Vector2(-float(region.get("w", 16)) * 0.5, -float(region.get("h", 16)))
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return sprite


func _needs_prop_blocker(frame: String) -> bool:
	for prefix: String in SOLID_PROP_PREFIXES:
		if frame.begins_with(prefix):
			return true
	return false


func _add_prop_blocker(sprite: Sprite2D, frame: String, flags: String) -> void:
	var region: Dictionary = props_meta.get(frame, {})
	var w := float(region.get("w", 16))
	var h := float(region.get("h", 16))
	# Block the body of the structure, not its whole silhouette: the player has
	# to be able to stand in front of the door.
	var body_h := maxf(8.0, h * 0.42)
	var body_w := maxf(8.0, w * 0.82)
	var body := StaticBody2D.new()
	body.name = "Blocker"
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = sprite.position + Vector2(0.0, -body_h * 0.5)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(body_w, body_h)
	shape.shape = rect
	body.add_child(shape)
	blocker_root.add_child(body)
	if not flags.is_empty() and SHORTCUT_FRAME_ALIASES.has(frame):
		if not _prop_blockers.has(flags):
			_prop_blockers[flags] = []
		_prop_blockers[flags].append(body)


# ---------------------------------------------------------------------------
# shortcuts
# ---------------------------------------------------------------------------
## Open (or close) a shortcut in the world: the sprite changes state, the tile
## collision opens, and the prop's own body steps aside.
func set_shortcut_open(shortcut_id: String, is_open: bool) -> void:
	_shortcut_open[shortcut_id] = is_open
	for sprite: Sprite2D in _shortcut_sprites.get(shortcut_id, []):
		if not is_instance_valid(sprite):
			continue
		var family := String(sprite.get_meta("shortcut_family", ""))
		var states: Array = SHORTCUT_FRAMES.get(family, [])
		if states.size() != 2:
			continue
		var frame := String(states[1] if is_open else states[0])
		var texture: AtlasTexture = _atlas_cache.get(frame, null)
		if texture == null:
			texture = AtlasTexture.new()
			texture.atlas = PROPS_TEXTURE
			var region: Dictionary = props_meta.get(frame, {})
			if region.is_empty():
				continue
			texture.region = Rect2(
				float(region.get("x", 0)), float(region.get("y", 0)),
				float(region.get("w", 16)), float(region.get("h", 16)),
			)
			_atlas_cache[frame] = texture
		sprite.texture = texture
	for body: StaticBody2D in _prop_blockers.get(shortcut_id, []):
		if is_instance_valid(body):
			body.collision_layer = 0 if is_open else 1
	_carve_shortcut(shortcut_id, is_open)


func shortcut_carve_box(shortcut_id: String) -> Array:
	return _shortcut_carve.get(shortcut_id, [])


func shortcut_carve_boxes() -> Dictionary:
	return _shortcut_carve.duplicate(true)


## Open or close the authored band. The first open remembers every token so the
## terrain can be restored exactly; after that the band only follows the save.
func _carve_shortcut(shortcut_id: String, is_open: bool) -> void:
	var box: Array = _shortcut_carve.get(shortcut_id, [])
	if box.size() != 4:
		push_warning("OverworldWorld: '%s' has no authored carve box" % shortcut_id)
		return
	var x0 := int(box[0])
	var y0 := int(box[1])
	var x1 := int(box[2])
	var y1 := int(box[3])
	var memory: Dictionary = _carve_memory.get(shortcut_id, {})
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var cell := Vector2i(x, y)
			if is_open:
				if not memory.has(cell):
					memory[cell] = _solid[y * width + x] if _is_inside(x, y) else "."
				_set_solid_cell(x, y, ".")
			elif memory.has(cell):
				_restore_solid_cell(x, y, String(memory[cell]))
	if is_open:
		_carve_memory[shortcut_id] = memory


func _is_inside(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < width and y < height


## Put back the exact token that was there before the shortcut was opened,
## mask and variant included, so closing never invents new terrain.
func _restore_solid_cell(x: int, y: int, token: String) -> void:
	if x < 0 or y < 0 or x >= width or y >= height:
		return
	var i := y * width + x
	if token == "." or token.is_empty():
		if _solid[i] != ".":
			_solid[i] = "."
			solid_layer.erase_cell(Vector2i(x, y))
		return
	_solid[i] = token
	var cell := OverworldTiles.cell_for(tiles_meta, token, "solid")
	if cell.x >= 0:
		solid_layer.set_cell(Vector2i(x, y), OverworldTiles.GROUND_SOURCE, cell)


func _set_solid_cell(x: int, y: int, code: String) -> void:
	if x < 0 or y < 0 or x >= width or y >= height:
		return
	var i := y * width + x
	var current := _solid[i]
	if code == ".":
		if current == ".":
			return
		_solid[i] = "."
		solid_layer.erase_cell(Vector2i(x, y))
		return
	if current != ".":
		return
	_solid[i] = code + "f"
	var cell := OverworldTiles.cell_for(tiles_meta, code + "f", "solid")
	if cell.x >= 0:
		solid_layer.set_cell(Vector2i(x, y), OverworldTiles.GROUND_SOURCE, cell)


# ---------------------------------------------------------------------------
# queries (used by the controller and by the native behaviour tests)
# ---------------------------------------------------------------------------
func is_solid_cell(x: int, y: int) -> bool:
	if x < 0 or y < 0 or x >= width or y >= height:
		return true
	return _solid[y * width + x] != "."


## How many cells the terrain painter blocked. The traversability grid is checked
## against this, so the two cannot quietly disagree about the same world.
func solid_cell_count() -> int:
	var total := 0
	for index in _solid.size():
		if _solid[index] != ".":
			total += 1
	return total


func is_water_cell(x: int, y: int) -> bool:
	if x < 0 or y < 0 or x >= width or y >= height:
		return false
	var token := _ground[y * width + x]
	return not token.is_empty() and token.substr(0, 1) == "~"


func ground_code_at(world_position: Vector2) -> String:
	var x := int(floor(world_position.x / float(TILE)))
	var y := int(floor(world_position.y / float(TILE)))
	if x < 0 or y < 0 or x >= width or y >= height:
		return ""
	var token := _ground[y * width + x]
	return token.substr(0, 1) if not token.is_empty() else ""


## The first character of the detail token at a world position ("" off-map).
##
## Signs and debris share this layer with the road, so callers that care about one
## of them must match the token, not just test for presence.
func detail_code_at(world_position: Vector2) -> String:
	var x := int(floor(world_position.x / float(TILE)))
	var y := int(floor(world_position.y / float(TILE)))
	if x < 0 or y < 0 or x >= width or y >= height:
		return ""
	var token := _detail[y * width + x]
	return token.substr(0, 1) if not token.is_empty() else ""


## True when a character of the given radius can occupy this position.
func is_walkable(world_position: Vector2, radius := 6.0) -> bool:
	for offset: Vector2 in [
		Vector2.ZERO,
		Vector2(radius, 0), Vector2(-radius, 0), Vector2(0, radius), Vector2(0, -radius),
	]:
		var p := world_position + offset
		var x := int(floor(p.x / float(TILE)))
		var y := int(floor(p.y / float(TILE)))
		if is_solid_cell(x, y):
			return false
	return true


func tile_of(world_position: Vector2) -> Vector2i:
	return Vector2i(int(floor(world_position.x / float(TILE))), int(floor(world_position.y / float(TILE))))


func world_of(tile_x: int, tile_y: int) -> Vector2:
	return Vector2(tile_x * TILE + TILE * 0.5, tile_y * TILE + TILE * 0.5)


func prop_count() -> int:
	return props_root.get_child_count() if props_root != null else 0


func count_solid_cells() -> int:
	var n := 0
	for token in _solid:
		if token != ".":
			n += 1
	return n


func _load_meta(path: String) -> Dictionary:
	# Read straight from disk: these are build-time JSON documents, and Godot
	# would otherwise import them as resources and hand back a Variant tree with
	# the same shape. A static cache used to sit here; it was never read, and a
	# static Dictionary is exactly the sort of thing that survives a world
	# teardown and shows up as "resources still in use at exit".
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}
