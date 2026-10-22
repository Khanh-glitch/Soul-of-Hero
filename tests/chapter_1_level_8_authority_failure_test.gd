extends Node

const MAP_PATH := "res://data/levels/chapter_1_level_8.json"
const GAME_SCENE: PackedScene = preload("res://game/main.tscn")

var _checks := 0
var _failures: Array[String] = []


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var game := GAME_SCENE.instantiate() as Node2D
	_expect(game != null, "Failure-injection test starts production Level 8")
	if game == null:
		_finish()
		return
	var dungeon := game.get_node("Level") as DungeonLevel
	dungeon.level_data_path = MAP_PATH
	dungeon.watch_file_changes = false
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var controller := game.get_node_or_null("Level8ReliquaryRuntime")
	var entity_root := game.get_node("Level/Entities") as Node2D
	var player := game.get_node("Level/Entities/Knight") as Node2D
	var seal := controller.call(&"get_branch_seal", &"reaper") as ReliquaryBranchSeal if controller != null else null
	var other := controller.call(&"get_branch_seal", &"vampire") as ReliquaryBranchSeal if controller != null else null
	_expect(controller != null and seal != null and other != null, "Live runtime resolves both authority-owned branch seals")
	if controller == null or seal == null or other == null:
		await _dispose_game(game)
		_finish()
		return
	seal.call(&"_on_body_entered", player)

	var attempts := {"count": 0}
	controller.call(&"set_branch_spawn_override_for_test", func(marker_id: StringName) -> Node2D:
		attempts["count"] = int(attempts["count"]) + 1
		if int(attempts["count"]) == 2:
			return null
		return game.call(&"spawn_deferred_level_entity", marker_id) as Node2D
	)
	_expect(seal.interact(player), "A selected-branch spawn failure is safely consumed")
	await get_tree().process_frame
	_assert_branch_rolled_back(controller, seal, other, entity_root, "spawn rejection")

	controller.call(&"set_branch_spawn_override_for_test", Callable())
	controller.call(&"set_elite_apply_override_for_test", func(_enemy: Node2D, _modifier: Resource) -> bool: return false)
	_expect(seal.interact(player), "An Elite-application failure is safely consumed")
	await get_tree().process_frame
	_assert_branch_rolled_back(controller, seal, other, entity_root, "Elite rejection")

	controller.call(&"set_elite_apply_override_for_test", Callable())
	_expect(seal.interact(player), "The same branch seal accepts a retry after spawn/Elite authority recovers")
	await get_tree().process_frame
	var committed: Dictionary = controller.call(&"get_snapshot")
	_expect(String(committed.get("selected_branch", "")) == "reaper" and int(committed.get("spawned_count", 0)) == 6, "Successful retry commits the exact six-actor Reaper route")
	_expect(seal.get_branch_state() == ReliquaryBranchSeal.SealState.CHOSEN and other.get_branch_state() == ReliquaryBranchSeal.SealState.LOCKED, "Only successful materialisation locks the physical branch choice")

	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_type", "")) == "skeleton_reaper" and child.has_method(&"take_damage"):
			child.call(&"take_damage", 99999, Vector2.ZERO)
	await get_tree().process_frame
	await get_tree().process_frame
	var chest := _entity(entity_root, &"l8_elite_chest") as RewardChest
	_expect(chest != null and not chest.is_interaction_locked(), "Clearing the committed branch exposes the physical Elite chest")
	if chest != null:
		chest.call(&"_on_body_entered", player)
		controller.call(&"set_event_commit_override_for_test", func(_event_id: StringName, _amount: int) -> bool: return false)
		var score_before := GameSession.score
		var sigils_before := GameSession.sigils
		_expect(chest.interact(player), "A rejected Elite chest commit is safely consumed")
		await get_tree().process_frame
		var rejected: Dictionary = controller.call(&"get_snapshot")
		var rejected_event := _event_count(game, &"elite_chest_claimed")
		_expect(not chest.is_open() and chest.can_interact(player) and not bool(rejected.get("chest_claimed", true)), "Rejected Elite chest stays closed and retryable")
		_expect(GameSession.score == score_before and GameSession.sigils == sigils_before and rejected_event == 0, "Rejected Elite chest grants no score, sigil, or event")
		controller.call(&"set_event_commit_override_for_test", Callable())
		_expect(chest.interact(player), "The same Elite chest accepts a retry after event authority recovers")
		await get_tree().process_frame
		_expect(chest.is_open() and GameSession.score == score_before + chest.score_reward and GameSession.sigils == sigils_before + 1, "Successful retry grants the physical chest reward exactly once")
		_expect(_event_count(game, &"elite_chest_claimed") == 1 and bool((controller.call(&"get_snapshot") as Dictionary).get("chest_claimed", false)), "Successful retry commits exactly one event and runtime claim")
	await _dispose_game(game)
	_finish()


func _dispose_game(game: Node) -> void:
	if not is_instance_valid(game):
		return
	for audio_node: Node in game.find_children("*", "", true, false):
		if audio_node is AudioStreamPlayer:
			(audio_node as AudioStreamPlayer).stop()
		elif audio_node is AudioStreamPlayer2D:
			(audio_node as AudioStreamPlayer2D).stop()
	game.free()
	# Rejected/retried chest feedback may outlive the node for a mixer tick.
	await get_tree().create_timer(0.10, true).timeout


func _assert_branch_rolled_back(controller: Node, seal: ReliquaryBranchSeal, other: ReliquaryBranchSeal, entity_root: Node2D, label: String) -> void:
	var snapshot: Dictionary = controller.call(&"get_snapshot")
	_expect(String(snapshot.get("selected_branch", "")).is_empty() and int(snapshot.get("spawned_count", -1)) == 0, "%s leaves no committed branch/runtime actors" % label)
	_expect(seal.get_branch_state() == ReliquaryBranchSeal.SealState.AVAILABLE and other.get_branch_state() == ReliquaryBranchSeal.SealState.AVAILABLE, "%s leaves both physical seals retryable" % label)
	var live_branch_enemies := 0
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		var entity_type := String(child.get_meta(&"level_entity_type", ""))
		if (entity_id.begins_with("l8_reaper_") and entity_type == "skeleton_reaper") \
				or (entity_id.begins_with("l8_vampire_") and entity_type == "vampire"):
			live_branch_enemies += 1
	_expect(live_branch_enemies == 0, "%s removes every partially spawned actor" % label)


func _entity(root: Node2D, id: StringName) -> Node:
	for child: Node in root.get_children():
		if StringName(child.get_meta(&"level_entity_id", "")) == id:
			return child
	return null


func _event_count(game: Node, id: StringName) -> int:
	var encounter: Dictionary = (game.call(&"get_runtime_snapshot") as Dictionary).get("session", {}).get("encounter", {})
	return int((encounter.get("custom_events", {}) as Dictionary).get(id, 0))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 8 AUTHORITY FAILURE TEST: %s" % message)


func _finish() -> void:
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 8 AUTHORITY FAILURE PASSED - %d checks" % _checks)
		get_tree().quit(0)
		return
	print("CHAPTER 1 LEVEL 8 AUTHORITY FAILURE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(1)
