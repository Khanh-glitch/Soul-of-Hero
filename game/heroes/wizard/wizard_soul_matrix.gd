class_name WizardSoulMatrix
extends Node2D

## Legendary+ Wizard Soul. Five existing dark effects orbit the active Hero;
## each pulse visibly resolves before dealing direct, unmitigated HP damage.

const VFX := preload("res://game/vfx/vfx_catalog.gd")

var _owner_actor: Node2D
var _duration := 5.0
var _elapsed := 0.0
var _pulse_left := 0.0
var _pulse_index := 0
var _damage := 1


func setup(owner_actor: Node2D, duration: float, authored_damage: float) -> bool:
	if owner_actor == null or duration <= 0.0:
		queue_free()
		return false
	_owner_actor = owner_actor
	_duration = duration
	_damage = maxi(1, roundi(authored_damage))
	if owner_actor.has_method(&"scale_hero_action_damage"):
		_damage = int(owner_actor.call(
			&"scale_hero_action_damage", &"wizard_hero", &"summon_skill", authored_damage
		))
	return true


func finish_now() -> void:
	queue_free()


func get_takeover_position() -> Vector2:
	return _owner_actor.global_position if is_instance_valid(_owner_actor) else global_position


func _process(delta: float) -> void:
	if not is_instance_valid(_owner_actor):
		queue_free()
		return
	_elapsed += delta
	_pulse_left -= delta
	if _pulse_left <= 0.0:
		_pulse_left = 0.55
		_pulse()
	if _elapsed >= _duration:
		queue_free()


func _pulse() -> void:
	var theta := TAU * float(_pulse_index % 5) / 5.0 + _elapsed * 0.7
	var pulse_position := global_position + Vector2(cos(theta) * 58.0, sin(theta) * 34.0)
	_pulse_index += 1
	VFX.spawn(get_parent(), &"dark_burst", pulse_position, theta, 0.78, Color.TRANSPARENT, 12)
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if pulse_position.distance_to(enemy.global_position) > 52.0:
			continue
		CombatDamage.apply_confirmed(enemy, _damage, pulse_position, &"wizard_hero", {
			"hero_id": &"wizard_hero",
			"source_kind": &"summon_skill",
			"skill_id": &"wizard_soul_matrix",
			"cue_id": &"heavy_impact",
		})
