extends SceneTree

const ECHO_SCENE: PackedScene = preload("res://game/heroes/sword/sword_soul_echo.tscn")
const SWORD: HeroDefinition = preload("res://game/heroes/data/sword_hero.tres")


class SwordOwner:
	extends CharacterBody2D

	var health := 100

	func _init() -> void:
		collision_layer = 2
		collision_mask = 0
		var shape := CollisionShape2D.new()
		var body_shape := RectangleShape2D.new()
		body_shape.size = Vector2(10.0, 14.0)
		shape.shape = body_shape
		add_child(shape)
		var sprite := AnimatedSprite2D.new()
		sprite.name = "Sprite"
		var frames := SpriteFrames.new()
		frames.add_animation(&"attack")
		frames.add_animation(&"combo_attack")
		frames.add_animation(&"heavy_attack")
		sprite.sprite_frames = frames
		add_child(sprite)


class EchoTarget:
	extends CharacterBody2D

	var max_health := 300
	var health := 300

	func _init() -> void:
		collision_layer = 4
		collision_mask = 0
		var shape := CollisionShape2D.new()
		var body_shape := RectangleShape2D.new()
		body_shape.size = Vector2(12.0, 16.0)
		shape.shape = body_shape
		add_child(shape)

	func take_damage(amount: int, _source_position := Vector2.ZERO) -> bool:
		health -= amount
		return true


var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var stage := Node2D.new()
	get_root().add_child(stage)
	var owner := SwordOwner.new()
	var target := EchoTarget.new()
	owner.global_position = Vector2.ZERO
	target.global_position = Vector2(24.0, 0.0)
	stage.add_child(owner)
	stage.add_child(target)
	await physics_frame

	_expect(SWORD.validate().is_empty(), "approved Sword Hero data validates with enhancement enabled")
	_expect(SWORD.active_skill_enabled and SWORD.active_skill_name == "Cường Hóa Linh Hồn" and SWORD.active_skill_toggle_persistent, "the persistent enhancement is the enabled Sword skill")
	_expect(SWORD.soul_echo_scene == ECHO_SCENE, "Sword data owns the Soul Echo visual/effect reference")
	_expect(SWORD.soul_echo_damage_ratios == [0.45, 0.45, 0.50, 0.60], "all four Echo damage ratios are data-driven")

	var echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(echo)
	echo.world_collision_mask = 0
	var suspension_events: Array[bool] = []
	var timer_refreshes: Array[float] = []
	var completed_reasons: Array[StringName] = []
	var audio_cues: Array[StringName] = []
	var hit_contexts: Array[Dictionary] = []
	var presentation_contexts: Array[Dictionary] = []
	echo.combo_timer_suspension_changed.connect(func(suspended: bool) -> void: suspension_events.append(suspended))
	echo.combo_timer_refresh_requested.connect(func(seconds: float) -> void: timer_refreshes.append(seconds))
	echo.completed.connect(func(reason: StringName) -> void: completed_reasons.append(reason))
	echo.audio_cue_requested.connect(func(cue_id: StringName, _position: Vector2, _context: Dictionary) -> void: audio_cues.append(cue_id))
	echo.echo_hit_confirmed.connect(func(_target: Node, _damage: int, context: Dictionary) -> void: hit_contexts.append(context.duplicate(true)))
	var event_bus := get_root().get_node_or_null("GameEvents")
	if event_bus != null:
		event_bus.connect(&"combat_hit_confirmed", func(_target: Node, _damage: int, _position: Vector2, context: Dictionary) -> void: presentation_contexts.append(context.duplicate(true)))
	_expect(echo.setup(owner, SWORD, 1), "Soul Echo accepts a live Sword owner and approved data resource")
	_expect(timer_refreshes.size() == 1 and is_equal_approx(timer_refreshes[0], 2.0), "activation immediately requests the authored two-second combo refresh")
	_expect(suspension_events == [true], "activation requests suspension of the normal combo reset timer")
	_expect(is_inf(echo.remaining_duration()) and echo.first_mirrored_combo_step() == 1, "persistent duration and eligible combo step come from the activation contract")
	var echo_sprite := echo.get_node("EchoVisual/Sprite") as AnimatedSprite2D
	var echo_material := echo_sprite.material as ShaderMaterial
	var echo_color: Variant = (
		echo_material.get_shader_parameter(&"echo_color")
		if echo_material != null
		else echo_sprite.modulate
	)
	_expect(
		echo_color is Color
		and (echo_color as Color).a > 0.25
		and (echo_color as Color).a < 0.85
		and minf((echo_color as Color).r, minf((echo_color as Color).g, (echo_color as Color).b)) > 0.90,
		"afterimage visual is a distinctly translucent white silhouette"
	)
	_expect(echo.get_node("Trail") is Line2D and echo.get_node("Sfx") is AudioStreamPlayer2D, "Echo owns a distinct trail and SFX emitter")

	var health_before := target.health
	_expect(echo.queue_combo_attack(1, 100, {
		"target": target,
		"origin": owner.global_position,
		"direction": Vector2.RIGHT,
	}), "Combo 1 queues a delayed second slash")
	_expect(not echo.queue_combo_attack(1, 100), "one original attack cannot create duplicate Echo hits")
	await create_timer(0.38, false).timeout
	_expect(target.health == health_before - 45, "Combo 1 Echo applies the configured 45 percent through CombatDamage")
	_expect(not hit_contexts.is_empty() and bool(hit_contexts[0].get("is_echo", false)), "confirmed damage publishes rich Echo context")
	_expect(int(hit_contexts[0].get("echo_attack_instance_id", 0)) > 0, "each mirrored attack publishes its own instance ID")
	_expect(not bool(hit_contexts[0].get("creates_marks", true)) and not bool(hit_contexts[0].get("grants_invulnerability", true)), "Echo explicitly grants neither marks nor invulnerability")
	_expect(not presentation_contexts.is_empty() and StringName(presentation_contexts[0].get("cue_id", &"")) == &"soul_echo_hit", "CombatDamage routes Echo hits into the distinct central feedback cue")
	_expect(bool(presentation_contexts[0].get("is_echo", false)) and int(presentation_contexts[0].get("combo_count", 0)) == 1, "central feedback receives cyan Echo styling and combo metadata")

	var wave_target := EchoTarget.new()
	wave_target.global_position = Vector2(54.0, 0.0)
	stage.add_child(wave_target)
	await physics_frame
	var wave_health_before := wave_target.health
	_expect(echo.queue_combo_attack(3, 100, {
		"target": wave_target,
		"origin": owner.global_position,
		"direction": Vector2.RIGHT,
	}), "Combo 3 queues a second spectral sword wave")
	await create_timer(0.62, false).timeout
	_expect(wave_target.health == wave_health_before - 50, "Combo 3 wave sweeps enemies once at its configured 50 percent")

	var combo_four_target := EchoTarget.new()
	combo_four_target.global_position = Vector2(30.0, 2.0)
	stage.add_child(combo_four_target)
	await physics_frame
	_expect(echo.queue_combo_attack(4, 100, {
		"target": combo_four_target,
		"origin": owner.global_position,
		"direction": Vector2.RIGHT,
	}), "Combo 4 queues the opposite-side X execution")
	await create_timer(0.52, false).timeout
	_expect(combo_four_target.health == 240, "Combo 4 Echo applies the configured 60 percent execution damage")
	_expect(completed_reasons.is_empty() and echo.is_active(), "the enhancement remains active after Combo 4 resolves")
	_expect(suspension_events == [true], "persistent enhancement keeps the combo timer suspended")
	_expect(audio_cues.has(&"soul_echo_activate") and audio_cues.has(&"soul_echo_execution"), "activation and authored per-step SFX cues are requested")
	echo.cancel(&"manual_toggle")
	_expect(completed_reasons == [&"manual_toggle"] and suspension_events == [true, false], "manual cancellation ends the enhancement and releases combo suspension")

	var fallback_echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(fallback_echo)
	fallback_echo.world_collision_mask = 0
	_expect(fallback_echo.setup(owner, SWORD, 4), "a late activation can expose only the remaining fourth step")
	_expect(not fallback_echo.queue_combo_attack(3, 100), "stale attacks before the eligible step are rejected")
	var fallback_contexts: Array[Dictionary] = []
	fallback_echo.echo_attack_started.connect(func(_step: int, context: Dictionary) -> void: fallback_contexts.append(context))
	_expect(fallback_echo.queue_combo_attack(4, 100, {
		"origin": owner.global_position,
		"direction": Vector2.UP,
		"fallback": true,
	}), "directional Combo 4 fallback is mirrored without a target")
	await create_timer(0.52, false).timeout
	_expect(not fallback_contexts.is_empty() and bool(fallback_contexts[0].get("fallback", false)), "fallback intent remains explicit through resolution")
	fallback_echo.cancel(&"test_cleanup")

	var reset_echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(reset_echo)
	var reset_reasons: Array[StringName] = []
	reset_echo.completed.connect(func(reason: StringName) -> void: reset_reasons.append(reason))
	reset_echo.setup(owner, SWORD, 2)
	reset_echo.notify_combo_forced_reset()
	_expect(reset_reasons == [&"combo_forced_reset"], "a forced normal-combo reset immediately ends Soul Echo")

	var relay_echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(relay_echo)
	var relay_reasons: Array[StringName] = []
	relay_echo.completed.connect(func(reason: StringName) -> void: relay_reasons.append(reason))
	relay_echo.setup(owner, SWORD, 2)
	relay_echo.notify_soul_relay_started()
	_expect(relay_reasons == [&"soul_relay"], "replacing Sword through Soul Relay immediately ends Soul Echo")

	var death_echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(death_echo)
	var death_reasons: Array[StringName] = []
	death_echo.completed.connect(func(reason: StringName) -> void: death_reasons.append(reason))
	death_echo.setup(owner, SWORD, 2)
	owner.health = 0
	await process_frame
	await process_frame
	_expect(death_reasons == [&"sword_died"], "Sword death is detected without granting protection from Soul Echo")
	owner.health = 100

	var short_definition := SWORD.duplicate(true) as HeroDefinition
	short_definition.active_skill_toggle_persistent = false
	short_definition.soul_echo_duration_seconds = 0.1
	var duration_echo := ECHO_SCENE.instantiate() as SwordSoulEchoEffect
	stage.add_child(duration_echo)
	var duration_reasons: Array[StringName] = []
	duration_echo.completed.connect(func(reason: StringName) -> void: duration_reasons.append(reason))
	duration_echo.setup(owner, short_definition, 2)
	await create_timer(0.18, false).timeout
	_expect(duration_reasons == [&"duration_expired"], "configured Soul Echo duration expires cleanly")

	stage.queue_free()
	if _failures.is_empty():
		print("SOUL ECHO EFFECT TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("FAIL  " + failure)
		print("SOUL ECHO EFFECT TEST FAILED — %d/%d checks failed" % [_failures.size(), _checks])
		quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
