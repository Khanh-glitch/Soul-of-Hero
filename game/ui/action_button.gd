class_name VirtualActionButton
extends Button

## A mouse/touch friendly action button for the on-screen controller.
## Every exit path releases the simulated action so movement can never get stuck.

@export var action_name: StringName

var _action_held := false
var _active_touch_index := -1


func _ready() -> void:
	focus_mode = Control.FOCUS_NONE
	button_mask = MOUSE_BUTTON_MASK_LEFT
	button_down.connect(_press_action)
	button_up.connect(_release_action)
	mouse_exited.connect(_release_action)
	visibility_changed.connect(_on_visibility_changed)
	add_to_group(&"virtual_action_buttons")


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT:
			if mouse_event.pressed:
				_press_action()
			else:
				_release_action()
	elif event is InputEventScreenTouch:
		var touch_event := event as InputEventScreenTouch
		if touch_event.pressed and _active_touch_index < 0:
			_active_touch_index = touch_event.index
			_press_action()
		elif not touch_event.pressed and touch_event.index == _active_touch_index:
			_release_action()
	elif event is InputEventScreenDrag:
		var drag_event := event as InputEventScreenDrag
		if drag_event.index == _active_touch_index and not Rect2(Vector2.ZERO, size).has_point(drag_event.position):
			_release_action()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT or what == NOTIFICATION_EXIT_TREE:
		_release_action()


func release_action() -> void:
	_release_action()


func _press_action() -> void:
	if _action_held or action_name.is_empty() or not InputMap.has_action(action_name):
		return
	_action_held = true
	Input.action_press(action_name)


func _release_action() -> void:
	_active_touch_index = -1
	if not _action_held:
		return
	_action_held = false
	if not action_name.is_empty():
		Input.action_release(action_name)


func _on_visibility_changed() -> void:
	if not is_visible_in_tree():
		_release_action()
