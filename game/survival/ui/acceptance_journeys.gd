extends Control
## A6-only, fixture-labeled product journeys. This screen is a read-only projection;
## local selections change the explanation, never owner state or gameplay.

signal closed
signal modal_state_changed(active: bool)
signal journal_requested
signal desk_requested

const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
const PIXEL_PANEL := preload("res://game/survival/ui/pixel_panel.gd")
const INK := Color("111923")
const PANEL := Color("30231f")
const EDGE := Color("b77b4e")
const PAPER := Color("f6e8c9")
const MUTED := Color("b8c4b2")
const MINT := Color("91d6ac")
const GOLD := Color("f4c778")
const WARNING := Color("ff9278")

var show_workspace_navigation := false
var _fixture: Dictionary = {}
var _journey := 0
var _step := 0
var _route_choice := "safe"
var _core_choice := "store"
var _sacrifice_preview_confirmed := false
var _modal_reported := false
var _previous_focus: Control
var _journey_tabs: Array[Button] = []
var _step_buttons: Array[Button] = []
var _choice_buttons: Array[Button] = []
var _left: VBoxContainer
var _right: VBoxContainer
var _status: Label

const JOURNEYS := [
	{
		"short": "A  SURVIVOR",
		"title": "FIRST NIGHT · MAKE A HOME",
		"steps": ["Find a source", "Read the bed cost", "Validate a bed", "Death & recovery"]
	},
	{
		"short": "B  RARE CORE",
		"title": "ONE SPECIMEN · TWO FUTURES",
		"steps":
		[
			"Identify the instance",
			"Use, store or research",
			"Confirm sacrifice",
			"Formula & production"
		]
	},
	{
		"short": "C  EXPEDITION",
		"title": "CROWN ROAD · CHOOSE YOUR RISK",
		"steps":
		["Prepare the safe road", "Read known clues", "Compare the shortcut", "Return & progress"]
	},
]


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()
	_render()
	tree_exiting.connect(func(): _sync_modal_state(true))


func set_fixture(snapshot: Dictionary) -> bool:
	if snapshot.get("schema", "") != "soh.ui.journey.fixture.v1":
		return false
	var refs: Variant = snapshot.get("source_refs", null)
	if (
		not refs is Dictionary
		or String(refs.get("a0", "")) != "aaee29339aca7e953af1b96d5bcc06b0fb7527bc"
		or String(refs.get("a1", "")) != "2cb1a3c5f093724eb9fecbdf45909ccb611f7b32"
		or String(refs.get("a3", "")) != "18e7afcbd576bbd9bfbcc509b2ee13216186a522"
	):
		return false
	if (
		not snapshot.get("a0", null) is Dictionary
		or not snapshot.get("a1", null) is Dictionary
		or not snapshot.get("a3", null) is Dictionary
	):
		return false
	_fixture = snapshot.duplicate(true)
	_sacrifice_preview_confirmed = false
	if is_inside_tree():
		_render()
	return true


func open_journeys() -> void:
	if visible:
		return
	_previous_focus = get_viewport().gui_get_focus_owner()
	visible = true
	_sync_modal_state()
	if not _journey_tabs.is_empty():
		_journey_tabs[_journey].grab_focus()


func close_journeys() -> void:
	if not visible:
		return
	visible = false
	_sync_modal_state()
	if is_instance_valid(_previous_focus) and _previous_focus.is_visible_in_tree():
		_previous_focus.grab_focus()
	closed.emit()


func is_modal_active() -> bool:
	_sync_modal_state()
	return _modal_reported


func _process(_delta: float) -> void:
	_sync_modal_state()


func _sync_modal_state(force_closed := false) -> void:
	var active := not force_closed and is_visible_in_tree()
	if active == _modal_reported:
		return
	_modal_reported = active
	modal_state_changed.emit(active)


func _unhandled_input(event: InputEvent) -> void:
	if (
		visible
		and not event.is_echo()
		and (
			event.is_action_pressed(&"pause")
			or event.is_action_pressed(&"ui_cancel")
			or (event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE)
		)
	):
		close_journeys()
		get_viewport().set_input_as_handled()


func select_journey(index: int) -> void:
	_journey = clampi(index, 0, JOURNEYS.size() - 1)
	_step = 0
	_sacrifice_preview_confirmed = false
	if visible and not _journey_tabs.is_empty():
		_journey_tabs[_journey].grab_focus()
	_render()


func select_step(index: int) -> void:
	_step = clampi(index, 0, JOURNEYS[_journey].steps.size() - 1)
	_sacrifice_preview_confirmed = false
	_render()


func select_core_choice(choice: String) -> void:
	if not choice in ["use", "store", "research"]:
		return
	_core_choice = choice
	_sacrifice_preview_confirmed = false
	_render()


func select_route(choice: String) -> void:
	if not choice in ["safe", "shortcut"]:
		return
	_route_choice = choice
	_render()


func confirm_sacrifice_preview() -> void:
	if _journey != 1 or _step != 2 or _core_choice != "research":
		return
	_sacrifice_preview_confirmed = true
	_render()


func current_projection() -> Dictionary:
	return {
		"journey": _journey,
		"step": _step,
		"core_choice": _core_choice,
		"route_choice": _route_choice,
		"sacrifice_preview_confirmed": _sacrifice_preview_confirmed
	}


func _build() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0.035, 0.05, 0.075, 0.86)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["margin_left", "margin_right"]:
		margin.add_theme_constant_override(side, 20)
	for side: String in ["margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 14)
	add_child(margin)
	var frame := _panel(PANEL, EDGE)
	margin.add_child(frame)
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 5)
	frame.add_child(root)
	var header := HBoxContainer.new()
	root.add_child(header)
	var title := _label("✦  FIELDNOTES / A6 ACCEPTANCE", 15, PAPER, true)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var satchel := _button("SATCHEL")
	satchel.visible = show_workspace_navigation
	satchel.custom_minimum_size.x = 58
	satchel.pressed.connect(func(): journal_requested.emit())
	header.add_child(satchel)
	var desk := _button("DESK")
	desk.visible = show_workspace_navigation
	desk.custom_minimum_size.x = 46
	desk.pressed.connect(func(): desk_requested.emit())
	header.add_child(desk)
	var close := _button("ESC  CLOSE")
	close.custom_minimum_size.x = 76
	close.pressed.connect(close_journeys)
	header.add_child(close)
	_status = _label("A6 READ-ONLY SCENARIO FIXTURE · NOT LIVE GAMEPLAY", 8, WARNING)
	root.add_child(_status)
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 5)
	root.add_child(tabs)
	for index in JOURNEYS.size():
		var tab := _button(JOURNEYS[index].short)
		tab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tab.pressed.connect(select_journey.bind(index))
		tabs.add_child(tab)
		_journey_tabs.append(tab)
	for index in _journey_tabs.size():
		_journey_tabs[index].focus_neighbor_left = _journey_tabs[index].get_path_to(
			_journey_tabs[(index + _journey_tabs.size() - 1) % _journey_tabs.size()]
		)
		_journey_tabs[index].focus_neighbor_right = _journey_tabs[index].get_path_to(
			_journey_tabs[(index + 1) % _journey_tabs.size()]
		)
	var columns := HBoxContainer.new()
	columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	columns.add_theme_constant_override("separation", 8)
	root.add_child(columns)
	_left = _column(columns, 0.82)
	_right = _column(columns, 1.18)
	(
		root
		. add_child(
			_label(
				"TAB / ARROWS  navigate    ENTER / A  select    ESC / B  return · no action below mutates owner state",
				8,
				MUTED
			)
		)
	)


func _column(parent: Node, ratio: float) -> VBoxContainer:
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_stretch_ratio = ratio
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var panel := _panel(INK, EDGE)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(panel)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 4)
	panel.add_child(body)
	parent.add_child(scroll)
	return body


func _render() -> void:
	if _left == null or _right == null:
		return
	for child in _left.get_children():
		child.queue_free()
	for child in _right.get_children():
		child.queue_free()
	_step_buttons.clear()
	_choice_buttons.clear()
	for index in _journey_tabs.size():
		_journey_tabs[index].text = (
			("◆ " if index == _journey else "◇ ") + String(JOURNEYS[index].short)
		)
	var title_text := String(JOURNEYS[_journey].title)
	_left.add_child(_label(title_text, 12, GOLD, true))
	_left.add_child(_label("STORYBOARD · CLICK OR FOCUS A STEP", 8, MUTED))
	for index in JOURNEYS[_journey].steps.size():
		var step := _button("%02d  %s" % [index + 1, JOURNEYS[_journey].steps[index]])
		step.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		step.custom_minimum_size.y = 31
		step.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		step.pressed.connect(select_step.bind(index))
		_step_buttons.append(step)
		_left.add_child(step)
	for index in _step_buttons.size():
		_step_buttons[index].focus_neighbor_top = _step_buttons[index].get_path_to(
			_step_buttons[maxi(0, index - 1)]
		)
		_step_buttons[index].focus_neighbor_bottom = _step_buttons[index].get_path_to(
			_step_buttons[mini(_step_buttons.size() - 1, index + 1)]
		)
		_step_buttons[index].add_theme_stylebox_override(
			"normal",
			PIXEL_UI.panel_style(
				Color("1b252b") if index == _step else INK, GOLD if index == _step else EDGE, 1
			)
		)
		_step_buttons[index].add_theme_color_override(
			"font_color", GOLD if index == _step else PAPER
		)
	var continuity := [
		"PERMANENT HOME · OPTIONAL OUTING",
		"FINITE PHYSICAL CORE · PERMANENT KNOWLEDGE",
		"HOME PERSISTS · EXPEDITION IS OPTIONAL",
	][_journey]
	_left.add_child(_label(continuity, 8, GOLD))
	_left.add_child(
		_label("Fixture progress only · no save, inventory, world or combat writes", 8, MUTED)
	)
	_right.add_child(_label("OWNER DATA  /  CURRENT CONSEQUENCE", 9, MINT, true))
	_right.add_child(_label(_detail_text(), 10, PAPER))
	for text in _choice_labels():
		var choice := _button(text)
		choice.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice.custom_minimum_size.y = 26
		choice.pressed.connect(_handle_choice.bind(text))
		_choice_buttons.append(choice)
		_right.add_child(choice)
	var state_text := _status_text()
	var state_color := (
		WARNING
		if (
			state_text.contains("BLOCKED")
			or state_text.contains("not")
			or state_text.contains("No ")
		)
		else MUTED
	)
	var state_card := _panel(Color("241f20"), WARNING if state_color == WARNING else EDGE)
	var state_box := VBoxContainer.new()
	state_box.add_child(_label("AUTHORITY / NEGATIVE STATE", 9, WARNING, true))
	state_box.add_child(_label(state_text, 9, PAPER))
	state_card.add_child(state_box)
	_right.add_child(state_card)


func _detail_text() -> String:
	if _fixture.is_empty():
		return "Pinned owner source inputs were not provided."
	match _journey:
		0:
			return _survivor_detail()
		1:
			return _core_detail()
		_:
			return _expedition_detail()


func _survivor_detail() -> String:
	var a0: Dictionary = _fixture.a0
	if _step == 0:
		var source: Dictionary = a0.scrap_source
		var item: Dictionary = a0.scrap_item
		return (
			"%s → %s  (%s)\nPer hit: %d · hits: %d · authored restock: %d sec\n\nA0 catalog: %s\nCounts are catalog values; this fixture does not confirm a spawned node, a gathered item, or player discovery."
			% [
				String(source.get("label", "Unknown source")),
				String(item.get("label", "Unknown item")),
				String(source.get("item", "unknown")),
				int(source.get("per_hit", 0)),
				int(source.get("hits", 0)),
				int(source.get("respawn_seconds", 0)),
				String(a0.get("catalog_status", "Unknown"))
			]
		)
	if _step == 1:
		var bed: Dictionary = a0.bed_piece
		var cost: Dictionary = bed.get("cost", {})
		var inventory: Dictionary = a0.fixture_inventory
		return (
			"%s · A0 piece id: bed_wood\nCost: %d Oak Wood + %d Iron Scrap\nFixture satchel: %d / %d Oak Wood · %d / %d Iron Scrap\n\nMissing in this fixture: %d Oak Wood + %d Iron Scrap. The panel explains a meaningful shortfall; it grants nothing."
			% [
				String(bed.get("label", "Wooden Bed")),
				int(cost.get("oak_wood", 0)),
				int(cost.get("iron_scrap", 0)),
				int(inventory.get("oak_wood", 0)),
				int(cost.get("oak_wood", 0)),
				int(inventory.get("iron_scrap", 0)),
				int(cost.get("iron_scrap", 0)),
				maxi(0, int(cost.get("oak_wood", 0)) - int(inventory.get("oak_wood", 0))),
				maxi(0, int(cost.get("iron_scrap", 0)) - int(inventory.get("iron_scrap", 0)))
			]
		)
	if _step == 2:
		var bed_state: Dictionary = a0.fixture_bed
		return (
			"Fixture bed: %s · %s\nA0 validator: placed bed identity → enclosed room → clear wake cell → safe exit; activation rechecks identity and commits through SaveService.\n\nThis fixture marks the bed valid only to complete the storyboard. A6 did not pay, place, validate or activate it."
			% [
				String(bed_state.get("entity_id", "unknown")),
				String(bed_state.get("status", "unknown"))
			]
		)
	var death: Dictionary = a0.fixture_death
	return (
		"pending_death: %s\nspawn_anchor: %s\nDeath bag: %s · stacks: %d\n\n%s\nA0 keeps physical soh_i_* tokens out of the death bag until unique-item ownership is integrated; recovery is all-or-none and a full inventory leaves the bag intact."
		% [
			String(death.get("pending_death", "")),
			String(death.get("spawn_anchor", "")),
			String(death.get("bag", {}).get("entity_id", "")),
			death.get("bag", {}).get("stacks", {}).size(),
			String(death.get("recovery_status", "Unknown"))
		]
	)


func _core_detail() -> String:
	if _fixture.is_empty():
		return "A3 source input missing."
	var a3: Dictionary = _fixture.a3
	var item: Dictionary = a3.core_item
	var instance: Dictionary = a3.core_instance
	if _step == 0:
		return (
			"%s · %s\n%s\nUses: %d / %d · Condition: %d / %d\nLocation: %s · revision %d\n\nA3 catalog readiness: %s. A4 Gold/skill attestation is not verified, so a cast is not offered. A formula is not implied by owning this physical token."
			% [
				String(item.get("label", "Core")),
				String(instance.get("instance_id", "")),
				String(instance.get("item_id", "")),
				int(instance.get("uses", 0)),
				int(instance.get("max_uses", 0)),
				int(instance.get("condition", 0)),
				int(instance.get("max_condition", 0)),
				String(instance.get("location", "Unknown")),
				int(instance.get("revision", 0)),
				String(a3.get("readiness", "Unknown"))
			]
		)
	if _step == 1:
		var choice := _core_choice.capitalize()
		var consequence := ""
		match _core_choice:
			"use":
				consequence = "Would spend finite uses only after A4 attestation and an owner-committed cast. Readiness is blocked; no cast can run here."
			"store":
				consequence = "Keeps this exact instance id, uses, condition and revision together. Storage authority still belongs to A3/A0."
			_:
				consequence = "Research reserves this exact instance. If the A3 research job completes, the specimen is consumed and recipe knowledge becomes permanent; cancellation must return escrow under A3's owner contract."
		return (
			"Selected preview: %s\n\n%s\n\nThe user selects a consequence, not a transaction. The fixture keeps the specimen present and the profile formula state unchanged."
			% [choice, consequence]
		)
	if _step == 2:
		var confirmed := (
			"PREVIEW CONFIRMED — NO REQUEST SENT"
			if _sacrifice_preview_confirmed
			else "CONFIRMATION REQUIRED BEFORE ANY OWNER REQUEST"
		)
		var research_station: Dictionary = a3.research_station
		return (
			"IRREVERSIBLE ON SUCCESSFUL RESEARCH COMPLETION\nExact specimen: %s\nMethod: specimen · target: craft_core_ember\nCost: 5 knowledge_spares · %s T%d · queue %d · 40 active ticks\nStation contract: %s\n\n%s\nThe job first escrows the Core; completion marks its instance consumed_by_research and learns the recipe. A6 cannot submit or simulate that owner transaction."
			% [
				String(instance.get("instance_id", "")),
				String(research_station.get("label", "Research")),
				int(research_station.get("tier", 0)),
				int(research_station.get("queue_capacity", 0)),
				String(a3.get("stations_status", "Unknown")),
				confirmed
			]
		)
	var recipe: Dictionary = a3.craft_recipe
	var inputs: Dictionary = recipe.get("inputs", {})
	var input_ids: Array = inputs.keys()
	input_ids.sort()
	var input_lines: Array[String] = []
	for input_id: Variant in input_ids:
		input_lines.append("%s × %d" % [String(input_id), int(inputs[input_id])])
	var station: Dictionary = a3.workbench_tier_2
	return (
		"If recipe knowledge is owner-confirmed permanent, craft %s:\n%s\n\n%s T%d · %d active ticks · requires %s.\n\nCurrent fixture formula: %s · queue: %s. No A3 service, station snapshot or A0 active-time host is mounted; enqueue stays disabled. Catalog balance is %s."
		% [
			String(recipe.get("id", "craft_core_ember")),
			"\n".join(input_lines),
			String(station.get("label", "Workbench")),
			int(recipe.get("min_tier", 0)),
			int(recipe.get("duration_ticks", 0)),
			", ".join(recipe.get("required_technologies", [])),
			(
				"not learned"
				if not bool(a3.get("fixture_formula_learned", false))
				else "learned (fixture)"
			),
			"empty" if a3.get("fixture_queue", []).is_empty() else "fixture queue",
			String(recipe.get("balance_status", "Unknown"))
		]
	)


func _expedition_detail() -> String:
	if _fixture.is_empty():
		return "A1 source input missing."
	var a1: Dictionary = _fixture.a1
	var discovery: Dictionary = a1.discovery_fixture
	var way: Dictionary = a1.waystation
	var relay: Dictionary = a1.relay
	var safe: Dictionary = a1.safe_route
	var shortcut: Dictionary = a1.shortcut
	if _step == 0:
		var selected: Dictionary = safe if _route_choice == "safe" else shortcut
		return (
			"Selected route: %s · risk %s\nRequired capabilities: %s\nMode: %s · kind: %s\n\nA1 route records are authored, not native movement. Safe approach is low-risk with no capability requirement. The alternative is labeled high-risk by A1; no damage probability is invented."
			% [
				String(selected.get("route_id", "")),
				String(selected.get("risk", "Unknown")),
				(
					", ".join(selected.get("required_capabilities", []))
					if not selected.get("required_capabilities", []).is_empty()
					else "none"
				),
				String(selected.get("mode", "foot")),
				String(selected.get("kind", "trunk"))
			]
		)
	if _step == 1:
		var known: Array[String] = []
		if bool(discovery.get("waystation", false)):
			known.append("Ashen Waystation: " + String(way.access_stages[0].get("note", "")))
		if bool(discovery.get("relay", false)):
			known.append("Crown Relay Shed: " + String(relay.access_stages[0].get("note", "")))
		if bool(discovery.get("waystation", false)) and bool(discovery.get("relay", false)):
			return (
				"Fixture-discovered clues only:\n%s\n\nWaystation: %s · %s\nRelay: %s · %s\n\nA1 says these authored safe courts have a retreat and no hazard exposure. Known hazard ids in this scenario: %s. This does not mean the full world is hazard-free."
				% [
					"\n".join(known),
					String(way.content_readiness),
					String(way.status),
					String(relay.content_readiness),
					String(relay.status),
					(
						", ".join(discovery.get("known_hazard_ids", []))
						if not discovery.get("known_hazard_ids", []).is_empty()
						else "none disclosed"
					)
				]
			)
		return (
			"Fixture-discovered clues only:\n%s\n\nNext POI: not discovered — name, clue, materials, hazards and capabilities withheld.\n\nKnown hazard ids in this scenario: %s. A1 authored records are not runtime discovery."
			% [
				"\n".join(known) if not known.is_empty() else "No POI clue disclosed.",
				(
					", ".join(discovery.get("known_hazard_ids", []))
					if not discovery.get("known_hazard_ids", []).is_empty()
					else "none disclosed"
				)
			]
		)
	if _step == 2:
		return (
			"SAFE: %s · risk %s · capability gate: none\nSHORTCUT: %s · risk %s · requires %s\n\nThe shortcut's danger is an A1 risk label, not measured damage. If %s is absent, choose preparation/retreat; no invisible-wall or forced encounter is asserted. Undiscovered hazard records remain hidden (%d authored hazard contracts exist)."
			% [
				String(safe.get("route_id", "")),
				String(safe.get("risk", "")),
				String(shortcut.get("route_id", "")),
				String(shortcut.get("risk", "")),
				", ".join(shortcut.get("required_capabilities", [])),
				", ".join(shortcut.get("required_capabilities", [])),
				int(a1.get("hazard_contract_count", 0))
			]
		)
	return "Return route and progression are not simulated. A1 authored a road, POIs and static clues; A0 must report runtime discovery/return state. No loot, POI interaction, capability grant or progression flag is produced by this presentation."


func _choice_labels() -> Array[String]:
	if _journey == 1 and _step == 1:
		return [
			"PREVIEW · USE FINITE CORE", "PREVIEW · STORE INSTANCE", "PREVIEW · RESEARCH SPECIMEN"
		]
	if _journey == 1 and _step == 2 and _core_choice == "research":
		return ["CONFIRM SACRIFICE PREVIEW · NO REQUEST", "CANCEL / KEEP SPECIMEN"]
	if _journey == 2 and _step == 0:
		return ["FOLLOW LOW-RISK ROAD", "COMPARE HIGH-RISK SHORTCUT"]
	return []


func _handle_choice(text: String) -> void:
	if text.contains("USE FINITE"):
		select_core_choice("use")
	elif text.contains("STORE INSTANCE"):
		select_core_choice("store")
	elif text.contains("RESEARCH SPECIMEN"):
		select_core_choice("research")
		select_step(2)
	elif text.contains("CONFIRM SACRIFICE"):
		confirm_sacrifice_preview()
	elif text.contains("CANCEL"):
		select_core_choice("store")
	elif text.contains("LOW-RISK"):
		select_route("safe")
	elif text.contains("HIGH-RISK"):
		select_route("shortcut")


func _status_text() -> String:
	if _fixture.is_empty():
		return "BLOCKED · owner inputs missing"
	match _journey:
		0:
			if _step == 1:
				return "Fixture satchel is short; no auto-craft or payment."
			if _step == 2:
				return "Fixture-only valid bed; no A0 placement transaction."
			if _step == 3:
				return String(_fixture.a0.fixture_death.respawn_status)
			return "Source contract shown; world discovery remains A0-owned."
		1:
			if _step == 0:
				return "Exact instance visible; A4 cast readiness BLOCKED_PENDING_A4."
			if _step == 1 and _core_choice == "research":
				return "Sacrifice path selected; no owner request has been sent."
			if _step == 2:
				return "Confirmation is explicit; A3 result remains uncommitted."
			if _step == 3:
				return "BLOCKED · no A3 queue / A0 active-time host snapshot."
			return "Choice consequences only; physical Core and permanent knowledge stay distinct."
		_:
			if _step == 2 and _route_choice == "shortcut":
				return "PREPARATION REQUIRED · cap_filter gate; damage unknown."
			if _step == 3:
				return "Return/discovery progression not integrated."
			return "A1 authored records; discovery state is scenario fixture only."


func _label(text: String, size := 10, color := PAPER, heading := false) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	PIXEL_UI.style_label(label, size, color, heading)
	return label


func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.clip_text = true
	button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	button.tooltip_text = text
	button.focus_mode = Control.FOCUS_ALL
	PIXEL_UI.style_button(button)
	return button


func _panel(fill: Color, edge: Color) -> PanelContainer:
	var panel: PanelContainer = PIXEL_PANEL.new()
	panel.configure(fill, edge, PIXEL_UI.GOLD)
	return panel
