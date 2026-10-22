class_name SoulInterceptionEffect
extends Node2D

## Hộ Vệ Linh Tử (rarities 0..4). Each visual phantom owns one target, pushes
## it through world collision, performs K-Night's complete four-hit combo, then
## remains as a dim takeover anchor until the Soul action ends.

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const KnightAnimations := preload("res://game/characters/knight/knight_animation_library.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")

signal completed()

var _owner_actor: Node2D
var _definition: HeroDefinition
var _primary_attacker: Node2D
var _rarity := 0
var _phantom_count := 1
var _elapsed := 0.0
var _next_release := 0.0
var _released := 0
var _ended := false
var _attack_serial := 0
var _claimed_targets: Dictionary = {}
var _anchors: Array[Node2D] = []


func setup(
		owner_actor: Node2D,
		definition: HeroDefinition,
		primary_attacker: Node,
		rarity: int = 0,
) -> void:
	_owner_actor = owner_actor
	_definition = definition
	_primary_attacker = primary_attacker as Node2D
	_rarity = clampi(rarity, 0, 4)
	_phantom_count = KNightRules.SOUL_GUARDIAN_PHANTOM_COUNTS[_rarity]
	_attack_serial = int(Time.get_ticks_usec() & 0x7fffffff)
	VfxCatalog.spawn(
		get_parent(), &"world_portal", global_position + Vector2(0.0, -8.0),
		0.0, 0.88, Color(0.20, 0.01, 0.025, 0.88), 9,
	)
	_emit_cue(&"soul_interception_arrive")


func finish_now() -> void:
	_end()


func get_takeover_position() -> Vector2:
	_prune_anchors()
	return _anchors[0].global_position if not _anchors.is_empty() else global_position


func get_phantom_count() -> int:
	return _phantom_count


func _process(delta: float) -> void:
	if _ended or _definition == null:
		return
	_elapsed += maxf(0.0, delta)
	while _released < _phantom_count and _elapsed + 0.0001 >= _next_release:
		_launch_phantom(_released)
		_released += 1
		_next_release += KNightRules.SOUL_GUARDIAN_RELEASE_INTERVAL
	if _elapsed >= KNightRules.SOUL_GUARDIAN_DURATION:
		_end()


func _launch_phantom(index: int) -> void:
	var target := _select_target()
	if target != null:
		_claimed_targets[target.get_instance_id()] = true
	var phantom := _create_layered_phantom(index)
	phantom.global_position = global_position
	_anchors.append(phantom)
	_run_phantom(phantom, target, index)


func _create_layered_phantom(index: int) -> Node2D:
	var anchor := Node2D.new()
	anchor.name = "KNightGuardianPhantom%02d" % (index + 1)
	anchor.top_level = true
	anchor.z_index = 12 + index
	get_parent().add_child(anchor)
	var frames := KnightAnimations.build()
	for layer: int in 5:
		var ghost := AnimatedSprite2D.new()
		ghost.name = "ResidualLayer%02d" % (layer + 1)
		ghost.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		ghost.sprite_frames = frames
		ghost.position = Vector2(-float(layer) * 3.0, -31.0)
		ghost.modulate = (
			Color(0.72, 0.015, 0.025, 0.34 + float(layer) * 0.055)
			if layer % 2 == 0
			else Color(0.012, 0.008, 0.016, 0.42 + float(layer) * 0.05)
		)
		ghost.animation = &"sword_combo_1"
		ghost.frame = mini(layer, frames.get_frame_count(&"sword_combo_1") - 1)
		ghost.play(&"sword_combo_1")
		anchor.add_child(ghost)
	return anchor


func _run_phantom(phantom: Node2D, target: Node2D, index: int) -> void:
	if not is_instance_valid(phantom):
		return
	if target == null or not CombatDamage.is_alive(target):
		var fallback := Vector2.RIGHT.rotated(TAU * float(index) / float(maxi(1, _phantom_count)))
		phantom.global_position += fallback * _push_distance() * 0.45
		_dim_anchor(phantom)
		return
	var direction := phantom.global_position.direction_to(target.global_position)
	if direction.is_zero_approx():
		direction = Vector2.RIGHT
	var endpoint := _wall_limited_endpoint(
		target,
		target.global_position + direction * _push_distance(),
	)
	await _push_target_with_phantom(phantom, target, endpoint, 0.34)
	if not is_instance_valid(phantom) or not CombatDamage.is_alive(target):
		_dim_anchor(phantom)
		return
	await _perform_full_combo(phantom, target)
	_dim_anchor(phantom)


func _push_target_with_phantom(
		phantom: Node2D,
		target: Node2D,
		endpoint: Vector2,
		duration: float,
) -> void:
	var start := target.global_position
	var elapsed := 0.0
	while elapsed < duration and is_instance_valid(phantom) and CombatDamage.is_alive(target):
		await get_tree().physics_frame
		var delta := get_physics_process_delta_time()
		elapsed = minf(duration, elapsed + delta)
		var desired := start.lerp(endpoint, elapsed / maxf(0.01, duration))
		var motion := desired - target.global_position
		var blocked := false
		if target is CharacterBody2D:
			blocked = (target as CharacterBody2D).move_and_collide(motion) != null
		else:
			target.global_position = desired
		phantom.global_position = target.global_position - phantom.global_position.direction_to(
			target.global_position
		) * 18.0
		if blocked:
			break


func _perform_full_combo(phantom: Node2D, target: Node2D) -> void:
	for step: int in range(1, 5):
		if not is_instance_valid(phantom) or not CombatDamage.is_alive(target):
			return
		var animation := StringName("sword_combo_%d" % step)
		for child: Node in phantom.get_children():
			if child is AnimatedSprite2D:
				var ghost := child as AnimatedSprite2D
				if ghost.sprite_frames.has_animation(animation):
					ghost.play(animation)
		await get_tree().create_timer(0.11, false).timeout
		if not CombatDamage.is_alive(target):
			return
		var authored: float = _definition.base_power * float(
			KNightRules.COMBO_DAMAGE_RATIOS[step - 1]
		)
		var damage: int = _scaled_hero_damage(authored)
		if step == 4:
			damage = KNightRules.execution_damage(
				damage,
				_numeric_property(target, &"health"),
				_numeric_property(target, &"max_health"),
			)
		var context := {
			"attack_instance_id": _attack_serial,
			"hero_id": &"sword_hero",
			"source_kind": &"summon_skill",
			"attack_id": &"k_night_soul_guardian_combo",
			"combo_step": step,
			"cue_id": &"combo_finisher" if step == 4 else &"sword_hit",
			"impact_strength": 1.8 if step == 4 else 1.0,
		}
		if CombatDamage.apply_confirmed(
			target, damage, phantom.global_position, &"sword_hero", context
		):
			if step == 2:
				CombatDamage.apply_slow(
					target,
					KNightRules.COMBO_TWO_SLOW_RATIO,
					KNightRules.COMBO_TWO_SLOW_SECONDS,
					context,
				)
			VfxCatalog.spawn(
				get_parent(), &"echo_impact", target.global_position,
				phantom.global_position.direction_to(target.global_position).angle(),
				0.82 + float(step) * 0.08,
				Color(0.62, 0.015, 0.025, 0.78), 14,
			)


func _select_target() -> Node2D:
	var candidates: Array[Node2D] = []
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		if _claimed_targets.has(candidate.get_instance_id()):
			continue
		candidates.append(candidate as Node2D)
	if candidates.is_empty():
		# More phantoms than enemies: concentrating remaining phantoms is better
		# than discarding a rarity reward.
		for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
			if candidate is Node2D and CombatDamage.is_alive(candidate):
				candidates.append(candidate as Node2D)
	if candidates.is_empty():
		return null
	candidates.sort_custom(func(a: Node2D, b: Node2D) -> bool:
		var a_threat := _is_about_to_deal_damage(a)
		var b_threat := _is_about_to_deal_damage(b)
		if a_threat != b_threat:
			return a_threat
		var a_distance := global_position.distance_squared_to(a.global_position)
		var b_distance := global_position.distance_squared_to(b.global_position)
		if not is_equal_approx(a_distance, b_distance):
			return a_distance < b_distance
		return _numeric_property(a, &"health") > _numeric_property(b, &"health")
	)
	if is_instance_valid(_primary_attacker) and candidates.has(_primary_attacker) \
			and _is_about_to_deal_damage(_primary_attacker):
		return _primary_attacker
	return candidates[0]


func _is_about_to_deal_damage(enemy: Node2D) -> bool:
	if bool(enemy.get_meta(&"attack_windup_active", false)) \
			or bool(enemy.get_meta(&"imminent_damage", false)):
		return true
	var action_value: Variant = _property_value(enemy, &"current_action")
	return action_value != null and (
		String(action_value).contains("attack")
		or String(action_value).contains("strike")
		or String(action_value).contains("cast")
	)


func _push_distance() -> float:
	if get_viewport() == null:
		return 220.0
	var size := get_viewport_rect().size
	var camera := get_viewport().get_camera_2d()
	if camera != null:
		size /= Vector2(maxf(0.01, camera.zoom.x), maxf(0.01, camera.zoom.y))
	return size.x * KNightRules.SOUL_GUARDIAN_PUSH_VIEW_RATIO


func _wall_limited_endpoint(target: Node2D, desired: Vector2) -> Vector2:
	var query := PhysicsRayQueryParameters2D.create(
		target.global_position,
		desired,
		1,
		[target.get_rid()] if target is CollisionObject2D else [],
	)
	var hit := get_world_2d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return desired
	var direction := target.global_position.direction_to(desired)
	return (hit.position as Vector2) - direction * 5.0


func _dim_anchor(phantom: Node2D) -> void:
	if not is_instance_valid(phantom):
		return
	var tween := phantom.create_tween()
	tween.tween_property(phantom, "modulate:a", 0.28, 0.20)


func _prune_anchors() -> void:
	var valid: Array[Node2D] = []
	for anchor: Node2D in _anchors:
		if is_instance_valid(anchor):
			valid.append(anchor)
	_anchors = valid


func _scaled_hero_damage(authored_damage: float) -> int:
	if _owner_actor != null and _definition != null \
			and _owner_actor.has_method(&"scale_hero_action_damage"):
		return int(_owner_actor.call(
			&"scale_hero_action_damage",
			_definition.hero_id,
			&"normal_attack",
			authored_damage,
		))
	return maxi(1, roundi(authored_damage))


func _numeric_property(target: Object, property_name: StringName) -> float:
	var value: Variant = _property_value(target, property_name)
	return float(value) if value is int or value is float else -1.0


func _property_value(target: Object, property_name: StringName) -> Variant:
	for property: Dictionary in target.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return target.get(property_name)
	return null


func _emit_cue(cue_id: StringName) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, {
			"attack_instance_id": _attack_serial,
			"hero_id": &"sword_hero",
		})


func _end() -> void:
	if _ended:
		return
	_ended = true
	for anchor: Node2D in _anchors:
		if is_instance_valid(anchor):
			anchor.queue_free()
	_anchors.clear()
	completed.emit()
	queue_free()
