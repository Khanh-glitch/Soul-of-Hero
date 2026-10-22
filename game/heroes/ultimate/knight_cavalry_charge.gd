class_name KnightCavalryCharge
extends Node2D

signal target_hit(target: Node, damage: int)

const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const ATTACK_FRAMES: Array[Texture2D] = [
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_1.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_2.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_3.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_4.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_5.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_6.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_7.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_8.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_9.png"),
	preload("res://assets/characters/knight/cavalry/attack/Knight_attack_new_10.png"),
]

@export_range(120.0, 800.0, 1.0) var charge_speed := 390.0
@export_range(24.0, 160.0, 1.0) var formation_half_width := 54.0
@export_range(32.0, 240.0, 1.0) var formation_length := 96.0
@export_range(300.0, 20000.0, 10.0) var maximum_travel_distance := 12000.0

const FORMATION_464: Array[Vector2] = [
	# Fourteen riders stay inside the original formation hitbox. Front/rear rows
	# align while the denser six-rider middle row remains staggered.
	Vector2(16.0, -36.0), Vector2(16.0, -12.0),
	Vector2(16.0, 12.0), Vector2(16.0, 36.0),
	Vector2(-13.0, -50.0), Vector2(-13.0, -30.0), Vector2(-13.0, -10.0),
	Vector2(-13.0, 10.0), Vector2(-13.0, 30.0), Vector2(-13.0, 50.0),
	Vector2(-42.0, -36.0), Vector2(-42.0, -12.0),
	Vector2(-42.0, 12.0), Vector2(-42.0, 36.0),
]
const FORMATION_NOSE_X := 44.0
const AFTERIMAGE_INTERVAL := 0.045

var _source: WeakRef
var _direction := Vector2.RIGHT
var _damage := 1
var _distance_travelled := 0.0
var _hit_targets: Dictionary = {}
var _pushed_targets: Dictionary = {}
var _pushed_lateral_offsets: Dictionary = {}
var _contact_states: Dictionary = {}
var _configured := false
var _frames: SpriteFrames
var _riders: Array[AnimatedSprite2D] = []
var _afterimage_remaining := 0.0
var _last_advance := 0.0
var _rider_count := FORMATION_464.size()
var _maximum_damage_ticks := KNightRules.LEGION_DAMAGE_TICKS


func _ready() -> void:
	add_to_group(&"knight_cavalry")
	top_level = true
	z_index = 14
	set_physics_process(_configured)


func setup(
		source: Node2D,
		origin: Vector2,
		direction: Vector2,
		damage: int,
		rider_count: int = 14,
		damage_ticks: int = 1,
) -> bool:
	if source == null or direction.is_zero_approx() or damage <= 0:
		queue_free()
		return false
	_source = weakref(source)
	_direction = direction.normalized()
	_damage = damage
	_rider_count = clampi(rider_count, 1, 15)
	_maximum_damage_ticks = clampi(damage_ticks, 1, KNightRules.LEGION_DAMAGE_TICKS)
	if _rider_count != FORMATION_464.size():
		formation_half_width = 30.0 + float(_rider_count) * 3.0
	global_position = origin - _direction * 30.0
	rotation = _direction.angle()
	_build_spectral_formation()
	_configured = true
	set_physics_process(true)
	VfxCatalog.spawn(
		get_parent(),
		&"world_portal",
		origin,
		_direction.angle(),
		1.05,
		Color(0.30, 0.012, 0.018, 0.90),
		12,
	)
	return true


func _physics_process(delta: float) -> void:
	if not _configured or delta <= 0.0:
		return
	var advance := charge_speed * delta
	_last_advance = advance
	global_position += _direction * advance
	_distance_travelled += advance
	_afterimage_remaining -= delta
	if _afterimage_remaining <= 0.0:
		_spawn_black_afterimages()
		_afterimage_remaining = AFTERIMAGE_INTERVAL
	_capture_crossed_enemies()
	_push_captured_targets(delta)
	if _distance_travelled >= maximum_travel_distance:
		queue_free()


func _capture_crossed_enemies() -> void:
	if get_tree() == null:
		return
	for candidate: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not candidate is Node2D or not CombatDamage.is_alive(candidate):
			continue
		var target := candidate as Node2D
		var target_id := target.get_instance_id()
		if _hit_targets.has(target_id):
			continue
		var local_target := to_local(target.global_position)
		# Damage and capture happen only at the advancing nose. Extending the rear
		# edge by this frame's travel prevents tunnelling during a slow frame.
		if local_target.x < FORMATION_NOSE_X - maxf(12.0, _last_advance) \
				or local_target.x > FORMATION_NOSE_X + 18.0 \
				or absf(local_target.y) > formation_half_width:
			continue
		_hit_targets[target_id] = true
		_pushed_targets[target_id] = candidate
		_pushed_lateral_offsets[target_id] = clampf(
			local_target.y,
			-formation_half_width + 4.0,
			formation_half_width - 4.0,
		)
		_contact_states[target_id] = {
			"elapsed": 0.0,
			"next_tick": 0.0,
			"ticks": 0,
		}
		VfxCatalog.spawn(
			get_parent(),
			&"echo_impact",
			target.global_position,
			_direction.angle(),
			1.10,
			Color(0.38, 0.018, 0.025, 0.92),
			15,
		)


func _push_captured_targets(delta: float) -> void:
	for target_id: Variant in _pushed_targets.keys():
		var target := _pushed_targets.get(target_id) as Node2D
		if not is_instance_valid(target) or not CombatDamage.is_alive(target):
			_release_pushed_target(target_id)
			continue
		var state: Dictionary = _contact_states.get(target_id, {})
		var elapsed := float(state.get("elapsed", 0.0))
		var next_tick := float(state.get("next_tick", 0.0))
		var ticks := int(state.get("ticks", 0))
		while ticks < _maximum_damage_ticks and elapsed + 0.0001 >= next_tick:
			if not _apply_target_tick(target, ticks):
				break
			ticks += 1
			next_tick += KNightRules.LEGION_TICK_SECONDS
		state["ticks"] = ticks
		state["next_tick"] = next_tick
		if not CombatDamage.is_alive(target):
			_release_pushed_target(target_id)
			continue
		var lateral := float(_pushed_lateral_offsets.get(target_id, 0.0))
		var side := _direction.orthogonal()
		var nose_position := global_position + _direction * FORMATION_NOSE_X + side * lateral
		var motion := nose_position - target.global_position
		var blocked := false
		if target is CharacterBody2D:
			var body := target as CharacterBody2D
			body.velocity = motion / maxf(delta, 0.001)
			blocked = body.move_and_collide(motion) != null
		else:
			target.global_position = nose_position
		if blocked:
			if target is CharacterBody2D:
				(target as CharacterBody2D).velocity = Vector2.ZERO
			var stun_seconds := KNightRules.wall_stun_seconds(elapsed)
			CombatDamage.apply_stun(target, stun_seconds, {
				"hero_id": &"sword_hero",
				"skill_id": &"k_night_underworld_legion",
				"wall_impact": true,
				"contact_seconds": elapsed,
			})
			_release_pushed_target(target_id)
			continue
		elapsed += delta
		state["elapsed"] = elapsed
		_contact_states[target_id] = state
func _apply_target_tick(target: Node2D, tick_index: int) -> bool:
	var base_tick := _damage / _maximum_damage_ticks
	var remainder := _damage % _maximum_damage_ticks
	var tick_damage := base_tick + (1 if tick_index < remainder else 0)
	if tick_damage <= 0:
		return true
	var context := {
		"hero_id": &"sword_hero",
		"skill_id": &"k_night_underworld_legion",
		"action_track": &"ultimate",
		"damage_tick": tick_index + 1,
		"damage_tick_count": _maximum_damage_ticks,
		"cue_id": &"combo_finisher" if tick_index == _maximum_damage_ticks - 1 else &"sword_hit",
		"impact_strength": 2.2 if tick_index == _maximum_damage_ticks - 1 else 1.15,
	}
	if not CombatDamage.apply_confirmed(
		target,
		tick_damage,
		target.global_position - _direction * 20.0,
		&"knight_cavalry",
		context,
	):
		return false
	target_hit.emit(target, tick_damage)
	return true


func _release_pushed_target(target_id: Variant) -> void:
	_pushed_targets.erase(target_id)
	_pushed_lateral_offsets.erase(target_id)
	_contact_states.erase(target_id)


func _build_spectral_formation() -> void:
	_frames = SpriteFrames.new()
	_frames.remove_animation(&"default")
	_frames.add_animation(&"charge")
	_frames.set_animation_speed(&"charge", 15.0)
	_frames.set_animation_loop(&"charge", true)
	for texture: Texture2D in ATTACK_FRAMES:
		_frames.add_frame(&"charge", texture)
	var rider_positions := _formation_positions(_rider_count)
	for rider_index: int in rider_positions.size():
		var sprite := AnimatedSprite2D.new()
		sprite.name = "SpectralRider%02d" % (rider_index + 1)
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.sprite_frames = _frames
		sprite.animation = &"charge"
		sprite.position = rider_positions[rider_index]
		sprite.scale = Vector2.ONE * (1.04 + float(rider_index % 3) * 0.035)
		sprite.modulate = Color(0.34, 0.025, 0.035, 0.88)
		var formation_row := 1 if _rider_count == 1 else (0 if rider_index < 4 else (1 if rider_index < 10 else 2))
		sprite.z_index = 4 - formation_row
		var material := CanvasItemMaterial.new()
		material.blend_mode = CanvasItemMaterial.BLEND_MODE_MIX
		sprite.material = material
		add_child(sprite)
		_riders.append(sprite)
		sprite.frame = (rider_index * 3) % ATTACK_FRAMES.size()
		sprite.play()


func _formation_positions(count: int) -> Array[Vector2]:
	var positions: Array[Vector2] = []
	if count == FORMATION_464.size():
		positions.assign(FORMATION_464)
		return positions
	if count <= 1:
		positions.append(Vector2.ZERO)
		return positions
	# Symmetric spearhead. Extra riders widen the formation rather than stacking
	# on top of one another, so every requested rank reads cleanly in motion.
	var row_counts: Array[int]
	match count:
		5: row_counts = [2, 3]
		7: row_counts = [2, 3, 2]
		9: row_counts = [3, 3, 3]
		12: row_counts = [3, 5, 4]
		15: row_counts = [4, 6, 5]
		_: row_counts = [count]
	for row_index: int in row_counts.size():
		var row_count := row_counts[row_index]
		var x := 18.0 - float(row_index) * 29.0
		var spacing := 20.0
		for column: int in row_count:
			var y := (float(column) - float(row_count - 1) * 0.5) * spacing
			positions.append(Vector2(x, y))
	return positions


func _spawn_black_afterimages() -> void:
	if get_parent() == null or not _is_near_view():
		return
	for rider: AnimatedSprite2D in _riders:
		if not is_instance_valid(rider):
			continue
		var texture := rider.sprite_frames.get_frame_texture(rider.animation, rider.frame)
		if texture == null:
			continue
		var echo := Sprite2D.new()
		echo.name = "CavalryBlackAfterimage"
		echo.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		echo.texture = texture
		echo.modulate = Color(0.008, 0.002, 0.003, 0.70)
		echo.z_index = 11
		get_parent().add_child(echo)
		# Assign the world transform after parenting so it cannot inherit the
		# charge node's rotation a second time.
		echo.global_transform = rider.global_transform
		var tween := echo.create_tween()
		tween.set_parallel(true)
		tween.tween_property(echo, "modulate:a", 0.0, 0.62)
		tween.tween_property(echo, "scale", echo.scale * 0.94, 0.62)
		tween.set_parallel(false)
		tween.tween_callback(echo.queue_free)


func _is_near_view() -> bool:
	if get_viewport() == null:
		return true
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return true
	var viewport_size := get_viewport_rect().size / camera.zoom
	var visible_world := Rect2(
		camera.get_screen_center_position() - viewport_size * 0.5,
		viewport_size,
	).grow(formation_length + 96.0)
	return visible_world.has_point(global_position)


func _exit_tree() -> void:
	for target: Variant in _pushed_targets.values():
		if target is CharacterBody2D and is_instance_valid(target):
			(target as CharacterBody2D).velocity = Vector2.ZERO
