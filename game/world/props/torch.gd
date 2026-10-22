class_name DungeonTorch
extends Node2D

const SpriteFramesFactory = preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

enum TorchStyle {
	FLOOR,
	SIDE,
	CANDLESTICK,
}

@export var style: TorchStyle = TorchStyle.FLOOR
@export var light_color := Color(1.0, 0.48, 0.18, 1.0)
@export_range(0.0, 4.0, 0.05) var base_energy: float = 1.0
@export_range(0.0, 0.5, 0.01) var flicker_amount: float = 0.12
@export_range(0.2, 5.0, 0.1) var light_scale: float = 1.65
@export var pickup_message := "Nhấn chuột trái để nhặt đuốc"

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var point_light: PointLight2D = %PointLight2D
@onready var interaction_area: Area2D = %InteractionArea
@onready var collision_shape: CollisionShape2D = %CollisionShape2D

var _elapsed := 0.0
var _nearby_player: Node2D
var held_by_player := false


func _ready() -> void:
	add_to_group(&"player_interactable")
	animated_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(
		animated_sprite.sprite_frames,
		&"burn",
		_get_frame_paths(),
		10.0,
		true
	)
	animated_sprite.play(&"burn")
	point_light.texture = SpriteFramesFactory.make_radial_texture(96)
	point_light.color = light_color
	point_light.texture_scale = light_scale
	point_light.energy = base_energy
	interaction_area.body_entered.connect(_on_body_entered)
	interaction_area.body_exited.connect(_on_body_exited)


func _process(delta: float) -> void:
	_elapsed += delta
	var flicker := sin(_elapsed * 13.0) * 0.55 + sin(_elapsed * 21.7) * 0.45
	point_light.energy = maxf(0.0, base_energy + flicker * flicker_amount)
	if held_by_player:
		rotation = 0.0


func can_interact(player: Node2D) -> bool:
	return not held_by_player and is_instance_valid(player) and player == _nearby_player


func interact(player: Node2D) -> bool:
	if not can_interact(player) or not player.has_method(&"pickup_torch"):
		return false
	return bool(player.call(&"pickup_torch", self))


func set_held_by_player(enabled: bool) -> void:
	_set_held(enabled)


func _set_held(enabled: bool) -> void:
	var effect_position := global_position + Vector2(0.0, -16.0)
	held_by_player = enabled
	collision_shape.set_deferred(&"disabled", enabled)
	interaction_area.set_deferred(&"monitoring", not enabled)
	interaction_area.set_deferred(&"monitorable", not enabled)
	animated_sprite.scale = Vector2(1.35, 1.35) if enabled else Vector2(2.0, 2.0)
	point_light.texture_scale = light_scale * (1.45 if enabled else 1.0)
	VfxCatalog.spawn(get_parent(), &"world_sparkle", effect_position, 0.0, 0.62, Color(1.0, 0.54, 0.18, 0.76), 6)
	VfxCatalog.spawn(get_parent(), &"smoke_puff", effect_position, -PI * 0.5, 0.42, Color(0.70, 0.62, 0.54, 0.34), 5)
	GameEvents.combat_cue_requested.emit(
		&"torch_pickup" if enabled else &"torch_place",
		effect_position,
		{"source": &"dungeon_torch", "style": int(style)}
	)


func _on_body_entered(body: Node2D) -> void:
	if held_by_player or not body.is_in_group(&"player"):
		return
	_nearby_player = body
	GameEvents.toast_requested.emit(pickup_message)


func _on_body_exited(body: Node2D) -> void:
	if body == _nearby_player:
		_nearby_player = null


func _get_frame_paths() -> PackedStringArray:
	match style:
		TorchStyle.SIDE:
			return PackedStringArray([
				"res://assets/environment/dungeon/items/torch/side_torch_1.png",
				"res://assets/environment/dungeon/items/torch/side_torch_2.png",
				"res://assets/environment/dungeon/items/torch/side_torch_3.png",
				"res://assets/environment/dungeon/items/torch/side_torch_4.png",
			])
		TorchStyle.CANDLESTICK:
			return PackedStringArray([
				"res://assets/environment/dungeon/items/torch/candlestick_1_1.png",
				"res://assets/environment/dungeon/items/torch/candlestick_1_2.png",
				"res://assets/environment/dungeon/items/torch/candlestick_1_3.png",
				"res://assets/environment/dungeon/items/torch/candlestick_1_4.png",
			])
		_:
			return PackedStringArray([
				"res://assets/environment/dungeon/items/torch/torch_1.png",
				"res://assets/environment/dungeon/items/torch/torch_2.png",
				"res://assets/environment/dungeon/items/torch/torch_3.png",
				"res://assets/environment/dungeon/items/torch/torch_4.png",
			])
