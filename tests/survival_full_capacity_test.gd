extends "res://tests/survival_foundation_test.gd"
## Authority fixture, NOT a normal-input journey. Fills a real chest and bag,
## interacts with a mounted node from a repositioned Hero, and checks rollback,
## HUD feedback, retry and reload against the one production SaveService.

func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_full_capacity_%d.json" % Time.get_ticks_usec()
	_save().call(&"configure_storage", save_path, true)
	await _boot()
	if _host != null:
		await _body()
	_teardown()
	await process_frame
	await process_frame
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	print("SURVIVAL FULL CAPACITY %s - %d checks" % ["PASSED" if failures.is_empty() else "FAILED", checks])
	quit(0 if failures.is_empty() else 1)

func _body() -> void:
	var ow := _host.get_child(0)
	var hero := ow.get(&"player") as CharacterBody2D
	var build := ow.get(&"survival_build") as SurvivalBuildSystem
	var svc := _survival()
	var save := _save()
	_clear_inventory()
	_expect(_give(WOOD, 4) and _give(IRON, 1), "fixture funds paid physical chest")
	build.select_piece("chest_wood")
	var chest: Dictionary = build.try_place(_find_buildable(ow, Vector2i.ZERO))
	_expect(bool(chest.get("ok", false)), "paid chest is placed in production overworld")
	var chest_id := String(chest.get("entity_id", ""))
	if chest_id.is_empty():
		return
	for index in range(12):
		var item := "capacity_chest_%02d" % index
		_expect(_give(item, 1) and bool(svc.call(&"transfer_to_container", chest_id, item, 1, "capacity.deposit.%02d" % index)), "fill real chest slot %d" % index)
	var stored: Dictionary = svc.call(&"container_contents", chest_id)
	_expect(stored.size() == 12, "all chest slots occupied")
	var fillers: Array[String] = []
	for index in range(35):
		var item := "capacity_bag_%02d" % index
		if not _give(item, 50):
			break
		fillers.append(item)
	var capacity: Dictionary = save.call(&"get_inventory_capacity_snapshot")
	_expect(int(capacity.get("bag_used", -1)) == int(capacity.get("bag_capacity", -2)) and not fillers.is_empty(), "all bag slots occupied")
	var node_id := _first_node_of_kind("oak_tree")
	var node := ow.call(&"survival_node", node_id) as SurvivalResourceNode
	_expect(node != null, "actual mounted harvest node exists")
	if node == null:
		return
	hero.set_physics_process(false)
	hero.global_position = node.global_position
	var before_state: Dictionary = svc.call(&"resource_state", node_id, "oak_tree")
	var before_inventory: Dictionary = save.call(&"inventory_totals")
	var key := "survival.harvest.%s.%d" % [node_id, int(before_state.get("harvests", 0)) + 1]
	var emitted: Array = []
	node.gathered.connect(func(_node_id: String, _item: String, quantity: int): emitted.append(quantity))
	_expect(node.interact(hero), "full pack interaction is consumed without starting an attack")
	var result := node.last_result()
	_expect(not bool(result.get("ok", false)) and String(result.get("reason", "")) == "inventory_full" and emitted.is_empty(), "full pack gives no harvest success or gathered signal")
	var hud: Node = ow.get(&"hud")
	_expect(hud != null and String(hud.call(&"prompt_text")) == "Your pack is full.", "real HUD reports the rejection rather than a false gain")
	_expect((svc.call(&"resource_state", node_id, "oak_tree") as Dictionary) == before_state and not bool(save.call(&"is_transaction_applied", key)), "failed harvest preserves node and creates no receipt")
	_expect((save.call(&"inventory_totals") as Dictionary) == before_inventory and (svc.call(&"container_contents", chest_id) as Dictionary) == stored, "full bag and chest contents remain exact")
	await create_timer(0.25).timeout
	node.interact(hero)
	_expect(not bool(node.last_result().get("ok", false)) and emitted.is_empty() and not bool(save.call(&"is_transaction_applied", key)), "repeated full-pack attempt cannot consume a hit or receipt")
	_expect(bool(save.call(&"reload_save")), "reload full-capacity save")
	_expect((save.call(&"inventory_totals") as Dictionary) == before_inventory and (svc.call(&"container_contents", chest_id) as Dictionary) == stored and (svc.call(&"resource_state", node_id, "oak_tree") as Dictionary) == before_state and not bool(save.call(&"is_transaction_applied", key)), "full-state rejection persists on reload")
	_expect(bool(save.call(&"consume_inventory_item", fillers[0], 50, "capacity.free.slot")), "free one bag slot for retry")
	await create_timer(0.25).timeout
	node.interact(hero)
	_expect(bool(node.last_result().get("ok", false)) and emitted == [2] and _count(WOOD) == 2 and bool(save.call(&"is_transaction_applied", key)), "retry commits exactly one harvest and its receipt")
	_expect(bool(save.call(&"reload_save")) and _count(WOOD) == 2 and bool(save.call(&"is_transaction_applied", key)) and (svc.call(&"container_contents", chest_id) as Dictionary) == stored, "successful retry and untouched chest survive reload")
	_body_complete = true
