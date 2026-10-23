class_name Level3CrossfireArchiveBuilder
extends RefCounted
## Deterministic architectural builder for Chapter 1 Level 3 ("Thư Khố Giao Hỏa").
## Sculpted Subterranean Scriptorium & Crossfire Archive on a 116x96 canvas with
## zero inter-floor camera bleed (>=12-tile void separation between tiers),
## asymmetric switchback flow (NW->SE on Floor 1, E->W on Floor 2, W->E on
## Floor 3), deep open chasm abyss bridges, physical Layer-1 Reaper boomerang
## cover stacks, and two secret vault sigil routes (5 placed / 4 required).

const TILE := 16
const WIDTH := 116
const HEIGHT := 96

const FLOOR_PALETTE := [
	Vector2i(1, 4), Vector2i(2, 4), Vector2i(3, 4), Vector2i(1, 4),
	Vector2i(2, 5), Vector2i(1, 5), Vector2i(3, 5), Vector2i(2, 4),
	Vector2i(1, 6), Vector2i(2, 6), Vector2i(1, 4), Vector2i(3, 4),
]

var _floor_cells: Dictionary = {}
var _geom_cells: Dictionary = {}
var _decor_cells: Dictionary = {}
var _book_stacks: Array = []
var _lectern_piers: Array = []


func build() -> Dictionary:
	_floor_cells.clear()
	_geom_cells.clear()
	_decor_cells.clear()
	_book_stacks.clear()
	_lectern_piers.clear()

	# =========================================================================
	# FLOOR 1 (y = 2..25, NW VESTIBULE -> DIAGONAL ABYSS BRIDGES -> SE CAMP 1)
	# Max walkable y = 25; Floor 2 highest geometry = 37 (gap = 12 tiles -> 0 bleed!)
	# =========================================================================
	_carve_rect(6, 4, 13, 9)
	_carve_rect(4, 6, 3, 5)
	_carve_rect(19, 7, 9, 4)
	_carve_rect(25, 8, 7, 4)

	# North Scriptorium Cloister (holds mandatory scout anchor at (60, 10)!)
	_carve_rect(31, 8, 35, 4)
	# Secret North Forbidden Folio Vault (l3_f1_hidden_cache — Optional Sigil #1)
	_carve_rect(46, 5, 5, 4)
	_carve_rect(43, 2, 12, 4)
	# Twin staggered stone bridges across TRUE 7-tile Open Chasm Abyss (y = 12..18)!
	_carve_rect(35, 12, 5, 8)
	_carve_rect(56, 12, 5, 8)
	# South Scholar's Gallery + Exposed Line-of-Fire Treasure Pocket (320 pts)
	_carve_rect(33, 20, 34, 4)
	_carve_rect(46, 23, 9, 3)

	# East Convergence Terrace -> Twin-Perch Reading Hall (l3_f1_camp)
	_carve_rect(66, 9, 8, 13)
	_uncarve_rect(69, 13, 3, 5)
	_carve_rect(74, 15, 8, 4)

	_carve_rect(82, 10, 24, 14)
	_uncarve_rect(82, 10, 4, 2)
	_uncarve_rect(82, 22, 4, 2)
	_uncarve_rect(103, 10, 3, 2)
	_uncarve_rect(103, 22, 3, 2)
	_carve_rect(106, 15, 6, 5)

	_runner_h(6, 27, 8)
	_runner_h(28, 66, 10)
	_runner_v(48, 3, 10)
	_runner_v(37, 10, 21)
	_runner_v(58, 10, 21)
	_runner_h(34, 66, 21)
	_runner_h(74, 110, 17)

	_add_book_stack(11, 5, 2, true)
	_add_book_stack(11, 10, 2, false)
	_add_book_stack(43, 9, 2, true)
	_add_book_stack(51, 20, 2, false)
	_add_book_stack(88, 12, 3, true)
	_add_book_stack(88, 20, 3, false)
	_add_lectern_pier(95, 16)

	# =========================================================================
	# FLOOR 2 (y = 39..62, REVERSE EAST -> WEST HERRINGBONE ARCHIVE & PINCER VAULT)
	# Highest geometry = 37 (gap 12 from F1 y=25); max walkable = 62 (gap 12 to F3 y=74!)
	# =========================================================================
	_carve_rect(95, 41, 14, 9)
	_carve_rect(81, 44, 14, 4)

	_carve_rect(73, 42, 9, 11)
	_carve_rect(47, 39, 27, 5)
	_carve_rect(47, 50, 27, 5)
	_carve_rect(59, 44, 5, 6)
	_carve_rect(66, 55, 9, 5)
	# South Secret Reliquary Annex (`l3_f2_hidden_reliquary` — Optional Sigil #3 right in `mid`!)
	_carve_rect(53, 55, 5, 4)
	_carve_rect(49, 58, 13, 5)

	# West Asymmetric Pincer Reading Vault (`l3_f2_camp`)
	_carve_rect(17, 39, 31, 5)
	_carve_rect(16, 46, 32, 13)
	_uncarve_rect(16, 57, 4, 2)
	_uncarve_rect(44, 57, 4, 2)
	_carve_rect(44, 44, 4, 3)
	_carve_rect(18, 44, 4, 3)
	_carve_rect(7, 50, 9, 5)

	_runner_h(75, 106, 46)
	_runner_h(45, 74, 41)
	_runner_h(45, 74, 52)
	_runner_v(61, 41, 52)
	_runner_v(55, 53, 61)
	_runner_h(19, 47, 41)
	_runner_h(9, 47, 52)

	_add_book_stack(102, 43, 2, false)
	_add_book_stack(76, 46, 2, true)
	_add_book_stack(54, 40, 2, false)
	_add_book_stack(67, 51, 2, true)
	_add_book_stack(37, 49, 3, true)
	_add_book_stack(27, 54, 3, false)
	_add_lectern_pier(31, 48)

	# =========================================================================
	# FLOOR 3 (y = 75..93, SW LANDING -> SPLIT-BASTION ARCHIVE SPINE -> SEAL VAULT)
	# Highest geometry = 74 (12-tile clear gap below F2 max y = 62 -> 0 bleed!)
	# =========================================================================
	_carve_rect(7, 79, 14, 9)
	_carve_rect(21, 82, 13, 4)

	_carve_rect(34, 77, 6, 15)
	_carve_rect(39, 75, 36, 6)
	_carve_rect(39, 88, 36, 6)
	_carve_rect(55, 81, 5, 7)
	_carve_rect(73, 77, 12, 15)

	_carve_rect(85, 82, 8, 5)
	_carve_rect(93, 77, 17, 14)
	_uncarve_rect(93, 77, 3, 2)
	_uncarve_rect(93, 89, 3, 2)
	_uncarve_rect(107, 77, 3, 2)
	_uncarve_rect(107, 89, 3, 2)

	_runner_h(9, 38, 84)
	_runner_h(37, 79, 78)
	_runner_h(37, 79, 90)
	_runner_v(57, 78, 90)
	_runner_h(79, 107, 84)

	_add_book_stack(11, 81, 2, true)
	_add_book_stack(46, 76, 2, false)
	_add_book_stack(64, 89, 2, true)
	_add_lectern_pier(75, 84)
	_add_book_stack(98, 80, 2, true)
	_add_book_stack(98, 88, 2, false)

	# =========================================================================
	# TIGHT 1-RING PARAPET + NORTH MASONRY SHELL (PRESERVES CRISP OPEN CHASMS!)
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

	for entry: Array in _book_stacks:
		_stamp_book_stack(int(entry[0]), int(entry[1]), int(entry[2]), bool(entry[3]))
	for entry: Array in _lectern_piers:
		_stamp_lectern_pier(int(entry[0]), int(entry[1]))

	# =========================================================================
	# EMERALD & AMBER SCRIPTORIUM SETPIECES (ZERO INTER-FLOOR CAMERA BLEED!)
	# =========================================================================
	_place_wall_banners(8, 3, true)
	_place_ink_fountain(13, 1)
	_place_wall_banners(21, 6, false)
	_place_wall_banners(34, 7, true)
	_place_vault_door(44, 4)
	_place_vault_door(52, 4)
	_place_ink_fountain(59, 5)
	_place_wall_banners(42, 19, false)
	_place_wall_banners(62, 19, true)
	_place_wall_banners(76, 14, false)
	_place_ink_fountain(92, 7)
	_place_wall_banners(88, 9, true)
	_place_wall_banners(98, 9, false)
	_place_wall_banners(108, 14, true)

	_place_wall_banners(97, 40, true)
	_place_ink_fountain(102, 38)
	_place_wall_banners(86, 43, false)
	_place_wall_banners(51, 38, true)
	_place_ink_fountain(59, 36)
	_place_wall_banners(68, 38, false)
	_place_wall_banners(51, 49, false)
	_place_wall_banners(68, 49, true)
	_place_vault_door(50, 57)
	_place_vault_door(59, 57)
	_place_wall_banners(23, 38, true)
	_place_ink_fountain(31, 36)
	_place_wall_banners(40, 38, false)
	_place_wall_banners(10, 49, true)

	_place_wall_banners(9, 78, false)
	_place_ink_fountain(14, 76)
	_place_wall_banners(26, 81, true)
	_place_wall_banners(43, 74, true)
	_place_ink_fountain(56, 72)
	_place_wall_banners(68, 74, false)
	_place_wall_banners(45, 87, false)
	_place_wall_banners(65, 87, true)
	_place_wall_banners(78, 76, true)
	_place_wall_banners(87, 81, false)
	_place_ink_fountain(99, 74)
	_place_wall_banners(96, 76, true)
	_place_wall_banners(105, 76, false)

	var floor_decor := [
		[7, 5, 0, 20, 21], [17, 5, 0, 19, 25], [7, 11, 0, 19, 21], [17, 11, 0, 21, 22],
		[44, 2, 0, 20, 21], [53, 2, 0, 19, 25], [47, 25, 0, 18, 27], [53, 25, 0, 21, 22],
		[67, 10, 0, 20, 22], [67, 20, 0, 19, 25], [104, 12, 0, 20, 21], [104, 21, 0, 21, 21],
		[96, 42, 0, 20, 21], [107, 42, 0, 19, 25], [67, 58, 0, 21, 22], [73, 58, 0, 20, 21],
		[50, 61, 0, 19, 25], [60, 61, 0, 20, 21], [20, 40, 0, 19, 21], [35, 40, 0, 19, 25],
		[20, 57, 0, 18, 27], [46, 55, 0, 20, 22],
		[8, 80, 0, 20, 21], [19, 80, 0, 19, 25], [41, 76, 0, 21, 22], [41, 92, 0, 19, 22],
		[75, 78, 0, 18, 27], [83, 90, 0, 19, 25], [96, 79, 0, 20, 21], [96, 88, 0, 21, 21],
		[106, 79, 0, 19, 21], [106, 88, 0, 20, 22],
	]
	for d: Array in floor_decor:
		var dp := Vector2i(int(d[0]), int(d[1]))
		if _floor_cells.has(dp):
			_decor_cells[dp] = [int(d[2]), int(d[3]), int(d[4])]

	# =========================================================================
	# ALL 77 ORIGINAL ENTITY IDS PRESERVED 100% + AUTHORED TORCHES/COINS (93)
	# =========================================================================
	var entities: Array = [
		{"id": "player_spawn", "type": "player", "position": _cpos(11, 8)},

		# Camp 1 (l3_camp_1_far_anchors: 5 Skeletons + 2 Reapers)
		{"id": "l3_c1_skeleton_01", "type": "skeleton", "position": _cpos(85, 17), "patrol": 32},
		{"id": "l3_c1_skeleton_02", "type": "skeleton", "position": _cpos(93, 13), "patrol": 32},
		{"id": "l3_c1_skeleton_03", "type": "skeleton", "position": _cpos(93, 21), "patrol": 32},
		{"id": "l3_c1_skeleton_04", "type": "skeleton", "position": _cpos(97, 14), "patrol": 32},
		{"id": "l3_c1_skeleton_05", "type": "skeleton", "position": _cpos(97, 20), "patrol": 32},
		{"id": "l3_c1_reaper_01", "type": "skeleton_reaper", "position": _cpos(102, 13), "patrol": 32},
		{"id": "l3_c1_reaper_02", "type": "skeleton_reaper", "position": _cpos(102, 20), "patrol": 32},

		# Camp 2 (l3_camp_2_pincer_fire: East vanguard visible in `mid`! + Pulpit & Corner Reapers)
		{"id": "l3_c2_skeleton_01", "type": "skeleton", "position": _cpos(45, 52), "patrol": 32},
		{"id": "l3_c2_skeleton_02", "type": "skeleton", "position": _cpos(41, 48), "patrol": 32},
		{"id": "l3_c2_skeleton_03", "type": "skeleton", "position": _cpos(33, 41), "patrol": 32},
		{"id": "l3_c2_skeleton_04", "type": "skeleton", "position": _cpos(33, 56), "patrol": 32},
		{"id": "l3_c2_skeleton_05", "type": "skeleton", "position": _cpos(23, 49), "patrol": 32},
		{"id": "l3_c2_reaper_01", "type": "skeleton_reaper", "position": _cpos(21, 56), "patrol": 30},
		{"id": "l3_c2_reaper_02", "type": "skeleton_reaper", "position": _cpos(27, 49), "patrol": 30},

		# Camp 3 (l3_camp_3_split_lane: Split-Bastion vanguard + closing Reaper visible in `end`!)
		{"id": "l3_c3_skeleton_01", "type": "skeleton", "position": _cpos(48, 78), "patrol": 32},
		{"id": "l3_c3_skeleton_02", "type": "skeleton", "position": _cpos(52, 90), "patrol": 32},
		{"id": "l3_c3_skeleton_03", "type": "skeleton", "position": _cpos(63, 78), "patrol": 32},
		{"id": "l3_c3_skeleton_04", "type": "skeleton", "position": _cpos(69, 90), "patrol": 32},
		{"id": "l3_c3_skeleton_05", "type": "skeleton", "position": _cpos(79, 89), "patrol": 32},
		{"id": "l3_c3_reaper_01", "type": "skeleton_reaper", "position": _cpos(79, 80), "patrol": 28},

		# Reciprocal Floor Doors (4: E -> E switchback -> W landing!)
		{
			"id": "door_l3_f1_f2_down",
			"type": "floor_door",
			"position": _cpos(110, 17),
			"target_position": _cpos(106, 46),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l3_f1_f2_up",
			"type": "floor_door",
			"position": _cpos(106, 46),
			"target_position": _cpos(110, 17),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{
			"id": "door_l3_f2_f3_down",
			"type": "floor_door",
			"position": _cpos(9, 52),
			"target_position": _cpos(9, 84),
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l3_f2_f3_up",
			"type": "floor_door",
			"position": _cpos(9, 84),
			"target_position": _cpos(9, 52),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},

		# 5 Authored Sigils (4 Required -> Strategic Route Choice!)
		{"id": "l3_sigil_crossfire_cache", "type": "sigil", "position": _cpos(48, 3)},
		{"id": "l3_sigil_camp_1", "type": "sigil", "position": _cpos(104, 17)},
		{"id": "l3_sigil_ring_cache", "type": "sigil", "position": _cpos(55, 60)},
		{"id": "l3_sigil_camp_2", "type": "sigil", "position": _cpos(18, 52)},
		{"id": "l3_sigil_final", "type": "sigil", "position": _cpos(82, 84)},

		# Checkpoints (2) & Exit Gate (1)
		{"id": "l3_checkpoint_floor_2", "type": "checkpoint", "position": _cpos(98, 46)},
		{"id": "l3_checkpoint_floor_3", "type": "checkpoint", "position": _cpos(16, 84)},
		{"id": "l3_exit", "type": "exit_gate", "position": _cpos(104, 84)},

		# Chests (2: exact score_reward 320 & 360)
		{"id": "l3_chest_line_of_fire", "type": "chest", "position": _cpos(50, 24), "score_reward": 320},
		{"id": "l3_chest_ring", "type": "chest", "position": _cpos(70, 57), "score_reward": 360},

		# 18 Authored Spikes (all with 4 safe neighbors + 100% capsule bypass!)
		{"id": "l3_spikes_01", "type": "spikes", "position": _cpos(29, 10)},
		{"id": "l3_spikes_02", "type": "spikes", "position": _cpos(37, 15)},
		{"id": "l3_spikes_03", "type": "spikes", "position": _cpos(46, 21)},
		{"id": "l3_spikes_04", "type": "spikes", "position": _cpos(58, 15)},
		{"id": "l3_spikes_05", "type": "spikes", "position": _cpos(78, 17)},
		{"id": "l3_spikes_06", "type": "spikes", "position": _cpos(92, 17)},

		{"id": "l3_spikes_07", "type": "spikes", "position": _cpos(69, 41)},
		{"id": "l3_spikes_08", "type": "spikes", "position": _cpos(61, 47)},
		{"id": "l3_spikes_09", "type": "spikes", "position": _cpos(58, 52)},
		{"id": "l3_spikes_10", "type": "spikes", "position": _cpos(26, 41)},
		{"id": "l3_spikes_11", "type": "spikes", "position": _cpos(35, 53)},
		{"id": "l3_spikes_12", "type": "spikes", "position": _cpos(22, 52)},

		{"id": "l3_spikes_13", "type": "spikes", "position": _cpos(52, 78)},
		{"id": "l3_spikes_14", "type": "spikes", "position": _cpos(57, 84)},
		{"id": "l3_spikes_15", "type": "spikes", "position": _cpos(68, 78)},
		{"id": "l3_spikes_16", "type": "spikes", "position": _cpos(58, 90)},
		{"id": "l3_spikes_17", "type": "spikes", "position": _cpos(88, 83)},
		{"id": "l3_spikes_18", "type": "spikes", "position": _cpos(88, 85)},

		# Torches (22)
		{"id": "l3_torch_01", "type": "torch", "position": _cpos(8, 6)},
		{"id": "l3_torch_02", "type": "torch", "position": _cpos(22, 8)},
		{"id": "l3_torch_03", "type": "torch", "position": _cpos(37, 10)},
		{"id": "l3_torch_04", "type": "torch", "position": _cpos(48, 6)},
		{"id": "l3_torch_05", "type": "torch", "position": _cpos(100, 43)},
		{"id": "l3_torch_06", "type": "torch", "position": _cpos(62, 41)},
		{"id": "l3_torch_07", "type": "torch", "position": _cpos(55, 56)},
		{"id": "l3_torch_08", "type": "torch", "position": _cpos(41, 41)},
		{"id": "l3_torch_09", "type": "torch", "position": _cpos(20, 49)},
		{"id": "l3_torch_10", "type": "torch", "position": _cpos(15, 81)},
		{"id": "l3_torch_11", "type": "torch", "position": _cpos(57, 78)},
		{"id": "l3_torch_12", "type": "torch", "position": _cpos(94, 84)},
		{"id": "l3_torch_13", "type": "torch", "position": _cpos(16, 8)},
		{"id": "l3_torch_14", "type": "torch", "position": _cpos(58, 10)},
		{"id": "l3_torch_15", "type": "torch", "position": _cpos(86, 13)},
		{"id": "l3_torch_16", "type": "torch", "position": _cpos(86, 20)},
		{"id": "l3_torch_17", "type": "torch", "position": _cpos(88, 46)},
		{"id": "l3_torch_18", "type": "torch", "position": _cpos(51, 52)},
		{"id": "l3_torch_19", "type": "torch", "position": _cpos(29, 52)},
		{"id": "l3_torch_20", "type": "torch", "position": _cpos(28, 84)},
		{"id": "l3_torch_21", "type": "torch", "position": _cpos(79, 84)},
		{"id": "l3_torch_22", "type": "torch", "position": _cpos(101, 80)},

		# Coins (18)
		{"id": "l3_coin_01", "type": "coin", "position": _cpos(20, 8)},
		{"id": "l3_coin_02", "type": "coin", "position": _cpos(26, 9)},
		{"id": "l3_coin_03", "type": "coin", "position": _cpos(48, 8)},
		{"id": "l3_coin_04", "type": "coin", "position": _cpos(62, 10)},
		{"id": "l3_coin_05", "type": "coin", "position": _cpos(91, 46)},
		{"id": "l3_coin_06", "type": "coin", "position": _cpos(84, 46)},
		{"id": "l3_coin_07", "type": "coin", "position": _cpos(56, 41)},
		{"id": "l3_coin_08", "type": "coin", "position": _cpos(55, 57)},
		{"id": "l3_coin_09", "type": "coin", "position": _cpos(24, 84)},
		{"id": "l3_coin_10", "type": "coin", "position": _cpos(31, 84)},
		{"id": "l3_coin_11", "type": "coin", "position": _cpos(85, 84)},
		{"id": "l3_coin_12", "type": "coin", "position": _cpos(91, 84)},
		{"id": "l3_coin_13", "type": "coin", "position": _cpos(40, 21)},
		{"id": "l3_coin_14", "type": "coin", "position": _cpos(52, 24)},
		{"id": "l3_coin_15", "type": "coin", "position": _cpos(39, 41)},
		{"id": "l3_coin_16", "type": "coin", "position": _cpos(21, 41)},
		{"id": "l3_coin_17", "type": "coin", "position": _cpos(46, 90)},
		{"id": "l3_coin_18", "type": "coin", "position": _cpos(62, 90)},
	]

	var metadata := {
		"objective": "Dùng kệ sách đá làm vật chắn đạn hồi hồn, tách đội hình Tử Thần và thu 4 trong 5 ấn ký.",
		"difficulty_tier": 3,
		"pacing": "three_six_member_packs_per_floor_with_ranged_crossfire",
		"density_cadence_anchor": _cpos(60, 10),
		"roster_id": "chapter_1_level_3_roster",
		"encounter_pack_model": {
			"enabled": true,
			"profile_stage": 3,
			"floor_count": 3,
			"placement": "authored_camp_anchors",
			"authored_counts_are_anchors": true,
		},
		"required_sigils": 4,
		"camera_bounds": [0, 0, WIDTH * TILE, HEIGHT * TILE],
		"layout_profile": "three_floor_crossfire_and_cover",
		"tileset": "0x72 DungeonTileset II v1.7 (CC0)",
		"rooms": [
			{"id": "l3_f1_entry", "floor": 1, "role": "safe_entry", "rect": [4, 4, 15, 9]},
			{"id": "l3_f1_crossfire_hall", "floor": 1, "role": "cover_lesson", "rect": [31, 8, 43, 18]},
			{"id": "l3_f1_hidden_cache", "floor": 1, "role": "optional_reward", "rect": [43, 2, 12, 5]},
			{"id": "l3_f1_camp", "floor": 1, "role": "combat_camp", "rect": [82, 10, 24, 14]},
			{"id": "l3_f2_landing", "floor": 2, "role": "safe_landing", "rect": [95, 41, 14, 9]},
			{"id": "l3_f2_ring", "floor": 2, "role": "cover_route", "rect": [44, 39, 34, 20]},
			{"id": "l3_f2_hidden_reliquary", "floor": 2, "role": "optional_reward", "rect": [49, 56, 13, 7]},
			{"id": "l3_f2_camp", "floor": 2, "role": "combat_camp", "rect": [16, 39, 32, 20]},
			{"id": "l3_f3_landing", "floor": 3, "role": "safe_landing", "rect": [7, 79, 14, 9]},
			{"id": "l3_f3_camp", "floor": 3, "role": "combat_camp", "rect": [34, 75, 51, 19]},
			{"id": "l3_f3_exit", "floor": 3, "role": "exit", "rect": [90, 77, 20, 14]},
		],
		"combat_camps": [
			{
				"id": "l3_camp_1_far_anchors",
				"floor": 1,
				"rect": [82, 10, 24, 14],
				"entry_cell": [82, 17],
				"enemy_ids": [
					"l3_c1_skeleton_01", "l3_c1_skeleton_02", "l3_c1_skeleton_03",
					"l3_c1_skeleton_04", "l3_c1_skeleton_05",
					"l3_c1_reaper_01", "l3_c1_reaper_02",
				],
				"formation": "five_swordsmen_screen_two_reapers",
				"breather_after": true,
			},
			{
				"id": "l3_camp_2_pincer_fire",
				"floor": 2,
				"rect": [16, 39, 32, 20],
				"entry_cell": [47, 52],
				"enemy_ids": [
					"l3_c2_skeleton_01", "l3_c2_skeleton_02", "l3_c2_skeleton_03",
					"l3_c2_skeleton_04", "l3_c2_skeleton_05",
					"l3_c2_reaper_01", "l3_c2_reaper_02",
				],
				"formation": "five_swordsmen_push_between_two_reaper_angles",
				"breather_after": true,
			},
			{
				"id": "l3_camp_3_split_lane",
				"floor": 3,
				"rect": [34, 75, 51, 19],
				"entry_cell": [34, 84],
				"enemy_ids": [
					"l3_c3_skeleton_01", "l3_c3_skeleton_02", "l3_c3_skeleton_03",
					"l3_c3_skeleton_04", "l3_c3_skeleton_05",
					"l3_c3_reaper_01",
				],
				"formation": "five_swordsmen_split_then_one_reaper_closes_the_lane",
				"breather_after": true,
			},
		],
		"safe_zones": [
			{"id": "l3_spawn_sanctuary", "rect": [4, 4, 15, 9], "purpose": "spawn_and_reaper_read"},
			{"id": "l3_floor_2_breather", "rect": [95, 41, 14, 9], "purpose": "checkpoint_and_reset"},
			{"id": "l3_floor_3_breather", "rect": [7, 79, 14, 9], "purpose": "checkpoint_before_split_lane"},
		],
		"special_zones": [
			{"id": "l3_optional_sigil_pair", "rect": [43, 2, 20, 61], "purpose": "five_sigils_only_four_required"},
		],
	}

	return {
		"version": 2,
		"name": "Thư Khố Giao Hỏa",
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


func _add_book_stack(x0: int, y0: int, w: int, emerald_trim: bool) -> void:
	_book_stacks.append([x0, y0, w, emerald_trim])


func _add_lectern_pier(x0: int, y0: int) -> void:
	_lectern_piers.append([x0, y0])


func _stamp_book_stack(x0: int, y0: int, w: int, emerald_trim: bool) -> void:
	for dx: int in range(w):
		var top_p := Vector2i(x0 + dx, y0)
		var bot_p := Vector2i(x0 + dx, y0 + 1)
		_set_solid(top_p.x, top_p.y, 0, 1 if emerald_trim else 2, 3 if dx == 0 else 1)
		_set_solid(bot_p.x, bot_p.y, 0, 6, 6)
		_decor_cells[bot_p] = [0, 18, 26]
		if dx > 0 or w == 1:
			_decor_cells[top_p] = [0, 18, 25]


func _stamp_lectern_pier(x0: int, y0: int) -> void:
	for dx: int in range(2):
		_set_solid(x0 + dx, y0, 0, 2, 1)
		_set_solid(x0 + dx, y0 + 1, 0, 6, 6)
		_decor_cells[Vector2i(x0 + dx, y0)] = [0, 5 + dx, 5]


func _place_wall_banners(x0: int, y_face: int, emerald_left: bool) -> void:
	var b1 := 1 if emerald_left else 2
	var b2 := 2 if emerald_left else 1
	_set_solid(x0, y_face, 0, b1, 3)
	_set_solid(x0 + 1, y_face, 0, b2, 3)


func _place_ink_fountain(x0: int, y_top: int) -> void:
	for dx: int in range(3):
		var tx := 4 + dx
		_set_solid(x0 + dx, y_top, 0, tx, 0)
		_set_solid(x0 + dx, y_top + 1, 0, tx, 3)
		_set_solid(x0 + dx, y_top + 2, 0, tx, 4)


func _place_vault_door(x0: int, y_top: int) -> void:
	for dx: int in range(2):
		_set_solid(x0 + dx, y_top, 0, 2 + dx, 15)
		_set_solid(x0 + dx, y_top + 1, 0, 2 + dx, 16)


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
