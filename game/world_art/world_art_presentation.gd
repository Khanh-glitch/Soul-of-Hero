class_name WorldArtPresentation
extends Node2D
## A1 visual-only world art presentation.
##
## Consumes compiled `soh.world.art_presentation.v1` data and the shared survival
## atlas. It paints a TileMapLayer ground, y-sorted unscaled prop sprites, bank
## overlays and warm pocket lights, then reuses OverworldOcclusion so the Hero
## stays readable behind tall art. It creates ZERO collision bodies and never
## touches stands, instance ids, rewards, saves, A8 interaction state or Gold.

const OCCLUSION := preload("res://game/overworld/overworld_occlusion.gd")
const AMBIENT_SHADER := preload("res://game/world_art/world_art_ambient.gdshader")
const TILE := 16

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
var _terrain_ids: Dictionary = {}
var _prop_sprites: Array[Sprite2D] = []
var _lights: Array[PointLight2D] = []
var _ambient := Color.WHITE
var _night := 0.0

func load_presentation(presentation_path: String, atlas_path: String) -> bool:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(presentation_path))
	var aparsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(atlas_path))
	if not parsed is Dictionary or not aparsed is Dictionary:
		return false
	data = parsed as Dictionary
	atlas = aparsed as Dictionary
	if String(data.get("schema", "")) != "soh.world.art_presentation.v1":
		return false
	terrain_tex = load(String(atlas["textures"]["terrain"])) as Texture2D
	props_tex = load(String(atlas["textures"]["props"])) as Texture2D
	return terrain_tex != null and props_tex != null

func build(focus: Node2D) -> bool:
	if data.is_empty() or atlas.is_empty():
		return false
	_build_ground()
	_build_overlays()
	_build_props()
	_build_lights()
	occlusion = OCCLUSION.new()
	add_child(occlusion)
	occlusion.configure_sprites(props_root, focus)
	set_time_of_day(0.35)
	return true

func _build_ground() -> void:
	ground = TileMapLayer.new()
	ground.name = "Ground"
	ground.z_index = -10
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
			if _terrain_ids.has(frame):
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
	return s

func _build_overlays() -> void:
	overlay_root = Node2D.new()
	overlay_root.name = "Banks"
	overlay_root.z_index = -9
	add_child(overlay_root)
	for raw: Variant in data.get("overlays", []):
		var o: Dictionary = raw
		overlay_root.add_child(_sprite(String(o.frame), atlas["terrain"], terrain_tex, o.cell, 0))

func _build_props() -> void:
	props_root = Node2D.new()
	props_root.name = "Props"
	props_root.y_sort_enabled = true
	props_root.z_index = 1
	add_child(props_root)
	_prop_sprites.clear()
	for raw: Variant in data.get("props", []):
		var p: Dictionary = raw
		var frame := String(p.frame)
		if not atlas["props"].has(frame):
			continue
		var s := _sprite(frame, atlas["props"], props_tex, p.cell, 0)
		s.name = String(p.get("id", frame)).replace(":", "_").replace("/", "_")
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
		light.set_meta("base_energy", light.energy)
		light.range_item_cull_mask = 1
		lights_root.add_child(light)
		_lights.append(light)

func set_time_of_day(t: float) -> void:
	var day := Color(float(data["ambient_day"][0]), float(data["ambient_day"][1]), float(data["ambient_day"][2]), 1.0)
	var night := Color(float(data["ambient_night"][0]), float(data["ambient_night"][1]), float(data["ambient_night"][2]), 1.0)
	var dusk := smoothstep(0.62, 0.86, t)
	var dawn := 1.0 - smoothstep(0.12, 0.30, t)
	_night = clampf(maxf(dusk, dawn), 0.0, 1.0)
	_ambient = day.lerp(night, _night)
	if ambient_material != null:
		ambient_material.set_shader_parameter("ambient_color", _ambient)
	for s: Sprite2D in _prop_sprites:
		s.modulate = _ambient
	for light: PointLight2D in _lights:
		light.energy = float(light.get_meta("base_energy", 0.8)) * (0.15 + 0.85 * _night)

func snap_occlusion() -> void:
	if occlusion != null:
		occlusion.snap()

func stats() -> Dictionary:
	return {
		"treatment_id": String(data.get("treatment_id", "")),
		"ground_cells": int(data.get("counts", {}).get("ground_cells", 0)),
		"props": _prop_sprites.size(),
		"lights": _lights.size(),
		"occluders": occlusion.occluder_count() if occlusion != null else 0,
		"collision_bodies": 0,
		"night_factor": _night,
		"production_native_playable": false,
	}
