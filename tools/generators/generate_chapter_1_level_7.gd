extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_7.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid Chapter 1 Level 7: %s" % validation.get("error", "unknown error"))
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
		"Generated chapter_1_level_7: %d floor, %d wall, %d decor, %d entities, %d waves"
		% [
			level.layers.Backdrop.size(),
			level.layers.Geometry.size(),
			level.layers.Decor.size(),
			level.entities.size(),
			(level.metadata.special_zones as Array).size(),
		]
	)
	quit(0)


func _level_definition() -> Dictionary:
	var entities: Array = [
		_entity("l7_player_spawn", "player", 48, 43),
		_entity("l7_soul_beacon", "soul_beacon", 48, 35),
		_entity("l7_beacon_core", "sigil", 48, 35),
		_entity("l7_checkpoint", "checkpoint", 48, 47),
		_entity("l7_exit", "exit_gate", 48, 7),
		_entity("l7_supply_chest", "chest", 48, 57, {"score_reward": 525}),
	]

	_add_enemy_group(entities, [
		"l7_w1_sword_01", "l7_w1_sword_02", "l7_w1_sword_03", "l7_w1_sword_04",
	], [
		Vector2i(12, 13), Vector2i(84, 13), Vector2i(12, 57), Vector2i(84, 57),
	], "skeleton", 24)
	_add_enemy_group(entities, ["l7_w1_reaper_01"], [Vector2i(9, 35)], "skeleton_reaper", 20)

	_add_enemy_group(entities, [
		"l7_w2_sword_01", "l7_w2_sword_02", "l7_w2_sword_03", "l7_w2_sword_04",
	], [
		Vector2i(35, 9), Vector2i(61, 9), Vector2i(35, 61), Vector2i(61, 61),
	], "skeleton", 24)
	_add_enemy_group(entities, ["l7_w2_reaper_01"], [Vector2i(87, 35)], "skeleton_reaper", 20)

	_add_enemy_group(entities, [
		"l7_w3_sword_01", "l7_w3_sword_02", "l7_w3_sword_03", "l7_w3_sword_04",
	], [
		Vector2i(8, 25), Vector2i(8, 45), Vector2i(88, 25), Vector2i(88, 45),
	], "skeleton", 24)
	_add_enemy_group(entities, [
		"l7_w3_reaper_01", "l7_w3_reaper_02",
	], [Vector2i(27, 8), Vector2i(69, 8)], "skeleton_reaper", 20)

	_add_entities(entities, "l7_torch", "torch", [
		Vector2i(40, 28), Vector2i(56, 28), Vector2i(40, 42), Vector2i(56, 42),
		Vector2i(20, 18), Vector2i(76, 18), Vector2i(20, 52), Vector2i(76, 52),
	])
	_add_entities(entities, "l7_spikes", "spikes", [
		Vector2i(31, 29), Vector2i(65, 29), Vector2i(31, 41), Vector2i(65, 41),
		Vector2i(48, 18), Vector2i(18, 35), Vector2i(78, 35),
		Vector2i(48, 52), Vector2i(48, 11),
	])
	_add_entities(entities, "l7_coin", "coin", [
		Vector2i(44, 46), Vector2i(48, 47), Vector2i(52, 46),
		Vector2i(44, 55), Vector2i(52, 55),
	])

	return {
		"id": "chapter_1_level_7",
		"name": "The Failing Beacon",
		"width": 96,
		"height": 70,
		"decor_seed": 7,
		"required_sigils": 1,
		"layout_profile": "open_four_lane_soul_beacon_defense",
		"rooms": [
			_room("l7_beacon_arena", 1, "soul_beacon_defense", 4, 4, 88, 62),
		],
		"corridors": [],
		"pits": [
			Rect2i(24, 21, 5, 5), Rect2i(67, 21, 5, 5),
			Rect2i(24, 45, 5, 5), Rect2i(67, 45, 5, 5),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l7_wave_1", [8, 8, 80, 50], [
				"l7_w1_sword_01", "l7_w1_sword_02", "l7_w1_sword_03", "l7_w1_sword_04", "l7_w1_reaper_01",
			], "four converging swords plus one western Bone Reaper"),
			_camp("l7_wave_2", [8, 8, 80, 54], [
				"l7_w2_sword_01", "l7_w2_sword_02", "l7_w2_sword_03", "l7_w2_sword_04", "l7_w2_reaper_01",
			], "north/south sword pressure plus one eastern Bone Reaper"),
			_camp("l7_wave_3", [7, 7, 82, 55], [
				"l7_w3_sword_01", "l7_w3_sword_02", "l7_w3_sword_03", "l7_w3_sword_04", "l7_w3_reaper_01", "l7_w3_reaper_02",
			], "two-sided sword collapse backed by two northern Bone Reapers"),
		],
		"safe_zones": [
			{"id": "l7_beacon_checkpoint", "rect": [41, 42, 15, 9], "purpose": "stable player respawn immediately behind the defended Beacon"},
		],
		"special_zones": [
			{"id": "l7_wave_1", "rect": [8, 8, 80, 50], "start_delay_seconds": 2.5},
			{"id": "l7_wave_2", "rect": [8, 8, 80, 54], "start_delay_seconds": 4.0},
			{"id": "l7_wave_3", "rect": [7, 7, 82, 55], "start_delay_seconds": 4.0},
		],
		"metadata": {
			"objective": "Protect the Soul Beacon through three timed mixed waves, then leave through the stabilized north gate.",
			"difficulty_tier": 7,
			"pacing": "short_read_in_then_three_escalating_beacon_waves",
			"roster_id": "chapter_1_level_7_roster",
			"encounter_pack_model": {
				"enabled": true,
				"profile_stage": 7,
				"floor_count": 1,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids": ["l7_wave_1", "l7_wave_2", "l7_wave_3"],
				"packs_per_floor_override": 3,
				"members_per_pack_override": 7,
				"allow_difficulty_extra_packs": false,
			},
			"beacon_entity_id": "l7_soul_beacon",
			"beacon_core_entity_id": "l7_beacon_core",
			"wave_count": 3,
			"authored_swords": 12,
			"authored_reapers": 4,
		},
	}


func _room(id: String, floor: int, role: String, x: int, y: int, width: int, height: int) -> Dictionary:
	return {"id": id, "floor": floor, "role": role, "rect": Rect2i(x, y, width, height)}


func _entity(id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}) -> Dictionary:
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


func _camp(id: String, rect: Array, enemy_ids: Array, composition: String) -> Dictionary:
	return {
		"id": id,
		"floor": 1,
		"rect": rect,
		"entry_cell": [48, 35],
		"enemy_ids": enemy_ids,
		"composition": composition,
		"elite_ready": true,
	}
