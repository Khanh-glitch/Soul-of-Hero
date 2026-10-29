extends Control
## Isolated journal; host supplies snapshots and handles every action request.
## This scene never mutates a save, starts a build, or changes combat input.

signal closed
signal modal_state_changed(active: bool)
signal item_selected(stack_key: String)
signal desk_requested
signal journeys_requested

const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
const PIXEL_PANEL := preload("res://game/survival/ui/pixel_panel.gd")
const INK := Color("111923")
const PANEL := Color("30231f")
const EDGE := Color("b77b4e")
const PAPER := Color("f6e8c9")
const MUTED := Color("b8c4b2")
const TEAL := Color("91d6ac")
const CORAL := Color("ff9278")

var show_workspace_navigation := false
var show_journeys_navigation := false
var _items: Array[Dictionary] = []
var _build: Dictionary = {}
var _field: Array[Dictionary] = []
var _selected := -1
var _tab := 0
var _content: VBoxContainer
var _detail: VBoxContainer
var _tabs: Array[Button] = []
var _modal_reported := false
var _previous_focus: Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build_ui()
	_refresh()
	tree_exiting.connect(func(): _sync_modal_state(true))

func is_modal_active() -> bool:
	_sync_modal_state()
	return _modal_reported

func _process(_delta: float) -> void:
	_sync_modal_state()

func _sync_modal_state(force_closed := false) -> void:
	var active := not force_closed and is_visible_in_tree()
	if active == _modal_reported: return
	_modal_reported = active
	modal_state_changed.emit(active)

func open_journal() -> void:
	if visible: return
	_previous_focus = get_viewport().gui_get_focus_owner()
	visible = true
	_sync_modal_state()
	if not _tabs.is_empty():
		_tabs[_tab].grab_focus()

func close_journal() -> void:
	if not visible: return
	visible = false
	_sync_modal_state()
	if is_instance_valid(_previous_focus) and _previous_focus.is_visible_in_tree():
		_previous_focus.grab_focus()
	closed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if not visible or event.is_echo(): return
	var cancel := event.is_action_pressed(&"pause") or event.is_action_pressed(&"ui_cancel")
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE: cancel = true
	if cancel:
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
	return PIXEL_UI.panel_style(bg, border, width)

func _label(text: String, size := 10, color := PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	PIXEL_UI.style_label(label, size, color, size >= 14)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.clip_text = true
	button.tooltip_text = text
	button.focus_mode = Control.FOCUS_ALL
	PIXEL_UI.style_button(button)
	return button

func _panel(fill: Color, edge: Color) -> PanelContainer:
	var panel: PanelContainer = PIXEL_PANEL.new()
	panel.configure(fill, edge, PIXEL_UI.GOLD)
	return panel

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
	var frame := _panel(PANEL, EDGE)
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
	var journeys := _button("JOURNEY")
	journeys.visible = show_journeys_navigation
	journeys.custom_minimum_size.x = 58
	journeys.tooltip_text = "Open the three fixture-labeled acceptance journeys"
	journeys.pressed.connect(func(): journeys_requested.emit())
	header.add_child(journeys)
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
	var left := _panel(INK, EDGE)
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.size_flags_stretch_ratio = 1.25
	columns.add_child(left)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_content)
	var right := _panel(Color("261f22"), EDGE)
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
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
				button.icon = PIXEL_UI.icon_texture(item)
				button.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
				button.expand_icon = false
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
		if String(item.get("kind", "")) == "core" or item.has("uses"):
			_detail.add_child(_label("PHYSICAL SPECIMEN  /  %s" % String(item.get("instance_id", item.get("stack_key", "instance unavailable"))), 9, PIXEL_UI.GOLD))
		if item.has("condition"):
			var condition_text := "%s" % item.condition
			if item.has("max_condition"): condition_text = "%s / %s" % [item.condition, item.max_condition]
			_detail.add_child(_label("Condition  %s" % condition_text, 10, CORAL if item.condition is int and int(item.condition) < 35 else MUTED))
		if item.has("uses") and item.has("max_uses"):
			_detail.add_child(_label(ADAPTER.core_status(int(item.uses), int(item.max_uses)), 11, TEAL if int(item.uses) > 0 else CORAL))
		if item.has("equipped"):
			_detail.add_child(_label("Loadout  %s" % ("Equipped" if bool(item.equipped) else "Stored"), 10, TEAL))
		if item.has("formula_learned"):
			_detail.add_child(_label("Permanent formula  %s" % ("Learned" if bool(item.formula_learned) else "Not learned"), 10, TEAL if bool(item.formula_learned) else MUTED))
		else:
			_detail.add_child(_label("Permanent formula  Separate profile state", 9, MUTED))
		if item.has("source_hint"): _detail.add_child(_label("Look for: %s" % item.source_hint, 10, MUTED))
	else:
		_detail.add_child(_label("FIELD GUIDE", 11, TEAL))
		_detail.add_child(_label("The world reveals more as you explore. Your discoveries and preparation matter.", 10, MUTED))
