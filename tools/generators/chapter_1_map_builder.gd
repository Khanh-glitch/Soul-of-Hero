class_name ChapterOneMapBuilder
extends RefCounted

## Shared deterministic builder for the Chapter 1 crypt maps. A map definition
## contains additive room/corridor rectangles, subtractive pits, authored
## gameplay entities and combat-camp metadata. The resulting JSON stays on the
## same top-down v2 contract as Level 1.

const WALL_SOURCE := 1
const FLOOR_TILES := [
	Vector2i(1, 4), Vector2i(2, 4), Vector2i(3, 4),
	Vector2i(1, 5), Vector2i(2, 5), Vector2i(3, 5),
	Vector2i(1, 6), Vector2i(2, 6),
]
const DECOR_TILES := [
	Vector2i(18, 27),
	Vector2i(3, 6),
	Vector2i(6, 9),
]


func build(definition: Dictionary) -> Dictionary:
	var width := int(definition.get("width", 112))
	var height := int(definition.get("height", 80))
	var floor_mask := _build_floor_mask(definition, width, height)
	var layers := {
		"Backdrop": [],
		"Geometry": [],
		"Decor": [],
	}
	_build_backdrop(layers.Backdrop, floor_mask, width, height)
	_build_geometry(layers.Geometry, floor_mask, width, height)
	_build_decor(
		layers.Decor,
		floor_mask,
		definition.get("entities", []),
		width,
		height,
		int(definition.get("decor_seed", 0)),
	)

	var metadata: Dictionary = definition.get("metadata", {}).duplicate(true)
	metadata["required_sigils"] = int(definition.get("required_sigils", 3))
	# Six rows of headroom above the map's first row. The authored architecture needs
	# it: wall stacks extrude, cornice and cap upward, and banners, columns and gate
	# towers are taller than the wall they hang on. Without the headroom that paint
	# lands outside the camera limit and every top wall in the chapter is sliced flat
	# by the top of the screen. The rock fill and the wall pass reach into this strip,
	# so the camera is looking at stone, not at a gap.
	const HEADROOM_ROWS := 6
	metadata["camera_bounds"] = [0, -HEADROOM_ROWS * 16, width * 16, height * 16]
	metadata["layout_profile"] = String(definition.get("layout_profile", "chapter_1_crypt"))
	metadata["tileset"] = "0x72 DungeonTileset II v1.7 (CC0)"
	metadata["rooms"] = _serialize_rooms(definition.get("rooms", []))
	metadata["combat_camps"] = definition.get("combat_camps", []).duplicate(true)
	metadata["safe_zones"] = definition.get("safe_zones", []).duplicate(true)
	metadata["special_zones"] = definition.get("special_zones", []).duplicate(true)

	return {
		"version": 2,
		"name": String(definition.get("name", "Chapter 1 Crypt")),
		"movement_mode": "top_down",
		"tile_size": 16,
		"width": width,
		"height": height,
		"layers": layers,
		"entities": definition.get("entities", []).duplicate(true),
		"metadata": metadata,
	}


func _build_floor_mask(definition: Dictionary, width: int, height: int) -> Dictionary:
	var floor_mask: Dictionary = {}
	for room_value: Variant in definition.get("rooms", []):
		var room: Dictionary = room_value
		_fill_rect(floor_mask, room.get("rect", Rect2i()), width, height)
	for corridor_value: Variant in definition.get("corridors", []):
		_fill_rect(floor_mask, corridor_value as Rect2i, width, height)
	for pit_value: Variant in definition.get("pits", []):
		_erase_rect(floor_mask, pit_value as Rect2i)
	return floor_mask


func _fill_rect(mask: Dictionary, rect: Rect2i, width: int, height: int) -> void:
	for y: int in range(rect.position.y, rect.end.y):
		for x: int in range(rect.position.x, rect.end.x):
			if x >= 0 and x < width and y >= 0 and y < height:
				mask[Vector2i(x, y)] = true


func _erase_rect(mask: Dictionary, rect: Rect2i) -> void:
	for y: int in range(rect.position.y, rect.end.y):
		for x: int in range(rect.position.x, rect.end.x):
			mask.erase(Vector2i(x, y))


func _build_backdrop(cells: Array, floor_mask: Dictionary, width: int, height: int) -> void:
	for y: int in range(height):
		for x: int in range(width):
			if not floor_mask.has(Vector2i(x, y)):
				continue
			var hash_value := posmod(x * 17 + y * 31 + x * y * 3, 29)
			var floor_index := 0
			if hash_value >= 25:
				floor_index = 1 + posmod(x * 11 + y * 7, FLOOR_TILES.size() - 1)
			cells.append(_cell(x, y, FLOOR_TILES[floor_index]))


func _build_geometry(cells: Array, floor_mask: Dictionary, width: int, height: int) -> void:
	for y: int in range(height):
		for x: int in range(width):
			if floor_mask.has(Vector2i(x, y)) or not _touches_floor(floor_mask, x, y):
				continue
			cells.append(_cell(x, y, _wall_atlas(floor_mask, x, y), WALL_SOURCE))


func _build_decor(
		cells: Array,
		floor_mask: Dictionary,
		entities: Array,
		width: int,
		height: int,
		seed: int,
) -> void:
	var reserved: Dictionary = {}
	for entity_value: Variant in entities:
		if not entity_value is Dictionary:
			continue
		var position: Array = entity_value.get("position", [])
		if position.size() < 2:
			continue
		var center := Vector2i(floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0))
		for offset_y: int in range(-1, 2):
			for offset_x: int in range(-1, 2):
				reserved[center + Vector2i(offset_x, offset_y)] = true

	for y: int in range(height):
		for x: int in range(width):
			var position := Vector2i(x, y)
			if not floor_mask.has(position) or reserved.has(position):
				continue
			var hash_value := posmod(x * 73 + y * 41 + x * y * 5 + seed * 97, 149)
			if hash_value != 0:
				continue
			var decor_index := posmod(x * 3 + y * 5 + seed, DECOR_TILES.size())
			cells.append(_cell(x, y, DECOR_TILES[decor_index]))


func _wall_atlas(floor_mask: Dictionary, x: int, y: int) -> Vector2i:
	var north := floor_mask.has(Vector2i(x, y - 1))
	var east := floor_mask.has(Vector2i(x + 1, y))
	var south := floor_mask.has(Vector2i(x, y + 1))
	var west := floor_mask.has(Vector2i(x - 1, y))
	if north and east:
		return Vector2i(1, 2)
	if north and west:
		return Vector2i(3, 2)
	if south and east:
		return Vector2i(1, 0)
	if south and west:
		return Vector2i(3, 0)
	if south:
		return Vector2i(2, 0)
	if north:
		return Vector2i(2, 2)
	if east:
		return Vector2i(1, 1)
	if west:
		return Vector2i(3, 1)
	if floor_mask.has(Vector2i(x + 1, y + 1)):
		return Vector2i(1, 0)
	if floor_mask.has(Vector2i(x - 1, y + 1)):
		return Vector2i(3, 0)
	if floor_mask.has(Vector2i(x + 1, y - 1)):
		return Vector2i(1, 2)
	if floor_mask.has(Vector2i(x - 1, y - 1)):
		return Vector2i(3, 2)
	return Vector2i(2, 0)


func _touches_floor(floor_mask: Dictionary, x: int, y: int) -> bool:
	for offset: Vector2i in [
		Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1),
		Vector2i(-1, 0), Vector2i(1, 0),
		Vector2i(-1, 1), Vector2i(0, 1), Vector2i(1, 1),
	]:
		if floor_mask.has(Vector2i(x, y) + offset):
			return true
	return false


func _serialize_rooms(rooms: Array) -> Array:
	var serialized: Array = []
	for room_value: Variant in rooms:
		var room: Dictionary = room_value
		var rect: Rect2i = room.get("rect", Rect2i())
		serialized.append({
			"id": String(room.get("id", "room_%d" % serialized.size())),
			"floor": int(room.get("floor", 1)),
			"role": String(room.get("role", "room")),
			"rect": [rect.position.x, rect.position.y, rect.size.x, rect.size.y],
		})
	return serialized


func _cell(x: int, y: int, atlas: Vector2i, source: int = 0) -> Dictionary:
	return {
		"x": x,
		"y": y,
		"source": source,
		"atlas": [atlas.x, atlas.y],
		"alternative": 0,
	}
