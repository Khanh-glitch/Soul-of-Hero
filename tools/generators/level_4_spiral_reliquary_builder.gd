class_name Level4SpiralReliquaryBuilder
extends RefCounted
## Deterministic architectural builder for Chapter 1 Level 4 ("Thánh Tích Xoắn Ốc").
## Concentric ritual procession & reliquary sanctums on a 116x100 canvas:
## - Coherent 0x72 multi-tile architectural masonry compiler (columns 1..3 outer shells,
##   columns 8..11 solid bastions/ walls, source-0 [1..3,0..1] north ashlar courses,
##   complete 3-part columns with [5,7] plinth bases — zero black slits or pillar teeth).
## - True 3-stage environmental progression:
##   1) Austere unadorned stone outer pilgrim coils (cold stone, zero banners, clear traps),
##   2) Consecrated intermediate arenas & recovery pockets (grounded pilasters, gutter warnings),
##   3) High-intensity inner sanctum hearts & final reliquary apse (aligned 3x3 molten fire
##      braziers, crimson & gold reliquary standards, recessed dark stairwell portals).

const TILE := 16
const WIDTH := 116
const HEIGHT := 100

var _floor_cells: Dictionary = {}
var _geom_cells: Dictionary = {}
var _decor_cells: Dictionary = {}
var _sanctum_piers: Array = []


func build() -> Dictionary:
	_floor_cells.clear()
	_geom_cells.clear()
	_decor_cells.clear()
	_sanctum_piers.clear()

	# =========================================================================
	# FLOOR 1 (y = 4..26, W -> E): AUSTERE PILGRIM VESTIBULE -> THREE-TURN
	# CONCENTRIC SPIRAL (STAGE I OUTER -> STAGE II COIL -> STAGE III HEART)
	# -> SPIRAL RELEASE CRUCIBLE (`l4_f1_camp`)
	# =========================================================================
	# Austere Pilgrim Threshold Vestibule (calm stone, unadorned walls)
	_carve_rect(7, 10, 12, 9)
	_carve_rect(19, 13, 4, 4)

	# GREAT CONCENTRIC SPIRAL (`x = 23..65, y = 4..26`):
	# Stage I — Outer Clockwise Pilgrim Ring (separated from Inner Coil by 5-col void chasm!)
	_carve_rect(23, 4, 4, 23)
	_carve_rect(23, 4, 43, 4)
	_carve_rect(23, 23, 43, 4)
	_carve_rect(62, 4, 4, 23)

	# Stage II — Intermediate Counter-Coil with recovery corners
	_carve_rect(32, 17, 30, 4)
	_carve_rect(32, 10, 5, 11)
	_carve_rect(32, 10, 25, 4)
	# Stage III — Central Consecrated Shrine Core (`l4_sigil_spiral` at (50, 13))
	_carve_rect(44, 10, 13, 5)

	# East Processional Bridge -> Spiral Release Crucible (`l4_f1_camp`)
	_carve_rect(66, 13, 14, 4)
	_carve_rect(80, 7, 27, 16)
	_uncarve_rect(80, 7, 3, 2)
	_uncarve_rect(80, 21, 3, 2)
	_uncarve_rect(104, 7, 3, 2)
	_uncarve_rect(104, 21, 3, 2)
	_uncarve_rect(91, 13, 5, 4)
	# Recessed East Descent Portal Alcove (`door_l4_f1_f2_down` at (109, 17))
	_carve_rect(106, 15, 6, 5)

	_processional_axis_h(8, 25, 14)
	_processional_axis_v(25, 6, 24)
	_processional_axis_h(25, 63, 6)
	_processional_axis_h(25, 63, 24)
	_processional_axis_v(63, 6, 24)
	_processional_axis_h(34, 62, 18)
	_processional_axis_v(34, 12, 18)
	_processional_axis_h(34, 54, 12)
	_processional_axis_h(66, 90, 15)
	_processional_axis_h(96, 110, 17)

	# Grounded twin-column reliquary piers (complete with capitals & [5,7] plinth bases)
	_add_sanctum_pier(15, 11)
	_add_sanctum_pier(15, 16)
	_add_sanctum_pier(49, 11)
	_add_sanctum_pier(85, 10)
	_add_sanctum_pier(85, 18)
	_add_sanctum_pier(99, 14)

	# =========================================================================
	# FLOOR 2 (y = 42..62, W -> E): RECOVERY LANDING -> OCTAGONAL PIN CRUCIBLE
	# -> THREE-RING BULLSEYE DESCENT SHRINE (`mid` SHOWCASE!)
	# =========================================================================
	_carve_rect(7, 48, 13, 9)
	_carve_rect(20, 50, 9, 5)

	# Octagonal Crossfire Pin Crucible (`l4_camp_2_elite_pin`)
	_carve_rect(29, 43, 33, 19)
	_uncarve_rect(29, 43, 4, 3)
	_uncarve_rect(29, 59, 4, 3)
	_uncarve_rect(58, 43, 4, 3)
	_uncarve_rect(58, 59, 4, 3)
	_uncarve_rect(42, 50, 7, 5)

	_carve_rect(62, 50, 7, 5)

	# THREE-RING BULLSEYE PINWHEEL SANCTUM (`l4_f2_relay_ring`: x = 69..110, y = 42..62)
	# Crisp 5-col black abyss channels on West (x = 73..77) & East (x = 101..105)
	_carve_rect(69, 42, 4, 20)
	_carve_rect(69, 42, 41, 4)
	_carve_rect(106, 42, 4, 20)
	_carve_rect(78, 58, 32, 4)
	_carve_rect(78, 48, 4, 14)
	_carve_rect(78, 48, 23, 3)
	_carve_rect(97, 48, 4, 9)
	# Central Bullseye Descent Court: solid north portal wall at y = 51..52 so
	# `door_l4_f2_f3_down` at (91, 54) enters a real carved dark stairwell arch!
	_carve_rect(85, 53, 16, 4)

	_processional_axis_h(8, 41, 52)
	_processional_axis_h(33, 57, 45)
	_processional_axis_h(33, 57, 59)
	_processional_axis_h(50, 71, 52)
	_processional_axis_v(71, 44, 59)
	_processional_axis_h(71, 107, 44)
	_processional_axis_v(107, 44, 59)
	_processional_axis_h(80, 107, 59)
	_processional_axis_v(80, 49, 59)
	_processional_axis_h(80, 99, 49)
	_processional_axis_h(86, 99, 54)

	_add_sanctum_pier(35, 48)
	_add_sanctum_pier(35, 55)
	_add_sanctum_pier(53, 48)
	_add_sanctum_pier(53, 55)

	# =========================================================================
	# FLOOR 3 (y = 78..97, W -> E): RECOVERY LANDING -> BROKEN-CROSS RADIAL
	# CLIMAX -> CONSECRATED FINAL RELIQUARY APSE (`end` SHOWCASE!)
	# =========================================================================
	_carve_rect(7, 84, 13, 9)
	_carve_rect(20, 86, 13, 5)

	# Broken-Cross Radial Climax Crucible (`l4_camp_3_broken_cross`)
	_carve_rect(33, 78, 49, 20)
	_uncarve_rect(33, 78, 4, 3)
	_uncarve_rect(33, 95, 4, 3)
	_uncarve_rect(43, 82, 8, 3)
	_uncarve_rect(61, 82, 8, 3)
	_uncarve_rect(43, 92, 8, 3)
	_uncarve_rect(61, 92, 8, 3)

	# Processional Half-Spiral Apse (`l4_f3_exit`: center (99, 88) open & clear!)
	# Recessed North Apse Niche at x = 101..107, y = 79..80 so `l4_exit` at (104, 81)
	# mounts its stone arch directly into load-bearing north apse wall y = 78!
	_carve_rect(82, 86, 6, 5)
	_carve_rect(88, 81, 23, 15)
	_carve_rect(101, 79, 7, 2)
	_uncarve_rect(88, 94, 3, 2)
	_uncarve_rect(108, 94, 3, 2)
	# Crisp 2-row solid reliquary choir screen walls creating a processional approach
	# while keeping center (99, 88) wide open!
	_uncarve_rect(93, 84, 6, 2)
	_uncarve_rect(93, 91, 6, 2)

	_processional_axis_h(8, 87, 88)
	_processional_axis_v(56, 80, 96)
	_processional_axis_h(39, 77, 80)
	_processional_axis_h(39, 77, 96)
	_processional_axis_h(88, 105, 88)
	_processional_axis_v(104, 80, 88)

	_add_sanctum_pier(55, 87)
	_add_sanctum_pier(74, 87)

	# =========================================================================
	# COMPILE COHERENT LOAD-BEARING MASONRY + GROUNDED SANCTUM PIERS
	# =========================================================================
	_compile_masonry()

	for pier: Array in _sanctum_piers:
		_stamp_sanctum_pier(int(pier[0]), int(pier[1]))

	# =========================================================================
	# PROGRESSIVE 3-STAGE RITUAL ARCHITECTURE (OUTER COLD -> INNER MOLTEN!)
	# =========================================================================
	# Stage I (Outer Coils): ZERO banners, ZERO molten braziers — pure austere stone!
	# Stage II & III (Inner Sanctum Hearts ONLY): Properly aligned 3x3 Molten Braziers
	# strictly on exterior north walls (cornice y-2, spout y-1, glowing curb on y — 0 void clip!)
	_place_molten_brazier(48, 4)
	_place_molten_brazier(92, 7)
	_place_molten_brazier(44, 43)
	_place_molten_brazier(55, 78)
	_place_molten_brazier(95, 81)
	_place_molten_brazier(108, 81)

	# Recessed Dark Stone Stairwell Portals directly behind all 4 FloorDoors!
	_place_stairwell_portal(108, 15, false)
	_place_stairwell_portal(8, 48, false)
	_place_stairwell_portal(90, 53, true)
	_place_stairwell_portal(8, 84, false)

	# Consecrated North Apse Portal framing `l4_exit` at (104, 81)
	_frame_exit_apse(104, 81)

	# Sacred Crimson [1, 2] & Gold [2, 3] Standards ONLY at Sanctum Hearts & Climax Apse
	# (Down 78% from 56 repeated yellow banner tiles -> zero motif repetition around turns!)
	_set_solid(46, 9, 0, 1, 2)
	_set_solid(50, 9, 0, 2, 3)
	_set_solid(54, 9, 0, 1, 2)
	_set_solid(89, 6, 0, 1, 2)
	_set_solid(96, 6, 0, 1, 2)
	_set_solid(41, 42, 0, 1, 2)
	_set_solid(49, 42, 0, 1, 2)
	_set_solid(88, 52, 0, 2, 3)
	_set_solid(95, 52, 0, 2, 3)
	_set_solid(52, 77, 0, 1, 2)
	_set_solid(60, 77, 0, 1, 2)
	_set_solid(102, 78, 0, 2, 3)
	_set_solid(106, 78, 0, 2, 3)

	# Sparse ritual relics strictly in inner shrines & treasure pockets
	var curated_decor := [
		[17, 11, 0, 5, 13], [32, 25, 0, 21, 22], [55, 13, 0, 21, 21],
		[17, 49, 0, 5, 13], [56, 60, 0, 21, 22], [98, 54, 0, 21, 21],
		[17, 85, 0, 5, 13], [78, 79, 0, 21, 22],
		[102, 80, 0, 21, 21], [106, 80, 0, 21, 21],
	]
	for d: Array in curated_decor:
		var dp := Vector2i(int(d[0]), int(d[1]))
		if _floor_cells.has(dp) and not _decor_cells.has(dp):
			_decor_cells[dp] = [int(d[2]), int(d[3]), int(d[4])]

	# =========================================================================
	# ALL 74 ORIGINAL ENTITY IDS PRESERVED 100% + DISCIPLINED LIGHTING (76 TOTAL)
	# =========================================================================
	var spikes_coords := [
		Vector2i(36, 6), Vector2i(50, 6), Vector2i(52, 24), Vector2i(38, 24),
		Vector2i(45, 18), Vector2i(40, 12), Vector2i(59, 18), Vector2i(73, 15),
		Vector2i(93, 10),
		Vector2i(39, 52), Vector2i(52, 52), Vector2i(65, 52),
		Vector2i(86, 44), Vector2i(98, 44), Vector2i(92, 59), Vector2i(80, 53),
		Vector2i(40, 88), Vector2i(56, 82), Vector2i(56, 94), Vector2i(71, 88),
		Vector2i(90, 88),
	]

	# Fore-telegraphed iron channel grates aligned cleanly to each spike gate's axis
	for sc: Vector2i in spikes_coords:
		for dir: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT]:
			var gp := sc + dir
			if _floor_cells.has(gp):
				_floor_cells[gp] = [0, 1 if dir.x < 0 else 2, 12]

	var entities: Array = [
		{"id": "player_spawn", "type": "player", "position": _cpos(11, 14)},

		# Camp 1 (`l4_camp_1_spiral_release`: 4 Skeletons + 1 Reaper around central bastion)
		{"id": "l4_c1_skeleton_01", "type": "skeleton", "position": _cpos(83, 15), "patrol": 32},
		{"id": "l4_c1_skeleton_02", "type": "skeleton", "position": _cpos(89, 10), "patrol": 32},
		{"id": "l4_c1_skeleton_03", "type": "skeleton", "position": _cpos(89, 20), "patrol": 32},
		{"id": "l4_c1_skeleton_04", "type": "skeleton", "position": _cpos(98, 19), "patrol": 32},
		{"id": "l4_c1_reaper_01", "type": "skeleton_reaper", "position": _cpos(102, 12), "patrol": 28},

		# Camp 2 (`l4_camp_2_elite_pin`: 3 Skeletons + 2 Cross-Firing Reapers)
		{"id": "l4_c2_skeleton_01", "type": "skeleton", "position": _cpos(33, 52), "patrol": 32},
		{"id": "l4_c2_skeleton_02", "type": "skeleton", "position": _cpos(46, 46), "patrol": 32},
		{"id": "l4_c2_skeleton_03", "type": "skeleton", "position": _cpos(46, 58), "patrol": 32},
		{"id": "l4_c2_reaper_01", "type": "skeleton_reaper", "position": _cpos(40, 46), "patrol": 28},
		{"id": "l4_c2_reaper_02", "type": "skeleton_reaper", "position": _cpos(57, 52), "patrol": 28},

		# Camp 3 (`l4_camp_3_broken_cross`: 3 Skeletons + 2 Diagonal Reapers)
		{"id": "l4_c3_skeleton_01", "type": "skeleton", "position": _cpos(46, 88), "patrol": 32},
		{"id": "l4_c3_skeleton_02", "type": "skeleton", "position": _cpos(55, 84), "patrol": 32},
		{"id": "l4_c3_skeleton_03", "type": "skeleton", "position": _cpos(75, 82), "patrol": 32},
		{"id": "l4_c3_reaper_01", "type": "skeleton_reaper", "position": _cpos(76, 94), "patrol": 26},
		{"id": "l4_c3_reaper_02", "type": "skeleton_reaper", "position": _cpos(63, 80), "patrol": 26},

		# 4 Reciprocal Sanctum Stairwell Portals (`door_l4_f2_f3_down` at Bullseye Portal (91, 54)!)
		{
			"id": "door_l4_f1_f2_down",
			"type": "floor_door",
			"position": _cpos(109, 16),
			"target_position": _cpos(9, 49),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l4_f1_f2_up",
			"type": "floor_door",
			"position": _cpos(9, 49),
			"target_position": _cpos(109, 16),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{
			"id": "door_l4_f2_f3_down",
			"type": "floor_door",
			"position": _cpos(91, 54),
			"target_position": _cpos(9, 85),
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l4_f2_f3_up",
			"type": "floor_door",
			"position": _cpos(9, 85),
			"target_position": _cpos(91, 54),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},

		# 4/4 Required Sigils
		{"id": "l4_sigil_spiral", "type": "sigil", "position": _cpos(51, 13)},
		{"id": "l4_sigil_camp_1", "type": "sigil", "position": _cpos(104, 15)},
		{"id": "l4_sigil_camp_2", "type": "sigil", "position": _cpos(55, 59)},
		{"id": "l4_sigil_camp_3", "type": "sigil", "position": _cpos(80, 88)},

		# Checkpoints (2) & Recessed Consecrated Apse Exit Gate (1)
		{"id": "l4_checkpoint_floor_2", "type": "checkpoint", "position": _cpos(16, 52)},
		{"id": "l4_checkpoint_floor_3", "type": "checkpoint", "position": _cpos(16, 88)},
		{"id": "l4_exit", "type": "exit_gate", "position": _cpos(104, 81)},

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
		{"id": "l4_spikes_10", "type": "spikes", "position": _cpos(39, 52)},
		{"id": "l4_spikes_11", "type": "spikes", "position": _cpos(52, 52)},
		{"id": "l4_spikes_12", "type": "spikes", "position": _cpos(65, 52)},
		{"id": "l4_spikes_13", "type": "spikes", "position": _cpos(86, 44)},
		{"id": "l4_spikes_14", "type": "spikes", "position": _cpos(98, 44)},
		{"id": "l4_spikes_15", "type": "spikes", "position": _cpos(92, 59)},
		{"id": "l4_spikes_16", "type": "spikes", "position": _cpos(80, 53)},
		{"id": "l4_spikes_17", "type": "spikes", "position": _cpos(40, 88)},
		{"id": "l4_spikes_18", "type": "spikes", "position": _cpos(56, 82)},
		{"id": "l4_spikes_19", "type": "spikes", "position": _cpos(56, 94)},
		{"id": "l4_spikes_20", "type": "spikes", "position": _cpos(71, 88)},
		{"id": "l4_spikes_21", "type": "spikes", "position": _cpos(90, 88)},

		# 14 Progressive Ritual Beacons (down 42% from 24: dark austere outer coils
		# intensifying into warm golden pools strictly at inner sanctums!)
		{"id": "l4_torch_01", "type": "torch", "position": _cpos(22, 14)},
		{"id": "l4_torch_02", "type": "torch", "position": _cpos(53, 13)},
		{"id": "l4_torch_03", "type": "torch", "position": _cpos(82, 11)},
		{"id": "l4_torch_04", "type": "torch", "position": _cpos(100, 11)},
		{"id": "l4_torch_05", "type": "torch", "position": _cpos(14, 52)},
		{"id": "l4_torch_06", "type": "torch", "position": _cpos(39, 48)},
		{"id": "l4_torch_07", "type": "torch", "position": _cpos(51, 56)},
		{"id": "l4_torch_08", "type": "torch", "position": _cpos(87, 54)},
		{"id": "l4_torch_09", "type": "torch", "position": _cpos(95, 54)},
		{"id": "l4_torch_10", "type": "torch", "position": _cpos(14, 88)},
		{"id": "l4_torch_11", "type": "torch", "position": _cpos(49, 88)},
		{"id": "l4_torch_12", "type": "torch", "position": _cpos(79, 88)},
		{"id": "l4_torch_13", "type": "torch", "position": _cpos(100, 82)},
		{"id": "l4_torch_14", "type": "torch", "position": _cpos(108, 82)},

		# 12 Original Coins
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
		{"id": "l4_coin_12", "type": "coin", "position": _cpos(104, 86)},
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
			{"id": "l4_f1_entry", "floor": 1, "role": "safe_entry", "rect": [7, 10, 12, 9]},
			{"id": "l4_f1_spiral", "floor": 1, "role": "trap_route", "rect": [23, 4, 43, 23]},
			{"id": "l4_f1_camp", "floor": 1, "role": "combat_camp", "rect": [80, 7, 27, 16]},
			{"id": "l4_f2_landing", "floor": 2, "role": "safe_landing", "rect": [7, 48, 13, 9]},
			{"id": "l4_f2_camp", "floor": 2, "role": "combat_camp", "rect": [29, 43, 33, 19]},
			{"id": "l4_f2_relay_ring", "floor": 2, "role": "trap_route", "rect": [69, 46, 41, 16]},
			{"id": "l4_f3_landing", "floor": 3, "role": "safe_landing", "rect": [7, 84, 13, 9]},
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
			{"id": "l4_spawn_sanctuary", "rect": [7, 10, 12, 9], "purpose": "spawn_before_trap_read"},
			{"id": "l4_floor_2_breather", "rect": [7, 48, 13, 9], "purpose": "checkpoint_after_spiral"},
			{"id": "l4_floor_3_breather", "rect": [7, 84, 13, 9], "purpose": "checkpoint_before_final_camp"},
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


func _carve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			if x >= 2 and x < WIDTH - 2 and y >= 2 and y < HEIGHT - 2:
				var p := Vector2i(x, y)
				# Austere monolithic stone floor (~93% [1,4], subtle hairline wear only)
				var tile := Vector2i(1, 4)
				if posmod(x * 23 + y * 41, 19) == 0:
					tile = Vector2i(2, 4)
				elif posmod(x * 31 + y * 17, 29) == 0:
					tile = Vector2i(3, 4)
				_floor_cells[p] = [0, tile.x, tile.y]
				_geom_cells.erase(p)


func _uncarve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			_floor_cells.erase(Vector2i(x, y))


func _processional_axis_h(x0: int, x1: int, y: int) -> void:
	for x: int in range(x0, x1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 1, 4]


func _processional_axis_v(x: int, y0: int, y1: int) -> void:
	for y: int in range(y0, y1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 1, 4]


func _compile_masonry() -> void:
	var shell: Dictionary = {}
	for y: int in range(HEIGHT):
		for x: int in range(WIDTH):
			var p := Vector2i(x, y)
			if _floor_cells.has(p):
				continue
			var near := false
			for dy: int in range(-1, 2):
				for dx: int in range(-1, 2):
					if _floor_cells.has(Vector2i(x + dx, y + dy)):
						near = true
						break
				if near:
					break
			var north_cap := _floor_cells.has(Vector2i(x, y + 2)) and not _floor_cells.has(Vector2i(x, y + 1))
			if near or north_cap:
				shell[p] = true

	for p: Vector2i in shell.keys():
		var x := p.x
		var y := p.y
		var fn := _floor_cells.has(Vector2i(x, y - 1))
		var fs := _floor_cells.has(Vector2i(x, y + 1))
		var fe := _floor_cells.has(Vector2i(x + 1, y))
		var fw := _floor_cells.has(Vector2i(x - 1, y))
		var sn := shell.has(Vector2i(x, y - 1))
		var ss := shell.has(Vector2i(x, y + 1))
		var se := shell.has(Vector2i(x + 1, y))
		var sw := shell.has(Vector2i(x - 1, y))

		if fs:
			_geom_cells[p] = [0, 1 + posmod(x * 3 + y * 5, 3), 1]
		elif fn:
			if ss:
				if fw and not sw:
					_geom_cells[p] = [1, 8, 0]
				elif fe and not se:
					_geom_cells[p] = [1, 11, 0]
				else:
					_geom_cells[p] = [1, 10, 0]
			else:
				if fw and not sw:
					_geom_cells[p] = [1, 1, 2]
				elif fe and not se:
					_geom_cells[p] = [1, 3, 2]
				else:
					_geom_cells[p] = [1, 2, 2]
		elif _floor_cells.has(Vector2i(x, y + 2)):
			_geom_cells[p] = [0, 1 + posmod(x * 3 + y, 3), 0]
		elif fe and fw:
			_geom_cells[p] = [1, 0, 1]
		elif fe:
			if sw:
				_geom_cells[p] = [1, 4, 3]
			elif _floor_cells.has(Vector2i(x + 1, y + 1)) and not sn:
				_geom_cells[p] = [1, 1, 0]
			else:
				_geom_cells[p] = [1, 1, 1]
		elif fw:
			if se:
				_geom_cells[p] = [1, 7, 3]
			elif _floor_cells.has(Vector2i(x - 1, y + 1)) and not sn:
				_geom_cells[p] = [1, 3, 0]
			else:
				_geom_cells[p] = [1, 3, 1]
		elif _floor_cells.has(Vector2i(x + 1, y + 1)):
			_geom_cells[p] = [1, 5, 1] if (sw or sn) else [1, 1, 0]
		elif _floor_cells.has(Vector2i(x - 1, y + 1)):
			_geom_cells[p] = [1, 6, 1] if (se or sn) else [1, 3, 0]
		elif _floor_cells.has(Vector2i(x + 1, y - 1)):
			_geom_cells[p] = [1, 5, 2] if (sw or ss) else [1, 1, 2]
		elif _floor_cells.has(Vector2i(x - 1, y - 1)):
			_geom_cells[p] = [1, 6, 2] if (se or ss) else [1, 3, 2]
		else:
			_geom_cells[p] = [1, 9, 2]


func _add_sanctum_pier(x0: int, y0: int) -> void:
	_sanctum_piers.append([x0, y0])


func _stamp_sanctum_pier(x0: int, y0: int) -> void:
	# Complete 3-row architectural column pair: capital + shaft + carved plinth base on floor!
	for dx: int in range(2):
		var px := x0 + dx
		_set_solid(px, y0, 1, 10, 0)
		_set_solid(px, y0 + 1, 0, 6, 6)
		_decor_cells[Vector2i(px, y0)] = [0, 5 + dx, 5]
		var base_p := Vector2i(px, y0 + 2)
		if _floor_cells.has(base_p):
			_decor_cells[base_p] = [0, 5, 7]


func _place_molten_brazier(x0: int, y_floor: int) -> void:
	# Complete 3x3 molten fire basin aligned flush on cornice (y-2), wall (y-1), floor (y)!
	for dx: int in range(3):
		var tx := 4 + dx
		_set_solid(x0 + dx, y_floor - 2, 0, tx, 0)
		_set_solid(x0 + dx, y_floor - 1, 0, tx, 1)
		var fp := Vector2i(x0 + dx, y_floor)
		if _floor_cells.has(fp):
			_floor_cells[fp] = [0, tx, 2]


func _place_stairwell_portal(x0: int, y_top_floor: int, embedded_in_mass: bool) -> void:
	if embedded_in_mass:
		# Embedded inside an interior sanctum wall with floor above: keep 100%-opaque
		# parapet roof above and frame a carved 2-wide dark stone portal mouth below!
		_set_solid(x0, y_top_floor - 1, 0, 5, 6)
		_set_solid(x0 + 1, y_top_floor - 1, 0, 5, 16)
		_set_solid(x0 + 2, y_top_floor - 1, 0, 6, 16)
		_set_solid(x0 + 3, y_top_floor - 1, 0, 5, 6)
		for px: int in [x0, x0 + 3]:
			var bp := Vector2i(px, y_top_floor)
			if _floor_cells.has(bp):
				_decor_cells[bp] = [0, 5, 7]
	else:
		_set_solid(x0 + 1, y_top_floor - 3, 0, 2, 14)
		_set_solid(x0 + 2, y_top_floor - 3, 0, 3, 14)
		_set_solid(x0, y_top_floor - 2, 0, 1, 15)
		_set_solid(x0 + 1, y_top_floor - 2, 0, 5, 15)
		_set_solid(x0 + 2, y_top_floor - 2, 0, 6, 15)
		_set_solid(x0 + 3, y_top_floor - 2, 0, 4, 15)
		_set_solid(x0, y_top_floor - 1, 0, 1, 16)
		_set_solid(x0 + 1, y_top_floor - 1, 0, 5, 16)
		_set_solid(x0 + 2, y_top_floor - 1, 0, 6, 16)
		_set_solid(x0 + 3, y_top_floor - 1, 0, 4, 16)
	for dx: int in range(1, 3):
		var sp := Vector2i(x0 + dx, y_top_floor)
		if _floor_cells.has(sp):
			_floor_cells[sp] = [0, 5, 12]


func _frame_exit_apse(exit_x: int, exit_y: int) -> void:
	for px: int in [exit_x - 4, exit_x + 4]:
		_set_solid(px, exit_y - 3, 0, 5, 5)
		_set_solid(px, exit_y - 2, 0, 5, 6)
		var bp := Vector2i(px, exit_y - 1)
		if _floor_cells.has(bp):
			_decor_cells[bp] = [0, 5, 7]
	for dx: int in range(-1, 2):
		var tp := Vector2i(exit_x + dx, exit_y - 2)
		if _floor_cells.has(tp):
			_floor_cells[tp] = [0, 5, 12]
		var tp2 := Vector2i(exit_x + dx, exit_y - 1)
		if _floor_cells.has(tp2):
			_floor_cells[tp2] = [0, 5, 12]


func _set_solid(x: int, y: int, src: int, tx: int, ty: int) -> void:
	var p := Vector2i(x, y)
	_floor_cells.erase(p)
	_decor_cells.erase(p)
	_geom_cells[p] = [src, tx, ty]


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
