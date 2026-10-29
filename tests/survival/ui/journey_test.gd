extends SceneTree
## Exercises the three fixture journeys against exact pinned A0/A1/A3 source files.
## This is native UI verification only, never a gameplay or owner-transaction test.
const WORKSPACE := preload("res://game/survival/ui/expedition_workspace.tscn")
const FIXTURE := preload("res://tests/survival/ui/journey_contract_fixture.gd")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
const A3_ECONOMY_SOURCE := "res://.a6-contract-inputs/a3/source/economy_service.gd"
var failures: Array[String] = []
var checks := 0
var emitted_actions := 0


func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		printerr("FAIL: ", message)


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var fixture: Dictionary = FIXTURE.snapshot()
	check(
		fixture.get("schema", "") == "soh.ui.journey.fixture.v1",
		"fixture loads versioned source-backed journey DTO"
	)
	check(
		fixture.get("source_refs", {}).get("a0", "") == "aaee29339aca7e953af1b96d5bcc06b0fb7527bc",
		"fixture pins current reviewed A0 source SHA"
	)
	check(
		fixture.get("source_refs", {}).get("a1", "") == "2cb1a3c5f093724eb9fecbdf45909ccb611f7b32",
		"fixture pins A1 route/source contract SHA"
	)
	check(
		fixture.get("source_refs", {}).get("a3", "") == "18e7afcbd576bbd9bfbcc509b2ee13216186a522",
		"fixture pins A3 economy catalog SHA"
	)
	check(
		(
			not fixture.is_empty()
			and (
				fixture.get("a1", {}).get("salvage_material_contract", {}).get("status", "")
				== "CONTRACT_NOT_SPAWNED"
			)
		),
		"A1 authored salvage site retains not-spawned negative status"
	)
	if fixture.is_empty():
		print(
			"A6 JOURNEYS: %d checks, %d failures (fixture unavailable)" % [checks, failures.size()]
		)
		quit(1)
		return
	var a3_source := FileAccess.get_file_as_string(A3_ECONOMY_SOURCE)
	check(
		(
			a3_source.contains('costs["knowledge_spares"] = 5')
			and a3_source.contains('"duration": 40')
			and a3_source.contains('"consumed_by_research"')
			and a3_source.contains('"research:" + String(job["job_id"])')
		),
		"sacrifice preview facts match the pinned A3 implementation source without mounting it"
	)
	var workspace: Variant = WORKSPACE.instantiate()
	root.add_child(workspace)
	workspace.request_action.connect(
		func(_action: String, _id: String, _payload: Dictionary): emitted_actions += 1
	)
	check(workspace.apply_journey_fixture(fixture), "workspace accepts source-pinned fixture only")
	var bad_version: Dictionary = fixture.duplicate(true)
	bad_version.schema = "soh.ui.journey.fixture.v0"
	check(
		not workspace.apply_journey_fixture(bad_version),
		"unknown journey fixture version fails closed"
	)
	var bad_pin: Dictionary = fixture.duplicate(true)
	bad_pin.source_refs.a3 = "unreviewed"
	check(not workspace.apply_journey_fixture(bad_pin), "unapproved A3 source pin fails closed")
	workspace.open_workspace()
	workspace.show_journeys()
	await process_frame
	var view: Variant = workspace.journeys
	check(
		workspace.is_modal_active() and view.is_visible_in_tree(),
		"journey page is included in aggregate modal state"
	)
	check(
		view.is_in_group(&"gameplay_modal") == false and workspace.is_in_group(&"gameplay_modal"),
		"only the hidden-until-open workspace root advertises modal discovery"
	)

	# A: source -> shortfall -> valid bed fixture -> persistent death recovery.
	view.select_journey(0)
	check(
		(
			view._detail_text().contains("Abandoned Supplies")
			and view._detail_text().contains("iron_scrap")
		),
		"A0 source/item identity is visible without claiming a gathered drop"
	)
	view.select_step(1)
	check(
		(
			view._detail_text().contains("4 Oak Wood + 1 Iron Scrap")
			and view._detail_text().contains("Missing in this fixture")
		),
		"bed costs and scarce-material shortfall match A0 catalog"
	)
	view.select_step(2)
	check(
		(
			view._detail_text().contains("FIXTURE_VALIDATED_ONLY")
			and view._detail_text().contains("A6 did not pay")
		),
		"valid bed is explicitly fixture-only, not a construction transaction"
	)
	view.select_step(3)
	check(
		(
			view._detail_text().contains("pending_death: death_7")
			and view._detail_text().contains("all-or-none")
		),
		"death/respawn and capacity-bound recovery remain owner-state projections"
	)

	# B: unique physical Core, finite uses/condition, sacrifice warning and independent formula.
	view.select_journey(1)
	check(
		(
			view._detail_text().contains("soh_i_000000000011_a1c0ffee")
			and view._detail_text().contains("5 / 8")
			and view._detail_text().contains("61 / 100")
		),
		"A3 physical Core instance, uses and condition remain distinct"
	)
	check(
		view._detail_text().contains("BLOCKED_PENDING_A4"),
		"missing A4 attestation is not rendered as cast-ready"
	)
	var original_instance: Dictionary = fixture.a3.core_instance.duplicate(true)
	view.select_step(1)
	view.select_core_choice("research")
	check(
		(
			view.current_projection().step == 2
			and view._detail_text().contains("5 knowledge_spares")
			and view._detail_text().contains("queue 2")
			and view._detail_text().contains("40 active ticks")
			and view._detail_text().contains("consumed_by_research")
		),
		"research choice presents exact cost and irreversible completion consequence"
	)
	view.confirm_sacrifice_preview()
	check(
		(
			view._sacrifice_preview_confirmed
			and fixture.a3.core_instance == original_instance
			and emitted_actions == 0
		),
		"confirm preview sends no owner request and cannot consume/change fixture token"
	)
	view.select_step(3)
	check(
		(
			view._detail_text().contains("charged_blank")
			and view._detail_text().contains("T2")
			and view._detail_text().contains("enqueue stays disabled")
		),
		"craft inputs/tier/ticks and missing owner queue stay explicit"
	)
	check(
		view._status_text().contains("BLOCKED"),
		"A0 active-time and A3 station owner absence remains a negative state"
	)

	# C: safe route, known clues, dangerous alternative; hidden records are withheld.
	view.select_journey(2)
	view.select_step(0)
	check(
		(
			view._detail_text().contains("rt_crown_safe_approach")
			and view._detail_text().contains("low")
		),
		"safe A1 route uses authored risk/capability fields"
	)
	view.select_step(1)
	check(
		view._detail_text().contains("lit lantern") and view._detail_text().contains("dead lamp"),
		"fixture-discovered A1 clues are shown for both POIs"
	)
	check(
		(
			view._detail_text().contains("AUTHORED_PLAN_NOT_NATIVE_INTEGRATED")
			and view._detail_text().contains("none disclosed")
		),
		"POI readiness and no-known-hazard state remain explicit"
	)
	view.select_step(2)
	check(
		(
			view._detail_text().contains("rt_east_seam")
			and view._detail_text().contains("high")
			and view._detail_text().contains("cap_filter")
		),
		"shortcut remains an authored risk label, not fabricated damage"
	)
	var hidden: Dictionary = FIXTURE.hidden_relay_snapshot(fixture)
	var hidden_view: Dictionary = ADAPTER.poi_presentation(hidden.a1.relay, false)
	check(hidden_view.is_empty(), "undiscovered A1 record produces no UI projection")
	check(
		view.set_fixture(hidden), "same pinned fixture can represent a separate A0 discovery state"
	)
	view.select_step(1)
	check(
		not view._detail_text().contains("dead lamp") and view._detail_text().contains("withheld"),
		"hidden Relay clue is not projected when discovery is false"
	)
	view.select_route("shortcut")
	check(
		view.current_projection().route_choice == "shortcut",
		"shortcut choice is a local route-preview selection only"
	)
	check(emitted_actions == 0, "all three journeys remain read-only and emit no gameplay mutation")

	# Mouse, keyboard and controller-oriented focus; pause/Escape is UI-local only.
	view.set_fixture(fixture)
	view.select_journey(0)
	await process_frame
	var right := InputEventAction.new()
	right.action = "ui_focus_next"
	right.pressed = true
	root.push_input(right)
	await process_frame
	check(
		view._journey_tabs[1].has_focus() or view._journey_tabs[0].has_focus(),
		"keyboard navigation retains an explicit journey focus target"
	)
	check(
		(
			view._journey_tabs[0].focus_neighbor_right
			== view._journey_tabs[0].get_path_to(view._journey_tabs[1])
		),
		"controller-oriented right-neighbor wraps into the next journey"
	)
	view._journey_tabs[1].grab_focus()
	var accept := InputEventJoypadButton.new()
	accept.button_index = JOY_BUTTON_A
	accept.device = 0
	if not InputMap.action_has_event(&"ui_accept", accept):
		InputMap.action_add_event(&"ui_accept", accept)
	accept.pressed = true
	check(accept.is_action_pressed(&"ui_accept"), "controller A is bound to the focused accept action")
	var controller_accept := InputEventAction.new()
	controller_accept.action = &"ui_accept"
	controller_accept.device = 0
	controller_accept.pressed = true
	root.push_input(controller_accept, true)
	await process_frame
	check(view.current_projection().journey == 1, "controller A accepts focused journey tab")
	controller_accept.pressed = false
	root.push_input(controller_accept, true)
	await process_frame
	view._journey_tabs[2].grab_focus()
	var mouse := InputEventMouseButton.new()
	mouse.button_index = MOUSE_BUTTON_LEFT
	mouse.position = view._journey_tabs[0].get_global_rect().get_center()
	mouse.pressed = true
	root.push_input(mouse, true)
	mouse = InputEventMouseButton.new()
	mouse.button_index = MOUSE_BUTTON_LEFT
	mouse.position = view._journey_tabs[0].get_global_rect().get_center()
	mouse.pressed = false
	root.push_input(mouse, true)
	await process_frame
	check(
		view.current_projection().journey == 0,
		"GUI mouse click changes only the selected story tab"
	)
	var pause := InputEventJoypadButton.new()
	pause.button_index = JOY_BUTTON_START
	pause.pressed = true
	root.push_input(pause, true)
	await process_frame
	check(
		not workspace.visible and not workspace.is_modal_active(),
		"controller pause closes aggregate UI modal and clears registry state"
	)
	pause = InputEventJoypadButton.new()
	pause.button_index = JOY_BUTTON_START
	pause.pressed = false
	root.push_input(pause, true)
	await process_frame
	check(
		not workspace.visible and emitted_actions == 0,
		"controller release after close cannot submit an action or reopen UI"
	)
	workspace.open_workspace()
	workspace.show_journeys()
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	root.push_input(escape)
	await process_frame
	check(
		not workspace.visible and not workspace.is_modal_active(),
		"Escape closes aggregate UI modal and clears its registry state"
	)
	escape = InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = false
	root.push_input(escape)
	await process_frame
	check(
		not workspace.visible and emitted_actions == 0,
		"keyboard release after close cannot submit a request or reopen UI"
	)

	print("A6 JOURNEYS: %d checks, %d failures" % [checks, failures.size()])
	if not failures.is_empty():
		for failure: String in failures:
			printerr(" - ", failure)
	workspace.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
