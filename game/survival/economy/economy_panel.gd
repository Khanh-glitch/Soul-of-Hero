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


## One recipe or technology, as a card you can read at a glance:
##   [result icon]  Name - exact costs            [duration]
##                  [icon] 3/5  [icon] 8/8  [fuel] 2/2
##                  "short 8 stone chunk"
## The button keeps the contract its consumers rely on - the name `Recipe_<id>_<station>`
## and a text that ends in the exact cost list - while the icons and counts beside it
## carry the comparison (what you have against what it wants) that a sentence cannot.
func _add_recipes(station: Dictionary, owned: Dictionary) -> void:
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	var used := _queue_used(station, _host.call(&"jobs") as Dictionary)
	var capacity := int(station.get("queue_capacity", 1))
	for value: Variant in (_host.call(&"available_recipes", station_id) as Array):
		var recipe: Dictionary = value
		var inputs: Dictionary = recipe.inputs
		var shortfall := _first_shortfall(inputs, owned)
		var button := _card_row(
			station_id, "Recipe",
			_first_output_id(recipe),
			_button_text(_first_output_id(recipe), inputs),
			_first_output_icon(recipe),
			inputs,
			owned,
			recipe.fuel,
			"%ds" % int(recipe.duration_ticks),
			_state_of(operational, used >= capacity, shortfall),
			_state_colour(operational, used >= capacity, shortfall),
		)
		if button != null:
			button.pressed.connect(_queue.bind(String(recipe.id), station_id))


func _add_technologies(station: Dictionary, owned: Dictionary) -> void:
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	var used := _queue_used(station, _host.call(&"jobs") as Dictionary)
	var capacity := int(station.get("queue_capacity", 1))
	for value: Variant in (_host.call(&"available_technologies", station_id) as Array):
		var tech: Dictionary = value
		var known := bool(tech.known)
		var shortfall := _first_shortfall(tech.inputs, owned)
		var state := "learned" if known else _state_of(operational, used >= capacity, shortfall)
		var colour := A6UiKit.INK_SOFT if known else _state_colour(operational, used >= capacity, shortfall)
		var button := _card_row(
			station_id, "Technology",
			String(tech.id),
			_button_text_for(String(tech.label), tech.inputs, tech.prerequisites),
			A6UiKit.icon("research_kit", 14),
			tech.inputs,
			owned,
			{},
			"%ds" % int(tech.duration_ticks),
			state,
			colour,
		)
		if button == null:
			continue
		button.disabled = known or not operational
		button.pressed.connect(_research.bind(String(tech.id), station_id))


## Builds one card and returns its action button. `prefix` and `key` form the node
## name (`Recipe_<id>_<station>` / `Technology_<id>_<station>`), which callers and the
## input-gate tests resolve by.
func _card_row(
	station_id: String,
	prefix: String,
	key: String,
	text: String,
	icon: TextureRect,
	inputs: Dictionary,
	owned: Dictionary,
	fuel: Dictionary,
	duration_text: String,
	state_text: String,
	state_colour: Color,
) -> Button:
	var card := PanelContainer.new()
	card.name = "Row_%s_%s" % [key, station_id]
	card.theme_type_variation = &"A6HudBar"
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	_list.add_child(card)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.mouse_filter = Control.MOUSE_FILTER_PASS
	card.add_child(row)

	var frame := A6UiKit.socket()
	frame.custom_minimum_size = Vector2(22, 22)
	frame.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(frame)
	if icon != null:
		frame.add_child(icon)

	var middle := VBoxContainer.new()
	middle.name = "Body"
	middle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	middle.add_theme_constant_override("separation", 1)
	middle.mouse_filter = Control.MOUSE_FILTER_PASS
	row.add_child(middle)

	var button := Button.new()
	button.name = "%s_%s_%s" % [prefix, key, station_id]
	button.text = text
	# A recipe line is a shopping list, not prose: it wraps inside the column instead
	# of widening the list and pushing the action off the right edge.
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.custom_minimum_size = Vector2(0, 17)
	button.add_theme_font_size_override("font_size", 11)
	button.add_theme_color_override("font_color", A6UiKit.CREAM)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	middle.add_child(button)

	middle.add_child(_ingredient_row(inputs, owned, fuel))

	var right := VBoxContainer.new()
	right.name = "Timing"
	right.custom_minimum_size = Vector2(64, 0)
	right.add_theme_constant_override("separation", 1)
	right.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(right)

	var clock := A6UiKit.label(duration_text, "number", 10)
	clock.add_theme_color_override("font_color", A6UiKit.GOLD)
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	right.add_child(clock)

	var state := A6UiKit.label(state_text, "caption", 9)
	state.name = "State"
	state.add_theme_color_override("font_color", state_colour)
	state.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	state.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	right.add_child(state)
	return button


## The comparison a sentence cannot give: one chip per ingredient showing its own
## icon and `owned/required`, amber when short, plus the fuel it will burn.
func _ingredient_row(inputs: Dictionary, owned: Dictionary, fuel: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = "Ingredients"
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ids: Array = inputs.keys()
	ids.sort()
	for value: Variant in ids:
		var item_id := String(value)
		var needed := int(inputs[value])
		var have := int(owned.get(item_id, 0))
		row.add_child(_amount_chip(item_id, have, needed, have < needed))
	if not fuel.is_empty():
		var fuel_ids: Array = fuel.keys()
		fuel_ids.sort()
		for value: Variant in fuel_ids:
			var item_id := String(value)
			var needed := int(fuel[value])
			var have := int(owned.get(item_id, 0))
			row.add_child(_amount_chip(item_id, have, needed, have < needed))
	return row


func _amount_chip(item_id: String, have: int, needed: int, short: bool) -> HBoxContainer:
	var chip := HBoxContainer.new()
	chip.add_theme_constant_override("separation", 1)
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var picture := A6UiKit.icon(item_id, 9)
	if picture != null:
		chip.add_child(picture)
	var amount := A6UiKit.label("%d/%d" % [have, needed], "number", 9)
	# Ink when the player can pay, amber when short: colour is never the only signal,
	# the two numbers say it as well.
	amount.add_theme_color_override("font_color", A6UiKit.WARN if short else A6UiKit.CREAM)
	chip.add_child(amount)
	chip.tooltip_text = "%s: %d of %d" % [_item_label(item_id), have, needed]
	return chip


## The text its consumers still resolve: the result name, then the exact cost list.
func _button_text(output_id: String, inputs: Dictionary) -> String:
	return "%s — %s" % [_capitalised(output_id), _format_items(inputs)]


func _button_text_for(label: String, inputs: Dictionary, prerequisites: Array) -> String:
	var needs := _format_items(inputs)
	if prerequisites.is_empty():
		return "%s — %s" % [label, needs]
	return "%s — %s — requires %s" % [label, needs, ", ".join(PackedStringArray(prerequisites))]


func _capitalised(item_id: String) -> String:
	var label := _item_label(item_id)
	return label.substr(0, 1).to_upper() + label.substr(1)


## How many jobs this station already holds; the owner's queue capacity decides the rest.
func _queue_used(station: Dictionary, jobs: Dictionary) -> int:
	var station_id := String(station.get("station_id", ""))
	var used := 0
	for job: Variant in jobs.values():
		if String((job as Dictionary).get("station_id", "")) == station_id \
				and String((job as Dictionary).get("status", "")) in ["queued", "running", "paused", "ready", "cancelled"]:
			used += 1
	return used


## Player-facing state, derived only from owner answers: the station's own
## operational flag, its own queue capacity, and the bag totals A0 reports.
func _state_of(operational: bool, queue_full: bool, shortfall: String) -> String:
	if not operational:
		return "station offline"
	if queue_full:
		return "queue full"
	if not shortfall.is_empty():
		return shortfall
	return "all materials"


func _state_colour(operational: bool, queue_full: bool, shortfall: String) -> Color:
	if not operational or queue_full:
		return A6UiKit.WARN
	if not shortfall.is_empty():
		return A6UiKit.FILL_GOOD
	return A6UiKit.CREAM


func _add_running_jobs(jobs: Dictionary) -> void:
	var ids: Array = jobs.keys()
	if ids.is_empty():
		return
	var heading := A6UiKit.label("JOBS", "caption", 9)
	heading.add_theme_color_override("font_color", A6UiKit.INK_SOFT)
	_list.add_child(heading)
	ids.sort()
	for raw_id: Variant in ids:
		var job_id := String(raw_id)
		var job: Dictionary = jobs[raw_id]
		var status := String(job.get("status", ""))
		var ready := status == "ready"
		var row := PanelContainer.new()
		row.name = "Job_%s" % job_id
		# A finished job is worth collecting, so it gets the same authored plate the
		# station headers use; a running one stays quiet so the claimable row reads first.
		if ready:
			row.theme_type_variation = &"A6HudBar"
		_list.add_child(row)

		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 5)
		row.add_child(line)

		var elapsed := int(job.get("elapsed", 0))
		var duration := maxi(1, int(job.get("duration", 1)))
		var bar_parts := A6UiKit.bar(70, 9)
		var bar_root: Control = bar_parts["root"]
		bar_root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.add_child(bar_root)
		A6UiKit.set_bar(bar_parts, float(elapsed), float(duration))

		var status_label := A6UiKit.label(_status_word(status).to_upper(), "caption", 9)
		status_label.name = "Status"
		status_label.add_theme_color_override("font_color", _job_colour(status))
		status_label.custom_minimum_size = Vector2(52, 0)
		line.add_child(status_label)

		var label := A6UiKit.label(
			"%s · %d/%d" % [String(job.get("target", "")).replace("_", " "), elapsed, duration],
			"number", 10
		)
		label.add_theme_color_override("font_color", A6UiKit.INK)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.add_child(label)

		var action := Button.new()
		action.name = "JobAction"
		action.text = "COLLECT" if ready else "CANCEL"
		action.custom_minimum_size = Vector2(0, 17)
		action.add_theme_font_size_override("font_size", 10)
		action.pressed.connect(_job_action.bind(job_id, ready))
		line.add_child(action)


## One colour per owner status so a claimable job cannot be mistaken for a busy one.
func _job_colour(status: String) -> Color:
	match status:
		"ready":
			return A6UiKit.GOLD
		"running":
			return A6UiKit.CREAM
		"paused", "cancelled":
			return A6UiKit.WARN
		_:
			return A6UiKit.INK_SOFT


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
