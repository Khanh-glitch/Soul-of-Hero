extends SceneTree

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const OUTPUT_PATH := "res://data/levels/crypt_training_sandbox.json"


func _init() -> void:
	var level := MapBuilder.new().build(_level_definition())
	var validation: Dictionary = LevelSchemaValidator.validate_level(level)
	if not bool(validation.get("ok", false)):
		push_error(
			(
				"Refusing to write invalid Training sandbox: %s"
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
			"Generated crypt_training_sandbox: %d floor, %d wall, %d decor, %d entities"
			% [
				level.layers.Backdrop.size(),
				level.layers.Geometry.size(),
				level.layers.Decor.size(),
				level.entities.size(),
			]
		)
	)
	quit(0)


func _level_definition() -> Dictionary:
	var skeleton_ids := [
		"training_skeleton_01",
		"training_skeleton_02",
		"training_skeleton_03",
		"training_skeleton_04",
		"training_skeleton_05",
	]
	var skeleton_cells := [
		Vector2i(38, 20),
		Vector2i(66, 20),
		Vector2i(66, 44),
		Vector2i(38, 44),
		Vector2i(52, 16),
	]
	var entities: Array = [_entity("training_player_spawn", "player", 10, 32)]
	for index: int in skeleton_ids.size():
		var cell: Vector2i = skeleton_cells[index]
		(
			entities
			. append(
				_entity(
					String(skeleton_ids[index]),
					"skeleton",
					cell.x,
					cell.y,
					{"patrol": 24},
				)
			)
		)
	entities.append(_entity("training_exit", "exit_gate", 86, 32))
	_add_entities(
		entities,
		"training_torch",
		"torch",
		[
			Vector2i(7, 27),
			Vector2i(7, 37),
			Vector2i(37, 13),
			Vector2i(67, 13),
			Vector2i(37, 50),
			Vector2i(67, 50),
			Vector2i(84, 27),
			Vector2i(84, 37),
		]
	)

	return {
		"id": "crypt_entrance_sandbox",
		"name": "Crypt Training Loop",
		"width": 96,
		"height": 64,
		"decor_seed": 31,
		"required_sigils": 0,
		"layout_profile": "single_floor_training_loop",
		"rooms":
		[
			_room("training_entry", "safe_entry", 4, 24, 18, 16),
			_room("training_combat_loop", "free_practice_loop", 30, 10, 44, 44),
			_room("training_exit", "free_exit", 82, 25, 10, 14),
		],
		"corridors":
		[
			Rect2i(22, 30, 8, 4),
			Rect2i(74, 30, 8, 4),
		],
		"pits":
		[
			Rect2i(30, 10, 5, 4),
			Rect2i(69, 10, 5, 4),
			Rect2i(30, 50, 5, 4),
			Rect2i(69, 50, 5, 4),
			Rect2i(45, 23, 14, 18),
		],
		"entities": entities,
		"combat_camps":
		[
			{
				"id": "training_skeleton_loop",
				"floor": 1,
				"rect": [30, 10, 44, 44],
				"entry_cell": [30, 32],
				"enemy_ids": skeleton_ids,
				"composition":
				"five melee Skeletons spaced around a broad clockwise or counter-clockwise practice loop",
				"elite_ready": false,
			},
		],
		"safe_zones":
		[
			{
				"id": "training_spawn_sanctuary",
				"rect": [4, 24, 18, 16],
				"purpose": "safe onboarding and loadout reading before entering the combat loop",
			},
		],
		"special_zones":
		[
			{
				"id": "training_footwork_loop",
				"rect": [30, 10, 44, 44],
				"purpose":
				"practice Dash, Sword combos, Soul Echo, and optional Relay without campaign progress",
			},
		],
		"metadata":
		{
			"objective":
			"Practice against five Skeletons in a free one-floor loop and leave through the east gate when ready.",
			"difficulty_tier": 1,
			"pacing": "safe_entry_open_combat_loop_free_exit",
			"training_contract":
			{
				"encounter_id": "crypt_skeleton_sandbox",
				"campaign_slot": 0,
				"campaign_rewards": false,
				"required_sigils": 0,
				"free_exit": true,
			},
		},
	}


func _room(id: String, role: String, x: int, y: int, width: int, height: int) -> Dictionary:
	return {"id": id, "floor": 1, "role": role, "rect": Rect2i(x, y, width, height)}


func _entity(
	id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}
) -> Dictionary:
	var result := {"id": id, "type": type, "position": [cell_x * 16 + 8, cell_y * 16 + 8]}
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _add_entities(entities: Array, prefix: String, type: String, cells: Array) -> void:
	for index: int in cells.size():
		var cell: Vector2i = cells[index]
		entities.append(_entity("%s_%02d" % [prefix, index + 1], type, cell.x, cell.y))
