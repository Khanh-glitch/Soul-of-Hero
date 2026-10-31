extends Control
## Compact, passive A6 extension. A0 keeps its own region, provisions, counters,
## prompts, death and recovery UI. This view adds only discovered focus, confirmed
## feedback and a verified physical-Core summary from explicit owner projections.
## It never polls gameplay or authorizes inventory, loadout or Core actions.

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
var _developer_diagnostics := false
var _ui_scale := 1.0
var _status_panel: PanelContainer
var _phase: Label
var _provenance: Label
var _context: Label
var _feedback: Label
var _core_title: Label
var _core_state: Label
var _core_details: Label
var _core_icon: TextureRect
var _core_panel: Control


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	_refresh()


## Diagnostics are opt-in and OFF for player-facing use. Fixture data is hidden
## entirely in normal mode; a developer preview may reveal it with an explicit badge.
func set_developer_diagnostics(enabled: bool) -> void:
	_developer_diagnostics = enabled
	if is_inside_tree():
		_refresh()


## Requires a versioned owner projection. Unknown schemas, provenance and stale
## sequence/revision pairs are rejected instead of being guessed or presented.
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
	var viewport_size := get_viewport_rect().size
	_ui_scale = clampf(minf(viewport_size.x / 1280.0, viewport_size.y / 720.0), 1.0, 2.0)
	_status_panel = _panel(INK, EDGE)
	_status_panel.name = "A6ContextStatus"
	_status_panel.anchor_left = 1.0
	_status_panel.anchor_right = 1.0
	_status_panel.offset_left = -242 * _ui_scale
	_status_panel.offset_right = -12 * _ui_scale
	_status_panel.offset_top = 12 * _ui_scale
	_status_panel.offset_bottom = 136 * _ui_scale
	add_child(_status_panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", roundi(2 * _ui_scale))
	_status_panel.add_child(column)
	_phase = _label("In the field", 11, GOLD, true)
	column.add_child(_phase)
	_context = _label("", 9, PAPER)
	_context.visible = false
	column.add_child(_context)
	_provenance = _label("", 8, MUTED)
	_provenance.name = "DeveloperDiagnostics"
	_provenance.visible = false
	column.add_child(_provenance)
	_core_panel = HBoxContainer.new()
	_core_panel.name = "PhysicalCoreStatus"
	_core_panel.add_theme_constant_override("separation", roundi(5 * _ui_scale))
	_core_panel.visible = false
	column.add_child(_core_panel)
	_core_icon = TextureRect.new()
	_core_icon.custom_minimum_size = Vector2(24, 24) * _ui_scale
	_core_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_core_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_core_icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_core_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_core_panel.add_child(_core_icon)
	var core_column := VBoxContainer.new()
	core_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	core_column.add_theme_constant_override("separation", 0)
	_core_panel.add_child(core_column)
	_core_title = _label("", 9, GOLD, true)
	core_column.add_child(_core_title)
	_core_state = _label("", 8, PAPER)
	core_column.add_child(_core_state)
	_core_details = _label("", 8, MUTED)
	core_column.add_child(_core_details)
	_feedback = _label("", 9, PAPER)
	_feedback.visible = false
	column.add_child(_feedback)


func _refresh() -> void:
	if _phase == null:
		return
	var is_fixture := String(_snapshot.get("provenance", "")) == "FIXTURE_PROJECTION"
	var can_show_projection := not _snapshot.is_empty() and (not is_fixture or _developer_diagnostics)
	_status_panel.visible = can_show_projection
	if not can_show_projection:
		return

	var labels := {
		"exploration": "In the field",
		"looting": "Scavenging",
		"battle": "In danger",
		"workshop": "At the workshop",
		"death": "Recovering",
		"respawn": "Returned",
	}
	var mode := String(_snapshot.get("mode", ""))
	_phase.text = String(labels.get(mode, "In the field"))
	_phase.add_theme_color_override("font_color", CORAL if mode in ["battle", "death"] else GOLD)

	var provenance := String(_snapshot.get("provenance", ""))
	_provenance.visible = _developer_diagnostics
	_provenance.text = "DEV PREVIEW · %s" % provenance.replace("_", " ") if _developer_diagnostics else ""

	var focus_text := _focus_text(_snapshot.get("focus", {}))
	_context.text = focus_text
	_context.visible = not focus_text.is_empty()

	var core: Variant = _snapshot.get("core", {})
	var core_id := String(core.get("instance_id", "")) if core is Dictionary else ""
	var item_id := String(core.get("item_id", "")) if core is Dictionary else ""
	var instance_source := String(core.get("instance_source", "")) if core is Dictionary else ""
	_core_panel.visible = (
		core is Dictionary
		and core_id.begins_with("soh_i_")
		and not item_id.is_empty()
		and instance_source in ["A3_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
		and (instance_source != "FIXTURE_PROJECTION" or _developer_diagnostics)
	)
	if _core_panel.visible:
		_core_title.text = String(core.get("name", "Skill Core"))
		var icon_record: Dictionary = core.duplicate(true)
		icon_record["id"] = item_id
		icon_record["kind"] = "core"
		_core_icon.texture = PIXEL_UI.icon_texture(icon_record)
		_core_state.text = _owner_facing_custody(core)
		var details: Array[String] = []
		var uses: Variant = core.get("uses", null)
		var max_uses: Variant = core.get("max_uses", null)
		if _valid_count(uses, max_uses):
			details.append("%d / %d charges" % [int(uses), int(max_uses)])
		var condition: Variant = core.get("condition", null)
		var max_condition: Variant = core.get("max_condition", null)
		if _valid_count(condition, max_condition) and int(max_condition) > 0:
			details.append("%d%% condition" % roundi(100.0 * float(condition) / float(max_condition)))
		_core_details.text = "  ·  ".join(details)
		_core_details.visible = not details.is_empty()
	else:
		_core_core_clear()

	var event: Variant = _snapshot.get("feedback", {})
	var event_source := String(event.get("provenance", "")) if event is Dictionary else ""
	var event_status := String(event.get("status", "")) if event is Dictionary else ""
	var allowed_event_source := event_source in [
		"A0_OWNER_PROJECTION", "A3_OWNER_PROJECTION", "A4_OWNER_PROJECTION", "FIXTURE_PROJECTION"
	]
	var feedback_core: Variant = _snapshot.get("core", {})
	var feedback_core_is_physical := (
		feedback_core is Dictionary
		and String(feedback_core.get("instance_id", "")).begins_with("soh_i_")
		and not String(feedback_core.get("item_id", "")).is_empty()
		and String(feedback_core.get("instance_source", "")) in ["A3_OWNER_PROJECTION", "FIXTURE_PROJECTION"]
	)
	var committed_has_receipt := (
		event is Dictionary
		and allowed_event_source
		and event_status == "committed"
		and not String(event.get("receipt_id", "")).strip_edges().is_empty()
		and (String(event.get("kind", "")) != "core_acquired" or feedback_core_is_physical)
		and (event_source != "FIXTURE_PROJECTION" or _developer_diagnostics)
	)
	var owner_rejected := (
		event is Dictionary
		and allowed_event_source
		and event_status == "owner_rejected"
		and (event_source != "FIXTURE_PROJECTION" or _developer_diagnostics)
	)
	_feedback.visible = committed_has_receipt or owner_rejected
	_feedback.text = _feedback_text(event) if _feedback.visible else ""


func _focus_text(value: Variant) -> String:
	if not value is Dictionary:
		return ""
	var kind := String(value.get("kind", ""))
	if kind == "poi":
		if not bool(value.get("discovered", false)):
			return ""
		if String(value.get("discovery_source", "")) not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]:
			return ""
		var label := String(value.get("label", "")).strip_edges()
		if label.is_empty():
			return ""
		var clue := String(value.get("clue", "")).strip_edges()
		if not clue.is_empty():
			return "%s · %s" % [label, _short_text(clue, 52)]
		return label
	if kind == "workshop":
		var station_source := String(value.get("station_source", ""))
		var queue_source := String(value.get("queue_source", ""))
		var fixture := station_source == "FIXTURE_PROJECTION" and queue_source == "FIXTURE_PROJECTION"
		var owned := station_source == "A0_OWNER_PROJECTION" and queue_source == "A3_OWNER_PROJECTION"
		var used: Variant = value.get("queue_used", null)
		var capacity: Variant = value.get("queue_capacity", null)
		if (not fixture and not owned) or not used is int or not capacity is int or int(capacity) < 1 or int(used) < 0 or int(used) > int(capacity):
			return ""
		if fixture and not _developer_diagnostics:
			return ""
		return "%s · %d / %d jobs" % [String(value.get("station", "Workshop")), int(used), int(capacity)]
	if kind == "recovery":
		var source := String(value.get("source", ""))
		if source not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]:
			return ""
		if source == "FIXTURE_PROJECTION" and not _developer_diagnostics:
			return ""
		var recovery_labels := {
			"bag_dropped": "Death bag dropped",
			"respawn_pending": "Respawn pending",
			"recovery_available": "Death bag ready to retrieve",
			"recovered": "Belongings recovered",
			"capacity_rejected": "Make room before retrieving the bag",
		}
		return String(recovery_labels.get(String(value.get("status", "")), ""))
	return ""


func _owner_facing_custody(core: Dictionary) -> String:
	var source := String(core.get("custody_source", ""))
	if source not in ["A0_OWNER_PROJECTION", "FIXTURE_PROJECTION"]:
		return ""
	if source == "FIXTURE_PROJECTION" and not _developer_diagnostics:
		return ""
	var state := String(core.get("ownership_state", ""))
	if state.begins_with("Equipped"):
		return "Equipped"
	if state.to_lower().contains("satchel") or state.to_lower().contains("bag"):
		return "In your pack"
	if state.to_lower().contains("storage") or state.to_lower().contains("stored"):
		return "Stored"
	if state.to_lower().contains("recovery") or state.to_lower().contains("death"):
		return "With your belongings"
	return ""


func _feedback_text(event: Dictionary) -> String:
	if String(event.get("status", "")) == "owner_rejected":
		return _friendly_rejection(String(event.get("message", "")))
	var kind := String(event.get("kind", ""))
	if kind == "core_acquired":
		var core: Dictionary = _snapshot.get("core", {})
		return "%s found" % String(core.get("name", "Skill Core"))
	var title := _short_text(String(event.get("title", "")), 32)
	var item_name := _short_text(String(event.get("item_name", "")), 32)
	var quantity: Variant = event.get("quantity", 0)
	if not item_name.is_empty() and quantity is int and int(quantity) > 0:
		return "%s · +%d %s" % [title if not title.is_empty() else "Added", int(quantity), item_name]
	return title


func _friendly_rejection(message: String) -> String:
	var lower := message.to_lower()
	if lower.contains("full") or lower.contains("space"):
		return "No room. Make space and try again."
	if lower.contains("range") or lower.contains("near"):
		return "Move closer and try again."
	if lower.contains("dead") or lower.contains("alive"):
		return "You cannot do that right now."
	if lower.is_empty():
		return "Action not completed. Check your belongings and try again."
	return _short_text(message, 64)


func _core_core_clear() -> void:
	_core_title.text = ""
	_core_state.text = ""
	_core_details.text = ""
	_core_details.visible = false
	_core_icon.texture = null


func _short_text(value: String, max_chars: int) -> String:
	var clean := " ".join(value.strip_edges().split(" ", false))
	if clean.length() <= max_chars:
		return clean
	return clean.substr(0, max_chars - 1).strip_edges() + "…"


static func _valid_count(current: Variant, maximum: Variant) -> bool:
	return (
		_is_number(current)
		and _is_number(maximum)
		and float(maximum) > 0.0
		and float(maximum) >= float(current)
		and float(current) >= 0.0
	)


static func _is_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))


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
	PIXEL_UI.style_label(label, roundi(size * _ui_scale), color, heading)
	return label
