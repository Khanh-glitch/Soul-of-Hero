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
	check((planner._details.get_child(1) as Label).text.contains("research"), "found formula distinct from learned")
	var research := planner._details.get_child(planner._details.get_child_count() - 2) as Button
	check(research != null and research.disabled, "blocked research disabled")
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
	check(requests.size() == 2 and requests[1].action == "transfer" and requests[1].payload.amount == 3 and requests[1].payload.direction == "deposit", "transfer emits exact amount, direction and stack key")
	planner._request_transfer()
	check(requests.size() == 2, "duplicate transfer blocked while pending")
	planner.set_snapshot(FIXTURE.snapshot())
	check(planner._pending, "refreshing snapshot cannot silently release pending request")
	planner.resolve_request("Fixture rejected: chest full")
	check(original.bag[0].count == 8, "rejected transfer does not subtract inventory")
	planner._set_direction("withdraw")
	planner._select("iron_scrap")
	check(planner._amount.max_value == 2, "withdraw amount bounded by shown quantity")
	planner.select_tab(2)
	var map: Variant = planner._list.get_child(1)
	check(map._points.size() == 1 and map._points[0].id == "road", "map excludes undiscovered marker")
	await process_frame
	var pos: Vector2 = map.get_global_rect().position + Vector2(0.25, 0.55) * (map.size - Vector2(12,12)) + Vector2(6,6)
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
	check(planner._selection == "road" and (planner._details.get_child(0) as Label).text.contains("Old Road"), "map selection updates place information")
	planner.select_tab(3)
	check(planner._list.get_child_count() == 7 and planner._details.get_child_count() == 4, "recovery and revealed hazard displayed")
	planner.select_tab(4)
	planner._select("core-instance-2")
	check((planner._details.get_child(1) as Label).text.contains("Depleted") and (planner._details.get_child(6) as Button).disabled, "depleted core does not offer equip")
	planner._select("core-instance-1")
	check((planner._details.get_child(1) as Label).text.contains("3/8") and (planner._details.get_child(4) as Label).text.contains("research"), "physical charge and unlearned formula are independent")
	var equip := planner._details.get_child(6) as Button
	equip.pressed.emit()
	check(requests.size() == 3 and requests[2].action == "equip_core" and requests[2].id == "core-instance-1", "equip request uses exact instance id")
	planner.resolve_request("Fixture only")
	if DisplayServer.get_name() != "headless":
		var suffix := "_".join(OS.get_cmdline_user_args())
		if suffix.is_empty(): suffix = "1280"
		planner.select_tab(0)
		planner._select("core_formula")
		await process_frame
		await process_frame
		check(root.get_texture().get_image().save_png("res://tests/survival/ui/workshop_fixture_%s.png" % suffix) == OK, "workshop screenshot saved")
		planner.select_tab(2)
		planner._select("road")
		await process_frame
		await process_frame
		check(root.get_texture().get_image().save_png("res://tests/survival/ui/map_fixture_%s.png" % suffix) == OK, "map screenshot saved")
		planner.select_tab(4)
		planner._select("core-instance-1")
		await process_frame
		await process_frame
		check(root.get_texture().get_image().save_png("res://tests/survival/ui/core_fixture_%s.png" % suffix) == OK, "core screenshot saved")
		if suffix == "1280":
			planner.select_tab(1)
			planner._set_direction("deposit")
			planner._select("oak_wood#1")
			await process_frame
			await process_frame
			check(root.get_texture().get_image().save_png("res://tests/survival/ui/storage_fixture_1280.png") == OK, "storage screenshot saved")
			planner.select_tab(3)
			await process_frame
			await process_frame
			check(root.get_texture().get_image().save_png("res://tests/survival/ui/recovery_fixture_1280.png") == OK, "recovery screenshot saved")
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
