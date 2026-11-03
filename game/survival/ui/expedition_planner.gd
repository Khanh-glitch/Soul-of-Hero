extends Control
## Independent view, not a subsystem. All input dictionaries are proposed UI DTOs,
## not authoritative A0/A1/A3 schemas. Requests are validated by host services.
signal modal_state_changed(active: bool)
signal closed
signal request_action(action: String, target_id: String, payload: Dictionary)
signal snapshot_changed(snapshot: Dictionary)
signal journal_requested
signal journeys_requested

const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
const PIXEL_PANEL := preload("res://game/survival/ui/pixel_panel.gd")
const INK := Color("111923")
const PANEL := Color("30231f")
const EDGE := Color("b77b4e")
const PAPER := Color("f6e8c9")
const MUTED := Color("b8c4b2")
const TEAL := Color("91d6ac")
const CORAL := Color("ff9278")
const MAP := preload("res://game/survival/ui/expedition_map.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")

var show_workspace_navigation := false
var show_journeys_navigation := false
var _developer_diagnostics := false
var _snapshot: Dictionary = {}
var _tab := 0
var _selection := ""
var _direction := "deposit"
var _pending := false
var _pending_id := ""
var _pending_action := ""
var _pending_target := ""
var _pending_payload: Dictionary = {}
var _client_nonce := ""
var _request_serial := 0
var _snapshot_sequence := -1
var _message := ""
var _previous_focus: Control
var _tabs: Array[Button] = []
var _list: VBoxContainer
var _details: VBoxContainer
var _search: LineEdit
var _recipe_query := ""
var _storage_query := ""
var _amount: SpinBox
var _confirmation: ConfirmationDialog
var _modal_reported := false

func _ready() -> void:
	_client_nonce = Crypto.new().generate_random_bytes(16).hex_encode()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()
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

func open_planner() -> void:
	if visible: return
	_previous_focus = get_viewport().gui_get_focus_owner()
	visible = true
	_sync_modal_state()
	_tabs[_tab].grab_focus()

func close_planner() -> void:
	if not visible: return
	if is_instance_valid(_confirmation): _confirmation.hide()
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
		close_planner()
		get_viewport().set_input_as_handled()

func set_developer_diagnostics(enabled: bool) -> void:
	_developer_diagnostics = enabled
	if not enabled and String(_snapshot.get("provenance", "")) == "FIXTURE_PROJECTION":
		_snapshot.clear()
		_snapshot_sequence = -1
		_selection = ""
		_message = ""
		_clear_pending()
	if is_inside_tree(): _refresh()

## Replaces a view snapshot, never saves. Host must filter undiscovered information
## before passing it; fixture snapshots require explicit developer diagnostics.
func set_snapshot(snapshot: Dictionary) -> void:
	var schema := String(snapshot.get("schema", ""))
	if schema == "soh.ui.snapshot.v2":
		apply_snapshot(snapshot)
		return
	# Unversioned snapshots are a legacy fixture-only path. Release views accept
	# only the current owner DTO; diagnostics never become a production bridge.
	if not _developer_diagnostics or not schema.is_empty() or _snapshot_sequence >= 0: return
	if String(snapshot.get("provenance", "")) != "FIXTURE_PROJECTION": return
	_install_snapshot(snapshot)

func _install_snapshot(snapshot: Dictionary) -> void:
	_snapshot = snapshot.duplicate(true)
	if is_inside_tree(): _refresh()
	snapshot_changed.emit(_snapshot.duplicate(true))

## Called by host when request is completed or rejected. No local item/recipe update.
func resolve_request(message: String) -> void:
	# Compatibility only for explicit developer fixtures. Production responses
	# must use soh.ui.response.v2 and correlate to the pending request ID.
	if not _developer_diagnostics or not String(_snapshot.get("schema", "")).is_empty(): return
	_pending = false
	_clear_pending()
	_message = _safe_response_copy(message, false)
	if is_inside_tree(): _refresh_detail()

## Versioned UI DTO, not a production API. Producer supplies monotonic sequence.
func apply_snapshot(snapshot: Dictionary) -> bool:
	if snapshot.get("schema", "") != "soh.ui.snapshot.v2": return false
	var provenance := String(snapshot.get("provenance", ""))
	if provenance not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]: return false
	if provenance == "FIXTURE_PROJECTION" and not _developer_diagnostics: return false
	var revision := String(snapshot.get("revision", "")).strip_edges()
	var sequence: Variant = snapshot.get("sequence", null)
	if revision.is_empty() or typeof(sequence) != TYPE_INT or int(sequence) < 0 or int(sequence) < _snapshot_sequence: return false
	if int(sequence) == _snapshot_sequence and snapshot != _snapshot: return false
	_snapshot_sequence = int(sequence)
	_install_snapshot(snapshot)
	return true

## A response releases a request only when it correlates and carries a fresh
## authoritative snapshot. A0 acceptances also require an opaque SaveService
## receipt. Retried intents keep the same request ID; the owner must explicitly
## advertise durable idempotency before the UI offers retry.
func apply_host_response(response: Dictionary) -> bool:
	if not _pending or response.get("schema", "") != "soh.ui.response.v2": return false
	if String(response.get("request_id", "")) != _pending_id: return false
	var status := String(response.get("status", ""))
	if status not in ["accepted", "rejected"]: return false
	var next: Variant = response.get("snapshot", null)
	if not next is Dictionary: return false
	if status == "accepted":
		var response_provenance := String(next.get("provenance", ""))
		if response_provenance == "A0_OWNER_PROJECTION":
			var receipt_value: Variant = response.get("receipt_id", null)
			if (
				not receipt_value is String
				or String(receipt_value).strip_edges().is_empty()
				or String(receipt_value).length() > 160
				or response.get("receipt_owner", "") != "A0_SAVE_SERVICE"
			):
				return false
		elif response_provenance != "FIXTURE_PROJECTION" or not _developer_diagnostics:
			return false
	var next_sequence: Variant = next.get("sequence", null)
	var request_sequence: Variant = _pending_payload.get("sequence", null)
	var next_revision := String(next.get("revision", "")).strip_edges()
	var request_revision := String(_pending_payload.get("revision", "")).strip_edges()
	if (
		not next_sequence is int
		or not request_sequence is int
		or int(next_sequence) <= int(request_sequence)
		or int(next_sequence) <= _snapshot_sequence
		or next_revision.is_empty()
		or next_revision == request_revision
	):
		return false
	if not apply_snapshot(next): return false
	_clear_pending()
	_message = _response_copy(response, status)
	if is_inside_tree(): _refresh_detail()
	return true

func select_tab(index: int) -> void:
	if not _pending: _message = ""
	_tab = clampi(index, 0, 4)
	if visible and not _tabs.is_empty(): _tabs[_tab].grab_focus()
	_selection = ""
	_refresh()

func _select(id: String) -> void:
	if not _pending: _message = ""
	_selection = id
	_refresh_detail()

func _style(bg: Color, border: Color) -> StyleBoxFlat:
	return PIXEL_UI.panel_style(bg, border)

func _label(text: String, size := 10, color := PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	PIXEL_UI.style_label(label, size, color, size >= 14)
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

func _style_search(field: LineEdit) -> void:
	field.add_theme_font_override("font", PIXEL_UI.FONT_BODY)
	field.add_theme_font_size_override("font_size", 12)
	field.add_theme_color_override("font_color", PAPER)
	field.add_theme_color_override("font_placeholder_color", MUTED)
	field.add_theme_stylebox_override("normal", _style(INK, EDGE))
	field.add_theme_stylebox_override("focus", _style(Color("1a2226"), PIXEL_UI.GOLD))

func _build() -> void:
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
	var heading := _label("✦  EXPEDITION DESK", 16)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(heading)
	var satchel := _button("SATCHEL")
	satchel.visible = show_workspace_navigation
	satchel.custom_minimum_size.x = 58
	satchel.tooltip_text = "Switch to journal and satchel"
	satchel.pressed.connect(func(): journal_requested.emit())
	header.add_child(satchel)
	var journeys := _button("JOURNEYS")
	journeys.visible = show_journeys_navigation
	journeys.custom_minimum_size.x = 62
	journeys.tooltip_text = "Open the three fixture-labeled acceptance journeys"
	journeys.pressed.connect(func(): journeys_requested.emit())
	header.add_child(journeys)
	var close := _button("ESC  CLOSE")
	close.custom_minimum_size.x = 76
	close.pressed.connect(close_planner)
	header.add_child(close)
	root.add_child(_label("PLAN  /  PREPARE  /  RETURN", 8, MUTED))
	var tab_row := HBoxContainer.new()
	root.add_child(tab_row)
	for i in 5:
		var b := _button(["01 WORKSHOP", "02 STORAGE", "03 MAP", "04 RECOVERY", "05 CORES"][i])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(select_tab.bind(i))
		tab_row.add_child(b)
		_tabs.append(b)
	# Explicit row order; dynamic content still uses Godot's automatic neighbors.
	for i in _tabs.size():
		_tabs[i].focus_neighbor_left = _tabs[i].get_path_to(_tabs[(i + _tabs.size() - 1) % _tabs.size()])
		_tabs[i].focus_neighbor_right = _tabs[i].get_path_to(_tabs[(i + 1) % _tabs.size()])
	var columns := HBoxContainer.new()
	columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	columns.add_theme_constant_override("separation", 8)
	root.add_child(columns)
	_list = _scroll_column(columns, 1.1)
	_details = _scroll_column(columns, 1.0)
	root.add_child(_label("TAB / ARROWS  navigate    ENTER  select    ESC  return", 8, MUTED))
	_confirmation = ConfirmationDialog.new()
	_confirmation.title = "Confirm research"
	_confirmation.add_theme_stylebox_override("panel", _style(PANEL, EDGE))
	_confirmation.add_theme_color_override("title_color", PAPER)
	_confirmation.add_theme_font_size_override("title_font_size", 11)
	add_child(_confirmation)
	_confirmation.get_label().add_theme_font_size_override("font_size", 11)
	_confirmation.get_label().add_theme_color_override("font_color", PAPER)
	_confirmation.get_ok_button().text = "RESEARCH"
	for confirmation_button: Button in [_confirmation.get_ok_button(), _confirmation.get_cancel_button()]:
		confirmation_button.add_theme_font_size_override("font_size", 10)
		confirmation_button.add_theme_color_override("font_color", PAPER)
		confirmation_button.add_theme_stylebox_override("normal", _style(INK, EDGE))
		confirmation_button.add_theme_stylebox_override("hover", _style(Color("354b53"), TEAL))
		confirmation_button.add_theme_stylebox_override("focus", _style(Color("354b53"), PAPER))

func _scroll_column(parent: Node, ratio: float) -> VBoxContainer:
	var panel := _panel(INK, EDGE)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = ratio
	parent.add_child(panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(column)
	return column

func _clear(node: Node) -> void:
	for c in node.get_children():
		node.remove_child(c)
		c.queue_free()

func _records(key: String) -> Array:
	var raw: Variant = _snapshot.get(key, [])
	return raw if raw is Array else []

func _find(key: String, id: String) -> Dictionary:
	for raw: Variant in _records(key):
		if raw is Dictionary and String(raw.get("id", "")) == id:
			return raw
	return {}

func _refresh() -> void:
	if _list == null: return
	var focus := get_viewport().gui_get_focus_owner()
	var list_had_focus := is_instance_valid(focus) and _list.is_ancestor_of(focus)
	_clear(_list)
	for i in _tabs.size():
		_tabs[i].add_theme_color_override("font_color", TEAL if i == _tab else PAPER)
	match _tab:
		0: _workshop_list()
		1: _storage_list()
		2: _map_list()
		3: _recovery_list()
		4: _cores_list()
	_refresh_detail()
	if list_had_focus and is_visible_in_tree(): _tabs[_tab].grab_focus()

func _workshop_list() -> void:
	_list.add_child(_label("FORMULAS  /  DISCOVERED", 10, TEAL))
	_search = LineEdit.new()
	_search.placeholder_text = "Search revealed formula or ingredient"
	_search.text = _recipe_query
	_style_search(_search)
	_search.text_changed.connect(_filter_recipes)
	_list.add_child(_search)
	_populate_recipes(_recipe_query)

func _filter_recipes(query: String) -> void:
	_recipe_query = query
	# Keep the focused search field; rebuild only result rows.
	for child in _list.get_children().slice(2):
		_list.remove_child(child)
		child.queue_free()
	_populate_recipes(query)

func _populate_recipes(query: String) -> void:
	var count := 0
	for raw: Variant in _records("recipes"):
		if not raw is Dictionary or not bool(raw.get("revealed", false)): continue
		var rec: Dictionary = raw
		var searchable := String(rec.get("name", ""))
		for ingredient: Variant in _array(rec.get("ingredients", [])):
			if ingredient is Dictionary: searchable += " " + String(ingredient.get("name", ""))
		if not query.is_empty() and not searchable.to_lower().contains(query.to_lower()): continue
		var formula_learned: Variant = rec.get("formula_learned", null)
		var status := ADAPTER.recipe_status(String(rec.get("knowledge", "")), formula_learned)
		var label := String(rec.get("name", "Formula"))
		if not status.is_empty(): label += "  ·  " + status
		var b := _button(label)
		b.icon = PIXEL_UI.icon_texture({"id": rec.get("id", ""), "kind": "core" if String(rec.get("id", "")).contains("core") else "formula"})
		b.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(_select.bind(String(rec.get("id", ""))))
		_list.add_child(b)
		count += 1
	if count == 0: _list.add_child(_label("No matching discovered formulas.", 10, MUTED))

func _storage_list() -> void:
	_list.add_child(_label("STORAGE  /  SELECT A STACK", 10, TEAL))
	var switcher := HBoxContainer.new()
	_list.add_child(switcher)
	for direction: String in ["deposit", "withdraw"]:
		var b := _button("SATCHEL → CHEST" if direction == "deposit" else "CHEST → SATCHEL")
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_color_override("font_color", TEAL if direction == _direction else PAPER)
		b.pressed.connect(_set_direction.bind(direction))
		switcher.add_child(b)
	var search := LineEdit.new()
	search.placeholder_text = "Filter visible storage items"
	search.text = _storage_query
	_style_search(search)
	search.text_changed.connect(_filter_storage)
	_list.add_child(search)
	_populate_storage(_storage_query)

func _filter_storage(query: String) -> void:
	_storage_query = query
	for child in _list.get_children().slice(3):
		_list.remove_child(child)
		child.queue_free()
	_populate_storage(query)

func _populate_storage(query: String) -> void:
	var key := "bag" if _direction == "deposit" else "chest"
	var count := 0
	for raw: Variant in _records(key):
		if not raw is Dictionary or int(raw.get("count", 0)) <= 0: continue
		if not query.is_empty() and not String(raw.get("name", "")).to_lower().contains(query.to_lower()): continue
		var protected := bool(raw.get("protected", false)) or String(raw.get("id", "")).begins_with("soh_i_")
		var suffix := "   ·  UNIQUE" if protected else ""
		var b := _button("%s   ×%d%s" % [raw.get("name", "Unknown"), int(raw.get("count", 0)), suffix])
		b.icon = PIXEL_UI.icon_texture(raw)
		b.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(_select.bind(String(raw.get("id", ""))))
		_list.add_child(b)
		count += 1
	if count == 0: _list.add_child(_label("No matching stacks." if not query.is_empty() else "No stacks in this container.", 10, MUTED))

func _set_direction(direction: String) -> void:
	_direction = direction
	_selection = ""
	_refresh()

func _map_list() -> void:
	_list.add_child(_label("EXPLORED PLACES", 10, TEAL))
	var map := MAP.new()
	map.custom_minimum_size = Vector2(0, 85)
	map.mouse_filter = Control.MOUSE_FILTER_STOP
	map.set_places(_records("places"))
	map.place_selected.connect(_select)
	map.tooltip_text = "Wheel: zoom  ·  Right-drag: pan  ·  Click a known place"
	_list.add_child(map)
	var controls := HBoxContainer.new()
	_list.add_child(controls)
	for spec: Array in [["−", -1], ["+", 1], ["RESET", 0]]:
		var button := _button(String(spec[0]))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(func():
			if int(spec[1]) == 0: map.reset_view()
			else: map.set_zoom(map._zoom * (1.25 if int(spec[1]) > 0 else 0.8))
		)
		controls.add_child(button)
	var count := 0
	for raw: Variant in _records("places"):
		if not raw is Dictionary or not bool(raw.get("revealed", false)): continue
		var b := _button(String(raw.get("name", "Unknown place")))
		b.pressed.connect(_select.bind(String(raw.get("id", ""))))
		_list.add_child(b)
		count += 1
	if count == 0: _list.add_child(_label("No places discovered yet.", 10, MUTED))

func _recovery_list() -> void:
	var recovery: Variant = _snapshot.get("recovery", {})
	if recovery is Dictionary:
		var anchor_label := String(recovery.get("anchor_label", "")).strip_edges()
		if not anchor_label.is_empty(): _list.add_child(_label("Home · %s" % anchor_label, 11))
		var bed_label := String(recovery.get("bed_label", "")).strip_edges()
		if not bed_label.is_empty(): _list.add_child(_label(bed_label, 10, MUTED))
		var bag_label := String(recovery.get("bag_label", "")).strip_edges()
		if not bag_label.is_empty(): _list.add_child(_label(bag_label, 10, CORAL))
	for raw: Variant in _records("respawns"):
		if not raw is Dictionary or not bool(raw.get("available", false)) or not _has_action_host() or _pending: continue
		var name := String(raw.get("name", "")).strip_edges()
		if name.is_empty(): continue
		var choice := _button("Return to %s" % name)
		choice.pressed.connect(_request.bind("select_respawn", String(raw.get("id", "")), {}))
		_list.add_child(choice)

func _refresh_detail() -> void:
	if _details == null: return
	var focus := get_viewport().gui_get_focus_owner()
	var detail_had_focus := is_instance_valid(focus) and _details.is_ancestor_of(focus)
	_clear(_details)
	match _tab:
		0: _workshop_detail()
		1: _storage_detail()
		2: _map_detail()
		3: _hazard_detail()
		4: _cores_detail()
	if not _message.is_empty(): _details.add_child(_label(_message, 9, MUTED))
	if _pending and _retry_is_owner_authorized() and _has_action_host():
		var retry := _button("CHECK AGAIN")
		retry.tooltip_text = "Check this action again without creating a second one."
		retry.pressed.connect(retry_pending)
		_details.add_child(retry)
		if detail_had_focus and is_visible_in_tree(): retry.grab_focus()
	elif detail_had_focus and is_visible_in_tree():
		_tabs[_tab].grab_focus()

func _workshop_detail() -> void:
	var rec := _find("recipes", _selection)
	if rec.is_empty() or not bool(rec.get("revealed", false)):
		_details.add_child(_label("Select a discovered formula.", 10, MUTED)); return
	_details.add_child(_label(String(rec.get("name", "Formula")), 14))
	var knowledge := String(rec.get("knowledge", ""))
	var formula_learned: Variant = rec.get("formula_learned", null)
	var needs_research := knowledge == "recipe" and formula_learned is bool and not bool(formula_learned)
	var knowledge_text := ADAPTER.recipe_status(knowledge, formula_learned)
	if not knowledge_text.is_empty(): _details.add_child(_label(knowledge_text, 10, TEAL if formula_learned == true or knowledge == "starter" else PIXEL_UI.GOLD))
	var station_name := String(rec.get("station_label", ""))
	if not station_name.is_empty(): _details.add_child(_label("Station · %s" % station_name, 10, MUTED))
	for raw: Variant in _array(rec.get("ingredients", [])):
		if not raw is Dictionary: continue
		var have := int(raw.get("have", 0))
		var need := int(raw.get("need", 0))
		var label_prefix := "Fuel · " if String(raw.get("kind", "")) == "fuel" else ""
		_details.add_child(_label("%s%s  %d / %d" % [label_prefix, raw.get("name", "Material"), have, need], 10, CORAL if have < need else TEAL))
		if have < need and not String(raw.get("source_label", "")).is_empty():
			_details.add_child(_label("Find · %s" % String(raw.source_label), 9, MUTED))
	var raw_outputs: Variant = rec.get("outputs", {})
	var outputs: Dictionary = raw_outputs if raw_outputs is Dictionary else {}
	var output_names: Variant = rec.get("output_names", {})
	var output_parts: Array[String] = []
	if output_names is Dictionary:
		for output_id: Variant in outputs.keys():
			var output_label := String(output_names.get(String(output_id), ""))
			if not output_label.is_empty():
				output_parts.append("%s ×%d" % [output_label, int(outputs[output_id])])
	if not output_parts.is_empty(): _details.add_child(_label("Makes · %s" % ", ".join(output_parts), 9, TEAL))
	var verb := "research" if needs_research else "craft"
	var knowledge_resolved := knowledge == "starter" or (knowledge == "recipe" and formula_learned is bool)
	var allowed := knowledge_resolved and bool(rec.get("can_" + verb, false))
	if allowed and not _pending and _has_action_host():
		var button := _button("RESEARCH" if needs_research else "CRAFT")
		if verb == "research":
			button.pressed.connect(_confirm_research.bind(String(rec.get("id", ""))))
		else:
			button.pressed.connect(_request.bind(verb, String(rec.get("id", "")), {}))
		_details.add_child(button)

func _storage_detail() -> void:
	var record := _find("bag" if _direction == "deposit" else "chest", _selection)
	if record.is_empty():
		_details.add_child(_label("Select a stack to transfer.", 10, MUTED)); return
	var count := maxi(0, int(record.get("count", 0)))
	_details.add_child(_label(String(record.get("name", "Item")), 14))
	_details.add_child(_label("Available: %d" % count, 10, MUTED))
	var protected := bool(record.get("protected", false)) or String(record.get("id", "")).begins_with("soh_i_")
	if protected:
		_details.add_child(_label("Unique Core · transfer unavailable here.", 9, CORAL))
		return
	if record.has("transferable") and not bool(record.get("transferable", false)):
		_details.add_child(_label("This item cannot be moved here.", 9, CORAL))
		return
	if not _has_action_host() or not bool(_snapshot.get("transfer_enabled", false)) or String(_snapshot.get("container_id", "")).is_empty():
		return
	_amount = SpinBox.new()
	_amount.min_value = 1
	_amount.max_value = maxi(1, count)
	_amount.step = 1
	_amount.value = 1
	_amount.get_line_edit().add_theme_font_size_override("font_size", 10)
	_details.add_child(_amount)
	var all := _button("ALL AVAILABLE")
	all.pressed.connect(func():
		if is_instance_valid(_amount):
			_amount.value = count
	)
	_details.add_child(all)
	var button := _button("REQUEST TRANSFER")
	button.disabled = _pending or count <= 0
	button.pressed.connect(_request_transfer)
	_details.add_child(button)


func _request_transfer() -> void:
	var item := _find("bag" if _direction == "deposit" else "chest", _selection)
	var count := int(item.get("count", 0))
	var amount := int(_amount.value) if is_instance_valid(_amount) else 0
	var item_id := String(item.get("item_id", item.get("base_item_id", item.get("id", "")))).strip_edges().to_lower()
	if item_id.contains("#"):
		return # A stack key is not an A0 item ID; the projection must carry item_id explicitly.
	if not bool(_snapshot.get("transfer_enabled", false)) or String(_snapshot.get("container_id", "")).is_empty() or count <= 0 or amount < 1 or amount > count: return
	_request("transfer", item_id, {"direction": _direction, "container_id": String(_snapshot.get("container_id", "")), "item_id": item_id, "stack_key": String(item.get("stack_key", item.get("id", _selection))), "amount": amount})

func _has_action_host() -> bool:
	return not request_action.get_connections().is_empty()

func _request(action: String, id: String, payload: Dictionary) -> void:
	if _pending or id.is_empty() or not _has_action_host(): return
	if action not in ["craft", "research", "transfer", "equip_core", "unequip_core", "select_respawn"]: return
	var live_owner: bool = (
		_snapshot.get("schema", "") == "soh.ui.snapshot.v2"
		and _snapshot.get("provenance", "") == "A0_OWNER_PROJECTION"
	)
	var developer_fixture: bool = (
		_developer_diagnostics
		and _snapshot.get("provenance", "") == "FIXTURE_PROJECTION"
	)
	if not live_owner and not developer_fixture: return
	_pending = true
	_request_serial += 1
	_pending_id = "%s-%d" % [_client_nonce, _request_serial]
	_message = "Working…"
	var request := payload.duplicate(true)
	request["schema"] = "soh.ui.intent.v2"
	request["request_id"] = _pending_id
	request["revision"] = _snapshot.get("revision", null)
	request["sequence"] = _snapshot.get("sequence", null)
	_pending_action = action
	_pending_target = id
	_pending_payload = request.duplicate(true)
	request_action.emit(action, id, request.duplicate(true))
	_refresh_detail()

func _map_detail() -> void:
	var place := _find("places", _selection)
	if place.is_empty() or not bool(place.get("revealed", false)):
		_details.add_child(_label("Select a discovered place.", 10, MUTED)); return
	_details.add_child(_label(String(place.get("name", "Place")), 14))
	var route_label := String(place.get("route_label", "")).strip_edges()
	if not route_label.is_empty(): _details.add_child(_label("Route · %s" % route_label, 10, MUTED))
	var hazard_label := String(place.get("hazard_label", "")).strip_edges()
	if not hazard_label.is_empty(): _details.add_child(_label("Field note · %s" % hazard_label, 10, CORAL))
	var activity_label := String(place.get("activity_label", "")).strip_edges()
	if not activity_label.is_empty(): _details.add_child(_label(activity_label, 10, TEAL))
	var preparation: Array = _array(place.get("preparation_labels", []))
	if not preparation.is_empty(): _details.add_child(_label("Prepare · %s" % ", ".join(preparation), 10, CORAL))

func _hazard_detail() -> void:
	var shown := 0
	for raw: Variant in _records("hazards"):
		if not raw is Dictionary or not bool(raw.get("revealed", false)): continue
		var name := String(raw.get("name", "")).strip_edges()
		if name.is_empty(): continue
		_details.add_child(_label(name, 12))
		var field_note := String(raw.get("field_note", "")).strip_edges()
		if not field_note.is_empty(): _details.add_child(_label(_short_player_text(field_note, 72), 10, MUTED))
		var preparation := String(raw.get("preparation_label", "")).strip_edges()
		if not preparation.is_empty(): _details.add_child(_label("Prepare · %s" % preparation, 10, CORAL))
		shown += 1
	if shown == 0: _details.add_child(_label("No field notes here yet.", 10, MUTED))
	for raw_capability: Variant in _records("capabilities"):
		if not raw_capability is Dictionary or not raw_capability.get("owned") is bool: continue
		if not bool(raw_capability.owned):
			var preparation_label := String(raw_capability.get("label", "Preparation needed"))
			if not preparation_label.is_empty(): _details.add_child(_label(preparation_label, 10, CORAL))

func _cores_list() -> void:
	_list.add_child(_label("PHYSICAL SKILL CORES", 10, TEAL))
	var count := 0
	for raw: Variant in _records("cores"):
		if not raw is Dictionary: continue
		var b := _button("%s%s" % [raw.get("name", "Unknown Core"), "  · EQUIPPED" if bool(raw.get("equipped", false)) else ""])
		b.icon = PIXEL_UI.icon_texture({"id": raw.get("item_id", raw.get("id", "")), "kind": "core", "uses": raw.get("uses", 0), "max_uses": raw.get("max_uses", 0), "condition": raw.get("condition", ""), "equipped": raw.get("equipped", false)})
		b.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(_select.bind(String(raw.get("id", ""))))
		_list.add_child(b)
		count += 1
	if count == 0: _list.add_child(_label("No physical Cores in this snapshot.", 10, MUTED))

func _cores_detail() -> void:
	var core := _find("cores", _selection)
	if core.is_empty():
		_details.add_child(_label("Select a physical Core.", 10, MUTED)); return
	_details.add_child(_label(String(core.get("name", "Core")), 14))
	var uses := int(core.get("uses", -1))
	var maximum := int(core.get("max_uses", 0))
	var charges := ADAPTER.core_status(uses, maximum)
	if not charges.is_empty(): _details.add_child(_label(charges, 11, TEAL if uses > 0 and uses <= maximum else CORAL))
	if core.has("condition") and core.has("max_condition"):
		var condition := int(core.condition)
		var max_condition := int(core.max_condition)
		if max_condition > 0 and condition >= 0 and condition <= max_condition:
			_details.add_child(_label("Condition · %d%%" % roundi(100.0 * condition / max_condition), 10, CORAL if condition * 100 / max_condition < 35 else MUTED))
	if core.has("equipped") and core.equipped is bool:
		_details.add_child(_label("Equipped" if bool(core.equipped) else "In your pack", 10, MUTED))
	if core.has("formula_learned"):
		var learned_label := "Learned" if bool(core.formula_learned) else "Not learned"
		_details.add_child(_label("Permanent formula: %s" % learned_label, 10, TEAL if bool(core.formula_learned) else PAPER))
	else:
		_details.add_child(_label("Recipe knowledge · tracked separately", 9, MUTED))
	var instance_id := String(core.get("instance_id", ""))
	var has_physical_identity := instance_id.begins_with("soh_i_") and not String(core.get("item_id", "")).is_empty()
	var equipped: Variant = core.get("equipped", null)
	if has_physical_identity and equipped is bool and _has_action_host() and not _pending:
		if not bool(equipped) and core.get("can_equip", null) is bool and bool(core.get("can_equip", false)) and uses > 0 and uses <= maximum:
			var equip := _button("Equip")
			equip.pressed.connect(_request.bind("equip_core", instance_id, {}))
			_details.add_child(equip)
		elif bool(equipped) and core.get("can_unequip", null) is bool and bool(core.get("can_unequip", false)):
			var unequip := _button("Unequip")
			unequip.pressed.connect(_request.bind("unequip_core", instance_id, {}))
			_details.add_child(unequip)

func _confirm_research(id: String) -> void:
	if _pending: return
	var rec := _find("recipes", id)
	if rec.is_empty() or not bool(rec.get("revealed", false)) or not bool(rec.get("can_research", false)): return
	_confirmation.dialog_text = String(rec.get("research_warning", "Research may consume a specimen and materials. Continue?"))
	for connection in _confirmation.confirmed.get_connections():
		_confirmation.confirmed.disconnect(connection.callable)
	_confirmation.confirmed.connect(func():
		if not is_visible_in_tree(): return
		var current := _find("recipes", id)
		var formula_learned: Variant = current.get("formula_learned", null)
		if bool(current.get("revealed", false)) and bool(current.get("can_research", false)) and String(current.get("knowledge", "")) == "recipe" and formula_learned is bool and not formula_learned:
			_request("research", id, {})
	)
	_confirmation.popup_centered()

func _array(value: Variant) -> Array:
	return value if value is Array else []

func _short_player_text(value: String, max_chars: int) -> String:
	var clean := " ".join(value.strip_edges().split(" ", false))
	if clean.length() <= max_chars: return clean
	return clean.substr(0, max_chars - 1).strip_edges() + "…"

func _retry_is_owner_authorized() -> bool:
	if _snapshot.get("schema", "") != "soh.ui.snapshot.v2" or _snapshot.get("provenance", "") != "A0_OWNER_PROJECTION":
		return false
	var capabilities: Variant = _snapshot.get("capabilities", {})
	return capabilities is Dictionary and capabilities.get("retry_same_request", false) is bool and bool(capabilities.get("retry_same_request", false))


func retry_pending() -> bool:
	if not _pending or _pending_id.is_empty() or not _retry_is_owner_authorized() or not _has_action_host(): return false
	request_action.emit(_pending_action, _pending_target, _pending_payload.duplicate(true))
	return true


func _response_copy(response: Dictionary, status: String) -> String:
	var reason := String(response.get("reason", "")).strip_edges().to_lower()
	var copy := {
		"out_of_range": "Move closer and try again.",
		"dead": "You cannot do that right now.",
		"not_alive": "You cannot do that right now.",
		"chest_full": "No room there. Make space and try again.",
		"bag_full": "Make room in your pack and try again.",
		"insufficient_quantity": "You do not have enough for that.",
		"insufficient_materials": "You need more materials.",
		"missing_item": "That item is no longer available.",
		"protected_unique": "Unique items cannot be moved here.",
		"stale_revision": "Things changed. Review the latest details.",
		"stale_sequence": "Things changed. Review the latest details.",
		"stale_request": "Things changed. Review the latest details.",
		"already_committed": "That action is already complete.",
		"unknown_capability": "That action is not available here.",
		"unsupported": "That action is not available here.",
		"station_unavailable": "This station is not ready.",
		"not_learned": "Learn this formula first.",
	}
	if status == "accepted": return "Action complete."
	if copy.has(reason): return String(copy[reason])
	# Never echo arbitrary host text to release UI. Even a short message can carry
	# a stack key, file path, raw identifier, internal status, or debug detail.
	return "Could not do that just now. Review your items and try again."


func _safe_response_copy(message: String, accepted: bool) -> String:
	var normalized := message.strip_edges().replace("\r", " ").replace("\n", " ").replace("\t", " ")
	var clean := " ".join(normalized.split(" ", false))
	var lower := clean.to_lower()
	for internal in ["soh_i_", "res://", "file://", "fixture", "not_native", "authored_plan", "blocked_pending", "source_blocked", "schema", "revision", "sequence", "owner_projection", "traceback", "exception", "stack_id"]:
		if lower.contains(internal):
			return "Action complete." if accepted else "Could not do that just now. Review your items and try again."
	if clean.is_empty():
		return "Action complete." if accepted else "Could not do that just now. Review your items and try again."
	return _short_player_text(clean, 72)

func _clear_pending() -> void:
	_pending = false
	_pending_id = ""
	_pending_action = ""
	_pending_target = ""
	_pending_payload.clear()
