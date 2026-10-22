class_name CombatDamage
extends RefCounted

## Applies damage through the current enemy contract and emits confirmed global
## events only when the target actually accepted the damage.


static func apply_confirmed(
		target: Node,
		amount: int,
		source_position: Vector2,
		weapon_id: StringName,
		context: Dictionary = {}
) -> bool:
	if not is_instance_valid(target) or amount <= 0 or not target.has_method(&"take_damage"):
		return false

	var event_bus := _event_bus(target)
	var health_before := _numeric_property(target, &"health")
	var was_alive := health_before < 0.0 or health_before > 0.0
	var source_hero_id := String(context.get("hero_id", "")).strip_edges().to_lower()
	if not source_hero_id.is_empty():
		target.set_meta(&"last_damage_hero_id", source_hero_id)
	target.call(&"take_damage", amount, source_position)

	if not is_instance_valid(target):
		# A target that cleans itself up synchronously accepted the hit. The current
		# enemy implementation keeps its death animation alive, but this protects
		# future lightweight targets as well.
		var removed_amount := amount
		if health_before > 0.0:
			removed_amount = mini(amount, ceili(health_before))
		_emit_confirmed_feedback(
			event_bus,
			null,
			removed_amount,
			source_position,
			weapon_id,
			context
		)
		if was_alive and event_bus != null and event_bus.has_signal(&"enemy_killed"):
			event_bus.emit_signal(&"enemy_killed", null, weapon_id)
		return true

	var health_after := _numeric_property(target, &"health")
	var damage_was_confirmed := health_before < 0.0 or health_after < health_before
	if not damage_was_confirmed:
		return false

	var actual_amount := amount
	if health_before >= 0.0 and health_after >= 0.0:
		actual_amount = maxi(1, roundi(health_before - health_after))
	if event_bus != null and event_bus.has_signal(&"enemy_damaged"):
		event_bus.emit_signal(&"enemy_damaged", target, actual_amount, weapon_id)
	_emit_confirmed_feedback(
		event_bus,
		target,
		actual_amount,
		source_position,
		weapon_id,
		context
	)
	if was_alive and health_after >= 0.0 and health_after <= 0.0:
		if event_bus != null and event_bus.has_signal(&"enemy_killed"):
			event_bus.emit_signal(&"enemy_killed", target, weapon_id)
	return true


static func is_alive(target: Node) -> bool:
	if not is_instance_valid(target) or target.is_queued_for_deletion():
		return false
	var health := _numeric_property(target, &"health")
	return health < 0.0 or health > 0.0


static func health_ratio(target: Node) -> float:
	var health := _numeric_property(target, &"health")
	var maximum := _numeric_property(target, &"max_health")
	if health < 0.0 or maximum <= 0.0:
		return 1.0
	return clampf(health / maximum, 0.0, 1.0)


## Optional combat contract used by attacks with explicit stagger values. A
## target without stagger support still receives damage normally.
static func apply_stagger(target: Node, amount: float, context: Dictionary = {}) -> bool:
	if not is_instance_valid(target) or amount <= 0.0 or not target.has_method(&"apply_stagger"):
		return false
	target.call(&"apply_stagger", amount, context)
	return true


## Seconds are the authored contract. Enemies with a native control seam receive
## that exact value; legacy enemies retain compatibility through their stagger
## meter at the established 100 stagger per second conversion.
static func apply_stun(target: Node, seconds: float, context: Dictionary = {}) -> bool:
	if not is_instance_valid(target) or seconds <= 0.0:
		return false
	if target.has_method(&"apply_stun"):
		target.call(&"apply_stun", seconds, context)
		return true
	if target.has_method(&"apply_stagger"):
		target.call(&"apply_stagger", seconds * 100.0, context)
		return true
	return false


## K-Night's second hit needs a real one-second movement reduction even for the
## older enemy controllers. Known movement properties are scaled and restored
## with a generation token, so refreshing the slow cannot restore stale values.
static func apply_slow(
		target: Node,
		ratio: float,
		seconds: float,
		context: Dictionary = {},
) -> bool:
	if not is_instance_valid(target) or ratio <= 0.0 or seconds <= 0.0:
		return false
	var clamped_ratio := clampf(ratio, 0.0, 0.95)
	if target.has_method(&"apply_slow"):
		target.call(&"apply_slow", clamped_ratio, seconds, context)
		return true
	var property_names := {}
	for property: Dictionary in target.get_property_list():
		property_names[StringName(property.get("name", &""))] = true
	var originals: Dictionary = target.get_meta(&"k_night_slow_originals", {})
	if originals.is_empty():
		for property_name: StringName in [
			&"movement_speed", &"move_speed", &"patrol_speed", &"chase_speed",
			&"strike_speed",
		]:
			if not property_names.has(property_name):
				continue
			var current: Variant = target.get(property_name)
			if current is int or current is float:
				originals[property_name] = current
				target.set(property_name, float(current) * (1.0 - clamped_ratio))
		if originals.is_empty():
			return false
		target.set_meta(&"k_night_slow_originals", originals)
	var generation := int(target.get_meta(&"k_night_slow_generation", 0)) + 1
	target.set_meta(&"k_night_slow_generation", generation)
	var tree := target.get_tree()
	if tree == null:
		return true
	tree.create_timer(seconds, false).timeout.connect(
		_restore_slow.bind(weakref(target), generation),
		CONNECT_ONE_SHOT,
	)
	return true


static func _restore_slow(target_ref: WeakRef, generation: int) -> void:
	var target := target_ref.get_ref() as Node
	if not is_instance_valid(target) \
			or int(target.get_meta(&"k_night_slow_generation", -1)) != generation:
		return
	var originals: Dictionary = target.get_meta(&"k_night_slow_originals", {})
	for property_name: Variant in originals:
		target.set(StringName(property_name), originals[property_name])
	target.remove_meta(&"k_night_slow_originals")
	target.remove_meta(&"k_night_slow_generation")


static func _numeric_property(target: Object, property_name: StringName) -> float:
	for property: Dictionary in target.get_property_list():
		if StringName(property.get("name", &"")) != property_name:
			continue
		var value: Variant = target.get(property_name)
		if value is int or value is float:
			return float(value)
		break
	return -1.0


static func _event_bus(context: Node) -> Node:
	var tree := context.get_tree()
	if tree == null:
		return null
	return tree.root.get_node_or_null("GameEvents")


static func _emit_confirmed_feedback(
		event_bus: Node,
		target: Node,
		actual_amount: int,
		source_position: Vector2,
		weapon_id: StringName,
		context: Dictionary
) -> void:
	if event_bus == null:
		return
	var presentation := context.duplicate(true)
	var hit_position := source_position
	var requested_hit_position: Variant = presentation.get("hit_position", null)
	if requested_hit_position is Vector2:
		hit_position = requested_hit_position
	elif is_instance_valid(target) and target is Node2D:
		hit_position = (target as Node2D).global_position
	presentation["actual_amount"] = actual_amount
	presentation["source_position"] = source_position
	presentation["weapon_id"] = weapon_id
	if not presentation.has("cue_id"):
		presentation["cue_id"] = &"hit_confirmed"
	if event_bus.has_signal(&"combat_hit_confirmed"):
		event_bus.emit_signal(
			&"combat_hit_confirmed",
			target,
			actual_amount,
			hit_position,
			presentation.duplicate(true)
		)
	if bool(presentation.get("emit_cue", true)) and event_bus.has_signal(&"combat_cue_requested"):
		event_bus.emit_signal(
			&"combat_cue_requested",
			StringName(presentation.get("cue_id", &"hit_confirmed")),
			hit_position,
			presentation.duplicate(true)
		)
