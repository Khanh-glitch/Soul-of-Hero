extends Node

var _checks := 0
var _failures: Array[String] = []
var _app_root: Node
var _save: LivingArsenalSaveService


func start(app_root: Node) -> void:
	_app_root = app_root
	_run.call_deferred()


func _run() -> void:
	get_tree().root.size = Vector2i(640, 360)
	_save = get_tree().root.get_node_or_null("SaveService") as LivingArsenalSaveService
	_expect(_save != null, "production SaveService autoload is available")
	if _save == null:
		_finish()
		return

	_expect(await _wait_for_route(&"title", 6000), "Loading completes at the profile choice before Home")
	var title := _current_screen() as Control
	_expect(title != null and title.name == &"TitleScreen", "the authored startup choice scene is mounted")
	if title == null:
		_finish()
		return

	var buttons := _buttons_below(title)
	_expect(buttons.size() == 2, "startup exposes exactly Continue and New Game")
	var continue_button := title.find_child("ContinueButton", true, false) as Button
	var new_game_button := title.find_child("NewGameButton", true, false) as Button
	_expect(
		continue_button != null and continue_button.text == "TIẾP TỤC"
			and continue_button.icon != null
			and continue_button.icon.resource_path.ends_with("UI_TravelBook_IconPlay01a.png"),
		"Continue is an authored asset-backed action"
	)
	_expect(
		new_game_button != null and new_game_button.text == "CHƠI MỚI"
			and new_game_button.icon != null
			and new_game_button.icon.resource_path.ends_with("UI_TravelBook_IconRestart01a.png"),
		"New Game is an authored asset-backed action"
	)
	_expect(_count_panels_below(title) == 0, "startup choice adds no decorative code-style panels")
	var title_source := FileAccess.get_file_as_string("res://game/ui/screens/title/title_screen.gd")
	_expect(
		not ".new(" in title_source and not "draw_" in title_source and not "_draw(" in title_source,
		"startup logic creates and draws no UI in code"
	)
	_assert_no_fresh_axe("fresh profile")

	_expect(_save.update_settings({"music_volume": 0.37}), "profile fixture stores a user preference")
	_expect(_save.grant_player_levels(3, "test:startup_choice:levels"), "profile fixture stores player progression")
	_expect(
		_save.grant_inventory_item(&"startup_test_ember", &"material", 4, "test:startup_choice:item"),
		"profile fixture stores inventory"
	)
	_expect(
		_save.set_tutorial_completed(&"movement", "test:startup_choice:tutorial"),
		"profile fixture stores tutorial state"
	)
	var revision_before_continue := int(_save.get_value(["revision"], -1))
	continue_button.pressed.emit()
	_expect(await _wait_for_route(&"home"), "Continue enters Home")
	_expect(
		int(_save.get_value(["revision"], -2)) == revision_before_continue
			and int(_save.get_player_progression_snapshot().get("player_level", 0)) == 4
			and int(_save.get_value(["inventory", "item_stacks", "startup_test_ember", "quantity"], 0)) == 4,
		"Continue preserves the existing save without rewriting it"
	)

	AppFlow.open_title()
	await get_tree().process_frame
	title = _current_screen() as Control
	new_game_button = title.find_child("NewGameButton", true, false) as Button if title != null else null
	_expect(new_game_button != null, "profile choice can be reopened before New Game")
	if new_game_button == null:
		_finish()
		return
	new_game_button.pressed.emit()
	_expect(await _wait_for_route(&"home"), "New Game resets safely, then enters Home")
	_expect(int(_save.get_player_progression_snapshot().get("player_level", 0)) == 1, "New Game resets Player Level")
	_expect(int(_save.get_player_progression_snapshot().get("xp", -1)) == 0, "New Game resets Player XP")
	_expect(
		int(_save.get_value(["inventory", "item_stacks", "startup_test_ember", "quantity"], 0)) == 0,
		"New Game clears collected inventory"
	)
	_expect(not bool(_save.get_value(["tutorials", "movement"], true)), "New Game clears tutorial progress")
	_expect(is_equal_approx(float(_save.get_value(["settings", "music_volume"], 0.0)), 0.37), "New Game preserves user settings")
	_assert_no_fresh_axe("newly reset profile")
	_finish()


func _assert_no_fresh_axe(context: String) -> void:
	var snapshot := _save.get_snapshot()
	var progression: Dictionary = snapshot.get("progression", {})
	var heroes: Dictionary = progression.get("unlocked_heroes", {})
	var team: Dictionary = snapshot.get("soul_team", {})
	var reserves: Array = team.get("reserve_souls", []) if team.get("reserve_souls", []) is Array else []
	var inventory: Dictionary = snapshot.get("inventory", {})
	var souls: Array = inventory.get("hero_souls", []) if inventory.get("hero_souls", []) is Array else []
	var has_axe_soul := false
	for raw_soul: Variant in souls:
		if raw_soul is Dictionary and String((raw_soul as Dictionary).get("hero_id", "")) == "axe_hero":
			has_axe_soul = true
	_expect(
		String(team.get("active_hero", "")) == "sword_hero"
			and reserves == ["", ""]
			and not bool(heroes.get("axe_hero", false))
			and not has_axe_soul,
		"%s has Sword only; Axe remains a later unlock/drop" % context
	)


func _wait_for_route(route_id: StringName, timeout_msec := 2500) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_msec
	while Time.get_ticks_msec() < deadline:
		if is_instance_valid(_app_root) and StringName(_app_root.call(&"get_current_route")) == route_id:
			await get_tree().process_frame
			return true
		await get_tree().create_timer(0.02).timeout
	return false


func _current_screen() -> Node:
	if not is_instance_valid(_app_root):
		return null
	var host := _app_root.get_node_or_null("RouteHost")
	return host.get_child(0) if host != null and host.get_child_count() == 1 else null


func _buttons_below(node: Node) -> Array[Button]:
	var buttons: Array[Button] = []
	if node is Button:
		buttons.append(node as Button)
	for child: Node in node.get_children():
		buttons.append_array(_buttons_below(child))
	return buttons


func _count_panels_below(node: Node) -> int:
	var count := 1 if node is PanelContainer else 0
	for child: Node in node.get_children():
		count += _count_panels_below(child)
	return count


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _finish() -> void:
	var exit_code := 0 if _failures.is_empty() else 1
	if _failures.is_empty():
		print("STARTUP PROFILE CHOICE TEST PASSED — %d checks" % _checks)
	else:
		for failure: String in _failures:
			push_error("STARTUP PROFILE CHOICE FAIL: %s" % failure)
		print("STARTUP PROFILE CHOICE TEST FAILED — %d/%d checks" % [_failures.size(), _checks])

	# The test node starts as an AppRoot child. Reparent it before freeing the
	# production root so this deferred mixer drain can finish deterministically.
	_stop_audio_below(get_tree().root)
	if is_instance_valid(_app_root):
		AppFlow.detach_app_root(_app_root)
		if get_parent() == _app_root:
			reparent(get_tree().root)
		if get_tree().current_scene == _app_root:
			get_tree().unload_current_scene()
		else:
			_app_root.free()
		_app_root = null
	_finish_after_cleanup.call_deferred(exit_code)


func _finish_after_cleanup(exit_code: int) -> void:
	await get_tree().process_frame
	# UI button feedback may keep a playback reference until the next real mixer
	# tick even after its route has been freed.
	_stop_audio_below(get_tree().root)
	await get_tree().create_timer(0.25, true, false, true).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	get_tree().quit(exit_code)


func _stop_audio_below(node: Node) -> void:
	for child: Node in node.get_children():
		if child is AudioStreamPlayer:
			(child as AudioStreamPlayer).stop()
		elif child is AudioStreamPlayer2D:
			(child as AudioStreamPlayer2D).stop()
		_stop_audio_below(child)
