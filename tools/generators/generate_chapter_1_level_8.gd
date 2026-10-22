extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const ELITE_MODIFIER = preload("res://data/content/elite_modifiers/triple_stat_elite.tres")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_8.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid Chapter 1 Level 8: %s" % validation.get("error", "unknown error"))
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
		"Generated chapter_1_level_8: %d floor, %d wall, %d decor, %d entities, two exclusive branches"
		% [
			level.layers.Backdrop.size(),
			level.layers.Geometry.size(),
			level.layers.Decor.size(),
			level.entities.size(),
		]
	)
	quit(0)


func _level_definition() -> Dictionary:
	var reaper_ids := [
		"l8_reaper_01", "l8_reaper_02", "l8_reaper_03",
		"l8_reaper_04", "l8_reaper_05", "l8_reaper_06",
	]
	var vampire_ids := ["l8_vampire_01", "l8_vampire_02", "l8_vampire_03"]
	var approach_ids := [
		"l8_approach_skeleton", "l8_approach_reaper", "l8_approach_vampire",
	]
	var entities: Array = [
		_entity("l8_player_spawn", "player", 52, 67),
		_entity("l8_checkpoint", "checkpoint", 52, 63),
		_entity("l8_reaper_seal", "reliquary_branch_seal", 40, 50, {
			"branch_id": "reaper",
			"display_name": "REAPER RELIC",
			"interaction_message": "Nhấn chuột trái để chọn nhánh Tử Thần (6 quái). Nhánh Ma Cà Rồng sẽ bị khóa.",
		}),
		_entity("l8_vampire_seal", "reliquary_branch_seal", 64, 50, {
			"branch_id": "vampire",
			"display_name": "VAMPIRE RELIC",
			"interaction_message": "Nhấn chuột trái để chọn nhánh Ma Cà Rồng (3 quái). Nhánh Tử Thần sẽ bị khóa.",
		}),
		_entity("l8_elite_chest", "chest", 52, 13, {
			"score_reward": 800,
			"contains_sigil": true,
			"interaction_message": "Nhấn chuột trái để mở Rương Thánh Tích Tinh Nhuệ.",
		}),
		_entity("l8_exit", "exit_gate", 52, 7),
	]
	_add_enemy_group(entities, [approach_ids[0]], [Vector2i(45, 54)], "skeleton", 22)
	_add_enemy_group(entities, [approach_ids[1]], [Vector2i(52, 50)], "skeleton_reaper", 20)
	_add_enemy_group(entities, [approach_ids[2]], [Vector2i(59, 54)], "vampire", 24)
	_add_enemy_group(entities, reaper_ids, [
		Vector2i(14, 26), Vector2i(25, 25), Vector2i(35, 27),
		Vector2i(14, 39), Vector2i(25, 42), Vector2i(35, 39),
	], "skeleton_reaper", 34)
	_add_enemy_group(entities, vampire_ids, [
		Vector2i(69, 26), Vector2i(86, 33), Vector2i(69, 41),
	], "vampire", 42)
	_add_entities(entities, "l8_torch", "torch", [
		Vector2i(45, 59), Vector2i(59, 59), Vector2i(38, 46), Vector2i(66, 46),
		Vector2i(9, 21), Vector2i(39, 21), Vector2i(65, 21), Vector2i(95, 21),
		Vector2i(46, 9), Vector2i(58, 9),
	])
	_add_entities(entities, "l8_coin", "coin", [
		Vector2i(48, 62), Vector2i(52, 60), Vector2i(56, 62),
		Vector2i(20, 34), Vector2i(31, 34), Vector2i(73, 34), Vector2i(84, 34),
	])
	_add_entities(entities, "l8_spikes", "spikes", [
		Vector2i(20, 29), Vector2i(31, 38), Vector2i(73, 29), Vector2i(84, 38),
		Vector2i(37, 50), Vector2i(67, 50), Vector2i(48, 55),
		Vector2i(56, 55), Vector2i(52, 18),
	])

	var branch_enemy_ids: Array = []
	branch_enemy_ids.append_array(reaper_ids)
	branch_enemy_ids.append_array(vampire_ids)
	return {
		"id": "chapter_1_level_8",
		"name": "The Divided Reliquary",
		"width": 104,
		"height": 76,
		"decor_seed": 8,
		"required_sigils": 1,
		"layout_profile": "divided_reliquary_exclusive_branch",
		"rooms": [
			_room("l8_south_approach", "safe_approach", 43, 58, 18, 14),
			_room("l8_choice_hall", "exclusive_branch_choice", 38, 44, 28, 17),
			_room("l8_reaper_hall", "reaper_branch", 5, 17, 38, 36),
			_room("l8_vampire_hall", "vampire_branch", 61, 17, 38, 36),
			_room("l8_elite_vault", "elite_chest_exit", 43, 4, 18, 17),
		],
		"corridors": [
			Rect2i(36, 47, 8, 7), Rect2i(60, 47, 8, 7),
			Rect2i(35, 12, 10, 9), Rect2i(59, 12, 10, 9),
			Rect2i(49, 54, 6, 8),
		],
		"pits": [
			Rect2i(22, 31, 5, 5), Rect2i(77, 31, 5, 5),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l8_reliquary_approach", [42, 47, 20, 10], approach_ids, "three non-objective approach anchors seed the roaming pack families before the irreversible branch choice"),
			_camp("l8_reaper_branch", [7, 19, 34, 32], reaper_ids, "six Bone Reapers; first selected marker receives the authored Elite pressure axes"),
			_camp("l8_vampire_branch", [63, 19, 34, 32], vampire_ids, "three Blood Vampires; first selected marker receives the authored Elite pressure axes"),
		],
		"safe_zones": [
			{"id": "l8_choice_checkpoint", "rect": [44, 58, 16, 12], "purpose": "stable approach before the irreversible physical branch choice"},
		],
		"special_zones": [
			{"id": "l8_reaper_seal_zone", "rect": [36, 46, 8, 9], "branch_id": "reaper"},
			{"id": "l8_vampire_seal_zone", "rect": [60, 46, 8, 9], "branch_id": "vampire"},
			{"id": "l8_elite_chest_zone", "rect": [45, 5, 14, 14], "requires_branch_clear": true},
		],
		"metadata": {
			"objective": "Physically bind one branch, defeat only that branch and its Elite guardian, then interact with the unsealed chest before exiting.",
			"difficulty_tier": 8,
			"pacing": "choice_read_then_exclusive_elite_hunt_then_manual_chest_claim",
			"roster_id": "chapter_1_level_8_roster",
			"encounter_pack_model": {
				"enabled": true,
				"profile_stage": 8,
				"floor_count": 1,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids": ["l8_reliquary_approach"],
				"packs_per_floor_override": 3,
				"members_per_pack_override": 7,
			},
			"branch_enemy_ids": branch_enemy_ids,
			"reaper_enemy_ids": reaper_ids,
			"vampire_enemy_ids": vampire_ids,
			"reaper_seal_id": "l8_reaper_seal",
			"vampire_seal_id": "l8_vampire_seal",
			"elite_chest_id": "l8_elite_chest",
			"selected_branch_elite_count": 1,
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
		"entry_cell": [52, 50],
		"enemy_ids": enemy_ids,
		"composition": composition,
		"elite_ready": true,
	}
