class_name NativePoiArt
extends Node2D

## A8 visual-only presentation: 16 px TileMapLayer terrain and source-sized,
## feet-anchored sprites from the pinned SOH atlas. It creates no collision.

const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const SURFACE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/native_poi_surface_contract.gd"
)
const ART_MANIFEST := "res://data/survival/world_content/a8_art_manifest.v1.json"
const TILE_PX := 16
const CARDINAL_STEPS := [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]

var _definition: Dictionary = {}
var _layout: Dictionary = {}
var _bounds := Vector2.ZERO
var _columns := 0
var _rows := 0
var _manifest: Dictionary = {}
var _site_state: Dictionary = {}
var _environment_projection: Dictionary = {}
var _surface_contract: Dictionary = {}
var _terrain_texture: Texture2D
var _props_texture: Texture2D
var _surface_texture: Texture2D
var _quarry_lamp_radial: Texture2D
var _terrain_layer: TileMapLayer
var _path_layer: TileMapLayer
var _track_layer: TileMapLayer
var _detail_layer: TileMapLayer
var _surface_layer: TileMapLayer
var _context_layer: TileMapLayer
var _props_root: Node2D
var _terrain_ids: Dictionary = {}
var _surface_ids: Dictionary = {}
var _terrain_source_id := -1
var _surface_source_id := -1
var _animated_props: Array[Dictionary] = []
var _depth_sorted_props: Array[Dictionary] = []
var _depth_actor: Node2D
var _animation_clock := 0.0


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
	_surface_texture = load(str(textures.get("surface", {}).get("path", ""))) as Texture2D
	_quarry_lamp_radial = (
		load(str(textures.get("quarry_lamp_radial", {}).get("path", ""))) as Texture2D
	)
	_surface_contract = SURFACE_SCRIPT.site_surface(
		str(definition.get("source", {}).get("poi_id", ""))
	)
	if (
		_terrain_texture == null
		or _props_texture == null
		or _surface_texture == null
		or _quarry_lamp_radial == null
	):
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
	var next_state := state.duplicate(true)
	if next_state != _site_state:
		_animation_clock = 0.0
	_site_state = next_state
	if not _definition.is_empty():
		_build_ground()
		_build_props()


func _process(delta: float) -> void:
	_animation_clock += delta
	for animation: Dictionary in _animated_props:
		var sprite := animation.get("sprite") as Sprite2D
		if not is_instance_valid(sprite):
			continue
		var rule: Dictionary = animation.get("rule", {})
		var active := (
			str(_site_state.get(str(rule.get("state_key", "")), ""))
			== str(rule.get("state_value", ""))
		)
		if not active:
			sprite.rotation_degrees = 0.0
			continue
		var step_seconds := maxf(0.05, float(rule.get("step_seconds", 0.35)))
		var degrees_per_step := float(rule.get("degrees_per_step", 90.0))
		var step_index := floori(_animation_clock / step_seconds)
		sprite.rotation_degrees = fposmod(float(step_index) * degrees_per_step, 360.0)
	_update_depth_layers()


func set_depth_actor(actor: Node2D) -> void:
	_depth_actor = actor
	_update_depth_layers()


func _update_depth_layers() -> void:
	if not is_instance_valid(_depth_actor):
		return
	for record: Dictionary in _depth_sorted_props:
		var sprite := record.get("sprite") as Sprite2D
		if not is_instance_valid(sprite):
			continue
		# Prop feet are the authored anchor. The source-sized tree canopy moves in
		# front of the actor only when the actor stands behind that anchor.
		sprite.z_index = 1 if _depth_actor.global_position.y < sprite.global_position.y else -1


func get_terrain_frame_at_cell(cell: Vector2i) -> String:
	if not is_instance_valid(_terrain_layer):
		return ""
	for layer: TileMapLayer in [
		_surface_layer, _track_layer, _path_layer, _detail_layer, _terrain_layer
	]:
		if not is_instance_valid(layer):
			continue
		var source_id := layer.get_cell_source_id(cell)
		if source_id < 0:
			continue
		var atlas_cell := layer.get_cell_atlas_coords(cell)
		var frame_map: Dictionary = (
			_surface_ids if source_id == _surface_source_id else _terrain_ids
		)
		for frame_name: String in frame_map:
			if frame_map[frame_name] == atlas_cell:
				return frame_name
	return ""


func set_environment_projection(projection: Dictionary) -> void:
	# Owner values are retained for truthful inspection only. No time/weather/tide
	# behavior is inferred until A0 supplies an approved, site-scoped mapping.
	_environment_projection = projection.duplicate(true)


func get_environment_projection() -> Dictionary:
	return _environment_projection.duplicate(true)


func _build_ground() -> void:
	for layer: TileMapLayer in [
		_context_layer, _terrain_layer, _path_layer, _track_layer, _detail_layer, _surface_layer
	]:
		if is_instance_valid(layer):
			if layer.get_parent() == self:
				remove_child(layer)
			layer.queue_free()
	_terrain_ids.clear()
	_surface_ids.clear()
	_terrain_source_id = -1
	_surface_source_id = -1
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
	_terrain_source_id = source_id
	var surface_source_id := -1
	var surface_frames: Dictionary = _manifest.get("surface_frames", {})
	if not surface_frames.is_empty():
		var surface_source := TileSetAtlasSource.new()
		surface_source.texture = _surface_texture
		surface_source.texture_region_size = Vector2i(TILE_PX, TILE_PX)
		for frame_name: String in surface_frames:
			var frame: Array = surface_frames[frame_name]
			if frame.size() != 4 or int(frame[2]) != TILE_PX or int(frame[3]) != TILE_PX:
				continue
			var atlas_cell := Vector2i(
				floori(float(frame[0]) / TILE_PX), floori(float(frame[1]) / TILE_PX)
			)
			if not surface_source.has_tile(atlas_cell):
				surface_source.create_tile(atlas_cell)
			_surface_ids[frame_name] = atlas_cell
		surface_source_id = tile_set.add_source(surface_source)
		_surface_source_id = surface_source_id
	_context_layer = TileMapLayer.new()
	_context_layer.name = "A8_SourceBacked_EnvironmentContext"
	_context_layer.z_index = -11
	_context_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_context_layer.tile_set = tile_set
	add_child(_context_layer)
	_terrain_layer = TileMapLayer.new()
	_terrain_layer.name = "A8_16px_Ground"
	_terrain_layer.z_index = -10
	_terrain_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_terrain_layer.tile_set = tile_set
	add_child(_terrain_layer)
	_path_layer = TileMapLayer.new()
	_path_layer.name = "A8_SourceBacked_Roads_Tracks_And_Water"
	_path_layer.z_index = -9
	_path_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_path_layer.tile_set = tile_set
	add_child(_path_layer)
	_track_layer = TileMapLayer.new()
	_track_layer.name = "A8_SourceBacked_Track_Overlays"
	_track_layer.z_index = -8
	_track_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_track_layer.tile_set = tile_set
	add_child(_track_layer)
	_detail_layer = TileMapLayer.new()
	_detail_layer.name = "A8_SourceBacked_Details"
	_detail_layer.z_index = -6
	_detail_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_detail_layer.tile_set = tile_set
	add_child(_detail_layer)
	_surface_layer = TileMapLayer.new()
	_surface_layer.name = "A8_Surface_Affordances"
	_surface_layer.z_index = -7
	_surface_layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_surface_layer.tile_set = tile_set
	add_child(_surface_layer)
	_build_context_ground(source_id)
	var ground_rows: Array = _layout.get("ground_rows", [])
	if not ground_rows.is_empty():
		for y: int in range(mini(ground_rows.size(), _rows)):
			var row: Array = ground_rows[y]
			for x: int in range(mini(row.size(), _columns)):
				_paint_cell(Vector2i(x, y), str(row[x]), source_id)
	else:
		var materials := _build_material_grid(str(_layout.get("ground_family", "ash")))
		_paint_material_grid(materials, source_id)
		_paint_material_transitions(materials, source_id)
	var path_cells: Dictionary = {}
	for path: Dictionary in _layout.get("paths", []):
		_collect_path_cells(path, path_cells)
	var state_paths: Dictionary = _layout.get("state_paths", {})
	for state_key: String in state_paths:
		var values: Dictionary = state_paths[state_key]
		var state_value := str(_site_state.get(state_key, ""))
		for path: Dictionary in values.get(state_value, []):
			_collect_path_cells(path, path_cells)
	_paint_path_cells(path_cells, source_id, _path_layer)
	var track_cells: Dictionary = {}
	for path: Dictionary in _layout.get("track_paths", []):
		_collect_path_cells(path, track_cells)
	var state_track_paths: Dictionary = _layout.get("state_track_paths", {})
	for state_key: String in state_track_paths:
		var values: Dictionary = state_track_paths[state_key]
		var state_value := str(_site_state.get(state_key, ""))
		for path: Dictionary in values.get(state_value, []):
			_collect_path_cells(path, track_cells)
	_paint_path_cells(track_cells, source_id, _track_layer)
	for overlay: Dictionary in _layout.get("overlays", []):
		_paint_overlay(overlay, source_id)
	for variant: Dictionary in _layout.get("state_overlays", []):
		if str(_site_state.get(str(variant.get("key", "")), "")) != str(variant.get("equals", "")):
			continue
		for overlay: Dictionary in variant.get("overlays", []):
			_paint_overlay(overlay, source_id)
	_paint_surface_contract(source_id, surface_source_id)


func _build_material_grid(base_family: String) -> Dictionary:
	var materials: Dictionary = {}
	for y: int in range(_rows):
		for x: int in range(_columns):
			materials[Vector2i(x, y)] = base_family
	for area: Dictionary in _layout.get("ground_areas", []):
		var center := VECTOR_UTIL.from_int_pair(area.get("center", []), Vector2i(-1, -1))
		var radius := VECTOR_UTIL.from_int_pair(area.get("radius", []), Vector2i.ZERO)
		_stamp_material_ellipse(materials, center, radius, str(area.get("family", base_family)))
	return materials


func _stamp_material_ellipse(
	materials: Dictionary, center: Vector2i, radius: Vector2i, family: String
) -> void:
	if center.x < 0 or center.y < 0 or radius.x <= 0 or radius.y <= 0:
		return
	for y: int in range(center.y - radius.y, center.y + radius.y + 1):
		for x: int in range(center.x - radius.x, center.x + radius.x + 1):
			var cell := Vector2i(x, y)
			if x < 0 or y < 0 or x >= _columns or y >= _rows:
				continue
			var dx := float(x - center.x) / float(radius.x)
			var dy := float(y - center.y) / float(radius.y)
			var edge_wear := float(posmod(x * 13 + y * 7 + x * y, 9)) * 0.012
			if dx * dx + dy * dy <= 1.0 + edge_wear:
				materials[cell] = family


func _paint_material_grid(materials: Dictionary, source_id: int) -> void:
	for cell_value: Variant in materials:
		var cell: Vector2i = cell_value
		var family := str(materials[cell])
		_paint_cell(cell, _family_frame(family, cell.x, cell.y), source_id)


func _paint_material_transitions(materials: Dictionary, source_id: int) -> void:
	for cell_value: Variant in materials:
		var cell: Vector2i = cell_value
		var family := str(materials[cell])
		var mask := 0
		var blend_counts: Dictionary = {}
		for index: int in range(CARDINAL_STEPS.size()):
			var neighbor_family := str(materials.get(cell + CARDINAL_STEPS[index], ""))
			if neighbor_family == family:
				mask |= 1 << index
			elif not neighbor_family.is_empty():
				var prefix := "blend_%s_%s_" % [neighbor_family, family]
				if _terrain_ids.has(prefix + "0"):
					blend_counts[prefix] = int(blend_counts.get(prefix, 0)) + 1
		var chosen_prefix := ""
		var chosen_count := 0
		for prefix_value: Variant in blend_counts:
			var prefix := str(prefix_value)
			var count := int(blend_counts[prefix])
			if count > chosen_count:
				chosen_prefix = prefix
				chosen_count = count
		if not chosen_prefix.is_empty():
			var transition_frame := chosen_prefix + str(mask)
			if _terrain_ids.has(transition_frame):
				_paint_cell(cell, transition_frame, source_id)


func _collect_path_cells(path: Dictionary, path_cells: Dictionary) -> void:
	var points: Array = path.get("points", [])
	var width := maxi(1, int(path.get("width", 1)))
	var family := str(path.get("family", "gravel"))
	if points.size() < 2:
		return
	for index: int in range(points.size() - 1):
		var start := VECTOR_UTIL.from_int_pair(points[index], Vector2i(-1, -1))
		var finish := VECTOR_UTIL.from_int_pair(points[index + 1], Vector2i(-1, -1))
		if start.x < 0 or start.y < 0 or finish.x < 0 or finish.y < 0:
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
					if x >= 0 and y >= 0 and x < _columns and y < _rows:
						path_cells[Vector2i(x, y)] = family


func _paint_path_cells(path_cells: Dictionary, source_id: int, target_layer: TileMapLayer) -> void:
	for cell_value: Variant in path_cells:
		var cell: Vector2i = cell_value
		var family := str(path_cells[cell])
		var mask := 0
		for index: int in range(CARDINAL_STEPS.size()):
			if str(path_cells.get(cell + CARDINAL_STEPS[index], "")) == family:
				mask |= 1 << index
		var frame_name := family + "_" + str(mask)
		if not _terrain_ids.has(frame_name):
			frame_name = _family_frame(family, cell.x, cell.y)
		if (
			is_instance_valid(target_layer)
			and _terrain_ids.has(frame_name)
			and cell.x >= 0
			and cell.y >= 0
			and cell.x < _columns
			and cell.y < _rows
		):
			target_layer.set_cell(cell, source_id, _terrain_ids[frame_name])


func _paint_overlay(overlay: Dictionary, source_id: int) -> void:
	var cell := VECTOR_UTIL.from_int_pair(overlay.get("cell", []), Vector2i(-1, -1))
	var frame_name := str(overlay.get("frame", ""))
	if (
		is_instance_valid(_detail_layer)
		and _terrain_ids.has(frame_name)
		and cell.x >= 0
		and cell.y >= 0
		and cell.x < _columns
		and cell.y < _rows
	):
		_detail_layer.set_cell(cell, source_id, _terrain_ids[frame_name])


func _build_context_ground(source_id: int) -> void:
	var context: Variant = _layout.get("context_ground", {})
	if not context is Dictionary or context.is_empty() or not is_instance_valid(_context_layer):
		return
	var size_px := VECTOR_UTIL.from_pair(context.get("size_px", [0, 0]), Vector2.ZERO)
	var origin_px := VECTOR_UTIL.from_pair(context.get("origin_px", [0, 0]), Vector2.ZERO)
	var family := str(context.get("ground_family", ""))
	if size_px.x <= 0.0 or size_px.y <= 0.0 or family.is_empty():
		return
	var start_x := floori(origin_px.x / TILE_PX)
	var start_y := floori(origin_px.y / TILE_PX)
	var end_x := ceili((origin_px.x + size_px.x) / TILE_PX)
	var end_y := ceili((origin_px.y + size_px.y) / TILE_PX)
	for y: int in range(start_y, end_y):
		for x: int in range(start_x, end_x):
			var frame_name := _family_frame(family, x, y)
			if _terrain_ids.has(frame_name):
				_context_layer.set_cell(Vector2i(x, y), source_id, _terrain_ids[frame_name])
	for path: Dictionary in context.get("paths", []):
		_paint_context_path(path, source_id)


func _paint_context_path(path: Dictionary, source_id: int) -> void:
	var points: Array = path.get("points", [])
	var width := maxi(1, int(path.get("width", 1)))
	var family := str(path.get("family", "gravel"))
	if points.size() < 2:
		return
	for index: int in range(points.size() - 1):
		var start := VECTOR_UTIL.from_int_pair(points[index], Vector2i(-1, -1))
		var finish := VECTOR_UTIL.from_int_pair(points[index + 1], Vector2i(-1, -1))
		if start.x < 0 or start.y < 0 or finish.x < 0 or finish.y < 0:
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
					var frame_name := _family_frame(family, x, y)
					if _terrain_ids.has(frame_name):
						_context_layer.set_cell(Vector2i(x, y), source_id, _terrain_ids[frame_name])


func _paint_surface_contract(terrain_source_id: int, surface_source_id: int) -> void:
	if surface_source_id < 0 or _surface_contract.is_empty():
		return
	var classes: Dictionary = SURFACE_SCRIPT.load_contract().get("surface_classes", {})
	for zone: Dictionary in _surface_contract.get("zones", []):
		var surface_class := str(zone.get("surface_class", ""))
		var class_data: Dictionary = classes.get(surface_class, {})
		var frames: Array = class_data.get("presentation_frames", [])
		var cells: Array = zone.get("tile_overlay_cells", [])
		if frames.is_empty():
			continue
		for cell_pair: Variant in cells:
			var cell := VECTOR_UTIL.from_int_pair(cell_pair, Vector2i(-1, -1))
			if cell.x < 0 or cell.y < 0 or cell.x >= _columns or cell.y >= _rows:
				continue
			var pick := posmod(cell.x * 17 + cell.y * 31 + cell.x * cell.y * 3, frames.size())
			_paint_surface_cell(cell, str(frames[pick]), terrain_source_id, surface_source_id)


func _paint_surface_cell(
	cell: Vector2i, frame_name: String, terrain_source_id: int, surface_source_id: int
) -> void:
	if _surface_ids.has(frame_name):
		_surface_layer.set_cell(cell, surface_source_id, _surface_ids[frame_name])
	elif _terrain_ids.has(frame_name):
		_surface_layer.set_cell(cell, terrain_source_id, _terrain_ids[frame_name])


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


func _build_props() -> void:
	_animated_props.clear()
	_depth_sorted_props.clear()
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
	var frame_map: Dictionary = _manifest.get("props_frames", {})
	for prop: Dictionary in props:
		if hidden_ids.has(str(prop.get("id", ""))):
			continue
		var sprite := _make_sprite(prop)
		if sprite == null:
			continue
		_props_root.add_child(sprite)
		if bool(prop.get("occludes_actor", false)):
			_depth_sorted_props.append({"sprite": sprite})
		var light_data: Variant = prop.get("local_light", {})
		if light_data is Dictionary and not light_data.is_empty():
			_add_local_light(sprite, light_data, frame_map.get(str(prop.get("frame", "")), []))
		var rotation_animation: Variant = prop.get("rotation_animation", {})
		if rotation_animation is Dictionary and not rotation_animation.is_empty():
			var frame_rect: Array = frame_map.get(str(prop.get("frame", "")), [])
			if frame_rect.size() == 4:
				sprite.centered = true
				sprite.position += Vector2(0.0, -float(frame_rect[3]) * 0.5)
				sprite.offset = Vector2.ZERO
				_animated_props.append(
					{"sprite": sprite, "rule": rotation_animation.duplicate(true)}
				)
	_update_depth_layers()


func _add_local_light(sprite: Sprite2D, light_data: Dictionary, frame_rect: Array) -> void:
	if _quarry_lamp_radial == null or frame_rect.size() != 4:
		return
	var light := PointLight2D.new()
	light.name = "A1_SourceBacked_LocalLampLight"
	light.texture = _quarry_lamp_radial
	light.texture_scale = float(light_data.get("texture_scale", 0.55))
	light.energy = float(light_data.get("energy", 0.42))
	light.color = Color(str(light_data.get("color", "#ffc77a")))
	light.blend_mode = PointLight2D.BLEND_MODE_ADD
	light.shadow_enabled = false
	light.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	light.position = Vector2(0.0, -float(frame_rect[3]) * 0.74)
	sprite.add_child(light)


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
	sprite.z_as_relative = false
	sprite.z_index = -1
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return sprite
