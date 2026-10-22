class_name CollectibleCoin
extends Area2D

signal collected(value: int)

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const COIN_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/coin/coin_1.png",
	"res://assets/environment/dungeon/items/coin/coin_2.png",
	"res://assets/environment/dungeon/items/coin/coin_3.png",
	"res://assets/environment/dungeon/items/coin/coin_4.png",
]

@export_range(1, 9999, 1) var score_value: int = 10
@export_range(0.0, 12.0, 0.25) var bob_height: float = 3.0
@export_range(0.1, 12.0, 0.1) var bob_speed: float = 3.5

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var collision_shape: CollisionShape2D = %CollisionShape2D

var _elapsed := 0.0
var _collected := false


func _ready() -> void:
	animated_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		animated_sprite.sprite_frames,
		&"spin",
		PackedStringArray(COIN_FRAME_PATHS),
		10.0,
		true
	)
	animated_sprite.play(&"spin")


func _process(delta: float) -> void:
	if _collected:
		return
	_elapsed += delta
	animated_sprite.position.y = sin(_elapsed * bob_speed) * bob_height


func _on_body_entered(body: Node2D) -> void:
	if _collected or not body.is_in_group(&"player"):
		return
	_collected = true
	set_deferred(&"monitoring", false)
	collision_shape.set_deferred(&"disabled", true)
	GameSession.add_score(score_value)
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position, 0.0, 0.82, Color(1.0, 0.78, 0.20, 0.88), 7)
	GameEvents.combat_cue_requested.emit(&"coin_pickup", global_position, {
		"source": &"collectible_coin",
		"material": &"metal",
	})
	collected.emit(score_value)

	var tween := create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tween.tween_property(animated_sprite, "position:y", -16.0, 0.22)
	tween.tween_property(animated_sprite, "scale", Vector2(2.1, 2.1), 0.22)
	tween.tween_property(animated_sprite, "modulate:a", 0.0, 0.22)
	tween.chain().tween_callback(queue_free)
