class_name Level4SpiralReliquaryBuilder
extends RefCounted
## Deterministic architectural builder for Chapter 1 Level 4 ("Thánh Tích Xoắn Ốc").
## True concentric processional spirals & radial pinwheel shrines on a 116x100
## canvas with zero inter-floor camera bleed, molten-amber brazier palette,
## dormant iron-grate fore-telegraphed trap gates, and authentic multi-turn
## inward sanctum coils.

const TILE := 16
const WIDTH := 116
const HEIGHT := 100

const FLOOR_PALETTE := [
	Vector2i(1, 4), Vector2i(2, 4), Vector2i(3, 4), Vector2i(2, 5),
	Vector2i(1, 5), Vector2i(3, 5), Vector2i(1, 4), Vector2i(2, 6),
	Vector2i(1, 6), Vector2i(2, 4), Vector2i(3, 4), Vector2i(1, 4),
]

var _floor_cells: Dictionary = {}
var _geom_cells: Dictionary = {}
var _decor_cells: Dictionary = {}
var _reliquary_altars: Array = []


func build() -> Dictionary:
	_floor_cells.clear()
	_geom_cells.clear()
	_decor_cells.clear()
	_reliquary_altars.clear()

	# =========================================================================
	# FLOOR 1 (y = 4..26, W -> E): CONSECRATED VESTIBULE -> GREAT THREE-TURN
	# CONCENTRIC SPIRAL (CRISP 3-TILE ABYSS GAPS!) -> SPIRAL RELEASE CAMP 1
	# =========================================================================
	_carve_rect(7, 10, 12, 9)
	_carve_rect(5, 12, 3, 5)
	_carve_rect(19, 13, 5, 4)

	# GREAT CONCENTRIC SPIRAL (x = 23..65, y = 4..26):
	# Outer West Arm (x = 23..26) + 5-tile abyss separation (x = 27..31 -> 3-col black void!)
	_carve_rect(23, 4, 4, 23)
	# Outer North Clockwise Gallery
	_carve_rect(23, 4, 43, 4)
	# Outer South Treasure Gallery (`l4_chest_spiral` 420 pts)
	_carve_rect(23, 23, 43, 4)
	# Outer East Arm (x = 62..65, separated from Inner Coil x<=56 by 5-tile void gap!)
	_carve_rect(62, 4, 4, 23)

	# Authentic Inner Counter-Coil entering from SE Mouth (x = 55..62, y = 17..20)
	# -> Inner South (x = 32..57, y = 17..20) -> Inner West (x = 32..36, y = 10..20)
	# -> Inner North (x = 32..56, y = 10..13) -> CENTRAL BULLSEYE SHRINE (x = 42..56, y = 10..15)!
	_carve_rect(32, 17, 30, 4)
	_carve_rect(32, 10, 5, 11)
	_carve_rect(32, 10, 24, 4)
	_carve_rect(43, 11, 13, 5)

	# East Bridge out of Spiral into Spiral Release Camp 1 (`l4_f1_camp`)
	_carve_rect(66, 13, 14, 4)
	_carve_rect(80, 7, 27, 16)
	_uncarve_rect(80, 7, 4, 2)
	_uncarve_rect(80, 21, 4, 2)
	_uncarve_rect(103, 7, 4, 2)
	_uncarve_rect(103, 21, 4, 2)
	_uncarve_rect(91, 13, 5, 4)
	_carve_rect(106, 16, 6, 5)

	_runner_h(7, 25, 14)
	_runner_v(25, 6, 24)
	_runner_h(25, 63, 6)
	_runner_h(25, 63, 24)
	_runner_v(63, 6, 24)
	_runner_h(34, 62, 18)
	_runner_v(34, 12, 18)
	_runner_h(34, 53, 12)
	_runner_h(66, 90, 15)
	_runner_h(96, 110, 18)

	_add_altar(11, 11)
	_add_altar(11, 17)
	_add_altar(44, 14)
	_add_altar(85, 10)
	_add_altar(85, 19)
	_add_altar(99, 14)

	# =========================================================================
	# FLOOR 2 (y = 42..62, W -> E): SAFE BREATHER -> OCTAGONAL ELITE PIN ARENA
	# -> THREE-RING BULLSEYE PINWHEEL SPIRAL (`mid` SHOWCASE!)
	# =========================================================================
	_carve_rect(6, 48, 14, 9)
	_carve_rect(20, 50, 9, 5)

	_carve_rect(29, 43, 33, 19)
	_uncarve_rect(29, 43, 4, 3)
	_uncarve_rect(29, 59, 4, 3)
	_uncarve_rect(58, 43, 4, 3)
	_uncarve_rect(58, 59, 4, 3)
	_uncarve_rect(42, 50, 7, 5)

	_carve_rect(62, 50, 8, 5)

	# THREE-RING BULLSEYE PINWHEEL SPIRAL (`l4_f2_relay_ring`: x = 69..110, y = 42..62)
	# Symmetrical 5-tile abyss channels on BOTH West (x=73..77) & East (x=101..105) -> 3-col black void!
	_carve_rect(69, 42, 4, 20)
	_carve_rect(69, 42, 41, 4)
	_carve_rect(106, 42, 4, 20)
	_carve_rect(78, 58, 32, 4)
	_carve_rect(78, 48, 4, 14)
	_carve_rect(78, 48, 23, 4)
	_carve_rect(97, 48, 4, 8)
	_carve_rect(86, 51, 15, 5)

	_runner_h(8, 41, 52)
	_runner_h(33, 57, 45)
	_runner_h(33, 57, 59)
	_runner_h(50, 71, 52)
	_runner_v(71, 44, 59)
	_runner_h(71, 107, 44)
	_runner_v(107, 44, 59)
	_runner_h(80, 107, 59)
	_runner_v(80, 50, 59)
	_runner_h(80, 99, 50)
	_runner_h(88, 99, 53)

	_add_altar(12, 50)
	_add_altar(35, 48)
	_add_altar(52, 48)
	_add_altar(52, 56)
	_add_altar(87, 54)

	# =========================================================================
	# FLOOR 3 (y = 78..98, W -> E): SAFE BREATHER -> BROKEN-CROSS RADIAL CLIMAX
	# -> CEREMONIAL HALF-SPIRAL EXIT SANCTUM (`end` SHOWCASE!)
	# =========================================================================
	_carve_rect(6, 84, 14, 9)
	_carve_rect(20, 86, 13, 5)

	# Broken-Cross Radial Climax Arena (`l4_camp_3_broken_cross`)
	_carve_rect(33, 78, 49, 20)
	_uncarve_rect(33, 78, 4, 3)
	_uncarve_rect(33, 95, 4, 3)
	# Four symmetric quadrant abysses leaving wide central cross spoke (y = 86..90)!
	_uncarve_rect(43, 82, 8, 3)
	_uncarve_rect(61, 82, 8, 3)
	_uncarve_rect(43, 92, 8, 3)
	_uncarve_rect(61, 92, 8, 3)

	_carve_rect(82, 86, 6, 5)
	_carve_rect(88, 79, 23, 18)
	_uncarve_rect(88, 79, 3, 2)
	_uncarve_rect(88, 95, 3, 2)
	_uncarve_rect(108, 79, 3, 2)
	_uncarve_rect(108, 95, 3, 2)
	_uncarve_rect(94, 84, 9, 3)
	_uncarve_rect(94, 91, 9, 2)

	_runner_h(8, 87, 88)
	_runner_v(56, 80, 96)
	_runner_h(39, 77, 80)
	_runner_h(39, 77, 96)
	_runner_v(91, 81, 95)
	_runner_h(91, 106, 81)
	_runner_v(106, 81, 95)
	_runner_h(96, 106, 88)

	_add_altar(12, 86)
	_add_altar(55, 88)
	_add_altar(74, 88)
	_add_altar(98, 88)

	# =========================================================================
	# TIGHT 1-RING PARAPET + NORTH MASONRY SHELL
	# =========================================================================
	var floor_lookup: Dictionary = {}
	for c: Vector2i in _floor_cells.keys():
		floor_lookup[c] = true

	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			var p := Vector2i(x, y)
			if floor_lookup.has(p) or _geom_cells.has(p):
				continue
			var near_1 := false
			for dy: int in range(-1, 2):
				for dx: int in range(-1, 2):
					if floor_lookup.has(Vector2i(x + dx, y + dy)):
						near_1 = true
						break
				if near_1:
					break
			var north_cap := floor_lookup.has(Vector2i(x, y + 2)) and not floor_lookup.has(Vector2i(x, y - 1))
			if not near_1 and not north_cap:
				continue
			if floor_lookup.has(Vector2i(x, y + 1)):
				var variant := (x + y) % 3
				_geom_cells[p] = [0, 1 + variant, 1]
			else:
				var w := _wall_atlas_9slice(floor_lookup, x, y)
				_geom_cells[p] = [1, w.x, w.y]

	for entry: Array in _reliquary_altars:
		_stamp_altar(int(entry[0]), int(entry[1]))

	# =========================================================================
	# MOLTEN-AMBER RELIQUARY SETPIECES ([4..6,1..2] FIRE BRAZIERS, [2,3] GOLD
	# STANDARDS, [5,12] SPIRAL STAIR STEPS & [1..2,12] DORMANT TRAP TELEGRAPHS!)
	# =========================================================================
	_place_gold_banners(8, 9)
	_place_molten_brazier(13, 7)
	_place_gold_banners(20, 12)
	_place_molten_brazier(33, 1)
	_place_gold_banners(44, 3)
	_place_molten_brazier(54, 1)
	_place_gold_banners(44, 9)
	_place_gold_banners(39, 16)
	_place_gold_banners(51, 16)
	_place_molten_brazier(71, 10)
	_place_molten_brazier(92, 4)
	_place_gold_banners(86, 6)
	_place_gold_banners(99, 6)
	_place_gold_banners(108, 15)

	_place_gold_banners(9, 47)
	_place_molten_brazier(14, 45)
	_place_molten_brazier(44, 39)
	_place_gold_banners(36, 42)
	_place_gold_banners(53, 42)
	_place_gold_banners(65, 49)
	_place_molten_brazier(79, 39)
	_place_gold_banners(89, 41)
	_place_molten_brazier(99, 39)
	_place_gold_banners(83, 47)
	_place_gold_banners(93, 47)
	_place_gold_banners(82, 57)
	_place_gold_banners(96, 57)
	_place_spiral_steps(90, 53)
	_place_spiral_steps(93, 53)

	_place_gold_banners(9, 83)
	_place_molten_brazier(14, 81)
	_place_gold_banners(25, 85)
	_place_molten_brazier(45, 75)
	_place_gold_banners(55, 77)
	_place_molten_brazier(65, 75)
	_place_gold_banners(46, 85)
	_place_gold_banners(64, 85)
	_place_gold_banners(84, 85)
	_place_molten_brazier(97, 76)
	_place_gold_banners(92, 78)
	_place_gold_banners(104, 78)
	_place_gold_banners(96, 86)
	_place_spiral_steps(108, 18)
	_place_spiral_steps(102, 88)

	var floor_decor := [
		[8, 11, 0, 21, 21], [17, 11, 0, 5, 13], [17, 17, 0, 6, 13],
		[28, 25, 0, 21, 22], [33, 25, 0, 18, 27], [53, 12, 0, 21, 21], [54, 14, 0, 5, 13],
		[82, 9, 0, 18, 27], [82, 20, 0, 21, 22], [104, 10, 0, 21, 21],
		[8, 49, 0, 21, 21], [18, 49, 0, 5, 13], [34, 44, 0, 18, 27], [56, 60, 0, 21, 22],
		[70, 43, 0, 5, 13], [108, 43, 0, 21, 21], [108, 60, 0, 6, 13], [95, 52, 0, 21, 21],
		[8, 85, 0, 21, 21], [18, 85, 0, 5, 13], [38, 79, 0, 18, 27], [78, 79, 0, 21, 22],
		[92, 80, 0, 5, 13], [92, 95, 0, 6, 13], [106, 80, 0, 21, 21], [106, 95, 0, 21, 22],
	]
	for d: Array in floor_decor:
		var dp := Vector2i(int(d[0]), int(d[1]))
		if _floor_cells.has(dp):
			_decor_cells[dp] = [int(d[2]), int(d[3]), int(d[4])]

	# =========================================================================
	# ALL 74 ORIGINAL ENTITY IDS PRESERVED 100% + AUTHORED BEACONS/COINS (94)
	# =========================================================================
	var spikes_coords := [
		Vector2i(36, 6), Vector2i(50, 6), Vector2i(52, 24), Vector2i(38, 24),
		Vector2i(45, 18), Vector2i(40, 12), Vector2i(59, 18), Vector2i(73, 15),
		Vector2i(93, 10),
		Vector2i(38, 52), Vector2i(53, 52), Vector2i(66, 52),
		Vector2i(86, 44), Vector2i(98, 44), Vector2i(92, 59), Vector2i(84, 50),
		Vector2i(40, 88), Vector2i(56, 82), Vector2i(56, 94), Vector2i(71, 88),
		Vector2i(95, 81),
	]

	for sc: Vector2i in spikes_coords:
		for dir: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT]:
			var gp := sc + dir
			if _floor_cells.has(gp):
				_floor_cells[gp] = [0, 1 if dir.x < 0 else 2, 12]

	var entities: Array = [
		{"id": "player_spawn", "type": "player", "position": _cpos(14, 14)},

		# Camp 1 (`l4_camp_1_spiral_release`: 4 Skeletons + 1 Reaper around molten core)
		{"id": "l4_c1_skeleton_01", "type": "skeleton", "position": _cpos(83, 15), "patrol": 32},
		{"id": "l4_c1_skeleton_02", "type": "skeleton", "position": _cpos(89, 10), "patrol": 32},
		{"id": "l4_c1_skeleton_03", "type": "skeleton", "position": _cpos(89, 20), "patrol": 32},
		{"id": "l4_c1_skeleton_04", "type": "skeleton", "position": _cpos(98, 19), "patrol": 32},
		{"id": "l4_c1_reaper_01", "type": "skeleton_reaper", "position": _cpos(102, 12), "patrol": 28},

		# Camp 2 (`l4_camp_2_elite_pin`: 3 Skeletons + 2 Cross-Firing Reapers)
		{"id": "l4_c2_skeleton_01", "type": "skeleton", "position": _cpos(34, 52), "patrol": 32},
		{"id": "l4_c2_skeleton_02", "type": "skeleton", "position": _cpos(46, 46), "patrol": 32},
		{"id": "l4_c2_skeleton_03", "type": "skeleton", "position": _cpos(46, 58), "patrol": 32},
		{"id": "l4_c2_reaper_01", "type": "skeleton_reaper", "position": _cpos(39, 46), "patrol": 28},
		{"id": "l4_c2_reaper_02", "type": "skeleton_reaper", "position": _cpos(57, 52), "patrol": 28},

		# Camp 3 (`l4_camp_3_broken_cross`: 3 Skeletons + 2 Diagonal Reapers)
		{"id": "l4_c3_skeleton_01", "type": "skeleton", "position": _cpos(46, 88), "patrol": 32},
		{"id": "l4_c3_skeleton_02", "type": "skeleton", "position": _cpos(55, 84), "patrol": 32},
		{"id": "l4_c3_skeleton_03", "type": "skeleton", "position": _cpos(75, 82), "patrol": 32},
		{"id": "l4_c3_reaper_01", "type": "skeleton_reaper", "position": _cpos(76, 94), "patrol": 26},
		{"id": "l4_c3_reaper_02", "type": "skeleton_reaper", "position": _cpos(63, 80), "patrol": 26},

		# Reciprocal Floor Doors (4: `door_l4_f2_f3_down` at bullseye heart (91, 53)!)
		{
			"id": "door_l4_f1_f2_down",
			"type": "floor_door",
			"position": _cpos(109, 18),
			"target_position": _cpos(9, 52),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l4_f1_f2_up",
			"type": "floor_door",
			"position": _cpos(9, 52),
			"target_position": _cpos(109, 18),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{
			"id": "door_l4_f2_f3_down",
			"type": "floor_door",
			"position": _cpos(91, 53),
			"target_position": _cpos(9, 88),
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l4_f2_f3_up",
			"type": "floor_door",
			"position": _cpos(9, 88),
			"target_position": _cpos(91, 53),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},

		# 4/4 Required Sigils
		{"id": "l4_sigil_spiral", "type": "sigil", "position": _cpos(49, 13)},
		{"id": "l4_sigil_camp_1", "type": "sigil", "position": _cpos(104, 15)},
		{"id": "l4_sigil_camp_2", "type": "sigil", "position": _cpos(55, 59)},
		{"id": "l4_sigil_camp_3", "type": "sigil", "position": _cpos(80, 88)},

		# Checkpoints (2) & Exit Gate (1)
		{"id": "l4_checkpoint_floor_2", "type": "checkpoint", "position": _cpos(16, 52)},
		{"id": "l4_checkpoint_floor_3", "type": "checkpoint", "position": _cpos(16, 88)},
		{"id": "l4_exit", "type": "exit_gate", "position": _cpos(104, 88)},

		# Chests (2: exact score_reward 420 & 460 preserved)
		{"id": "l4_chest_spiral", "type": "chest", "position": _cpos(30, 25), "score_reward": 420},
		{"id": "l4_chest_pinwheel", "type": "chest", "position": _cpos(104, 44), "score_reward": 460},

		# 21 Authored Spikes
		{"id": "l4_spikes_01", "type": "spikes", "position": _cpos(36, 6)},
		{"id": "l4_spikes_02", "type": "spikes", "position": _cpos(50, 6)},
		{"id": "l4_spikes_03", "type": "spikes", "position": _cpos(52, 24)},
		{"id": "l4_spikes_04", "type": "spikes", "position": _cpos(38, 24)},
		{"id": "l4_spikes_05", "type": "spikes", "position": _cpos(45, 18)},
		{"id": "l4_spikes_06", "type": "spikes", "position": _cpos(40, 12)},
		{"id": "l4_spikes_07", "type": "spikes", "position": _cpos(59, 18)},
		{"id": "l4_spikes_08", "type": "spikes", "position": _cpos(73, 15)},
		{"id": "l4_spikes_09", "type": "spikes", "position": _cpos(93, 10)},
		{"id": "l4_spikes_10", "type": "spikes", "position": _cpos(38, 52)},
		{"id": "l4_spikes_11", "type": "spikes", "position": _cpos(53, 52)},
		{"id": "l4_spikes_12", "type": "spikes", "position": _cpos(66, 52)},
		{"id": "l4_spikes_13", "type": "spikes", "position": _cpos(86, 44)},
		{"id": "l4_spikes_14", "type": "spikes", "position": _cpos(98, 44)},
		{"id": "l4_spikes_15", "type": "spikes", "position": _cpos(92, 59)},
		{"id": "l4_spikes_16", "type": "spikes", "position": _cpos(84, 50)},
		{"id": "l4_spikes_17", "type": "spikes", "position": _cpos(40, 88)},
		{"id": "l4_spikes_18", "type": "spikes", "position": _cpos(56, 82)},
		{"id": "l4_spikes_19", "type": "spikes", "position": _cpos(56, 94)},
		{"id": "l4_spikes_20", "type": "spikes", "position": _cpos(71, 88)},
		{"id": "l4_spikes_21", "type": "spikes", "position": _cpos(95, 81)},

		# Torches (24)
		{"id": "l4_torch_01", "type": "torch", "position": _cpos(9, 14)},
		{"id": "l4_torch_02", "type": "torch", "position": _cpos(25, 14)},
		{"id": "l4_torch_03", "type": "torch", "position": _cpos(52, 13)},
		{"id": "l4_torch_04", "type": "torch", "position": _cpos(82, 11)},
		{"id": "l4_torch_05", "type": "torch", "position": _cpos(15, 52)},
		{"id": "l4_torch_06", "type": "torch", "position": _cpos(33, 47)},
		{"id": "l4_torch_07", "type": "torch", "position": _cpos(56, 47)},
		{"id": "l4_torch_08", "type": "torch", "position": _cpos(71, 44)},
		{"id": "l4_torch_09", "type": "torch", "position": _cpos(95, 53)},
		{"id": "l4_torch_10", "type": "torch", "position": _cpos(15, 88)},
		{"id": "l4_torch_11", "type": "torch", "position": _cpos(49, 88)},
		{"id": "l4_torch_12", "type": "torch", "position": _cpos(91, 88)},
		{"id": "l4_torch_13", "type": "torch", "position": _cpos(25, 6)},
		{"id": "l4_torch_14", "type": "torch", "position": _cpos(63, 6)},
		{"id": "l4_torch_15", "type": "torch", "position": _cpos(63, 24)},
		{"id": "l4_torch_16", "type": "torch", "position": _cpos(34, 18)},
		{"id": "l4_torch_17", "type": "torch", "position": _cpos(100, 11)},
		{"id": "l4_torch_18", "type": "torch", "position": _cpos(107, 44)},
		{"id": "l4_torch_19", "type": "torch", "position": _cpos(107, 59)},
		{"id": "l4_torch_20", "type": "torch", "position": _cpos(80, 59)},
		{"id": "l4_torch_21", "type": "torch", "position": _cpos(65, 88)},
		{"id": "l4_torch_22", "type": "torch", "position": _cpos(79, 88)},
		{"id": "l4_torch_23", "type": "torch", "position": _cpos(106, 81)},
		{"id": "l4_torch_24", "type": "torch", "position": _cpos(106, 95)},

		# Coins (20)
		{"id": "l4_coin_01", "type": "coin", "position": _cpos(20, 14)},
		{"id": "l4_coin_02", "type": "coin", "position": _cpos(25, 9)},
		{"id": "l4_coin_03", "type": "coin", "position": _cpos(43, 6)},
		{"id": "l4_coin_04", "type": "coin", "position": _cpos(58, 6)},
		{"id": "l4_coin_05", "type": "coin", "position": _cpos(63, 14)},
		{"id": "l4_coin_06", "type": "coin", "position": _cpos(24, 52)},
		{"id": "l4_coin_07", "type": "coin", "position": _cpos(64, 52)},
		{"id": "l4_coin_08", "type": "coin", "position": _cpos(71, 48)},
		{"id": "l4_coin_09", "type": "coin", "position": _cpos(24, 88)},
		{"id": "l4_coin_10", "type": "coin", "position": _cpos(31, 88)},
		{"id": "l4_coin_11", "type": "coin", "position": _cpos(85, 88)},
		{"id": "l4_coin_12", "type": "coin", "position": _cpos(91, 83)},
		{"id": "l4_coin_13", "type": "coin", "position": _cpos(25, 20)},
		{"id": "l4_coin_14", "type": "coin", "position": _cpos(45, 24)},
		{"id": "l4_coin_15", "type": "coin", "position": _cpos(50, 18)},
		{"id": "l4_coin_16", "type": "coin", "position": _cpos(80, 44)},
		{"id": "l4_coin_17", "type": "coin", "position": _cpos(107, 52)},
		{"id": "l4_coin_18", "type": "coin", "position": _cpos(84, 59)},
		{"id": "l4_coin_19", "type": "coin", "position": _cpos(101, 81)},
		{"id": "l4_coin_20", "type": "coin", "position": _cpos(106, 88)},
	]

	var metadata := {
		"objective": "Ngắm tâm thánh tích từ vòng ngoài, vượt nhịp bẫy xoắn ốc và thu đủ 4 ấn ký.",
		"difficulty_tier": 4,
		"pacing": "four_six_member_packs_per_floor_through_dense_trap_fields",
		"roster_id": "chapter_1_level_4_roster",
		"encounter_pack_model": {
			"enabled": true,
			"profile_stage": 4,
			"floor_count": 3,
			"placement": "authored_camp_anchors",
			"authored_counts_are_anchors": true,
		},
		"required_sigils": 4,
		"camera_bounds": [0, 0, WIDTH * TILE, HEIGHT * TILE],
		"layout_profile": "three_floor_spiral_pressure",
		"tileset": "0x72 DungeonTileset II v1.7 (CC0)",
		"rooms": [
			{"id": "l4_f1_entry", "floor": 1, "role": "safe_entry", "rect": [5, 10, 14, 9]},
			{"id": "l4_f1_spiral", "floor": 1, "role": "trap_route", "rect": [23, 4, 43, 23]},
			{"id": "l4_f1_camp", "floor": 1, "role": "combat_camp", "rect": [80, 7, 27, 16]},
			{"id": "l4_f2_landing", "floor": 2, "role": "safe_landing", "rect": [6, 48, 14, 9]},
			{"id": "l4_f2_camp", "floor": 2, "role": "combat_camp", "rect": [29, 43, 33, 19]},
			{"id": "l4_f2_relay_ring", "floor": 2, "role": "trap_route", "rect": [69, 42, 41, 20]},
			{"id": "l4_f3_landing", "floor": 3, "role": "safe_landing", "rect": [6, 84, 14, 9]},
			{"id": "l4_f3_camp", "floor": 3, "role": "combat_camp", "rect": [33, 78, 49, 20]},
			{"id": "l4_f3_exit", "floor": 3, "role": "exit", "rect": [88, 79, 23, 18]},
		],
		"combat_camps": [
			{
				"id": "l4_camp_1_spiral_release",
				"floor": 1,
				"rect": [80, 7, 27, 16],
				"entry_cell": [80, 15],
				"enemy_ids": [
					"l4_c1_skeleton_01", "l4_c1_skeleton_02",
					"l4_c1_skeleton_03", "l4_c1_skeleton_04",
					"l4_c1_reaper_01",
				],
				"formation": "four_swordsmen_release_one_reaper_after_the_trap_loop",
				"breather_after": true,
			},
			{
				"id": "l4_camp_2_elite_pin",
				"floor": 2,
				"rect": [29, 43, 33, 19],
				"entry_cell": [29, 52],
				"enemy_ids": [
					"l4_c2_skeleton_01", "l4_c2_skeleton_02", "l4_c2_skeleton_03",
					"l4_c2_reaper_01", "l4_c2_reaper_02",
				],
				"formation": "three_swordsmen_pin_while_two_reapers_crossfire",
				"breather_after": true,
			},
			{
				"id": "l4_camp_3_broken_cross",
				"floor": 3,
				"rect": [33, 78, 49, 20],
				"entry_cell": [33, 88],
				"enemy_ids": [
					"l4_c3_skeleton_01", "l4_c3_skeleton_02", "l4_c3_skeleton_03",
					"l4_c3_reaper_01", "l4_c3_reaper_02",
				],
				"formation": "three_swordsmen_split_two_reapers_own_the_diagonals",
				"breather_after": true,
			},
		],
		"safe_zones": [
			{"id": "l4_spawn_sanctuary", "rect": [5, 10, 14, 9], "purpose": "spawn_before_trap_read"},
			{"id": "l4_floor_2_breather", "rect": [6, 48, 14, 9], "purpose": "checkpoint_after_spiral"},
			{"id": "l4_floor_3_breather", "rect": [6, 84, 14, 9], "purpose": "checkpoint_before_final_camp"},
		],
		"special_zones": [
			{"id": "l4_full_spiral_commitment", "rect": [23, 4, 43, 23], "purpose": "sigil_forces_the_long_side_of_the_loop"},
		],
	}

	return {
		"version": 2,
		"name": "Thánh Tích Xoắn Ốc",
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


func _add_altar(x0: int, y0: int) -> void:
	_reliquary_altars.append([x0, y0])


func _stamp_altar(x0: int, y0: int) -> void:
	for dx: int in range(2):
		_set_solid(x0 + dx, y0, 0, 2, 3 if dx == 0 else 1)
		_set_solid(x0 + dx, y0 + 1, 0, 6, 6)
		_decor_cells[Vector2i(x0 + dx, y0)] = [0, 5 + dx, 5]


func _place_gold_banners(x0: int, y_face: int) -> void:
	_set_solid(x0, y_face, 0, 2, 3)
	_set_solid(x0 + 1, y_face, 0, 2, 3)


func _place_molten_brazier(x0: int, y_top: int) -> void:
	for dx: int in range(3):
		var tx := 4 + dx
		_set_solid(x0 + dx, y_top, 0, tx, 0)
		_set_solid(x0 + dx, y_top + 1, 0, tx, 1)
		_set_solid(x0 + dx, y_top + 2, 0, tx, 2)


func _place_spiral_steps(x: int, y: int) -> void:
	var p := Vector2i(x, y)
	if _floor_cells.has(p):
		_floor_cells[p] = [0, 5, 12]


func _set_solid(x: int, y: int, src: int, tx: int, ty: int) -> void:
	var p := Vector2i(x, y)
	_floor_cells.erase(p)
	_geom_cells[p] = [src, tx, ty]


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
