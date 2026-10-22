class_name FlyingSwordEffect
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

signal slash_confirmed(target: Node, damage: int)
signal returned_to_owner()
signal completed(hit_count: int)

enum TravelState {
	OUTBOUND,
	PASS_THROUGH,
	RETURNING,
	FINISHED,
}

@export_range(1.0, 1600.0, 1.0) var outbound_speed := 400.0
@export_range(1.0, 1600.0, 1.0) var return_speed := 480.0
@export_range(0.0, 128.0, 1.0) var overshoot_distance := 30.0
@export_range(1.0, 32.0, 1.0) var return_snap_distance := 7.0
@export_range(0.5, 10.0, 0.1) var maximum_lifetime := 4.0
@export var blade_color := Color(0.75, 0.92, 1.0, 1.0)

var _source: WeakRef
var _target: WeakRef
var _start_position := Vector2.ZERO
var _last_target_position := Vector2.ZERO
var _last_owner_position := Vector2.ZERO
var _orbit_offset := Vector2(20.0, -18.0)
var _damage := 0
var _weapon_id: StringName = &"sword"
var _state := TravelState.OUTBOUND
var _configured := false
var _damage_attempted := false
var _hit_count := 0
var _pass_endpoint := Vector2.ZERO
var _lifetime_remaining := 0.0
var _travel_direction := Vector2.RIGHT
var _visual_elapsed := 0.0

@onready var _trail_sprite: Sprite2D = %TrailSprite
@onready var _blade_sprite: Sprite2D = %BladeSprite


func _ready() -> void:
	top_level = true
	if _configured:
		global_position = _start_position
	_sync_asset_visuals(0.0)


## The effect captures weak references and owns its complete outbound/return
## lifecycle. It does not subscribe to weapon-role changes, so a confirmed
## Flying Sword keeps running after a Hand/Spirit swap.
func setup(
		source: Node2D,
		target: Node2D,
		start_position: Vector2,
		damage_amount: int,
		source_weapon_id: StringName = &"sword",
		spirit_orbit_offset: Vector2 = Vector2(20.0, -18.0),
		custom_outbound_speed: float = -1.0,
		custom_return_speed: float = -1.0
) -> void:
	_source = weakref(source)
	_target = weakref(target)
	_start_position = start_position
	_last_target_position = target.global_position
	_last_owner_position = source.to_global(spirit_orbit_offset)
	_orbit_offset = spirit_orbit_offset
	_damage = maxi(0, damage_amount)
	_weapon_id = source_weapon_id
	if custom_outbound_speed > 0.0:
		outbound_speed = custom_outbound_speed
	if custom_return_speed > 0.0:
		return_speed = custom_return_speed
	_state = TravelState.OUTBOUND
	_lifetime_remaining = maximum_lifetime
	_configured = true
	if is_inside_tree():
		global_position = start_position
		_sync_asset_visuals(0.0)


func _physics_process(delta: float) -> void:
	if not _configured or _state == TravelState.FINISHED:
		return
	_lifetime_remaining -= delta
	if _lifetime_remaining <= 0.0:
		_finish()
		return

	match _state:
		TravelState.OUTBOUND:
			_update_outbound(delta)
		TravelState.PASS_THROUGH:
			if _move_toward(_pass_endpoint, outbound_speed, delta):
				_state = TravelState.RETURNING
		TravelState.RETURNING:
			_update_return(delta)
	_sync_asset_visuals(delta)


func _update_outbound(delta: float) -> void:
	var target := _target.get_ref() as Node2D if _target != null else null
	if target != null and CombatDamage.is_alive(target):
		_last_target_position = target.global_position
	if not _move_toward(_last_target_position, outbound_speed, delta):
		return
	_attempt_damage(target)
	var pass_direction := _travel_direction
	if pass_direction.is_zero_approx():
		pass_direction = Vector2.RIGHT
	_pass_endpoint = _last_target_position + pass_direction.normalized() * overshoot_distance
	_state = TravelState.PASS_THROUGH if overshoot_distance > 0.0 else TravelState.RETURNING


func _update_return(delta: float) -> void:
	var source := _source.get_ref() as Node2D if _source != null else null
	if source != null:
		_last_owner_position = source.to_global(_orbit_offset)
	if global_position.distance_to(_last_owner_position) <= return_snap_distance:
		global_position = _last_owner_position
		returned_to_owner.emit()
		_finish()
		return
	_move_toward(_last_owner_position, return_speed, delta)


func _move_toward(destination: Vector2, movement_speed: float, delta: float) -> bool:
	var offset := destination - global_position
	var step := movement_speed * delta
	if offset.length() <= step:
		if not offset.is_zero_approx():
			_travel_direction = offset.normalized()
		global_position = destination
		rotation = _travel_direction.angle()
		return true
	_travel_direction = offset.normalized()
	global_position += _travel_direction * step
	rotation = _travel_direction.angle()
	return false


func _attempt_damage(target: Node2D) -> void:
	if _damage_attempted:
		return
	_damage_attempted = true
	if target != null and CombatDamage.apply_confirmed(target, _damage, global_position, _weapon_id, {
		"hero_id": &"sword_hero",
		"source_kind": &"projectile",
	}):
		_hit_count = 1
		VfxCatalog.spawn(get_parent(), &"blade_impact", global_position, rotation, 0.78, blade_color, 10)
		slash_confirmed.emit(target, _damage)


func _finish() -> void:
	if _state == TravelState.FINISHED:
		return
	_state = TravelState.FINISHED
	_configured = false
	completed.emit(_hit_count)
	queue_free()


func _sync_asset_visuals(delta: float) -> void:
	if not is_instance_valid(_trail_sprite) or not is_instance_valid(_blade_sprite):
		return
	var active := _configured and _state != TravelState.FINISHED
	_trail_sprite.visible = active
	_blade_sprite.visible = active
	if not active:
		return
	_visual_elapsed += delta
	_trail_sprite.frame = int(_visual_elapsed * 24.0) % maxi(1, _trail_sprite.hframes)
	_trail_sprite.modulate = Color(blade_color, 0.46)
	_blade_sprite.modulate = blade_color
	_blade_sprite.scale = Vector2.ONE * (0.72 + sin(_visual_elapsed * 12.0) * 0.035)
