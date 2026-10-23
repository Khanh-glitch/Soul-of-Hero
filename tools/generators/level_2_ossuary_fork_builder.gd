class_name Level2OssuaryForkBuilder
extends RefCounted
## Deterministic architectural builder for Chapter 1 Level 2 ("Ngã Ba Cốt Trắng").
## Produces the three-floor cathedral switchback layout verbatim without touching
## Chapter1MapBuilder or any other Chapter 1 level.

const TILE := 16
const WIDTH := 120
const HEIGHT := 97

const FLOOR_PALETTE := [
	Vector2i(1, 4), Vector2i(2, 4), Vector2i(1, 4), Vector2i(3, 4),
	Vector2i(1, 5), Vector2i(2, 5), Vector2i(1, 4), Vector2i(3, 5),
	Vector2i(1, 6), Vector2i(2, 6), Vector2i(1, 4), Vector2i(2, 4),
]

var _floor_cells: Dictionary = {}
var _geom_cells: Dictionary = {}
var _decor_cells: Dictionary = {}
var _pillar_centers: Array = []


func build() -> Dictionary:
	_floor_cells.clear()
	_geom_cells.clear()
	_decor_cells.clear()
	_pillar_centers.clear()

	# =========================================================================
	# FLOOR 1 (y = 4..26): TIỀN ĐƯỜNG PHÂN CỐT
	# =========================================================================
	_carve_rect(9, 11, 14, 10)
	_carve_rect(7, 13, 3, 6)
	_carve_rect(21, 9, 5, 14)

	_carve_rect(24, 7, 24, 7)
	_carve_rect(36, 6, 7, 2)
	_carve_rect(45, 9, 6, 7)

	_uncarve_rect(25, 14, 5, 5)

	_carve_rect(24, 19, 29, 6)
	_carve_rect(40, 24, 7, 2)
	_carve_rect(48, 13, 6, 9)

	_carve_rect(50, 9, 20, 13)
	_uncarve_rect(66, 9, 4, 2)
	_uncarve_rect(66, 20, 4, 2)
	_carve_rect(69, 11, 10, 7)

	_runner_h(8, 23, 15)
	_runner_h(8, 23, 16)
	_runner_h(24, 47, 10)
	_runner_v(47, 10, 14)
	_runner_h(24, 51, 21)
	_runner_v(51, 15, 21)
	_runner_h(69, 77, 14)

	_add_column(12, 13, false)
	_add_column(12, 18, false)
	_add_column(21, 12, false)
	_add_column(21, 19, false)
	_add_column(32, 21, false)
	_add_column(40, 21, true)
	_add_column(56, 12, false)
	_add_column(56, 18, true)
	_add_column(64, 15, false)

	# =========================================================================
	# FLOOR 2 (y = 38..60): HUYỆT ĐÀI TRẦM CỐT (EAST -> RADIAL CRUCIBLE -> WEST)
	# =========================================================================
	_carve_rect(76, 47, 14, 8)

	_carve_rect(49, 41, 29, 5)
	_carve_rect(74, 45, 5, 3)
	_carve_rect(51, 45, 4, 3)
	_carve_rect(66, 45, 4, 3)
	_uncarve_rect(55, 46, 11, 1)

	_carve_rect(44, 47, 32, 12)
	_uncarve_rect(44, 47, 3, 2)
	_uncarve_rect(73, 47, 3, 2)
	_uncarve_rect(44, 57, 3, 2)
	_uncarve_rect(73, 57, 3, 1)

	_carve_rect(35, 54, 21, 6)

	_carve_rect(33, 48, 12, 7)
	_carve_rect(21, 48, 13, 8)

	_runner_h(50, 76, 43)
	_runner_h(76, 87, 50)
	_runner_h(45, 58, 52)
	_runner_h(62, 75, 52)
	_runner_h(23, 44, 51)

	_add_column(54, 49, false)
	_add_column(66, 49, true)
	_add_column(54, 55, true)
	_add_column(66, 55, false)

	# =========================================================================
	# FLOOR 3 (y = 72..95): THÁNH ĐƯỜNG HỘI CỐT
	# =========================================================================
	_carve_rect(19, 80, 18, 9)
	_carve_rect(36, 76, 20, 6)
	_carve_rect(36, 87, 20, 6)
	_carve_rect(54, 75, 32, 18)
	_carve_rect(76, 91, 7, 3)
	_carve_rect(76, 74, 7, 2)
	_carve_rect(85, 78, 21, 13)
	_uncarve_rect(103, 78, 3, 2)
	_uncarve_rect(103, 89, 3, 2)

	_runner_h(36, 55, 79)
	_runner_v(55, 79, 83)
	_runner_h(55, 101, 83)
	_runner_h(36, 55, 89)
	_runner_v(55, 84, 89)
	_runner_h(55, 101, 84)

	_add_column(26, 82, false)
	_add_column(26, 86, false)
	_add_column(58, 79, false)
	_add_column(58, 88, true)
	_add_column(66, 81, true)
	_add_column(66, 86, false)
	_add_column(74, 78, false)
	_add_column(74, 89, false)
	_add_column(89, 80, false)
	_add_column(89, 88, false)

	# =========================================================================
	# STEP 1: EXACT 9-SLICE PERIMETER AUTOTILING + INTERIOR 2-ROW MASONRY
	# =========================================================================
	var pure_floor_set: Dictionary = {}
	for k: Vector2i in _floor_cells.keys():
		pure_floor_set[k] = true

	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			var p := Vector2i(x, y)
			if pure_floor_set.has(p):
				continue
			var touches := false
			for dy: int in range(-1, 2):
				for dx: int in range(-1, 2):
					if dx == 0 and dy == 0:
						continue
					if pure_floor_set.has(Vector2i(x + dx, y + dy)):
						touches = true
						break
				if touches:
					break
			if touches:
				var wa := _wall_atlas_9slice(pure_floor_set, x, y)
				_geom_cells[p] = [1, wa.x, wa.y]

	for wx_wy: Vector2i in _geom_cells.keys().duplicate():
		var wx := wx_wy.x
		var wy := wx_wy.y
		var south_f := pure_floor_set.has(Vector2i(wx, wy + 1))
		var sw_f := pure_floor_set.has(Vector2i(wx - 1, wy + 1))
		var se_f := pure_floor_set.has(Vector2i(wx + 1, wy + 1))
		var east_f := pure_floor_set.has(Vector2i(wx + 1, wy))
		var west_f := pure_floor_set.has(Vector2i(wx - 1, wy))
		var north_f := pure_floor_set.has(Vector2i(wx, wy - 1))
		if south_f and sw_f and se_f and not north_f and not east_f and not west_f:
			_geom_cells[wx_wy] = [0, 3, 2]
			var up := Vector2i(wx, wy - 1)
			if not pure_floor_set.has(up) and not _geom_cells.has(up):
				_geom_cells[up] = [0, 1 + posmod(wx, 3), 1]

	# =========================================================================
	# STEP 2: INTERIOR COLUMNS, BONE RELIQUARY ISLAND & TRIUMPHAL ARCH
	# =========================================================================
	for item: Array in _pillar_centers:
		var cx: int = item[0]
		var cy: int = item[1]
		var cracked: bool = item[2]
		var col_x := 6 if cracked else 5
		_set_solid(cx, cy, 0, 3, 2)
		_decor_cells[Vector2i(cx, cy - 1)] = [0, col_x, 5]
		_decor_cells[Vector2i(cx, cy)] = [0, col_x, 6]
		_decor_cells[Vector2i(cx, cy + 1)] = [0, col_x, 7]

	_place_pier_2x2(59, 51, [1, 2], [2, 2])
	_set_solid(61, 51, 0, 2, 1)
	_set_solid(61, 52, 0, 1, 12)

	_place_pier_2x2(83, 76, [1, 2], [1, 2])
	_place_pier_2x2(83, 79, [1, 2], [2, 2])
	_place_pier_2x2(83, 87, [2, 2], [1, 2])
	_place_pier_2x2(83, 90, [2, 2], [2, 2])

	# =========================================================================
	# STEP 3: MONUMENTAL GARGOYLE BASINS, CRYPT ARCHWAYS & BANNERS
	# =========================================================================
	_place_archway(10, 9, false, false)
	_set_solid(14, 10, 0, 1, 12)
	_set_solid(16, 10, 0, 2, 2)
	_set_solid(18, 10, 0, 2, 12)

	for px: int in range(25, 30):
		_set_solid(px, 14, 0, 1 + posmod(px, 3), 1)
		_set_solid(px, 15, 0, 3, 2)
	_place_basin(28, 4, true)
	_set_solid(25, 6, 0, 1, 2)
	_set_solid(32, 6, 0, 1, 2)
	_set_solid(34, 6, 0, 1, 12)
	_set_solid(44, 6, 0, 1, 2)
	_place_basin(26, 16, false)
	_set_solid(25, 17, 0, 2, 2)
	_set_solid(29, 17, 0, 2, 3)
	_set_solid(25, 15, 0, 1, 2)
	_set_solid(29, 15, 0, 1, 12)

	_set_solid(34, 18, 0, 2, 2)
	_set_solid(38, 18, 0, 1, 12)
	_set_solid(42, 18, 0, 2, 3)
	_set_solid(46, 18, 0, 2, 2)

	_set_solid(54, 8, 0, 1, 2)
	_set_solid(58, 8, 0, 1, 12)
	_set_solid(62, 8, 0, 2, 2)
	_place_archway(74, 9, true, true)

	_place_archway(84, 45, true, true)
	_set_solid(80, 46, 0, 2, 2)
	_set_solid(87, 46, 0, 1, 12)

	_place_basin(61, 38, false)
	_set_solid(53, 40, 0, 2, 2)
	_set_solid(57, 40, 0, 2, 3)
	_set_solid(67, 40, 0, 2, 3)
	_set_solid(72, 40, 0, 2, 2)

	for bx: int in range(55, 66):
		_set_solid(bx, 46, 0, 3, 2)
	_set_solid(56, 46, 0, 2, 2)
	_set_solid(58, 46, 0, 1, 12)
	_set_solid(60, 46, 0, 1, 2)
	_set_solid(62, 46, 0, 2, 12)
	_set_solid(64, 46, 0, 2, 2)

	_place_archway(24, 46, true, true)
	_set_solid(29, 47, 0, 1, 2)
	_set_solid(37, 47, 0, 1, 12)

	_place_archway(22, 78, true, true)
	_set_solid(29, 79, 0, 2, 2)
	_set_solid(33, 79, 0, 2, 3)

	_set_solid(41, 86, 0, 2, 2)
	_set_solid(44, 86, 0, 1, 12)
	_set_solid(47, 86, 0, 2, 3)
	_set_solid(42, 75, 0, 1, 2)
	_set_solid(48, 75, 0, 1, 2)

	_place_basin(69, 72, true)
	_set_solid(60, 74, 0, 1, 2)
	_set_solid(64, 74, 0, 1, 12)
	_set_solid(80, 73, 0, 1, 2)

	_place_basin(91, 75, false)
	for mx: int in range(94, 99):
		_set_solid(mx, 76, 0, 1 + posmod(mx, 3), 1)
		_set_solid(mx, 77, 0, 3, 2)
	_place_basin(99, 75, true)
	_set_solid(88, 77, 0, 2, 2)
	_set_solid(94, 77, 0, 1, 12)
	_set_solid(98, 77, 0, 2, 12)

	var skull_cells := [
		Vector2i(10, 12), Vector2i(10, 19), Vector2i(24, 12), Vector2i(24, 19), Vector2i(30, 12), Vector2i(30, 19),
		Vector2i(27, 8), Vector2i(42, 7), Vector2i(41, 25), Vector2i(45, 25), Vector2i(50, 10), Vector2i(68, 12), Vector2i(68, 16),
		Vector2i(58, 50), Vector2i(62, 50), Vector2i(58, 53), Vector2i(62, 53), Vector2i(50, 42), Vector2i(76, 42),
		Vector2i(37, 58), Vector2i(47, 58), Vector2i(22, 49), Vector2i(22, 54),
		Vector2i(20, 81), Vector2i(20, 87), Vector2i(40, 81), Vector2i(40, 87), Vector2i(77, 92), Vector2i(81, 92),
		Vector2i(82, 81), Vector2i(82, 86), Vector2i(87, 79), Vector2i(87, 89), Vector2i(102, 81), Vector2i(102, 87),
	]
	for sc: Vector2i in skull_cells:
		if _floor_cells.has(sc) and not _decor_cells.has(sc):
			_decor_cells[sc] = [0, 18, 27]

	var f1_door_pos := _cpos(75, 14)
	var f2_entry_pos := _cpos(85, 50)
	var f2_door_pos := _cpos(25, 51)
	var f3_entry_pos := _cpos(23, 84)

	var entities: Array = [
		{"id": "player_spawn", "type": "player", "position": _cpos(15, 15)},
		{"id": "l2_c1_skeleton_01", "type": "skeleton", "position": _cpos(36, 10), "patrol": 40},
		{"id": "l2_c1_skeleton_02", "type": "skeleton", "position": _cpos(36, 22), "patrol": 40},
		{"id": "l2_c1_skeleton_03", "type": "skeleton", "position": _cpos(54, 16), "patrol": 40},
		{"id": "l2_c1_skeleton_04", "type": "skeleton", "position": _cpos(60, 12), "patrol": 40},
		{"id": "l2_c1_skeleton_05", "type": "skeleton", "position": _cpos(61, 18), "patrol": 40},
		{"id": "l2_c2_skeleton_01", "type": "skeleton", "position": _cpos(51, 50), "patrol": 40},
		{"id": "l2_c2_skeleton_02", "type": "skeleton", "position": _cpos(69, 50), "patrol": 40},
		{"id": "l2_c2_skeleton_03", "type": "skeleton", "position": _cpos(49, 55), "patrol": 40},
		{"id": "l2_c2_skeleton_04", "type": "skeleton", "position": _cpos(70, 55), "patrol": 40},
		{"id": "l2_c2_skeleton_05", "type": "skeleton", "position": _cpos(60, 56), "patrol": 40},
		{"id": "l2_c3_skeleton_01", "type": "skeleton", "position": _cpos(52, 79), "patrol": 38},
		{"id": "l2_c3_skeleton_02", "type": "skeleton", "position": _cpos(61, 88), "patrol": 38},
		{"id": "l2_c3_skeleton_03", "type": "skeleton", "position": _cpos(71, 80), "patrol": 38},
		{"id": "l2_c3_skeleton_04", "type": "skeleton", "position": _cpos(71, 88), "patrol": 38},
		{"id": "l2_c3_skeleton_05", "type": "skeleton", "position": _cpos(79, 83), "patrol": 38},
		{
			"id": "door_l2_f1_f2_down",
			"type": "floor_door",
			"position": f1_door_pos,
			"target_position": f2_entry_pos,
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l2_f1_f2_up",
			"type": "floor_door",
			"position": f2_entry_pos,
			"target_position": f1_door_pos,
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{
			"id": "door_l2_f2_f3_down",
			"type": "floor_door",
			"position": f2_door_pos,
			"target_position": f3_entry_pos,
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l2_f2_f3_up",
			"type": "floor_door",
			"position": f3_entry_pos,
			"target_position": f2_door_pos,
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{"id": "l2_sigil_choice_north", "type": "sigil", "position": _cpos(34, 10)},
		{"id": "l2_sigil_choice_south", "type": "sigil", "position": _cpos(52, 44)},
		{"id": "l2_sigil_ring", "type": "sigil", "position": _cpos(60, 54)},
		{"id": "l2_sigil_gauntlet", "type": "sigil", "position": _cpos(78, 83)},
		{"id": "l2_checkpoint_floor_2", "type": "checkpoint", "position": _cpos(60, 44)},
		{"id": "l2_checkpoint_floor_3", "type": "checkpoint", "position": _cpos(29, 84)},
		{"id": "l2_exit", "type": "exit_gate", "position": _cpos(96, 81)},
		{"id": "l2_chest_risky_branch", "type": "chest", "position": _cpos(39, 9), "score_reward": 220},
		{"id": "l2_chest_gauntlet", "type": "chest", "position": _cpos(79, 91), "score_reward": 280},
		{"id": "l2_spikes_01", "type": "spikes", "position": _cpos(28, 9)},
		{"id": "l2_spikes_02", "type": "spikes", "position": _cpos(32, 11)},
		{"id": "l2_spikes_03", "type": "spikes", "position": _cpos(41, 10)},
		{"id": "l2_spikes_04", "type": "spikes", "position": _cpos(45, 11)},
		{"id": "l2_spikes_05", "type": "spikes", "position": _cpos(56, 52)},
		{"id": "l2_spikes_06", "type": "spikes", "position": _cpos(64, 52)},
		{"id": "l2_spikes_07", "type": "spikes", "position": _cpos(51, 53)},
		{"id": "l2_spikes_08", "type": "spikes", "position": _cpos(69, 53)},
		{"id": "l2_spikes_09", "type": "spikes", "position": _cpos(45, 56)},
		{"id": "l2_spikes_10", "type": "spikes", "position": _cpos(39, 56)},
		{"id": "l2_spikes_11", "type": "spikes", "position": _cpos(43, 79)},
		{"id": "l2_spikes_12", "type": "spikes", "position": _cpos(49, 78)},
		{"id": "l2_spikes_13", "type": "spikes", "position": _cpos(70, 84)},
		{"id": "l2_spikes_14", "type": "spikes", "position": _cpos(77, 79)},
		{"id": "l2_spikes_15", "type": "spikes", "position": _cpos(77, 87)},
		{"id": "l2_torch_01", "type": "torch", "position": _cpos(10, 14)},
		{"id": "l2_torch_02", "type": "torch", "position": _cpos(23, 10)},
		{"id": "l2_torch_03", "type": "torch", "position": _cpos(23, 20)},
		{"id": "l2_torch_04", "type": "torch", "position": _cpos(52, 10)},
		{"id": "l2_torch_05", "type": "torch", "position": _cpos(72, 12)},
		{"id": "l2_torch_06", "type": "torch", "position": _cpos(82, 48)},
		{"id": "l2_torch_07", "type": "torch", "position": _cpos(57, 49)},
		{"id": "l2_torch_08", "type": "torch", "position": _cpos(63, 56)},
		{"id": "l2_torch_09", "type": "torch", "position": _cpos(27, 81)},
		{"id": "l2_torch_10", "type": "torch", "position": _cpos(93, 80)},
		{"id": "l2_torch_11", "type": "torch", "position": _cpos(10, 17)},
		{"id": "l2_torch_12", "type": "torch", "position": _cpos(36, 8)},
		{"id": "l2_torch_13", "type": "torch", "position": _cpos(44, 20)},
		{"id": "l2_torch_14", "type": "torch", "position": _cpos(66, 18)},
		{"id": "l2_torch_15", "type": "torch", "position": _cpos(58, 42)},
		{"id": "l2_torch_16", "type": "torch", "position": _cpos(65, 42)},
		{"id": "l2_torch_17", "type": "torch", "position": _cpos(28, 49)},
		{"id": "l2_torch_18", "type": "torch", "position": _cpos(43, 55)},
		{"id": "l2_torch_19", "type": "torch", "position": _cpos(55, 77)},
		{"id": "l2_torch_20", "type": "torch", "position": _cpos(77, 91)},
		{"id": "l2_torch_21", "type": "torch", "position": _cpos(86, 80)},
		{"id": "l2_torch_22", "type": "torch", "position": _cpos(101, 80)},
		{"id": "l2_coin_01", "type": "coin", "position": _cpos(30, 10)},
		{"id": "l2_coin_02", "type": "coin", "position": _cpos(38, 11)},
		{"id": "l2_coin_03", "type": "coin", "position": _cpos(42, 24)},
		{"id": "l2_coin_04", "type": "coin", "position": _cpos(45, 24)},
		{"id": "l2_coin_05", "type": "coin", "position": _cpos(58, 54)},
		{"id": "l2_coin_06", "type": "coin", "position": _cpos(62, 54)},
		{"id": "l2_coin_07", "type": "coin", "position": _cpos(42, 58)},
		{"id": "l2_coin_08", "type": "coin", "position": _cpos(46, 79)},
		{"id": "l2_coin_09", "type": "coin", "position": _cpos(89, 83)},
		{"id": "l2_coin_10", "type": "coin", "position": _cpos(93, 84)},
		{"id": "l2_coin_11", "type": "coin", "position": _cpos(26, 10)},
		{"id": "l2_coin_12", "type": "coin", "position": _cpos(43, 10)},
		{"id": "l2_coin_13", "type": "coin", "position": _cpos(27, 21)},
		{"id": "l2_coin_14", "type": "coin", "position": _cpos(55, 43)},
		{"id": "l2_coin_15", "type": "coin", "position": _cpos(48, 58)},
		{"id": "l2_coin_16", "type": "coin", "position": _cpos(44, 89)},
		{"id": "l2_coin_17", "type": "coin", "position": _cpos(81, 91)},
		{"id": "l2_coin_18", "type": "coin", "position": _cpos(97, 84)},
	]

	var rooms := [
		{"id": "l2_f1_entry", "floor": 1, "role": "safe_entry", "rect": [7, 11, 14, 10]},
		{"id": "l2_f1_fork", "floor": 1, "role": "route_choice", "rect": [21, 9, 9, 14]},
		{"id": "l2_f1_north_reliquary", "floor": 1, "role": "optional_reward", "rect": [24, 6, 26, 9]},
		{"id": "l2_f1_south_reliquary", "floor": 1, "role": "optional_reward", "rect": [24, 19, 30, 7]},
		{"id": "l2_f1_convergence", "floor": 1, "role": "combat_camp", "rect": [50, 9, 29, 13]},
		{"id": "l2_f2_landing", "floor": 2, "role": "safe_landing", "rect": [76, 47, 14, 8]},
		{"id": "l2_f2_ring", "floor": 2, "role": "combat_camp", "rect": [44, 47, 32, 12]},
		{"id": "l2_f2_north_cache", "floor": 2, "role": "flank_route", "rect": [49, 41, 29, 5]},
		{"id": "l2_f2_south_cache", "floor": 2, "role": "flank_route", "rect": [35, 54, 21, 6]},
		{"id": "l2_f2_convergence", "floor": 2, "role": "breather", "rect": [21, 48, 14, 8]},
		{"id": "l2_f3_landing", "floor": 3, "role": "safe_landing", "rect": [19, 80, 18, 9]},
		{"id": "l2_f3_gauntlet", "floor": 3, "role": "combat_camp", "rect": [36, 74, 49, 20]},
		{"id": "l2_f3_exit", "floor": 3, "role": "exit", "rect": [85, 78, 21, 13]},
	]

	var metadata := {
		"objective": "Chọn nhánh ít rủi ro hơn, phá ba bãi xương và thu 3 trong 4 ấn ký.",
		"difficulty_tier": 2,
		"pacing": "three_five_member_packs_per_floor_with_route_pressure",
		"density_cadence_anchor": [808, 216],
		"roster_id": "chapter_1_level_2_roster",
		"encounter_pack_model": {
			"enabled": true,
			"profile_stage": 2,
			"floor_count": 3,
			"placement": "authored_camp_anchors",
			"authored_counts_are_anchors": true,
		},
		"required_sigils": 3,
		"camera_bounds": [0, 0, 110 * TILE, HEIGHT * TILE],
		"layout_profile": "three_floor_fork_and_recombine",
		"tileset": "0x72 DungeonTileset II v1.7 (CC0)",
		"rooms": rooms,
		"combat_camps": [
			{
				"id": "l2_camp_1_shield_wall",
				"floor": 1,
				"rect": [34, 8, 30, 16],
				"entry_cell": [50, 15],
				"enemy_ids": [
					"l2_c1_skeleton_01",
					"l2_c1_skeleton_02",
					"l2_c1_skeleton_03",
					"l2_c1_skeleton_04",
					"l2_c1_skeleton_05",
				],
				"formation": "five_swordsmen_converge_on_two_entries",
				"breather_after": true,
			},
			{
				"id": "l2_camp_2_ring_pressure",
				"floor": 2,
				"rect": [46, 47, 28, 12],
				"entry_cell": [74, 50],
				"enemy_ids": [
					"l2_c2_skeleton_01",
					"l2_c2_skeleton_02",
					"l2_c2_skeleton_03",
					"l2_c2_skeleton_04",
					"l2_c2_skeleton_05",
				],
				"formation": "five_swordsmen_attack_around_a_cover_pit",
				"breather_after": true,
			},
			{
				"id": "l2_camp_3_slalom",
				"floor": 3,
				"rect": [49, 76, 33, 15],
				"entry_cell": [55, 83],
				"enemy_ids": [
					"l2_c3_skeleton_01",
					"l2_c3_skeleton_02",
					"l2_c3_skeleton_03",
					"l2_c3_skeleton_04",
					"l2_c3_skeleton_05",
				],
				"formation": "five_swordsmen_hold_both_slalom_lanes",
				"breather_after": true,
			},
		],
		"safe_zones": [
			{"id": "l2_spawn_sanctuary", "rect": [7, 11, 14, 10], "purpose": "spawn_and_control_read"},
			{"id": "l2_floor_2_breather", "rect": [49, 41, 29, 5], "purpose": "checkpoint_after_camp"},
			{"id": "l2_floor_3_breather", "rect": [19, 80, 18, 9], "purpose": "checkpoint_before_final_camp"},
		],
		"special_zones": [
			{"id": "l2_choose_one_sigil_fork", "rect": [24, 6, 30, 20], "purpose": "two_risk_profiles_one_required_route"},
		],
	}

	return {
		"version": 2,
		"name": "Ngã Ba Cốt Trắng",
		"movement_mode": "top_down",
		"tile_size": TILE,
		"width": WIDTH,
		"height": HEIGHT,
		"layers": {
			"Backdrop": _serialize_layer(_floor_cells),
			"Geometry": _serialize_layer(_geom_cells),
			"Decor": _serialize_layer(_decor_cells),
		},
		"entities": entities,
		"metadata": metadata,
	}


func _cpos(cx: int, cy: int) -> Array:
	return [cx * TILE + 8, cy * TILE + 8]


func _floor_tile_for(x: int, y: int) -> Vector2i:
	var a := (x * 73856093) & 0xFFFFFFFF
	var b := (y * 19349663) & 0xFFFFFFFF
	var c := ((x + y) * 83492791) & 0xFFFFFFFF
	var idx := (a ^ b ^ c) & 0xFFFFFFFF
	return FLOOR_PALETTE[idx % FLOOR_PALETTE.size()]


func _wall_atlas_9slice(floor_set: Dictionary, x: int, y: int) -> Vector2i:
	var north := floor_set.has(Vector2i(x, y - 1))
	var east := floor_set.has(Vector2i(x + 1, y))
	var south := floor_set.has(Vector2i(x, y + 1))
	var west := floor_set.has(Vector2i(x - 1, y))
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
	if floor_set.has(Vector2i(x + 1, y + 1)):
		return Vector2i(1, 0)
	if floor_set.has(Vector2i(x - 1, y + 1)):
		return Vector2i(3, 0)
	if floor_set.has(Vector2i(x + 1, y - 1)):
		return Vector2i(1, 2)
	if floor_set.has(Vector2i(x - 1, y - 1)):
		return Vector2i(3, 2)
	return Vector2i(2, 0)


func _set_solid(x: int, y: int, src: int, tx: int, ty: int) -> void:
	var p := Vector2i(x, y)
	_floor_cells.erase(p)
	_geom_cells[p] = [src, tx, ty]


func _carve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			if x >= 2 and x < WIDTH - 2 and y >= 2 and y < HEIGHT - 2:
				var p := Vector2i(x, y)
				var ft := _floor_tile_for(x, y)
				_floor_cells[p] = [0, ft.x, ft.y]
				_geom_cells.erase(p)


func _uncarve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			_floor_cells.erase(Vector2i(x, y))


func _runner_h(x0: int, x1: int, y: int) -> void:
	for x: int in range(x0, x1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 1, 4]


func _runner_v(x: int, y0: int, y1: int) -> void:
	for y: int in range(y0, y1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 1, 4]


func _add_column(cx: int, cy: int, cracked: bool) -> void:
	_pillar_centers.append([cx, cy, cracked])


func _place_pier_2x2(x0: int, y0: int, left_banner: Array, right_banner: Array) -> void:
	for dy: int in range(2):
		for dx: int in range(2):
			if dy == 0:
				_set_solid(x0 + dx, y0 + dy, 0, 1 + dx, 1)
			else:
				_set_solid(x0 + dx, y0 + dy, 0, 3, 2)
	if left_banner.size() == 2:
		_set_solid(x0, y0 + 1, 0, int(left_banner[0]), int(left_banner[1]))
	if right_banner.size() == 2:
		_set_solid(x0 + 1, y0 + 1, 0, int(right_banner[0]), int(right_banner[1]))


func _place_basin(x0: int, y_top: int, crimson: bool) -> void:
	var txs := [4, 5, 6]
	for dx: int in range(3):
		var tx: int = txs[dx]
		_set_solid(x0 + dx, y_top, 0, tx, 0)
		_set_solid(x0 + dx, y_top + 1, 0, tx, 1 if crimson else 3)
		_set_solid(x0 + dx, y_top + 2, 0, tx, 2 if crimson else 4)


func _place_archway(x0: int, y_top: int, open_arch: bool, with_stairs_below: bool) -> void:
	var base_tx := 5 if open_arch else 2
	for dx: int in range(2):
		_set_solid(x0 + dx, y_top, 0, base_tx + dx, 15)
		_set_solid(x0 + dx, y_top + 1, 0, base_tx + dx, 16)
	if with_stairs_below:
		var s0 := Vector2i(x0, y_top + 2)
		var s1 := Vector2i(x0 + 1, y_top + 2)
		if _floor_cells.has(s0):
			_decor_cells[s0] = [0, 5, 12]
		if _floor_cells.has(s1):
			_decor_cells[s1] = [0, 3, 6]


func _serialize_layer(cells: Dictionary) -> Array:
	var out: Array = []
	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			var p := Vector2i(x, y)
			if not cells.has(p):
				continue
			var entry: Array = cells[p]
			out.append({
				"x": x,
				"y": y,
				"source": int(entry[0]),
				"atlas": [int(entry[1]), int(entry[2])],
				"alternative": 0,
			})
	return out
