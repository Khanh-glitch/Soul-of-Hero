extends Control
## Isolated composition seam. This is not the A0 production input gate.
signal modal_state_changed(active: bool)
signal request_action(action: String, target_id: String, payload: Dictionary)
signal closed
const JOURNAL := preload("res://game/survival/ui/survival_journal.tscn")
const DESK := preload("res://game/survival/ui/expedition_planner.tscn")
var journal: Control
var desk: Control
var _switching := false
var _focus_before: Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	journal = JOURNAL.instantiate()
	desk = DESK.instantiate()
	journal.show_workspace_navigation = true
	desk.show_workspace_navigation = true
	add_child(journal)
	add_child(desk)
	journal.desk_requested.connect(show_desk)
	desk.journal_requested.connect(show_journal)
	journal.closed.connect(_child_closed)
	desk.closed.connect(_child_closed)
	desk.request_action.connect(func(action: String, id: String, payload: Dictionary): request_action.emit(action, id, payload))
	desk.snapshot_changed.connect(_snapshot_changed)

func is_modal_active() -> bool:
	return is_visible_in_tree()

func open_workspace() -> void:
	if visible: return
	_focus_before = get_viewport().gui_get_focus_owner()
	visible = true
	journal.open_journal()
	modal_state_changed.emit(true)

func show_desk() -> void:
	if not visible or desk.visible: return
	_switching = true
	journal.close_journal()
	desk.open_planner()
	_switching = false

func show_journal() -> void:
	if not visible or journal.visible: return
	_switching = true
	desk.close_planner()
	journal.open_journal()
	_switching = false

func close_workspace() -> void:
	if not visible: return
	_switching = true
	journal.close_journal()
	desk.close_planner()
	_switching = false
	_finish_close()

func _child_closed() -> void:
	if not _switching: _finish_close()

func _finish_close() -> void:
	if not visible: return
	visible = false
	if is_instance_valid(_focus_before) and _focus_before.is_visible_in_tree(): _focus_before.grab_focus()
	modal_state_changed.emit(false)
	closed.emit()

## Only the host may provide snapshots and responses; this does not mutate them.
func apply_snapshot(snapshot: Dictionary) -> bool:
	return desk.apply_snapshot(snapshot)

func apply_host_response(response: Dictionary) -> bool:
	return desk.apply_host_response(response)

func _snapshot_changed(snapshot: Dictionary) -> void:
	var rows: Array[Dictionary] = []
	var bag: Variant = snapshot.get("satchel", snapshot.get("bag", []))
	if bag is Array:
		for raw: Variant in bag:
			if not raw is Dictionary or int(raw.get("count", 0)) <= 0: continue
			var row: Dictionary = raw.duplicate(true)
			row["stack_key"] = String(raw.get("stack_key", raw.get("id", "")))
			row["kind"] = String(raw.get("kind", "item"))
			rows.append(row)
	journal.set_bag(rows)
	var raw_placement: Variant = snapshot.get("placement", {})
	var placement := {"name":"Unknown piece", "status":"Placement information unavailable.", "costs": []}
	if raw_placement is Dictionary:
		placement["name"] = String(raw_placement.get("name", "Unknown piece"))
		placement["status"] = String(raw_placement.get("status", "Placement information unavailable."))
		var costs: Variant = raw_placement.get("costs", [])
		if costs is Array:
			for raw: Variant in costs:
				if not raw is Dictionary: continue
				var row: Dictionary = raw.duplicate(true)
				var sources: Array[String] = []
				if row.get("sources", []) is Array:
					for source: Variant in row.sources:
						if source is String: sources.append(source)
				row["sources"] = sources
				placement.costs.append(row)
	journal.set_placement(placement)
	var fields: Array[Dictionary] = []
	var supplied: Variant = snapshot.get("field_entries", [])
	if supplied is Array:
		for raw: Variant in supplied:
			if raw is Dictionary and bool(raw.get("revealed", false)):
				fields.append(raw.duplicate(true))
	journal.set_field_entries(fields)
