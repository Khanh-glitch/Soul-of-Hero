extends Control
## Isolated interactive fixture, NOT a gameplay implementation.
const JOURNAL := preload("res://game/survival/ui/survival_journal.tscn")
const ADAPTER := preload("res://game/survival/ui/survival_view_adapter.gd")

func _ready() -> void:
	var ui := JOURNAL.instantiate()
	add_child(ui)
	var bag: Array[Dictionary] = []
	for i in 30:
		bag.append({"id": "oak_wood", "stack_key": "fixture_%d" % i, "name": "Oak Wood %02d" % i, "count": i + 1, "kind": "material", "source_hint": "Oak Tree"})
	bag.append({"id": "core_ember", "stack_key": "soh_i_000000000001_a1c0ffee", "instance_id": "soh_i_000000000001_a1c0ffee", "item_id": "core_ember", "name": "Ember Core [illustrative]", "count": 1, "kind": "core", "uses": 3, "max_uses": 8, "condition": 71, "max_condition": 100, "equipped": false, "formula_learned": false})
	bag.append({"id": "core_frost", "stack_key": "soh_i_000000000002_f2057a11", "instance_id": "soh_i_000000000002_f2057a11", "item_id": "core_frost", "name": "Frost Core [illustrative]", "count": 1, "kind": "core", "uses": 0, "max_uses": 8, "condition": 24, "max_condition": 100, "equipped": true, "formula_learned": false})
	bag.append({"id": "core_venom", "stack_key": "soh_i_000000000003_7e10c0de", "instance_id": "soh_i_000000000003_7e10c0de", "item_id": "core_venom", "name": "Venom Core [illustrative]", "count": 1, "kind": "core", "uses": 1, "max_uses": 5, "condition": 88, "max_condition": 100, "equipped": false, "formula_learned": true})
	ui.set_bag(bag)
	ui.set_placement(ADAPTER.placement(get_node("/root/SurvivalService"), "door_wood", "water", ["oak_tree"]))
	var notes: Array[Dictionary] = [
		{"title": "Frost [fixture]", "text": "Prepare cold protection before venturing beyond the marches."},
		{"title": "Formula [fixture]", "text": ADAPTER.recipe_status("recipe", false)},
		{"title": "Recovery [fixture]", "text": "A future recovery system must report what was preserved and where dropped possessions can be reclaimed."},
	]
	ui.set_field_entries(notes)
	ui.open_journal()
	ui.closed.connect(func(): get_tree().quit())
