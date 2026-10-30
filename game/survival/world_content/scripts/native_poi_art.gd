class_name NativePoiArt
extends Node2D

## A8 visual-only presentation: 16 px TileMapLayer terrain and source-sized,
## feet-anchored sprites from the pinned SOH atlas. It creates no collision.

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const ART_MANIFEST := "res://data/survival/world_content/a8_art_manifest.v1.json"
const TILE_PX := 16

var _definition: Dictionary = {}
var _layout: Dictionary = {}
var _bounds := Vector2.ZERO
var _columns := 0
var _rows := 0
var _manifest: Dictionary = {}
var _site_state: Dictionary = {}
var _terrain_texture: Texture2D
var _props_texture: Texture2D
var _terrain_layer: TileMapLayer
var _props_root: Node2D
var _terrain_ids: Dictionary = {}


func configure(definition: Dictionary, shell_role: bool = false) -> bool:
	_definition = definition.duplicate(true)
	var visual: Variant = definition.get("visual_layout", {})
	if shell_role:
		visual = definition.get("overworld_shell", {}).get("visual_layout", {})
	if not visual is Dictionary or visual.is_empty():
		return false
	_layout = visual
	_bounds = (
		VECTOR_UTIL.from_pair(definition.get("overworld_shell", {}).get("bounds_px", [128, 128]))
		if shell_role
		else VECTOR_UTIL.from_pair(definition.get("world_bounds", [960, 608]))
	)
	var manifest_file := FileAccess.open(ART_MANIFEST, FileAccess.READ)
	if manifest_file == null:
		return false
	var parsed: Variant = JSON.parse_string(manifest_file.get_as_text())
	manifest_file.close()
	if not parsed is Dictionary or parsed.get("schema") != "soh.a8.local_art_manifest.v1":
		return false
	_manifest = parsed
	_apply_ambient_profile()
	var textures: Dictionary = _manifest.get("textures", {})
	_terrain_texture = load(str(textures.get("terrain", {}).get("path", ""))) as Texture2D
	_props_texture = load(str(textures.get("props", {}).get("path", ""))) as Texture2D
	if _terrain_texture == null or _props_texture == null:
		return false
	_build_ground()
	_build_props()
	return true


func _apply_ambient_profile() -> void:
	var profile_name := str(_layout.get("lighting_profile", "overcast_frontier"))
	var profiles: Dictionary = _manifest.get("lighting_profiles", {})
	var profile: Dictionary = profiles.get(profile_name, {})
	var ambient: Array = profile.get("ambient_day", [])
	if ambient.size() != 4:
		push_error("A8 ambient profile is missing from the pinned A1 grammar: %s" % profile_name)
		return
	modulate = Color(float(ambient[0]), float(ambient[1]), float(ambient[2]), float(ambient[3]))


func set_site_state(state: Dictionary) -> void:
	_site_state = state.duplicate(true)
	if not _definition.is_empty():
		_build_ground()
		_build_props()


func _build_ground() -> void:
	if is_instance_valid(_terrain_layer):
		if _terrain_layer.get_parent() == self:
			remove_child(_terrain_layer)
		_terrain_layer.queue_free()
	_terrain_ids.clear()
	var tile_px := int(_manifest.get("tile_px", TILE_PX))
	if tile_px != TILE_PX:
		push_error("A8 art atlas tile size must remain 16 px")
		return
	var rect := _bounds
	if rect.x <= 0.0 or rect.y <= 0.0 or int(rect.x) % TILE_PX != 0 or int(rect.y) % TILE_PX != 0:
		push_error("A8 visual bounds must be positive multiples of the 16 px tile")
		return
	_columns = int(rect.x) / TILE_PX
	_rows = int(rect.y) / TILE_PX
	var terrain_frames: Dictionary = _manifest.get("terrain_frames", {})
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(TILE_PX, TILE_PX)
	var source := TileSetAtlasSource.new()
	source.texture = _terrain_texture
	source.texture_region_size = Vector2i(TILE_PX, TILE_PX)
	for frame_name: String in terrain_frames:
		var frame: Array = terrain_frames[frame_name]
		if frame.size() != 4 or int(frame[2]) != TILE_PX or int(frame[3]) != TILE_PX:
			continue
		var atlas_cell := Vector2i(
			floori(float(frame[0]) / TILE_PX), floori(float(frame[1]) / TILE_PX)
		)
		if not source.has_tile(atlas_cell):
			source.create_tile(atlas_cell)
		_terrain_ids[frame_name] = atlas_cell
	var source_id := tile_set.add_source(source)
	_terrain_layer = TileMapLayer.new()
	_terrain_layer.name = "A8_16px_Ground"
	_terrain_layer.z_index = -10
	_terrain_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_terrain_layer.tile_set = tile_set
	add_child(_terrain_layer)
	var ground_rows: Array = _layout.get("ground_rows", [])
	if not ground_rows.is_empty():
		for y: int in range(mini(ground_rows.size(), _rows)):
			var row: Array = ground_rows[y]
			for x: int in range(mini(row.size(), _columns)):
				_paint_cell(Vector2i(x, y), str(row[x]), source_id)
		for overlay: Dictionary in _layout.get("overlays", []):
			_paint_cell(
				VECTOR_UTIL.from_int_pair(overlay.get("cell", []), Vector2i(-1, -1)),
				str(overlay.get("frame", "")),
				source_id
			)
	else:
		var base_family := str(_layout.get("ground_family", "ash"))
		for y: int in range(_rows):
			for x: int in range(_columns):
				_paint_cell(Vector2i(x, y), _family_frame(base_family, x, y), source_id)
		for area: Dictionary in _layout.get("ground_areas", []):
			_paint_ellipse(
				VECTOR_UTIL.from_int_pair(area.get("center", []), Vector2i(-1, -1)),
				VECTOR_UTIL.from_int_pair(area.get("radius", []), Vector2i.ZERO),
				str(area.get("family", base_family)),
				source_id
			)
		for path: Dictionary in _layout.get("paths", []):
			_paint_path(path, source_id)
	var state_paths: Dictionary = _layout.get("state_paths", {})
	for state_key: String in state_paths:
		var values: Dictionary = state_paths[state_key]
		var state_value := str(_site_state.get(state_key, ""))
		for path: Dictionary in values.get(state_value, []):
			_paint_path(path, source_id)


func _paint_cell(cell: Vector2i, frame_name: String, source_id: int) -> void:
	if cell.x < 0 or cell.y < 0 or cell.x >= _columns or cell.y >= _rows:
		return
	if frame_name.is_empty() or not _terrain_ids.has(frame_name):
		return
	var atlas_cell: Vector2i = _terrain_ids[frame_name]
	_terrain_layer.set_cell(cell, source_id, atlas_cell)


func _family_frame(family: String, x: int, y: int) -> String:
	var variants: Array[String] = []
	for key: String in _manifest.get("terrain_frames", {}):
		if key.begins_with(family + "_"):
			variants.append(key)
	variants.sort()
	if variants.is_empty():
		return ""
	var pick := posmod(x * 17 + y * 31 + x * y * 3, variants.size())
	return variants[pick]


func _paint_ellipse(center: Vector2i, radius: Vector2i, family: String, source_id: int) -> void:
	if center.x < 0 or center.y < 0 or radius.x <= 0 or radius.y <= 0:
		return
	for y: int in range(center.y - radius.y, center.y + radius.y + 1):
		for x: int in range(center.x - radius.x, center.x + radius.x + 1):
			var dx := float(x - center.x) / float(radius.x)
			var dy := float(y - center.y) / float(radius.y)
			var edge_wear := float(posmod(x * 13 + y * 7 + x * y, 9)) * 0.012
			if dx * dx + dy * dy <= 1.0 + edge_wear:
				_paint_cell(Vector2i(x, y), _family_frame(family, x, y), source_id)


func _paint_path(path: Dictionary, source_id: int) -> void:
	var points: Array = path.get("points", [])
	var width := maxi(1, int(path.get("width", 1)))
	var family := str(path.get("family", "gravel"))
	if points.size() < 2:
		return
	for index: int in range(points.size() - 1):
		var start := VECTOR_UTIL.from_int_pair(points[index], Vector2i(-1, -1))
		var finish := VECTOR_UTIL.from_int_pair(points[index + 1], Vector2i(-1, -1))
		if start.x < 0 or finish.x < 0:
			continue
		var delta := finish - start
		var steps := maxi(absi(delta.x), absi(delta.y))
		for step: int in range(steps + 1):
			var ratio := float(step) / float(maxi(steps, 1))
			var center := Vector2i(
				roundi(lerpf(start.x, finish.x, ratio)), roundi(lerpf(start.y, finish.y, ratio))
			)
			var before := floori(float(width - 1) * 0.5)
			var after := width - before
			for y: int in range(center.y - before, center.y + after):
				for x: int in range(center.x - before, center.x + after):
					_paint_cell(Vector2i(x, y), _family_frame(family, x, y), source_id)


func _build_props() -> void:
	if is_instance_valid(_props_root):
		if _props_root.get_parent() == self:
			remove_child(_props_root)
		_props_root.queue_free()
	_props_root = Node2D.new()
	_props_root.name = "A8_SourceSized_Props"
	_props_root.y_sort_enabled = true
	_props_root.z_index = -1
	add_child(_props_root)
	var props: Array = _layout.get("props", []).duplicate(true)
	var hidden_ids: Array[String] = []
	for variant: Dictionary in _layout.get("state_props", []):
		if str(_site_state.get(str(variant.get("key", "")), "")) == str(variant.get("equals", "")):
			props.append_array(variant.get("props", []))
			for hidden_id: String in variant.get("hide_ids", []):
				hidden_ids.append(hidden_id)
	for prop: Dictionary in props:
		if hidden_ids.has(str(prop.get("id", ""))):
			continue
		var sprite := _make_sprite(prop)
		if sprite != null:
			_props_root.add_child(sprite)


func _make_sprite(prop: Dictionary) -> Sprite2D:
	var frame_name := str(prop.get("frame", ""))
	var frame_map: Dictionary = _manifest.get("props_frames", {})
	if not frame_map.has(frame_name):
		return null
	var anchor := Vector2(-1, -1)
	if prop.has("local_px"):
		anchor = VECTOR_UTIL.from_pair(prop.get("local_px", []), Vector2(-1, -1))
		if anchor.x < 0.0 or anchor.y < 0.0:
			return null
		if (
			not is_equal_approx(anchor.x, roundf(anchor.x))
			or not is_equal_approx(anchor.y, roundf(anchor.y))
		):
			return null
	else:
		var cell := VECTOR_UTIL.from_int_pair(prop.get("cell", []), Vector2i(-1, -1))
		if cell.x < 0 or cell.y < 0:
			return null
		anchor = Vector2(float(cell.x * TILE_PX + 8), float(cell.y * TILE_PX + TILE_PX))
	var rect: Array = frame_map[frame_name]
	if rect.size() != 4 or int(rect[2]) <= 0 or int(rect[3]) <= 0:
		return null
	var texture_region := AtlasTexture.new()
	texture_region.atlas = _props_texture
	texture_region.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.name = str(prop.get("id", frame_name)).replace(":", "_").replace("/", "_")
	sprite.texture = texture_region
	sprite.centered = false
	sprite.position = anchor
	sprite.offset = Vector2(-float(floori(float(rect[2]) * 0.5)), -float(rect[3]))
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return sprite
