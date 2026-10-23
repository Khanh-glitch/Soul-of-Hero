class_name Level3CrossfireArchiveBuilder
extends RefCounted
## Deterministic architectural builder for Chapter 1 Level 3 ("Thư Khố Giao Hỏa").
## Vaulted subterranean stone archive & damaged scriptorium on a 116x96 canvas:
## - True 0x72 multi-tile architectural masonry compiler (columns 1..3 outer shells,
##   columns 8..11 solid bastions/stacks, columns 4..7 T-junctions & concave miters,
##   source-0 [1..3,0..1] north ashlar courses — zero vertical pillar teeth or slits).
## - Ordered stone scroll-cubby bays ([0,1..2,12] armaria) vs visibly breached archive
##   walls ([0,3,2..3] missing-stone cavities + localized floor rubble, zero crates).
## - Properly aligned 3x3 cisterns, recessed dark stairwell portals ([0,5..6,15..16])
##   for all 4 FloorDoors, and a recessed north sanctuary alcove for ExitGate.

const TILE := 16
const WIDTH := 116
const HEIGHT := 96

var _floor_cells: Dictionary = {}
var _geom_cells: Dictionary = {}
var _decor_cells: Dictionary = {}
var _archive_bays: Array = []
var _pilaster_piers: Array = []


func build() -> Dictionary:
	_floor_cells.clear()
	_geom_cells.clear()
	_decor_cells.clear()
	_archive_bays.clear()
	_pilaster_piers.clear()

	# =========================================================================
	# FLOOR 1 (y = 3..25): BENCHMARK LOCATION 1 (`l3_f1_entry` DAMAGED MONASTIC
	# ARCHIVE ENTRANCE) -> UNCHANGED DOWNSTREAM CLOISTER, BRIDGES & HALL
	# =========================================================================
	# Unchanged downstream Floor 1 regions (`x >= 35`); `x < 40` is authored cleanly
	# inside `_build_spawn_archive_entrance()` below!
	_carve_rect(35, 9, 31, 3)
	# Breached North Passage -> Forbidden Folio Vault (`l3_f1_hidden_cache`)
	_carve_rect(47, 5, 5, 4)
	_carve_rect(43, 3, 13, 3)

	# Twin Staggered Stone Bridges across Open Subterranean Chasm!
	_carve_rect(35, 12, 5, 8)
	_carve_rect(56, 12, 5, 8)

	# South Scholar's Gallery + Exposed Line-of-Fire Treasure Pocket (320 pts)
	_carve_rect(35, 20, 31, 4)
	_carve_rect(46, 23, 9, 3)

	# East Convergence Gallery -> Twin-Pulpit Grand Reading Hall (`l3_f1_camp`)
	_carve_rect(66, 9, 8, 13)
	_uncarve_rect(69, 13, 3, 5)
	_carve_rect(74, 15, 8, 4)

	_carve_rect(82, 10, 24, 14)
	_uncarve_rect(82, 10, 3, 2)
	_uncarve_rect(82, 22, 3, 2)
	# Raised East Archivist Pulpit cheek-piers framing Reaper sightlines at (102,13)&(102,20)
	_uncarve_rect(104, 10, 2, 2)
	_uncarve_rect(104, 22, 2, 2)
	# Recessed East Stairwell Threshold Alcove (`door_l3_f1_f2_down` at (109, 17))
	_carve_rect(106, 15, 6, 5)

	# Subtle worn stone reading runners along main circulation aisles
	_wear_aisle_h(31, 66, 10)
	_wear_aisle_v(49, 4, 10)
	_wear_aisle_v(37, 10, 21)
	_wear_aisle_v(58, 10, 21)
	_wear_aisle_h(34, 65, 21)
	_wear_aisle_h(74, 110, 17)

	# Unchanged downstream cover blocks (Spawn Entrance has zero sewer/trough blocks!)
	_add_archive_bay(41, 9, 3, true)
	_add_archive_bay(51, 20, 3, true)
	_add_archive_bay(87, 12, 4, false)
	_add_archive_bay(87, 20, 4, false)
	_add_pilaster_pier(95, 16)

	# =========================================================================
	# FLOOR 2 (y = 39..62, E -> W HERRINGBONE STACKS, BREACHED SECRET VAULT,
	# AND ASYMMETRIC PINCER READING HALL) — 12+ rows void gap to F1 & F3!
	# =========================================================================
	# East Stairwell Arrival Sanctuary (`l3_f2_landing`)
	_carve_rect(95, 41, 14, 9)
	_carve_rect(82, 44, 13, 4)

	# Herringbone Archive Stacks (`l3_f2_ring` — mid capture center (61, 49) open!)
	_carve_rect(73, 41, 9, 13)
	_carve_rect(47, 39, 27, 5)
	_carve_rect(47, 51, 27, 4)
	_carve_rect(59, 44, 5, 7)
	# Salvage Vault Alcove (`l3_chest_ring` 360 pts)
	_carve_rect(66, 55, 9, 5)
	# South Breached Archive Vault (`l3_f2_hidden_reliquary` — Optional Sigil #3!)
	_carve_rect(53, 55, 5, 4)
	_carve_rect(49, 58, 13, 5)

	# West Asymmetric Pincer Reading Hall (`l3_f2_camp`)
	_carve_rect(17, 39, 31, 5)
	_carve_rect(16, 46, 32, 13)
	_uncarve_rect(16, 57, 3, 2)
	_uncarve_rect(45, 57, 3, 2)
	_carve_rect(44, 44, 4, 3)
	_carve_rect(18, 44, 4, 3)
	# Recessed West Stairwell Threshold Alcove (`door_l3_f2_f3_down` at (9, 52))
	_carve_rect(7, 50, 9, 5)

	_wear_aisle_h(75, 106, 46)
	_wear_aisle_h(45, 74, 41)
	_wear_aisle_h(45, 74, 52)
	_wear_aisle_v(61, 41, 52)
	_wear_aisle_v(55, 53, 61)
	_wear_aisle_h(19, 47, 41)
	_wear_aisle_h(9, 47, 52)

	_add_archive_bay(101, 43, 3, false)
	_add_archive_bay(76, 46, 3, false)
	_add_archive_bay(53, 40, 3, true)
	_add_archive_bay(66, 51, 3, false)
	_add_archive_bay(37, 49, 4, true)
	_add_archive_bay(26, 54, 4, false)
	_add_pilaster_pier(31, 48)

	# =========================================================================
	# FLOOR 3 (y = 75..93, W -> E SPLIT-BASTION ARCHIVE -> MASTER SEAL VAULT)
	# =========================================================================
	_carve_rect(7, 79, 14, 9)
	_carve_rect(21, 82, 13, 4)

	# Split-Bastion Archive Hall (`l3_f3_camp`)
	_carve_rect(34, 77, 6, 15)
	_carve_rect(39, 75, 36, 6)
	_carve_rect(39, 88, 36, 6)
	_carve_rect(55, 81, 5, 7)
	_carve_rect(73, 77, 12, 15)

	# Threshold Gallery -> Master Seal Vault (`l3_f3_exit`)
	# Recessed North Sanctuary Alcove at x = 102..106, y = 78..80 so `l3_exit` at
	# (104, 80) mounts its stone arch squarely into load-bearing north masonry y = 77!
	_carve_rect(85, 82, 8, 5)
	_carve_rect(93, 80, 17, 11)
	_carve_rect(101, 78, 7, 3)
	_uncarve_rect(93, 89, 3, 2)
	_uncarve_rect(107, 89, 3, 2)

	_wear_aisle_h(9, 38, 84)
	_wear_aisle_h(37, 79, 78)
	_wear_aisle_h(37, 79, 90)
	_wear_aisle_v(57, 78, 90)
	_wear_aisle_h(79, 105, 84)
	_wear_aisle_v(104, 79, 85)

	_add_archive_bay(12, 81, 3, false)
	_add_archive_bay(45, 76, 3, true)
	_add_archive_bay(63, 89, 3, false)
	_add_pilaster_pier(75, 84)
	_add_archive_bay(95, 81, 3, false)
	_add_archive_bay(95, 87, 3, false)

	# =========================================================================
	# COMPILE COHERENT LOAD-BEARING MASONRY + STAMP ARCHIVE STRUCTURES
	# =========================================================================
	_compile_masonry()

	for bay: Array in _archive_bays:
		_stamp_archive_bay(int(bay[0]), int(bay[1]), int(bay[2]), bool(bay[3]))
	for pier: Array in _pilaster_piers:
		_stamp_pilaster_pier(int(pier[0]), int(pier[1]))

	# =========================================================================
	# PURPOSEFUL ARCHIVAL ARCHITECTURE (NO REPETITIVE BANNERS OR CRATES!)
	# =========================================================================
	# 1. Properly aligned 3x3 Scriptorium Ink Cisterns on unchanged downstream floors
	_place_cistern(92, 10)
	_place_cistern(31, 39)

	# 2. One complete 4x3 Monumental Sealed Vault Archway behind solid stone in the
	#    Forbidden Folio Vault (`x = 48..51, y = 0..2`, floor at y = 3)
	_place_sealed_vault_arch(48, 3)

	# 3. Recessed 4x3 Dark Stone Stairwell Portals directly behind all 4 FloorDoors!
	_place_stairwell_portal(108, 15)
	_place_stairwell_portal(105, 41)
	_place_stairwell_portal(8, 50)
	_place_stairwell_portal(8, 79)

	# 4. Recessed Master Exit Sanctuary Architrave directly behind `l3_exit` (104, 80)
	_frame_exit_sanctuary(104, 80)

	# 5. Authentic Breached Archive Masonry & localized fallen stone around breaches
	_mark_breach_wall(45, 7)
	_mark_breach_wall(52, 7)
	_mark_breach_floor(48, 6)
	_mark_breach_floor(50, 7)
	_mark_breach_floor(49, 8)
	_mark_breach_wall(51, 57)
	_mark_breach_wall(58, 57)
	_mark_breach_floor(54, 56)
	_mark_breach_floor(56, 57)
	_mark_breach_floor(55, 58)
	_mark_breach_wall(53, 80)
	_mark_breach_wall(61, 80)
	_mark_breach_floor(56, 82)
	_mark_breach_floor(58, 85)

	# 6. Sparse threshold-only emerald scholar standards on unchanged downstream floors
	_set_solid(88, 9, 0, 1, 3)
	_set_solid(98, 9, 0, 1, 3)
	_set_solid(100, 40, 0, 1, 3)
	_set_solid(97, 79, 0, 1, 3)

	# 7. Protected archival wall niches on unchanged downstream reading rooms
	for niche_p: Vector2i in [
		Vector2i(45, 2), Vector2i(53, 2),
		Vector2i(86, 9), Vector2i(100, 9),
		Vector2i(98, 40), Vector2i(103, 40),
		Vector2i(68, 50), Vector2i(71, 50),
		Vector2i(10, 78), Vector2i(18, 78),
		Vector2i(95, 79), Vector2i(108, 79),
	]:
		if _geom_cells.has(niche_p):
			_geom_cells[niche_p] = [0, 1 + (niche_p.x % 2), 12]

	# 8. Unchanged downstream floor details
	var curated_decor := [
		[44, 3, 0, 20, 21], [54, 3, 0, 20, 22],
		[47, 7, 0, 18, 27], [53, 24, 0, 21, 22],
		[97, 42, 0, 20, 21], [72, 58, 0, 20, 22],
		[50, 61, 0, 20, 21], [57, 56, 0, 18, 27],
		[20, 40, 0, 19, 22], [59, 83, 0, 18, 27],
		[94, 81, 0, 20, 21], [108, 81, 0, 20, 22],
	]
	for d: Array in curated_decor:
		var dp := Vector2i(int(d[0]), int(d[1]))
		if _floor_cells.has(dp) and not _decor_cells.has(dp):
			_decor_cells[dp] = [int(d[2]), int(d[3]), int(d[4])]

	# =========================================================================
	# BENCHMARK LOCATION 1 (`x = 0..39, y = 0..26`):
	# HAND-AUTHORED DAMAGED MONASTIC ARCHIVE ENTRANCE (`l3_f1_entry`)
	# =========================================================================
	_build_spawn_archive_entrance()

	# =========================================================================
	# ALL 77 ORIGINAL ENTITY IDS PRESERVED 100% + DISCIPLINED LIGHTING (79 TOTAL)
	# =========================================================================
	var entities: Array = [
		{"id": "player_spawn", "type": "player", "position": _cpos(17, 13)},

		# Camp 1 (`l3_camp_1_far_anchors`: 5 Skeletons + 2 Archivist Pulpit Reapers)
		{"id": "l3_c1_skeleton_01", "type": "skeleton", "position": _cpos(85, 17), "patrol": 32},
		{"id": "l3_c1_skeleton_02", "type": "skeleton", "position": _cpos(93, 13), "patrol": 32},
		{"id": "l3_c1_skeleton_03", "type": "skeleton", "position": _cpos(93, 21), "patrol": 32},
		{"id": "l3_c1_skeleton_04", "type": "skeleton", "position": _cpos(98, 14), "patrol": 32},
		{"id": "l3_c1_skeleton_05", "type": "skeleton", "position": _cpos(98, 20), "patrol": 32},
		{"id": "l3_c1_reaper_01", "type": "skeleton_reaper", "position": _cpos(102, 13), "patrol": 28},
		{"id": "l3_c1_reaper_02", "type": "skeleton_reaper", "position": _cpos(102, 20), "patrol": 28},

		# Camp 2 (`l3_camp_2_pincer_fire`: 5 Skeletons + 2 Pincer Reapers)
		{"id": "l3_c2_skeleton_01", "type": "skeleton", "position": _cpos(45, 52), "patrol": 32},
		{"id": "l3_c2_skeleton_02", "type": "skeleton", "position": _cpos(42, 48), "patrol": 32},
		{"id": "l3_c2_skeleton_03", "type": "skeleton", "position": _cpos(33, 41), "patrol": 32},
		{"id": "l3_c2_skeleton_04", "type": "skeleton", "position": _cpos(34, 56), "patrol": 32},
		{"id": "l3_c2_skeleton_05", "type": "skeleton", "position": _cpos(23, 49), "patrol": 32},
		{"id": "l3_c2_reaper_01", "type": "skeleton_reaper", "position": _cpos(21, 56), "patrol": 30},
		{"id": "l3_c2_reaper_02", "type": "skeleton_reaper", "position": _cpos(27, 49), "patrol": 30},

		# Camp 3 (`l3_camp_3_split_lane`: 5 Skeletons + Closing Bastion Reaper)
		{"id": "l3_c3_skeleton_01", "type": "skeleton", "position": _cpos(49, 78), "patrol": 32},
		{"id": "l3_c3_skeleton_02", "type": "skeleton", "position": _cpos(52, 90), "patrol": 32},
		{"id": "l3_c3_skeleton_03", "type": "skeleton", "position": _cpos(63, 78), "patrol": 32},
		{"id": "l3_c3_skeleton_04", "type": "skeleton", "position": _cpos(69, 90), "patrol": 32},
		{"id": "l3_c3_skeleton_05", "type": "skeleton", "position": _cpos(79, 89), "patrol": 32},
		{"id": "l3_c3_reaper_01", "type": "skeleton_reaper", "position": _cpos(79, 80), "patrol": 28},

		# 4 Reciprocal Stairwell Portal FloorDoors (each directly at its arch threshold!)
		{
			"id": "door_l3_f1_f2_down",
			"type": "floor_door",
			"position": _cpos(109, 16),
			"target_position": _cpos(106, 42),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l3_f1_f2_up",
			"type": "floor_door",
			"position": _cpos(106, 42),
			"target_position": _cpos(109, 16),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
		{
			"id": "door_l3_f2_f3_down",
			"type": "floor_door",
			"position": _cpos(9, 51),
			"target_position": _cpos(9, 80),
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để đi tiếp",
		},
		{
			"id": "door_l3_f2_f3_up",
			"type": "floor_door",
			"position": _cpos(9, 80),
			"target_position": _cpos(9, 51),
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},

		# 5 Authored Sigils (4 Required -> Strategic Route Choice!)
		{"id": "l3_sigil_crossfire_cache", "type": "sigil", "position": _cpos(49, 4)},
		{"id": "l3_sigil_camp_1", "type": "sigil", "position": _cpos(104, 17)},
		{"id": "l3_sigil_ring_cache", "type": "sigil", "position": _cpos(55, 60)},
		{"id": "l3_sigil_camp_2", "type": "sigil", "position": _cpos(18, 52)},
		{"id": "l3_sigil_final", "type": "sigil", "position": _cpos(82, 84)},

		# Checkpoints (2) & Recessed North Sanctuary Exit Gate (1)
		{"id": "l3_checkpoint_floor_2", "type": "checkpoint", "position": _cpos(98, 46)},
		{"id": "l3_checkpoint_floor_3", "type": "checkpoint", "position": _cpos(17, 84)},
		{"id": "l3_exit", "type": "exit_gate", "position": _cpos(104, 80)},

		# Chests (2: exact score_reward 320 & 360)
		{"id": "l3_chest_line_of_fire", "type": "chest", "position": _cpos(50, 24), "score_reward": 320},
		{"id": "l3_chest_ring", "type": "chest", "position": _cpos(70, 57), "score_reward": 360},

		# 18 Authored Spikes (all safe-bypassable; (61, 49) mid anchor kept 100% spike-free!)
		{"id": "l3_spikes_01", "type": "spikes", "position": _cpos(32, 12)},
		{"id": "l3_spikes_02", "type": "spikes", "position": _cpos(37, 15)},
		{"id": "l3_spikes_03", "type": "spikes", "position": _cpos(46, 21)},
		{"id": "l3_spikes_04", "type": "spikes", "position": _cpos(58, 15)},
		{"id": "l3_spikes_05", "type": "spikes", "position": _cpos(78, 17)},
		{"id": "l3_spikes_06", "type": "spikes", "position": _cpos(92, 17)},

		{"id": "l3_spikes_07", "type": "spikes", "position": _cpos(69, 41)},
		{"id": "l3_spikes_08", "type": "spikes", "position": _cpos(61, 45)},
		{"id": "l3_spikes_09", "type": "spikes", "position": _cpos(58, 52)},
		{"id": "l3_spikes_10", "type": "spikes", "position": _cpos(26, 41)},
		{"id": "l3_spikes_11", "type": "spikes", "position": _cpos(35, 53)},
		{"id": "l3_spikes_12", "type": "spikes", "position": _cpos(22, 52)},

		{"id": "l3_spikes_13", "type": "spikes", "position": _cpos(52, 78)},
		{"id": "l3_spikes_14", "type": "spikes", "position": _cpos(57, 84)},
		{"id": "l3_spikes_15", "type": "spikes", "position": _cpos(68, 78)},
		{"id": "l3_spikes_16", "type": "spikes", "position": _cpos(58, 90)},
		{"id": "l3_spikes_17", "type": "spikes", "position": _cpos(88, 83)},
		{"id": "l3_spikes_18", "type": "spikes", "position": _cpos(88, 86)},

		# 14 Purposeful Archive Sconces (wall-mounted on load-bearing masonry — zero mid-floor torches!)
		{"id": "l3_torch_01", "type": "torch", "position": _cpos(11, 11)},
		{"id": "l3_torch_02", "type": "torch", "position": _cpos(22, 10)},
		{"id": "l3_torch_03", "type": "torch", "position": _cpos(36, 10)},
		{"id": "l3_torch_04", "type": "torch", "position": _cpos(49, 6)},
		{"id": "l3_torch_05", "type": "torch", "position": _cpos(98, 43)},
		{"id": "l3_torch_06", "type": "torch", "position": _cpos(63, 49)},
		{"id": "l3_torch_07", "type": "torch", "position": _cpos(55, 59)},
		{"id": "l3_torch_08", "type": "torch", "position": _cpos(41, 41)},
		{"id": "l3_torch_09", "type": "torch", "position": _cpos(21, 49)},
		{"id": "l3_torch_10", "type": "torch", "position": _cpos(16, 81)},
		{"id": "l3_torch_11", "type": "torch", "position": _cpos(57, 79)},
		{"id": "l3_torch_12", "type": "torch", "position": _cpos(100, 80)},
		{"id": "l3_torch_13", "type": "torch", "position": _cpos(85, 14)},
		{"id": "l3_torch_14", "type": "torch", "position": _cpos(108, 80)},

		# 12 Original Coins (clean breadcrumb guidance across optional & main lanes)
		{"id": "l3_coin_01", "type": "coin", "position": _cpos(23, 12)},
		{"id": "l3_coin_02", "type": "coin", "position": _cpos(29, 12)},
		{"id": "l3_coin_03", "type": "coin", "position": _cpos(49, 8)},
		{"id": "l3_coin_04", "type": "coin", "position": _cpos(62, 10)},
		{"id": "l3_coin_05", "type": "coin", "position": _cpos(90, 46)},
		{"id": "l3_coin_06", "type": "coin", "position": _cpos(84, 46)},
		{"id": "l3_coin_07", "type": "coin", "position": _cpos(56, 41)},
		{"id": "l3_coin_08", "type": "coin", "position": _cpos(55, 57)},
		{"id": "l3_coin_09", "type": "coin", "position": _cpos(25, 84)},
		{"id": "l3_coin_10", "type": "coin", "position": _cpos(31, 84)},
		{"id": "l3_coin_11", "type": "coin", "position": _cpos(85, 84)},
		{"id": "l3_coin_12", "type": "coin", "position": _cpos(91, 84)},
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
			{"id": "l3_f1_entry", "floor": 1, "role": "safe_entry", "rect": [6, 9, 22, 12]},
			{"id": "l3_f1_crossfire_hall", "floor": 1, "role": "cover_lesson", "rect": [35, 9, 39, 15]},
			{"id": "l3_f1_hidden_cache", "floor": 1, "role": "optional_reward", "rect": [43, 3, 13, 6]},
			{"id": "l3_f1_camp", "floor": 1, "role": "combat_camp", "rect": [82, 10, 24, 14]},
			{"id": "l3_f2_landing", "floor": 2, "role": "safe_landing", "rect": [95, 41, 14, 9]},
			{"id": "l3_f2_ring", "floor": 2, "role": "cover_route", "rect": [44, 39, 34, 20]},
			{"id": "l3_f2_hidden_reliquary", "floor": 2, "role": "optional_reward", "rect": [49, 55, 13, 8]},
			{"id": "l3_f2_camp", "floor": 2, "role": "combat_camp", "rect": [16, 39, 32, 20]},
			{"id": "l3_f3_landing", "floor": 3, "role": "safe_landing", "rect": [7, 79, 14, 9]},
			{"id": "l3_f3_camp", "floor": 3, "role": "combat_camp", "rect": [34, 75, 51, 19]},
			{"id": "l3_f3_exit", "floor": 3, "role": "exit", "rect": [92, 78, 18, 13]},
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
			{"id": "l3_spawn_sanctuary", "rect": [6, 4, 13, 9], "purpose": "spawn_and_reaper_read"},
			{"id": "l3_floor_2_breather", "rect": [95, 41, 14, 9], "purpose": "checkpoint_and_reset"},
			{"id": "l3_floor_3_breather", "rect": [7, 79, 14, 9], "purpose": "checkpoint_before_split_lane"},
		],
		"special_zones": [
			{"id": "l3_optional_sigil_pair", "rect": [43, 3, 20, 60], "purpose": "five_sigils_only_four_required"},
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


func _carve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			if x >= 2 and x < WIDTH - 2 and y >= 2 and y < HEIGHT - 2:
				var p := Vector2i(x, y)
				# Calm architectural stone slab base (~91% [1,4], subtle hairline wear only)
				var tile := Vector2i(1, 4)
				if posmod(x * 19 + y * 37, 17) == 0:
					tile = Vector2i(2, 4)
				elif posmod(x * 29 + y * 13, 23) == 0:
					tile = Vector2i(3, 4)
				_floor_cells[p] = [0, tile.x, tile.y]
				_geom_cells.erase(p)


func _uncarve_rect(x0: int, y0: int, w: int, h: int) -> void:
	for y: int in range(y0, y0 + h):
		for x: int in range(x0, x0 + w):
			_floor_cells.erase(Vector2i(x, y))


func _wear_aisle_h(x0: int, x1: int, y: int) -> void:
	for x: int in range(x0, x1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 2 if posmod(x, 5) == 0 else 1, 4]


func _wear_aisle_v(x: int, y0: int, y1: int) -> void:
	for y: int in range(y0, y1 + 1):
		var p := Vector2i(x, y)
		if _floor_cells.has(p):
			_floor_cells[p] = [0, 3 if posmod(y, 5) == 0 else 1, 4]


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
			# Load-bearing south-facing ashlar course directly above walkable floor
			_geom_cells[p] = [0, 1 + posmod(x * 3 + y * 5, 3), 1]
		elif fn:
			# Parapet directly south of walkable floor:
			# - If solid masonry continues below (`ss`), use 100%-opaque [1, 10, 0] roof parapet
			# - Otherwise exterior/chasm drop: 3D parapet + brick exterior course [1, 2, 2]
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
			# Exterior north cornice topper sitting directly on south-facing brick course (x, y + 1)
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
			# Solid unexposed interior masonry fill — 100% opaque dark stone (zero seams!)
			_geom_cells[p] = [1, 9, 2]


func _add_archive_bay(x0: int, y0: int, w: int, damaged_right: bool) -> void:
	_archive_bays.append([x0, y0, w, damaged_right])


func _add_pilaster_pier(x0: int, y0: int) -> void:
	_pilaster_piers.append([x0, y0])


func _stamp_archive_bay(x0: int, y0: int, w: int, damaged_right: bool) -> void:
	# Authentic 2-row stone scroll-pigeonhole stack (`armarium`):
	# Top row: opaque beveled stone shelf cap [1, 10, 0]
	# South face: carved 2x2 scroll cubbies [0, 1..2, 12] framed by ashlar ends
	# (or breached masonry [0, 3, 3] + shattered floor stone on damaged end!).
	for dx: int in range(w):
		var px := x0 + dx
		_set_solid(px, y0, 1, 10, 0)
		if damaged_right and dx == w - 1:
			_set_solid(px, y0 + 1, 0, 3, 3)
			var rubble_floor := Vector2i(px, y0 + 2)
			if _floor_cells.has(rubble_floor):
				_floor_cells[rubble_floor] = [0, 3, 5]
		elif dx == 0 and w >= 4:
			_set_solid(px, y0 + 1, 0, 1, 1)
		elif dx == w - 1 and w >= 4:
			_set_solid(px, y0 + 1, 0, 3, 1)
		else:
			_set_solid(px, y0 + 1, 0, 1 + (dx % 2), 12)


func _stamp_pilaster_pier(x0: int, y0: int) -> void:
	# Complete 3-row architectural pier: capital + shaft + carved plinth base on floor!
	for dx: int in range(2):
		var px := x0 + dx
		_set_solid(px, y0, 1, 10, 0)
		_set_solid(px, y0 + 1, 0, 6, 6)
		_decor_cells[Vector2i(px, y0)] = [0, 5 + dx, 5]
		var base_p := Vector2i(px, y0 + 2)
		if _floor_cells.has(base_p):
			_decor_cells[base_p] = [0, 5, 7]


func _place_cistern(x0: int, y_floor: int) -> void:
	# Proper 3x3 alignment: cornice at y_floor - 2, spout at y_floor - 1, stone rim on y_floor!
	for dx: int in range(3):
		var tx := 4 + dx
		_set_solid(x0 + dx, y_floor - 2, 0, tx, 0)
		_set_solid(x0 + dx, y_floor - 1, 0, tx, 3)
		var fp := Vector2i(x0 + dx, y_floor)
		if _floor_cells.has(fp):
			_floor_cells[fp] = [0, tx, 4]


func _place_sealed_vault_arch(x0: int, y_floor: int) -> void:
	# Complete 4x3 monumental sealed vault doorway ([2..3,14] crown + [1..4,15..16] jambs/doors)
	_set_solid(x0 + 1, y_floor - 3, 0, 2, 14)
	_set_solid(x0 + 2, y_floor - 3, 0, 3, 14)
	for dx: int in range(4):
		_set_solid(x0 + dx, y_floor - 2, 0, 1 + dx, 15)
		_set_solid(x0 + dx, y_floor - 1, 0, 1 + dx, 16)


func _place_stairwell_portal(x0: int, y_top_floor: int) -> void:
	# Complete 4x3 recessed dark stone stairwell arch ([2..3,14] crown, [1,4,15..16] shoulders,
	# [5..6,15..16] dark arched tunnel mouth, and [5,12] stone stair threshold below!)
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


func _frame_exit_sanctuary(exit_x: int, exit_y: int) -> void:
	# `exit_gate.tscn` GateArch spans y in [-51.6, +3.6] relative to (exit_x, exit_y).
	# North sanctuary wall stands at exit_y - 3 (cornice at exit_y - 4), flanked by engaged
	# stone pilasters with carved plinth bases and dark stone threshold [5, 12] at exit_y - 1.
	for px: int in [exit_x - 3, exit_x + 3]:
		_set_solid(px, exit_y - 3, 0, 5, 5)
		_set_solid(px, exit_y - 2, 0, 5, 6)
		var bp := Vector2i(px, exit_y - 1)
		if _floor_cells.has(bp):
			_decor_cells[bp] = [0, 5, 7]
	for dx: int in range(-1, 2):
		var tp := Vector2i(exit_x + dx, exit_y - 1)
		if _floor_cells.has(tp):
			_floor_cells[tp] = [0, 5, 12]


func _mark_breach_wall(x: int, y: int) -> void:
	var p := Vector2i(x, y)
	if _geom_cells.has(p):
		_geom_cells[p] = [0, 3, 3]


func _mark_breach_floor(x: int, y: int) -> void:
	var p := Vector2i(x, y)
	if _floor_cells.has(p):
		_floor_cells[p] = [0, 3 if (x + y) % 2 == 0 else 1, 5]


func _set_solid(x: int, y: int, src: int, tx: int, ty: int) -> void:
	var p := Vector2i(x, y)
	_floor_cells.erase(p)
	_decor_cells.erase(p)
	_geom_cells[p] = [src, tx, ty]


# =============================================================================
# BENCHMARK LOCATION 1 (`x = 0..39, y = 0..26`):
# HAND-AUTHORED DAMAGED MONASTIC ARCHIVE ENTRANCE (`l3_f1_entry` + WEST BRIDGE)
# =============================================================================
const ARCHIVE_FLOOR_PALETTE := [
	Vector2i(1, 4), Vector2i(1, 4), Vector2i(1, 4), Vector2i(1, 4), Vector2i(1, 4),
	Vector2i(2, 4), Vector2i(3, 4),
	Vector2i(1, 5), Vector2i(2, 5), Vector2i(3, 5),
	Vector2i(1, 6), Vector2i(2, 6),
]


func _archive_floor_tile(x: int, y: int) -> Vector2i:
	var a := (x * 73856093) & 0xFFFFFFFF
	var b := (y * 19349663) & 0xFFFFFFFF
	var c := ((x + y) * 83492791) & 0xFFFFFFFF
	return ARCHIVE_FLOOR_PALETTE[((a ^ b ^ c) & 0xFFFFFFFF) % ARCHIVE_FLOOR_PALETTE.size()]


func _archive_wall_9slice(fset: Dictionary, x: int, y: int) -> Vector2i:
	var n := fset.has(Vector2i(x, y - 1))
	var e := fset.has(Vector2i(x + 1, y))
	var s := fset.has(Vector2i(x, y + 1))
	var w := fset.has(Vector2i(x - 1, y))
	if n and e:
		return Vector2i(1, 2)
	if n and w:
		return Vector2i(3, 2)
	if s and e:
		return Vector2i(1, 0)
	if s and w:
		return Vector2i(3, 0)
	if s:
		return Vector2i(2, 0)
	if n:
		return Vector2i(2, 2)
	if e:
		return Vector2i(1, 1)
	if w:
		return Vector2i(3, 1)
	if fset.has(Vector2i(x + 1, y + 1)):
		return Vector2i(1, 0)
	if fset.has(Vector2i(x - 1, y + 1)):
		return Vector2i(3, 0)
	if fset.has(Vector2i(x + 1, y - 1)):
		return Vector2i(1, 2)
	if fset.has(Vector2i(x - 1, y - 1)):
		return Vector2i(3, 2)
	return Vector2i(2, 0)


func _place_wood_case_1x2(x: int, y_base: int) -> void:
	# Verified complete 1x2 (16x32px) plain wooden archive storage cabinet:
	# Solid brick backing [0, 3, 2] on Geometry prevents any 2px black void border,
	# while [0, 18, 25..26] renders the complete uncropped 16x32 wood cabinet on Decor!
	_set_solid(x, y_base, 0, 3, 2)
	_decor_cells[Vector2i(x, y_base - 1)] = [0, 18, 25]
	_decor_cells[Vector2i(x, y_base)] = [0, 18, 26]


func _place_solid_stack_bay(x0: int, y_base: int, w: int, breached_east: bool) -> void:
	# Solid 3-band cut-stone monastic archive stack (`[0,1..3,0]` cornice cap on Decor
	# at y_base - 2 + `[0,1..3,1]` upper brick at y_base - 1 + `[0,3,2]` lower brick at y_base).
	# Zero hollow cavities, zero sewer slits; optional shattered east end!
	for dx: int in range(w):
		var px := x0 + dx
		if breached_east and dx == w - 1:
			_set_solid(px, y_base - 1, 0, 2, 1)
			_set_solid(px, y_base, 0, 3, 3)
			_decor_cells[Vector2i(px, y_base - 2)] = [0, 3, 0]
			var rf := Vector2i(px, y_base + 1)
			if _floor_cells.has(rf):
				_floor_cells[rf] = [0, 3, 5]
		else:
			_set_solid(px, y_base - 1, 0, 1 + posmod(px * 3 + y_base, 3), 1)
			_set_solid(px, y_base, 0, 3, 2)
			_decor_cells[Vector2i(px, y_base - 2)] = [0, 1 + posmod(px + y_base, 3), 0]


func _place_column_1x3(cx: int, cy: int, cracked: bool) -> void:
	# Verified 1x3 (16x48px) classical column over opaque brick backing [0, 3, 2].
	var col_x := 6 if cracked else 5
	_set_solid(cx, cy, 0, 3, 2)
	_decor_cells[Vector2i(cx, cy - 1)] = [0, col_x, 5]
	_decor_cells[Vector2i(cx, cy)] = [0, col_x, 6]
	_decor_cells[Vector2i(cx, cy + 1)] = [0, col_x, 7]


func _place_sunken_shaft_2x4(x0: int, y0: int) -> void:
	# Verified fixed 2x4 (32x64px) sunken stone shaft pit [0, 2..3, 8..11]:
	# Row 8 has 5px transparent north bevels so it draws on Decor over solid floor-slab
	# backing [0, 1, 4] on Geometry — zero black slit above the stone rim!
	for dx: int in range(2):
		_set_solid(x0 + dx, y0, 0, 1, 4)
		_decor_cells[Vector2i(x0 + dx, y0)] = [0, 2 + dx, 8]
	for dy: int in [1, 2]:
		for dx: int in range(2):
			_set_solid(x0 + dx, y0 + dy, 0, 2 + dx, 8 + dy)
	for dx: int in range(2):
		var sp := Vector2i(x0 + dx, y0 + 3)
		if _floor_cells.has(sp):
			_decor_cells[sp] = [0, 2 + dx, 11]


func _build_spawn_archive_entrance() -> void:
	# Clear strictly Location 1 viewport zone (x = 0..39, y = 0..26) while keeping
	# x >= 40 and Floors 2..3 100% untouched.
	for y: int in range(0, 27):
		for x: int in range(0, 40):
			var p := Vector2i(x, y)
			_floor_cells.erase(p)
			_geom_cells.erase(p)
			_decor_cells.erase(p)

	# 1. Stepped Monastic Vault Footprint with 100% HUD-safe north & south margins:
	var rects := [
		[6, 12, 5, 8],
		[11, 10, 15, 10],
		[17, 20, 9, 2],
		[26, 11, 9, 4],
		[35, 9, 5, 15],
	]
	for r: Array in rects:
		for y: int in range(int(r[1]), int(r[1]) + int(r[3])):
			for x: int in range(int(r[0]), int(r[0]) + int(r[2])):
				var p := Vector2i(x, y)
				var ft := _archive_floor_tile(x, y)
				_floor_cells[p] = [0, ft.x, ft.y]

	# Worn flagstone scholar aisles between parallel stone archive stacks
	for x: int in range(7, 26):
		for ry: int in [12, 16, 19]:
			if _floor_cells.has(Vector2i(x, ry)):
				_floor_cells[Vector2i(x, ry)] = [0, 1, 4]
	for x: int in range(26, 40):
		if _floor_cells.has(Vector2i(x, 12)):
			_floor_cells[Vector2i(x, 12)] = [0, 1, 4]
	for y: int in range(10, 20):
		for rx: int in [15, 16]:
			if _floor_cells.has(Vector2i(rx, y)):
				_floor_cells[Vector2i(rx, y)] = [0, 1, 4]
	for y: int in range(9, 23):
		if _floor_cells.has(Vector2i(37, y)):
			_floor_cells[Vector2i(37, y)] = [0, 1, 4]

	# 2. Clean 9-slice perimeter shell (ZERO hollow [1, 8..11, 0] cavities anywhere!)
	for y: int in range(1, 26):
		for x: int in range(1, 40):
			var p := Vector2i(x, y)
			if _floor_cells.has(p):
				continue
			var touches := false
			for dy: int in range(-1, 2):
				for dx: int in range(-1, 2):
					if dx == 0 and dy == 0:
						continue
					if _floor_cells.has(Vector2i(x + dx, y + dy)):
						touches = true
						break
				if touches:
					break
			if touches:
				var wa := _archive_wall_9slice(_floor_cells, x, y)
				_geom_cells[p] = [1, wa.x, wa.y]

	# 3. Full 3-band north masonry elevations ([0,1..3,0] cornice + [0,1..3,1] upper
	#    brick + [0,3,2] lower brick) across every north wall run in Location 1!
	var north_runs := [
		[5, 10, 11],
		[11, 16, 10],
		[17, 25, 9],
		[26, 34, 10],
		[35, 39, 8],
	]
	for nr: Array in north_runs:
		var wy: int = nr[2]
		for wx: int in range(int(nr[0]), int(nr[1]) + 1):
			_set_solid(wx, wy, 0, 3, 2)
			_set_solid(wx, wy - 1, 0, 1 + posmod(wx * 3 + wy, 3), 1)
			var lip := Vector2i(wx, wy - 2)
			if not _floor_cells.has(lip):
				_set_solid(wx, wy - 2, 0, 1 + posmod(wx + wy, 3), 0)

	# 4. Complete Verified Multi-Tile Monastic Archive Architecture:
	# (A) 4x3 Sealed Oak Archive Vault Door (x = 12..15, y = 8..10) cleanly below HP/MP HUD!
	_decor_cells[Vector2i(13, 8)] = [0, 2, 14]
	_decor_cells[Vector2i(14, 8)] = [0, 3, 14]
	for dx: int in range(4):
		_decor_cells[Vector2i(12 + dx, 9)] = [0, 1 + dx, 15]
		_decor_cells[Vector2i(12 + dx, 10)] = [0, 1 + dx, 16]
	_floor_cells[Vector2i(13, 11)] = [0, 5, 12]
	_floor_cells[Vector2i(14, 11)] = [0, 5, 12]

	# (B) Single complete 1x1 Emerald Scholar Banner on upper wall course at (18, 8)
	_set_solid(18, 8, 0, 1, 3)

	# (C) Flush 3x3 Scriptorium Lavabo / Blue Cistern embedded 100% inside north wall (x = 20..22, y = 7..9)
	for dx: int in range(3):
		var tx := 4 + dx
		_set_solid(20 + dx, 7, 0, tx, 0)
		_set_solid(20 + dx, 8, 0, tx, 3)
		_set_solid(20 + dx, 9, 0, tx, 4)

	# (D) Wall water seepage ([0, 4, 5..6]) drawn on Decor over solid brick so zero black hole!
	_decor_cells[Vector2i(24, 8)] = [0, 4, 5]
	_decor_cells[Vector2i(24, 9)] = [0, 4, 6]
	_floor_cells[Vector2i(24, 10)] = [0, 3, 5]

	# (E) Parallel Monastic Stone Archive Stack Carrels + Recessed 1x2 Timber Storage Cases
	_place_solid_stack_bay(8, 14, 4, false)
	_place_wood_case_1x2(7, 14)
	_place_solid_stack_bay(8, 18, 4, false)
	_place_wood_case_1x2(7, 18)
	_place_wood_case_1x2(8, 11)
	_place_wood_case_1x2(9, 11)

	# East archive stack row breached by collapse + surviving wood storage cabinet!
	_place_solid_stack_bay(19, 14, 4, true)
	_place_wood_case_1x2(18, 14)
	_place_wood_case_1x2(25, 10)

	# (F) Paired Central Reading Nave Columns: Intact West (14, 16) vs Shattered East (17, 17)
	_place_column_1x3(14, 16, false)
	_place_column_1x3(17, 17, true)
	_floor_cells[Vector2i(18, 17)] = [0, 3, 5]
	_floor_cells[Vector2i(18, 18)] = [0, 2, 6]

	# (G) Sunken 2x4 Sub-Vault Collapse Shaft Pit in SE Bay (x = 21..22, y = 18..21)
	_place_sunken_shaft_2x4(21, 18)
	_floor_cells[Vector2i(20, 19)] = [0, 3, 5]
	_floor_cells[Vector2i(23, 19)] = [0, 2, 6]

	# (H) East Cloister breach rubble (authentic stone rubble [0, 3, 5], zero mini-ladders!)
	_set_solid(29, 10, 0, 3, 3)
	_floor_cells[Vector2i(29, 11)] = [0, 3, 5]
	_set_solid(33, 10, 0, 3, 3)
	_floor_cells[Vector2i(33, 11)] = [0, 2, 5]
	_decor_cells[Vector2i(19, 21)] = [0, 18, 27]
	_decor_cells[Vector2i(36, 13)] = [0, 18, 27]


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
