extends SceneTree

## Deterministic Chapter 2 map authoring.  The map shapes intentionally differ
## per slot while retaining the production top-down schema and its authorable
## entity markers.  Deferred Wraith markers are released by ChapterTwoSpawnDirector.

const MapBuilder := preload("res://tools/generators/chapter_1_map_builder.gd")
const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")


func _init() -> void:
	for definition: Dictionary in _definitions():
		var level := MapBuilder.new().build(definition)
		var validation: Dictionary = LevelSchemaValidator.validate_level(level)
		if not bool(validation.get("ok", false)):
			push_error("Refusing invalid Chapter 2 map %s: %s" % [definition.get("id", "unknown"), validation.get("error", "unknown")])
			quit(1)
			return
		var output_path := "res://data/levels/%s.json" % String(definition.get("id", ""))
		var file := FileAccess.open(output_path, FileAccess.WRITE)
		if file == null:
			push_error("Cannot write %s" % output_path)
			quit(1)
			return
		file.store_string(JSON.stringify(level, "  ", false) + "\n")
		file.close()
		print("Generated %s with %d entities." % [definition.get("id", ""), (level.get("entities", []) as Array).size()])
	quit(0)


func _definitions() -> Array[Dictionary]:
	return [
		_build_level(11, "Cổng Rơi", "gatefall_recovery", [
			["coven_wraith", 9],
		]),
		_build_level(12, "Mạch Độc Tro", "ash_venom_purification", [
			["coven_wraith", 5], ["venom_bound_wraith", 5],
		]),
		_build_level(13, "Rừng Đèn Tắt", "lanternwood_escort", [
			["coven_wraith", 4], ["venom_bound_wraith", 3], ["spirit_leech", 3],
		]),
		_build_level(14, "Xóm Giả Kim", "alchemist_overload", [
			["coven_wraith", 4], ["venom_bound_wraith", 4], ["spirit_leech", 2],
		]),
		_build_level(15, "Kẻ Phá Khế", "axe_pactbreaker_arena", [
			["coven_wraith", 5],
		], {"type": "axe_soul_boss", "id_suffix": "axe", "initial": true}),
		_build_level(16, "Mê Lộ Cổng Nguyền", "cursed_gate_maze", [
			["coven_wraith", 3], ["venom_bound_wraith", 3], ["spirit_leech", 3],
		]),
		_build_level(17, "Nghi Lễ Giữ Lửa", "firekeeping_rite", [
			["coven_wraith", 4], ["venom_bound_wraith", 3], ["spirit_leech", 3],
		]),
		_build_level(18, "Di Vật Biết Thở", "breathing_relic", [
			["coven_wraith", 3], ["spirit_leech", 3],
		], {
			"type": "hexwing_familiar",
			"id_suffix": "hexwing",
			"initial": true,
			"retreat_health_ratio": 0.70,
		}),
		_build_level(19, "Sabbath Ma Dực", "hexwing_sabbath", [
			["coven_wraith", 5], ["spirit_leech", 4],
		], {"type": "hexwing_familiar", "id_suffix": "hexwing", "initial": true}),
		_build_level(20, "Trái Tim Xưởng Hắc Phù", "wizard_foundry_heart", [
			["coven_wraith", 5], ["spirit_leech", 1],
		], {
			"type": "wizard_hero_boss",
			"id_suffix": "wizard",
			"initial": true,
			"guaranteed_loot_profile": "level_20_wizard_soul",
		}),
	]


func _build_level(
		slot: int,
		title: String,
		profile: String,
		enemy_groups: Array,
		special: Dictionary = {},
) -> Dictionary:
	var prefix := "l%d" % slot
	var entities: Array = [
		_entity(prefix + "_player_spawn", "player", 50, 67),
		_entity(prefix + "_checkpoint", "checkpoint", 50, 63),
		_entity(prefix + "_sigil", "sigil", 50, 20),
		_entity(prefix + "_exit", "exit_gate", 50, 7),
	]
	_add_entities(entities, prefix + "_torch", "torch", [
		Vector2i(43, 64), Vector2i(57, 64), Vector2i(39, 52), Vector2i(61, 52),
		Vector2i(33, 36), Vector2i(67, 36), Vector2i(39, 17), Vector2i(61, 17),
	])
	_add_entities(entities, prefix + "_coin", "coin", [
		Vector2i(46, 59), Vector2i(54, 59), Vector2i(35, 47), Vector2i(65, 47),
		Vector2i(42, 28), Vector2i(58, 28),
	])
	if slot in [12, 14, 18]:
		entities.append(_entity(prefix + "_chest", "chest", 32, 29, {
			"chest_family": "monster",
			"rarity_override": "rare",
			"interaction_message": "Nhấn chuột trái để mở rương phù tro",
		}))
	if slot == 16:
		entities.append(_entity(prefix + "_rune_a", "floor_door", 39, 40, {
			"label": "Cổng Rune A",
			"message": "Nhấn chuột trái để thử Rune A",
			"target_position": [50 * 16 + 8, 31 * 16 + 8],
		}))
		entities.append(_entity(prefix + "_rune_b", "floor_door", 61, 40, {
			"label": "Cổng Rune B",
			"message": "Nhấn chuột trái để thử Rune B",
			"target_position": [50 * 16 + 8, 55 * 16 + 8],
		}))
	if slot in [13, 17]:
		entities.append(_entity(prefix + "_beacon", "soul_beacon", 50, 38))
	var cells: Array = _enemy_cells(slot)
	var order := 0
	var cell_index := 0
	for group_value: Variant in enemy_groups:
		var group: Array = group_value as Array
		var enemy_type := String(group[0])
		var count := int(group[1])
		for number: int in count:
			var cell: Vector2i = cells[cell_index % cells.size()]
			cell_index += 1
			order += 1
			var id_suffix := _enemy_suffix(enemy_type)
			entities.append(_enemy_entity(
				"%s_%s_%02d" % [prefix, id_suffix, number + 1],
				enemy_type,
				cell,
				order,
				order > 6,
			))
	if not special.is_empty():
		var special_cell := Vector2i(50, 26)
		var extra := special.duplicate(true)
		var special_type := String(extra.get("type", ""))
		var suffix := String(extra.get("id_suffix", "boss"))
		extra.erase("type")
		extra.erase("id_suffix")
		var initial := bool(extra.get("initial", true))
		extra.erase("initial")
		entities.append(_enemy_entity(
			"%s_%s" % [prefix, suffix],
			special_type,
			special_cell,
			order + 1,
			not initial,
			extra,
		))
	var pits: Array[Rect2i] = []
	if slot % 2 == 0:
		pits = [Rect2i(27, 30, 5, 5), Rect2i(68, 30, 5, 5)]
	elif slot != 15:
		pits = [Rect2i(36, 24, 4, 4), Rect2i(60, 24, 4, 4)]
	return {
		"id": "chapter_2_level_%d" % slot,
		"name": "Xưởng Hắc Phù — %s" % title,
		"width": 100,
		"height": 76,
		"decor_seed": 110 + slot,
		"required_sigils": 1,
		"layout_profile": profile,
		"rooms": [
			_room(prefix + "_entry", "safe_landing", 41, 59, 18, 13),
			_room(prefix + "_middle", "coven_approach", 29, 43, 42, 14),
			_room(prefix + "_arena", "foundry_objective", 24, 15, 52, 27),
			_room(prefix + "_exit", "chapter_exit", 41, 4, 18, 12),
		],
		"corridors": [Rect2i(47, 55, 6, 8), Rect2i(47, 39, 6, 7), Rect2i(47, 10, 6, 8)],
		"pits": pits,
		"entities": entities,
		"combat_camps": [{
			"id": prefix + "_foundry_camps",
			"floor": 1,
			"rect": [29, 18, 42, 38],
			"entry_cell": [50, 56],
			"enemy_ids": _enemy_ids(entities),
			"composition": "Chapter 2 queue-directed Coven threat sequence",
			"elite_ready": slot >= 18,
		}],
		"safe_zones": [{
			"id": prefix + "_landing",
			"rect": [43, 60, 14, 11],
			"purpose": "safe landing and checkpoint before the foundry route",
		}],
		"special_zones": [{
			"id": prefix + "_objective_arena",
			"rect": [26, 17, 48, 23],
			"profile": profile,
		}],
		"metadata": {
			"objective": _objective_text(slot),
			"difficulty_tier": slot,
			"pacing": "chapter_2_safe_landing_then_directed_wraith_batches_then_objective_exit",
			"roster_id": "chapter_2_level_%d_roster" % slot,
			"chapter_2_director": true,
			"chapter_2_profile": profile,
			"world_tint": _world_tint(slot),
			"boss_entity_id": _boss_entity_id(prefix, special),
		},
	}


func _enemy_cells(slot: int) -> Array:
	var base := [
		Vector2i(44, 54), Vector2i(56, 54), Vector2i(38, 47), Vector2i(62, 47),
		Vector2i(34, 37), Vector2i(66, 37), Vector2i(42, 31), Vector2i(58, 31),
		Vector2i(37, 23), Vector2i(63, 23), Vector2i(46, 19), Vector2i(54, 19),
	]
	if slot % 3 == 0:
		base.reverse()
	return base


func _enemy_entity(
		id: String,
		type: String,
		cell: Vector2i,
		order: int,
		deferred: bool,
		extra: Dictionary = {},
) -> Dictionary:
	var result := _entity(id, type, cell.x, cell.y, {
		"patrol": 36 + (order % 4) * 10,
		"chapter_2_directed": true,
		"deferred_spawn": deferred,
		"director_order": order,
	})
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _entity(id: String, type: String, cell_x: int, cell_y: int, extra: Dictionary = {}) -> Dictionary:
	var result := {"id": id, "type": type, "position": [cell_x * 16 + 8, cell_y * 16 + 8]}
	for key: Variant in extra:
		result[key] = extra[key]
	return result


func _add_entities(entities: Array, prefix: String, type: String, cells: Array) -> void:
	for index: int in cells.size():
		var cell: Vector2i = cells[index] as Vector2i
		entities.append(_entity("%s_%02d" % [prefix, index + 1], type, cell.x, cell.y))


func _enemy_ids(entities: Array) -> Array[String]:
	var result: Array[String] = []
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		if bool(entity.get("chapter_2_directed", false)):
			result.append(String(entity.get("id", "")))
	return result


func _boss_entity_id(prefix: String, special: Dictionary) -> String:
	if special.is_empty():
		return ""
	return prefix + "_" + String(special.get("id_suffix", "boss"))


func _enemy_suffix(type: String) -> String:
	return {
		"coven_wraith": "coven",
		"venom_bound_wraith": "venom",
		"spirit_leech": "leech",
	}.get(type, type)


func _objective_text(slot: int) -> String:
	return {
		11: "Open the recovery gate after surviving the first Coven descent.",
		12: "Clear ash-venom channels and secure the central forge route.",
		13: "Hold the dark lantern route through the foundry grove.",
		14: "Overload the alchemist quarter and break its ward.",
		15: "Force Axe to exactly 50 percent health and watch him retreat.",
		16: "Read the cursed runes and reach the sanctum route.",
		17: "Keep the ritual flame alive through the Coven pressure.",
		18: "Carry the breathing relic out before Hexwing retreats.",
		19: "Defeat the named Hexwing Familiar in its Sabbath arena.",
		20: "Defeat Wizard, then physically collect the released Wizard Soul.",
	}.get(slot, "Clear the Coven route.")


func _world_tint(slot: int) -> Array[float]:
	if slot in [12, 14]:
		return [0.78, 0.98, 0.78, 1.0]
	if slot in [15, 19]:
		return [1.0, 0.76, 0.82, 1.0]
	if slot == 20:
		return [0.78, 0.70, 1.0, 1.0]
	return [0.82, 0.76, 1.0, 1.0]


func _room(id: String, role: String, x: int, y: int, width: int, height: int) -> Dictionary:
	return {"id": id, "floor": 1, "role": role, "rect": Rect2i(x, y, width, height)}
