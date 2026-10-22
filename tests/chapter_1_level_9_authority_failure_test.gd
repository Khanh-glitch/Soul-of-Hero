extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_9.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "Failure-injection test starts the production Level 9 scene")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame

	var controller := game.get_node_or_null("Level9CrimsonGateRuntime")
	var player := game.get_node("Level/Entities/Knight") as Node2D
	var seal := controller.call(&"get_gate_seal", &"l9_west_gate_seal") as GateSeal if controller != null else null
	_expect(controller != null and seal != null, "Live runtime resolves an authority-owned Gate Seal")
	if controller == null or seal == null:
		await _teardown_game(game)
		_finish()
		return

	controller.call(&"set_event_commit_override_for_test", func(_event_id: StringName, _amount: int) -> bool: return false)
	seal.call(&"_on_body_entered", player)
	var sigils_before := GameSession.sigils
	_expect(seal.interact(player), "Rejected authority attempt is safely consumed without losing interactivity")
	await get_tree().process_frame
	var rejected: Dictionary = controller.call(&"get_snapshot")
	var rejected_encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(not seal.is_activated() and seal.can_interact(player), "Rejected Gate Seal remains physically intact and retryable")
	_expect(int(rejected.get("activated_seals", -1)) == 0, "Rejected Gate Seal does not advance runtime count")
	_expect(GameSession.sigils == sigils_before, "Rejected Gate Seal grants no portal sigil")
	_expect(int((rejected_encounter.get("custom_events", {}) as Dictionary).get("gate_seal_collected", 0)) == 0, "Rejected Gate Seal grants no canonical event")

	controller.call(&"set_event_commit_override_for_test", Callable())
	_expect(seal.interact(player), "The same physical Gate Seal accepts a retry after authority recovers")
	await get_tree().process_frame
	var committed: Dictionary = controller.call(&"get_snapshot")
	var committed_encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	_expect(seal.is_activated() and int(committed.get("activated_seals", 0)) == 1, "Successful retry commits physical and runtime state exactly once")
	_expect(GameSession.sigils == sigils_before + 1, "Successful retry grants exactly one portal sigil")
	_expect(int((committed_encounter.get("custom_events", {}) as Dictionary).get("gate_seal_collected", 0)) == 1, "Successful retry commits exactly one canonical event")
	await _teardown_game(game)
	_finish()


func _teardown_game(game: Node) -> void:
	if not is_instance_valid(game):
		return
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer", true, false):
		(audio_node as AudioStreamPlayer).stop()
	for audio_node: Node in game.find_children("*", "AudioStreamPlayer2D", true, false):
		(audio_node as AudioStreamPlayer2D).stop()
	game.queue_free()
	await get_tree().process_frame


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 9 AUTHORITY FAILURE TEST: %s" % message)


func _finish() -> void:
	get_tree().paused = false
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 9 AUTHORITY FAILURE PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 9 AUTHORITY FAILURE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
