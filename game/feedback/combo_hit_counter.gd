class_name ComboHitCounter
extends Control

@export_range(0.25, 4.0, 0.05) var fallback_window_seconds := 2.0

@onready var glyph_text: PixelGlyphSpriteText = %GlyphText

var _hero_id := &""
var _combo_step := 0
var _hit_count := 0
var _remaining := 0.0
var _rest_position := Vector2.ZERO
var _motion_tween: Tween
var _exiting := false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	process_mode = Node.PROCESS_MODE_PAUSABLE
	_rest_position = position
	visible = false


func set_combo_state(
		hero_id: StringName,
		combo_step: int,
		hit_count: int,
		reset_seconds: float,
		active: bool
) -> void:
	_hero_id = hero_id
	_combo_step = maxi(0, combo_step)
	_hit_count = maxi(0, hit_count)
	_remaining = maxf(0.0, reset_seconds)
	if active and _hit_count > 0:
		visible = true
		_refresh_visuals()
		_play_punch()
	elif visible:
		_play_exit()
	else:
		visible = false


func register_confirmed_hit(explicit_count := 0, window_seconds := -1.0) -> void:
	if explicit_count > 0:
		_hit_count = explicit_count
	elif _remaining > 0.0:
		_hit_count += 1
	else:
		_hit_count = 1
	_remaining = window_seconds if window_seconds > 0.0 else fallback_window_seconds
	visible = true
	_refresh_visuals()
	_play_punch()


func clear_combo() -> void:
	if _motion_tween != null:
		_motion_tween.kill()
	_hit_count = 0
	_combo_step = 0
	_remaining = 0.0
	_exiting = false
	position = _rest_position
	scale = Vector2.ONE
	modulate.a = 1.0
	visible = false


func get_hit_count() -> int:
	return _hit_count


func _process(delta: float) -> void:
	if not visible:
		return
	if _exiting:
		return
	_remaining = maxf(0.0, _remaining - delta)
	if _remaining <= 0.13:
		_play_exit()


func _refresh_visuals() -> void:
	if not is_node_ready():
		return
	var hot := _hit_count >= 4
	var color := Color("ff765f") if hot else Color("ffdf79")
	glyph_text.configure(
		"%d HIT" % _hit_count,
		2.0,
		color,
		Color(0.02, 0.01, 0.04, 0.95)
	)


func _play_punch() -> void:
	if not is_node_ready():
		return
	if _motion_tween != null:
		_motion_tween.kill()
	_exiting = false
	position = _rest_position + Vector2(0.0, 8.0)
	scale = Vector2.ONE * 0.55
	modulate.a = 0.0
	var peak_scale := 1.58 if _hit_count >= 4 else 1.42
	_motion_tween = create_tween().set_parallel(true)
	_motion_tween.tween_property(self, "position", _rest_position + Vector2(0.0, -6.0), 0.06).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	_motion_tween.tween_property(self, "scale", Vector2.ONE * peak_scale, 0.06).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_motion_tween.tween_property(self, "modulate:a", 1.0, 0.025).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_motion_tween.chain().tween_property(self, "position", _rest_position, 0.07).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	_motion_tween.parallel().tween_property(self, "scale", Vector2.ONE, 0.07).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)


func _play_exit() -> void:
	if _exiting or not visible:
		return
	_exiting = true
	if _motion_tween != null:
		_motion_tween.kill()
	_motion_tween = create_tween().set_parallel(true)
	_motion_tween.tween_property(self, "position", _rest_position + Vector2(0.0, -15.0), 0.115).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_IN)
	_motion_tween.tween_property(self, "scale", Vector2.ONE * 0.14, 0.115).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	_motion_tween.tween_property(self, "modulate:a", 0.0, 0.095).set_delay(0.02)
	_motion_tween.chain().tween_callback(clear_combo)
