class_name CovenWraithEnemy
extends CharacterBody2D

## Shared Chapter 2 enemy controller.  The three Wraith profiles are data-bound
## variants of this actor; Hexwing reuses the combat core but swaps in its
## licensed Flying Demon silhouette.  Keeping the contract here avoids adding
## Chapter 2 conditionals to the Chapter 1 AdvancedDungeonEnemy controller.

signal health_changed(current: int, maximum: int)
signal died(enemy: CovenWraithEnemy)
signal retreated(enemy: CovenWraithEnemy)
signal attack_telegraphed(attack_id: StringName, seconds: float)

enum State { PATROL, CHASE, TELEGRAPH, STRIKE, RECOVER, HURT, RETREAT, DEAD }

const EnemyDifficultyScaler := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export_range(8.0, 480.0, 1.0) var patrol_distance := 72.0

@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var body: Polygon2D = %Body
@onready var veil: Polygon2D = %Veil
@onready var eye_left: Polygon2D = %EyeLeft
@onready var eye_right: Polygon2D = %EyeRight
@onready var demon_sprite: Sprite2D = %DemonSprite
@onready var telegraph_line: Line2D = %TelegraphLine
@onready var telegraph_origin: Polygon2D = %TelegraphOrigin

var max_health := 86
var health := 86
var score_reward := 120
var _movement_speed := 52.0
var _preferred_range := 96.0
var _attack_range := 168.0
var _awareness_range := 250.0
var _telegraph_seconds := 0.52
var _recovery_seconds := 0.70
var _attack_cooldown_seconds := 1.8
var _attack_damage := 12
var _attack_behavior_id: StringName = &"coven_bolt"
var _enemy_id: StringName = &"coven_wraith"
var _state := State.PATROL
var _state_left := 0.0
var _cooldown_left := 0.35
var _spawn_position := Vector2.ZERO
var _patrol_target := Vector2.ZERO
var _facing := Vector2.LEFT
var _locked_direction := Vector2.LEFT
var _target: Node2D
var _strike_applied := false
var _death_left := 0.0
var _retreat_left := 0.0
var _retreat_emitted := false
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
	add_to_group(&"enemy_chapter_2_wraith")
	if _pending_snapshot != null:
		_apply_snapshot(_pending_snapshot)
	health = max_health
	_spawn_position = global_position
	_choose_patrol_target()
	_apply_presentation()
	health_changed.emit(health, max_health)


func _physics_process(delta: float) -> void:
	_visual_elapsed += delta
	_refresh_presentation()
	if _state == State.DEAD:
		_death_left -= delta
		if _death_left <= 0.0:
			queue_free()
		return
	if _state == State.RETREAT:
		_tick_retreat(delta)
		move_and_slide()
		return
	_cooldown_left = maxf(0.0, _cooldown_left - delta)
	_target = get_tree().get_first_node_in_group(&"player") as Node2D
	match _state:
		State.PATROL:
			_tick_patrol(delta)
		State.CHASE:
			_tick_chase(delta)
		State.TELEGRAPH:
			_tick_telegraph(delta)
		State.STRIKE:
			_tick_strike(delta)
		State.RECOVER, State.HURT:
			_tick_recover(delta)
	move_and_slide()


func take_damage(amount: int, source_position := Vector2.ZERO) -> void:
	if amount <= 0 or _state in [State.DEAD, State.RETREAT]:
		return
	var next_health := maxi(0, health - amount)
	var retreat_threshold := get_retreat_threshold_health()
	if retreat_threshold > 0 and health > retreat_threshold and next_health <= retreat_threshold:
		health = retreat_threshold
		health_changed.emit(health, max_health)
		_begin_retreat()
		return
	health = next_health
	health_changed.emit(health, max_health)
	if health <= 0:
		_enter_dead()
		return
	if source_position != Vector2.ZERO:
		velocity = source_position.direction_to(global_position) * 94.0
	_enter_hurt(0.17)


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state in [State.DEAD, State.RETREAT]:
		return
	velocity = velocity.move_toward(Vector2.ZERO, clampf(amount * 2.2, 18.0, 145.0))
	_enter_hurt(clampf(amount * 0.008, 0.10, 0.45))


func get_runtime_snapshot() -> Dictionary:
	return {
		"enemy_id": String(_enemy_id),
		"health": health,
		"max_health": max_health,
		"state": State.keys()[_state].to_lower(),
		"attack_behavior_id": String(_attack_behavior_id),
		"is_hexwing": _enemy_id == &"hexwing_familiar",
		"retreated": _retreat_emitted,
	}


func get_retreat_threshold_health() -> int:
	var config_value: Variant = get_meta(&"level_entity_config", {})
	if not config_value is Dictionary:
		return 0
	var ratio := float((config_value as Dictionary).get("retreat_health_ratio", 0.0))
	if ratio <= 0.0 or ratio >= 1.0:
		return 0
	return ceili(float(max_health) * ratio)


func _apply_snapshot(snapshot: EnemyRuntimeSnapshot) -> void:
	_enemy_id = snapshot.enemy_id
	max_health = maxi(1, roundi(snapshot.max_health))
	health = mini(maxi(0, health), max_health)
	score_reward = maxi(0, snapshot.score_reward)
	_movement_speed = maxf(0.0, snapshot.movement_speed)
	_preferred_range = maxf(0.0, snapshot.preferred_range)
	_attack_range = maxf(18.0, snapshot.attack_range)
	_awareness_range = maxf(_attack_range, snapshot.awareness_range)
	_telegraph_seconds = maxf(0.10, snapshot.telegraph_seconds)
	_recovery_seconds = maxf(0.10, snapshot.recovery_seconds)
	_attack_cooldown_seconds = maxf(0.20, snapshot.attack_cooldown_seconds)
	_attack_damage = maxi(1, roundi(snapshot.attack_damage))
	_attack_behavior_id = snapshot.attack_behavior_id
	if is_node_ready():
		_apply_presentation()
		health_changed.emit(health, max_health)


func _tick_patrol(_delta: float) -> void:
	if _has_target_in_range(_awareness_range):
		_state = State.CHASE
		return
	if global_position.distance_to(_patrol_target) <= 10.0:
		_choose_patrol_target()
	var desired := global_position.direction_to(_patrol_target)
	velocity = desired * _movement_speed * 0.52
	_set_facing(velocity)


func _tick_chase(_delta: float) -> void:
	if not _has_target_in_range(_awareness_range * 1.20):
		_state = State.PATROL
		_choose_patrol_target()
		return
	var offset := _target.global_position - global_position
	var distance := offset.length()
	if _cooldown_left <= 0.0 and distance <= _attack_range:
		_locked_direction = offset.normalized() if not offset.is_zero_approx() else _facing
		_strike_applied = false
		_state = State.TELEGRAPH
		_state_left = _telegraph_seconds
		_show_telegraph()
		attack_telegraphed.emit(_attack_behavior_id, _telegraph_seconds)
		return
	var desired := offset.normalized()
	if _enemy_id == &"hexwing_familiar":
		desired = (desired + desired.orthogonal() * sin(_visual_elapsed * 3.6 + float(get_instance_id())) * 0.42).normalized()
	elif distance < _preferred_range:
		desired = (-desired + desired.orthogonal() * 0.36).normalized()
	velocity = desired * _movement_speed
	_set_facing(offset)


func _tick_telegraph(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 760.0 * delta)
	_state_left -= delta
	if _state_left > 0.0:
		return
	_state = State.STRIKE
	_state_left = 0.24 if _uses_lunge() else 0.08
	_hide_telegraph()
	if not _uses_lunge():
		_apply_attack_once()


func _tick_strike(delta: float) -> void:
	if _uses_lunge():
		velocity = _locked_direction * _movement_speed * (2.45 if _enemy_id != &"hexwing_familiar" else 2.9)
		_apply_attack_once()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, 800.0 * delta)
	_state_left -= delta
	if _state_left > 0.0:
		return
	_state = State.RECOVER
	_state_left = _recovery_seconds
	_cooldown_left = _attack_cooldown_seconds


func _tick_recover(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 720.0 * delta)
	_state_left -= delta
	if _state_left <= 0.0:
		_state = State.CHASE if _has_target_in_range(_awareness_range) else State.PATROL


func _tick_retreat(delta: float) -> void:
	_retreat_left -= delta
	velocity = _facing * _movement_speed * 2.35
	if _retreat_left > 0.32:
		return
	if not _retreat_emitted:
		_retreat_emitted = true
		retreated.emit(self)
		_emit_toast("HEXWING RÚT LUI KHỎI DI VẬT")
	if _retreat_left <= 0.0:
		queue_free()


func _apply_attack_once() -> void:
	if _strike_applied:
		return
	_strike_applied = true
	if not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	var hit_range := 34.0 if _uses_lunge() else _attack_range + 10.0
	if global_position.distance_to(_target.global_position) > hit_range:
		return
	var hit := EnemyDifficultyScaler.apply_authored_damage_hit(
		self,
		_target,
		_attack_damage,
		global_position,
	)
	if not bool(hit.get("confirmed", false)):
		return
	var tint := _attack_color()
	VfxCatalog.spawn(get_parent(), &"world_sparkle", _target.global_position + Vector2(0.0, -8.0), _locked_direction.angle(), 0.86, tint, 12)
	if _attack_behavior_id == &"spirit_leech":
		_emit_toast("HỒN ẢNH RÚT MẠCH LINH KHÍ")


func _emit_toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal(&"toast_requested", message)


func _enter_hurt(duration: float) -> void:
	if _state == State.DEAD:
		return
	_state = State.HURT
	_state_left = maxf(_state_left, duration)
	_hide_telegraph()


func _begin_retreat() -> void:
	_state = State.RETREAT
	_retreat_left = 0.78
	_retreat_emitted = false
	velocity = Vector2.ZERO
	_hide_telegraph()
	body_collision.set_deferred(&"disabled", true)
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position + Vector2(0.0, -11.0), -PI * 0.5, 0.78, _attack_color(), 8)


func _enter_dead() -> void:
	if _state == State.DEAD:
		return
	_state = State.DEAD
	velocity = Vector2.ZERO
	_hide_telegraph()
	body_collision.set_deferred(&"disabled", true)
	var session := get_node_or_null("/root/GameSession")
	if session != null and session.has_method(&"add_score"):
		session.call(&"add_score", score_reward)
	VfxCatalog.spawn(get_parent(), &"smoke_puff", global_position + Vector2(0.0, -12.0), -PI * 0.5, 0.76, _attack_color(), 9)
	died.emit(self)
	_death_left = 0.72


func _has_target_in_range(distance: float) -> bool:
	return is_instance_valid(_target) and _target.get("dead") != true \
		and global_position.distance_to(_target.global_position) <= distance


func _uses_lunge() -> bool:
	return _attack_behavior_id in [&"venom_lunge", &"spirit_leech", &"hexwing_dive"]


func _choose_patrol_target() -> void:
	var seed := float((get_instance_id() * 37 + int(_visual_elapsed * 10.0)) % 360)
	_patrol_target = _spawn_position + Vector2.from_angle(deg_to_rad(seed)) * patrol_distance


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_facing = direction.normalized()
	if is_instance_valid(demon_sprite):
		demon_sprite.flip_h = _facing.x < 0.0


func _apply_presentation() -> void:
	var is_hexwing := _enemy_id == &"hexwing_familiar"
	if is_instance_valid(demon_sprite):
		demon_sprite.visible = is_hexwing
	if is_instance_valid(body):
		body.visible = not is_hexwing
		veil.visible = not is_hexwing
		eye_left.visible = not is_hexwing
		eye_right.visible = not is_hexwing
	var tint := Color("8c6cff")
	if _enemy_id == &"venom_bound_wraith":
		tint = Color("78d77e")
	elif _enemy_id == &"spirit_leech":
		tint = Color("ad5ce7")
	elif is_hexwing:
		tint = Color("d552ef")
	body.color = Color(tint, 0.91)
	veil.color = Color(tint.lightened(0.22), 0.36)
	eye_left.color = Color("f8eaff")
	eye_right.color = Color("f8eaff")


func _refresh_presentation() -> void:
	if not is_instance_valid(body):
		return
	var bob := sin(_visual_elapsed * (4.8 if _enemy_id == &"hexwing_familiar" else 3.2) + float(get_instance_id()))
	body.position.y = -17.0 + bob * 1.7
	veil.position.y = -5.0 + bob * 1.1
	if is_instance_valid(demon_sprite):
		demon_sprite.position.y = -27.0 + bob * 2.2
		demon_sprite.rotation = sin(_visual_elapsed * 3.4) * 0.06


func _show_telegraph() -> void:
	var tint := _attack_color()
	telegraph_line.visible = true
	telegraph_line.points = PackedVector2Array([Vector2(0.0, -8.0), _locked_direction * minf(_attack_range, 174.0) + Vector2(0.0, -8.0)])
	telegraph_line.default_color = Color(tint, 0.80)
	telegraph_origin.visible = true
	telegraph_origin.color = Color(tint, 0.88)


func _hide_telegraph() -> void:
	if is_instance_valid(telegraph_line):
		telegraph_line.visible = false
		telegraph_origin.visible = false


func _attack_color() -> Color:
	if _enemy_id == &"venom_bound_wraith":
		return Color("78e39d")
	if _enemy_id == &"spirit_leech":
		return Color("c17af6")
	if _enemy_id == &"hexwing_familiar":
		return Color("f25bea")
	return Color("8e7bff")
