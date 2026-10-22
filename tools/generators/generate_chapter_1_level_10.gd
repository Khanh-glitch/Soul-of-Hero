extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const OUTPUT_PATH := "res://data/levels/chapter_1_level_10.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error("Refusing to write invalid Chapter 1 Level 10: %s" % validation.get("error", "unknown error"))
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
		"Generated chapter_1_level_10: %d floor, %d wall, %d decor, %d entities, one two-phase Castellan"
		% [level.layers.Backdrop.size(), level.layers.Geometry.size(), level.layers.Decor.size(), level.entities.size()]
	)
	quit(0)


func _level_definition() -> Dictionary:
	var approach_ids := [
		"l10_approach_skeleton", "l10_approach_reaper", "l10_approach_vampire",
	]
	var entities: Array = [
		_entity("l10_player_spawn", "player", 50, 67),
		_entity("l10_checkpoint", "checkpoint", 50, 63),
		_entity("l10_vampire_castellan", "vampire_castellan", 50, 25, {
			"grants_sigil_on_defeat": true,
		}),
		_entity("l10_exit", "exit_gate", 50, 7),
		_entity(approach_ids[0], "skeleton", 44, 55, {"patrol": 22}),
		_entity(approach_ids[1], "skeleton_reaper", 50, 48, {"patrol": 20}),
		_entity(approach_ids[2], "vampire", 56, 55, {"patrol": 24}),
	]
	_add_entities(entities, "l10_torch", "torch", [
		Vector2i(43, 64), Vector2i(57, 64), Vector2i(39, 55), Vector2i(61, 55),
		Vector2i(29, 43), Vector2i(71, 43), Vector2i(33, 28), Vector2i(67, 28),
		Vector2i(39, 12), Vector2i(61, 12),
	])
	_add_entities(entities, "l10_coin", "coin", [
		Vector2i(45, 60), Vector2i(55, 60), Vector2i(34, 46), Vector2i(66, 46),
		Vector2i(40, 35), Vector2i(60, 35),
	])
	_add_entities(entities, "l10_spikes", "spikes", [
		Vector2i(43, 52), Vector2i(57, 52), Vector2i(46, 47), Vector2i(54, 47),
		Vector2i(39, 39), Vector2i(61, 39), Vector2i(35, 25), Vector2i(65, 25),
		Vector2i(43, 17), Vector2i(57, 17),
	])
	return {
		"id": "chapter_1_level_10",
		"name": "Lord of the Sealed Crypt",
		"width": 100,
		"height": 76,
		"decor_seed": 10,
		"required_sigils": 1,
		"layout_profile": "castellan_throne_two_phase_boss",
		"rooms": [
			_room("l10_south_antechamber", "checkpoint_approach", 41, 59, 18, 13),
			_room("l10_processional_nave", "boss_approach", 39, 44, 22, 16),
			_room("l10_castellan_throne", "two_phase_boss_arena", 25, 14, 50, 32),
			_room("l10_chapter_exit", "chapter_victory_portal", 41, 4, 18, 12),
		],
		"corridors": [
			Rect2i(47, 55, 6, 8),
			Rect2i(47, 40, 6, 8),
			Rect2i(47, 10, 6, 8),
		],
		"pits": [
			Rect2i(28, 30, 5, 5), Rect2i(67, 30, 5, 5),
			Rect2i(37, 20, 4, 4), Rect2i(59, 20, 4, 4),
		],
		"entities": entities,
		"combat_camps": [
			{
				"id": "l10_throne_approach",
				"floor": 1,
				"rect": [40, 45, 20, 14],
				"entry_cell": [50, 58],
				"enemy_ids": approach_ids,
				"composition": "two dense roaming packs seeded by all three ordinary families before the boss threshold",
				"elite_ready": true,
			},
			{
				"id": "l10_vampire_castellan_encounter",
				"floor": 1,
				"rect": [27, 16, 46, 28],
				"entry_cell": [50, 43],
				"enemy_ids": ["l10_vampire_castellan"],
				"composition": "one dedicated Vampire Castellan actor with an uninterrupted 55-percent phase transition",
				"elite_ready": false,
			},
		],
		"safe_zones": [{
			"id": "l10_entry_checkpoint",
			"rect": [43, 60, 14, 11],
			"purpose": "stable restart before entering the throne nave",
		}],
		"special_zones": [
			{"id": "l10_throne_arena", "rect": [27, 16, 46, 28], "boss_id": "l10_vampire_castellan", "phase_count": 2},
			{"id": "l10_crimson_cross_safe_read", "rect": [34, 24, 32, 16], "pattern": "diagonal gaps outside crossing lanes"},
		],
		"metadata": {
			"objective": "Defeat the Vampire Castellan across both continuous phases, then use the north chapter portal.",
			"difficulty_tier": 10,
			"pacing": "safe_checkpoint_then_readable_phase_one_then_nightfall_pattern_mix_then_exit",
			"roster_id": "chapter_1_level_10_roster",
			"encounter_pack_model": {
				"enabled": true,
				"profile_stage": 10,
				"floor_count": 1,
				"placement": "authored_camp_anchors",
				"authored_counts_are_anchors": true,
				"anchor_camp_ids": ["l10_throne_approach"],
				"packs_per_floor_override": 2,
				"members_per_pack_override": 8,
			},
			"boss_entity_id": "l10_vampire_castellan",
			"boss_runtime_enemy_id": "vampire_castellan",
			"boss_phase_count": 2,
			"phase_two_health_ratio": 0.55,
			"boss_hud_required": true,
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
