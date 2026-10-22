extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_6.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")
const PACK_RULES := preload("res://game/content/encounters/encounter_pack_rules.gd")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var document := _load_json(MAP_PATH)
	_expect(not document.is_empty(), "Level 6 live smoke map loads")
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "Shared gameplay scene instantiates for campaign-ready Level 6")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame

	var entity_root := game.get_node("Level/Entities") as Node2D
	var expected_density_bonus := PACK_RULES.expected_bonus_count(
		document.get("metadata", {}),
		6,
		GameSession.active_difficulty,
	)
	var expected_authored_entities := 0
	for entity_value: Variant in document.get("entities", []):
		if entity_value is Dictionary and String((entity_value as Dictionary).get("type", "")) != "player":
			expected_authored_entities += 1
	var live_entity_ids := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			live_entity_ids[entity_id] = child
	_expect(
		live_entity_ids.size() == expected_authored_entities + expected_density_bonus,
		"Live gameplay spawns every authored Level 6 entity plus the selected difficulty's encounter packs (expected %d IDs, got %d)" % [
			expected_authored_entities + expected_density_bonus,
			live_entity_ids.size(),
		],
	)
	for anchor_id: String in ["l6_soul_anchor_01", "l6_soul_anchor_02", "l6_soul_anchor_03"]:
		_expect(live_entity_ids.has(anchor_id), "Live gameplay spawns %s" % anchor_id)

	var live_snapshot: Dictionary = game.get_runtime_snapshot()
	var session := live_snapshot.get("session", {}) as Dictionary
	var encounter := session.get("encounter", {}) as Dictionary
	_expect(bool(encounter.get("configured", false)), "Live gameplay configures the Level 6 encounter runtime")
	_expect(int(encounter.get("total_enemies", 0)) == 12, "Live gameplay tracks all twelve spawned enemies")
	_expect(not bool(encounter.get("complete", true)), "Live Level 6 encounter starts incomplete")
	var exit_gate := live_entity_ids.get("l6_exit") as ExitGate
	_expect(exit_gate != null and exit_gate.is_encounter_requirement_cleared() and exit_gate.is_open, "Live Level 6 exit is reachable immediately")

	game.queue_free()
	await get_tree().process_frame
	_finish()


func _load_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("LEVEL 6 LIVE RUNTIME FAIL: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 6 LIVE RUNTIME PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("CHAPTER 1 LEVEL 6 LIVE RUNTIME FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
