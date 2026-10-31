extends CanvasLayer
## The workshop: what you can make here, what it costs, and what is already running.
##
## This panel only *asks*: every button calls one session command, and time, stock,
## receipts and recipes stay owned by the A3 session and SaveService. Nothing is
## computed here except which costs you are currently short of, which is read from
## A0's own inventory totals so the row can say "thiếu 2 Đá vụn" before the command is
## refused.
##
## Node names are part of the contract: `Recipe_<recipe>_<station>` and
## `Technology_<tech>_<station>` buttons stay in a ScrollContainer and keep their
## pressed handler, because the runtime tests and the input gate find them by name.
##
## R13 changed how a row *reads*, not what it does. The creator's 1x review found five
## presentation defects in this list, and each one is answered by a structure below:
##
##   every row was the same green button   -> rows are plates; state is a spine, a tag
##                                            and a word, never a shared fill
##   the name, the cost and the clock all   -> name (15u) / cost (13u) / clock (13u) on
##   shouted at the same volume              separate lines, largest first
##   English nouns in a Vietnamese panel    -> A6VietnameseNames supplies the words;
##                                            the catalog label is the fallback
##   the shortfall whispered at the right   -> the shortfall is written first, in the
##                                            cost line, at body size, in warn colour
##   the queue could not be read at a glance-> a queue row states status, progress and
##                                            the single next action
##
## The panel is drawn in one of two directions (A6UiKit.direction()); the layout budget,
## node names and behaviour are identical in both.

## The authored interface space, the same 640x360 the HUD uses.
const VIRTUAL_WIDTH := 640
const VIRTUAL_HEIGHT := 360

const STATION_ICONS := {
	"hand": "knife",
	"workbench": "workbench_kit",
	"furnace": "furnace_kit",
	"research": "research_kit",
	"garden": "garden_kit",
}

var _host: Node
var _root: Control
var _window: PanelContainer
var _list: VBoxContainer
var _notice: Label
var _pack_label: Label
var _title: Label
var _footer: Label


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

	_window = A6UiKit.window()
	_window.name = "Window"
	_window.add_theme_stylebox_override("panel", A6UiKit.window_style())
	# Pinned inside the 640x360 virtual screen rather than centred by offset. With the
	# old KEEP_SIZE preset the column could grow taller than the panel, and the footer
	# line ended up printed on the parchment's bottom border. A fixed rect forces the
	# scroll list - the only flexible child - to absorb the difference instead.
	var screen := Vector2(VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
	var window_size := Vector2(460, minf(324, screen.y - 20))
	_window.size = window_size
	_window.position = ((screen - window_size) * 0.5).round()
	_window.custom_minimum_size = window_size
	_root.add_child(_window)

	var column := VBoxContainer.new()
	column.name = "Column"
	column.add_theme_constant_override("separation", 4)
	_window.add_child(column)

	var header := HBoxContainer.new()
	header.name = "Header"
	header.add_theme_constant_override("separation", 6)
	column.add_child(header)
	# The window's own title: the biggest type on the surface, and the only place the
	# gold is used as a colour rather than as a state.
	_title = A6UiKit.face_label("XƯỞNG CHẾ TÁC", "heading", 18, A6UiKit.accent_colour())
	_title.name = "Title"
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(_title)
	_pack_label = A6UiKit.face_label("", "number", A6UiKit.size_cost(), A6UiKit.text_colour())
	_pack_label.name = "Pack"
	_pack_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(_pack_label)
	var close := Button.new()
	close.name = "Close"
	close.text = "ĐÓNG [C]"
	close.custom_minimum_size = Vector2(0, 22)
	close.add_theme_font_size_override("font_size", A6UiKit.size_caption())
	close.pressed.connect(_close)
	header.add_child(close)

	# One line of orientation, not a second paragraph: at 12 units a folded sentence was
	# the exact text the creator could not read at 1x.
	_notice = A6UiKit.face_label(
		"Đứng gần trạm để chế tạo. Đóng bảng thì việc mới chạy.",
		"caption",
		A6UiKit.size_caption(),
		A6UiKit.quiet_colour(),
	)
	_notice.name = "Notice"
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(_notice)

	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	# The default grey engine bar on parchment reads as a rendering fault at 1x.
	A6UiKit.style_scroll(scroll)
	column.add_child(scroll)
	_list = VBoxContainer.new()
	_list.name = "Jobs"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 3)
	scroll.add_child(_list)

	_footer = A6UiKit.face_label(
		"Việc chỉ tiến triển khi bảng này đóng.",
		"caption",
		A6UiKit.size_caption() - 1,
		A6UiKit.quiet_colour(),
	)
	_footer.name = "Footer"
	column.add_child(_footer)


func configure(host: Node) -> void:
	_host = host


## Re-applies the current visual direction to the chrome this panel built once. Rows
## rebuild themselves on every refresh; the window, the title and the standing lines do
## not, and a capture driver that renders both directions in one process needs them to
## follow the switch instead of staying on the direction that was active at load.
func restyle() -> void:
	if _window == null:
		return
	_window.add_theme_stylebox_override("panel", A6UiKit.window_style())
	var display := A6UiKit.display_face() if A6UiKit.is_board() else A6UiKit.body_face()
	for label: Label in [_title, _pack_label, _notice, _footer]:
		if label == null:
			continue
		if display != null:
			label.add_theme_font_override("font", display)
	_title.add_theme_color_override("font_color", A6UiKit.accent_colour())
	_pack_label.add_theme_color_override("font_color", A6UiKit.text_colour())
	_notice.add_theme_color_override("font_color", A6UiKit.quiet_colour())
	_footer.add_theme_color_override("font_color", A6UiKit.quiet_colour())


## Rebuilds the list from owner answers. Public so a stand-alone capture can redraw a
## panel that was opened before a job was queued.
func refresh() -> void:
	_refresh()


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

## What the player calls this thing. The Vietnamese table answers first; an item it has
## not been taught falls back to the catalog's own English label, and an id with no
## catalog definition at all is shown as the id. Nothing is hidden and nothing invented.
func _display_name(item_id: String) -> String:
	var translated := A6VietnameseNames.item(item_id)
	if not translated.is_empty():
		return translated
	var service := get_node_or_null("/root/SurvivalService")
	if service != null and service.has_method(&"item_definition"):
		var definition: Dictionary = service.call(&"item_definition", item_id)
		var label := String(definition.get("label", ""))
		if not label.is_empty():
			return label
	return item_id.replace("_", " ")


## Item label from the survival catalog, lowercased so cost rows read as prose
## ("3 iron scrap"). Unknown ids fall back to the id itself rather than being hidden.
## A0's research test asserts these exact nouns on technology rows, so this stays the
## catalog's own vocabulary; only recipe rows use the Vietnamese table.
func _item_label(item_id: String) -> String:
	var service := get_node_or_null("/root/SurvivalService")
	if service != null and service.has_method(&"item_definition"):
		var definition: Dictionary = service.call(&"item_definition", item_id)
		var label := String(definition.get("label", ""))
		if not label.is_empty():
			# Cost lines are prose ("2 × oak wood"), so the catalog's title case is
			# folded down; the headline re-capitalises its first letter. A0's research
			# test asserts these exact nouns, so this casing is part of the surface.
			return label.to_lower()
	return item_id.replace("_", " ")


func _format_items(items: Dictionary) -> String:
	var parts: Array[String] = []
	var ids: Array = items.keys()
	ids.sort()
	for key: Variant in ids:
		# Plain count + noun, no multiplication sign: A0's research test asserts these
		# exact substrings ("4 knowledge spares", "3 iron scrap"), so the cost list's
		# shape is part of the surface. The multiplication sign is used only in the
		# shortfall sentence, where a numeral glued to a singular noun was the problem.
		parts.append("%d %s" % [int(items[key]), _item_label(String(key))])
	return ", ".join(parts) if not parts.is_empty() else "không cần gì"


## How many of each item the committed bag holds. A0 owns this; the panel never adds.
##
## The economy session that owns the queue is asked first, because it is the object this
## panel already treats as authoritative for jobs, stations and recipes; if it does not
## publish totals, A0's SaveService is read directly. Both paths are read-only and the
## answer is never cached, so a stale panel cannot disagree with the save.
func _owned_totals() -> Dictionary:
	if _host != null and is_instance_valid(_host) and _host.has_method(&"inventory_totals"):
		return _host.call(&"inventory_totals") as Dictionary
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
			return "thiếu %d × %s" % [short, _display_name(String(key)).to_lower()]
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
	# Queue first. What is already running is why a player opens this panel, and putting
	# it above the catalog means the first thing on the surface is the live state.
	_add_running_jobs(jobs)
	for raw: Variant in stations:
		var station: Dictionary = raw
		_add_station_header(station, jobs)
		_add_recipes(station, owned)
		if String(station.get("kind", "")) == "research":
			_add_technologies(station, owned)


## The two cards whose spacing IS the row pitch. The list starts with a station
## header, which is shorter than a recipe card; measuring from child 0 therefore
## produced the header pitch and trimmed to a height that still sliced a card.
func _refresh_pack() -> void:
	if _pack_label == null:
		return
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"get_inventory_capacity_snapshot"):
		_pack_label.text = "TÚI —"
		return
	var snapshot: Dictionary = save.call(&"get_inventory_capacity_snapshot")
	_pack_label.text = "TÚI %d/%d" % [
		int(snapshot.get("bag_used", 0)), int(snapshot.get("bag_capacity", 0)),
	]


## A station is a heading, not a row: it names the place, how busy its queue is and
## whether it can work at all, on one line, above the plates that belong to it.
func _add_station_header(station: Dictionary, jobs: Dictionary) -> void:
	var kind := String(station.get("kind", ""))
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	var capacity := int(station.get("queue_capacity", 1))
	var used := _queue_used(station, jobs)

	var plate := PanelContainer.new()
	plate.name = "Station_%s" % station_id
	plate.theme_type_variation = &"A6HudBar"
	if A6UiKit.is_board():
		# The ledger keeps the authored wooden bar; only the board draws its own heading
		# plate, because its rows are not parchment either.
		plate.add_theme_stylebox_override("panel", A6UiKit.header_style())
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_list.add_child(plate)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	plate.add_child(row)
	var picture := A6UiKit.icon(String(STATION_ICONS.get(kind, "workbench_kit")), 13)
	if picture != null:
		picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(picture)

	var translated := A6VietnameseNames.station(kind)
	var name_label := A6UiKit.face_label(
		(translated if not translated.is_empty() else kind).to_upper(),
		"heading",
		A6UiKit.size_heading(),
		A6UiKit.CREAM,
	)
	name_label.name = "StationName"
	name_label.add_theme_color_override("font_color", A6UiKit.CREAM if not A6UiKit.is_board() else A6UiKit.GOLD)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(name_label)

	var busy := used >= capacity
	var state := A6UiKit.STATE_OFFLINE if not operational else (A6UiKit.STATE_BUSY if busy else A6UiKit.STATE_CRAFT)
	var capacity_label := A6UiKit.label("%d/%d" % [used, capacity], "number", A6UiKit.size_caption())
	capacity_label.name = "StationQueue"
	capacity_label.add_theme_color_override("font_color", A6UiKit.CREAM)
	capacity_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(capacity_label)
	var word := A6UiKit.label(A6UiKit.state_word(state), "caption", A6UiKit.size_caption() - 1)
	word.add_theme_color_override("font_color", A6UiKit.state_colour(state))
	word.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(word)


# --- recipe rows -------------------------------------------------------------

## One row per recipe, and the control is named by the RECIPE, never by what it makes.
## 23 of the 36 recipes in the real catalog produce an item whose id differs from theirs
## (burn_charcoal -> charcoal, smelt_iron -> iron_ingot), and five output ids are
## produced by several recipes (iron_ingot by smelt_iron and smelt_ore). Naming by output
## merged those into one control and let a click queue the wrong recipe; the output only
## ever decides the icon and the headline.
##
## The visible headline is the Vietnamese name of what the row makes; pressing it still
## queues `recipe.id`.
func _add_recipes(station: Dictionary, owned: Dictionary) -> void:
	var station_id := String(station.get("station_id", ""))
	var operational := bool(station.get("operational", true))
	var used := _queue_used(station, _host.call(&"jobs") as Dictionary)
	var capacity := int(station.get("queue_capacity", 1))
	for value: Variant in (_host.call(&"available_recipes", station_id) as Array):
		var recipe: Dictionary = value
		var inputs: Dictionary = recipe.inputs
		var shortfall := _first_shortfall(inputs, owned)
		var output_id := _first_output_id(recipe)
		var state := _state_key(operational, used >= capacity, shortfall)
		var button := _card_row(
			station_id,
			"Recipe",
			String(recipe.id),
			_display_name(output_id),
			_first_output_icon(recipe),
			inputs,
			owned,
			recipe.fuel,
			"%d giây" % int(recipe.duration_ticks),
			state,
			shortfall,
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
		var state := A6UiKit.STATE_KNOWN if known else _state_key(operational, used >= capacity, shortfall)
		# A technology keeps the catalog's own English name and cost list in its control
		# text: A0's research gate asserts those exact substrings ("4 knowledge spares"),
		# so this row is the one surface R13 deliberately did not translate. The chip
		# line under it is language-neutral, so the comparison itself is still readable.
		var button := _card_row(
			station_id,
			"Technology",
			String(tech.id),
			_button_text_for(String(tech.label), tech.inputs, tech.prerequisites),
			A6UiKit.icon("research_kit", 14),
			tech.inputs,
			owned,
			{},
			"%d giây" % int(tech.duration_ticks),
			state,
			shortfall,
		)
		if button == null:
			continue
		button.disabled = known or not operational
		button.pressed.connect(_research.bind(String(tech.id), station_id))


## Builds one plate and returns its action button. `prefix` and `recipe_or_tech_id`
## form the node name (`Recipe_<recipe_id>_<station_id>` /
## `Technology_<tech_id>_<station_id>`), which callers, the input-gate tests and A0's
## real-input furnace tests resolve by. The id, not the output: the two are different
## for most of the catalog.
func _card_row(
	station_id: String,
	prefix: String,
	recipe_or_tech_id: String,
	text: String,
	icon: TextureRect,
	inputs: Dictionary,
	owned: Dictionary,
	fuel: Dictionary,
	duration_text: String,
	state: String,
	shortfall: String,
) -> Button:
	var card := PanelContainer.new()
	card.name = "Row_%s_%s" % [recipe_or_tech_id, station_id]
	card.add_theme_stylebox_override("panel", A6UiKit.row_style(state))
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	_list.add_child(card)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	row.mouse_filter = Control.MOUSE_FILTER_PASS
	card.add_child(row)

	var frame := A6UiKit.socket()
	frame.custom_minimum_size = Vector2(24, 24)
	frame.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(frame)
	if icon != null:
		frame.add_child(icon)

	var middle := VBoxContainer.new()
	middle.name = "Body"
	middle.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	middle.add_theme_constant_override("separation", 0)
	middle.mouse_filter = Control.MOUSE_FILTER_PASS
	row.add_child(middle)

	# The name is the control. It is the row's headline, it is the biggest text on the
	# plate, and it is what a click queues - so the surface a player reads is the surface
	# a player presses, with no hidden overlay between the two.
	var button := Button.new()
	button.name = "%s_%s_%s" % [prefix, recipe_or_tech_id, station_id]
	button.text = text
	button.flat = true
	button.clip_text = false
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.custom_minimum_size = Vector2(0, A6UiKit.size_name() + 5)
	button.add_theme_font_size_override("font_size", A6UiKit.size_name())
	var face := A6UiKit.display_face() if A6UiKit.is_board() else A6UiKit.body_face()
	if face != null:
		button.add_theme_font_override("font", face)
	button.add_theme_color_override("font_color", A6UiKit.text_colour())
	button.add_theme_color_override("font_hover_color", A6UiKit.accent_colour())
	button.add_theme_color_override("font_focus_color", A6UiKit.accent_colour())
	button.add_theme_color_override("font_pressed_color", A6UiKit.accent_colour())
	button.add_theme_color_override("font_disabled_color", A6UiKit.quiet_colour())
	# The plate already carries the surface: the control only marks hover and focus, so
	# a list of rows is not a list of identical green buttons.
	button.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	button.add_theme_stylebox_override("hover", StyleBoxEmpty.new())
	button.add_theme_stylebox_override("pressed", StyleBoxEmpty.new())
	button.add_theme_stylebox_override("disabled", StyleBoxEmpty.new())
	var focus_box := StyleBoxFlat.new()
	focus_box.bg_color = Color(0, 0, 0, 0)
	focus_box.border_width_left = 1
	focus_box.border_width_right = 1
	focus_box.border_width_top = 1
	focus_box.border_width_bottom = 1
	focus_box.border_color = A6UiKit.accent_colour()
	button.add_theme_stylebox_override("focus", focus_box)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	middle.add_child(button)

	middle.add_child(_ingredient_row(inputs, owned, fuel, shortfall))

	var right := VBoxContainer.new()
	right.name = "Timing"
	right.custom_minimum_size = Vector2(62, 0)
	right.add_theme_constant_override("separation", 1)
	right.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(right)

	var clock := A6UiKit.face_label(duration_text, "number", A6UiKit.size_cost(), A6UiKit.accent_colour())
	clock.name = "Clock"
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	right.add_child(clock)

	# The verdict, stated once: a filled plate in the board direction, a coloured word in
	# the ledger. Both carry the same word, so colour is never the only signal.
	var state_word := A6UiKit.state_word(state)
	if A6UiKit.is_board() and state != A6UiKit.STATE_KNOWN:
		var tag := PanelContainer.new()
		tag.name = "State"
		tag.add_theme_stylebox_override("panel", A6UiKit.tag_style(state))
		tag.size_flags_horizontal = Control.SIZE_SHRINK_END
		tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
		right.add_child(tag)
		var tag_label := A6UiKit.label(state_word, "caption", A6UiKit.size_caption() - 1)
		tag_label.add_theme_color_override("font_color", A6UiKit.on_state_colour())
		tag_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tag.add_child(tag_label)
	else:
		var state_label := A6UiKit.face_label(state_word, "caption", A6UiKit.size_caption() - 1, A6UiKit.state_colour(state))
		state_label.name = "State"
		state_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		right.add_child(state_label)
	return button


## The comparison a sentence cannot give: one chip per ingredient showing its own icon
## and `owned/required`, amber when short - and, when something is short, the plain
## sentence first, on the left, at body size.
func _ingredient_row(inputs: Dictionary, owned: Dictionary, fuel: Dictionary, shortfall: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = "Ingredients"
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if not shortfall.is_empty():
		var warning := A6UiKit.face_label(shortfall, "caption", A6UiKit.size_cost() - 1, A6UiKit.WARN)
		warning.name = "Shortfall"
		warning.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(warning)
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
	var picture := A6UiKit.icon(item_id, A6UiKit.size_cost() - 1)
	if picture != null:
		picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		chip.add_child(picture)
	# One number, and it is the requirement: the row is a shopping list, so "2" means
	# "this costs two". What the bag holds is the colour (ink: covered, amber: short) and
	# the shortfall sentence; a bare "4/2" made the player work out which number was which.
	var amount := A6UiKit.face_label("%d" % needed, "number", A6UiKit.size_cost(), A6UiKit.text_colour())
	if short:
		amount.add_theme_color_override("font_color", A6UiKit.WARN)
	# Ink when the player can pay, warn when short: colour is never the only signal, the
	# two numbers say it as well.
	chip.add_child(amount)
	chip.tooltip_text = "%s: %d of %d" % [_display_name(item_id), have, needed]
	return chip


func _button_text_for(label: String, inputs: Dictionary, prerequisites: Array) -> String:
	var needs := _format_items(inputs)
	if prerequisites.is_empty():
		return "%s — %s" % [label, needs]
	return "%s — %s — requires %s" % [label, needs, ", ".join(PackedStringArray(prerequisites))]


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
func _state_key(operational: bool, _queue_full: bool, shortfall: String) -> String:
	# The row answers "can I make this?", not "is the station free?": a full queue is the
	# station's own fact and the header states it once. Repeating it on every row covered
	# the payability answer, which is what a row is for.
	if not operational:
		return A6UiKit.STATE_OFFLINE
	if not shortfall.is_empty():
		return A6UiKit.STATE_SHORT
	return A6UiKit.STATE_CRAFT


# --- queue rows --------------------------------------------------------------

## A queue row answers three questions in order: what is running, how far along it is,
## and what the player can do about it. It used to answer none of them without reading
## a status token.
func _add_running_jobs(jobs: Dictionary) -> void:
	var ids: Array = jobs.keys()
	if ids.is_empty():
		return
	var heading := A6UiKit.face_label("ĐANG CHẾ", "caption", A6UiKit.size_caption(), A6UiKit.accent_colour())
	_list.add_child(heading)
	ids.sort()
	for raw_id: Variant in ids:
		var job_id := String(raw_id)
		var job: Dictionary = jobs[raw_id]
		var status := String(job.get("status", ""))
		var ready := status == "ready"
		var target := String(job.get("target", ""))
		var elapsed := int(job.get("elapsed", 0))
		var duration := maxi(1, int(job.get("duration", 1)))
		var remaining := maxi(0, duration - elapsed)

		var row := PanelContainer.new()
		row.name = "Job_%s" % job_id
		row.add_theme_stylebox_override(
			"panel",
			A6UiKit.row_style(A6UiKit.STATE_DONE if ready else A6UiKit.STATE_BUSY),
		)
		_list.add_child(row)

		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 5)
		row.add_child(line)

		# The icon is the thing being made, not the recipe id.
		var product := A6VietnameseNames.recipe_product(target) if String(job.get("kind", "craft")) == "craft" else target
		var picture := A6UiKit.icon(product if not product.is_empty() else target, 18)
		if picture != null:
			picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			line.add_child(picture)

		var column := VBoxContainer.new()
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_theme_constant_override("separation", 1)
		line.add_child(column)

		var name_label := A6UiKit.face_label(
			_job_name(job),
			"body",
			A6UiKit.size_name() - 1,
			A6UiKit.text_colour(),
		)
		name_label.name = "Target"
		column.add_child(name_label)

		var progress := HBoxContainer.new()
		progress.add_theme_constant_override("separation", 4)
		column.add_child(progress)
		var bar_parts := A6UiKit.bar(88, 9)
		var bar_root: Control = bar_parts["root"]
		bar_root.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		bar_root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		progress.add_child(bar_root)
		A6UiKit.set_bar(bar_parts, float(elapsed), float(duration))
		var count := A6UiKit.face_label("%d/%d" % [elapsed, duration], "number", A6UiKit.size_cost() - 1, A6UiKit.text_colour())
		count.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		progress.add_child(count)

		var status_label := A6UiKit.face_label(
			_status_word(status).to_upper(),
			"caption",
			A6UiKit.size_caption() - 1,
			A6UiKit.state_colour(A6UiKit.STATE_DONE if ready else A6UiKit.STATE_BUSY),
		)
		status_label.name = "Status"
		status_label.custom_minimum_size = Vector2(54, 0)
		status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		status_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.add_child(status_label)

		var action := Button.new()
		action.name = "JobAction"
		action.text = "LẤY" if ready else "HUỶ"
		action.custom_minimum_size = Vector2(44, 22)
		action.add_theme_font_size_override("font_size", A6UiKit.size_caption())
		if ready:
			# The one thing worth collecting is the only thing on the surface that looks
			# collectable: a gold plate with dark ink, at the end of the row.
			action.add_theme_stylebox_override("normal", A6UiKit.tag_style(A6UiKit.STATE_DONE))
			action.add_theme_stylebox_override("hover", A6UiKit.tag_style(A6UiKit.STATE_DONE))
			action.add_theme_stylebox_override("pressed", A6UiKit.tag_style(A6UiKit.STATE_DONE))
			action.add_theme_color_override("font_color", A6UiKit.on_state_colour())
			action.add_theme_color_override("font_hover_color", A6UiKit.on_state_colour())
		action.pressed.connect(_job_action.bind(job_id, ready))
		line.add_child(action)


## Player words for the session's own status strings. Unknown statuses are shown
## verbatim rather than smoothed into something the owner did not say.
func _status_word(status: String) -> String:
	var translated := A6VietnameseNames.job_status(status)
	return translated if not translated.is_empty() else status


## What to call a queued job. A craft job carries the recipe id it was placed from, so
## the row names the product through the catalog's own output table; anything else (a
## research job, a status this build does not know) is shown as words rather than as an
## identifier with underscores in it.
func _job_name(job: Dictionary) -> String:
	var target := String(job.get("target", ""))
	if String(job.get("kind", "craft")) == "craft":
		var product := A6VietnameseNames.recipe_product(target)
		if not product.is_empty():
			return _display_name(product)
	var translated := A6VietnameseNames.item(target)
	return translated if not translated.is_empty() else target.replace("_", " ")


func _first_output_id(recipe: Dictionary) -> String:
	var outputs: Dictionary = recipe.get("outputs", {})
	for key: Variant in outputs.keys():
		return String(key)
	return String(recipe.get("id", ""))


func _first_output_icon(recipe: Dictionary) -> TextureRect:
	return A6UiKit.icon(_first_output_id(recipe), 16)


# --- commands ---------------------------------------------------------------

func _queue(recipe: String, station: String) -> void:
	var result: Dictionary = _host.call(&"queue_recipe", recipe, station)
	if bool(result.get("ok", false)):
		_notify("Đã xếp vào hàng đợi. Đóng bảng để công việc chạy.", A6UiKit.quiet_colour())
	else:
		_notify("Không xếp được: %s" % _refusal(result), A6UiKit.WARN)
	_refresh()


func _research(technology: String, station: String) -> void:
	var result: Dictionary = _host.call(&"queue_technology", technology, station)
	if bool(result.get("ok", false)):
		_notify("Đã bắt đầu nghiên cứu. Đóng bảng để công việc chạy.", A6UiKit.quiet_colour())
	else:
		_notify("Không nghiên cứu được: %s" % _refusal(result), A6UiKit.WARN)
	_refresh()


func _job_action(job: String, collect_item: bool) -> void:
	var result: Dictionary = _host.call(&"collect" if collect_item else &"cancel", job)
	if bool(result.get("ok", false)):
		_notify("Đã lấy thành phẩm." if collect_item else "Đã huỷ công việc.", A6UiKit.quiet_colour())
	else:
		_notify("Không xong được: %s" % _refusal(result), A6UiKit.WARN)
	_refresh()


## Writes the one line the panel is allowed to say about an action, and attaches the
## A6-neutral reason as a tooltip so a player who wants to know can hover, while a
## player who does not is not handed an owner status code (D052).
func _notify(text: String, colour: Color) -> void:
	_notice.text = text
	_notice.add_theme_color_override("font_color", colour)


## Turns an A3 refusal code into a sentence a player can act on. Unknown codes are
## never printed raw - they fall back to a neutral sentence rather than leaking a
## source token into release UI.
func _refusal(result: Dictionary) -> String:
	var reason := String(result.get("reason", "")).strip_edges().to_lower()
	match reason:
		"missing_inputs", "insufficient_items", "not_enough_inputs":
			return "thiếu nguyên liệu"
		"queue_full":
			return "hàng đợi đã đầy"
		"station_offline", "station_unavailable":
			return "trạm đang ngưng chạy"
		"research_pending":
			return "đang nghiên cứu rồi"
		"already_known":
			return "đã biết rồi"
		"out_of_range", "too_far":
			return "ở quá xa trạm"
		"unknown_recipe":
			return "không có công thức này"
		_:
			return "chưa đủ điều kiện"
