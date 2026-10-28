class_name OverworldGate
extends Area2D
## A physical dungeon entrance in the overworld.
## Reads its level_id, asks AppFlow for unlock/completion state, and on interact
## asks the parent OverworldController to start the level through the authority.

signal gate_interacted(gate: Area2D, level_id: StringName, world_id: StringName)

@export var level_id: StringName
@export var world_id: StringName
@export var display_name: String = ""
@export var requires_shortcut: StringName

@onready var _label: Label = $Label
@onready var _interact_prompt: Control = $InteractPrompt

var _player_in_range := false


func _ready() -> void:
	_interact_prompt.visible = false
	_refresh_label()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	set_process_input(false)


func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		_player_in_range = true
		_interact_prompt.visible = true
		set_process_input(true)


func _on_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		_player_in_range = false
		_interact_prompt.visible = false
		set_process_input(false)


func _unhandled_input(event: InputEvent) -> void:
	if not _player_in_range:
		return
	if event.is_action_pressed("interact"):
		emit_signal("gate_interacted", self, level_id, world_id)
		get_viewport().set_input_as_handled()


func _refresh_label() -> void:
	var app_flow := get_node_or_null("/root/AppFlow")
	var state := "LOCKED"
	if app_flow != null:
		var unlocked := false
		var completed := false
		if app_flow.has_method("is_campaign_level_unlocked"):
			unlocked = bool(app_flow.call("is_campaign_level_unlocked", level_id))
		if app_flow.has_method("is_campaign_level_completed"):
			completed = bool(app_flow.call("is_campaign_level_completed", level_id))
		state = "CLEARED" if completed else ("ENTER" if unlocked else "LOCKED")
	_label.text = "%s\n[%s]" % [display_name, state]
	_label.modulate = _tint_for_state(state)


func _tint_for_state(state: String) -> Color:
	match state:
		"CLEARED":
			return Color(0.6, 1.0, 0.7)
		"ENTER":
			return Color(1.0, 0.9, 0.6)
		_:
			return Color(0.7, 0.4, 0.4)


func refresh() -> void:
	_refresh_label()
