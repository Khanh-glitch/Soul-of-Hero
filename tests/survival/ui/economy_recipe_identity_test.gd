extends Node

## Negative control for recipe control identity.
##
## The workshop briefly named its controls after the first OUTPUT item instead of the
## recipe. That is invisible on the recipes whose id happens to equal their product,
## which is exactly why the existing A0 furnace tests stayed green while 23 of the 36
## catalog recipes were mislabelled and five output ids shared one control.
##
## The cases below are read from the real catalog, not invented:
##   * `burn_charcoal` -> `charcoal`      (id != output)
##   * `smelt_iron`    -> `iron_ingot`    (id != output, and...)
##   * `smelt_ore`     -> `iron_ingot`    (...the same output as smelt_iron)
##
##   godot --headless --path . res://tests/survival/ui/economy_recipe_identity_test.tscn
##
## Pass prints `A6 RECIPE IDENTITY PASSED (N checks)` and exits 0.

const PANEL_SCRIPT := preload("res://game/survival/economy/economy_panel.gd")
const CATALOG_PATH := "res://data/survival/recipes/recipes.json"

var _checks := 0
var _failures: Array[String] = []
var _queued: Array = []


## The smallest host the panel talks to. It answers with real catalog entries and
## records what a click actually queued.
class FakeHost:
	extends Node
	var recipes: Array[Dictionary] = []
	var queued: Array = []

	func jobs() -> Dictionary:
		return {}

	func nearby_stations() -> Array:
		return [{
			"station_id": "furnace_1",
			"kind": "furnace",
			"tier": 1,
			"operational": true,
			"queue_capacity": 2,
		}]

	func available_recipes(_station_id: String) -> Array[Dictionary]:
		return recipes

	func available_technologies(_station_id: String) -> Array[Dictionary]:
		return []

	func queue_recipe(recipe: String, station: String) -> Dictionary:
		queued.append({"recipe": recipe, "station": station})
		return {"ok": true}

	func queue_technology(technology: String, station: String) -> Dictionary:
		queued.append({"technology": technology, "station": station})
		return {"ok": true}

	func collect(_job: String) -> Dictionary:
		return {"ok": true}

	func cancel(_job: String) -> Dictionary:
		return {"ok": true}


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog := _catalog()
	if catalog.is_empty():
		_fail("the real recipe catalog could not be read")
		_finish()
		return
	# Prove the premise on the actual data before testing the panel.
	_check_catalog_premise(catalog)
	_check_the_bug_is_reachable(catalog)
	await _check_control_identity(catalog)
	await _check_sibling_recipes_do_not_collide(catalog)
	_finish()


## If the catalog ever stops having these two shapes, this test stops being a
## negative control and says so instead of passing vacuously.
func _check_catalog_premise(catalog: Dictionary) -> void:
	var burn: Dictionary = catalog.get("burn_charcoal", {})
	_expect(not burn.is_empty(), "the catalog still contains burn_charcoal")
	_equals(_first_output(burn), "charcoal",
		"burn_charcoal produces charcoal, so naming by output loses the recipe")
	var smelt: Dictionary = catalog.get("smelt_iron", {})
	_equals(_first_output(smelt), "iron_ingot", "smelt_iron produces iron_ingot")
	var ore: Dictionary = catalog.get("smelt_ore", {})
	_equals(_first_output(ore), "iron_ingot", "smelt_ore produces the same iron_ingot as smelt_iron")
	var differing := 0
	for id: String in catalog.keys():
		if _first_output(catalog[id]) not in ["", id]:
			differing += 1
	_expect(differing >= 10, "most recipes have an id different from their product (%d)" % differing)


## Proof that this test has teeth, computed over the real catalog without an engine:
## under the old rule (name by first output) the two controls in the next case collapse
## into one name and `Recipe_burn_charcoal_*` does not exist at all. If this ever stops
## being true, the negative control below has gone vacuous and says so here.
func _check_the_bug_is_reachable(catalog: Dictionary) -> void:
	var by_recipe := {}
	var by_output := {}
	for id: String in catalog.keys():
		by_recipe[id] = true
		var output := _first_output(catalog[id])
		if not output.is_empty():
			by_output[output] = true
	_expect(by_recipe.size() == catalog.size(), "naming by recipe id gives one name per recipe")
	_expect(
		by_output.size() < catalog.size(),
		"naming by output collapses names (%d names for %d recipes)" % [by_output.size(), catalog.size()],
	)
	_expect(not by_output.has("burn_charcoal"),
		"under output naming there is no control called burn_charcoal, which is the bug")
	_expect(by_output.has("iron_ingot") and not by_recipe.has("iron_ingot"),
		"iron_ingot is an item produced by two recipes and is not itself a recipe")


## The control is named after the recipe, and there is no control named after the item.
func _check_control_identity(catalog: Dictionary) -> void:
	var host := FakeHost.new()
	host.name = "RecipeHost"
	add_child(host)
	host.recipes = [_entry(catalog, "burn_charcoal")]
	var panel := _mount(host)
	await get_tree().process_frame

	var control := panel.find_child("Recipe_burn_charcoal_furnace_1", true, false) as Button
	_expect(control != null, "the control is named after the recipe (Recipe_burn_charcoal_furnace_1)")
	_expect(
		panel.find_child("Recipe_charcoal_furnace_1", true, false) == null,
		"no control is named after the produced item instead of the recipe",
	)
	if control != null:
		_expect(control.is_visible_in_tree(), "the recipe control is visible and clickable")
		# The headline still names the thing you get, because that is what the player
		# is shopping for. R13 moved the display language to Vietnamese, so the product
		# name is the one A6VietnameseNames gives `charcoal`; the assertion is unchanged
		# in intent and still fails if the headline falls back to the recipe id.
		_expect(control.text.begins_with("Than củi"),
			"the headline still names the product, in the interface language (%s)" % control.text)
		_expect(not control.text.contains("burn_charcoal"),
			"the headline is the product, never the recipe id (%s)" % control.text)
		control.pressed.emit()
		var queued: Array = host.queued
		_expect(queued.size() == 1 and String(queued[0]["recipe"]) == "burn_charcoal",
			"pressing it queues burn_charcoal, not the item id")
	_cleanup(panel, host)


## Two recipes that make the same thing must stay two separate controls, and each must
## queue its own recipe. This is the case that a click-to-wrong-recipe bug would hide in.
func _check_sibling_recipes_do_not_collide(catalog: Dictionary) -> void:
	var host := FakeHost.new()
	host.name = "SiblingHost"
	add_child(host)
	host.recipes = [_entry(catalog, "smelt_iron"), _entry(catalog, "smelt_ore")]
	var panel := _mount(host)
	await get_tree().process_frame

	var iron := panel.find_child("Recipe_smelt_iron_furnace_1", true, false) as Button
	var ore := panel.find_child("Recipe_smelt_ore_furnace_1", true, false) as Button
	_expect(iron != null, "smelt_iron has its own control")
	_expect(ore != null, "smelt_ore has its own control")
	_expect(iron != ore, "two recipes producing iron_ingot are two different controls")
	if iron != null and ore != null:
		_expect(iron.name != ore.name, "their node names differ (%s vs %s)" % [iron.name, ore.name])
		_expect(iron.is_visible_in_tree() and ore.is_visible_in_tree(), "both are visible at once")
		iron.pressed.emit()
		ore.pressed.emit()
		var records: Array = host.queued
		var ids: Array[String] = []
		for record: Dictionary in records:
			ids.append(String(record.get("recipe", "")))
		_expect(ids.size() == 2, "both presses reached the owner (%d)" % ids.size())
		if ids.size() == 2:
			_expect(ids[0] == "smelt_iron", "the first control queues smelt_iron (%s)" % ids[0])
			_expect(ids[1] == "smelt_ore", "the second control queues smelt_ore (%s)" % ids[1])
			_expect(ids[0] != ids[1], "the two controls queue different recipes")
	_cleanup(panel, host)


func _mount(host: Node) -> Node:
	var panel := PANEL_SCRIPT.new() as Node
	panel.name = "EconomyPanel"
	add_child(panel)
	panel.call(&"configure", host)
	panel.call(&"toggle")
	return panel


func _entry(catalog: Dictionary, recipe_id: String) -> Dictionary:
	var r: Dictionary = catalog.get(recipe_id, {})
	return {
		"id": recipe_id,
		"inputs": (r.get("inputs", {}) as Dictionary).duplicate(true),
		"fuel": (r.get("fuel", {}) as Dictionary).duplicate(true),
		"outputs": (r.get("outputs", {}) as Dictionary).duplicate(true),
		"duration_ticks": int(r.get("duration_ticks", 0)),
	}


func _catalog() -> Dictionary:
	if not FileAccess.file_exists(CATALOG_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CATALOG_PATH))
	if not parsed is Dictionary:
		return {}
	var recipes: Variant = (parsed as Dictionary).get("recipes", {})
	return recipes if recipes is Dictionary else {}


func _first_output(recipe: Dictionary) -> String:
	var outputs: Dictionary = recipe.get("outputs", {})
	for key: Variant in outputs.keys():
		return String(key)
	return ""


func _cleanup(panel: Node, host: Node) -> void:
	if is_instance_valid(panel):
		panel.get_parent().remove_child(panel)
		panel.queue_free()
	if is_instance_valid(host):
		host.get_parent().remove_child(host)
		host.queue_free()


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
	print("::error::A6 RECIPE IDENTITY FAIL: %s" % label)


func _finish() -> void:
	if _failures.is_empty():
		print("A6 RECIPE IDENTITY PASSED (%d checks)" % _checks)
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("A6 RECIPE IDENTITY FAILED: ", failure)
	print("A6 RECIPE IDENTITY FAILED (%d/%d)" % [_failures.size(), _checks])
	get_tree().quit(1)
