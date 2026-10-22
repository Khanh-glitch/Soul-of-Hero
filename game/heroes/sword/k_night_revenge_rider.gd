class_name KNightRevengeRider
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const ATTACK_FRAMES: Array[Texture2D] = [
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_1.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_2.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_3.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_4.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_5.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_6.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_7.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_8.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_9.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_10.png"),
]

signal resolved(rider: KNightRevengeRider, target: Node, damage: int)

var _source: Node2D
var _target: Node2D
var _damage := 0
var _stun_seconds := 0.5
var _speed := 560.0
var _hit := false
var _post_hit_distance := 0.0
var _direction := Vector2.RIGHT
var _trail: Line2D


func setup(
		source: Node2D,
		target: Node2D,
		damage: int,
		stun_seconds: float,
		origin: Vector2,
) -> bool:
	if source == null or target == null or damage < 0:
		queue_free()
		return false
	_source = source
	_target = target
	_damage = damage
	_stun_seconds = maxf(0.0, stun_seconds)
	global_position = origin
	top_level = true
	z_index = 16
	_build_visual()
	return true


func _physics_process(delta: float) -> void:
	if delta <= 0.0:
		return
	if not _hit:
		if not CombatDamage.is_alive(_target):
			queue_free()
			return
		var toward := global_position.direction_to(_target.global_position)
		if not toward.is_zero_approx():
			_direction = _direction.slerp(toward, clampf(delta * 9.0, 0.0, 1.0)).normalized()
		global_position += _direction * _speed * delta
		_update_visual_direction()
		_append_trail()
		if global_position.distance_to(_target.global_position) <= 16.0:
			_confirm_hit()
		return
	global_position += _direction * _speed * delta
	_post_hit_distance += _speed * delta
	_append_trail()
	if _post_hit_distance >= 72.0:
		queue_free()


func _confirm_hit() -> void:
	if _hit or not CombatDamage.is_alive(_target):
		return
	_hit = true
	var context := {
		"hero_id": &"sword_hero",
		"source_kind": &"summon_skill",
		"skill_id": &"k_night_revenge_legion",
		"cue_id": &"combo_finisher",
		"impact_strength": 1.9,
	}
	if _damage > 0:
		CombatDamage.apply_confirmed(
			_target, _damage, global_position - _direction * 12.0,
			&"knight_cavalry", context,
		)
	CombatDamage.apply_stun(_target, _stun_seconds, context)
	VfxCatalog.spawn(
		get_parent(), &"echo_impact", _target.global_position,
		_direction.angle(), 1.12, Color(0.72, 0.015, 0.025, 0.9), 17,
	)
	resolved.emit(self, _target, _damage)


func _build_visual() -> void:
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	frames.add_animation(&"ride")
	frames.set_animation_speed(&"ride", 20.0)
	frames.set_animation_loop(&"ride", true)
	for texture: Texture2D in ATTACK_FRAMES:
		frames.add_frame(&"ride", texture)
	var rider := AnimatedSprite2D.new()
	rider.name = "RevengeRider"
	rider.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	rider.sprite_frames = frames
	rider.animation = &"ride"
	rider.modulate = Color(0.55, 0.015, 0.028, 0.92)
	rider.scale = Vector2.ONE * 1.04
	add_child(rider)
	rider.play()
	_trail = Line2D.new()
	_trail.top_level = true
	_trail.width = 5.0
	_trail.default_color = Color(0.035, 0.005, 0.008, 0.72)
	_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	add_child(_trail)
	_append_trail()


func _update_visual_direction() -> void:
	var rider := get_node_or_null("RevengeRider") as AnimatedSprite2D
	if rider != null:
		rider.flip_h = _direction.x < 0.0
		rider.rotation = _direction.angle() + (PI if rider.flip_h else 0.0)


func _append_trail() -> void:
	if _trail == null:
		return
	_trail.add_point(global_position)
	while _trail.get_point_count() > 12:
		_trail.remove_point(0)
