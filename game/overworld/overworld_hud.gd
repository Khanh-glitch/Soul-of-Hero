class_name OverworldHud
extends CanvasLayer
## Overworld HUD: where you are, what you carry, what you have found, and the
## one-line prompt the world is currently telling you.

signal respawn_requested

const PANEL_BG := Color(0.05, 0.04, 0.07, 0.72)
const TEXT := Color(0.92, 0.88, 0.78)
const ACCENT := Color(1.0, 0.90, 0.58)
const WARN := Color(0.95, 0.58, 0.45)
const GOOD := Color(0.66, 0.92, 0.70)

var _region_label: Label
var _provisions_label: Label
var _provisions_fill: ColorRect
var _counts_label: Label
var _prompt_label: Label
var _prompt_timer := 0.0
var _hint_label: Label
var _death_panel: PanelContainer
var _death_message: Label


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	set_process(true)


func _build() -> void:
	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var frame := PanelContainer.new()
	frame.name = "Plate"
	frame.position = Vector2(8, 6)
	frame.custom_minimum_size = Vector2(244, 44)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL_BG
	style.border_color = Color(0.32, 0.28, 0.22, 0.9)
	style.set_border_width_all(1)
	style.set_corner_radius_all(2)
	frame.add_theme_stylebox_override("panel", style)
	root.add_child(frame)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 1)
	frame.add_child(column)

	_region_label = _label("THE HOLLOW MARCHES", 11, TEXT)
	column.add_child(_region_label)

	var bar_row := HBoxContainer.new()
	bar_row.add_theme_constant_override("separation", 5)
	column.add_child(bar_row)

	_provisions_label = _label("PROVISIONS", 8, Color(0.78, 0.74, 0.64))
	_provisions_label.custom_minimum_size = Vector2(74, 10)
	bar_row.add_child(_provisions_label)

	var bar := ColorRect.new()
	bar.color = Color(0.10, 0.09, 0.11, 0.95)
	bar.custom_minimum_size = Vector2(120, 6)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar_row.add_child(bar)

	_provisions_fill = ColorRect.new()
	_provisions_fill.color = Color(0.72, 0.56, 0.26)
	_provisions_fill.position = Vector2(1, 1)
	_provisions_fill.size = Vector2(118, 4)
	bar.add_child(_provisions_fill)

	_counts_label = _label("", 8, Color(0.70, 0.68, 0.60))
	column.add_child(_counts_label)

	# Anchored to the bottom edge, not pinned to y=340: the window stretches with
	# the player's monitor and an absolutely positioned hint would drift.
	_hint_label = _label(
		"WASD move  ·  CLICK interact  ·  B build  ·  C craft  ·  ESC retreat",
		8,
		Color(0.62, 0.60, 0.54)
	)
	_hint_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_hint_label.offset_left = 9
	_hint_label.offset_top = -16
	_hint_label.offset_bottom = -4
	root.add_child(_hint_label)

	_prompt_label = _label("", 11, ACCENT)
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_prompt_label.offset_top = -44
	_prompt_label.offset_bottom = -26
	_prompt_label.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.05))
	_prompt_label.add_theme_constant_override("outline_size", 5)
	root.add_child(_prompt_label)


func show_death(message: String) -> void:
	if _death_panel == null:
		_death_panel = PanelContainer.new()
		_death_panel.name = "OverworldDeath"
		_death_panel.add_to_group(&"gameplay_modal")
		_death_panel.set_anchors_preset(Control.PRESET_CENTER)
		_death_panel.position = Vector2(-120, -50)
		_death_panel.custom_minimum_size = Vector2(240, 100)
		_death_panel.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(_death_panel)
		var column := VBoxContainer.new()
		_death_panel.add_child(column)
		_death_message = _label("", 12, TEXT)
		_death_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		column.add_child(_death_message)
		var button := Button.new()
		button.name = "Respawn"
		button.text = "Respawn"
		button.pressed.connect(func() -> void: respawn_requested.emit())
		column.add_child(button)
	_death_message.text = message
	_death_panel.show()


func hide_death() -> void:
	if _death_panel != null:
		_death_panel.hide()


func _label(text: String, size: int, colour: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", colour)
	label.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.05))
	label.add_theme_constant_override("outline_size", 4)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func set_region(text: String) -> void:
	if _region_label != null:
		_region_label.text = text


func set_provisions(current: int, maximum: int) -> void:
	if _provisions_label == null:
		return
	var ratio := 0.0 if maximum <= 0 else clampf(float(current) / float(maximum), 0.0, 1.0)
	_provisions_fill.size.x = maxf(0.0, 118.0 * ratio)
	if ratio < 0.15:
		_provisions_fill.color = WARN
	elif ratio < 0.4:
		_provisions_fill.color = Color(0.86, 0.68, 0.32)
	else:
		_provisions_fill.color = Color(0.72, 0.56, 0.26)
	_provisions_label.text = "PROVISIONS %d" % current


func set_counts(camps: int, camps_total: int, discoveries: int, discoveries_total: int,
		shortcuts: int, shortcuts_total: int) -> void:
	if _counts_label == null:
		return
	_counts_label.text = "CAMPS %d/%d   FINDS %d/%d   WAYS %d/%d" % [
		camps, camps_total, discoveries, discoveries_total, shortcuts, shortcuts_total,
	]


func show_prompt(text: String, seconds := 3.0) -> void:
	if _prompt_label == null:
		return
	_prompt_label.text = text
	_prompt_timer = seconds


func prompt_text() -> String:
	return _prompt_label.text if _prompt_label != null else ""


func _process(delta: float) -> void:
	if _prompt_timer > 0.0:
		_prompt_timer -= delta
		if _prompt_timer <= 0.0 and _prompt_label != null:
			_prompt_label.text = ""
