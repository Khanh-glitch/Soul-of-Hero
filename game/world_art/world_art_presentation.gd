class_name WorldArtPresentation
extends Node2D
## A1 visual-only world art presentation.
##
## Consumes compiled `soh.world.art_presentation.v1` data and the shared survival
## atlas. It paints an opaque TileMapLayer ground, road/bank overlays, y-sorted
## unscaled prop sprites and warm pocket lights, then reuses OverworldOcclusion
## so the Hero stays readable behind tall art. It creates ZERO collision bodies
## and never touches stands, instance ids, rewards, saves, A8 interaction state
## or Gold. World lights use a private cull mask so inherited Gold / Hero VFX
## keep their original lighting and colors.

const OCCLUSION := preload("res://game/overworld/overworld_occlusion.gd")
const AMBIENT_SHADER := preload("res://game/world_art/world_art_ambient.gdshader")
const TILE := 16
const WORLD_LIGHT_MASK := 2
const DEFAULT_LIGHT_MASK := 1

var data: Dictionary = {}
var atlas: Dictionary = {}
var ground: TileMapLayer
var overlay_root: Node2D
var props_root: Node2D
var lights_root: Node2D
var occlusion: OverworldOcclusion
var ambient_material: ShaderMaterial
var terrain_tex: Texture2D
var props_tex: Texture2D
var last_error := ""
var _terrain_ids: Dictionary = {}
var _prop_sprites: Array[Sprite2D] = []
var _overlay_sprites: Array[Sprite2D] = []
var _lights: Array[PointLight2D] = []
var _ambient := Color.WHITE
var _night := 0.0
var _built := false
var _focus: Node2D

func _ready() -> void:
	set_process(false)

func _fail(message: String) -> bool:
	last_error = message
	push_error("WorldArtPresentation: " + message)
	return false

func _is_cell(value: Variant) -> bool:
	if not value is Array:
		return false
	var a: Array = value
	return a.size() == 2 and (a[0] is int or a[0] is float) and (a[1] is int or a[1] is float)

func _validate_document(doc: Dictionary, manifest: Dictionary) -> bool:
	if String(doc.get("schema", "")) != "soh.world.art_presentation.v1":
		return _fail("unexpected presentation schema")
	if int(doc.get("tile_px", 0)) != TILE:
		return _fail("presentation tile size is not 16 px")
	if not String(doc.get("authority", "")).contains("VISUAL_ONLY"):
		return _fail("presentation is not scoped visual-only")
	if bool(doc.get("collision_change", true)) or bool(doc.get("stand_change", true)) \
			or bool(doc.get("economy_change", true)) or int(doc.get("new_poi_count", -1)) != 0:
		return _fail("presentation claims gameplay authority")
	if String(manifest.get("schema", "")) != "soh.world.art_atlas.v1" or int(manifest.get("tile_px", 0)) != TILE:
		return _fail("unexpected atlas schema or tile size")
	var textures: Dictionary = manifest.get("textures", {})
	if not textures.has("terrain") or not textures.has("props"):
		return _fail("atlas textures missing")
	var terrain_frames: Dictionary = manifest.get("terrain", {})
	var prop_frames: Dictionary = manifest.get("props", {})
	if terrain_frames.is_empty() or prop_frames.is_empty():
		return _fail("atlas frame tables missing")
	var g: Dictionary = doc.get("ground", {})
	var size: Array = g.get("size_cells", [])
	var rows: Array = g.get("rows", [])
	if not _is_cell(g.get("origin_cell")) or not _is_cell(size) or rows.size() != int(size[1]):
		return _fail("ground dimensions invalid")
	for row_raw: Variant in rows:
		if not row_raw is Array:
			return _fail("ground row is not an array")
		var row: Array = row_raw
		if row.size() != int(size[0]):
			return _fail("ground row width mismatch")
		for frame_raw: Variant in row:
			if not terrain_frames.has(String(frame_raw)):
				return _fail("unknown ground frame " + String(frame_raw))
	for o_raw: Variant in doc.get("overlays", []):
		if not o_raw is Dictionary:
			return _fail("overlay is not an object")
		var o: Dictionary = o_raw
		if not terrain_frames.has(String(o.get("frame", ""))) or not _is_cell(o.get("cell")):
			return _fail("overlay frame/cell invalid")
	for p_raw: Variant in doc.get("props", []):
		if not p_raw is Dictionary:
			return _fail("prop is not an object")
		var p: Dictionary = p_raw
		var frame := String(p.get("frame", ""))
		if not prop_frames.has(frame) or not _is_cell(p.get("cell")):
			return _fail("prop frame/cell invalid: " + frame)
		if bool(p.get("collision_change", true)):
			return _fail("prop claims collision authority: " + frame)
		if p.has("scale") and not is_equal_approx(float(p.scale), 1.0):
			return _fail("non-integer prop scale rejected: " + frame)
		var cell: Array = p.cell
		var expected := Vector2(float(cell[0]) * TILE + 8, float(cell[1]) * TILE + 16)
		var feet: Array = p.get("world_px", [])
		if feet.size() != 2 or not Vector2(float(feet[0]), float(feet[1])).is_equal_approx(expected):
			return _fail("prop feet anchor mismatch: " + frame)
	for l_raw: Variant in doc.get("lights", []):
		if not l_raw is Dictionary:
			return _fail("light is not an object")
		var l: Dictionary = l_raw
		if not _is_cell(l.get("world_px")):
			return _fail("light position invalid")
	return true

func load_presentation(presentation_path: String, atlas_path: String) -> bool:
	last_error = ""
	if not FileAccess.file_exists(presentation_path) or not FileAccess.file_exists(atlas_path):
		return _fail("presentation or atlas path missing")
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(presentation_path))
	var aparsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(atlas_path))
	if not parsed is Dictionary or not aparsed is Dictionary:
		return _fail("presentation or atlas JSON is not an object")
	var doc: Dictionary = parsed
	var manifest: Dictionary = aparsed
	if not _validate_document(doc, manifest):
		return false
	var ttex := load(String(manifest["textures"]["terrain"])) as Texture2D
	var ptex := load(String(manifest["textures"]["props"])) as Texture2D
	if ttex == null or ptex == null:
		return _fail("atlas textures failed to load")
	data = doc
	atlas = manifest
	terrain_tex = ttex
	props_tex = ptex
	return true

func build(focus: Node2D) -> bool:
	if data.is_empty() or atlas.is_empty():
		return _fail("build called before a valid load_presentation")
	if focus == null or not is_instance_valid(focus):
		return _fail("build requires a live focus node")
	clear()
	_focus = focus
	_build_ground()
	_build_overlays()
	_build_props()
	_build_lights()
	occlusion = OCCLUSION.new()
	occlusion.name = "ArtOcclusion"
	add_child(occlusion)
	occlusion.configure_sprites(props_root, _focus)
	_built = true
	set_time_of_day(0.35)
	snap_occlusion()
	set_process(true)
	return true

## Rebind after the host reparents the Hero into `props_root` for foot sorting.
func bind_focus(focus: Node2D) -> bool:
	if not _built or focus == null or not is_instance_valid(focus):
		return _fail("bind_focus requires a built presentation and live focus")
	_focus = focus
	if occlusion != null:
		occlusion.configure_sprites(props_root, _focus)
		snap_occlusion()
	return true

func _detach_focus() -> void:
	if _focus != null and is_instance_valid(_focus) and props_root != null \
			and _focus.get_parent() == props_root and get_parent() != null:
		_focus.reparent(get_parent())

func clear() -> void:
	set_process(false)
	_detach_focus()
	if occlusion != null and is_instance_valid(occlusion):
		occlusion.release_materials()
		occlusion.queue_free()
	occlusion = null
	for node: Node in [ground, overlay_root, props_root, lights_root]:
		if node != null and is_instance_valid(node):
			node.queue_free()
	ground = null
	overlay_root = null
	props_root = null
	lights_root = null
	ambient_material = null
	_terrain_ids.clear()
	_prop_sprites.clear()
	_overlay_sprites.clear()
	_lights.clear()
	_built = false

func _process(delta: float) -> void:
	if _built and occlusion != null and is_instance_valid(occlusion):
		occlusion.step(delta)

func _build_ground() -> void:
	ground = TileMapLayer.new()
	ground.name = "Ground"
	ground.z_index = -10
	ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	ground.light_mask = WORLD_LIGHT_MASK
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE, TILE)
	var src := TileSetAtlasSource.new()
	src.texture = terrain_tex
	src.texture_region_size = Vector2i(TILE, TILE)
	var source_id := ts.add_source(src)
	var names: Array = atlas["terrain"].keys()
	names.sort()
	for i: int in range(names.size()):
		var name: String = String(names[i])
		var r: Array = atlas["terrain"][name]
		var coord := Vector2i(int(r[0]) / TILE, int(r[1]) / TILE)
		src.create_tile(coord)
		_terrain_ids[name] = coord
	ground.tile_set = ts
	add_child(ground)
	ambient_material = ShaderMaterial.new()
	ambient_material.shader = AMBIENT_SHADER
	ground.material = ambient_material
	var g: Dictionary = data["ground"]
	var origin: Array = g["origin_cell"]
	var rows: Array = g["rows"]
	for y: int in range(rows.size()):
		var row: Array = rows[y]
		for x: int in range(row.size()):
			var frame := String(row[x])
			ground.set_cell(Vector2i(int(origin[0]) + x, int(origin[1]) + y), source_id, _terrain_ids[frame] as Vector2i)

func _sprite(frame: String, sheet: Dictionary, tex: Texture2D, cell: Array, z: int) -> Sprite2D:
	var r: Array = sheet[frame]
	var at := AtlasTexture.new()
	at.atlas = tex
	at.region = Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
	var s := Sprite2D.new()
	s.texture = at
	s.centered = false
	s.position = Vector2(float(cell[0]) * TILE + 8, float(cell[1]) * TILE + 16)
	s.offset = Vector2(-float(r[2]) * 0.5, -float(r[3]))
	s.z_index = z
	s.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	s.light_mask = WORLD_LIGHT_MASK
	s.set_meta("frame_name", frame)
	s.set_meta("a1_visual_only", true)
	return s

func _build_overlays() -> void:
	overlay_root = Node2D.new()
	overlay_root.name = "RoadAndBankOverlays"
	overlay_root.z_index = -9
	overlay_root.light_mask = WORLD_LIGHT_MASK
	add_child(overlay_root)
	_overlay_sprites.clear()
	for raw: Variant in data.get("overlays", []):
		var o: Dictionary = raw
		var layer := String(o.get("layer", "bank"))
		var s := _sprite(String(o.frame), atlas["terrain"], terrain_tex, o.cell, 1 if layer == "road" else 0)
		s.name = "Overlay_" + layer + "_" + String(o.frame)
		overlay_root.add_child(s)
		_overlay_sprites.append(s)

func _build_props() -> void:
	props_root = Node2D.new()
	props_root.name = "Props"
	props_root.y_sort_enabled = true
	props_root.z_index = 0
	props_root.light_mask = WORLD_LIGHT_MASK
	add_child(props_root)
	_prop_sprites.clear()
	for raw: Variant in data.get("props", []):
		var p: Dictionary = raw
		var frame := String(p.frame)
		var s := _sprite(frame, atlas["props"], props_tex, p.cell, 0)
		s.name = String(p.get("id", frame)).replace(":", "_").replace("/", "_")
		s.set_meta("semantic_role", String(p.get("role", "")))
		props_root.add_child(s)
		_prop_sprites.append(s)

func _light_texture() -> GradientTexture2D:
	var grad := Gradient.new()
	grad.colors = PackedColorArray([Color(1, 1, 1, 0.85), Color(1, 1, 1, 0.0)])
	grad.offsets = PackedFloat32Array([0.0, 1.0])
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.width = 128
	tex.height = 128
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(0.5, 0.0)
	return tex

func _build_lights() -> void:
	lights_root = Node2D.new()
	lights_root.name = "WarmLights"
	lights_root.z_index = 2
	add_child(lights_root)
	_lights.clear()
	var tex := _light_texture()
	for raw: Variant in data.get("lights", []):
		var l: Dictionary = raw
		var light := PointLight2D.new()
		light.texture = tex
		light.position = Vector2(float(l["world_px"][0]), float(l["world_px"][1]))
		light.color = Color(1.0, 0.72, 0.38)
		light.blend_mode = Light2D.BLEND_MODE_ADD
		light.energy = float(l.get("energy", 0.8))
		light.shadow_enabled = false
		light.set_meta("base_energy", light.energy)
		# Private mask: only A1 ground/props receive these lights. Gold/Hero VFX
		# stay on the inherited default mask and are never tinted by A1 lamps.
		light.range_item_cull_mask = WORLD_LIGHT_MASK
		light.range_layer_min = -10
		light.range_layer_max = 10
		lights_root.add_child(light)
		_lights.append(light)

func set_time_of_day(t: float) -> void:
	if data.is_empty():
		return
	var day := Color(float(data["ambient_day"][0]), float(data["ambient_day"][1]), float(data["ambient_day"][2]), 1.0)
	var night := Color(float(data["ambient_night"][0]), float(data["ambient_night"][1]), float(data["ambient_night"][2]), 1.0)
	var clamped := clampf(t, 0.0, 1.0)
	var dusk := smoothstep(0.62, 0.86, clamped)
	var dawn := 1.0 - smoothstep(0.12, 0.30, clamped)
	_night = clampf(maxf(dusk, dawn), 0.0, 1.0)
	_ambient = day.lerp(night, _night)
	if ambient_material != null:
		ambient_material.set_shader_parameter("ambient_color", _ambient)
	for s: Sprite2D in _overlay_sprites:
		if is_instance_valid(s):
			s.modulate = _ambient
	for s: Sprite2D in _prop_sprites:
		if is_instance_valid(s):
			s.modulate = _ambient
	for light: PointLight2D in _lights:
		if is_instance_valid(light):
			light.visible = _night > 0.02
			light.energy = float(light.get_meta("base_energy", 0.8)) * (0.15 + 0.85 * _night)

func snap_occlusion() -> void:
	if occlusion != null and is_instance_valid(occlusion):
		occlusion.snap()

func _count_collisions(node: Node, exclude: Node) -> Dictionary:
	var result := {"collision_objects": 0, "areas": 0, "tile_physics_layers": 0}
	if node == exclude:
		return result
	if node is CollisionObject2D:
		result.collision_objects += 1
	if node is Area2D:
		result.areas += 1
	if node is TileMapLayer:
		var ts := (node as TileMapLayer).tile_set
		if ts != null:
			result.tile_physics_layers += ts.get_physics_layers_count()
	for child: Node in node.get_children():
		var sub := _count_collisions(child, exclude)
		result.collision_objects += sub.collision_objects
		result.areas += sub.areas
		result.tile_physics_layers += sub.tile_physics_layers
	return result

func stats() -> Dictionary:
	var counts := _count_collisions(self, _focus)
	return {
		"treatment_id": String(data.get("treatment_id", "")),
		"ground_cells": int(data.get("counts", {}).get("ground_cells", 0)),
		"props": _prop_sprites.size(),
		"overlays": _overlay_sprites.size(),
		"lights": _lights.size(),
		"occluders": occlusion.occluder_count() if occlusion != null and is_instance_valid(occlusion) else 0,
		"faded_occluders": occlusion.faded_count() if occlusion != null and is_instance_valid(occlusion) else 0,
		"collision_bodies": int(counts.collision_objects),
		"interactive_areas": int(counts.areas),
		"tile_physics_layers": int(counts.tile_physics_layers),
		"night_factor": _night,
		"ambient": [_ambient.r, _ambient.g, _ambient.b],
		"world_light_mask": WORLD_LIGHT_MASK,
		"inherited_vfx_light_mask": DEFAULT_LIGHT_MASK,
		"production_native_playable": false,
	}

func performance_snapshot() -> Dictionary:
	return {
		"draw_calls": int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
		"render_objects": int(Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)),
		"process_ms": Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
		"fps": Performance.get_monitor(Performance.TIME_FPS),
	}
