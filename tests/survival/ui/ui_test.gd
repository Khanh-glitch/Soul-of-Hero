extends SceneTree

const VIEW := preload("res://game/survival/ui/survival_journal.tscn")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
var failures: Array[String] = []
var checks := 0
var selections: Array[String] = []

class FakeSave:
	extends RefCounted
	func get_inventory_stacks() -> Dictionary:
		return {"oak_wood": {"quantity": 12}, "oak_wood#2": {"item_id": "oak_wood", "quantity": 3}, "bad": {"quantity": 0}}

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var svc := root.get_node_or_null("SurvivalService")
	check(svc != null, "SurvivalService autoload exists")
	if svc == null:
		quit(1)
		return
	var fake := FakeSave.new()
	var bag: Array[Dictionary] = ADAPTER.bag(fake, svc)
	check(bag.size() == 2, "each valid stack preserved; empty skipped")
	check(bag[0].name == "Oak Wood" and bag[1].id == "oak_wood", "catalog name and secondary stack item id")
	check(ADAPTER.bag(null, svc).is_empty(), "missing save is empty")
	var p: Dictionary = ADAPTER.placement(svc, "door_wood", "water", ["oak_tree"])
	check(p.name == "Wooden Door" and p.status.contains("water"), "real catalog and invalid placement reason")
	check(p.costs.size() == 2 and p.costs[0].has("missing"), "all real costs projected")
	check(p.costs[1].sources == ["Oak Tree"] and p.costs[0].sources.is_empty(), "source hints reveal only caller-known sources")
	check(ADAPTER.placement(svc, "door_wood", "unexpected").status.contains("unexpected"), "unknown rejection is not falsely clear")
	check(ADAPTER.core_status(0, 8).contains("Depleted"), "depleted core")
	check(ADAPTER.core_status(9, 8) == "Charges unavailable", "invalid charges not presented as valid")
	check(ADAPTER.recipe_status(true, false) != ADAPTER.recipe_status(true, true), "found is not learned")
	var original_focus := Button.new()
	original_focus.text = "Outside"
	root.add_child(original_focus)
	original_focus.grab_focus()
	var ui := VIEW.instantiate()
	root.add_child(ui)
	ui.item_selected.connect(func(key: String): selections.append(key))
	var many: Array[Dictionary] = []
	for i in 35:
		many.append({"id": "wood", "stack_key": "stack_%d" % i, "name": "Oak Wood %02d" % i, "count": i + 1, "kind": "material"})
	many[0]["charges"] = 0
	many[0]["max_charges"] = 8
	many[0]["condition"] = "Damaged"
	ui.set_bag(many)
	ui.set_placement(p)
	var notes: Array[Dictionary] = [{"title": "Frost", "text": "Prepare cold protection before venturing beyond the marches."}, {"title": "Recipe", "text": ADAPTER.recipe_status(true, false)}]
	ui.set_field_entries(notes)
	ui.open_journal()
	await process_frame
	check(ui.visible and ui._tabs[0].has_focus(), "open gives tab keyboard focus")
	check(ui._content.get_child_count() == 36, "overflow inventory keeps every stack")
	var scroll := ui._content.get_parent() as ScrollContainer
	check(scroll != null, "overflow hosted by scroll container")
	var first := ui._content.get_child(1) as Button
	first.grab_focus()
	var accept := InputEventAction.new()
	accept.action = "ui_accept"
	accept.pressed = true
	root.push_input(accept)
	accept = InputEventAction.new()
	accept.action = "ui_accept"
	accept.pressed = false
	root.push_input(accept)
	await process_frame
	check(selections == ["stack_0"], "keyboard accept selects the focused exact stack")
	scroll.ensure_control_visible(ui._content.get_child(35) as Control)
	await process_frame
	check(scroll.scroll_vertical > 0, "last overflow stack is reachable by scrolling")
	scroll.scroll_vertical = 0
	check(ui._detail.get_child_count() >= 5, "selected item shows condition and core charges")
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = ui._tabs[1].get_global_rect().get_center()
	click.pressed = true
	root.push_input(click, true)
	click = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = ui._tabs[1].get_global_rect().get_center()
	click.pressed = false
	root.push_input(click, true)
	await process_frame
	check(ui._tab == 1 and ui._content.get_child_count() == 6, "mouse selects build tab with material rows and known source")
	ui._tabs[2].pressed.emit()
	check(ui._tab == 2 and ui._content.get_child_count() == 5, "field tab shows supplied entries")
	ui._tabs[0].pressed.emit()
	ui.select_item(0)
	await process_frame
	await process_frame
	if DisplayServer.get_name() != "headless":
		var suffix := "_".join(OS.get_cmdline_user_args())
		if suffix.is_empty(): suffix = "1280"
		var image := root.get_texture().get_image()
		var result := image.save_png("res://tests/survival/ui/satchel_fixture_%s.png" % suffix)
		check(result == OK, "native screenshot saved")
		ui.select_tab(1)
		await process_frame
		await process_frame
		image = root.get_texture().get_image()
		check(image.save_png("res://tests/survival/ui/build_fixture_%s.png" % suffix) == OK, "build screenshot saved")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	root.push_input(escape)
	await process_frame
	check(not ui.visible, "escape input closes the panel")
	check(original_focus.has_focus(), "close restores prior focus")
	print("SURVIVAL UI: %d checks, %d failures" % [checks, failures.size()])
	ui.queue_free()
	original_focus.queue_free()
	await process_frame
	await create_timer(1.6).timeout
	quit(0 if failures.is_empty() else 1)
