extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_6.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error(
			(
				"Refusing to write invalid Chapter 1 Level 6: %s"
				% validation.get("error", "unknown error")
			)
		)
		quit(1)
		return
	var file := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if file == null:
		push_error("Cannot write %s" % OUTPUT_PATH)
		quit(1)
		return
	file.store_string(JSON.stringify(level, "  ", false) + "\n")
	file.close()
	print(
		(
			"Generated chapter_1_level_6: %d floor, %d wall, %d decor, %d entities, %d camps"
			% [
				level.layers.Backdrop.size(),
				level.layers.Geometry.size(),
				level.layers.Decor.size(),
				level.entities.size(),
				level.metadata.combat_camps.size(),
			]
		)
	)
	quit(0)


func _level_definition() -> Dictionary:
	# Each floor has its own route cadence instead of repeating the campaign's
	# left-entry -> central-room -> right-exit band. Stable entity IDs remain
	# unchanged so encounters, saves, and objective runtimes keep their contract.
	var entities: Array = [_entity("l6_player_spawn", "player", 9, 23)]

	var camp_1_swords := ["l6_c1_skeleton_01", "l6_c1_skeleton_02", "l6_c1_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_1_swords,
		[Vector2i(50, 19), Vector2i(61, 9), Vector2i(72, 19)],
		"skeleton",
		32,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_01"], [Vector2i(69, 14)], "skeleton_reaper", 8)
	var camp_1 := camp_1_swords + ["l6_soul_anchor_01"]

	var camp_2_swords := ["l6_c2_skeleton_01", "l6_c2_skeleton_02", "l6_c2_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_2_swords,
		[Vector2i(42, 39), Vector2i(42, 50), Vector2i(75, 39)],
		"skeleton",
		30,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_02"], [Vector2i(73, 49)], "skeleton_reaper", 8)
	var camp_2 := camp_2_swords + ["l6_soul_anchor_02"]

	var camp_3_swords := ["l6_c3_skeleton_01", "l6_c3_skeleton_02", "l6_c3_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_3_swords,
		[Vector2i(45, 68), Vector2i(45, 81), Vector2i(75, 68)],
		"skeleton",
		28,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_03"], [Vector2i(75, 81)], "skeleton_reaper", 8)
	var camp_3 := camp_3_swords + ["l6_soul_anchor_03"]

	_add_door_pair(entities, "l6_f1_f2", Vector2i(108, 15), Vector2i(10, 46), "Floor 2")
	_add_door_pair(entities, "l6_f2_f3", Vector2i(108, 45), Vector2i(106, 74), "Floor 3")
	(
		entities
		. append_array(
			[
				_entity("l6_anchor_core_01", "sigil", 74, 14),
				_entity("l6_anchor_core_02", "sigil", 78, 49),
				_entity("l6_anchor_core_03", "sigil", 79, 81),
				_entity("l6_checkpoint_floor_2", "checkpoint", 16, 46),
				_entity("l6_checkpoint_floor_3", "checkpoint", 102, 74),
				_entity("l6_exit", "exit_gate", 12, 75),
				_entity("l6_chest_floor_1", "chest", 101, 9, {"score_reward": 420}),
				_entity("l6_chest_floor_2", "chest", 102, 44, {"score_reward": 460}),
			]
		)
	)
	_add_entities(
		entities,
		"l6_spikes",
		"spikes",
		[
			Vector2i(48, 22),
			Vector2i(55, 22),
			Vector2i(63, 22),
			Vector2i(73, 7),
			Vector2i(48, 7),
			Vector2i(57, 7),
			Vector2i(66, 20),
			Vector2i(76, 20),
			Vector2i(44, 36),
			Vector2i(50, 36),
			Vector2i(68, 36),
			Vector2i(74, 36),
			Vector2i(44, 53),
			Vector2i(50, 53),
			Vector2i(68, 53),
			Vector2i(74, 53),
			Vector2i(45, 65),
			Vector2i(50, 65),
			Vector2i(73, 65),
			Vector2i(78, 65),
			Vector2i(45, 83),
			Vector2i(50, 83),
			Vector2i(73, 83),
			Vector2i(78, 83),
		]
	)
	_add_entities(
		entities,
		"l6_torch",
		"torch",
		[
			Vector2i(14, 19),
			Vector2i(47, 6),
			Vector2i(77, 6),
			Vector2i(93, 6),
			Vector2i(7, 41),
			Vector2i(43, 34),
			Vector2i(75, 34),
			Vector2i(96, 39),
			Vector2i(7, 69),
			Vector2i(42, 65),
			Vector2i(81, 65),
			Vector2i(98, 68),
		]
	)
	_add_entities(
		entities,
		"l6_coin",
		"coin",
		[
			Vector2i(27, 22),
			Vector2i(33, 18),
			Vector2i(40, 15),
			Vector2i(85, 12),
			Vector2i(27, 46),
			Vector2i(47, 45),
			Vector2i(70, 45),
			Vector2i(88, 45),
			Vector2i(30, 74),
			Vector2i(47, 74),
			Vector2i(73, 74),
			Vector2i(89, 73),
		]
	)

	return {
		"id": "chapter_1_level_6",
		"name": "Two Souls, One Path",
		"width": 120,
		"height": 88,
		"decor_seed": 6,
		"required_sigils": 3,
		"layout_profile": "three_floor_soul_anchor_relay_lesson",
		"rooms":
		[
			_room("l6_f1_entry", 1, "safe_entry", 4, 17, 18, 12),
			_room("l6_f1_anchor", 1, "soul_anchor_camp", 45, 4, 34, 22),
			_room("l6_f1_relay_breather", 1, "relay_breather", 91, 4, 24, 20),
			_room("l6_f2_landing", 2, "safe_landing", 4, 39, 18, 15),
			_room("l6_f2_anchor", 2, "split_diamond_anchor_camp", 35, 32, 48, 26),
			_room("l6_f2_relay_breather", 2, "relay_breather", 94, 37, 21, 18),
			_room("l6_f3_landing", 3, "safe_landing", 96, 66, 19, 16),
			_room("l6_f3_anchor", 3, "return_loop_anchor_camp", 40, 63, 43, 23),
			_room("l6_f3_exit", 3, "exit", 4, 67, 24, 17),
		],
		"corridors":
		[
			Rect2i(22, 20, 13, 5),
			Rect2i(30, 14, 6, 11),
			Rect2i(36, 13, 9, 5),
			Rect2i(79, 10, 12, 5),
			Rect2i(22, 44, 13, 5),
			Rect2i(83, 43, 11, 5),
			Rect2i(83, 71, 13, 5),
			Rect2i(24, 72, 16, 5),
		],
		"pits":
		[
			Rect2i(35, 32, 6, 4),
			Rect2i(77, 32, 6, 4),
			Rect2i(35, 54, 6, 4),
			Rect2i(77, 54, 6, 4),
			Rect2i(53, 41, 12, 8),
			Rect2i(54, 70, 15, 9),
		],
		"entities": entities,
		"combat_camps":
		[
			_camp(
				"l6_camp_1_first_anchor",
				1,
				[45, 4, 34, 22],
				[45, 17],
				camp_1,
				"a stepped northeast approach opens into the first guarded Anchor"
			),
			_camp(
				"l6_camp_2_return_relay",
				2,
				[35, 32, 48, 26],
				[35, 45],
				camp_2,
				"a split diamond offers north and south lanes for reverse Relay practice"
			),
			_camp(
				"l6_camp_3_mastery_check",
				3,
				[40, 63, 43, 23],
				[82, 74],
				camp_3,
				"an east-to-west return loop circles the final Anchor before the exit"
			),
		],
		"safe_zones":
		[
			_zone(
				"l6_spawn_sanctuary",
				[4, 17, 18, 12],
				"read the Sword-to-Archer Relay objective before the stepped ascent"
			),
			_zone(
				"l6_floor_2_breather",
				[4, 39, 18, 15],
				"checkpoint before choosing either split-diamond lane"
			),
			_zone(
				"l6_floor_3_breather",
				[96, 66, 19, 16],
				"east-side checkpoint before the final return loop"
			),
		],
		"special_zones":
		[
			_anchor_zone(1, [64, 9, 15, 12]),
			_anchor_zone(2, [68, 44, 15, 12]),
			_anchor_zone(3, [70, 76, 13, 10]),
		],
		"metadata":
		{
			"objective":
			"Break three guarded Soul Anchor manifestations, collect their cores, and practice Relay in both directions.",
			"difficulty_tier": 6,
			"pacing": "stepped_first_anchor_split_diamond_reverse_relay_and_return_loop",
			"roster_id": "chapter_1_level_6_roster",
			"encounter_pack_model":
			{
				"enabled": true,
				"profile_stage": 6,
				"floor_count": 3,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids":
				[
					"l6_camp_1_first_anchor",
					"l6_camp_2_return_relay",
					"l6_camp_3_mastery_check",
				],
			},
			"relay_lesson":
			{
				"tracked_events":
				["relay_sword_hero_to_archer_hero", "relay_archer_hero_to_sword_hero"],
				"mandatory_for_exit": false,
				"reason":
				"Tutorial tracking must never strand a player after the final enemy dies.",
			},
			"campaign_ready_blockers":
			[
				"The Level 5 Archer Soul must be physically collected before Archer can be placed in the Soul Team.",
			],
		},
	}


func _room(
	id: String, floor: int, role: String, x: int, y: int, width: int, height: int
) -> Dictionary:
	return {"id": id, "floor": floor, "role": role, "rect": Rect2i(x, y, width, height)}


func _entity(
	id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}
) -> Dictionary:
	var result := {"id": id, "type": type, "position": [cell_x * 16 + 8, cell_y * 16 + 8]}
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _add_enemy_group(entities: Array, ids: Array, cells: Array, type: String, patrol: int) -> void:
	assert(ids.size() == cells.size())
	for index: int in ids.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity(String(ids[index]), type, cell.x, cell.y, {"patrol": patrol}))


func _add_entities(entities: Array, prefix: String, type: String, cells: Array) -> void:
	for index: int in cells.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity("%s_%02d" % [prefix, index + 1], type, cell.x, cell.y))


func _add_door_pair(
	entities: Array, pair_id: String, cell_a: Vector2i, cell_b: Vector2i, label: String
) -> void:
	var position_a := [cell_a.x * 16 + 8, cell_a.y * 16 + 8]
	var position_b := [cell_b.x * 16 + 8, cell_b.y * 16 + 8]
	(
		entities
		. append(
			_entity(
				"door_%s_down" % pair_id,
				"floor_door",
				cell_a.x,
				cell_a.y,
				{
					"target_position": position_b,
					"label": label,
					"message": "Nhấn chuột trái để đi tiếp",
				}
			)
		)
	)
	(
		entities
		. append(
			_entity(
				"door_%s_up" % pair_id,
				"floor_door",
				cell_b.x,
				cell_b.y,
				{
					"target_position": position_a,
					"label": "Previous floor",
					"message": "Nhấn chuột trái để quay lại tầng trước",
				}
			)
		)
	)


func _camp(
	id: String, floor: int, rect: Array, entry: Array, enemy_ids: Array, composition: String
) -> Dictionary:
	return {
		"id": id,
		"floor": floor,
		"rect": rect,
		"entry_cell": entry,
		"enemy_ids": enemy_ids,
		"composition": composition,
		"elite_ready": true,
	}


func _zone(id: String, rect: Array, purpose: String) -> Dictionary:
	return {"id": id, "rect": rect, "purpose": purpose}


func _anchor_zone(index: int, rect: Array) -> Dictionary:
	return {
		"id": "l6_soul_anchor_zone_%02d" % index,
		"rect": rect,
		"anchor_enemy_id": "l6_soul_anchor_%02d" % index,
		"core_entity_id": "l6_anchor_core_%02d" % index,
		"defeat_event_id": "soul_anchor_destroyed",
		"asset_strategy":
		"existing Bone Reaper manifestation plus licensed sigil core and torch ring",
	}
