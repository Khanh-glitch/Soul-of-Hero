extends RefCounted
## A6's small bespoke, source-free pixel-fantasy UI kit. Drawn at the 640x360 design
## grid; project nearest-neighbour scaling remains owned by project.godot.

const FONT_BODY := preload("res://assets/fonts/Handjet-Regular.ttf")
const FONT_STRONG := preload("res://assets/fonts/Handjet-SemiBold.ttf")
const FONT_TITLE := preload("res://assets/fonts/GrenzeGotisch-SemiBold.ttf")
const INK := Color("111923")
const LEATHER := Color("30231f")
const LEATHER_LIT := Color("453029")
const BRONZE := Color("b77b4e")
const GOLD := Color("f4c778")
const PAPER := Color("f6e8c9")
const MINT := Color("91d6ac")
const WARNING := Color("ff9278")
const MUTED := Color("b8c4b2")
const TRANSPARENT := Color(0, 0, 0, 0)

static func panel_style(fill: Color, edge: Color, width := 2) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = edge
	box.set_border_width_all(width)
	box.corner_radius_top_left = 0
	box.corner_radius_top_right = 0
	box.corner_radius_bottom_left = 0
	box.corner_radius_bottom_right = 0
	box.content_margin_left = 8
	box.content_margin_right = 8
	box.content_margin_top = 6
	box.content_margin_bottom = 6
	box.shadow_color = Color(0.02, 0.025, 0.035, 0.8)
	box.shadow_size = 3
	box.shadow_offset = Vector2(2, 3)
	return box

static func style_button(button: Button) -> void:
	button.add_theme_font_override("font", FONT_STRONG)
	button.add_theme_font_size_override("font_size", 12)
	button.add_theme_color_override("font_color", PAPER)
	button.add_theme_color_override("font_hover_color", GOLD)
	button.add_theme_color_override("font_pressed_color", MINT)
	button.add_theme_color_override("font_disabled_color", MUTED.darkened(0.28))
	button.add_theme_stylebox_override("normal", panel_style(INK, BRONZE, 1))
	button.add_theme_stylebox_override("hover", panel_style(LEATHER_LIT, GOLD, 2))
	button.add_theme_stylebox_override("pressed", panel_style(Color("334139"), MINT, 2))
	button.add_theme_stylebox_override("disabled", panel_style(Color("20252a"), Color("53504a"), 1))
	button.add_theme_stylebox_override("focus", panel_style(Color(0, 0, 0, 0), GOLD, 2))
	button.add_theme_constant_override("h_separation", 7)
	button.add_theme_constant_override("outline_size", 1)
	button.add_theme_color_override("font_outline_color", INK)

static func style_label(label: Label, size: int, color: Color, heading := false) -> void:
	label.add_theme_font_override("font", FONT_TITLE if heading else FONT_BODY)
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	if heading:
		label.add_theme_color_override("font_outline_color", INK)
		label.add_theme_constant_override("outline_size", 1)

static func icon_texture(record: Dictionary) -> Texture2D:
	var image := Image.create(24, 24, false, Image.FORMAT_RGBA8)
	image.fill(TRANSPARENT)
	var item_id := String(record.get("id", "")).to_lower()
	var kind := String(record.get("kind", "")).to_lower()
	var core := kind == "core" or item_id.contains("core")
	var base := Color("ce7a55")
	if item_id.contains("frost") or item_id.contains("ice"):
		base = Color("83d7e8")
	elif item_id.contains("venom") or item_id.contains("toxin"):
		base = Color("a6d66c")
	elif item_id.contains("gold") or item_id.contains("ember") or item_id.contains("fire"):
		base = Color("ffb84f")
	elif item_id.contains("iron") or item_id.contains("ore"):
		base = Color("b9b9ae")
	elif item_id.contains("stone") or item_id.contains("rock"):
		base = Color("a19b8d")
	elif item_id.contains("wood") or item_id.contains("timber"):
		base = Color("d49a54")
	elif kind == "material":
		base = Color("d7b96e")

	# Recessed, chamfered inventory socket; one logical pixel is one source pixel.
	_fill(image, Rect2i(2, 3, 20, 18), Color("171923"))
	_fill(image, Rect2i(3, 2, 18, 20), Color("171923"))
	_fill(image, Rect2i(4, 3, 16, 18), Color("41342c"))
	_fill(image, Rect2i(5, 4, 14, 16), Color("211f23"))
	if core and (item_id.contains("ember") or item_id.contains("fire") or item_id.contains("gold")):
		# A small living flame around an angular physical shard.
		_fill(image, Rect2i(11, 5, 3, 3), Color("fff1bb"))
		_fill(image, Rect2i(8, 8, 9, 7), base)
		_fill(image, Rect2i(7, 10, 2, 5), Color("e87942"))
		_fill(image, Rect2i(9, 15, 7, 3), Color("d45939"))
		_fill(image, Rect2i(10, 10, 4, 5), Color("fff0bd"))
	elif core and (item_id.contains("frost") or item_id.contains("ice")):
		# Six-point frost crystal, distinct from the flame's stepped silhouette.
		_fill(image, Rect2i(11, 5, 3, 14), base)
		_fill(image, Rect2i(8, 8, 9, 8), base)
		_fill(image, Rect2i(6, 10, 13, 4), Color("d9f8ff"))
		_fill(image, Rect2i(11, 7, 2, 10), Color("e9fdff"))
		_fill(image, Rect2i(9, 10, 7, 3), Color("4d9dbd"))
	elif core and (item_id.contains("venom") or item_id.contains("toxin")):
		# Tapered toxin drop with a bright inner meniscus.
		_fill(image, Rect2i(11, 5, 3, 4), Color("d9f39c"))
		_fill(image, Rect2i(9, 8, 7, 3), base)
		_fill(image, Rect2i(7, 11, 12, 5), base)
		_fill(image, Rect2i(9, 16, 8, 2), Color("668d45"))
		_fill(image, Rect2i(10, 10, 3, 3), Color("edffd0"))
	elif core:
		# Uncatalogued specimens retain a unique, neutral prismatic identity.
		_fill(image, Rect2i(10, 5, 5, 3), Color("d8c5ff"))
		_fill(image, Rect2i(8, 8, 9, 8), Color("9e7bc8"))
		_fill(image, Rect2i(10, 9, 4, 7), Color("eee0ff"))
		_fill(image, Rect2i(9, 16, 7, 2), Color("705091"))
	elif item_id.contains("wood") or item_id.contains("timber"):
		_fill(image, Rect2i(6, 8, 12, 9), Color("81502e"))
		_fill(image, Rect2i(7, 7, 10, 3), base)
		_fill(image, Rect2i(7, 14, 10, 3), Color("b66c37"))
		_fill(image, Rect2i(9, 8, 2, 9), Color("f0c376"))
	elif item_id.contains("stone") or item_id.contains("rock"):
		_fill(image, Rect2i(7, 12, 3, 5), Color("625f5a"))
		_fill(image, Rect2i(9, 9, 8, 8), base)
		_fill(image, Rect2i(11, 7, 5, 4), Color("d7d2c3"))
		_fill(image, Rect2i(12, 10, 5, 2), Color("e6ddc9"))
	elif item_id.contains("iron") or item_id.contains("ore"):
		_fill(image, Rect2i(8, 9, 8, 8), Color("71777d"))
		_fill(image, Rect2i(9, 7, 5, 4), Color("e4d7b6"))
		_fill(image, Rect2i(12, 10, 5, 3), base)
		_fill(image, Rect2i(8, 14, 9, 3), Color("73727a"))
	else:
		# Generic material is a small tied bundle, not an unlabelled square.
		_fill(image, Rect2i(8, 7, 8, 10), base)
		_fill(image, Rect2i(7, 9, 10, 2), Color("f4e0a0"))
		_fill(image, Rect2i(8, 13, 8, 2), Color("865d3b"))

	# State is encoded in silhouette details as well as text, never by hue alone.
	if core and record.has("max_uses"):
		var maximum := maxi(1, int(record.get("max_uses", 1)))
		var uses := clampi(int(record.get("uses", 0)), 0, maximum)
		for pip in mini(6, maximum):
			var x := 5 + pip * 2
			_fill(image, Rect2i(x, 20, 1, 2), base if pip < int(ceil(float(uses) * 6.0 / maximum)) else Color("514b48"))
		if uses == 0:
			_fill(image, Rect2i(17, 5, 2, 2), Color("ff806d"))
	if str(record.get("condition", "")).to_lower() in ["damaged", "broken", "worn", "poor"]:
		_fill(image, Rect2i(18, 16, 3, 3), Color("ff725f"))
	elif bool(record.get("equipped", false)):
		_fill(image, Rect2i(18, 4, 3, 3), Color("a9e7a6"))
	return ImageTexture.create_from_image(image)

static func _fill(image: Image, rect: Rect2i, color: Color) -> void:
	image.fill_rect(rect, color)
