extends Node2D
## Round 12 bounded live source-chunk streamer.
##
## Renders accepted A1 windows where authored and deterministic source-surface
## tiles elsewhere. Terrain collision comes from walk; the legacy inset remains
## A0 OverworldWorld authority. Resource/POI sprites are source proxies only.
## No SaveService, reward, health, Gold or A8 interaction implementation.

const READER := preload("res://game/survival/world/a1_authored_world_reader.gd")
const AMBIENT_SHADER := preload("res://game/world_art/world_art_ambient.gdshader")
const OCCLUSION := preload("res://game/overworld/overworld_occlusion.gd")
const TILE := 16
const CHUNK := 64
const CHUNK_PX := 1024
const WORLD_LIGHT_MASK := 2
const SOURCE_MATERIAL := {
	"grass": "grass", "moor": "moor", "gravel": "gravel", "floor": "silt",
	"snow": "snow", "forest": "forest", "tundra": "tundra", "sand": "dune",
	"ash": "ash", "badland": "cinder", "salt": "salt", "jungle": "jungle",
	"karst": "karst", "marsh": "reedpeat", "mangrove": "mangrove", "mud": "mud",
	"orchard": "soil", "bog": "fen", "road": "soil", "bridge": "gravel", "legacy": "gravel",
}

var reader: Variant = null
var plan: Dictionary = {}
var contract: Dictionary = {}
var atlas: Dictionary = {}
var last_error := ""
var render_legacy := false
var loaded_chunks: Dictionary = {}
var stream_events: Array = []
var mount_ms: Dictionary = {}
var max_loaded_chunks := 0
var current_region := "r_ashen_crown"
var chunk_root: Node2D
var collision_root: Node2D
var overlay_root: Node2D
var props_root: Node2D
var lights_root: Node2D
var occlusion: OverworldOcclusion
var _focus: Node2D
var _built := false
var _tiles: TileSet
var _tile_source := 0
var _terrain_coords: Dictionary = {}
var _terrain_texture: Texture2D
var _props_texture: Texture2D
var _legacy_props_texture: Texture2D
var _ambient_material: ShaderMaterial
var _light_texture: GradientTexture2D
var _ground_overrides: Dictionary = {}
var _curated_overlays: Dictionary = {}
var _curated_props: Dictionary = {}
var _curated_lights: Dictionary = {}
var _curated_resource_ids: Dictionary = {}
var _curated_poi_ids: Dictionary = {}
var _curated_instance_ids: Dictionary = {}
var _region_ambient: Dictionary = {}
var _a8_poi_ids: Dictionary = {}
var _structures: Dictionary = {}
var _structures_by_chunk: Dictionary = {}
var _stream_rect := Rect2()
var _stream_center := Vector2.INF
var _last_event_chunk := ""
var _time_of_day := 0.35
var _night := 0.0


func _ready() -> void:
	set_process(false)


func configure(world_root: String = "res://data/survival/world", reader_instance: Variant = null,
		render_legacy_inset: bool = false) -> bool:
	last_error = ""
	render_legacy = render_legacy_inset
	reader = reader_instance if reader_instance != null else READER.new()
	if not bool(reader.is_ready()) and not bool(reader.configure(world_root)):
		last_error = "reader:" + String(reader.last_error)
		return false
	plan = reader.plan
	contract = reader.runtime_contract
	if not _load_visual_sources():
		return false
	_build_tiles()
	_build_roots()
	_built = true
	set_process(true)
	return true


func _json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}


func _load_visual_sources() -> bool:
	var pins: Dictionary = contract.source_pins
	atlas = _json("res://" + String((pins.atlas as Dictionary).path))
	if atlas.is_empty():
		last_error = "atlas_parse"
		return false
	_terrain_texture = load(String((atlas.textures as Dictionary).terrain)) as Texture2D
	_props_texture = load(String((atlas.textures as Dictionary).props)) as Texture2D
	_legacy_props_texture = load("res://assets/environment/overworld/overworld_props.png") as Texture2D
	if _terrain_texture == null or _props_texture == null or _legacy_props_texture == null:
		last_error = "visual_texture_load"
		return false
	var index := _json("res://" + String((pins.presentations as Dictionary).path))
	var presentations: Array = index.get("presentations", [])
	if presentations.size() != 11:
		last_error = "presentation_count"
		return false
	for raw: Variant in presentations:
		var entry := raw as Dictionary
		var path := String(entry.path)
		if FileAccess.get_sha256("res://" + path) != String(entry.sha256):
			last_error = "presentation_hash:" + path
			return false
		var doc := _json("res://" + path)
		if String(doc.get("schema", "")) != "soh.world.art_presentation.v1" \
				or bool(doc.get("collision_change", true)) or bool(doc.get("stand_change", true)) \
				or bool(doc.get("economy_change", true)) or int(doc.get("new_poi_count", -1)) != 0:
			last_error = "presentation_authority:" + path
			return false
		var region := String(doc.region_id)
		_region_ambient[region] = {"day": doc.ambient_day, "night": doc.ambient_night}
		var ground: Dictionary = doc.ground
		var origin: Array = ground.origin_cell
		var size: Array = ground.size_cells
		var rows: Array = ground.rows
		for y: int in range(rows.size()):
			var row: Array = rows[y]
			for x: int in range(row.size()):
				var cell := Vector2i(int(origin[0]) + x, int(origin[1]) + y)
				if cell.x < 0 or cell.y < 0 or cell.x >= 1024 or cell.y >= 768:
					last_error = "presentation_ground_bounds"
					return false
				_ground_overrides[cell.y * 1024 + cell.x] = String(row[x])
		for overlay_raw: Variant in doc.get("overlays", []):
			var overlay := overlay_raw as Dictionary
			var cell: Array = overlay.cell
			var cid := String(reader.chunk_id_at(Vector2i(int(cell[0]), int(cell[1]))))
			if not _curated_overlays.has(cid):
				_curated_overlays[cid] = []
			(_curated_overlays[cid] as Array).append(overlay)
		for prop_raw: Variant in doc.get("props", []):
			var prop := prop_raw as Dictionary
			var cell: Array = prop.cell
			var cid := String(reader.chunk_id_at(Vector2i(int(cell[0]), int(cell[1]))))
			if not _curated_props.has(cid):
				_curated_props[cid] = []
			(_curated_props[cid] as Array).append(prop)
			if prop.has("node_id"):
				_curated_resource_ids[String(prop.node_id)] = true
			if prop.has("poi_id"):
				_curated_poi_ids[String(prop.poi_id)] = true
			if prop.has("instance_id"):
				_curated_instance_ids[String(prop.instance_id)] = true
		for light_raw: Variant in doc.get("lights", []):
			var light := light_raw as Dictionary
			var cell: Array = light.cell
			var cid := String(reader.chunk_id_at(Vector2i(int(cell[0]), int(cell[1]))))
			if not _curated_lights.has(cid):
				_curated_lights[cid] = []
			(_curated_lights[cid] as Array).append(light)
	for key: String in (contract.physical_sites as Dictionary):
		var spec: Dictionary = contract.physical_sites[key]
		_a8_poi_ids[String(spec.poi_id)] = true
	return true


func _build_tiles() -> void:
	_tiles = TileSet.new()
	_tiles.tile_size = Vector2i(TILE, TILE)
	var source := TileSetAtlasSource.new()
	source.texture = _terrain_texture
	source.texture_region_size = Vector2i(TILE, TILE)
	_tile_source = _tiles.add_source(source)
	for frame: String in atlas.terrain:
		var rect: Array = atlas.terrain[frame]
		var coord := Vector2i(int(rect[0]) / TILE, int(rect[1]) / TILE)
		source.create_tile(coord)
		_terrain_coords[frame] = coord
	_ambient_material = ShaderMaterial.new()
	_ambient_material.shader = AMBIENT_SHADER
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color(1, 1, 1, 0.85), Color(1, 1, 1, 0)])
	gradient.offsets = PackedFloat32Array([0.0, 1.0])
	_light_texture = GradientTexture2D.new()
	_light_texture.gradient = gradient
	_light_texture.width = 96
	_light_texture.height = 96
	_light_texture.fill = GradientTexture2D.FILL_RADIAL
	_light_texture.fill_from = Vector2(0.5, 0.5)
	_light_texture.fill_to = Vector2(1, 1)


func _build_roots() -> void:
	chunk_root = Node2D.new()
	chunk_root.name = "SourceGround"
	add_child(chunk_root)
	collision_root = Node2D.new()
	collision_root.name = "SourceCollision"
	add_child(collision_root)
	overlay_root = Node2D.new()
	overlay_root.name = "SourceOverlays"
	add_child(overlay_root)
	props_root = Node2D.new()
	props_root.name = "SourceProps"
	props_root.y_sort_enabled = true
	add_child(props_root)
	lights_root = Node2D.new()
	lights_root.name = "SourcePrivateLights"
	add_child(lights_root)
	set_time_of_day(_time_of_day, current_region)


static func _h01(x: int, y: int, salt: int) -> float:
	var h := 2166136261
	for value: int in [x, y, salt]:
		h ^= value & 0xffffffff
		h = (h * 16777619) & 0xffffffff
	h ^= h >> 16
	h = (h * 0x85ebca6b) & 0xffffffff
	h ^= h >> 13
	return float(h & 0xffffff) / 16777215.0


func _layer_name(chunk: Dictionary, layer: String, value: int) -> String:
	if value <= 0:
		return ""
	var legend: Array = (chunk.legend as Dictionary).get(layer, [])
	return String(legend[value - 1]) if value <= legend.size() else ""


func _source_material(surface: String, biome: String) -> String:
	if surface != "water":
		return String(SOURCE_MATERIAL.get(surface, ""))
	if biome == "lake":
		return "lake"
	if biome == "riverine":
		return "river"
	if biome in ["tidal_flat", "ocean", "coastal_scrub", "mangrove"]:
		return "tidal"
	if biome == "karst_orchard":
		return "cenote"
	return "water"


func _source_ground_frame(cell: Vector2i, surface: String, biome: String) -> String:
	var material := _source_material(surface, biome)
	if material.is_empty():
		return ""
	var variant := int(_h01(cell.x, cell.y, 7) * 4.0) % 4
	if material == "water":
		variant %= 3
	return "%s_%d" % [material, variant]


func _road_mask(cell: Vector2i) -> int:
	var mask := 0
	for item: Array in [[Vector2i(0, -1), 1], [Vector2i(1, 0), 2], [Vector2i(0, 1), 4], [Vector2i(-1, 0), 8]]:
		var base: Dictionary = reader.cell_layers(cell + (item[0] as Vector2i))
		if bool(base.get("ok", false)) and int((base.values as Dictionary).get("road", 0)) == 1:
			mask |= int(item[1])
	return mask


func _source_road_frame(cell: Vector2i, surface: String, biome: String) -> String:
	var mask := _road_mask(cell)
	if surface in ["water", "bridge"]:
		var orient := "ns" if mask in [1, 4, 5] else "ew" if mask in [2, 8, 10] else "junction"
		if biome in ["mangrove", "freshwater_marsh", "peat_bog"]:
			if mask == 1: orient = "end_s"
			elif mask == 4: orient = "end_n"
			elif mask == 2: orient = "end_w"
			elif mask == 8: orient = "end_e"
			return "pier_%s_%d" % [orient, int(_h01(cell.x, cell.y, 31) * 3.0) % 3]
		if orient == "junction": orient = "ns"
		return "causeway_%s_%d" % [orient, int(_h01(cell.x, cell.y, 37) * 4.0) % 4]
	return "track_%s_%d" % ["stone" if surface in ["gravel", "bridge"] else "dirt", mask]


func _bank_frame(cell: Vector2i) -> String:
	var mask := 0
	for item: Array in [[Vector2i(0, -1), 1], [Vector2i(1, 0), 2], [Vector2i(0, 1), 4], [Vector2i(-1, 0), 8]]:
		var at: Vector2i = cell + (item[0] as Vector2i)
		if String(reader.named_value(at, "surface")) != "water":
			mask |= int(item[1])
	return "bank_%d" % mask if mask != 0 else ""


func desired_chunk_ids(center_px: Vector2, rect: Rect2) -> Array[String]:
	var out: Array[String] = []
	if not rect.has_point(center_px) or not world_pixels().has_point(center_px):
		return out
	var x0 := clampi(floori(rect.position.x / CHUNK_PX), 0, 15)
	var y0 := clampi(floori(rect.position.y / CHUNK_PX), 0, 11)
	var x1 := clampi(floori((rect.end.x - 0.001) / CHUNK_PX), 0, 15)
	var y1 := clampi(floori((rect.end.y - 0.001) / CHUNK_PX), 0, 11)
	for y: int in range(y0, y1 + 1):
		for x: int in range(x0, x1 + 1):
			out.append("chunk:%d:%d" % [x, y])
	var hero_cid := String(reader.chunk_id_at(Vector2i(floori(center_px.x / TILE), floori(center_px.y / TILE))))
	if not out.has(hero_cid):
		out.append(hero_cid)
	out.sort()
	return out


func world_pixels() -> Rect2:
	return Rect2(Vector2.ZERO, Vector2(16384, 12288))


func update_stream(center_px: Vector2, rect: Rect2) -> Dictionary:
	if not _built:
		return {"ok": false, "error": "STREAM_NOT_CONFIGURED"}
	var desired := desired_chunk_ids(center_px, rect)
	if desired.is_empty():
		last_error = "stream_rect_misses_hero_or_world"
		return {"ok": false, "error": last_error}
	var started := Time.get_ticks_usec()
	var mounted: Array = []
	var drained: Array = []
	for cid: String in desired:
		if not loaded_chunks.has(cid):
			if not _mount_chunk(cid):
				return {"ok": false, "error": last_error, "chunk_id": cid}
			mounted.append(cid)
	var to_drain: Array = []
	for cid: String in loaded_chunks:
		if not desired.has(cid):
			to_drain.append(cid)
	to_drain.sort()
	for cid: String in to_drain:
		_unmount_chunk(cid)
		drained.append(cid)
	_stream_center = center_px
	_stream_rect = rect
	max_loaded_chunks = maxi(max_loaded_chunks, loaded_chunks.size())
	var hero_chunk := String(reader.chunk_id_at(Vector2i(floori(center_px.x / TILE), floori(center_px.y / TILE))))
	if mounted.is_empty() and drained.is_empty() and hero_chunk == _last_event_chunk:
		return {"ok": true, "event": {}}
	_last_event_chunk = hero_chunk
	var event := {
		"sequence": stream_events.size(), "ticks_ms": Time.get_ticks_msec(),
		"center_px": [center_px.x, center_px.y], "rect_px": [rect.position.x, rect.position.y, rect.size.x, rect.size.y],
		"mounted": mounted, "drained": drained, "active": loaded_chunks.keys(), "active_count": loaded_chunks.size(),
		"hero_chunk": hero_chunk, "elapsed_ms": float(Time.get_ticks_usec() - started) / 1000.0,
	}
	stream_events.append(event)
	if _focus != null and is_instance_valid(_focus) and (not mounted.is_empty() or not drained.is_empty()):
		bind_focus(_focus)
	return {"ok": true, "event": event}


func _new_layer(parent: Node2D, name: String, z: int) -> TileMapLayer:
	var layer := TileMapLayer.new()
	layer.name = name
	layer.tile_set = _tiles
	layer.position = Vector2.ZERO
	layer.z_index = z
	layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	layer.light_mask = WORLD_LIGHT_MASK
	layer.material = _ambient_material
	parent.add_child(layer)
	return layer


func _mount_chunk(cid: String) -> bool:
	var started := Time.get_ticks_usec()
	var loaded: Dictionary = reader.load_chunk(cid)
	if not bool(loaded.get("ok", false)):
		last_error = "chunk_load:" + String(loaded.get("error", ""))
		return false
	var chunk: Dictionary = loaded.chunk
	var origin: Array = chunk.origin
	var values: Dictionary = loaded.layers
	var ground_node := Node2D.new()
	ground_node.name = "Ground_" + cid.replace(":", "_")
	ground_node.position = Vector2(int(origin[0]) * TILE, int(origin[1]) * TILE)
	chunk_root.add_child(ground_node)
	var ground := _new_layer(ground_node, "Ground", -10)
	var road := _new_layer(ground_node, "Road", -9)
	var bank := _new_layer(ground_node, "Bank", -8)
	var overlay_node := Node2D.new()
	overlay_node.name = "Overlays_" + cid.replace(":", "_")
	overlay_root.add_child(overlay_node)
	var prop_node := Node2D.new()
	prop_node.name = "Props_" + cid.replace(":", "_")
	props_root.add_child(prop_node)
	var collision_node := Node2D.new()
	collision_node.name = "Collision_" + cid.replace(":", "_")
	collision_root.add_child(collision_node)
	var light_node := Node2D.new()
	light_node.name = "Lights_" + cid.replace(":", "_")
	lights_root.add_child(light_node)
	var tiles := 0
	for y: int in range(CHUNK):
		for x: int in range(CHUNK):
			var local := y * CHUNK + x
			if int((values.preserved as Array)[local]) == 1 and not render_legacy:
				continue
			var cell := Vector2i(int(origin[0]) + x, int(origin[1]) + y)
			var key := cell.y * 1024 + cell.x
			var surface := _layer_name(chunk, "surface", int((values.surface as Array)[local]))
			var biome := _layer_name(chunk, "biome", int((values.biome as Array)[local]))
			var frame := String(_ground_overrides.get(key, ""))
			var curated := not frame.is_empty()
			if frame.is_empty():
				frame = _source_ground_frame(cell, surface, biome)
			if not _terrain_coords.has(frame):
				last_error = "missing_ground_frame:" + frame
				ground_node.queue_free()
				return false
			ground.set_cell(Vector2i(x, y), _tile_source, _terrain_coords[frame] as Vector2i)
			tiles += 1
			if curated:
				continue
			if int((values.road as Array)[local]) == 1:
				var road_frame := _source_road_frame(cell, surface, biome)
				if not _terrain_coords.has(road_frame):
					last_error = "missing_road_frame:" + road_frame
					return false
				road.set_cell(Vector2i(x, y), _tile_source, _terrain_coords[road_frame] as Vector2i)
			elif surface == "water":
				var bank_frame := _bank_frame(cell)
				if not bank_frame.is_empty() and _terrain_coords.has(bank_frame):
					bank.set_cell(Vector2i(x, y), _tile_source, _terrain_coords[bank_frame] as Vector2i)
	for raw: Variant in _curated_overlays.get(cid, []):
		var overlay := raw as Dictionary
		var cell: Array = overlay.cell
		_add_overlay_sprite(overlay_node, String(overlay.frame), Vector2i(int(cell[0]), int(cell[1])), String(overlay.get("layer", "road")))
	for raw: Variant in _curated_props.get(cid, []):
		var prop := raw as Dictionary
		if prop.has("instance_id") and String(prop.instance_id).begins_with("si:r_ashen_crown:roadside_supply:"):
			continue
		_add_prop_sprite(prop_node, String(prop.frame), Vector2i(int(prop.cell[0]), int(prop.cell[1])),
			String(prop.get("id", "curated")), prop)
	if not bool((loaded.layers as Dictionary).preserved[0]) or render_legacy:
		_add_resource_proxies(prop_node, cid)
		_add_poi_proxies(prop_node, cid)
	_add_roadside_sources(prop_node, collision_node, cid)
	for raw: Variant in _curated_lights.get(cid, []):
		var light := raw as Dictionary
		_add_light(light_node, light)
	var collision_count := _add_terrain_collision(collision_node, loaded)
	_sync_chunk_structures(cid, prop_node, collision_node)
	loaded_chunks[cid] = {
		"ground": ground_node, "overlay": overlay_node, "props": prop_node,
		"collision": collision_node, "lights": light_node, "source_sha256": String(loaded.sha256),
		"tile_cells": tiles, "terrain_bodies": collision_count, "revision": 0,
	}
	mount_ms[cid] = float(Time.get_ticks_usec() - started) / 1000.0
	return true


func _add_overlay_sprite(parent: Node2D, frame: String, cell: Vector2i, layer: String) -> void:
	if not atlas.terrain.has(frame):
		return
	var rect: Array = atlas.terrain[frame]
	var texture := AtlasTexture.new()
	texture.atlas = _terrain_texture
	texture.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = Vector2(cell.x * TILE, cell.y * TILE)
	sprite.z_index = -7 + (1 if layer in ["road", "boardwalk", "causeway"] else 0)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.light_mask = WORLD_LIGHT_MASK
	sprite.material = _ambient_material
	sprite.set_meta("a1_visual_only", true)
	parent.add_child(sprite)


func _add_prop_sprite(parent: Node2D, frame: String, cell: Vector2i, source_id: String, metadata: Dictionary = {}) -> Sprite2D:
	if not atlas.props.has(frame):
		last_error = "missing_prop_frame:" + frame
		return null
	var rect: Array = atlas.props[frame]
	var texture := AtlasTexture.new()
	texture.atlas = _props_texture
	texture.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = Vector2(cell.x * TILE + 8, cell.y * TILE + 16)
	sprite.offset = Vector2(-float(rect[2]) * 0.5, -float(rect[3]))
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.light_mask = WORLD_LIGHT_MASK
	sprite.material = _ambient_material
	sprite.set_meta("source_id", source_id)
	sprite.set_meta("canonical_cell", [cell.x, cell.y])
	sprite.set_meta("a1_visual_only", true)
	for key: String in metadata:
		if key in ["node_id", "poi_id", "instance_id", "role", "source"]:
			sprite.set_meta(key, metadata[key])
	parent.add_child(sprite)
	return sprite


func _add_resource_proxies(parent: Node2D, cid: String) -> void:
	var bindings: Dictionary = (contract.visual as Dictionary).material_frames
	for raw: Variant in reader.resource_nodes_in_chunk(cid):
		var node := raw as Dictionary
		var nid := String(node.node_id)
		if _curated_resource_ids.has(nid):
			continue
		var cell: Array = node.cell
		var frame := String(bindings.get(String(node.material_key), ""))
		var sprite := _add_prop_sprite(parent, frame, Vector2i(int(cell[0]), int(cell[1])), nid,
			{"node_id": nid, "role": "ordinary_harvestable", "source": "canonical_material_proxy"})
		if sprite != null:
			sprite.set_meta("economy_active", false)
			sprite.set_meta("source_contract_status", String(node.status))


func _add_poi_proxies(parent: Node2D, cid: String) -> void:
	var bindings: Dictionary = (contract.visual as Dictionary).poi_landmark_frames
	for raw: Variant in reader.pois_in_chunk(cid):
		var poi := raw as Dictionary
		var pid := String(poi.poi_id)
		if not bindings.has(pid) or _curated_poi_ids.has(pid) or _a8_poi_ids.has(pid):
			continue
		var cell: Array = poi.cell
		var sprite := _add_prop_sprite(parent, String(bindings[pid]), Vector2i(int(cell[0]), int(cell[1])), pid,
			{"poi_id": pid, "role": "authored_landmark", "source": "explicit_poi_frame_binding"})
		if sprite != null:
			sprite.set_meta("interaction_active", false)


func _add_roadside_sources(prop_parent: Node2D, collision_parent: Node2D, cid: String) -> void:
	for raw: Variant in reader.roadside_sources_in_chunk(cid):
		var instance := raw as Dictionary
		var cell: Array = instance.cell
		var meta: Array = [int((instance.visual_meta as Dictionary).x), int((instance.visual_meta as Dictionary).y),
			int((instance.visual_meta as Dictionary).w), int((instance.visual_meta as Dictionary).h)]
		var texture := AtlasTexture.new()
		texture.atlas = _legacy_props_texture
		texture.region = Rect2(meta[0], meta[1], meta[2], meta[3])
		var sprite := Sprite2D.new()
		sprite.texture = texture
		sprite.centered = false
		sprite.position = Vector2(int(cell[0]) * TILE + 8, int(cell[1]) * TILE + 16)
		sprite.offset = Vector2(-float(meta[2]) * 0.5, -float(meta[3]))
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.light_mask = WORLD_LIGHT_MASK
		sprite.material = _ambient_material
		sprite.set_meta("instance_id", String(instance.instance_id))
		sprite.set_meta("source_id", String(instance.resource_node_id))
		sprite.set_meta("economy_active", false)
		prop_parent.add_child(sprite)
		var size: Array = instance.collision_size_px
		var offset: Array = instance.collision_offset_px
		var center := Vector2(int(cell[0]) * TILE + 8 + float(offset[0]), int(cell[1]) * TILE + 8 + float(offset[1]))
		_add_body(collision_parent, String(instance.instance_id), Rect2(center - Vector2(float(size[0]), float(size[1])) * 0.5,
			Vector2(float(size[0]), float(size[1]))))


func _add_light(parent: Node2D, source: Dictionary) -> void:
	var light := PointLight2D.new()
	light.texture = _light_texture
	light.texture_scale = 1.0
	light.color = Color(1.0, 0.62, 0.28)
	light.energy = float(source.get("energy", 0.8))
	light.set_meta("base_energy", light.energy)
	light.light_mask = WORLD_LIGHT_MASK
	var at: Array = source.world_px
	light.position = Vector2(float(at[0]), float(at[1]))
	light.visible = _night > 0.02
	parent.add_child(light)


func _add_body(parent: Node2D, id: String, rect: Rect2) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = id.replace(":", "_").replace("/", "_")
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = rect.get_center()
	body.set_meta("source_id", id)
	var shape := CollisionShape2D.new()
	var rectangle := RectangleShape2D.new()
	rectangle.size = rect.size
	shape.shape = rectangle
	body.add_child(shape)
	parent.add_child(body)
	return body


func _add_terrain_collision(parent: Node2D, loaded: Dictionary) -> int:
	var chunk: Dictionary = loaded.chunk
	if int((loaded.layers as Dictionary).preserved[0]) == 1:
		# The original A0 world owns both terrain and prop bodies in the inset.
		return 0
	var origin: Array = chunk.origin
	var walk: Array = (loaded.layers as Dictionary).walk
	var used: Array = []
	used.resize(CHUNK * CHUNK)
	used.fill(false)
	var count := 0
	for y: int in range(CHUNK):
		for x: int in range(CHUNK):
			var local := y * CHUNK + x
			if used[local] or int(walk[local]) == 1:
				continue
			var width := 1
			while x + width < CHUNK and not used[local + width] and int(walk[local + width]) == 0:
				width += 1
			var height := 1
			var growing := true
			while y + height < CHUNK and growing:
				for dx: int in range(width):
					var index := (y + height) * CHUNK + x + dx
					if used[index] or int(walk[index]) == 1:
						growing = false
						break
				if growing:
					height += 1
			for dy: int in range(height):
				for dx: int in range(width):
					used[(y + dy) * CHUNK + x + dx] = true
			var world := Vector2((int(origin[0]) + x) * TILE, (int(origin[1]) + y) * TILE)
			_add_body(parent, "terrain:%s:%d" % [cid_safe(String(chunk.chunk_id)), count],
				Rect2(world, Vector2(width * TILE, height * TILE)))
			count += 1
	return count


static func cid_safe(cid: String) -> String:
	return cid.replace(":", "_")


func _unmount_chunk(cid: String) -> void:
	if not loaded_chunks.has(cid):
		return
	var record: Dictionary = loaded_chunks[cid]
	for key: String in ["ground", "overlay", "props", "collision", "lights"]:
		var node: Node = record[key]
		if node != null and is_instance_valid(node):
			if key == "collision":
				_set_collision_recursive_deferred(node)
			node.get_parent().remove_child(node)
			node.queue_free()
	loaded_chunks.erase(cid)
	mount_ms.erase(cid)


func _set_collision_recursive_deferred(node: Node) -> void:
	if node is CollisionObject2D:
		(node as CollisionObject2D).set_deferred("collision_layer", 0)
	for child: Node in node.get_children():
		_set_collision_recursive_deferred(child)


func clear_stream() -> void:
	var ids := loaded_chunks.keys()
	ids.sort()
	for cid: String in ids:
		_unmount_chunk(String(cid))
	_stream_center = Vector2.INF
	_last_event_chunk = ""


func apply_structure(cell: Vector2i, layer: String, value: int, expected_base: int,
		revision: int, structure_id: String) -> Dictionary:
	if layer != "walk" or value != 0 or structure_id.is_empty() or _structures.has(structure_id):
		return {"ok": false, "error": "INVALID_DYNAMIC_STRUCTURE"}
	var base: Dictionary = reader.cell_layers(cell)
	if not bool(base.get("ok", false)):
		return base
	var values: Dictionary = base.values
	if int(values.preserved) != 0 or int(values.build_permission) != 1 or int(values.walk) != 1 or int(values.hazard) != 0:
		return {"ok": false, "error": "DYNAMIC_SOURCE_NOT_ELIGIBLE"}
	if int(values[layer]) != expected_base:
		return {"ok": false, "error": "STALE_BASE"}
	var key := "%d,%d:%s" % [cell.x, cell.y, layer]
	if _structures.has(key) and int((_structures[key] as Dictionary).revision) >= revision:
		return {"ok": false, "error": "STALE_REVISION"}
	var structure := {"cell": [cell.x, cell.y], "layer": layer, "value": value, "expected_base": expected_base,
		"revision": revision, "source_id": structure_id, "structure_id": structure_id}
	_structures[key] = structure
	var cid := String(base.chunk_id)
	if not _structures_by_chunk.has(cid):
		_structures_by_chunk[cid] = []
	(_structures_by_chunk[cid] as Array).append(structure)
	if loaded_chunks.has(cid):
		var record: Dictionary = loaded_chunks[cid]
		_sync_chunk_structures(cid, record.props as Node2D, record.collision as Node2D)
		record.revision = revision
	return {"ok": true, "chunk_id": cid, "values": values.duplicate(), "structure": structure.duplicate()}


func resolved_walk(cell: Vector2i) -> int:
	var base: Dictionary = reader.cell_layers(cell)
	if not bool(base.get("ok", false)):
		return 0
	var value := int((base.values as Dictionary).walk)
	var key := "%d,%d:walk" % [cell.x, cell.y]
	if _structures.has(key):
		value = int((_structures[key] as Dictionary).value)
	return value


func _sync_chunk_structures(cid: String, prop_parent: Node2D, collision_parent: Node2D) -> void:
	for raw: Variant in _structures_by_chunk.get(cid, []):
		var structure := raw as Dictionary
		var sid := String(structure.structure_id)
		if collision_parent.has_node(sid.replace(":", "_").replace("/", "_")):
			continue
		var cell: Array = structure.cell
		var at := Vector2i(int(cell[0]), int(cell[1]))
		_add_body(collision_parent, sid, Rect2(Vector2(at.x * TILE, at.y * TILE), Vector2(TILE, TILE)))
		var sprite := _add_prop_sprite(prop_parent, "fence_h", at, sid, {"source": "A0_DYNAMIC_STRUCTURE_FIXTURE"})
		if sprite != null:
			sprite.set_meta("dynamic_revision", int(structure.revision))
			sprite.set_meta("visible_structure", true)


func bind_focus(focus: Node2D) -> bool:
	if focus == null or not is_instance_valid(focus):
		return false
	_focus = focus
	if occlusion != null and is_instance_valid(occlusion):
		occlusion.release_materials()
		occlusion.queue_free()
	occlusion = OCCLUSION.new()
	occlusion.name = "SourceArtOcclusion"
	add_child(occlusion)
	occlusion.configure_sprites(props_root, focus)
	occlusion.snap()
	return true


func set_time_of_day(t: float, region_id: String = "") -> void:
	_time_of_day = clampf(t, 0.0, 1.0)
	if not region_id.is_empty() and _region_ambient.has(region_id):
		current_region = region_id
	var profile: Dictionary = _region_ambient.get(current_region, {})
	if profile.is_empty() or _ambient_material == null:
		return
	var dusk := smoothstep(0.62, 0.86, _time_of_day)
	var dawn := 1.0 - smoothstep(0.12, 0.30, _time_of_day)
	_night = clampf(maxf(dusk, dawn), 0.0, 1.0)
	var day_array: Array = profile.day
	var night_array: Array = profile.night
	var day := Color(float(day_array[0]), float(day_array[1]), float(day_array[2]), 1.0)
	var night := Color(float(night_array[0]), float(night_array[1]), float(night_array[2]), 1.0)
	_ambient_material.set_shader_parameter("ambient_color", day.lerp(night, _night))
	for cid: String in loaded_chunks:
		var light_parent: Node = (loaded_chunks[cid] as Dictionary).lights
		for child: Node in light_parent.get_children():
			if child is PointLight2D:
				(child as PointLight2D).visible = _night > 0.02


func _process(delta: float) -> void:
	if _built and occlusion != null and is_instance_valid(occlusion):
		occlusion.step(delta)


func source_visual_summary() -> Dictionary:
	return {
		"curated_ground_cells": _ground_overrides.size(), "curated_resource_nodes": _curated_resource_ids.size(),
		"curated_pois": _curated_poi_ids.size(), "curated_instances": _curated_instance_ids.size(),
		"generic_resource_proxy_policy": "EXPLICIT_MATERIAL_BINDINGS_NO_ECONOMY",
		"unbound_poi_markers_rendered": false, "a8_generic_landmarks_rendered": false,
		"legacy_rendered_by_stream": render_legacy, "private_light_mask": WORLD_LIGHT_MASK,
		"time_of_day": _time_of_day, "night_factor": _night, "ambient_region": current_region,
		"visual_acceptance": "NOT_TESTED_SEPARATE_GATE",
	}


func performance_report() -> Dictionary:
	var times := mount_ms.values()
	var total := 0.0
	var maximum := 0.0
	for value: Variant in times:
		total += float(value)
		maximum = maxf(maximum, float(value))
	return {
		"reader_configure_ms": float(reader.configure_ms), "loaded_chunks": loaded_chunks.size(),
		"max_loaded_chunks": max_loaded_chunks, "stream_events": stream_events.size(),
		"last_mount_sample_count": times.size(), "last_mount_total_ms": total,
		"last_mount_max_ms": maximum, "last_mount_average_ms": total / maxf(1.0, float(times.size())),
		"note": "last_mount metrics cover currently mounted chunks; stream events contain every mount/drain timing",
	}


func has_visible_structure(structure_id: String) -> bool:
	for cid: String in loaded_chunks:
		var props: Node = (loaded_chunks[cid] as Dictionary).props
		for child: Node in props.get_children():
			if child is Sprite2D and String(child.get_meta("source_id", "")) == structure_id:
				return bool(child.get_meta("visible_structure", false)) and (child as Sprite2D).visible
	return false
