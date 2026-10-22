extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/crimson_reaper_elite.tres")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_9.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid Chapter 1 Level 9: %s" % validation.get("error", "unknown error"))
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
		"Generated chapter_1_level_9: %d floor, %d wall, %d decor, %d entities, 3 physical seals + 1 deferred named Elite"
		% [level.layers.Backdrop.size(), level.layers.Geometry.size(), level.layers.Decor.size(), level.entities.size()]
	)
	quit(0)


func _level_definition() -> Dictionary:
	var seal_ids := ["l9_west_gate_seal", "l9_east_gate_seal", "l9_north_gate_seal"]
	var approach_ids := [
		"l9_approach_skeleton", "l9_approach_reaper", "l9_approach_vampire",
	]
	var entities: Array = [
		_entity("l9_player_spawn", "player", 48, 68),
		_entity("l9_checkpoint", "checkpoint", 48, 65),
		_entity(seal_ids[0], "gate_seal", 18, 45, {
			"seal_id": seal_ids[0],
			"display_name": "WEST GATE SEAL",
			"interaction_message": "Nhấn chuột trái để phá Ấn Cổng Tây (1/3).",
		}),
		_entity(seal_ids[1], "gate_seal", 78, 45, {
			"seal_id": seal_ids[1],
			"display_name": "EAST GATE SEAL",
			"interaction_message": "Nhấn chuột trái để phá Ấn Cổng Đông (2/3).",
		}),
		_entity(seal_ids[2], "gate_seal", 48, 32, {
			"seal_id": seal_ids[2],
			"display_name": "NORTH GATE SEAL",
			"interaction_message": "Nhấn chuột trái để phá Ấn Cổng Bắc (3/3).",
		}),
		_entity("l9_crimson_reaper", "crimson_reaper", 48, 15, {"patrol": 44}),
		_entity("l9_exit", "exit_gate", 48, 7),
		_entity(approach_ids[0], "skeleton", 40, 55, {"patrol": 24}),
		_entity(approach_ids[1], "skeleton_reaper", 48, 47, {"patrol": 22}),
		_entity(approach_ids[2], "vampire", 56, 55, {"patrol": 26}),
	]
	_add_entities(entities, "l9_torch", "torch", [
		Vector2i(43, 66), Vector2i(53, 66), Vector2i(39, 56), Vector2i(57, 56),
		Vector2i(11, 40), Vector2i(25, 50), Vector2i(71, 50), Vector2i(85, 40),
		Vector2i(41, 27), Vector2i(55, 27), Vector2i(39, 10), Vector2i(57, 10),
	])
	_add_entities(entities, "l9_coin", "coin", [
		Vector2i(44, 61), Vector2i(52, 61), Vector2i(32, 48), Vector2i(64, 48),
		Vector2i(25, 42), Vector2i(71, 42), Vector2i(44, 24), Vector2i(52, 24),
	])
	_add_entities(entities, "l9_spikes", "spikes", [
		Vector2i(29, 45), Vector2i(67, 45), Vector2i(43, 38), Vector2i(53, 38),
		Vector2i(42, 17), Vector2i(54, 17),
		Vector2i(40, 52), Vector2i(56, 52), Vector2i(48, 57), Vector2i(48, 27),
	])
	return {
		"id": "chapter_1_level_9",
		"name": "The Crimson Gate",
		"width": 96,
		"height": 78,
		"decor_seed": 9,
		"required_sigils": 3,
		"layout_profile": "crimson_gate_three_seal_hunt",
		"rooms": [
			_room("l9_south_approach", "safe_approach", 40, 61, 16, 13),
			_room("l9_central_nave", "seal_hunt_hub", 35, 43, 26, 20),
			_room("l9_west_seal_chamber", "west_gate_seal", 6, 36, 30, 18),
			_room("l9_east_seal_chamber", "east_gate_seal", 60, 36, 30, 18),
			_room("l9_north_seal_chamber", "north_gate_seal", 36, 25, 24, 18),
			_room("l9_crimson_arena", "named_elite_and_exit", 32, 4, 32, 22),
		],
		"corridors": [
			Rect2i(46, 57, 4, 8),
			Rect2i(30, 46, 8, 5), Rect2i(58, 46, 8, 5),
			Rect2i(46, 39, 4, 8), Rect2i(46, 20, 4, 10),
		],
		"pits": [Rect2i(13, 43, 4, 4), Rect2i(79, 43, 4, 4)],
		"entities": entities,
		"combat_camps": [
			{
				"id": "l9_gate_approach",
				"floor": 1,
				"rect": [37, 44, 22, 17],
				"entry_cell": [48, 59],
				"enemy_ids": approach_ids,
				"composition": "three non-objective family anchors establish roaming packs before the seal wings",
				"elite_ready": true,
			},
			{
				"id": "l9_crimson_reaper_showdown",
				"floor": 1,
				"rect": [34, 6, 28, 18],
				"entry_cell": [48, 24],
				"enemy_ids": ["l9_crimson_reaper"],
				"composition": "one dedicated Crimson Reaper runtime identity; deferred until all three physical seals; deterministic named Elite pressure axes",
				"elite_ready": true,
			},
		],
		"safe_zones": [
			{"id": "l9_entry_checkpoint", "rect": [41, 62, 14, 11], "purpose": "stable entry before the three-wing seal hunt"},
		],
		"special_zones": [
			{"id": "l9_west_seal_zone", "rect": [12, 39, 12, 12], "seal_id": seal_ids[0]},
			{"id": "l9_east_seal_zone", "rect": [72, 39, 12, 12], "seal_id": seal_ids[1]},
			{"id": "l9_north_seal_zone", "rect": [42, 27, 12, 12], "seal_id": seal_ids[2]},
			{"id": "l9_crimson_arena_zone", "rect": [34, 6, 28, 18], "requires_all_gate_seals": true},
		],
		"metadata": {
			"objective": "Physically break all three Gate Seals, defeat the awakened Elite Crimson Reaper, then enter the north portal.",
			"difficulty_tier": 9,
			"pacing": "three_wing_exploration_then_named_elite_showdown",
			"roster_id": "chapter_1_level_9_roster",
			"encounter_pack_model": {
				"enabled": true,
				"profile_stage": 9,
				"floor_count": 1,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids": ["l9_gate_approach"],
				"packs_per_floor_override": 3,
				"members_per_pack_override": 8,
			},
			"gate_seal_ids": seal_ids,
			"crimson_reaper_id": "l9_crimson_reaper",
			"named_elite_count": 1,
			"elite_combat_axes": ELITE_MODIFIER.get_combat_axes(),
		},
	}


func _room(id: String, role: String, x: int, y: int, width: int, height: int) -> Dictionary:
	return {"id": id, "floor": 1, "role": role, "rect": Rect2i(x, y, width, height)}


func _entity(id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}) -> Dictionary:
	var result := {"id": id, "type": type, "position": [cell_x * 16 + 8, cell_y * 16 + 8]}
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _add_entities(entities: Array, prefix: String, type: String, cells: Array) -> void:
	for index: int in cells.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity("%s_%02d" % [prefix, index + 1], type, cell.x, cell.y))
