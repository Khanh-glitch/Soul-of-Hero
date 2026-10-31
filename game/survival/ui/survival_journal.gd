extends Control
## Isolated journal; host supplies snapshots and handles every action request.
## This scene never mutates a save, starts a build, or changes combat input.

signal closed
signal modal_state_changed(active: bool)
signal item_selected(stack_key: String)
signal desk_requested

const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
const INK := Color("171b2c")
const PANEL := Color("273344")
const EDGE := Color("687b7e")
const PAPER := Color("f4e6c8")
const MUTED := Color("b1c6bf")
const TEAL := Color("75d3bd")
const CORAL := Color("ffad8f")

var show_workspace_navigation := false
var _items: Array[Dictionary] = []
var _build: Dictionary = {}
var _field: Array[Dictionary] = []
var _selected := -1
var _tab := 0
var _content: VBoxContainer
var _detail: VBoxContainer
var _tabs: Array[Button] = []
var _previous_focus: Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build_ui()
	_refresh()

func is_modal_active() -> bool:
	return is_visible_in_tree()

func open_journal() -> void:
	if visible: return
	_previous_focus = get_viewport().gui_get_focus_owner()
	visible = true
	modal_state_changed.emit(true)
	if not _tabs.is_empty():
		_tabs[_tab].grab_focus()

func close_journal() -> void:
	if not visible: return
	visible = false
	modal_state_changed.emit(false)
	if is_instance_valid(_previous_focus) and _previous_focus.is_visible_in_tree():
		_previous_focus.grab_focus()
	closed.emit()

func _unhandled_key_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		close_journal()
		get_viewport().set_input_as_handled()

func set_bag(items: Array[Dictionary]) -> void:
	var previous := ""
	if _selected >= 0 and _selected < _items.size(): previous = String(_items[_selected].get("stack_key", ""))
	_items = items.duplicate(true)
	_selected = -1
	if not previous.is_empty():
		for i in _items.size():
			if String(_items[i].get("stack_key", "")) == previous:
				_selected = i
				break
	if is_inside_tree(): _refresh()

func set_placement(info: Dictionary) -> void:
	_build = info.duplicate(true)
	if is_inside_tree(): _refresh()

## Caller is responsible for spoiler filtering; the view displays only supplied entries.
func set_field_entries(entries: Array[Dictionary]) -> void:
	_field = entries.duplicate(true)
	if is_inside_tree(): _refresh()

func select_tab(index: int) -> void:
	_tab = clampi(index, 0, 2)
	if visible and not _tabs.is_empty(): _tabs[_tab].grab_focus()
	_refresh()

func select_item(index: int) -> void:
	if index < 0 or index >= _items.size(): return
	_selected = index
	item_selected.emit(String(_items[index].get("stack_key", "")))
	_refresh_detail()

func _style(bg: Color, border: Color, width := 1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(width)
	style.content_margin_left = 8
	style.content_margin_right = 8
	style.content_margin_top = 5
	style.content_margin_bottom = 5
	return style

func _label(text: String, size := 10, color := PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.clip_text = true
	button.tooltip_text = text
	button.focus_mode = Control.FOCUS_ALL
	button.add_theme_font_size_override("font_size", 10)
	button.add_theme_color_override("font_color", PAPER)
	button.add_theme_stylebox_override("normal", _style(INK, EDGE))
	button.add_theme_stylebox_override("hover", _style(Color("384d54"), TEAL))
	button.add_theme_stylebox_override("pressed", _style(Color("46665e"), TEAL))
	button.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), Color("ffe5a3"), 2))
	return button

func _build_ui() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0.035, 0.05, 0.075, 0.84)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["margin_left", "margin_right"]: margin.add_theme_constant_override(side, 20)
	for side: String in ["margin_top", "margin_bottom"]: margin.add_theme_constant_override(side, 14)
	add_child(margin)
	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", _style(PANEL, EDGE, 2))
	margin.add_child(frame)
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 5)
	frame.add_child(root)
	var header := HBoxContainer.new()
	root.add_child(header)
	var title := _label("✦  FIELD JOURNAL", 16, PAPER)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var desk := _button("DESK")
	desk.visible = show_workspace_navigation
	desk.custom_minimum_size.x = 48
	desk.tooltip_text = "Open expedition desk"
	desk.pressed.connect(func(): desk_requested.emit())
	header.add_child(desk)
	var close := _button("ESC  CLOSE")
	close.custom_minimum_size.x = 76
	close.pressed.connect(close_journal)
	header.add_child(close)
	var sub := _label("SOUL OF HERO   /   SURVIVAL", 8, MUTED)
	root.add_child(sub)
	var tabs := HBoxContainer.new()
	root.add_child(tabs)
	for index in 3:
		var tab := _button(["01  SATCHEL", "02  BUILD", "03  FIELD NOTES"][index])
		tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tab.pressed.connect(select_tab.bind(index))
		tabs.add_child(tab)
		_tabs.append(tab)
	# Explicit row order; dynamic content still uses Godot's automatic neighbors.
	for i in _tabs.size():
		_tabs[i].focus_neighbor_left = _tabs[i].get_path_to(_tabs[(i + _tabs.size() - 1) % _tabs.size()])
		_tabs[i].focus_neighbor_right = _tabs[i].get_path_to(_tabs[(i + 1) % _tabs.size()])
	var columns := HBoxContainer.new()
	columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	columns.add_theme_constant_override("separation", 8)
	root.add_child(columns)
	var left := PanelContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.size_flags_stretch_ratio = 1.25
	left.add_theme_stylebox_override("panel", _style(INK, EDGE))
	columns.add_child(left)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_content)
	var right := PanelContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_stylebox_override("panel", _style(Color("202d39"), EDGE))
	columns.add_child(right)
	var details_scroll := ScrollContainer.new()
	details_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(details_scroll)
	_detail = VBoxContainer.new()
	_detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details_scroll.add_child(_detail)
	root.add_child(_label("TAB / ARROWS  navigate     ENTER  inspect     ESC  return", 8, MUTED))

func _clear(node: Node) -> void:
	for child in node.get_children():
		node.remove_child(child)
		child.queue_free()

func _refresh() -> void:
	if _content == null: return
	var focus := get_viewport().gui_get_focus_owner()
	var list_had_focus := is_instance_valid(focus) and _content.is_ancestor_of(focus)
	_clear(_content)
	for i in _tabs.size():
		_tabs[i].add_theme_color_override("font_color", TEAL if i == _tab else PAPER)
	match _tab:
		0:
			_content.add_child(_label("YOUR SATCHEL  /  %d STACKS" % _items.size(), 10, TEAL))
			if _items.is_empty(): _content.add_child(_label("Your satchel is empty.", 10, MUTED))
			for i in _items.size():
				var item := _items[i]
				var button := _button("%s   ×%d" % [String(item.get("name", "Unknown")), int(item.get("count", 0))])
				button.alignment = HORIZONTAL_ALIGNMENT_LEFT
				button.pressed.connect(select_item.bind(i))
				_content.add_child(button)
		1:
			_content.add_child(_label("PLACEMENT ADVISOR", 10, TEAL))
			_content.add_child(_label(String(_build.get("name", "No build selected")), 14))
			_content.add_child(_label(String(_build.get("status", "Open the construction tool to inspect a location.")), 10, CORAL))
			for row: Dictionary in _build.get("costs", []):
				var missing := int(row.get("missing", 0))
				_content.add_child(_label("%s   %d / %d%s" % [row.get("name", "Material"), row.get("have", 0), row.get("required", 0), "   · missing %d" % missing if missing > 0 else "   · ready"], 10, CORAL if missing > 0 else TEAL))
				var sources: Array = row.get("sources", [])
				if missing > 0 and not sources.is_empty():
					_content.add_child(_label("  Known source: %s" % ", ".join(sources), 9, MUTED))
		2:
			_content.add_child(_label("DISCOVERED NOTES", 10, TEAL))
			if _field.is_empty(): _content.add_child(_label("No notes yet. Explore to discover more.", 10, MUTED))
			for entry: Dictionary in _field:
				_content.add_child(_label(String(entry.get("title", "Note")), 12))
				_content.add_child(_label(String(entry.get("text", "")), 10, MUTED))
	_refresh_detail()
	if list_had_focus and is_visible_in_tree(): _tabs[_tab].grab_focus()

func _refresh_detail() -> void:
	_clear(_detail)
	if _tab == 0:
		if _selected < 0 or _selected >= _items.size():
			_detail.add_child(_label("INSPECT", 11, TEAL))
			_detail.add_child(_label("Select a stack to see its details.", 10, MUTED))
			return
		var item := _items[_selected]
		_detail.add_child(_label("ITEM  /  %s" % String(item.get("kind", "item")).to_upper(), 9, TEAL))
		_detail.add_child(_label(String(item.get("name", "Unknown")), 15))
		_detail.add_child(_label("Quantity  ×%d" % int(item.get("count", 0)), 11))
		if item.has("condition"): _detail.add_child(_label("Condition  %s" % item.condition, 10, CORAL))
		if item.has("charges") and item.has("max_charges"): _detail.add_child(_label(ADAPTER.core_status(int(item.charges), int(item.max_charges)), 10, TEAL))
		if item.has("source_hint"): _detail.add_child(_label("Look for: %s" % item.source_hint, 10, MUTED))
	else:
		_detail.add_child(_label("FIELD GUIDE", 11, TEAL))
		_detail.add_child(_label("The world reveals more as you explore. Your discoveries and preparation matter.", 10, MUTED))
