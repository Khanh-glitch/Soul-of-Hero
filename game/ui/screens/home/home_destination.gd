extends Node2D

var function_id := &""
var display_name := ""
var role_text := ""
var accent := Color.WHITE
var interaction_radius := 44.0

var _texture: Texture2D
var _region := Rect2()
var _sprite_scale := Vector2.ONE
var _visual_offset := Vector2.ZERO
var _focused := false
var _hovered := false
var _pulse := 0.0

@onready var _sprite: Sprite2D = $Portrait
@onready var _selection: Sprite2D = $AssetSelection
@onready var _marker: Sprite2D = $AssetMarker
@onready var _name_label: Label = $DestinationName
@onready var _role_label: Label = $DestinationRole


func setup(data: Dictionary) -> void:
	function_id = StringName(data.get("function_id", &""))
	display_name = String(data.get("display_name", "ĐIỂM ĐẾN"))
	role_text = String(data.get("role", "Tương tác"))
	accent = data.get("accent", Color.WHITE)
	interaction_radius = float(data.get("interaction_radius", 44.0))
	_texture = data.get("texture") as Texture2D
	_region = data.get("region", Rect2())
	var raw_scale: Variant = data.get("scale", Vector2.ONE)
	_sprite_scale = raw_scale if raw_scale is Vector2 else Vector2(float(raw_scale), float(raw_scale))
	_visual_offset = data.get("visual_offset", Vector2.ZERO)
	if is_node_ready():
		_apply_visuals()


func _ready() -> void:
	add_to_group(&"home_destination")
	_apply_visuals()


func set_focused(value: bool) -> void:
	if _focused == value:
		return
	_focused = value
	_refresh_labels()


func set_hovered(value: bool) -> void:
	if _hovered == value:
		return
	_hovered = value
	_refresh_labels()


func is_highlighted() -> bool:
	return _focused or _hovered


func contains_world_point(world_point: Vector2) -> bool:
	# `world_point` is expressed in WorldRoot coordinates (camera translation has
	# already been removed by HomeMapScreen), so only this authored position must
	# be removed here; Node2D.to_local() would incorrectly undo the camera twice.
	var local_point := world_point - position
	var visual_size := _region.size * _sprite_scale.abs()
	var visual_rect := Rect2(_visual_offset - visual_size * 0.5, visual_size).grow(7.0)
	# Keep a reliable 48 px touch target even when a sprite has a narrow body or
	# a lot of transparent padding in its source frame.
	var touch_rect := Rect2(Vector2(-24.0, -48.0), Vector2(48.0, 60.0))
	return visual_rect.has_point(local_point) or touch_rect.has_point(local_point)


func _process(delta: float) -> void:
	_pulse = fmod(_pulse + delta * 2.0, TAU)
	if _sprite != null:
		_sprite.position = _visual_offset + Vector2(0.0, sin(_pulse) * 0.45)
	if _selection != null:
		var pulse_scale := 1.08 + (sin(_pulse) + 1.0) * 0.05
		_selection.scale = Vector2.ONE * pulse_scale
	if _marker != null:
		_marker.position.y = _visual_offset.y - 23.0 + sin(_pulse) * 1.4


func _apply_visuals() -> void:
	if _sprite == null:
		return
	_sprite.texture = _texture
	_sprite.region_enabled = true
	_sprite.region_rect = _region
	_sprite.scale = _sprite_scale
	_sprite.position = _visual_offset
	_name_label.text = display_name
	_role_label.text = role_text
	_role_label.add_theme_color_override(&"font_color", accent)
	_refresh_labels()


func _refresh_labels() -> void:
	if _name_label == null:
		return
	var highlighted := is_highlighted()
	_name_label.visible = highlighted
	_role_label.visible = highlighted
	_name_label.modulate = Color.WHITE
	_selection.visible = highlighted
	_selection.modulate = Color(accent, 0.9)
	_marker.modulate = Color(accent, 0.96 if highlighted else 0.5)
	_marker.scale = Vector2.ONE * (0.78 if highlighted else 0.5)
