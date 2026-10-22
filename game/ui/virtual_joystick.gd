class_name LivingArsenalJoystick
extends Control

@export_range(24.0, 96.0, 1.0) var radius := 48.0
@export_range(0.0, 0.9, 0.01) var deadzone := 0.18
@export_range(0.1, 1.0, 0.05) var opacity := 0.82

var _touch_index := -1
var _mouse_active := false
var _vector := Vector2.ZERO

@onready var _base_asset: TextureRect = %BaseAsset
@onready var _knob_asset: TextureRect = %KnobAsset


func _ready() -> void:
	add_to_group(&"virtual_action_buttons")
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sync_asset_layout()


func _exit_tree() -> void:
	release_action()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed and _touch_index < 0:
			_touch_index = touch.index
			_update_from_position(touch.position)
			accept_event()
		elif not touch.pressed and touch.index == _touch_index:
			release_action()
			accept_event()
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if drag.index == _touch_index:
			_update_from_position(drag.position)
			accept_event()
	elif event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.button_index == MOUSE_BUTTON_LEFT:
			_mouse_active = button.pressed
			if _mouse_active:
				_update_from_position(button.position)
			else:
				release_action()
			accept_event()
	elif event is InputEventMouseMotion and _mouse_active:
		_update_from_position((event as InputEventMouseMotion).position)
		accept_event()


func release_action() -> void:
	_touch_index = -1
	_mouse_active = false
	_vector = Vector2.ZERO
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		Input.action_release(action)
	_sync_asset_layout()


func get_vector() -> Vector2:
	return _vector


func _update_from_position(local_position: Vector2) -> void:
	var center := size * 0.5
	var raw := (local_position - center) / maxf(radius, 1.0)
	if raw.length() > 1.0:
		raw = raw.normalized()
	if raw.length() < deadzone:
		raw = Vector2.ZERO
	else:
		raw = raw.normalized() * inverse_lerp(deadzone, 1.0, raw.length())
	_vector = raw
	_apply_actions()
	_sync_asset_layout()


func _apply_actions() -> void:
	_set_action_strength(&"move_left", maxf(0.0, -_vector.x))
	_set_action_strength(&"move_right", maxf(0.0, _vector.x))
	_set_action_strength(&"move_up", maxf(0.0, -_vector.y))
	_set_action_strength(&"move_down", maxf(0.0, _vector.y))


func _set_action_strength(action: StringName, strength: float) -> void:
	if strength > 0.001:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)


func _sync_asset_layout() -> void:
	if _base_asset == null or _knob_asset == null:
		return
	var center := size * 0.5
	var base_extent := Vector2.ONE * radius
	_base_asset.position = center - base_extent
	_base_asset.size = base_extent * 2.0
	_base_asset.modulate = Color(0.82, 0.66, 0.45, opacity)
	var knob_size := Vector2.ONE * radius * 0.76
	_knob_asset.position = center + _vector * radius - knob_size * 0.5
	_knob_asset.size = knob_size
	_knob_asset.modulate.a = opacity
