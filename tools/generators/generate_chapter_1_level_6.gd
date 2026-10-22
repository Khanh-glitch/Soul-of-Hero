extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_6.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid Chapter 1 Level 6: %s" % validation.get("error", "unknown error"))
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
		"Generated chapter_1_level_6: %d floor, %d wall, %d decor, %d entities, %d camps"
		% [
			level.layers.Backdrop.size(),
			level.layers.Geometry.size(),
			level.layers.Decor.size(),
			level.entities.size(),
			level.metadata.combat_camps.size(),
		]
	)
	quit(0)


func _level_definition() -> Dictionary:
	var entities: Array = [_entity("l6_player_spawn", "player", 8, 14)]

	var camp_1_swords := ["l6_c1_skeleton_01", "l6_c1_skeleton_02", "l6_c1_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_1_swords,
		[Vector2i(42, 10), Vector2i(49, 21), Vector2i(62, 10)],
		"skeleton",
		32,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_01"], [Vector2i(66, 21)], "skeleton_reaper", 8)
	var camp_1 := camp_1_swords + ["l6_soul_anchor_01"]

	var camp_2_swords := ["l6_c2_skeleton_01", "l6_c2_skeleton_02", "l6_c2_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_2_swords,
		[Vector2i(42, 39), Vector2i(51, 51), Vector2i(64, 39)],
		"skeleton",
		30,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_02"], [Vector2i(67, 50)], "skeleton_reaper", 8)
	var camp_2 := camp_2_swords + ["l6_soul_anchor_02"]

	var camp_3_swords := ["l6_c3_skeleton_01", "l6_c3_skeleton_02", "l6_c3_skeleton_03"]
	_add_enemy_group(
		entities,
		camp_3_swords,
		[Vector2i(42, 69), Vector2i(51, 81), Vector2i(63, 69)],
		"skeleton",
		28,
	)
	_add_enemy_group(entities, ["l6_soul_anchor_03"], [Vector2i(67, 80)], "skeleton_reaper", 8)
	var camp_3 := camp_3_swords + ["l6_soul_anchor_03"]

	_add_door_pair(entities, "l6_f1_f2", Vector2i(110, 18), Vector2i(9, 46), "Floor 2")
	_add_door_pair(entities, "l6_f2_f3", Vector2i(110, 49), Vector2i(9, 76), "Floor 3")
	entities.append_array([
		_entity("l6_anchor_core_01", "sigil", 72, 21),
		_entity("l6_anchor_core_02", "sigil", 72, 50),
		_entity("l6_anchor_core_03", "sigil", 72, 80),
		_entity("l6_checkpoint_floor_2", "checkpoint", 16, 46),
		_entity("l6_checkpoint_floor_3", "checkpoint", 16, 76),
		_entity("l6_exit", "exit_gate", 108, 75),
		_entity("l6_chest_floor_1", "chest", 93, 14, {"score_reward": 420}),
		_entity("l6_chest_floor_2", "chest", 94, 46, {"score_reward": 460}),
	])
	_add_entities(entities, "l6_spikes", "spikes", [
		Vector2i(28, 14), Vector2i(36, 12), Vector2i(40, 18), Vector2i(47, 7),
		Vector2i(51, 9), Vector2i(58, 23), Vector2i(63, 7), Vector2i(69, 14),
		Vector2i(28, 46), Vector2i(36, 41), Vector2i(40, 50), Vector2i(47, 36),
		Vector2i(52, 36), Vector2i(58, 54), Vector2i(63, 36), Vector2i(69, 43),
		Vector2i(28, 76), Vector2i(36, 70), Vector2i(40, 80), Vector2i(47, 67),
		Vector2i(51, 67), Vector2i(60, 83), Vector2i(63, 82), Vector2i(69, 72),
	])
	_add_entities(entities, "l6_torch", "torch", [
		Vector2i(38, 7), Vector2i(38, 24), Vector2i(64, 17), Vector2i(70, 24),
		Vector2i(38, 36), Vector2i(38, 54), Vector2i(65, 46), Vector2i(71, 54),
		Vector2i(38, 67), Vector2i(38, 83), Vector2i(65, 76), Vector2i(71, 83),
	])
	_add_entities(entities, "l6_coin", "coin", [
		Vector2i(23, 14), Vector2i(31, 14), Vector2i(82, 14), Vector2i(101, 14),
		Vector2i(23, 46), Vector2i(31, 46), Vector2i(82, 46), Vector2i(102, 46),
		Vector2i(23, 76), Vector2i(31, 76), Vector2i(84, 75), Vector2i(98, 75),
	])

	return {
		"id": "chapter_1_level_6",
		"name": "Two Souls, One Path",
		"width": 120,
		"height": 88,
		"decor_seed": 6,
		"required_sigils": 3,
		"layout_profile": "three_floor_soul_anchor_relay_lesson",
		"rooms": [
			_room("l6_f1_entry", 1, "safe_entry", 4, 8, 18, 13),
			_room("l6_f1_anchor", 1, "soul_anchor_camp", 34, 4, 42, 24),
			_room("l6_f1_relay_breather", 1, "relay_breather", 84, 7, 31, 18),
			_room("l6_f2_landing", 2, "safe_landing", 4, 39, 18, 14),
			_room("l6_f2_anchor", 2, "soul_anchor_camp", 34, 33, 42, 24),
			_room("l6_f2_relay_breather", 2, "relay_breather", 84, 36, 31, 18),
			_room("l6_f3_landing", 3, "safe_landing", 4, 70, 18, 13),
			_room("l6_f3_anchor", 3, "soul_anchor_camp", 34, 65, 42, 20),
			_room("l6_f3_exit", 3, "exit", 84, 65, 31, 20),
		],
		"corridors": [
			Rect2i(22, 13, 12, 4), Rect2i(76, 13, 8, 4),
			Rect2i(22, 44, 12, 4), Rect2i(76, 44, 8, 4),
			Rect2i(22, 74, 12, 4), Rect2i(76, 74, 8, 4),
		],
		"pits": [
			Rect2i(53, 13, 6, 6), Rect2i(53, 43, 6, 6), Rect2i(53, 73, 6, 6),
		],
		"entities": entities,
		"combat_camps": [
			_camp("l6_camp_1_first_anchor", 1, [34, 4, 42, 24], [34, 15], camp_1, "three guards screen the first stationary Anchor manifestation"),
			_camp("l6_camp_2_return_relay", 2, [34, 33, 42, 24], [34, 45], camp_2, "second Anchor encourages the reverse Relay direction"),
			_camp("l6_camp_3_mastery_check", 3, [34, 65, 42, 20], [34, 75], camp_3, "final four-unit Anchor cluster checks the learned rhythm"),
		],
		"safe_zones": [
			_zone("l6_spawn_sanctuary", [4, 8, 18, 13], "read the Sword-to-Archer Relay objective"),
			_zone("l6_floor_2_breather", [4, 39, 18, 14], "checkpoint before reverse Relay practice"),
			_zone("l6_floor_3_breather", [4, 70, 18, 13], "checkpoint before final Anchor"),
		],
		"special_zones": [
			_anchor_zone(1, [60, 16, 16, 12]),
			_anchor_zone(2, [60, 45, 16, 12]),
			_anchor_zone(3, [60, 75, 16, 10]),
		],
		"metadata": {
			"objective": "Break three guarded Soul Anchor manifestations, collect their cores, and practice Relay in both directions.",
			"difficulty_tier": 6,
			"pacing": "three_four_unit_anchor_clusters_with_two_safe_relay_breathers",
			"roster_id": "chapter_1_level_6_roster",
			"encounter_pack_model": {
				"enabled": true,
				"profile_stage": 6,
				"floor_count": 3,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids": [
					"l6_camp_1_first_anchor",
					"l6_camp_2_return_relay",
					"l6_camp_3_mastery_check",
				],
			},
			"relay_lesson": {
				"tracked_events": ["relay_sword_hero_to_archer_hero", "relay_archer_hero_to_sword_hero"],
				"mandatory_for_exit": false,
				"reason": "Tutorial tracking must never strand a player after the final enemy dies.",
			},
			"campaign_ready_blockers": [
				"The Level 5 Archer Soul must be physically collected before Archer can be placed in the Soul Team.",
			],
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


func _add_door_pair(entities: Array, pair_id: String, cell_a: Vector2i, cell_b: Vector2i, label: String) -> void:
	var position_a := [cell_a.x * 16 + 8, cell_a.y * 16 + 8]
	var position_b := [cell_b.x * 16 + 8, cell_b.y * 16 + 8]
	entities.append(_entity("door_%s_down" % pair_id, "floor_door", cell_a.x, cell_a.y, {
		"target_position": position_b,
		"label": label,
		"message": "Nhấn chuột trái để đi tiếp",
	}))
	entities.append(_entity("door_%s_up" % pair_id, "floor_door", cell_b.x, cell_b.y, {
		"target_position": position_a,
		"label": "Previous floor",
		"message": "Nhấn chuột trái để quay lại tầng trước",
	}))


func _camp(id: String, floor: int, rect: Array, entry: Array, enemy_ids: Array, composition: String) -> Dictionary:
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
		"asset_strategy": "existing Bone Reaper manifestation plus licensed sigil core and torch ring",
	}
