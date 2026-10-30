extends SceneTree
const SCENE := preload("res://game/survival/ui/expedition_planner.tscn")
const FIXTURE := preload("res://tests/survival/ui/planner_fixture.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
const JOURNAL := preload("res://game/survival/ui/survival_journal.tscn")
var failures: Array[String] = []
var checks := 0
var requests: Array[Dictionary] = []
var states: Array[bool] = []
class FakeTotals:
	extends RefCounted
	func inventory_totals() -> Dictionary:
		return {"oak_wood": 13, "stone_chunk": 0}

func check(ok: bool, msg: String) -> void:
	checks += 1
	if not ok:
		failures.append(msg)
		printerr("FAIL: ", msg)
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var actual_service := root.get_node("SurvivalService")
	var real_view: Dictionary = ADAPTER.storage(FakeTotals.new(), actual_service, "nonexistent-fixture-chest")
	check(real_view.bag.size() == 1 and real_view.bag[0].id == "oak_wood" and real_view.bag[0].name == "Oak Wood", "storage adapter uses real catalog and aggregated item IDs")
	check(real_view.chest.is_empty() and not real_view.transfer_enabled, "storage adapter does not authorize unknown chest")
	var planner := SCENE.instantiate()
	root.add_child(planner)
	planner.modal_state_changed.connect(func(open: bool): states.append(open))
	planner.request_action.connect(func(action: String, id: String, payload: Dictionary): requests.append({"action": action, "id": id, "payload": payload}))
	var original: Dictionary = FIXTURE.snapshot()
	planner.set_snapshot(original)
	check(planner._snapshot.is_empty(), "fixture state is rejected outside developer diagnostics")
	planner.set_developer_diagnostics(true)
	planner.set_snapshot(original)
	var stale_v1 := original.duplicate(true)
	stale_v1["schema"] = "soh.ui.snapshot.v1"
	planner.set_snapshot(stale_v1)
	check(planner._snapshot == original, "deprecated V1 snapshot cannot enter the V2 view stream")
	planner.open_planner()
	await process_frame
	check(planner.is_modal_active() and states == [true], "modal state signals open")
	var next := InputEventAction.new()
	next.action = "ui_focus_next"
	next.pressed = true
	root.push_input(next)
	await process_frame
	check(planner._tabs[1].has_focus(), "tab keyboard focus advances to next navigation tab")
	planner.open_planner()
	check(states == [true], "repeated open is idempotent")
	check(planner._list.get_child_count() == 4, "only two discovered recipes are listed")
	var missing_knowledge := FIXTURE.snapshot()
	missing_knowledge.recipes.append({"id":"unknown_formula", "name":"Unknown Formula [fixture]", "revealed":true, "knowledge":"recipe"})
	planner.set_snapshot(missing_knowledge)
	check(planner._list.get_child_count() == 5 and not (planner._list.get_child(4) as Button).text.contains("Knowledge state unavailable"), "missing permanent formula projection is omitted instead of showing a technical state")
	planner.set_snapshot(original)
	planner._search.text = "Reed Fibre"
	planner._search.text_changed.emit("Reed Fibre")
	await process_frame
	check(planner._list.get_child_count() == 3, "ingredient search narrows recipes")
	planner._search.text = "SECRET"
	planner._search.text_changed.emit("SECRET")
	await process_frame
	check(planner._list.get_child_count() == 3 and planner._list.get_child(2) is Label, "undiscovered formula cannot leak into search")
	planner._search.text = ""
	planner._search.text_changed.emit("")
	planner._select("core_formula")
	check((planner._details.get_child(1) as Label).text.to_lower().contains("research"), "research-gated formula remains distinct from a physical specimen")
	var research_visible := false
	for child: Node in planner._details.get_children():
		if child is Button and child.text == "RESEARCH": research_visible = true
	check(not research_visible, "blocked research has no dummy control")
	planner._select("bandage")
	var craft := planner._details.get_child(planner._details.get_child_count() - 1) as Button
	check(craft != null and not craft.disabled, "learned recipe explicit capability enables request")
	craft.pressed.emit()
	check(requests.size() == 1 and requests[0].action == "craft" and requests[0].payload.revision == "fixture-1", "craft emits revision-tagged request")
	planner._request("craft", "bandage", {})
	check(requests.size() == 1, "pending request blocks duplicate")
	check(original == FIXTURE.snapshot(), "view does not mutate source snapshot")
	planner.resolve_request("Rejected by fixture host")
	check(not planner._pending, "host can resolve pending request")
	planner.select_tab(1)
	planner._select("oak_wood#1")
	planner._amount.value = 3
	planner._request_transfer()
	check(requests.size() == 2 and requests[1].action == "transfer" and requests[1].id == "oak_wood" and requests[1].payload.item_id == "oak_wood" and requests[1].payload.stack_key == "oak_wood#1" and requests[1].payload.amount == 3 and requests[1].payload.direction == "deposit", "transfer carries canonical A0 item_id separately from UI stack identity and exact amount")
	planner._request_transfer()
	check(requests.size() == 2, "duplicate transfer blocked while pending")
	planner.set_snapshot(FIXTURE.snapshot())
	check(planner._pending, "refreshing snapshot cannot silently release pending request")
	planner.resolve_request("Fixture rejected: chest full")
	check(original.bag[0].count == 8, "rejected transfer does not subtract inventory")
	planner._set_direction("withdraw")
	planner._select("iron_scrap")
	check(planner._amount.max_value == 2, "withdraw amount bounded by shown quantity")
	var protected_snapshot := FIXTURE.snapshot()
	protected_snapshot.bag.append({"id":"soh_i_000000000011_a1c0ffee","instance_id":"soh_i_000000000011_a1c0ffee","name":"Ember Core [fixture]","count":1,"kind":"skill_core","protected":true,"transferable":false})
	planner.set_snapshot(protected_snapshot)
	planner._set_direction("deposit")
	planner._select("soh_i_000000000011_a1c0ffee")
	var has_quantity_control := false
	for child: Node in planner._details.get_children():
		if child is SpinBox or (child is Button and child.text == "REQUEST TRANSFER"): has_quantity_control = true
	check(not has_quantity_control and (planner._details.get_child(2) as Label).text == "Unique Core · transfer unavailable here.", "protected Core row has no generic quantity-transfer affordance")
	planner.set_snapshot(FIXTURE.snapshot())
	planner.select_tab(2)
	var map: Variant = planner._list.get_child(1)
	check(map._points.size() == 1 and map._points[0].id == "poi_crown_waystation", "map excludes undiscovered marker")
	await process_frame
	var pos: Vector2 = map.get_global_rect().position + map._point_position(map._points[0].position)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = pos
	click.pressed = true
	root.push_input(click, true)
	click = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = pos
	click.pressed = false
	root.push_input(click, true)
	await process_frame
	check(planner._selection == "poi_crown_waystation" and (planner._details.get_child(0) as Label).text.contains("Ashen Waystation"), "map selection updates place information")
	planner.select_tab(3)
	var recovery_buttons := planner._list.find_children("*", "Button", true, false)
	check(recovery_buttons.size() == 1 and not (recovery_buttons[0] as Button).disabled and planner._details.get_child_count() >= 1, "only the available recovery action appears beside concise field notes")
	planner.select_tab(4)
	planner._select("soh_i_000000000012_deadbeef")
	check((planner._details.get_child(1) as Label).text.contains("Exhausted"), "depleted Core state remains visible")
	var depleted_equip_visible := false
	for child: Node in planner._details.get_children():
		if child is Button and child.text == "Equip": depleted_equip_visible = true
	check(not depleted_equip_visible, "depleted Core has no dummy equip control")
	planner._select("soh_i_000000000011_a1c0ffee")
	var ember_uses_text := (planner._details.get_child(1) as Label).text
	var ember_formula_text := (planner._details.get_child(4) as Label).text
	check(ember_uses_text.contains("3/8"), "physical Ember uses remain finite: %s" % ember_uses_text)
	check(ember_formula_text.contains("Not learned"), "physical Ember instance does not imply learned formula: %s" % ember_formula_text)
	var equip: Button
	for child: Node in planner._details.get_children():
		if child is Button and child.text == "Equip": equip = child as Button
	check(equip != null, "valid physical Core exposes its available equip action")
	equip.pressed.emit()
	check(requests.size() == 3 and requests[2].action == "equip_core" and requests[2].id == "soh_i_000000000011_a1c0ffee", "equip request uses exact instance id")
	planner.resolve_request("Fixture only")
	planner.close_planner()
	planner.close_planner()
	check(states == [true, false], "modal close emitted once")
	var journal := JOURNAL.instantiate()
	root.add_child(journal)
	var js: Array[bool] = []
	journal.modal_state_changed.connect(func(open: bool): js.append(open))
	journal.open_journal()
	journal.open_journal()
	journal.close_journal()
	journal.close_journal()
	check(js == [true, false] and not journal.is_modal_active(), "journal modal state is idempotent")
	print("EXPEDITION PLANNER: %d checks, %d failures" % [checks, failures.size()])
	planner.queue_free()
	journal.queue_free()
	await process_frame
	await create_timer(1.6).timeout
	quit(0 if failures.is_empty() else 1)
