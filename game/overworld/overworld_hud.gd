class_name OverworldHud
extends CanvasLayer
## The survival HUD: where you are, how you are doing, what you carry, and the one
## line the world is telling you.
##
## This is the screen the player stares at for hours, so it is dressed from the
## authored kit (parchment card, wood bars, pack icons) rather than coloured
## rectangles, and it holds one column in the top-left corner so it never covers the
## tile the player is walking into.
##
## Every number here is handed in by the owner. The HUD never reads the save file,
## never totals an inventory itself, and shows nothing it has not been told: vitals
## stay absent until the world emits them, an unknown season is absent rather than
## guessed, and a discovery counter whose total is zero is hidden instead of standing
## there as 0/0.
##
## Layout is authored in the 640x360 virtual space the whole interface uses, so it
## stretches to 720p/1440p/2160p by whole multiples.

signal respawn_requested

## Virtual-pixel footprint. Only the width is pinned; the parchment grows to whatever
## the rows need, which is what keeps a long region name from being clipped by its own
## card (the previous fixed 46-unit height did exactly that).
const CARD_WIDTH := 214
const CARD_X := 6
const CARD_Y := 5
const BAR_WIDTH := 92
const BAR_HEIGHT := 7

var _root: Control
var _card: PanelContainer
var _region_label: Label
var _vitals_row: HBoxContainer
var _vitals_bar: Dictionary
var _vitals_number: Label
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
	_listen_to_owner()
	set_process(true)


## Vitals are only ever what the owner says they are. If the signal never fires the
## row stays hidden; it is never seeded with a made-up full bar.
func _listen_to_owner() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events == null:
		return
	if events.has_signal("player_health_changed"):
		events.connect("player_health_changed", _on_health_changed)
	if events.has_signal("hero_health_pools_changed"):
		events.connect("hero_health_pools_changed", _on_health_pools_changed)


func _build() -> void:
	# Built straight onto this CanvasLayer: nesting a second CanvasLayer inside the
	# HUD's own would put the death card in a sibling draw pass for no benefit.
	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root = root
	add_child(root)
	A6UiKit.dress(root)

	_build_field_card(root)
	_build_hint(root)
	_build_prompt(root)


## Top-left: where you are, then vitals and provisions as bars, then the quiet
## strip of discovery counters. Order is the order the player needs them.
func _build_field_card(root: Control) -> void:
	_card = A6UiKit.card()
	_card.theme_type_variation = &"A6HudCard"
	_card.name = "FieldCard"
	_card.position = Vector2(CARD_X, CARD_Y)
	# Width is pinned so the card has a stable silhouette; height is the content's.
	_card.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	root.add_child(_card)

	var column := VBoxContainer.new()
	column.name = "Rows"
	column.add_theme_constant_override("separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card.add_child(column)

	_region_label = A6UiKit.label("THE HOLLOW MARCHES", "caption", 8)
	_region_label.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_region_label.name = "Region"
	# clip_text drops the label's minimum width to zero, so a long region name can be
	# trimmed with an ellipsis instead of widening the card past the safe corner.
	_region_label.clip_text = true
	_region_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_region_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_child(_region_label)

	_vitals_row = _bar_row("VitalsRow", "health", "0/0")
	_vitals_row.visible = false
	_vitals_bar = _vitals_row.get_meta("bar")
	_vitals_number = _vitals_row.get_meta("number")
	column.add_child(_vitals_row)

	var provisions_row := _bar_row("ProvisionsRow", "capacity", "0/0")
	_provisions_bar = provisions_row.get_meta("bar")
	_provisions_number = provisions_row.get_meta("number")
	column.add_child(provisions_row)

	var footer := HBoxContainer.new()
	footer.name = "Footer"
	footer.add_theme_constant_override("separation", 6)
	footer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(footer)

	_carry_label = A6UiKit.label("", "caption", 8)
	_carry_label.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_carry_label.name = "Carry"
	_carry_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	footer.add_child(_carry_label)

	var filler := Control.new()
	filler.name = "Filler"
	filler.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	filler.mouse_filter = Control.MOUSE_FILTER_IGNORE
	footer.add_child(filler)

	var counters := HBoxContainer.new()
	counters.name = "Counters"
	counters.add_theme_constant_override("separation", 6)
	counters.mouse_filter = Control.MOUSE_FILTER_IGNORE
	footer.add_child(counters)
	_chips["camps"] = A6UiKit.chip("camp_light", "0", 8, 9)
	_chips["finds"] = A6UiKit.chip("research_kit", "0", 8, 9)
	_chips["ways"] = A6UiKit.chip("travel", "0", 8, 9)
	_chips["camps"].name = "CampsChip"
	_chips["finds"].name = "FindsChip"
	_chips["ways"].name = "WaysChip"
	for chip_name: String in _chips.keys():
		var chip_node: Node = _chips[chip_name]
		_ink_chip(chip_node)
		counters.add_child(chip_node)


## One status line: an icon, an authored track with a growing plank, and the numbers.
## The parts are handed back on the row so callers can set the ratio without a lookup.
func _bar_row(node_name: String, icon_id: String, text: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = node_name
	row.add_theme_constant_override("separation", 4)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var picture := A6UiKit.icon(icon_id, 10)
	if picture != null:
		picture.name = "Icon"
		picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(picture)

	var bar_parts := A6UiKit.bar(BAR_WIDTH, BAR_HEIGHT)
	var bar_root: Control = bar_parts["root"]
	bar_root.name = "Bar"
	bar_root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar_root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(bar_root)

	var number := A6UiKit.label(text, "number", 10)
	number.add_theme_color_override("font_color", A6UiKit.INK)
	number.name = "Number"
	number.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(number)

	row.set_meta("bar", bar_parts)
	row.set_meta("number", number)
	return row


## Chip numbers sit on parchment, so they are ink rather than cream.
func _ink_chip(chip: Node) -> void:
	for child: Node in chip.get_children():
		if child is Label:
			(child as Label).add_theme_color_override("font_color", A6UiKit.INK)


## The keys are a quiet legend, not a headline: small, outlined so they survive a
## bright sand tile, and in the same language as the rest of the interface.
func _build_hint(root: Control) -> void:
	_hint_label = A6UiKit.world_label(
		"WASD di chuyển  ·  Click tương tác  ·  B xây dựng  ·  C chế tạo  ·  ESC rút lui", 9
	)
	_hint_label.name = "Hints"
	_hint_label.modulate = Color(1, 1, 1, 0.78)
	_hint_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_hint_label.offset_left = 8
	_hint_label.offset_top = -16
	_hint_label.offset_bottom = -4
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

	_prompt_label = A6UiKit.label("", "body", 10)
	_prompt_label.add_theme_color_override("font_color", A6UiKit.CREAM)
	_prompt_label.name = "Prompt"
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_bar.add_child(_prompt_label)


func show_death(message: String, title := "NGÃ XUỐNG") -> void:
	if _death_panel == null:
		# Parented to the themed root, not to this CanvasLayer. A card added to the
		# layer inherits Godot's default theme, which is why the death prompt used to
		# render as a black debug box with the heading outside its own panel.
		var centre := CenterContainer.new()
		centre.name = "DeathCentre"
		centre.set_anchors_preset(Control.PRESET_FULL_RECT)
		centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
		(_root if _root != null else self).add_child(centre)

		_death_panel = A6UiKit.window()
		_death_panel.name = "OverworldDeath"
		_death_panel.add_to_group(&"gameplay_modal")
		_death_panel.process_mode = Node.PROCESS_MODE_ALWAYS
		# CenterContainer sizes the card from its content, so the heading cannot end up
		# outside the parchment the way fixed center offsets allowed.
		_death_panel.custom_minimum_size = Vector2(252, 0)
		centre.add_child(_death_panel)
		var column := VBoxContainer.new()
		column.name = "Column"
		column.add_theme_constant_override("separation", 6)
		_death_panel.add_child(column)
		_death_title = A6UiKit.label(title, "heading", 16)
		_death_title.name = "DeathTitle"
		_death_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(_death_title)
		_death_message = A6UiKit.label("", "body", 11)
		_death_message.name = "DeathMessage"
		_death_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_death_message.custom_minimum_size = Vector2(228, 0)
		column.add_child(_death_message)
		var button := Button.new()
		button.name = "Respawn"
		button.text = "TỈNH DẬY"
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


## Owner-emitted vitals. Until this arrives the row is hidden: an empty bar would be
## an invented value, and a full one would be a lie.
func set_vitals(current: int, maximum: int) -> void:
	if _vitals_row == null:
		return
	if maximum <= 0:
		_vitals_row.visible = false
		return
	_vitals_row.visible = true
	A6UiKit.set_bar(_vitals_bar, float(current), float(maximum))
	_vitals_number.text = "%d/%d" % [current, maximum]
	_vitals_number.add_theme_color_override(
		"font_color", A6UiKit.WARN if current * 3 <= maximum else A6UiKit.INK
	)


func _on_health_changed(current: int, maximum: int) -> void:
	set_vitals(current, maximum)


func _on_health_pools_changed(snapshot: Dictionary) -> void:
	# The pools snapshot carries per-pool detail; the readable total is what the HUD
	# can state without inventing an aggregate the owner did not send.
	var current := int(snapshot.get("current", -1))
	var maximum := int(snapshot.get("maximum", -1))
	if current >= 0 and maximum > 0:
		set_vitals(current, maximum)


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
	_carry_label.text = "TÚI %d/%d" % [used, capacity]
	_carry_label.add_theme_color_override(
		"font_color", A6UiKit.WARN if used >= capacity else A6UiKit.INK_SOFT
	)


func set_counts(camps: int, camps_total: int, discoveries: int, discoveries_total: int,
		shortcuts: int, shortcuts_total: int) -> void:
	_set_chip_text("camps", "%d/%d" % [camps, camps_total], camps_total)
	_set_chip_text("finds", "%d/%d" % [discoveries, discoveries_total], discoveries_total)
	_set_chip_text("ways", "%d/%d" % [shortcuts, shortcuts_total], shortcuts_total)


## A world with nothing to find yet should not wear three 0/0 counters: the strip is
## an answer to "what is left out there", and it stays silent until there is one.
func _set_chip_text(key: String, text: String, total: int) -> void:
	var chip_value: Variant = _chips.get(key, null)
	if chip_value == null:
		return
	var chip_node := chip_value as Node
	chip_node.visible = total > 0
	for child: Node in chip_node.get_children():
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
