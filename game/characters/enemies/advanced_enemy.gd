class_name AdvancedDungeonEnemy
extends CharacterBody2D

signal health_changed(current: int, maximum: int)
signal died(enemy: AdvancedDungeonEnemy)

enum Archetype {
	BONE_REAPER,
	BLOOD_VAMPIRE,
}

enum State {
	PATROL,
	CHASE,
	TELEGRAPH,
	STRIKE,
	RECOVER,
	HURT,
	DEAD,
}

const FRAME_SIZE := Vector2i(32, 32)
const GOLDEN_ANGLE := 2.399963
const SPECTRAL_DISC_SCENE: PackedScene = preload("res://game/characters/enemies/spectral_disc.tscn")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const EnemyDifficultyScalerScript := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

@export_enum("Bone Reaper", "Blood Vampire") var archetype: int = Archetype.BONE_REAPER
@export_range(8.0, 600.0, 1.0) var patrol_distance := 72.0

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var telegraph_line: Line2D = %TelegraphLine
@onready var telegraph_origin: Sprite2D = %TelegraphOrigin
@onready var telegraph_endpoint: Sprite2D = %TelegraphEndpoint

var max_health := 80
var health := 80
var score_reward := 140
var _profile: Dictionary = {}
var _state: State = State.PATROL
var _state_time_left := 0.0
var _ability_cooldown_left := 0.0
var _spawn_position := Vector2.ZERO
var _patrol_target := Vector2.ZERO
var _patrol_angle := 0.0
var _patrol_step := 0
var _facing := Vector2.LEFT
var _locked_direction := Vector2.LEFT
var _target: Node2D
var _priority_target: Node2D
var _strike_has_hit := false
var _projectile_created := false
var _cached_neighbors: Array[Node2D] = []
var _neighbor_refresh_left := 0.0
var _telegraph_palette := "standard"
var _high_contrast_telegraphs := false
var _melee_threat_serial := 0
var _telegraph_visual_elapsed := 0.0
var _pending_definition_snapshot: EnemyRuntimeSnapshot
var _definition_configured := false


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	if _profile.is_empty():
		_configure_profile()
	if _pending_definition_snapshot != null:
		_apply_definition_snapshot(_pending_definition_snapshot)
	_load_accessibility_preferences()
	add_to_group(&"enemies")
	add_to_group(&"enemy_%s" % String(get_archetype_id()))
	health = max_health
	_spawn_position = global_position
	_patrol_angle = deg_to_rad(float(get_instance_id() % 360))
	_choose_patrol_target()
	animated_sprite.sprite_frames = _build_sprite_frames()
	animated_sprite.animation_finished.connect(_on_animation_finished)
	_hide_telegraph_visual()
	_enter_state(State.PATROL)
	health_changed.emit(health, max_health)


func _physics_process(delta: float) -> void:
	_telegraph_visual_elapsed += delta
	_ability_cooldown_left = maxf(0.0, _ability_cooldown_left - delta)
	_neighbor_refresh_left -= delta
	if _neighbor_refresh_left <= 0.0:
		_refresh_neighbors()
		_neighbor_refresh_left = 0.22

	if _state == State.DEAD:
		velocity = velocity.move_toward(Vector2.ZERO, 480.0 * delta)
		move_and_slide()
		return

	_target = _find_player()
	match _state:
		State.PATROL:
			_update_patrol()
		State.CHASE:
			_update_chase()
		State.TELEGRAPH:
			_update_telegraph(delta)
		State.STRIKE:
			_update_strike(delta)
		State.RECOVER:
			_update_recover(delta)
		State.HURT:
			_update_hurt(delta)

	_refresh_telegraph_visual()
	move_and_slide()
	if _state == State.STRIKE:
		_attempt_strike_hit()
		if archetype == Archetype.BLOOD_VAMPIRE and get_slide_collision_count() > 0:
			_enter_state(State.RECOVER)


func get_archetype_id() -> StringName:
	return &"bone_reaper" if archetype == Archetype.BONE_REAPER else &"blood_vampire"


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or not snapshot.is_valid():
		return false
	_pending_definition_snapshot = snapshot
	if _profile.is_empty():
		_configure_profile()
	return _apply_definition_snapshot(snapshot)


func has_configured_definition() -> bool:
	return _definition_configured


## Stable runtime seam for roster modifiers. Keeping profile mutation inside the
## enemy prevents external systems from depending on a private Dictionary field.
func get_combat_profile() -> Dictionary:
	return _profile.duplicate(true)


func set_combat_profile(profile: Dictionary) -> bool:
	if profile.is_empty():
		return false
	_profile = profile.duplicate(true)
	max_health = maxi(1, int(_profile.get("max_health", max_health)))
	score_reward = maxi(0, int(_profile.get("score", score_reward)))
	return true


func _apply_definition_snapshot(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or _profile.is_empty():
		return false
	var previous_chase := maxf(0.001, float(_profile.get("chase_speed", 1.0)))
	var patrol_ratio := float(_profile.get("patrol_speed", previous_chase)) / previous_chase
	var previous_detection := maxf(0.001, float(_profile.get("detection", 1.0)))
	var disengage_ratio := float(_profile.get("disengage", previous_detection)) / previous_detection
	var previous_min := float(_profile.get("preferred_min", snapshot.preferred_range))
	var previous_max := float(_profile.get("preferred_max", snapshot.preferred_range))
	var preferred_half_span := maxf(0.0, (previous_max - previous_min) * 0.5)

	var profile := _profile.duplicate(true)
	profile["max_health"] = maxi(1, roundi(snapshot.max_health))
	profile["score"] = maxi(0, snapshot.score_reward)
	profile["chase_speed"] = maxf(0.0, snapshot.movement_speed)
	profile["patrol_speed"] = maxf(0.0, snapshot.movement_speed * patrol_ratio)
	profile["detection"] = maxf(snapshot.attack_range, snapshot.awareness_range)
	profile["disengage"] = float(profile["detection"]) * disengage_ratio
	profile["preferred_min"] = maxf(0.0, snapshot.preferred_range - preferred_half_span)
	profile["preferred_max"] = snapshot.preferred_range + preferred_half_span
	profile["ability_range"] = maxf(0.0, snapshot.attack_range)
	profile["telegraph"] = maxf(0.0, snapshot.telegraph_seconds)
	profile["recovery"] = maxf(0.0, snapshot.recovery_seconds)
	profile["cooldown"] = maxf(0.01, snapshot.attack_cooldown_seconds)
	profile["damage"] = maxi(0, roundi(snapshot.attack_damage))
	if not set_combat_profile(profile):
		return false
	health = max_health
	_definition_configured = true
	if is_inside_tree():
		health_changed.emit(health, max_health)
	return true


## Optional defense-objective targeting seam. Standard encounters never set it,
## preserving their player-facing chase/disengage behavior byte-for-byte.
func set_priority_target(target: Node2D) -> void:
	_priority_target = target
	if is_instance_valid(_priority_target):
		_target = _priority_target
		_enter_state(State.CHASE)


func get_ability_summary() -> String:
	if archetype == Archetype.BONE_REAPER:
		return "Lưỡi Liềm Hồi Hồn: giữ cự ly, báo đường ném rồi đĩa linh hồn bay đi và quay lại."
	return "Huyết Bộ: báo hướng lao, hút máu khi trúng và rút một nấc tiến độ Spirit."


func get_telegraph_seconds() -> float:
	return float(_profile.get("telegraph", 0.5))


func get_ability_range() -> float:
	return float(_profile.get("ability_range", 0.0))


func take_damage(amount: int, source_position := Vector2.ZERO) -> void:
	if amount <= 0 or _state == State.DEAD:
		return
	health = maxi(0, health - amount)
	health_changed.emit(health, max_health)
	if health <= 0:
		_enter_state(State.DEAD)
		return
	var knockback_direction := -_facing
	if source_position != Vector2.ZERO:
		knockback_direction = source_position.direction_to(global_position)
	if knockback_direction.is_zero_approx():
		knockback_direction = Vector2.DOWN
	velocity = knockback_direction.normalized() * 112.0
	_enter_state(State.HURT)


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state == State.DEAD:
		return
	velocity = velocity.move_toward(Vector2.ZERO, clampf(amount * 3.0, 12.0, 120.0))
	if _state != State.HURT:
		_enter_state(State.HURT)
	_state_time_left = maxf(_state_time_left, clampf(amount * 0.012, 0.10, 0.55))


func _configure_profile() -> void:
	if archetype == Archetype.BONE_REAPER:
		_profile = {
			"max_health": 86,
			"score": 150,
			"patrol_speed": 30.0,
			"chase_speed": 48.0,
			"detection": 205.0,
			"disengage": 280.0,
			"preferred_min": 82.0,
			"preferred_max": 150.0,
			"ability_range": 188.0,
			"telegraph": 0.56,
			"strike_duration": 0.28,
			"recovery": 0.72,
			"cooldown": 2.10,
			"damage": 14,
		}
	else:
		_profile = {
			"max_health": 112,
			"score": 190,
			"patrol_speed": 38.0,
			"chase_speed": 70.0,
			"detection": 215.0,
			"disengage": 290.0,
			"preferred_min": 0.0,
			"preferred_max": 86.0,
			"ability_range": 118.0,
			"telegraph": 0.44,
			"strike_duration": 0.52,
			"strike_speed": 168.0,
			"recovery": 0.66,
			"cooldown": 1.85,
			"damage": 16,
			"leech": 8,
		}
	max_health = int(_profile.get("max_health", 80))
	score_reward = int(_profile.get("score", 100))


func _update_patrol() -> void:
	if _can_detect_target(float(_profile.get("detection", 180.0))):
		_enter_state(State.CHASE)
		return
	if global_position.distance_to(_patrol_target) <= 8.0:
		_choose_patrol_target()
	var direction := global_position.direction_to(_patrol_target)
	var speed := float(_profile.get("patrol_speed", 32.0))
	velocity = _steer(direction * speed, speed)
	_set_facing(velocity)
	_play_move()


func _update_chase() -> void:
	if not _can_detect_target(float(_profile.get("disengage", 260.0))):
		_choose_patrol_target()
		_enter_state(State.PATROL)
		return

	var offset := _target.global_position - global_position
	var distance := offset.length()
	if (
		_ability_cooldown_left <= 0.0
		and distance <= float(_profile.get("ability_range", 120.0))
		and _has_line_of_sight(_target)
	):
		_locked_direction = offset.normalized()
		if _locked_direction.is_zero_approx():
			_locked_direction = _facing
		_set_facing(_locked_direction)
		_enter_state(State.TELEGRAPH)
		return

	var desired_direction := offset.normalized()
	if archetype == Archetype.BONE_REAPER:
		var preferred_min := float(_profile.get("preferred_min", 82.0))
		var preferred_max := float(_profile.get("preferred_max", 150.0))
		if distance < preferred_min:
			desired_direction = -desired_direction + desired_direction.orthogonal() * 0.35
		elif distance <= preferred_max:
			desired_direction = desired_direction.orthogonal() * (1.0 if get_instance_id() % 2 == 0 else -1.0)
	var speed := float(_profile.get("chase_speed", 56.0))
	velocity = _steer(desired_direction.normalized() * speed, speed)
	_set_facing(offset)
	_play_move()


func _update_telegraph(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 780.0 * delta)
	_state_time_left -= delta
	_set_facing(_locked_direction)
	if _state_time_left <= 0.0:
		_enter_state(State.STRIKE)


func _update_strike(delta: float) -> void:
	_state_time_left -= delta
	if archetype == Archetype.BONE_REAPER:
		velocity = velocity.move_toward(Vector2.ZERO, 900.0 * delta)
		if not _projectile_created:
			_projectile_created = true
			_spawn_spectral_disc()
	else:
		velocity = _locked_direction * float(_profile.get("strike_speed", 168.0))
	if _state_time_left <= 0.0:
		_enter_state(State.RECOVER)


func _update_recover(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 650.0 * delta)
	_state_time_left -= delta
	if _state_time_left <= 0.0:
		_enter_state(State.CHASE if _can_detect_target(float(_profile.get("disengage", 260.0))) else State.PATROL)


func _update_hurt(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 420.0 * delta)
	_state_time_left -= delta
	if _state_time_left <= 0.0:
		_enter_state(State.CHASE if _can_detect_target(float(_profile.get("disengage", 260.0))) else State.PATROL)


func _attempt_strike_hit() -> void:
	if archetype != Archetype.BLOOD_VAMPIRE or _strike_has_hit:
		return
	if not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	if global_position.distance_to(_target.global_position) > 27.0:
		return
	_strike_has_hit = true
	var damage := int(_profile.get("damage", 16))
	var hit := EnemyDifficultyScalerScript.apply_configured_damage_hit(
		self,
		_target,
		EnemyDifficultyScalerScript.PROFILE_DAMAGE_CHANNEL,
		damage,
		global_position,
	)
	if not bool(hit.get("confirmed", false)):
		return
	VfxCatalog.spawn(get_parent(), &"blood_impact", _target.global_position, _locked_direction.angle(), 0.92, Color(1.0, 0.62, 0.70, 0.86), 10)
	VfxCatalog.spawn(get_parent(), &"vampire_absorb", global_position + Vector2(0.0, -8.0), 0.0, 0.68, Color(0.86, 0.08, 0.30, 0.72), 8)
	var tether_start := global_position + Vector2(0.0, -8.0)
	var tether_end := _target.global_position + Vector2(0.0, -8.0)
	var tether_offset := tether_end - tether_start
	var tether := VfxCatalog.spawn(
		get_parent(),
		&"vampire_tether",
		(tether_start + tether_end) * 0.5,
		tether_offset.angle(),
		1.0,
		Color(0.92, 0.08, 0.25, 0.72),
		9
	)
	if tether != null:
		tether.scale.x = maxf(0.35, tether_offset.length() / 32.0)
	_emit_enemy_cue(&"vampire_drain", {"enemy_id": &"blood_vampire", "phase": &"confirmed_leech"})
	health = mini(max_health, health + int(_profile.get("leech", 8)))
	health_changed.emit(health, max_health)
	_drain_spirit_progress(_target)


func _drain_spirit_progress(player: Node) -> void:
	if not player.has_method(&"get_weapon_manager"):
		return
	var manager: Variant = player.call(&"get_weapon_manager")
	if manager == null:
		return
	for required_method: StringName in [
		&"get_spirit_slots",
		&"get_spirit_trigger_progress",
		&"set_spirit_trigger_progress",
	]:
		if not manager.has_method(required_method):
			return
	var raw_slots: Variant = manager.call(&"get_spirit_slots")
	if not raw_slots is Array:
		return
	var drain_target := &""
	var highest_progress := 0.0
	for raw_weapon: Variant in raw_slots:
		var weapon := raw_weapon as WeaponDefinition
		if weapon == null:
			continue
		var current := float(manager.call(&"get_spirit_trigger_progress", weapon.weapon_id))
		if current > highest_progress:
			highest_progress = current
			drain_target = weapon.weapon_id
	var drained := (
		not drain_target.is_empty()
		and bool(manager.call(&"set_spirit_trigger_progress", drain_target, maxf(0.0, highest_progress - 1.0)))
	)
	if drained:
		var events := get_node_or_null("/root/GameEvents")
		if events != null and events.has_signal(&"toast_requested"):
			events.emit_signal(&"toast_requested", "MA CÀ RỒNG  •  RÚT 1 NHỊP LINH KHÍ")


func _spawn_spectral_disc() -> void:
	var disc := SPECTRAL_DISC_SCENE.instantiate() as SpectralDisc
	if disc == null or get_parent() == null:
		return
	get_parent().add_child(disc)
	VfxCatalog.spawn(get_parent(), &"reaper_trail", global_position + Vector2(0.0, -8.0), _locked_direction.angle(), 0.92, Color(0.62, 0.86, 1.0, 0.46), 7)
	var ability_range := float(_profile.get("ability_range", 188.0))
	disc.maximum_distance = ability_range
	var target_position := global_position + _locked_direction * ability_range
	disc.setup(
		self,
		target_position,
		float(_profile.get("damage", 14)),
		_target,
		EnemyDifficultyScalerScript.INPUT_KIND_CONFIGURED_AUTHORED,
		EnemyDifficultyScalerScript.PROFILE_DAMAGE_CHANNEL,
	)
	_emit_enemy_cue(&"reaper_disc", {"enemy_id": &"bone_reaper", "phase": &"release"})


func _enter_state(next_state: State) -> void:
	if _state == State.DEAD and next_state != State.DEAD:
		return
	_state = next_state
	match _state:
		State.PATROL:
			animated_sprite.play(&"idle")
		State.CHASE:
			animated_sprite.play(&"move")
		State.TELEGRAPH:
			_state_time_left = float(_profile.get("telegraph", 0.5))
			velocity = Vector2.ZERO
			animated_sprite.play(&"attack")
			if archetype == Archetype.BLOOD_VAMPIRE:
				VfxCatalog.spawn(get_parent(), &"world_sparkle", global_position + Vector2(0.0, -8.0), 0.0, 0.72, Color(0.92, 0.10, 0.34, 0.72), 7)
			if archetype == Archetype.BLOOD_VAMPIRE:
				_emit_melee_threat()
		State.STRIKE:
			_state_time_left = float(_profile.get("strike_duration", 0.35))
			_strike_has_hit = false
			_projectile_created = false
			if archetype == Archetype.BLOOD_VAMPIRE:
				VfxCatalog.spawn(get_parent(), &"vampire_blink_departure", global_position + Vector2(0.0, -8.0), _locked_direction.angle(), 0.92, Color(1.0, 0.72, 0.76, 0.78), 8)
				var attack_cue := &"enemy_bite" if _melee_threat_serial % 2 == 0 else &"enemy_claw"
				_emit_enemy_cue(attack_cue, {"enemy_id": &"blood_vampire", "phase": &"lunge"})
		State.RECOVER:
			_state_time_left = float(_profile.get("recovery", 0.65))
			_ability_cooldown_left = float(_profile.get("cooldown", 1.8))
			animated_sprite.play(&"idle")
			if archetype == Archetype.BLOOD_VAMPIRE:
				VfxCatalog.spawn(get_parent(), &"vampire_blink_arrival", global_position + Vector2(0.0, -8.0), _locked_direction.angle(), 0.92, Color(1.0, 0.72, 0.76, 0.76), 8)
		State.HURT:
			_state_time_left = 0.24
			animated_sprite.play(&"hurt")
		State.DEAD:
			_hide_telegraph_visual()
			velocity = Vector2.ZERO
			if archetype == Archetype.BONE_REAPER:
				VfxCatalog.spawn(get_parent(), &"skeleton_death", global_position + Vector2(0.0, -8.0), 0.0, 1.15, Color(0.64, 0.92, 0.94, 0.84), 7)
			else:
				VfxCatalog.spawn(get_parent(), &"vampire_absorb", global_position + Vector2(0.0, -8.0), 0.0, 0.95, Color(0.74, 0.04, 0.22, 0.82), 7)
				VfxCatalog.spawn(get_parent(), &"blood_impact", global_position + Vector2(0.0, -8.0), 0.0, 1.15, Color(0.86, 0.32, 0.42, 0.80), 8)
			body_collision.set_deferred(&"disabled", true)
			animated_sprite.play(&"death")
			var session := get_node_or_null("/root/GameSession")
			if session != null and session.has_method(&"add_score"):
				session.call(&"add_score", score_reward)
			died.emit(self)


func _emit_enemy_cue(cue_id: StringName, context: Dictionary = {}) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, context)


func _emit_melee_threat() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if not is_instance_valid(_target) or events == null or not events.has_signal(&"melee_threat_emitted"):
		return
	_melee_threat_serial += 1
	var threat_id := StringName("vampire_%d_lunge_%d" % [get_instance_id(), _melee_threat_serial])
	events.emit_signal(
		&"melee_threat_emitted",
		threat_id,
		self,
		_target,
		global_position,
		float(_profile.get("ability_range", 118.0))
	)


func _play_move() -> void:
	if animated_sprite.animation != &"move":
		animated_sprite.play(&"move")


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_facing = direction.normalized()
	if absf(_facing.x) > 0.08:
		animated_sprite.flip_h = _facing.x > 0.0


func _choose_patrol_target() -> void:
	_patrol_step += 1
	_patrol_angle = fposmod(_patrol_angle + GOLDEN_ANGLE, TAU)
	var radius_ratio := 0.65 + float(_patrol_step % 4) * 0.1
	_patrol_target = _spawn_position + Vector2.from_angle(_patrol_angle) * patrol_distance * radius_ratio


func _steer(desired_velocity: Vector2, maximum_speed: float) -> Vector2:
	var steered := desired_velocity + _separation_direction() * 46.0
	for collision_index: int in get_slide_collision_count():
		var normal := get_slide_collision(collision_index).get_normal()
		if steered.dot(normal) < 0.0:
			steered = steered.slide(normal) + normal * 7.0
	return steered.limit_length(maximum_speed)


func _refresh_neighbors() -> void:
	_cached_neighbors.clear()
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if candidate != self and candidate is Node2D and is_instance_valid(candidate):
			_cached_neighbors.append(candidate as Node2D)


func _separation_direction() -> Vector2:
	var result := Vector2.ZERO
	for other: Node2D in _cached_neighbors:
		if not is_instance_valid(other):
			continue
		var offset := global_position - other.global_position
		var distance := offset.length()
		if distance <= 0.001:
			result += Vector2.RIGHT.rotated(float(get_instance_id() % 12) * TAU / 12.0)
		elif distance < 25.0:
			result += offset.normalized() * (1.0 - distance / 25.0)
	return result.limit_length(1.0)


func _can_detect_target(maximum_range: float) -> bool:
	if is_instance_valid(_priority_target) and _target == _priority_target:
		return _has_line_of_sight(_target)
	return (
		is_instance_valid(_target)
		and global_position.distance_to(_target.global_position) <= maximum_range
		and _has_line_of_sight(_target)
	)


func _has_line_of_sight(target: Node2D) -> bool:
	var query := PhysicsRayQueryParameters2D.create(
		global_position + Vector2(0.0, -7.0),
		target.global_position + Vector2(0.0, -8.0),
		1,
		[get_rid()]
	)
	return get_world_2d().direct_space_state.intersect_ray(query).is_empty()


func _find_player() -> Node2D:
	if is_instance_valid(_priority_target):
		return _priority_target
	return get_tree().get_first_node_in_group(&"player") as Node2D


func _load_accessibility_preferences() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return
	var palette_path: Array[String] = ["settings", "telegraph_palette"]
	var contrast_path: Array[String] = ["settings", "high_contrast"]
	_telegraph_palette = String(save_service.call(&"get_value", palette_path, "standard"))
	_high_contrast_telegraphs = bool(save_service.call(&"get_value", contrast_path, false))


func _build_sprite_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	var specs := _animation_specs()
	for animation_name: StringName in specs:
		var spec: Array = specs[animation_name]
		_add_strip(frames, animation_name, String(spec[0]), int(spec[1]), float(spec[2]), bool(spec[3]))
	return frames


func _animation_specs() -> Dictionary:
	if archetype == Archetype.BONE_REAPER:
		return {
			&"idle": ["res://assets/characters/enemies/enemies-skeleton2_idle.png", 6, 7.0, true],
			&"move": ["res://assets/characters/enemies/enemies-skeleton2_movemen.png", 10, 10.0, true],
			&"attack": ["res://assets/characters/enemies/enemies-skeleton2_attack.png", 15, 18.0, false],
			&"hurt": ["res://assets/characters/enemies/enemies-skeleton2_take_damage.png", 5, 14.0, false],
			&"death": ["res://assets/characters/enemies/enemies-skeleton2_death2.png", 15, 13.0, false],
		}
	return {
		&"idle": ["res://assets/characters/enemies/enemies-vampire_idle.png", 6, 7.0, true],
		&"move": ["res://assets/characters/enemies/enemies-vampire_movement.png", 8, 10.0, true],
		&"attack": ["res://assets/characters/enemies/enemies-vampire_attack.png", 16, 16.0, false],
		&"hurt": ["res://assets/characters/enemies/enemies-vampire_take_damage.png", 5, 14.0, false],
		&"death": ["res://assets/characters/enemies/enemies-vampire_death.png", 14, 13.0, false],
	}


func _add_strip(
		frames: SpriteFrames,
		animation_name: StringName,
		texture_path: String,
		frame_count: int,
		fps: float,
		looped: bool
) -> void:
	var texture := load(texture_path) as Texture2D
	if texture == null:
		push_error("Enemy animation texture is missing: %s" % texture_path)
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


func _refresh_telegraph_visual() -> void:
	if _state != State.TELEGRAPH or not is_instance_valid(telegraph_line):
		_hide_telegraph_visual()
		return
	var line_color := Color(0.20, 0.95, 1.0, 0.82)
	var accent_color := Color(0.58, 1.0, 1.0, 0.92)
	if archetype == Archetype.BLOOD_VAMPIRE:
		line_color = Color(0.88, 0.12, 0.42, 0.82)
		accent_color = Color(1.0, 0.28, 0.52, 0.92)
	if _telegraph_palette == "colorblind":
		line_color = Color(1.0, 0.67, 0.12, 0.92)
		accent_color = Color(0.25, 0.78, 1.0, 1.0)
	elif _telegraph_palette == "high_contrast" or _high_contrast_telegraphs:
		line_color = Color(1.0, 0.92, 0.18, 1.0)
		accent_color = Color.WHITE
	var endpoint_distance := (
		float(_profile.get("ability_range", 188.0))
		if archetype == Archetype.BONE_REAPER
		else 112.0
	)
	var endpoint := _locked_direction * endpoint_distance
	telegraph_line.visible = true
	telegraph_line.default_color = line_color
	telegraph_line.width = (
		4.0 if archetype == Archetype.BLOOD_VAMPIRE else 3.0
	) if _high_contrast_telegraphs else (
		3.0 if archetype == Archetype.BLOOD_VAMPIRE else 2.0
	)
	telegraph_line.points = PackedVector2Array([Vector2.ZERO, endpoint])
	telegraph_origin.visible = true
	telegraph_endpoint.visible = true
	telegraph_origin.frame = int(floor(_telegraph_visual_elapsed * 18.0)) % maxi(1, telegraph_origin.hframes)
	telegraph_endpoint.frame = int(floor(_telegraph_visual_elapsed * 18.0 + 3.0)) % maxi(1, telegraph_endpoint.hframes)
	telegraph_origin.modulate = Color(accent_color, 0.52)
	telegraph_endpoint.modulate = accent_color
	telegraph_endpoint.position = endpoint
	var pulse := 0.88 + sin(_telegraph_visual_elapsed * 11.0) * 0.12
	telegraph_origin.scale = Vector2.ONE * (0.62 if archetype == Archetype.BONE_REAPER else 0.78) * pulse
	telegraph_endpoint.scale = Vector2.ONE * (0.52 if archetype == Archetype.BONE_REAPER else 0.66) * pulse


func _hide_telegraph_visual() -> void:
	if is_instance_valid(telegraph_line):
		telegraph_line.visible = false
	if is_instance_valid(telegraph_origin):
		telegraph_origin.visible = false
	if is_instance_valid(telegraph_endpoint):
		telegraph_endpoint.visible = false
