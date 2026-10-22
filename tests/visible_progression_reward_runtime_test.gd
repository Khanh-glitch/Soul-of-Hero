extends Node

const TEST_SAVE_PATH := "user://tests/visible_progression_reward_runtime_test.json"
const REPORT_PATH := "res://.artifacts/visible_progression_reward_runtime_report.json"
const V2_RECONCILIATION_KEY := "campaign:unlock_reconciliation:v2"
const V4_RECONCILIATION_KEY := "campaign:visible_reward_reconciliation:v4"
const AUXILIARY_RULES := preload("res://game/meta/equipment/auxiliary_equipment_rules.gd")

var _app_root: Node
var _save: LivingArsenalSaveService
var _checks := 0
var _failures: Array[String] = []
var _chosen_vessel_uuid := ""


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	_save = get_node_or_null("/root/SaveService") as LivingArsenalSaveService
	_expect(_app_root != null, "real AppRoot is available")
	_expect(_save != null, "SaveService autoload is available")
	if _app_root == null or _save == null:
		_finish()
		return
	_remove_generations(TEST_SAVE_PATH)
	_expect(_save.configure_storage(TEST_SAVE_PATH, true), "isolated visible-reward profile loads")
	AppFlow.detach_app_root(_app_root)
	AppFlow.attach_app_root(_app_root)
	_expect(_player_level() == 1, "fresh campaign begins at Player Level 1")
	_expect(_auxiliary_items().is_empty(), "fresh campaign has no auxiliary tutorial gear")

	var revision_before := int(_save.get_value(["revision"], -1))
	_expect(AppFlow.start_campaign_level(&"chapter_1_level_1"), "Level 1 starts through AppFlow")
	AppFlow.complete_active_run({"score": 111, "sigils": 3, "required_sigils": 3}, true)
	await get_tree().process_frame
	await get_tree().process_frame
	var first_reward := _last_reward()
	_expect(_app_root.call(&"get_current_route") == &"gameplay", "first clear keeps the real gameplay route mounted")
	_expect(bool(first_reward.get("granted", false)), "Level 1 result marks the first-clear reward granted")
	_expect(int(first_reward.get("player_level_gained", 0)) == 1, "Level 1 result publishes +1 Player Level")
	_expect(int(first_reward.get("current_player_level", 0)) == 2, "Level 1 result publishes current Player Level 2")
	_expect(_player_level() == 2, "Level 1 completion persists Player Level 2")
	_expect(int(_save.get_value(["revision"], -1)) == revision_before + 1, "completion, level, loot, unlock and receipt use one revision")
	_expect(_auxiliary_items().size() == 1, "Level 1 grants exactly one deterministic tutorial item")
	var vessel_summary := _first_dictionary(first_reward.get("auxiliary_equipment", []))
	_expect(String(vessel_summary.get("slot", "")) == "soul_vessel", "Level 1 result identifies the Soul Vessel")
	_expect(String(vessel_summary.get("rarity", "")) == "magic", "tutorial Vessel has readable Magic rarity")
	_expect(bool(vessel_summary.get("auto_equipped", false)), "first Soul Vessel is auto-equipped")
	_expect(
		String(_save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == String(vessel_summary.get("uuid", "")),
		"auto-equipped Vessel is saved in the shared loadout",
	)
	_assert_completion_choice()
	await _assert_completion_layout(Vector2i(847, 437), "847x437 embedded window")
	await _assert_completion_layout(Vector2i(1280, 720), "1280x720 window")

	var revision_before_replay := int(_save.get_value(["revision"], -1))
	var currency_before_replay := int(_save.get_value(["currencies", "account"], 0))
	_expect(AppFlow.start_campaign_level(&"chapter_1_level_1"), "Level 1 remains replayable")
	AppFlow.complete_active_run({"score": 222}, true)
	await get_tree().process_frame
	var replay_reward := _last_reward()
	_expect(bool(replay_reward.get("already_claimed", false)), "replay is explicitly marked already claimed")
	_expect(int(replay_reward.get("player_level_gained", -1)) == 0, "replay publishes zero gained levels")
	_expect(_player_level() == 2, "replay cannot duplicate Player Level")
	_expect(_auxiliary_items().size() == 1, "replay cannot duplicate tutorial equipment")
	_expect(int(_save.get_value(["currencies", "account"], 0)) == currency_before_replay, "replay cannot duplicate currency")
	_expect(int(_save.get_value(["revision"], -1)) == revision_before_replay, "replay creates no save revision")
	_assert_completion_choice()

	await _clear_and_expect_level(2, 3)
	await _clear_and_expect_level(3, 4)
	var boots := _find_auxiliary_slot("soul_boots")
	_expect(not boots.is_empty(), "Level 3 grants the Magic Boots tutorial item")
	_expect(String(_save.get_value(["auxiliary_loadout", "soul_boots"], "")) == String(boots.get("uuid", "")), "Level 3 auto-equips Boots into their empty level-4 slot")

	_test_legacy_reconciliation_fixture()
	await get_tree().process_frame
	_expect(_player_level() == 4, "v4 reconciliation derives Level 4 from three completed first clears")
	_expect(_auxiliary_items().size() == 3, "v4 reconciliation restores two earned items alongside the player's chosen Vessel")
	_expect(_has_auxiliary_uuid(String(vessel_summary.get("uuid", ""))), "v4 reconciliation restores the deterministic earned Vessel")
	_expect(_count_auxiliary_slot("soul_vessel") == 2, "earned and player-chosen Vessels coexist without duplication")
	_expect(not _find_auxiliary_slot("soul_boots").is_empty(), "v4 reconciliation restores the earned Boots")
	_expect(
		String(_save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == _chosen_vessel_uuid,
		"reconciliation never overwrites an occupied player-chosen slot",
	)
	_expect(int(_save.get_value(["currencies", "account"], 0)) == 500, "reconciliation does not duplicate completed-level currency")

	await _clear_and_expect_level(4, 5)
	await _clear_and_expect_level(5, 6)
	var level_5_reward := _last_reward()
	_expect((level_5_reward.get("hero_souls", []) as Array).is_empty(), "Level 5 completion summary never fabricates a Hero Soul pickup")
	_expect(not bool(_save.get_value(["progression", "unlocked_heroes", "archer_hero"], false)), "AppFlow completion alone cannot unlock Archer without the physical pickup transaction")
	_assert_completion_choice()

	await _clear_and_expect_level(6, 7)
	var jewelry := _find_auxiliary_slot("soul_trace")
	_expect(not jewelry.is_empty(), "Level 6 grants the Magic Jewelry tutorial item")
	_expect(String(_save.get_value(["auxiliary_loadout", "soul_trace"], "")) == String(jewelry.get("uuid", "")), "Level 6 auto-equips Jewelry into its empty level-7 slot")
	_assert_completion_choice()
	_finish()


func _clear_and_expect_level(slot: int, expected_level: int) -> void:
	var level_id := StringName("chapter_1_level_%d" % slot)
	_expect(AppFlow.start_campaign_level(level_id), "Level %d starts through sequential AppFlow unlocks" % slot)
	AppFlow.complete_active_run({"score": slot * 100}, true)
	await get_tree().process_frame
	var reward := _last_reward()
	_expect(bool(reward.get("granted", false)), "Level %d first-clear bundle commits" % slot)
	_expect(int(reward.get("current_player_level", 0)) == expected_level, "Level %d result publishes Player Level %d" % [slot, expected_level])
	_expect(_player_level() == expected_level, "Level %d persists Player Level %d" % [slot, expected_level])


func _test_legacy_reconciliation_fixture() -> void:
	AppFlow.detach_app_root(_app_root)
	var legacy := _save.get_snapshot()
	var inventory: Dictionary = legacy.get("inventory", {}).duplicate(true)
	var chosen_vessel := AUXILIARY_RULES.generate_item(
		&"soul_vessel",
		&"rare",
		2,
		90317,
		&"legacy_choice",
	)
	_expect(not chosen_vessel.is_empty(), "legacy fixture creates one valid player-chosen Vessel")
	_chosen_vessel_uuid = String(chosen_vessel.get("uuid", ""))
	inventory["auxiliary_equipment"] = [chosen_vessel]
	legacy["inventory"] = inventory
	legacy["auxiliary_loadout"] = {
		"soul_vessel": String(chosen_vessel.get("uuid", "")),
		"soul_boots": "",
		"soul_trace": "",
	}
	var progression: Dictionary = legacy.get("progression", {}).duplicate(true)
	var player: Dictionary = progression.get("player", {}).duplicate(true)
	player["level"] = 2
	progression["player"] = player
	legacy["progression"] = progression
	var transactions: Dictionary = legacy.get("applied_transactions", {}).duplicate(true)
	_expect(transactions.has(V2_RECONCILIATION_KEY), "legacy fixture retains the already-consumed v2 receipt")
	transactions.erase(V4_RECONCILIATION_KEY)
	legacy["applied_transactions"] = transactions
	_expect(_write_snapshot(TEST_SAVE_PATH, legacy), "pre-visible-reward completed profile writes")
	_expect(_save.reload_save(), "pre-visible-reward completed profile reloads")
	AppFlow.attach_app_root(_app_root)
	_expect(_save.is_transaction_applied(V4_RECONCILIATION_KEY), "attach records the v4 visible-reward repair receipt")


func _assert_completion_choice() -> void:
	var choice := _completion_choice()
	_expect(choice != null and choice.visible, "in-place completion question is mounted in gameplay")
	if choice == null:
		return
	var question := choice.find_child("QuestionLabel", true, false) as Label
	var next := choice.find_child("NextButton", true, false) as Button
	var picker := choice.find_child("PickerButton", true, false) as Button
	var home := choice.find_child("HomeButton", true, false) as Button
	_expect(question != null and "đi tiếp" in question.text.to_lower(), "completion asks whether to continue or return home")
	_expect(next != null and picker != null and home != null, "completion exposes next, level picker and home actions")
	_expect(choice.find_child("RewardList", true, false) == null, "completion does not render a reward-summary Results list")


func _assert_completion_layout(size: Vector2i, label: String) -> void:
	get_tree().root.size = size
	await get_tree().process_frame
	await get_tree().process_frame
	var choice := _completion_choice()
	if choice == null:
		_expect(false, "%s has a completion choice for layout validation" % label)
		return
	var card := choice.find_child("Card", true, false) as Control
	if card == null:
		_expect(false, "%s has its responsive question card" % label)
		return
	var viewport_rect := get_tree().root.get_visible_rect()
	var card_rect := card.get_global_rect()
	_expect(card_rect.position.x >= -1.0 and card_rect.end.x <= viewport_rect.end.x + 1.0, "%s keeps completion card on-screen horizontally" % label)
	_expect(card_rect.position.y >= -1.0 and card_rect.end.y <= viewport_rect.end.y + 1.0, "%s keeps completion card on-screen vertically" % label)
	if DisplayServer.get_name() != "headless" and size == Vector2i(847, 437):
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var image := get_viewport().get_texture().get_image()
		var saved := image.save_png("res://.artifacts/visible_reward_completion_847x437.png")
		_expect(saved == OK, "847x437 completion visual capture writes successfully")


func _completion_choice() -> CompletionChoice:
	var host := _app_root.get_node_or_null("RouteHost")
	if host == null or host.get_child_count() != 1:
		return null
	return host.get_child(0).find_child("CompletionChoice", true, false) as CompletionChoice


func _last_reward() -> Dictionary:
	var result := AppFlow.get_last_result()
	var reward: Variant = result.get("reward", {})
	return (reward as Dictionary).duplicate(true) if reward is Dictionary else {}


func _player_level() -> int:
	return int(_save.get_value(["progression", "player", "level"], 0))


func _auxiliary_items() -> Array:
	return _save.get_value(["inventory", "auxiliary_equipment"], [])


func _find_auxiliary_slot(slot_id: String) -> Dictionary:
	for raw_item: Variant in _auxiliary_items():
		if raw_item is Dictionary and String((raw_item as Dictionary).get("slot", "")) == slot_id:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _has_auxiliary_uuid(uuid: String) -> bool:
	for raw_item: Variant in _auxiliary_items():
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return true
	return false


func _count_auxiliary_slot(slot_id: String) -> int:
	var count := 0
	for raw_item: Variant in _auxiliary_items():
		if raw_item is Dictionary and String((raw_item as Dictionary).get("slot", "")) == slot_id:
			count += 1
	return count


func _first_dictionary(value: Variant) -> Dictionary:
	if value is Array and not (value as Array).is_empty() and (value as Array)[0] is Dictionary:
		return ((value as Array)[0] as Dictionary).duplicate(true)
	return {}


func _write_snapshot(path: String, snapshot: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(snapshot, "\t") + "\n")
	file.close()
	return true


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
	push_error(message)


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	var report := {"ok": _failures.is_empty(), "checks": _checks, "failures": _failures}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
		file.close()
	if _failures.is_empty():
		print("VISIBLE PROGRESSION REWARD RUNTIME TEST PASSED - %d checks" % _checks)
	else:
		print("VISIBLE PROGRESSION REWARD RUNTIME TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
