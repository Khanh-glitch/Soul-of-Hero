class_name SwordSoulEchoEffect
extends Node2D

## Runtime effect for Sword's permanent Active Skill: Soul Echo.
##
## The Sword controller remains authoritative over the real four-hit combo and
## cooldown. This node only mirrors eligible resolved attacks after the
## configured delay. Call `setup()` with the first combo step that is still
## eligible, then call `queue_combo_attack()` once when each original attack is
## committed. `cancel()` is the explicit hook for combo reset and Soul Relay.

signal activated(first_mirrored_step: int, duration_seconds: float)
signal combo_timer_refresh_requested(continuation_seconds: float)
signal combo_timer_suspension_changed(suspended: bool)
signal echo_attack_started(combo_step: int, context: Dictionary)
signal echo_hit_confirmed(target: Node, damage: int, context: Dictionary)
signal echo_attack_resolved(combo_step: int, hit_count: int, context: Dictionary)
signal audio_cue_requested(cue_id: StringName, world_position: Vector2, context: Dictionary)
signal completed(reason: StringName)

const DEFAULT_WAVE_SCENE: PackedScene = preload("res://game/heroes/sword/sword_echo_wave.tscn")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")
const KNightRules := preload("res://game/heroes/sword/k_night_rules.gd")
const ECHO_DAMAGE_SOURCE: StringName = &"sword_soul_echo"
const SWORD_COMBAT_SOURCE: StringName = &"sword_hero"
const MAX_QUERY_RESULTS := 32
const COMBO_STEP_COUNT := 4
const MOVEMENT_GHOST_INTERVAL_SECONDS := 0.075
const MOVEMENT_GHOST_LIFETIME_SECONDS := 0.18
const MOVEMENT_GHOST_MINIMUM_TRAVEL := 3.0
const MOVEMENT_GHOST_TELEPORT_CUTOFF := 48.0

@export_flags_2d_physics var enemy_collision_mask := 4
@export_flags_2d_physics var world_collision_mask := 1
@export_range(1.0, 48.0, 1.0) var safe_probe_radius := 8.0
@export_range(1.0, 64.0, 1.0) var hitbox_width := 18.0
@export_range(2, 32, 1) var maximum_trail_points := 14
# Retained for scene compatibility. Runtime audio is asset-backed through the
# GameEvents router; Soul Echo never synthesizes a local waveform.
@export var play_procedural_audio_fallback := false

@onready var _echo_visual: Node2D = $EchoVisual
@onready var _echo_sprite: AnimatedSprite2D = $EchoVisual/Sprite
@onready var _trail: Line2D = $Trail
@onready var _sfx_player: AudioStreamPlayer2D = $Sfx

var _source: WeakRef
var _source_sprite: WeakRef
var _definition: Resource
var _definition_properties: Dictionary = {}
var _first_mirrored_step := 1
var _duration_remaining := 0.0
var _persistent_enhancement := false
var _configured := false
var _ending := false
var _activation_emitted := false
var _queued_steps: Dictionary = {}
var _attack_instance_serial := 0
var _rank_profile: Dictionary = {}
var _movement_ghost_cooldown := 0.0
var _movement_ghost_serial := 0
var _last_source_position := Vector2.ZERO
var _has_source_position_sample := false


func _ready() -> void:
	# The root remains at world zero. EchoVisual and Trail therefore share stable
	# world-space coordinates while the spectral body moves through the scene.
	top_level = true
	global_position = Vector2.ZERO
	_echo_visual.visible = false
	_trail.visible = false
	if _configured:
		_apply_definition_visuals()
		_emit_activation_contract()


## `first_mirrored_step` means the next attack which Soul Echo may copy. For
## example, activating after Combo 2 should pass 3; the already-finished steps
## are rejected even if a stale event arrives later.
func setup(
		source: Node2D,
		definition: Resource,
		first_mirrored_step := 1
) -> bool:
	if source == null or definition == null:
		queue_free()
		return false
	_source = weakref(source)
	_source_sprite = weakref(_find_animated_sprite(source))
	_last_source_position = source.global_position
	_has_source_position_sample = true
	_definition = definition
	_cache_definition_properties()
	_first_mirrored_step = clampi(first_mirrored_step, 1, COMBO_STEP_COUNT)
	_persistent_enhancement = bool(_def_value(&"active_skill_toggle_persistent", false))
	_duration_remaining = (
		0.0
		if _persistent_enhancement
		else maxf(_def_float(&"soul_echo_duration_seconds", 4.0), 0.1)
	)
	_configured = true
	_ending = false
	if is_inside_tree():
		_apply_definition_visuals()
		_emit_activation_contract()
	return true


## The equipment instance owns rank/count/timing. This remains a separate call
## so older scene and test fixtures using setup(source, definition, step) keep
## working while K-Night receives the exact selected-weapon profile.
func configure_rank_profile(profile: Dictionary) -> void:
	_rank_profile = profile.duplicate(true)
	if _rank_profile.has("duration"):
		_persistent_enhancement = false
		_duration_remaining = maxf(0.1, float(_rank_profile["duration"]))


## Queues one mirrored attack. Context is deliberately extensible so the Sword
## controller can pass exact authored positions without this effect importing
## or owning the controller:
##   target / primary_target / pursuit_target: Node2D
##   origin / attack_origin: Vector2
##   direction / attack_direction / facing: Vector2
##   fallback: bool (Combo 4 directional fallback)
##   animation_name: StringName (optional visual override)
func queue_combo_attack(
		combo_step: int,
		original_damage: int,
		context: Dictionary = {}
) -> bool:
	if not is_active() or combo_step < _first_mirrored_step or combo_step > COMBO_STEP_COUNT:
		return false
	if original_damage <= 0:
		return false
	var afterimage_count := clampi(int(_rank_profile.get("afterimage_count", 1)), 1, 3)
	var ratio := float(_rank_profile.get(
		"afterimage_ratio",
		_damage_ratio_for_step(combo_step),
	))
	var base_delay := maxf(0.0, float(_rank_profile.get(
		"afterimage_interval",
		_delay_for_step(combo_step),
	)))
	var source_attack_id := int(context.get("attack_instance_id", 0))
	var queue_root := "%d:%d" % [source_attack_id, combo_step]
	if _queued_steps.has(queue_root):
		return false
	_queued_steps[queue_root] = afterimage_count
	for afterimage_index: int in afterimage_count:
		var echo_damage := maxi(1, roundi(float(original_damage) * ratio))
		var echo_context := context.duplicate(true)
		_attack_instance_serial += 1
		var queue_key := "%s:%d" % [queue_root, afterimage_index]
		echo_context["hero_id"] = _def_string_name(&"hero_id", &"sword_hero")
		echo_context["skill_id"] = StringName(_rank_profile.get("id", &"soul_echo"))
		echo_context["attack_kind"] = &"soul_echo_mirror"
		echo_context["echo_attack_instance_id"] = _attack_instance_serial
		echo_context["combo_step"] = combo_step
		echo_context["original_damage"] = original_damage
		echo_context["echo_damage_ratio"] = ratio
		echo_context["echo_damage"] = echo_damage
		echo_context["is_echo"] = true
		echo_context["cue_id"] = &"soul_echo_hit"
		echo_context["combo_count"] = combo_step
		echo_context["combo_window_seconds"] = _def_float(&"combo_continuation_seconds", 2.0)
		echo_context["impact_strength"] = [0.80, 0.95, 1.15, 1.65][combo_step - 1]
		echo_context["creates_marks"] = false
		echo_context["grants_invulnerability"] = false
		echo_context["afterimage_index"] = afterimage_index
		echo_context["afterimage_count"] = afterimage_count
		echo_context["afterimage_color"] = KNightRules.AFTERIMAGE_COLORS[
			mini(afterimage_index, KNightRules.AFTERIMAGE_COLORS.size() - 1)
		]
		echo_context["remote_approach"] = bool(_rank_profile.get("remote_approach", false))
		echo_context["approach_mode"] = (
			&"target_rear"
			if bool(echo_context["remote_approach"])
			else &"source_replay"
		)
		_run_delayed_attack(
			combo_step,
			echo_damage,
			echo_context,
			base_delay * float(afterimage_index + 1),
			queue_root,
		)
	return true


## Alias kept intentionally semantic for a controller that dispatches resolved
## attack events rather than thinking in terms of a queue.
func mirror_attack(combo_step: int, original_damage: int, context: Dictionary = {}) -> bool:
	return queue_combo_attack(combo_step, original_damage, context)


func notify_combo_forced_reset() -> void:
	cancel(&"combo_forced_reset")


func notify_soul_relay_started() -> void:
	cancel(&"soul_relay")


func cancel(reason: StringName = &"cancelled") -> void:
	_finish(reason)


func is_active() -> bool:
	return _configured and not _ending \
		and (_persistent_enhancement or _duration_remaining > 0.0)


func remaining_duration() -> float:
	return INF if _persistent_enhancement and is_active() else maxf(_duration_remaining, 0.0)


func first_mirrored_combo_step() -> int:
	return _first_mirrored_step


func _process(delta: float) -> void:
	if not is_active():
		return
	var source := _source.get_ref() as Node2D if _source != null else null
	if source == null:
		_finish(&"owner_lost")
		return
	if _source_is_dead(source):
		_finish(&"sword_died")
		return
	_tick_movement_afterimages(source, delta)
	if not _persistent_enhancement:
		_duration_remaining -= delta
		if _duration_remaining <= 0.0:
			_finish(&"duration_expired")


func _run_delayed_attack(
		combo_step: int,
		damage: int,
		context: Dictionary,
		delay: float,
		queue_root := "",
) -> void:
	if delay > 0.0:
		await get_tree().create_timer(delay, false).timeout
	if not is_active():
		return

	var attack_context := context.duplicate(true)
	attack_context["echo_delay_seconds"] = delay
	echo_attack_started.emit(combo_step, attack_context)
	_request_audio(_cue_for_step(combo_step), _context_origin(attack_context), attack_context)

	var hit_count := 0
	match combo_step:
		1:
			hit_count = await _perform_opening_slash(damage, attack_context)
		2:
			hit_count = await _perform_opposite_cross(damage, attack_context)
		3:
			hit_count = await _perform_wave_and_recoil(damage, attack_context)
		4:
			hit_count = await _perform_x_execution(damage, attack_context)
	if not is_active():
		return
	echo_attack_resolved.emit(combo_step, hit_count, attack_context)
	if not queue_root.is_empty() and _queued_steps.has(queue_root):
		var outstanding := int(_queued_steps[queue_root]) - 1
		if outstanding <= 0:
			_queued_steps.erase(queue_root)
		else:
			_queued_steps[queue_root] = outstanding
	if combo_step == COMBO_STEP_COUNT and _persistent_enhancement:
		_first_mirrored_step = 1


func _perform_opening_slash(damage: int, context: Dictionary) -> int:
	var direction := _context_direction(context)
	var local_start := _correct_safe_position(_context_origin(context), -direction)
	var local_finish := _correct_safe_position(
		local_start + direction * _def_float(&"soul_echo_slash_lunge_distance", 9.0),
		direction,
	)
	var path := _resolved_echo_path(local_start, local_finish, context)
	var start := path[0]
	var finish := path[1]
	direction = start.direction_to(finish)
	context["echo_start"] = start
	context["echo_end"] = finish
	context["echo_direction"] = direction
	var duration := _def_float(&"soul_echo_slash_visual_seconds", 0.15)
	var tween := _begin_visual_path(1, start, finish, direction, duration, context)
	await get_tree().create_timer(duration * 0.42, false).timeout
	if not is_active():
		return 0
	var reach := _def_float(&"soul_echo_hitbox_reach", 38.0)
	var hit_count := _damage_box(start, direction, reach, hitbox_width, damage, context)
	await tween.finished
	_finish_attack_visual()
	return hit_count


func _perform_opposite_cross(damage: int, context: Dictionary) -> int:
	var origin := _context_origin(context)
	var target := _resolve_target(context, origin)
	var target_position := target.global_position if target != null else origin + _context_direction(context) * _def_float(&"soul_echo_hitbox_reach", 38.0)
	var direction := _context_direction(context, target_position)
	var local_start := _correct_safe_position(origin, -direction)
	var target_distance := origin.distance_to(target_position)
	var lunge_distance := clampf(
		target_distance + _def_float(&"soul_echo_slash_lunge_distance", 9.0),
		_def_float(&"soul_echo_hitbox_reach", 38.0) * 0.72,
		_def_float(&"soul_echo_combo_2_cross_distance", 58.0),
	)
	var local_finish := _correct_safe_position(
		local_start + direction * lunge_distance,
		direction,
	)
	var path := _resolved_echo_path(local_start, local_finish, context)
	var start := path[0]
	var finish := path[1]
	var path_direction := start.direction_to(finish)
	context["target"] = target
	context["target_position"] = target_position
	context["echo_start"] = start
	context["echo_end"] = finish
	context["echo_direction"] = path_direction
	context["replays_source_lunge"] = not _is_remote_context(context)
	var duration := _def_float(&"soul_echo_cross_visual_seconds", 0.19)
	var tween := _begin_visual_path(2, start, finish, path_direction, duration, context)
	await get_tree().create_timer(duration * 0.46, false).timeout
	if not is_active():
		return 0
	var hit_count := _damage_segment(start, finish, hitbox_width, damage, context)
	await tween.finished
	_finish_attack_visual()
	return hit_count


func _perform_wave_and_recoil(damage: int, context: Dictionary) -> int:
	var origin := _context_origin(context)
	var target := _resolve_target(context, origin)
	var target_position := target.global_position if target != null else origin + _context_direction(context) * 32.0
	var direction := _context_direction(context, target_position)
	var local_start := _correct_safe_position(origin, -direction)
	var recoil_distance := _def_float(&"soul_echo_recoil_distance", 16.0)
	var local_finish := _correct_safe_position(
		local_start - direction * recoil_distance,
		-direction,
	)
	var path := _resolved_echo_path(local_start, local_finish, context)
	var start := path[0]
	var finish := path[1]
	if _is_remote_context(context):
		direction = start.direction_to(finish)
	context["target"] = target
	context["target_position"] = target_position
	context["echo_start"] = start
	context["echo_end"] = finish
	context["echo_direction"] = direction
	context["mirrors_recoil"] = true
	var duration := _def_float(&"soul_echo_recoil_visual_seconds", 0.20)
	var visual_tween := _begin_visual_path(3, start, finish, direction, duration, context)
	var wave_scene := _def_packed_scene(&"soul_echo_wave_scene")
	if wave_scene == null:
		wave_scene = DEFAULT_WAVE_SCENE
	var wave := wave_scene.instantiate() as SwordEchoWave if wave_scene != null else null
	if wave == null:
		await get_tree().create_timer(duration * 0.45, false).timeout
		var fallback_hits := _damage_box(start, direction, _def_float(&"soul_echo_hitbox_reach", 38.0), hitbox_width, damage, context)
		await visual_tween.finished
		_finish_attack_visual()
		return fallback_hits

	add_child(wave)
	var wave_state := {"done": false, "hits": 0}
	wave.hit_confirmed.connect(_on_wave_hit_confirmed)
	wave.completed.connect(func(hit_count: int) -> void:
		wave_state["hits"] = hit_count
		wave_state["done"] = true
	)
	wave.enemy_collision_mask = enemy_collision_mask
	wave.setup(
		_source.get_ref() as Node2D,
		start + direction * 5.0,
		direction,
		damage,
		context,
		_def_float(&"soul_echo_wave_speed", 360.0),
		_def_float(&"soul_echo_wave_distance", 112.0),
		_def_float(&"soul_echo_wave_width", 18.0),
		_def_color(&"soul_echo_tint", Color(1.0, 0.99, 0.93, 0.72)),
		_def_color(&"soul_echo_trail_tint", Color(1.0, 1.0, 1.0, 0.32))
	)
	while is_active() and not bool(wave_state["done"]):
		await get_tree().physics_frame
	if visual_tween.is_valid() and visual_tween.is_running():
		await visual_tween.finished
	_finish_attack_visual()
	return int(wave_state["hits"])


func _perform_x_execution(damage: int, context: Dictionary) -> int:
	var origin := _context_origin(context)
	var target := _resolve_target(context, origin)
	var fallback := bool(context.get("fallback", false)) or target == null
	var direction := _context_direction(context, target.global_position if target != null else origin + Vector2.RIGHT)
	var safe_offset := _def_float(&"soul_echo_safe_offset", 26.0)
	var local_start: Vector2
	var local_finish: Vector2

	if fallback:
		var distance := _def_float(&"soul_echo_fallback_distance", _def_float(&"soul_echo_hitbox_reach", 38.0) * 1.65)
		local_start = _correct_safe_position(origin, -direction)
		local_finish = _correct_safe_position(
			local_start + direction * distance,
			direction,
		)
		context["fallback"] = true
		context["fallback_mirrored"] = false
	else:
		var target_position := target.global_position
		local_start = _correct_safe_position(origin, -direction)
		var dash_distance := maxf(
			origin.distance_to(target_position) + safe_offset * 0.35,
			_def_float(&"soul_echo_execution_distance", maxf(safe_offset * 1.75, 44.0)),
		)
		local_finish = _correct_safe_position(
			local_start + direction * dash_distance,
			direction,
		)
		context["target"] = target
		context["target_position"] = target_position
		context["replays_source_execution"] = true

	var path := _resolved_echo_path(local_start, local_finish, context)
	var start := path[0]
	var finish := path[1]
	var path_direction := (finish - start).normalized()
	context["echo_start"] = start
	context["echo_end"] = finish
	context["echo_direction"] = path_direction
	var duration := _def_float(&"soul_echo_execution_visual_seconds", 0.22)
	var tween := _begin_visual_path(4, start, finish, path_direction, duration, context)
	await get_tree().create_timer(duration * 0.48, false).timeout
	if not is_active():
		return 0
	var hit_count := _damage_segment(start, finish, hitbox_width * 1.15, damage, context)
	await tween.finished
	_finish_attack_visual()
	return hit_count


func _begin_visual_path(
		combo_step: int,
		start: Vector2,
		finish: Vector2,
		direction: Vector2,
		duration: float,
		context: Dictionary
) -> Tween:
	# One clean anchor and one short ribbon frame the delayed mirrored body. The
	# caller has already resolved either the source replay or target-rear path,
	# keeping presentation and hit detection on the same authored movement.
	var visual_tint: Color = context.get(
		"afterimage_color",
		_def_color(&"soul_echo_tint", Color(1.0, 0.99, 0.93, 0.72)),
	)
	VfxCatalog.spawn(
		_vfx_parent(),
		_def_string_name(&"soul_echo_anchor_vfx_id", &"echo_anchor"),
		start + Vector2(0.0, -8.0),
		0.0,
		0.84,
		visual_tint,
		7
	)
	VfxCatalog.spawn(
		_vfx_parent(),
		_def_string_name(&"soul_echo_ribbon_vfx_id", &"echo_ribbon"),
		(start + finish) * 0.5 + Vector2(0.0, -8.0),
		direction.angle(),
		clampf(start.distance_to(finish) / 48.0, 0.72, 1.35),
		Color(_def_color(&"soul_echo_trail_tint", Color(1.0, 1.0, 1.0, 0.32)), 0.56),
		8
	)
	_copy_source_visual(combo_step, context)
	var silhouette_material := _echo_sprite.material as ShaderMaterial
	if silhouette_material != null:
		silhouette_material.set_shader_parameter(&"echo_color", visual_tint)
	else:
		_echo_sprite.modulate = visual_tint
	_trail.clear_points()
	_trail.modulate.a = 1.0
	_trail.visible = true
	_echo_visual.visible = true
	_set_visual_world_position(start)
	_face_visual(direction)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_QUAD)
	tween.set_ease(Tween.EASE_IN_OUT)
	# EchoVisual itself is the one delayed spectral attacker. Do not create a
	# second chain of frozen body snapshots: that obscures which silhouette owns
	# the mirrored hit and makes the configured attack delay hard to read.
	tween.tween_method(_set_visual_world_position, start, finish, maxf(duration, 0.04))
	return tween


func _resolved_echo_path(
		local_start: Vector2,
		local_finish: Vector2,
		context: Dictionary,
) -> PackedVector2Array:
	if not _is_remote_context(context):
		var direction := local_start.direction_to(local_finish)
		if direction.is_zero_approx():
			direction = _context_direction(context)
		# A small parallel offset keeps the white body readable next to K-Night
		# without turning this local replay into Hư Ảnh's target-crossing dash.
		var side := _mirror_side(context, direction)
		var replay_offset := (
			-direction * 6.0
			+ direction.orthogonal() * side * 3.0
		)
		var replay_start := _correct_safe_position(
			local_start + replay_offset,
			-direction,
		)
		var replay_finish := _correct_safe_position(
			local_finish + replay_offset,
			direction,
		)
		context["source_replay_start"] = replay_start
		context["source_replay_end"] = replay_finish
		context["source_replay_offset"] = replay_offset
		return PackedVector2Array([replay_start, replay_finish])
	return _remote_approach_path(local_start, local_finish, context)


func _is_remote_context(context: Dictionary) -> bool:
	return bool(context.get("remote_approach", false))


func _tick_movement_afterimages(source: Node2D, delta: float) -> void:
	if bool(_rank_profile.get("remote_approach", false)):
		_last_source_position = source.global_position
		_has_source_position_sample = true
		return
	if not _has_source_position_sample:
		_last_source_position = source.global_position
		_has_source_position_sample = true
		return
	_movement_ghost_cooldown = maxf(
		0.0,
		_movement_ghost_cooldown - maxf(0.0, delta),
	)
	var travel := _last_source_position.distance_to(source.global_position)
	if travel > MOVEMENT_GHOST_TELEPORT_CUTOFF:
		_last_source_position = source.global_position
		_movement_ghost_cooldown = MOVEMENT_GHOST_INTERVAL_SECONDS
		return
	if travel < MOVEMENT_GHOST_MINIMUM_TRAVEL \
			or _movement_ghost_cooldown > 0.0:
		return
	_spawn_movement_ghost(source, _last_source_position)
	_last_source_position = source.global_position
	_movement_ghost_cooldown = MOVEMENT_GHOST_INTERVAL_SECONDS


func _spawn_movement_ghost(source: Node2D, sampled_source_position: Vector2) -> void:
	var source_sprite := _source_sprite.get_ref() as AnimatedSprite2D \
		if _source_sprite != null else null
	if source_sprite == null:
		source_sprite = _find_animated_sprite(source)
		if source_sprite == null:
			return
		_source_sprite = weakref(source_sprite)
	var ghost := AnimatedSprite2D.new()
	ghost.name = "MovementAfterimage"
	ghost.sprite_frames = source_sprite.sprite_frames
	ghost.animation = source_sprite.animation
	ghost.frame = source_sprite.frame
	ghost.frame_progress = source_sprite.frame_progress
	ghost.pause()
	ghost.centered = source_sprite.centered
	ghost.offset = source_sprite.offset
	ghost.flip_h = source_sprite.flip_h
	ghost.flip_v = source_sprite.flip_v
	ghost.texture_filter = source_sprite.texture_filter
	ghost.z_index = 6
	var source_delta := sampled_source_position - source.global_position
	ghost.position = source_sprite.global_position + source_delta
	ghost.rotation = source_sprite.global_rotation
	ghost.scale = source_sprite.global_scale
	var afterimage_count := clampi(
		int(_rank_profile.get("afterimage_count", 1)),
		1,
		KNightRules.AFTERIMAGE_COLORS.size(),
	)
	var tint: Color = KNightRules.AFTERIMAGE_COLORS[
		_movement_ghost_serial % afterimage_count
	]
	_movement_ghost_serial += 1
	var material := _echo_sprite.material.duplicate() as ShaderMaterial \
		if _echo_sprite.material != null else null
	if material != null:
		material.set_shader_parameter(
			&"echo_color",
			Color(tint.r, tint.g, tint.b, minf(tint.a, 0.42)),
		)
		ghost.material = material
	else:
		ghost.modulate = Color(tint.r, tint.g, tint.b, 0.42)
	add_child(ghost)
	var tween := ghost.create_tween()
	tween.set_parallel(true)
	tween.tween_property(
		ghost,
		"modulate:a",
		0.0,
		MOVEMENT_GHOST_LIFETIME_SECONDS,
	).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(
		ghost,
		"scale",
		ghost.scale * Vector2(0.97, 1.02),
		MOVEMENT_GHOST_LIFETIME_SECONDS,
	).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.chain().tween_callback(ghost.queue_free)


func _remote_approach_path(
		fallback_start: Vector2,
		fallback_finish: Vector2,
		context: Dictionary,
) -> PackedVector2Array:
	var target := _resolve_target(context, fallback_start)
	if target == null:
		return PackedVector2Array([fallback_start, fallback_finish])
	var source := _source.get_ref() as Node2D if _source != null else null
	var toward_source := target.global_position.direction_to(
		source.global_position if source != null else fallback_start
	)
	if toward_source.is_zero_approx():
		toward_source = Vector2.RIGHT
	var count := maxi(1, int(context.get("afterimage_count", 1)))
	var index := int(context.get("afterimage_index", 0))
	var centered := float(index) - float(count - 1) * 0.5
	var spread := deg_to_rad(centered * 32.0)
	# Travel from the far side of the target back toward K-Night. This is the
	# defining silhouette of Hư Ảnh and never applies to Linh Hồn Chiến Binh.
	var approach := toward_source.rotated(spread).normalized()
	var distance := _def_float(&"soul_echo_execution_distance", 58.0)
	var start := _correct_safe_position(
		target.global_position - approach * distance,
		-approach,
	)
	var finish := _correct_safe_position(
		target.global_position + approach * distance * 0.45,
		approach,
	)
	context["remote_start"] = start
	context["remote_end"] = finish
	return PackedVector2Array([start, finish])


func _finish_attack_visual() -> void:
	if not is_instance_valid(_echo_visual):
		return
	_echo_visual.visible = false
	if is_instance_valid(_trail):
		_trail.visible = false
		_trail.clear_points()


func _set_visual_world_position(world_position: Vector2) -> void:
	if not is_instance_valid(_echo_visual):
		return
	_echo_visual.position = world_position
	if not is_instance_valid(_trail):
		return
	if _trail.get_point_count() == 0 or _trail.get_point_position(_trail.get_point_count() - 1).distance_to(world_position) >= 2.0:
		_trail.add_point(world_position)
	while _trail.get_point_count() > maximum_trail_points:
		_trail.remove_point(0)

func _copy_source_visual(combo_step: int, context: Dictionary) -> void:
	var source := _source.get_ref() as Node2D if _source != null else null
	var source_sprite := _source_sprite.get_ref() as AnimatedSprite2D if _source_sprite != null else null
	if source_sprite == null and source != null:
		source_sprite = _find_animated_sprite(source)
		_source_sprite = weakref(source_sprite)
	if source_sprite != null:
		_echo_sprite.sprite_frames = source_sprite.sprite_frames
		_echo_sprite.position = source_sprite.position
		_echo_sprite.scale = source_sprite.scale
		_echo_sprite.rotation = source_sprite.rotation
		_echo_sprite.flip_h = source_sprite.flip_h
		_echo_sprite.flip_v = source_sprite.flip_v
		_echo_sprite.offset = source_sprite.offset
		_echo_sprite.centered = source_sprite.centered
	var animation := _animation_for_step(combo_step, context)
	if _echo_sprite.sprite_frames != null and _echo_sprite.sprite_frames.has_animation(animation):
		_echo_sprite.play(animation)
	elif source_sprite != null and source_sprite.sprite_frames != null and source_sprite.sprite_frames.has_animation(source_sprite.animation):
		_echo_sprite.play(source_sprite.animation)
	_echo_visual.rotation = source.global_rotation if source != null else 0.0
	_echo_visual.scale = source.global_scale if source != null else Vector2.ONE


func _face_visual(direction: Vector2) -> void:
	if direction.is_zero_approx():
		return
	_echo_sprite.flip_h = direction.x < 0.0


func _damage_box(
		origin: Vector2,
		direction: Vector2,
		reach: float,
		width: float,
		damage: int,
		context: Dictionary
) -> int:
	var normalized := direction.normalized() if not direction.is_zero_approx() else Vector2.RIGHT
	var start := origin
	var finish := origin + normalized * maxf(reach, 1.0)
	return _damage_segment(start, finish, width, damage, context)


func _damage_segment(
		start: Vector2,
		finish: Vector2,
		width: float,
		damage: int,
		context: Dictionary
) -> int:
	var segment := finish - start
	if segment.length_squared() <= 0.0001 or damage <= 0 or get_world_2d() == null:
		return 0
	var sweep := RectangleShape2D.new()
	sweep.size = Vector2(segment.length() + width, maxf(width, 1.0))
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = sweep
	query.transform = Transform2D(segment.angle(), (start + finish) * 0.5)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]

	var hit_count := 0
	var hit_ids: Dictionary = {}
	for result: Dictionary in get_world_2d().direct_space_state.intersect_shape(query, MAX_QUERY_RESULTS):
		var target := result.get("collider") as Node
		if target == null:
			continue
		var target_id := target.get_instance_id()
		if hit_ids.has(target_id):
			continue
		hit_ids[target_id] = true
		var hit_context := context.duplicate(true)
		hit_context["hit_position"] = (start + finish) * 0.5
		hit_context["hitbox_start"] = start
		hit_context["hitbox_end"] = finish
		hit_context["damage_source"] = ECHO_DAMAGE_SOURCE
		if not CombatDamage.apply_confirmed(target, damage, start, SWORD_COMBAT_SOURCE, hit_context):
			continue
		hit_count += 1
		echo_hit_confirmed.emit(target, damage, hit_context)
	return hit_count


func _resolve_target(context: Dictionary, origin: Vector2) -> Node2D:
	for key: String in ["pursuit_target", "primary_target", "target"]:
		var candidate := context.get(key) as Node2D
		if candidate != null and CombatDamage.is_alive(candidate):
			return candidate
	if get_world_2d() == null:
		return null
	var radius := _def_float(&"soul_echo_targeting_range", 128.0)
	var shape := CircleShape2D.new()
	shape.radius = radius
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = shape
	query.transform = Transform2D(0.0, origin)
	query.collision_mask = enemy_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	var source := _source.get_ref() as CollisionObject2D if _source != null else null
	if source != null:
		query.exclude = [source.get_rid()]
	var best: Node2D
	var best_distance_squared := INF
	for result: Dictionary in get_world_2d().direct_space_state.intersect_shape(query, MAX_QUERY_RESULTS):
		var candidate := result.get("collider") as Node2D
		if candidate == null or not CombatDamage.is_alive(candidate):
			continue
		var distance_squared := origin.distance_squared_to(candidate.global_position)
		if distance_squared < best_distance_squared:
			best = candidate
			best_distance_squared = distance_squared
	return best


func _correct_safe_position(desired: Vector2, preference: Vector2) -> Vector2:
	if _position_is_safe(desired):
		return desired
	var direction := preference.normalized() if not preference.is_zero_approx() else Vector2.RIGHT
	var perpendicular := direction.orthogonal()
	var offset := _def_float(&"soul_echo_safe_offset", 26.0)
	var candidates := PackedVector2Array([
		desired + perpendicular * offset * 0.5,
		desired - perpendicular * offset * 0.5,
		desired - direction * offset * 0.5,
		desired + direction * offset * 0.5,
		desired + perpendicular * offset,
		desired - perpendicular * offset,
	])
	for candidate: Vector2 in candidates:
		if _position_is_safe(candidate):
			return candidate
	var source := _source.get_ref() as Node2D if _source != null else null
	if source != null and _position_is_safe(source.global_position):
		return source.global_position
	# The Echo is non-solid, so keeping the authored location is safer than
	# moving the real Sword or silently cancelling the mirrored attack.
	return desired


func _position_is_safe(position: Vector2) -> bool:
	if world_collision_mask == 0 or get_world_2d() == null:
		return true
	var probe := CircleShape2D.new()
	probe.radius = safe_probe_radius
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = probe
	query.transform = Transform2D(0.0, position)
	query.collision_mask = world_collision_mask
	query.collide_with_bodies = true
	query.collide_with_areas = false
	return get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()


func _context_origin(context: Dictionary) -> Vector2:
	for key: String in ["attack_origin", "origin", "source_position"]:
		var value: Variant = context.get(key)
		if value is Vector2:
			return value
	var source := _source.get_ref() as Node2D if _source != null else null
	return source.global_position if source != null else Vector2.ZERO


func _context_direction(context: Dictionary, target_position := Vector2.INF) -> Vector2:
	for key: String in ["attack_direction", "direction", "facing"]:
		var value: Variant = context.get(key)
		if value is Vector2 and not (value as Vector2).is_zero_approx():
			return (value as Vector2).normalized()
	if target_position != Vector2.INF:
		var toward_target := target_position - _context_origin(context)
		if not toward_target.is_zero_approx():
			return toward_target.normalized()
	return Vector2.RIGHT


func _mirror_side(context: Dictionary, direction: Vector2) -> float:
	var authored := float(context.get("mirror_side", 0.0))
	if not is_zero_approx(authored):
		return signf(authored)
	return -1.0 if direction.x < 0.0 else 1.0


func _damage_ratio_for_step(combo_step: int) -> float:
	if _rank_profile.has("afterimage_ratio"):
		return clampf(float(_rank_profile["afterimage_ratio"]), 0.01, 2.0)
	var ratios: Variant = _def_value(&"soul_echo_damage_ratios", [])
	if ratios is Array and ratios.size() >= combo_step:
		return clampf(float(ratios[combo_step - 1]), 0.01, 1.0)
	return [0.45, 0.45, 0.50, 0.60][combo_step - 1]


func _delay_for_step(combo_step: int) -> float:
	if _rank_profile.has("afterimage_interval"):
		return maxf(0.0, float(_rank_profile["afterimage_interval"]))
	var delays: Variant = _def_value(&"soul_echo_delays", [])
	if delays is Array and delays.size() >= combo_step:
		return maxf(float(delays[combo_step - 1]), 0.0)
	return [0.11, 0.13, 0.15, 0.08][combo_step - 1]


func _cue_for_step(combo_step: int) -> StringName:
	var cues: Variant = _def_value(&"soul_echo_attack_cues", [])
	if cues is Array and cues.size() >= combo_step:
		return StringName(cues[combo_step - 1])
	return StringName("soul_echo_attack_%d" % combo_step)


func _animation_for_step(combo_step: int, context: Dictionary) -> StringName:
	var override: Variant = context.get("animation_name")
	if override is String or override is StringName:
		return StringName(override)
	var animations: Variant = _def_value(&"combo_animation_names", [])
	if animations is Array and animations.size() >= combo_step:
		return StringName(animations[combo_step - 1])
	return &"attack"


func _on_wave_hit_confirmed(target: Node, damage: int, context: Dictionary) -> void:
	echo_hit_confirmed.emit(target, damage, context)


func _apply_definition_visuals() -> void:
	var tint := _def_color(&"soul_echo_tint", Color(1.0, 0.99, 0.93, 0.72))
	var trail_tint := _def_color(&"soul_echo_trail_tint", Color(1.0, 1.0, 1.0, 0.32))
	var silhouette_material := _echo_sprite.material as ShaderMaterial
	if silhouette_material != null:
		silhouette_material.set_shader_parameter(&"echo_color", tint)
	else:
		# Scene overrides can still provide a normal material without breaking the
		# effect; they simply fall back to an ordinary white tint.
		_echo_sprite.modulate = tint
	_trail.default_color = trail_tint


func _emit_activation_contract() -> void:
	if _activation_emitted or not _configured:
		return
	_activation_emitted = true
	activated.emit(_first_mirrored_step, _duration_remaining)
	combo_timer_refresh_requested.emit(_def_float(&"combo_continuation_seconds", 2.0))
	combo_timer_suspension_changed.emit(true)
	var source := _source.get_ref() as Node2D if _source != null else null
	var position := source.global_position if source != null else Vector2.ZERO
	VfxCatalog.spawn(
		_vfx_parent(),
		_def_string_name(&"soul_echo_anchor_vfx_id", &"echo_anchor"),
		position + Vector2(0.0, -8.0),
		0.0,
		0.82,
		_def_color(&"soul_echo_tint", Color(1.0, 0.99, 0.93, 0.72)),
		7
	)
	_request_audio(_def_string_name(&"soul_echo_activate_cue", &"soul_echo_activate"), position, {
		"hero_id": _def_string_name(&"hero_id", &"sword_hero"),
		"skill_id": &"soul_echo",
		"phase": &"activate",
	})


func _request_audio(cue_id: StringName, world_position: Vector2, context: Dictionary) -> void:
	if cue_id.is_empty():
		return
	audio_cue_requested.emit(cue_id, world_position, context)
	var event_bus := _event_bus()
	if event_bus != null and event_bus.has_signal(&"combat_cue_requested"):
		var argument_count := _signal_argument_count(event_bus, &"combat_cue_requested")
		if argument_count == 3:
			event_bus.emit_signal(&"combat_cue_requested", cue_id, world_position, context)
		elif argument_count == 2:
			event_bus.emit_signal(&"combat_cue_requested", cue_id, world_position)


func _finish(reason: StringName) -> void:
	if _ending:
		return
	_ending = true
	_configured = false
	_persistent_enhancement = false
	_duration_remaining = 0.0
	if is_instance_valid(_echo_visual) and _echo_visual.visible:
		VfxCatalog.spawn(
			_vfx_parent(),
			&"smoke_puff",
			_echo_visual.position,
			0.0,
			0.62,
			Color(1.0, 0.98, 0.90, 0.38),
			7
		)
	if _activation_emitted:
		combo_timer_suspension_changed.emit(false)
	_finish_attack_visual()
	if is_instance_valid(_sfx_player):
		_sfx_player.stop()
	completed.emit(reason)
	queue_free()


func _vfx_parent() -> Node:
	var parent := get_parent()
	return parent if parent != null else self


func _find_animated_sprite(root: Node) -> AnimatedSprite2D:
	if root is AnimatedSprite2D:
		return root as AnimatedSprite2D
	var named := root.get_node_or_null("Sprite") as AnimatedSprite2D
	if named != null:
		return named
	for child: Node in root.get_children():
		var found := _find_animated_sprite(child)
		if found != null:
			return found
	return null


func _source_is_dead(source: Node) -> bool:
	var dead_value: Variant = _object_property(source, &"dead", false)
	if dead_value is bool and dead_value:
		return true
	var health_value: Variant = _object_property(source, &"health", null)
	return (health_value is int or health_value is float) and float(health_value) <= 0.0


func _cache_definition_properties() -> void:
	_definition_properties.clear()
	if _definition == null:
		return
	for property: Dictionary in _definition.get_property_list():
		_definition_properties[StringName(property.get("name", &""))] = true


func _def_value(property_name: StringName, fallback: Variant) -> Variant:
	if _definition == null or not _definition_properties.has(property_name):
		return fallback
	return _definition.get(property_name)


func _def_float(property_name: StringName, fallback: float) -> float:
	var value: Variant = _def_value(property_name, fallback)
	return float(value) if value is int or value is float else fallback


func _def_color(property_name: StringName, fallback: Color) -> Color:
	var value: Variant = _def_value(property_name, fallback)
	return value as Color if value is Color else fallback


func _def_string_name(property_name: StringName, fallback: StringName) -> StringName:
	var value: Variant = _def_value(property_name, fallback)
	return StringName(value) if value is String or value is StringName else fallback


func _def_packed_scene(property_name: StringName) -> PackedScene:
	var value: Variant = _def_value(property_name, null)
	return value as PackedScene if value is PackedScene else null


func _object_property(object: Object, property_name: StringName, fallback: Variant) -> Variant:
	for property: Dictionary in object.get_property_list():
		if StringName(property.get("name", &"")) == property_name:
			return object.get(property_name)
	return fallback


func _event_bus() -> Node:
	if get_tree() == null:
		return null
	return get_tree().root.get_node_or_null("GameEvents")


func _signal_argument_count(object: Object, signal_name: StringName) -> int:
	for signal_data: Dictionary in object.get_signal_list():
		if StringName(signal_data.get("name", &"")) == signal_name:
			var arguments: Array = signal_data.get("args", [])
			return arguments.size()
	return -1
