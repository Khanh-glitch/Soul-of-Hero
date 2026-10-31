extends SceneTree
const WORKSPACE := preload("res://game/survival/ui/expedition_workspace.tscn")
const HOST := preload("res://tests/survival/ui/fixture_host_v1.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
var checks := 0
var failures: Array[String] = []
var intents: Array[Dictionary] = []
var modal: Array[bool] = []
class MalformedDefinitions:
	extends RefCounted
	func item_definition(_id: String) -> Variant: return "broken"
	func piece_definition(_id: String) -> Variant: return null
	func container_contents(_id: String) -> Variant: return null
class FakeSave:
	extends RefCounted
	func inventory_totals() -> Dictionary: return {"mystery": 2}
	func get_inventory_stacks() -> Dictionary: return {"mystery": {"quantity": 2}}
class ClickObserver:
	extends Node
	var count := 0
	func _unhandled_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed: count += 1
func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		printerr("FAIL: ", message)
func _initialize() -> void:
	call_deferred("_run")
func button_with_text(node: Node, text: String) -> Button:
	for child in node.get_children():
		if child is Button and child.text == text: return child
		var result := button_with_text(child, text)
		if result != null: return result
	return null
func send_action(action: String) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	root.push_input(event)
	event = InputEventAction.new()
	event.action = action
	event.pressed = false
	root.push_input(event)
func _run() -> void:
	var ready_host := HOST.new(true)
	check(ready_host.state.recipes[0].can_research and ready_host.state.bag.size() == 2, "interactive demo exposes a research specimen")
	var bad := MalformedDefinitions.new()
	var data := ADAPTER.bag(FakeSave.new(), bad)
	check(data.size() == 1 and data[0].name == "Mystery", "malformed item definition falls back safely")
	check(ADAPTER.storage(FakeSave.new(), bad, "chest").bag[0].name == "mystery", "storage projection tolerates malformed item definition")
	check(ADAPTER.placement(bad, "ghost", "").status.contains("unavailable"), "unknown piece is never reported as valid")
	var background := ColorRect.new()
	background.color = Color("dcdfb5")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(background)
	var observer := ClickObserver.new()
	root.add_child(observer)
	var host := HOST.new()
	var replay_host := HOST.new()
	var replay_payload := {"schema":"soh.ui.intent.v2", "request_id":"retry-example", "sequence":replay_host.state.sequence, "revision":replay_host.state.revision, "direction":"deposit", "container_id":"fixture-chest", "amount":1}
	var original: Dictionary = replay_host.dispatch("transfer", "oak_wood", replay_payload)
	replay_host.state.sequence += 1
	replay_host.state.revision = "fixture-rev-%d" % replay_host.state.sequence
	var fresh: Dictionary = replay_host.dispatch("transfer", "oak_wood", replay_payload)
	check(original.status == "accepted" and fresh.status == "accepted" and fresh.snapshot.sequence > original.snapshot.sequence and replay_host.state.bag[0].count == 7, "deduplicated receipt carries current snapshot without repeating transaction")
	var ui := WORKSPACE.instantiate()
	ui.desk.set_developer_diagnostics(true)
	root.add_child(ui)
	ui.modal_state_changed.connect(func(v: bool): modal.append(v))
	ui.request_action.connect(func(a: String, id: String, payload: Dictionary): intents.append({"action":a,"id":id,"payload":payload}))
	check(ui.apply_snapshot(host.snapshot()), "accept initial versioned snapshot")
	ui.open_workspace()
	ui.open_workspace()
	await process_frame
	check(ui.is_modal_active() and modal == [true], "workspace opens once")
	check(ui.journal._items[0].count == 8 and ui.journal._items[0].stack_key == "oak_wood#fixture", "journal displays exact fixture stack while storage uses item IDs")
	check(ui.journal._build.status.contains("closer") and ui.journal._field.size() == 1, "journal shares placement and filters field notes from snapshot")
	send_action("ui_left")
	await process_frame
	check(ui.journal._tabs[2].has_focus(), "Journal left arrow wraps to last tab")
	send_action("ui_right")
	await process_frame
	check(ui.journal._tabs[0].has_focus(), "Journal right arrow wraps to first tab")
	send_action("ui_right")
	await process_frame
	check(ui.journal._tabs[1].has_focus(), "right arrow follows explicit Journal tab neighbors")
	send_action("ui_accept")
	await process_frame
	check(ui.journal._tab == 1, "keyboard accept opens focused Journal tab")
	ui.journal.select_tab(0)
	(ui.journal._content.get_child(1) as Button).grab_focus()
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()) and ui.journal._tabs[0].has_focus(), "Journal snapshot refresh returns destroyed row focus to active tab")
	ui.journal.select_item(0)
	var switch := button_with_text(ui.journal, "DESK")
	switch.pressed.emit()
	await process_frame
	check(ui.desk.visible and not ui.journal.visible and modal == [true], "switch retains aggregate modal state")
	check(button_with_text(ui.desk, "SATCHEL").size.x >= 58 and button_with_text(ui.desk, "ESC  CLOSE").size.x >= 76, "header controls remain readable after clipping")
	ui.desk._search.text = "reed"
	ui.desk._search.text_changed.emit("reed")
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()) and ui.desk._search.text == "reed", "recipe filter survives authoritative refresh")
	ui.desk._search.text = ""
	ui.desk._search.text_changed.emit("")
	send_action("ui_left")
	await process_frame
	check(ui.desk._tabs[4].has_focus(), "Desk left arrow wraps to last tab")
	send_action("ui_right")
	await process_frame
	check(ui.desk._tabs[0].has_focus(), "Desk right arrow wraps to first tab")
	send_action("ui_right")
	await process_frame
	check(ui.desk._tabs[1].has_focus(), "right arrow follows explicit Desk tab neighbors")
	send_action("ui_accept")
	await process_frame
	check(ui.desk._tab == 1, "keyboard accept opens focused Desk tab")
	ui.desk.select_tab(0)
	await process_frame
	# GUI mouse event is intercepted; this is not a test of A0's polling.
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = ui.desk._tabs[1].get_global_rect().get_center()
	click.pressed = true
	root.push_input(click, true)
	click = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = ui.desk._tabs[1].get_global_rect().get_center()
	click.pressed = false
	root.push_input(click, true)
	await process_frame
	check(ui.desk._tab == 1 and observer.count == 0, "storage tab receives GUI click, unhandled mouse observer does not")
	var storage_search := ui.desk._list.get_child(2) as LineEdit
	storage_search.grab_focus()
	storage_search.text = "not present"
	storage_search.text_changed.emit(storage_search.text)
	check(storage_search.has_focus() and (ui.desk._list.get_child(3) as Label).text.contains("No matching"), "storage filter keeps focus and reports no matches")
	storage_search.text = "oak"
	storage_search.text_changed.emit(storage_search.text)
	check(button_with_text(ui.desk._list, "Oak Wood [fixture]   ×8") != null, "storage filter matches item name case-insensitively")
	ui.desk._set_direction("withdraw")
	check((ui.desk._list.get_child(2) as LineEdit).text == "oak", "storage filter survives direction change")
	ui.desk._set_direction("deposit")
	storage_search = ui.desk._list.get_child(2) as LineEdit
	storage_search.text = ""
	storage_search.text_changed.emit("")
	ui.desk._select("oak_wood")
	button_with_text(ui.desk._details, "ALL AVAILABLE").pressed.emit()
	check(int(ui.desk._amount.value) == 8, "all selects displayed available quantity")
	ui.desk._amount.value = 3
	var transfer := button_with_text(ui.desk._details, "REQUEST TRANSFER")
	check(transfer != null and not transfer.disabled, "transfer offered by fixture host")
	transfer.grab_focus()
	transfer.pressed.emit()
	check(button_with_text(ui.desk._details, "RETRY SAME REQUEST").has_focus(), "pending update moves focus to retry")
	check(intents.size() == 1 and intents[0].payload.schema == "soh.ui.intent.v2" and not intents[0].payload.request_id.is_empty(), "versioned request includes unique intent ID")
	var first: Dictionary = intents[0]
	transfer.pressed.emit()
	check(intents.size() == 1, "double activation while pending sends one intent")
	var wrong := {"schema":"soh.ui.response.v2", "request_id":"wrong", "status":"accepted", "snapshot":host.snapshot()}
	check(not ui.apply_host_response(wrong) and ui.desk._pending, "wrong response ID cannot clear pending")
	button_with_text(ui.desk._details, "RETRY SAME REQUEST").pressed.emit()
	check(intents.size() == 2 and intents[1] == first, "manual retry uses exactly the original intent")
	intents.pop_back()
	ui.show_journal()
	ui.show_desk()
	check(ui.desk._pending and modal == [true], "pending survives switching between views")
	var first_result: Dictionary = host.dispatch(first.action, first.id, first.payload)
	check(first_result.status == "accepted" and host.dispatch(first.action, first.id, first.payload) == first_result, "fixture host duplicate returns same receipt")
	var conflicting_payload: Dictionary = first.payload.duplicate(true)
	conflicting_payload.amount = 4
	check(host.dispatch(first.action, first.id, conflicting_payload).status == "rejected" and host.state.bag[0].count == 5, "fixture rejects request-ID reuse with different payload")
	check(ui.apply_host_response(first_result), "matching accepted response applies")
	check(ui.desk._tabs[1].has_focus(), "resolved response restores focus to active tab")
	check(ui.journal._items[0].count == 5 and ui.journal._selected == 0 and ui.journal._build.costs[0].have == 5 and ui.desk._snapshot.chest.size() == 2, "committed response updates journal and desk")
	check(not ui.apply_host_response(first_result), "replayed response cannot settle a later request")
	var stale := host.snapshot()
	stale.sequence = 1
	check(not ui.apply_snapshot(stale) and ui.journal._items[0].count == 5, "older snapshot cannot overwrite newer displayed state")
	var conflicting := host.snapshot()
	conflicting.bag[0].count = 999
	check(not ui.apply_snapshot(conflicting) and ui.journal._items[0].count == 5, "same-sequence conflicting snapshot rejected")
	ui.desk._select("oak_wood")
	ui.desk._amount.value = 1
	button_with_text(ui.desk._details, "REQUEST TRANSFER").pressed.emit()
	check(intents.size() == 2 and intents[1].payload.request_id != first.payload.request_id, "next logical action has new key")
	check(not ui.apply_host_response(first_result) and ui.desk._pending, "old response cannot resolve new request")
	var later: Dictionary = intents[1]
	var accepted: Dictionary = host.dispatch(later.action, later.id, later.payload)
	var stale_reply := accepted.duplicate(true)
	stale_reply.snapshot.sequence = 1
	check(not ui.apply_host_response(stale_reply) and ui.desk._pending, "stale response snapshot keeps request pending")
	check(ui.apply_host_response(accepted) and ui.journal._items[0].count == 4, "current correlated response updates both views")
	# Full chest: intentionally use a new item in fixture, producer still decides.
	button_with_text(ui.desk._list, "SATCHEL → CHEST").grab_focus()
	host.state.bag.append({"id":"stone_chunk", "name":"Stone [fixture]", "count":2})
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()) and ui.desk._tabs[1].has_focus(), "new fixture snapshot restores list focus to active tab")
	ui.desk._select("stone_chunk")
	button_with_text(ui.desk._details, "REQUEST TRANSFER").pressed.emit()
	var full_req: Dictionary = intents[-1]
	var denied: Dictionary = host.dispatch(full_req.action, full_req.id, full_req.payload)
	check(denied.status == "rejected" and ui.apply_host_response(denied), "full container rejects with correlated response")
	check(ui.journal._items.size() == 2 and ui.journal._items[1].count == 2, "denied transfer preserves displayed inventory")
	# Research confirmation and host update.
	host.state.recipes[0].can_research = true
	var without_sample := {"schema":"soh.ui.intent.v2", "request_id":"missing-specimen-test", "sequence":host.state.sequence, "revision":host.state.revision}
	var missing: Dictionary = host.dispatch("research", "core_formula", without_sample)
	check(missing.status == "rejected" and not host.state.recipes[0].formula_learned, "fixture research without specimen is atomic and rejected")
	host.state.bag.append({"id":"core_specimen", "name":"Core specimen [fixture]", "count":1})
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()), "research-ready fixture snapshot accepted")
	ui.desk.select_tab(0)
	ui.desk._select("core_formula")
	var before := intents.size()
	button_with_text(ui.desk._details, "RESEARCH").pressed.emit()
	check(intents.size() == before, "research waits for confirmation")
	ui.show_journal()
	check(not ui.desk._confirmation.visible and intents.size() == before, "switching view cancels the open confirmation")
	ui.desk._confirmation.confirmed.emit()
	check(intents.size() == before, "hidden confirmation cannot issue research")
	ui.show_desk()
	button_with_text(ui.desk._details, "RESEARCH").pressed.emit()
	await process_frame
	ui.desk._confirmation.canceled.emit()
	ui.desk._confirmation.hide()
	check(intents.size() == before, "cancelling confirmation sends no intent")
	button_with_text(ui.desk._details, "RESEARCH").pressed.emit()
	host.state.recipes[0].can_research = false
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()), "new prereq status is accepted while confirmation is open")
	ui.desk._confirmation.confirmed.emit()
	ui.desk._confirmation.hide()
	check(intents.size() == before, "confirmation rechecks latest capability before emitting")
	host.state.recipes[0].can_research = true
	host.state.sequence += 1
	host.state.revision = "fixture-rev-%d" % host.state.sequence
	check(ui.apply_snapshot(host.snapshot()), "restored research prerequisite accepted")
	button_with_text(ui.desk._details, "RESEARCH").pressed.emit()
	ui.desk._confirmation.confirmed.emit()
	ui.desk._confirmation.hide()
	check(intents.size() == before + 1 and intents[-1].action == "research", "confirmation emits research intent")
	var research: Dictionary = intents[-1]
	check(ui.apply_host_response(host.dispatch(research.action, research.id, research.payload)) and ui.desk._snapshot.recipes[0].formula_learned and ui.desk._snapshot.cores[0].formula_learned and ui.journal._items.size() == 2, "accepted fixture research consumes specimen and synchronizes formula state")
	ui.desk._select("bandage")
	button_with_text(ui.desk._details, "CRAFT").pressed.emit()
	var crafting: Dictionary = intents[-1]
	check(crafting.action == "craft" and ui.apply_host_response(host.dispatch(crafting.action, crafting.id, crafting.payload)) and ui.desk._snapshot.recipes[1].queue_status.contains("Queued"), "fixture craft response updates workstation queue")
	ui.desk.select_tab(4)
	ui.desk._select("soh_i_000000000011_a1c0ffee")
	button_with_text(ui.desk._details, "REQUEST EQUIP").pressed.emit()
	var equip_request: Dictionary = intents[-1]
	check(equip_request.action == "equip_core" and ui.apply_host_response(host.dispatch(equip_request.action, equip_request.id, equip_request.payload)) and ui.desk._snapshot.cores[0].equipped, "Core equip shown only after fixture host acceptance")
	ui.desk.select_tab(3)
	var ruined := button_with_text(ui.desk._list, "RESPAWN: Ruined bed [fixture]")
	check(ruined.disabled, "unavailable bed choice disabled")
	button_with_text(ui.desk._list, "RESPAWN: Home bed [fixture]").pressed.emit()
	var respawn_request: Dictionary = intents[-1]
	check(respawn_request.action == "select_respawn" and ui.apply_host_response(host.dispatch(respawn_request.action, respawn_request.id, respawn_request.payload)), "available respawn choice requires fixture host response")
	# malformed ingredients must not crash the view; hidden entry stays hidden.
	var malformed := host.snapshot()
	malformed.sequence += 1
	malformed.recipes[0].ingredients = "invalid"
	check(ui.apply_snapshot(malformed), "snapshot with malformed ingredient list handled")
	ui.desk.select_tab(0)
	ui.desk._select("core_formula")
	check(ui.desk._selection == "core_formula", "malformed ingredients produce safe empty detail")
	ui.desk.select_tab(2)
	var map: Variant = ui.desk._list.get_child(1)
	await process_frame
	button_with_text(ui.desk._list, "+").pressed.emit()
	check(map._zoom > 1.0, "map zoom-in button works")
	button_with_text(ui.desk._list, "RESET").pressed.emit()
	check(is_equal_approx(map._zoom, 1.0), "map reset button works")
	map.set_zoom(2.0)
	check(is_equal_approx(map._zoom, 2.0) and map._points.size() == 1, "map zoom preserves disclosure filter")
	map.set_zoom(100.0)
	check(is_equal_approx(map._zoom, 4.0), "map zoom clamped")
	map._pan = Vector2.ZERO
	var drag := InputEventMouseMotion.new()
	drag.button_mask = MOUSE_BUTTON_MASK_RIGHT
	drag.relative = Vector2(-20, -10)
	map._gui_input(drag)
	check(map._pan.x < 0 and map._pan.y < 0, "right drag pans zoomed map")
	map.reset_view()
	check(is_equal_approx(map._zoom, 1.0) and map._pan == Vector2.ZERO, "map reset")
	ui.desk.select_tab(3)
	check(button_with_text(ui.desk._list, "RESPAWN: Ruined bed [fixture]").disabled, "unavailable bed choice disabled")
	ui.show_journal()
	check(ui.journal.visible and not ui.desk.visible and modal == [true], "return to journal without releasing modal")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	root.push_input(escape)
	await process_frame
	check(not ui.visible and modal == [true, false], "Escape closes aggregate modal")
	print("WORKSPACE V1: %d checks, %d failures" % [checks, failures.size()])
	ui.queue_free()
	observer.queue_free()
	background.queue_free()
	await process_frame
	await create_timer(1.6).timeout
	quit(0 if failures.is_empty() else 1)
