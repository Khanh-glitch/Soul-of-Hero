class_name AuthoredSkillZone
extends Node2D

## Asset-backed timed combat zone. This node draws nothing; every readable
## pulse comes from the authored VFX catalog, while damage stays plain HP loss.

const VFX := preload("res://game/vfx/vfx_catalog.gd")

var _owner_actor: Node2D
var _locked_target: Node2D
var _hero_id: StringName = &""
var _skill_id: StringName = &""
var _effect_id: StringName = &"echo_impact"
var _duration := 1.0
var _interval := 0.25
var _radius := 64.0
var _elapsed := 0.0
var _until_pulse := 0.0
var _pulse_index := 0
var _pulse_damages: Array[int] = []
var _follow_owner := false
var _follow_target := false
var _stagger := 0.0
var _boss_stagger := 0.0
var _pull_strength := 0.0


func setup(
		owner_actor: Node2D,
		origin: Vector2,
		hero_id: StringName,
		skill_id: StringName,
		duration: float,
		interval: float,
		total_damage: int,
		radius: float,
		effect_id: StringName,
		follow_owner := false,
		locked_target: Node2D = null,
		stagger := 0.0,
		boss_stagger := 0.0,
		pull_strength := 0.0,
) -> bool:
	if owner_actor == null or duration <= 0.0 or interval <= 0.0 or radius <= 0.0:
		queue_free()
		return false
	_owner_actor = owner_actor
	_locked_target = locked_target
	_hero_id = hero_id
	_skill_id = skill_id
	_effect_id = effect_id
	_duration = duration
	_interval = interval
	_radius = radius
	_follow_owner = follow_owner
	_follow_target = is_instance_valid(locked_target)
	_stagger = maxf(0.0, stagger)
	_boss_stagger = maxf(0.0, boss_stagger)
	_pull_strength = maxf(0.0, pull_strength)
	global_position = origin
	var pulse_count := maxi(1, ceili(duration / interval))
	var base_damage := total_damage / pulse_count
	var remainder := total_damage % pulse_count
	for index: int in pulse_count:
		_pulse_damages.append(base_damage + (1 if index < remainder else 0))
	return true


func _process(delta: float) -> void:
	if not is_instance_valid(_owner_actor):
		queue_free()
		return
	if _follow_target:
		if not is_instance_valid(_locked_target) or not CombatDamage.is_alive(_locked_target):
			queue_free()
			return
		global_position = _locked_target.global_position
	elif _follow_owner:
		global_position = _owner_actor.global_position
	_elapsed += maxf(0.0, delta)
	_until_pulse -= maxf(0.0, delta)
	if _until_pulse <= 0.0 and _pulse_index < _pulse_damages.size():
		_until_pulse += _interval
		_pulse()
	if _elapsed >= _duration or _pulse_index >= _pulse_damages.size():
		queue_free()


func _pulse() -> void:
	var damage := _pulse_damages[_pulse_index]
	_pulse_index += 1
	VFX.spawn(
		get_parent(), _effect_id, global_position, 0.0,
		0.72 + 0.08 * float(_pulse_index), Color.TRANSPARENT, 12,
	)
	var candidates: Array[Node] = []
	if _follow_target and is_instance_valid(_locked_target):
		candidates.append(_locked_target)
	else:
		candidates.assign(get_tree().get_nodes_in_group(&"enemies"))
	for candidate: Node in candidates:
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var enemy := candidate as Node2D
		if global_position.distance_to(enemy.global_position) > _radius:
			continue
		if damage > 0:
			CombatDamage.apply_confirmed(enemy, damage, global_position, _hero_id, {
				"hero_id": _hero_id,
				"source_kind": &"active_skill",
				"skill_id": _skill_id,
				"pulse_index": _pulse_index,
				"cue_id": &"heavy_impact",
			})
		var resolved_stagger := _stagger
		if enemy.is_in_group(&"boss_enemies") or enemy.is_in_group(&"bosses"):
			resolved_stagger = _boss_stagger
		if resolved_stagger > 0.0:
			CombatDamage.apply_stagger(enemy, resolved_stagger, {"skill_id": _skill_id})
		if _pull_strength > 0.0 and enemy is CharacterBody2D:
			var pull_direction := enemy.global_position.direction_to(global_position)
			(enemy as CharacterBody2D).velocity += pull_direction * _pull_strength
