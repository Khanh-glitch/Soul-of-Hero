extends SceneTree
## Real SaveService disk operations, with one-shot debug-only interruption at
## each atomic-replacement boundary. This simulates crash boundaries in one
## process; it is not an OS kill/power-loss test.
var checks := 0
var failures: Array[String] = []
var save: Node
var survival: Node

func _initialize() -> void:
	_run.call_deferred()

func _expect(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("  ok    " + label)
	else:
		failures.append(label)
		print("  FAIL  " + label)

func _run() -> void:
	save = root.get_node("SaveService")
	survival = root.get_node("SurvivalService")
	for boundary: String in ["after_temporary", "after_backup", "after_primary_removed", "after_primary_renamed"]:
		var path := "user://tests/death_fault_%s_%d.json" % [boundary, Time.get_ticks_usec()]
		_expect(bool(save.call(&"configure_storage", path, true)), "fresh authoritative profile: " + boundary)
		_expect(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 3, "fixture.wood")), "seed carried stacks: " + boundary)
		_expect(bool(survival.call(&"learn_recipe", "fault_recipe", "fixture", "fixture.knowledge")), "seed permanent knowledge: " + boundary)
		_expect(bool(save.call(&"configure_test_save_interruption", boundary)), "arm one-shot boundary: " + boundary)
		var result: Dictionary = survival.call(&"begin_overworld_death", Vector2(400, 400))
		_expect(not bool(result.get("ok", true)), "interrupted transaction reports no success: " + boundary)
		_expect(bool(save.call(&"reload_save")), "reload recovers a valid durable generation: " + boundary)
		var doc: Dictionary = survival.call(&"document")
		var pending := String(doc.get("pending_death", ""))
		var wood := int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0))
		var bags: Dictionary = doc.get("death_bags", {})
		if boundary == "after_primary_renamed":
			_expect(not pending.is_empty() and bags.size() == 1 and wood == 0,
				"committed death plus receipt survive lost acknowledgment")
		else:
			_expect(pending.is_empty() and bags.is_empty() and wood == 3,
				"pre-commit generation has all carried wood and no bag: " + boundary)
		_expect(bool(survival.call(&"is_recipe_learned", "fault_recipe")), "permanent knowledge survives: " + boundary)
		var retry: Dictionary = survival.call(&"begin_overworld_death", Vector2(400, 400))
		_expect(bool(retry.get("ok", false)), "death retry resolves to one pending transaction: " + boundary)
		var bag_id := String(retry.get("entity_id", ""))
		var after: Dictionary = survival.call(&"document")
		_expect(not bag_id.is_empty() and (after.get("death_bags", {}) as Dictionary).size() == 1,
			"death retry never duplicates bag: " + boundary)
		_expect(bool(survival.call(&"finish_overworld_death", Vector2(500, 500))), "respawn commits after recovery: " + boundary)
		_expect(bool(survival.call(&"recover_death_bag", bag_id)), "recover carried stack once: " + boundary)
		_expect(not bool(survival.call(&"recover_death_bag", bag_id)), "bag replay cannot duplicate: " + boundary)
		_expect(int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 3,
			"exact carried quantity preserved: " + boundary)
		_expect(bool(save.call(&"reload_save")) and int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 3,
			"recovered inventory persists after second reload: " + boundary)
	for phase: String in ["respawn", "recovery"]:
		for boundary: String in ["after_temporary", "after_backup", "after_primary_removed", "after_primary_renamed"]:
			_exercise_later_boundary(phase, boundary)
	if failures.is_empty():
		print("SURVIVAL SAVE INTERRUPTION PASSED - %d checks" % checks)
		quit(0)
	else:
		print("SURVIVAL SAVE INTERRUPTION FAILED - %d/%d" % [failures.size(), checks])
		for failure: String in failures:
			print("  - " + failure)
		quit(1)


func _exercise_later_boundary(phase: String, boundary: String) -> void:
	var label := phase + ":" + boundary
	var path := "user://tests/death_fault_%s_%s_%d.json" % [phase, boundary, Time.get_ticks_usec()]
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh profile: " + label)
	_expect(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 3, "fixture.wood")), "seed carried wood: " + label)
	var death: Dictionary = survival.call(&"begin_overworld_death", Vector2(400, 400))
	var bag_id := String(death.get("entity_id", ""))
	_expect(bool(death.get("ok", false)) and not bag_id.is_empty(), "create durable death bag: " + label)
	if phase == "recovery":
		_expect(bool(survival.call(&"finish_overworld_death", Vector2(500, 500))), "prepare completed respawn: " + label)
	_expect(bool(save.call(&"configure_test_save_interruption", boundary)), "arm interruption: " + label)
	var reported := false
	if phase == "respawn":
		reported = bool(survival.call(&"finish_overworld_death", Vector2(500, 500)))
	else:
		reported = bool(survival.call(&"recover_death_bag", bag_id))
	_expect(not reported, "interrupted transaction has no success acknowledgment: " + label)
	_expect(bool(save.call(&"reload_save")), "reload a valid durable generation: " + label)
	var doc: Dictionary = survival.call(&"document")
	var pending := String(doc.get("pending_death", ""))
	var bags: Dictionary = doc.get("death_bags", {})
	var wood := int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0))
	if phase == "respawn":
		_expect(bags.has(bag_id) and wood == 0 and (pending.is_empty() if boundary == "after_primary_renamed" else pending == bag_id),
			"respawn is either wholly committed or wholly pending: " + label)
		if not pending.is_empty():
			_expect(bool(survival.call(&"finish_overworld_death", Vector2(500, 500))), "retry pending respawn: " + label)
		_expect(bool(survival.call(&"recover_death_bag", bag_id)), "recover bag after respawn: " + label)
	else:
		_expect(pending.is_empty() and (not bags.has(bag_id) and wood == 3 if boundary == "after_primary_renamed" else bags.has(bag_id) and wood == 0),
			"recovery owns wood on exactly one side: " + label)
		if bags.has(bag_id):
			_expect(bool(survival.call(&"recover_death_bag", bag_id)), "retry uncommitted bag recovery: " + label)
	_expect(not bool(survival.call(&"recover_death_bag", bag_id)), "replayed recovery never duplicates: " + label)
	_expect(int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 3, "exact carried wood restored: " + label)
	_expect(bool(save.call(&"reload_save")) and int((save.call(&"inventory_totals") as Dictionary).get("oak_wood", 0)) == 3,
		"restored wood persists after reload: " + label)
