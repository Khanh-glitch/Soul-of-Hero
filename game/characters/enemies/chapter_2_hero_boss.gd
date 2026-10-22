class_name ChapterTwoHeroBoss
extends CharacterBody2D

## A dedicated hostile controller for the two Chapter 2 hero encounters.
## Axe never dies on Level 15: its threshold clamps at exactly 50% and the
## actor exits without emitting `died`. Wizard is a real final-boss death that
## remains compatible with LootDirector's guaranteed physical Soul pipeline.

signal health_changed(current: int, maximum: int)
signal phase_changed(phase: int, phase_name: String)
signal attack_telegraphed(pattern_id: StringName, seconds: float)
signal retreated(boss: ChapterTwoHeroBoss)
signal died(enemy: ChapterTwoHeroBoss)
signal encounter_reset

enum BossKind { AXE, WIZARD }
enum State { CHASE, TELEGRAPH, STRIKE, RECOVER, RETREAT, DEAD }

const AxeAnimationLibrary := preload("res://game/characters/knight/axe_warrior_animation_library.gd")
const WizardAnimationLibrary := preload("res://game/characters/knight/wizard_animation_library.gd")
const EnemyDifficultyScaler := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export var boss_kind: BossKind = BossKind.AXE

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite
@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var telegraph_line: Line2D = %TelegraphLine
@onready var telegraph_circle: Polygon2D = %TelegraphCircle
@onready var aura: Polygon2D = %Aura

var max_health := 840
var health := 840
var score_reward := 0
var _movement_speed := 72.0
var _preferred_range := 42.0
var _attack_range := 120.0
var _awareness_range := 560.0
var _telegraph_seconds := 0.70
var _recovery_seconds := 0.70
var _attack_cooldown_seconds := 1.70
var _attack_damage := 20
var _enemy_id: StringName = &"axe_soul_boss"
var _state := State.CHASE
var _state_left := 0.0
var _cooldown_left := 0.65
var _phase := 1
var _attack_cycle := 0
var _active_pattern: StringName = &""
var _locked_direction := Vector2.LEFT
var _target: Node2D
var _spawn_position := Vector2.ZERO
var _strike_applied := false
var _retreat_elapsed := 0.0
var _retreat_emitted := false
var _death_elapsed := 0.0
var _visual_elapsed := 0.0
var _pending_snapshot: EnemyRuntimeSnapshot


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or not snapshot.is_valid():
		return false
	_pending_snapshot = snapshot
	_apply_snapshot(snapshot)
	return true


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	add_to_group(&"enemies")
	add_to_group(&"boss_enemies")
	if _pending_snapshot != null:
		_apply_snapshot(_pending_snapshot)
	health = max_health
	_spawn_position = global_position
	_setup_visuals()
	health_changed.emit(health, max_health)
	phase_changed.emit(_phase, get_phase_name())


func _physics_process(delta: float) -> void:
	_visual_elapsed += delta
	_refresh_visuals()
	if _state == State.DEAD:
		_death_elapsed += delta
		if _death_elapsed >= 0.9:
			queue_free()
		return
	if _state == State.RETREAT:
		_tick_retreat(delta)
		move_and_slide()
		return
	_cooldown_left = maxf(0.0, _cooldown_left - delta)
	_target = get_tree().get_first_node_in_group(&"player") as Node2D
	match _state:
		State.CHASE:
			_tick_chase(delta)
		State.TELEGRAPH:
			_tick_telegraph(delta)
		State.STRIKE:
			_tick_strike(delta)
		State.RECOVER:
			_tick_recover(delta)
	move_and_slide()


func take_damage(amount: int, source_position := Vector2.ZERO) -> void:
	if amount <= 0 or _state in [State.DEAD, State.RETREAT]:
		return
	var next_health := maxi(0, health - amount)
	if boss_kind == BossKind.AXE and next_health <= get_retreat_threshold_health():
		health = get_retreat_threshold_health()
		health_changed.emit(health, max_health)
		_begin_retreat()
		return
	health = next_health
	health_changed.emit(health, max_health)
	if health <= 0:
		_enter_dead()
		return
	if boss_kind == BossKind.WIZARD and _phase == 1 and health <= get_phase_two_threshold_health():
		_phase = 2
		phase_changed.emit(_phase, get_phase_name())
		VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -24.0), 0.0, 1.6, Color("a85cff"), 16)
	if source_position != Vector2.ZERO:
		velocity = source_position.direction_to(global_position) * 64.0


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state in [State.DEAD, State.RETREAT, State.TELEGRAPH]:
		return
	velocity = velocity.move_toward(Vector2.ZERO, clampf(amount * 1.8, 12.0, 96.0))
	if _state == State.RECOVER:
		_state_left = minf(1.1, _state_left + clampf(amount * 0.004, 0.02, 0.16))


func reset_encounter() -> void:
	if _state in [State.DEAD, State.RETREAT]:
		return
	global_position = _spawn_position
	health = max_health
	_phase = 1
	_state = State.CHASE
	_state_left = 0.0
	_cooldown_left = 0.65
	_attack_cycle = 0
	_active_pattern = &""
	_strike_applied = false
	velocity = Vector2.ZERO
	_hide_telegraph()
	health_changed.emit(health, max_health)
	phase_changed.emit(_phase, get_phase_name())
	encounter_reset.emit()


func get_phase_name() -> String:
	if boss_kind == BossKind.AXE:
		return "PACTBREAKER"
	return "FOUNDRY HEART" if _phase == 1 else "DARK PASSAGE"


func get_retreat_threshold_health() -> int:
	return ceili(float(max_health) * 0.5)


func get_phase_two_threshold_health() -> int:
	return ceili(float(max_health) * 0.55)


func get_runtime_snapshot() -> Dictionary:
	return {
		"enemy_id": String(_enemy_id),
		"health": health,
		"max_health": max_health,
		"phase": _phase,
		"phase_name": get_phase_name(),
		"state": State.keys()[_state].to_lower(),
		"pattern": String(_active_pattern),
		"retreat_threshold_health": get_retreat_threshold_health() if boss_kind == BossKind.AXE else 0,
		"retreated": _retreat_emitted,
	}


func _apply_snapshot(snapshot: EnemyRuntimeSnapshot) -> void:
	_enemy_id = snapshot.enemy_id
	max_health = maxi(1, roundi(snapshot.max_health))
	health = mini(maxi(0, health), max_health)
	score_reward = maxi(0, snapshot.score_reward)
	_movement_speed = maxf(0.0, snapshot.movement_speed)
	_preferred_range = maxf(0.0, snapshot.preferred_range)
	_attack_range = maxf(24.0, snapshot.attack_range)
	_awareness_range = maxf(_attack_range, snapshot.awareness_range)
	_telegraph_seconds = maxf(0.12, snapshot.telegraph_seconds)
	_recovery_seconds = maxf(0.10, snapshot.recovery_seconds)
	_attack_cooldown_seconds = maxf(0.25, snapshot.attack_cooldown_seconds)
	_attack_damage = maxi(1, roundi(snapshot.attack_damage))


func _setup_visuals() -> void:
	if boss_kind == BossKind.AXE:
		animated_sprite.sprite_frames = AxeAnimationLibrary.build()
		animated_sprite.scale = Vector2.ONE * 0.62
		animated_sprite.position = Vector2(0.0, -42.0)
		aura.color = Color(0.94, 0.26, 0.30, 0.30)
	else:
		animated_sprite.sprite_frames = WizardAnimationLibrary.build()
		animated_sprite.scale = Vector2.ONE * 0.34
		animated_sprite.position = Vector2(0.0, -47.0)
		aura.color = Color(0.49, 0.18, 0.90, 0.34)
	_play(&"idle")


func _tick_chase(_delta: float) -> void:
	if not is_instance_valid(_target) or _target.get("dead") == true:
		velocity = Vector2.ZERO
		_play(&"idle")
		return
	var offset := _target.global_position - global_position
	var distance := offset.length()
	if _cooldown_left <= 0.0 and distance <= _attack_range:
		_locked_direction = offset.normalized() if not offset.is_zero_approx() else Vector2.LEFT
		_active_pattern = _next_pattern()
		_state = State.TELEGRAPH
		_state_left = _pattern_telegraph_seconds()
		_strike_applied = false
		_show_telegraph()
		attack_telegraphed.emit(_active_pattern, _state_left)
		return
	var desired := offset.normalized()
	if boss_kind == BossKind.WIZARD:
		if distance < _preferred_range:
			desired = -desired
		elif distance <= _preferred_range * 1.35:
			desired = desired.orthogonal() * (1.0 if _attack_cycle % 2 == 0 else -1.0)
	velocity = desired.normalized() * _movement_speed * (1.08 if _phase == 2 else 1.0)
	_set_facing(offset)
	_play(&"run")


func _tick_telegraph(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 820.0 * delta)
	_state_left -= delta
	if _state_left > 0.0:
		return
	_state = State.STRIKE
	_state_left = 0.34 if _active_pattern in [&"axe_cleave", &"axe_soul_sever"] else 0.16
	_hide_telegraph()
	_play(&"heavy_attack" if boss_kind == BossKind.AXE else &"wizard_passage")
	if boss_kind == BossKind.WIZARD:
		_apply_attack_once()


func _tick_strike(delta: float) -> void:
	if boss_kind == BossKind.AXE:
		velocity = _locked_direction * _movement_speed * (2.55 if _active_pattern == &"axe_soul_sever" else 1.82)
		_apply_attack_once()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
	_state_left -= delta
	if _state_left > 0.0:
		return
	_state = State.RECOVER
	_state_left = _recovery_seconds * (0.80 if _phase == 2 else 1.0)
	_cooldown_left = _attack_cooldown_seconds * (0.78 if _phase == 2 else 1.0)
	_active_pattern = &""
	_play(&"idle")


func _tick_recover(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 850.0 * delta)
	_state_left -= delta
	if _state_left <= 0.0:
		_state = State.CHASE


func _tick_retreat(delta: float) -> void:
	_retreat_elapsed += delta
	velocity = _locked_direction * _movement_speed * 2.8
	if _retreat_elapsed < 0.45:
		return
	if not _retreat_emitted:
		_retreat_emitted = true
		retreated.emit(self)
		_emit_toast("KẺ PHÁ KHẾ ĐÃ RÚT LUI — MẢNH ẤN BỊ BỎ LẠI")
	if _retreat_elapsed >= 0.82:
		queue_free()


func _emit_toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal(&"toast_requested", message)


func _apply_attack_once() -> void:
	if _strike_applied:
		return
	_strike_applied = true
	if not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	var hit_range := 42.0 if boss_kind == BossKind.AXE else _attack_range + 8.0
	if global_position.distance_to(_target.global_position) > hit_range:
		return
	var damage := _attack_damage
	if boss_kind == BossKind.AXE and _active_pattern == &"axe_soul_sever":
		damage = roundi(float(damage) * 1.28)
	elif boss_kind == BossKind.WIZARD and _phase == 2:
		damage = roundi(float(damage) * 1.16)
	var hit := EnemyDifficultyScaler.apply_authored_damage_hit(self, _target, damage, global_position)
	if bool(hit.get("confirmed", false)):
		VfxCatalog.spawn(get_parent(), &"world_sparkle", _target.global_position + Vector2(0.0, -10.0), _locked_direction.angle(), 1.20, _attack_color(), 14)


func _begin_retreat() -> void:
	_state = State.RETREAT
	_retreat_elapsed = 0.0
	_retreat_emitted = false
	_active_pattern = &"retreat"
	_locked_direction = (_spawn_position - global_position).normalized()
	if _locked_direction.is_zero_approx():
		_locked_direction = Vector2.UP
	velocity = Vector2.ZERO
	body_collision.set_deferred(&"disabled", true)
	_hide_telegraph()
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position + Vector2(0.0, -17.0), -PI * 0.5, 1.15, Color("df4b45"), 11)


func _enter_dead() -> void:
	if _state == State.DEAD:
		return
	_state = State.DEAD
	velocity = Vector2.ZERO
	_active_pattern = &""
	body_collision.set_deferred(&"disabled", true)
	_hide_telegraph()
	_play(&"death")
	var session := get_node_or_null("/root/GameSession")
	if session != null and session.has_method(&"add_score"):
		session.call(&"add_score", score_reward)
	VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -25.0), 0.0, 1.7, _attack_color(), 18)
	died.emit(self)


func _next_pattern() -> StringName:
	var result: StringName
	if boss_kind == BossKind.AXE:
		result = &"axe_soul_sever" if _attack_cycle % 3 == 2 else &"axe_cleave"
	else:
		var patterns: Array[StringName] = [&"wizard_shade_bolt", &"wizard_dark_passage", &"wizard_rune_fan"]
		result = patterns[_attack_cycle % patterns.size()] if _phase == 2 else patterns[_attack_cycle % 2]
	_attack_cycle += 1
	return result


func _pattern_telegraph_seconds() -> float:
	if _active_pattern == &"wizard_dark_passage":
		return _telegraph_seconds * 1.18
	if _active_pattern == &"axe_soul_sever":
		return _telegraph_seconds * 1.12
	return _telegraph_seconds


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	if absf(direction.x) > 0.05:
		animated_sprite.flip_h = direction.x < 0.0


func _show_telegraph() -> void:
	var tint := _attack_color()
	telegraph_line.visible = true
	telegraph_circle.visible = true
	telegraph_line.points = PackedVector2Array([Vector2(0.0, -11.0), _locked_direction * minf(_attack_range, 190.0) + Vector2(0.0, -11.0)])
	telegraph_line.default_color = Color(tint, 0.88)
	telegraph_circle.color = Color(tint, 0.34)
	telegraph_circle.scale = Vector2.ONE * (1.0 if boss_kind == BossKind.AXE else 1.38)


func _hide_telegraph() -> void:
	if is_instance_valid(telegraph_line):
		telegraph_line.hide()
		telegraph_circle.hide()


func _refresh_visuals() -> void:
	if not is_instance_valid(aura):
		return
	var pulse := 1.0 + sin(_visual_elapsed * 4.0) * 0.11
	aura.scale = Vector2.ONE * pulse
	aura.rotation += 0.012 if boss_kind == BossKind.WIZARD else -0.009
	if _state == State.RETREAT:
		animated_sprite.modulate.a = clampf(1.0 - _retreat_elapsed * 0.82, 0.16, 1.0)


func _attack_color() -> Color:
	return Color("e44747") if boss_kind == BossKind.AXE else Color("9e5cff")


func _play(animation_name: StringName) -> void:
	if animated_sprite.sprite_frames != null and animated_sprite.sprite_frames.has_animation(animation_name):
		animated_sprite.play(animation_name)
