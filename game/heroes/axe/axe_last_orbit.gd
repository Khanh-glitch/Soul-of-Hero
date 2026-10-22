class_name AxeLastOrbitEffect
extends Node2D

## Axe's departure action after a successful Relay. A real spinning Axe follows
## a curved exit path and can confirm one hit per enemy before returning control
## to the incoming Hero.

const VFX := preload("res://game/vfx/vfx_catalog.gd")
const VFX_FACTORY := preload("res://game/vfx/spritesheet_vfx_factory.gd")
const AXE_SPIN := preload("res://assets/vfx/axe/axe_spin_32x32_8.png")

signal completed()

var _owner_actor: Node2D
var _definition: HeroDefinition
var _origin := Vector2.ZERO
var _destination := Vector2.ZERO
var _elapsed := 0.0
var _finished := false
var _attack_instance_id := 0
var _damage := 1
var _hit_ids: Dictionary = {}
var _axe_sprite: AnimatedSprite2D
var _trail: Line2D


func _ready() -> void:
	top_level = true
	_axe_sprite = AnimatedSprite2D.new()
	_axe_sprite.sprite_frames = VFX_FACTORY.build_grid(AXE_SPIN, Vector2i(32, 32), 8, 18.0, 8)
	_axe_sprite.sprite_frames.set_animation_loop(&"play", true)
	_axe_sprite.modulate = Color(1.0, 0.78, 0.32, 1.0)
	_axe_sprite.play(&"play")
	add_child(_axe_sprite)
	_trail = Line2D.new()
	_trail.top_level = true
	_trail.width = 4.0
	_trail.default_color = Color(1.0, 0.76, 0.30, 0.48)
	_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	add_child(_trail)


func setup(owner_actor: Node2D, definition: HeroDefinition, origin: Vector2, destination: Vector2) -> bool:
	if owner_actor == null or definition == null or definition.hero_id != &"axe_hero":
		queue_free()
		return false
	_owner_actor = owner_actor
	_definition = definition
	_origin = origin
	_destination = destination
	global_position = origin
	_attack_instance_id = int(Time.get_ticks_usec() & 0x7fffffff)
	_damage = _scaled_action_damage(_definition.base_damage * 1.05)
	VFX.spawn(get_parent(), &"world_sparkle", origin, 0.0, 0.62, Color(1.0, 0.70, 0.24, 0.72), 8)
	_emit_cue(&"axe_last_orbit_launch")
	return true


func _process(delta: float) -> void:
	if _finished or _definition == null:
		return
	_elapsed += delta
	var duration := maxf(0.1, _definition.departure_duration_seconds)
	var progress := clampf(_elapsed / duration, 0.0, 1.0)
	var linear := _origin.lerp(_destination, progress)
	var direction := _origin.direction_to(_destination)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var perpendicular := Vector2(-direction.y, direction.x)
	global_position = linear + perpendicular * sin(progress * PI) * 34.0
	if _trail != null:
		_trail.add_point(global_position)
		while _trail.get_point_count() > 14:
			_trail.remove_point(0)
	_confirm_path_hits()
	if progress >= 1.0:
		_finish()


func _confirm_path_hits() -> void:
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not candidate.has_method(&"take_damage"):
			continue
		var enemy := candidate as Node2D
		var instance_id := enemy.get_instance_id()
		if _hit_ids.has(instance_id) or global_position.distance_to(enemy.global_position) > 26.0:
			continue
		_hit_ids[instance_id] = true
		if CombatDamage.apply_confirmed(enemy, _damage, global_position, &"axe_hero", {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"axe_hero",
			"attack_id": &"last_orbit",
			"source_kind": &"departure_skill",
			"cue_id": &"axe_hit",
			"impact_strength": 1.25,
			"hit_stop_seconds": 0.045,
		}):
			CombatDamage.apply_stagger(enemy, 72.0, {"source": &"last_orbit"})
			VFX.spawn(get_parent(), &"axe_cleave", enemy.global_position, _origin.direction_to(_destination).angle(), 0.9, Color(1.0, 0.76, 0.30, 0.82), 9)


func _scaled_action_damage(authored_damage: float) -> int:
	var fallback := maxi(1, roundi(authored_damage))
	if _owner_actor == null or _definition == null:
		return fallback
	if _owner_actor.has_method(&"scale_hero_action_damage"):
		return int(_owner_actor.call(&"scale_hero_action_damage", _definition.hero_id, &"departure_skill", authored_damage))
	if _owner_actor.has_method(&"scale_hero_damage"):
		return int(_owner_actor.call(&"scale_hero_damage", _definition.hero_id, authored_damage))
	return fallback


func _emit_cue(cue_id: StringName) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"axe_hero",
		})


func _finish() -> void:
	if _finished:
		return
	_finished = true
	global_position = _destination
	VFX.spawn(get_parent(), &"echo_impact", _destination, 0.0, 0.88, Color(1.0, 0.76, 0.34, 0.68), 8)
	_emit_cue(&"axe_last_orbit_complete")
	completed.emit()
	queue_free()
