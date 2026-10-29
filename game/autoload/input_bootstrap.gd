extends Node

## Runtime-owned default Input Map for SOUL OF HERO.
##
## Gameplay code should consume the semantic actions (`attack`, `skill`,
## `dash`, and direct Spirit slots) instead of binding physical inputs itself.
## Deprecated prototype actions remain registered so scripted input, MCP, and
## old touch controls can be migrated without producing missing-action errors.

const ACTION_DEADZONE := 0.2

const SEMANTIC_ACTIONS := [
	&"move_left",
	&"move_right",
	&"move_up",
	&"move_down",
	&"attack",
	&"skill",
	&"ultimate",
	&"dash",
	&"soul_relay_1",
	&"soul_relay_2",
	&"interact",
	&"field_codex",
	&"pause",
	# Survival build tool. Its own actions rather than reuse of `attack`, so the
	# build modal can never fire a swing and combat input keeps its exact meaning.
	&"build_toggle",
	&"build_place",
	&"build_slot_1",
	&"build_slot_2",
	&"build_slot_3",
	&"build_slot_4",
]

const LEGACY_ACTIONS := [
	&"jump",
	&"light_attack",
	&"heavy_attack",
	&"roll",
	&"slide",
	&"crouch",
	&"debug_hit",
	# Non-visual compatibility aliases for old automation/profile input only.
	&"spirit_swap_1",
	&"spirit_swap_2",
]

## Consumers that still receive an old action name may normalize it through
## `canonical_action()`. No physical input is duplicated onto these aliases.
const LEGACY_ACTION_ALIASES := {
	&"light_attack": &"attack",
	&"heavy_attack": &"skill",
	&"jump": &"dash",
	&"roll": &"dash",
	&"slide": &"dash",
	&"crouch": &"crouch",
	&"debug_hit": &"debug_hit",
	&"spirit_swap_1": &"soul_relay_1",
	&"spirit_swap_2": &"soul_relay_2",
}

const KEYBOARD_BINDINGS := {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"attack": [KEY_J],
	&"skill": [KEY_E],
	&"ultimate": [KEY_R],
	&"dash": [KEY_F],
	&"soul_relay_1": [KEY_Q],
	# Slot two exists architecturally but has no player-facing binding yet.
	&"soul_relay_2": [],
	# Desktop world interaction is resolved from an unhandled left-click by the
	# player controller so an accepted UI click can never leak into combat.
	&"interact": [],
	&"field_codex": [KEY_I, KEY_TAB],
	&"pause": [KEY_ESCAPE],
	# B toggles the build modal, 1-4 choose the piece, and placement is the
	# ordinary left click (see MOUSE_BINDINGS below) resolved by the build layer
	# only while the modal is open.
	&"build_toggle": [KEY_B],
	&"build_slot_1": [KEY_1],
	&"build_slot_2": [KEY_2],
	&"build_slot_3": [KEY_3],
	&"build_slot_4": [KEY_4],
}

const MOUSE_BINDINGS := {
	&"attack": [MOUSE_BUTTON_LEFT],
	# Placement shares the physical button with attack but is a distinct action:
	# `SurvivalBuildSystem` is the only listener, and it only acts while the build
	# modal is open, so the Knight's own click handling is unchanged.
	&"build_place": [MOUSE_BUTTON_LEFT],
}

const JOYPAD_BINDINGS := {
	&"attack": [JOY_BUTTON_X],
	&"skill": [JOY_BUTTON_Y],
	&"ultimate": [JOY_BUTTON_B],
	&"dash": [JOY_BUTTON_A],
	&"soul_relay_1": [JOY_BUTTON_LEFT_SHOULDER],
	&"soul_relay_2": [],
	&"interact": [JOY_BUTTON_BACK],
	&"field_codex": [JOY_BUTTON_RIGHT_SHOULDER],
	&"pause": [JOY_BUTTON_START],
	&"build_toggle": [JOY_BUTTON_DPAD_UP],
	&"build_place": [JOY_BUTTON_X],
}

## Defaults installed by the prototype bootstrap. Removing only these known
## events makes hot-reload/migration deterministic without erasing unrelated
## user or project remaps.
const RETIRED_DEFAULT_KEYS := {
	&"jump": [KEY_SPACE],
	&"light_attack": [KEY_J],
	&"heavy_attack": [KEY_K],
	&"skill": [KEY_K],
	&"dash": [KEY_SHIFT, KEY_E, KEY_SPACE],
	&"roll": [KEY_Q],
	&"slide": [KEY_C],
	&"crouch": [KEY_CTRL],
	# Remove the retired desktop interaction keys during hot reload/migration.
	&"interact": [KEY_E, KEY_F],
}

const RETIRED_DEFAULT_MOUSE_BUTTONS := {
	&"skill": [MOUSE_BUTTON_RIGHT],
}

const RETIRED_DEFAULT_JOY_BUTTONS := {
	&"jump": [JOY_BUTTON_A],
	&"light_attack": [JOY_BUTTON_X],
	&"heavy_attack": [JOY_BUTTON_Y],
	&"dash": [JOY_BUTTON_RIGHT_SHOULDER],
	&"roll": [JOY_BUTTON_B],
	&"slide": [JOY_BUTTON_LEFT_SHOULDER],
}


func _enter_tree() -> void:
	_install_actions()


func _install_actions() -> void:
	for action: StringName in SEMANTIC_ACTIONS:
		_ensure_action(action)
	for action: StringName in LEGACY_ACTIONS:
		_ensure_action(action)

	_remove_retired_defaults()

	for action: StringName in KEYBOARD_BINDINGS:
		for keycode: Key in KEYBOARD_BINDINGS[action]:
			_add_key(action, keycode)

	for action: StringName in MOUSE_BINDINGS:
		for button_index: MouseButton in MOUSE_BINDINGS[action]:
			_add_mouse_button(action, button_index)

	for action: StringName in JOYPAD_BINDINGS:
		for button_index: JoyButton in JOYPAD_BINDINGS[action]:
			_add_joy_button(action, button_index)

	_add_joy_axis(&"move_left", JOY_AXIS_LEFT_X, -1.0)
	_add_joy_axis(&"move_right", JOY_AXIS_LEFT_X, 1.0)
	_add_joy_axis(&"move_up", JOY_AXIS_LEFT_Y, -1.0)
	_add_joy_axis(&"move_down", JOY_AXIS_LEFT_Y, 1.0)


static func canonical_action(action: StringName) -> StringName:
	return StringName(LEGACY_ACTION_ALIASES.get(action, action))


func _remove_retired_defaults() -> void:
	for action: StringName in RETIRED_DEFAULT_KEYS:
		for keycode: Key in RETIRED_DEFAULT_KEYS[action]:
			_remove_key(action, keycode)
	for action: StringName in RETIRED_DEFAULT_JOY_BUTTONS:
		for button_index: JoyButton in RETIRED_DEFAULT_JOY_BUTTONS[action]:
			_remove_joy_button(action, button_index)
	for action: StringName in RETIRED_DEFAULT_MOUSE_BUTTONS:
		for button_index: MouseButton in RETIRED_DEFAULT_MOUSE_BUTTONS[action]:
			_remove_mouse_button(action, button_index)


func _ensure_action(action: StringName) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, ACTION_DEADZONE)


func _add_key(action: StringName, keycode: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)


func _remove_key(action: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action):
		return
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	if InputMap.action_has_event(action, event):
		InputMap.action_erase_event(action, event)


func _add_mouse_button(action: StringName, button_index: MouseButton) -> void:
	var event := InputEventMouseButton.new()
	event.button_index = button_index
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)


func _remove_mouse_button(action: StringName, button_index: MouseButton) -> void:
	if not InputMap.has_action(action):
		return
	var event := InputEventMouseButton.new()
	event.button_index = button_index
	if InputMap.action_has_event(action, event):
		InputMap.action_erase_event(action, event)


func _add_joy_button(action: StringName, button_index: JoyButton) -> void:
	var event := InputEventJoypadButton.new()
	event.button_index = button_index
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)


func _remove_joy_button(action: StringName, button_index: JoyButton) -> void:
	if not InputMap.has_action(action):
		return
	var event := InputEventJoypadButton.new()
	event.button_index = button_index
	if InputMap.action_has_event(action, event):
		InputMap.action_erase_event(action, event)


func _add_joy_axis(action: StringName, axis: JoyAxis, axis_value: float) -> void:
	var event := InputEventJoypadMotion.new()
	event.axis = axis
	event.axis_value = axis_value
	if not InputMap.action_has_event(action, event):
		InputMap.action_add_event(action, event)
