extends SceneTree

const TEST_SAVE_PATH := "user://tests/chapter_1_level_10_fresh_route_test.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_10_fresh_route_report.json"
const CAMPAIGN_REGISTRY: LevelRegistry = preload("res://data/content/registries/campaign_content_registry.tres")

var _checks := 0
var _failures: Array[String] = []


class FakeAppRoot extends Node:
	var route_id: StringName
	var payload: Dictionary = {}

	func show_route(_scene_path: String, next_payload: Dictionary, next_route_id: StringName) -> void:
		route_id = next_route_id
		payload = next_payload.duplicate(true)


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var save_service := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var app_flow := root.get_node_or_null("AppFlow")
	_expect(save_service != null and app_flow != null, "Production SaveService and AppFlow autoloads exist")
	if save_service == null or app_flow == null:
		_finish(app_flow, null)
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "Fresh isolated Level 1-10 profile loads")
	var fake_root := FakeAppRoot.new()
	root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	for campaign_slot: int in range(1, 10):
		var level := CAMPAIGN_REGISTRY.find_campaign_level(campaign_slot)
		_expect(level != null and level.is_campaign_ready(), "Campaign slot %d is CAMPAIGN_READY on the sequential route" % campaign_slot)
		if level == null:
			continue
		_expect(bool(app_flow.call(&"is_campaign_level_unlocked", level.level_id)), "Campaign slot %d unlocks from the prior clear" % campaign_slot)
		_expect(bool(app_flow.call(&"start_campaign_level", level.level_id)), "Campaign slot %d starts through AppFlow" % campaign_slot)
		app_flow.call(&"complete_active_run", {"route_gate": true, "campaign_slot": campaign_slot}, true)
		var slot_result := app_flow.call(&"get_last_result") as Dictionary
		_expect(
			fake_root.route_id == &"gameplay"
				and bool((slot_result.get("continuation", {}) as Dictionary).get("can_continue", false))
				and bool(app_flow.call(&"is_campaign_level_completed", level.level_id)),
			"Campaign slot %d commits in-place, offers the next level, and persists" % campaign_slot,
		)

	var level_ten := CAMPAIGN_REGISTRY.find_campaign_level(10)
	_expect(level_ten != null and level_ten.is_campaign_ready(), "Level 10 is promoted behind the full boss gate")
	_expect(bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_10")), "Level 9 first clear unlocks Level 10")
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_10")), "Fresh sequential profile starts Level 10")
	var run: Dictionary = app_flow.call(&"get_active_run")
	_expect(run.get("level_id") == &"chapter_1_level_10" and int(run.get("campaign_slot", 0)) == 10, "Level 10 run payload resolves the promoted authored definition")
	_expect(String(run.get("layout_data_path", "")) == "res://data/levels/chapter_1_level_10.json", "Run payload carries the dedicated Castellan throne map")

	app_flow.call(&"detach_app_root", fake_root)
	root.remove_child(fake_root)
	fake_root.free()
	var app_root_scene := load("res://game/app/app_root.tscn") as PackedScene
	_expect(app_root_scene != null, "Production AppRoot scene loads")
	if app_root_scene == null:
		_finish(app_flow, null)
		return
	var app_root := app_root_scene.instantiate()
	root.add_child(app_root)
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(app_root.call(&"get_current_route") == &"gameplay", "Real AppRoot enters Level 10 gameplay")

	# Real failure/retry gate: reach Phase 2, emit projectiles, die, then rebuild
	# gameplay. The replacement actor must be clean Phase 1 with no stale disc.
	var first_game := _current_route_node(app_root)
	var first_controller := first_game.get_node_or_null("Level10CastellanRuntime") if first_game != null else null
	var first_boss: Node = first_controller.call(&"get_boss") as Node if first_controller != null else null
	var first_player: Node = first_game.get_node_or_null("Level/Entities/Knight") if first_game != null else null
	_expect(first_boss != null and first_player != null, "Fresh route owns the real boss and player")
	if first_boss != null and first_player != null:
		first_boss.set_physics_process(false)
		first_boss.call(&"take_damage", int(first_boss.get("max_health")) - int(first_boss.call(&"get_phase_two_threshold_health")), (first_player as Node2D).global_position)
		first_boss.call(&"_update_phase_transition", 1.20)
		(first_player as Node2D).global_position = (first_boss as Node2D).global_position + Vector2(120.0, 0.0)
		first_boss.debug_begin_pattern(&"disc_fan")
		first_boss.call(&"_update_telegraph", 0.84)
		_expect(_count_castellan_discs(first_game) == 3, "Failure fixture creates the real Phase-2 projectile fan")
		first_player.call(&"kill")
		_expect(paused, "Real player death opens the paused defeat flow")
	paused = false
	app_flow.call(&"retry_active_run")
	await _wait_for_route(app_root, &"gameplay", 180)
	var retry_game := _current_route_node(app_root)
	var retry_controller := retry_game.get_node_or_null("Level10CastellanRuntime") if retry_game != null else null
	var retry_boss: Node = retry_controller.call(&"get_boss") as Node if retry_controller != null else null
	_expect(retry_boss != null and int(retry_boss.get("phase")) == 1 and int(retry_boss.get("health")) == int(retry_boss.get("max_health")), "AppFlow Retry replaces the failed boss with clean full Phase 1")
	_expect(_count_castellan_discs(retry_game) == 0, "AppFlow Retry leaves no projectile from the failed scene")

	_expect(await _play_live_level_ten(app_root), "Fresh route physically clears both phases and crosses the real exit")
	_expect(app_root.call(&"get_current_route") == &"gameplay", "Live Level 10 completion keeps gameplay mounted")
	var first_result: Dictionary = app_flow.call(&"get_last_result")
	var first_reward := first_result.get("reward", {}) as Dictionary
	_expect(first_result.get("level_id") == &"chapter_1_level_10" and first_result.get("outcome") == &"victory", "In-place completion records a Level 10 victory")
	_expect(bool(first_reward.get("granted", false)) and not bool(first_reward.get("already_claimed", true)), "First clear commits its reward exactly once")
	_expect(
		int(first_reward.get("previous_player_level", 0)) >= 10
			and int(first_reward.get("current_player_level", 0))
				== int(first_reward.get("previous_player_level", 0)) + 1
			and int(first_reward.get("player_level_gained", 0)) == 1,
		"First clear visibly grants exactly one Player Level after realtime combat XP",
	)
	var first_souls := first_reward.get("hero_souls", []) as Array
	_expect(first_souls.size() == 1, "First-clear completion payload contains one deterministic Hero Soul")
	var epic_summary := first_souls[0] as Dictionary if first_souls.size() == 1 else {}
	_expect(String(epic_summary.get("rarity_name", "")) == "Epic" and String(epic_summary.get("hero_id", "")) == "sword_hero" and int(epic_summary.get("item_level", 0)) == 10, "completion payload exposes the Epic Sword Hero Soul Lv10")
	var epic_instance_id := String(epic_summary.get("instance_id", ""))
	_expect(not epic_instance_id.is_empty() and _count_soul_instance(save_service, epic_instance_id) == 1, "Save contains exactly one deterministic Epic Soul instance")
	for feature_id: String in ["hero_soul_fusion", "chapter_2_access", "hunt_replay"]:
		_expect(bool(save_service.get_value(["progression", "features", feature_id], false)), "First clear atomically persists %s" % feature_id)

	var route_host := app_root.get_node("RouteHost")
	var gameplay_screen := _current_route_node(app_root)
	var completion_choice := gameplay_screen.find_child("CompletionChoice", true, false) as CompletionChoice if gameplay_screen != null else null
	var picker_button := completion_choice.find_child("PickerButton", true, false) as Button if completion_choice != null else null
	_expect(completion_choice != null and completion_choice.visible and completion_choice.find_child("RewardList", true, false) == null, "completion renders only the continuation question, never a reward summary")
	_expect(picker_button != null and not picker_button.disabled, "final stage completion still offers replay/level farming")
	_expect(bool(save_service.call(&"is_transaction_applied", "campaign:chapter_1_level_10:complete")), "One atomic campaign transaction owns Level 10 first-clear delivery")
	var currencies_after_first := save_service.get_value(["currencies"], {}) as Dictionary
	var level_after_first := int(save_service.get_value(["progression", "player", "level"], 0))

	# Crash/idempotency: replaying completion for the same first-clear run must
	# match its atomic first-clear run receipt and pay no replay bounty.
	app_flow.call(&"complete_active_run", {"duplicate_callback": true}, true)
	var duplicate_first_reward := (app_flow.call(&"get_last_result") as Dictionary).get("reward", {}) as Dictionary
	var duplicate_first_bounty := duplicate_first_reward.get("replay_reward", {}) as Dictionary
	_expect(not bool(duplicate_first_bounty.get("granted", true)) and bool(duplicate_first_bounty.get("first_clear_run", false)), "Repeated first-clear callback is recognized as the same first-clear run")
	_expect(save_service.get_value(["currencies"], {}) == currencies_after_first and _count_soul_instance(save_service, epic_instance_id) == 1, "Repeated first-clear callback duplicates neither economy nor Epic Soul")

	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_10")), "Completed Level 10 remains replayable")
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(await _play_live_level_ten(app_root), "A genuine new Hunt replay clears the live boss and exit")
	var replay_result: Dictionary = app_flow.call(&"get_last_result")
	var replay_reward := replay_result.get("reward", {}) as Dictionary
	var replay_bounty := replay_reward.get("replay_reward", {}) as Dictionary
	_expect(not bool(replay_reward.get("granted", true)) and bool(replay_reward.get("already_claimed", false)), "Replay cannot duplicate the first-clear grant")
	_expect(bool(replay_bounty.get("granted", false)) and not bool(replay_bounty.get("already_claimed", true)), "New completed boss run receives one replay bounty")
	_expect(_currency_delta(currencies_after_first, save_service.get_value(["currencies"], {})) == {"account": 120, "hero_materials": 2, "monster_fragments": 1}, "Replay bounty is the authored smaller 120/2/1 economy grant")
	var level_after_replay := int(save_service.get_value(["progression", "player", "level"], 0))
	_expect(
		int(replay_reward.get("player_level_gained", -1)) == 0
			and level_after_replay >= level_after_first
			and _count_soul_instance(save_service, epic_instance_id) == 1,
		"Replay adds no completion level or Epic Soul while retaining realtime boss XP",
	)
	gameplay_screen = _current_route_node(app_root)
	completion_choice = gameplay_screen.find_child("CompletionChoice", true, false) as CompletionChoice if gameplay_screen != null else null
	_expect(completion_choice != null and completion_choice.visible and completion_choice.find_child("RewardList", true, false) == null, "boss replay returns to the same summary-free continuation question")
	var currencies_after_replay := save_service.get_value(["currencies"], {}) as Dictionary

	app_flow.call(&"complete_active_run", {"duplicate_replay_callback": true}, true)
	var duplicate_replay_reward := (app_flow.call(&"get_last_result") as Dictionary).get("reward", {}) as Dictionary
	var duplicate_replay_bounty := duplicate_replay_reward.get("replay_reward", {}) as Dictionary
	_expect(not bool(duplicate_replay_bounty.get("granted", true)) and bool(duplicate_replay_bounty.get("already_claimed", false)), "Repeated callback for the same replay run resolves its existing receipt")
	_expect(save_service.get_value(["currencies"], {}) == currencies_after_replay, "Repeated replay callback cannot duplicate its smaller bounty")
	_expect(
		_count_soul_instance(save_service, epic_instance_id) == 1
			and int(save_service.get_value(["progression", "player", "level"], 0)) == level_after_replay,
		"Duplicate callbacks preserve one Epic Soul and cannot add another completion level",
	)
	_finish(app_flow, app_root)


func _play_live_level_ten(app_root: Node) -> bool:
	var game := _current_route_node(app_root)
	if game == null:
		return false
	var controller := game.get_node_or_null("Level10CastellanRuntime")
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player: Node = entity_root.get_node_or_null("Knight") if entity_root != null else null
	var boss: Node = controller.call(&"get_boss") as Node if controller != null else null
	var entities := _live_entities(entity_root) if entity_root != null else {}
	var checkpoint: Node = entities.get("l10_checkpoint") as Node
	var exit_gate: Node = entities.get("l10_exit") as Node
	if controller == null or entity_root == null or player == null or boss == null or exit_gate == null:
		return false
	if checkpoint != null:
		checkpoint.call(&"_on_body_entered", player)
	boss.set_physics_process(false)
	boss.call(&"take_damage", int(boss.get("max_health")) - int(boss.call(&"get_phase_two_threshold_health")), (player as Node2D).global_position)
	if int(boss.get("phase")) != 2 or not bool(exit_gate.get("is_open")):
		return false
	boss.call(&"_update_phase_transition", 1.20)
	boss.call(&"take_damage", int(boss.get("health")) + 100, (player as Node2D).global_position)
	await process_frame
	await process_frame
	var game_session := root.get_node_or_null("GameSession")
	if int(boss.get("health")) != 0 or not bool(exit_gate.get("is_open")) or game_session == null or int(game_session.get("sigils")) != 1:
		return false
	exit_gate.call(&"_on_body_entered", player)
	await process_frame
	if not bool(game_session.get("objective_finished")):
		return false
	var choice := game.get_node_or_null("HUD/HUDRoot/CompletionChoice") as CompletionChoice
	return choice != null and choice.visible and paused


func _wait_for_route(app_root: Node, expected: StringName, maximum_frames: int) -> void:
	for _frame: int in maximum_frames:
		if app_root.call(&"get_current_route") == expected:
			return
		await process_frame


func _current_route_node(app_root: Node) -> Node:
	var route_host := app_root.get_node_or_null("RouteHost")
	return route_host.get_child(0) if route_host != null and route_host.get_child_count() == 1 else null


func _live_entities(entity_root: Node2D) -> Dictionary:
	var result := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = child
	return result


func _count_castellan_discs(game: Node) -> int:
	if game == null:
		return 0
	var result := 0
	for candidate: Node in game.find_children("*", "", true, false):
		if candidate.has_meta(&"castellan_projectile_owner") and not candidate.is_queued_for_deletion():
			result += 1
	return result


func _count_soul_instance(save_service: Node, instance_id: String) -> int:
	var result := 0
	var soul_path: Array[String] = ["inventory", "hero_souls"]
	for raw_soul: Variant in save_service.get_value(soul_path, []):
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id:
			result += 1
	return result


func _currency_delta(before: Dictionary, after_value: Variant) -> Dictionary:
	var after := after_value as Dictionary if after_value is Dictionary else {}
	return {
		"account": int(after.get("account", 0)) - int(before.get("account", 0)),
		"hero_materials": int(after.get("hero_materials", 0)) - int(before.get("hero_materials", 0)),
		"monster_fragments": int(after.get("monster_fragments", 0)) - int(before.get("monster_fragments", 0)),
	}


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
	push_error("LEVEL 10 FRESH ROUTE FAIL: %s" % message)


func _finish(app_flow: Node, app_root: Node) -> void:
	paused = false
	if app_flow != null and app_root != null:
		app_flow.call(&"detach_app_root", app_root)
		if is_instance_valid(app_root):
			for audio_node: Node in app_root.find_children("*", "AudioStreamPlayer", true, false):
				(audio_node as AudioStreamPlayer).stop()
			for audio_node: Node in app_root.find_children("*", "AudioStreamPlayer2D", true, false):
				(audio_node as AudioStreamPlayer2D).stop()
			app_root.free()
	_remove_generations(TEST_SAVE_PATH)
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("CHAPTER 1 LEVEL 10 FRESH ROUTE PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 10 FRESH ROUTE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await create_timer(0.10, true).timeout
	quit(exit_code)
