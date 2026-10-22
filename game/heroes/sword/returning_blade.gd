class_name ReturningBladeEffect
extends Node2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

signal completed()

var _owner_actor: Node2D
var _definition: HeroDefinition
var _origin := Vector2.ZERO
var _destination := Vector2.ZERO
var _elapsed := 0.0
var _hit_targets: Dictionary = {}
var _trail: Line2D
var _ghost: AnimatedSprite2D
var _attack_instance_id := 0
var _missing_hp_damage := -1


func setup(
		owner_actor: Node2D,
		definition: HeroDefinition,
		origin: Vector2,
		destination: Vector2,
		missing_hp_damage: int = -1,
) -> void:
	_owner_actor = owner_actor
	_definition = definition
	_origin = origin
	_destination = destination
	_missing_hp_damage = missing_hp_damage
	global_position = origin
	_attack_instance_id = int(Time.get_ticks_usec() & 0x7fffffff)
	_create_visuals()
	_emit_cue(&"returning_blade_launch")


func _process(delta: float) -> void:
	if _definition == null:
		queue_free()
		return
	_elapsed += delta
	var duration := maxf(0.1, _definition.departure_duration_seconds)
	var progress := clampf(_elapsed / duration, 0.0, 1.0)
	var eased := 1.0 - pow(1.0 - progress, 2.0)
	var desired := _origin.lerp(_destination, eased)
	global_position = _safe_position(desired)
	_trail.add_point(global_position)
	while _trail.get_point_count() > 12:
		_trail.remove_point(0)
	_confirm_path_hits()
	if progress >= 1.0:
		VfxCatalog.spawn(get_parent(), &"echo_impact", global_position, _origin.direction_to(_destination).angle(), 1.25, Color(1.0, 0.98, 0.90, 0.82), 10)
		_emit_cue(&"returning_blade_arrive")
		completed.emit()
		queue_free()


func _create_visuals() -> void:
	_trail = Line2D.new()
	_trail.top_level = true
	_trail.width = 4.0
	_trail.default_color = Color(1.0, 0.98, 0.90, 0.54)
	_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	add_child(_trail)
	var source := _owner_actor.get_node_or_null("Sprite") as AnimatedSprite2D
	if source != null:
		_ghost = AnimatedSprite2D.new()
		_ghost.sprite_frames = source.sprite_frames
		_ghost.position = Vector2(0, -31)
		_ghost.modulate = Color(1.0, 0.98, 0.90, 0.50)
		_ghost.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		_ghost.play(&"attack")
		add_child(_ghost)


func _confirm_path_hits() -> void:
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not candidate.has_method(&"take_damage"):
			continue
		var enemy := candidate as Node2D
		var instance_id := enemy.get_instance_id()
		if _hit_targets.has(instance_id) or global_position.distance_to(enemy.global_position) > 25.0:
			continue
		_hit_targets[instance_id] = true
		var damage := (
			maxi(0, _missing_hp_damage)
			if _missing_hp_damage >= 0
			else _scaled_hero_damage(_definition.base_damage * 0.9)
		)
		CombatDamage.apply_confirmed(enemy, damage, global_position, &"sword_hero", {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"sword_hero",
			"attack_id": &"k_night_final_breath",
			"cue_id": &"sword_hit",
			"impact_strength": 1.25,
			"hit_stop_seconds": 0.055,
		})


func _scaled_hero_damage(authored_damage: float) -> int:
	var fallback := maxi(1, roundi(authored_damage))
	if _owner_actor != null and _definition != null and _owner_actor.has_method(&"scale_hero_action_damage"):
		return int(_owner_actor.call(
			&"scale_hero_action_damage",
			_definition.hero_id,
			&"departure_skill",
			authored_damage
		))
	if _owner_actor != null and _definition != null and _owner_actor.has_method(&"scale_hero_damage"):
		return int(_owner_actor.call(&"scale_hero_damage", _definition.hero_id, authored_damage))
	return fallback


func _safe_position(desired: Vector2) -> Vector2:
	var query := PhysicsRayQueryParameters2D.create(global_position, desired, 1)
	query.exclude = [_owner_actor.get_rid()] if _owner_actor is CollisionObject2D else []
	var hit := get_world_2d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return desired
	return (hit.position as Vector2) - global_position.direction_to(desired) * 3.0


func _emit_cue(cue_id: StringName) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"sword_hero",
		})
