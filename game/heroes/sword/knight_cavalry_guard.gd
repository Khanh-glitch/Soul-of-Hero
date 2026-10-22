class_name KnightCavalryGuard
extends Node2D

## Binh Đoàn Báo Thù (rarities 5..7). Every confirmed Hand attack launched
## during the five-second Soul window creates one target-seeking rider.

const VFX := preload("res://game/vfx/vfx_catalog.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const RevengeRider := preload("res://game/heroes/sword/k_night_revenge_rider.gd")

var _owner_actor: Node2D
var _duration := KNightRules.REVENGE_DURATION
var _elapsed := 0.0
var _damage_ratio := KNightRules.REVENGE_DAMAGE_RATIOS[0]
var _missing_health_ratio := KNightRules.REVENGE_MISSING_HEALTH_RATIOS[0]
var _legendary_rank := 1
var _riders: Array[Node2D] = []
var _anchors: Array[Node2D] = []


func setup(
		owner_actor: Node2D,
		duration: float,
		_authored_damage: float,
		legendary_rank: int = 1,
) -> bool:
	if owner_actor == null or duration <= 0.0:
		queue_free()
		return false
	_owner_actor = owner_actor
	_duration = duration
	var index := clampi(legendary_rank, 1, 3) - 1
	_legendary_rank = index + 1
	_damage_ratio = KNightRules.REVENGE_DAMAGE_RATIOS[index]
	_missing_health_ratio = KNightRules.REVENGE_MISSING_HEALTH_RATIOS[index]
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"hand_attack_started"):
		events.hand_attack_started.connect(_on_hand_attack_started)
	VFX.spawn(
		owner_actor, &"world_portal", owner_actor.global_position,
		0.0, 1.1, Color(0.16, 0.005, 0.018, 0.9), 11,
	)
	return true


func finish_now() -> void:
	queue_free()


func get_takeover_position() -> Vector2:
	_prune_runtime_nodes()
	var origin := _owner_actor.global_position if is_instance_valid(_owner_actor) else global_position
	var farthest := origin
	var farthest_distance := -1.0
	for candidate: Node2D in _riders + _anchors:
		if not is_instance_valid(candidate) or not _is_on_screen(candidate):
			continue
		var distance := origin.distance_squared_to(candidate.global_position)
		if distance > farthest_distance:
			farthest_distance = distance
			farthest = candidate.global_position
	return farthest


func _process(delta: float) -> void:
	if not is_instance_valid(_owner_actor):
		queue_free()
		return
	_elapsed += maxf(0.0, delta)
	_prune_runtime_nodes()
	if _elapsed >= _duration:
		queue_free()


func _on_hand_attack_started(_weapon_id: StringName, _combo_index: int) -> void:
	if _elapsed >= _duration or not is_instance_valid(_owner_actor):
		return
	var target := _select_revenge_target()
	if target == null:
		return
	var received := float(_owner_actor.call(
		&"get_k_night_damage_from_target", target
	)) if _owner_actor.has_method(&"get_k_night_damage_from_target") else 0.0
	var missing_health := _k_night_missing_health()
	var damage := KNightRules.revenge_damage(
		received, missing_health, _legendary_rank
	)
	var rider := RevengeRider.new() as KNightRevengeRider
	get_parent().add_child(rider)
	if not rider.setup(
		_owner_actor,
		target,
		damage,
		KNightRules.REVENGE_RIDER_STUN_SECONDS,
		_owner_actor.global_position,
	):
		rider.queue_free()
		return
	rider.resolved.connect(_on_rider_resolved)
	_riders.append(rider)


func _select_revenge_target() -> Node2D:
	var candidates: Array[Node2D] = []
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if candidate is Node2D and CombatDamage.is_alive(candidate):
			candidates.append(candidate as Node2D)
	if candidates.is_empty():
		return null
	var current_target: Node2D
	if _owner_actor.has_method(&"get_current_combat_target"):
		current_target = _owner_actor.call(&"get_current_combat_target") as Node2D
	candidates.sort_custom(func(a: Node2D, b: Node2D) -> bool:
		var a_damage := float(_owner_actor.call(
			&"get_k_night_damage_from_target", a
		)) if _owner_actor.has_method(&"get_k_night_damage_from_target") else 0.0
		var b_damage := float(_owner_actor.call(
			&"get_k_night_damage_from_target", b
		)) if _owner_actor.has_method(&"get_k_night_damage_from_target") else 0.0
		if not is_equal_approx(a_damage, b_damage):
			return a_damage > b_damage
		if a == current_target:
			return true
		if b == current_target:
			return false
		return _owner_actor.global_position.distance_squared_to(a.global_position) \
			< _owner_actor.global_position.distance_squared_to(b.global_position)
	)
	return candidates[0]


func _k_night_missing_health() -> float:
	if not _owner_actor.has_method(&"get_hero_health_snapshot"):
		return 0.0
	var snapshot: Dictionary = _owner_actor.call(&"get_hero_health_snapshot")
	if String(snapshot.get("active_hero_id", "")) == "sword_hero":
		return maxf(
			0.0,
			float(snapshot.get("active_maximum", 0.0))
			- float(snapshot.get("active_current", 0.0)),
		)
	if String(snapshot.get("reserve_hero_id", "")) == "sword_hero":
		return maxf(
			0.0,
			float(snapshot.get("reserve_maximum", 0.0))
			- float(snapshot.get("reserve_current", 0.0)),
		)
	return 0.0


func _on_rider_resolved(
		rider: KNightRevengeRider,
		_target: Node,
		_damage: int,
) -> void:
	if not is_instance_valid(rider):
		return
	var anchor := Node2D.new()
	anchor.name = "KNightRevengeTakeoverAnchor"
	anchor.top_level = true
	anchor.global_position = rider.global_position
	get_parent().add_child(anchor)
	_anchors.append(anchor)


func _prune_runtime_nodes() -> void:
	var valid_riders: Array[Node2D] = []
	for rider: Node2D in _riders:
		if is_instance_valid(rider):
			valid_riders.append(rider)
	_riders = valid_riders
	var valid_anchors: Array[Node2D] = []
	for anchor: Node2D in _anchors:
		if is_instance_valid(anchor):
			valid_anchors.append(anchor)
	_anchors = valid_anchors


func _is_on_screen(candidate: Node2D) -> bool:
	if get_viewport() == null:
		return true
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return true
	var size := get_viewport_rect().size / camera.zoom
	var rect := Rect2(camera.get_screen_center_position() - size * 0.5, size)
	return rect.grow(32.0).has_point(candidate.global_position)


func _exit_tree() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"hand_attack_started") \
			and events.hand_attack_started.is_connected(_on_hand_attack_started):
		events.hand_attack_started.disconnect(_on_hand_attack_started)
	for anchor: Node2D in _anchors:
		if is_instance_valid(anchor):
			anchor.queue_free()
