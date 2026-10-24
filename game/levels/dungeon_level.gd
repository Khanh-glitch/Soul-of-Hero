@tool
class_name DungeonLevel
extends Node2D

const TILE_SIZE := Vector2i(16, 16)
const TILESET_TEXTURES := {
	0: preload("res://assets/environment/dungeon_0x72/dungeon_tileset_ii.png"),
	1: preload("res://assets/environment/dungeon_0x72/atlas_walls_low.png"),
}
const ATLAS_GRIDS := {
	0: Vector2i(32, 32),
	1: Vector2i(12, 4),
}
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
## Optional Chapter 1 presentation layer. A level that has no theme document in
## res://data/environment/chapter1/ is left exactly as it was, so this hook can
## never change a map that has not opted in.
const EnvironmentArt := preload("res://game/levels/presentation/chapter1_environment_art.gd")

@export_file("*.json") var level_data_path := "res://data/levels/crypt_entrance.json"
@export var watch_file_changes := true
@export_category("Dungeon palette")
@export var backdrop_tint := Color(0.68, 0.73, 0.82, 1.0)
@export var geometry_tint := Color(0.74, 0.78, 0.86, 1.0)
@export var decor_tint := Color(0.84, 0.80, 0.78, 1.0)

@onready var backdrop: TileMapLayer = $Backdrop
@onready var geometry: TileMapLayer = $Geometry
@onready var decor: TileMapLayer = $Decor

var level_data: Dictionary = {}
var _last_modified_time := 0
var _watch_elapsed := 0.0


func _ready() -> void:
	_build_tile_sets()
	_apply_dungeon_palette()
	reload_from_disk()
	set_process(watch_file_changes)


func _process(delta: float) -> void:
	if not watch_file_changes:
		return
	_watch_elapsed += delta
	if _watch_elapsed < 0.55:
		return
	_watch_elapsed = 0.0
	var modified := int(FileAccess.get_modified_time(level_data_path))
	if modified > 0 and _last_modified_time > 0 and modified != _last_modified_time:
		reload_from_disk()


func reload_from_disk() -> bool:
	if not FileAccess.file_exists(level_data_path):
		push_warning("Level data not found: %s" % level_data_path)
		return false
	var file := FileAccess.open(level_data_path, FileAccess.READ)
	if file == null:
		return false
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		push_error("Invalid level JSON: %s" % level_data_path)
		return false
	var validation: Dictionary = LevelSchemaValidator.validate_level(parsed)
	if not bool(validation.get("ok", false)):
		push_error("Invalid level schema at %s: %s" % [
			level_data_path,
			String(validation.get("error", "unknown schema error")),
		])
		return false
	if not _can_apply_layer(backdrop, _get_layer_cells_from(parsed, "Backdrop")) \
			or not _can_apply_layer(geometry, _get_layer_cells_from(parsed, "Geometry")) \
			or not _can_apply_layer(decor, _get_layer_cells_from(parsed, "Decor")):
		push_error("Level contains cells that are incompatible with the active TileSet: %s" % level_data_path)
		return false
	level_data = parsed
	_apply_layer(backdrop, _get_layer_cells("Backdrop"))
	_apply_layer(geometry, _get_layer_cells("Geometry"))
	_apply_layer(decor, _get_layer_cells("Decor"))
	_last_modified_time = int(FileAccess.get_modified_time(level_data_path))
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal("map_changed", "file")
	_refresh_environment_art()
	if not Engine.is_editor_hint():
		var realtime_bridge := get_node_or_null("/root/RealtimeBridge")
		if realtime_bridge != null and realtime_bridge.has_method(&"publish_event"):
			realtime_bridge.call(&"publish_event", "map_reloaded", {
				"path": level_data_path,
				"geometry_cells": geometry.get_used_cells().size(),
			})
	return true


func _refresh_environment_art() -> void:
	if Engine.is_editor_hint():
		return
	EnvironmentArt.attach(self)


func _get_layer_cells(layer_name: String) -> Array:
	return _get_layer_cells_from(level_data, layer_name)


func _get_layer_cells_from(document: Dictionary, layer_name: String) -> Array:
	var layers: Dictionary = document.get("layers", {})
	var value: Variant = layers.get(layer_name, [])
	return value if value is Array else []


func _can_apply_layer(layer: TileMapLayer, cells: Array) -> bool:
	if layer.tile_set == null:
		return false
	for raw_cell: Variant in cells:
		if not raw_cell is Dictionary:
			return false
		var cell: Dictionary = raw_cell
		var source_id := int(cell.get("source", -1))
		if not layer.tile_set.has_source(source_id):
			return false
		var source := layer.tile_set.get_source(source_id)
		if not source is TileSetAtlasSource:
			return false
		var atlas: Array = cell.get("atlas", [])
		if atlas.size() != 2:
			return false
		var atlas_position := Vector2i(int(atlas[0]), int(atlas[1]))
		var alternative := int(cell.get("alternative", 0))
		if not source.has_tile(atlas_position) or not source.has_alternative_tile(atlas_position, alternative):
			return false
	return true


func _apply_layer(layer: TileMapLayer, cells: Array) -> void:
	layer.clear()
	for raw_cell: Variant in cells:
		if not raw_cell is Dictionary:
			continue
		var cell: Dictionary = raw_cell
		var atlas: Array = cell.get("atlas", [-1, -1])
		if atlas.size() < 2:
			continue
		layer.set_cell(
			Vector2i(int(cell.get("x", 0)), int(cell.get("y", 0))),
			int(cell.get("source", 0)),
			Vector2i(int(atlas[0]), int(atlas[1])),
			int(cell.get("alternative", 0))
		)
	layer.update_internals()


func apply_cell_update(
	layer_name: String,
	cell_position: Vector2i,
	atlas_position: Vector2i,
	source_id := 0,
	alternative := 0
) -> bool:
	var layer := get_node_or_null(NodePath(layer_name)) as TileMapLayer
	if layer == null:
		return false
	if atlas_position == Vector2i(-1, -1):
		layer.erase_cell(cell_position)
	else:
		layer.set_cell(cell_position, source_id, atlas_position, alternative)
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal("map_changed", "runtime")
	return true


func get_entities() -> Array:
	var entities: Variant = level_data.get("entities", [])
	return entities if entities is Array else []


func get_level_snapshot() -> Dictionary:
	var snapshot := level_data.duplicate(true)
	var layers: Dictionary = snapshot.get("layers", {})
	layers["Backdrop"] = serialize_layer(backdrop)
	layers["Geometry"] = serialize_layer(geometry)
	layers["Decor"] = serialize_layer(decor)
	snapshot["layers"] = layers
	return snapshot


func serialize_layer(layer: TileMapLayer) -> Array:
	var cells: Array = []
	var used := layer.get_used_cells()
	used.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		return a.y < b.y or (a.y == b.y and a.x < b.x)
	)
	for position: Vector2i in used:
		var atlas := layer.get_cell_atlas_coords(position)
		cells.append({
			"x": position.x,
			"y": position.y,
			"source": layer.get_cell_source_id(position),
			"atlas": [atlas.x, atlas.y],
			"alternative": layer.get_cell_alternative_tile(position),
		})
	return cells


func _build_tile_sets() -> void:
	var visual_tiles := _make_tile_set(false)
	var collision_tiles := _make_tile_set(true)
	backdrop.tile_set = visual_tiles
	decor.tile_set = visual_tiles
	geometry.tile_set = collision_tiles


func _apply_dungeon_palette() -> void:
	# Palette the authored dungeon layers themselves instead of placing a dark
	# screen overlay over the player. Warm torches and the local hero light keep
	# their contrast, while sprites/UI remain true-colour and fully readable.
	backdrop.modulate = backdrop_tint
	geometry.modulate = geometry_tint
	decor.modulate = decor_tint


func _make_tile_set(with_collision: bool) -> TileSet:
	var tile_set := TileSet.new()
	tile_set.tile_size = TILE_SIZE
	if with_collision:
		tile_set.add_physics_layer(0)
		tile_set.set_physics_layer_collision_layer(0, 1)
		tile_set.set_physics_layer_collision_mask(0, 0)

	for source_id: int in TILESET_TEXTURES:
		var source := TileSetAtlasSource.new()
		source.texture = TILESET_TEXTURES[source_id]
		source.texture_region_size = TILE_SIZE
		var atlas_grid: Vector2i = ATLAS_GRIDS[source_id]
		for y: int in range(atlas_grid.y):
			for x: int in range(atlas_grid.x):
				source.create_tile(Vector2i(x, y))
		tile_set.add_source(source, source_id)
		# TileData receives its physics layer layout only after the atlas source is
		# attached to the TileSet, so collision polygons are assigned in a second pass.
		if with_collision:
			for y: int in range(atlas_grid.y):
				for x: int in range(atlas_grid.x):
					var coordinates := Vector2i(x, y)
					var tile_data := source.get_tile_data(coordinates, 0)
					tile_data.set_collision_polygons_count(0, 1)
					tile_data.set_collision_polygon_points(0, 0, PackedVector2Array([
						Vector2(-8, -8), Vector2(8, -8),
						Vector2(8, 8), Vector2(-8, 8),
					]))
	return tile_set
