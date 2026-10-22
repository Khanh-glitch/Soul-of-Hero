class_name WizardSummonedEnemy
extends CharacterBody2D

const COMBAT_DAMAGE := preload("res://game/combat/combat_damage.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

var max_health := 1
var health := 1
var attack_damage := 1
var movement_speed := 54.0
var attack_cooldown := 0.9
var attack_range := 34.0

var _player: Node2D
var _target: Node2D
var _retarget_left := 0.0
var _attack_left := 0.0
var _visual: AnimatedSprite2D
var _spawn_offset := Vector2.ZERO


static func capture_snapshot(enemy: Node) -> Dictionary:
	if not is_instance_valid(enemy) or not enemy is Node2D:
		return {}
	var sprite := _find_animated_sprite(enemy)
	if sprite == null or sprite.sprite_frames == null:
		return {}
	var maximum := _numeric_property(enemy, [&"max_health", &"health"], 1.0)
	var damage := _numeric_property(
		enemy,
		[&"contact_damage", &"attack_damage", &"_attack_damage", &"damage"],
		1.0,
	)
	var profile_value: Variant = enemy.get(&"_profile") if _has_property(enemy, &"_profile") else {}
	if profile_value is Dictionary:
		damage = float((profile_value as Dictionary).get("damage", damage))
	var speed := _numeric_property(
		enemy,
		[&"chase_speed", &"movement_speed", &"_movement_speed", &"patrol_speed"],
		54.0,
	)
	var cooldown := _numeric_property(
		enemy,
		[&"attack_cooldown", &"_attack_cooldown", &"ability_cooldown"],
		0.9,
	)
	var reach := _numeric_property(
		enemy,
		[&"attack_range", &"_attack_range", &"preferred_min_distance"],
		34.0,
	)
	var idle_animation := &"idle"
	if not sprite.sprite_frames.has_animation(idle_animation):
		idle_animation = sprite.animation
	var move_animation := &"move"
	if not sprite.sprite_frames.has_animation(move_animation):
		move_animation = idle_animation
	var attack_animation := &"attack"
	if not sprite.sprite_frames.has_animation(attack_animation):
		attack_animation = move_animation
	return {
		"source_name": enemy.name,
		"position": (enemy as Node2D).global_position,
		"max_health": maxi(1, roundi(maximum * 0.20)),
		"attack_damage": maxi(1, roundi(damage)),
		"movement_speed": maxf(20.0, speed),
		"attack_cooldown": maxf(0.20, cooldown),
		"attack_range": clampf(reach, 24.0, 160.0),
		"sprite_frames": sprite.sprite_frames,
		"sprite_position": sprite.position,
		"sprite_scale": sprite.scale,
		"sprite_rotation": sprite.rotation,
		"sprite_flip_h": sprite.flip_h,
		"idle_animation": idle_animation,
		"move_animation": move_animation,
		"attack_animation": attack_animation,
	}


func setup(player: Node2D, snapshot: Dictionary) -> bool:
	if player == null or snapshot.is_empty() \
			or not snapshot.get("sprite_frames") is SpriteFrames:
		queue_free()
		return false
	_player = player
	name = "WizardSummon_%s" % String(snapshot.get("source_name", "Enemy"))
	global_position = snapshot.get("position", player.global_position) as Vector2
	max_health = maxi(1, int(snapshot.get("max_health", 1)))
	health = max_health
	attack_damage = maxi(1, int(snapshot.get("attack_damage", 1)))
	movement_speed = maxf(20.0, float(snapshot.get("movement_speed", 54.0)))
	attack_cooldown = maxf(0.20, float(snapshot.get("attack_cooldown", 0.9)))
	attack_range = clampf(float(snapshot.get("attack_range", 34.0)), 24.0, 160.0)
	_spawn_offset = Vector2.from_angle(float(get_instance_id() % 16) / 16.0 * TAU) * 42.0
	collision_layer = 2
	collision_mask = 1 | 4
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	add_to_group(&"wizard_summons")
	_build_visual(snapshot)
	_build_collision()
	set_physics_process(true)
	VfxCatalog.spawn(
		get_parent(),
		&"world_portal",
		global_position,
		0.0,
		0.72,
		Color(0.70, 0.20, 1.0, 0.86),
		11,
	)
	return true


func _physics_process(delta: float) -> void:
	if not is_instance_valid(_player):
		queue_free()
		return
	_attack_left = maxf(0.0, _attack_left - delta)
	_retarget_left -= delta
	if global_position.distance_to(_player.global_position) > 360.0:
		_release_target()
		global_position = _player.global_position + _spawn_offset
		velocity = Vector2.ZERO
		VfxCatalog.spawn(
			get_parent(), &"world_portal", global_position, 0.0, 0.52,
			Color(0.62, 0.16, 1.0, 0.72), 10,
		)
	if _retarget_left <= 0.0 or not CombatDamage.is_alive(_target):
		_retarget_left = 0.16
		_acquire_target()
	var destination := _player.global_position + _spawn_offset
	if CombatDamage.is_alive(_target):
		destination = _target.global_position
	var offset := destination - global_position
	if CombatDamage.is_alive(_target) and offset.length() <= attack_range:
		velocity = velocity.move_toward(Vector2.ZERO, 720.0 * delta)
		_play_visual(&"attack_animation")
		if _attack_left <= 0.0:
			_attack_left = attack_cooldown
			_attack_target()
	elif offset.length() > 16.0:
		velocity = offset.normalized() * movement_speed
		_face_direction(velocity)
		_play_visual(&"move_animation")
	else:
		velocity = velocity.move_toward(Vector2.ZERO, 640.0 * delta)
		_play_visual(&"idle_animation")
	move_and_slide()


func take_damage(amount: int, _source_position := Vector2.ZERO) -> void:
	if amount <= 0 or health <= 0:
		return
	health = maxi(0, health - amount)
	if is_instance_valid(_visual):
		_visual.modulate = Color(1.0, 0.46, 1.0, 0.96)
		var tween := create_tween()
		tween.tween_property(_visual, ^"modulate", Color(0.68, 0.24, 1.0, 0.84), 0.12)
	if health <= 0:
		_release_target()
		VfxCatalog.spawn(
			get_parent(), &"spectral_smoke", global_position, 0.0, 0.72,
			Color(0.70, 0.20, 1.0, 0.80), 10,
		)
		queue_free()


func apply_stagger(_amount: float, _context: Dictionary = {}) -> void:
	pass


func _acquire_target() -> void:
	var nearest: Node2D
	var best_distance := INF
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var distance := global_position.distance_squared_to((candidate as Node2D).global_position)
		if distance < best_distance:
			best_distance = distance
			nearest = candidate as Node2D
	if nearest == _target:
		return
	_release_target()
	_target = nearest
	if is_instance_valid(_target) and _target.has_method(&"set_priority_target"):
		_target.call(&"set_priority_target", self)


func _release_target() -> void:
	if is_instance_valid(_target) and _target.has_method(&"set_priority_target"):
		_target.call(&"set_priority_target", null)
	_target = null


func _attack_target() -> void:
	if not CombatDamage.is_alive(_target):
		return
	var confirmed := CombatDamage.apply_confirmed(
		_target,
		attack_damage,
		global_position,
		&"wizard_summon",
		{
			"hero_id": &"wizard_hero",
			"skill_id": &"wizard_raise_defeated",
			"action_track": &"ultimate",
			"cue_id": &"wizard_passage",
			"summoned_enemy": true,
		},
	)
	if confirmed:
		var game_session := get_node_or_null("/root/GameSession")
		if game_session != null and game_session.has_method(&"add_score"):
			game_session.call(&"add_score", attack_damage)
		VfxCatalog.spawn(
			get_parent(), &"echo_impact", _target.global_position, 0.0, 0.58,
			Color(0.72, 0.24, 1.0, 0.78), 12,
		)


func _build_visual(snapshot: Dictionary) -> void:
	var shadow := Polygon2D.new()
	shadow.z_index = -1
	shadow.position = Vector2(0.0, -1.0)
	shadow.color = Color(0.20, 0.02, 0.30, 0.42)
	shadow.polygon = PackedVector2Array([
		Vector2(-10.0, -3.0), Vector2(10.0, -3.0), Vector2(12.0, 0.0),
		Vector2(10.0, 3.0), Vector2(-10.0, 3.0), Vector2(-12.0, 0.0),
	])
	add_child(shadow)
	_visual = AnimatedSprite2D.new()
	_visual.name = "ReanimatedVisual"
	_visual.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_visual.sprite_frames = snapshot.get("sprite_frames") as SpriteFrames
	_visual.position = snapshot.get("sprite_position", Vector2(0.0, -24.0)) as Vector2
	_visual.scale = snapshot.get("sprite_scale", Vector2.ONE) as Vector2
	_visual.rotation = float(snapshot.get("sprite_rotation", 0.0))
	_visual.flip_h = bool(snapshot.get("sprite_flip_h", false))
	_visual.modulate = Color(0.68, 0.24, 1.0, 0.84)
	_visual.set_meta(&"idle_animation", snapshot.get("idle_animation", &"idle"))
	_visual.set_meta(&"move_animation", snapshot.get("move_animation", &"move"))
	_visual.set_meta(&"attack_animation", snapshot.get("attack_animation", &"attack"))
	add_child(_visual)
	_play_visual(&"idle_animation")


func _build_collision() -> void:
	var collision := CollisionShape2D.new()
	var shape := CapsuleShape2D.new()
	shape.radius = 7.0
	shape.height = 18.0
	collision.position = Vector2(0.0, -7.0)
	collision.shape = shape
	add_child(collision)


func _play_visual(meta_key: StringName) -> void:
	if not is_instance_valid(_visual):
		return
	var animation := StringName(_visual.get_meta(meta_key, &"idle"))
	if _visual.sprite_frames.has_animation(animation) \
			and (_visual.animation != animation or not _visual.is_playing()):
		_visual.play(animation)


func _face_direction(direction: Vector2) -> void:
	if is_instance_valid(_visual) and absf(direction.x) > 0.05:
		_visual.flip_h = direction.x > 0.0


static func _find_animated_sprite(root: Node) -> AnimatedSprite2D:
	if root is AnimatedSprite2D:
		return root as AnimatedSprite2D
	for child: Node in root.get_children():
		var found := _find_animated_sprite(child)
		if found != null:
			return found
	return null


static func _numeric_property(target: Object, names: Array[StringName], fallback: float) -> float:
	for name_value: StringName in names:
		if not _has_property(target, name_value):
			continue
		var value: Variant = target.get(name_value)
		if value is int or value is float:
			return float(value)
	return fallback


static func _has_property(target: Object, property_name: StringName) -> bool:
	for property: Dictionary in target.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return true
	return false
