extends Node

const TEST_SAVE_PATH := "user://tests/chapter_1_level_8_fresh_route_test.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_8_fresh_route_report.json"
const CAMPAIGN_REGISTRY: LevelRegistry = preload(
	"res://data/content/registries/campaign_content_registry.tres"
)

var _checks := 0
var _failures: Array[String] = []


class FakeAppRoot:
	extends Node
	var route_id: StringName
	var payload: Dictionary = {}

	func show_route(
		_scene_path: String, next_payload: Dictionary, next_route_id: StringName
	) -> void:
		route_id = next_route_id
		payload = next_payload.duplicate(true)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_run.call_deferred()


func _run() -> void:
	var save_service := get_tree().root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var app_flow := get_tree().root.get_node_or_null("AppFlow")
	_expect(
		save_service != null and app_flow != null,
		"Production SaveService and AppFlow autoloads exist"
	)
	if save_service == null or app_flow == null:
		_finish(app_flow, null)
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(
		save_service.configure_storage(TEST_SAVE_PATH, true),
		"Fresh isolated Level 1-8 profile loads"
	)
	var fake_root := FakeAppRoot.new()
	get_tree().root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	for campaign_slot: int in range(1, 8):
		var level := CAMPAIGN_REGISTRY.find_campaign_level(campaign_slot)
		_expect(
			level != null and level.is_campaign_ready(),
			"Campaign slot %d is CAMPAIGN_READY on the sequential route" % campaign_slot
		)
		if level == null:
			continue
		_expect(
			bool(app_flow.call(&"is_campaign_level_unlocked", level.level_id)),
			"Campaign slot %d unlocks from the prior clear" % campaign_slot
		)
		_expect(
			bool(app_flow.call(&"start_campaign_level", level.level_id)),
			"Campaign slot %d starts through AppFlow" % campaign_slot
		)
		app_flow.call(
			&"complete_active_run", {"route_gate": true, "campaign_slot": campaign_slot}, true
		)
		var slot_result := app_flow.call(&"get_last_result") as Dictionary
		_expect(
			(
				fake_root.route_id == &"gameplay"
				and bool(
					(slot_result.get("continuation", {}) as Dictionary).get("can_continue", false)
				)
				and bool(app_flow.call(&"is_campaign_level_completed", level.level_id))
			),
			(
				"Campaign slot %d commits in-place, offers the next level, and persists"
				% campaign_slot
			),
		)

	var level_eight := CAMPAIGN_REGISTRY.find_campaign_level(8)
	_expect(
		level_eight != null and level_eight.is_campaign_ready(),
		"Level 8 is promoted behind this fresh-route gate"
	)
	_expect(
		bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_8")),
		"Level 7 first clear unlocks Level 8"
	)
	_expect(
		bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_8")),
		"Fresh sequential profile starts Level 8"
	)
	var run: Dictionary = app_flow.call(&"get_active_run")
	_expect(
		run.get("level_id") == &"chapter_1_level_8" and int(run.get("campaign_slot", 0)) == 8,
		"Level 8 run payload resolves the promoted authored definition"
	)
	_expect(
		String(run.get("layout_data_path", "")) == "res://data/levels/chapter_1_level_8.json",
		"Run payload carries the dedicated divided Reliquary map"
	)

	app_flow.call(&"detach_app_root", fake_root)
	get_tree().root.remove_child(fake_root)
	fake_root.free()
	var app_root_scene := load("res://game/app/app_root.tscn") as PackedScene
	_expect(app_root_scene != null, "Production AppRoot scene loads")
	if app_root_scene == null:
		_finish(app_flow, null)
		return
	var app_root := app_root_scene.instantiate()
	get_tree().root.add_child(app_root)
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(
		app_root.call(&"get_current_route") == &"gameplay", "Real AppRoot enters Level 8 gameplay"
	)

	_expect(
		await _play_live_level_eight(app_root, &"reaper"),
		"Fresh route physically clears the Reaper branch, chest, and exit"
	)
	_expect(
		app_root.call(&"get_current_route") == &"gameplay",
		"Live Level 8 completion keeps gameplay mounted"
	)
	var first_result: Dictionary = app_flow.call(&"get_last_result")
	var first_reward := first_result.get("reward", {}) as Dictionary
	_expect(
		(
			first_result.get("level_id") == &"chapter_1_level_8"
			and first_result.get("outcome") == &"victory"
		),
		"In-place completion records a Level 8 victory"
	)
	_expect(
		(
			bool(first_reward.get("granted", false))
			and not bool(first_reward.get("already_claimed", true))
		),
		"First clear commits its reward exactly once"
	)
	_expect(
		(
			int(first_reward.get("previous_player_level", 0)) >= 8
			and (
				int(first_reward.get("current_player_level", 0))
				== int(first_reward.get("previous_player_level", 0)) + 1
			)
			and int(first_reward.get("player_level_gained", 0)) == 1
		),
		"First clear visibly grants exactly one Player Level after realtime combat XP",
	)
	var first_aux := first_reward.get("auxiliary_equipment", []) as Array
	_expect(
		first_aux.size() == 1, "First-clear completion payload contains one unique auxiliary item"
	)
	var epic_summary := first_aux[0] as Dictionary if first_aux.size() == 1 else {}
	_expect(
		(
			String(epic_summary.get("rarity", "")) == "epic"
			and String(epic_summary.get("slot", "")) == "soul_vessel"
			and int(epic_summary.get("item_level", 0)) == 8
		),
		"completion payload exposes the deterministic Epic Soul Vessel Lv8"
	)
	_expect(
		(
			not bool(epic_summary.get("auto_equipped", true))
			and not bool(epic_summary.get("equipped", true))
		),
		"Epic comparison item does not silently replace the equipped Vessel"
	)

	var route_host := app_root.get_node("RouteHost")
	var gameplay_screen := route_host.get_child(0) if route_host.get_child_count() == 1 else null
	var completion_choice := (
		gameplay_screen.find_child("CompletionChoice", true, false) as CompletionChoice
		if gameplay_screen != null
		else null
	)
	_expect(
		(
			completion_choice != null
			and completion_choice.visible
			and completion_choice.find_child("RewardList", true, false) == null
		),
		"completion renders only the continuation question, never a reward summary"
	)
	var next_button := (
		completion_choice.find_child("NextButton", true, false) as Button
		if completion_choice != null
		else null
	)
	_expect(
		next_button != null and not next_button.disabled,
		"first clear offers the unlocked next level immediately"
	)
	_expect(
		bool(save_service.call(&"is_transaction_applied", "campaign:chapter_1_level_8:complete")),
		"One campaign completion transaction owns Level 8 reward delivery"
	)
	_expect(
		(
			bool(save_service.get_value(["progression", "features", "hero_soul_inventory"], false))
			and bool(save_service.get_value(["progression", "features", "hero_soul_sell"], false))
		),
		"Level 8 atomically persists both declared Hero Soul features"
	)
	var epic_uuid := String(epic_summary.get("uuid", ""))
	_expect(
		not epic_uuid.is_empty() and _count_aux_uuid(save_service, epic_uuid) == 1,
		"Save contains exactly one deterministic Epic item UUID"
	)
	var currencies_after_first := save_service.get_value(["currencies"], {}) as Dictionary
	var level_after_first := int(save_service.get_value(["progression", "player", "level"], 0))

	_expect(
		bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_8")),
		"Completed Level 8 remains replayable"
	)
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(
		await _play_live_level_eight(app_root, &"vampire"),
		"Replay physically clears the alternate Vampire branch, chest, and exit"
	)
	var replay_result: Dictionary = app_flow.call(&"get_last_result")
	var replay_reward := replay_result.get("reward", {}) as Dictionary
	_expect(
		(
			not bool(replay_reward.get("granted", true))
			and bool(replay_reward.get("already_claimed", false))
		),
		"Replay completion explicitly reports no duplicate first-clear grant"
	)
	_expect(
		(
			int(replay_reward.get("player_level_gained", -1)) == 0
			and (
				int(save_service.get_value(["progression", "player", "level"], 0))
				>= level_after_first
			)
		),
		"Replay grants no duplicate completion level while still retaining realtime kill XP",
	)
	_expect(
		save_service.get_value(["currencies"], {}) == currencies_after_first,
		"Replay grants no duplicate currency or materials"
	)
	_expect(
		_count_aux_uuid(save_service, epic_uuid) == 1, "Replay cannot duplicate the Epic item UUID"
	)
	route_host = app_root.get_node("RouteHost")
	gameplay_screen = route_host.get_child(0) if route_host.get_child_count() == 1 else null
	completion_choice = (
		gameplay_screen.find_child("CompletionChoice", true, false) as CompletionChoice
		if gameplay_screen != null
		else null
	)
	_expect(
		(
			completion_choice != null
			and completion_choice.visible
			and completion_choice.find_child("RewardList", true, false) == null
		),
		"replay returns to the same summary-free continuation question"
	)
	_finish(app_flow, app_root)


func _play_live_level_eight(app_root: Node, branch_id: StringName) -> bool:
	var route_host := app_root.get_node_or_null("RouteHost")
	var game := (
		route_host.get_child(0)
		if route_host != null and route_host.get_child_count() == 1
		else null
	)
	var controller := game.get_node_or_null("Level8ReliquaryRuntime") if game != null else null
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D if game != null else null
	var player := (
		entity_root.get_node_or_null("Knight") as CharacterBody2D if entity_root != null else null
	)
	var seal := (
		controller.call(&"get_branch_seal", branch_id) as Node if controller != null else null
	)
	if game == null or controller == null or entity_root == null or player == null or seal == null:
		return false
	player.global_position = seal.global_position + Vector2(0.0, 32.0)
	player.velocity = Vector2.ZERO
	for _frame: int in 3:
		await get_tree().physics_frame
	if not bool(seal.call(&"can_interact", player)) or not bool(seal.call(&"interact", player)):
		return false
	await get_tree().process_frame
	var enemy_type := "skeleton_reaper" if branch_id == &"reaper" else "vampire"
	var victims: Array[Node] = []
	for child: Node in entity_root.get_children():
		if (
			String(child.get_meta(&"level_entity_type", "")) == enemy_type
			and child.has_method(&"take_damage")
		):
			victims.append(child)
	for victim: Node in victims:
		victim.call(&"take_damage", 99999, Vector2.ZERO)
	await get_tree().process_frame
	await get_tree().process_frame
	var entities := _live_entities(entity_root)
	var chest := entities.get("l8_elite_chest") as Node
	var exit_gate := entities.get("l8_exit") as Node
	if chest == null or bool(chest.call(&"is_interaction_locked")) or exit_gate == null:
		return false
	chest.call(&"_on_body_entered", player)
	if not bool(chest.call(&"interact", player)):
		return false
	await get_tree().process_frame
	if not bool(exit_gate.get("is_open")):
		return false
	exit_gate.call(&"_on_body_entered", player)
	await get_tree().process_frame
	var game_session := get_tree().root.get_node_or_null("GameSession")
	var choice := game.get_node_or_null("HUD/HUDRoot/CompletionChoice") as CompletionChoice
	return (
		game_session != null
		and bool(game_session.get("objective_finished"))
		and choice != null
		and choice.visible
		and get_tree().paused
	)


func _wait_for_route(app_root: Node, expected: StringName, maximum_frames: int) -> void:
	for _frame: int in maximum_frames:
		if app_root.call(&"get_current_route") == expected:
			return
		await get_tree().process_frame


func _live_entities(entity_root: Node2D) -> Dictionary:
	var result := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = child
	return result


func _count_aux_uuid(save_service: Node, uuid: String) -> int:
	var result := 0
	var path: Array[String] = ["inventory", "auxiliary_equipment"]
	var items := save_service.call(&"get_value", path, []) as Array
	for raw_item: Variant in items:
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			result += 1
	return result


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error("LEVEL 8 FRESH ROUTE FAIL: %s" % message)


func _finish(app_flow: Node, app_root: Node) -> void:
	get_tree().paused = false
	if app_flow != null and app_root != null:
		app_flow.call(&"detach_app_root", app_root)
		if is_instance_valid(app_root):
			for audio_node: Node in app_root.find_children("*", "AudioStreamPlayer", true, false):
				(audio_node as AudioStreamPlayer).stop()
			app_root.free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 8 FRESH ROUTE PASSED - %d checks" % _checks)
	else:
		print(
			(
				"CHAPTER 1 LEVEL 8 FRESH ROUTE FAILED - %d/%d checks failed"
				% [_failures.size(), _checks]
			)
		)
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	# Give the headless audio mixer one real tick to release short pickup/book
	# playbacks before process exit; otherwise this route is nondeterministically
	# reported as an ObjectDB resource leak despite all assertions passing.
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
