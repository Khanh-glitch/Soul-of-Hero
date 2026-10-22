class_name AxeReaperDropEffect
extends Node2D

## Axe's reserve-Soul summon: a readable overhead drop followed by one
## confirmed area cleave. The effect reuses the existing Axe Warrior animation
## set and canonical combat/VFX services; it introduces no duplicate art.

const AXE_ANIMATIONS := preload("res://game/characters/knight/axe_warrior_animation_library.gd")
const VFX := preload("res://game/vfx/vfx_catalog.gd")

signal completed()

var _owner_actor: Node2D
var _definition: HeroDefinition
var _primary_attacker: Node2D
var _elapsed := 0.0
var _impact_done := false
var _finished := false
var _attack_instance_id := 0
var _ghost: AnimatedSprite2D
var _drop_trail: Line2D


func _ready() -> void:
	_ghost = AnimatedSprite2D.new()
	_ghost.sprite_frames = AXE_ANIMATIONS.build()
	_ghost.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_ghost.scale = Vector2.ONE * 0.68
	_ghost.modulate = Color(1.0, 0.78, 0.34, 0.78)
	_ghost.position = Vector2(0.0, -72.0)
	_ghost.play(&"heavy_attack")
	add_child(_ghost)

	_drop_trail = Line2D.new()
	_drop_trail.width = 5.0
	_drop_trail.default_color = Color(1.0, 0.62, 0.18, 0.42)
	_drop_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_drop_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	_drop_trail.add_point(Vector2(0.0, -72.0))
	_drop_trail.add_point(Vector2.ZERO)
	add_child(_drop_trail)


func setup(owner_actor: Node2D, definition: HeroDefinition, primary_attacker: Node) -> bool:
	if owner_actor == null or definition == null or definition.hero_id != &"axe_hero":
		queue_free()
		return false
	_owner_actor = owner_actor
	_definition = definition
	_primary_attacker = primary_attacker as Node2D
	_attack_instance_id = int(Time.get_ticks_usec() & 0x7fffffff)
	VFX.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -58.0), 0.0, 0.72, Color(1.0, 0.72, 0.24, 0.72), 8)
	_emit_cue(&"axe_reaper_drop_arrive")
	return true


func finish_now() -> void:
	if _finished:
		return
	_confirm_impact()
	_finish()


func _process(delta: float) -> void:
	if _finished or _definition == null:
		return
	_elapsed += delta
	var duration := maxf(0.1, _definition.summon_duration_seconds)
	var drop_seconds := minf(0.38, duration * 0.36)
	var drop_progress := clampf(_elapsed / maxf(0.05, drop_seconds), 0.0, 1.0)
	var eased := 1.0 - pow(1.0 - drop_progress, 3.0)
	if _ghost != null:
		_ghost.position = Vector2(0.0, lerpf(-72.0, 0.0, eased))
		if _elapsed > duration * 0.72:
			_ghost.modulate.a = lerpf(0.78, 0.0, clampf((_elapsed - duration * 0.72) / maxf(0.05, duration * 0.28), 0.0, 1.0))
	if not _impact_done and drop_progress >= 1.0:
		_confirm_impact()
	if _elapsed >= duration:
		_finish()


func _confirm_impact() -> void:
	if _impact_done or _definition == null:
		return
	_impact_done = true
	if _ghost != null:
		_ghost.position = Vector2.ZERO
	var impact_position := global_position
	if is_instance_valid(_primary_attacker) and impact_position.distance_to(_primary_attacker.global_position) <= 78.0:
		impact_position = _primary_attacker.global_position
		global_position = impact_position
	VFX.spawn(get_parent(), &"axe_cleave", impact_position, -PI * 0.5, 1.35, Color(1.0, 0.68, 0.22, 0.9), 12)
	VFX.spawn(get_parent(), &"echo_impact", impact_position, 0.0, 1.1, Color(1.0, 0.84, 0.42, 0.72), 10)
	var damage := _scaled_action_damage(_definition.base_damage * 1.35)
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not candidate.has_method(&"take_damage"):
			continue
		var enemy := candidate as Node2D
		if impact_position.distance_to(enemy.global_position) > 58.0:
			continue
		if CombatDamage.apply_confirmed(enemy, damage, impact_position, &"axe_hero", {
			"attack_instance_id": _attack_instance_id,
			"hero_id": &"axe_hero",
			"attack_id": &"reaper_drop",
			"source_kind": &"summon_skill",
			"cue_id": &"axe_hit",
			"impact_strength": 1.55,
			"hit_stop_seconds": 0.07,
		}):
			CombatDamage.apply_stagger(enemy, 110.0, {"source": &"reaper_drop"})
	_emit_cue(&"axe_reaper_drop_impact")


func _scaled_action_damage(authored_damage: float) -> int:
	var fallback := maxi(1, roundi(authored_damage))
	if _owner_actor == null or _definition == null:
		return fallback
	if _owner_actor.has_method(&"scale_hero_action_damage"):
		return int(_owner_actor.call(&"scale_hero_action_damage", _definition.hero_id, &"summon_skill", authored_damage))
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
	completed.emit()
	queue_free()
