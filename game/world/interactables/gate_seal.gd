class_name GateSeal
extends Area2D

signal seal_activated(seal_id: StringName, seal: GateSeal)

const SpriteFramesFactory := preload("res://game/world/sprite_frame_factory.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const SEAL_FRAME_PATHS := [
	"res://assets/environment/dungeon/items/flag/flag_1.png",
	"res://assets/environment/dungeon/items/flag/flag_2.png",
	"res://assets/environment/dungeon/items/flag/flag_3.png",
	"res://assets/environment/dungeon/items/flag/flag_4.png",
]

@export var seal_id: StringName
@export var display_name := "GATE SEAL"
@export var interaction_message := "Nhấn chuột trái để phá phong ấn cổng"

@onready var _sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var _glow: PointLight2D = %Glow
@onready var _label: Label = %SealLabel
@onready var _aura: Sprite2D = %SealAura
@onready var _cross_h: Line2D = %SealHorizontal
@onready var _cross_v: Line2D = %SealVertical

var _nearby_player: Node2D
var _activated := false
var _elapsed := 0.0
var _activation_authority: Callable


func _ready() -> void:
	add_to_group(&"player_interactable")
	_sprite.sprite_frames = SpriteFramesFactory.empty()
	SpriteFramesFactory.add_file_animation(_sprite.sprite_frames, &"pulse", PackedStringArray(SEAL_FRAME_PATHS), 8.0, true)
	_sprite.play(&"pulse")
	_glow.texture = SpriteFramesFactory.make_radial_texture(86)
	_refresh_presentation()


func _process(delta: float) -> void:
	_elapsed += delta
	_sprite.position.y = -19.0 + sin(_elapsed * 2.8) * 1.6
	_glow.energy = (0.28 if _activated else 0.88) + sin(_elapsed * 4.2) * 0.08
	_aura.frame = int(floor(_elapsed * 13.0)) % maxi(1, _aura.hframes)
	_aura.scale = Vector2.ONE * (0.98 + sin(_elapsed * 3.6) * 0.10)


func can_interact(player: Node2D) -> bool:
	return is_instance_valid(player) and player == _nearby_player and not _activated


func interact(player: Node2D) -> bool:
	if not is_instance_valid(player) or player != _nearby_player:
		return false
	if _activated:
		_toast("%s đã bị phá." % display_name)
		return true
	# Special encounters may own the canonical objective transaction.  The
	# physical actor only changes presentation and grants its sigil after that
	# authority has accepted the interaction.  With no authority installed the
	# original generic GateSeal behaviour is preserved.
	if _activation_authority.is_valid() \
			and not bool(_activation_authority.call(seal_id, self)):
		_toast("The seal resisted. Try again.")
		return true
	_activated = true
	GameSession.collect_sigil()
	_refresh_presentation()
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -5.0), 0.0, 1.25, Color(1.0, 0.30, 0.43, 0.90), 8)
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position + Vector2(0.0, -5.0), -PI * 0.5, 0.72, Color(0.42, 0.30, 0.48, 0.62), 7)
	seal_activated.emit(seal_id, self)
	return true


func set_activation_authority(authority: Callable) -> void:
	_activation_authority = authority


func is_activated() -> bool:
	return _activated


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group(&"player"):
		return
	_nearby_player = body
	_toast("%s đã bị phá." % display_name if _activated else interaction_message)


func _on_body_exited(body: Node2D) -> void:
	if body == _nearby_player:
		_nearby_player = null


func _refresh_presentation() -> void:
	var color := Color("66566f") if _activated else Color("ff4d6d")
	_sprite.modulate = color
	_glow.color = color
	_label.text = "%s\n%s" % [display_name, "ĐÃ PHÁ" if _activated else "CHUỘT TRÁI"]
	_label.modulate = color.lightened(0.2)
	_aura.modulate = Color(color, 0.28 if _activated else 0.60)
	_cross_h.default_color = Color(color, 0.48 if _activated else 0.92)
	_cross_v.default_color = Color(color, 0.48 if _activated else 0.92)
	monitorable = not _activated


func _toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"toast_requested"):
		events.emit_signal(&"toast_requested", message)
