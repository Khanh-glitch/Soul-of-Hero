class_name SurvivalGameplayInputGate
extends Node
## One A0-owned read gate for gameplay actions. It does not consume UI events or
## alter InputMap. A press observed under any visible gameplay modal is latched
## until its matching release, including across modal close or paused processing.

const ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"attack", &"skill",
	&"ultimate", &"dash", &"soul_relay_1", &"soul_relay_2", &"interact",
	&"pause", &"ui_cancel", &"build_toggle", &"storage_toggle", &"build_place",
	&"build_slot_1", &"build_slot_2", &"build_slot_3", &"build_slot_4", &"build_slot_5",
	&"build_slot_6", &"build_slot_7", &"build_slot_8", &"build_slot_9",
	&"jump", &"light_attack", &"heavy_attack", &"roll", &"slide", &"crouch", &"debug_hit",
]

var _held_under_modal: Dictionary = {}
var _event_latches: Dictionary = {}
var _modal := false
var _last_process_frame := -1
var _last_physics_frame := -1

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_process(true)
	set_physics_process(true)
	set_process_input(true)

func modal_visible() -> bool:
	if not is_inside_tree():
		return false
	for node: Node in get_tree().get_nodes_in_group(&"gameplay_modal"):
		if node is CanvasItem and (node as CanvasItem).is_visible_in_tree():
			return true
	return false

func sync(force := false) -> void:
	var process_frame := Engine.get_process_frames()
	var physics_frame := Engine.get_physics_frames()
	var visible := modal_visible()
	if not force and process_frame == _last_process_frame and physics_frame == _last_physics_frame and visible == _modal:
		return
	_last_process_frame = process_frame
	_last_physics_frame = physics_frame
	_modal = visible
	for action: StringName in ACTIONS:
		if not InputMap.has_action(action):
			continue
		if Input.is_action_pressed(action):
			if visible:
				_held_under_modal[action] = true
		else:
			_held_under_modal.erase(action)

func observe_event(event: InputEvent) -> void:
	# Event latches also cover raw viewport input that does not update Input's
	# global pressed state. Releases always reach this always-processing node.
	if event is InputEventMouseMotion:
		return
	var visible := modal_visible()
	for action: StringName in ACTIONS:
		if not InputMap.has_action(action):
			continue
		if visible and event.is_action_pressed(action):
			_event_latches[action] = true
		elif event.is_action_released(action):
			_event_latches.erase(action)
	sync(true)

func _input(event: InputEvent) -> void:
	observe_event(event)

func _process(_delta: float) -> void:
	sync()

func _physics_process(_delta: float) -> void:
	sync()

func permits(action: StringName) -> bool:
	sync()
	return not _modal and not _held_under_modal.has(action) and not _event_latches.has(action)

func pressed(action: StringName) -> bool:
	return permits(action) and Input.is_action_pressed(action)

func just_pressed(action: StringName) -> bool:
	return permits(action) and Input.is_action_just_pressed(action)

func just_released(action: StringName) -> bool:
	return permits(action) and Input.is_action_just_released(action)

func movement() -> Vector2:
	var result := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if (result.x < 0.0 and not permits(&"move_left")) or (result.x > 0.0 and not permits(&"move_right")):
		result.x = 0.0
	if (result.y < 0.0 and not permits(&"move_up")) or (result.y > 0.0 and not permits(&"move_down")):
		result.y = 0.0
	return result
