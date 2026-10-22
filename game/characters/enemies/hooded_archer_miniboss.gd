class_name HoodedArcherMiniboss
extends CharacterBody2D

signal health_changed(current: int, maximum: int)
signal poise_changed(current: float, maximum: float, immune: bool)
signal phase_changed(current: int)
signal engaged()
signal died(enemy: HoodedArcherMiniboss)

enum State {
	INTRO,
	SEEK_BAND,
	QUICK_AIM,
	QUICK_FIRE,
	SPLIT_STEP,
	PIERCE_AIM,
	PIERCE_FIRE,
	MARK_AIM,
	MARK_FIRE,
	ESCAPE,
	RECOVER,
	PHASE_SHIFT,
	POISE_BREAK,
	DEAD,
}

const ArcherAnimations := preload("res://game/characters/knight/archer_animation_library.gd")
const ARROW_SCENE: PackedScene = preload("res://game/characters/enemies/archer_enemy_arrow.tscn")
const QUICK_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_quick_vfx.png")
const PIERCE_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_pierce_vfx.png")
const SOUL_MARK_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_soul_mark_vfx.png")
const PHASE_BURST_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_phase_burst_vfx.png")
const DASH_TRAIL_VFX: Texture2D = preload("res://assets/characters/archer/generated/archer_boss_dash_trail_vfx.png")
const DifficultyScaler := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")

const MAX_HEALTH := 360
const MAX_POISE := 50.0
const SCORE_REWARD := 650
const DETECTION_RANGE := 360.0
const DISENGAGE_RANGE := 440.0
const PREFERRED_MIN := 144.0
const PREFERRED_MAX := 220.0
const ATTACK_RANGE := 360.0
const ESCAPE_DISTANCE := 72.0
const DEFAULT_MOVEMENT_SPEED := 72.0
const DISENGAGE_TO_AWARENESS_RATIO := DISENGAGE_RANGE / DETECTION_RANGE
const PREFERRED_HALF_SPAN := (PREFERRED_MAX - PREFERRED_MIN) * 0.5
const INNER_BAND_SPEED_RATIO := 64.0 / DEFAULT_MOVEMENT_SPEED
const SPLIT_STEP_SPEED_RATIO := 150.0 / DEFAULT_MOVEMENT_SPEED
const ESCAPE_SPEED_RATIO := (ESCAPE_DISTANCE / 0.26) / DEFAULT_MOVEMENT_SPEED
const ACTION_DAMAGE_RATIOS := {
	&"quick": 1.0,
	&"pierce": 18.0 / 12.0,
	&"mark": 20.0 / 12.0,
}
const ACTION_RANGE_RATIOS := {
	&"quick": 320.0 / ATTACK_RANGE,
	&"pierce": 360.0 / ATTACK_RANGE,
	&"mark": 380.0 / ATTACK_RANGE,
}
const ACTION_TELEGRAPH_RATIOS := {
	# x = phase 1/2, y = phase 3.
	&"quick": Vector2(1.0, 0.40 / 0.44),
	&"pierce": Vector2(0.72 / 0.44, 0.64 / 0.44),
	&"mark": Vector2(1.00 / 0.44, 0.85 / 0.44),
}
const PHASE_THREE_RECOVERY_RATIO := 0.51 / 0.60

@export_range(8.0, 600.0, 1.0) var patrol_distance := 24.0

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var aim_charge_vfx: Sprite2D = %AimChargeVfx
@onready var soul_mark_vfx: Sprite2D = %SoulMarkVfx
@onready var cast_aura_vfx: Sprite2D = %CastAuraVfx
@onready var dash_trail_vfx: Sprite2D = %DashTrailVfx

var max_health := MAX_HEALTH
var health := MAX_HEALTH
var poise := MAX_POISE
var score_reward := SCORE_REWARD
var _movement_speed := DEFAULT_MOVEMENT_SPEED
var _detection_range := DETECTION_RANGE
var _disengage_range := DISENGAGE_RANGE
var _preferred_min := PREFERRED_MIN
var _preferred_max := PREFERRED_MAX
var _attack_range := ATTACK_RANGE
var _base_telegraph_seconds := 0.44
var _base_recovery_seconds := 0.60
var _base_attack_cooldown_seconds := 0.85
var _base_attack_damage := 12.0

var _state: State = State.INTRO
var _state_time_left := 0.0
var _ability_cooldown_left := 0.0
var _mark_cooldown_left := 0.0
var _escape_cooldown_left := 0.0
var _poise_regen_delay := 0.0
var _poise_break_immunity_left := 0.0
var _target: Node2D
var _priority_target: Node2D
var _locked_direction := Vector2.LEFT
var _facing := Vector2.LEFT
var _split_direction := Vector2.ZERO
var _quick_count := 0
var _phase := 1
var _telegraph_palette := "standard"
var _high_contrast_telegraphs := false
var _death_emitted := false
var _engagement_emitted := false
var _presentation_elapsed := 0.0
var _telegraph_elapsed := 0.0


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	add_to_group(&"enemies")
	add_to_group(&"minibosses")
	add_to_group(&"boss_enemies")
	set_meta(&"is_boss_enemy", true)
	add_to_group(&"enemy_hooded_archer_miniboss")
	set_meta(&"miniboss_id", &"hooded_archer_miniboss")
	animated_sprite.sprite_frames = ArcherAnimations.build_boss()
	animated_sprite.animation_finished.connect(_on_animation_finished)
	aim_charge_vfx.texture = QUICK_VFX
	soul_mark_vfx.texture = SOUL_MARK_VFX
	cast_aura_vfx.texture = PHASE_BURST_VFX
	dash_trail_vfx.texture = DASH_TRAIL_VFX
	_load_accessibility_preferences()
	health = max_health
	poise = MAX_POISE
	_set_facing(_facing)
	_enter_state(State.INTRO)
	health_changed.emit(health, max_health)
	poise_changed.emit(poise, MAX_POISE, false)
	phase_changed.emit(_phase)


func _physics_process(delta: float) -> void:
	_presentation_elapsed += delta
	if _state in [State.QUICK_AIM, State.PIERCE_AIM, State.MARK_AIM]:
		_telegraph_elapsed += delta
	_ability_cooldown_left = maxf(0.0, _ability_cooldown_left - delta)
	_mark_cooldown_left = maxf(0.0, _mark_cooldown_left - delta)
	_escape_cooldown_left = maxf(0.0, _escape_cooldown_left - delta)
	_poise_break_immunity_left = maxf(0.0, _poise_break_immunity_left - delta)
	_update_poise(delta)
	if _state == State.DEAD:
		velocity = velocity.move_toward(Vector2.ZERO, 600.0 * delta)
		_sync_boss_vfx()
		move_and_slide()
		return

	_target = _find_target()
	match _state:
		State.INTRO, State.RECOVER, State.PHASE_SHIFT, State.POISE_BREAK:
			_update_timed_state(delta)
		State.SEEK_BAND:
			_update_seek_band()
		State.QUICK_AIM, State.PIERCE_AIM, State.MARK_AIM:
			_update_aim(delta)
		State.QUICK_FIRE:
			_fire_quick()
		State.PIERCE_FIRE:
			_fire_pierce()
		State.MARK_FIRE:
			_fire_mark()
		State.SPLIT_STEP:
			_update_split_step(delta)
		State.ESCAPE:
			_update_escape(delta)
	_sync_boss_vfx()
	move_and_slide()


func get_archetype_id() -> StringName:
	return &"hooded_archer_miniboss"


func get_display_name() -> String:
	return "KingdomArcher"


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or not snapshot.is_valid():
		return false
	max_health = maxi(1, roundi(snapshot.max_health))
	health = max_health
	score_reward = maxi(0, snapshot.score_reward)
	_movement_speed = maxf(0.0, snapshot.movement_speed)
	_attack_range = maxf(0.0, snapshot.attack_range)
	_detection_range = maxf(_attack_range, snapshot.awareness_range)
	_disengage_range = _detection_range * DISENGAGE_TO_AWARENESS_RATIO
	_preferred_min = maxf(0.0, snapshot.preferred_range - PREFERRED_HALF_SPAN)
	_preferred_max = snapshot.preferred_range + PREFERRED_HALF_SPAN
	_base_telegraph_seconds = maxf(0.0, snapshot.telegraph_seconds)
	_base_recovery_seconds = maxf(0.0, snapshot.recovery_seconds)
	_base_attack_cooldown_seconds = maxf(0.01, snapshot.attack_cooldown_seconds)
	_base_attack_damage = maxf(0.0, snapshot.attack_damage)
	if is_inside_tree():
		health_changed.emit(health, max_health)
	return true


func get_ability_summary() -> String:
	return "KingdomArcher: bow-local charge cues, a punishable reposition and a phase-two Soul Mark."


func get_combat_profile() -> Dictionary:
	return {
		"max_health": max_health,
		"damage": _runtime_damage(get_authored_action_damage(&"quick")),
		"move_speed": _runtime_speed(_movement_speed),
		"detection": _detection_range,
		"disengage": _disengage_range,
		"preferred_min": _preferred_min,
		"preferred_max": _preferred_max,
		"ability_range": _attack_range,
		"telegraph": _quick_telegraph_seconds(),
		"recovery": _base_recovery_seconds,
		"cooldown": _base_attack_cooldown_seconds,
		"poise": MAX_POISE,
		"phase": _phase,
		"score": score_reward,
	}


func get_authored_action_damage(action_id: StringName) -> int:
	if not ACTION_DAMAGE_RATIOS.has(action_id):
		return 0
	return maxi(0, roundi(_base_attack_damage * float(ACTION_DAMAGE_RATIOS[action_id])))


func get_authored_action_range(action_id: StringName) -> float:
	if not ACTION_RANGE_RATIOS.has(action_id):
		return 0.0
	return _attack_range * float(ACTION_RANGE_RATIOS[action_id])


func set_priority_target(target: Node2D) -> void:
	_priority_target = target


func take_damage(amount: int, source_position := Vector2.ZERO) -> bool:
	if amount <= 0 or _state in [State.DEAD, State.PHASE_SHIFT]:
		return false
	_mark_engaged()
	health = maxi(0, health - amount)
	health_changed.emit(health, max_health)
	_flash_hurt()
	if health <= 0:
		_enter_state(State.DEAD)
		return true
	var next_phase := 3 if health <= roundi(max_health * 0.30) else (2 if health <= roundi(max_health * 0.65) else 1)
	if next_phase > _phase:
		_phase = next_phase
		phase_changed.emit(_phase)
		_enter_state(State.PHASE_SHIFT)
	elif source_position != Vector2.ZERO and _state == State.SEEK_BAND:
		var push := source_position.direction_to(global_position)
		velocity += push * 24.0
	return true


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state in [State.DEAD, State.PHASE_SHIFT, State.POISE_BREAK]:
		return
	_poise_regen_delay = 1.0
	if _poise_break_immunity_left > 0.0:
		return
	poise = maxf(0.0, poise - amount * 0.75)
	poise_changed.emit(poise, MAX_POISE, false)
	if poise <= 0.0:
		_enter_state(State.POISE_BREAK)


func get_phase() -> int:
	return _phase


func is_engaged() -> bool:
	return _engagement_emitted


func get_poise_snapshot() -> Dictionary:
	return {"current": poise, "maximum": MAX_POISE, "immune": _poise_break_immunity_left > 0.0}


func _update_seek_band() -> void:
	var tracking_range := _disengage_range if _engagement_emitted else _detection_range
	if not _can_detect_target(tracking_range):
		velocity = velocity.move_toward(Vector2.ZERO, 360.0 * get_physics_process_delta_time())
		animated_sprite.play(&"idle")
		return
	_mark_engaged()
	var offset := _target.global_position - global_position
	var distance := offset.length()
	_set_facing(offset)
	if distance <= 64.0 and _escape_cooldown_left <= 0.0:
		_locked_direction = -offset.normalized()
		if _locked_direction.is_zero_approx():
			_locked_direction = -_facing
		_enter_state(State.ESCAPE)
		return
	if _ability_cooldown_left <= 0.0 and distance <= _attack_range and _has_line_of_sight(_target):
		_quick_count = 0
		if _phase >= 2 and _mark_cooldown_left <= 0.0:
			_enter_state(State.MARK_AIM)
		else:
			_enter_state(State.QUICK_AIM)
		return
	var desired := offset.normalized()
	var movement_speed := _runtime_speed(_movement_speed)
	if distance < _preferred_min:
		desired = -desired + desired.orthogonal() * 0.28
	elif distance <= _preferred_max:
		desired = desired.orthogonal() * (1.0 if get_instance_id() % 2 == 0 else -1.0)
		movement_speed = _runtime_speed(_movement_speed * INNER_BAND_SPEED_RATIO)
	velocity = desired.normalized() * movement_speed
	animated_sprite.play(&"run")


func _update_aim(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
	_state_time_left -= delta
	var lock_window := _aim_lock_window_seconds()
	if is_instance_valid(_target) and _state_time_left > lock_window:
		var tracked := global_position.direction_to(_target.global_position)
		if not tracked.is_zero_approx():
			_locked_direction = tracked
			_set_facing(tracked)
	if _state_time_left > 0.0:
		return
	match _state:
		State.QUICK_AIM:
			_enter_state(State.QUICK_FIRE)
		State.PIERCE_AIM:
			_enter_state(State.PIERCE_FIRE)
		State.MARK_AIM:
			_enter_state(State.MARK_FIRE)


func _fire_quick() -> void:
	_spawn_arrow(
		get_authored_action_damage(&"quick"),
		390.0,
		get_authored_action_range(&"quick"),
		6.0,
	)
	_quick_count += 1
	if _quick_count == 1:
		var side := _locked_direction.orthogonal()
		if is_instance_valid(_target):
			var to_target := global_position.direction_to(_target.global_position)
			if side.dot(to_target) > 0.0:
				side = -side
		_split_direction = side.normalized()
		_enter_state(State.SPLIT_STEP)
	else:
		_enter_state(State.PIERCE_AIM)


func _fire_pierce() -> void:
	_spawn_arrow(
		get_authored_action_damage(&"pierce"),
		520.0,
		get_authored_action_range(&"pierce"),
		10.0,
		&"pierce",
	)
	_enter_state(State.RECOVER)


func _fire_mark() -> void:
	_spawn_arrow(
		get_authored_action_damage(&"mark"),
		600.0,
		get_authored_action_range(&"mark"),
		16.0,
		&"mark",
	)
	_mark_cooldown_left = 5.2 if _phase >= 3 else 6.0
	_enter_state(State.RECOVER)


func _update_split_step(delta: float) -> void:
	_state_time_left -= delta
	velocity = _split_direction * _runtime_speed(_movement_speed * SPLIT_STEP_SPEED_RATIO)
	if _state_time_left <= 0.0 or get_slide_collision_count() > 0:
		velocity = Vector2.ZERO
		_enter_state(State.QUICK_AIM)


func _update_escape(delta: float) -> void:
	_state_time_left -= delta
	if _state_time_left > 0.26:
		velocity = velocity.move_toward(Vector2.ZERO, 800.0 * delta)
	else:
		velocity = _locked_direction * _runtime_speed(_movement_speed * ESCAPE_SPEED_RATIO)
	if _state_time_left <= 0.0 or get_slide_collision_count() > 0:
		velocity = Vector2.ZERO
		_escape_cooldown_left = 4.0
		_enter_state(State.RECOVER)


func _update_timed_state(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 780.0 * delta)
	_state_time_left -= delta
	if _state_time_left > 0.0:
		return
	match _state:
		State.INTRO:
			_enter_state(State.SEEK_BAND)
		State.RECOVER:
			_enter_state(State.SEEK_BAND)
		State.PHASE_SHIFT:
			_enter_state(State.SEEK_BAND)
		State.POISE_BREAK:
			poise = MAX_POISE
			_poise_break_immunity_left = 2.0
			poise_changed.emit(poise, MAX_POISE, true)
			_enter_state(State.SEEK_BAND)


func _enter_state(next_state: State) -> void:
	if _state == State.DEAD and next_state != State.DEAD:
		return
	_state = next_state
	match _state:
		State.INTRO:
			_state_time_left = 0.8
			animated_sprite.play(&"idle")
		State.SEEK_BAND:
			animated_sprite.play(&"run")
		State.QUICK_AIM:
			_state_time_left = _quick_telegraph_seconds()
			_telegraph_elapsed = 0.0
			_snapshot_target_direction()
			_play_windowed_animation(&"archer_quick_shot", _state_time_left)
		State.PIERCE_AIM:
			_state_time_left = _action_telegraph_seconds(&"pierce")
			_telegraph_elapsed = 0.0
			_snapshot_target_direction()
			_play_windowed_animation(&"archer_armor_piercer", _state_time_left)
		State.MARK_AIM:
			_state_time_left = _action_telegraph_seconds(&"mark")
			_telegraph_elapsed = 0.0
			_snapshot_target_direction()
			_play_windowed_animation(&"archer_soul_mark", _state_time_left)
		State.QUICK_FIRE, State.PIERCE_FIRE, State.MARK_FIRE:
			velocity = Vector2.ZERO
		State.SPLIT_STEP:
			_state_time_left = 0.16
			_play_windowed_animation(&"dash", _state_time_left)
		State.ESCAPE:
			_state_time_left = 0.48
			_play_windowed_animation(&"dash", _state_time_left)
		State.RECOVER:
			_state_time_left = _base_recovery_seconds * (PHASE_THREE_RECOVERY_RATIO if _phase >= 3 else 1.0)
			_ability_cooldown_left = _base_attack_cooldown_seconds
			animated_sprite.play(&"idle")
		State.PHASE_SHIFT:
			_state_time_left = 0.65
			velocity = Vector2.ZERO
			_clear_owned_projectiles()
			animated_sprite.play(&"hit")
			_spawn_radial_burst(Color(0.86, 0.62, 1.0, 1.0), 0.72, 0.60)
		State.POISE_BREAK:
			_state_time_left = 0.85
			velocity = Vector2.ZERO
			animated_sprite.play(&"hit")
			_spawn_radial_burst(Color(0.56, 0.94, 1.0, 1.0), 0.58, 0.42)
		State.DEAD:
			velocity = Vector2.ZERO
			body_collision.set_deferred(&"disabled", true)
			_clear_owned_projectiles()
			animated_sprite.play(&"death")
			_spawn_radial_burst(Color(0.72, 0.48, 1.0, 1.0), 0.84, 0.66)


func _quick_telegraph_seconds() -> float:
	return _action_telegraph_seconds(&"quick")


func _action_telegraph_seconds(action_id: StringName) -> float:
	var ratios: Vector2 = ACTION_TELEGRAPH_RATIOS.get(action_id, Vector2.ONE)
	return _base_telegraph_seconds * (ratios.y if _phase >= 3 else ratios.x)


func _play_windowed_animation(animation: StringName, window_seconds: float) -> void:
	if not animated_sprite.sprite_frames.has_animation(animation):
		animated_sprite.play(&"idle")
		return
	var frame_count := animated_sprite.sprite_frames.get_frame_count(animation)
	var authored_fps := animated_sprite.sprite_frames.get_animation_speed(animation)
	var clip_seconds := float(frame_count) / maxf(authored_fps, 0.01)
	# Fit the complete authored motion inside the gameplay window. This keeps the
	# bow release frame, generated streak and real projectile on the same beat.
	var playback_scale := clip_seconds / maxf(window_seconds, 0.01)
	animated_sprite.play(animation, playback_scale)


func _aim_lock_window_seconds() -> float:
	if _state == State.MARK_AIM:
		return 0.45 if _phase >= 3 else 0.55
	return 0.15


func _snapshot_target_direction() -> void:
	if is_instance_valid(_target):
		var direction := global_position.direction_to(_target.global_position)
		if not direction.is_zero_approx():
			_locked_direction = direction
	_set_facing(_locked_direction)


func _spawn_arrow(
	damage: float,
		speed: float,
		distance: float,
		width: float,
		visual_kind: StringName = &"quick",
) -> void:
	if get_parent() == null:
		return
	var arrow := ARROW_SCENE.instantiate() as ArcherEnemyArrow
	if arrow == null:
		return
	get_parent().add_child(arrow)
	arrow.setup(
		self,
		_locked_direction,
		damage,
		_runtime_speed(speed),
		distance,
		width,
		visual_kind,
		DifficultyScaler.INPUT_KIND_AUTHORED,
		&"",
	)
	_spawn_muzzle_streak(PIERCE_VFX if width >= 9.0 else QUICK_VFX, width)


func _sync_boss_vfx() -> void:
	var presents_charge := _state in [State.QUICK_AIM, State.PIERCE_AIM, State.MARK_AIM]
	aim_charge_vfx.visible = presents_charge
	soul_mark_vfx.visible = _state == State.MARK_AIM
	cast_aura_vfx.visible = _state in [State.PIERCE_AIM, State.MARK_AIM]
	dash_trail_vfx.visible = _state in [State.SPLIT_STEP, State.ESCAPE]
	if dash_trail_vfx.visible:
		var dash_direction := _split_direction if _state == State.SPLIT_STEP else _locked_direction
		if dash_direction.is_zero_approx():
			dash_direction = _facing
		dash_trail_vfx.position = Vector2(0.0, -11.0) - dash_direction.normalized() * 5.0
		dash_trail_vfx.rotation = dash_direction.angle() - PI
		dash_trail_vfx.scale = Vector2.ONE * (0.46 if _state == State.SPLIT_STEP else 0.56)
		dash_trail_vfx.modulate = _presentation_tint(0.82)
	if cast_aura_vfx.visible:
		cast_aura_vfx.rotation = -_telegraph_elapsed * 0.34
		var aura_scale := 0.25 if _state == State.PIERCE_AIM else 0.31
		cast_aura_vfx.scale = Vector2.ONE * (aura_scale + sin(_telegraph_elapsed * 8.0) * 0.015)
		cast_aura_vfx.modulate = (
			Color(0.68, 0.46, 1.0, 0.48)
			if _state == State.PIERCE_AIM
			else Color(0.42, 0.88, 1.0, 0.56)
		)
	if not presents_charge:
		return
	var muzzle := Vector2(0.0, -18.0)
	var texture := QUICK_VFX
	var base_scale := 0.16
	if _state == State.PIERCE_AIM:
		texture = PIERCE_VFX
		base_scale = 0.14
	elif _state == State.MARK_AIM:
		texture = PIERCE_VFX
		base_scale = 0.12
	aim_charge_vfx.texture = texture
	aim_charge_vfx.position = muzzle + _locked_direction * 12.0
	aim_charge_vfx.rotation = _locked_direction.angle()
	var charge_pulse := 0.88 + sin(_telegraph_elapsed * 13.0) * 0.08
	aim_charge_vfx.scale = Vector2.ONE * base_scale * charge_pulse
	aim_charge_vfx.modulate = _presentation_tint(0.82 + sin(_telegraph_elapsed * 9.0) * 0.10)
	if soul_mark_vfx.visible:
		soul_mark_vfx.position = (
			to_local(_target.global_position + Vector2(0.0, -34.0))
			if is_instance_valid(_target)
			else muzzle + _locked_direction * 72.0
		)
		soul_mark_vfx.rotation = _telegraph_elapsed * 0.55
		var pulse := 0.22 + sin(_telegraph_elapsed * 8.0) * 0.018
		soul_mark_vfx.scale = Vector2.ONE * pulse
		soul_mark_vfx.modulate = _presentation_tint(0.96)


func _presentation_tint(alpha: float) -> Color:
	if _telegraph_palette == "colorblind":
		return Color(1.0, 0.86, 0.56, alpha)
	if _telegraph_palette == "high_contrast" or _high_contrast_telegraphs:
		return Color(1.0, 1.0, 0.72, alpha)
	return Color(1.0, 1.0, 1.0, alpha)


func _spawn_muzzle_streak(texture: Texture2D, projectile_width: float) -> void:
	if get_parent() == null:
		return
	var streak := Sprite2D.new()
	streak.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	streak.texture = texture
	streak.global_position = global_position + Vector2(0.0, -18.0) + _locked_direction * 9.0
	streak.rotation = _locked_direction.angle()
	var base_scale := 0.24 if projectile_width < 9.0 else 0.22
	streak.scale = Vector2.ONE * base_scale
	streak.modulate = _presentation_tint(0.92)
	streak.z_index = 9
	get_parent().add_child(streak)
	var tween := streak.create_tween().set_parallel(true)
	tween.tween_property(streak, "scale", Vector2.ONE * base_scale * 1.24, 0.16)
	tween.tween_property(streak, "modulate:a", 0.0, 0.16)
	tween.chain().tween_callback(streak.queue_free)


func _spawn_radial_burst(tint: Color, target_scale: float, lifetime: float) -> void:
	if get_parent() == null:
		return
	var burst := Sprite2D.new()
	burst.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	burst.texture = PHASE_BURST_VFX
	burst.global_position = global_position + Vector2(0.0, -18.0)
	burst.scale = Vector2.ONE * 0.18
	burst.modulate = tint
	burst.z_index = 10
	get_parent().add_child(burst)
	var tween := burst.create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(burst, "scale", Vector2.ONE * target_scale, lifetime)
	tween.tween_property(burst, "rotation", 0.34, lifetime)
	tween.tween_property(burst, "modulate:a", 0.0, lifetime)
	tween.chain().tween_callback(burst.queue_free)


func _runtime_damage(authored_damage: int) -> int:
	return DifficultyScaler.scale_direct_damage(self, authored_damage)


func _runtime_speed(authored_speed: float) -> float:
	return authored_speed * float(get_meta(&"enemy_speed_multiplier", 1.0))


func _update_poise(delta: float) -> void:
	if poise >= MAX_POISE or _state in [State.DEAD, State.POISE_BREAK]:
		return
	_poise_regen_delay = maxf(0.0, _poise_regen_delay - delta)
	if _poise_regen_delay <= 0.0:
		var previous := poise
		poise = minf(MAX_POISE, poise + 20.0 * delta)
		if not is_equal_approx(previous, poise):
			poise_changed.emit(poise, MAX_POISE, _poise_break_immunity_left > 0.0)


func _flash_hurt() -> void:
	animated_sprite.self_modulate = Color(1.0, 0.64, 0.78, 1.0)
	var tween := create_tween()
	tween.tween_property(animated_sprite, "self_modulate", Color.WHITE, 0.10)


func _clear_owned_projectiles() -> void:
	for projectile: Node in get_tree().get_nodes_in_group(&"enemy_archer_projectiles"):
		if projectile.has_method(&"get_owner_enemy") and projectile.call(&"get_owner_enemy") == self:
			projectile.queue_free()


func _find_target() -> Node2D:
	if is_instance_valid(_priority_target):
		return _priority_target
	return get_tree().get_first_node_in_group(&"player") as Node2D


func _can_detect_target(maximum_range: float) -> bool:
	return is_instance_valid(_target) and global_position.distance_to(_target.global_position) <= maximum_range and _has_line_of_sight(_target)


func _has_line_of_sight(target: Node2D) -> bool:
	var query := PhysicsRayQueryParameters2D.create(
		global_position + Vector2(0.0, -10.0),
		target.global_position + Vector2(0.0, -8.0),
		1,
		[get_rid()]
	)
	return get_world_2d().direct_space_state.intersect_ray(query).is_empty()


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_facing = direction.normalized()
	if absf(_facing.x) > 0.08:
		animated_sprite.flip_h = _facing.x < 0.0


func _mark_engaged() -> void:
	if _engagement_emitted:
		return
	_engagement_emitted = true
	engaged.emit()


func _load_accessibility_preferences() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return
	var palette_path: Array[String] = ["settings", "telegraph_palette"]
	var contrast_path: Array[String] = ["settings", "high_contrast"]
	_telegraph_palette = String(save_service.call(&"get_value", palette_path, "standard"))
	_high_contrast_telegraphs = bool(save_service.call(&"get_value", contrast_path, false))


func _on_animation_finished() -> void:
	if _state == State.DEAD and animated_sprite.animation == &"death":
		if not _death_emitted:
			_death_emitted = true
			var session := get_node_or_null("/root/GameSession")
			if session != null and session.has_method(&"add_score"):
				session.call(&"add_score", score_reward)
			died.emit(self)
		queue_free()
