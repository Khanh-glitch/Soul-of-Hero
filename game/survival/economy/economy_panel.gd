extends CanvasLayer
## Minimal A0 interaction surface; A6 owns the eventual integrated journal UI.
## Commands carry intent only. Time, receipts, inventory and recipes remain owned
## by the session/A3/SaveService. Closing the panel resumes active production.

var _host: Node
var _root: Control
var _list: VBoxContainer
var _notice: Label

func _ready() -> void:
	layer = 18
	_root = Control.new()
	_root.name = "EconomyOverlay"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_to_group(&"gameplay_modal")
	_root.visible = false
	add_child(_root)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.02, 0.03, 0.8)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(shade)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	panel.position = Vector2(-220, -155)
	panel.custom_minimum_size = Vector2(440, 310)
	_root.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	var title := Label.new()
	title.text = "WORK & CRAFT — close to run active time"
	column.add_child(title)
	_notice = Label.new()
	_notice.text = "Hand kits work anywhere. Stand near a station for its recipes."
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_notice)
	var controls := HBoxContainer.new()
	column.add_child(controls)
	var refresh := Button.new()
	refresh.text = "Refresh jobs"
	refresh.pressed.connect(_refresh)
	controls.add_child(refresh)
	var close := Button.new()
	close.text = "Close [C]"
	close.pressed.connect(_close)
	controls.add_child(close)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)

func configure(host: Node) -> void:
	_host = host

func toggle() -> void:
	if _root == null:
		return
	_root.visible = not _root.visible
	if _root.visible:
		_refresh()

func _close() -> void:
	close_panel()

func close_panel() -> void:
	if _root != null:
		_root.visible = false

func _format_items(items: Dictionary) -> String:
	var parts: Array[String] = []
	for key: Variant in items.keys():
		parts.append("%d %s" % [int(items[key]), String(key).replace("_", " ")])
	return ", ".join(parts) if not parts.is_empty() else "none"

func _refresh() -> void:
	if _host == null or not is_instance_valid(_host):
		return
	for child: Node in _list.get_children():
		child.queue_free()
	var stations: Array = _host.call(&"nearby_stations")
	for raw: Variant in stations:
		var station: Dictionary = raw
		var id := String(station.get("station_id", ""))
		var label := Label.new()
		label.text = "%s %s" % [String(station.get("kind", "")).capitalize(), "(offline)" if not bool(station.get("operational", true)) else ""]
		_list.add_child(label)
		for value: Variant in (_host.call(&"available_recipes", id) as Array):
			var recipe: Dictionary = value
			var button := Button.new()
			button.name = "Recipe_%s_%s" % [String(recipe.id), id]
			button.text = "%s — %s — %ds" % [String(recipe.id).replace("_", " ").capitalize(), _format_items(recipe.inputs), int(recipe.duration_ticks)]
			button.disabled = not bool(station.get("operational", true))
			button.pressed.connect(_queue.bind(String(recipe.id), id))
			_list.add_child(button)
	var jobs: Dictionary = _host.call(&"jobs")
	var ids: Array = jobs.keys()
	ids.sort()
	for raw_id: Variant in ids:
		var job_id := String(raw_id)
		var job: Dictionary = jobs[raw_id]
		var row := HBoxContainer.new()
		_list.add_child(row)
		var label := Label.new()
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.text = "%s: %s %d/%d" % [String(job.get("target", "")).replace("_", " "), String(job.get("status", "")), int(job.get("elapsed", 0)), int(job.get("duration", 0))]
		row.add_child(label)
		var action := Button.new()
		var ready := String(job.get("status", "")) == "ready"
		action.text = "Collect" if ready else "Cancel"
		action.pressed.connect(_job_action.bind(job_id, ready))
		row.add_child(action)

func _queue(recipe: String, station: String) -> void:
	var result: Dictionary = _host.call(&"queue_recipe", recipe, station)
	_notice.text = "Queued. Close the panel to work." if bool(result.get("ok", false)) else "Cannot queue: " + String(result.get("reason", "rejected"))
	_refresh()

func _job_action(job: String, collect_item: bool) -> void:
	var result: Dictionary = _host.call(&"collect" if collect_item else &"cancel", job)
	_notice.text = "Done." if bool(result.get("ok", false)) else "Cannot complete: " + String(result.get("reason", "rejected"))
	_refresh()
