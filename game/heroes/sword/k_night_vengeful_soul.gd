class_name KNightVengefulSoul
extends Node2D

## Oán Hồn: fixed Legendary+ departure. The apparition retargets the visible
## enemy with the least current HP before every 300%-speed strike.

const KnightAnimations := preload("res://game/characters/knight/knight_animation_library.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")

var _owner_actor: Node2D
var _definition: HeroDefinition
var _origin := Vector2.ZERO
var _elapsed := 0.0
var _attack_left := 0.0
var _attack_index := 0
var _phantom: Node2D


func setup(
		owner_actor: Node2D,
		definition: HeroDefinition,
		origin: Vector2,
) -> bool:
	if owner_actor == null or definition == null:
		queue_free()
		return false
	_owner_actor = owner_actor
	_definition = definition
	_origin = origin
	global_position = origin
	top_level = true
	z_index = 15
	_build_phantom()
	VfxCatalog.spawn(
		get_parent(), &"world_portal", origin, 0.0, 0.92,
		Color(0.22, 0.005, 0.018, 0.9), 14,
	)
	return true


func _process(delta: float) -> void:
	if _definition == null:
		queue_free()
		return
	_elapsed += maxf(0.0, delta)
	_attack_left -= delta
	if _attack_left <= 0.0:
		_attack_left += _attack_interval()
		_strike_next_target()
	if _elapsed >= KNightRules.VENGEFUL_SOUL_DURATION:
		VfxCatalog.spawn(
			get_parent(), &"smoke_puff",
			_phantom.global_position if is_instance_valid(_phantom) else _origin,
			0.0, 0.8, Color(0.12, 0.005, 0.015, 0.65), 15,
		)
		queue_free()


func _attack_interval() -> float:
	var baseline := 0.0
	for duration: float in _definition.combo_action_durations:
		baseline += duration
	baseline /= maxf(1.0, float(_definition.combo_action_durations.size()))
	return baseline / KNightRules.VENGEFUL_SOUL_ATTACK_SPEED_MULTIPLIER


func _strike_next_target() -> void:
	var target := _lowest_hp_visible_enemy()
	if target == null:
		if is_instance_valid(_phantom):
			_phantom.visible = false
		return
	_attack_index += 1
	var direction := _origin.direction_to(target.global_position)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	if is_instance_valid(_phantom):
		_phantom.visible = true
		_phantom.global_position = target.global_position - direction * 24.0
		for child: Node in _phantom.get_children():
			if child is AnimatedSprite2D:
				var sprite := child as AnimatedSprite2D
				sprite.flip_h = direction.x < 0.0
				sprite.play(StringName("sword_combo_%d" % (1 + (_attack_index - 1) % 4)))
	var damage := maxi(1, roundi(
		_definition.base_power * KNightRules.VENGEFUL_SOUL_POWER_RATIO
	))
	if _owner_actor.has_method(&"scale_hero_action_damage"):
		damage = int(_owner_actor.call(
			&"scale_hero_action_damage",
			&"sword_hero",
			&"departure_skill",
			float(damage),
		))
	var context := {
		"hero_id": &"sword_hero",
		"source_kind": &"departure_skill",
		"skill_id": &"k_night_vengeful_soul",
		"attack_speed_multiplier": KNightRules.VENGEFUL_SOUL_ATTACK_SPEED_MULTIPLIER,
		"cue_id": &"sword_hit",
		"impact_strength": 1.2,
	}
	if CombatDamage.apply_confirmed(
		target,
		damage,
		_phantom.global_position if is_instance_valid(_phantom) else _origin,
		&"sword_hero",
		context,
	):
		VfxCatalog.spawn(
			get_parent(), &"echo_impact", target.global_position,
			direction.angle(), 0.86,
			Color(0.62, 0.01, 0.025, 0.84), 16,
		)


func _lowest_hp_visible_enemy() -> Node2D:
	var best: Node2D
	var best_health := INF
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if not _is_on_screen(enemy):
			continue
		var current := _numeric_property(enemy, &"health")
		if current >= 0.0 and current < best_health:
			best = enemy
			best_health = current
	return best


func _is_on_screen(candidate: Node2D) -> bool:
	if get_viewport() == null:
		return true
	var camera := get_viewport().get_camera_2d()
	var size := get_viewport_rect().size
	if camera != null:
		size /= camera.zoom
	# The authored screen is centered on the departure point, not on the camera
	# after Relay has potentially moved control elsewhere.
	var rect := Rect2(_origin - size * 0.5, size)
	return rect.has_point(candidate.global_position)


func _numeric_property(target: Object, property_name: StringName) -> float:
	for property: Dictionary in target.get_property_list():
		if StringName(property.get("name", &"")) != property_name:
			continue
		var value: Variant = target.get(property_name)
		return float(value) if value is int or value is float else -1.0
	return -1.0


func _build_phantom() -> void:
	_phantom = Node2D.new()
	_phantom.name = "KNightVengefulSoulPhantom"
	_phantom.top_level = true
	get_parent().add_child(_phantom)
	var frames := KnightAnimations.build()
	for layer: int in 4:
		var sprite := AnimatedSprite2D.new()
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.sprite_frames = frames
		sprite.position = Vector2(-float(layer) * 4.0, -31.0)
		sprite.modulate = (
			Color(0.70, 0.01, 0.02, 0.62)
			if layer % 2 == 0
			else Color(0.01, 0.005, 0.012, 0.70)
		)
		_phantom.add_child(sprite)


func _exit_tree() -> void:
	if is_instance_valid(_phantom):
		_phantom.queue_free()
