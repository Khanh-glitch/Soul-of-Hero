extends Node

## Trustworthy player input: does a real mouse click in the workshop do exactly one
## thing, exactly once, even while the list is rebuilding under the pointer?
##
## Every case here drives genuine `InputEventMouseButton` / `InputEventMouseMotion` /
## `InputEventMouseButton`(WHEEL_*) events through the viewport, at the coordinates the
## button actually occupies in the window at the requested resolution. Nothing calls
## `pressed.emit()`: a synthetic signal cannot reproduce the bugs this is looking for,
## because they live in the gap between the engine's mouse state machine and the panel's
## own list rebuild.
##
##   godot --path . --resolution 1280x720 res://tests/survival/ui/a6_workshop_gui_input_test.tscn
##
## Pass prints `A6 WORKSHOP GUI INPUT PASSED (N checks)` and exits 0.

const PANEL_SCRIPT := preload("res://game/survival/economy/economy_panel.gd")
const CATALOG_PATH := "res://data/survival/recipes/recipes.json"
const ITEMS_PATH := "res://data/survival/items/items.json"

var _checks := 0
var _failures: Array[String] = []
var _current_case := "startup"


## Mirrors what A3 does when a queue request arrives: it accepts only an affordable
## request, debits the inputs and publishes a new job list. The panel is expected to
## survive that mutation while the pointer is mid-gesture.
class FakeHost:
	extends Node
	var recipes: Array[Dictionary] = []
	var owned: Dictionary = {}
	var job_list: Dictionary = {}
	var queue_calls: Array[String] = []
	var reject_next := false
	var _seq := 0

	func jobs() -> Dictionary:
		return job_list

	func nearby_stations() -> Array:
		return [{
			"station_id": "hand",
			"kind": "hand",
			"tier": 1,
			"operational": true,
			"queue_capacity": 4,
		}]

	func available_recipes(_station_id: String) -> Array[Dictionary]:
		return recipes

	func available_technologies(_station_id: String) -> Array[Dictionary]:
		return []

	func queue_recipe(recipe: String, station: String) -> Dictionary:
		queue_calls.append(recipe)
		if reject_next:
			reject_next = false
			return {"ok": false, "reason": "missing_inputs"}
		var entry := {}
		for candidate: Dictionary in recipes:
			if String(candidate.get("id", "")) == recipe:
				entry = candidate
				break
		if entry.is_empty():
			return {"ok": false, "reason": "unknown_recipe"}
		var inputs: Dictionary = entry.get("inputs", {})
		for key: Variant in inputs.keys():
			if int(owned.get(String(key), 0)) < int(inputs[key]):
				return {"ok": false, "reason": "missing_inputs"}
		for key: Variant in inputs.keys():
			owned[String(key)] = int(owned.get(String(key), 0)) - int(inputs[key])
		_seq += 1
		job_list["job_%d" % _seq] = {
			"station_id": station,
			"target": recipe,
			"status": "queued",
			"elapsed": 0,
			"duration": int(entry.get("duration_ticks", 6)),
		}
		return {"ok": true, "job_id": "job_%d" % _seq}

	func queue_technology(_technology: String, _station: String) -> Dictionary:
		return {"ok": false}

	func collect(job: String) -> Dictionary:
		job_list.erase(job)
		return {"ok": true}

	func cancel(job: String) -> Dictionary:
		job_list.erase(job)
		return {"ok": true}

	## The panel reads A0's committed bag through this, never by totalling itself.
	func totals() -> Dictionary:
		return owned.duplicate()


class SaveStub:
	extends Node
	var host: Node

	func inventory_totals() -> Dictionary:
		return host.call(&"totals") as Dictionary


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_start_watchdog(120)
	var catalog := _catalog()
	if catalog.is_empty():
		_fail("the recipe catalog could not be read")
		_finish()
		return
	await _case_single_click(catalog)
	await _case_click_across_rebuild(catalog)
	await _case_scroll_then_click(catalog)
	await _case_unaffordable_does_not_queue(catalog)
	await _case_focus_is_not_destroyed(catalog)
	_finish()


# --- cases ------------------------------------------------------------------


## One click is one queue. Two would mean the press and the release both landed on a
## freshly built button.
func _case_single_click(catalog: Dictionary) -> void:
	_enter("single_click")
	var rig := _mount(catalog, {"oak_wood": 40, "stone_chunk": 40})
	await _settle(3)
	var button := _button(rig, "Recipe_workbench_kit_hand")
	_expect(button != null, "the workbench recipe control is on screen")
	if button == null:
		_teardown(rig)
		return
	await _click(rig, button)
	_expect(rig.host.queue_calls.size() == 1,
		"one click queues one job (queued %d)" % rig.host.queue_calls.size())
	if not rig.host.queue_calls.is_empty():
		_equals(rig.host.queue_calls[0], "workbench_kit", "the click queued the recipe it was drawn from")
	_teardown(rig)


## The pointer is still over the list when the list is rebuilt by its own click. The next
## click must be a fresh intention, not the remains of the previous gesture.
func _case_click_across_rebuild(catalog: Dictionary) -> void:
	_enter("click_across_rebuild")
	var rig := _mount(catalog, {"oak_wood": 40, "stone_chunk": 40})
	await _settle(3)
	var first := _button(rig, "Recipe_workbench_kit_hand")
	if first == null:
		_fail("the workbench recipe control is missing")
		_teardown(rig)
		return
	await _click(rig, first)
	await _settle(4)
	_expect(rig.host.queue_calls.size() == 1, "the first click queued once")

	# The rebuild replaced every node; the new control occupies the same place.
	var second := _button(rig, "Recipe_workbench_kit_hand")
	_expect(second != null, "the control exists again after the rebuild")
	_expect(second != first, "the rebuild really did draw a new control")
	if second == null:
		_teardown(rig)
		return
	# The pointer never moved. Anything the engine has pending from the previous
	# gesture must not be attributed to this control.
	await _settle(2)
	_expect(rig.host.queue_calls.size() == 1,
		"rebuilding under a stationary pointer queues nothing by itself (%d)" % rig.host.queue_calls.size())
	await _click(rig, second)
	_expect(rig.host.queue_calls.size() == 2,
		"a second click is exactly one more queue (total %d)" % rig.host.queue_calls.size())
	if rig.host.queue_calls.size() == 2:
		_equals(rig.host.queue_calls[1], "workbench_kit", "the second click queued its own recipe")


## Scrolling and then clicking must hit the row that is now under the pointer.
func _case_scroll_then_click(catalog: Dictionary) -> void:
	_enter("scroll_then_click")
	var rig := _mount(catalog, {"oak_wood": 40, "stone_chunk": 40, "iron_scrap": 40, "grain": 40, "wild_berries": 40})
	await _settle(3)
	var scroll := rig.panel.find_child("Scroll", true, false) as ScrollContainer
	_expect(scroll != null, "the list is scrollable")
	if scroll == null:
		_teardown(rig)
		return
	await _wheel(rig, scroll, 4)
	await _settle(3)
	var before := int(scroll.scroll_vertical)
	_expect(before > 0, "the wheel scrolls the list (offset %d)" % before)
	# Whatever is visible after scrolling, clicking it must queue that recipe and only
	# that recipe.
	var visible_button := _first_clickable(rig)
	_expect(visible_button != null, "something is clickable after scrolling")
	if visible_button == null:
		_teardown(rig)
		return
	var expected := _recipe_of(String(visible_button.name))
	var calls_before := rig.host.queue_calls.size()
	await _click(rig, visible_button)
	var new_calls := rig.host.queue_calls.size() - calls_before
	_expect(new_calls == 1, "clicking after a scroll queues exactly one job (%d)" % new_calls)
	if new_calls == 1:
		_equals(rig.host.queue_calls[rig.host.queue_calls.size() - 1], expected,
			"the click queued the recipe whose control was under the pointer")
	_teardown(rig)


## A row the player cannot pay for must not queue, and the notice must say why rather
## than claim success.
func _case_unaffordable_does_not_queue(catalog: Dictionary) -> void:
	_enter("unaffordable")
	var rig := _mount(catalog, {})
	await _settle(3)
	var button := _button(rig, "Recipe_workbench_kit_hand")
	_expect(button != null, "the unaffordable control is still drawn")
	if button == null:
		_teardown(rig)
		return
	# A refusal is the owner's answer; the UI passes it through and must not pretend.
	rig.host.reject_next = true
	await _click(rig, button)
	await _settle(2)
	_expect(rig.host.queue_calls.size() == 1, "the click reached the owner once")
	expect_no_completion_claim(rig)
	_teardown(rig)


## After the list rebuilds, keyboard focus must not be left on a freed node.
func _case_focus_is_not_destroyed(catalog: Dictionary) -> void:
	_enter("focus_lifetime")
	var rig := _mount(catalog, {"oak_wood": 40, "stone_chunk": 40})
	await _settle(3)
	var button := _button(rig, "Recipe_workbench_kit_hand")
	if button == null:
		_fail("the workbench recipe control is missing")
		_teardown(rig)
		return
	await _click(rig, button)
	await _settle(4)
	var focus := get_viewport().gui_get_focus_owner()
	_expect(focus == null or is_instance_valid(focus),
		"focus is never left on a freed control")
	if focus != null:
		_expect(focus.is_inside_tree(), "the focused control is still in the tree")
	_teardown(rig)


# --- assertions shared by the cases ----------------------------------------


## The word a player reads after a refusal must not be a completion claim.
func expect_no_completion_claim(rig: Dictionary) -> void:
	var notice := rig.panel.find_child("Notice", true, false) as Label
	_expect(notice != null, "the panel has a notice line")
	if notice == null:
		return
	var text := notice.text.strip_edges()
	print("A6 GUI: notice after refusal = %s" % text)
	for claim: String in ["Đã xong", "Hoàn tất", "Done", "Queued"]:
		if text.begins_with(claim):
			_fail("a refused request is reported as success (%s)" % text)


# --- rig --------------------------------------------------------------------


func _mount(catalog: Dictionary, owned: Dictionary) -> Dictionary:
	var save := SaveStub.new()
	save.name = "SaveService"
	add_child(save)
	var host := FakeHost.new()
	host.name = "WorkshopHost"
	add_child(host)
	# Real catalog order, so the list is the one players see.
	host.recipes = _recipe_entries(catalog)
	host.owned = owned.duplicate()
	var panel := PANEL_SCRIPT.new() as Node
	panel.name = "EconomyPanel"
	add_child(panel)
	panel.call(&"configure", host)
	panel.call(&"toggle")
	return {"panel": panel, "host": host, "save": save}


func _teardown(rig: Dictionary) -> void:
	if get_viewport().gui_get_focus_owner() != null:
		get_viewport().gui_get_focus_owner().release_focus()
	for key: String in ["panel", "host", "save"]:
		var node: Node = rig.get(key)
		if node != null and is_instance_valid(node):
			node.get_parent().remove_child(node)
			node.queue_free()
	rig.clear()


func _button(rig: Dictionary, node_name: String) -> Button:
	var panel: Node = rig.get("panel")
	return panel.find_child(node_name, true, false) as Button


## The first button that is actually clickable right now, in list order.
func _first_clickable(rig: Dictionary) -> Button:
	var panel: Node = rig.get("panel")
	for node: Node in panel.find_children("Recipe_*", "Button", true, false):
		var button := node as Button
		if button == null or not button.is_visible_in_tree():
			continue
		if _visible_area(rig, button) > 0.6:
			return button
	return null


## How much of the control is inside the scroll viewport's visible rectangle. A row
## half-hidden by the clip edge is not a fair click target and is skipped.
func _visible_area(rig: Dictionary, control: Control) -> float:
	var scroll := rig.panel.find_child("Scroll", true, false) as Control
	if scroll == null:
		return 1.0
	var view := scroll.get_global_rect()
	var rect := control.get_global_rect()
	var overlap := view.intersection(rect)
	if rect.size.y <= 0.0:
		return 0.0
	return overlap.size.y / rect.size.y


# --- real input -------------------------------------------------------------


## Position a real pointer over the control, then press and release there.
func _click(rig: Dictionary, control: Control) -> void:
	var point := _centre(control)
	await _move_pointer(point)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = point
	press.global_position = point
	Input.parse_input_event(press)
	await _settle(1)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = point
	release.global_position = point
	Input.parse_input_event(release)
	await _settle(2)


func _move_pointer(point: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.position = point
	motion.global_position = point
	Input.parse_input_event(motion)
	await _settle(1)


func _wheel(rig: Dictionary, inside: Control, clicks: int) -> void:
	var point := _centre(inside)
	await _move_pointer(point)
	for _step in range(clicks):
		var wheel := InputEventMouseButton.new()
		wheel.button_index = MOUSE_BUTTON_WHEEL_DOWN
		wheel.pressed = true
		wheel.position = point
		wheel.global_position = point
		Input.parse_input_event(wheel)
		await _settle(1)
		var up := InputEventMouseButton.new()
		up.button_index = MOUSE_BUTTON_WHEEL_DOWN
		up.pressed = false
		up.position = point
		up.global_position = point
		Input.parse_input_event(up)
		await _settle(1)


## Where the control sits in window pixels, not in the authoring space.
func _centre(control: Control) -> Vector2:
	var transform := get_viewport().get_final_transform()
	return transform * (control.get_global_transform_with_canvas() * (control.size * 0.5))


func _settle(frames: int) -> void:
	for _frame in range(frames):
		await get_tree().process_frame


# --- catalog ----------------------------------------------------------------


func _catalog() -> Dictionary:
	if not FileAccess.file_exists(CATALOG_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CATALOG_PATH))
	if not parsed is Dictionary:
		return {}
	var recipes: Variant = (parsed as Dictionary).get("recipes", {})
	return recipes if recipes is Dictionary else {}


func _recipe_entries(catalog: Dictionary) -> Array[Dictionary]:
	# The five the panel shows first are enough to fill more than one screen at 720p,
	# which is what the scroll case needs.
	var order := ["field_meal", "furnace_kit", "stone_pick", "workbench_kit", "burn_charcoal",
		"smelt_iron", "weave_cloth", "craft_core_venom"]
	var out: Array[Dictionary] = []
	for recipe_id: String in order:
		var entry: Dictionary = catalog.get(recipe_id, {})
		if entry.is_empty():
			continue
		out.append({
			"id": recipe_id,
			"inputs": (entry.get("inputs", {}) as Dictionary).duplicate(true),
			"fuel": (entry.get("fuel", {}) as Dictionary).duplicate(true),
			"outputs": (entry.get("outputs", {}) as Dictionary).duplicate(true),
			"duration_ticks": int(entry.get("duration_ticks", 1)),
		})
	return out


## `Recipe_<recipe_id>_<station_id>` -> `<recipe_id>`.
func _recipe_of(control_name: String) -> String:
	var parts := control_name.split("_")
	if parts.size() < 3:
		return ""
	return "_".join(parts.slice(1, parts.size() - 1))


# --- harness ----------------------------------------------------------------


func _enter(case_name: String) -> void:
	_current_case = case_name
	print("A6 GUI CASE: %s" % case_name)


func _start_watchdog(seconds: int) -> void:
	var timer := Timer.new()
	timer.one_shot = true
	timer.wait_time = float(seconds)
	timer.timeout.connect(func() -> void:
		print("::error::A6 WORKSHOP GUI INPUT stuck in '%s' after %ds" % [_current_case, seconds])
		get_tree().quit(1)
	)
	add_child(timer)
	timer.start()


func _equals(actual: Variant, expected: Variant, label: String) -> void:
	_checks += 1
	if actual != expected:
		_failures.append("%s (got %s, expected %s)" % [label, str(actual), str(expected)])


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _fail(label: String) -> void:
	_failures.append(label)


func _finish() -> void:
	if _failures.is_empty():
		print("A6 WORKSHOP GUI INPUT PASSED (%d checks) at %s" % [_checks, _resolution()])
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("A6 WORKSHOP GUI INPUT FAILED: ", failure)
		print("::error::A6 WORKSHOP GUI INPUT FAILED: %s" % failure)
	print("A6 WORKSHOP GUI INPUT FAILED (%d/%d) at %s" % [_failures.size(), _checks, _resolution()])
	get_tree().quit(1)


func _resolution() -> String:
	var size := get_viewport().get_visible_rect().size
	return "%dx%d" % [int(size.x), int(size.y)]
