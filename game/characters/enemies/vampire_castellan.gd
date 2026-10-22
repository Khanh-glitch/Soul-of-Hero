class_name VampireCastellan
extends CharacterBody2D

signal health_changed(current: int, maximum: int)
signal phase_changed(phase: int, phase_name: String)
signal attack_telegraphed(pattern_id: StringName, seconds: float)
signal encounter_reset
signal died(enemy: Node)

enum State {
	CHASE,
	TELEGRAPH,
	STRIKE,
	RECOVER,
	PHASE_TRANSITION,
	DEAD,
}

const DISPLAY_NAME := "VAMPIRE CASTELLAN"
const RUNTIME_ENEMY_ID := &"vampire_castellan"
const FRAME_SIZE := Vector2i(32, 32)
const PHASE_TWO_RATIO := 0.55
const SPECTRAL_DISC_SCENE: PackedScene = preload("res://game/characters/enemies/spectral_disc.tscn")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const EnemyDifficultyScalerScript := preload("res://game/characters/enemies/enemy_difficulty_scaler.gd")
const BLINK_ARENA_BOUNDS := Rect2(Vector2(432.0, 256.0), Vector2(736.0, 448.0))
const BLINK_LATERAL_OFFSET := 76.0
const BLINK_VERTICAL_OFFSET := 54.0
const BLINK_CARDINAL_OFFSET := 88.0
const DEFAULT_MOVEMENT_SPEED := 58.0
const DEFAULT_PREFERRED_RANGE := 82.0
const DEFAULT_ATTACK_RANGE := 270.0
const DEFAULT_TELEGRAPH_SECONDS := 0.72
const DEFAULT_RECOVERY_SECONDS := 0.62
const DEFAULT_ATTACK_DAMAGE := 14.0
const PHASE_TWO_MOVEMENT_RATIO := 66.0 / DEFAULT_MOVEMENT_SPEED
const PHASE_TWO_PREFERRED_RANGE_RATIO := 112.0 / DEFAULT_PREFERRED_RANGE
const PHASE_TWO_COOLDOWN_RATIO := 1.30 / 1.55
const PHASE_TWO_RECOVERY_RATIO := 0.54 / DEFAULT_RECOVERY_SECONDS
const INITIAL_COOLDOWN_RATIO := 0.85 / 1.55
const DISC_TRAVEL_RANGE_RATIO := 230.0 / DEFAULT_ATTACK_RANGE
const ACTION_DAMAGE_RATIOS := {
	&"blood_lunge_phase_one": 1.0,
	&"blood_lunge_phase_two": 16.0 / DEFAULT_ATTACK_DAMAGE,
	&"blink_lanes": 18.0 / DEFAULT_ATTACK_DAMAGE,
	&"disc_fan": 10.0 / DEFAULT_ATTACK_DAMAGE,
}
const ACTION_TELEGRAPH_RATIOS := {
	&"blood_lunge": 1.0,
	&"blink_lanes": 1.00 / DEFAULT_TELEGRAPH_SECONDS,
	&"disc_fan": 0.82 / DEFAULT_TELEGRAPH_SECONDS,
}

@export_range(1, 9999, 1) var max_health := 720
@export_range(8.0, 300.0, 1.0) var chase_speed := 58.0
@export_range(0.2, 5.0, 0.05) var phase_one_cooldown := 1.55
@export_range(0.2, 5.0, 0.05) var phase_two_cooldown := 1.30
@export_flags_2d_physics var blink_world_collision_mask := 1

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var telegraph_visual: Node2D = %TelegraphVisual
@onready var telegraph_line_a: Line2D = %TelegraphLineA
@onready var telegraph_line_b: Line2D = %TelegraphLineB
@onready var telegraph_line_c: Line2D = %TelegraphLineC
@onready var telegraph_lane_h: Sprite2D = %TelegraphLaneH
@onready var telegraph_lane_v: Sprite2D = %TelegraphLaneV
@onready var telegraph_marker: Sprite2D = %TelegraphMarker

var health := 720
var score_reward := 1800
var phase := 1
var _preferred_range := DEFAULT_PREFERRED_RANGE
var _attack_range := DEFAULT_ATTACK_RANGE
var _awareness_range := 560.0
var _base_telegraph_seconds := DEFAULT_TELEGRAPH_SECONDS
var _base_recovery_seconds := DEFAULT_RECOVERY_SECONDS
var _base_attack_damage := DEFAULT_ATTACK_DAMAGE
var _state := State.CHASE
var _state_time_left := 0.0
var _cooldown_left := 0.8
var _spawn_position := Vector2.ZERO
var _target: Node2D
var _facing := Vector2.DOWN
var _locked_direction := Vector2.DOWN
var _locked_target_position := Vector2.ZERO
var _active_pattern := &""
var _attack_cycle := 0
var _melee_threat_serial := 0
var _strike_has_hit := false
var _death_emitted := false
var _telegraph_visual_elapsed := 0.0


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	_spawn_position = global_position
	animated_sprite.sprite_frames = _build_sprite_frames()
	animated_sprite.animation_finished.connect(_on_animation_finished)
	add_to_group(&"enemies")
	add_to_group(&"bosses")
	add_to_group(&"boss_enemies")
	set_meta(&"is_boss_enemy", true)
	add_to_group(&"enemy_vampire_castellan")
	set_meta(&"runtime_enemy_id", RUNTIME_ENEMY_ID)
	set_meta(&"display_name", DISPLAY_NAME)
	_hide_telegraph_visual()
	reset_encounter()


func _physics_process(delta: float) -> void:
	if _state == State.DEAD:
		velocity = velocity.move_toward(Vector2.ZERO, 720.0 * delta)
		move_and_slide()
		return
	_target = get_tree().get_first_node_in_group(&"player") as Node2D
	_cooldown_left = maxf(0.0, _cooldown_left - delta)
	match _state:
		State.CHASE:
			_update_chase(delta)
		State.TELEGRAPH:
			_update_telegraph(delta)
		State.STRIKE:
			_update_strike(delta)
		State.RECOVER:
			_update_recover(delta)
		State.PHASE_TRANSITION:
			_update_phase_transition(delta)
	_refresh_telegraph_visual(delta)
	move_and_slide()


func get_archetype_id() -> StringName:
	return RUNTIME_ENEMY_ID


func get_display_name() -> String:
	return DISPLAY_NAME


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or not snapshot.is_valid():
		return false
	max_health = maxi(1, roundi(snapshot.max_health))
	health = max_health
	score_reward = maxi(0, snapshot.score_reward)
	chase_speed = maxf(0.0, snapshot.movement_speed)
	_preferred_range = maxf(0.0, snapshot.preferred_range)
	_attack_range = maxf(0.0, snapshot.attack_range)
	_awareness_range = maxf(_attack_range, snapshot.awareness_range)
	_base_telegraph_seconds = maxf(0.0, snapshot.telegraph_seconds)
	_base_recovery_seconds = maxf(0.0, snapshot.recovery_seconds)
	phase_one_cooldown = maxf(0.01, snapshot.attack_cooldown_seconds)
	phase_two_cooldown = phase_one_cooldown * PHASE_TWO_COOLDOWN_RATIO
	_base_attack_damage = maxf(0.0, snapshot.attack_damage)
	if is_inside_tree():
		health_changed.emit(health, max_health)
	return true


func get_phase_name() -> String:
	return "CRIMSON COURT" if phase == 1 else "NIGHTFALL DECREE"


func get_phase_two_threshold_health() -> int:
	return ceili(float(max_health) * PHASE_TWO_RATIO)


func get_runtime_snapshot() -> Dictionary:
	return {
		"enemy_id": String(RUNTIME_ENEMY_ID),
		"display_name": DISPLAY_NAME,
		"health": health,
		"max_health": max_health,
		"phase": phase,
		"phase_name": get_phase_name(),
		"state": State.keys()[_state].to_lower(),
		"pattern": String(_active_pattern),
		"cooldown": snappedf(_cooldown_left, 0.01),
		"score": score_reward,
		"movement_speed": chase_speed,
		"preferred_range": _preferred_range,
		"attack_range": _attack_range,
		"awareness_range": _awareness_range,
		"telegraph": _base_telegraph_seconds,
		"recovery": _base_recovery_seconds,
		"attack_damage": _base_attack_damage,
	}


func get_authored_action_damage(action_id: StringName, action_phase := 0) -> int:
	var resolved_phase := phase if action_phase <= 0 else action_phase
	var ratio_id := action_id
	if action_id == &"blood_lunge":
		ratio_id = &"blood_lunge_phase_two" if resolved_phase >= 2 else &"blood_lunge_phase_one"
	if not ACTION_DAMAGE_RATIOS.has(ratio_id):
		return 0
	return maxi(0, roundi(_base_attack_damage * float(ACTION_DAMAGE_RATIOS[ratio_id])))


func reset_encounter() -> void:
	_clear_owned_projectiles()
	global_position = _spawn_position
	health = max_health
	phase = 1
	_state = State.CHASE
	_state_time_left = 0.0
	_cooldown_left = phase_one_cooldown * INITIAL_COOLDOWN_RATIO
	_active_pattern = &""
	_attack_cycle = 0
	_strike_has_hit = false
	_death_emitted = false
	velocity = Vector2.ZERO
	if is_instance_valid(body_collision):
		body_collision.set_deferred(&"disabled", false)
	if is_instance_valid(animated_sprite):
		animated_sprite.modulate = Color.WHITE
		animated_sprite.play(&"idle")
	_hide_telegraph_visual()
	health_changed.emit(health, max_health)
	phase_changed.emit(phase, get_phase_name())
	encounter_reset.emit()


func take_damage(amount: int, source_position := Vector2.ZERO) -> void:
	if amount <= 0 or _state in [State.DEAD, State.PHASE_TRANSITION]:
		return
	var previous_health := health
	health = maxi(0, health - amount)
	health_changed.emit(health, max_health)
	if health < previous_health:
		var impact_direction := source_position.direction_to(global_position)
		VfxCatalog.spawn(
			get_parent(),
			&"blood_impact",
			global_position + Vector2(0.0, -13.0),
			impact_direction.angle(),
			0.92,
			Color(1.0, 0.44, 0.58, 0.86),
			10
		)
	if health <= 0:
		_enter_dead()
		return
	if phase == 1 and health <= get_phase_two_threshold_health():
		_begin_phase_two()


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state in [State.DEAD, State.PHASE_TRANSITION, State.TELEGRAPH]:
		return
	velocity = velocity.move_toward(Vector2.ZERO, clampf(amount * 2.0, 8.0, 90.0))
	if _state == State.RECOVER:
		_state_time_left = minf(0.9, _state_time_left + clampf(amount * 0.004, 0.02, 0.18))


func debug_begin_pattern(pattern_id: StringName) -> bool:
	if pattern_id not in [&"blood_lunge", &"blink_lanes", &"disc_fan"] or _state == State.DEAD:
		return false
	_target = get_tree().get_first_node_in_group(&"player") as Node2D
	if not is_instance_valid(_target):
		return false
	_begin_pattern(pattern_id)
	return true


func debug_get_blink_arena_bounds() -> Rect2:
	return BLINK_ARENA_BOUNDS


func debug_get_blink_candidates(anchor: Vector2, preferred_side: float) -> Array[Vector2]:
	return _blink_candidate_positions(anchor, preferred_side)


func debug_is_blink_destination_safe(destination: Vector2) -> bool:
	return _is_blink_destination_safe(destination)


func _update_chase(_delta: float) -> void:
	if not is_instance_valid(_target) or _target.get("dead") == true:
		velocity = Vector2.ZERO
		_play(&"idle")
		return
	var offset := _target.global_position - global_position
	if _cooldown_left <= 0.0 and offset.length() <= _attack_range:
		_begin_pattern(_choose_next_pattern())
		return
	var preferred_distance := _preferred_range * (1.0 if phase == 1 else PHASE_TWO_PREFERRED_RANGE_RATIO)
	var desired := offset.normalized()
	if offset.length() < preferred_distance:
		desired = -desired + desired.orthogonal() * (0.32 if _attack_cycle % 2 == 0 else -0.32)
	velocity = desired.normalized() * chase_speed * (1.0 if phase == 1 else PHASE_TWO_MOVEMENT_RATIO)
	_set_facing(offset)
	_play(&"move")


func _choose_next_pattern() -> StringName:
	if phase == 1:
		return &"blood_lunge"
	var pattern_order: Array[StringName] = [&"blink_lanes", &"blood_lunge", &"disc_fan"]
	var result := pattern_order[_attack_cycle % pattern_order.size()]
	_attack_cycle += 1
	return result


func _begin_pattern(pattern_id: StringName) -> void:
	_active_pattern = pattern_id
	_locked_target_position = _target.global_position
	_locked_direction = global_position.direction_to(_locked_target_position)
	if _locked_direction.is_zero_approx():
		_locked_direction = _facing
	_set_facing(_locked_direction)
	velocity = Vector2.ZERO
	_strike_has_hit = false
	_state = State.TELEGRAPH
	_state_time_left = _telegraph_seconds(pattern_id)
	_play(&"attack")
	attack_telegraphed.emit(pattern_id, _state_time_left)
	if pattern_id == &"blood_lunge":
		_emit_melee_threat()
	var cue_position := _locked_target_position if pattern_id == &"blink_lanes" else global_position
	VfxCatalog.spawn(get_parent(), &"world_sparkle", cue_position + Vector2(0.0, -8.0), 0.0, 0.9, Color(1.0, 0.18, 0.36, 0.84), 9)
	_refresh_telegraph_visual(0.0)


func _emit_melee_threat() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if not is_instance_valid(_target) or events == null \
			or not events.has_signal(&"melee_threat_emitted"):
		return
	_melee_threat_serial += 1
	var threat_id := StringName(
		"castellan_%d_blood_lunge_%d" % [get_instance_id(), _melee_threat_serial]
	)
	events.emit_signal(
		&"melee_threat_emitted",
		threat_id,
		self,
		_target,
		global_position,
		184.0
	)


func _telegraph_seconds(pattern_id: StringName) -> float:
	return _base_telegraph_seconds * float(ACTION_TELEGRAPH_RATIOS.get(pattern_id, 1.0))


func _update_telegraph(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
	_state_time_left -= delta
	if _state_time_left <= 0.0:
		_state = State.STRIKE
		_hide_telegraph_visual()
		match _active_pattern:
			&"blood_lunge":
				_state_time_left = 0.38
				VfxCatalog.spawn(get_parent(), &"vampire_blink_departure", global_position + Vector2(0.0, -12.0), _locked_direction.angle(), 1.25, Color(1.0, 0.42, 0.54, 0.88), 9)
			&"blink_lanes":
				_state_time_left = 0.20
				_resolve_blink_lanes()
			&"disc_fan":
				_state_time_left = 0.26
				_spawn_disc_fan()


func _update_strike(delta: float) -> void:
	_state_time_left -= delta
	if _active_pattern == &"blood_lunge":
		var modifiers: Dictionary = get_meta(&"difficulty_modifiers", {})
		velocity = _locked_direction * 236.0 * float(modifiers.get("speed_multiplier", 1.0))
		_attempt_lunge_hit()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, 920.0 * delta)
	if _state_time_left <= 0.0:
		_begin_recovery()


func _attempt_lunge_hit() -> void:
	if _strike_has_hit or not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	if global_position.distance_to(_target.global_position) > 34.0:
		return
	_strike_has_hit = true
	var authored_damage := get_authored_action_damage(&"blood_lunge")
	var hit := EnemyDifficultyScalerScript.apply_authored_damage_hit(
		self,
		_target,
		authored_damage,
		global_position,
	)
	if bool(hit.get("confirmed", false)):
		_spawn_blood_tether(_target.global_position)


func _resolve_blink_lanes() -> void:
	var old_position := global_position
	VfxCatalog.spawn(get_parent(), &"vampire_blink_departure", old_position + Vector2(0.0, -12.0), 0.0, 1.35, Color(1.0, 0.25, 0.42, 0.88), 10)
	var side := -1.0 if _attack_cycle % 2 == 0 else 1.0
	var blink_destination := _find_safe_blink_destination(_locked_target_position, side)
	global_position = blink_destination
	VfxCatalog.spawn(get_parent(), &"vampire_blink_arrival", global_position + Vector2(0.0, -12.0), 0.0, 1.35, Color(1.0, 0.25, 0.42, 0.90), 10)
	if not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	var relative := _target.global_position - _locked_target_position
	var inside_horizontal := absf(relative.y) <= 17.0 and absf(relative.x) <= 132.0
	var inside_vertical := absf(relative.x) <= 17.0 and absf(relative.y) <= 132.0
	if inside_horizontal or inside_vertical:
		var hit := EnemyDifficultyScalerScript.apply_authored_damage_hit(
			self,
			_target,
			get_authored_action_damage(&"blink_lanes"),
			_locked_target_position,
		)
		if bool(hit.get("confirmed", false)):
			VfxCatalog.spawn(get_parent(), &"blood_impact", _target.global_position + Vector2(0.0, -8.0), 0.0, 1.1, Color(1.0, 0.32, 0.48, 0.88), 10)


func _find_safe_blink_destination(anchor: Vector2, preferred_side: float) -> Vector2:
	for candidate: Vector2 in _blink_candidate_positions(anchor, preferred_side):
		if _is_blink_destination_safe(candidate):
			return candidate
	# Blink must fail closed. Keeping the current known-good position is safer
	# than forcing the boss into a wall or beyond the authored throne arena.
	return global_position


func _blink_candidate_positions(anchor: Vector2, preferred_side: float) -> Array[Vector2]:
	var side := -1.0 if preferred_side < 0.0 else 1.0
	return [
		anchor + Vector2(BLINK_LATERAL_OFFSET * side, -BLINK_VERTICAL_OFFSET),
		anchor + Vector2(-BLINK_LATERAL_OFFSET * side, -BLINK_VERTICAL_OFFSET),
		anchor + Vector2(BLINK_LATERAL_OFFSET * side, BLINK_VERTICAL_OFFSET),
		anchor + Vector2(-BLINK_LATERAL_OFFSET * side, BLINK_VERTICAL_OFFSET),
		anchor + Vector2(BLINK_CARDINAL_OFFSET * side, 0.0),
		anchor + Vector2(-BLINK_CARDINAL_OFFSET * side, 0.0),
		anchor + Vector2(0.0, -BLINK_CARDINAL_OFFSET),
		anchor + Vector2(0.0, BLINK_CARDINAL_OFFSET),
	]


func _is_blink_destination_safe(destination: Vector2) -> bool:
	if not is_inside_tree() or not is_instance_valid(body_collision) or body_collision.shape == null:
		return false
	var shape_transform := body_collision.global_transform
	shape_transform.origin += destination - global_position
	if not _shape_stays_inside_blink_arena(body_collision.shape.get_rect(), shape_transform):
		return false
	if blink_world_collision_mask == 0:
		return true
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_collision.shape
	query.transform = shape_transform
	query.collision_mask = blink_world_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	query.exclude = [get_rid()]
	return get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()


func _shape_stays_inside_blink_arena(local_rect: Rect2, shape_transform: Transform2D) -> bool:
	var corners: Array[Vector2] = [
		shape_transform * local_rect.position,
		shape_transform * Vector2(local_rect.end.x, local_rect.position.y),
		shape_transform * local_rect.end,
		shape_transform * Vector2(local_rect.position.x, local_rect.end.y),
	]
	var minimum := corners[0]
	var maximum := corners[0]
	for corner: Vector2 in corners:
		minimum = minimum.min(corner)
		maximum = maximum.max(corner)
	return (
		minimum.x >= BLINK_ARENA_BOUNDS.position.x
		and minimum.y >= BLINK_ARENA_BOUNDS.position.y
		and maximum.x <= BLINK_ARENA_BOUNDS.end.x
		and maximum.y <= BLINK_ARENA_BOUNDS.end.y
	)


func _spawn_disc_fan() -> void:
	if get_parent() == null:
		return
	var disc_range := _attack_range * DISC_TRAVEL_RANGE_RATIO
	for angle_offset: float in [-0.32, 0.0, 0.32]:
		var disc := SPECTRAL_DISC_SCENE.instantiate() as SpectralDisc
		if disc == null:
			continue
		get_parent().add_child(disc)
		disc.set_meta(&"castellan_projectile_owner", get_instance_id())
		disc.maximum_distance = disc_range
		disc.travel_speed = 172.0
		var direction := _locked_direction.rotated(angle_offset)
		disc.setup(
			self,
			global_position + direction * disc_range,
			get_authored_action_damage(&"disc_fan"),
			_target,
			EnemyDifficultyScalerScript.INPUT_KIND_AUTHORED,
			&"",
		)
	VfxCatalog.spawn(get_parent(), &"vampire_absorb", global_position + Vector2(0.0, -12.0), 0.0, 0.88, Color(0.78, 0.18, 1.0, 0.78), 8)


func _spawn_blood_tether(target_position: Vector2) -> void:
	var start := global_position + Vector2(0.0, -10.0)
	var finish := target_position + Vector2(0.0, -8.0)
	var offset := finish - start
	var tether := VfxCatalog.spawn(get_parent(), &"vampire_tether", (start + finish) * 0.5, offset.angle(), 1.0, Color(0.96, 0.06, 0.28, 0.78), 9)
	if tether != null:
		tether.scale.x = maxf(0.35, offset.length() / 32.0)


func _begin_recovery() -> void:
	_state = State.RECOVER
	_hide_telegraph_visual()
	_state_time_left = _base_recovery_seconds * (1.0 if phase == 1 else PHASE_TWO_RECOVERY_RATIO)
	_cooldown_left = phase_one_cooldown if phase == 1 else phase_two_cooldown
	velocity = Vector2.ZERO
	_active_pattern = &""
	_play(&"idle")


func _update_recover(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 760.0 * delta)
	_state_time_left -= delta
	if _state_time_left <= 0.0:
		_state = State.CHASE


func _begin_phase_two() -> void:
	phase = 2
	_state = State.PHASE_TRANSITION
	_hide_telegraph_visual()
	_state_time_left = 1.15
	_active_pattern = &"nightfall_transition"
	velocity = Vector2.ZERO
	animated_sprite.modulate = Color(1.0, 0.62, 0.82, 1.0)
	_play(&"attack")
	VfxCatalog.spawn(get_parent(), &"vampire_absorb", global_position + Vector2(0.0, -13.0), 0.0, 1.55, Color(0.82, 0.08, 0.38, 0.92), 9)
	phase_changed.emit(phase, get_phase_name())


func _update_phase_transition(delta: float) -> void:
	velocity = Vector2.ZERO
	_state_time_left -= delta
	if _state_time_left > 0.0:
		return
	animated_sprite.modulate = Color(1.0, 0.78, 0.88, 1.0)
	_active_pattern = &""
	_state = State.RECOVER
	_state_time_left = 0.42
	_cooldown_left = 0.45
	_play(&"idle")


func _enter_dead() -> void:
	if _state == State.DEAD:
		return
	_state = State.DEAD
	_hide_telegraph_visual()
	velocity = Vector2.ZERO
	_active_pattern = &""
	body_collision.set_deferred(&"disabled", true)
	_clear_owned_projectiles()
	VfxCatalog.spawn(get_parent(), &"vampire_absorb", global_position + Vector2(0.0, -13.0), 0.0, 1.65, Color(0.72, 0.02, 0.24, 0.92), 10)
	VfxCatalog.spawn(get_parent(), &"blood_impact", global_position + Vector2(0.0, -13.0), 0.0, 1.45, Color(1.0, 0.44, 0.52, 0.90), 11)
	_play(&"death")
	var session := get_node_or_null("/root/GameSession")
	if session != null and session.has_method(&"add_score"):
		session.call(&"add_score", score_reward)
	if not _death_emitted:
		_death_emitted = true
		died.emit(self)


func _clear_owned_projectiles() -> void:
	if get_parent() == null:
		return
	for child: Node in get_parent().get_children():
		if child != self and int(child.get_meta(&"castellan_projectile_owner", 0)) == get_instance_id():
			child.queue_free()


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_facing = direction.normalized()
	if absf(_facing.x) > 0.08:
		animated_sprite.flip_h = _facing.x > 0.0


func _play(animation_name: StringName) -> void:
	if animated_sprite.animation != animation_name:
		animated_sprite.play(animation_name)


func _refresh_telegraph_visual(delta: float) -> void:
	if _state != State.TELEGRAPH or not is_instance_valid(telegraph_visual):
		_hide_telegraph_visual()
		return
	_telegraph_visual_elapsed += delta
	telegraph_visual.visible = true
	telegraph_line_a.visible = false
	telegraph_line_b.visible = false
	telegraph_line_c.visible = false
	telegraph_lane_h.visible = false
	telegraph_lane_v.visible = false
	telegraph_marker.visible = false
	var warning := Color(1.0, 0.12, 0.32, 0.92)
	var marker_frame := int(floor(_telegraph_visual_elapsed * 18.0)) % maxi(1, telegraph_marker.hframes)
	telegraph_marker.frame = marker_frame
	match _active_pattern:
		&"blood_lunge":
			var endpoint := _locked_direction * 184.0
			_set_telegraph_line(telegraph_line_a, Vector2.ZERO, endpoint, warning, 5.0)
			telegraph_marker.visible = true
			telegraph_marker.position = endpoint
			telegraph_marker.modulate = warning
			telegraph_marker.scale = Vector2.ONE * (0.68 + sin(_telegraph_visual_elapsed * 10.0) * 0.08)
		&"blink_lanes":
			var anchor := _locked_target_position - global_position
			var lane_tint := Color(warning, 0.24 + sin(_telegraph_visual_elapsed * 8.0) * 0.04)
			telegraph_lane_h.visible = true
			telegraph_lane_v.visible = true
			telegraph_lane_h.position = anchor
			telegraph_lane_v.position = anchor
			telegraph_lane_h.frame = marker_frame % maxi(1, telegraph_lane_h.hframes)
			telegraph_lane_v.frame = telegraph_lane_h.frame
			telegraph_lane_h.modulate = lane_tint
			telegraph_lane_v.modulate = lane_tint
			telegraph_lane_h.scale = Vector2(8.25, 2.125)
			telegraph_lane_v.scale = Vector2(8.25, 2.125)
			_set_telegraph_line(telegraph_line_a, anchor + Vector2(-132.0, 0.0), anchor + Vector2(132.0, 0.0), warning, 3.0)
			_set_telegraph_line(telegraph_line_b, anchor + Vector2(0.0, -132.0), anchor + Vector2(0.0, 132.0), warning, 3.0)
			telegraph_marker.visible = true
			telegraph_marker.position = anchor
			telegraph_marker.modulate = warning
			telegraph_marker.scale = Vector2.ONE * (0.9 + sin(_telegraph_visual_elapsed * 10.0) * 0.1)
		&"disc_fan":
			var fan_color := Color(0.72, 0.34, 1.0, 0.84)
			_set_telegraph_line(telegraph_line_a, Vector2.ZERO, _locked_direction.rotated(-0.32) * 230.0, fan_color, 2.5)
			_set_telegraph_line(telegraph_line_b, Vector2.ZERO, _locked_direction * 230.0, fan_color, 2.5)
			_set_telegraph_line(telegraph_line_c, Vector2.ZERO, _locked_direction.rotated(0.32) * 230.0, fan_color, 2.5)
			telegraph_marker.visible = true
			telegraph_marker.position = _locked_direction * 230.0
			telegraph_marker.modulate = fan_color
			telegraph_marker.scale = Vector2.ONE * 0.54


func _set_telegraph_line(line: Line2D, start: Vector2, finish: Vector2, color: Color, width: float) -> void:
	line.visible = true
	line.points = PackedVector2Array([start, finish])
	line.default_color = color
	line.width = width


func _hide_telegraph_visual() -> void:
	if is_instance_valid(telegraph_visual):
		telegraph_visual.visible = false


func _build_sprite_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	_add_strip(frames, &"idle", "res://assets/characters/enemies/enemies-vampire_idle.png", 6, 7.0, true)
	_add_strip(frames, &"move", "res://assets/characters/enemies/enemies-vampire_movement.png", 8, 10.0, true)
	_add_strip(frames, &"attack", "res://assets/characters/enemies/enemies-vampire_attack.png", 16, 16.0, false)
	_add_strip(frames, &"death", "res://assets/characters/enemies/enemies-vampire_death.png", 14, 13.0, false)
	return frames


func _add_strip(
		frames: SpriteFrames,
		animation_name: StringName,
		texture_path: String,
		frame_count: int,
		fps: float,
		looped: bool,
) -> void:
	var texture := load(texture_path) as Texture2D
	if texture == null:
		return
	frames.add_animation(animation_name)
	frames.set_animation_speed(animation_name, fps)
	frames.set_animation_loop(animation_name, looped)
	for frame_index: int in frame_count:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(Vector2(frame_index * FRAME_SIZE.x, 0), Vector2(FRAME_SIZE))
		frames.add_frame(animation_name, atlas)


func _on_animation_finished() -> void:
	if _state == State.DEAD and animated_sprite.animation == &"death":
		queue_free()
