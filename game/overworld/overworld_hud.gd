class_name OverworldHud
extends CanvasLayer
## The survival HUD: where you are, how much you are carrying, what you have found,
## and the one line the world is telling you.
##
## This is the screen the player stares at for hours, so it is dressed from the
## authored kit (parchment card, wood bar, pack icons) instead of coloured rectangles,
## and it stays in the corner so it never covers the tile the player is walking into.
##
## Every number here is handed in by the owner. The HUD never reads the save file,
## never totals an inventory itself, and shows nothing it has not been told - an
## unknown season is simply absent rather than guessed.

signal respawn_requested

## Virtual-pixel footprint. The viewport is 640x360 and stretches to 720/1080/1440/
## 2160 by whole multiples, so these are the real on-screen sizes divided by 2..6.
const CARD_WIDTH := 214
const CARD_HEIGHT := 46

var _card: PanelContainer
var _region_label: Label
var _provisions_bar: Dictionary
var _provisions_number: Label
var _carry_label: Label
var _chips: Dictionary = {}
var _prompt_bar: PanelContainer
var _prompt_label: Label
var _prompt_timer := 0.0
var _hint_label: Label
var _death_panel: PanelContainer
var _death_message: Label
var _death_title: Label
var _death_button: Button


func _ready() -> void:
	layer = 20
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	set_process(true)


func _build() -> void:
	var root := A6UiKit.layer(self, 20, "HudLayer")
	root.name = "Root"
	A6UiKit.dress(root)

	_build_field_card(root)
	_build_hint(root)
	_build_prompt(root)


## Top-left: region, provisions, carry, and the three discovery counters.
func _build_field_card(root: Control) -> void:
	_card = A6UiKit.card()
	_card.name = "FieldCard"
	_card.position = Vector2(6, 5)
	_card.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	_card.size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	root.add_child(_card)

	var column := VBoxContainer.new()
	column.name = "Rows"
	column.add_theme_constant_override("separation", 1)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card.add_child(column)

	_region_label = A6UiKit.label("THE HOLLOW MARCHES", "heading", 13)
	_region_label.add_theme_color_override("font_color", A6UiKit.INK)
	_region_label.name = "Region"
	column.add_child(_region_label)

	var provisions_row := HBoxContainer.new()
	provisions_row.name = "ProvisionsRow"
	provisions_row.add_theme_constant_override("separation", 4)
	provisions_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(provisions_row)

	var pack_icon := A6UiKit.icon("capacity", 14)
	if pack_icon != null:
		pack_icon.name = "PackIcon"
		provisions_row.add_child(pack_icon)

	_provisions_bar = A6UiKit.bar(112, 9)
	var bar_root: Control = _provisions_bar["root"]
	bar_root.name = "ProvisionsBar"
	bar_root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	provisions_row.add_child(bar_root)

	_provisions_number = A6UiKit.label("0", "number", 12)
	_provisions_number.add_theme_color_override("font_color", A6UiKit.INK)
	_provisions_number.name = "ProvisionsNumber"
	provisions_row.add_child(_provisions_number)

	_carry_label = A6UiKit.label("", "caption", 10)
	_carry_label.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_carry_label.name = "Carry"
	column.add_child(_carry_label)

	var counters := HBoxContainer.new()
	counters.name = "Counters"
	counters.add_theme_constant_override("separation", 7)
	counters.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(counters)
	_chips["camps"] = A6UiKit.chip("shelter", "0/0", 11, 10)
	_chips["camps"].name = "CampsChip"
	counters.add_child(_chips["camps"])
	_chips["finds"] = A6UiKit.chip("research_kit", "0/0", 11, 10)
	_chips["finds"].name = "FindsChip"
	counters.add_child(_chips["finds"])
	_chips["ways"] = A6UiKit.chip("travel", "0/0", 11, 10)
	_chips["ways"].name = "WaysChip"
	counters.add_child(_chips["ways"])
	for chip_name: String in _chips.keys():
		_ink_chip(_chips[chip_name] as Node)


## Chip numbers sit on parchment, so they are ink rather than cream.
func _ink_chip(chip: Node) -> void:
	for child: Node in chip.get_children():
		if child is Label:
			(child as Label).add_theme_color_override("font_color", A6UiKit.INK)


func _build_hint(root: Control) -> void:
	_hint_label = A6UiKit.world_label(
		"WASD move  ·  CLICK interact  ·  B build  ·  C craft  ·  ESC retreat", 8
	)
	_hint_label.name = "Hints"
	_hint_label.modulate = Color(1, 1, 1, 0.75)
	_hint_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_hint_label.offset_left = 8
	_hint_label.offset_top = -14
	_hint_label.offset_bottom = -3
	root.add_child(_hint_label)


## Bottom-centre: the world's current line, on a plank so it reads over grass, stone,
## snow or lava without an outline halo around every letter.
func _build_prompt(root: Control) -> void:
	_prompt_bar = PanelContainer.new()
	_prompt_bar.name = "PromptPlate"
	_prompt_bar.theme_type_variation = &"A6HudBar"
	_prompt_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt_bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt_bar.anchor_left = 0.5
	_prompt_bar.anchor_right = 0.5
	_prompt_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_prompt_bar.offset_top = -34
	_prompt_bar.offset_bottom = -18
	_prompt_bar.visible = false
	root.add_child(_prompt_bar)

	_prompt_label = A6UiKit.label("", "body", 11)
	_prompt_label.add_theme_color_override("font_color", A6UiKit.CREAM)
	_prompt_label.name = "Prompt"
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_bar.add_child(_prompt_label)


func show_death(message: String, title := "YOU FELL") -> void:
	if _death_panel == null:
		_death_panel = A6UiKit.window()
		_death_panel.name = "OverworldDeath"
		_death_panel.add_to_group(&"gameplay_modal")
		_death_panel.process_mode = Node.PROCESS_MODE_ALWAYS
		_death_panel.set_anchors_and_offsets_preset(
			Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE
		)
		_death_panel.custom_minimum_size = Vector2(250, 0)
		add_child(_death_panel)
		var column := VBoxContainer.new()
		column.name = "Column"
		column.add_theme_constant_override("separation", 6)
		_death_panel.add_child(column)
		_death_title = A6UiKit.label(title, "heading", 16)
		_death_title.name = "DeathTitle"
		column.add_child(_death_title)
		_death_message = A6UiKit.label("", "body", 11)
		_death_message.name = "DeathMessage"
		_death_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_death_message.custom_minimum_size = Vector2(220, 0)
		column.add_child(_death_message)
		var button := Button.new()
		button.name = "Respawn"
		button.text = "WAKE UP"
		button.custom_minimum_size = Vector2(0, 22)
		button.pressed.connect(func() -> void: respawn_requested.emit())
		column.add_child(button)
		_death_button = button
	_death_title.text = title
	_death_message.text = message
	_death_panel.show()
	if _death_button != null:
		# Keyboard players must be able to answer the death prompt without a mouse.
		_death_button.grab_focus()


func hide_death() -> void:
	if _death_panel != null:
		_death_panel.hide()


func set_region(text: String) -> void:
	if _region_label != null:
		_region_label.text = text


## `current`/`maximum` come from the run state; both are shown so an empty pack is
## never mistaken for a full one.
func set_provisions(current: int, maximum: int) -> void:
	if _provisions_number == null:
		return
	A6UiKit.set_bar(_provisions_bar, float(current), float(maximum))
	_provisions_number.text = "%d/%d" % [current, maximum]
	_provisions_number.add_theme_color_override(
		"font_color", A6UiKit.WARN if maximum > 0 and current * 5 <= maximum else A6UiKit.INK
	)


## The number of distinct item stacks the player is carrying, with the pack's own
## capacity so "full" is visible before the rejection prompt arrives.
func set_carry(used: int, capacity: int) -> void:
	if _carry_label == null:
		return
	if capacity <= 0:
		_carry_label.text = ""
		return
	_carry_label.text = "PACK %d/%d" % [used, capacity]
	_carry_label.add_theme_color_override(
		"font_color", A6UiKit.WARN if used >= capacity else A6UiKit.INK_SOFT
	)


func set_counts(camps: int, camps_total: int, discoveries: int, discoveries_total: int,
		shortcuts: int, shortcuts_total: int) -> void:
	_set_chip_text("camps", "%d/%d" % [camps, camps_total])
	_set_chip_text("finds", "%d/%d" % [discoveries, discoveries_total])
	_set_chip_text("ways", "%d/%d" % [shortcuts, shortcuts_total])


func _set_chip_text(key: String, text: String) -> void:
	var chip_value: Variant = _chips.get(key, null)
	if chip_value == null:
		return
	for child: Node in (chip_value as Node).get_children():
		if child is Label:
			(child as Label).text = text


func show_prompt(text: String, seconds := 3.0) -> void:
	if _prompt_label == null:
		return
	_prompt_label.text = text
	_prompt_timer = seconds
	if _prompt_bar != null:
		_prompt_bar.visible = not text.is_empty()


func prompt_text() -> String:
	return _prompt_label.text if _prompt_label != null else ""


func _process(delta: float) -> void:
	if _prompt_timer > 0.0:
		_prompt_timer -= delta
		if _prompt_timer <= 0.0 and _prompt_label != null:
			_prompt_label.text = ""
			if _prompt_bar != null:
				_prompt_bar.visible = false
