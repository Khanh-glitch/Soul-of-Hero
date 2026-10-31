class_name A6UiKit
extends RefCounted

## Shared construction helpers for the survival interface.
##
## Several survival screens are built in code rather than as .tscn files (the HUD, the
## chest surface, the build strip). Without a common kit each one invents its own
## colours and ends up looking like a debug overlay - which is exactly what the
## creator reported. These helpers are the single place that answers "how does a
## survival panel/button/bar/icon look", and every answer points at authored art:
##
##   * surfaces  -> assets/a6_ui/panels/*.png, cut by tools/import_a6_ui_art.py
##   * icons     -> assets/a6_ui/icons/*.png via A6ItemIcons, which refuses to return
##                  a picture for an item the packs do not depict
##   * type      -> GrenzeGotisch / Handjet / VT323, already in assets/fonts
##
## Nothing here owns state or invents numbers; it only draws what a caller hands it.

const THEME_PATH := "res://game/ui/theme/a6_survival_theme.tres"
const PANEL_DIR := "res://assets/a6_ui/panels"

## Ink colours sampled from the 255216 sheet so code-built labels match the art.
const INK := Color(0.153, 0.086, 0.063)
const INK_SOFT := Color(0.24, 0.15, 0.11, 0.9)
const CREAM := Color(0.98, 0.94, 0.82)
const GOLD := Color(0.98, 0.82, 0.5)
const WARN := Color(0.88, 0.42, 0.28)
const FILL_GOOD := Color(0.83, 0.62, 0.28)
const FILL_LOW := Color(0.86, 0.36, 0.26)

static var _theme: Theme = null


## The survival theme. Applied to a Control, it cascades to every child.
static func theme() -> Theme:
	if _theme == null and ResourceLoader.exists(THEME_PATH):
		_theme = load(THEME_PATH) as Theme
	return _theme


## Applies the survival theme and nearest-neighbour filtering to a UI root.
static func dress(root: Control) -> void:
	if root == null:
		return
	var loaded := theme()
	if loaded != null:
		root.theme = loaded
	root.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST


## A parchment card, for content that sits on top of the world.
static func card() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.theme_type_variation = &"A6Card"
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return panel


## A full window with the teal title band, for modals.
static func window() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.theme_type_variation = &"A6Window"
	return panel


## An empty socket, for slots and bar tracks.
static func socket() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.theme_type_variation = &"A6Slot"
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return panel


## A label in one of the survival type roles. Roles: title, heading, body, number,
## caption, warning.
static func label(text: String, role: String = "body", size: int = 0) -> Label:
	var out := Label.new()
	out.text = text
	out.mouse_filter = Control.MOUSE_FILTER_IGNORE
	match role:
		"title":
			out.theme_type_variation = &"A6Title"
		"heading":
			out.theme_type_variation = &"A6Heading"
		"number":
			out.theme_type_variation = &"A6Number"
		"caption":
			out.theme_type_variation = &"A6Caption"
		"warning":
			out.theme_type_variation = &"A6Warning"
		_:
			out.theme_type_variation = &"A6Body"
	if size > 0:
		out.add_theme_font_size_override("font_size", size)
	return out


## A label for text that floats over the world and must stay readable on any tile:
## cream, dark outline, no panel behind it.
static func world_label(text: String, size: int) -> Label:
	var out := Label.new()
	out.text = text
	out.mouse_filter = Control.MOUSE_FILTER_IGNORE
	out.add_theme_font_size_override("font_size", size)
	out.add_theme_color_override("font_color", CREAM)
	out.add_theme_color_override("font_outline_color", Color(0.05, 0.03, 0.04, 1))
	out.add_theme_constant_override("outline_size", 4)
	return out


## An icon for an item, drawn at `size` virtual pixels. Returns null when the packs
## have no honest picture for that item - callers must then show the name alone.
static func icon(item_id: String, size: int = 16) -> TextureRect:
	var texture := A6ItemIcons.texture_for(item_id)
	if texture == null:
		return null
	var rect := TextureRect.new()
	rect.texture = texture
	rect.custom_minimum_size = Vector2(size, size)
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return rect


## A horizontal bar: an authored socket with a plank fill that grows from the left.
## The returned dictionary exposes `root`, `fill` and `set_ratio`.
static func bar(width: int, height: int) -> Dictionary:
	var root := Control.new()
	root.custom_minimum_size = Vector2(width, height)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var track := socket()
	track.set_anchors_preset(Control.PRESET_FULL_RECT)
	track.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(track)

	var fill := NinePatchRect.new()
	fill.texture = load(PANEL_DIR + "/hud_bar.png") as Texture2D
	fill.patch_margin_left = 6
	fill.patch_margin_top = 2
	fill.patch_margin_right = 6
	fill.patch_margin_bottom = 2
	fill.modulate = FILL_GOOD
	fill.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# A 2-unit inset inside a 7-unit track left a 3-unit band that read as a scratched
	# line rather than a gauge. The fill sits one unit in from the socket edge so the
	# authored border still shows and the bar reads as filled.
	fill.position = Vector2(1, 1)
	fill.size = Vector2(maxf(0.0, float(width - 2)), maxf(0.0, float(height - 2)))
	root.add_child(fill)

	return {
		"root": root,
		"fill": fill,
		"width": float(width - 2),
		"height": float(height - 2),
	}


## Updates a bar produced by `bar()`. Low values shift to the warn colour so an empty
## pack is visible without reading the number.
static func set_bar(bar_parts: Dictionary, value: float, maximum: float) -> void:
	var fill: NinePatchRect = bar_parts.get("fill", null)
	if fill == null:
		return
	var full_width := float(bar_parts.get("width", 0.0))
	var ratio := 0.0 if maximum <= 0.0 else clampf(value / maximum, 0.0, 1.0)
	fill.size = Vector2(full_width * ratio, float(bar_parts.get("height", 0.0)))
	fill.visible = ratio > 0.0
	fill.modulate = FILL_LOW if ratio < 0.2 else FILL_GOOD


## An icon + number chip, e.g. [shelter] 2/7. Falls back to a bare number when the
## icon is not authored.
static func chip(item_id: String, text: String, icon_size: int = 12, font_size: int = 11) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 2)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var picture := icon(item_id, icon_size)
	if picture != null:
		row.add_child(picture)
	row.add_child(label(text, "number", font_size))
	return row


## Puts a Control on a CanvasLayer that draws above the world but below modals.
static func layer(parent: Node, layer_index: int, name: String) -> Control:
	var canvas := CanvasLayer.new()
	canvas.name = name
	canvas.layer = layer_index
	parent.add_child(canvas)
	var root := Control.new()
	root.name = name + "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(root)
	return root
