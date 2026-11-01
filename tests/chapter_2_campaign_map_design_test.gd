extends SceneTree

const MAP_PATH_FORMAT := "res://data/levels/chapter_2_level_%d.json"
const LEVEL_SCHEMA := preload("res://game/levels/level_schema.gd")
const FIRST_LEVEL := 11
const LAST_LEVEL := 20

var _checks := 0
var _failures: Array[String] = []
var _floor_masks: Dictionary = {}


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	for level_number: int in range(FIRST_LEVEL, LAST_LEVEL + 1):
		_test_level(level_number)
	_test_distinct_layouts()
	_finish()


func _test_level(level_number: int) -> void:
	var path := MAP_PATH_FORMAT % level_number
	var file := FileAccess.open(path, FileAccess.READ)
	_expect(file != null, "L%d map file opens" % level_number)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(parsed is Dictionary, "L%d map parses as an object" % level_number)
	if not parsed is Dictionary:
		return
	var document := parsed as Dictionary
	var validation: Dictionary = LEVEL_SCHEMA.validate_level(document)
	_expect(
		bool(validation.get("ok", false)),
		"L%d passes LevelSchema: %s" % [level_number, validation.get("error", "")]
	)

	var layers := document.get("layers", {}) as Dictionary
	var floor_cells := _cells_by_position(layers.get("Backdrop", []))
	var geometry_cells := _cells_by_position(layers.get("Geometry", []))
	_floor_masks[level_number] = floor_cells
	_expect(floor_cells.size() >= 2200, "L%d retains a full-scale navigable arena" % level_number)
	_expect(
		_no_overlap(floor_cells, geometry_cells),
		"L%d walls and broken-floor cover never overwrite walkable floor" % level_number
	)
	_expect(_is_one_component(floor_cells), "L%d has one connected walkable route" % level_number)

	var metadata := document.get("metadata", {}) as Dictionary
	_expect(
		int(metadata.get("map_design_revision", 0)) == 2,
		"L%d is on the authored tactical-map revision" % level_number
	)
	_expect(
		not String(metadata.get("mapplay_signature", "")).strip_edges().is_empty(),
		"L%d documents its unique play-space signature" % level_number
	)
	_expect(
		String(metadata.get("layout_profile", "")) != "",
		"L%d retains its objective-specific layout profile" % level_number
	)

	var player_position := Vector2i(-1, -1)
	for raw_entity: Variant in document.get("entities", []):
		if not raw_entity is Dictionary:
			continue
		var entity := raw_entity as Dictionary
		var position: Array = entity.get("position", [])
		if position.size() < 2:
			continue
		var cell := Vector2i(floori(float(position[0]) / 16.0), floori(float(position[1]) / 16.0))
		var entity_id := String(entity.get("id", "entity"))
		_expect(
			floor_cells.has(cell),
			"L%d marker %s remains on walkable floor" % [level_number, entity_id]
		)
		if String(entity.get("type", "")) == "player":
			player_position = cell
	_expect(
		_reachable(floor_cells, player_position).size() == floor_cells.size(),
		"L%d player can traverse every authored lane and pocket" % level_number
	)


func _test_distinct_layouts() -> void:
	for first: int in range(FIRST_LEVEL, LAST_LEVEL + 1):
		for second: int in range(first + 1, LAST_LEVEL + 1):
			var first_mask: Dictionary = _floor_masks.get(first, {})
			var second_mask: Dictionary = _floor_masks.get(second, {})
			var difference := 0
			for position: Vector2i in first_mask:
				if not second_mask.has(position):
					difference += 1
			for position: Vector2i in second_mask:
				if not first_mask.has(position):
					difference += 1
			_expect(
				difference >= 48,
				(
					"L%d and L%d have meaningfully different floor silhouettes (%d cells)"
					% [first, second, difference]
				)
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


func _no_overlap(first: Dictionary, second: Dictionary) -> bool:
	for position: Vector2i in first:
		if second.has(position):
			return false
	return true


func _is_one_component(floor_cells: Dictionary) -> bool:
	if floor_cells.is_empty():
		return false
	var first: Vector2i = floor_cells.keys()[0]
	return _reachable(floor_cells, first).size() == floor_cells.size()


func _reachable(floor_cells: Dictionary, start: Vector2i) -> Dictionary:
	var reachable := {}
	if not floor_cells.has(start):
		return reachable
	var queue: Array[Vector2i] = [start]
	reachable[start] = true
	var index := 0
	while index < queue.size():
		var current := queue[index]
		index += 1
		for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next := current + direction
			if floor_cells.has(next) and not reachable.has(next):
				reachable[next] = true
				queue.append(next)
	return reachable


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("FAIL: " + message)


func _finish() -> void:
	print("Chapter 2 campaign map design: %d checks, %d failures." % [_checks, _failures.size()])
	quit(1 if not _failures.is_empty() else 0)
