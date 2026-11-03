extends Control
## Independent view, not a subsystem. All input dictionaries are proposed UI DTOs,
## not authoritative A0/A1/A3 schemas. Requests are validated by host services.
signal modal_state_changed(active: bool)
signal closed
signal request_action(action: String, target_id: String, payload: Dictionary)
signal snapshot_changed(snapshot: Dictionary)
signal journal_requested

const INK := Color("171b2c")
const PANEL := Color("273344")
const EDGE := Color("687b7e")
const PAPER := Color("f4e6c8")
const MUTED := Color("b1c6bf")
const TEAL := Color("75d3bd")
const CORAL := Color("ffad8f")
const MAP := preload("res://game/survival/ui/expedition_map.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")

var show_workspace_navigation := false
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

func _ready() -> void:
	_client_nonce = Crypto.new().generate_random_bytes(16).hex_encode()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()
	_refresh()

func is_modal_active() -> bool:
	return is_visible_in_tree()

func open_planner() -> void:
	if visible: return
	_previous_focus = get_viewport().gui_get_focus_owner()
	visible = true
	modal_state_changed.emit(true)
	_tabs[_tab].grab_focus()

func close_planner() -> void:
	if not visible: return
	if is_instance_valid(_confirmation): _confirmation.hide()
	visible = false
	modal_state_changed.emit(false)
	if is_instance_valid(_previous_focus) and _previous_focus.is_visible_in_tree():
		_previous_focus.grab_focus()
	closed.emit()

func _unhandled_key_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		close_planner()
		get_viewport().set_input_as_handled()

## Replaces a view snapshot, never saves. Host must filter undiscovered information
## before passing it; this component also rejects entries without revealed=true.
func set_snapshot(snapshot: Dictionary) -> void:
	if snapshot.get("schema", "") == "soh.ui.snapshot.v1":
		apply_snapshot(snapshot)
		return
	# Legacy fixture path is disabled once a versioned stream is active.
	if _snapshot_sequence >= 0: return
	_install_snapshot(snapshot)

func _install_snapshot(snapshot: Dictionary) -> void:
	_snapshot = snapshot.duplicate(true)
	if is_inside_tree(): _refresh()
	snapshot_changed.emit(_snapshot.duplicate(true))

## Called by host when request is completed or rejected. No local item/recipe update.
func resolve_request(message: String) -> void:
	# Compatibility only for old unversioned fixtures. V1 must correlate IDs.
	if _snapshot.get("schema", "") == "soh.ui.snapshot.v1": return
	_pending = false
	_clear_pending()
	_message = message
	if is_inside_tree(): _refresh_detail()

## Versioned UI DTO, not a production API. Producer supplies monotonic sequence.
func apply_snapshot(snapshot: Dictionary) -> bool:
	if snapshot.get("schema", "") != "soh.ui.snapshot.v1": return false
	var sequence: Variant = snapshot.get("sequence", null)
	if typeof(sequence) != TYPE_INT or int(sequence) < 0 or int(sequence) < _snapshot_sequence: return false
	if int(sequence) == _snapshot_sequence and snapshot != _snapshot: return false
	_snapshot_sequence = int(sequence)
	_install_snapshot(snapshot)
	return true

## Requires both the active request ID and a current authoritative snapshot.
## Invalid, stale, or replayed replies never release a different pending request.
func apply_host_response(response: Dictionary) -> bool:
	if not _pending or response.get("schema", "") != "soh.ui.response.v1": return false
	if String(response.get("request_id", "")) != _pending_id: return false
	if not String(response.get("status", "")) in ["accepted", "rejected"]: return false
	var next: Variant = response.get("snapshot", null)
	if not next is Dictionary or not apply_snapshot(next): return false
	_clear_pending()
	_message = String(response.get("message", "Request resolved."))
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
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(1)
	box.content_margin_left = 7
	box.content_margin_right = 7
	box.content_margin_top = 4
	box.content_margin_bottom = 4
	return box

func _label(text: String, size := 10, color := PAPER) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
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
	button.add_theme_stylebox_override("focus", _style(Color(0,0,0,0), Color("ffe5a3")))
	button.add_theme_stylebox_override("disabled", _style(Color("232735"), Color("3f4852")))
	return button

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
	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", _style(PANEL, EDGE))
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
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = ratio
	panel.add_theme_stylebox_override("panel", _style(INK, EDGE))
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
	_search.placeholder_text = "Search name or ingredient"
	_search.text = _recipe_query
	_search.add_theme_font_size_override("font_size", 10)
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
		var status := ADAPTER.recipe_status(bool(rec.get("found", false)), bool(rec.get("learned", false)))
		var b := _button("%s  ·  %s" % [rec.get("name", "Unknown"), status])
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
	search.placeholder_text = "Filter storage items"
	search.text = _storage_query
	search.add_theme_font_size_override("font_size", 10)
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
		var b := _button("%s   ×%d" % [raw.get("name", "Unknown"), int(raw.get("count", 0))])
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
	_list.add_child(_label("PREPARATION  /  SAFE RETURN", 10, TEAL))
	var recovery: Variant = _snapshot.get("recovery", {})
	if not recovery is Dictionary: recovery = {}
	_list.add_child(_label("Anchor: %s" % recovery.get("anchor", "Unknown"), 11))
	_list.add_child(_label("Bed: %s" % recovery.get("bed_status", "Unavailable"), 10, MUTED))
	_list.add_child(_label("Death bag: %s" % recovery.get("bag_status", "Unknown"), 10, CORAL))
	_list.add_child(_label("Preserved: %s" % recovery.get("preserved", "Unknown"), 10, TEAL))
	_list.add_child(_label("Dropped: %s" % recovery.get("dropped", "Unknown"), 10, CORAL))
	if _records("respawns").is_empty(): _list.add_child(_label("Respawn choices unavailable.", 9, MUTED))
	for raw: Variant in _records("respawns"):
		if not raw is Dictionary: continue
		var choice := _button("RESPAWN: %s" % raw.get("name", "Unknown"))
		choice.disabled = _pending or not bool(raw.get("available", false))
		choice.tooltip_text = String(raw.get("reason", "Availability determined by host."))
		choice.pressed.connect(_request.bind("select_respawn", String(raw.get("id", "")), {}))
		_list.add_child(choice)
		if choice.disabled: _list.add_child(_label(String(raw.get("reason", "Unavailable")), 9, CORAL))

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
	if _pending and _snapshot.get("schema", "") == "soh.ui.snapshot.v1":
		var retry := _button("RETRY SAME REQUEST")
		retry.tooltip_text = "Reuses the request ID; host must deduplicate."
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
	var learned := bool(rec.get("learned", false))
	_details.add_child(_label(ADAPTER.recipe_status(bool(rec.get("found", false)), learned), 10, TEAL))
	_details.add_child(_label("Station: %s" % rec.get("station", "Unknown"), 10, MUTED))
	if rec.has("station_status"): _details.add_child(_label("Station status: %s" % rec.station_status, 10, MUTED))
	if rec.has("queue_status"): _details.add_child(_label("Queue: %s" % rec.queue_status, 10, MUTED))
	for raw: Variant in _array(rec.get("ingredients", [])):
		if not raw is Dictionary: continue
		var have := int(raw.get("have", 0))
		var need := int(raw.get("need", 0))
		_details.add_child(_label("%s  %d / %d" % [raw.get("name", "Material"), have, need], 10, CORAL if have < need else TEAL))
		if have < need and not String(raw.get("source", "")).is_empty():
			_details.add_child(_label("Known source: %s" % raw.source, 9, MUTED))
	var verb := "craft" if learned else "research"
	var allowed := bool(rec.get("can_" + verb, false))
	var button := _button("CRAFT" if learned else "RESEARCH")
	button.disabled = _pending or not allowed
	if verb == "research":
		button.pressed.connect(_confirm_research.bind(String(rec.get("id", ""))))
	else:
		button.pressed.connect(_request.bind(verb, String(rec.get("id", "")), {}))
	_details.add_child(button)
	if not allowed: _details.add_child(_label(String(rec.get("blocked_reason", "Requirements not confirmed.")), 9, CORAL))

func _storage_detail() -> void:
	var record := _find("bag" if _direction == "deposit" else "chest", _selection)
	if record.is_empty():
		_details.add_child(_label("Select a stack to transfer.", 10, MUTED)); return
	var count := maxi(0, int(record.get("count", 0)))
	_details.add_child(_label(String(record.get("name", "Item")), 14))
	_details.add_child(_label("Available: %d" % count, 10, MUTED))
	if _snapshot.has("capacity_status"): _details.add_child(_label("Capacity: %s" % _snapshot.capacity_status, 10, MUTED))
	_amount = SpinBox.new()
	_amount.min_value = 1
	_amount.max_value = maxi(1, count)
	_amount.step = 1
	_amount.value = 1
	_amount.get_line_edit().add_theme_font_size_override("font_size", 10)
	_details.add_child(_amount)
	var all := _button("ALL AVAILABLE")
	all.pressed.connect(func(): if is_instance_valid(_amount): _amount.value = count)
	_details.add_child(all)
	var button := _button("REQUEST TRANSFER")
	button.disabled = _pending or count <= 0 or not bool(_snapshot.get("transfer_enabled", false)) or String(_snapshot.get("container_id", "")).is_empty()
	button.pressed.connect(_request_transfer)
	_details.add_child(button)
	_details.add_child(_label("Transfer is confirmed by the storage service, not this view.", 9, MUTED))

func _request_transfer() -> void:
	var item := _find("bag" if _direction == "deposit" else "chest", _selection)
	var count := int(item.get("count", 0))
	var amount := int(_amount.value) if is_instance_valid(_amount) else 0
	if not bool(_snapshot.get("transfer_enabled", false)) or String(_snapshot.get("container_id", "")).is_empty() or count <= 0 or amount < 1 or amount > count: return
	_request("transfer", _selection, {"direction": _direction, "container_id": String(_snapshot.get("container_id", "")), "amount": amount})

func _request(action: String, id: String, payload: Dictionary) -> void:
	if _pending or id.is_empty(): return
	_pending = true
	_request_serial += 1
	_pending_id = "%s-%d" % [_client_nonce, _request_serial]
	_message = "Request sent; awaiting authoritative result."
	var request := payload.duplicate(true)
	request["schema"] = "soh.ui.intent.v1"
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
	_details.add_child(_label("Route: %s" % place.get("route", "Unknown"), 10, MUTED))
	_details.add_child(_label("Threat: %s" % place.get("hazard", "Unknown"), 10, CORAL))
	_details.add_child(_label("Known activity: %s" % place.get("activity", "Unknown"), 10, TEAL))
	if place.has("status"): _details.add_child(_label("Status: %s" % place.status, 10, MUTED))
	if place.has("requirements"): _details.add_child(_label("Preparation: %s" % place.requirements, 10, MUTED))

func _hazard_detail() -> void:
	_details.add_child(_label("ENVIRONMENT & PROTECTION", 11, TEAL))
	var hazards := _records("hazards")
	var revealed_count := 0
	for raw: Variant in hazards:
		if not raw is Dictionary or not bool(raw.get("revealed", false)): continue
		revealed_count += 1
		_details.add_child(_label(String(raw.get("name", "Hazard")), 12))
		if raw.has("severity"): _details.add_child(_label("Danger: %s" % raw.severity, 10, CORAL))
		if raw.has("required_gear"): _details.add_child(_label("Prepare: %s" % raw.required_gear, 10, MUTED))
		_details.add_child(_label("Protection: %s" % raw.get("protection", "Unknown"), 10, CORAL))
		_details.add_child(_label("Preparation: %s" % raw.get("preparation", "Unknown"), 10, MUTED))
	if revealed_count == 0: _details.add_child(_label("No hazard information available.", 10, MUTED))

func _cores_list() -> void:
	_list.add_child(_label("PHYSICAL SKILL CORES", 10, TEAL))
	var count := 0
	for raw: Variant in _records("cores"):
		if not raw is Dictionary: continue
		var b := _button("%s%s" % [raw.get("name", "Unknown Core"), "  · EQUIPPED" if bool(raw.get("equipped", false)) else ""])
		b.pressed.connect(_select.bind(String(raw.get("id", ""))))
		_list.add_child(b)
		count += 1
	if count == 0: _list.add_child(_label("No physical Cores in this snapshot.", 10, MUTED))

func _cores_detail() -> void:
	var core := _find("cores", _selection)
	if core.is_empty():
		_details.add_child(_label("Select a physical Core.", 10, MUTED)); return
	_details.add_child(_label(String(core.get("name", "Core")), 14))
	var charges := int(core.get("charges", -1))
	var maximum := int(core.get("max_charges", 0))
	_details.add_child(_label(ADAPTER.core_status(charges, maximum), 10, TEAL if charges > 0 and charges <= maximum else CORAL))
	_details.add_child(_label("Condition: %s" % core.get("condition", "Unknown"), 10, MUTED))
	_details.add_child(_label("Equipment: %s" % ("Equipped" if bool(core.get("equipped", false)) else "Not equipped"), 10, MUTED))
	_details.add_child(_label("Formula: %s" % ADAPTER.recipe_status(bool(core.get("blueprint_found", false)), bool(core.get("learned", false))), 10, TEAL))
	_details.add_child(_label("Owning a Core does not teach its formula.", 9, MUTED))
	var button := _button("REQUEST EQUIP")
	button.disabled = _pending or not bool(core.get("can_equip", false)) or charges <= 0 or charges > maximum or bool(core.get("equipped", false))
	button.pressed.connect(_request.bind("equip_core", String(core.get("id", "")), {}))
	_details.add_child(button)
	_details.add_child(_label("Skill readiness: %s" % core.get("readiness", "Not verified"), 9, MUTED))

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
		if bool(current.get("revealed", false)) and bool(current.get("can_research", false)) and not bool(current.get("learned", false)):
			_request("research", id, {})
	)
	_confirmation.popup_centered()

func _array(value: Variant) -> Array:
	return value if value is Array else []

## Manual retry after lost response: exact same intent key and payload.
## Only safe with a host that durably deduplicates; there is no auto-timeout.
func retry_pending() -> bool:
	if not _pending or _pending_id.is_empty() or _snapshot.get("schema", "") != "soh.ui.snapshot.v1": return false
	request_action.emit(_pending_action, _pending_target, _pending_payload.duplicate(true))
	return true

func _clear_pending() -> void:
	_pending = false
	_pending_id = ""
	_pending_action = ""
	_pending_target = ""
	_pending_payload.clear()
