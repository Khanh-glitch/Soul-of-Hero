extends Node

## One AppRoot-level acceptance test for the first player-visible progression
## loop. It deliberately drives Campaign, the in-place continuation choice and
## the live Field Codex, then reloads a second gameplay scene from durable save.

const TEST_SAVE_PATH := "user://tests/fresh_player_loop_acceptance_test.json"
const REPORT_PATH := "res://.artifacts/fresh_player_loop_acceptance_report.json"
const RELOAD_PHASE_META := &"fresh_player_loop_acceptance_reload_phase"
const RELOAD_EXPECTED_META := &"fresh_player_loop_acceptance_expected"
const RELOAD_CHECKS_META := &"fresh_player_loop_acceptance_checks"
const RELOAD_OLD_KNIGHT_META := &"fresh_player_loop_acceptance_old_knight"

var _app_root: Node
var _save: LivingArsenalSaveService
var _checks := 0
var _failures: Array[String] = []


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	_save = get_node_or_null("/root/SaveService") as LivingArsenalSaveService
	_expect(_app_root != null, "production AppRoot is available")
	_expect(_save != null, "production SaveService is available")
	if _app_root == null or _save == null:
		_finish()
		return
	if get_tree().root.has_meta(RELOAD_PHASE_META):
		await _run_reload_phase()
	else:
		await _run_fresh_phase()


func _run_fresh_phase() -> void:
	_remove_generations()
	_expect(_save.configure_storage(TEST_SAVE_PATH, true), "isolated fresh-save profile loads")
	AppFlow.detach_app_root(_app_root)
	AppFlow.attach_app_root(_app_root)
	get_tree().root.size = Vector2i(847, 437)
	await _settle(2)

	var fresh_progression := _save.get_player_progression_snapshot()
	_expect(int(fresh_progression.get("player_level", 0)) == 1, "fresh player starts at Player Level 1")
	_expect((_save.get_value(["inventory", "auxiliary_equipment"], []) as Array).is_empty(), "fresh player starts without auxiliary gear")

	AppFlow.open_home(&"campaign")
	_expect(await _wait_for_route(&"home"), "Campaign opens inside the production Home route")
	_expect(await _wait_for_home_function(&"campaign"), "Campaign overlay is visibly open")
	_expect(await _start_campaign_from_visible_controls(1), "Level 1 starts through its visible Campaign card and details button")
	var level_one_knight := _live_knight()
	_expect(level_one_knight != null, "Level 1 mounts the real live Knight")
	if level_one_knight == null:
		_finish()
		return
	var baseline := level_one_knight.get_combat_stat_snapshot()
	_expect_close(float(baseline.get("hp", 0.0)), 100.0, "fresh Level 1 Knight has authored Max HP")
	_expect_close(float(baseline.get("damage", 0.0)), 20.0, "fresh Level 1 Knight has authored core damage")
	_expect_close(float(baseline.get("mana", 0.0)), 100.0, "fresh Level 1 Knight has authored Max Mana")
	_expect((baseline.get("equipped_item_uuids", {}) as Dictionary).is_empty(), "fresh Level 1 Knight has no equipped auxiliary modifier")
	_assert_hud_health(level_one_knight, "Level 1 HUD exposes the authored health")
	_expect(StringName(AppFlow.get_active_run().get("level_id", &"")) == &"chapter_1_level_1", "active run is the selected campaign Level 1")

	AppFlow.complete_active_run({"score": 111, "sigils": 3, "required_sigils": 3}, true)
	await _settle(2)
	_expect(_app_root.call(&"get_current_route") == &"gameplay", "Level 1 victory keeps the production gameplay route mounted")
	var reward := _last_reward()
	_expect(bool(reward.get("granted", false)), "Level 1 first-clear reward commits")
	_expect(int(reward.get("previous_player_level", 0)) == 1, "completion payload reports the previous Player Level")
	_expect(int(reward.get("current_player_level", 0)) == 2, "completion payload reports Player Level 2")
	_expect(int(reward.get("player_level_gained", 0)) == 1, "completion payload reports exactly one gained Player Level")
	var vessel_summary := _first_dictionary(reward.get("auxiliary_equipment", []))
	var vessel_uuid := String(vessel_summary.get("uuid", ""))
	_expect(not vessel_uuid.is_empty(), "completion payload identifies the granted auxiliary item")
	_expect(String(vessel_summary.get("slot", "")) == "soul_vessel", "first clear grants a Soul Vessel")
	_expect(String(vessel_summary.get("rarity", "")) == "magic", "first Soul Vessel is Magic rarity")
	_expect(bool(vessel_summary.get("auto_equipped", false)), "first Soul Vessel is reported auto-equipped")
	_expect(String(_save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == vessel_uuid, "Magic Soul Vessel is actually equipped in the durable loadout")
	_assert_completion_visible()
	await _assert_completion_fits_viewport("847x437 completion")
	get_tree().root.size = Vector2i(1280, 720)
	await _assert_completion_fits_viewport("1280x720 completion")
	get_tree().root.size = Vector2i(847, 437)
	await _settle(2)

	var gameplay := _current_screen()
	var completion := gameplay.find_child("CompletionChoice", true, false) as CompletionChoice if gameplay != null else null
	var next_button := completion.find_child("NextButton", true, false) as Button if completion != null else null
	_expect(next_button != null and next_button.is_visible_in_tree() and not next_button.disabled, "completion exposes the unlocked next-level action")
	if next_button == null or next_button.disabled:
		_finish()
		return
	next_button.pressed.emit()
	_expect(await _wait_for_route(&"gameplay"), "next-level action mounts unlocked Level 2 directly")
	var level_two_knight := _live_knight()
	_expect(level_two_knight != null, "Level 2 mounts a new live Knight")
	if level_two_knight == null:
		_finish()
		return
	var field_codex := _current_screen().find_child("FieldCodex", true, false) as FieldCodex
	_expect(field_codex != null, "Level 2 HUD mounts the live Field Codex")
	if field_codex == null:
		_finish()
		return
	field_codex.show_codex(&"stats")
	await _settle(2)
	var hp_add := _button_with_text(field_codex, "+1")
	var before_allocation := _stat_allocation()
	_expect(hp_add != null and hp_add.is_visible_in_tree(), "the in-run HP +1 control is actually visible")
	_expect(hp_add != null and not hp_add.disabled, "the in-run HP +1 control is enabled")
	_expect(hp_add != null and not hp_add.pressed.get_connections().is_empty(), "the in-run HP +1 control is connected to production UI logic")
	if hp_add == null or hp_add.disabled:
		_finish()
		return
	hp_add.pressed.emit()
	await _settle(3)
	var after_allocation := _stat_allocation()
	_expect(int(after_allocation.get("hp", 0)) == int(before_allocation.get("hp", 0)) + 1, "pressing the in-run control saves one HP Stat Point")
	_expect(int(after_allocation.get("damage", 0)) == int(before_allocation.get("damage", 0)), "the HP control does not mutate Power allocation")
	_expect(int(after_allocation.get("mana", 0)) == int(before_allocation.get("mana", 0)), "the HP control does not mutate Mana allocation")
	_expect("1 điểm đã cộng" in _collect_text(field_codex), "Field Codex visibly refreshes the allocated HP point")
	field_codex.hide_codex()
	var expected_runtime := _verify_level_two_knight(level_two_knight, baseline, vessel_uuid, "next combat")
	if not _failures.is_empty():
		_finish()
		return

	_expect(_save.save_now(), "Player Level, UI stat allocation and equipped reward are durable before reload")
	get_tree().root.set_meta(RELOAD_EXPECTED_META, expected_runtime)
	get_tree().root.set_meta(RELOAD_CHECKS_META, _checks)
	get_tree().root.set_meta(RELOAD_OLD_KNIGHT_META, level_two_knight.get_instance_id())
	get_tree().root.set_meta(RELOAD_PHASE_META, true)
	var reload_error := get_tree().reload_current_scene()
	if reload_error != OK:
		get_tree().root.remove_meta(RELOAD_PHASE_META)
		_expect(false, "AppRoot scene reload starts successfully")
		_finish()


func _run_reload_phase() -> void:
	_checks += int(get_tree().root.get_meta(RELOAD_CHECKS_META, 0))
	var expected: Dictionary = get_tree().root.get_meta(RELOAD_EXPECTED_META, {})
	var old_knight_id := int(get_tree().root.get_meta(RELOAD_OLD_KNIGHT_META, 0))
	get_tree().root.remove_meta(RELOAD_PHASE_META)
	get_tree().root.remove_meta(RELOAD_EXPECTED_META)
	get_tree().root.remove_meta(RELOAD_CHECKS_META)
	get_tree().root.remove_meta(RELOAD_OLD_KNIGHT_META)

	_expect(_save.reload_save(), "reloaded AppRoot reads the durable save from disk")
	_expect(int(_save.get_player_progression_snapshot().get("player_level", 0)) == 2, "save reload preserves Player Level 2")
	var allocation := _stat_allocation()
	_expect(int(allocation.get("hp", 0)) == 1 and int(allocation.get("damage", 0)) == 0 and int(allocation.get("mana", 0)) == 0, "save reload preserves the UI-authored HP allocation only")
	var vessel_uuid := String(expected.get("vessel_uuid", ""))
	_expect(String(_save.get_value(["auxiliary_loadout", "soul_vessel"], "")) == vessel_uuid, "save reload preserves the auto-equipped Magic Soul Vessel")
	_expect(StringName(AppFlow.get_active_run().get("level_id", &"")) == &"chapter_1_level_2", "AppFlow keeps the active Level 2 run across AppRoot reload")

	AppFlow.retry_active_run()
	_expect(await _wait_for_route(&"gameplay"), "scene reload remounts Level 2 gameplay through AppFlow")
	var knight := _live_knight()
	_expect(knight != null, "reloaded Level 2 has a live Knight")
	if knight != null:
		_expect(knight.get_instance_id() != old_knight_id, "reload creates a new gameplay Knight instance")
		var snapshot := knight.get_combat_stat_snapshot()
		_expect_close(float(snapshot.get("hp", 0.0)), float(expected.get("hp", 0.0)), "reloaded Knight retains progressed and equipped HP")
		_expect_close(float(snapshot.get("damage", 0.0)), float(expected.get("damage", 0.0)), "reloaded Knight retains saved Power projection")
		_expect_close(float(snapshot.get("mana", 0.0)), float(expected.get("mana", 0.0)), "reloaded Knight retains saved Mana projection")
		_expect(int(knight.max_health) == int(expected.get("max_health", 0)), "reloaded Knight applies durable Max HP to live combat")
		_expect(is_equal_approx(knight.max_mana, float(expected.get("max_mana", 0.0))), "reloaded Knight applies durable Max Mana to live combat")
		_expect(String((snapshot.get("equipped_item_uuids", {}) as Dictionary).get("soul_vessel", "")) == vessel_uuid, "reloaded combat snapshot still consumes the Soul Vessel")
		_assert_hud_health(knight, "reloaded Level 2 HUD exposes progressed health")
	_finish()


func _start_campaign_from_visible_controls(slot: int) -> bool:
	var home := _current_screen()
	if home == null:
		_expect(false, "Campaign Level %d has a mounted Home screen" % slot)
		return false
	var card := home.find_child("CampaignSlot%02d" % slot, true, false) as Control
	var play := card.find_child("PlayButton", true, false) as Button if card != null else null
	_expect(card != null and card.is_visible_in_tree(), "Campaign Level %d card is visible" % slot)
	_expect(play != null and play.is_visible_in_tree() and not play.disabled, "Campaign Level %d Play control is visible and enabled" % slot)
	if play == null or play.disabled:
		return false
	play.pressed.emit()
	if not await _wait_for_route(&"level_details"):
		_expect(false, "Campaign Level %d Play control opens Level Details" % slot)
		return false
	var details := _current_screen()
	var start_button := details.find_child("StartButton", true, false) as Button if details != null else null
	_expect(start_button != null and start_button.is_visible_in_tree() and not start_button.disabled, "Campaign Level %d Start control is visible and enabled" % slot)
	if start_button == null or start_button.disabled:
		return false
	start_button.pressed.emit()
	if not await _wait_for_route(&"gameplay"):
		_expect(false, "Campaign Level %d Start control mounts gameplay" % slot)
		return false
	await get_tree().physics_frame
	await _settle(2)
	return true


func _verify_level_two_knight(
		knight: KnightController,
		baseline: Dictionary,
		vessel_uuid: String,
		phase: String,
) -> Dictionary:
	var snapshot := knight.get_combat_stat_snapshot()
	var hp := float(snapshot.get("hp", 0.0))
	var damage := float(snapshot.get("damage", 0.0))
	var mana := float(snapshot.get("mana", 0.0))
	var vessel := _find_auxiliary(vessel_uuid)
	# The level itself grows survivability/resources while offense remains under
	# explicit player control. Use the canonical saved projection here so this
	# end-to-end test covers level growth, the Codex allocation and gear without
	# duplicating the progression constants a second time.
	var progression: Dictionary = _save.get_player_progression_snapshot()
	var progressed_stats: Dictionary = progression.get("stats", {})
	var progressed_hp := float(progressed_stats.get("hp", 0.0))
	var expected_hp := progressed_hp
	if not vessel.is_empty():
		var primary: Dictionary = vessel.get("primary", {})
		if String(primary.get("stat_id", "")) == "max_hp_flat":
			expected_hp += float(primary.get("value", 0.0))
		var hp_percent := 0.0
		for raw_affix: Variant in vessel.get("affixes", []):
			if raw_affix is Dictionary and String((raw_affix as Dictionary).get("affix_id", "")) == "max_hp_percent":
				hp_percent += float((raw_affix as Dictionary).get("value", 0.0))
		expected_hp *= 1.0 + hp_percent / 100.0
	_expect(not vessel.is_empty(), "%s resolves the rewarded Soul Vessel from inventory" % phase)
	_expect_close(hp, expected_hp, "%s combines level growth, the visible HP point and Soul Vessel modifiers" % phase)
	_expect(hp > progressed_hp, "%s is stronger than its progressed stat-only HP because gear is active" % phase)
	_expect_close(damage, float(progressed_stats.get("damage", 0.0)), "%s keeps authored Power unchanged without allocating Power" % phase)
	_expect_close(mana, float(progressed_stats.get("mana", 0.0)), "%s applies automatic level-up Mana growth without allocating Mana" % phase)
	_expect(knight.max_health == roundi(hp), "%s projects derived HP onto the live Knight" % phase)
	_expect(is_equal_approx(knight.max_mana, mana), "%s projects derived Mana onto the live Knight" % phase)
	_expect(knight.health == knight.max_health and is_equal_approx(knight.mana, knight.max_mana), "%s begins with the progressed live resource pools full" % phase)
	var equipped: Dictionary = snapshot.get("equipped_item_uuids", {})
	_expect(String(equipped.get("soul_vessel", "")) == vessel_uuid, "%s combat snapshot identifies the equipped Soul Vessel" % phase)
	_expect(_modifier_uses_uuid(snapshot, vessel_uuid), "%s combat math records the Soul Vessel as an applied modifier source" % phase)
	var allocation := _stat_allocation()
	_expect(int(allocation.get("hp", 0)) == 1, "%s consumes the one HP point allocated in Field Codex" % phase)
	_assert_hud_health(knight, "%s HUD visibly reflects progressed Max HP" % phase)
	return {
		"hp": hp,
		"damage": damage,
		"mana": mana,
		"max_health": knight.max_health,
		"max_mana": knight.max_mana,
		"vessel_uuid": vessel_uuid,
	}


func _assert_completion_visible() -> void:
	var gameplay := _current_screen()
	var completion := gameplay.find_child("CompletionChoice", true, false) as CompletionChoice if gameplay != null else null
	_expect(completion != null and completion.visible, "in-place completion question is mounted and visible")
	if completion == null:
		return
	var question := completion.find_child("QuestionLabel", true, false) as Label
	var next := completion.find_child("NextButton", true, false) as Button
	var picker := completion.find_child("PickerButton", true, false) as Button
	var home := completion.find_child("HomeButton", true, false) as Button
	_expect(question != null and "đi tiếp" in question.text.to_lower(), "completion asks whether to continue or return home")
	_expect(next != null and picker != null and home != null, "completion exposes next, level picker and home actions")
	_expect(completion.find_child("RewardList", true, false) == null, "completion contains no reward-summary Results UI")


func _assert_completion_fits_viewport(label: String) -> void:
	await _settle(2)
	var gameplay := _current_screen()
	var completion := gameplay.find_child("CompletionChoice", true, false) as CompletionChoice if gameplay != null else null
	_expect(completion != null and completion.is_visible_in_tree(), "%s is visible" % label)
	if completion == null:
		return
	var viewport_rect := get_tree().root.get_visible_rect()
	var card := completion.find_child("Card", true, false) as Control
	_expect(card != null and _rect_inside(card.get_global_rect(), viewport_rect), "%s keeps its question card inside the viewport" % label)


func _assert_hud_health(knight: KnightController, message: String) -> void:
	var game := _current_screen()
	var label := game.find_child("HealthValue", true, false) as Label if game != null else null
	var expected := "%d/%d" % [knight.health, knight.max_health]
	_expect(label != null and label.is_visible_in_tree() and label.text == expected, "%s (%s)" % [message, expected])


func _live_knight() -> KnightController:
	var screen := _current_screen()
	if screen == null:
		return null
	return screen.find_child("Knight", true, false) as KnightController


func _current_screen() -> Node:
	var host := _app_root.get_node_or_null("RouteHost") if _app_root != null else null
	if host == null or host.get_child_count() != 1:
		return null
	return host.get_child(0)


func _last_reward() -> Dictionary:
	var value: Variant = AppFlow.get_last_result().get("reward", {})
	return (value as Dictionary).duplicate(true) if value is Dictionary else {}


func _stat_allocation() -> Dictionary:
	var stats: Dictionary = _save.get_player_progression_snapshot().get("stats", {})
	return (stats.get("allocation", {}) as Dictionary).duplicate(true)


func _find_auxiliary(uuid: String) -> Dictionary:
	for raw_item: Variant in _save.get_value(["inventory", "auxiliary_equipment"], []):
		if raw_item is Dictionary and String((raw_item as Dictionary).get("uuid", "")) == uuid:
			return (raw_item as Dictionary).duplicate(true)
	return {}


func _modifier_uses_uuid(snapshot: Dictionary, uuid: String) -> bool:
	for raw_modifier: Variant in snapshot.get("applied_modifiers", []):
		if raw_modifier is Dictionary and String((raw_modifier as Dictionary).get("source_uuid", "")) == uuid:
			return true
	return false


func _button_with_text(node: Node, copy: String) -> Button:
	if node == null:
		return null
	if node is Button and (node as Button).text == copy:
		return node as Button
	for child: Node in node.get_children():
		var found := _button_with_text(child, copy)
		if found != null:
			return found
	return null


func _collect_text(node: Node) -> String:
	if node == null:
		return ""
	var result := ""
	if node is Label:
		result += (node as Label).text + "\n"
	elif node is Button:
		result += (node as Button).text + "\n"
	for child: Node in node.get_children():
		result += _collect_text(child)
	return result


func _first_dictionary(value: Variant) -> Dictionary:
	if value is Array and not (value as Array).is_empty() and (value as Array)[0] is Dictionary:
		return ((value as Array)[0] as Dictionary).duplicate(true)
	return {}


func _rect_inside(inner: Rect2, outer: Rect2) -> bool:
	return (
		inner.position.x >= outer.position.x - 1.0
		and inner.position.y >= outer.position.y - 1.0
		and inner.end.x <= outer.end.x + 1.0
		and inner.end.y <= outer.end.y + 1.0
	)


func _wait_for_route(route_id: StringName, frame_limit := 30) -> bool:
	for _frame: int in frame_limit:
		await get_tree().process_frame
		if StringName(_app_root.call("get_current_route")) == route_id:
			await get_tree().process_frame
			return true
	return false


func _wait_for_home_function(function_id: StringName, frame_limit := 30) -> bool:
	for _frame: int in frame_limit:
		await get_tree().process_frame
		var home := _current_screen()
		if home != null and home.has_method("get_current_function") \
				and StringName(home.call("get_current_function")) == function_id \
				and bool(home.call("is_function_open")):
			return true
	return false


func _settle(frames: int) -> void:
	for _frame: int in frames:
		await get_tree().process_frame


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(is_equal_approx(actual, expected), "%s (expected %.3f, got %.3f)" % [message, expected, actual])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)


func _remove_generations() -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var path := TEST_SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func _finish() -> void:
	get_tree().root.remove_meta(RELOAD_PHASE_META)
	get_tree().root.remove_meta(RELOAD_EXPECTED_META)
	get_tree().root.remove_meta(RELOAD_CHECKS_META)
	get_tree().root.remove_meta(RELOAD_OLD_KNIGHT_META)
	_remove_generations()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.artifacts"))
	var report := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify({
			"ok": _failures.is_empty(),
			"checks": _checks,
			"failures": _failures,
		}, "\t") + "\n")
		report.close()
	if _failures.is_empty():
		print("FRESH PLAYER LOOP ACCEPTANCE TEST PASSED - %d checks" % _checks)
	else:
		print("FRESH PLAYER LOOP ACCEPTANCE TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	get_tree().quit(0 if _failures.is_empty() else 1)
