class_name FloorDoor
extends Area2D

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export var door_label := "Door"
@export var target_position := Vector2.ZERO
@export var interaction_message := "Nhấn chuột trái để đi qua cửa"

@onready var sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var glow: PointLight2D = %Glow

var _nearby_player: Node2D


func _ready() -> void:
	add_to_group(&"player_interactable")
	sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		sprite.sprite_frames,
		&"idle",
		PackedStringArray([
			"res://assets/environment/dungeon/items/flag/flag_1.png",
			"res://assets/environment/dungeon/items/flag/flag_2.png",
			"res://assets/environment/dungeon/items/flag/flag_3.png",
			"res://assets/environment/dungeon/items/flag/flag_4.png",
		]),
		7.0,
		true
	)
	sprite.play(&"idle")
	glow.texture = SpriteFramesFactory.make_radial_texture(96)
	glow.color = Color(0.35, 0.62, 1.0, 1.0)
	glow.energy = 0.65


func can_interact(player: Node2D) -> bool:
	return (
		is_instance_valid(player)
		and player == _nearby_player
		and target_position != Vector2.ZERO
	)


func interact(player: Node2D) -> bool:
	if not can_interact(player):
		return false
	VfxCatalog.spawn(get_parent(), &"world_portal", player.global_position, 0.0, 0.72, Color(0.58, 0.78, 1.0, 0.62), 8)
	player.global_position = target_position
	VfxCatalog.spawn(get_parent(), &"world_portal", target_position, PI, 0.72, Color(0.58, 0.78, 1.0, 0.62), 8)
	GameEvents.combat_cue_requested.emit(&"door_open", target_position, {
		"source": &"floor_door",
		"material": &"stone",
	})
	GameEvents.toast_requested.emit(door_label)
	RealtimeBridge.publish_event("floor_door_used", {
		"door": door_label,
		"target": [target_position.x, target_position.y],
	})
	return true


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group(&"player"):
		return
	_nearby_player = body
	GameEvents.toast_requested.emit(interaction_message)


func _on_body_exited(body: Node2D) -> void:
	if body == _nearby_player:
		_nearby_player = null
