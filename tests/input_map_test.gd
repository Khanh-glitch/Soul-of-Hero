extends SceneTree

const BOOTSTRAP_SCRIPT := preload("res://game/autoload/input_bootstrap.gd")

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var bootstrap: Node = BOOTSTRAP_SCRIPT.new()
	root.add_child(bootstrap)
	await process_frame

	for action: StringName in [
		&"move_left", &"move_right", &"move_up", &"move_down",
		&"attack", &"skill", &"ultimate", &"dash", &"soul_relay_1", &"soul_relay_2",
		&"spirit_swap_1", &"spirit_swap_2",
		&"interact", &"pause", &"light_attack", &"heavy_attack", &"jump",
		&"roll", &"slide", &"crouch",
	]:
		_expect(InputMap.has_action(action), "action exists: %s" % action)

	_expect(_has_key(&"attack", KEY_J), "J maps to semantic attack")
	_expect(_has_mouse_button(&"attack", MOUSE_BUTTON_LEFT), "left mouse maps to semantic attack")
	_expect(_has_joy_button(&"attack", JOY_BUTTON_X), "joy X maps to semantic attack")
	_expect(_has_key(&"skill", KEY_E), "E maps to semantic skill")
	_expect(not _has_key(&"skill", KEY_K), "retired K skill binding is removed")
	_expect(not _has_mouse_button(&"skill", MOUSE_BUTTON_RIGHT), "right mouse is reserved for exact target selection")
	_expect(_has_joy_button(&"skill", JOY_BUTTON_Y), "joy Y maps to semantic skill")
	_expect(_has_key(&"ultimate", KEY_R), "R maps to the active Hero ultimate")
	_expect(_has_joy_button(&"ultimate", JOY_BUTTON_B), "joy B maps to the active Hero ultimate")
	_expect(_has_key(&"dash", KEY_F), "F maps to semantic Dash")
	_expect(not _has_key(&"dash", KEY_E), "E no longer also fires Dash")
	_expect(not _has_key(&"dash", KEY_SPACE), "retired Space dash alias is removed")
	_expect(_has_joy_button(&"dash", JOY_BUTTON_A), "joy A maps to semantic dash")
	_expect(_has_key(&"soul_relay_1", KEY_Q), "Q starts support / Soul Relay")
	_expect(_has_joy_button(&"soul_relay_1", JOY_BUTTON_LEFT_SHOULDER), "LB starts support / Soul Relay")
	_expect(InputMap.action_get_events(&"soul_relay_2").is_empty(), "future second Reserve Soul has no player-facing binding")
	_expect(InputMap.action_get_events(&"spirit_swap_1").is_empty(), "old Spirit alias has no physical binding")
	_expect(InputMap.action_get_events(&"spirit_swap_2").is_empty(), "old second Spirit alias has no physical binding")
	_expect(not _has_key(&"interact", KEY_E), "E no longer leaks into world interaction")
	_expect(not _has_key(&"interact", KEY_F), "retired F interaction binding is removed")
	_expect(not _has_mouse_button(&"interact", MOUSE_BUTTON_LEFT), "LMB interaction is routed after GUI handling instead of duplicating InputMap actions")

	_expect(not _has_key(&"light_attack", KEY_J), "J does not also fire legacy light_attack")
	_expect(not _has_key(&"heavy_attack", KEY_K), "K does not also fire legacy heavy_attack")
	_expect(not _has_key(&"jump", KEY_SPACE), "Space does not also fire legacy jump")
	_expect(not _has_key(&"roll", KEY_Q), "Q does not also fire legacy roll")
	_expect(not _has_joy_button(&"dash", JOY_BUTTON_RIGHT_SHOULDER), "RB does not fire Dash or a hidden reserve slot")

	_expect(bootstrap.call("canonical_action", &"light_attack") == &"attack", "legacy Light normalizes to Attack")
	_expect(bootstrap.call("canonical_action", &"heavy_attack") == &"skill", "legacy Heavy normalizes to Skill")
	_expect(bootstrap.call("canonical_action", &"roll") == &"dash", "legacy Roll normalizes to Dash")
	_expect(bootstrap.call("canonical_action", &"spirit_swap_1") == &"soul_relay_1", "old slot-one automation normalizes to Soul Relay")

	# Running setup again must not duplicate events.
	var attack_event_count := InputMap.action_get_events(&"attack").size()
	bootstrap.call("_install_actions")
	_expect(InputMap.action_get_events(&"attack").size() == attack_event_count, "setup is idempotent")

	bootstrap.queue_free()
	if _failures.is_empty():
		print("INPUT MAP TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("INPUT MAP TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _has_key(action: StringName, keycode: Key) -> bool:
	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventKey and event.physical_keycode == keycode:
			return true
	return false


func _has_mouse_button(action: StringName, button_index: MouseButton) -> bool:
	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventMouseButton and event.button_index == button_index:
			return true
	return false


func _has_joy_button(action: StringName, button_index: JoyButton) -> bool:
	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventJoypadButton and event.button_index == button_index:
			return true
	return false


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
