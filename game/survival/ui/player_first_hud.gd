extends Control
## Low-clutter A6 HUD extension. A0 retains its existing region/provisions/
## prompt/death HUD; this component adds only owner-projected health/context,
## transaction feedback, and physical-Core status in otherwise clear corners.
## It never polls gameplay, infers readiness, or mutates inventory/loadout.

const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
const PIXEL_PANEL := preload("res://game/survival/ui/pixel_panel.gd")
const INK := Color("111923")
const EDGE := Color("b77b4e")
const PAPER := Color("f6e8c9")
const MUTED := Color("b8c4b2")
const GOLD := Color("f4c778")
const CORAL := Color("ff9278")

var _snapshot: Dictionary = {}
var _last_sequence := -1
var _status_panel: PanelContainer
var _needs: VBoxContainer
var _phase: Label
var _provenance: Label
var _context: Label
var _risk: Label
var _bag: Label
var _feedback: Label
var _core_title: Label
var _core_state: Label
var _core_details: Label
var _core_readiness: Label
var _core_icon: TextureRect
var _core_panel: PanelContainer


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	_refresh()


## Requires an explicit, versioned projection. Fixture data is visibly marked;
## invalid/unknown owner fields are omitted rather than guessed.
func set_projection(snapshot: Dictionary) -> bool:
	if String(snapshot.get("schema", "")) != "soh.ui.player_hud.v1":
		return false
	var provenance := String(snapshot.get("provenance", ""))
	var revision := String(snapshot.get("revision", "")).strip_edges()
	var sequence: Variant = snapshot.get("sequence", null)
	if (
		provenance
		not in [
			"A0_OWNER_PROJECTION",
			"A3_OWNER_PROJECTION",
			"A4_OWNER_PROJECTION",
			"A1_DISCOVERED_PROJECTION",
			"FIXTURE_PROJECTION"
		]
		or revision.is_empty()
		or not sequence is int
		or int(sequence) < 0
	):
		return false
	if not _snapshot.is_empty():
		if int(sequence) < _last_sequence:
			return false
		if int(sequence) == _last_sequence and (revision != String(_snapshot.get("revision", "")) or snapshot != _snapshot):
			return false
	_snapshot = snapshot.duplicate(true)
	_last_sequence = int(sequence)
	if is_inside_tree():
		_refresh()
	return true


func _build() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_status_panel = _panel(INK, EDGE)
	_status_panel.name = "A6ContextStatus"
	_status_panel.anchor_left = 1.0
	_status_panel.anchor_right = 1.0
	_status_panel.offset_left = -266
	_status_panel.offset_right = -12
	_status_panel.offset_top = 12
	_status_panel.offset_bottom = 124
	add_child(_status_panel)
	var status_column := VBoxContainer.new()
	status_column.add_theme_constant_override("separation", 0)
	_status_panel.add_child(status_column)
	_phase = _label("FIELD  /  UNKNOWN", 10, GOLD, true)
	status_column.add_child(_phase)
	_provenance = _label("NO OWNER SNAPSHOT", 8, MUTED)
	status_column.add_child(_provenance)
	_context = _label("", 8, PAPER)
	_context.visible = false
	status_column.add_child(_context)
	_needs = VBoxContainer.new()
	_needs.add_theme_constant_override("separation", 0)
	status_column.add_child(_needs)
	_risk = _label("", 9, CORAL)
	status_column.add_child(_risk)
	_bag = _label("", 9, MUTED)
	status_column.add_child(_bag)
	_feedback = _label("", 9, PAPER)
	status_column.add_child(_feedback)

	_core_panel = _panel(Color("241f20"), GOLD)
	_core_panel.anchor_left = 1.0
	_core_panel.anchor_right = 1.0
	_core_panel.anchor_top = 0.0
	_core_panel.anchor_bottom = 0.0
	_core_panel.offset_left = -260
	_core_panel.offset_right = -12
	_core_panel.offset_top = 132
	_core_panel.offset_bottom = 224
	_core_panel.name = "PhysicalCoreStatus"
	add_child(_core_panel)
	var core_row := HBoxContainer.new()
	core_row.add_theme_constant_override("separation", 4)
	_core_panel.add_child(core_row)
	_core_icon = TextureRect.new()
	_core_icon.custom_minimum_size = Vector2(26, 26)
	_core_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_core_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_core_icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_core_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	core_row.add_child(_core_icon)
	var core_column := VBoxContainer.new()
	core_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	core_column.add_theme_constant_override("separation", 0)
	core_row.add_child(core_column)
	_core_title = _label("PHYSICAL CORE", 10, GOLD, true)
	core_column.add_child(_core_title)
	_core_state = _label("Ownership status unavailable.", 9, PAPER)
	_core_state.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	core_column.add_child(_core_state)
	_core_details = _label("Condition and finite charges are owner supplied.", 9, MUTED)
	_core_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	core_column.add_child(_core_details)
	_core_readiness = _label("CAST READINESS  /  UNKNOWN", 8, MUTED)
	_core_readiness.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	core_column.add_child(_core_readiness)


func _refresh() -> void:
	if _phase == null:
		return
	_status_panel.visible = not _snapshot.is_empty()
	for child in _needs.get_children():
		_needs.remove_child(child)
		child.queue_free()
	var labels := {
		"exploration": "FIELD  /  EXPLORING",
		"looting": "FIELD  /  SCAVENGING",
		"battle": "FIELD  /  IN DANGER",
		"workshop": "FIELD  /  AT WORKSHOP",
		"death": "FIELD  /  RECOVERY",
		"respawn": "FIELD  /  RETURNED",
	}
	var mode := String(_snapshot.get("mode", "unknown"))
	_phase.text = String(labels.get(mode, "FIELD  /  UNKNOWN"))
	_phase.add_theme_color_override("font_color", CORAL if mode in ["battle", "death"] else GOLD)
	var source := String(_snapshot.get("provenance", "NO OWNER SNAPSHOT")).replace("_", " ")
	_provenance.text = source
	_provenance.add_theme_color_override(
		"font_color", CORAL if source == "FIXTURE PROJECTION" else MUTED
	)
	var focus_text := _focus_text(_snapshot.get("focus", {}))
	_context.text = focus_text
	_context.visible = not focus_text.is_empty()
	var needs: Variant = _snapshot.get("needs", [])
	var shown_needs := 0
	var valid_needs := 0
	if needs is Array:
		for raw: Variant in needs:
			if not raw is Dictionary:
				continue
			var current: Variant = raw.get("current", null)
			var maximum: Variant = raw.get("maximum", null)
			if (
				not _is_number(current)
				or not _is_number(maximum)
				or float(maximum) <= 0.0
				or float(current) < 0.0
				or float(current) > float(maximum)
			):
				continue
			valid_needs += 1
			if shown_needs < 2:
				_needs.add_child(
					_label(
						(
							"%s  %d / %d"
							% [String(raw.get("label", "Need")), int(current), int(maximum)]
						),
						9,
						PAPER
					)
				)
				shown_needs += 1
	if valid_needs > shown_needs:
		_needs.add_child(_label("+%d needs in field log" % (valid_needs - shown_needs), 8, MUTED))
	var danger: Variant = _snapshot.get("danger", {})
	_risk.visible = (
		danger is Dictionary
		and String(danger.get("status", "")) == "known"
		and not String(danger.get("label", "")).is_empty()
	)
	_risk.text = "DANGER  ·  %s" % String(danger.get("label", "")) if _risk.visible else ""
	var bag: Variant = _snapshot.get("bag", {})
	_bag.visible = (
		bag is Dictionary
		and _is_number(bag.get("used", null))
		and _is_number(bag.get("capacity", null))
		and float(bag.get("used", -1)) >= 0.0
		and float(bag.get("capacity", 0)) > 0.0
	)
	if _bag.visible:
		var full := float(bag.get("used", 0)) >= float(bag.get("capacity", 0))
		_bag.text = (
			"PACK FULL  ·  %d / %d" % [int(bag.get("used", 0)), int(bag.get("capacity", 0))]
			if full
			else "PACK  ·  %d / %d" % [int(bag.get("used", 0)), int(bag.get("capacity", 0))]
		)
		_bag.add_theme_color_override("font_color", CORAL if full else MUTED)
	var event: Variant = _snapshot.get("feedback", {})
	var event_status := String(event.get("status", "")) if event is Dictionary else ""
	var event_source := String(event.get("provenance", "")) if event is Dictionary else ""
	var event_kind := String(event.get("kind", "")) if event is Dictionary else ""
	var valid_event_source := event_source in ["A0_OWNER_PROJECTION", "A3_OWNER_PROJECTION", "A4_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
	var feedback_core: Variant = _snapshot.get("core", {})
	var feedback_core_is_physical := (
		feedback_core is Dictionary
		and String(feedback_core.get("instance_id", "")).begins_with("soh_i_")
		and not String(feedback_core.get("item_id", "")).is_empty()
		and String(feedback_core.get("instance_source", "")) in ["A3_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
	)
	var committed_has_receipt := (
		event is Dictionary
		and valid_event_source
		and event_status == "committed"
		and not String(event.get("receipt_id", "")).strip_edges().is_empty()
		and (event_kind != "core_acquired" or feedback_core_is_physical)
	)
	_feedback.visible = (
		committed_has_receipt
		or (event is Dictionary and valid_event_source and event_status == "owner_rejected")
	)
	_feedback.text = _feedback_text(event) if _feedback.visible else ""
	var core: Variant = _snapshot.get("core", {})
	var core_id := String(core.get("instance_id", "")) if core is Dictionary else ""
	var item_id := String(core.get("item_id", "")) if core is Dictionary else ""
	_core_panel.visible = (
		core is Dictionary
		and core_id.begins_with("soh_i_")
		and not item_id.is_empty()
		and String(core.get("instance_source", "")) in ["A3_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
	)
	if _core_panel.visible:
		var custody_source := String(core.get("custody_source", ""))
		_core_title.text = "PHYSICAL CORE  /  %s" % String(core.get("name", item_id)).to_upper()
		var icon_record := core.duplicate(true)
		icon_record["id"] = item_id
		icon_record["kind"] = "core"
		icon_record["equipped"] = (
			custody_source in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
			and String(core.get("ownership_state", "")).begins_with("Equipped")
		)
		_core_icon.texture = PIXEL_UI.icon_texture(icon_record)
		_core_state.text = (
			String(core.get("ownership_state", "Ownership status unknown."))
			if custody_source in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
			else "Custody / equipment status unavailable from A0."
		)
		var uses: Variant = core.get("uses", null)
		var max_uses: Variant = core.get("max_uses", null)
		var condition: Variant = core.get("condition", null)
		var max_condition: Variant = core.get("max_condition", null)
		var details: Array[String] = []
		if (
			_is_number(uses)
			and _is_number(max_uses)
			and int(max_uses) >= 0
			and int(uses) >= 0
			and int(uses) <= int(max_uses)
		):
			details.append("Charges %d / %d" % [int(uses), int(max_uses)])
		else:
			details.append("Charges unknown")
		if (
			_is_number(condition)
			and _is_number(max_condition)
			and int(max_condition) > 0
			and int(condition) >= 0
			and int(condition) <= int(max_condition)
		):
			details.append("Condition %d / %d" % [int(condition), int(max_condition)])
		else:
			details.append("Condition unknown")
		var instance_id := String(core.get("instance_id", ""))
		if not instance_id.is_empty():
			details.append("ID %s" % instance_id)
		_core_details.text = "  ·  ".join(details)
		var readiness_source := String(core.get("readiness_source", ""))
		var readiness := (
			String(core.get("readiness", "UNKNOWN"))
			if readiness_source in ["A4_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
			else "UNKNOWN"
		)
		_core_readiness.text = "CAST READINESS  /  %s" % readiness
		_core_readiness.add_theme_color_override(
			"font_color", CORAL if readiness.contains("BLOCKED") else MUTED
		)


func _focus_text(value: Variant) -> String:
	if not value is Dictionary:
		return ""
	var kind := String(value.get("kind", ""))
	if kind == "poi":
		if not bool(value.get("discovered", false)):
			return "POI clue withheld until discovery."
		if String(value.get("discovery_source", "")) not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]:
			return ""
		var label := String(value.get("label", "Discovered place"))
		var clue := String(value.get("clue", ""))
		var readiness := String(value.get("content_readiness", ""))
		var text := "NEXT  ·  %s" % label
		if not clue.is_empty():
			text += "  ·  " + clue
		if not readiness.is_empty():
			text += "  ·  " + readiness.replace("_", " ")
		return text
	if kind == "workshop":
		var fixture := String(value.get("station_source", "")) == "FIXTURE_PROJECTION" and String(value.get("queue_source", "")) == "FIXTURE_PROJECTION"
		var owned := String(value.get("station_source", "")) == "A0_OWNER_PROJECTION" and String(value.get("queue_source", "")) == "A3_OWNER_PROJECTION"
		var used: Variant = value.get("queue_used", null)
		var capacity: Variant = value.get("queue_capacity", null)
		if (not fixture and not owned) or not used is int or not capacity is int or int(capacity) < 1 or int(used) < 0 or int(used) > int(capacity):
			return ""
		return "WORKSHOP  ·  %s T%d  ·  QUEUE %d / %d  ·  %s" % [String(value.get("station", "Station")), int(value.get("station_tier", 0)), int(used), int(capacity), String(value.get("job_status", "QUEUE STATUS UNKNOWN"))]
	if kind == "recovery":
		var owner_source := String(value.get("source", ""))
		if owner_source not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]:
			return ""
		var status := String(value.get("status", "unknown"))
		if status not in ["bag_dropped", "respawn_pending", "recovery_available", "recovered", "capacity_rejected", "unknown"]:
			return ""
		var recovery_label := String(value.get("label", "Death bag"))
		return "%s  ·  %s" % [recovery_label.to_upper(), status.replace("_", " ").to_upper()]
	return ""


func _feedback_text(event: Variant) -> String:
	if not event is Dictionary:
		return ""
	if String(event.get("status", "")) == "owner_rejected":
		return String(event.get("message", "Transfer not confirmed; refresh the owner snapshot."))
	var provenance := String(event.get("provenance", ""))
	var prefix := "PREVIEW  ·  " if provenance == "FIXTURE_PROJECTION" else ""
	var title := String(event.get("title", "Inventory updated"))
	var item_name := String(event.get("item_name", ""))
	var quantity := int(event.get("quantity", 0))
	if String(event.get("kind", "")) == "core_acquired":
		return "%sCORE SECURED  ·  %s" % [prefix, item_name if not item_name.is_empty() else title]
	if not item_name.is_empty() and quantity > 0:
		return "%s%s  +%d %s" % [prefix, title.to_upper(), quantity, item_name]
	return prefix + title


func _panel(fill: Color, edge: Color) -> PanelContainer:
	var panel: PanelContainer = PIXEL_PANEL.new()
	panel.configure(fill, edge, PIXEL_UI.GOLD)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return panel


func _label(text: String, size: int, color: Color, heading := false) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	PIXEL_UI.style_label(label, size, color, heading)
	return label


static func _is_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))
