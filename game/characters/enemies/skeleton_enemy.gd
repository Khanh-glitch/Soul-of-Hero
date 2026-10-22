class_name SkeletonEnemy
extends CharacterBody2D

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const EnemyDifficultyScalerScript := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

signal health_changed(current: int, maximum: int)
signal died(enemy: SkeletonEnemy)

enum State {
	PATROL,
	CHASE,
	ATTACK,
	HURT,
	DEAD,
}

const FRAME_SIZE := Vector2i(32, 32)
const IDLE_TEXTURE := "res://assets/characters/enemies/enemies-skeleton1_idle.png"
const MOVE_TEXTURE := "res://assets/characters/enemies/enemies-skeleton1_movement.png"
const ATTACK_TEXTURE := "res://assets/characters/enemies/enemies-skeleton1_attack.png"
const HURT_TEXTURE := "res://assets/characters/enemies/enemies-skeleton1_take_damage.png"
const DEATH_TEXTURE := "res://assets/characters/enemies/enemies-skeleton1_death.png"
const GOLDEN_ANGLE := 2.399963
const PATROL_TO_CHASE_SPEED_RATIO := 34.0 / 58.0
const DISENGAGE_TO_DETECTION_RATIO := 264.0 / 184.0

@export_category("Vitals")
@export_range(1, 999, 1) var max_health: int = 70
@export_range(0, 999, 1) var contact_damage: int = 14
@export_range(0, 9999, 1) var score_reward: int = 100

@export_category("Top-down movement")
@export_range(1.0, 300.0, 1.0) var patrol_speed: float = 34.0
@export_range(1.0, 400.0, 1.0) var chase_speed: float = 58.0
@export_range(8.0, 600.0, 1.0) var patrol_distance: float = 72.0
@export_range(8.0, 96.0, 1.0) var separation_radius: float = 26.0
@export_range(0.0, 160.0, 1.0) var separation_strength: float = 48.0

@export_category("Awareness")
@export_range(16.0, 500.0, 1.0) var detection_range: float = 184.0
@export_range(16.0, 700.0, 1.0) var disengage_range: float = 264.0
@export_range(8.0, 100.0, 1.0) var attack_range: float = 38.0
@export_range(0.1, 4.0, 0.05) var attack_cooldown: float = 0.85

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var body_collision: CollisionShape2D = %BodyCollision
@onready var attack_area: Area2D = %AttackArea
@onready var attack_collision: CollisionShape2D = %AttackCollision

var health: int
var _state: State = State.PATROL
var _spawn_position := Vector2.ZERO
var _patrol_target := Vector2.ZERO
var _patrol_angle := 0.0
var _patrol_step := 0
var _facing := Vector2.LEFT
var _target: Node2D
var _priority_target: Node2D
var _attack_has_hit := false
var _attack_cooldown_left := 0.0
var _hurt_lock_left := 0.0
var _obstacle_repath_left := 0.0
var _melee_threat_serial := 0


func configure_from_definition(snapshot: EnemyRuntimeSnapshot) -> bool:
	if snapshot == null or not snapshot.is_valid():
		return false
	max_health = maxi(1, roundi(snapshot.max_health))
	health = max_health
	contact_damage = maxi(0, roundi(snapshot.attack_damage))
	score_reward = maxi(0, snapshot.score_reward)
	chase_speed = maxf(0.0, snapshot.movement_speed)
	patrol_speed = chase_speed * PATROL_TO_CHASE_SPEED_RATIO
	attack_range = maxf(0.0, snapshot.attack_range)
	detection_range = maxf(attack_range, snapshot.awareness_range)
	disengage_range = detection_range * DISENGAGE_TO_DETECTION_RATIO
	attack_cooldown = maxf(0.01, snapshot.attack_cooldown_seconds)
	if is_inside_tree():
		health_changed.emit(health, max_health)
	return true


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	EnemyDifficultyScalerScript.capture_authored_damage_provenance(self)
	add_to_group(&"enemies")
	health = max_health
	_spawn_position = global_position
	_patrol_angle = deg_to_rad(float(get_instance_id() % 360))
	_choose_patrol_target()
	animated_sprite.sprite_frames = _build_sprite_frames()
	animated_sprite.animation_finished.connect(_on_animation_finished)
	_enter_state(State.PATROL)
	health_changed.emit(health, max_health)


func _physics_process(delta: float) -> void:
	_attack_cooldown_left = maxf(0.0, _attack_cooldown_left - delta)
	_hurt_lock_left = maxf(0.0, _hurt_lock_left - delta)
	_obstacle_repath_left = maxf(0.0, _obstacle_repath_left - delta)

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
		State.ATTACK:
			_update_attack(delta)
		State.HURT:
			velocity = velocity.move_toward(Vector2.ZERO, 360.0 * delta)

	move_and_slide()
	if _state == State.PATROL and get_slide_collision_count() > 0 and _obstacle_repath_left <= 0.0:
		_choose_patrol_target()
		_obstacle_repath_left = 0.35


func take_damage(amount: int, source_position: Vector2 = Vector2.ZERO) -> void:
	if amount <= 0 or _state == State.DEAD:
		return

	health = maxi(0, health - amount)
	health_changed.emit(health, max_health)
	if health <= 0:
		_enter_state(State.DEAD)
		return
	# Hurt lock suppresses repeated reaction animation/knockback, not confirmed
	# damage. Each weapon/effect owns its own per-instance target deduplication.
	if _hurt_lock_left > 0.0:
		return

	var knockback_direction := -_facing
	if source_position != Vector2.ZERO:
		knockback_direction = global_position.direction_to(source_position) * -1.0
	if knockback_direction.is_zero_approx():
		knockback_direction = Vector2.DOWN
	velocity = knockback_direction.normalized() * 130.0
	_hurt_lock_left = 0.18
	_enter_state(State.HURT)


func apply_stagger(amount: float, _context: Dictionary = {}) -> void:
	if amount <= 0.0 or _state == State.DEAD:
		return
	# The current enemy has no poise meter yet. Converting explicit stagger into
	# a bounded hurt lock preserves the contract without changing damage.
	_hurt_lock_left = maxf(_hurt_lock_left, clampf(amount * 0.012, 0.08, 0.55))
	velocity = velocity.move_toward(Vector2.ZERO, clampf(amount * 3.0, 12.0, 120.0))
	if _state != State.HURT:
		_enter_state(State.HURT)


## Defense encounters can nominate an authored objective without changing the
## default campaign AI. With no live priority target, every existing level still
## resolves the player exactly as before.
func set_priority_target(target: Node2D) -> void:
	_priority_target = target
	if is_instance_valid(_priority_target):
		_target = _priority_target
		_enter_state(State.CHASE)


func _update_patrol() -> void:
	if _can_detect_target(detection_range):
		_enter_state(State.CHASE)
		return

	if global_position.distance_to(_patrol_target) <= 8.0:
		_choose_patrol_target()
	var desired_direction := global_position.direction_to(_patrol_target)
	velocity = _steer_velocity(desired_direction * patrol_speed, patrol_speed)
	_set_facing(velocity)
	if animated_sprite.animation != &"move":
		animated_sprite.play(&"move")


func _update_chase() -> void:
	if not _can_detect_target(disengage_range):
		_choose_patrol_target()
		_enter_state(State.PATROL)
		return

	var target_offset := _target.global_position - global_position
	if target_offset.length() <= attack_range and _attack_cooldown_left <= 0.0:
		_set_facing(target_offset)
		_enter_state(State.ATTACK)
		return

	velocity = _steer_velocity(target_offset.normalized() * chase_speed, chase_speed)
	_set_facing(velocity)


func _update_attack(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 700.0 * delta)
	if not _attack_has_hit and animated_sprite.frame >= 4:
		_attack_has_hit = true
		_deal_attack_damage()


func _deal_attack_damage() -> void:
	if not is_instance_valid(_target) or not _target.has_method(&"take_damage"):
		return
	# A defended StaticBody can stop the CharacterBody at the exact edge where
	# Area2D overlap sampling flickers between two physics ticks. Distance is an
	# objective-only fallback; ordinary player combat still requires the authored
	# attack-area overlap.
	var objective_in_reach := (
		_target.is_in_group(&"defense_objective")
		and global_position.distance_to(_target.global_position) <= attack_range + 6.0
	)
	if (
		not attack_area.overlaps_body(_target)
		and not objective_in_reach
	) or not _has_line_of_sight(_target):
		return
	var hit := EnemyDifficultyScalerScript.apply_configured_damage_hit(
		self,
		_target,
		EnemyDifficultyScalerScript.PROPERTY_CONTACT_DAMAGE_CHANNEL,
		contact_damage,
		global_position,
	)
	if bool(hit.get("confirmed", false)):
		VfxCatalog.spawn(get_parent(), &"bone_impact", _target.global_position, _facing.angle(), 0.72, Color(0.84, 0.89, 0.82, 0.76), 10)


func _emit_melee_threat() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if not is_instance_valid(_target) or events == null or not events.has_signal(&"melee_threat_emitted"):
		return
	_melee_threat_serial += 1
	var threat_id := StringName("skeleton_%d_attack_%d" % [get_instance_id(), _melee_threat_serial])
	events.emit_signal(
		&"melee_threat_emitted",
		threat_id,
		self,
		_target,
		global_position,
		attack_range + 24.0
	)


func _steer_velocity(desired_velocity: Vector2, maximum_speed: float) -> Vector2:
	var steered_velocity := desired_velocity
	steered_velocity += _separation_direction() * separation_strength

	# Reuse collision normals from the previous move to slide around simple walls.
	# This keeps the enemy useful even when a level has no NavigationRegion2D.
	for collision_index: int in get_slide_collision_count():
		var collision := get_slide_collision(collision_index)
		var wall_normal := collision.get_normal()
		if steered_velocity.dot(wall_normal) < 0.0:
			var tangent := steered_velocity.slide(wall_normal)
			if tangent.length_squared() < 1.0:
				tangent = wall_normal.orthogonal() * maximum_speed
				if tangent.dot(_facing) < 0.0:
					tangent *= -1.0
			steered_velocity = tangent + wall_normal * 8.0

	return steered_velocity.limit_length(maximum_speed)


func _separation_direction() -> Vector2:
	var separation := Vector2.ZERO
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if candidate == self or not candidate is Node2D:
			continue
		var other := candidate as Node2D
		var offset := global_position - other.global_position
		var distance := offset.length()
		if distance <= 0.001:
			var split_direction := -1.0 if get_instance_id() < other.get_instance_id() else 1.0
			separation += Vector2(split_direction, 0.0)
			continue
		if distance >= separation_radius:
			continue
		separation += offset.normalized() * (1.0 - distance / separation_radius)
	return separation.limit_length(1.0)


func _choose_patrol_target() -> void:
	_patrol_step += 1
	_patrol_angle = fposmod(_patrol_angle + GOLDEN_ANGLE, TAU)
	var radius_ratio := 0.65 + float(_patrol_step % 4) * 0.1
	_patrol_target = (
		_spawn_position
		+ Vector2.from_angle(_patrol_angle) * patrol_distance * radius_ratio
	)


func _enter_state(next_state: State) -> void:
	if _state == State.DEAD and next_state != State.DEAD:
		return
	_state = next_state

	match _state:
		State.PATROL:
			animated_sprite.play(&"idle" if velocity.is_zero_approx() else &"move")
		State.CHASE:
			animated_sprite.play(&"move")
		State.ATTACK:
			_attack_has_hit = false
			_update_attack_transform()
			_emit_melee_threat()
			_emit_enemy_cue(&"sword_swing_2", {"enemy_id": &"skeleton_swordsman", "phase": &"attack"})
			attack_collision.set_deferred(&"disabled", false)
			animated_sprite.play(&"attack")
		State.HURT:
			attack_collision.set_deferred(&"disabled", true)
			animated_sprite.play(&"hurt")
		State.DEAD:
			velocity = Vector2.ZERO
			VfxCatalog.spawn(get_parent(), &"skeleton_death", global_position + Vector2(0.0, -8.0), 0.0, 1.0, Color(0.76, 0.86, 0.80, 0.84), 7)
			body_collision.set_deferred(&"disabled", true)
			attack_collision.set_deferred(&"disabled", true)
			attack_area.set_deferred(&"monitoring", false)
			animated_sprite.play(&"death")
			var session := get_node_or_null("/root/GameSession")
			if session != null and session.has_method(&"add_score"):
				session.call(&"add_score", score_reward)
			died.emit(self)


func _emit_enemy_cue(cue_id: StringName, context: Dictionary = {}) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"combat_cue_requested"):
		events.emit_signal(&"combat_cue_requested", cue_id, global_position, context)


func _on_animation_finished() -> void:
	match StringName(animated_sprite.animation):
		&"attack":
			attack_collision.set_deferred(&"disabled", true)
			_attack_cooldown_left = attack_cooldown
			_enter_state(State.CHASE if _can_detect_target(disengage_range) else State.PATROL)
		&"hurt":
			_enter_state(State.CHASE if _can_detect_target(disengage_range) else State.PATROL)
		&"death":
			queue_free()


func _set_facing(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_facing = direction.normalized()
	if absf(_facing.x) > 0.08:
		animated_sprite.flip_h = _facing.x > 0.0
	_update_attack_transform()


func _update_attack_transform() -> void:
	attack_area.position = _facing * 24.0
	attack_area.rotation = _facing.angle()


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


func _build_sprite_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	_add_strip(frames, &"idle", IDLE_TEXTURE, 6, 7.0, true)
	_add_strip(frames, &"move", MOVE_TEXTURE, 10, 10.0, true)
	_add_strip(frames, &"attack", ATTACK_TEXTURE, 9, 12.0, false)
	_add_strip(frames, &"hurt", HURT_TEXTURE, 5, 13.0, false)
	_add_strip(frames, &"death", DEATH_TEXTURE, 17, 12.0, false)
	return frames


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
		push_error("Skeleton animation texture is missing: %s" % texture_path)
		return
	frames.add_animation(animation_name)
	frames.set_animation_speed(animation_name, fps)
	frames.set_animation_loop(animation_name, looped)
	for frame_index: int in frame_count:
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(
			Vector2(frame_index * FRAME_SIZE.x, 0),
			Vector2(FRAME_SIZE)
		)
		frames.add_frame(animation_name, atlas)
