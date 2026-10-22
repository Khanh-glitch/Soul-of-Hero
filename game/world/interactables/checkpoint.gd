class_name CheckpointFlag
extends Area2D

signal activated(respawn_position: Vector2)

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const FLAG_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/flag/flag_1.png",
	"res://assets/environment/dungeon/items/flag/flag_2.png",
	"res://assets/environment/dungeon/items/flag/flag_3.png",
	"res://assets/environment/dungeon/items/flag/flag_4.png",
]

@export var inactive_color := Color(0.55, 0.55, 0.65, 1.0)
@export var active_color := Color(0.45, 1.0, 0.7, 1.0)

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var respawn_point: Marker2D = %RespawnPoint
@onready var glow: PointLight2D = %Glow

var is_active := false


func _ready() -> void:
	animated_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		animated_sprite.sprite_frames,
		&"wave",
		PackedStringArray(FLAG_FRAME_PATHS),
		7.0,
		true
	)
	animated_sprite.play(&"wave")
	glow.texture = SpriteFramesFactory.make_radial_texture(64)
	glow.color = active_color
	GameEvents.checkpoint_changed.connect(_on_checkpoint_changed)
	_on_checkpoint_changed(GameSession.checkpoint)


func _on_body_entered(body: Node2D) -> void:
	if is_active or not body.is_in_group(&"player"):
		return
	var respawn_position := respawn_point.global_position
	GameSession.set_checkpoint(respawn_position)
	activated.emit(respawn_position)


func _on_checkpoint_changed(checkpoint_position: Vector2) -> void:
	var should_be_active := checkpoint_position.distance_to(respawn_point.global_position) < 1.0
	if is_active == should_be_active:
		animated_sprite.modulate = active_color if is_active else inactive_color
		glow.energy = 0.85 if is_active else 0.0
		return
	is_active = should_be_active
	animated_sprite.modulate = active_color if is_active else inactive_color

	var tween := create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if is_active:
		VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -16.0), 0.0, 1.25, active_color, 7)
		VfxCatalog.spawn(get_parent(), &"echo_anchor", global_position + Vector2(0.0, -16.0), 0.0, 0.82, Color(active_color, 0.58), 6)
		tween.tween_property(animated_sprite, "scale", Vector2(2.35, 2.35), 0.2)
		tween.tween_property(glow, "energy", 0.85, 0.25)
		tween.chain().tween_property(animated_sprite, "scale", Vector2(2.0, 2.0), 0.14)
	else:
		tween.tween_property(glow, "energy", 0.0, 0.2)
