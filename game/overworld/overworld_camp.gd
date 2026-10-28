class_name OverworldCamp
extends Area2D

signal camp_activated(camp_id: StringName, position: Vector2)

@export var camp_id: StringName
@export var camp_name: String = "Camp"

var _player_in_range := false
var _activated_once := false

@onready var _prompt: Label = $Prompt


func _ready() -> void:
	_prompt.visible = false
	body_entered.connect(_on_enter)
	body_exited.connect(_on_exit)
	set_process_input(false)


func _on_enter(body: Node) -> void:
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
	if not _player_in_range:
		return
	if event.is_action_pressed("interact"):
		emit_signal("camp_activated", camp_id, global_position)
		_prompt.text = "[E] Rested"
		await get_tree().create_timer(1.2, true).timeout
		_prompt.text = "[E] Rest at %s" % camp_name
		get_viewport().set_input_as_handled()
