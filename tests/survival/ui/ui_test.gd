extends SceneTree

const VIEW := preload("res://game/survival/ui/survival_journal.tscn")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")
const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
var failures: Array[String] = []
var checks := 0
var selections: Array[String] = []

class FakeSave:
	extends RefCounted
	func get_inventory_stacks() -> Dictionary:
		return {"oak_wood": {"quantity": 12}, "oak_wood#2": {"item_id": "oak_wood", "quantity": 3}, "bad": {"quantity": 0}, "private_unknown_42": {"item_id": "private_unknown_42", "quantity": 1}}

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
	check(bag.size() == 2, "known stacks are preserved while empty and unlabeled private keys stay hidden")
	check(bag[0].name == "Oak Wood" and bag[1].id == "oak_wood", "catalog name and secondary stack item id")
	var unknown_row := ADAPTER._totals_as_rows({"private_unknown_42": 1}, svc, "chest", {}, {}, {})
	check(unknown_row.is_empty(), "unlabeled unknown item key is not exposed as player text")
	check(ADAPTER.bag(null, svc).is_empty(), "missing save is empty")
	var p: Dictionary = ADAPTER.placement(svc, "door_wood", "water", ["oak_tree"])
	check(p.name == "Wooden Door" and p.status.contains("water"), "real catalog and invalid placement reason")
	check(p.costs.size() == 2 and p.costs[0].has("missing"), "all real costs projected")
	check(p.costs[1].sources == ["Oak Tree"] and p.costs[0].sources.is_empty(), "source hints reveal only caller-known sources")
	check(ADAPTER.placement(svc, "door_wood", "unexpected").status == "That spot will not work.", "unknown rejection remains a safe player-facing denial")
	check(ADAPTER.core_status(0, 8).contains("Exhausted"), "zero-use core is visibly exhausted")
	check(ADAPTER.core_status(9, 8).is_empty(), "invalid A3 use count is omitted instead of rendered as a technical state")
	var a3_instance := {"instance_id":"soh_i_000000000004_1234abcd", "item_id":"core_ember", "location":"bag", "condition":61, "max_condition":100, "uses":3, "max_uses":8, "revision":2, "origin":"fixture"}
	var core_view: Dictionary = ADAPTER.core_instance(a3_instance, "Ember Core", false, false, false)
	check(core_view.instance_id == a3_instance.instance_id and core_view.item_id == "core_ember" and core_view.uses == 3 and core_view.condition == 61, "A3 physical-instance schema projects without losing identity or state")
	check(core_view.presentation_only and not core_view.can_equip, "Core projection is display-only and owner-denied by default")
	var invalid_core := a3_instance.duplicate(true)
	invalid_core.uses = 9
	check(ADAPTER.core_instance(invalid_core, "", false, false, false).is_empty(), "invalid finite-use count fails closed in Core presentation")
	var authored_poi := {"poi_id":"poi_crown_waystation", "name":"Ashen Waystation", "cell":[408,200], "region_id":"r_ashen_crown", "material_keys":["salvage","iron"], "required_capabilities":[], "content_readiness":"INTERACTION_SPEC_AUTHORED_NOT_NATIVE", "status":"AUTHORED_PLAN_NOT_NATIVE_INTEGRATED", "purpose":"Teach salvage and seal grammar."}
	var poi_view: Dictionary = ADAPTER.poi_presentation(authored_poi, true, "route state not supplied")
	check(poi_view.id == "poi_crown_waystation" and poi_view.material_keys == ["salvage", "iron"] and poi_view.status == "AUTHORED_PLAN_NOT_NATIVE_INTEGRATED", "A1 POI presentation preserves source IDs, materials and readiness")
	check(ADAPTER.poi_presentation(authored_poi, false).is_empty(), "undiscovered A1 POI is withheld by producer adapter")
	var source_row := {"node_id":"res:src_crown_tuff:01", "material_key":"stone", "status":"CONTRACT_NOT_SPAWNED"}
	check(ADAPTER.material_source_hint(source_row, true).contains("CONTRACT_NOT_SPAWNED"), "A1 source search cannot imply a static node is spawned")
	check(ADAPTER.material_source_hint(source_row, false).is_empty(), "undiscovered source is omitted")
	var hazard_view: Dictionary = ADAPTER.hazard_presentation({"hazard_id":"hz_crown_heat", "kind":"heat", "severity":2, "requires":"cap_filter", "clue":"legacy crucible basin"}, true)
	check(hazard_view.required_capability == "cap_filter" and hazard_view.status == "AUTHORED_CONTRACT_NOT_NATIVE_INTEGRATED", "A1 hazard/capability state is labeled authored, not live damage")
	var capability_view: Dictionary = ADAPTER.capability_presentation("cap_filter", {"kind":"equipment", "source":"poi_amberwood_apothecary", "requires":["cap_salvage"]}, false, "Not supplied by runtime")
	check(not capability_view.owned and capability_view.source_poi == "poi_amberwood_apothecary", "capability ownership remains an explicit runtime input")
	var unknown_capability: Dictionary = ADAPTER.capability_presentation("cap_filter", {"source":"poi_amberwood_apothecary"})
	check(not unknown_capability.has("owned"), "absent runtime capability data stays unknown instead of missing")
	var ember_texture: Texture2D = PIXEL_UI.icon_texture({"id":"core_ember", "kind":"core", "uses":3, "max_uses":8})
	var frost_texture: Texture2D = PIXEL_UI.icon_texture({"id":"core_frost", "kind":"core", "uses":0, "max_uses":8})
	check(ember_texture.get_image().get_size() == Vector2i(24, 24), "original pixel identity is drawn at a controlled 24-pixel logical size")
	check(ember_texture.get_image().get_data() != frost_texture.get_image().get_data(), "Ember and exhausted Frost use distinct silhouettes/pips")
	var unspecified_core: Dictionary = ADAPTER.core_instance(a3_instance, "Ember Core")
	check(not unspecified_core.has("equipped") and not unspecified_core.has("formula_learned") and not unspecified_core.has("can_equip"), "missing equipment and formula owners remain unknown, not false")
	check(ADAPTER.recipe_status("recipe", false) == "Research required" and ADAPTER.recipe_status("recipe", true) == "Formula learned", "A3 recipe category and permanent profile knowledge are distinct")
	check(ADAPTER.recipe_status("recipe", null).is_empty(), "missing permanent formula projection is not rendered as a technical state")
	check(ADAPTER.recipe_status("starter", null) == "Available" and ADAPTER.recipe_status("recipe", null).is_empty(), "missing formula authority is not displayed as unlearned")
	var a3_recipe := {"id":"smelt_ore", "category":"manufacture", "outputs":{"iron_ingot":2}, "inputs":{"iron_ore":4}, "station":"furnace", "min_tier":1, "duration_ticks":16, "knowledge":"recipe", "fuel":{"charcoal":1}, "required_technologies":["tech_smelting"], "balance_status":"SOH_PROPOSAL"}
	var recipe_view: Dictionary = ADAPTER.recipe_presentation("smelt_ore", a3_recipe, {"iron_ore":{"have":2, "source":"A1 material source: not confirmed"}, "charcoal":{"have":0}}, false, true, "Unavailable", "No queue", "Requires active furnace")
	check(recipe_view.ingredients.size() == 2 and recipe_view.ingredients[0].id == "iron_ore" and recipe_view.ingredients[0].need == 4 and recipe_view.ingredients[1].kind == "fuel", "A3 dictionary inputs and fuel map to visible ingredient requirements")
	check(recipe_view.outputs.iron_ingot == 2 and recipe_view.station == "furnace" and recipe_view.required_technologies == ["tech_smelting"] and not recipe_view.can_craft, "A3 station, output, technology and fail-closed action projection")
	check(ADAPTER.recipe_presentation("smelt_ore", a3_recipe, {}, null, false).is_empty(), "undisclosed recipe is absent from client view")
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
	many[0]["id"] = "soh_i_000000000004_1234abcd"
	many[0]["instance_id"] = "soh_i_000000000004_1234abcd"
	many[0]["item_id"] = "core_ember"
	many[0]["name"] = "Ember Core"
	many[0]["kind"] = "core"
	many[0]["uses"] = 0
	many[0]["max_uses"] = 8
	many[0]["condition"] = 18
	many[0]["max_condition"] = 100
	ui.set_bag(many)
	ui.set_placement(p)
	var notes: Array[Dictionary] = [{"title": "Frost", "text": "Prepare cold protection before venturing beyond the marches."}, {"title": "Recipe", "text": ADAPTER.recipe_status("recipe", false)}]
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
	check(ui._detail.get_child_count() >= 5, "selected item shows condition, instance identity and finite uses")
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
