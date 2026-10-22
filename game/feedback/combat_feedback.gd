class_name CombatFeedback
extends Node

const DamageNumberScene: PackedScene = preload("res://game/feedback/pixel_damage_number.tscn")
const ImpactBurstScript := preload("res://game/feedback/impact_burst.gd")

@onready var world_effects: Node2D = $WorldEffects
@onready var overlay_flash: ColorRect = $PresentationLayer/OverlayFlash
@onready var combo_counter: ComboHitCounter = $PresentationLayer/ComboHitCounter

var _settings := {
	"screen_shake": 0.8,
	"damage_numbers": true,
	"reduced_flashes": false,
	"reduced_motion": false,
}
var _hit_stop_active := false
var _hit_stop_until_msec := 0
var _time_scale_before_hit_stop := 1.0
var _shake_camera: Camera2D
var _shake_base_offset := Vector2.ZERO
var _shake_until_msec := 0
var _shake_started_msec := 0
var _shake_amplitude := 0.0
var _overlay_until_msec := 0
var _overlay_duration_msec := 1
var _overlay_color := Color.TRANSPARENT


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load_settings()
	_connect_services()
	overlay_flash.color = Color.TRANSPARENT


func _exit_tree() -> void:
	_restore_time_scale()
	_restore_camera()
	_disconnect_services()


func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec()
	if _hit_stop_active and now >= _hit_stop_until_msec:
		_restore_time_scale()
	_update_shake(now)
	_update_overlay(now)


func present_confirmed_hit(
		target: Node,
		actual_amount: int,
		world_position: Vector2,
		context: Dictionary = {}
) -> void:
	if bool(context.get("suppress_feedback", false)):
		return
	var strength := clampf(float(context.get(
		"impact_strength",
		0.65 + minf(float(actual_amount) / 45.0, 1.35)
	)), 0.2, 3.0)
	var presentation := context.duplicate(true)
	presentation["impact_strength"] = strength
	_enrich_impact_context(target, world_position, presentation)
	if bool(_settings.get("damage_numbers", true)) and bool(presentation.get("show_damage_number", true)):
		var damage_number := DamageNumberScene.instantiate() as PixelDamageNumber
		world_effects.add_child(damage_number)
		damage_number.configure(actual_amount, world_position, presentation)
	if bool(presentation.get("show_impact", true)):
		var impact := ImpactBurstScript.new() as CombatImpactBurst
		world_effects.add_child(impact)
		impact.configure(world_position, presentation)
	_apply_hit_stop(float(presentation.get("hit_stop_seconds", 0.018 + strength * 0.012)))
	_apply_camera_shake(strength, float(presentation.get("shake_seconds", 0.08 + strength * 0.035)))
	_apply_overlay(presentation, strength)
	var explicit_combo := int(presentation.get("combo_count", 0))
	combo_counter.register_confirmed_hit(
		explicit_combo,
		float(presentation.get("combo_window_seconds", 2.0))
	)
	# Keep the parameter in the public contract: future target-aware feedback can
	# attach status icons without changing the event signature.
	if target == null:
		return


func _enrich_impact_context(target: Node, world_position: Vector2, presentation: Dictionary) -> void:
	if not presentation.has("impact_material") and is_instance_valid(target):
		if target.is_in_group(&"enemy_blood_vampire"):
			presentation["impact_material"] = &"flesh"
		elif target.is_in_group(&"enemy_bone_reaper") or target is SkeletonEnemy:
			presentation["impact_material"] = &"bone"
	if not presentation.has("impact_direction"):
		var source_position: Variant = presentation.get("source_position", null)
		if source_position is Vector2 and not (source_position as Vector2).is_equal_approx(world_position):
			presentation["impact_direction"] = (source_position as Vector2).direction_to(world_position)
		else:
			var authored_direction: Variant = presentation.get("direction", null)
			if authored_direction is Vector2:
				presentation["impact_direction"] = authored_direction


func _on_combat_hit_confirmed(
		target: Node,
		actual_amount: int,
		world_position: Vector2,
		context: Dictionary
) -> void:
	present_confirmed_hit(target, actual_amount, world_position, context)


func _on_hero_combo_state_changed(
		hero_id: StringName,
		combo_step: int,
		hit_count: int,
		reset_seconds: float,
		active: bool
) -> void:
	combo_counter.set_combo_state(hero_id, combo_step, hit_count, reset_seconds, active)


func _connect_services() -> void:
	var event_bus := get_node_or_null("/root/GameEvents")
	if event_bus != null:
		_connect_once(event_bus, &"combat_hit_confirmed", Callable(self, "_on_combat_hit_confirmed"))
		_connect_once(event_bus, &"hero_combo_state_changed", Callable(self, "_on_hero_combo_state_changed"))
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null and save_service.has_signal(&"settings_changed"):
		_connect_once(save_service, &"settings_changed", Callable(self, "_on_settings_changed"))


func _disconnect_services() -> void:
	var event_bus := get_node_or_null("/root/GameEvents")
	if event_bus != null:
		_disconnect_if_connected(event_bus, &"combat_hit_confirmed", Callable(self, "_on_combat_hit_confirmed"))
		_disconnect_if_connected(event_bus, &"hero_combo_state_changed", Callable(self, "_on_hero_combo_state_changed"))
	var save_service := get_node_or_null("/root/SaveService")
	if save_service != null:
		_disconnect_if_connected(save_service, &"settings_changed", Callable(self, "_on_settings_changed"))


func _connect_once(source: Object, signal_name: StringName, callback: Callable) -> void:
	if source.has_signal(signal_name) and not source.is_connected(signal_name, callback):
		source.connect(signal_name, callback)


func _disconnect_if_connected(source: Object, signal_name: StringName, callback: Callable) -> void:
	if source.has_signal(signal_name) and source.is_connected(signal_name, callback):
		source.disconnect(signal_name, callback)


func _load_settings() -> void:
	var save_service := get_node_or_null("/root/SaveService")
	if save_service == null or not save_service.has_method(&"get_value"):
		return
	var settings_path: Array[String] = ["settings"]
	var loaded: Variant = save_service.call(&"get_value", settings_path, {})
	if loaded is Dictionary:
		_on_settings_changed(loaded)


func _on_settings_changed(settings: Dictionary) -> void:
	for key: String in _settings:
		if settings.has(key):
			_settings[key] = settings[key]
	if bool(_settings.get("reduced_motion", false)):
		_restore_camera()
		_restore_time_scale()
	if bool(_settings.get("reduced_flashes", false)):
		_overlay_until_msec = 0
		overlay_flash.color = Color.TRANSPARENT


func _apply_hit_stop(seconds: float) -> void:
	if bool(_settings.get("reduced_motion", false)) or get_tree().paused or seconds <= 0.0:
		return
	var duration_msec := clampi(roundi(seconds * 1000.0), 8, 90)
	var now := Time.get_ticks_msec()
	_hit_stop_until_msec = maxi(_hit_stop_until_msec, now + duration_msec)
	if _hit_stop_active:
		return
	_hit_stop_active = true
	_time_scale_before_hit_stop = Engine.time_scale
	Engine.time_scale = minf(Engine.time_scale, 0.08)


func _restore_time_scale() -> void:
	if not _hit_stop_active:
		return
	Engine.time_scale = _time_scale_before_hit_stop
	_hit_stop_active = false
	_hit_stop_until_msec = 0


func _apply_camera_shake(strength: float, seconds: float) -> void:
	var shake_setting := clampf(float(_settings.get("screen_shake", 0.8)), 0.0, 1.0)
	if bool(_settings.get("reduced_motion", false)) or shake_setting <= 0.001 or seconds <= 0.0:
		return
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return
	if _shake_camera != camera:
		_restore_camera()
		_shake_camera = camera
		_shake_base_offset = camera.offset
	var now := Time.get_ticks_msec()
	_shake_started_msec = now
	_shake_until_msec = maxi(_shake_until_msec, now + clampi(roundi(seconds * 1000.0), 30, 280))
	_shake_amplitude = maxf(_shake_amplitude, clampf(strength * 2.6 * shake_setting, 0.25, 7.0))


func _update_shake(now: int) -> void:
	if not is_instance_valid(_shake_camera):
		_shake_camera = null
		return
	if now >= _shake_until_msec:
		_restore_camera()
		return
	var duration := maxf(1.0, float(_shake_until_msec - _shake_started_msec))
	var remaining := clampf(float(_shake_until_msec - now) / duration, 0.0, 1.0)
	var time := float(now) * 0.001
	var offset := Vector2(
		sin(time * 157.0) + sin(time * 83.0) * 0.4,
		cos(time * 131.0) + sin(time * 71.0) * 0.35
	) * (_shake_amplitude * remaining)
	_shake_camera.offset = _shake_base_offset + offset.round()


func _restore_camera() -> void:
	if is_instance_valid(_shake_camera):
		_shake_camera.offset = _shake_base_offset
	_shake_camera = null
	_shake_until_msec = 0
	_shake_amplitude = 0.0


func _apply_overlay(context: Dictionary, strength: float) -> void:
	if bool(_settings.get("reduced_flashes", false)) or not bool(context.get("show_overlay", true)):
		return
	var is_echo := bool(context.get("is_echo", false)) or StringName(context.get("cue_id", &"")) == &"soul_echo_hit"
	_overlay_color = Color("62d9ff") if is_echo else Color("fff0bd")
	var custom_color: Variant = context.get("overlay_color", null)
	if custom_color is Color:
		_overlay_color = custom_color
	var duration := clampf(float(context.get("overlay_seconds", 0.045 + strength * 0.012)), 0.025, 0.12)
	_overlay_duration_msec = maxi(1, roundi(duration * 1000.0))
	_overlay_until_msec = Time.get_ticks_msec() + _overlay_duration_msec


func _update_overlay(now: int) -> void:
	if now >= _overlay_until_msec:
		overlay_flash.color = Color.TRANSPARENT
		return
	var remaining := clampf(float(_overlay_until_msec - now) / float(_overlay_duration_msec), 0.0, 1.0)
	var alpha := 0.035 + remaining * 0.075
	overlay_flash.color = Color(_overlay_color, alpha)
