extends CanvasLayer
## The workshop: what you can make here, what it costs, and what is already running.
##
## This panel only *asks*: every button calls one session command, and time, stock,
## receipts and recipes stay owned by the A3 session and SaveService. Nothing is
## computed here except which costs you are currently short of, which is read from
## A0's own inventory totals so the row can say "short 2 iron scrap" before the
## command is refused.
##
## Node names are part of the contract: `Recipe_<recipe>_<station>` and
## `Technology_<tech>_<station>` buttons stay in a ScrollContainer, and their text
## still ends in the exact cost list, because the runtime tests and the input gate
## find them by name.

const STATION_ICONS := {
	"hand": "knife",
	"workbench": "workbench_kit",
	"furnace": "furnace_kit",
	"research": "research_kit",
	"garden": "garden_kit",
}

var _host: Node
var _root: Control
var _list: VBoxContainer
var _notice: Label
var _pack_label: Label


func _ready() -> void:
	# Above the always-visible HUD (layer 20); death closes this panel first.
	layer = 21
	_root = Control.new()
	_root.name = "EconomyOverlay"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_to_group(&"gameplay_modal")
	_root.visible = false
	add_child(_root)
	A6UiKit.dress(_root)

	var shade := ColorRect.new()
	shade.name = "Shade"
	shade.color = Color(0.03, 0.02, 0.02, 0.72)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(shade)

	var window := A6UiKit.window()
	window.name = "Window"
	window.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	window.position = Vector2(-230, -160)
	window.custom_minimum_size = Vector2(460, 320)
	_root.add_child(window)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 5)
	window.add_child(column)

	var header := HBoxContainer.new()
	header.name = "Header"
	column.add_child(header)
	var title := A6UiKit.label("WORKSHOP", "heading", 17)
	title.name = "Title"
	title.add_theme_color_override("font_color", A6UiKit.GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	_pack_label = A6UiKit.label("", "number", 11)
	_pack_label.name = "Pack"
	_pack_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(_pack_label)
	var close := Button.new()
	close.name = "Close"
	close.text = "CLOSE [C]"
	close.custom_minimum_size = Vector2(0, 20)
	close.add_theme_font_size_override("font_size", 11)
	close.pressed.connect(_close)
	header.add_child(close)

	_notice = A6UiKit.label("Hand kits work anywhere. Stand near a station for its recipes.", "caption", 10)
	_notice.name = "Notice"
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_notice.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	column.add_child(_notice)

	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_list = VBoxContainer.new()
	_list.name = "Jobs"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 3)
	scroll.add_child(_list)

	var footer := A6UiKit.label("Active jobs only advance while this panel is closed.", "caption", 9)
	footer.name = "Footer"
	footer.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	column.add_child(footer)


func configure(host: Node) -> void:
	_host = host


func toggle() -> void:
	if _root == null:
		return
	_root.visible = not _root.visible
	if _root.visible:
		_refresh()


func is_open() -> bool:
	return _root != null and _root.is_visible_in_tree()


func _close() -> void:
	close_panel()


func close_panel() -> void:
	if _root != null:
		_root.visible = false


# --- live data ---------------------------------------------------------------

## Item label from the survival catalog, lowercased so cost rows read as prose
## ("3 iron scrap"). Unknown ids fall back to the id itself rather than being hidden.
func _item_label(item_id: String) -> String:
	var service := get_node_or_null("/root/SurvivalService")
	if service != null and service.has_method(&"item_definition"):
		var definition: Dictionary = service.call(&"item_definition", item_id)
		var label := String(definition.get("label", ""))
		if not label.is_empty():
			return label.to_lower()
	return item_id.replace("_", " ")


func _format_items(items: Dictionary) -> String:
	var parts: Array[String] = []
	var ids: Array = items.keys()
	ids.sort()
	for key: Variant in ids:
		parts.append("%d %s" % [int(items[key]), _item_label(String(key))])
	return ", ".join(parts) if not parts.is_empty() else "nothing"


## How many of each item the committed bag holds. A0 owns this; the panel never adds.
func _owned_totals() -> Dictionary:
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"inventory_totals"):
		return {}
	return save.call(&"inventory_totals") as Dictionary


func _affordable(items: Dictionary, owned: Dictionary) -> bool:
	for key: Variant in items.keys():
		if int(owned.get(String(key), 0)) < int(items[key]):
			return false
	return true


## The first item a recipe is short of, for a concrete refusal reason.
func _first_shortfall(items: Dictionary, owned: Dictionary) -> String:
	for key: Variant in items.keys():
		var short := int(items[key]) - int(owned.get(String(key), 0))
		if short > 0:
			return "short %d %s" % [short, _item_label(String(key))]
	return ""


func _refresh() -> void:
	if _host == null or not is_instance_valid(_host):
		return
	for child: Node in _list.get_children():
		# Remove immediately so new rows keep stable names during this frame;
		# freeing stays deferred until input dispatch has finished.
		_list.remove_child(child)
		child.queue_free()
	_refresh_pack()
	var owned := _owned_totals()
	var jobs: Dictionary = _host.call(&"jobs")
	var stations: Array = _host.call(&"nearby_stations")
	for raw: Variant in stations:
		var station: Dictionary = raw
		_add_station_header(station, jobs)
		_add_recipes(station, owned)
		if String(station.get("kind", "")) == "research":
			_add_technologies(station, owned)
	_add_running_jobs(jobs)


func _refresh_pack() -> void:
	if _pack_label == null:
		return
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"get_inventory_capacity_snapshot"):
		_pack_label.text = "PACK —"
		return
	var snapshot: Dictionary = save.call(&"get_inventory_capacity_snapshot")
	_pack_label.text = "PACK %d/%d" % [
		int(snapshot.get("bag_used", 0)), int(snapshot.get("bag_capacity", 0)),
	]


func _add_station_header(station: Dictionary, jobs: Dictionary) -> void:
	var kind := String(station.get("kind", ""))
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	var used := 0
	for job: Variant in jobs.values():
		if String((job as Dictionary).get("station_id", "")) == station_id \
				and String((job as Dictionary).get("status", "")) in ["queued", "running", "paused", "ready", "cancelled"]:
			used += 1

	var plate := PanelContainer.new()
	plate.name = "Station_%s" % station_id
	plate.theme_type_variation = &"A6HudBar"
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_list.add_child(plate)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	plate.add_child(row)
	var picture := A6UiKit.icon(String(STATION_ICONS.get(kind, "workbench_kit")), 13)
	if picture != null:
		row.add_child(picture)
	var name_label := A6UiKit.label(kind.capitalize() if not kind.is_empty() else "Bench", "heading", 12)
	name_label.add_theme_color_override("font_color", A6UiKit.CREAM)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_label)
	var queue_label := A6UiKit.label(
		"%d/%d" % [used, int(station.get("queue_capacity", 1))], "number", 11
	)
	queue_label.add_theme_color_override(
		"font_color", A6UiKit.WARN if used >= int(station.get("queue_capacity", 1)) else A6UiKit.GOLD
	)
	row.add_child(queue_label)
	if not operational:
		var offline := A6UiKit.label("OFFLINE", "warning", 10)
		row.add_child(offline)


func _add_recipes(station: Dictionary, owned: Dictionary) -> void:
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	for value: Variant in (_host.call(&"available_recipes", station_id) as Array):
		var recipe: Dictionary = value
		var row := HBoxContainer.new()
		row.name = "Row_%s_%s" % [String(recipe.id), station_id]
		row.add_theme_constant_override("separation", 4)
		_list.add_child(row)

		var output_icon := _first_output_icon(recipe)
		var frame := A6UiKit.socket()
		frame.custom_minimum_size = Vector2(20, 20)
		frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(frame)
		if output_icon != null:
			frame.add_child(output_icon)

		var button := Button.new()
		button.name = "Recipe_%s_%s" % [String(recipe.id), station_id]
		var shortfall := _first_shortfall(recipe.inputs, owned)
		var cost_note := "" if shortfall.is_empty() else "  —  %s" % shortfall
		button.text = "%s — needs %s — fuel %s — makes %s — %ds active%s" % [
			_item_label(_first_output_id(recipe)).capitalize(),
			_format_items(recipe.inputs),
			_format_items(recipe.fuel),
			_format_items(recipe.outputs),
			int(recipe.duration_ticks),
			cost_note,
		]
		# A long recipe must wrap inside the scroll viewport instead of widening the
		# list and pushing Collect off the right edge.
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 18)
		button.add_theme_font_size_override("font_size", 10)
		button.disabled = not operational
		if not shortfall.is_empty():
			# Amber, not red: short of materials is a shopping list, not an error.
			button.add_theme_color_override("font_color", A6UiKit.FILL_GOOD)
		button.pressed.connect(_queue.bind(String(recipe.id), station_id))
		row.add_child(button)


func _add_technologies(station: Dictionary, owned: Dictionary) -> void:
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	for value: Variant in (_host.call(&"available_technologies", station_id) as Array):
		var tech: Dictionary = value
		var known := bool(tech.known)
		var row := HBoxContainer.new()
		row.name = "TechRow_%s_%s" % [String(tech.id), station_id]
		row.add_theme_constant_override("separation", 4)
		_list.add_child(row)

		var frame := A6UiKit.socket()
		frame.custom_minimum_size = Vector2(20, 20)
		frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(frame)
		var scroll_icon := A6UiKit.icon("research_kit", 16)
		if scroll_icon != null:
			frame.add_child(scroll_icon)

		var button := Button.new()
		button.name = "Technology_%s_%s" % [String(tech.id), station_id]
		var required := ", ".join(PackedStringArray(tech.prerequisites)) if not (tech.prerequisites as Array).is_empty() else "none"
		var state := "learned" if known else _first_shortfall(tech.inputs, owned)
		button.text = "%s — needs %s — requires %s — %ds active%s" % [
			String(tech.label),
			_format_items(tech.inputs),
			required,
			int(tech.duration_ticks),
			"" if state.is_empty() else "  —  " + state,
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 18)
		button.add_theme_font_size_override("font_size", 10)
		button.disabled = known or not operational
		if not known and not state.is_empty() and state != "learned":
			button.add_theme_color_override("font_color", A6UiKit.FILL_GOOD)
		button.pressed.connect(_research.bind(String(tech.id), station_id))
		row.add_child(button)


func _add_running_jobs(jobs: Dictionary) -> void:
	var ids: Array = jobs.keys()
	if not ids.is_empty():
		var spacer := Control.new()
		spacer.custom_minimum_size = Vector2(0, 2)
		_list.add_child(spacer)
	ids.sort()
	for raw_id: Variant in ids:
		var job_id := String(raw_id)
		var job: Dictionary = jobs[raw_id]
		var status := String(job.get("status", ""))
		var row := HBoxContainer.new()
		row.name = "Job_%s" % job_id
		row.add_theme_constant_override("separation", 4)
		_list.add_child(row)

		var elapsed := int(job.get("elapsed", 0))
		var duration := maxi(1, int(job.get("duration", 1)))
		var bar_parts := A6UiKit.bar(70, 9)
		var bar_root: Control = bar_parts["root"]
		bar_root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(bar_root)
		A6UiKit.set_bar(bar_parts, float(elapsed), float(duration))

		var label := A6UiKit.label(
			"%s · %s %d/%d" % [String(job.get("target", "")).replace("_", " "), _status_word(status), elapsed, duration],
			"caption", 10
		)
		label.add_theme_color_override("font_color", A6UiKit.INK)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(label)

		var action := Button.new()
		action.name = "JobAction"
		var ready := status == "ready"
		action.text = "COLLECT" if ready else "CANCEL"
		action.custom_minimum_size = Vector2(0, 18)
		action.add_theme_font_size_override("font_size", 10)
		action.pressed.connect(_job_action.bind(job_id, ready))
		row.add_child(action)


## Player words for the session's own status strings. Unknown statuses are shown
## verbatim rather than smoothed into something the owner did not say.
func _status_word(status: String) -> String:
	match status:
		"queued":
			return "queued"
		"running":
			return "working"
		"paused":
			return "paused"
		"ready":
			return "ready"
		"cancelled":
			return "cancelled"
		_:
			return status


func _first_output_id(recipe: Dictionary) -> String:
	var outputs: Dictionary = recipe.get("outputs", {})
	for key: Variant in outputs.keys():
		return String(key)
	return String(recipe.get("id", ""))


func _first_output_icon(recipe: Dictionary) -> TextureRect:
	return A6UiKit.icon(_first_output_id(recipe), 14)


# --- commands ---------------------------------------------------------------

func _queue(recipe: String, station: String) -> void:
	var result: Dictionary = _host.call(&"queue_recipe", recipe, station)
	_notice.text = "Queued. Close the panel to work." if bool(result.get("ok", false)) \
		else "Cannot queue: " + String(result.get("reason", "rejected"))
	_notice.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_refresh()


func _research(technology: String, station: String) -> void:
	var result: Dictionary = _host.call(&"queue_technology", technology, station)
	_notice.text = "Research queued. Close the panel to work." if bool(result.get("ok", false)) \
		else "Cannot research: " + String(result.get("reason", "rejected"))
	_notice.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_refresh()


func _job_action(job: String, collect_item: bool) -> void:
	var result: Dictionary = _host.call(&"collect" if collect_item else &"cancel", job)
	_notice.text = "Done." if bool(result.get("ok", false)) \
		else "Cannot complete: " + String(result.get("reason", "rejected"))
	_notice.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_refresh()
