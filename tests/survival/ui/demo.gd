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
	bag.append({"id": "fixture_core", "stack_key": "fixture_core", "name": "Uncatalogued Core [fixture]", "count": 1, "kind": "core", "charges": 3, "max_charges": 8, "condition": "Damaged"})
	ui.set_bag(bag)
	ui.set_placement(ADAPTER.placement(get_node("/root/SurvivalService"), "door_wood", "water", ["oak_tree"]))
	var notes: Array[Dictionary] = [
		{"title": "Frost [fixture]", "text": "Prepare cold protection before venturing beyond the marches."},
		{"title": "Formula [fixture]", "text": ADAPTER.recipe_status(true, false)},
		{"title": "Recovery [fixture]", "text": "A future recovery system must report what was preserved and where dropped possessions can be reclaimed."},
	]
	ui.set_field_entries(notes)
	ui.open_journal()
	ui.closed.connect(func(): get_tree().quit())
