extends SceneTree

const OUTPUT := "res://data/levels/crypt_entrance.json"
const WIDTH := 100
const HEIGHT := 72
const WALL_SOURCE := 1
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")

# Rooms and corridors are deliberately expressed as data. Their union is the
# walkable footprint; every other cell remains black void, as in a true
# top-down dungeon instead of a platform-style strip map.
const ROOMS: Array[Rect2i] = [
	Rect2i(4, 4, 18, 12),
	Rect2i(26, 4, 18, 12),
	Rect2i(48, 4, 18, 12),
	Rect2i(4, 28, 18, 12),
	Rect2i(28, 27, 24, 14),
	Rect2i(58, 29, 22, 12),
	Rect2i(8, 54, 20, 12),
	Rect2i(34, 50, 24, 17),
	Rect2i(66, 52, 24, 15),
]

const CORRIDORS: Array[Rect2i] = [
	Rect2i(21, 8, 6, 4),
	Rect2i(43, 8, 6, 4),
	Rect2i(21, 33, 8, 4),
	Rect2i(51, 33, 8, 4),
	Rect2i(27, 58, 8, 4),
	Rect2i(57, 58, 10, 4),
]

const INNER_PITS: Array[Rect2i] = [
	Rect2i(33, 9, 4, 3),
	Rect2i(66, 34, 5, 3),
	Rect2i(43, 57, 5, 4),
]

const ROOM_METADATA := [
	{"id": "floor_1_entry", "floor": 1, "rect": [4, 4, 18, 12]},
	{"id": "floor_1_armory", "floor": 1, "rect": [26, 4, 18, 12]},
	{"id": "floor_1_door_hall", "floor": 1, "rect": [48, 4, 18, 12]},
	{"id": "floor_2_landing", "floor": 2, "rect": [4, 28, 18, 12]},
	{"id": "floor_2_shrine", "floor": 2, "rect": [28, 27, 24, 14]},
	{"id": "floor_2_library", "floor": 2, "rect": [58, 29, 22, 12]},
	{"id": "floor_3_cistern", "floor": 3, "rect": [8, 54, 20, 12]},
	{"id": "floor_3_gauntlet", "floor": 3, "rect": [34, 50, 24, 17]},
	{"id": "floor_3_exit", "floor": 3, "rect": [66, 52, 24, 15]},
]

const FLOOR_TILES: Array[Vector2i] = [
	Vector2i(1, 4), Vector2i(2, 4), Vector2i(3, 4),
	Vector2i(1, 5), Vector2i(2, 5), Vector2i(3, 5),
	Vector2i(1, 6), Vector2i(2, 6),
]


func _init() -> void:
	var floor_mask := _build_floor_mask()
	var layers := {
		"Backdrop": [],
		"Geometry": [],
		"Decor": [],
	}
	_build_backdrop(layers.Backdrop, floor_mask)
	_build_geometry(layers.Geometry, floor_mask)
	_build_decor(layers.Decor, floor_mask)

	var level := {
		"version": 2,
		"name": "Crypt of the Lost Sigils",
		"movement_mode": "top_down",
		"tile_size": 16,
		"width": WIDTH,
		"height": HEIGHT,
		"layers": layers,
		"entities": _build_entities(),
		"metadata": {
			"objective": "Khám phá các phòng, thu thập 3 ấn ký rồi tới cổng thoát",
			"required_sigils": 3,
			"camera_bounds": [0, 0, WIDTH * 16, HEIGHT * 16],
			"layout_profile": "three_floor_door_progression_dungeon",
			"tileset": "0x72 DungeonTileset II v1.7 (CC0)",
			"rooms": ROOM_METADATA,
		},
	}
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid generated level: %s" % validation.get("error", "unknown schema error"))
		quit(1)
		return

	var file := FileAccess.open(OUTPUT, FileAccess.WRITE)
	if file == null:
		push_error("Cannot write %s" % OUTPUT)
		quit(1)
		return
	file.store_string(JSON.stringify(level, "  ", false) + "\n")
	file.close()
	print(
		"Generated top-down dungeon: %d floor, %d wall, %d decor cells"
		% [layers.Backdrop.size(), layers.Geometry.size(), layers.Decor.size()]
	)
	quit()


func _build_floor_mask() -> Dictionary:
	var floor_mask: Dictionary = {}
	for room: Rect2i in ROOMS:
		_fill_rect(floor_mask, room)
	for corridor: Rect2i in CORRIDORS:
		_fill_rect(floor_mask, corridor)
	for pit: Rect2i in INNER_PITS:
		_erase_rect(floor_mask, pit)
	return floor_mask


func _fill_rect(floor_mask: Dictionary, rect: Rect2i) -> void:
	for y: int in range(rect.position.y, rect.end.y):
		for x: int in range(rect.position.x, rect.end.x):
			if _inside_level(x, y):
				floor_mask[Vector2i(x, y)] = true


func _erase_rect(floor_mask: Dictionary, rect: Rect2i) -> void:
	for y: int in range(rect.position.y, rect.end.y):
		for x: int in range(rect.position.x, rect.end.x):
			floor_mask.erase(Vector2i(x, y))


func _build_backdrop(cells: Array, floor_mask: Dictionary) -> void:
	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			if not _has_floor(floor_mask, x, y):
				continue
			# Stable hash keeps JSON diffs deterministic. The nearly solid base
			# tile dominates so cracks read as authored accents instead of a noisy
			# grid; roughly 13% of cells receive one of the seven variations.
			var hash_value := posmod(x * 17 + y * 31 + x * y * 3, 23)
			var floor_index := 0
			if hash_value >= 20:
				floor_index = 1 + posmod(x * 11 + y * 7, FLOOR_TILES.size() - 1)
			cells.append(_cell(x, y, FLOOR_TILES[floor_index]))


func _build_geometry(cells: Array, floor_mask: Dictionary) -> void:
	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			if _has_floor(floor_mask, x, y) or not _touches_floor(floor_mask, x, y):
				continue
			cells.append(_cell(x, y, _wall_atlas(floor_mask, x, y), WALL_SOURCE))


func _wall_atlas(floor_mask: Dictionary, x: int, y: int) -> Vector2i:
	var north := _has_floor(floor_mask, x, y - 1)
	var east := _has_floor(floor_mask, x + 1, y)
	var south := _has_floor(floor_mask, x, y + 1)
	var west := _has_floor(floor_mask, x - 1, y)

	# The low-wall atlas follows Godot's 3x3-minimal layout. The first 3x3
	# block supplies clean outer edges and corners; combined cardinal cases
	# are concave turns around room/corridor unions.
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

	var north_east := _has_floor(floor_mask, x + 1, y - 1)
	var north_west := _has_floor(floor_mask, x - 1, y - 1)
	var south_east := _has_floor(floor_mask, x + 1, y + 1)
	if south_east:
		return Vector2i(1, 0)
	if _has_floor(floor_mask, x - 1, y + 1):
		return Vector2i(3, 0)
	if north_east:
		return Vector2i(1, 2)
	if north_west:
		return Vector2i(3, 2)
	return Vector2i(2, 0)


func _build_decor(cells: Array, floor_mask: Dictionary) -> void:
	# Full-atlas floor props. These remain non-colliding and can be repainted
	# independently from the floor/walls through live sync.
	var placements := [
		[18, 6, 18, 27], [21, 12, 3, 6], [7, 24, 18, 27],
		[19, 31, 6, 9], [8, 45, 3, 6], [20, 49, 18, 27],
		[36, 6, 18, 27], [50, 7, 6, 9], [34, 18, 3, 6],
		[49, 19, 18, 27], [36, 31, 6, 9], [51, 31, 18, 27],
		[65, 6, 18, 27], [76, 8, 3, 6], [65, 16, 6, 9],
		[78, 16, 18, 27], [89, 11, 18, 27], [93, 22, 6, 9],
		[38, 45, 18, 27], [53, 48, 6, 9], [66, 31, 18, 27],
		[76, 42, 3, 6], [89, 40, 18, 27], [94, 50, 6, 9],
	]
	for item: Array in placements:
		var x := int(item[0])
		var y := int(item[1])
		if _has_floor(floor_mask, x, y):
			cells.append(_cell(x, y, Vector2i(int(item[2]), int(item[3]))))


func _build_entities() -> Array:
	return [
		{"id": "player_spawn", "type": "player", "position": [104, 104]},
		{"id": "skeleton_a", "type": "skeleton", "position": [552, 200], "patrol": 64},
		{"id": "skeleton_b", "type": "skeleton", "position": [920, 144], "patrol": 56},
		{"id": "skeleton_reaper_a", "type": "skeleton_reaper", "position": [632, 568], "patrol": 70},
		{"id": "vampire_a", "type": "vampire", "position": [1144, 584], "patrol": 60},
		{"id": "skeleton_e", "type": "skeleton", "position": [1232, 944], "patrol": 54},
		{"id": "sigil_a", "type": "sigil", "position": [680, 184]},
		{"id": "sigil_b", "type": "sigil", "position": [632, 552]},
		{"id": "sigil_c", "type": "sigil", "position": [1256, 936]},
		{"id": "door_f1_to_f2", "type": "floor_door", "position": [856, 120], "target_position": [120, 568], "label": "Tầng 2", "message": "Nhấn chuột trái để xuống tầng 2"},
		{"id": "door_f2_to_f1", "type": "floor_door", "position": [120, 568], "target_position": [856, 120], "label": "Tầng 1", "message": "Nhấn chuột trái để quay lại tầng 1"},
		{"id": "door_f2_to_f3", "type": "floor_door", "position": [1128, 616], "target_position": [224, 984], "label": "Tầng 3", "message": "Nhấn chuột trái để xuống tầng 3"},
		{"id": "door_f3_to_f2", "type": "floor_door", "position": [224, 984], "target_position": [1128, 616], "label": "Tầng 2", "message": "Nhấn chuột trái để quay lại tầng 2"},
		{"id": "chest_a", "type": "chest", "position": [392, 184]},
		{"id": "chest_b", "type": "chest", "position": [760, 984], "score_reward": 250},
		{"id": "checkpoint", "type": "checkpoint", "position": [632, 568]},
		{"id": "exit", "type": "exit_gate", "position": [1376, 960]},
		{"id": "spikes_a", "type": "spikes", "position": [776, 568]},
		{"id": "spikes_b", "type": "spikes", "position": [856, 936]},
		{"id": "torch_a", "type": "torch", "position": [328, 88]},
		{"id": "torch_b", "type": "torch", "position": [856, 184]},
		{"id": "torch_c", "type": "torch", "position": [344, 552]},
		{"id": "torch_d", "type": "torch", "position": [984, 616]},
		{"id": "torch_e", "type": "torch", "position": [520, 936]},
		{"id": "torch_f", "type": "torch", "position": [1376, 872]},
		{"id": "torch_g", "type": "torch", "position": [224, 984]},
		{"id": "torch_h", "type": "torch", "position": [1128, 616]},
		{"id": "coin_01", "type": "coin", "position": [280, 120]},
		{"id": "coin_02", "type": "coin", "position": [456, 184]},
		{"id": "coin_03", "type": "coin", "position": [232, 568]},
		{"id": "coin_04", "type": "coin", "position": [680, 136]},
		{"id": "coin_05", "type": "coin", "position": [1176, 616]},
		{"id": "coin_06", "type": "coin", "position": [1432, 944]},
	]


func _touches_floor(floor_mask: Dictionary, x: int, y: int) -> bool:
	for offset: Vector2i in [
		Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1),
		Vector2i(-1, 0), Vector2i(1, 0),
		Vector2i(-1, 1), Vector2i(0, 1), Vector2i(1, 1),
	]:
		if _has_floor(floor_mask, x + offset.x, y + offset.y):
			return true
	return false


func _has_floor(floor_mask: Dictionary, x: int, y: int) -> bool:
	return floor_mask.has(Vector2i(x, y))


func _inside_level(x: int, y: int) -> bool:
	return x >= 0 and x < WIDTH and y >= 0 and y < HEIGHT


func _cell(x: int, y: int, atlas: Vector2i, source: int = 0) -> Dictionary:
	return {
		"x": x,
		"y": y,
		"source": source,
		"atlas": [atlas.x, atlas.y],
		"alternative": 0,
	}
