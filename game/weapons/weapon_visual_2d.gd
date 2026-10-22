class_name WeaponVisual2D
extends Node2D

const BOW_TEXTURE := preload("res://assets/characters/archer/archer_arrow.png")
const SWORD_TEXTURE := preload("res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/swords/rpg_icons30.png")
const AXE_TEXTURE := preload("res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/axes/rpg_icons89.png")

const WEAPON_TEXTURES := {
	&"bow": BOW_TEXTURE,
	&"sword": SWORD_TEXTURE,
	&"axe": AXE_TEXTURE,
}

@export var orbiting := false
@export var orbit_radius := Vector2(20.0, 7.0)
@export var orbit_center := Vector2(0.0, -23.0)

var weapon_id: StringName = &""
var _elapsed := 0.0

@onready var _weapon_sprite: Sprite2D = %WeaponSprite
@onready var _aura_sprite: Sprite2D = %AuraSprite


func _ready() -> void:
	set_process(orbiting)
	visible = not weapon_id.is_empty()
	_apply_asset_visual()


func _process(delta: float) -> void:
	if not orbiting or weapon_id.is_empty():
		return
	_elapsed += delta
	position = orbit_center + Vector2(
		cos(_elapsed * 1.65) * orbit_radius.x,
		sin(_elapsed * 1.65) * orbit_radius.y
	)
	rotation = sin(_elapsed * 1.2) * 0.12
	_aura_sprite.frame = int(_elapsed * 18.0) % maxi(1, _aura_sprite.hframes)
	_weapon_sprite.modulate.a = 0.88 + sin(_elapsed * 4.2) * 0.10


func set_weapon(next_weapon_id: StringName) -> void:
	weapon_id = next_weapon_id
	visible = not weapon_id.is_empty()
	if is_inside_tree():
		_apply_asset_visual()


func _apply_asset_visual() -> void:
	var has_weapon := WEAPON_TEXTURES.has(weapon_id)
	_weapon_sprite.visible = has_weapon
	_aura_sprite.visible = has_weapon and orbiting
	if not has_weapon:
		return
	_weapon_sprite.texture = WEAPON_TEXTURES[weapon_id]
	_weapon_sprite.position = Vector2.ZERO
	_weapon_sprite.modulate = Color("aeeeff") if orbiting else Color.WHITE
	match weapon_id:
		&"bow":
			_weapon_sprite.rotation = 0.0
			_weapon_sprite.scale = Vector2(0.72, 0.92)
		&"sword":
			_weapon_sprite.rotation = PI * 0.25
			_weapon_sprite.scale = Vector2.ONE * 0.72
		&"axe":
			_weapon_sprite.rotation = PI * 0.18
			_weapon_sprite.scale = Vector2.ONE * 0.72
