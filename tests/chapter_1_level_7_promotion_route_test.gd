extends SceneTree

## Promotion gate: a fresh profile clears Levels 1-6 through the real AppFlow,
## enters Level 7 through a real AppRoot, plays both authored objective branches,
## exits through the live gate, and receives the in-place HUD continuation choice.

const TEST_SAVE_PATH := "user://tests/chapter_1_level_7_promotion_route_test.json"
const REPORT_PATH := "res://.artifacts/chapter_1_level_7_promotion_route_report.json"
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
	var game_session := root.get_node_or_null("GameSession")
	_expect(save_service != null, "SaveService autoload exists")
	_expect(app_flow != null, "AppFlow autoload exists")
	if save_service == null or app_flow == null:
		_finish(null, null)
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(save_service.configure_storage(TEST_SAVE_PATH, true), "fresh isolated Level 1-7 profile loads")
	var fake_root := FakeAppRoot.new()
	root.add_child(fake_root)
	app_flow.call(&"attach_app_root", fake_root)

	for campaign_slot: int in range(1, 7):
		var level := CAMPAIGN_REGISTRY.find_campaign_level(campaign_slot)
		_expect(level != null and level.is_campaign_ready(), "campaign slot %d is CAMPAIGN_READY on the fresh route" % campaign_slot)
		if level == null:
			continue
		_expect(bool(app_flow.call(&"is_campaign_level_unlocked", level.level_id)), "campaign slot %d unlocks in sequence" % campaign_slot)
		_expect(bool(app_flow.call(&"start_campaign_level", level.level_id)), "campaign slot %d starts through AppFlow" % campaign_slot)
		app_flow.call(&"complete_active_run", {"route_gate": true, "campaign_slot": campaign_slot}, true)
		var slot_result := app_flow.call(&"get_last_result") as Dictionary
		_expect(
			fake_root.route_id == &"gameplay"
				and bool((slot_result.get("continuation", {}) as Dictionary).get("can_continue", false)),
			"campaign slot %d commits in-place and offers the next level" % campaign_slot,
		)
		_expect(bool(app_flow.call(&"is_campaign_level_completed", level.level_id)), "campaign slot %d completion persists" % campaign_slot)

	var level_seven := CAMPAIGN_REGISTRY.find_campaign_level(7)
	_expect(level_seven != null and level_seven.is_campaign_ready(), "Level 7 is promoted only behind this route gate")
	_expect(bool(app_flow.call(&"is_campaign_level_unlocked", &"chapter_1_level_7")), "Level 6 first clear unlocks Level 7")
	_expect(bool(app_flow.call(&"start_campaign_level", &"chapter_1_level_7")), "fresh sequential profile starts Level 7")
	var run: Dictionary = app_flow.call(&"get_active_run")
	var run_team := run.get("soul_team", {}) as Dictionary
	_expect(run.get("level_id") == &"chapter_1_level_7" and int(run.get("campaign_slot", 0)) == 7, "Level 7 run payload resolves its promoted campaign definition")
	var run_reserves := run_team.get("reserve_souls", []) as Array
	_expect(
		String(run_team.get("active_hero", "")) == "sword_hero"
			and not run_reserves.has("archer_hero")
			and not run_reserves.has("axe_hero"),
		"route-only completion preserves the starter team instead of fabricating a skipped physical Hero Soul pickup",
	)

	# Hand the still-active run to the production AppRoot. Its own _ready route
	# invokes retry_active_run and instantiates gameplay exactly as the player does.
	app_flow.call(&"detach_app_root", fake_root)
	root.remove_child(fake_root)
	fake_root.free()
	var app_root_scene := load("res://game/app/app_root.tscn") as PackedScene
	_expect(app_root_scene != null, "production AppRoot scene loads after autoload initialization")
	if app_root_scene == null:
		_finish(app_flow, null)
		return
	var app_root := app_root_scene.instantiate()
	root.add_child(app_root)
	await _wait_for_route(app_root, &"gameplay", 180)
	_expect(app_root.call(&"get_current_route") == &"gameplay", "real AppRoot enters the Level 7 gameplay route")
	var route_host := app_root.get_node("RouteHost")
	var game := route_host.get_child(0) if route_host.get_child_count() == 1 else null
	_expect(game != null and game.has_method(&"get_runtime_snapshot"), "real AppRoot owns one live gameplay instance")
	if game == null or not game.has_method(&"get_runtime_snapshot"):
		_finish(app_flow, app_root)
		return

	var controller := game.get_node_or_null("Level7BeaconRuntime")
	var entity_root := game.get_node("Level/Entities") as Node2D
	var entities := _live_entities(entity_root)
	var beacon := entities.get("l7_soul_beacon") as Node
	var exit_gate := entities.get("l7_exit") as Node
	_expect(controller != null and bool((controller.call(&"get_snapshot") as Dictionary).get("configured", false)), "real AppRoot gameplay configures the Beacon objective")
	_expect(beacon != null and exit_gate != null and bool(exit_gate.get("is_open")), "Beacon is alive and exit is open on real entry")
	if controller == null or beacon == null or exit_gate == null:
		_finish(app_flow, app_root)
		return

	# Exercise the production defeat button before the successful playthrough.
	# Retry must replace the gameplay instance, clear failure/sigil state and
	# recreate every authored wave without committing a campaign result.
	beacon.call(&"take_damage", 9999, Vector2.ZERO)
	await process_frame
	var failed: Dictionary = controller.call(&"get_snapshot")
	_expect(bool(failed.get("failed", false)) and paused, "real AppRoot route reaches the Beacon-defeat state")
	var failure_overlay := game.get_node_or_null("Level7BeaconRuntime/BeaconHUD/BeaconHUDRoot/BeaconFailureOverlay") as Control
	var retry_button := failure_overlay.find_child("RetryButton", true, false) as Button if failure_overlay != null else null
	_expect(retry_button != null and retry_button.visible, "production Beacon defeat exposes its Retry action")
	if retry_button == null:
		_finish(app_flow, app_root)
		return
	retry_button.emit_signal(&"pressed")
	for frame: int in 180:
		if route_host.get_child_count() == 1 and route_host.get_child(0) != game:
			break
		await process_frame
	_expect(route_host.get_child_count() == 1 and route_host.get_child(0) != game, "Retry replaces the failed gameplay instance exactly once")
	game = route_host.get_child(0) if route_host.get_child_count() == 1 else null
	await process_frame
	controller = game.get_node_or_null("Level7BeaconRuntime") if game != null else null
	entity_root = game.get_node("Level/Entities") as Node2D if game != null else null
	entities = _live_entities(entity_root) if entity_root != null else {}
	beacon = entities.get("l7_soul_beacon") as Node
	exit_gate = entities.get("l7_exit") as Node
	var retried: Dictionary = controller.call(&"get_snapshot") if controller != null else {}
	_expect(not paused and not bool(retried.get("failed", true)) and int(retried.get("wave", -1)) == 0, "Retry resets pause, failure and wave state")
	_expect(
		beacon != null
			and int((beacon.call(&"get_health_snapshot") as Dictionary).get("current", 0))
				== int((beacon.call(&"get_health_snapshot") as Dictionary).get("maximum", -1)),
		"Retry restores full Beacon health",
	)
	_expect(game_session != null and int(game_session.get("sigils")) == 0 and not bool(game_session.get("objective_finished")), "Retry grants no core, result or completion")
	if controller == null or entity_root == null or beacon == null or exit_gate == null:
		_finish(app_flow, app_root)
		return

	for wave_index: int in 3:
		_expect(bool(controller.call(&"force_start_next_wave_for_test")), "real route starts authored Wave %d" % (wave_index + 1))
		_kill_visible_wave(entity_root)
		await process_frame
		await process_frame
	await process_frame
	var special: Dictionary = controller.call(&"get_snapshot")
	var game_snapshot: Dictionary = game.call(&"get_runtime_snapshot")
	var encounter: Dictionary = (game_snapshot.get("session", {}) as Dictionary).get("encounter", {})
	_expect(bool(special.get("cleared", false)) and int(special.get("defeated_enemies", 0)) == 21, "real route clears all three expanded timed waves")
	_expect(bool(beacon.call(&"is_alive")) and bool(encounter.get("complete", false)), "real route keeps Beacon alive and satisfies encounter authority")
	_expect(bool(exit_gate.get("is_open")), "real route opens the north exit after all waves")

	var player := entity_root.get_tree().get_first_node_in_group(&"player") as Node2D
	exit_gate.call(&"_on_body_entered", player)
	await process_frame
	_expect(game_session != null and bool(game_session.get("objective_finished")), "crossing the live gate completes the gameplay objective")
	var win_overlay := game.get_node("HUD/HUDRoot/WinOverlay") as Control
	var completion_choice := game.get_node_or_null("HUD/HUDRoot/CompletionChoice") as CompletionChoice
	_expect(
		completion_choice != null and completion_choice.visible and not win_overlay.visible and paused,
		"live gate opens the lightweight continuation choice without a Results summary",
	)
	_expect(app_root.call(&"get_current_route") == &"gameplay", "completion keeps the real gameplay route mounted")
	var result: Dictionary = app_flow.call(&"get_last_result")
	var reward := result.get("reward", {}) as Dictionary
	_expect(result.get("level_id") == &"chapter_1_level_7" and result.get("outcome") == &"victory", "in-place completion records a Level 7 victory")
	_expect(bool(reward.get("granted", false)), "Level 7 first clear commits its one atomic reward bundle")
	_expect(bool(app_flow.call(&"is_campaign_level_completed", &"chapter_1_level_7")), "Level 7 completion persists through the production route")
	_expect(bool(save_service.call(&"is_transaction_applied", "campaign:chapter_1_level_7:complete")), "exactly the Level completion transaction owns durable reward delivery")
	_expect(bool(save_service.get_value(["progression", "features", "soul_jewelry"], false)), "Level 7 completion grants the Jewelry feature")
	var stripped := bool(save_service.call(
		&"transact_once",
		"test:strip_campaign_level_features",
		func(candidate: Dictionary) -> bool:
			var progression: Dictionary = candidate.get("progression", {}).duplicate(true)
			var features: Dictionary = progression.get("features", {}).duplicate(true)
			features.erase("skill_allocation")
			features.erase("skill_respec")
			features.erase("soul_jewelry")
			progression["features"] = features
			candidate["progression"] = progression
			var transactions: Dictionary = candidate.get("applied_transactions", {}).duplicate(true)
			transactions.erase("campaign:visible_reward_reconciliation:v4")
			candidate["applied_transactions"] = transactions
			return true,
		{"kind": "test_legacy_completed_feature_fixture"},
	))
	_expect(stripped, "legacy fixture removes declared campaign features without touching completion receipts")
	app_flow.call(&"detach_app_root", app_root)
	app_flow.call(&"attach_app_root", app_root)
	_expect(bool(save_service.call(&"is_transaction_applied", "campaign:visible_reward_reconciliation:v4")), "reattach records the v4 campaign-feature repair receipt")
	_expect(
		bool(save_service.get_value(["progression", "features", "skill_allocation"], false))
			and bool(save_service.get_value(["progression", "features", "skill_respec"], false))
			and bool(save_service.get_value(["progression", "features", "soul_jewelry"], false)),
		"v4 reconciliation atomically restores Level 6 and Level 7 declared features",
	)
	_finish(app_flow, app_root)


func _wait_for_route(app_root: Node, expected: StringName, maximum_frames: int) -> void:
	for frame: int in maximum_frames:
		if app_root.call(&"get_current_route") == expected:
			return
		await process_frame


func _live_entities(entity_root: Node2D) -> Dictionary:
	var result := {}
	for child: Node in entity_root.get_children():
		var entity_id := String(child.get_meta(&"level_entity_id", ""))
		if not entity_id.is_empty():
			result[entity_id] = child
	return result


func _kill_visible_wave(entity_root: Node2D) -> void:
	var victims: Array[Node] = []
	for child: Node in entity_root.get_children():
		if (
			String(child.get_meta(&"level_entity_type", "")) in ["skeleton", "skeleton_reaper", "vampire"]
			and child is CanvasItem
			and (child as CanvasItem).visible
			and child.has_method(&"take_damage")
		):
			victims.append(child)
	for victim: Node in victims:
		victim.call(&"take_damage", 9999, Vector2.ZERO)


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
	push_error("LEVEL 7 PROMOTION ROUTE FAIL: %s" % message)


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
		print("CHAPTER 1 LEVEL 7 PROMOTION ROUTE PASSED - %d checks" % _checks)
	else:
		print("CHAPTER 1 LEVEL 7 PROMOTION ROUTE FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	_finish_after_cleanup.call_deferred(0 if _failures.is_empty() else 1)


func _finish_after_cleanup(exit_code: int) -> void:
	# Let the headless mixer retire short completion/UI playbacks after the
	# production tree is freed. Quitting on the same deferred tick can otherwise
	# leave their sample resources alive nondeterministically in the full suite.
	await create_timer(0.10, true).timeout
	quit(exit_code)
