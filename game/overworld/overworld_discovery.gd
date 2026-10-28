class_name OverworldDiscovery
extends Area2D

signal discovery_collected(discovery_id: StringName, position: Vector2)

@export var discovery_id: StringName
@export var kind: String = "coin_cache"

var _player_in_range := false
var _collected := false

@onready var _prompt: Label = $Prompt


func _ready() -> void:
	_prompt.visible = false
	body_entered.connect(_on_enter)
	body_exited.connect(_on_exit)
	set_process_input(false)


func _on_enter(body: Node) -> void:
	if _collected:
		return
	if body.is_in_group("player"):
		_player_in_range = true
		_prompt.visible = true
		set_process_input(true)


func _on_exit(body: Node) -> void:
	if body.is_in_group("player"):
		_player_in_range = false
		_prompt.visible = false
		set_process_input(false)


func _unhandled_input(event: InputEvent) -> void:
	if not _player_in_range or _collected:
		return
	if event.is_action_pressed("interact"):
		_collected = true
		_prompt.visible = false
		set_process_input(false)
		emit_signal("discovery_collected", discovery_id, global_position)
		visible = false
		get_viewport().set_input_as_handled()
