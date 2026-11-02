extends SceneTree

const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const TILE_SIZE := 16
const MAPS := [
	{"slot": 1, "path": "res://data/levels/crypt_entrance.json"},
	{"slot": 2, "path": "res://data/levels/chapter_1_level_2.json"},
	{"slot": 3, "path": "res://data/levels/chapter_1_level_3.json"},
	{"slot": 4, "path": "res://data/levels/chapter_1_level_4.json"},
	{"slot": 5, "path": "res://data/levels/chapter_1_level_5.json"},
	{"slot": 6, "path": "res://data/levels/chapter_1_level_6.json"},
	{"slot": 7, "path": "res://data/levels/chapter_1_level_7.json"},
	{"slot": 8, "path": "res://data/levels/chapter_1_level_8.json"},
	{"slot": 9, "path": "res://data/levels/chapter_1_level_9.json"},
	{"slot": 10, "path": "res://data/levels/chapter_1_level_10.json"},
]
const OBJECTIVE_TYPES := [
	"sigil",
	"exit_gate",
	"checkpoint",
	"gate_seal",
	"reliquary_branch_seal",
	"soul_beacon",
]

var _checks := 0
var _failures: Array[String] = []
var _floor_masks: Dictionary = {}
var _profiles: Dictionary = {}
var _map_summaries: Array[Dictionary] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	for map_spec: Dictionary in MAPS:
		_test_map(map_spec)
	_test_campaign_layout_distinctness()
	_test_level_six_route_composition()
	_finish()


func _test_map(map_spec: Dictionary) -> void:
	var slot := int(map_spec.get("slot", 0))
	var map_id := "Chapter 1 Level %02d" % slot
	var path := String(map_spec.get("path", ""))
	var file := FileAccess.open(path, FileAccess.READ)
	_expect(file != null, "%s map file opens" % map_id)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "%s map parses as JSON object" % map_id)
	if not parsed is Dictionary:
		return
	var document := parsed as Dictionary
	var validation: Dictionary = LEVEL_SCHEMA.validate_level(document)
	_expect(
		bool(validation.get("ok", false)),
		"%s passes LevelSchema: %s" % [map_id, validation.get("error", "")]
	)

	var width := int(document.get("width", 0))
	var height := int(document.get("height", 0))
	var metadata := document.get("metadata", {}) as Dictionary
	var layers := document.get("layers", {}) as Dictionary
	var floor := _cells_by_position(layers.get("Backdrop", []))
	var geometry := _cells_by_position(layers.get("Geometry", []))
	var entities: Array = document.get("entities", [])
	var entities_by_id := _entities_by_id(entities)
	var entities_by_type := _entities_by_type(entities)
	_expect(entities_by_id.size() == entities.size(), "%s authored entity IDs are unique" % map_id)
	var profile := String(metadata.get("layout_profile", "")).strip_edges()
	_expect(width >= 80 and height >= 60, "%s retains playable full-scale bounds" % map_id)
	_expect(floor.size() >= 2000, "%s has a substantial navigable footprint" % map_id)
	_expect(not floor.is_empty(), "%s has a walkable floor" % map_id)
	_expect(_no_overlap(floor, geometry), "%s solid geometry never overwrites its floor" % map_id)
	_expect(not profile.is_empty(), "%s declares an objective-specific layout profile" % map_id)
	_expect(not String(metadata.get("objective", "")).strip_edges().is_empty(), "%s has a readable authored objective" % map_id)
	_expect(not (metadata.get("rooms", []) as Array).is_empty(), "%s declares navigable room roles" % map_id)
	if not profile.is_empty():
		_expect(not _profiles.has(profile), "%s layout profile is unique across the campaign" % map_id)
		_profiles[profile] = true

	for cell: Vector2i in floor:
		_expect(
			cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height,
			"%s floor cell %s stays inside its declared bounds" % [map_id, cell],
		)
		if _failures.size() > 100:
			break

	var player_entities: Array = entities_by_type.get("player", [])
	var exit_entities: Array = entities_by_type.get("exit_gate", [])
	_expect(player_entities.size() == 1, "%s has exactly one player start" % map_id)
	_expect(exit_entities.size() == 1, "%s has exactly one explicit exit" % map_id)
	_expect(_count_enemy_entities(entities_by_type) > 0, "%s has authored combat pressure" % map_id)
	var off_floor_entities := _off_floor_entities(entities, floor, width, height)
	_expect(
		off_floor_entities.is_empty(),
		"%s keeps every spawn, pickup, and objective on walkable cells: %s"
		% [map_id, ", ".join(off_floor_entities)],
	)
	_expect(_entity_positions_use_tile_centers(entities), "%s aligns entity anchors to tile centers" % map_id)

	var doors: Array = entities_by_type.get("floor_door", [])
	_expect(
		doors.size() == (4 if slot <= 6 else 0),
		"%s uses the authored floor-transition contract" % map_id,
	)
	_expect(_door_targets_are_reciprocal(doors, floor), "%s floor transitions are reciprocal and land on floor" % map_id)
	var start := _entity_cell(player_entities[0]) if not player_entities.is_empty() else Vector2i(-1, -1)
	var reachable := _reachable(floor, start, {}, doors)
	_expect(reachable.size() == floor.size(), "%s connects every walkable space through designed doors" % map_id)

	var spike_cells := {}
	var spikes: Array = entities_by_type.get("spikes", [])
	for spike_value: Variant in spikes:
		spike_cells[_entity_cell(spike_value as Dictionary)] = true
	for spike_value: Variant in spikes:
		var spike := spike_value as Dictionary
		var cell := _entity_cell(spike)
		var safe_neighbors := 0
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var neighbor := cell + direction
			if floor.has(neighbor) and not spike_cells.has(neighbor):
				safe_neighbors += 1
		_expect(safe_neighbors >= 2, "%s hazard %s leaves dodge space" % [map_id, spike.get("id", "spike")])
	var safe_reachable := _reachable(floor, start, spike_cells, doors)
	for entity_type: String in OBJECTIVE_TYPES:
		for objective_value: Variant in entities_by_type.get(entity_type, []):
			var objective := objective_value as Dictionary
			_expect(
				safe_reachable.has(_entity_cell(objective)),
				"%s objective %s is reachable without stepping on spikes"
				% [map_id, objective.get("id", entity_type)],
			)

	_floor_masks[slot] = floor
	_map_summaries.append({
		"slot": slot,
		"path": path,
		"layout_profile": profile,
		"floor_cells": floor.size(),
		"geometry_cells": geometry.size(),
		"entities": entities.size(),
		"rooms": (metadata.get("rooms", []) as Array).size(),
		"enemies": _count_enemy_entities(entities_by_type),
	})


func _test_campaign_layout_distinctness() -> void:
	for first_slot: int in range(1, 11):
		for second_slot: int in range(first_slot + 1, 11):
			var first: Dictionary = _floor_masks.get(first_slot, {})
			var second: Dictionary = _floor_masks.get(second_slot, {})
			if first.is_empty() or second.is_empty():
				continue
			var difference := 0
			for cell: Vector2i in first:
				if not second.has(cell):
					difference += 1
			for cell: Vector2i in second:
				if not first.has(cell):
					difference += 1
			_expect(
				difference >= 500,
				"Levels %02d and %02d keep meaningfully distinct floor silhouettes (%d cells)"
				% [first_slot, second_slot, difference],
			)


func _test_level_six_route_composition() -> void:
	var level_five: Dictionary = _floor_masks.get(5, {})
	var level_six: Dictionary = _floor_masks.get(6, {})
	if level_five.is_empty() or level_six.is_empty():
		return
	var intersection := 0
	for cell: Vector2i in level_five:
		if level_six.has(cell):
			intersection += 1
	var union := level_five.size() + level_six.size() - intersection
	var overlap := float(intersection) / float(maxi(1, union))
	_expect(
		overlap <= 0.65,
		"Levels 05 and 06 keep different route composition (Jaccard overlap %.3f, limit 0.650)" % overlap,
	)


func _cells_by_position(value: Variant) -> Dictionary:
	var result := {}
	if not value is Array:
		return result
	for raw_cell: Variant in value:
		if not raw_cell is Dictionary:
			continue
		var cell := raw_cell as Dictionary
		result[Vector2i(int(cell.get("x", -1)), int(cell.get("y", -1)))] = true
	return result


func _entities_by_id(entities: Array) -> Dictionary:
	var result := {}
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		var entity_id := String(entity.get("id", "")).strip_edges()
		if not entity_id.is_empty():
			result[entity_id] = entity
	return result


func _entities_by_type(entities: Array) -> Dictionary:
	var result := {}
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		var entity_type := String(entity.get("type", ""))
		var bucket: Array = result.get(entity_type, [])
		bucket.append(entity)
		result[entity_type] = bucket
	return result


func _count_enemy_entities(entities_by_type: Dictionary) -> int:
	var result := 0
	for enemy_type: String in [
		"skeleton", "skeleton_reaper", "crimson_reaper", "bone_reaper_captain",
		"hooded_archer_miniboss", "vampire", "vampire_castellan", "coven_wraith",
		"venom_bound_wraith", "spirit_leech", "hexwing_familiar", "axe_soul_boss",
		"wizard_hero_boss",
	]:
		result += (entities_by_type.get(enemy_type, []) as Array).size()
	return result


func _off_floor_entities(
		entities: Array,
		floor: Dictionary,
		width: int,
		height: int,
) -> Array[String]:
	var result: Array[String] = []
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			result.append("<non-object entity>")
			continue
		var entity := raw_entity as Dictionary
		var entity_id := String(entity.get("id", "<missing-id>"))
		var position: Array = entity.get("position", [])
		if position.size() < 2:
			result.append("%s has no position" % entity_id)
			continue
		var cell := Vector2i(floori(float(position[0]) / TILE_SIZE), floori(float(position[1]) / TILE_SIZE))
		if not floor.has(cell) or cell.x < 0 or cell.y < 0 or cell.x >= width or cell.y >= height:
			result.append("%s at %s" % [entity_id, cell])
		if entity.has("target_position"):
			var target: Array = entity.get("target_position", [])
			if target.size() < 2:
				result.append("%s has no valid target position" % entity_id)
				continue
			var target_cell := Vector2i(floori(float(target[0]) / TILE_SIZE), floori(float(target[1]) / TILE_SIZE))
			if not floor.has(target_cell):
				result.append("%s target at %s" % [entity_id, target_cell])
	return result


func _entity_positions_use_tile_centers(entities: Array) -> bool:
	for raw_entity: Variant in entities:
		if not raw_entity is Dictionary:
			return false
		var position: Array = raw_entity.get("position", [])
		if position.size() < 2:
			return false
		if int(position[0]) % TILE_SIZE != TILE_SIZE / 2 or int(position[1]) % TILE_SIZE != TILE_SIZE / 2:
			return false
	return true


func _entity_cell(entity: Dictionary) -> Vector2i:
	var position: Array = entity.get("position", [])
	if position.size() < 2:
		return Vector2i(-1, -1)
	return Vector2i(floori(float(position[0]) / TILE_SIZE), floori(float(position[1]) / TILE_SIZE))


func _door_targets_are_reciprocal(doors: Array, floor: Dictionary) -> bool:
	if doors.is_empty():
		return true
	var targets := {}
	for raw_door: Variant in doors:
		if not raw_door is Dictionary:
			return false
		var door := raw_door as Dictionary
		var target_position: Array = door.get("target_position", [])
		if target_position.size() < 2:
			return false
		var source := _entity_cell(door)
		var target := Vector2i(floori(float(target_position[0]) / TILE_SIZE), floori(float(target_position[1]) / TILE_SIZE))
		if not floor.has(source) or not floor.has(target):
			return false
		targets[source] = target
	for raw_door: Variant in doors:
		var door := raw_door as Dictionary
		var source := _entity_cell(door)
		var target: Vector2i = targets.get(source, Vector2i(-1, -1))
		if not targets.has(target) or Vector2i(targets[target]) != source:
			return false
	return true


func _reachable(floor: Dictionary, start: Vector2i, blocked: Dictionary, doors: Array) -> Dictionary:
	var reachable := {}
	if not floor.has(start) or blocked.has(start):
		return reachable
	var door_edges := {}
	for raw_door: Variant in doors:
		var door := raw_door as Dictionary
		var target_position: Array = door.get("target_position", [])
		if target_position.size() < 2:
			continue
		var source := _entity_cell(door)
		var target := Vector2i(floori(float(target_position[0]) / TILE_SIZE), floori(float(target_position[1]) / TILE_SIZE))
		var targets: Array = door_edges.get(source, [])
		targets.append(target)
		door_edges[source] = targets
	var queue: Array[Vector2i] = [start]
	reachable[start] = true
	var cursor := 0
	while cursor < queue.size():
		var current := queue[cursor]
		cursor += 1
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next := current + direction
			if floor.has(next) and not blocked.has(next) and not reachable.has(next):
				reachable[next] = true
				queue.append(next)
		for next_value: Variant in door_edges.get(current, []):
			var next: Vector2i = next_value
			if floor.has(next) and not blocked.has(next) and not reachable.has(next):
				reachable[next] = true
				queue.append(next)
	return reachable


func _no_overlap(left: Dictionary, right: Dictionary) -> bool:
	for cell: Vector2i in left:
		if right.has(cell):
			return false
	return true


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("CHAPTER 1 MAP DESIGN FAIL: " + message)


func _finish() -> void:
	var report := {
		"checks": _checks,
		"failures": _failures,
		"maps": _map_summaries,
	}
	var report_path := "res://.artifacts/chapter_1_campaign_map_design_report.json"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var file := FileAccess.open(ProjectSettings.globalize_path(report_path), FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t"))
		file.close()
	if _failures.is_empty():
		print("CHAPTER 1 CAMPAIGN MAP DESIGN PASSED - %d checks across ten maps" % _checks)
		quit(0)
		return
	print("CHAPTER 1 CAMPAIGN MAP DESIGN FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)
