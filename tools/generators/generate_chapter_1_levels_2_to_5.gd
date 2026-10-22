extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")

var _builder := MapBuilder.new()


func _init() -> void:
	var definitions := [
		_level_1_definition(),
		_level_2_definition(),
		_level_3_definition(),
		_level_4_definition(),
		_level_5_definition(),
	]
	for definition: Dictionary in definitions:
		var level := _builder.build(definition)
		var validation: Dictionary = LevelSchemaValidator.validate_level(level)
		if not bool(validation.get("ok", false)):
			push_error(
				"Refusing to write invalid %s: %s"
				% [definition.get("id", "map"), validation.get("error", "unknown error")]
			)
			quit(1)
			return
		if not _write_level(String(definition.output), level):
			quit(1)
			return
		print(
			"Generated %s: %d floor, %d wall, %d decor, %d entities, %d camps"
			% [
				definition.id,
				level.layers.Backdrop.size(),
				level.layers.Geometry.size(),
				level.layers.Decor.size(),
				level.entities.size(),
				level.metadata.combat_camps.size(),
			]
		)
	quit()


func _level_1_definition() -> Dictionary:
	var entities: Array = []
	# Keep the canonical spawn and a few long-lived entity IDs so tutorials,
	# hot-reload tooling and old bookmarks remain stable after the redesign.
	entities.append(_entity("player_spawn", "player", 6, 6))

	var camp_1 := [
		"l1_c1_skeleton_01", "l1_c1_skeleton_02",
		"l1_c1_skeleton_03", "l1_c1_skeleton_04",
	]
	_add_enemy_group(
		entities,
		camp_1,
		[Vector2i(48, 7), Vector2i(56, 10), Vector2i(48, 18), Vector2i(57, 18)],
		"skeleton",
		36,
	)
	var camp_2 := [
		"l1_c2_skeleton_01", "l1_c2_skeleton_02",
		"l1_c2_skeleton_03", "l1_c2_skeleton_04",
	]
	_add_enemy_group(
		entities,
		camp_2,
		[Vector2i(50, 31), Vector2i(58, 36), Vector2i(50, 47), Vector2i(59, 47)],
		"skeleton",
		34,
	)
	var camp_3 := [
		"l1_c3_skeleton_01", "l1_c3_skeleton_02",
		"l1_c3_skeleton_03", "l1_c3_skeleton_04",
	]
	_add_enemy_group(
		entities,
		camp_3,
		[Vector2i(45, 60), Vector2i(55, 59), Vector2i(45, 70), Vector2i(62, 69)],
		"skeleton",
		32,
	)

	var floor_1_door := Vector2i(84, 18)
	var floor_2_entry := Vector2i(9, 39)
	var floor_2_door := Vector2i(91, 43)
	var floor_3_entry := Vector2i(9, 66)
	entities.append_array([
		_entity("door_f1_to_f2", "floor_door", floor_1_door.x, floor_1_door.y, {
			"target_position": _world_position(floor_2_entry),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để xuống tầng 2",
		}),
		_entity("door_f2_to_f1", "floor_door", floor_2_entry.x, floor_2_entry.y, {
			"target_position": _world_position(floor_1_door),
			"label": "Tầng 1",
			"message": "Nhấn chuột trái để quay lại tầng 1",
		}),
		_entity("door_f2_to_f3", "floor_door", floor_2_door.x, floor_2_door.y, {
			"target_position": _world_position(floor_3_entry),
			"label": "Tầng 3",
			"message": "Nhấn chuột trái để xuống tầng 3",
		}),
		_entity("door_f3_to_f2", "floor_door", floor_3_entry.x, floor_3_entry.y, {
			"target_position": _world_position(floor_2_door),
			"label": "Tầng 2",
			"message": "Nhấn chuột trái để quay lại tầng 2",
		}),
		_entity("sigil_a", "sigil", 76, 10),
		_entity("sigil_b", "sigil", 84, 38),
		_entity("sigil_c", "sigil", 68, 65),
		_entity("checkpoint", "checkpoint", 16, 39),
		_entity("checkpoint_floor_3", "checkpoint", 16, 66),
		_entity("exit", "exit_gate", 95, 66),
		_entity("chest_a", "chest", 35, 7, {"score_reward": 180}),
		_entity("chest_b", "chest", 34, 70, {"score_reward": 240}),
	])
	_add_entities(entities, "spikes", "spikes", [
		Vector2i(65, 12), Vector2i(38, 7), Vector2i(53, 7), Vector2i(58, 19),
		Vector2i(36, 31), Vector2i(36, 47), Vector2i(59, 31), Vector2i(59, 47),
		Vector2i(74, 65), Vector2i(38, 59), Vector2i(40, 71), Vector2i(64, 71),
	])
	# Restore the original stable hazard IDs expected by editor bookmarks.
	for spike_index: int in range(12):
		entities[entities.size() - 12 + spike_index]["id"] = "spikes_%02d" % (spike_index + 1)
	entities[entities.size() - 12]["id"] = "spikes_a"
	_add_entities(entities, "torch", "torch", [
		Vector2i(18, 7), Vector2i(34, 6), Vector2i(60, 20), Vector2i(82, 8),
		Vector2i(18, 34), Vector2i(32, 30), Vector2i(62, 48), Vector2i(88, 34),
		Vector2i(18, 61), Vector2i(32, 58), Vector2i(70, 72), Vector2i(94, 61),
	])
	# Keep torch_a and coin_01 stable for runtime hot-reload coverage.
	for torch_index: int in range(12):
		entities[entities.size() - 12 + torch_index]["id"] = "torch_%s" % String.chr(97 + torch_index)
	_add_entities(entities, "coin", "coin", [
		Vector2i(23, 11), Vector2i(29, 11), Vector2i(38, 11), Vector2i(64, 11),
		Vector2i(25, 38), Vector2i(31, 38), Vector2i(66, 38), Vector2i(72, 38),
		Vector2i(25, 65), Vector2i(31, 65), Vector2i(72, 65), Vector2i(83, 65),
	])
	for coin_index: int in range(12):
		entities[entities.size() - 12 + coin_index]["id"] = "coin_%02d" % (coin_index + 1)

	return {
		"id": "chapter_1_level_1",
		"output": "res://data/levels/crypt_entrance.json",
		"name": "Hầm Mộ Khai Ấn",
		"width": 104,
		"height": 76,
		"decor_seed": 1,
		"required_sigils": 3,
		"layout_profile": "three_floor_tutorial_camp_progression",
		"rooms": [
			_room("l1_f1_entry", 1, "tutorial_safe_entry", 4, 4, 18, 14),
			_room("l1_f1_camp", 1, "combat_camp", 32, 4, 30, 20),
			_room("l1_f1_reliquary", 1, "reward_and_door", 68, 6, 20, 16),
			_room("l1_f2_landing", 2, "safe_landing", 4, 32, 18, 14),
			_room("l1_f2_ring", 2, "combat_camp", 30, 28, 34, 22),
			_room("l1_f2_reliquary", 2, "reward_and_door", 72, 32, 24, 16),
			_room("l1_f3_landing", 3, "safe_landing", 4, 60, 18, 12),
			_room("l1_f3_camp", 3, "combat_camp", 30, 56, 42, 19),
			_room("l1_f3_exit", 3, "exit", 80, 59, 20, 14),
		],
		"corridors": [
			Rect2i(22, 9, 10, 5), Rect2i(62, 11, 6, 4),
			Rect2i(22, 37, 8, 4), Rect2i(64, 37, 8, 4),
			Rect2i(22, 64, 8, 4), Rect2i(72, 64, 8, 4),
		],
		"pits": [
			Rect2i(40, 10, 6, 6), Rect2i(41, 34, 12, 10),
			Rect2i(50, 63, 6, 6),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l1_camp_1_opening_square", 1, [32, 4, 30, 20], [32, 12], camp_1, "four_swordsmen_with_a_single_cover_pit", true),
			_camp("l1_camp_2_training_ring", 2, [30, 28, 34, 22], [30, 39], camp_2, "four_swordsmen_teach_circular_kiting", true),
			_camp("l1_camp_3_final_wedge", 3, [30, 56, 42, 19], [30, 66], camp_3, "four_swordsmen_hold_two_routes_around_cover", true),
		],
		"safe_zones": [
			_zone("l1_tutorial_sanctuary", [4, 4, 18, 14], "movement_dash_and_combo_tutorial"),
			_zone("l1_floor_2_breather", [4, 32, 18, 14], "checkpoint_after_first_camp"),
			_zone("l1_floor_3_breather", [4, 60, 18, 12], "checkpoint_before_final_camp"),
		],
		"special_zones": [
			_zone("l1_first_combat_read", [22, 9, 40, 15], "wide_telegraph_and_safe_retreat_lane"),
		],
		"metadata": {
			"objective": "Hoàn thành ba bãi xương, thu 3 ấn ký và mở cổng thoát.",
			"difficulty_tier": 1,
			"pacing": "three_packs_per_floor_five_members_each_with_short_breathers",
			"roster_id": "chapter_1_level_1_roster",
			"encounter_pack_model": _pack_model(1),
		},
	}


func _level_2_definition() -> Dictionary:
	var entities: Array = []
	entities.append(_entity("player_spawn", "player", 8, 12))

	var camp_1 := [
		"l2_c1_skeleton_01", "l2_c1_skeleton_02", "l2_c1_skeleton_03",
		"l2_c1_skeleton_04", "l2_c1_skeleton_05",
	]
	var camp_1_cells := [Vector2i(94, 12), Vector2i(99, 12), Vector2i(103, 15), Vector2i(95, 20), Vector2i(101, 21)]
	_add_enemy_group(entities, camp_1, camp_1_cells, "skeleton", 40)
	var camp_2 := [
		"l2_c2_skeleton_01", "l2_c2_skeleton_02", "l2_c2_skeleton_03",
		"l2_c2_skeleton_04", "l2_c2_skeleton_05",
	]
	var camp_2_cells := [Vector2i(58, 34), Vector2i(61, 38), Vector2i(59, 43), Vector2i(61, 48), Vector2i(56, 50)]
	_add_enemy_group(entities, camp_2, camp_2_cells, "skeleton", 40)
	var camp_3 := [
		"l2_c3_skeleton_01", "l2_c3_skeleton_02", "l2_c3_skeleton_03",
		"l2_c3_skeleton_04", "l2_c3_skeleton_05",
	]
	var camp_3_cells := [Vector2i(56, 63), Vector2i(69, 63), Vector2i(56, 72), Vector2i(70, 72), Vector2i(67, 67)]
	_add_enemy_group(entities, camp_3, camp_3_cells, "skeleton", 38)

	_add_door_pair(entities, "l2_f1_f2", Vector2i(103, 23), Vector2i(9, 42), "Tầng 2")
	_add_door_pair(entities, "l2_f2_f3", Vector2i(103, 48), Vector2i(9, 70), "Tầng 3")
	entities.append_array([
		_entity("l2_sigil_choice_north", "sigil", 73, 8),
		_entity("l2_sigil_choice_south", "sigil", 73, 23),
		_entity("l2_sigil_ring", "sigil", 77, 50),
		_entity("l2_sigil_gauntlet", "sigil", 74, 67),
		_entity("l2_checkpoint_floor_2", "checkpoint", 16, 42),
		_entity("l2_checkpoint_floor_3", "checkpoint", 16, 70),
		_entity("l2_exit", "exit_gate", 102, 68),
		_entity("l2_chest_risky_branch", "chest", 68, 13, {"score_reward": 220}),
		_entity("l2_chest_gauntlet", "chest", 39, 63, {"score_reward": 280}),
	])
	_add_entities(entities, "l2_spikes", "spikes", [
		Vector2i(59, 9), Vector2i(59, 21), Vector2i(39, 34),
		Vector2i(39, 49), Vector2i(44, 67), Vector2i(72, 72),
		Vector2i(48, 9), Vector2i(48, 21), Vector2i(83, 11),
		Vector2i(48, 34), Vector2i(48, 49), Vector2i(75, 40),
		Vector2i(54, 63), Vector2i(54, 73), Vector2i(84, 68),
	])
	_add_entities(entities, "l2_torch", "torch", [
		Vector2i(17, 9), Vector2i(32, 6), Vector2i(80, 6), Vector2i(91, 22),
		Vector2i(18, 36), Vector2i(70, 32), Vector2i(92, 49), Vector2i(18, 65),
		Vector2i(37, 74), Vector2i(101, 63),
	])
	_add_entities(entities, "l2_coin", "coin", [
		Vector2i(23, 11), Vector2i(35, 7), Vector2i(50, 7), Vector2i(50, 21),
		Vector2i(25, 40), Vector2i(36, 34), Vector2i(36, 49), Vector2i(25, 68),
		Vector2i(79, 68), Vector2i(91, 68),
	])

	return {
		"id": "chapter_1_level_2",
		"output": "res://data/levels/chapter_1_level_2.json",
		"name": "Ngã Ba Cốt Trắng",
		"width": 112,
		"height": 80,
		"decor_seed": 2,
		"required_sigils": 3,
		"layout_profile": "three_floor_fork_and_recombine",
		"rooms": [
			_room("l2_f1_entry", 1, "safe_entry", 4, 6, 16, 12),
			_room("l2_f1_fork", 1, "route_choice", 30, 4, 24, 20),
			_room("l2_f1_north_reliquary", 1, "optional_reward", 64, 3, 18, 13),
			_room("l2_f1_south_reliquary", 1, "optional_reward", 64, 18, 18, 11),
			_room("l2_f1_convergence", 1, "combat_camp", 88, 8, 19, 18),
			_room("l2_f2_landing", 2, "safe_landing", 4, 34, 18, 14),
			_room("l2_f2_ring", 2, "combat_camp", 34, 31, 30, 22),
			_room("l2_f2_north_cache", 2, "flank_route", 68, 30, 18, 12),
			_room("l2_f2_south_cache", 2, "flank_route", 68, 45, 18, 12),
			_room("l2_f2_convergence", 2, "breather", 90, 35, 18, 17),
			_room("l2_f3_landing", 3, "safe_landing", 4, 63, 18, 12),
			_room("l2_f3_gauntlet", 3, "combat_camp", 34, 59, 42, 18),
			_room("l2_f3_exit", 3, "exit", 86, 61, 21, 14),
		],
		"corridors": [
			Rect2i(20, 10, 10, 4), Rect2i(54, 7, 10, 4), Rect2i(54, 19, 10, 4),
			Rect2i(82, 8, 7, 4), Rect2i(82, 21, 7, 4),
			Rect2i(22, 39, 12, 4), Rect2i(64, 35, 5, 4), Rect2i(64, 48, 5, 4),
			Rect2i(86, 35, 5, 4), Rect2i(86, 48, 5, 4),
			Rect2i(22, 67, 12, 4), Rect2i(76, 67, 10, 4),
		],
		"pits": [
			Rect2i(38, 9, 8, 10), Rect2i(43, 37, 12, 10),
			Rect2i(47, 62, 5, 7), Rect2i(61, 68, 5, 7),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l2_camp_1_shield_wall", 1, [88, 8, 19, 18], [88, 14], camp_1, "five_swordsmen_converge_on_two_entries", true),
			_camp("l2_camp_2_ring_pressure", 2, [34, 31, 30, 22], [52, 34], camp_2, "five_swordsmen_attack_around_a_cover_pit", true),
			_camp("l2_camp_3_slalom", 3, [34, 59, 42, 18], [52, 67], camp_3, "five_swordsmen_hold_both_slalom_lanes", true),
		],
		"safe_zones": [
			_zone("l2_spawn_sanctuary", [4, 6, 16, 12], "spawn_and_control_read"),
			_zone("l2_floor_2_breather", [4, 34, 18, 14], "checkpoint_after_camp"),
			_zone("l2_floor_3_breather", [4, 63, 18, 12], "checkpoint_before_final_camp"),
		],
		"special_zones": [
			_zone("l2_choose_one_sigil_fork", [64, 3, 18, 26], "two_risk_profiles_one_required_route"),
		],
		"metadata": {
			"objective": "Chọn nhánh ít rủi ro hơn, phá ba bãi xương và thu 3 trong 4 ấn ký.",
			"difficulty_tier": 2,
			"pacing": "three_five_member_packs_per_floor_with_route_pressure",
			"density_cadence_anchor": _world_position(Vector2i(50, 13)),
			"roster_id": "chapter_1_level_2_roster",
			"encounter_pack_model": _pack_model(2),
		},
	}


func _level_3_definition() -> Dictionary:
	var entities: Array = []
	entities.append(_entity("player_spawn", "player", 8, 13))
	var camp_1_swords := ["l3_c1_skeleton_01", "l3_c1_skeleton_02", "l3_c1_skeleton_03", "l3_c1_skeleton_04", "l3_c1_skeleton_05"]
	var camp_1_reapers := ["l3_c1_reaper_01", "l3_c1_reaper_02"]
	_add_enemy_group(entities, camp_1_swords, [Vector2i(88, 10), Vector2i(92, 15), Vector2i(96, 9), Vector2i(98, 18), Vector2i(102, 14)], "skeleton", 38)
	_add_enemy_group(entities, camp_1_reapers, [Vector2i(106, 8), Vector2i(106, 20)], "skeleton_reaper", 32)
	var camp_1 := camp_1_swords + camp_1_reapers

	var camp_2_swords := ["l3_c2_skeleton_01", "l3_c2_skeleton_02", "l3_c2_skeleton_03", "l3_c2_skeleton_04", "l3_c2_skeleton_05"]
	var camp_2_reapers := ["l3_c2_reaper_01", "l3_c2_reaper_02"]
	_add_enemy_group(entities, camp_2_swords, [Vector2i(80, 36), Vector2i(81, 46), Vector2i(90, 33), Vector2i(94, 49), Vector2i(106, 36)], "skeleton", 36)
	_add_enemy_group(entities, camp_2_reapers, [Vector2i(106, 49), Vector2i(94, 42)], "skeleton_reaper", 30)
	var camp_2 := camp_2_swords + camp_2_reapers

	var camp_3_swords := ["l3_c3_skeleton_01", "l3_c3_skeleton_02", "l3_c3_skeleton_03", "l3_c3_skeleton_04", "l3_c3_skeleton_05"]
	var camp_3_reapers := ["l3_c3_reaper_01"]
	_add_enemy_group(entities, camp_3_swords, [Vector2i(42, 67), Vector2i(48, 64), Vector2i(54, 65), Vector2i(66, 75), Vector2i(72, 74)], "skeleton", 36)
	_add_enemy_group(entities, camp_3_reapers, [Vector2i(74, 66)], "skeleton_reaper", 28)
	var camp_3 := camp_3_swords + camp_3_reapers

	_add_door_pair(entities, "l3_f1_f2", Vector2i(113, 14), Vector2i(9, 42), "Tầng 2")
	_add_door_pair(entities, "l3_f2_f3", Vector2i(113, 47), Vector2i(9, 72), "Tầng 3")
	entities.append_array([
		_entity("l3_sigil_crossfire_cache", "sigil", 60, 3),
		_entity("l3_sigil_camp_1", "sigil", 108, 14),
		_entity("l3_sigil_ring_cache", "sigil", 51, 56),
		_entity("l3_sigil_camp_2", "sigil", 108, 42),
		_entity("l3_sigil_final", "sigil", 78, 70),
		_entity("l3_checkpoint_floor_2", "checkpoint", 16, 42),
		_entity("l3_checkpoint_floor_3", "checkpoint", 16, 72),
		_entity("l3_exit", "exit_gate", 105, 71),
		_entity("l3_chest_line_of_fire", "chest", 68, 21, {"score_reward": 320}),
		_entity("l3_chest_ring", "chest", 35, 51, {"score_reward": 360}),
	])
	_add_entities(entities, "l3_spikes", "spikes", [
		Vector2i(35, 13), Vector2i(51, 7), Vector2i(51, 21), Vector2i(75, 13),
		Vector2i(37, 34), Vector2i(37, 50), Vector2i(69, 42), Vector2i(85, 48),
		Vector2i(39, 72), Vector2i(68, 63),
		Vector2i(88, 8), Vector2i(88, 20), Vector2i(95, 35), Vector2i(95, 50),
		Vector2i(51, 64), Vector2i(51, 78), Vector2i(78, 64), Vector2i(78, 78),
	])
	_add_entities(entities, "l3_torch", "torch", [
		Vector2i(17, 10), Vector2i(32, 6), Vector2i(70, 6), Vector2i(84, 7),
		Vector2i(18, 37), Vector2i(33, 32), Vector2i(64, 51), Vector2i(76, 33),
		Vector2i(108, 51), Vector2i(18, 67), Vector2i(36, 63), Vector2i(92, 66),
	])
	_add_entities(entities, "l3_coin", "coin", [
		Vector2i(23, 12), Vector2i(32, 13), Vector2i(51, 14), Vector2i(71, 13),
		Vector2i(25, 41), Vector2i(35, 42), Vector2i(64, 42), Vector2i(70, 42),
		Vector2i(25, 71), Vector2i(36, 71), Vector2i(82, 71), Vector2i(93, 71),
	])

	return {
		"id": "chapter_1_level_3",
		"output": "res://data/levels/chapter_1_level_3.json",
		"name": "Thư Khố Giao Hỏa",
		"width": 116,
		"height": 84,
		"decor_seed": 3,
		"required_sigils": 4,
		"layout_profile": "three_floor_crossfire_and_cover",
		"rooms": [
			_room("l3_f1_entry", 1, "safe_entry", 4, 7, 16, 12),
			_room("l3_f1_crossfire_hall", 1, "cover_lesson", 30, 4, 42, 20),
			_room("l3_f1_hidden_cache", 1, "optional_reward", 54, 1, 14, 6),
			_room("l3_f1_camp", 1, "combat_camp", 82, 5, 32, 18),
			_room("l3_f2_landing", 2, "safe_landing", 4, 35, 18, 14),
			_room("l3_f2_ring", 2, "cover_route", 32, 30, 34, 24),
			_room("l3_f2_hidden_reliquary", 2, "optional_reward", 45, 52, 14, 7),
			_room("l3_f2_camp", 2, "combat_camp", 74, 31, 40, 22),
			_room("l3_f3_landing", 3, "safe_landing", 4, 66, 18, 12),
			_room("l3_f3_camp", 3, "combat_camp", 34, 61, 46, 20),
			_room("l3_f3_exit", 3, "exit", 90, 64, 20, 15),
		],
		"corridors": [
			Rect2i(20, 11, 10, 4), Rect2i(72, 11, 10, 4),
			Rect2i(22, 40, 10, 4), Rect2i(66, 40, 8, 4),
			Rect2i(22, 70, 12, 4), Rect2i(80, 70, 10, 4),
		],
		"pits": [
			Rect2i(40, 8, 9, 5), Rect2i(54, 15, 9, 5),
			Rect2i(43, 37, 12, 10), Rect2i(86, 36, 5, 5), Rect2i(98, 43, 5, 5),
			Rect2i(48, 68, 16, 5),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l3_camp_1_far_anchors", 1, [82, 5, 32, 18], [82, 14], camp_1, "five_swordsmen_screen_two_reapers", true),
			_camp("l3_camp_2_pincer_fire", 2, [74, 31, 40, 22], [74, 42], camp_2, "five_swordsmen_push_between_two_reaper_angles", true),
			_camp("l3_camp_3_split_lane", 3, [34, 61, 46, 20], [34, 71], camp_3, "five_swordsmen_split_then_one_reaper_closes_the_lane", true),
		],
		"safe_zones": [
			_zone("l3_spawn_sanctuary", [4, 7, 16, 12], "spawn_and_reaper_read"),
			_zone("l3_floor_2_breather", [4, 35, 18, 14], "checkpoint_and_reset"),
			_zone("l3_floor_3_breather", [4, 66, 18, 12], "checkpoint_before_split_lane"),
		],
		"special_zones": [
			_zone("l3_optional_sigil_pair", [45, 1, 23, 58], "five_sigils_only_four_required"),
		],
		"metadata": {
			"objective": "Dùng hố làm vật che, áp sát các điểm neo Tử Thần và thu 4 trong 5 ấn ký.",
			"difficulty_tier": 3,
			"pacing": "three_six_member_packs_per_floor_with_ranged_crossfire",
			"density_cadence_anchor": _world_position(Vector2i(60, 10)),
			"roster_id": "chapter_1_level_3_roster",
			"encounter_pack_model": _pack_model(3),
		},
	}


func _level_4_definition() -> Dictionary:
	var entities: Array = []
	entities.append(_entity("player_spawn", "player", 8, 14))
	var camp_1_swords := ["l4_c1_skeleton_01", "l4_c1_skeleton_02", "l4_c1_skeleton_03", "l4_c1_skeleton_04"]
	var camp_1_reapers := ["l4_c1_reaper_01"]
	_add_enemy_group(entities, camp_1_swords, [Vector2i(90, 10), Vector2i(95, 17), Vector2i(101, 9), Vector2i(104, 19)], "skeleton", 34)
	_add_enemy_group(entities, camp_1_reapers, [Vector2i(106, 14)], "skeleton_reaper", 28)
	var camp_1 := camp_1_swords + camp_1_reapers
	var camp_2_swords := ["l4_c2_skeleton_01", "l4_c2_skeleton_02", "l4_c2_skeleton_03"]
	var camp_2_reapers := ["l4_c2_reaper_01", "l4_c2_reaper_02"]
	_add_enemy_group(entities, camp_2_swords, [Vector2i(56, 35), Vector2i(60, 41), Vector2i(56, 49)], "skeleton", 34)
	_add_enemy_group(entities, camp_2_reapers, [Vector2i(39, 34), Vector2i(61, 49)], "skeleton_reaper", 28)
	var camp_2 := camp_2_swords + camp_2_reapers
	var camp_3_swords := ["l4_c3_skeleton_01", "l4_c3_skeleton_02", "l4_c3_skeleton_03"]
	var camp_3_reapers := ["l4_c3_reaper_01", "l4_c3_reaper_02"]
	_add_enemy_group(entities, camp_3_swords, [Vector2i(42, 65), Vector2i(44, 76), Vector2i(72, 64)], "skeleton", 32)
	_add_enemy_group(entities, camp_3_reapers, [Vector2i(74, 76), Vector2i(58, 68)], "skeleton_reaper", 26)
	var camp_3 := camp_3_swords + camp_3_reapers

	_add_door_pair(entities, "l4_f1_f2", Vector2i(107, 21), Vector2i(9, 43), "Tầng 2")
	_add_door_pair(entities, "l4_f2_f3", Vector2i(107, 49), Vector2i(9, 72), "Tầng 3")
	entities.append_array([
		_entity("l4_sigil_spiral", "sigil", 70, 24),
		_entity("l4_sigil_camp_1", "sigil", 106, 8),
		_entity("l4_sigil_camp_2", "sigil", 62, 51),
		_entity("l4_sigil_camp_3", "sigil", 80, 70),
		_entity("l4_checkpoint_floor_2", "checkpoint", 16, 43),
		_entity("l4_checkpoint_floor_3", "checkpoint", 16, 72),
		_entity("l4_exit", "exit_gate", 105, 71),
		_entity("l4_chest_spiral", "chest", 31, 24, {"score_reward": 420}),
		_entity("l4_chest_pinwheel", "chest", 105, 33, {"score_reward": 460}),
	])
	_add_entities(entities, "l4_spikes", "spikes", [
		Vector2i(33, 6), Vector2i(50, 5), Vector2i(70, 7), Vector2i(70, 23),
		Vector2i(50, 25), Vector2i(31, 22), Vector2i(35, 42), Vector2i(67, 42),
		Vector2i(80, 33), Vector2i(104, 43), Vector2i(38, 72), Vector2i(68, 78),
		Vector2i(90, 7), Vector2i(52, 35), Vector2i(52, 50), Vector2i(92, 50),
		Vector2i(48, 62), Vector2i(48, 79), Vector2i(78, 64), Vector2i(78, 79),
		Vector2i(96, 70),
	])
	_add_entities(entities, "l4_torch", "torch", [
		Vector2i(17, 10), Vector2i(29, 13), Vector2i(74, 13), Vector2i(86, 7),
		Vector2i(18, 38), Vector2i(33, 33), Vector2i(63, 51), Vector2i(77, 32),
		Vector2i(108, 52), Vector2i(18, 67), Vector2i(36, 62), Vector2i(92, 66),
	])
	_add_entities(entities, "l4_coin", "coin", [
		Vector2i(23, 13), Vector2i(31, 13), Vector2i(39, 5), Vector2i(68, 5),
		Vector2i(74, 13), Vector2i(25, 42), Vector2i(34, 42), Vector2i(70, 42),
		Vector2i(25, 71), Vector2i(35, 71), Vector2i(84, 71), Vector2i(94, 71),
	])

	return {
		"id": "chapter_1_level_4",
		"output": "res://data/levels/chapter_1_level_4.json",
		"name": "Thánh Tích Xoắn Ốc",
		"width": 116,
		"height": 84,
		"decor_seed": 4,
		"required_sigils": 4,
		"layout_profile": "three_floor_spiral_pressure",
		"rooms": [
			_room("l4_f1_entry", 1, "safe_entry", 4, 8, 16, 12),
			_room("l4_f1_spiral", 1, "trap_route", 28, 3, 48, 24),
			_room("l4_f1_camp", 1, "combat_camp", 84, 5, 26, 20),
			_room("l4_f2_landing", 2, "safe_landing", 4, 36, 18, 14),
			_room("l4_f2_camp", 2, "combat_camp", 31, 31, 34, 22),
			_room("l4_f2_relay_ring", 2, "trap_route", 75, 30, 35, 24),
			_room("l4_f3_landing", 3, "safe_landing", 4, 66, 18, 12),
			_room("l4_f3_camp", 3, "combat_camp", 34, 60, 48, 21),
			_room("l4_f3_exit", 3, "exit", 90, 64, 20, 15),
		],
		"corridors": [
			Rect2i(20, 12, 8, 4), Rect2i(76, 12, 9, 4),
			Rect2i(22, 41, 9, 4), Rect2i(65, 41, 10, 4),
			Rect2i(22, 70, 12, 4), Rect2i(82, 70, 8, 4),
		],
		"pits": [
			Rect2i(36, 8, 32, 14), Rect2i(43, 36, 10, 12), Rect2i(83, 36, 19, 12),
			Rect2i(47, 64, 5, 7), Rect2i(62, 70, 5, 7),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l4_camp_1_spiral_release", 1, [84, 5, 26, 20], [84, 14], camp_1, "four_swordsmen_release_one_reaper_after_the_trap_loop", true),
			_camp("l4_camp_2_elite_pin", 2, [31, 31, 34, 22], [31, 42], camp_2, "three_swordsmen_pin_while_two_reapers_crossfire", true),
			_camp("l4_camp_3_broken_cross", 3, [34, 60, 48, 21], [34, 71], camp_3, "three_swordsmen_split_two_reapers_own_the_diagonals", true),
		],
		"safe_zones": [
			_zone("l4_spawn_sanctuary", [4, 8, 16, 12], "spawn_before_trap_read"),
			_zone("l4_floor_2_breather", [4, 36, 18, 14], "checkpoint_after_spiral"),
			_zone("l4_floor_3_breather", [4, 66, 18, 12], "checkpoint_before_final_camp"),
		],
		"special_zones": [
			_zone("l4_full_spiral_commitment", [28, 3, 48, 24], "sigil_forces_the_long_side_of_the_loop"),
		],
		"metadata": {
			"objective": "Đọc nhịp bẫy xoắn ốc, phá ba bãi tinh nhuệ và thu đủ 4 ấn ký.",
			"difficulty_tier": 4,
			"pacing": "four_six_member_packs_per_floor_through_dense_trap_fields",
			"roster_id": "chapter_1_level_4_roster",
			"encounter_pack_model": _pack_model(4),
		},
	}


func _level_5_definition() -> Dictionary:
	var entities: Array = []
	entities.append(_entity("player_spawn", "player", 8, 14))
	var camp_1_swords := ["l5_c1_skeleton_01", "l5_c1_skeleton_02", "l5_c1_skeleton_03", "l5_c1_skeleton_04"]
	var camp_1_reapers := ["l5_c1_reaper_01", "l5_c1_reaper_02"]
	_add_enemy_group(entities, camp_1_swords, [Vector2i(42, 12), Vector2i(50, 20), Vector2i(61, 9), Vector2i(68, 21)], "skeleton", 34)
	_add_enemy_group(entities, camp_1_reapers, [Vector2i(69, 8), Vector2i(39, 22)], "skeleton_reaper", 28)
	var camp_1 := camp_1_swords + camp_1_reapers
	var camp_2_swords := ["l5_c2_skeleton_01", "l5_c2_skeleton_02", "l5_c2_skeleton_03"]
	var camp_2_reapers := ["l5_c2_reaper_01", "l5_c2_reaper_02"]
	var camp_2_vampire := ["l5_c2_vampire"]
	_add_enemy_group(entities, camp_2_swords, [Vector2i(79, 39), Vector2i(88, 51), Vector2i(101, 37)], "skeleton", 32)
	_add_enemy_group(entities, camp_2_reapers, [Vector2i(108, 51), Vector2i(105, 42)], "skeleton_reaper", 26)
	_add_enemy_group(entities, camp_2_vampire, [Vector2i(93, 43)], "vampire", 24)
	var camp_2 := camp_2_swords + camp_2_reapers + camp_2_vampire
	var camp_3_swords := ["l5_c3_skeleton_01", "l5_c3_skeleton_02", "l5_c3_skeleton_03"]
	var camp_3_reapers := ["l5_c3_reaper_01"]
	_add_enemy_group(entities, camp_3_swords, [Vector2i(40, 70), Vector2i(49, 80), Vector2i(58, 69)], "skeleton", 30)
	_add_enemy_group(entities, camp_3_reapers, [Vector2i(59, 80)], "skeleton_reaper", 24)
	var camp_3 := camp_3_swords + camp_3_reapers
	var archer_id := "l5_hooded_archer_miniboss"
	entities.append(_entity(archer_id, "hooded_archer_miniboss", 95, 74, {"patrol": 24}))

	_add_door_pair(entities, "l5_f1_f2", Vector2i(110, 18), Vector2i(9, 46), "Tầng 2")
	_add_door_pair(entities, "l5_f2_f3", Vector2i(110, 54), Vector2i(9, 76), "Tầng 3")
	entities.append_array([
		_entity("l5_sigil_camp_1", "sigil", 72, 14),
		_entity("l5_sigil_blood_ring", "sigil", 55, 45),
		_entity("l5_sigil_vampire", "sigil", 110, 36),
		_entity("l5_sigil_last_guard", "sigil", 62, 73),
		_entity("l5_checkpoint_floor_2", "checkpoint", 16, 46),
		_entity("l5_checkpoint_before_boss", "checkpoint", 70, 76),
		_entity("l5_exit", "exit_gate", 112, 75),
		_entity("l5_chest_blood_ring", "chest", 35, 55, {"score_reward": 520}),
		_entity("l5_chest_boss_antechamber", "chest", 78, 83, {"score_reward": 600}),
	])
	_add_entities(entities, "l5_spikes", "spikes", [
		Vector2i(28, 14), Vector2i(45, 7), Vector2i(56, 23), Vector2i(78, 14),
		Vector2i(35, 38), Vector2i(35, 54), Vector2i(65, 45), Vector2i(75, 35),
		Vector2i(75, 53), Vector2i(52, 76), Vector2i(78, 76), Vector2i(83, 66),
		Vector2i(83, 84), Vector2i(108, 64),
		Vector2i(36, 7), Vector2i(62, 7), Vector2i(92, 9), Vector2i(94, 21),
		Vector2i(48, 38), Vector2i(48, 54), Vector2i(92, 44),
		Vector2i(42, 66), Vector2i(62, 83), Vector2i(102, 84),
	])
	_add_entities(entities, "l5_torch", "torch", [
		Vector2i(18, 10), Vector2i(35, 6), Vector2i(72, 6), Vector2i(87, 9),
		Vector2i(112, 22), Vector2i(18, 41), Vector2i(33, 35), Vector2i(60, 56),
		Vector2i(72, 34), Vector2i(112, 53), Vector2i(18, 71), Vector2i(34, 66),
		Vector2i(76, 65), Vector2i(112, 84),
	])
	_add_entities(entities, "l5_coin", "coin", [
		Vector2i(23, 14), Vector2i(31, 14), Vector2i(80, 14), Vector2i(92, 15),
		Vector2i(25, 45), Vector2i(33, 45), Vector2i(62, 45), Vector2i(68, 45),
		Vector2i(25, 75), Vector2i(33, 75), Vector2i(65, 75), Vector2i(75, 75),
		Vector2i(88, 75), Vector2i(104, 75),
	])

	return {
		"id": "chapter_1_level_5",
		"output": "res://data/levels/chapter_1_level_5.json",
		"name": "Lò Hiến Tế Huyết Cốt",
		"width": 120,
		"height": 88,
		"decor_seed": 5,
		"required_sigils": 4,
		"layout_profile": "three_floor_blood_crucible_boss_antechamber",
		"rooms": [
			_room("l5_f1_entry", 1, "safe_entry", 4, 8, 18, 13),
			_room("l5_f1_camp", 1, "combat_camp", 34, 4, 40, 24),
			_room("l5_f1_reliquary", 1, "breather", 84, 7, 31, 18),
			_room("l5_f2_landing", 2, "safe_landing", 4, 39, 18, 14),
			_room("l5_f2_blood_ring", 2, "route_choice", 32, 34, 30, 24),
			_room("l5_f2_camp", 2, "combat_camp", 70, 33, 45, 24),
			_room("l5_f3_landing", 3, "safe_landing", 4, 70, 18, 13),
			_room("l5_f3_last_guard", 3, "combat_camp", 32, 65, 32, 20),
			_room("l5_f3_boss_crucible", 3, "boss_arena", 74, 63, 42, 23),
		],
		"corridors": [
			Rect2i(22, 13, 12, 4), Rect2i(74, 13, 10, 4),
			Rect2i(22, 44, 10, 4), Rect2i(62, 44, 8, 4),
			Rect2i(22, 74, 10, 4), Rect2i(64, 74, 10, 4),
		],
		"pits": [
			Rect2i(46, 9, 5, 5), Rect2i(60, 17, 5, 5),
			Rect2i(42, 40, 10, 12), Rect2i(82, 38, 5, 5), Rect2i(98, 47, 5, 5),
			Rect2i(44, 71, 5, 6), Rect2i(86, 68, 5, 5), Rect2i(102, 79, 5, 5),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l5_camp_1_double_anchor", 1, [34, 4, 40, 24], [34, 15], camp_1, "four_swordsmen_between_two_reaper_anchors", true),
			_camp("l5_camp_2_blood_court", 2, [70, 33, 45, 24], [70, 45], camp_2, "three_swordsmen_two_reapers_and_the_unique_vampire", true),
			_camp("l5_camp_3_last_guard", 3, [32, 65, 32, 20], [32, 75], camp_3, "four_unit_guard_immediately_before_the_boss_breather", true),
		],
		"safe_zones": [
			_zone("l5_spawn_sanctuary", [4, 8, 18, 13], "spawn_before_first_six_unit_camp"),
			_zone("l5_floor_2_breather", [4, 39, 18, 14], "checkpoint_after_first_camp"),
			_zone("l5_boss_antechamber", [64, 72, 10, 8], "checkpoint_and_full_camera_read_before_boss"),
		],
		"special_zones": [
			{
				"id": "l5_hooded_archer_arena",
				"rect": [74, 63, 42, 23],
				"purpose": "hooded_archer_drops_base_archer_hero_soul_for_physical_pickup",
				"spawn_anchor_cell": [95, 74],
				"spawn_entity_id": archer_id,
				"status": "playable_required_miniboss",
			},
		],
		"metadata": {
			"objective": "Phá ba bãi hộ vệ, hạ Hooded Archer rồi tự tay nhặt Archer Hero Soul rơi ra.",
			"difficulty_tier": 5,
			"pacing": "6_enemy_camp_then_6_enemy_blood_court_then_4_enemy_guard_then_boss_arena",
			"roster_id": "chapter_1_level_5_roster",
			"required_miniboss_id": "hooded_archer_miniboss",
			"encounter_pack_model": _pack_model(5),
		},
	}


func _write_level(path: String, level: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("Cannot write %s" % path)
		return false
	file.store_string(JSON.stringify(level, "  ", false) + "\n")
	file.close()
	return true


func _pack_model(stage_level: int) -> Dictionary:
	return {
		"enabled": true,
		"profile_stage": stage_level,
		"floor_count": 3,
		"placement": "authored_camp_anchors",
		"authored_counts_are_anchors": true,
	}


func _room(id: String, floor: int, role: String, x: int, y: int, width: int, height: int) -> Dictionary:
	return {"id": id, "floor": floor, "role": role, "rect": Rect2i(x, y, width, height)}


func _entity(id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}) -> Dictionary:
	var result := {
		"id": id,
		"type": type,
		"position": [cell_x * 16 + 8, cell_y * 16 + 8],
	}
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _add_enemy_group(
		entities: Array,
		ids: Array,
		cells: Array,
		type: String,
		patrol: int,
) -> void:
	assert(ids.size() == cells.size())
	for index: int in ids.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity(String(ids[index]), type, cell.x, cell.y, {"patrol": patrol}))


func _add_entities(entities: Array, prefix: String, type: String, cells: Array) -> void:
	for index: int in cells.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity("%s_%02d" % [prefix, index + 1], type, cell.x, cell.y))


func _add_door_pair(
		entities: Array,
		pair_id: String,
		cell_a: Vector2i,
		cell_b: Vector2i,
		forward_label: String,
) -> void:
	var position_a := [cell_a.x * 16 + 8, cell_a.y * 16 + 8]
	var position_b := [cell_b.x * 16 + 8, cell_b.y * 16 + 8]
	entities.append(_entity(
		"door_%s_down" % pair_id,
		"floor_door",
		cell_a.x,
		cell_a.y,
		{
			"target_position": position_b,
			"label": forward_label,
			"message": "Nhấn chuột trái để đi tiếp",
		},
	))
	entities.append(_entity(
		"door_%s_up" % pair_id,
		"floor_door",
		cell_b.x,
		cell_b.y,
		{
			"target_position": position_a,
			"label": "Quay lại",
			"message": "Nhấn chuột trái để quay lại tầng trước",
		},
	))


func _camp(
		id: String,
		floor: int,
		rect: Array,
		entry_cell: Array,
		enemy_ids: Array,
		formation: String,
		breather_after: bool,
) -> Dictionary:
	return {
		"id": id,
		"floor": floor,
		"rect": rect,
		"entry_cell": entry_cell,
		"enemy_ids": enemy_ids,
		"formation": formation,
		"breather_after": breather_after,
	}


func _zone(id: String, rect: Array, purpose: String) -> Dictionary:
	return {"id": id, "rect": rect, "purpose": purpose}


func _world_position(cell: Vector2i) -> Array:
	return [cell.x * 16 + 8, cell.y * 16 + 8]
