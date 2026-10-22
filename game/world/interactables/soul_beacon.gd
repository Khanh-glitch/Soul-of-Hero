class_name SoulBeacon
extends StaticBody2D

signal health_changed(current: int, maximum: int)
signal died(beacon: SoulBeacon)

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export_range(1, 99999, 1) var max_health := 9000

@onready var _sprite: Sprite2D = %BeaconSprite
@onready var _collision: CollisionShape2D = %CollisionShape2D
@onready var _pulse_aura: Sprite2D = %PulseAura
@onready var _health_bar: TextureProgressBar = %HealthBar

var health := 900
var _elapsed := 0.0
var _dead := false


func _ready() -> void:
	add_to_group(&"defense_objective")
	health = max_health
	_health_bar.max_value = max_health
	_refresh_asset_visuals()
	health_changed.emit(health, max_health)


func _process(delta: float) -> void:
	_elapsed += delta
	if is_instance_valid(_sprite):
		_sprite.frame = int(floor(_elapsed * (5.0 if not _dead else 1.5))) % maxi(1, _sprite.hframes)
		_sprite.position.y = -18.0 + sin(_elapsed * 2.4) * (2.0 if not _dead else 0.5)
	_refresh_asset_visuals()


func take_damage(amount: int, source_position: Vector2 = Vector2.ZERO) -> bool:
	if amount <= 0 or _dead:
		return false
	health = maxi(0, health - amount)
	_refresh_asset_visuals()
	health_changed.emit(health, max_health)
	var direction := source_position.direction_to(global_position)
	VfxCatalog.spawn(
		get_parent(),
		&"echo_anchor",
		global_position + Vector2(0.0, -18.0),
		direction.angle(),
		0.58,
		Color(0.72, 0.42, 1.0, 0.66),
		8,
	)
	if health <= 0:
		_die()
	return true


func is_alive() -> bool:
	return not _dead


func get_health_snapshot() -> Dictionary:
	return {
		"current": health,
		"maximum": max_health,
		"ratio": float(health) / float(maxi(1, max_health)),
		"dead": _dead,
	}


func _die() -> void:
	if _dead:
		return
	_dead = true
	_collision.set_deferred(&"disabled", true)
	modulate = Color(0.48, 0.32, 0.55, 0.72)
	VfxCatalog.spawn(
		get_parent(),
		&"echo_anchor",
		global_position + Vector2(0.0, -18.0),
		0.0,
		1.3,
		Color(0.82, 0.36, 1.0, 0.88),
		10,
	)
	died.emit(self)


func _refresh_asset_visuals() -> void:
	var ratio := float(health) / float(maxi(1, max_health))
	var pulse := 0.5 + sin(_elapsed * 3.6) * 0.5
	var core_color := Color(0.66, 0.30, 1.0, 0.72) if not _dead else Color(0.24, 0.12, 0.28, 0.75)
	if is_instance_valid(_pulse_aura):
		_pulse_aura.frame = int(floor(_elapsed * 12.0)) % maxi(1, _pulse_aura.hframes)
		_pulse_aura.scale = Vector2.ONE * (1.25 + pulse * 0.18)
		_pulse_aura.modulate = Color(core_color, 0.24 + pulse * 0.14)
	if is_instance_valid(_health_bar):
		_health_bar.max_value = maxi(1, max_health)
		_health_bar.value = health
		_health_bar.tint_progress = Color(0.84, 0.58, 1.0, 0.94).lerp(Color(0.46, 0.24, 0.54, 0.9), 1.0 - ratio)
