class_name PixelDamageNumber
extends Node2D

@onready var glyph_text: PixelGlyphSpriteText = %GlyphText

var lifetime_seconds := 0.72
var _elapsed := 0.0
var _text := "0"
var _color := Color("fff4d1")
var _velocity := Vector2(0.0, -23.0)
var _pixel_size := 1.5
var _configured := false
var _exit_started := false
var _motion_tween: Tween


func configure(amount: int, world_position: Vector2, context: Dictionary = {}) -> void:
	global_position = world_position + Vector2(0.0, float(context.get("number_y_offset", -18.0)))
	_text = str(maxi(0, amount))
	if bool(context.get("is_heal", false)):
		_text = "+" + _text
	elif bool(context.get("show_damage_sign", false)):
		_text = "-" + _text
	var critical := bool(context.get("is_critical", false))
	var echo := bool(context.get("is_echo", false)) or StringName(context.get("cue_id", &"")) == &"soul_echo_hit"
	if critical:
		_text += "!"
		_color = Color("ff4d55")
	elif echo:
		_color = Color("83e9ff")
	var custom_color: Variant = context.get("damage_color", null)
	# Critical hits always read red at a glance. Elemental/custom colors remain
	# available for non-critical damage without overriding that combat contract.
	if not critical and custom_color is Color:
		_color = custom_color
	elif not critical and custom_color is String and Color.html_is_valid(String(custom_color)):
		_color = Color(String(custom_color))
	lifetime_seconds = clampf(float(context.get("number_duration", lifetime_seconds)), 0.2, 2.0)
	_pixel_size = clampf(float(context.get("number_pixel_size", _pixel_size)), 1.0, 3.0)
	var direction := -1.0 if amount % 2 == 0 else 1.0
	_velocity.x = direction * float(context.get("number_spread", 4.0))
	z_index = int(context.get("number_z_index", 120))
	_configured = true
	if is_node_ready():
		_apply_visuals(critical, echo)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	if _configured:
		_apply_visuals(_text.ends_with("!"), _color == Color("83e9ff"))


func _apply_visuals(critical: bool, echo: bool) -> void:
	glyph_text.configure(_text, _pixel_size, _color)
	# Keep the original glyph size. Motion supplies the hit weight: start small,
	# zoom to a short peak, settle, then shrink away. Critical uses a moderately
	# stronger peak instead of permanently inflating the font.
	var peak_scale := 1.68 if critical else (1.54 if echo else 1.42)
	scale = Vector2.ONE * 0.55
	modulate.a = 0.0
	position.y += 7.0
	if _motion_tween != null and _motion_tween.is_valid():
		_motion_tween.kill()
	_motion_tween = create_tween().set_parallel(true)
	_motion_tween.tween_property(self, "position:y", position.y - 20.0, 0.06).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	_motion_tween.tween_property(self, "scale", Vector2.ONE * peak_scale, 0.06).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_motion_tween.tween_property(self, "modulate:a", 1.0, 0.025).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_motion_tween.chain().tween_property(self, "scale", Vector2.ONE, 0.07).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)


func _process(delta: float) -> void:
	_elapsed += delta
	if _exit_started:
		return
	# Let the authored entry snap own the first frames; then continue the old
	# lightweight float so the text remains readable above the target.
	if _elapsed > 0.14:
		position += _velocity * delta
	_velocity.y += 16.0 * delta
	if _elapsed >= maxf(0.14, lifetime_seconds - 0.13):
		_play_exit()


func _play_exit() -> void:
	if _exit_started:
		return
	_exit_started = true
	if _motion_tween != null and _motion_tween.is_valid():
		_motion_tween.kill()
	_motion_tween = create_tween().set_parallel(true)
	_motion_tween.tween_property(self, "position:y", position.y - 13.0, 0.12).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_IN)
	_motion_tween.tween_property(self, "scale", Vector2.ONE * 0.16, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	_motion_tween.tween_property(self, "modulate:a", 0.0, 0.10).set_delay(0.02)
	_motion_tween.chain().tween_callback(queue_free)
