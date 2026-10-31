extends Control
## Isolated composition seam. This is not the A0 production input gate.
signal modal_state_changed(active: bool)
signal request_action(action: String, target_id: String, payload: Dictionary)
signal closed
const JOURNAL := preload("res://game/survival/ui/survival_journal.tscn")
const DESK := preload("res://game/survival/ui/expedition_planner.tscn")
const JOURNEYS := preload("res://game/survival/ui/acceptance_journeys.gd")
var journal: Control
var desk: Control
var journeys: Control
var _switching := false
var _modal_reported := false
var _focus_before: Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	# A0's current overworld host discovers visible modal roots through this group.
	# Membership is only a handshake: this isolated workspace is not mounted into
	# production, and A0 still has to gate every polled gameplay input path.
	add_to_group(&"gameplay_modal")
	journal = JOURNAL.instantiate()
	desk = DESK.instantiate()
	journeys = JOURNEYS.new()
	journeys.name = "AcceptanceJourneys"
	journeys.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	journeys.visible = false
	journal.show_workspace_navigation = true
	journal.show_journeys_navigation = true
	desk.show_workspace_navigation = true
	desk.show_journeys_navigation = true
	journeys.show_workspace_navigation = true
	add_child(journal)
	add_child(desk)
	add_child(journeys)
	journal.desk_requested.connect(show_desk)
	desk.journal_requested.connect(show_journal)
	journal.journeys_requested.connect(show_journeys)
	desk.journeys_requested.connect(show_journeys)
	journeys.journal_requested.connect(show_journal)
	journeys.desk_requested.connect(show_desk)
	journal.closed.connect(_child_closed)
	desk.closed.connect(_child_closed)
	journeys.closed.connect(_child_closed)
	journal.modal_state_changed.connect(_child_modal_changed)
	desk.modal_state_changed.connect(_child_modal_changed)
	journeys.modal_state_changed.connect(_child_modal_changed)
	tree_exiting.connect(_on_tree_exiting)
	desk.request_action.connect(func(action: String, id: String, payload: Dictionary): request_action.emit(action, id, payload))
	desk.snapshot_changed.connect(_snapshot_changed)

func is_modal_active() -> bool:
	_sync_modal_state()
	return _modal_reported

func _process(_delta: float) -> void:
	# Effective visibility follows hidden ancestors as well as explicit open/close.
	# This is a UI notification seam only; it does not gate polled game input.
	_sync_modal_state()

func _sync_modal_state(force_closed := false) -> void:
	var active := not force_closed and is_visible_in_tree() and ((is_instance_valid(journal) and journal.is_visible_in_tree()) or (is_instance_valid(desk) and desk.is_visible_in_tree()) or (is_instance_valid(journeys) and journeys.is_visible_in_tree()))
	if active == _modal_reported: return
	_modal_reported = active
	modal_state_changed.emit(active)

func _child_modal_changed(_active: bool) -> void:
	if not _switching: _sync_modal_state()

func _on_tree_exiting() -> void:
	_sync_modal_state(true)

func open_workspace() -> void:
	if visible: return
	_focus_before = get_viewport().gui_get_focus_owner()
	visible = true
	journal.open_journal()
	_sync_modal_state()

func show_desk() -> void:
	if not visible or desk.visible: return
	_switching = true
	journal.close_journal()
	journeys.close_journeys()
	desk.open_planner()
	_switching = false
	_sync_modal_state()

func show_journal() -> void:
	if not visible or journal.visible: return
	_switching = true
	desk.close_planner()
	journeys.close_journeys()
	journal.open_journal()
	_switching = false
	_sync_modal_state()

func show_journeys() -> void:
	if not visible or journeys.visible: return
	_switching = true
	journal.close_journal()
	desk.close_planner()
	journeys.open_journeys()
	_switching = false
	_sync_modal_state()

func close_workspace() -> void:
	if not visible: return
	_switching = true
	journal.close_journal()
	desk.close_planner()
	journeys.close_journeys()
	_switching = false
	_finish_close()

func _child_closed() -> void:
	if not _switching: _finish_close()

func _finish_close() -> void:
	if not visible: return
	visible = false
	if is_instance_valid(_focus_before) and _focus_before.is_visible_in_tree(): _focus_before.grab_focus()
	_sync_modal_state()
	closed.emit()

## Only the host may provide snapshots and responses; this does not mutate them.
func apply_snapshot(snapshot: Dictionary) -> bool:
	return desk.apply_snapshot(snapshot)

func apply_host_response(response: Dictionary) -> bool:
	return desk.apply_host_response(response)

## Owner-authored inputs are assembled by the test/acceptance fixture, never by
## this production-facing UI. The journey view only stores a read-only projection.
func apply_journey_fixture(snapshot: Dictionary) -> bool:
	return journeys.set_fixture(snapshot)

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
