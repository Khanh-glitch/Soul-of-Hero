class_name CollectibleSigil
extends Area2D

signal collected

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const SIGIL_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/coin/coin_1.png",
	"res://assets/environment/dungeon/items/coin/coin_2.png",
	"res://assets/environment/dungeon/items/coin/coin_3.png",
	"res://assets/environment/dungeon/items/coin/coin_4.png",
]

@export_range(0, 9999, 1) var score_bonus: int = 75
@export var glow_color := Color(0.65, 0.32, 1.0, 1.0)

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var collision_shape: CollisionShape2D = %CollisionShape2D
@onready var glow: PointLight2D = %Glow

var _elapsed := 0.0
var _collected := false


func _ready() -> void:
	animated_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		animated_sprite.sprite_frames,
		&"pulse",
		PackedStringArray(SIGIL_FRAME_PATHS),
		8.0,
		true
	)
	animated_sprite.play(&"pulse")
	animated_sprite.modulate = glow_color
	glow.color = glow_color
	glow.texture = SpriteFramesFactory.make_radial_texture(64)


func _process(delta: float) -> void:
	if _collected:
		return
	_elapsed += delta
	animated_sprite.position.y = sin(_elapsed * 2.8) * 4.0
	animated_sprite.rotation = sin(_elapsed * 1.6) * 0.12
	glow.energy = 0.75 + sin(_elapsed * 4.0) * 0.14


func _on_body_entered(body: Node2D) -> void:
	if _collected or not body.is_in_group(&"player"):
		return
	_collected = true
	set_deferred(&"monitoring", false)
	collision_shape.set_deferred(&"disabled", true)
	GameSession.collect_sigil()
	GameSession.add_score(score_bonus)
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 1.35, Color(0.82, 0.52, 1.0, 0.92), 8)
	VfxCatalog.spawn(get_parent(), &"echo_anchor", global_position, 0.0, 0.92, Color(0.82, 0.52, 1.0, 0.58), 7)
	collected.emit()

	var tween := create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.tween_property(self, "position:y", position.y - 20.0, 0.3)
	tween.tween_property(self, "scale", Vector2(2.0, 2.0), 0.3)
	tween.tween_property(self, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(queue_free)
