extends Node

const TEST_SAVE_PATH := "user://tests/chapter_1_level_9_fresh_route_test.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_9_fresh_route_report.json"
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
		"Fresh isolated Level 1-9 profile loads"
	)
	var fake_root := FakeAppRoot.new()
	get_tree().root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	for campaign_slot: int in range(1, 9):
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

	var level_nine := CAMPAIGN_REGISTRY.find_campaign_level(9)
	_expect(
		level_nine != null and level_nine.is_campaign_ready(),
		"Level 9 is promoted behind this fresh-route gate"
	)
	_expect(
		bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_9")),
		"Level 8 first clear unlocks Level 9"
	)
	_expect(
		bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_9")),
		"Fresh sequential profile starts Level 9"
	)
	var run: Dictionary = app_flow.call(&"get_active_run")
	_expect(
		run.get("level_id") == &"chapter_1_level_9" and int(run.get("campaign_slot", 0)) == 9,
		"Level 9 run payload resolves the promoted authored definition"
	)
	_expect(
		String(run.get("layout_data_path", "")) == "res://data/levels/chapter_1_level_9.json",
		"Run payload carries the dedicated Crimson Gate map"
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
		app_root.call(&"get_current_route") == &"gameplay", "Real AppRoot enters Level 9 gameplay"
	)

	_expect(
		await _play_live_level_nine(app_root),
		"Fresh route physically breaks three seals, defeats the named Elite, and exits"
	)
	_expect(
		app_root.call(&"get_current_route") == &"gameplay",
		"Live Level 9 completion keeps gameplay mounted"
	)
	var first_result: Dictionary = app_flow.call(&"get_last_result")
	var first_reward := first_result.get("reward", {}) as Dictionary
	_expect(
		(
			first_result.get("level_id") == &"chapter_1_level_9"
			and first_result.get("outcome") == &"victory"
		),
		"In-place completion records a Level 9 victory"
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
			int(first_reward.get("previous_player_level", 0)) == 9
			and int(first_reward.get("current_player_level", 0)) == 10
			and int(first_reward.get("player_level_gained", 0)) == 1
		),
		"First clear visibly advances Player Level 9 to 10"
	)
	var first_souls := first_reward.get("hero_souls", []) as Array
	_expect(first_souls.size() == 1, "First-clear completion payload contains one unique Hero Soul")
	var rare_summary := first_souls[0] as Dictionary if first_souls.size() == 1 else {}
	_expect(
		(
			String(rare_summary.get("hero_id", "")) == "sword_hero"
			and String(rare_summary.get("rarity_name", "")) == "Rare"
			and int(rare_summary.get("item_level", 0)) == 9
		),
		"completion payload exposes deterministic Rare Sword Hero Soul Lv9"
	)
	var rare_instance_id := String(rare_summary.get("instance_id", ""))
	_expect(
		(
			not rare_instance_id.is_empty()
			and _count_soul_instance(save_service, rare_instance_id) == 1
		),
		"Save contains exactly one deterministic Rare Soul instance"
	)
	_expect(
		_count_hero_souls(save_service, "sword_hero") == 2,
		"Rare reward creates a meaningful second Sword copy for compare/sell/fusion"
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
	var affix_ids: Array[String] = []
	for raw_affix: Variant in rare_summary.get("affixes", []):
		if raw_affix is Dictionary:
			affix_ids.append(String((raw_affix as Dictionary).get("affix_id", "")))
	_expect(
		affix_ids.has("defense_while_attacking") and affix_ids.has("active_power"),
		(
			"completion payload retains both deterministic LIVE affixes; actual=%s"
			% ", ".join(affix_ids)
		),
	)
	_expect(
		bool(save_service.call(&"is_transaction_applied", "campaign:chapter_1_level_9:complete")),
		"One campaign completion transaction owns Level 9 reward delivery"
	)
	_expect(
		bool(save_service.get_value(["progression", "features", "chapter_1_boss_gate"], false)),
		"Level 9 atomically persists its declared boss-gate feature"
	)
	var currencies_after_first := save_service.get_value(["currencies"], {}) as Dictionary
	var level_after_first := int(save_service.get_value(["progression", "player", "level"], 0))
	_expect(save_service.reload_save(), "Level 9 rewarded profile reloads from disk")
	_expect(
		(
			_count_soul_instance(save_service, rare_instance_id) == 1
			and _count_hero_souls(save_service, "sword_hero") == 2
		),
		"Reload preserves exactly one Rare reward and both Sword copies"
	)
	_expect(
		bool(save_service.get_value(["progression", "features", "chapter_1_boss_gate"], false)),
		"Reload preserves the atomic boss-gate feature"
	)

	_expect(
		bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_9")),
		"Completed Level 9 remains replayable"
	)
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(
		await _play_live_level_nine(app_root),
		"Replay physically repeats the complete three-seal boss route"
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
				== level_after_first
			)
		),
		"Replay grants no duplicate Player Level"
	)
	_expect(
		save_service.get_value(["currencies"], {}) == currencies_after_first,
		"Replay grants no duplicate currency or materials"
	)
	_expect(
		(
			_count_soul_instance(save_service, rare_instance_id) == 1
			and _count_hero_souls(save_service, "sword_hero") == 2
		),
		"Replay cannot duplicate the deterministic Rare Soul"
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


func _play_live_level_nine(app_root: Node) -> bool:
	var route_host := app_root.get_node("RouteHost")
	if route_host.get_child_count() != 1:
		return false
	var game := route_host.get_child(0)
	var controller := game.get_node_or_null("Level9CrimsonGateRuntime")
	var entity_root := game.get_node_or_null("Level/Entities") as Node2D
	var player := entity_root.get_node_or_null("Knight") as Node2D if entity_root != null else null
	if controller == null or entity_root == null or player == null:
		return false
	for seal_id: StringName in [&"l9_west_gate_seal", &"l9_east_gate_seal", &"l9_north_gate_seal"]:
		if not _activate_live_gate_seal(controller, player, seal_id):
			return false
		await get_tree().process_frame
	var boss := controller.call(&"get_crimson_reaper") as Node
	if boss == null or not boss.has_method(&"take_damage"):
		return false
	boss.call(&"take_damage", 99999, Vector2.ZERO)
	await get_tree().process_frame
	await get_tree().process_frame
	var exit_gate: Node
	for child: Node in entity_root.get_children():
		if String(child.get_meta(&"level_entity_id", "")) == "l9_exit":
			exit_gate = child
			break
	if exit_gate == null or not bool(exit_gate.get("is_open")):
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


func _activate_live_gate_seal(controller: Node, player: Node2D, seal_id: StringName) -> bool:
	var seal := controller.call(&"get_gate_seal", seal_id) as Node
	if seal == null:
		return false
	seal.call(&"_on_body_entered", player)
	return bool(seal.call(&"interact", player))


func _wait_for_route(app_root: Node, expected: StringName, maximum_frames: int) -> void:
	for _frame: int in maximum_frames:
		if app_root.call(&"get_current_route") == expected:
			return
		await get_tree().process_frame


func _count_soul_instance(save_service: Node, instance_id: String) -> int:
	var result := 0
	var path: Array[String] = ["inventory", "hero_souls"]
	var souls := save_service.call(&"get_value", path, []) as Array
	for raw_soul: Variant in souls:
		if (
			raw_soul is Dictionary
			and String((raw_soul as Dictionary).get("instance_id", "")) == instance_id
		):
			result += 1
	return result


func _count_hero_souls(save_service: Node, hero_id: String) -> int:
	var result := 0
	var path: Array[String] = ["inventory", "hero_souls"]
	var souls := save_service.call(&"get_value", path, []) as Array
	for raw_soul: Variant in souls:
		if (
			raw_soul is Dictionary
			and String((raw_soul as Dictionary).get("hero_id", "")) == hero_id
		):
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
	push_error("LEVEL 9 FRESH ROUTE FAIL: %s" % message)


func _finish(app_flow: Node, app_root: Node) -> void:
	get_tree().paused = false
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
		print("CHAPTER 1 LEVEL 9 FRESH ROUTE PASSED - %d checks" % _checks)
	else:
		print(
			(
				"CHAPTER 1 LEVEL 9 FRESH ROUTE FAILED - %d/%d checks failed"
				% [_failures.size(), _checks]
			)
		)
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().create_timer(0.10, true).timeout
	get_tree().quit(exit_code)
