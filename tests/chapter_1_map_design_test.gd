extends SceneTree

const LevelSchemaValidator := preload("res://game/levels/level_schema.gd")
const LEVEL_SCENE: PackedScene = preload("res://game/levels/crypt_entrance.tscn")
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")
const REPORT_PATH := "res://.artifacts/chapter_1_map_design_report.json"
const MAPS := {
	"chapter_1_level_1": {
		"path": "res://data/levels/crypt_entrance.json",
		"enemy_counts": {"skeleton": 12, "skeleton_reaper": 0, "vampire": 0},
		"spikes": 12,
		"required_sigils": 3,
		"campaign_slot": 1,
	},
	"chapter_1_level_2": {
		"path": "res://data/levels/chapter_1_level_2.json",
		"enemy_counts": {"skeleton": 15, "skeleton_reaper": 0, "vampire": 0},
		"spikes": 15,
		"required_sigils": 3,
		"campaign_slot": 2,
		"density_cadence_anchor": Vector2i(50, 13),
	},
	"chapter_1_level_3": {
		"path": "res://data/levels/chapter_1_level_3.json",
		"enemy_counts": {"skeleton": 15, "skeleton_reaper": 5, "vampire": 0},
		"spikes": 18,
		"required_sigils": 4,
		"campaign_slot": 3,
		"density_cadence_anchor": Vector2i(60, 10),
	},
	"chapter_1_level_4": {
		"path": "res://data/levels/chapter_1_level_4.json",
		"enemy_counts": {"skeleton": 10, "skeleton_reaper": 5, "vampire": 0},
		"spikes": 21,
		"required_sigils": 4,
		"campaign_slot": 4,
	},
	"chapter_1_level_5": {
		"path": "res://data/levels/chapter_1_level_5.json",
		"enemy_counts": {"skeleton": 10, "skeleton_reaper": 5, "hooded_archer_miniboss": 1, "vampire": 1},
		"spikes": 24,
		"required_sigils": 4,
		"campaign_slot": 5,
	},
}
const ENEMY_TYPES := ["skeleton", "skeleton_reaper", "hooded_archer_miniboss", "vampire"]
const MINIBOSS_TYPES := ["hooded_archer_miniboss"]

var _checks := 0
var _failures: Array[String] = []
var _summaries: Dictionary = {}


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	for map_id: String in MAPS:
		_test_map(map_id, MAPS[map_id])
	_finish()


func _test_map(map_id: String, expectation: Dictionary) -> void:
	var level := _load_json(String(expectation.path))
	_expect(not level.is_empty(), map_id, "JSON loads")
	if level.is_empty():
		return
	var schema_result: Dictionary = LevelSchemaValidator.validate_level(level)
	_expect(
		bool(schema_result.get("ok", false)),
		map_id,
		"passes LevelSchema v2: %s" % schema_result.get("error", ""),
	)

	var floor := _layer_lookup(level, "Backdrop")
	var geometry := _layer_lookup(level, "Geometry")
	var entities: Array = level.get("entities", [])
	var entities_by_id := _entities_by_id(entities)
	var entities_by_type := _entities_by_type(entities)
	_expect(not floor.is_empty(), map_id, "has a walkable footprint")
	_expect(_no_overlap(floor, geometry), map_id, "Geometry never overwrites walkable floor")
	_test_runtime_load(map_id, String(expectation.path), floor.size(), geometry.size())
	_expect(_all_entities_on_floor(entities, floor), map_id, "every entity is on walkable floor")
	_expect(_all_door_targets_on_floor(entities, floor), map_id, "every door target is on walkable floor")
	_expect(_count_components(floor) == 3, map_id, "has exactly three door-linked floor footprints")
	_expect(_door_pairs_are_reciprocal(entities), map_id, "all floor doors form reciprocal pairs")

	var reachable := _reachable_floor(level, floor, {})
	_expect(reachable.size() == floor.size(), map_id, "player can reach every floor cell through authored doors")
	_expect(_all_objectives_reachable(entities, reachable), map_id, "all sigils, checkpoints and exit are reachable")

	for enemy_type: String in ENEMY_TYPES:
		var expected_count := int(expectation.enemy_counts.get(enemy_type, 0))
		var actual_count := (entities_by_type.get(enemy_type, []) as Array).size()
		_expect(actual_count == expected_count, map_id, "%s count is %d" % [enemy_type, expected_count])
	_expect(
		(entities_by_type.get("spikes", []) as Array).size() == int(expectation.spikes),
		map_id,
		"authored spike count is %d" % int(expectation.spikes),
	)
	_expect(
		int(level.metadata.required_sigils) == int(expectation.required_sigils),
		map_id,
		"required sigil count matches the difficulty plan",
	)
	_test_density_cadence_anchor(map_id, level, floor, expectation)

	_test_camps(map_id, level, entities_by_id)
	_test_campaign_registration(map_id, expectation, level, entities_by_id)
	_test_spawn_and_checkpoint_safety(map_id, entities_by_type)
	_test_patrol_clearance(map_id, entities_by_type, floor)
	_test_trap_fairness(map_id, level, entities_by_type, floor)
	_test_special_zones(map_id, level, floor)

	_summaries[map_id] = {
		"floor_cells": floor.size(),
		"geometry_cells": geometry.size(),
		"entities": entities.size(),
		"camps": (level.metadata.get("combat_camps", []) as Array).size(),
		"enemies": (
			(entities_by_type.get("skeleton", []) as Array).size()
			+ (entities_by_type.get("skeleton_reaper", []) as Array).size()
			+ (entities_by_type.get("hooded_archer_miniboss", []) as Array).size()
			+ (entities_by_type.get("vampire", []) as Array).size()
		),
		"spikes": (entities_by_type.get("spikes", []) as Array).size(),
	}


func _test_density_cadence_anchor(
		map_id: String,
		level: Dictionary,
		floor: Dictionary,
		expectation: Dictionary,
) -> void:
	var expected_value: Variant = expectation.get("density_cadence_anchor", null)
	var anchor_value: Variant = level.metadata.get("density_cadence_anchor", null)
	if expected_value == null:
		_expect(anchor_value == null, map_id, "has no accidental density cadence scout anchor")
		return
	_expect(
		anchor_value is Array and (anchor_value as Array).size() >= 2,
		map_id,
		"declares one density cadence scout anchor",
	)
	if not anchor_value is Array or (anchor_value as Array).size() < 2:
		return
	var expected_cell: Vector2i = expected_value
	var expected_position := Vector2(expected_cell * 16) + Vector2(8.0, 8.0)
	var anchor_array := anchor_value as Array
	var anchor_position := Vector2(float(anchor_array[0]), float(anchor_array[1]))
	var anchor_cell := Vector2i(
		floori(anchor_position.x / 16.0),
		floori(anchor_position.y / 16.0),
	)
	_expect(
		anchor_position.is_equal_approx(expected_position),
		map_id,
		"density cadence scout anchor keeps its authored world position",
	)
	_expect(
		anchor_cell == expected_cell and floor.has(anchor_cell),
		map_id,
		"density cadence scout anchor occupies the intended walkable cell",
	)


func _test_campaign_registration(
		map_id: String,
		expectation: Dictionary,
		_level_document: Dictionary,
		entities_by_id: Dictionary,
) -> void:
	var definition := CAMPAIGN_REGISTRY.find_level(StringName(map_id))
	_expect(definition != null, map_id, "is registered in the Campaign catalog")
	if definition == null:
		return
	_expect(definition.is_campaign_ready(), map_id, "is visible as campaign-ready content")
	_expect(definition.layout_data_path == String(expectation.path), map_id, "Campaign card routes to this exact JSON")
	var encounter := CAMPAIGN_REGISTRY.find_encounter(definition.entry_encounter_id)
	_expect(encounter != null, map_id, "has a registered encounter catalog")
	if encounter == null:
		return
	var encounter_markers: Dictionary = {}
	for wave: EncounterWaveDefinition in encounter.waves:
		if wave == null:
			continue
		for group: EncounterGroupDefinition in wave.groups:
			if group == null:
				continue
			for entry: EncounterSpawnEntry in group.spawn_entries:
				if entry == null:
					continue
				for marker_id: String in entry.spawn_marker_ids:
					encounter_markers[marker_id] = true
	var map_enemy_ids: Dictionary = {}
	for entity_id: String in entities_by_id:
		var entity: Dictionary = entities_by_id[entity_id]
		if String(entity.get("type", "")) in ENEMY_TYPES:
			map_enemy_ids[entity_id] = true
	_expect(_same_keys(encounter_markers, map_enemy_ids), map_id, "Encounter marker IDs exactly match JSON enemies")
	var roster := CAMPAIGN_REGISTRY.find_campaign_roster(int(expectation.campaign_slot))
	_expect(roster != null, map_id, "has a campaign roster")
	if roster != null:
		_expect(roster.get_total_count() == map_enemy_ids.size(), map_id, "every roster combatant has an exact runtime map entity")


func _test_runtime_load(
		map_id: String,
		path: String,
		expected_floor_cells: int,
		expected_geometry_cells: int,
) -> void:
	var instance := LEVEL_SCENE.instantiate() as DungeonLevel
	_expect(instance != null, map_id, "shared DungeonLevel scene instantiates")
	if instance == null:
		return
	instance.level_data_path = path
	instance.watch_file_changes = false
	root.add_child(instance)
	_expect(instance.level_data_path == path, map_id, "runtime keeps the selected layout path")
	_expect(not instance.level_data.is_empty(), map_id, "runtime loader accepts the selected map")
	_expect(instance.backdrop.get_used_cells().size() == expected_floor_cells, map_id, "runtime applies every Backdrop cell")
	_expect(instance.geometry.get_used_cells().size() == expected_geometry_cells, map_id, "runtime applies every Geometry cell")
	root.remove_child(instance)
	instance.free()


func _test_camps(map_id: String, level: Dictionary, entities_by_id: Dictionary) -> void:
	var camps: Array = level.metadata.get("combat_camps", [])
	_expect(camps.size() == 3, map_id, "uses three dense combat camps instead of scattered enemies")
	var assigned: Dictionary = {}
	for camp_value: Variant in camps:
		if not camp_value is Dictionary:
			_expect(false, map_id, "camp metadata entries are objects")
			continue
		var camp: Dictionary = camp_value
		var enemy_ids: Array = camp.get("enemy_ids", [])
		_expect(enemy_ids.size() >= 4, map_id, "%s contains at least four enemies" % camp.get("id", "camp"))
		var rect_array: Array = camp.get("rect", [])
		var camp_rect := _array_to_rect(rect_array)
		var positions: Array[Vector2] = []
		for enemy_id_value: Variant in enemy_ids:
			var enemy_id := String(enemy_id_value)
			var entity: Dictionary = entities_by_id.get(enemy_id, {})
			_expect(not entity.is_empty(), map_id, "camp member exists: %s" % enemy_id)
			_expect(not assigned.has(enemy_id), map_id, "camp member is assigned once: %s" % enemy_id)
			assigned[enemy_id] = true
			if entity.is_empty():
				continue
			_expect(String(entity.type) in ENEMY_TYPES, map_id, "camp member is an enemy: %s" % enemy_id)
			var cell := _entity_cell(entity)
			_expect(camp_rect.has_point(cell), map_id, "camp member stays inside its combat room: %s" % enemy_id)
			positions.append(_entity_position(entity))
		_expect(_minimum_spacing(positions) >= 55.0, map_id, "%s keeps readable enemy spacing" % camp.get("id", "camp"))
		_expect(_maximum_spacing(positions) <= 560.0, map_id, "%s remains one dense encounter" % camp.get("id", "camp"))

	for entity_id: String in entities_by_id:
		var entity: Dictionary = entities_by_id[entity_id]
		if String(entity.get("type", "")) in ENEMY_TYPES:
			if String(entity.get("type", "")) in MINIBOSS_TYPES:
				continue
			_expect(assigned.has(entity_id), map_id, "enemy belongs to an authored camp: %s" % entity_id)


func _test_spawn_and_checkpoint_safety(map_id: String, entities_by_type: Dictionary) -> void:
	var players: Array = entities_by_type.get("player", [])
	var enemies := _combined_entities(entities_by_type, ENEMY_TYPES)
	var spikes: Array = entities_by_type.get("spikes", [])
	var checkpoints: Array = entities_by_type.get("checkpoint", [])
	var doors: Array = entities_by_type.get("floor_door", [])
	if players.is_empty():
		return
	var player_position := _entity_position(players[0])
	_expect(_nearest_distance(player_position, enemies) >= 240.0, map_id, "player spawn is outside enemy awareness")
	_expect(_nearest_distance(player_position, spikes) >= 160.0, map_id, "player spawn has a trap-free read zone")
	for checkpoint_value: Variant in checkpoints:
		var checkpoint: Dictionary = checkpoint_value
		var position := _entity_position(checkpoint)
		_expect(_nearest_distance(position, enemies) >= 150.0, map_id, "%s is not inside a sleeping camp" % checkpoint.id)
		_expect(_nearest_distance(position, spikes) >= 64.0, map_id, "%s is not a trap spawn" % checkpoint.id)
	for door_value: Variant in doors:
		var door: Dictionary = door_value
		var position := _entity_position(door)
		_expect(_nearest_distance(position, spikes) >= 64.0, map_id, "%s has a safe interaction/arrival pad" % door.id)


func _test_patrol_clearance(map_id: String, entities_by_type: Dictionary, floor: Dictionary) -> void:
	var enemies := _combined_entities(entities_by_type, ENEMY_TYPES)
	for enemy_value: Variant in enemies:
		var enemy: Dictionary = enemy_value
		var center := _entity_cell(enemy)
		var radius_cells := maxi(1, floori(float(enemy.get("patrol", 32.0)) / 16.0))
		var clear := true
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			for distance: int in range(1, radius_cells + 1):
				if not floor.has(center + direction * distance):
					clear = false
		_expect(clear, map_id, "%s patrol starts with cardinal clearance" % enemy.id)


func _test_trap_fairness(
		map_id: String,
		level: Dictionary,
		entities_by_type: Dictionary,
		floor: Dictionary,
) -> void:
	var spikes: Array = entities_by_type.get("spikes", [])
	var blocked: Dictionary = {}
	for spike_value: Variant in spikes:
		var spike: Dictionary = spike_value
		var cell := _entity_cell(spike)
		blocked[cell] = true
		var safe_neighbors := 0
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var neighbor := cell + direction
			if floor.has(neighbor) and not blocked.has(neighbor):
				safe_neighbors += 1
		_expect(safe_neighbors >= 2, map_id, "%s leaves local dodge space" % spike.id)

	var safe_reachable := _reachable_floor(level, floor, blocked)
	var objectives: Array = []
	objectives.append_array(entities_by_type.get("sigil", []))
	objectives.append_array(entities_by_type.get("exit_gate", []))
	for objective_value: Variant in objectives:
		var objective: Dictionary = objective_value
		_expect(safe_reachable.has(_entity_cell(objective)), map_id, "%s remains reachable without stepping on spikes" % objective.id)


func _test_special_zones(map_id: String, level: Dictionary, floor: Dictionary) -> void:
	if map_id != "chapter_1_level_5":
		return
	var zones: Array = level.metadata.get("special_zones", [])
	var boss_zone: Dictionary = {}
	for zone_value: Variant in zones:
		if zone_value is Dictionary and String(zone_value.get("id", "")) == "l5_hooded_archer_arena":
			boss_zone = zone_value
			break
	_expect(not boss_zone.is_empty(), map_id, "authors a named Hooded Archer arena")
	var anchor: Array = boss_zone.get("spawn_anchor_cell", [])
	_expect(anchor.size() == 2 and floor.has(Vector2i(int(anchor[0]), int(anchor[1]))), map_id, "Archer spawn anchor is walkable")
	_expect(String(boss_zone.get("spawn_entity_id", "")) == "l5_hooded_archer_miniboss", map_id, "boss arena points to the exact spawned Archer entity")
	_expect(String(boss_zone.get("status", "")) == "playable_required_miniboss", map_id, "boss zone is runtime-required rather than reserved metadata")


func _reachable_floor(level: Dictionary, floor: Dictionary, blocked: Dictionary) -> Dictionary:
	var entities: Array = level.get("entities", [])
	var start := Vector2i.ZERO
	var door_edges: Dictionary = {}
	for entity_value: Variant in entities:
		if not entity_value is Dictionary:
			continue
		var entity: Dictionary = entity_value
		var type := String(entity.get("type", ""))
		if type == "player":
			start = _entity_cell(entity)
		elif type == "floor_door":
			var target: Array = entity.get("target_position", [])
			if target.size() >= 2:
				var target_cell := Vector2i(floori(float(target[0]) / 16.0), floori(float(target[1]) / 16.0))
				var source_cell := _entity_cell(entity)
				var targets: Array = door_edges.get(source_cell, [])
				targets.append(target_cell)
				door_edges[source_cell] = targets

	var visited: Dictionary = {}
	if not floor.has(start) or blocked.has(start):
		return visited
	var queue: Array[Vector2i] = [start]
	visited[start] = true
	var cursor := 0
	while cursor < queue.size():
		var current := queue[cursor]
		cursor += 1
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var neighbor := current + direction
			if floor.has(neighbor) and not blocked.has(neighbor) and not visited.has(neighbor):
				visited[neighbor] = true
				queue.append(neighbor)
		for target_value: Variant in door_edges.get(current, []):
			var target: Vector2i = target_value
			if floor.has(target) and not blocked.has(target) and not visited.has(target):
				visited[target] = true
				queue.append(target)
	return visited


func _count_components(floor: Dictionary) -> int:
	var unseen := floor.duplicate()
	var components := 0
	while not unseen.is_empty():
		components += 1
		var start: Vector2i = unseen.keys()[0]
		var queue: Array[Vector2i] = [start]
		unseen.erase(start)
		var cursor := 0
		while cursor < queue.size():
			var current := queue[cursor]
			cursor += 1
			for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
				var neighbor := current + direction
				if unseen.has(neighbor):
					unseen.erase(neighbor)
					queue.append(neighbor)
	return components


func _door_pairs_are_reciprocal(entities: Array) -> bool:
	var doors_by_position: Dictionary = {}
	var doors: Array = []
	for entity_value: Variant in entities:
		if entity_value is Dictionary and String(entity_value.get("type", "")) == "floor_door":
			var entity: Dictionary = entity_value
			doors.append(entity)
			doors_by_position[_position_key(entity.get("position", []))] = entity
	for door_value: Variant in doors:
		var door: Dictionary = door_value
		var partner: Dictionary = doors_by_position.get(_position_key(door.get("target_position", [])), {})
		if partner.is_empty() or _position_key(partner.get("target_position", [])) != _position_key(door.get("position", [])):
			return false
	return not doors.is_empty()


func _all_entities_on_floor(entities: Array, floor: Dictionary) -> bool:
	for entity_value: Variant in entities:
		if not entity_value is Dictionary or not floor.has(_entity_cell(entity_value)):
			return false
	return true


func _all_door_targets_on_floor(entities: Array, floor: Dictionary) -> bool:
	for entity_value: Variant in entities:
		if not entity_value is Dictionary or String(entity_value.get("type", "")) != "floor_door":
			continue
		var target: Array = entity_value.get("target_position", [])
		if target.size() < 2:
			return false
		var cell := Vector2i(floori(float(target[0]) / 16.0), floori(float(target[1]) / 16.0))
		if not floor.has(cell):
			return false
	return true


func _all_objectives_reachable(entities: Array, reachable: Dictionary) -> bool:
	for entity_value: Variant in entities:
		if not entity_value is Dictionary:
			continue
		if String(entity_value.get("type", "")) in ["sigil", "checkpoint", "exit_gate"]:
			if not reachable.has(_entity_cell(entity_value)):
				return false
	return true


func _no_overlap(left: Dictionary, right: Dictionary) -> bool:
	for key: Variant in left:
		if right.has(key):
			return false
	return true


func _same_keys(left: Dictionary, right: Dictionary) -> bool:
	if left.size() != right.size():
		return false
	for key: Variant in left:
		if not right.has(key):
			return false
	return true


func _layer_lookup(level: Dictionary, layer_name: String) -> Dictionary:
	var result: Dictionary = {}
	for cell_value: Variant in level.get("layers", {}).get(layer_name, []):
		if cell_value is Dictionary:
			result[Vector2i(int(cell_value.get("x", -1)), int(cell_value.get("y", -1)))] = true
	return result


func _entities_by_id(entities: Array) -> Dictionary:
	var result: Dictionary = {}
	for entity_value: Variant in entities:
		if entity_value is Dictionary:
			result[String(entity_value.get("id", ""))] = entity_value
	return result


func _entities_by_type(entities: Array) -> Dictionary:
	var result: Dictionary = {}
	for entity_value: Variant in entities:
		if not entity_value is Dictionary:
			continue
		var type := String(entity_value.get("type", ""))
		var bucket: Array = result.get(type, [])
		bucket.append(entity_value)
		result[type] = bucket
	return result


func _combined_entities(entities_by_type: Dictionary, types: Array) -> Array:
	var result: Array = []
	for type_value: Variant in types:
		result.append_array(entities_by_type.get(String(type_value), []))
	return result


func _nearest_distance(origin: Vector2, entities: Array) -> float:
	var nearest := INF
	for entity_value: Variant in entities:
		if entity_value is Dictionary:
			nearest = minf(nearest, origin.distance_to(_entity_position(entity_value)))
	return nearest


func _minimum_spacing(positions: Array[Vector2]) -> float:
	if positions.size() < 2:
		return INF
	var minimum := INF
	for left: int in positions.size():
		for right: int in range(left + 1, positions.size()):
			minimum = minf(minimum, positions[left].distance_to(positions[right]))
	return minimum


func _maximum_spacing(positions: Array[Vector2]) -> float:
	var maximum := 0.0
	for left: int in positions.size():
		for right: int in range(left + 1, positions.size()):
			maximum = maxf(maximum, positions[left].distance_to(positions[right]))
	return maximum


func _entity_position(entity: Dictionary) -> Vector2:
	var position: Array = entity.get("position", [])
	return Vector2(float(position[0]), float(position[1])) if position.size() >= 2 else Vector2.ZERO


func _entity_cell(entity: Dictionary) -> Vector2i:
	var position := _entity_position(entity)
	return Vector2i(floori(position.x / 16.0), floori(position.y / 16.0))


func _array_to_rect(value: Array) -> Rect2i:
	if value.size() < 4:
		return Rect2i()
	return Rect2i(int(value[0]), int(value[1]), int(value[2]), int(value[3]))


func _position_key(value: Variant) -> String:
	if not value is Array or value.size() < 2:
		return "invalid"
	return "%s,%s" % [value[0], value[1]]


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _expect(condition: bool, map_id: String, label: String) -> void:
	_checks += 1
	if condition:
		return
	var message := "%s: %s" % [map_id, label]
	_failures.append(message)
	push_error("CHAPTER 1 MAP DESIGN FAIL: %s" % message)


func _finish() -> void:
	var report := {
		"ok": _failures.is_empty(),
		"checks": _checks,
		"passed": _checks - _failures.size(),
		"failures": _failures,
		"summaries": _summaries,
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	print("CHAPTER 1 MAP DESIGN %d/%d" % [_checks - _failures.size(), _checks])
	quit(0 if _failures.is_empty() else 1)
