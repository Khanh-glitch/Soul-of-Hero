class_name PixelGlyphSpriteText
extends Node2D

## Asset-backed renderer for the exact 3x5 combat glyphs used by the original
## damage and combo presentation. Runtime code only selects atlas regions and
## positions sprites; no glyph or panel is rasterized with draw_* calls.

const GLYPH_ATLAS: Texture2D = preload("res://assets/ui/pixel_glyph_atlas.svg")
const GLYPH_ORDER := "0123456789HITX!-+ "
const CELL_WIDTH := 4.0
const GLYPH_HEIGHT := 5.0
const WIDTHS := {
	"!": 1.0,
	" ": 2.0,
}

var _text := ""
var _pixel_size := 1.5
var _text_color := Color.WHITE
var _shadow_color := Color(0.04, 0.025, 0.07, 0.92)


func configure(
		value: String,
		pixel_size: float,
		text_color: Color,
		shadow_color := Color(0.04, 0.025, 0.07, 0.92)
) -> void:
	_text = value
	_pixel_size = clampf(pixel_size, 1.0, 3.0)
	_text_color = text_color
	_shadow_color = shadow_color
	_rebuild()


func get_text() -> String:
	return _text


func get_pixel_size() -> float:
	return _pixel_size


func get_text_color() -> Color:
	return _text_color


func get_measured_size() -> Vector2:
	var width := 0.0
	for index: int in _text.length():
		width += _glyph_width(_text[index]) * _pixel_size
		if index < _text.length() - 1:
			width += _pixel_size
	return Vector2(width, GLYPH_HEIGHT * _pixel_size)


func _rebuild() -> void:
	for child: Node in get_children():
		child.free()
	if _text.is_empty():
		return
	var measured := get_measured_size()
	# The one-pixel duplicate shadow made the original 3x5 glyphs read as a
	# thicker, different font at small sizes. Keep the authored atlas and base
	# scale, but render one crisp layer only.
	_build_layer(Vector2(-measured.x * 0.5, -measured.y * 0.5), _text_color)


func _build_layer(origin: Vector2, color: Color) -> void:
	var cursor := origin
	for character: String in _text:
		var glyph_index := GLYPH_ORDER.find(character)
		if glyph_index < 0:
			glyph_index = GLYPH_ORDER.length() - 1
		var glyph_width := _glyph_width(character)
		if character != " ":
			var sprite := Sprite2D.new()
			sprite.centered = false
			sprite.texture = GLYPH_ATLAS
			sprite.region_enabled = true
			sprite.region_filter_clip_enabled = true
			sprite.region_rect = Rect2(
				Vector2(float(glyph_index) * CELL_WIDTH, 0.0),
				Vector2(glyph_width, GLYPH_HEIGHT)
			)
			sprite.position = cursor
			sprite.scale = Vector2.ONE * _pixel_size
			sprite.modulate = color
			sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			add_child(sprite)
		cursor.x += (glyph_width + 1.0) * _pixel_size


func _glyph_width(character: String) -> float:
	return float(WIDTHS.get(character, 3.0))
