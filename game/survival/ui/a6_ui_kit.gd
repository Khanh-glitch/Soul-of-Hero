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


## Styles a ScrollContainer's vertical bar in the authored palette.
##
## Godot's default bar is stock grey with a rounded grabber. On this parchment window it
## reads as an unstyled engine widget dropped into a hand-drawn panel - visible in the
## 4K frame at 1x - so it is recoloured here rather than left to the fallback theme.
## The colours are the kit's own ink/wood/gold, not a new art decision: the bar keeps
## the default shape and only loses the grey.
static func style_scroll(scroll: ScrollContainer, width := 9) -> void:
	if scroll == null:
		return
	# Refuse to do half the job. Reparenting needs a parent to reparent into; called on a
	# node that is not in a VBox yet, this used to leave the bar inside the ScrollContainer,
	# where it drew over the rows' right-hand column and cut their text off. A loud no-op
	# is better than a silent overlap: pass a list that is already inside its column.
	if not (scroll.get_parent() is VBoxContainer):
		push_error("A6UiKit.style_scroll: %s must already be a child of a VBoxContainer" % scroll.name)
		return
	var bar := scroll.get_v_scroll_bar()
	if bar == null:
		return
	# A ScrollContainer always reserves its bar inside its own rect, and its stylebox
	# paints behind both, so the grabber lands on the window's parchment border. The bar
	# becomes a sibling column instead: the list scrolls, the bar sits in a gutter of its
	# own and does not touch the frame.
	# The mode must stay AUTO: SCROLL_MODE_SHOW_NEVER hides the bar NODE, and the bar is
	# this gutter's child now, so hiding it would hide the only scroll affordance on
	# screen. AUTO keeps it visible while the content overflows, and because the bar is no
	# longer a child of the ScrollContainer, the container reserves no space for it and
	# the list keeps its full width.
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	var column := scroll.get_parent() as VBoxContainer
	var gutter := HBoxContainer.new()
	gutter.name = "ScrollGutter"
	gutter.size_flags_vertical = Control.SIZE_EXPAND_FILL
	gutter.add_theme_constant_override("separation", 2)
	var index := scroll.get_index()
	column.remove_child(scroll)
	column.add_child(gutter)
	column.move_child(gutter, index)
	gutter.add_child(scroll)
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# The container creates the bar as its own child; a node with a parent cannot be
	# added to a second one, so it is detached before it moves into the gutter. The
	# ScrollContainer still drives it - the reference is what it uses, not the parentage.
	if bar.get_parent() != null:
		bar.get_parent().remove_child(bar)
	gutter.add_child(bar)
	bar.custom_minimum_size = Vector2(float(width), 0.0)
	bar.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bar.custom_minimum_size.x = float(width)
	# A wide, quiet track that the grabber sits on.
	var track := StyleBoxFlat.new()
	track.bg_color = Color(0.09, 0.055, 0.04, 0.55)
	track.content_margin_left = 2.0
	track.content_margin_right = 2.0
	track.content_margin_top = 2.0
	track.content_margin_bottom = 2.0
	track.corner_radius_top_left = 2
	track.corner_radius_top_right = 2
	track.corner_radius_bottom_left = 2
	track.corner_radius_bottom_right = 2
	bar.add_theme_stylebox_override("scroll", track)
	bar.add_theme_stylebox_override("grabber", _grabber(FILL_GOOD))
	bar.add_theme_stylebox_override("grabber_highlight", _grabber(GOLD))
	bar.add_theme_stylebox_override("grabber_pressed", _grabber(CREAM))


static func _grabber(colour: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.corner_radius_top_left = 2
	box.corner_radius_top_right = 2
	box.corner_radius_bottom_left = 2
	box.corner_radius_bottom_right = 2
	return box


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


# --- visual direction ---------------------------------------------------------
#
# R13 asks for two deliberately different looks of the *same* scene and content, so the
# creator can choose a tone instead of approving a single take. Both directions share
# the layout budget, the node names and the input behaviour; only the surface, the type
# and how state is stated differ. The switch is read from A6_VISUAL_DIRECTION so a CI
# matrix (or one test process) can render both without a code change.
#
# Why the body face is VT323 in both: Handjet cannot draw Vietnamese. Its precomposed
# glyphs for stacked marks (Bữa, XƯỞNG, Thiếu) overlap into one blob at every raster
# size, which is what the creator saw as "muddy". VT323 carries the same marks cleanly,
# so the legibility fix is not a style choice between directions - it is a defect fix
# applied to both.

const DIRECTION_LEDGER := "a"
const DIRECTION_BOARD := "b"
const DIRECTION_ENV := "A6_VISUAL_DIRECTION"
const FACE_BODY_PATH := "res://assets/fonts/VT323-Regular.ttf"
const FACE_DISPLAY_PATH := "res://assets/fonts/GrenzeGotisch-SemiBold.ttf"

## Row states. Derived by the caller from owner answers only.
const STATE_CRAFT := "craft"
const STATE_SHORT := "short"
const STATE_BUSY := "busy"
const STATE_OFFLINE := "offline"
const STATE_DONE := "done"
const STATE_KNOWN := "known"

## The survival theme deliberately sets no global Label shadow. Behind 11-13 unit text a
## 1x2-pixel offset does not read as depth, it reads as a doubled glyph - measured on the
## R13 workshop at 1x, where the verdict word "CHẾ" carried a black ghost one pixel right
## and two pixels below, which is what the creator called muddy. Text that floats over the
## world keeps an outline (`world_label`); the display variations keep their own shadow.

const BOARD_INK := Color(0.16, 0.108, 0.078)
const BOARD_EDGE := Color(0.52, 0.4, 0.2, 0.9)
const LEDGER_PLATE := Color(0.945, 0.9, 0.78, 0.92)
const LEDGER_RULE := Color(0.42, 0.29, 0.19, 0.55)

static var _direction := ""
static var _faces: Dictionary = {}


## The direction in play. Read once from the environment; "a" when unset or unknown.
static func direction() -> String:
	if _direction.is_empty():
		var from_env := OS.get_environment(DIRECTION_ENV).strip_edges().to_lower()
		_direction = from_env if from_env in [DIRECTION_LEDGER, DIRECTION_BOARD] else DIRECTION_LEDGER
	return _direction


## Switches the direction in-process. Used by the capture driver so one run renders both
## takes of the same frame; the game itself only reads the environment.
static func set_direction(value: String) -> void:
	_direction = value if value in [DIRECTION_LEDGER, DIRECTION_BOARD] else DIRECTION_LEDGER


static func is_board() -> bool:
	return direction() == DIRECTION_BOARD


## A loaded face, cached. Both files ship in assets/fonts with their OFL licences.
static func face(path: String) -> Font:
	if not _faces.has(path):
		_faces[path] = load(path) as Font if ResourceLoader.exists(path) else null
	return _faces[path]


## The body face. Vietnamese reads here; Handjet does not (see the note above).
static func body_face() -> Font:
	return face(FACE_BODY_PATH)


## The display face for names and section headings in the board direction.
static func display_face() -> Font:
	return face(FACE_DISPLAY_PATH)


## Type sizes, in the 640x360 canvas units the whole interface is authored in.
## These are the numbers the R13 readability fix is made of: the old captions were 8-10
## units, which is 8-10 *raster* pixels - below the size at which a stacked Vietnamese
## mark survives, at any window size.
static func size_name() -> int:
	return 15


static func size_cost() -> int:
	return 13


static func size_caption() -> int:
	return 12


static func size_heading() -> int:
	return 15


## Text on the window/parchment (ledger) or on the board (board direction).
static func text_colour() -> Color:
	return CREAM if is_board() else INK


static func quiet_colour() -> Color:
	return Color(0.86, 0.78, 0.62, 0.9) if is_board() else INK_SOFT


static func accent_colour() -> Color:
	return GOLD if is_board() else Color(0.42, 0.29, 0.12)


## The colour a state is stated in: the spine, the tag fill and the queue chip all use
## it, so one look carries one meaning.
static func state_colour(state: String) -> Color:
	match state:
		STATE_CRAFT:
			return Color(0.33, 0.58, 0.36) if is_board() else Color(0.24, 0.47, 0.31)
		STATE_SHORT:
			return WARN
		STATE_BUSY:
			return Color(0.72, 0.52, 0.22)
		STATE_OFFLINE:
			return Color(0.45, 0.42, 0.4)
		STATE_DONE:
			return GOLD if is_board() else Color(0.72, 0.5, 0.14)
		_:
			return Color(0.42, 0.42, 0.46)


## Readable ink on top of `state_colour`.
static func on_state_colour() -> Color:
	return Color(0.09, 0.06, 0.04) if is_board() else CREAM


## The one or two word answer a row gives without reading a sentence.
static func state_word(state: String) -> String:
	match state:
		STATE_CRAFT:
			return "CHẾ"
		STATE_SHORT:
			return "THIẾU"
		STATE_BUSY:
			return "ĐẦY"
		STATE_OFFLINE:
			return "TẮT"
		STATE_DONE:
			return "LẤY"
		STATE_KNOWN:
			return "ĐÃ BIẾT"
		_:
			return ""


## The plate one row is drawn on. Ledger: a light plate with an ink hairline under it,
## so a list of rows reads as a register. Board: a dark plate with a warm edge, so each
## row is a chalked line on a hanging board.
static func row_style(state: String) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = BOARD_INK if is_board() else LEDGER_PLATE
	box.content_margin_left = 4.0
	box.content_margin_right = 4.0
	box.content_margin_top = 2.0
	box.content_margin_bottom = 2.0
	if is_board():
		box.border_width_left = 3
		box.border_color = state_colour(state)
		box.border_width_top = 1
		box.border_width_bottom = 1
		box.border_width_right = 1
		box.corner_radius_top_left = 2
		box.corner_radius_top_right = 2
		box.corner_radius_bottom_left = 2
		box.corner_radius_bottom_right = 2
	else:
		box.border_width_bottom = 1
		box.border_color = LEDGER_RULE
	return box


## The window the list sits in. The ledger keeps the authored parchment; the board
## replaces it with a dark plate rather than tinting the parchment, because a tinted
## parchment is the same picture in a different colour, not a different direction.
static func window_style() -> StyleBox:
	if not is_board():
		var parchment := StyleBoxTexture.new()
		var texture := load(PANEL_DIR + "/window.png") as Texture2D
		if texture == null:
			return row_style(STATE_CRAFT)
		parchment.texture = texture
		parchment.texture_margin_left = 8.0
		parchment.texture_margin_top = 15.0
		parchment.texture_margin_right = 4.0
		parchment.texture_margin_bottom = 5.0
		parchment.content_margin_left = 12.0
		parchment.content_margin_top = 22.0
		parchment.content_margin_right = 12.0
		parchment.content_margin_bottom = 10.0
		return parchment
	var board := StyleBoxFlat.new()
	board.bg_color = Color(0.118, 0.082, 0.058, 0.97)
	board.border_width_left = 2
	board.border_width_right = 2
	board.border_width_top = 2
	board.border_width_bottom = 2
	board.border_color = BOARD_EDGE
	board.content_margin_left = 12.0
	board.content_margin_top = 12.0
	board.content_margin_right = 12.0
	board.content_margin_bottom = 10.0
	return board


## A card surface for the smaller plates (avatar identity cards, queue rows).
static func card_style() -> StyleBox:
	if not is_board():
		var parchment := StyleBoxTexture.new()
		var texture := load(PANEL_DIR + "/panel.png") as Texture2D
		if texture == null:
			return row_style(STATE_CRAFT)
		parchment.texture = texture
		parchment.texture_margin_left = 4.0
		parchment.texture_margin_top = 3.0
		parchment.texture_margin_right = 4.0
		parchment.texture_margin_bottom = 3.0
		parchment.content_margin_left = 4.0
		parchment.content_margin_top = 3.0
		parchment.content_margin_right = 4.0
		parchment.content_margin_bottom = 3.0
		return parchment
	var card := StyleBoxFlat.new()
	card.bg_color = Color(0.15, 0.102, 0.072, 0.96)
	card.border_width_left = 2
	card.border_width_right = 2
	card.border_width_top = 2
	card.border_width_bottom = 2
	card.border_color = BOARD_EDGE
	card.content_margin_left = 5.0
	card.content_margin_top = 4.0
	card.content_margin_right = 5.0
	card.content_margin_bottom = 4.0
	return card


## The plate a station heading sits on. The ledger keeps the authored wooden bar; the
## board draws its own, so a heading and the rows under it belong to the same surface.
static func header_style() -> StyleBox:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.23, 0.16, 0.1, 0.98)
	box.border_width_bottom = 2
	box.border_color = BOARD_EDGE
	box.content_margin_left = 5.0
	box.content_margin_right = 5.0
	box.content_margin_top = 2.0
	box.content_margin_bottom = 2.0
	return box


## The small filled plate that states a row's verdict, or its action.
static func tag_style(state: String) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = state_colour(state)
	box.content_margin_left = 4.0
	box.content_margin_right = 4.0
	box.content_margin_top = 1.0
	box.content_margin_bottom = 1.0
	box.corner_radius_top_left = 2
	box.corner_radius_top_right = 2
	box.corner_radius_bottom_left = 2
	box.corner_radius_bottom_right = 2
	return box


## A label with the body face at an explicit size and the direction's text colour.
## `role` picks the theme variation for weight/colour defaults; the face and size are
## set here so a direction change is one call, not a theme rebuild.
static func face_label(text: String, role: String, size: int, colour: Color) -> Label:
	var out := label(text, role, size)
	var chosen := body_face()
	if is_board() and role in ["heading", "title"]:
		chosen = display_face()
	if chosen != null:
		out.add_theme_font_override("font", chosen)
	out.add_theme_color_override("font_color", colour)
	return out
